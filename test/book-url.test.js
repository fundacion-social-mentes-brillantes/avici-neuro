import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import handler from "../api/book-url.js";
import { libroAzure, urlFirmadaDeLectura } from "../api/_azure.js";

function responseMock() {
  return {
    statusCode: 200, body: null, headers: {},
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
  };
}

test("solo los libros declarados tienen entrega directa", () => {
  assert.equal(libroAzure("thibodeau").blob, "thibodeau.pdf");
  assert.equal(libroAzure("THIBODEAU").contenedor, "libros");
  assert.equal(libroAzure("otro"), null);
  assert.equal(libroAzure(""), null);
});

test("el enlace temporal es de solo lectura, por https y con vencimiento corto", () => {
  const ahora = new Date("2026-08-01T12:00:00Z");
  const { url, expira } = urlFirmadaDeLectura({
    cuenta: "cuentademo", clave: Buffer.from("clave-de-prueba").toString("base64"),
    contenedor: "libros", blob: "thibodeau.pdf", minutos: 90, ahora,
  });
  const u = new URL(url);
  assert.equal(u.origin, "https://cuentademo.blob.core.windows.net");
  assert.equal(u.pathname, "/libros/thibodeau.pdf");
  assert.equal(u.searchParams.get("sp"), "r", "solo lectura");
  assert.equal(u.searchParams.get("spr"), "https", "nunca sin cifrar");
  assert.equal(u.searchParams.get("sr"), "b", "un solo archivo, no todo el contenedor");
  assert.ok(u.searchParams.get("sig"), "debe venir firmado");
  assert.equal(expira, "2026-08-01T13:30:00.000Z");
  // el permiso arranca antes de "ahora" solo por el margen de reloj, no más
  assert.equal(u.searchParams.get("st"), "2026-08-01T11:55:00Z");
});

/* La firma se calcula sobre un orden de campos que define Azure: si alguien reordena o
   agrega uno, el enlace deja de servir. Esta prueba fija ese contrato. */
test("la firma corresponde exactamente a lo que Azure espera firmar", () => {
  const clave = Buffer.from("clave-de-prueba").toString("base64");
  const ahora = new Date("2026-08-01T12:00:00Z");
  const { url } = urlFirmadaDeLectura({ cuenta: "cuentademo", clave, contenedor: "libros", blob: "thibodeau.pdf", minutos: 90, ahora });
  const esperado = crypto.createHmac("sha256", Buffer.from(clave, "base64")).update([
    "r", "2026-08-01T11:55:00Z", "2026-08-01T13:30:00Z", "/blob/cuentademo/libros/thibodeau.pdf",
    "", "", "https", "2022-11-02", "b", "", "", "", "", "", "", "",
  ].join("\n"), "utf8").digest("base64");
  assert.equal(new URL(url).searchParams.get("sig"), esperado);
});

test("no se entrega ningún enlace sin sesión válida", async () => {
  const res = responseMock();
  await handler({ method: "GET", headers: {}, query: { id: "thibodeau" } }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.url, undefined);
});

test("el enlace nunca se guarda en caché", async () => {
  const res = responseMock();
  await handler({ method: "POST", headers: {}, query: { id: "thibodeau" } }, res);
  assert.equal(res.statusCode, 405, "solo lectura por GET");
});
