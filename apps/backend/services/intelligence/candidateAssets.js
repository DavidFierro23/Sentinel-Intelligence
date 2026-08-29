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

  /*
    Instagram distingue tres cuentas y solo las dos primeras
    abren la via oficial de terceros.
  */
  INSTAGRAM_BUSINESS: "INSTAGRAM_BUSINESS",
  INSTAGRAM_CREATOR: "INSTAGRAM_CREATOR",

  /*
    El analista suele saber que una cuenta es profesional sin
    saber si Meta la tiene como Business o como Creator: en la
    interfaz las dos se ven casi igual. Obligarle a elegir seria
    obligarle a inventar, asi que existe el grado intermedio.

    Para la elegibilidad da lo mismo —las tres abren la misma
    via— y para cualquier otra cosa consta que no se afino.
  */
  INSTAGRAM_PROFESSIONAL: "INSTAGRAM_PROFESSIONAL",

  INSTAGRAM_PERSONAL: "INSTAGRAM_PERSONAL",

  /* La URL no permite decidirlo. Es el caso mas comun. */
  UNKNOWN: "UNKNOWN"
});


/*
-----------------------------------------------------------
QUE TIPOS ADMITE CADA PLATAFORMA

La interfaz pinta estas listas y el backend valida contra
ellas. Una sola fuente para las dos cosas: si divergen, se
puede guardar un tipo que despues nadie sabe leer.
-----------------------------------------------------------
*/
export const TIPOS_POR_PLATAFORMA = Object.freeze({
  facebook: Object.freeze([
    TIPOS_ACTIVO.UNKNOWN,
    TIPOS_ACTIVO.FACEBOOK_PROFILE,
    TIPOS_ACTIVO.FACEBOOK_PAGE
  ]),

  instagram: Object.freeze([
    TIPOS_ACTIVO.UNKNOWN,
    TIPOS_ACTIVO.INSTAGRAM_PROFESSIONAL,
    TIPOS_ACTIVO.INSTAGRAM_BUSINESS,
    TIPOS_ACTIVO.INSTAGRAM_CREATOR,
    TIPOS_ACTIVO.INSTAGRAM_PERSONAL
  ])
});


/* Etiquetas en castellano, para que la UI no las invente. */
export const ETIQUETA_TIPO = Object.freeze({
  UNKNOWN: "Sin clasificar",
  FACEBOOK_PROFILE: "Perfil personal",
  FACEBOOK_PAGE: "Pagina / Fan Page",
  INSTAGRAM_PROFESSIONAL: "Profesional (sin afinar)",
  INSTAGRAM_BUSINESS: "Business",
  INSTAGRAM_CREATOR: "Creator",
  INSTAGRAM_PERSONAL: "Personal"
});


/*
-----------------------------------------------------------
DE DONDE SALE EL TIPO

Esta es la distincion que justifica el gate entero. El tipo de
un activo puede venir de tres sitios muy distintos y valen
cosas muy distintas:

    ANALYST_DECLARATION   lo sabe una persona que lo miro
    PUBLIC_METADATA       lo dijo el HTML publico
    META_API              lo dijo Meta con un token

Las tres pueblan el MISMO campo `assetType`, y por eso hace
falta el campo de al lado. Un tipo sin procedencia es un tipo
que dentro de un mes nadie sabra si comprobar.

Y la regla que no se negocia:

    ANALYST_DECLARATION != VERIFICADO_TECNICAMENTE

Declarar es procedencia. Verificar es evidencia. Que el
analista acierte —normalmente acertara— no convierte su
declaracion en una comprobacion: sigue sin haber nada que
alguien pueda volver a mirar de forma independiente.
-----------------------------------------------------------
*/
export const FUENTE_TIPO = Object.freeze({
  ANALYST_DECLARATION: "ANALYST_DECLARATION",
  PUBLIC_METADATA: "PUBLIC_METADATA",
  META_API: "META_API",
  NINGUNA: "NINGUNA"
});


/*
  Que fuentes cuentan como verificacion tecnica. Hoy solo una,
  y no la tenemos para terceros.

  `PUBLIC_METADATA` esta fuera a proposito y por experiencia:
  META-COVERAGE-AUDIT-01 demostro que el HTML publico de
  Facebook clasifica paginas conocidas como perfiles.
*/
const FUENTES_VERIFICADAS = Object.freeze([FUENTE_TIPO.META_API]);


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

  /*
    Lo mismo, pero apoyado en que el analista declaro el tipo.
    Es un estado distinto y no un matiz del anterior: el que
    decide invertir en App Review necesita saber cuantos de sus
    activos elegibles lo son porque alguien los miro y cuantos
    porque una API lo dijo.
  */
  POTENCIALMENTE_ELEGIBLE_DECLARADA: "POTENCIALMENTE_ELEGIBLE_META_DECLARADA",

  /* Ninguna via oficial abre un perfil personal de Facebook. */
  NO_ELEGIBLE: "NO_ELEGIBLE_META_PUBLIC_PAGE_API",

  /* Ni una cuenta personal de Instagram. */
  NO_ELEGIBLE_INSTAGRAM: "NO_ELEGIBLE_META_OFICIAL_TERCEROS",

  /* Sin saber el tipo no se puede decidir. */
  INDETERMINADA: "INDETERMINADA"
});


/*
===========================================================
DECLARACION DE TIPO POR EL ANALISTA
===========================================================

El HTML publico no distingue perfil de pagina ni Business de
personal: quedo comprobado con control en
META-COVERAGE-AUDIT-01. Una persona que abre la cuenta lo ve
en un segundo.

Asi que el camino no es afinar el clasificador: es dejar que
el analista lo declare y NO llamar a eso una verificacion.

Lo que una declaracion NO hace, y esta escrito porque es justo
lo que se pierde de vista:

    NO cambia el candidato, la URL ni el handle.
    NO cambia el estado de identidad de la cuenta.
    NO verifica la cuenta ni la vuelve oficial.
    NO borra, funde ni desplaza a ningun otro activo.
    NO habilita el benchmark.

Solo anade una clasificacion, con su firma y su fecha.
===========================================================
*/
export function normalizarTipoDeclarado(plataformaId, tipo) {
  const plat = String(plataformaId || "").toLowerCase();

  const permitidos = TIPOS_POR_PLATAFORMA[plat];

  if (!permitidos) {
    return {
      valido: false,
      tipo: null,
      motivo: `la declaracion de tipo solo aplica a activos de Meta; «${plataformaId}» no lo es`
    };
  }

  const limpio = String(tipo || "").trim().toUpperCase();

  /*
    Vaciar el selector es una accion legitima: el analista
    puede retirar una clasificacion que puso mal. Se traduce a
    UNKNOWN, que es un tipo real y no la ausencia de dato.
  */
  if (!limpio) {
    return { valido: true, tipo: TIPOS_ACTIVO.UNKNOWN, motivo: "declaracion retirada" };
  }

  if (!permitidos.includes(limpio)) {
    return {
      valido: false,
      tipo: null,
      motivo: `«${limpio}» no es un tipo valido para ${plat}. Admitidos: ${permitidos.join(", ")}`
    };
  }

  return { valido: true, tipo: limpio, motivo: null };
}


/*
  Construye el registro de una declaracion. Nada mas: no toca
  la cuenta, no la busca y no la modifica. Se persiste aparte,
  precisamente para que declarar el tipo no pueda alterar la
  identidad ni por accidente.
*/
export function crearDeclaracionDeTipo(entrada = {}) {
  const {
    candidateId = null,
    assetId = null,
    platform = null,
    url = null,
    declaredType = null,
    declaredBy = "analyst",
    declaredAt = null
  } = entrada;

  if (!assetId) {
    return { valido: false, motivo: "falta el identificador del activo" };
  }

  const n = normalizarTipoDeclarado(platform, declaredType);

  if (!n.valido) return { valido: false, motivo: n.motivo };

  return {
    valido: true,

    declaracion: {
      candidateId,
      assetId,
      platform: String(platform || "").toLowerCase() || null,
      url: url || null,

      declaredType: n.tipo,
      declaredBy,
      declaredAt: declaredAt || new Date().toISOString(),

      /* ---- PROCEDENCIA, SIEMPRE JUNTO AL TIPO ---- */
      source: FUENTE_TIPO.ANALYST_DECLARATION,
      verificationStatus: VERIFICACION_ACTIVO.NO_VERIFICADA,

      nota:
        "Tipo declarado por el analista. Sentinel no lo ha comprobado contra ninguna API. Declarar no es verificar."
    }
  };
}


/*
  Resuelve el tipo efectivo de un activo cruzando lo que dice
  la URL con lo que declaro el analista.

  La declaracion GANA sobre la clasificacion tecnica publica, y
  no por deferencia: hoy la tecnica publica solo produce
  UNKNOWN o senales de URL —`/profile.php?id=`, `/pages/`— que
  son inequivocas y coinciden. Cuando discrepan, se conserva la
  discrepancia visible en lugar de tapar una con la otra,
  porque una de las dos esta mal y conviene saberlo.
*/
export function tipoEfectivo(clasificacionTecnica = {}, declaracion = null) {
  const tecnico = clasificacionTecnica.assetType || TIPOS_ACTIVO.UNKNOWN;

  const tecnicoDecide = clasificacionTecnica.determinado === true;

  if (!declaracion || !declaracion.declaredType) {
    return {
      assetType: tecnico,
      assetTypeSource: tecnicoDecide ? FUENTE_TIPO.PUBLIC_METADATA : FUENTE_TIPO.NINGUNA,
      assetTypeDeclared: null,
      assetTypeTecnico: tecnico,
      verificationStatus: VERIFICACION_ACTIVO.NO_VERIFICADA,
      conflicto: null,
      motivo: clasificacionTecnica.motivo || null
    };
  }

  const declarado = declaracion.declaredType;

  const hayConflicto =
    tecnicoDecide &&
    declarado !== TIPOS_ACTIVO.UNKNOWN &&
    declarado !== tecnico;

  return {
    assetType: declarado === TIPOS_ACTIVO.UNKNOWN ? tecnico : declarado,

    assetTypeSource:
      declarado === TIPOS_ACTIVO.UNKNOWN
        ? tecnicoDecide
          ? FUENTE_TIPO.PUBLIC_METADATA
          : FUENTE_TIPO.NINGUNA
        : FUENTE_TIPO.ANALYST_DECLARATION,

    assetTypeDeclared: declarado,
    assetTypeTecnico: tecnico,

    /*
      Aqui esta el corazon del gate. Por muchas declaraciones
      que se acumulen, esto no sube a VERIFICADA: solo lo hace
      una fuente de FUENTES_VERIFICADAS, y la declaracion del
      analista no es una.
    */
    verificationStatus: FUENTES_VERIFICADAS.includes(FUENTE_TIPO.ANALYST_DECLARATION)
      ? VERIFICACION_ACTIVO.VERIFICADA
      : VERIFICACION_ACTIVO.NO_VERIFICADA,

    declaredBy: declaracion.declaredBy || null,
    declaredAt: declaracion.declaredAt || null,

    conflicto: hayConflicto
      ? `el analista declaro ${declarado} y la URL indica ${tecnico}. Se conserva la declaracion y se deja la discrepancia a la vista: una de las dos esta mal.`
      : null,

    motivo: "declarado por el analista"
  };
}


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
export function elegibilidadMeta(assetType, fuente = FUENTE_TIPO.NINGUNA) {
  /*
    La procedencia viaja CON la elegibilidad. Un activo elegible
    porque lo dijo el analista y otro elegible porque lo dijo
    Meta caben en el mismo cajon de una tabla y no valen lo
    mismo a la hora de firmar una inversion.
  */
  const declarada = fuente === FUENTE_TIPO.ANALYST_DECLARATION;

  const procedencia = {
    assetTypeSource: fuente,
    basadaEnDeclaracion: declarada,
    verificadaTecnicamente: FUENTES_VERIFICADAS.includes(fuente)
  };

  const ELEGIBLES = [
    TIPOS_ACTIVO.FACEBOOK_PAGE,
    TIPOS_ACTIVO.INSTAGRAM_BUSINESS,
    TIPOS_ACTIVO.INSTAGRAM_CREATOR,
    TIPOS_ACTIVO.INSTAGRAM_PROFESSIONAL
  ];

  if (ELEGIBLES.includes(assetType)) {
    const esFb = assetType === TIPOS_ACTIVO.FACEBOOK_PAGE;

    return {
      ...procedencia,

      estado: declarada
        ? ELEGIBILIDAD_META.POTENCIALMENTE_ELEGIBLE_DECLARADA
        : ELEGIBILIDAD_META.POTENCIALMENTE_ELEGIBLE,

      via: esFb
        ? "Page Public Content Access"
        : "Instagram Public Content Access (Business Discovery)",

      requisitos: ["Advanced Access", "App Review", "Business Verification"],

      habilitaBenchmark: false,

      nota: declarada
        ? "Elegibilidad POTENCIAL apoyada en la declaracion del analista. No esta comprobada contra ninguna API y no es medicion."
        : "Elegibilidad potencial, no medicion. Que exista la via no significa que se haya recorrido ni que Meta la conceda."
    };
  }

  if (assetType === TIPOS_ACTIVO.FACEBOOK_PROFILE) {
    return {
      ...procedencia,
      estado: ELEGIBILIDAD_META.NO_ELEGIBLE,
      via: null,
      requisitos: [],
      habilitaBenchmark: false,
      nota:
        "Ninguna via oficial de Meta abre un perfil personal. No es cuestion de permisos ni de dinero: no existe."
    };
  }

  if (assetType === TIPOS_ACTIVO.INSTAGRAM_PERSONAL) {
    return {
      ...procedencia,
      estado: ELEGIBILIDAD_META.NO_ELEGIBLE_INSTAGRAM,
      via: null,
      requisitos: [],
      habilitaBenchmark: false,
      nota:
        "Business Discovery solo alcanza cuentas profesionales de terceros. Una cuenta personal no la abre ninguna via oficial."
    };
  }

  return {
    ...procedencia,
    estado: ELEGIBILIDAD_META.INDETERMINADA,
    via: null,
    requisitos: [],
    habilitaBenchmark: false,
    nota:
      "Sin saber el tipo no se puede decidir la elegibilidad. Se resuelve al determinar el tipo, no antes. INDETERMINADA no es un «no»."
  };
}


/*
  Los tres estados de elegibilidad que cuentan como «si», cada
  uno con su procedencia. Se usan para partir la cobertura y
  estan aqui para que no se recalculen a mano en tres sitios.
*/
const ELEGIBLES_CONFIRMADOS = [ELEGIBILIDAD_META.POTENCIALMENTE_ELEGIBLE];

const ELEGIBLES_DECLARADOS = [ELEGIBILIDAD_META.POTENCIALMENTE_ELEGIBLE_DECLARADA];

const NO_ELEGIBLES = [
  ELEGIBILIDAD_META.NO_ELEGIBLE,
  ELEGIBILIDAD_META.NO_ELEGIBLE_INSTAGRAM
];


/*
===========================================================
CLASIFICAR UN ACTIVO DE INSTAGRAM

No hay nada que clasificar sin declaracion, y conviene decirlo
en voz alta en lugar de dejar un UNKNOWN mudo.

La URL de Instagram es siempre `instagram.com/handle`, igual
para una cuenta personal y para una Business. El HTML publico
devuelve `og:type=profile` en las tres. La distincion vive en
la configuracion de la cuenta, que Meta solo expone con token.
===========================================================
*/
export function clasificarActivoInstagram(cuenta = {}) {
  const declarado = String(cuenta.tipoDeclarado || "").toUpperCase();

  return {
    assetType: TIPOS_ACTIVO.UNKNOWN,
    senales: [],
    determinado: false,
    motivo:
      "Instagram no expone Business/Creator en su HTML publico: `instagram.com/handle` y `og:type=profile` son identicos para una cuenta personal y una profesional. Solo lo resuelve un token o la declaracion del analista.",
    comoSeSabria: [
      "que el analista lo declare mirando la cuenta",
      "resolverlo con Business Discovery, que exige App Review y Business Verification"
    ],
    /* Sin efecto: solo evita que un `tipoDeclarado` suelto se pierda. */
    tipoDeclaradoEnLaCuenta: declarado || null
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
  const { candidateId = null, cuentas = [], declaraciones = [] } = entrada;

  /*
    Una declaracion por activo: la ultima. El historial completo
    vive en la serie del Lake, que es append-only; aqui solo
    hace falta la vigente.
  */
  const porActivo = new Map();

  [...(declaraciones || [])]
    .filter((d) => d && d.assetId)
    .sort((x, y) => String(x.declaredAt || "").localeCompare(String(y.declaredAt || "")))
    .forEach((d) => porActivo.set(String(d.assetId), d));

  const activos = (cuentas || []).map((c) => {
    const esFacebook = c.plataformaId === "facebook";
    const esInstagram = c.plataformaId === "instagram";

    const clasificacion = esFacebook
      ? clasificarActivoFacebook(c)
      : esInstagram
        ? clasificarActivoInstagram(c)
        : {
            assetType: TIPOS_ACTIVO.UNKNOWN,
            senales: [],
            determinado: false,
            motivo: "la clasificacion de tipo de activo solo aplica a Meta"
          };

    const rel = relacionConCandidato(c);

    /*
      La declaracion se busca por el id del activo, que es
      `plataforma:handle` y no cambia al declarar el tipo. Por
      eso clasificar un activo no puede alcanzar a su hermano:
      son claves distintas y registros distintos.
    */
    const declaracion = porActivo.get(String(c.id || "")) || null;

    const tipo = tipoEfectivo(clasificacion, declaracion);

    const esMeta = esFacebook || esInstagram;

    return {
      accountId: c.id || null,
      candidateId,
      platform: c.plataformaId || null,
      url: c.url || null,
      handle: c.handle || null,

      assetType: tipo.assetType,
      assetTypeSource: tipo.assetTypeSource,
      assetTypeDeclared: tipo.assetTypeDeclared,
      assetTypeTecnico: tipo.assetTypeTecnico,
      assetTypeConflicto: tipo.conflicto,
      assetTypeDeclaredBy: tipo.declaredBy || null,
      assetTypeDeclaredAt: tipo.declaredAt || null,

      /*
        La verificacion del TIPO es una cosa y la de la CUENTA
        es otra. `verificationStatus` de `rel` habla de si la
        cuenta es del candidato; este habla de si sabemos que
        clase de cuenta es. Se separan porque confundirlas
        convierte «el analista dijo que es una Page» en «la
        cuenta esta verificada».
      */
      assetTypeVerification: tipo.verificationStatus,

      tiposAdmitidos: esMeta ? TIPOS_POR_PLATAFORMA[c.plataformaId] || [] : [],

      assetTypeMotivo: tipo.motivo || clasificacion.motivo,
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

      elegibilidadMeta: esMeta
        ? elegibilidadMeta(tipo.assetType, tipo.assetTypeSource)
        : null
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


/*
===========================================================
COBERTURA META EN TRES NIVELES

Tres cifras que NO se suman entre si y ninguna se lee por otra:

    CONFIRMADA    verificada tecnicamente como elegible
    DECLARADA     el analista dijo que el activo es elegible
    DESCONOCIDA   nadie lo ha clasificado

El error que esto previene tiene nombre y ya casi ocurre en
META-COVERAGE-AUDIT-01: contar los UNKNOWN como «no». No
haber demostrado que una cuenta es profesional no demuestra
que sea personal, y en aquella auditoria habria producido un
«Meta no cubre a nadie» rotundo y falso.

El error simetrico es el que abre este gate: contar los
DECLARADA como CONFIRMADA y firmar una inversion sobre la
memoria de alguien.
===========================================================
*/
export function coberturaMetaDeclarada(candidatos = []) {
  const PLATAFORMAS = ["instagram", "facebook"];

  const clasificarActivo = (a) => {
    const estado = a?.elegibilidadMeta?.estado || ELEGIBILIDAD_META.INDETERMINADA;

    if (ELEGIBLES_CONFIRMADOS.includes(estado)) return "CONFIRMADA";
    if (ELEGIBLES_DECLARADOS.includes(estado)) return "DECLARADA";
    if (NO_ELEGIBLES.includes(estado)) return "NO_ELEGIBLE";

    return "DESCONOCIDA";
  };

  const vacio = () => ({
    confirmada: [],
    declarada: [],
    noElegible: [],
    desconocida: []
  });

  const porPlataforma = {};

  PLATAFORMAS.forEach((p) => {
    porPlataforma[p] = vacio();
  });

  const global = vacio();

  const detalle = [];

  (candidatos || []).forEach((c) => {
    const activos = (c?.activos || []).filter((a) =>
      PLATAFORMAS.includes(a.platform)
    );

    const veredictoDe = (lista) => {
      const estados = lista.map(clasificarActivo);

      /*
        Basta UNA superficie elegible para que el candidato sea
        alcanzable, y la mas fuerte manda. Pero para declararlo
        FUERA hacen falta las dos cosas: que haya activos y que
        TODOS sean no elegibles. Un solo UNKNOWN devuelve el
        candidato a DESCONOCIDA.
      */
      if (estados.includes("CONFIRMADA")) return "CONFIRMADA";
      if (estados.includes("DECLARADA")) return "DECLARADA";
      if (estados.length > 0 && estados.every((e) => e === "NO_ELEGIBLE")) {
        return "NO_ELEGIBLE";
      }

      return "DESCONOCIDA";
    };

    const porPlat = {};

    PLATAFORMAS.forEach((p) => {
      const lista = activos.filter((a) => a.platform === p);

      /*
        Sin activos en la plataforma no hay nada que clasificar.
        `SIN_ACTIVO` no es `NO_ELEGIBLE`: Juan Carlos Vega no
        tiene Facebook, y eso no dice nada sobre si su Facebook
        seria elegible.
      */
      const v = lista.length ? veredictoDe(lista) : "SIN_ACTIVO";

      porPlat[p] = { veredicto: v, activos: lista.length };

      if (v === "CONFIRMADA") porPlataforma[p].confirmada.push(c.candidateId);
      else if (v === "DECLARADA") porPlataforma[p].declarada.push(c.candidateId);
      else if (v === "NO_ELEGIBLE") porPlataforma[p].noElegible.push(c.candidateId);
      else if (v === "DESCONOCIDA") porPlataforma[p].desconocida.push(c.candidateId);
    });

    const g = activos.length ? veredictoDe(activos) : "SIN_ACTIVO";

    if (g === "CONFIRMADA") global.confirmada.push(c.candidateId);
    else if (g === "DECLARADA") global.declarada.push(c.candidateId);
    else if (g === "NO_ELEGIBLE") global.noElegible.push(c.candidateId);
    else global.desconocida.push(c.candidateId);

    detalle.push({
      candidateId: c.candidateId,
      nombre: c.nombre || null,
      global: g,
      porPlataforma: porPlat,
      activosMeta: activos.length,
      sinClasificar: activos.filter((a) => clasificarActivo(a) === "DESCONOCIDA").length
    });
  });

  const total = (candidatos || []).length;

  const pct = (n) => (total > 0 ? Math.round((n / total) * 1000) / 10 : null);

  const resumen = (b) => ({
    confirmada: b.confirmada.length,
    declarada: b.declarada.length,
    noElegible: b.noElegible.length,
    desconocida: b.desconocida.length,
    candidatos: b
  });

  const activosTotales = (candidatos || []).flatMap((c) =>
    (c?.activos || []).filter((a) => PLATAFORMAS.includes(a.platform))
  );

  const sinClasificar = activosTotales.filter(
    (a) => clasificarActivo(a) === "DESCONOCIDA"
  ).length;

  return {
    total,

    /* ---- LOS TRES NIVELES, SIN MEZCLAR ---- */
    COBERTURA_CONFIRMADA: {
      candidatos: global.confirmada.length,
      porcentaje: pct(global.confirmada.length),
      ids: global.confirmada,
      significa:
        "verificada tecnicamente contra una API de Meta. Es la unica que sostiene una decision de inversion por si sola."
    },

    COBERTURA_DECLARADA: {
      candidatos: global.declarada.length,
      porcentaje: pct(global.declarada.length),
      ids: global.declarada,
      significa:
        "el analista declaro que el activo es de un tipo elegible. Es una hipotesis bien fundada, no una comprobacion."
    },

    COBERTURA_DESCONOCIDA: {
      candidatos: global.desconocida.length,
      porcentaje: pct(global.desconocida.length),
      ids: global.desconocida,
      significa:
        "nadie ha clasificado sus activos. No es un «no»: es que no se sabe."
    },

    SIN_COBERTURA: {
      candidatos: global.noElegible.length,
      porcentaje: pct(global.noElegible.length),
      ids: global.noElegible,
      significa:
        "todos sus activos Meta son de un tipo que ninguna via oficial alcanza."
    },

    porPlataforma: {
      instagram: resumen(porPlataforma.instagram),
      facebook: resumen(porPlataforma.facebook)
    },

    detalle,

    activosMeta: activosTotales.length,
    activosSinClasificar: sinClasificar,

    tasaDeClasificacion:
      activosTotales.length > 0
        ? Math.round(((activosTotales.length - sinClasificar) / activosTotales.length) * 1000) / 10
        : null,

    /*
      La comparabilidad se degrada con el mismo umbral interno
      que fijo META-COVERAGE-AUDIT-01: mas del 30 % de
      candidatos dependiendo de activos sin clasificar.
    */
    comparabilidad:
      total === 0
        ? "SIN_DATOS"
        : global.desconocida.length / total > 0.3
          ? "INDETERMINADA"
          : "COMPARABLE",

    noEsMedicion:
      "Ni COBERTURA_CONFIRMADA ni COBERTURA_DECLARADA son MEDIDO_TERCERO. Ninguna habilita el benchmark multicandidato.",

    reglaUnknown:
      "UNKNOWN no se suma a SI ni a NO. Es su propia columna y por eso hay cuatro."
  };
}


export default {
  TIPOS_ACTIVO,
  TIPOS_POR_PLATAFORMA,
  ETIQUETA_TIPO,
  FUENTE_TIPO,
  normalizarTipoDeclarado,
  crearDeclaracionDeTipo,
  tipoEfectivo,
  clasificarActivoInstagram,
  coberturaMetaDeclarada,
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
