// ===== AVICI — Curso interactivo por libro (auth + admin + curso + libro + bot + notas) =====
import { fluidPageText, getReaderPageModel } from "./reader-utils.js";
import { COURSE_ENGINE_VERSION, courseAudit, getCuratedCourse } from "./course-catalog.js";
import { LESSON_ENGINE_VERSION, MASTERY_SCORE, lessonCacheIsCurrent, normalizeLessonData, shuffleCards } from "./learning-utils.js";
import * as pdfjsLib from "./vendor/pdfjs/pdf.min.mjs";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc,
  query, orderBy, where, onSnapshot, getDocs, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC6OyQbcmh-78PeTJ8rcNDSWWcviGcc-Ds",
  authDomain: "avici-3eb47.firebaseapp.com",
  projectId: "avici-3eb47",
  storageBucket: "avici-3eb47.firebasestorage.app",
  messagingSenderId: "840855556466",
  appId: "1:840855556466:web:82430bb7dd0f757c330deb"
};
const ADMIN_EMAIL = "fundacionsocial@gimnasioemocionalmb.com";
const BOOKS = [
  { id: "thibodeau", title: "Thibodeau & Patton — Anatomía y Fisiología" },
  { id: "mazarrasa", title: "Mazarrasa — Enfermería" },
  {
    id: "vacunador",
    title: "Manual del vacunador — GCBA, 3.ª edición (2013)",
    edition: "2013",
    sourceStatus: "historical-clinical",
  },
];
const VACCINATION_OFFICIAL_SOURCES = [
  { label: "Calendario Nacional de Vacunación vigente", url: "https://www.argentina.gob.ar/salud/vacunas" },
  { label: "Recomendaciones y lineamientos para equipos de salud", url: "https://www.argentina.gob.ar/salud/inmunoprevenibles/recomendaciones-manuales-y-lineamientos" },
  { label: "Seguridad en vacunas y ESAVI", url: "https://www.argentina.gob.ar/salud/inmunoprevenibles/seguridad-en-vacunas/recomendaciones" },
  { label: "Vacunatorios y horarios de la Ciudad", url: "https://buenosaires.gob.ar/gcaba_historico/lugares-y-horarios-de-vacunatorios" },
];
const PRIVATE_BOOK_DATA_IDS = new Set(["vacunador"]);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });
pdfjsLib.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs";

const $ = (id) => document.getElementById(id);
const show = (el, on = true) => { const e = typeof el === "string" ? $(el) : el; if (e) e.classList.toggle("hidden", !on); };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const toast = (m) => window._toast ? window._toast(m) : console.log(m);
let isAdmin = false, curUser = null;
function bookConfig(bookId = book?.id) { return BOOKS.find(item => item.id === bookId) || null; }
function officialVaccinationLinks() {
  return `<div class="official-links">${VACCINATION_OFFICIAL_SOURCES.map(source => `<a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.label)} <span>↗</span></a>`).join("")}</div>`;
}

async function idToken() { return auth.currentUser ? await auth.currentUser.getIdToken() : null; }
async function apiChat(payload, timeoutMs = 70000) {
  const tk = await idToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tk }, body: JSON.stringify(payload), signal: controller.signal });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      /* El servidor marca qué fallos son técnicos y vale la pena reintentar solos
         (respuesta cortada, sin tiempo para la corrección) frente a los que no. */
      const fallo = new Error(data.error || ("Error " + r.status));
      fallo.retryable = data.retryable === true || r.status === 504;
      fallo.status = r.status;
      throw fallo;
    }
    return data;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("La lección tardó demasiado. Tocá reintentar: tu ruta y tu progreso siguen a salvo.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- markdown-lite + citas ---------- */
/* `paginasVerificadas` (opcional): conjunto de páginas que REALMENTE se recuperaron del
   libro para esta respuesta. Cuando se pasa, solo esas se dibujan como cita clicable. Una
   página que el modelo escribió de memoria queda como texto plano, sin el botón verde: el
   botón significa "esto está en el libro y te lo puedo abrir", y no puede mentir. */
function md(text, paginasVerificadas = null) {
  let h = esc(text);
  h = h.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>");
  h = h.replace(/^\s*###?\s*(.+)$/gm, "<h4>$1</h4>");
  h = h.replace(/\(?\bp[aá]g(?:ina)?s?\.?\s*(\d{1,4})\b\)?/gi, (m, n) => (
    !paginasVerificadas || paginasVerificadas.has(Number(n))
      ? `<button class="cite" data-pg="${n}">📄 pág. ${n}</button>`
      : `<span class="cite-sin-verificar" title="El Profe mencionó esta página, pero no salió de los fragmentos recuperados del libro">pág. ${n}</span>`
  ));
  h = h.replace(/^\s*[-*]\s+(.+)$/gm, "• $1");
  h = h.replace(/\n/g, "<br>");
  return h;
}
function wireCites(el) { el.querySelectorAll(".cite").forEach(b => b.onclick = () => goToPage(parseInt(b.dataset.pg))); }

/* ---------------- AUTH ---------------- */
let unsubUserDoc = null, unsubPending = null, unsubApproved = null, unsubNotes = null, unsubProgress = null, unsubChats = null;
function cleanup() { [unsubUserDoc, unsubPending, unsubApproved, unsubNotes, unsubProgress, unsubChats].forEach(f => { try { f && f(); } catch {} }); unsubUserDoc = unsubPending = unsubApproved = unsubNotes = unsubProgress = unsubChats = null; stopNoteDictation(true); setReaderFocus(false); void resetReaderPdf(); }
function whoami(user, role) {
  const img = user.photoURL ? `<img src="${esc(user.photoURL)}" referrerpolicy="no-referrer" alt="">` : `<img src="/icon-192.png" alt="">`;
  return `<div class="whoami">${img}<div class="info"><b>${esc(user.displayName || "Sin nombre")}</b><span>${esc(user.email || "")}</span></div><span class="role">${role}</span></div>`;
}
$("btnLogin").addEventListener("click", async () => {
  try { await signInWithPopup(auth, provider); }
  catch (e) { const c = e.code || "";
    if (/popup-blocked|cancelled-popup|operation-not-supported|popup-closed/.test(c)) { try { await signInWithRedirect(auth, provider); } catch (e2) { toast("No se pudo abrir el login: " + (e2.message || e2)); } }
    else if (/unauthorized-domain/.test(c)) toast("Dominio no autorizado en Firebase.");
    else toast("Error al entrar: " + (e.message || e));
  }
});
["btnLogoutP", "btnLogoutR", "btnLogoutS"].forEach(id => $(id) && $(id).addEventListener("click", async () => { cleanup(); try { await signOut(auth); } catch {} }));
getRedirectResult(auth).catch(() => {});

async function ensureUserDoc(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const admin = (user.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase();
    await setDoc(ref, { email: user.email || "", displayName: user.displayName || "", photoURL: user.photoURL || "", role: admin ? "admin" : "student", status: admin ? "approved" : "pending", createdAt: serverTimestamp() });
  }
  return ref;
}
const CARDS = ["welcomeCard", "heroBlock", "installCard", "homeNudge", "pageFooter"];
const setLanding = (on) => CARDS.forEach(id => show(id, on));

function renderByStatus(user, data) {
  isAdmin = data.role === "admin" || (user.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase();
  ["accessLoading", "viewLogin", "viewPending", "viewRejected"].forEach(v => show(v, false));
  if (isAdmin || data.status === "approved") {
    show("accessCard", false); setLanding(false); show("adminZone", isAdmin);
    if (isAdmin) { $("whoamiAdmin").innerHTML = whoami(user, "Admin"); startAdmin(); }
    show("studyZone", true); initStudy(user); return;
  }
  show("accessCard", true); setLanding(true); show("adminZone", false); show("studyZone", false);
  if (data.status === "rejected") { $("whoamiRejected").innerHTML = whoami(user, "Sin acceso"); show("viewRejected", true); }
  else { $("whoamiPending").innerHTML = whoami(user, "Pendiente"); show("viewPending", true); }
}
onAuthStateChanged(auth, async (user) => {
  cleanup(); curUser = user;
  if (!user) { ["accessLoading", "viewPending", "viewRejected"].forEach(v => show(v, false)); show("accessCard", true); setLanding(true); show("adminZone", false); show("studyZone", false); show("viewLogin", true); return; }
  show("accessCard", true); ["viewLogin", "viewPending", "viewRejected"].forEach(v => show(v, false)); show("accessLoading", true); setLanding(false);
  try { const ref = await ensureUserDoc(user); unsubUserDoc = onSnapshot(ref, s => { if (s.exists()) renderByStatus(user, s.data()); }, err => { toast("Error de acceso: " + err.message); show("viewLogin", true); }); }
  catch (e) { toast("Error de conexión: " + (e.message || e)); show("accessLoading", false); show("viewLogin", true); }
});

/* ---------------- ADMIN ---------------- */
function startAdmin() {
  if (unsubPending || unsubApproved) return;
  const col = collection(db, "users");
  unsubPending = onSnapshot(query(col, where("status", "==", "pending")), qs => {
    $("pendingCount").textContent = qs.size; const list = $("pendingList");
    if (qs.empty) { list.innerHTML = `<div class="empty">Nadie esperando 🎉</div>`; return; }
    list.innerHTML = ""; qs.forEach(d => list.appendChild(userRow(d.id, d.data(), "pending")));
  }, e => { $("pendingList").innerHTML = `<div class="empty">Error: ${esc(e.message)}</div>`; });
  unsubApproved = onSnapshot(query(col, where("status", "==", "approved")), qs => {
    const list = $("approvedList");
    if (qs.empty) { list.innerHTML = `<div class="empty">Aún no hay aprobados.</div>`; return; }
    list.innerHTML = ""; qs.forEach(d => list.appendChild(userRow(d.id, d.data(), "approved")));
  }, e => { $("approvedList").innerHTML = `<div class="empty">Error: ${esc(e.message)}</div>`; });
  cargarActividad();           // el avance se lee una vez al abrir el panel
}
function userRow(uid, u, kind) {
  const row = document.createElement("div"); row.className = "urow";
  const img = document.createElement("img"); img.src = u.photoURL || "/icon-192.png"; img.referrerPolicy = "no-referrer";
  const info = document.createElement("div"); info.className = "u"; info.innerHTML = `<b>${esc(u.displayName || "Sin nombre")}</b><span>${esc(u.email || "")}</span>`;
  const acts = document.createElement("div"); acts.className = "acts";
  if (kind === "pending") {
    const ok = document.createElement("button"); ok.className = "btn btn-ok btn-sm"; ok.textContent = "Aprobar"; ok.onclick = () => setStatus(uid, "approved");
    const no = document.createElement("button"); no.className = "btn btn-bad btn-sm"; no.textContent = "Rechazar"; no.onclick = () => setStatus(uid, "rejected");
    acts.append(ok, no);
  } else {
    const b = document.createElement("span"); b.className = "pill-status ps-approved"; b.textContent = "Aprobada";
    const r = document.createElement("button"); r.className = "btn btn-ghost btn-sm"; r.textContent = "Quitar"; r.onclick = () => setStatus(uid, "rejected");
    acts.append(b, r);
  }
  row.append(img, info, acts); return row;
}
async function setStatus(uid, status) {
  try { await updateDoc(doc(db, "users", uid), { status, approvedAt: serverTimestamp(), approvedBy: (auth.currentUser && auth.currentUser.email) || "" }); toast(status === "approved" ? "✅ Aprobada." : "Actualizado."); }
  catch (e) { toast("No se pudo: " + (e.message || e)); }
}

/* ---------------- PANEL DE ACTIVIDAD (solo admin) ----------------
   Muestra USO y AVANCE: si entran, cuánto estudian y hasta dónde llegaron.
   NO muestra el contenido de las notas ni de las conversaciones con el Profe:
   la app les promete que eso es privado, así que acá solo se cuentan. */

function fechaDe(valor) {
  if (!valor) return null;
  if (typeof valor?.toDate === "function") { try { return valor.toDate(); } catch { return null; } }
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}
function hace(fecha) {
  if (!fecha) return "nunca";
  const dias = Math.floor((Date.now() - fecha.getTime()) / 86400000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.round(dias / 30);
  return meses <= 1 ? "hace 1 mes" : `hace ${meses} meses`;
}
function leccionesDelLibro(bookId) {
  try {
    const curso = getCuratedCourse(bookId);
    return (curso?.units || []).reduce((n, u) => n + ((u.lessons || []).length), 0);
  } catch { return 0; }
}
function tituloLibro(bookId) {
  return (BOOKS.find(b => b.id === bookId)?.title || bookId).split("—")[0].trim();
}

let actividadCache = [];

async function cargarActividad() {
  const lista = $("actLista"), resumen = $("actResumen");
  if (!lista || !resumen) return;
  lista.innerHTML = `<div class="empty">Leyendo el avance…</div>`;
  resumen.innerHTML = "";
  try {
    const usuarios = await getDocs(query(collection(db, "users"), where("status", "==", "approved")));
    const filas = [];
    for (const docUsuario of usuarios.docs) {
      const uid = docUsuario.id, datos = docUsuario.data() || {};
      const [progreso, notas, charlas] = await Promise.all([
        getDocs(collection(db, "users", uid, "progress")).catch(() => null),
        getDocs(collection(db, "users", uid, "notes")).catch(() => null),
        getDocs(collection(db, "users", uid, "chats")).catch(() => null),
      ]);
      let lecciones = 0, xp = 0, racha = 0, nivel = 1, ultima = null;
      const libros = [];
      for (const p of (progreso?.docs || [])) {
        const d = p.data() || {};
        const hechas = Object.keys(d.done || {}).length;
        const total = leccionesDelLibro(p.id);
        lecciones += hechas;
        xp += Number(d.xp || 0);
        racha = Math.max(racha, Number(d.streak || 0));
        nivel = Math.max(nivel, Number(d.level || 1));
        const f = fechaDe(d.updatedAt) || fechaDe(d.lastStudy);
        if (f && (!ultima || f > ultima)) ultima = f;
        if (hechas || total) libros.push({ id: p.id, hechas, total });
      }
      filas.push({
        uid,
        nombre: datos.displayName || "Sin nombre",
        email: datos.email || "",
        foto: datos.photoURL || "",
        alta: fechaDe(datos.createdAt),
        ultima, lecciones, xp, nivel, racha, libros,
        notas: notas?.size || 0,
        charlas: charlas?.size || 0,
      });
    }
    filas.sort((a, b) => (b.ultima?.getTime() || 0) - (a.ultima?.getTime() || 0));
    actividadCache = filas;
    pintarResumenActividad(filas);
    pintarListaActividad(filas);
  } catch (e) {
    lista.innerHTML = `<div class="empty">No pude leer la actividad: ${esc(e.message || e)}</div>`;
  }
}

function pintarResumenActividad(filas) {
  const ahora = Date.now();
  const activos = (dias) => filas.filter(f => f.ultima && (ahora - f.ultima.getTime()) <= dias * 86400000).length;
  const sinEmpezar = filas.filter(f => !f.lecciones).length;
  const lecciones = filas.reduce((n, f) => n + f.lecciones, 0);
  const tarjetas = [
    ["Con acceso", filas.length, "personas aprobadas"],
    ["Activas esta semana", activos(7), "estudiaron en 7 días"],
    ["Activas este mes", activos(30), "estudiaron en 30 días"],
    ["Nunca empezaron", sinEmpezar, "0 lecciones hechas"],
    ["Lecciones dominadas", lecciones, "sumando a todas"],
    ["Notas guardadas", filas.reduce((n, f) => n + f.notas, 0), "solo el conteo"],
  ];
  $("actResumen").innerHTML = tarjetas
    .map(([t, v, p]) => `<div class="act-kpi"><span class="act-kpi-n">${v}</span><b>${esc(t)}</b><small>${esc(p)}</small></div>`)
    .join("");
}

function pintarListaActividad(filas) {
  const lista = $("actLista");
  if (!filas.length) { lista.innerHTML = `<div class="empty">Todavía no hay nadie aprobado.</div>`; return; }
  lista.innerHTML = filas.map(f => {
    const barras = f.libros.map(l => {
      const pct = l.total ? Math.round(l.hechas / l.total * 100) : 0;
      return `<div class="act-libro"><span>${esc(tituloLibro(l.id))}</span>`
        + `<div class="act-barra"><i style="width:${pct}%"></i></div>`
        + `<small>${l.hechas}${l.total ? "/" + l.total : ""}${l.total ? ` · ${pct}%` : ""}</small></div>`;
    }).join("") || `<div class="act-libro act-vacio"><span>Todavía no abrió ninguna lección</span></div>`;
    const frio = !f.ultima || (Date.now() - f.ultima.getTime()) > 14 * 86400000;
    return `<div class="act-fila${frio ? " act-frio" : ""}">
      <img src="${esc(f.foto || "/icon-192.png")}" alt="" referrerpolicy="no-referrer">
      <div class="act-quien"><b>${esc(f.nombre)}</b><span>${esc(f.email)}</span>
        <small>Entró ${esc(hace(f.alta))} · última actividad ${esc(hace(f.ultima))}</small></div>
      <div class="act-libros">${barras}</div>
      <div class="act-cifras">
        <span title="Lecciones dominadas">✅ ${f.lecciones}</span>
        <span title="Nivel y XP">🏆 ${f.nivel} · ${f.xp} XP</span>
        <span title="Racha de días">🔥 ${f.racha}</span>
        <span title="Notas escritas (no se muestra el contenido)">✍️ ${f.notas}</span>
        <span title="Conversaciones con el Profe (no se muestra el contenido)">💬 ${f.charlas}</span>
      </div>
    </div>`;
  }).join("");
}

function descargarActividadCSV() {
  if (!actividadCache.length) { toast("Primero tocá «Actualizar»."); return; }
  const cab = ["nombre", "email", "alta", "ultima_actividad", "lecciones", "nivel", "xp", "racha", "notas", "conversaciones"];
  const filas = actividadCache.map(f => [
    f.nombre, f.email,
    f.alta ? f.alta.toISOString().slice(0, 10) : "",
    f.ultima ? f.ultima.toISOString().slice(0, 10) : "",
    f.lecciones, f.nivel, f.xp, f.racha, f.notas, f.charlas,
  ]);
  const csv = [cab, ...filas]
    .map(fila => fila.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = `avici-actividad-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

$("actRefresh") && $("actRefresh").addEventListener("click", cargarActividad);
$("actCsv") && $("actCsv").addEventListener("click", descargarActividadCSV);

/* ---------------- IMPORTAR LIBROS ---------------- */
function ilog(m) { const el = $("importLog"); el.textContent += (el.textContent ? "\n" : "") + m; el.scrollTop = el.scrollHeight; }
function splitByBytes(str, maxBytes) {
  const enc = new TextEncoder(); const out = []; let start = 0; const step = 400000;
  while (start < str.length) { let end = Math.min(str.length, start + step); while (enc.encode(str.slice(start, end)).length > maxBytes && end > start + 1000) end -= 20000; out.push(str.slice(start, end)); start = end; }
  return out;
}
$("importBtn") && $("importBtn").addEventListener("click", async () => {
  const files = $("importFile").files;
  if (!files || !files.length) { toast("Elegí los archivos .pages.json primero."); return; }
  $("importLog").textContent = "";
  for (const file of files) {
    try {
      ilog("Leyendo " + file.name + "…");
      const obj = JSON.parse(await file.text());
      const bookId = (obj.id || file.name.replace(/\.pages\.json$|\.json$/i, "")).toLowerCase();
      const title = obj.title || bookId; const pages = obj.pages || [];
      if (!pages.length) { ilog("  ⚠️ sin páginas, salto."); continue; }
      const pieces = splitByBytes(JSON.stringify(pages), 900 * 1024);
      const contentVersion = Date.now();
      const old = await getDocs(collection(db, "books", bookId, "bundles"));
      if (!old.empty) { let b = writeBatch(db), n = 0; for (const d of old.docs) { b.delete(d.ref); if (++n >= 400) { await b.commit(); b = writeBatch(db); n = 0; } } if (n) await b.commit(); }
      let batch = writeBatch(db), ops = 0;
      for (let i = 0; i < pieces.length; i++) { batch.set(doc(db, "books", bookId, "bundles", String(i)), { i, data: pieces[i] }); if (++ops >= 400) { await batch.commit(); batch = writeBatch(db); ops = 0; ilog(`  ${bookId}: ${i + 1}/${pieces.length}`); } }
      if (ops) await batch.commit();
      await setDoc(doc(db, "books", bookId), { title, pageCount: pages.length, bundleCount: pieces.length, contentVersion, updatedAt: serverTimestamp() }, { merge: true });
      try { const c = await idb(); await c.deleteBook(bookId); } catch {}
      ilog(`✅ ${bookId}: ${pages.length} páginas en ${pieces.length} bloques.`);
    } catch (e) { ilog("❌ " + file.name + ": " + (e.message || e)); }
  }
  ilog("Listo ✅. Ahora en la zona de estudio: elegí el libro y tocá 'Generar curso'.");
});

/* ---------------- IndexedDB ---------------- */
function idb() {
  return new Promise((resolve) => {
    const req = indexedDB.open("avici", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("books");
    req.onsuccess = () => { const d = req.result; resolve({
      get: k => new Promise(r => { const t = d.transaction("books").objectStore("books").get(k); t.onsuccess = () => r(t.result); t.onerror = () => r(null); }),
      put: (k, v) => new Promise(r => { const t = d.transaction("books", "readwrite").objectStore("books").put(v, k); t.onsuccess = () => r(1); t.onerror = () => r(0); }),
      deleteBook: k => new Promise(r => { const t = d.transaction("books", "readwrite").objectStore("books").delete(k); t.onsuccess = () => r(1); t.onerror = () => r(0); }),
    }); };
    req.onerror = () => resolve({ get: async () => null, put: async () => 0, deleteBook: async () => 0 });
  });
}

/* ---------------- ESTUDIO ---------------- */
let studyInit = false, book = null, bookIndex = null, curPage = 1, chatHistory = [], pendingSel = "";
let course = null, progress = {}, curLesson = null;
let openCourseUnits = new Set();
const READER_PREFS_KEY = "avici-reader-preferences-v1";
/* Arranca en "text": ese texto sale de Firestore y no cuesta transferencia. La vista
   "visual" descarga trozos del PDF original (Thibodeau pesa 461 MB), asi que se abre
   solo cuando ella la pide, no en cada pagina que pasa. */
let readerPrefs = { scale: 1, theme: "paper", family: "serif", layout: "fluid", view: "text" };
let readerPdfDoc = null, readerPdfBookId = "", readerPdfLoading = null, readerPdfRenderTask = null, readerPdfRenderId = 0, readerPdfRunId = 0;
const BADGE = { primera:{emoji:"🎓",label:"Primera lección"}, cinco:{emoji:"⭐",label:"5 lecciones"}, perfecto:{emoji:"💯",label:"Quiz perfecto"}, racha3:{emoji:"🔥",label:"Racha de 3 días"}, unidad:{emoji:"🏅",label:"Unidad completa"}, curso:{emoji:"👑",label:"¡Curso completo!"} };
function totalLessons() { let t = 0; ((course && course.units) || []).forEach(u => t += (u.lessons || []).length); return t; }
function anyUnitComplete() { return ((course && course.units) || []).some((u, ui) => (u.lessons || []).length > 0 && (u.lessons || []).every((l, li) => progress.done && progress.done[lessonId(ui, li)])); }
const STOP = new Set("de la que el en y los las un una para con por del al se su sus lo como mas más o e ni pero si no es son ser este esta estos estas entre sobre cuando cada muy sin ese esa hay han ha".split(" "));
function tokenize(s) { return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !STOP.has(w)); }

function loadReaderPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(READER_PREFS_KEY) || "{}");
    if (Number.isFinite(saved.scale)) readerPrefs.scale = Math.max(.85, Math.min(1.35, saved.scale));
    if (["paper", "night"].includes(saved.theme)) readerPrefs.theme = saved.theme;
    if (["serif", "sans"].includes(saved.family)) readerPrefs.family = saved.family;
    if (["fluid", "original"].includes(saved.layout)) readerPrefs.layout = saved.layout;
    if (["visual", "text"].includes(saved.view)) readerPrefs.view = saved.view;
  } catch {}
}
function saveReaderPrefs() { try { localStorage.setItem(READER_PREFS_KEY, JSON.stringify(readerPrefs)); } catch {} }
function applyReaderPrefs() {
  const shell = $("readerShell"); if (!shell) return;
  shell.dataset.theme = readerPrefs.theme; shell.dataset.family = readerPrefs.family; shell.dataset.layout = readerPrefs.layout; shell.dataset.view = readerPrefs.view;
  shell.style.setProperty("--reader-scale", readerPrefs.scale.toFixed(2));
  $("readerFontValue").textContent = Math.round(readerPrefs.scale * 100) + "%";
  $("readerFamilyLabel").textContent = readerPrefs.family === "serif" ? "Serif" : "Sans";
  $("readerThemeLabel").textContent = readerPrefs.theme === "paper" ? "Noche" : "Papel";
  $("readerThemeBtn").setAttribute("aria-label", readerPrefs.theme === "paper" ? "Activar modo noche" : "Activar modo papel");
  $("readerVisualBtn").setAttribute("aria-pressed", String(readerPrefs.view === "visual"));
  $("readerTextBtn").setAttribute("aria-pressed", String(readerPrefs.view === "text"));
}
function changeReaderPref(key, value) {
  readerPrefs[key] = value; saveReaderPrefs(); applyReaderPrefs();
  if (book) renderPage(curPage, { keepPosition: true, animate: false });
}
function setReaderFocus(on) {
  const active = Boolean(on && $("panel-libro"));
  document.body.classList.toggle("reader-focus-active", active);
  const btn = $("readerFocusBtn"); if (!btn) return;
  btn.setAttribute("aria-pressed", String(active));
  $("readerFocusLabel").textContent = active ? "Salir de lectura" : "Lectura inmersiva";
  if (active) setTimeout(() => $("pageContent")?.focus({ preventScroll: true }), 50);
}
async function resetReaderPdf() {
  try { readerPdfRenderTask?.cancel(); } catch {}
  readerPdfRenderTask = null; readerPdfLoading = null; readerPdfBookId = "";
  try { await readerPdfDoc?.destroy(); } catch {}
  readerPdfDoc = null;
}
async function ensureReaderPdf() {
  if (!book?.id) throw new Error("No hay un libro visual seleccionado.");
  /* El id se fija ACÁ y no se vuelve a leer de `book`, que puede cambiar durante los await.
     Antes la comprobación final comparaba contra la variable global: si mientras tanto
     empezaba a cargarse otro libro, el documento viejo pasaba el control y se publicaba
     como si fuera el nuevo. El token descarta cualquier carga que ya quedó obsoleta. */
  const bookId = book.id;
  if (readerPdfDoc && readerPdfBookId === bookId) return readerPdfDoc;
  if (readerPdfLoading && readerPdfBookId === bookId) return readerPdfLoading;
  await resetReaderPdf();
  const runId = ++readerPdfRunId;
  readerPdfBookId = bookId;
  readerPdfLoading = (async () => {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
    if (!token) throw new Error("Volvé a iniciar sesión para abrir la página visual.");
    const task = pdfjsLib.getDocument({
      url: `/api/book-pdf?id=${encodeURIComponent(bookId)}`,
      httpHeaders: { Authorization: `Bearer ${token}` },
      rangeChunkSize: 262144,
      disableAutoFetch: true,
      disableStream: true,
      isEvalSupported: false,
      cMapUrl: "/vendor/pdfjs/cmaps/",
      cMapPacked: true,
      iccUrl: "/vendor/pdfjs/iccs/",
      standardFontDataUrl: "/vendor/pdfjs/standard_fonts/",
      wasmUrl: "/vendor/pdfjs/wasm/",
    });
    const doc = await task.promise;
    if (runId !== readerPdfRunId || readerPdfBookId !== bookId) { await doc.destroy(); throw new Error("El libro cambió durante la carga."); }
    readerPdfDoc = doc; readerPdfLoading = null;
    return doc;
  })().catch(error => { if (runId === readerPdfRunId) readerPdfLoading = null; throw error; });
  return readerPdfLoading;
}
/* El ID token de Firebase se le entrega a PDF.js una sola vez, al abrir el documento, y
   caduca a la hora. Pasado ese rato el proxy contesta 403 y la vista visual quedaba muerta
   hasta recargar la página, justo cuando lleva un rato estudiando. */
function esErrorDeCredencial(error) {
  const texto = `${error?.name || ""} ${error?.message || ""} ${error?.status || ""}`.toLowerCase();
  return texto.includes("401") || texto.includes("403") || texto.includes("no autorizado")
    || texto.includes("unauthorized") || texto.includes("forbidden") || texto.includes("unexpectedresponse");
}
async function renderPdfPage(pageNumber, reintento = false) {
  const frame = $("readerPdfFrame"), canvas = $("readerPdfCanvas"), loading = $("readerPdfLoading");
  if (!frame || !canvas || readerPrefs.view !== "visual") return;
  const renderId = ++readerPdfRenderId;
  try {
    loading.classList.remove("error", "hidden"); loading.innerHTML = `<div class="spinner"></div><p>Cargando la página visual original…</p>`;
    canvas.classList.remove("ready");
    const doc = await ensureReaderPdf(); if (renderId !== readerPdfRenderId) return;
    const pdfPage = await doc.getPage(pageNumber); if (renderId !== readerPdfRenderId) return;
    try { readerPdfRenderTask?.cancel(); } catch {}
    const initial = pdfPage.getViewport({ scale: 1 });
    const cssWidth = Math.max(260, Math.min((frame.clientWidth || 760) * readerPrefs.scale, 1180));
    const cssScale = cssWidth / initial.width;
    const pixelRatio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const cssViewport = pdfPage.getViewport({ scale: cssScale });
    const renderViewport = pdfPage.getViewport({ scale: cssScale * pixelRatio });
    canvas.width = Math.floor(renderViewport.width); canvas.height = Math.floor(renderViewport.height);
    canvas.style.width = Math.floor(cssViewport.width) + "px"; canvas.style.height = Math.floor(cssViewport.height) + "px";
    canvas.setAttribute("aria-label", `Página visual original ${pageNumber}`);
    readerPdfRenderTask = pdfPage.render({ canvasContext: canvas.getContext("2d", { alpha: false }), viewport: renderViewport });
    await readerPdfRenderTask.promise; if (renderId !== readerPdfRenderId) return;
    canvas.classList.add("ready"); loading.classList.add("hidden");
  } catch (error) {
    if (error?.name === "RenderingCancelledException" || renderId !== readerPdfRenderId) return;
    /* Credencial vencida: se tira el documento y se rehace una sola vez con un token nuevo,
       en silencio. Firebase renueva el token solo al pedirlo de nuevo. */
    if (!reintento && esErrorDeCredencial(error)) {
      await resetReaderPdf();
      return renderPdfPage(pageNumber, true);
    }
    loading.classList.add("error");
    loading.innerHTML = `<p><b>No pude abrir la página visual.</b><br>${esc(error?.message || error)}<br><br>Podés seguir leyendo en la vista Lectura.</p>`;
  }
}
function setupReaderControls() {
  loadReaderPrefs(); applyReaderPrefs();
  ["pgPrev", "pgPrevEdge", "pgPrevBottom"].forEach(id => $(id).onclick = () => renderPage(curPage - 1));
  ["pgNext", "pgNextEdge", "pgNextBottom"].forEach(id => $(id).onclick = () => renderPage(curPage + 1));
  $("pgInput").addEventListener("change", () => renderPage(parseInt($("pgInput").value) || 1));
  $("pgInput").addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    renderPage(parseInt($("pgInput").value) || 1);
    $("pgInput").blur();
  });
  $("readerFontDown").onclick = () => changeReaderPref("scale", Math.max(.85, +(readerPrefs.scale - .1).toFixed(2)));
  $("readerFontUp").onclick = () => changeReaderPref("scale", Math.min(1.35, +(readerPrefs.scale + .1).toFixed(2)));
  $("readerFamilyBtn").onclick = () => changeReaderPref("family", readerPrefs.family === "serif" ? "sans" : "serif");
  $("readerVisualBtn").onclick = () => changeReaderPref("view", "visual");
  $("readerTextBtn").onclick = () => changeReaderPref("view", "text");
  $("readerThemeBtn").onclick = () => changeReaderPref("theme", readerPrefs.theme === "paper" ? "night" : "paper");
  $("readerFocusBtn").onclick = () => setReaderFocus(!document.body.classList.contains("reader-focus-active"));

  let touchX = 0, touchY = 0;
  $("pageContent").addEventListener("touchstart", e => { const t = e.changedTouches[0]; touchX = t.clientX; touchY = t.clientY; }, { passive: true });
  $("pageContent").addEventListener("touchend", e => { const t = e.changedTouches[0], dx = t.clientX - touchX, dy = t.clientY - touchY; if (Math.abs(dx) > 58 && Math.abs(dx) > Math.abs(dy) * 1.35) renderPage(curPage + (dx < 0 ? 1 : -1)); }, { passive: true });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && document.body.classList.contains("reader-focus-active")) { setReaderFocus(false); return; }
    if (!book || !$("panel-libro").classList.contains("active") || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "") || document.activeElement?.isContentEditable) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); renderPage(curPage - 1); }
    if (e.key === "ArrowRight") { e.preventDefault(); renderPage(curPage + 1); }
  });
  let resizeTimer = null;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (book && readerPrefs.view === "visual" && $("panel-libro").classList.contains("active")) renderPdfPage(curPage); }, 180); });
}

function playWelcome(user) {
  const el = $("welcomeAnim"); if (!el) return;
  try { if (sessionStorage.getItem("welcomed")) return; sessionStorage.setItem("welcomed", "1"); } catch {}
  const name = ((user.displayName || "").trim().split(" ")[0]) || "Avici";
  $("waTitle").textContent = `Hola, ${name}.`;
  const inner = el.querySelector(".wa-inner");
  const emo = ["✨", "⭐", "💫", "🩺", "🧠", "💉"];
  for (let i = 0; i < 22; i++) { const s = document.createElement("span"); s.className = "wa-spark"; s.textContent = emo[i % emo.length]; s.style.left = Math.random() * 100 + "%"; s.style.top = Math.random() * 100 + "%"; s.style.fontSize = (0.8 + Math.random() * 1.6) + "rem"; s.style.animationDelay = (Math.random() * 1.3) + "s"; inner.appendChild(s); }
  el.classList.remove("hidden", "out");
  try { window.confetti && window.confetti(); } catch {}
  const close = () => { el.classList.add("out"); setTimeout(() => { el.classList.add("hidden"); el.querySelectorAll(".wa-spark").forEach(x => x.remove()); }, 700); };
  const t = setTimeout(close, 2800);
  el.onclick = () => { clearTimeout(t); close(); };
}
function initStudy(user) {
  if (studyInit) {
    curChatId = null; chats = []; chatHistory = [];
    startChats(user); startNotes(user);
    selectBook($("bookSel").value);
    return;
  }
  studyInit = true;
  playWelcome(user);
  const sel = $("bookSel"); sel.innerHTML = BOOKS.map(b => `<option value="${b.id}" title="${esc(b.title)}">${esc(b.title)}</option>`).join("");
  sel.title = BOOKS.find(b => b.id === sel.value)?.title || "";   // el nombre completo, aunque se recorte
  sel.addEventListener("change", () => selectBook(sel.value));
  document.querySelectorAll(".tabs button").forEach(btn => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));
  // reader
  setupReaderControls();
  $("searchBtn").onclick = doSearch; $("searchInput").addEventListener("keydown", e => { if (e.key === "Enter") doSearch(); });
  // chat (multi)
  $("chatSend").onclick = sendChat; $("chatInput").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } });
  $("chatSel") && ($("chatSel").onchange = () => loadChat($("chatSel").value));
  $("chatNew") && ($("chatNew").onclick = newChat);
  $("chatDel") && ($("chatDel").onclick = deleteChat);
  document.querySelectorAll("[data-chat-prompt]").forEach(btn => btn.onclick = () => { $("chatInput").value = btn.dataset.chatPrompt || ""; $("chatInput").focus(); });
  startChats(user);
  // notes
  $("noteAdd").onclick = addNote; startNotes(user);
  // course
  $("genCourseBtn") && ($("genCourseBtn").onclick = generateCourse);
  $("btnBackMap") && ($("btnBackMap").onclick = () => { show("lessonView", false); show("courseHome", true); });
  setupSelection();
  selectBook(sel.value);
}
function switchTab(tab) {
  if (tab !== "libro") setReaderFocus(false);
  if (tab !== "notas") stopNoteDictation();
  document.querySelectorAll(".tabs button").forEach(b => { const active = b.dataset.tab === tab; b.classList.toggle("active", active); b.setAttribute("aria-current", active ? "page" : "false"); });
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  $("panel-" + tab).classList.add("active");
}

/* Mismo token que en las lecciones: si la alumna cambia de fuente dos veces seguidas, la
   carga más lenta ya no puede terminar encima de la nueva y dejar el índice de un libro
   con el curso de otro. */
let bookRunId = 0;

async function selectBook(bookId) {
  const runId = ++bookRunId;
  lessonRunId++;                              // invalida cualquier lección en vuelo
  await resetReaderPdf();
  if (runId !== bookRunId) return;
  book = null; bookIndex = null; course = null; curLesson = null; openCourseUnits = new Set(); pendingSel = ""; clearSelBanner();
  show("lessonView", false); show("courseHome", true);
  $("courseHome").innerHTML = ""; $("pageContent").textContent = "";
  const selected = BOOKS.find(item => item.id === bookId);
  $("readerBookTitle").textContent = selected?.title || "Preparando tu libro…";
  $("readerBookMeta").textContent = "Cargando las páginas originales y tus preferencias de lectura.";
  try {
    await loadBookData(bookId, runId);
  } catch (error) {
    if (runId !== bookRunId) return;
    mostrarFuenteNoDisponible(selected, error);
    return;
  }
  if (runId !== bookRunId) return;
  if (!book) { mostrarFuenteNoDisponible(selected, null); return; }
  refreshChatPicker();
  await loadProgress(bookId);
  if (runId !== bookRunId) return;
  await loadCourse(bookId);
}

/* Antes, si una fuente no tenía contenido importado, loadBookData volvía en silencio: el
   lector quedaba vacío y la cabecera congelada en "Cargando las páginas originales…" sin
   que nada explicara qué pasó. */
function mostrarFuenteNoDisponible(selected, error) {
  const titulo = selected?.title || "Esta fuente";
  $("readerBookTitle").textContent = titulo;
  $("readerBookMeta").textContent = "Esta fuente todavía no tiene su contenido cargado.";
  $("pageContent").textContent = "";
  $("courseHome").innerHTML = `<div class="lesson-error"><b>${esc(titulo)} todavía no está disponible.</b>`
    + `<p>${esc(error?.message || "Su contenido no fue importado todavía. Elegí otra fuente en el selector de arriba.")}</p></div>`;
}

async function loadPrivateBookData(bookId, metaOnly = false) {
  const token = await idToken();
  const response = await fetch(`/api/book-data?id=${encodeURIComponent(bookId)}${metaOnly ? "&meta=1" : ""}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "No se pudo descargar el texto privado del libro.");
  if (!metaOnly && (!Array.isArray(payload.pages) || !payload.pages.length)) throw new Error("El texto privado del libro está incompleto.");
  return payload;
}

/* `runId` es el mismo token de selectBook. Sin él, esta función terminaba de descargar un
   libro lento y se apropiaba del lector aunque la alumna ya hubiera elegido otro: el
   selector y el curso decían una fuente y las páginas, el buscador y las citas del chat
   venían de otra. */
async function loadBookData(bookId, runId = bookRunId) {
  const vigente = () => runId === bookRunId;
  show("bookLoading", true); $("bookLoadingTxt").textContent = "Cargando libro…";
  try {
    const cache = await idb(); let data = await cache.get(bookId);
    let meta = null;
    try { meta = await getDoc(doc(db, "books", bookId)); }
    catch (e) { if ((!data || !data.pages) && !PRIVATE_BOOK_DATA_IDS.has(bookId)) throw e; }
    const m = meta?.exists() ? meta.data() : null;
    let privateMeta = null;
    if (!m && PRIVATE_BOOK_DATA_IDS.has(bookId)) {
      try { privateMeta = await loadPrivateBookData(bookId, true); }
      catch (e) {
        if (!data || !data.pages) throw e;
        privateMeta = { title: data.title, contentVersion: data.cacheVersion, cacheVersion: data.cacheVersion };
      }
    }
    if (!m && !privateMeta && (!data || !data.pages)) { if (vigente()) show("bookLoading", false); return; }
    const metaVersion = m
      ? (m.contentVersion || (m.updatedAt?.toMillis ? m.updatedAt.toMillis() : null) || `legacy:${m.pageCount || 0}:${m.bundleCount || 0}`)
      : privateMeta?.contentVersion || privateMeta?.cacheVersion || data?.cacheVersion;
    if (!data || !data.pages || (metaVersion && data.cacheVersion !== metaVersion)) {
      $("bookLoadingTxt").textContent = `Descargando ${m?.title || bookConfig(bookId)?.title || "el libro"}… (una sola vez)`;
      if (m) {
        const bs = await getDocs(collection(db, "books", bookId, "bundles"));
        const arr = []; bs.forEach(d => arr.push(d.data())); arr.sort((a, b) => a.i - b.i);
        if (!arr.length) throw new Error("El libro todavía no tiene contenido importado.");
        data = { id: bookId, title: m.title, pages: JSON.parse(arr.map(x => x.data).join("")), cacheVersion: metaVersion, contentVersion: m.contentVersion || null };
      } else {
        data = await loadPrivateBookData(bookId);
      }
      await cache.put(bookId, data);
    }
    /* La descarga ya quedó guardada en caché, pero solo se adopta como libro activo si
       sigue siendo el que la alumna tiene elegido. */
    if (!vigente()) return;
    if (m) { data.title = m.title || data.title; data.contentVersion = m.contentVersion || null; data.cacheVersion = metaVersion; }
    book = data;
    $("readerBookTitle").textContent = book.title || "Libro activo";
    $("readerBookMeta").textContent = `${book.pages.length} páginas originales · lectura fluida sin mezclar contenido entre páginas.`;
    $("bookLoadingTxt").textContent = "Preparando buscador…";
    bookIndex = buildIndex(book.pages);
    renderPage(1);
  } catch (e) {
    if (!vigente()) return;   // el error es de una fuente que ya nadie está mirando
    $("readerBookMeta").textContent = "No se pudo preparar el lector.";
    $("pageContent").innerHTML = `<div class="empty">No se pudo cargar el libro: ${esc(e.message || e)}</div>`;
  }
  if (vigente()) show("bookLoading", false);
}

function buildIndex(pages) {
  const chunks = [];
  for (const p of pages) { const t = (p.text || "").replace(/[ \t]+/g, " "); for (let i = 0; i < t.length; i += 950) { const c = t.slice(i, i + 1100).trim(); if (c.length > 40) chunks.push({ page: p.i, printed: p.printed, text: c }); } }
  const N = chunks.length, df = new Map(), docs = []; let total = 0;
  for (const c of chunks) { const terms = tokenize(c.text), tf = new Map(); for (const t of terms) tf.set(t, (tf.get(t) || 0) + 1); for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1); docs.push({ tf, len: terms.length }); total += terms.length; }
  return { N, df, docs, chunks, avgdl: total / Math.max(1, N) };
}
function search(idx, qStr, k = 8, pageRange) {
  if (!idx) return [];
  const q = [...new Set(tokenize(qStr))];
  const k1 = 1.5, b = 0.75, scores = new Float64Array(idx.N);
  if (q.length) for (const t of q) { const dfi = idx.df.get(t); if (!dfi) continue; const idf = Math.log(1 + (idx.N - dfi + 0.5) / (dfi + 0.5)); for (let i = 0; i < idx.N; i++) { const f = idx.docs[i].tf.get(t); if (!f) continue; const dl = idx.docs[i].len; scores[i] += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * dl / idx.avgdl)); } }
  const arr = [];
  for (let i = 0; i < idx.N; i++) { const c = idx.chunks[i]; if (pageRange && (c.page < pageRange[0] || c.page > pageRange[1])) continue; if (scores[i] > 0 || (pageRange && !q.length)) arr.push([scores[i], i]); }
  arr.sort((a, b) => b[0] - a[0]);
  return arr.slice(0, k).map(([s, i]) => idx.chunks[i]);
}
function diverseSearch(idx, qStr, k = 8, pageRange) {
  const ranked = search(idx, qStr, Math.max(k * 4, k), pageRange);
  const perPage = new Map(), picked = [];
  for (const item of ranked) {
    const count = perPage.get(item.page) || 0;
    if (count >= 2) continue;
    picked.push(item); perPage.set(item.page, count + 1);
    if (picked.length >= k) break;
  }
  if (picked.length < k) for (const item of ranked) { if (!picked.includes(item)) picked.push(item); if (picked.length >= k) break; }
  return picked;
}
function passagesForRange(pageStart, pageEnd, topicStr, k = 12) {
  if (!bookIndex) return [];
  let res = diverseSearch(bookIndex, topicStr || "", k, [pageStart || 1, pageEnd || (book ? book.pages.length : 1)]);
  if (res.length < 4) { // fallback: primeras chunks del rango
    res = bookIndex.chunks.filter(c => c.page >= (pageStart || 1) && c.page <= (pageEnd || 1)).slice(0, k);
  }
  return res.map(p => ({ page: p.page, printed: p.printed, text: p.text }));
}

function renderPage(n, options = {}) {
  if (!book) return;
  const previousPage = curPage;
  const model = getReaderPageModel(book, n, readerPrefs.layout); if (!model) return;
  const { sourcePage: p, pageNumber, total, visibleText, percent } = model;
  n = pageNumber; curPage = n;
  const printed = p.printed ? ` · impresa ${esc(p.printed)}` : "";
  const page = $("pageContent");

  $("pgInput").value = n; $("pgInput").max = total; $("pgTotal").textContent = total;
  $("readerProgressBar").style.width = percent.toFixed(2) + "%";
  $("readerProgressText").textContent = `Página ${n} de ${total}`;
  const progressEl = document.querySelector(".reader-progress");
  progressEl.setAttribute("aria-valuemax", String(total)); progressEl.setAttribute("aria-valuenow", String(n));
  ["pgPrev", "pgPrevEdge", "pgPrevBottom"].forEach(id => $(id).disabled = n <= 1);
  ["pgNext", "pgNextEdge", "pgNextBottom"].forEach(id => $(id).disabled = n >= total);

  page.innerHTML = `<header class="reader-page-top"><span class="reader-page-source">${esc(book.title || "AVICI · FUENTE ORIGINAL")}</span><span class="pgnum">Página ${n}${printed}</span></header><div class="reader-page-visual"><div class="reader-pdf-frame" id="readerPdfFrame"><canvas id="readerPdfCanvas" role="img"></canvas><div class="reader-pdf-loading" id="readerPdfLoading"><div class="spinner"></div><p>Cargando la página visual original…</p></div></div></div><div class="reader-page-text">${esc(visibleText)}</div><footer class="reader-page-bottom"><span>Contenido exclusivo de la página ${n}</span><img src="/assets/logo-avici.png" alt=""><span>${Math.round(percent)}% del libro</span></footer>`;
  page.setAttribute("aria-label", `Página ${n} de ${total}${p.printed ? `, página impresa ${p.printed}` : ""}`);
  page.classList.remove("page-enter-forward", "page-enter-back");
  if (options.animate !== false && n !== previousPage) {
    void page.offsetWidth;
    page.classList.add(n > previousPage ? "page-enter-forward" : "page-enter-back");
  }
  if (readerPrefs.view === "visual") requestAnimationFrame(() => renderPdfPage(n));
  if (!options.keepPosition && $("panel-libro").classList.contains("active")) requestAnimationFrame(() => page.scrollIntoView({ block: "start", behavior: "smooth" }));
}
window.goToPage = (n) => { switchTab("libro"); renderPage(n); };
function doSearch() {
  const q = $("searchInput").value.trim(); const box = $("searchResults");
  if (!q || !bookIndex) { show(box, false); return; }
  const res = search(bookIndex, q, 12);
  if (!res.length) { box.innerHTML = `<div class="empty">Sin resultados para "${esc(q)}".</div>`; show(box, true); return; }
  box.innerHTML = res.map(r => `<div class="sres" data-pg="${r.page}"><b>pág. ${r.page}</b> — ${esc(fluidPageText(r.text).slice(0, 170))}…</div>`).join("");
  show(box, true);
  box.querySelectorAll(".sres").forEach(el => el.onclick = () => { renderPage(parseInt(el.dataset.pg)); show(box, false); });
}

/* ---------------- CURSO ---------------- */
function tocPassages() {
  if (!book) return [];
  const scored = book.pages.map(p => { const lines = (p.text || "").split("\n"); let s = 0; for (const l of lines) if (/\.{2,}\s*\d{1,4}\s*$/.test(l) || /\s\d{1,4}\s*$/.test(l.trim())) s++; return { p, s }; });
  scored.sort((a, b) => b.s - a.s);
  let toc = scored.filter(x => x.s >= 4).slice(0, 12).map(x => x.p);
  if (toc.length < 3) toc = book.pages.slice(2, 22);
  toc.sort((a, b) => a.i - b.i);
  return toc.map(p => ({ page: p.i, printed: p.printed, text: p.text }));
}
async function loadCourse(bookId) {
  const home = $("courseHome"); home.innerHTML = `<div class="spinner"></div>`;
  try {
    const curated = getCuratedCourse(bookId);
    if (curated) {
      const audit = courseAudit(curated);
      if (!audit.complete) throw new Error(`La ruta auditada está incompleta (${audit.uniqueChapters}/${audit.expectedChapters} capítulos).`);
      course = curated;
      const firstPending = course.units.findIndex((unit, ui) => (unit.lessons || []).some((lesson, li) => !(progress.done || {})[lessonId(ui, li)]));
      openCourseUnits = new Set([Math.max(0, firstPending)]);
      renderMap(bookId);
      return;
    }
    const snap = await getDoc(doc(db, "books", bookId, "course", "main"));
    const cached = snap.exists() ? snap.data() : null;
    const cacheIsCurrent = cached && (!book?.contentVersion || cached.sourceVersion === book.contentVersion);
    if (cacheIsCurrent) { course = cached.data; renderMap(bookId); }
    else {
      course = null;
      home.innerHTML = isAdmin
        ? `<div class="coursegen"><div class="em">🎓</div><h3>Todavía no hay curso de este libro</h3><p>Voy a diseñar un curso completo con IA a partir del índice del libro. Puede tardar ~1 minuto.</p><button class="btn btn-mint" id="genCourseBtn2">✨ Generar curso con IA</button><div id="genLog" class="genlog"></div></div>`
        : `<div class="coursegen"><div class="em">🛠️</div><h3>El curso se está preparando</h3><p>Sebastián lo está armando. ¡Volvé en un rato, futura doctora! 🧠</p></div>`;
      if (isAdmin) $("genCourseBtn2").onclick = generateCourse;
    }
  } catch (e) { home.innerHTML = `<div class="empty">No se pudo cargar el curso: ${esc(e.message)}</div>`; }
}
async function generateCourse() {
  if (!book) { toast("Esperá a que cargue el libro."); return; }
  const gl = $("genLog"); const setg = (m) => { if (gl) gl.textContent = m; };
  const curated = getCuratedCourse(book.id);
  if (curated) {
    course = curated;
    try {
      await setDoc(doc(db, "books", book.id, "course", "main"), {
        data: curated,
        courseVersion: COURSE_ENGINE_VERSION,
        sourceVersion: book.contentVersion || null,
        createdAt: serverTimestamp(),
        by: curUser.email,
      });
    } catch {}
    toast("Ruta auditada restaurada ✓");
    renderMap(book.id);
    return;
  }
  setg("Leyendo el índice del libro…");
  try {
    const passages = tocPassages();
    setg("Diseñando el curso con IA… esto tarda un poco ⏳");
    const data = await apiChat({ task: "curriculum", bookTitle: book.title, passages, mode: "flash" });
    const c = data.result;
    if (!c || !c.units) throw new Error("El curso no vino con el formato esperado.");
    await setDoc(doc(db, "books", book.id, "course", "main"), { data: c, sourceVersion: book.contentVersion || null, createdAt: serverTimestamp(), by: curUser.email });
    course = c; toast("¡Curso generado! 🎓"); renderMap(book.id);
  } catch (e) { setg("❌ " + (e.message || e)); toast("No se pudo generar: " + (e.message || e)); }
}
function lessonId(ui, li) { return course?.units?.[ui]?.lessons?.[li]?.id || `u${ui}l${li}`; }
function renderMap(bookId) {
  const home = $("courseHome");
  const units = (course && course.units) || [];
  home.dataset.courseTheme = course?.theme || "";
  const done = (progress && progress.done) || {};
  let total = 0, doneCount = 0;
  units.forEach((u, ui) => (u.lessons || []).forEach((l, li) => { total++; if (done[lessonId(ui, li)]) doneCount++; }));
  const pct = total ? Math.round(doneCount / total * 100) : 0;
  const lvl = progress.level || 1, xp = progress.xp || 0, streak = progress.streak || 0;
  const audit = courseAudit(course);
  let nextId = "";
  units.some((unit, ui) => (unit.lessons || []).some((lesson, li) => {
    const id = lessonId(ui, li);
    if (!done[id]) { nextId = id; return true; }
    return false;
  }));
  const itemLabel = course?.itemLabel || "capítulos";
  const sourceCoverage = audit.expectedSections
    ? `<span>${audit.coveredSections}/${audit.expectedSections} secciones fuente</span>`
    : "";
  let html = `<div class="courseHead"><div class="course-kickers"><span>✓ Ruta verificada</span><span>${audit.uniqueChapters}/${audit.expectedChapters || audit.lessons} ${esc(itemLabel)}</span>${sourceCoverage}</div><h2>${esc(course.title || book.title)}</h2><p class="course-subtitle">${esc(course.subtitle || "Ruta de aprendizaje basada en la fuente original")}</p><div class="progbar"><div style="width:${pct}%"></div></div><div class="progtxt">${doneCount}/${total} lecciones dominadas · ${pct}% completado</div></div>`;
  if (course?.notice) {
    html += `<aside class="course-source-notice"><span class="notice-mark" aria-hidden="true">2013</span><div><b>${esc(course.notice.title)}</b><p>${esc(course.notice.text)}</p>${bookId === "vacunador" ? officialVaccinationLinks() : ""}</div></aside>`;
  }
  html += `<div class="stats"><span>Nivel ${lvl}</span><span>${xp} XP</span><span>Racha ${streak} día${streak === 1 ? "" : "s"}</span></div>`;
  const bs = (progress.badges || []).map(b => BADGE[b]).filter(Boolean);
  if (bs.length) html += `<div class="badges">${bs.map(b => `<span class="badge2">${b.emoji} ${b.label}</span>`).join("")}</div>`;
  units.forEach((u, ui) => {
    const unitDone = (u.lessons || []).filter((lesson, li) => done[lessonId(ui, li)]).length;
    const isOpen = openCourseUnits.has(ui);
    html += `<section class="unit ${isOpen ? "open" : "collapsed"}"><button type="button" class="unit-h unit-toggle" data-unit="${ui}" aria-expanded="${isOpen}"><span class="unit-code">${String(ui + 1).padStart(2, "0")}</span><span class="unit-title"><b>${esc(u.emoji || "")}&nbsp; ${esc(u.title)}</b><small>${unitDone}/${(u.lessons || []).length} lecciones</small></span><span class="unit-chevron" aria-hidden="true">⌄</span></button><div class="lessons" ${isOpen ? "" : "hidden"}>`;
    (u.lessons || []).forEach((l, li) => {
      const d = done[lessonId(ui, li)];
      const id = lessonId(ui, li);
      const freshnessCopy = l.sourceStatus === "historical-clinical"
        ? " · Archivo clínico 2013 · verificar vigencia"
        : l.freshness === "revisar-hoy" ? " · Mundo hoy recomendado" : "";
      html += `<button type="button" class="lesson-item ${id === nextId ? "next" : ""}" data-u="${ui}" data-l="${li}"><span class="chk">${d ? "✓" : esc(String(l.chapter || li + 1).padStart(2, "0"))}</span><span class="li-txt"><b>${esc(l.title)}</b><span>${esc(l.objective || "")}</span><small class="lesson-meta">PDF ${esc(String(l.pageStart))}–${esc(String(l.pageEnd))}${freshnessCopy}</small></span>${id === nextId ? `<em class="next-label">SEGUIR</em>` : ""}</button>`;
    });
    html += `</div></section>`;
  });
  home.innerHTML = html;
  home.querySelectorAll(".lesson-item").forEach(el => el.onclick = () => openLesson(parseInt(el.dataset.u), parseInt(el.dataset.l)));
  home.querySelectorAll(".unit-toggle").forEach(toggle => toggle.onclick = () => {
    const ui = Number(toggle.dataset.unit);
    if (openCourseUnits.has(ui)) openCourseUnits.delete(ui); else openCourseUnits.add(ui);
    renderMap(bookId);
  });
}

function lessonValidationOptions(lesson, passages = []) {
  return {
    allowedPages: passages.map(passage => passage.page),
    timeSensitive: lesson?.freshness === "revisar-hoy",
    historicalClinical: lesson?.sourceStatus === "historical-clinical",
  };
}

/* Token de generación: cada apertura de lección se numera. Si la alumna abre otra lección
   (o cambia de libro) mientras una generación está en vuelo, la vieja se descarta en vez de
   pisar la pantalla nueva y, sobre todo, en vez de guardarse en la caché del libro
   equivocado. */
let lessonRunId = 0;

async function openLesson(ui, li) {
  const runId = ++lessonRunId;
  const srcBook = book;                       // libro congelado para TODA esta generación
  if (!srcBook) { toast("Esperá a que termine de cargar el libro."); return; }
  const vigente = () => runId === lessonRunId && book === srcBook;

  const u = course.units[ui]; const l = u.lessons[li];
  curLesson = { ui, li, l, u, data: null, error: null };
  show("courseHome", false); show("lessonView", true);
  $("lessonTitle").textContent = l.title;
  $("lessonObjective").textContent = l.objective || "";
  const body = $("lessonBody");
  body.innerHTML = `<div class="spinner"></div><p style="text-align:center;color:#8a9aa4">Buscando en tu biblioteca…</p>`;
  const lid = lessonId(ui, li);
  try {
    let lesson = null;
    const cacheSnap = await getDoc(doc(db, "books", srcBook.id, "lessons", lid));
    if (!vigente()) return;
    const cached = cacheSnap.exists() ? cacheSnap.data() : null;
    if (lessonCacheIsCurrent(cached, srcBook.contentVersion, COURSE_ENGINE_VERSION)) {
      try { lesson = normalizeLessonData(cached.data, lessonValidationOptions(l)); } catch { lesson = null; }
    }
    if (!lesson) {
      const passages = passagesForRange(l.pageStart, l.pageEnd, (l.title + " " + (l.topics || []).join(" ")));
      const evidenceCharacters = passages.reduce((total, passage) => total + String(passage.text || "").length, 0);
      if (passages.length < 2 || evidenceCharacters < 900) throw new Error("No encontré suficiente evidencia de esta sección para crear una lección fiable.");
      const config = bookConfig();
      /* Dos intentos automáticos: el modelo falla de vez en cuando (respuesta cortada o
         JSON ilegible) y antes ese tropiezo llegaba a la pantalla como si la lección fuera
         dudosa. El segundo intento la pide más compacta. */
      const INTENTOS = 2;
      let ultimoError = null;
      for (let intento = 1; intento <= INTENTOS && !lesson; intento++) {
        if (!vigente()) return;
        body.innerHTML = `<div class="lesson-loader"><div class="spinner"></div><b>Construyendo desde el capítulo ${esc(l.chapter || "")}</b><span>${intento > 1
          ? "El primer intento se cortó; la estoy rehaciendo más compacta."
          : "Después verifico citas, opciones y respuestas antes de mostrarla."}</span></div>`;
        try {
          const data = await apiChat({ task: "lesson", bookId: srcBook.id, bookTitle: srcBook.title, passages, mode: "flash", meta: { title: l.title, objective: l.objective, chapter: l.chapter, pageStart: l.pageStart, pageEnd: l.pageEnd, freshness: l.freshness, sourceStatus: l.sourceStatus || config?.sourceStatus || "", edition: config?.edition || "", compact: intento > 1 } });
          if (!vigente()) return;
          lesson = normalizeLessonData(data.result, lessonValidationOptions(l, passages));
        } catch (error) {
          if (!vigente()) return;
          ultimoError = error;
        }
      }
      if (!lesson) throw ultimoError || new Error("No pude construir la lección.");
      try { await setDoc(doc(db, "books", srcBook.id, "lessons", lid), { data: lesson, lessonVersion: LESSON_ENGINE_VERSION, sourceVersion: srcBook.contentVersion || null, courseVersion: COURSE_ENGINE_VERSION, createdAt: serverTimestamp(), by: curUser.email }); } catch {}
    }
    if (!vigente()) return;
    curLesson.data = lesson; curLesson.error = null;
    renderLessonSection("leccion");
  } catch (e) {
    if (!vigente()) return;
    curLesson.data = null;
    curLesson.error = e?.message || String(e);
    renderLessonError();
  }
}

/* Estado de error de la lección. Se pinta desde acá y también desde renderLessonSection,
   para que cambiar de pestaña no muestre secciones vacías ("Sin flashcards") como si la
   lección existiera pero viniera pobre. */
function renderLessonError() {
  const body = $("lessonBody");
  const tecnico = /cort[oó]|incompleta|Reintentando|tard[oó] demasiado|Error 5\d\d/i.test(curLesson.error || "");
  body.innerHTML = `<div class="lesson-error"><b>${tecnico
    ? "No pude terminar de construir esta lección."
    : "No voy a mostrarte una lección dudosa."}</b><p>${esc(curLesson.error || "")}</p>`
    + `<button class="btn btn-mint btn-sm" id="retryLesson">Reintentar generación verificada</button></div>`;
  const boton = $("retryLesson");
  if (boton) boton.onclick = () => openLesson(curLesson.ui, curLesson.li);
}
function renderLessonSection(sec) {
  const d = curLesson.data || {}; const body = $("lessonBody");
  document.querySelectorAll("#lessonSecTabs button").forEach(b => b.classList.toggle("active", b.dataset.sec === sec));
  /* Si la lección no llegó a construirse, ninguna pestaña puede fingir que sí: antes se
     podía salir del error tocando Quiz y aparecía "Esta lección no trae quiz", como si la
     fuente fuera pobre en vez de haber fallado la generación. */
  if (curLesson.error && !curLesson.data) { renderLessonError(); return; }
  if (sec === "leccion") {
    const goals = (d.learningObjectives || []).map(goal => `<li>${esc(goal)}</li>`).join("");
    const terms = (d.keyTerms || []).map(t => `<div class="term"><b>${esc(t.term)}</b>: ${esc(t.def)}</div>`).join("");
    const historicalClinical = curLesson.l.sourceStatus === "historical-clinical";
    const freshness = historicalClinical
      ? `<aside class="freshness-note clinical-archive"><span>⚕</span><div><b>Archivo clínico de 2013: estudiá el razonamiento, no ejecutes el esquema.</b><p>Las dosis, intervalos, productos, calendarios, contactos y protocolos de esta edición pueden haber cambiado. Antes de cualquier decisión real, consultá las fuentes oficiales y abrí <button type="button" id="goMundo">Mundo hoy</button>.</p>${officialVaccinationLinks()}</div></aside>`
      : curLesson.l.freshness === "revisar-hoy" ? `<aside class="freshness-note"><span>⏳</span><div><b>Primero, la edición. Después, la evidencia actual.</b><p>Esta lección explica fielmente lo que enseña el libro. Para guías, cifras o prácticas vigentes, abrí <button type="button" id="goMundo">Mundo hoy</button>: allí cualquier diferencia necesita fuentes verificables.</p></div></aside>` : "";
    body.innerHTML = freshness + (goals ? `<aside class="lesson-goals"><b>Al terminar vas a poder</b><ol>${goals}</ol></aside>` : "") + `<div class="lesson-content">${md(d.content || "(sin contenido)")}</div>` + (terms ? `<h4 class="sech">🔑 Conceptos clave</h4><div class="terms">${terms}</div>` : "") + `<div class="lessfoot"><button class="btn btn-mint btn-sm" id="lsQuiz">🎮 Comprobar dominio</button> <button class="btn btn-ghost btn-sm" id="lsAsk">🤖 Preguntarle al profe</button></div>`;
    wireCites(body);
    if ($("goMundo")) $("goMundo").onclick = () => renderLessonSection("mundo");
    $("lsQuiz").onclick = () => renderLessonSection("quiz");
    $("lsAsk").onclick = () => { switchTab("chat"); $("chatInput").value = "Sobre la lección \"" + curLesson.l.title + "\": "; $("chatInput").focus(); };
  } else if (sec === "quiz") { renderQuiz(d.quiz || []); }
  else if (sec === "unir") { renderMatch(d.keyTerms || []); }
  else if (sec === "flash") { renderFlash(d.flashcards || []); }
  else if (sec === "desafio") { renderChallenge(d.challenge); }
  else if (sec === "mundo") { renderContrast(); }
}
function renderQuiz(quiz) {
  const body = $("lessonBody");
  if (!quiz.length) { body.innerHTML = `<div class="empty">Esta lección no trae quiz.</div>`; return; }
  let answered = 0, correct = 0;
  body.innerHTML = `<div class="mastery-note"><b>Meta de dominio: ${MASTERY_SCORE}%</b><span>El quiz mezcla recuerdo, comprensión y aplicación. Cada respuesta incluye la página que la respalda.</span></div><div id="quizWrap"></div>`; const wrap = $("quizWrap");
  quiz.forEach((q, qi) => {
    const card = document.createElement("div"); card.className = "quizq";
    const level = q.level === "aplicacion" ? "Aplicación" : q.level === "recuerdo" ? "Recuerdo" : "Comprensión";
    card.innerHTML = `<div class="qlevel">${level}</div><div class="qq"><b>${qi + 1}.</b> ${esc(q.q)}</div>` + `<div class="opts">` + (q.options || []).map((o, oi) => `<button class="opt" data-oi="${oi}">${esc(o)}</button>`).join("") + `</div><div class="qexp hidden"></div>`;
    wrap.appendChild(card);
    card.querySelectorAll(".opt").forEach(btn => btn.onclick = () => {
      if (card.dataset.done) return; card.dataset.done = "1"; answered++;
      const oi = parseInt(btn.dataset.oi); const ok = oi === q.answer;
      if (ok) { correct++; btn.classList.add("ok"); } else { btn.classList.add("bad"); const good = card.querySelector(`.opt[data-oi="${q.answer}"]`); if (good) good.classList.add("ok"); }
      const exp = card.querySelector(".qexp"); exp.innerHTML = (ok ? "✅ ¡Correcto! " : "❌ ") + md(q.explain || ""); show(exp, true); wireCites(exp);
      if (answered === quiz.length) finishQuiz(correct, quiz.length);
    });
  });
}
async function finishQuiz(correct, total) {
  const pct = Math.round(correct / total * 100);
  const body = $("lessonBody");
  const res = document.createElement("div"); res.className = "quizres";
  const mastered = pct >= MASTERY_SCORE;
  res.innerHTML = `<h3>${mastered ? "🎉 Dominio demostrado" : "🧠 Todavía está creciendo"} · ${correct}/${total} (${pct}%)</h3>` + (mastered ? `<p>Superaste la meta del ${MASTERY_SCORE}%. La ruta registra esta lección como dominada.</p>` : `<p>La meta es ${MASTERY_SCORE}%. Revisá las explicaciones y probá otra vez: equivocarte acá también es estudiar.</p>`) + `<div class="quizacts"><button class="btn btn-ghost btn-sm" id="qBack">Repasar lección</button> <button class="btn btn-ghost btn-sm" id="qRetry">Reintentar quiz</button>${mastered ? ` <button class="btn btn-mint btn-sm" id="qMap">Seguir la ruta</button>` : ""}</div>`;
  body.appendChild(res); res.scrollIntoView({ behavior: "smooth" });
  $("qBack").onclick = () => renderLessonSection("leccion");
  $("qRetry").onclick = () => renderLessonSection("quiz");
  if (mastered) {
    $("qMap").onclick = () => { show("lessonView", false); show("courseHome", true); renderMap(book.id); };
    await markDone(curLesson.ui, curLesson.li, pct);
  }
}
function renderFlash(cards) {
  const body = $("lessonBody");
  if (!cards.length) { body.innerHTML = `<div class="empty">Sin flashcards.</div>`; return; }
  let deck = shuffleCards(cards), i = 0, known = 0, review = [];
  const draw = () => {
    if (i >= deck.length) {
      body.innerHTML = `<div class="flash-summary"><span>🧠</span><h3>${known}/${deck.length} recordadas</h3><p>${review.length ? `Tenés ${review.length} para reforzar. Una vuelta corta sobre los errores fija mejor la memoria.` : "¡Ronda perfecta! Mezclalas de nuevo para comprobar que no fue por el orden."}</p><button class="btn btn-mint btn-sm" id="fAgain">${review.length ? "Repasar las difíciles" : "Mezclar otra vez"}</button></div>`;
      $("fAgain").onclick = () => { deck = shuffleCards(review.length ? review : cards); i = 0; known = 0; review = []; draw(); };
      return;
    }
    body.innerHTML = `<div class="flashwrap"><div class="flash-score"><span>${i + 1}/${deck.length}</span><span>${known} seguras</span><span>${review.length} por repasar</span></div><div class="flashcard" id="fcard"><div class="fc-inner"><div class="fc-front"><small>DECILO ANTES DE GIRAR</small>${esc(deck[i].front)}</div><div class="fc-back">${esc(deck[i].back)}</div></div></div><div class="flash-rate hidden" id="flashRate"><button class="btn btn-ghost btn-sm" id="fReview">↺ Repasar</button><button class="btn btn-mint btn-sm" id="fKnown">✓ La sabía</button></div><p class="fchint">Intentá responder en voz alta y después girá la tarjeta.</p></div>`;
    $("fcard").onclick = () => { $("fcard").classList.add("flipped"); show("flashRate", true); };
    $("fReview").onclick = () => { review.push(deck[i]); i++; draw(); };
    $("fKnown").onclick = () => { known++; i++; draw(); };
  };
  draw();
}

function renderChallenge(challenge) {
  const body = $("lessonBody");
  if (!challenge?.scenario) { body.innerHTML = `<div class="empty">Esta lección todavía no trae un desafío fiable.</div>`; return; }
  body.innerHTML = `<article class="challenge-card"><div class="challenge-tag">GUARDIA DE RAZONAMIENTO</div><h3>Decidí con lo que acabás de aprender</h3><p>${esc(challenge.scenario)}</p><div class="challenge-question">${esc(challenge.q)}</div><div class="opts">${(challenge.options || []).map((option, index) => `<button class="opt" data-oi="${index}">${esc(option)}</button>`).join("")}</div><div class="qexp hidden" id="challengeExplain"></div></article>`;
  body.querySelectorAll(".opt").forEach(button => button.onclick = () => {
    if (body.querySelector(".challenge-card").dataset.done) return;
    body.querySelector(".challenge-card").dataset.done = "1";
    const selected = Number(button.dataset.oi);
    const ok = selected === challenge.answer;
    button.classList.add(ok ? "ok" : "bad");
    const right = body.querySelector(`.opt[data-oi="${challenge.answer}"]`);
    if (right) right.classList.add("ok");
    const explain = $("challengeExplain");
    explain.innerHTML = `${ok ? "✅ Buena decisión. " : "🔍 Mirá la pista clave. "}${md(challenge.explain || "")}`;
    show(explain, true); wireCites(explain);
  });
}
function renderMatch(terms) {
  const body = $("lessonBody");
  const items = (terms || []).filter(t => t && t.term && t.def).slice(0, 6);
  if (items.length < 2) { body.innerHTML = `<div class="empty">Esta lección no tiene suficientes conceptos para el juego de unir.</div>`; return; }
  const defs = items.map((t, i) => ({ i, def: t.def }));
  for (let i = defs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[defs[i], defs[j]] = [defs[j], defs[i]]; }
  body.innerHTML = `<p class="matchhead">Uní cada concepto con su definición 🔗</p><div class="matchwrap"><div class="matchcol" id="mTerms"></div><div class="matchcol" id="mDefs"></div></div><div id="mMsg"></div>`;
  const tc = $("mTerms"), dc = $("mDefs");
  items.forEach((t, i) => { const b = document.createElement("button"); b.className = "matchbtn"; b.textContent = t.term; b.dataset.i = i; tc.appendChild(b); });
  defs.forEach(d => { const b = document.createElement("button"); b.className = "matchbtn"; b.textContent = d.def; b.dataset.i = d.i; dc.appendChild(b); });
  let selTerm = null, matched = 0;
  tc.querySelectorAll(".matchbtn").forEach(b => b.onclick = () => { if (b.classList.contains("matched")) return; tc.querySelectorAll(".matchbtn").forEach(x => x.classList.remove("sel")); b.classList.add("sel"); selTerm = b; });
  dc.querySelectorAll(".matchbtn").forEach(b => b.onclick = () => {
    if (b.classList.contains("matched") || !selTerm) return;
    if (b.dataset.i === selTerm.dataset.i) {
      b.classList.add("matched"); selTerm.classList.add("matched"); selTerm.classList.remove("sel"); selTerm = null; matched++;
      if (matched === items.length) $("mMsg").innerHTML = `<div class="matchdone">🎉 ¡Todo unido! Sos una genia. Seguí con el quiz o la siguiente lección. 🧠</div>`;
    } else {
      const t = selTerm; b.classList.add("wrong"); t.classList.add("wrong");
      setTimeout(() => { b.classList.remove("wrong"); t.classList.remove("wrong", "sel"); }, 600); selTerm = null;
    }
  });
}
async function apiResearch(payload) {
  const tk = await idToken();
  const r = await fetch("/api/research", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tk }, body: JSON.stringify(payload) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || ("Error " + r.status));
  return data;
}
const RESEARCH_CACHE_VERSION = "biomed-v9";
function researchSourceType(source) {
  const types = (source.publicationTypes || []).join(" ").toLowerCase();
  if (types.includes("guideline")) return "Guía";
  if (types.includes("meta-analysis")) return "Metaanálisis";
  if (types.includes("systematic review")) return "Revisión sistemática";
  if (types.includes("review")) return "Revisión";
  if (types.includes("clinical trial")) return "Ensayo clínico";
  return "Artículo biomédico";
}
function researchDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(date) : "fecha no disponible";
}
async function renderContrast() {
  const body = $("lessonBody"); const l = curLesson.l; const cid = lessonId(curLesson.ui, curLesson.li);
  body.innerHTML = `<div class="spinner"></div><p style="text-align:center;color:#8a9aa4">Buscando evidencia biomédica y verificando cada cita… 🧬🔎</p>`;
  try {
    let txt = null, sources = [], status = "no_reliable_evidence", retrievedAt = "";
    const snap = await getDoc(doc(db, "books", book.id, "contrast", cid));
    if (snap.exists()) {
      const cached = snap.data();
      const created = cached.createdAt?.toMillis ? cached.createdAt.toMillis() : 0;
      const fresh = created && Date.now() - created < 3 * 24 * 60 * 60 * 1000;
      const sameBook = !book.contentVersion || cached.sourceVersion === book.contentVersion;
      const sameResearch = cached.researchVersion === RESEARCH_CACHE_VERSION;
      if (fresh && sameBook && sameResearch) {
        txt = cached.text; sources = cached.sources || []; status = cached.status || status; retrievedAt = cached.retrievedAt || "";
      }
    }
    if (!txt) {
      const passages = passagesForRange(l.pageStart, l.pageEnd, `${l.title} ${(l.topics || []).join(" ")}`);
      const data = await apiResearch({ topic: l.title, objective: l.objective || "", topics: l.topics || [], bookTitle: book.title, bookId: book.id, sourceStatus: l.sourceStatus || "", passages });
      txt = data.answer; sources = data.sources || []; status = data.status || status; retrievedAt = data.retrievedAt || new Date().toISOString();
      try {
        await setDoc(doc(db, "books", book.id, "contrast", cid), {
          text: txt, sources, status, retrievedAt, researchVersion: RESEARCH_CACHE_VERSION,
          sourceVersion: book.contentVersion || null, createdAt: serverTimestamp(),
        });
      } catch {}
    }
    const statusCopy = status === "contrast_found"
      ? ["Contraste respaldado", "Encontré diferencias o debates que conservaron evidencia válida del libro y de PubMed."]
      : status === "current_evidence_only"
        ? ["Sin cambio demostrable", "Hay evidencia actual sobre el tema, pero no alcanza para afirmar que el libro esté desactualizado."]
        : ["Sin evidencia suficiente", "La página prefiere dejar el contraste vacío antes que completar algo sin respaldo."];
    const statusHtml = `<div class="evidence-status ${esc(status)}"><span class="evidence-status-dot"></span><div><b>${statusCopy[0]}</b><small>${statusCopy[1]} Consulta: ${esc(researchDate(retrievedAt))}.</small></div></div>`;
    const srcHtml = sources.length ? `<div class="sources evidence-sources"><div class="sources-head"><b>🧬 Evidencia biomédica consultada</b><span>PubMed · ${sources.length} fuente${sources.length === 1 ? "" : "s"}</span></div>${sources.map(s => `<a class="source-item" href="${esc(s.url)}" target="_blank" rel="noopener"><b>Fuente ${esc(s.id || "")} · ${esc(s.title)}</b><span>${esc([s.journal, s.year, researchSourceType(s), s.pmid ? `PMID ${s.pmid}` : ""].filter(Boolean).join(" · "))}</span></a>`).join("")}</div>` : "";
    const officialHtml = book.id === "vacunador"
      ? `<aside class="official-evidence-gate"><b>La fuente operativa es oficial, no PubMed</b><p>Usá la literatura biomédica para comprender la evidencia. Para calendario, esquemas, intervalos, productos, cadena de frío, ESAVI o lugares de vacunación, comprobá siempre la publicación vigente del Ministerio de Salud.</p>${officialVaccinationLinks()}</aside>`
      : "";
    body.innerHTML = `${officialHtml}${statusHtml}<div class="lesson-content contrast">${md(txt)}</div>${srcHtml}<p class="disclaimer">🔎 Búsqueda automatizada en PubMed. Las afirmaciones solo se muestran cuando conservan una cita textual verificable de la fuente y, para declarar cambios, también del libro. Sigue siendo material educativo y no reemplaza fuentes oficiales, guías clínicas ni criterio profesional.</p><div style="margin-top:10px"><button class="btn btn-ghost btn-sm" id="reContrast">🔄 Buscar evidencia nueva</button></div>`;
    wireCites(body);
    $("reContrast").onclick = async () => { try { await deleteDoc(doc(db, "books", book.id, "contrast", cid)); } catch {} renderContrast(); };
  } catch (e) { body.innerHTML = `<div class="empty">No se pudo investigar: ${esc(e.message)}</div>`; }
}

/* progreso */
async function loadProgress(bookId) {
  progress = {};
  try { const s = await getDoc(doc(db, "users", curUser.uid, "progress", bookId)); if (s.exists()) progress = s.data(); } catch {}
}
async function markDone(ui, li, score) {
  const id = lessonId(ui, li);
  const beforeLevel = progress.level || 1;
  progress.done = progress.done || {}; progress.done[id] = true;
  progress.scores = progress.scores || {}; progress.scores[id] = Math.max(progress.scores && progress.scores[id] || 0, score);
  progress.awarded = progress.awarded || {};
  const firstTime = !progress.awarded[id];
  if (firstTime) { progress.xp = (progress.xp || 0) + score; progress.awarded[id] = true; }
  progress.level = Math.floor((progress.xp || 0) / 100) + 1;
  const today = new Date().toISOString().slice(0, 10);
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (progress.lastStudy === today) { /* mismo día */ } else if (progress.lastStudy === yest) progress.streak = (progress.streak || 0) + 1; else progress.streak = 1;
  progress.lastStudy = today;
  progress.badges = progress.badges || [];
  const add = (b) => { if (!progress.badges.includes(b)) progress.badges.push(b); };
  const dc = Object.keys(progress.done).length;
  add("primera"); if (dc >= 5) add("cinco"); if (score >= 100) add("perfecto"); if ((progress.streak || 0) >= 3) add("racha3"); if (anyUnitComplete()) add("unidad"); if (totalLessons() && dc >= totalLessons()) add("curso");
  try { await setDoc(doc(db, "users", curUser.uid, "progress", book.id), { done: progress.done, scores: progress.scores, awarded: progress.awarded, xp: progress.xp || 0, level: progress.level, streak: progress.streak || 0, lastStudy: progress.lastStudy, badges: progress.badges, updatedAt: serverTimestamp() }, { merge: true }); } catch {}
  if (firstTime) toast(`+${score} XP ✨`);
  if ((progress.level || 1) > beforeLevel) setTimeout(() => toast(`🏆 ¡Subiste a nivel ${progress.level}!`), 900);
  renderMap(book.id);
}

/* ---------------- CHAT (multi-chat + caché) ---------------- */
const CHAT_CACHE_VERSION = "v4";
const CHAT_CACHE_TTL = 14 * 24 * 60 * 60 * 1000;
let curChatId = null, chats = [], chatBusy = false;
function setChatSignal(text, state = "") { const el = $("chatSignal"); if (!el) return; el.textContent = text; el.dataset.state = state; }
function addMsg(role, html, cls = "") { const d = document.createElement("div"); d.className = "msg " + role + (cls ? " " + cls : ""); d.innerHTML = html; $("chatMsgs").appendChild(d); $("chatMsgs").scrollTop = $("chatMsgs").scrollHeight; wireCites(d); return d; }
function renderChatMessages() {
  const box = $("chatMsgs"); box.innerHTML = "";
  if (!chatHistory.length) { box.innerHTML = `<div class="empty"><b>La memoria está limpia.</b><br>Traé una duda, una relación clínica o algo que quieras entender de verdad.</div>`; return; }
  /* Al reabrir una conversación guardada se respetan las páginas que se verificaron cuando
     se generó la respuesta (`m.pages`). Si el mensaje es viejo y no las trae, se usa un
     conjunto vacío a propósito: ninguna cita queda clicable. Falla del lado seguro, porque
     dar por verificada una página que quizá el modelo inventó es peor que no ofrecer el
     atajo. */
  chatHistory.forEach(m => addMsg(
    m.role === "assistant" ? "bot" : "user",
    m.role === "assistant" ? md(m.content, new Set(Array.isArray(m.pages) ? m.pages : [])) : esc(m.content)
  ));
}
function startChats(user) {
  const col = collection(db, "users", user.uid, "chats");
  unsubChats = onSnapshot(query(col, orderBy("updatedAt", "desc")), qs => {
    chats = []; qs.forEach(d => chats.push({ id: d.id, ...d.data() }));
    refreshChatPicker();
  }, () => {});
}
function chatsForCurrentBook() { return book ? chats.filter(c => !c.bookId || c.bookId === book.id) : chats; }
function refreshChatPicker() {
  const selEl = $("chatSel"); if (!selEl) return;
  const available = chatsForCurrentBook();
  selEl.innerHTML = available.length ? available.map(c => `<option value="${c.id}">${esc(c.title || "Conversación")}</option>`).join("") : `<option value="">Nueva conversación</option>`;
  const current = available.find(c => c.id === curChatId);
  if (current) { selEl.value = current.id; return; }
  if (available.length) { loadChat(available[0].id); selEl.value = available[0].id; }
  else { curChatId = null; chatHistory = []; renderChatMessages(); setChatSignal("Memoria lista", "ready"); }
}
function loadChat(id) { const c = chats.find(x => x.id === id); curChatId = c ? c.id : null; chatHistory = c ? (c.messages || []).slice() : []; renderChatMessages(); setChatSignal(c ? "Contexto recuperado" : "Memoria lista", "ready"); }
function newChat() { curChatId = null; chatHistory = []; renderChatMessages(); setChatSignal("Nueva memoria", "ready"); $("chatInput") && $("chatInput").focus(); toast("Nueva conversación"); }
async function deleteChat() {
  if (!curChatId) { chatHistory = []; renderChatMessages(); return; }
  const id = curChatId; try { await deleteDoc(doc(db, "users", curUser.uid, "chats", id)); } catch {}
  curChatId = null; chatHistory = []; renderChatMessages(); toast("Chat borrado 🗑");
}
async function persistChat() {
  if (!curUser) return;
  const title = ((chatHistory.find(m => m.role === "user") || {}).content || "Chat").replace(/^\[fragmento:[^\]]*\]\s*/, "").slice(0, 40) || "Chat";
  const data = { title, bookId: book ? book.id : "", messages: chatHistory.slice(-40), updatedAt: serverTimestamp() };
  try {
    if (!curChatId) { const ref = await addDoc(collection(db, "users", curUser.uid, "chats"), { ...data, createdAt: serverTimestamp() }); curChatId = ref.id; }
    else { await setDoc(doc(db, "users", curUser.uid, "chats", curChatId), data, { merge: true }); }
  } catch {}
}
function cacheKeyForChat(question, mode) {
  const sourceVersion = book?.contentVersion || book?.cacheVersion || "legacy";
  const userScope = curUser?.uid || "anonymous";
  /* La lección abierta entra en la clave porque entra en la respuesta: retrievalQuery le
     suma su título y sus temas, así que la misma pregunta desde dos lecciones distintas
     recupera fragmentos distintos y merece respuestas distintas. */
  const leccion = curLesson ? `${curLesson.ui}-${curLesson.li}` : "sin-leccion";
  return `chatc|${CHAT_CACHE_VERSION}|${userScope}|${book.id}|${sourceVersion}|${leccion}|${mode}|${question.toLowerCase()}`;
}
/* La caché guarda también qué páginas se habían verificado, para que una respuesta reusada
   conserve exactamente las mismas citas clicables que tuvo la primera vez. */
function cachedChatAnswer(key) {
  try {
    const raw = localStorage.getItem(key); if (!raw) return null;
    const item = JSON.parse(raw);
    if (!item || typeof item.answer !== "string" || Date.now() - item.createdAt > CHAT_CACHE_TTL) { localStorage.removeItem(key); return null; }
    return { answer: item.answer, pages: Array.isArray(item.pages) ? item.pages : [] };
  } catch { return null; }
}
function storeChatAnswer(key, answer, pages = []) { try { localStorage.setItem(key, JSON.stringify({ answer, pages, createdAt: Date.now() })); } catch {} }
function retrievalQuery(question, selectedText) {
  const recent = chatHistory.slice(-8).map(m => String(m.content || "").slice(0, m.role === "assistant" ? 650 : 1000)).join(" ");
  const lessonContext = curLesson ? `${curLesson.l.title} ${(curLesson.l.topics || []).join(" ")}` : "";
  return [lessonContext, recent, selectedText, question].filter(Boolean).join(" ");
}
async function sendChat() {
  if (chatBusy) return;
  const q = $("chatInput").value.trim();
  if (!q && !pendingSel) return;
  if (!book) { toast("Elegí un libro."); return; }
  const mode = (document.querySelector('input[name="mode"]:checked') || {}).value || "flash";
  const selText = pendingSel; pendingSel = ""; clearSelBanner();
  addMsg("user", (selText ? `📌 <i>"${esc(selText.slice(0, 120))}"</i><br>` : "") + esc(q || "Explicame esto."));
  $("chatInput").value = "";
  // caché para ahorrar tokens: preguntas sueltas (primer mensaje, sin selección)
  const cacheKey = (!selText && chatHistory.length === 0) ? cacheKeyForChat(q, mode) : null;
  const cached = cacheKey ? cachedChatAnswer(cacheKey) : null;
  if (cached) {
    addMsg("bot", md(cached.answer, new Set(cached.pages)));
    chatHistory.push({ role: "user", content: q }, { role: "assistant", content: cached.answer, pages: cached.pages });
    setChatSignal("Respuesta local · 0 tokens", "cached"); persistChat(); return;
  }
  chatBusy = true; $("chatSend").disabled = true; $("chatInput").setAttribute("aria-busy", "true"); setChatSignal("Razonando con el libro", "thinking");
  const thinking = addMsg("bot", `<span class="think dots">Procesando · V4 Flash</span>`, "think");
  try {
    const qExpanded = retrievalQuery(q, selText);
    const passages = diverseSearch(bookIndex, qExpanded, 14).map(p => ({ page: p.page, printed: p.printed, text: p.text }));
    const config = bookConfig();
    const data = await apiChat({
      task: "chat",
      bookId: book.id,
      bookTitle: book.title,
      passages,
      question: q,
      selectedText: selText,
      /* Solo role y content: el historial guarda además las páginas verificadas de cada
         respuesta, y mandar campos extra a una API compatible con OpenAI la hace fallar. */
      history: chatHistory.slice(-20).map(m => ({ role: m.role, content: m.content })),
      mode,
      meta: { sourceStatus: config?.sourceStatus || "", edition: config?.edition || "" },
    });
    thinking.remove();
    /* Solo las páginas que de verdad se recuperaron pueden mostrarse como cita clicable. */
    const paginasVerificadas = new Set(passages.map(p => Number(p.page)).filter(Number.isFinite));
    const ans = data.answer || "(sin respuesta)"; addMsg("bot", md(ans, paginasVerificadas));
    const paginas = [...paginasVerificadas];
    chatHistory.push({ role: "user", content: (selText ? `[fragmento: ${selText.slice(0, 300)}] ` : "") + (q || "Explicame esto.") });
    chatHistory.push({ role: "assistant", content: ans, pages: paginas });
    if (cacheKey) storeChatAnswer(cacheKey, ans, paginas);
    const hit = Number(data.usage?.prompt_cache_hit_tokens || 0), miss = Number(data.usage?.prompt_cache_miss_tokens || 0);
    const cachePct = hit + miss ? Math.round(hit / (hit + miss) * 100) : null;
    setChatSignal(`V4 Flash${cachePct == null ? "" : ` · caché ${cachePct}%`}`, "ready");
    persistChat();
  } catch (e) { thinking.remove(); addMsg("bot", "⚠️ " + esc(e.message || e), "think"); if (!$("chatInput").value) $("chatInput").value = q; setChatSignal("No se pudo responder", "error"); }
  finally { chatBusy = false; $("chatSend").disabled = false; $("chatInput").removeAttribute("aria-busy"); }
}

/* ---------------- NOTAS ---------------- */
const NOTE_DICTATION_READY = "Dictá tu nota; AVICI no guarda el audio.";
let noteRecognition = null, noteDictationActive = false, noteDictationBase = "", noteDictationError = "", noteDictationAbortSilently = false, noteDictationTimer = null;

function setNoteDictationState(state, message = NOTE_DICTATION_READY) {
  const compose = document.querySelector(".note-compose"), button = $("noteMic"), label = $("noteMicLabel"), status = $("noteDictationStatus");
  if (!compose || !button || !label || !status) return;
  clearTimeout(noteDictationTimer);
  compose.dataset.dictation = state;
  button.dataset.state = state;
  const listening = state === "listening";
  button.setAttribute("aria-pressed", String(listening));
  button.setAttribute("aria-label", listening ? "Detener dictado" : "Comenzar dictado");
  label.textContent = listening ? "Detener" : "Dictar";
  status.querySelector("span").textContent = message;
}

function resetNoteDictationStatus(delay = 3200) {
  clearTimeout(noteDictationTimer);
  noteDictationTimer = setTimeout(() => { if (!noteDictationActive) setNoteDictationState("ready"); }, delay);
}

function stopNoteDictation(silent = false) {
  if (!noteRecognition || !noteDictationActive) return;
  noteDictationAbortSilently = silent;
  try { silent ? noteRecognition.abort() : noteRecognition.stop(); }
  catch { noteDictationActive = false; setNoteDictationState("ready"); }
}

function dictationErrorMessage(code) {
  if (code === "not-allowed" || code === "service-not-allowed") return "Permití el acceso al micrófono para poder dictar.";
  if (code === "audio-capture") return "No encontré un micrófono disponible.";
  if (code === "network") return "El dictado necesita conexión. Probá nuevamente.";
  if (code === "no-speech") return "No escuché ninguna voz. Tocá Dictar e intentá otra vez.";
  return "No pude iniciar el dictado. Probá nuevamente.";
}

function setupNoteDictation() {
  const button = $("noteMic"), input = $("noteInput"); if (!button || !input) return;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    button.disabled = true;
    button.title = "Este navegador no ofrece dictado directo. Podés usar el micrófono del teclado.";
    setNoteDictationState("unsupported", "Usá el micrófono del teclado para dictar en este navegador.");
    button.setAttribute("aria-label", "Dictado directo no disponible; usá el micrófono del teclado");
    return;
  }

  try { noteRecognition = new SpeechRecognition(); }
  catch {
    button.disabled = true;
    button.title = "Este navegador no ofrece dictado directo. Podés usar el micrófono del teclado.";
    setNoteDictationState("unsupported", "Usá el micrófono del teclado para dictar en este navegador.");
    button.setAttribute("aria-label", "Dictado directo no disponible; usá el micrófono del teclado");
    return;
  }
  const browserLanguage = navigator.language || "es-AR";
  noteRecognition.lang = browserLanguage.toLowerCase().startsWith("es") ? browserLanguage : "es-AR";
  noteRecognition.continuous = true;
  noteRecognition.interimResults = true;
  noteRecognition.maxAlternatives = 1;

  noteRecognition.onstart = () => {
    noteDictationActive = true;
    setNoteDictationState("listening", "Escuchando… hablá con calma y tocá Detener al terminar.");
  };
  noteRecognition.onresult = event => {
    const transcript = Array.from(event.results)
      .map(result => String(result[0]?.transcript || "").trim())
      .filter(Boolean)
      .join(" ");
    input.value = noteDictationBase + transcript;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  noteRecognition.onerror = event => {
    if (event.error === "aborted" && noteDictationAbortSilently) return;
    noteDictationError = dictationErrorMessage(event.error);
    setNoteDictationState("error", noteDictationError);
  };
  noteRecognition.onend = () => {
    noteDictationActive = false;
    if (noteDictationAbortSilently) {
      noteDictationAbortSilently = false; noteDictationError = ""; setNoteDictationState("ready"); return;
    }
    if (noteDictationError) {
      setNoteDictationState("error", noteDictationError); noteDictationError = ""; resetNoteDictationStatus(4200); return;
    }
    setNoteDictationState("ready", "Dictado listo. Podés editarlo o guardar la nota.");
    resetNoteDictationStatus();
  };

  button.onclick = () => {
    if (noteDictationActive) { stopNoteDictation(); return; }
    noteDictationError = ""; noteDictationAbortSilently = false;
    noteDictationBase = input.value.trimEnd();
    if (noteDictationBase) noteDictationBase += " ";
    try {
      noteDictationActive = true;
      setNoteDictationState("listening", "Activando el micrófono…");
      noteRecognition.start();
      input.focus();
    } catch {
      noteDictationActive = false;
      setNoteDictationState("error", "El micrófono ya está ocupado. Esperá un momento e intentá otra vez.");
      resetNoteDictationStatus(4200);
    }
  };
}

function startNotes(user) {
  const col = collection(db, "users", user.uid, "notes");
  unsubNotes = onSnapshot(query(col, orderBy("createdAt", "desc")), qs => {
    const list = $("notesList");
    if (qs.empty) { list.innerHTML = `<div class="empty">Todavía no tenés notas.</div>`; return; }
    list.innerHTML = "";
    qs.forEach(d => {
      const nd = d.data(); const card = document.createElement("div"); card.className = "notecard";
      const pg = nd.page ? `<span class="pg" data-pg="${nd.page}">📄 pág. ${nd.page}</span>` : "";
      card.innerHTML = `<div class="meta">${pg}<span>${esc(nd.bookId || "")}</span></div>${esc(nd.text)}<div class="acts"><button class="btn btn-ghost btn-sm bAsk">🤖 Preguntar</button><button class="btn btn-bad btn-sm bDel">Borrar</button></div>`;
      card.querySelector(".bDel").onclick = () => deleteDoc(doc(db, "users", user.uid, "notes", d.id)).catch(e => toast("No se pudo borrar: " + e.message));
      card.querySelector(".bAsk").onclick = () => { pendingSel = nd.text; showSelBanner(nd.text); switchTab("chat"); $("chatInput").focus(); };
      const pgEl = card.querySelector(".pg"); if (pgEl) pgEl.onclick = () => goToPage(parseInt(pgEl.dataset.pg));
      list.appendChild(card);
    });
  }, e => { $("notesList").innerHTML = `<div class="empty">Error: ${esc(e.message)}</div>`; });
}
async function addNote() {
  stopNoteDictation(true);
  const t = $("noteInput").value.trim(); if (!t || !curUser) return;
  try { await addDoc(collection(db, "users", curUser.uid, "notes"), { text: t, bookId: book ? book.id : "", page: curPage || null, createdAt: serverTimestamp() }); $("noteInput").value = ""; toast("Nota guardada ✍️"); }
  catch (e) { toast("No se pudo guardar: " + (e.message || e)); }
}

/* ---------------- SELECCIÓN ---------------- */
function clearSelBanner() { const b = $("selBanner"); if (b) b.remove(); }
function showSelBanner(text) {
  clearSelBanner();
  const div = document.createElement("div"); div.id = "selBanner";
  div.className = "selection-banner";
  div.innerHTML = `<span style="flex:1">📌 Sobre: "${esc(text.slice(0, 90))}${text.length > 90 ? "…" : ""}"</span><button style="border:none;background:transparent;cursor:pointer;font-weight:800;color:#e35d6a">✕</button>`;
  div.querySelector("button").onclick = () => { pendingSel = ""; clearSelBanner(); };
  $("panel-chat").insertBefore(div, $("chatMsgs"));
}
function setupSelection() {
  const pop = $("selPopup");
  const place = () => {
    const sel = window.getSelection(); const txt = sel && sel.toString().trim();
    const container = $("pageContent");
    const inLesson = document.querySelector(".lesson-content");
    const anchorOk = txt && (container.contains(sel.anchorNode) || (inLesson && inLesson.contains(sel.anchorNode)));
    if (!txt || txt.length < 4 || !anchorOk) { show(pop, false); return; }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    pop.style.position = "fixed"; pop.style.left = Math.min(window.innerWidth - 170, Math.max(8, rect.left)) + "px"; pop.style.top = Math.max(8, rect.top - 46) + "px";
    show(pop, true); pop._sel = txt;
  };
  document.addEventListener("mouseup", () => setTimeout(place, 10));
  document.addEventListener("touchend", () => setTimeout(place, 10));
  document.addEventListener("mousedown", e => { if (!pop.contains(e.target)) show(pop, false); });
  $("selAsk").onclick = () => { const t = pop._sel; if (!t) return; pendingSel = t; showSelBanner(t); switchTab("chat"); show(pop, false); $("chatInput").focus(); };
  $("selNote").onclick = async () => { const t = pop._sel; if (!t || !curUser) return; try { await addDoc(collection(db, "users", curUser.uid, "notes"), { text: t, bookId: book ? book.id : "", page: curPage || null, createdAt: serverTimestamp() }); toast("Nota guardada ✍️"); } catch (e) { toast("No se pudo: " + e.message); } show(pop, false); };
}
// tabs de secciones de lección (delegación)
document.addEventListener("click", (e) => { const b = e.target.closest("#lessonSecTabs button"); if (b) renderLessonSection(b.dataset.sec); });
setupNoteDictation();
