// ===== Contrato y verificación de las lecciones de inglés =====
//
// Las lecciones de los libros se generan con IA y se auditan contra las páginas. Las de
// inglés se escriben de antemano, una por una, y este archivo es su revisor: ninguna
// entra a la ruta si le falta una parte, si sus ejercicios son casi todos de adivinar,
// si una clave de respuesta no cuadra con el enunciado o si el texto no respeta el
// tamaño y el idioma de su nivel. En un curso de idiomas una clave mal puesta enseña el
// error, así que lo que se puede comprobar con código se comprueba siempre.
//
// Cada exigencia de abajo sale del método del curso (english/METODO.md), que reúne la
// evidencia sobre cómo aprende mejor inglés un hispanohablante.

import { ENGLISH_CAST, ENGLISH_RULES, englishInventoryLabel, getEnglishCourse } from "./english-catalog.js";

export const ENGLISH_LESSON_VERSION = "english-lesson-2026.10-v2";

export class EnglishLessonError extends Error {
  constructor(issues) {
    super(`Lección de inglés incompleta o incorrecta: ${issues.join("; ")}`);
    this.name = "EnglishLessonError";
    this.issues = issues;
  }
}

/* Cuánto exige cada nivel. Los rangos de palabras de escucha, lectura y escritura viven
   en el catálogo, junto al resto de la definición del nivel. */
const LEVEL_SPEC = {
  a1: { vocab: [12, 24], practice: 14, mastery: 10, examples: 5, explanation: 500, dictation: 3, rounds: 2, mission: 10 },
  a2: { vocab: [12, 24], practice: 14, mastery: 10, examples: 5, explanation: 550, dictation: 3, rounds: 2, mission: 15 },
  b1: { vocab: [14, 26], practice: 16, mastery: 12, examples: 6, explanation: 700, dictation: 3, rounds: 3, mission: 20 },
  b2: { vocab: [14, 28], practice: 16, mastery: 12, examples: 6, explanation: 800, dictation: 2, rounds: 3, mission: 25 },
  c1: { vocab: [14, 30], practice: 18, mastery: 12, examples: 6, explanation: 900, dictation: 2, rounds: 3, mission: 30 },
};

export const TYPED_TYPES = ["gap", "transform", "order", "translate", "correct", "dictation", "wordform"];
export const EXERCISE_TYPES = ["choice", "match", "hear", ...TYPED_TYPES];
const MIN_TYPED_SHARE = { practice: 0.6, mastery: 0.5 };
const MIN_EXERCISES_PER_GRAMMAR_POINT = 3;
const MIN_REVIEW_EXERCISES = 3;           // repaso intercalado de lecciones anteriores
const MIN_DISCRIMINATION = 4;             // entrenamiento del oído (identificación)
const MIN_DISCRIMINATION_VOICES = 3;      // alta variabilidad: varias voces distintas
export const SPEAKING_CRITERIA = ["task", "range", "accuracy", "fluency", "pronunciation"];
export const WRITING_CRITERIA = ["content", "communicative", "organisation", "language"];
export const MISSION_KINDS = ["watch", "listen", "read", "talk"];

/* El modelo de pronunciación del curso es el inglés estadounidense (el AFI de las
   lecciones sigue al Cambridge Dictionary en su versión US) y la voz que guía todo el
   curso es Matilda. Los demás acentos aparecen en las escuchas a medida que sube el nivel. */
export const NARRATOR_VOICE = ENGLISH_CAST.Matilda.voice;
export const VOICE_KEYS = [
  "us-f1", "us-f2", "us-f3", "us-f4", "us-m1", "us-m2", "us-m3", "us-m4", "us-m5",
  "uk-f1", "uk-f2", "uk-m1", "uk-m2", "au-f1", "au-m1",
];

/* ---------- Texto y respuestas ---------- */

function cleanText(value, max = 20000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function countWords(text) {
  return (String(text || "").match(/[A-Za-zÀ-ÿ0-9]+(?:['’-][A-Za-zÀ-ÿ0-9]+)*/g) || []).length;
}

const SPANISH_MARKERS = /(?<![\p{L}'’])(que|el|la|los|las|un|una|unos|de|en|y|lo|mi|tu|su|para|con|por|como|pero|es|son|está|están|esto|esta|cuando|también|porque|se|del|al|muy|más|qué|cómo|dónde|tú|usted|ejemplo|frase|verbo|significa|decir)(?![\p{L}'’])/giu;

/* Proporción de palabras típicas del español. Una explicación en español que cita
   ejemplos en inglés sigue muy por encima de 0,08; un texto en inglés queda casi en 0. */
export function spanishRatio(text) {
  const words = countWords(text);
  if (!words) return 0;
  return (String(text).match(SPANISH_MARKERS) || []).length / words;
}

function looksSpanish(text) { return spanishRatio(text) >= 0.08; }
function looksEnglish(text) { return spanishRatio(text) < 0.03; }

/* Las etiquetas de emoción ([laughs], [excited]…) solo las lee la voz de eleven_v3: la
   pantalla muestra el texto limpio. Lo que se ve y lo que se oye tienen que coincidir. */
const EMOTION_TAG = /\[[a-z][a-z ,'-]{1,40}\]/gi;
export function stripEmotionTags(text) {
  return String(text || "").replace(EMOTION_TAG, " ").replace(/\s+/g, " ").trim();
}

/* El modelo del curso es el inglés estadounidense, pero escribir "colour" o "cancelled"
   no es un error: es la ortografía británica. Ambas se llevan a la misma forma antes de
   comparar, para que la corrección mida inglés y no la elección de ortografía. */
const UK_TO_US_SPELLING = [
  [/\b(cancel|travel|label|model|level|fuel|total|signal|equal|counsel|marvel|jewel|dial|duel|quarrel|tunnel|channel|panel)l(ed|ing|er|ers)\b/g, "$1$2"],
  [/\b(col|fav|flav|hon|hum|lab|neighb|behavi|harb|rum|endeav|arm|vap|sav)our(s|ed|ing|ite|ites|able|ful|hood|hoods)?\b/g, "$1or$2"],
  [/\b(cent|theat|met|lit|fib|somb|spect|calib|lust|meag)re(s)?\b/g, "$1er$2"],
  [/\b(real|organ|recogn|apolog|critic|emphas|memor|summar|special|prior|categor|character|minim|maxim|optim|util|visual|familiar|modern|global|sympath|author|civil|harmon|legal|mobil|normal|stabil|standard|symbol|theor|vocal)is(e|ed|es|er|ers|ing|ation|ations)\b/g, "$1iz$2"],
  [/\b(anal|paral|catal)ys(e|ed|es|ing)\b/g, "$1yz$2"],
  [/\bpractis(e|ed|es|ing)\b/g, "practic$1"],
  [/\bprogramme(s)?\b/g, "program$1"],
  [/\bgrey\b/g, "gray"], [/\bdefence\b/g, "defense"], [/\boffence\b/g, "offense"], [/\blicence\b/g, "license"],
  [/\bjewellery\b/g, "jewelry"], [/\benrol(s|ment)?\b/g, "enroll$1"], [/\bfulfil(s|ment)?\b/g, "fulfill$1"],
  [/\bskilful\b/g, "skillful"], [/\bpyjamas\b/g, "pajamas"], [/\btyre(s)?\b/g, "tire$1"], [/\bmould\b/g, "mold"], [/\bplough\b/g, "plow"],
];

export function normalizeAnswer(text) {
  let normalized = String(text || "")
    .normalize("NFKC")
    .replace(/[‘’ʼ`´]/g, "'")
    .toLowerCase()
    .replace(/[“”".!?¡¿,;:()]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const [pattern, replacement] of UK_TO_US_SPELLING) normalized = normalized.replace(pattern, replacement);
  return normalized;
}

/* Una contracción ambigua ('s, 'd) puede significar dos cosas: se prueban ambas en vez
   de adivinar, para no marcar mal a quien escribe "she has got" frente a "she's got". */
const CONTRACTIONS = [
  [/\bcan't\b/g, ["cannot"]], [/\bwon't\b/g, ["will not"]], [/\bshan't\b/g, ["shall not"]],
  [/\bain't\b/g, ["is not"]], [/\blet's\b/g, ["let us"]],
  [/\b(?!(?:ca|wo|sha)n't\b)(\w+)n't\b/g, ["$1 not"]],
  [/\b(\w+)'m\b/g, ["$1 am"]], [/\b(\w+)'re\b/g, ["$1 are"]], [/\b(\w+)'ve\b/g, ["$1 have"]],
  [/\b(\w+)'ll\b/g, ["$1 will"]], [/\b(\w+)'d\b/g, ["$1 would", "$1 had"]],
  [/\b(he|she|it|that|there|what|where|who|how|here)'s\b/g, ["$1 is", "$1 has"]],
];
const MAX_VARIANTS = 64;
const MAX_AMBIGUOUS_PER_PATTERN = 4;

/* Cada aparición se resuelve por separado: en "If I'd known, I'd have called" el primer
   'd es had y el segundo would, así que hace falta la combinación mixta. */
function expandOccurrences(variant, pattern, replacements) {
  const matches = [...variant.matchAll(pattern)];
  if (!matches.length) return [];
  const free = Math.min(matches.length, MAX_AMBIGUOUS_PER_PATTERN);
  const total = replacements.length ** free;
  const results = [];
  for (let combo = 0; combo < total; combo++) {
    let output = "";
    let last = 0;
    let code = combo;
    matches.forEach((match, index) => {
      let choice = 0;
      if (index < free) {
        choice = code % replacements.length;
        code = Math.floor(code / replacements.length);
      }
      output += variant.slice(last, match.index) + replacements[choice].replace("$1", match[1] ?? "");
      last = match.index + match[0].length;
    });
    results.push(output + variant.slice(last));
  }
  return results;
}

export function answerVariants(text) {
  let variants = new Set([normalizeAnswer(text).replace(/\bcan not\b/g, "cannot")]);
  for (const [pattern, replacements] of CONTRACTIONS) {
    const next = new Set(variants);
    for (const variant of variants) {
      for (const expanded of expandOccurrences(variant, pattern, replacements)) next.add(expanded);
      if (next.size > MAX_VARIANTS) break;
    }
    variants = new Set([...next].slice(0, MAX_VARIANTS));
  }
  return variants;
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

/* Corrige una respuesta escrita. Exigente a propósito: un error de ortografía no cuenta
   como acierto, pero se avisa ("casi") para que no parezca un error de gramática.
   `strict` apaga la equivalencia de contracciones, para los ejercicios que justamente
   enseñan cuándo NO se contrae ("Yes, I am", nunca "Yes, I'm"). */
export function checkTypedAnswer(input, accepted, { strict = false } = {}) {
  const normalizedInput = normalizeAnswer(input);
  if (!normalizedInput) return { correct: false, nearMiss: false, expected: accepted?.[0] || "" };
  const given = strict ? new Set([normalizedInput]) : answerVariants(input);
  for (const answer of accepted || []) {
    const expected = strict ? new Set([normalizeAnswer(answer)]) : answerVariants(answer);
    if ([...given].some(variant => expected.has(variant))) return { correct: true, nearMiss: false, expected: answer };
  }
  const closest = (accepted || [])
    .map(answer => ({ answer, distance: levenshtein(normalizedInput, normalizeAnswer(answer)) }))
    .sort((left, right) => left.distance - right.distance)[0];
  const tolerance = closest ? Math.max(1, Math.floor(normalizeAnswer(closest.answer).length / 12)) : 0;
  return {
    correct: false,
    nearMiss: Boolean(closest) && closest.distance <= tolerance,
    expected: closest?.answer || "",
  };
}

/* ---------- La ruta: qué se enseñó antes de cada lección ---------- */

let routeIndex = null;
function route() {
  if (!routeIndex) {
    const course = getEnglishCourse();
    const ordered = course.levels.flatMap(level => level.units.flatMap(unit => unit.lessons.map(lesson => ({ lesson, level }))));
    const byId = new Map();
    const taught = new Set();
    for (const entry of ordered) {
      byId.set(entry.lesson.id, { ...entry, before: new Set(taught) });
      for (const ref of [...entry.lesson.grammar, ...entry.lesson.functions, entry.lesson.pronunciation, entry.lesson.writing]) {
        if (ref) taught.add(ref);
      }
    }
    routeIndex = byId;
  }
  return routeIndex;
}

function voiceAccent(voice) {
  return String(voice || "").split("-")[0];
}

function voiceAllowed(voice, level) {
  return VOICE_KEYS.includes(voice) && level.accents.includes(voiceAccent(voice));
}

/* ---------- Ejercicios ---------- */

function sortedWords(text) {
  return normalizeAnswer(text).split(" ").filter(Boolean).sort().join(" ");
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* Texto alternativo para la voz en audios que no son de la historia: solo puede cambiar
   la puntuación (por ejemplo, "W. H. I. T. E." en lugar de "W, H, I, T, E." para que la
   voz no junte las letras). Las palabras tienen que ser exactamente las que se leen. */
function voiceOverride(raw, display, label, issues) {
  const say = cleanText(raw, 1200);
  if (!say) return "";
  if (normalizeAnswer(say) !== normalizeAnswer(display)) issues.push(`${label}: lo que dice la voz no coincide con el texto en pantalla`);
  return say;
}

function containsAnswer(text, answer) {
  const needle = normalizeAnswer(answer);
  return needle.length > 2 && new RegExp(`(^| )${escapeRegExp(needle)}( |$)`).test(normalizeAnswer(text));
}

function normalizeExercise(raw, label, context, issues, { requireHint = false } = {}) {
  const { refs, before, level } = context;
  const type = cleanText(raw?.type, 20);
  const exercise = {
    type,
    instruction: cleanText(raw?.instruction, 300),
    q: cleanText(raw?.q, 1200),
    explain: cleanText(raw?.explain, 1200),
    target: cleanText(raw?.target, 80),
  };
  const hint = cleanText(raw?.hint, 400);
  if (hint) exercise.hint = hint;
  if (!EXERCISE_TYPES.includes(type)) { issues.push(`${label} tiene un tipo desconocido (${type || "vacío"})`); return exercise; }
  if (exercise.instruction.length < 8) issues.push(`${label} no tiene una instrucción clara`);
  if (exercise.explain.length < 15) issues.push(`${label} no explica la respuesta`);
  if (!exercise.target || !englishInventoryLabel(exercise.target)) {
    issues.push(`${label} no dice qué punto del curso entrena (${exercise.target || "vacío"})`);
  } else if (!refs.has(exercise.target) && !before.has(exercise.target)) {
    issues.push(`${label} entrena ${exercise.target}, que esta lección no enseña y ninguna anterior enseñó`);
  }

  if (type === "choice") {
    const options = Array.isArray(raw?.options) ? raw.options.map(option => cleanText(option, 400)) : [];
    const answer = Number(raw?.answer);
    if (exercise.q.length < 6) issues.push(`${label} no tiene enunciado`);
    if (options.length < 3 || options.length > 4 || options.some(option => !option)) issues.push(`${label} debe tener tres o cuatro opciones completas`);
    if (new Set(options.map(normalizeAnswer)).size !== options.length) issues.push(`${label} repite opciones`);
    if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) issues.push(`${label} no tiene una respuesta válida`);
    return { ...exercise, options, answer };
  }

  /* Entrenamiento del oído: suena una frase o palabra y hay que identificarla. Con varias
     voces (alta variabilidad) el oído aprende el sonido, no la manera de hablar de una
     sola persona. */
  if (type === "hear") {
    const options = Array.isArray(raw?.options) ? raw.options.map(option => cleanText(option, 300)) : [];
    const answer = Number(raw?.answer);
    const audioText = cleanText(raw?.audioText, 600);
    const voices = (Array.isArray(raw?.voices) ? raw.voices : []).map(voice => cleanText(voice, 20)).filter(Boolean);
    if (!audioText) issues.push(`${label} no tiene qué sonido reproducir`);
    if (options.length < 2 || options.length > 4 || options.some(option => !option)) issues.push(`${label} debe tener de dos a cuatro opciones`);
    if (new Set(options.map(normalizeAnswer)).size !== options.length) issues.push(`${label} repite opciones`);
    if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) issues.push(`${label} no tiene una respuesta válida`);
    if (!voices.length) issues.push(`${label} no dice con qué voces suena`);
    for (const voice of voices) if (!voiceAllowed(voice, level)) issues.push(`${label} usa una voz no prevista para ${level.cefr} (${voice})`);
    const audioSay = voiceOverride(raw?.audioSay, audioText, label, issues);
    return { ...exercise, audioText, ...(audioSay ? { audioSay } : {}), options, answer, voices };
  }

  if (type === "match") {
    const pairs = (Array.isArray(raw?.pairs) ? raw.pairs : [])
      .map(pair => [cleanText(pair?.[0], 300), cleanText(pair?.[1], 300)])
      .filter(([left, right]) => left && right);
    if (pairs.length < 4) issues.push(`${label} necesita al menos cuatro pares`);
    if (new Set(pairs.map(([left]) => normalizeAnswer(left))).size !== pairs.length
      || new Set(pairs.map(([, right]) => normalizeAnswer(right))).size !== pairs.length) issues.push(`${label} repite elementos`);
    return { ...exercise, pairs };
  }

  /* Escritos. En la práctica, el primer error recibe una pista y otra oportunidad antes de
     ver la respuesta: la corrección que obliga a pensar (prompt) deja más que la que da la
     forma correcta de una vez (recast). La pista no puede regalar la respuesta. */
  const answers = (Array.isArray(raw?.answers) ? raw.answers : []).map(answer => cleanText(answer, 600)).filter(Boolean);
  if (!answers.length) issues.push(`${label} no tiene respuestas aceptadas`);
  const strict = raw?.strict === true;
  const same = (left, right) => strict ? normalizeAnswer(left) === normalizeAnswer(right) : answerVariants(left).has(normalizeAnswer(right));
  if (requireHint && hint.length < 8) issues.push(`${label} necesita una pista para el segundo intento`);
  if (hint && answers.some(answer => containsAnswer(hint, answer))) issues.push(`${label}: la pista regala la respuesta`);

  if (type === "order") {
    const words = (Array.isArray(raw?.words) ? raw.words : []).map(word => cleanText(word, 60)).filter(Boolean);
    if (words.length < 3) issues.push(`${label} necesita al menos tres piezas para ordenar`);
    /* La clave tiene que usar exactamente las piezas que se dan: si sobra o falta una
       palabra, nadie podría llegar a la respuesta "correcta". */
    const pieces = sortedWords(words.join(" "));
    for (const answer of answers) {
      if (sortedWords(answer) !== pieces) issues.push(`${label}: la respuesta «${answer}» no usa exactamente las piezas dadas`);
    }
    if (answers.some(answer => normalizeAnswer(answer) === normalizeAnswer(words.join(" ")))) issues.push(`${label} ya viene ordenado`);
    return { ...exercise, words, answers, strict };
  }

  if (type === "dictation") {
    const audioText = cleanText(raw?.audioText, 600);
    if (countWords(audioText) < 3) issues.push(`${label} no tiene una frase para dictar`);
    if (!answers.some(answer => same(answer, audioText))) issues.push(`${label}: la respuesta no coincide con lo que se dicta`);
    const audioSay = voiceOverride(raw?.audioSay, audioText, label, issues);
    return { ...exercise, audioText, ...(audioSay ? { audioSay } : {}), answers, strict };
  }

  if (exercise.q.length < 6) issues.push(`${label} no tiene enunciado`);
  if (type === "gap") {
    if (!exercise.q.includes("___")) issues.push(`${label} no marca el hueco con ___`);
    /* Si la respuesta ya está escrita en el enunciado, el ejercicio no mide nada. Las
       pistas entre paréntesis — "I ___ (live) in Cali" — no cuentan: son parte del juego. */
    const prompt = exercise.q.replace(/\([^)]*\)/g, " ").replace(/___/g, " ");
    if (answers.some(answer => containsAnswer(prompt, answer)) && !raw?.allowAnswerInPrompt) issues.push(`${label} deja ver la respuesta en el enunciado`);
  }
  if (type === "wordform") {
    const base = cleanText(raw?.base, 60);
    if (!exercise.q.includes("___")) issues.push(`${label} no marca el hueco con ___`);
    if (!base) issues.push(`${label} no indica la palabra base`);
    return { ...exercise, base, answers, strict };
  }
  if (type === "correct") {
    if (answers.some(answer => same(answer, exercise.q))) issues.push(`${label}: la «corrección» es igual a la frase con error`);
  }
  return { ...exercise, answers, strict };
}

function normalizeExerciseList(list, label, context, issues, options) {
  const exercises = (Array.isArray(list) ? list : []).map((raw, index) => normalizeExercise(raw, `${label} ${index + 1}`, context, issues, options));
  const prompts = exercises.map(exercise => normalizeAnswer(`${exercise.q} ${exercise.audioText || ""} ${(exercise.words || []).join(" ")}`)).filter(Boolean);
  if (new Set(prompts).size !== prompts.length) issues.push(`${label}: hay ejercicios repetidos`);
  return exercises;
}

function typedShare(exercises) {
  if (!exercises.length) return 0;
  return exercises.filter(exercise => TYPED_TYPES.includes(exercise.type)).length / exercises.length;
}

/* Una línea hablada: lo que se ve (`text`) y, si hace falta emoción, lo que dice la voz
   (`say`, con etiquetas de eleven_v3). */
function normalizeSpoken(raw, label, issues) {
  const text = cleanText(raw?.text, 1500);
  const say = cleanText(raw?.say, 1800);
  if (say && normalizeAnswer(stripEmotionTags(say)) !== normalizeAnswer(text)) issues.push(`${label}: lo que dice la voz no coincide con el texto en pantalla`);
  return say ? { text, say } : { text };
}

/* ---------- La lección completa ---------- */

export function normalizeEnglishLesson(raw) {
  const issues = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new EnglishLessonError(["la lección no es un objeto JSON"]);
  const entry = route().get(cleanText(raw.id, 20));
  if (!entry) throw new EnglishLessonError([`la lección ${raw.id || "(sin id)"} no existe en la ruta`]);
  const { lesson: meta, level, before } = entry;
  const spec = LEVEL_SPEC[level.id];
  const refs = new Set([...meta.grammar, ...meta.functions, meta.pronunciation, meta.writing].filter(Boolean));
  const context = { refs, before, level };
  const explanationIsSpanish = level.explanationLanguage !== "en";
  const instructionsInSpanish = level.explanationLanguage === "es";
  const levelRank = ["a1", "a2", "b1", "b2", "c1"].indexOf(level.id);
  const castOk = (name, voice, label) => {
    const member = ENGLISH_CAST[name];
    if (!member) return;
    if (member.voice !== voice) issues.push(`${label}: ${name} suena siempre con ${member.voice}, no con ${voice}`);
    if (["a1", "a2", "b1", "b2", "c1"].indexOf(member.from) > levelRank) issues.push(`${label}: ${name} todavía no aparece en ${level.cefr}`);
  };

  /* Matilda abre y cierra la lección. En el básico va con traducción debajo. */
  const coach = {};
  for (const part of ["intro", "outro"]) {
    const spoken = normalizeSpoken(raw.coach?.[part], `la coach (${part})`, issues);
    const es = cleanText(raw.coach?.[part]?.es, 1500);
    if (spoken.text.length < 20) issues.push(`falta el ${part === "intro" ? "saludo" : "cierre"} de Matilda`);
    else if (!looksEnglish(spoken.text)) issues.push(`Matilda habla en inglés (${part})`);
    if (instructionsInSpanish && !es) issues.push(`en ${level.cefr} el ${part === "intro" ? "saludo" : "cierre"} de Matilda lleva traducción`);
    coach[part] = es ? { ...spoken, es } : spoken;
  }

  /* Intentar antes de aprender: equivocarse con retroalimentación inmediata prepara la
     memoria para la explicación que viene después. */
  const warmup = {
    question: cleanText(raw.warmup?.question, 600),
    tryFirst: normalizeExerciseList(raw.warmup?.tryFirst, "intento previo", context, issues),
  };
  if (warmup.question.length < 10) issues.push("falta la pregunta de calentamiento");
  if (warmup.tryFirst.length < 2) issues.push("faltan al menos dos ejercicios para intentar antes de la explicación");

  /* Vocabulario */
  const seenTerms = new Set();
  const vocabulary = (Array.isArray(raw.vocabulary) ? raw.vocabulary : []).map((item, index) => {
    const word = {
      term: cleanText(item?.term, 120),
      ipa: cleanText(item?.ipa, 120),
      pos: cleanText(item?.pos, 40),
      meaning: cleanText(item?.meaning, 300),
      example: cleanText(item?.example, 400),
      exampleMeaning: cleanText(item?.exampleMeaning, 400),
    };
    const label = `vocabulario ${index + 1}`;
    if (!word.term || !word.meaning) issues.push(`${label} no tiene término o significado`);
    if (!/^\/.+\/$/.test(word.ipa)) issues.push(`${label} (${word.term}) no trae la pronunciación en AFI entre barras`);
    if (countWords(word.example) < 3) issues.push(`${label} (${word.term}) no trae un ejemplo completo`);
    const key = normalizeAnswer(word.term);
    if (seenTerms.has(key)) issues.push(`${label} repite «${word.term}»`);
    seenTerms.add(key);
    return word;
  });
  if (vocabulary.length < spec.vocab[0] || vocabulary.length > spec.vocab[1]) {
    issues.push(`el vocabulario debe tener entre ${spec.vocab[0]} y ${spec.vocab[1]} entradas (tiene ${vocabulary.length})`);
  }

  /* Cognados: la ventaja del hispanohablante, que no aparece sola si no se enseña. */
  const cognates = {
    pattern: cleanText(raw.cognates?.pattern, 200),
    explanation: cleanText(raw.cognates?.explanation, 2000),
    examples: (Array.isArray(raw.cognates?.examples) ? raw.cognates.examples : [])
      .map(example => ({ en: cleanText(example?.en, 120), es: cleanText(example?.es, 120) }))
      .filter(example => example.en && example.es),
    falseFriends: (Array.isArray(raw.cognates?.falseFriends) ? raw.cognates.falseFriends : [])
      .map(item => ({ en: cleanText(item?.en, 120), looksLike: cleanText(item?.looksLike, 120), means: cleanText(item?.means, 300) }))
      .filter(item => item.en && item.looksLike && item.means),
  };
  if (!cognates.pattern || cognates.explanation.length < 60) issues.push("falta el patrón de cognados y su explicación");
  if (cognates.examples.length < 4) issues.push("el patrón de cognados necesita al menos cuatro ejemplos");
  if (cognates.falseFriends.length < 1) issues.push("falta al menos un falso amigo");

  /* Gramática */
  const grammar = {
    points: (Array.isArray(raw.grammar?.points) ? raw.grammar.points : []).map(point => cleanText(point, 80)),
    explanation: cleanText(raw.grammar?.explanation),
    examples: (Array.isArray(raw.grammar?.examples) ? raw.grammar.examples : [])
      .map(example => ({ en: cleanText(example?.en, 400), es: cleanText(example?.es, 400) }))
      .filter(example => example.en),
    pitfalls: (Array.isArray(raw.grammar?.pitfalls) ? raw.grammar.pitfalls : [])
      .map(pitfall => ({ wrong: cleanText(pitfall?.wrong, 300), right: cleanText(pitfall?.right, 300), why: cleanText(pitfall?.why, 600) }))
      .filter(pitfall => pitfall.wrong && pitfall.right && pitfall.why),
  };
  for (const point of meta.grammar) if (!grammar.points.includes(point)) issues.push(`la gramática no trabaja ${point}, que la ruta asigna a esta lección`);
  if (grammar.explanation.length < spec.explanation) issues.push(`la explicación gramatical es demasiado corta (${grammar.explanation.length}/${spec.explanation} caracteres)`);
  if (explanationIsSpanish ? !looksSpanish(grammar.explanation) : !looksEnglish(grammar.explanation)) {
    issues.push(`la explicación debe estar en ${explanationIsSpanish ? "español" : "inglés"} en el nivel ${level.cefr}`);
  }
  if (grammar.examples.length < spec.examples) issues.push(`faltan ejemplos de gramática (mínimo ${spec.examples})`);
  if (grammar.pitfalls.length < 2) issues.push("faltan al menos dos errores típicos de hispanohablantes");
  for (const [index, pitfall] of grammar.pitfalls.entries()) {
    if (normalizeAnswer(pitfall.wrong) === normalizeAnswer(pitfall.right)) issues.push(`el error típico ${index + 1} es igual a su corrección`);
  }

  /* Escucha: un episodio de la historia */
  const speakers = {};
  for (const [key, speaker] of Object.entries(raw.listening?.speakers || {})) {
    speakers[cleanText(key, 20)] = { name: cleanText(speaker?.name, 60), voice: cleanText(speaker?.voice, 40) };
  }
  const listening = {
    title: cleanText(raw.listening?.title, 200),
    context: cleanText(raw.listening?.context, 600),
    episode: raw.listening?.episode ? { series: cleanText(raw.listening.episode.series, 80), number: Number(raw.listening.episode.number) } : null,
    speakers,
    lines: (Array.isArray(raw.listening?.lines) ? raw.listening.lines : [])
      .map((line, index) => ({ speaker: cleanText(line?.speaker, 20), ...normalizeSpoken(line, `línea ${index + 1} de la escucha`, issues) }))
      .filter(line => line.text),
    questions: normalizeExerciseList(raw.listening?.questions, "pregunta de escucha", context, issues),
    dictation: (Array.isArray(raw.listening?.dictation) ? raw.listening.dictation : []).map(sentence => cleanText(sentence, 400)).filter(Boolean),
  };
  if (!listening.title) issues.push("la escucha no tiene título");
  if (listening.lines.length < 4) issues.push("la escucha necesita al menos cuatro intervenciones");
  for (const line of listening.lines) {
    if (!speakers[line.speaker]) issues.push(`la escucha usa un hablante sin voz asignada (${line.speaker || "vacío"})`);
  }
  for (const [key, speaker] of Object.entries(speakers)) {
    if (!voiceAllowed(speaker.voice, level)) issues.push(`la voz de ${key} (${speaker.voice || "vacía"}) no es un acento previsto para ${level.cefr}`);
    castOk(speaker.name, speaker.voice, `la escucha (${key})`);
  }
  const listeningWords = countWords(listening.lines.map(line => line.text).join(" "));
  const [listenMin, listenMax] = level.listeningWords;
  if (listeningWords < listenMin || listeningWords > Math.round(listenMax * 1.2)) {
    issues.push(`la escucha tiene ${listeningWords} palabras; en ${level.cefr} van de ${listenMin} a ${listenMax}`);
  }
  if (listening.questions.length < 4) issues.push("la escucha necesita al menos cuatro preguntas");
  if (listening.dictation.length < spec.dictation) issues.push(`el dictado necesita al menos ${spec.dictation} frases`);

  /* Lectura: obligatoria cuando la lección se centra en leer. */
  let reading = null;
  if (raw.reading || meta.focus === "reading") {
    reading = {
      title: cleanText(raw.reading?.title, 200),
      text: cleanText(raw.reading?.text),
      questions: normalizeExerciseList(raw.reading?.questions, "pregunta de lectura", context, issues),
    };
    const readingWords = countWords(reading.text);
    const [readMin, readMax] = level.readingWords;
    if (!reading.title) issues.push("la lectura no tiene título");
    if (readingWords < readMin || readingWords > Math.round(readMax * 1.2)) issues.push(`la lectura tiene ${readingWords} palabras; en ${level.cefr} van de ${readMin} a ${readMax}`);
    if (reading.questions.length < 4) issues.push("la lectura necesita al menos cuatro preguntas");
  }

  /* Pronunciación: primero el oído (identificar con varias voces), después la boca. */
  const pronunciation = {
    point: cleanText(raw.pronunciation?.point, 80),
    explanation: cleanText(raw.pronunciation?.explanation, 4000),
    items: (Array.isArray(raw.pronunciation?.items) ? raw.pronunciation.items : [])
      .map((item, index) => {
        const text = cleanText(item?.text, 200);
        const say = voiceOverride(item?.say, text, `ejemplo de pronunciación ${index + 1}`, issues);
        return { text, ...(say ? { say } : {}), ipa: cleanText(item?.ipa, 200), tip: cleanText(item?.tip, 400) };
      })
      .filter(item => item.text),
    minimalPairs: (Array.isArray(raw.pronunciation?.minimalPairs) ? raw.pronunciation.minimalPairs : [])
      .map(pair => [cleanText(pair?.[0], 60), cleanText(pair?.[1], 60)])
      .filter(([left, right]) => left && right),
    discrimination: normalizeExerciseList(raw.pronunciation?.discrimination, "entrenamiento del oído", context, issues),
    shadowing: (Array.isArray(raw.pronunciation?.shadowing) ? raw.pronunciation.shadowing : []).map(line => cleanText(line, 600)).filter(Boolean),
  };
  if (pronunciation.point !== meta.pronunciation) issues.push(`la pronunciación debe trabajar ${meta.pronunciation}`);
  if (pronunciation.explanation.length < 150) issues.push("la explicación de pronunciación es demasiado corta");
  if (pronunciation.items.length < 6) issues.push("la pronunciación necesita al menos seis ejemplos para repetir");
  if (pronunciation.items.some(item => item.ipa && !/^\/.+\/$/.test(item.ipa))) issues.push("la pronunciación tiene transcripciones AFI sin barras");
  if (pronunciation.shadowing.length < 2) issues.push("faltan frases de shadowing (repetir encima del audio)");
  if (pronunciation.discrimination.length < MIN_DISCRIMINATION || pronunciation.discrimination.some(item => item.type !== "hear")) {
    issues.push(`el entrenamiento del oído necesita al menos ${MIN_DISCRIMINATION} ejercicios de identificar lo que suena`);
  }
  const trainingVoices = new Set(pronunciation.discrimination.flatMap(item => item.voices || []));
  if (trainingVoices.size < MIN_DISCRIMINATION_VOICES) issues.push(`el entrenamiento del oído debe usar al menos ${MIN_DISCRIMINATION_VOICES} voces distintas (usa ${trainingVoices.size})`);

  /* Práctica y dominio */
  const practice = normalizeExerciseList(raw.practice, "práctica", context, issues, { requireHint: true });
  const mastery = normalizeExerciseList(raw.mastery, "dominio", context, issues);
  if (practice.length < spec.practice) issues.push(`la práctica necesita al menos ${spec.practice} ejercicios (tiene ${practice.length})`);
  if (mastery.length < spec.mastery) issues.push(`la prueba de dominio necesita al menos ${spec.mastery} preguntas (tiene ${mastery.length})`);
  if (typedShare(practice) < MIN_TYPED_SHARE.practice) issues.push(`la práctica es demasiado de adivinar: al menos el ${MIN_TYPED_SHARE.practice * 100}% debe ser escrito`);
  if (typedShare(mastery) < MIN_TYPED_SHARE.mastery) issues.push(`la prueba de dominio es demasiado de adivinar: al menos el ${MIN_TYPED_SHARE.mastery * 100}% debe ser escrito`);
  if (!mastery.some(exercise => exercise.type === "dictation")) issues.push("la prueba de dominio debe incluir al menos un dictado");
  for (const point of meta.grammar) {
    const trained = [...practice, ...mastery].filter(exercise => exercise.target === point).length;
    if (trained < MIN_EXERCISES_PER_GRAMMAR_POINT) issues.push(`${point} solo tiene ${trained} ejercicios (mínimo ${MIN_EXERCISES_PER_GRAMMAR_POINT})`);
    if (!mastery.some(exercise => exercise.target === point)) issues.push(`la prueba de dominio no evalúa ${point}`);
  }
  /* Repaso intercalado: lo de lecciones anteriores vuelve mezclado con lo nuevo. Recuperar
     de la memoria algo visto hace días es lo que lo fija. */
  const reviewNeeded = Math.min(MIN_REVIEW_EXERCISES, entry.lesson.chapter - 1);
  const reviewDone = [...practice, ...mastery].filter(exercise => before.has(exercise.target) && !refs.has(exercise.target)).length;
  if (reviewDone < reviewNeeded) issues.push(`faltan ejercicios de repaso de lecciones anteriores (${reviewDone}/${reviewNeeded})`);
  for (const [index, exercise] of [...warmup.tryFirst, ...practice, ...mastery, ...listening.questions, ...(reading?.questions || []), ...pronunciation.discrimination].entries()) {
    if (!exercise.instruction) continue;
    if (instructionsInSpanish ? !looksSpanish(exercise.instruction) && countWords(exercise.instruction) > 3 : !looksEnglish(exercise.instruction)) {
      issues.push(`la instrucción del ejercicio ${index + 1} debe estar en ${instructionsInSpanish ? "español" : "inglés"} en ${level.cefr}`);
    }
  }

  /* Hablar, con la técnica 4/3/2: la misma charla, cada vez con menos tiempo. */
  const speaking = {
    task: cleanText(raw.speaking?.task, 1200),
    prompts: (Array.isArray(raw.speaking?.prompts) ? raw.speaking.prompts : []).map(prompt => cleanText(prompt, 400)).filter(Boolean),
    seconds: Number(raw.speaking?.seconds),
    rounds: (Array.isArray(raw.speaking?.rounds) ? raw.speaking.rounds : []).map(Number),
    targetLanguage: (Array.isArray(raw.speaking?.targetLanguage) ? raw.speaking.targetLanguage : []).map(item => cleanText(item, 200)).filter(Boolean),
    model: cleanText(raw.speaking?.model, 3000),
    rubric: (Array.isArray(raw.speaking?.rubric) ? raw.speaking.rubric : []).map(item => cleanText(item, 40)),
  };
  const [speakMin, speakMax] = level.speakingSeconds;
  if (speaking.task.length < 30) issues.push("la tarea oral no está bien planteada");
  if (speaking.prompts.length < 3) issues.push("la tarea oral necesita al menos tres preguntas guía");
  if (!Number.isFinite(speaking.seconds) || speaking.seconds < speakMin || speaking.seconds > speakMax) issues.push(`la tarea oral debe durar entre ${speakMin} y ${speakMax} segundos en ${level.cefr}`);
  const roundsValid = speaking.rounds.length >= spec.rounds
    && speaking.rounds[0] === speaking.seconds
    && speaking.rounds.every((value, index) => Number.isFinite(value) && (index === 0 || value < speaking.rounds[index - 1]))
    && speaking.rounds.at(-1) >= Math.round(speakMin / 2);
  if (!roundsValid) issues.push(`la tarea oral necesita ${spec.rounds} rondas cada vez más cortas, empezando por ${speaking.seconds || "la duración pedida"} segundos`);
  if (speaking.targetLanguage.length < 3) issues.push("la tarea oral necesita al menos tres estructuras que se esperan oír");
  if (countWords(speaking.model) < Math.round(speakMin * 1.2)) issues.push("la respuesta modelo oral es demasiado corta para el tiempo pedido");
  if (SPEAKING_CRITERIA.some(criterion => !speaking.rubric.includes(criterion))) issues.push(`la rúbrica oral debe usar ${SPEAKING_CRITERIA.join(", ")}`);

  /* Conversar con un personaje: una tarea con propósito, no un ejercicio suelto. */
  const roleplay = {
    character: cleanText(raw.roleplay?.character, 60),
    voice: cleanText(raw.roleplay?.voice, 20),
    scenario: cleanText(raw.roleplay?.scenario, 1200),
    goals: (Array.isArray(raw.roleplay?.goals) ? raw.roleplay.goals : []).map(goal => cleanText(goal, 300)).filter(Boolean),
    opening: normalizeSpoken(raw.roleplay?.opening, "la primera frase del juego de roles", issues),
    maxTurns: Number(raw.roleplay?.maxTurns),
  };
  if (!roleplay.character || roleplay.scenario.length < 40) issues.push("el juego de roles necesita un personaje y una situación clara");
  if (roleplay.goals.length < 3) issues.push("el juego de roles necesita al menos tres objetivos que cumplir");
  if (roleplay.opening.text.length < 10 || !looksEnglish(roleplay.opening.text)) issues.push("el personaje del juego de roles abre la conversación en inglés");
  if (!Number.isInteger(roleplay.maxTurns) || roleplay.maxTurns < 4 || roleplay.maxTurns > 20) issues.push("el juego de roles debe durar entre 4 y 20 turnos");
  if (!voiceAllowed(roleplay.voice, level)) issues.push(`la voz del juego de roles (${roleplay.voice || "vacía"}) no es un acento previsto para ${level.cefr}`);
  castOk(roleplay.character, roleplay.voice, "el juego de roles");

  /* Escribir */
  const writing = {
    genre: cleanText(raw.writing?.genre, 80) || null,
    task: cleanText(raw.writing?.task, 1500),
    minWords: Number(raw.writing?.minWords),
    maxWords: Number(raw.writing?.maxWords),
    checklist: (Array.isArray(raw.writing?.checklist) ? raw.writing.checklist : []).map(item => cleanText(item, 300)).filter(Boolean),
    model: cleanText(raw.writing?.model, 6000),
    rubric: (Array.isArray(raw.writing?.rubric) ? raw.writing.rubric : []).map(item => cleanText(item, 40)),
  };
  const [writeMin, writeMax] = level.writingWords;
  if ((writing.genre || null) !== (meta.writing || null)) issues.push(`la escritura debe ${meta.writing ? `enseñar el género ${meta.writing}` : "ser una tarea corta sin género nuevo"}`);
  if (writing.task.length < 30) issues.push("la tarea escrita no está bien planteada");
  if (!Number.isInteger(writing.minWords) || !Number.isInteger(writing.maxWords) || writing.minWords >= writing.maxWords) issues.push("la tarea escrita necesita un mínimo y un máximo de palabras");
  else if (meta.writing ? writing.minWords < writeMin || writing.maxWords > Math.round(writeMax * 1.1) : writing.minWords < Math.min(20, writeMin) || writing.maxWords > writeMax) {
    issues.push(`el largo de la escritura no corresponde a ${level.cefr} (${writeMin}–${writeMax} palabras)`);
  }
  const modelWords = countWords(writing.model);
  if (modelWords < writing.minWords || modelWords > writing.maxWords) issues.push(`el texto modelo tiene ${modelWords} palabras y no respeta su propio límite (${writing.minWords}–${writing.maxWords})`);
  if (writing.checklist.length < 3) issues.push("la tarea escrita necesita una lista de control de al menos tres puntos");
  if (WRITING_CRITERIA.some(criterion => !writing.rubric.includes(criterion))) issues.push(`la rúbrica escrita debe usar ${WRITING_CRITERIA.join(", ")}`);

  /* Misión de inmersión: el curso da la estructura, las horas de inglés real las pone la
     vida. Con video, subtítulos en inglés: en español estorban al oído. */
  const mission = {
    kind: cleanText(raw.mission?.kind, 20),
    minutes: Number(raw.mission?.minutes),
    task: cleanText(raw.mission?.task, 1200),
    subtitles: cleanText(raw.mission?.subtitles, 10) || null,
  };
  if (!MISSION_KINDS.includes(mission.kind)) issues.push(`la misión de inmersión debe ser ${MISSION_KINDS.join(", ")}`);
  if (!Number.isFinite(mission.minutes) || mission.minutes < spec.mission) issues.push(`la misión de inmersión pide al menos ${spec.mission} minutos en ${level.cefr}`);
  if (mission.task.length < 30) issues.push("la misión de inmersión no está bien explicada");
  if (mission.kind === "watch" && mission.subtitles !== "en") issues.push("al ver video, los subtítulos van en inglés");

  if (issues.length) throw new EnglishLessonError([...new Set(issues)]);
  return {
    id: meta.id,
    lessonVersion: ENGLISH_LESSON_VERSION,
    level: level.id,
    coach,
    warmup,
    vocabulary,
    cognates,
    grammar,
    listening,
    reading,
    pronunciation,
    practice,
    speaking,
    roleplay,
    writing,
    mission,
    mastery,
    masteryScore: ENGLISH_RULES.lessonMastery,
  };
}

/* ---------- Audios ----------
   Cada texto que se escucha recibe una clave que depende del texto, la voz, la velocidad y
   el modelo. Si se corrige una frase, su clave cambia y el audio viejo deja de usarse solo:
   nunca suena una versión distinta de la que se lee en pantalla.

   Dos modelos de ElevenLabs, cada uno para lo que hace mejor:
   - eleven_v3 para la historia y para Matilda: obedece las etiquetas de emoción, que es lo
     que hace divertido escuchar. No acepta velocidad: la app ofrece reproducir más lento.
   - eleven_multilingual_v2 para vocabulario, dictados y pronunciación: idéntico en todas
     las lecciones y con la velocidad exacta de cada nivel. */

export const EXPRESSIVE_MODEL = "eleven_v3";
export const STEADY_MODEL = "eleven_multilingual_v2";

function fnv1a(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function audioKey(kind, text, voice, rate, model = STEADY_MODEL) {
  return `${kind}-${fnv1a(`${text}|${voice}|${rate}|${model}`)}`;
}

export function lessonAudioScript(lesson) {
  const entry = route().get(lesson?.id);
  if (!entry) return [];
  const { level } = entry;
  const rate = level.speechRate;
  const items = [];
  const add = (kind, text, { voice = NARRATOR_VOICE, expressive = false, say = "" } = {}) => {
    const display = cleanText(text, 4000);
    if (!display) return;
    const spoken = cleanText(say, 4000) || display;
    const model = expressive ? EXPRESSIVE_MODEL : STEADY_MODEL;
    const speed = expressive ? null : rate;
    const key = audioKey(kind, spoken, voice, speed, model);
    if (!items.some(item => item.key === key)) items.push({ key, kind, text: display, say: spoken, voice, rate: speed, model });
  };
  for (const part of ["intro", "outro"]) add("coach", lesson.coach?.[part]?.text, { expressive: true, say: lesson.coach?.[part]?.say });
  for (const item of lesson.vocabulary || []) { add("term", item.term); add("example", item.example); }
  for (const example of lesson.cognates?.examples || []) add("cognate", example.en);
  for (const example of lesson.grammar?.examples || []) add("grammar", example.en);
  for (const line of lesson.listening?.lines || []) {
    add("line", line.text, { voice: lesson.listening.speakers?.[line.speaker]?.voice || NARRATOR_VOICE, expressive: true, say: line.say });
  }
  for (const sentence of lesson.listening?.dictation || []) add("dictation", sentence);
  for (const item of lesson.pronunciation?.items || []) add("pron", item.text, { say: item.say });
  for (const [left, right] of lesson.pronunciation?.minimalPairs || []) { add("pair", left); add("pair", right); }
  for (const line of lesson.pronunciation?.shadowing || []) add("shadow", line);
  const allExercises = [...(lesson.warmup?.tryFirst || []), ...(lesson.practice || []), ...(lesson.mastery || []), ...(lesson.pronunciation?.discrimination || [])];
  for (const exercise of allExercises) {
    if (exercise.type === "dictation") add("dictation", exercise.audioText, { say: exercise.audioSay });
    if (exercise.type === "hear") for (const voice of exercise.voices || []) add("hear", exercise.audioText, { voice, say: exercise.audioSay });
  }
  add("speaking-model", lesson.speaking?.model);
  add("roleplay", lesson.roleplay?.opening?.text, { voice: lesson.roleplay?.voice, expressive: true, say: lesson.roleplay?.opening?.say });
  return items;
}
