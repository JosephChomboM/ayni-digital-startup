import os
import secrets
from collections.abc import Iterator
from pathlib import Path

import pytest

# Set this before pytest imports the app; never reuse a developer's real key.
os.environ["JWT_SECRET"] = secrets.token_hex(32)


@pytest.fixture
def isolated_security_environment(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> Iterator[None]:
    from app.core.security_settings import get_security_settings

    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", raising=False)
    monkeypatch.delenv("INVITATION_EXPIRE_HOURS", raising=False)
    get_security_settings.cache_clear()
    yield
    get_security_settings.cache_clear()
