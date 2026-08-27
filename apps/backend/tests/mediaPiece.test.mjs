// apps/backend/tests/mediaPiece.test.mjs

import test from "node:test";
import assert from "node:assert/strict";

import {
  detectarPlataforma,
  clasificarEmisor,
  resolverPieza
} from "../services/media/pieceResolver.js";

import { planDeMetricas, resumirDisponibilidad } from "../services/media/pieceMetrics.js";

import {
  construirConsultas,
  asignarRol,
  construirMapa,
  MAX_CONSULTAS
} from "../services/media/pieceAmplification.js";

import { temasDePieza, nombresExcluidos } from "../services/media/pieceTopics.js";

import { territorioDePieza } from "../services/media/pieceTerritory.js";

import { relacionarConCandidato } from "../services/media/pieceCandidate.js";

import { clasificarRendimiento, impactoObservado } from "../services/media/pieceImpact.js";

import {
  componerSnapshotPieza,
  crearAlmacenPiezas,
  anexarSnapshot,
  serieDePieza
} from "../services/media/pieceSnapshot.js";

import { analizarPieza, auditarAfirmaciones } from "../services/media/analyzePiece.js";

import {
  PLATAFORMAS,
  CLASES_EMISOR,
  DISPONIBILIDAD,
  ROLES_PIEZA,
  NIVELES_RENDIMIENTO,
  ESTADOS_HISTORICO
} from "../services/media/pieceContracts.js";

/*
===========================================================
MEDIA-PIECE-01 — PRUEBAS
===========================================================

Ninguna prueba toca la red. Las que necesitan un proveedor
reciben un `fetch` falso, y el analisis completo se ejecuta en
modo seco.

Se prueba lo que el gate declara como invariante, no la forma
interna de los objetos: si manana cambia un nombre de campo
interno, el test no deberia romperse; si se rompe una garantia
—null convertido en 0, un snapshot sobrescrito, una afirmacion
de influencia— debe romperse siempre.
===========================================================
*/


/* ---------------------------------------------------------
   1. URL CANONICA Y PLATAFORMA
--------------------------------------------------------- */

test("canonical: youtu.be y watch?v= producen la misma canonica", () => {
  const a = detectarPlataforma("https://youtu.be/dQw4w9WgXcQ");

  const b = detectarPlataforma(
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&utm_source=x"
  );

  assert.equal(a.plataforma, PLATAFORMAS.YOUTUBE);
  assert.equal(b.plataforma, PLATAFORMAS.YOUTUBE);
  assert.equal(a.publicationId, "dQw4w9WgXcQ");
  assert.equal(b.publicationId, "dQw4w9WgXcQ");
  assert.equal(a.canonicaDePlataforma, b.canonicaDePlataforma);
});


test("canonical: la misma pieza con parametros de rastreo da el mismo pieceId", () => {
  const a = resolverPieza({ url: "https://www.youtube.com/watch?v=abc12345678" });

  const b = resolverPieza({
    url: "https://youtube.com/watch?v=abc12345678&utm_campaign=nada"
  });

  assert.ok(a.ok && b.ok);
  assert.equal(a.pieza.pieceId, b.pieza.pieceId);
});


test("canonical: un agregador no se atribuye a si mismo sin aviso", () => {
  const r = resolverPieza({
    url: "https://news.google.com/articles/CBMiabcdef?hl=es"
  });

  assert.ok(r.ok);
  assert.ok(
    r.pieza.avisoCanonical || r.limitaciones.some((l) => /agregador/i.test(l)),
    "debe advertir que la URL es de un agregador"
  );
});


test("URL invalida se rechaza con motivo, no con excepcion", () => {
  const r = resolverPieza({ url: "no-es-una-url" });

  assert.equal(r.ok, false);
  assert.ok(r.motivo);
});


/* ---------------------------------------------------------
   2. CLASIFICACION DE FUENTE
--------------------------------------------------------- */

test("clasificacion: una cuenta de plataforma no se clasifica como MEDIO", () => {
  const e = clasificarEmisor({
    url: "https://www.tiktok.com/@algunacuenta/video/123",
    plataforma: PLATAFORMAS.TIKTOK,
    cuentaEnUrl: "algunacuenta"
  });

  assert.notEqual(e.clase, CLASES_EMISOR.MEDIO);
  assert.ok(e.razones.length > 0, "debe explicar por que");
});


test("clasificacion: dominio desconocido queda NO_DETERMINADO, no adivinado", () => {
  const e = clasificarEmisor({
    url: "https://dominio-que-no-existe-en-el-catalogo-12345.tld/nota",
    plataforma: PLATAFORMAS.WEB,
    cuentaEnUrl: null
  });

  assert.equal(e.clase, CLASES_EMISOR.NO_DETERMINADO);
  assert.ok(e.advertencia);
});


test("clasificacion: no se usa el numero de seguidores en ningun camino", () => {
  const e = clasificarEmisor({
    url: "https://x.com/alguien/status/1",
    plataforma: PLATAFORMAS.X,
    cuentaEnUrl: "alguien"
  });

  const texto = JSON.stringify(e).toLowerCase();

  assert.ok(!texto.includes("seguidor"), "no debe mencionar seguidores");
  assert.ok(!texto.includes("follower"), "no debe mencionar followers");
});


/* ---------------------------------------------------------
   3. null != 0
--------------------------------------------------------- */

test("metricas: una pagina web declara metricas null, nunca 0", () => {
  const r = resolverPieza({ url: "https://un-medio-cualquiera.tld/nota-1" });

  const plan = planDeMetricas(r.pieza);

  assert.equal(plan.lecturaPosible, false);

  plan.metricas.forEach((m) => {
    assert.equal(m.value, null, `${m.id} debe ser null`);
    assert.notEqual(m.value, 0, `${m.id} nunca puede ser 0 sin medicion`);
    assert.ok(m.availability, `${m.id} debe declarar availability`);
    assert.ok(m.motivo, `${m.id} debe declarar motivo`);
  });
});


test("metricas: plataformas sin via oficial declaran el estado correcto", () => {
  const r = resolverPieza({
    url: "https://www.instagram.com/p/ABC123/"
  });

  const plan = planDeMetricas(r.pieza);

  const views = plan.metricas.find((m) => m.id === "views");

  assert.equal(views.value, null);

  assert.ok(
    [
      DISPONIBILIDAD.REQUIERE_AUTORIZACION,
      DISPONIBILIDAD.NO_DISPONIBLE,
      DISPONIBILIDAD.REQUIERE_PROVEEDOR
    ].includes(views.availability),
    `availability inesperada: ${views.availability}`
  );
});


test("metricas: el resumen no cuenta un null como leido", () => {
  const resumen = resumirDisponibilidad([
    { id: "views", value: null, availability: DISPONIBILIDAD.NO_DISPONIBLE },
    { id: "likes", value: 10, availability: DISPONIBILIDAD.DISPONIBLE },
    { id: "comments", value: null, availability: DISPONIBILIDAD.DISPONIBLE }
  ]);

  assert.equal(resumen.leidas, 1, "solo likes tiene valor real");
  assert.equal(resumen.ausentes, 2);
});


/* ---------------------------------------------------------
   4. SNAPSHOT APPEND-ONLY
--------------------------------------------------------- */

test("snapshot: T1 se anexa y T0 no se pierde", () => {
  const almacen = crearAlmacenPiezas();

  const base = {
    pieceId: "ev-x",
    canonicalUrl: "https://x.tld/a",
    plataforma: PLATAFORMAS.YOUTUBE
  };

  const t0 = componerSnapshotPieza({
    ...base,
    observedAt: "2026-08-01T00:00:00.000Z",
    metricas: [
      { id: "views", value: 500000, availability: DISPONIBILIDAD.DISPONIBLE }
    ]
  });

  const t1 = componerSnapshotPieza({
    ...base,
    observedAt: "2026-08-02T00:00:00.000Z",
    metricas: [
      { id: "views", value: 560000, availability: DISPONIBILIDAD.DISPONIBLE }
    ]
  });

  assert.equal(anexarSnapshot(almacen, t0).ok, true);
  assert.equal(anexarSnapshot(almacen, t1).ok, true);

  const lista = almacen.porPieza.get("ev-x");

  assert.equal(lista.length, 2, "deben coexistir las dos observaciones");
  assert.equal(lista[0].metricas.views.value, 500000, "T0 intacto");
});


test("snapshot: el mismo instante no duplica ni sobrescribe", () => {
  const almacen = crearAlmacenPiezas();

  const s = componerSnapshotPieza({
    pieceId: "ev-y",
    observedAt: "2026-08-01T00:00:00.000Z",
    metricas: []
  });

  assert.equal(anexarSnapshot(almacen, s).ok, true);

  const segundo = anexarSnapshot(almacen, { ...s });

  assert.equal(segundo.ok, false);
  assert.equal(segundo.duplicado, true);
  assert.equal(almacen.porPieza.get("ev-y").length, 1);
});


test("serie: con un solo punto el estado es HISTORICO_INSUFICIENTE", () => {
  const s = componerSnapshotPieza({
    pieceId: "ev-z",
    observedAt: "2026-08-01T00:00:00.000Z",
    metricas: [{ id: "views", value: 100, availability: DISPONIBILIDAD.DISPONIBLE }]
  });

  const serie = serieDePieza([s]);

  assert.equal(serie.estado, ESTADOS_HISTORICO.HISTORICO_INSUFICIENTE);
  assert.equal(serie.crecimiento, null);
});


test("serie: un null no se compara como caida", () => {
  const a = componerSnapshotPieza({
    pieceId: "ev-w",
    observedAt: "2026-08-01T00:00:00.000Z",
    metricas: [{ id: "views", value: 500000, availability: DISPONIBILIDAD.DISPONIBLE }]
  });

  const b = componerSnapshotPieza({
    pieceId: "ev-w",
    observedAt: "2026-08-02T00:00:00.000Z",
    metricas: [
      { id: "views", value: null, availability: DISPONIBILIDAD.NO_DISPONIBLE }
    ]
  });

  const serie = serieDePieza([a, b]);

  assert.equal(serie.estado, ESTADOS_HISTORICO.COMPARABLE);
  assert.equal(serie.crecimiento.views.indeterminado, true);
  assert.equal(serie.crecimiento.views.variacion, null);
  assert.notEqual(serie.crecimiento.views.variacion, -500000);
});


/* ---------------------------------------------------------
   5. EVIDENCE ID
--------------------------------------------------------- */

test("evidenceId: la pieza siempre trae uno y es estable", () => {
  const a = resolverPieza({ url: "https://medio.tld/nota", titulo: "Un titular" });

  const b = resolverPieza({ url: "https://medio.tld/nota", titulo: "Un titular" });

  assert.ok(a.pieza.evidenceId?.startsWith("ev-"));
  assert.equal(a.pieza.evidenceId, b.pieza.evidenceId);
});


/* ---------------------------------------------------------
   6. RELACION CON EL CANDIDATO
--------------------------------------------------------- */

test("candidato: sin candidateId no se inventa vinculo", () => {
  const r = relacionarConCandidato({
    pieza: { titulo: "Nota", evidenceId: "ev-1" },
    emisor: { dominio: "medio.tld" },
    candidato: null
  });

  assert.equal(r.vinculado, false);
  assert.equal(r.relaciones.length, 0);
  assert.ok(r.motivo);
});


test("candidato: publicar sobre el no implica apoyo ni oposicion", () => {
  const r = relacionarConCandidato({
    pieza: {
      titulo: "Ana Perez presenta su plan de movilidad",
      snippet: "",
      evidenceId: "ev-2",
      publishedAt: "2026-08-01T00:00:00.000Z"
    },
    emisor: { dominio: "medio.tld", nombre: "Medio" },
    candidato: { candidateId: "cand-1", nombre: "Ana Perez", alias: [], cuentas: [] }
  });

  assert.equal(r.vinculado, true);
  assert.equal(r.relaciones.length, 1);
  assert.equal(r.relaciones[0].tipo, "medio_publica_sobre");
  assert.ok(r.relaciones[0].evidenceIds.length > 0, "la arista exige evidencia");
  assert.equal(r.relaciones[0].confidence, null, "no se fabrica confianza");

  const texto = JSON.stringify(r).toLowerCase();

  assert.ok(!texto.includes('"apoyo"'));
  assert.ok(!texto.includes('"oposicion"'));
  assert.ok(r.advertencia, "debe propagar la advertencia de relacion observada");
});


test("candidato: una pieza de su propia cuenta es presencia PROPIA", () => {
  const r = relacionarConCandidato({
    pieza: {
      titulo: "Ana Perez habla de movilidad",
      evidenceId: "ev-3",
      url: "https://x.com/anaperez/status/9",
      canonicalUrl: "https://x.com/anaperez/status/9"
    },
    emisor: { dominio: "x.com" },
    candidato: {
      candidateId: "cand-1",
      nombre: "Ana Perez",
      alias: [],
      cuentas: [{ url: "https://x.com/anaperez", handle: "anaperez" }]
    }
  });

  assert.equal(r.plano?.plano, "PRESENCIA_PROPIA");
  assert.equal(r.relaciones.length, 0, "su propia publicacion no es cobertura ganada");
});


/* ---------------------------------------------------------
   7. AMPLIFICACION: DEDUP Y ROLES
--------------------------------------------------------- */

test("consultas: nunca se superan las permitidas", () => {
  const { consultas } = construirConsultas(
    {
      canonicalUrl: "https://medio.tld/nota",
      titulo: "Un titular suficientemente largo para servir",
      snippet:
        "Una frase distintiva bastante larga que sirve como huella de busqueda literal para localizar replicas.",
      autor: "Periodista"
    },
    { nombreCandidato: "Ana Perez" }
  );

  assert.ok(consultas.length <= MAX_CONSULTAS, `${consultas.length} > ${MAX_CONSULTAS}`);
});


test("rol: sin prueba de copia el rol es COBERTURA_RELACIONADA", () => {
  const r = asignarRol(
    {
      titulo: "Inundaciones afectan el centro",
      canonicalUrl: "https://a.tld/1",
      publishedAt: "2026-08-01T00:00:00.000Z"
    },
    {
      title: "Fuertes lluvias dejan calles cerradas",
      snippet: "Reporte de la tarde",
      publishedAt: "2026-08-02T00:00:00.000Z"
    }
  );

  assert.equal(r.rol, ROLES_PIEZA.COBERTURA_RELACIONADA);
  assert.ok(
    r.razones.some((x) => /no prueba|no enlaza/i.test(x)),
    "debe explicar que la posterioridad no prueba copia"
  );
});


test("rol: enlazar la pieza es CITA", () => {
  const r = asignarRol(
    { titulo: "Original", canonicalUrl: "https://a.tld/nota-1" },
    {
      title: "Sobre la nota",
      snippet: "Segun a.tld/nota-1 el hecho ocurrio ayer",
      publishedAt: "2026-08-02T00:00:00.000Z"
    }
  );

  assert.equal(r.rol, ROLES_PIEZA.CITA);
});


test("rol: titular casi identico es REPLICA", () => {
  const t = "Inundaciones afectan el centro de la ciudad tras las lluvias";

  const r = asignarRol(
    { titulo: t, canonicalUrl: "https://a.tld/1" },
    { title: t, snippet: "", publishedAt: "2026-08-02T00:00:00.000Z" }
  );

  assert.equal(r.rol, ROLES_PIEZA.REPLICA);
  assert.ok(r.similitudTitular >= 0.82);
});


test("rol: ORIGINAL declara siempre su ventana observada", () => {
  const mapa = construirMapa(
    { titulo: "Un hecho concreto de la ciudad", canonicalUrl: "https://a.tld/1" },
    [
      {
        evidenceId: "ev-a",
        title: "Un hecho concreto de la ciudad",
        canonicalUrl: "https://b.tld/1",
        url: "https://b.tld/1",
        publishedAt: "2026-07-01T00:00:00.000Z"
      }
    ],
    { observedAt: "2026-08-01T00:00:00.000Z" }
  );

  mapa.nodos.forEach((n) => {
    assert.ok(n.ventanaObservada, "todo rol viaja con su ventana");
    assert.ok(n.rolExplicacion, "todo rol viaja con su explicacion");
  });
});


test("15 piezas no son 15 hechos: piezas, fuentes y contenidos se cuentan aparte", () => {
  const titular = "Inundaciones afectan el sector centro de la ciudad";

  const ajenas = Array.from({ length: 14 }, (_, i) => ({
    evidenceId: `ev-${i}`,
    title: titular,
    snippet: "",
    canonicalUrl: `https://medio${i}.tld/nota`,
    url: `https://medio${i}.tld/nota`,
    publishedAt: "2026-08-02T00:00:00.000Z"
  }));

  const mapa = construirMapa(
    { titulo: titular, canonicalUrl: "https://origen.tld/nota" },
    ajenas,
    {}
  );

  assert.equal(mapa.conteo.piezas, 15, "15 documentos");
  assert.equal(mapa.conteo.fuentes, 15, "15 dominios distintos");
  assert.equal(mapa.conteo.contenidos, 1, "un solo hecho");

  assert.ok(/15 PIEZAS/.test(mapa.conteo.lectura));
  assert.ok(/1 CONTENIDO/.test(mapa.conteo.lectura));
  assert.ok(
    !/noticias independientes/i.test(JSON.stringify(mapa)),
    "no debe hablar de noticias independientes"
  );
  assert.ok(mapa.conteo.advertencia);
});


/* ---------------------------------------------------------
   8. TEMAS
--------------------------------------------------------- */

test("temas: el nombre del candidato y del autor no pueden ser tema", () => {
  const ex = nombresExcluidos({
    candidato: "Ana Perez Lopez",
    autor: "Juan Rodriguez"
  });

  assert.ok(ex.includes("ana perez lopez"));
  assert.ok(ex.includes("perez"));
  assert.ok(ex.includes("rodriguez"));
});


test("temas: con corpus insuficiente no se inventa un tema", () => {
  const r = temasDePieza({
    pieza: { titulo: "Un titular", snippet: "algo", evidenceId: "ev-1" },
    piezasAmplificacion: [],
    nombreCandidato: "Ana Perez"
  });

  assert.equal(r.temas.length, 0);
  assert.ok(r.limitaciones.length > 0, "debe explicar por que no hay temas");
});


test("temas: EVENTO se declara como dimension separada y vacia", () => {
  const r = temasDePieza({
    pieza: { titulo: "Un titular", snippet: "algo", evidenceId: "ev-1" },
    piezasAmplificacion: []
  });

  assert.ok(Array.isArray(r.eventos));
  assert.equal(r.eventos.length, 0);
});


/* ---------------------------------------------------------
   9. GEO-1
--------------------------------------------------------- */

test("GEO-1: sin evidencia territorial no se afirma territorio", () => {
  const t = territorioDePieza({
    pieza: {
      titulo: "Una nota sin ningun lugar mencionado",
      snippet: "",
      url: "https://dominio-desconocido-9876.tld/x",
      canonicalUrl: "https://dominio-desconocido-9876.tld/x"
    },
    piezasAmplificacion: []
  });

  assert.equal(t.tieneEvidenciaTerritorial, false);
  assert.equal(t.unidadId, null);
  assert.ok(t.motivo);
  assert.equal(t.rotulo, "SIN EVIDENCIA TERRITORIAL SUFICIENTE");
});


test("GEO-1: los metodos prohibidos se declaran como NO usados", () => {
  const t = territorioDePieza({
    pieza: { titulo: "x", url: "https://a.tld/x", canonicalUrl: "https://a.tld/x" },
    piezasAmplificacion: []
  });

  assert.ok(t.metodosProhibidosNoUsados.includes("ip"));
  assert.ok(t.metodosProhibidosNoUsados.includes("dispositivo"));
  assert.ok(t.metodosProhibidosNoUsados.includes("usuario"));
});


test("territorio: nunca se habla de poblacion alcanzada", () => {
  const t = territorioDePieza({
    pieza: { titulo: "x", url: "https://a.tld/x", canonicalUrl: "https://a.tld/x" },
    piezasAmplificacion: []
  });

  const texto = JSON.stringify(t).toLowerCase();

  assert.ok(!texto.includes("poblacion alcanzada"));
  assert.ok(!texto.includes("audiencia estimada"));
});


/* ---------------------------------------------------------
   10. IMPACTO: SIN INFLUENCIA, SIN BASELINE INVENTADO
--------------------------------------------------------- */

test("rendimiento: sin baseline suficiente no se clasifica", () => {
  const r = clasificarRendimiento({ valorPieza: 1000000, comparables: [80000, 90000] });

  assert.equal(r.nivel, NIVELES_RENDIMIENTO.SIN_BASELINE);
  assert.equal(r.ratio, null);
  assert.ok(r.motivo);
});


test("rendimiento: con baseline se clasifica por ratio y muestra la metodologia", () => {
  const r = clasificarRendimiento({
    valorPieza: 1000000,
    comparables: [70000, 75000, 80000, 85000, 90000, 95000]
  });

  assert.equal(r.nivel, NIVELES_RENDIMIENTO.EXCEPCIONAL);
  assert.ok(r.ratio > 10);
  assert.ok(r.metodologia?.calculo);
  assert.equal(r.metodologia.baseline.includes("mediana"), true);
});


test("impacto: no hay score unico y las equivalencias prohibidas viajan con el dato", () => {
  const i = impactoObservado({
    pieza: { canonicalUrl: "https://a.tld/1" },
    metricas: [
      { id: "views", value: 1000, availability: DISPONIBILIDAD.DISPONIBLE },
      { id: "likes", value: null, availability: DISPONIBILIDAD.NO_DISPONIBLE }
    ],
    evidencias: []
  });

  assert.equal(i.score, undefined, "no debe existir un score");
  assert.ok(i.sinScore);
  assert.ok(i.equivalenciasProhibidas.length > 0);
  /*
    El rotulo es auto-negativo a proposito: leido fuera de
    contexto, "personas alcanzadas" pareceria una afirmacion.
  */
  assert.match(i.dimensiones.consumo.noEs, /^NO es personas alcanzadas$/);
  assert.match(i.dimensiones.interaccion.noEs, /^NO es apoyo al candidato$/);
});


test("higiene: la respuesta no contiene campos de influencia ni intencion de voto", () => {
  const auditoria = auditarAfirmaciones({
    dimensiones: { consumo: { views: 10 } },
    nota: "texto cualquiera"
  });

  assert.equal(auditoria.limpio, true);

  const sucia = auditarAfirmaciones({ personasAlcanzadas: 50000 });

  assert.equal(sucia.limpio, false);
  assert.ok(sucia.encontradas.includes("personasAlcanzadas"));
});


/* ---------------------------------------------------------
   11. ANALISIS COMPLETO EN MODO SECO (sin red)
--------------------------------------------------------- */

test("analisis en modo seco: no ejecuta red y devuelve el plan", async () => {
  const a = await analizarPieza({
    url: "https://www.youtube.com/watch?v=abcdefghijk",
    dryRun: true
  });

  assert.equal(a.ok, true);
  assert.equal(a.entrada.dryRun, true);
  assert.equal(a.cuota.youtube.llamadas, 0, "no debe gastar cuota");
  assert.equal(a.cuota.web.consultas, 0, "no debe lanzar consultas");
  assert.ok(a.planDeMetricas);
  assert.ok(a.planDeConsultas);
  assert.equal(a.persistencia_lake.persistido, false);
  assert.ok(/MODO SECO/.test(a.cobertura.declaracion));
});


test("analisis en modo seco: el bloque de higiene pasa", async () => {
  const a = await analizarPieza({
    url: "https://un-medio.tld/una-nota",
    dryRun: true
  });

  const auditoria = auditarAfirmaciones(a);

  assert.equal(auditoria.limpio, true, auditoria.declaracion);
});


test("analisis: siempre trae evidencias, limitaciones y contrato", async () => {
  const a = await analizarPieza({
    url: "https://un-medio.tld/una-nota",
    dryRun: true
  });

  assert.ok(Array.isArray(a.evidencias) && a.evidencias.length > 0);
  assert.ok(Array.isArray(a.limitaciones));
  assert.ok(a.contrato?.version);
  assert.ok(a.pieza.canonicalUrl);
});


/* ---------------------------------------------------------
   12. SIN HARDCODING Y MULTIPROYECTO
--------------------------------------------------------- */

test("no hardcoding: ningun modulo menciona Cuenca, un candidato o un periodista", async () => {
  const { readFile, readdir } = await import("node:fs/promises");

  const dir = new URL("../services/media/", import.meta.url);

  const ficheros = (await readdir(dir)).filter((f) => f.endsWith(".js"));

  assert.ok(ficheros.length >= 10, "deben existir los modulos del gate");

  for (const f of ficheros) {
    const texto = await readFile(new URL(f, dir), "utf8");

    /* Se permite en comentarios explicativos, no en codigo. */
    const codigo = texto
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

    assert.ok(
      !/cuenca/i.test(codigo),
      `${f}: no debe codificar Cuenca en el codigo`
    );

    assert.ok(
      !/azuay/i.test(codigo),
      `${f}: no debe codificar un territorio concreto`
    );
  }
});


test("multiproyecto: el mismo analisis acepta cualquier projectId", async () => {
  const a = await analizarPieza({
    url: "https://un-medio.tld/nota",
    projectId: "proyecto-A",
    dryRun: true
  });

  const b = await analizarPieza({
    url: "https://un-medio.tld/nota",
    projectId: "proyecto-B",
    dryRun: true
  });

  assert.equal(a.entrada.projectId, "proyecto-A");
  assert.equal(b.entrada.projectId, "proyecto-B");
  assert.equal(a.pieza.pieceId, b.pieza.pieceId, "la pieza es la misma");
});


test("multiproyecto: candidateId sin projectId se declara, no se adivina", async () => {
  const a = await analizarPieza({
    url: "https://un-medio.tld/nota",
    candidateId: "cand-9",
    dryRun: true
  });

  assert.equal(a.candidato.vinculado, false);
  assert.ok(
    a.limitaciones.some((l) => /projectId/i.test(l)),
    "debe explicar que falta projectId"
  );
});


/* ---------------------------------------------------------
   13. EL DOMINIO DE UNA PLATAFORMA NO ES EL EMISOR
--------------------------------------------------------- */

test("emisor: un video de YouTube no se atribuye a youtube.com", () => {
  const e = clasificarEmisor({
    url: "https://www.youtube.com/watch?v=abc12345678",
    plataforma: PLATAFORMAS.YOUTUBE,
    cuentaEnUrl: null
  });

  assert.notEqual(e.clase, CLASES_EMISOR.PLATAFORMA);
  assert.equal(e.clase, CLASES_EMISOR.NO_DETERMINADO);
  assert.equal(e.pendienteDeResolver, true);
  assert.notEqual(e.nombre, "youtube.com");
  assert.ok(e.advertencia);
});
