# Condiciones de despliegue

La ejecución 42124675268 del commit 59fa601 pasó los controles, pero omitió ambos despliegues. La revisión de dependencias nuevas es exclusiva de pull requests y se omite en push. El job Seguridad admite esa omisión en push; las condiciones implícitas de éxito de sus descendientes seguían propagándola.

Los despliegues usan ahora una función de estado explícita (`!cancelled()`) para evitar el `success()` implícito. Stage solo corre en push a refs/heads/main y exige success para cada dependencia directa. Producción exige el mismo evento y rama, además de stage exitoso. Se conserva el environment production y sus protecciones; el cambio no aprueba despliegues manualmente ni modifica secretos o hooks.

La revisión de dependencias nuevas debe seguir siendo exclusiva de PR: evalúa el diff de dependencias antes del merge. En push continúan npm audit, pip-audit y los demás análisis completos. No se fuerza un análisis de diff de PR sin contexto de PR.

Validación: `actionlint .github/workflows/ci-cd.yml` (incluye shellcheck) y `python3 .github/tests/test_deploy_conditions.py`. Las pruebas cubren la omisión intencional de la revisión, fallos/cancelaciones/omisiones en controles requeridos, PR, otras ramas y dependencia de producción respecto a stage. Ejecutan también el script bash real del gate Seguridad para verificar que una revisión omitida solo se admite en push. La prueba de expresiones cubre el subconjunto usado y no sustituye al scheduler de GitHub. El test se ejecuta en CI, antes del build frontend.

La ejecución real de stage se comprueba después del merge de esta corrección en main. Reejecutar el workflow antiguo conserva la definición anterior. Que el hook de Render responda no demuestra por sí solo que el servicio haya terminado de desplegar: comprobar el commit y la salud del servicio posteriormente.

Rollback: revertir únicamente las condiciones de deploy-stage/deploy-production, el paso Condiciones de despliegue y su prueba. No hay cambios de aplicación ni de datos.
