# AYNI-46 y AYNI-48 — Guías familiares persistentes

Estado: backend implementado en la rama local `hats/ayni-46-session-templates`.
Pendiente de revisión, integración y despliegue. La pantalla SessionGuide de Damarys no se modifica.
Esta entrega no implementa respuestas, finalización de actividades ni su dashboard.

## Contrato HTTP para integrar con frontend

Sin prefijo /api. Los tres endpoints requieren `Authorization: Bearer <JWT de Ayni>`.
Cuidador principal y familiar pueden generar y consultar guías de su propia familia.
El servidor obtiene usuario y perfil del token; nunca recibe IDs de familia o autor.

| Método y ruta | Entrada | Salida | Errores principales |
|---|---|---|---|
| POST /sessions/generate | Sin cuerpo o JSON {} | 201, SessionDetail guardado | unauthorized, elder_profile_not_found, no_eligible_memories, session_limit_reached, validation_error |
| GET /sessions | limit: 1–100 (20 por defecto), offset >= 0 | 200, items/total/limit/offset | unauthorized, elder_profile_not_found, validation_error |
| GET /sessions/{id} | UUID de sesión | 200, SessionDetail original | unauthorized, elder_profile_not_found, session_not_found, validation_error |

Formato de todos los errores: `{"detail":{"code":"...","message":"..."}}`.
HTTP: unauthorized=401; elder_profile_not_found y session_not_found=404;
no_eligible_memories y session_limit_reached=409; validation_error=422.
Una sesión ajena y una inexistente devuelven exactamente el mismo error 404.

SessionSummary contiene id, elder_profile_id, created_by (puede ser null), created_at
(UTC), template_version y duration_minutes. GET /sessions devuelve resúmenes, ordenados
por fecha descendente y UUID para mantener un orden estable.

SessionDetail añade steps, ordenados por position. Cada paso contiene:

```json
{
  "position": 2,
  "duration_minutes": 10,
  "instruction": "Lean la anécdota juntos...",
  "source_memory_id": "UUID original o null",
  "memory_id": "UUID actualmente disponible o null",
  "memory_available": true
}
```

Los valores de UUID anteriores son descriptivos, no una respuesta literal.
source_memory_id conserva la procedencia; no se usa para saltarse memory_available.
Para abrir contenido actual, frontend usa memory_id solo si memory_available=true
y consulta las APIs de memories/fotos con el JWT. No se almacenan URLs firmadas en la guía.
Un paso de bienvenida/cierre no tiene recuerdo y devuelve ambos IDs en null.

## Generación y límites

La guía usa plantillas fijas y dura 15 minutos: 2 de bienvenida, 10 distribuidos entre
hasta tres recuerdos únicos y 3 de cierre. El orden de selección es estable por UUID;
es un criterio provisional sin puntuación de relevancia, recomendador ni llamadas a IA.
Solo se seleccionan recuerdos del perfil autenticado, positivos, no sensibles y sin
borrado pendiente. No se copian títulos ni textos ni se inventa contenido.

La cuota gratuita es una guía por familia en una ventana móvil de siete días (UTC),
compartida por todos los integrantes. El Plan Familia vigente no tiene ese límite.
La decisión de cuota pertenece a billing.service. Cancelar conserva la capacidad
pagada solo hasta que termine el periodo vigente. Sin recuerdos permitidos no se
crea una sesión vacía ni se consume cuota. Consultar historial/detalle no consume cuota.

Sesiones bloquea la generación por perfil y consulta la cuota dentro de la transacción;
memories.service selecciona y bloquea sus filas hasta guardar la guía. No se aceptan
recuerdos, flags, perfil ni autor enviados por el navegador.

## Historial y borrado

FamilySession guarda perfil, autor, fecha, duración y versión. SessionItem conserva
orden, minutos e instrucciones originales. Los pasos no se regeneran al consultarlos.
Si un recuerdo se elimina, su vínculo vivo queda en null y se conserva solo el ID
de procedencia. Si cambia a sensible/no positivo/borrado pendiente, memory_available
pasa a false y no se entrega un memory_id utilizable para ese paso.

Al borrar el perfil se borran físicamente sesiones y pasos. Eliminar solo al autor
deja created_by en null para conservar el historial compartido; el flujo completo
de eliminación de cuenta pertenece a AYNI-52 y sigue pendiente.

## Arquitectura y migraciones

sessions solo usa las interfaces públicas families.service, memories.service y
billing.service; nunca sus modelos ni repositorios. SessionsRepository es interno.
No hay dependencias nuevas ni cambios de secretos o de config.py.

Revisiones: 0f40e3d7e94d crea sesiones/pasos; ca074ba1656f une esa revisión con
fab6d11fe74d (borrado pendiente de fotos). El resultado tiene una sola cabeza.
Ejecutar `alembic upgrade head` al desplegar. Ninguna tabla usa create_all.

## Integración y QA pendientes

El backend está implementado y probado; la historia no se marca como terminada en Jira
por tener código local. Faltan revisión del equipo, integración y validación en stage.
Damarys conecta su pantalla existente: genera solo tras una acción explícita, conserva
el id devuelto y recupera detalle/historial desde GET. No genera automáticamente al abrir
o recargar la pantalla. Debe mostrar carga, vacío y errores como estados distintos,
leer detail.message/detail.code y cerrar sesión ante 401 como hace el cliente existente.
La pantalla actual sigue siendo la experiencia anterior hasta que se conecte.
