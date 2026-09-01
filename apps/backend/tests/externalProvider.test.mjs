// apps/backend/tests/externalProvider.test.mjs

/*
===========================================================
LIMITE DE PROVEEDOR SOCIAL EXTERNO
SOCIAL-PROVIDER-REAL-01-PREP
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/externalProvider.test.mjs

SIN RED. Cero llamadas a proveedores. Todo sale de fixtures
sinteticos marcados NO_REAL_DATA.

LAS TRES COSAS QUE DEFIENDE
-----------------------------------------------------------

    LA DOCUMENTACION DE UN PROVEEDOR NO ES COBERTURA

Todo lo que un proveedor declara entra como
UNVERIFIED_PROVIDER. Si esto se rompiera, Sentinel podria
afirmar que cubre Facebook porque lo leyo en una web.

    EL NOMBRE DEL PROVEEDOR NO ENTRA EN EL DOMINIO

Cambiar de proveedor tiene que ser cambiar un adaptador. Hay
prueba de que el mismo normalizador traga dos payloads con
nombres de campo distintos sin que el dominio se entere.

    UNA AUSENCIA NO ES UN CERO

Ni en metricas de publicacion ni en likes de un comentario.
===========================================================
*/

process.env.SENTINEL_LAKE_ADAPTER = "memoria";

import fs from "node:fs";

import path from "node:path";

import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));

const esp = await import("../services/intelligence/externalSocialProvider.js");

const co = await import("../services/intelligence/commentObservation.js");

const po = await import("../services/intelligence/publicationObservation.js");

const ps = await import("../services/projects/projectStore.js");

const ac = await import("../services/intelligence/accountContracts.js");

const fixture = (n) =>
  JSON.parse(fs.readFileSync(path.join(AQUI, "fixtures", n), "utf8"));

const fbPost = fixture("facebook-post-provider.sample.json");

const fbComments = fixture("facebook-comments-provider.sample.json");

const ttPost = fixture("tiktok-post-provider.sample.json");

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


bloque("Los fixtures son sinteticos y lo dicen");

await t("los tres fixtures se declaran NO_REAL_DATA", () => {
  return [fbPost, fbComments, ttPost].every(
    (f) => f._meta?.TEST_FIXTURE === true && f._meta?.NO_REAL_DATA === true
  );
});


bloque("Ningun proveedor esta verificado todavia");

/*
  ACTUALIZADO EN SOCIAL-PROVIDER-ALTERNATIVE-01: la cuenta paso
  de EN_REVISION a BLOQUEADO_POR_PROVEEDOR. Lo que la prueba
  defiende no cambia —sigue sin estar aprobado— y ahora tambien
  fija que el bloqueo es del proveedor y no nuestro.
*/
await t("Bright Data existe y NO esta aprobado para operar", () => {
  const p = esp.proveedor("brightdata");

  return (
    p !== null &&
    p.aprobadoParaOperar === false &&
    p.estadoComercial === "BLOQUEADO_POR_PROVEEDOR"
  );
});

await t("y su bloqueo no ascendio a ningun otro proveedor", () => {
  /*
    Que Bright Data caiga no puede promover a nadie. Lo que
    promovio a ScrapeCreators en SOCIAL-PROVIDER-REAL-02 fue una
    medicion real, no la caida del otro: SocialCrawl y Data365
    siguen exactamente donde estaban.
  */
  return ["socialcrawl", "data365"].every((id) => {
    const p = esp.proveedor(id);

    const medidas = Object.values(p.capacidades).flatMap((c) =>
      Object.values(c).filter((e) => ["SUPPORTED", "PARTIAL"].includes(e))
    );

    return p.aprobadoParaOperar === false && medidas.length === 0;
  });
});

await t("todas sus capacidades son UNVERIFIED_PROVIDER", () => {
  const p = esp.proveedor("brightdata");

  const todas = Object.values(p.capacidades).flatMap((c) => Object.values(c));

  return (
    todas.length > 0 &&
    todas.every((e) => e === esp.ESTADOS_CAPACIDAD_PROVEEDOR.UNVERIFIED_PROVIDER)
  );
});

await t("UNVERIFIED_PROVIDER NO cuenta como verificado", () => {
  const c = esp.capacidadDeProveedor("brightdata", "facebook", "comment_text");

  return (
    c.estado === esp.ESTADOS_CAPACIDAD_PROVEEDOR.UNVERIFIED_PROVIDER &&
    c.verificado === false
  );
});

/*
  ACTUALIZADO EN SOCIAL-PROVIDER-REAL-02: ScrapeCreators ya tiene
  capacidades medidas contra activos reales, asi que
  `ningunoVerificado` dejo de ser true. Lo que la prueba defiende
  no cambia y se vuelve mas preciso: nadie mas se movio, y
  ScrapeCreators solo subio donde hubo medicion.
*/
await t("solo ScrapeCreators tiene capacidades medidas", () => {
  const e = esp.estadoDeProveedores();

  const conMedidas = e.proveedores
    .filter((p) => p.capacidadesMedidas > 0)
    .map((p) => p.id);

  return conMedidas.length === 1 && conMedidas[0] === "scrapecreators";
});

await t("los demas proveedores siguen en cero", () => {
  const e = esp.estadoDeProveedores();

  return e.proveedores
    .filter((p) => p.id !== "scrapecreators")
    .every((p) => p.capacidadesMedidas === 0);
});

await t("EnsembleData queda UNSUPPORTED en Facebook, no sin declarar", () => {
  const c = esp.capacidadDeProveedor("ensembledata", "facebook", "posts");

  return c.estado === esp.ESTADOS_CAPACIDAD_PROVEEDOR.UNSUPPORTED;
});

await t("un proveedor desconocido se rechaza, no se asume", () => {
  const c = esp.capacidadDeProveedor("proveedor_inventado", "facebook", "posts");

  return (
    c.conocido === false &&
    c.estado === esp.ESTADOS_CAPACIDAD_PROVEEDOR.UNSUPPORTED
  );
});


bloque("La bandera de entorno no aprueba a nadie");

await t("sin bandera, el proveedor esta deshabilitado", () => {
  const r = esp.proveedorHabilitado("brightdata", {});

  return r.habilitado === false;
});

await t("con la bandera en true SIGUE deshabilitado si no esta aprobado", () => {
  /*
    La comprobacion que importa: encender una variable de entorno
    no puede convertir un proveedor en revision en uno operativo.
  */
  const r = esp.proveedorHabilitado("brightdata", {
    SOCIAL_EXTERNAL_PROVIDER_ENABLED: "true",
    BRIGHTDATA_API_KEY: "clave-ficticia-de-prueba"
  });

  return r.habilitado === false && /no aprobado para operar/.test(r.motivo);
});

await t("un proveedor desconocido nunca se habilita", () => {
  const r = esp.proveedorHabilitado("proveedor_inventado", {
    SOCIAL_EXTERNAL_PROVIDER_ENABLED: "true"
  });

  return r.habilitado === false;
});


bloque("Normalizar publicacion: el dominio no sabe de proveedores");

const pubFb = esp.normalizarPublicacionDeProveedor({
  providerId: "brightdata",
  platformId: "facebook",
  payload: fbPost,
  candidateId: "cand-sintetico",
  projectId: "proj-sintetico",
  accountId: "facebook:sintetica",
  observedAt: "2026-08-31T12:00:00.000Z",
  rawReference: "fixture:facebook-post"
});

await t("postId estable derivado del id de plataforma", () => {
  return pubFb.publicationId === "pub-facebook-111122223333_444455556666";
});

await t("permalink canonico conservado", () => {
  return pubFb.canonicalUrl === fbPost.permalink;
});

await t("timestamp y texto conservados", () => {
  return (
    pubFb.publishedAt === "2026-08-20T15:00:00+0000" &&
    pubFb.text === "Texto sintetico de publicacion de prueba."
  );
});

await t("evidenceId estable y derivado del permalink", () => {
  const otra = esp.normalizarPublicacionDeProveedor({
    providerId: "brightdata",
    platformId: "facebook",
    payload: fbPost,
    observedAt: "2026-09-05T09:00:00.000Z"
  });

  return Boolean(pubFb.evidenceId) && pubFb.evidenceId === otra.evidenceId;
});

await t("la procedencia registra el proveedor", () => {
  return (
    pubFb.provider === "brightdata" &&
    pubFb.provenance.observationMethod === "external_provider:brightdata"
  );
});

await t("reactions, comments_count y shares se miden", () => {
  const m = Object.fromEntries(pubFb.metricas.map((x) => [x.metrica, x.value]));

  return m.reactions === 340 && m.commentsCount === 12 && m.shares === 7;
});

await t("una metrica ausente queda NO_DISPONIBLE y no en 0", () => {
  const views = pubFb.metricas.find((x) => x.metrica === "views");

  return (
    views.value === null &&
    views.value !== 0 &&
    views.availability === po.DISPONIBILIDAD.NO_DISPONIBLE
  );
});

await t("el tipo de publicacion NO se inventa", () => {
  return pubFb.tipoPublicacion === po.TIPOS_PUBLICACION.NO_DETERMINADO;
});


bloque("El mismo normalizador con otro proveedor y otros nombres");

const pubTt = esp.normalizarPublicacionDeProveedor({
  providerId: "data365",
  platformId: "tiktok",
  payload: ttPost,
  observedAt: "2026-08-31T12:00:00.000Z",

  /*
    TikTok nombra los campos de otra forma. El mapa vive fuera
    del dominio: es lo que permite cambiar de proveedor sin tocar
    Candidate Intelligence.
  */
  mapa: {
    postId: "video_id",
    permalink: "share_url",
    publishedAt: "create_time",
    text: "desc",
    views: "stats.play_count",
    likes: "stats.digg_count",
    commentsCount: "stats.comment_count",
    shares: "stats.share_count"
  }
});

await t("un payload con nombres distintos produce el mismo contrato", () => {
  return (
    pubTt.platformId === "tiktok" &&
    pubTt.publicationId === "pub-tiktok-7000000000000000000" &&
    pubTt.canonicalUrl === ttPost.share_url
  );
});

await t("lee metricas anidadas con notacion de punto", () => {
  const m = Object.fromEntries(pubTt.metricas.map((x) => [x.metrica, x.value]));

  return (
    m.views === 12500 && m.likes === 340 && m.commentsCount === 21 && m.shares === 9
  );
});

await t("en TikTok reactions no existe y queda NO_DISPONIBLE", () => {
  const r = pubTt.metricas.find((x) => x.metrica === "reactions");

  return r.value === null && r.availability === po.DISPONIBILIDAD.NO_DISPONIBLE;
});

await t("el proveedor solo aparece en campos de procedencia", () => {
  /*
    El invariante de verdad no es «aparece pocas veces» —contar
    ocurrencias no prueba nada— sino DONDE aparece.

    El nombre del proveedor puede vivir en los campos que existen
    para declarar la procedencia. Lo que no puede es contaminar
    la identidad de la publicacion, su contenido o el valor de
    una metrica: si estuviera ahi, cambiar de proveedor cambiaria
    el dato y no solo su origen.
  */
  const PERMITIDOS = ["provider", "providerId", "observationMethod"];

  const rutas = [];

  const recorrer = (o, ruta) => {
    if (o === null || typeof o !== "object") {
      if (String(o).includes("data365")) rutas.push(ruta);

      return;
    }

    for (const k of Object.keys(o)) recorrer(o[k], ruta ? `${ruta}.${k}` : k);
  };

  recorrer(pubTt, "");

  const ultimoTramo = (r) => r.split(".").pop();

  return (
    rutas.length > 0 && rutas.every((r) => PERMITIDOS.includes(ultimoTramo(r)))
  );
});

await t("la identidad y el contenido no llevan rastro del proveedor", () => {
  /*
    La otra mitad: los campos que definen QUE es la publicacion
    deben ser identicos vinieran de donde vinieran.
  */
  const identidad = [
    pubTt.publicationId,
    pubTt.canonicalUrl,
    pubTt.platformId,
    pubTt.text,
    pubTt.publishedAt
  ].join("|");

  return !/data365|brightdata|ensembledata/i.test(identidad);
});


bloque("Comentarios: el contrato que faltaba");

const corpus = esp.normalizarComentariosDeProveedor({
  providerId: "brightdata",
  platformId: "facebook",
  postId: fbComments.post_id,
  postPermalink: fbComments.post_permalink,
  payload: fbComments.comments,
  commentsCount: fbComments.comments_count,
  observedAt: "2026-08-31T12:00:00.000Z"
});

await t("el texto de los comentarios se conserva", () => {
  return corpus.comentarios[0].text === "Comentario sintetico numero uno.";
});

await t("commentId estable", () => {
  return corpus.comentarios[0].commentId === "cmt-sintetico-0001";
});

await t("timestamp y relacion con el post conservados", () => {
  const c = corpus.comentarios[0];

  return (
    c.publishedAt === "2026-08-20T16:00:00+0000" &&
    c.postId === fbComments.post_id &&
    c.postPermalink === fbComments.post_permalink
  );
});

await t("una respuesta declara su comentario padre", () => {
  const r = corpus.comentarios.find((c) => c.commentId === "cmt-sintetico-0003");

  return r.parentCommentId === "cmt-sintetico-0001" && r.esRespuesta === true;
});

await t("un comentario sin texto queda null, no cadena vacia", () => {
  const c = corpus.comentarios.find((x) => x.commentId === "cmt-sintetico-0002");

  return c.text === null && c.text !== "";
});

await t("likes ausentes en null y un 0 real se conserva como 0", () => {
  const sinDato = corpus.comentarios.find((c) => c.commentId === "cmt-sintetico-0002");

  const conCero = corpus.comentarios.find((c) => c.commentId === "cmt-sintetico-0003");

  return sinDato.likes === null && conCero.likes === 0;
});

await t("el autor se guarda sin perfilado", () => {
  const a = corpus.comentarios[0].author;

  return (
    a.platformUserId === "usuario-sintetico-a" &&
    a.displayName === "Usuario Sintetico A" &&
    Array.isArray(a.noSeHace) &&
    a.noSeHace.length === 3
  );
});


bloque("COMENTARIOS OBSERVADOS != TODOS LOS COMENTARIOS");

await t("el corpus separa declarados de observados", () => {
  return (
    corpus.comentariosDeclaradosPorLaPlataforma === 12 &&
    corpus.comentariosObservados === 3
  );
});

await t("con 3 de 12 la cobertura es MUESTRA, no COMPLETA", () => {
  return corpus.cobertura === "MUESTRA";
});

await t("la obligacion de lenguaje viaja con el dato", () => {
  return /COMENTARIOS OBSERVADOS != TODOS LOS COMENTARIOS/.test(
    corpus.obligacionDeLenguaje
  );
});

await t("declara que no es opinion publica ni intencion de voto", () => {
  return (
    corpus.noSignifica.includes("OPINION_PUBLICA") &&
    corpus.noSignifica.includes("INTENCION_DE_VOTO")
  );
});

await t("solo 2 de 3 comentarios traen texto y se cuenta aparte", () => {
  return corpus.comentariosConTexto === 2;
});

await t("un recuento sin texto es SOLO_RECUENTO, no OBSERVADO", () => {
  const c = co.crearCorpusDeComentarios({
    platformId: "instagram",
    postId: "p1",
    comentarios: [],
    commentsCount: 40
  });

  return c.estado === co.ESTADOS_CORPUS.SOLO_RECUENTO;
});

await t("cero comentarios declarados es un CERO medido, no una ausencia", () => {
  const c = co.crearCorpusDeComentarios({
    platformId: "facebook",
    postId: "p2",
    comentarios: [],
    commentsCount: 0
  });

  return c.estado === co.ESTADOS_CORPUS.SIN_COMENTARIOS;
});


bloque("Rerun: dedup y fechas");

await t("firstObservedAt no se reescribe al reobservar", () => {
  const primera = corpus.comentarios[0];

  const segunda = esp.normalizarComentariosDeProveedor({
    providerId: "brightdata",
    platformId: "facebook",
    postId: fbComments.post_id,
    postPermalink: fbComments.post_permalink,
    payload: fbComments.comments,
    commentsCount: fbComments.comments_count,
    observedAt: "2026-09-07T12:00:00.000Z"
  }).comentarios[0];

  const fusion = co.fusionarComentario(primera, segunda);

  return (
    fusion.firstObservedAt === "2026-08-31T12:00:00.000Z" &&
    fusion.lastObservedAt === "2026-09-07T12:00:00.000Z" &&
    fusion.observationCount === 2
  );
});

await t("el commentId es el mismo entre ejecuciones", () => {
  const otra = esp.normalizarComentariosDeProveedor({
    providerId: "brightdata",
    platformId: "facebook",
    postId: fbComments.post_id,
    payload: fbComments.comments,
    observedAt: "2026-09-07T12:00:00.000Z"
  });

  return otra.comentarios.map((c) => c.commentId).join() ===
    corpus.comentarios.map((c) => c.commentId).join();
});

await t("si el texto cambia entre observaciones se conserva el anterior", () => {
  const previa = corpus.comentarios[0];

  const editada = { ...previa, text: "Texto editado", lastObservedAt: "2026-09-07T12:00:00.000Z" };

  const fusion = co.fusionarComentario(previa, editada);

  return fusion.textoAnterior === "Comentario sintetico numero uno.";
});

await t("reobservar una publicacion no duplica ni mueve firstObservedAt", () => {
  const segunda = esp.normalizarPublicacionDeProveedor({
    providerId: "brightdata",
    platformId: "facebook",
    payload: fbPost,
    observedAt: "2026-09-07T12:00:00.000Z"
  });

  const fusion = po.fusionarPublicacion(pubFb, segunda);

  return (
    fusion.publicationId === pubFb.publicationId &&
    fusion.firstObservedAt === pubFb.firstObservedAt &&
    fusion.observationCount === 2
  );
});


bloque("Procedencia sin secretos");

const proc = esp.procedenciaDeProveedor({
  providerId: "brightdata",
  providerName: "Bright Data",
  datasetId: "gd_sintetico",
  requestId: "req-sintetico-001",
  sourceUrl: fbPost.permalink,
  canonicalPermalink: fbPost.permalink,
  providerStatus: "ok",
  observedAt: "2026-08-31T12:00:00.000Z"
});

await t("conserva dataset, request y permalink", () => {
  return (
    proc.providerDatasetId === "gd_sintetico" &&
    proc.providerRequestId === "req-sintetico-001" &&
    proc.canonicalPermalink === fbPost.permalink
  );
});

await t("declara si el dato esta licenciado por la plataforma", () => {
  return proc.datoLicenciadoPorLaPlataforma === false;
});

await t("no hay ninguna credencial en la procedencia", () => {
  const texto = JSON.stringify(proc);

  return !/api[_-]?key|token|secret|Bearer/i.test(texto);
});

await t("no hay credenciales en los contratos normalizados", () => {
  const texto = JSON.stringify({ pubFb, pubTt, corpus });

  return !/api[_-]?key|access_token|secret|Bearer\s/i.test(texto);
});


bloque("Snapshots, multi-asset y aislamiento de proyecto");

const PID = "proj-proveedor-uno";

const OTRO = "proj-proveedor-dos";

for (const p of [PID, OTRO]) {
  await ps.crearProyecto({
    id: p,
    nombre: p,
    canton: "Cuenca",
    pais: "Ecuador",
    dignidad: "Alcaldia"
  });

  await ps.agregarCandidato(p, { nombre: "Candidato Proveedor" });
}

const CAND = "candidato-proveedor";

const snap = (accountId, capturedAt) =>
  ac.crearSnapshot({
    candidateId: CAND,
    accountId,
    projectId: PID,
    platform: "facebook",
    capturedAt,
    followers: 55000,
    postsObserved: 1,
    provider: "brightdata",
    estado: "UNVERIFIED_PROVIDER",
    limitations: ["proveedor sin verificar: la cobertura no esta demostrada"]
  });

await ps.guardarSnapshots(PID, CAND, [
  snap("facebook:pagina_a", "2026-08-31T12:00:00.000Z"),
  snap("facebook:pagina_b", "2026-08-31T12:00:00.000Z")
]);

await t("dos activos del mismo candidato no se colapsan", async () => {
  const serie = await ps.snapshotsDe(PID, CAND);

  const ids = new Set(
    serie.filter((x) => x.platform === "facebook").map((x) => x.accountId)
  );

  return ids.size === 2;
});

await t("los snapshots no cruzan de proyecto", async () => {
  const otros = await ps.snapshotsDe(OTRO, CAND);

  return otros.filter((x) => x.platform === "facebook").length === 0;
});

await t("el snapshot conserva el proveedor y su estado sin verificar", async () => {
  const serie = await ps.snapshotsDe(PID, CAND);

  const s = serie.find((x) => x.platform === "facebook");

  return s.provider === "brightdata" && s.estado === "UNVERIFIED_PROVIDER";
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
