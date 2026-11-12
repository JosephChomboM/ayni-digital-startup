# AYNI-66 — Guías guardadas, historial y exclusión de contenido

Validación local del 11 de noviembre de 2026. Rama: `gonzalo/ayni-66-guias-historial`.
Base de implementación del backend: PR #60, `63a2bd1`. Las cinco regresiones del backend ya están en el commit `d873365`; la conexión de la pantalla se añade después, todavía sin commit al preparar esta evidencia.

## Qué se completó

- La pantalla genera mediante `POST /sessions/generate` y muestra las instrucciones y tiempos que devuelve el servidor.
- El historial consulta `GET /sessions` con paginación de diez entradas y abre el detalle con `GET /sessions/{id}`. Abrir una guía guardada no genera otra ni consume cupo.
- Una recarga permite recuperar la misma guía desde el historial. El paso actual y el cronómetro se reinician al abrirla; las instrucciones guardadas se conservan.
- El servidor decide qué recuerdos incluir. Se sustituyeron los pasos fijos y la selección manual de recuerdos/fotos locales por los pasos persistidos y sus referencias autorizadas. La pantalla recupera la anécdota o canción correspondiente a cada paso y vuelve a comprobar su elegibilidad.
- Si un recuerdo se retira o pasa a ser sensible/no positivo, se conserva el paso original, sin exponer el contenido del recuerdo.
- Los errores de cupo, falta de recuerdos, autenticación y red se muestran sin inventar una guía local. Hay reintento de historial, pausa, navegación y regreso al historial.
- Cambiar de usuario o familia reinicia el estado de la pantalla. Las reseñas siguen siendo locales y se indica al guardarlas; su persistencia no forma parte de esta conexión.

## Pruebas automatizadas

Desde `frontend`:

```powershell
npm test
npm run build
npm run lint
```

Resultado: **79 pruebas aprobadas**, compilación aprobada y lint sin errores. Persisten avisos anteriores de otros componentes; los archivos de esta entrega no presentan avisos.

Trece casos del componente y tres del cliente HTTP verifican generación, reapertura tras desmontar, consulta sin consumir cupo, contenido permitido/retirado/sensible/no positivo/de otra familia, paginación, reintento, cambio de cuenta, reseña local, contrato autenticado y sesión vencida.

Desde `backend`:

```powershell
uv run --frozen pytest -q
uv run --frozen ruff check .
uv run --frozen ruff format --check .
```

Resultado: **543 pruebas aprobadas, ninguna omitida**, Ruff y formato aprobados. Las seis pruebas nuevas de AYNI-99 se mantienen en su rama independiente, por eso esta ejecución tiene seis casos menos que la ejecución conjunta anterior de 549.

Las cinco regresiones de AYNI-66 prueban rollback real de sesión e ítems sin consumir cupo, conservación del historial al cambiar elegibilidad y rechazo de una guía vacía cuando solo queda contenido pendiente de borrado.

## Recorrido real ejecutado en navegador

Ambiente: React/Vite en `http://localhost:5174`, FastAPI en `http://127.0.0.1:8001` y PostgreSQL local `ayni_test`. Familia y recuerdo ficticios. Sin LLM ni recomendador para generar las guías. No se modificaron datos de stage o producción.

1. Iniciar sesión con la familia ficticia, que tiene perfil y una anécdota positiva.
2. Entrar a **Guía de sesión**: aparece el historial vacío.
3. Presionar **Generar y comenzar guía**: se recibe una guía guardada de tres pasos y quince minutos.
4. Presionar **Siguiente**: se muestra el texto de la anécdota recuperado de la API.
5. Recargar la página, volver a **Guía de sesión** y presionar **Abrir guía**: se recuperan los pasos originales desde el historial.
6. Con ancho de 390 px, avanzar y presionar **Pausar**: se deshabilitan Anterior/Siguiente y aparece el aviso de pausa.
7. Volver al historial e intentar generar otra guía: el backend informa el límite de siete días del plan gratuito; la guía anterior sigue disponible.
8. Marcar la anécdota ficticia como sensible mediante la API y volver a abrir la guía: el paso conserva su instrucción y muestra que el recuerdo ya no está disponible, sin mostrar su texto.
9. Verificar también a 320 px: no se observó desbordamiento horizontal. El recorrido se probó con emulación de ancho móvil; Gonzalo también había reportado la comprobación de la pantalla anterior en su celular.

Resultados obtenidos: coinciden con lo esperado en los nueve pasos. Capturas: `AYNI-66-movil.jpg` y `AYNI-66-exclusion-movil.jpg`.

## Publicación

La implementación funciona y queda verificada en local. Esta rama requiere el backend del PR #60: integrar ambos antes de desplegar. El cierre local de QA no acredita un despliegue. La validación del entorno publicado y promoción a producción se conserva para AYNI-38.
