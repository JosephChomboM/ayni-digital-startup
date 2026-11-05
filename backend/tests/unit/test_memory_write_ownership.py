import pytest
from pydantic import ValidationError

from app.modules.memories.schemas import AnecdoteCreateRequest


def test_memory_contract_does_not_accept_client_owned_family_or_author() -> None:
    with pytest.raises(ValidationError):
        AnecdoteCreateRequest.model_validate(
            {
                "type": "anecdote",
                "title": "Paseo",
                "text": "Un paseo familiar.",
                "family_id": "00000000-0000-0000-0000-000000000001",
                "created_by": "00000000-0000-0000-0000-000000000002",
            }
        )
