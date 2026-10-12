// ===== Ruta verificada del curso de inglés: A1 → C1 =====
//
// En los libros, la ruta es verificable porque cada lección cubre un rango exacto de
// páginas y la auditoría comprueba que no falte ningún capítulo. Un curso de idiomas no
// tiene páginas: su "fuente" es el inventario de cada nivel del Marco Común Europeo
// (gramática, funciones comunicativas, pronunciación y tipos de texto, siguiendo el
// English Profile de Cambridge y las especificaciones de A2 Key, B1 Preliminary,
// B2 First y C1 Advanced). La auditoría exige que cada punto del inventario de un nivel
// lo enseñe al menos una lección de ese nivel, que cada unidad trabaje las cuatro
// habilidades y que ninguna lección cite un punto que no existe.
//
// Desde B2 la ruta se muestra en inglés: la inmersión empieza por el propio mapa.

export const ENGLISH_COURSE_VERSION = "english-2026.10-v1";
export const ENGLISH_BOOK_ID = "ingles";

export const ENGLISH_FOCUS = ["listening", "reading", "speaking", "writing", "grammar", "vocabulary", "pronunciation"];

/* Los acentos entran de a poco: en A1 solo se oye inglés estadounidense (el modelo del
   curso), el británico llega en A2, el australiano en B2 y el resto en C1. Entender
   acentos distintos es parte de llegar a C1, pero de golpe en A1 solo frustra. */

/* El elenco de la historia que atraviesa el curso ("Bright Start", ver english/METODO.md).
   Un personaje suena siempre con la misma voz: la verificación lo exige, porque si Daniel
   cambia de voz entre lecciones deja de ser Daniel. `from` es el nivel en que aparece. */
export const ENGLISH_CAST = {
  Matilda: { voice: "us-f1", from: "a1", role: "coach del curso: explica, anima y comenta cada episodio con humor" },
  Daniel: { voice: "us-m1", from: "a1", role: "colombiano de Medellín que llega a Chicago; comete los errores típicos del hispanohablante" },
  Emma: { voice: "us-f2", from: "a1", role: "recepcionista de la escuela; humor seco, amable" },
  "Mr. Clark": { voice: "us-m3", from: "a1", role: "profesor de Daniel; chistes malos y amor por la gramática" },
  Oliver: { voice: "uk-m1", from: "a2", role: "compañero de apartamento londinense; té, fútbol y sarcasmo británico" },
  Marcus: { voice: "us-m2", from: "b1", role: "dueño de la panadería donde trabaja Daniel; dejó un banco para hornear" },
  Grace: { voice: "uk-f1", from: "b2", role: "presentadora del pódcast Second Chances" },
  Chloe: { voice: "au-f1", from: "b2", role: "locutora de radio australiana, amiga de Grace" },
};
const CORE_SKILLS = ["listening", "reading", "speaking"];

/* Reglas de exigencia. Están acá, y no repartidas por la app, para que sean una sola
   decisión visible: subir la vara es cambiar un número. */
export const ENGLISH_RULES = {
  lessonMastery: 80,          // % mínimo para dar por dominada una lección
  checkpointPass: 80,         // % mínimo en el examen de cada unidad
  levelExamPassEach: 75,      // % mínimo en CADA sección del examen de nivel: no se compensa
  maxOverdueReviews: 40,      // con más repasos vencidos que esto, no se abre contenido nuevo
};

const LEVELS = [
  {
    id: "a1", cefr: "A1", stage: "Básico", name: "Básico 1", emoji: "🌱",
    explanationLanguage: "es", speechRate: 0.85, accents: ["us"],
    listeningWords: [60, 180], readingWords: [80, 220], writingWords: [30, 80], speakingSeconds: [30, 60],
    guidedHours: 90, immersionHours: 10,
    summary: "Presentarte, hablar de tu vida diaria y resolver situaciones simples.",
  },
  {
    id: "a2", cefr: "A2", stage: "Básico", name: "Básico 2", emoji: "🌿",
    explanationLanguage: "es", speechRate: 0.9, accents: ["us", "uk"],
    listeningWords: [120, 300], readingWords: [150, 350], writingWords: [60, 110], speakingSeconds: [45, 90],
    guidedHours: 100, immersionHours: 25,
    summary: "Contar experiencias, comparar, planear y desenvolverte en viajes.",
  },
  {
    id: "b1", cefr: "B1", stage: "Intermedio", name: "Intermedio 1", emoji: "🔥",
    explanationLanguage: "es-en", speechRate: 1, accents: ["us", "uk"],
    listeningWords: [250, 500], readingWords: [300, 550], writingWords: [100, 140], speakingSeconds: [60, 120],
    guidedHours: 180, immersionHours: 50,
    summary: "Opinar, narrar con soltura, imaginar situaciones y resolver problemas reales.",
  },
  {
    id: "b2", cefr: "B2", stage: "Intermedio", name: "Upper-Intermediate", emoji: "⚡",
    explanationLanguage: "en", speechRate: 1, accents: ["us", "uk", "au"],
    listeningWords: [400, 750], readingWords: [500, 800], writingWords: [140, 190], speakingSeconds: [60, 180],
    guidedHours: 200, immersionHours: 80,
    summary: "Argue, negotiate, present and follow native speakers at natural speed.",
  },
  {
    id: "c1", cefr: "C1", stage: "Avanzado", name: "Advanced", emoji: "🏆",
    explanationLanguage: "en", speechRate: 1, accents: ["us", "uk", "au", "ie", "sco", "in", "za"],
    listeningWords: [600, 1100], readingWords: [700, 1100], writingWords: [220, 260], speakingSeconds: [60, 240],
    guidedHours: 230, immersionHours: 120,
    summary: "Use English flexibly and precisely for social, academic and professional life.",
  },
];

/* ---------- Inventario por nivel: lo que el nivel DEBE enseñar ---------- */

const INVENTORY = {
  a1: {
    grammar: {
      "a1.be": "Verbo to be en presente: afirmativa, negativa, preguntas y respuestas cortas",
      "a1.subject-pronouns": "Pronombres sujeto (I, you, he, she, it, we, they)",
      "a1.wh-questions": "Preguntas con what, where, who, how old, how many…",
      "a1.articles": "Artículos a, an y the en usos básicos",
      "a1.plurals": "Plurales regulares e irregulares",
      "a1.demonstratives": "This, that, these, those",
      "a1.possessive-adjectives": "Adjetivos posesivos (my, your, his, her…)",
      "a1.possessive-s": "Genitivo sajón ('s) para indicar posesión",
      "a1.present-simple": "Presente simple con I/you/we/they: afirmativa, negativa y preguntas con do",
      "a1.adjectives": "Posición del adjetivo y very",
      "a1.have": "Have/has para posesión y descripciones",
      "a1.present-simple-third": "Presente simple con he/she/it: -s, -es, does/doesn't",
      "a1.frequency-adverbs": "Adverbios de frecuencia y su posición",
      "a1.prepositions-time": "Preposiciones de tiempo at, on, in",
      "a1.there-is": "There is / there are",
      "a1.prepositions-place": "Preposiciones de lugar",
      "a1.imperatives": "Imperativo afirmativo y negativo",
      "a1.can": "Can/can't para habilidad, posibilidad y permiso",
      "a1.conjunctions": "Conectores and, but, or",
      "a1.countable": "Sustantivos contables e incontables",
      "a1.some-any": "Some y any",
      "a1.would-like": "Would like para pedir y ofrecer",
      "a1.how-much-many": "How much / how many",
      "a1.like-ing": "Like, love, hate, don't mind + -ing",
      "a1.object-pronouns": "Pronombres objeto (me, him, her, us, them)",
      "a1.sequencers": "Secuenciadores first, then, after that, finally",
      "a1.present-continuous": "Presente continuo para acciones en curso",
      "a1.simple-vs-continuous": "Presente simple frente a presente continuo",
      "a1.past-be": "Was / were",
      "a1.past-regular": "Pasado simple de verbos regulares; negativas y preguntas con did",
      "a1.past-irregular": "Pasado simple de verbos irregulares frecuentes",
      "a1.going-to": "Be going to para planes",
      "a1.lets": "Let's para sugerencias",
      "a1.question-order": "Orden de las palabras en las preguntas",
    },
    functions: {
      "a1.f.greet": "Saludar, presentarse y despedirse",
      "a1.f.spell": "Deletrear nombres y palabras",
      "a1.f.personal-info": "Dar y pedir datos personales",
      "a1.f.numbers": "Entender y decir números, teléfonos y correos",
      "a1.f.identify": "Identificar y nombrar objetos",
      "a1.f.family": "Hablar de la familia",
      "a1.f.jobs": "Hablar del trabajo y los estudios",
      "a1.f.describe-people": "Describir el aspecto de una persona",
      "a1.f.routines": "Describir rutinas",
      "a1.f.time": "Decir y preguntar la hora",
      "a1.f.free-time": "Hablar del tiempo libre y de la frecuencia",
      "a1.f.describe-home": "Describir la vivienda",
      "a1.f.location": "Ubicar objetos y lugares",
      "a1.f.directions": "Pedir y dar indicaciones sencillas",
      "a1.f.ability": "Hablar de habilidades",
      "a1.f.requests": "Pedir permiso y favores sencillos",
      "a1.f.describe-town": "Describir una ciudad",
      "a1.f.food": "Hablar de comida y bebida",
      "a1.f.ordering": "Pedir en un café o restaurante",
      "a1.f.shopping": "Comprar y preguntar precios",
      "a1.f.likes": "Expresar gustos y preferencias",
      "a1.f.instructions": "Dar y seguir instrucciones paso a paso",
      "a1.f.describe-now": "Describir lo que está pasando",
      "a1.f.weather": "Hablar del clima",
      "a1.f.dates": "Decir fechas y ubicarse en el tiempo",
      "a1.f.past-events": "Contar hechos pasados",
      "a1.f.plans": "Hablar de planes",
      "a1.f.invitations": "Invitar, aceptar y rechazar",
      "a1.f.ask-info": "Pedir información con preguntas bien formadas",
      "a1.f.travel": "Resolver situaciones básicas de viaje",
    },
    pronunciation: {
      "a1.p.alphabet": "El alfabeto en inglés (a, e, i, g, j: las letras que más se confunden)",
      "a1.p.word-stress": "Acento de palabra en nacionalidades y palabras frecuentes",
      "a1.p.teens-tens": "Thirteen frente a thirty: el acento que cambia el número",
      "a1.p.short-long-i": "/ɪ/ frente a /iː/ (this/these, ship/sheep)",
      "a1.p.contractions": "Contracciones (I'm, you're, it's, isn't)",
      "a1.p.th": "Los sonidos /θ/ y /ð/",
      "a1.p.s-clusters": "S inicial sin «e» delante (student, Spain, school)",
      "a1.p.h": "/h/ suave, distinta de la jota española",
      "a1.p.third-person-s": "Terminación -s: /s/, /z/, /ɪz/",
      "a1.p.weak-forms": "Formas débiles (do you, some, of, to)",
      "a1.p.linking": "Enlace consonante-vocal (there_is_a)",
      "a1.p.b-v": "/b/ y /v/: dos sonidos distintos en inglés",
      "a1.p.question-intonation": "Entonación de preguntas wh- y de sí/no",
      "a1.p.can-cant": "Can /kən/ frente a can't /kænt/",
      "a1.p.sentence-stress": "Acento de frase: las palabras importantes suenan más fuerte",
      "a1.p.polite-intonation": "Entonación amable para pedir y ofrecer",
      "a1.p.ng": "El sonido /ŋ/ al final de -ing",
      "a1.p.was-were": "Was y were en forma débil y fuerte",
      "a1.p.ed-endings": "Terminación -ed: /t/, /d/, /ɪd/",
      "a1.p.gonna": "Going to en el habla natural",
    },
    writing: {
      "a1.w.form": "Formulario con datos personales",
      "a1.w.routine": "Párrafo sobre tu rutina (40–60 palabras)",
      "a1.w.message": "Mensaje corto a un amigo",
      "a1.w.instructions": "Instrucciones paso a paso",
      "a1.w.postcard": "Postal sobre un viaje",
      "a1.w.profile": "Perfil personal (unas 80 palabras)",
    },
  },
  a2: {
    grammar: {
      "a2.past-simple-review": "Pasado simple: preguntas, negativas e irregulares ampliados",
      "a2.past-continuous": "Pasado continuo con when y while",
      "a2.linkers-sequence": "Conectores de secuencia y tiempo (when, then, suddenly, in the end)",
      "a2.time-expressions": "Expresiones de tiempo pasado (ago, in, for, during)",
      "a2.look-like": "What is she like? frente a What does she look like?",
      "a2.comparatives": "Comparativos",
      "a2.superlatives": "Superlativos",
      "a2.articles": "Artículos con lugares, superlativos y generalizaciones",
      "a2.as-as": "As…as y not as…as",
      "a2.too-enough": "Too y enough",
      "a2.quantifiers": "Much, many, a lot of, a few, a little",
      "a2.adverbs-manner": "Adverbios de modo",
      "a2.present-perfect-experience": "Presente perfecto para experiencias (ever, never)",
      "a2.pp-vs-past": "Presente perfecto frente a pasado simple",
      "a2.just-already-yet": "Just, already, yet",
      "a2.prepositions-movement": "Preposiciones de movimiento",
      "a2.must-have-to": "Must, mustn't, have to, don't have to",
      "a2.should": "Should para consejos",
      "a2.verb-patterns": "Verbo + -ing y verbo + to",
      "a2.could-may": "Can, could y may para pedidos y permiso; could para habilidad pasada",
      "a2.infinitive-purpose": "Infinitivo de propósito (to + verbo)",
      "a2.because-so": "Because y so",
      "a2.will": "Will para predicciones",
      "a2.will-vs-going-to": "Will frente a going to",
      "a2.present-continuous-future": "Presente continuo para citas y planes fijos",
      "a2.zero-conditional": "Condicional cero",
      "a2.first-conditional": "Primer condicional",
      "a2.relative-clauses": "Oraciones de relativo con who, which, that, where",
      "a2.possessive-pronouns": "Pronombres posesivos y whose",
      "a2.indefinite-pronouns": "Something, anything, nothing, somebody…",
    },
    functions: {
      "a2.f.anecdotes": "Contar anécdotas",
      "a2.f.narrate": "Narrar una historia con contexto",
      "a2.f.biography": "Contar una biografía",
      "a2.f.describe-people": "Describir personalidad y aspecto",
      "a2.f.compare": "Comparar",
      "a2.f.choose": "Elegir entre opciones y justificar",
      "a2.f.lifestyle": "Hablar de hábitos de vida",
      "a2.f.recommend": "Recomendar",
      "a2.f.experiences": "Hablar de experiencias",
      "a2.f.news": "Dar novedades",
      "a2.f.travel": "Desenvolverse en viajes",
      "a2.f.rules": "Explicar normas",
      "a2.f.health": "Describir síntomas",
      "a2.f.advice": "Dar consejos",
      "a2.f.requests": "Pedir favores y permiso con cortesía",
      "a2.f.predictions": "Hacer predicciones",
      "a2.f.offers": "Ofrecer, prometer y decidir en el momento",
      "a2.f.arrangements": "Concertar citas",
      "a2.f.consequences": "Hablar de consecuencias",
      "a2.f.invitations": "Invitar y responder por escrito",
      "a2.f.paraphrase": "Explicar una palabra que no recuerdas",
      "a2.f.lost-property": "Reclamar objetos perdidos",
      "a2.f.phone": "Hablar por teléfono",
      "a2.f.complain": "Quejarse de un problema sencillo",
      "a2.f.describe-photo": "Describir una foto",
    },
    pronunciation: {
      "a2.p.connected-did": "Did you /dɪdʒu/ y otras uniones del habla rápida",
      "a2.p.weak-was": "Was /wəz/ en forma débil",
      "a2.p.stress-timing": "Ritmo del inglés: el acento marca el compás, no cada sílaba",
      "a2.p.word-stress-2-3": "Acento en palabras de dos y tres sílabas",
      "a2.p.schwa": "La schwa /ə/, el sonido más común del inglés",
      "a2.p.the": "The /ðə/ y /ðiː/",
      "a2.p.cut-cat-cart": "/ʌ/, /æ/ y /ɑː/ (cut, cat, cart)",
      "a2.p.contractions-have": "Contracciones 've y 's del presente perfecto",
      "a2.p.weak-have": "Have y has en forma débil",
      "a2.p.j-dj": "/dʒ/ frente a /j/ (job, yes, just, yet)",
      "a2.p.silent-letters": "Letras mudas (walk, flight, island)",
      "a2.p.intonation-interest": "Entonación para mostrar interés",
      "a2.p.have-to": "Have to /hæftə/",
      "a2.p.ll": "Contracción 'll",
      "a2.p.weak-to": "To /tə/ en forma débil",
      "a2.p.intonation-questions": "Entonación en preguntas para concertar planes",
      "a2.p.sh-ch": "/ʃ/ frente a /tʃ/ (shoes, choose)",
    },
    writing: {
      "a2.w.story": "Historia corta (80–100 palabras)",
      "a2.w.recommendation": "Recomendación de un lugar",
      "a2.w.informal-email": "Correo informal sobre un viaje",
      "a2.w.advice-note": "Mensaje con consejos",
      "a2.w.invitation": "Invitación y respuesta",
      "a2.w.experience": "Texto sobre una experiencia (unas 100 palabras)",
    },
  },
  b1: {
    grammar: {
      "b1.subject-object-questions": "Preguntas de sujeto y de objeto",
      "b1.indirect-questions": "Preguntas indirectas (Could you tell me where…?)",
      "b1.present-review": "Presente simple y continuo en profundidad",
      "b1.stative-verbs": "Verbos de estado",
      "b1.present-perfect-continuous": "Presente perfecto continuo, for y since",
      "b1.used-to": "Used to y didn't use to",
      "b1.phrasal-verbs": "Phrasal verbs separables e inseparables",
      "b1.ed-ing-adjectives": "Adjetivos en -ed y en -ing",
      "b1.linkers-addition": "Conectores de adición (also, as well, too, besides)",
      "b1.past-perfect": "Pasado perfecto",
      "b1.narrative-tenses": "Tiempos narrativos combinados",
      "b1.time-linkers": "As soon as, by the time, until, while",
      "b1.reported-statements": "Estilo indirecto: afirmaciones",
      "b1.reported-questions": "Estilo indirecto: preguntas, pedidos y órdenes",
      "b1.be-able-to": "Be able to y manage to",
      "b1.obligation-past": "Obligación y permiso en pasado (had to, be allowed to)",
      "b1.make-let-allow": "Make, let y allow",
      "b1.gerund-infinitive": "Gerundio e infinitivo",
      "b1.conditional-linkers": "Unless, as long as, as soon as, in case",
      "b1.suggestions": "Sugerencias (Why don't we…?, How about…?, Shall we…?)",
      "b1.second-conditional": "Segundo condicional",
      "b1.first-vs-second": "Primer frente a segundo condicional",
      "b1.deduction-present": "Deducción en presente (must, might, can't)",
      "b1.possibility": "May, might y could para posibilidad",
      "b1.look-seem": "Look, seem, look like, as if",
      "b1.so-such": "So y such",
      "b1.advice-forms": "If I were you, you'd better, ought to",
      "b1.contrast-linkers": "Although, even though, however",
      "b1.passive-simple": "Voz pasiva en presente y pasado simple",
      "b1.passive-more": "Voz pasiva con otros tiempos y con modales",
      "b1.quantifiers": "All, both, neither, either, none, each, every",
      "b1.relative-clauses": "Relativas con whose y con pronombre omitido",
      "b1.purpose": "To, in order to, so that",
      "b1.articles": "Artículos: usos generales y específicos",
      "b1.reflexive-pronouns": "Pronombres reflexivos y each other",
      "b1.question-tags": "Question tags",
      "b1.pp-review": "Presente perfecto frente a pasado: repaso avanzado",
      "b1.word-formation": "Formación de palabras con prefijos y sufijos",
    },
    functions: {
      "b1.f.get-to-know": "Conocer a alguien con preguntas naturales",
      "b1.f.describe-personality": "Describir la personalidad",
      "b1.f.life-changes": "Hablar de cambios y de duración",
      "b1.f.past-habits": "Hablar de hábitos pasados",
      "b1.f.relationships": "Hablar de relaciones",
      "b1.f.news-updates": "Contar novedades por escrito",
      "b1.f.storytelling": "Contar historias con orden y suspenso",
      "b1.f.react": "Reaccionar a lo que cuentan otros",
      "b1.f.recommend": "Recomendar una película o un libro",
      "b1.f.report": "Transmitir lo que otros dijeron",
      "b1.f.skills": "Hablar de capacidades y logros",
      "b1.f.rules": "Explicar normas y permisos",
      "b1.f.interview": "Responder en una entrevista",
      "b1.f.formal-requests": "Pedir información formalmente",
      "b1.f.advise": "Aconsejar",
      "b1.f.suggestions": "Proponer ideas",
      "b1.f.agree-disagree": "Estar de acuerdo y en desacuerdo",
      "b1.f.hypothetical": "Imaginar situaciones",
      "b1.f.dilemmas": "Discutir dilemas",
      "b1.f.speculate": "Especular sobre el presente",
      "b1.f.describe-photo": "Describir una foto especulando",
      "b1.f.opinion": "Dar y defender una opinión",
      "b1.f.describe-process": "Describir procesos",
      "b1.f.news": "Entender y dar noticias",
      "b1.f.environment": "Hablar del medio ambiente",
      "b1.f.describe-place": "Describir lugares",
      "b1.f.explain-purpose": "Explicar para qué sirve algo",
      "b1.f.complain": "Quejarse con cortesía",
      "b1.f.check-info": "Confirmar información",
      "b1.f.travel-problems": "Resolver problemas de viaje",
      "b1.f.money": "Hablar de dinero",
      "b1.f.paraphrase": "Parafrasear y explicar palabras",
    },
    pronunciation: {
      "b1.p.intonation-indirect": "Entonación de las preguntas indirectas",
      "b1.p.chunking": "Hablar en bloques de sentido con pausas naturales",
      "b1.p.weak-been": "Been /bɪn/ en forma débil",
      "b1.p.used-to": "Used to /juːstə/",
      "b1.p.phrasal-stress": "Acento en los phrasal verbs",
      "b1.p.had-contraction": "Contracción 'd de had",
      "b1.p.intonation-reactions": "Entonación de sorpresa e interés",
      "b1.p.vowel-er": "/ɝː/ (word, work, first)",
      "b1.p.final-consonants": "Consonantes finales que el hispanohablante omite (asked, months)",
      "b1.p.word-stress-families": "Acento en familias de palabras",
      "b1.p.had-to": "Had to /hæd tə/",
      "b1.p.sentence-stress": "Acento de frase a velocidad natural",
      "b1.p.would-contraction": "Contracción 'd de would",
      "b1.p.modal-stress": "Acento en los modales de deducción",
      "b1.p.weak-passive": "Formas débiles en la pasiva (was, been)",
      "b1.p.consonant-clusters": "Grupos de consonantes",
      "b1.p.tag-intonation": "Entonación ascendente y descendente en question tags",
    },
    writing: {
      "b1.w.informal-email": "Correo informal (100–120 palabras)",
      "b1.w.story": "Historia (unas 100 palabras)",
      "b1.w.formal-email": "Correo formal para pedir información",
      "b1.w.article": "Artículo de opinión (100–120 palabras)",
    },
  },
  b2: {
    grammar: {
      "b2.past-perfect-continuous": "Past perfect continuous",
      "b2.used-to-be-get": "used to / be used to / get used to",
      "b2.would-habits": "would and will for habits",
      "b2.verb-patterns-meaning": "Verbs that change meaning with -ing or to (remember, stop, try, regret)",
      "b2.gradable-adjectives": "Gradable and extreme adjectives with intensifiers",
      "b2.compound-adjectives": "Compound adjectives",
      "b2.softening": "Softening opinions (I'd say, It seems to me, I'm not entirely sure)",
      "b2.contrast-linkers": "despite, in spite of, whereas, nevertheless",
      "b2.future-continuous-perfect": "Future continuous and future perfect",
      "b2.future-in-past": "Future in the past (was going to, would)",
      "b2.articles-generalization": "Articles in generalizations",
      "b2.collocations": "Verb–noun collocations (make, do, take, have)",
      "b2.signposting": "Signposting language for talks",
      "b2.recommend-patterns": "recommend / suggest and their patterns",
      "b2.third-conditional": "Third conditional",
      "b2.mixed-conditionals": "Mixed conditionals",
      "b2.wish": "wish, if only, I'd rather, it's time",
      "b2.modals-past": "Modals of deduction and criticism in the past",
      "b2.passive-advanced": "The passive in all tenses, passive infinitives and gerunds",
      "b2.passive-reporting": "It is said that… / He is thought to…",
      "b2.causative": "have / get something done",
      "b2.reporting-verbs": "Reporting verbs and their patterns",
      "b2.relative-nondefining": "Non-defining relative clauses",
      "b2.so-such-that": "so…that, such…that",
      "b2.formal-register": "Formal register: vocabulary and structures",
      "b2.conditional-linkers": "provided that, as long as, otherwise",
      "b2.phrasal-verbs-advanced": "Three-part phrasal verbs",
      "b2.word-formation": "Word formation",
      "b2.comparatives-the-the": "the more…, the more…; double comparatives",
      "b2.emphasis": "Emphasis with do, really, such and so",
      "b2.participle-clauses": "Participle clauses",
      "b2.discourse-markers": "Discourse markers in speech",
      "b2.comparison-linkers": "while, whereas, unlike, compared to",
      "b2.purpose-result": "Linkers of purpose, cause and result",
      "b2.reference-words": "Reference words across texts (this, which, the former)",
    },
    functions: {
      "b2.f.anecdote": "Tell a vivid anecdote",
      "b2.f.adapting": "Talk about adapting to change",
      "b2.f.memories": "Talk about memories and regrets",
      "b2.f.describe-character": "Describe character precisely",
      "b2.f.discussion": "Take part in a discussion",
      "b2.f.hedging": "Hedge and soften",
      "b2.f.argue": "Build an argument",
      "b2.f.predict": "Predict and plan ahead",
      "b2.f.changed-plans": "Explain plans that changed",
      "b2.f.natural-expression": "Express ideas naturally, not by translation",
      "b2.f.present": "Give a structured presentation",
      "b2.f.trends": "Describe trends and data",
      "b2.f.recommend": "Make formal recommendations",
      "b2.f.regret": "Talk about regrets",
      "b2.f.hypothesize": "Hypothesize about the past and the present",
      "b2.f.wishes": "Express wishes and annoyance",
      "b2.f.speculate-past": "Speculate about the past",
      "b2.f.criticize": "Criticize past actions",
      "b2.f.evaluate": "Evaluate and recommend in a review",
      "b2.f.report-news": "Report news impersonally",
      "b2.f.services": "Talk about services",
      "b2.f.report-precisely": "Report what people said precisely",
      "b2.f.add-information": "Add information smoothly",
      "b2.f.engage-reader": "Engage the reader",
      "b2.f.formal-register": "Keep a consistent formal register",
      "b2.f.negotiate": "Negotiate conditions",
      "b2.f.emphasize": "Emphasize",
      "b2.f.concise": "Express ideas concisely",
      "b2.f.natural-conversation": "Sound natural in conversation",
      "b2.f.compare-photos": "Compare photos",
      "b2.f.explain-cause": "Explain causes and results",
      "b2.f.infer-attitude": "Infer attitude and meaning",
    },
    pronunciation: {
      "b2.p.connected-speech": "Connected speech: assimilation and elision",
      "b2.p.weak-would": "Weak and contracted would",
      "b2.p.contrastive-stress": "Contrastive stress",
      "b2.p.compound-stress": "Stress in compound adjectives and nouns",
      "b2.p.intonation-attitude": "Intonation to show attitude",
      "b2.p.chunking": "Chunking and pausing in longer turns",
      "b2.p.weak-have-perfect": "Weak have in perfect modals (should've, would've)",
      "b2.p.pausing-commas": "Pausing with non-defining clauses",
      "b2.p.stress-shift": "Stress shift (REcord / reCORD)",
      "b2.p.accents": "Recognizing US, UK and Australian accents",
    },
    writing: {
      "b2.w.essay": "Essay (140–190 words)",
      "b2.w.report": "Report",
      "b2.w.review": "Review",
      "b2.w.article": "Article",
      "b2.w.formal-letter": "Formal letter or email of application",
    },
  },
  c1: {
    grammar: {
      "c1.aspect": "Aspect for nuance (perfect and continuous)",
      "c1.hedging": "Hedging (tend to, appear to, there is some evidence)",
      "c1.distancing": "Distancing (It would seem that, is said to have)",
      "c1.inversion": "Negative inversion",
      "c1.cleft": "Cleft and pseudo-cleft sentences",
      "c1.idioms": "Idioms, binomials and fixed expressions",
      "c1.cohesion": "Cohesion: referencing and advanced linking",
      "c1.conditionals-advanced": "Inverted conditionals and alternatives to if",
      "c1.concession": "Concession (admittedly, granted, much as)",
      "c1.modals-advanced": "Advanced modal meanings (needn't have, will for assumption, be bound to)",
      "c1.subjunctive": "The subjunctive in formal recommendations",
      "c1.softening-advanced": "Diplomatic language",
      "c1.nominalisation": "Nominalisation",
      "c1.participles-advanced": "Advanced participle and reduced clauses",
      "c1.comparison-advanced": "Advanced comparison and approximation",
      "c1.word-formation-advanced": "Advanced word formation",
      "c1.ellipsis-substitution": "Ellipsis and substitution",
      "c1.fronting": "Fronting",
      "c1.emphasis": "Emphatic structures and intensifiers",
      "c1.understatement": "Understatement and litotes",
      "c1.speculation-advanced": "Advanced speculation",
      "c1.reporting-advanced": "Nuanced reporting verbs (claim, allege, contend)",
      "c1.register": "Register shifting",
      "c1.future-advanced": "Formal future forms (be to, be due to, be on the verge of)",
      "c1.collocations-advanced": "Strong collocations",
      "c1.dependent-prepositions": "Dependent prepositions",
      "c1.phrasal-advanced": "Multi-meaning phrasal verbs and formal equivalents",
      "c1.vague-language": "Vague language",
      "c1.transformations": "Key word transformations",
    },
    functions: {
      "c1.f.nuance": "Express nuance through tense choice",
      "c1.f.hedge": "Hedge claims",
      "c1.f.emphasize-formal": "Emphasize in formal contexts",
      "c1.f.focus": "Focus attention on key information",
      "c1.f.idiomatic": "Use idiomatic language appropriately",
      "c1.f.evaluate-ideas": "Evaluate competing ideas",
      "c1.f.hypothesize-formal": "Hypothesize formally",
      "c1.f.persuade": "Persuade",
      "c1.f.concede": "Concede a point",
      "c1.f.certainty": "Express degrees of certainty",
      "c1.f.recommend-formal": "Make formal recommendations",
      "c1.f.infer": "Infer implied meaning",
      "c1.f.meetings": "Participate in and chair meetings",
      "c1.f.academic-style": "Write in an academic style",
      "c1.f.concise-formal": "Write concisely and formally",
      "c1.f.describe-data": "Describe data and findings",
      "c1.f.precision-lexis": "Choose words with precision",
      "c1.f.summarize": "Summarize complex input",
      "c1.f.natural-economy": "Avoid repetition naturally",
      "c1.f.evaluate-nuanced": "Evaluate with nuance",
      "c1.f.irony": "Understand and use irony",
      "c1.f.long-turn": "Sustain a long turn",
      "c1.f.critical-reading": "Read critically",
      "c1.f.register-switch": "Switch register",
      "c1.f.plans-formal": "Announce formal plans",
      "c1.f.networking": "Network and make small talk",
      "c1.f.paraphrase-precise": "Paraphrase precisely",
      "c1.f.speed-reading": "Read at speed",
      "c1.f.collaborate": "Collaborate to reach a decision",
      "c1.f.natural-delivery": "Deliver speech naturally",
      "c1.f.self-editing": "Edit your own writing",
    },
    pronunciation: {
      "c1.p.connected-speech": "Advanced connected speech (intrusion, elision, assimilation)",
      "c1.p.tonic-stress": "Tonic stress for meaning",
      "c1.p.emphatic-stress": "Emphatic stress",
      "c1.p.prosody": "Prosody: rhythm, stress and intonation together",
      "c1.p.rhythm-rhetoric": "Rhythm for rhetoric",
      "c1.p.accents": "Understanding a wide range of accents",
      "c1.p.intonation-turn-taking": "Intonation for turn-taking",
      "c1.p.stress-shift-advanced": "Stress in long word families",
      "c1.p.auxiliary-stress": "Stressed auxiliaries in ellipsis",
      "c1.p.intonation-irony": "Intonation for irony and understatement",
    },
    writing: {
      "c1.w.essay": "Essay (220–260 words)",
      "c1.w.proposal": "Proposal",
      "c1.w.report": "Report",
      "c1.w.review": "Review",
      "c1.w.formal-letter": "Formal letter",
      "c1.w.timed": "Timed exam writing",
    },
  },
};

/* ---------- Unidades y lecciones ----------
   Cada lección: [título, lo que vas a poder hacer, foco, gramática, funciones,
   pronunciación, vocabulario, género de escritura que enseña ("" si no enseña uno nuevo).
   Una lección puede citar puntos de niveles anteriores: eso es repaso, y es bienvenido. */

const UNITS = {
  a1: [
    ["Hello! — Primeros pasos", "👋", [
      ["Hello, I'm…", "Saludar, presentarte y deletrear tu nombre en inglés.", "speaking", ["a1.be", "a1.subject-pronouns"], ["a1.f.greet", "a1.f.spell"], "a1.p.alphabet", "saludos, despedidas, presentaciones y el alfabeto", ""],
      ["Where are you from?", "Decir de dónde eres y preguntar por el país y la nacionalidad de otros.", "listening", ["a1.be"], ["a1.f.personal-info"], "a1.p.word-stress", "países y nacionalidades", ""],
      ["Numbers, phones and emails", "Dar y entender edades, teléfonos y correos sin equivocarte en un número.", "vocabulary", ["a1.wh-questions"], ["a1.f.numbers", "a1.f.personal-info"], "a1.p.teens-tens", "números del 0 al 100, la arroba y el punto en los correos", ""],
      ["My things", "Nombrar objetos cotidianos y señalar si están cerca o lejos.", "reading", ["a1.articles", "a1.plurals", "a1.demonstratives"], ["a1.f.identify"], "a1.p.short-long-i", "objetos personales y colores", ""],
      ["Filling in a form", "Llenar un formulario y escribir un perfil corto con mayúsculas y puntuación correctas.", "writing", ["a1.possessive-adjectives"], ["a1.f.personal-info"], "a1.p.contractions", "datos personales: nombre, apellido, dirección, profesión", "a1.w.form"],
    ]],
    ["My people — Familia y rutina", "👨‍👩‍👧", [
      ["This is my family", "Presentar a tu familia y decir de quién es cada cosa.", "listening", ["a1.possessive-s"], ["a1.f.family"], "a1.p.th", "la familia", ""],
      ["What do you do?", "Hablar de trabajos y estudios con el presente simple.", "reading", ["a1.present-simple", "a1.articles"], ["a1.f.jobs"], "a1.p.s-clusters", "profesiones y lugares de trabajo", ""],
      ["Describing people", "Describir cómo es físicamente una persona.", "speaking", ["a1.adjectives", "a1.have"], ["a1.f.describe-people"], "a1.p.h", "aspecto físico y adjetivos básicos", ""],
      ["A typical day", "Contar tu rutina diaria y decir la hora.", "grammar", ["a1.present-simple-third", "a1.prepositions-time"], ["a1.f.routines", "a1.f.time"], "a1.p.third-person-s", "rutina diaria y la hora", ""],
      ["How often?", "Decir con qué frecuencia haces algo y escribir sobre tu semana.", "writing", ["a1.frequency-adverbs", "a1.present-simple"], ["a1.f.free-time"], "a1.p.weak-forms", "tiempo libre y días de la semana", "a1.w.routine"],
    ]],
    ["Home and town — Casa y ciudad", "🏠", [
      ["My home", "Describir tu casa: qué hay y qué no hay.", "reading", ["a1.there-is"], ["a1.f.describe-home"], "a1.p.linking", "habitaciones y muebles", ""],
      ["Where is it?", "Decir dónde está algo con precisión.", "grammar", ["a1.prepositions-place"], ["a1.f.location"], "a1.p.b-v", "preposiciones de lugar y objetos de la casa", ""],
      ["Around town", "Pedir y dar indicaciones sencillas en la ciudad.", "listening", ["a1.imperatives"], ["a1.f.directions"], "a1.p.question-intonation", "lugares de la ciudad e indicaciones", ""],
      ["Can you swim?", "Hablar de lo que sabes y no sabes hacer, y pedir permiso.", "speaking", ["a1.can"], ["a1.f.ability", "a1.f.requests"], "a1.p.can-cant", "habilidades y deportes", ""],
      ["A message about my town", "Escribir un mensaje que describa tu ciudad uniendo ideas con and, but y or.", "writing", ["a1.conjunctions"], ["a1.f.describe-town"], "a1.p.sentence-stress", "adjetivos para lugares", "a1.w.message"],
    ]],
    ["Food and shopping — Comida y compras", "🛒", [
      ["Food I like", "Hablar de comida con some, any y sustantivos contables e incontables.", "vocabulary", ["a1.countable", "a1.some-any"], ["a1.f.food"], "a1.p.weak-forms", "comida y bebida", ""],
      ["At a café", "Pedir comida y bebida con cortesía.", "speaking", ["a1.would-like"], ["a1.f.ordering"], "a1.p.polite-intonation", "en el café y el restaurante", ""],
      ["How much is it?", "Comprar ropa, preguntar precios y entenderlos.", "listening", ["a1.how-much-many", "a1.demonstratives"], ["a1.f.shopping"], "a1.p.word-stress", "ropa, precios y dinero", ""],
      ["I love cooking", "Expresar gustos con like, love y hate + -ing y usar pronombres de objeto.", "grammar", ["a1.like-ing", "a1.object-pronouns"], ["a1.f.likes"], "a1.p.ng", "actividades y aficiones", ""],
      ["A simple recipe", "Leer y escribir instrucciones paso a paso.", "reading", ["a1.imperatives", "a1.sequencers"], ["a1.f.instructions"], "a1.p.linking", "cocina: verbos y utensilios", "a1.w.instructions"],
    ]],
    ["Now and then — Ahora y antes", "⏳", [
      ["What are you doing?", "Describir lo que pasa en este momento.", "grammar", ["a1.present-continuous"], ["a1.f.describe-now"], "a1.p.ng", "acciones cotidianas y el teléfono", ""],
      ["Simple or continuous?", "Distinguir rutinas de acciones del momento y hablar del clima.", "listening", ["a1.simple-vs-continuous"], ["a1.f.weather"], "a1.p.weak-forms", "el clima y las estaciones", ""],
      ["Where were you?", "Decir dónde estabas y dar fechas.", "speaking", ["a1.past-be", "a1.prepositions-time"], ["a1.f.dates"], "a1.p.was-were", "fechas, ordinales y meses", ""],
      ["Last weekend", "Contar lo que hiciste con verbos regulares en pasado.", "reading", ["a1.past-regular"], ["a1.f.past-events"], "a1.p.ed-endings", "actividades de fin de semana", ""],
      ["A great trip", "Narrar un viaje con verbos irregulares y escribir una postal.", "writing", ["a1.past-irregular"], ["a1.f.past-events"], "a1.p.sentence-stress", "viajes y vacaciones", "a1.w.postcard"],
    ]],
    ["Plans — Planes y preguntas", "🗓️", [
      ["Going to", "Hablar de tus planes con be going to.", "reading", ["a1.going-to"], ["a1.f.plans"], "a1.p.gonna", "planes, vacaciones y expresiones de futuro", ""],
      ["Would you like to come?", "Invitar, aceptar y rechazar con cortesía.", "speaking", ["a1.would-like", "a1.lets"], ["a1.f.invitations"], "a1.p.polite-intonation", "invitaciones, días y horas", ""],
      ["Questions, questions", "Formular preguntas correctas con todas las palabras interrogativas.", "grammar", ["a1.wh-questions", "a1.question-order"], ["a1.f.ask-info"], "a1.p.question-intonation", "palabras interrogativas", ""],
      ["At the hotel", "Resolver situaciones básicas de viaje: reservar, preguntar y pedir.", "listening", ["a1.can", "a1.would-like"], ["a1.f.travel"], "a1.p.contractions", "hotel y transporte", ""],
      ["My life in English", "Presentarte durante dos minutos y escribir un perfil de 80 palabras.", "writing", ["a1.present-simple", "a1.past-irregular", "a1.going-to"], ["a1.f.personal-info"], "a1.p.sentence-stress", "repaso de todo el nivel", "a1.w.profile"],
    ]],
  ],
  a2: [
    ["Stories — Contar lo que pasó", "📖", [
      ["A weekend to remember", "Hacer y responder preguntas sobre el pasado con fluidez.", "speaking", ["a2.past-simple-review"], ["a2.f.anecdotes"], "a2.p.connected-did", "verbos irregulares frecuentes y expresiones de tiempo pasado", ""],
      ["What were you doing?", "Describir el contexto de una historia con el pasado continuo.", "listening", ["a2.past-continuous"], ["a2.f.narrate"], "a2.p.weak-was", "acciones y escenas, when y while", ""],
      ["Then, suddenly…", "Escribir una historia corta bien ordenada con conectores.", "writing", ["a2.linkers-sequence"], ["a2.f.narrate"], "a2.p.stress-timing", "conectores de secuencia y de causa", "a2.w.story"],
      ["Famous lives", "Entender y contar una biografía con fechas y expresiones de tiempo.", "reading", ["a2.time-expressions", "a2.past-simple-review"], ["a2.f.biography"], "a2.p.word-stress-2-3", "etapas de la vida y logros", ""],
      ["What's she like?", "Describir con detalle la personalidad y el aspecto de alguien.", "vocabulary", ["a2.look-like"], ["a2.f.describe-people"], "a2.p.schwa", "personalidad y aspecto", ""],
    ]],
    ["Comparing — Comparar y elegir", "⚖️", [
      ["Bigger, better, faster", "Comparar cosas, personas y lugares.", "grammar", ["a2.comparatives"], ["a2.f.compare"], "a2.p.schwa", "adjetivos para comparar", ""],
      ["The best place in the world", "Hablar de lo mejor y lo peor con superlativos y el uso correcto de the.", "reading", ["a2.superlatives", "a2.articles"], ["a2.f.compare"], "a2.p.the", "geografía y viajes", ""],
      ["Not as expensive as…", "Matizar comparaciones con as…as, too y enough para elegir y justificar.", "speaking", ["a2.as-as", "a2.too-enough"], ["a2.f.choose"], "a1.p.linking", "compras y decisiones", ""],
      ["Too much sugar", "Entender y hablar de cantidades y hábitos de vida con cuantificadores.", "listening", ["a2.quantifiers"], ["a2.f.lifestyle"], "a2.p.cut-cat-cart", "comida, salud y cantidades", ""],
      ["I really recommend it", "Recomendar un lugar por escrito usando adverbios de modo.", "writing", ["a2.adverbs-manner"], ["a2.f.recommend"], "a2.p.word-stress-2-3", "restaurantes, lugares y opiniones", "a2.w.recommendation"],
    ]],
    ["Experiences — Lo que has vivido", "✈️", [
      ["Have you ever…?", "Hablar de experiencias de vida con el presente perfecto.", "grammar", ["a2.present-perfect-experience"], ["a2.f.experiences"], "a2.p.contractions-have", "participios irregulares y experiencias", ""],
      ["Ever or yesterday?", "Elegir bien entre presente perfecto y pasado simple.", "reading", ["a2.pp-vs-past"], ["a2.f.experiences"], "a2.p.weak-have", "expresiones de tiempo definido e indefinido", ""],
      ["Already, just, yet", "Contar novedades y avances con just, already y yet.", "speaking", ["a2.just-already-yet"], ["a2.f.news"], "a2.p.j-dj", "tareas y novedades", ""],
      ["At the airport", "Moverte en un aeropuerto y entender anuncios.", "listening", ["a2.prepositions-movement"], ["a2.f.travel"], "a2.p.silent-letters", "aeropuerto y viajes", ""],
      ["An email from abroad", "Escribir un correo informal contando un viaje.", "writing", ["a2.pp-vs-past"], ["a2.f.experiences"], "a2.p.intonation-interest", "viajes; saludos y despedidas de correo", "a2.w.informal-email"],
    ]],
    ["Rules and advice — Normas y consejos", "📏", [
      ["You have to wear a uniform", "Explicar normas y obligaciones.", "reading", ["a2.must-have-to"], ["a2.f.rules"], "a2.p.have-to", "trabajo, colegio y señales", ""],
      ["You should see a doctor", "Describir síntomas y dar consejos.", "speaking", ["a2.should"], ["a2.f.health", "a2.f.advice"], "a2.p.silent-letters", "el cuerpo, síntomas y el médico", ""],
      ["I enjoy running", "Usar bien verbo + -ing y verbo + to.", "grammar", ["a2.verb-patterns"], ["a2.f.lifestyle"], "a2.p.word-stress-2-3", "deporte y hábitos", ""],
      ["Could you help me?", "Pedir favores y permiso con cortesía, y hablar de habilidades pasadas.", "listening", ["a2.could-may"], ["a2.f.requests"], "a1.p.polite-intonation", "favores y permisos", ""],
      ["A note of advice", "Escribir un mensaje con consejos explicando el propósito con to.", "writing", ["a2.infinitive-purpose", "a2.because-so"], ["a2.f.advice"], "a1.p.linking", "consejos prácticos", "a2.w.advice-note"],
    ]],
    ["The future — El futuro", "🔮", [
      ["I think it will…", "Hacer predicciones con will, probably y definitely.", "reading", ["a2.will"], ["a2.f.predictions"], "a2.p.ll", "tecnología y futuro", ""],
      ["I'll help you!", "Ofrecer ayuda, prometer y decidir en el momento; distinguir will de going to.", "listening", ["a2.will-vs-going-to"], ["a2.f.offers"], "a2.p.weak-to", "favores y promesas", ""],
      ["What are you doing on Saturday?", "Organizar citas y planes concretos.", "speaking", ["a2.present-continuous-future"], ["a2.f.arrangements"], "a2.p.intonation-questions", "agenda y citas", ""],
      ["If it rains…", "Hablar de consecuencias reales con el condicional cero y el primero.", "grammar", ["a2.zero-conditional", "a2.first-conditional"], ["a2.f.consequences"], "a2.p.ll", "clima, planes y consecuencias", ""],
      ["Invitations and replies", "Escribir invitaciones y responderlas aceptando o rechazando.", "writing", ["a2.present-continuous-future"], ["a2.f.invitations"], "a1.p.polite-intonation", "eventos y celebraciones", "a2.w.invitation"],
    ]],
    ["My world — Personas, lugares y cosas", "🌍", [
      ["The person who…", "Definir y explicar palabras que no recuerdas con who, which, that y where.", "grammar", ["a2.relative-clauses"], ["a2.f.paraphrase"], "a2.p.sh-ch", "objetos, profesiones y lugares", ""],
      ["Is this yours?", "Hablar de pertenencias perdidas con pronombres posesivos e indefinidos.", "reading", ["a2.possessive-pronouns", "a2.indefinite-pronouns"], ["a2.f.lost-property"], "a1.p.th", "objetos perdidos", ""],
      ["On the phone", "Hacer y recibir llamadas, dejar mensajes y anotar datos.", "listening", ["a2.could-may"], ["a2.f.phone"], "a1.p.alphabet", "el teléfono y los mensajes", ""],
      ["There's a problem with my room", "Quejarte de un problema sencillo y pedir una solución.", "speaking", ["a2.too-enough"], ["a2.f.complain"], "a1.p.polite-intonation", "hoteles, tiendas y problemas", ""],
      ["My A2 portfolio", "Describir una foto durante un minuto y escribir 100 palabras sobre una experiencia.", "writing", ["a2.pp-vs-past", "a2.comparatives", "a2.first-conditional"], ["a2.f.describe-photo"], "a2.p.stress-timing", "repaso de todo el nivel", "a2.w.experience"],
    ]],
  ],
  b1: [
    ["Who you are — Identidad y relaciones", "🧑‍🤝‍🧑", [
      ["Getting to know you", "Formular preguntas de sujeto, de objeto e indirectas sin errores de orden.", "speaking", ["b1.subject-object-questions", "b1.indirect-questions"], ["b1.f.get-to-know"], "b1.p.intonation-indirect", "preguntas personales y conocer gente", ""],
      ["Habits and states", "Usar bien el presente simple y el continuo, incluidos los verbos de estado.", "grammar", ["b1.present-review", "b1.stative-verbs"], ["b1.f.describe-personality"], "b1.p.chunking", "personalidad y hábitos", ""],
      ["How long have you been…?", "Hablar de lo que empezó en el pasado y sigue, con for, since y el presente perfecto continuo.", "listening", ["b1.present-perfect-continuous"], ["b1.f.life-changes"], "b1.p.weak-been", "cambios de vida y duración", ""],
      ["I used to…", "Contar hábitos del pasado que ya no tienes.", "speaking", ["b1.used-to"], ["b1.f.past-habits"], "b1.p.used-to", "infancia y recuerdos", ""],
      ["We get on really well", "Hablar de relaciones con phrasal verbs y adjetivos en -ed y en -ing.", "reading", ["b1.phrasal-verbs", "b1.ed-ing-adjectives"], ["b1.f.relationships"], "b1.p.phrasal-stress", "relaciones y sentimientos", ""],
      ["An email to a friend", "Escribir un correo informal de 100–120 palabras que responda a todos los puntos pedidos.", "writing", ["b1.linkers-addition"], ["b1.f.news-updates"], "b1.p.chunking", "expresiones de correo informal", "b1.w.informal-email"],
    ]],
    ["Stories — Narrar", "🎬", [
      ["Narrative tenses", "Contar una historia combinando pasado simple, continuo y perfecto.", "grammar", ["b1.past-perfect", "b1.narrative-tenses"], ["b1.f.storytelling"], "b1.p.had-contraction", "verbos para narrar", ""],
      ["No way!", "Contar anécdotas y reaccionar con interés a las de otros.", "speaking", ["b1.time-linkers"], ["b1.f.react", "b1.f.storytelling"], "b1.p.intonation-reactions", "expresiones de reacción", ""],
      ["Films and books", "Resumir el argumento de una película o un libro y recomendarlo.", "reading", ["b1.narrative-tenses"], ["b1.f.recommend"], "b1.p.vowel-er", "cine y literatura", ""],
      ["She said that…", "Transmitir lo que otra persona dijo, ajustando tiempos y referencias.", "grammar", ["b1.reported-statements"], ["b1.f.report"], "b1.p.final-consonants", "say, tell, explain, mention", ""],
      ["He asked me if…", "Transmitir preguntas, pedidos y órdenes.", "listening", ["b1.reported-questions"], ["b1.f.report"], "b1.p.final-consonants", "mensajes y recados", ""],
      ["Writing a story", "Escribir una historia de unas 100 palabras con diálogo bien puntuado.", "writing", ["b1.narrative-tenses", "b1.reported-statements"], ["b1.f.storytelling"], "b1.p.chunking", "adverbios y verbos expresivos", "b1.w.story"],
    ]],
    ["Work and study — Trabajo y estudio", "💼", [
      ["Jobs and skills", "Hablar de capacidades en distintos tiempos con be able to y manage to.", "reading", ["b1.be-able-to"], ["b1.f.skills"], "b1.p.word-stress-families", "trabajo, habilidades y familias de palabras", ""],
      ["Rules at work", "Explicar obligaciones y permisos en presente y en pasado.", "grammar", ["b1.obligation-past", "b1.make-let-allow"], ["b1.f.rules"], "b1.p.had-to", "normas laborales", ""],
      ["The job interview", "Responder preguntas de entrevista con gerundios e infinitivos bien usados.", "speaking", ["b1.gerund-infinitive"], ["b1.f.interview"], "b1.p.sentence-stress", "entrevistas y cualidades", ""],
      ["A formal email", "Escribir un correo formal para pedir información con el registro adecuado.", "writing", ["b1.indirect-questions"], ["b1.f.formal-requests"], "b1.p.chunking", "registro formal frente a informal", "b1.w.formal-email"],
      ["Unless you study…", "Expresar condiciones reales con unless, as long as, as soon as e in case.", "grammar", ["b1.conditional-linkers"], ["b1.f.advise"], "a2.p.ll", "estudio y aprendizaje", ""],
      ["Why don't we…?", "Proponer ideas, aceptar y rechazar sugerencias en una reunión.", "listening", ["b1.suggestions"], ["b1.f.suggestions", "b1.f.agree-disagree"], "a1.p.polite-intonation", "reuniones y planes", ""],
    ]],
    ["Imagine — Situaciones hipotéticas", "💭", [
      ["If I had a million dollars", "Imaginar situaciones irreales con el segundo condicional.", "grammar", ["b1.second-conditional"], ["b1.f.hypothetical"], "b1.p.would-contraction", "deseos, dinero y sueños", ""],
      ["Real or imaginary?", "Elegir entre primer y segundo condicional según lo probable que sea algo.", "speaking", ["b1.first-vs-second"], ["b1.f.dilemmas"], "b1.p.would-contraction", "dilemas", ""],
      ["It must be…", "Hacer deducciones sobre el presente con must, might y can't.", "reading", ["b1.deduction-present", "b1.possibility"], ["b1.f.speculate"], "b1.p.modal-stress", "misterios y deducciones", ""],
      ["Describing a photo", "Describir una foto durante un minuto especulando con seguridad.", "speaking", ["b1.look-seem"], ["b1.f.describe-photo"], "b1.p.chunking", "escenas, lugares y acciones", ""],
      ["If I were you…", "Dar consejos elaborados y usar so, such, too y enough.", "listening", ["b1.so-such", "b1.advice-forms"], ["b1.f.advise"], "b1.p.vowel-er", "problemas personales", ""],
      ["An article", "Escribir un artículo de opinión de 100–120 palabras que enganche al lector.", "writing", ["b1.contrast-linkers"], ["b1.f.opinion"], "b1.p.sentence-stress", "temas de revista", "b1.w.article"],
    ]],
    ["The world around us — El mundo", "🌱", [
      ["It was invented in…", "Describir inventos y procesos con la voz pasiva en presente y en pasado.", "reading", ["b1.passive-simple"], ["b1.f.describe-process"], "b1.p.weak-passive", "inventos y fabricación", ""],
      ["It has been announced", "Entender noticias y usar la pasiva con más tiempos y con modales.", "listening", ["b1.passive-more"], ["b1.f.news"], "b1.p.weak-passive", "noticias", ""],
      ["Both, neither, all", "Hablar del medio ambiente con cuantificadores precisos.", "vocabulary", ["b1.quantifiers"], ["b1.f.environment"], "b1.p.consonant-clusters", "medio ambiente", ""],
      ["In my opinion…", "Dar tu opinión, defenderla y contrastarla con although, however y even though.", "speaking", ["b1.contrast-linkers"], ["b1.f.opinion", "b1.f.agree-disagree"], "b1.p.sentence-stress", "temas de debate", ""],
      ["The city where I grew up", "Describir lugares con relativas, incluidas whose y las que omiten el pronombre.", "grammar", ["b1.relative-clauses"], ["b1.f.describe-place"], "a1.p.th", "ciudades y barrios", ""],
      ["Technology in our lives", "Explicar propósitos con to, in order to y so that, y usar bien los artículos.", "reading", ["b1.purpose", "b1.articles"], ["b1.f.explain-purpose"], "b1.p.word-stress-families", "tecnología", "b1.w.article"],
    ]],
    ["Everyday challenges — Resolver la vida", "🧭", [
      ["I'd like to complain", "Quejarte con cortesía cara a cara y por teléfono.", "speaking", ["b1.reflexive-pronouns"], ["b1.f.complain"], "a1.p.polite-intonation", "servicios y reclamos", ""],
      ["You're coming, aren't you?", "Confirmar información con question tags y la entonación adecuada.", "grammar", ["b1.question-tags"], ["b1.f.check-info"], "b1.p.tag-intonation", "confirmaciones", ""],
      ["My flight was cancelled", "Entender anuncios y conversaciones sobre problemas de viaje a velocidad real.", "listening", ["b1.past-perfect"], ["b1.f.travel-problems"], "b1.p.final-consonants", "viajes e imprevistos", ""],
      ["Money talks", "Hablar de dinero con phrasal verbs y elegir entre presente perfecto y pasado.", "reading", ["b1.phrasal-verbs", "b1.pp-review"], ["b1.f.money"], "b1.p.phrasal-stress", "dinero, compras y bancos", ""],
      ["Word building", "Formar palabras con prefijos y sufijos para ampliar tu vocabulario.", "vocabulary", ["b1.word-formation"], ["b1.f.paraphrase"], "b1.p.word-stress-families", "prefijos y sufijos", ""],
      ["My B1 portfolio", "Sostener una conversación de tres minutos y escribir un correo y un artículo.", "writing", ["b1.narrative-tenses", "b1.second-conditional", "b1.passive-simple"], ["b1.f.opinion"], "b1.p.chunking", "repaso de todo el nivel", "b1.w.informal-email"],
    ]],
  ],
  b2: [
    ["Who we were — Memory and character", "🧠", [
      ["Telling a good story", "Tell a vivid anecdote using the full range of narrative tenses, including the past perfect continuous.", "speaking", ["b2.past-perfect-continuous"], ["b2.f.anecdote"], "b2.p.connected-speech", "vivid verbs and adverbs for storytelling", ""],
      ["Getting used to it", "Talk about past habits and adapting to change with used to, would, be used to and get used to.", "listening", ["b2.used-to-be-get", "b2.would-habits"], ["b2.f.adapting"], "b2.p.weak-would", "change, moving abroad, adapting", ""],
      ["Remember to, remember -ing", "Use verbs whose meaning changes with -ing or the to-infinitive.", "grammar", ["b2.verb-patterns-meaning"], ["b2.f.memories"], "b2.p.contrastive-stress", "memory and regret", ""],
      ["Open-minded and self-confident", "Describe character precisely with compound adjectives and the right intensifiers.", "reading", ["b2.gradable-adjectives", "b2.compound-adjectives"], ["b2.f.describe-character"], "b2.p.compound-stress", "personality and compound adjectives", ""],
      ["I see your point, but…", "Take part in a discussion: agree, disagree, interrupt and soften your opinions.", "speaking", ["b2.softening"], ["b2.f.discussion", "b2.f.hedging"], "b2.p.intonation-attitude", "discussion language", ""],
      ["For and against", "Write a 140–190 word essay that weighs both sides and reaches a clear conclusion.", "writing", ["b2.contrast-linkers"], ["b2.f.argue"], "b2.p.chunking", "education and society", "b2.w.essay"],
    ]],
    ["Tomorrow's world", "🚀", [
      ["This time next year", "Talk about the future with the future continuous and the future perfect.", "grammar", ["b2.future-continuous-perfect"], ["b2.f.predict"], "b2.p.weak-have-perfect", "life goals and technology", ""],
      ["I was going to call you", "Explain plans that changed using the future in the past.", "listening", ["b2.future-in-past"], ["b2.f.changed-plans"], "b2.p.weak-would", "plans and excuses", ""],
      ["Robots, jobs and us", "Follow the argument of a long opinion article and use articles correctly in generalizations.", "reading", ["b2.articles-generalization"], ["b2.f.argue"], "b2.p.chunking", "technology, work and AI", ""],
      ["Make, do, take, have", "Use common collocations naturally instead of translating from Spanish.", "vocabulary", ["b2.collocations"], ["b2.f.natural-expression"], "b2.p.connected-speech", "verb–noun collocations", ""],
      ["Giving a presentation", "Give a structured three-minute presentation and describe the trends in a graph.", "speaking", ["b2.signposting"], ["b2.f.present", "b2.f.trends"], "b2.p.chunking", "presentations, graphs and trends", ""],
      ["Writing a report", "Write a clear report with headings, findings and recommendations.", "writing", ["b2.recommend-patterns"], ["b2.f.recommend"], "b2.p.chunking", "reports, surveys and recommendations", "b2.w.report"],
    ]],
    ["What if…? — Regrets and hypotheses", "🔁", [
      ["If I had known…", "Talk about past situations that didn't happen with the third conditional.", "grammar", ["b2.third-conditional"], ["b2.f.regret"], "b2.p.weak-have-perfect", "decisions, consequences and regrets", ""],
      ["Mixed conditionals", "Connect an unreal past with a present result, and the other way round.", "reading", ["b2.mixed-conditionals"], ["b2.f.hypothesize"], "b2.p.contrastive-stress", "life choices", ""],
      ["I wish I could…", "Express wishes, regrets and complaints with wish, if only, I'd rather and it's time.", "speaking", ["b2.wish"], ["b2.f.wishes"], "b2.p.intonation-attitude", "wishes and annoyances", ""],
      ["She must have forgotten", "Speculate about the past and criticize with past modals of deduction and should have.", "grammar", ["b2.modals-past"], ["b2.f.speculate-past", "b2.f.criticize"], "b2.p.weak-have-perfect", "mysteries and mistakes", ""],
      ["An unsolved mystery", "Follow a long recording and catch specific details and the speakers' opinions.", "listening", ["b2.modals-past"], ["b2.f.speculate-past"], "b2.p.connected-speech", "crime and mysteries", ""],
      ["Writing a review", "Write a review that describes, evaluates and recommends.", "writing", ["b2.gradable-adjectives"], ["b2.f.evaluate"], "b2.p.chunking", "films, books and restaurants", "b2.w.review"],
    ]],
    ["News and society", "📰", [
      ["Passives everywhere", "Use the passive in every tense, including passive infinitives and gerunds.", "grammar", ["b2.passive-advanced"], ["b2.f.report-news"], "b1.p.weak-passive", "news and science", ""],
      ["It is said that…", "Report beliefs and rumours impersonally with passive reporting structures.", "reading", ["b2.passive-reporting"], ["b2.f.report-news"], "b2.p.chunking", "news, rumours and research", ""],
      ["Getting things done", "Talk about services and things done for you with have and get something done.", "speaking", ["b2.causative"], ["b2.f.services"], "b2.p.connected-speech", "services, repairs and appointments", ""],
      ["He denied taking it", "Report precisely what people said with reporting verbs and their patterns.", "grammar", ["b2.reporting-verbs"], ["b2.f.report-precisely"], "b2.p.contrastive-stress", "reporting verbs", ""],
      ["Crime and justice", "Add extra information with non-defining relative clauses.", "listening", ["b2.relative-nondefining"], ["b2.f.add-information"], "b2.p.pausing-commas", "crime and the law", ""],
      ["Writing an article", "Write a magazine article that engages the reader from the first line.", "writing", ["b2.so-such-that"], ["b2.f.engage-reader"], "b2.p.chunking", "lifestyle and society", "b2.w.article"],
    ]],
    ["Work and persuasion", "💼", [
      ["Applying for a job", "Write a formal letter or email of application in a consistent formal register.", "writing", ["b2.formal-register"], ["b2.f.formal-register"], "b2.p.chunking", "jobs, applications and personal qualities", "b2.w.formal-letter"],
      ["Provided that…", "Negotiate conditions with provided that, as long as, unless and otherwise.", "speaking", ["b2.conditional-linkers"], ["b2.f.negotiate"], "b2.p.intonation-attitude", "negotiations and deals", ""],
      ["Come up with, put up with", "Understand and use three-part phrasal verbs in workplace conversations.", "listening", ["b2.phrasal-verbs-advanced"], ["b2.f.natural-expression"], "b1.p.phrasal-stress", "work, problems and solutions", ""],
      ["Word formation", "Build the right form of a word in context: nouns, adjectives, adverbs and opposites.", "vocabulary", ["b2.word-formation"], ["b2.f.natural-expression"], "b2.p.stress-shift", "word families", ""],
      ["The more, the better", "Emphasize and compare with double comparatives and emphatic structures.", "reading", ["b2.comparatives-the-the", "b2.emphasis"], ["b2.f.emphasize"], "b2.p.contrastive-stress", "trends and habits", ""],
      ["Having finished…", "Make your writing more concise with participle clauses.", "grammar", ["b2.participle-clauses"], ["b2.f.concise"], "b2.p.chunking", "processes and events", ""],
    ]],
    ["Real English", "🌐", [
      ["Anyway, as I was saying…", "Sound natural in conversation with discourse markers.", "speaking", ["b2.discourse-markers"], ["b2.f.natural-conversation"], "b2.p.connected-speech", "conversation", ""],
      ["Comparing two photos", "Compare two photos for one minute, speculating and giving a reasoned opinion.", "speaking", ["b2.comparison-linkers"], ["b2.f.compare-photos"], "b2.p.chunking", "lifestyles and situations", ""],
      ["Cause and effect", "Explain causes, purposes and results with formal linkers.", "reading", ["b2.purpose-result"], ["b2.f.explain-cause"], "b2.p.chunking", "environment, health and economy", ""],
      ["Accents and real speed", "Understand US, UK and Australian speakers at natural speed in interviews.", "listening", ["b2.discourse-markers"], ["b2.f.infer-attitude"], "b2.p.accents", "radio interviews", ""],
      ["Reading between the lines", "Follow references across a long text and infer meaning from context.", "reading", ["b2.reference-words"], ["b2.f.infer-attitude"], "b2.p.chunking", "long texts", ""],
      ["My B2 portfolio", "Write an essay and an email, and hold a four-minute discussion.", "writing", ["b2.third-conditional", "b2.passive-advanced", "b2.reporting-verbs"], ["b2.f.discussion"], "b2.p.intonation-attitude", "review of the whole level", "b2.w.essay"],
    ]],
  ],
  c1: [
    ["Precision", "🎯", [
      ["Aspect and nuance", "Choose tenses for nuance, not just time: perfect and continuous aspects in context.", "grammar", ["c1.aspect"], ["c1.f.nuance"], "c1.p.connected-speech", "news, change and experience", ""],
      ["It would appear that…", "Hedge and distance yourself from claims like an educated speaker.", "reading", ["c1.hedging", "c1.distancing"], ["c1.f.hedge"], "c1.p.tonic-stress", "research, claims and evidence", ""],
      ["Never have I…", "Use negative inversion for emphasis in formal speech and writing.", "grammar", ["c1.inversion"], ["c1.f.emphasize-formal"], "c1.p.emphatic-stress", "formal rhetoric", ""],
      ["What I mean is…", "Focus attention with cleft and pseudo-cleft sentences.", "speaking", ["c1.cleft"], ["c1.f.focus"], "c1.p.tonic-stress", "clarifying and emphasizing", ""],
      ["By and large", "Understand idioms, binomials and fixed expressions in conversation — and know when not to use them.", "listening", ["c1.idioms"], ["c1.f.idiomatic"], "c1.p.connected-speech", "idioms of communication", ""],
      ["The C1 essay", "Write a 220–260 word essay that evaluates two ideas and reaches a reasoned conclusion.", "writing", ["c1.cohesion"], ["c1.f.evaluate-ideas"], "c1.p.prosody", "society, education and culture", "c1.w.essay"],
    ]],
    ["Persuasion and debate", "🎙️", [
      ["Were I to…", "Express conditions with inversion and alternatives to if.", "grammar", ["c1.conditionals-advanced"], ["c1.f.hypothesize-formal"], "c1.p.tonic-stress", "decisions and policy", ""],
      ["The art of persuasion", "Persuade an audience and concede points gracefully in a debate.", "speaking", ["c1.concession"], ["c1.f.persuade", "c1.f.concede"], "c1.p.rhythm-rhetoric", "debate and rhetoric", ""],
      ["You needn't have bothered", "Read an opinion column and use advanced modal meanings for certainty, necessity and assumption.", "reading", ["c1.modals-advanced"], ["c1.f.certainty"], "c1.p.connected-speech", "probability and obligation", ""],
      ["Writing a proposal", "Write a persuasive proposal with clear recommendations in formal style.", "writing", ["c1.subjunctive"], ["c1.f.recommend-formal"], "c1.p.prosody", "projects, funding and community", "c1.w.proposal"],
      ["What did she really mean?", "Infer attitude, opinion and irony from speakers with different accents.", "listening", ["c1.distancing"], ["c1.f.infer"], "c1.p.accents", "interviews and opinions", ""],
      ["Meetings that work", "Chair or take part in a meeting: interrupt, clarify, summarize and reach a decision.", "speaking", ["c1.softening-advanced"], ["c1.f.meetings"], "c1.p.intonation-turn-taking", "meetings and decisions", ""],
    ]],
    ["Science and the mind", "🔬", [
      ["Academic style", "Turn spoken-style sentences into concise academic prose through nominalisation.", "reading", ["c1.nominalisation"], ["c1.f.academic-style"], "c1.p.stress-shift-advanced", "science and research", ""],
      ["Reduced clauses", "Use participle and reduced relative clauses to pack information elegantly.", "grammar", ["c1.participles-advanced"], ["c1.f.concise-formal"], "c1.p.prosody", "studies and discoveries", ""],
      ["Describing data", "Present research findings orally with precise comparison and approximation.", "speaking", ["c1.comparison-advanced"], ["c1.f.describe-data"], "c1.p.tonic-stress", "statistics and findings", ""],
      ["Writing a report", "Write a C1 report that evaluates evidence and recommends action.", "writing", ["c1.nominalisation"], ["c1.f.recommend-formal"], "c1.p.prosody", "surveys and institutions", "c1.w.report"],
      ["Misunderstood, overestimated", "Master advanced word formation with prefixes, suffixes and compounds.", "vocabulary", ["c1.word-formation-advanced"], ["c1.f.precision-lexis"], "c1.p.stress-shift-advanced", "word families", ""],
      ["Lectures and note-taking", "Follow a lecture, take effective notes and summarize the argument.", "listening", ["c1.cohesion"], ["c1.f.summarize"], "c1.p.connected-speech", "lectures and academic talks", ""],
    ]],
    ["Culture and the media", "🎭", [
      ["I hope so, I'd rather not", "Avoid repetition naturally with ellipsis and substitution.", "grammar", ["c1.ellipsis-substitution"], ["c1.f.natural-economy"], "c1.p.auxiliary-stress", "conversation", ""],
      ["Writing a review", "Write a C1 review with vivid description and nuanced evaluation.", "writing", ["c1.fronting"], ["c1.f.evaluate-nuanced"], "c1.p.prosody", "art, film, books and exhibitions", "c1.w.review"],
      ["Strange as it may seem", "Add emphasis with fronting, emphatic do and strong intensifiers.", "grammar", ["c1.fronting", "c1.emphasis"], ["c1.f.emphasize-formal"], "c1.p.emphatic-stress", "opinion and emphasis", ""],
      ["Not bad at all", "Recognize and use understatement, irony and sarcasm.", "listening", ["c1.understatement"], ["c1.f.irony"], "c1.p.intonation-irony", "humour and British understatement", ""],
      ["The long turn", "Compare pictures for one minute with advanced speculation and evaluation.", "speaking", ["c1.speculation-advanced"], ["c1.f.long-turn"], "c1.p.prosody", "situations and feelings", ""],
      ["Media and bias", "Identify stance and bias across several texts and compare viewpoints.", "reading", ["c1.reporting-advanced"], ["c1.f.critical-reading"], "c1.p.tonic-stress", "media and journalism", ""],
    ]],
    ["A global professional", "🌍", [
      ["Formal letters and emails", "Write formal letters with a consistent register and persuasive force.", "writing", ["c1.register"], ["c1.f.register-switch"], "c1.p.prosody", "complaints and applications", "c1.w.formal-letter"],
      ["About to, due to, set to", "Understand formal announcements and talk about the future with be to, be due to and be on the verge of.", "listening", ["c1.future-advanced"], ["c1.f.plans-formal"], "c1.p.connected-speech", "business and events", ""],
      ["Bitterly disappointed", "Use strong collocations and dependent prepositions with precision.", "vocabulary", ["c1.collocations-advanced", "c1.dependent-prepositions"], ["c1.f.precision-lexis"], "c1.p.connected-speech", "emotions and work", ""],
      ["Carry out, bring about", "Read business texts and use multi-meaning phrasal verbs and their formal equivalents.", "reading", ["c1.phrasal-advanced"], ["c1.f.register-switch"], "b1.p.phrasal-stress", "work and change", ""],
      ["Small talk and networking", "Start, sustain and close conversations with strangers naturally.", "speaking", ["c1.vague-language"], ["c1.f.networking"], "c1.p.intonation-turn-taking", "networking and events", ""],
      ["Key word transformations", "Paraphrase sentences using grammar and lexis with total precision.", "grammar", ["c1.transformations"], ["c1.f.paraphrase-precise"], "c1.p.tonic-stress", "mixed topics", ""],
    ]],
    ["Mastery", "🏆", [
      ["Reading at speed", "Read long, complex texts against the clock and locate information accurately.", "reading", ["c1.cohesion"], ["c1.f.speed-reading"], "c1.p.prosody", "long texts", ""],
      ["Reaching a decision", "Negotiate a decision with a partner and extend the discussion to abstract questions.", "speaking", ["c1.concession"], ["c1.f.collaborate"], "c1.p.intonation-turn-taking", "abstract topics", ""],
      ["Sounding natural", "Shadow long passages to master rhythm, stress and intonation.", "pronunciation", ["c1.emphasis"], ["c1.f.natural-delivery"], "c1.p.prosody", "speeches and monologues", ""],
      ["Writing under pressure", "Plan, write and edit a C1 essay and a second task within exam time.", "writing", ["c1.cohesion", "c1.register"], ["c1.f.self-editing"], "c1.p.prosody", "mixed topics", "c1.w.timed"],
      ["The full spectrum", "Understand dense, fast and overlapping speech across accents.", "listening", ["c1.ellipsis-substitution"], ["c1.f.infer"], "c1.p.accents", "radio, podcasts and panels", ""],
      ["My C1 portfolio", "Compare your day-one recordings with today and complete a full C1 simulation.", "speaking", ["c1.inversion", "c1.cleft", "c1.conditionals-advanced"], ["c1.f.collaborate"], "c1.p.prosody", "review of the whole course", ""],
    ]],
  ],
};

/* Lecciones esperadas por nivel. Si alguien agrega o quita una sin querer, la auditoría
   lo detecta en vez de dejar un nivel cojo. */
const EXPECTED_LESSONS = { a1: 30, a2: 30, b1: 36, b2: 36, c1: 36 };

const LEVEL_ORDER = LEVELS.map(level => level.id);
const KINDS = ["grammar", "functions", "pronunciation", "writing"];

function levelOfRef(ref) {
  return String(ref || "").split(".")[0];
}

function inventoryLabel(ref) {
  const level = INVENTORY[levelOfRef(ref)];
  if (!level) return null;
  for (const kind of KINDS) if (level[kind]?.[ref]) return level[kind][ref];
  return null;
}

function inventoryKind(ref) {
  const level = INVENTORY[levelOfRef(ref)];
  return KINDS.find(kind => level?.[kind]?.[ref]) || null;
}

function buildLesson(levelMeta, unitNumber, row, numberInLevel, globalIndex) {
  const [title, canDo, focus, grammar, functions, pronunciation, vocabulary, writing] = row;
  return {
    id: `en-${levelMeta.id}-${String(numberInLevel).padStart(2, "0")}`,
    chapter: globalIndex,                       // la app numera la ruta con `chapter`
    level: levelMeta.id,
    cefr: levelMeta.cefr,
    unit: unitNumber,
    numberInLevel,
    title,
    objective: canDo,
    focus,
    grammar: [...grammar],
    functions: [...functions],
    pronunciation,
    vocabulary,
    writing: writing || null,
    explanationLanguage: levelMeta.explanationLanguage,
    speechRate: levelMeta.speechRate,
  };
}

export function getEnglishCourse() {
  let globalIndex = 0;
  const levels = LEVELS.map(levelMeta => {
    let numberInLevel = 0;
    const units = (UNITS[levelMeta.id] || []).map(([title, emoji, rows], unitIndex) => {
      const unitNumber = unitIndex + 1;
      const lessons = rows.map(row => buildLesson(levelMeta, unitNumber, row, ++numberInLevel, ++globalIndex));
      return {
        id: `en-${levelMeta.id}-u${unitNumber}`,
        level: levelMeta.id,
        cefr: levelMeta.cefr,
        title,
        emoji,
        lessons,
        checkpoint: { id: `en-${levelMeta.id}-u${unitNumber}-check`, passScore: ENGLISH_RULES.checkpointPass },
      };
    });
    return {
      ...levelMeta,
      units,
      exam: {
        id: `en-${levelMeta.id}-exam`,
        sections: ["listening", "reading", "language", "writing", "speaking"],
        passEach: ENGLISH_RULES.levelExamPassEach,
        immersionHoursRequired: levelMeta.immersionHours,
        /* El examen de cada nivel trae preguntas de los anteriores: lo que se aprendió en
           A2 tiene que seguir ahí en C1. */
        cumulativeShare: LEVEL_ORDER.indexOf(levelMeta.id) === 0 ? 0 : 0.2,
      },
    };
  });
  return {
    version: ENGLISH_COURSE_VERSION,
    kind: "language",
    source: "Inventario verificado del Marco Común Europeo (English Profile y especificaciones de Cambridge)",
    title: "Inglés — de cero a C1",
    subtitle: "5 niveles · 30 unidades · 168 lecciones · exámenes de unidad y de nivel en las cuatro habilidades",
    expectedLessons: Object.values(EXPECTED_LESSONS).reduce((total, count) => total + count, 0),
    itemLabel: "lecciones",
    theme: "english-lab",
    rules: { ...ENGLISH_RULES },
    levels,
    /* La app pinta el mapa con `units`; cada unidad lleva su nivel para poder agruparlas. */
    units: levels.flatMap(level => level.units),
  };
}

export function englishInventory(levelId) {
  const level = INVENTORY[levelId];
  if (!level) return null;
  return Object.fromEntries(KINDS.map(kind => [kind, { ...level[kind] }]));
}

export function englishInventoryLabel(ref) {
  return inventoryLabel(ref);
}

export function englishCourseAudit(course) {
  const issues = [];
  const levels = course?.levels || [];
  const lessons = levels.flatMap(level => (level.units || []).flatMap(unit => unit.lessons || []));
  const ids = new Set(lessons.map(lesson => lesson.id));
  const stableIds = ids.size === lessons.length
    && lessons.every(lesson => /^en-(a1|a2|b1|b2|c1)-\d{2}$/.test(lesson.id));
  if (!stableIds) issues.push("hay identificadores repetidos o mal formados");

  const levelIds = levels.map(level => level.id);
  const levelsInOrder = levelIds.join(",") === LEVEL_ORDER.join(",");
  if (!levelsInOrder) issues.push(`los niveles no siguen el orden ${LEVEL_ORDER.join(" → ")}`);

  const sequenceComplete = lessons.every((lesson, index) => lesson.chapter === index + 1);
  if (!sequenceComplete) issues.push("la numeración global de la ruta tiene huecos");

  const perLevel = {};
  for (const level of levels) {
    const levelLessons = (level.units || []).flatMap(unit => unit.lessons || []);
    const rank = LEVEL_ORDER.indexOf(level.id);
    const covered = new Set();
    const unknownRefs = [];
    const futureRefs = [];

    levelLessons.forEach((lesson, index) => {
      if (lesson.numberInLevel !== index + 1) issues.push(`${lesson.id} rompe la numeración del nivel`);
      if (!ENGLISH_FOCUS.includes(lesson.focus)) issues.push(`${lesson.id} tiene un foco desconocido (${lesson.focus})`);
      if (!lesson.title || String(lesson.objective || "").length < 20) issues.push(`${lesson.id} no tiene título u objetivo observable`);
      if (!lesson.grammar?.length) issues.push(`${lesson.id} no declara gramática`);
      if (!lesson.functions?.length) issues.push(`${lesson.id} no declara una función comunicativa`);
      if (!lesson.pronunciation) issues.push(`${lesson.id} no declara un punto de pronunciación`);
      if (!lesson.vocabulary) issues.push(`${lesson.id} no declara vocabulario`);
      const refs = [...(lesson.grammar || []), ...(lesson.functions || []), lesson.pronunciation, lesson.writing].filter(Boolean);
      for (const ref of refs) {
        if (!inventoryLabel(ref)) { unknownRefs.push(`${lesson.id}: ${ref}`); continue; }
        const refRank = LEVEL_ORDER.indexOf(levelOfRef(ref));
        if (refRank > rank) futureRefs.push(`${lesson.id}: ${ref}`);
        if (levelOfRef(ref) === level.id) covered.add(ref);
      }
      const expectedKinds = [
        ["grammar", lesson.grammar], ["functions", lesson.functions], ["pronunciation", [lesson.pronunciation]], ["writing", [lesson.writing].filter(Boolean)],
      ];
      for (const [kind, list] of expectedKinds) {
        for (const ref of list || []) {
          const actual = inventoryKind(ref);
          if (actual && actual !== kind) issues.push(`${lesson.id} usa ${ref} como ${kind}, pero es ${actual}`);
        }
      }
    });

    const inventory = INVENTORY[level.id] || {};
    const uncovered = KINDS.flatMap(kind => Object.keys(inventory[kind] || {}).filter(ref => !covered.has(ref)));
    if (unknownRefs.length) issues.push(`${level.cefr}: puntos inexistentes (${unknownRefs.join("; ")})`);
    if (futureRefs.length) issues.push(`${level.cefr}: puntos de un nivel posterior (${futureRefs.join("; ")})`);
    if (uncovered.length) issues.push(`${level.cefr}: puntos del inventario sin lección (${uncovered.join(", ")})`);

    const expectedCount = EXPECTED_LESSONS[level.id];
    if (levelLessons.length !== expectedCount) issues.push(`${level.cefr}: ${levelLessons.length} lecciones, se esperaban ${expectedCount}`);

    /* Cada unidad trabaja las cuatro habilidades: al menos una lección centrada en
       escuchar, leer y hablar, y al menos una que enseñe un tipo de texto escrito. */
    const unitGaps = [];
    for (const unit of level.units || []) {
      const focuses = new Set((unit.lessons || []).map(lesson => lesson.focus));
      const missing = CORE_SKILLS.filter(skill => !focuses.has(skill));
      if (!(unit.lessons || []).some(lesson => lesson.writing)) missing.push("writing");
      if (missing.length) unitGaps.push(`${unit.id} sin ${missing.join(", ")}`);
      if ((unit.lessons || []).length < 5 || (unit.lessons || []).length > 6) unitGaps.push(`${unit.id} tiene ${(unit.lessons || []).length} lecciones`);
    }
    if (unitGaps.length) issues.push(`${level.cefr}: ${unitGaps.join("; ")}`);

    const inventorySize = KINDS.reduce((total, kind) => total + Object.keys(inventory[kind] || {}).length, 0);
    perLevel[level.id] = {
      lessons: levelLessons.length,
      expectedLessons: expectedCount,
      inventory: inventorySize,
      covered: covered.size,
      coverageComplete: uncovered.length === 0 && unknownRefs.length === 0 && futureRefs.length === 0,
      unitsBalanced: unitGaps.length === 0,
    };
  }

  const expectedLessons = Object.values(EXPECTED_LESSONS).reduce((total, count) => total + count, 0);
  return {
    lessons: lessons.length,
    expectedLessons,
    levels: perLevel,
    stableIds,
    levelsInOrder,
    sequenceComplete,
    issues,
    complete: issues.length === 0 && lessons.length === expectedLessons,
  };
}
