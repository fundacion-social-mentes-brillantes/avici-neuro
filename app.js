// ===== AVICI — app principal (auth + admin + zona de estudio) =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc,
  query, where, orderBy, onSnapshot, getDocs, serverTimestamp, writeBatch
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

/* ---------------- AUTH ---------------- */
let unsubUserDoc = null, unsubPending = null, unsubApproved = null, unsubNotes = null;
function cleanup() { [unsubUserDoc, unsubPending, unsubApproved, unsubNotes].forEach(f => { try { f && f(); } catch {} }); unsubUserDoc = unsubPending = unsubApproved = unsubNotes = null; }

function whoami(user, role) {
  const img = user.photoURL ? `<img src="${esc(user.photoURL)}" referrerpolicy="no-referrer" alt="">` : `<img src="/icon-192.png" alt="">`;
  return `<div class="whoami">${img}<div class="info"><b>${esc(user.displayName || "Sin nombre")}</b><span>${esc(user.email || "")}</span></div><span class="role">${role}</span></div>`;
}

$("btnLogin").addEventListener("click", async () => {
  try { await signInWithPopup(auth, provider); }
  catch (e) {
    const c = e.code || "";
    if (/popup-blocked|cancelled-popup|operation-not-supported|popup-closed/.test(c)) {
      try { await signInWithRedirect(auth, provider); } catch (e2) { toast("No se pudo abrir el login: " + (e2.message || e2)); }
    } else if (/unauthorized-domain/.test(c)) { toast("Dominio no autorizado en Firebase."); }
    else { toast("Error al entrar: " + (e.message || e)); }
  }
});
["btnLogoutP", "btnLogoutR", "btnLogoutS"].forEach(id => $(id) && $(id).addEventListener("click", async () => { cleanup(); try { await signOut(auth); } catch {} }));
getRedirectResult(auth).catch(() => {});

async function ensureUserDoc(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const isAdmin = (user.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase();
    await setDoc(ref, {
      email: user.email || "", displayName: user.displayName || "", photoURL: user.photoURL || "",
      role: isAdmin ? "admin" : "student", status: isAdmin ? "approved" : "pending", createdAt: serverTimestamp()
    });
  }
  return ref;
}

const CARDS = ["monitorCard", "recetaCard"];
function setLanding(on) { CARDS.forEach(id => show(id, on)); }

function renderByStatus(user, data) {
  const isAdmin = data.role === "admin" || (user.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase();
  ["accessLoading", "viewLogin", "viewPending", "viewRejected"].forEach(v => show(v, false));
  if (isAdmin || data.status === "approved") {
    show("accessCard", false); setLanding(false);
    show("adminZone", isAdmin);
    if (isAdmin) { $("whoamiAdmin").innerHTML = whoami(user, "Admin"); startAdmin(); }
    show("studyZone", true);
    initStudy(user);
    return;
  }
  show("accessCard", true); setLanding(true); show("adminZone", false); show("studyZone", false);
  if (data.status === "rejected") { $("whoamiRejected").innerHTML = whoami(user, "Sin acceso"); show("viewRejected", true); }
  else { $("whoamiPending").innerHTML = whoami(user, "Pendiente"); show("viewPending", true); }
}

onAuthStateChanged(auth, async (user) => {
  cleanup();
  if (!user) { ["accessLoading", "viewPending", "viewRejected"].forEach(v => show(v, false)); show("accessCard", true); setLanding(true); show("adminZone", false); show("studyZone", false); show("viewLogin", true); return; }
  show("accessCard", true); ["viewLogin", "viewPending", "viewRejected"].forEach(v => show(v, false)); show("accessLoading", true); setLanding(false);
  try {
    const ref = await ensureUserDoc(user);
    unsubUserDoc = onSnapshot(ref, (s) => { if (s.exists()) renderByStatus(user, s.data()); }, (err) => { toast("Error de acceso: " + err.message); show("viewLogin", true); });
  } catch (e) { toast("Error de conexión: " + (e.message || e)); show("accessLoading", false); show("viewLogin", true); }
});

/* ---------------- ADMIN ---------------- */
function startAdmin() {
  if (unsubPending || unsubApproved) return;
  const col = collection(db, "users");
  unsubPending = onSnapshot(query(col, where("status", "==", "pending")), (qs) => {
    $("pendingCount").textContent = qs.size;
    const list = $("pendingList");
    if (qs.empty) { list.innerHTML = `<div class="empty">Nadie esperando 🎉</div>`; return; }
    list.innerHTML = ""; qs.forEach(d => list.appendChild(userRow(d.id, d.data(), "pending")));
  }, e => { $("pendingList").innerHTML = `<div class="empty">Error: ${esc(e.message)}</div>`; });
  unsubApproved = onSnapshot(query(col, where("status", "==", "approved")), (qs) => {
    const list = $("approvedList");
    if (qs.empty) { list.innerHTML = `<div class="empty">Aún no hay aprobados.</div>`; return; }
    list.innerHTML = ""; qs.forEach(d => list.appendChild(userRow(d.id, d.data(), "approved")));
  }, e => { $("approvedList").innerHTML = `<div class="empty">Error: ${esc(e.message)}</div>`; });
}
function userRow(uid, u, kind) {
  const row = document.createElement("div"); row.className = "urow";
  const img = document.createElement("img"); img.src = u.photoURL || "/icon-192.png"; img.referrerPolicy = "no-referrer";
  const info = document.createElement("div"); info.className = "u";
  info.innerHTML = `<b>${esc(u.displayName || "Sin nombre")}</b><span>${esc(u.email || "")}</span>`;
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

/* ---------------- IMPORTAR LIBROS (admin) ---------------- */
function ilog(m) { const el = $("importLog"); el.textContent += (el.textContent ? "\n" : "") + m; el.scrollTop = el.scrollHeight; }
function splitByBytes(str, maxBytes) {
  const enc = new TextEncoder(); const out = []; let start = 0; const step = 400000;
  while (start < str.length) {
    let end = Math.min(str.length, start + step);
    while (enc.encode(str.slice(start, end)).length > maxBytes && end > start + 1000) end -= 20000;
    out.push(str.slice(start, end)); start = end;
  }
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
      const title = obj.title || bookId;
      const pages = obj.pages || [];
      if (!pages.length) { ilog("  ⚠️ sin páginas, salto."); continue; }
      const pieces = splitByBytes(JSON.stringify(pages), 900 * 1024);
      // borrar bundles viejos
      const old = await getDocs(collection(db, "books", bookId, "bundles"));
      if (!old.empty) { let b = writeBatch(db), n = 0; for (const d of old.docs) { b.delete(d.ref); if (++n >= 400) { await b.commit(); b = writeBatch(db); n = 0; } } if (n) await b.commit(); }
      // escribir meta + bundles
      await setDoc(doc(db, "books", bookId), { title, pageCount: pages.length, bundleCount: pieces.length, updatedAt: serverTimestamp() });
      let batch = writeBatch(db), ops = 0;
      for (let i = 0; i < pieces.length; i++) {
        batch.set(doc(db, "books", bookId, "bundles", String(i)), { i, data: pieces[i] });
        if (++ops >= 400) { await batch.commit(); batch = writeBatch(db); ops = 0; ilog(`  ${bookId}: ${i + 1}/${pieces.length}`); }
      }
      if (ops) await batch.commit();
      try { const { deleteBook } = await idb(); await deleteBook(bookId); } catch {}
      ilog(`✅ ${bookId}: ${pages.length} páginas en ${pieces.length} bloques.`);
    } catch (e) { ilog("❌ " + file.name + ": " + (e.message || e)); }
  }
  ilog("Listo. Recargá la zona de estudio para ver los cambios.");
  toast("Importación terminada ✅");
});

/* ---------------- IndexedDB cache ---------------- */
function idb() {
  return new Promise((resolve) => {
    const req = indexedDB.open("avici", 1);
    req.onupgradeneeded = () => { req.result.createObjectStore("books"); };
    req.onsuccess = () => {
      const dbi = req.result;
      resolve({
        get: (k) => new Promise(r => { const t = dbi.transaction("books").objectStore("books").get(k); t.onsuccess = () => r(t.result); t.onerror = () => r(null); }),
        put: (k, v) => new Promise(r => { const t = dbi.transaction("books", "readwrite").objectStore("books").put(v, k); t.onsuccess = () => r(true); t.onerror = () => r(false); }),
        deleteBook: (k) => new Promise(r => { const t = dbi.transaction("books", "readwrite").objectStore("books").delete(k); t.onsuccess = () => r(true); t.onerror = () => r(false); }),
      });
    };
    req.onerror = () => resolve({ get: async () => null, put: async () => false, deleteBook: async () => false });
  });
}

/* ---------------- ZONA DE ESTUDIO ---------------- */
let studyInit = false, book = null, bookIndex = null, curPage = 1, chatHistory = [], pendingSel = "";
const STOP = new Set("de la que el en y los las un una para con por del al se su sus lo como mas más o e ni pero si no es son ser este esta estos estas entre sobre cuando cada muy sin ese esa hay han ha".split(" "));
function tokenize(s) { return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !STOP.has(w)); }

function initStudy(user) {
  if (studyInit) return; studyInit = true;
  const sel = $("bookSel"); sel.innerHTML = BOOKS.map(b => `<option value="${b.id}">${esc(b.title)}</option>`).join("");
  sel.addEventListener("change", () => loadAndRender(sel.value));
  // tabs
  document.querySelectorAll(".tabs button").forEach(btn => btn.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach(b => b.classList.remove("active")); btn.classList.add("active");
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    $("panel-" + btn.dataset.tab).classList.add("active");
  }));
  // reader controls
  $("pgPrev").onclick = () => renderPage(curPage - 1);
  $("pgNext").onclick = () => renderPage(curPage + 1);
  $("pgInput").addEventListener("change", () => renderPage(parseInt($("pgInput").value) || 1));
  $("searchBtn").onclick = doSearch;
  $("searchInput").addEventListener("keydown", e => { if (e.key === "Enter") doSearch(); });
  // chat
  $("chatSend").onclick = sendChat;
  $("chatInput").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } });
  // notes
  $("noteAdd").onclick = addNote;
  startNotes(user);
  // selección de texto
  setupSelection();
  loadAndRender(sel.value);
}

async function loadAndRender(bookId) {
  book = null; bookIndex = null; chatHistory = [];
  $("pageContent").textContent = ""; show("bookLoading", true); $("bookLoadingTxt").textContent = "Cargando libro…";
  try {
    const cache = await idb();
    let data = await cache.get(bookId);
    if (!data || !data.pages) {
      const meta = await getDoc(doc(db, "books", bookId));
      if (!meta.exists()) { show("bookLoading", false); $("pageContent").innerHTML = `<div class="empty">Este libro todavía no fue importado.${(auth.currentUser && (auth.currentUser.email || "").toLowerCase() === ADMIN_EMAIL) ? " Usá el importador de arriba (admin)." : " Avisale a Sebastián."}</div>`; return; }
      const m = meta.data(); const n = m.bundleCount || 0;
      $("bookLoadingTxt").textContent = `Descargando ${m.title}… (una sola vez)`;
      const bs = await getDocs(collection(db, "books", bookId, "bundles"));
      const arr = []; bs.forEach(d => arr.push(d.data())); arr.sort((a, b) => a.i - b.i);
      const str = arr.map(x => x.data).join("");
      data = { id: bookId, title: m.title, pages: JSON.parse(str) };
      await cache.put(bookId, data);
    }
    book = data;
    $("bookLoadingTxt").textContent = "Preparando el buscador…";
    bookIndex = buildIndex(book.pages);
    show("bookLoading", false);
    renderPage(1);
  } catch (e) {
    show("bookLoading", false);
    $("pageContent").innerHTML = `<div class="empty">No se pudo cargar: ${esc(e.message || e)}</div>`;
  }
}

function buildIndex(pages) {
  const chunks = [];
  for (const p of pages) {
    const t = (p.text || "").replace(/[ \t]+/g, " ");
    for (let i = 0; i < t.length; i += 950) {
      const c = t.slice(i, i + 1100).trim();
      if (c.length > 40) chunks.push({ page: p.i, printed: p.printed, text: c });
    }
  }
  const N = chunks.length, df = new Map(), docs = []; let total = 0;
  for (const c of chunks) {
    const terms = tokenize(c.text), tf = new Map();
    for (const t of terms) tf.set(t, (tf.get(t) || 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
    docs.push({ tf, len: terms.length }); total += terms.length;
  }
  return { N, df, docs, chunks, avgdl: total / Math.max(1, N) };
}
function search(idx, qStr, k = 8) {
  if (!idx) return [];
  const q = [...new Set(tokenize(qStr))]; if (!q.length) return [];
  const k1 = 1.5, b = 0.75, scores = new Float64Array(idx.N);
  for (const t of q) {
    const dfi = idx.df.get(t); if (!dfi) continue;
    const idf = Math.log(1 + (idx.N - dfi + 0.5) / (dfi + 0.5));
    for (let i = 0; i < idx.N; i++) {
      const f = idx.docs[i].tf.get(t); if (!f) continue;
      const dl = idx.docs[i].len;
      scores[i] += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * dl / idx.avgdl));
    }
  }
  const arr = []; for (let i = 0; i < idx.N; i++) if (scores[i] > 0) arr.push([scores[i], i]);
  arr.sort((a, b) => b[0] - a[0]);
  return arr.slice(0, k).map(([s, i]) => idx.chunks[i]);
}

function renderPage(n) {
  if (!book) return;
  n = Math.max(1, Math.min(book.pages.length, n | 0)); curPage = n;
  const p = book.pages[n - 1];
  $("pgInput").value = n; $("pgTotal").textContent = book.pages.length;
  const printed = p.printed ? ` · impresa ${p.printed}` : "";
  $("pageContent").innerHTML = `<span class="pgnum">Página ${n}${printed}</span>\n` + esc(p.text || "(página en blanco)");
  $("pageContent").scrollTop = 0;
}
window.goToPage = (n) => {
  document.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("active", b.dataset.tab === "lector"));
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active")); $("panel-lector").classList.add("active");
  renderPage(n);
};

function doSearch() {
  const q = $("searchInput").value.trim(); const box = $("searchResults");
  if (!q || !bookIndex) { show(box, false); return; }
  const res = search(bookIndex, q, 12);
  if (!res.length) { box.innerHTML = `<div class="empty">Sin resultados para "${esc(q)}".</div>`; show(box, true); return; }
  box.innerHTML = res.map(r => `<div class="sres" data-pg="${r.page}"><b>pág. ${r.page}</b> — ${esc(r.text.slice(0, 160))}…</div>`).join("");
  show(box, true);
  box.querySelectorAll(".sres").forEach(el => el.onclick = () => { renderPage(parseInt(el.dataset.pg)); show(box, false); });
}

/* ---------------- CHAT ---------------- */
function mdToHtml(text) {
  let h = esc(text);
  h = h.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  h = h.replace(/^\s*###?\s*(.+)$/gm, "<h4>$1</h4>");
  h = h.replace(/`([^`]+)`/g, "<code>$1</code>");
  h = h.replace(/\(p[aá]g\.?\s*(\d{1,4})[^)]*\)/gi, (m, n) => `<button class="cite" data-pg="${n}">📄 pág. ${n}</button>`);
  h = h.replace(/^\s*[-*]\s+(.+)$/gm, "• $1");
  h = h.replace(/\n/g, "<br>");
  return h;
}
function addMsg(role, html, cls = "") {
  const d = document.createElement("div"); d.className = "msg " + role + (cls ? " " + cls : ""); d.innerHTML = html;
  $("chatMsgs").appendChild(d); $("chatMsgs").scrollTop = $("chatMsgs").scrollHeight;
  d.querySelectorAll(".cite").forEach(b => b.onclick = () => window.goToPage(parseInt(b.dataset.pg)));
  return d;
}
async function sendChat() {
  const q = $("chatInput").value.trim();
  if (!q && !pendingSel) { return; }
  if (!book) { toast("Esperá a que cargue el libro."); return; }
  const mode = (document.querySelector('input[name="mode"]:checked') || {}).value || "pro";
  const selText = pendingSel; pendingSel = ""; clearSelBanner();
  const userLabel = (selText ? `📌 <i>"${esc(selText.slice(0, 120))}${selText.length > 120 ? "…" : ""}"</i><br>` : "") + esc(q || "Explicame esto.");
  addMsg("user", userLabel);
  $("chatInput").value = "";
  const thinking = addMsg("bot", `<span class="think dots">Pensando (${mode === "pro" ? "Pro 🧠" : "Flash ⚡"})</span>`, "think");
  try {
    const passages = search(bookIndex, (q + " " + selText).trim(), 8).map(p => ({ page: p.page, printed: p.printed, text: p.text }));
    const idToken = await auth.currentUser.getIdToken();
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + idToken },
      body: JSON.stringify({ bookTitle: book.title, passages, question: q, selectedText: selText, history: chatHistory.slice(-8), mode })
    });
    const data = await r.json().catch(() => ({}));
    thinking.remove();
    if (!r.ok) { addMsg("bot", "⚠️ " + esc(data.error || ("Error " + r.status)), "think"); return; }
    const ans = data.answer || "(sin respuesta)";
    addMsg("bot", mdToHtml(ans));
    chatHistory.push({ role: "user", content: (selText ? `[fragmento: ${selText.slice(0, 300)}] ` : "") + (q || "Explicame esto.") });
    chatHistory.push({ role: "assistant", content: ans });
  } catch (e) { thinking.remove(); addMsg("bot", "⚠️ No se pudo conectar con el asistente: " + esc(e.message || e), "think"); }
}

/* ---------------- NOTAS ---------------- */
function startNotes(user) {
  const col = collection(db, "users", user.uid, "notes");
  unsubNotes = onSnapshot(query(col, orderBy("createdAt", "desc")), (qs) => {
    const list = $("notesList");
    if (qs.empty) { list.innerHTML = `<div class="empty">Todavía no tenés notas.</div>`; return; }
    list.innerHTML = "";
    qs.forEach(d => {
      const nd = d.data(); const card = document.createElement("div"); card.className = "notecard";
      const pg = nd.page ? `<span class="pg" data-pg="${nd.page}">📄 pág. ${nd.page}</span>` : "";
      card.innerHTML = `<div class="meta">${pg}<span>${nd.bookId || ""}</span></div>${esc(nd.text)}<div class="acts"><button class="btn btn-ghost btn-sm bAsk">🤖 Preguntar</button><button class="btn btn-bad btn-sm bDel">Borrar</button></div>`;
      card.querySelector(".bDel").onclick = () => deleteDoc(doc(db, "users", user.uid, "notes", d.id)).catch(e => toast("No se pudo borrar: " + e.message));
      card.querySelector(".bAsk").onclick = () => { pendingSel = nd.text; showSelBanner(nd.text); switchTab("chat"); $("chatInput").focus(); };
      const pgEl = card.querySelector(".pg"); if (pgEl) pgEl.onclick = () => window.goToPage(parseInt(pgEl.dataset.pg));
      list.appendChild(card);
    });
  }, e => { $("notesList").innerHTML = `<div class="empty">Error: ${esc(e.message)}</div>`; });
}
async function addNote() {
  const t = $("noteInput").value.trim(); if (!t) return;
  const user = auth.currentUser; if (!user) return;
  try {
    await addDoc(collection(db, "users", user.uid, "notes"), { text: t, bookId: book ? book.id : "", page: curPage || null, createdAt: serverTimestamp() });
    $("noteInput").value = ""; toast("Nota guardada ✍️");
  } catch (e) { toast("No se pudo guardar: " + (e.message || e)); }
}

/* ---------------- SELECCIÓN DE TEXTO ---------------- */
function switchTab(tab) {
  document.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active")); $("panel-" + tab).classList.add("active");
}
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
  const pop = $("selPopup"); const content = $("pageContent");
  const place = () => {
    const sel = window.getSelection();
    const txt = sel && sel.toString().trim();
    if (!txt || txt.length < 3 || !content.contains(sel.anchorNode)) { show(pop, false); return; }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const wrapRect = document.querySelector(".wrap").getBoundingClientRect();
    pop.style.left = Math.max(8, rect.left - wrapRect.left) + "px";
    pop.style.top = (rect.top - wrapRect.top - 46 + window.scrollY - document.querySelector(".wrap").offsetTop * 0) + "px";
    // simpler: position fixed relative to viewport
    pop.style.position = "fixed";
    pop.style.left = Math.min(window.innerWidth - 160, Math.max(8, rect.left)) + "px";
    pop.style.top = Math.max(8, rect.top - 46) + "px";
    show(pop, true);
    pop._sel = txt;
  };
  content.addEventListener("mouseup", () => setTimeout(place, 10));
  content.addEventListener("touchend", () => setTimeout(place, 10));
  document.addEventListener("mousedown", (e) => { if (!pop.contains(e.target)) show(pop, false); });
  $("selAsk").onclick = () => { const t = pop._sel; if (!t) return; pendingSel = t; showSelBanner(t); switchTab("chat"); show(pop, false); $("chatInput").focus(); };
  $("selNote").onclick = async () => { const t = pop._sel; if (!t) return; const user = auth.currentUser; try { await addDoc(collection(db, "users", user.uid, "notes"), { text: t, bookId: book ? book.id : "", page: curPage || null, createdAt: serverTimestamp() }); toast("Nota guardada ✍️"); } catch (e) { toast("No se pudo: " + e.message); } show(pop, false); };
}
