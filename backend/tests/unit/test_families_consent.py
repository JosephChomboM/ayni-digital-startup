from app.modules.families.consent import CONSENT_TEXT, CONSENT_TEXT_VERSION, ONBOARDING_NOTICE


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
