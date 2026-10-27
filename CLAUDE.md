# CLAUDE.md — Ayni Digital

## Qué es este proyecto

Ayni Digital es una plataforma web para cuidadoras familiares de adultos mayores con deterioro cognitivo leve en Lima. La familia sube recuerdos (fotos, anécdotas escritas, canciones) y la plataforma los convierte en guías de sesión de estimulación cognitiva por reminiscencia de 15–20 minutos que cualquier familiar puede seguir sin formación clínica.

Proyecto Final de Carrera III (USIL, 2026). Equipo de 4 estudiantes, presupuesto de infraestructura cercano a S/0. Alineado al ODS 3, meta 3.4.

Usuario principal: la cuidadora familiar (mujer de 35–55 años, NSE B–C, celular Android, usa WhatsApp y Facebook, sin formación en salud). Todo el diseño parte de ella: pantallas simples, texto claro, cero jerga técnica o clínica.

## Reglas de dominio que no se negocian

Ayni **no es un servicio de salud**. Facilita actividades de reminiscencia *informal*, como ver fotos en familia, pero estructuradas.

- Nunca generar texto que diagnostique, evalúe clínicamente o prometa resultados de salud. Prohibido en la UI, en los prompts al LLM y en los reportes: "diagnóstico", "tratamiento", "terapia", "mejora su memoria", "detecta demencia". Usar "actividad", "sesión", "registro de cómo le fue".
- Todo reporte de patrones lleva el texto: *"Esto no es un diagnóstico. Es un registro de actividades familiares."*
- El onboarding muestra: *"Ayni no es un servicio de salud. Si tu familiar tiene un diagnóstico de demencia, consulta con su médico antes de empezar."*
- Las sesiones solo usan contenido que la familia subió **y marcó como positivo**. Nunca se sugieren temas de duelo, pérdidas ni recuerdos marcados como sensibles.
- Alerta de pausa: si se acumulan respuestas negativas, la app sugiere pausar y consultar a un profesional. Valores por defecto: 3 sesiones seguidas con "agitado", o ≥50% de respuestas negativas en las últimas 5 sesiones. Son configurables y están **pendientes de validar con el asesor clínico**; no cambiarlos sin avisar.
- Para la alerta, una respuesta **negativa** es únicamente `agitado`. `Indiferente` no se interpreta por sí sola como malestar; `receptivo` y `emocionado` tampoco cuentan como negativas. Esta definición de producto es provisional y también está pendiente de validar con el asesor clínico.
- Fuera de alcance, aunque alguien lo pida: clonación de voz, video generado con IA, chat terapéutico, cualquier función pensada para demencia severa.

## Datos personales (Ley N.° 29733)

Se guardan datos de salud de adultos mayores, que son datos sensibles en Perú.

- Consentimiento explícito al registrarse, que informe que los datos se almacenan fuera del Perú (Supabase y Render, en Estados Unidos).
- Minimizar lo que se envía al LLM: solo el texto de la anécdota. Nunca correos, IDs, teléfonos ni datos de la cuenta.
- Las fotos se guardan en un bucket **privado** de Supabase Storage y se sirven con URLs firmadas de corta duración, nunca públicas. La `SUPABASE_SERVICE_ROLE_KEY` solo vive en el backend.
- Eliminar la cuenta borra de verdad el perfil, los recuerdos, las fotos y las respuestas (hard delete, sin soft delete).
- Nunca registrar en logs el contenido de anécdotas ni nombres.

## Arquitectura

**Monolito modular en capas.** No microservicios: es una decisión documentada. Somos 4 personas, la meta es ~100 familias pagando al año 3, y la prioridad es simplicidad y costo.

Capas: presentación (React) → servicios (API REST FastAPI) → negocio (módulos) → persistencia (repositorios SQLAlchemy) → datos (PostgreSQL + almacenamiento de archivos).

### Módulos de negocio (`backend/app/modules/`)

| Módulo | Responsabilidad |
|---|---|
| `families` | Usuarios, familias, roles (`cuidador_principal`, `familiar`), invitaciones |
| `memories` | Fotos, anécdotas y canciones; marca positivo/sensible |
| `nlp` | Extrae entidades de las anécdotas (personas, lugares, épocas, actividades) |
| `sessions` | Genera guías de sesión a partir del perfil de memoria |
| `responses` | Registra cómo reaccionó el adulto mayor después de cada sesión |
| `insights` | Patrones descriptivos y alertas de pausa |
| `recommender` | Ordena el contenido según las respuestas acumuladas |
| `billing` | Plan gratis / Plan Familia, con pagos **simulados** (Mercado Pago en modo de prueba) |

**Regla de límites:** un módulo solo importa la interfaz pública de otro (`modules/<x>/service.py`), nunca sus modelos, repositorios ni internals. Cada módulo tiene `router.py`, `schemas.py` (Pydantic), `service.py`, `repository.py` y `models.py`. Si necesitas cruzar esa regla, detente y pregunta.

### Prioridad del MVP

Imprescindible primero, en este orden: `families` → `memories` → `sessions` (con **reglas y plantillas, sin ML**) → `responses` → dashboard familiar → alertas de `insights`.

Después, como valor agregado: `nlp` con LLM, `recommender` con scikit-learn, gráficos de patrones, `billing` (simulado).

El generador de sesiones tiene que funcionar sin el recomendador y sin el LLM. Si el LLM falla o se agota el free tier, se usa spaCy (`es_core_news_sm`) como respaldo, y si eso también falla, la anécdota se guarda sin entidades. Nunca se bloquea al usuario.

## Stack

- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2.x, Alembic, Pydantic v2, auth con JWT
- **IA:** spaCy (español), API de LLM en free tier (Groq o Gemini) detrás de la interfaz `EntityExtractor`, scikit-learn, pandas
- **Frontend:** React + Vite + TypeScript, mobile-first, español (Perú)
- **Datos:** PostgreSQL en Supabase (un proyecto para stage y otro para producción; 16 en local y CI); fotos en Supabase Storage
- **Infra (todo en planes gratis):** Render (sitio estático para el frontend + servicio Docker para la API, configurados en `render.yaml`), Supabase (Postgres + Storage), GitHub Actions (CI/CD y tareas programadas, que reemplazan al cron). El pipeline despliega a stage en cada merge a `main` y a producción tras aprobación manual. La API gratis de Render se duerme tras 15 min sin uso (~1 min en despertar) y no tiene disco persistente: nada se guarda en el filesystem del contenedor
- **Pagos (simulados):** el proyecto no cobra de verdad. Se usa Mercado Pago en modo de prueba (credenciales `TEST-…` y tarjetas de prueba); Stripe en test mode es una alternativa aceptable. Nunca credenciales de producción ni cobros reales. Revisar la documentación actual antes de implementar.
- **Música:** solo enlaces embebidos de YouTube/Spotify. Nunca se alojan ni se descargan archivos de audio.

No agregar servicios pagados, colas de mensajes, Redis, Kubernetes ni otra base de datos sin preguntar primero.

## Estructura del repo

```
backend/
  app/
    main.py
    core/          # config, seguridad, db, logging
    modules/       # un paquete por módulo (ver tabla)
  migrations/      # Alembic
  tests/
frontend/
  src/
    pages/         # Perfil, SubirRecuerdos, GuiaSesion, RegistroRespuesta, Dashboard
    components/
    api/           # cliente tipado hacia el backend
docker-compose.yml # Postgres local
```

## Comandos

```bash
docker compose up -d db                           # Postgres local
cd backend && uv sync                             # dependencias
uv run alembic upgrade head                       # migraciones
uv run uvicorn app.main:app --reload              # API en :8000
uv run pytest                                     # tests
uv run ruff check . && uv run ruff format .       # lint + formato
cd frontend && npm install && npm run dev         # web en :5173
```

## Modelo de datos (núcleo)

`Family` 1–N `User` · `Family` 1–1 `ElderProfile` · `ElderProfile` 1–N `Memory` (tipo: `photo` | `anecdote` | `song`; flags `is_positive`, `is_sensitive`) · `Memory` 1–N `MemoryEntity` · `ElderProfile` 1–N `Session` 1–N `SessionItem` · `Session` 1–1 `SessionResponse` (`receptivo` | `emocionado` | `indiferente` | `agitado`) · `Family` 1–1 `Subscription`.

## Límites del plan gratis

10 fotos, 3 canciones, 1 guía de sesión por semana, 1 familiar contribuyendo. El Plan Familia (S/19.90/mes) quita los límites y permite hasta 5 familiares. Los límites se validan en `billing/service.py`, nunca en el frontend.

## Convenciones

- Código, nombres y commits en inglés. Todo el texto que ve el usuario va en español peruano, con tuteo cálido y sin tecnicismos.
- Type hints en todo el backend; los endpoints validan con Pydantic.
- Cada endpoint nuevo lleva al menos un test feliz y uno de error. Los módulos `sessions` e `insights` llevan tests de las reglas éticas (contenido sensible excluido, alerta disparada).
- Las migraciones siempre van con Alembic, nunca con `create_all` en producción.
- Los secretos (claves de LLM, de Supabase y de Mercado Pago, `DATABASE_URL`, `JWT_SECRET`) van solo en variables de entorno. Nunca en el código ni en el repo. Mantener `.env.example` actualizado.
- La UI se diseña para un celular de gama media: botones grandes, una acción principal por pantalla, una sesión completa en máximo 3 toques.

## Antes de terminar una tarea

1. Pasan `pytest` y `ruff`.
2. Ningún texto nuevo usa lenguaje clínico o de diagnóstico.
3. No se envía al LLM ni se registra en logs ningún dato personal.
4. Ningún módulo importa internals de otro.
