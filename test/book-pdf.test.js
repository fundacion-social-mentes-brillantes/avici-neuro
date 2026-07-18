import test from "node:test";
import assert from "node:assert/strict";
import handler, { bookUrlFor } from "../api/book-pdf.js";

function responseMock() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

test("el proxy visual solo acepta identificadores de libros conocidos", () => {
  const env = { BOOK_THIBODEAU_PDF_URL: "https://private/thibodeau.pdf", BOOK_MAZARRASA_PDF_URL: "https://private/mazarrasa.pdf" };
  assert.equal(bookUrlFor("thibodeau", env), env.BOOK_THIBODEAU_PDF_URL);
  assert.equal(bookUrlFor("mazarrasa", env), env.BOOK_MAZARRASA_PDF_URL);
  assert.equal(bookUrlFor("otro", env), null);
});

test("el proxy visual rechaza peticiones sin autenticación", async () => {
  const res = responseMock();
  await handler({ method: "GET", headers: {}, query: { id: "thibodeau" } }, res);
  assert.equal(res.statusCode, 403);
  assert.match(res.body.error, /no autorizado/i);
});

test("el proxy visual rechaza métodos que no sean lectura", async () => {
  const res = responseMock();
  await handler({ method: "POST", headers: {}, query: { id: "thibodeau" } }, res);
  assert.equal(res.statusCode, 405);
});
