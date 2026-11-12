# Borrado de cuenta — AYNI-52

Alcance aprobado por Marcelo el 11/11/2026. Backend en desarrollo local;
pendientes PR, pantalla de confirmación y QA en stage con datos sintéticos.

`DELETE /users/me`, con `Authorization: Bearer <access_token>` y JSON:

```json
{"password":"<contraseña de Ayni>","confirmation":"ELIMINAR"}
```

La contraseña conserva el mínimo de diez caracteres. El servidor obtiene el rol
y la familia del usuario autenticado; no acepta IDs de terceros ni un rol enviado
por el navegador. Un borrado completo devuelve **204 sin cuerpo**.

## Confirmación que debe mostrar el frontend

- Familiar: «Se eliminarán tu cuenta, tus recuerdos y las fotos correspondientes.
  Los demás integrantes conservarán su cuenta y los recuerdos que compartieron».
- Cuidador principal: «Se eliminarán toda tu familia, las cuentas de sus integrantes,
  el perfil, recuerdos, fotos, guías y reacciones. También se cerrará el cliente de
  pagos de prueba y se cancelarán sus suscripciones. Esta acción no se puede deshacer».

Solicitar la contraseña y que escriba ELIMINAR. No enviar automáticamente al abrir
la pantalla. Tras 204 borrar el token y mostrar login con confirmación del resultado.
Las guías y reacciones compartidas se conservan al salir un familiar; las referencias
a su autor quedan vacías. El borrado del cuidador elimina el conjunto completo.

## Fallos y reintento

Errores uniformes `{"detail":{"code":"...","message":"..."}}`:

| HTTP | code | Acción |
|---|---|---|
| 401 | `unauthorized` | Volver al login |
| 403 | `invalid_password` | Corregir contraseña; todavía no se inició el borrado |
| 422 | `validation_error` | Revisar confirmación, contraseña y campos |
| 409 | `account_deletion_pending` | Mostrar opción para repetir el borrado |
| 503 | `photo_storage_unavailable`, `photo_storage_not_configured`, `photo_bucket_not_private`, `billing_not_configured`, `payment_provider_unavailable` | Mostrar el mensaje y permitir reintentar; no afirmar que se borró |

Primero se guarda la intención de borrado y se bloquea el acceso regular. Se cierran
las sesiones de pago abiertas y el cliente de Stripe de prueba; luego se eliminan
los objetos privados de Supabase y finalmente las filas mediante hard delete.
Las referencias de archivos se conservan hasta completar la operación, de modo
que se pueda reintentar después de un fallo de red. No es un borrado lógico final:
el éxito exige eliminar las filas y archivos del alcance autorizado.

Si venció el JWT durante un reintento, se puede obtener otro con el login y volver
a llamar al DELETE con contraseña y confirmación. El resto de datos sigue bloqueado.
No borrar el token por un 503 ni ocultar la opción de reintento ante un 409.

QA debe usar familias y proveedores sintéticos. La suite no elimina cuentas reales,
no contacta Stripe ni Supabase y no acredita por sí sola una prueba desplegada.
