import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import handler from "../api/english.js";
import { CONTENEDOR_AUDIO_INGLES, firmaDeContenedor } from "../api/_azure.js";
import {
  feedbackLanguage, normalizeRoleplayTurn, normalizeSpeakingFeedback, normalizeWritingFeedback,
  roleplayPrompt, speakingPrompt, writingPrompt,
} from "../api/_english.js";
import { ENGLISH_RULES, getEnglishCourse } from "../english-catalog.js";
import { normalizeEnglishLesson } from "../english-utils.js";
import { cardsFromLesson, dueCards, newCard, overdueCount, reviewCard, SRS_GRADES } from "../english-srs.js";
import { addImmersion, immersionStatus, LESSON_STATE, lessonStates, nextLessonId, recordMastery, touchStreak } from "../english-progress.js";

const DAY = 86400000;
const LESSONS = new URL("../english/lessons/", import.meta.url);
const pilot = () => normalizeEnglishLesson(JSON.parse(readFileSync(new URL("en-a1-01.json", LESSONS), "utf8")));

function responseMock() {
  return {
    statusCode: 200, body: null, headers: {},
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
  };
}

/* ---------- repaso espaciado ---------- */

test("una tarjeta recordada vuelve cada vez más tarde y una olvidada vuelve pronto", () => {
  const now = Date.UTC(2026, 9, 11, 12);
  let card = newCard({ id: "x", kind: "vocab", front: "hello", back: "hola", lessonId: "en-a1-01" }, now);
  assert.equal(card.due, now);
  card = reviewCard(card, SRS_GRADES.good, now);
  assert.equal(card.interval, 1);
  card = reviewCard(card, SRS_GRADES.good, card.due);
  assert.equal(card.interval, 6);
  const third = reviewCard(card, SRS_GRADES.good, card.due);
  assert.equal(third.interval, 15);
  assert.ok(reviewCard(card, SRS_GRADES.easy, card.due).interval > third.interval);
  assert.ok(reviewCard(card, SRS_GRADES.hard, card.due).interval < third.interval);

  const forgotten = reviewCard(third, SRS_GRADES.again, third.due);
  assert.equal(forgotten.reps, 0);
  assert.equal(forgotten.lapses, 1);
  assert.equal(forgotten.due - third.due, 10 * 60 * 1000);
  assert.ok(forgotten.ease >= 1.3 && forgotten.ease < third.ease);

  let worn = card;
  for (let index = 0; index < 20; index++) worn = reviewCard(worn, SRS_GRADES.again, now);
  assert.equal(worn.ease, 1.3, "la facilidad nunca baja de 1,3");
});

test("las vencidas se cuentan para decidir si se abren lecciones nuevas", () => {
  const now = Date.UTC(2026, 9, 11, 12);
  const cards = [
    { id: "a", due: now - 3 * DAY },
    { id: "b", due: now - 2 * 60 * 60 * 1000 },
    { id: "c", due: now + DAY },
  ];
  assert.equal(overdueCount(cards, now), 1);
  assert.deepEqual(dueCards(cards, now).map(card => card.id), ["a", "b"]);
});

test("una lección dominada deja su vocabulario, sus errores típicos y lo que se falló", () => {
  const lesson = pilot();
  const missed = [lesson.mastery[0], lesson.mastery[6]];
  const cards = cardsFromLesson(lesson, { missed, now: 1 });
  assert.equal(cards.filter(card => card.kind === "vocab").length, lesson.vocabulary.length);
  assert.equal(cards.filter(card => card.kind === "pitfall").length, lesson.grammar.pitfalls.length);
  assert.equal(cards.filter(card => card.kind === "mistake").length, 2);
  assert.equal(new Set(cards.map(card => card.id)).size, cards.length, "ids únicos");
  assert.ok(cards.every(card => !card.id.includes(".")), "sin puntos: son claves de Firestore");
  const dictation = cards.find(card => card.kind === "mistake" && card.audio);
  assert.equal(dictation.audio.kind, "dictation");
});

/* ---------- candados y avance ---------- */

test("las lecciones se abren en orden y el admin puede probar las bloqueadas", () => {
  const course = getEnglishCourse();
  const available = ["en-a1-01", "en-b2-13"];
  const student = lessonStates(course, {}, available, {});
  assert.equal(student.get("en-a1-01").state, LESSON_STATE.open);
  assert.equal(student.get("en-a1-02").state, LESSON_STATE.soon);
  assert.equal(student.get("en-b2-13").state, LESSON_STATE.locked);
  assert.equal(nextLessonId(course, student), "en-a1-01");

  const admin = lessonStates(course, {}, available, { isAdmin: true });
  assert.equal(admin.get("en-b2-13").state, LESSON_STATE.open);
  assert.equal(admin.get("en-b2-13").adminBypass, true);

  const done = lessonStates(course, { done: { "en-a1-01": true } }, available, {});
  assert.equal(done.get("en-a1-01").state, LESSON_STATE.done);

  const behind = lessonStates(course, {}, available, { overdue: ENGLISH_RULES.maxOverdueReviews + 1 });
  assert.equal(behind.get("en-a1-01").state, LESSON_STATE.locked);
  assert.match(behind.get("en-a1-01").reason, /repasos atrasados/);
});

test("el XP se gana una vez por lección y la racha cuenta días seguidos", () => {
  const monday = Date.UTC(2026, 9, 12, 15);
  let { progress, firstTime } = recordMastery({}, "en-a1-01", 85, monday);
  assert.equal(firstTime, true);
  assert.equal(progress.xp, 85);
  assert.equal(progress.streak, 1);
  ({ progress, firstTime } = recordMastery(progress, "en-a1-01", 95, monday));
  assert.equal(firstTime, false);
  assert.equal(progress.xp, 85, "repetir no suma XP");
  assert.equal(progress.scores["en-a1-01"], 95, "se guarda la mejor nota");
  assert.equal(touchStreak(progress, monday + DAY).streak, 2);
  assert.equal(touchStreak(progress, monday + 3 * DAY).streak, 1);
  assert.equal(progress.done["en-a1-01"], true);
});

test("la inmersión se anota por nivel y se compara con las horas del examen", () => {
  const course = getEnglishCourse();
  let progress = addImmersion({}, "a1", 45);
  progress = addImmersion(progress, "a1", 10000);
  assert.equal(progress.immersion.a1, 645, "una anotación no puede pasar de 10 horas");
  const a1 = immersionStatus(course, progress).find(item => item.level === "a1");
  assert.equal(a1.required, 600);
  assert.equal(a1.ready, true);
});

/* ---------- servidor ---------- */

test("la firma de los audios es de solo lectura, sobre el contenedor y con el formato de Azure", () => {
  const clave = Buffer.from("clave-de-prueba").toString("base64");
  const ahora = new Date("2026-10-11T12:00:00Z");
  const { base, sas, expira } = firmaDeContenedor({ cuenta: "cuentademo", clave, contenedor: CONTENEDOR_AUDIO_INGLES, minutos: 120, ahora });
  assert.equal(base, "https://cuentademo.blob.core.windows.net/ingles-audio");
  const params = new URLSearchParams(sas);
  assert.equal(params.get("sp"), "r");
  assert.equal(params.get("sr"), "c");
  assert.equal(params.get("spr"), "https");
  assert.equal(expira, "2026-10-11T14:00:00.000Z");
  const esperado = crypto.createHmac("sha256", Buffer.from(clave, "base64")).update([
    "r", "2026-10-11T11:55:00Z", "2026-10-11T14:00:00Z", "/blob/cuentademo/ingles-audio",
    "", "", "https", "2022-11-02", "c", "", "", "", "", "", "", "",
  ].join("\n"), "utf8").digest("base64");
  assert.equal(params.get("sig"), esperado);
});

test("el servidor del inglés no atiende a nadie sin sesión", async () => {
  for (const req of [
    { method: "GET", headers: {}, query: { task: "config" } },
    { method: "GET", headers: {}, query: { task: "speech-token" } },
    { method: "POST", headers: {}, body: { task: "write", text: "hello" } },
  ]) {
    const res = responseMock();
    await handler(req, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.headers["cache-control"], "private, no-store");
  }
  const res = responseMock();
  await handler({ method: "DELETE", headers: {} }, res);
  assert.equal(res.statusCode, 405);
});

test("las instrucciones para la IA llevan la tarea, el nivel y el idioma de la devolución", () => {
  const writing = writingPrompt({ task: "write", instructions: "Write a message to your class.", level: "a1", minWords: 25, maxWords: 50, checklist: ["Usa I'm"], text: "Hi! I'm Laura." });
  assert.match(writing.user, /Write a message to your class/);
  assert.doesNotMatch(writing.user, /Task: write/);
  assert.match(writing.system, /Spanish/);
  assert.match(writing.user, /25–50 words/);
  assert.equal(feedbackLanguage("b2"), "English");
  assert.match(writingPrompt({ instructions: "x", level: "c1", text: "y" }).system, /in English\./);

  const speaking = speakingPrompt({ instructions: "Talk about a decision.", level: "b2", transcripts: [{ seconds: 90, text: "If I had known…" }], pronunciation: { accuracy: 82, fluency: 70, prosody: 65, weakWords: ["known"] } });
  assert.match(speaking.user, /Round 1 \(90 s\)/);
  assert.match(speaking.user, /accuracy 82/);
  assert.match(speaking.user, /known/);
});

test("el juego de roles empieza con la alumna y termina con su mensaje", () => {
  const base = { level: "a1", character: "Emma", scenario: "Reception desk", goals: ["Say hello", "Spell your name"], opening: "Good morning! Are you a new student?" };
  const prompt = roleplayPrompt({ ...base, history: [{ role: "assistant", content: "Good morning!" }, { role: "user", content: "Hello, I'm Ana." }] });
  assert.equal(prompt.messages[0].role, "user");
  assert.match(prompt.messages[0].content, /The scene started with you saying/);
  assert.match(prompt.system, /You are Emma/);
  assert.match(prompt.system, /recepcionista/);
  assert.match(prompt.system, /very short, simple sentences/);
  assert.equal(roleplayPrompt({ ...base, history: [{ role: "user", content: "Hi" }, { role: "assistant", content: "Hello!" }] }), null);
  assert.equal(roleplayPrompt({ ...base, history: [] }), null);
});

test("lo que devuelve la IA se ordena antes de mostrarse", () => {
  const writing = normalizeWritingFeedback({
    scores: { content: 9, communicative: -2, organisation: "3", language: 2.6 },
    corrections: [{ original: "Am Laura", corrected: "I'm Laura", why: "sujeto" }, { original: "ok", corrected: "ok", why: "nada" }, { original: "", corrected: "x" }],
    checklist: [{ item: "Usa I'm", met: true }, { item: "Despedida", met: "yes" }],
  });
  assert.deepEqual(writing.scores, { content: 5, communicative: 0, organisation: 3, language: 3 });
  assert.equal(writing.corrections.length, 1);
  assert.deepEqual(writing.checklist.map(item => item.met), [true, false]);

  const speaking = normalizeSpeakingFeedback({});
  assert.deepEqual(speaking.scores, { task: 0, range: 0, accuracy: 0, fluency: 0 });
  assert.deepEqual(speaking.corrections, []);

  const turn = normalizeRoleplayTurn({ reply: "Nice to meet you!", goalsMet: [0, 1, 7, -1, "1"], correction: { said: "I have 27 years", better: "I'm 27", why: "edad con be" }, finished: "true" }, 2);
  assert.deepEqual(turn.goalsMet, [0, 1]);
  assert.equal(turn.correction.better, "I'm 27");
  assert.equal(turn.finished, false);
  assert.equal(normalizeRoleplayTurn({}, 0).reply, "Sorry, could you say that again?");
});

test("el índice de lecciones publicadas coincide con los archivos escritos", () => {
  const index = JSON.parse(readFileSync(new URL("index.json", LESSONS), "utf8"));
  const files = readdirSync(LESSONS).filter(name => /^en-[a-c][12]-\d{2}\.json$/.test(name)).map(name => name.replace(/\.json$/, "")).sort();
  assert.deepEqual([...index.lessons].sort(), files);
});
