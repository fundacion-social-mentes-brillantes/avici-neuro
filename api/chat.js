// POST /api/chat  — Asistente IA especialista en los libros (proxy seguro a DeepSeek).
// El cliente hace la búsqueda (RAG) y manda los pasajes relevantes con su nº de página.
import { verifyUser, isApproved, readBody } from "./_lib.js";

const SYSTEM = (bookTitle, ctx) => `Sos un PROFESOR ESPECIALISTA en el libro "${bookTitle}". Tu alumna es Florencia (le dicen "Avici"), estudiante de enfermería en Argentina 🇦🇷 que sueña con ser neurocirujana. Hablás en español rioplatense: cercano, motivador y con humor cuando cae bien, pero SIEMPRE riguroso y preciso.

REGLAS IMPORTANTES:
1. Basá tus respuestas en los FRAGMENTOS DEL LIBRO que te paso abajo (CONTEXTO). Cada fragmento trae su número de página.
2. Cuando afirmes algo que viene del libro, CITÁ la página así: (pág. N). Nunca inventes un número de página.
3. Si la respuesta NO está en los fragmentos, decilo claro: "Esto no aparece en las páginas que tengo acá". Si igual sabés la respuesta por conocimiento general, agregala en una sección aparte titulada "📌 Fuera del libro (conocimiento general)".
4. Si ves una CONTRADICCIÓN, un dato confuso o algo que el libro dice distinto en dos lados, marcalo con "⚠️ Ojo:".
5. Enseñá de forma DIDÁCTICA: definí los términos difíciles, usá ejemplos y analogías clínicas, y cuando sirva resumí en pasos o listas. Terminá, si aplica, con un mini "🎯 Para acordarte:".
6. No te inventes datos médicos. Ante la duda, decí que no estás seguro.

CONTEXTO (fragmentos del libro con su página):
${ctx || "(no se encontraron fragmentos relevantes en el libro para esta pregunta)"}`;

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Método no permitido" }); return; }

  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    res.status(500).json({ error: "Falta DEEPSEEK_API_KEY. Agregala en Vercel → Settings → Environment Variables." });
    return;
  }

  const user = await verifyUser(req);
  if (!user) { res.status(401).json({ error: "No autorizado. Iniciá sesión de nuevo." }); return; }
  if (!(await isApproved(user))) { res.status(403).json({ error: "Tu acceso todavía no está aprobado." }); return; }

  const { bookTitle = "el libro", passages = [], question = "", selectedText = "", history = [] } = readBody(req);
  if (!question && !selectedText) { res.status(400).json({ error: "Falta la pregunta." }); return; }

  const ctx = (passages || [])
    .slice(0, 10)
    .map((p) => `[pág. ${p.page}${p.printed ? " · impresa " + p.printed : ""}] ${String(p.text || "").slice(0, 1400)}`)
    .join("\n\n---\n\n");

  const userMsg =
    (selectedText ? `Sobre este fragmento que seleccioné:\n"""${String(selectedText).slice(0, 1500)}"""\n\n` : "") +
    (question || "Explicame esto.");

  const messages = [
    { role: "system", content: SYSTEM(bookTitle, ctx) },
    ...(Array.isArray(history) ? history.slice(-8).filter((m) => m && m.role && m.content) : []),
    { role: "user", content: userMsg },
  ];

  const base = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

  try {
    const r = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 2000, stream: false }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      res.status(502).json({ error: "DeepSeek: " + (data?.error?.message || JSON.stringify(data).slice(0, 300)) });
      return;
    }
    const answer = data?.choices?.[0]?.message?.content || "(sin respuesta)";
    res.status(200).json({ answer, model, usage: data?.usage || null });
  } catch (e) {
    res.status(502).json({ error: "Error llamando a DeepSeek: " + String(e).slice(0, 200) });
  }
}
