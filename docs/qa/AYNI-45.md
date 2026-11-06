# AYNI-45 — Prueba real de fotos en Supabase Storage

Fecha: **5 de noviembre de 2026**, America/Lima.
Rama: `hats/ayni-45-fotos-privadas`.

## Entorno y alcance

- API de FastAPI ejecutada mediante TestClient con el adaptador real de Supabase, sin simular Storage.
- PostgreSQL local dedicado (`ayni_families_test`, puerto 55432).
- Proyecto de Supabase indicado por el equipo y bucket `fotos` ya existente.
- Clave de servicio recibida por entrada oculta y mantenida únicamente en el entorno del proceso.
  No se escribió en archivos, código, logs ni commits.
- Dos familias ficticias creadas solo en la base local; no se conectó a PostgreSQL de Supabase.
- Imágenes sintéticas de 320 × 180 píxeles, sin fotografías de personas reales.

## Resultados observados

| Comprobación | Resultado |
|---|---|
| Bucket `fotos` | Privado, límite 8388608 bytes y tipos image/jpeg, image/png e image/webp |
| POST de foto PNG | HTTP 201; descarga firmada HTTP 200, Content-Type image/png |
| POST de foto JPEG | HTTP 201; descarga firmada HTTP 200, Content-Type image/jpeg |
| POST de foto WebP | HTTP 201; descarga firmada HTTP 200, Content-Type image/webp |
| Imágenes descargadas | Dimensiones correctas y metadatos EXIF retirados en los tres formatos |
| Acceso por URL pública | HTTP 400 en los tres formatos; sin acceso al archivo |
| GET de fotos del recuerdo | HTTP 200; tres registros con enlaces firmados |
| Consulta desde otra familia | HTTP 404 |
| DELETE de una foto | HTTP 204; quedan dos registros y dos objetos |
| DELETE del recuerdo | HTTP 204; se retiran también los dos objetos restantes |
| Limpieza final | Ningún objeto de esta prueba quedó en el bucket; las dos familias ficticias se borraron de la base local |

Se completaron **16 comprobaciones**, contando por separado los tres formatos,
sus descargas, metadatos y rechazos de acceso público. Todas pasaron.

## Límites de esta evidencia

La prueba confirma la integración del backend local con Supabase Storage real.
No acredita un despliegue del código de fotos en Render, ni la integración de la web,
ni el recorrido desde dos dispositivos. El frontend todavía usa IndexedDB para sus fotos;
debe conectarse a los endpoints documentados en [PHOTOS.md](../PHOTOS.md).

Las pruebas automatizadas del repositorio usan Storage simulado para ser independientes
de claves y servicios externos en CI. Sus resultados se registran aparte de esta prueba real.
