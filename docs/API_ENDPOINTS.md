# Contratos de la API de Ayni

Catálogo contrastado con los routers y schemas de `backend/app` el 2 de noviembre de 2026. La API se monta en la raíz del dominio: no usa prefijo `/api`. Las rutas marcadas **Implementada** existen en este checkout; **Pendiente** indica una propuesta y no se debe integrar como cliente funcional.

## Convenciones

- JSON UTF-8 para cuerpos y respuestas, salvo respuestas `204 No Content`.
- Las rutas privadas requieren `Authorization: Bearer <access_token>` obtenido de `POST /auth/login`. El token tiene una duración expresada en `expires_in` segundos.
- La familia se deriva de la identidad autenticada. El cliente no envía `family_id` para elegir datos.
- Fechas de respuesta son ISO 8601 con zona horaria y normalizadas a UTC.
- Errores públicos usan `{ "detail": { "code": "...", "message": "..." } }`. Los errores de validación no devuelven valores de entrada.
- `401 unauthorized`: falta token, token inválido/vencido o la cuenta ya no existe. `403 forbidden`: rol o permiso insuficiente. `404`: recurso no encontrado dentro del ámbito familiar. `422 validation_error`: cuerpo o parámetros inválidos. Errores de negocio pueden usar códigos específicos; se enumeran abajo.

## Familias, autenticación y perfil — implementado

| Método y ruta | Acceso | Resultado |
|---|---|---|
| `GET /auth/consent` | Público | `200`: `text_version`, `text`, `onboarding_notice` actuales. |
| `POST /auth/register` | Público | `201`: crea cuidador y familia, o acepta invitación. No inicia sesión ni devuelve token. |
| `POST /auth/login` | Público | `200`: `access_token`, `token_type: "bearer"`, `expires_in`, `user`. |
| `GET /users/me` | Bearer | `200`: usuario y consentimiento aceptado. |
| `GET /families/me` | Bearer | `200`: familia del usuario autenticado. |
| `GET /families/me/members` | Bearer | `200`: `{ "items": [...] }` miembros de la familia. |
| `GET /families/me/elder-profile` | Bearer | `200`: perfil; `404 elder_profile_not_found` si aún no existe. |
| `PUT /families/me/elder-profile` | Cuidador principal | `200`: crea o reemplaza perfil (`name`, `birth_decade`, `interests`). |
| `POST /families/me/invitations` | Cuidador principal | `201`: invitación y token de un solo uso; el token se muestra solo al crearla. |
| `GET /families/me/invitations` | Cuidador principal | `200`: invitaciones con estado calculado. |
| `DELETE /families/me/invitations/{invitation_id}` | Cuidador principal | `204`; solo una invitación pendiente puede revocarse. |

`POST /auth/register` acepta exactamente uno de estos modos:

```json
{
  "email": "ana@example.com",
  "name": "Ana",
  "password": "una-clave-de-10-caracteres",
  "consent": { "accepted": true, "text_version": "1.0" },
  "family_name": "Familia Rivera"
}
```

Para unirse a una familia se envía `invitation_token` en lugar de `family_name`. El correo se normaliza a minúsculas; contraseña de al menos 10 caracteres; no se aceptan propiedades extra. Consentimiento ausente o no aceptado: `422 consent_required`; versión desactualizada: `422 consent_version_invalid`; correo ya registrado: `409 email_already_registered`. La aceptación persiste la versión y copia del texto. El alta de cuidador crea familia, cuenta y consentimiento en una transacción.

Ejemplo de login y uso del token:

```http
POST /auth/login
Content-Type: application/json
```

```json
{ "email": "ana@example.com", "password": "una-clave-de-10-caracteres" }
```

```json
{
  "access_token": "<token>",
  "token_type": "bearer",
  "expires_in": 1800,
  "user": {
    "id": "<uuid>", "email": "ana@example.com", "name": "Ana",
    "family_id": "<uuid>", "role": "cuidador_principal",
    "created_at": "2026-11-02T12:00:00Z"
  }
}
```

La duración exacta depende de `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`. Credenciales incorrectas: `401 invalid_credentials`; la respuesta no distingue correo inexistente de contraseña incorrecta. Solo el cuidador principal puede editar el perfil, crear/listar/revocar invitaciones. Invitaciones duplicadas: `409 invitation_already_pending`; vencida o revocada: `410 invitation_expired` o `410 invitation_revoked`.

## Recuerdos — implementado

La ruta real es `POST /memories`, con discriminador `type`; no existen `/memories/anecdote` ni `/memories/song`.

| Método y ruta | Acceso | Resultado |
|---|---|---|
| `POST /memories` | Bearer y perfil creado | `201`: persiste anécdota o canción; la extracción NLP de anécdotas se programa en segundo plano. |
| `GET /memories` | Bearer | `200`: lista paginada; excluye sensibles por defecto. |
| `GET /memories/{memory_id}` | Bearer | `200`: detalle solo si pertenece al perfil familiar; en otro caso `404 memory_not_found`. |
| `PATCH /memories/{memory_id}` | Autor o cuidador principal | `200`: cambia campos permitidos; no permite cambiar el tipo. |
| `DELETE /memories/{memory_id}` | Autor o cuidador principal | `204`; las entidades extraídas se eliminan en cascada. |

Crear anécdota:

```json
{
  "type": "anecdote", "title": "La huerta de la abuela",
  "text": "Cada domingo cuidábamos las plantas.",
  "is_positive": true, "is_sensitive": false
}
```

Crear canción:

```json
{
  "type": "song", "title": "Vals familiar",
  "url": "https://open.spotify.com/track/0123456789012345678901",
  "is_positive": true, "is_sensitive": false
}
```

La respuesta incluye `id`, `elder_profile_id`, `created_by`, `type`, `title`, `text` o `url`, las marcas, `entities`, `entities_status`, `created_at` y `updated_at`. El texto de una anécdota no se expone en representaciones de depuración. El NLP puede quedar `pending`, `completed` o `failed`; un fallo de extracción no revierte el recuerdo. En canciones, `entities` está vacío y el estado es `not_applicable`.

Parámetros de `GET /memories`: `type=anecdote|song`, `include_sensitive=false` (predeterminado), `limit=20` (1–100), `offset=0`. Respuesta: `{ "items": [...], "total": 0, "limit": 20, "offset": 0 }`. Para mostrar sensibles el consumidor debe solicitarlo explícitamente en una vista con permisos adecuados.

`PATCH` admite uno o más de `title`, `text`, `url`, `is_positive`, `is_sensitive`; no admite valores nulos, cuerpo vacío, ni `text` y `url` simultáneamente. El enlace debe ser un video de YouTube o una pista de Spotify (no una playlist). Al cambiar el texto, se invalidan las entidades y se vuelve a programar la extracción. Un miembro solo puede editar/eliminar sus recuerdos; cuidador principal puede editar/eliminar los de su familia. Sin perfil: `404 elder_profile_not_found`; edición por usuario sin permiso: `403 forbidden`.

## Contratos propuestos — todavía no implementados

Estos nombres y formas no están respaldados por routers, schemas ni persistencia en este checkout. El cliente debe tratarlos como backlog hasta que exista una entrega:

| Capacidad propuesta | Rutas sugeridas | Estado en código |
|---|---|---|
| Fotos privadas | No hay ruta definida | Sin carga, storage ni URL firmada; las fotos no son un tipo de recuerdo. |
| Guías/sesiones | `POST /sessions/generate`, `GET /sessions`, `GET /sessions/{id}` | No hay módulo, endpoint, almacenamiento ni contrato JSON. |
| Respuestas | `POST /sessions/{id}/response` | No implementado. |
| Insights/alertas HTTP | `GET /insights/dashboard`, `GET /insights/alerts` | Solo existe evaluador Python aislado; no hay router ni historial persistido. |
| Facturación | `GET /billing/status`, `POST /billing/checkout` | Post-MVP; no implementado. |
| Eliminación de cuenta | `DELETE /users/me` | No implementado; reglas de borrado por rol pendientes. |

La regla de producto prevista para guías es incluir únicamente recuerdos `is_positive=true` e `is_sensitive=false`; no implica que una guía exista hoy. El evaluador de pausa aislado considera por defecto tres reacciones `agitado` consecutivas o al menos 50% negativas en una ventana completa de cinco. Esas reglas no constituyen endpoints ni validación clínica.

## Trazabilidad

- Familias y autenticación: `backend/app/modules/families/router.py`, `schemas.py`, `service.py`.
- Recuerdos y extracción: `backend/app/modules/memories/router.py`, `schemas.py`, `service.py`, `extraction.py`.
- Errores y autenticación Bearer: `backend/app/core/error_handlers.py` y `backend/app/modules/families/service.py`.
- Evaluador aislado de pausa: `backend/app/modules/insights/service.py`.
- Implementación de infraestructura: `render.yaml`, `.github/workflows/ci-cd.yml` y `docker-compose.yml`.
