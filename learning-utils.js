export const LESSON_ENGINE_VERSION = "lesson-2026.07-v3";
export const MASTERY_SCORE = 80;

export class LessonValidationError extends Error {
  constructor(issues) {
    super(`Lección incompleta o no verificable: ${issues.join("; ")}`);
    this.name = "LessonValidationError";
    this.issues = issues;
  }
}

function cleanText(value, max = 12000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function citedPages(text) {
  return [...cleanText(text).matchAll(/p[aá]g(?:ina)?s?\.?\s*(\d{1,4})/gi)].map(match => Number(match[1]));
}

function citationIssues(text, allowedPages, label, { required = true } = {}) {
  const pages = citedPages(text);
  const issues = [];
  if (required && !pages.length) issues.push(`${label} no cita una página`);
  const allowed = new Set((allowedPages || []).map(Number).filter(Number.isInteger));
  if (allowed.size) {
    const invalid = pages.filter(page => !allowed.has(page));
    if (invalid.length) issues.push(`${label} cita páginas no recuperadas (${[...new Set(invalid)].join(", ")})`);
  }
  return issues;
}

function uniqueBy(items, key) {
  const seen = new Set();
  return items.filter(item => {
    const value = cleanText(item?.[key], 500).toLocaleLowerCase("es");
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function normalizeQuestion(raw, index, allowedPages, issues, label = "Pregunta") {
  const q = cleanText(raw?.q, 700);
  const options = Array.isArray(raw?.options) ? raw.options.map(option => cleanText(option, 500)) : [];
  const answer = Number(raw?.answer);
  const explain = cleanText(raw?.explain, 1200);
  const level = ["recuerdo", "comprension", "aplicacion"].includes(raw?.level) ? raw.level : "comprension";
  const prefix = `${label} ${index + 1}`;

  if (q.length < 12) issues.push(`${prefix} no tiene un enunciado suficiente`);
  if (options.length !== 4 || options.some(option => !option)) issues.push(`${prefix} debe tener cuatro opciones completas`);
  if (new Set(options.map(option => option.toLocaleLowerCase("es"))).size !== 4) issues.push(`${prefix} repite opciones`);
  if (!Number.isInteger(answer) || answer < 0 || answer > 3) issues.push(`${prefix} no tiene una respuesta válida`);
  if (explain.length < 20) issues.push(`${prefix} no explica la respuesta`);
  issues.push(...citationIssues(explain, allowedPages, prefix));
  return { q, options, answer, explain, level };
}

export function normalizeLessonData(raw, { allowedPages = [] } = {}) {
  const issues = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new LessonValidationError(["la respuesta no es un objeto JSON"]);

  const content = cleanText(raw.content);
  if (content.length < 600) issues.push("la explicación es demasiado corta");
  issues.push(...citationIssues(content, allowedPages, "La explicación"));

  const learningObjectives = uniqueBy(
    (Array.isArray(raw.learningObjectives) ? raw.learningObjectives : []).map(objective => ({ value: cleanText(objective, 350) })),
    "value",
  ).map(item => item.value).slice(0, 4);
  if (learningObjectives.length < 3) issues.push("faltan tres objetivos observables");

  const keyTerms = uniqueBy(
    (Array.isArray(raw.keyTerms) ? raw.keyTerms : [])
      .map(term => ({ term: cleanText(term?.term, 200), def: cleanText(term?.def, 700) }))
      .filter(term => term.term && term.def),
    "term",
  ).slice(0, 10);
  if (keyTerms.length < 6) issues.push("faltan al menos seis conceptos clave únicos");

  const rawQuiz = Array.isArray(raw.quiz) ? raw.quiz : [];
  const quiz = rawQuiz.slice(0, 8).map((question, index) => normalizeQuestion(question, index, allowedPages, issues));
  if (quiz.length < 6) issues.push("el quiz necesita al menos seis preguntas");
  const levels = new Set(quiz.map(question => question.level));
  if (!levels.has("aplicacion")) issues.push("el quiz no incluye una pregunta de aplicación");
  if (!levels.has("recuerdo")) issues.push("el quiz no incluye una pregunta de recuerdo");

  const flashcards = uniqueBy(
    (Array.isArray(raw.flashcards) ? raw.flashcards : [])
      .map(card => ({ front: cleanText(card?.front, 500), back: cleanText(card?.back, 900) }))
      .filter(card => card.front && card.back),
    "front",
  ).slice(0, 12);
  if (flashcards.length < 8) issues.push("faltan al menos ocho flashcards únicas");

  const challengeIssues = [];
  const challengeQuestion = normalizeQuestion(raw.challenge || {}, 0, allowedPages, challengeIssues, "Desafío");
  const challenge = {
    scenario: cleanText(raw.challenge?.scenario, 1600),
    ...challengeQuestion,
  };
  if (challenge.scenario.length < 80) challengeIssues.push("el desafío necesita un caso contextualizado");
  issues.push(...challengeIssues);

  if (issues.length) throw new LessonValidationError([...new Set(issues)]);
  return { content, learningObjectives, keyTerms, quiz, flashcards, challenge };
}

export function lessonCacheIsCurrent(cached, sourceVersion) {
  if (!cached || cached.lessonVersion !== LESSON_ENGINE_VERSION) return false;
  return !sourceVersion || cached.sourceVersion === sourceVersion;
}

export function shuffleCards(cards, random = Math.random) {
  const copy = [...(cards || [])];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}
