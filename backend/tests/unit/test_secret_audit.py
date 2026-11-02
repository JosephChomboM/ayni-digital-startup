"""
Prueba Unitaria de Seguridad (AYNI-35).

Este módulo contiene una prueba estática encargada de auditar el código fuente
del backend en busca de credenciales, contraseñas o claves de API escritas
directamente en el código (hardcoded).

Criterio de aceptación validado:
- Verificar variables y secretos fuera del código.
"""

import os
import re


def test_no_hardcoded_secrets():
    """
    Escanea todos los archivos .py dentro de la carpeta 'app' buscando
    asignaciones directas de contraseñas o tokens.
    """
    # Se obtiene la ruta absoluta a la carpeta 'app'
    app_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "app"))

    # Patrones regulares para detectar posibles secretos hardcodeados
    patterns = [
        r'password\s*=\s*["\'][^"\']+["\']',
        r'api_key\s*=\s*["\'][^"\']+["\']',
        r'secret\s*=\s*["\'][^"\']+["\']',
        r'supabase_key\s*=\s*["\'][^"\']+["\']',
    ]

    found_secrets = []

    # Recorrido recursivo de los archivos Python
    for root, _, files in os.walk(app_dir):
        for file in files:
            if file.endswith(".py"):
                filepath = os.path.join(root, file)
                # Se eliminó el 'r' de open() por recomendación de ruff
                with open(filepath, encoding="utf-8") as f:
                    content = f.read()
                    for pattern in patterns:
                        matches = re.findall(pattern, content, re.IGNORECASE)
                        if matches:
                            found_secrets.append((filepath, matches))

    # La prueba falla si se encuentra al menos un secreto (Línea dividida)
    assert not found_secrets, (
        f"ALERTA DE SEGURIDAD: Se encontraron secretos hardcodeados en: {found_secrets}"
    )
    print("AYNI-35: No se encontraron secretos hardcodeados en el código.")