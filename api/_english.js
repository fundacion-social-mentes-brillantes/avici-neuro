// Instrucciones y normalización de la IA del curso de inglés (corregir lo que se escribe y
// lo que se dice, y conversar en juegos de roles). Sin red: todo lo de acá se puede probar.
//
// La forma de corregir sigue el método del curso (english/METODO.md): primero lo que salió
// bien, después cada error con la versión correcta y el porqué, y siempre un siguiente
// paso concreto. Hasta B1 la devolución va en español; desde B2, en inglés.
//
// Ojo con los nombres: `task` es lo que se pide al servidor ("write", "speak",
// "roleplay"); el enunciado de la tarea viaja en `instructions`.

import { ENGLISH_CAST } from "../english-catalog.js";

export const LEVELS = ["a1", "a2", "b1", "b2", "c1"];
const MAX_TEXT = 4000;
const MAX_TURNS = 24;
const MAX_TURN_CHARS = 700;

const LEVEL_VOICE = {
  a1: "Use very short, simple sentences in the present tense and the 500 most common English words. One idea per sentence.",
  a2: "Use short, clear sentences with common words. Past simple, present perfect for experiences, and simple futures are fine.",
  b1: "Use natural everyday English at a moderate pace, with common phrasal verbs and connectors. Avoid rare idioms.",
  b2: "Speak naturally, like a friendly native speaker in a relaxed conversation, including common idioms and discourse markers.",
  c1: "Speak as you would with an educated native speaker: idiomatic, nuanced, with humour and irony where it fits.",
};

export function clean(value, max = MAX_TEXT) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function levelOf(value) {
  const level = String(value || "").toLowerCase();
  return LEVELS.includes(level) ? level : "a1";
}

/* Hasta B1 la devolución es en español (todavía se está construyendo la base); desde B2
   todo es en inglés, como el resto del curso. */
export function feedbackLanguage(level) {
  return ["b2", "c1"].includes(levelOf(level)) ? "English" : "Spanish (neutral Latin American, using «tú»)";
}

function list(items, max = 8, chars = 300) {
  return (Array.isArray(items) ? items : []).map(item => clean(String(item ?? ""), chars)).filter(Boolean).slice(0, max);
}

const CORRECTION_RULES = (level) => `How to give feedback:
- Write all feedback in ${feedbackLanguage(level)}. Quotes of the learner's English stay in English.
- Start with what the learner did well (specific, not generic praise).
- Then list the real errors, the most important first. For each one: the exact original fragment, the corrected version and a short reason a learner at CEFR ${levelOf(level).toUpperCase()} can understand. Point out typical Spanish-speaker interference when that is the cause.
- Do not invent errors. If something is correct but could sound more natural, you may include it, but say so.
- Be demanding but kind: this is an exigent course whose goal is real CEFR ${levelOf(level).toUpperCase()} performance.
- End with one concrete next step.`;

const SCORE_RULES = `Scores go from 0 to 5, following the Cambridge English assessment scales for the learner's target level: 5 = clearly above the level, 3 = meets the level, 1 = far below it, 0 = no relevant response.`;

/* ---------- Escribir ---------- */

export function writingPrompt(body) {
  const level = levelOf(body.level);
  const text = clean(body.text);
  const system = `You are an experienced Cambridge English examiner and a warm, demanding writing coach for adult Spanish speakers learning English.
${SCORE_RULES}
Criteria: content (the task is fully covered), communicative (register, purpose and reader are right), organisation (structure, paragraphs, linking), language (accuracy and range of grammar and vocabulary).
${CORRECTION_RULES(level)}
Reply only with a JSON object with this exact shape:
{"scores":{"content":0,"communicative":0,"organisation":0,"language":0},"overall":"","strengths":[""],"corrections":[{"original":"","corrected":"","why":""}],"checklist":[{"item":"","met":true}],"nextStep":""}`;
  const user = `Level: CEFR ${level.toUpperCase()}
Task: ${clean(body.instructions, 1500)}
Required length: ${Number(body.minWords) || 0}–${Number(body.maxWords) || 0} words.
Checklist the learner was given:
${list(body.checklist, 8).map(item => `- ${item}`).join("\n") || "- (none)"}

Learner's text:
"""
${text}
"""`;
  return { system, user };
}

/* ---------- Hablar ---------- */

export function speakingPrompt(body) {
  const level = levelOf(body.level);
  const rounds = (Array.isArray(body.transcripts) ? body.transcripts : [])
    .map((round, index) => `Round ${index + 1} (${Number(round?.seconds) || 0} s): ${clean(round?.text, 2500) || "(no speech detected)"}`)
    .join("\n");
  const pronunciation = body.pronunciation && typeof body.pronunciation === "object"
    ? `Automatic pronunciation scores (0–100, Azure): accuracy ${Number(body.pronunciation.accuracy) || 0}, fluency ${Number(body.pronunciation.fluency) || 0}, prosody ${Number(body.pronunciation.prosody) || 0}. Words with low accuracy: ${list(body.pronunciation.weakWords, 12, 40).join(", ") || "none"}.`
    : "No automatic pronunciation scores are available.";
  const system = `You are an experienced Cambridge English speaking examiner and a warm, demanding speaking coach for adult Spanish speakers.
The learner told the same story several times with less time in each round (the 4/3/2 fluency technique). The transcripts come from speech recognition, so ignore obvious recognition glitches and never correct punctuation or capitalisation.
${SCORE_RULES}
Criteria: task (the prompts were answered), range (variety of grammar and vocabulary, including the target language), accuracy (grammar and word choice), fluency (amount of speech, hesitation, improvement across rounds).
${CORRECTION_RULES(level)}
Reply only with a JSON object with this exact shape:
{"scores":{"task":0,"range":0,"accuracy":0,"fluency":0},"overall":"","strengths":[""],"corrections":[{"original":"","corrected":"","why":""}],"targetUsed":[""],"nextStep":""}`;
  const user = `Level: CEFR ${level.toUpperCase()}
Speaking task: ${clean(body.instructions, 1500)}
Target language the learner should use:
${list(body.targetLanguage, 8).map(item => `- ${item}`).join("\n") || "- (none)"}
${pronunciation}

Transcripts:
${rounds || "(nothing)"}`;
  return { system, user };
}

/* ---------- Juego de roles ---------- */

export function roleplayPrompt(body) {
  const level = levelOf(body.level);
  const character = clean(body.character, 60) || "Matilda";
  const member = ENGLISH_CAST[character];
  const goals = list(body.goals, 6);
  const system = `You are ${character}, a character in "Bright Start", an English course for Spanish speakers${member ? ` (${member.role})` : ""}. Stay in character for the whole conversation and keep the scene alive with personality and a little humour.
Scene: ${clean(body.scenario, 1200)}
${LEVEL_VOICE[level]}
Keep each reply to one to three sentences and usually end with a question or a prompt that helps the learner speak more. Never switch to Spanish inside the scene.
The learner has these goals:
${goals.map((goal, index) => `${index}. ${goal}`).join("\n") || "0. Have a natural conversation."}
After each learner message, also act as their coach behind the scenes:
- "goalsMet": indices of the goals the learner has achieved so far in the whole conversation.
- "correction": if the learner's last message has one clear error that matters at CEFR ${level.toUpperCase()}, give it as {"said":"...","better":"...","why":"..."} with "why" in ${feedbackLanguage(level)}; otherwise null. Do not correct inside the scene: in the scene, simply react naturally (you may repeat the correct form naturally, as a native speaker would).
- "finished": true only when every goal is met or the scene has clearly ended.
Reply only with a JSON object: {"reply":"","goalsMet":[0],"correction":null,"finished":false}`;
  const history = (Array.isArray(body.history) ? body.history : [])
    .filter(turn => turn && (turn.role === "user" || turn.role === "assistant"))
    .slice(-MAX_TURNS)
    .map(turn => ({ role: turn.role, content: clean(turn.content, MAX_TURN_CHARS) }))
    .filter(turn => turn.content);
  /* La conversación tiene que empezar con un turno de la alumna: la primera frase del
     personaje (ya escrita en la lección) entra como contexto, no como turno propio. */
  const opening = clean(body.opening, 400);
  while (history.length && history[0].role !== "user") history.shift();
  if (!history.length || history.at(-1).role !== "user") return null;
  const intro = opening ? `(The scene started with you saying: "${opening}")\n\n` : "";
  history[0] = { role: "user", content: `${intro}${history[0].content}` };
  return { system, messages: history };
}

/* ---------- Normalización: lo que vuelve de la IA, sea cual sea el modelo ---------- */

function score(value) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.min(5, Math.max(0, number)) : 0;
}

function corrections(items) {
  return (Array.isArray(items) ? items : [])
    .map(item => ({ original: clean(item?.original, 400), corrected: clean(item?.corrected, 400), why: clean(item?.why, 500) }))
    .filter(item => item.original && item.corrected && item.original !== item.corrected)
    .slice(0, 10);
}

export function normalizeWritingFeedback(raw) {
  const scores = raw?.scores || {};
  return {
    scores: { content: score(scores.content), communicative: score(scores.communicative), organisation: score(scores.organisation), language: score(scores.language) },
    overall: clean(raw?.overall, 800),
    strengths: list(raw?.strengths, 4, 400),
    corrections: corrections(raw?.corrections),
    checklist: (Array.isArray(raw?.checklist) ? raw.checklist : [])
      .map(item => ({ item: clean(item?.item, 300), met: item?.met === true }))
      .filter(item => item.item)
      .slice(0, 8),
    nextStep: clean(raw?.nextStep, 500),
  };
}

export function normalizeSpeakingFeedback(raw) {
  const scores = raw?.scores || {};
  return {
    scores: { task: score(scores.task), range: score(scores.range), accuracy: score(scores.accuracy), fluency: score(scores.fluency) },
    overall: clean(raw?.overall, 800),
    strengths: list(raw?.strengths, 4, 400),
    corrections: corrections(raw?.corrections),
    targetUsed: list(raw?.targetUsed, 8, 200),
    nextStep: clean(raw?.nextStep, 500),
  };
}

export function normalizeRoleplayTurn(raw, goalCount = 0) {
  const correction = raw?.correction && typeof raw.correction === "object"
    ? { said: clean(raw.correction.said, 300), better: clean(raw.correction.better, 300), why: clean(raw.correction.why, 400) }
    : null;
  return {
    reply: clean(raw?.reply, 800) || "Sorry, could you say that again?",
    goalsMet: [...new Set((Array.isArray(raw?.goalsMet) ? raw.goalsMet : []).map(Number).filter(index => Number.isInteger(index) && index >= 0 && index < goalCount))],
    correction: correction && correction.said && correction.better && correction.said !== correction.better ? correction : null,
    finished: raw?.finished === true,
  };
}
