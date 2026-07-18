// POST /api/research — Contraste verificable entre el libro y literatura biomédica de PubMed.
import { verifyUser, isApproved, readBody } from "./_lib.js";

const MODEL = "deepseek-v4-flash";
const PUBMED = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const USER_AGENT = "AVICI-NeuralStudy/2.0 (educational evidence search)";
const MAX_SOURCES = 7;

const STOPWORDS = new Set([
  "para", "como", "desde", "hasta", "entre", "sobre", "esta", "este", "estos", "estas", "del", "las", "los",
  "and", "with", "from", "into", "that", "this", "the", "for", "physiology", "medical", "human",
]);

export function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function cleanText(value = "", max = 900) {
  return String(value).replace(/\s+/g, " ").trim().slice(0, max);
}

function decodeXml(value = "") {
  return String(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function firstTag(xml, tag) {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i").exec(xml);
  return match ? decodeXml(match[1]) : "";
}

function allTags(xml, tag) {
  const out = [];
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "gi");
  let match;
  while ((match = re.exec(xml))) {
    const value = decodeXml(match[1]);
    if (value) out.push(value);
  }
  return out;
}

function articleId(xml, type) {
  const re = new RegExp(`<ArticleId[^>]*IdType=["']${type}["'][^>]*>([\\s\\S]*?)<\\/ArticleId>`, "i");
  const match = re.exec(xml);
  return match ? decodeXml(match[1]) : "";
}

export function parsePubmedXml(xml, ranks = new Map()) {
  const blocks = String(xml).match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/gi) || [];
  return blocks.map(block => {
    const pmid = firstTag(block, "PMID");
    const abstract = allTags(block, "AbstractText").join(" ");
    const year = firstTag(block, "Year") || (firstTag(block, "MedlineDate").match(/\b(?:19|20)\d{2}\b/) || [""])[0];
    return {
      pmid,
      title: firstTag(block, "ArticleTitle"),
      abstract,
      journal: firstTag(block, "Title"),
      year,
      doi: articleId(block, "doi"),
      publicationTypes: [...new Set(allTags(block, "PublicationType"))],
      rank: ranks.get(pmid) ?? 99,
    };
  }).filter(item => item.pmid && item.title && item.abstract.length >= 120);
}

function evidenceWeight(source) {
  const types = source.publicationTypes.join(" ").toLowerCase();
  let type = 0;
  if (types.includes("practice guideline") || types.includes("guideline")) type = 45;
  else if (types.includes("meta-analysis")) type = 40;
  else if (types.includes("systematic review")) type = 36;
  else if (types.includes("review")) type = 25;
  else if (types.includes("clinical trial")) type = 20;
  const year = Number(source.year) || 0;
  const recency = year >= 2020 ? Math.min(12, year - 2019) : 0;
  return type + recency + Math.max(0, 24 - source.rank * 3);
}

export function rankPubmedSources(sources) {
  const unique = new Map();
  for (const source of sources) {
    if (!source?.pmid || !source.abstract) continue;
    const current = unique.get(source.pmid);
    if (!current || source.rank < current.rank) unique.set(source.pmid, source);
  }
  return [...unique.values()]
    .sort((a, b) => evidenceWeight(b) - evidenceWeight(a))
    .slice(0, MAX_SOURCES)
    .map((source, index) => ({
      ...source,
      id: index + 1,
      url: `https://pubmed.ncbi.nlm.nih.gov/${source.pmid}/`,
      database: "PubMed",
    }));
}

function parseJsonObject(text) {
  const raw = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try { return JSON.parse(raw); } catch {}
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)); } catch {}
  }
  return null;
}

function sanitizeConcept(value) {
  const cleaned = String(value || "")
    .replace(/[\[\](){}:;"'`]/g, " ")
    .replace(/[^a-zA-Z0-9\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (cleaned.length < 3 || cleaned.length > 48) return "";
  if (/\b(?:19|20)\d{2}\b|\b(?:and|or|not|year|title|abstract|author|journal)\b/.test(cleaned)) return "";
  return cleaned;
}

export function sanitizeSearchPlan(value) {
  const queries = [];
  for (const rawQuery of (Array.isArray(value?.queries) ? value.queries : []).slice(0, 2)) {
    const values = Array.isArray(rawQuery) ? rawQuery : [];
    const concepts = [...new Set(values.map(sanitizeConcept).filter(Boolean))].slice(0, 4);
    if (concepts.length >= 3) queries.push(concepts);
  }
  return queries;
}

function fallbackSearchPlan(topic) {
  const dictionary = new Map([
    ["homeostasia", "homeostasis"], ["homeostasis", "homeostasis"], ["cuerpo", "body"],
    ["organizacion", "organization"], ["tejidos", "tissues"], ["nervioso", "nervous system"],
    ["quimicas", "biochemistry"], ["celular", "cellular"], ["hormonas", "hormones"],
    ["cardiaca", "cardiac"], ["respiratoria", "respiratory"], ["renal", "renal"],
    ["sangre", "blood"], ["presion", "blood pressure"], ["huesos", "bone"],
  ]);
  const tokens = normalizeText(topic).split(" ").filter(token => token.length >= 4 && !STOPWORDS.has(token));
  const translated = [...new Set(tokens.map(token => dictionary.get(token) || token))].slice(0, 3);
  if (!translated.includes("physiology")) translated.push("physiology");
  if (translated.length < 3) translated.push("anatomy");
  return [translated.slice(0, 4)];
}

function buildBookContext(passages) {
  return (Array.isArray(passages) ? passages : []).slice(0, 8).map(p => {
    const page = Number(p?.page) || 0;
    const printed = cleanText(p?.printed, 20);
    return `[PÁGINA INTERNA ${page}${printed ? ` · IMPRESA ${printed}` : ""}] ${cleanText(p?.text, 1400)}`;
  }).filter(line => !line.startsWith("[PÁGINA INTERNA 0")).join("\n\n") || "(sin fragmentos suficientes del libro)";
}

export function buildSearchPlanMessages({ topic, objective = "", topics = [], bookContext = "" }) {
  return [
    { role: "system", content: `Convertí un tema de anatomía, fisiología o enfermería escrito en español en dos búsquedas biomédicas breves para PubMed. No respondas el tema ni afirmes que algo cambió. Devolvé SOLO JSON válido con esta forma exacta: {"queries":[["central topic","specific mechanism","domain context"],["central topic","modern nuance","domain context"]]}. Cada consulta debe tener 3 o 4 conceptos independientes en inglés, ordenados así: los dos primeros identifican específicamente el tema y el último evita resultados de otro dominio (por ejemplo physiology, anatomy, nursing o clinical care). No uses operadores, comillas, fechas ni sintaxis de PubMed.` },
    { role: "user", content: `Tema: ${cleanText(topic, 180)}\nObjetivo: ${cleanText(objective, 260)}\nConceptos de la lección: ${cleanText((topics || []).join(", "), 300)}\nFragmentos orientativos del libro:\n${String(bookContext).slice(0, 4200)}` },
  ];
}

function buildPubmedTerm(concepts) {
  const clauses = concepts.map(concept => {
    const safe = concept.replace(/"/g, "");
    return safe.includes(" ") ? `"${safe}"[Title/Abstract]` : `${safe}[Title/Abstract]`;
  });
  return clauses.length ? clauses.join(" AND ") : "";
}

async function pubmedSearch(concepts) {
  const term = buildPubmedTerm(concepts);
  if (!term) return [];
  const params = new URLSearchParams({ db: "pubmed", term, retmax: "6", sort: "relevance", retmode: "json", tool: "avici_neural_study" });
  if (process.env.NCBI_API_KEY) params.set("api_key", process.env.NCBI_API_KEY);
  const response = await fetch(`${PUBMED}/esearch.fcgi?${params}`, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) return [];
  const data = await response.json().catch(() => ({}));
  return data?.esearchresult?.idlist || [];
}

async function fetchPubmedArticles(ids, ranks) {
  if (!ids.length) return [];
  const params = new URLSearchParams({ db: "pubmed", id: ids.join(","), rettype: "abstract", retmode: "xml", tool: "avici_neural_study" });
  if (process.env.NCBI_API_KEY) params.set("api_key", process.env.NCBI_API_KEY);
  const response = await fetch(`${PUBMED}/efetch.fcgi?${params}`, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) return [];
  return parsePubmedXml(await response.text(), ranks);
}

export function isPubmedSourceRelevant(source, queries, matchedQueryIndexes) {
  const title = normalizeText(source?.title);
  if (!title) return false;
  return (matchedQueryIndexes || []).some(queryIndex => {
    const concepts = (queries[queryIndex] || []).map(normalizeText).filter(Boolean);
    return concepts.filter(concept => title.includes(concept)).length >= 2;
  });
}

export async function findPubmedSources(queries) {
  const lists = await Promise.all(queries.slice(0, 2).map(query => pubmedSearch(query).catch(() => [])));
  const ranks = new Map();
  const matches = new Map();
  lists.forEach((ids, queryIndex) => ids.forEach((id, index) => {
    const rank = queryIndex * 8 + index;
    if (!ranks.has(id) || rank < ranks.get(id)) ranks.set(id, rank);
    if (!matches.has(id)) matches.set(id, []);
    matches.get(id).push(queryIndex);
  }));
  const ids = [...ranks.keys()].slice(0, 10);
  const articles = await fetchPubmedArticles(ids, ranks).catch(() => []);
  const relevant = articles.filter(source => isPubmedSourceRelevant(source, queries, matches.get(source.pmid)));
  return rankPubmedSources(relevant);
}

async function callDeepSeek(key, messages, maxTokens, timeoutMs) {
  const base = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.1, max_tokens: maxTokens }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `DeepSeek respondió ${response.status}`);
  return data?.choices?.[0]?.message?.content || "";
}

function sourceContext(sources) {
  return sources.map(source => `FUENTE ${source.id} · PubMed PMID ${source.pmid}\nTítulo: ${source.title}\nAño: ${source.year || "sin fecha"}\nRevista: ${source.journal || "sin revista"}\nTipo: ${source.publicationTypes.join(", ") || "artículo"}\nResumen:\n${cleanText(source.abstract, 3500)}`).join("\n\n---\n\n");
}

export function buildResearchMessages({ topic, bookTitle, bookContext, sources, retrievedAt }) {
  return [
    { role: "system", content: `Sos un revisor de evidencia biomédica extremadamente conservador. Compará fragmentos del libro con resúmenes reales de PubMed, sin usar conocimiento externo ni completar huecos. Escribí el texto final en español claro.

REGLAS INNEGOCIABLES:
1. Todo dato sobre el libro debe incluir bookEvidence con una página entregada y una cita textual breve, consecutiva y exacta de ese fragmento.
2. Toda afirmación actual debe incluir sourceEvidence con sourceId y una cita textual breve, consecutiva y exacta del resumen correspondiente.
3. Una diferencia o debate requiere AMBOS tipos de evidencia. Si no está explícitamente demostrado, no lo incluyas.
4. No confundas "más reciente" con "contradice al libro". Una fuente nueva puede confirmar un concepto antiguo.
5. No afirmes que un término es menos común, obsoleto o reemplazado sin evidencia explícita.
6. Las citas deben tener entre 6 y 28 palabras, sin puntos suspensivos ni traducción. El texto explicativo sí va en español.
7. Devolvé SOLO JSON válido, sin Markdown ni comentarios.

FORMATO:
{
  "bookSummary":[{"text":"...","bookEvidence":{"page":12,"quote":"cita exacta"}}],
  "currentEvidence":[{"text":"...","sourceEvidence":[{"sourceId":1,"quote":"exact quote"}]}],
  "changes":[{"text":"...","bookEvidence":{"page":12,"quote":"cita exacta"},"sourceEvidence":[{"sourceId":1,"quote":"exact quote"}]}],
  "debates":[{"text":"...","bookEvidence":{"page":12,"quote":"cita exacta"},"sourceEvidence":[{"sourceId":2,"quote":"exact quote"}]}],
  "takeaway":{"text":"...","bookEvidence":{"page":12,"quote":"cita exacta"},"sourceEvidence":[{"sourceId":1,"quote":"exact quote"}]}
}
Usá arreglos vacíos cuando no haya evidencia. Máximos: 4 resúmenes del libro, 5 hallazgos actuales, 3 cambios y 3 debates.` },
    { role: "user", content: `Fecha de consulta: ${retrievedAt.slice(0, 10)}\nTema: ${cleanText(topic, 180)}\nLibro: ${cleanText(bookTitle, 180)}\n\n=== FRAGMENTOS DEL LIBRO ===\n${bookContext}\n\n=== LITERATURA RECUPERADA DE PUBMED ===\n${sourceContext(sources)}` },
  ];
}

function exactQuote(container, quote) {
  const normalizedQuote = normalizeText(quote);
  const words = normalizedQuote ? normalizedQuote.split(" ").length : 0;
  return words >= 6 && words <= 28 && normalizeText(container).includes(normalizedQuote);
}

function validBookEvidence(value, passagesByPage) {
  const page = Number(value?.page);
  const quote = cleanText(value?.quote, 360);
  const passage = passagesByPage.get(page) || "";
  return page && quote && exactQuote(passage, quote) ? { page, quote } : null;
}

function validSourceEvidence(value, sourcesById) {
  const out = [];
  for (const item of (Array.isArray(value) ? value : []).slice(0, 3)) {
    const sourceId = Number(item?.sourceId);
    const quote = cleanText(item?.quote, 360);
    const source = sourcesById.get(sourceId);
    if (source && quote && exactQuote(source.abstract, quote)) out.push({ sourceId, quote });
  }
  return [...new Map(out.map(item => [item.sourceId, item])).values()];
}

function validateClaim(value, context, requirements = {}) {
  const text = cleanText(value?.text, 760);
  if (!text) return null;
  const bookEvidence = validBookEvidence(value?.bookEvidence, context.passagesByPage);
  const sourceEvidence = validSourceEvidence(value?.sourceEvidence, context.sourcesById);
  if (requirements.book && !bookEvidence) return null;
  if (requirements.source && !sourceEvidence.length) return null;
  if (!bookEvidence && !sourceEvidence.length) return null;
  return { text, bookEvidence, sourceEvidence, sourceIds: sourceEvidence.map(item => item.sourceId) };
}

export function validateResearchResult(raw, passages, sources) {
  const passagesByPage = new Map();
  for (const passage of (Array.isArray(passages) ? passages : []).slice(0, 8)) {
    const page = Number(passage?.page);
    if (page) passagesByPage.set(page, `${passagesByPage.get(page) || ""} ${passage?.text || ""}`);
  }
  const sourcesById = new Map(sources.map(source => [source.id, source]));
  const context = { passagesByPage, sourcesById };
  const collect = (items, max, requirements) => (Array.isArray(items) ? items : []).slice(0, max).map(item => validateClaim(item, context, requirements)).filter(Boolean);
  return {
    bookSummary: collect(raw?.bookSummary, 4, { book: true }),
    currentEvidence: collect(raw?.currentEvidence, 5, { source: true }),
    changes: collect(raw?.changes, 3, { book: true, source: true }),
    debates: collect(raw?.debates, 3, { book: true, source: true }),
    takeaway: validateClaim(raw?.takeaway, context, {}),
  };
}

function citeSources(claim) {
  return claim.sourceIds.map(id => `[Fuente ${id}]`).join(" ");
}

function bookPage(claim) {
  return claim.bookEvidence ? `(pág. ${claim.bookEvidence.page})` : "";
}

export function renderResearchAnswer(result, reason = "") {
  const lines = [];
  if (result.bookSummary.length) {
    lines.push("## 📖 Qué dice el libro", ...result.bookSummary.map(item => `- ${item.text} ${bookPage(item)}`), "");
  }
  lines.push("## 🌐 Qué muestran las fuentes actuales");
  if (result.currentEvidence.length) lines.push(...result.currentEvidence.map(item => `- ${item.text} ${citeSources(item)}`));
  else lines.push(reason || "No pude verificar afirmaciones actuales con evidencia suficientemente vinculada al tema.");
  lines.push("");
  if (result.changes.length) {
    lines.push("## ⚠️ Qué cambió o se amplió", ...result.changes.map(item => `- ${item.text} ${bookPage(item)} ${citeSources(item)}`), "");
  } else {
    lines.push("## ✅ ¿Hay un cambio demostrable?", "Con la evidencia recuperada no se pudo demostrar una diferencia fiable frente a los fragmentos del libro.", "");
  }
  if (result.debates.length) {
    lines.push("## 💬 Qué se discute", ...result.debates.map(item => `- ${item.text} ${bookPage(item)} ${citeSources(item)}`), "");
  }
  if (result.takeaway) {
    const citations = [bookPage(result.takeaway), citeSources(result.takeaway)].filter(Boolean).join(" ");
    lines.push("## 🎯 Para acordarte", `${result.takeaway.text} ${citations}`.trim(), "");
  }
  return lines.join("\n").trim();
}

function publicSources(sources) {
  return sources.map(({ id, title, url, database, journal, year, publicationTypes, pmid }) => ({ id, title, url, database, journal, year, publicationTypes, pmid }));
}

function emptyResult(reason) {
  const result = { bookSummary: [], currentEvidence: [], changes: [], debates: [], takeaway: null };
  return { result, answer: renderResearchAnswer(result, reason), status: "no_reliable_evidence" };
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Método no permitido" }); return; }
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) { res.status(500).json({ error: "Falta DEEPSEEK_API_KEY en Vercel." }); return; }
  const user = await verifyUser(req);
  if (!user) { res.status(401).json({ error: "No autorizado." }); return; }
  if (!(await isApproved(user))) { res.status(403).json({ error: "Tu acceso todavía no está aprobado." }); return; }

  const body = readBody(req);
  const topic = cleanText(body.topic, 180);
  const bookTitle = cleanText(body.bookTitle || "el libro", 180);
  const objective = cleanText(body.objective, 260);
  const topics = Array.isArray(body.topics) ? body.topics.slice(0, 12).map(item => cleanText(item, 80)) : [];
  const passages = Array.isArray(body.passages) ? body.passages.slice(0, 8).map(p => ({ page: Number(p?.page) || 0, printed: cleanText(p?.printed, 20), text: cleanText(p?.text, 1400) })).filter(p => p.page && p.text) : [];
  if (!topic) { res.status(400).json({ error: "Falta el tema a investigar." }); return; }

  const retrievedAt = new Date().toISOString();
  const bookContext = buildBookContext(passages);
  let queries;
  try {
    const searchText = await callDeepSeek(key, buildSearchPlanMessages({ topic, objective, topics, bookContext }), 320, 12000);
    queries = sanitizeSearchPlan(parseJsonObject(searchText));
  } catch { queries = []; }
  if (!queries.length) queries = fallbackSearchPlan(topic);

  const sources = await findPubmedSources(queries).catch(() => []);
  if (!sources.length) {
    const empty = emptyResult("No encontré literatura de PubMed suficientemente relevante para este tema. Para no inventar, no genero un contraste.");
    res.status(200).json({ ...empty, sources: [], queries, model: MODEL, retrievedAt, researchVersion: "biomed-v2" });
    return;
  }

  try {
    const responseText = await callDeepSeek(key, buildResearchMessages({ topic, bookTitle, bookContext, sources, retrievedAt }), 2600, 26000);
    const parsed = parseJsonObject(responseText);
    if (!parsed) throw new Error("La respuesta no tuvo JSON válido");
    const result = validateResearchResult(parsed, passages, sources);
    const status = result.currentEvidence.length
      ? (result.changes.length || result.debates.length ? "contrast_found" : "current_evidence_only")
      : "no_reliable_evidence";
    const reason = status === "no_reliable_evidence" ? "Encontré artículos relacionados, pero ninguna afirmación superó la verificación de citas. Para no inventar, no genero un contraste." : "";
    res.status(200).json({ result, answer: renderResearchAnswer(result, reason), status, sources: publicSources(sources), queries, model: MODEL, retrievedAt, researchVersion: "biomed-v2" });
  } catch (error) {
    const empty = emptyResult("La evidencia se recuperó, pero no se pudo validar el análisis. Para no inventar, no genero un contraste.");
    res.status(200).json({ ...empty, sources: publicSources(sources), queries, model: MODEL, retrievedAt, researchVersion: "biomed-v2", validationError: cleanText(error?.message, 180) });
  }
}
