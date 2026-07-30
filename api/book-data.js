// GET /api/book-data?id=vacunador
// Respaldo privado para libros cuyo texto todavía no fue importado a Firestore.
import { verifyUser, isApproved } from "./_lib.js";

const APPROVAL_TTL_MS = 60_000;
const approvalCache = new Map();
const BOOK_DATA = {
  vacunador: {
    envName: "BOOK_VACUNADOR_TEXT_URL",
    title: "Manual del vacunador - GCBA, 3.ª edición (2013)",
    version: "blob-vacunador-2013-r1",
  },
};

export function bookDataUrlFor(id, env = process.env) {
  const config = BOOK_DATA[String(id || "").toLowerCase()];
  return config ? env[config.envName] || null : null;
}

export function normalizePrivateBookData(source, bookId) {
  const id = String(bookId || "").toLowerCase();
  const config = BOOK_DATA[id];
  if (!config || !source || source.id !== id || !Array.isArray(source.pages) || !source.pages.length) return null;
  return {
    id,
    title: source.title || config.title,
    pages: source.pages,
    contentVersion: config.version,
    cacheVersion: config.version,
  };
}

async function hasBookAccess(user) {
  const now = Date.now(), cached = approvalCache.get(user.uid);
  if (cached && now - cached.at < APPROVAL_TTL_MS) return cached.ok;
  const ok = await isApproved(user);
  if (approvalCache.size > 100) approvalCache.clear();
  approvalCache.set(user.uid, { ok, at: now });
  return ok;
}

export default async function handler(req, res) {
  if (req.method !== "GET") { res.status(405).json({ error: "Método no permitido." }); return; }
  const user = await verifyUser(req);
  if (!user || !(await hasBookAccess(user))) { res.status(403).json({ error: "Acceso no autorizado." }); return; }

  const bookId = String(req.query?.id || "").toLowerCase();
  const sourceUrl = bookDataUrlFor(bookId);
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!sourceUrl || !blobToken) { res.status(404).json({ error: "El texto de este libro no está disponible." }); return; }
  const config = BOOK_DATA[bookId];
  if (String(req.query?.meta || "") === "1") {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.status(200).json({
      id: bookId,
      title: config.title,
      contentVersion: config.version,
      cacheVersion: config.version,
    });
    return;
  }

  let upstream;
  try { upstream = await fetch(sourceUrl, { headers: { Authorization: `Bearer ${blobToken}` } }); }
  catch { res.status(502).json({ error: "No se pudo abrir el texto privado del libro." }); return; }
  if (!upstream.ok) { res.status(502).json({ error: "El almacenamiento privado no entregó el libro." }); return; }

  let source;
  try { source = await upstream.json(); }
  catch { res.status(502).json({ error: "El texto privado del libro no tiene un formato válido." }); return; }
  const payload = normalizePrivateBookData(source, bookId);
  if (!payload) {
    res.status(502).json({ error: "El texto privado del libro está incompleto." });
    return;
  }

  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.status(200).json(payload);
}
