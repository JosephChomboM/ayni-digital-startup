# Reintento del análisis de anécdotas (AYNI-77)

`POST /memories/{id}/entities/retry` con Bearer acepta una anécdota en estado
`failed`. Solo puede solicitarlo su autor o la persona cuidadora principal de
la misma familia. No recibe texto, perfil ni autor desde el navegador.

Devuelve 202 con el recuerdo original en `pending`: confirma la solicitud, no
el resultado del análisis. Después del commit, BackgroundTasks ejecuta el NLP
con su cadena de respaldo existente. Consultar `GET /memories/{id}` para conocer
el resultado (`completed` o `failed`). No cambia título, texto ni marcas.

Errores: 401 sin sesión; 403 para familiares sin permiso de edición; 404 para
recuerdos inexistentes o de otra familia; 422 para canciones; 409 si el análisis
no está fallido, incluidos los reintentos mientras continúa pendiente.

El bloqueo de fila serializa las solicitudes. Cada reintento incrementa la
versión interna del procesamiento para rechazar resultados tardíos del intento
anterior, aunque el texto sea el mismo. Los resultados se guardan sin duplicados.
No se añaden logs de texto, entidades ni claves.

## Límites e integración web

Esta entrega es de backend y no añade un botón en la galería. El botón futuro
solo debe mostrarse al editor cuando `entities_status` sea `failed`, bloquearse
mientras se solicita y volver a consultar el recuerdo después. No presentar el
202 como análisis exitoso. Los PR de búsqueda y visualización son independientes.

BackgroundTasks no es una cola durable: un reinicio puede interrumpir el trabajo
y dejarlo en `pending`. Esta operación no recupera tareas pendientes ni garantiza
reintentos automáticos. No añade proveedores, dependencias ni infraestructura.

## Validación y reversión

Ejecutar `pytest tests/integration/test_memories_retry.py` con PostgreSQL local,
además de Ruff y la suite backend. Los tests HTTP usan NLP simulado para comprobar
éxito, fallo, permisos, estados y resultados obsoletos. No prueban al proveedor
externo ni un despliegue. QA independiente debe verificar el contrato en su entorno.

No hay migraciones. Para revertir: retirar la ruta y los métodos de reintento
con sus pruebas. Los recuerdos y resultados ya guardados se conservan.
