# Módulos y Endpoints del Backend - Ayni Digital

Este documento detalla la estructura de la API (FastAPI) que soporta la plataforma, alineada con los contratos ya implementados y las reglas de negocio del proyecto. Sirve como guía para el Frontend y como checklist para las pruebas de QA en el ambiente de staging.

**Nota:** Las rutas no llevan prefijo `/api`. La API se monta directamente en la raíz del dominio.

## 1. Autenticación, Familia y Perfil (Implementado en `main`)
Módulo encargado de gestionar el acceso y la red de apoyo. El consentimiento legal se guarda durante el registro.

*   **`GET /auth/consent`**: Devuelve el texto de consentimiento, su versión y el aviso de onboarding ("Ayni no es un servicio de salud").
*   **`POST /auth/register`**: Registra al usuario (cuidador o familiar invitado). Requiere `family_name` (para crear una nueva familia) o `invitation_token` (para unirse a una existente). No devuelve JWT; el usuario debe iniciar sesión después.
*   **`POST /auth/login`**: Valida credenciales y devuelve el token JWT y datos del usuario.
*   **`GET /users/me`**: Consulta los datos del usuario autenticado.
*   **`GET /families/me`**: Consulta la familia del usuario autenticado.
*   **`GET /families/me/members`**: Lista los miembros de la familia.
*   **`GET /families/me/elder-profile`**: Consulta el perfil del adulto mayor (campos actuales: `name`, `birth_decade`, `interests`).
*   **`PUT /families/me/elder-profile`**: Crea o actualiza el perfil del adulto mayor.
*   **`POST /families/me/invitations`**: Crea una invitación para un nuevo familiar.
*   **`GET /families/me/invitations`**: Lista las invitaciones activas.
*   **`DELETE /families/me/invitations/{invitation_id}`**: Revoca una invitación.

## 2. Baúl de Recuerdos

Anécdotas y canciones implementadas en `main`. Fotos adjuntas implementadas en
`hats/ayni-45-fotos-privadas`; PR, configuración de Supabase y prueba real pendientes.

* **`POST /memories`**: JSON con type `anecdote` (title, text) o `song` (title, url),
  más is_positive/is_sensitive. Para canciones solo videos de YouTube o pistas de Spotify.
* **`GET /memories`**: Lista paginada de la familia; excluye sensibles por defecto.
* **`GET /memories/{id}`**: Consulta un recuerdo de la familia.
* **`PATCH /memories/{id}`**: Edita el autor o cuidador principal; no cambia el tipo.
* **`DELETE /memories/{id}`**: Elimina el autor o cuidador principal; en la rama de fotos
  también retira los archivos privados asociados.
* **`POST /memories/{id}/entities/retry`**: Reintenta la extracción fallida de una anécdota.
* **`POST /memories/{id}/photos`**: Multipart `file`, JPG/PNG/WebP de hasta 8 MiB;
  autor del recuerdo o cuidador principal. 201 con metadatos y URL firmada.
* **`GET /memories/{id}/photos`**: Miembros de la misma familia; lista paginada y URLs firmadas.
* **`DELETE /memories/{id}/photos/{photo_id}`**: Autor o cuidador principal; 204 sin cuerpo.

Todas requieren Bearer JWT. Fotos: bucket privado de Supabase, enlaces de 5 minutos,
10 fotos por familia gratis y sin ese límite durante el periodo pagado del Plan Familia.
Contrato, errores y coordinación con frontend: [PHOTOS.md](PHOTOS.md).

## 3. Sesiones y Respuestas (Propuesto)
Módulo de generación de las guías de 15 a 20 minutos.

*   **`POST /sessions/generate`**: Genera una sesión usando reglas y plantillas (sin depender del LLM o recomendador en esta fase). **Regla estricta:** solo usa recuerdos con `is_positive=true` e `is_sensitive=false`.
*   **`GET /sessions`**: Lista el historial de sesiones de la familia.
*   **`GET /sessions/{id}`**: Devuelve el contenido detallado de la sesión.
*   **`POST /sessions/{id}/response`**: Registra cómo reaccionó el adulto mayor (receptivo, emocionado, indiferente, agitado). Cada sesión admite una sola respuesta; si se envía una segunda, debe manejarse sin duplicar.

## 4. Insights y Alertas (Propuesto)
Generación de patrones descriptivos a partir de las respuestas.

*   **`GET /insights/dashboard`**: Devuelve datos agregados para los gráficos (sesiones completadas, tendencia). No debe afirmar mejora o deterioro clínico.
*   **`GET /insights/alerts`**: Devuelve una alerta si se cumple alguna condición:
    *   3 sesiones consecutivas con respuesta `agitado`.
    *   ≥50% de respuestas negativas (solo `agitado` cuenta como negativa) en las últimas 5 sesiones.
    *   *La alerta debe sugerir pausar y consultar a un profesional, e incluir el disclaimer: "Esto no es un diagnóstico. Es un registro de actividades familiares".*

## 5. Billing (Implementado; configuración de stage pendiente)

Plan Familia: **S/19.90 PEN al mes**, con Stripe solo en modo de prueba.
Configuración, respuestas y verificación: [BILLING.md](BILLING.md).

* **`GET /billing/status`**: Miembros autenticados consultan el plan y estado de su familia.
* **`POST /billing/checkout`**: Solo cuidador principal. Cuerpo `{}`; devuelve `checkout_url` y `expires_at`. El precio se determina en el backend.
* **`POST /billing/cancel`**: Solo cuidador principal. Cuerpo `{}`; cancela futuras renovaciones y conserva el periodo pagado.
* **`POST /billing/webhook`**: Stripe, sin JWT; exige firma `Stripe-Signature`. Confirma pagos y sincroniza estados. Volver a la pantalla de éxito no activa el plan.

Las peticiones de usuario envían `Authorization: Bearer <JWT>`.
Los errores mantienen `{"detail":{"code":"...","message":"..."}}`.
La aplicación de cuotas a otros módulos y la verificación con Stripe/stage siguen pendientes.

## 6. Eliminación de Cuenta (Pendiente de definición)
*   **`DELETE /users/me`**: Elimina de forma real la cuenta, sus recuerdos, fotos y respuestas. Falta definir el comportamiento si quien elimina es un familiar o la cuidadora principal.
