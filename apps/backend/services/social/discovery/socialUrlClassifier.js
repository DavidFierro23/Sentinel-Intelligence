// apps/backend/services/social/discovery/socialUrlClassifier.js

import { normalizarUrl, extraerDominio, normalizarTexto } from "../../textUtils.js";

/*
===========================================================
SENTINEL INTELLIGENCE
CLASIFICADOR DE URLS SOCIALES (SD-1A)
===========================================================

Convierte una URL de plataforma en una clasificación
verificable: qué es, de quién es y con qué confianza inicial.

  https://x.com/jcvegamalo              → perfil,  handle sí
  https://x.com/medio/status/123        → post,    handle del autor
  https://www.youtube.com/@canal        → canal,   handle sí
  https://www.youtube.com/watch?v=abc   → video,   SIN handle
  https://www.tiktok.com/@u/video/9     → video,   handle del autor
  https://facebook.com/UnaPagina        → pagina,  handle sí
  https://facebook.com/profile.php?id=1 → perfil personal, excluido
  https://linkedin.com/in/alguien       → perfil,  handle sí

-----------------------------------------------------------
LA REGLA QUE GOBIERNA EL MÓDULO
-----------------------------------------------------------

NO INVENTAR CUENTAS.

  · Un vídeo de YouTube es un VÍDEO. Nunca se declara canal:
    la URL /watch?v=... no contiene a su propietario, y
    deducirlo sería inventarlo.

  · Un post de X sí contiene a su autor en la ruta
    (/handle/status/id), así que de ahí SÍ se deriva una
    cuenta — pero se declara que se derivó de contenido, no
    que se encontró el perfil.

  · Una noticia que MENCIONA Facebook no es una cuenta de
    Facebook. Este módulo solo mira la URL; el texto no
    interviene jamás.

-----------------------------------------------------------
EL BUG QUE NO DEBE VOLVER
-----------------------------------------------------------

En el Sprint 3.2.1 un respaldo derivaba el handle de la ruta
cuando la extracción fallaba, y recuperaba «watch» de
youtube.com/watch — reintroduciendo lo que el filtro acababa
de descartar.

Aquí la defensa es estructural, no un filtro añadido: cada
plataforma declara sus PATRONES DE RUTA con su tipo, y el
handle solo se toma del grupo de captura de un patrón que
declara tener propietario. No hay ninguna vía por la que un
segmento de ruta genérico pueda convertirse en handle.
===========================================================
*/


export const TIPOS_URL = Object.freeze({
  PERFIL: "perfil",
  CANAL: "canal",
  PAGINA: "pagina",
  VIDEO: "video",
  POST: "post",
  NO_CUENTA: "no_cuenta"
});


/*
-----------------------------------------------------------
PATRONES POR PLATAFORMA

Cada patrón declara:
  re            expresión sobre la RUTA normalizada
  tipo          qué es
  handle        índice del grupo de captura, o null
  esCuenta      si de aquí nace una cuenta candidata
  derivado      el handle procede de contenido, no de un
                perfil visitado
-----------------------------------------------------------
*/

const PLATAFORMAS = Object.freeze([
  {
    id: "facebook",
    nombre: "Facebook",
    dominios: ["facebook.com", "www.facebook.com", "m.facebook.com", "fb.com", "web.facebook.com"],
    patrones: [
      /* Contenido y rutas de sistema: NO son cuentas. */
      { re: /^\/(watch|video)(\/|$|\?)/, tipo: TIPOS_URL.VIDEO, handle: null, esCuenta: false },
      { re: /^\/[^/]+\/(videos|posts|photos)\//, tipo: TIPOS_URL.POST, handle: null, esCuenta: true, handleDesdeSegmento: 1, derivado: true },
      { re: /^\/(permalink\.php|story\.php|sharer)/, tipo: TIPOS_URL.POST, handle: null, esCuenta: false },
      { re: /^\/(groups|events|marketplace|gaming|login|help|policies|business)(\/|$)/, tipo: TIPOS_URL.NO_CUENTA, handle: null, esCuenta: false },

      /*
        profile.php es un PERFIL PERSONAL. Se clasifica, pero
        NO genera cuenta: el adaptador atiende paginas publicas
        y EX1 del Cap. 14 excluye el perfilado de personas sin
        base legal.
      */
      { re: /^\/profile\.php/, tipo: TIPOS_URL.PERFIL, handle: null, esCuenta: false, motivoExclusion: "perfil personal de Facebook: fuera de alcance por EX1 (Cap. 14) y por atender solo paginas publicas" },

      { re: /^\/pages\/[^/]+\/([^/?#]+)/, tipo: TIPOS_URL.PAGINA, handle: 1, esCuenta: true },

      /*
        Formato moderno de pagina: /p/Nombre-De-La-Pagina-100066123456789

        Detectado al integrar SerpAPI: Google devuelve muchas
        paginas publicas en esta forma y se descartaban por
        completo. Exige el identificador numerico final, que es
        lo que distingue una pagina real de cualquier otra ruta
        /p/ — y evita confundirla con /p/ de Instagram, que es
        una publicacion y pertenece a otra plataforma.
      */
      { re: /^\/p\/([A-Za-z0-9._\-%]+-\d{6,})\/?$/, tipo: TIPOS_URL.PAGINA, handle: 1, esCuenta: true },
      { re: /^\/([A-Za-z0-9.][A-Za-z0-9.\-_]{3,60})\/?$/, tipo: TIPOS_URL.PAGINA, handle: 1, esCuenta: true }
    ]
  },
  {
    id: "x",
    nombre: "X",
    dominios: ["x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"],
    patrones: [
      { re: /^\/(i|intent|search|hashtag|explore|home|notifications|messages|settings|login)(\/|$)/, tipo: TIPOS_URL.NO_CUENTA, handle: null, esCuenta: false },

      /*
        Un post SI lleva a su autor en la ruta: de aqui nace
        una cuenta, declarada como derivada de contenido.
      */
      { re: /^\/([A-Za-z0-9_]{2,15})\/status(?:es)?\/\d+/, tipo: TIPOS_URL.POST, handle: 1, esCuenta: true, derivado: true },

      { re: /^\/([A-Za-z0-9_]{2,15})\/?$/, tipo: TIPOS_URL.PERFIL, handle: 1, esCuenta: true }
    ]
  },
  {
    id: "youtube",
    nombre: "YouTube",
    dominios: ["youtube.com", "www.youtube.com", "m.youtube.com"],
    patrones: [
      /*
        UN VIDEO ES UN VIDEO.

        /watch?v=... no contiene a su propietario. Se clasifica
        como video, con handle null y esCuenta false. Declararlo
        canal seria inventar la cuenta.
      */
      { re: /^\/watch(\/|$|\?)/, tipo: TIPOS_URL.VIDEO, handle: null, esCuenta: false, motivoExclusion: "la URL de un video no contiene a su propietario: declararlo canal seria inventarlo" },
      { re: /^\/shorts\/[\w-]+/, tipo: TIPOS_URL.VIDEO, handle: null, esCuenta: false, motivoExclusion: "la URL de un short no contiene a su propietario" },
      { re: /^\/(results|playlist|feed|hashtag|gaming|premium|about|t)(\/|$)/, tipo: TIPOS_URL.NO_CUENTA, handle: null, esCuenta: false },

      { re: /^\/@([A-Za-z0-9._-]{3,60})/, tipo: TIPOS_URL.CANAL, handle: 1, esCuenta: true },
      { re: /^\/channel\/(UC[\w-]{20,24})/, tipo: TIPOS_URL.CANAL, handle: 1, esCuenta: true, handleOpaco: true },
      { re: /^\/(?:c|user)\/([A-Za-z0-9._-]{3,60})/, tipo: TIPOS_URL.CANAL, handle: 1, esCuenta: true }
    ]
  },
  {
    id: "youtube",
    nombre: "YouTube",
    dominios: ["youtu.be"],
    patrones: [
      { re: /^\/[\w-]{6,20}/, tipo: TIPOS_URL.VIDEO, handle: null, esCuenta: false, motivoExclusion: "enlace corto de video: no contiene a su propietario" }
    ]
  },
  {
    id: "tiktok",
    nombre: "TikTok",
    dominios: ["tiktok.com", "www.tiktok.com", "vm.tiktok.com"],
    patrones: [
      { re: /^\/(tag|discover|foryou|explore|music|search|live)(\/|$)/, tipo: TIPOS_URL.NO_CUENTA, handle: null, esCuenta: false },

      /* El video de TikTok SI lleva al autor en la ruta. */
      { re: /^\/@([A-Za-z0-9._]{2,30})\/video\/\d+/, tipo: TIPOS_URL.VIDEO, handle: 1, esCuenta: true, derivado: true },

      { re: /^\/@([A-Za-z0-9._]{2,30})\/?$/, tipo: TIPOS_URL.PERFIL, handle: 1, esCuenta: true }
    ]
  },
  {
    id: "linkedin",
    nombre: "LinkedIn",
    dominios: ["linkedin.com", "www.linkedin.com", "ec.linkedin.com", "es.linkedin.com"],
    patrones: [
      { re: /^\/(feed|jobs|learning|help|legal|login|checkpoint)(\/|$)/, tipo: TIPOS_URL.NO_CUENTA, handle: null, esCuenta: false },
      { re: /^\/(?:posts|pulse)\//, tipo: TIPOS_URL.POST, handle: null, esCuenta: false },

      { re: /^\/in\/([A-Za-z0-9\-_%]{3,100})/, tipo: TIPOS_URL.PERFIL, handle: 1, esCuenta: true },
      { re: /^\/(?:company|school|showcase)\/([A-Za-z0-9\-_%]{2,100})/, tipo: TIPOS_URL.PAGINA, handle: 1, esCuenta: true }
    ]
  },
  {
    id: "instagram",
    nombre: "Instagram",
    dominios: ["instagram.com", "www.instagram.com"],
    patrones: [
      { re: /^\/(p|reel|reels|tv|explore|stories|accounts|direct)(\/|$)/, tipo: TIPOS_URL.NO_CUENTA, handle: null, esCuenta: false },
      { re: /^\/([A-Za-z0-9._]{2,30})\/?$/, tipo: TIPOS_URL.PERFIL, handle: 1, esCuenta: true }
    ]
  }
]);


function plataformaDeDominio(dominio) {
  if (!dominio) return null;

  return (
    PLATAFORMAS.find((p) =>
      p.dominios.some((d) => dominio === d || dominio.endsWith(`.${d}`))
    ) || null
  );
}


/*
-----------------------------------------------------------
CONFIANZA INICIAL

NO es correspondencia con el objetivo: eso lo calcula el
Identity Matcher. Es la confianza en que la URL identifique
una CUENTA REAL, y depende de cómo se obtuvo el handle.
-----------------------------------------------------------
*/

const CONFIANZA_BASE = Object.freeze({
  [TIPOS_URL.PERFIL]: 70,
  [TIPOS_URL.CANAL]: 70,
  [TIPOS_URL.PAGINA]: 65,
  /* De contenido se deriva el autor: menos directo. */
  [TIPOS_URL.POST]: 45,
  [TIPOS_URL.VIDEO]: 45,
  [TIPOS_URL.NO_CUENTA]: 0
});


function calcularConfianzaInicial(tipo, patron) {
  let valor = CONFIANZA_BASE[tipo] ?? 0;

  const razones = [
    { motivo: `tipo de URL: ${tipo}`, puntos: valor }
  ];

  if (patron?.derivado) {
    valor -= 10;
    razones.push({
      motivo: "el handle se derivó de una URL de contenido, no de un perfil",
      puntos: -10
    });
  }

  if (patron?.handleOpaco) {
    valor -= 10;
    razones.push({
      motivo: "el identificador es opaco (id de canal), no un nombre elegido",
      puntos: -10
    });
  }

  return {
    valor: Math.max(0, Math.min(100, valor)),
    razones,
    significado:
      "Mide la confianza en que la URL identifique una cuenta real. NO es la correspondencia con el objetivo, que calcula el Identity Matcher."
  };
}


/*
===========================================================
CLASIFICAR UNA URL
===========================================================
*/

export function clasificarUrlSocial(urlBruta) {
  const normalizada = normalizarUrl(urlBruta);

  if (!normalizada) {
    return { esSocial: false, motivo: "URL no utilizable" };
  }

  const dominio = extraerDominio(urlBruta);

  const plataforma = plataformaDeDominio(dominio);

  if (!plataforma) {
    return { esSocial: false, dominio, motivo: "el dominio no es de una plataforma soportada" };
  }

  /*
    ---------------------------------------------------------
    LA RUTA SE ANALIZA CON SU CAPITALIZACIÓN ORIGINAL
    ---------------------------------------------------------

    `normalizarUrl` pasa todo a minúsculas, porque su función
    es producir una clave de comparación estable. Usarla aquí
    causaba dos fallos, detectados por la propia prueba:

      · «facebook.com/DanielNoboaOk» devolvía el handle
        «danielnoboaok», perdiendo la capitalización con la
        que la cuenta se muestra y se enlaza.

      · «youtube.com/channel/UCabc…» no se reconocía: el
        patrón exige el prefijo «UC» de los identificadores de
        canal, y la normalización lo había convertido en «uc».

    Así que los patrones se aplican a la ruta ORIGINAL y la
    forma normalizada se reserva para lo que es: la clave de
    deduplicación.
  */
  let rutaOriginal = "";

  let consultaOriginal = "";

  try {
    const u = new URL(
      /^https?:\/\//i.test(urlBruta) ? urlBruta : `https://${urlBruta}`
    );

    /*
      LA CADENA DE CONSULTA SE EXCLUYE DE LA RUTA

      Defecto detectado al integrar SerpAPI (Sprint 3.2.2).
      Google devuelve las URLs con parametros de idioma y
      localizacion:

        x.com/jotalloretv?lang=es
        instagram.com/danielnoboaok/?hl=es-la
        facebook.com/DanielNoboaOk/?locale=es_LA

      Todos los patrones de CUENTA estan anclados al final con
      `\/?$` — es lo que impide que un segmento cualquiera se
      convierta en handle. Al incluir `?lang=es` en la ruta,
      ninguno coincidia: las tres cuentas reales anteriores se
      clasificaban como `no_cuenta`.

      Medido: con la consulta incluida, SerpAPI no entregaba una
      sola cuenta pese a devolverlas todas.

      Excluirla es seguro. El unico patron que menciona la
      consulta es `/profile.php`, y coincide por la ruta sin
      necesidad del `?id=`. Los patrones de video (`/watch`)
      siguen coincidiendo por el ancla de fin de cadena, asi
      que un video no puede convertirse en canal.

      La consulta se conserva aparte para el mensaje de
      descarte: al analista le sirve ver la URL como venia.
    */
    rutaOriginal = u.pathname;

    consultaOriginal = u.search || "";
  } catch {
    rutaOriginal = "";
  }

  const ruta = rutaOriginal || (() => {
    const sinDominio = normalizada.slice(dominio.length);

    const bruta = sinDominio.startsWith("/") ? sinDominio : `/${sinDominio}`;

    /* Mismo criterio en el camino de respaldo. */
    return bruta.split("?")[0].split("#")[0];
  })();

  for (const patron of plataforma.patrones) {
    const m = ruta.match(patron.re);

    if (!m) continue;

    let handle = null;

    if (patron.handle) {
      handle = m[patron.handle] || null;
    } else if (patron.handleDesdeSegmento) {
      const segmentos = ruta.split("?")[0].split("/").filter(Boolean);
      handle = segmentos[patron.handleDesdeSegmento - 1] || null;
    }

    if (handle) {
      handle = decodeURIComponent(handle).replace(/\/+$/, "");
    }

    /*
      Coherencia estructural: si el patrón declara que aquí
      nace una cuenta, TIENE que haber handle. Si no lo hay,
      no se inventa: se degrada a no-cuenta.
    */
    const esCuenta = Boolean(patron.esCuenta && handle);

    return {
      esSocial: true,

      plataformaId: plataforma.id,
      plataforma: plataforma.nombre,
      dominio,

      tipo: patron.tipo,
      handle: handle || null,
      handleDerivadoDeContenido: Boolean(patron.derivado && handle),
      handleOpaco: Boolean(patron.handleOpaco),

      esCuenta,

      urlCanonica: `https://${normalizada}`,
      urlNormalizada: normalizada,
      urlOriginal: urlBruta,

      confianzaInicial: calcularConfianzaInicial(patron.tipo, patron),

      motivo: esCuenta
        ? `${patron.tipo} con propietario identificable en la URL`
        : patron.motivoExclusion ||
          `${patron.tipo}: la URL no identifica una cuenta`,

      patronAplicado: String(patron.re)
    };
  }

  /*
    Dominio de plataforma pero ninguna ruta reconocida. No se
    fabrica un handle: se declara.
  */
  return {
    esSocial: true,
    plataformaId: plataforma.id,
    plataforma: plataforma.nombre,
    dominio,
    tipo: TIPOS_URL.NO_CUENTA,
    handle: null,
    esCuenta: false,
    urlNormalizada: normalizada,
    urlOriginal: urlBruta,
    confianzaInicial: calcularConfianzaInicial(TIPOS_URL.NO_CUENTA, null),
    motivo: `ruta "${(ruta + consultaOriginal).slice(0, 60)}" no reconocida como cuenta en ${plataforma.nombre}`
  };
}


/*
===========================================================
RECORRER EVIDENCIAS

Entrada: las evidencias del Fusion Engine (o cualquier lista
con enlace/url).

Salida: fichas candidatas nacidas SOLO de esas evidencias,
más el registro de lo que se examinó y descartó.
===========================================================
*/

export function descubrirDesdeEvidencias(evidencias = [], opciones = {}) {
  const lista = Array.isArray(evidencias) ? evidencias : [];

  const candidatas = new Map();

  const clasificadas = [];

  const descartadas = [];

  let urlsExaminadas = 0;

  let urlsDePlataforma = 0;

  lista.forEach((ev, indice) => {
    const url =
      ev?.url || ev?.enlace || ev?.urlNormalizada || ev?.link || null;

    if (!url) return;

    urlsExaminadas += 1;

    const c = clasificarUrlSocial(url);

    if (!c.esSocial) return;

    urlsDePlataforma += 1;

    const origen = {
      evidenciaId: ev.id || `ev-${indice}`,
      titulo: ev.titulo || null,
      motores: (ev.motores || []).map((m) => m.nombre || m).filter(Boolean),
      motorOrigen: ev.__origen || ev.motor || null,
      urlOriginal: url
    };

    clasificadas.push({
      url,
      plataforma: c.plataforma,
      tipo: c.tipo,
      handle: c.handle,
      esCuenta: c.esCuenta,
      motivo: c.motivo
    });

    if (!c.esCuenta) {
      descartadas.push({
        url,
        plataforma: c.plataforma,
        tipo: c.tipo,
        motivo: c.motivo,
        origen
      });

      return;
    }

    /*
      FICHA CANDIDATA — los seis campos exigidos.
    */
    const clave = `${c.plataformaId}:${normalizarTexto(c.handle)}`;

    if (!candidatas.has(clave)) {
      candidatas.set(clave, {
        plataforma: c.plataforma,
        plataformaId: c.plataformaId,
        handle: c.handle,
        url: c.urlCanonica,
        urlNormalizada: c.urlNormalizada,
        tipo: c.tipo,
        confianzaInicial: c.confianzaInicial,

        handleDerivadoDeContenido: c.handleDerivadoDeContenido,
        handleOpaco: c.handleOpaco,

        origenes: [],

        /* SD-1A: nacida solo de evidencias ya existentes. */
        nacidaDe: "evidencias_fusion",
        requiereConsultaNueva: false
      });
    }

    const ficha = candidatas.get(clave);

    ficha.origenes.push(origen);

    /*
      Si la misma cuenta aparece como perfil Y como contenido,
      manda el perfil: es la evidencia más directa.
    */
    const jerarquia = [
      TIPOS_URL.PERFIL,
      TIPOS_URL.CANAL,
      TIPOS_URL.PAGINA,
      TIPOS_URL.POST,
      TIPOS_URL.VIDEO
    ];

    if (jerarquia.indexOf(c.tipo) < jerarquia.indexOf(ficha.tipo)) {
      ficha.tipo = c.tipo;
      ficha.url = c.urlCanonica;
      ficha.urlNormalizada = c.urlNormalizada;
      ficha.confianzaInicial = c.confianzaInicial;
      ficha.handleDerivadoDeContenido = c.handleDerivadoDeContenido;
    }
  });

  const fichas = [...candidatas.values()].map((f) => ({
    ...f,
    totalOrigenes: f.origenes.length,
    motores: [
      ...new Set(f.origenes.flatMap((o) => [...o.motores, o.motorOrigen]).filter(Boolean))
    ]
  }));

  return {
    version: "SD-1A",

    fichas: fichas.sort(
      (a, b) => b.confianzaInicial.valor - a.confianzaInicial.valor
    ),

    clasificadas,
    descartadas,

    metricas: {
      evidenciasRecibidas: lista.length,
      urlsExaminadas,
      urlsDePlataforma,
      urlsClasificadas: clasificadas.length,
      fichasCandidatas: fichas.length,
      descartadas: descartadas.length,
      porTipo: clasificadas.reduce((acc, c) => {
        acc[c.tipo] = (acc[c.tipo] || 0) + 1;
        return acc;
      }, {}),
      porPlataforma: fichas.reduce((acc, f) => {
        acc[f.plataformaId] = (acc[f.plataformaId] || 0) + 1;
        return acc;
      }, {})
    },

    /*
      Diagnóstico honesto cuando no hay nada que descubrir.
    */
    diagnostico:
      urlsDePlataforma === 0
        ? `Se examinaron ${urlsExaminadas} URL(s) y ninguna pertenece a una plataforma social soportada. No hay cuentas que descubrir en estas evidencias: no es un fallo del clasificador, es que las evidencias no contienen URLs de plataforma.`
        : null,

    generadoEn: new Date().toISOString()
  };
}
