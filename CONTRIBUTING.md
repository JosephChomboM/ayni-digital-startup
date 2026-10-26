# Cómo trabajamos en Ayni Digital

## Equipo y áreas

| Rol | Persona | Rama (prefijo) | Es dueña/o de |
|---|---|---|---|
| Líder de Producto y Frontend (UI/UX) | Damarys (@dahyesCM) | `damarys/…` | `frontend/`, textos de la UI |
| Backend y Base de Datos | Hats (@Hats41) | `hats/…` | `families`, `memories`, `sessions`, `responses`, `billing`, migraciones |
| IA y Datos | Joseph (@JosephChomboM) | `joseph/…` | `nlp`, `recommender`, `insights` |
| DevOps y QA | Gonzalo (@Gonzzzalo3) | `gonzalo/…` | `.github/`, Docker, Railway, estrategia de tests |

`.github/CODEOWNERS` pide la revisión al dueño del área automáticamente.

## Ramas

```
damarys/feat-subir-recuerdos ─┐
hats/feat-families-api ───────┤
joseph/feat-nlp-extractor ────┼──► PR ──► main ──► stage ──(aprobación)──► production
gonzalo/ci-smoke-tests ───────┘
```

- **`main`** está protegida: solo entra código por Pull Request con CI en verde y 1 aprobación. Todo lo que está en `main` se despliega.
- **Cada persona trabaja en ramas cortas con su prefijo**: `<nombre>/<tipo>-<descripcion>`, por ejemplo `joseph/feat-nlp-extractor` o `hats/fix-invitaciones`. Tipos: `feat`, `fix`, `refactor`, `test`, `docs`, `ci`, `chore`.
- Una rama = una tarea. Vive días, no semanas. Al mergear se borra y la siguiente tarea sale de un `main` actualizado.

> ¿Por qué no una rama fija por persona (`damarys`, `hats`…)? Porque se aleja de `main` cada día, los conflictos aparecen todos juntos al final y nadie prueba su código con el de los demás hasta tarde. Con el prefijo igual se ve de quién es cada rama, pero el código se integra seguido.

### Flujo diario

```bash
git switch main && git pull
git switch -c joseph/feat-nlp-extractor
# ...trabajar, commits en inglés (feat: add spaCy fallback extractor)
git push -u origin joseph/feat-nlp-extractor
gh pr create --fill          # o desde GitHub; usa --draft si aún no está listo
```

Mientras el PR esté abierto, cada push vuelve a correr CI. Se mergea con **squash** cuando CI está en verde y alguien aprobó.

## Ambientes

| Ambiente GitHub | Dónde corre | Cuándo se usa |
|---|---|---|
| `localhost` | Tu máquina (`docker compose up -d db`) y CI (Postgres temporal) | Desarrollo y tests de integración en cada PR |
| `stage` | Railway, ambiente `staging` | Automático en cada merge a `main` |
| `production` | Railway, ambiente `production` | El mismo commit de stage, **después de que alguien lo apruebe** en GitHub |

## Pipeline

**CI** (`.github/workflows/ci.yml`, en cada PR y antes de cada deploy):

| Etapa | Jobs |
|---|---|
| Build | build de frontend (Vite), build de imágenes Docker de backend y frontend |
| Test unitario | `pytest tests/unit` con cobertura, `vitest` |
| Test de integración | Postgres 16 real, migraciones arriba/abajo/arriba, `pytest -m integration` |
| Calidad | `ruff check`, `ruff format --check`, `oxlint`, `tsc`, límites entre módulos |
| Seguridad | gitleaks (secretos), pip-audit y npm audit (dependencias), dependency review, Grype (imagen), reglas de seguridad de ruff (bandit), CodeQL (`codeql.yml`), chequeo de lenguaje clínico en la UI |

El job **CI OK** resume todo y es el check obligatorio para mergear.

**CD** (`.github/workflows/cd.yml`, en cada push a `main`):

1. Corre CI completo otra vez sobre el commit mergeado.
2. Despliega a **stage**: API (las migraciones de Alembic corren antes de arrancar), luego web. Smoke test confirma que responde la versión nueva (`/health` devuelve el SHA) y que la base de datos contesta.
3. Espera **aprobación** en el ambiente `production` de Gonzalo o Joseph (quien hizo el merge no puede aprobar su propio deploy; botón *Review deployments*).
4. Despliega el mismo commit a **production** con los mismos smoke tests.

Si un smoke test falla, el pipeline se detiene y producción no se toca. Railway mantiene la versión anterior si el healthcheck de la nueva falla.

**Revertir:** abrir un PR con `git revert <sha>` (vuelve a pasar por stage → production), o en una emergencia hacer *Rollback* en el dashboard de Railway.

## Configuración inicial (una sola vez, Gonzalo)

1. **Colaboradores:** los 4 deben aceptar la invitación al repo (CODEOWNERS ya tiene sus usuarios).
2. **Railway:** un proyecto con dos ambientes (`staging`, `production`), cada uno con los servicios `api`, `web` y Postgres. **No** conectar el repo de GitHub para auto-deploy en Railway: el deploy lo hace el pipeline (si no, se despliega dos veces y sin pasar por CI). Crear un *project token* por ambiente.
   - Variables del servicio `api`: `ENVIRONMENT`, `DATABASE_URL` (referencia a Postgres), `JWT_SECRET`, claves de LLM y Mercado Pago.
   - Variable del servicio `web`: `VITE_API_URL`.
3. **GitHub (ya hecho):** `PROD_REVIEWERS="Gonzzzalo3 JosephChomboM" scripts/setup_github.sh` para crear los ambientes `localhost`, `stage` y `production` (con aprobación, solo desde `main`) y proteger `main`.
4. En **Settings → Environments → stage / production** cargar:
   - Secret: `RAILWAY_TOKEN`
   - Variables: `RAILWAY_ENVIRONMENT`, `RAILWAY_API_SERVICE`, `RAILWAY_WEB_SERVICE`, `API_URL`, `WEB_URL`

## Correr todo localmente

```bash
docker compose up -d db
cp .env.example backend/.env
cd backend && uv sync && uv run alembic upgrade head
uv run pytest                                   # unitarios + integración
uv run ruff check . && uv run ruff format .
python3 ../scripts/check_module_boundaries.py
cd ../frontend && npm install && npm test && npm run build
python3 ../scripts/check_clinical_language.py
```
