# Guía para Gonzalo: cómo subir tu parte (DevOps y QA)

Hola Gonzalo. Esta guía tiene dos partes: cómo trabajar con Git como todos, y lo que te toca a ti como DevOps y QA (Render y Supabase, aprobar producción y cuidar los tests).

**Tu área:** `.github/` (el pipeline), los `Dockerfile`, `docker-compose.yml`, `render.yaml`, el hosting (Render + Supabase) y la calidad de los tests.

---

## Tu plan: qué ramas crear, con quién y dónde

Tu primera tarea no lleva rama, porque es configuración y no código. Después, tu trabajo va acompañando lo que entregan Hats y Joseph: cuando ellos terminan un módulo, tú aseguras que esté bien probado.

| # | Rama | Qué haces | Coordinas con | Espera a |
|---|---|---|---|---|
| 0 | *(sin rama)* | **Configurar Supabase y Render** y los deploy hooks (Parte 4). Luego compartir con el equipo las URLs de stage | **Joseph** (es admin del repo) | — Empieza ya |
| 1 | `gonzalo/datos-de-prueba` | Script que crea una familia de ejemplo con recuerdos positivos y sensibles, para que todos prueben en `localhost` sin cargar datos a mano. **Solo datos inventados**, nunca datos reales | **Hats** (usa sus tablas) | `hats/modulo-families` y `hats/modulo-memories` |
| 2 | `gonzalo/tests-reglas-sessions` | Tests de que una sesión **nunca** incluye recuerdos sensibles y **solo** incluye positivos | **Hats** | `hats/modulo-sessions` |
| 3 | `gonzalo/tests-alerta-pausa` | Tests de la alerta: 3 sesiones seguidas "agitado", o ≥50 % negativas en las últimas 5 | **Joseph** | `joseph/insights-alerta-pausa` |
| 4 | `gonzalo/tests-eliminar-cuenta` | Test de que al borrar la cuenta no queda nada: ni perfil, ni recuerdos, ni fotos, ni respuestas | **Hats** | `hats/eliminar-cuenta` |
| 5 | `gonzalo/cron-nocturno` | Tarea nocturna con un `schedule` de GitHub Actions, porque el plan gratis de Render no tiene cron (por ejemplo, recalcular patrones). **Después del MVP** | **Joseph** | — |

**Tareas de todos los días (sin rama):**
- revisar PRs, priorizando los de Hats, porque bloquean a los demás;
- probar en stage cada merge antes de aprobar producción;
- si el pipeline falla por algo que no es culpa del código, por ejemplo Render o Supabase caídos, avisar al equipo.

### Los ambientes son tu responsabilidad

| Ambiente | Qué cuidas |
|---|---|
| `localhost` | Que `docker compose up -d db` + los comandos de las guías funcionen en la compu de todos. Si alguien no puede levantar el proyecto, lo ayudas tú |
| `stage` | Que cada merge se despliegue solo. Que la base de stage tenga **solo datos de prueba**. Que el equipo tenga la URL |
| `production` | Aprobar cada deploy (tú o Joseph) **después de probar en stage**. Que sus claves sean distintas a las de stage |

---

## Parte 1: preparar tu compu (solo una vez)

Tú ya eres colaborador del repo (**Gonzzzalo3**), así que no tienes que aceptar ninguna invitación.

### 1. Instala los programas

| Programa | Para qué sirve | Dónde se descarga |
|---|---|---|
| **Git** | Guardar versiones y subirlas | https://git-scm.com/downloads |
| **Docker Desktop** | PostgreSQL local y probar imágenes | https://www.docker.com/products/docker-desktop |
| **uv** | Python 3.12 para el backend | `curl -LsSf https://astral.sh/uv/install.sh \| sh` (Mac/Linux) |
| **Node.js 24** | Frontend | https://nodejs.org |
| **VS Code** | Editar | https://code.visualstudio.com |

### 2. Configura Git y descarga el proyecto

Usa el mismo correo de tu cuenta de GitHub:

```bash
git config --global user.name "Gonzalo"
git config --global user.email "tu-correo-de-github@ejemplo.com"

git clone https://github.com/JosephChomboM/ayni-digital-startup.git
cd ayni-digital-startup
```

### 3. Prueba todo localmente (ambiente `localhost`)

```bash
docker compose up -d db
cp .env.example backend/.env
cd backend && uv sync && uv run alembic upgrade head && uv run pytest
cd ../frontend && npm install && npm test && npm run build
```

Si todo pasa, tu compu replica lo mismo que hace GitHub.

---

## Parte 2: tu flujo de trabajo con Git

Es igual para todo el equipo: **nunca se trabaja directo en `main`**.

```bash
git switch main
git pull
git switch -c gonzalo/tests-sessions        # gonzalo/ + qué vas a hacer
# ...editar...
git add .
git commit -m "test: add sessions ethical rules tests"   # en inglés
git push -u origin gonzalo/tests-sessions
```

Después:

1. En GitHub, dale a **Compare & pull request**, llena la plantilla y créalo.
2. Espera los 3 checks en verde y la aprobación de un compañero.
3. Dale a **Squash and merge**.
4. Limpia tu copia: `git switch main && git pull && git branch -D gonzalo/tests-sessions`.

Prefijos de commit: `ci:` para el pipeline, `test:` para tests, `fix:` para arreglos y `chore:` para mantenimiento.

---

## Parte 3: cómo funciona el pipeline

Todo está en un solo archivo: `.github/workflows/ci-cd.yml`.

```
Pull Request a main ──► Backend ─┐
                        Frontend ├─► (solo revisa)
                        Seguridad┘

Merge a main ─────────► Backend ─┐
                        Frontend ├─► Deploy a stage ─► [aprobación] ─► Deploy a producción
                        Seguridad┘
```

| Job | Qué revisa |
|---|---|
| **Backend (build y tests)** | Ruff (estilo y errores), tests unitarios, migraciones y tests de integración con un PostgreSQL temporal |
| **Frontend (build y tests)** | Lint, tests con Vitest y build |
| **Seguridad** | Gitleaks (claves subidas por error), pip-audit y npm audit (librerías vulnerables) |
| **Deploy a stage** | Le pide a Render que despliegue ese commit exacto en `ayni-api-stage` y `ayni-web-stage` |
| **Deploy a producción** | Lo mismo en `ayni-api-prod` y `ayni-web-prod`, **después de que alguien lo apruebe** |

`main` está protegida: para mergear hacen falta los 3 primeros checks en verde y 1 aprobación.

Los jobs de deploy quedan en verde apenas Render **acepta** el pedido; el build en sí lo ves en el panel de Render (pestaña *Events* del servicio). Por eso, antes de aprobar producción, revisa que stage ya tenga la versión nueva.

### Los 3 ambientes

| Ambiente en GitHub | Dónde corre | Cuándo |
|---|---|---|
| `localhost` | La compu de cada uno, y el job Backend en GitHub | Siempre |
| `stage` | Render (`ayni-api-stage`, `ayni-web-stage`) + Supabase (`ayni-stage`) | Automático en cada merge a `main` |
| `production` | Render (`ayni-api-prod`, `ayni-web-prod`) + Supabase (`ayni-prod`) | Cuando tú o Joseph lo aprueban |

---

## Parte 4: tu primera tarea, configurar el hosting (todo gratis)

| Pieza | Servicio |
|---|---|
| Base de datos y fotos | **Supabase**: un proyecto para stage y otro para producción |
| API (FastAPI con Docker) | **Render**: se duerme tras 15 min sin uso y tarda ~1 min en despertar |
| Frontend (React) | **Render**, sitio estático: no se duerme |
| Pagos | **Simulados**: Mercado Pago en modo de prueba, sin cobros reales |

Hasta que termines esta parte, el job **Deploy a stage** sale en rojo porque faltan los deploy hooks. Es normal.

### A. Supabase (base de datos y fotos)

1. Crea una cuenta en https://supabase.com y **dos proyectos**: `ayni-stage` y `ayni-prod`. Elige la región **East US (North Virginia)**, que queda cerca de Render. Guarda la contraseña de la base de cada proyecto en un lugar seguro, **nunca en el repo**.
2. En cada proyecto:
   - **Cadena de conexión:** botón **Connect** → **Session pooler** → copia la URI y reemplaza `[YOUR-PASSWORD]` por la contraseña. Esa es la `DATABASE_URL`. Usa el *Session pooler*, no la *Direct connection* (Render no se conecta por IPv6) ni el *Transaction pooler*.
   - **Bucket para fotos:** *Storage → New bucket* → nombre `fotos`, **sin** marcar *Public bucket*.
   - **Claves:** en *Project Settings → API*, copia la *Project URL* (`SUPABASE_URL`) y la clave **service_role** (`SUPABASE_SERVICE_ROLE_KEY`). Esa clave da acceso total, así que solo va en Render.
3. Supabase **pausa los proyectos gratis tras 1 semana sin actividad**. Si stage deja de responder, entra al proyecto y dale **Restore**.

### B. Render (API y web)

1. Crea una cuenta en https://render.com **entrando con GitHub** y dale acceso al repo `ayni-digital-startup`.
2. **New → Blueprint** → elige el repo. Render lee `render.yaml` y te muestra 4 servicios: `ayni-api-stage`, `ayni-web-stage`, `ayni-api-prod` y `ayni-web-prod`.
3. Llena los valores que te pide:
   - **APIs:** `DATABASE_URL`, `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. Usa los de `ayni-stage` en `ayni-api-stage` y los de `ayni-prod` en `ayni-api-prod`. `JWT_SECRET` se genera solo.
   - **Webs:** `VITE_API_URL` = `https://ayni-api-stage.onrender.com` o `https://ayni-api-prod.onrender.com`. Si Render le asigna otra URL a la API (la ves arriba en el servicio), corrige esta variable después.
4. Dale a **Apply**. Render crea los servicios y hace un primer deploy.
5. Para comprobarlo, abre `https://<url-de-ayni-api-stage>/health/db`. Debe responder `{"status":"ok"}`; la primera vez tarda ~1 minuto.

### C. Conectar GitHub con Render (deploy hooks)

1. En **cada uno de los 4 servicios** de Render: *Settings → Deploy Hook* → copia la URL. Es secreta: cualquiera que la tenga puede desplegar.
2. En GitHub: *Settings → Environments*:
   - `stage` → *Add environment secret*: `RENDER_DEPLOY_HOOK_API` (hook de `ayni-api-stage`) y `RENDER_DEPLOY_HOOK_WEB` (hook de `ayni-web-stage`).
   - `production` → los **mismos nombres**, con los hooks de `ayni-api-prod` y `ayni-web-prod`.
3. Para probar: *Actions → CI/CD → la última corrida en main → Re-run all jobs*.
4. Comparte con el equipo las URLs de `ayni-web-stage` y de `ayni-api-stage` (con `/docs` al final, para ver la API).

**Más adelante**, cuando se usen, se agregan como variables de los servicios de API en Render (*Environment*):
- las claves de LLM (`GROQ_API_KEY`);
- las credenciales **de prueba** de Mercado Pago (las que empiezan con `TEST-`, en *Tus integraciones → Credenciales de prueba*). **Nunca** credenciales de producción: los pagos de Ayni son simulados.

Nada de esto va en el código.

---

## Parte 5: aprobar un deploy a producción

Cuando alguien mergea a `main` y stage sale bien, GitHub te avisa por correo.

1. Entra a *Actions → CI/CD → la corrida*.
2. Arriba aparece **"Review deployments"**.
3. Revisa que stage funcione: abre la web de stage y prueba lo que cambió.
4. Marca `production` y dale a **Approve and deploy**.

Si tú hiciste el merge, **no puedes aprobar tu propio deploy**; en ese caso lo aprueba Joseph, y al revés. Así siempre hay dos personas mirando antes de llegar a producción.

### Si algo sale mal en producción

- **Rápido:** en Render, entra al servicio → *Events* → elige el deploy anterior → **Rollback**.
- **Ordenado:** crea una rama con `git revert <id-del-commit>`, abre un PR y vuelve a pasar por stage y luego producción.

---

## Parte 6: tu rol de QA

- **Revisa PRs:** todo PR necesita 1 aprobación. Abre *Files changed*, comenta lo que no esté claro y aprueba con *Review changes → Approve*.
- **Exige tests:** cada endpoint nuevo necesita un test que funcione y uno de error. Si un PR no los tiene, pídelos antes de aprobar.
- **Reglas éticas con test obligatorio (CLAUDE.md):**
  - `sessions`: nunca usa recuerdos marcados como sensibles y solo usa los marcados como positivos.
  - `insights`: la alerta de pausa se dispara con 3 sesiones seguidas "agitado", o con ≥50 % de respuestas negativas en las últimas 5.
- **Revisa los textos:** que la UI no diga "diagnóstico", "terapia", "tratamiento" ni "mejora su memoria".
- **Cuida los secretos:** si el job Seguridad avisa que se subió una clave, hay que **cambiar esa clave** en Supabase, Render o el servicio que la generó. Borrarla del código no basta, porque queda en el historial.

---

## Problemas comunes

| Mensaje | Qué pasa | Qué hacer |
|---|---|---|
| Deploy falla con `curl: (3)` | Falta el secret del deploy hook en ese ambiente | Revisa la Parte 4, sección C |
| Deploy falla con `401` o `404` | El hook está mal copiado o es de otro servicio | Cópialo otra vez desde Render |
| Deploy en verde pero no cambia nada | Render falló al construir | Mira *Events* y *Logs* del servicio en Render |
| La API tarda ~1 min en responder | Estaba dormida (plan gratis) | Normal. Ábrela un rato antes de una demo |
| Logs de la API: `Network is unreachable` o `could not translate host name` | Usaste la *Direct connection* de Supabase | Cambia `DATABASE_URL` por la del *Session pooler* |
| Stage no responde y Supabase dice *Paused* | Pasó 1 semana sin uso | En Supabase, dale **Restore** |
| Render avisa de horas gratis agotadas | Se usaron las 750 h del mes | Avisa al equipo; se reinicia el mes siguiente |
| `rejected ... main (protected branch)` | Intentaste subir directo a `main` | Usa una rama y un PR |
| El PR no deja mergear | Falta un check en verde o la aprobación | Revisa la sección *Checks* del PR |

Nunca uses `git push --force` en `main`.
