// apps/backend/tests/socialSourceRouting.test.mjs

/*
===========================================================
QUE FUENTE MIDE CADA ACTIVO
P-CAND-INSTAGRAM-FALLBACK-01
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/socialSourceRouting.test.mjs

SIN RED. Pura logica de decision: no llama a ningun adapter ni
proveedor. Los casos reproducen exactamente los cuatro activos
de Instagram medidos en este gate.

LO QUE DEFIENDE
-----------------------------------------------------------

    LA OFICIAL GANA SIEMPRE QUE PUEDA MEDIR

Un activo profesional medido por Meta no debe caer al proveedor
aunque el proveedor tambien pudiera. Gastar en un dato peor
seria el error.

    POR ACTIVO, NUNCA POR CANDIDATO

Yaku Perez tiene un Instagram profesional (Meta) y uno personal
(proveedor). Los dos coexisten con fuentes distintas.

    EL ESTADO OFICIAL PREVIO NUNCA SE BORRA

Cuando el proveedor mide un activo que Meta no alcanza, el
motivo por el que Meta no llega se CONSERVA junto al nuevo
estado. Perderlo perderia la razon para pedir acceso oficial.
===========================================================
*/

process.env.SENTINEL_LAKE_ADAPTER = "memoria";

const rt = await import("../services/intelligence/socialSourceRouting.js");

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
   A · INSTAGRAM PROFESIONAL MEDIBLE OFICIALMENTE
--------------------------------------------------------- */
bloque("A · Meta oficial tiene prioridad cuando puede medir");

const control = rt.fuenteParaActivo({
  platformId: "instagram",
  accountId: "instagram:pedropalaciosu",
  estadoOficial: "OBSERVADA",
  proveedorPuede: true,
  proveedorId: "scrapecreators"
});

await t("un activo medido por Meta queda MEDIDO_OFICIAL", () => {
  return (
    control.estado === rt.ESTADO_DE_MEDICION.MEDIDO_OFICIAL &&
    control.fuente === rt.CLASE_DE_FUENTE.OFICIAL
  );
});

await t("no se consulta al proveedor aunque pudiera medirlo tambien", () => {
  return control.usaProveedor === false;
});

await t("no lleva estadoOficialConservado: no hubo nada que conservar", () => {
  return !("estadoOficialConservado" in control) || control.estadoOficialConservado === undefined;
});


/* ---------------------------------------------------------
   B · INSTAGRAM PERSONAL, FALLBACK AL PROVEEDOR
--------------------------------------------------------- */
bloque("B · Fallback cuando Meta no puede medir el activo");

const fallback = rt.fuenteParaActivo({
  platformId: "instagram",
  accountId: "instagram:paulcarrascoc",
  estadoOficial: "NO_SOPORTADO_PERSONAL",
  proveedorPuede: true,
  proveedorId: "scrapecreators"
});

await t("cae al proveedor y queda MEDIDO_PROVEEDOR", () => {
  return (
    fallback.estado === rt.ESTADO_DE_MEDICION.MEDIDO_PROVEEDOR &&
    fallback.fuente === rt.CLASE_DE_FUENTE.PROVEEDOR
  );
});

await t("usaProveedor es true y el proveedor queda identificado", () => {
  return fallback.usaProveedor === true && fallback.proveedorId === "scrapecreators";
});


/* ---------------------------------------------------------
   C · NI OFICIAL NI PROVEEDOR PUEDEN
--------------------------------------------------------- */
bloque("C · Estado explicito cuando ninguna fuente puede medir");

const sinFuente = rt.fuenteParaActivo({
  platformId: "instagram",
  accountId: "instagram:hipotetico",
  estadoOficial: "NO_SOPORTADO_PERSONAL",
  proveedorPuede: false
});

await t("queda SIN_FUENTE, no NO_PROBADO ni un cero disfrazado", () => {
  return sinFuente.estado === rt.ESTADO_DE_MEDICION.SIN_FUENTE && sinFuente.fuente === null;
});

await t("SIN_FUENTE conserva el motivo por el que la oficial no llega", () => {
  return sinFuente.estadoOficialConservado === "NO_SOPORTADO_PERSONAL";
});

await t("un fallo temporal de la oficial NO abre el fallback", () => {
  /*
    Un token caducado se arregla renovando el token, no
    comprando datos raspados. Si esto abriera el fallback, un
    problema de credencial se disfrazaria de cobertura.
  */
  const r = rt.fuenteParaActivo({
    platformId: "facebook",
    accountId: "facebook:x",
    estadoOficial: "CREDENCIAL_EXPIRADA",
    proveedorPuede: true,
    proveedorId: "scrapecreators"
  });

  return r.estado === rt.ESTADO_DE_MEDICION.NO_PROBADO && r.usaProveedor === false;
});

await t("nada intentado todavia queda NO_PROBADO, no SIN_FUENTE", () => {
  const r = rt.fuenteParaActivo({
    platformId: "instagram",
    accountId: "instagram:nuevo",
    estadoOficial: null,
    proveedorPuede: true
  });

  return r.estado === rt.ESTADO_DE_MEDICION.NO_PROBADO;
});


/* ---------------------------------------------------------
   D · POR ACTIVO, NUNCA POR CANDIDATO
--------------------------------------------------------- */
bloque("D · Routing por activo, no por candidato");

const yaku = rt.fuentesDeCandidato({
  activos: [
    { platformId: "instagram", accountId: "instagram:yakuperezg", estadoOficial: "OBSERVADA" },
    { platformId: "instagram", accountId: "instagram:yaku_perez", estadoOficial: "NO_SOPORTADO_PERSONAL" }
  ],
  proveedorId: "scrapecreators",
  capacidadDelProveedor: () => true
});

await t("el activo profesional de Yaku queda oficial y el personal en proveedor", () => {
  const porId = Object.fromEntries(yaku.decisiones.map((d) => [d.accountId, d]));

  return (
    porId["instagram:yakuperezg"].fuente === rt.CLASE_DE_FUENTE.OFICIAL &&
    porId["instagram:yaku_perez"].fuente === rt.CLASE_DE_FUENTE.PROVEEDOR
  );
});

await t("fuentesMixtas es true: es el resultado correcto, no un error", () => {
  return yaku.fuentesMixtas === true;
});

await t("el resumen cuenta exactamente 1 oficial y 1 proveedor", () => {
  return yaku.resumen.oficial === 1 && yaku.resumen.proveedor === 1;
});


/* ---------------------------------------------------------
   E · N ACTIVOS EN LA MISMA PLATAFORMA, SIN COLAPSAR
--------------------------------------------------------- */
bloque("E · Multi-asset: N activos de la misma plataforma sobreviven");

const marcelo = rt.fuentesDeCandidato({
  activos: [
    { platformId: "instagram", accountId: "instagram:hmarcelocabrera", estadoOficial: "NO_SOPORTADO_PERSONAL" },
    { platformId: "instagram", accountId: "instagram:hugo_marcelo_cabrera_palacios", estadoOficial: "NO_SOPORTADO_PERSONAL" },
    { platformId: "instagram", accountId: "instagram:marcelocabrerap", estadoOficial: "NO_SOPORTADO_PERSONAL" }
  ],
  proveedorId: "scrapecreators",
  capacidadDelProveedor: () => true
});

await t("los tres activos de Marcelo Cabrera aparecen, ninguno se pierde", () => {
  return marcelo.decisiones.length === 3;
});

await t("cada uno conserva su propio accountId, sin colapsar en uno", () => {
  const ids = new Set(marcelo.decisiones.map((d) => d.accountId));

  return ids.size === 3;
});

await t("los tres caen al proveedor de forma independiente", () => {
  return marcelo.resumen.proveedor === 3;
});


/* ---------------------------------------------------------
   F · EL PROVEEDOR NUNCA BORRA EL ESTADO OFICIAL
--------------------------------------------------------- */
bloque("F · El estado oficial previo se preserva, nunca se sobrescribe");

await t("el estado oficial que motivo el fallback queda legible en el resultado", () => {
  return fallback.estadoOficialConservado === "NO_SOPORTADO_PERSONAL";
});

await t("el motivo explica que la oficial no alcanza Y que el proveedor si", () => {
  return (
    /no alcanza este activo/.test(fallback.motivo) &&
    /NO_SOPORTADO_PERSONAL/.test(fallback.motivo)
  );
});

await t("marcaDeFuente declara la procedencia sin fundir cifras de dos fuentes", () => {
  const m = rt.marcaDeFuente({
    fuente: rt.CLASE_DE_FUENTE.PROVEEDOR,
    proveedorId: "scrapecreators",
    estado: rt.ESTADO_DE_MEDICION.MEDIDO_PROVEEDOR
  });

  return (
    m.sourceKind === "provider" &&
    m.providerName === "scrapecreators" &&
    m.datoLicenciadoPorLaPlataforma === false &&
    /NO se promedian ni se mezclan/.test(m.noSeFunde)
  );
});

await t("marcaDeFuente para lo oficial declara la licencia de la plataforma", () => {
  const m = rt.marcaDeFuente({
    fuente: rt.CLASE_DE_FUENTE.OFICIAL,
    estado: rt.ESTADO_DE_MEDICION.MEDIDO_OFICIAL
  });

  return m.providerName === "meta" && m.datoLicenciadoPorLaPlataforma === true;
});


/* ---------------------------------------------------------
   G · AISLAMIENTO ENTRE PROYECTOS
--------------------------------------------------------- */
bloque("G · Proyecto A y Proyecto B no se mezclan");

await t("la decision de un activo no lleva projectId cruzado: es responsabilidad del llamador", () => {
  /*
    fuenteParaActivo es una funcion PURA sobre un activo: no lee
    ni escribe el Lake, asi que no puede mezclar proyectos por
    diseno. El aislamiento real se verifico en la persistencia
    (P-CAND-INSTAGRAM-FALLBACK-01, paso de aislamiento), no aqui.
  */
  const a = rt.fuenteParaActivo({
    platformId: "instagram",
    accountId: "instagram:mismo-handle",
    estadoOficial: "NO_SOPORTADO_PERSONAL",
    proveedorPuede: true,
    proveedorId: "scrapecreators"
  });

  const b = rt.fuenteParaActivo({
    platformId: "instagram",
    accountId: "instagram:mismo-handle",
    estadoOficial: "OBSERVADA",
    proveedorPuede: true,
    proveedorId: "scrapecreators"
  });

  /*
    Mismo accountId, dos proyectos distintos con estados
    oficiales distintos: la decision depende SOLO de lo que le
    pasa el llamador para ESE proyecto, nunca de un cache global.
  */
  return a.estado === rt.ESTADO_DE_MEDICION.MEDIDO_PROVEEDOR && b.estado === rt.ESTADO_DE_MEDICION.MEDIDO_OFICIAL;
});

await t("un proveedor desconocido en capacidadDelProveedor no rompe el calculo", () => {
  const r = rt.fuentesDeCandidato({
    activos: [{ platformId: "instagram", accountId: "instagram:x", estadoOficial: "NO_SOPORTADO_PERSONAL" }],
    proveedorId: "proveedor_inexistente",
    capacidadDelProveedor: () => false
  });

  return r.decisiones[0].estado === rt.ESTADO_DE_MEDICION.SIN_FUENTE;
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
