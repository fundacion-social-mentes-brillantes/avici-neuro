import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { ENGLISH_RULES, englishCourseAudit, getEnglishCourse } from "../english-catalog.js";
import { answerVariants, checkTypedAnswer, EnglishLessonError, EXPRESSIVE_MODEL, lessonAudioScript, normalizeEnglishLesson, STEADY_MODEL, stripEmotionTags } from "../english-utils.js";

const LESSON_DIR = new URL("../english/lessons/", import.meta.url);
const pilot = () => JSON.parse(readFileSync(new URL("en-a1-01.json", LESSON_DIR), "utf8"));
const pilotB2 = () => JSON.parse(readFileSync(new URL("en-b2-13.json", LESSON_DIR), "utf8"));

function issuesOf(raw) {
  try {
    normalizeEnglishLesson(raw);
    return [];
  } catch (error) {
    assert.ok(error instanceof EnglishLessonError, error.message);
    return error.issues;
  }
}

test("la ruta de inglés cubre los cinco niveles completos", () => {
  const course = getEnglishCourse();
  const audit = englishCourseAudit(course);
  assert.deepEqual(audit.issues, []);
  assert.equal(audit.complete, true);
  assert.equal(audit.lessons, 168);
  assert.deepEqual(course.levels.map(level => level.cefr), ["A1", "A2", "B1", "B2", "C1"]);
  assert.deepEqual(Object.values(audit.levels).map(level => level.lessons), [30, 30, 36, 36, 36]);
  for (const level of Object.values(audit.levels)) {
    assert.equal(level.covered, level.inventory);
    assert.equal(level.coverageComplete, true);
    assert.equal(level.unitsBalanced, true);
  }
  assert.equal(course.units.length, 30);
  assert.equal(course.units.every(unit => unit.checkpoint.passScore === ENGLISH_RULES.checkpointPass), true);
  assert.equal(course.levels.every(level => level.exam.passEach === 75), true);
  assert.equal(course.levels[0].exam.cumulativeShare, 0);
  assert.equal(course.levels.slice(1).every(level => level.exam.cumulativeShare > 0), true);
});

test("la auditoría de la ruta detecta huecos, puntos inventados y saltos de nivel", () => {
  const withoutLesson = getEnglishCourse();
  withoutLesson.levels[0].units[0].lessons.splice(0, 1);
  const gap = englishCourseAudit(withoutLesson);
  assert.equal(gap.complete, false);
  assert.ok(gap.issues.some(issue => issue.includes("a1.f.greet")));

  const invented = getEnglishCourse();
  invented.levels[1].units[0].lessons[0].grammar.push("a2.invented-point");
  assert.ok(englishCourseAudit(invented).issues.some(issue => issue.includes("a2.invented-point")));

  const future = getEnglishCourse();
  future.levels[0].units[0].lessons[0].grammar.push("c1.inversion");
  assert.ok(englishCourseAudit(future).issues.some(issue => issue.includes("nivel posterior")));

  const unbalanced = getEnglishCourse();
  for (const lesson of unbalanced.levels[0].units[0].lessons) if (lesson.focus === "listening") lesson.focus = "grammar";
  assert.ok(englishCourseAudit(unbalanced).issues.some(issue => issue.includes("sin listening")));
});

test("desde B2 la ruta se presenta en inglés", () => {
  const course = getEnglishCourse();
  for (const level of course.levels.filter(item => ["b2", "c1"].includes(item.id))) {
    assert.equal(level.explanationLanguage, "en");
    for (const lesson of level.units.flatMap(unit => unit.lessons)) {
      assert.doesNotMatch(lesson.objective, /\b(que|para|con|los|las)\b/u, lesson.id);
    }
  }
});

test("todas las lecciones escritas pasan la verificación", () => {
  const files = readdirSync(LESSON_DIR).filter(name => /^en-[a-c][12]-\d{2}\.json$/.test(name));
  assert.ok(files.length >= 1);
  for (const file of files) {
    const raw = JSON.parse(readFileSync(new URL(file, LESSON_DIR), "utf8"));
    assert.equal(`${raw.id}.json`, file);
    const lesson = normalizeEnglishLesson(raw);
    assert.equal(lesson.masteryScore, ENGLISH_RULES.lessonMastery);
  }
});

test("la verificación rechaza claves de respuesta imposibles", () => {
  const badOrder = pilot();
  badOrder.practice[11].answers = ["What's your name?"];
  assert.ok(issuesOf(badOrder).some(issue => issue.includes("no usa exactamente las piezas")));

  const badDictation = pilot();
  badDictation.mastery[6].answers = ["Nice to see you, Daniel."];
  assert.ok(issuesOf(badDictation).some(issue => issue.includes("no coincide con lo que se dicta")));

  const giveaway = pilot();
  giveaway.practice[1].q = "Emma ___ the receptionist (she is).";
  giveaway.practice[1].answers = ["is"];
  giveaway.listening.questions[1].q = "Ortega: Daniel's last name is ___.";
  assert.ok(issuesOf(giveaway).some(issue => issue.includes("deja ver la respuesta")));

  const sameCorrection = pilot();
  sameCorrection.mastery[9].answers = ["Am Laura."];
  assert.ok(issuesOf(sameCorrection).some(issue => issue.includes("igual a la frase con error")));

  const badChoice = pilot();
  badChoice.practice[4].answer = 5;
  assert.ok(issuesOf(badChoice).some(issue => issue.includes("respuesta válida")));
});

test("la verificación exige producir, no adivinar", () => {
  const guessing = pilot();
  guessing.practice = guessing.practice.map((exercise, index) => ({
    type: "choice",
    instruction: "Elige la opción correcta.",
    q: `Pregunta de opción múltiple número ${index + 1}: ¿cuál es la forma correcta?`,
    options: ["am", "is", "are"],
    answer: 0,
    explain: "Explicación suficiente de la respuesta.",
    target: exercise.target,
  }));
  assert.ok(issuesOf(guessing).some(issue => issue.includes("demasiado de adivinar")));

  const noDictation = pilot();
  noDictation.mastery = noDictation.mastery.filter(exercise => exercise.type !== "dictation");
  assert.ok(issuesOf(noDictation).some(issue => issue.includes("dictado")));

  const untrained = pilot();
  untrained.mastery = untrained.mastery.filter(exercise => exercise.target !== "a1.subject-pronouns");
  untrained.practice = untrained.practice.filter(exercise => exercise.target !== "a1.subject-pronouns");
  assert.ok(issuesOf(untrained).some(issue => issue.includes("a1.subject-pronouns")));
});

test("la verificación respeta el idioma, los acentos y los límites del nivel", () => {
  const englishExplanation = pilot();
  englishExplanation.grammar.explanation = "The verb to be has three forms in the present: am, is and are. ".repeat(12);
  assert.ok(issuesOf(englishExplanation).some(issue => issue.includes("debe estar en español")));

  const wrongAccent = pilot();
  wrongAccent.listening.speakers.A.voice = "in-f1";
  assert.ok(issuesOf(wrongAccent).some(issue => issue.includes("acento")));

  const longModel = pilot();
  longModel.writing.model = `${longModel.writing.model} ${"I'm a student. ".repeat(20)}`;
  assert.ok(issuesOf(longModel).some(issue => issue.includes("texto modelo")));

  const wrongGenre = pilot();
  wrongGenre.writing.genre = "a1.w.form";
  assert.ok(issuesOf(wrongGenre).some(issue => issue.includes("tarea corta")));

  const shortListening = pilot();
  shortListening.listening.lines = shortListening.listening.lines.slice(0, 4);
  assert.ok(issuesOf(shortListening).some(issue => issue.includes("la escucha tiene")));

  const unknownLesson = pilot();
  unknownLesson.id = "en-a1-99";
  assert.ok(issuesOf(unknownLesson).some(issue => issue.includes("no existe en la ruta")));
});

test("las respuestas escritas se corrigen con exigencia pero sin injusticias", () => {
  assert.equal(checkTypedAnswer("i'm not from spain", ["I'm not from Spain."]).correct, true);
  assert.equal(checkTypedAnswer("I am not from Spain", ["I'm not from Spain."]).correct, true);
  assert.equal(checkTypedAnswer("She’s not a student", ["She isn't a student."]).correct, true);
  assert.equal(checkTypedAnswer("You can't swim", ["You cannot swim."]).correct, true);
  assert.equal(checkTypedAnswer("she has got a cat", ["She's got a cat."]).correct, true);
  assert.equal(checkTypedAnswer("I'd go", ["I would go"]).correct, true);
  assert.equal(checkTypedAnswer("I'd gone", ["I had gone"]).correct, true);
  assert.equal(checkTypedAnswer("  are  ", ["are"]).correct, true);
  assert.equal(checkTypedAnswer("is", ["are"]).correct, false);
  assert.equal(checkTypedAnswer("", ["are"]).correct, false);

  const typo = checkTypedAnswer("Ortga", ["Ortega"]);
  assert.equal(typo.correct, false);
  assert.equal(typo.nearMiss, true);

  /* Dos 'd distintos en la misma frase: had en la condición, would en el resultado. */
  assert.equal(checkTypedAnswer("I'd have called you if I'd had your number", ["I would have called you if I had had your number."]).correct, true);
  assert.equal(checkTypedAnswer("If I'd known, I'd have come", ["If I had known, I would have come."]).correct, true);
  assert.equal(checkTypedAnswer("If I would have known, I would have come", ["If I had known, I would have come."]).correct, false);

  /* La ortografía británica es correcta aunque el modelo del curso sea estadounidense. */
  assert.equal(checkTypedAnswer("My train was cancelled", ["My train was canceled."]).correct, true);
  assert.equal(checkTypedAnswer("my favourite colour", ["my favorite color"]).correct, true);
  assert.equal(checkTypedAnswer("I realised it at the theatre", ["I realized it at the theater."]).correct, true);
  assert.equal(checkTypedAnswer("your hour", ["your hor"]).correct, false);

  assert.equal(checkTypedAnswer("Yes, I'm.", ["Yes, I am."], { strict: true }).correct, false);
  assert.equal(checkTypedAnswer("yes I am", ["Yes, I am."], { strict: true }).correct, true);
  assert.equal(answerVariants("can't").has("ca not"), false);
});

test("cada lección cumple el método: intentar antes, cognados, pistas, repaso y oído", () => {
  const noTry = pilot();
  noTry.warmup.tryFirst = noTry.warmup.tryFirst.slice(0, 1);
  assert.ok(issuesOf(noTry).some(issue => issue.includes("intentar antes")));

  const noFalseFriend = pilot();
  noFalseFriend.cognates.falseFriends = [];
  assert.ok(issuesOf(noFalseFriend).some(issue => issue.includes("falso amigo")));

  const noHint = pilot();
  delete noHint.practice[0].hint;
  assert.ok(issuesOf(noHint).some(issue => issue.includes("pista para el segundo intento")));

  const giveawayHint = pilot();
  giveawayHint.practice[10].hint = "Escribe: Are you Daniel?";
  assert.ok(issuesOf(giveawayHint).some(issue => issue.includes("regala la respuesta")));

  /* La lección B2 tiene que repasar puntos de lecciones anteriores. */
  assert.deepEqual(issuesOf(pilotB2()), []);
  const noReview = pilotB2();
  noReview.practice = noReview.practice.filter(exercise => exercise.target.startsWith("b2.third") || exercise.target.startsWith("b2.p") || exercise.target.startsWith("b2.f"));
  noReview.mastery = noReview.mastery.filter(exercise => !exercise.target.startsWith("b2.future"));
  assert.ok(issuesOf(noReview).some(issue => issue.includes("repaso de lecciones anteriores")));

  /* Un ejercicio no puede entrenar algo que la ruta todavía no enseñó. */
  const future = pilotB2();
  future.mastery[13].target = "b2.wish";
  assert.ok(issuesOf(future).some(issue => issue.includes("ninguna anterior enseñó")));

  const fewVoices = pilot();
  for (const item of fewVoices.pronunciation.discrimination) item.voices = ["us-f1", "us-m1"];
  assert.ok(issuesOf(fewVoices).some(issue => issue.includes("voces distintas")));
});

test("hablar, conversar y salir al inglés real también se verifican", () => {
  const flatRounds = pilot();
  flatRounds.speaking.rounds = [45, 45];
  assert.ok(issuesOf(flatRounds).some(issue => issue.includes("rondas cada vez más cortas")));

  const wrongCastVoice = pilot();
  wrongCastVoice.roleplay.voice = "us-f1";
  assert.ok(issuesOf(wrongCastVoice).some(issue => issue.includes("Emma suena siempre con us-f2")));

  const tooEarly = pilot();
  tooEarly.listening.speakers.A = { name: "Oliver", voice: "uk-m1" };
  const early = issuesOf(tooEarly);
  assert.ok(early.some(issue => issue.includes("todavía no aparece en A1")));
  assert.ok(early.some(issue => issue.includes("acento previsto")));

  const spanishSubtitles = pilot();
  spanishSubtitles.mission.subtitles = "es";
  assert.ok(issuesOf(spanishSubtitles).some(issue => issue.includes("subtítulos van en inglés")));

  const mismatch = pilot();
  mismatch.listening.lines[0].say = "[cheerfully] Good afternoon! Welcome to Bright Start English School.";
  assert.ok(issuesOf(mismatch).some(issue => issue.includes("no coincide con el texto en pantalla")));

  const noTranslation = pilot();
  delete noTranslation.coach.intro.es;
  assert.ok(issuesOf(noTranslation).some(issue => issue.includes("lleva traducción")));

  assert.equal(stripEmotionTags("[laughs] Oh! [warmly] You mean you're twenty-seven."), "Oh! You mean you're twenty-seven.");
});

test("cada audio tiene una clave estable que cambia si cambia el texto", () => {
  const lesson = normalizeEnglishLesson(pilot());
  const first = lessonAudioScript(lesson);
  const again = lessonAudioScript(lesson);
  assert.deepEqual(first.map(item => item.key), again.map(item => item.key));
  assert.equal(new Set(first.map(item => item.key)).size, first.length);
  assert.ok(first.some(item => item.kind === "line" && item.voice === "us-f2"));
  assert.ok(first.some(item => item.kind === "dictation" && item.text === "J, A, M, E, S."));

  /* La historia y Matilda van con emoción; vocabulario y dictados, con la voz estable. */
  assert.ok(first.filter(item => ["line", "coach", "roleplay"].includes(item.kind)).every(item => item.model === EXPRESSIVE_MODEL && item.rate === null));
  assert.ok(first.filter(item => ["term", "dictation", "hear"].includes(item.kind)).every(item => item.model === STEADY_MODEL && item.rate === 0.85));
  const laugh = first.find(item => item.text.startsWith("You have..."));
  assert.match(laugh.say, /\[laughs\]/);
  assert.doesNotMatch(laugh.text, /\[/);
  /* El entrenamiento del oído genera la misma frase en cada voz. */
  assert.equal(first.filter(item => item.kind === "hear" && item.text === "The letter E.").length, 2);

  const edited = structuredClone(lesson);
  edited.listening.lines[0].text = "Good afternoon! Welcome to Bright Start English School.";
  edited.listening.lines[0].say = "[cheerfully] Good afternoon! Welcome to Bright Start English School.";
  const changed = lessonAudioScript(edited);
  assert.notEqual(changed.find(item => item.kind === "line").key, first.find(item => item.kind === "line").key);
});
