// ===== Avance en el curso de inglés: candados, XP, racha e inmersión =====
//
// Lógica pura, sin pantalla ni base de datos, para poder probarla sola. La app la usa para
// decidir qué lección se puede abrir y para actualizar el progreso que guarda en
// users/{uid}/progress/ingles — el mismo documento que lee el panel de actividad del admin,
// por eso conserva sus campos (done, xp, level, streak, lastStudy).

import { ENGLISH_RULES } from "./english-catalog.js";

export const LESSON_STATE = { done: "done", open: "open", locked: "locked", soon: "soon" };

function flatLessons(course) {
  return (course?.levels || []).flatMap(level => level.units.flatMap(unit => unit.lessons));
}

/* Una lección se abre cuando la anterior de la ruta está dominada. Las que todavía no
   tienen contenido escrito aparecen como "en preparación" y no frenan a las siguientes
   que sí existen solo para el administrador, que necesita poder probarlas. */
export function lessonStates(course, progress, availableIds, { isAdmin = false, overdue = 0 } = {}) {
  const done = progress?.done || {};
  const available = new Set(availableIds || []);
  const reviewBlocked = overdue > ENGLISH_RULES.maxOverdueReviews;
  const states = new Map();
  let previousDone = true;
  for (const lesson of flatLessons(course)) {
    let state;
    let reason = "";
    if (done[lesson.id]) state = LESSON_STATE.done;
    else if (!available.has(lesson.id)) { state = LESSON_STATE.soon; reason = "Lección en preparación."; }
    else if (!previousDone) { state = LESSON_STATE.locked; reason = "Domina primero la lección anterior (80 % o más)."; }
    else if (reviewBlocked) { state = LESSON_STATE.locked; reason = `Tienes más de ${ENGLISH_RULES.maxOverdueReviews} repasos atrasados: haz el repaso de hoy y se abre.`; }
    else state = LESSON_STATE.open;
    const adminBypass = isAdmin && state === LESSON_STATE.locked;
    states.set(lesson.id, { state: adminBypass ? LESSON_STATE.open : state, reason, adminBypass });
    previousDone = Boolean(done[lesson.id]);
  }
  return states;
}

export function nextLessonId(course, states) {
  for (const lesson of flatLessons(course)) {
    if (states.get(lesson.id)?.state === LESSON_STATE.open) return lesson.id;
  }
  return null;
}

function isoDay(time) {
  return new Date(time).toISOString().slice(0, 10);
}

/* Registra una lección dominada. El XP se gana una sola vez por lección; la mejor nota se
   conserva; la racha cuenta días seguidos de estudio. */
export function recordMastery(progress, lessonId, score, now = Date.now()) {
  const next = {
    ...progress,
    done: { ...(progress?.done || {}) },
    scores: { ...(progress?.scores || {}) },
    awarded: { ...(progress?.awarded || {}) },
  };
  const firstTime = !next.awarded[lessonId];
  next.done[lessonId] = true;
  next.scores[lessonId] = Math.max(Number(next.scores[lessonId] || 0), score);
  if (firstTime) { next.xp = Number(next.xp || 0) + score; next.awarded[lessonId] = true; }
  next.level = Math.floor(Number(next.xp || 0) / 100) + 1;
  return { progress: touchStreak(next, now), firstTime };
}

export function touchStreak(progress, now = Date.now()) {
  const today = isoDay(now);
  const yesterday = isoDay(now - 86400000);
  const next = { ...progress };
  if (next.lastStudy === today) return next;
  next.streak = next.lastStudy === yesterday ? Number(next.streak || 0) + 1 : 1;
  next.lastStudy = today;
  return next;
}

/* Inmersión: minutos de inglés real (series con subtítulos en inglés, pódcasts, lectura)
   que se anotan por nivel. Para presentar el examen de un nivel hacen falta sus horas. */
export function addImmersion(progress, levelId, minutes) {
  const value = Math.max(0, Math.min(600, Math.round(Number(minutes) || 0)));
  const immersion = { ...(progress?.immersion || {}) };
  immersion[levelId] = Number(immersion[levelId] || 0) + value;
  return { ...progress, immersion };
}

export function immersionStatus(course, progress) {
  return (course?.levels || []).map(level => {
    const minutes = Number(progress?.immersion?.[level.id] || 0);
    const required = level.immersionHours * 60;
    return { level: level.id, cefr: level.cefr, minutes, required, ready: minutes >= required };
  });
}
