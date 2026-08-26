// apps/backend/tests/candidateIntelligence.test.mjs

/*
===========================================================
PRUEBAS DE CANDIDATE INTELLIGENCE V1
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/candidateIntelligence.test.mjs

SIN RED Y SIN CUOTA. Todo son fixtures sinteticos.

LO QUE ESTAS PRUEBAS DEFIENDEN
-----------------------------------------------------------

1 · UNA NUEVA INVESTIGACION NO BORRA HISTORIA.
    Es la unica garantia que hace posible cualquier pregunta
    sobre el pasado.

2 · EL NOMBRE NO CORROBORA.
    Una cuenta no pasa a corroborada por parecerse el nombre,
    por muchas senales dependientes que se acumulen.

3 · LA SOLIDEZ NO CAE PORQUE UN BUSCADOR FALLE.
    Es el defecto que la formula v2 corrige, y se prueba con la
    misma cuenta antes y despues de dejar de reencontrarse.

4 · DIEZ COPIAS NO SON DIEZ SENALES.
    Piezas, hechos y fuentes son tres cifras distintas.

5 · EL MOTOR NO DEPENDE DE NINGUN CANDIDATO.
    Dos candidatos ficticios e independientes, sin una sola
    constante especifica en el codigo.

Los nombres de los fixtures son inventados a proposito: si el
motor necesitara conocer a alguien concreto, estas pruebas
fallarian.
===========================================================
*/

process.env.SENTINEL_LAKE_ADAPTER = "memoria";

const res = await import("../services/intelligence/accountResolution.js");

const tl = await import("../services/intelligence/candidateTimeline.js");

const amp = await import("../services/intelligence/candidateAmplification.js");

const rel = await import("../services/intelligence/candidateRelations.js");

const dp = await import("../services/intelligence/digitalPresence.js");

const sol = await import("../services/intelligence/expedienteSolidez.js");

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


/*
===========================================================
FIXTURES

DOS CANDIDATOS FICTICIOS E INDEPENDIENTES.
===========================================================
*/

/* Candidato A: varias cuentas, una de ellas sin corroborar. */
const CANDIDATO_A = "cand-a";

/* Candidato B: una sola cuenta. */
const CANDIDATO_B = "cand-b";


const cuenta = (over = {}) => ({
  id: `${over.plataformaId || "instagram"}:${over.handle || "handle"}`,
  plataformaId: over.plataformaId || "instagram",
  plataforma: over.plataforma || "Instagram",
  handle: over.handle || "handle",
  url: over.url || `https://ejemplo.test/${over.handle || "handle"}`,
  estado: over.estado || "CONSOLIDADA",
  declaradaPorAnalista: over.declaradaPorAnalista === true,
  descubiertaPorSentinel: over.descubiertaPorSentinel !== false,
  correspondencia: over.correspondencia ?? null,
  proveedoresHistoricos: over.proveedoresHistoricos || [],
  proveedores: over.proveedores || [],
  corroboracion: over.corroboracion || null,
  vias: over.vias || [],
  profileBio: over.profileBio || null,
  firstSeenAt: over.firstSeenAt || null,
  lastSeenAt: over.lastSeenAt || null,
  lastCheckedAt: over.lastCheckedAt || null,
  seenInCurrentRun: over.seenInCurrentRun === true,
  ...over
});


/* Corroborada de verdad: dos proveedores por vias distintas. */
const CORROBORADA = cuenta({
  plataformaId: "instagram",
  handle: "cuenta_corroborada",
  correspondencia: 88,
  proveedoresHistoricos: ["serpapi", "duckduckgo"],
  corroboracion: { totalProveedores: 2, multiProveedor: true, multiVia: true },
  firstSeenAt: "2026-06-01T10:00:00.000Z",
  lastSeenAt: "2026-08-01T10:00:00.000Z",
  lastCheckedAt: "2026-08-01T10:00:00.000Z",
  seenInCurrentRun: true
});


/* Solo coincide el nombre: no puede pasar de CANDIDATA. */
const SOLO_NOMBRE = cuenta({
  plataformaId: "instagram",
  handle: "homonimo_posible",
  correspondencia: 96,
  proveedoresHistoricos: ["serpapi"],
  corroboracion: { totalProveedores: 1, multiProveedor: false, multiVia: false },
  firstSeenAt: "2026-08-01T10:00:00.000Z",
  lastSeenAt: "2026-08-01T10:00:00.000Z",
  lastCheckedAt: "2026-08-01T10:00:00.000Z",
  seenInCurrentRun: true
});


/* Declarada por el analista y sin nada mas. */
const DECLARADA = cuenta({
  plataformaId: "tiktok",
  plataforma: "TikTok",
  handle: "declarada_por_analista",
  declaradaPorAnalista: true,
  descubiertaPorSentinel: false,
  estado: "DECLARADA_POR_ANALISTA",
  declaredAt: "2026-07-15T09:00:00.000Z"
});


/* Estaba en el inventario y esta vez no se vio. */
const NO_REENCONTRADA = cuenta({
  plataformaId: "x",
  plataforma: "X",
  handle: "no_reencontrada",
  estado: "NO_REENCONTRADA_EN_ULTIMA_VERIFICACION",
  correspondencia: 74,
  proveedoresHistoricos: ["serpapi", "brave"],
  corroboracion: { totalProveedores: 2, multiProveedor: true, multiVia: true },
  firstSeenAt: "2026-05-01T10:00:00.000Z",
  lastSeenAt: "2026-07-01T10:00:00.000Z",
  lastCheckedAt: "2026-08-20T10:00:00.000Z",
  seenInCurrentRun: false
});


/*
===========================================================
1 · ACCOUNT RESOLUTION
===========================================================
*/
bloque("account resolution: el nombre no corrobora");

await t("una cuenta con dos proveedores y dos vias queda CORROBORADA o CONSOLIDADA", () => {
  const r = res.resolverCuenta(CORROBORADA, { candidateId: CANDIDATO_A });

  return (
    (r.estado === res.ESTADOS_RESOLUCION.CORROBORADA ||
      r.estado === res.ESTADOS_RESOLUCION.CONSOLIDADA) &&
    r.solidez.senalesIndependientes.includes("multi_proveedor_multi_via")
  );
});

await t("observada en dos momentos distintos: CONSOLIDADA, no solo CORROBORADA", () => {
  const r = res.resolverCuenta(CORROBORADA, { candidateId: CANDIDATO_A });

  return r.estado === res.ESTADOS_RESOLUCION.CONSOLIDADA;
});

await t("correspondencia 96/100 sin senal independiente NO pasa de CANDIDATA", () => {
  const r = res.resolverCuenta(SOLO_NOMBRE, { candidateId: CANDIDATO_A });

  return r.estado === res.ESTADOS_RESOLUCION.CANDIDATA;
});

await t("y su solidez de atribucion es 0 aunque el nombre coincida casi al 100", () => {
  const r = res.resolverCuenta(SOLO_NOMBRE, { candidateId: CANDIDATO_A });

  return r.solidez.valor === 0;
});

await t("la coincidencia de nombre SE REGISTRA, marcada como no independiente", () => {
  const r = res.resolverCuenta(SOLO_NOMBRE, { candidateId: CANDIDATO_A });

  const s = r.senales.find((x) => x.id === "coincidencia_nombre");

  return !!s && s.independiente === false;
});

await t("un solo proveedor sin multivia NO cuenta como corroboracion", () => {
  const s = res.senalesDeCuenta(SOLO_NOMBRE, {});

  return !s.some((x) => x.id === "multi_proveedor_multi_via");
});

await t("la declaracion del analista no corrobora: no es senal independiente", () => {
  const r = res.resolverCuenta(DECLARADA, { candidateId: CANDIDATO_A });

  return (
    r.estado === res.ESTADOS_RESOLUCION.DECLARADA &&
    r.solidez.senalesIndependientes.length === 0
  );
});

await t("pero la declaracion SI se conserva como procedencia", () => {
  const r = res.resolverCuenta(DECLARADA, { candidateId: CANDIDATO_A });

  return (
    r.procedencia.declaradaPorAnalista === true &&
    r.procedencia.corroboradaPorSentinel === false
  );
});

await t("una biografia que solo repite el nombre no aporta senal independiente", () => {
  const c = cuenta({
    handle: "bio_vacia",
    profileBio: "Ana Ruiz",
    correspondencia: 90
  });

  const s = res.senalesDeCuenta(c, { anclasIdentidad: ["concejal de prueba"] });

  return !s.some((x) => x.id === "bio_publica");
});

await t("una biografia que declara el cargo SI aporta senal independiente", () => {
  const c = cuenta({
    handle: "bio_con_cargo",
    profileBio: "Concejal de Prueba por el canton ficticio",
    correspondencia: 90
  });

  const s = res.senalesDeCuenta(c, { anclasIdentidad: ["Concejal de Prueba"] });

  return s.some((x) => x.id === "bio_publica" && x.independiente === true);
});

await t("un enlace desde la web declarada aporta senal independiente", () => {
  const c = cuenta({ handle: "enlazada", correspondencia: 70 });

  const r = res.resolverCuenta(c, {
    enlacesCruzados: [{ desde: "web", hacia: c.id }]
  });

  return (
    r.solidez.senalesIndependientes.includes("web_declarada") &&
    r.estado !== res.ESTADOS_RESOLUCION.CANDIDATA
  );
});

await t("NO_REENCONTRADA no se convierte en descartada", () => {
  const r = res.resolverCuenta(NO_REENCONTRADA, { candidateId: CANDIDATO_A });

  return (
    r.estado !== res.ESTADOS_RESOLUCION.DESCARTADA &&
    r.observacion.noReencontradaEnLaUltimaVerificacion === true
  );
});

await t("y conserva su corroboracion: la ausencia de observacion no la borra", () => {
  const r = res.resolverCuenta(NO_REENCONTRADA, { candidateId: CANDIDATO_A });

  return r.solidez.senalesIndependientes.includes("multi_proveedor_multi_via");
});

await t("una revocada por el analista queda DESCARTADA y no se recupera por senales", () => {
  const r = res.resolverCuenta(
    { ...CORROBORADA, estado: "REVOCADA" },
    { candidateId: CANDIDATO_A }
  );

  return r.estado === res.ESTADOS_RESOLUCION.DESCARTADA;
});

await t("dos cuentas con el mismo id en la misma plataforma quedan DUDOSAS", () => {
  const c = cuenta({ handle: "colision", correspondencia: 80 });

  const r = res.resolverCuentasDelCandidato({
    candidateId: CANDIDATO_A,
    cuentas: [c, { ...c }]
  });

  return r.cuentas.every((x) => x.estado === res.ESTADOS_RESOLUCION.DUDOSA);
});

bloque("account resolution: varias cuentas en la misma plataforma");

await t("dos cuentas distintas de Instagram se declaran, no se corrigen", () => {
  const r = res.resolverCuentasDelCandidato({
    candidateId: CANDIDATO_A,
    cuentas: [CORROBORADA, SOLO_NOMBRE]
  });

  const m = r.resumen.multiplesPorPlataforma.find(
    (x) => x.plataformaId === "instagram"
  );

  return !!m && m.cuentas.length === 2 && r.cuentas.length === 2;
});

await t("y ninguna hereda la corroboracion de la otra", () => {
  const r = res.resolverCuentasDelCandidato({
    candidateId: CANDIDATO_A,
    cuentas: [CORROBORADA, SOLO_NOMBRE]
  });

  const dudosa = r.cuentas.find((x) => x.handle === "homonimo_posible");

  return dudosa.estado === res.ESTADOS_RESOLUCION.CANDIDATA;
});

await t("el accountId es estable: plataforma + handle normalizado", () => {
  const a = res.idDeCuenta({ plataformaId: "TikTok", handle: "MiHandle" });

  const b = res.idDeCuenta({ plataformaId: "tiktok", handle: "mihandle" });

  return a === b && a === "tiktok:mihandle";
});

await t("el modulo declara por escrito lo que se prohibe", () => {
  const r = res.resolverCuentasDelCandidato({ cuentas: [] });

  return (
    r.prohibido.includes("reconocimiento facial") &&
    r.prohibido.includes("corroborar por similitud de nombre")
  );
});

await t("ningun modulo de resolucion importa una libreria de vision", async () => {
  const { readFile } = await import("node:fs/promises");

  const src = await readFile(
    new URL("../services/intelligence/accountResolution.js", import.meta.url),
    "utf8"
  );

  const prohibidas = ["face-api", "tensorflow", "opencv", "rekognition"];

  return !prohibidas.some((p) => src.includes(p));
});


/*
===========================================================
2 · SOLIDEZ DEL EXPEDIENTE
===========================================================
*/
bloque("solidez: no cae porque un buscador falle");

const INVENTARIO = [
  {
    plataformaId: "instagram",
    estado: "CONSOLIDADA",
    senalesIndependientes: ["multi_proveedor_multi_via"],
    proveedoresHistoricos: ["serpapi", "duckduckgo"],
    firstSeenAt: "2026-06-01T10:00:00.000Z",
    lastSeenAt: "2026-08-01T10:00:00.000Z",
    lastCheckedAt: "2026-08-01T10:00:00.000Z",
    seenInCurrentRun: true
  },
  {
    plataformaId: "tiktok",
    estado: "CONSOLIDADA",
    senalesIndependientes: ["web_declarada"],
    proveedoresHistoricos: ["serpapi"],
    firstSeenAt: "2026-06-01T10:00:00.000Z",
    lastSeenAt: "2026-08-01T10:00:00.000Z",
    lastCheckedAt: "2026-08-01T10:00:00.000Z",
    seenInCurrentRun: true
  }
];

/* La MISMA identidad, pero el buscador no devolvio una cuenta. */
const TRAS_FALLO_DE_BUSCADOR = INVENTARIO.map((c, i) =>
  i === 0
    ? {
        ...c,
        estado: "NO_REENCONTRADA_EN_ULTIMA_VERIFICACION",
        lastCheckedAt: "2026-08-25T10:00:00.000Z",
        seenInCurrentRun: false
      }
    : c
);

await t("la solidez de identidad es IDENTICA antes y despues del fallo", () => {
  const antes = sol.solidezDeIdentidad(INVENTARIO).valor;

  const despues = sol.solidezDeIdentidad(TRAS_FALLO_DE_BUSCADOR).valor;

  return antes === despues && antes > 0;
});

await t("ningun componente de la solidez depende de la ultima ejecucion", () => {
  const s = sol.solidezDeIdentidad(INVENTARIO);

  return s.componentes.every((c) => c.dependeDeLaUltimaEjecucion === false);
});

await t("la reencontrabilidad SI baja, y es una metrica aparte", () => {
  const antes = sol.reencontrabilidadActual(INVENTARIO).valor;

  const despues = sol.reencontrabilidadActual(TRAS_FALLO_DE_BUSCADOR).valor;

  return antes === 100 && despues === 50;
});

await t("la reencontrabilidad declara que mide a los proveedores, no al candidato", () => {
  const r = sol.reencontrabilidadActual(INVENTARIO);

  return (
    r.advertencia.includes("PROVEEDORES") &&
    r.advertencia.includes("no es evidencia de ausencia")
  );
});

await t("sin verificacion la reencontrabilidad es null, no 0", () => {
  const r = sol.reencontrabilidadActual([
    { plataformaId: "web", estado: "CONSOLIDADA" }
  ]);

  return r.valor === null && r.motivo.includes("null");
});

await t("una cuenta revocada no entra en la solidez", () => {
  const conRevocada = [
    ...INVENTARIO,
    { plataformaId: "x", estado: "REVOCADA", proveedoresHistoricos: ["serpapi"] }
  ];

  return (
    sol.solidezDeIdentidad(conRevocada).valor ===
    sol.solidezDeIdentidad(INVENTARIO).valor
  );
});

await t("la formula esta documentada y dice que no es un score politico", () => {
  const s = sol.solidezDeIdentidad(INVENTARIO);

  return (
    typeof s.formula === "string" &&
    s.formula.includes("INVENTARIO CONSOLIDADO") &&
    s.noEs.some((n) => n.includes("score politico"))
  );
});

await t("las dos metricas se devuelven juntas pero separadas", () => {
  const s = sol.solidezDelExpediente(INVENTARIO);

  return (
    s.identidad.valor > 0 &&
    s.reencontrabilidad.valor === 100 &&
    s.relacion.includes("independientes")
  );
});

await t("un expediente sin historia medible no finge persistencia", () => {
  const s = sol.solidezDeIdentidad([
    { plataformaId: "web", estado: "CONSOLIDADA", proveedoresHistoricos: ["x"] }
  ]);

  const p = s.componentes.find((c) => c.id === "persistencia");

  return p.valor === 0 && p.detalle.includes("historia medible");
});


/*
===========================================================
3 · VENTANAS E HISTORICO
===========================================================
*/
bloque("ventanas: historico insuficiente en lugar de tendencia inventada");

const snap = (cuando, followers = null) => ({
  capturedAt: cuando,
  followers,
  postsObserved: null,
  platform: "web"
});

await t("una sola observacion NO produce tendencia: historico insuficiente", () => {
  const v = tl.ventanaDeSnapshots(
    [snap("2026-08-24T10:00:00.000Z")],
    7,
    new Date("2026-08-25T10:00:00.000Z")
  );

  return (
    v.estado === tl.ESTADOS_VENTANA.HISTORICO_INSUFICIENTE &&
    v.delta === null &&
    v.comparable === false
  );
});

await t("cero observaciones NO se leen como actividad cero", () => {
  const v = tl.ventanaDeSnapshots([], 7, new Date("2026-08-25T10:00:00.000Z"));

  return (
    v.estado === tl.ESTADOS_VENTANA.SIN_OBSERVACIONES &&
    v.motivo.includes("dice que no observamos")
  );
});

await t("dos observaciones ya son comparables", () => {
  const v = tl.ventanaDeSnapshots(
    [snap("2026-08-20T10:00:00.000Z"), snap("2026-08-24T10:00:00.000Z")],
    7,
    new Date("2026-08-25T10:00:00.000Z")
  );

  return v.estado === tl.ESTADOS_VENTANA.COMPARABLE && v.comparable === true;
});

await t("un delta con una metrica ausente en un extremo es null, no un numero", () => {
  const v = tl.ventanaDeSnapshots(
    [snap("2026-08-20T10:00:00.000Z", null), snap("2026-08-24T10:00:00.000Z", 500)],
    7,
    new Date("2026-08-25T10:00:00.000Z")
  );

  return v.delta.followers === null;
});

await t("un delta con la metrica en los dos extremos si se calcula", () => {
  const v = tl.ventanaDeSnapshots(
    [snap("2026-08-20T10:00:00.000Z", 400), snap("2026-08-24T10:00:00.000Z", 500)],
    7,
    new Date("2026-08-25T10:00:00.000Z")
  );

  return v.delta.followers === 100;
});

await t("las cuatro ventanas existen: 7d, 30d, 90d y campana", () => {
  const v = tl.ventanasDe([snap("2026-08-24T10:00:00.000Z")]);

  return (
    v.length === 4 &&
    v.map((x) => x.id).join(",") === "7d,30d,90d,campana" &&
    v[3].dias === null
  );
});

await t("la ventana de 7 dias excluye lo anterior y la de 90 lo incluye", () => {
  const serie = [snap("2026-06-01T10:00:00.000Z"), snap("2026-08-24T10:00:00.000Z")];

  const ahora = new Date("2026-08-25T10:00:00.000Z");

  return (
    tl.ventanaDeSnapshots(serie, 7, ahora).observaciones === 1 &&
    tl.ventanaDeSnapshots(serie, 90, ahora).observaciones === 2
  );
});

bloque("inventario: aparecidas y ausentes, nunca 'dadas de baja'");

await t("comparar dos fotos detecta lo que aparecio y lo que no consta", () => {
  const a = tl.crearSnapshotDeIdentidad({
    candidateId: CANDIDATO_A,
    capturedAt: "2026-08-01T10:00:00.000Z",
    cuentas: [{ accountId: "instagram:uno", estado: "CONSOLIDADA" }]
  });

  const b = tl.crearSnapshotDeIdentidad({
    candidateId: CANDIDATO_A,
    capturedAt: "2026-08-20T10:00:00.000Z",
    cuentas: [{ accountId: "tiktok:dos", estado: "CORROBORADA" }]
  });

  const d = tl.compararInventarios(a, b);

  return (
    d.aparecidas.length === 1 &&
    d.aparecidas[0] === "tiktok:dos" &&
    d.ausentesDelInventario.length === 1 &&
    d.ausentesDelInventario[0] === "instagram:uno"
  );
});

await t("y lo dice sin llamarlo desaparicion ni baja", () => {
  const d = tl.compararInventarios(null, null);

  return (
    Object.hasOwn(d, "ausentesDelInventario") &&
    !Object.hasOwn(d, "desaparecidas") &&
    d.nota.includes("no significa que la cuenta se haya cerrado")
  );
});

await t("los cambios de estado de las cuentas que permanecen se registran", () => {
  const a = tl.crearSnapshotDeIdentidad({
    candidateId: CANDIDATO_A,
    capturedAt: "2026-08-01T10:00:00.000Z",
    cuentas: [{ accountId: "instagram:uno", estado: "CANDIDATA" }]
  });

  const b = tl.crearSnapshotDeIdentidad({
    candidateId: CANDIDATO_A,
    capturedAt: "2026-08-20T10:00:00.000Z",
    cuentas: [{ accountId: "instagram:uno", estado: "CORROBORADA" }]
  });

  const d = tl.compararInventarios(a, b);

  return (
    d.cambiosDeEstado.length === 1 &&
    d.cambiosDeEstado[0].desde === "CANDIDATA" &&
    d.cambiosDeEstado[0].hasta === "CORROBORADA"
  );
});

bloque("procedencia temporal: no fingir vigilancia retroactiva");

await t("una pieza de agosto recuperada en octubre NO se observo en agosto", () => {
  const p = tl.procedenciaTemporal({
    recuperadaEn: "2026-10-05T10:00:00.000Z",
    fechaDeclaradaPorLaFuente: "2026-08-10T10:00:00.000Z"
  });

  return (
    p.procedencia === tl.PROCEDENCIAS_TEMPORALES.EVIDENCIA_HISTORICA_RECUPERADA &&
    p.firstObservedBySentinel === "2026-10-05T10:00:00.000Z"
  );
});

await t("y la fecha de la fuente se conserva aparte, sin sustituir a la nuestra", () => {
  const p = tl.procedenciaTemporal({
    recuperadaEn: "2026-10-05T10:00:00.000Z",
    fechaDeclaradaPorLaFuente: "2026-08-10T10:00:00.000Z"
  });

  return (
    p.fechaDeclaradaPorLaFuente === "2026-08-10T10:00:00.000Z" &&
    p.firstObservedBySentinel !== p.fechaDeclaradaPorLaFuente
  );
});

await t("una pieza del dia se marca como observada en directo", () => {
  const p = tl.procedenciaTemporal({
    recuperadaEn: "2026-08-25T18:00:00.000Z",
    fechaDeclaradaPorLaFuente: "2026-08-25T09:00:00.000Z"
  });

  return p.procedencia === tl.PROCEDENCIAS_TEMPORALES.OBSERVADA_POR_SENTINEL;
});


/*
===========================================================
4 · AMPLIFICACION
===========================================================
*/
bloque("amplificacion: diez copias no son diez senales");

const CUENTAS_A = [
  {
    id: "instagram:cuenta_a",
    plataformaId: "instagram",
    handle: "cuenta_a",
    url: "https://www.instagram.com/cuenta_a"
  }
];

/* Cuatro cabeceras replicando la misma nota, y una nota distinta. */
const REPLICA = [
  {
    id: "e1",
    titulo: "El aspirante presenta su plan de movilidad urbana",
    url: "https://diarioficticio-uno.test/nota-1",
    fecha: "2026-08-20"
  },
  {
    id: "e2",
    titulo: "El aspirante presenta su plan de movilidad urbana",
    url: "https://diarioficticio-dos.test/nota-2",
    fecha: "2026-08-20"
  },
  {
    id: "e3",
    titulo: "El aspirante presenta su plan de movilidad urbana hoy",
    url: "https://diarioficticio-tres.test/nota-3",
    fecha: "2026-08-20"
  },
  {
    id: "e4",
    titulo: "El aspirante presenta su plan de movilidad urbana",
    url: "https://diarioficticio-cuatro.test/nota-4",
    fecha: "2026-08-21"
  },
  {
    id: "e5",
    titulo: "Debate ciudadano sobre el presupuesto participativo",
    url: "https://otroportalficticio.test/nota-5",
    fecha: "2026-08-22"
  }
];

await t("cinco piezas replicadas son dos hechos distintos", () => {
  const a = amp.amplificacionDeCandidato({ evidencias: REPLICA, cuentas: CUENTAS_A });

  return a.ganada.piezas === 5 && a.ganada.hechosDistintos === 2;
});

await t("y cinco fuentes distintas: las tres cifras no se confunden", () => {
  const a = amp.amplificacionDeCandidato({ evidencias: REPLICA, cuentas: CUENTAS_A });

  return a.ganada.fuentesDistintas === 5 && a.ganada.piezasQueSonReplica === 3;
});

await t("la interpretacion dice en palabras que las replicas no son senales", () => {
  const a = amp.amplificacionDeCandidato({ evidencias: REPLICA, cuentas: CUENTAS_A });

  return a.ganada.interpretacion.includes("NO cuentan como senales independientes");
});

await t("una pieza de una cuenta del candidato es PROPIA, no ganada", () => {
  const a = amp.amplificacionDeCandidato({
    evidencias: [
      {
        id: "p1",
        titulo: "Publicacion propia",
        url: "https://www.instagram.com/cuenta_a/p/xyz"
      }
    ],
    cuentas: CUENTAS_A
  });

  return a.propia.piezas === 1 && a.ganada.piezas === 0;
});

await t("otro perfil del mismo dominio NO se cuenta como propio", () => {
  const a = amp.amplificacionDeCandidato({
    evidencias: [
      {
        id: "p2",
        titulo: "Perfil de otra persona",
        url: "https://www.instagram.com/otra_persona/"
      }
    ],
    cuentas: CUENTAS_A
  });

  return a.propia.piezas === 0 && a.ganada.piezas === 1;
});

await t("una pieza sin URL queda indeterminada, no ganada", () => {
  const a = amp.amplificacionDeCandidato({
    evidencias: [{ id: "p3", titulo: "Sin enlace" }],
    cuentas: CUENTAS_A
  });

  return a.indeterminadas.piezas === 1 && a.ganada.piezas === 0;
});

await t("sin piezas propias se declara el limite de fuentes, no la inactividad", () => {
  const a = amp.amplificacionDeCandidato({ evidencias: REPLICA, cuentas: CUENTAS_A });

  return a.propia.advertencia.includes("no la actividad del candidato");
});

await t("las piezas NUNCA se expresan en personas", () => {
  const a = amp.amplificacionDeCandidato({ evidencias: REPLICA, cuentas: CUENTAS_A });

  return a.personas === null && a.notaPersonas.includes("no se deduce N ciudadanos");
});

await t("sin corpus se dice que no hay corpus, no que no haya amplificacion", () => {
  const a = amp.amplificacionDeCandidato({ evidencias: [], cuentas: CUENTAS_A });

  return a.corpus.nota.includes("No hay corpus de evidencias");
});

await t("los medios se cuentan en dominios distintos", () => {
  const a = amp.amplificacionDeCandidato({ evidencias: REPLICA, cuentas: CUENTAS_A });

  return a.ganada.medios.dominiosDistintos === 5;
});

bloque("conversacion: cuatro planos y ninguna persona");

await t("los cuatro planos existen y se cuentan por separado", () => {
  const c = amp.separarConversacion({ evidencias: REPLICA, cuentas: CUENTAS_A });

  return (
    c.planos.length === 4 &&
    c.planos.map((p) => p.clave).join(",") ===
      "candidato,medios,otros_actores,conversacion"
  );
});

await t("ningun plano expone un recuento de personas", () => {
  const c = amp.separarConversacion({ evidencias: REPLICA, cuentas: CUENTAS_A });

  return c.planos.every((p) => p.personas === null);
});

await t("la prohibicion de convertir piezas en ciudadanos esta escrita", () => {
  const c = amp.separarConversacion({ evidencias: [], cuentas: [] });

  return (
    c.prohibicion.startsWith("Ninguna de estas cifras") &&
    c.prohibicion.includes("expresar en personas")
  );
});

await t("una pieza propia cae en el plano del candidato", () => {
  const c = amp.separarConversacion({
    evidencias: [
      { id: "x", titulo: "Propia", url: "https://www.instagram.com/cuenta_a/p/1" }
    ],
    cuentas: CUENTAS_A
  });

  return c.planos[0].piezasObservadas === 1;
});


/*
===========================================================
5 · RELACIONES, MEDIOS Y TERRITORIO
===========================================================
*/
bloque("relaciones observables");

await t("una nota de un portal produce una arista con su evidencia", () => {
  const r = rel.relacionesDeEvidencias({
    evidencias: [REPLICA[0]],
    candidateId: CANDIDATO_A,
    cuentas: CUENTAS_A
  });

  return (
    r.total === 1 &&
    r.relaciones[0].evidenceIds.length === 1 &&
    r.relaciones[0].target === `candidato:${CANDIDATO_A}`
  );
});

await t("una pieza propia no genera relacion con uno mismo", () => {
  const r = rel.relacionesDeEvidencias({
    evidencias: [
      { id: "p", titulo: "Propia", url: CUENTAS_A[0].url }
    ],
    candidateId: CANDIDATO_A,
    cuentas: CUENTAS_A
  });

  return r.total === 0;
});

await t("una evidencia sin URL se descarta con su motivo", () => {
  const r = rel.relacionesDeEvidencias({
    evidencias: [{ id: "n", titulo: "Sin enlace" }],
    candidateId: CANDIDATO_A,
    cuentas: []
  });

  return r.total === 0 && r.descartadas.length === 1;
});

await t("cada arista lleva la advertencia de que no es una relacion real", () => {
  const r = rel.relacionesDeEvidencias({
    evidencias: [REPLICA[0]],
    candidateId: CANDIDATO_A,
    cuentas: []
  });

  return r.relaciones[0].advertencia.includes("No describen alianzas");
});

await t("la confianza es null y se explica por que no hay nada que estimar", () => {
  const r = rel.relacionesDeEvidencias({
    evidencias: [REPLICA[0]],
    candidateId: CANDIDATO_A,
    cuentas: []
  });

  return (
    r.relaciones[0].confidence === null &&
    r.relaciones[0].explicacionConfidence.includes("No hay nada que estimar")
  );
});

await t("lo que no se puede observar sin API se declara como no implementado", () => {
  const r = rel.relacionesDeEvidencias({ evidencias: [], candidateId: CANDIDATO_A });

  return r.noImplementado.length >= 3;
});

bloque("contrato con Media Intelligence");

await t("el contrato existe y declara que hoy no esta disponible", () => {
  return (
    rel.CONTRATO_MEDIA_RELATION.disponibleHoy === false &&
    rel.CONTRATO_MEDIA_RELATION.estado === "CONTRATO_DEFINIDO_SIN_IMPLEMENTAR"
  );
});

await t("un payload sin evidenceIds no cumple el contrato", () => {
  const v = rel.validarPayloadDeMedios({ mediaId: "m1", piezas: 4, evidenceIds: [] });

  return v.valido === false && v.faltan.some((f) => f.includes("evidenceIds"));
});

await t("un payload completo si lo cumple", () => {
  const v = rel.validarPayloadDeMedios({
    mediaId: "m1",
    piezas: 4,
    evidenceIds: ["a", "b"]
  });

  return v.valido === true;
});

await t("el contrato exige piezas deduplicadas", () => {
  return rel.CONTRATO_MEDIA_RELATION.reglas.some((r) =>
    r.includes("deduplicadas")
  );
});

bloque("territorio: solo lo que GEO-1 autoriza");

await t("sin contrato de GEO-1 no se vincula nada", () => {
  const v = rel.vincularEvidenciaATerritorio({
    candidateId: CANDIDATO_A,
    evidenceId: "e1",
    geo: null
  });

  return v.vinculado === false && v.territoryId === null;
});

await t("un metodo prohibido se rechaza por su nombre", () => {
  const v = rel.vincularEvidenciaATerritorio({
    candidateId: CANDIDATO_A,
    evidenceId: "e1",
    geo: { metodo: "ip", unidad: { unidadId: "u1", resolucion: "canton" } }
  });

  return v.vinculado === false && v.motivo.includes("metodo prohibido");
});

await t("los cinco metodos prohibidos estan declarados", () => {
  return (
    rel.METODOS_PROHIBIDOS.includes("ip") &&
    rel.METODOS_PROHIBIDOS.includes("dispositivo") &&
    rel.METODOS_PROHIBIDOS.includes("usuario")
  );
});

await t("una unidad que no autoriza atribucion se rechaza", () => {
  const v = rel.vincularEvidenciaATerritorio({
    candidateId: CANDIDATO_A,
    evidenceId: "e1",
    geo: {
      metodo: "mencion_textual",
      unidad: { unidadId: "top-1", resolucion: "toponimo", resolucionMaximaAutorizada: null }
    }
  });

  return v.vinculado === false && v.motivo.includes("no autoriza atribucion");
});

await t("una unidad valida si se vincula, y ubica la pieza no a la persona", () => {
  const v = rel.vincularEvidenciaATerritorio({
    candidateId: CANDIDATO_A,
    evidenceId: "e1",
    geo: {
      metodo: "geometria_oficial",
      unidad: { unidadId: "canton-ficticio", resolucion: "canton" }
    }
  });

  return (
    v.vinculado === true &&
    v.territoryId === "canton-ficticio" &&
    v.nota.includes("ubica la PIEZA")
  );
});

await t("un lote sin geo declara el limite en lugar de fabricar cobertura", () => {
  const v = rel.vincularLote({ candidateId: CANDIDATO_A, evidencias: REPLICA });

  return v.total === 0 && v.nota.includes("seria inventar cobertura territorial");
});


/*
===========================================================
6 · PRESENCIA DIGITAL OBSERVADA
===========================================================
*/
bloque("presencia: dimensiones si, indice no");

await t("el indice compuesto es NO_DISPONIBLE y su valor null", () => {
  const i = dp.indiceCompuesto();

  return i.disponible === false && i.valor === null && i.estado === "NO_DISPONIBLE";
});

await t("y enumera los cinco requisitos que faltan", () => {
  const i = dp.indiceCompuesto();

  return i.requisitos.length === 5 && i.pendientes === 5;
});

await t("la etiqueta de interfaz es PRESENCIA DIGITAL OBSERVADA", () => {
  return dp.ETIQUETA_UI === "PRESENCIA DIGITAL OBSERVADA";
});

await t("lo que no significa esta declarado, incluida la intencion de voto", () => {
  return (
    dp.NO_SIGNIFICA.includes("intencion de voto") &&
    dp.NO_SIGNIFICA.includes("apoyo ciudadano") &&
    dp.NO_SIGNIFICA.includes("popularidad")
  );
});

await t("el vocabulario prohibido incluye influencia electoral", () => {
  const p = dp.presenciaDigitalObservada({});

  return p.vocabularioProhibido.includes("influencia electoral");
});

await t("las seis dimensiones existen y cada una declara su metodologia", () => {
  const d = dp.dimensionesDePresencia({});

  return d.length === 6 && d.every((x) => typeof x.metodologia === "string");
});

await t("una dimension sin insumo vale null y explica por que, no 0", () => {
  const d = dp.dimensionesDePresencia({});

  const a = d.find((x) => x.id === "actividad_propia");

  return a.valor === null && a.observable === false && !!a.motivoNoDisponible;
});

await t("con corpus, amplificacion y cobertura pasan a ser observables", () => {
  const a = amp.amplificacionDeCandidato({ evidencias: REPLICA, cuentas: CUENTAS_A });

  const d = dp.dimensionesDePresencia({
    amplificacion: a,
    conversacion: amp.separarConversacion({ evidencias: REPLICA, cuentas: CUENTAS_A }),
    evidencias: REPLICA,
    snapshots: []
  });

  const ext = d.find((x) => x.id === "amplificacion_externa");

  const cob = d.find((x) => x.id === "cobertura_mediatica");

  return ext.valor === 2 && cob.valor === 5;
});

await t("la declaracion OBSERVED-PRESENCE-01 esta escrita en el motor", () => {
  return (
    dp.DECLARACION.id === "OBSERVED-PRESENCE-01" &&
    dp.DECLARACION.texto.includes("No representa intencion de voto")
  );
});

await t("la presencia no expone ninguna puntuacion total", () => {
  const p = dp.presenciaDigitalObservada({ evidencias: REPLICA });

  return p.indice.valor === null && !Object.hasOwn(p, "puntuacion");
});


/*
===========================================================
7 · PERSISTENCIA: UNA NUEVA INVESTIGACION NO BORRA HISTORIA
===========================================================
*/
bloque("persistencia longitudinal en el Lake");

const PID = "ci-test";

await ps.crearProyecto({
  id: PID,
  nombre: "Proyecto Candidate Intelligence",
  canton: "Canton Ficticio",
  pais: "Ecuador",
  dignidad: "Alcaldía"
});

await ps.agregarCandidato(PID, { nombre: "Aspirante Ficticia Primera" });

await ps.agregarCandidato(PID, { nombre: "Aspirante Ficticio Segundo" });

const CID_A = "aspirante-ficticia-primera";

const CID_B = "aspirante-ficticio-segundo";

await t("dos candidatos independientes existen en el mismo proyecto", async () => {
  const a = await ps.obtenerCandidato(PID, CID_A);

  const b = await ps.obtenerCandidato(PID, CID_B);

  return !!a && !!b && a.id !== b.id;
});

await t("un snapshot de identidad se persiste", async () => {
  const s = tl.crearSnapshotDeIdentidad({
    candidateId: CID_A,
    projectId: PID,
    capturedAt: "2026-08-20T10:00:00.000Z",
    cuentas: [{ accountId: "instagram:uno", estado: "CORROBORADA" }]
  });

  const r = await ps.guardarSnapshotDeIdentidad(PID, CID_A, s);

  return r.escrito === true;
});

await t("un segundo snapshot NO sobrescribe el primero", async () => {
  const s = tl.crearSnapshotDeIdentidad({
    candidateId: CID_A,
    projectId: PID,
    capturedAt: "2026-08-25T10:00:00.000Z",
    cuentas: [
      { accountId: "instagram:uno", estado: "CONSOLIDADA" },
      { accountId: "tiktok:dos", estado: "CANDIDATA" }
    ]
  });

  await ps.guardarSnapshotDeIdentidad(PID, CID_A, s);

  const serie = await ps.snapshotsDeIdentidadDe(PID, CID_A);

  return serie.length === 2;
});

await t("la serie llega ordenada de la mas reciente a la mas antigua", async () => {
  const serie = await ps.snapshotsDeIdentidadDe(PID, CID_A);

  return serie[0].capturedAt > serie[1].capturedAt;
});

await t("y el estado historico de la primera foto sigue intacto", async () => {
  const serie = await ps.snapshotsDeIdentidadDe(PID, CID_A);

  const vieja = serie[serie.length - 1];

  return (
    vieja.total === 1 && vieja.cuentas[0].estado === "CORROBORADA"
  );
});

await t("comparar las dos fotos reales del Lake detecta la cuenta aparecida", async () => {
  const serie = await ps.snapshotsDeIdentidadDe(PID, CID_A);

  const d = tl.compararInventarios(serie[1], serie[0]);

  return d.aparecidas.length === 1 && d.aparecidas[0] === "tiktok:dos";
});

await t("el candidato B no ve los snapshots del candidato A", async () => {
  const serie = await ps.snapshotsDeIdentidadDe(PID, CID_B);

  return serie.length === 0;
});

bloque("corpus de evidencias append-only");

await t("un lote de evidencias se persiste con su fecha de observacion", async () => {
  const r = await ps.guardarEvidencias(PID, CID_A, REPLICA, {
    ejecutadaEn: "2026-08-20T10:00:00.000Z",
    investigacionId: "inv-1"
  });

  return r.escrito === true && r.guardadas === 5;
});

await t("un segundo lote se anade, no reemplaza", async () => {
  await ps.guardarEvidencias(
    PID,
    CID_A,
    [
      {
        id: "e6",
        titulo: "Nueva pieza posterior",
        url: "https://portalficticio-nuevo.test/nota-6",
        fecha: "2026-08-24"
      }
    ],
    { ejecutadaEn: "2026-08-25T10:00:00.000Z", investigacionId: "inv-2" }
  );

  const c = await ps.evidenciasDe(PID, CID_A);

  return c.lotes === 2 && c.total === 6;
});

await t("UNA NUEVA INVESTIGACION NO BORRA HISTORIA: la pieza vieja sigue ahi", async () => {
  const c = await ps.evidenciasDe(PID, CID_A);

  return c.evidencias.some((e) => e.url === "https://diarioficticio-uno.test/nota-1");
});

await t("una pieza vista dos veces conserva la PRIMERA observacion", async () => {
  await ps.guardarEvidencias(PID, CID_A, [REPLICA[0]], {
    ejecutadaEn: "2026-08-26T10:00:00.000Z",
    investigacionId: "inv-3"
  });

  const c = await ps.evidenciasDe(PID, CID_A);

  const e = c.evidencias.find(
    (x) => x.url === "https://diarioficticio-uno.test/nota-1"
  );

  return e.observadaEn === "2026-08-20T10:00:00.000Z" && e.vecesObservada === 2;
});

await t("la fecha de la fuente y la de observacion se conservan por separado", async () => {
  const c = await ps.evidenciasDe(PID, CID_A);

  const e = c.evidencias.find(
    (x) => x.url === "https://diarioficticio-uno.test/nota-1"
  );

  return e.fecha === "2026-08-20" && e.observadaEn !== e.fecha;
});

await t("el corpus del candidato B esta vacio y lo dice", async () => {
  const c = await ps.evidenciasDe(PID, CID_B);

  return c.total === 0 && c.nota.includes("Todavia no hay corpus");
});

bloque("independencia del candidato");

await t("el motor produce resultados para B con sus propios datos", async () => {
  await ps.guardarEvidencias(
    PID,
    CID_B,
    [
      {
        id: "b1",
        titulo: "Pieza exclusiva del segundo aspirante",
        url: "https://medioficticio-b.test/nota-b",
        fecha: "2026-08-23"
      }
    ],
    { ejecutadaEn: "2026-08-23T10:00:00.000Z" }
  );

  const c = await ps.evidenciasDe(PID, CID_B);

  const a = amp.amplificacionDeCandidato({
    evidencias: c.evidencias,
    cuentas: []
  });

  return a.ganada.piezas === 1 && a.ganada.hechosDistintos === 1;
});

await t("y el corpus de A no cambio al escribir el de B", async () => {
  const c = await ps.evidenciasDe(PID, CID_A);

  return c.total === 6;
});

await t("los mismos fixtures con otro candidateId dan la misma estructura", () => {
  const a = res.resolverCuentasDelCandidato({
    candidateId: CANDIDATO_A,
    cuentas: [CORROBORADA]
  });

  const b = res.resolverCuentasDelCandidato({
    candidateId: CANDIDATO_B,
    cuentas: [CORROBORADA]
  });

  return (
    a.cuentas[0].estado === b.cuentas[0].estado &&
    a.cuentas[0].candidateId !== b.cuentas[0].candidateId
  );
});

await t("ningun modulo de este gate menciona un candidato concreto", async () => {
  const { readFile } = await import("node:fs/promises");

  const archivos = [
    "accountResolution.js",
    "candidateTimeline.js",
    "candidateAmplification.js",
    "candidateRelations.js",
    "digitalPresence.js",
    "expedienteSolidez.js"
  ];

  /*
    El patron se compone en trozos para que esta prueba no
    contenga literalmente lo que prohibe: se inspeccionaria a si
    misma y pasaria siempre.
  */
  const prohibido = ["jota", "lloret"].join("");

  for (const a of archivos) {
    const src = await readFile(
      new URL(`../services/intelligence/${a}`, import.meta.url),
      "utf8"
    );

    if (src.toLowerCase().includes(prohibido)) return `${a} lo menciona`;
  }

  return true;
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
