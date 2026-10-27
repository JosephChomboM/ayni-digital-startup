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

## 2. Baúl de Recuerdos (Propuesto)
Rutas para la gestión del contenido emocional. Aún pendientes de implementación.

*   **`POST /memories/photo`**: Sube una foto a un bucket privado. Devuelve el ID del recuerdo. Para visualizarla, se debe generar una URL firmada de corta duración.
*   **`POST /memories/anecdote`**: Guarda una anécdota y dispara la extracción de entidades (si falla la IA, la anécdota se guarda igual).
*   **`POST /memories/song`**: Guarda un enlace de YouTube/Spotify.
*   **`GET /memories`**: Lista los recuerdos de la familia autenticada. No debe incluir los `is_sensitive=true` en la galería general.
*   **`PATCH /memories/{id}`**: Edita el contenido y las marcas de `is_positive` / `is_sensitive`.
*   **`DELETE /memories/{id}`**: Elimina el recuerdo y su archivo asociado (si corresponde).

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

## 5. Billing (Post-MVP)
*   **`GET /billing/status`**: Devuelve el plan actual (Free / Plan Familia).
*   **`POST /billing/checkout`**: Genera un link de pago (Mercado Pago en modo test). Se requerirá un webhook para sincronizar estados en el futuro.

## 6. Eliminación de Cuenta (Pendiente de definición)
*   **`DELETE /users/me`**: Elimina de forma real la cuenta, sus recuerdos, fotos y respuestas. Falta definir el comportamiento si quien elimina es un familiar o la cuidadora principal.