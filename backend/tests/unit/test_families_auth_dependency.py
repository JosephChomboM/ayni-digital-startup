from typing import Annotated
from uuid import UUID, uuid4

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.core.error_handlers import register_error_handlers
from app.core.security import create_access_token
from app.modules.families.service import get_authenticated_user_id

pytestmark = pytest.mark.usefixtures("isolated_security_environment")


@pytest.fixture
def client() -> TestClient:
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/identity")
    def identity(user_id: Annotated[UUID, Depends(get_authenticated_user_id)]) -> dict[str, UUID]:
        return {"id": user_id}

    return TestClient(app)


def test_other_router_can_use_public_families_dependency(client: TestClient) -> None:
    user_id = uuid4()
    response = client.get(
        "/identity", headers={"Authorization": f"Bearer {create_access_token(user_id)}"}
    )
    assert response.status_code == 200
    assert response.json() == {"id": str(user_id)}


@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer invalid"}])
def test_shared_dependency_rejects_missing_or_invalid_token(
    client: TestClient, headers: dict[str, str]
) -> None:
    response = client.get("/identity", headers=headers)
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert response.json()["detail"]["code"] == "unauthorized"
    assert set(response.json()["detail"]) == {"code", "message"}
