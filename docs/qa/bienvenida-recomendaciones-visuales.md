# Correcciones de la bienvenida

Aplicación de las capturas aportadas por el responsable del producto. Se preservan nombre, azul profundo, terracota y dorado, propósito familiar y acciones de registro/acceso.

- Huellas: favicon de Ayni reemplaza el de Vite; no se usa la marca del generador.
- Tipografía: Atkinson Hyperlegible Next autoalojada, con licencia OFL; jerarquía y tamaños responsive.
- Etiquetas y pastillas: sin etiquetas decorativas sobre títulos ni falsas novedades. «Ejemplo ilustrativo» se conserva porque explica la procedencia del contenido.
- Hero: título a ancho amplio, texto y acción agrupados, sin carrusel ni plantilla de foto/copy enfrentados.
- Tres pasos: reemplazados por una muestra interactiva de anécdota/canción y una pregunta de guía, sin pasos numerados ni tarjetas repetidas.
- Componentes: botones de 8px, panel de recuerdos de 16px, muestra de guía con esquina de apertura; tokens locales y estilo de interacción propios sobre el Button compartido.
- Iconos: vocabulario SVG geométrico propio en la bienvenida, sin imports de Lucide.
- Texto: explicaciones completas, sin frases fragmentadas de eslogan; FAQ coherente con fotos/sesiones aún pendientes.
- Imágenes: el producto se muestra como interfaz semántica interactiva. Por preferencia posterior del responsable, se conserva una fotografía familiar del repositorio con pie explícito de imagen ilustrativa. No se presenta como testimonio. Las imágenes ODS institucionales se conservan.
- Compartir: imagen PNG propia 1200×630, Open Graph y Twitter Card con título, descripción y alt. Vite resuelve la URL absoluta con VITE_SITE_URL o RENDER_EXTERNAL_URL. En despliegues con dominio propio, definir VITE_SITE_URL con el origen público; no usar localhost. La vista de WhatsApp necesita un despliegue público y puede mantener caché.

## Validación

Build exitoso; 59 tests existentes aprobados; lint sin errores y con tres avisos previos. Detector sin hallazgos en los archivos revisados. Vista en navegador a 390, 768 y 1280 px sin desbordamiento horizontal; fuente cargada; cambio de anécdota/canción, menú de tablet y FAQ comprobados. Recursos institucionales cargados antes de las capturas finales. Metadatos absolutos y PNG verificados en una compilación con VITE_SITE_URL. No se desplegó ni se comprobó una tarjeta real de WhatsApp.

## Identidad después de iniciar sesión

La cabecera muestra nombre (o correo de respaldo), iniciales, rol y estado de sesión. “Mi cuenta” presenta nombre/correo/rol recibidos por la autenticación y permite salir; la edición de nombre/correo no se ofrece porque no existe contrato de actualización conectado. “Persona y familia” abre el perfil del adulto mayor, separado de la identidad del usuario. La lista de miembros marca la cuenta actual con “Tú” y expone los fallos de consulta con reintento.

Inspección autenticada y de solo lectura en stage: se comprobó la ausencia de identidad en la cabecera desplegada y que el perfil existente correspondía a la persona acompañada. No se modificaron recuerdos, perfiles, invitaciones ni facturación. Se cerró la sesión al terminar. Revisión local del nuevo flujo con datos ficticios, a escritorio y 390px sin desbordamiento. Prueba de regresión de identidad, apertura de Mi cuenta y cierre de sesión; suite final: 60 tests aprobados. Servidor temporal apagado. Los cambios no se han desplegado.

## Unidades de revisión y reversión

1. Acceso y controles accesibles: AuthPage, cliente API y controles compartidos. Revertir esta unidad restaura el formulario y estilos previos sin modificar contratos backend. Pruebas de AuthPage y suite completa.
2. Espacio autenticado e identidad: App, HomePage, ProfilePage, SessionGuide y FamilyDashboard con sus pruebas. Revertir esta unidad restaura navegación y pantallas previas; no hay migraciones ni cambios persistentes de datos. Revisión stage de solo lectura y escenario local con datos ficticios descritos arriba.
3. Bienvenida y compartir: WelcomePage, AyniIcon, CSS local, favicon, fuente con licencia, PNG social y metadatos Vite. Revertir esta unidad restaura la presentación previa sin afectar autenticación ni API. Revisión responsive y compilación con URL social absoluta descritas arriba.

## Integración de main / PR #45

Se integró `f528fbe` conservando la configuración de cuenta, suscripción, subida de fotos locales, guía con recuerdos reales y resumen de reseñas locales añadidos en main. La configuración nueva sigue accesible desde Más opciones; Mi cuenta y Persona y familia conservan las entradas visibles de este PR. El retorno de Stripe acepta tanto el query como el marcador de sessionStorage y limpia el marcador al restaurar el plan.

Las descripciones anteriores de fotos y sesiones pendientes corresponden a la revisión inicial y quedan sustituidas por el comportamiento integrado: fotos en IndexedDB y reseñas en localStorage, solo en este navegador y sin sincronización. La bienvenida, la guía y el resumen explican ese alcance. Las nuevas rutas de imágenes de main se conservan, incluido ODS 3 en PNG. El registro usa la nueva composición de main conservando los campos que corresponden al contrato API y la ayuda de acceso.

Regresiones actualizadas: pausa bloquea avance de la guía; guardar crea una reseña local asociada a la familia; omitir no guarda; total de recuerdos usa total API más fotos locales; retorno de checkout por marcador; identidad y cierre de sesión. No se modificaron datos de stage.
