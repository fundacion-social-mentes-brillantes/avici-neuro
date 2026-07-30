export const COURSE_ENGINE_VERSION = "catalog-2026.07-v3";

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
// Mazarrasa conserva enorme valor formativo, pero su edición es anterior a muchas
// guías, calendarios, sistemas sanitarios y datos epidemiológicos vigentes.
const CURRENT_MAZARRASA = new Set(Array.from({ length: 77 }, (_, index) => index + 1));
const BOOK_PREFIX = { thibodeau: "th", mazarrasa: "mz", vacunador: "vac" };

function makeLesson(bookId, row, pageEnd) {
  const [chapter, title, pageStart] = row;
  const freshness = (bookId === "thibodeau" ? CURRENT_THIBODEAU : CURRENT_MAZARRASA).has(chapter)
    ? "revisar-hoy"
    : "estable";
  return {
    id: `${BOOK_PREFIX[bookId] || bookId.slice(0, 3)}-c${String(chapter).padStart(2, "0")}`,
    chapter,
    title,
    objective: `Comprender, explicar y aplicar los conceptos centrales del capítulo ${chapter} con apoyo directo de la fuente original.`,
    topics: topicWords(title),
    pageStart,
    pageEnd,
    freshness,
  };
}

// El Manual del vacunador (GCBA, 3.ª edición, 2013) tiene 43 entradas útiles
// en su índice. Varias ocupan solo una página, por lo que se agrupan en
// 26 lecciones con suficiente evidencia para explicar y evaluar sin rellenar
// huecos. Los rangos usan la página interna del PDF: la numeración impresa
// del manual está desplazada +1.
const VACUNADOR_LESSONS = [
  [1, "Leer el calendario sin confundir edición y vigencia", 6, 7, [1], "Interpretar el calendario incluido en la edición de 2013 y detectar qué datos deben verificarse en la fuente oficial vigente."],
  [2, "Componentes, tipos y familias de vacunas", 8, 12, [2], "Explicar cómo esta edición clasifica antígenos, adyuvantes, vacunas vivas, inactivadas y combinadas."],
  [3, "Intervalos, simultaneidad y esquemas interrumpidos", 13, 18, [2], "Razonar sobre los principios que presenta el manual para intervalos y recupero de esquemas, sin convertirlos en una indicación vigente."],
  [4, "Vías, sitios y preparación de la administración", 19, 24, [2], "Reconocer las técnicas y controles previos descritos por la edición, identificando qué debe confirmarse antes de una práctica real."],
  [5, "Precauciones, contraindicaciones y prematuridad", 25, 26, [2], "Distinguir las precauciones y situaciones especiales que describe el manual y practicar una lectura clínica prudente."],
  [6, "Cadena de frío: organización y almacenamiento", 27, 31, [3], "Construir un mapa del recorrido, los equipos y la organización de la cadena de frío presentada en la edición."],
  [7, "Cadena de frío: incidentes, transporte y frascos abiertos", 32, 36, [3], "Analizar incidentes de conservación descritos por el manual y reconocer cuándo corresponde aislar y escalar una desviación."],
  [8, "Bioseguridad en el vacunatorio", 37, 42, [4], "Aplicar los principios de higiene, cortopunzantes, residuos y preparación segura que desarrolla esta edición."],
  [9, "Hepatitis B y BCG", 43, 48, [5, 6], "Comparar cómo la edición de 2013 caracteriza Hepatitis B y BCG, sus componentes, administración y precauciones."],
  [10, "Poliomielitis: OPV e IPV", 49, 52, [7, 8], "Contrastar los perfiles de OPV e IPV descritos por el manual y reconocer por qué el esquema requiere consulta actual."],
  [11, "Pentavalente, cuádruple y Hib", 53, 58, [9, 10, 11], "Relacionar las combinaciones antigénicas y usos que la edición atribuye a pentavalente, cuádruple y Hib."],
  [12, "Difteria, tétanos y pertussis", 59, 66, [12, 13, 14, 15], "Diferenciar las formulaciones bacterianas que presenta el manual y organizar sus similitudes y diferencias."],
  [13, "Vacunas neumocócicas", 67, 70, [16, 17], "Comparar las vacunas neumocócicas conjugada y polisacárida según esta edición y separar esos datos de las recomendaciones actuales."],
  [14, "Influenza y Hepatitis A", 71, 77, [18, 19], "Explicar los perfiles de influenza y Hepatitis A incluidos en la edición y localizar sus puntos sensibles al tiempo."],
  [15, "Triple viral y doble viral", 78, 81, [20, 21], "Relacionar las vacunas triple y doble viral tal como aparecen en el manual, sin asumir que sus esquemas siguen vigentes."],
  [16, "VPH y vacuna séxtuple", 82, 85, [22, 23], "Reconocer la descripción histórica de VPH y séxtuple y practicar la verificación de cambios posteriores."],
  [17, "Rotavirus y varicela", 86, 89, [24, 25], "Comparar composición, administración y precauciones descritas para rotavirus y varicela en esta edición."],
  [18, "Vacunas meningocócicas", 90, 92, [26, 27], "Distinguir las formulaciones meningocócicas C y tetravalente que documenta el manual."],
  [19, "Rabia, fiebre hemorrágica argentina y fiebre amarilla", 93, 98, [28, 29, 30], "Organizar las vacunas ligadas a exposición, territorio o viaje según la edición, marcando cada dato que exige actualización."],
  [20, "Gammaglobulinas y PPD", 99, 105, [31, 32], "Explicar el papel que el manual asigna a inmunoglobulinas y PPD y diferenciar profilaxis, prueba diagnóstica e inmunización."],
  [21, "Vacunación en adolescentes y adultos", 106, 107, [33, 34], "Analizar las recomendaciones de la edición para adolescencia y adultez como documento histórico, no como calendario actual."],
  [22, "Embarazo, puerperio y personal de salud", 108, 109, [35, 36], "Comparar las consideraciones que esta edición propone para embarazo, puerperio y personal sanitario."],
  [23, "Vacunación y VIH", 110, 112, [37], "Razonar sobre las precauciones descritas para personas con VIH y reconocer la necesidad de evaluación y guías vigentes."],
  [24, "ESAVI y vigilancia postvacunación", 113, 121, [38], "Clasificar eventos y errores programáticos según el manual, y comprender por qué la notificación debe seguir el sistema actual."],
  [25, "Anafilaxia: reconocer, activar y verificar", 122, 124, [39], "Reconocer la emergencia descrita por la edición y aprender a contrastar cualquier conducta con el protocolo vigente del servicio."],
  [26, "Red, fuentes y marco legal de la edición", 125, 130, [40, 41, 42, 43], "Leer directorios, enlaces y normativa como archivo de 2013 y saber dónde buscar información oficial actual."],
];

const VACUNADOR_UNITS = [
  ["Pensar antes de aplicar", "🧭", 1, 5],
  ["Conservar y trabajar seguro", "🧊", 6, 8],
  ["Inmunizaciones esenciales", "🛡️", 9, 13],
  ["Virales y vacunas combinadas", "🧬", 14, 18],
  ["Exposición y apoyo inmunológico", "🧪", 19, 20],
  ["Personas y situaciones especiales", "👥", 21, 23],
  ["Vigilancia y respuesta segura", "🚨", 24, 25],
  ["Red y marco histórico", "🗺️", 26, 26],
];

function vacunadorCourse() {
  const lessons = VACUNADOR_LESSONS.map(([chapter, title, pageStart, pageEnd, sourceSections, objective]) => ({
    id: `vac-l${String(chapter).padStart(2, "0")}`,
    chapter,
    title,
    objective,
    topics: topicWords(title),
    pageStart,
    pageEnd,
    sourceSections,
    freshness: "revisar-hoy",
    sourceStatus: "historical-clinical",
  }));
  const units = VACUNADOR_UNITS.map(([title, emoji, first, last]) => ({
    title,
    emoji,
    lessons: lessons.filter(lesson => lesson.chapter >= first && lesson.chapter <= last),
  }));
  return {
    version: COURSE_ENGINE_VERSION,
    source: "Índice visual verificado del PDF · 3.ª edición, 2013",
    title: "Sala de Inmunización — aprender con criterio y seguridad",
    subtitle: "8 misiones · 26 lecciones · cobertura completa de 43 secciones del manual",
    expectedChapters: 26,
    expectedSections: 43,
    expectedPageStart: 6,
    expectedPageEnd: 130,
    itemLabel: "lecciones",
    theme: "vaccination-lab",
    notice: {
      title: "Edición clínica histórica: aprender no es aplicar",
      text: "El manual fue publicado en 2013. Sus calendarios, esquemas, dosis, intervalos, productos, contactos y normas pueden haber cambiado. AVICI enseña fielmente esta edición, pero las decisiones reales deben comprobarse en fuentes oficiales vigentes.",
    },
    units,
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
    expectedPageStart: 23,
    expectedPageEnd: 1243,
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
    expectedPageStart: 36,
    expectedPageEnd: 1947,
    units,
  };
}

const BUILDERS = {
  thibodeau: thibodeauCourse,
  mazarrasa: mazarrasaCourse,
  vacunador: vacunadorCourse,
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
  const coveredSections = new Set(
    lessons.flatMap(lesson => Array.isArray(lesson.sourceSections) ? lesson.sourceSections : []),
  );
  const expectedSections = Number(course?.expectedSections) || 0;
  const sourceCoverageComplete = !expectedSections
    || (coveredSections.size === expectedSections
      && Array.from({ length: expectedSections }, (_, index) => index + 1).every(section => coveredSections.has(section)));
  const pageRangesValid = lessons.every(lesson => Number.isInteger(lesson.pageStart)
    && Number.isInteger(lesson.pageEnd)
    && lesson.pageStart > 0
    && lesson.pageEnd >= lesson.pageStart);
  const pagesMonotonic = lessons.every((lesson, index) => index === 0 || lesson.pageStart > lessons[index - 1].pageStart);
  const pagesContiguous = lessons.every((lesson, index) => index === 0 || lesson.pageStart === lessons[index - 1].pageEnd + 1);
  const expectedPageStart = Number(course?.expectedPageStart) || 0;
  const expectedPageEnd = Number(course?.expectedPageEnd) || 0;
  const pageBoundsValid = (!expectedPageStart || lessons[0]?.pageStart === expectedPageStart)
    && (!expectedPageEnd || lessons.at(-1)?.pageEnd === expectedPageEnd);
  const sequenceComplete = chapters.every((chapter, index) => chapter === index + 1);
  return {
    lessons: lessons.length,
    uniqueChapters: unique.size,
    expectedChapters: course?.expectedChapters || 0,
    coveredSections: coveredSections.size,
    expectedSections,
    sourceCoverageComplete,
    complete: unique.size === course?.expectedChapters
      && sequenceComplete
      && ids.size === lessons.length
      && pageRangesValid
      && pagesMonotonic
      && pagesContiguous
      && pageBoundsValid
      && sourceCoverageComplete,
    stableIds: ids.size === lessons.length,
    sequenceComplete,
    pageRangesValid,
    pagesMonotonic,
    pagesContiguous,
    pageBoundsValid,
  };
}
