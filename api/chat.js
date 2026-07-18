// POST /api/chat — Motor IA del curso (proxy seguro a DeepSeek).
// task: 'chat' | 'curriculum' | 'lesson' | 'contrast'
import { verifyUser, isApproved, readBody } from "./_lib.js";

const AR = 'estudiante de enfermería argentina 🇦🇷 (Avici) que sueña con ser neurocirujana. Hablá en español rioplatense, cercano, motivador y con humor cuando cae bien, pero riguroso.';

function ctxFrom(passages) {
  return (passages || []).slice(0, 14)
    .map(p => `[pág. ${p.page}] ${String(p.text || "").slice(0, 1500)}`)
    .join("\n\n---\n\n") || "(sin fragmentos)";
}

function buildMessages(task, body) {
  const { bookTitle = "el libro", passages = [], question = "", selectedText = "", history = [], meta = {} } = body;
  const ctx = ctxFrom(passages);
  if (task === "curriculum") {
    return { json: true, messages: [{ role: "system", content:
`Sos un diseñador instruccional experto en ciencias de la salud. A partir del ÍNDICE/CONTENIDO del libro "${bookTitle}", diseñá un CURSO didáctico completo (ruta de aprendizaje de lo básico a lo avanzado) para una ${AR}
Devolvé SOLO JSON válido, sin texto extra, con esta forma exacta:
{"title":"Nombre del curso","units":[{"title":"...","emoji":"🧠","lessons":[{"title":"...","objective":"una frase","topics":["t1","t2","t3"],"pageStart":N,"pageEnd":N}]}]}
Reglas: cubrí TODO el libro; 5 a 9 unidades; cada unidad 3 a 8 lecciones; títulos claros y motivadores; pageStart/pageEnd = páginas aproximadas según el índice (números enteros). NADA fuera del JSON.` },
      { role: "user", content: "ÍNDICE / CONTENIDO DEL LIBRO:\n" + ctx }] };
  }
  if (task === "lesson") {
    return { json: true, messages: [{ role: "system", content:
`Sos un profesor genial y didáctico. Creá una LECCIÓN interactiva y entretenida sobre "${meta.title}" (objetivo: ${meta.objective || ""}) basándote SOLO en los fragmentos del libro "${bookTitle}" (citá la página así (pág. N), nunca inventes páginas). Para una ${AR}
Devolvé SOLO JSON válido con esta forma exacta:
{"content":"explicación en MARKDOWN: intro motivadora, desarrollo con analogías y ejemplos clínicos, negritas **así**, listas, y citas (pág. N). Terminá con '🎯 Para acordarte:'","keyTerms":[{"term":"...","def":"..."}],"quiz":[{"q":"...","options":["...","...","...","..."],"answer":0,"explain":"por qué, con (pág. N)"}],"flashcards":[{"front":"pregunta o concepto","back":"respuesta breve"}]}
Incluí 4-6 preguntas de quiz (answer = índice 0-3 de la correcta), 6-8 flashcards, 5-8 términos clave. Si algo no está en los fragmentos, no lo inventes. NADA fuera del JSON.` },
      { role: "user", content: "FRAGMENTOS DEL LIBRO (con su página):\n" + ctx }] };
  }
  if (task === "contrast") {
    return { json: false, messages: [{ role: "system", content:
`Sos un investigador clínico. Tema: "${meta.title}". Compará lo que dice el libro "${bookTitle}" (fragmentos abajo) con el CONOCIMIENTO ACTUAL de la medicina/enfermería. Explicá en MARKDOWN, para una ${AR}:
1. 📖 Qué dice el libro (citá pág. N).
2. 🌐 Qué se sabe/consensúa HOY (conocimiento general; aclarale que el libro puede ser de hace años).
3. ⚠️ Diferencias, cosas que se modernizaron o cambiaron, y mitos.
4. 💬 "Qué se discute": puntos donde hay debate o distintas opiniones.
Sé honesto: si no estás seguro, decilo. FRAGMENTOS DEL LIBRO:\n${ctx}` },
      { role: "user", content: meta.title ? ("Analizá el tema: " + meta.title) : (question || "Contrastá este tema con la actualidad.") }] };
  }
  // chat (profe experto, natural, autosuficiente)
  const userMsg = (selectedText ? `Che, mirá esto que seleccioné del material:\n"""${String(selectedText).slice(0, 1500)}"""\n\n` : "") + (question || "Explicame esto.");
  return { json: false, messages: [
    { role: "system", content:
`Sos "el Profe": un profesor de anatomía, fisiología y enfermería excepcional —brillante, con calle y muy buena onda— que le enseña a Avici, una ${AR}

CÓMO HABLÁS:
- Como una persona real charlando, NO como un bot. Nada de "como modelo de IA", "no puedo", "no tengo acceso", ni disclaimers robóticos. Jamás te disculpes por lo que sos.
- Español rioplatense natural (vos, tenés, mirá), cálido y con humor cuando cae bien. Directo y claro.
- Sos capaz y resolutivo: SIEMPRE ayudás y encontrás la manera. Si algo es ambiguo, asumí lo más razonable y respondé; no devuelvas la pregunta salvo que sea imprescindible.

QUÉ SABÉS:
- Te sabés estos libros al derecho y al revés, y además toda la anatomía, fisiología y enfermería como una eminencia.
- Abajo tenés FRAGMENTOS del libro con su número de página: son tu memoria del libro. Cuando menciones algo puntual que está ahí, deslizá la página con naturalidad (ej: "eso lo tenés en la página 485"), sin inventar números.
- Si algo NO está en los fragmentos, igual lo explicás como el experto que sos, con total naturalidad —sin carteles tipo "fuera del libro" ni aclaraciones defensivas—. Si el libro quedó viejo o se contradice, lo decís tranquilo, como lo diría un buen profe.

CÓMO ENSEÑÁS:
- Que se entienda y se recuerde: ejemplos clínicos, analogías, y si suma, cerrás con un truquito para memorizar.
- Ajustá el largo a la pregunta (respuestas cortas si la pregunta es corta; no llenes de texto).
- Precisión médica: no inventes dosis ni datos exactos; si no estás 100% seguro de un número, decilo como lo diría un profe honesto, pero seguí siendo útil.

FRAGMENTOS DEL LIBRO (tu memoria, con su página):
${ctx}` },
    ...(Array.isArray(history) ? history.slice(-10).filter(m => m && m.role && m.content) : []),
    { role: "user", content: userMsg }
  ] };
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Método no permitido" }); return; }
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) { res.status(500).json({ error: "Falta DEEPSEEK_API_KEY en Vercel." }); return; }
  const user = await verifyUser(req);
  if (!user) { res.status(401).json({ error: "No autorizado. Iniciá sesión de nuevo." }); return; }
  if (!(await isApproved(user))) { res.status(403).json({ error: "Tu acceso todavía no está aprobado." }); return; }

  const body = readBody(req);
  const task = ["chat", "curriculum", "lesson", "contrast"].includes(body.task) ? body.task : "chat";
  const mode = body.mode === "flash" ? "flash" : "pro";
  const built = buildMessages(task, body);

  const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const model = mode === "flash" ? "deepseek-v4-flash" : (process.env.DEEPSEEK_MODEL || "deepseek-v4-pro");
  const payload = { model, messages: built.messages, temperature: task === "lesson" || task === "curriculum" ? 0.4 : 0.5, max_tokens: (task === "curriculum" || task === "lesson") ? 8000 : 2500 };
  if (built.json) payload.response_format = { type: "json_object" };

  try {
    const r = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { res.status(502).json({ error: "DeepSeek: " + (data?.error?.message || JSON.stringify(data).slice(0, 300)) }); return; }
    const content = data?.choices?.[0]?.message?.content || "";
    if (built.json) {
      let parsed = null;
      try { parsed = JSON.parse(content); }
      catch { const m = content.match(/\{[\s\S]*\}/); if (m) { try { parsed = JSON.parse(m[0]); } catch {} } }
      if (!parsed) { res.status(502).json({ error: "El modelo no devolvió JSON válido.", raw: content.slice(0, 900), finish: data?.choices?.[0]?.finish_reason || null, contentLen: content.length, reasoningLen: (data?.choices?.[0]?.message?.reasoning_content || "").length }); return; }
      res.status(200).json({ result: parsed, model, usage: data?.usage || null });
    } else {
      res.status(200).json({ answer: content || "(sin respuesta)", model, usage: data?.usage || null });
    }
  } catch (e) {
    res.status(502).json({ error: "Error llamando a DeepSeek: " + String(e).slice(0, 200) });
  }
}
