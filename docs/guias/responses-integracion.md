# Reacciones persistidas — AYNI-49

Contrato del backend para Damarys y Joseph. Requiere la migración de respuestas.
Autenticación: `Authorization: Bearer <access_token>` de Ayni.

| Método y ruta | Entrada | Resultado |
|---|---|---|
| `POST /sessions/{id}/response` | `{"reaction":"receptivo"}` | 201 al crear; 200 al repetir la misma reacción |
| `GET /sessions/{id}/response` | Sin cuerpo | 200 con la respuesta persistida |

Valores: `receptivo`, `emocionado`, `indiferente`, `agitado`. Ambos roles pueden
registrar o consultar dentro de su familia. No se aceptan identificadores de
familia/perfil ni notas adicionales en el cuerpo. La guía debe estar persistida.

Salida: `id`, `session_id`, `elder_profile_id`, `created_by` (puede ser null),
`reaction`, `occurred_at` (fecha de la sesión), `created_at` (fecha de registro).
Fechas ISO 8601 en UTC. Hay una sola respuesta por sesión; repetir el mismo
contenido no crea duplicados. Cambiar una respuesta existente devuelve 409.

Errores: `{"detail":{"code":"...","message":"..."}}`.

- 401 `unauthorized`: volver al login.
- 404 `elder_profile_not_found`: completar primero el perfil.
- 404 `session_not_found`: guía inexistente o de otra familia, misma respuesta.
- 404 `response_not_found`: la guía todavía no tiene reacción (solo GET).
- 409 `response_already_recorded`: ya se registró otra reacción (solo POST).
- 422 `validation_error`: entrada inválida.

## Interfaz de integración para Joseph

```python
from app.modules.responses.service import ResponsesService

records = ResponsesService(db).get_history(authenticated_user_id)
```

Autoriza mediante families.service; devuelve `ResponseHistoryRecord` con
`session_id`, `elder_profile_id`, `occurred_at`, `reaction`. Orden por fecha de
sesión ascendente y UUID de sesión en empates, aunque se registren fuera de orden.
Cada registro ya corresponde a una sesión distinta. El servicio administra sus
transacciones: llamarlo sin una transacción activa del módulo consumidor.

Joseph puede adaptar estos registros a `ReactionRecord` y llamar a sus funciones
de resumen y pausa. No se alteran los umbrales ni se interpretan registros locales
antiguos del navegador como sesiones verificadas. La integración del frontend y
la verificación en stage deben registrarse por separado antes del cierre de QA.
