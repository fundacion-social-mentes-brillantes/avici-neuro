# 🧠 AVICI — Plataforma de estudio con IA

> El "mundo de estudio" de la futura Dra. Avici: convierte libros de enfermería/medicina en **cursos interactivos** con un **profesor IA** experto, juegos, gamificación y contraste biomédico verificable.

**🌐 En vivo:** https://pagina-avici.vercel.app

**✅ Estado verificado (30 de julio de 2026):** producción · 3 libros · 137 lecciones · 39 pruebas automatizadas aprobadas

---

## ✨ ¿Qué es?

Una app web (PWA instalable) donde una estudiante entra con su cuenta de Google, un admin la aprueba y accede a una **ruta curricular diseñada y auditada para cada libro**. Las lecciones interactivas se generan bajo demanda con IA, exclusivamente desde los fragmentos recuperados de la fuente, y se validan antes de mostrarse:

- 🧬 **Neural Study Theatre**: una interfaz clínica inmersiva, responsive y accesible, pensada como sala de control de estudio en vez de un dashboard genérico.
- ✦ **Marca AF**: el logo fusiona la A de AVICI con una F oculta de Florencia, una curva neural y una línea de precisión quirúrgica.
- 🎓 **Cursos auditados** por libro: Thibodeau cubre 34 capítulos, Mazarrasa 77 y el Manual del vacunador organiza sus 43 secciones en 26 lecciones con suficiente evidencia, siempre con rangos internos exactos del PDF.
- 📘 **Lecciones didácticas** (explicación + conceptos clave) que **citan la página exacta** del libro para verificar.
- 🎮 **Práctica activa**: quiz con niveles cognitivos y dominio al 80%, unir conceptos, flashcards con autoevaluación y un desafío aplicado por capítulo.
- 🧬 **"Mundo hoy"**: busca literatura biomédica en PubMed y solo muestra afirmaciones que conservan una cita textual verificable; para vacunación también mantiene a la vista el calendario y los lineamientos oficiales argentinos.
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
  │     ├─ /api/research  → PubMed + DeepSeek + validación de citas: sección "Mundo hoy"
  │     ├─ /api/models    → lista modelos de la cuenta DeepSeek
  │     ├─ /api/book-pdf  → proxy privado con autenticación y rangos HTTP
  │     └─ /api/book-data → respaldo textual privado y autenticado
  │
  ├─ Firebase (Google)
  │     ├─ Authentication (Google)
  │     └─ Firestore: usuarios, aprobación, libros, cursos, lecciones, notas, progreso, chats
  │
  ├─ Vercel Blob privado
  │     ├─ PDF originales; solo se entregan a usuarias autenticadas y aprobadas
  │     └─ respaldo textual autenticado del Manual del vacunador
  │
  └─ DeepSeek API (v4-flash)  → el modelo de IA (key guardada SOLO en Vercel)
```

**Idea clave:** la búsqueda (RAG) se hace en el cliente sobre el texto del libro; el servidor solo arma el prompt y llama a DeepSeek. La **API key nunca está en el código público** — vive como variable de entorno en Vercel.

---

## 🧰 Stack

- **Frontend:** HTML + CSS + JavaScript (módulos ES). Sin framework. PWA (manifest + service worker network-first).
- **Render de libros:** PDF.js, con carga por rangos para no descargar cientos de MB antes de mostrar la primera página.
- **Backend:** Vercel Serverless Functions (Node, ESM). Verificación de token con [`jose`](https://www.npmjs.com/package/jose).
- **Auth + DB:** Firebase Authentication (Google) + Cloud Firestore.
- **IA:** DeepSeek API (OpenAI-compatible) — `deepseek-v4-flash` en todo (chat, currículum, lecciones y contraste). Desde la versión 0731 es más capaz que `deepseek-v4-pro` y cuesta ~3× menos, y el modo "pensar" va desactivado (`thinking: disabled`) para responder más rápido y más barato. Se cambia de modelo con la variable `DEEPSEEK_MODEL`.
- **Investigación biomédica:** NCBI E-utilities / PubMed, con resúmenes, fecha, revista, PMID y tipo de publicación.
- **Hosting + CI/CD:** GitHub → Vercel (auto-deploy en cada `push`).

---

## 📁 Estructura del repo

```
pagina-avici/
├─ index.html            # estructura de inicio, auth, admin y zona de estudio
├─ styles.css            # sistema visual responsive de AVICI
├─ app.js                # lógica: auth, admin, curso, lector, chat, notas, juegos, gamificación
├─ course-catalog.js     # rutas verificadas: Thibodeau + Mazarrasa + Manual del vacunador
├─ learning-utils.js     # contrato y validación estricta de lecciones/juegos
├─ api/
│  ├─ _lib.js            # verificar ID token de Firebase + estado "aprobado"
│  ├─ book-data.js       # respaldo autenticado del texto privado
│  ├─ book-pdf.js        # entrega privada de los PDF originales por rangos
│  ├─ chat.js            # DeepSeek: tareas chat | curriculum | lesson | contrast
│  ├─ research.js        # "Mundo hoy": PubMed + contraste con evidencia verificable
│  └─ models.js          # listar modelos DeepSeek disponibles
├─ manifest.webmanifest  # PWA
├─ sw.js                 # service worker (network-first)
├─ assets/logo-avici.png # marca principal AF con transparencia real
├─ reader-utils.js       # fidelidad y transformación del texto página por página
├─ test/                 # 39 pruebas de acceso, libros, IA, aprendizaje, lector e investigación
├─ vendor/pdfjs/         # visor PDF y recursos locales
├─ icon-192.png / icon-512.png / apple-touch-icon.png
├─ package.json          # dependencias: jose + pdfjs-dist
├─ vercel.json           # maxDuration de las funciones
└─ README.md
```

> ⚠️ Los **libros NO están en este repo público**. El texto procesado se guarda en Firestore; el Manual del vacunador también tiene un respaldo autenticado en Vercel Blob privado. Los PDF originales permanecen en Blob privado. Ver "Procesar libros".

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
- `books/{bookId}/course/main` → copia persistida de la ruta; las tres fuentes actuales usan un currículo versionado y auditado
- `books/{bookId}/lessons/{id}` → lecciones generadas (caché)
- `books/{bookId}/contrast/{id}` → secciones "Mundo hoy" (caché)

---

## 🤖 Cómo funciona la IA (y cómo ahorra tokens)

1. **Currículum:** los tres libros incluidos usan una ruta versionada y verificada contra el índice visual del PDF; no dependen de que la IA adivine la estructura.
2. **Lección:** al abrirla, se recuperan fragmentos del rango exacto del capítulo. DeepSeek arma explicación, objetivos, quiz, flashcards, conceptos y desafío. El servidor audita citas, opciones, niveles y seguridad; si encuentra un defecto reparable, devuelve al modelo los errores exactos y las páginas permitidas, corrige el JSON con los mismos fragmentos y vuelve a auditarlo. Solo las lecciones validadas entran al caché.
3. **Chat:** BM25 recupera 14 fragmentos diversificados por página y expande la consulta con la lección y la conversación reciente. DeepSeek recibe hasta 10 rondas de historial y responde citando páginas.
4. **Mundo hoy:** DeepSeek traduce el tema a conceptos biomédicos → PubMed recupera literatura → DeepSeek propone el contraste → el servidor descarta cualquier afirmación cuya cita no exista literalmente en el libro o en el resumen. El resultado se renueva cada 3 días o manualmente.

Como Mazarrasa es una edición histórica, sus 77 lecciones separan visiblemente **lo que enseña la edición** de **la evidencia actual**. El validador rechaza frases que presenten un dato del libro como “hoy” o “actualmente”; la actualización solo puede aparecer en “Mundo hoy” con fuentes trazables.

El **Manual del vacunador** es la 3.ª edición del GCBA, publicada en 2013. Su ruta se presenta como un laboratorio documental: todos los contenidos, quizzes, flashcards y desafíos deben nombrar la edición y no pueden convertir dosis, esquemas, intervalos, productos, temperaturas, normas, contactos o protocolos antiguos en una conducta clínica. Para decisiones reales, la interfaz enlaza el [Calendario Nacional de Vacunación](https://www.argentina.gob.ar/salud/vacunas), los [lineamientos para equipos de salud](https://www.argentina.gob.ar/salud/inmunoprevenibles/recomendaciones-manuales-y-lineamientos) y la [red actual de vacunatorios de la Ciudad](https://buenosaires.gob.ar/gcaba_historico/lugares-y-horarios-de-vacunatorios).

**Memoria real:** cada conversación guarda sus últimos 40 mensajes en Firestore, se restaura entre dispositivos y queda vinculada al libro en el que nació. El modelo recibe los últimos 20 mensajes (10 rondas) con límites de tamaño para conservar continuidad sin permitir prompts gigantes.

**Caché con invalidación:**

- El libro se guarda en IndexedDB y se compara con su `contentVersion`; una importación nueva invalida automáticamente la copia vieja.
- Currículo, lecciones y contrastes llevan versiones independientes del libro y del motor pedagógico, de modo que nunca se mezclan con una edición o un contrato de evaluación anterior.
- La ruta usa identificadores estables por lección (`th-c01`, `mz-c01`, `vac-l01`, etc.), para que reorganizar módulos no destruya el progreso.
- Una pregunta inicial idéntica puede reutilizar una respuesta local durante 14 días. La clave incluye usuario, libro, versión y modo para evitar cruces o respuestas obsoletas.
- DeepSeek reutiliza automáticamente prefijos de contexto y AVICI muestra el porcentaje de *cache hit* devuelto por la API. Las peticiones incluyen un `user_id` opaco para aislar el KV cache por estudiante.

### Resultado de la auditoría del bot

El Profe sí conserva contexto, usa recuperación sobre el libro y aprovecha caché en cliente, Firestore y proveedor. La auditoría además endureció estos puntos:

- acceso a la IA **fail-closed**: si no se puede comprobar la aprobación, no se autoriza el gasto;
- historial filtrado a roles `user`/`assistant`, con límites de cantidad y longitud;
- recuperación más diversa y consciente de preguntas de seguimiento;
- cachés versionadas, con TTL donde el contenido pretende estar actualizado;
- conversaciones aisladas por libro y caché local aislada por usuario.

Al cierre de la integración del Manual del vacunador, la suite automatizada reúne **39 pruebas aprobadas**. También se verificó la aplicación real desplegada en Vercel, tanto en escritorio como en un viewport móvil de **390 × 844 px**: carga del curso, generación de una lección, citas, quiz, conexiones, flashcards, desafío, lector adaptable y salto de página con Enter.

**Límites honestos:** la recuperación del libro sigue siendo léxica (BM25), no vectorial. El chat del Profe no navega libremente por cualquier sitio web; la búsqueda biomédica actualizada y controlada ocurre en **“Mundo hoy”**, principalmente sobre títulos y resúmenes indexados en PubMed. La validación textual comprueba trazabilidad, pero no sustituye una revisión clínica humana ni la lectura completa del artículo. La respuesta todavía no se transmite por streaming. Es un tutor sólido y contextual, no una fuente clínica infalible.

---

## 🚀 Desarrollo y despliegue

### Preparar y validar una copia local

```bash
npm install
npm test
npm run check
```

Para levantar la aplicación completa con sus funciones privadas, usá una sesión autenticada de Vercel:

```bash
npx vercel link
npx vercel env pull .env.local
npx vercel dev
```

Vercel mostrará la dirección local, normalmente `http://localhost:3000`. Los archivos `.vercel/` y `.env*.local` ya están ignorados por Git: nunca subas claves, tokens ni variables privadas al repositorio.

**Requisitos de entorno (en Vercel → Settings → Environment Variables):**
- `DEEPSEEK_API_KEY` — **obligatoria** (la key de DeepSeek).
- `DEEPSEEK_MODEL` — opcional (por defecto `deepseek-v4-flash`). Es el interruptor para cambiar de modelo sin tocar código: si algún día conviene volver a `deepseek-v4-pro`, se define esta variable y listo.
- `DEEPSEEK_BASE_URL` — opcional (por defecto `https://api.deepseek.com`).
- `BLOB_READ_WRITE_TOKEN` — token del almacén Blob privado vinculado al proyecto.
- `BOOK_THIBODEAU_PDF_URL` — URL privada del PDF original de Thibodeau.
- `BOOK_MAZARRASA_PDF_URL` — URL privada del PDF original de Mazarrasa.
- `BOOK_VACUNADOR_PDF_URL` — URL privada del Manual del vacunador.
- `BOOK_VACUNADOR_TEXT_URL` — respaldo privado de sus 134 páginas extraídas; Firestore tiene prioridad cuando existe.

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
2. **Importar libros:** panel admin → "⚙️ Importar / actualizar libros" → subí los `*.pages.json` → **Importar a Firestore**. El Manual del vacunador también dispone de un respaldo privado autenticado para que el curso no quede bloqueado si esa importación todavía no se hizo.
3. **Verificar curso:** al entrar, la ruta auditada aparece automáticamente con la insignia **"Ruta verificada"** y sus métricas de cobertura: 34/34, 77/77 o 26 lecciones / 43 secciones fuente.

---

## 📚 Procesar libros (pipeline, fuera del repo)

Los PDF y su texto extraído viven **privados** en la carpeta local `avici-materiales/` (no se suben a GitHub). Los PDF originales de producción también se guardan en Vercel Blob privado. Con Python + PyMuPDF:

- `extract.py` → genera `<libro>.pages.json` (texto por página, con nº de página) para importar en la app.

Luego el admin sube esos `.pages.json` con el importador. El texto alimenta búsqueda, RAG y la vista Lectura; el PDF original alimenta la vista Visual. Ambos conservan exactamente el mismo número de página. En el Manual del vacunador, el respaldo privado de texto mantiene esas mismas funciones hasta que exista una copia en Firestore.

---

## 🗺️ Roadmap (ideas a futuro)

- Repetición espaciada entre sesiones y repaso automático de preguntas falladas.
- Metas semanales / ranking.
- Respuestas del bot en streaming.
- Incorporar automáticamente extractos verificables de guías oficiales dentro del contraste, además de los enlaces operativos ya visibles.

---

Hecho con ❤️ por **Sebastián** para su amiga **Avici** — camino a neurocirujana. 🧠✨
