// apps/backend/tests/socialProviderClient.test.mjs

/*
===========================================================
CLIENTE HTTP DE PROVEEDOR SOCIAL
SOCIAL-PROVIDER-ALTERNATIVE-01
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/socialProviderClient.test.mjs

SIN RED. `fetch` inyectado. Ningun proveedor real se toca.

LO QUE DEFIENDE
-----------------------------------------------------------

    LA GUARDA VA ANTES DE LA RED

Un cliente que sale a la red y despues comprueba si podia
hacerlo ya gasto el credito. Hay test de que con el proveedor
deshabilitado el fetch NO se invoca.

    LA CLAVE NO SALE DE AQUI

Ni en la URL, ni en el resultado, ni en el mensaje de error. El
error de un proveedor es justo lo que alguien copia y pega.

    NADA SE PROMUEVE POR DOCUMENTACION

Bright Data quedo BLOQUEADO_POR_PROVEEDOR y los dos nuevos
entran AUTOSERVICIO_SIN_PROBAR. Ninguno tiene una sola capacidad
medida.
===========================================================
*/

process.env.SENTINEL_LAKE_ADAPTER = "memoria";

const cli = await import("../services/ingest/adapters/socialProviderClient.js");

const esp = await import("../services/intelligence/externalSocialProvider.js");

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
      console.log(`  FALL  ${nombre}  (devolvio ${JSON.stringify(valor)})`);
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


const CLAVE = "clave-ficticia-de-prueba-000";

/*
  Entorno de un proveedor que YA estuviera aprobado. Se construye
  a mano porque ninguno lo esta todavia, y eso es justo lo que se
  quiere poder probar sin aprobar a nadie de verdad.
*/
const entornoListo = {
  SOCIAL_EXTERNAL_PROVIDER_ENABLED: "true",
  SCRAPECREATORS_API_KEY: CLAVE
};

const json = (cuerpo, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(cuerpo)
});


bloque("Estado de los proveedores tras el bloqueo de Bright Data");

await t("Bright Data queda BLOQUEADO_POR_PROVEEDOR", () => {
  const p = esp.proveedor("brightdata");

  return (
    p.estadoComercial === "BLOQUEADO_POR_PROVEEDOR" &&
    p.aprobadoParaOperar === false
  );
});

await t("los dos alternativos son de alta autoservicio y sin tarjeta", () => {
  return ["scrapecreators", "socialcrawl"].every((id) => {
    const p = esp.proveedor(id);

    return (
      p.altaAutoservicio === true &&
      p.requiereTarjeta === false &&
      p.creditosGratis === 100
    );
  });
});

await t("Data365 queda marcado como llamada comercial", () => {
  const p = esp.proveedor("data365");

  return (
    p.requiereLlamadaComercial === true && p.altaAutoservicio === false
  );
});

/*
  ACTUALIZADO EN SOCIAL-PROVIDER-REAL-02. ScrapeCreators paso la
  prueba real, asi que ya no es cierto que nadie tenga
  capacidades medidas. Lo que hay que defender ahora es mas fino:
  que solo el las tenga.
*/
await t("solo ScrapeCreators tiene capacidades medidas", () => {
  const conMedidas = esp
    .estadoDeProveedores()
    .proveedores.filter((p) => p.capacidadesMedidas > 0)
    .map((p) => p.id);

  return conMedidas.length === 1 && conMedidas[0] === "scrapecreators";
});

await t("el bloqueo de Bright Data no promueve a nadie", () => {
  /*
    ScrapeCreators subio por una medicion real, no porque el otro
    cayera. SocialCrawl, que no se ha probado, sigue igual: es la
    comparacion que lo demuestra.
  */
  return (
    esp.capacidadDeProveedor("socialcrawl", "facebook", "comment_text").estado ===
      esp.ESTADOS_CAPACIDAD_PROVEEDOR.UNVERIFIED_PROVIDER &&
    esp.capacidadDeProveedor("brightdata", "facebook", "comment_text").estado ===
      esp.ESTADOS_CAPACIDAD_PROVEEDOR.UNVERIFIED_PROVIDER
  );
});


bloque("La guarda va antes de la red");

await t("con la bandera apagada NO se llama a fetch", async () => {
  let llamado = false;

  const r = await cli.pedirAlProveedor({
    providerId: "scrapecreators",
    platformId: "facebook",
    operacion: "perfil",
    entorno: {},
    fetchImpl: async () => {
      llamado = true;

      return json({});
    }
  });

  return (
    llamado === false &&
    r.estado === cli.ESTADOS_CLIENTE.DESHABILITADO &&
    r.llamadas === 0
  );
});

await t("un proveedor no aprobado no sale a la red aunque haya clave", async () => {
  let llamado = false;

  const r = await cli.pedirAlProveedor({
    providerId: "brightdata",
    platformId: "facebook",
    operacion: "perfil",
    entorno: {
      SOCIAL_EXTERNAL_PROVIDER_ENABLED: "true",
      BRIGHTDATA_API_KEY: CLAVE
    },
    fetchImpl: async () => {
      llamado = true;

      return json({});
    }
  });

  return llamado === false && r.llamadas === 0;
});

await t("la guarda se evalua ANTES de resolver el endpoint", async () => {
  /*
    Con un proveedor SIN aprobar da igual si el endpoint existe:
    la guarda corta primero. Se usa un endpoint que si existe
    para dejar claro el orden —si la resolucion fuera antes, esto
    habria salido a la red—.
  */
  let llamado = false;

  const r = await cli.pedirAlProveedor({
    providerId: "socialcrawl",
    platformId: "facebook",
    operacion: "perfil",
    entorno: {
      SOCIAL_EXTERNAL_PROVIDER_ENABLED: "true",
      SOCIALCRAWL_API_KEY: CLAVE
    },
    fetchImpl: async () => {
      llamado = true;

      return json({});
    }
  });

  return (
    llamado === false &&
    r.estado === cli.ESTADOS_CLIENTE.DESHABILITADO &&
    r.llamadas === 0
  );
});

await t("un proveedor APROBADO con endpoint no declarado no gasta credito", async () => {
  /*
    ACTUALIZADO en P-CAND-INSTAGRAM-FALLBACK-01: Instagram ya
    tiene endpoints declarados (perfil, publicaciones,
    comentarios, respuestas). La prueba de "no declarado" se
    mueve a una plataforma que ScrapeCreators no contempla en su
    registro. Pasa la guarda de aprobacion y aun asi no sale a la
    red porque no hay endpoint que resolver.
  */
  let llamado = false;

  const r = await cli.pedirAlProveedor({
    providerId: "scrapecreators",
    platformId: "youtube",
    operacion: "comentarios",
    entorno: entornoListo,
    fetchImpl: async () => {
      llamado = true;

      return json({});
    }
  });

  return (
    llamado === false &&
    r.estado === cli.ESTADOS_CLIENTE.ENDPOINT_NO_DECLARADO &&
    r.llamadas === 0
  );
});

await t("Instagram comentarios y respuestas SI estan declarados desde este gate", () => {
  /*
    El positivo que reemplaza al negativo anterior: se demuestra
    que ahora existen, en lugar de solo dejar de afirmar que no.
  */
  return (
    cli.armarPeticion({ p: esp.proveedor("scrapecreators"), platformId: "instagram", operacion: "comentarios", clave: CLAVE }) !== null &&
    cli.armarPeticion({ p: esp.proveedor("scrapecreators"), platformId: "instagram", operacion: "respuestas", clave: CLAVE }) !== null
  );
});

await t("un proveedor aprobado SI llega a la red cuando todo encaja", async () => {
  let llamado = false;

  const r = await cli.pedirAlProveedor({
    providerId: "scrapecreators",
    platformId: "facebook",
    operacion: "perfil",
    params: { url: "https://www.facebook.com/sintetica" },
    entorno: entornoListo,
    fetchImpl: async () => {
      llamado = true;

      return json({ success: true, id: "1", name: "Sintetica" });
    }
  });

  return llamado === true && r.estado === cli.ESTADOS_CLIENTE.OK && r.llamadas === 1;
});

await t("solo el proveedor aprobado puede salir a la red", async () => {
  /*
    El estado real del proyecto, fijado por test: Bright Data
    bloqueado por su proveedor, SocialCrawl y Data365 sin
    aprobar. Si alguno de estos tres empieza a llamar sera porque
    alguien lo aprobo, y eso debe ser una decision consciente con
    su commit.
  */
  const ids = ["brightdata", "socialcrawl", "data365"];

  const resultados = await Promise.all(
    ids.map((id) =>
      cli.pedirAlProveedor({
        providerId: id,
        platformId: "facebook",
        operacion: "perfil",
        entorno: {
          SOCIAL_EXTERNAL_PROVIDER_ENABLED: "true",
          BRIGHTDATA_API_KEY: CLAVE,
          SCRAPECREATORS_API_KEY: CLAVE,
          SOCIALCRAWL_API_KEY: CLAVE,
          DATA365_API_KEY: CLAVE
        },
        fetchImpl: async () => {
          throw new Error("no deberia haber llamada");
        }
      })
    )
  );

  return resultados.every((r) => r.llamadas === 0);
});


bloque("Armar la peticion: pieza pura, sin red");

const P = esp.proveedor("scrapecreators");

const peticion = cli.armarPeticion({
  p: P,
  platformId: "facebook",
  operacion: "publicaciones",
  params: { handle: "pedropalaciosu", limit: 1 },
  clave: CLAVE
});

await t("resuelve el endpoint desde el registro", () => {
  return peticion.url.includes("/v1/facebook/profile/posts");
});

await t("los parametros viajan en la query", () => {
  return (
    peticion.url.includes("handle=pedropalaciosu") &&
    peticion.url.includes("limit=1")
  );
});

await t("la clave viaja en cabecera y NUNCA en la URL", () => {
  return (
    peticion.cabeceras["x-api-key"] === CLAVE && !peticion.url.includes(CLAVE)
  );
});

await t("un endpoint no declarado devuelve null y no una URL inventada", () => {
  /*
    ACTUALIZADO en P-CAND-INSTAGRAM-FALLBACK-01: instagram/comentarios
    ya existe. Se usa una plataforma fuera del registro para seguir
    probando lo mismo: que un endpoint ausente no inventa una URL.
  */
  return (
    cli.armarPeticion({
      p: P,
      platformId: "youtube",
      operacion: "comentarios",
      clave: CLAVE
    }) === null
  );
});

await t("los cuatro endpoints de los huecos estan declarados", () => {
  /*
    Facebook posts y comentarios, TikTok videos y comentarios:
    los cuatro que SOCIAL-PROVIDER-EVAL-01 dejo abiertos.
  */
  return [
    ["facebook", "publicaciones"],
    ["facebook", "comentarios"],
    ["tiktok", "publicaciones"],
    ["tiktok", "comentarios"]
  ].every(
    ([plat, op]) =>
      cli.armarPeticion({ p: P, platformId: plat, operacion: op, clave: CLAVE }) !==
      null
  );
});


bloque("Bloqueos que no se confunden entre si");

await t("401 y 403 son credencial rechazada", () => {
  return (
    cli.clasificarRespuestaHttp(401) === cli.ESTADOS_CLIENTE.CREDENCIAL_RECHAZADA &&
    cli.clasificarRespuestaHttp(403) === cli.ESTADOS_CLIENTE.CREDENCIAL_RECHAZADA
  );
});

await t("402 es facturacion, no credencial", () => {
  const e = cli.clasificarRespuestaHttp(402);

  return (
    e === cli.ESTADOS_CLIENTE.BILLING_BLOQUEADO &&
    e !== cli.ESTADOS_CLIENTE.CREDENCIAL_RECHAZADA
  );
});

await t("429 es cuota agotada", () => {
  return cli.clasificarRespuestaHttp(429) === cli.ESTADOS_CLIENTE.CUOTA_AGOTADA;
});

await t("un 500 es error del proveedor y no un bloqueo de credencial", () => {
  return cli.clasificarRespuestaHttp(500) === cli.ESTADOS_CLIENTE.ERROR_PROVEEDOR;
});


bloque("La clave no sale de aqui");

await t("la clave no viaja nunca en la URL armada", () => {
  return !peticion.url.includes(CLAVE);
});

await t("se redacta cuando el proveedor la devuelve en su error", () => {
  /*
    El caso feo: el proveedor hace eco de la clave en su mensaje
    de error. Ese texto es justo el que alguien copia y pega.
  */
  const eco = `{"error":"invalid key ${CLAVE} for x-api-key"}`;

  const limpio = cli.sanitizar(eco, CLAVE);

  return !limpio.includes(CLAVE) && limpio.includes("REDACTADO");
});

await t("se redacta en el mensaje de una excepcion", () => {
  const limpio = cli.sanitizar(`fallo enviando x-api-key: ${CLAVE}`, CLAVE);

  return !limpio.includes(CLAVE);
});

await t("sanitizar redacta api_key, x-api-key y Bearer", () => {
  const sucio = "api_key=abc123secreto&x-api-key: otro999&Authorization: Bearer zzz888";

  const limpio = cli.sanitizar(sucio, null);

  return (
    !limpio.includes("abc123secreto") &&
    !limpio.includes("otro999") &&
    !limpio.includes("zzz888")
  );
});


bloque("Lo que el cliente NO hace");

await t("declara que no rota proxies ni resuelve captchas", () => {
  const d = cli.diagnostico({});

  return (
    d.banderaActiva === false &&
    d.loQueNoHace.includes("rotacion de proxies") &&
    d.loQueNoHace.includes("resolucion de captchas") &&
    d.loQueNoHace.includes("automatizacion de login")
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

process.exitCode = fail > 0 ? 1 : 0;
