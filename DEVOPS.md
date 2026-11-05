# Documentación DevOps - Ayni Digital

Este documento describe la arquitectura de despliegue y el flujo de trabajo de CI/CD para el proyecto Ayni Digital.

## 1. Infraestructura en la Nube
*   **Hosting (PaaS):** Render (utilizado por su capa gratuita y soporte para Docker).
*   **Base de Datos:** Supabase (PostgreSQL).
*   **Almacenamiento de Archivos:** Supabase Storage (para fotos).

## 2. Ambientes de Despliegue
Contamos con dos ambientes separados, definidos en el archivo `render.yaml`:
*   **Stage (Pruebas):** Se actualiza automáticamente cuando el código pasa las pruebas en la rama `main`. (Servicios: `ayni-api-stage`, `ayni-web-stage`).
*   **Production (Producción):** Requiere aprobación manual desde GitHub (Human-in-the-loop) antes de desplegarse a los usuarios reales. (Servicios: `ayni-api-prod`, `ayni-web-prod`).

## 3. Flujo CI/CD (GitHub Actions)
1. El desarrollador trabaja en una rama propia y abre un Pull Request hacia `main`.
2. GitHub Actions ejecuta build, lint, pruebas unitarias/de integración y los controles de seguridad enumerados abajo.
3. Los escáneres Trivy fallan con vulnerabilidades de severidad alta/crítica (para imagen, solo CVE con corrección disponible). El PR solo se debe poder fusionar cuando pasen los checks requeridos por el ruleset de `main`.
4. Tras el merge, el pipeline llama a los **Deploy Hooks** de Render para actualizar Stage.
5. Para pasar a Producción, un administrador (DevOps/QA) debe aprobar el despliegue manualmente en GitHub Environments.

### Controles de seguridad y evidencias

| Control | Herramienta / alcance | Criterio de fallo | Evidencia en GitHub |
|---|---|---|---|
| Secretos en el historial | Gitleaks, historial completo del PR | Se detecta un secreto | Check `Seguridad` |
| Dependencias Python | pip-audit sobre `backend/uv.lock` exportado | Vulnerabilidad conocida | Check `Seguridad` |
| Dependencias JavaScript | `npm audit` sobre el lockfile | Vulnerabilidad alta o crítica | Check `Seguridad` |
| Dependencias añadidas | Dependency Review en cada PR | Vulnerabilidad alta o crítica en dependencias del cambio | Check `Revisar dependencias nuevas del PR` |
| Análisis estático (SAST) | CodeQL, Python, JavaScript/TypeScript y GitHub Actions | Error del análisis; los hallazgos se publican en Code Scanning | Checks `CodeQL (...)` y alertas en Security → Code scanning |
| Dockerfile y Compose (IaC) | Trivy, escáner `misconfig` | Configuración de severidad alta/crítica | Check `Seguridad de IaC (Trivy)` y artefacto JSON |
| Imagen del backend | Trivy sobre la imagen construida desde `backend/Dockerfile` | CVE alta/crítica con arreglo disponible | Check `Seguridad de imagen backend (Trivy)` y artefacto JSON |

Los dos artefactos JSON de Trivy se conservan durante 14 días, incluso si el escaneo falla, para que el equipo pueda revisar y corregir los hallazgos. `ignore-unfixed` evita bloquear el despliegue por CVE para las que el proveedor aún no publica una corrección; no desactiva el escaneo. El check `Seguridad` es un agregador: falla si falla cualquiera de los análisis, CodeQL, las regresiones de seguridad o la revisión de dependencias en un PR.

**Protección de merge:** el ruleset activo de `main` ya exige `Backend (build y tests)`, `Frontend (build y tests)` y `Seguridad`. Como `Seguridad` agrega los escaneos, una vulnerabilidad alta/crítica detectada por Trivy, Gitleaks o las auditorías de dependencias hace fallar el check requerido y bloquea el merge. Para bloquear también alertas SAST de CodeQL por severidad, se debe habilitar adicionalmente la regla “Require code scanning results” en el ruleset y marcar CodeQL como herramienta requerida; los findings se pueden consultar en Security → Code scanning.

### Comprobarlo localmente

```powershell
# Análisis estático de seguridad en CI: CodeQL. Para probar localmente la imagen:
docker build -t ayni-api:local ./backend
docker save -o ayni-api-local.tar ayni-api:local
docker run --rm -v "${PWD}:/work" aquasec/trivy:0.70.0 image --input /work/ayni-api-local.tar --scanners vuln --vuln-type os,library --severity HIGH,CRITICAL --ignore-unfixed
Remove-Item ayni-api-local.tar

# Revisar configuración del Dockerfile y Compose:
docker run --rm -v "${PWD}:/work" aquasec/trivy:0.70.0 fs --scanners misconfig --severity HIGH,CRITICAL /work
```

El backend también tiene pruebas de regresión para secretos, credenciales, JWT y CORS. Se ejecutan en el check `Regresiones de seguridad (backend)`.

## 4. Seguridad y Variables de Entorno
*   Las credenciales (como `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) **nunca** se suben al repositorio.
*   Se configuran como variables de entorno seguras en el panel de Render.
*   Los Deploy Hooks de Render se guardan como **Repository Secrets** en GitHub.
