# Guía para Hats: cómo subir tu parte (Backend y Base de Datos)

Hola Hats. Esta guía te lleva desde cero hasta tener tu código en GitHub. Copia los comandos tal cual.

**Tu área:** la API en `backend/` y estos módulos: `families`, `memories`, `sessions`, `responses` y `billing`. También te tocan las migraciones de la base de datos.

---

## Tu plan: qué ramas crear, con quién y dónde

Eres quien más bloquea a los demás: casi todas las pantallas de Damarys y las alertas de Joseph dependen de tus módulos. Por eso, **antes de programar cada módulo, comparte en el grupo el "contrato"**: qué endpoints habrá, qué datos reciben y qué devuelven. Puede ser un mensaje o una foto de `/docs`. Así los demás avanzan sin esperarte.

Crea **una rama a la vez**, en este orden:

| # | Rama | Qué haces | Coordinas con | Te espera |
|---|---|---|---|---|
| 1 | `hats/modulo-families` | Usuarios, familias, roles (`cuidador_principal`, `familiar`), invitaciones, login con JWT y guardar el **consentimiento** del registro | **Damarys** (pantalla de registro), **Gonzalo** (tests) | Damarys y Gonzalo |
| 2 | `hats/modulo-memories` | Fotos (en un bucket privado de Supabase Storage, servidas con URL firmada; **nunca** en el disco del contenedor, porque Render lo borra al reiniciar), anécdotas, canciones (solo enlaces de YouTube/Spotify) y las marcas **positivo** y **sensible** | **Damarys** (subir recuerdos), **Joseph** (al guardar una anécdota se llama a `nlp.service`) | Damarys y Joseph |
| 3 | `hats/modulo-sessions` | Generar la guía de sesión **con reglas y plantillas, sin IA**. Solo usa recuerdos positivos y nunca sensibles | **Joseph** (más adelante su recomendador ordenará el contenido), **Gonzalo** (tests de reglas éticas), **Damarys** (pantalla de la guía) | Damarys |
| 4 | `hats/modulo-responses` | Registrar cómo reaccionó el adulto mayor después de cada sesión | **Damarys** (pantalla de respuesta), **Joseph** (sus alertas leen esto) | Joseph |
| 5 | `hats/eliminar-cuenta` | Borrar de verdad la cuenta: perfil, recuerdos, fotos y respuestas | **Gonzalo** (test de que no queda nada) | — |
| — | `hats/modulo-billing` | Plan gratis / Plan Familia con pagos **simulados** (Mercado Pago en modo de prueba, sin cobros reales). **Después del MVP** | **Joseph** | — |

Si una tarea te toma más de 3 días, divídela. Por ejemplo, `hats/families-modelos` (tablas y migración) y luego `hats/families-endpoints`.

### En qué ambiente pruebas

| Ambiente | Cuándo lo usas | Cómo |
|---|---|---|
| `localhost` | Mientras programas | Docker + `uv run uvicorn app.main:app --reload`, y pruebas en http://localhost:8000/docs |
| `stage` | Después de que tu PR se mergea | En la URL de stage (Gonzalo la comparte) + `/docs`. La primera vez puede tardar ~1 minuto en responder porque la API gratis estaba dormida. Revisa que la migración haya corrido bien |
| `production` | Nunca lo tocas directamente | Gonzalo o Joseph aprueban el paso desde stage |

**Nunca** te conectes a la base de datos de stage o de producción desde tu compu para "arreglar algo a mano". Todo cambio de tablas va por una migración en un PR.

---

## Parte 1: preparar tu compu (solo una vez)

### 1. Acepta la invitación al repositorio

Entra a GitHub con tu cuenta **Hats41**. Te llegó una invitación por correo, o la ves en https://github.com/JosephChomboM/ayni-digital-startup. Dale a **Accept invitation**.

Sin esto no puedes subir nada.

### 2. Instala los programas

| Programa | Para qué sirve | Dónde se descarga |
|---|---|---|
| **Git** | Guardar versiones y subirlas a GitHub | https://git-scm.com/downloads |
| **Docker Desktop** | Levantar PostgreSQL en tu compu | https://www.docker.com/products/docker-desktop |
| **uv** | Instalar Python 3.12 y las librerías | Mira los comandos de abajo |
| **VS Code** | Editar el código | https://code.visualstudio.com |

Para instalar **uv**:

```bash
# Mac / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh
```

```bash
# Windows (PowerShell)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

Cierra y vuelve a abrir la terminal. Después comprueba que todo quedó instalado:

```bash
git --version
docker --version
uv --version
```

No necesitas instalar Python aparte: uv descarga Python 3.12 solo.

### 3. Dile a Git quién eres

Usa **el mismo correo de tu cuenta de GitHub**:

```bash
git config --global user.name "Hats"
git config --global user.email "tu-correo-de-github@ejemplo.com"
```

### 4. Descarga el proyecto y levántalo

Antes de esto, abre Docker Desktop.

```bash
git clone https://github.com/JosephChomboM/ayni-digital-startup.git
cd ayni-digital-startup
docker compose up -d db          # levanta PostgreSQL 16 local
cp .env.example backend/.env     # tu configuración local (nunca se sube)
cd backend
uv sync                          # instala Python y las librerías
uv run alembic upgrade head      # crea las tablas
uv run uvicorn app.main:app --reload
```

Abre http://localhost:8000/docs y verás la API. Si entras a http://localhost:8000/health/db y ves `{"status":"ok"}`, la base de datos está conectada.

---

## Parte 2: tu flujo de trabajo (cada vez que hagas una tarea)

`main` es la versión oficial. **Nadie escribe directo en `main`.** Cada tarea se hace en una rama, pasa por revisión y recién ahí se une a `main`.

### Paso 1: actualiza tu copia y crea tu rama

```bash
git switch main
git pull
git switch -c hats/modulo-families
```

El nombre es **`hats/` + qué vas a hacer**. Algunos ejemplos:

- `hats/modulo-families`
- `hats/endpoint-subir-foto`
- `hats/arreglo-invitaciones`

Haz **una rama por tarea**. Mejor un PR pequeño cada pocos días que uno gigante al final.

### Paso 2: trabaja y haz commits

```bash
git add .
git commit -m "feat: add families module with invitations"
```

Los mensajes van **en inglés**, con prefijo `feat:` (algo nuevo), `fix:` (arreglo) o `test:` (solo tests).

### Paso 3: revisa antes de subir

Desde `backend/`, con Docker prendido:

```bash
uv run ruff format .        # ordena el código automáticamente
uv run ruff check .         # busca errores
uv run pytest               # corre todos los tests
```

Si todo pasa en tu compu, lo más probable es que también pase en GitHub.

### Paso 4: sube y abre el Pull Request

```bash
git push -u origin hats/modulo-families
```

1. En GitHub, dale a **"Compare & pull request"**.
2. Llena la plantilla y dale a **Create pull request**.
3. Espera los 3 checks en verde (**Backend**, **Frontend** y **Seguridad**) y la aprobación de un compañero.
4. Dale a **Squash and merge**. Tu código se publica solo en **stage**.

Si un check sale en rojo, entra a **Details** para ver el error. Arréglalo y haz `git add .`, `git commit` y `git push`; el PR se actualiza solo.

### Paso 5: limpia

```bash
git switch main
git pull
git branch -D hats/modulo-families
```

---

## Cómo crear un módulo

Cada módulo es una carpeta dentro de `backend/app/modules/` con estos archivos:

```
backend/app/modules/families/
  __init__.py
  models.py       → tablas (SQLAlchemy)
  schemas.py      → qué entra y sale de la API (Pydantic)
  repository.py   → consultas a la base de datos
  service.py      → lógica de negocio (lo ÚNICO que otros módulos pueden usar)
  router.py       → endpoints (FastAPI)
```

Después de crearlo:

1. **Registra el router** en `backend/app/main.py`:
   ```python
   from app.modules.families.router import router as families_router
   app.include_router(families_router)
   ```
2. **Importa los modelos** en `backend/migrations/env.py`, debajo de `from app.core.db import Base`, para que Alembic los vea:
   ```python
   from app.modules.families import models as _families_models  # noqa: F401
   ```

### Cambiar la base de datos (migraciones)

Cada vez que agregues o cambies una tabla:

```bash
uv run alembic revision --autogenerate -m "create families tables"
uv run alembic upgrade head
```

**Revisa el archivo que se creó** en `backend/migrations/versions/` antes de hacer commit, porque a veces Alembic no detecta todo. Ese archivo se sube junto con tu código. En stage y producción las migraciones corren solas cuando arranca la API en Render.

---

## Reglas de tu área (CLAUDE.md)

- **Un módulo solo puede usar el `service.py` de otro.** Nunca importes `models`, `repository` ni otros archivos internos de otro módulo. Si lo necesitas, pregunta primero.
- **Cada endpoint nuevo lleva al menos 2 tests:** uno que funciona y uno de error. Los unitarios van en `backend/tests/unit/` y los que usan la base de datos en `backend/tests/integration/`.
- `sessions` necesita tests de las reglas éticas: solo usa recuerdos marcados como **positivos** y **nunca** los marcados como **sensibles**.
- Los límites del plan gratis (10 fotos, 3 canciones, 1 guía por semana, 1 familiar) se validan en `billing/service.py`, nunca en el frontend.
- Usa **solo migraciones de Alembic**, nunca `create_all`.
- Eliminar la cuenta borra **de verdad** todo: perfil, recuerdos, fotos y respuestas. No se marca como "borrado".
- **Nunca** registres en logs el texto de las anécdotas ni nombres de personas.
- Las fotos se sirven con URLs firmadas o protegidas, nunca públicas.
- Las contraseñas y claves van en `backend/.env` (que no se sube) y en `.env.example` como ejemplo vacío. **Nunca** en el código.
- Los textos que ve el usuario van en español y sin palabras clínicas ("diagnóstico", "terapia", "tratamiento").

---

## Revisar el PR de otra persona

Todo PR necesita la aprobación de alguien que no sea su autor:

1. Entra al PR y abre la pestaña **Files changed**.
2. Si algo no se entiende, comenta en la línea.
3. Si está bien, dale a **Review changes → Approve → Submit review**.

---

## Problemas comunes

| Mensaje | Qué pasa | Qué hacer |
|---|---|---|
| `rejected ... main (protected branch)` | Intentaste subir directo a `main` | Crea una rama y sube esa |
| `connection refused ... 5432` | PostgreSQL no está corriendo | Abre Docker Desktop y corre `docker compose up -d db` |
| `role "ayni" does not exist` | Tienes otro PostgreSQL instalado ocupando el puerto 5432 | Apágalo, o pide ayuda a Gonzalo |
| Tests de integración "SKIPPED" | No había base de datos | Levanta Docker; en GitHub sí corren |
| `CONFLICT` al hacer merge | Otra persona cambió las mismas líneas | Resuélvelo en VS Code y luego `git add .` y `git commit`. Si es una migración, avisa al equipo |
| `Target database is not up to date` | Te faltan migraciones | `uv run alembic upgrade head` |

Nunca uses `git push --force`.
