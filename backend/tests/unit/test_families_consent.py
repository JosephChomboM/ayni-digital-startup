from app.modules.families.consent import CONSENT_TEXT, CONSENT_TEXT_VERSION, ONBOARDING_NOTICE
from app.modules.families.service import FamiliesService


def test_consent_constants_preserve_approved_texts() -> None:
    assert CONSENT_TEXT_VERSION == "1.0"
    assert CONSENT_TEXT == (
        "Acepto que Ayni guarde y use los datos que comparto para organizar "
        "actividades familiares. Entiendo que estos datos se almacenan fuera del "
        "Perú, en Estados Unidos, mediante Supabase y Render."
    )
    assert ONBOARDING_NOTICE == (
        "Ayni no es un servicio de salud. Si tu familiar tiene un diagnóstico de demencia, "
        "consulta con su médico antes de empezar."
    )


def test_consent_service_returns_texts_without_personal_data() -> None:
    assert FamiliesService.get_consent_text().model_dump() == {
        "text_version": "1.0",
        "text": CONSENT_TEXT,
        "onboarding_notice": ONBOARDING_NOTICE,
    }
