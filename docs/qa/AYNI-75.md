# AYNI-75 — Detalles detectados en anécdotas

**Revisión de QA:** Gonzalo Cáceres, 2 de noviembre de 2026.  
**Cambio revisado:** [PR #21](https://github.com/JosephChomboM/ayni-digital-startup/pull/21), commit `d49aba8`.  
**CI:** [run 41356351769](https://github.com/JosephChomboM/ayni-digital-startup/actions/runs/41356351769), terminado correctamente.

## Cobertura revisada

La interfaz muestra entidades de persona, lugar, época y actividad, y diferencia extracción pendiente, fallida, completada con resultados y completada sin resultados. Las pruebas cubren el contenido escapado y que las canciones no muestren ese bloque. La actualización vuelve a consultar datos guardados.

El PR incluye la búsqueda de AYNI-69 como base. El CI aprobó backend, frontend y seguridad; los despliegues se omitieron. El código del PR no está en esta rama local; esta revisión se basa en el diff y el CI, no en una ejecución local ni en stage.
