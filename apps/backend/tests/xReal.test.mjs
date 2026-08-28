// apps/backend/tests/xReal.test.mjs

/*
===========================================================
PRUEBAS DE X-REAL-01
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/xReal.test.mjs

SIN RED. El `fetch` se inyecta y cada caso declara que responde
la API, incluidos los codigos de error.

LO QUE DEFIENDEN
-----------------------------------------------------------

1 · CUATRO BLOQUEOS QUE NO SE ARREGLAN IGUAL.
    401 revisar credencial · 402 cargar saldo · 403 contratar
    otro plan · 429 esperar. Confundirlos manda a mirar el token
    cuando lo que falta es pagar.

2 · LA REGRESION MEDIDA EN X-REAL-01.
    El adapter devolvio `motivo: "HTTP 402"` SIN `httpStatus`, y
    el primer clasificador lo etiqueto ERROR. La parada fue
    correcta; el diagnostico, no. El codigo se lee tambien del
    texto.

3 · NUNCA SE REINTENTA.
    Un bloqueo detiene la secuencia. Se cuenta que no hubo una
    segunda llamada.

4 · 0 NO ES AUSENTE.
    Un `like_count: 0` es un dato; un `impression_count` que no
    viene, no.

5 · LO NO PROBADO NO SE LLAMA MEDIDO.
===========================================================
*/

process.env.SENTINEL_LAKE_ADAPTER = "memoria";

process.env.X_BEARER_TOKEN = "prueba";

const co = await import("../services/intelligence/candidateObservation.js");

const scm = await import("../services/intelligence/socialCapabilityMatrix.js");

const po = await import("../services/intelligence/publicationObservation.js");

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
      console.log(`  FALL  ${nombre}  (devolvió ${JSON.stringify(valor)})`);
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


const CUENTA = {
  id: "x:cuenta_ficticia",
  plataformaId: "x",
  handle: "cuenta_ficticia",
  url: "https://x.com/cuenta_ficticia",
  estado: "DECLARADA_POR_ANALISTA"
};

const USUARIO = {
  data: {
    id: "555",
    username: "cuenta_ficticia",
    name: "Cuenta Ficticia",
    description: "Descripcion cualquiera",
    created_at: "2016-02-02T00:00:00.000Z",
    public_metrics: { followers_count: 3100, following_count: 240, tweet_count: 5200 }
  }
};

const POSTS = {
  data: [
    {
      id: "9001",
      text: "Publicacion ficticia con todas las metricas",
      created_at: "2026-08-20T10:00:00.000Z",
      author_id: "555",
      public_metrics: {
        like_count: 88,
        retweet_count: 12,
        reply_count: 0,
        quote_count: 2,
        impression_count: 5400
      }
    },
    {
      id: "9002",
      text: "Publicacion ficticia sin impresiones",
      created_at: "2026-08-21T10:00:00.000Z",
      author_id: "555",
      public_metrics: { like_count: 4, retweet_count: 0, reply_count: 1, quote_count: 0 }
    }
  ]
};


/* Enruta por endpoint y cuenta las llamadas. */
function apiFalsa(respuestas = {}) {
  const contador = { total: 0, porEndpoint: [] };

  const fn = async (url) => {
    const u = String(url);

    const cual = u.includes("/users/by/username")
      ? "usuario"
      : u.includes("/tweets/search/recent")
        ? "busqueda"
        : u.includes("/users/")
          ? "timeline"
          : "otro";

    contador.total += 1;

    contador.porEndpoint.push(cual);

    const r = respuestas[cual];

    if (!r) return { ok: false, status: 404, text: async () => "" };

    if (r.status && r.status >= 400) {
      return { ok: false, status: r.status, text: async () => r.cuerpo || "" };
    }

    return { ok: true, status: 200, json: async () => r, text: async () => "" };
  };

  fn.contador = contador;

  return fn;
}


/*
===========================================================
1 · CLASIFICACION DE BLOQUEOS
===========================================================
*/
bloque("cuatro bloqueos, cuatro acciones distintas");

await t("402 es facturacion, no credencial", () => {
  const b = co.clasificarBloqueo({ httpStatus: 402, motivo: "HTTP 402" });

  return (
    b.tipo === co.ESTADOS_OBSERVACION_REAL.BILLING_BLOQUEADO &&
    b.accion.includes("saldo")
  );
});

/*
  LA REGRESION EXACTA de X-REAL-01: el adapter no expuso
  `httpStatus` y el codigo solo estaba en el texto.
*/
await t("402 se reconoce aunque solo venga en el texto, sin httpStatus", () => {
  const b = co.clasificarBloqueo({ motivo: "HTTP 402" });

  return b?.tipo === co.ESTADOS_OBSERVACION_REAL.BILLING_BLOQUEADO;
});

await t("y dice explicitamente que la credencial NO fue rechazada", () => {
  const b = co.clasificarBloqueo({ motivo: "HTTP 402" });

  return b.motivo.includes("no fue rechazada");
});

await t("401 es credencial", () => {
  return (
    co.clasificarBloqueo({ httpStatus: 401 }).tipo ===
    co.ESTADOS_OBSERVACION_REAL.CREDENCIAL_RECHAZADA
  );
});

await t("403 es plan insuficiente", () => {
  return (
    co.clasificarBloqueo({ httpStatus: 403 }).tipo ===
    co.ESTADOS_OBSERVACION_REAL.PERMISOS_INSUFICIENTES
  );
});

await t("429 es cuota, y es el unico reintentable de los cuatro", () => {
  const b = co.clasificarBloqueo({ httpStatus: 429 });

  return (
    b.tipo === co.ESTADOS_OBSERVACION_REAL.CUOTA_AGOTADA && b.reintentable === true
  );
});

await t("ninguno de los otros tres se marca reintentable", () => {
  return [401, 402, 403].every(
    (s) => co.clasificarBloqueo({ httpStatus: s }).reintentable === false
  );
});

await t("«insufficient credits» en el cuerpo tambien es facturacion", () => {
  const b = co.clasificarBloqueo({ motivo: "HTTP 403: insufficient credits" });

  return b.tipo === co.ESTADOS_OBSERVACION_REAL.BILLING_BLOQUEADO;
});

await t("un 500 no se clasifica como bloqueo de acceso", () => {
  return co.clasificarBloqueo({ httpStatus: 500 }) === null;
});


/*
===========================================================
2 · LA OBSERVACION SE DETIENE Y NO REINTENTA
===========================================================
*/
bloque("un bloqueo detiene la secuencia");

await t("402 en la primera llamada: UNA sola peticion, sin reintentos", async () => {
  const api = apiFalsa({ usuario: { status: 402, cuerpo: "" } });

  const r = await co.observarX({
    candidateId: "cand-x",
    cuenta: CUENTA,
    fetchImpl: api
  });

  return (
    api.contador.total === 1 &&
    r.estado === co.ESTADOS_OBSERVACION_REAL.BILLING_BLOQUEADO
  );
});

await t("y no se pide el timeline despues de un bloqueo", async () => {
  const api = apiFalsa({ usuario: { status: 402 }, timeline: POSTS });

  await co.observarX({ candidateId: "cand-x", cuenta: CUENTA, fetchImpl: api });

  return !api.contador.porEndpoint.includes("timeline");
});

await t("401 tambien detiene en la primera", async () => {
  const api = apiFalsa({ usuario: { status: 401 } });

  const r = await co.observarX({
    candidateId: "cand-x",
    cuenta: CUENTA,
    fetchImpl: api
  });

  return (
    api.contador.total === 1 &&
    r.estado === co.ESTADOS_OBSERVACION_REAL.CREDENCIAL_RECHAZADA
  );
});

await t("un bloqueo en el timeline conserva las metricas de cuenta ya leidas", async () => {
  const api = apiFalsa({ usuario: USUARIO, timeline: { status: 429 } });

  const r = await co.observarX({
    candidateId: "cand-x",
    cuenta: CUENTA,
    fetchImpl: api
  });

  return (
    r.estado === co.ESTADOS_OBSERVACION_REAL.CUOTA_AGOTADA &&
    r.metricasDeCuenta.length === 2 &&
    r.canal.userId === "555"
  );
});

await t("sin credencial no se hace ni una peticion", async () => {
  delete process.env.X_BEARER_TOKEN;

  const api = apiFalsa({ usuario: USUARIO });

  const r = await co.observarX({
    candidateId: "cand-x",
    cuenta: CUENTA,
    fetchImpl: api
  });

  process.env.X_BEARER_TOKEN = "prueba";

  return (
    api.contador.total === 0 &&
    r.estado === co.ESTADOS_OBSERVACION_REAL.NO_EJECUTABLE
  );
});


/*
===========================================================
3 · OBSERVACION CORRECTA Y CONTRATO COMUN
===========================================================
*/
bloque("traduccion al contrato comun");

const API_OK = () => apiFalsa({ usuario: USUARIO, timeline: POSTS });

await t("dos llamadas: perfil y timeline", async () => {
  const api = API_OK();

  const r = await co.observarX({ candidateId: "cand-x", cuenta: CUENTA, fetchImpl: api });

  return (
    api.contador.total === 2 &&
    r.estado === co.ESTADOS_OBSERVACION_REAL.OBSERVADA &&
    r.traza.llamadas.length === 2
  );
});

await t("el perfil trae followers y following", async () => {
  const r = await co.observarX({ candidateId: "cand-x", cuenta: CUENTA, fetchImpl: API_OK() });

  const f = r.metricasDeCuenta.find((m) => m.metrica === "followers");

  return f.value === 3100 && f.availability === "DISPONIBLE";
});

await t("cada publicacion cumple el contrato comun", async () => {
  const r = await co.observarX({
    candidateId: "cand-x",
    projectId: "proy-x",
    cuenta: CUENTA,
    fetchImpl: API_OK()
  });

  const p = r.publicaciones[0];

  return (
    !!p.publicationId &&
    p.platformId === "x" &&
    p.accountId === "x:cuenta_ficticia" &&
    p.candidateId === "cand-x" &&
    !!p.canonicalUrl &&
    !!p.publishedAt &&
    !!p.firstObservedAt &&
    !!p.lastObservedAt &&
    !!p.evidenceId &&
    p.provider === "x_api"
  );
});

await t("la URL canonica se construye con handle y postId", async () => {
  const r = await co.observarX({ candidateId: "cand-x", cuenta: CUENTA, fetchImpl: API_OK() });

  return r.publicaciones[0].canonicalUrl === "https://x.com/cuenta_ficticia/status/9001";
});

await t("publishedAt de la fuente y firstObservedAt nuestro son distintos", async () => {
  const r = await co.observarX({
    candidateId: "cand-x",
    cuenta: CUENTA,
    observedAt: "2026-08-28T12:00:00.000Z",
    fetchImpl: API_OK()
  });

  const p = r.publicaciones[0];

  return (
    p.publishedAt === "2026-08-20T10:00:00.000Z" &&
    p.firstObservedAt === "2026-08-28T12:00:00.000Z"
  );
});

await t("observar NO corrobora la identidad, y se dice", async () => {
  const r = await co.observarX({ candidateId: "cand-x", cuenta: CUENTA, fetchImpl: API_OK() });

  return r.notaIdentidad.includes("NO altera la resolucion de identidad");
});

bloque("0 no es ausente");

await t("reply_count 0 es un dato disponible", async () => {
  const r = await co.observarX({ candidateId: "cand-x", cuenta: CUENTA, fetchImpl: API_OK() });

  const m = r.publicaciones[0].metricas.find((x) => x.metrica === "comments");

  return m.value === 0 && m.availability === "DISPONIBLE";
});

await t("impression_count ausente es NO_DISPONIBLE con motivo, no 0", async () => {
  const r = await co.observarX({ candidateId: "cand-x", cuenta: CUENTA, fetchImpl: API_OK() });

  const sin = r.publicaciones.find((p) => p.canonicalUrl.includes("9002"));

  const m = sin.metricas.find((x) => x.metrica === "views");

  return m.value === null && m.availability === "NO_DISPONIBLE" && !!m.motivo;
});

await t("repost y cita llegan como metricas separadas", async () => {
  const r = await co.observarX({ candidateId: "cand-x", cuenta: CUENTA, fetchImpl: API_OK() });

  const m = r.publicaciones[0].metricas;

  return (
    m.find((x) => x.metrica === "reposts").value === 12 &&
    m.find((x) => x.metrica === "quotes").value === 2
  );
});

bloque("snapshot e historico");

await t("una sola observacion no produce tendencia", async () => {
  const r = await co.observarX({ candidateId: "cand-x", cuenta: CUENTA, fetchImpl: API_OK() });

  const s = po.serieDeMetrica(r.publicaciones[0], "likes");

  return s.comparable === false && s.velocidad === null;
});

await t("una segunda observacion acumula sin sustituir", async () => {
  const uno = await co.observarX({
    candidateId: "cand-x",
    cuenta: CUENTA,
    observedAt: "2026-08-28T10:00:00.000Z",
    fetchImpl: API_OK()
  });

  const dos = await co.observarX({
    candidateId: "cand-x",
    cuenta: CUENTA,
    observedAt: "2026-08-29T10:00:00.000Z",
    fetchImpl: apiFalsa({
      usuario: USUARIO,
      timeline: {
        data: [
          { ...POSTS.data[0], public_metrics: { ...POSTS.data[0].public_metrics, like_count: 130 } },
          POSTS.data[1]
        ]
      }
    })
  });

  const a = uno.publicaciones.find((p) => p.canonicalUrl.includes("9001"));

  const b = dos.publicaciones.find((p) => p.canonicalUrl.includes("9001"));

  const f = po.fusionarPublicacion(a, b);

  const s = po.serieDeMetrica(f, "likes");

  return (
    f.firstObservedAt === "2026-08-28T10:00:00.000Z" &&
    s.comparable === true &&
    s.delta === 42
  );
});


/*
===========================================================
4 · MATRIZ: LO MEDIDO Y LO NO PROBADO
===========================================================
*/
bloque("la matriz no confunde medir con inferir");

await t("la medicion real de X registra las dos llamadas y su codigo", () => {
  const x = scm.matrizDeCapacidades().plataformas.find((p) => p.plataformaId === "x");

  return (
    x.medicionReal.requests === 2 &&
    x.medicionReal.reintentos === 0 &&
    x.medicionReal.endpoints.every((e) => e.httpStatus === 200) &&
    x.medicionReal.conclusion === "OPERATIVO"
  );
});

/*
  El 402 anterior NO se borra. Es la unica prueba de que un
  Payment Required significaba saldo y no credencial, y esa
  leccion vale mas que el estado actual.
*/
await t("el bloqueo anterior por saldo se conserva en el historial", () => {
  const x = scm.matrizDeCapacidades().plataformas.find((p) => p.plataformaId === "x");

  const previo = x.medicionReal.historial.find((h) => h.httpStatus === 402);

  return !!previo && previo.conclusion === "X_API_CREDENTIAL_OK_BUT_BILLING_BLOCKED";
});

await t("lo que se ejecuto queda MEDIDO_TERCERO", () => {
  /*
    Renombrado en META-IG-REAL-01: `MEDIDO` a secas se dividio en
    MEDIDO_TERCERO y MEDIDO_PROPIO. Lo de X se midio sobre
    cuentas de candidatos, asi que es del primero — y es el unico
    que habilita el benchmark.
  */
  return [
    "identidad",
    "cuenta",
    "followers",
    "publicaciones",
    "views",
    "likes",
    "comments",
    "shares"
  ].every((k) => scm.celdaDe(scm.capacidad("x", k)) === "MEDIDO_TERCERO");
});

await t("y lo que NO se ejecuto sigue en NO_PROBADO", () => {
  return ["menciones", "busqueda"].every(
    (k) => scm.celdaDe(scm.capacidad("x", k)) === "NO_PROBADO"
  );
});

/*
  Las dos que estaban en duda antes de pagar. Llegaron las dos, y
  eso se registra explicitamente: era la incognita del gate.
*/
await t("impression_count y bookmark_count quedaron confirmadas", () => {
  const x = scm.matrizDeCapacidades().plataformas.find((p) => p.plataformaId === "x");

  return (
    x.medicionReal.metricasConfirmadas.includes("impression_count") &&
    x.medicionReal.metricasConfirmadas.includes("bookmark_count")
  );
});

/*
  El hallazgo con mas consecuencias del gate: en un retweet las
  reacciones son del post original, asi que valen 0. Promediarlos
  con publicaciones propias hunde cualquier media.
*/
await t("el aviso sobre retweets queda registrado con la medicion", () => {
  const x = scm.matrizDeCapacidades().plataformas.find((p) => p.plataformaId === "x");

  return (
    /retweet/i.test(x.medicionReal.avisoRetweets) &&
    /esRepost/.test(x.medicionReal.avisoRetweets)
  );
});

await t("`listed_count` se declara no capturado por NOSOTROS, no ausente en X", () => {
  const x = scm.matrizDeCapacidades().plataformas.find((p) => p.plataformaId === "x");

  return x.medicionReal.noCapturadoPorNuestroNormalizador.some((n) =>
    n.includes("listed_count")
  );
});

await t("NO_PROBADO nunca se etiqueta como medido", () => {
  return scm.PLATAFORMAS.every((p) =>
    Object.values(p.capacidades).every((c) =>
      scm.celdaDe(c) === "NO_PROBADO"
        ? c.verificacion !== "MEDIDO_EN_PRODUCCION"
        : true
    )
  );
});

await t("el archivo completo sigue fuera aunque haya saldo", () => {
  /* `search/all` es cuestion de nivel, no de credito. */
  return scm.celdaDe(scm.capacidad("x", "historico")) === "REQUIERE_PLAN_PAGO";
});

await t("el archivo completo sigue siendo cuestion de plan, no de saldo", () => {
  return scm.celdaDe(scm.capacidad("x", "historico")) === "REQUIERE_PLAN_PAGO";
});

await t("YouTube conserva sus nueve capacidades medidas", () => {
  const y = scm.matrizDeCapacidades().plataformas.find((p) => p.plataformaId === "youtube");

  return y.medidas === 9;
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

process.exit(fail > 0 ? 1 : 0);
