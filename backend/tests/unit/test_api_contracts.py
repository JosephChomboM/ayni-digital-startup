from app.main import app


def test_openapi_exposes_the_implemented_family_and_memory_contracts() -> None:
    paths = app.openapi()["paths"]

    assert {"get", "post"} <= paths["/memories"].keys()
    assert {"get", "patch", "delete"} <= paths["/memories/{memory_id}"].keys()
    assert "get" in paths["/families/me/elder-profile"]
    assert "put" in paths["/families/me/elder-profile"]


def test_openapi_does_not_advertise_unimplemented_memory_or_session_routes() -> None:
    paths = app.openapi()["paths"]

    assert "/memories/anecdote" not in paths
    assert "/memories/song" not in paths
    assert "/memories/photo" not in paths
    assert "/sessions/generate" not in paths
