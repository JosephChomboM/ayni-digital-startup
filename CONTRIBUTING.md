# Cómo trabajamos

## Equipo

| Rol | Persona | Prefijo de rama |
|---|---|---|
| Producto y Frontend | Damarys (@dahyesCM) | `damarys/` |
| Backend y Base de Datos | Hats (@Hats41) | `hats/` |
| IA y Datos | Joseph (@JosephChomboM) | `joseph/` |
| DevOps y QA | Gonzalo (@Gonzzzalo3) | `gonzalo/` |

## Ramas

- `main` está protegida: solo se cambia con un Pull Request aprobado por otra persona y con CI en verde.
- Para cada tarea, crea una rama con tu prefijo: `joseph/extractor-nlp`, `damarys/pantalla-perfil`…
- Cuando se mergea el PR, borras la rama y la siguiente tarea sale de `main` actualizado.

```bash
git switch main && git pull
git switch -c joseph/extractor-nlp
# ...trabajar y hacer commits...
git push -u origin joseph/extractor-nlp
# abrir el Pull Request en GitHub
```

## Pipeline (`.github/workflows/ci-cd.yml`)

1. **Build y tests**: backend (lint, tests unitarios, tests de integración con Postgres) y frontend (lint, tests, build).
2. **Seguridad**: busca claves subidas por error y librerías con vulnerabilidades conocidas.
3. **Deploy a stage**: automático al mergear a `main`.
4. **Deploy a producción**: el mismo código, después de que Gonzalo o Joseph lo aprueben en GitHub (Actions → la corrida → *Review deployments*).

## Ambientes

| Ambiente | Dónde | Para qué |
|---|---|---|
| `localhost` | Tu compu (`docker compose up -d db`) | Desarrollar y probar |
| `stage` | Railway (staging) | Probar con el equipo antes de publicar |
| `production` | Railway (production) | Lo que usan las familias |

## Configurar Railway (una vez)

1. Crear un proyecto con dos ambientes, `staging` y `production`, cada uno con un servicio `api`, un servicio `web` y una base Postgres.
2. En cada ambiente crear un *Project Token* y guardarlo en GitHub → Settings → Environments → `stage` / `production` → secret `RAILWAY_TOKEN`.
3. Variables en Railway: en `api` → `DATABASE_URL`, `JWT_SECRET`, `ENVIRONMENT`; en `web` → `VITE_API_URL`.
4. No conectar el repo para auto-deploy en Railway (el deploy lo hace GitHub).

## Correr en local

```bash
docker compose up -d db
cd backend && uv sync && uv run alembic upgrade head && uv run pytest
cd ../frontend && npm install && npm test && npm run dev
```
