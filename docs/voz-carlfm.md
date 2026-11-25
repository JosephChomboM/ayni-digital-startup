# Voz carlfm de AYNI

La sesión y su despedida usan Piper con `es_ES-carlfm-x_low` (español de España).
El texto se convierte en audio dentro del backend: no llama a Groq ni a una API
de voz de pago. La descarga del modelo ocurre al construir la imagen Docker,
no en cada conversación. No requiere nuevas claves ni variables en Render.

Para preparar el backend local, desde `backend`:

```powershell
uv sync
uv run python scripts/download_voice.py
```

Después, iniciar la API y el frontend con los comandos habituales. Iniciar una
guía y activar el sonido. Si el navegador bloquea la reproducción automática,
desactivar y activar el botón de sonido. Si Piper falla o está ocupado, se intenta
la voz local disponible del navegador; los mensajes escritos permanecen visibles.
Silenciar, pausar, cambiar de respuesta, ocultar la pestaña o salir detiene el audio.

El modelo (28 MB) y los audios de prueba no se suben a Git. El descargador fija
la revisión del repositorio de voces y verifica SHA-256. Las peticiones requieren
autenticación y acceso a la sesión, admiten hasta 400 caracteres y generan WAV
sin almacenamiento ni caché compartida. Una sola síntesis se ejecuta a la vez.
El servidor utiliza CPU y memoria del hosting; no se garantiza capacidad para
múltiples conversaciones simultáneas en un plan gratuito.

Fuentes y atribución:

- Modelo carlfm: https://huggingface.co/rhasspy/piper-voices/tree/main/es/es_ES/carlfm/x_low
- La ficha del modelo atribuye el conjunto de voz a carlfm y declara dominio público:
  https://huggingface.co/rhasspy/piper-voices/raw/main/es/es_ES/carlfm/x_low/MODEL_CARD
- Motor Piper 1.4.1, GPL-3.0: https://github.com/OHF-Voice/piper1-gpl
  Se conserva su licencia mediante el paquete instalado. Al distribuir el programa,
  conservar las licencias y atender las condiciones de distribución del motor.
