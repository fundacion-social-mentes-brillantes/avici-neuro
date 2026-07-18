// ===== AVICI — Curso interactivo por libro (auth + admin + curso + libro + bot + notas) =====
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
];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

const $ = (id) => document.getElementById(id);
const show = (el, on = true) => { const e = typeof el === "string" ? $(el) : el; if (e) e.classList.toggle("hidden", !on); };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const toast = (m) => window._toast ? window._toast(m) : console.log(m);
let isAdmin = false, curUser = null;

async function idToken() { return auth.currentUser ? await auth.currentUser.getIdToken() : null; }
async function apiChat(payload) {
  const tk = await idToken();
  const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tk }, body: JSON.stringify(payload) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || ("Error " + r.status));
  return data;
}

/* ---------- markdown-lite + citas ---------- */
function md(text) {
  let h = esc(text);
  h = h.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>");
  h = h.replace(/^\s*###?\s*(.+)$/gm, "<h4>$1</h4>");
  h = h.replace(/\(p[aá]g\.?\s*(\d{1,4})[^)]*\)/gi, (m, n) => `<button class="cite" data-pg="${n}">📄 pág. ${n}</button>`);
  h = h.replace(/^\s*[-*]\s+(.+)$/gm, "• $1");
  h = h.replace(/\n/g, "<br>");
  return h;
}
function wireCites(el) { el.querySelectorAll(".cite").forEach(b => b.onclick = () => goToPage(parseInt(b.dataset.pg))); }

/* ---------------- AUTH ---------------- */
let unsubUserDoc = null, unsubPending = null, unsubApproved = null, unsubNotes = null, unsubProgress = null;
function cleanup() { [unsubUserDoc, unsubPending, unsubApproved, unsubNotes, unsubProgress].forEach(f => { try { f && f(); } catch {} }); unsubUserDoc = unsubPending = unsubApproved = unsubNotes = unsubProgress = null; }
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
const CARDS = ["monitorCard", "recetaCard"];
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
      const old = await getDocs(collection(db, "books", bookId, "bundles"));
      if (!old.empty) { let b = writeBatch(db), n = 0; for (const d of old.docs) { b.delete(d.ref); if (++n >= 400) { await b.commit(); b = writeBatch(db); n = 0; } } if (n) await b.commit(); }
      await setDoc(doc(db, "books", bookId), { title, pageCount: pages.length, bundleCount: pieces.length, updatedAt: serverTimestamp() }, { merge: true });
      let batch = writeBatch(db), ops = 0;
      for (let i = 0; i < pieces.length; i++) { batch.set(doc(db, "books", bookId, "bundles", String(i)), { i, data: pieces[i] }); if (++ops >= 400) { await batch.commit(); batch = writeBatch(db); ops = 0; ilog(`  ${bookId}: ${i + 1}/${pieces.length}`); } }
      if (ops) await batch.commit();
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
const STOP = new Set("de la que el en y los las un una para con por del al se su sus lo como mas más o e ni pero si no es son ser este esta estos estas entre sobre cuando cada muy sin ese esa hay han ha".split(" "));
function tokenize(s) { return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !STOP.has(w)); }

function initStudy(user) {
  if (studyInit) { return; } studyInit = true;
  const sel = $("bookSel"); sel.innerHTML = BOOKS.map(b => `<option value="${b.id}">${esc(b.title)}</option>`).join("");
  sel.addEventListener("change", () => selectBook(sel.value));
  document.querySelectorAll(".tabs button").forEach(btn => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));
  // reader
  $("pgPrev").onclick = () => renderPage(curPage - 1);
  $("pgNext").onclick = () => renderPage(curPage + 1);
  $("pgInput").addEventListener("change", () => renderPage(parseInt($("pgInput").value) || 1));
  $("searchBtn").onclick = doSearch; $("searchInput").addEventListener("keydown", e => { if (e.key === "Enter") doSearch(); });
  // chat
  $("chatSend").onclick = sendChat; $("chatInput").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } });
  // notes
  $("noteAdd").onclick = addNote; startNotes(user);
  // course
  $("genCourseBtn") && ($("genCourseBtn").onclick = generateCourse);
  $("btnBackMap") && ($("btnBackMap").onclick = () => { show("lessonView", false); show("courseHome", true); });
  setupSelection();
  selectBook(sel.value);
}
function switchTab(tab) {
  document.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  $("panel-" + tab).classList.add("active");
}

async function selectBook(bookId) {
  book = null; bookIndex = null; course = null; chatHistory = [];
  show("lessonView", false); show("courseHome", true);
  $("courseHome").innerHTML = ""; $("pageContent").textContent = "";
  await loadBookData(bookId);
  await loadProgress(bookId);
  await loadCourse(bookId);
}

async function loadBookData(bookId) {
  show("bookLoading", true); $("bookLoadingTxt").textContent = "Cargando libro…";
  try {
    const cache = await idb(); let data = await cache.get(bookId);
    if (!data || !data.pages) {
      const meta = await getDoc(doc(db, "books", bookId));
      if (!meta.exists()) { show("bookLoading", false); return; }
      const m = meta.data();
      $("bookLoadingTxt").textContent = `Descargando ${m.title}… (una sola vez)`;
      const bs = await getDocs(collection(db, "books", bookId, "bundles"));
      const arr = []; bs.forEach(d => arr.push(d.data())); arr.sort((a, b) => a.i - b.i);
      data = { id: bookId, title: m.title, pages: JSON.parse(arr.map(x => x.data).join("")) };
      await cache.put(bookId, data);
    }
    book = data;
    $("bookLoadingTxt").textContent = "Preparando buscador…";
    bookIndex = buildIndex(book.pages);
    renderPage(1);
  } catch (e) { $("pageContent").innerHTML = `<div class="empty">No se pudo cargar el libro: ${esc(e.message || e)}</div>`; }
  show("bookLoading", false);
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
function passagesForRange(pageStart, pageEnd, topicStr, k = 12) {
  if (!bookIndex) return [];
  let res = search(bookIndex, topicStr || "", k, [pageStart || 1, pageEnd || (book ? book.pages.length : 1)]);
  if (res.length < 4) { // fallback: primeras chunks del rango
    res = bookIndex.chunks.filter(c => c.page >= (pageStart || 1) && c.page <= (pageEnd || 1)).slice(0, k);
  }
  return res.map(p => ({ page: p.page, printed: p.printed, text: p.text }));
}

function renderPage(n) {
  if (!book) return;
  n = Math.max(1, Math.min(book.pages.length, n | 0)); curPage = n;
  const p = book.pages[n - 1];
  $("pgInput").value = n; $("pgTotal").textContent = book.pages.length;
  $("pageContent").innerHTML = `<span class="pgnum">Página ${n}${p.printed ? " · impresa " + p.printed : ""}</span>\n` + esc(p.text || "(página en blanco)");
  $("pageContent").scrollTop = 0;
}
window.goToPage = (n) => { switchTab("libro"); renderPage(n); };
function doSearch() {
  const q = $("searchInput").value.trim(); const box = $("searchResults");
  if (!q || !bookIndex) { show(box, false); return; }
  const res = search(bookIndex, q, 12);
  if (!res.length) { box.innerHTML = `<div class="empty">Sin resultados para "${esc(q)}".</div>`; show(box, true); return; }
  box.innerHTML = res.map(r => `<div class="sres" data-pg="${r.page}"><b>pág. ${r.page}</b> — ${esc(r.text.slice(0, 160))}…</div>`).join("");
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
    const snap = await getDoc(doc(db, "books", bookId, "course", "main"));
    if (snap.exists()) { course = snap.data().data; renderMap(bookId); }
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
  setg("Leyendo el índice del libro…");
  try {
    const passages = tocPassages();
    setg("Diseñando el curso con IA (v4-pro)… esto tarda un poco ⏳");
    const data = await apiChat({ task: "curriculum", bookTitle: book.title, passages, mode: "pro" });
    const c = data.result;
    if (!c || !c.units) throw new Error("El curso no vino con el formato esperado.");
    await setDoc(doc(db, "books", book.id, "course", "main"), { data: c, createdAt: serverTimestamp(), by: curUser.email });
    course = c; toast("¡Curso generado! 🎓"); renderMap(book.id);
  } catch (e) { setg("❌ " + (e.message || e)); toast("No se pudo generar: " + (e.message || e)); }
}
function lessonId(ui, li) { return `u${ui}l${li}`; }
function renderMap(bookId) {
  const home = $("courseHome");
  const units = (course && course.units) || [];
  const done = (progress && progress.done) || {};
  let total = 0, doneCount = 0;
  units.forEach((u, ui) => (u.lessons || []).forEach((l, li) => { total++; if (done[lessonId(ui, li)]) doneCount++; }));
  const pct = total ? Math.round(doneCount / total * 100) : 0;
  let html = `<div class="courseHead"><h2>🎓 ${esc(course.title || book.title)}</h2><div class="progbar"><div style="width:${pct}%"></div></div><div class="progtxt">${doneCount}/${total} lecciones · ${pct}%</div></div>`;
  if (isAdmin) html += `<button class="btn btn-ghost btn-sm" id="regenCourse" style="margin-bottom:12px">🔁 Regenerar curso</button>`;
  units.forEach((u, ui) => {
    html += `<div class="unit"><div class="unit-h">${u.emoji || "📚"} <b>${esc(u.title)}</b></div><div class="lessons">`;
    (u.lessons || []).forEach((l, li) => {
      const d = done[lessonId(ui, li)];
      html += `<div class="lesson-item" data-u="${ui}" data-l="${li}"><span class="chk">${d ? "✅" : "▶️"}</span><div class="li-txt"><b>${esc(l.title)}</b><span>${esc(l.objective || "")}</span></div></div>`;
    });
    html += `</div></div>`;
  });
  home.innerHTML = html;
  home.querySelectorAll(".lesson-item").forEach(el => el.onclick = () => openLesson(parseInt(el.dataset.u), parseInt(el.dataset.l)));
  if (isAdmin && $("regenCourse")) $("regenCourse").onclick = () => { if (confirm("¿Regenerar el curso? Se reemplaza el actual.")) { $("courseHome").innerHTML = `<div class="coursegen"><div class="em">🎓</div><div id="genLog" class="genlog"></div></div>`; generateCourse(); } };
}

async function openLesson(ui, li) {
  const u = course.units[ui]; const l = u.lessons[li]; curLesson = { ui, li, l, u };
  show("courseHome", false); show("lessonView", true);
  $("lessonTitle").innerHTML = `${u.emoji || "📚"} ${esc(l.title)}`;
  $("lessonObjective").textContent = l.objective || "";
  const body = $("lessonBody"); body.innerHTML = `<div class="spinner"></div><p style="text-align:center;color:#8a9aa4">Preparando tu lección con IA… ✨</p>`;
  const lid = lessonId(ui, li);
  try {
    let lesson = null;
    const cacheSnap = await getDoc(doc(db, "books", book.id, "lessons", lid));
    if (cacheSnap.exists()) lesson = cacheSnap.data().data;
    if (!lesson) {
      const passages = passagesForRange(l.pageStart, l.pageEnd, (l.title + " " + (l.topics || []).join(" ")));
      const data = await apiChat({ task: "lesson", bookTitle: book.title, passages, mode: "pro", meta: { title: l.title, objective: l.objective } });
      lesson = data.result;
      try { await setDoc(doc(db, "books", book.id, "lessons", lid), { data: lesson, createdAt: serverTimestamp(), by: curUser.email }); } catch {}
    }
    curLesson.data = lesson; renderLessonSection("leccion");
  } catch (e) { body.innerHTML = `<div class="empty">No se pudo generar la lección: ${esc(e.message)}</div>`; }
}
function renderLessonSection(sec) {
  const d = curLesson.data || {}; const body = $("lessonBody");
  document.querySelectorAll("#lessonSecTabs button").forEach(b => b.classList.toggle("active", b.dataset.sec === sec));
  if (sec === "leccion") {
    const terms = (d.keyTerms || []).map(t => `<div class="term"><b>${esc(t.term)}</b>: ${esc(t.def)}</div>`).join("");
    body.innerHTML = `<div class="lesson-content">${md(d.content || "(sin contenido)")}</div>` + (terms ? `<h4 class="sech">🔑 Conceptos clave</h4><div class="terms">${terms}</div>` : "") + `<div class="lessfoot"><button class="btn btn-mint btn-sm" id="lsQuiz">🎮 Hacer el quiz</button> <button class="btn btn-ghost btn-sm" id="lsAsk">🤖 Preguntarle al profe</button></div>`;
    wireCites(body);
    $("lsQuiz").onclick = () => renderLessonSection("quiz");
    $("lsAsk").onclick = () => { switchTab("chat"); $("chatInput").value = "Sobre la lección \"" + curLesson.l.title + "\": "; $("chatInput").focus(); };
  } else if (sec === "quiz") { renderQuiz(d.quiz || []); }
  else if (sec === "flash") { renderFlash(d.flashcards || []); }
  else if (sec === "mundo") { renderContrast(); }
}
function renderQuiz(quiz) {
  const body = $("lessonBody");
  if (!quiz.length) { body.innerHTML = `<div class="empty">Esta lección no trae quiz.</div>`; return; }
  let answered = 0, correct = 0;
  body.innerHTML = `<div id="quizWrap"></div>`; const wrap = $("quizWrap");
  quiz.forEach((q, qi) => {
    const card = document.createElement("div"); card.className = "quizq";
    card.innerHTML = `<div class="qq"><b>${qi + 1}.</b> ${esc(q.q)}</div>` + `<div class="opts">` + (q.options || []).map((o, oi) => `<button class="opt" data-oi="${oi}">${esc(o)}</button>`).join("") + `</div><div class="qexp hidden"></div>`;
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
  res.innerHTML = `<h3>${pct >= 60 ? "🎉 ¡Aprobaste!" : "💪 ¡Casi!"} ${correct}/${total} (${pct}%)</h3>` + (pct >= 60 ? "<p>Lección dominada. ¡Seguí así, doctora! 🧠</p>" : "<p>Repasá la lección y volvé a intentar.</p>") + `<div class="quizacts"><button class="btn btn-ghost btn-sm" id="qBack">Volver a la lección</button> <button class="btn btn-mint btn-sm" id="qMap">Al mapa del curso</button></div>`;
  body.appendChild(res); res.scrollIntoView({ behavior: "smooth" });
  $("qBack").onclick = () => renderLessonSection("leccion");
  $("qMap").onclick = () => { show("lessonView", false); show("courseHome", true); };
  if (pct >= 60) await markDone(curLesson.ui, curLesson.li, pct);
}
function renderFlash(cards) {
  const body = $("lessonBody");
  if (!cards.length) { body.innerHTML = `<div class="empty">Sin flashcards.</div>`; return; }
  let i = 0;
  const draw = () => {
    body.innerHTML = `<div class="flashwrap"><div class="flashcard" id="fcard"><div class="fc-inner"><div class="fc-front">${esc(cards[i].front)}</div><div class="fc-back">${esc(cards[i].back)}</div></div></div><div class="flashnav"><button class="btn btn-ghost btn-sm" id="fPrev">◀</button><span>${i + 1}/${cards.length}</span><button class="btn btn-ghost btn-sm" id="fNext">▶</button></div><p class="fchint">Tocá la tarjeta para darla vuelta 🔄</p></div>`;
    $("fcard").onclick = () => $("fcard").classList.toggle("flipped");
    $("fPrev").onclick = () => { i = (i - 1 + cards.length) % cards.length; draw(); };
    $("fNext").onclick = () => { i = (i + 1) % cards.length; draw(); };
  };
  draw();
}
async function apiResearch(payload) {
  const tk = await idToken();
  const r = await fetch("/api/research", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tk }, body: JSON.stringify(payload) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || ("Error " + r.status));
  return data;
}
async function renderContrast() {
  const body = $("lessonBody"); const l = curLesson.l; const cid = lessonId(curLesson.ui, curLesson.li);
  body.innerHTML = `<div class="spinner"></div><p style="text-align:center;color:#8a9aa4">Investigando en internet qué dice el mundo hoy… 🌐🔎</p>`;
  try {
    let txt = null, sources = [];
    const snap = await getDoc(doc(db, "books", book.id, "contrast", cid));
    if (snap.exists()) { txt = snap.data().text; sources = snap.data().sources || []; }
    if (!txt) {
      const passages = passagesForRange(l.pageStart, l.pageEnd, l.title);
      const data = await apiResearch({ topic: l.title, bookTitle: book.title, passages });
      txt = data.answer; sources = data.sources || [];
      try { await setDoc(doc(db, "books", book.id, "contrast", cid), { text: txt, sources, createdAt: serverTimestamp() }); } catch {}
    }
    const srcHtml = sources.length ? `<div class="sources"><b>🔗 Fuentes consultadas (en vivo):</b>${sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)} (${esc(s.lang || "")})</a>`).join("")}</div>` : "";
    body.innerHTML = `<div class="lesson-content contrast">${md(txt)}</div>${srcHtml}<p class="disclaimer">🌐 Investigación en vivo (Wikipedia ES/EN) contrastada con el libro por IA. Ante dudas clínicas, verificá siempre con fuentes oficiales.</p><div style="margin-top:10px"><button class="btn btn-ghost btn-sm" id="reContrast">🔄 Investigar de nuevo</button></div>`;
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
  progress.done = progress.done || {}; progress.done[id] = true;
  progress.scores = progress.scores || {}; progress.scores[id] = score;
  try { await setDoc(doc(db, "users", curUser.uid, "progress", book.id), { done: progress.done, scores: progress.scores, updatedAt: serverTimestamp() }, { merge: true }); } catch {}
}

/* ---------------- CHAT (guía) ---------------- */
function addMsg(role, html, cls = "") { const d = document.createElement("div"); d.className = "msg " + role + (cls ? " " + cls : ""); d.innerHTML = html; $("chatMsgs").appendChild(d); $("chatMsgs").scrollTop = $("chatMsgs").scrollHeight; wireCites(d); return d; }
async function sendChat() {
  const q = $("chatInput").value.trim();
  if (!q && !pendingSel) return;
  if (!book) { toast("Elegí un libro."); return; }
  const mode = (document.querySelector('input[name="mode"]:checked') || {}).value || "pro";
  const selText = pendingSel; pendingSel = ""; clearSelBanner();
  addMsg("user", (selText ? `📌 <i>"${esc(selText.slice(0, 120))}"</i><br>` : "") + esc(q || "Explicame esto."));
  $("chatInput").value = "";
  const thinking = addMsg("bot", `<span class="think dots">Pensando (${mode === "pro" ? "Pro 🧠" : "Flash ⚡"})</span>`, "think");
  try {
    const passages = search(bookIndex, (q + " " + selText + " " + (curLesson ? curLesson.l.title : "")).trim(), 8).map(p => ({ page: p.page, printed: p.printed, text: p.text }));
    const data = await apiChat({ task: "chat", bookTitle: book.title, passages, question: q, selectedText: selText, history: chatHistory.slice(-8), mode });
    thinking.remove();
    const ans = data.answer || "(sin respuesta)"; addMsg("bot", md(ans));
    chatHistory.push({ role: "user", content: (selText ? `[fragmento: ${selText.slice(0, 300)}] ` : "") + (q || "Explicame esto.") });
    chatHistory.push({ role: "assistant", content: ans });
  } catch (e) { thinking.remove(); addMsg("bot", "⚠️ " + esc(e.message || e), "think"); }
}

/* ---------------- NOTAS ---------------- */
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
  const t = $("noteInput").value.trim(); if (!t || !curUser) return;
  try { await addDoc(collection(db, "users", curUser.uid, "notes"), { text: t, bookId: book ? book.id : "", page: curPage || null, createdAt: serverTimestamp() }); $("noteInput").value = ""; toast("Nota guardada ✍️"); }
  catch (e) { toast("No se pudo guardar: " + (e.message || e)); }
}

/* ---------------- SELECCIÓN ---------------- */
function clearSelBanner() { const b = $("selBanner"); if (b) b.remove(); }
function showSelBanner(text) {
  clearSelBanner();
  const div = document.createElement("div"); div.id = "selBanner";
  div.style.cssText = "background:#eef7f5;border:1px dashed var(--mint);border-radius:10px;padding:8px 10px;margin-bottom:8px;font-size:.82rem;color:#3a5a6b;display:flex;gap:8px;align-items:center";
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

// helpers de diagnóstico (uso interno para verificar la conexión con DeepSeek)
window.__api = apiChat;
window.__models = async () => { const tk = await idToken(); const r = await fetch("/api/models", { headers: { Authorization: "Bearer " + tk } }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
window.__research = apiResearch;
window.__rawchat = async (payload) => { const tk = await idToken(); const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tk }, body: JSON.stringify(payload) }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
