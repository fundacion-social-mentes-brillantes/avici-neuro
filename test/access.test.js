import test from "node:test";
import assert from "node:assert/strict";
import { ADMIN_EMAIL, isApproved } from "../api/_lib.js";

test("el administrador conserva acceso sin depender de Firestore", async () => {
  assert.equal(await isApproved({ email: ADMIN_EMAIL, uid: "admin", token: "token" }), true);
});

test("la verificación de aprobación falla cerrada", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ ok: false });
    assert.equal(await isApproved({ email: "student@example.com", uid: "student", token: "token" }), false);

    globalThis.fetch = async () => { throw new Error("sin conexión"); };
    assert.equal(await isApproved({ email: "student@example.com", uid: "student", token: "token" }), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("solo el estado approved habilita al estudiante", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ fields: { status: { stringValue: "approved" } } }) });
    assert.equal(await isApproved({ email: "student@example.com", uid: "student", token: "token" }), true);

    globalThis.fetch = async () => ({ ok: true, json: async () => ({ fields: { status: { stringValue: "pending" } } }) });
    assert.equal(await isApproved({ email: "student@example.com", uid: "student", token: "token" }), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
