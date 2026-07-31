import test from "node:test";
import assert from "node:assert/strict";
import handler, { bookUrlFor, upstreamRequestHeaders, downstreamHeaders } from "../api/book-pdf.js";

function responseMock() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

test("el proxy visual solo acepta identificadores de libros conocidos", () => {
  const env = {
    BOOK_THIBODEAU_PDF_URL: "https://private/thibodeau.pdf",
    BOOK_MAZARRASA_PDF_URL: "https://private/mazarrasa.pdf",
    BOOK_VACUNADOR_PDF_URL: "https://private/vacunador.pdf",
  };
  assert.equal(bookUrlFor("thibodeau", env), env.BOOK_THIBODEAU_PDF_URL);
  assert.equal(bookUrlFor("mazarrasa", env), env.BOOK_MAZARRASA_PDF_URL);
  assert.equal(bookUrlFor("vacunador", env), env.BOOK_VACUNADOR_PDF_URL);
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

/* Regresión: el ETag es del PDF entero. Si se reenviaba junto al rango, el almacenamiento
   contestaba 304 y el navegador servía el trozo anterior; PDF.js recibía el principio del
   libro donde esperaba la tabla xref y mostraba "Invalid PDF structure" al pasar de página. */
test("el proxy visual pide el rango sin reenviar validadores de caché", () => {
  const headers = upstreamRequestHeaders(
    { range: "bytes=461151815-461413958", "if-none-match": '"7ead7df3-56"' },
    "token-privado"
  );
  assert.equal(headers.Range, "bytes=461151815-461413958");
  assert.equal(headers.Authorization, "Bearer token-privado");
  assert.equal(headers["If-None-Match"], undefined);
  assert.equal(headers["if-none-match"], undefined);
});

test("las respuestas parciales del PDF no se cachean ni exponen ETag", () => {
  const upstream = {
    headers: new Headers({
      "accept-ranges": "bytes",
      "content-length": "262144",
      "content-range": "bytes 0-262143/461413959",
      etag: '"7ead7df3-56"',
      "last-modified": "Wed, 30 Jul 2026 12:00:00 GMT",
    }),
  };
  const headers = downstreamHeaders(upstream);
  assert.equal(headers["content-range"], "bytes 0-262143/461413959");
  assert.equal(headers["content-length"], "262144");
  assert.equal(headers["accept-ranges"], "bytes");
  assert.equal(headers["Cache-Control"], "private, no-store");
  assert.equal(headers.etag, undefined);
  assert.equal(headers["last-modified"], undefined);
});
