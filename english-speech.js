// ===== Escuchar a quien estudia: grabar, transcribir y calificar la pronunciación =====
//
// Con Azure (servicio de voz speech-gemb) se califica la pronunciación palabra por palabra:
// precisión, fluidez, entonación y qué tan completo quedó lo que había que decir. El
// permiso lo da /api/english y dura 10 minutos; la llave nunca llega al navegador.
//
// Si Azure no está configurado o falla, queda el reconocimiento de voz del navegador:
// transcribe, pero no califica la pronunciación (y lo dice).

const SDK_URL = "https://cdn.jsdelivr.net/npm/microsoft-cognitiveservices-speech-sdk@1.44.0/distrib/browser/microsoft.cognitiveservices.speech.sdk.bundle-min.js";
let sdkPromise = null;
let tokenCache = null;

function loadSdk() {
  if (window.SpeechSDK) return Promise.resolve(window.SpeechSDK);
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SDK_URL;
      script.async = true;
      script.onload = () => window.SpeechSDK ? resolve(window.SpeechSDK) : reject(new Error("No cargó el motor de voz."));
      script.onerror = () => { sdkPromise = null; reject(new Error("No se pudo descargar el motor de voz.")); };
      document.head.appendChild(script);
    });
  }
  return sdkPromise;
}

async function token(fetchToken) {
  if (tokenCache && tokenCache.expires > Date.now()) return tokenCache;
  const fresh = await fetchToken();
  tokenCache = { ...fresh, expires: Date.now() + 9 * 60 * 1000 };
  return tokenCache;
}

export function browserRecognitionAvailable() {
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function round(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : null;
}

function wordsOf(assessment) {
  const words = assessment?.detailResult?.Words || [];
  return words.map(word => ({
    word: word.Word,
    accuracy: round(word.PronunciationAssessment?.AccuracyScore),
    error: word.PronunciationAssessment?.ErrorType || "None",
  }));
}

async function recognizer(SpeechSDK, fetchToken, referenceText, unscripted) {
  const { token: authToken, region } = await token(fetchToken);
  const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(authToken, region);
  speechConfig.speechRecognitionLanguage = "en-US";
  const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
  const assessment = new SpeechSDK.PronunciationAssessmentConfig(
    unscripted ? "" : referenceText,
    SpeechSDK.PronunciationAssessmentGradingSystem.HundredMark,
    SpeechSDK.PronunciationAssessmentGranularity.Phoneme,
    !unscripted,
  );
  assessment.enableProsodyAssessment = true;
  const instance = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
  assessment.applyTo(instance);
  return instance;
}

/* Frase conocida (repetir, shadowing): se compara contra el texto de referencia. */
export async function assessScripted({ referenceText, fetchToken }) {
  const SpeechSDK = await loadSdk();
  const instance = await recognizer(SpeechSDK, fetchToken, referenceText, false);
  try {
    const result = await new Promise((resolve, reject) => instance.recognizeOnceAsync(resolve, reject));
    if (result.reason !== SpeechSDK.ResultReason.RecognizedSpeech) {
      return { text: "", scores: null, words: [], message: "No te escuché. Acércate al micrófono e inténtalo otra vez." };
    }
    const assessment = SpeechSDK.PronunciationAssessmentResult.fromResult(result);
    return {
      text: result.text,
      scores: {
        pronunciation: round(assessment.pronunciationScore),
        accuracy: round(assessment.accuracyScore),
        fluency: round(assessment.fluencyScore),
        completeness: round(assessment.completenessScore),
        prosody: round(assessment.prosodyScore),
      },
      words: wordsOf(assessment),
    };
  } finally {
    instance.close();
  }
}

/* Habla libre (la tarea 4/3/2): se graba durante `seconds` y se califica sin texto de
   referencia. Devuelve la transcripción y el promedio de las puntuaciones. */
export async function recordFree({ seconds, fetchToken, onText, signal }) {
  const SpeechSDK = await loadSdk();
  const instance = await recognizer(SpeechSDK, fetchToken, "", true);
  const pieces = [];
  const scored = [];
  instance.recognizing = (_sender, event) => onText?.([...pieces, event.result.text].join(" "));
  instance.recognized = (_sender, event) => {
    if (event.result.reason !== SpeechSDK.ResultReason.RecognizedSpeech || !event.result.text) return;
    pieces.push(event.result.text);
    onText?.(pieces.join(" "));
    const assessment = SpeechSDK.PronunciationAssessmentResult.fromResult(event.result);
    scored.push({
      words: wordsOf(assessment),
      weight: Math.max(1, event.result.text.split(/\s+/).length),
      accuracy: assessment.accuracyScore,
      fluency: assessment.fluencyScore,
      prosody: assessment.prosodyScore,
    });
  };
  await new Promise((resolve, reject) => instance.startContinuousRecognitionAsync(resolve, reject));
  await waitSeconds(seconds, signal);
  await new Promise(resolve => instance.stopContinuousRecognitionAsync(resolve, resolve));
  instance.close();
  const total = scored.reduce((sum, item) => sum + item.weight, 0) || 1;
  const average = key => round(scored.reduce((sum, item) => sum + (Number(item[key]) || 0) * item.weight, 0) / total);
  const weakWords = scored.flatMap(item => item.words).filter(word => word.accuracy != null && word.accuracy < 60).map(word => word.word);
  return {
    text: pieces.join(" "),
    scores: scored.length ? { accuracy: average("accuracy"), fluency: average("fluency"), prosody: average("prosody") } : null,
    weakWords: [...new Set(weakWords)].slice(0, 15),
  };
}

/* Respaldo sin Azure: el reconocimiento del navegador. Solo transcribe. */
export function recordBrowser({ seconds, onText, signal }) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return Promise.reject(new Error("Este navegador no reconoce voz. Prueba con Chrome o Edge."));
  return new Promise((resolve, reject) => {
    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    const finals = [];
    let stopped = false;
    let timer = null;
    recognition.onresult = event => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const piece = event.results[index];
        if (piece.isFinal) finals.push(piece[0].transcript.trim());
        else interim += piece[0].transcript;
      }
      onText?.([...finals, interim.trim()].filter(Boolean).join(" "));
    };
    recognition.onerror = event => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      clearTimeout(timer);
      stopped = true;
      reject(new Error(event.error === "not-allowed" ? "Necesito permiso para usar el micrófono." : "Falló el reconocimiento de voz."));
    };
    /* Chrome corta la escucha continua tras un silencio: se reanuda hasta que se acabe el tiempo. */
    recognition.onend = () => { if (!stopped) { try { recognition.start(); } catch {} } };
    const finish = () => {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      try { recognition.stop(); } catch {}
      resolve({ text: finals.join(" "), scores: null, weakWords: [] });
    };
    timer = setTimeout(finish, seconds * 1000);
    signal?.addEventListener("abort", finish, { once: true });
    try { recognition.start(); } catch (error) { reject(error); }
  });
}

/* Una sola frase, sin calificar (el juego de roles por voz). */
export async function recognizeOnce({ fetchToken, useAzure }) {
  if (useAzure) {
    const SpeechSDK = await loadSdk();
    const { token: authToken, region } = await token(fetchToken);
    const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(authToken, region);
    speechConfig.speechRecognitionLanguage = "en-US";
    const instance = new SpeechSDK.SpeechRecognizer(speechConfig, SpeechSDK.AudioConfig.fromDefaultMicrophoneInput());
    try {
      const result = await new Promise((resolve, reject) => instance.recognizeOnceAsync(resolve, reject));
      return result.reason === SpeechSDK.ResultReason.RecognizedSpeech ? result.text : "";
    } finally {
      instance.close();
    }
  }
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) throw new Error("Este navegador no reconoce voz. Prueba con Chrome o Edge, o escribe tu respuesta.");
  /* Una frase: el navegador corta solo cuando la persona deja de hablar. */
  return new Promise((resolve, reject) => {
    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    let text = "";
    recognition.onresult = event => { text = Array.from(event.results).map(result => result[0].transcript).join(" ").trim(); };
    recognition.onerror = event => {
      if (event.error === "no-speech") return;
      reject(new Error(event.error === "not-allowed" ? "Necesito permiso para usar el micrófono." : "Falló el reconocimiento de voz."));
    };
    recognition.onend = () => resolve(text);
    try { recognition.start(); } catch (error) { reject(error); }
  });
}

function waitSeconds(seconds, signal) {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, seconds * 1000);
    signal?.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}
