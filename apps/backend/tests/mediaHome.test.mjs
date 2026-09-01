// apps/backend/tests/mediaHome.test.mjs

import test from "node:test";
import assert from "node:assert/strict";

import { abrirLake, cerrarLake, escribirLoteEnLake } from "../services/knowledgeLake/lakeQuery.js";

import { TIPOS_ENTIDAD, ZONAS } from "../services/knowledgeLake/lakeWriter.js";

import {
  leerCorpusDeProyecto,
  resolverVentana,
  aplicarVentana,
  instanteIso,
  clavePieza
} from "../services/media/mediaCorpus.js";

import { homeDeProyecto, medida, medidaEnVentana } from "../services/media/mediaHome.js";

import { historialDePieza } from "../services/media/pieceStore.js";

import {
  DIMENSIONES,
  ESTADOS_DATO,
  SECCIONES,
  TERMINOS_PROHIBIDOS,
  GRUPOS_FUENTE,
  preguntasRespondibles
} from "../services/media/mediaVocabulary.js";

import { CLASES_EMISOR } from "../services/media/pieceContracts.js";

/*
===========================================================
MEDIA-UX-HOME-01 — PRUEBAS
===========================================================

Dos clases de prueba, y la diferencia importa:

  SINTETICAS  Lake en memoria, corpus fabricado a medida.
              Comprueban REGLAS: aislamiento, vigencia,
              ventanas, ausencia de ceros falsos.

  SOBRE EL LAKE REAL  Lake de fichero, proyecto piloto.
              Comprueban INVARIANTES, nunca cifras exactas:
              el corpus crece cada vez que alguien analiza una
              pieza, y una prueba anclada a «7 piezas» estaria
              rota manana sin que nada se hubiera roto.

Ninguna prueba toca la red ni consume cuota.
===========================================================
*/


const AHORA = "2026-08-31T18:00:00.000Z";

const PROYECTO_A = "test-home-proyecto-a";

const PROYECTO_B = "test-home-proyecto-b";


function fila({
  proyectoId,
  entidad,
  tipoEntidad = TIPOS_ENTIDAD.PUBLICACION,
  fuente = null,
  fechaHecho = null,
  fechaDeteccion = AHORA,
  urlCanonica = null,
  datos = {}
}) {
  return {
    tenantId: "sentinel-local",
    proyectoId,
    zona: ZONAS.RAW,

    linaje: { submotor: "media_piece", cadena: ["prueba"] },

    motorOrigen: "media_piece_01",
    fuente,
    consulta: null,

    urlOriginal: null,
    urlCanonica: urlCanonica || entidad,

    fechaHecho,
    fechaDeteccion,

    entidad,
    tipoEntidad,
    datos
  };
}


function piezaFila(proyectoId, entidad, extra = {}) {
  return fila({
    proyectoId,
    entidad,
    fuente: extra.fuente || null,
    fechaHecho: extra.fechaHecho ?? null,
    fechaDeteccion: extra.fechaDeteccion || AHORA,

    datos: {
      clase: "pieza",
      pieceId: extra.pieceId || `pc-${entidad}`,
      evidenceId: extra.evidenceId || `ev-${entidad}`,
      plataforma: extra.plataforma || "web",
      contentType: "pagina_web",
      titulo: extra.titulo ?? null,
      autor: extra.autor ?? null,

      emisor: extra.emisor || {
        clase: CLASES_EMISOR.MEDIO,
        nombre: extra.nombreEmisor || null,
        dominio: extra.fuente || null
      }
    }
  });
}


async function sembrar(filas) {
  await abrirLake({ adaptador: "memoria", forzarNueva: true });

  const r = await escribirLoteEnLake(filas, {});

  assert.equal(
    r.rechazados || 0,
    0,
    `el Lake rechazo filas de la siembra: ${JSON.stringify(r.resultados?.filter((x) => !x.escrito))}`
  );
}


/*
===========================================================
1 · AISLAMIENTO POR PROYECTO
===========================================================
*/

test("aislamiento: el corpus de un proyecto no incluye ni una fila de otro", async () => {
  await sembrar([
    piezaFila(PROYECTO_A, "medioa.com/nota-1", { fuente: "medioa.com" }),
    piezaFila(PROYECTO_A, "medioa.com/nota-2", { fuente: "medioa.com" }),
    piezaFila(PROYECTO_B, "mediob.com/nota-1", { fuente: "mediob.com" }),
    piezaFila(PROYECTO_B, "mediob.com/nota-2", { fuente: "mediob.com" }),
    piezaFila(PROYECTO_B, "mediob.com/nota-3", { fuente: "mediob.com" })
  ]);

  const a = await leerCorpusDeProyecto({ projectId: PROYECTO_A, lake: {} });

  const b = await leerCorpusDeProyecto({ projectId: PROYECTO_B, lake: {} });

  assert.equal(a.piezas.length, 2);

  assert.equal(b.piezas.length, 3);

  /* Ningun dominio del proyecto B aparece en el corpus del A. */
  assert.ok(a.fuentes.every((f) => f.dominio !== "mediob.com"));

  assert.ok(b.fuentes.every((f) => f.dominio !== "medioa.com"));
});


test("aislamiento: lo excluido se declara con su recuento, no se calla", async () => {
  await sembrar([
    piezaFila(PROYECTO_A, "medioa.com/nota-1", { fuente: "medioa.com" }),
    piezaFila(PROYECTO_B, "mediob.com/nota-1", { fuente: "mediob.com" }),
    piezaFila(PROYECTO_B, "mediob.com/nota-2", { fuente: "mediob.com" })
  ]);

  const a = await leerCorpusDeProyecto({ projectId: PROYECTO_A, lake: {} });

  assert.equal(a.aislamiento.filasDeOtrosProyectosExcluidas, 2);

  assert.ok(a.aislamiento.proyectosDeMediaEnLake.includes(PROYECTO_B));

  assert.match(a.aislamiento.declaracion, /Excluidas 2 fila/);
});


test("aislamiento: sin projectId no se devuelve corpus, se devuelve el motivo", async () => {
  const r = await leerCorpusDeProyecto({ projectId: "", lake: {} });

  assert.equal(r.ok, false);

  assert.match(r.motivo, /projectId/);
});


/*
===========================================================
2 · VIGENCIA Y DEDUPLICACION
===========================================================
*/

test("vigencia: reanalizar la misma pieza NO aumenta su presencia", async () => {
  const base = () =>
    piezaFila(PROYECTO_A, "medioa.com/nota-1", {
      fuente: "medioa.com",
      titulo: "Titular original"
    });

  await sembrar([base()]);

  const antes = await leerCorpusDeProyecto({ projectId: PROYECTO_A, lake: {} });

  /* Tres reanalisis de la MISMA pieza: filas nuevas, entidad unica. */
  await escribirLoteEnLake(
    [
      piezaFila(PROYECTO_A, "medioa.com/nota-1", {
        fuente: "medioa.com",
        titulo: "Titular corregido"
      }),
      piezaFila(PROYECTO_A, "medioa.com/nota-1", {
        fuente: "medioa.com",
        titulo: "Titular corregido otra vez"
      })
    ],
    {}
  );

  const despues = await leerCorpusDeProyecto({ projectId: PROYECTO_A, lake: {} });

  assert.equal(antes.piezas.length, 1);

  assert.equal(despues.piezas.length, 1, "tres versiones siguen siendo una pieza");

  const fuente = despues.fuentes.find((f) => f.dominio === "medioa.com");

  assert.equal(fuente.piezasObservadas, 1);
});


test("dedup: la misma URL con y sin esquema es UNA pieza, y el colapso se declara", async () => {
  await sembrar([
    piezaFila(PROYECTO_A, "https://medioa.com/nota-1", { fuente: "medioa.com" }),
    piezaFila(PROYECTO_A, "medioa.com/nota-1", { fuente: "medioa.com" })
  ]);

  const c = await leerCorpusDeProyecto({ projectId: PROYECTO_A, lake: {} });

  assert.equal(c.piezas.length, 1);

  assert.ok(c.lectura.clavesColapsadas >= 1);
});


test("clavePieza normaliza esquema, www y barra final a la misma clave", () => {
  const esperada = "medioa.com/nota-1";

  assert.equal(clavePieza("https://medioa.com/nota-1"), esperada);

  assert.equal(clavePieza("https://www.medioa.com/nota-1/"), esperada);

  assert.equal(clavePieza("medioa.com/nota-1"), esperada);
});


/*
===========================================================
3 · VENTANAS
===========================================================
*/

test("ventanas: las cinco existen y HOY es un subconjunto de todas", () => {
  const ids = ["hoy", "7d", "15d", "30d", "90d"];

  const ventanas = ids.map((id) => resolverVentana(id, AHORA));

  ids.forEach((id, i) => assert.equal(ventanas[i].id, id));

  const hoy = ventanas[0];

  ventanas.slice(1).forEach((v) => {
    assert.ok(
      new Date(v.desde).getTime() <= new Date(hoy.desde).getTime(),
      `${v.id} debe empezar antes o a la vez que HOY`
    );

    assert.equal(v.hasta, hoy.hasta, "todas terminan en el mismo instante que HOY");
  });
});


test("ventanas: HOY es el dia calendario de America/Guayaquil, no 24 horas rodantes", () => {
  /* 03:00 UTC del 31 son las 22:00 del 30 en Guayaquil (UTC-5). */
  const v = resolverVentana("hoy", "2026-08-31T03:00:00.000Z");

  assert.equal(v.zona, "America/Guayaquil");

  assert.equal(v.fechaLocal, "2026-08-30");

  assert.equal(v.desde, "2026-08-30T05:00:00.000Z");
});


test("ventanas: filtran datos reales, no solo la etiqueta", async () => {
  await sembrar([
    piezaFila(PROYECTO_A, "medioa.com/hoy", {
      fuente: "medioa.com",
      fechaHecho: "2026-08-31T15:00:00.000Z"
    }),
    piezaFila(PROYECTO_A, "medioa.com/hace-diez-dias", {
      fuente: "medioa.com",
      fechaHecho: "2026-08-21T15:00:00.000Z"
    }),
    piezaFila(PROYECTO_A, "medioa.com/hace-un-ano", {
      fuente: "medioa.com",
      fechaHecho: "2025-08-31T15:00:00.000Z"
    })
  ]);

  const hoy = await homeDeProyecto({
    projectId: PROYECTO_A,
    ventana: "hoy",
    ahora: AHORA,
    lake: {}
  });

  const quince = await homeDeProyecto({
    projectId: PROYECTO_A,
    ventana: "15d",
    ahora: AHORA,
    lake: {}
  });

  const noventa = await homeDeProyecto({
    projectId: PROYECTO_A,
    ventana: "90d",
    ahora: AHORA,
    lake: {}
  });

  assert.equal(hoy.resumen.piezasObservadas.valor, 1);

  assert.equal(quince.resumen.piezasObservadas.valor, 2);

  assert.equal(noventa.resumen.piezasObservadas.valor, 2);

  /* El corpus no depende de la ventana. */
  assert.equal(noventa.resumen.piezasEnCorpus.valor, 3);
});


test("ventanas: una fecha que no es ISO no se interpreta, se declara", async () => {
  await sembrar([
    piezaFila(PROYECTO_A, "medioa.com/sin-fecha", {
      fuente: "medioa.com",
      /* Lo que devuelve un buscador. No es ISO y no se adivina. */
      fechaHecho: "3 jul 2026"
    })
  ]);

  const c = await leerCorpusDeProyecto({ projectId: PROYECTO_A, lake: {} });

  assert.equal(c.piezas[0].publishedAt, null);

  assert.equal(c.piezas[0].publishedAtBruto, "3 jul 2026");

  assert.equal(
    c.piezas[0].fechaPublicacionEstado,
    ESTADOS_DATO.FECHA_NO_NORMALIZADA
  );

  assert.equal(c.fechas.piezasSinFechaNormalizada, 1);
});


test("instanteIso rechaza lo que no es ISO-8601 y acepta lo que si", () => {
  assert.equal(instanteIso("3 jul 2026"), null);

  assert.equal(instanteIso("hace dos dias"), null);

  assert.equal(instanteIso(""), null);

  assert.equal(instanteIso(null), null);

  assert.equal(instanteIso("2026-07-03T00:40:32.000Z"), "2026-07-03T00:40:32.000Z");

  assert.equal(instanteIso("2025-05-14T10:00:00+00:00"), "2025-05-14T10:00:00.000Z");
});


test("aplicarVentana devuelve TRES grupos: dentro, fuera y sin fecha utilizable", () => {
  const v = resolverVentana("7d", AHORA);

  const r = aplicarVentana(
    [
      { clave: "a", publishedAt: "2026-08-31T10:00:00.000Z" },
      { clave: "b", publishedAt: "2020-01-01T10:00:00.000Z" },
      { clave: "c", publishedAt: null }
    ],
    v
  );

  assert.equal(r.dentro.length, 1);

  assert.equal(r.fuera.length, 1);

  assert.equal(r.sinFechaUtilizable.length, 1);

  /* La pieza sin fecha no se cuela en ninguno de los otros dos. */
  assert.equal(r.recuento.total, 3);

  assert.equal(r.recuento.proporcionDatable, 0.667);
});


/*
===========================================================
4 · SIN CEROS FALSOS
===========================================================
*/

test("no fake zero: una fuente con piezas no datables NO devuelve 0 en la ventana", async () => {
  await sembrar([
    piezaFila(PROYECTO_A, "medioa.com/nota-1", {
      fuente: "medioa.com",
      fechaHecho: "3 jul 2026"
    }),
    piezaFila(PROYECTO_A, "medioa.com/nota-2", {
      fuente: "medioa.com",
      fechaHecho: "4 jul 2026"
    })
  ]);

  const h = await homeDeProyecto({
    projectId: PROYECTO_A,
    ventana: "hoy",
    ahora: AHORA,
    lake: {}
  });

  const fila = h.presencia.ranking.find((f) => f.dominio === "medioa.com");

  assert.equal(
    fila.piezasObservadas.valor,
    null,
    "dos piezas sin fecha utilizable no son cero piezas"
  );

  assert.equal(fila.piezasObservadas.estado, ESTADOS_DATO.COBERTURA_INSUFICIENTE);

  /* Y el corpus sigue diciendo la verdad. */
  assert.equal(fila.piezasEnCorpus.valor, 2);
});


test("no fake zero: cuando SI se pudo mirar, el cero es un cero legitimo", async () => {
  await sembrar([
    piezaFila(PROYECTO_A, "medioa.com/vieja", {
      fuente: "medioa.com",
      fechaHecho: "2020-01-01T10:00:00.000Z"
    })
  ]);

  const h = await homeDeProyecto({
    projectId: PROYECTO_A,
    ventana: "hoy",
    ahora: AHORA,
    lake: {}
  });

  const fila = h.presencia.ranking.find((f) => f.dominio === "medioa.com");

  assert.equal(fila.piezasObservadas.valor, 0);

  assert.equal(fila.piezasObservadas.estado, null, "es una medicion, no un hueco");
});


test("medida(): un valor ausente SIEMPRE viaja con estado", () => {
  const m = medida(null);

  assert.equal(m.valor, null);

  assert.ok(m.estado, "un null sin estado es exactamente lo que este contrato prohibe");

  const n = medida(0);

  assert.equal(n.valor, 0);
});


test("medidaEnVentana distingue los tres casos", () => {
  const vacio = medidaEnVentana({ enVentana: 0, enCorpus: 0, datablesEnCorpus: 0 });

  assert.equal(vacio.valor, 0);

  assert.equal(vacio.estado, ESTADOS_DATO.SIN_EVIDENCIA);

  const indatable = medidaEnVentana({ enVentana: 0, enCorpus: 5, datablesEnCorpus: 0 });

  assert.equal(indatable.valor, null);

  assert.equal(indatable.estado, ESTADOS_DATO.COBERTURA_INSUFICIENTE);

  const medible = medidaEnVentana({ enVentana: 2, enCorpus: 5, datablesEnCorpus: 4 });

  assert.equal(medible.valor, 2);
});


/*
===========================================================
5 · VOCABULARIO
===========================================================
*/

test("no existe influencia en la respuesta serializada de la HOME", async () => {
  await sembrar([
    piezaFila(PROYECTO_A, "medioa.com/nota-1", {
      fuente: "medioa.com",
      fechaHecho: "2026-08-31T10:00:00.000Z"
    })
  ]);

  const h = await homeDeProyecto({
    projectId: PROYECTO_A,
    ventana: "hoy",
    ahora: AHORA,
    lake: {}
  });

  const json = JSON.stringify(h);

  /*
    Se buscan CLAVES, no la palabra suelta: el vocabulario
    declara «influencia» dentro de las prohibiciones y esas
    frases tienen que poder viajar.
  */
  const clavesProhibidas = [
    '"influencia"',
    '"influyente"',
    '"impacto"',
    '"score"',
    '"puntaje"',
    '"intencionDeVoto"',
    '"personasAlcanzadas"',
    '"favorabilidad"',
    '"sentimiento"'
  ];

  clavesProhibidas.forEach((k) => {
    assert.ok(!json.includes(`${k}:`), `la respuesta no puede exponer la clave ${k}`);
  });
});


test("el ranking se declara como recuento y niega ser de influencia", async () => {
  await sembrar([piezaFila(PROYECTO_A, "medioa.com/n", { fuente: "medioa.com" })]);

  const h = await homeDeProyecto({ projectId: PROYECTO_A, ahora: AHORA, lake: {} });

  assert.match(h.presencia.sinScore, /RECUENTO/);

  assert.match(h.presencia.noEsRankingDeInfluencia, /PROHIBIDO/i);

  /* Ninguna fila lleva un score. */
  h.presencia.ranking.forEach((f) => {
    assert.equal(f.score, undefined);

    assert.equal(f.puntaje, undefined);
  });
});


test("INCIDENCIA nunca trae valor y siempre trae sus requisitos", async () => {
  await sembrar([piezaFila(PROYECTO_A, "medioa.com/n", { fuente: "medioa.com" })]);

  const h = await homeDeProyecto({ projectId: PROYECTO_A, ahora: AHORA, lake: {} });

  assert.equal(h.incidencia.valor, null);

  assert.equal(h.incidencia.disponible, false);

  assert.equal(h.incidencia.estado, "METODOLOGIA_EN_CONSTRUCCION");

  assert.ok(h.incidencia.requisitos.length >= 3);

  assert.ok(h.incidencia.porQueNoHoy.length > 0);
});


test("las tres dimensiones declaran lo que NO significan", () => {
  assert.ok(DIMENSIONES.PRESENCIA.noSignifica.some((x) => /influencia/i.test(x)));

  assert.ok(DIMENSIONES.PRESENCIA.noSignifica.some((x) => /intencion de voto/i.test(x)));

  assert.ok(DIMENSIONES.AMPLIFICACION.noSignifica.some((x) => /copia/i.test(x)));

  assert.ok(DIMENSIONES.AMPLIFICACION.noSignifica.some((x) => /causalidad/i.test(x)));

  assert.equal(DIMENSIONES.INCIDENCIA.disponible, false);

  assert.ok(TERMINOS_PROHIBIDOS.includes("influencia"));
});


/*
===========================================================
6 · CLASIFICACION DE EMISORES
===========================================================
*/

test("una correspondencia observada NO asciende la cuenta a MEDIO", async () => {
  await sembrar([
    piezaFila(PROYECTO_A, "x.com/tomebamba/status/1", {
      fuente: "x.com",
      fechaHecho: "2026-08-31T10:00:00.000Z",

      emisor: {
        clase: CLASES_EMISOR.NO_CLASIFICADO,
        nombre: "La Voz del Tomebamba",
        dominio: "x.com",

        correspondencia: {
          handle: "tomebamba",
          candidatos: [
            {
              medioId: "radiotomebamba.com.ec",
              nombre: "Radio Tomebamba",
              fuerza: 1,
              motivo: "coincidencia exacta del termino distintivo",
              estado: "OBSERVADA_NO_VERIFICADA",
              claseSugerida: "MEDIO",
              requiereConfirmacion: true
            }
          ]
        }
      }
    })
  ]);

  const h = await homeDeProyecto({ projectId: PROYECTO_A, ahora: AHORA, lake: {} });

  const fila = h.presencia.ranking.find((f) => f.dominio === "x.com");

  assert.equal(fila.clase, CLASES_EMISOR.NO_CLASIFICADO);

  assert.equal(fila.grupo, GRUPOS_FUENTE.NO_CLASIFICADO);

  /* La correspondencia se muestra, con su estado, sin cambiar la clase. */
  assert.equal(fila.correspondencias.length, 1);

  assert.equal(fila.correspondencias[0].estado, "OBSERVADA_NO_VERIFICADA");

  assert.equal(fila.correspondencias[0].requiereConfirmacion, true);

  /* Y no cuenta como medio en el resumen. */
  assert.equal(h.resumen.medios.valor, 0);

  assert.equal(h.resumen.noClasificados.valor, 1);
});


test("dos clases determinadas para el mismo dominio no se eligen: se declara el conflicto", async () => {
  await sembrar([
    piezaFila(PROYECTO_A, "ambiguo.com/a", {
      fuente: "ambiguo.com",
      emisor: { clase: CLASES_EMISOR.MEDIO, nombre: "Ambiguo" }
    }),
    piezaFila(PROYECTO_A, "ambiguo.com/b", {
      fuente: "ambiguo.com",
      emisor: { clase: CLASES_EMISOR.CREADOR, nombre: "Ambiguo" }
    })
  ]);

  const c = await leerCorpusDeProyecto({ projectId: PROYECTO_A, lake: {} });

  const f = c.fuentes.find((x) => x.dominio === "ambiguo.com");

  assert.equal(f.conflictoDeClase, true);

  assert.equal(f.clase, CLASES_EMISOR.NO_DETERMINADO);
});


test("un agregador no entra en el ranking de fuentes y se declara aparte", async () => {
  await sembrar([
    piezaFila(PROYECTO_A, "google.com/goto?url=abc", { fuente: "google.com" }),
    piezaFila(PROYECTO_A, "medioa.com/nota", { fuente: "medioa.com" })
  ]);

  const h = await homeDeProyecto({ projectId: PROYECTO_A, ahora: AHORA, lake: {} });

  assert.ok(
    h.presencia.ranking.every((f) => f.dominio !== "google.com"),
    "un redirector de buscador no puede aparecer como medio"
  );

  const artefacto = h.presencia.artefactosDeRecoleccion.find(
    (a) => a.dominio === "google.com"
  );

  assert.ok(artefacto, "y tampoco puede ocultarse: es residuo de nuestro metodo");

  assert.equal(artefacto.tipoEnCatalogo, "agregador");
});


/*
===========================================================
7 · CANDIDATO x MEDIOS
===========================================================
*/

test("candidato x medios: cuenta fuentes distintas y no inventa piezas", async () => {
  const rel = (source, target) =>
    fila({
      proyectoId: PROYECTO_A,
      entidad: `${source}->${target}`,
      fuente: source,
      datos: {
        clase: "relacion",
        relationId: `rel-${source}-${target}`,
        source,
        target,
        tipo: "medio_publica_sobre",
        evidenceIds: [`ev-${source}-${target}`],
        advertencia: "Estas aristas describen actos publicos observados."
      }
    });

  await sembrar([
    rel("medioa.com", "candidato-uno"),
    rel("mediob.com", "candidato-uno"),
    rel("medioc.com", "candidato-uno"),
    rel("medioa.com", "candidato-dos")
  ]);

  const h = await homeDeProyecto({ projectId: PROYECTO_A, ahora: AHORA, lake: {} });

  const uno = h.candidatosPorFuente.filas.find(
    (f) => f.candidateId === "candidato-uno"
  );

  assert.equal(uno.fuentesDistintas.valor, 3);

  assert.deepEqual(uno.principalesFuentes, [
    "medioa.com",
    "mediob.com",
    "medioc.com"
  ]);

  /* El recuento de piezas por candidato NO se aproxima. */
  assert.equal(uno.piezasObservadas.valor, null);

  assert.equal(uno.piezasObservadas.estado, ESTADOS_DATO.NO_DISPONIBLE);

  assert.match(uno.piezasObservadas.motivo, /se deduplica por el par/);

  /* Las tres lecturas prohibidas viajan con la seccion. */
  assert.ok(h.candidatosPorFuente.noSignifica.some((x) => /intencion de voto/i.test(x)));
});


test("candidato x medios: la advertencia de arista llega a la respuesta", async () => {
  await sembrar([
    fila({
      proyectoId: PROYECTO_A,
      entidad: "medioa.com->candidato-uno",
      fuente: "medioa.com",
      datos: {
        clase: "relacion",
        source: "medioa.com",
        target: "candidato-uno",
        tipo: "medio_publica_sobre",
        advertencia: "Un medio que publica sobre un candidato no es su aliado."
      }
    })
  ]);

  const h = await homeDeProyecto({ projectId: PROYECTO_A, ahora: AHORA, lake: {} });

  assert.match(h.candidatosPorFuente.advertenciaDeArista, /no es su aliado/);
});


/*
===========================================================
8 · AMPLIFICACION
===========================================================
*/

test("amplificacion: tres magnitudes separadas y sin afirmar copia", async () => {
  const amp = (entidad, fuente, origen) =>
    fila({
      proyectoId: PROYECTO_A,
      entidad,
      fuente,
      datos: {
        clase: "pieza_amplificacion",
        piezaOrigen: origen,
        rol: "COBERTURA_RELACIONADA",
        evidenceId: `ev-${entidad}`,
        emisor: { clase: CLASES_EMISOR.NO_DETERMINADO }
      }
    });

  await sembrar([
    amp("medioa.com/x", "medioa.com", "pc-1"),
    amp("mediob.com/y", "mediob.com", "pc-1"),
    amp("medioc.com/z", "medioc.com", "pc-1")
  ]);

  const h = await homeDeProyecto({ projectId: PROYECTO_A, ahora: AHORA, lake: {} });

  assert.equal(h.amplificacion.piezasRelacionadasEnCorpus.valor, 3);

  assert.equal(h.amplificacion.fuentesDistintas.valor, 3);

  assert.equal(h.amplificacion.contenidosRelacionados.valor, 1);

  assert.match(h.amplificacion.noSeSuman, /no se suman/);

  assert.equal(h.amplificacion.rolPorDefecto, "COBERTURA_RELACIONADA");

  assert.ok(h.amplificacion.noAfirma.some((x) => /causalidad/i.test(x)));
});


/*
===========================================================
9 · PROCEDENCIA
===========================================================
*/

test("procedencia: toda pieza analizada es trazable hasta su evidencia", async () => {
  await sembrar([
    piezaFila(PROYECTO_A, "medioa.com/nota-1", {
      fuente: "medioa.com",
      evidenceId: "ev-trazable",
      fechaHecho: "2026-08-31T10:00:00.000Z"
    })
  ]);

  const h = await homeDeProyecto({ projectId: PROYECTO_A, ahora: AHORA, lake: {} });

  assert.equal(h.fuentes.trazabilidad.length, 1);

  const t = h.fuentes.trazabilidad[0];

  assert.equal(t.evidenceId, "ev-trazable");

  assert.equal(t.fuente, "medioa.com");

  assert.ok(t.canonicalUrl);

  assert.ok(h.fuentes.evidenciasDistintas.valor >= 1);

  /* La vista no gasta cuota: lo declara y no hay forma de que la gaste. */
  assert.match(h.fuentes.consumoAcumuladoDeclarado.nota, /NO ejecuta proveedores/);
});


/*
===========================================================
10 · SECCIONES Y PREPARACION DE SENTINEL AI
===========================================================
*/

test("el modulo declara nueve secciones y Analizar publicacion es interna", () => {
  assert.equal(SECCIONES.length, 9);

  const analizar = SECCIONES.find((s) => s.id === "analizar");

  assert.equal(analizar.herramientaInterna, true);

  assert.equal(analizar.profundidad, "OPERATIVA");

  /* Ninguna otra seccion se declara operativa: no se promete de mas. */
  const operativas = SECCIONES.filter((s) => s.profundidad === "OPERATIVA");

  assert.equal(operativas.length, 1);
});


test("Sentinel AI: se declara no implementado y que preguntas faltan por ejes", () => {
  const p = preguntasRespondibles();

  assert.ok(p.length >= 7);

  const territorio = p.find((x) => x.id === "que-ocurre-en-territorio");

  assert.equal(territorio.respondible, false);

  assert.ok(territorio.ejesQueFaltan.includes("territorio"));
});


/*
===========================================================
11 · MEDIA-UX-CERT-01 — LO QUE ENCONTRO LA CERTIFICACION
===========================================================

Cada prueba de este bloque corresponde a un defecto REAL visto
inspeccionando la pantalla, no a una hipotesis.
===========================================================
*/

test("un balanceador de AWS no puede aparecer como medio", async () => {
  await sembrar([
    piezaFila(PROYECTO_A, "mw-public-alb-prod-123.us-east-1.elb.amazonaws.com/nota", {
      fuente: "mw-public-alb-prod-123.us-east-1.elb.amazonaws.com"
    }),
    piezaFila(PROYECTO_A, "medioa.com/nota", { fuente: "medioa.com" })
  ]);

  const h = await homeDeProyecto({ projectId: PROYECTO_A, ahora: AHORA, lake: {} });

  const infra = "mw-public-alb-prod-123.us-east-1.elb.amazonaws.com";

  assert.ok(
    h.presencia.ranking.every((f) => f.dominio !== infra),
    "un host de infraestructura no es una cabecera"
  );

  const artefacto = h.presencia.artefactosDeRecoleccion.find((a) => a.dominio === infra);

  assert.ok(artefacto, "y tampoco se oculta: la evidencia no se borra");

  assert.equal(artefacto.clase, "INFRAESTRUCTURA");

  assert.match(artefacto.motivoDeExclusion, /balanceador de carga o una CDN/);
});


test("un dominio propio raro NO se reclasifica como infraestructura", async () => {
  await sembrar([
    piezaFila(PROYECTO_A, "diario-raro-xyz.ec/nota", { fuente: "diario-raro-xyz.ec" })
  ]);

  const h = await homeDeProyecto({ projectId: PROYECTO_A, ahora: AHORA, lake: {} });

  assert.ok(
    h.presencia.ranking.some((f) => f.dominio === "diario-raro-xyz.ec"),
    "preferimos una fuente sin clasificar a una reclasificada por parecerlo"
  );
});


test("toda cifra ausente trae etiqueta humana ademas del estado tecnico", async () => {
  await sembrar([
    piezaFila(PROYECTO_A, "medioa.com/nota", {
      fuente: "medioa.com",
      fechaHecho: "3 jul 2026"
    })
  ]);

  const h = await homeDeProyecto({
    projectId: PROYECTO_A,
    ventana: "hoy",
    ahora: AHORA,
    lake: {}
  });

  Object.entries(h.resumen).forEach(([clave, m]) => {
    if (m.valor === null) {
      assert.ok(m.estado, `${clave} debe traer estado tecnico`);

      assert.ok(m.etiqueta, `${clave} debe traer etiqueta humana`);

      assert.ok(
        !/_/.test(m.etiqueta),
        `la etiqueta de ${clave} no puede ser el estado crudo`
      );
    }
  });

  /* Y el crudo NO desaparece: quien audita lo necesita. */
  const fila = h.presencia.ranking.find((f) => f.dominio === "medioa.com");

  assert.equal(fila.piezasObservadas.estado, ESTADOS_DATO.COBERTURA_INSUFICIENTE);

  assert.equal(fila.piezasObservadas.etiqueta, "Cobertura insuficiente");
});


test("cada fila del ranking explica por que esta ahi, solo con hechos del corpus", async () => {
  const rel = (source, target) =>
    fila({
      proyectoId: PROYECTO_A,
      entidad: `${source}->${target}`,
      fuente: source,
      datos: {
        clase: "relacion",
        source,
        target,
        tipo: "medio_publica_sobre",
        evidenceIds: [`ev-${source}`]
      }
    });

  await sembrar([
    piezaFila(PROYECTO_A, "medioa.com/n1", {
      fuente: "medioa.com",
      fechaHecho: "2026-08-31T10:00:00.000Z"
    }),
    rel("medioa.com", "candidato-uno")
  ]);

  const h = await homeDeProyecto({ projectId: PROYECTO_A, ahora: AHORA, lake: {} });

  const f = h.presencia.ranking.find((x) => x.dominio === "medioa.com");

  assert.ok(f.porQue.razones.length >= 3);

  const claves = f.porQue.razones.map((r) => r.clave);

  assert.ok(claves.includes("piezas"));

  assert.ok(claves.includes("ventana"));

  assert.ok(claves.includes("candidatos"));

  /* La justificacion declara lo que NO explica. */
  assert.match(f.porQue.limite, /No explican audiencia/);

  /* Y no inventa ninguna cifra nueva: la de piezas coincide con el corpus. */
  const razonPiezas = f.porQue.razones.find((r) => r.clave === "piezas");

  assert.equal(razonPiezas.valor, f.piezasEnCorpus.valor);
});


test("el territorio se devuelve por su nombre, no por su id tecnico", async () => {
  await sembrar([
    piezaFila(PROYECTO_A, "elmercurio.com.ec/nota", { fuente: "elmercurio.com.ec" })
  ]);

  const h = await homeDeProyecto({ projectId: PROYECTO_A, ahora: AHORA, lake: {} });

  const f = h.presencia.ranking.find((x) => x.dominio === "elmercurio.com.ec");

  assert.ok(f.territorios.valor, "El Mercurio tiene cobertura declarada en el catalogo");

  assert.ok(
    !f.territorios.valor.some((x) => /^ec-/.test(x)),
    "la tabla no puede mostrar ids de unidad"
  );

  /* El id sigue disponible para auditar. */
  assert.ok(f.territorioId);
});


test("el ranking se titula presencia mediatica observable y trae su metodologia", async () => {
  await sembrar([piezaFila(PROYECTO_A, "medioa.com/n", { fuente: "medioa.com" })]);

  const h = await homeDeProyecto({ projectId: PROYECTO_A, ventana: "30d", ahora: AHORA, lake: {} });

  assert.equal(h.presencia.titulo, "PRESENCIA MEDIÁTICA OBSERVABLE");

  assert.equal(h.presencia.subtitulo, "30 dias");

  assert.match(h.presencia.notaMetodologica.texto, /evidencia digital observable/);

  /* Preparacion de Top N y dimensiones, sin encender ninguna sin metodo. */
  assert.deepEqual(h.presencia.tamanosDisponibles, [10, 20, 50]);

  const disponibles = h.presencia.dimensionesFuturas.filter((d) => d.disponible);

  assert.equal(disponibles.length, 1, "solo PRESENCIA tiene datos hoy");

  h.presencia.dimensionesFuturas
    .filter((d) => !d.disponible)
    .forEach((d) => assert.ok(d.requiere, `${d.id} debe declarar que le falta`));
});


/*
===========================================================
12 · REGRESION — EL LAKE REAL Y EL ANALISIS DE UNA PIEZA
===========================================================

Invariantes sobre el corpus real. Nunca cifras exactas: el
corpus crece con cada analisis y una prueba anclada a un numero
se romperia manana sin que nada estuviera roto.
===========================================================
*/

test("Lake real: el proyecto piloto se lee y excluye los proyectos de prueba", async () => {
  cerrarLake();

  await abrirLake({ adaptador: "fichero", forzarNueva: true });

  const c = await leerCorpusDeProyecto({
    projectId: "alcaldia-cuenca-2027-piloto",
    lake: {}
  });

  assert.equal(c.ok, true);

  assert.ok(c.piezas.length >= 1, "el corpus real tiene al menos una pieza analizada");

  /* Ninguna pieza del corpus puede venir de otro proyecto. */
  assert.ok(
    c.aislamiento.proyectosDeMediaEnLake.length >= 1,
    "se declaran los proyectos presentes"
  );

  if (c.aislamiento.filasDeOtrosProyectosExcluidas > 0) {
    assert.match(c.aislamiento.declaracion, /Excluidas/);
  }

  cerrarLake();
});


test("Lake real: las dos demos siguen presentes y con su emisor intacto", async () => {
  cerrarLake();

  await abrirLake({ adaptador: "fichero", forzarNueva: true });

  const c = await leerCorpusDeProyecto({
    projectId: "alcaldia-cuenca-2027-piloto",
    lake: {}
  });

  const mercurio = c.fuentes.find((f) => f.dominio === "elmercurio.com.ec");

  const x = c.fuentes.find((f) => f.dominio === "x.com");

  assert.ok(mercurio, "la demo de El Mercurio sigue en el corpus");

  assert.equal(mercurio.clase, CLASES_EMISOR.MEDIO);

  assert.ok(x, "la demo de X sigue en el corpus");

  assert.equal(
    x.clase,
    CLASES_EMISOR.NO_CLASIFICADO,
    "la cuenta de X NO puede haberse promovido a MEDIO"
  );

  cerrarLake();
});


test("Lake real: el historico de una pieza se lee del LAKE, no solo de la memoria", async () => {
  cerrarLake();

  await abrirLake({ adaptador: "fichero", forzarNueva: true });

  /*
    Regresion del defecto que encontro la validacion por HTTP de
    este gate: `historialDePieza` filtraba `clase === "snapshot"`
    sobre el historial de VERSIONES, que no trae `datos`, asi que
    devolvia vacio aunque el Lake tuviera los snapshots.

    Se veia bien en una sola sesion porque el respaldo en memoria
    los tenia; el hueco solo aparecia tras reiniciar el backend.
    Este proceso no ha analizado nada, asi que la memoria esta
    vacia: si vuelve algo, viene del Lake.
  */
  const h = await historialDePieza(
    "https://x.com/tomebamba/status/2072842895451643961",
    { proyectoId: "alcaldia-cuenca-2027-piloto", lake: {} }
  );

  assert.equal(h.encontrado, true);

  assert.equal(h.origen, "knowledge_lake");

  assert.ok(h.snapshots.length >= 1);

  /* Ningun snapshot repetido: las dos claves no duplican la serie. */
  const ids = h.snapshots.map((s) => s.snapshotId);

  assert.equal(new Set(ids).size, ids.length, "un snapshot repetido inventaria un punto");

  /* Y siguen siendo las metricas reales de la demo. */
  const conMetricas = h.snapshots.filter((s) => s.metricas?.views?.value != null);

  assert.ok(conMetricas.length >= 1, "la demo real de X conserva sus metricas");

  cerrarLake();
});


test("Lake real: la HOME del proyecto piloto responde entera y sin ceros falsos", async () => {
  cerrarLake();

  await abrirLake({ adaptador: "fichero", forzarNueva: true });

  const h = await homeDeProyecto({
    projectId: "alcaldia-cuenca-2027-piloto",
    ventana: "90d",
    lake: {}
  });

  assert.equal(h.ok, true);

  /* Todo campo del resumen tiene la forma del contrato. */
  Object.entries(h.resumen).forEach(([clave, m]) => {
    assert.ok("valor" in m, `${clave} debe traer valor`);

    if (m.valor === null) {
      assert.ok(m.estado, `${clave} es null y debe declarar estado`);
    }
  });

  assert.ok(h.presencia.ranking.length >= 1);

  assert.ok(h.candidatosPorFuente.filas.length >= 1);

  assert.equal(h.incidencia.valor, null);

  cerrarLake();
});
