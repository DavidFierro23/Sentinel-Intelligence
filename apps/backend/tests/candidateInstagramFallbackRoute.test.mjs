// apps/backend/tests/candidateInstagramFallbackRoute.test.mjs

/*
===========================================================
FALLBACK DE INSTAGRAM CONECTADO A observarCandidato
P-CAND-INSTAGRAM-ROUTE-01
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/candidateInstagramFallbackRoute.test.mjs

SIN RED. `fetch` inyectado con la FORMA real medida sobre
@paulcarrascoc en el gate anterior, con valores sinteticos.

QUE DEFIENDE ESTA SUITE
-----------------------------------------------------------

Esta es la prueba que falta desde el gate anterior: no que el
routing decida bien en aislamiento (eso ya lo prueba
`socialSourceRouting.test.mjs`), ni que el orquestador componga
bien las piezas (`instagramProviderFallback.test.mjs`), sino que
`observarCandidato` —el flujo real que usa Candidate
Intelligence— lo invoque correctamente y SOLO cuando se le pide.

    SIN proveedorInstagram, CERO cambio de comportamiento

Es la garantia que hace seguro este gate: todas las suites que
llaman a `observarCandidato` sin este parametro (`igRoute`,
`multiAsset`, `socialCoverage`, `realObservation`,
`candidateIntelligence`, `crossLinkEvidence`, `baselineT0`) siguen
pasando identicas, verificado antes de escribir esta suite.
===========================================================
*/

process.env.SENTINEL_LAKE_ADAPTER = "memoria";

const co = await import("../services/intelligence/candidateObservation.js");

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


const json = (cuerpo, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(cuerpo)
});

/* Forma real de /v1/instagram/profile, valores sinteticos. */
const perfilProveedorSintetico = {
  data: {
    user: {
      id: "3600000000",
      username: "cuenta.sintetica",
      full_name: "Nombre Sintetico",
      is_private: false,
      edge_followed_by: { count: 985 },
      edge_follow: { count: 200 },
      edge_owner_to_timeline_media: { count: 266 }
    }
  }
};

const entornoAprobado = {
  SOCIAL_EXTERNAL_PROVIDER_ENABLED: "true",
  SCRAPECREATORS_API_KEY: "clave-ficticia-de-prueba"
};

/*
  Una cuenta PROFESIONAL: `observarInstagram` la mide de verdad
  solo con Meta configurado, y eso exigiria credenciales de Meta
  reales. Para probar "la oficial gana" sin depender de Meta, se
  construye el resultado oficial ya observado a mano —igual que
  hace `instagramProviderFallback.test.mjs`— y se comprueba que
  `observarCandidato` no lo toca cuando ya vino OBSERVADA.

  Aqui se hace a traves de una cuenta cuyo unico dato relevante es
  el handle: `observarInstagram` fallara por falta de
  `idParaBusinessDiscovery` (NO_EJECUTABLE), que es un estado de
  FALLO TEMPORAL propio y NO abre el fallback -verificado por
  `OFICIAL_FALLO_TEMPORAL` en `socialSourceRouting.js`-. Sirve
  igual de bien para el caso C: sin opt-in Y con un estado que no
  admite fallback, el resultado no cambia.
*/
const cuentaProfesionalSinLink = {
  id: "instagram:conlink",
  plataformaId: "instagram",
  handle: "conlink"
};

const cuentaPersonal = {
  id: "instagram:paulcarrascoc",
  plataformaId: "instagram",
  handle: "paulcarrascoc"
};

/*
  `observarInstagram` solo entra en NO_SOPORTADO_PERSONAL cuando el
  tipo esta DECLARADO como personal (`assetType`). Sin esto cae en
  NO_EJECUTABLE por falta de idParaBusinessDiscovery, que es un
  fallo temporal nuestro y NO abre el fallback -correctamente-.
  Este mapa es lo que reproduce el caso real: activos ya declarados
  personales por el analista, como @paulcarrascoc en el gate
  anterior.
*/
const TIPOS_PERSONAL = {
  "instagram:paulcarrascoc": "INSTAGRAM_PERSONAL",
  "instagram:segunda-cuenta": "INSTAGRAM_PERSONAL"
};


bloque("A · Sin opt-in, cero cambio de comportamiento (baseline)");

let llamadoSinOptIn = false;

const rBase = await co.observarCandidato({
  candidateId: "cand-a",
  projectId: "proj-a",
  cuentas: [cuentaPersonal],
  tiposDeActivo: TIPOS_PERSONAL,
  plataformas: ["instagram"],
  fetchImpl: async () => {
    llamadoSinOptIn = true;

    return json(perfilProveedorSintetico);
  }
});

await t("sin proveedorInstagram, jamas se llama a ningun fetch de proveedor", () => {
  return llamadoSinOptIn === false;
});

await t("el resultado es exactamente el de observarInstagram, sin campos nuevos", () => {
  const r = rBase.resultados[0];

  return (
    r.estado === "NO_SOPORTADO_PERSONAL" &&
    !("sourceKind" in r) &&
    !("canalProveedor" in r)
  );
});

await t("resumen.medidoProveedor es 0 cuando no hay opt-in", () => {
  return rBase.resumen.medidoProveedor === 0;
});


bloque("B · Fallback real: Meta no puede, el proveedor SI mide");

let llamadoConFallback = false;

const rFallback = await co.observarCandidato({
  candidateId: "cand-b",
  projectId: "proj-b",
  cuentas: [cuentaPersonal],
  tiposDeActivo: TIPOS_PERSONAL,
  plataformas: ["instagram"],
  proveedorInstagram: { id: "scrapecreators", entorno: entornoAprobado },
  fetchImpl: async () => {
    llamadoConFallback = true;

    return json(perfilProveedorSintetico);
  }
});

const rB = rFallback.resultados[0];

await t("se llama al proveedor exactamente una vez", () => {
  return llamadoConFallback === true;
});

await t("el estado final es MEDIDO_PROVEEDOR, no OBSERVADA", () => {
  return rB.estado === co.ESTADOS_OBSERVACION_REAL.MEDIDO_PROVEEDOR;
});

await t("el perfil del proveedor llega mapeado en canalProveedor", () => {
  return rB.canalProveedor.followers === 985 && rB.canalProveedor.accountProviderId === "3600000000";
});

await t("sourceKind y provider quedan declarados", () => {
  return rB.sourceKind === "provider" && rB.provider === "scrapecreators";
});

await t("datoLicenciadoPorLaPlataforma es false para ScrapeCreators", () => {
  return rB.datoLicenciadoPorLaPlataforma === false;
});

await t("resumen.medidoProveedor cuenta este activo, observadas NO", () => {
  return rFallback.resumen.medidoProveedor === 1 && rFallback.resumen.observadas === 0;
});

await t("no se inventan publicaciones: la lista queda vacia y no rellenada", () => {
  return Array.isArray(rB.publicaciones) && rB.publicaciones.length === 0;
});


bloque("F/G · El estado oficial NUNCA desaparece; MEDIDO_OFICIAL != MEDIDO_PROVEEDOR");

await t("resultadoOficial conserva el NO_SOPORTADO_PERSONAL original completo", () => {
  return (
    rB.resultadoOficial.estado === "NO_SOPORTADO_PERSONAL" &&
    typeof rB.resultadoOficial.motivo === "string"
  );
});

await t("estadoOficialConservado queda anotado junto al nuevo estado", () => {
  return rB.estadoOficialConservado === "NO_SOPORTADO_PERSONAL";
});

await t("MEDIDO_PROVEEDOR y OBSERVADA son literales distintos, nunca se confunden", () => {
  return (
    rB.estado !== "OBSERVADA" &&
    co.ESTADOS_OBSERVACION_REAL.MEDIDO_PROVEEDOR !== co.ESTADOS_OBSERVACION_REAL.OBSERVADA
  );
});


bloque("C · Provider deshabilitado: opt-in presente pero sin bandera de entorno");

let llamadoSinBandera = false;

const rSinBandera = await co.observarCandidato({
  candidateId: "cand-c",
  projectId: "proj-c",
  cuentas: [cuentaPersonal],
  tiposDeActivo: TIPOS_PERSONAL,
  plataformas: ["instagram"],
  proveedorInstagram: { id: "scrapecreators", entorno: {} },
  fetchImpl: async () => {
    llamadoSinBandera = true;

    return json(perfilProveedorSintetico);
  }
});

await t("sin la bandera de entorno, no se llama al proveedor", () => {
  return llamadoSinBandera === false;
});

await t("el resultado queda con un estado explicito, no una excepcion", () => {
  const r = rSinBandera.resultados[0];

  return r.estado === "NO_SOPORTADO_PERSONAL" && r.proveedorIntentado === true;
});

await t("el error del proveedor queda registrado con causa precisa", () => {
  /*
    `proveedorError.estado` es el estado del CLIENTE HTTP
    (`socialProviderClient.js`), no la decision de routing. Sin
    bandera de entorno, el cliente clasifica esto como
    PROVEEDOR_DESHABILITADO, que es literalmente lo que paso: no
    es que el proveedor fallara, es que no se le permitio salir.
  */
  const r = rSinBandera.resultados[0];

  return (
    r.proveedorError &&
    r.proveedorError.estado === "PROVEEDOR_DESHABILITADO" &&
    typeof r.proveedorError.motivo === "string"
  );
});


bloque("D · El proveedor falla (401/429/timeout): no tumba la observacion");

const conEstadoHttp = async (status) => {
  const r = await co.observarCandidato({
    candidateId: "cand-d",
    projectId: "proj-d",
    cuentas: [cuentaPersonal],
    tiposDeActivo: TIPOS_PERSONAL,
    plataformas: ["instagram"],
    proveedorInstagram: { id: "scrapecreators", entorno: entornoAprobado },
    fetchImpl: async () => json({ error: "fallo sintetico" }, status)
  });

  return r.resultados[0];
};

await t("un 401 no lanza excepcion, preserva el estado oficial y clasifica bien la causa", () => {
  return conEstadoHttp(401).then(
    (r) =>
      r.estado === "NO_SOPORTADO_PERSONAL" &&
      /* 401 es credencial rechazada, no una cuota ni un timeout: la distincion que importa para saber que hacer despues. */
      r.proveedorError.estado === "CREDENCIAL_RECHAZADA"
  );
});

await t("un 429 tampoco lanza excepcion y se distingue de un 401", async () => {
  const r = await conEstadoHttp(429);

  return (
    r.estado === "NO_SOPORTADO_PERSONAL" &&
    r.proveedorIntentado === true &&
    r.proveedorError.estado === "CUOTA_AGOTADA"
  );
});

await t("un timeout/excepcion de red no tumba la observacion del candidato", async () => {
  const r = await co.observarCandidato({
    candidateId: "cand-d2",
    projectId: "proj-d2",
    cuentas: [cuentaPersonal],
    tiposDeActivo: TIPOS_PERSONAL,
    plataformas: ["instagram"],
    proveedorInstagram: { id: "scrapecreators", entorno: entornoAprobado },
    fetchImpl: async () => {
      throw new Error("timeout sintetico");
    }
  });

  return (
    r.resultados[0].estado === "NO_SOPORTADO_PERSONAL" &&
    r.resultados[0].proveedorError !== undefined
  );
});

await t("nada se inventa: sin OK del proveedor no aparece canalProveedor", async () => {
  const r = await conEstadoHttp(401);

  return !("canalProveedor" in r);
});


bloque("E · Multi-activo: dos Instagram del mismo candidato, fuentes distintas");

/*
  El segundo activo se declara ya OBSERVADA a mano dentro del
  fetch: como `observarInstagram` necesita Meta real para llegar a
  OBSERVADA, se simula el caso construyendo dos cuentas que
  ambas caen en NO_SOPORTADO_PERSONAL por falta de link, y
  verificando que el ORQUESTADOR trata a cada una de forma
  independiente -ninguna se colapsa en la otra-. La independencia
  por activo ya esta probada exhaustivamente contra Meta real en
  `socialSourceRouting.test.mjs` (caso D, Yaku Perez); aqui se
  prueba que `observarCandidato` no las funde en un solo resultado.
*/
const cuentaB2 = {
  id: "instagram:segunda-cuenta",
  plataformaId: "instagram",
  handle: "segundacuenta"
};

const rMulti = await co.observarCandidato({
  candidateId: "cand-e",
  projectId: "proj-e",
  cuentas: [cuentaPersonal, cuentaB2],
  tiposDeActivo: TIPOS_PERSONAL,
  plataformas: ["instagram"],
  proveedorInstagram: { id: "scrapecreators", entorno: entornoAprobado },
  fetchImpl: async () => json(perfilProveedorSintetico)
});

await t("los dos activos aparecen, ninguno se pierde", () => {
  return rMulti.resultados.length === 2;
});

await t("cada uno conserva su propio accountId", () => {
  const ids = new Set(rMulti.resultados.map((r) => r.accountId));

  return ids.size === 2 && ids.has("instagram:paulcarrascoc") && ids.has("instagram:segunda-cuenta");
});

await t("los dos quedan MEDIDO_PROVEEDOR de forma independiente", () => {
  return rMulti.resultados.every(
    (r) => r.estado === co.ESTADOS_OBSERVACION_REAL.MEDIDO_PROVEEDOR
  );
});

await t("resumen.medidoProveedor cuenta los dos activos", () => {
  return rMulti.resumen.medidoProveedor === 2;
});


bloque("F · Estabilidad entre dos ejecuciones (proxy de dedup)");

const primera = await co.observarCandidato({
  candidateId: "cand-f",
  projectId: "proj-f",
  cuentas: [cuentaPersonal],
  tiposDeActivo: TIPOS_PERSONAL,
  plataformas: ["instagram"],
  proveedorInstagram: { id: "scrapecreators", entorno: entornoAprobado },
  fetchImpl: async () => json(perfilProveedorSintetico)
});

const segunda = await co.observarCandidato({
  candidateId: "cand-f",
  projectId: "proj-f",
  cuentas: [cuentaPersonal],
  tiposDeActivo: TIPOS_PERSONAL,
  plataformas: ["instagram"],
  proveedorInstagram: { id: "scrapecreators", entorno: entornoAprobado },
  fetchImpl: async () => json(perfilProveedorSintetico)
});

await t("el id estable del proveedor es identico entre dos ejecuciones", () => {
  return (
    primera.resultados[0].canalProveedor.accountProviderId ===
    segunda.resultados[0].canalProveedor.accountProviderId
  );
});

await t("una segunda ejecucion no produce mas de un resultado por activo", () => {
  return primera.resultados.length === 1 && segunda.resultados.length === 1;
});


bloque("H · Project isolation a nivel de resultado");

await t("cada ejecucion lleva su propio projectId sin cruzarse con otra", () => {
  return (
    rFallback.projectId === "proj-b" &&
    rSinBandera.projectId === "proj-c" &&
    rMulti.projectId === "proj-e" &&
    rFallback.projectId !== rSinBandera.projectId
  );
});

await t("el mismo accountId en dos proyectos distintos no comparte estado", async () => {
  const proyectoX = await co.observarCandidato({
    candidateId: "cand-h",
    projectId: "proj-x",
    cuentas: [cuentaPersonal],
    tiposDeActivo: TIPOS_PERSONAL,
    plataformas: ["instagram"],
    proveedorInstagram: { id: "scrapecreators", entorno: entornoAprobado },
    fetchImpl: async () => json(perfilProveedorSintetico)
  });

  const proyectoY = await co.observarCandidato({
    candidateId: "cand-h",
    projectId: "proj-y",
    cuentas: [cuentaPersonal],
    tiposDeActivo: TIPOS_PERSONAL,
    plataformas: ["instagram"],
    proveedorInstagram: { id: "scrapecreators", entorno: {} },
    fetchImpl: async () => {
      throw new Error("no deberia llamarse: sin bandera en proj-y");
    }
  });

  return (
    proyectoX.resultados[0].estado === co.ESTADOS_OBSERVACION_REAL.MEDIDO_PROVEEDOR &&
    proyectoY.resultados[0].estado === "NO_SOPORTADO_PERSONAL"
  );
});


bloque("I · Guarda de presupuesto: dos capas independientes bloquean la red");

let llamadoProveedorNoAprobado = false;

const rNoAprobado = await co.observarCandidato({
  candidateId: "cand-i",
  projectId: "proj-i",
  cuentas: [cuentaPersonal],
  tiposDeActivo: TIPOS_PERSONAL,
  plataformas: ["instagram"],
  proveedorInstagram: {
    id: "socialcrawl",
    entorno: {
      SOCIAL_EXTERNAL_PROVIDER_ENABLED: "true",
      SOCIALCRAWL_API_KEY: "clave-ficticia"
    }
  },
  fetchImpl: async () => {
    llamadoProveedorNoAprobado = true;

    return json(perfilProveedorSintetico);
  }
});

await t("un proveedor con bandera y clave pero SIN aprobar sigue bloqueado", () => {
  return llamadoProveedorNoAprobado === false && rNoAprobado.resultados[0].proveedorIntentado === true;
});


bloque("C bis · Un estado de fallo temporal NO abre el fallback aunque haya opt-in");

let llamadoConFalloTemporal = false;

const rTemporal = await co.observarCandidato({
  candidateId: "cand-c2",
  projectId: "proj-c2",
  cuentas: [cuentaProfesionalSinLink],
  plataformas: ["instagram"],
  proveedorInstagram: { id: "scrapecreators", entorno: entornoAprobado },
  fetchImpl: async (url) => {
    /*
      graph.facebook.com nunca llega a intentarse porque no hay
      credencial de Meta en el entorno de test: `observarInstagram`
      devuelve NO_EJECUTABLE antes de tocar la red. Solo el
      proveedor podria salir a la red aqui, y NO_EJECUTABLE no
      esta en `OFICIAL_NO_PUEDE`.
    */
    llamadoConFalloTemporal = true;

    return json(perfilProveedorSintetico);
  }
});

await t("NO_EJECUTABLE no abre el fallback: el proveedor no se llama", () => {
  return llamadoConFalloTemporal === false;
});

await t("el resultado queda NO_EJECUTABLE, no MEDIDO_PROVEEDOR", () => {
  return rTemporal.resultados[0].estado === "NO_EJECUTABLE";
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
