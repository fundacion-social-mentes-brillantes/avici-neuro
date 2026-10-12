// Genera los audios de las lecciones de inglés con ElevenLabs.
//
//   node tools/english-audio.mjs --dry-run en-a1-01 en-b2-13   → cuánto costaría, sin gastar
//   node tools/english-audio.mjs en-a1-01 en-b2-13             → genera lo que falte
//   node tools/english-audio.mjs --samples                     → una frase por voz, para escucharlas
//
// Cada audio se guarda como output/ingles-audio/<lección>/<clave>.mp3. La clave depende del
// texto, la voz y la velocidad (english-utils.js → audioKey), así que volver a correrlo solo
// genera lo nuevo o lo corregido: nunca se paga dos veces por el mismo audio.
//
// La llave se lee de ELEVENLABS_API_KEY o del archivo de la skill eleven, y nunca se imprime.
// Hay un tope de gasto: si el lote pasa de --max-credits (20.000 por defecto) no arranca.

import { mkdir, readFile, readdir, unlink, writeFile, access } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { EXPRESSIVE_MODEL, STEADY_MODEL, normalizeEnglishLesson, lessonAudioScript } from "../english-utils.js";

const API = "https://api.elevenlabs.io/v1";
const FORMAT = "mp3_44100_128";
const CREDITS_PER_CHAR = 0.605;              // medido en esta cuenta (skill eleven)
const OUT = new URL("../output/ingles-audio/", import.meta.url);
const LESSONS = new URL("../english/lessons/", import.meta.url);
const CONCURRENCY = 4;

/* Las claves de voz de las lecciones (acento-género-número) → voces de ElevenLabs.
   Las de la cuenta son las prediseñadas; au-f1 viene de la biblioteca compartida.
   El elenco de la historia (english-catalog.js → ENGLISH_CAST) usa siempre las mismas. */
export const VOICES = {
  "us-f1": { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda" },      // la coach del curso
  "us-f2": { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah" },        // Emma
  "us-f3": { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica" },
  "us-f4": { id: "hpp4J3VqNfWAUOO0d1Us", name: "Bella" },
  "us-m1": { id: "cjVigY5qzO86Huf0OWal", name: "Eric" },         // Daniel
  "us-m2": { id: "iP95p4xoKVk53GoZ742B", name: "Chris" },        // Marcus
  "us-m3": { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger" },        // Mr. Clark
  "us-m4": { id: "pqHfZKP75CvOlQylNhV4", name: "Bill" },
  "us-m5": { id: "bIHbv24MWmeRgasZH58o", name: "Will" },
  "uk-f1": { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice" },        // Grace
  "uk-f2": { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily" },
  "uk-m1": { id: "JBFqnCBsd6RMkjVDRZzb", name: "George" },       // Oliver
  "uk-m2": { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel" },
  "au-m1": { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie" },
  "au-f1": { id: "gEdKKVxVhNCulBgRQ9GW", name: "Charlotte" },    // Chloe
};

const SAMPLES = [
  { voice: "us-f1", rate: 0.85, model: STEADY_MODEL, say: "Hello, I'm Emma. Nice to meet you. How do you spell your last name? O, R, T, E, G, A." },
  { voice: "us-m1", rate: 1, model: STEADY_MODEL, say: "So, about ten years ago I was working at a bank in Chicago, and honestly, I was miserable." },
  { voice: "uk-f1", rate: 1, model: STEADY_MODEL, say: "Hello and welcome back to Second Chances, the podcast about the small decisions that change everything." },
  { voice: "au-f1", rate: 1, model: STEADY_MODEL, say: "Three months later, he left me! So, in hindsight, if I'd known that, I would definitely have gone." },
];

async function apiKey() {
  if (process.env.ELEVENLABS_API_KEY?.trim()) return process.env.ELEVENLABS_API_KEY.trim();
  const file = process.env.ELEVEN_KEY_FILE || join(homedir(), ".claude", "skills", "eleven", "clave.txt");
  const text = await readFile(file, "utf8").catch(() => "");
  for (const line of text.split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean || clean.startsWith("#")) continue;
    if (clean.includes("=")) {
      const [field, value] = clean.split("=", 2);
      if (["ELEVENLABS", "ELEVENLABS_API_KEY", "ELEVEN"].includes(field.trim().toUpperCase()) && value.trim()) return value.trim();
    } else if (clean.startsWith("sk_")) return clean;
  }
  throw new Error(`No encuentro la llave de ElevenLabs (ni ELEVENLABS_API_KEY ni ${file}).`);
}

async function exists(url) {
  try { await access(url); return true; } catch { return false; }
}

async function balance(key) {
  const response = await fetch(`${API}/user/subscription`, { headers: { "xi-api-key": key } });
  if (!response.ok) throw new Error(`No pude consultar el saldo (HTTP ${response.status}).`);
  const data = await response.json();
  return { left: Math.max(0, data.character_limit - data.character_count), limit: data.character_limit };
}

/* v3 obedece las etiquetas de emoción pero no acepta velocidad, y su estabilidad solo
   admite 0, 0,5 o 1 (en 1 deja de obedecer las etiquetas): va en 0,5, "Natural". */
async function synthesize(key, { say, voice, rate, model }) {
  const target = VOICES[voice];
  if (!target) throw new Error(`La voz ${voice} no tiene una voz de ElevenLabs asignada.`);
  const settings = model === EXPRESSIVE_MODEL
    ? { stability: 0.5 }
    : { stability: 0.5, similarity_boost: 0.75, speed: rate };
  const response = await fetch(`${API}/text-to-speech/${target.id}?output_format=${FORMAT}`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ text: say, model_id: model, voice_settings: settings }),
  });
  if (!response.ok) throw new Error(`ElevenLabs respondió HTTP ${response.status} con ${voice}: ${(await response.text()).slice(0, 300)}`);
  const cost = Number(response.headers.get("character-cost") || response.headers.get("x-character-cost"));
  return { audio: Buffer.from(await response.arrayBuffer()), cost: Number.isFinite(cost) ? cost : null };
}

async function runPool(items, worker) {
  let next = 0;
  const lanes = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await worker(item);
    }
  });
  await Promise.all(lanes);
}

/* Con --kinds solo se mira una parte de la lección: borrar "lo que sobra" con esa vista
   parcial se llevaría audios buenos, así que --prune se ignora. */
function kindsFilterUsed(args) {
  return args.includes("--kinds");
}

function credits(chars) {
  return Math.round(chars * CREDITS_PER_CHAR);
}

function format(number) {
  return number.toLocaleString("es-CO");
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const samples = args.includes("--samples");
  const prune = args.includes("--prune") && !kindsFilterUsed(args);
  const maxIndex = args.indexOf("--max-credits");
  const maxCredits = maxIndex >= 0 ? Number(args[maxIndex + 1]) : 20000;
  /* --kinds coach,line genera solo esos tipos de audio: sirve para probar una voz o un
     modelo con pocos créditos antes de lanzar el lote completo. */
  const kindsIndex = args.indexOf("--kinds");
  const kinds = kindsIndex >= 0 ? new Set(String(args[kindsIndex + 1] || "").split(",").filter(Boolean)) : null;
  const lessonIds = args.filter((arg, index) => !arg.startsWith("--") && !["--max-credits", "--kinds"].includes(args[index - 1]));

  /* Qué hay que generar */
  const jobs = [];
  if (samples) {
    for (const sample of SAMPLES) {
      jobs.push({ ...sample, file: new URL(`muestras/${sample.voice}-${VOICES[sample.voice].name}.mp3`, OUT), lesson: "muestras" });
    }
  }
  const manifests = new Map();
  for (const id of lessonIds) {
    const raw = JSON.parse(await readFile(new URL(`${id}.json`, LESSONS), "utf8"));
    const lesson = normalizeEnglishLesson(raw);
    const script = lessonAudioScript(lesson);
    manifests.set(id, script);
    for (const item of script) {
      if (kinds && !kinds.has(item.kind)) continue;
      jobs.push({ ...item, file: new URL(`${id}/${item.key}.mp3`, OUT), lesson: id });
    }
  }
  if (!jobs.length) {
    console.log("Uso: node tools/english-audio.mjs [--dry-run] [--samples] [--max-credits N] <lección>...");
    return;
  }

  const pending = [];
  for (const job of jobs) if (!(await exists(job.file))) pending.push(job);
  const chars = pending.reduce((total, job) => total + job.say.length, 0);
  const expressive = pending.filter(job => job.model === EXPRESSIVE_MODEL).length;
  console.log(`${jobs.length} audios en total; faltan ${pending.length}, ${expressive} con emoción (${format(chars)} caracteres, ~${format(credits(chars))} créditos).`);
  if (dryRun || !pending.length) {
    if (!pending.length) await writeManifests(manifests, { prune });
    return;
  }
  const unknownVoices = [...new Set(pending.map(job => job.voice).filter(voice => !VOICES[voice]))];
  if (unknownVoices.length) {
    console.log(`Hay voces sin asignar en ElevenLabs (${unknownVoices.join(", ")}): no arranco para no dejar el lote a medias.`);
    process.exitCode = 2;
    return;
  }
  if (credits(chars) > maxCredits) {
    console.log(`Más de ${format(maxCredits)} créditos: no arranco. Si está aprobado, repite con --max-credits ${credits(chars) + 1000}.`);
    process.exitCode = 2;
    return;
  }

  const key = await apiKey();
  const before = await balance(key);
  console.log(`Antes: ${format(before.left)} de ${format(before.limit)} créditos.`);
  let spent = 0;
  let measured = true;
  let done = 0;
  const failures = [];
  await runPool(pending, async job => {
    try {
      const { audio, cost } = await synthesize(key, job);
      await mkdir(new URL(".", job.file), { recursive: true });
      await writeFile(job.file, audio);
      if (cost == null) measured = false; else spent += cost;
      done++;
      if (done % 10 === 0 || done === pending.length) console.log(`  ${done}/${pending.length}`);
    } catch (error) {
      failures.push(`${job.lesson} · ${job.voice} · «${job.say.slice(0, 50)}»: ${error.message}`);
    }
  });

  await writeManifests(manifests, { prune: prune && !failures.length });
  const after = await balance(key);
  console.log(`Generados ${done}/${pending.length}. Costó ${format(measured ? spent : before.left - after.left)} créditos${measured ? "" : " (aprox.)"}. Quedan ${format(after.left)} de ${format(after.limit)}.`);
  if (failures.length) {
    console.log(`Fallaron ${failures.length}:\n${failures.join("\n")}`);
    process.exitCode = 1;
  }
}

/* El manifiesto le dice a la app qué archivo suena para cada texto. Con --prune se borran
   los audios de versiones anteriores de la lección, para que no viajen al publicarla. */
async function writeManifests(manifests, { prune = false } = {}) {
  for (const [id, script] of manifests) {
    const entries = {};
    for (const item of script) {
      if (await exists(new URL(`${id}/${item.key}.mp3`, OUT))) entries[item.key] = { kind: item.kind, voice: item.voice, rate: item.rate, model: item.model, text: item.text };
    }
    await mkdir(new URL(`${id}/`, OUT), { recursive: true });
    await writeFile(new URL(`${id}/manifest.json`, OUT), JSON.stringify({ lesson: id, audios: entries }, null, 1));
    if (prune) {
      const keep = new Set(Object.keys(entries).map(key => `${key}.mp3`));
      const stale = (await readdir(new URL(`${id}/`, OUT))).filter(name => name.endsWith(".mp3") && !keep.has(name));
      for (const name of stale) await unlink(new URL(`${id}/${name}`, OUT));
      if (stale.length) console.log(`${id}: borrados ${stale.length} audios de versiones anteriores.`);
    }
  }
}

main().catch(error => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});
