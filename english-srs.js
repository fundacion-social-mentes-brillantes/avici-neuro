// ===== Repaso espaciado del curso de inglés =====
//
// Recordar algo justo cuando está por olvidarse es lo que lo fija (efecto de espaciado y
// práctica de recuperación). Cada tarjeta guarda cuándo vuelve a aparecer; si se recuerda
// bien, la próxima vez tarda más; si se olvida, vuelve pronto. Es una variante sencilla de
// SM-2, la familia de algoritmos que usan Anki y similares.

export const SRS_GRADES = { again: 0, hard: 1, good: 2, easy: 3 };
const DAY = 24 * 60 * 60 * 1000;
const RELEARN_MINUTES = 10;
const MIN_EASE = 1.3;
const MAX_EASE = 3;
const MAX_INTERVAL_DAYS = 365;

function slug(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "x";
}

function shortHash(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

export function newCard({ id, kind, front, back, lessonId, audio = null, note = "" }, now = Date.now()) {
  return {
    id, kind, front, back, lessonId, audio, note,
    due: now, interval: 0, ease: 2.5, reps: 0, lapses: 0, createdAt: now, lastReview: null,
  };
}

export function reviewCard(card, grade, now = Date.now()) {
  const next = { ...card, lastReview: now };
  if (grade === SRS_GRADES.again) {
    next.reps = 0;
    next.lapses = (card.lapses || 0) + 1;
    next.interval = 0;
    next.ease = Math.max(MIN_EASE, (card.ease || 2.5) - 0.2);
    next.due = now + RELEARN_MINUTES * 60 * 1000;
    return next;
  }
  next.reps = (card.reps || 0) + 1;
  let interval;
  if (next.reps === 1) interval = grade === SRS_GRADES.easy ? 3 : 1;
  else if (next.reps === 2) interval = grade === SRS_GRADES.hard ? 3 : grade === SRS_GRADES.easy ? 8 : 6;
  else {
    const factor = grade === SRS_GRADES.hard ? 0.8 : grade === SRS_GRADES.easy ? 1.3 : 1;
    interval = Math.round(Math.max(1, card.interval || 1) * (card.ease || 2.5) * factor);
  }
  const easeChange = grade === SRS_GRADES.hard ? -0.15 : grade === SRS_GRADES.easy ? 0.15 : 0;
  next.ease = Math.min(MAX_EASE, Math.max(MIN_EASE, (card.ease || 2.5) + easeChange));
  next.interval = Math.min(MAX_INTERVAL_DAYS, interval);
  next.due = now + next.interval * DAY;
  return next;
}

export function isDue(card, now = Date.now()) {
  return Number(card?.due || 0) <= now;
}

/* "Vencidas" son las que ya tocaba repasar antes de hoy. Muchas acumuladas significan que
   lo aprendido se está escapando: en ese caso el curso no abre lecciones nuevas. */
export function overdueCount(cards, now = Date.now()) {
  return (cards || []).filter(card => Number(card?.due || 0) <= now - DAY).length;
}

export function dueCards(cards, now = Date.now()) {
  return (cards || []).filter(card => isDue(card, now)).sort((left, right) => left.due - right.due);
}

/* Tarjetas que deja una lección dominada: su vocabulario, sus errores típicos y, como
   cuaderno de errores, cada ejercicio que se falló en la prueba de dominio. */
export function cardsFromLesson(lesson, { missed = [], now = Date.now() } = {}) {
  const cards = [];
  for (const word of lesson?.vocabulary || []) {
    cards.push(newCard({
      id: `${lesson.id}~v~${slug(word.term)}`,
      kind: "vocab",
      front: word.term,
      back: `${word.meaning}${word.example ? `\n${word.example}` : ""}`,
      lessonId: lesson.id,
      audio: { kind: "term", text: word.term },
    }, now));
  }
  (lesson?.grammar?.pitfalls || []).forEach((pitfall, index) => {
    cards.push(newCard({
      id: `${lesson.id}~p~${index}`,
      kind: "pitfall",
      front: `¿Qué está mal? «${pitfall.wrong}»`,
      back: `${pitfall.right}\n${pitfall.why}`,
      lessonId: lesson.id,
    }, now));
  });
  for (const exercise of missed) {
    const prompt = exercise.q || exercise.audioText || (exercise.words || []).join(" ");
    const answer = exercise.answers?.[0] ?? exercise.options?.[exercise.answer] ?? "";
    if (!prompt || !answer) continue;
    cards.push(newCard({
      id: `${lesson.id}~x~${shortHash(prompt)}`,
      kind: "mistake",
      front: `${exercise.instruction ? `${exercise.instruction}\n` : ""}${prompt}`,
      back: `${answer}${exercise.explain ? `\n${exercise.explain}` : ""}`,
      lessonId: lesson.id,
      audio: exercise.audioText ? { kind: "dictation", text: exercise.audioText } : null,
    }, now));
  }
  return cards;
}
