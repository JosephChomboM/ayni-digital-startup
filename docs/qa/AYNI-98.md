# AYNI-98 — Sesión vencida y regreso al plan

Fecha de ejecución: 10 de noviembre de 2026 (Lima).
Base: `f872a23`. Rama: `gonzalo/ayni-98-sesion-plan`.

## Alcance

La prueba renderiza `App` y el formulario real de acceso. El cliente HTTP, la lectura y limpieza del token y los eventos de sesión son los de la aplicación. `fetch` devuelve respuestas simuladas y el panel del plan se sustituye por un componente de prueba.

## Casos añadidos

- Retorno con `billing=success` tras una sesión vencida.
- Retorno con `billing=cancel` tras una sesión vencida.
- Retorno guardado únicamente mediante `ayni_checkout_return`.
- Verificación de que el acceso envía las credenciales al endpoint correcto sin reutilizar el token vencido.
- Fallo de red durante el acceso, conservación del destino y reintento satisfactorio.
- Respuesta de acceso sin token válido, manteniendo el formulario y el destino pendiente.
- Acceso habitual sin retorno de pago, que lleva al inicio.
- Respuesta antigua de sesión recibida después de un HTTP 401, que no debe restaurar al usuario expulsado.

Las pruebas existentes también verifican la limpieza ante un 401 con cuerpo inválido, el cierre de sesión, la identidad de la cuenta y el retorno al plan con una sesión vigente.

## Reproducir las pruebas

Desde `frontend`:

```powershell
npm ci
npm test -- src/api/session.test.tsx
npm test
npm run build
npm run lint
```

La validación automatizada cubre navegación y autenticación con respuestas simuladas. No ejecuta una compra ni confirma una suscripción con Stripe. El retorno de un checkout no se usa como prueba de pago aprobado.

## Resultados

- La suite completa de esta rama pasó 72 pruebas, incluidos los 14 casos de sesión.
- El build pasó. El lint terminó sin errores y conservó las advertencias existentes del proyecto.
- La combinación temporal con la corrección y pruebas de AYNI-97 pasó 84 pruebas. Después se restauraron los archivos separados por rama.
- Esta actividad añade cobertura de regresión sobre el flujo ya implementado de sesión y retorno al plan.
