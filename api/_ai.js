// Los dos modelos que corrigen y conversan en el curso de inglés.
//
// - DeepSeek (el de siempre en AVICI): barato, es la opción normal.
// - Claude Haiku 5.5 ("IA avanzada"): corrige mejor el inglés. Solo se usa si la persona
//   activa el interruptor, y cuesta US$0,10 por millón de tokens de entrada y US$0,50 por
//   millón de salida (precios de Anthropic al 6 de octubre de 2026).
//
// Ambos devuelven el mismo objeto ya interpretado; quien llama solo normaliza.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { parseJsonResult } from "./chat.js";

export const ADVANCED_MODEL = "claude-haiku-5-5";

export class AiError extends Error {
  constructor(message, { status = 502, retryable = false } = {}) {
    super(message);
    this.name = "AiError";
    this.status = status;
    this.retryable = retryable;
  }
}

/* ---------- Formas de respuesta (solo las usa Claude; DeepSeek las recibe descritas) ---------- */

const correctionShape = z.object({ original: z.string(), corrected: z.string(), why: z.string() });

export const SCHEMAS = {
  write: z.object({
    scores: z.object({ content: z.number(), communicative: z.number(), organisation: z.number(), language: z.number() }),
    overall: z.string(),
    strengths: z.array(z.string()),
    corrections: z.array(correctionShape),
    checklist: z.array(z.object({ item: z.string(), met: z.boolean() })),
    nextStep: z.string(),
  }),
  speak: z.object({
    scores: z.object({ task: z.number(), range: z.number(), accuracy: z.number(), fluency: z.number() }),
    overall: z.string(),
    strengths: z.array(z.string()),
    corrections: z.array(correctionShape),
    targetUsed: z.array(z.string()),
    nextStep: z.string(),
  }),
  roleplay: z.object({
    reply: z.string(),
    goalsMet: z.array(z.number()),
    correction: z.object({ said: z.string(), better: z.string(), why: z.string() }).nullable(),
    finished: z.boolean(),
  }),
};

/* ---------- DeepSeek ---------- */

export async function callDeepSeek({ system, messages, user, timeoutMs = 25000 }) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new AiError("Falta DEEPSEEK_API_KEY en Vercel.", { status: 500 });
  const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...messages],
      /* Igual que en api/chat.js: si no se manda, DeepSeek enciende el modo "pensar". */
      thinking: { type: "disabled" },
      temperature: 0.4,
      max_tokens: 2500,
      response_format: { type: "json_object" },
      user_id: user?.uid,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new AiError(`DeepSeek: ${data?.error?.message || `HTTP ${response.status}`}`, { retryable: response.status >= 500 || response.status === 429 });
  const parsed = parseJsonResult(data?.choices?.[0]?.message?.content || "");
  if (!parsed) throw new AiError("La respuesta de la IA llegó incompleta. Prueba otra vez.", { retryable: true });
  return { result: parsed, model, usage: data?.usage || null };
}

/* ---------- Claude Haiku 5.5 ---------- */

let anthropicClient = null;
function anthropic() {
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 25000, maxRetries: 1 });
  return anthropicClient;
}

export function advancedAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function callClaude({ system, messages, schema }) {
  if (!advancedAvailable()) throw new AiError("La IA avanzada todavía no está configurada.", { status: 503 });
  let response;
  try {
    /* Haiku 5.5 piensa por defecto; con esfuerzo bajo piensa lo justo y responde rápido.
       No acepta temperature ni prefill: el formato lo garantiza la salida estructurada. */
    response = await anthropic().messages.parse({
      model: ADVANCED_MODEL,
      max_tokens: 4000,
      system,
      messages,
      output_config: { effort: "low", format: zodOutputFormat(schema) },
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) throw new AiError("La IA avanzada está ocupada. Prueba en un momento.", { status: 429, retryable: true });
    if (error instanceof Anthropic.AuthenticationError) throw new AiError("La llave de la IA avanzada no es válida.", { status: 500 });
    if (error instanceof Anthropic.APIConnectionError) throw new AiError("No se pudo conectar con la IA avanzada.", { retryable: true });
    if (error instanceof Anthropic.APIError) throw new AiError(`IA avanzada: error ${error.status}.`, { retryable: Number(error.status) >= 500 });
    throw error;
  }
  if (response.stop_reason === "refusal") throw new AiError("La IA avanzada no quiso responder a esto. Prueba con la IA normal.", { status: 422 });
  if (response.stop_reason === "max_tokens" || !response.parsed_output) throw new AiError("La respuesta de la IA avanzada llegó incompleta. Prueba otra vez.", { retryable: true });
  return { result: response.parsed_output, model: ADVANCED_MODEL, usage: response.usage || null };
}
