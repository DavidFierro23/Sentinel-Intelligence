// apps/backend/tests/mediaCorpusIntegration.test.mjs

import test from "node:test";
import assert from "node:assert/strict";

import { abrirLake, cerrarLake, escribirLoteEnLake } from "../services/knowledgeLake/lakeQuery.js";

import { TIPOS_ENTIDAD, ZONAS } from "../services/knowledgeLake/lakeWriter.js";

import {
  CLASES_SOLAPE,
  MOTIVOS_EXCLUSION,
  PROCEDENCIAS,
  corpusCanonicoDeProyecto
} from "../services/media/mediaCanonicalCorpus.js";

import { homeDeProyecto } from "../services/media/mediaHome.js";

import { CLASES_EMISOR } from "../services/media/pieceContracts.js";

/*
===========================================================
MEDIA-CORPUS-INTEGRATION-01 — PRUEBAS
===========================================================

Ninguna toca la red.

Casi todas comprueban que NO ocurre algo: que una nota no se
cuenta dos veces, que dos medios que publican lo mismo no se
funden en uno, que un feed de comentarios no entra como
publicacion editorial, y que observedAt no se cuela en una
ventana temporal.

Equivocarse en cualquiera de esas produce un corpus PLAUSIBLE,
que es la unica clase de error que un analista no detecta.
===========================================================
*/

const AHORA = "2026-09-03T18:00:00.000Z";

const PROY_A = "test-integracion-a";

const PROY_B = "test-integracion-b";


function base(proyectoId, entidad, tipoEntidad, datos, extra = {}) {
  return {
    tenantId: "sentinel-local",
    proyectoId,
    zona: ZONAS.RAW,
    motorOrigen: extra.motorOrigen || "media_piece_01",
    fuente: extra.fuente ?? null,
    urlOriginal: extra.urlOriginal ?? null,
    urlCanonica: extra.urlCanonica ?? entidad,
    fechaHecho: extra.fechaHecho ?? null,
    fechaDeteccion: extra.fechaDeteccion || AHORA,
    entidad,
    tipoEntidad,
    linaje: extra.linaje,
    datos
  };
}


/* Fila del corpus antiguo: una pieza analizada. */
function pieza(proyectoId, url, dominio, extra = {}) {
  return base(
    proyectoId,
    url,
    TIPOS_ENTIDAD.PUBLICACION,
    {
      clase: "pieza",
      pieceId: `pc-${url}`,
      evidenceId: extra.evidenceId || `ev-${url}`,
      plataforma: extra.plataforma || "web",
      contentType: "pagina_web",
      titulo: extra.titulo ?? null,
      autor: extra.autor ?? null,
      emisor: extra.emisor || {
        clase: CLASES_EMISOR.MEDIO,
        nombre: extra.nombreEmisor || null,
        dominio
      }
    },
    {
      fuente: dominio,
      fechaHecho: extra.fechaHecho ?? null,
      linaje: { submotor: "media_piece", cadena: ["prueba"] }
    }
  );
}


/* Fila del corpus antiguo: pieza de amplificacion. */
function amplificacion(proyectoId, url, dominio, extra = {}) {
  return base(
    proyectoId,
    url,
    TIPOS_ENTIDAD.PUBLICACION,
    {
      clase: "pieza_amplificacion",
      piezaOrigen: "pc-origen",
      rol: "COBERTURA_RELACIONADA",
      evidenceId: extra.evidenceId || `ev-${url}`,
      titulo: extra.titulo ?? null,
      emisor: { clase: CLASES_EMISOR.NO_DETERMINADO, dominio }
    },
    {
      fuente: dominio,
      fechaHecho: extra.fechaHecho ?? null,
      linaje: { submotor: "media_piece", cadena: ["prueba"] }
    }
  );
}


/*
  Fila de medicion: publicacion leida de un activo.

  La clave lleva el prefijo `pub:` igual que la escribe
  `mediaMeasurementStore`. Sin el, esta fila y la de una pieza
  analizada de la misma URL colisionarian en `claveEntidad` y el
  Lake trataria una como version de la otra: es justo el defecto
  que este gate corrigio, asi que el fixture tiene que reproducir
  la forma real de la clave.
*/
function publicacion(proyectoId, url, dominio, extra = {}) {
  return base(
    proyectoId,
    `pub:${url}`,
    TIPOS_ENTIDAD.PUBLICACION,
    {
      clase: "publicacion_de_medio",
      mediaEntityId: extra.mediaEntityId || `media:${dominio}`,
      assetId: extra.assetId || `feed:${dominio}`,
      titulo: extra.titulo ?? null,
      autor: extra.autor ?? null,
      publishedAt: extra.publishedAt ?? null,
      publishedAtBruto: extra.publishedAtBruto ?? null,
      observedAt: AHORA,
      procedencia: [{ via: "rss", assetId: `feed:${dominio}`, observedAt: AHORA }]
    },
    {
      fuente: dominio,
      urlCanonica: url,
      fechaHecho: extra.publishedAt ?? null,
      linaje: { submotor: "media_measurement", cadena: ["publicacion_observada"] },
      motorOrigen: "media_measurement_01"
    }
  );
}


async function sembrar(filas) {
  await abrirLake({ adaptador: "memoria", forzarNueva: true });

  const r = await escribirLoteEnLake(filas, {});

  assert.equal(r.rechazados || 0, 0, "la siembra no puede ser rechazada");
}


/*
===========================================================
A/B · DEDUPLICACION EXACTA
===========================================================
*/

test("A · la misma URL vista por dos rutas es UNA pieza canonica", async () => {
  await sembrar([
    pieza(PROY_A, "medioa.com/nota-1", "medioa.com", { titulo: "Titular" }),
    publicacion(PROY_A, "medioa.com/nota-1", "medioa.com", {
      titulo: "Titular",
      publishedAt: "2026-09-01T10:00:00.000Z"
    })
  ]);

  const c = await corpusCanonicoDeProyecto({ projectId: PROY_A, lake: {} });

  assert.equal(c.reconciliacion.entradas, 2);

  assert.equal(c.piezas.length, 1, "dos rutas, una publicacion");

  assert.equal(c.reconciliacion.exactDuplicates, 1);
});


test("B · la URL canonica manda: www y barra final no crean otra pieza", async () => {
  await sembrar([
    pieza(PROY_A, "medioa.com/nota-1", "medioa.com", { titulo: "T" }),
    publicacion(PROY_A, "https://www.medioa.com/nota-1/", "medioa.com", {
      titulo: "T",
      publishedAt: "2026-09-01T10:00:00.000Z"
    })
  ]);

  const c = await corpusCanonicoDeProyecto({ projectId: PROY_A, lake: {} });

  assert.equal(c.piezas.length, 1);
});


/*
===========================================================
C/D · NO FUNDIR LO QUE NO ES LO MISMO
===========================================================
*/

test("C · mismo titular en OTRO dominio NO se funde: son dos medios", async () => {
  const titular = "Alcaldia de Cuenca anuncia obras de vialidad para el proximo ano";

  await sembrar([
    publicacion(PROY_A, "medioa.com/n1", "medioa.com", {
      titulo: titular,
      publishedAt: "2026-09-01T10:00:00.000Z"
    }),
    publicacion(PROY_A, "mediob.com/n9", "mediob.com", {
      titulo: titular,
      publishedAt: "2026-09-01T11:00:00.000Z"
    })
  ]);

  const c = await corpusCanonicoDeProyecto({ projectId: PROY_A, lake: {} });

  assert.equal(c.piezas.length, 2, "dos cabeceras publicando lo mismo son DOS publicaciones");

  const dominios = c.piezas.map((p) => p.dominio).sort();

  assert.deepEqual(dominios, ["medioa.com", "mediob.com"]);

  assert.equal(c.reconciliacion.exactDuplicates, 0);
});


test("D · la republicacion se conserva Y queda enlazada", async () => {
  const titular = "Prefectura del Azuay presenta su rendicion de cuentas anual completa";

  await sembram([
    publicacion(PROY_A, "medioa.com/n1", "medioa.com", {
      titulo: titular,
      publishedAt: "2026-09-01T10:00:00.000Z"
    }),
    publicacion(PROY_A, "mediob.com/n2", "mediob.com", {
      titulo: titular,
      publishedAt: "2026-09-01T12:00:00.000Z"
    })
  ]);

  const c = await corpusCanonicoDeProyecto({ projectId: PROY_A, lake: {} });

  assert.equal(c.piezas.length, 2);

  assert.equal(c.reconciliacion.republications >= 1, true, "se clasifica como republicacion");

  /* Y el enlace entre las dos no se pierde. */
  assert.ok(
    c.piezas.some((p) => (p.republicadaCon || []).length > 0),
    "la relacion entre las dos se conserva"
  );
});

async function sembram(filas) {
  return sembrar(filas);
}


/*
===========================================================
E · MULTIPROCEDENCIA
===========================================================
*/

test("E · una pieza fundida conserva TODAS sus rutas de observacion", async () => {
  await sembrar([
    pieza(PROY_A, "medioa.com/nota-1", "medioa.com", { titulo: "T" }),
    publicacion(PROY_A, "medioa.com/nota-1", "medioa.com", {
      titulo: "T",
      publishedAt: "2026-09-01T10:00:00.000Z"
    })
  ]);

  const c = await corpusCanonicoDeProyecto({ projectId: PROY_A, lake: {} });

  const p = c.piezas[0];

  assert.ok(p.procedencias.length >= 2, "las dos rutas constan");

  assert.ok(p.procedencias.includes(PROCEDENCIAS.ANALISIS));

  assert.ok(p.procedencias.includes(PROCEDENCIAS.MEDIA_MEASUREMENT));

  assert.ok(p.observacionesPorRuta.length >= 2, "y su detalle tambien");

  assert.equal(p.duplicadosAbsorbidos, 1);
});


/*
===========================================================
F/G/H · EXCLUSIONES
===========================================================
*/

test("F · un feed de comentarios no entra como publicacion editorial", async () => {
  await sembrar([
    publicacion(PROY_A, "elmercurio.com.ec/comments/feed/", "elmercurio.com.ec", {
      titulo: "Comentario de un lector",
      publishedAt: "2026-09-01T10:00:00.000Z"
    }),
    publicacion(PROY_A, "elmercurio.com.ec/nota-real", "elmercurio.com.ec", {
      titulo: "Nota real",
      publishedAt: "2026-09-01T10:00:00.000Z"
    })
  ]);

  const c = await corpusCanonicoDeProyecto({ projectId: PROY_A, lake: {} });

  assert.equal(c.piezas.length, 1, "solo la nota editorial");

  const excluida = c.reconciliacion.exclusiones.find(
    (e) => e.motivo === MOTIVOS_EXCLUSION.FEED_COMENTARIOS
  );

  assert.ok(excluida, "y la exclusion se declara con su motivo");
});


test("G · un agregador y un host de infraestructura quedan fuera", async () => {
  await sembrar([
    amplificacion(PROY_A, "google.com/goto?url=abc", "google.com"),
    amplificacion(
      PROY_A,
      "mw-public-alb-prod-1.us-east-1.elb.amazonaws.com/x",
      "mw-public-alb-prod-1.us-east-1.elb.amazonaws.com"
    ),
    pieza(PROY_A, "medioa.com/nota", "medioa.com")
  ]);

  const c = await corpusCanonicoDeProyecto({ projectId: PROY_A, lake: {} });

  assert.equal(c.piezas.length, 1);

  const motivos = c.reconciliacion.porMotivoDeExclusion.map((m) => m.motivo);

  assert.ok(motivos.includes(MOTIVOS_EXCLUSION.ARTEFACTO));

  assert.ok(motivos.includes(MOTIVOS_EXCLUSION.INFRAESTRUCTURA));
});


test("H · la raiz de una plataforma no es una publicacion, pero una cuenta si", async () => {
  await sembrar([
    /* Sin emisor identificable: es la raiz de la plataforma. */
    amplificacion(PROY_A, "instagram.com/p/abc123", "instagram.com"),

    /* Con cuenta identificable: es la publicacion de esa cuenta. */
    pieza(PROY_A, "x.com/tomebamba/status/1", "x.com", {
      plataforma: "x",
      emisor: { clase: CLASES_EMISOR.NO_CLASIFICADO, handle: "tomebamba", dominio: "x.com" }
    })
  ]);

  const c = await corpusCanonicoDeProyecto({ projectId: PROY_A, lake: {} });

  assert.equal(c.piezas.length, 1, "la de la cuenta entra, la raiz no");

  assert.equal(c.piezas[0].dominio, "x.com");

  const excluida = c.reconciliacion.exclusiones.find(
    (e) => e.motivo === MOTIVOS_EXCLUSION.PLATAFORMA
  );

  assert.ok(excluida);
});


/*
===========================================================
I · CONFLICTO DE IDENTIDAD
===========================================================
*/

test("I · una pieza de un activo en conflicto no se atribuye a ninguna entidad", async () => {
  await sembrar([
    /* Dos entidades declaradas reclaman el mismo handle. */
    base(
      PROY_A,
      "media:unoa.com",
      TIPOS_ENTIDAD.MEDIO,
      {
        clase: "entidad_media",
        mediaEntityId: "media:unoa.com",
        projectId: PROY_A,
        canonicalName: "Uno",
        tipo: "MEDIA",
        origen: "analista",
        estado: "DESCUBIERTA",
        activa: true,
        aliases: [],
        activos: [
          {
            assetId: "x:compartido",
            clase: "SOCIAL",
            plataforma: "x",
            handle: "compartido",
            evidenceIds: []
          }
        ],
        procedencia: [],
        evidenceIds: [],
        historial: [],
        piezasObservadas: 0,
        scope: { declarado: null, editorialInferido: null }
      },
      {
        fuente: "unoa.com",
        linaje: { submotor: "media_source_universe", cadena: ["prueba"] }
      }
    ),

    base(
      PROY_A,
      "media:dosb.com",
      TIPOS_ENTIDAD.MEDIO,
      {
        clase: "entidad_media",
        mediaEntityId: "media:dosb.com",
        projectId: PROY_A,
        canonicalName: "Dos",
        tipo: "MEDIA",
        origen: "analista",
        estado: "DESCUBIERTA",
        activa: true,
        aliases: [],
        activos: [
          {
            assetId: "x:compartido",
            clase: "SOCIAL",
            plataforma: "x",
            handle: "compartido",
            evidenceIds: []
          }
        ],
        procedencia: [],
        evidenceIds: [],
        historial: [],
        piezasObservadas: 0,
        scope: { declarado: null, editorialInferido: null }
      },
      {
        fuente: "dosb.com",
        linaje: { submotor: "media_source_universe", cadena: ["prueba"] }
      }
    ),

    publicacion(PROY_A, "x.com/compartido/status/9", "x.com", {
      titulo: "Post en disputa",
      publishedAt: "2026-09-01T10:00:00.000Z",
      assetId: "x:compartido",
      mediaEntityId: "media:unoa.com"
    })
  ]);

  const c = await corpusCanonicoDeProyecto({ projectId: PROY_A, lake: {} });

  assert.ok(c.activosEnConflicto.includes("x:compartido"), "el conflicto se detecta");

  /*
    La pieza se EXCLUYE del corpus canonico: su asignacion
    depende exclusivamente del conflicto, asi que no puede
    contaminar el ranking de ninguna de las dos.
  */
  const excluida = c.reconciliacion.exclusiones.find(
    (e) => e.motivo === MOTIVOS_EXCLUSION.IDENTIDAD_EN_CONFLICTO
  );

  assert.ok(excluida, "y su pieza no entra");

  assert.ok(
    c.piezas.every((p) => p.assetId !== "x:compartido"),
    "ninguna pieza del activo en conflicto sobrevive"
  );
});


/*
===========================================================
J/K/L · TIEMPO
===========================================================
*/

test("J · la ventana la gobierna publishedAt", async () => {
  await sembrar([
    publicacion(PROY_A, "medioa.com/reciente", "medioa.com", {
      titulo: "Reciente",
      publishedAt: "2026-09-02T10:00:00.000Z"
    }),
    publicacion(PROY_A, "medioa.com/vieja", "medioa.com", {
      titulo: "Vieja",
      publishedAt: "2024-01-01T10:00:00.000Z"
    })
  ]);

  const h = await homeDeProyecto({
    projectId: PROY_A,
    ventana: "7d",
    ahora: AHORA,
    lake: {}
  });

  assert.equal(h.ventana.dentroDeVentana, 1);

  assert.equal(h.ventana.fueraDeVentana, 1);
});


test("K · observedAt NUNCA sustituye a publishedAt", async () => {
  /*
    Pieza de 2024 observada HOY. Si observedAt se usara como
    sustituto, entraria en la ventana de 7 dias.
  */
  await sembrar([
    publicacion(PROY_A, "medioa.com/vieja", "medioa.com", {
      titulo: "Nota de 2024 leida hoy",
      publishedAt: "2024-01-01T10:00:00.000Z"
    })
  ]);

  const c = await corpusCanonicoDeProyecto({ projectId: PROY_A, lake: {} });

  const p = c.piezas[0];

  assert.equal(p.publishedAt, "2024-01-01T10:00:00.000Z");

  assert.notEqual(p.publishedAt, p.observedAt);

  const h = await homeDeProyecto({
    projectId: PROY_A,
    ventana: "7d",
    ahora: AHORA,
    lake: {}
  });

  assert.equal(h.ventana.dentroDeVentana, 0, "una nota de 2024 no esta en los ultimos 7 dias");
});


test("L · una pieza SIN FECHA se conserva y no entra en ninguna ventana", async () => {
  await sembrar([
    publicacion(PROY_A, "medioa.com/sin-fecha", "medioa.com", {
      titulo: "Sin fecha",
      publishedAt: null
    }),
    publicacion(PROY_A, "medioa.com/con-fecha", "medioa.com", {
      titulo: "Con fecha",
      publishedAt: "2026-09-02T10:00:00.000Z"
    })
  ]);

  const c = await corpusCanonicoDeProyecto({ projectId: PROY_A, lake: {} });

  assert.equal(c.piezas.length, 2, "la sin fecha se conserva como evidencia");

  assert.equal(c.fechas.sinFecha, 1);

  const h = await homeDeProyecto({
    projectId: PROY_A,
    ventana: "90d",
    ahora: AHORA,
    lake: {}
  });

  assert.equal(h.ventana.sinFechaUtilizable, 1);

  assert.equal(h.ventana.dentroDeVentana, 1, "solo la datada entra");
});


/*
===========================================================
M · AISLAMIENTO
===========================================================
*/

test("M · integrar en un proyecto no altera el corpus del otro", async () => {
  await sembrar([
    publicacion(PROY_A, "medioa.com/a1", "medioa.com", {
      titulo: "De A",
      publishedAt: "2026-09-02T10:00:00.000Z"
    }),
    publicacion(PROY_A, "medioa.com/a2", "medioa.com", {
      titulo: "De A tambien",
      publishedAt: "2026-09-02T11:00:00.000Z"
    }),
    publicacion(PROY_B, "mediob.com/b1", "mediob.com", {
      titulo: "De B",
      publishedAt: "2026-09-02T10:00:00.000Z"
    })
  ]);

  const a = await corpusCanonicoDeProyecto({ projectId: PROY_A, lake: {} });

  const b = await corpusCanonicoDeProyecto({ projectId: PROY_B, lake: {} });

  assert.equal(a.piezas.length, 2);

  assert.equal(b.piezas.length, 1);

  assert.ok(a.piezas.every((p) => p.dominio !== "mediob.com"), "0 fugas");

  assert.ok(b.piezas.every((p) => p.dominio !== "medioa.com"));
});


test("M · sin projectId no hay corpus canonico", async () => {
  const r = await corpusCanonicoDeProyecto({ projectId: "", lake: {} });

  assert.equal(r.ok, false);

  assert.match(r.motivo, /POR PROYECTO/);
});


/*
===========================================================
N/O/P · RANKING
===========================================================
*/

test("N · el ranking usa el corpus canonico, no el antiguo", async () => {
  await sembrar([
    /* Una sola pieza por la via antigua... */
    amplificacion(PROY_A, "medioa.com/vieja", "medioa.com", {
      fechaHecho: "2026-09-02T10:00:00.000Z"
    }),

    /* ...y tres leidas del feed del propio medio. */
    publicacion(PROY_A, "medioa.com/n1", "medioa.com", {
      publishedAt: "2026-09-02T10:00:00.000Z"
    }),
    publicacion(PROY_A, "medioa.com/n2", "medioa.com", {
      publishedAt: "2026-09-02T11:00:00.000Z"
    }),
    publicacion(PROY_A, "medioa.com/n3", "medioa.com", {
      publishedAt: "2026-09-02T12:00:00.000Z"
    })
  ]);

  const h = await homeDeProyecto({
    projectId: PROY_A,
    ventana: "7d",
    ahora: AHORA,
    lake: {}
  });

  const fila = h.presencia.ranking.find((f) => f.dominio === "medioa.com");

  assert.ok(fila, "el medio esta en el ranking");

  assert.equal(fila.piezasEnCorpus.valor, 4, "las cuatro cuentan");

  assert.equal(fila.piezasObservadas.valor, 4);

  /* Y el resumen distingue las tres procedencias. */
  assert.equal(h.resumen.piezasMedidas.valor, 3);

  assert.equal(h.resumen.piezasRelacionadas.valor, 1);
});


test("O · Top N no fabrica filas: con 2 medios muestra 2", async () => {
  await sembrar([
    publicacion(PROY_A, "medioa.com/n1", "medioa.com", {
      publishedAt: "2026-09-02T10:00:00.000Z"
    }),
    publicacion(PROY_A, "mediob.com/n1", "mediob.com", {
      publishedAt: "2026-09-02T10:00:00.000Z"
    })
  ]);

  const h = await homeDeProyecto({
    projectId: PROY_A,
    ventana: "7d",
    ahora: AHORA,
    lake: {}
  });

  assert.equal(h.presencia.ranking.length, 2, "dos medios, dos filas");

  /* Los tamanos se ofrecen; el corpus decide cuantas filas hay. */
  assert.deepEqual(h.presencia.tamanosDisponibles, [10, 20, 50]);
});


test("P · la explicacion se apoya en contribuciones observables reales", async () => {
  await sembrar([
    publicacion(PROY_A, "medioa.com/n1", "medioa.com", {
      publishedAt: "2026-09-02T10:00:00.000Z"
    }),
    publicacion(PROY_A, "medioa.com/n2", "medioa.com", {
      publishedAt: "2026-09-02T11:00:00.000Z"
    })
  ]);

  const h = await homeDeProyecto({
    projectId: PROY_A,
    ventana: "7d",
    ahora: AHORA,
    lake: {}
  });

  const fila = h.presencia.ranking[0];

  const piezas = fila.porQue.razones.find((r) => r.clave === "piezas");

  assert.equal(piezas.valor, fila.piezasEnCorpus.valor, "la razon coincide con el dato");

  assert.match(fila.porQue.limite, /No explican audiencia/);

  /* Ninguna razon afirma causalidad. */
  fila.porQue.razones.forEach((r) => {
    assert.ok(!/porque|causa|provoco/i.test(r.texto), `razon causal: ${r.texto}`);
  });
});


test("una fuente sin ninguna pieza canonica no ordena en un ranking de presencia", async () => {
  await sembrar([
    /* Solo aristas: su unica pieza es la raiz de una plataforma. */
    amplificacion(PROY_A, "facebook.com/algo/posts/1", "facebook.com"),
    publicacion(PROY_A, "medioa.com/n1", "medioa.com", {
      publishedAt: "2026-09-02T10:00:00.000Z"
    })
  ]);

  const h = await homeDeProyecto({
    projectId: PROY_A,
    ventana: "7d",
    ahora: AHORA,
    lake: {}
  });

  assert.ok(
    h.presencia.ranking.every((f) => f.dominio !== "facebook.com"),
    "presencia es aparicion en el corpus"
  );

  /* Pero no se oculta. */
  assert.ok(Array.isArray(h.presencia.fuentesSinPiezasCanonicas));
});


/*
===========================================================
Q/R · SNAPSHOTS Y MOMENTUM
===========================================================
*/

test("Q · el corpus no inventa snapshots ni series", async () => {
  await sembrar([
    publicacion(PROY_A, "medioa.com/n1", "medioa.com", {
      publishedAt: "2026-09-02T10:00:00.000Z"
    })
  ]);

  const c = await corpusCanonicoDeProyecto({ projectId: PROY_A, lake: {} });

  /* El corpus canonico es una VISTA: no escribe nada. */
  assert.equal(c.piezas.length, 1);

  assert.equal(c.snapshots, undefined);

  assert.equal(c.series, undefined);
});


test("R · ninguna respuesta de la HOME calcula momentum", async () => {
  await sembrar([
    publicacion(PROY_A, "medioa.com/n1", "medioa.com", {
      publishedAt: "2026-09-02T10:00:00.000Z"
    })
  ]);

  const h = await homeDeProyecto({
    projectId: PROY_A,
    ventana: "7d",
    ahora: AHORA,
    lake: {}
  });

  const json = JSON.stringify(h);

  ['"momentum"', '"tendencia"', '"crecimiento"', '"variacionPorcentual"'].forEach((k) => {
    assert.ok(!json.includes(`${k}:`), `la respuesta no puede exponer ${k}`);
  });
});


/*
===========================================================
S/T/U · REGRESIONES DE LOS GATES ANTERIORES
===========================================================
*/

test("S · mediaTime sigue gobernando las fechas del corpus", async () => {
  await sembrar([
    /* Fecha en espanol: se resuelve. */
    amplificacion(PROY_A, "medioa.com/es", "medioa.com", { fechaHecho: "3 jul 2026" }),

    /* Ambigua: sigue sin resolverse. */
    amplificacion(PROY_A, "medioa.com/amb", "medioa.com", { fechaHecho: "03/07/2026" })
  ]);

  const c = await corpusCanonicoDeProyecto({ projectId: PROY_A, lake: {} });

  const es = c.piezas.find((p) => p.clave.includes("/es"));

  const amb = c.piezas.find((p) => p.clave.includes("/amb"));

  assert.ok(es.publishedAt, "la fecha en espanol se resuelve");

  assert.equal(amb.publishedAt, null, "la ambigua NO");

  assert.equal(amb.publishedAtBruto, "03/07/2026");
});


test("T · el universo de medios sigue respondiendo con el corpus integrado", async () => {
  await sembrar([
    publicacion(PROY_A, "medioa.com/n1", "medioa.com", {
      publishedAt: "2026-09-02T10:00:00.000Z"
    })
  ]);

  const c = await corpusCanonicoDeProyecto({ projectId: PROY_A, lake: {} });

  assert.ok(c.universo, "el universo se consulta");

  assert.ok(typeof c.universo.entidades === "number");
});


test("U · el aislamiento del corpus de piezas se conserva en la respuesta", async () => {
  await sembrar([
    publicacion(PROY_A, "medioa.com/n1", "medioa.com", {
      publishedAt: "2026-09-02T10:00:00.000Z"
    }),
    publicacion(PROY_B, "mediob.com/n1", "mediob.com", {
      publishedAt: "2026-09-02T10:00:00.000Z"
    })
  ]);

  const c = await corpusCanonicoDeProyecto({ projectId: PROY_A, lake: {} });

  assert.ok(c.aislamiento, "la declaracion de aislamiento viaja");

  assert.equal(c.projectId, PROY_A);
});


/*
===========================================================
SOBRE EL LAKE REAL
===========================================================
*/

test("Lake real: el corpus canonico del piloto reconcilia y no suma sin mas", async () => {
  cerrarLake();

  await abrirLake({ adaptador: "fichero", forzarNueva: true });

  const c = await corpusCanonicoDeProyecto({
    projectId: "alcaldia-cuenca-2027-piloto",
    lake: {}
  });

  assert.equal(c.ok, true);

  const r = c.reconciliacion;

  /* Invariantes, no cifras exactas: el corpus crece. */
  assert.ok(r.entradas > 0);

  assert.equal(
    r.canonicas + r.excluidas + r.fundidas,
    r.entradas,
    "toda entrada tiene destino: canonica, excluida o fundida"
  );

  assert.ok(r.excluidas > 0, "el corpus real tiene artefactos que excluir");

  /* Ninguna pieza canonica puede ser de un artefacto. */
  const dominios = c.piezas.map((p) => p.dominio);

  assert.ok(!dominios.includes("google.com"));

  assert.ok(!dominios.some((d) => String(d).endsWith(".elb.amazonaws.com")));

  /* El conflicto real sigue declarado. */
  assert.ok(c.activosEnConflicto.length >= 1);

  cerrarLake();
});


test("Lake real: la HOME del piloto mejora las ventanas sin romper el ranking", async () => {
  cerrarLake();

  await abrirLake({ adaptador: "fichero", forzarNueva: true });

  const h = await homeDeProyecto({
    projectId: "alcaldia-cuenca-2027-piloto",
    ventana: "7d",
    lake: {}
  });

  assert.equal(h.ok, true);

  /* Con las publicaciones medidas, 7d deja de estar vacio. */
  assert.ok(h.ventana.dentroDeVentana > 0, "la ventana de 7 dias ya situa piezas");

  assert.ok(h.presencia.ranking.length > 0);

  /* Cada fila del ranking tiene su justificacion. */
  h.presencia.ranking.forEach((f) => {
    assert.ok(f.porQue.razones.length >= 3);

    assert.ok((f.piezasEnCorpus.valor || 0) > 0, "ninguna fila con cero piezas");
  });

  /* Y la reconciliacion viaja en la cobertura. */
  assert.ok(h.cobertura.reconciliacion);

  assert.ok(h.cobertura.procedencias.length >= 1);

  cerrarLake();
});
