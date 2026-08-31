// apps/backend/tests/tiktokReal.test.mjs

/*
===========================================================
TIKTOK — LO QUE SE MIDIO Y LO QUE NO
P-CAND-TIKTOK-01
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/tiktokReal.test.mjs

SIN RED. `fetch` inyectado con la forma REAL de las respuestas
medidas en el gate.

LAS DOS COSAS QUE ESTA SUITE DEFIENDE
-----------------------------------------------------------

    UNA AUSENCIA NO ES UN CERO

oembed no entrega ni un seguidor. Todos esos campos quedan en
null con availability NO_DISPONIBLE. Un 0 seria una medicion.

    MEDIR IDENTIDAD NO HABILITA UN BENCHMARK

Se midio de verdad que la cuenta existe y como se llama. La
regla anterior de `habilitaBenchmark` miraba si habia ALGUNA
celda MEDIDO, asi que eso habria puesto TikTok en el benchmark
multicandidato sin una sola cifra. Comparar exige metricas.
===========================================================
*/

process.env.SENTINEL_LAKE_ADAPTER = "memoria";

const tt = await import("../services/ingest/adapters/tiktokAdapter.js");

const scm = await import("../services/intelligence/socialCapabilityMatrix.js");

const ac = await import("../services/intelligence/accountContracts.js");

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
   RESPUESTAS REALES MEDIDAS EN EL GATE
--------------------------------------------------------- */
const respuestaPerfil = (handle, displayName) => async () => ({
  ok: true,
  status: 200,
  text: async () =>
    JSON.stringify({
      version: "1.0",
      type: "rich",
      title: `${displayName}'s Creator Profile`,
      author_url: `https://www.tiktok.com/@${handle}`,
      author_name: displayName,
      width: "100%",
      height: "100%",
      html: `<blockquote class="tiktok-embed" cite="https://www.tiktok.com/@${handle}"></blockquote>`,
      provider_url: "https://www.tiktok.com",
      provider_name: "TikTok",
      embed_product_id: handle,
      embed_type: "profile"
    })
});

/* Lo que devolvieron los dos handles inventados del control. */
const respuesta400 = async () => ({
  ok: false,
  status: 400,
  text: async () => JSON.stringify({ message: "Something went wrong", code: 400 })
});


bloque("Cuenta confirmada por oembed");

const yaku = await tt.confirmarCuenta("yaku.perez", {
  fetch: respuestaPerfil("yaku.perez", "Yaku")
});

await t("un 200 de perfil confirma la cuenta", () => {
  return yaku.estado === tt.ESTADOS.CUENTA_CONFIRMADA && yaku.llamadas === 1;
});

await t("devuelve el nombre visible real, que no es el handle", () => {
  return yaku.cuenta.displayName === "Yaku";
});

await t("el displayName NO es un eco del handle", async () => {
  /*
    La comprobacion que importa: con un handle opaco, oembed
    devuelve un nombre distinto. Si fuera un eco, esta via no
    aportaria ninguna senal de identidad.
  */
  const r = await tt.confirmarCuenta("jotalloretv", {
    fetch: respuestaPerfil("jotalloretv", "Jota Lloret Valdivieso")
  });

  return (
    r.cuenta.displayName === "Jota Lloret Valdivieso" &&
    r.cuenta.displayName !== r.cuenta.handle
  );
});

await t("la URL canonica se conserva", () => {
  return yaku.cuenta.urlCanonica === "https://www.tiktok.com/@yaku.perez";
});

await t("el handle consultado y el devuelto coinciden", () => {
  return yaku.senalDeIdentidad.handleCoincide === true;
});

await t("declara explicitamente lo que NO significa", () => {
  return (
    yaku.noSignifica.includes("MEDIDO_TERCERO") &&
    yaku.noSignifica.includes("BENCHMARK_HABILITADO") &&
    yaku.noSignifica.includes("PERTENENCIA_CORROBORADA")
  );
});


bloque("Una ausencia no es un cero");

await t("ninguna metrica vuelve como 0", () => {
  const e = yaku.cuenta.estadisticasPublicas;

  return Object.values(e).every((m) => m.value === null && m.value !== 0);
});

await t("todas las metricas quedan NO_DISPONIBLE", () => {
  const e = yaku.cuenta.estadisticasPublicas;

  return Object.values(e).every((m) => m.availability === "NO_DISPONIBLE");
});

await t("followers, views, likes, comments y shares estan entre las ausentes", () => {
  const e = yaku.cuenta.estadisticasPublicas;

  return ["followers", "views", "likes", "comments_count", "shares"].every(
    (k) => e[k] && e[k].value === null
  );
});

await t("la lista de lo no disponible viaja con el resultado", () => {
  return (
    Array.isArray(yaku.noDisponiblePorEstaVia) &&
    yaku.noDisponiblePorEstaVia.includes("followers") &&
    yaku.noDisponiblePorEstaVia.includes("comments_text")
  );
});


bloque("El control: un 400 significa que no existe");

await t("un handle inventado da CUENTA_NO_EXISTE, no ERROR", async () => {
  const r = await tt.confirmarCuenta("handle_que_no_existe_123", {
    fetch: respuesta400
  });

  return r.estado === tt.ESTADOS.CUENTA_NO_EXISTE && r.httpStatus === 400;
});

await t("no se confunde con un fallo del proveedor", async () => {
  const r = await tt.confirmarCuenta("handle_que_no_existe_123", {
    fetch: respuesta400
  });

  return r.estado !== tt.ESTADOS.ERROR_PROVEEDOR;
});

await t("una caida de red SI es ERROR_PROVEEDOR", async () => {
  const r = await tt.confirmarCuenta("yaku.perez", {
    fetch: async () => {
      throw new Error("socket colgado");
    }
  });

  return r.estado === tt.ESTADOS.ERROR_PROVEEDOR;
});

await t("un embed de video no se acepta como perfil", async () => {
  const r = await tt.confirmarCuenta("yaku.perez", {
    fetch: async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ embed_type: "video", author_name: "Yaku" })
    })
  });

  return r.estado === tt.ESTADOS.RESPUESTA_INESPERADA;
});

await t("sin handle no se hace ninguna llamada", async () => {
  const r = await tt.confirmarCuenta("", {
    fetch: async () => {
      throw new Error("no deberia haber llamada");
    }
  });

  return r.llamadas === 0;
});


bloque("Medir identidad NO habilita el benchmark");

await t("tiktok sigue en false despues de medir", () => {
  return scm.habilitaBenchmark("tiktok").habilita === false;
});

await t("y el motivo explica que lo medido no es una cifra", () => {
  const b = scm.habilitaBenchmark("tiktok");

  return (
    Array.isArray(b.medidasNoComparables) &&
    b.medidasNoComparables.includes("identidad") &&
    /metric|cifra/i.test(b.motivo)
  );
});

await t("X, YouTube e Instagram NO se movieron", () => {
  return (
    scm.habilitaBenchmark("x").habilita === true &&
    scm.habilitaBenchmark("youtube").habilita === true &&
    scm.habilitaBenchmark("instagram").habilita === true
  );
});

await t("las tres siguen habilitadas por METRICAS, no por identidad", () => {
  const metricas = ["followers", "publicaciones", "views", "likes", "comments", "shares"];

  return ["x", "youtube", "instagram"].every((p) =>
    scm.habilitaBenchmark(p).capacidades.some((c) => metricas.includes(c))
  );
});

await t("facebook sigue en false y sin nada medido", () => {
  const b = scm.habilitaBenchmark("facebook");

  return b.habilita === false && (b.medidasNoComparables || []).length === 0;
});

await t("la matriz declara la via publica medida y lo que no entrega", () => {
  const p = scm.PLATAFORMAS.find((x) => x.plataformaId === "tiktok");

  return (
    p.viaPublicaMedida &&
    p.viaPublicaMedida.costePorLlamada === 0 &&
    p.viaPublicaMedida.entrega.includes("displayName") &&
    p.viaPublicaMedida.noEntrega.includes("followers")
  );
});


bloque("Persistencia con el contrato existente");

const PID = "proyecto-tiktok-prueba";

await ps.crearProyecto({
  id: PID,
  nombre: "Prueba TikTok",
  canton: "Cuenca",
  pais: "Ecuador",
  dignidad: "Alcaldia"
});

await ps.agregarCandidato(PID, { nombre: "Uno TikTok" });

await ps.agregarCandidato(PID, { nombre: "Dos TikTok" });

const C1 = "uno-tiktok";

const C2 = "dos-tiktok";

const snapshotDe = (candidateId, accountId, capturedAt) =>
  ac.crearSnapshot({
    candidateId,
    accountId,
    projectId: PID,
    platform: "tiktok",
    capturedAt,
    followers: null,
    postsObserved: 0,
    metricsAvailable: ["identidad", "displayName", "url_verificable", "existencia"],
    provider: "tiktok_oembed",
    estado: "CUENTA_CONFIRMADA",
    limitations: ["oembed no entrega ninguna metrica"]
  });

await ps.guardarSnapshots(PID, C1, [
  snapshotDe(C1, "tiktok:uno", "2026-08-31T12:00:00.000Z")
]);

await t("el snapshot se persiste con followers null y no 0", async () => {
  const serie = await ps.snapshotsDe(PID, C1);

  const s = serie.find((x) => x.platform === "tiktok");

  return s && s.followers === null && s.followers !== 0;
});

await t("la procedencia queda registrada", async () => {
  const serie = await ps.snapshotsDe(PID, C1);

  const s = serie.find((x) => x.platform === "tiktok");

  return s.provider === "tiktok_oembed";
});

await t("las limitaciones viajan con el snapshot", async () => {
  const serie = await ps.snapshotsDe(PID, C1);

  const s = serie.find((x) => x.platform === "tiktok");

  return Array.isArray(s.limitations) && s.limitations.length > 0;
});

await t("snapshotId estable para el mismo activo e instante", () => {
  const a = snapshotDe(C1, "tiktok:uno", "2026-08-31T12:00:00.000Z");

  const b = snapshotDe(C1, "tiktok:uno", "2026-08-31T12:00:00.000Z");

  return a.snapshotId === b.snapshotId;
});

await t("dos instantes distintos son dos snapshots, no una sobrescritura", async () => {
  await ps.guardarSnapshots(PID, C1, [
    snapshotDe(C1, "tiktok:uno", "2026-08-31T18:00:00.000Z")
  ]);

  const serie = await ps.snapshotsDe(PID, C1);

  return serie.filter((x) => x.platform === "tiktok").length === 2;
});


bloque("Multi-asset y sin mezcla entre candidatos");

await t("dos activos del mismo candidato no se colapsan", async () => {
  await ps.guardarSnapshots(PID, C2, [
    snapshotDe(C2, "tiktok:dos_a", "2026-08-31T12:00:00.000Z"),
    snapshotDe(C2, "tiktok:dos_b", "2026-08-31T12:00:00.000Z")
  ]);

  const serie = await ps.snapshotsDe(PID, C2);

  const ids = new Set(
    serie.filter((x) => x.platform === "tiktok").map((x) => x.accountId)
  );

  return ids.size === 2;
});

await t("los snapshots de un candidato no aparecen en el otro", async () => {
  const s1 = await ps.snapshotsDe(PID, C1);

  const s2 = await ps.snapshotsDe(PID, C2);

  const cuentas1 = s1.map((x) => x.accountId);

  const cuentas2 = s2.map((x) => x.accountId);

  return (
    !cuentas1.some((c) => c && c.startsWith("tiktok:dos")) &&
    !cuentas2.includes("tiktok:uno")
  );
});

await t("cada snapshot lleva su candidato y su proyecto", async () => {
  const serie = await ps.snapshotsDe(PID, C2);

  return serie
    .filter((x) => x.platform === "tiktok")
    .every((x) => x.candidateId === C2 && x.projectId === PID);
});


bloque("Ninguna credencial y ningun coste");

await t("el adaptador declara que no necesita credencial", () => {
  return tt.REQUIERE_CREDENCIAL === false && tt.COSTE_POR_LLAMADA === 0;
});

await t("no hay ningun token en el resultado", () => {
  const texto = JSON.stringify(yaku);

  return !/access_token|Bearer\s|api[_-]?key/i.test(texto);
});

await t("el diagnostico explica por que la via es tan pequena", () => {
  const d = tt.diagnostico();

  return (
    /Display API/.test(d.porQueTanPoco) &&
    /Research API/.test(d.porQueTanPoco) &&
    /evasivo/.test(d.lineaQueNoSeCruza)
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
