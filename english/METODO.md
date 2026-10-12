# Método del curso de inglés (A1 → C1)

Este documento es la guía para escribir las 168 lecciones. Reúne lo que dice la investigación sobre cómo aprende mejor inglés alguien que habla español y cómo se aplica cada hallazgo en el curso. La mayoría de las reglas no dependen de la buena voluntad de quien escribe: [english-utils.js](../english-utils.js) rechaza cualquier lección que no las cumpla.

## 1. Lo que dice la evidencia y cómo se aplica

La evidencia no pesa lo mismo en todos los casos. La columna **Solidez** lo dice con franqueza.

| Hallazgo | Solidez | Cómo se aplica en cada lección |
|---|---|---|
| **La enseñanza explícita funciona** y dura: explicar la regla y practicarla supera a esperar que se deduzca sola (Norris y Ortega, 2000; Spada y Tomita, 2010, que encontraron el mayor efecto en los rasgos complejos) | Alta | Explicación gramatical obligatoria con ejemplos y errores típicos. Hasta B1 va en español; desde B2, en inglés |
| **La corrección que obliga a pensar (*prompt*) deja más que dar la forma correcta de una vez (*recast*)**. La retroalimentación oral tiene efectos significativos y duraderos (Lyster y Saito, 2010) | Alta | En la práctica, el primer error recibe una **pista** y otra oportunidad. Si la pista regala la respuesta, la lección se rechaza. El profe IA corregirá igual: primero una pista, después la forma correcta |
| **Recuperar de la memoria, espaciado en el tiempo**, fija más que releer. El espaciado ayuda en segundas lenguas: un metaanálisis de 37 estudios lo confirma, aunque con efectos que varían (Kim y Webb, 2022) | Alta | Repaso diario con repetición espaciada (en la app). Además, **cada lección mezcla al menos 3 ejercicios de lecciones anteriores**, y ningún ejercicio puede entrenar algo que la ruta todavía no enseñó |
| **Intentar antes de aprender**: equivocarse en un intento, con la respuesta correcta justo después, mejora el aprendizaje posterior (Kornell, Hays y Bjork, 2009). El beneficio depende de que la retroalimentación sea inmediata (Hays y otros, 2012) | Media-alta | 2 o más ejercicios de **intento previo** antes de la explicación, con la respuesta al instante |
| **La enseñanza de la pronunciación funciona**, con efecto grande (d ≈ 0,8–0,9), y más si es larga y lleva retroalimentación (Lee, Jang y Plonsky, 2015). Funciona mejor cuando apunta a sonidos y rasgos concretos (Saito y Plonsky, 2019) | Alta | Cada lección trabaja **un** punto concreto de pronunciación. La app lo califica con el servicio de voz de Azure, sonido por sonido |
| **Primero el oído, con muchas voces** (entrenamiento de alta variabilidad). En hispanohablantes y catalanohablantes, identificar el sonido entre opciones funcionó mejor que discriminar pares en las vocales, y mejoró también la producción (Carlet y Cebrian; Carlet, 2019; Mora y otros, 2022) | Alta | 4 o más ejercicios de **identificar lo que suena**, dichos por **al menos 3 voces distintas** |
| **Shadowing** (repetir encima del audio): ayuda a escuchar sobre todo en niveles bajos y mejora la pronunciación, pero hay que combinarlo con otras actividades (Hamada) | Media | 2 o más frases de shadowing por lección, siempre junto al resto de la práctica |
| **Cognados: la ventaja del hispanohablante, que no aparece sola.** En listas académicas, la mitad o más de las palabras son cognados con el español, y casi todos siguen uno de 20 patrones. Pero muchos lectores bilingües no los reconocen si no se les enseñan (Lubliner y Hiebert, 2011) | Alta | En cada lección, **un patrón de cognados** (*-tion = -ción*, *-ence = -encia*…) con 4 o más ejemplos y **al menos un falso amigo** (*embarrassed* ≠ embarazada, *actually* ≠ actualmente) |
| **Errores por interferencia del español**: son predecibles y vale la pena atacarlos de frente (Swan y Smith, *Learner English*, capítulo de español) | Media-alta (análisis contrastivo) | 2 o más errores típicos por lección (por ejemplo, *I have 27 years*). Daniel, el protagonista, los comete en la historia para que se aprenda a detectarlos |
| **Ver video con subtítulos en inglés, no en español.** Los subtítulos en inglés mejoraron la adaptación a acentos desconocidos y los subtítulos en el idioma propio la empeoraron (Mitterer y McQueen, 2009). Los subtítulos en el mismo idioma del audio ayudan a comprender y a aprender vocabulario (Montero Perez y otros, 2013 y 2014) | Media-alta | La **misión de inmersión** de cada lección exige subtítulos en inglés cuando es video |
| **Leer mucho, por gusto**, mejora la lectura: d = 0,46–0,71, más en programas largos y dentro del currículo (Jeon y Day, 2016) | Media-alta | Misiones de lectura y escucha extensiva, con minutos mínimos por nivel (10 en A1 → 30 en C1). Para presentar el examen de nivel hay que haber registrado horas de inmersión |
| **Fluidez con 4/3/2**: la misma charla, cada vez con menos tiempo, sube la velocidad y baja las vacilaciones. Para la precisión hace falta además retroalimentación (Nation, 1989; Boers, 2014) | Media | La tarea oral se graba 2 veces (A1–A2) o 3 veces (B1–C1) con menos tiempo cada ronda, y después recibe corrección |
| **Tareas con propósito** (aprendizaje basado en tareas): hay beneficio, pero el tamaño del efecto está en discusión (Bryfonski y McKay, 2019; Boers y Faez, 2023) | Media, discutida | Un **juego de roles** por lección con un personaje de la historia, con 3 o más objetivos concretos |
| **Disfrutar pesa más que la ansiedad** (Dewaele y MacIntyre, 2014), y el material con humor se recuerda mejor (Schmidt, 1994), aunque el efecto depende del diseño | Media-baja | La historia con humor, Matilda como coach y los audios con emoción. **Sirven para motivar, no sustituyen** a nada de lo anterior |

## 2. La forma de cada lección

El orden en que la vive quien estudia:

1. **Matilda abre** (con traducción en A1–A2) y presenta el episodio.
2. **Intento previo**: 2 o 3 ejercicios antes de la explicación.
3. **Vocabulario** con pronunciación (AFI de EE. UU.), ejemplo y audio.
4. **Cognados**: el patrón de la lección y el falso amigo.
5. **Gramática**: explicación, ejemplos y errores típicos.
6. **Episodio de la historia** (escucha), preguntas y dictado.
7. **Lectura**, si la lección se centra en leer.
8. **Pronunciación**: primero identificar con varias voces, después repetir y hacer shadowing; la app califica con Azure.
9. **Práctica**: al menos el 60 % es escribiendo, con pistas para el segundo intento y repaso mezclado.
10. **Hablar con la técnica 4/3/2** y después el **juego de roles** con un personaje.
11. **Escribir**, con lista de control y rúbrica de Cambridge.
12. **Prueba de dominio**: hay que sacar 80 % o más, al menos la mitad es escrita y trae dictado.
13. **Misión de inmersión** para el día, y **Matilda cierra**.

## 3. La historia: *Bright Start*

Una sola historia atraviesa el curso, como una serie. El arco imita el del estudiante: Daniel empieza sin saber decir su edad y termina, en C1, hablando con soltura en su propio pódcast.

| Nivel | Lo que le pasa a Daniel |
|---|---|
| A1 | Llega a Chicago, primer día en la escuela Bright Start: Emma, Mr. Clark, la ciudad, la comida y sus primeros errores |
| A2 | Comparte apartamento con Oliver, un londinense; viajes, planes y el primer invierno |
| B1 | Consigue trabajo en la panadería de Marcus; entrevistas, normas, problemas y amistades |
| B2 | Decisiones grandes: una oferta en otra ciudad, el pódcast *Second Chances* de Grace (donde aparecen Marcus y Chloe) y los arrepentimientos |
| C1 | Daniel crea su propio pódcast: entrevistas, debates, presentaciones y humor británico de Oliver |

**Elenco** ([english-catalog.js](../english-catalog.js) → `ENGLISH_CAST`). Cada personaje suena siempre con la misma voz, y la verificación lo comprueba.

| Personaje | Voz | Aparece en | Rol |
|---|---|---|---|
| Matilda | us-f1 (Matilda) | A1 | Coach del curso. Cálida, con humor, se ríe de sus propios chistes |
| Daniel | us-m1 (Eric) | A1 | Colombiano de Medellín, optimista y nervioso. Comete los errores del hispanohablante |
| Emma | us-f2 (Sarah) | A1 | Recepcionista. Humor seco, paciente |
| Mr. Clark | us-m3 (Roger) | A1 | Profesor. Chistes malos y amor por la gramática |
| Oliver | uk-m1 (George) | A2 | Compañero de apartamento de Londres. Té, fútbol y sarcasmo |
| Marcus | us-m2 (Chris) | B1 | Dueño de la panadería. Dejó un banco para hornear |
| Grace | uk-f1 (Alice) | B2 | Presentadora del pódcast *Second Chances* |
| Chloe | au-f1 (Charlotte) | B2 | Locutora australiana |

**Los acentos entran de a poco:** en A1 solo se oye inglés de EE. UU.; el británico llega en A2, el australiano en B2, y en C1 se suman el irlandés, el escocés, el indio y el sudafricano.

## 4. Audio

- **eleven_v3**, con etiquetas de emoción (`[laughs]`, `[nervously]`, `[sarcastic]`…), para la historia, Matilda y el juego de roles. Como no acepta velocidad, la app ofrece reproducir más lento.
- **eleven_multilingual_v2**, a la velocidad de cada nivel (0,85 en A1), para vocabulario, dictados y pronunciación.
- **Lo que se ve y lo que suena coinciden:** las etiquetas solo van en `say` y la pantalla muestra `text`; la verificación exige que, sin etiquetas, sean iguales.
- **Cómo generar:** `node tools/english-audio.mjs --dry-run <lecciones>` dice el costo sin gastar nada; sin `--dry-run` genera solo lo que falta. Cuesta ~0,49–0,61 créditos por carácter.
- **Después de generar:** comprobar con Whisper local que cada audio dice su texto y que no leyó ninguna etiqueta en voz alta.

## 5. Lista de control para escribir una lección

1. Leer la fila de la lección en `english-catalog.js`: gramática, funciones, pronunciación, vocabulario y género de escritura.
2. Escribir el episodio dentro del arco de la historia, con el elenco correcto y un error típico de Daniel cuando venga al caso.
3. Elegir un patrón de cognados y un falso amigo que no se hayan usado antes.
4. Mezclar al menos 3 ejercicios de repaso de lecciones anteriores, preferiblemente de hace varias lecciones.
5. Ponerle una pista a cada ejercicio escrito de la práctica, sin regalar la respuesta.
6. Pasar `normalizeEnglishLesson` (`npm test` lo hace con todas) hasta que no queden problemas.
7. Releer como profesor nativo: inglés natural, claves correctas y humor que funcione. Esto el código no lo puede comprobar.
8. Generar los audios, verificarlos con Whisper y reportar el costo real.

## Fuentes

- Lyster y Saito (2010), retroalimentación oral, *SSLA*: [McGill eScholarship](https://escholarship.mcgill.ca/downloads/6w924g64b)
- Norris y Ortega (2000), revisado en [SALT, Columbia](https://journals.library.columbia.edu/index.php/SALT/article/view/1434); Spada y Tomita (2010): [Universidad de Toronto](https://www.eas.utoronto.ca/node/790)
- Lee, Jang y Plonsky (2015), enseñanza de la pronunciación: [NAU](https://experts.nau.edu/en/publications/the-effectiveness-of-second-language-pronunciation-instruction-a-/); Saito y Plonsky (2019): [NAU](https://experts.nau.edu/en/publications/effects-of-second-language-pronunciation-teaching-revisited-a-pro/)
- Entrenamiento fonético de alta variabilidad con hispanohablantes: [Carlet y Cebrian, UAB](https://ddd.uab.cat/record/180084), [Carlet, ICPhS 2019](https://assta.org/proceedings/ICPhS2019Microsite/pdf/full-paper_532.pdf), [Mora y otros, 2022](https://www.degruyterbrill.com/document/doi/10.1515/phon-2022-2018/html)
- Cognados español-inglés, Lubliner y Hiebert (2011): [TextProject](https://textproject.org/wp-content/uploads/2022/07/Lubliner-Hiebert.pdf)
- Espaciado en L2, Kim y Webb (2022), citado en: [SSLLT](https://pressto.amu.edu.pl/index.php/ssllt/article/download/49487/44378/139556)
- Intento previo, Kornell, Hays y Bjork (2009): [PubMed](https://pubmed.ncbi.nlm.nih.gov/19586265/); Hays, Kornell y Bjork: [UCLA](https://sites.lifesci.ucla.edu/psych-bjorklab/wp-content/uploads/sites/13/2016/07/Hays_Kornell_RBjork_inpress.pdf)
- Subtítulos, Mitterer y McQueen (2009): [PLoS ONE / PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC2775720); Montero Perez y otros (2014): [LLT](https://www.lltjournal.org/item/686/)
- Lectura extensiva, Jeon y Day (2016): [ScholarSpace](https://scholarspace.manoa.hawaii.edu/items/b52a5591-ec04-4026-816f-434361a4e899)
- 4/3/2 y repetición de tareas: [UCL, 2021](https://discovery.ucl.ac.uk/10128571/1/LTR2021.pdf)
- Shadowing, Hamada (2012): [The Language Teacher](https://jalt-publications.org/sites/default/files/pdf-article/36.1-art1.pdf)
- Aprendizaje basado en tareas, la discusión sobre el tamaño del efecto: [Language Teaching Research](https://journals.sagepub.com/doi/reader/10.1177/13621688231167573)
- Disfrute y ansiedad, Dewaele y MacIntyre (2014): [SSLLT / DOAJ](https://doaj.org/article/6d2fcff17ef14c5693196abe533f9860)
- Humor y memoria, Schmidt (1994), resumido en: [Effectiviology](https://effectiviology.com/humor-effect/)
- Swan y Smith, *Learner English*: [British Council Library](https://library.britishcouncil.lk/bib/458174)
