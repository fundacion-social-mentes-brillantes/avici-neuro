import test from "node:test";
import assert from "node:assert/strict";
import handler, { bookDataUrlFor, normalizePrivateBookData } from "../api/book-data.js";

function responseMock() {
  return {
    statusCode: 200,
    payload: null,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.payload = value; return this; },
  };
}

test("el respaldo textual solo expone libros privados conocidos", () => {
  const env = { BOOK_VACUNADOR_TEXT_URL: "https://private/vacunador.pages.json" };
  assert.equal(bookDataUrlFor("vacunador", env), env.BOOK_VACUNADOR_TEXT_URL);
  assert.equal(bookDataUrlFor("otro", env), null);
});

test("el respaldo textual acepta un libro íntegro y rechaza blobs malformados", () => {
  const valid = normalizePrivateBookData({
    id: "vacunador",
    title: "Manual",
    pages: [{ i: 1, printed: null, text: "Portada" }],
  }, "vacunador");
  assert.equal(valid.id, "vacunador");
  assert.equal(valid.pages.length, 1);
  assert.equal(valid.cacheVersion, "blob-vacunador-2013-r1");
  assert.equal(normalizePrivateBookData({ id: "vacunador", pages: [] }, "vacunador"), null);
  assert.equal(normalizePrivateBookData({ id: "otro", pages: [{ i: 1 }] }, "vacunador"), null);
});

test("el respaldo textual rechaza peticiones sin autenticación", async () => {
  const req = { method: "GET", headers: {}, query: { id: "vacunador" } };
  const res = responseMock();
  await handler(req, res);
  assert.equal(res.statusCode, 403);
  assert.match(res.payload.error, /no autorizado/i);
});

test("el respaldo textual rechaza métodos de escritura", async () => {
  const req = { method: "POST", headers: {}, query: { id: "vacunador" } };
  const res = responseMock();
  await handler(req, res);
  assert.equal(res.statusCode, 405);
});
