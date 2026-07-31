/* Service Worker — AVICI PWA (network-first para tener siempre lo último) */
const CACHE = "avici-v11-pdf-rangos";
const ASSETS = ["/", "/index.html", "/styles.css", "/app.js", "/course-catalog.js", "/learning-utils.js", "/reader-utils.js", "/vendor/pdfjs/pdf.min.mjs", "/vendor/pdfjs/pdf.worker.min.mjs", "/manifest.webmanifest", "/assets/logo-avici.png", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return; // Firebase/gstatic y API privadas van directo
  // network-first: siempre intenta traer lo último; si no hay red, usa caché
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      /* Sin red: se sirve lo cacheado. El index.html SOLO vale como respaldo de una
         navegación; devolverlo ante un módulo JS o una hoja de estilos hacía que el
         navegador recibiera HTML donde esperaba código y la app moría con un error de
         sintaxis incomprensible en vez de decir simplemente que no hay conexión. */
      .catch(() => caches.match(req).then((r) => {
        if (r) return r;
        if (req.mode === "navigate") return caches.match("/index.html");
        return Response.error();
      }))
  );
});
