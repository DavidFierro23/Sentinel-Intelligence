// apps/backend/tests/igRoute.test.mjs

/*
===========================================================
INSTAGRAM POR LA RUTA NORMAL DEL PROYECTO
P-CAND-IG-ROUTE-01
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/igRoute.test.mjs

SIN RED HACIA META. El router se monta de verdad y se le habla
por HTTP; lo unico simulado es `graph.facebook.com`.

QUE DEFIENDE ESTA SUITE
-----------------------------------------------------------

P-CAND-IG-MULTICANDIDATO-01 midio Instagram llamando a los
servicios desde un script. Por la ruta HTTP el mismo motor
devolvia NO_EJECUTABLE, porque `idParaBusinessDiscovery` y
`cuentasPropias` no llegaban.

Las suites de servicio no lo vieron: pasaban esos parametros a
mano, asi que probaban el motor y no el cableado. Este fichero
prueba el cableado, que es donde estaba el fallo.

    HTTP  ->  observarCandidato  ->  observarInstagram
          ->  adapter  ->  Lake

Y las tres distinciones que no se pueden perder en el camino:

    MEDIDO_TERCERO             la cuenta no es nuestra
    MEDIDO_PROPIO_AUTORIZADO   el token la administra
    NO_SOPORTADO_PERSONAL      declarada personal, no se pregunta
===========================================================
*/

process.env.SENTINEL_LAKE_ADAPTER = "memoria";

process.env.FACEBOOK_USER_ACCESS_TOKEN = "EAA-TOKEN-FICTICIO-NO-REAL-000";

/*
  `business_discovery` viaja con el token de Facebook Login, pero
  el puerto de adaptadores pregunta por `estaConfigurado()`, que
  sigue significando «hay token de Instagram Login». Sin este el
  adaptador entero queda SIN_CREDENCIAL y la via no se intenta.

  Se pone porque el .env real lo tiene y porque cambiar esa
  semantica es otra decision, tomada a proposito en
  META-FB-LOGIN-SETUP-01. Queda declarado como riesgo: un entorno
  con SOLO el token de Facebook —el que esta via necesita— recibe
  un NO_EJECUTABLE que habla de la credencial equivocada.
*/
process.env.INSTAGRAM_ACCESS_TOKEN = "IGQ-TOKEN-FICTICIO-NO-REAL-000";

process.env.META_APP_ID = "000000000000000";

process.env.META_APP_SECRET = "SECRETO-FICTICIO-NO-REAL-000";

import express from "express";

const ps = await import("../services/projects/projectStore.js");

const ca = await import("../services/intelligence/candidateAssets.js");

const mc = await import("../services/intelligence/metaObservationContext.js");

const rutas = (await import("../routes/projects.js")).default;

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


/* ---------------------------------------------------------
   META SIMULADO

   Se conserva el fetch real: el test tiene que poder hablar
   con su propio servidor. Solo se intercepta graph.facebook.com.
--------------------------------------------------------- */
const fetchReal = globalThis.fetch;

/* Nuestro Instagram: el que el token administra. */
const IG_PROPIO = "cuentapropiaig";

const ID_IG_PROPIO = "17841400000000000";

let llamadas = [];

const json = (cuerpo) => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify(cuerpo)
});

const mediaFicticia = [
  {
    id: "18138113440516091",
    caption: "Publicacion de prueba uno",
    permalink: "https://www.instagram.com/p/DXBOgKHjmEC/",
    timestamp: "2026-04-12T05:02:45+0000",
    media_type: "IMAGE",
    like_count: 19,
    comments_count: 1
  },
  {
    /* Sin like_count a proposito: una ausencia no es un cero. */
    id: "18066323309741557",
    caption: "Publicacion de prueba dos",
    permalink: "https://www.instagram.com/reel/DcORd82x4kA/",
    timestamp: "2026-03-22T13:16:51+0000",
    media_type: "VIDEO",
    comments_count: 4
  }
];

globalThis.fetch = async (url, opciones) => {
  const u = String(url);

  if (!u.includes("graph.facebook.com")) return fetchReal(url, opciones);

  /* La URL lleva el token: se registra SIN el. */
  llamadas.push(u.replace(/access_token=[^&]*/, "access_token=REDACTADO"));

  if (u.includes("/me/accounts")) {
    return json({
      data: [
        {
          id: "10000000000001",
          name: "Pagina Propia de Prueba",
          instagram_business_account: { id: ID_IG_PROPIO, username: IG_PROPIO }
        }
      ]
    });
  }

  const pedido = decodeURIComponent(u).match(
    /business_discovery\.username\(([^)]+)\)/
  );

  if (pedido) {
    return json({
      business_discovery: {
        username: pedido[1],
        name: `Nombre de ${pedido[1]}`,
        followers_count: 9718,
        media_count: 1635,
        media: { data: mediaFicticia }
      }
    });
  }

  return {
    ok: false,
    status: 400,
    text: async () => JSON.stringify({ error: { code: 100 } })
  };
};

const pedidosDe = (handle) =>
  llamadas.filter((u) => decodeURIComponent(u).includes(`username(${handle})`))
    .length;


/* ---------------------------------------------------------
   PROYECTO DE PRUEBA
--------------------------------------------------------- */
const PID = "proyecto-ruta-ig";

const HANDLE_TERCERO = "terceroprofesional";

const HANDLE_PERSONAL = "cuentapersonalx";

await ps.crearProyecto({
  id: PID,
  nombre: "Prueba de ruta Instagram",
  canton: "Cuenca",
  pais: "Ecuador",
  dignidad: "Alcaldia"
});

/*
  Un candidato con DOS activos de Instagram: uno profesional y
  uno personal. Es el caso que verifica multi-asset y el que
  distingue «no se pudo» de «no se pregunta».
*/
await ps.agregarCandidato(PID, {
  nombre: "Tercero Con Dos",
  cuentas: [
    `https://www.instagram.com/${HANDLE_TERCERO}/`,
    `https://www.instagram.com/${HANDLE_PERSONAL}/`
  ]
});

/* Un candidato cuyo Instagram administramos nosotros. */
await ps.agregarCandidato(PID, {
  nombre: "Propio Administrado",
  cuentas: [`https://www.instagram.com/${IG_PROPIO}/`]
});

const C_DOS = "tercero-con-dos";

const C_PROPIO = "propio-administrado";

const declarar = async (candidatoId, handle, tipo) => {
  const d = ca.crearDeclaracionDeTipo({
    candidateId: candidatoId,
    assetId: `instagram:${handle}`,
    platform: "instagram",
    url: `https://www.instagram.com/${handle}`,
    declaredType: tipo
  });

  if (!d.valido) throw new Error(`declaracion invalida: ${d.motivo}`);

  return ps.guardarDeclaracionesDeTipo(PID, candidatoId, [d.declaracion], {
    declaradoEn: new Date().toISOString()
  });
};

await declarar(C_DOS, HANDLE_TERCERO, "INSTAGRAM_PROFESSIONAL");

await declarar(C_DOS, HANDLE_PERSONAL, "INSTAGRAM_PERSONAL");

await declarar(C_PROPIO, IG_PROPIO, "INSTAGRAM_PROFESSIONAL");


/* ---------------------------------------------------------
   SERVIDOR REAL, PUERTO EFIMERO
--------------------------------------------------------- */
const app = express();

app.use(express.json());

app.use("/api/proyectos", rutas);

const servidor = await new Promise((resolve) => {
  const s = app.listen(0, "127.0.0.1", () => resolve(s));
});

const BASE = `http://127.0.0.1:${servidor.address().port}/api/proyectos`;

const observar = async (candidatoId, cuerpo = {}) => {
  const r = await fetchReal(
    `${BASE}/${PID}/candidatos/${candidatoId}/observar`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plataformas: ["instagram"], ...cuerpo })
    }
  );

  return { status: r.status, cuerpo: await r.json() };
};

const resultadoDe = (respuesta, handle) =>
  (respuesta.cuerpo.resultados || []).find(
    (x) => x.accountId === `instagram:${handle}`
  );


/* ---------------------------------------------------------
   1 · EL CONTEXTO SE RESUELVE EN EL BACKEND
--------------------------------------------------------- */
bloque("Contexto Meta resuelto backend-side");

await t("sin Instagram en la ejecucion no se pide me/accounts", async () => {
  llamadas = [];

  const c = await mc.contextoMetaDeObservacion({ plataformas: ["youtube"] });

  return (
    c.estado === mc.ESTADOS_CONTEXTO_META.NO_REQUERIDO &&
    c.llamadas === 0 &&
    llamadas.length === 0
  );
});

await t("con Instagram se resuelve el id y las cuentas propias", async () => {
  llamadas = [];

  const c = await mc.contextoMetaDeObservacion({ plataformas: ["instagram"] });

  return (
    c.estado === mc.ESTADOS_CONTEXTO_META.RESUELTO &&
    c.idParaBusinessDiscovery === ID_IG_PROPIO &&
    c.cuentasPropias.includes(IG_PROPIO) &&
    c.llamadas === 1
  );
});

await t("los handles propios se normalizan en minuscula y sin arroba", async () => {
  const c = await mc.contextoMetaDeObservacion({
    plataformas: ["instagram"],
    adapter: {
      paginasQueAdministramos: async () => ({
        estado: "OK",
        llamadas: 1,
        idParaBusinessDiscovery: "999",
        paginas: [{ instagramUsername: "@MiCuentaPROPIA" }],
        requisitoDelVinculo: "1 de 1"
      })
    }
  });

  return c.cuentasPropias[0] === "micuentapropia";
});

await t("sin vinculo de Instagram lo dice con su nombre, no con un error", async () => {
  const c = await mc.contextoMetaDeObservacion({
    plataformas: ["instagram"],
    adapter: {
      paginasQueAdministramos: async () => ({
        estado: "OK",
        llamadas: 1,
        idParaBusinessDiscovery: null,
        paginas: [{ instagramUsername: null }],
        requisitoDelVinculo:
          "ninguna Pagina administrada tiene Instagram profesional vinculado"
      })
    }
  });

  return (
    c.estado === mc.ESTADOS_CONTEXTO_META.SIN_VINCULO_INSTAGRAM &&
    c.idParaBusinessDiscovery === null
  );
});


/* ---------------------------------------------------------
   2 · LA RUTA HTTP LLEGA AL MOTOR
--------------------------------------------------------- */
bloque("HTTP -> observarCandidato -> observarInstagram");

llamadas = [];

const rTercero = await observar(C_DOS);

await t("la ruta responde 200", () => rTercero.status === 200);

await t("el contexto Meta viaja resuelto y sin credenciales", () => {
  const c = rTercero.cuerpo.contextoMeta;

  return (
    c.estado === "RESUELTO" &&
    c.resuelto === true &&
    c.cuentasPropiasDetectadas === 1 &&
    c.llamadas === 1 &&
    /* Ni el id ni los handles propios salen en la respuesta. */
    !("idParaBusinessDiscovery" in c) &&
    !("cuentasPropias" in c)
  );
});

await t("el activo profesional de un tercero queda MEDIDO_TERCERO", () => {
  const x = resultadoDe(rTercero, HANDLE_TERCERO);

  return (
    Boolean(x) &&
    x.estado === "OBSERVADA" &&
    x.alcanceDeLaMedicion === "MEDIDO_TERCERO" &&
    x.procedenciaDelEstado === "MEDIDA" &&
    x.publicaciones === 2
  );
});

await t("ya no devuelve NO_EJECUTABLE, que era el defecto", () => {
  const x = resultadoDe(rTercero, HANDLE_TERCERO);

  return x.estado !== "NO_EJECUTABLE";
});

await t("las publicaciones llegan al Lake por la ruta", async () => {
  const desde = await ps.publicacionesDe(PID, C_DOS);

  const ig = desde.publicaciones.filter((p) => p.platformId === "instagram");

  return ig.length === 2 && rTercero.cuerpo.persistido === true;
});

await t("el lote NO se etiqueta youtube_data cuando es de Instagram", async () => {
  const desde = await ps.publicacionesDe(PID, C_DOS);

  const ig = desde.publicaciones.filter((p) => p.platformId === "instagram");

  return ig.every((p) => p.provider === "instagram_graph");
});


/* ---------------------------------------------------------
   3 · PERSONAL: NI SE PREGUNTA NI SE DEGRADA A ERROR
--------------------------------------------------------- */
bloque("NO_SOPORTADO_PERSONAL se conserva por la ruta");

await t("el activo personal queda NO_SOPORTADO_PERSONAL", () => {
  const x = resultadoDe(rTercero, HANDLE_PERSONAL);

  return Boolean(x) && x.estado === "NO_SOPORTADO_PERSONAL";
});

await t("y NO se convierte en ERROR, NO_EJECUTABLE ni CREDENCIAL_RECHAZADA", () => {
  const x = resultadoDe(rTercero, HANDLE_PERSONAL);

  return ![
    "ERROR",
    "NO_EJECUTABLE",
    "CREDENCIAL_RECHAZADA",
    "CUENTA_NO_RESUELTA"
  ].includes(x.estado);
});

await t("su procedencia es DECLARADA, no MEDIDA", () => {
  const x = resultadoDe(rTercero, HANDLE_PERSONAL);

  return x.procedenciaDelEstado === "DECLARADA";
});

await t("no se gasto ninguna llamada contra la cuenta personal", () => {
  return pedidosDe(HANDLE_PERSONAL) === 0;
});

await t("el activo profesional si gasto exactamente una", () => {
  return pedidosDe(HANDLE_TERCERO) === 1;
});

await t("una sola llamada a me/accounts para los dos activos", () => {
  return llamadas.filter((u) => u.includes("/me/accounts")).length === 1;
});


/* ---------------------------------------------------------
   4 · MULTI-ASSET
--------------------------------------------------------- */
bloque("N activos por plataforma");

const igDeDos = () =>
  (rTercero.cuerpo.resultados || []).filter((x) => x.plataformaId === "instagram");

await t("los dos activos de Instagram aparecen, no se colapsan", () => {
  return igDeDos().length === 2;
});

await t("medir uno no cierra la plataforma del candidato", () => {
  const estados = igDeDos()
    .map((x) => x.estado)
    .sort();

  return (
    estados.length === 2 &&
    estados.includes("OBSERVADA") &&
    estados.includes("NO_SOPORTADO_PERSONAL")
  );
});

await t("cada activo conserva su propio accountId", () => {
  return new Set(igDeDos().map((x) => x.accountId)).size === 2;
});


/* ---------------------------------------------------------
   5 · PROPIO != TERCERO, TAMBIEN POR LA RUTA
--------------------------------------------------------- */
bloque("MEDIDO_PROPIO_AUTORIZADO por la ruta");

llamadas = [];

const rPropio = await observar(C_PROPIO);

await t("nuestra cuenta responde igual y NO se cuenta como tercero", () => {
  const x = resultadoDe(rPropio, IG_PROPIO);

  return (
    Boolean(x) &&
    x.estado === "OBSERVADA" &&
    x.alcanceDeLaMedicion === "MEDIDO_PROPIO_AUTORIZADO"
  );
});

await t("la respuesta explica por que no demuestra acceso a terceros", () => {
  const x = resultadoDe(rPropio, IG_PROPIO);

  return typeof x.notaAlcance === "string" && x.notaAlcance.length > 0;
});

await t("el alcance NO sale de la respuesta de Meta sino de me/accounts", () => {
  /*
    La carga simulada es identica para las dos cuentas. Si el
    alcance viniera de la respuesta, las dos saldrian iguales.
  */
  const propio = resultadoDe(rPropio, IG_PROPIO).alcanceDeLaMedicion;

  const tercero = resultadoDe(rTercero, HANDLE_TERCERO).alcanceDeLaMedicion;

  return propio !== tercero;
});


/* ---------------------------------------------------------
   6 · IDEMPOTENCIA POR LA RUTA
--------------------------------------------------------- */
bloque("Observar dos veces no duplica");

const antes = await ps.publicacionesDe(PID, C_DOS);

const primeraObservacion = antes.publicaciones
  .filter((p) => p.platformId === "instagram")
  .map((p) => ({ id: p.publicationId, first: p.firstObservedAt }));

const rRepetida = await observar(C_DOS);

const despues = await ps.publicacionesDe(PID, C_DOS);

const igDespues = despues.publicaciones.filter(
  (p) => p.platformId === "instagram"
);

await t("la segunda observacion responde 200", () => rRepetida.status === 200);

await t("las publicaciones no se duplican", () => igDespues.length === 2);

await t("publicationId estable entre ejecuciones", () => {
  const ahora = igDespues.map((p) => p.publicationId).sort();

  const inicial = primeraObservacion.map((p) => p.id).sort();

  return JSON.stringify(ahora) === JSON.stringify(inicial);
});

await t("evidenceId estable y unico por publicacion", () => {
  const ids = igDespues.map((p) => p.evidenceId);

  return ids.every(Boolean) && new Set(ids).size === ids.length;
});

await t("firstObservedAt NO se reescribe", () => {
  const porId = {};

  igDespues.forEach((p) => {
    porId[p.publicationId] = p.firstObservedAt;
  });

  return primeraObservacion.every((p) => porId[p.id] === p.first);
});

await t("el lote nuevo si se acumula: la serie es append-only", () => {
  return despues.lotes > antes.lotes;
});


/* ---------------------------------------------------------
   7 · NINGUNA CREDENCIAL EN LA RESPUESTA
--------------------------------------------------------- */
bloque("Ningun secreto sale por HTTP");

await t("ni el token ni el App Secret aparecen en la respuesta", () => {
  const texto = JSON.stringify([rTercero.cuerpo, rPropio.cuerpo]);

  return (
    !texto.includes("EAA-TOKEN-FICTICIO-NO-REAL-000") &&
    !texto.includes("SECRETO-FICTICIO-NO-REAL-000") &&
    !texto.includes(process.env.META_APP_ID) &&
    !/access_token=[^&"]*[A-Za-z0-9]{10}/.test(texto)
  );
});

await t("tampoco el id de nuestra cuenta de Instagram", () => {
  const texto = JSON.stringify([rTercero.cuerpo, rPropio.cuerpo]);

  return !texto.includes(ID_IG_PROPIO);
});


/* ---------------------------------------------------------
   RESULTADO
--------------------------------------------------------- */
/*
  Las conexiones keep-alive de express sobreviven a close() y
  libuv aborta el proceso al salir con un handle a medio cerrar.
  Se cierran antes de forma explicita.
*/
servidor.closeAllConnections?.();

await new Promise((resolve) => servidor.close(resolve));

globalThis.fetch = fetchReal;

console.log("\n===========================================");
console.log(`PASS: ${pass}    FALL: ${fail}`);

if (fallos.length) {
  console.log("\nFallos:");
  fallos.forEach((f) => console.log(`  - ${f}`));
}

console.log("===========================================\n");

/*
  Salida por codigo y NO por process.exit(): con el servidor
  recien cerrado, forzar la salida hacia libuv con un handle a
  medio cerrar aborta el proceso en Windows —«!(handle->flags &
  UV_HANDLE_CLOSING)»— y devolvia 127 con las 30 pruebas en
  verde, que en `npm test` se lee como suite fallida.
*/
process.exitCode = fail > 0 ? 1 : 0;
