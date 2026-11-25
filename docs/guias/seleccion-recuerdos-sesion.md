# Selección de recuerdos para la charla

La guía conserva sus actividades de 15 minutos. La colección que Ayni puede
consultar se guarda aparte: elegir muchos recuerdos no crea un paso obligatorio
por cada uno. Solo admite recuerdos bonitos, sin temas delicados, disponibles y
del perfil de la familia autenticada, independientemente de quién los subió.

## API con Bearer

`POST /sessions/generate` conserva `{}` (selección automática de hasta tres) y
`{"memory_id":"UUID"}` (un recuerdo). También admite:

```json
{"selection_mode":"selected","memory_ids":["UUID-1","UUID-2"]}
```

```json
{"selection_mode":"all"}
```

`all` guarda los recuerdos disponibles en ese momento; los que se suban después
se incorporan al volver a guardar la selección. No se incluyen silenciosamente
recuerdos nuevos en una conversación guardada.

`PUT /sessions/{id}/memories` recibe los mismos cuerpos para cambiar la colección
sin generar otra guía ni consumir otra cuota. Ambos roles de la familia pueden
hacerlo. Los pasos y mensajes existentes se conservan; cambiar la colección no
borra lo que ya se conversó.

Crear, consultar y cambiar una guía devuelven además `selection_mode` y
`selected_memories`, con `source_memory_id`, `memory_id` y `memory_available`.
Una referencia eliminada o que ya no es elegible conserva la procedencia pero
devuelve `memory_id: null`. Las guías anteriores recuperan su colección desde sus
pasos, sin reescribir esos datos.

Errores con `{"detail":{"code":"…","message":"…"}}`:

- `validation_error` (422): selección vacía, repetida o parámetros incompatibles.
- `memory_selection_unavailable` (409): algún ID elegido no está disponible para
  esa familia; tampoco revela si pertenece a otra familia.
- `no_eligible_memories` (409): no hay recuerdos utilizables.
- `session_not_found` (404) y `unauthorized` (401): sesión ajena/inexistente o falta
  de autenticación.
- Las cuotas de creación y sus errores existentes siguen vigentes. Cambiar una
  colección no equivale a crear otra guía.

## Interfaz e IA

El selector conserva las opciones individual, automática y recomendada. Agrega
«Elegir varios recuerdos» y «Todos los recuerdos disponibles», con búsqueda y
contador. Busca en todas las páginas. Las fotos de una colección explícita solo
proceden de los recuerdos incluidos en ella y mantienen sus URLs firmadas.

«Cambiar recuerdos» pausa la charla. Guardar o cancelar respeta la pausa previa y
mantiene el historial visible. El recuerdo activo se elige entre los incluidos.

La IA sigue usando las herramientas existentes, con búsqueda local sobre toda la
colección autorizada en lugar de recortarla a los últimos veinte elementos. La
petición inicial contiene hasta seis fragmentos relevantes y de actividad; una
consulta de herramienta devuelve hasta tres fragmentos. No se envía toda la
biblioteca en cada turno ni identificadores de cuenta. Se conservan la redacción
de contactos y las reglas de no registrar textos. Si un recuerdo seleccionado se
elimina o pasa a delicado, se mantiene `conversation_context_changed` para impedir
consultarlo; se puede revisar la colección antes de continuar.

## Verificación y entrega

- Aplicar la migración aditiva `0b77cc7b39d3` antes de usar la API nueva. No requiere
  variables de entorno ni dependencias nuevas.
- Backend: `test_session_models.py`, `test_session_collections.py` y
  `test_session_agent.py`, además de la suite completa con PostgreSQL local.
- Frontend: `sessions.test.ts`, `MemoryChecklist.test.tsx` y
  `SessionGuide.test.tsx`, además de lint, suite completa y build.
- Los tests de IA simulan al proveedor. La calidad de la conversación real y los
  dispositivos se verifican en stage después del merge; no se cambia producción
  directamente.
