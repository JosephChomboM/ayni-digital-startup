# AYNI-67 — Validación del 12 de noviembre de 2026

Base local: `e3bbdcd`, con los cambios de esta tarea sin commit. PostgreSQL local
`ayni_test` para las pruebas; datos exclusivamente ficticios.

Se encontró que el motor de alertas no tenía integración HTTP ni un resumen
conectado al dashboard. Se añadió `GET /insights/reactions`, protegido por JWT,
que obtiene el perfil autorizado y el historial persistido mediante los servicios
públicos de familias y respuestas. No recibe identificadores de familia del cliente.

El resumen cubre los últimos 30 días. La alerta considera el historial completo;
solo `agitado` cuenta como negativo. No se modificaron umbrales. El dashboard
muestra conteos, historial, aviso de pausa y el texto de alcance; distingue errores
de API de un historial vacío. Las reseñas locales anteriores siguen identificadas
como datos del navegador y no alimentan esta alerta.

## Comprobaciones ejecutadas

- Cuatro reacciones guardadas y recuperadas por HTTP; historial cronológico.
- Reintento idéntico idempotente, cambio de reacción rechazado y valores inválidos.
- Historial vacío y aislamiento de dos familias; endpoint sin token devuelve 401.
- Dos `agitado`: sin alerta; tres seguidos: alerta.
- Tres `agitado` entre cinco registros: alerta; dos entre cinco: sin alerta.
- Cinco `indiferente`: sin alerta.
- Registros de más de 30 días: fuera del resumen, conservados en el historial.
- Mensaje de pausa y errores visibles comprobados con React Testing Library.
- HTTP real local: tres reacciones ficticias, resumen total 3 y `should_pause=true`.

## Resultados

`uv run pytest tests/integration/test_family_insights_endpoints.py tests/integration/test_responses_endpoints.py tests/unit/test_insights.py -q`: 50 aprobadas.

Regresión completa: 643 pruebas de backend y 130 de frontend aprobadas;
build aprobado; Ruff aprobado. El lint del frontend mantiene advertencias previas.
La integración nueva está en local; no se desplegó a Stage ni producción.
