// apps/backend/tests/baselineT0.test.mjs

/*
===========================================================
PRUEBAS DE LA LINEA BASE T0 — P-CAND-BENCH-01
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/baselineT0.test.mjs

SIN RED. Fixtures sinteticos.

LAS TRES REGLAS QUE DEFIENDEN
-----------------------------------------------------------

1 · UN REPOST NO ENTRA EN LA MEDIA DE RENDIMIENTO PROPIO.
    Medido en X-REAL-01: sus likes valen 0 porque son del post
    original. Con la muestra real la media pasaba de 76 a 190.

2 · LAS VISTAS DE X Y LAS DE YOUTUBE NO SE SUMAN.
    No existe «audiencia total».

3 · NO_MEDIDO NO ES CERO.
    Un hueco nuestro no es un dato sobre esa persona.
===========================================================
*/

process.env.SENTINEL_LAKE_ADAPTER = "memoria";

const cb = await import("../services/intelligence/candidateBaseline.js");

const po = await import("../services/intelligence/publicationObservation.js");

const ps = await import("../services/projects/projectStore.js");

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


/* ---------------- FIXTURES ---------------- */

const T = "2026-08-28T12:00:00.000Z";

const met = (metrica, value) =>
  po.crearSnapshotDeMetrica({
    metrica,
    value,
    observedAt: T,
    provider: "prueba",
    source: "https://ejemplo.test/1"
  });

const pub = (over = {}) =>
  po.crearPublicacionObservada({
    candidateId: over.candidateId || "cand-a",
    accountId: over.accountId || "x:cuenta",
    platformId: over.platformId || "x",
    canonicalUrl: over.canonicalUrl || `https://x.com/c/status/${over.id || "1"}`,
    publishedAt: over.publishedAt || "2026-08-20T10:00:00.000Z",
    firstObservedAt: T,
    tipoPublicacion: over.tipo || po.TIPOS_PUBLICACION.ORIGINAL,
    evidenceId: over.evidenceId || `ev-${over.id || "1"}`,
    metricas: over.metricas || []
  });


/*
  La muestra real de X-REAL-01, simplificada: tres retweets con
  0 likes y dos originales.
*/
const MUESTRA_X = [
  pub({ id: "r1", tipo: po.TIPOS_PUBLICACION.REPOST, metricas: [met("likes", 0), met("views", 72), met("reposts", 7)] }),
  pub({ id: "r2", tipo: po.TIPOS_PUBLICACION.REPOST, metricas: [met("likes", 0), met("views", 74), met("reposts", 8)] }),
  pub({ id: "r3", tipo: po.TIPOS_PUBLICACION.REPOST, metricas: [met("likes", 0), met("views", 53), met("reposts", 5)] }),
  pub({ id: "o1", metricas: [met("likes", 35), met("views", 1216), met("comments", 1)] }),
  pub({ id: "o2", metricas: [met("likes", 346), met("views", 7007), met("comments", 0)] })
];


/*
===========================================================
1 · REPOSTS FUERA DE LOS PROMEDIOS
===========================================================
*/
bloque("un repost no contamina el rendimiento propio");

await t("los tipos se cuentan por separado", () => {
  const b = cb.baseDePlataforma(MUESTRA_X, "x");

  return (
    b.publicacionesObservadas === 5 &&
    b.porTipo.originales === 2 &&
    b.porTipo.reposts === 3
  );
});

/*
  EL NUMERO QUE JUSTIFICA TODO EL MODULO. Con los cinco: 76.
  Solo con los originales: 190,5.
*/
await t("la media de likes se calcula SOLO sobre originales", () => {
  const b = cb.baseDePlataforma(MUESTRA_X, "x");

  return b.rendimientoDeOriginales.likesMedia === 190.5;
});

await t("y NO es la media que saldria contando los repost", () => {
  const todas = MUESTRA_X.map((p) =>
    (p.metricas.find((m) => m.metrica === "likes") || {}).value
  );

  const mediaContaminada = todas.reduce((s, v) => s + v, 0) / todas.length;

  const b = cb.baseDePlataforma(MUESTRA_X, "x");

  return (
    Math.round(mediaContaminada) === 76 &&
    b.rendimientoDeOriginales.likesMedia !== mediaContaminada
  );
});

await t("las vistas de originales excluyen las de los repost", () => {
  const b = cb.baseDePlataforma(MUESTRA_X, "x");

  return b.rendimientoDeOriginales.viewsTotal === 1216 + 7007;
});

await t("los repost se cuentan aparte, como curacion", () => {
  const b = cb.baseDePlataforma(MUESTRA_X, "x");

  return (
    b.curacion.reposts === 3 &&
    b.curacion.viewsDeReposts === 72 + 74 + 53 &&
    b.curacion.nota.includes("NO se promedian")
  );
});

/*
  Encontrado con el expediente real: las publicaciones guardadas
  antes de que existiera `tipoPublicacion` no caian en ningun
  bucket. Se contaban en el total y desaparecian del desglose.
*/
await t("los buckets SIEMPRE suman el total observado", () => {
  const legado = [
    { ...pub({ id: "l1" }), tipoPublicacion: undefined },
    { ...pub({ id: "l2" }), tipoPublicacion: undefined }
  ];

  const b = cb.baseDePlataforma([...MUESTRA_X, ...legado], "x");

  const suma =
    b.porTipo.originales +
    b.porTipo.reposts +
    b.porTipo.replies +
    b.porTipo.quotes +
    b.porTipo.noDeterminado;

  return suma === b.publicacionesObservadas && b.porTipo.noDeterminado === 2;
});

await t("y una publicacion sin tipo se declara indeterminada, no original", () => {
  const legado = [{ ...pub({ id: "l3" }), tipoPublicacion: undefined }];

  const b = cb.baseDePlataforma(legado, "x");

  return (
    b.porTipo.originales === 0 &&
    b.tipoIndeterminado.publicaciones === 1 &&
    b.rendimientoDeOriginales.nota.includes("NO significa que el candidato no publique")
  );
});

await t("replies y quotes tambien van separados", () => {
  const conTodo = [
    ...MUESTRA_X,
    pub({ id: "rep", tipo: po.TIPOS_PUBLICACION.REPLY, metricas: [met("likes", 2)] }),
    pub({ id: "cit", tipo: po.TIPOS_PUBLICACION.QUOTE, metricas: [met("likes", 9)] })
  ];

  const b = cb.baseDePlataforma(conTodo, "x");

  return (
    b.porTipo.replies === 1 &&
    b.porTipo.quotes === 1 &&
    b.rendimientoDeOriginales.publicaciones === 2
  );
});


/*
===========================================================
2 · null NO ES CERO
===========================================================
*/
bloque("null no es cero");

await t("si ninguna publicacion trae la metrica, el total es null", () => {
  const b = cb.baseDePlataforma(
    [pub({ id: "s", metricas: [met("likes", 5)] })],
    "x"
  );

  return b.rendimientoDeOriginales.viewsTotal === null;
});

await t("pero un cero real si se conserva y se promedia", () => {
  const b = cb.baseDePlataforma(
    [
      pub({ id: "z1", metricas: [met("likes", 0)] }),
      pub({ id: "z2", metricas: [met("likes", 10)] })
    ],
    "x"
  );

  return b.rendimientoDeOriginales.likesMedia === 5;
});

await t("una metrica no disponible no entra en la suma", () => {
  const conAusente = pub({
    id: "a",
    metricas: [
      met("likes", 20),
      po.crearSnapshotDeMetrica({
        metrica: "views",
        value: null,
        observedAt: T,
        motivo: "la API no la incluyo"
      })
    ]
  });

  const b = cb.baseDePlataforma([conAusente], "x");

  return b.rendimientoDeOriginales.viewsTotal === null;
});


/*
===========================================================
3 · X Y YOUTUBE NO SE SUMAN
===========================================================
*/
bloque("las plataformas no se agregan entre si");

const MIXTO = [
  pub({ id: "x1", platformId: "x", metricas: [met("views", 1000)] }),
  pub({ id: "y1", platformId: "youtube", metricas: [met("views", 500)] })
];

await t("cada plataforma tiene su propia columna", () => {
  const bx = cb.baseDePlataforma(MIXTO, "x");

  const by = cb.baseDePlataforma(MIXTO, "youtube");

  return (
    bx.rendimientoDeOriginales.viewsTotal === 1000 &&
    by.rendimientoDeOriginales.viewsTotal === 500
  );
});

await t("no existe un total agregado y se dice por que", () => {
  const c = cb.baseDeCandidato({
    candidateId: "cand-a",
    cuentas: [
      { plataformaId: "x", handle: "a" },
      { plataformaId: "youtube", handle: "a" }
    ],
    publicaciones: MIXTO
  });

  return (
    c.totalAgregado === null &&
    c.notaTotalAgregado.includes("audiencia inventada")
  );
});

await t("el resultado serializado no contiene ninguna audiencia total", () => {
  const tabla = cb.lineaBaseT0([
    {
      candidateId: "cand-a",
      cuentas: [{ plataformaId: "x", handle: "a" }],
      publicaciones: MIXTO
    }
  ]);

  const texto = JSON.stringify(tabla).toLowerCase();

  return (
    !texto.includes("audienciatotal") &&
    !texto.includes("alcancetotal") &&
    !texto.includes("intencion de voto\":") &&
    tabla.candidatos[0].totalAgregado === null
  );
});


/*
===========================================================
4 · COBERTURA Y COMPARABILIDAD
===========================================================
*/
bloque("cobertura de medicion");

const CAND_X_Y = {
  candidateId: "cand-ambas",
  nombre: "Con X y YouTube",
  cuentas: [
    { plataformaId: "x", handle: "a" },
    { plataformaId: "youtube", handle: "a" },
    { plataformaId: "instagram", handle: "a" }
  ],
  publicaciones: [
    pub({ id: "x1", platformId: "x", candidateId: "cand-ambas", metricas: [met("views", 900)] }),
    pub({ id: "y1", platformId: "youtube", candidateId: "cand-ambas", metricas: [met("views", 400)] })
  ]
};

const CAND_SOLO_X = {
  candidateId: "cand-solo-x",
  nombre: "Solo X",
  cuentas: [{ plataformaId: "x", handle: "b" }],
  publicaciones: [
    pub({ id: "x2", platformId: "x", candidateId: "cand-solo-x", metricas: [met("views", 1500)] })
  ]
};

const CAND_SOLO_YT = {
  candidateId: "cand-solo-yt",
  nombre: "Solo YouTube",
  cuentas: [{ plataformaId: "youtube", handle: "c" }],
  publicaciones: [
    pub({ id: "y2", platformId: "youtube", candidateId: "cand-solo-yt", metricas: [met("views", 300)] })
  ]
};

const CAND_SIN_NADA = {
  candidateId: "cand-sin-nada",
  nombre: "Sin plataforma medible",
  cuentas: [{ plataformaId: "tiktok", handle: "d" }],
  publicaciones: []
};

await t("la cobertura se expresa en n de 5, no en porcentaje", () => {
  const c = cb.baseDeCandidato(CAND_X_Y);

  return (
    c.cobertura.expresion === "2/5 plataformas objetivo medidas" &&
    c.cobertura.porcentaje === null
  );
});

await t("y declara por que no hay porcentaje", () => {
  const c = cb.baseDeCandidato(CAND_X_Y);

  return c.cobertura.notaPorcentaje.includes("pesan igual");
});

await t("sin cuenta y no medido son estados distintos", () => {
  const c = cb.baseDeCandidato(CAND_X_Y);

  return (
    c.estados.facebook === cb.ESTADOS_PLATAFORMA_T0.SIN_CUENTA &&
    c.estados.instagram === cb.ESTADOS_PLATAFORMA_T0.NO_MEDIDO
  );
});

await t("un candidato sin plataforma medible no desaparece de la tabla", () => {
  const tabla = cb.lineaBaseT0([CAND_X_Y, CAND_SIN_NADA]);

  return (
    tabla.candidatos.length === 2 &&
    tabla.resumen.sinNingunaMedicion === 1
  );
});

await t("la cobertura declara que NO es popularidad", () => {
  const c = cb.baseDeCandidato(CAND_X_Y);

  return (
    c.cobertura.noEs.includes("NO es popularidad") &&
    c.cobertura.noEs.includes("solidez")
  );
});

bloque("comparabilidad");

await t("quien tiene las dos plataformas es COMPARABLE", () => {
  const tabla = cb.lineaBaseT0([CAND_X_Y, CAND_SOLO_X, CAND_SOLO_YT]);

  const a = tabla.candidatos.find((c) => c.candidateId === "cand-ambas");

  return a.comparabilidad.estado === cb.COMPARABILIDAD.COMPARABLE;
});

await t("quien tiene solo una es PARCIALMENTE_COMPARABLE, con motivo", () => {
  const tabla = cb.lineaBaseT0([CAND_X_Y, CAND_SOLO_X, CAND_SOLO_YT]);

  const b = tabla.candidatos.find((c) => c.candidateId === "cand-solo-x");

  return (
    b.comparabilidad.estado === cb.COMPARABILIDAD.PARCIALMENTE_COMPARABLE &&
    b.comparabilidad.motivo.includes("hueco de medicion")
  );
});

await t("quien no tiene ninguna es NO_COMPARABLE", () => {
  const tabla = cb.lineaBaseT0([CAND_X_Y, CAND_SIN_NADA]);

  const d = tabla.candidatos.find((c) => c.candidateId === "cand-sin-nada");

  return d.comparabilidad.estado === cb.COMPARABILIDAD.NO_COMPARABLE;
});


/*
===========================================================
5 · NI GANADOR NI MOMENTUM
===========================================================
*/
bloque("T0 no declara un ganador");

await t("las observaciones son por plataforma, nunca globales", () => {
  const tabla = cb.lineaBaseT0([CAND_X_Y, CAND_SOLO_X, CAND_SOLO_YT]);

  return (
    tabla.observaciones.every((o) => !!o.plataformaId) &&
    tabla.observaciones.every((o) =>
      o.noEs.toLowerCase().includes("no es un ranking")
    )
  );
});

await t("en X gana quien mas vistas tuvo, y solo en X", () => {
  const tabla = cb.lineaBaseT0([CAND_X_Y, CAND_SOLO_X]);

  const enX = tabla.observaciones.find((o) => o.plataformaId === "x");

  return (
    enX.mayorVolumenDeVistas.candidateId === "cand-solo-x" &&
    enX.lectura.includes("solo en x")
  );
});

await t("no existe ningun campo que declare un ganador global", () => {
  const tabla = cb.lineaBaseT0([CAND_X_Y, CAND_SOLO_X]);

  const texto = JSON.stringify(tabla).toLowerCase();

  return (
    !texto.includes("ganador") ||
    texto.includes("declarar un ganador")
  );
});

await t("momentum es HISTORICO_INSUFICIENTE en T0", () => {
  const tabla = cb.lineaBaseT0([CAND_X_Y]);

  return (
    tabla.momentum.disponible === false &&
    tabla.momentum.estado === "HISTORICO_INSUFICIENTE"
  );
});

await t("la advertencia de no-intencion-de-voto viaja con la tabla", () => {
  const tabla = cb.lineaBaseT0([CAND_X_Y]);

  return (
    tabla.advertencia.includes("No representa intencion de voto") &&
    tabla.prohibido.includes("declarar un ganador")
  );
});

await t("la foto no interviene en ninguna cifra", () => {
  const conFoto = cb.lineaBaseT0([
    { ...CAND_SOLO_X, foto: { url: "https://ejemplo.test/f.jpg" } }
  ]);

  const sinFoto = cb.lineaBaseT0([{ ...CAND_SOLO_X, foto: null }]);

  const limpiar = (t) =>
    JSON.stringify({ ...t.candidatos[0], foto: null, generadoEn: null });

  return limpiar(conFoto) === limpiar(sinFoto);
});


/*
===========================================================
6 · TRAZABILIDAD Y MUESTRA
===========================================================
*/
bloque("evidencias y tamano de muestra");

await t("cada cifra puede rastrearse hasta su publicacion", () => {
  const b = cb.baseDePlataforma(MUESTRA_X, "x");

  return (
    b.evidencias.length === 5 &&
    b.evidencias.every((e) => !!e.canonicalUrl && !!e.evidenceId && !!e.publicationId)
  );
});

await t("la evidencia declara el tipo de cada publicacion", () => {
  const b = cb.baseDePlataforma(MUESTRA_X, "x");

  return b.evidencias.filter((e) => e.tipoPublicacion === "REPOST").length === 3;
});

await t("el tamano de muestra se declara para poder compararlo", () => {
  const b = cb.baseDePlataforma(MUESTRA_X, "x");

  return b.tamanoDeMuestra === 5;
});


/*
===========================================================
7 · PERSISTENCIA Y AISLAMIENTO
===========================================================
*/
bloque("no se duplica y no se mezcla entre proyectos");

const P1 = "bench-p1";

const P2 = "bench-p2";

await ps.crearProyecto({ id: P1, nombre: "Uno", canton: "A", pais: "Ecuador", dignidad: "Alcaldía" });

await ps.crearProyecto({ id: P2, nombre: "Dos", canton: "B", pais: "Ecuador", dignidad: "Alcaldía" });

await ps.agregarCandidato(P1, { nombre: "Aspirante Bench" });

await ps.agregarCandidato(P2, { nombre: "Aspirante Bench" });

const CB = "aspirante-bench";

await t("una publicacion observada dos veces NO se duplica", async () => {
  const uno = pub({ id: "dup", metricas: [met("views", 100)] });

  await ps.guardarPublicaciones(P1, CB, [uno], { observadoEn: T });

  const dos = po.crearPublicacionObservada({
    ...uno,
    firstObservedAt: "2026-08-29T12:00:00.000Z",
    lastObservedAt: "2026-08-29T12:00:00.000Z",
    metricas: [
      po.crearSnapshotDeMetrica({
        metrica: "views",
        value: 180,
        observedAt: "2026-08-29T12:00:00.000Z",
        provider: "prueba"
      })
    ]
  });

  await ps.guardarPublicaciones(P1, CB, [dos], { observadoEn: "2026-08-29T12:00:00.000Z" });

  const lake = await ps.publicacionesDe(P1, CB);

  return lake.total === 1 && lake.publicaciones[0].metricas.length === 2;
});

await t("y conserva la PRIMERA observacion", async () => {
  const lake = await ps.publicacionesDe(P1, CB);

  return lake.publicaciones[0].firstObservedAt === T;
});

await t("el mismo nombre en otro proyecto no ve nada", async () => {
  const lake = await ps.publicacionesDe(P2, CB);

  return lake.total === 0;
});

await t("con dos observaciones la serie ya es comparable", async () => {
  const lake = await ps.publicacionesDe(P1, CB);

  const s = po.serieDeMetrica(lake.publicaciones[0], "views");

  return s.comparable === true && s.delta === 80;
});

await t("el tipo de publicacion sobrevive al Lake", async () => {
  const lake = await ps.publicacionesDe(P1, CB);

  return lake.publicaciones[0].tipoPublicacion === po.TIPOS_PUBLICACION.ORIGINAL;
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
