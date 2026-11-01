# Recomendador: contrato para la integración

Primera versión independiente para `joseph/recommender`. Ordena recuerdos en
memoria con scikit-learn; no consulta la base de datos ni publica endpoints.
La conexión con `memories`, `responses` y `sessions` queda pendiente de sus
interfaces públicas. No modifica la generación actual de sesiones.

## Uso desde Python

```python
from app.modules.recommender.service import (
    MemoryCandidate,
    SessionFeedback,
    rank_memories,
)

# Datos inventados de un solo adulto mayor, ya autorizado por el backend.
memories = [
    MemoryCandidate(
        memory_id="foto-1", kind="photo",
        is_positive=True, is_sensitive=False, tags=("cocina",),
    ),
    MemoryCandidate(
        memory_id="cancion-1", kind="song",
        is_positive=True, is_sensitive=False, tags=("vals",),
    ),
]
feedback = [
    SessionFeedback(memory_ids=("cancion-1",), reaction=reaction)
    for reaction in ("receptivo", "emocionado", "receptivo")
]
ordered = rank_memories(memories, feedback)
# cancion-1 queda antes de foto-1. enabled=False conserva el orden seguro.
```

La salida es una lista de los mismos `MemoryCandidate`, ordenados. No crea
contenido, no selecciona la duración ni impone diversidad o límites del plan.
Los empates conservan el orden de entrada. No modifica las entradas.
Los DTO validan tipos y reacciones al construirse; los datos inválidos deben
corregirse en el adaptador, antes de llamar al ranking.

## Criterio inicial propuesto

- Solo participan recuerdos con `is_positive=True` e `is_sensitive=False`.
  Se filtran también con ranking desactivado, sin historial o ante un fallo.
- `DictVectorizer` representa el tipo y etiquetas opcionales; la similitud
  coseno compara esos atributos. Las etiquetas se normalizan sin distinguir
  mayúsculas ni espacios exteriores. No se necesitan anécdotas, fotos ni un LLM.
- `receptivo` y `emocionado` aportan +1; `agitado`, -1; `indiferente`, 0.
  Son pesos heurísticos pendientes de acordar con el equipo, no probabilidades
  ni predicciones validadas de cómo reaccionará una persona.
- Hacen falta tres sesiones con señal distinta de cero y al menos un recuerdo
  que siga siendo elegible en la entrada. Cada sesión cuenta una vez. Su señal
  se reparte entre sus recuerdos conocidos, sin duplicar IDs dentro de ella.
- Se promedian las similitudes ponderadas de esas sesiones. Recuerdos ausentes,
  eliminados o actualmente sensibles no aportan señal. Si no hay etiquetas,
  la comparación solo distingue tipos. El historial no tiene ponderación temporal.
- Si no alcanza el historial o falla el cálculo, se conserva el orden de los
  recuerdos elegibles. No hay entrenamiento persistente, logs ni llamadas externas.

La señal de una sesión se atribuye provisionalmente a sus recuerdos en conjunto;
no permite saber cuál causó una reacción. Este criterio requiere revisión del
equipo antes de activar la integración con familias reales.

## Pendientes de integración con Hats

1. Obtener recuerdos mediante `memories.service` y respuestas mediante
   `responses.service`, sin importar sus modelos ni repositorios. El backend
   debe autorizar y limitar ambos conjuntos al mismo adulto mayor y familia;
   esta función pura no puede comprobar esa pertenencia.
2. Adaptar IDs a strings, pasar cada recuerdo una sola vez y cada sesión
   completada una sola vez. No aceptar historial ni marcas de seguridad del
   navegador como datos verificados. Usar las marcas actuales del servidor.
3. Acordar etiquetas con la información realmente disponible. Se pueden omitir;
   no hace falta adelantar cambios al esquema de recuerdos.
4. Evaluar la alerta con `insights.service` sobre el historial completo y ordenado,
   antes de generar otra actividad. El ranking no reemplaza ni cancela una pausa.
5. Usar el orden como opción en el generador de plantillas, con posibilidad de
   desactivarlo. Verificar aislamiento entre familias, reglas éticas y fallback
   en pruebas de integración, además del consumo de RAM en Render.

## Verificación y reversión

Desde `backend/`: `uv run pytest tests/unit/test_recommender.py`,
`uv run ruff check .` y `uv run ruff format --check .`.
Las pruebas usan datos sintéticos, sin servicios externos.
La verificación HTTP no aplica todavía: solo se expone una función Python.
Para revertir esta unidad, retirar `recommender/`, sus pruebas y esta guía,
quitar scikit-learn de `pyproject.toml` y regenerar `uv.lock`. No hay migraciones.
