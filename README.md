# 🧠 AVICI — Plataforma de estudio con IA

> El "mundo de estudio" de la futura Dra. Avici: convierte libros de enfermería/medicina en **cursos interactivos** con un **profesor IA** experto, juegos, gamificación e investigación web en vivo.

**🌐 En vivo:** https://pagina-avici.vercel.app

---

## ✨ ¿Qué es?

Una app web (PWA instalable) donde una estudiante entra con su Google, un admin la aprueba, y accede a un **curso completo generado por IA a partir de cada libro**:

- 🧬 **Neural Study Theatre**: una interfaz clínica inmersiva, responsive y accesible, pensada como sala de control de estudio en vez de un dashboard genérico.
- ✦ **Marca AF**: el logo fusiona la A de AVICI con una F oculta de Florencia, una curva neural y una línea de precisión quirúrgica.
- 🎓 **Cursos** por libro: unidades → lecciones, ordenadas de lo básico a lo avanzado.
- 📘 **Lecciones didácticas** (explicación + conceptos clave) que **citan la página exacta** del libro para verificar.
- 🎮 **Juegos**: quiz de opción múltiple, "unir conceptos", flashcards.
- 🌐 **"Mundo hoy"**: investigación web real (Wikipedia ES/EN en vivo) que **contrasta el libro con el conocimiento actual** (qué cambió, qué se moderniza, qué se discute) con fuentes enlazadas.
- 🤖 **El Profe**: chat con un tutor IA experto, natural, que cita páginas. Soporta **chats múltiples** (crear/cambiar/borrar).
- 🏆 **Gamificación**: XP, niveles, rachas y logros.
- 📖 **Lector híbrido**: vista Visual del PDF original —incluye imágenes, tablas, diagramas, colores y composición— y vista Lectura adaptable, sin mezclar contenido entre páginas.
- ✍️ **Notas** privadas por texto o dictado con micrófono + seleccionar texto → preguntar al bot o guardar nota.
- 📲 **PWA** instalable en Android / iPhone / PC.

---

## 🏗️ Arquitectura

```
Navegador (PWA)
  ├─ index.html + app.js  → toda la UI y la lógica de cliente
  │     ├─ Auth (Firebase, login con Google)
  │     ├─ Lector + RAG cliente (BM25 sobre el texto del libro cacheado en IndexedDB)
  │     └─ Llama a las funciones /api/*
  │
  ├─ Vercel Serverless Functions (Node)  → el "cerebro" seguro
  │     ├─ /api/chat      → DeepSeek: chat, currículum, lección, contraste
  │     ├─ /api/research  → Wikipedia (en vivo) + DeepSeek: sección "Mundo hoy"
  │     ├─ /api/models    → lista modelos de la cuenta DeepSeek
  │     └─ /api/book-pdf  → proxy privado con autenticación y rangos HTTP
  │
  ├─ Firebase (Google)
  │     ├─ Authentication (Google)
  │     └─ Firestore: usuarios, aprobación, libros, cursos, lecciones, notas, progreso, chats
  │
  ├─ Vercel Blob privado
  │     └─ PDF originales; solo se entregan a usuarias autenticadas y aprobadas
  │
  └─ DeepSeek API (v4-pro / v4-flash)  → el modelo de IA (key guardada SOLO en Vercel)
```

**Idea clave:** la búsqueda (RAG) se hace en el cliente sobre el texto del libro; el servidor solo arma el prompt y llama a DeepSeek. La **API key nunca está en el código público** — vive como variable de entorno en Vercel.

---

## 🧰 Stack

- **Frontend:** HTML + CSS + JavaScript (módulos ES). Sin framework. PWA (manifest + service worker network-first).
- **Render de libros:** PDF.js, con carga por rangos para no descargar cientos de MB antes de mostrar la primera página.
- **Backend:** Vercel Serverless Functions (Node, ESM). Verificación de token con [`jose`](https://www.npmjs.com/package/jose).
- **Auth + DB:** Firebase Authentication (Google) + Cloud Firestore.
- **IA:** DeepSeek API (OpenAI-compatible) — `deepseek-v4-pro` (profundo) y `deepseek-v4-flash` (rápido, por defecto para tareas estructuradas).
- **Investigación web:** API pública de Wikipedia (ES + EN), sin key.
- **Hosting + CI/CD:** GitHub → Vercel (auto-deploy en cada `push`).

---

## 📁 Estructura del repo

```
pagina-avici/
├─ index.html            # estructura + estilos (inicio, auth, admin, zona de estudio)
├─ app.js                # lógica: auth, admin, curso, lector, chat, notas, juegos, gamificación
├─ api/
│  ├─ _lib.js            # verificar ID token de Firebase + estado "aprobado"
│  ├─ book-pdf.js        # entrega privada de los PDF originales por rangos
│  ├─ chat.js            # DeepSeek: tareas chat | curriculum | lesson | contrast
│  ├─ research.js        # "Mundo hoy": Wikipedia en vivo + contraste con DeepSeek
│  └─ models.js          # listar modelos DeepSeek disponibles
├─ manifest.webmanifest  # PWA
├─ sw.js                 # service worker (network-first)
├─ assets/logo-avici.png # marca principal AF con transparencia real
├─ reader-utils.js       # fidelidad y transformación del texto página por página
├─ vendor/pdfjs/         # visor PDF y recursos locales
├─ icon-192.png / icon-512.png / apple-touch-icon.png
├─ package.json          # dependencias: jose + pdfjs-dist
├─ vercel.json           # maxDuration de las funciones
└─ README.md
```

> ⚠️ Los **libros NO están en este repo público**. El texto procesado se guarda privado en Firestore y los PDF originales en Vercel Blob privado. Ver "Procesar libros".

---

## 🔐 Seguridad

- **Login con Google** (Firebase). Solo usuarios **aprobados** por el admin acceden al contenido.
- **Admin:** `fundacionsocial@gimnasioemocionalmb.com` (aprueba/rechaza, importa libros, genera cursos).
- **Reglas de Firestore:** cada quien lee lo suyo; los libros/cursos solo los ven aprobados; solo el admin escribe libros/cursos.
- **API key de DeepSeek:** vive **solo** en Vercel (`DEEPSEEK_API_KEY`), nunca en el cliente ni en el repo. Las funciones verifican el ID token de Firebase y el estado aprobado antes de llamar a DeepSeek; la comprobación falla cerrada ante errores de red (protege acceso y gasto).
- **PDF originales:** el navegador nunca recibe una URL pública. `/api/book-pdf` valida el ID token y el estado aprobado, y luego transmite únicamente los rangos solicitados por PDF.js.
- El `firebaseConfig` que aparece en el código es **público por diseño** (es config de cliente, no es un secreto).

---

## 🗄️ Modelo de datos (Firestore)

- `users/{uid}` → `{ email, displayName, photoURL, role: admin|student, status: pending|approved|rejected }`
- `users/{uid}/notes/{id}` → notas privadas
- `users/{uid}/progress/{bookId}` → `{ done, scores, xp, level, streak, badges }`
- `users/{uid}/chats/{id}` → `{ title, bookId, messages[] }` (chats múltiples)
- `books/{bookId}` → `{ title, pageCount, bundleCount }`
- `books/{bookId}/bundles/{i}` → texto del libro (partido en bloques < 1 MB)
- `books/{bookId}/course/main` → el currículum generado por IA
- `books/{bookId}/lessons/{id}` → lecciones generadas (caché)
- `books/{bookId}/contrast/{id}` → secciones "Mundo hoy" (caché)

---

## 🤖 Cómo funciona la IA (y cómo ahorra tokens)

1. **Currículum:** desde el índice del libro, DeepSeek diseña unidades → lecciones (una vez, se cachea).
2. **Lección:** al abrirla, se recuperan los fragmentos relevantes (BM25) del rango de páginas y DeepSeek arma explicación + quiz + flashcards + conceptos (se cachea).
3. **Chat:** BM25 recupera 14 fragmentos diversificados por página y expande la consulta con la lección y la conversación reciente. DeepSeek recibe hasta 10 rondas de historial y responde citando páginas.
4. **Mundo hoy:** Wikipedia en vivo + fragmentos del libro → DeepSeek contrasta; el resultado se renueva como máximo cada 7 días o manualmente.

**Memoria real:** cada conversación guarda sus últimos 40 mensajes en Firestore, se restaura entre dispositivos y queda vinculada al libro en el que nació. El modelo recibe los últimos 20 mensajes (10 rondas) con límites de tamaño para conservar continuidad sin permitir prompts gigantes.

**Caché con invalidación:**

- El libro se guarda en IndexedDB y se compara con su `contentVersion`; una importación nueva invalida automáticamente la copia vieja.
- Currículo, lecciones y contrastes llevan la versión del libro que los originó, de modo que nunca se mezclan con una edición nueva.
- Una pregunta inicial idéntica puede reutilizar una respuesta local durante 14 días. La clave incluye usuario, libro, versión y modo para evitar cruces o respuestas obsoletas.
- DeepSeek reutiliza automáticamente prefijos de contexto y AVICI muestra el porcentaje de *cache hit* devuelto por la API. Las peticiones incluyen un `user_id` opaco para aislar el KV cache por estudiante.

### Resultado de la auditoría del bot

El Profe sí conserva contexto, usa recuperación sobre el libro y aprovecha caché en cliente, Firestore y proveedor. La auditoría además endureció estos puntos:

- acceso a la IA **fail-closed**: si no se puede comprobar la aprobación, no se autoriza el gasto;
- historial filtrado a roles `user`/`assistant`, con límites de cantidad y longitud;
- recuperación más diversa y consciente de preguntas de seguimiento;
- cachés versionadas, con TTL donde el contenido pretende estar actualizado;
- conversaciones aisladas por libro y caché local aislada por usuario.

**Límites honestos:** la recuperación sigue siendo léxica (BM25), no vectorial; “Mundo hoy” usa Wikipedia y sirve para orientación, no reemplaza guías clínicas o bases como PubMed; y la respuesta todavía no se transmite por streaming. Es un tutor sólido y contextual, no una fuente clínica infalible.

---

## 🚀 Desarrollo y despliegue

**Requisitos de entorno (en Vercel → Settings → Environment Variables):**
- `DEEPSEEK_API_KEY` — **obligatoria** (la key de DeepSeek).
- `DEEPSEEK_MODEL` — opcional (por defecto `deepseek-v4-pro`).
- `DEEPSEEK_BASE_URL` — opcional (por defecto `https://api.deepseek.com`).
- `BLOB_READ_WRITE_TOKEN` — token del almacén Blob privado vinculado al proyecto.
- `BOOK_THIBODEAU_PDF_URL` — URL privada del PDF original de Thibodeau.
- `BOOK_MAZARRASA_PDF_URL` — URL privada del PDF original de Mazarrasa.

**Publicar cambios:** el repo está conectado a Vercel; cada `push` a `main` **despliega solo**.

```bash
git add -A
git commit -m "mi cambio"
git push        # → Vercel publica automáticamente en segundos
```

O deploy manual inmediato: `vercel --prod --yes`.

---

## 👩‍💼 Guía del admin

1. **Aprobar usuarias:** entrá como admin → panel "Solicitudes pendientes" → **Aprobar**.
2. **Importar libros:** panel admin → "⚙️ Importar / actualizar libros" → subí los `*.pages.json` → **Importar a Firestore**.
3. **Generar curso:** en la zona de estudio, elegí el libro → **"✨ Generar curso con IA"** (o "🔁 Regenerar").

---

## 📚 Procesar libros (pipeline, fuera del repo)

Los PDF y su texto extraído viven **privados** en la carpeta local `avici-materiales/` (no se suben a GitHub). Los PDF originales de producción también se guardan en Vercel Blob privado. Con Python + PyMuPDF:

- `extract.py` → genera `<libro>.pages.json` (texto por página, con nº de página) para importar en la app.

Luego el admin sube esos `.pages.json` con el importador. El texto alimenta búsqueda, RAG y la vista Lectura; el PDF original alimenta la vista Visual. Ambos conservan exactamente el mismo número de página.

---

## 🗺️ Roadmap (ideas a futuro)

- Más juegos (verdadero/falso, completar espacios, casos clínicos).
- Metas semanales / ranking.
- Respuestas del bot en streaming.
- Fuentes médicas extra (p. ej. PubMed) en "Mundo hoy".

---

Hecho con ❤️ por **Sebastián** para su amiga **Avici** — camino a neurocirujana. 🧠✨
