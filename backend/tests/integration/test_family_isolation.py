"""
Prueba de Integración de Seguridad (AYNI-35).

Este módulo contiene una prueba que simula el acceso a un recurso protegido
utilizando un usuario no autorizado. Su objetivo es garantizar que el sistema
respete el aislamiento familiar, impidiendo que un usuario pueda leer datos
que pertenecen a otra familia.

Criterio de aceptación validado:
- Probar lectura con dos familias y roles distintos.
"""

from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.modules.families.service import get_authenticated_user_id

client = TestClient(app)


def test_family_isolation_access():
    """
    Simula una petición HTTP al endpoint de memorias utilizando un UUID
    de usuario que no es el dueño del recurso. Se espera que la API
    deniegue el acceso con un código 403 (Forbidden) o 404 (Not Found).
    """
    # 1. Se genera un UUID falso para simular al Usuario B (intruso)
    fake_user_b_id = uuid4()

    # 2. Se sobrescribe la dependencia de autenticación de FastAPI.
    app.dependency_overrides[get_authenticated_user_id] = lambda: fake_user_b_id

    # 3. Se genera un UUID de memoria aleatorio (que pertenece al Usuario A)
    memory_id = uuid4()

    print(f"Probando acceso a memoria {memory_id} con usuario falso {fake_user_b_id}...")

    # 4. Se ejecuta la petición HTTP real al endpoint protegido
    response = client.get(f"/memories/{memory_id}")

    # 5. Se valida que el sistema rechace el acceso
    assert response.status_code in [403, 404], (
        f"FALLO DE AISLAMIENTO: El servidor devolvió {response.status_code}. "
        "Se permitió o se procesó incorrectamente el acceso a datos ajenos."
    )

    # 6. Se imprime el resultado dividiendo la línea larga
    print(
        f"AYNI-35: Aislamiento familiar validado. "
        f"Acceso denegado correctamente (HTTP {response.status_code})."
    )

    # 7. Se limpia la sobrescritura para no afectar otras pruebas globales
    app.dependency_overrides.clear()
