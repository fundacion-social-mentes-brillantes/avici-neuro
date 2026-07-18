// Utilidades compartidas para las funciones serverless.
// Verifica el ID token de Firebase (sin service account) y el estado de aprobación.
import { jwtVerify, createRemoteJWKSet } from "jose";

export const PROJECT = "avici-3eb47";
export const ADMIN_EMAIL = "fundacionsocial@gimnasioemocionalmb.com";

const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

// Devuelve {uid, email, token} si el ID token es válido; si no, null.
export async function verifyUser(req) {
  const auth = req.headers?.authorization || req.headers?.Authorization || "";
  const m = /^Bearer (.+)$/.exec(auth);
  if (!m) return null;
  try {
    const { payload } = await jwtVerify(m[1], JWKS, {
      issuer: `https://securetoken.google.com/${PROJECT}`,
      audience: PROJECT,
    });
    return { uid: payload.user_id || payload.sub, email: payload.email || "", token: m[1] };
  } catch {
    return null;
  }
}

// ¿El usuario es admin o está aprobado? Lee su propio doc en Firestore vía REST
// con su ID token (las reglas permiten leer el doc propio). Ante cualquier error,
// falla cerrado: un problema de red nunca debe convertirse en permiso de acceso.
export async function isApproved(user) {
  if ((user.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase()) return true;
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users/${user.uid}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${user.token}` } });
    if (!r.ok) return false;
    const d = await r.json();
    const status = d?.fields?.status?.stringValue;
    return status === "approved";
  } catch { return false; }
}

export function readBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  return body || {};
}
