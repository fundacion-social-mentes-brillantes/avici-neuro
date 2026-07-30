export const LESSON_ENGINE_VERSION = "lesson-2026.07-v5";
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

const TEMPORAL_LANGUAGE = /\b(actual(?:es|mente)?|vigente(?:s)?|hoy)\b/iu;
const SAFE_TEMPORAL_FRAME = /\b(verific\w*|comprob\w*|consult\w*|contrast\w*|compar\w*|disting\w*|separ\w*|fuente(?:s)? oficial(?:es)?|calendario nacional|lineamiento(?:s)?|protocolo del servicio|puede(?:n)? haber cambiado|no (?:es|est[aá]|debe|puede|se debe))\b/iu;
const HISTORICAL_FRAME = /\b(esta edición|edición de 2013|archivo (?:clínico|histórico)|documento histórico|el (?:libro|manual)(?: de 2013)? (?:describe|indica|presenta|señala)|según (?:esta edición|el manual|el libro))\b/iu;
const VERIFY_BEFORE_ACTION = /\b(verific\w*|comprob\w*|consult\w*|confirm\w*|fuente(?:s)? oficial(?:es)?|calendario nacional|lineamiento(?:s)?|antes de actuar|no (?:aplicar|administrar|indicar|usar|asumir|ejecutar))\b/iu;
const CLINICAL_ACTION = /\b(debe(?:n)?|hay que|corresponde|se (?:debe|recomienda|indica|administra|aplica|conserva|almacena|descarta|notifica)|administrar|aplicar|indicar|vacunar|conservar|almacenar|descartar|notificar)\b/iu;
const OPERATIONAL_DETAIL = /\b(dosis|intervalo|esquema|vía|sitio|indicación|contraindicación|producto|temperatura|cadena de frío|frasco|esavi|anafilaxia|contacto|dirección|horario|norma|protocolo|niñ[oa]|embarazad[ao]|adult[oa]|paciente|persona)\b/iu;
const CLINICAL_VALUE = /\b\d+(?:[.,]\d+)?\s*(?:ml|µg|mcg|mg|°\s*c|grados|horas?|días?|semanas?|meses?|años?)\b/iu;

function historicalBlocks({ content, learningObjectives, keyTerms, quiz, flashcards, challenge }) {
  const contentBlocks = content.split(/\n+/).map(text => text.trim()).filter(Boolean);
  return [
    ...contentBlocks.map((text, index) => ({ label: `explicación ${index + 1}`, text })),
    ...learningObjectives.map((text, index) => ({ label: `objetivo ${index + 1}`, text })),
    ...keyTerms.map((term, index) => ({ label: `concepto ${index + 1}`, text: `${term.term}: ${term.def}` })),
    ...quiz.map((question, index) => ({ label: `pregunta ${index + 1}`, text: [question.q, ...question.options, question.explain].join(" ") })),
    ...flashcards.map((card, index) => ({ label: `flashcard ${index + 1}`, text: `${card.front} ${card.back}` })),
    { label: "desafío", text: [challenge.scenario, challenge.q, ...challenge.options, challenge.explain].join(" ") },
  ];
}

function historicalClinicalIssues(material) {
  const issues = [];
  for (const block of historicalBlocks(material)) {
    if (TEMPORAL_LANGUAGE.test(block.text) && !SAFE_TEMPORAL_FRAME.test(block.text)) {
      issues.push(`${block.label} usa lenguaje de vigencia sin indicar contraste o verificación`);
    }
    const actionable = (CLINICAL_ACTION.test(block.text) && OPERATIONAL_DETAIL.test(block.text))
      || CLINICAL_VALUE.test(block.text);
    if (actionable && !HISTORICAL_FRAME.test(block.text) && !VERIFY_BEFORE_ACTION.test(block.text)) {
      issues.push(`${block.label} presenta una conducta o dato operativo sin atribuirlo a la edición ni exigir verificación`);
    }
  }
  return issues;
}

export function normalizeLessonData(raw, { allowedPages = [], timeSensitive = false, historicalClinical = false } = {}) {
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

  const instructionalCorpus = [
    content,
    ...learningObjectives,
    ...keyTerms.flatMap(term => [term.term, term.def]),
    ...quiz.flatMap(question => [question.q, ...question.options, question.explain]),
    ...flashcards.flatMap(card => [card.front, card.back]),
    challenge.scenario,
    challenge.q,
    ...challenge.options,
    challenge.explain,
  ].join("\n");
  if (timeSensitive && !historicalClinical && /\b(hoy|actualmente)\b/iu.test(instructionalCorpus)) {
    issues.push("el material presenta un dato de esta edición como si fuera actual");
  }
  if (historicalClinical) {
    if (!/\b(esta edición|edición de 2013|el (?:libro|manual) (?:describe|indica|presenta|señala)|según (?:esta edición|el manual|el libro))\b/iu.test(content)) {
      issues.push("el archivo clínico no identifica de forma explícita que explica una edición histórica");
    }
    issues.push(...historicalClinicalIssues({ content, learningObjectives, keyTerms, quiz, flashcards, challenge }));
  }

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
