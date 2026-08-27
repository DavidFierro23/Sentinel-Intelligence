// apps/backend/tests/mediaPieceWet.test.mjs

import test from "node:test";
import assert from "node:assert/strict";

import { analizarPieza, auditarAfirmaciones } from "../services/media/analyzePiece.js";

import { leerMetricas } from "../services/media/pieceMetrics.js";

import { DISPONIBILIDAD } from "../services/media/pieceContracts.js";

/*
===========================================================
RUTA COMPLETA CON PROVEEDOR SIMULADO
===========================================================

El camino "humedo" —el que si llama a proveedores— se prueba
con un `fetch` inyectado. Asi se comprueba el encadenado
completo, la persistencia y el enriquecimiento del emisor SIN
consumir una sola unidad de cuota real ni depender de que una
API este viva hoy.

El fetch simulado devuelve una respuesta con la MISMA FORMA que
la API de YouTube, incluido el caso interesante: `likeCount`
ausente porque el canal lo oculta. Ese caso es el que distingue
un null de un cero, y es el que hay que probar.
===========================================================
*/


function fetchYoutubeSimulado({ conLikes = false } = {}) {
  return async (url) => {
    const u = String(url);

    if (!u.includes("videos")) {
      return { ok: false, status: 404, text: async () => "no encontrado" };
    }

    const statistics = { viewCount: "1523004", commentCount: "3187" };

    /* Canal que oculta los "me gusta": la API simplemente no los manda. */
    if (conLikes) statistics.likeCount = "48211";

    return {
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            id: "abc12345678",
            snippet: {
              channelId: "UC_canal_de_prueba",
              channelTitle: "Canal De Prueba",
              title: "Un titular real devuelto por la plataforma",
              publishedAt: "2026-08-20T12:00:00Z"
            },
            statistics
          }
        ]
      })
    };
  };
}


test("metricas reales simuladas: se leen las presentes y las ausentes quedan null", async () => {
  const r = await leerMetricas(
    {
      plataforma: "youtube",
      publicationId: "abc12345678",
      canonicalUrl: "https://www.youtube.com/watch?v=abc12345678"
    },
    { fetch: fetchYoutubeSimulado(), observedAt: "2026-08-27T10:00:00.000Z" }
  );

  /*
    Si el entorno no tiene YOUTUBE_API_KEY, el plan no permite la
    lectura y no hay nada que comprobar aqui: eso ya lo cubre el
    test de plan. Se declara y se sale.
  */
  if (r.estado === "SIN_LECTURA") {
    assert.ok(r.motivo, "debe explicar por que no se leyo");
    return;
  }

  const views = r.metricas.find((m) => m.id === "views");

  const likes = r.metricas.find((m) => m.id === "likes");

  const shares = r.metricas.find((m) => m.id === "shares");

  assert.equal(views.value, 1523004);
  assert.equal(views.availability, DISPONIBILIDAD.DISPONIBLE);
  assert.ok(views.evidenceId, "una cifra sin evidencia no vale");

  /* El canal oculta los likes: null, y con el estado correcto. */
  assert.equal(likes.value, null);
  assert.equal(likes.availability, DISPONIBILIDAD.OCULTO_POR_LA_CUENTA);
  assert.notEqual(likes.value, 0, "oculto no es cero");

  /* La API no expone compartidos por video en ningun caso. */
  assert.equal(shares.value, null);

  /* La lectura enriquece la pieza con datos de la plataforma. */
  assert.equal(r.enriquecimiento.cuenta, "Canal De Prueba");
  assert.equal(r.enriquecimiento.publishedAt, "2026-08-20T12:00:00Z");

  assert.equal(r.cuota.youtube.unidadesConsumidas, 1, "1 unidad, no mas");
  assert.equal(r.cuota.youtube.llamadas, 1);
});


test("cuota agotada: se declara y no se inventan cifras", async () => {
  const fetchCuota = async () => ({
    ok: false,
    status: 403,
    text: async () => '{"error":{"message":"quotaExceeded"}}'
  });

  const r = await leerMetricas(
    {
      plataforma: "youtube",
      publicationId: "abc12345678",
      canonicalUrl: "https://www.youtube.com/watch?v=abc12345678"
    },
    { fetch: fetchCuota }
  );

  if (r.estado === "SIN_LECTURA") return;

  assert.equal(r.estado, "CUOTA_AGOTADA");

  r.metricas.forEach((m) => {
    assert.equal(m.value, null, `${m.id} debe quedar null`);
  });
});


test("analisis humedo completo: no revienta y respeta todas las garantias", async () => {
  /*
    El fetch simulado sirve para YouTube y devuelve 404 para
    cualquier otra cosa, de modo que las consultas web fallan de
    forma controlada: es exactamente el escenario en el que el
    analisis debe seguir entregando resultado con sus
    limitaciones declaradas.
  */
  const a = await analizarPieza(
    {
      url: "https://www.youtube.com/watch?v=abc12345678",
      projectId: "proyecto-de-prueba",

      /*
        Sin busqueda web: los proveedores usan el fetch global y
        no honran el inyectado. Sin esto, esta prueba lanzaria
        consultas REALES contra DuckDuckGo.
      */
      sinBusquedaWeb: true
    },
    { fetch: fetchYoutubeSimulado({ conLikes: true }), persistir: false }
  );

  assert.equal(a.ok, true);

  /* Estructura completa. */
  ["pieza", "emisor", "metricas", "candidato", "temas", "territorio", "snapshot", "serie", "evidencias", "limitaciones", "cuota"].forEach(
    (k) => assert.ok(k in a, `falta el bloque ${k}`)
  );

  /* Ninguna metrica leida puede ser 0 por ausencia. */
  a.metricas.forEach((m) => {
    if (m.availability !== DISPONIBILIDAD.DISPONIBLE) {
      assert.equal(m.value, null, `${m.id}: ausente debe ser null`);
    }
  });

  /* El snapshot existe y es el punto de hoy. */
  assert.ok(a.snapshot.snapshotId);
  assert.equal(a.snapshot.pieceId, a.pieza.pieceId);

  /* Higiene. */
  const h = auditarAfirmaciones(a);

  assert.equal(h.limpio, true, h.declaracion);

  /*
    No se afirma influencia por ningun lado.

    Se buscan campos y afirmaciones, NO substrings sueltos: el
    modulo contiene a proposito frases como "No afirma poblacion
    alcanzada", que son negaciones y deben poder existir.
  */
  const texto = JSON.stringify(a);

  assert.ok(!/"[a-zA-Z]*[Ii]nfluencia[a-zA-Z]*"\s*:/.test(texto));
  assert.ok(!/"[a-zA-Z]*[Ii]ntencionDeVoto[a-zA-Z]*"\s*:/.test(texto));
  assert.ok(!/"[a-zA-Z]*[Pp]oblacion[a-zA-Z]*"\s*:/.test(texto));

  /*
    Toda mencion a poblacion o influencia debe ser una NEGACION
    explicita. Se comprueba que no exista ninguna afirmativa.
  */
  const afirmaciones = [
    /(?<!no es )(?<!no )poblacion alcanzada/i,
    /(?<!no )influyo en/i,
    /(?<!no )cambio la intencion/i
  ];

  afirmaciones.forEach((re) => {
    assert.ok(!re.test(texto), `afirmacion prohibida detectada: ${re}`);
  });
});


test("dos analisis seguidos producen dos snapshots distintos", async () => {
  const comun = {
    url: "https://www.youtube.com/watch?v=abc12345678",
    projectId: "proyecto-de-prueba",
    sinBusquedaWeb: true
  };

  const a = await analizarPieza(
    { ...comun, observedAt: "2026-08-27T10:00:00.000Z" },
    { fetch: fetchYoutubeSimulado(), persistir: false }
  );

  const b = await analizarPieza(
    { ...comun, observedAt: "2026-08-28T10:00:00.000Z" },
    { fetch: fetchYoutubeSimulado(), persistir: false }
  );

  assert.equal(a.pieza.pieceId, b.pieza.pieceId, "es la misma pieza");

  assert.notEqual(
    a.snapshot.snapshotId,
    b.snapshot.snapshotId,
    "dos observaciones distintas son dos snapshots"
  );
});
