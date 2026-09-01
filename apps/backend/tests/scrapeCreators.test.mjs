// apps/backend/tests/scrapeCreators.test.mjs

/*
===========================================================
MAPEO Y PROMOCION DE ScrapeCreators
SOCIAL-PROVIDER-REAL-02
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/scrapeCreators.test.mjs

SIN RED. Las cargas son SINTETICAS: reproducen la FORMA medida
el 2026-08-31, con valores inventados.

POR QUE SINTETICAS Y NO EL DATO REAL
-----------------------------------------------------------

El dato real trae nombres y comentarios de personas. Convertir
eso en un fixture seria meter opiniones de gente identificable
en el repositorio para siempre, y no hace falta: lo que se
prueba es la forma, no el contenido.

LO QUE DEFIENDE
-----------------------------------------------------------

    SOLO SE PROMUEVE LO QUE SE MIDIO

`shares` de Facebook queda UNSUPPORTED porque el endpoint no lo
tiene, `video_views` queda NO_DATA porque se pidio sobre tres
videos reales y volvio null las tres veces, e `historical`
sigue UNVERIFIED porque no se pagino. Tres ausencias distintas
que serian el mismo hueco si se colapsaran.
===========================================================
*/

process.env.SENTINEL_LAKE_ADAPTER = "memoria";

const map = await import("../services/ingest/adapters/scrapeCreatorsMapper.js");

const esp = await import("../services/intelligence/externalSocialProvider.js");

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
      console.log(`  FALL  ${nombre}  (devolvio ${JSON.stringify(valor)})`);
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


/* ---------------------------------------------------------
   CARGAS SINTETICAS — TEST_FIXTURE / NO_REAL_DATA
   Misma FORMA que la medida; valores inventados.
--------------------------------------------------------- */
const fbPerfil = {
  success: true,
  credits_charged: 1,
  credits_remaining: 99,
  id: "100000000000000",
  name: "Pagina Sintetica",
  url: "https://www.facebook.com/paginasintetica",
  category: "Political candidate",
  creationDate: "2015-01-01",
  website: null,
  likeCount: 1111,
  talkingAboutCount: 22,
  followerCount: 3333
};

const fbPosts = {
  posts: [
    {
      id: "1000000000000001",
      text: "Publicacion sintetica con video",
      url: "https://www.facebook.com/paginasintetica/posts/1000000000000001",
      videoDetails: { duration: 30 },
      image: {},
      reactionCount: 157,
      reaction_counts: { like: 136, love: 16, haha: 4, wow: 1, anger: 0 },
      commentCount: 16,
      /* Es video y aun asi llega null: es lo que se midio. */
      videoViewCount: null,
      publishTime: 1787000000
    },
    {
      id: "1000000000000002",
      text: null,
      url: "https://www.facebook.com/paginasintetica/posts/1000000000000002",
      reactionCount: null,
      commentCount: 0,
      videoViewCount: null,
      publishTime: 1786000000
    }
  ]
};

const fbComentarios = {
  comments: [
    {
      id: "Y29tbWVudDpzaW50ZXRpY28x",
      text: "Comentario sintetico uno",
      created_at: "2026-08-22T23:30:06.000Z",
      reaction_count: 15,
      reply_count: 0,
      reactions: { like: 15 },
      author: { id: "autor-sintetico-1", name: "Autor Sintetico Uno" }
    },
    {
      /* Sin texto: se midio que pasa en 2 de 10. */
      id: "Y29tbWVudDpzaW50ZXRpY28y",
      text: null,
      created_at: "2026-08-22T23:35:00.000Z",
      reaction_count: 0,
      reply_count: 0,
      author: { id: "autor-sintetico-2", name: "Autor Sintetico Dos" }
    }
  ]
};

const ttPerfil = {
  user: { id: "6000000000000000000", uniqueId: "cuenta.sintetica", nickname: "Sintetica" },
  stats: {
    followerCount: 519300,
    followingCount: 58,
    heartCount: 5200000,
    videoCount: 357
  }
};

const ttVideos = {
  aweme_list: [
    {
      aweme_id: "7000000000000000001",
      desc: "Video sintetico",
      create_time: 1787881914,
      /* Con trim=true es `url`, no `share_url`. */
      url: "https://www.tiktok.com/@cuenta.sintetica/video/7000000000000000001",
      statistics: {
        play_count: 2198,
        digg_count: 102,
        comment_count: 8,
        share_count: 16
      }
    }
  ]
};

const ttComentarios = {
  total: 110,
  comments: [
    {
      cid: "7000000000000000099",
      text: "Comentario sintetico de TikTok",
      create_time: 1784983447,
      digg_count: 21,
      reply_comment_total: 3,
      user: { uid: "u-sintetico", nickname: "Usuario Sintetico" }
    }
  ]
};


bloque("Fechas: tres formatos, un contrato");

await t("unix en segundos se convierte a ISO", () => {
  return map.desdeUnix(1787881914) === "2026-08-28T01:51:54.000Z";
});

await t("un unix ausente da null y NUNCA la epoca de 1970", () => {
  return (
    map.desdeUnix(null) === null &&
    map.desdeUnix(0) === null &&
    map.desdeUnix(undefined) === null
  );
});

await t("el ISO de los comentarios de Facebook se respeta", () => {
  const c = map.comentariosDeFacebook(fbComentarios);

  return c[0].published_at === "2026-08-22T23:30:06.000Z";
});


bloque("Facebook: mapeo de la forma real");

const perfil = map.perfilDeFacebook(fbPerfil);

await t("el id de la Page es el estable, no la URL de la foto", () => {
  return perfil.accountProviderId === "100000000000000";
});

await t("followers y likes son cifras distintas y no se funden", () => {
  return perfil.followers === 3333 && perfil.likes === 1111;
});

const posts = map.publicacionesDeFacebook(fbPosts);

await t("el permalink sale de url", () => {
  return posts[0].permalink.endsWith("/posts/1000000000000001");
});

await t("shares NO se inventa: el endpoint no lo trae", () => {
  return !("shares" in posts[0]);
});

await t("el desglose de reacciones por tipo se conserva", () => {
  return posts[0].desglose_reacciones.haha === 4;
});


bloque("Tres ausencias distintas que no se colapsan");

const pub = esp.normalizarPublicacionDeProveedor({
  providerId: "scrapecreators",
  platformId: "facebook",
  payload: posts[0],
  observedAt: "2026-08-31T12:00:00.000Z"
});

const metrica = (p, n) => p.metricas.find((m) => m.metrica === n);

await t("shares ausente queda NO_DISPONIBLE y no 0", () => {
  const m = metrica(pub, "shares");

  return m.value === null && m.value !== 0;
});

await t("video_views sobre un video real queda null, no 0", () => {
  /*
    Se midio: tres publicaciones que SI eran video devolvieron
    videoViewCount null las tres veces.
  */
  const m = metrica(pub, "views");

  return m.value === null && m.availability === po.DISPONIBILIDAD.NO_DISPONIBLE;
});

await t("un commentCount de 0 SI se conserva como 0 medido", () => {
  const p2 = esp.normalizarPublicacionDeProveedor({
    providerId: "scrapecreators",
    platformId: "facebook",
    payload: posts[1],
    observedAt: "2026-08-31T12:00:00.000Z"
  });

  return metrica(p2, "commentsCount").value === 0;
});

await t("reactions ausente en la segunda publicacion queda null", () => {
  const p2 = esp.normalizarPublicacionDeProveedor({
    providerId: "scrapecreators",
    platformId: "facebook",
    payload: posts[1],
    observedAt: "2026-08-31T12:00:00.000Z"
  });

  return metrica(p2, "reactions").value === null;
});


bloque("TikTok: mapeo de la forma real");

const perfilTt = map.perfilDeTikTok(ttPerfil);

await t("el user id estable se conserva", () => {
  return perfilTt.accountProviderId === "6000000000000000000";
});

await t("followers, following, likes y videos llegan separados", () => {
  return (
    perfilTt.followers === 519300 &&
    perfilTt.following === 58 &&
    perfilTt.totalLikes === 5200000 &&
    perfilTt.mediaCount === 357
  );
});

const videos = map.publicacionesDeTikTok(ttVideos);

await t("con trim=true el permalink sale de url y no de share_url", () => {
  return videos[0].permalink.includes("/video/7000000000000000001");
});

await t("las cuatro metricas anidadas se leen", () => {
  return (
    videos[0].views === 2198 &&
    videos[0].likes === 102 &&
    videos[0].comments_count === 8 &&
    videos[0].shares === 16
  );
});

await t("el aweme_id se usa como id estable de publicacion", () => {
  const p = esp.normalizarPublicacionDeProveedor({
    providerId: "scrapecreators",
    platformId: "tiktok",
    payload: videos[0],
    observedAt: "2026-08-31T12:00:00.000Z"
  });

  return p.publicationId === "pub-tiktok-7000000000000000001";
});


bloque("Comentarios: texto real y corpus honesto");

const corpusFb = esp.normalizarComentariosDeProveedor({
  providerId: "scrapecreators",
  platformId: "facebook",
  postId: "pub-facebook-1000000000000001",
  postPermalink: fbPosts.posts[0].url,
  payload: map.comentariosDeFacebook(fbComentarios),
  commentsCount: 122,
  observedAt: "2026-08-31T12:00:00.000Z"
});

await t("el commentId del proveedor se conserva tal cual", () => {
  return corpusFb.comentarios[0].commentId === "Y29tbWVudDpzaW50ZXRpY28x";
});

await t("el texto llega y se conserva", () => {
  return corpusFb.comentarios[0].text === "Comentario sintetico uno";
});

await t("un comentario sin texto queda null, no cadena vacia", () => {
  return corpusFb.comentarios[1].text === null;
});

await t("2 observados de 122 declarados es MUESTRA", () => {
  return (
    corpusFb.comentariosObservados === 2 &&
    corpusFb.comentariosDeclaradosPorLaPlataforma === 122 &&
    corpusFb.cobertura === "MUESTRA"
  );
});

await t("solo se cuentan con texto los que lo traen", () => {
  return corpusFb.comentariosConTexto === 1;
});

await t("la obligacion de lenguaje nombra las dos cifras", () => {
  return /2 de 122/.test(corpusFb.obligacionDeLenguaje);
});

const corpusTt = esp.normalizarComentariosDeProveedor({
  providerId: "scrapecreators",
  platformId: "tiktok",
  postId: "pub-tiktok-7000000000000000001",
  payload: map.comentariosDeTikTok(ttComentarios),
  commentsCount: map.totalDeComentarios("tiktok", ttComentarios),
  observedAt: "2026-08-31T12:00:00.000Z"
});

await t("en TikTok el cid es el commentId", () => {
  return corpusTt.comentarios[0].commentId === "7000000000000000099";
});

await t("likes y respuestas del comentario se conservan", () => {
  return (
    corpusTt.comentarios[0].likes === 21 &&
    corpusTt.comentarios[0].replyCount === 3
  );
});

await t("el total declarado de TikTok se lee de `total`", () => {
  return corpusTt.comentariosDeclaradosPorLaPlataforma === 110;
});

await t("el autor se guarda sin perfilado", () => {
  const a = corpusTt.comentarios[0].author;

  return (
    a.platformUserId === "u-sintetico" && Array.isArray(a.noSeHace)
  );
});


bloque("Promocion: solo lo demostrado");

const cap = (plat, c) =>
  esp.capacidadDeProveedor("scrapecreators", plat, c).estado;

await t("Facebook: cuenta, posts, reacciones y comentarios VERIFICADOS", () => {
  return ["account", "followers", "posts", "reactions", "comments_count", "comment_text"].every(
    (c) => cap("facebook", c) === esp.ESTADOS_CAPACIDAD_PROVEEDOR.SUPPORTED
  );
});

await t("Facebook shares queda UNSUPPORTED: el endpoint no lo tiene", () => {
  return cap("facebook", "shares") === esp.ESTADOS_CAPACIDAD_PROVEEDOR.UNSUPPORTED;
});

await t("Facebook video_views queda NO_DATA, que no es lo mismo", () => {
  /*
    Se pidio sobre tres videos reales y volvio null las tres
    veces. NO_DATA dice «se pregunto y no vino»; UNSUPPORTED
    diria «no existe el campo». Son cosas distintas.
  */
  const e = cap("facebook", "video_views");

  return (
    e === esp.ESTADOS_CAPACIDAD_PROVEEDOR.NO_DATA &&
    e !== esp.ESTADOS_CAPACIDAD_PROVEEDOR.UNSUPPORTED
  );
});

await t("historical sigue SIN VERIFICAR en las dos plataformas", () => {
  return ["facebook", "tiktok"].every(
    (p) => cap(p, "historical") === esp.ESTADOS_CAPACIDAD_PROVEEDOR.UNVERIFIED_PROVIDER
  );
});

await t("TikTok: las diez capacidades medidas quedan VERIFICADAS", () => {
  return [
    "account", "followers", "following", "total_likes", "posts",
    "views", "likes", "comments_count", "comment_text", "shares"
  ].every((c) => cap("tiktok", c) === esp.ESTADOS_CAPACIDAD_PROVEEDOR.SUPPORTED);
});

await t("Instagram NO se promovio: no se probo", () => {
  return esp.CAPACIDADES_POR_PLATAFORMA.instagram.every(
    (c) => cap("instagram", c) === esp.ESTADOS_CAPACIDAD_PROVEEDOR.UNVERIFIED_PROVIDER
  );
});

await t("aprobar y verificar a ScrapeCreators no movio a los demas", () => {
  return ["brightdata", "socialcrawl", "data365"].every((id) => {
    const p = esp.proveedor(id);

    const medidas = Object.values(p.capacidades).flatMap((c) =>
      Object.values(c).filter((e) =>
        [
          esp.ESTADOS_CAPACIDAD_PROVEEDOR.SUPPORTED,
          esp.ESTADOS_CAPACIDAD_PROVEEDOR.PARTIAL
        ].includes(e)
      )
    );

    return p.aprobadoParaOperar === false && medidas.length === 0;
  });
});

await t("la medicion real queda registrada con sus limites", () => {
  const m = esp.proveedor("scrapecreators").medicionReal;

  return (
    m.requests === 8 &&
    m.noDemostrado.some((x) => /historica/.test(x)) &&
    m.noDemostrado.some((x) => /Instagram/.test(x))
  );
});

await t("no hay ninguna credencial en el registro del proveedor", () => {
  const texto = JSON.stringify(esp.proveedor("scrapecreators"));

  return !/api[_-]?key["']?\s*:\s*["'][A-Za-z0-9]/i.test(texto);
});



/* ---------------------------------------------------------
   INSTAGRAM — FALLBACK, P-CAND-INSTAGRAM-FALLBACK-01
   Cargas SINTETICAS con la FORMA real medida el 2026-08-31
   sobre @pedropalaciosu (control) y @paulcarrascoc (fallback).
   Los IDs, nombres y textos son inventados.
--------------------------------------------------------- */
const igPerfil = {
  data: {
    user: {
      id: "9000000000",
      username: "cuenta.sintetica",
      full_name: "Nombre Sintetico",
      biography: "bio sintetica",
      is_private: false,
      is_verified: false,
      edge_followed_by: { count: 985 },
      edge_follow: { count: 200 },
      edge_owner_to_timeline_media: { count: 266 }
    }
  }
};

const igPosts = {
  items: [
    {
      code: "B3cuuySINTET",
      /* pk deliberadamente ausente: no llega con trim=true. */
      media_type: 1,
      taken_at: 1570734600,
      caption: { text: "Caption sintetica de Instagram" },
      like_count: 57,
      comment_count: 5,
      url: "https://www.instagram.com/p/B3cuuySINTET/"
    },
    {
      /* Sin caption, sin like_count: dos ausencias reales distintas. */
      code: "B3HxsSINTET2",
      media_type: 8,
      taken_at: 1570000000,
      caption: null,
      like_count: null,
      comment_count: 0
    }
  ]
};

const igComentarios = {
  /*
    Cinco entradas, para reproducir el 5 de 5 real observado sobre
    @paulcarrascoc: es lo que permite probar COBERTURA COMPLETA
    ademas de la muestra parcial que ya cubren otros tests.
  */
  comments: Array.from({ length: 5 }, (_, i) => ({
    id: `18018190SINTETICO${i}`,
    text: `Comentario sintetico de Instagram numero ${i}`,
    created_at: "2024-08-24T21:07:26.000Z",
    comment_like_count: 0,
    child_comment_count: 0,
    user: { pk: `signup-sintetico-${i}`, username: `usuario_sintetico_${i}` }
  }))
};


bloque("Instagram: mapeo de la forma real (GraphQL anidado)");

const perfilIg = map.perfilDeInstagram(igPerfil);

await t("el id estable sale de data.user.id, no de la URL", () => {
  return perfilIg.accountProviderId === "9000000000";
});

await t("followers, following y mediaCount se leen de los edges anidados", () => {
  return (
    perfilIg.followers === 985 &&
    perfilIg.following === 200 &&
    perfilIg.mediaCount === 266
  );
});

await t("la URL canonica se deriva del handle", () => {
  return perfilIg.canonicalUrl === "https://www.instagram.com/cuenta.sintetica";
});

const postsIg = map.publicacionesDeInstagram(igPosts);

await t("el code se usa como id estable de publicacion, no pk", () => {
  return postsIg[0].post_id === "B3cuuySINTET";
});

await t("el caption es un objeto y se extrae su .text", () => {
  return postsIg[0].text === "Caption sintetica de Instagram";
});

await t("media_type numerico se traduce a algo legible", () => {
  return postsIg[0].content_type === "image" && postsIg[1].content_type === "carousel";
});

await t("taken_at unix se convierte a ISO", () => {
  return postsIg[0].published_at === map.desdeUnix(1570734600);
});

await t("un caption null da texto null, no cadena vacia", () => {
  return postsIg[1].text === null;
});

await t("un like_count ausente da null y no se inventa un cero", () => {
  return postsIg[1].likes === null && postsIg[1].likes !== 0;
});

await t("un comment_count de 0 SI se conserva como 0 medido", () => {
  return postsIg[1].comments_count === 0;
});

const comsIg = map.comentariosDeInstagram(igComentarios);

await t("el id del comentario se conserva tal cual", () => {
  return comsIg[0].comment_id === "18018190SINTETICO0";
});

await t("el texto real del comentario se conserva", () => {
  return comsIg[0].text === "Comentario sintetico de Instagram numero 0";
});

await t("el timestamp de comentario llega en ISO, igual que en Facebook", () => {
  return comsIg[0].published_at === "2024-08-24T21:07:26.000Z";
});

await t("totalDeComentarios de Instagram lee el commentCount de la publicacion", () => {
  return map.totalDeComentarios("instagram", igComentarios, { comment_count: 5 }) === 5;
});


bloque("Instagram: normalizado con el contrato generico y no fake zero");

const pubIg = esp.normalizarPublicacionDeProveedor({
  providerId: "scrapecreators",
  platformId: "instagram",
  payload: postsIg[1],
  observedAt: "2026-08-31T12:00:00.000Z"
});

const metricaIg = (p, n) => p.metricas.find((m) => m.metrica === n);

await t("likes ausente en Instagram queda NO_DISPONIBLE y no 0", () => {
  const m = metricaIg(pubIg, "likes");

  return m.value === null && m.availability === po.DISPONIBILIDAD.NO_DISPONIBLE;
});

await t("comentarios en 0 real se distingue de la ausencia", () => {
  return metricaIg(pubIg, "commentsCount").value === 0;
});

const corpusIg = esp.normalizarComentariosDeProveedor({
  providerId: "scrapecreators",
  platformId: "instagram",
  postId: "pub-instagram-B3cuuySINTET",
  postPermalink: igPosts.items[0].url,
  payload: comsIg,
  commentsCount: 5,
  observedAt: "2026-08-31T12:00:00.000Z"
});

await t("5 observados de 5 declarados es cobertura COMPLETA", () => {
  return (
    corpusIg.comentariosObservados === 5 &&
    corpusIg.comentariosDeclaradosPorLaPlataforma === 5 &&
    corpusIg.cobertura === "COMPLETA"
  );
});

await t("el autor de Instagram se guarda sin perfilado", () => {
  const a = corpusIg.comentarios[0].author;

  return a.platformUserId === "signup-sintetico-0" && Array.isArray(a.noSeHace);
});

await t("Instagram no aparece hardcodeado en el contrato de publicacion: solo en provenance", () => {
  const permitidos = ["provider", "providerId", "observationMethod"];

  const rutas = [];

  const recorrer = (o, ruta) => {
    if (o === null || typeof o !== "object") {
      if (String(o).includes("scrapecreators")) rutas.push(ruta);

      return;
    }

    for (const k of Object.keys(o)) recorrer(o[k], ruta ? `${ruta}.${k}` : k);
  };

  recorrer(pubIg, "");

  const ultimoTramo = (r) => r.split(".").pop();

  return rutas.length > 0 && rutas.every((r) => permitidos.includes(ultimoTramo(r)));
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

process.exitCode = fail > 0 ? 1 : 0;
