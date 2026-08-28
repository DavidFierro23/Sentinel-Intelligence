// apps/backend/tests/instagramReal.test.mjs

/*
===========================================================
PRUEBAS DE META-IG-REAL-01
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/instagramReal.test.mjs

SIN RED. El `fetch` se inyecta y cada caso declara que responde
la API, incluidos los errores de Meta.

LO QUE DEFIENDEN
-----------------------------------------------------------

1 · EL TOKEN NO APARECE EN NINGUN SITIO.
    Ni en una URL, ni en un mensaje de error, ni cuando Meta lo
    devuelve dentro del cuerpo.

2 · MEDIR LA CUENTA PROPIA NO ES MEDIR A UN CANDIDATO.
    `MEDIDO_PROPIO` y `MEDIDO_TERCERO` son estados distintos, y
    solo el segundo habilita el benchmark.

3 · PUBLIC_METRIC NO ES OWNER_INSIGHT.
    `like_count` lo ve cualquiera; `reach` solo existe porque
    administramos la cuenta.

4 · UN 400 CON CODIGO 190 NO SIEMPRE ES «TOKEN INVALIDO».
    Medido: el mismo token que acababa de funcionar fallo en el
    otro host. El sintoma dice credencial; la causa es flujo.

5 · null != 0.
===========================================================
*/

process.env.SENTINEL_LAKE_ADAPTER = "memoria";

/* Credencial ficticia con forma reconocible, para el test de fugas. */
process.env.INSTAGRAM_ACCESS_TOKEN = "IGQ-TOKEN-FICTICIO-NO-REAL-000";

const ig = await import("../services/ingest/adapters/instagramAdapter.js");

const scm = await import("../services/intelligence/socialCapabilityMatrix.js");

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


const TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;

const PERFIL = {
  user_id: "17841400000000000",
  id: "17841400000000000",
  username: "cuenta_ficticia",
  name: "Cuenta Ficticia",
  account_type: "BUSINESS",
  media_count: 120,
  followers_count: 4500,
  follows_count: 88,
  profile_picture_url: "https://ejemplo.test/p.jpg"
};

const MEDIA = {
  data: [
    {
      id: "111",
      caption: "Publicacion ficticia",
      media_type: "IMAGE",
      media_product_type: "FEED",
      permalink: "https://www.instagram.com/p/AAA111/",
      timestamp: "2026-08-28T10:00:00+0000",
      like_count: 12,
      comments_count: 0
    },
    {
      id: "222",
      caption: "Reel ficticio",
      media_type: "VIDEO",
      media_product_type: "REELS",
      permalink: "https://www.instagram.com/reel/BBB222/",
      timestamp: "2026-08-27T10:00:00+0000",
      like_count: 40
    }
  ]
};

const INSIGHTS = {
  data: [
    { name: "reach", title: "Alcance", values: [{ value: 300 }] },
    { name: "saved", title: "Guardados", values: [{ value: 0 }] },
    { name: "views", title: "Visualizaciones", values: [{ value: 1200 }] }
  ]
};


/* Enruta por ruta y registra las URLs que se llamaron. */
function apiFalsa(respuestas = {}) {
  const urls = [];

  const fn = async (url) => {
    const u = String(url);

    urls.push(u);

    const cual = u.includes("/insights")
      ? "insights"
      : u.includes("/me/media")
        ? "media"
        : u.includes("/me")
          ? "perfil"
          : u.includes("graph.facebook.com")
            ? "discovery"
            : "otro";

    const r = respuestas[cual];

    if (!r) {
      return { ok: false, status: 404, text: async () => '{"error":{"message":"no"}}' };
    }

    if (r.status && r.status >= 400) {
      return { ok: false, status: r.status, text: async () => r.cuerpo || "{}" };
    }

    return { ok: true, status: 200, text: async () => JSON.stringify(r) };
  };

  fn.urls = urls;

  return fn;
}


/*
===========================================================
1 · EL TOKEN NO SE FILTRA
===========================================================
*/
bloque("el token no aparece en ningun sitio");

await t("sanitizar borra el token de cualquier texto", () => {
  const sucio = `algo access_token=${TOKEN}&x=1 y tambien ${TOKEN} suelto`;

  const limpio = ig.sanitizar(sucio);

  return !limpio.includes(TOKEN) && limpio.includes("REDACTADO");
});

await t("el endpoint que se registra NO lleva el token", async () => {
  const api = apiFalsa({ perfil: PERFIL });

  const r = await ig.resolverCuentaPropia({ fetch: api });

  return !String(r.endpoint).includes(TOKEN) && !r.endpoint.includes("access_token");
});

await t("un error de Meta que devuelve la peticion entera se sanea", async () => {
  const api = apiFalsa({
    perfil: {
      status: 400,
      cuerpo: JSON.stringify({
        error: { message: `Bad request on ?access_token=${TOKEN}`, code: 100 }
      })
    }
  });

  const r = await ig.resolverCuentaPropia({ fetch: api });

  return !String(r.motivo).includes(TOKEN);
});

await t("ninguna parte del objeto devuelto contiene el token", async () => {
  const api = apiFalsa({ perfil: PERFIL, media: MEDIA });

  const r1 = await ig.resolverCuentaPropia({ fetch: api });

  const r2 = await ig.listarPublicacionesPropias({ fetch: api });

  return !JSON.stringify([r1, r2]).includes(TOKEN);
});

await t("sin credencial no se hace ni una peticion", async () => {
  delete process.env.INSTAGRAM_ACCESS_TOKEN;

  const api = apiFalsa({ perfil: PERFIL });

  const r = await ig.resolverCuentaPropia({ fetch: api });

  process.env.INSTAGRAM_ACCESS_TOKEN = TOKEN;

  return api.urls.length === 0 && r.estado === "SIN_CREDENCIAL" && r.llamadas === 0;
});


/*
===========================================================
2 · PERFIL Y PUBLICACIONES
===========================================================
*/
bloque("cuenta propia");

await t("el perfil se normaliza con sus cifras publicas", async () => {
  const r = await ig.resolverCuentaPropia({ fetch: apiFalsa({ perfil: PERFIL }) });

  return (
    r.estado === "OK" &&
    r.perfil.userId === "17841400000000000" &&
    r.perfil.handle === "cuenta_ficticia" &&
    r.perfil.accountType === "BUSINESS" &&
    r.perfil.estadisticasPublicas.followers.value === 4500
  );
});

await t("followers y following son PUBLIC_METRIC, no owner insight", async () => {
  const r = await ig.resolverCuentaPropia({ fetch: apiFalsa({ perfil: PERFIL }) });

  const e = r.perfil.estadisticasPublicas;

  return (
    e.followers.alcance === ig.ALCANCE.PUBLIC_METRIC &&
    e.following.alcance === ig.ALCANCE.PUBLIC_METRIC
  );
});

await t("se declaran los campos realmente devueltos", async () => {
  const r = await ig.resolverCuentaPropia({ fetch: apiFalsa({ perfil: PERFIL }) });

  return (
    r.perfil.camposDevueltos.includes("account_type") &&
    Array.isArray(r.camposSolicitados)
  );
});

await t("un REEL se distingue de una imagen", async () => {
  const r = await ig.listarPublicacionesPropias({ fetch: apiFalsa({ media: MEDIA }) });

  return (
    r.publicaciones[0].tipo === "IMAGE" && r.publicaciones[1].tipo === "REEL"
  );
});

await t("cada publicacion trae permalink y timestamp", async () => {
  const r = await ig.listarPublicacionesPropias({ fetch: apiFalsa({ media: MEDIA }) });

  return r.publicaciones.every((p) => !!p.canonicalUrl && !!p.publishedAt);
});

await t("likes y comments son PUBLIC_METRIC", async () => {
  const r = await ig.listarPublicacionesPropias({ fetch: apiFalsa({ media: MEDIA }) });

  const m = r.publicaciones[0].metricas;

  return (
    m.likes.alcance === ig.ALCANCE.PUBLIC_METRIC &&
    m.comments.alcance === ig.ALCANCE.PUBLIC_METRIC
  );
});

await t("comments_count 0 es un dato disponible", async () => {
  const r = await ig.listarPublicacionesPropias({ fetch: apiFalsa({ media: MEDIA }) });

  const m = r.publicaciones[0].metricas.comments;

  return m.value === 0 && m.availability === "DISPONIBLE";
});

await t("un comments_count ausente NO es 0", async () => {
  const r = await ig.listarPublicacionesPropias({ fetch: apiFalsa({ media: MEDIA }) });

  const m = r.publicaciones[1].metricas.comments;

  return m.value === null && m.availability === "NO_INCLUIDA_POR_LA_API";
});

await t("no se descarga ninguna imagen ni video", async () => {
  const api = apiFalsa({ media: MEDIA });

  await ig.listarPublicacionesPropias({ fetch: api });

  /* Solo se llamo al endpoint de la API, nunca a un CDN. */
  return api.urls.every((u) => u.includes("graph.instagram.com"));
});


/*
===========================================================
3 · OWNER INSIGHTS
===========================================================
*/
bloque("owner insight no es metrica publica");

await t("todo lo que sale de /insights se marca OWNER_INSIGHT", async () => {
  const r = await ig.insightsDePublicacion("111", {
    fetch: apiFalsa({ insights: INSIGHTS })
  });

  return (
    r.estado === "OK" &&
    Object.values(r.metricas).every((m) => m.alcance === ig.ALCANCE.OWNER_INSIGHT)
  );
});

await t("un insight con valor 0 es un dato, no una ausencia", async () => {
  const r = await ig.insightsDePublicacion("111", {
    fetch: apiFalsa({ insights: INSIGHTS })
  });

  return r.metricas.saved.value === 0 && r.metricas.saved.availability === "DISPONIBLE";
});

await t("las metricas pedidas que no vuelven se declaran", async () => {
  const r = await ig.insightsDePublicacion("111", {
    fetch: apiFalsa({ insights: INSIGHTS })
  });

  return (
    r.noDevueltas.includes("shares") && r.noDevueltas.includes("total_interactions")
  );
});

await t("nunca se mezcla un owner insight con una metrica publica", async () => {
  const media = await ig.listarPublicacionesPropias({ fetch: apiFalsa({ media: MEDIA }) });

  const ins = await ig.insightsDePublicacion("111", {
    fetch: apiFalsa({ insights: INSIGHTS })
  });

  const publicas = Object.keys(media.publicaciones[0].metricas);

  const propias = Object.keys(ins.metricas);

  /* Ningun nombre aparece en los dos lados. */
  return !publicas.some((k) => propias.includes(k));
});


/*
===========================================================
4 · TERCERO BLOQUEADO
===========================================================
*/
bloque("el tercero y el diagnostico correcto");

const ERROR_190 = {
  status: 400,
  cuerpo: JSON.stringify({
    error: {
      message: "Invalid OAuth access token - Cannot parse access token",
      type: "OAuthException",
      code: 190
    }
  })
};

await t("un 190 «cannot parse» NO se llama credencial invalida", async () => {
  const r = await ig.descubrirCuentaProfesional("17841400000000000", "objetivo", {
    fetch: apiFalsa({ discovery: ERROR_190 })
  });

  return r.estado === "NO_SOPORTADO_POR_ESTA_CONFIGURACION";
});

await t("y el diagnostico dice que el token NO es el problema", async () => {
  const r = await ig.descubrirCuentaProfesional("17841400000000000", "objetivo", {
    fetch: apiFalsa({ discovery: ERROR_190 })
  });

  return (
    r.diagnostico.noEs.includes("NO es que la credencial sea invalida") &&
    r.diagnostico.accion.includes("No regenerar el token")
  );
});

await t("enumera el requisito exacto que falta", async () => {
  const r = await ig.descubrirCuentaProfesional("17841400000000000", "objetivo", {
    fetch: apiFalsa({ discovery: ERROR_190 })
  });

  const req = r.diagnostico.requisitoFaltante.join(" ").toLowerCase();

  return (
    req.includes("facebook login") &&
    req.includes("app review") &&
    req.includes("business verification")
  );
});

await t("un tercero bloqueado NO produce ningun dato", async () => {
  const r = await ig.descubrirCuentaProfesional("17841400000000000", "objetivo", {
    fetch: apiFalsa({ discovery: ERROR_190 })
  });

  return r.cuenta === null;
});

await t("un 401 real si se clasifica como credencial rechazada", async () => {
  const r = await ig.descubrirCuentaProfesional("1", "objetivo", {
    fetch: apiFalsa({
      discovery: { status: 401, cuerpo: '{"error":{"message":"Session expired","code":190}}' }
    })
  });

  return r.estado === "CREDENCIAL_RECHAZADA" && !r.diagnostico;
});

await t("un 429 se clasifica como limite de peticiones", async () => {
  const r = await ig.resolverCuentaPropia({
    fetch: apiFalsa({ perfil: { status: 429, cuerpo: '{"error":{"message":"rate limit"}}' } })
  });

  return r.estado === "LIMITE_DE_PETICIONES";
});

await t("un 403 se clasifica y no produce datos", async () => {
  const r = await ig.resolverCuentaPropia({
    fetch: apiFalsa({ perfil: { status: 403, cuerpo: '{"error":{"message":"forbidden"}}' } })
  });

  return r.perfil === null && ["PROHIBIDO", "PERMISO_INSUFICIENTE"].includes(r.estado);
});

await t("una respuesta sin business_discovery no se lee como cuenta inexistente", async () => {
  const r = await ig.descubrirCuentaProfesional("1", "objetivo", {
    fetch: apiFalsa({ discovery: { id: "1" } })
  });

  return (
    r.estado === "SIN_DATOS" &&
    r.motivo.includes("NO significa que la cuenta no exista")
  );
});


/*
===========================================================
5 · LA MATRIZ NO ASCIENDE INSTAGRAM
===========================================================
*/
bloque("medir la cuenta propia no habilita el benchmark");

await t("Instagram queda MEDIDO_PROPIO, nunca MEDIDO_TERCERO", () => {
  const i = scm.PLATAFORMAS.find((p) => p.plataformaId === "instagram");

  const celdas = Object.values(i.capacidades).map((c) => scm.celdaDe(c));

  return (
    celdas.includes("MEDIDO_PROPIO") && !celdas.includes("MEDIDO_TERCERO")
  );
});

await t("YouTube y X si tienen MEDIDO_TERCERO", () => {
  return ["youtube", "x"].every((id) => {
    const p = scm.PLATAFORMAS.find((x) => x.plataformaId === id);

    return Object.values(p.capacidades).some(
      (c) => scm.celdaDe(c) === "MEDIDO_TERCERO"
    );
  });
});

await t("la medicion registra las cuatro llamadas y el codigo 190", () => {
  const i = scm.matrizDeCapacidades().plataformas.find(
    (p) => p.plataformaId === "instagram"
  );

  return (
    i.medicionReal.requests === 4 &&
    i.medicionReal.etapaA.resultado === "APROBADO" &&
    i.medicionReal.etapaB.resultado === "BLOQUEADO" &&
    i.medicionReal.etapaB.codigoMeta === 190
  );
});

await t("y advierte que la cuenta propia no habilita el benchmark", () => {
  const i = scm.matrizDeCapacidades().plataformas.find(
    (p) => p.plataformaId === "instagram"
  );

  return i.medicionReal.advertencia.includes("no habilita el benchmark");
});

await t("los REELS quedan declarados como no probados", () => {
  const i = scm.matrizDeCapacidades().plataformas.find(
    (p) => p.plataformaId === "instagram"
  );

  return i.medicionReal.noSeProbo.some((x) => x.includes("REELS"));
});

await t("la ruta concreta separa lo hecho de lo pendiente", () => {
  const i = scm.matrizDeCapacidades().plataformas.find(
    (p) => p.plataformaId === "instagram"
  );

  return (
    i.rutaConcreta.some((x) => x.startsWith("HECHO")) &&
    i.rutaConcreta.some((x) => x.startsWith("PENDIENTE"))
  );
});


/*
===========================================================
6 · META-PUBLIC-ACCESS-01: DOCUMENTAR NO ES MEDIR
===========================================================
*/
bloque("la documentacion no habilita el benchmark");

await t("la regla es una funcion, no una convencion", () => {
  return typeof scm.habilitaBenchmark === "function";
});

await t("YouTube y X habilitan; Instagram, Facebook y TikTok no", () => {
  return (
    scm.habilitaBenchmark("youtube").habilita === true &&
    scm.habilitaBenchmark("x").habilita === true &&
    scm.habilitaBenchmark("instagram").habilita === false &&
    scm.habilitaBenchmark("facebook").habilita === false &&
    scm.habilitaBenchmark("tiktok").habilita === false
  );
});

await t("y explica que medir la cuenta propia no cuenta", () => {
  const b = scm.habilitaBenchmark("instagram");

  return (
    b.medidasSobreCuentaPropia === 8 &&
    b.motivo.includes("Ningun candidato nos va a dar un token")
  );
});

/*
  El riesgo concreto de este gate: documentar la via oficial de
  Meta y que eso, por si solo, ascienda la plataforma.
*/
await t("documentar la via de terceros NO asciende Instagram", () => {
  const i = scm.PLATAFORMAS.find((p) => p.plataformaId === "instagram");

  return (
    i.viaOficialTerceros.existe === true &&
    scm.habilitaBenchmark("instagram").habilita === false
  );
});

await t("la via oficial declara la cadena completa de requisitos", () => {
  const v = scm.PLATAFORMAS.find((p) => p.plataformaId === "instagram")
    .viaOficialTerceros;

  return (
    v.tokenRequerido === "Facebook User access token" &&
    v.accesoRequerido === "Advanced Access" &&
    v.appReview === true &&
    v.businessVerification === true &&
    v.paginaVinculada === true
  );
});

await t("y que una cuenta personal NO es alcanzable por ninguna via", () => {
  const ig = scm.PLATAFORMAS.find((p) => p.plataformaId === "instagram");

  const fb = scm.PLATAFORMAS.find((p) => p.plataformaId === "facebook");

  return (
    ig.viaOficialTerceros.cuentaPersonal.alcanzable === false &&
    fb.viaOficialTerceros.perfilPersonal.alcanzable === false
  );
});

await t("los insights de terceros se declaran NO obtenibles", () => {
  const v = scm.PLATAFORMAS.find((p) => p.plataformaId === "instagram")
    .viaOficialTerceros;

  return v.noDevuelveDeTerceros.some((x) => /reach|impressions|saved/.test(x));
});

await t("Page Public Content Access se declara vigente, no deprecado", () => {
  const v = scm.PLATAFORMAS.find((p) => p.plataformaId === "facebook")
    .viaOficialTerceros;

  return v.feature === "Page Public Content Access" && v.estado.includes("vigente");
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
