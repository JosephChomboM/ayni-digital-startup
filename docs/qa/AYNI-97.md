# QA del filtro de recuerdos — AYNI-97

Fecha: 10 de noviembre de 2026 (Lima). Base: `f872a23` de `main`. Ambiente: copia local con el cambio de filtrado de esta entrega.

El alcance de AYNI-97 se ajustó el 10 de noviembre para verificar el filtro de anécdotas y canciones de la guía actual. La corrección y su regresión están verificadas localmente y listas para commit. AYNI-66 conserva los criterios de guías persistidas, historial y validación integrada. Los pendientes de la siguiente tabla corresponden a esa validación posterior.

| Caso | Resultado |
| --- | --- |
| Selección de anécdotas y canciones | La prueba de regresión usa recuerdos sintéticos positivos, sin marcar y sensibles. El selector debe ofrecer únicamente los positivos que no sean sensibles. La primera opción también se elige de esa lista filtrada. |
| Guía sin contenido elegible | La interfaz actual permite avanzar con preguntas genéricas. Queda pendiente verificar el caso sin contenido en el generador de guías del backend. |
| Persistencia, historial y detalle después de recargar | Pendiente de AYNI-46 y AYNI-48. `app/main.py` no registra rutas de sesiones. La reseña local de la guía tiene su propio almacenamiento en el navegador. |
| Aislamiento de familias | La API de recuerdos ocultó los sensibles por defecto, excluyó de la lista los recuerdos de otra familia y rechazó el acceso directo a un recuerdo ajeno. Los permisos de sesiones persistidas quedan pendientes. |
| Fotos y navegación móvil | Pendiente de validar el flujo integrado. Las fotos locales no tienen vínculo con las marcas de un recuerdo. |

## Cómo reproducir el caso de exclusión

1. En una familia de prueba, crea una anécdota y una canción marcadas como **Es un recuerdo bonito**.
2. Agrega otra anécdota y otra canción sin marcar. Crea una anécdota marcada como sensible.
3. Abre **Guía de sesión**. Comprueba que los selectores solo ofrecen la anécdota y la canción positivas.
4. Comienza la guía, avanza al paso de conversación y comprueba que aparece el título de la anécdota permitida.

## Cobertura automatizada

- Las ocho combinaciones de tipo de recuerdo, marca positiva y marca sensible.
- Selección inicial con contenido prohibido al principio de la respuesta.
- Exclusión de canciones sensibles aunque la respuesta simulada de la API las incluya.
- Uso de los recuerdos permitidos al avanzar por conversación y música.
- Selección manual de otra anécdota permitida.
- Nueva carga después de marcar como sensible una anécdota que antes estaba permitida.
- Error de carga y ausencia de opciones procedentes de una respuesta fallida.
- Pausa, continuación y guardado u omisión de la reseña local, cubiertos por las pruebas existentes.

Desde `frontend`, `npm test -- src/components/SessionGuide.test.tsx` ejecuta estos 14 casos. Las llamadas de API de estas pruebas usan datos simulados.

## Resultados del 10 de noviembre

- La ejecución específica pasó los 14 casos de `SessionGuide.test.tsx`.
- La suite completa de la rama `gonzalo/ayni-97-filtro-guia` pasó 77 pruebas. El build pasó y el lint terminó sin errores, con advertencias existentes del proyecto.
- Al ejecutar la prueba principal sobre el código original de `f872a23`, la regresión falló como se esperaba. Al restaurar la corrección pasó.
- La combinación temporal de esta entrega con las pruebas de AYNI-98 pasó 84 pruebas. Se restauró la separación de archivos por rama después de la comprobación.
- Con PostgreSQL local y la base dedicada `ayni_test`, pasaron los tres casos seleccionados de `tests/integration/test_memories_endpoints.py` con `-k "hides_sensitive or excludes_another_family or does_not_expose"`.
- El contrato OpenAPI publicado por Stage devolvió cero rutas bajo `/sessions`. La prueba de persistencia e historial necesita el despliegue de esos endpoints.
