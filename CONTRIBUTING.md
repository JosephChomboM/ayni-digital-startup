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
| `stage` | Render (`ayni-web-stage`, `ayni-api-stage`) + Supabase (proyecto stage) | Probar con el equipo antes de publicar |
| `production` | Render (`ayni-web-prod`, `ayni-api-prod`) + Supabase (proyecto producción) | La versión que se presenta |

## Hosting (todo gratis)

| Pieza | Servicio |
|---|---|
| Frontend | Render, sitio estático |
| API | Render, servicio Docker (se duerme tras 15 min sin uso; tarda ~1 min en despertar) |
| Base de datos y fotos | Supabase (un proyecto para stage y otro para producción) |
| Pagos | Simulados: Mercado Pago en modo de prueba |

Los 4 servicios de Render están definidos en `render.yaml`. La configuración paso a paso está en `docs/guias/gonzalo-devops-qa.md` (Parte 4).

## Correr en local

```bash
docker compose up -d db
cd backend && uv sync && uv run alembic upgrade head && uv run pytest
cd ../frontend && npm install && npm test && npm run dev
```
