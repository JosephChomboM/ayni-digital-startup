# Plan Familia: pagos de prueba con Stripe

Tarea: [AYNI-86](https://damatmfr-1790533434032.atlassian.net/browse/AYNI-86).
Rama de implementación: `hats/modulo-billing`.

## Alcance

Plan Familia: **S/19.90 PEN al mes**. Solo se admiten claves y objetos de prueba.
La cuenta continúa disponible con plan gratis cuando no hay un periodo pagado vigente.
La contratación corresponde al cuidador principal y beneficia a su familia.

Esta entrega implementa estado del plan, Checkout, confirmación de pagos y cancelación.
La aplicación de cuotas a canciones, familiares, fotos y sesiones es una integración posterior;
no debe darse por implementada por disponer de estos endpoints.

AYNI-80 describe un pago único en el frontend. Marcelo confirmó la mensualidad el
4 de noviembre de 2026; se actualizan los textos públicos de esta rama. Coordinar
el cambio de criterios de esa historia con Damarys antes de integrar.

## Contrato HTTP

Sin prefijo `/api`. Las peticiones de usuario llevan `Authorization: Bearer <JWT>`.
La familia se obtiene del usuario autenticado; no se recibe un `family_id` del navegador.

| Método y ruta | Permiso | Entrada | Respuesta 200 |
|---|---|---|---|
| GET /billing/status | Miembro de la familia | Sin cuerpo | Estado del plan |
| POST /billing/checkout | cuidador_principal | `{}` | `checkout_url`, `expires_at` |
| POST /billing/cancel | cuidador_principal | `{}` | Estado con cancelación programada |
| POST /billing/webhook | Firma de Stripe, sin JWT | Cuerpo original y Stripe-Signature | `{"received": true}` |

Estado del plan:

```json
{
  "plan": "free",
  "subscription_status": "none",
  "amount_minor": 1990,
  "currency": "PEN",
  "interval": "month",
  "paid_until": null,
  "cancel_at_period_end": false,
  "test_mode": true
}
```

Los estados de suscripción reflejan Stripe: `none`, `incomplete`, `incomplete_expired`,
`trialing`, `active`, `past_due`, `canceled`, `unpaid` o `paused`.
El plan efectivo es `family` solo con periodo pagado vigente y estado `active` o `past_due`.
Un pago fallido no amplía el periodo anterior. Un periodo de prueba de suscripción
no concede por sí solo un periodo pagado.

Errores: `{"detail":{"code":"...","message":"..."}}`.

- 400: `invalid_webhook_signature`, `invalid_webhook_payload`.
- 401: `unauthorized` (sesión ausente, inválida o cuenta inexistente).
- 403: `forbidden` (rol familiar intentando contratar/cancelar).
- 404: `subscription_not_found` (cancelar sin suscripción).
- 409: `subscription_already_exists` (ya hay una suscripción pendiente o vigente).
- 422: `validation_error` (incluye enviar precio o familia desde el navegador).
- 503: `billing_not_configured`, `payment_provider_unavailable`.

## Configuración de Stripe y Render

1. Usar una cuenta de pruebas/sandbox de Stripe.
2. Crear un producto Plan Familia y un precio recurrente de **19.90 PEN cada mes**,
   cantidad fija, sin descuentos ni impuestos adicionales en este prototipo.
3. Configurar estas variables **solo en el backend**. En local, usar `backend/.env`;
   en stage, las variables del servicio API en Render:

| Variable | Valor que se debe cargar |
|---|---|
| STRIPE_SECRET_KEY | Clave de prueba `sk_test_...` |
| STRIPE_WEBHOOK_SECRET | Secreto de firma `whsec_...` del destino de eventos |
| STRIPE_PRICE_ID | Identificador `price_...` del precio mensual |
| BILLING_SUCCESS_URL | URL del frontend, por ejemplo `https://TU-FRONTEND/?billing=success` |
| BILLING_CANCEL_URL | URL del frontend, por ejemplo `https://TU-FRONTEND/?billing=cancel` |

Los dominios anteriores son ejemplos: reemplazarlos por el frontend del mismo ambiente.
Las URLs deben ser HTTPS; se admite HTTP solo para localhost/127.0.0.1 en desarrollo.
El frontend usa su `VITE_API_URL` existente; no necesita una clave de Stripe porque
redirige al Checkout alojado por Stripe.

4. Después de mergear y desplegar, registrar como destino de eventos:
   `https://TU-API/billing/webhook`.
5. Seleccionar estos eventos:
   - `checkout.session.completed`, `checkout.session.expired`.
   - `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`.
   - `customer.subscription.created`, `customer.subscription.updated`,
     `customer.subscription.deleted`, `customer.subscription.paused`,
     `customer.subscription.resumed`.
6. Configurar el destino de eventos con la versión **2026-10-28.endive**,
   predeterminada en el SDK `stripe==16.1.0` fijado en `pyproject.toml`.
   Revisar juntas ambas versiones al actualizar el SDK.
7. Reiniciar la API tras cargar las variables y aplicar `alembic upgrade head`.
   En Render se aplica la migración al iniciar según la configuración existente.

Sin configuración de pagos, la API general y la consulta del plan siguen funcionando;
las operaciones que necesitan Stripe devuelven 503. Una clave de producción se rechaza.

## Confirmación y persistencia

Volver a `?billing=success` no activa el plan. El panel consulta el estado confirmado
por el backend y permite actualizarlo mientras llega el webhook.
Se valida firma y modo de prueba antes de procesar el evento.
El pago, precio, moneda y estado actual se contrastan con Stripe.

Tablas: `billing_subscriptions`, `billing_checkout_attempts`, `billing_webhook_events`.
Una suscripción por familia; identificadores de Stripe únicos. Se conserva el intento
antes de crear Checkout para reutilizar su clave de idempotencia tras errores de red.
Los eventos procesados se identifican por su ID y no guardan el cuerpo completo.
Las fechas incluyen zona horaria. No se guardan tarjetas ni claves en las tablas.

Cancelar detiene renovaciones al final del periodo pagado. No elimina recuerdos.
Al vencer ese periodo se vuelve al plan gratis.

## Verificación local y pendientes

Las pruebas automatizadas usan PostgreSQL local, firma real con claves de prueba
generadas por los tests y un proveedor simulado; no dependen de una cuenta externa.
Tras integrar `main` el 5 de noviembre de 2026: backend **480 pruebas aprobadas**
y frontend **51 pruebas aprobadas**, sin omitidas ni fallos.

También se verificó con Stripe en modo de prueba: contratación desde el frontend,
pago rechazado sin activar el plan, renovación aprobada y fallida mediante reloj de
prueba, y cancelación que conserva el periodo pagado. Los eventos firmados llegaron
al webhook local con HTTP 200. Evidencia y alcance: [QA de AYNI-86](qa/AYNI-86.md).

Antes de cerrar AYNI-86 quedan pendientes la configuración del webhook y las variables
en Render, la comprobación en stage y celular, y la revisión de frontend y QA independiente.
Las pruebas locales no acreditan un despliegue.

Referencias oficiales: [pruebas](https://docs.stripe.com/testing),
[webhooks de suscripciones](https://docs.stripe.com/billing/subscriptions/webhooks),
[cancelación](https://docs.stripe.com/billing/subscriptions/cancel).
