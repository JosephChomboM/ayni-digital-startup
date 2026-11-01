# Detalles de anécdotas (AYNI-70)

La galería muestra un desplegable por anécdota con personas, lugares, épocas y
actividades devueltas por la API. Usa los permisos y las marcas de sensibilidad
del listado de recuerdos; no llama directamente al proveedor de IA.

Se distinguen procesamiento pendiente, fallo (sin pérdida del texto), extracción
completada sin detalles y extracción con detalles. El botón Actualizar recuerdos
vuelve a consultar la API; no reintenta el NLP ni crea otro recuerdo. Las canciones
no muestran este bloque. Se advierte que la detección automática puede contener
errores; los detalles no constituyen información clínica.

Verificación: `npm test -- src/components/MemoryEntities.test.tsx
src/api/UploadModule.test.tsx`, además de `npm run build`. Las pruebas simulan HTTP;
la aprobación de QA en stage es independiente. Reversión: retirar el componente,
su invocación, el botón de actualización y sus pruebas. No modifica datos ni API.
