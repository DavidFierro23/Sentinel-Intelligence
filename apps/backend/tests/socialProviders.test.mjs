// apps/backend/tests/socialProviders.test.mjs

/*
===========================================================
PRUEBAS DE SOCIAL-PROVIDER-EVAL-01
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/socialProviders.test.mjs

SIN RED Y SIN CREDENCIAL. Es justamente lo que se comprueba: que
sin credencial no se toca la red ni una vez.

LO QUE DEFIENDEN
-----------------------------------------------------------

1 · SIN CREDENCIAL, CERO LLAMADAS.
    No basta con que falle: no debe intentarlo.

2 · NO SE INVENTA UN PRECIO.
    El coste de la API de X depende del plan y ha cambiado
    varias veces. `null`, no una cifra plausible.

3 · REPOST Y CITA NO SON LO MISMO.
    Uno amplifica sin anadir nada; el otro comenta.

4 · LA MARCA DE VERIFICADO NO CORROBORA NADA.
    En X es una suscripcion de pago, no una comprobacion de
    identidad.

5 · «REQUIERE AUTORIZACION» SON DOS COSAS DISTINTAS.
    Que Meta revise nuestra app es trabajo nuestro. Que el
    observado nos de permiso es imposible en inteligencia
    electoral. La matriz las separa.
===========================================================
*/

process.env.SENTINEL_LAKE_ADAPTER = "memoria";

/* Explicitamente SIN credencial de X. */
delete process.env.X_BEARER_TOKEN;

delete process.env.TWITTER_BEARER_TOKEN;

const x = await import("../services/ingest/adapters/xAdapter.js");

const pap = await import("../services/intelligence/platformAdapterPort.js");

const scm = await import("../services/intelligence/socialCapabilityMatrix.js");

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
    console.log(`  ERR   ${nombre}  ${error.message}`);
  }
}

function bloque(titulo) {
  console.log(`\n--- ${titulo} ---`);
}


/*
===========================================================
1 · SIN CREDENCIAL NO SE TOCA LA RED
===========================================================
*/
bloque("X: sin credencial, cero llamadas");

await t("el adapter se declara no configurado", () => {
  return x.estaConfigurado() === false;
});

await t("resolver una cuenta no hace ni una peticion", async () => {
  let llamadas = 0;

  const r = await x.resolverCuentaPorHandle("cualquiera", {
    fetch: async () => {
      llamadas += 1;

      return { ok: true, status: 200, json: async () => ({}) };
    }
  });

  return llamadas === 0 && r.estado === "SIN_CREDENCIAL" && r.llamadas === 0;
});

await t("listar publicaciones tampoco", async () => {
  let llamadas = 0;

  const r = await x.listarPublicaciones("123", {
    fetch: async () => {
      llamadas += 1;

      return { ok: true, status: 200, json: async () => ({}) };
    }
  });

  return llamadas === 0 && r.estado === "SIN_CREDENCIAL";
});

await t("buscar menciones tampoco", async () => {
  let llamadas = 0;

  const r = await x.buscarMenciones("consulta", {
    fetch: async () => {
      llamadas += 1;

      return { ok: true, status: 200, json: async () => ({}) };
    }
  });

  return llamadas === 0 && r.estado === "SIN_CREDENCIAL";
});

await t("y el motivo nombra la variable exacta que falta", async () => {
  const r = await x.resolverCuentaPorHandle("cualquiera");

  return (
    r.motivo.includes("X_BEARER_TOKEN") &&
    r.motivo.includes("Sentinel sigue funcionando")
  );
});


/*
===========================================================
2 · NO SE INVENTA UN PRECIO
===========================================================
*/
bloque("coste: null, no una cifra plausible");

await t("el coste por llamada es null", () => {
  return x.COSTE_POR_LLAMADA === null && x.CUOTA_DIARIA_GRATUITA === null;
});

await t("el diagnostico explica por que no consta", () => {
  const d = x.diagnostico();

  return (
    d.costoPorConsulta === null &&
    d.motivoCosto.includes("no se estiman") &&
    d.motivoCosto.includes("plan contratado")
  );
});

await t("no hay ninguna cifra de precio escrita en el adapter", async () => {
  const { readFile } = await import("node:fs/promises");

  const src = await readFile(
    new URL("../services/ingest/adapters/xAdapter.js", import.meta.url),
    "utf8"
  );

  /* Ni dolares ni euros ni «USD» junto a un numero. */
  return !/(\$\s?\d|\d+\s?(usd|eur|dolares|euros)|precio\s*[:=]\s*\d)/i.test(src);
});

await t("ninguna credencial literal en el adapter", async () => {
  const { readFile } = await import("node:fs/promises");

  const src = await readFile(
    new URL("../services/ingest/adapters/xAdapter.js", import.meta.url),
    "utf8"
  );

  return !/(bearer|token|secret)\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/i.test(src);
});


/*
===========================================================
3 · NORMALIZACION
===========================================================
*/
bloque("normalizacion de cuenta y publicacion");

const USUARIO = {
  id: "111",
  username: "cuenta_ficticia",
  name: "Cuenta Ficticia",
  description: "Descripcion cualquiera",
  created_at: "2015-05-05T00:00:00.000Z",
  verified: true,
  public_metrics: {
    followers_count: 4200,
    following_count: 300,
    tweet_count: 8800
  }
};

const POST_COMPLETO = {
  id: "999",
  text: "Texto de una publicacion ficticia",
  created_at: "2026-08-20T10:00:00.000Z",
  author_id: "111",
  lang: "es",
  public_metrics: {
    like_count: 120,
    retweet_count: 45,
    reply_count: 7,
    quote_count: 3,
    impression_count: 9800
  }
};

/* Sin `impression_count`: el caso que distingue null de 0. */
const POST_SIN_VISTAS = {
  id: "1000",
  text: "Otra publicacion ficticia",
  created_at: "2026-08-21T10:00:00.000Z",
  author_id: "111",
  public_metrics: { like_count: 0, retweet_count: 0, reply_count: 0, quote_count: 0 }
};

await t("la cuenta se normaliza con sus cifras publicas", () => {
  const u = x.normalizarUsuario(USUARIO);

  return (
    u.userId === "111" &&
    u.handle === "cuenta_ficticia" &&
    u.estadisticasPublicas.followers === 4200 &&
    u.url === "https://x.com/cuenta_ficticia"
  );
});

await t("las cifras NO clasifican a la cuenta, y lo dice", () => {
  const u = x.normalizarUsuario(USUARIO);

  return u.estadisticasPublicas.declaracion.includes("umbral defendible");
});

await t("la marca de verificado se marca como NO evidencia", () => {
  const u = x.normalizarUsuario(USUARIO);

  const texto = u.marcaDeVerificado.noEsEvidencia.toLowerCase();

  return (
    u.marcaDeVerificado.valor === true &&
    texto.includes("suscripcion de pago") &&
    texto.includes("no corrobora")
  );
});

await t("repost y cita se guardan SEPARADOS", () => {
  const p = x.normalizarPost(POST_COMPLETO, { handle: "cuenta_ficticia" });

  return (
    p.x.metricas.reposts.value === 45 &&
    p.x.metricas.quotes.value === 3 &&
    p.x.metricas.reposts.value !== p.x.metricas.quotes.value
  );
});

await t("la URL canonica se construye con handle y postId", () => {
  const p = x.normalizarPost(POST_COMPLETO, { handle: "cuenta_ficticia" });

  return p.x.canonicalUrl === "https://x.com/cuenta_ficticia/status/999";
});

await t("sin handle sigue habiendo URL canonica utilizable", () => {
  const p = x.normalizarPost(POST_COMPLETO, {});

  return p.x.canonicalUrl === "https://x.com/i/status/999";
});

await t("impression_count ausente es NO_INCLUIDA_POR_LA_API, no 0", () => {
  const p = x.normalizarPost(POST_SIN_VISTAS, { handle: "cuenta_ficticia" });

  return (
    p.x.metricas.views.value === null &&
    p.x.metricas.views.availability === "NO_INCLUIDA_POR_LA_API"
  );
});

await t("y un cero real si se conserva como cero", () => {
  const p = x.normalizarPost(POST_SIN_VISTAS, { handle: "cuenta_ficticia" });

  return (
    p.x.metricas.likes.value === 0 &&
    p.x.metricas.likes.availability === "DISPONIBLE"
  );
});

await t("la publicacion pasa por el contrato de evidencia comun", () => {
  const p = x.normalizarPost(POST_COMPLETO, { handle: "cuenta_ficticia" });

  /* evidenceId y canonicalUrl los produce evidenceContract. */
  return (
    typeof p.evidenceId === "string" &&
    p.evidenceId.startsWith("ev-") &&
    !!p.canonicalUrl &&
    p.providerId === x.ID
  );
});

await t("la busqueda declara su ventana de 7 dias como limitacion", () => {
  const d = x.diagnostico();

  return d.limitaciones.some((l) => l.includes("7 dias"));
});

await t("un 403 se distingue de un 429: plan frente a limite", async () => {
  const d = x.diagnostico();

  return d.limitaciones.some(
    (l) => l.includes("403") && l.includes("plan no incluye")
  );
});


/*
===========================================================
4 · PUERTO
===========================================================
*/
bloque("puerto: X registrado y sin credencial");

await t("X se resuelve como SIN_CREDENCIAL, no como ausente", async () => {
  const r = await pap.resolverAdaptador("x");

  return r.estado === pap.ESTADOS_ADAPTADOR.SIN_CREDENCIAL;
});

await t("y sus cuatro capacidades se detectan por el mapa de funciones", async () => {
  const r = await pap.resolverAdaptador("x");

  return r.capacidadesFaltantes.length === 0;
});

await t("la accion requerida nombra X_BEARER_TOKEN", async () => {
  const p = await pap.preparacionParaObservacionReal(["x"]);

  return p.accionRequerida[0]?.variable === "X_BEARER_TOKEN";
});

await t("comprobar la preparacion no gasta nada", async () => {
  const p = await pap.preparacionParaObservacionReal(["x"]);

  return p.nota.includes("Ninguna cuota se consume");
});


/*
===========================================================
5 · MATRIZ: LOS SIETE ESTADOS DE CELDA
===========================================================
*/
bloque("matriz: que hace falta, no solo si existe");

/*
  Afinado en X-REAL-01, que anadio REQUIERE_CREDITOS y
  NO_PROBADO. El invariante util no es cuantos hay sino que
  ninguna celda produzca una etiqueta fuera del catalogo: contar
  se rompe cada vez que el mundo ensena algo nuevo.
*/
await t("toda celda produce una etiqueta del catalogo", () => {
  const validos = new Set(Object.values(scm.ESTADOS_CELDA));

  return scm.PLATAFORMAS.every((p) =>
    Object.values(p.capacidades).every((c) => validos.has(scm.celdaDe(c)))
  );
});

await t("la celda se DERIVA: no es un campo que pueda desincronizarse", () => {
  const m = scm.matrizDeCapacidades();

  return m.filas.every((f) =>
    Object.values(f.porPlataforma).every(
      (celda) => celda.celda === scm.celdaDe(celda)
    )
  );
});

await t("app review y autorizacion del titular NO se confunden", () => {
  /*
    Facebook publicaciones: lo revisa Meta, es trabajo nuestro.
    Facebook video: lo autoriza el titular, y eso no lo podemos
    conseguir de un candidato.
  */
  return (
    scm.celdaDe(scm.capacidad("facebook", "publicaciones")) ===
      "REQUIERE_APP_REVIEW" &&
    scm.celdaDe(scm.capacidad("facebook", "views")) === "REQUIERE_AUTORIZACION"
  );
});

/*
  Tercera version de este test, y las tres veces por la misma
  razon: la realidad se midio y cambio la respuesta. Primero se
  supuso «detras de un plan»; luego se midio un 402 y resulto ser
  saldo; despues se cargo credito y quedo OPERATIVO.

  Lo que se comprueba ahora es lo que de verdad importa para el
  benchmark: X entrega metricas de publicaciones de TERCEROS sin
  autorizacion del titular, que es lo que ninguna otra plataforma
  del grupo hace.
*/
await t("X entrega metricas de terceros sin autorizacion del titular", () => {
  const xp = scm.PLATAFORMAS.find((p) => p.plataformaId === "x");

  const medidas = ["publicaciones", "views", "likes", "comments", "shares"].filter(
    (k) => scm.celdaDe(xp.capacidades[k]) === "MEDIDO_TERCERO"
  );

  return (
    medidas.length === 5 &&
    xp.terceros === true &&
    xp.autorizacionDelTitular === false &&
    xp.medicionReal.conclusion === "OPERATIVO"
  );
});

await t("y el aviso de retweets viaja con la medicion", () => {
  const xp = scm.PLATAFORMAS.find((p) => p.plataformaId === "x");

  return (
    xp.medicionReal.avisoRetweets.includes("no se pueden promediar") ||
    xp.medicionReal.avisoRetweets.includes("No se pueden promediar")
  );
});

await t("TikTok entero exige proveedor externo", () => {
  const tk = scm.PLATAFORMAS.find((p) => p.plataformaId === "tiktok");

  const conProveedor = Object.values(tk.capacidades).filter(
    (c) => scm.celdaDe(c) === "REQUIERE_PROVEEDOR"
  );

  return conProveedor.length >= 8;
});

await t("cada plataforma declara sus programas de acceso", () => {
  const m = scm.matrizDeCapacidades();

  return ["x", "instagram", "facebook", "tiktok"].every(
    (id) =>
      (m.plataformas.find((p) => p.plataformaId === id).programasDeAcceso || [])
        .length > 0
  );
});

await t("y los endpoints concretos donde existen", () => {
  const m = scm.matrizDeCapacidades();

  return ["x", "instagram", "facebook"].every(
    (id) => !!m.plataformas.find((p) => p.plataformaId === id).endpoints
  );
});

await t("el recuento por celda cubre las 60 casillas", () => {
  const m = scm.matrizDeCapacidades();

  const suma = Object.values(m.resumen.porCelda).reduce((s, n) => s + n, 0);

  return suma === 60 && m.resumen.celdas === 60;
});

await t("Instagram no da menciones de terceros por ninguna via", () => {
  return scm.celdaDe(scm.capacidad("instagram", "menciones")) === "NO_DISPONIBLE";
});

/*
  Afinado en META-IG-REAL-01. `views` de Instagram si se midio,
  pero sobre NUESTRA cuenta y como OWNER_INSIGHT. Para el
  Instagram de un candidato sigue sin haber via, y eso es lo que
  el test tiene que fijar.
*/
await t("las reproducciones de Instagram no son obtenibles de un tercero", () => {
  return (
    scm.celdaDe(scm.capacidad("instagram", "views")) === "MEDIDO_PROPIO" &&
    scm.celdaDe(scm.capacidad("instagram", "views")) !== "MEDIDO_TERCERO"
  );
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
