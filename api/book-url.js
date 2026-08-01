// GET /api/book-url?id=thibodeau
// Devuelve un enlace temporal para que el navegador baje el PDF DIRECTO del almacenamiento,
// sin pasar por este servidor. Solo se entrega a quien tiene sesión válida y está aprobada.
import { verifyUser, isApproved } from "./_lib.js";
import { libroAzure, urlFirmadaDeLectura } from "./_azure.js";

const MINUTOS_DE_VIDA = 90;

export default async function handler(req, res) {
  if (req.method !== "GET") { res.status(405).json({ error: "Método no permitido." }); return; }

  const user = await verifyUser(req);
  if (!user) { res.status(401).json({ error: "No autorizado." }); return; }
  if (!(await isApproved(user))) { res.status(403).json({ error: "Tu acceso todavía no está aprobado." }); return; }

  const libro = libroAzure(req.query?.id);
  const cuenta = process.env.AZURE_STORAGE_ACCOUNT;
  const clave = process.env.AZURE_STORAGE_KEY;
  /* Si este libro no está en Azure, no es un error: el lector se cae al proxy de siempre. */
  if (!libro || !cuenta || !clave) { res.status(404).json({ error: "Este libro no tiene entrega directa." }); return; }

  try {
    const { url, expira } = urlFirmadaDeLectura({
      cuenta, clave, contenedor: libro.contenedor, blob: libro.blob, minutos: MINUTOS_DE_VIDA,
    });
    /* Nunca cachear: el enlace vence y quedaría uno muerto guardado en el navegador. */
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.status(200).json({ url, expira });
  } catch (e) {
    res.status(500).json({ error: "No se pudo preparar el enlace del libro." });
  }
}
