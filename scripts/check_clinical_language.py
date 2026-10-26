"""Fails if user-facing frontend text uses clinical or diagnostic language.

Ayni is not a health service (CLAUDE.md). The two mandatory disclaimers are allowed.
"""

import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCAN_DIRS = [ROOT / "frontend" / "src"]
EXTENSIONS = {".ts", ".tsx", ".json", ".html", ".md"}

FORBIDDEN = [
    r"diagnostic\w*",
    r"diagnosis",
    r"tratamiento\w*",
    r"terapia\w*",
    r"terapeutic\w*",
    r"mejora(r|ra)? su memoria",
    r"detecta(r)? (la )?demencia",
    r"cura(r)?\b",
]

ALLOWED_PHRASES = [
    "esto no es un diagnostico. es un registro de actividades familiares.",
    "si tu familiar tiene un diagnostico de demencia, consulta con su medico antes de empezar.",
]


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in text if not unicodedata.combining(c))


def scan() -> list[str]:
    pattern = re.compile(r"\b(" + "|".join(FORBIDDEN) + r")")
    found: list[str] = []
    for base in SCAN_DIRS:
        for path in sorted(base.rglob("*")):
            if path.suffix not in EXTENSIONS or ".test." in path.name:
                continue
            for lineno, line in enumerate(path.read_text().splitlines(), start=1):
                clean = normalize(line)
                for phrase in ALLOWED_PHRASES:
                    clean = clean.replace(phrase, "")
                if match := pattern.search(clean):
                    found.append(f"{path.relative_to(ROOT)}:{lineno}: '{match.group(0)}'")
    return found


if __name__ == "__main__":
    problems = scan()
    if problems:
        print("Lenguaje clínico en texto de la UI (usa 'actividad', 'sesión', 'registro'):")
    print("\n".join(problems) or "OK: sin lenguaje clínico en la UI.")
    sys.exit(1 if problems else 0)
