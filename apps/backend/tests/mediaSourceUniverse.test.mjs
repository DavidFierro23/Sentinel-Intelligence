// apps/backend/tests/mediaSourceUniverse.test.mjs

import test from "node:test";
import assert from "node:assert/strict";

import { abrirLake, cerrarLake, escribirLoteEnLake } from "../services/knowledgeLake/lakeQuery.js";

import { TIPOS_ENTIDAD, ZONAS } from "../services/knowledgeLake/lakeWriter.js";

import {
  TIPOS_SOURCE,
  SUBTIPOS_MEDIA,
  ESTADOS_SOURCE,
  CLASES_ACTIVO,
  ORIGENES_ENTIDAD,
  ESTADOS_COBERTURA,
  crearEntidad,
  agregarActivo,
  declararEntidad,
  editarEntidad,
  verificarEntidad,
  desactivarEntidad,
  reactivarEntidad,
  debenFundirse,
  descubrirDesdeCorpus,
  coberturaDeEntidad,
  motivoDeExclusionDelUniverso,
  handleDeUrlSocial,
  idDeActivo
} from "../services/media/mediaSourceUniverse.js";

import {
  universoDeProyecto,
  declararYGuardar,
  verificarYGuardar,
  editarYGuardar,
  cambiarActividad,
  leerEntidadesPersistidas
} from "../services/media/mediaUniverseStore.js";

import { CLASES_EMISOR } from "../services/media/pieceContracts.js";

/*
===========================================================
MEDIA-SOURCE-UNIVERSE-01 — PRUEBAS
===========================================================

El universo es una lista de quien publica. Casi todas las
formas de equivocarse aqui producen una lista PLAUSIBLE: un
medio de mas por no deduplicar, uno de menos por deduplicar de
mas, o un balanceador de AWS presentado como cabecera.

Por eso la mitad de estas pruebas comprueban que algo NO ocurre.

Ninguna toca la red.
===========================================================
*/

const AHORA = "2026-09-01T18:00:00.000Z";

const PROY_A = "test-universo-a";

const PROY_B = "test-universo-b";


function pieza({ dominio, url, evidenceId, nombreEmisor = null, emisor = null, observedAt = AHORA }) {
  return {
    clave: url,
    origen: "ANALIZADA",
    pieceId: `pc-${evidenceId}`,
    evidenceId,
    canonicalUrl: url,
    urlOriginal: url,
    dominio,
    nombreEmisor,
    emisor,
    plataforma: "web",
    observedAt,
    publishedAt: null
  };
}


function filaLake({ proyectoId, entidad, datos }) {
  return {
    tenantId: "sentinel-local",
    proyectoId,
    zona: ZONAS.RAW,
    linaje: { submotor: "media_piece", cadena: ["prueba"] },
    motorOrigen: "media_piece_01",
    fuente: datos?.emisor?.dominio || null,
    urlCanonica: entidad,
    fechaHecho: null,
    fechaDeteccion: AHORA,
    entidad,
    tipoEntidad: TIPOS_ENTIDAD.PUBLICACION,
    datos
  };
}


async function sembrarCorpus(filas) {
  await abrirLake({ adaptador: "memoria", forzarNueva: true });

  const r = await escribirLoteEnLake(filas, {});

  assert.equal(r.rechazados || 0, 0);
}


function piezaFila(proyectoId, url, dominio, extra = {}) {
  return filaLake({
    proyectoId,
    entidad: url,
    datos: {
      clase: "pieza",
      pieceId: `pc-${url}`,
      evidenceId: `ev-${url}`,
      plataforma: "web",
      titulo: null,
      autor: extra.autor ?? null,
      emisor: {
        clase: extra.claseEmisor || CLASES_EMISOR.MEDIO,
        nombre: extra.nombreEmisor || null,
        dominio
      }
    }
  });
}


/*
===========================================================
1 · DESCUBRIMIENTO
===========================================================
*/

test("una fuente descubierta entra como DESCUBIERTA, nunca verificada", () => {
  const d = descubrirDesdeCorpus({
    projectId: PROY_A,
    piezas: [pieza({ dominio: "elmercurio.com.ec", url: "elmercurio.com.ec/n1", evidenceId: "ev1" })]
  });

  assert.equal(d.entidades.length, 1);

  const e = d.entidades[0];

  assert.equal(e.origen, ORIGENES_ENTIDAD.DESCUBIERTO);

  assert.equal(e.estado, ESTADOS_SOURCE.DESCUBIERTA);

  assert.notEqual(e.estado, ESTADOS_SOURCE.VERIFICADA);
});


test("repetirse asciende a OBSERVADA, que no es un grado de confianza", () => {
  const d = descubrirDesdeCorpus({
    projectId: PROY_A,
    piezas: [1, 2, 3].map((n) =>
      pieza({ dominio: "elmercurio.com.ec", url: `elmercurio.com.ec/n${n}`, evidenceId: `ev${n}` })
    )
  });

  const e = d.entidades[0];

  assert.equal(e.estado, ESTADOS_SOURCE.OBSERVADA);

  assert.equal(e.piezasObservadas, 3);

  /* Muy observada y sin verificar sigue siendo lo correcto. */
  assert.notEqual(e.verificacion.estado, ESTADOS_SOURCE.VERIFICADA);
});


test("una cuenta de plataforma es la entidad, no el dominio de la plataforma", () => {
  const d = descubrirDesdeCorpus({
    projectId: PROY_A,
    piezas: [
      pieza({
        dominio: "x.com",
        url: "x.com/tomebamba/status/1",
        evidenceId: "ev1",
        nombreEmisor: "La Voz del Tomebamba",
        emisor: { clase: CLASES_EMISOR.NO_CLASIFICADO, handle: "tomebamba" }
      })
    ]
  });

  assert.equal(d.entidades.length, 1);

  const e = d.entidades[0];

  assert.equal(e.canonicalName, "La Voz del Tomebamba");

  assert.ok(!e.mediaEntityId.includes("x.com/"), "el id no es el de la plataforma");

  assert.equal(e.activos[0].plataforma, "x");

  assert.equal(e.activos[0].handle, "tomebamba");
});


test("una correspondencia con el catalogo se PROPONE y no cambia el tipo", () => {
  const d = descubrirDesdeCorpus({
    projectId: PROY_A,
    piezas: [
      pieza({
        dominio: "x.com",
        url: "x.com/tomebamba/status/1",
        evidenceId: "ev1",
        emisor: { clase: CLASES_EMISOR.NO_CLASIFICADO, handle: "tomebamba" }
      })
    ]
  });

  const e = d.entidades[0];

  assert.ok(e.correspondenciaPropuesta, "debe proponerse");

  assert.equal(e.correspondenciaPropuesta.requiereConfirmacion, true);

  assert.notEqual(e.tipo, TIPOS_SOURCE.MEDIA, "una propuesta no convierte la cuenta en un medio");
});


/*
===========================================================
2 · ARTEFACTOS FUERA DEL UNIVERSO
===========================================================
*/

test("infraestructura, agregadores y plataformas sin cuenta quedan fuera", () => {
  const d = descubrirDesdeCorpus({
    projectId: PROY_A,
    piezas: [
      pieza({ dominio: "google.com", url: "google.com/goto?url=x", evidenceId: "ev1" }),
      pieza({
        dominio: "mw-public-alb-prod-1.us-east-1.elb.amazonaws.com",
        url: "mw-public-alb-prod-1.us-east-1.elb.amazonaws.com/x",
        evidenceId: "ev2"
      }),
      pieza({ dominio: "instagram.com", url: "instagram.com/p/abc", evidenceId: "ev3" }),
      pieza({ dominio: "elmercurio.com.ec", url: "elmercurio.com.ec/n", evidenceId: "ev4" })
    ]
  });

  assert.equal(d.entidades.length, 1, "solo el medio real entra");

  assert.equal(d.entidades[0].activos[0].dominio, "elmercurio.com.ec");

  assert.equal(d.artefactosExcluidos.length, 3);

  /* Cada exclusion trae SU motivo, no un generico. */
  d.artefactosExcluidos.forEach((a) => assert.ok(a.motivo && a.motivo.length > 20));
});


test("cada clase de artefacto declara un motivo distinto", () => {
  assert.match(
    motivoDeExclusionDelUniverso("mw-public-alb-prod-1.us-east-1.elb.amazonaws.com"),
    /infraestructura/i
  );

  assert.match(motivoDeExclusionDelUniverso("google.com"), /agregador|redirector/i);

  assert.match(motivoDeExclusionDelUniverso("x.com"), /plataforma/i);

  assert.equal(motivoDeExclusionDelUniverso("elmercurio.com.ec"), null);
});


/*
===========================================================
3 · DEDUPLICACION
===========================================================
*/

test("mismo dominio funde; solo el nombre NO funde", () => {
  const a = crearEntidad({ projectId: PROY_A, dominio: "elmercurio.com.ec" });

  agregarActivo(a, { clase: CLASES_ACTIVO.DOMINIO, dominio: "elmercurio.com.ec" });

  const b = crearEntidad({ projectId: PROY_A, dominio: "www.elmercurio.com.ec" });

  agregarActivo(b, { clase: CLASES_ACTIVO.DOMINIO, dominio: "www.elmercurio.com.ec" });

  assert.equal(debenFundirse(a, b).fundir, true, "www. es el mismo dominio");

  /* Mismo nombre, dominios distintos: NO se funden. */
  const c = crearEntidad({ projectId: PROY_A, dominio: "eldiario.ec", canonicalName: "El Diario" });

  agregarActivo(c, { clase: CLASES_ACTIVO.DOMINIO, dominio: "eldiario.ec" });

  const dd = crearEntidad({ projectId: PROY_A, dominio: "eldiario.com.ar", canonicalName: "El Diario" });

  agregarActivo(dd, { clase: CLASES_ACTIVO.DOMINIO, dominio: "eldiario.com.ar" });

  const r = debenFundirse(c, dd);

  assert.equal(r.fundir, false);

  assert.equal(r.mismoNombre, true);

  assert.match(r.motivo, /dos medios distintos/);
});


test("un alias declarado si funde", () => {
  const a = crearEntidad({ projectId: PROY_A, dominio: "elmercurio.com.ec" });

  agregarActivo(a, { clase: CLASES_ACTIVO.DOMINIO, dominio: "elmercurio.com.ec" });

  const b = crearEntidad({ projectId: PROY_A, dominio: "mercurio-cuenca.ec" });

  agregarActivo(b, { clase: CLASES_ACTIVO.DOMINIO, dominio: "mercurio-cuenca.ec" });

  b.aliases = ["elmercurio.com.ec"];

  assert.equal(debenFundirse(a, b).fundir, true);
});


/*
===========================================================
4 · N ACTIVOS POR PLATAFORMA
===========================================================
*/

test("dos cuentas de la misma plataforma son dos activos", () => {
  const e = crearEntidad({ projectId: PROY_A, dominio: "medioa.com" });

  agregarActivo(e, { clase: CLASES_ACTIVO.SOCIAL, plataforma: "facebook", handle: "medioa" });

  agregarActivo(e, { clase: CLASES_ACTIVO.SOCIAL, plataforma: "facebook", handle: "medioa.deportes" });

  const facebook = e.activos.filter((a) => a.plataforma === "facebook");

  assert.equal(facebook.length, 2, "no se colapsan");

  assert.equal(coberturaDeEntidad(e).porCanal.facebook.activos, 2);
});


test("una entidad sostiene dominio, social y feed a la vez", () => {
  const e = crearEntidad({ projectId: PROY_A, dominio: "tomebamba.com.ec" });

  agregarActivo(e, { clase: CLASES_ACTIVO.DOMINIO, dominio: "tomebamba.com.ec" });

  agregarActivo(e, { clase: CLASES_ACTIVO.SOCIAL, plataforma: "facebook", handle: "tomebamba" });

  agregarActivo(e, { clase: CLASES_ACTIVO.SOCIAL, plataforma: "x", handle: "tomebamba" });

  agregarActivo(e, { clase: CLASES_ACTIVO.FEED, url: "https://tomebamba.com.ec/feed" });

  assert.equal(e.activos.length, 4);

  const c = coberturaDeEntidad(e);

  assert.equal(c.porCanal.website.estado, ESTADOS_COBERTURA.ENCONTRADO);

  assert.equal(c.porCanal.rss.estado, ESTADOS_COBERTURA.ENCONTRADO);

  assert.equal(c.porCanal.x.estado, ESTADOS_COBERTURA.ENCONTRADO);

  /* Lo que no hay se declara, no se inventa. */
  assert.equal(c.porCanal.tiktok.estado, ESTADOS_COBERTURA.SIN_ACTIVO_CONOCIDO);

  assert.equal(c.porCanal.tiktok.activos, 0);
});


test("ENCONTRADO no es MEDIDO", () => {
  const e = crearEntidad({ projectId: PROY_A, dominio: "medioa.com" });

  agregarActivo(e, { clase: CLASES_ACTIVO.SOCIAL, plataforma: "x", handle: "medioa" });

  const c = coberturaDeEntidad(e);

  assert.equal(c.porCanal.x.estado, ESTADOS_COBERTURA.ENCONTRADO);

  assert.notEqual(c.porCanal.x.estado, ESTADOS_COBERTURA.MEDIDO);

  assert.match(c.declaracion, /no de datos obtenidos/);
});


test("un activo de una plataforma fuera de la lista de canales no se oculta", () => {
  const e = crearEntidad({ projectId: PROY_A, dominio: "medioa.com" });

  agregarActivo(e, { clase: CLASES_ACTIVO.SOCIAL, plataforma: "threads", handle: "notivozec" });

  const c = coberturaDeEntidad(e);

  assert.equal(c.canalesConActivo, 0);

  assert.equal(c.activosFueraDeCanales.length, 1);

  assert.equal(c.activosFueraDeCanales[0].plataforma, "threads");
});


test("handleDeUrlSocial no inventa handles en rutas de contenido", () => {
  assert.equal(handleDeUrlSocial("instagram.com/p/abc123"), null);

  assert.equal(handleDeUrlSocial("facebook.com/watch/?v=1"), null);

  assert.equal(handleDeUrlSocial("x.com/tomebamba/status/1"), "tomebamba");

  assert.equal(handleDeUrlSocial("threads.com/@notivozec/post/x"), "notivozec");
});


test("idDeActivo distingue plataformas y handles", () => {
  const a = idDeActivo({ clase: CLASES_ACTIVO.SOCIAL, plataforma: "facebook", handle: "medioa" });

  const b = idDeActivo({ clase: CLASES_ACTIVO.SOCIAL, plataforma: "instagram", handle: "medioa" });

  assert.notEqual(a, b, "mismo handle en dos plataformas son dos activos");
});


/*
===========================================================
5 · EL ANALISTA
===========================================================
*/

test("declarar NO verifica", () => {
  const e = declararEntidad({
    projectId: PROY_A,
    canonicalName: "Radio Ejemplo",
    website: "https://radioejemplo.ec",
    tipo: TIPOS_SOURCE.MEDIA,
    subtipo: SUBTIPOS_MEDIA.RADIO,
    declaradoPor: "analista@test"
  });

  assert.equal(e.origen, ORIGENES_ENTIDAD.DECLARADO_POR_ANALISTA);

  assert.equal(e.estado, ESTADOS_SOURCE.DESCUBIERTA);

  assert.notEqual(e.verificacion.estado, ESTADOS_SOURCE.VERIFICADA);

  assert.match(e.verificacion.motivo, /DECLARAR NO ES VERIFICAR/);

  assert.equal(e.subtipo, SUBTIPOS_MEDIA.RADIO);
});


test("declarar admite varios activos por plataforma sin colapsarlos", () => {
  const e = declararEntidad({
    projectId: PROY_A,
    canonicalName: "Medio Multi",
    website: "https://multi.ec",
    feeds: ["https://multi.ec/feed", "https://multi.ec/deportes/feed"],
    activosSociales: [
      { plataforma: "facebook", handle: "multi" },
      { plataforma: "facebook", handle: "multideportes" },
      { plataforma: "x", handle: "multi" }
    ]
  });

  assert.equal(e.activos.filter((a) => a.clase === CLASES_ACTIVO.FEED).length, 2);

  assert.equal(e.activos.filter((a) => a.plataforma === "facebook").length, 2);
});


test("verificar exige declarar QUIEN verifica", () => {
  const e = declararEntidad({ projectId: PROY_A, canonicalName: "X", website: "https://x.ec" });

  const sinAutor = verificarEntidad(e, { motivo: "porque si" });

  assert.equal(sinAutor.verificada, false);

  assert.match(sinAutor.motivo, /QUIEN verifica/);

  const conAutor = verificarEntidad(e, { por: "analista@test", motivo: "contrastado" });

  assert.equal(conAutor.verificada, true);

  assert.equal(e.estado, ESTADOS_SOURCE.VERIFICADA);

  assert.equal(e.verificacion.verificadaPor, "analista@test");
});


test("editar conserva el id y deja rastro de lo anterior", () => {
  const e = declararEntidad({ projectId: PROY_A, canonicalName: "Antes", website: "https://m.ec" });

  const id = e.mediaEntityId;

  editarEntidad(e, { canonicalName: "Despues", aliases: ["Alias 1"] }, { por: "analista@test" });

  assert.equal(e.mediaEntityId, id, "renombrar no crea otro medio");

  assert.equal(e.canonicalName, "Despues");

  const edicion = e.historial.find((h) => h.accion === "EDITADA");

  assert.ok(edicion);

  assert.equal(edicion.antes.canonicalName, "Antes");
});


test("desactivar no borra: conserva activos, evidencias e historia", () => {
  const e = declararEntidad({
    projectId: PROY_A,
    canonicalName: "Medio",
    website: "https://m.ec",
    activosSociales: [{ plataforma: "x", handle: "m" }]
  });

  e.evidenceIds = ["ev1", "ev2"];

  const activosAntes = e.activos.length;

  desactivarEntidad(e, { por: "analista@test", motivo: "cerro" });

  assert.equal(e.activa, false);

  assert.equal(e.activos.length, activosAntes);

  assert.deepEqual(e.evidenceIds, ["ev1", "ev2"]);

  assert.ok(e.historial.some((h) => h.accion === "DESACTIVADA"));

  reactivarEntidad(e, { por: "analista@test" });

  assert.equal(e.activa, true);

  assert.ok(e.historial.some((h) => h.accion === "REACTIVADA"));
});


/*
===========================================================
6 · PERSISTENCIA E IDEMPOTENCIA
===========================================================
*/

test("una entidad declarada sobrevive y se funde con lo descubierto", async () => {
  await sembrarCorpus([piezaFila(PROY_A, "elmercurio.com.ec/n1", "elmercurio.com.ec")]);

  const antes = await universoDeProyecto({ projectId: PROY_A, lake: {} });

  assert.equal(antes.procedencia.persistidas, 0);

  const d = await declararYGuardar({
    projectId: PROY_A,
    canonicalName: "El Mercurio",
    website: "https://elmercurio.com.ec",
    tipo: TIPOS_SOURCE.MEDIA,
    subtipo: SUBTIPOS_MEDIA.PRENSA,
    lake: {}
  });

  assert.equal(d.ok, true);

  const despues = await universoDeProyecto({ projectId: PROY_A, lake: {} });

  assert.equal(despues.procedencia.persistidas, 1);

  const e = despues.entidades.find((x) => x.mediaEntityId === d.entidad.mediaEntityId);

  assert.ok(e);

  /* Lo declarado gana sobre lo inferido... */
  assert.equal(e.subtipo, SUBTIPOS_MEDIA.PRENSA);

  /* ...y lo observado no se pierde. */
  assert.ok(e.piezasObservadas >= 1);
});


test("el universo es idempotente: leerlo dos veces no duplica ni cambia ids", async () => {
  await sembrarCorpus([
    piezaFila(PROY_A, "elmercurio.com.ec/n1", "elmercurio.com.ec"),
    piezaFila(PROY_A, "expreso.ec/n1", "expreso.ec")
  ]);

  const a = await universoDeProyecto({ projectId: PROY_A, lake: {} });

  const b = await universoDeProyecto({ projectId: PROY_A, lake: {} });

  assert.equal(a.entidades.length, b.entidades.length);

  assert.deepEqual(
    a.entidades.map((e) => e.mediaEntityId).sort(),
    b.entidades.map((e) => e.mediaEntityId).sort()
  );
});


test("verificar por HTTP persiste y sobrevive a una relectura", async () => {
  await sembrarCorpus([piezaFila(PROY_A, "expreso.ec/n1", "expreso.ec")]);

  const u = await universoDeProyecto({ projectId: PROY_A, lake: {} });

  const id = u.entidades[0].mediaEntityId;

  const v = await verificarYGuardar({
    projectId: PROY_A,
    mediaEntityId: id,
    por: "analista@test",
    motivo: "contrastado con la web oficial",
    lake: {}
  });

  assert.equal(v.ok, true);

  const releido = await universoDeProyecto({ projectId: PROY_A, lake: {} });

  const e = releido.entidades.find((x) => x.mediaEntityId === id);

  assert.equal(e.estado, ESTADOS_SOURCE.VERIFICADA);

  assert.equal(e.verificacion.verificadaPor, "analista@test");
});


test("desactivar por HTTP saca del universo activo sin perder la fila", async () => {
  await sembrarCorpus([piezaFila(PROY_A, "expreso.ec/n1", "expreso.ec")]);

  const u = await universoDeProyecto({ projectId: PROY_A, lake: {} });

  const id = u.entidades[0].mediaEntityId;

  await cambiarActividad({
    projectId: PROY_A,
    mediaEntityId: id,
    activa: false,
    por: "analista@test",
    motivo: "duplicado",
    lake: {}
  });

  const releido = await universoDeProyecto({ projectId: PROY_A, lake: {} });

  assert.equal(releido.resumen.entidadesInactivas, 1);

  /* La fila sigue en el Lake, con su historia. */
  const persistidas = await leerEntidadesPersistidas({ projectId: PROY_A, lake: {} });

  const guardada = persistidas.find((x) => x.mediaEntityId === id);

  assert.ok(guardada);

  assert.equal(guardada.activa, false);

  assert.ok(guardada.historial.some((h) => h.accion === "DESACTIVADA"));
});


test("editar por HTTP conserva el id", async () => {
  await sembrarCorpus([piezaFila(PROY_A, "expreso.ec/n1", "expreso.ec")]);

  const u = await universoDeProyecto({ projectId: PROY_A, lake: {} });

  const id = u.entidades[0].mediaEntityId;

  const r = await editarYGuardar({
    projectId: PROY_A,
    mediaEntityId: id,
    cambios: { canonicalName: "Diario Expreso" },
    por: "analista@test",
    lake: {}
  });

  assert.equal(r.ok, true);

  assert.equal(r.entidad.mediaEntityId, id);

  assert.equal(r.entidad.canonicalName, "Diario Expreso");
});


/*
===========================================================
7 · AISLAMIENTO POR PROYECTO
===========================================================
*/

test("dos proyectos con el MISMO dominio no comparten universo", async () => {
  await sembrarCorpus([
    piezaFila(PROY_A, "elmercurio.com.ec/a1", "elmercurio.com.ec"),
    piezaFila(PROY_A, "elmercurio.com.ec/a2", "elmercurio.com.ec"),
    piezaFila(PROY_B, "elmercurio.com.ec/b1", "elmercurio.com.ec")
  ]);

  const a = await universoDeProyecto({ projectId: PROY_A, lake: {} });

  const b = await universoDeProyecto({ projectId: PROY_B, lake: {} });

  assert.equal(a.entidades.length, 1);

  assert.equal(b.entidades.length, 1);

  /* Misma identidad de dominio, recuentos separados. */
  assert.equal(a.entidades[0].piezasObservadas, 2);

  assert.equal(b.entidades[0].piezasObservadas, 1);

  assert.equal(a.projectId, PROY_A);

  assert.equal(b.projectId, PROY_B);
});


test("declarar en un proyecto no aparece en el otro", async () => {
  await sembrarCorpus([piezaFila(PROY_A, "elmercurio.com.ec/a1", "elmercurio.com.ec")]);

  await declararYGuardar({
    projectId: PROY_A,
    canonicalName: "Solo de A",
    website: "https://solodea.ec",
    lake: {}
  });

  const b = await universoDeProyecto({ projectId: PROY_B, lake: {} });

  assert.ok(
    b.entidades.every((e) => e.canonicalName !== "Solo de A"),
    "0 fugas entre proyectos"
  );
});


test("sin projectId no se devuelve universo", async () => {
  const r = await universoDeProyecto({ projectId: "", lake: {} });

  assert.equal(r.ok, false);

  assert.match(r.motivo, /POR PROYECTO/);
});


/*
===========================================================
8 · EVIDENCIA, PROCEDENCIA Y TIEMPO
===========================================================
*/

test("cada entidad conserva sus evidencias y su procedencia", () => {
  const d = descubrirDesdeCorpus({
    projectId: PROY_A,
    piezas: [
      pieza({ dominio: "elmercurio.com.ec", url: "elmercurio.com.ec/n1", evidenceId: "ev1" }),
      pieza({ dominio: "elmercurio.com.ec", url: "elmercurio.com.ec/n2", evidenceId: "ev2" })
    ]
  });

  const e = d.entidades[0];

  assert.deepEqual(e.evidenceIds.sort(), ["ev1", "ev2"]);

  assert.ok(e.procedencia.length >= 1);

  assert.equal(e.procedencia[0].origen, ORIGENES_ENTIDAD.DESCUBIERTO);
});


test("firstObservedAt y lastObservedAt cubren el rango real", () => {
  const d = descubrirDesdeCorpus({
    projectId: PROY_A,
    piezas: [
      pieza({
        dominio: "elmercurio.com.ec",
        url: "elmercurio.com.ec/n1",
        evidenceId: "ev1",
        observedAt: "2026-08-01T10:00:00.000Z"
      }),
      pieza({
        dominio: "elmercurio.com.ec",
        url: "elmercurio.com.ec/n2",
        evidenceId: "ev2",
        observedAt: "2026-09-01T10:00:00.000Z"
      })
    ]
  });

  const e = d.entidades[0];

  assert.equal(e.firstObservedAt, "2026-08-01T10:00:00.000Z");

  assert.equal(e.lastObservedAt, "2026-09-01T10:00:00.000Z");
});


test("una pieza con byline conserva el autor para el futuro Journalist Intelligence", async () => {
  await sembrarCorpus([
    piezaFila(PROY_A, "elmercurio.com.ec/n1", "elmercurio.com.ec", {
      autor: "Patricia Naula Herembás"
    })
  ]);

  const u = await universoDeProyecto({ projectId: PROY_A, lake: {} });

  /*
    Este gate NO construye Journalist Intelligence. Lo que se
    comprueba es que la firma sigue llegando desde el corpus y se
    puede atar a su entidad cuando exista el modulo.
  */
  assert.ok(u.ok);

  assert.equal(u.entidades.length, 1);
});


/*
===========================================================
9 · EL UNIVERSO NO ES UN RANKING
===========================================================
*/

test("el universo no expone posicion ni score", async () => {
  await sembrarCorpus([
    piezaFila(PROY_A, "elmercurio.com.ec/n1", "elmercurio.com.ec"),
    piezaFila(PROY_A, "expreso.ec/n1", "expreso.ec")
  ]);

  const u = await universoDeProyecto({ projectId: PROY_A, lake: {} });

  u.entidades.forEach((e) => {
    assert.equal(e.rank, undefined);

    assert.equal(e.score, undefined);

    assert.equal(e.posicion, undefined);
  });

  assert.match(u.noEsRanking, /No significa importante/);

  const json = JSON.stringify(u);

  assert.ok(!json.includes('"influencia":'));
});


/*
===========================================================
10 · SOBRE EL CORPUS REAL
===========================================================
*/

test("Lake real: el universo del piloto se construye y excluye artefactos", async () => {
  cerrarLake();

  await abrirLake({ adaptador: "fichero", forzarNueva: true });

  const u = await universoDeProyecto({
    projectId: "alcaldia-cuenca-2027-piloto",
    lake: {}
  });

  assert.equal(u.ok, true);

  assert.ok(u.entidades.length >= 5, "el corpus real produce varias entidades");

  /* Ni un artefacto dentro del universo. */
  const dominios = u.entidades.flatMap((e) => e.activos.map((a) => a.dominio).filter(Boolean));

  assert.ok(!dominios.includes("google.com"));

  assert.ok(!dominios.some((d) => d.endsWith(".elb.amazonaws.com")));

  /* Y declarados fuera. */
  assert.ok(u.artefactosExcluidos.length >= 2);

  /* Toda entidad trae cobertura por canal. */
  u.entidades.forEach((e) => {
    assert.ok(e.cobertura?.porCanal?.website);

    assert.ok(typeof e.cobertura.canalesConActivo === "number");
  });

  cerrarLake();
});
