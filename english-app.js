// ===== Curso de inglés dentro de AVICI: la pantalla =====
//
// Este módulo vive aparte de app.js a propósito: los cursos de los libros no se tocan.
// app.js lo abre cuando la fuente elegida es "Inglés" y le entrega dónde dibujar, cómo
// guardar (Firestore) y cómo hablar con /api/english. Todo lo demás pasa acá.
//
// Recorrido de una lección (english/METODO.md): Empezar (Matilda + intento previo) →
// Aprender → Escuchar (episodio) → Pronunciar → Practicar → Hablar (4/3/2 + juego de
// roles) → Escribir → Dominio (80 % o más) y misión de inmersión.

import { ENGLISH_CAST, ENGLISH_RULES, getEnglishCourse } from "./english-catalog.js";
import { checkTypedAnswer, countWords, lessonAudioScript, NARRATOR_VOICE, normalizeEnglishLesson } from "./english-utils.js";
import { cardsFromLesson, dueCards, overdueCount, reviewCard, SRS_GRADES } from "./english-srs.js";
import { addImmersion, immersionStatus, LESSON_STATE, lessonStates, nextLessonId, recordMastery, touchStreak } from "./english-progress.js";
import * as speech from "./english-speech.js";

export const ENGLISH_SOURCE_ID = "ingles";

const course = getEnglishCourse();
const ROUTE = course.levels.flatMap(level => level.units.flatMap(unit => unit.lessons.map(lesson => ({ lesson, unit, level }))));
const BY_ID = new Map(ROUTE.map(entry => [entry.lesson.id, entry]));
const SECTIONS = [
  ["start", "Empezar"], ["learn", "Aprender"], ["listen", "Escuchar"], ["pron", "Pronunciar"],
  ["practice", "Practicar"], ["speak", "Hablar"], ["write", "Escribir"], ["master", "Dominio"],
];
const REQUIRED_BEFORE_MASTERY = ["start", "listen", "practice"];
const FOCUS_LABEL = { listening: "Escuchar", reading: "Leer", speaking: "Hablar", writing: "Escribir", grammar: "Gramática", vocabulary: "Vocabulario", pronunciation: "Pronunciación" };
const RATE_KEY = "avici-en-rate";

let env = null;
let state = null;

/* ---------- utilidades ---------- */

const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $q = (selector, root = env?.root) => root?.querySelector(selector);
const $all = (selector, root = env?.root) => Array.from(root?.querySelectorAll(selector) || []);

function toast(message) { env?.toast?.(message); }

function inline(text) {
  return esc(text)
    .replace(/\*\*\*(.+?)\*\*\*/g, "<b><i>$1</i></b>")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<i>$2</i>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

/* Markdown mínimo para las explicaciones: títulos, listas, tablas, negrita y cursiva. */
function md(text) {
  const out = [];
  let paragraph = [], items = [], rows = [];
  const flushParagraph = () => { if (paragraph.length) out.push(`<p>${paragraph.map(inline).join("<br>")}</p>`); paragraph = []; };
  const flushList = () => { if (items.length) out.push(`<ul>${items.map(item => `<li>${inline(item)}</li>`).join("")}</ul>`); items = []; };
  const flushTable = () => {
    if (rows.length) {
      const [head, ...body] = rows;
      out.push(`<div class="en-table"><table><thead><tr>${head.map(cell => `<th>${inline(cell)}</th>`).join("")}</tr></thead><tbody>${body.map(row => `<tr>${row.map(cell => `<td>${inline(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
    }
    rows = [];
  };
  for (const raw of String(text || "").split("\n")) {
    const line = raw.trim();
    if (/^\|.*\|$/.test(line)) {
      flushParagraph(); flushList();
      if (!/^\|[\s:|-]+\|$/.test(line)) rows.push(line.slice(1, -1).split("|").map(cell => cell.trim()));
      continue;
    }
    flushTable();
    if (/^#{1,4}\s+/.test(line)) { flushParagraph(); flushList(); out.push(`<h4>${inline(line.replace(/^#{1,4}\s+/, ""))}</h4>`); continue; }
    if (/^[-*]\s+/.test(line)) { flushParagraph(); items.push(line.replace(/^[-*]\s+/, "")); continue; }
    if (!line) { flushParagraph(); flushList(); continue; }
    flushList();
    paragraph.push(line);
  }
  flushParagraph(); flushList(); flushTable();
  return out.join("");
}

function shuffle(list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

function levelName(levelId) {
  const level = course.levels.find(item => item.id === levelId);
  return level ? `${level.cefr} · ${level.name}` : levelId;
}

function speakerName(voice) {
  return Object.entries(ENGLISH_CAST).find(([, member]) => member.voice === voice)?.[0] || "";
}

/* ---------- entrada y salida ---------- */

export async function openEnglish(options) {
  closeEnglish();
  env = options;
  let rate = 1;
  try { rate = Number(localStorage.getItem(RATE_KEY)) === 0.75 ? 0.75 : 1; } catch {}
  state = { run: 0, progress: {}, cards: [], available: [], config: null, lessons: new Map(), view: "home", current: null, audio: null, rate, clips: new Map(), saveTimer: null, cardsTimer: null, abort: null };
  env.root.classList.add("en-root");
  env.root.addEventListener("click", onRootClick);
  env.root.innerHTML = `<div class="spinner"></div>`;
  const run = state.run;
  try {
    const [progress, cards, available, config] = await Promise.all([
      env.store.loadProgress().catch(() => ({})),
      env.store.loadCards().catch(() => []),
      loadAvailable(),
      loadConfig().catch(() => null),
    ]);
    if (!state || run !== state.run) return;
    state.progress = progress || {};
    state.cards = cards || [];
    state.available = available;
    state.config = config;
    renderHome();
  } catch (error) {
    if (env) env.root.innerHTML = `<div class="lesson-error"><b>No pude abrir el curso de inglés.</b><p>${esc(error?.message || error)}</p></div>`;
  }
}

export function closeEnglish() {
  if (!state) return;
  stopAudio();
  state.abort?.abort();
  flushSaves();
  env?.root?.removeEventListener("click", onRootClick);
  env?.root?.classList.remove("en-root");
  state = null;
  env = null;
}

async function loadAvailable() {
  try {
    const response = await fetch(`${env.lessonsBase || "/english/lessons/"}index.json`, { cache: "no-cache" });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data?.lessons) ? data.lessons : [];
  } catch { return []; }
}

async function loadConfig() {
  const config = await env.api("/api/english?task=config");
  return { ...config, loadedAt: Date.now() };
}

async function ensureConfig() {
  const expires = state.config?.audio?.expira ? Date.parse(state.config.audio.expira) : 0;
  if (!state.config || (state.config.audio && expires - Date.now() < 5 * 60 * 1000)) {
    try { state.config = await loadConfig(); } catch {}
  }
  return state.config;
}

async function loadLesson(id) {
  if (state.lessons.has(id)) return state.lessons.get(id);
  const response = await fetch(`${env.lessonsBase || "/english/lessons/"}${id}.json`);
  if (!response.ok) throw new Error("Esta lección todavía no está escrita.");
  const lesson = normalizeEnglishLesson(await response.json());
  const script = lessonAudioScript(lesson);
  const byText = new Map(script.map(item => [`${item.kind}|${item.text}|${item.voice}`, item]));
  const bundle = { lesson, script, byText };
  state.lessons.set(id, bundle);
  return bundle;
}

/* ---------- guardar ---------- */

function saveProgress({ now = false } = {}) {
  if (!state) return;
  state.progress.updatedAtMs = Date.now();
  clearTimeout(state.saveTimer);
  const write = () => env?.store.saveProgress(state.progress).catch(() => toast("No pude guardar tu avance. Revisa la conexión."));
  if (now) write(); else state.saveTimer = setTimeout(write, 800);
}

function saveCards() {
  if (!state) return;
  clearTimeout(state.cardsTimer);
  state.cardsTimer = setTimeout(() => env?.store.saveCards(state.cards).catch(() => toast("No pude guardar tus repasos.")), 1200);
}

function flushSaves() {
  if (!state) return;
  if (state.saveTimer) { clearTimeout(state.saveTimer); env?.store.saveProgress(state.progress).catch(() => {}); }
  if (state.cardsTimer) { clearTimeout(state.cardsTimer); env?.store.saveCards(state.cards).catch(() => {}); }
  state.saveTimer = state.cardsTimer = null;
}

function markSection(lessonId, section) {
  const sections = { ...(state.progress.sections || {}) };
  sections[lessonId] = { ...(sections[lessonId] || {}), [section]: true };
  state.progress = touchStreak({ ...state.progress, sections }, Date.now());
  saveProgress();
  const tab = $q(`.en-sectabs button[data-sec="${section}"]`);
  if (tab) tab.classList.add("is-done");
}

function sectionDone(lessonId, section) {
  return Boolean(state.progress.sections?.[lessonId]?.[section]);
}

function advancedOn() {
  return Boolean(state.progress.settings?.advancedAI && state.config?.advancedAI);
}

/* ---------- audio ---------- */

function audioUrl(lessonId, item) {
  if (env.audioBase) return `${env.audioBase}/${lessonId}/${item.key}.mp3`;
  const audio = state.config?.audio;
  if (!audio) return null;
  return `${audio.base}/${lessonId}/${item.key}.mp3?${audio.sas}`;
}

/* Registra un audio y devuelve el botón que lo reproduce. Los botones llevan solo un
   número: el texto completo nunca viaja en atributos del HTML. */
function clipButton(bundle, kind, text, { voice = NARRATOR_VOICE, label = "Escuchar", big = false } = {}) {
  const item = bundle?.byText.get(`${kind}|${text}|${voice}`);
  if (!item) return "";
  const id = `c${state.clips.size + 1}`;
  state.clips.set(id, { lessonId: bundle.lesson.id, item });
  return `<button type="button" class="en-play${big ? " en-play-big" : ""}" data-clip="${id}" aria-label="${esc(label)}"><span aria-hidden="true">▶</span>${big ? `<b>${esc(label)}</b>` : ""}</button>`;
}

function stopAudio() {
  if (state?.audio) { try { state.audio.pause(); } catch {} state.audio.onended = null; state.audio = null; }
  $all(".en-play.is-playing").forEach(button => button.classList.remove("is-playing"));
}

async function playItem(lessonId, item, { button = null, onEnd = null } = {}) {
  stopAudio();
  await ensureConfig();
  const url = audioUrl(lessonId, item);
  if (!url) { toast("Los audios del curso todavía no están publicados."); onEnd?.(false); return; }
  const audio = new Audio(url);
  audio.preservesPitch = true;
  audio.playbackRate = state.rate;
  state.audio = audio;
  button?.classList.add("is-playing");
  audio.onended = () => { button?.classList.remove("is-playing"); if (state?.audio === audio) state.audio = null; onEnd?.(true); };
  audio.onerror = () => { button?.classList.remove("is-playing"); toast("Este audio no está disponible todavía."); onEnd?.(false); };
  try { await audio.play(); } catch { button?.classList.remove("is-playing"); onEnd?.(false); }
}

/* ---------- clics de toda la pantalla ---------- */

function onRootClick(event) {
  const clip = event.target.closest("[data-clip]");
  if (clip && state) {
    const entry = state.clips.get(clip.dataset.clip);
    if (entry) {
      if (clip.classList.contains("is-playing")) stopAudio();
      else playItem(entry.lessonId, entry.item, { button: clip });
    }
    return;
  }
  const rate = event.target.closest("[data-rate]");
  if (rate && state) {
    state.rate = state.rate === 1 ? 0.75 : 1;
    try { localStorage.setItem(RATE_KEY, String(state.rate)); } catch {}
    $all("[data-rate]").forEach(button => { button.textContent = state.rate === 1 ? "Velocidad normal" : "Más lento (0,75×)"; button.classList.toggle("is-on", state.rate !== 1); });
    if (state.audio) state.audio.playbackRate = state.rate;
  }
}

function rateButton() {
  return `<button type="button" class="en-chip${state.rate !== 1 ? " is-on" : ""}" data-rate>${state.rate === 1 ? "Velocidad normal" : "Más lento (0,75×)"}</button>`;
}

/* ================================================================
   MAPA DEL CURSO
   ================================================================ */

function renderHome() {
  if (!state) return;
  state.view = "home";
  state.current = null;
  state.clips.clear();
  stopAudio();
  const now = Date.now();
  const due = dueCards(state.cards, now);
  const overdue = overdueCount(state.cards, now);
  const states = lessonStates(course, state.progress, state.available, { isAdmin: env.isAdmin, overdue });
  const nextId = nextLessonId(course, states);
  const next = nextId ? BY_ID.get(nextId) : null;
  const done = Object.keys(state.progress.done || {}).filter(id => BY_ID.has(id)).length;
  const pct = Math.round(done / course.expectedLessons * 100);
  const currentLevel = next?.level.id || ROUTE.find(entry => !state.progress.done?.[entry.lesson.id])?.level.id || "a1";
  const immersion = immersionStatus(course, state.progress).find(item => item.level === currentLevel);
  const openLevel = state.openLevel || currentLevel;

  let html = `<div class="courseHead en-head">
    <div class="course-kickers"><span>✓ Ruta verificada</span><span>${course.expectedLessons} lecciones · A1 → C1</span><span>Coach: Matilda</span></div>
    <h2>${esc(course.title)}</h2>
    <p class="course-subtitle">${esc(course.subtitle)}</p>
    <div class="progbar"><div style="width:${pct}%"></div></div>
    <div class="progtxt">${done}/${course.expectedLessons} lecciones dominadas · ${pct}%</div>
  </div>
  <div class="stats"><span>Nivel ${Number(state.progress.level || 1)}</span><span>${Number(state.progress.xp || 0)} XP</span><span>Racha ${Number(state.progress.streak || 0)} día${Number(state.progress.streak || 0) === 1 ? "" : "s"}</span></div>
  <div class="en-actions">
    ${next ? `<button type="button" class="btn btn-mint" id="enNext">Seguir: ${esc(next.lesson.title)} <span>→</span></button>` : ""}
    <button type="button" class="btn btn-ghost" id="enReview"${due.length ? "" : " disabled"}>Repaso de hoy (${due.length})</button>
    <button type="button" class="btn btn-ghost" id="enChat">Habla con Matilda</button>
  </div>
  ${overdue > ENGLISH_RULES.maxOverdueReviews ? `<aside class="en-alert"><b>Tienes ${overdue} repasos atrasados.</b> Lo aprendido se está escapando: haz el repaso de hoy y se vuelven a abrir las lecciones nuevas.</aside>` : ""}
  <div class="en-panels">
    <section class="en-card">
      <h3>IA avanzada</h3>
      <label class="en-switch"><input type="checkbox" id="enAdvanced" ${advancedOn() ? "checked" : ""} ${state.config?.advancedAI ? "" : "disabled"}><span>Corregir y conversar con Claude Haiku 5.5</span></label>
      <p class="en-muted">${state.config?.advancedAI
        ? "Corrige mejor tu inglés. Cuesta fracciones de centavo por corrección; apágalo y se usa la IA normal (DeepSeek)."
        : "Todavía no está configurada en el servidor. Mientras tanto se usa la IA normal (DeepSeek)."}</p>
    </section>
    <section class="en-card">
      <h3>Inmersión ${esc(levelName(currentLevel))}</h3>
      <div class="en-meter"><div style="width:${Math.min(100, Math.round(immersion.minutes / immersion.required * 100))}%"></div></div>
      <p class="en-muted">${Math.floor(immersion.minutes / 60)} h ${immersion.minutes % 60} min de ${immersion.required / 60} h que pide el examen del nivel: series con subtítulos en inglés, pódcasts, lectura.</p>
      <form class="en-inline" id="enImmersion"><input type="number" min="1" max="600" placeholder="Minutos" aria-label="Minutos de inglés real" required><button class="btn btn-ghost btn-sm">Anotar</button></form>
    </section>
  </div>`;

  for (const level of course.levels) {
    const lessons = level.units.flatMap(unit => unit.lessons);
    const levelDone = lessons.filter(lesson => state.progress.done?.[lesson.id]).length;
    const isOpen = level.id === openLevel;
    html += `<section class="en-level${isOpen ? " open" : ""}">
      <button type="button" class="en-level-head" data-level="${level.id}" aria-expanded="${isOpen}">
        <span class="en-level-badge">${esc(level.cefr)}</span>
        <span class="en-level-title"><b>${esc(level.emoji)} ${esc(level.stage)} · ${esc(level.name)}</b><small>${levelDone}/${lessons.length} lecciones · ${esc(level.summary)}</small></span>
        <span class="unit-chevron" aria-hidden="true">⌄</span>
      </button>`;
    if (isOpen) {
      html += `<div class="en-units">`;
      level.units.forEach((unit, unitIndex) => {
        html += `<div class="en-unit"><h4><span class="unit-code">${String(unitIndex + 1).padStart(2, "0")}</span>${esc(unit.emoji)} ${esc(unit.title)}</h4>`;
        for (const lesson of unit.lessons) {
          const info = states.get(lesson.id) || { state: LESSON_STATE.soon };
          const icon = { done: "✓", open: "▶", locked: "🔒", soon: "…" }[info.state];
          const clickable = info.state === LESSON_STATE.done || info.state === LESSON_STATE.open;
          html += `<button type="button" class="lesson-item en-lesson is-${info.state}${lesson.id === nextId ? " next" : ""}" data-lesson="${lesson.id}" ${clickable ? "" : "disabled"}>
            <span class="chk">${icon}</span>
            <span class="li-txt"><b>${esc(lesson.title)}</b><span>${esc(lesson.objective)}</span>
            <small class="lesson-meta">${esc(lesson.id.toUpperCase())} · ${esc(FOCUS_LABEL[lesson.focus] || lesson.focus)}${info.state === LESSON_STATE.soon ? " · en preparación" : ""}${info.adminBypass ? " · abierta por ser admin" : ""}${info.state === LESSON_STATE.locked ? ` · ${esc(info.reason)}` : ""}${state.progress.scores?.[lesson.id] ? ` · ${state.progress.scores[lesson.id]} %` : ""}</small></span>
            ${lesson.id === nextId ? `<em class="next-label">SEGUIR</em>` : ""}
          </button>`;
        }
        html += `<div class="en-milestone">🏁 Examen de la unidad (${unit.checkpoint.passScore} % o más) · en preparación</div></div>`;
      });
      html += `<div class="en-milestone en-exam">🎓 Examen de nivel ${esc(level.cefr)}: escuchar, leer, lengua, escribir y hablar, mínimo ${level.exam.passEach} % en cada parte · requiere ${level.immersionHours} h de inmersión · en preparación</div></div>`;
    }
    html += `</section>`;
  }
  env.root.innerHTML = html;

  $q("#enNext")?.addEventListener("click", () => openLesson(nextId));
  $q("#enReview")?.addEventListener("click", renderReview);
  $q("#enChat")?.addEventListener("click", () => renderFreeChat(currentLevel));
  $q("#enAdvanced")?.addEventListener("change", event => {
    state.progress = { ...state.progress, settings: { ...(state.progress.settings || {}), advancedAI: event.target.checked } };
    saveProgress();
    toast(event.target.checked ? "IA avanzada activada (Claude Haiku 5.5)" : "IA normal (DeepSeek)");
  });
  $q("#enImmersion")?.addEventListener("submit", event => {
    event.preventDefault();
    const input = event.target.querySelector("input");
    const minutes = Number(input.value);
    if (!minutes) return;
    state.progress = touchStreak(addImmersion(state.progress, currentLevel, minutes), Date.now());
    saveProgress({ now: true });
    toast(`+${minutes} minutos de inmersión ✨`);
    renderHome();
  });
  $all(".en-level-head").forEach(button => button.addEventListener("click", () => {
    state.openLevel = state.openLevel === button.dataset.level ? "__none__" : button.dataset.level;
    renderHome();
  }));
  $all(".en-lesson").forEach(button => button.addEventListener("click", () => openLesson(button.dataset.lesson)));
}

/* ================================================================
   LECCIÓN
   ================================================================ */

async function openLesson(lessonId, section = null) {
  if (!state) return;
  const run = ++state.run;
  stopAudio();
  env.root.innerHTML = `<div class="lesson-loader"><div class="spinner"></div><b>Preparando la lección</b></div>`;
  let bundle;
  try {
    [bundle] = await Promise.all([loadLesson(lessonId), ensureConfig()]);
  } catch (error) {
    if (!state || run !== state.run) return;
    env.root.innerHTML = `<div class="lesson-error"><b>No pude abrir la lección.</b><p>${esc(error?.message || error)}</p><button type="button" class="btn btn-ghost btn-sm" id="enBack">← Volver a la ruta</button></div>`;
    $q("#enBack")?.addEventListener("click", renderHome);
    return;
  }
  if (!state || run !== state.run) return;
  const entry = BY_ID.get(lessonId);
  const firstPending = SECTIONS.find(([key]) => !sectionDone(lessonId, key))?.[0] || "master";
  state.current = { bundle, entry, section: section || firstPending };
  state.view = "lesson";
  renderLessonShell();
}

function renderLessonShell() {
  const { bundle, entry } = state.current;
  const lessonId = bundle.lesson.id;
  env.root.innerHTML = `<div class="en-lesson-view">
    <div class="en-topbar"><button type="button" class="btn btn-ghost btn-sm" id="enBack">← Volver a la ruta</button>${rateButton()}</div>
    <div class="lesson-heading"><p class="section-label">${esc(entry.level.cefr)} · ${esc(entry.unit.title)} · ${esc(lessonId.toUpperCase())}</p><h2>${esc(entry.lesson.title)}</h2><p class="lessobj">${esc(entry.lesson.objective)}</p></div>
    <div class="sectabs en-sectabs" role="tablist" aria-label="Partes de la lección">${SECTIONS.map(([key, label]) => `<button type="button" data-sec="${key}" class="${sectionDone(lessonId, key) ? "is-done" : ""}">${esc(label)}</button>`).join("")}</div>
    <div id="enBody"></div>
  </div>`;
  $q("#enBack").addEventListener("click", () => { stopAudio(); state.abort?.abort(); renderHome(); });
  $all(".en-sectabs button").forEach(button => button.addEventListener("click", () => showSection(button.dataset.sec)));
  showSection(state.current.section);
}

function showSection(section) {
  if (!state?.current) return;
  stopAudio();
  state.abort?.abort();
  state.abort = new AbortController();
  state.current.section = section;
  state.clips.clear();
  $all(".en-sectabs button").forEach(button => button.classList.toggle("active", button.dataset.sec === section));
  const body = $q("#enBody");
  const renderers = { start: renderStart, learn: renderLearn, listen: renderListen, pron: renderPron, practice: renderPractice, speak: renderSpeak, write: renderWrite, master: renderMaster };
  renderers[section](body);
  body.scrollIntoView?.({ behavior: "smooth", block: "start" });
}

function nextSectionButton(section) {
  const index = SECTIONS.findIndex(([key]) => key === section);
  const next = SECTIONS[index + 1];
  return next ? `<div class="en-next"><button type="button" class="btn btn-mint btn-sm" data-goto="${next[0]}">Seguir: ${esc(next[1])} →</button></div>` : "";
}

function wireGoto(host) {
  host.querySelectorAll("[data-goto]").forEach(button => button.addEventListener("click", () => showSection(button.dataset.goto)));
}

/* ---------- Empezar ---------- */

function coachBlock(bundle, part) {
  const coach = bundle.lesson.coach[part];
  return `<aside class="en-coach"><span class="en-avatar" aria-hidden="true">M</span><div><b>Matilda</b>${clipButton(bundle, "coach", coach.text, { label: "Escuchar a Matilda" })}<p lang="en">${esc(coach.text)}</p>${coach.es ? `<p class="en-translation">${esc(coach.es)}</p>` : ""}</div></aside>`;
}

function renderStart(body) {
  const { bundle } = state.current;
  const { lesson } = bundle;
  body.innerHTML = `${coachBlock(bundle, "intro")}
    <section class="en-card"><h3>Para calentar</h3><p>${esc(lesson.warmup.question)}</p></section>
    <section class="en-card"><h3>Inténtalo antes de aprender</h3><p class="en-muted">Equivocarte aquí es parte del método: el error con la respuesta justo después prepara tu memoria para la explicación.</p><div id="enTry"></div></section>
    <div id="enStartNext"></div>`;
  mountSequence($q("#enTry", body), lesson.warmup.tryFirst, {
    mode: "try", bundle, title: "Intento previo",
    onFinish: () => {
      markSection(lesson.id, "start");
      $q("#enStartNext", body).innerHTML = nextSectionButton("start");
      wireGoto(body);
    },
  });
}

/* ---------- Aprender ---------- */

function renderLearn(body) {
  const { bundle } = state.current;
  const { lesson } = bundle;
  const vocab = lesson.vocabulary.map(word => `<div class="en-word">
      <div class="en-word-top">${clipButton(bundle, "term", word.term, { label: `Escuchar ${word.term}` })}<b lang="en">${esc(word.term)}</b><code>${esc(word.ipa)}</code><small>${esc(word.pos)}</small></div>
      <p>${esc(word.meaning)}</p>
      <p class="en-example">${clipButton(bundle, "example", word.example, { label: "Escuchar el ejemplo" })}<span lang="en">${esc(word.example)}</span>${word.exampleMeaning ? `<small>${esc(word.exampleMeaning)}</small>` : ""}</p>
    </div>`).join("");
  const cognates = lesson.cognates;
  const pitfalls = lesson.grammar.pitfalls.map(pitfall => `<li><span class="en-wrong" lang="en">✗ ${esc(pitfall.wrong)}</span><span class="en-right" lang="en">✓ ${esc(pitfall.right)}</span><small>${esc(pitfall.why)}</small></li>`).join("");
  const examples = lesson.grammar.examples.map(example => `<li>${clipButton(bundle, "grammar", example.en)}<span lang="en">${esc(example.en)}</span>${example.es ? `<small>${esc(example.es)}</small>` : ""}</li>`).join("");
  body.innerHTML = `<section class="en-card"><h3>Vocabulario</h3><div class="en-vocab">${vocab}</div></section>
    <section class="en-card en-cognates"><h3>Tu superpoder: ${esc(cognates.pattern)}</h3><p>${esc(cognates.explanation)}</p>
      <ul class="en-pairs">${cognates.examples.map(example => `<li>${clipButton(bundle, "cognate", example.en)}<b lang="en">${esc(example.en)}</b><span>= ${esc(example.es)}</span></li>`).join("")}</ul>
      ${cognates.falseFriends.map(item => `<aside class="en-false-friend"><b>Falso amigo:</b> <span lang="en">${esc(item.en)}</span> no es «${esc(item.looksLike)}». ${esc(item.means)}</aside>`).join("")}
    </section>
    <section class="en-card en-grammar"><h3>Gramática</h3>${md(lesson.grammar.explanation)}
      <h4>Ejemplos</h4><ul class="en-examples">${examples}</ul>
      <h4>Errores típicos</h4><ul class="en-pitfalls">${pitfalls}</ul>
    </section>
    <div class="en-next"><button type="button" class="btn btn-mint btn-sm" id="enLearned">Ya lo estudié: seguir con Escuchar →</button></div>`;
  $q("#enLearned", body).addEventListener("click", () => { markSection(lesson.id, "learn"); showSection("listen"); });
}

/* ---------- Escuchar ---------- */

function renderListen(body) {
  const { bundle } = state.current;
  const { lesson } = bundle;
  const listening = lesson.listening;
  const lines = listening.lines.map((line, index) => {
    const speaker = listening.speakers[line.speaker] || {};
    return `<li class="en-line" data-line="${index}">${clipButton(bundle, "line", line.text, { voice: speaker.voice })}<b>${esc(speaker.name || line.speaker)}</b><span lang="en">${esc(line.text)}</span></li>`;
  }).join("");
  const inEnglish = lesson.level === "b2" || lesson.level === "c1";
  const dictation = listening.dictation.map(sentence => ({
    type: "dictation", instruction: inEnglish ? "Listen and write the sentence." : "Escucha y escribe la frase.",
    audioText: sentence, answers: [sentence], target: "",
    explain: inEnglish ? "Listen again while reading it: notice the words that escaped you." : "Vuelve a escucharla mirando el texto: fíjate en las palabras que se te escaparon.",
  }));
  body.innerHTML = `<section class="en-card en-episode">
      <p class="section-label">${listening.episode ? `${esc(listening.episode.series)} · episodio ${esc(listening.episode.number)}` : "Escucha"}</p>
      <h3>${esc(listening.title)}</h3><p>${esc(listening.context)}</p>
      <div class="en-player"><button type="button" class="btn btn-mint btn-sm" id="enPlayAll">▶ Escuchar el episodio</button>${rateButton()}<button type="button" class="en-chip" id="enShowText">Mostrar el texto</button></div>
      <ol class="en-transcript is-hidden" id="enTranscript">${lines}</ol>
    </section>
    <section class="en-card"><h3>Preguntas</h3><div id="enListenQ"></div></section>
    <section class="en-card"><h3>Dictado</h3><p class="en-muted">Escribe exactamente lo que oyes. Puedes repetir el audio las veces que quieras.</p><div id="enDictation"></div></section>
    <div id="enListenNext"></div>`;
  $q("#enShowText", body).addEventListener("click", event => {
    const list = $q("#enTranscript", body);
    list.classList.toggle("is-hidden");
    event.target.textContent = list.classList.contains("is-hidden") ? "Mostrar el texto" : "Ocultar el texto";
  });
  $q("#enPlayAll", body).addEventListener("click", () => playEpisode(body));
  let questionsDone = false, dictationDone = false;
  const finish = () => {
    if (!questionsDone || !dictationDone) return;
    markSection(lesson.id, "listen");
    $q("#enListenNext", body).innerHTML = nextSectionButton("listen");
    wireGoto(body);
  };
  mountSequence($q("#enListenQ", body), listening.questions, { mode: "check", bundle, title: "Comprensión", onFinish: () => { questionsDone = true; finish(); } });
  mountSequence($q("#enDictation", body), dictation, { mode: "check", bundle, title: "Dictado", onFinish: () => { dictationDone = true; finish(); } });
}

function playEpisode(body) {
  const { bundle } = state.current;
  const { listening } = bundle.lesson;
  const button = $q("#enPlayAll", body);
  if (state.episodePlaying) { state.episodePlaying = false; stopAudio(); button.textContent = "▶ Escuchar el episodio"; $all(".en-line.is-current", body).forEach(line => line.classList.remove("is-current")); return; }
  state.episodePlaying = true;
  button.textContent = "■ Detener";
  const step = (index) => {
    $all(".en-line.is-current", body).forEach(line => line.classList.remove("is-current"));
    if (!state?.episodePlaying || index >= listening.lines.length) { if (state) state.episodePlaying = false; button.textContent = "▶ Escuchar otra vez"; return; }
    const line = listening.lines[index];
    const voice = listening.speakers[line.speaker]?.voice;
    const item = bundle.byText.get(`line|${line.text}|${voice}`);
    $q(`.en-line[data-line="${index}"]`, body)?.classList.add("is-current");
    if (!item) { step(index + 1); return; }
    playItem(bundle.lesson.id, item, { onEnd: ok => { if (ok === false) { state.episodePlaying = false; button.textContent = "▶ Escuchar el episodio"; return; } setTimeout(() => step(index + 1), 350); } });
  };
  step(0);
}

/* ---------- Pronunciar ---------- */

function renderPron(body) {
  const { bundle } = state.current;
  const { lesson } = bundle;
  const pron = lesson.pronunciation;
  const canAssess = Boolean(state.config?.speech);
  const items = pron.items.map((item, index) => `<li class="en-pron-item">
      ${clipButton(bundle, "pron", item.text)}<b lang="en">${esc(item.text)}</b>${item.ipa ? `<code>${esc(item.ipa)}</code>` : ""}${item.tip ? `<small>${esc(item.tip)}</small>` : ""}
      <button type="button" class="en-chip" data-assess="item" data-index="${index}">🎙 Grábate</button><div class="en-assess" id="enAssessItem${index}"></div>
    </li>`).join("");
  const shadow = pron.shadowing.map((line, index) => `<li>${clipButton(bundle, "shadow", line)}<span lang="en">${esc(line)}</span>
      <button type="button" class="en-chip" data-assess="shadow" data-index="${index}">🎙 Grábate</button><div class="en-assess" id="enAssessShadow${index}"></div></li>`).join("");
  body.innerHTML = `<section class="en-card"><h3>Pronunciación</h3>${md(pron.explanation)}</section>
    <section class="en-card"><h3>Primero, el oído</h3><p class="en-muted">Cada ejercicio lo dice una voz distinta. Cuando tu oído distingue el sonido sin pensar, tu boca aprende a hacerlo.</p><div id="enHear"></div></section>
    <section class="en-card"><h3>Ahora tú</h3><p class="en-muted">${canAssess ? "Escucha, repite y grábate: Azure califica tu pronunciación palabra por palabra." : "Escucha y repite en voz alta. La calificación automática de pronunciación se activa cuando se configure Azure en el servidor."}</p>${rateButton()}<ul class="en-pron-list">${items}</ul></section>
    <section class="en-card"><h3>Shadowing</h3><p class="en-muted">Pon el audio y habla encima, al mismo tiempo, imitando el ritmo y la entonación. Repite hasta que suene igual.</p><ul class="en-pron-list">${shadow}</ul></section>
    <div id="enPronNext"></div>`;
  body.querySelectorAll("[data-assess]").forEach(button => button.addEventListener("click", () => {
    const index = Number(button.dataset.index);
    const reference = button.dataset.assess === "item" ? pron.items[index].text : pron.shadowing[index];
    const target = $q(button.dataset.assess === "item" ? `#enAssessItem${index}` : `#enAssessShadow${index}`, body);
    assessReference(button, target, reference);
  }));
  mountSequence($q("#enHear", body), pron.discrimination, {
    mode: "check", bundle, title: "Entrenamiento del oído",
    onFinish: (results) => {
      markSection(lesson.id, "pron");
      const right = results.filter(result => result.firstTry).length;
      $q("#enPronNext", body).innerHTML = `<p class="en-muted">Oído: ${right}/${results.length} a la primera.</p>${nextSectionButton("pron")}`;
      wireGoto(body);
    },
  });
}

async function assessReference(button, target, reference) {
  if (!state.config?.speech) {
    target.innerHTML = `<p class="en-muted">La calificación automática todavía no está activa. Repite en voz alta comparándote con el audio.</p>`;
    return;
  }
  button.disabled = true;
  target.innerHTML = `<p class="en-listening">🎙 Te escucho… di la frase.</p>`;
  try {
    const result = await speech.assessScripted({ referenceText: reference, fetchToken: () => env.api("/api/english?task=speech-token") });
    if (!result.scores) { target.innerHTML = `<p class="en-muted">${esc(result.message || "No te escuché.")}</p>`; return; }
    target.innerHTML = scoresHtml(result.scores, [["pronunciation", "Global"], ["accuracy", "Precisión"], ["fluency", "Fluidez"], ["completeness", "Completo"], ["prosody", "Entonación"]])
      + `<p class="en-words">${result.words.map(word => `<span class="${word.error !== "None" ? "is-error" : word.accuracy < 60 ? "is-bad" : word.accuracy < 80 ? "is-mid" : "is-good"}" title="${esc(`${word.accuracy ?? "—"} · ${word.error}`)}">${esc(word.word)}</span>`).join(" ")}</p>`;
  } catch (error) {
    target.innerHTML = `<p class="en-muted">${esc(error?.message || "No se pudo grabar.")}</p>`;
  } finally {
    button.disabled = false;
  }
}

function scoresHtml(scores, labels, max = 100) {
  return `<div class="en-scores">${labels.filter(([key]) => scores?.[key] != null).map(([key, label]) => {
    const value = Number(scores[key]);
    const pct = Math.round(value / max * 100);
    return `<div class="en-score"><span>${esc(label)}</span><div class="en-meter"><div class="${pct >= 80 ? "is-good" : pct >= 60 ? "is-mid" : "is-bad"}" style="width:${pct}%"></div></div><b>${value}${max === 5 ? "/5" : ""}</b></div>`;
  }).join("")}</div>`;
}

/* ---------- Practicar ---------- */

function renderPractice(body) {
  const { bundle } = state.current;
  const { lesson } = bundle;
  body.innerHTML = `<section class="en-card"><h3>Práctica</h3><p class="en-muted">Si te equivocas, recibes una pista y otra oportunidad antes de ver la respuesta. Escribir cuesta más que elegir, y por eso enseña más.</p><div id="enPractice"></div></section><div id="enPracticeNext"></div>`;
  mountSequence($q("#enPractice", body), shuffle(lesson.practice), {
    mode: "practice", bundle, title: "Práctica",
    onFinish: (results) => {
      markSection(lesson.id, "practice");
      const right = results.filter(result => result.firstTry).length;
      $q("#enPracticeNext", body).innerHTML = `<p class="en-muted">${right}/${results.length} a la primera. ${right / results.length >= 0.8 ? "¡Vas muy bien!" : "Repasa la explicación antes del dominio."}</p>${nextSectionButton("practice")}`;
      wireGoto(body);
    },
  });
}

/* ---------- Hablar (4/3/2) y juego de roles ---------- */

function renderSpeak(body) {
  const { bundle, entry } = state.current;
  const { lesson } = bundle;
  const task = lesson.speaking;
  body.innerHTML = `<section class="en-card"><h3>Hablar: la misma charla, cada vez más rápido</h3><p>${esc(task.task)}</p>
      <ul>${task.prompts.map(prompt => `<li>${esc(prompt)}</li>`).join("")}</ul>
      <p class="en-muted">Lo que se espera oír: ${task.targetLanguage.map(item => `<code>${esc(item)}</code>`).join(" · ")}</p>
      <div id="enRounds"></div>
      <details class="en-model"><summary>Ver y escuchar una respuesta modelo</summary>${clipButton(bundle, "speaking-model", task.model, { label: "Escuchar el modelo", big: true })}<p lang="en">${esc(task.model)}</p></details>
    </section>
    <section class="en-card"><h3>Juego de roles con ${esc(lesson.roleplay.character)}</h3><div id="enRoleplay"></div></section>
    <div id="enSpeakNext">${nextSectionButton("speak")}</div>`;
  wireGoto(body);
  mountRounds($q("#enRounds", body), { task, level: entry.level.id, onFeedback: () => markSection(lesson.id, "speak") });
  mountRoleplay($q("#enRoleplay", body), {
    ...lesson.roleplay, level: entry.level.id, bundle,
    onFinish: () => markSection(lesson.id, "speak"),
  });
}

function mountRounds(host, { task, level, onFeedback }) {
  const rounds = task.rounds;
  const transcripts = [];
  const pronunciation = [];
  const useAzure = Boolean(state.config?.speech);
  const draw = () => {
    const index = transcripts.length;
    if (index < rounds.length) {
      host.innerHTML = `<div class="en-round"><b>Ronda ${index + 1} de ${rounds.length}: ${rounds[index]} segundos</b>
        <p class="en-muted">${index === 0 ? "Cuenta tu historia completa." : "Cuenta lo mismo otra vez, con menos tiempo: menos pausas, mismas ideas."}</p>
        <button type="button" class="btn btn-mint btn-sm" id="enRec">🎙 Empezar a hablar</button>
        <p class="en-live" id="enLive" lang="en"></p>
        <details class="en-fallback"><summary>No tengo micrófono: escribir lo que diría</summary><textarea rows="3" id="enTyped"></textarea><button type="button" class="btn btn-ghost btn-sm" id="enTypedOk">Usar este texto</button></details></div>
        ${transcripts.map((round, i) => `<p class="en-muted">Ronda ${i + 1}: «${esc(round.text || "(sin voz)")}»</p>`).join("")}`;
      $q("#enRec", host).addEventListener("click", () => record(index));
      $q("#enTypedOk", host).addEventListener("click", () => {
        const text = $q("#enTyped", host).value.trim();
        if (!text) return;
        transcripts.push({ seconds: rounds[index], text });
        draw();
      });
      return;
    }
    host.innerHTML = `${transcripts.map((round, i) => `<p class="en-muted">Ronda ${i + 1} (${round.seconds} s): «${esc(round.text || "(sin voz)")}»</p>`).join("")}
      <button type="button" class="btn btn-mint btn-sm" id="enAskSpeak">Pedir la devolución</button><div id="enSpeakFeedback"></div>`;
    $q("#enAskSpeak", host).addEventListener("click", askFeedback);
  };
  const record = async (index) => {
    const button = $q("#enRec", host);
    const live = $q("#enLive", host);
    button.disabled = true;
    let remaining = rounds[index];
    button.textContent = `🎙 Hablando… ${remaining} s`;
    const tick = setInterval(() => { remaining -= 1; if (remaining >= 0) button.textContent = `🎙 Hablando… ${remaining} s`; }, 1000);
    try {
      const options = { seconds: rounds[index], onText: text => { live.textContent = text; }, signal: state.abort?.signal };
      const result = useAzure
        ? await speech.recordFree({ ...options, fetchToken: () => env.api("/api/english?task=speech-token") })
        : await speech.recordBrowser(options);
      transcripts.push({ seconds: rounds[index], text: result.text });
      if (result.scores) pronunciation.push({ ...result.scores, weakWords: result.weakWords });
      draw();
    } catch (error) {
      button.disabled = false;
      button.textContent = "🎙 Empezar a hablar";
      live.textContent = error?.message || "No se pudo grabar.";
    } finally {
      clearInterval(tick);
    }
  };
  const askFeedback = async () => {
    const button = $q("#enAskSpeak", host);
    const out = $q("#enSpeakFeedback", host);
    button.disabled = true;
    out.innerHTML = `<div class="spinner"></div>`;
    const average = key => pronunciation.length ? Math.round(pronunciation.reduce((sum, item) => sum + (Number(item[key]) || 0), 0) / pronunciation.length) : null;
    try {
      const data = await env.api("/api/english", { method: "POST", body: {
        task: "speak", level, instructions: task.task, targetLanguage: task.targetLanguage, transcripts,
        pronunciation: pronunciation.length ? { accuracy: average("accuracy"), fluency: average("fluency"), prosody: average("prosody"), weakWords: [...new Set(pronunciation.flatMap(item => item.weakWords || []))] } : null,
        advanced: advancedOn(),
      } });
      const feedback = data.result;
      out.innerHTML = (pronunciation.length ? `<h4>Pronunciación (Azure)</h4>${scoresHtml({ accuracy: average("accuracy"), fluency: average("fluency"), prosody: average("prosody") }, [["accuracy", "Precisión"], ["fluency", "Fluidez"], ["prosody", "Entonación"]])}` : "")
        + `<h4>Devolución${data.advanced ? " · IA avanzada" : ""}</h4>${scoresHtml(feedback.scores, [["task", "Tarea"], ["range", "Variedad"], ["accuracy", "Corrección"], ["fluency", "Fluidez"]], 5)}${feedbackHtml(feedback)}
        ${feedback.targetUsed.length ? `<p class="en-muted">Usaste: ${feedback.targetUsed.map(item => `<code>${esc(item)}</code>`).join(" ")}</p>` : ""}
        <button type="button" class="btn btn-ghost btn-sm" id="enAgain">Hacerlo otra vez</button>`;
      $q("#enAgain", host).addEventListener("click", () => { transcripts.length = 0; pronunciation.length = 0; draw(); });
      onFeedback?.();
    } catch (error) {
      button.disabled = false;
      out.innerHTML = `<p class="en-muted">${esc(error?.message || "No se pudo pedir la devolución.")}</p>`;
    }
  };
  draw();
}

function feedbackHtml(feedback) {
  return `${feedback.overall ? `<p>${esc(feedback.overall)}</p>` : ""}
    ${feedback.strengths.length ? `<h4>Lo que salió bien</h4><ul>${feedback.strengths.map(item => `<li>${esc(item)}</li>`).join("")}</ul>` : ""}
    ${feedback.corrections.length ? `<h4>Para corregir</h4><ul class="en-pitfalls">${feedback.corrections.map(item => `<li><span class="en-wrong" lang="en">✗ ${esc(item.original)}</span><span class="en-right" lang="en">✓ ${esc(item.corrected)}</span><small>${esc(item.why)}</small></li>`).join("")}</ul>` : ""}
    ${feedback.nextStep ? `<aside class="en-next-step"><b>Siguiente paso:</b> ${esc(feedback.nextStep)}</aside>` : ""}`;
}

function mountRoleplay(host, { character, voice, scenario, goals, opening, maxTurns, level, bundle, onFinish }) {
  const history = [{ role: "assistant", content: opening.text }];
  const met = new Set();
  let finished = false;
  let busy = false;
  const canSpeak = Boolean(state.config?.speech) || speech.browserRecognitionAvailable();
  const openingButton = bundle ? clipButton(bundle, "roleplay", opening.text, { voice, label: `Escuchar a ${character}` }) : "";
  host.innerHTML = `<p>${esc(scenario)}</p>
    <ul class="en-goals">${goals.map((goal, index) => `<li data-goal="${index}">${esc(goal)}</li>`).join("")}</ul>
    <div class="en-chat" aria-live="polite"><div class="en-msg is-them"><b>${esc(character)}</b>${openingButton}<span lang="en">${esc(opening.text)}</span></div></div>
    <form class="en-chat-input"><textarea rows="2" lang="en" placeholder="Answer in English…" aria-label="Tu respuesta en inglés"></textarea>
      ${canSpeak ? `<button type="button" class="btn btn-ghost btn-sm" data-mic>🎙 Hablar</button>` : ""}
      <button class="btn btn-mint btn-sm">Enviar</button></form>
    <p class="en-muted en-turns">Turnos: 0/${maxTurns}</p>`;
  const chat = $q(".en-chat", host);
  const form = $q(".en-chat-input", host);
  const input = form.querySelector("textarea");
  const add = (html, cls) => { const div = document.createElement("div"); div.className = `en-msg ${cls}`; div.innerHTML = html; chat.appendChild(div); chat.scrollTop = chat.scrollHeight; return div; };
  const userTurns = () => history.filter(turn => turn.role === "user").length;
  const say = (text) => {
    if (!("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = state?.rate === 1 ? 0.95 : 0.8;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };
  const send = async (text) => {
    if (busy || finished || !text.trim()) return;
    busy = true;
    history.push({ role: "user", content: text.trim() });
    const mine = add(`<b>Tú</b><span lang="en">${esc(text.trim())}</span>`, "is-me");
    input.value = "";
    const thinking = add(`<span class="think dots">${esc(character)} está pensando</span>`, "is-them");
    try {
      const data = await env.api("/api/english", { method: "POST", body: {
        task: "roleplay", level, character, scenario, goals, opening: opening.text, history, advanced: advancedOn(),
      } });
      thinking.remove();
      const turn = data.result;
      history.push({ role: "assistant", content: turn.reply });
      const reply = add(`<b>${esc(character)}</b><button type="button" class="en-play" data-say aria-label="Escuchar"><span aria-hidden="true">▶</span></button><span lang="en">${esc(turn.reply)}</span>`, "is-them");
      reply.querySelector("[data-say]").addEventListener("click", () => say(turn.reply));
      if (turn.correction) {
        const note = document.createElement("aside");
        note.className = "en-note";
        note.innerHTML = `<b>Nota de Matilda:</b> <span class="en-wrong" lang="en">${esc(turn.correction.said)}</span> → <span class="en-right" lang="en">${esc(turn.correction.better)}</span><small>${esc(turn.correction.why)}</small>`;
        mine.appendChild(note);
      }
      turn.goalsMet.forEach(index => met.add(index));
      host.querySelectorAll("[data-goal]").forEach(li => li.classList.toggle("is-met", met.has(Number(li.dataset.goal))));
      $q(".en-turns", host).textContent = `Turnos: ${userTurns()}/${maxTurns} · objetivos ${met.size}/${goals.length}`;
      if (turn.finished || met.size === goals.length || userTurns() >= maxTurns) {
        finished = true;
        form.querySelectorAll("textarea, button").forEach(element => { element.disabled = true; });
        add(`<b>Fin de la escena.</b> Cumpliste ${met.size} de ${goals.length} objetivos.${met.size < goals.length ? " Vuelve a intentarlo para cumplirlos todos." : " ¡Excelente!"}`, "is-system");
        onFinish?.(met.size, goals.length);
      }
    } catch (error) {
      thinking.remove();
      history.pop();
      mine.remove();
      input.value = text;
      add(`⚠️ ${esc(error?.message || "No se pudo responder.")}`, "is-system");
    } finally {
      busy = false;
    }
  };
  form.addEventListener("submit", event => { event.preventDefault(); send(input.value); });
  input.addEventListener("keydown", event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(input.value); } });
  form.querySelector("[data-mic]")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "🎙 Te escucho…";
    try {
      const text = await speech.recognizeOnce({ useAzure: Boolean(state.config?.speech), fetchToken: () => env.api("/api/english?task=speech-token") });
      if (text) send(text);
    } catch (error) {
      toast(error?.message || "No se pudo usar el micrófono.");
    } finally {
      button.disabled = false;
      button.textContent = "🎙 Hablar";
    }
  });
}

/* Conversación libre con Matilda desde el mapa: practicar sin lección de por medio. */
function renderFreeChat(levelId) {
  state.view = "chat";
  state.clips.clear();
  stopAudio();
  env.root.innerHTML = `<div class="en-lesson-view"><div class="en-topbar"><button type="button" class="btn btn-ghost btn-sm" id="enBack">← Volver a la ruta</button></div>
    <div class="lesson-heading"><p class="section-label">${esc(levelName(levelId))} · conversación libre</p><h2>Habla con Matilda</h2><p class="lessobj">Practica lo que sabes. Matilda te habla a tu nivel y te deja notas cuando algo se puede decir mejor.</p></div>
    <section class="en-card"><div id="enFree"></div></section></div>`;
  $q("#enBack").addEventListener("click", renderHome);
  mountRoleplay($q("#enFree"), {
    character: "Matilda", voice: ENGLISH_CAST.Matilda.voice, level: levelId, bundle: null, maxTurns: 20,
    scenario: "Una charla relajada con Matilda, tu coach de inglés, sobre tu día, tus planes y lo que estás aprendiendo.",
    goals: ["Saluda y cuéntale cómo va tu día.", "Usa algo que aprendiste en tu última lección.", "Hazle al menos una pregunta a Matilda."],
    opening: { text: "Hi there! It's so good to see you. How's your day going?" },
  });
}

/* ---------- Escribir ---------- */

function renderWrite(body) {
  const { bundle, entry } = state.current;
  const { lesson } = bundle;
  const task = lesson.writing;
  const draftKey = `avici-en-draft-${lesson.id}`;
  let draft = "";
  try { draft = localStorage.getItem(draftKey) || ""; } catch {}
  body.innerHTML = `<section class="en-card"><h3>Escribir</h3><p>${esc(task.task)}</p>
      <p class="en-muted">Entre ${task.minWords} y ${task.maxWords} palabras.</p>
      <ul class="en-checklist">${task.checklist.map(item => `<li>${esc(item)}</li>`).join("")}</ul>
      <textarea class="en-writing" rows="9" lang="en" spellcheck="false" placeholder="Write here…">${esc(draft)}</textarea>
      <div class="en-write-bar"><span id="enCount"></span><button type="button" class="btn btn-mint btn-sm" id="enCorrect">Corregir</button></div>
      <div id="enWriteFeedback"></div>
      <details class="en-model" id="enWriteModel" hidden><summary>Ver el texto modelo</summary><p lang="en">${esc(task.model)}</p></details>
    </section>${nextSectionButton("write")}`;
  wireGoto(body);
  const area = $q(".en-writing", body);
  const counter = $q("#enCount", body);
  const update = () => {
    const words = countWords(area.value);
    counter.textContent = `${words} palabras`;
    counter.className = words >= task.minWords && words <= task.maxWords ? "is-good" : "is-bad";
    try { localStorage.setItem(draftKey, area.value); } catch {}
  };
  area.addEventListener("input", update);
  update();
  $q("#enCorrect", body).addEventListener("click", async () => {
    const words = countWords(area.value);
    if (words < Math.min(10, task.minWords)) { toast("Escribe tu texto primero."); return; }
    const button = $q("#enCorrect", body);
    const out = $q("#enWriteFeedback", body);
    button.disabled = true;
    out.innerHTML = `<div class="spinner"></div>`;
    try {
      const data = await env.api("/api/english", { method: "POST", body: {
        task: "write", level: entry.level.id, instructions: task.task, minWords: task.minWords, maxWords: task.maxWords,
        checklist: task.checklist, text: area.value, advanced: advancedOn(),
      } });
      const feedback = data.result;
      out.innerHTML = `<h4>Devolución${data.advanced ? " · IA avanzada" : ""}</h4>
        ${words < task.minWords || words > task.maxWords ? `<aside class="en-alert">Tu texto tiene ${words} palabras y la tarea pide entre ${task.minWords} y ${task.maxWords}. En un examen eso baja la nota.</aside>` : ""}
        ${scoresHtml(feedback.scores, [["content", "Contenido"], ["communicative", "Propósito y registro"], ["organisation", "Organización"], ["language", "Lengua"]], 5)}
        ${feedbackHtml(feedback)}
        ${feedback.checklist.length ? `<ul class="en-checklist">${feedback.checklist.map(item => `<li class="${item.met ? "is-met" : "is-missing"}">${esc(item.item)}</li>`).join("")}</ul>` : ""}
        <p class="en-muted">Corrige tu texto con estas notas y vuelve a pedir la corrección: reescribir es donde más se aprende.</p>`;
      $q("#enWriteModel", body).hidden = false;
      markSection(lesson.id, "write");
    } catch (error) {
      out.innerHTML = `<p class="en-muted">${esc(error?.message || "No se pudo corregir.")}</p>`;
    } finally {
      button.disabled = false;
    }
  });
}

/* ---------- Dominio ---------- */

function renderMaster(body) {
  const { bundle, entry } = state.current;
  const { lesson } = bundle;
  const missing = REQUIRED_BEFORE_MASTERY.filter(section => !sectionDone(lesson.id, section));
  const mission = lesson.mission;
  const missionHtml = `<section class="en-card en-mission"><h3>Misión de inmersión · ${mission.minutes} min</h3><p>${esc(mission.task)}</p>
    ${mission.kind === "watch" ? `<p class="en-muted">Subtítulos en inglés, nunca en español: en español le estorban a tu oído.</p>` : ""}
    <form class="en-inline" id="enMission"><input type="number" min="1" max="600" value="${mission.minutes}" aria-label="Minutos"><button class="btn btn-ghost btn-sm">La hice: anotar minutos</button></form></section>`;
  const best = state.progress.scores?.[lesson.id];
  if (missing.length && !env.isAdmin) {
    body.innerHTML = `<section class="en-card"><h3>Prueba de dominio</h3><p>Antes de la prueba completa: ${missing.map(section => `<b>${esc(SECTIONS.find(([key]) => key === section)[1])}</b>`).join(", ")}.</p></section>${missionHtml}`;
  } else {
    body.innerHTML = `<section class="en-card"><h3>Prueba de dominio</h3>
        <p>Necesitas <b>${ENGLISH_RULES.lessonMastery} %</b> o más. Un solo intento por pregunta. ${best ? `Tu mejor nota: ${best} %.` : ""}</p>
        ${missing.length ? `<p class="en-muted">Como admin puedes hacerla sin haber completado ${missing.join(", ")}.</p>` : ""}
        <div id="enMastery"></div></section>${missionHtml}`;
    mountSequence($q("#enMastery", body), shuffle(lesson.mastery), {
      mode: "test", bundle, title: "Dominio",
      onFinish: (results) => finishMastery(body, results),
    });
  }
  $q("#enMission", body)?.addEventListener("submit", event => {
    event.preventDefault();
    const minutes = Number(event.target.querySelector("input").value);
    if (!minutes) return;
    state.progress = touchStreak(addImmersion(state.progress, entry.level.id, minutes), Date.now());
    saveProgress({ now: true });
    event.target.innerHTML = `<p class="en-muted">✓ ${minutes} minutos anotados en ${esc(entry.level.cefr)}.</p>`;
  });
}

function finishMastery(body, results) {
  const { bundle } = state.current;
  const { lesson } = bundle;
  const right = results.filter(result => result.correct).length;
  const score = Math.round(right / results.length * 100);
  const passed = score >= ENGLISH_RULES.lessonMastery;
  const missed = results.filter(result => !result.correct).map(result => result.exercise);
  const host = $q("#enMastery", body);
  if (passed) {
    const { progress, firstTime } = recordMastery(state.progress, lesson.id, score, Date.now());
    state.progress = progress;
    markSection(lesson.id, "master");
    saveProgress({ now: true });
    const fresh = cardsFromLesson(lesson, { missed, now: Date.now() });
    const known = new Set(state.cards.map(card => card.id));
    state.cards = [...state.cards, ...fresh.filter(card => !known.has(card.id))];
    saveCards();
    host.innerHTML = `<div class="quizres"><h3>🎉 Dominio demostrado · ${right}/${results.length} (${score} %)</h3>
      <p>${firstTime ? `+${score} XP. ` : ""}Tu vocabulario, tus errores típicos${missed.length ? " y las preguntas que fallaste" : ""} pasan al repaso diario: volverán justo cuando estés por olvidarlos.</p></div>
      ${coachBlock(bundle, "outro")}
      <div class="en-next"><button type="button" class="btn btn-mint btn-sm" id="enHome">Volver a la ruta →</button></div>`;
    $q("#enHome", host).addEventListener("click", renderHome);
  } else {
    host.innerHTML = `<div class="quizres"><h3>🧠 Todavía está creciendo · ${right}/${results.length} (${score} %)</h3>
      <p>La meta es ${ENGLISH_RULES.lessonMastery} %. Repasa lo que fallaste y vuelve a intentarlo: equivocarte aquí también es estudiar.</p>
      <ul class="en-pitfalls">${missed.map(exercise => `<li><span lang="en">${esc(exercise.q || exercise.audioText || (exercise.words || []).join(" "))}</span><span class="en-right" lang="en">✓ ${esc(exercise.answers?.[0] ?? exercise.options?.[exercise.answer] ?? "")}</span><small>${esc(exercise.explain)}</small></li>`).join("")}</ul>
      <button type="button" class="btn btn-ghost btn-sm" id="enRetry">Intentar otra vez</button></div>`;
    $q("#enRetry", host).addEventListener("click", () => showSection("master"));
  }
}

/* ================================================================
   EJERCICIOS
   modos: "try" (intento previo: respuesta al instante), "practice" (pista y segundo
   intento), "check" (un intento, sin nota), "test" (un intento, cuenta para la nota)
   ================================================================ */

function mountSequence(host, exercises, { mode, bundle, title, onFinish }) {
  const results = [];
  let index = 0;
  const draw = () => {
    if (!host.isConnected) return;
    if (index >= exercises.length) {
      const right = results.filter(result => mode === "test" ? result.correct : result.firstTry).length;
      host.innerHTML = `<p class="en-done">✓ ${esc(title)} completo · ${right}/${results.length}${mode === "test" ? "" : " a la primera"}</p>`;
      onFinish?.(results);
      return;
    }
    host.innerHTML = `<div class="en-seq"><div class="en-seq-head"><span>${esc(title)}</span><span>${index + 1}/${exercises.length}</span></div><div class="en-meter"><div style="width:${Math.round(index / exercises.length * 100)}%"></div></div><div class="en-ex"></div></div>`;
    mountExercise(host.querySelector(".en-ex"), exercises[index], mode, bundle, (result) => {
      results.push(result);
      const next = document.createElement("div");
      next.className = "en-next";
      next.innerHTML = `<button type="button" class="btn btn-mint btn-sm">${index + 1 < exercises.length ? "Siguiente →" : "Terminar"}</button>`;
      host.querySelector(".en-ex").appendChild(next);
      const button = next.querySelector("button");
      button.addEventListener("click", () => { index++; draw(); });
      button.focus();
    });
  };
  draw();
}

function answerOf(exercise) {
  if (exercise.type === "choice" || exercise.type === "hear") return exercise.options[exercise.answer];
  if (exercise.type === "match") return "";
  return exercise.answers?.[0] || "";
}

function mountExercise(host, exercise, mode, bundle, done) {
  /* Solo la vista previa local pasa `debug`: le permite a una prueba automática saber qué
     ejercicio está en pantalla (en los de audio, la respuesta no está escrita). */
  if (env.debug) { env.debug.current = exercise; host.__enExercise = exercise; }
  let attempts = 0;
  let finished = false;
  const lessonId = bundle.lesson.id;
  const playVoice = () => {
    const voices = exercise.voices?.length ? exercise.voices : [NARRATOR_VOICE];
    const voice = pick(voices);
    const item = bundle.byText.get(`${exercise.type === "hear" ? "hear" : "dictation"}|${exercise.audioText}|${voice}`);
    if (item) playItem(lessonId, item, { button: host.querySelector(".en-play") });
  };
  const audioButton = exercise.type === "hear" || exercise.type === "dictation"
    ? `<button type="button" class="en-play en-play-big" data-listen aria-label="Escuchar"><span aria-hidden="true">▶</span><b>Escuchar</b></button>`
    : "";
  const prompt = exercise.q ? `<p class="en-q" lang="${exercise.type === "translate" ? "es" : "en"}">${esc(exercise.q).replace(/___/g, '<span class="en-blank">____</span>')}</p>` : "";
  const base = `<p class="en-instruction">${esc(exercise.instruction)}</p>${audioButton}${prompt}`;
  const feedback = `<div class="en-feedback" aria-live="polite"></div>`;

  const finish = (correct, { reveal = !correct } = {}) => {
    if (finished) return;
    finished = true;
    host.querySelectorAll("input, textarea, .en-opt, .en-chipword, [data-submit]").forEach(element => { element.disabled = true; });
    const box = host.querySelector(".en-feedback");
    box.className = `en-feedback ${correct ? "is-ok" : "is-bad"}`;
    box.innerHTML = `${correct ? "✅ ¡Correcto!" : `❌ ${reveal && answerOf(exercise) ? `Respuesta: <b lang="en">${esc(answerOf(exercise))}</b>` : "No es esa."}`}<p>${esc(exercise.explain)}</p>`;
    done({ exercise, correct, firstTry: correct && attempts === 1 });
  };
  const miss = (message) => {
    const box = host.querySelector(".en-feedback");
    if (mode === "practice" && attempts === 1) {
      box.className = "en-feedback is-hint";
      box.innerHTML = `💡 ${esc(message || exercise.hint || "Revisa la explicación e inténtalo otra vez.")}`;
      return;
    }
    finish(false, { reveal: true });
  };

  if (exercise.type === "choice" || exercise.type === "hear") {
    host.innerHTML = `${base}<div class="opts">${exercise.options.map((option, index) => `<button type="button" class="opt en-opt" data-index="${index}" lang="en">${esc(option)}</button>`).join("")}</div>${feedback}`;
    host.querySelectorAll(".en-opt").forEach(button => button.addEventListener("click", () => {
      if (finished || button.disabled) return;
      attempts++;
      const correct = Number(button.dataset.index) === exercise.answer;
      if (correct) { button.classList.add("ok"); finish(true); return; }
      button.classList.add("bad");
      button.disabled = true;
      if (mode === "practice" && attempts === 1) { miss(exercise.hint); return; }
      host.querySelector(`.en-opt[data-index="${exercise.answer}"]`)?.classList.add("ok");
      finish(false);
    }));
  } else if (exercise.type === "match") {
    const rights = shuffle(exercise.pairs.map(([, right], index) => ({ right, index })));
    host.innerHTML = `${base}<div class="matchwrap"><div class="matchcol">${exercise.pairs.map(([left], index) => `<button type="button" class="matchbtn en-opt" data-left="${index}" lang="en">${esc(left)}</button>`).join("")}</div><div class="matchcol">${rights.map(item => `<button type="button" class="matchbtn en-opt" data-right="${item.index}">${esc(item.right)}</button>`).join("")}</div></div>${feedback}`;
    let selected = null, matched = 0, errors = 0;
    attempts = 1;
    host.querySelectorAll("[data-left]").forEach(button => button.addEventListener("click", () => {
      if (button.classList.contains("matched")) return;
      host.querySelectorAll("[data-left]").forEach(other => other.classList.remove("sel"));
      button.classList.add("sel");
      selected = button;
    }));
    host.querySelectorAll("[data-right]").forEach(button => button.addEventListener("click", () => {
      if (!selected || button.classList.contains("matched")) return;
      if (button.dataset.right === selected.dataset.left) {
        button.classList.add("matched"); selected.classList.add("matched"); selected.classList.remove("sel"); selected = null; matched++;
        if (matched === exercise.pairs.length) finish(errors === 0, { reveal: false });
      } else {
        errors++;
        const left = selected;
        button.classList.add("wrong"); left.classList.add("wrong");
        setTimeout(() => { button.classList.remove("wrong"); left.classList.remove("wrong", "sel"); }, 600);
        selected = null;
      }
    }));
  } else if (exercise.type === "order") {
    const pool = shuffle(exercise.words.map((word, index) => ({ word, index })));
    host.innerHTML = `${base}<div class="en-built" aria-label="Tu frase"></div><div class="en-pool">${pool.map(item => `<button type="button" class="en-chipword" data-word="${item.index}" lang="en">${esc(item.word)}</button>`).join("")}</div>
      <div class="en-ex-actions"><button type="button" class="btn btn-ghost btn-sm" data-reset>Borrar</button><button type="button" class="btn btn-mint btn-sm" data-submit>Comprobar</button></div>${feedback}`;
    const built = [];
    const builtBox = host.querySelector(".en-built");
    const redraw = () => {
      builtBox.innerHTML = built.map(index => `<button type="button" class="en-chipword is-placed" data-placed="${index}" lang="en">${esc(exercise.words[index])}</button>`).join("") || `<span class="en-muted">Toca las palabras en orden…</span>`;
      host.querySelectorAll("[data-word]").forEach(button => { button.hidden = built.includes(Number(button.dataset.word)); });
      builtBox.querySelectorAll("[data-placed]").forEach(button => button.addEventListener("click", () => { if (finished) return; built.splice(built.indexOf(Number(button.dataset.placed)), 1); redraw(); }));
    };
    host.querySelectorAll("[data-word]").forEach(button => button.addEventListener("click", () => { if (finished) return; built.push(Number(button.dataset.word)); redraw(); }));
    host.querySelector("[data-reset]").addEventListener("click", () => { if (finished) return; built.length = 0; redraw(); });
    host.querySelector("[data-submit]").addEventListener("click", () => {
      if (finished || built.length !== exercise.words.length) { if (!finished) toast("Usa todas las palabras."); return; }
      attempts++;
      const result = checkTypedAnswer(built.map(index => exercise.words[index]).join(" "), exercise.answers, { strict: exercise.strict });
      if (result.correct) finish(true); else miss(exercise.hint);
    });
    redraw();
  } else {
    const multiline = exercise.type === "transform" || exercise.type === "translate" || exercise.type === "correct" || exercise.type === "dictation";
    host.innerHTML = `${base}${exercise.type === "wordform" ? `<p class="en-muted">Palabra base: <b lang="en">${esc(exercise.base)}</b></p>` : ""}
      ${multiline ? `<textarea class="en-answer" rows="2" lang="en" spellcheck="false" autocomplete="off" aria-label="Tu respuesta"></textarea>` : `<input class="en-answer" lang="en" spellcheck="false" autocomplete="off" aria-label="Tu respuesta">`}
      <div class="en-ex-actions"><button type="button" class="btn btn-mint btn-sm" data-submit>Comprobar</button></div>${feedback}`;
    const input = host.querySelector(".en-answer");
    const submit = () => {
      if (finished || !input.value.trim()) return;
      attempts++;
      const result = checkTypedAnswer(input.value, exercise.answers, { strict: exercise.strict });
      if (result.correct) { finish(true); return; }
      miss(result.nearMiss ? "Casi: revisa la ortografía." : exercise.hint);
    };
    host.querySelector("[data-submit]").addEventListener("click", submit);
    input.addEventListener("keydown", event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } });
    setTimeout(() => input.focus(), 50);
  }
  host.querySelector("[data-listen]")?.addEventListener("click", playVoice);
  if (exercise.type === "hear" || exercise.type === "dictation") playVoice();
}

/* ================================================================
   REPASO DIARIO
   ================================================================ */

function renderReview() {
  state.view = "review";
  state.clips.clear();
  stopAudio();
  const due = dueCards(state.cards, Date.now()).slice(0, 60);
  let index = 0, reviewed = 0;
  const draw = async () => {
    if (!state || state.view !== "review") return;
    if (index >= due.length) {
      env.root.innerHTML = `<div class="en-lesson-view"><section class="en-card en-review-done"><h3>🧠 Repaso terminado</h3><p>${reviewed} tarjetas repasadas. Las que recordaste vuelven dentro de unos días; las que olvidaste, mañana.</p><button type="button" class="btn btn-mint btn-sm" id="enBack">Volver a la ruta</button></section></div>`;
      $q("#enBack").addEventListener("click", renderHome);
      return;
    }
    const card = due[index];
    let bundle = null;
    if (card.audio && BY_ID.has(card.lessonId)) { try { bundle = await loadLesson(card.lessonId); } catch {} }
    if (!state || state.view !== "review") return;
    const audio = bundle && card.audio ? clipButton(bundle, card.audio.kind, card.audio.text, { big: true }) : "";
    env.root.innerHTML = `<div class="en-lesson-view"><div class="en-topbar"><button type="button" class="btn btn-ghost btn-sm" id="enBack">← Volver a la ruta</button><span class="en-muted">${index + 1}/${due.length}</span></div>
      <section class="en-card en-flash"><p class="section-label">${esc({ vocab: "Vocabulario", pitfall: "Error típico", mistake: "Tu cuaderno de errores" }[card.kind] || "Repaso")} · ${esc(card.lessonId.toUpperCase())}</p>
        ${audio}<p class="en-flash-front">${esc(card.front).replace(/\n/g, "<br>")}</p>
        <p class="en-muted">Dilo en voz alta antes de girar la tarjeta.</p>
        <button type="button" class="btn btn-mint btn-sm" id="enFlip">Mostrar respuesta</button>
        <div id="enBack2" hidden><p class="en-flash-back">${esc(card.back).replace(/\n/g, "<br>")}</p>
          <div class="en-grades"><button type="button" class="btn btn-bad btn-sm" data-grade="again">Otra vez</button><button type="button" class="btn btn-ghost btn-sm" data-grade="hard">Difícil</button><button type="button" class="btn btn-ghost btn-sm" data-grade="good">Bien</button><button type="button" class="btn btn-mint btn-sm" data-grade="easy">Fácil</button></div></div>
      </section></div>`;
    $q("#enBack").addEventListener("click", () => { flushSaves(); renderHome(); });
    $q("#enFlip").addEventListener("click", () => { $q("#enBack2").hidden = false; $q("#enFlip").hidden = true; });
    $all("[data-grade]").forEach(button => button.addEventListener("click", () => {
      const updated = reviewCard(card, SRS_GRADES[button.dataset.grade], Date.now());
      state.cards = state.cards.map(item => item.id === card.id ? updated : item);
      reviewed++;
      saveCards();
      if (button.dataset.grade === "again") due.push(updated);
      index++;
      draw();
    }));
  };
  draw();
}

/* ================================================================
   GUARDADO EN FIRESTORE
   El progreso va en users/{uid}/progress/ingles (lo lee también el panel del admin) y las
   tarjetas de repaso en users/{uid}/englishCards/{nivel}, un documento por nivel.
   ================================================================ */

export function createFirestoreStore({ db, uid, fs }) {
  const { doc, getDoc, setDoc, collection, getDocs, serverTimestamp } = fs;
  const levelOfCard = card => BY_ID.get(card.lessonId)?.level.id || "otros";
  return {
    async loadProgress() {
      const snap = await getDoc(doc(db, "users", uid, "progress", ENGLISH_SOURCE_ID));
      return snap.exists() ? snap.data() : {};
    },
    async saveProgress(progress) {
      const { updatedAt, ...rest } = progress || {};
      await setDoc(doc(db, "users", uid, "progress", ENGLISH_SOURCE_ID), { ...rest, updatedAt: serverTimestamp() }, { merge: true });
    },
    async loadCards() {
      const snaps = await getDocs(collection(db, "users", uid, "englishCards"));
      const cards = [];
      snaps.forEach(snap => cards.push(...Object.values(snap.data()?.cards || {})));
      return cards;
    },
    async saveCards(cards) {
      const byLevel = new Map();
      for (const card of cards) {
        const level = levelOfCard(card);
        if (!byLevel.has(level)) byLevel.set(level, {});
        byLevel.get(level)[card.id] = card;
      }
      await Promise.all([...byLevel].map(([level, map]) => setDoc(doc(db, "users", uid, "englishCards", level), { cards: map, updatedAt: serverTimestamp() })));
    },
  };
}
