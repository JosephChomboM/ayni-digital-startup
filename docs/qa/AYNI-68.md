# AYNI-68 — Validación del 12 de noviembre de 2026

Prueba real: `https://ayni-api-stage.onrender.com`, Storage Supabase real,
bucket privado `fotos`. Script preparado sobre la base local `e3bbdcd`.
No se acredita aquí un hash del despliegue de Stage; esa identificación corresponde
a AYNI-38. No se tocaron cuentas ni archivos de personas reales.

## Ejecución reproducible

Desde `backend`, con las variables de Storage del mismo proyecto de Stage:

```powershell
$env:PYTHONPATH='.'
uv run python scripts/qa_private_photos.py --base-url https://ayni-api-stage.onrender.com
```

El script solo permite localhost y Stage. Crea dos familias ficticias y un familiar
invitado, usa imágenes PNG generadas y elimina únicamente las cuentas que creó.
No imprime contraseñas, tokens, URLs firmadas ni claves de servicio.

## Resultados reales

- Carga y lectura firmada: correctas; otro contexto HTTP puede recuperar la foto.
- Lectura/borrado por otra familia: 404; lectura por familiar autorizado: correcta.
- URL pública: denegada. Firma emitida por API: duración máxima 300 segundos.
- Firma corta válida antes de vencer y denegada después de vencer.
- Borrar familiar: su recuerdo/foto desaparece y su token devuelve 401;
  fotos del cuidador y de la otra familia permanecen accesibles.
- Borrar cuidador: su familia y fotos desaparecen; otra familia permanece intacta.
- Firmar otra vez el objeto eliminado: denegado por Storage.
- Limpieza final de cuentas ficticias y archivos: correcta.

Una URL emitida antes del borrado siguió devolviendo una copia en caché
temporalmente. La prueba espera y verifica su rechazo posterior. Esto no significa
revocación instantánea de enlaces ya compartidos: su duración máxima es cinco
minutos. No se presenta una copia en caché como un archivo todavía en Storage.

La suite local con PostgreSQL y Storage simulado también comprobó fallos parciales
y reintentos de eliminación, permisos, imágenes y limpieza por rol: 30 pruebas
aprobadas de account_deletion, memory_photo_endpoints, memory_photo_models,
photo_storage y photo_images. Esas simulaciones se distinguen de la prueba real
anterior. Regresión completa: 643 pruebas backend y 130 frontend aprobadas.
