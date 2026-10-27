# Módulos y Endpoints del Backend - Ayni Digital

Este documento detalla la estructura de la API (FastAPI) que soporta la plataforma. Sirve como guía de referencia para el equipo de Frontend y como checklist para las pruebas de QA en el ambiente de staging (`/docs`).

La API está protegida con JWT (excepto el registro y login). Cada petición debe validar que el usuario pertenezca a la familia dueña del perfil para evitar fugas de información.

## 1. Autenticación y Familia
Módulo encargado de gestionar el acceso y la red de apoyo del adulto mayor.

*   **`POST /api/auth/register`**
    Registra al usuario principal (cuidador). Recibe nombre, correo y contraseña. Devuelve el token JWT inicial.
*   **`POST /api/auth/login`**
    Valida credenciales y devuelve el token de acceso.
*   **`POST /api/auth/consent`**
    Guarda la aceptación de los términos y el aviso legal ("Ayni no es un servicio de salud"). Se requiere antes de usar la app por temas de responsabilidad civil.
*   **`POST /api/families/invite`**
    Genera un token o enlace para que el cuidador invite a otros familiares a colaborar en el perfil (ej. la tía que tiene las fotos).

## 2. Perfil del Adulto Mayor
Los datos básicos para personalizar las sesiones.

*   **`POST /api/elders`**
    Crea el perfil del adulto mayor. Requiere nombre, año de nacimiento, ciudad de origen y horario preferido para las sesiones (mañana/tarde).
*   **`GET /api/elders/{id}`**
    Devuelve los datos del perfil para mostrarlos en el dashboard. Solo accesible para los miembros de esa familia.

## 3. Baúl de Recuerdos (Memories)
El corazón del sistema. Aquí se ingesta el contenido que luego alimentará a la IA.

*   **`POST /api/memories/photo`**
    Recibe la imagen, la sube a Supabase Storage (bucket privado) y guarda la referencia. Requiere el flag `is_sensitive` si la foto es delicada.
*   **`POST /api/memories/anecdote`**
    Recibe el texto libre. Aquí se dispara el servicio de NLP (Groq o spaCy) para extraer entidades (lugares, personas) y guardarlas en la tabla `MEMORY_ENTITIES`.
*   **`POST /api/memories/song`**
    Registra el enlace de YouTube o Spotify. No se descarga el audio, solo se guarda la URL.
*   **`GET /api/memories`**
    Lista los recuerdos. **Importante:** Por defecto, este endpoint debe ignorar los recuerdos marcados como `is_sensitive` para evitar que aparezcan en la galería general de la familia.

## 4. Generación de Sesiones
Módulo de lógica pura. No requiere intervención del usuario más allá de pedir la sesión del día.

*   **`POST /api/sessions/generate`**
    El endpoint más importante. Consulta los recuerdos positivos (`is_positive=true`) y arma una guía de 15 minutos. **Regla estricta:** Bajo ninguna circunstancia debe incluir recuerdos `is_sensitive`.
*   **`GET /api/sessions/{id}`**
    Devuelve el contenido exacto de la sesión para que el Frontend lo renderice paso a paso (foto 1, pregunta 1, canción 1).

## 5. Registro de Respuestas e Insights
Cierre del ciclo. Aquí el cuidador registra cómo le fue y el sistema saca estadísticas.

*   **`POST /api/sessions/{id}/response`**
    Registra cómo reaccionó el adulto mayor (receptivo, emocionado, indiferente, agitado). Alimenta al recomendador.
*   **`GET /api/insights/dashboard`**
    Devuelve datos agregados para los gráficos: sesiones completadas, tendencia de respuestas positivas.
*   **`GET /api/insights/alerts`**
    Evalúa las reglas éticas. Si detecta 3 respuestas "agitadas" seguidas o un alto porcentaje de negativas en las últimas 5, devuelve una alerta recomendando pausar las actividades y consultar a un médico.

## 6. Pagos (Simulados)
Para la gestión del plan Free vs. Plan Familia.

*   **`GET /api/billing/status`**
    Devuelve si la familia está en plan gratuito o de pago.
*   **`POST /api/billing/checkout`**
    Genera un link de pago (Mercado Pago en modo test).
