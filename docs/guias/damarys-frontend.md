# Guía para Damarys: cómo subir tu parte (Frontend)

Hola Damarys. Esta guía te lleva paso a paso desde cero hasta tener tu código en GitHub. No necesitas saber Git de antes: copia los comandos tal cual.

**Tu área:** todo lo que está en la carpeta `frontend/`, o sea las pantallas que ve la cuidadora.

---

## Parte 1: preparar tu compu (solo una vez)

### 1. Acepta la invitación al repositorio

Entra a GitHub con tu cuenta **dahyesCM**. Te llegó una invitación por correo, o la ves en https://github.com/JosephChomboM/ayni-digital-startup. Dale a **Accept invitation**.

Sin esto no puedes subir nada.

### 2. Instala los programas

| Programa | Para qué sirve | Dónde se descarga |
|---|---|---|
| **Git** | Guardar versiones y subirlas a GitHub | https://git-scm.com/downloads |
| **Node.js 24** | Correr el frontend | https://nodejs.org (elige la versión 24 LTS) |
| **VS Code** | Editar el código | https://code.visualstudio.com |

Para comprobar que se instalaron bien, abre una terminal y escribe:

```bash
git --version
node --version
```

La terminal es "Terminal" en Mac, y en Windows puedes usar "Git Bash" o la terminal de VS Code. Si cada comando muestra un número de versión, todo está bien.

### 3. Dile a Git quién eres

Usa **el mismo correo de tu cuenta de GitHub**. Así tus commits aparecen con tu nombre.

```bash
git config --global user.name "Damarys"
git config --global user.email "tu-correo-de-github@ejemplo.com"
```

### 4. Descarga el proyecto

```bash
git clone https://github.com/JosephChomboM/ayni-digital-startup.git
cd ayni-digital-startup/frontend
npm install
```

La primera vez que hagas `git push`, Git te pedirá iniciar sesión en GitHub. Sigue lo que te indique en el navegador.

### 5. Prueba que funciona

```bash
npm run dev
```

Abre http://localhost:5173 en el navegador y deberías ver "Ayni". Para detenerlo, presiona `Ctrl + C` en la terminal.

---

## Parte 2: tu flujo de trabajo (cada vez que hagas una tarea)

Piensa en `main` como la versión oficial del proyecto. **Nadie escribe directo en `main`.** Cada tarea se hace en una "rama", que es una copia aparte. Cuando terminas, pides que la revisen y recién ahí se une a `main`.

### Paso 1: actualiza tu copia y crea tu rama

Siempre empieza desde `main` actualizado:

```bash
git switch main
git pull
git switch -c damarys/pantalla-perfil
```

El nombre de la rama es **`damarys/` + qué vas a hacer**, en minúsculas y con guiones. Algunos ejemplos:

- `damarys/pantalla-subir-recuerdos`
- `damarys/boton-guardar-mas-grande`
- `damarys/arreglo-texto-onboarding`

Haz **una rama por tarea**. Cuando termines esa tarea, la siguiente va en una rama nueva.

### Paso 2: trabaja y guarda tu avance (commit)

Edita los archivos en VS Code. Cada vez que termines algo que funcione, guárdalo así:

```bash
git add .
git commit -m "feat: add profile page"
```

El mensaje del commit va **en inglés** y empieza con el tipo de cambio:

| Prefijo | Cuándo usarlo | Ejemplo |
|---|---|---|
| `feat:` | Algo nuevo | `feat: add photo upload screen` |
| `fix:` | Arreglar un error | `fix: button text cut on small phones` |
| `style:` | Solo cambios visuales | `style: increase button size` |

### Paso 3: revisa antes de subir

Desde la carpeta `frontend/`, corre esto. Son las mismas revisiones que hará GitHub:

```bash
npm run lint
npm test
npm run build
```

Si alguno muestra error, arréglalo antes de subir. Si no entiendes el error, pregunta en el grupo.

### Paso 4: sube tu rama a GitHub

```bash
git push -u origin damarys/pantalla-perfil
```

Usa el nombre de tu rama. Después del primer push, para esa misma rama basta con escribir `git push`.

### Paso 5: abre un Pull Request (PR)

1. Entra a https://github.com/JosephChomboM/ayni-digital-startup. Aparecerá un botón amarillo **"Compare & pull request"**; dale clic.
2. Pon un título claro, por ejemplo "Pantalla de perfil del adulto mayor".
3. Llena la plantilla: qué cambiaste y marca el checklist.
4. Dale clic a **Create pull request**.

### Paso 6: espera los checks y la aprobación

En tu PR verás 3 revisiones automáticas: **Backend**, **Frontend** y **Seguridad**.

- ✅ Si todas salen en verde, solo falta que **otra persona del equipo apruebe** tu PR.
- ❌ Si alguna sale en rojo, entra a **Details** para ver el error. Arréglalo en tu compu, haz `git add .`, `git commit -m "fix: ..."` y `git push`. El PR se actualiza solo.

Cuando tengas la aprobación y todo esté en verde, dale a **Squash and merge**. Tu código ya está en `main` y se publica automáticamente en **stage** (el ambiente de prueba).

### Paso 7: limpia y vuelve a empezar

```bash
git switch main
git pull
git branch -D damarys/pantalla-perfil
```

Para la siguiente tarea, vuelve al Paso 1.

---

## Reglas de tu área (CLAUDE.md)

Ayni **no es un servicio de salud**, y eso se nota en cada texto de la pantalla:

- ❌ **Nunca** uses: "diagnóstico", "tratamiento", "terapia", "mejora su memoria", "detecta demencia".
- ✅ Usa: "actividad", "sesión", "registro de cómo le fue".
- Escribe en español peruano y con tuteo cálido: "Sube una foto de tu mamá cuando era joven".
- La usuaria es una cuidadora de 35 a 55 años con un celular Android de gama media:
  - botones grandes;
  - **una sola acción principal por pantalla**;
  - una sesión completa en **máximo 3 toques**.
- Diseña primero para celular (mobile-first) y después para computadora.
- Los límites del plan gratis (10 fotos, etc.) los valida el backend. **No** los programes en el frontend.

### Dónde va cada cosa

```
frontend/src/
  pages/        → una pantalla por archivo: Perfil, SubirRecuerdos, GuiaSesion, RegistroRespuesta, Dashboard
  components/   → piezas reutilizables (botones, tarjetas)
  api/          → funciones que hablan con el backend
```

Si una carpeta no existe todavía, créala. Para hablar con el backend, crea el archivo `frontend/.env.local` con esta línea:

```
VITE_API_URL=http://localhost:8000
```

---

## Revisar el PR de otra persona

Todo PR necesita la aprobación de alguien que no sea su autor, así que te tocará revisar PRs de los demás:

1. Entra al PR y abre la pestaña **Files changed**.
2. Si algo no se entiende, deja un comentario en esa línea.
3. Si está bien, dale a **Review changes → Approve → Submit review**.

---

## Problemas comunes

| Mensaje | Qué pasa | Qué hacer |
|---|---|---|
| `rejected ... main (protected branch)` | Intentaste subir directo a `main` | Crea una rama (Paso 1) y sube esa |
| `Your branch is behind` | Alguien cambió `main` | `git switch main && git pull && git switch tu-rama && git merge main` |
| `CONFLICT` | Tú y otra persona cambiaron la misma línea | Abre el archivo en VS Code, elige qué versión queda, guarda y luego `git add .` y `git commit`. Si te traba, pide ayuda |
| `npm: command not found` | Node no está instalado | Instala Node.js 24 y abre una terminal nueva |

**Ante la duda, pregunta antes de forzar algo.** Nunca uses `git push --force`.
