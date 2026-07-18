import test from "node:test";
import assert from "node:assert/strict";
import {
  parsePubmedXml,
  isPubmedSourceRelevant,
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

test("se excluyen artículos que usan homeostasis en otro contexto", () => {
  const queries = [
    ["homeostasis", "feedforward", "physiology"],
    ["homeostasis", "allostasis", "physiological regulation"],
  ];
  assert.equal(isPubmedSourceRelevant({ title: "Homeostasis: The Central Organizing Principle of Physiology" }, queries, [0]), true);
  assert.equal(isPubmedSourceRelevant({ title: "Homeostasis in the Gut Microbiota in Chronic Kidney Disease" }, queries, [0]), false);
  assert.equal(isPubmedSourceRelevant({ title: "Clarifying homeostasis and allostasis in physiological regulation" }, queries, [1]), true);
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
  };
  const result = validateResearchResult(raw, passages, sources);
  assert.equal(result.bookSummary.length, 1);
  assert.equal(result.currentEvidence.length, 1);
  assert.deepEqual(result.currentEvidence[0].sourceIds, [1]);
  assert.equal(result.changes.length, 0);
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
