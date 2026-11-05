# PR #40: migración de Tailwind CSS 3 a 4

## Problema y corrección

El PR de Dependabot actualizaba Tailwind a 4.3.3 sin migrar su integración. El build
fallaba porque PostCSS seguía usando directamente `tailwindcss` como plugin.

- Añadido `@tailwindcss/postcss` 4.3.3 y actualizado PostCSS; retirado autoprefixer,
  cuya función ya cubre la nueva integración.
- Sustituidas las directivas de Tailwind 3 por `@import 'tailwindcss'` y movidos los
  colores de `tailwind.config.js` a `@theme` en CSS.
- Migradas las clases de sombras, bordes redondeados, foco, desenfoque y variantes
  mediante la herramienta oficial. Conservado el nombre `outline` de la prop de
  Button: es una variante de React, no una clase CSS.
- Añadida la compatibilidad de color de borde por defecto recomendada en la guía.

## Verificación local

- `npm run lint`: sin errores; tres advertencias existentes de React.
- `npm test`: 44 pruebas satisfactorias en 7 archivos.
- `npm run build`: compilación de TypeScript y Vite satisfactoria.
- `npm audit --audit-level=high`: cero vulnerabilidades reportadas.
- Revisión del build en navegador: bienvenida y navegación al acceso; colores,
  tipografía y botones visibles. A 390 px, bienvenida y acceso sin desbordamiento
  horizontal (scrollWidth = innerWidth = 390).

Esta revisión visual cubre las pantallas públicas. QA del equipo debe revisar las
pantallas autenticadas y los dispositivos objetivo antes del merge. Tailwind 4
requiere Safari 16.4+, Chrome 111+ o Firefox 128+; no se ha comprobado en esos tres
navegadores ni en dispositivos físicos.

Referencia: https://tailwindcss.com/docs/upgrade-guide

Para revertir toda la actualización, revertir el merge del PR completo, incluyendo
los manifests y lockfile. No hay cambios de API, datos ni migraciones.
