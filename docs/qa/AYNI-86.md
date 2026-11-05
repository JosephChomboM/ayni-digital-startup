# AYNI-86 — Suscripción mensual familiar en modo de prueba

Fecha de ejecución: **5 de noviembre de 2026**, America/Lima.
Responsable de implementación y verificación local: Marcelo Martinez (Hats).

## Entorno

- PostgreSQL 16 local dedicado; ninguna conexión a Supabase, stage o producción.
- API y frontend locales; Stripe en modo de prueba con cuentas sintéticas.
- Stripe SDK `16.1.0`, API `2026-10-28.endive` y Stripe CLI oficial `1.55.8`.
- Plan mensual de **1990 unidades menores PEN (S/19.90)**.
- Secretos cargados en memoria mediante variables de entorno de los procesos de prueba.
  No se modificaron archivos `.env` ni se incorporaron claves al repositorio.

## Pruebas automatizadas después de integrar main

| Verificación | Resultado |
|---|---|
| Ruff format y Ruff check | Correctos; ningún archivo Python reformateado |
| Suite completa con PostgreSQL | 480 pasan, 0 omitidas, 0 fallos |
| Frontend Vitest | 51 pasan, 0 omitidas, 0 fallos |
| Alembic heads | Una cabeza: `0f05d164265d` |
| Alembic upgrade head | Correcto |

La suite backend presenta una advertencia existente sobre `httpx` y Starlette.
El lint del frontend presenta tres advertencias existentes en `badge.tsx`,
`button.tsx` y `UploadModule.tsx`; ningún error.

## Pruebas contra Stripe en modo de prueba

Se creó el precio mensual en el entorno de prueba y se reenviaron eventos reales
firmados por Stripe CLI al endpoint local `/billing/webhook`.
No hubo cobros reales ni se utilizaron tarjetas reales.

| Caso | Resultado observado |
|---|---|
| Abrir Checkout desde el panel | Muestra PEN19.90 al mes y el aviso de entorno de prueba |
| Repetir Checkout antes del pago | Devuelve la misma URL, sin crear otra contratación |
| Tarjeta de prueba rechazada | Stripe informa el rechazo; Ayni permanece `free` / `none` |
| Tarjeta de prueba aprobada | Webhooks HTTP 200; Ayni pasa a `family` / `active` |
| Cancelar desde el panel | `cancel_at_period_end=true`; mantiene el periodo pagado |
| Renovación aprobada con reloj de prueba | `invoice.paid` HTTP 200; periodo pagado del 05/12/2026 al 05/01/2027 |
| Renovación rechazada con reloj de prueba | `invoice.payment_failed` HTTP 200; estado `past_due`; no amplía `paid_until` |
| Llegada al final de la cancelación | `customer.subscription.deleted` HTTP 200; Ayni pasa a `free` / `canceled` |

El reloj de prueba de Stripe avanzó al futuro; el servidor conservó su reloj real.
Después del rechazo se comprobó que no se ampliara el periodo pagado. Ese caso por
sí solo no demuestra el vencimiento de un periodo según el reloj real del servidor.
Las cuentas de prueba quedaron con renovación cancelada.

## Corrección encontrada

La API actual de Checkout rechazó `payment_method_types`. Se retiró ese parámetro
y se reforzó el test de gateway en el commit `d667305`.
Stripe selecciona los métodos de pago según la configuración de su Dashboard.

## Cómo repetir la verificación

1. Aplicar `alembic upgrade head` en la base local de prueba.
2. Configurar las variables indicadas en [BILLING.md](../BILLING.md), sin subir claves.
3. Escuchar los eventos con Stripe CLI y reenviarlos a la API local.
4. Crear una cuenta sintética de cuidador principal y abrir Checkout desde el panel.
5. Usar las tarjetas oficiales de prueba para aprobación y rechazo; verificar
   el resultado con `GET /billing/status` después de cada webhook.
6. Para renovaciones, preparar un cliente vinculado a un reloj de prueba antes de
   contratar, avanzar un periodo y contrastar el periodo pagado. Cambiar a un método
   de prueba que rechace el siguiente pago y repetir; el periodo no debe ampliarse.
7. Cancelar la renovación y verificar que se conserve el periodo ya pagado.

Referencias: [pruebas oficiales de Stripe](https://docs.stripe.com/testing) y
[relojes de prueba](https://docs.stripe.com/billing/testing/test-clocks/simulate-subscriptions).

## Pendientes para cerrar la tarea

- Cargar las variables y el secreto del destino de webhooks de stage en Render.
  El secreto temporal de Stripe CLI no sirve como secreto del destino de stage.
- Verificar el flujo desplegado y en celular.
- Revisión del diseño e integración por frontend y QA independiente.
- Integrar las cuotas del plan en los módulos correspondientes en otra tarea.
