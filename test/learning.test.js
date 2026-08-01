import test from "node:test";
import assert from "node:assert/strict";
import { courseAudit, getCuratedCourse } from "../course-catalog.js";
import { frameHistoricalLesson, LESSON_ENGINE_VERSION, LessonValidationError, lessonCacheIsCurrent, MASTERY_SCORE, normalizeLessonData, shuffleCards } from "../learning-utils.js";

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

test("las tres rutas auditadas cubren por completo sus fuentes", () => {
  for (const [bookId, expected] of [["thibodeau", 34], ["mazarrasa", 77], ["vacunador", 26]]) {
    const course = getCuratedCourse(bookId);
    const audit = courseAudit(course);
    assert.equal(audit.lessons, expected);
    assert.equal(audit.uniqueChapters, expected);
    assert.equal(audit.sequenceComplete, true);
    assert.equal(audit.pagesMonotonic, true);
    assert.equal(audit.pageRangesValid, true);
    assert.equal(audit.pagesContiguous, true);
    assert.equal(audit.pageBoundsValid, true);
    assert.equal(audit.stableIds, true);
    assert.equal(audit.complete, true);
  }
  const vacunador = getCuratedCourse("vacunador");
  const audit = courseAudit(vacunador);
  assert.equal(audit.coveredSections, 43);
  assert.equal(audit.expectedSections, 43);
  assert.equal(audit.sourceCoverageComplete, true);
  assert.equal(vacunador.units.flatMap(unit => unit.lessons).every(lesson => lesson.id.startsWith("vac-l")), true);
  assert.equal(vacunador.units.flatMap(unit => unit.lessons).every(lesson => lesson.sourceStatus === "historical-clinical"), true);
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

test("el manual de 2013 se identifica como archivo clínico en todo el material", () => {
  const safe = validLesson(23);
  safe.content = `Según el manual de 2013, esta edición describe el tema como un documento histórico. ${safe.content}`;
  safe.learningObjectives[0] = "Distinguir la edición del calendario actual que debe verificarse en una fuente oficial.";
  assert.doesNotThrow(() => normalizeLessonData(safe, {
    allowedPages: [23],
    timeSensitive: true,
    historicalClinical: true,
  }));

  const unsafe = structuredClone(safe);
  unsafe.flashcards[0].back = "Este es el esquema vigente para todas las personas y debe aplicarse.";
  assert.throws(
    () => normalizeLessonData(unsafe, { allowedPages: [23], timeSensitive: true, historicalClinical: true }),
    error => error instanceof LessonValidationError
      && error.issues.some(issue => issue.includes("lenguaje de vigencia sin indicar contraste")),
  );

  const unsafeDose = structuredClone(safe);
  unsafeDose.quiz[0] = {
    q: "¿Qué dosis debe administrarse a un niño?",
    options: ["0,5 mL", "1 mL", "2 mL", "5 mL"],
    answer: 0,
    explain: "Administrar 0,5 mL por la vía indicada [pág. 23].",
    level: "aplicacion",
  };
  assert.throws(
    () => normalizeLessonData(unsafeDose, { allowedPages: [23], timeSensitive: true, historicalClinical: true }),
    error => error instanceof LessonValidationError
      && error.issues.some(issue => issue.includes("dato operativo sin atribuirlo")),
  );
});

test("el motor enmarca de forma local los datos operativos del archivo antes de auditarlos", () => {
  const generated = validLesson(23);
  generated.content += "\n\nSe debe conservar el producto a 5 °C (pág. 23).";
  generated.keyTerms[0].def = "Producto que se administra en una dosis de 0,5 mL.";
  generated.quiz[0].q = "¿Qué dosis debe administrarse según el documento?";
  generated.quiz[0].options = ["0,5 mL", "1 mL", "2 mL", "5 mL"];
  generated.quiz[0].explain = "La respuesta documentada es 0,5 mL (pág. 23).";
  generated.flashcards[0].back = "Se administra una dosis de 0,5 mL.";
  generated.challenge.scenario = "Una niña de 5 años llega al vacunatorio para revisar la dosis.";
  generated.challenge.q = "¿Qué dosis debe administrarse?";

  const framed = frameHistoricalLesson(generated, { edition: "2013" });
  assert.match(framed.content, /Archivo clínico histórico/i);
  assert.match(framed.content, /Según esta edición de 2013, Se debe conservar el producto/);
  assert.match(framed.keyTerms[0].def, /^Según esta edición de 2013,/);
  assert.match(framed.quiz[0].q, /^Según esta edición de 2013,/);
  assert.match(framed.quiz[0].explain, /^Según esta edición de 2013,/);
  assert.match(framed.flashcards[0].front, /^Según esta edición de 2013,/);
  assert.match(framed.flashcards[0].back, /^Según esta edición de 2013,/);
  assert.match(framed.challenge.scenario, /^Según esta edición de 2013,/);
  assert.match(framed.challenge.q, /^Según esta edición de 2013,/);
  assert.doesNotThrow(() => normalizeLessonData(framed, {
    allowedPages: [23],
    timeSensitive: true,
    historicalClinical: true,
  }));
});

test("la atribución de una explicación no vuelve seguro un enunciado clínico directo", () => {
  const unsafe = frameHistoricalLesson(validLesson(23), { edition: "2013" });
  unsafe.quiz[0] = {
    q: "¿Qué dosis debe administrarse a un niño?",
    options: ["0,5 mL", "1 mL", "2 mL", "5 mL"],
    answer: 0,
    explain: "Según esta edición de 2013, la respuesta documentada es 0,5 mL (pág. 23).",
    level: "aplicacion",
  };
  assert.throws(
    () => normalizeLessonData(unsafe, { allowedPages: [23], timeSensitive: true, historicalClinical: true }),
    error => error instanceof LessonValidationError
      && error.issues.some(issue => issue.includes("pregunta 1 presenta una conducta")),
  );
});

test("cada oración operativa del contenido exige su propio marco histórico", () => {
  const unsafe = frameHistoricalLesson(validLesson(23), { edition: "2013" });
  unsafe.content = `${unsafe.content}\n\nSegún esta edición de 2013, el producto se conserva a 5 °C. Debe administrarse una dosis de 0,5 mL (pág. 23).`;
  assert.throws(
    () => normalizeLessonData(unsafe, { allowedPages: [23], timeSensitive: true, historicalClinical: true }),
    error => error instanceof LessonValidationError
      && error.issues.some(issue => issue.includes("dato operativo sin atribuirlo")),
  );
});

test("las flashcards se mezclan sin alterar el mazo original", () => {
  const cards = [{ front: "A" }, { front: "B" }, { front: "C" }];
  const shuffled = shuffleCards(cards, () => 0);
  assert.deepEqual(cards.map(card => card.front), ["A", "B", "C"]);
  assert.deepEqual(shuffled.map(card => card.front), ["B", "C", "A"]);
});

/* Regresión: si se corrige el capítulo que cubre una lección (rango de páginas, título u
   objetivo viven en el catálogo del curso), la lección guardada quedó construida con datos
   viejos aunque el libro y el motor no hayan cambiado. */
test("la lección guardada caduca cuando cambia la versión del curso", () => {
  const guardada = { lessonVersion: LESSON_ENGINE_VERSION, sourceVersion: "libro-r1", courseVersion: "v3" };
  assert.equal(lessonCacheIsCurrent(guardada, "libro-r1", "v3"), true);
  assert.equal(lessonCacheIsCurrent(guardada, "libro-r1", "v4"), false, "un curso nuevo debe invalidarla");
  assert.equal(lessonCacheIsCurrent(guardada, "libro-r2", "v3"), false, "un libro nuevo debe invalidarla");
});

test("una lección vieja sin versión de curso se respeta y no fuerza regenerar todo", () => {
  const legacy = { lessonVersion: LESSON_ENGINE_VERSION, sourceVersion: "libro-r1" };
  assert.equal(lessonCacheIsCurrent(legacy, "libro-r1", "v3"), true);
});
