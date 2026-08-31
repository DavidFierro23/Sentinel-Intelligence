// apps/backend/tests/facebookCoverage.test.mjs

/*
===========================================================
COBERTURA FACEBOOK — CIERRE
P-CAND-FACEBOOK-01
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/facebookCoverage.test.mjs

SIN RED. `fetch` inyectado con la forma REAL de las respuestas
medidas en el gate.

LO QUE DEFIENDE
-----------------------------------------------------------

    MEDIDO_PROPIO_AUTORIZADO  !=  MEDIDO_TERCERO

La metadata de la Pagina que administramos llega con 200. Leerlo
como acceso a candidatos seria el falso positivo mas caro del
modulo.

    (#10)  !=  (#100)

Dos 400 que se parecen y no se arreglan igual: al primero le
falta un PERMISO del token y se resuelve regenerandolo; al
segundo le falta una FEATURE de la app y exige App Review.
Confundirlos manda a pedir revision cuando basta un token, o al
reves.

    BLOQUEADO  !=  SIN_RESULTADOS

Una Pagina bloqueada no devuelve cero publicaciones: no devuelve
nada, y un cero seria una medicion.
===========================================================
*/

process.env.SENTINEL_LAKE_ADAPTER = "memoria";

process.env.FACEBOOK_USER_ACCESS_TOKEN = "EAA-TOKEN-FICTICIO-NO-REAL-000";

process.env.INSTAGRAM_ACCESS_TOKEN = "IGQ-TOKEN-FICTICIO-NO-REAL-000";

const ig = await import("../services/ingest/adapters/instagramAdapter.js");

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
const TOKEN_DE_PAGINA = "EAA-TOKEN-DE-PAGINA-FICTICIO-000";

const cuentasPropias = {
  data: [
    {
      id: "725422874136257",
      name: "Jota Lloret",
      username: "jotalloretv",
      access_token: TOKEN_DE_PAGINA,
      fan_count: 55855,
      followers_count: 55855
    }
  ]
};

/* El 400 (#10) real sobre /posts de la Pagina propia. */
const error10 = {
  error: {
    message:
      "(#10) This endpoint requires the 'pages_read_user_content' permission or the 'Page Public Content Access' feature.",
    type: "OAuthException",
    code: 10
  }
};

/* El 400 (#100) real sobre la Page de un tercero. */
const error100 = {
  error: {
    message:
      "(#100) Object does not exist, cannot be loaded due to missing permission or reviewable feature, or does not support this operation. This endpoint requires the 'pages_read_engagement' permission or the 'Page Public Content Access' feature or the 'Page Public Metadata Access' feature.",
    type: "OAuthException",
    code: 100
  }
};

const json = (cuerpo, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(cuerpo)
});

/* Registra las URLs para poder afirmar QUE token viajo. */
let vistas = [];

const fetchDe = (respuestaPosts) => async (url) => {
  const u = String(url);

  vistas.push(u);

  if (u.includes("/me/accounts")) return json(cuentasPropias);

  if (u.includes("/posts")) return respuestaPosts;

  return json(error100, 400);
};


bloque("Pagina propia: la metadata SI llega");

vistas = [];

const propiaBloqueada = await ig.publicacionesDePaginaPropia("jotalloretv", {
  maximo: 5,
  fetch: fetchDe(json(error10, 400))
});

await t("me/accounts identifica la Pagina administrada", () => {
  return (
    propiaBloqueada.pagina?.id === "725422874136257" &&
    propiaBloqueada.pagina?.username === "jotalloretv"
  );
});

await t("fan_count y followers_count llegan y no se funden", () => {
  return (
    propiaBloqueada.pagina.fan_count === 55855 &&
    propiaBloqueada.pagina.followers_count === 55855 &&
    "fan_count" in propiaBloqueada.pagina &&
    "followers_count" in propiaBloqueada.pagina
  );
});

await t("una Pagina que no administramos no se intenta", async () => {
  const r = await ig.publicacionesDePaginaPropia("paginadeotro", {
    fetch: fetchDe(json({ data: [] }))
  });

  return r.estado === "NO_ADMINISTRADA" && r.llamadas === 1;
});


bloque("(#10) no es (#100): permiso del token vs feature de la app");

await t("/posts sobre la Pagina propia queda BLOQUEADO, no OK", () => {
  return propiaBloqueada.estado !== "OK" && propiaBloqueada.httpStatus === 400;
});

await t("el bloqueo de lo propio nombra el permiso que falta", () => {
  return /pages_read_user_content/.test(propiaBloqueada.motivo || "");
});

await t("un bloqueo NO devuelve publicaciones en cero", () => {
  /*
    Cero publicaciones seria una medicion: diria «esta Pagina no
    publica». Lo correcto es no devolver la lista.
  */
  return propiaBloqueada.publicaciones === undefined;
});

const tercero = await ig.paginaDeTercero("pedropalaciosu", {
  fetch: async () => json(error100, 400)
});

await t("la Page de un tercero sigue bloqueada", () => {
  return tercero.estado !== "OK" && tercero.httpStatus === 400;
});

await t("el codigo del tercero es 100 y el de lo propio 10", () => {
  return tercero.codigo === 100 && propiaBloqueada.codigo === 10;
});

await t("el bloqueo del tercero nombra las tres alternativas de Meta", () => {
  const m = tercero.motivo || "";

  return (
    /pages_read_engagement/.test(m) &&
    /Page Public Content Access/.test(m) &&
    /Page Public Metadata Access/.test(m)
  );
});

await t("un tercero bloqueado no devuelve pagina", () => {
  return tercero.pagina === null;
});


bloque("Pagina propia con permiso: que campos entrega");

const postsOk = json({
  data: [
    {
      id: "725422874136257_100",
      permalink_url: "https://www.facebook.com/725422874136257/posts/100",
      created_time: "2026-08-20T15:00:00+0000",
      message: "Publicacion de prueba",
      status_type: "added_photos",
      attachments: { data: [{ media_type: "photo", type: "photo" }] },
      reactions: { summary: { total_count: 340 } },
      comments: {
        summary: { total_count: 12 },
        data: [
          {
            id: "c1",
            created_time: "2026-08-20T16:00:00+0000",
            message: "Un comentario real",
            permalink_url: "https://www.facebook.com/c1"
          }
        ]
      },
      shares: { count: 7 }
    },
    {
      /* Sin shares ni reacciones: la ausencia no puede volverse 0. */
      id: "725422874136257_101",
      permalink_url: "https://www.facebook.com/725422874136257/posts/101",
      created_time: "2026-08-18T10:00:00+0000",
      message: null,
      comments: { summary: { total_count: 0 }, data: [] }
    }
  ]
});

vistas = [];

const propiaOk = await ig.publicacionesDePaginaPropia("jotalloretv", {
  maximo: 5,
  fetch: fetchDe(postsOk)
});

await t("con permiso, la observacion sale OK", () => {
  return propiaOk.estado === "OK" && propiaOk.publicaciones.length === 2;
});

await t("el alcance es PROPIO y no de tercero", () => {
  return propiaOk.alcanceDeLaMedicion === "MEDIDO_PROPIO_AUTORIZADO";
});

await t("declara que NO demuestra acceso a terceros", () => {
  return (
    propiaOk.noSignifica.includes("MEDIDO_TERCERO") &&
    propiaOk.noSignifica.includes("PAGE_PUBLIC_CONTENT_ACCESS_CONCEDIDO")
  );
});

await t("permalink, fecha y texto llegan", () => {
  const p = propiaOk.publicaciones[0];

  return (
    p.permalink.includes("/posts/100") &&
    p.publishedAt === "2026-08-20T15:00:00+0000" &&
    p.texto === "Publicacion de prueba"
  );
});

await t("reactions, comments_count y shares se miden", () => {
  const m = propiaOk.publicaciones[0].metricas;

  return (
    m.reactions.value === 340 &&
    m.comments_count.value === 12 &&
    m.shares.value === 7
  );
});

await t("las reacciones NO se llaman likes", () => {
  /*
    reactions.summary cuenta me gusta, me encanta y me enfada.
    Llamarlo «likes» inflaria los likes con enfados.
  */
  const m = propiaOk.publicaciones[0].metricas;

  return "reactions" in m && !("likes" in m);
});

await t("el texto de los comentarios SI llega con autorizacion", () => {
  const p = propiaOk.publicaciones[0];

  return (
    propiaOk.textoDeComentarios === "DISPONIBLE" &&
    p.comentarios[0].texto === "Un comentario real" &&
    p.comentarios[0].permalink !== null
  );
});


bloque("Una ausencia no es un cero");

await t("un post sin shares deja shares en null, no en 0", () => {
  const m = propiaOk.publicaciones[1].metricas;

  return m.shares.value === null && m.shares.value !== 0;
});

await t("un post sin reacciones deja reactions en null", () => {
  const m = propiaOk.publicaciones[1].metricas;

  return m.reactions.value === null;
});

await t("un comments_count de 0 SI es un cero medido", () => {
  /*
    La otra mitad de la regla: cuando Meta dice 0, es 0. Tratarlo
    como ausencia perderia una medicion real.
  */
  const m = propiaOk.publicaciones[1].metricas;

  return m.comments_count.value === 0;
});

await t("video_views queda NO_DISPONIBLE por ser insight del dueno", () => {
  const m = propiaOk.publicaciones[0].metricas;

  return (
    m.video_views.value === null &&
    m.video_views.availability === "NO_DISPONIBLE" &&
    m.video_views.alcance === "OWNER_INSIGHT"
  );
});


bloque("El token de la Pagina no se filtra");

await t("las publicaciones se piden con el token DE LA PAGINA", () => {
  const llamadaPosts = vistas.find((u) => u.includes("/posts"));

  return llamadaPosts.includes(encodeURIComponent(TOKEN_DE_PAGINA)) ||
    llamadaPosts.includes(TOKEN_DE_PAGINA);
});

await t("y ese token NO sale en el resultado", () => {
  return !JSON.stringify(propiaOk).includes(TOKEN_DE_PAGINA);
});

await t("tampoco el token de usuario ni en el caso bloqueado", () => {
  const texto = JSON.stringify([propiaOk, propiaBloqueada, tercero]);

  return (
    !texto.includes("EAA-TOKEN-FICTICIO-NO-REAL-000") &&
    !texto.includes(TOKEN_DE_PAGINA)
  );
});


bloque("La matriz no asciende Facebook por medir lo propio");

await t("habilitaBenchmark facebook sigue en false", () => {
  return scm.habilitaBenchmark("facebook").habilita === false;
});

await t("y el motivo dice que lo medido es de nuestra cuenta", () => {
  const b = scm.habilitaBenchmark("facebook");

  return b.medidasSobreCuentaPropia > 0 && /propia/i.test(b.motivo);
});

await t("las tres plataformas con terceros no se movieron", () => {
  return (
    scm.habilitaBenchmark("x").habilita === true &&
    scm.habilitaBenchmark("youtube").habilita === true &&
    scm.habilitaBenchmark("instagram").habilita === true
  );
});

await t("la matriz registra el permiso que falta sobre lo propio", () => {
  const f = scm.PLATAFORMAS.find((p) => p.plataformaId === "facebook");

  const c = f.medicionReal.etapaC;

  return (
    c.sobrePaginaPropia.publicaciones.permisoQueFalta ===
      "pages_read_user_content" &&
    c.sobrePaginaPropia.publicaciones.codigoMeta === 10 &&
    c.sobrePaginaDeTercero.codigoMeta === 100
  );
});

await t("y separa permiso de token de feature de app", () => {
  const f = scm.PLATAFORMAS.find((p) => p.plataformaId === "facebook");

  const c = f.medicionReal.etapaC;

  return (
    c.sobrePaginaPropia.publicaciones.resultado === "BLOQUEADO_PERMISO_TOKEN" &&
    c.sobrePaginaDeTercero.resultado === "BLOQUEADO_META"
  );
});


bloque("Persistencia y aislamiento");

const PID = "proyecto-facebook-prueba";

const OTRO = "proyecto-facebook-otro";

await ps.crearProyecto({
  id: PID,
  nombre: "FB uno",
  canton: "Cuenca",
  pais: "Ecuador",
  dignidad: "Alcaldia"
});

await ps.crearProyecto({
  id: OTRO,
  nombre: "FB dos",
  canton: "Cuenca",
  pais: "Ecuador",
  dignidad: "Alcaldia"
});

await ps.agregarCandidato(PID, { nombre: "Con Pagina" });

await ps.agregarCandidato(OTRO, { nombre: "Con Pagina" });

const CAND = "con-pagina";

const snapDe = (accountId, capturedAt) =>
  ac.crearSnapshot({
    candidateId: CAND,
    accountId,
    projectId: PID,
    platform: "facebook",
    capturedAt,
    followers: 55855,
    postsObserved: 0,
    provider: "meta_graph",
    estado: "MEDIDO_PROPIO_AUTORIZADO",
    limitations: ["el token administra esta Pagina: no es acceso a terceros"]
  });

await ps.guardarSnapshots(PID, CAND, [
  snapDe("facebook:pagina_a", "2026-08-31T12:00:00.000Z"),
  snapDe("facebook:pagina_b", "2026-08-31T12:00:00.000Z")
]);

await t("dos Pages del mismo candidato no se colapsan", async () => {
  const serie = await ps.snapshotsDe(PID, CAND);

  const ids = new Set(
    serie.filter((x) => x.platform === "facebook").map((x) => x.accountId)
  );

  return ids.size === 2;
});

await t("el alcance PROPIO viaja persistido", async () => {
  const serie = await ps.snapshotsDe(PID, CAND);

  return serie
    .filter((x) => x.platform === "facebook")
    .every((x) => x.estado === "MEDIDO_PROPIO_AUTORIZADO");
});

await t("los snapshots no cruzan de proyecto", async () => {
  const otros = await ps.snapshotsDe(OTRO, CAND);

  return otros.filter((x) => x.platform === "facebook").length === 0;
});

await t("snapshotId estable para el mismo activo e instante", () => {
  return (
    snapDe("facebook:pagina_a", "2026-08-31T12:00:00.000Z").snapshotId ===
    snapDe("facebook:pagina_a", "2026-08-31T12:00:00.000Z").snapshotId
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
