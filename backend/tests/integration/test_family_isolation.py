"""
Prueba de Integración de Seguridad (AYNI-35).

Este módulo contiene una prueba que simula el acceso a un recurso protegido
utilizando un usuario no autorizado. Su objetivo es garantizar que el sistema
respete el aislamiento familiar, impidiendo que un usuario pueda leer datos
que pertenecen a otra familia.

Criterio de aceptación validado:
- Probar lectura con dos familias y roles distintos.
"""

from types import SimpleNamespace
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.db import engine
from app.core.security import create_access_token
from app.main import app
from app.modules.families.service import FamiliesService
from app.modules.memories.schemas import AnecdoteCreateRequest
from app.modules.memories.service import MemoriesService

pytestmark = [
    pytest.mark.integration,
    pytest.mark.usefixtures("isolated_security_environment"),
]


def test_family_isolation_access(
    family_member: SimpleNamespace,
    other_caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
) -> None:
    # Give family B its own profile so a missing profile cannot explain the 404.
    with Session(engine) as session:
        FamiliesService(session).save_elder_profile(
            other_caregiver_account.user_id,
            name="Perfil de prueba",
            birth_decade=1950,
            interests=[],
        )

    # Create an existing memory authored by a family member from family A.
    with Session(engine) as session:
        memory = MemoriesService(session).create_memory(
            family_member.user_id,
            AnecdoteCreateRequest(
                type="anecdote",
                title="Recuerdo de prueba",
                text="Compartimos una actividad en familia.",
            ),
        )

    assert memory.elder_profile_id == memory_profile_id
    assert family_member.family_id != other_caregiver_account.family_id

    with TestClient(app) as client:
        # The author from family A can read the existing memory.
        own_response = client.get(
            f"/memories/{memory.id}",
            headers={"Authorization": (f"Bearer {create_access_token(family_member.user_id)}")},
        )
        assert own_response.status_code == 200
        assert own_response.json()["id"] == str(memory.id)

        # A primary caregiver from family B cannot read family A's memory.
        foreign_response = client.get(
            f"/memories/{memory.id}",
            headers={
                "Authorization": (f"Bearer {create_access_token(other_caregiver_account.user_id)}")
            },
        )
        assert foreign_response.status_code == 404
        assert foreign_response.json()["detail"]["code"] == "memory_not_found"
