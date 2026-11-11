# AYNI-46 — Núcleo de guías familiares

Estado: generador interno en rama local; sin endpoints, tablas ni conexión web todavía.
La pantalla SessionGuide existente de Damarys se conserva sin cambios.

## Interfaz implementada

`sessions.service.build_session_guide(elder_profile_id, memories) -> SessionGuide`.
Los candidatos son DTO GuideMemory. No se aceptarán como datos de entrada del navegador:
el futuro servicio obtendrá el perfil autenticado desde families.service y los recuerdos
desde memories.service. El filtro interno vuelve a comprobar el perfil, positivo=true,
sensible=false y borrado pendiente=false. No importa internals de otros módulos.

Se seleccionan hasta tres recuerdos únicos por orden estable de UUID. Es un criterio
determinista provisional, sin asignar relevancia, sin recomendador y sin depender de IA.
La guía dura 15 minutos: 2 de bienvenida, 10 distribuidos entre los recuerdos y 3 de cierre.
Las instrucciones permiten parar y no exigen recordar datos ni prometen resultados.
Los pasos contienen los IDs originales; no se inventa contenido ni se guardan URLs firmadas.
Sin recuerdos permitidos se lanza ApplicationError 409, code `no_eligible_memories`.

## Decisiones para compartir antes de integrar la API

- Rutas propuestas existentes: POST /sessions/generate, GET /sessions y GET /sessions/{id}.
- Los DTO y plantillas de este núcleo no son todavía un contrato HTTP publicado.
- Persistir sesión, versión de plantilla, pasos y referencias; decidir cómo conservar
  el contenido original ante futuras ediciones o borrados del recuerdo.
- El límite gratis de una guía por semana debe pasar por billing.service antes de
  publicar generación HTTP. El núcleo puro no autoriza usuarios ni aplica cuotas.
- Mantener errores comunes detail.code/detail.message y permisos por familia.
- Coordinar con Damarys la conexión de la pantalla existente; no duplicarla.

Pendientes: interfaz de selección pública de memories, cuota en billing, modelos y migración,
repository, servicio de aplicación, schemas HTTP, router y pruebas de integración.
AYNI-48 cubre recuperar historial y detalle persistidos; no se declara completada aquí.
