export const COURSE_ENGINE_VERSION = "catalog-2026.07-v2";

const STOPWORDS = new Set([
  "para", "como", "sobre", "entre", "desde", "hasta", "hacia", "durante", "contra",
  "ante", "bajo", "con", "por", "del", "las", "los", "una", "unos", "unas", "salud",
  "sistema", "sistemas", "atencion", "integral", "introduccion", "enfermeria",
]);

function topicWords(title) {
  const words = String(title || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 3 && !STOPWORDS.has(word));
  return [...new Set([title, ...words])].slice(0, 7);
}

const THIBODEAU_UNITS = [
  ["El cuerpo como un todo", "🧬", [
    [1, "Organización del cuerpo", 23],
    [2, "Bases químicas de la vida", 55],
    [3, "Anatomía celular", 95],
    [4, "Fisiología celular", 120],
    [5, "Tejidos", 162],
  ]],
  ["Soporte y movimiento", "🦴", [
    [6, "La piel y sus anejos", 212],
    [7, "Tejidos esqueléticos", 246],
    [8, "Sistema esquelético", 272],
    [9, "Articulaciones", 328],
    [10, "Anatomía del sistema muscular", 364],
    [11, "Fisiología del sistema muscular", 411],
  ]],
  ["Comunicación, control e integración", "🧠", [
    [12, "Células del sistema nervioso", 447],
    [13, "Sistema nervioso central", 487],
    [14, "Sistema nervioso periférico", 531],
    [15, "Órganos de los sentidos", 569],
    [16, "Sistema endocrino", 609],
  ]],
  ["Transporte y defensa", "🫀", [
    [17, "Sangre", 663],
    [18, "Anatomía del sistema cardiovascular", 693],
    [19, "Fisiología del sistema cardiovascular", 749],
    [20, "Sistema linfático", 795],
    [21, "Sistema inmunitario", 817],
    [22, "Estrés", 855],
  ]],
  ["Respiración, nutrición y excreción", "🫁", [
    [23, "Anatomía del sistema respiratorio", 871],
    [24, "Fisiología del sistema respiratorio", 899],
    [25, "Anatomía del sistema digestivo", 941],
    [26, "Fisiología del sistema digestivo", 977],
    [27, "Nutrición y metabolismo", 1009],
    [28, "Sistema urinario", 1049],
    [29, "Equilibrio hidroelectrolítico", 1083],
    [30, "Equilibrio acidobásico", 1105],
  ]],
  ["Reproducción y desarrollo", "🧬", [
    [31, "Sistema reproductor masculino", 1125],
    [32, "Sistema reproductor femenino", 1145],
    [33, "Crecimiento y desarrollo", 1177],
    [34, "Genética y herencia", 1214],
  ]],
];

const MAZARRASA_CHAPTERS = [
  [1, "El proceso salud-enfermedad. Evolución histórica", 36],
  [2, "Salud y enfermedad. Una visión antropológica", 48],
  [3, "Salud pública y enfermería comunitaria", 62],
  [4, "La evolución del modelo sanitario español y sus repercusiones en la profesión de enfermería", 122],
  [5, "Salud y sociedad. Los sistemas sanitarios", 200],
  [6, "La investigación en salud", 224],
  [7, "Análisis de la situación de salud en una comunidad: una propuesta de investigación-acción participativa", 256],
  [8, "Introducción a la metodología de la investigación en enfermería comunitaria", 354],
  [9, "La documentación en enfermería comunitaria", 366],
  [10, "Salud internacional", 378],
  [11, "Desigualdades sociales en la salud", 394],
  [12, "Promoción de la salud", 410],
  [13, "Educación para la salud: concepto actual y ámbitos de aplicación", 430],
  [14, "Participación comunitaria en la salud", 448],
  [15, "Paradigmas y modelos en educación para la salud", 486],
  [16, "Programación y evaluación en educación para la salud", 512],
  [17, "Educación para la salud en la escuela", 538],
  [18, "Género y salud", 564],
  [19, "Situación mundial en salud, papel social del Estado y política sanitaria", 586],
  [20, "El sistema sanitario y el Sistema Nacional de Salud en España", 618],
  [21, "Atención primaria de salud", 640],
  [22, "Administración sanitaria: modelos organizativos y gestión", 668],
  [23, "Planificación y programación sanitaria", 690],
  [24, "Evaluación en planificación y programación sanitaria", 716],
  [25, "Economía de la salud y salud pública", 734],
  [26, "El papel de la Bioestadística en las Ciencias de la Salud", 756],
  [27, "Demografía", 766],
  [28, "Medición en epidemiología: precisión, validez y causalidad", 806],
  [29, "Tipos de estudios epidemiológicos y estudios experimentales", 826],
  [30, "Estudios observacionales", 842],
  [31, "Epidemiología y control de las enfermedades transmisibles", 864],
  [32, "Epidemiología de las enfermedades crónicas no transmisibles", 898],
  [33, "Epidemiología del cáncer", 910],
  [34, "Farmacoepidemiología", 930],
  [35, "Elaboración y desarrollo de un proyecto de investigación epidemiológica", 942],
  [36, "Herramientas informáticas en epidemiología", 950],
  [37, "Salud, comunidad e intervención comunitaria", 968],
  [38, "Salud ambiental", 988],
  [39, "Determinantes biológicos en los procesos de salud y enfermedad", 1006],
  [40, "Medio ambiente y salud: contaminación atmosférica, ruido y radiaciones", 1028],
  [41, "Aguas de consumo público", 1052],
  [42, "Aguas residuales", 1084],
  [43, "Medio ambiente y salud: residuos sólidos", 1112],
  [44, "Salud, urbanismo, vivienda y entorno", 1152],
  [45, "Prevención de emergencias y catástrofes", 1168],
  [46, "Seguridad y prevención de accidentes", 1182],
  [47, "Violencia de género", 1206],
  [48, "Alimentación y salud", 1232],
  [49, "Higiene alimentaria y salud", 1264],
  [50, "Salud y trabajo", 1288],
  [51, "Vigilancia de alteraciones de salud relacionadas con el trabajo", 1310],
  [52, "Salud laboral en el ámbito agrícola", 1338],
  [53, "El equipo de atención primaria de salud", 1358],
  [54, "Modalidades de atención y organización de enfermería en atención primaria", 1376],
  [55, "Metodología del trabajo enfermero en la comunidad", 1400],
  [56, "La visita domiciliaria", 1420],
  [57, "El sistema informal de cuidados en la atención a la salud", 1438],
  [58, "Atención integral a la mujer durante el embarazo y el puerperio", 1456],
  [59, "Salud sexual y reproductiva", 1492],
  [60, "Atención a la salud de las mujeres adultas", 1524],
  [61, "Atención a la salud infantil", 1536],
  [62, "Salud escolar", 1574],
  [63, "La adolescencia", 1598],
  [64, "Programa de vacunas", 1622],
  [65, "Atención integral a los enfermos crónicos", 1646],
  [66, "Salud de la población inmigrante", 1666],
  [67, "Atención integral a las personas con hipertensión arterial", 1696],
  [68, "Atención integral a pacientes diabéticos", 1722],
  [69, "Atención integral en la enfermedad pulmonar obstructiva crónica", 1744],
  [70, "Atención integral en problemas osteoarticulares", 1758],
  [71, "Atención integral en salud mental y psiquiatría", 1786],
  [72, "Drogodependencias desde una perspectiva comunitaria", 1818],
  [73, "Infecciones de transmisión sexual y SIDA", 1850],
  [74, "Tuberculosis", 1868],
  [75, "Vejez: demografía, salud, actitudes y atención social", 1894],
  [76, "Promoción de la salud en personas mayores", 1908],
  [77, "Cuidados paliativos", 1920],
];

const MAZARRASA_UNITS = [
  ["Fundamentos de salud pública", "🌍", 1, 5],
  ["Investigación, equidad y promoción", "🔎", 6, 18],
  ["Sistemas, gestión y atención primaria", "🏥", 19, 25],
  ["Epidemiología: principios y métodos", "📊", 26, 37],
  ["Ambiente, alimentación y seguridad", "🌱", 38, 49],
  ["Trabajo enfermero y cuidados comunitarios", "🤝", 50, 57],
  ["Mujer, infancia y adolescencia", "🌸", 58, 64],
  ["Crónicos y poblaciones diversas", "🩺", 65, 70],
  ["Salud mental, infecciones, vejez y paliativos", "🫶", 71, 77],
];

const CURRENT_THIBODEAU = new Set([16, 19, 21, 22, 24, 27, 29, 30, 33, 34]);
const CURRENT_MAZARRASA = new Set([
  4, 5, 9, 10, 19, 20, 21, 22, 23, 24, 25, 31, 32, 33, 34, 36,
  40, 41, 42, 43, 45, 46, 47, 48, 49, 50, 51, 52, 58, 59, 60, 61,
  62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77,
]);

function makeLesson(bookId, row, pageEnd) {
  const [chapter, title, pageStart] = row;
  const freshness = (bookId === "thibodeau" ? CURRENT_THIBODEAU : CURRENT_MAZARRASA).has(chapter)
    ? "revisar-hoy"
    : "estable";
  return {
    id: `${bookId === "thibodeau" ? "th" : "mz"}-c${String(chapter).padStart(2, "0")}`,
    chapter,
    title,
    objective: `Comprender, explicar y aplicar los conceptos centrales del capítulo ${chapter} con apoyo directo de la fuente original.`,
    topics: topicWords(title),
    pageStart,
    pageEnd,
    freshness,
  };
}

function materializeRows(bookId, rows, finalPage) {
  return rows.map((row, index) => makeLesson(bookId, row, (rows[index + 1]?.[2] || (finalPage + 1)) - 1));
}

function thibodeauCourse() {
  const flat = THIBODEAU_UNITS.flatMap(unit => unit[2]);
  const lessons = materializeRows("thibodeau", flat, 1243);
  let cursor = 0;
  const units = THIBODEAU_UNITS.map(([title, emoji, rows]) => {
    const unitLessons = lessons.slice(cursor, cursor + rows.length);
    cursor += rows.length;
    return { title, emoji, lessons: unitLessons };
  });
  return {
    version: COURSE_ENGINE_VERSION,
    source: "Índice visual verificado del PDF",
    title: "Anatomía y Fisiología — ruta completa hacia la neurocirugía",
    subtitle: "6 unidades · 34 capítulos · de la célula al organismo completo",
    expectedChapters: 34,
    units,
  };
}

function mazarrasaCourse() {
  const lessons = materializeRows("mazarrasa", MAZARRASA_CHAPTERS, 1947);
  const units = MAZARRASA_UNITS.map(([title, emoji, first, last]) => ({
    title,
    emoji,
    lessons: lessons.filter(lesson => lesson.chapter >= first && lesson.chapter <= last),
  }));
  return {
    version: COURSE_ENGINE_VERSION,
    source: "Índice visual y marcadores verificados del PDF",
    title: "Salud Pública y Enfermería Comunitaria — ruta completa",
    subtitle: "9 trayectos · 77 capítulos · fundamentos, método y práctica comunitaria",
    expectedChapters: 77,
    units,
  };
}

const BUILDERS = {
  thibodeau: thibodeauCourse,
  mazarrasa: mazarrasaCourse,
};

export function getCuratedCourse(bookId) {
  const build = BUILDERS[bookId];
  return build ? build() : null;
}

export function courseAudit(course) {
  const lessons = (course?.units || []).flatMap(unit => unit.lessons || []);
  const chapters = lessons.map(lesson => lesson.chapter).filter(Number.isInteger);
  const unique = new Set(chapters);
  const ids = new Set(lessons.map(lesson => lesson.id));
  const pageRangesValid = lessons.every(lesson => Number.isInteger(lesson.pageStart)
    && Number.isInteger(lesson.pageEnd)
    && lesson.pageStart > 0
    && lesson.pageEnd >= lesson.pageStart);
  const pagesMonotonic = lessons.every((lesson, index) => index === 0 || lesson.pageStart > lessons[index - 1].pageStart);
  const sequenceComplete = chapters.every((chapter, index) => chapter === index + 1);
  return {
    lessons: lessons.length,
    uniqueChapters: unique.size,
    expectedChapters: course?.expectedChapters || 0,
    complete: unique.size === course?.expectedChapters
      && sequenceComplete
      && ids.size === lessons.length
      && pageRangesValid
      && pagesMonotonic,
    stableIds: ids.size === lessons.length,
    sequenceComplete,
    pageRangesValid,
    pagesMonotonic,
  };
}
