# AYNI-61 — Coherencia entre arquitectura, datos y contratos

**Revisión documental:** 4 de noviembre de 2026.  
**Fuentes:** `render.yaml`, `docker-compose.yml`, `.env.example`, routers y schemas del backend, migraciones y documentos de API/modelo.

## Hallazgos de la revisión

| Área | Contraste | Resultado |
|---|---|---|
| Límites de módulos | `main.py` monta familias y recuerdos; la API no agrega prefijo global `/api` | La guía de endpoints debe describir rutas en raíz. |
| Contrato de recuerdos | El router implementa `POST/GET /memories`, `GET/PATCH/DELETE /memories/{id}`; el schema acepta anécdota o canción | Se corrigió `docs/API_ENDPOINTS.md`, que todavía llamaba propuestas a rutas ya implementadas y listaba rutas POST que no existen. |
| Fotos, sesiones e insights | No se encontraron routers para esos flujos | Siguen como propuestas; el UI de sesión/respuesta no prueba persistencia en backend. |
| Datos | Modelos y migraciones implementan familias, usuarios, consentimiento, perfil, invitaciones, recuerdos y entidades extraídas | Sesiones, respuestas y fotos no están representadas como tablas implementadas. |
| Permisos | Servicios de familias y recuerdos derivan la familia del usuario autenticado; pruebas cubren acceso cruzado y roles | No confiar en `family_id` o autor suministrado por el cliente. |
| Regresión de contratos | `backend/tests/unit/test_api_contracts.py` inspecciona el OpenAPI generado por FastAPI | Comprueba que las rutas implementadas se publiquen y que rutas de fotos/sesiones aún no implementadas no aparezcan. |
| Ambientes y secretos | `render.yaml` declara servicios/variables para stage y producción; compose inicia PostgreSQL local | El repositorio no prueba que los servicios remotos estén activos ni que secretos estén configurados. |
| Storage | El blueprint declara variables Supabase, pero no hay integración de carga de fotos en el backend | Un bucket privado no está probado ni implementado por esta revisión. |

## Entregables relacionados

- [Arquitectura física y ambientes](../ARQUITECTURA_FISICA.md): diagrama local, stage y producción; límites de confianza y límites de evidencia.
- [Contratos de API](../API_ENDPOINTS.md): rutas implementadas separadas de propuestas.
- [Modelo de datos](../MODELO_DATOS.md): relaciones, modelos y migraciones existentes.
- [Guía DevOps/QA](../guias/gonzalo-devops-qa.md): secretos y límites de los despliegues declarados.

La revisión es estática sobre archivos versionados; no afirma una prueba en Render/Supabase, una consulta de base remota ni una inspección de secretos del proveedor. La prueba de contrato es ejecutable con la suite unitaria del backend; debe correrse en la rama del PR para adjuntar el resultado.
