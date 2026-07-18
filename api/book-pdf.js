// GET /api/book-pdf?id=thibodeau|mazarrasa
// Proxy privado con soporte Range para que PDF.js descargue solo lo necesario.
import { Readable } from "node:stream";
import { verifyUser, isApproved } from "./_lib.js";

const APPROVAL_TTL_MS = 60_000;
const approvalCache = new Map();

export function bookUrlFor(id, env = process.env) {
  const urls = {
    thibodeau: env.BOOK_THIBODEAU_PDF_URL,
    mazarrasa: env.BOOK_MAZARRASA_PDF_URL,
  };
  return urls[String(id || "").toLowerCase()] || null;
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
  if (req.method !== "GET" && req.method !== "HEAD") { res.status(405).json({ error: "Método no permitido." }); return; }
  const user = await verifyUser(req);
  if (!user || !(await hasBookAccess(user))) { res.status(403).json({ error: "Acceso no autorizado." }); return; }

  const sourceUrl = bookUrlFor(req.query?.id);
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!sourceUrl || !blobToken) { res.status(503).json({ error: "La edición visual de este libro todavía no está disponible." }); return; }

  const upstreamHeaders = { Authorization: `Bearer ${blobToken}` };
  if (req.headers.range) upstreamHeaders.Range = req.headers.range;
  if (req.headers["if-none-match"]) upstreamHeaders["If-None-Match"] = req.headers["if-none-match"];

  let upstream;
  try { upstream = await fetch(sourceUrl, { method: req.method, headers: upstreamHeaders }); }
  catch { res.status(502).json({ error: "No se pudo abrir la página original." }); return; }

  const forwarded = ["accept-ranges", "content-length", "content-range", "etag", "last-modified"];
  for (const name of forwarded) { const value = upstream.headers.get(name); if (value) res.setHeader(name, value); }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "inline");
  res.setHeader("Cache-Control", "private, no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.status(upstream.status);

  if (req.method === "HEAD" || !upstream.body || upstream.status === 304) { res.end(); return; }
  Readable.fromWeb(upstream.body).pipe(res);
}
