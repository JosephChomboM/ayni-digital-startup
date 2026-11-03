# Evaluación offline del extractor (AYNI-78)

Desde `backend/`, sin claves ni conexión al proveedor:

```bash
uv run python -m app.modules.nlp.evaluate tests/fixtures/nlp_synthetic_es.json --extractor null
uv run python -m app.modules.nlp.evaluate tests/fixtures/nlp_synthetic_es.json --extractor spacy
```

El conjunto versionado contiene 10 anécdotas sintéticas y 19 entidades esperadas.
Las anotaciones son decisiones explícitas del conjunto, no verdad clínica ni una
muestra representativa de familias. Antes de añadir casos, revisar que cada etiqueta
sea un fragmento literal y mantener IDs únicos. No incorporar datos familiares reales.

Se compara por caso el conjunto de pares (tipo, texto). NFC, espacios exteriores y
mayúsculas se normalizan; acentos, puntuación, tipos y límites de frase sí importan.
Las repeticiones del mismo par cuentan una vez, no por cada aparición. Una frase
parcial cuenta como FP y la esperada ausente como FN. No se mide NER por posiciones.
Precisión = TP/(TP+FP), recall = TP/(TP+FN), F1 = 2TP/(2TP+FP+FN).
Denominadores vacíos se informan como null; los errores del extractor cuentan como
casos fallidos y mantienen sus entidades esperadas en FN. Exactitud de caso exige
coincidencia completa y extracción sin error.

## Medición local inicial

Modelo `es_core_news_sm` 3.8.0, spaCy 3.8.18. No se evaluó Groq ni su cadena de respaldo.

| Tipo | TP | FP | FN | Precisión | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|
| Personas | 2 | 1 | 3 | 0.667 | 0.400 | 0.500 |
| Lugares | 3 | 0 | 1 | 1.000 | 0.750 | 0.857 |
| Épocas | 4 | 0 | 1 | 1.000 | 0.800 | 0.889 |
| Actividades | 0 | 0 | 5 | null | 0.000 | 0.000 |
| Micro total | 9 | 1 | 10 | 0.900 | 0.474 | 0.621 |

Sin fallos técnicos; 4 de 10 casos coinciden exactamente. Baseline null: TP=0,
FP=0, FN=19, precisión=null, recall=0 y F1=0. El respaldo spaCy no extrae actividades;
el evaluador conserva esa limitación en el resultado. No se fija un umbral de
aceptación ni se declara mejora general a partir de este conjunto pequeño.

SHA-256 del dataset: `7db823fb4f8aeb35184f1109a04ac6a7abf788a389294522f5989697c9878849`.
El reporte JSON incluye la huella y versiones, pero no textos ni entidades.
Salida del proceso: 0 evaluación completa, 1 casos fallidos, 2 entrada/configuración
inválida. Las métricas bajas por sí solas no son un fallo técnico del comando.

Pruebas deterministas: `uv run pytest tests/unit/test_nlp_evaluation.py`.
No modifica el modelo, la API ni las pantallas. Para revertir, retirar evaluate.py,
dataset, pruebas y esta guía. No hay migraciones ni dependencias nuevas.
