import json
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import jwt
import pytest
import requests
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
from pydantic import SecretStr

from app.core.errors import ApplicationError
from app.modules.families import google_identity


@pytest.fixture
def provider(monkeypatch: pytest.MonkeyPatch):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    now = datetime.now(UTC)
    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "synthetic-google")])
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(subject)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(minutes=1))
        .not_valid_after(now + timedelta(days=1))
        .sign(key, hashes.SHA256())
    )
    pem = cert.public_bytes(serialization.Encoding.PEM).decode()
    calls = []

    def transport(**kwargs):
        calls.append(kwargs)
        assert kwargs["url"] == "https://www.googleapis.com/oauth2/v1/certs"
        assert kwargs["timeout"] == 5
        return SimpleNamespace(status=200, data=json.dumps({"synthetic-key": pem}).encode())

    monkeypatch.setattr(google_identity, "Request", lambda session: transport)
    monkeypatch.setattr(
        google_identity,
        "get_google_settings",
        lambda: google_identity.GoogleSettings(
            _env_file=None, google_client_id="ayni-test.apps.googleusercontent.com"
        ),
    )
    return SimpleNamespace(
        key=key,
        calls=calls,
        payload={
            "iss": "https://accounts.google.com",
            "aud": "ayni-test.apps.googleusercontent.com",
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=5)).timestamp()),
            "sub": "synthetic-subject",
            "email": "persona@example.com",
            "email_verified": True,
            "nonce": "synthetic-nonce",
        },
    )


def token(provider, **changes):
    return SecretStr(
        jwt.encode(
            {**provider.payload, **changes},
            provider.key,
            algorithm="RS256",
            headers={"kid": "synthetic-key"},
        )
    )


def test_verifier_checks_actual_rsa_signature_google_issuer_and_audience(provider) -> None:
    result = google_identity.GoogleIdentityVerifier().verify(token(provider))
    assert result.subject == "synthetic-subject" and result.email == "persona@example.com"
    assert result.nonce == "synthetic-nonce" and len(provider.calls) == 1


@pytest.mark.parametrize(
    "changes",
    [
        {"aud": "other.apps.googleusercontent.com"},
        {"iss": "https://example.com"},
        {"exp": 1},
        {"email_verified": False},
        {"nonce": ""},
        {"azp": "other.apps.googleusercontent.com"},
    ],
)
def test_verifier_rejects_invalid_claims(provider, changes) -> None:
    with pytest.raises(ApplicationError) as caught:
        google_identity.GoogleIdentityVerifier().verify(token(provider, **changes))
    assert caught.value.code == "invalid_google_credential" and caught.value.status_code == 401


def test_verifier_rejects_wrong_signing_key(provider) -> None:
    forged = jwt.encode(
        provider.payload,
        rsa.generate_private_key(public_exponent=65537, key_size=2048),
        algorithm="RS256",
        headers={"kid": "synthetic-key"},
    )
    with pytest.raises(ApplicationError) as caught:
        google_identity.GoogleIdentityVerifier().verify(SecretStr(forged))
    assert caught.value.code == "invalid_google_credential"


def test_verifier_reports_provider_timeout_without_credentials(provider, monkeypatch) -> None:
    def fail(**kwargs):
        raise requests.Timeout()

    monkeypatch.setattr(google_identity, "Request", lambda session: fail)
    with pytest.raises(ApplicationError) as caught:
        google_identity.GoogleIdentityVerifier().verify(token(provider))
    assert caught.value.code == "google_unavailable" and caught.value.status_code == 503
