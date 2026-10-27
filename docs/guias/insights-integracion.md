# Alerta de pausa: contrato para la integración

La rama `joseph/insights-alerta-pausa` implementa las reglas y pruebas de Joseph.
Todavía no consulta la base de datos ni publica un endpoint. La conexión queda
pendiente de `responses.service`, la autorización de familias y el dashboard.

## Función pública

```python
from app.modules.insights.service import evaluate_pause_alert

# Ejemplo con datos inventados. Por defecto, solo "agitado" cuenta como negativa.
alert = evaluate_pause_alert(
    ["receptivo", "agitado", "receptivo", "agitado", "agitado"],
)
payload = alert.model_dump(mode="json")
```

- El historial corresponde a **un solo adulto mayor**, de más antiguo a más reciente.
- Cada elemento representa una sesión completada con una respuesta válida.
- Valores aceptados: `receptivo`, `emocionado`, `indiferente`, `agitado`.
- Solo `agitado` cuenta como negativa por defecto. `Indiferente` no implica por
  sí sola malestar. Es una definición provisional de producto autorizada por Joseph,
  pendiente de validar con el asesor clínico; los umbrales originales se conservan.
- `negative_reactions` permite una clasificación alternativa para pruebas o futuros
  acuerdos del equipo. No puede estar vacío y admite `agitado` y/o `indiferente`.
  La integración debe usar el valor por defecto, sin exponer esta opción en la UI.
- Los datos inválidos producen `ValidationError`; no se omiten silenciosamente.

## Reglas y configuración

| Variable | Valor por defecto | Regla |
|---|---|---|
| `PAUSE_AGITATED_STREAK` | `3` | Racha de `agitado` al final del historial |
| `PAUSE_NEGATIVE_WINDOW` | `5` | Últimas sesiones para calcular la proporción |
| `PAUSE_NEGATIVE_RATIO` | `0.5` | Proporción mínima de respuestas negativas, inclusive |

Los valores están en `Settings`, pendientes de validar con el asesor clínico.
No cambiarlos sin avisar al equipo. La racha se evalúa incluso con menos de cinco
sesiones. La proporción espera una ventana completa; con menos de cinco no se
dispara esa regla. Esta interpretación debe revisarse con el equipo antes de integrar.
Con cinco sesiones, dos negativas son 40 % y tres son 60 %. Las pruebas de 49 %
y 50 % utilizan una ventana configurable de cien para comprobar el límite exacto.

La respuesta incluye `should_pause`, `reasons` (`agitated_streak`, `negative_ratio`),
`consecutive_agitated`, `window_size`, `window_complete`, `negative_count`,
`message` (solo cuando se sugiere pausar) y siempre `disclaimer`:
"Esto no es un diagnóstico. Es un registro de actividades familiares."

## Qué conectar después

1. **Hats/Joseph:** acordar el contrato real de `responses.service`. Debe entregar
   respuestas ordenadas por la sesión, con un orden estable en caso de empate,
   limitadas al adulto mayor de la familia autorizada. Solo importar esa interfaz
   pública, nunca sus modelos o repositorios. Si limita el historial, entregar al
   menos `max(pause_agitated_streak, pause_negative_window)` sesiones recientes.
2. **Joseph:** adaptar esos resultados a `evaluate_pause_alert` y agregar el endpoint
   protegido con pruebas de acceso permitido y denegado. No exponer historiales
   suministrados por el navegador como si fueran registros verificados.
3. **Damarys:** consumir el endpoint y mostrar `message` cuando `should_pause` sea
   verdadero; mostrar siempre el disclaimer junto al registro.
4. **Gonzalo:** verificar la integración en stage. Los tests actuales prueban las
   reglas con datos inventados; no prueban todavía aislamiento entre familias.

Verificación local: desde `backend/`, ejecutar
`uv run pytest tests/unit/test_insights.py` y Ruff.
La evaluación no usa LLM, logs, almacenamiento ni servicios externos.
Validación de esta entrega (27 de octubre de 2026), desde `backend/`:

- `.venv/bin/pytest tests/unit/test_insights.py`: 31 pruebas aprobadas.
- `.venv/bin/pytest`: 52 aprobadas; 23 omitidas porque PostgreSQL no estaba disponible.
- `.venv/bin/ruff check .` y `.venv/bin/ruff format --check .`: correctos.
- Verificación HTTP: no aplica todavía; esta entrega solo expone una función Python.

Para revertir esta unidad, retirar `insights/`, sus pruebas, este contrato y las
tres variables nuevas de `Settings` y `.env.example`; no requiere migraciones.
