"""AYNI-68: prueba real con familias ficticias; elimina solo lo que crea."""

import argparse
import base64
import json
import secrets
import time
from io import BytesIO
from urllib.parse import unquote, urlsplit
from uuid import uuid4

import httpx
from PIL import Image

from app.modules.memories.photo_settings import get_photo_storage_settings


def check(condition: bool) -> None:
    if not condition:
        raise RuntimeError("Fallo en control de privacidad o eliminacion.")


def run(base_url: str) -> None:
    if base_url not in {
        "http://127.0.0.1:8000",
        "http://localhost:8000",
        "https://ayni-api-stage.onrender.com",
    }:
        raise ValueError("Usa exclusivamente localhost o Stage; producción no está permitida.")
    prefix = "qa-ayni68-" + uuid4().hex[:10]
    password = secrets.token_urlsafe(20)
    accounts = []
    image = BytesIO()
    Image.new("RGB", (32, 32), "green").save(image, format="PNG")
    with httpx.Client(base_url=base_url, timeout=60) as api, httpx.Client(timeout=30) as storage:

        def request(method, path, token=None, expected=200, **kwargs):
            headers = {"Authorization": "Bearer " + token} if token else {}
            response = api.request(method, path, headers=headers, **kwargs)
            if response.status_code != expected:
                raise RuntimeError(
                    f"{method} {path}: HTTP {response.status_code}; esperado {expected}"
                )
            return response.json() if response.content else None

        consent = request("GET", "/auth/consent")["text_version"]

        def account(suffix, invitation=None):
            email = f"{prefix}-{suffix}@example.com"
            body = {
                "email": email,
                "name": "Cuenta ficticia QA",
                "password": password,
                "consent": {"accepted": True, "text_version": consent},
            }
            body.update(
                {"invitation_token": invitation}
                if invitation
                else {"family_name": "Familia ficticia QA"}
            )
            request("POST", "/auth/register", expected=201, json=body)
            token = request("POST", "/auth/login", json={"email": email, "password": password})[
                "access_token"
            ]
            accounts.append(token)
            if not invitation:
                request(
                    "PUT",
                    "/families/me/elder-profile",
                    token,
                    json={"name": "Perfil ficticio QA", "birth_decade": 1950, "interests": []},
                )
            return token

        def photo(token):
            memory = request(
                "POST",
                "/memories",
                token,
                expected=201,
                json={
                    "type": "anecdote",
                    "title": "Imagen sintética QA",
                    "text": "Un paseo ficticio.",
                    "is_positive": True,
                },
            )
            path = f"/memories/{memory['id']}/photos"
            saved = request(
                "POST",
                path,
                token,
                expected=201,
                files={"file": ("sintetica.png", image.getvalue(), "image/png")},
            )
            check(storage.get(saved["url"]).status_code == 200)
            return path, saved

        def removed(url):
            deadline = time.monotonic() + 315
            while (
                storage.get(
                    url + "&qa=" + uuid4().hex, headers={"Cache-Control": "no-cache"}
                ).status_code
                == 200
            ):
                check(time.monotonic() < deadline)
                print(
                    "Esperando caducidad de una copia firmada en caché (máximo 5 minutos)…",
                    flush=True,
                )
                time.sleep(10)

        def deleted(url):
            parsed_url = urlsplit(url)
            object_path = unquote(parsed_url.path.split("/storage/v1/object/sign/", 1)[1])
            response = storage.post(
                settings.supabase_url.rstrip("/") + "/storage/v1/object/sign/" + object_path,
                headers={"Authorization": "Bearer " + key, "apikey": key},
                json={"expiresIn": 1},
            )
            check(response.status_code in {400, 404})
            removed(url)

        try:
            a, b = account("a"), account("b")
            invitation = request(
                "POST",
                "/families/me/invitations",
                a,
                expected=201,
                json={"email": f"{prefix}-member@example.com"},
            )
            member = account("member", invitation["invitation_token"])
            pa, sa = photo(a)
            pb, sb = photo(b)
            pm, sm = photo(member)
            request("GET", pa, b, expected=404)
            request("DELETE", pa + "/" + sa["id"], b, expected=404)
            check(request("GET", pa, member)["total"] == 1)
            parsed = urlsplit(sa["url"])
            token_payload = sa["url"].split("token=", 1)[1].split("&", 1)[0].split(".")[1]
            claims = json.loads(
                base64.urlsafe_b64decode(token_payload + "=" * (-len(token_payload) % 4))
            )
            check(0 < claims["exp"] - claims["iat"] <= 300)
            public_url = parsed._replace(
                path=parsed.path.replace("/object/sign/", "/object/public/"), query=""
            ).geturl()
            check(storage.get(public_url).status_code != 200)
            print("OK: dos familias, acceso familiar, rechazo ajeno y bucket privado", flush=True)

            # Una firma corta comprueba caducidad real sin esperar los cinco minutos de la API.
            settings = get_photo_storage_settings()
            settings.require()
            check(urlsplit(settings.supabase_url).netloc == parsed.netloc)
            key = settings.supabase_service_role_key.get_secret_value()
            object_path = unquote(parsed.path.split("/storage/v1/object/sign/", 1)[1])
            signed = storage.post(
                settings.supabase_url.rstrip("/") + "/storage/v1/object/sign/" + object_path,
                headers={"Authorization": "Bearer " + key, "apikey": key},
                json={"expiresIn": 10},
            )
            check(signed.status_code == 200)
            short_url = (
                settings.supabase_url.rstrip("/") + "/storage/v1" + signed.json()["signedURL"]
            )
            check(storage.get(short_url).status_code == 200)
            time.sleep(12)
            removed(short_url)
            print("OK: URL firmada válida y rechazada después de vencer", flush=True)

            request(
                "DELETE",
                "/users/me",
                member,
                expected=204,
                json={"password": password, "confirmation": "ELIMINAR"},
            )
            accounts.remove(member)
            request("GET", "/users/me", member, expected=401)
            request("GET", pm, a, expected=404)
            deleted(sm["url"])
            check(request("GET", pa, a)["total"] == 1)
            check(request("GET", pb, b)["total"] == 1)
            print(
                "OK: borrar familiar elimina sus fotos y revoca token; conserva las ajenas",
                flush=True,
            )
            request(
                "DELETE",
                "/users/me",
                a,
                expected=204,
                json={"password": password, "confirmation": "ELIMINAR"},
            )
            accounts.remove(a)
            request("GET", "/users/me", a, expected=401)
            deleted(sa["url"])
            check(request("GET", pb, b)["total"] == 1)
            print("OK: borrar cuidador elimina su familia; conserva la otra familia", flush=True)
        finally:
            for token in reversed(accounts):
                request(
                    "DELETE",
                    "/users/me",
                    token,
                    expected=204,
                    json={"password": password, "confirmation": "ELIMINAR"},
                )
        print("AYNI-68 OK: cuentas ficticias y archivos de prueba eliminados", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True)
    run(parser.parse_args().base_url.rstrip("/"))
