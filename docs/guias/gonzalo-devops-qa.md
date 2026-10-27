# Guía para Gonzalo: cómo subir tu parte (DevOps y QA)

Hola Gonzalo. Esta guía tiene dos partes: cómo trabajar con Git como todos, y lo que te toca a ti como DevOps y QA (Railway, aprobar producción y cuidar los tests).

**Tu área:** `.github/` (el pipeline), los `Dockerfile`, `docker-compose.yml`, Railway y la calidad de los tests.

---

## Tu plan: qué ramas crear, con quién y dónde

Tu primera tarea no lleva rama, porque es configuración y no código. Después, tu trabajo va acompañando lo que entregan Hats y Joseph: cuando ellos terminan un módulo, tú aseguras que esté bien probado.

| # | Rama | Qué haces | Coordinas con | Espera a |
|---|---|---|---|---|
| 0 | *(sin rama)* | **Configurar Railway** y los `RAILWAY_TOKEN` (Parte 4). Luego compartir con el equipo las URLs de stage | **Joseph** (es admin del repo) | — Empieza ya |
| 1 | `gonzalo/datos-de-prueba` | Script que crea una familia de ejemplo con recuerdos positivos y sensibles, para que todos prueben en `localhost` sin cargar datos a mano. **Solo datos inventados**, nunca datos reales | **Hats** (usa sus tablas) | `hats/modulo-families` y `hats/modulo-memories` |
| 2 | `gonzalo/tests-reglas-sessions` | Tests de que una sesión **nunca** incluye recuerdos sensibles y **solo** incluye positivos | **Hats** | `hats/modulo-sessions` |
| 3 | `gonzalo/tests-alerta-pausa` | Tests de la alerta: 3 sesiones seguidas "agitado", o ≥50 % negativas en las últimas 5 | **Joseph** | `joseph/insights-alerta-pausa` |
| 4 | `gonzalo/tests-eliminar-cuenta` | Test de que al borrar la cuenta no queda nada: ni perfil, ni recuerdos, ni fotos, ni respuestas | **Hats** | `hats/eliminar-cuenta` |
| 5 | `gonzalo/cron-nocturno` | Tarea nocturna en Railway (por ejemplo, recalcular patrones). **Después del MVP** | **Joseph** | — |

**Tareas de todos los días (sin rama):**
- revisar PRs, priorizando los de Hats, porque bloquean a los demás;
- probar en stage cada merge antes de aprobar producción;
- si el pipeline falla por algo que no es culpa del código, por ejemplo Railway caído, avisar al equipo.

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
| **Deploy a stage** | Sube la API y la web al ambiente `staging` de Railway |
| **Deploy a producción** | Lo mismo en `production`, **después de que alguien lo apruebe** |

`main` está protegida: para mergear hacen falta los 3 primeros checks en verde y 1 aprobación.

### Los 3 ambientes

| Ambiente en GitHub | Dónde corre | Cuándo |
|---|---|---|
| `localhost` | La compu de cada uno, y el job Backend en GitHub | Siempre |
| `stage` | Railway, ambiente `staging` | Automático en cada merge a `main` |
| `production` | Railway, ambiente `production` | Cuando tú o Joseph lo aprueban |

---

## Parte 4: tu primera tarea, configurar Railway

Hasta que hagas esto, el job **Deploy a stage** va a salir en rojo con `Invalid RAILWAY_TOKEN`. Es normal mientras falte el token.

1. **Crea el proyecto** en https://railway.com y agrega dos ambientes: `staging` y `production`.
2. **En cada ambiente crea:**
   - una base **PostgreSQL**;
   - un servicio vacío llamado exactamente **`api`**;
   - un servicio vacío llamado exactamente **`web`**.

   **No** conectes el repo de GitHub a los servicios. El deploy lo hace GitHub; si lo conectas, se despliega dos veces y sin pasar los tests.
3. **Variables en Railway** (pestaña *Variables* de cada servicio):
   - En `api`:
     - `DATABASE_URL` → usa *Add Reference* y elige la de Postgres;
     - `ENVIRONMENT` → `stage` o `production`;
     - `JWT_SECRET` → un texto largo al azar, que puedes generar con `openssl rand -hex 32`.
   - En `web`:
     - `VITE_API_URL` → la URL pública del servicio `api`.
   - En ambos servicios, en *Settings → Networking*, genera un dominio público.
4. **Crea un token por ambiente:** en *Project Settings → Tokens*, crea un *Project Token* para `staging` y otro para `production`.
5. **Guarda los tokens en GitHub:** en el repo, ve a *Settings → Environments*:
   - `stage` → *Add environment secret* → nombre `RAILWAY_TOKEN`, valor el token de staging;
   - `production` → igual, con el token de production.
6. **Prueba:** en GitHub, ve a *Actions → CI/CD → la última corrida en main → Re-run all jobs*.

Las claves de LLM y de Mercado Pago se agregan después como variables del servicio `api`, cuando se usen. **Nunca** en el código.

---

## Parte 5: aprobar un deploy a producción

Cuando alguien mergea a `main` y stage sale bien, GitHub te avisa por correo.

1. Entra a *Actions → CI/CD → la corrida*.
2. Arriba aparece **"Review deployments"**.
3. Revisa que stage funcione: abre la web de stage y prueba lo que cambió.
4. Marca `production` y dale a **Approve and deploy**.

Si tú hiciste el merge, **no puedes aprobar tu propio deploy**; en ese caso lo aprueba Joseph, y al revés. Así siempre hay dos personas mirando antes de llegar a producción.

### Si algo sale mal en producción

- **Rápido:** en Railway, ve al servicio, entra a *Deployments*, elige el deploy anterior y usa **Rollback**.
- **Ordenado:** crea una rama con `git revert <id-del-commit>`, abre un PR y vuelve a pasar por stage y luego producción.

---

## Parte 6: tu rol de QA

- **Revisa PRs:** todo PR necesita 1 aprobación. Abre *Files changed*, comenta lo que no esté claro y aprueba con *Review changes → Approve*.
- **Exige tests:** cada endpoint nuevo necesita un test que funcione y uno de error. Si un PR no los tiene, pídelos antes de aprobar.
- **Reglas éticas con test obligatorio (CLAUDE.md):**
  - `sessions`: nunca usa recuerdos marcados como sensibles y solo usa los marcados como positivos.
  - `insights`: la alerta de pausa se dispara con 3 sesiones seguidas "agitado", o con ≥50 % de respuestas negativas en las últimas 5.
- **Revisa los textos:** que la UI no diga "diagnóstico", "terapia", "tratamiento" ni "mejora su memoria".
- **Cuida los secretos:** si el job Seguridad avisa que se subió una clave, hay que **cambiar esa clave** en Railway o en el servicio que la generó. Borrarla del código no basta, porque queda en el historial.

---

## Problemas comunes

| Mensaje | Qué pasa | Qué hacer |
|---|---|---|
| `Invalid RAILWAY_TOKEN` | Falta el token o está mal | Revisa la Parte 4, paso 5 |
| `Service not found` | El servicio no se llama `api` o `web` | Renómbralo en Railway |
| Deploy en verde pero la web no abre | El healthcheck de Railway falló | Revisa los logs del servicio en Railway |
| `rejected ... main (protected branch)` | Intentaste subir directo a `main` | Usa una rama y un PR |
| El PR no deja mergear | Falta un check en verde o la aprobación | Revisa la sección *Checks* del PR |

Nunca uses `git push --force` en `main`.
