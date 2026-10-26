"""Fails if a business module imports another module's internals.

Rule (CLAUDE.md): a module may only use another module through
`app.modules.<other>.service`, never its models, repository, schemas or router.
"""

import ast
import sys
from pathlib import Path

MODULES_DIR = Path(__file__).resolve().parents[1] / "backend" / "app" / "modules"
PUBLIC = "service"


def imported_names(tree: ast.AST) -> list[tuple[int, str]]:
    names: list[tuple[int, str]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            names += [(node.lineno, alias.name) for alias in node.names]
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            names.append((node.lineno, node.module))
            # `from app.modules.x import models` imports a submodule too
            names += [(node.lineno, f"{node.module}.{alias.name}") for alias in node.names]
    return names


def violations() -> list[str]:
    found: list[str] = []
    for path in sorted(MODULES_DIR.glob("*/**/*.py")):
        owner = path.relative_to(MODULES_DIR).parts[0]
        for lineno, name in imported_names(ast.parse(path.read_text(), filename=str(path))):
            parts = name.split(".")
            if parts[:2] != ["app", "modules"] or len(parts) < 4:
                continue
            other, submodule = parts[2], parts[3]
            message = f"{path}:{lineno}: '{owner}' importa '{other}.{submodule}' (usa {other}.service)"
            if other != owner and submodule != PUBLIC and message not in found:
                found.append(message)
    return found


if __name__ == "__main__":
    problems = violations()
    print("\n".join(problems) or "OK: ningún módulo importa internals de otro.")
    sys.exit(1 if problems else 0)
