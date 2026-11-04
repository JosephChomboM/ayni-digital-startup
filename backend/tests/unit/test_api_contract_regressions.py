from app.main import app


def test_documented_family_and_memory_routes_remain_in_openapi() -> None:
    schema = app.openapi()
    routes = {
        ("/auth/register", "post", "201"),
        ("/auth/login", "post", "200"),
        ("/users/me", "get", "200"),
        ("/families/me/elder-profile", "get", "200"),
        ("/families/me/invitations", "post", "201"),
        ("/memories", "post", "201"),
        ("/memories", "get", "200"),
        ("/memories/{memory_id}", "patch", "200"),
        ("/memories/{memory_id}", "delete", "204"),
    }

    for path, method, status in routes:
        assert status in schema["paths"][path][method]["responses"]
