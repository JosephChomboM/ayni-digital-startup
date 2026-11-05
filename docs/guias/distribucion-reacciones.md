# Distribución de reacciones (AYNI-71)

Servicio independiente para preparar los agregados de AYNI-50. Se importa desde
`app.modules.insights.service`: `ReactionRecord` y `summarize_reactions`.

Entrada: un ID de perfil autorizado, registros tipados con `session_id`,
`elder_profile_id`, `occurred_at` y `reaction`, y límites `start`/`end` con zona
horaria. El intervalo incluye el inicio y excluye el final. Para un día completo
en Lima, pasar las 00:00 de ese día y las 00:00 del siguiente con UTC−05:00.
Los límites devueltos se normalizan a UTC.

Devuelve `total`, los cuatro conteos (también ceros sin actividad) y el aviso
«Esto no es un diagnóstico. Es un registro de actividades familiares.».
No aplica los umbrales de pausa ni interpreta las reacciones como salud.
Los duplicados exactos de una sesión cuentan una vez; registros contradictorios
y perfiles mezclados producen un error. No se registran reacciones en logs.

## Integración pendiente con Marcelo y Damarys

Todavía no existe `responses.service` en main. Este cambio no crea endpoints,
no persiste respuestas y no sustituye las cifras de demostración del dashboard.
Cuando AYNI-49 entregue su interfaz pública:

1. Autorizar al usuario con `families.service` y obtener su perfil desde el servidor.
2. Leer respuestas persistidas mediante `responses.service`, nunca sus modelos
   ni repositorios. No aceptar historial del navegador como evidencia real.
3. Adaptar cada respuesta a `ReactionRecord` y llamar al resumen.
4. Exponer el resultado en un endpoint protegido de insights para AYNI-50.
5. Probar acceso entre familias y conectar el dashboard. El perfil coincidente
   que comprueba la función es una defensa adicional, no autentica al usuario.

Pruebas: `pytest tests/unit/test_reaction_summary.py`. Son casos sintéticos de
cálculo, límites temporales y entradas inválidas. No acreditan integración HTTP.
Reversión: retirar `insights/summary.py`, sus exportaciones públicas y las pruebas.
No requiere migración, infraestructura ni dependencias nuevas.
