# Ayni Digital: tablero Jira desde el sprint 3 y propuesta de sprint 4

Documento preparado el **27 de octubre de 2026** para entregar a Codex o Claude y convertirlo en un tablero de trabajo del equipo.

**Qué contiene:** estructura del tablero, épicas, tarjetas, responsables, criterios de aceptación, pendientes trasladables y textos para presentar el avance. La distribución por sprints es una **reconstrucción de planificación propuesta**, basada en las guías y en el código disponible; no prueba que el equipo haya trabajado durante semanas anteriores. Las fechas de creación, ejecución y cierre deben conservar las fechas reales. No se han consultado Jira, GitHub remoto ni los servicios desplegados para este documento.

## 1. Prompt para el agente que recibirá este archivo

Copia este bloque como instrucción y adjunta este Markdown:

```text
Necesito que prepares el tablero Scrum de Ayni Digital usando el documento adjunto como especificación.

1. Lee CLAUDE.md, README.md, CONTRIBUTING.md, DEVOPS.md, docs/API_ENDPOINTS.md y las guías de docs/guias/. Revisa el código actual para actualizar el estado de las tarjetas.
2. Organiza el trabajo a partir del Sprint 3 y prepara el Sprint 4. La asignación histórica es una reconstrucción propuesta: no inventes fechas, reuniones, aprobaciones, pruebas, métricas de velocidad ni entregas anteriores. Conserva las fechas reales de Jira y etiqueta esta planificación como reconstruccion-propuesta.
3. Usa los responsables, épicas, identificadores de referencia, dependencias y criterios de aceptación de este documento. Los identificadores AD-* son referencias locales; Jira asignará sus claves reales.
4. Si tienes acceso a Jira, inspecciona primero el proyecto, tablero, sprints, usuarios y tarjetas existentes. Reutiliza lo que corresponda, evita duplicados y relaciona las referencias AD-* con las claves reales. Usa la cuenta Jira confirmada de cada persona; no deduzcas su correo desde GitHub.
5. Si mi solicitud incluye cargar el tablero, crea o actualiza únicamente estos elementos de planificación. No cierres ni actives sprints, no borres tarjetas y no cambies otras tareas. Si solo te pedí preparar el material, entrega la propuesta sin escribir en Jira.
6. Si no tienes acceso a Jira, genera docs/gestion/jira-import-sprints-3-4.csv y docs/gestion/jira-carga-manual.md. El CSV debe ser UTF-8, con comillas y saltos de línea correctamente escapados. Incluye identificador externo, tipo, resumen, descripción con criterios, responsable sugerido, prioridad, puntos, sprint propuesto, estado propuesto, épica de referencia y etiquetas. Documenta los campos que necesitan mapeo manual: no garantices que Jira pueda importar sprints, enlaces, usuarios o estados sin configuración previa.
7. Mantén separados el estado observado en código y el estado del flujo Jira. Una pantalla con datos de ejemplo no equivale a una funcionalidad integrada; código y tests presentes no equivalen a pruebas ejecutadas. No pongas una tarjeta en Hecho si falta evidencia del criterio de cierre.
8. Usa español claro y descripciones concretas. Mantén el alcance del MVP; no agregues microservicios, Kubernetes, Redis, servicios pagados ni dependencias innecesarias.
9. Entrega un resumen de tarjetas creadas/reutilizadas o archivos generados, las referencias AD-* y sus claves reales si existen, y cualquier mapeo pendiente.
10. No cambies código de producto, datos de usuarios, Git, despliegues ni credenciales para preparar este tablero. No publiques comentarios ni mensajes fuera de las tarjetas autorizadas.
```

## 2. Fuentes y evidencia disponible

| Fuente | Cómo se usa |
|---|---|
| `CLAUDE.md` | Alcance, arquitectura, orden del MVP, privacidad y reglas de contenido |
| `README.md`, `CONTRIBUTING.md`, `DEVOPS.md` | Equipo, flujo de revisión y configuración prevista de ambientes |
| `docs/guias/damarys-frontend.md` | Pantallas, coordinación y pruebas en celular |
| `docs/guias/hats-backend.md` | Familias → recuerdos → sesiones → respuestas; eliminación de cuenta |
| `docs/guias/joseph-ia-datos.md` | NLP, respaldo, alertas y funciones posteriores al MVP |
| `docs/guias/gonzalo-devops-qa.md` | Infraestructura, datos sintéticos y pruebas de reglas |
| `docs/guias/insights-integracion.md` | Motor de alertas separado de su integración HTTP pendiente |
| `docs/API_ENDPOINTS.md` | Rutas implementadas frente a rutas propuestas |

Inspección del checkout al preparar el archivo:

- `backend/app/main.py` monta el router de `families`, además de las rutas de salud.
- `backend/app/modules/families/` contiene modelos, repositorio, servicio, esquemas y router; hay migraciones y pruebas de integración.
- `backend/app/modules/nlp/` contiene extracción y respaldo; hay tests unitarios.
- `backend/app/modules/insights/` contiene reglas y esquemas; hay tests unitarios. Falta la ruta HTTP y conectarlo con respuestas persistidas.
- No se encontraron módulos de backend `memories`, `sessions` ni `responses` en este checkout.
- `frontend/src/api/auth.ts` y `families.ts` tienen llamadas a la API; esto no certifica que todos los contratos y recorridos hayan sido probados.
- `UploadModule`, `SessionGuide` y `ResponseRegistry` tienen interacción local de demostración. Su presencia no demuestra persistencia ni integración funcional.
- Hay un dashboard visual; debe verificarse su conexión con datos reales antes de cerrar su integración.
- `render.yaml` y el pipeline representan configuración disponible. No se verificó el despliegue real.

**Límite de esta revisión:** no se ejecutaron suites de pruebas ni recorridos completos para redactar este documento. Los estados siguientes son sugerencias sujetas a revisión del equipo.

## 3. Configuración del tablero

- **Nombre sugerido:** Ayni Digital — Desarrollo del MVP.
- **Modalidad:** Scrum, con sprints de dos semanas como supuesto de planificación, ajustable a la duración del curso.
- **Sprint 3:** Base del MVP y preparación de integración.
- **Sprint 4:** Recuerdos, sesiones y registro de respuestas.
- **Fechas:** por confirmar con el calendario del curso; no asignar fechas pasadas como si fueran evidencia de ejecución.
- **Backlog:** lista de trabajo fuera del sprint, no una columna adicional.
- **Columnas:** Por hacer → En curso → En revisión → En pruebas → Hecho.
- **Bloqueos:** usar bandera de bloqueo y relación «está bloqueada por», manteniendo la tarjeta en su estado real.
- **Tipos:** Épica, Historia, Tarea y Bug. Usar subtareas solo cuando faciliten una entrega concreta.
- **Prioridades:** Alta, Media y Baja; mapear a los nombres que ya tenga Jira.
- **Estimación:** puntos 1, 2, 3 y 5. Son estimaciones propuestas, no horas ni velocidad histórica. Dividir trabajo mayor antes de comprometerlo.
- **Etiquetas:** `mvp`, `frontend`, `backend`, `ia-datos`, `devops-qa`, `carryover-s3`, `post-mvp`, `reconstruccion-propuesta`, según corresponda.

### Equipo

| Persona | Rol | Usuario GitHub de referencia | Cuenta Jira |
|---|---|---|---|
| Damarys | Producto y Frontend | dahyesCM | Confirmar |
| Hats | Backend y Base de Datos | Hats41 | Confirmar |
| Joseph | IA y Datos | JosephChomboM | Confirmar |
| Gonzalo | DevOps y QA | Gonzzzalo3 | Confirmar |

El responsable sugerido es quien conduce la tarjeta; los colaboradores figuran en la descripción. Si no se identifica su cuenta Jira, dejar sin asignar y conservar el nombre sugerido.

### Épicas

| Referencia | Nombre | Resultado |
|---|---|---|
| EP-01 | Acceso y entorno familiar | Registro, consentimiento, login, perfil e invitaciones |
| EP-02 | Recuerdos familiares | Fotos privadas, anécdotas y enlaces musicales |
| EP-03 | Sesiones y respuestas | Guías con contenido permitido y registro de reacciones |
| EP-04 | Procesamiento y alertas | Extracción opcional y sugerencia de pausa |
| EP-05 | Experiencia móvil | Navegación y pantallas conectadas a la API |
| EP-06 | Entrega, privacidad y calidad | CI/CD, pruebas, ambientes y eliminación de datos |

## 4. Sprint 3 — Base del MVP y preparación de integración

**Objetivo propuesto:** establecer el acceso familiar y la estructura técnica y visual para integrar el recorrido principal.

**Relato de planificación:** se priorizan autenticación, organización familiar, navegación y componentes transversales. Las funcionalidades dependientes de recuerdos y respuestas se mantienen pendientes hasta contar con sus contratos y persistencia. Esto describe una secuencia técnica razonable; no documenta reuniones ni decisiones históricas comprobadas.

### Tarjetas de la base disponible

No se asignan puntos retrospectivos a estas tarjetas: el equipo debe confirmar su alcance original. «En revisión» significa revisar evidencia y aceptación; no afirma que exista un PR abierto.

| ID | Tipo / épica | Resumen | Responsable | Estado propuesto | Evidencia y criterio de cierre |
|---|---|---|---|---|---|
| AD-01 | Tarea / EP-06 | Preparar estructura del proyecto y entorno local | Gonzalo | En revisión | Backend, frontend, Docker y configuración presentes. Cerrar al reproducir arranque local y documentar variables sin secretos. |
| AD-02 | Historia / EP-01 | Registrar familia y acceder con consentimiento explícito | Hats | En pruebas | Router, servicio y pruebas presentes. Verificar consentimiento obligatorio, registro, login, JWT, errores y aislamiento entre familias. |
| AD-03 | Historia / EP-01 | Administrar perfil del adulto mayor e invitaciones | Hats | En pruebas | Código y pruebas presentes. Verificar perfil autorizado, restricciones por rol, invitación aceptada/revocada y rechazo de acceso ajeno. |
| AD-04 | Tarea / EP-05 | Crear navegación y estructura visual para celular | Damarys | En revisión | Páginas y componentes presentes. Validar navegación, botones legibles, estados vacíos y visualización Android. |
| AD-05 | Historia / EP-05 | Conectar registro e inicio de sesión con la API | Damarys | En pruebas | Cliente y pantalla de autenticación presentes. Verificar registro seguido de login, sesión, errores y que cerrar sesión elimine las credenciales persistidas. |
| AD-06 | Tarea / EP-04 | Extraer entidades con respaldo LLM → spaCy → sin entidades | Joseph | En pruebas | Implementaciones y tests presentes. Verificar fallos simulados, timeout, salida validada y guardado no bloqueante cuando se integre. Esta tarjeta cierra el servicio aislado; su integración pertenece a AD-10. |
| AD-07 | Tarea / EP-04 | Implementar motor aislado de sugerencia de pausa | Joseph | En pruebas | Reglas y tests presentes. Verificar racha, ventana completa, umbrales, solo `agitado` como negativo y disclaimer. No incluye endpoint ni dashboard. |
| AD-08 | Tarea / EP-06 | Preparar pipeline y configuración de despliegue | Gonzalo | En revisión | Archivos del pipeline y Blueprint presentes. Verificar jobs y reglas de promoción; el despliegue efectivo se valida en AD-14. |
| AD-09 | Tarea / EP-06 | Documentar contratos de API y coordinación por rol | Gonzalo | En revisión | Guías y catálogo presentes. Cerrar al contrastar rutas implementadas y propuestas con el router y compartir contratos con frontend. |

### Pendientes que se propone trasladar

Estas tarjetas representan trabajo pendiente que puede relacionarse con el alcance del Sprint 3. **Marcar `carryover-s3` solo si el equipo confirma que estuvo realmente comprometido allí.** Si no hubo planificación previa, registrarlo como backlog refinado para Sprint 4, sin afirmar arrastre histórico.

| ID | Pendiente | Responsable | Dependencia o razón técnica para replanificar | Destino propuesto |
|---|---|---|---|---|
| AD-10 | Persistencia y API de recuerdos | Hats | Depende del acceso familiar y habilita el generador | Sprint 4 |
| AD-11 | Generación de sesiones con reglas | Hats | Necesita recuerdos persistidos y filtrado positivo/no sensible | Sprint 4 |
| AD-12 | Registro persistente de respuestas | Hats | Necesita sesiones identificables y autorización familiar | Sprint 4 |
| AD-13 | Integrar alertas con respuestas reales y dashboard | Joseph | Necesita AD-12; el motor aislado no basta | Backlog priorizado; candidato adicional de Sprint 4 |
| AD-14 | Validar flujo integrado en stage | Gonzalo | Necesita recorrido funcional y acceso a ambientes | Backlog priorizado; candidato adicional de Sprint 4 |

**Cierre del Sprint 3:** revisar AD-01 a AD-09 y cerrar solo lo que tenga evidencia. Si Jira todavía tiene el sprint abierto, mover las tarjetas incompletas una sola vez al backlog o Sprint 4 conservando su identidad. No duplicarlas para simular actividad en ambos sprints. Si el sprint ya está cerrado, preservar su reporte y programar las mismas tarjetas pendientes en el siguiente sprint.

## 5. Sprint 4 — Recuerdos, sesiones y registro de respuestas

**Objetivo propuesto:** que una familia pueda guardar un recuerdo permitido, generar una guía y registrar una reacción, con datos persistidos y aislamiento entre familias.

**Capacidad provisional:** siete tarjetas, **24 puntos**. No se conoce la velocidad del equipo. Como Hats concentra 13 puntos y las principales dependencias, debe confirmar capacidad; si no alcanza, reducir alcance antes de iniciar el sprint y reformular el objetivo. No presentar estos 24 puntos como compromiso ya acordado.

| Orden | ID | Resumen | Responsable | Puntos | Prioridad | Depende de |
|---|---|---|---|---:|---|---|
| 1 | AD-10 | Guardar y consultar recuerdos familiares | Hats | 5 | Alta | AD-02, AD-03; AD-06 para extracción opcional |
| 2 | AD-15 | Conectar formulario y galería de recuerdos | Damarys | 3 | Alta | Contrato AD-10; API real para cierre |
| 3 | AD-11 | Generar guías con reglas y plantillas | Hats | 5 | Alta | AD-10 |
| 4 | AD-16 | Conectar guía y formulario de reacción | Damarys | 3 | Alta | Contratos AD-11, AD-12; API real para cierre |
| 5 | AD-12 | Guardar una respuesta por sesión | Hats | 3 | Alta | AD-11 |
| 6 | AD-17 | Preparar datos sintéticos repetibles | Gonzalo | 2 | Media | AD-10 y modelos de AD-11/AD-12 según alcance |
| 7 | AD-18 | Probar recorrido principal y reglas de contenido | Gonzalo | 3 | Alta | AD-10, AD-11, AD-12, AD-15, AD-16 |

Estado inicial propuesto: **Por hacer**. Mover a En curso únicamente cuando la persona confirme que comenzó. Si hay trabajo real ya iniciado, registrar su evidencia antes de actualizar el estado.

### AD-10 — Guardar y consultar recuerdos familiares

- **Tipo / épica:** Historia / EP-02. Responsable: Hats; coordina con Damarys y Joseph.
- **Historia:** como cuidadora, quiero guardar recuerdos de mi familia para preparar actividades con contenido conocido y positivo.
- **Alcance:** modelos y migración, servicio y API para fotos, anécdotas y enlaces; consulta de recuerdos y marcas de contenido. Si excede capacidad, dividir antes del sprint en anécdotas/enlaces y fotos privadas, manteniendo dependencias explícitas.
- **Aceptación:**
  - Cada recuerdo pertenece al perfil de la familia autenticada; un usuario ajeno no puede leerlo ni modificarlo.
  - Se guardan `is_positive` e `is_sensitive`; los sensibles no aparecen en la galería general.
  - Las fotos van a un bucket privado y se muestran con URLs firmadas de corta duración.
  - Las canciones se guardan como enlaces de YouTube/Spotify; no se descargan archivos.
  - Una falla de NLP no impide guardar la anécdota; solo se envía su texto al extractor.
  - Los endpoints entregados tienen prueba feliz y de error, y la migración es reproducible.
- **Evidencia:** contrato actualizado, pruebas ejecutadas y demostración con dos familias sintéticas.

### AD-15 — Conectar formulario y galería de recuerdos

- **Tipo / épica:** Historia / EP-05. Responsable: Damarys; coordina con Hats.
- **Historia:** como cuidadora, quiero subir y ver recuerdos desde mi celular con confirmaciones claras.
- **Aceptación:** envío real a la API, selección de tipo, marcas positivo/sensible, galería, errores comprensibles, estados vacío/carga y confirmación solo después de persistir. Al recargar, el recuerdo sigue disponible según sus permisos. No mostrar una carga simulada como guardado definitivo.
- **Evidencia:** recorrido con datos sintéticos y revisión en pantalla de celular.

### AD-11 — Generar guías con reglas y plantillas

- **Tipo / épica:** Historia / EP-03. Responsable: Hats; coordina con Damarys y Gonzalo.
- **Historia:** como familiar, quiero una guía de 15–20 minutos para acompañar una actividad sin formación clínica.
- **Aceptación:**
  - La generación funciona sin LLM y sin recomendador.
  - Solo usa recuerdos de la familia con `is_positive=true` e `is_sensitive=false`.
  - Si no hay contenido permitido, devuelve un resultado claro y no inventa recuerdos.
  - Persiste sesión e ítems y permite consultar su detalle e historial con autorización.
  - Las instrucciones usan lenguaje familiar, sin promesas de salud.
  - Incluye pruebas de exclusión de contenido sensible, contenido no positivo y acceso ajeno.
- **Evidencia:** sesión persistida con contenido trazable y resultados de las pruebas.

### AD-16 — Conectar guía y formulario de reacción

- **Tipo / épica:** Historia / EP-05. Responsable: Damarys; coordina con Hats.
- **Historia:** como cuidadora, quiero seguir la guía y registrar cómo le fue a mi familiar.
- **Aceptación:** guía real con pasos, inicio en máximo tres toques desde la pantalla principal, manejo de falta de recuerdos y errores; formulario con las cuatro reacciones previstas y envío a la sesión correcta. Mostrar «guardado» solo tras respuesta satisfactoria del backend. Acordar con Hats el comportamiento ante reenvíos.
- **Evidencia:** generar, completar y consultar el registro persistido después de recargar.

### AD-12 — Guardar una respuesta por sesión

- **Tipo / épica:** Historia / EP-03. Responsable: Hats; coordina con Joseph y Damarys.
- **Historia:** como cuidadora, quiero registrar la reacción al terminar una sesión para conservar su historial.
- **Aceptación:** valores `receptivo`, `emocionado`, `indiferente` y `agitado`; una respuesta por sesión sin duplicados; autorización por familia y validación de sesión. Publicar desde `responses.service` una interfaz de historial con orden cronológico estable para insights. Probar caso feliz, valor inválido, reenvío y familia ajena.
- **Evidencia:** contrato público acordado y pruebas con PostgreSQL, sin omitir las de integración.

### AD-17 — Preparar datos sintéticos repetibles

- **Tipo / épica:** Tarea / EP-06. Responsable: Gonzalo; coordina con Hats y Joseph.
- **Aceptación:** procedimiento repetible en local para al menos dos familias, recuerdos positivos y sensibles y casos sin contenido permitido. Incluir sesiones y reacciones cuando sus modelos existan. No usar datos de personas reales ni cargar producción. Documentar ejecución y evitar duplicados al repetirlo.
- **Evidencia:** instrucciones y dataset sintético que permitan repetir AD-18.

### AD-18 — Probar recorrido principal y reglas de contenido

- **Tipo / épica:** Tarea / EP-06. Responsable: Gonzalo; colaboran los cuatro.
- **Aceptación:** registro → login → perfil → recuerdo → guía → respuesta → consulta persistida; verificar exclusión de sensibles/no positivos y rechazo entre familias; comprobar estados de error y uso móvil. Ejecutar pruebas backend, lint y comprobaciones frontend previstas en el repositorio. Reportar pruebas omitidas y fallas.
- **Evidencia:** checklist con fecha real, ambiente, resultado y defectos. La validación local no cierra por sí sola AD-14.

### Orden de coordinación

1. Hats publica primero los contratos de recuerdos, sesiones y respuestas.
2. Damarys avanza con esos contratos y datos de ejemplo identificados mientras la API se implementa.
3. Joseph acompaña la integración NLP y acuerda el historial público para alertas, sin importar internals de otros módulos.
4. Gonzalo prepara casos sintéticos y pruebas en paralelo a las entregas disponibles.
5. Se conectan las pantallas y se ejecuta el recorrido real. Si falta persistencia o hay pruebas bloqueadas, se registra como pendiente.

## 6. Backlog priorizado y candidatos adicionales

Los puntos son preliminares. AD-13 y AD-14 no forman parte de los 24 puntos del núcleo. Incorporarlos exige acordar capacidad o retirar otras tareas; no prometer todo simultáneamente.

| ID | Tipo / épica | Resumen | Responsable | Puntos | Prioridad | Dependencia |
|---|---|---|---|---:|---|---|
| AD-13 | Historia / EP-04 | Conectar alertas con historial real y dashboard | Joseph | 5 | Alta | AD-12; colaboración de Damarys |
| AD-14 | Tarea / EP-06 | Validar integración y despliegue en stage | Gonzalo | 3 | Alta | AD-18 y configuración efectiva de ambientes |
| AD-19 | Historia / EP-05 | Conectar perfil e invitaciones en el recorrido móvil | Damarys | 3 | Alta | AD-03; revisar integración y navegación actuales |
| AD-20 | Historia / EP-06 | Eliminar cuenta y datos asociados de forma efectiva | Hats | 5 | Alta | Definir conducta por rol; AD-10, AD-11, AD-12 |
| AD-21 | Tarea / EP-06 | Probar borrado completo y permisos | Gonzalo | 3 | Alta | AD-20 |
| AD-22 | Historia / EP-05 | Mostrar resumen familiar con datos reales | Damarys | 3 | Media | AD-12 y contrato de agregados |
| AD-23 | Historia / EP-04 | Ordenar contenido con recomendador opcional | Joseph | 5 | Baja | Post-MVP; historial suficiente y criterios acordados |
| AD-24 | Historia / EP-04 | Mostrar patrones descriptivos | Joseph | 3 | Baja | Post-MVP; AD-12 y coordinación con Damarys |
| AD-25 | Historia / EP-06 | Simular planes y pagos de prueba | Hats | 5 | Baja | Post-MVP; contrato de límites y proveedor test |
| AD-26 | Tarea / EP-06 | Automatizar recálculo programado si es necesario | Gonzalo | 2 | Baja | Post-MVP; necesidad real de AD-24 |

### Criterios de las tarjetas prioritarias

- **AD-13:** endpoint protegido que obtiene respuestas desde `responses.service`, con orden estable y aislamiento familiar; 3 `agitado` consecutivos o proporción ≥50 % de `agitado` en ventana completa de 5; `indiferente` no cuenta como negativa. Parámetros configurables y pendientes de validar con asesor clínico. Mensaje solo cuando corresponde y disclaimer siempre junto al reporte. Damarys muestra la respuesta real; tests de bordes y permisos. No presentar estos umbrales como validación clínica.
- **AD-14:** identificar URLs y ambientes reales; comprobar frontend/API/base conectados, migraciones, almacenamiento privado y recorrido con datos sintéticos. Registrar resultado y tiempo real de la comprobación. Un archivo de configuración o `/health` satisfactorio no bastan. Producción sigue el flujo de aprobación existente.
- **AD-19:** permitir llegar al perfil desde la navegación, persistir cambios, listar miembros y gestionar invitaciones según permisos; comprobar aceptación/revocación y errores. Revisar lo existente antes de duplicar componentes.
- **AD-20:** acordar primero qué ocurre al eliminar un familiar frente a la cuidadora principal; borrado efectivo del alcance autorizado, incluyendo archivos y entidades dependientes. No borrar datos de otros miembros indebidamente. No cerrar con eliminación visual o soft delete.
- **AD-21:** probar eliminación de base de datos y archivos con datos sintéticos, tokens posteriores y protección de familias ajenas. No ejecutar borrados sobre datos reales para verificar la tarjeta.
- **AD-22:** totales e historial derivados de registros reales, estados sin actividad y lenguaje descriptivo; nunca presentar métricas de demostración como registros de una familia.

La eliminación de datos y la revisión de privacidad tienen prioridad antes de una apertura a usuarios reales, aunque no entren en este primer corte funcional.

## 7. Criterios comunes del equipo

### Para empezar una tarjeta

Debe tener responsable, resultado concreto, criterios de aceptación, contrato acordado si cruza frontend/backend y dependencias identificadas. Una pantalla puede comenzar con un contrato y datos de ejemplo; su cierre requiere integración cuando ese es su alcance.

### Para moverla a Hecho

- Alcance y criterios de la tarjeta demostrados; las tareas de servicio aislado cierran únicamente ese servicio.
- Revisión de código y flujo de PR conforme a las reglas del proyecto.
- Comprobaciones aplicables ejecutadas con resultado registrado; pruebas omitidas no cuentan como aprobadas.
- Endpoints nuevos con caso feliz y de error; reglas de contenido y permisos con sus pruebas específicas.
- Sin secretos, anécdotas ni nombres en logs; sin datos personales de cuenta enviados al LLM.
- Contratos o guías actualizados si cambió la interfaz pública.
- Evidencia identificada por ambiente. Desplegado, probado localmente e integrado son resultados distintos.

### Riesgos que deben verse en las tarjetas

| Riesgo | Respuesta de planificación |
|---|---|
| Concentración del backend en Hats | Publicar contratos pronto; trabajar pantallas y QA mientras tanto; reducir compromiso si la capacidad no alcanza |
| Pantallas con interacción simulada | Cerrar solo cuando el guardado y la consulta posteriores usen datos persistidos |
| Falta de ambientes disponibles | Registrar bloqueo en AD-14; seguir con comprobaciones locales sin afirmar despliegue |
| Falla o cuota del proveedor NLP | Usar respaldo y mantener guardado de recuerdos disponible |
| Reglas de alerta provisionales | Mantener parámetros documentados y registrar revisión pendiente del asesor |

## 8. Textos para presentar el avance

Estos textos ofrecen contexto técnico; no deben presentarse como actas de reuniones anteriores. Actualizar los verbos cuando cambie la evidencia.

### Resumen del Sprint 3

> La organización propuesta del Sprint 3 agrupa la base técnica y funcional del MVP: acceso familiar, consentimiento, perfil, navegación y preparación de componentes transversales. El repositorio contiene avances en estas áreas, además del extractor de entidades y el motor aislado de alertas. La integración de recuerdos, sesiones y respuestas queda como siguiente bloque porque requiere persistencia y contratos compartidos entre backend, frontend e IA. La aceptación de cada entrega se confirma con sus pruebas y revisión.

### Motivo para mantener pendientes

> El backlog priorizado concentra las funciones que dependen de completar el flujo principal. El generador necesita recuerdos permitidos ya almacenados, y las alertas necesitan respuestas persistidas y ordenadas. Esta dependencia permite organizar entregas verificables y evitar que una demostración visual se considere una función terminada.

### Objetivo del Sprint 4

> Se propone concentrar el Sprint 4 en un recorrido completo: guardar un recuerdo, generar una guía basada en reglas y registrar una reacción. Frontend y QA avanzan con contratos acordados mientras se construyen los módulos de backend. La integración de alertas y la comprobación en stage se programan según la capacidad confirmada y la disponibilidad del flujo principal.

### Si el equipo confirma un arrastre real

> Las tarjetas [claves reales] quedaron incompletas al cierre del Sprint 3 y se reprogramaron para el Sprint 4 conservando su identidad, dependencias y criterios de aceptación. La razón y el alcance pendiente se registran en cada tarjeta.

No usar este último párrafo si no existió ese compromiso previo. En ese caso, usar: «Las tarjetas se incorporaron al backlog refinado y se proponen para el Sprint 4».

### Formato para una actualización real

> Al [fecha real], [tarjetas] tienen [evidencia concreta] en [ambiente]. Quedan pendientes [criterios]. El bloqueo es [dependencia comprobada] y la siguiente acción corresponde a [responsable].

## 9. Checklist de entrega al agente

- [ ] Confirmar si se prepara material o también se autoriza cargar Jira.
- [ ] Identificar proyecto/tablero y cuentas reales si se trabaja en Jira.
- [ ] Confirmar duración y fechas del curso sin alterar fechas de ejecución.
- [ ] Revisar tarjetas existentes antes de crear nuevas.
- [ ] Validar estados de AD-01 a AD-09 con evidencia actual.
- [ ] Confirmar si AD-10 a AD-14 fueron compromiso previo o backlog nuevo.
- [ ] Acordar los 24 puntos propuestos y la capacidad de Hats.
- [ ] Mantener AD-13 y AD-14 fuera del núcleo hasta acordar su incorporación.
- [ ] Conservar referencias y dependencias, sin duplicar tarjetas arrastradas.
- [ ] Entregar claves Jira reales o CSV y guía manual con los mapeos pendientes.
