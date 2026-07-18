import test from "node:test";
import assert from "node:assert/strict";
import { fluidPageText, getReaderPageModel } from "../reader-utils.js";

test("el modo fluido conserva todos los caracteres del contenido original", () => {
  const original = "Primera línea del texto.\nContinúa en la misma página.\n\nSegundo párrafo con anatomía.";
  const fluid = fluidPageText(original);
  const withoutWhitespace = value => value.replace(/\s/g, "");
  assert.equal(withoutWhitespace(fluid), withoutWhitespace(original));
  assert.match(fluid, /misma página\.\n\nSegundo párrafo/);
});

test("el lector muestra una sola página y nunca mezcla páginas vecinas", () => {
  const book = { pages: [
    { i: 1, text: "CONTENIDO-UNO" },
    { i: 2, printed: "xii", text: "CONTENIDO-DOS\nmisma página" },
    { i: 3, text: "CONTENIDO-TRES" },
  ] };
  const model = getReaderPageModel(book, 2, "fluid");
  assert.equal(model.pageNumber, 2);
  assert.equal(model.total, 3);
  assert.equal(model.sourcePage.printed, "xii");
  assert.match(model.visibleText, /CONTENIDO-DOS/);
  assert.doesNotMatch(model.visibleText, /CONTENIDO-UNO|CONTENIDO-TRES/);
});

test("la vista original conserva el texto byte por byte", () => {
  const original = "Línea 1\n  Línea 2\n\nLínea 3";
  const model = getReaderPageModel({ pages: [{ i: 1, text: original }] }, 1, "original");
  assert.equal(model.visibleText, original);
});
