// Enlaces temporales firmados para los libros guardados en Azure.
//
// La idea: el navegador baja el PDF DIRECTO de Azure, sin pasar por el servidor. Así no se
// consume transferencia de la plataforma y además carga más rápido, porque desaparece el
// salto intermedio. El enlace lo firma esta función solo para quien ya tiene sesión válida
// y está aprobada, dura poco y solo permite LEER.
import crypto from "node:crypto";

const VERSION_SAS = "2022-11-02";

/* Los libros que viven en Azure. El resto sigue sirviéndose por el proxy de siempre. */
export const LIBROS_AZURE = {
  thibodeau: { contenedor: "libros", blob: "thibodeau.pdf" },
  mazarrasa: { contenedor: "libros", blob: "mazarrasa.pdf" },
  vacunador: { contenedor: "libros", blob: "vacunador.pdf" },
};

export function libroAzure(id) {
  return LIBROS_AZURE[String(id || "").toLowerCase()] || null;
}

/* Firma un permiso de solo lectura sobre un archivo concreto.
   `minutos` es la vida del enlace: suficiente para una sesión de estudio, y si se vence a
   mitad de camino el lector pide uno nuevo sin que la usuaria se entere. */
export function urlFirmadaDeLectura({ cuenta, clave, contenedor, blob, minutos = 90, ahora = new Date() }) {
  const inicio = new Date(ahora.getTime() - 5 * 60 * 1000);   // margen por relojes desfasados
  const fin = new Date(ahora.getTime() + minutos * 60 * 1000);
  const iso = (fecha) => fecha.toISOString().slice(0, 19) + "Z";

  const permisos = "r";                 // solo lectura
  const recurso = "b";                  // un blob concreto, no todo el contenedor
  const protocolo = "https";
  const canonico = `/blob/${cuenta}/${contenedor}/${blob}`;

  /* El orden y la cantidad de campos los define Azure para esta versión: cualquier cambio
     rompe la firma, por eso van los vacíos explícitos. */
  const aFirmar = [
    permisos, iso(inicio), iso(fin), canonico,
    "",            // identificador de política almacenada
    "",            // IP permitida
    protocolo, VERSION_SAS, recurso,
    "",            // instantánea
    "",            // ámbito de cifrado
    "", "", "", "", "", // cabeceras de respuesta a sobreescribir
  ].join("\n");

  const firma = crypto.createHmac("sha256", Buffer.from(clave, "base64")).update(aFirmar, "utf8").digest("base64");
  const parametros = new URLSearchParams({
    sv: VERSION_SAS, sp: permisos, sr: recurso, spr: protocolo,
    st: iso(inicio), se: iso(fin), sig: firma,
  });
  return {
    url: `https://${cuenta}.blob.core.windows.net/${contenedor}/${blob}?${parametros}`,
    expira: fin.toISOString(),
  };
}

/* Los audios del curso de inglés son cientos de archivos chicos: firmar uno por uno sería
   una llamada por audio. Se firma el contenedor entero, también solo para leer y con vida
   corta, y el navegador arma cada dirección agregando la firma. */
export const CONTENEDOR_AUDIO_INGLES = "ingles-audio";

export function firmaDeContenedor({ cuenta, clave, contenedor, minutos = 120, ahora = new Date() }) {
  const inicio = new Date(ahora.getTime() - 5 * 60 * 1000);
  const fin = new Date(ahora.getTime() + minutos * 60 * 1000);
  const iso = (fecha) => fecha.toISOString().slice(0, 19) + "Z";
  const permisos = "r";
  const recurso = "c";                  // el contenedor, no un archivo
  const protocolo = "https";
  const canonico = `/blob/${cuenta}/${contenedor}`;
  const aFirmar = [
    permisos, iso(inicio), iso(fin), canonico,
    "", "", protocolo, VERSION_SAS, recurso,
    "", "", "", "", "", "", "",
  ].join("\n");
  const firma = crypto.createHmac("sha256", Buffer.from(clave, "base64")).update(aFirmar, "utf8").digest("base64");
  const parametros = new URLSearchParams({
    sv: VERSION_SAS, sp: permisos, sr: recurso, spr: protocolo,
    st: iso(inicio), se: iso(fin), sig: firma,
  });
  return {
    base: `https://${cuenta}.blob.core.windows.net/${contenedor}`,
    sas: parametros.toString(),
    expira: fin.toISOString(),
  };
}
