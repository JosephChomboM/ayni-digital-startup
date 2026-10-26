## Qué cambia

<!-- 1–3 líneas. Enlaza la tarea si existe. -->

## Cómo probarlo

<!-- Pasos para que quien revisa lo vea funcionar. -->

## Checklist (CLAUDE.md)

- [ ] Pasan `pytest` y `ruff` (y `npm test` si toqué el frontend)
- [ ] Endpoints nuevos tienen un test feliz y uno de error
- [ ] Ningún texto nuevo usa lenguaje clínico o de diagnóstico
- [ ] No se envía al LLM ni se registra en logs ningún dato personal
- [ ] Ningún módulo importa internals de otro (solo `service.py`)
- [ ] Si cambié el modelo de datos, hay migración de Alembic
- [ ] Si agregué una variable de entorno, actualicé `.env.example`
