// apps/backend/tests/fotoResolver.test.mjs

/*
===========================================================
PRUEBAS DEL RESOLVER DE FOTOGRAFIA (P-CAND-UX-04)
===========================================================

    node tests/fotoResolver.test.mjs

SIN RED. Se inyecta un `fetchImpl` falso: cada caso declara que
devuelve cada URL, asi que las pruebas son deterministas y no
dependen de que una pagina exista hoy.

LAS DOS DISTINCIONES QUE SE DEFIENDEN
-----------------------------------------------------------

    fotoManualUrl     enlace directo a una imagen
    fotoSourceUrl     pagina desde la que intentar obtenerla

Una pagina de perfil NUNCA se usa como `src` de un `<img>`: se
lee su metadata y se usa la imagen que ella declara.

    verifiedImageResource   la URL devuelve una imagen
    verificadaPorSentinel   Sentinel verifico a quien retrata

La primera se comprueba con una peticion. La segunda exigiria
reconocimiento facial, que este modulo se prohibe, y por eso es
siempre false.
===========================================================
*/

const pr = await import("../services/intelligence/candidatePhotoResolver.js");

let pass = 0;

let fail = 0;

const fallos = [];

async function t(nombre, comprobacion) {
  try {
    const valor = await comprobacion();

    if (valor === true) {
      pass += 1;
      console.log(`  PASS  ${nombre}`);
    } else {
      fail += 1;
      fallos.push(nombre);
      console.log(`  FALL  ${nombre}  (devolvió ${JSON.stringify(valor)})`);
    }
  } catch (error) {
    fail += 1;
    fallos.push(`${nombre} (${error.message})`);
    console.log(`  ERR   ${nombre}: ${error.message}`);
  }
}

function bloque(titulo) {
  console.log(`\n${titulo}`);
  console.log("-".repeat(titulo.length));
}

const R = pr.RESULTADOS;

/*
  `fetch` falso. `rutas` declara la respuesta de cada URL; lo que
  no este declarado responde 404. Se registran las llamadas para
  poder comprobar que NO se pide nada cuando no toca.
*/
function fetchFalso(rutas) {
  const llamadas = [];

  const impl = async (url, opciones = {}) => {
    llamadas.push({ url: String(url), metodo: opciones.method || "GET" });

    const r = rutas[String(url)];

    if (!r) {
      return {
        ok: false,
        status: 404,
        headers: { get: () => null },
        text: async () => ""
      };
    }

    if (r.lanza) {
      const e = new Error(r.lanza === "timeout" ? "abort" : "fallo de red");

      e.name = r.lanza === "timeout" ? "AbortError" : "TypeError";

      throw e;
    }

    return {
      ok: (r.status || 200) < 400,
      status: r.status || 200,
      headers: {
        get: (k) =>
          ({
            "content-type": r.contentType || null,
            "content-length": r.bytes != null ? String(r.bytes) : null
          })[String(k).toLowerCase()] ?? null
      },
      text: async () => r.html || ""
    };
  };

  impl.llamadas = llamadas;

  return impl;
}

const IMG_OK = { contentType: "image/jpeg", bytes: 45000 };

const cuenta = (plataformaId, handle, url, declarada = true) => ({
  id: `${plataformaId}:${handle}`,
  plataformaId,
  plataforma: plataformaId,
  handle,
  url,
  declaradaPorAnalista: declarada
});

/*
===========================================================
FOTO MANUAL
===========================================================
*/

bloque("la foto manual manda y no sale a la red");

await t("una foto manual se usa y no se pide ninguna pagina", async () => {
  const f = fetchFalso({});

  const r = await pr.resolverFotoDeCandidato({
    fotoManualUrl: "https://ejemplo.ec/retrato.jpg",
    cuentas: [cuenta("web", "sitio", "https://ejemplo.ec")],
    fetchImpl: f
  });

  return (
    r.fotoActual.imageUrl === "https://ejemplo.ec/retrato.jpg" &&
    r.fotoActual.sourceType === "manual" &&
    f.llamadas.length === 0
  );
});

await t("la manual tampoco se marca verificada por Sentinel", () => {
  /*
    Que la escriba una persona no la verifica: verificarla
    exigiria saber a quien retrata.
  */
  return pr
    .resolverFotoDeCandidato({ fotoManualUrl: "https://a.ec/x.jpg" })
    .then((r) => r.fotoActual.verificadaPorSentinel === false);
});

/*
===========================================================
METADATA: og:image, twitter:image, JSON-LD
===========================================================
*/

bloque("extracción de metadata pública estándar");

await t("og:image se detecta, con content y property en cualquier orden", () => {
  const a = pr.extraerMetadataImagen(
    '<meta property="og:image" content="https://a.ec/1.jpg">'
  );

  const b = pr.extraerMetadataImagen(
    '<meta content="https://a.ec/2.jpg" property="og:image">'
  );

  return a[0].url === "https://a.ec/1.jpg" && b[0].url === "https://a.ec/2.jpg";
});

await t("twitter:image y twitter:image:src se detectan", () => {
  const r = pr.extraerMetadataImagen(
    '<meta name="twitter:image:src" content="https://a.ec/t.jpg">'
  );

  return r[0].clave === "twitter:image:src";
});

await t("JSON-LD image se detecta en cadena, objeto y lista", () => {
  const uno = pr.extraerMetadataImagen(
    '<script type="application/ld+json">{"image":"https://a.ec/s.jpg"}</script>'
  );

  const dos = pr.extraerMetadataImagen(
    '<script type="application/ld+json">{"image":{"url":"https://a.ec/o.jpg"}}</script>'
  );

  const tres = pr.extraerMetadataImagen(
    '<script type="application/ld+json">{"image":["https://a.ec/l.jpg"]}</script>'
  );

  return (
    uno[0].url === "https://a.ec/s.jpg" &&
    dos[0].url === "https://a.ec/o.jpg" &&
    tres[0].url === "https://a.ec/l.jpg"
  );
});

await t("og:image gana a twitter:image y a JSON-LD", () => {
  const r = pr.extraerMetadataImagen(
    '<meta name="twitter:image" content="https://a.ec/t.jpg">' +
      '<meta property="og:image" content="https://a.ec/og.jpg">' +
      '<script type="application/ld+json">{"image":"https://a.ec/ld.jpg"}</script>'
  );

  return r[0].clave === "og:image";
});

await t("un JSON-LD roto no invalida el resto de la página", () => {
  const r = pr.extraerMetadataImagen(
    '<meta property="og:image" content="https://a.ec/og.jpg">' +
      '<script type="application/ld+json">{roto</script>'
  );

  return r.length === 1 && r[0].url === "https://a.ec/og.jpg";
});

await t("una URL relativa se resuelve contra la página", async () => {
  const f = fetchFalso({
    "https://ejemplo.ec/perfil": {
      html: '<meta property="og:image" content="/img/r.jpg">'
    },
    "https://ejemplo.ec/img/r.jpg": IMG_OK
  });

  const r = await pr.resolverFotoDeCandidato({
    cuentas: [cuenta("web", "sitio", "https://ejemplo.ec/perfil")],
    fetchImpl: f
  });

  return r.fotoActual.imageUrl === "https://ejemplo.ec/img/r.jpg";
});

/*
===========================================================
VALIDACION DEL RECURSO
===========================================================
*/

bloque("una URL no se acepta solo por acabar en .jpg");

await t("HTML disfrazado de imagen se rechaza", async () => {
  /*
    Existen paginas servidas con extension de imagen. Aceptarlas
    pondria un documento HTML como `src` de un `<img>`.
  */
  const f = fetchFalso({
    "https://ejemplo.ec/p": {
      html: '<meta property="og:image" content="https://ejemplo.ec/falsa.jpg">'
    },
    "https://ejemplo.ec/falsa.jpg": { contentType: "text/html", bytes: 9000 }
  });

  const r = await pr.resolverFotoDeCandidato({
    cuentas: [cuenta("web", "sitio", "https://ejemplo.ec/p")],
    fetchImpl: f
  });

  return (
    r.fotoActual === null &&
    r.intentos[0].resultado === R.NO_IMAGEN &&
    r.intentos[0].recursosRechazados[0].motivo.includes("content-type")
  );
});

await t("una imagen de un byte se rechaza por tamaño", async () => {
  const f = fetchFalso({
    "https://ejemplo.ec/p": {
      html: '<meta property="og:image" content="https://ejemplo.ec/px.png">'
    },
    "https://ejemplo.ec/px.png": { contentType: "image/png", bytes: 43 }
  });

  const r = await pr.resolverFotoDeCandidato({
    cuentas: [cuenta("web", "sitio", "https://ejemplo.ec/p")],
    fetchImpl: f
  });

  return r.intentos[0].recursosRechazados[0].resultado === R.IMAGEN_GENERICA;
});

await t("favicon, sprite y pixel se descartan por patrón", async () => {
  const f = fetchFalso({
    "https://ejemplo.ec/p": {
      html:
        '<meta property="og:image" content="https://ejemplo.ec/favicon.ico">' +
        '<meta name="twitter:image" content="https://ejemplo.ec/sprite.png">'
    }
  });

  const r = await pr.resolverFotoDeCandidato({
    cuentas: [cuenta("web", "sitio", "https://ejemplo.ec/p")],
    fetchImpl: f
  });

  return (
    r.fotoActual === null &&
    r.intentos[0].resultado === R.IMAGEN_GENERICA &&
    r.intentos[0].descartadasPorGenericas.length === 2
  );
});

await t("el logotipo de la plataforma no se acepta como retrato", async () => {
  /*
    Las plataformas devuelven su propio logo cuando la pagina no
    expone foto. Aceptarlo pondria el logo de Instagram como cara
    del candidato.
  */
  const f = fetchFalso({
    "https://ejemplo.ec/p": {
      html:
        '<meta property="og:image" content="https://instagram.com/static/images/logo.png">'
    }
  });

  const r = await pr.resolverFotoDeCandidato({
    cuentas: [cuenta("web", "sitio", "https://ejemplo.ec/p")],
    fetchImpl: f
  });

  return r.fotoActual === null && r.intentos[0].resultado === R.IMAGEN_GENERICA;
});

await t("si hay una genérica y luego una válida, gana la válida", async () => {
  const f = fetchFalso({
    "https://ejemplo.ec/p": {
      html:
        '<meta property="og:image" content="https://ejemplo.ec/favicon.ico">' +
        '<meta name="twitter:image" content="https://ejemplo.ec/retrato.jpg">'
    },
    "https://ejemplo.ec/retrato.jpg": IMG_OK
  });

  const r = await pr.resolverFotoDeCandidato({
    cuentas: [cuenta("web", "sitio", "https://ejemplo.ec/p")],
    fetchImpl: f
  });

  return (
    r.fotoActual.imageUrl === "https://ejemplo.ec/retrato.jpg" &&
    r.fotoActual.metadataKey === "twitter:image"
  );
});

/*
===========================================================
ESTADOS Y FALLBACK ENTRE FUENTES
===========================================================
*/

bloque("fallback entre fuentes, con todos los intentos registrados");

await t("sin metadata se declara SIN_METADATA", async () => {
  const f = fetchFalso({
    "https://ejemplo.ec/p": { html: "<html><head></head></html>" }
  });

  const r = await pr.resolverFotoDeCandidato({
    cuentas: [cuenta("web", "sitio", "https://ejemplo.ec/p")],
    fetchImpl: f
  });

  return r.intentos[0].resultado === R.SIN_METADATA;
});

await t("un 403 se declara BLOQUEADA, no ERROR", async () => {
  /*
    La fuente no permite la lectura publica. No se intenta entrar
    de otra forma: eso seria bypass.
  */
  const f = fetchFalso({ "https://ejemplo.ec/p": { status: 403 } });

  const r = await pr.resolverFotoDeCandidato({
    cuentas: [cuenta("web", "sitio", "https://ejemplo.ec/p")],
    fetchImpl: f
  });

  return (
    r.intentos[0].resultado === R.BLOQUEADA && r.intentos[0].httpStatus === 403
  );
});

await t("una fuente que no responde se declara TIMEOUT", async () => {
  const f = fetchFalso({ "https://ejemplo.ec/p": { lanza: "timeout" } });

  const r = await pr.resolverFotoDeCandidato({
    cuentas: [cuenta("web", "sitio", "https://ejemplo.ec/p")],
    fetchImpl: f
  });

  return r.intentos[0].resultado === R.TIMEOUT;
});

await t("un fallo de red se declara ERROR", async () => {
  const f = fetchFalso({ "https://ejemplo.ec/p": { lanza: "red" } });

  const r = await pr.resolverFotoDeCandidato({
    cuentas: [cuenta("web", "sitio", "https://ejemplo.ec/p")],
    fetchImpl: f
  });

  return r.intentos[0].resultado === R.ERROR;
});

await t("una plataforma cerrada NO se pide: NO_INTENTADA con su motivo", async () => {
  /*
    Instagram no expone metadata utilizable sin autenticacion.
    Pedir la pagina seria gastar una peticion para recibir un
    muro, asi que se declara y se pasa a la siguiente.
  */
  const f = fetchFalso({});

  const r = await pr.resolverFotoDeCandidato({
    cuentas: [cuenta("instagram", "ig", "https://instagram.com/ig")],
    fetchImpl: f
  });

  return (
    r.intentos[0].resultado === R.NO_INTENTADA &&
    f.llamadas.length === 0 &&
    r.limitaciones.length === 1
  );
});

await t("LinkedIn está declarado como bloqueado y no se pide", async () => {
  const f = fetchFalso({});

  const r = await pr.resolverFotoDeCandidato({
    cuentas: [cuenta("linkedin", "li", "https://linkedin.com/in/li")],
    fetchImpl: f
  });

  return r.intentos[0].capacidad === "BLOCKED" && f.llamadas.length === 0;
});

await t("si una fuente falla se prueba la siguiente por prioridad", async () => {
  /*
    Facebook no da imagen; la web si. El orden de la prioridad
    centralizada pone Facebook antes que web.
  */
  const f = fetchFalso({
    "https://facebook.com/fb": { html: "<html></html>" },
    "https://ejemplo.ec": {
      html: '<meta property="og:image" content="https://ejemplo.ec/r.jpg">'
    },
    "https://ejemplo.ec/r.jpg": IMG_OK
  });

  const r = await pr.resolverFotoDeCandidato({
    cuentas: [
      cuenta("web", "sitio", "https://ejemplo.ec"),
      cuenta("facebook", "fb", "https://facebook.com/fb")
    ],
    fetchImpl: f
  });

  return (
    r.intentos.length === 2 &&
    r.intentos[0].plataformaId === "facebook" &&
    r.intentos[0].resultado === R.SIN_METADATA &&
    r.fotoActual.plataformaId === "web"
  );
});

await t("no se ocultan los fallos: todos los intentos se devuelven", async () => {
  const f = fetchFalso({ "https://facebook.com/fb": { status: 500 } });

  const r = await pr.resolverFotoDeCandidato({
    cuentas: [
      cuenta("facebook", "fb", "https://facebook.com/fb"),
      cuenta("instagram", "ig", "https://instagram.com/ig")
    ],
    fetchImpl: f
  });

  return r.intentos.length === 2 && r.fotoActual === null;
});

/*
===========================================================
PROCEDENCIA Y LIMITES
===========================================================
*/

bloque("procedencia completa y ninguna afirmación de más");

await t("la foto resuelta conserva fuente, cuenta, plataforma y clave", async () => {
  const f = fetchFalso({
    "https://ejemplo.ec/p": {
      html: '<meta property="og:image" content="https://ejemplo.ec/r.jpg">'
    },
    "https://ejemplo.ec/r.jpg": IMG_OK
  });

  const r = await pr.resolverFotoDeCandidato({
    cuentas: [cuenta("web", "sitio", "https://ejemplo.ec/p")],
    fetchImpl: f
  });

  const foto = r.fotoActual;

  return (
    foto.sourceUrl === "https://ejemplo.ec/p" &&
    foto.sourceType === "cuenta" &&
    foto.plataformaId === "web" &&
    foto.cuentaId === "web:sitio" &&
    foto.handle === "sitio" &&
    foto.metadataKey === "og:image" &&
    foto.provider === "metadata publica" &&
    typeof foto.resolvedAt === "string" &&
    foto.origen === "cuenta_declarada"
  );
});

await t("verifiedImageResource true NO implica verificada por Sentinel", async () => {
  /*
    LA DISTINCION CRITICA. Una dice que la URL devuelve una
    imagen; la otra, que sabemos a quien retrata. La segunda
    exigiria biometria y este modulo la prohibe.
  */
  const f = fetchFalso({
    "https://ejemplo.ec/p": {
      html: '<meta property="og:image" content="https://ejemplo.ec/r.jpg">'
    },
    "https://ejemplo.ec/r.jpg": IMG_OK
  });

  const r = await pr.resolverFotoDeCandidato({
    cuentas: [cuenta("web", "sitio", "https://ejemplo.ec/p")],
    fetchImpl: f
  });

  return (
    r.fotoActual.verifiedImageResource === true &&
    r.fotoActual.verificadaPorSentinel === false
  );
});

await t("no hay reconocimiento facial en ninguna parte del módulo", async () => {
  const fs = await import("node:fs");

  const texto = fs.readFileSync(
    new URL("../services/intelligence/candidatePhotoResolver.js", import.meta.url),
    "utf8"
  );

  /*
    Se comprueba que no se importa ni se invoca nada de vision
    por computador. El modulo solo lee cabeceras y metadata.
  */
  return (
    !/\b(faceapi|face-api|tensorflow|opencv|rekognition|clarifai|vision)\b/i.test(
      texto
    ) && /prohibe/i.test(texto)
  );
});

await t("la prioridad está centralizada, no dispersa", () => {
  return (
    Array.isArray(pr.PRIORIDAD_FUENTES) &&
    pr.PRIORIDAD_FUENTES[0] === "manual" &&
    pr.PRIORIDAD_FUENTES[1] === "instagram" &&
    pr.PRIORIDAD_FUENTES.at(-1) === "web"
  );
});

await t("hay tope de fuentes: no es scraping masivo", async () => {
  const cuentas = ["web", "facebook", "tiktok", "youtube"].map((p, i) =>
    cuenta(p, `c${i}`, `https://ejemplo${i}.ec`)
  );

  const f = fetchFalso({});

  const r = await pr.resolverFotoDeCandidato({ cuentas, fetchImpl: f });

  /* Una peticion por fuente intentada, nunca mas de las del tope. */
  return f.llamadas.filter((x) => x.metodo === "GET").length <= 4;
});

await t("nunca se envían cookies ni cabeceras de autenticación", async () => {
  let opcionesVistas = null;

  const f = async (url, opciones) => {
    opcionesVistas = opciones;

    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => "<html></html>"
    };
  };

  await pr.resolverFotoDeCandidato({
    cuentas: [cuenta("web", "sitio", "https://ejemplo.ec")],
    fetchImpl: f
  });

  const cabeceras = Object.keys(opcionesVistas?.headers || {}).map((k) =>
    k.toLowerCase()
  );

  return (
    !cabeceras.includes("cookie") &&
    !cabeceras.includes("authorization") &&
    opcionesVistas.redirect === "follow"
  );
});

await t("ninguna cuenta de ningún candidato real está en el módulo", async () => {
  const fs = await import("node:fs");

  const prohibidos = [
    ["jota", "lloret"].join(""),
    ["lloret", "valdivieso"].join("")
  ];

  const ficheros = [
    new URL("../services/intelligence/candidatePhotoResolver.js", import.meta.url),
    new URL("../services/intelligence/accountContracts.js", import.meta.url),
    new URL("../services/intelligence/accountIntelligence.js", import.meta.url),
    new URL(import.meta.url)
  ];

  return ficheros.every((x) => {
    const texto = fs.readFileSync(x, "utf8");

    return prohibidos.every((y) => !new RegExp(y, "i").test(texto));
  });
});

/* ---------------------------------------------------------
   RESULTADO
--------------------------------------------------------- */

console.log("\n===========================================");
console.log(`PASS: ${pass}    FALL: ${fail}`);

if (fallos.length) {
  console.log("\nFallos:");
  fallos.forEach((f) => console.log(`  - ${f}`));
}

console.log("===========================================\n");

process.exit(fail > 0 ? 1 : 0);
