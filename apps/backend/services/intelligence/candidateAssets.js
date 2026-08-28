// apps/backend/services/intelligence/candidateAssets.js

/*
===========================================================
ACTIVOS DE UN CANDIDATO — P-CAND-FB-MULTI-ASSET-01
===========================================================

LA REGLA PERMANENTE

    UN CANDIDATO PUEDE TENER N ACTIVOS POR PLATAFORMA.

    facebook:
      - perfil
      - pagina
      - pagina de campana
      - pagina historica

Encontrar uno no significa haberlos encontrado todos, y el
sistema NO elige uno como el unico. Que una pagina tenga mas
seguidores no la convierte en «la buena»: puede ser la del
partido, la de una campana anterior o la de un homonimo.

-----------------------------------------------------------
POR QUE ESTE MODULO EXISTE
-----------------------------------------------------------

Facebook obliga a distinguir dos cosas que la URL no siempre
distingue:

    PERFIL   una persona. Ninguna API oficial lo abre.
    PAGINA   un activo publico. Page Public Content Access
             podria abrirla, con App Review y verificacion.

La diferencia decide si un activo tiene futuro por la via
oficial de Meta o no lo tiene en absoluto. Y no se puede
adivinar: `facebook.com/nombre` es una URL valida para las dos.

Cuando no hay senal, esto devuelve `UNKNOWN`. No es pereza: es
que inventar el tipo llevaria a esperar de un perfil algo que
ninguna API va a dar nunca.
===========================================================
*/

export const TIPOS_ACTIVO = Object.freeze({
  FACEBOOK_PROFILE: "FACEBOOK_PROFILE",
  FACEBOOK_PAGE: "FACEBOOK_PAGE",

  /* La URL no permite decidirlo. Es el caso mas comun. */
  UNKNOWN: "UNKNOWN"
});


/*
-----------------------------------------------------------
RELACION CON EL CANDIDATO

Que exista un activo no dice de quien es ni con que titulo.

`OFFICIAL` es la mas fuerte y la que mas facil se regala: una
pagina con muchos seguidores parece oficial. No lo es hasta que
alguien lo sostenga con evidencia.
-----------------------------------------------------------
*/
export const RELACION = Object.freeze({
  /* Corroborada como canal oficial del candidato. */
  OFFICIAL: "OFFICIAL",

  /* Relacionada de forma observable, sin ser oficial. */
  ASSOCIATED: "ASSOCIATED",

  /* La escribio el analista. Procedencia, no evidencia. */
  DECLARED_BY_ANALYST: "DECLARED_BY_ANALYST",

  UNKNOWN: "UNKNOWN"
});


export const VERIFICACION_ACTIVO = Object.freeze({
  VERIFICADA: "VERIFICADA",
  NO_VERIFICADA: "NO_VERIFICADA"
});


/*
-----------------------------------------------------------
ELEGIBILIDAD META — POR ACTIVO, NUNCA POR CANDIDATO

Un candidato no es «elegible para Meta»: lo son o no lo son sus
activos, uno por uno. Tener una pagina elegible no vuelve
elegible su perfil, y al reves tampoco.
-----------------------------------------------------------
*/
export const ELEGIBILIDAD_META = Object.freeze({
  /*
    Podria alcanzarse con Page Public Content Access. NO
    significa que funcione: significa que existe una via que
    todavia hay que recorrer entera.
  */
  POTENCIALMENTE_ELEGIBLE: "POTENCIALMENTE_ELEGIBLE_META",

  /* Ninguna via oficial abre esto. Ni ahora ni tras la revision. */
  NO_ELEGIBLE: "NO_ELEGIBLE_META_PUBLIC_PAGE_API",

  /* Sin saber el tipo no se puede decidir. */
  INDETERMINADA: "INDETERMINADA"
});


/*
===========================================================
CLASIFICAR UN ACTIVO DE FACEBOOK

Solo con lo persistido. Sin API, sin red y sin conjeturas.
===========================================================
*/
export function clasificarActivoFacebook(cuenta = {}) {
  const url = String(cuenta.url || "").toLowerCase();

  const senales = [];

  const anotar = (tipo, senal, fuerte) => {
    senales.push({ tipo, senal, fuerte });
  };

  /* Formas de URL que SI deciden. */
  if (/\/profile\.php\?id=\d+/.test(url)) {
    anotar(TIPOS_ACTIVO.FACEBOOK_PROFILE, "URL con profile.php?id=", true);
  }

  if (/\/people\//.test(url)) {
    anotar(TIPOS_ACTIVO.FACEBOOK_PROFILE, "URL con /people/", true);
  }

  if (/\/pages\//.test(url)) {
    anotar(TIPOS_ACTIVO.FACEBOOK_PAGE, "URL con /pages/", true);
  }

  if (/\/pg\//.test(url)) {
    anotar(TIPOS_ACTIVO.FACEBOOK_PAGE, "URL con /pg/", true);
  }

  /*
    Metadata que la observacion pudo dejar guardada. `og:type`
    distingue de verdad, pero solo existe si alguien leyo la
    pagina; hoy normalmente no esta.
  */
  const og = String(cuenta.ogType || cuenta.metadata?.ogType || "").toLowerCase();

  if (og.includes("profile")) {
    anotar(TIPOS_ACTIVO.FACEBOOK_PROFILE, "og:type declara profile", true);
  }

  if (og.includes("page") || og.includes("business")) {
    anotar(TIPOS_ACTIVO.FACEBOOK_PAGE, "og:type declara page", true);
  }

  const fuertes = senales.filter((x) => x.fuerte);

  const tipos = [...new Set(fuertes.map((x) => x.tipo))];

  if (tipos.length === 1) {
    return {
      assetType: tipos[0],
      senales,
      determinado: true,
      motivo: fuertes.map((x) => x.senal).join("; ")
    };
  }

  if (tipos.length > 1) {
    return {
      assetType: TIPOS_ACTIVO.UNKNOWN,
      senales,
      determinado: false,
      motivo:
        "senales en conflicto: la URL apunta a perfil y a pagina a la vez. No se elige una por mayoria."
    };
  }

  /*
    El caso habitual: una URL de vanidad. `facebook.com/nombre`
    es valida tanto para un perfil como para una pagina, asi que
    no decide nada.
  */
  return {
    assetType: TIPOS_ACTIVO.UNKNOWN,
    senales,
    determinado: false,
    motivo:
      "URL de vanidad: `facebook.com/nombre` la usan tanto los perfiles como las paginas. No hay senal que decida, y adivinar llevaria a esperar de un perfil algo que ninguna API entrega.",
    comoSeSabria: [
      "leer la pagina publica y mirar su og:type",
      "resolver el id con la API de Meta, que hoy no tenemos para terceros",
      "que el analista lo declare explicitamente"
    ]
  };
}


/*
===========================================================
LEER EL TIPO DE UNA PAGINA PUBLICA

Extrae de un HTML publico las senales que SI deciden. No hay
red aqui: recibe el HTML y devuelve senales, para que se pueda
probar sin salir a internet.

    og:type = profile     PERFIL
    og:type = website     no decide: lo usan las dos
    al_ios / al_android   a veces declaran `page` o `profile`

Facebook sirve a un visitante sin sesion una pagina reducida, y
puede no traer nada. Eso no es un fallo: es la respuesta, y se
registra como tal.
===========================================================
*/
export function senalesDeHtmlFacebook(html) {
  const texto = String(html || "");

  const meta = (clave) => {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)\s*=\s*["']${clave}["'][^>]*content\s*=\s*["']([^"']*)["']`,
      "i"
    );

    const m = texto.match(re);

    return m ? m[1].trim() : null;
  };

  const ogType = meta("og:type");

  const senales = [];

  if (ogType) senales.push({ clave: "og:type", valor: ogType });

  /*
    `profile.php?id=` dentro de la propia pagina, en el enlace
    canonico, delata un perfil aunque la URL de entrada sea de
    vanidad.
  */
  const canonical =
    (texto.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) || [])[1] ||
    meta("og:url");

  if (canonical) senales.push({ clave: "canonical", valor: canonical });

  /*
    -----------------------------------------------------------
    SENALES QUE PARECIAN SERVIR Y NO SERVIAN
    -----------------------------------------------------------

    Aqui habia dos marcadores mas: se buscaba `page_id` o
    `entity_type: PAGE` para las paginas, y `userID`,
    `profile_id` o `entity_type: USER` para los perfiles.

    Sobre los once activos reales del proyecto dieron un
    resultado sospechosamente limpio: once perfiles, cero
    paginas. Un control lo desmonto en tres peticiones —las
    paginas de Meta, BBC News y NASA, que son paginas sin
    discusion, salieron tambien como «perfil»—.

    Esos tokens estan en el armazon que Facebook sirve a un
    visitante sin sesion, en cualquier URL. No son una senal:
    son plantilla.

    Se retiran. Un clasificador que acierta el 0 % con una
    confianza del 100 % es peor que uno que dice «no lo se»: el
    segundo deja el hueco a la vista, y el primero lo tapa con
    una respuesta que nadie va a volver a comprobar.
    -----------------------------------------------------------
  */

  return {
    senales,
    ogType,
    canonical,
    huboHtml: texto.length > 0,
    utilizable: senales.length > 0
  };
}


/*
  Traduce esas senales a un tipo, o reconoce que no alcanzan.
*/
export function tipoDesdeSenales(lectura = {}) {
  const og = String(lectura.ogType || "").toLowerCase();

  const canonical = String(lectura.canonical || "").toLowerCase();

  if (og === "profile" || /profile\.php\?id=|\/people\//.test(canonical)) {
    return {
      assetType: TIPOS_ACTIVO.FACEBOOK_PROFILE,
      confidence: "ALTA",
      evidencia: og === "profile" ? "og:type=profile" : `canonical=${canonical}`
    };
  }

  if (/\/pages\//.test(canonical)) {
    return {
      assetType: TIPOS_ACTIVO.FACEBOOK_PAGE,
      confidence: "ALTA",
      evidencia: `canonical=${canonical}`
    };
  }

  /*
    `og:type=website` lo usan tanto perfiles como paginas, asi
    que no decide. Reconocerlo evita el error de tomarlo por
    senal.
  */
  return {
    assetType: TIPOS_ACTIVO.UNKNOWN,
    confidence: "NINGUNA",
    evidencia: lectura.huboHtml
      ? og
        ? `og:type=${og}, que no distingue perfil de pagina`
        : "la pagina respondio y no expone metadata que distinga perfil de pagina"
      : "no se obtuvo HTML",

    comprobado:
      "Verificado con un control: paginas conocidas y perfiles devuelven el mismo armazon sin sesion. Sin `og:type=profile` o un canonical explicito, el HTML publico de Facebook no distingue."
  };
}


/*
===========================================================
RELACION Y VERIFICACION

Una cuenta declarada por el analista y sin corroborar es
DECLARED_BY_ANALYST y NO_VERIFICADA. No se asciende por tener
mas seguidores ni por parecer la principal.
===========================================================
*/
export function relacionConCandidato(cuenta = {}) {
  const declarada = cuenta.declaradaPorAnalista === true;

  /*
    `corroboradaPorSentinel` en la ficha significa «algun
    proveedor la devolvio», que es mas debil que una senal
    independiente. Para OFICIAL se exige lo segundo.
  */
  const senalesIndependientes = (cuenta.senalesIndependientes || []).length;

  if (senalesIndependientes > 0) {
    return {
      relationshipToCandidate: RELACION.OFFICIAL,
      verificationStatus: VERIFICACION_ACTIVO.VERIFICADA,
      motivo: `sostenida por ${senalesIndependientes} senal(es) independiente(s) del nombre`
    };
  }

  if (cuenta.corroboradaPorSentinel === true) {
    return {
      relationshipToCandidate: RELACION.ASSOCIATED,
      verificationStatus: VERIFICACION_ACTIVO.NO_VERIFICADA,
      motivo:
        "algun proveedor la devolvio, pero sin senal independiente del nombre. Relacionada de forma observable; no oficial."
    };
  }

  if (declarada) {
    return {
      relationshipToCandidate: RELACION.DECLARED_BY_ANALYST,
      verificationStatus: VERIFICACION_ACTIVO.NO_VERIFICADA,
      motivo:
        "la escribio el analista y nada externo la corrobora. Es procedencia, no evidencia."
    };
  }

  return {
    relationshipToCandidate: RELACION.UNKNOWN,
    verificationStatus: VERIFICACION_ACTIVO.NO_VERIFICADA,
    motivo: "sin procedencia ni corroboracion registradas"
  };
}


/*
===========================================================
ELEGIBILIDAD META DE UN ACTIVO
===========================================================

Lo que este campo NO dice, y conviene tenerlo delante:

    NO dice que se pueda medir.
    NO es MEDIDO_TERCERO.
    NO habilita el benchmark multicandidato.

Dice que existe una via oficial que ese activo podria recorrer,
y que todavia hay que recorrerla entera: App Review, Business
Verification y Advanced Access.
===========================================================
*/
export function elegibilidadMeta(assetType) {
  if (assetType === TIPOS_ACTIVO.FACEBOOK_PAGE) {
    return {
      estado: ELEGIBILIDAD_META.POTENCIALMENTE_ELEGIBLE,
      via: "Page Public Content Access",
      requisitos: ["Advanced Access", "App Review", "Business Verification"],
      habilitaBenchmark: false,
      nota:
        "Elegibilidad potencial, no medicion. Que exista la via no significa que se haya recorrido ni que Meta la conceda."
    };
  }

  if (assetType === TIPOS_ACTIVO.FACEBOOK_PROFILE) {
    return {
      estado: ELEGIBILIDAD_META.NO_ELEGIBLE,
      via: null,
      requisitos: [],
      habilitaBenchmark: false,
      nota:
        "Ninguna via oficial de Meta abre un perfil personal. No es cuestion de permisos ni de dinero: no existe."
    };
  }

  return {
    estado: ELEGIBILIDAD_META.INDETERMINADA,
    via: null,
    requisitos: [],
    habilitaBenchmark: false,
    nota:
      "Sin saber si es perfil o pagina no se puede decidir la elegibilidad. Se resuelve al determinar el tipo, no antes."
  };
}


/*
===========================================================
LOS ACTIVOS DE UN CANDIDATO, AGRUPADOS POR PLATAFORMA
===========================================================

Ningun activo se elimina, se funde ni se elige como unico.
===========================================================
*/
export function activosDeCandidato(entrada = {}) {
  const { candidateId = null, cuentas = [] } = entrada;

  const activos = (cuentas || []).map((c) => {
    const esFacebook = c.plataformaId === "facebook";

    const clasificacion = esFacebook
      ? clasificarActivoFacebook(c)
      : {
          assetType: TIPOS_ACTIVO.UNKNOWN,
          senales: [],
          determinado: false,
          motivo: "la distincion perfil/pagina solo aplica a Facebook"
        };

    const rel = relacionConCandidato(c);

    return {
      accountId: c.id || null,
      candidateId,
      platform: c.plataformaId || null,
      url: c.url || null,
      handle: c.handle || null,

      assetType: clasificacion.assetType,
      assetTypeMotivo: clasificacion.motivo,
      assetTypeDeterminado: clasificacion.determinado,
      senalesDeTipo: clasificacion.senales,
      comoSeSabria: clasificacion.comoSeSabria || null,

      ...rel,

      /* Procedencia, sin mezclarla con el veredicto. */
      procedencia: {
        declaradaPorAnalista: c.declaradaPorAnalista === true,
        descubiertaPorSentinel: c.descubiertaPorSentinel === true,
        corroboradaPorSentinel: c.corroboradaPorSentinel === true,
        proveedores: c.proveedoresHistoricos || c.proveedores || []
      },

      firstSeenAt: c.firstSeenAt || null,
      lastSeenAt: c.lastSeenAt || null,

      elegibilidadMeta: esFacebook ? elegibilidadMeta(clasificacion.assetType) : null
    };
  });

  /* Agrupacion por plataforma: N activos, sin elegir uno. */
  const porPlataforma = {};

  activos.forEach((a) => {
    const p = a.platform || "sin_plataforma";

    porPlataforma[p] = porPlataforma[p] || [];

    porPlataforma[p].push(a);
  });

  const conVarios = Object.entries(porPlataforma)
    .filter(([, lista]) => lista.length > 1)
    .map(([plataforma, lista]) => ({
      plataforma,
      activos: lista.length,
      ids: lista.map((x) => x.accountId),
      nota:
        "Mas de un activo en esta plataforma. Es legitimo —perfil y pagina, o pagina personal y de campana— y ninguno sustituye al otro."
    }));

  return {
    candidateId,
    activos,
    porPlataforma,
    total: activos.length,

    variosPorPlataforma: conVarios,

    /*
      DELIBERADAMENTE null. Elegir uno automaticamente —por
      seguidores, por antiguedad, por lo que sea— es la decision
      que hace desaparecer al otro de la vista.
    */
    principal: null,

    notaPrincipal:
      "No se elige un activo principal automaticamente. `primaryForDisplay` y `primaryForObservation` son decisiones distintas y ninguna se deduce del numero de seguidores.",

    regla: "UN CANDIDATO PUEDE TENER N ACTIVOS POR PLATAFORMA.",

    elegibilidadNoEsMedicion:
      "POTENCIALMENTE_ELEGIBLE_META no es MEDIDO_TERCERO y no habilita el benchmark multicandidato."
  };
}


export default {
  TIPOS_ACTIVO,
  senalesDeHtmlFacebook,
  tipoDesdeSenales,
  RELACION,
  VERIFICACION_ACTIVO,
  ELEGIBILIDAD_META,
  clasificarActivoFacebook,
  relacionConCandidato,
  elegibilidadMeta,
  activosDeCandidato
};
