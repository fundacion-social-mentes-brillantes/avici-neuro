import test from "node:test";
import assert from "node:assert/strict";
import {
  parsePubmedXml,
  pubmedTitleMatchCount,
  curatedSearchPlan,
  rankPubmedSources,
  renderResearchAnswer,
  sanitizeSearchPlan,
  validateResearchResult,
} from "../api/research.js";

test("las consultas biomédicas se limitan a conceptos y descartan planes débiles", () => {
  assert.deepEqual(sanitizeSearchPlan({ queries: [
    ["homeostasis", "feedforward control", "physiology", "YEAR:[2020 TO 2026]"],
    ["allostasis", "physiological regulation", "physiology"],
    ["una", "consulta", "extra"],
  ] }), [
    ["homeostasis", "feedforward control", "physiology"],
    ["allostasis", "physiological regulation", "physiology"],
  ]);
  assert.deepEqual(sanitizeSearchPlan({ queries: [["homeostasis"]] }), []);
});

test("los temas del curso usan rutas biomédicas estables", () => {
  assert.deepEqual(curatedSearchPlan("Organización del Cuerpo y Homeostasia"), [
    ["homeostasis", "organism", "physiology"],
    ["physiological stability", "homeostasis", "brain"],
  ]);
  assert.deepEqual(curatedSearchPlan("Cadena de frío: incidentes y almacenamiento"), [
    ["vaccine cold chain", "vaccine storage", "immunization"],
    ["temperature excursion", "vaccine potency", "public health"],
  ]);
  assert.deepEqual(curatedSearchPlan("Anafilaxia después de la vacunación"), [
    ["vaccine anaphylaxis", "emergency management", "immunization"],
    ["anaphylaxis after vaccination", "vaccine safety", "clinical guideline"],
  ]);
  assert.deepEqual(curatedSearchPlan("Vacunas neumocócicas"), [
    ["pneumococcal vaccine", "immunization", "vaccine effectiveness"],
    ["pneumococcal vaccine", "vaccine safety", "public health"],
  ]);
  assert.deepEqual(curatedSearchPlan("Hepatitis B y BCG"), [
    ["hepatitis B vaccine", "immunization", "vaccine safety"],
    ["BCG vaccine", "immunization", "vaccine safety"],
  ]);
  assert.deepEqual(curatedSearchPlan("Rabia, fiebre hemorrágica argentina y fiebre amarilla"), [
    ["rabies vaccine", "immunization", "vaccine safety"],
    ["Argentine hemorrhagic fever vaccine", "immunization", "vaccine safety"],
    ["yellow fever vaccine", "immunization", "vaccine safety"],
  ]);
  assert.equal(curatedSearchPlan("Un tema completamente nuevo").length, 0);
});

test("PubMed se transforma en fuentes con resumen, fecha y tipo de evidencia", () => {
  const xml = `
    <PubmedArticleSet><PubmedArticle><MedlineCitation>
      <PMID>32210840</PMID><Article>
        <Journal><Title>Advances in Physiology Education</Title><JournalIssue><PubDate><Year>2020</Year></PubDate></JournalIssue></Journal>
        <ArticleTitle>Homeostasis: the central organizing principle</ArticleTitle>
        <Abstract><AbstractText>Homeostasis is a dynamic process supported by feedback and feedforward regulation in living organisms. Contemporary physiology also describes anticipatory control and interacting regulatory systems.</AbstractText></Abstract>
        <PublicationTypeList><PublicationType>Review</PublicationType></PublicationTypeList>
      </Article>
    </MedlineCitation><PubmedData><ArticleIdList><ArticleId IdType="doi">10.1152/advan.00107.2019</ArticleId></ArticleIdList></PubmedData></PubmedArticle></PubmedArticleSet>`;
  const parsed = parsePubmedXml(xml, new Map([["32210840", 0]]));
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].pmid, "32210840");
  assert.equal(parsed[0].year, "2020");
  assert.deepEqual(parsed[0].publicationTypes, ["Review"]);
  assert.match(parsed[0].abstract, /feedforward regulation/);
});

test("se priorizan revisiones y se eliminan artículos duplicados", () => {
  const sources = rankPubmedSources([
    { pmid: "1", title: "Estudio", abstract: "a".repeat(140), journal: "J", year: "2026", doi: "", publicationTypes: ["Journal Article"], rank: 0 },
    { pmid: "2", title: "Guía", abstract: "b".repeat(140), journal: "J", year: "2024", doi: "", publicationTypes: ["Practice Guideline"], rank: 2 },
    { pmid: "2", title: "Guía repetida", abstract: "b".repeat(140), journal: "J", year: "2024", doi: "", publicationTypes: ["Practice Guideline"], rank: 4 },
  ]);
  assert.equal(sources.length, 2);
  assert.equal(sources[0].pmid, "2");
  assert.equal(sources[0].id, 1);
  assert.equal(sources[0].database, "PubMed");
});

test("una fuente reciente pesa más que una guía clínica obsoleta", () => {
  const sources = rankPubmedSources([
    { pmid: "old", title: "Guía antigua", abstract: "a".repeat(140), journal: "J", year: "2008", doi: "", publicationTypes: ["Practice Guideline"], rank: 0 },
    { pmid: "new", title: "Revisión reciente", abstract: "b".repeat(140), journal: "J", year: String(new Date().getUTCFullYear()), doi: "", publicationTypes: ["Systematic Review"], rank: 3 },
  ]);
  assert.equal(sources[0].pmid, "new");
});

test("la relevancia distingue títulos centrales de coincidencias aisladas", () => {
  const queries = [
    ["homeostasis", "feedforward", "physiology"],
    ["homeostasis", "allostasis", "physiological regulation"],
  ];
  assert.equal(pubmedTitleMatchCount({ title: "Homeostasis: The Central Organizing Principle of Physiology" }, queries, [0]), 2);
  assert.equal(pubmedTitleMatchCount({ title: "Homeostasis in the Gut Microbiota in Chronic Kidney Disease" }, queries, [0]), 1);
  assert.equal(pubmedTitleMatchCount({ title: "Clarifying homeostasis and allostasis in physiological regulation" }, queries, [1]), 3);
});

test("una afirmación moderna solo sobrevive si su cita existe literalmente", () => {
  const passages = [{ page: 28, text: "La homeostasis mantiene el medio interno dentro de límites compatibles con la vida." }];
  const sources = [{
    id: 1,
    abstract: "Anticipatory feedforward controls can minimize disturbances before a regulated variable changes significantly in the organism.",
  }];
  const raw = {
    bookSummary: [{ text: "El libro presenta la homeostasis como regulación interna.", bookEvidence: { page: 28, quote: "La homeostasis mantiene el medio interno dentro de límites compatibles con la vida" } }],
    currentEvidence: [
      { text: "El control anticipatorio sigue formando parte del modelo actual.", sourceEvidence: [{ sourceId: 1, quote: "Anticipatory feedforward controls can minimize disturbances before a regulated variable changes significantly" }] },
      { text: "Esta afirmación fue inventada.", sourceEvidence: [{ sourceId: 1, quote: "This exact support does not appear anywhere in the abstract" }] },
    ],
    changes: [{
      text: "Cambio no demostrado.",
      bookEvidence: { page: 28, quote: "una frase que no aparece en el libro" },
      sourceEvidence: [{ sourceId: 1, quote: "Anticipatory feedforward controls can minimize disturbances before a regulated variable changes significantly" }],
    }],
    debates: [],
    takeaway: {
      text: "El libro no contempla este avance.",
      sourceEvidence: [{ sourceId: 1, quote: "Anticipatory feedforward controls can minimize disturbances before a regulated variable changes significantly" }],
    },
  };
  const result = validateResearchResult(raw, passages, sources);
  assert.equal(result.bookSummary.length, 1);
  assert.equal(result.currentEvidence.length, 1);
  assert.deepEqual(result.currentEvidence[0].sourceIds, [1]);
  assert.equal(result.changes.length, 0);
  assert.equal(result.takeaway, null);
});

test("si no hay cambio sustentado, el resultado lo declara sin fabricar debate", () => {
  const answer = renderResearchAnswer({
    bookSummary: [],
    currentEvidence: [{ text: "El concepto continúa en uso.", sourceIds: [1], sourceEvidence: [], bookEvidence: null }],
    changes: [],
    debates: [],
    takeaway: null,
  });
  assert.match(answer, /no se pudo demostrar una diferencia fiable/i);
  assert.doesNotMatch(answer, /Qué se discute/);
  assert.match(answer, /\[Fuente 1\]/);
});

test("el manual histórico bloquea pautas operativas aunque la cita de PubMed exista", () => {
  const passages = [{ page: 6, text: "El manual presenta un calendario de vacunación para la edición." }];
  const sources = [{
    id: 1,
    abstract: "The current schedule recommends administering a 0.5 mL dose to eligible children after clinical assessment.",
  }];
  const raw = {
    bookSummary: [],
    currentEvidence: [{
      text: "La pauta vigente es administrar una dosis de 0,5 mL.",
      sourceEvidence: [{ sourceId: 1, quote: "The current schedule recommends administering a 0.5 mL dose to eligible children" }],
    }],
    changes: [],
    debates: [],
    takeaway: null,
  };
  const result = validateResearchResult(raw, passages, sources, { historicalClinical: true });
  assert.equal(result.currentEvidence.length, 0);
});
