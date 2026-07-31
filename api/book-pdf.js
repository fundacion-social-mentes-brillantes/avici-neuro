// GET /api/book-pdf?id=thibodeau|mazarrasa|vacunador
// Proxy privado con soporte Range para que PDF.js descargue solo lo necesario.
import { Readable } from "node:stream";
import { verifyUser, isApproved } from "./_lib.js";

const APPROVAL_TTL_MS = 60_000;
const approvalCache = new Map();

export function bookUrlFor(id, env = process.env) {
  const urls = {
    thibodeau: env.BOOK_THIBODEAU_PDF_URL,
    mazarrasa: env.BOOK_MAZARRASA_PDF_URL,
    vacunador: env.BOOK_VACUNADOR_PDF_URL,
  };
  return urls[String(id || "").toLowerCase()] || null;
}

/* Cabeceras que se le piden al almacenamiento privado.
   NUNCA se reenvía If-None-Match. El ETag identifica al PDF completo, no al trozo: al
   revalidar un rango el almacenamiento devolvía 304 y el navegador reutilizaba el trozo
   que ya tenía guardado para esa misma URL. Así PDF.js recibía el principio del libro
   donde esperaba la tabla xref y moría con "Invalid PDF structure". */
export function upstreamRequestHeaders(requestHeaders = {}, blobToken) {
  const headers = { Authorization: `Bearer ${blobToken}` };
  const range = requestHeaders.range || requestHeaders.Range;
  if (range) headers.Range = range;
  return headers;
}

/* Cabeceras que se devuelven al navegador: se copian las que describen el trozo entregado,
   pero se omiten los validadores (ETag/Last-Modified) y se marca no-store, porque todos los
   rangos comparten la misma URL y cachearlos los mezcla entre sí. */
export function downstreamHeaders(upstream) {
  const headers = {
    "Content-Type": "application/pdf",
    "Content-Disposition": "inline",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  for (const name of ["accept-ranges", "content-length", "content-range"]) {
    const value = upstream.headers.get(name);
    if (value) headers[name] = value;
  }
  return headers;
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

  /* Si quien lee se va, hay que cortar TAMBIEN la descarga desde el almacenamiento.
     PDF.js abre el documento con una peticion sin Range y la aborta apenas lee las
     cabeceras, pero la funcion seguia bajando el PDF entero (461 MB) para tirarlo a la
     basura. Eso se cobra como transferencia: asi se consumio casi toda la cuota mensual. */
  const cortar = new AbortController();
  res.on("close", () => cortar.abort());

  let upstream;
  try { upstream = await fetch(sourceUrl, { method: req.method, headers: upstreamRequestHeaders(req.headers, blobToken), signal: cortar.signal }); }
  catch {
    if (!res.writableEnded && !res.destroyed) res.status(502).json({ error: "No se pudo abrir la página original." });
    return;
  }

  /* Cualquier respuesta que no sea el contenido pedido (304 sin cuerpo, o un error del
     almacenamiento) se corta acá: entregarla como application/pdf le daría bytes falsos
     a PDF.js y el mensaje de error sería incomprensible para quien está estudiando. */
  if (!upstream.ok) { res.status(502).json({ error: "No se pudo leer esta parte del libro. Probá de nuevo." }); return; }

  for (const [name, value] of Object.entries(downstreamHeaders(upstream))) res.setHeader(name, value);
  res.status(upstream.status);

  if (req.method === "HEAD" || !upstream.body) { res.end(); return; }
  const cuerpo = Readable.fromWeb(upstream.body);
  res.on("close", () => cuerpo.destroy());
  cuerpo.pipe(res);
}
