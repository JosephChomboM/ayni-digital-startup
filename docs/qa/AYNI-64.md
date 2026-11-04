# AYNI-64 — Pruebas de anécdotas, canciones y permisos

**Revisión de QA:** 4 de noviembre de 2026.  
**Alcance:** cobertura versionada del backend y frontend. No se afirma una prueba manual en stage.

## Cobertura automatizada localizada

| Caso | Prueba o código relacionado | Comprobación |
|---|---|---|
| Crear anécdota/canción y leer tras crear | `backend/tests/integration/test_memories_endpoints.py::test_post_creates_anecdote_and_song_for_both_roles_and_schedules_extraction` | Persistencia, autor/perfil derivado, extracción y URL normalizada. |
| Rechazar enlace inválido | `test_post_rejects_invalid_song_url_with_uniform_error` y `backend/tests/unit/test_memories_schemas.py` | Respuesta `422` sin eco del enlace inválido. |
| Aislar familias | `test_get_list_excludes_another_family`, `test_get_memory_does_not_expose_another_familys_record` y `backend/tests/integration/test_family_isolation.py` | Otra familia no lista ni obtiene el recuerdo. |
| Permisos de edición y borrado | `test_patch_forbids_family_member_who_is_not_author`, `test_delete_forbids_family_member_who_is_not_author` | Rechaza cambios o borrado por una persona familiar que no es autora. |
| Privacidad sensible | `test_get_list_hides_sensitive_by_default_and_supports_filters` y nueva prueba `test_updating_memory_to_sensitive_hides_it_from_default_family_list` | Al marcar sensible, desaparece de la lista normal; se incluye solo con filtro explícito. |
| Interfaz | `frontend/src/api/UploadModule.test.tsx` | Comprueba creación/edición, espera de respuesta API y manejo de errores en el formulario. |

La prueba nueva de sensibilidad está en `backend/tests/integration/test_memories_endpoints.py`. Las suites cubren varias validaciones y permisos solicitados; todavía se debe adjuntar el resultado de ejecución de la rama/PR y completar el recorrido manual en stage si se exige evidencia desplegada.

## Recorrido manual pendiente de evidencia

Con dos cuentas sintéticas de la misma familia y una tercera de otra familia: crear una anécdota y una canción; recargar y verificar persistencia; probar texto vacío y enlace inválido; marcar una anécdota sensible y comprobar que no aparece en la lista general; verificar edición/borrado por autora y cuidadora principal; intentar la misma acción como otra persona y como otra familia. Registrar ambiente, commit, resultado esperado/obtenido y defectos. No usar recuerdos ni datos personales reales.

La pantalla de fotos está deshabilitada y no hay endpoint/backend de fotos implementado; por tanto, la tarea no debe reportarse como prueba de carga o privacidad de archivos.
