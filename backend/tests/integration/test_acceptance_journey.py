"""El mismo recorrido de Stage ejecutado contra PostgreSQL de pruebas, sin simular guías."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from scripts.qa_acceptance import run

pytestmark = [pytest.mark.integration, pytest.mark.usefixtures("isolated_security_environment")]


def test_two_families_complete_the_persisted_journey():
    with TestClient(app) as client:
        result = run(client)
    assert len(result) == 3
