# AYNI-46 — Núcleo de guías familiares

Estado: generador interno en rama local; con tablas de persistencia; sin endpoints ni conexión web todavía.
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

Implementados: núcleo de plantillas, modelos, migración y repository con pruebas de persistencia e aislamiento.
Pendientes: interfaz pública de memories, cuota en billing, servicio de aplicación,
schemas HTTP, router y pruebas de los endpoints.
AYNI-48 cubre recuperar historial y detalle persistidos; no se declara completada aquí.


## Persistencia de AYNI-46

FamilySession guarda perfil, autor, fecha, duración y versión de plantilla.
SessionItem conserva orden, minutos e instrucciones originales. Se almacena el ID
original del recuerdo y un vínculo vivo que pasa a null si el recuerdo se elimina.
No se copian títulos, textos, enlaces de canciones ni URLs firmadas: un recuerdo
eliminado podrá mostrarse como no disponible, sin regenerar los pasos del historial.
Editar el contenido de un recuerdo no modifica las instrucciones ya guardadas.

Al eliminar el perfil se eliminan físicamente sesiones y pasos. Eliminar solo al autor
deja su ID en null para no borrar el historial compartido de los demás familiares;
el alcance definitivo de eliminación de cuenta se coordina en AYNI-52.

La rama de borrado de fotos tiene otra migración local. Antes de integrar ambas ramas
hay que reconciliar sus revisiones de Alembic y comprobar una sola cabeza en el resultado.


SessionsRepository guarda la guía en la transacción del servicio y consulta siempre
por elder_profile_id, con historial paginado y orden estable de fecha/UUID.
Es una interfaz interna: el servicio de aplicación deberá autenticar, validar los
recuerdos mediante memories.service y aplicar la cuota antes de llamarla.
Todavía no existe un endpoint que permita generar o consultar estas tablas.
