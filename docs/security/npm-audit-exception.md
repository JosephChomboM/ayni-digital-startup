# Excepción temporal de auditoría npm: `picomatch`

**Estado:** temporal, pendiente de parche upstream  
**Inicio:** 2026-11-17  
**Fecha límite de revisión:** 2026-12-01  
**Aviso:** [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)

## Motivo

El escaneo de dependencias detecta `picomatch@4.0.7`, una dependencia indirecta de las herramientas de desarrollo, prueba y compilación del frontend (`vite`, `vitest`, `tinyglobby` y `fdir`). La dependencia ya existía en la rama base de `main` y el aviso upstream todavía no publica una versión corregida. No se encontró uso directo de picomatch ni patrones glob suministrados por usuarios en el frontend revisado.

El sitio frontend se publica como contenido estático, por lo que estas herramientas no se sirven como dependencias del navegador en producción. Esto reduce la exposición de la aplicación publicada, pero **no elimina el riesgo en el entorno de desarrollo y compilación**: patrones maliciosos procesados por la cadena de herramientas podrían afectar su disponibilidad.

No se aplicó `npm audit fix --force`: propone downgrades de herramientas y no constituye una corrección del aviso upstream.

## Alcance de la excepción en CI

`.github/workflows/ci-cd.yml` ejecuta `frontend/scripts/check-npm-audit.mjs`. El script:

- Permite solo `GHSA-fc5q-39xc-vjpf` asociado a `picomatch@4.0.7`.
- Verifica que `picomatch` y cada paquete afectado estén marcados como dependencias de desarrollo en `frontend/package-lock.json`.
- Limita la cadena indirecta permitida a `picomatch`, `fdir`, `tinyglobby`, `vite`, `vitest` y `@vitejs/plugin-react`.
- Mantiene el fallo del check ante cualquier otra vulnerabilidad alta o crítica, cualquier causa adicional, cualquier dependencia de producción o cualquier cambio de versión/alcance que no haya sido revisado.
- Hace fallar el check desde el **1 de diciembre de 2026** para exigir que se elimine o renueve la excepción con una revisión explícita.

La excepción no desactiva `npm audit` y no declara que el paquete sea seguro. Es una aceptación temporal y acotada del riesgo para que el CI pueda continuar mientras upstream publica una corrección.

## Seguimiento y salida

El responsable de revisar el frontend y la política de seguridad debe volver a evaluar este documento antes del 2026-12-01 y revisar el aviso upstream. Cuando haya una versión corregida, actualizar dependencias y lockfile, quitar la excepción del script y volver a `npm audit --audit-level=high`. Si no hay parche para la fecha límite, el check falla hasta que el equipo documente una nueva decisión de riesgo y plazo.
