# AYNI-99 — Fotos privadas: permisos y recuperación ante fallos

Validación local del 11 de noviembre de 2026. Rama: `gonzalo/ayni-99-fotos-privadas`, basada en `origin/main` (`f872a23`).

## Trabajo realizado

Se añadieron seis casos de integración en `backend/tests/integration/test_photo_qa_regressions.py`:

- Fallo de subida después de escribir el objeto: se elimina el archivo y se revierte el registro; el reintento funciona.
- Fallo al firmar la URL: tampoco quedan archivos ni registros; el reintento funciona.
- Fallo de borrado: se conserva el archivo y el registro hasta que un reintento los elimina.
- Intento de borrar una foto usando otro recuerdo de la misma familia: devuelve 404 y conserva la foto original.
- Subida y borrado sin autenticación: devuelve 401 sin alterar Storage.
- Subida y borrado con token inválido: mismo resultado, sin efectos secundarios.

Estas pruebas complementan las existentes de formato, tamaño, privacidad del bucket, enlaces firmados, permisos entre familias y cupo. No se encontraron fallos que exigieran cambiar el código de producción.

## Reproducir

Con Docker Desktop activo, desde la raíz:

```powershell
docker compose up -d db
```

Desde `backend`:

```powershell
uv run --frozen pytest tests/integration/test_memory_photo_endpoints.py tests/integration/test_memory_photo_models.py tests/integration/test_billing_photo_quota.py tests/integration/test_photo_qa_regressions.py tests/unit/test_photo_images.py tests/unit/test_photo_storage.py -q
```

Resultado: **30 pruebas aprobadas, ninguna omitida**. Las seis nuevas también aprobaron junto al backend del PR #60 en la suite de 549 pruebas. Ruff aprobó revisión y formato.

## Alcance

PostgreSQL real de pruebas local; Storage simulado para provocar errores de forma controlada. No se usaron credenciales privadas ni se subieron archivos a Supabase. La conexión real con Storage, la cuenta de pruebas y la interfaz corresponde a AYNI-68; esta evidencia no sustituye esa prueba.
