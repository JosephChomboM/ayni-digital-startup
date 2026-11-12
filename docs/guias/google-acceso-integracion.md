# Google y perfil de cuenta — AYNI-82

Backend preparado localmente. Falta publicar el PR, configurar Google Cloud y
validar el acceso real en local/stage. Damarys integra la pantalla; Marcelo mantiene
la API. No activar el botón antes de disponer de Client ID y backend desplegado.

## Configuración de Gonzalo / Damarys

1. Crear un cliente web en Google Auth Platform y configurar marca, audiencia y
   usuarios de prueba cuando la aplicación esté en modo de pruebas.
2. Autorizar los orígenes exactos del frontend local y desplegado. Para desarrollo,
   Google recomienda localhost y localhost con el puerto usado. No inventar las
   URLs de stage/producción: comprobar las de Render. No llevan rutas.
3. Colocar su Client ID público en `GOOGLE_CLIENT_ID` del backend y reiniciar.
   `.env.example` deja el valor vacío. Se usa Google Identity Services con callback
   JavaScript y verificación de ID token: este flujo no necesita Client Secret.
4. Cargar el script oficial `https://accounts.google.com/gsi/client` en el frontend.
   Si la política CSP o COOP del despliegue bloquea el botón, ajustar esos encabezados
   según Google; no eliminar globalmente las protecciones del sitio.

El backend funciona con email/contraseña aunque Google esté sin configurar.
Las credenciales y el nonce nunca van en URLs ni logs. Solo se solicitan datos de
identidad; no acceso al correo, contactos ni otros servicios de Google.

## Secuencia para la pantalla

| Método y ruta | Entrada | Salida |
|---|---|---|
| GET `/auth/google/config` | — | `{enabled, client_id}`; client_id null si está deshabilitado |
| POST `/auth/google/challenge` | — | 201 `{challenge_id, nonce, expires_at}`; validez 5 minutos |
| POST `/auth/google/login` | `{credential, challenge_id}` | 200: mismo formato que `/auth/login`, JWT de Ayni |
| POST `/auth/google/register` | Ver abajo | 201: mismo formato que `/auth/register`, sin token |
| POST `/auth/google/link` | `{credential, challenge_id, password}` + Bearer de Ayni | 204 sin cuerpo |
| PATCH `/users/me` | Campos modificados de `{name, phone, city, district}` + Bearer | 200: mismo formato que GET `/users/me` |

1. Si config.enabled es false, mantener Google deshabilitado con aviso claro.
2. Solicitar challenge al pulsar Google e inicializar GIS con `client_id` y ese
   `nonce`. Conservar el challenge_id de ese intento en memoria del componente.
3. El callback de GIS entrega `credential`. Enviarlo con el challenge_id de ese
   intento a `/auth/google/login`. No usar un ID de usuario ni un access_token de
   Google como sustituto. No decodificar el token en frontend para decidir permisos.
4. Si tiene éxito, guardar `access_token` de Ayni como en el login actual y comprobar
   sesión mediante GET `/users/me`. Las demás llamadas usan Bearer de Ayni.
5. `google_account_not_registered` (404): abrir el formulario de registro. Se puede
   reutilizar ese intento no consumido dentro de los cinco minutos; si vence,
   iniciar Google nuevamente. Leer texto/versión/aviso mediante GET `/auth/consent`.

Registro Google:

```json
{
  "credential": "<credential del callback GIS>",
  "challenge_id": "<UUID del intento>",
  "name": "<nombre elegido>",
  "password": "<contraseña de Ayni de al menos 10 caracteres>",
  "consent": {"accepted": true, "text_version": "1.0"},
  "family_name": "<familia>"
}
```

Para una invitación, reemplazar `family_name` por `invitation_token`: nunca ambos.
El correo lo obtiene el backend del token verificado, no se acepta en este cuerpo.
La contraseña de Ayni es un respaldo y permite confirmar el borrado de cuenta.
Validar mínimo diez caracteres antes de enviar. El registro no devuelve token:
después llamar al login normal con `response.user.email` y la contraseña recién
elegida, o iniciar un nuevo intento Google. No enviar esa contraseña a Google.

Si existe el correo y aún no está vinculado, login devuelve `google_link_required`
(409). Iniciar sesión por contraseña y ofrecer vincular Google dentro de la cuenta,
con Bearer, contraseña y un intento Google válido del mismo correo. No se fusionan
cuentas automáticamente por coincidencia de email. La identidad persistente es el
`sub` de Google. No se solicita una nueva familia a un usuario ya vinculado.

Perfil: GET `/users/me` y los objetos `user` de login/registro incluyen `phone`,
`city`, `district`, que pueden ser null. PATCH solo modifica campos enviados;
null borra teléfono/ciudad/distrito, pero no el nombre. Campos de ubicación de
1–100 caracteres; teléfono de 6–30, con dígitos y separadores habituales. No enviar
estos campos a `/auth/register`: guardarlos después del login mediante PATCH.

## Errores

Siempre `{"detail":{"code":"...","message":"..."}}`. Mostrar detail.message.
El cliente actual borra la sesión ante cualquier 401; conservar ese comportamiento.

| Endpoint | code y HTTP |
|---|---|
| config | 200 habilitado o deshabilitado |
| challenge | `google_not_configured` 503 |
| login | `google_account_not_registered` 404; `google_link_required` 409; `invalid_google_credential`, `invalid_google_challenge`, `unauthorized` 401; `account_deletion_pending` 409 |
| register | `consent_required`, `consent_version_invalid`, `validation_error` 422; `email_already_registered`, `google_account_already_linked`, `invitation_used` 409; `invitation_not_found` 404; `invitation_email_mismatch` 403; `invitation_expired`, `invitation_revoked` 410; credencial/intento inválido 401 |
| link | `unauthorized`, credencial/intento inválido 401; `invalid_password`, `google_email_mismatch` 403; `google_account_already_linked`, `account_deletion_pending` 409 |
| PATCH users/me | `unauthorized` 401; `validation_error` 422; `account_deletion_pending` 409 |

Los endpoints de credenciales también pueden devolver `google_not_configured` o
`google_unavailable` (503), o `validation_error` (422). No mostrar éxito ante esos
errores. El SDK valida firma RSA, issuer, audience y expiración; la app valida
email verificado y consume el nonce una sola vez. Los tokens de Google no se guardan.

## Verificaciones y entrega

Pruebas locales: firma RSA real con claves sintéticas, expiración, issuer/audience
incorrectos, intento vencido/reutilizado, consentimiento, invitación, vinculación
explícita y perfil aislado. No acreditan un acceso con una cuenta real de Google.
QA real queda bloqueado hasta disponer del Client ID y los orígenes autorizados.

Referencias oficiales:
- [Preparación de Google Identity Services](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).
- [Verificación del ID token en backend](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).
