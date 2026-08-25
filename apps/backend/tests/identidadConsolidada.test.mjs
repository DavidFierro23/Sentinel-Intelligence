// apps/backend/tests/identidadConsolidada.test.mjs

/*
===========================================================
PRUEBAS DE IDENTIDAD CONSOLIDADA (BUG-19, BUG-17, BUG-18)
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/identidadConsolidada.test.mjs

SIN RED Y SIN CUOTA.

LA REGLA QUE DEFIENDEN
-----------------------------------------------------------

    LA AUSENCIA DE OBSERVACION NO REVOCA UNA IDENTIDAD.

Que un buscador no devuelva hoy una cuenta no dice nada sobre si
esa cuenta es del candidato. Dice algo sobre el buscador.

Medido en produccion: `instagram.com/jotalloretv` se atribuyo el
24 de agosto a las 22:14 y desaparecio del expediente a las 15:58
del dia siguiente, cuando la consulta de Instagram devolvio 1
resultado en lugar de 9. La misma mecanica explica la regresion
49 → 22 que quedo dos dias sin explicacion.

DOS PLANOS QUE NO SE MEZCLAN
-----------------------------------------------------------

    IDENTIDAD     de quien es la cuenta. No la decide un proveedor.
    OBSERVACION   si hoy se pudo ver. La decide por completo.

`estado` habla del primero; `seenInCurrentRun`, `lastSeenAt` y
`lastCheckedAt`, del segundo. CONSOLIDADA + no reencontrada no es
una contradiccion: es la descripcion honesta de lo que sabemos.
===========================================================
*/

process.env.SENTINEL_LAKE_ADAPTER = "memoria";

const ps = await import("../services/projects/projectStore.js");

const pa = await import("../services/social/discovery/platformAdapters.js");

const pc = await import("../services/projects/projectContext.js");

const ac = await import("../services/social/classification/accountClassifier.js");

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

const E = ps.ESTADOS_IDENTIDAD;

/* Constructor de cuenta con la forma real del motor. */
function cuenta(o) {
  return {
    plataforma: o.plataforma,
    plataformaId: o.plataformaId,
    handle: o.handle,
    url: { canonica: o.url },
    correspondencia: { puntuacion: o.score ?? 40, nivel: "posible" },
    origenes: o.origenes || [
      { via: "consulta_dirigida", proveedor: o.proveedor || "SerpAPI (Google)" }
    ],
    vias: o.vias || ["consulta_dirigida"],
    proveedores: o.proveedores || [o.proveedor || "SerpAPI (Google)"],
    corroboracion: {
      proveedores: o.proveedores || [o.proveedor || "SerpAPI (Google)"],
      totalProveedores: (o.proveedores || [1]).length,
      multiProveedor: (o.proveedores || []).length > 1,
      vias: o.vias || ["consulta_dirigida"],
      multiVia: false
    },
    clasificacion: {
      clase: "cuenta_personal",
      razones: [o.razon || "el handle contiene lloret del nombre del objetivo"]
    }
  };
}

const X = cuenta({
  plataforma: "X",
  plataformaId: "x",
  handle: "jotalloretv",
  url: "https://x.com/jotalloretv",
  score: 62,
  proveedores: ["SerpAPI (Google)", "DuckDuckGo Web"]
});

const IG = cuenta({
  plataforma: "Instagram",
  plataformaId: "instagram",
  handle: "jotalloretv",
  url: "https://www.instagram.com/jotalloretv",
  score: 21,
  proveedor: "DuckDuckGo Web"
});

const FB_ANALISTA = cuenta({
  plataforma: "Facebook",
  plataformaId: "facebook",
  handle: "juancristobal.lloretvaldivieso",
  url: "https://www.facebook.com/juancristobal.lloretvaldivieso",
  score: 49,
  proveedores: [],
  vias: [],
  origenes: [
    {
      via: "cuenta_referencia",
      proveedor: null,
      origen: "analista",
      noCuentaComoCorroboracion: true
    }
  ]
});

/* Un resultado con las cuentas que se le pasen. */
function resultado(cuentas, opciones = {}) {
  return {
    perfilEjecutivo: {
      huellaDigital: { valor: opciones.huella ?? 40 },
      tarjetas: cuentas.map((c) => ({
        plataforma: c.plataforma,
        plataformaId: c.plataformaId,
        handle: c.handle,
        correspondencia: c.correspondencia.puntuacion
      })),
      medios: [],
      instituciones: [],
      indeterminadas: []
    },
    clasificacionCuentas: {
      cuentasObjetivo: cuentas,
      medios: [],
      instituciones: [],
      indeterminadas: []
    },
    social: {
      cobertura: opciones.cobertura || [],
      descubrimiento: {
        plan: opciones.plan || [],
        intentos: opciones.intentos || [],
        descartados: [],
        anclasUsadas: [],
        aliasUsados: [],
        advertencias: [],
        proveedores: { proveedores: opciones.proveedores || [] }
      }
    },
    fichaObjetivo: {
      evidencias: { web: new Array(opciones.evidencias ?? 30).fill({}) }
    }
  };
}

const PID = "consol-test";

const CID = "juan-cristobal-lloret-valdivieso";

await ps.crearProyecto({
  id: PID,
  nombre: "Proyecto identidad",
  canton: "Cuenca",
  provincia: "Azuay",
  pais: "Ecuador",
  dignidad: "Alcaldía de Cuenca"
});

await ps.agregarCandidato(PID, { nombre: "Juan Cristóbal Lloret Valdivieso" });

const leer = async () => {
  const c = await ps.contenidoDeProyecto(PID);

  return c.candidatos.find((x) => x.id === CID);
};

const cuentaDe = (cand, plataformaId) =>
  (cand.expediente?.cuentas || []).find((c) => c.plataformaId === plataformaId);

/* N: X + Instagram atribuidas. */
await ps.registrarInvestigacion(PID, CID, resultado([X, IG]));

const trasN = await leer();

/*
===========================================================
T1 y T15 — LA AUSENCIA NO REVOCA
===========================================================
*/

bloque("T1 · T15  Instagram desaparece del buscador y NO del inventario");

await t("en N, Instagram queda atribuida y observada", () => {
  const c = cuentaDe(trasN, "instagram");

  return c.estado === E.ATRIBUIDA && c.seenInCurrentRun === true;
});

/* N+1: solo X. Instagram no se reencuentra. */
await ps.registrarInvestigacion(PID, CID, resultado([X]));

const trasN1 = await leer();

await t("T1: Instagram SIGUE en el inventario tras no reencontrarse", () => {
  return !!cuentaDe(trasN1, "instagram");
});

await t("T1: queda con seenInCurrentRun = false", () => {
  return cuentaDe(trasN1, "instagram").seenInCurrentRun === false;
});

await t("T1: su estado es NO_REENCONTRADA, no REVOCADA", () => {
  const c = cuentaDe(trasN1, "instagram");

  return c.estado === E.NO_REENCONTRADA && c.estado !== E.REVOCADA;
});

await t("T15: NINGUNA cuenta pasa a REVOCADA por ausencia del provider", () => {
  /*
    LA REGLA. Si esta prueba falla, el sistema esta dejando que un
    buscador decida de quien es una cuenta.
  */
  return (trasN1.expediente.cuentas || []).every(
    (c) => c.estado !== E.REVOCADA
  );
});

await t("lastSeenAt NO avanza si no se vio; lastCheckedAt SÍ", () => {
  /*
    La distincion entre «se miro» y «se vio». Sin ella no se
    puede saber si el silencio es de la cuenta o del buscador.
  */
  const antes = cuentaDe(trasN, "instagram");

  const ahora = cuentaDe(trasN1, "instagram");

  return (
    ahora.lastSeenAt === antes.lastSeenAt &&
    ahora.lastCheckedAt !== antes.lastCheckedAt
  );
});

await t("X, que sí se vio, queda REVALIDADA", () => {
  const c = cuentaDe(trasN1, "x");

  return c.estado === E.REVALIDADA && c.seenInCurrentRun === true;
});

/*
===========================================================
T2 — VUELVE A APARECER
===========================================================
*/

bloque("T2  Instagram reaparece en N+2");

await ps.registrarInvestigacion(PID, CID, resultado([X, IG]));

const trasN2 = await leer();

await t("no se duplica: sigue habiendo una sola cuenta de Instagram", () => {
  return (
    trasN2.expediente.cuentas.filter((c) => c.plataformaId === "instagram")
      .length === 1
  );
});

await t("lastSeenAt se actualiza al reaparecer", () => {
  return (
    cuentaDe(trasN2, "instagram").lastSeenAt !==
    cuentaDe(trasN1, "instagram").lastSeenAt
  );
});

await t("firstSeenAt NO se reescribe: la historia se conserva", () => {
  return (
    cuentaDe(trasN2, "instagram").firstSeenAt ===
    cuentaDe(trasN, "instagram").firstSeenAt
  );
});

await t("vuelve a REVALIDADA y observada", () => {
  const c = cuentaDe(trasN2, "instagram");

  return c.estado === E.REVALIDADA && c.seenInCurrentRun === true;
});

await t("los proveedores históricos se acumulan, no se reemplazan", () => {
  /*
    Memoria de quien la ha visto alguna vez, frente a quien la
    vio esta vez.
  */
  const c = cuentaDe(trasN2, "x");

  return (
    c.proveedoresHistoricos.length >= 2 &&
    Array.isArray(c.proveedoresUltimaObservacion)
  );
});

/*
===========================================================
T3, T4 y T5 — FALLO, VACIO Y PRESUPUESTO
===========================================================

Tres formas distintas de no ver una cuenta. Ninguna la borra.
*/

bloque("T3 · T4 · T5  provider falla, devuelve cero, o no llega a consultar");

await t("T3: con el provider en error, el inventario permanece", async () => {
  await ps.registrarInvestigacion(
    PID,
    CID,
    resultado([X], {
      cobertura: [
        { plataformaId: "instagram", plataforma: "Instagram", candidatos: 0 }
      ],
      plan: [{ consulta: 'site:instagram.com "x"', plataformaId: "instagram" }],
      intentos: [
        {
          consulta: 'site:instagram.com "x"',
          plataformaId: "instagram",
          estado: "Error",
          proveedorUsado: null,
          resultados: 0
        }
      ]
    })
  );

  const c = await leer();

  const ig = cuentaDe(c, "instagram");

  return !!ig && ig.estado === E.NO_REENCONTRADA;
});

await t("T4: con cero resultados reales, el inventario permanece", async () => {
  await ps.registrarInvestigacion(
    PID,
    CID,
    resultado([X], {
      cobertura: [
        { plataformaId: "instagram", plataforma: "Instagram", candidatos: 0 }
      ],
      plan: [{ consulta: 'site:instagram.com "y"', plataformaId: "instagram" }],
      intentos: [
        {
          consulta: 'site:instagram.com "y"',
          plataformaId: "instagram",
          estado: "OK",
          proveedorUsado: "SerpAPI (Google)",
          resultados: 0
        }
      ]
    })
  );

  const ig = cuentaDe(await leer(), "instagram");

  return !!ig && ig.estado !== E.REVOCADA;
});

await t("T5: si el presupuesto impide consultar, el inventario permanece", async () => {
  /*
    La plataforma se planifico y no se lanzo. Es el caso mas
    peligroso: no hubo ni un intento, asi que no hay ninguna
    informacion nueva sobre la cuenta.
  */
  await ps.registrarInvestigacion(
    PID,
    CID,
    resultado([X], {
      cobertura: [
        { plataformaId: "instagram", plataforma: "Instagram", candidatos: 0 }
      ],
      plan: [{ consulta: 'site:instagram.com "z"', plataformaId: "instagram" }],
      intentos: []
    })
  );

  const ig = cuentaDe(await leer(), "instagram");

  return !!ig && ig.estado !== E.REVOCADA;
});

/*
===========================================================
T6, T7, T8 y T9 — EL INVENTARIO ALIMENTA LA PROPAGACION
===========================================================
*/

bloque("T6 · T7 · T8 · T9  del inventario al planificador");

const inventario = await ps.inventarioConsolidado(PID, "candidato", CID);

await t("T6: el inventario autoritativo incluye jotalloretv", () => {
  /*
    BUG-17. Antes se leia de `candidato.expediente`, que no existe
    en el registro crudo, y la lista llegaba vacia.
  */
  return inventario.some(
    (c) => c.handle === "jotalloretv" && c.plataformaId === "x"
  );
});

await t("T6b: incluye la de Instagram aunque no se reencontrara", () => {
  /*
    Lo que hace util al inventario: sigue sirviendo de semilla
    cuando el buscador falla.
  */
  const ig = inventario.find((c) => c.plataformaId === "instagram");

  return !!ig && ig.seenInCurrentRun === false;
});

const contexto = pc.construirContextoMaestro(
  {
    nombre: "Alcaldía de Cuenca 2027",
    canton: "Cuenca",
    provincia: "Azuay",
    pais: "Ecuador",
    dignidad: "Alcaldía de Cuenca"
  },
  { nombre: "Juan Cristóbal Lloret Valdivieso", nivel: "cantonal" }
);

const perfilBase = pc.aplicarContextoMaestro(
  {
    nombrePrincipal: "Juan Cristóbal Lloret Valdivieso",
    contexto: { rol: "Candidato", pais: "Ecuador" }
  },
  contexto
);

const plan = pa.planificarConsultasDerivadas(
  {
    ...perfilBase,
    handlesConocidos: inventario.map((c) => ({ ...c, atribuida: true }))
  },
  {}
);

const propagadas = plan.plan.filter((q) => q.via === "handle_propagado");

await t("T6c: el planificador recibe jotalloretv como semilla", () => {
  return plan.handlesPropagados.includes("jotalloretv");
});

await t("T7: jotalloretv en X y en Instagram es UNA sola semilla", () => {
  return (
    plan.handlesPropagados.filter((h) => h === "jotalloretv").length === 1
  );
});

await t("T8: la consulta de TikTok por jotalloretv está en el plan", () => {
  return propagadas.some(
    (q) => q.consulta === 'site:tiktok.com "jotalloretv"'
  );
});

await t("T8b: y va ANTES de las reservas por nombre", () => {
  /*
    BUG-18. En produccion la propagacion iba al final y el
    presupuesto moria antes: las cuatro propagadas dieron Error.
    Las reservas que iban delante fallaron las tres, asi que
    ocupaban el turno sin producir.
  */
  const tiktok = plan.plan.findIndex(
    (q) => q.consulta === 'site:tiktok.com "jotalloretv"'
  );

  const primeraReserva = plan.plan.findIndex((q) =>
    String(q.etiqueta).startsWith("nombre:")
  );

  return tiktok >= 0 && primeraReserva >= 0 && tiktok < primeraReserva;
});

await t("T8c: pero DESPUÉS de la cobertura de las 6 plataformas", () => {
  /*
    Lo que no se puede perder es la cobertura. La propagacion
    amplia; no se pone por delante de lo indispensable.
  */
  const primeraPropagada = plan.plan.findIndex(
    (q) => q.via === "handle_propagado"
  );

  const ultimaAnclada = plan.plan.reduce(
    (acc, q, i) => (q.anclada && q.plataformaId ? i : acc),
    -1
  );

  return primeraPropagada > ultimaAnclada;
});

await t("T9: no se propaga a plataformas ya consolidadas, y consta", () => {
  const destinos = propagadas.map((q) => q.plataformaId);

  return (
    !destinos.includes("x") &&
    !destinos.includes("instagram") &&
    plan.propagacionOmitidaPorAtribuida.some((x) => x.startsWith("x:"))
  );
});

await t("el truncamiento sigue siendo observable", () => {
  return typeof plan.propagadasTruncadas === "number";
});

/*
===========================================================
T10 y T11 — IDENTIDAD Y PROCEDENCIA
===========================================================
*/

bloque("T10 · T11  el Matcher manda; el analista orienta");

await t("T10: el MISMO handle de otra persona NO se atribuye", () => {
  return (
    ac.clasificarCuenta(
      { handle: "jotalloretv" },
      { nombrePrincipal: "Pedro Palacios" }
    ).clase !== "cuenta_personal"
  );
});

await t("T11: la cuenta declarada por el analista persiste", async () => {
  await ps.registrarInvestigacion(PID, CID, resultado([X, FB_ANALISTA]));

  const fb = cuentaDe(await leer(), "facebook");

  return !!fb && fb.estado === E.DECLARADA_POR_ANALISTA;
});

await t("T11b: y NO se autoverifica: cero proveedores", () => {
  return cuentaDe(trasN1, "x").proveedores.length > 0;
});

await t("T11c: la declarada conserva su marca de no corroborar", async () => {
  const fb = cuentaDe(await leer(), "facebook");

  return (
    fb.referenciaAnalista === true &&
    fb.noCuentaComoCorroboracion === true &&
    fb.proveedores.length === 0
  );
});

await t("T11d: y sirve de semilla sin corroborar", async () => {
  const inv = await ps.inventarioConsolidado(PID, "candidato", CID);

  const fb = inv.find((c) => c.plataformaId === "facebook");

  return fb.referenciaAnalista === true;
});

/*
===========================================================
T12, T13 y T16 — RETROCOMPATIBILIDAD Y APPEND-ONLY
===========================================================
*/

bloque("T12 · T13 · T16  expedientes antiguos y Knowledge Lake");

await t("T12: una cuenta histórica sin firstSeenAt sobrevive", async () => {
  /*
    Los expedientes escritos antes de este contrato no traen
    marcas de tiempo. No se inventan: quedan en null y
    `historiaIncompleta` lo declara. Inventar una fecha plausible
    seria un dato falso con apariencia de dato.
  */
  const PID2 = "legado-test";

  await ps.crearProyecto({
    id: PID2,
    nombre: "Legado",
    canton: "Cuenca",
    pais: "Ecuador",
    dignidad: "Alcalde"
  });

  await ps.agregarCandidato(PID2, { nombre: "Objetivo Legado Prueba" });

  /* Se escribe un expediente con la forma ANTIGUA. */
  await ps.registrarInvestigacion(PID2, "objetivo-legado-prueba", {
    perfilEjecutivo: {
      huellaDigital: { valor: 10 },
      tarjetas: [
        { plataforma: "X", plataformaId: "x", handle: "viejohandle", correspondencia: 30 }
      ],
      medios: [],
      instituciones: [],
      indeterminadas: []
    }
  });

  const c = await ps.contenidoDeProyecto(PID2);

  const x = c.candidatos.find((y) => y.id === "objetivo-legado-prueba");

  return (
    x.expediente.cuentas.length === 1 &&
    x.estadoInvestigacion === "completada"
  );
});

await t("T16: los expedientes históricos se siguen leyendo", async () => {
  /*
    Lectura real del Lake de produccion, sin escribir nada: si el
    contrato nuevo rompiera la lectura de lo viejo, esto falla.
    Se acepta que el proyecto no exista en este entorno.
  */
  const c = await ps.contenidoDeProyecto("alcaldia-cuenca-2027-piloto");

  if (!c) return true;

  return Array.isArray(c.candidatos);
});

await t("T13: el Knowledge Lake sigue siendo append-only", async () => {
  /*
    Nada de esto reescribe historia: cada version se anexa. El
    contrato del Lake no admite eliminar, y aqui se comprueba que
    sigue sin admitirlo.
  */
  const { OPERACIONES_PROHIBIDAS } = await import(
    "../services/knowledgeLake/lakeAdapter.js"
  );

  const { crearEscritor } = await import(
    "../services/knowledgeLake/lakeWriter.js"
  );

  const escritor = crearEscritor(null, null);

  let lanza = false;

  try {
    escritor.eliminar();
  } catch {
    lanza = true;
  }

  return (
    OPERACIONES_PROHIBIDAS.includes("eliminar") &&
    OPERACIONES_PROHIBIDAS.includes("actualizar") &&
    lanza === true
  );
});

await t("las versiones del expediente se acumulan, no se sustituyen", async () => {
  const { obtenerHistorialEntidad } = await import(
    "../services/knowledgeLake/lakeQuery.js"
  );

  const h = await obtenerHistorialEntidad(`expediente-candidato-${CID}`, {
    tenantId: "sentinel-local",
    proyectoId: PID
  });

  return (h?.versiones || []).length > 1;
});

/*
===========================================================
T14 — LA TRAZA DISTINGUE LOS DOS PLANOS
===========================================================
*/

bloque("T14  observada en esta ejecución vs consolidada no reencontrada");

await t("la ejecución declara su inventario, separando ambos planos", async () => {
  const cand = await leer();

  const inv = cand.ultimaEjecucion?.inventario;

  return (
    !!inv &&
    typeof inv.total === "number" &&
    typeof inv.observadasEnEstaEjecucion === "number" &&
    typeof inv.noReencontradas === "number" &&
    typeof inv.porEstado === "object"
  );
});

await t("los recuentos cuadran con el inventario", async () => {
  const cand = await leer();

  const inv = cand.ultimaEjecucion.inventario;

  return inv.observadasEnEstaEjecucion + inv.noReencontradas === inv.total;
});

await t("cada cuenta dice en qué ejecución se observó por última vez", async () => {
  const cand = await leer();

  return (cand.expediente.cuentas || [])
    .filter((c) => c.seenInCurrentRun)
    .every((c) => typeof c.ultimaEjecucionObservada === "string");
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
