# AYNI-33 — recorrido de aceptación

Fecha: 13 de noviembre de 2026. Base local: `5ab162c1e4a99a9555f7061aca582855ad34aaed`.

## Resultado comprobado

- Stage, API real: registro, acceso y perfiles de dos familias ficticias; rechazo de guía sin recuerdos; generación y recuperación de guía positiva; exclusión de recuerdos sensibles y no positivos; rechazo del acceso cruzado y sin autenticación.
- Stage, API real: reacción persistida, reintento sin duplicados, recuperación de reacción e historial. Las familias creadas por el script se eliminaron al terminar.
- Stage, navegador: acceso con cuenta ficticia, perfil, creación de anécdota positiva, aparición en la selección, sesión sin cámara ni micrófono, respuesta contextual sobre los árboles del paseo, cierre, reacción Receptivo e historial. Vista móvil de 390 × 844 verificada. La navegación superior tiene desplazamiento horizontal y las herramientas de sesión se abren desde Opciones.
- Stage, fotos: `qa_private_photos` pasó acceso familiar, rechazo ajeno, bucket privado, enlace firmado válido y vencido, eliminación de objetos y conservación de archivos de otra familia. Limpieza completada.
- Local: 678 pruebas de backend y 171 de frontend pasaron. Ruff y compilación del frontend pasaron; el lint del frontend terminó sin errores, con advertencias existentes.

## Repetición automática

Desde `backend`, con el entorno y PostgreSQL de pruebas configurados:

```powershell
.venv/Scripts/python.exe -m pytest tests/integration/test_acceptance_journey.py -q
.venv/Scripts/python.exe -m scripts.qa_acceptance --base-url https://ayni-api-stage.onrender.com
```

El script solo permite localhost y Stage; crea datos ficticios y los elimina. No registra credenciales ni relatos en la salida. El test integrado recorre las rutas HTTP reales y la base de datos, sin sustituir el servicio de sesiones.

## Alcance pendiente antes de cerrar Jira

La conversación por texto se comprobó en una sesión; no constituye una evaluación exhaustiva de IA, cámara, voz o seguridad. No se provocó una caída real de Stage para validar manualmente la recuperación ante fallos de red/servidor. La versión publicada aún no expone su commit: esa trazabilidad se aborda en AYNI-38. Mantener la actividad en curso hasta completar los criterios de error de red/servidor y registrar la versión publicada.
