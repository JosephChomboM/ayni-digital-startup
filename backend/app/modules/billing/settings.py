from functools import lru_cache
from urllib.parse import urlsplit

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.modules.billing.errors import BillingError


class BillingSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    stripe_secret_key: SecretStr = SecretStr("")
    stripe_webhook_secret: SecretStr = SecretStr("")
    stripe_price_id: str = ""
    billing_success_url: str = ""
    billing_cancel_url: str = ""

    def require(self, *, checkout: bool = False, webhook: bool = False) -> None:
        ready = self.stripe_secret_key.get_secret_value().startswith("sk_test_")
        if checkout:
            ready = ready and self.stripe_price_id.startswith("price_")
            for value in (self.billing_success_url, self.billing_cancel_url):
                url = urlsplit(value)
                ready = ready and bool(url.netloc) and not url.username and not url.password
                ready = ready and (
                    url.scheme == "https"
                    or (url.scheme == "http" and url.hostname in {"localhost", "127.0.0.1"})
                )
        if webhook:
            ready = ready and self.stripe_webhook_secret.get_secret_value().startswith("whsec_")
        if not ready:
            raise BillingError(
                code="billing_not_configured",
                message="Los pagos de prueba todavía no están disponibles.",
                status_code=503,
            )


@lru_cache
def get_billing_settings() -> BillingSettings:
    return BillingSettings()
