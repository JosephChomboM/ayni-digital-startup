# AYNI-66 — Persistencia, historial y exclusión de recuerdos

Validación local del 11 de noviembre de 2026. Rama: `gonzalo/ayni-66-guias-historial`, basada en el código de guías del PR #60 (`63a2bd1`).

## Trabajo realizado

Se añadieron cinco casos de integración en `backend/tests/integration/test_sessions_qa_regressions.py`:

- Un fallo después de insertar la guía y sus pasos revierte ambos registros en PostgreSQL. No consume el cupo y permite generar de nuevo.
- Si un recuerdo deja de ser positivo, el historial conserva instrucciones y duración, pero oculta el enlace utilizable.
- La misma comprobación cuando el recuerdo se marca como sensible.
- La misma comprobación cuando el recuerdo queda pendiente de borrado.
- Si el único recuerdo está pendiente de borrado, no se guarda una guía vacía ni se consume el cupo. Al recuperar su elegibilidad se puede generar.

Los tres casos de cambio de elegibilidad comprueban consultas desde cuidador y familiar, que añadir otro recuerdo no reescribe la guía anterior y que el cupo es compartido por familia. Las pruebas existentes cubren además aislamiento entre familias, autenticación, paginación y exclusión durante la generación.

## Reproducir

Con PostgreSQL local disponible, desde `backend` y esta rama:

```powershell
uv run --frozen pytest tests/integration/test_sessions_qa_regressions.py -q
uv run --frozen pytest -q
uv run --frozen ruff check .
uv run --frozen ruff format --check .
```

Resultado: **cinco pruebas nuevas aprobadas**; suite completa con ambas tareas: **549 aprobadas, ninguna omitida**. Después se reforzó la prueba de reversión para consultar también los identificadores de la guía y cada paso en la base de datos; los cinco casos y Ruff volvieron a aprobar.

## Dependencia y límite de la validación

Esta rama necesita el backend de AYNI-46/AYNI-48 incluido en el PR #60. Las pruebas no deben enviarse a `main` sin esa implementación. Al abrir el PR, usar temporalmente `hats/ayni-46-session-templates` como base, o esperar a que ese PR se integre en `main`.

La validación realizada cubre la API HTTP y PostgreSQL, con peticiones independientes para recuperar los datos persistidos. No acredita el recorrido desde la pantalla de guías ni el uso móvil: la interfaz todavía debe conectarse a estos endpoints. Por ese motivo no debe marcarse toda AYNI-66 como finalizada hasta verificar esa integración. No se modificó la lógica de producción.
