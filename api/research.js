// POST /api/research — Investigación web REAL (Wikipedia ES+EN en vivo) + contraste con el libro vía DeepSeek.
import { verifyUser, isApproved, readBody } from "./_lib.js";

async function wiki(lang, q) {
  try {
    const s = await fetch(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=3&format=json&origin=*`, { headers: { "User-Agent": "AVICI-EstudioApp/1.0 (educativo)" } });
    const sj = await s.json();
    const titles = (sj.query?.search || []).map(x => x.title);
    const out = [];
    for (const t of titles.slice(0, 3)) {
      try {
        const e = await fetch(`https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&redirects=1&titles=${encodeURIComponent(t)}&format=json&origin=*`, { headers: { "User-Agent": "AVICI-EstudioApp/1.0 (educativo)" } });
        const ej = await e.json();
        const pages = ej.query?.pages || {};
        const first = Object.values(pages)[0];
        if (first && first.extract) out.push({ lang, title: t, url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(t.replace(/ /g, "_"))}`, extract: first.extract.slice(0, 1600) });
      } catch {}
    }
    return out;
  } catch { return []; }
}

function relevant(sources, topic) {
  const toks = topic.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter(w => w.length >= 4);
  if (!toks.length) return sources;
  return sources.filter(s => { const t = (s.title + " " + s.extract).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); return toks.some(w => t.includes(w)); });
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Método no permitido" }); return; }
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) { res.status(500).json({ error: "Falta DEEPSEEK_API_KEY en Vercel." }); return; }
  const user = await verifyUser(req);
  if (!user) { res.status(401).json({ error: "No autorizado." }); return; }
  if (!(await isApproved(user))) { res.status(403).json({ error: "Tu acceso todavía no está aprobado." }); return; }

  const { topic = "", bookTitle = "el libro", passages = [] } = readBody(req);
  if (!topic) { res.status(400).json({ error: "Falta el tema a investigar." }); return; }

  const [es, en] = await Promise.all([wiki("es", topic), wiki("en", topic)]);
  let sources = relevant([...es, ...en], topic);
  if (!sources.length) sources = [...es, ...en];  // si el filtro deja vacío, usá lo que haya
  const webCtx = sources.length
    ? sources.map((s, i) => `FUENTE ${i + 1} [${s.lang}] (${s.title}):\n${s.extract}`).join("\n\n---\n\n")
    : "(no se encontraron fuentes web para este tema)";
  const bookCtx = (passages || []).slice(0, 8).map(p => `[pág. ${p.page}] ${String(p.text || "").slice(0, 1200)}`).join("\n\n") || "(sin fragmentos del libro)";

  const messages = [
    { role: "system", content:
`Sos un investigador clínico riguroso y didáctico. Compará lo que dice el LIBRO "${bookTitle}" con FUENTES ACTUALES de internet (Wikipedia ES/EN) sobre "${topic}", para una estudiante de enfermería argentina 🇦🇷 (Avici) que quiere ser neurocirujana. Escribí en español rioplatense, claro y motivador.
Devolvé MARKDOWN con EXACTAMENTE estas secciones:
## 📖 Qué dice el libro
(resumí; citá (pág. N) usando los fragmentos)
## 🌐 Qué se sabe hoy
(según las fuentes web; cuando uses una escribí [Fuente N])
## ⚠️ Qué cambió o se modernizó
(diferencias, cosas que el libro pueda tener desactualizadas, avances recientes)
## 💬 Qué se discute
(debates, matices o distintas miradas)
## 🎯 Para acordarte
Sé honesto: si las fuentes no alcanzan para algo, decilo; NO inventes datos ni fuentes.` },
    { role: "user", content: `TEMA: ${topic}\n\n=== FRAGMENTOS DEL LIBRO ===\n${bookCtx}\n\n=== FUENTES WEB (en vivo) ===\n${webCtx}` }
  ];

  const base = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-pro";
  try {
    const r = await fetch(`${base}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: 2600 }) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { res.status(502).json({ error: "DeepSeek: " + (data?.error?.message || JSON.stringify(data).slice(0, 200)) }); return; }
    res.status(200).json({ answer: data?.choices?.[0]?.message?.content || "", sources: sources.map(s => ({ title: s.title, url: s.url, lang: s.lang })), model });
  } catch (e) { res.status(502).json({ error: "Error: " + String(e).slice(0, 200) }); }
}
