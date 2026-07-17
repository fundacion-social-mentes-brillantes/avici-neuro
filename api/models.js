// GET /api/models — lista los modelos disponibles en la cuenta DeepSeek (para elegir el más potente).
// Requiere estar logueado (ID token válido). No expone la key.
import { verifyUser } from "./_lib.js";

export default async function handler(req, res) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) { res.status(500).json({ error: "Falta DEEPSEEK_API_KEY en Vercel." }); return; }

  const user = await verifyUser(req);
  if (!user) { res.status(401).json({ error: "No autorizado." }); return; }

  const base = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  try {
    const r = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${key}` } });
    const data = await r.json().catch(() => ({}));
    res.status(r.ok ? 200 : 502).json(data);
  } catch (e) {
    res.status(502).json({ error: String(e).slice(0, 200) });
  }
}
