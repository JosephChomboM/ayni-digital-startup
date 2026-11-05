from app.core.errors import ApplicationError


class BillingError(ApplicationError):
    """A public error raised by billing."""


def provider_unavailable() -> BillingError:
    return BillingError(
        code="payment_provider_unavailable",
        message="No pudimos conectar con los pagos de prueba. Inténtalo de nuevo.",
        status_code=503,
    )
