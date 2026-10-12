// /api/english — el servidor del curso de inglés.
//
//   GET  ?task=config        → dirección y firma temporal de los audios, y qué está activo
//   GET  ?task=speech-token  → permiso de 10 minutos para la evaluación de pronunciación de Azure
//   POST {task:"write"}      → corrección de una tarea escrita
//   POST {task:"speak"}      → devolución de la tarea oral (4/3/2)
//   POST {task:"roleplay"}   → siguiente turno del personaje en el juego de roles
//
// Todo exige sesión válida y acceso aprobado, igual que el resto de AVICI, y falla cerrado.
// Las llaves (DeepSeek, Anthropic, Azure) viven solo en las variables de Vercel.

import { verifyUser, isApproved, readBody } from "./_lib.js";
import { CONTENEDOR_AUDIO_INGLES, firmaDeContenedor } from "./_azure.js";
import { AiError, advancedAvailable, callClaude, callDeepSeek, SCHEMAS } from "./_ai.js";
import {
  clean, levelOf, normalizeRoleplayTurn, normalizeSpeakingFeedback, normalizeWritingFeedback,
  roleplayPrompt, speakingPrompt, writingPrompt,
} from "./_english.js";

const AUDIO_MINUTES = 120;

function speechConfigured() {
  return Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
}

async function speechToken() {
  const region = process.env.AZURE_SPEECH_REGION;
  const response = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY, "Content-Length": "0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Azure Speech respondió ${response.status}`);
  return { token: await response.text(), region };
}

async function runAi(task, body, user) {
  let prompt;
  if (task === "write") {
    if (clean(body.text).split(/\s+/).filter(Boolean).length < 3) throw new AiError("Escribe tu texto antes de pedir la corrección.", { status: 400 });
    const { system, user: content } = writingPrompt(body);
    prompt = { system, messages: [{ role: "user", content }] };
  } else if (task === "speak") {
    const { system, user: content } = speakingPrompt(body);
    prompt = { system, messages: [{ role: "user", content }] };
  } else {
    prompt = roleplayPrompt(body);
    if (!prompt) throw new AiError("La conversación tiene que terminar con un mensaje tuyo.", { status: 400 });
  }
  const advanced = body.advanced === true && advancedAvailable();
  const { result, model, usage } = advanced
    ? await callClaude({ ...prompt, schema: SCHEMAS[task] })
    : await callDeepSeek({ ...prompt, user });
  const goals = Array.isArray(body.goals) ? body.goals.length : 0;
  const normalized = task === "write"
    ? normalizeWritingFeedback(result)
    : task === "speak" ? normalizeSpeakingFeedback(result) : normalizeRoleplayTurn(result, goals);
  return { result: normalized, model, advanced, usage };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (!["GET", "POST"].includes(req.method)) { res.status(405).json({ error: "Método no permitido." }); return; }
  const user = await verifyUser(req);
  if (!user) { res.status(401).json({ error: "No autorizado. Inicia sesión de nuevo." }); return; }
  if (!(await isApproved(user))) { res.status(403).json({ error: "Tu acceso todavía no está aprobado." }); return; }

  if (req.method === "GET") {
    const task = String(req.query?.task || "");
    if (task === "config") {
      const cuenta = process.env.AZURE_STORAGE_ACCOUNT;
      const clave = process.env.AZURE_STORAGE_KEY;
      const audio = cuenta && clave
        ? firmaDeContenedor({ cuenta, clave, contenedor: CONTENEDOR_AUDIO_INGLES, minutos: AUDIO_MINUTES })
        : null;
      res.status(200).json({ audio, speech: speechConfigured(), advancedAI: advancedAvailable() });
      return;
    }
    if (task === "speech-token") {
      if (!speechConfigured()) { res.status(503).json({ error: "La evaluación de pronunciación todavía no está configurada." }); return; }
      try { res.status(200).json(await speechToken()); }
      catch { res.status(502).json({ error: "No se pudo pedir el permiso de pronunciación a Azure." }); }
      return;
    }
    res.status(400).json({ error: "Tarea desconocida." });
    return;
  }

  const body = readBody(req);
  const task = ["write", "speak", "roleplay"].includes(body.task) ? body.task : null;
  if (!task) { res.status(400).json({ error: "Tarea desconocida." }); return; }
  body.level = levelOf(body.level);
  try {
    res.status(200).json(await runAi(task, body, user));
  } catch (error) {
    const status = error instanceof AiError ? error.status : 500;
    res.status(status).json({
      error: error instanceof AiError ? error.message : "No se pudo completar la corrección.",
      retryable: error instanceof AiError ? error.retryable : false,
    });
  }
}
