# AYNI-60 — Validación del prototipo y trazabilidad de requisitos

**Revisión del repositorio:** 4 de noviembre de 2026.  
**Alcance revisado:** frontend versionado en este checkout. No se encontró URL de Figma ni una versión externa del prototipo para identificarla como artefacto revisado.

## Trazabilidad observada en la aplicación

| Paso solicitado | Pantalla o componente localizado | Evidencia automatizada existente | Resultado de esta revisión |
|---|---|---|---|
| Acceso | `WelcomePage`, `AuthPage` y `frontend/src/App.tsx` | `frontend/src/pages/AuthPage.test.tsx`, `frontend/src/api/auth.test.ts` | Existe entrada pública, login y registro; revisar visualmente en móvil. |
| Perfil familiar | `frontend/src/pages/ProfilePage.tsx`, accesible desde `UploadModule` | Pruebas API de familias; no se encontró una prueba del recorrido visual perfil→guardar | La edición está en el código; el acceso al perfil no es una opción principal del menú global. |
| Recuerdo | `frontend/src/components/UploadModule.tsx` | `frontend/src/api/UploadModule.test.tsx` y `frontend/src/api/memories.test.ts` | Anécdotas y canciones están en la interfaz; la carga de fotos aparece deshabilitada (“Próximamente”). |
| Guía | `frontend/src/components/SessionGuide.tsx` | `frontend/src/components/SessionGuide.test.tsx` | La guía permite iniciar, pausar, reanudar y terminar una sesión simulada. |
| Reacción | `frontend/src/components/ResponseRegistry.tsx` | `frontend/src/components/SessionGuide.test.tsx` | El componente permite seleccionar y confirmar una respuesta simulada, pero no está conectado a `App.tsx` ni a una API de sesiones. |
| Celular | Diseño adaptable en páginas y componentes | No se encontró captura de viewport ni prueba visual automatizada | Pendiente de recorrido manual con tamaño de celular y registro de resultado. |

## Criterio y pendientes de cierre

La búsqueda del repositorio confirma pantallas y pruebas de componentes, pero no acredita que se haya recorrido un prototipo externo ni que el flujo completo esté integrado. Antes de marcar la tarea lista, registrar la URL/versión del prototipo (si aplica), fecha, viewport, pasos, resultado esperado/obtenido y defectos. No afirmar que una respuesta fue guardada en backend: el componente actual solo muestra una confirmación local.

### Comprobaciones para la revisión manual

1. Abrir el prototipo o la aplicación identificada por el equipo en escritorio y en viewport móvil.
2. Recorrer acceso → perfil → recuerdo → guía → reacción, anotando en qué transición se accede a cada vista.
3. Verificar texto legible, botones visibles y acciones principales alcanzables en el viewport móvil.
4. Registrar capturas sin datos personales, la versión/commit y cualquier pantalla o acción faltante.

Esta nota documenta el estado que se puede verificar en el código; no registra una ejecución manual que no se haya realizado.
