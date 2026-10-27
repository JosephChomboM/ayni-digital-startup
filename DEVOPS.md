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
1. Un desarrollador sube código a una rama `feature/` y abre un Pull Request.
2. GitHub Actions ejecuta el pipeline de Integración Continua (CI):
   *   Pruebas del Backend (Python/FastAPI).
   *   Pruebas del Frontend (React).
   *   Análisis de seguridad (Gitleaks, pip-audit).
3. Si todo está en verde, el PR se fusiona a `main`.
4. El pipeline de Despliegue Continuo (CD) llama a los **Deploy Hooks** de Render para actualizar Stage.
5. Para pasar a Producción, un administrador (DevOps/QA) debe aprobar el despliegue manualmente en GitHub Environments.

## 4. Seguridad y Variables de Entorno
*   Las credenciales (como `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) **nunca** se suben al repositorio.
*   Se configuran como variables de entorno seguras en el panel de Render.
*   Los Deploy Hooks de Render se guardan como **Repository Secrets** en GitHub.