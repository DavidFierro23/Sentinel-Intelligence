// apps/backend/tests/territorial-coverage.test.mjs

import {
  ALCANCES,
  ETIQUETAS,
  esAtribuible,
  indiceDeAmbito,
  clasificarAlcance,
  resumirAlcance
} from "../services/territorial/territorialScope.js";

import {
  ESTADOS_COBERTURA,
  construirMatrizDeCobertura
} from "../services/territorial/listeningCoverage.js";

import {
  CLASES_ACTOR,
  CERTEZAS,
  PROCEDENCIAS,
  entityIdDe,
  construirUniversoDeActores
} from "../services/territorial/actorUniverse.js";

import {
  AFIRMACIONES,
  PROHIBIDAS,
  esAfirmacionProhibida,
  afirmar,
  revisarSalida
} from "../services/territorial/claimGuard.js";

import {
  crearLedgerMemoria,
  reconstruirEstado,
  registrarPasada
} from "../services/territorial/evidenceLedger.js";

/*
===========================================================
PRUEBAS DE TERRITORIAL-SOURCE-COVERAGE-01
===========================================================

    node tests/territorial-coverage.test.mjs

SIN RED.

Lo que estas pruebas defienden es una sola idea: **el sistema
no puede afirmar mas de lo que ha observado**. Ni sobre
geografia, ni sobre tendencias, ni sobre la ciudad.
===========================================================
*/

let pass = 0;

let fail = 0;

const fallos = [];

function t(nombre, comprobacion) {
  try {
    if (comprobacion()) {
      pass += 1;
      console.log(`  PASS  ${nombre}`);
    } else {
      fail += 1;
      fallos.push(nombre);
      console.log(`  FALL  ${nombre}`);
    }
  } catch (e) {
    fail += 1;
    fallos.push(`${nombre} — ${e.message}`);
    console.log(`  ERR   ${nombre}: ${e.message}`);
  }
}

async function ta(nombre, comprobacion) {
  try {
    if (await comprobacion()) {
      pass += 1;
      console.log(`  PASS  ${nombre}`);
    } else {
      fail += 1;
      fallos.push(nombre);
      console.log(`  FALL  ${nombre}`);
    }
  } catch (e) {
    fail += 1;
    fallos.push(`${nombre} — ${e.message}`);
    console.log(`  ERR   ${nombre}: ${e.message}`);
  }
}

let llamadasDeRed = 0;

const fetchOriginal = globalThis.fetch;

globalThis.fetch = () => {
  llamadasDeRed += 1;

  return Promise.reject(new Error("RED PROHIBIDA EN LAS PRUEBAS"));
};


const T0 = "2026-09-01T10:00:00.000Z";

const CUENCA = "ec-azuay-cuenca";

const FICHAS = [
  {
    sourceId: "elmercurio.com.ec",
    dominio: "elmercurio.com.ec",
    nombre: "El Mercurio",
    tipo: "medio_local",
    territorioDeclarado: CUENCA,
    estadoVerificacion: "VERIFICADO_FEED",
    feeds: [{ url: "https://elmercurio.com.ec/feed/", conContenido: true }]
  },
  {
    sourceId: "expreso.ec",
    dominio: "expreso.ec",
    nombre: "Expreso",
    tipo: "medio_nacional",
    territorioDeclarado: null,
    estadoVerificacion: "VERIFICADO_FEED",
    feeds: [{ url: "https://expreso.ec/rss", conContenido: true }]
  },
  {
    sourceId: "emac.gob.ec",
    dominio: "emac.gob.ec",
    nombre: "EMAC EP",
    tipo: "institucion",
    subtipo: "EMPRESA_PUBLICA_MUNICIPAL",
    territorioDeclarado: CUENCA,
    estadoVerificacion: "VERIFICADO_FEED",
    feeds: [{ url: "https://emac.gob.ec/feed/", conContenido: true }]
  },
  {
    sourceId: "cuenca.gob.ec",
    dominio: "cuenca.gob.ec",
    nombre: "GAD de Cuenca",
    tipo: "institucion",
    territorioDeclarado: CUENCA,
    estadoVerificacion: "NO_PUBLICA_RSS",
    feeds: []
  }
];

const INDICE = indiceDeAmbito(FICHAS);


/* =========================================================
   1. CUENCA VS NACIONAL — el territorio no se fuerza
   ========================================================= */

console.log("\n--- Alcance territorial ---\n");

t("A · la pieza con topónimo se atribuye al territorio", () => {
  const c = clasificarAlcance({
    evidencia: { domain: "elmercurio.com.ec" },
    ubicacion: { unidadId: CUENCA, nivel: "canton", razones: ["topónimo (+40)"] },
    indice: INDICE
  });

  return (
    c.alcance === ALCANCES.TERRITORIO_EXPLICITO &&
    c.territorioAtribuible === true &&
    c.unidadId === CUENCA
  );
});

t("B · fuente local sin topónimo NO se atribuye al cantón", () => {
  const c = clasificarAlcance({
    evidencia: { domain: "elmercurio.com.ec" },
    ubicacion: null,
    indice: INDICE
  });

  return (
    c.alcance === ALCANCES.FUENTE_LOCAL_SIN_TERRITORIO &&
    c.territorioAtribuible === false &&
    c.unidadId === null &&
    c.territorioDeLaFuente === CUENCA &&
    /pista sobre la fuente/i.test(c.declaracion)
  );
});

t("B · la etiqueta dice exactamente lo que se puede decir", () =>
  ETIQUETAS[ALCANCES.FUENTE_LOCAL_SIN_TERRITORIO] ===
  "Fuente local · territorio de la pieza no demostrado");

t("C · medio nacional sin topónimo no es del cantón", () => {
  const c = clasificarAlcance({
    evidencia: { domain: "expreso.ec" },
    ubicacion: null,
    indice: INDICE
  });

  return (
    c.alcance === ALCANCES.NACIONAL_RELACIONADO &&
    c.territorioAtribuible === false &&
    c.territorioDeLaFuente === null
  );
});

t("D · sin fuente conocida ni ubicación, no resoluble", () => {
  const c = clasificarAlcance({
    evidencia: { domain: "desconocido.test" },
    ubicacion: null,
    indice: INDICE
  });

  return c.alcance === ALCANCES.TERRITORIO_NO_RESOLUBLE && c.territorioAtribuible === false;
});

t("SOLO A es atribuible: los otros tres NO cuentan en el cantón", () =>
  esAtribuible(ALCANCES.TERRITORIO_EXPLICITO) &&
  !esAtribuible(ALCANCES.FUENTE_LOCAL_SIN_TERRITORIO) &&
  !esAtribuible(ALCANCES.NACIONAL_RELACIONADO) &&
  !esAtribuible(ALCANCES.TERRITORIO_NO_RESOLUBLE));

t("los cuatro estados SUMAN el corpus: nada se descarta en silencio", () => {
  const clasificadas = [
    clasificarAlcance({ evidencia: { domain: "elmercurio.com.ec" }, ubicacion: { unidadId: CUENCA }, indice: INDICE }),
    clasificarAlcance({ evidencia: { domain: "elmercurio.com.ec" }, ubicacion: null, indice: INDICE }),
    clasificarAlcance({ evidencia: { domain: "expreso.ec" }, ubicacion: null, indice: INDICE }),
    clasificarAlcance({ evidencia: { domain: "x.test" }, ubicacion: null, indice: INDICE })
  ];

  const r = resumirAlcance(clasificadas);

  const suma = Object.values(r.porAlcance).reduce((a, b) => a + b, 0);

  return suma === r.total && r.total === 4 && r.atribuiblesAlTerritorio === 1;
});


/* =========================================================
   2. AFIRMACIONES: lo que se puede y lo que no
   ========================================================= */

console.log("\n--- Afirmaciones permitidas y prohibidas ---\n");

t("«más visto en Cuenca» está prohibido y dice por qué", () => {
  const r = esAfirmacionProhibida("El video más visto en Cuenca esta semana");

  return r.prohibida && /ciudad, no sobre la muestra/i.test(r.motivo);
});

t("«lo que piensa Cuenca» está prohibido", () =>
  esAfirmacionProhibida("Esto es lo que piensa Cuenca sobre el tranvía").prohibida);

t("un porcentaje poblacional está prohibido", () =>
  esAfirmacionProhibida("El 34 % de la población habla de movilidad").prohibida &&
  esAfirmacionProhibida("penetración territorial del tema").prohibida);

t("«intención de voto» está prohibido", () =>
  esAfirmacionProhibida("intención de voto por candidato").prohibida);

t("la afirmación permitida se ata a la MUESTRA en su propio texto", () => {
  const a = afirmar("MAS_MENCIONES", { sujeto: "Seguridad", medidas: { evidencias: 25 } });

  return (
    a.afirmable &&
    /muestra/i.test(a.texto) &&
    a.ambito === "MUESTRA_OBSERVADA" &&
    !esAfirmacionProhibida(a.texto).prohibida
  );
});

t("sin la medida NO se produce una versión debilitada: se niega", () => {
  const a = afirmar("MAS_VISUALIZACIONES_EN_LA_MUESTRA", { sujeto: "Un video", medidas: {} });

  return a.afirmable === false && a.texto === null && /Falta la medida/i.test(a.motivo);
});

t("una afirmación no declarada se rechaza", () => {
  const a = afirmar("MAS_VISTO_EN_LA_CIUDAD", { sujeto: "X", medidas: { evidencias: 1 } });

  return a.afirmable === false && /no es una afirmación declarada/i.test(a.motivo);
});

t("todas las plantillas permitidas pasan su propia revisión", () =>
  Object.keys(AFIRMACIONES).every((id) => {
    const a = afirmar(id, {
      sujeto: "Sujeto",
      medidas: { evidencias: 1, fuentes: 1, interacciones: 1, visualizaciones: 1 }
    });

    return a.afirmable && !esAfirmacionProhibida(a.texto).prohibida;
  }));

t("la revisión de salida encuentra una afirmación de más anidada", () => {
  const r = revisarSalida({ panel: { titulo: "Lo más leído en Cuenca", ok: "menciones observadas" } });

  return !r.limpio && r.hallazgos.length === 1 && r.hallazgos[0].ruta === "$.panel.titulo";
});

t("una salida honesta pasa limpia", () => {
  const r = revisarSalida({
    a: "mayor número de menciones observadas en la muestra",
    b: ["dominio más recurrente del corpus observado"]
  });

  return r.limpio && r.hallazgos.length === 0;
});

t("cada prohibición declara qué le falta para ser afirmable", () =>
  PROHIBIDAS.every((p) => typeof p.motivo === "string" && p.motivo.length > 20));


/* =========================================================
   3. MATRIZ DE COBERTURA
   ========================================================= */

console.log("\n--- Matriz de cobertura ---\n");

const CORPUS = [
  {
    evidenceId: "e1",
    sourceId: "elmercurio.com.ec",
    domain: "elmercurio.com.ec",
    publisher: "El Mercurio",
    emitterId: "elmercurio.com.ec",
    canonicalUrl: "https://elmercurio.com.ec/1",
    summary: "resumen",
    publishedAt: "2026-09-01T08:00:00Z",
    firstObservedAt: T0,
    lastObservedAt: T0,
    providers: ["rss_directo"]
  },
  {
    evidenceId: "e2",
    sourceId: "emac.gob.ec",
    domain: "emac.gob.ec",
    publisher: "EMAC EP",
    emitterId: "emac.gob.ec",
    canonicalUrl: "https://emac.gob.ec/1",
    summary: "resumen",
    publishedAt: "2026-09-01T09:00:00Z",
    firstObservedAt: T0,
    lastObservedAt: T0,
    providers: ["rss_directo"]
  }
];

const MATRIZ = construirMatrizDeCobertura({
  corpus: CORPUS,
  fichas: FICHAS,
  motores: [{ providerId: "rss_directo", observacionesEnElCorpus: 2 }],
  senales: { clasificadas: 3, descubiertas: 8 },
  alcance: resumirAlcance([
    clasificarAlcance({ evidencia: { domain: "elmercurio.com.ec" }, ubicacion: { unidadId: CUENCA }, indice: INDICE }),
    clasificarAlcance({ evidencia: { domain: "expreso.ec" }, ubicacion: null, indice: INDICE })
  ]),
  tendencia: { conTendenciaDeclarable: 0 },
  actores: { porClase: {} }
});

t("las 20 dimensiones están resueltas: ninguna sin estado", () =>
  MATRIZ.dimensiones.length === 20 &&
  MATRIZ.dimensiones.every((d) =>
    Object.values(ESTADOS_COBERTURA).includes(d.estado)
  ));

t("cada dimensión explica POR QUÉ tiene ese estado", () =>
  MATRIZ.dimensiones.every((d) => typeof d.porQue === "string" && d.porQue.length > 10));

t("cada dimensión dice qué falta para mejorarla", () =>
  MATRIZ.dimensiones.every((d) => typeof d.queFalta === "string" && d.queFalta.length > 5));

t("OPERATIVO exige evidencia real, no un adapter configurado", () => {
  const sinCorpus = construirMatrizDeCobertura({
    corpus: [],
    fichas: FICHAS,
    motores: [{ providerId: "rss_directo", observacionesEnElCorpus: 0 }],
    senales: { clasificadas: 0, descubiertas: 0 }
  });

  const rss = sinCorpus.dimensiones.find((d) => d.dimension === "rss");

  return rss.estado === ESTADOS_COBERTURA.NO_PROBADO;
});

t("con evidencia real, RSS sí es OPERATIVO", () => {
  const rss = MATRIZ.dimensiones.find((d) => d.dimension === "rss");

  return rss.estado === ESTADOS_COBERTURA.OPERATIVO && rss.evidencias === 2;
});

t("NO_PROBADO, NO_DISPONIBLE y BLOQUEADO son estados distintos", () =>
  ESTADOS_COBERTURA.NO_PROBADO !== ESTADOS_COBERTURA.NO_DISPONIBLE &&
  ESTADOS_COBERTURA.NO_DISPONIBLE !== ESTADOS_COBERTURA.BLOQUEADO);

t("la matriz NO declara ningún porcentaje de cobertura", () => {
  const json = JSON.stringify(MATRIZ);

  /*
    Se prohibe la CIFRA, no la palabra: la declaración que dice
    que no calculamos porcentajes contiene «porcentaje», y
    prohibir el término tumbaría justo la frase honesta.
  */
  const cifraPorcentual = /\d+([.,]\d+)?\s*%/;

  return (
    !cifraPorcentual.test(json) &&
    !/cobertura del?\s+\d/i.test(json) &&
    MATRIZ.declaraciones.some((d) => /no existe el denominador/i.test(d))
  );
});

t("lo fuera de alcance se declara como decisión, no como carencia", () =>
  MATRIZ.fueraDeAlcance.length >= 5 &&
  MATRIZ.fueraDeAlcance.some((x) => /Rastreo individual/i.test(x)) &&
  MATRIZ.fueraDeAlcance.some((x) => /sensibles/i.test(x)));

t("los huecos se separan por lo que los cerraría", () =>
  Array.isArray(MATRIZ.huecos.requierenProveedor) &&
  Array.isArray(MATRIZ.huecos.requierenTiempo) &&
  MATRIZ.huecos.requierenProveedor.length > 0);

t("sin tendencias declarables NO se dice OPERATIVO en tendencias", () => {
  const d = MATRIZ.dimensiones.find((x) => x.dimension === "tendencias");

  return d.estado === ESTADOS_COBERTURA.PARCIAL && /ventana comparable/i.test(d.porQue);
});


/* =========================================================
   4. UNIVERSO DE ACTORES
   ========================================================= */

console.log("\n--- Universo de actores ---\n");

const ACTORES = construirUniversoDeActores({
  corpus: CORPUS,
  fichas: FICHAS,
  projectId: "proyecto-a"
});

t("los actores se derivan del corpus observado", () =>
  ACTORES.actores.length === 2 && ACTORES.metricas.total === 2);

t("el entityId es estable y derivado de la clave", () =>
  entityIdDe("elmercurio.com.ec") === "act-elmercurio.com.ec" &&
  ACTORES.actores.every((a) => a.entityId.startsWith("act-")));

t("cada actor lleva su projectId", () =>
  ACTORES.actores.every((a) => a.projectId === "proyecto-a"));

t("la clase sale del universo de fuentes, no del nombre", () => {
  const emac = ACTORES.actores.find((a) => a.clave === "emac.gob.ec");

  return (
    emac.clase === CLASES_ACTOR.INSTITUCION &&
    emac.claseOrigen === PROCEDENCIAS.UNIVERSO_DE_FUENTES
  );
});

t("APARECER NO ES VERIFICAR: nadie está verificado por analista", () =>
  ACTORES.metricas.verificadosPorAnalista === 0 &&
  ACTORES.actores.every((a) => a.certeza !== CERTEZAS.VERIFICADO_POR_ANALISTA));

t("COMPROBADO exige feed comprobado, no aparecer muchas veces", () => {
  const conFeed = construirUniversoDeActores({
    corpus: [{ ...CORPUS[0], evidenceId: "z" }],
    fichas: FICHAS
  }).actores[0];

  /*
    `emitterId` manda sobre `sourceId` al derivar la clave: si no
    se sobreescribe, este actor resolveria a la ficha de El
    Mercurio y la prueba pasaria por el motivo equivocado.
  */
  const sinFeed = construirUniversoDeActores({
    corpus: [
      {
        ...CORPUS[0],
        evidenceId: "y",
        sourceId: "otro.test",
        domain: "otro.test",
        emitterId: "otro.test"
      }
    ],
    fichas: FICHAS
  }).actores[0];

  return conFeed.certeza === CERTEZAS.COMPROBADO && sinFeed.certeza === CERTEZAS.DESCUBIERTO;
});

t("un dominio sin respaldo queda NO_CLASIFICADO", () => {
  const u = construirUniversoDeActores({
    corpus: [{ evidenceId: "q", sourceId: "raro.test", domain: "raro.test", providers: ["rss_directo"] }],
    fichas: FICHAS
  });

  return u.actores[0].clase === CLASES_ACTOR.NO_CLASIFICADO;
});

t("NO se infiere ningún atributo sensible", () => {
  const json = JSON.stringify(ACTORES);

  return (
    ACTORES.actores.every((a) => a.atributosSensibles === null) &&
    !/ideolog|afiliaci[óo]n|religi|etnia|orientaci[óo]n/i.test(json)
  );
});

t("cada actor declara su procedencia y sus evidencias", () =>
  ACTORES.actores.every(
    (a) => a.procedencia.length > 0 && a.evidenceIds.length === a.evidencias
  ));

t("primera y última observación se registran por actor", () =>
  ACTORES.actores.every((a) => a.primeraObservacion === T0 && a.ultimaObservacion === T0));


/* =========================================================
   5. AISLAMIENTO, VENTANAS Y NO-FALSA-TENDENCIA
   ========================================================= */

console.log("\n--- Aislamiento, ventanas e histórico ---\n");

await ta("el universo de actores de un proyecto no ve el de otro", async () => {
  const ledger = crearLedgerMemoria();

  await registrarPasada({
    ledger,
    evidencias: [{ evidenceId: "a1", title: "A", sourceId: "a.test", publisher: "A" }],
    estadoPrevio: new Map(),
    retrievedAt: T0,
    projectId: "proyecto-a"
  });

  await registrarPasada({
    ledger,
    evidencias: [{ evidenceId: "b1", title: "B", sourceId: "b.test", publisher: "B" }],
    estadoPrevio: new Map(),
    retrievedAt: T0,
    projectId: "proyecto-b"
  });

  const lineas = await ledger.leerTodos();

  const a = construirUniversoDeActores({
    corpus: [...reconstruirEstado(lineas, { projectId: "proyecto-a" }).values()],
    fichas: [],
    projectId: "proyecto-a"
  });

  const b = construirUniversoDeActores({
    corpus: [...reconstruirEstado(lineas, { projectId: "proyecto-b" }).values()],
    fichas: [],
    projectId: "proyecto-b"
  });

  return (
    a.actores.length === 1 &&
    b.actores.length === 1 &&
    a.actores[0].clave === "a.test" &&
    b.actores[0].clave === "b.test"
  );
});

t("un error de proveedor NO se convierte en cero resultados", () => {
  /*
    La matriz distingue el conector sin credencial —REQUIERE_
    PROVEEDOR— del conector que no existe —NO_DISPONIBLE— y de
    la dimension que nunca se probo —NO_PROBADO—. Ninguna dice
    «cero».
  */
  const web = MATRIZ.dimensiones.find((d) => d.dimension === "web_abierta");

  const com = MATRIZ.dimensiones.find((d) => d.dimension === "comentarios");

  return (
    web.estado === ESTADOS_COBERTURA.REQUIERE_PROVEEDOR &&
    /credencial|llave/i.test(web.porQue + web.queFalta) &&
    com.estado === ESTADOS_COBERTURA.NO_DISPONIBLE &&
    web.estado !== com.estado
  );
});

t("el histórico corto se declara PARCIAL, no OPERATIVO", () => {
  const h = MATRIZ.dimensiones.find((d) => d.dimension === "historico");

  return h.estado === ESTADOS_COBERTURA.PARCIAL && /empezó|corto/i.test(h.limitacion + h.porQue);
});

t("con tendencias declarables la dimensión sí sube a OPERATIVO", () => {
  const m = construirMatrizDeCobertura({
    corpus: CORPUS,
    fichas: FICHAS,
    motores: [],
    senales: { clasificadas: 1, descubiertas: 1 },
    tendencia: { conTendenciaDeclarable: 4 }
  });

  return m.dimensiones.find((d) => d.dimension === "tendencias").estado ===
    ESTADOS_COBERTURA.OPERATIVO;
});

t("la procedencia viaja en cada clasificación de alcance", () => {
  const c = clasificarAlcance({
    evidencia: { domain: "elmercurio.com.ec" },
    ubicacion: { unidadId: CUENCA, razones: ["topónimo «Cuenca» (+40)"] },
    indice: INDICE
  });

  return c.razones.length > 0 && c.fuente.sourceId === "elmercurio.com.ec";
});


/* =========================================================
   6. SIN RED Y LA RUTA COMPILA
   ========================================================= */

console.log("\n--- Sin red y ruta ---\n");

t("cero llamadas al fetch global", () => llamadasDeRed === 0);

globalThis.fetch = fetchOriginal;

await ta("routes/territorio.js compila con /cobertura conectado", async () => {
  const modulo = await import("../routes/territorio.js");

  return typeof modulo.default === "function";
});


/* --------------------------------------------------------- */

console.log("\n===========================================");
console.log(`PASS: ${pass}    FALL: ${fail}`);

if (fallos.length) {
  console.log("\nFallos:");
  fallos.forEach((f) => console.log(`  - ${f}`));
}

console.log("===========================================\n");

process.exit(fail > 0 ? 1 : 0);
