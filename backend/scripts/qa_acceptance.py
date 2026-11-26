"""AYNI-33: aceptación real por HTTP; solo crea y elimina familias sintéticas."""

import argparse
import json
import secrets
from uuid import uuid4

import httpx

ALLOWED = {"http://127.0.0.1:8000", "http://localhost:8000", "https://ayni-api-stage.onrender.com"}


def run(api: httpx.Client) -> list[str]:
    passed: list[str] = []
    accounts: list[str] = []
    password = secrets.token_urlsafe(24)
    prefix = "qa-ayni33-" + uuid4().hex[:12]

    def call(method: str, path: str, token: str = "", expected: int = 200, **kwargs):
        response = api.request(
            method, path, headers={"Authorization": "Bearer " + token} if token else {}, **kwargs
        )
        if response.status_code != expected:
            raise RuntimeError(
                f"{method} {path.split('?')[0]}: HTTP {response.status_code}, esperado {expected}"
            )
        return response.json() if response.content else None

    try:
        consent = call("GET", "/auth/consent")["text_version"]
        for suffix in ("a", "b"):
            email = f"{prefix}-{suffix}@example.com"
            call(
                "POST",
                "/auth/register",
                expected=201,
                json={
                    "email": email,
                    "password": password,
                    "name": "Cuenta ficticia QA",
                    "family_name": "Familia ficticia QA",
                    "consent": {"accepted": True, "text_version": consent},
                },
            )
            token = call("POST", "/auth/login", json={"email": email, "password": password})[
                "access_token"
            ]
            accounts.append(token)
            call(
                "PUT",
                "/families/me/elder-profile",
                token,
                json={"name": "Perfil ficticio", "birth_decade": 1950, "interests": []},
            )
            call("POST", "/sessions/generate", token, expected=409, json={})
        passed.append("Registro, login y perfil de dos familias; guía vacía rechazada")
        a, b = accounts
        ids = []
        for title, positive, sensitive in [
            ("Paseo positivo", True, False),
            ("Sin confirmar", False, False),
            ("Tema delicado", True, True),
        ]:
            item = call(
                "POST",
                "/memories",
                a,
                expected=201,
                json={
                    "type": "anecdote",
                    "title": title,
                    "text": "Un paseo ficticio por el parque.",
                    "is_positive": positive,
                    "is_sensitive": sensitive,
                },
            )
            ids.append(item["id"])
        call("GET", f"/memories/{ids[0]}", b, expected=404)
        for excluded in ids[1:]:
            call("POST", "/sessions/generate", a, expected=409, json={"memory_id": excluded})
        guide = call("POST", "/sessions/generate", a, expected=201, json={"memory_id": ids[0]})
        selected = {step["memory_id"] for step in guide["steps"] if step["memory_available"]}
        if selected != {ids[0]}:
            raise RuntimeError("La guía incluyó contenido no autorizado")
        passed.append(
            "Guía persistida: solo el recuerdo positivo; sensibles y no positivos excluidos"
        )
        path = "/sessions/" + guide["id"]
        call("GET", path, a)
        call("GET", path, b, expected=404)
        call("GET", path, expected=401)
        reaction = call("POST", path + "/response", a, expected=201, json={"reaction": "receptivo"})
        repeated = call("POST", path + "/response", a, json={"reaction": "receptivo"})
        if repeated["id"] != reaction["id"]:
            raise RuntimeError("La reacción se duplicó")
        call("GET", path + "/response", b, expected=404)
        restored = call("GET", path + "/response", a)
        page = call("GET", "/sessions?limit=10&offset=0", a)
        if restored["id"] != reaction["id"] or not any(
            item["id"] == guide["id"] for item in page["items"]
        ):
            raise RuntimeError("La recarga no recuperó la guía o su reacción")
        insights = call("GET", "/insights/reactions", a)
        if not insights["history"]:
            raise RuntimeError("El seguimiento no recuperó la reacción")
        passed.append(
            "Reacción real, reintento sin duplicados, historial y aislamiento entre familias"
        )
        return passed
    finally:
        failures = 0
        for token in reversed(accounts):
            try:
                call(
                    "DELETE",
                    "/users/me",
                    token,
                    expected=204,
                    json={"password": password, "confirmation": "ELIMINAR"},
                )
            except (httpx.HTTPError, RuntimeError):
                failures += 1
        if failures:
            raise RuntimeError(
                f"No se pudieron limpiar {failures} cuentas ficticias; prefijo {prefix}"
            )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True, choices=sorted(ALLOWED))
    args = parser.parse_args()
    with httpx.Client(base_url=args.base_url, timeout=90) as client:
        checks = run(client)
    print(
        json.dumps(
            {"environment": args.base_url, "passed": checks, "cleanup": "ok"},
            ensure_ascii=False,
            indent=2,
        )
    )
