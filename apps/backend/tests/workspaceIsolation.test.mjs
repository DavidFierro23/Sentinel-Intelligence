// apps/backend/tests/workspaceIsolation.test.mjs

import test from "node:test";
import assert from "node:assert/strict";

import { abrirLake, cerrarLake, escribirLoteEnLake } from "../services/knowledgeLake/lakeQuery.js";

import { TIPOS_ENTIDAD, ZONAS } from "../services/knowledgeLake/lakeWriter.js";

import { homeDeProyecto } from "../services/media/mediaHome.js";

import { corpusCanonicoDeProyecto } from "../services/media/mediaCanonicalCorpus.js";

import { universoDeProyecto } from "../services/media/mediaUniverseStore.js";

import { CLASES_EMISOR } from "../services/media/pieceContracts.js";

/*
===========================================================
SENTINEL-UX-CONSOLIDATION-01 — AISLAMIENTO DEL WORKSPACE
===========================================================

El workspace se organiza alrededor de un PROYECTO ACTIVO, asi
que cambiar de proyecto tiene que cambiar el contexto entero.

Lo que estas pruebas protegen es la afirmacion mas facil de
romper de todo el gate: que ninguna vista mezcle datos de dos
campanas. Un panel que suma dos proyectos ensena cifras que no
son de ninguno, y en una prueba real con un cliente delante eso
no se detecta a tiempo.

Se comprueba en los tres modulos project-scoped que tienen
lectura propia. Si alguien quita `projectId` de un filtro, aqui
falla.
===========================================================
*/

const AHORA = "2026-09-03T18:00:00.000Z";

const PROY_A = "test-ux-proyecto-a";

const PROY_B = "test-ux-proyecto-b";


function pieza(proyectoId, url, dominio, extra = {}) {
  return {
    tenantId: "sentinel-local",
    proyectoId,
    zona: ZONAS.RAW,
    linaje: { submotor: "media_piece", cadena: ["prueba"] },
    motorOrigen: "media_piece_01",
    fuente: dominio,
    urlCanonica: url,
    fechaHecho: extra.fechaHecho ?? "2026-09-02T10:00:00.000Z",
    fechaDeteccion: AHORA,
    entidad: url,
    tipoEntidad: TIPOS_ENTIDAD.PUBLICACION,
    datos: {
      clase: "pieza",
      pieceId: `pc-${url}`,
      evidenceId: `ev-${url}`,
      plataforma: "web",
      titulo: extra.titulo ?? null,
      autor: null,
      emisor: { clase: CLASES_EMISOR.MEDIO, nombre: extra.nombre ?? null, dominio }
    }
  };
}


async function sembrar(filas) {
  await abrirLake({ adaptador: "memoria", forzarNueva: true });

  const r = await escribirLoteEnLake(filas, {});

  assert.equal(r.rechazados || 0, 0);
}


test("N · cambiar de proyecto cambia el corpus, el universo y el ranking", async () => {
  await sembrar([
    /* Proyecto A: dos medios. */
    pieza(PROY_A, "medioa.com/a1", "medioa.com", { nombre: "Medio A" }),
    pieza(PROY_A, "medioa.com/a2", "medioa.com", { nombre: "Medio A" }),
    pieza(PROY_A, "otroa.com/a3", "otroa.com", { nombre: "Otro A" }),

    /* Proyecto B: un medio distinto. */
    pieza(PROY_B, "mediob.com/b1", "mediob.com", { nombre: "Medio B" })
  ]);

  /* --- CORPUS --- */
  const corpusA = await corpusCanonicoDeProyecto({ projectId: PROY_A, lake: {} });

  const corpusB = await corpusCanonicoDeProyecto({ projectId: PROY_B, lake: {} });

  assert.equal(corpusA.piezas.length, 3);

  assert.equal(corpusB.piezas.length, 1);

  assert.ok(
    corpusA.piezas.every((p) => p.dominio !== "mediob.com"),
    "el corpus de A no puede contener nada de B"
  );

  assert.ok(corpusB.piezas.every((p) => !String(p.dominio).endsWith("a.com")));

  /* --- UNIVERSO --- */
  const universoA = await universoDeProyecto({ projectId: PROY_A, lake: {} });

  const universoB = await universoDeProyecto({ projectId: PROY_B, lake: {} });

  assert.equal(universoA.entidades.length, 2);

  assert.equal(universoB.entidades.length, 1);

  /* --- RANKING --- */
  const homeA = await homeDeProyecto({
    projectId: PROY_A,
    ventana: "7d",
    ahora: AHORA,
    lake: {}
  });

  const homeB = await homeDeProyecto({
    projectId: PROY_B,
    ventana: "7d",
    ahora: AHORA,
    lake: {}
  });

  assert.equal(homeA.resumen.piezasEnCorpus.valor, 3);

  assert.equal(homeB.resumen.piezasEnCorpus.valor, 1);

  const dominiosA = homeA.presencia.ranking.map((f) => f.dominio);

  assert.ok(!dominiosA.includes("mediob.com"), "0 fugas en el ranking");

  /* Y cada respuesta declara de que proyecto es. */
  assert.equal(homeA.proyecto.projectId, PROY_A);

  assert.equal(homeB.proyecto.projectId, PROY_B);
});


test("N · las evidencias no cruzan de proyecto", async () => {
  await sembrar([
    pieza(PROY_A, "medioa.com/a1", "medioa.com"),
    pieza(PROY_B, "mediob.com/b1", "mediob.com")
  ]);

  const a = await corpusCanonicoDeProyecto({ projectId: PROY_A, lake: {} });

  const evidenciasA = a.piezas.map((p) => p.evidenceId);

  assert.ok(
    evidenciasA.every((e) => !String(e).includes("mediob")),
    "ninguna evidencia de B alcanzable desde A"
  );

  /* El aislamiento se DECLARA, no solo se cumple. */
  assert.ok(a.aislamiento);

  assert.ok(a.aislamiento.filasDeOtrosProyectosExcluidas >= 1);
});


test("N · sin projectId ningun modulo project-scoped devuelve datos", async () => {
  await sembrar([pieza(PROY_A, "medioa.com/a1", "medioa.com")]);

  const corpus = await corpusCanonicoDeProyecto({ projectId: "", lake: {} });

  const universo = await universoDeProyecto({ projectId: "", lake: {} });

  const home = await homeDeProyecto({ projectId: "", lake: {} });

  assert.equal(corpus.ok, false);

  assert.equal(universo.ok, false);

  assert.equal(home.ok, false);

  /*
    Los tres explican POR QUE. Sin proyecto el workspace pide
    elegir uno en lugar de mostrar metricas globales mezcladas.
  */
  [corpus, universo, home].forEach((r) => {
    assert.match(r.motivo, /proyecto/i);
  });
});


test("N · el ranking de un proyecto no se mueve al escribir en otro", async () => {
  await sembrar([
    pieza(PROY_A, "medioa.com/a1", "medioa.com", { nombre: "Medio A" }),
    pieza(PROY_B, "mediob.com/b1", "mediob.com", { nombre: "Medio B" })
  ]);

  const antes = await homeDeProyecto({
    projectId: PROY_A,
    ventana: "7d",
    ahora: AHORA,
    lake: {}
  });

  /* Se escriben tres piezas mas, todas en B. */
  await escribirLoteEnLake(
    [
      pieza(PROY_B, "mediob.com/b2", "mediob.com"),
      pieza(PROY_B, "mediob.com/b3", "mediob.com"),
      pieza(PROY_B, "otrob.com/b4", "otrob.com")
    ],
    {}
  );

  const despues = await homeDeProyecto({
    projectId: PROY_A,
    ventana: "7d",
    ahora: AHORA,
    lake: {}
  });

  assert.equal(
    despues.resumen.piezasEnCorpus.valor,
    antes.resumen.piezasEnCorpus.valor,
    "escribir en B no mueve el corpus de A"
  );

  assert.equal(despues.presencia.ranking.length, antes.presencia.ranking.length);
});


/*
===========================================================
SOBRE EL LAKE REAL — los dos proyectos que existen
===========================================================
*/

test("N · Lake real: el piloto y el proyecto de ensayo no se mezclan", async () => {
  cerrarLake();

  await abrirLake({ adaptador: "fichero", forzarNueva: true });

  const piloto = await homeDeProyecto({
    projectId: "alcaldia-cuenca-2027-piloto",
    ventana: "7d",
    lake: {}
  });

  const ensayo = await homeDeProyecto({
    projectId: "ensayo-tipos-1787962022520",
    ventana: "7d",
    lake: {}
  });

  assert.equal(piloto.ok, true);

  assert.equal(ensayo.ok, true);

  /* El piloto tiene corpus; el de ensayo no. */
  assert.ok(piloto.resumen.piezasEnCorpus.valor > 0);

  assert.equal(ensayo.resumen.piezasEnCorpus.valor, 0);

  assert.equal(ensayo.presencia.ranking.length, 0);

  /*
    Y el proyecto vacio NO muestra un cero como si fuera una
    medicion del ecosistema: declara que no hay corpus.
  */
  assert.ok(ensayo.aislamiento.filasDeOtrosProyectosExcluidas > 0);

  cerrarLake();
});
