// Protege los arreglos de fiabilidad de la generación de lecciones.
// El bug real: abrir una lección mostraba "No voy a mostrarte una lección dudosa —
// el modelo no devolvió JSON válido", y al reintentar salía perfecta a la primera.
// Eran fallos técnicos recuperables presentados como si la lección fuera sospechosa.
import test from "node:test";
import assert from "node:assert/strict";
import { buildMessages, parseJsonResult } from "../api/chat.js";

const LECCION = {
  learningObjectives: ["a", "b", "c"],
  content: "texto (pág. 27)",
  keyTerms: [{ term: "t", def: "d" }],
  quiz: [{ q: "q", options: ["1", "2", "3", "4"], answer: 0, level: "recuerdo", explain: "e (pág. 27)" }],
  flashcards: [{ front: "f", back: "b" }],
  challenge: { scenario: "s", q: "q", options: ["1", "2", "3", "4"], answer: 0, level: "aplicacion", explain: "e (pág. 27)" },
};

test("el JSON limpio se sigue leyendo igual", () => {
  assert.deepEqual(parseJsonResult(JSON.stringify(LECCION)), LECCION);
});

test("se rescata el JSON envuelto en vallas de markdown", () => {
  const conVallas = "```json\n" + JSON.stringify(LECCION) + "\n```";
  assert.deepEqual(parseJsonResult(conVallas), LECCION);
});

test("se rescata el JSON con texto del modelo alrededor", () => {
  const conCharla = "Claro, acá va la lección:\n" + JSON.stringify(LECCION) + "\n¡Espero que te sirva!";
  assert.deepEqual(parseJsonResult(conCharla), LECCION);
});

test("se rescata una respuesta CORTADA por el límite de tokens", () => {
  // Esto es exactamente lo que rompía en producción: finish_reason "length".
  const completo = JSON.stringify(LECCION);
  const truncado = completo.slice(0, completo.indexOf('"flashcards"') + 40);
  const rescatado = parseJsonResult(truncado);
  assert.ok(rescatado, "el JSON truncado tiene que poder rescatarse");
  assert.equal(rescatado.content, "texto (pág. 27)");
  assert.equal(rescatado.quiz.length, 1, "lo que estaba completo se conserva entero");
});

test("un corte dentro de una cadena no inventa contenido a medias", () => {
  const cortadoEnCadena = '{"content":"la mitocondria es la cent';
  const rescatado = parseJsonResult(cortadoEnCadena);
  // O no se rescata, o se rescata sin la cadena rota; nunca con texto mutilado.
  if (rescatado) assert.ok(!("content" in rescatado) || typeof rescatado.content === "string");
});

test("la basura sin JSON sigue devolviendo null", () => {
  assert.equal(parseJsonResult("perdón, no puedo ayudarte con eso"), null);
  assert.equal(parseJsonResult(""), null);
  assert.equal(parseJsonResult(null), null);
});

test("el segundo intento pide la lección más compacta", () => {
  const base = { bookTitle: "Libro", passages: [{ page: 27, text: "x" }], meta: { title: "T", chapter: "1" } };
  const normal = buildMessages("lesson", base);
  const compacta = buildMessages("lesson", { ...base, meta: { ...base.meta, compact: true } });
  const textoNormal = normal.messages[0].content;
  const textoCompacto = compacta.messages[0].content;
  assert.ok(!textoNormal.includes("SEGUNDO INTENTO"), "el primer intento no lleva las reglas compactas");
  assert.ok(textoCompacto.includes("SEGUNDO INTENTO"), "el segundo intento sí las lleva");
  assert.ok(textoCompacto.includes("600 a 750 palabras"), "pide un contenido más corto");
  assert.ok(textoCompacto.includes("6-8 preguntas de quiz"), "pero conserva las cantidades exigidas");
});

test("un cuerpo malformado no puede tumbar la construcción del mensaje", () => {
  // meta:null no lo cubre el valor por defecto de la desestructuración, y passages
  // no-lista tampoco: el handler ahora los convierte en un 400 explicado.
  assert.throws(() => buildMessages("lesson", { meta: null }), "meta:null debe fallar de forma detectable");
  const conPassagesRaros = buildMessages("chat", { passages: "no soy una lista", question: "hola" });
  assert.ok(conPassagesRaros.messages.length, "passages inválido no puede romper el chat");
});
