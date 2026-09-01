// apps/backend/tests/instagramHttpFallback.test.mjs

/*
===========================================================
FALLBACK DE INSTAGRAM POR LA RUTA HTTP REAL
P-CAND-INSTAGRAM-HTTP-01
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/instagramHttpFallback.test.mjs

SIN RED. El router se monta de verdad y se le habla por HTTP; se
interceptan DOS hosts —`graph.facebook.com` y
`api.scrapecreators.com`— y se deja pasar todo lo demas, incluidas
las peticiones al propio servidor de prueba.

QUE DEFIENDE ESTA SUITE
-----------------------------------------------------------

`P-CAND-INSTAGRAM-ROUTE-01` conecto el fallback a
`observarCandidato`, pero nadie en `routes/projects.js` le pasaba
el opt-in: por la ruta HTTP real, Instagram seguia viendose solo
por Meta. Esta suite prueba el ULTIMO tramo del cable: que un
POST real a `/observar` con `proveedorInstagram: true` en el
cuerpo llegue de verdad al proveedor cuando corresponde, y que sin
ese campo el comportamiento sea IDENTICO al de siempre —verificado
tambien corriendo `igRoute.test.mjs` sin cambios antes de escribir
esta suite: 30/30, igual que siempre—.

    OPT-IN EN DOS CAPAS

El cliente pide el fallback en el cuerpo de la peticion (capa 1).
El servidor solo lo concede si su propio entorno lo permite —
`SOCIAL_EXTERNAL_PROVIDER_ENABLED`, proveedor aprobado, credencial
presente— (capa 2, ya probada en gates anteriores y NO duplicada
aqui). Ninguna capa basta sola.
===========================================================
*/

process.env.SENTINEL_LAKE_ADAPTER = "memoria";

process.env.FACEBOOK_USER_ACCESS_TOKEN = "EAA-TOKEN-FICTICIO-NO-REAL-000";

process.env.INSTAGRAM_ACCESS_TOKEN = "IGQ-TOKEN-FICTICIO-NO-REAL-000";

process.env.META_APP_ID = "000000000000000";

process.env.META_APP_SECRET = "SECRETO-FICTICIO-NO-REAL-000";

/*
  Apagado al arrancar el archivo. Cada bloque que necesite el
  proveedor "permitido por el entorno" lo enciende justo antes y
  lo apaga justo despues, para que el resto de la suite seguira
  demostrando la guarda con la bandera apagada.
*/
process.env.SOCIAL_EXTERNAL_PROVIDER_ENABLED = "";

delete process.env.SCRAPECREATORS_API_KEY;

import express from "express";

const ps = await import("../services/projects/projectStore.js");

const ca = await import("../services/intelligence/candidateAssets.js");

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
   META Y SCRAPECREATORS SIMULADOS

   Se conserva el fetch real: el test tiene que poder hablar con
   su propio servidor y con nada mas.
--------------------------------------------------------- */
const fetchReal = globalThis.fetch;

let llamadasMeta = [];

let llamadasProveedor = [];

/*
  Controla que responde `api.scrapecreators.com` en cada momento.
  Por defecto, exito. Los tests de fallo la cambian y la
  devuelven a "ok" al terminar, para no filtrar estado entre
  bloques.
*/
let modoProveedor = "ok";

const json = (cuerpo, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(cuerpo)
});

const perfilProveedorSintetico = (handle) => ({
  data: {
    user: {
      id: "3600000000",
      username: handle,
      full_name: "Nombre Sintetico",
      is_private: false,
      edge_followed_by: { count: 985 },
      edge_follow: { count: 200 },
      edge_owner_to_timeline_media: { count: 266 }
    }
  }
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
  }
];

const IG_PROPIO = "cuentapropiaig";

const ID_IG_PROPIO = "17841400000000000";

globalThis.fetch = async (url, opciones) => {
  const u = String(url);

  if (u.includes("api.scrapecreators.com")) {
    llamadasProveedor.push(u);

    const handle = new URL(u).searchParams.get("handle") || "desconocido";

    if (modoProveedor === "ok") return json(perfilProveedorSintetico(handle));

    if (modoProveedor === "401") return json({ error: "no autorizado" }, 401);

    if (modoProveedor === "429") return json({ error: "cuota agotada" }, 429);

    if (modoProveedor === "timeout") {
      throw new Error("timeout sintetico de proveedor");
    }

    return json({ error: "modo desconocido" }, 500);
  }

  if (!u.includes("graph.facebook.com")) return fetchReal(url, opciones);

  llamadasMeta.push(u.replace(/access_token=[^&]*/, "access_token=REDACTADO"));

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

  return json({ error: { code: 100 } }, 400);
};


/* ---------------------------------------------------------
   PROYECTO DE PRUEBA — mismo patron que igRoute.test.mjs
--------------------------------------------------------- */
const PID = "proyecto-ig-http-fallback";

const HANDLE_TERCERO = "terceroprofesionalhttp";

const HANDLE_PERSONAL = "cuentapersonalhttp";

await ps.crearProyecto({
  id: PID,
  nombre: "Prueba HTTP fallback Instagram",
  canton: "Cuenca",
  pais: "Ecuador",
  dignidad: "Alcaldia"
});

await ps.agregarCandidato(PID, {
  nombre: "Con Dos Activos HTTP",
  cuentas: [
    `https://www.instagram.com/${HANDLE_TERCERO}/`,
    `https://www.instagram.com/${HANDLE_PERSONAL}/`
  ]
});

const C_DOS = "con-dos-activos-http";

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
  const r = await fetchReal(`${BASE}/${PID}/candidatos/${candidatoId}/observar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plataformas: ["instagram"], ...cuerpo })
  });

  return { status: r.status, cuerpo: await r.json() };
};

const leerFicha = async (candidatoId) => {
  const r = await fetchReal(`${BASE}/${PID}/candidatos/${candidatoId}/identidad`);

  return { status: r.status, cuerpo: await r.json() };
};

const resultadoDe = (respuesta, handle) =>
  (respuesta.cuerpo.resultados || []).find((x) => x.accountId === `instagram:${handle}`);

const permitirProveedor = () => {
  process.env.SOCIAL_EXTERNAL_PROVIDER_ENABLED = "true";
  process.env.SCRAPECREATORS_API_KEY = "clave-ficticia-de-prueba";
};

const prohibirProveedor = () => {
  process.env.SOCIAL_EXTERNAL_PROVIDER_ENABLED = "";
  delete process.env.SCRAPECREATORS_API_KEY;
};


/* ---------------------------------------------------------
   A · PROFESIONAL: META GANA, EL PROVEEDOR NO SE LLAMA
--------------------------------------------------------- */
bloque("A · Instagram profesional: Meta mide, provider NO se llama");

llamadasProveedor = [];

permitirProveedor();

const rA = await observar(C_DOS, { proveedorInstagram: true });

prohibirProveedor();

const profA = resultadoDe(rA, HANDLE_TERCERO);

await t("Meta responde OBSERVADA para el activo profesional", () => {
  return profA.estado === "OBSERVADA";
});

await t("el provider NO se llama para un activo que Meta ya mide", () => {
  return llamadasProveedor.filter((u) => u.includes(HANDLE_TERCERO)).length === 0;
});

await t("la respuesta no lleva sourceKind de proveedor para este activo", () => {
  return profA.sourceKind === null && profA.canalProveedor === null;
});


/* ---------------------------------------------------------
   B · PERSONAL: META NO MIDE, EL PROVIDER SI, HABILITADO
--------------------------------------------------------- */
bloque("B · Instagram personal con provider habilitado: fallback real");

llamadasProveedor = [];

permitirProveedor();

const rB = await observar(C_DOS, { proveedorInstagram: true });

prohibirProveedor();

const persB = resultadoDe(rB, HANDLE_PERSONAL);

await t("el provider SI se llama para el activo personal", () => {
  return llamadasProveedor.filter((u) => u.includes(HANDLE_PERSONAL)).length === 1;
});

await t("el estado final es MEDIDO_PROVEEDOR", () => {
  return persB.estado === "MEDIDO_PROVEEDOR";
});

await t("canalProveedor llega con el perfil mapeado", () => {
  return persB.canalProveedor.followers === 985;
});

await t("sourceKind y provider quedan declarados en la respuesta HTTP", () => {
  return persB.sourceKind === "provider" && persB.provider === "scrapecreators";
});

await t("estadoOficialConservado recuerda por que Meta no alcanzaba el activo", () => {
  return persB.estadoOficialConservado === "NO_SOPORTADO_PERSONAL";
});

await t("ningun secreto sale en la respuesta HTTP", () => {
  const texto = JSON.stringify(rB.cuerpo);

  return (
    !texto.includes("clave-ficticia-de-prueba") &&
    !texto.includes("SECRETO-FICTICIO-NO-REAL-000") &&
    !/access_token=[^&"]*[A-Za-z0-9]{10}/.test(texto)
  );
});


/* ---------------------------------------------------------
   C · PROVIDER DESHABILITADO: SIN OPT-IN DEL CLIENTE
--------------------------------------------------------- */
bloque("C · Sin proveedorInstagram en el cuerpo: cero cambio");

llamadasProveedor = [];

permitirProveedor(); // el ENTORNO si lo permitiria...

const rC1 = await observar(C_DOS, {}); // ...pero el cliente no lo pide

prohibirProveedor();

const persC1 = resultadoDe(rC1, HANDLE_PERSONAL);

await t("sin proveedorInstagram:true, el provider no se llama aunque el entorno lo permita", () => {
  return llamadasProveedor.length === 0;
});

await t("el resultado es el de siempre: NO_SOPORTADO_PERSONAL sin campos nuevos", () => {
  return persC1.estado === "NO_SOPORTADO_PERSONAL" && persC1.sourceKind === null;
});


/* ---------------------------------------------------------
   C bis · PROVIDER DESHABILITADO: EL CLIENTE LO PIDE, EL ENTORNO NO LO PERMITE
--------------------------------------------------------- */
bloque("C bis · El cliente pide el provider, pero el entorno lo bloquea");

llamadasProveedor = [];

/* prohibirProveedor() ya es el estado por defecto aqui */
const rC2 = await observar(C_DOS, { proveedorInstagram: true });

const persC2 = resultadoDe(rC2, HANDLE_PERSONAL);

await t("con la bandera de entorno apagada, el provider no se llama aunque el cliente lo pida", () => {
  return llamadasProveedor.length === 0;
});

await t("el estado queda explicito, con la causa exacta, nunca una excepcion HTTP 500", () => {
  return (
    rC2.status === 200 &&
    persC2.estado === "NO_SOPORTADO_PERSONAL" &&
    persC2.proveedorIntentado === true &&
    persC2.proveedorError?.estado === "PROVEEDOR_DESHABILITADO"
  );
});


/* ---------------------------------------------------------
   D · PROVIDER RESPONDE 401
--------------------------------------------------------- */
bloque("D · El proveedor responde 401: la ruta no cae");

llamadasProveedor = [];

modoProveedor = "401";

permitirProveedor();

const rD = await observar(C_DOS, { proveedorInstagram: true });

prohibirProveedor();

modoProveedor = "ok";

const persD = resultadoDe(rD, HANDLE_PERSONAL);

await t("un 401 del proveedor responde HTTP 200, no un 500", () => {
  return rD.status === 200;
});

await t("el error queda clasificado como credencial rechazada, no generico", () => {
  return persD.proveedorError?.estado === "CREDENCIAL_RECHAZADA";
});

await t("el estado oficial se conserva y no se inventa dato", () => {
  return persD.estado === "NO_SOPORTADO_PERSONAL" && persD.canalProveedor === null;
});


/* ---------------------------------------------------------
   E · PROVIDER RESPONDE 429
--------------------------------------------------------- */
bloque("E · El proveedor responde 429: cuota distinguida de credencial");

llamadasProveedor = [];

modoProveedor = "429";

permitirProveedor();

const rE = await observar(C_DOS, { proveedorInstagram: true });

prohibirProveedor();

modoProveedor = "ok";

const persE = resultadoDe(rE, HANDLE_PERSONAL);

await t("un 429 tambien responde HTTP 200", () => {
  return rE.status === 200;
});

await t("la causa es CUOTA_AGOTADA, distinta de CREDENCIAL_RECHAZADA", () => {
  return persE.proveedorError?.estado === "CUOTA_AGOTADA";
});


/* ---------------------------------------------------------
   F · TIMEOUT / EXCEPCION DE RED DEL PROVEEDOR
--------------------------------------------------------- */
bloque("F · Timeout del proveedor: error temporal, nada inventado");

llamadasProveedor = [];

modoProveedor = "timeout";

permitirProveedor();

const rF = await observar(C_DOS, { proveedorInstagram: true });

prohibirProveedor();

modoProveedor = "ok";

const persF = resultadoDe(rF, HANDLE_PERSONAL);

await t("un timeout del proveedor tampoco tumba la ruta", () => {
  return rF.status === 200;
});

await t("el candidato sigue observandose completo: el activo profesional no se pierde", () => {
  const prof = resultadoDe(rF, HANDLE_TERCERO);

  return prof && prof.estado === "OBSERVADA";
});

await t("followers no aparece en 0 por el timeout: queda sin canalProveedor", () => {
  return persF.canalProveedor === null && persF.estado === "NO_SOPORTADO_PERSONAL";
});


/* ---------------------------------------------------------
   G · MULTI-ACTIVO: UNO OFICIAL, UNO PROVIDER, EN LA MISMA RESPUESTA
--------------------------------------------------------- */
bloque("G · Multi-activo en una sola respuesta HTTP");

llamadasProveedor = [];

permitirProveedor();

const rG = await observar(C_DOS, { proveedorInstagram: true });

prohibirProveedor();

await t("los dos activos del candidato aparecen en la misma respuesta", () => {
  return (
    resultadoDe(rG, HANDLE_TERCERO) !== undefined &&
    resultadoDe(rG, HANDLE_PERSONAL) !== undefined
  );
});

await t("uno queda OBSERVADA (oficial) y el otro MEDIDO_PROVEEDOR, sin colapsar", () => {
  return (
    resultadoDe(rG, HANDLE_TERCERO).estado === "OBSERVADA" &&
    resultadoDe(rG, HANDLE_PERSONAL).estado === "MEDIDO_PROVEEDOR"
  );
});

await t("resumen distingue observadas de medidoProveedor", () => {
  return rG.cuerpo.resumen.observadas === 1 && rG.cuerpo.resumen.medidoProveedor === 1;
});


/* ---------------------------------------------------------
   H · PROJECT ISOLATION
--------------------------------------------------------- */
bloque("H · Un segundo proyecto con el mismo handle no comparte estado");

const PID2 = "proyecto-ig-http-fallback-otro";

await ps.crearProyecto({
  id: PID2,
  nombre: "Segundo proyecto",
  canton: "Cuenca",
  pais: "Ecuador",
  dignidad: "Alcaldia"
});

await ps.agregarCandidato(PID2, {
  nombre: "Con Dos Activos HTTP",
  cuentas: [`https://www.instagram.com/${HANDLE_PERSONAL}/`]
});

/* NO se declara personal en este segundo proyecto: queda UNKNOWN. */

const observarEnProyecto = async (proyectoId, candidatoId, cuerpo = {}) => {
  const r = await fetchReal(
    `${BASE}/${proyectoId}/candidatos/${candidatoId}/observar`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plataformas: ["instagram"], ...cuerpo })
    }
  );

  return { status: r.status, cuerpo: await r.json() };
};

llamadasProveedor = [];

permitirProveedor();

const rH2 = await observarEnProyecto(PID2, C_DOS, { proveedorInstagram: true });

prohibirProveedor();

const persH2 = resultadoDe(rH2, HANDLE_PERSONAL);

await t("el mismo handle sin declarar en otro proyecto NO llega a MEDIDO_PROVEEDOR", () => {
  /*
    Sin la declaracion INSTAGRAM_PERSONAL en este proyecto,
    observarInstagram cae en NO_EJECUTABLE (falta de link), que
    es un fallo temporal y no abre el fallback. Demuestra que la
    declaracion de un proyecto no se filtra al otro.
  */
  return persH2.estado !== "MEDIDO_PROVEEDOR";
});

await t("el proyecto original conserva su propio estado para el mismo handle", () => {
  return resultadoDe(rB, HANDLE_PERSONAL).estado === "MEDIDO_PROVEEDOR";
});


/* ---------------------------------------------------------
   I · UNA LECTURA (GET) NUNCA DISPARA EL PROVEEDOR
--------------------------------------------------------- */
bloque("I · GET de ficha no consume ningun credito de proveedor");

llamadasProveedor = [];

permitirProveedor();

const rFicha = await leerFicha(C_DOS);

prohibirProveedor();

await t("GET /identidad responde", () => {
  return rFicha.status === 200;
});

await t("leer la ficha no llama al proveedor ni una vez, aunque el entorno lo permita", () => {
  return llamadasProveedor.length === 0;
});


/* ---------------------------------------------------------
   J · BUDGET GUARD: EXACTAMENTE UNA LLAMADA POR ACTIVO ELEGIBLE
--------------------------------------------------------- */
bloque("J · Contador exacto de llamadas: sin sorpresas");

llamadasProveedor = [];

llamadasMeta = [];

permitirProveedor();

const rJ = await observar(C_DOS, { proveedorInstagram: true });

prohibirProveedor();

await t("exactamente 1 llamada al proveedor por el unico activo elegible", () => {
  return llamadasProveedor.length === 1;
});

await t("el activo profesional no genera ninguna llamada al proveedor", () => {
  return llamadasProveedor.every((u) => !u.includes(HANDLE_TERCERO));
});

await t("una repeticion de la misma peticion no duplica llamadas fuera de lo esperado", async () => {
  llamadasProveedor = [];

  permitirProveedor();

  await observar(C_DOS, { proveedorInstagram: true });

  prohibirProveedor();

  return llamadasProveedor.length === 1;
});


/* ---------------------------------------------------------
   RESULTADO
--------------------------------------------------------- */
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

process.exitCode = fail > 0 ? 1 : 0;
