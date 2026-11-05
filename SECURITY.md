# Política de seguridad

## Versiones mantenidas

El equipo mantiene la versión actual de la rama `main`. Las ramas de trabajo y
versiones anteriores no reciben correcciones de seguridad por separado.

## Reportar una vulnerabilidad

Usa el [formulario privado de GitHub](https://github.com/JosephChomboM/ayni-digital-startup/security/advisories/new)
en **Security and quality → Advisories → Report a vulnerability**. El equipo
revisará el reporte y coordinará contigo la corrección y su divulgación.

Incluye una descripción, el componente o commit afectado, pasos para reproducir
con datos sintéticos, el impacto esperado y una propuesta de solución si la tienes.
No publiques detalles explotables en issues ni PR antes de coordinar la corrección.
No adjuntes contraseñas, tokens, datos personales ni recuerdos familiares reales.
Evita pruebas que accedan a datos de otras personas o interrumpan el servicio.

## Actualizaciones y revisión

Dependabot revisa semanalmente las dependencias de Python (`uv`), frontend (`npm`)
y GitHub Actions. Las alertas y actualizaciones de seguridad de GitHub complementan
esas revisiones. Los PR deben pasar las comprobaciones del CI y la revisión del
equipo antes de integrarse; no se habilita merge automático.

Las Actions del pipeline se fijan a commits completos. Dependabot puede proponer
actualizaciones de esos commits, manteniendo el proceso de revisión del equipo.
