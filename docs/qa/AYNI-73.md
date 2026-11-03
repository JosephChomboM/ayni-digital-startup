# AYNI-73 — Modelo de datos y reglas de integridad

**Revisado por QA:** Gonzalo Cáceres, 2 de noviembre de 2026.  
**Ambiente:** PostgreSQL local, base de pruebas aislada `ayni_test`.

## Verificación

Desde `backend` se ejecutó:

```powershell
.venv\Scripts\python.exe -m pytest tests/integration/test_memories_models.py tests/integration/test_families_models.py
```

**Resultado:** 31 pruebas aprobadas y una advertencia deprecada de configuración de Alembic. Se comprobaron restricciones, persistencia, claves foráneas y cascadas de familias, perfiles, recuerdos y entidades. Se añadieron casos para intereses nulos y texto de entidad vacío, en blanco o mayor al máximo permitido.

Los datos se escribieron únicamente en `ayni_test`; no se usó la base de desarrollo.
