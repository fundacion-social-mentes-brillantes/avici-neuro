import test from "node:test";
import assert from "node:assert/strict";
import { courseAudit, getCuratedCourse } from "../course-catalog.js";
import { LessonValidationError, MASTERY_SCORE, normalizeLessonData, shuffleCards } from "../learning-utils.js";

function validLesson(page = 23) {
  const cite = `(pág. ${page})`;
  return {
    learningObjectives: ["Explicar el mecanismo", "Distinguir sus partes", "Aplicarlo a un caso"],
    content: `${"Explicación verificable del capítulo. ".repeat(22)} ${cite}`,
    keyTerms: Array.from({ length: 6 }, (_, index) => ({ term: `Término ${index + 1}`, def: `Definición precisa ${index + 1}` })),
    quiz: Array.from({ length: 6 }, (_, index) => ({
      q: `¿Cuál es la respuesta verificable número ${index + 1}?`,
      options: ["Opción A", "Opción B", "Opción C", `Opción ${index + 4}`],
      answer: index % 4,
      level: index === 0 ? "recuerdo" : index > 3 ? "aplicacion" : "comprension",
      explain: `La respuesta se desprende del fragmento recuperado ${cite}.`,
    })),
    flashcards: Array.from({ length: 8 }, (_, index) => ({ front: `Pregunta ${index + 1}`, back: `Respuesta ${index + 1}` })),
    challenge: {
      scenario: "Una estudiante debe decidir qué concepto del capítulo explica mejor una situación comunitaria concreta.",
      q: "¿Cuál es el razonamiento mejor respaldado?",
      options: ["Alternativa 1", "Alternativa 2", "Alternativa 3", "Alternativa 4"],
      answer: 2,
      level: "aplicacion",
      explain: `El fragmento permite justificar esa decisión ${cite}.`,
    },
  };
}

test("las dos rutas cubren todos los capítulos del PDF en orden", () => {
  for (const [bookId, expected] of [["thibodeau", 34], ["mazarrasa", 77]]) {
    const course = getCuratedCourse(bookId);
    const audit = courseAudit(course);
    assert.equal(audit.lessons, expected);
    assert.equal(audit.uniqueChapters, expected);
    assert.equal(audit.sequenceComplete, true);
    assert.equal(audit.pagesMonotonic, true);
    assert.equal(audit.pageRangesValid, true);
    assert.equal(audit.stableIds, true);
    assert.equal(audit.complete, true);
  }
});

test("la lección solo pasa si su contenido, juegos y citas son comprobables", () => {
  const lesson = normalizeLessonData(validLesson(23), { allowedPages: [23] });
  assert.equal(lesson.quiz.length, 6);
  assert.equal(lesson.flashcards.length, 8);
  assert.equal(lesson.challenge.answer, 2);
  assert.equal(MASTERY_SCORE, 80);
});

test("una cita inventada o un juego ambiguo bloquean la lección", () => {
  const bad = validLesson(999);
  bad.quiz[0].options[3] = "Opción A";
  assert.throws(
    () => normalizeLessonData(bad, { allowedPages: [23] }),
    error => error instanceof LessonValidationError
      && error.issues.some(issue => issue.includes("páginas no recuperadas"))
      && error.issues.some(issue => issue.includes("repite opciones")),
  );
});

test("un capítulo sensible no puede presentar datos de la edición como actuales", () => {
  const bad = validLesson(23);
  bad.content += " Hoy, esta es la cifra vigente para toda la población.";
  assert.throws(
    () => normalizeLessonData(bad, { allowedPages: [23], timeSensitive: true }),
    error => error instanceof LessonValidationError
      && error.issues.some(issue => issue.includes("como si fuera actual")),
  );
});

test("las flashcards se mezclan sin alterar el mazo original", () => {
  const cards = [{ front: "A" }, { front: "B" }, { front: "C" }];
  const shuffled = shuffleCards(cards, () => 0);
  assert.deepEqual(cards.map(card => card.front), ["A", "B", "C"]);
  assert.deepEqual(shuffled.map(card => card.front), ["B", "C", "A"]);
});
