# Búsqueda de recuerdos (AYNI-69)

La galería permite buscar por título, texto de anécdota y entidades persistidas.
Se usa `GET /memories?q=Lima&limit=20&offset=0` con Bearer. No distingue
mayúsculas; sí distingue acentos. El texto se recorta y admite 1–100 caracteres.
Omitir `q` conserva el listado normal. `%` y `_` se buscan literalmente.

El servidor aplica la familia autenticada y los filtros de tipo y sensibilidad
antes de contar y paginar. Una coincidencia en varias entidades no duplica el
recuerdo. El buscador no envía texto al LLM. No debe registrarse el valor de `q`
en logs de aplicación, proxies o analítica: puede contener nombres familiares.

La web envía la búsqueda al pulsar Buscar, vuelve a la primera página y permite
limpiarla. Diferencia ausencia de coincidencias, carga y errores de API.

Verificación: `pytest tests/integration/test_memories_search.py` con PostgreSQL
local y `npm test -- src/api/UploadModule.test.tsx`. Los datos son sintéticos;
los tests de interfaz simulan HTTP y no prueban un despliegue.
Reversión: retirar `q` del esquema, servicio y filtros, y el formulario de la
galería con sus pruebas. No hay migraciones ni cambios a datos existentes.
