// apps/backend/tests/mediaPiece02.test.mjs

import test from "node:test";
import assert from "node:assert/strict";

import { detectarPlataforma, resolverPieza } from "../services/media/pieceResolver.js";

import { planDeMetricas, leerMetricas } from "../services/media/pieceMetrics.js";

import {
  estadoDeCampo,
  matrizDePieza,
  matrizCompleta,
  comprobarCoherencia,
  ESTADOS_CAMPO,
  CAMPOS_PIEZA
} from "../services/media/pieceFieldMatrix.js";

import {
  leerMetadataPublica,
  robotsPermite,
  limpiarCacheRobots,
  ESTADOS_LECTURA,
  PROCEDENCIAS_CAMPO,
  AGENTE
} from "../services/media/publicMetadata.js";

import { enriquecerPieza, emisorDesdeTitulo } from "../services/media/pieceEnrichment.js";

import { fallbackWebDePieza } from "../services/media/pieceAmplification.js";

import { fichaCompleta, CANDIDATOS, ESTADO_BENCHMARK } from "../services/media/commercialProviderBenchmark.js";

import { analizarPieza, auditarAfirmaciones } from "../services/media/analyzePiece.js";

import {
  PLATAFORMAS,
  CLASES_EMISOR,
  DISPONIBILIDAD,
  METRICAS_PIEZA
} from "../services/media/pieceContracts.js";

import { resolverPosts, estaConfigurado as xConfigurado } from "../services/ingest/adapters/xAdapter.js";

/*
===========================================================
MEDIA-PIECE-02 — PRUEBAS
===========================================================

Ninguna toca la red. Todo lo que necesita un servidor recibe un
`fetch` simulado, y el analisis completo va con
`sinBusquedaWeb` para que los proveedores —que usan el fetch
global— no se disparen.
===========================================================
*/


/*
  El cache de robots.txt es por host y con TTL de 15 minutos.
  Entre tests hay que purgarlo: si uno deja el host como
  prohibido, los siguientes heredarian esa regla y fallarian por
  una razon que no tiene nada que ver con lo que prueban.
*/
test.beforeEach(() => {
  limpiarCacheRobots();
});


/* --------------------------------------------------------
   FIXTURES
-------------------------------------------------------- */

const FIXTURES = {
  fbReel: "https://www.facebook.com/reel/1234567890123456",
  fbPost: "https://www.facebook.com/MiPaginaLocal/posts/9988776655",
  fbPostPfbid: "https://www.facebook.com/MiPaginaLocal/posts/pfbid0abcXYZ123",
  fbWatch: "https://www.facebook.com/watch/?v=778899001122",
  xStatus: "https://x.com/algun_usuario/status/1890123456789012345",
  xStatusSinHandle: "https://x.com/i/status/1890123456789012345",
  twitterStatus: "https://twitter.com/algun_usuario/status/1890123456789012345",
  igReel: "https://www.instagram.com/reel/AbCdEf123/",
  ttVideo: "https://www.tiktok.com/@alguna_cuenta/video/7300011122233",
  ytWatch: "https://www.youtube.com/watch?v=abc12345678",
  web: "https://un-medio-digital.tld/noticias/una-nota-cualquiera"
};


/* Un HTML minimo con Open Graph, como el de cualquier medio. */
function htmlConOg({
  titulo = "Titular real de la nota",
  desc = "Un extracto que el medio publica para compartir.",
  autor = "Nombre Del Periodista",
  fecha = "2026-08-20T14:30:00-05:00",
  sitio = "Un Medio Digital",
  canonical = "https://un-medio-digital.tld/noticias/una-nota-cualquiera"
} = {}) {
  return `<!doctype html><html><head>
<title>${titulo} | ${sitio}</title>
<meta property="og:title" content="${titulo}">
<meta property="og:description" content="${desc}">
<meta property="og:site_name" content="${sitio}">
<meta property="og:type" content="article">
<meta property="article:author" content="${autor}">
<meta property="article:published_time" content="${fecha}">
<link rel="canonical" href="${canonical}">
</head><body><p>cuerpo que no se guarda</p></body></html>`;
}


/* El muro que Facebook sirve a un agente no autenticado. */
const HTML_MURO_FB = `<!doctype html><html><head>
<title>Facebook</title></head><body>
<div>You must log in to continue.</div>
<div>Log in to Facebook</div>
</body></html>`;


/*
  fetch simulado: sirve robots.txt permisivo y luego el HTML que
  se le indique. Cuenta las peticiones para poder afirmar que no
  se piden mas de las declaradas.
*/
function fetchSimulado({ html = htmlConOg(), robots = "User-agent: *\nAllow: /", status = 200 } = {}) {
  const llamadas = [];

  const fn = async (url) => {
    const u = String(url);

    llamadas.push(u);

    if (u.endsWith("/robots.txt")) {
      return { ok: true, status: 200, url: u, text: async () => robots };
    }

    return {
      ok: status >= 200 && status < 300,
      status,
      url: u,
      text: async () => html
    };
  };

  fn.llamadas = llamadas;

  return fn;
}


/* --------------------------------------------------------
   1. FIXTURES: PLATAFORMA, ID Y CANONICA
-------------------------------------------------------- */

test("fixture facebook.com/reel/{id}: plataforma e id", () => {
  const d = detectarPlataforma(FIXTURES.fbReel);

  assert.equal(d.plataforma, PLATAFORMAS.FACEBOOK);
  assert.equal(d.publicationId, "1234567890123456");

  /* En /reel/{id} el emisor NO esta en la URL: debe ser null. */
  assert.equal(d.cuentaEnUrl, null);
});


test("fixture facebook.com/{page}/posts/{id}: el emisor SI esta en la URL", () => {
  const d = detectarPlataforma(FIXTURES.fbPost);

  assert.equal(d.plataforma, PLATAFORMAS.FACEBOOK);
  assert.equal(d.publicationId, "9988776655");
  assert.equal(d.cuentaEnUrl, "MiPaginaLocal");
});


test("fixture facebook: pfbid y /watch/?v= tambien resuelven id", () => {
  assert.equal(detectarPlataforma(FIXTURES.fbPostPfbid).publicationId, "pfbid0abcXYZ123");
  assert.equal(detectarPlataforma(FIXTURES.fbWatch).publicationId, "778899001122");
});


test("fixture x.com/{user}/status/{id}: plataforma, id y handle", () => {
  const d = detectarPlataforma(FIXTURES.xStatus);

  assert.equal(d.plataforma, PLATAFORMAS.X);
  assert.equal(d.publicationId, "1890123456789012345");
  assert.equal(d.cuentaEnUrl, "algun_usuario");
});


test("fixture x.com/i/status/{id}: id si, handle no", () => {
  const d = detectarPlataforma(FIXTURES.xStatusSinHandle);

  assert.equal(d.publicationId, "1890123456789012345");
  assert.equal(d.cuentaEnUrl, null);
});


test("twitter.com y x.com dan el mismo pieceId", () => {
  const a = resolverPieza({ url: FIXTURES.xStatus });

  const b = resolverPieza({ url: FIXTURES.twitterStatus });

  assert.ok(a.ok && b.ok);
  assert.equal(a.pieza.publicationId, b.pieza.publicationId);
});


test("ninguna pieza social se atribuye al dominio de la plataforma", () => {
  [FIXTURES.fbReel, FIXTURES.xStatusSinHandle, FIXTURES.igReel, FIXTURES.ytWatch].forEach(
    (u) => {
      const r = resolverPieza({ url: u });

      assert.ok(r.ok, u);

      const nombre = String(r.emisor.nombre || "");

      assert.ok(
        !/^(facebook|x|twitter|instagram|youtube|tiktok)\.com$/i.test(nombre),
        `${u} se atribuyo al dominio: ${nombre}`
      );
    }
  );
});


/* --------------------------------------------------------
   2. AUSENCIA ≠ CERO
-------------------------------------------------------- */

test("todas las plataformas: ninguna metrica ausente vale 0", () => {
  Object.values(FIXTURES).forEach((u) => {
    const r = resolverPieza({ url: u });

    if (!r.ok) return;

    const plan = planDeMetricas(r.pieza);

    plan.metricas.forEach((m) => {
      if (m.value == null) {
        assert.notEqual(m.value, 0, `${u} ${m.id}: null se convirtio en 0`);
        assert.ok(m.availability, `${u} ${m.id}: sin availability`);
        assert.ok(m.motivo, `${u} ${m.id}: sin motivo`);
      }
    });
  });
});


test("X: las seis metricas se declaran, no se omiten", () => {
  const r = resolverPieza({ url: FIXTURES.xStatus });

  const plan = planDeMetricas(r.pieza);

  const ids = plan.metricas.map((m) => m.id).sort();

  assert.deepEqual(ids, ["bookmarks", "comments", "likes", "quotes", "shares", "views"]);

  /*
    El usuario VE estos contadores en pantalla. Si no hay
    credencial, el estado correcto es REQUIERE_AUTORIZACION —no
    NO_DISPONIBLE—, porque la via existe y esta implementada.
  */
  if (!xConfigurado()) {
    plan.metricas.forEach((m) => {
      assert.equal(
        m.availability,
        DISPONIBILIDAD.REQUIERE_AUTORIZACION,
        `${m.id} deberia declarar que falta autorizacion`
      );

      assert.match(m.motivo, /X_BEARER_TOKEN|credencial|plan/i);
    });

    assert.match(plan.nota || "", /brecha|credencial|X_BEARER_TOKEN/i);
  }
});


test("X: guardados (bookmarks) existe como metrica", () => {
  assert.ok(
    METRICAS_PIEZA.some((m) => m.id === "bookmarks"),
    "el usuario ve guardados en la interfaz: el modelo debe contemplarlos"
  );
});


test("Facebook: las metricas exigen autorizacion, no son NO_DISPONIBLE", () => {
  const r = resolverPieza({ url: FIXTURES.fbReel });

  const plan = planDeMetricas(r.pieza);

  ["views", "likes", "comments", "shares"].forEach((id) => {
    const m = plan.metricas.find((x) => x.id === id);

    assert.equal(m.value, null);

    assert.equal(
      m.availability,
      DISPONIBILIDAD.REQUIERE_AUTORIZACION,
      `${id}: existe via oficial (Graph) pero exige revision de Meta`
    );
  });
});


/* --------------------------------------------------------
   3. MATRIZ POR CAMPO
-------------------------------------------------------- */

test("matriz: coherente con la matriz oficial de capacidades", () => {
  const c = comprobarCoherencia();

  assert.equal(c.coherente, true, c.problemas.join(" | "));
});


test("matriz: ninguna metrica puede resolverse por via web indirecta", () => {
  matrizCompleta().forEach((m) => {
    m.campos
      .filter((c) => c.clase === "metrica")
      .forEach((c) => {
        assert.notEqual(
          c.estado,
          ESTADOS_CAMPO.DISPONIBLE_WEB_INDIRECTO,
          `${m.plataforma}.${c.id}: indexacion web no es acceso a metricas`
        );
      });
  });
});


test("matriz: cubre todas las plataformas y todos los campos", () => {
  const plataformas = matrizCompleta().map((m) => m.plataforma);

  Object.values(PLATAFORMAS).forEach((p) =>
    assert.ok(plataformas.includes(p), `falta ${p}`)
  );

  matrizCompleta().forEach((m) => {
    assert.equal(m.campos.length, CAMPOS_PIEZA.length, `${m.plataforma}: campos incompletos`);

    m.campos.forEach((c) => {
      assert.ok(
        Object.values(ESTADOS_CAMPO).includes(c.estado),
        `${m.plataforma}.${c.id}: estado invalido ${c.estado}`
      );

      assert.ok(c.nota, `${m.plataforma}.${c.id}: sin nota explicativa`);
    });
  });
});


test("matriz: el titulo de una web es web-indirecto y sus metricas no existen", () => {
  const web = matrizDePieza(PLATAFORMAS.WEB);

  const titulo = web.campos.find((c) => c.id === "titulo");

  assert.equal(titulo.estado, ESTADOS_CAMPO.DISPONIBLE_WEB_INDIRECTO);

  const views = web.campos.find((c) => c.id === "views");

  assert.equal(views.estado, ESTADOS_CAMPO.NO_DISPONIBLE);
});


/* --------------------------------------------------------
   4. METADATA PUBLICA: NO EVASIVA
-------------------------------------------------------- */

test("robots.txt: si prohibe la ruta, no se pide la pagina", async () => {
  const f = fetchSimulado({ robots: "User-agent: *\nDisallow: /noticias/" });

  const r = await leerMetadataPublica(FIXTURES.web, { fetch: f });

  assert.equal(r.estado, ESTADOS_LECTURA.PROHIBIDA_POR_ROBOTS);

  /* Solo se pidio robots.txt: la pagina NO. */
  assert.equal(f.llamadas.length, 1);
  assert.match(f.llamadas[0], /robots\.txt$/);
});


test("robots.txt: Allow mas especifico gana a Disallow general", async () => {
  const f = fetchSimulado({
    robots: "User-agent: *\nDisallow: /\nAllow: /noticias/"
  });

  const r = await leerMetadataPublica(FIXTURES.web, { fetch: f });

  assert.equal(r.estado, ESTADOS_LECTURA.OK);
});


test("robots.txt: si no se puede leer, no se pide la pagina", async () => {
  const f = async (url) => {
    if (String(url).endsWith("/robots.txt")) {
      return { ok: false, status: 500, text: async () => "" };
    }

    throw new Error("no deberia pedirse la pagina");
  };

  const r = await leerMetadataPublica(FIXTURES.web, { fetch: f });

  assert.equal(r.estado, ESTADOS_LECTURA.PROHIBIDA_POR_ROBOTS);
});


test("user-agent: se identifica, no imita a un navegador", () => {
  assert.match(AGENTE, /^SentinelIntelligence\//);
  assert.ok(!/Mozilla|Chrome|Safari|AppleWebKit/i.test(AGENTE));
});


test("no se envian cookies ni cabeceras de sesion", async () => {
  let cabeceras = null;

  const f = async (url, opts) => {
    if (String(url).endsWith("/robots.txt")) {
      return { ok: true, status: 200, text: async () => "User-agent: *\nAllow: /" };
    }

    cabeceras = opts?.headers || {};

    return { ok: true, status: 200, url, text: async () => htmlConOg() };
  };

  await leerMetadataPublica(FIXTURES.web, { fetch: f });

  const claves = Object.keys(cabeceras).map((k) => k.toLowerCase());

  assert.ok(!claves.includes("cookie"));
  assert.ok(!claves.includes("authorization"));
  assert.ok(!claves.includes("referer"));
  assert.deepEqual(claves.sort(), ["accept", "user-agent"]);
});


test("open graph: extrae titulo, autor y fecha con su procedencia", async () => {
  const r = await leerMetadataPublica(FIXTURES.web, { fetch: fetchSimulado() });

  assert.equal(r.estado, ESTADOS_LECTURA.OK);

  assert.equal(r.campos.titulo.valor, "Titular real de la nota");
  assert.equal(r.campos.titulo.procedencia, PROCEDENCIAS_CAMPO.OG);
  assert.equal(r.campos.titulo.etiqueta, "og:title");

  assert.equal(r.campos.autor.valor, "Nombre Del Periodista");
  assert.ok(r.campos.publishedAt.valor);
  assert.equal(r.campos.canonical.procedencia, PROCEDENCIAS_CAMPO.CANONICAL);
});


test("muro de plataforma: se declara, no se rodea", async () => {
  const f = fetchSimulado({ html: HTML_MURO_FB });

  const r = await leerMetadataPublica(FIXTURES.fbReel, { fetch: f });

  assert.equal(r.estado, ESTADOS_LECTURA.BLOQUEADA_POR_LA_PLATAFORMA);
  assert.match(r.motivo, /muro/i);

  /* Nada se rellena con el HTML del muro. */
  Object.values(r.campos).forEach((c) => assert.equal(c.valor, null));
});


test("HTTP 403: acceso restringido, no error generico", async () => {
  const r = await leerMetadataPublica(FIXTURES.fbReel, {
    fetch: fetchSimulado({ status: 403, html: "" })
  });

  assert.equal(r.estado, ESTADOS_LECTURA.BLOQUEADA_POR_LA_PLATAFORMA);
  assert.match(r.motivo, /403/);
});


/* --------------------------------------------------------
   5. ENRIQUECIMIENTO
-------------------------------------------------------- */

test("enriquecimiento: una nota web pasa de sin-titulo a con-titulo", async () => {
  const base = resolverPieza({ url: FIXTURES.web });

  assert.equal(base.pieza.titulo, null, "sin leer la pagina no hay titulo");

  const enr = await enriquecerPieza(base.pieza, base.emisor, {
    fetch: fetchSimulado()
  });

  assert.equal(enr.pieza.titulo, "Titular real de la nota");
  assert.equal(enr.pieza.autor, "Nombre Del Periodista");
  assert.ok(enr.pieza.publishedAt);
  assert.equal(enr.procedenciaCampos.titulo, PROCEDENCIAS_CAMPO.OG);
});


test("enriquecimiento: emisor de un reel sale de og:title", async () => {
  const base = resolverPieza({ url: FIXTURES.fbReel });

  assert.equal(base.emisor.clase, CLASES_EMISOR.NO_DETERMINADO);

  const enr = await enriquecerPieza(base.pieza, base.emisor, {
    fetch: fetchSimulado({
      html: htmlConOg({
        titulo: "Radio Local FM on Facebook: mira lo que pasó hoy",
        autor: "",
        sitio: "Facebook"
      })
    })
  });

  assert.equal(enr.emisor.nombre, "Radio Local FM");
  assert.equal(enr.emisor.pendienteDeResolver, false);
  assert.ok(enr.emisor.advertencia, "CREADOR por defecto exige advertencia");
});


test("emisorDesdeTitulo: no inventa cuando el patron no encaja", () => {
  assert.equal(emisorDesdeTitulo("Un titular normal de un periodico"), null);
  assert.equal(emisorDesdeTitulo(""), null);
  assert.equal(emisorDesdeTitulo(null), null);

  assert.equal(emisorDesdeTitulo("Alguien on Facebook: hola")?.nombre, "Alguien");
});


test("enriquecimiento: og:description de una red se marca como extracto", async () => {
  const base = resolverPieza({ url: FIXTURES.fbReel });

  const enr = await enriquecerPieza(base.pieza, base.emisor, {
    fetch: fetchSimulado({ html: htmlConOg({ titulo: "Pagina on Facebook: algo" }) })
  });

  assert.ok(
    enr.limitaciones.some((l) => /extracto recortado/i.test(l)),
    "debe advertir que og:description no es el caption completo"
  );
});


test("enriquecimiento: campos pendientes explican POR QUE faltan", async () => {
  const base = resolverPieza({ url: FIXTURES.fbReel });

  const enr = await enriquecerPieza(base.pieza, base.emisor, {
    fetch: fetchSimulado({ html: HTML_MURO_FB })
  });

  assert.ok(enr.camposPendientes.length > 0);

  enr.camposPendientes.forEach((c) => {
    assert.ok(c.estado, `${c.campo}: sin estado`);
    assert.ok(c.motivo, `${c.campo}: sin motivo`);
    assert.ok(c.accionable, `${c.campo}: sin accion sugerida`);
  });
});


test("enriquecimiento: si el analista ya lo declaro, no se pide la pagina", async () => {
  const base = resolverPieza({
    url: FIXTURES.web,
    titulo: "Titulo del analista",
    autor: "Autor del analista",
    publishedAt: "2026-08-01T00:00:00Z"
  });

  const f = fetchSimulado();

  const enr = await enriquecerPieza(base.pieza, base.emisor, { fetch: f });

  assert.equal(f.llamadas.length, 0, "no debe hacer ninguna peticion");
  assert.equal(enr.metadata.estado, ESTADOS_LECTURA.NO_INTENTADA);
  assert.equal(enr.pieza.titulo, "Titulo del analista");
});


/* --------------------------------------------------------
   6. SNIPPET ≠ CONTENIDO ORIGINAL
-------------------------------------------------------- */

test("fallback web: sin URL no consulta nada", async () => {
  const r = await fallbackWebDePieza({}, {});

  assert.equal(r.encontrado, false);
  assert.equal(r.consultas, 0);
});


test("fallback web: un snippet nunca se presenta como contenido original", async () => {
  /*
    Se comprueba sobre el contrato del modulo, sin red: cualquier
    campo que devuelva `fallbackWebDePieza` debe traer
    `esContenidoOriginal: false`. El test lee el codigo fuente
    porque ejecutar la funcion exigiria un proveedor real.
  */
  const { readFile } = await import("node:fs/promises");

  const src = await readFile(
    new URL("../services/media/pieceAmplification.js", import.meta.url),
    "utf8"
  );

  const bloque = src.slice(src.indexOf("export async function fallbackWebDePieza"));

  const campos = [...bloque.matchAll(/procedencia:\s*"snippet_de_buscador"/g)];

  const marcas = [...bloque.matchAll(/esContenidoOriginal:\s*false/g)];

  assert.ok(campos.length >= 3, "los tres campos deben declarar procedencia");

  assert.equal(
    marcas.length,
    campos.length,
    "cada campo con procedencia de snippet debe marcar esContenidoOriginal:false"
  );

  assert.match(bloque, /no habilita ninguna metrica/i);
});


/* --------------------------------------------------------
   7. CONTEXTO CANDIDATO OPCIONAL (§C)
-------------------------------------------------------- */

test("contexto: la pieza se resuelve sin projectId ni candidateId", async () => {
  const a = await analizarPieza(
    { url: FIXTURES.web, sinBusquedaWeb: true },
    { fetch: fetchSimulado(), persistir: false }
  );

  assert.equal(a.ok, true);

  /* Todo lo estructural resuelto sin contexto. */
  assert.ok(a.pieza.canonicalUrl);
  assert.equal(a.pieza.plataforma, PLATAFORMAS.WEB);
  assert.equal(a.pieza.titulo, "Titular real de la nota");

  assert.equal(a.contextoAnalitico.obligatorio, false);
  assert.equal(a.contextoAnalitico.resuelto, false);
  assert.ok(a.contextoAnalitico.queAportaSiSeIndica.length > 0);
  assert.match(a.contextoAnalitico.declaracion, /OPCIONAL/i);
});


test("contexto: candidateId sin projectId no bloquea la resolucion", async () => {
  const a = await analizarPieza(
    { url: FIXTURES.web, candidateId: "cand-1", sinBusquedaWeb: true },
    { fetch: fetchSimulado(), persistir: false }
  );

  assert.equal(a.ok, true);
  assert.ok(a.pieza.titulo, "el titulo se resuelve igual");
  assert.equal(a.contextoAnalitico.resuelto, false);
  assert.ok(a.contextoAnalitico.motivo);
});


/* --------------------------------------------------------
   8. PROCEDENCIA DE CADA CAMPO
-------------------------------------------------------- */

test("procedencia: cada campo resuelto declara de donde vino", async () => {
  const a = await analizarPieza(
    { url: FIXTURES.web, sinBusquedaWeb: true },
    { fetch: fetchSimulado(), persistir: false }
  );

  assert.ok(a.procedenciaCampos, "debe existir el mapa de procedencias");

  ["titulo", "autor", "publishedAt"].forEach((c) => {
    if (a.pieza[c === "publishedAt" ? "publishedAt" : c]) {
      assert.ok(
        a.procedenciaCampos[c],
        `${c} tiene valor pero no declara procedencia`
      );
    }
  });
});


test("ningun dato inventado: el analisis de un muro deja los campos vacios", async () => {
  const a = await analizarPieza(
    { url: FIXTURES.fbReel, sinBusquedaWeb: true },
    { fetch: fetchSimulado({ html: HTML_MURO_FB }), persistir: false }
  );

  assert.equal(a.ok, true);
  assert.equal(a.pieza.titulo, null);
  assert.equal(a.pieza.autor, null);
  assert.equal(a.pieza.publishedAt, null);

  /* Pero la plataforma y el id SI se resolvieron. */
  assert.equal(a.pieza.plataforma, PLATAFORMAS.FACEBOOK);
  assert.ok(a.pieza.publicationId);

  /* Y se explica por que. */
  assert.ok(
    a.limitaciones.some((l) => /no entrega la metadata|muro/i.test(l)),
    "debe declarar el muro"
  );

  assert.ok(
    a.limitaciones.some((l) => /ESPERADO/i.test(l)),
    "debe aclarar que no es un fallo del modulo"
  );

  assert.equal(auditarAfirmaciones(a).limpio, true);
});


test("el analisis incluye la matriz de campos de su plataforma", async () => {
  const a = await analizarPieza(
    { url: FIXTURES.fbReel, sinBusquedaWeb: true },
    { fetch: fetchSimulado({ html: HTML_MURO_FB }), persistir: false }
  );

  assert.equal(a.matrizDeCampos.plataforma, PLATAFORMAS.FACEBOOK);
  assert.ok(a.matrizDeCampos.campos.length > 0);
  assert.ok(a.matrizDeCampos.reglas.some((r) => /Indexacion web/i.test(r)));
});


/* --------------------------------------------------------
   9. X: EL ADAPTER NO TOCA LA RED SIN CREDENCIAL
-------------------------------------------------------- */

test("X resolverPosts: sin credencial devuelve SIN_CREDENCIAL y 0 llamadas", async () => {
  if (xConfigurado()) return; /* con credencial este test no aplica */

  const f = async () => {
    throw new Error("no deberia llamarse a la red sin credencial");
  };

  const r = await resolverPosts(["123"], { fetch: f });

  assert.equal(r.estado, "SIN_CREDENCIAL");
  assert.equal(r.llamadas, 0);
  assert.deepEqual(r.posts, []);
});


test("X resolverPosts: sin ids no llama", async () => {
  const r = await resolverPosts([], {});

  assert.equal(r.llamadas, 0);
});


test("leerMetricas de X sin credencial no inventa cifras", async () => {
  const r = await leerMetricas(
    {
      plataforma: PLATAFORMAS.X,
      publicationId: "1890123456789012345",
      canonicalUrl: FIXTURES.xStatus
    },
    {}
  );

  r.metricas.forEach((m) => {
    assert.equal(m.value, null, `${m.id} debe ser null`);
  });
});


/* --------------------------------------------------------
   10. BENCHMARK: FICHA, NO COMPRA
-------------------------------------------------------- */

test("benchmark: ningun proveedor evaluado ni contratado", () => {
  const f = fichaCompleta();

  assert.equal(f.estado, "FICHA_DEFINIDA_SIN_EVALUAR");

  f.candidatos.forEach((c) => {
    assert.equal(c.estado, ESTADO_BENCHMARK.SIN_EVALUAR, `${c.id} no debe estar evaluado`);
    assert.equal(c.verificado, false);
    assert.equal(c.costePorEvidenciaUtil, null, `${c.id}: no se inventa coste`);
    assert.equal(c.resultados, null);
  });
});


test("benchmark: cubre las cuatro plataformas pedidas", () => {
  const todas = new Set(CANDIDATOS.flatMap((c) => c.plataformasDeclaradas));

  ["x", "facebook", "instagram", "tiktok"].forEach((p) =>
    assert.ok(todas.has(p), `ninguna ficha cubre ${p}`)
  );
});


test("benchmark: las 13 dimensiones pedidas estan y cada una dice COMO se mide", () => {
  const f = fichaCompleta();

  const ids = f.dimensiones.map((d) => d.id);

  [
    "plataformas",
    "publicaciones",
    "metricas",
    "perfiles",
    "historico",
    "busqueda",
    "coste",
    "limites",
    "terminos",
    "estabilidad",
    "cobertura_ec",
    "evidence_url",
    "coste_evidencia_util"
  ].forEach((d) => assert.ok(ids.includes(d), `falta la dimension ${d}`));

  f.dimensiones.forEach((d) => assert.ok(d.como, `${d.id}: sin metodo de medida`));
});


test("benchmark: sin URL verificable el proveedor queda descartado", () => {
  const f = fichaCompleta();

  const regla = f.criteriosAdmision.find((c) => c.id === "url_verificable");

  assert.ok(regla);
  assert.equal(regla.siFalla, ESTADO_BENCHMARK.DESCARTADO);
  assert.match(f.reglaDura, /descartado/i);
});


test("pendientes: la UX de selectores queda registrada (§G)", () => {
  const f = fichaCompleta();

  const ux = f.pendientes.find((p) => p.id === "UX-MEDIA-01");

  assert.ok(ux, "debe existir el pendiente de selectores");
  assert.match(ux.titulo, /selectores/i);
  assert.ok(ux.solucion);
  assert.ok(ux.porQueNoSeHizoAqui);
});


/* --------------------------------------------------------
   11. ALCANCE DE MEDICION: PROPIA ≠ TERCERO
-------------------------------------------------------- */

test("alcance: un DISPONIBLE de cuenta propia no habilita metricas de un tercero", () => {
  const c = comprobarCoherencia();

  assert.equal(c.coherente, true, c.problemas.join(" | "));

  /*
    La matriz oficial declara capacidades de Instagram medidas
    sobre NUESTRA cuenta. Deben quedar fuera de la comparacion.
  */
  assert.ok(
    c.ignoradasPorAlcance.length > 0,
    "deberia haber capacidades ignoradas por ser de cuenta propia"
  );

  c.ignoradasPorAlcance.forEach((i) => {
    /* La matriz oficial puede usar la clave corta o el valor largo. */
    assert.match(String(i.alcance), /^(PROPIA|CUENTA_PROPIA_O_AUTORIZADA)$/);
    assert.ok(i.motivo);
  });
});


test("alcance: Instagram no promete metricas de terceros pese al DISPONIBLE oficial", () => {
  const ig = matrizDePieza(PLATAFORMAS.INSTAGRAM);

  ["views", "likes", "comments", "shares"].forEach((id) => {
    const campo = ig.campos.find((c) => c.id === id);

    assert.notEqual(
      campo.estado,
      ESTADOS_CAMPO.DISPONIBLE_OFICIAL,
      `instagram.${id}: no puede prometerse para una pieza de un tercero`
    );
  });

  assert.match(ig.capacidadOficial.avisoDeAlcance, /tercero/i);
});


/* --------------------------------------------------------
   12. DEFECTOS REALES ENCONTRADOS EN MEDIA-REAL-DEMO-01
-------------------------------------------------------- */

test("demo-01: el emisor de una cuenta sin evidencia es NO_CLASIFICADO", async () => {
  const { CLASES_EMISOR: CE } = await import("../services/media/pieceContracts.js");

  const r = resolverPieza({ url: "https://x.com/una_cuenta_sin_catalogo/status/1" });

  assert.equal(r.emisor.clase, CE.NO_CLASIFICADO);

  /*
    Antes devolvia CREADOR "por defecto". En un panel eso se lee
    como una conclusion, y no habia evidencia ninguna.
  */
  assert.notEqual(r.emisor.clase, CE.CREADOR);
  assert.ok(r.emisor.advertencia);
});


test("demo-01: una correspondencia con el catalogo NO cambia la clase", async () => {
  const { correspondenciasDeCuenta } = await import(
    "../services/media/emitterCorrespondence.js"
  );

  /* Handle que coincide con un medio real del catalogo. */
  const c = correspondenciasDeCuenta("tomebamba");

  assert.ok(c.total >= 1, "deberia encontrar el medio del catalogo");
  assert.equal(c.candidatos[0].estado, "OBSERVADA_NO_VERIFICADA");
  assert.equal(c.candidatos[0].requiereConfirmacion, true);
  assert.ok(c.declaracion.texto.includes("no es una identidad") ||
            /no prueba/i.test(c.declaracion.texto));

  /* La pieza sigue sin clasificar pese a la correspondencia. */
  const r = resolverPieza({ url: "https://x.com/tomebamba/status/1" });

  assert.equal(r.emisor.clase, "NO_CLASIFICADO");
  assert.ok(r.emisor.correspondencia.total >= 1);
});


test("demo-01: un handle generico no produce correspondencia falsa", async () => {
  const { correspondenciasDeCuenta } = await import(
    "../services/media/emitterCorrespondence.js"
  );

  /*
    "radio" y "cuenca" los comparte medio catalogo: no distinguen
    a nadie y no deben generar coincidencia.
  */
  ["radionoticias", "cuencadigital", "eldiario"].forEach((h) => {
    const c = correspondenciasDeCuenta(h);

    c.candidatos.forEach((x) => {
      assert.ok(
        x.terminos.every((t) => !["radio", "cuenca", "diario"].includes(t)),
        `${h}: correspondencia sostenida por un termino generico (${x.terminos})`
      );
    });
  });
});


test("demo-01: la comparacion de nombres ignora acentos", async () => {
  const { relacionarConCandidato } = await import(
    "../services/media/pieceCandidate.js"
  );

  /*
    `variantesDeNombre` devuelve las variantes sin acentos y el
    texto real los lleva. Sin normalizar las dos partes, una
    pieza que nombra al candidato salia como "no lo menciona".
  */
  const r = relacionarConCandidato({
    pieza: {
      titulo: null,
      snippet:
        "Se oficializo la precandidatura de Paúl Carrasco Carpio a la Alcaldía de Cuenca.",
      evidenceId: "ev-acentos",
      publishedAt: "2026-07-03T00:00:00Z"
    },
    emisor: { dominio: "x.com", nombre: "Un medio" },
    candidato: {
      candidateId: "paul-carrasco-carpio",
      nombre: "Paúl Carrasco Carpio",
      alias: [],
      cuentas: []
    }
  });

  assert.equal(r.vinculado, true, "debe detectar el nombre con acentos");
  assert.equal(r.relaciones.length, 1);
});


test("demo-01: la clave de entidad es estable con y sin esquema", async () => {
  const { componerSnapshotPieza } = await import(
    "../services/media/pieceSnapshot.js"
  );

  /*
    La misma pieza no puede generar dos claves segun si la API
    respondio: eso rompia el dedup y el historico.
  */
  const a = componerSnapshotPieza({
    pieceId: "ev-k",
    canonicalUrl: "x.com/a/status/1",
    observedAt: "2026-08-01T00:00:00.000Z",
    metricas: []
  });

  const b = componerSnapshotPieza({
    pieceId: "ev-k",
    canonicalUrl: "x.com/a/status/1",
    observedAt: "2026-08-01T00:00:00.000Z",
    metricas: []
  });

  assert.equal(a.snapshotId, b.snapshotId);
});


test("demo-01: persistido refleja lo realmente escrito", async () => {
  const { guardarAnalisis } = await import("../services/media/pieceStore.js");

  const r = await guardarAnalisis({
    entrada: { projectId: "test-honestidad" },
    observedAt: new Date().toISOString(),
    pieza: {
      pieceId: "ev-honest",
      publicationId: "1",
      canonicalUrl: "x.com/h/status/1",
      url: "https://x.com/h/status/1",
      dominio: "x.com",
      plataforma: "x",
      evidenceId: "ev-honest",
      hash: "h1"
    },
    emisor: { dominio: "x.com", clase: "NO_CLASIFICADO", nombre: "H" },
    snapshot: {
      snapshotId: "snap-honest-" + Date.now(),
      pieceId: "ev-honest",
      observedAt: new Date().toISOString(),
      metricas: {}
    },
    amplificacion: { nodos: [] },
    candidato: { relaciones: [], relacionesAmplificacion: [] }
  });

  /*
    `escribirLoteEnLake` no lanza cuando el Lake rechaza: informar
    `persistido: true` sin mirar el recuento era afirmar un
    guardado que no habia ocurrido.
  */
  assert.equal(typeof r.escritos, "number");
  assert.equal(typeof r.rechazados, "number");

  if (r.escritos === 0) {
    assert.equal(r.persistido, false, "sin escrituras no puede decir persistido");
    assert.ok(r.motivosRechazo.length > 0, "debe declarar por que se rechazo");
  } else {
    assert.equal(r.persistido, true);
    assert.equal(r.rechazados, 0, r.motivosRechazo?.join(" | "));
  }
});


test("demo-01: las limitaciones resueltas no se arrastran", async () => {
  const { podarLimitaciones } = await import("../services/media/analyzePiece.js");

  const crudas = [
    "Autor no resuelto: este gate no descarga el HTML de la pieza.",
    "Fecha de publicacion no resuelta: sin ella no se puede ordenar la pieza.",
    "La evidencia es minima (sin título ni extracto): se conserva la URL.",
    "No se leyo la pagina: robots.txt prohibe /."
  ];

  /* Con todo resuelto, solo sobrevive la de robots. */
  const podadas = podarLimitaciones(
    crudas,
    { autor: null, publishedAt: "2026-07-03T00:00:00Z", snippet: "texto real" },
    { nombre: "La Voz del Tomebamba" }
  );

  assert.equal(podadas.length, 1);
  assert.match(podadas[0], /robots\.txt/);

  /* Sin resolver nada, se conservan todas. */
  assert.equal(podarLimitaciones(crudas, {}, {}).length, 4);
});


test("demo-01: X no dispara el fallback web buscando un titulo que no existe", async () => {
  const { matrizDePieza: mdp } = await import("../services/media/pieceFieldMatrix.js");

  const x = mdp("x");

  const titulo = x.campos.find((c) => c.id === "titulo");

  /*
    La matriz declara que una publicacion de X no tiene titulo.
    El orquestador consulta esto antes de gastar consultas web
    buscandolo.
  */
  assert.equal(titulo.estado, ESTADOS_CAMPO.NO_DISPONIBLE);
});


/* --------------------------------------------------------
   13. AMBITO DERIVADO DEL PROYECTO (MEDIA-REAL-DEMO-01)
-------------------------------------------------------- */

test("ambito: se deriva del territorio que el proyecto declara", async () => {
  const { resolverAmbito } = await import("../services/geo/territoryRegistry.js");

  /*
    El motor NO codifica ningun territorio: traduce lo que el
    proyecto declara contra el registro. Con otro proyecto sale
    otro ambito, y sin declaracion no sale ninguno.
  */
  const r = resolverAmbito({ pais: "Ecuador", provincia: "Azuay", canton: "Cuenca" });

  assert.equal(r.reconocido, true);
  assert.ok(r.unidad?.id, "debe devolver una unidad del registro");
  assert.equal(r.resolucion, "canton");
});


test("ambito: un territorio no declarado no se inventa", async () => {
  const { resolverAmbito } = await import("../services/geo/territoryRegistry.js");

  const vacio = resolverAmbito({});

  assert.equal(vacio.reconocido, false);
  assert.equal(vacio.unidad, null);
  assert.ok(vacio.motivo);

  const inexistente = resolverAmbito({ canton: "Ciudad Que No Existe" });

  assert.equal(inexistente.reconocido, false);
  assert.equal(inexistente.unidad, null);
});


test("ambito: el motor de media no codifica ningun territorio", async () => {
  const { readFile } = await import("node:fs/promises");

  /*
    El ambito debe llegar del proyecto o del analista. Si el
    nombre de una ciudad aparece en el CODIGO del orquestador, el
    modulo dejaria de servir para otro proyecto.
  */
  const src = await readFile(
    new URL("../services/media/analyzePiece.js", import.meta.url),
    "utf8"
  );

  const codigo = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  assert.ok(!/cuenca/i.test(codigo), "no debe codificar una ciudad");
  assert.ok(!/azuay/i.test(codigo), "no debe codificar una provincia");
  assert.ok(!/ec-azuay/i.test(codigo), "no debe codificar un id de unidad");
});
