# Guía de Joseph: IA y Datos (versión técnica)

**Tu área:** los módulos `nlp`, `insights` y `recommender` en `backend/app/modules/`. También eres admin del repo, aprobador de producción (junto con Gonzalo) y responsable de `CLAUDE.md`.

---

## Plan de ramas

| # | Rama | Alcance | Coordinas con | Depende de |
|---|---|---|---|---|
| 1 | `joseph/nlp-entity-extractor` | Interfaz `EntityExtractor` y dos implementaciones: `SpacyExtractor` (`es_core_news_sm`) y `NullExtractor`. La función `nlp.service.extract_entities(text)` **nunca lanza excepción** | **Hats**: `memories` la llama al guardar una anécdota y persiste las `MemoryEntity` | — Empieza ya |
| 2 | `joseph/nlp-llm` | `LlmExtractor` (Groq o Gemini, free tier) con cadena de respaldo: LLM → spaCy → sin entidades. Timeout corto y salida validada con Pydantic | **Gonzalo**: la clave va como variable del servicio API en Render | #1 |
| 3 | `joseph/insights-alerta-pausa` | Reglas de la alerta de pausa con umbrales configurables y el disclaimer en la respuesta | **Hats** (`responses.service`), **Damarys** (dashboard), **Gonzalo** (tests) | `hats/modulo-responses` |
| — | `joseph/recommender` | Ranking de contenido con scikit-learn según respuestas acumuladas. **Después del MVP** | **Hats**: `sessions` lo consume de forma opcional | #3 |
| — | `joseph/insights-patrones` | Patrones descriptivos para los gráficos. **Después del MVP** | **Damarys** | #3 |

### Contratos que debes publicar pronto

Hats necesita la firma de `nlp.service` para integrarla en `memories`. Publícala en el PR #1 aunque solo exista el `NullExtractor`:

```python
# backend/app/modules/nlp/service.py
class EntityKind(StrEnum):
    PERSON = "person"
    PLACE = "place"
    PERIOD = "period"
    ACTIVITY = "activity"

class Entity(BaseModel):
    kind: EntityKind
    text: str

def extract_entities(text: str) -> list[Entity]:
    """Never raises. LLM → spaCy → []"""
```

### Reglas que aplican a tu código (CLAUDE.md)

- **Minimización de datos:** al LLM se envía **solo el texto de la anécdota**. Nada de IDs, correos, nombres de cuenta ni metadatos. El prompt tampoco puede pedir diagnósticos ni evaluaciones clínicas.
- **Logs:** nunca registres el contenido de la anécdota, las entidades extraídas ni nombres. Registra solo métricas: proveedor usado, latencia y si hubo fallback.
- **Nunca bloquees al usuario:** si el LLM falla, se agota la cuota o hay timeout, pasa a spaCy; si spaCy falla, devuelve `[]`. Todo envuelto y con test.
- **Límites entre módulos:** `insights` lee respuestas solo con `responses.service`; `recommender` lee recuerdos solo con `memories.service`. Nunca importes `models` ni `repository` de otro módulo.
- **Alerta de pausa:** los valores por defecto son 3 sesiones seguidas con `agitado`, o ≥50 % de respuestas negativas en las últimas 5. Van en `Settings`, no hardcodeados, y **no se cambian sin avisar**: están pendientes de validar con el asesor clínico. Solo `agitado` cuenta como negativa; `indiferente` no indica por sí sola malestar. Esta definición provisional está documentada en CLAUDE.md y también requiere validación del asesor clínico.
- **Disclaimer:** todo reporte de patrones incluye *"Esto no es un diagnóstico. Es un registro de actividades familiares."*
- **Tests obligatorios:** alerta disparada y no disparada en los bordes (2 contra 3 seguidas, 49 % contra 50 %), y fallback del extractor. Mockea el LLM; los tests nunca llaman a la API real.

### spaCy en Docker

Agrega el modelo como dependencia en `pyproject.toml`, para que el `Dockerfile` lo instale sin un paso aparte:

```bash
cd backend
uv add spacy
uv add "es-core-news-sm @ https://github.com/explosion/spacy-models/releases/download/es_core_news_sm-<versión>/es_core_news_sm-<versión>-py3-none-any.whl"
```

Usa la versión del modelo compatible con tu spaCy. Carga el modelo una sola vez, de forma perezosa (`functools.lru_cache`), no en cada request: la instancia gratis de Render tiene 512 MB de RAM y se duerme tras 15 min, así que cada arranque en frío vuelve a cargar el modelo.

---

## Flujo de Git y PRs

### Crear la rama y el PR

```bash
git switch main && git pull
git switch -c joseph/nlp-entity-extractor
# ...commits...
git push -u origin HEAD
gh pr create --fill --draft --reviewer Hats41          # draft mientras trabajas
```

`--fill` toma el título y la descripción de tus commits. Con `--draft` el CI corre igual, pero nadie se siente obligado a revisar todavía.

### Agregar commits al mismo PR

El PR sigue a la rama, no a los commits. Cualquier push a `joseph/nlp-entity-extractor` actualiza el PR y vuelve a correr el CI:

```bash
git add -p                          # agrega por partes
git commit -m "feat: add spaCy extractor"
git push                            # ya tiene upstream, no hace falta -u
```

Para corregir el último commit (solo en **tu** rama, nunca en `main`):

```bash
git commit --amend --no-edit
git push --force-with-lease         # nunca --force a secas
```

### Ponerte al día con main

En tu propia rama, prefiere `rebase` para mantener el historial lineal:

```bash
git fetch origin
git rebase origin/main
# si hay conflictos: resolver → git add <archivo> → git rebase --continue
git push --force-with-lease
```

Si otra persona también está haciendo push a tu rama, usa `git merge origin/main` para no reescribirle el historial.

### Pasar el PR a revisión y mergear

```bash
gh pr ready                          # sale de draft
gh pr checks --watch                 # espera los 3 checks
gh pr merge --squash --delete-branch # cuando tengas 1 aprobación
git switch main && git pull && git branch -D joseph/nlp-entity-extractor
```

Algunas cosas a tener en cuenta:

- **No puedes aprobar tu propio PR.** Necesitas a Hats, Gonzalo o Damarys. Para pedírselo: `gh pr edit --add-reviewer Gonzzzalo3`.
- Con squash, **el título del PR se convierte en el commit de `main`**. Escríbelo en inglés y con formato convencional: `feat(nlp): add entity extractor with spaCy fallback`.
- Si el CI falla: `gh run view --log-failed`.

### Trabajo apilado (cuando la rama 2 depende de la 1 sin mergear)

```bash
git switch joseph/nlp-entity-extractor
git switch -c joseph/nlp-llm
gh pr create --fill --draft --base joseph/nlp-entity-extractor
```

Cuando la rama 1 se mergea con squash, mueve la rama 2 encima de `main`:

```bash
git fetch origin
git rebase --onto origin/main joseph/nlp-entity-extractor joseph/nlp-llm
git push --force-with-lease
gh pr edit --base main
```

---

## Ambientes y secretos

| Ambiente | Para qué | LLM |
|---|---|---|
| `localhost` | Desarrollo. `docker compose up -d db` + `uv run uvicorn app.main:app --reload` | `GROQ_API_KEY` o `GEMINI_API_KEY` en `backend/.env`. Si no la pones, el extractor cae a spaCy y todo sigue funcionando |
| `stage` | Se despliega solo al mergear a `main` (Render `ayni-api-stage` + Supabase stage) | Clave propia de stage, como variable de `ayni-api-stage` en Render |
| `production` | Se despliega tras tu aprobación o la de Gonzalo (Render `ayni-api-prod` + Supabase producción) | Clave **distinta** a la de stage, en `ayni-api-prod` |

Cada clave nueva se agrega vacía a `.env.example`. Nunca va en el código: el job **Seguridad** (gitleaks) bloquea el PR si encuentra una.

### Aprobar producción

En *Actions → CI/CD → la corrida → Review deployments → production → Approve and deploy*. Antes de aprobar, prueba en stage lo que cambió. Si tú hiciste el merge, debe aprobar Gonzalo, y al revés.

---

## Como admin del repo

- **Protección de `main`** (*Settings → Rules → main*): PR obligatorio, 1 aprobación, squash y 3 checks requeridos (`Backend (build y tests)`, `Frontend (build y tests)`, `Seguridad`). Si renombras un job en `ci-cd.yml`, actualiza también los checks requeridos; si no, ningún PR podrá mergearse.
- **Ambientes** (*Settings → Environments*): `production` exige aprobación de Gonzalo o tuya, solo desde `main`.
- No desactives la protección para "avanzar rápido". Si hay una emergencia en producción, usa el *Rollback* de Render y luego un PR con `git revert`.
- **CLAUDE.md** es la fuente de verdad del proyecto. Cualquier cambio de reglas (umbrales de la alerta, hosting, límites del plan) se hace por PR y con todo el equipo como revisor.
- **Infra:** `render.yaml` define los 4 servicios; los secretos viven en Render (variables de cada servicio) y en GitHub (deploy hooks por ambiente). Supabase pausa los proyectos gratis tras 1 semana sin actividad: si stage no responde, revisa el panel de Supabase.
