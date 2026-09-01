// apps/backend/tests/mediaMeasurement.test.mjs

import test from "node:test";
import assert from "node:assert/strict";

import { abrirLake, cerrarLake, escribirLoteEnLake } from "../services/knowledgeLake/lakeQuery.js";

import { TIPOS_ENTIDAD, ZONAS } from "../services/knowledgeLake/lakeWriter.js";

import {
  IDENTIDAD_ACTIVO,
  ESTADO_MEDICION,
  identidadDeActivo,
  puedeMedirse,
  planDeMedicion,
  medirFeed,
  medirSocial,
  medirEntidad,
  matrizMediaActivo,
  resumirMedicion,
  preparacionLongitudinal,
  readinessDeMedia
} from "../services/media/mediaAssetMeasurement.js";

import {
  crearEntidad,
  agregarActivo,
  declararEntidad,
  verificarEntidad,
  CLASES_ACTIVO
} from "../services/media/mediaSourceUniverse.js";

import { medirYGuardar, leerSnapshots, leerPublicaciones } from "../services/media/mediaMeasurementStore.js";

import { CLASES_EMISOR } from "../services/media/pieceContracts.js";

/*
===========================================================
MEDIA-SOURCE-MEASUREMENT-01 — PRUEBAS
===========================================================

Ninguna toca la red: los observadores y los lectores se
inyectan. El benchmark real va aparte.

La mitad comprueban que algo NO se mide. Es el punto del gate:
medir un activo cuya identidad esta en disputa produce cifras
atribuidas a quien no las genero, y eso es peor que no tener
cifras.
===========================================================
*/

const AHORA = "2026-09-01T18:00:00.000Z";

const PROY_A = "test-medicion-a";

const PROY_B = "test-medicion-b";


function entidadCon(activos, extra = {}) {
  const e = crearEntidad({
    projectId: extra.projectId || PROY_A,
    dominio: extra.dominio || "medioa.com",
    canonicalName: extra.canonicalName || "Medio A",
    ...extra
  });

  activos.forEach((a) => agregarActivo(e, a));

  return e;
}


/*
===========================================================
1 · IDENTIDAD ANTES DE MEDIR
===========================================================
*/

test("un activo reclamado por dos entidades queda en CONFLICT y NO se mide", () => {
  const a = entidadCon([{ clase: CLASES_ACTIVO.SOCIAL, plataforma: "x", handle: "compartido" }], {
    dominio: "unoa.com",
    canonicalName: "Uno"
  });

  const b = entidadCon([{ clase: CLASES_ACTIVO.SOCIAL, plataforma: "x", handle: "compartido" }], {
    dominio: "dosb.com",
    canonicalName: "Dos"
  });

  const id = identidadDeActivo({
    entidad: a,
    activo: a.activos[0],
    todasLasEntidades: [a, b]
  });

  assert.equal(id.estado, IDENTIDAD_ACTIVO.CONFLICT);

  assert.equal(puedeMedirse(id), false);

  assert.match(id.razon, /Dos/);
});


test("un activo social sin cuenta identificable queda UNRESOLVED", () => {
  const e = crearEntidad({ projectId: PROY_A, dominio: "medioa.com" });

  e.activos.push({
    assetId: "instagram:sincuenta",
    clase: CLASES_ACTIVO.SOCIAL,
    plataforma: "instagram",
    handle: null,
    url: null,
    evidenceIds: []
  });

  const id = identidadDeActivo({ entidad: e, activo: e.activos[0], todasLasEntidades: [e] });

  assert.equal(id.estado, IDENTIDAD_ACTIVO.UNRESOLVED);

  assert.equal(puedeMedirse(id), false);
});


test("declarado por el analista es referencia fuerte, no verificado por el sistema", () => {
  const e = declararEntidad({
    projectId: PROY_A,
    canonicalName: "Radio X",
    website: "https://radiox.ec"
  });

  const id = identidadDeActivo({ entidad: e, activo: e.activos[0], todasLasEntidades: [e] });

  assert.equal(id.estado, IDENTIDAD_ACTIVO.ANALYST_DECLARED);

  assert.notEqual(id.estado, IDENTIDAD_ACTIVO.VERIFIED);

  assert.equal(puedeMedirse(id), true, "es una referencia fuerte: se mide");

  assert.match(id.razon, /no equivale a verificado/);
});


test("verificar la entidad sube la identidad del activo a VERIFIED", () => {
  const e = declararEntidad({
    projectId: PROY_A,
    canonicalName: "Radio X",
    website: "https://radiox.ec"
  });

  verificarEntidad(e, { por: "analista@test", motivo: "contrastado" });

  const id = identidadDeActivo({ entidad: e, activo: e.activos[0], todasLasEntidades: [e] });

  assert.equal(id.estado, IDENTIDAD_ACTIVO.VERIFIED);
});


test("observarse varias veces corrobora, pero no verifica", () => {
  const e = entidadCon([{ clase: CLASES_ACTIVO.DOMINIO, dominio: "medioa.com" }]);

  e.activos[0].observaciones = 5;

  const id = identidadDeActivo({ entidad: e, activo: e.activos[0], todasLasEntidades: [e] });

  assert.equal(id.estado, IDENTIDAD_ACTIVO.CORROBORATED);

  assert.notEqual(id.estado, IDENTIDAD_ACTIVO.VERIFIED);
});


/*
===========================================================
2 · PLAN Y PRESUPUESTO
===========================================================
*/

test("el plan declara el coste antes de gastar y no ejecuta nada", () => {
  const e = entidadCon([
    { clase: CLASES_ACTIVO.DOMINIO, dominio: "medioa.com" },
    { clase: CLASES_ACTIVO.FEED, url: "https://medioa.com/feed" },
    { clase: CLASES_ACTIVO.SOCIAL, plataforma: "x", handle: "medioa" }
  ]);

  const plan = planDeMedicion({
    entidades: [e],
    credenciales: {},
    presupuesto: { creditosProveedor: 0 }
  });

  assert.equal(plan.items.length, 3);

  assert.equal(plan.presupuesto.creditosPlaneados, 0);

  assert.equal(plan.presupuesto.dentroDelPresupuesto, true);

  assert.match(plan.declaracion, /Ninguna peticion se ha ejecutado/);

  /* Sin credencial, el social no se intenta: no se cuenta una llamada que no sale. */
  const social = plan.items.find((i) => i.plataforma === "x");

  assert.equal(social.estadoPrevisto, ESTADO_MEDICION.REQUIERE_CREDENCIAL);

  assert.equal(social.coste.llamadas, 0);
});


test("el plan excluye los activos con identidad insuficiente", () => {
  const a = entidadCon([{ clase: CLASES_ACTIVO.SOCIAL, plataforma: "x", handle: "compartido" }], {
    dominio: "unoa.com"
  });

  const b = entidadCon([{ clase: CLASES_ACTIVO.SOCIAL, plataforma: "x", handle: "compartido" }], {
    dominio: "dosb.com"
  });

  const plan = planDeMedicion({ entidades: [a, b], credenciales: {} });

  assert.equal(plan.omitidosPorIdentidad, 2);

  plan.items.forEach((i) => {
    if (i.identidad === IDENTIDAD_ACTIVO.CONFLICT) {
      assert.equal(i.coste.llamadas, 0, "un conflicto no gasta nada");
    }
  });
});


/*
===========================================================
3 · OFICIAL PRIMERO, PROVEEDOR SOLO SI LA OFICIAL NO PUEDE
===========================================================
*/

test("la via oficial mide y no se pregunta a nadie mas", async () => {
  const r = await medirSocial(
    { assetId: "x:medioa", clase: CLASES_ACTIVO.SOCIAL, plataforma: "x", handle: "medioa" },
    {
      credenciales: { x: "token" },
      observadores: {
        x: async () => ({
          estado: "OBSERVADA",
          llamadas: 1,
          metricas: { disponibles: ["followers"] }
        })
      }
    }
  );

  assert.equal(r.estado, ESTADO_MEDICION.MEDIDO_OFICIAL);

  assert.equal(r.via, "oficial");

  assert.deepEqual(r.metricas.disponibles, ["followers"]);
});


test("si la oficial NO PUEDE, se declara que haria falta proveedor", async () => {
  const r = await medirSocial(
    { assetId: "instagram:m", clase: CLASES_ACTIVO.SOCIAL, plataforma: "instagram", handle: "m" },
    {
      credenciales: { instagram: "token" },
      observadores: { instagram: async () => ({ estado: "NO_SOPORTADO_PERSONAL", llamadas: 1 }) }
    }
  );

  assert.equal(r.estado, ESTADO_MEDICION.REQUIERE_PROVEEDOR);

  assert.match(r.motivo, /no puede abrirlo/);
});


test("un fallo TEMPORAL nuestro NO abre el fallback de proveedor", async () => {
  const r = await medirSocial(
    { assetId: "x:m", clase: CLASES_ACTIVO.SOCIAL, plataforma: "x", handle: "m" },
    {
      credenciales: { x: "token" },
      proveedorPuede: { x: true },
      observadores: { x: async () => ({ estado: "CREDENCIAL_EXPIRADA", llamadas: 1 }) }
    }
  );

  assert.equal(r.estado, ESTADO_MEDICION.BLOQUEADO);

  assert.match(r.motivo, /fallo NUESTRO/);

  assert.ok(
    !/proveedor/i.test(r.estado),
    "un token caducado se arregla renovando el token, no comprando datos"
  );
});


test("sin credencial no se intenta y no se cuenta ninguna llamada", async () => {
  const r = await medirSocial(
    { assetId: "facebook:m", clase: CLASES_ACTIVO.SOCIAL, plataforma: "facebook", handle: "m" },
    { credenciales: {} }
  );

  assert.equal(r.estado, ESTADO_MEDICION.REQUIERE_CREDENCIAL);

  assert.equal(r.llamadas, 0);
});


test("el fallo de un observador se aisla y no tumba la medicion", async () => {
  const r = await medirSocial(
    { assetId: "x:m", clase: CLASES_ACTIVO.SOCIAL, plataforma: "x", handle: "m" },
    {
      credenciales: { x: "token" },
      observadores: {
        x: async () => {
          throw new Error("el proveedor exploto");
        }
      }
    }
  );

  assert.equal(r.estado, ESTADO_MEDICION.BLOQUEADO);

  assert.match(r.motivo, /el proveedor exploto/);
});


test("una plataforma sin via de observacion es NO_SOPORTADO, no un fallo", async () => {
  const r = await medirSocial(
    { assetId: "threads:m", clase: CLASES_ACTIVO.SOCIAL, plataforma: "threads", handle: "m" },
    { credenciales: { threads: "x" } }
  );

  assert.equal(r.estado, ESTADO_MEDICION.NO_SOPORTADO);
});


/*
===========================================================
4 · FEEDS — contenido, nunca metricas
===========================================================
*/

test("un feed da contenido y se declara PARCIAL, no MEDIDO", async () => {
  const r = await medirFeed(
    { assetId: "feed:x", clase: CLASES_ACTIVO.FEED, url: "https://medioa.com/feed" },
    {
      parseURL: async () => ({
        title: "Medio A",
        items: [
          {
            title: "Titular uno",
            link: "https://medioa.com/n1",
            isoDate: "2026-08-31T10:00:00.000Z",
            creator: "Firma Uno"
          },
          {
            title: "Titular dos",
            link: "https://medioa.com/n2",
            isoDate: "2026-08-30T10:00:00.000Z"
          }
        ]
      })
    }
  );

  assert.equal(r.estado, ESTADO_MEDICION.PARCIAL);

  assert.equal(r.publicaciones.length, 2);

  /* Ni una metrica, y se dice por que. */
  assert.deepEqual(r.metricas.disponibles, []);

  assert.match(r.metricas.nota, /no metricas/i);

  assert.equal(r.cobertura.autoresDistintos, 1);

  assert.deepEqual(r.cobertura.autores, ["Firma Uno"]);
});


test("un feed vacio no es silencio del medio", async () => {
  const r = await medirFeed(
    { assetId: "feed:x", clase: CLASES_ACTIVO.FEED, url: "https://medioa.com/feed" },
    { parseURL: async () => ({ title: "Medio A", items: [] }) }
  );

  assert.equal(r.estado, ESTADO_MEDICION.VACIO);

  assert.match(r.explicacion, /Vacio no es silencio/);
});


test("publishedAt y observedAt no se mezclan, y la fecha pasa por mediaTime", async () => {
  const r = await medirFeed(
    { assetId: "feed:x", clase: CLASES_ACTIVO.FEED, url: "https://medioa.com/feed" },
    {
      parseURL: async () => ({
        items: [
          { title: "T", link: "https://medioa.com/n1", pubDate: "2026-08-31T10:00:00.000Z" },
          { title: "Sin fecha util", link: "https://medioa.com/n2", pubDate: "03/07/2026" }
        ]
      })
    }
  );

  const [uno, dos] = r.publicaciones;

  assert.equal(uno.publishedAt, "2026-08-31T10:00:00.000Z");

  assert.notEqual(uno.publishedAt, uno.observedAt);

  /* La ambigua sigue sin resolverse: no se reimplementa el parser. */
  assert.equal(dos.publishedAt, null);

  assert.equal(dos.publishedAtBruto, "03/07/2026");

  assert.equal(r.cobertura.conFechaUtilizable, 1);
});


/*
===========================================================
5 · NULL NO ES CERO
===========================================================
*/

test("un activo no medido devuelve null en metricas, nunca 0", async () => {
  const e = entidadCon([{ clase: CLASES_ACTIVO.SOCIAL, plataforma: "facebook", handle: "m" }]);

  const medida = await medirEntidad(e, { credenciales: {}, todasLasEntidades: [e] });

  const filas = matrizMediaActivo([medida]);

  assert.equal(filas[0].measurementState, ESTADO_MEDICION.REQUIERE_CREDENCIAL);

  assert.equal(filas[0].metricasDisponibles, null, "null, no lista vacia");

  assert.equal(filas[0].publicaciones, null, "null, no 0");
});


test("la matriz no oculta nulls y explica cada estado", async () => {
  const e = entidadCon([
    { clase: CLASES_ACTIVO.SOCIAL, plataforma: "facebook", handle: "m" },
    { clase: CLASES_ACTIVO.SOCIAL, plataforma: "threads", handle: "t" }
  ]);

  const medida = await medirEntidad(e, { credenciales: {}, todasLasEntidades: [e] });

  matrizMediaActivo([medida]).forEach((f) => {
    assert.ok(f.measurementState);

    assert.ok(f.explicacionMedicion, "cada estado se explica");

    assert.ok(f.identityState);

    assert.ok("metricasDisponibles" in f);

    assert.ok(f.provenance);
  });
});


/*
===========================================================
6 · MULTI-ACTIVO Y COBERTURA
===========================================================
*/

test("dos activos de la misma plataforma se miden por separado", async () => {
  const e = entidadCon([
    { clase: CLASES_ACTIVO.SOCIAL, plataforma: "x", handle: "uno" },
    { clase: CLASES_ACTIVO.SOCIAL, plataforma: "x", handle: "dos" }
  ]);

  const medida = await medirEntidad(e, {
    credenciales: { x: "token" },
    todasLasEntidades: [e],
    observadores: {
      x: async ({ handle }) =>
        handle === "uno"
          ? { estado: "OBSERVADA", llamadas: 1, metricas: { disponibles: ["followers"] } }
          : { estado: "CUOTA_AGOTADA", llamadas: 1 }
    }
  });

  const x = medida.coberturaPorCanal.x;

  assert.equal(x.activos, 2);

  /* Gana el mejor resultado, y el detalle conserva los dos. */
  assert.equal(x.estado, ESTADO_MEDICION.MEDIDO_OFICIAL);

  assert.equal(x.detallePorActivo.length, 2);

  assert.ok(x.detallePorActivo.some((d) => d.estado === ESTADO_MEDICION.BLOQUEADO));
});


test("un canal sin activo conocido no se confunde con no probado", async () => {
  const e = entidadCon([{ clase: CLASES_ACTIVO.DOMINIO, dominio: "medioa.com" }]);

  const medida = await medirEntidad(e, {
    credenciales: {},
    todasLasEntidades: [e],
    canales: { web: false }
  });

  assert.equal(medida.coberturaPorCanal.tiktok.estado, ESTADO_MEDICION.SIN_ACTIVO_CONOCIDO);

  assert.equal(medida.coberturaPorCanal.website.estado, ESTADO_MEDICION.NO_PROBADO);
});


/*
===========================================================
7 · UN DOMINIO DE PLATAFORMA NO ES UN MEDIO
===========================================================
*/

test("no se mide una entidad cuyo activo sea el dominio de una plataforma", () => {
  /*
    El universo ya impide crearla. Aqui se comprueba la otra
    mitad: aunque alguien la construyera a mano, su activo
    social sin handle queda UNRESOLVED y no se mide.
  */
  const e = crearEntidad({ projectId: PROY_A, dominio: "instagram.com" });

  e.activos.push({
    assetId: "instagram:",
    clase: CLASES_ACTIVO.SOCIAL,
    plataforma: "instagram",
    handle: null,
    url: null,
    evidenceIds: []
  });

  const id = identidadDeActivo({ entidad: e, activo: e.activos[0], todasLasEntidades: [e] });

  assert.equal(puedeMedirse(id), false);
});


/*
===========================================================
8 · PERSISTENCIA, DEDUP E IDEMPOTENCIA
===========================================================
*/

function filaPieza(proyectoId, url, dominio) {
  return {
    tenantId: "sentinel-local",
    proyectoId,
    zona: ZONAS.RAW,
    linaje: { submotor: "media_piece", cadena: ["prueba"] },
    motorOrigen: "media_piece_01",
    fuente: dominio,
    urlCanonica: url,
    fechaHecho: null,
    fechaDeteccion: AHORA,
    entidad: url,
    tipoEntidad: TIPOS_ENTIDAD.PUBLICACION,
    datos: {
      clase: "pieza",
      pieceId: `pc-${url}`,
      evidenceId: `ev-${url}`,
      plataforma: "web",
      titulo: null,
      autor: null,
      emisor: { clase: CLASES_EMISOR.MEDIO, nombre: null, dominio }
    }
  };
}


async function sembrar(filas) {
  await abrirLake({ adaptador: "memoria", forzarNueva: true });

  const r = await escribirLoteEnLake(filas, {});

  assert.equal(r.rechazados || 0, 0);
}


test("medir persiste snapshots y publicaciones sin duplicar la misma pieza", async () => {
  await sembrar([filaPieza(PROY_A, "medioa.com/n1", "medioa.com")]);

  const feedSimulado = {
    parseURL: async () => ({
      items: [
        { title: "Uno", link: "https://medioa.com/a", isoDate: "2026-08-31T10:00:00.000Z" },
        { title: "Uno otra vez", link: "https://www.medioa.com/a/", isoDate: "2026-08-31T10:00:00.000Z" },
        { title: "Dos", link: "https://medioa.com/b", isoDate: "2026-08-30T10:00:00.000Z" }
      ]
    })
  };

  const r = await medirYGuardar({
    projectId: PROY_A,
    lake: {},
    credenciales: {},
    canales: { web: false },
    ...feedSimulado
  });

  assert.equal(r.ok, true);

  const publicaciones = await leerPublicaciones({ projectId: PROY_A, lake: {} });

  /*
    La misma URL con y sin www y con barra final es UNA
    publicacion, no tres.
  */
  const claves = publicaciones.map((p) => p.clave);

  assert.equal(new Set(claves).size, claves.length, "ninguna clave repetida");
});


test("reejecutar no duplica publicaciones y si acumula snapshots", async () => {
  await sembrar([filaPieza(PROY_A, "medioa.com/n1", "medioa.com")]);

  const opciones = { projectId: PROY_A, lake: {}, credenciales: {}, canales: { web: false } };

  await medirYGuardar(opciones);

  const pubs1 = await leerPublicaciones({ projectId: PROY_A, lake: {} });

  const snaps1 = await leerSnapshots({ projectId: PROY_A, lake: {} });

  await medirYGuardar(opciones);

  const pubs2 = await leerPublicaciones({ projectId: PROY_A, lake: {} });

  const snaps2 = await leerSnapshots({ projectId: PROY_A, lake: {} });

  assert.equal(pubs2.length, pubs1.length, "las publicaciones no se duplican");

  assert.ok(snaps2.length > snaps1.length, "los snapshots SI se acumulan: son la serie");
});


test("la serie longitudinal se declara y NO se calcula momentum", () => {
  const series = preparacionLongitudinal([
    { mediaEntityId: "media:a", canal: "website", observedAt: "2026-09-01T10:00:00.000Z" },
    { mediaEntityId: "media:a", canal: "website", observedAt: "2026-09-02T10:00:00.000Z" },
    { mediaEntityId: "media:b", canal: "rss", observedAt: "2026-09-01T10:00:00.000Z" }
  ]);

  const a = series.find((s) => s.mediaEntityId === "media:a");

  const b = series.find((s) => s.mediaEntityId === "media:b");

  assert.equal(a.snapshotCount, 2);

  assert.equal(a.readyForLongitudinal, true);

  assert.equal(b.readyForLongitudinal, false);

  assert.match(b.motivo, /NO calcula momentum/);

  /* Ni una cifra de tendencia. */
  series.forEach((s) => {
    assert.equal(s.momentum, undefined);

    assert.equal(s.tendencia, undefined);
  });
});


/*
===========================================================
9 · AISLAMIENTO POR PROYECTO
===========================================================
*/

test("las mediciones de un proyecto no aparecen en otro", async () => {
  await sembrar([
    filaPieza(PROY_A, "medioa.com/n1", "medioa.com"),
    filaPieza(PROY_B, "mediob.com/n1", "mediob.com")
  ]);

  await medirYGuardar({ projectId: PROY_A, lake: {}, credenciales: {}, canales: { web: false } });

  const snapsB = await leerSnapshots({ projectId: PROY_B, lake: {} });

  assert.equal(snapsB.length, 0, "0 fugas");

  const snapsA = await leerSnapshots({ projectId: PROY_A, lake: {} });

  assert.ok(snapsA.length > 0);

  assert.ok(snapsA.every((s) => !s.mediaEntityId.includes("mediob")));
});


test("sin projectId no se mide", async () => {
  const r = await medirYGuardar({ projectId: "", lake: {} });

  assert.equal(r.ok, false);

  assert.match(r.motivo, /POR PROYECTO/);
});


/*
===========================================================
10 · EL UNIVERSO MEDIDO NO ES UN RANKING
===========================================================
*/

test("la medicion no expone posicion ni convierte seguidores en orden", async () => {
  const e = entidadCon([{ clase: CLASES_ACTIVO.SOCIAL, plataforma: "x", handle: "m" }]);

  const medida = await medirEntidad(e, {
    credenciales: { x: "t" },
    todasLasEntidades: [e],
    observadores: {
      x: async () => ({ estado: "OBSERVADA", llamadas: 1, metricas: { disponibles: ["followers"], followers: 99999 } })
    }
  });

  const resumen = resumirMedicion([medida]);

  assert.match(resumen.noEsRanking, /no dice que el medio sea importante/);

  matrizMediaActivo([medida]).forEach((f) => {
    assert.equal(f.rank, undefined);

    assert.equal(f.score, undefined);
  });
});


test("readiness refleja lo medido y nunca redondea hacia arriba", () => {
  assert.equal(readinessDeMedia({ activos: 0, activosMedidos: 0 }).nivel, "NO_OPERATIVO");

  assert.equal(readinessDeMedia({ activos: 10, activosMedidos: 0 }).nivel, "NO_OPERATIVO");

  assert.equal(readinessDeMedia({ activos: 10, activosMedidos: 2 }).nivel, "PARCIAL");

  assert.equal(
    readinessDeMedia({ activos: 10, activosMedidos: 5 }).nivel,
    "OPERATIVO_CON_LIMITACIONES"
  );

  assert.equal(readinessDeMedia({ activos: 10, activosMedidos: 9 }).nivel, "OPERATIVO");
});


/*
===========================================================
11 · SOBRE EL LAKE REAL
===========================================================
*/

test("Lake real: el plan del piloto no gasta creditos y omite los conflictos", async () => {
  cerrarLake();

  await abrirLake({ adaptador: "fichero", forzarNueva: true });

  const r = await medirYGuardar({
    projectId: "alcaldia-cuenca-2027-piloto",
    soloPlan: true,
    lake: {},
    credenciales: {},
    presupuesto: { creditosProveedor: 0 }
  });

  assert.equal(r.ok, true);

  assert.equal(r.ejecutado, false);

  assert.equal(r.plan.presupuesto.creditosPlaneados, 0);

  assert.equal(r.plan.presupuesto.dentroDelPresupuesto, true);

  /* El conflicto real del corpus: x:tomebamba lo reclaman dos entidades. */
  assert.ok(
    r.plan.omitidosPorIdentidad >= 1,
    "el corpus real tiene al menos un activo con identidad insuficiente"
  );

  cerrarLake();
});
