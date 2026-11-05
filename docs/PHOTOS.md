# Fotos familiares privadas — contrato de backend

Tarea: [AYNI-45](https://damatmfr-1790533434032.atlassian.net/browse/AYNI-45).
Rama: `hats/ayni-45-fotos-privadas`. Implementado en esta rama; PR y despliegue pendientes.

## Alcance

Las fotos se adjuntan a un recuerdo existente, anécdota o canción. El título y las marcas
`is_positive` / `is_sensitive` corresponden al recuerdo. No se agrega otro tipo a POST /memories.
La familia se obtiene de la sesión y del perfil del recuerdo; el navegador no envía `family_id`.
Los bytes van a **Supabase Storage**, en un bucket privado; PostgreSQL guarda los metadatos.
No se guardan imágenes en el disco del servidor ni URLs públicas permanentes.

## Endpoints

Sin prefijo `/api`. Todos requieren `Authorization: Bearer <JWT de Ayni>`.

| Método y ruta | Permiso | Entrada | Salida |
|---|---|---|---|
| POST /memories/{memory_id}/photos | Autor del recuerdo o cuidador principal de la misma familia | Multipart, campo `file`; una foto por petición | 201, metadatos y URL firmada |
| GET /memories/{memory_id}/photos | Miembros de la misma familia | `limit` 1–100 (20 por defecto), `offset` >= 0 | 200, `items`, `total`, `limit`, `offset` |
| DELETE /memories/{memory_id}/photos/{photo_id} | Autor del recuerdo o cuidador principal de la misma familia | Sin cuerpo | 204, sin cuerpo |

Una foto de otra familia devuelve 404; la API no expone si existe allí.
Los miembros pueden consultar un recuerdo sensible mediante su ID, igual que GET /memories/{id}.
La galería general sigue excluyendo los recuerdos sensibles por defecto.

Respuesta individual:

```json
{
  "id": "UUID",
  "memory_id": "UUID",
  "created_by": "UUID",
  "content_type": "image/png",
  "size_bytes": 12345,
  "width": 800,
  "height": 600,
  "created_at": "2026-11-05T18:00:00Z",
  "url": "https://PROYECTO.supabase.co/storage/v1/object/sign/fotos/...?...",
  "url_expires_at": "2026-11-05T18:05:00Z"
}
```

Los UUID y el dominio anteriores son ejemplos. Las URLs duran **300 segundos**.
GET genera enlaces nuevos; no guardar esas URLs como identificadores permanentes.
La respuesta no incluye la clave de servicio, el nombre original, el bucket ni la ruta interna.

## Validaciones y límites

- JPG/JPEG, PNG o WebP estáticos; extensión, tipo declarado y contenido deben coincidir.
- Máximo **8 MiB** por foto y **20 millones de píxeles**.
- Se decodifica y vuelve a codificar la imagen, quitando EXIF, GPS y otros metadatos.
- La petición multipart completa tiene un margen de 64 KiB sobre el límite del archivo;
  se cuentan también los bytes recibidos cuando no se envía Content-Length.
- Plan gratis: **10 fotos por familia**, sumando todos sus recuerdos. Plan Familia:
  sin ese límite durante el periodo pagado vigente. La decisión pertenece a billing/service.py.
- Las rutas de Storage usan UUID generados en el servidor, sin nombres de personas ni archivos.
- Un bucket público se rechaza antes de subir o firmar sus objetos.

## Errores

Formato común: `{"detail":{"code":"...","message":"..."}}`.

| HTTP | code | Cuándo |
|---|---|---|
| 401 | unauthorized | Token ausente, inválido, vencido o cuenta inexistente |
| 403 | forbidden | Miembro que intenta gestionar un recuerdo ajeno de su familia |
| 404 | elder_profile_not_found | La familia todavía no tiene perfil |
| 404 | memory_not_found | Recuerdo inexistente o de otra familia |
| 404 | photo_not_found | La foto no pertenece al recuerdo solicitado |
| 409 | photo_limit_reached | La familia gratis ya tiene 10 fotos |
| 413 | photo_too_large | El archivo o la petición exceden el límite |
| 422 | photo_format_invalid | Archivo corrupto, formato, extensión o tipo inválidos |
| 422 | photo_dimensions_invalid | Imagen demasiado grande en píxeles |
| 422 | validation_error | UUID, paginación o campo file inválidos/ausentes |
| 503 | photo_storage_not_configured | Faltan variables de Supabase válidas |
| 503 | photo_bucket_not_private | El bucket no está configurado como privado |
| 503 | photo_storage_unavailable | Error de comunicación, permisos o respuesta de Storage |

## Configuración de Supabase y Render

En el **proyecto de pruebas**, crear el bucket `fotos` con acceso público desactivado.
Configurar también en el bucket el límite de 8 MiB y los tipos image/jpeg, image/png e image/webp.
No crear políticas de acceso público ni entregar la clave service_role al navegador.

Las variables ya están declaradas en `.env.example`:

```dotenv
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=fotos
```

Cargar los valores reales solo en `backend/.env` local o en las variables del backend de stage
en Render. Mantener separado el proyecto de pruebas del de producción. Reiniciar la API después
de configurarlo y aplicar `alembic upgrade head` al desplegar. No modificar config.py.
La configuración aislada de fotos vive en memories/photo_settings.py.

Antes de cerrar AYNI-45, verificar una carga real, listado y borrado contra ese bucket privado,
y comprobar el acceso desde dos dispositivos o cuentas familiares. La suite local utiliza
un proveedor de Storage simulado; no acredita esa prueba real ni un despliegue.

## Integración para frontend

1. Guardar el recuerdo mediante POST /memories y conservar su `id`.
2. Enviar cada imagen mediante FormData al endpoint de fotos de ese recuerdo.
3. Anunciar éxito completo únicamente cuando todas las operaciones hayan terminado bien.
   Si falla una foto, mostrar el mensaje y permitir reintentar; no simular su guardado.
4. Consultar GET /memories/{memory_id}/photos para mostrarlas, también en otro dispositivo.
5. Renovar los enlaces con GET al acercarse `url_expires_at`; no persistir los enlaces firmados.
6. Al eliminar, usar DELETE y actualizar la galería tras recibir 204.
7. Manejar `photo_limit_reached` como error del backend, sin imponer el actual límite local de 12.

Ejemplo de cuerpo para subir:

```typescript
const body = new FormData();
body.append("file", file);
// fetch con la URL de VITE_API_URL y Authorization: Bearer <token>.
// No fijar Content-Type: el navegador agrega el boundary multipart.
```

**El cliente apiFetch actual siempre fija Content-Type: application/json.** Antes de reutilizarlo
para FormData, frontend debe omitir esa cabecera cuando el cuerpo sea FormData, conservando
el manejo de detail.message/detail.code y el cierre de sesión ante 401.

Esta entrega cambia solo backend y documentación. Las fotos antiguas de IndexedDB no se migran
automáticamente. Como sus registros locales no contienen memory_id, no se puede deducir a qué
recuerdo pertenecen: se debe pedir que la persona seleccione el recuerdo antes de volver a subirlas.

## Persistencia y borrado

POST responde 201 después de guardar el objeto y confirmar el registro. Si falla después de
intentar la subida, se intenta retirar el objeto y la transacción de PostgreSQL no se confirma.
Supabase y PostgreSQL no comparten una transacción distribuida: si también falla esa compensación,
se registra únicamente la ruta con UUID para revisar y retirar el objeto privado pendiente.
No se registran nombres, contenido de fotos ni URLs firmadas.

DELETE retira primero el objeto y después el registro. Si Storage falla, no se anuncia éxito.
Al borrar un recuerdo mediante el servicio también se retiran sus objetos antes de borrar la fila.
Los futuros flujos de eliminación de cuenta deben coordinar esta limpieza antes de borrar por
cascada en la base; una operación SQL directa no puede retirar archivos de Supabase.

Referencias: [buckets privados](https://supabase.com/docs/guides/storage/buckets/fundamentals),
[API de Storage](https://supabase.github.io/storage/).
