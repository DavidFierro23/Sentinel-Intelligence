// apps/backend/services/intelligence/socialCapabilityMatrix.js

/*
===========================================================
MATRIZ DE CAPACIDADES SOCIALES — P-CAND-03
===========================================================

Una sola matriz para las cinco plataformas. No hay
`TikTokCandidateModel` ni `YouTubeCandidateModel`: cada
plataforma declara QUE se puede leer de ella y todo lo que se
lee alimenta los mismos contratos.

    TikTok video · Instagram reel · Facebook video
    YouTube video · X post

son la misma cosa —`PublicationObservation`— con `platformId`
distinto.

-----------------------------------------------------------
LA REGLA DE ESTA MATRIZ
-----------------------------------------------------------

    NADA EN VERDE POR SUPOSICION.

Cada capacidad lleva `verificacion`, que dice COMO se sabe lo
que dice:

    MEDIDO_EN_PRODUCCION   se ejecuto y funciono
    DOCUMENTADO            lo dice la documentacion oficial
    NO_VERIFICADO          no se ha comprobado

Una capacidad `DISPONIBLE` + `DOCUMENTADO` no es lo mismo que
`DISPONIBLE` + `MEDIDO_EN_PRODUCCION`. La primera puede caerse
el dia que se intente; la segunda ya se intento.

-----------------------------------------------------------
LA DISTINCION QUE LO DECIDE TODO
-----------------------------------------------------------

    CUENTA PROPIA / AUTORIZADA   el titular nos da permiso
    CUENTA DE TERCERO            no nos lo da

Casi toda la documentacion de las APIs sociales habla del primer
caso. Sentinel hace inteligencia electoral: sus objetivos son
terceros que no van a autorizar nada. Confundir los dos casos es
el error que produce hojas de ruta imposibles, asi que cada
capacidad declara `alcance`.
===========================================================
*/


export const ESTADOS_CAPACIDAD = Object.freeze({
  /* Se puede leer hoy, con lo que tenemos. */
  DISPONIBLE: "DISPONIBLE",

  /*
    Existe via oficial pero exige un permiso que no tenemos:
    revision de app, consentimiento del titular, programa de
    investigacion.
  */
  REQUIERE_AUTORIZACION: "REQUIERE_AUTORIZACION",

  /* No existe via oficial para este alcance. */
  NO_DISPONIBLE: "NO_DISPONIBLE",

  /* Solo con un proveedor de datos con licencia. */
  REQUIERE_PROVEEDOR_EXTERNO: "REQUIERE_PROVEEDOR_EXTERNO"
});


export const VERIFICACION = Object.freeze({
  MEDIDO_EN_PRODUCCION: "MEDIDO_EN_PRODUCCION",
  DOCUMENTADO: "DOCUMENTADO",
  NO_VERIFICADO: "NO_VERIFICADO"
});


export const ALCANCES = Object.freeze({
  PROPIA: "CUENTA_PROPIA_O_AUTORIZADA",
  TERCERO: "CUENTA_DE_TERCERO"
});


/*
-----------------------------------------------------------
SOBRE QUE SE MIDIO — META-IG-REAL-01

La distincion que hizo falta el dia que Instagram funciono.

`vocero593_` devolvio perfil, publicaciones e insights sin un
fallo. Con la matriz anterior, eso habria puesto a Instagram en
MEDIDO y lo habria dejado entrar al benchmark multicandidato.

Y habria sido falso: se midio NUESTRA cuenta. Ninguno de los
siete candidatos nos va a dar un token.

    MEDIDO_PROPIO    funciona sobre una cuenta que administramos
    MEDIDO_TERCERO   funciona sobre una cuenta que no controlamos

Solo la segunda sirve para Candidate Intelligence.
-----------------------------------------------------------
*/
export const ALCANCE_MEDICION = Object.freeze({
  PROPIA: "PROPIA",
  TERCERO: "TERCERO"
});


/*
-----------------------------------------------------------
QUE FALTA EXACTAMENTE — SOCIAL-PROVIDER-EVAL-01
-----------------------------------------------------------

`estado` dice si existe via oficial. Esto dice que hace falta
para recorrerla, que es una pregunta distinta y la que decide si
el siguiente paso lo da una persona, un pago o un proveedor.

La distincion importa porque «requiere autorizacion» se usa para
dos cosas que no se parecen:

    APP_REVIEW              nuestra app pasa una revision
    AUTORIZACION_TITULAR    el sujeto observado nos da permiso

La primera es trabajo nuestro y se puede hacer. La segunda es
imposible en inteligencia electoral: el objetivo no va a
autorizar que lo observemos.
-----------------------------------------------------------
*/
export const REQUISITOS = Object.freeze({
  NINGUNO: "NINGUNO",

  /* Clave de API y nada mas. */
  CREDENCIAL: "CREDENCIAL",

  /* Revision de la app por la plataforma. Trabajo nuestro. */
  APP_REVIEW: "APP_REVIEW",

  /* Verificacion de empresa ante la plataforma. */
  BUSINESS_VERIFICATION: "BUSINESS_VERIFICATION",

  /* El titular observado tiene que dar permiso. Inviable aqui. */
  AUTORIZACION_TITULAR: "AUTORIZACION_TITULAR",

  /* Programa de investigacion con elegibilidad restringida. */
  PROGRAMA_INVESTIGACION: "PROGRAMA_INVESTIGACION",

  /* Existe y esta detras de un plan de pago. */
  PLAN_PAGO: "PLAN_PAGO",

  /*
    Existe, la credencial vale y el acceso esta cerrado por
    facturacion. Es distinto de PLAN_PAGO: alli falta elegir un
    plan; aqui el plan ya existe y falta saldo.

    Medido en X-REAL-01: HTTP 402 Payment Required.
  */
  CREDITOS: "CREDITOS",

  /* Solo por proveedor de datos con licencia. */
  PROVEEDOR: "PROVEEDOR"
});


/*
-----------------------------------------------------------
LA ETIQUETA DE CELDA

Los siete estados de la matriz de salida. Se DERIVAN de
`estado` + `verificacion` + `requisito`; no son un campo aparte
que alguien pueda dejar desincronizado.
-----------------------------------------------------------
*/
export const ESTADOS_CELDA = Object.freeze({
  /*
    Medido sobre una cuenta que NO controlamos. Es el unico que
    habilita el benchmark multicandidato.
  */
  MEDIDO: "MEDIDO_TERCERO",

  /*
    Medido, pero sobre una cuenta propia. Prueba que la
    integracion funciona; no prueba que sirva para observar a un
    candidato.
  */
  MEDIDO_PROPIO: "MEDIDO_PROPIO",

  REQUIERE_BUSINESS_VERIFICATION: "REQUIERE_BUSINESS_VERIFICATION",
  OFICIAL_DISPONIBLE: "OFICIAL_DISPONIBLE",
  REQUIERE_AUTORIZACION: "REQUIERE_AUTORIZACION",
  REQUIERE_APP_REVIEW: "REQUIERE_APP_REVIEW",
  REQUIERE_PLAN_PAGO: "REQUIERE_PLAN_PAGO",
  REQUIERE_PROVEEDOR: "REQUIERE_PROVEEDOR",
  NO_DISPONIBLE: "NO_DISPONIBLE",

  /*
    X-REAL-01. La credencial vale y falta saldo: comprobado con
    una llamada real que devolvio 402.
  */
  REQUIERE_CREDITOS: "REQUIERE_CREDITOS",

  /*
    Se infiere que esta cerrado por lo mismo, pero NO se
    intento. Es la diferencia entre «lo probamos y fallo» y «no
    llegamos a probarlo», y merece etiqueta propia: sin ella,
    una inferencia razonable se leeria como una medicion.
  */
  NO_PROBADO: "NO_PROBADO"
});


export function celdaDe(cap) {
  if (!cap) return ESTADOS_CELDA.NO_DISPONIBLE;

  if (cap.estado === ESTADOS_CAPACIDAD.NO_DISPONIBLE) {
    return ESTADOS_CELDA.NO_DISPONIBLE;
  }

  if (cap.estado === ESTADOS_CAPACIDAD.REQUIERE_PROVEEDOR_EXTERNO) {
    return ESTADOS_CELDA.REQUIERE_PROVEEDOR;
  }

  /*
    Disponible, pero el requisito puede moverla. Una capacidad
    que existe y esta detras de un plan NO es lo mismo que una
    que ya funciona.
  */
  if (cap.estado === ESTADOS_CAPACIDAD.DISPONIBLE) {
    /*
      Cerrado por saldo. Se distingue lo COMPROBADO de lo
      inferido: solo se llama REQUIERE_CREDITOS lo que se
      intento de verdad.
    */
    if (cap.requisito === REQUISITOS.CREDITOS) {
      return cap.verificacion === VERIFICACION.MEDIDO_EN_PRODUCCION
        ? ESTADOS_CELDA.REQUIERE_CREDITOS
        : ESTADOS_CELDA.NO_PROBADO;
    }

    if (cap.requisito === REQUISITOS.PLAN_PAGO) {
      return ESTADOS_CELDA.REQUIERE_PLAN_PAGO;
    }

    if (cap.requisito === REQUISITOS.APP_REVIEW) {
      return ESTADOS_CELDA.REQUIERE_APP_REVIEW;
    }

    if (cap.verificacion === VERIFICACION.MEDIDO_EN_PRODUCCION) {
      /*
        Medir la cuenta propia NO es medir a un candidato. La
        etiqueta lo separa para que nadie meta una plataforma al
        benchmark por haber probado con su propia cuenta.
      */
      return cap.alcanceMedicion === ALCANCE_MEDICION.PROPIA
        ? ESTADOS_CELDA.MEDIDO_PROPIO
        : ESTADOS_CELDA.MEDIDO;
    }

    /*
      Existe, tenemos con que pedirlo y NO se pidio. Distinto de
      OFICIAL_DISPONIBLE, que se reserva para lo que solo consta
      en la documentacion de una plataforma que no hemos tocado.
      Aqui el acceso funciona y esta capacidad concreta sigue sin
      comprobarse.
    */
    if (cap.verificacion === VERIFICACION.NO_VERIFICADO) {
      return ESTADOS_CELDA.NO_PROBADO;
    }

    return ESTADOS_CELDA.OFICIAL_DISPONIBLE;
  }

  /* REQUIERE_AUTORIZACION: depende de QUIEN tiene que autorizar. */
  if (cap.requisito === REQUISITOS.BUSINESS_VERIFICATION) {
    return ESTADOS_CELDA.REQUIERE_BUSINESS_VERIFICATION;
  }

  if (cap.requisito === REQUISITOS.APP_REVIEW) {
    return ESTADOS_CELDA.REQUIERE_APP_REVIEW;
  }

  if (cap.requisito === REQUISITOS.PLAN_PAGO) {
    return ESTADOS_CELDA.REQUIERE_PLAN_PAGO;
  }

  if (cap.requisito === REQUISITOS.PROVEEDOR) {
    return ESTADOS_CELDA.REQUIERE_PROVEEDOR;
  }

  return ESTADOS_CELDA.REQUIERE_AUTORIZACION;
}


/*
  Las capacidades que Candidate Intelligence necesita. Son las
  mismas para todas las plataformas: es lo que permite una sola
  matriz y un solo contrato.
*/
export const CAPACIDADES = Object.freeze([
  { id: "identidad", nombre: "Identidad de la cuenta" },
  { id: "cuenta", nombre: "Metadatos de la cuenta" },
  { id: "followers", nombre: "Seguidores o suscriptores" },
  { id: "publicaciones", nombre: "Listado de publicaciones" },
  { id: "views", nombre: "Visualizaciones" },
  { id: "likes", nombre: "Me gusta o reacciones" },
  { id: "comments", nombre: "Comentarios (recuento)" },
  { id: "shares", nombre: "Compartidos o republicaciones" },
  { id: "menciones", nombre: "Menciones de terceros" },
  { id: "busqueda", nombre: "Busqueda" },
  { id: "historico", nombre: "Historico entregado por la fuente" },
  { id: "url_verificable", nombre: "URL canonica verificable" }
]);


/*
  `requisito` es opcional: si no se declara, se deduce del
  estado. Una capacidad disponible sin requisito explicito solo
  necesita la credencial; una que exige autorizacion sin decir de
  quien se asume del titular, que es el caso peor y por tanto el
  que no conviene suponer a la ligera.
*/
const c = (estado, verificacion, nota, requisito = null, alcance = null) => ({
  estado,
  verificacion,
  nota,

  /*
    Sobre que se midio. Solo tiene sentido cuando la verificacion
    es MEDIDO_EN_PRODUCCION; por defecto se asume TERCERO, que es
    el caso de YouTube y X.
  */
  alcanceMedicion:
    alcance ||
    (verificacion === VERIFICACION.MEDIDO_EN_PRODUCCION
      ? ALCANCE_MEDICION.TERCERO
      : null),
  requisito:
    requisito ||
    (estado === ESTADOS_CAPACIDAD.DISPONIBLE
      ? REQUISITOS.CREDENCIAL
      : estado === ESTADOS_CAPACIDAD.REQUIERE_AUTORIZACION
        ? REQUISITOS.AUTORIZACION_TITULAR
        : estado === ESTADOS_CAPACIDAD.REQUIERE_PROVEEDOR_EXTERNO
          ? REQUISITOS.PROVEEDOR
          : REQUISITOS.NINGUNO)
});

const DISP = ESTADOS_CAPACIDAD.DISPONIBLE;
const AUTZ = ESTADOS_CAPACIDAD.REQUIERE_AUTORIZACION;
const NOPE = ESTADOS_CAPACIDAD.NO_DISPONIBLE;
const PROV = ESTADOS_CAPACIDAD.REQUIERE_PROVEEDOR_EXTERNO;

const MEDIDO = VERIFICACION.MEDIDO_EN_PRODUCCION;

const NOVER = VERIFICACION.NO_VERIFICADO;
const DOC = VERIFICACION.DOCUMENTADO;


/*
===========================================================
YOUTUBE

La unica plataforma con capacidad MEDIDA. Ver §18-duovicies del
estado del proyecto: se ejecuto contra la API real.
===========================================================
*/
const YOUTUBE = {
  plataformaId: "youtube",
  plataforma: "YouTube",

  apiOficial: "YouTube Data API v3",
  credencial: "YOUTUBE_API_KEY",
  terceros: true,
  autorizacionDelTitular: false,

  notaAlcance:
    "Es la excepcion del grupo: la API entrega datos publicos de canales de TERCEROS sin que el titular autorice nada. Por eso es la unica plataforma donde Candidate Intelligence funciona hoy de verdad.",

  capacidades: {
    identidad: c(DISP, MEDIDO, "channels.list?forHandle resuelve handle -> channelId, 1 unidad"),
    cuenta: c(DISP, MEDIDO, "snippet: titulo, descripcion, fecha de creacion, pais declarado"),
    followers: c(
      DISP,
      MEDIDO,
      "subscriberCount. Puede venir oculto por decision del canal: hiddenSubscriberCount"
    ),
    publicaciones: c(
      DISP,
      MEDIDO,
      "playlistItems.list sobre la lista de subidas, 1 unidad. Es lo que el canal subio, no lo que un buscador considera relevante"
    ),
    views: c(DISP, MEDIDO, "videos.list?part=statistics -> viewCount"),
    likes: c(
      DISP,
      MEDIDO,
      "likeCount. Desaparece del payload si el canal lo oculta: eso no es cero"
    ),
    comments: c(
      DISP,
      MEDIDO,
      "commentCount. Desaparece si el canal desactiva comentarios. Solo el RECUENTO: no se leen comentarios individuales"
    ),
    shares: c(NOPE, DOC, "la API no expone compartidos por video en ningun part"),
    menciones: c(
      DISP,
      DOC,
      "search.list encuentra videos que nombran al candidato. Cuesta 100 unidades de las 10.000 diarias: viable con presupuesto, no por defecto",
      REQUISITOS.CREDENCIAL
    ),
    busqueda: c(DISP, MEDIDO, "search.list, 100 unidades: 100 consultas agotan el dia"),
    historico: c(
      NOPE,
      DOC,
      "la API devuelve el valor de AHORA. La serie temporal la construye Sentinel con snapshots; no la entrega YouTube"
    ),
    url_verificable: c(DISP, MEDIDO, "youtube.com/watch?v=ID es canonica")
  }
};


/*
===========================================================
TIKTOK

Prioridad alta y la peor situacion del grupo para terceros.
===========================================================
*/
const TIKTOK = {
  plataformaId: "tiktok",
  plataforma: "TikTok",

  apiOficial: "TikTok Display API / Research API",
  credencial: null,
  terceros: false,
  autorizacionDelTitular: true,

  notaAlcance:
    "La Display API opera sobre la cuenta que INICIA SESION y autoriza: sirve para que un creador vea sus propios datos, no para observar a un candidato. La Research API si cubre terceros, pero su acceso se concede por solicitud y esta orientado a investigacion academica con afiliacion institucional.",

  /*
    TRES APIS Y NINGUNA SIRVE, y conviene saber por que cada una:

      Display API            opera sobre la cuenta que INICIA
                             SESION. Sirve para que un creador vea
                             sus propios datos.
      Research API           si cubre terceros, y su elegibilidad
                             esta orientada a investigacion
                             academica sin animo de lucro. Un
                             producto comercial no encaja en el
                             perfil.
      Commercial Content API biblioteca de contenido comercial y
                             anuncios. No da metricas organicas de
                             una cuenta.

    Es la unica plataforma del grupo donde el problema no es un
    permiso que se pueda pedir ni un plan que se pueda pagar: es
    que el caso de uso no encaja en ningun programa. De ahi que la
    respuesta sea proveedor.
  */
  apisEvaluadas: [
    {
      id: "display_api",
      cubreTerceros: false,
      motivo:
        "opera sobre la cuenta que inicia sesion y autoriza por OAuth. El candidato tendria que darnos acceso a su cuenta"
    },
    {
      id: "research_api",
      cubreTerceros: true,
      motivo:
        "cubre terceros, pero su elegibilidad esta orientada a investigacion academica sin animo de lucro. Sentinel es un producto comercial: NO se asume que podamos solicitarla ni usarla"
    },
    {
      id: "commercial_content_api",
      cubreTerceros: true,
      motivo:
        "solo contenido comercial y publicitario. No entrega metricas organicas de las publicaciones de una cuenta"
    }
  ],

  programasDeAcceso: [
    "Ninguno aplicable a un producto comercial que observa a terceros.",
    "La via realista es un proveedor con licencia: ver TIKTOK-PROVIDER-EVAL-01."
  ],

  capacidades: {
    identidad: c(
      DISP,
      DOC,
      "el handle se lee de la URL publica con SD-1A, sin API. Identifica la cuenta; no da ningun dato de ella"
    ),
    cuenta: c(PROV, DOC, "Display API exige el login del titular; Research API no es elegible"),
    followers: c(PROV, DOC, "sin via oficial para terceros en un uso comercial"),
    publicaciones: c(PROV, DOC, "idem"),
    views: c(PROV, DOC, "idem"),
    likes: c(PROV, DOC, "idem"),
    comments: c(PROV, DOC, "idem"),
    shares: c(PROV, DOC, "idem"),
    menciones: c(PROV, DOC, "no hay busqueda publica por API"),
    busqueda: c(NOPE, DOC, "sin endpoint de busqueda publica para terceros"),
    historico: c(NOPE, DOC, "ninguna via entrega serie temporal"),
    url_verificable: c(
      DISP,
      DOC,
      "tiktok.com/@handle/video/ID es canonica y se puede construir sin API"
    )
  },

  rutaConcreta: [
    "Solicitar acceso a la Research API declarando el uso. Requiere afiliacion y aprobacion, y su ambito es academico.",
    "O bien contratar un proveedor con licencia: ver TIKTOK-PROVIDER-EVAL-01."
  ]
};


/*
===========================================================
CORPUS DE COMENTARIOS — PREPARACION, NO IMPLEMENTACION
===========================================================

Sentinel querra algun dia responder «analiza los comentarios
que recibio este candidato en las ultimas 24 horas». Antes de
escribir una linea de analisis hay que saber si el corpus se
puede obtener, porque el resto depende de eso.

Y hay una obligacion de lenguaje que nace aqui, no cuando se
implemente el analisis:

    COMENTARIOS OBSERVADOS  !=  TODOS LOS COMENTARIOS

Ninguna fuente garantiza cobertura total. Un corpus paginado,
con limites de rate y sin archivo historico, es una muestra —y
una muestra sobre la que se dice «los comentarios dicen X» es
una afirmacion falsa sobre el universo.
===========================================================
*/
export const ESTADOS_COMENTARIOS = Object.freeze({
  /* Se obtuvo texto real de comentarios de un tercero. */
  DISPONIBLE: "COMMENTS_AVAILABLE",

  /* Se obtuvo algo, pero no el contrato minimo. */
  PARCIAL: "COMMENTS_PARTIAL",

  /* Se pidio y la fuente no lo entrega. */
  NO_DISPONIBLE: "COMMENTS_NOT_AVAILABLE",

  /* Se pidio y un bloqueo lo impidio. */
  BLOQUEADO: "COMMENTS_BLOCKED",

  /*
    No se pidio. Distinto de NO_DISPONIBLE, y la diferencia
    importa: uno es una medicion y el otro una casilla vacia.
  */
  NO_PROBADO: "COMMENTS_NOT_TESTED"
});


/*
===========================================================
FACEBOOK
===========================================================
*/
const FACEBOOK = {
  plataformaId: "facebook",
  plataforma: "Facebook",

  apiOficial: "Meta Graph API",
  credencial: null,
  terceros: false,
  autorizacionDelTitular: true,

  notaAlcance:
    "Graph API distingue PAGINA de PERFIL. Los datos de una pagina se obtienen con un token de acceso de esa pagina, que solo tiene su administrador; los perfiles personales no son accesibles de ningun modo. El error habitual es leer «se puede consultar paginas publicas» como «cualquiera puede consultar cualquier pagina»: hace falta el token del titular.",

  /*
    HAY UNA VIA PARA TERCEROS Y CONVIENE NO CONFUNDIRLA CON LAS
    OTRAS: `Page Public Content Access`.

    Es un permiso que permite leer contenido publico de paginas
    que NO administramos. No lo autoriza el titular de la pagina:
    lo concede Meta a la app, tras App Review y verificacion de
    empresa. Historicamente su concesion es restrictiva y depende
    del caso de uso declarado.

    Los PERFILES personales quedan fuera de todo: no hay permiso
    que los abra.
  */
  endpoints: {
    pagina: "GET /{page-id}?fields=id,name,fan_count,link",
    publicaciones:
      "GET /{page-id}/posts?fields=id,created_time,permalink_url,message (requiere PPCA)",
    resumenes:
      "GET /{post-id}?fields=comments.summary(true),reactions.summary(true),shares"
  },

  autenticacion:
    "Token de app con Page Public Content Access para terceros; token de la pagina si es propia.",

  viaOficialTerceros: {
    existe: true,
    feature: "Page Public Content Access",
    estado: "vigente: no aparece deprecado ni renombrado",

    accesoRequerido: "Advanced Access",
    appReview: true,
    businessVerification: true,

    casoDeUsoAdmitido:
      "analizar o mostrar publicaciones e interaccion en Paginas: Meta lo lista explicitamente",

    enModoDesarrollo:
      "solo alcanza Paginas de administradores, desarrolladores o testers de la app",

    perfilPersonal: {
      alcanzable: false,
      motivo:
        "ninguna via oficial abre un perfil personal de Facebook. Y el candidato patron tiene perfil, no Pagina."
    },

    devuelveDeTerceros: [
      "identidad y nombre de la Pagina",
      "fan_count",
      "posts / feed",
      "videos",
      "comentarios publicos"
    ],

    noDevuelveDeTerceros: [
      "reacciones y shares: no documentados como accesibles por PPCA",
      "reels: no documentado",
      "video views e insights: son PAGE-ADMIN DATA, exigen token de administrador",
      "cualquier campo que incluya informacion de usuarios exige Page access token"
    ],

    documentado: "2026-08-28",
    fuente: "docs/META-PUBLIC-ACCESS.md"
  },

  /*
    -----------------------------------------------------------
    MEDICION REAL — META-THIRD-PARTY-REAL-01 (2026-08-30)
    -----------------------------------------------------------

    Hasta este gate, todo lo de arriba era documental. Ahora hay
    una llamada.

    Se eligio la peticion mas simple que responde a la pregunta
    —leer una Page por su nombre de vanidad— sobre un activo real
    de tercero que el analista habia declarado FACEBOOK_PAGE. Si
    algo falla en la llamada mas simple, falla por la razon
    estructural y no por la complejidad de la peticion.

        GET graph.facebook.com/v23.0/{page}
            ?fields=id,name,username,followers_count,fan_count

        HTTP 400 · code 190 · OAuthException
        «Invalid OAuth access token - Cannot parse access token»

    LO QUE ESTA DEMOSTRADO: no tenemos credencial para este host.
    El unico token configurado es de Instagram Login, y
    `graph.facebook.com` no lo entiende.

    LO QUE NO ESTA DEMOSTRADO, y es lo que se sobreinterpreta:
    que haga falta App Review o Business Verification. Este error
    no llega a evaluar permisos —se detiene antes, al parsear la
    credencial—, asi que sobre permisos no dice nada.

    El control que lo hace legible: en la misma sesion, la
    llamada anterior a `graph.instagram.com/me` devolvio 200 con
    ese mismo token. La credencial esta viva; el host es otro.

    Sin este matiz, «Invalid OAuth access token» manda a
    regenerar el token, que es exactamente lo que no hay que
    hacer.
    -----------------------------------------------------------
  */
  medicionReal: {
    gate: "META-THIRD-PARTY-REAL-01",
    fecha: "2026-08-30",
    requests: 1,
    reintentos: 0,

    activoProbado:
      "Page de tercero declarada FACEBOOK_PAGE por el analista",

    endpoints: [
      {
        endpoint: "GET graph.facebook.com/{page}?fields=id,name,username,followers_count,fan_count",
        httpStatus: 400,
        codigoMeta: 190,
        tipo: "OAuthException"
      }
    ],

    conclusion: "BLOQUEADO_PERMISOS",

    causaDemostrada:
      "no hay token de Facebook Login configurado. graph.facebook.com no acepta el token de Instagram Login, que es el unico que existe.",

    noDemostrado: [
      "que haga falta App Review: el error se detiene antes de evaluar permisos",
      "que haga falta Business Verification, por lo mismo",
      "que la Page no sea publica o no exista"
    ],

    controlDeLaMismaSesion:
      "GET graph.instagram.com/me devolvio 200 con el mismo token en la llamada anterior. No es una credencial invalida: es un host distinto.",

    /*
      -----------------------------------------------------------
      META-THIRD-PARTY-REAL-02 (2026-08-30)
      -----------------------------------------------------------

      Con la credencial correcta, el bloqueo cambio de sitio y
      por fin dice algo util. Dos llamadas, dos sujetos
      distintos, y ahi esta todo:

          Page que ADMINISTRAMOS       HTTP 200
          Page de un TERCERO           HTTP 400 · code 100

      La primera devolvio id, name, username, link, fan_count y
      followers_count. Parece un exito y no lo es: funciono
      porque el token administra esa Pagina. Es el comportamiento
      documentado de Standard Access, ahora medido.

      La segunda trae el diagnostico entero en el mensaje de
      Meta, con las tres alternativas nombradas. Ya no hay que
      deducirlo.
      -----------------------------------------------------------
    */
    etapaB: {
      gate: "META-THIRD-PARTY-REAL-02",
      fecha: "2026-08-30",

      sobrePaginaPropia: {
        resultado: "MEDIDO_PROPIO",
        httpStatus: 200,
        campos: ["id", "name", "username", "link", "fan_count", "followers_count", "is_published", "verification_status"],
        advertencia:
          "funciono porque el token administra esta Pagina. NO es acceso a terceros y no debe leerse como tal."
      },

      sobrePaginaDeTercero: {
        resultado: "BLOQUEADO_PERMISOS",
        httpStatus: 400,
        codigoMeta: 100,
        tipo: "OAuthException",

        mensaje:
          "Object does not exist, cannot be loaded due to missing permission or reviewable feature, or does not support this operation. This endpoint requires the 'pages_read_engagement' permission or the 'Page Public Content Access' feature or the 'Page Public Metadata Access' feature.",

        /*
          Meta nombra TRES alternativas, no una. Cualquiera de
          las tres abriria la lectura, y no son igual de caras.
        */
        alternativasQueMetaNombra: [
          "permiso pages_read_engagement",
          "feature Page Public Content Access",
          "feature Page Public Metadata Access"
        ],

        causaDemostrada:
          "faltan permisos o features sobre Paginas que no administramos. Esto SI lo dice Meta: el error llega a evaluar permisos y los enumera.",

        noDemostrado: [
          "cual de las tres alternativas es la mas barata de conseguir",
          "que Business Verification sea obligatoria: el error no la menciona"
        ]
      }
    },

    siguientePasoQueSI: [
      "elegir UNA de las tres alternativas que Meta nombra",
      "Page Public Metadata Access es la mas pequena de las tres segun su propio nombre, y no consta su coste",
      "reintentar esta misma llamada sobre la Page de un tercero"
    ]
  },

  /*
    Comentarios: NO SE PIDIERON. La lectura de la Page se
    detuvo en la credencial, asi que no habia publicacion sobre
    la que preguntar. Documentar «no disponible» seria inventar
    una medicion que no se hizo.
  */
  comentarios: {
    estado: "COMMENTS_NOT_TESTED",
    gate: "META-THIRD-PARTY-REAL-02",

    motivo:
      "no se llego a pedir sobre un tercero: la lectura de su Page fallo antes, por permisos. Sobre la Page que administramos, /posts devolvio 400 code 190 subcode 2069032, que apunta a que ese borde exige un Page access token y no un User token.",

    bloqueoAguasArriba: "BLOQUEADO_PERMISOS en la lectura de la Page de tercero",

    loQueDiceLaDocumentacion:
      "Page Public Content Access lista los comentarios publicos entre lo que devuelve de terceros. Es documentacion, no medicion.",

    seProbaraCuando: "exista un token de Facebook Login for Business"
  },

  programasDeAcceso: [
    "Meta for Developers: crear app y solicitar App Review del permiso Page Public Content Access.",
    "Business Verification de la empresa.",
    "Meta Content Library, sucesora de CrowdTangle, para investigacion: elegibilidad restringida a instituciones academicas.",
    "Los perfiles personales no son accesibles por ninguna via."
  ],

  capacidades: {
    identidad: c(DISP, DOC, "la URL publica identifica la pagina o el perfil, sin API"),
    cuenta: c(
      DISP,
      DOC,
      "metadata publica de la pagina —titulo, og:image— legible sin API. Ninguna metrica"
    ),
    followers: c(
      AUTZ,
      DOC,
      "fan_count. Con PPCA para paginas de terceros; su disponibilidad varia",
      REQUISITOS.APP_REVIEW
    ),
    publicaciones: c(
      AUTZ,
      DOC,
      "/posts con Page Public Content Access. Es la unica via oficial a publicaciones de una pagina ajena",
      REQUISITOS.APP_REVIEW
    ),
    views: c(
      AUTZ,
      DOC,
      "las metricas de video son insights de pagina y exigen token de la pagina: no hay via para terceros",
      REQUISITOS.AUTORIZACION_TITULAR
    ),
    likes: c(
      AUTZ,
      DOC,
      "reactions.summary(true) sobre un post, con PPCA",
      REQUISITOS.APP_REVIEW
    ),
    comments: c(AUTZ, DOC, "comments.summary(true), con PPCA", REQUISITOS.APP_REVIEW),
    shares: c(AUTZ, DOC, "campo shares del post, con PPCA", REQUISITOS.APP_REVIEW),
    menciones: c(
      AUTZ,
      DOC,
      "Meta Content Library. Elegibilidad academica: no es una via para un producto comercial",
      REQUISITOS.PROGRAMA_INVESTIGACION
    ),
    busqueda: c(NOPE, DOC, "sin busqueda publica por API"),
    historico: c(NOPE, DOC, "ninguna via entrega serie temporal"),
    url_verificable: c(DISP, DOC, "permalink_url del post es canonica")
  },

  rutaConcreta: [
    "Si el candidato es cliente: pedirle un token de su pagina. Legitimo, y solo sirve para el.",
    "Para observar a un tercero: solicitar acceso a Meta Content Library, o proveedor con licencia (FACEBOOK-PROVIDER-EVAL-01)."
  ]
};


/*
===========================================================
INSTAGRAM
===========================================================
*/
const INSTAGRAM = {
  plataformaId: "instagram",
  plataforma: "Instagram",

  apiOficial: "Instagram Graph API",
  credencial: null,
  terceros: false,
  autorizacionDelTitular: true,

  notaAlcance:
    "Exige cuenta profesional vinculada a una pagina de Facebook Y el token del titular. Existe `business_discovery`, que permite a una cuenta profesional consultar datos publicos de OTRA cuenta profesional: es el unico resquicio real para terceros, y sigue necesitando una cuenta profesional propia con app revisada por Meta.",

  /*
    -----------------------------------------------------------
    MEDIDO EN META-IG-REAL-01 (2026-08-28)
    -----------------------------------------------------------

    Cuatro llamadas reales con la app «Sentinel Intelligence» y
    la cuenta profesional propia `vocero593_`.

    ETAPA A — todo funciono:

        GET graph.instagram.com/v23.0/me            200
        GET graph.instagram.com/v23.0/me/media      200
        GET graph.instagram.com/v23.0/{id}/insights 200

    Perfil completo, cinco publicaciones con permalink y
    timestamp, y los cinco insights pedidos —reach, saved,
    shares, total_interactions, views— devueltos sin excepcion.

    ETAPA B — bloqueada:

        GET graph.facebook.com/v23.0/{ig}?business_discovery
        400, codigo 190, «Cannot parse access token»

    Y aqui esta lo que importa: el mismo token acababa de
    funcionar. No es una credencial invalida —eso mandaria a
    regenerarla, y seria perder el tiempo—: es un token de
    Instagram Login pedido a un host que solo entiende los de
    Facebook Login.

    CONCLUSION. Instagram esta MEDIDO_PROPIO y NO_PROBADO para
    terceros. Que nuestra cuenta funcione entera no acerca ni un
    paso a observar la de un candidato.
    -----------------------------------------------------------
  */
  medicionReal: {
    gate: "META-IG-REAL-01",
    fecha: "2026-08-28",
    cuentaProbada: "cuenta profesional propia",
    requests: 4,
    reintentos: 0,

    etapaA: {
      resultado: "APROBADO",
      endpoints: [
        { endpoint: "GET graph.instagram.com/me", httpStatus: 200 },
        { endpoint: "GET graph.instagram.com/me/media", httpStatus: 200 },
        { endpoint: "GET graph.instagram.com/{id}/insights", httpStatus: 200 }
      ],
      publicMetrics: ["like_count", "comments_count"],
      ownerInsights: ["reach", "saved", "shares", "total_interactions", "views"]
    },

    etapaB: {
      resultado: "BLOQUEADO",
      endpoint: "GET graph.facebook.com/{ig}?business_discovery",
      httpStatus: 400,
      codigoMeta: 190,
      causa:
        "token de Instagram Login enviado a un host que solo acepta Facebook Login",
      noEs: "no es una credencial invalida: la misma acababa de funcionar",
      requisitoFaltante: [
        "Facebook Login for Business",
        "pagina de Facebook vinculada",
        "App Review de instagram_basic e instagram_manage_insights",
        "Business Verification"
      ]
    },

    conclusion: "MEDIDO_TERCERO",

    /*
      -----------------------------------------------------------
      META-THIRD-PARTY-REAL-02 (2026-08-30)
      -----------------------------------------------------------

      Con un token de Facebook Login for Business,
      `business_discovery` FUNCIONA sobre una cuenta profesional
      de tercero. Medido, no leido.

          GET graph.facebook.com/v23.0/{nuestro_ig_id}
              ?fields=business_discovery.username(OBJETIVO){...}

          HTTP 200

      Volvieron: username, name, followers_count, media_count y
      cinco publicaciones con id, permalink, timestamp,
      media_type, like_count y comments_count.

      EL PRIMER INTENTO SALIO CONTAMINADO, Y CONVIENE QUE CONSTE.

      El objetivo elegido era el activo del candidato patron, y
      la llamada de prerequisito —`me/accounts`— revelo que el
      token ADMINISTRA esa Pagina y su Instagram vinculado. Es
      decir: la primera consulta le pregunto a nuestra propia
      cuenta por si misma. Devolvio datos reales y no demostraba
      nada sobre terceros.

      Se repitio contra una cuenta profesional de OTRO candidato,
      que no aparece en `me/accounts`. Esa es la que sostiene
      esta conclusion.

      La leccion no es sobre Meta: es que un resultado positivo
      con el sujeto equivocado se lee igual que un exito. Sin la
      llamada de prerequisito, este gate habria declarado
      MEDIDO_TERCERO con evidencia de MEDIDO_PROPIO.
      -----------------------------------------------------------
    */
    etapaD: {
      gate: "META-THIRD-PARTY-REAL-02",
      fecha: "2026-08-30",
      resultado: "MEDIDO_TERCERO",
      endpoint: "GET graph.facebook.com/{ig}?fields=business_discovery.username()",
      httpStatus: 200,

      terceroGenuino: true,
      comoSeComprobo:
        "el objetivo NO aparece en me/accounts, asi que no es un activo que administremos",

      camposObtenidos: [
        "username",
        "name",
        "followers_count",
        "media_count",
        "media: id, permalink, timestamp, media_type",
        "like_count por publicacion",
        "comments_count por publicacion"
      ],

      camposQueNoVolvieron: [
        "follows_count",
        "view_count: no vino en la muestra",
        "reach, impressions, saved, shares: son OWNER_INSIGHT y no se pidieron"
      ],

      contaminacionDelPrimerIntento:
        "el primer objetivo era el activo del candidato patron y el token administra su Pagina: la consulta fue sobre nuestro propio activo. Se descarto y se repitio contra otro candidato.",

      /*
        Lo que la documentacion decia y la medicion no confirma.
        No se corrige la documentacion: se registra la
        discrepancia, que es un dato.
      */
      discrepanciaConLaDocumentacion:
        "META-PUBLIC-ACCESS-01 documento que terceros exigen Advanced Access y Business Verification. La llamada funciono sin que consten concedidos. Lo medido es que funciona; POR QUE funciona no esta demostrado, y no conviene deducirlo."
    },

    /*
      -----------------------------------------------------------
      META-THIRD-PARTY-REAL-01 (2026-08-30)
      -----------------------------------------------------------

      META-IG-REAL-01 dejo abierta una duda razonable: el error
      190 contra `graph.facebook.com` podia estar tapando otra
      cosa, y no se habia probado si el host que SI acepta
      nuestro token expone `business_discovery`.

      Ya esta probado, sobre un activo real de tercero declarado
      INSTAGRAM_PROFESSIONAL por el analista:

          GET graph.instagram.com/v23.0/{nuestro_id}
              ?fields=business_discovery.username(...)

          HTTP 400 · code 100
          «Tried accessing nonexisting field (business_discovery)»

      Eso no es un permiso que falte ni un nivel de acceso: el
      campo NO EXISTE en ese host. La via de Instagram Login no
      tiene descubrimiento de terceros, y ninguna combinacion de
      permisos sobre este token lo va a producir.

      Es una respuesta mejor que un 403: cierra la pregunta.
      -----------------------------------------------------------
    */
    etapaC: {
      gate: "META-THIRD-PARTY-REAL-01",
      fecha: "2026-08-30",
      resultado: "NO_SOPORTADO_POR_FLUJO_ACTUAL",
      endpoint: "GET graph.instagram.com/{id}?fields=business_discovery.username()",
      httpStatus: 400,
      codigoMeta: 100,
      mensaje: "Tried accessing nonexisting field (business_discovery)",

      activoProbado:
        "Instagram de tercero declarado INSTAGRAM_PROFESSIONAL por el analista",

      causaDemostrada:
        "el campo business_discovery no existe en graph.instagram.com. La via de Instagram Login no descubre terceros.",

      /*
        Lo que el error NO demuestra. Se escribe porque es
        exactamente lo que se sobreinterpreta: un 400 no dice
        que haga falta App Review.
      */
      noDemostrado: [
        "que App Review resolveria esto",
        "que Business Verification resolveria esto",
        "que la cuenta del tercero no sea profesional"
      ],

      controlDeLaMismaSesion:
        "GET graph.instagram.com/me devolvio 200 en la llamada anterior, asi que el token estaba vivo. El fallo es del campo, no de la credencial."
    },

    advertencia:
      "Medir la cuenta propia no habilita el benchmark multicandidato. Los insights son OWNER_INSIGHT y no existirian para el Instagram de un candidato.",

    noSeProbo: [
      "REELS: las cinco publicaciones de la muestra eran IMAGE, asi que las metricas propias de reel siguen sin comprobarse"
    ]
  },

  /*
    Comentarios de TERCEROS: no se pidieron, y no por falta de
    presupuesto. `business_discovery` es la unica via que traeria
    publicaciones de un tercero, y el campo no existe en el host
    que acepta nuestro token. Sin publicacion no hay a que
    pedirle comentarios.

    De la cuenta PROPIA si se podrian leer. No sirve para esto:
    los comentarios que recibe `vocero593_` no son los que recibe
    un candidato.
  */
  /*
    RECUENTO SI, TEXTO NO. Y la diferencia no es un matiz:
    `comments_count` dice cuantos, y con eso no se puede analizar
    ninguno.
  */
  comentarios: {
    estado: "COMMENTS_PARTIAL",
    gate: "META-THIRD-PARTY-REAL-02",

    recuentoDisponible: true,
    textoDisponible: false,

    motivo:
      "comments_count llega por publicacion del tercero. El TEXTO no: se pidio `comments{id,text,timestamp,username}` dentro de business_discovery.media y Meta respondio HTTP 400 code 100, «Please read documentation for supported fields».",

    medido: {
      endpoint: "GET graph.facebook.com/{ig}?fields=business_discovery.username(){media{comments{text}}}",
      httpStatus: 400,
      codigoMeta: 100,
      mensaje: "Please read documentation for supported fields"
    },

    /*
      Esto es una medicion, no una suposicion: se pidio y la ruta
      probada no lo entrega. Por eso NO_AVAILABLE aplica al
      TEXTO por esta via, y no a los comentarios en general.
    */
    textoPorEstaVia: "COMMENTS_NOT_AVAILABLE",

    noSeProbo: [
      "la arista /{ig-media-id}/comments directa sobre un media de tercero",
      "si algun permiso adicional la abre"
    ],

    obligacionDeLenguaje:
      "COMENTARIOS OBSERVADOS != TODOS LOS COMENTARIOS. Con solo el recuento no se puede afirmar nada sobre su contenido."
  },

  /*
    BUSINESS DISCOVERY ES LA PIEZA CLAVE, y conviene entender que
    autoriza y que no.

    NO necesita permiso del observado. Necesita que NOSOTROS
    tengamos una cuenta profesional propia, vinculada a una pagina
    de Facebook, con una app revisada por Meta. Y que la cuenta
    del objetivo sea PROFESIONAL (business o creator): las
    personales quedan fuera.

    Para un candidato con cuenta de campana, profesional es lo
    habitual. Para un perfil personal, no hay via.
  */
  endpoints: {
    businessDiscovery:
      "GET /{ig-user-id}?fields=business_discovery.username(OBJETIVO){username,name,followers_count,media_count,media{id,caption,like_count,comments_count,media_type,permalink,timestamp}}"
  },

  autenticacion:
    "Token de una cuenta profesional PROPIA con app revisada. El objetivo no interviene.",

  programasDeAcceso: [
    "Crear cuenta profesional de Instagram propia y vincularla a una pagina de Facebook.",
    "Crear app en Meta for Developers y solicitar App Review de instagram_basic y instagram_manage_insights.",
    "Business Verification de la empresa ante Meta.",
    "Solo cubre objetivos con cuenta PROFESIONAL."
  ],

  /*
    -----------------------------------------------------------
    ACTUALIZADO POR META-THIRD-PARTY-REAL-02 (2026-08-30)
    -----------------------------------------------------------

    Siete capacidades pasan de PROPIA a TERCERO. No por la
    documentacion: por una llamada a `business_discovery` sobre
    una cuenta profesional que NO administramos.

    Lo que volvio: username, name, followers_count, media_count y
    cinco publicaciones con id, permalink, timestamp, media_type,
    like_count y comments_count.

    `views` y `shares` se quedan en PROPIA, y no por prudencia:
    son OWNER_INSIGHT y no vinieron en la respuesta del tercero.
    Moverlas seria exactamente el error que la separacion
    PROPIO/TERCERO existe para evitar.
    -----------------------------------------------------------
  */
  capacidades: {
    identidad: c(
      DISP,
      MEDIDO,
      "MEDIDO SOBRE TERCERO: business_discovery devolvio username y name de una cuenta profesional que no administramos",
      REQUISITOS.CREDENCIAL,
      ALCANCE_MEDICION.TERCERO
    ),
    cuenta: c(
      DISP,
      MEDIDO,
      "MEDIDO SOBRE TERCERO. Responder ES la evidencia del tipo: business_discovery solo responde sobre cuentas profesionales",
      REQUISITOS.CREDENCIAL,
      ALCANCE_MEDICION.TERCERO
    ),
    followers: c(
      DISP,
      MEDIDO,
      "followers_count de un tercero, medido. `follows_count` NO vino en la respuesta del tercero",
      REQUISITOS.CREDENCIAL,
      ALCANCE_MEDICION.TERCERO
    ),
    publicaciones: c(
      DISP,
      MEDIDO,
      "media_count y una muestra de 5 publicaciones del tercero, con permalink, timestamp y media_type",
      REQUISITOS.CREDENCIAL,
      ALCANCE_MEDICION.TERCERO
    ),
    views: c(
      DISP,
      MEDIDO,
      "`views` llego por /insights y es OWNER_INSIGHT: NO vino en la respuesta del tercero y no existiria para un candidato",
      REQUISITOS.CREDENCIAL,
      ALCANCE_MEDICION.PROPIA
    ),
    likes: c(
      DISP,
      MEDIDO,
      "like_count por publicacion del tercero: 19, 28, 15, 36 y 30 en la muestra. PUBLIC_METRIC",
      REQUISITOS.CREDENCIAL,
      ALCANCE_MEDICION.TERCERO
    ),
    comments: c(
      DISP,
      MEDIDO,
      "comments_count por publicacion del tercero. Es el RECUENTO: el TEXTO no cabe en este contrato y esta medido que no",
      REQUISITOS.CREDENCIAL,
      ALCANCE_MEDICION.TERCERO
    ),
    shares: c(
      DISP,
      MEDIDO,
      "`shares` llego por /insights. OWNER_INSIGHT: no existe para terceros por ninguna via",
      REQUISITOS.CREDENCIAL,
      ALCANCE_MEDICION.PROPIA
    ),
    menciones: c(
      NOPE,
      DOC,
      "las menciones que la API entrega son las de la cuenta propia. Saber quien menciona a un tercero no es obtenible"
    ),
    busqueda: c(NOPE, DOC, "sin busqueda publica por API"),
    historico: c(NOPE, DOC, "ninguna via entrega serie temporal"),
    url_verificable: c(
      DISP,
      MEDIDO,
      "el `permalink` de cada publicacion del tercero llego en la respuesta. Es la URL canonica y sirve de evidencia reencontrable",
      REQUISITOS.CREDENCIAL,
      ALCANCE_MEDICION.TERCERO
    )
  },

  /*
    Lo DOCUMENTADO en META-PUBLIC-ACCESS-01, que es distinto de
    lo medido. Ver docs/META-PUBLIC-ACCESS.md para las fuentes.
  */
  viaOficialTerceros: {
    existe: true,
    endpoint: "GET graph.facebook.com/{nuestro-ig-user-id}?fields=business_discovery.username(OBJETIVO){...}",
    tokenRequerido: "Facebook User access token",
    flujoRequerido: "Instagram API con Facebook Login for Business",
    paginaVinculada: true,

    permisos: [
      "instagram_basic",
      "instagram_manage_insights",
      "pages_read_engagement",
      "ads_management o ads_read si el rol vino por Business Manager"
    ],

    accesoRequerido: "Advanced Access",
    appReview: true,
    businessVerification: true,

    tiposDeCuentaAlcanzables: ["BUSINESS", "CREATOR"],

    /*
      La respuesta que decide la cobertura del producto.
    */
    cuentaPersonal: {
      alcanzable: false,
      motivo:
        "business_discovery solo soporta cuentas Business o Creator. Una cuenta personal no es alcanzable por ninguna via oficial, ni ahora ni despues de la revision."
    },

    devuelveDeTerceros: [
      "username",
      "name",
      "followers_count",
      "media_count",
      "media",
      "like_count y comments_count por publicacion",
      "view_count en media"
    ],

    noDevuelveDeTerceros: [
      "reach, impressions, saved, shares: no aparecen documentados para terceros, son OWNER_INSIGHT",
      "histórico: ninguna API entrega serie temporal; la construye Sentinel con snapshots"
    ],

    documentado: "2026-08-28",
    fuente: "docs/META-PUBLIC-ACCESS.md"
  },

  rutaConcreta: [
    "HECHO: app creada, cuenta profesional propia conectada y token de Instagram Login funcionando.",
    "PENDIENTE: montar Facebook Login for Business y vincular una pagina de Facebook. El token actual no sirve para business_discovery.",
    "PENDIENTE: App Review de instagram_basic e instagram_manage_insights, y Business Verification.",
    "Solo entonces business_discovery, y solo sobre cuentas PROFESIONALES del objetivo.",
    "Alternativa: proveedor con licencia (INSTAGRAM-PROVIDER-EVAL-01)."
  ]
};


/*
===========================================================
X

La mejor del grupo para conversacion y amplificacion, y la que
tiene un precio explicito.
===========================================================
*/
const X = {
  plataformaId: "x",
  plataforma: "X",

  apiOficial: "X API v2",
  credencial: null,
  terceros: true,
  autorizacionDelTitular: false,

  notaAlcance:
    "Tecnicamente cubre terceros sin autorizacion, que la coloca por delante de TikTok, Facebook e Instagram. El obstaculo no es el permiso: es el plan. Los niveles bajos tienen cuotas muy pequenas y la busqueda amplia esta en los niveles altos.",

  /*
    Endpoints de la v2, con su campo. El plan gobierna CUANTO se
    puede pedir, no QUE se puede pedir: la forma del dato es la
    misma en todos los niveles.
  */
  endpoints: {
    usuario: "GET /2/users/by/username/:username?user.fields=public_metrics,description,created_at",
    timeline: "GET /2/users/:id/tweets?tweet.fields=created_at,public_metrics",
    busquedaReciente: "GET /2/tweets/search/recent?query=...&tweet.fields=created_at,public_metrics",
    busquedaArchivo: "GET /2/tweets/search/all (niveles superiores)"
  },

  autenticacion: "Bearer token de aplicacion (app-only). No necesita OAuth de usuario para lectura publica.",

  programasDeAcceso: [
    "Portal de desarrolladores de X: crear proyecto y app, obtener bearer token. HECHO.",
    "Cargar saldo en la cuenta Pay-Per-Use. HECHO: el 402 desaparecio y las dos llamadas devolvieron 200.",
    "El archivo completo (`search/all`) pertenece a los niveles superiores y sigue fuera."
  ],

  /*
    -----------------------------------------------------------
    MEDIDO EN X-REAL-01 (2026-08-28)
    -----------------------------------------------------------

    Una sola llamada real a `GET /2/users/by/username` con la
    credencial ya configurada:

        HTTP 402 Payment Required

    Lo que eso dice y lo que no:

      SI dice   que la credencial no fue rechazada. Un token
                invalido devuelve 401, no 402.
      NO dice   que los demas endpoints funcionen. No se
                probaron: la secuencia se detuvo en la primera
                llamada y no hubo reintentos.

    Por eso `identidad`, `cuenta` y `followers` —las tres que
    sirve ese endpoint— quedan MEDIDAS como bloqueadas por
    saldo, y el resto queda NO_PROBADO. Inferir que tambien
    estan cerradas es razonable; llamarlo medicion, no.
    -----------------------------------------------------------
  */
  medicionReal: {
    gate: "X-REAL-01",
    fecha: "2026-08-28",
    requests: 2,
    reintentos: 0,

    endpoints: [
      { endpoint: "GET /2/users/by/username", httpStatus: 200 },
      { endpoint: "GET /2/users/:id/tweets", httpStatus: 200 }
    ],

    conclusion: "OPERATIVO",

    /*
      El bloqueo anterior y su resolucion, conservados: sin esto
      se perderia la unica prueba de que un 402 significaba saldo
      y no credencial.
    */
    historial: [
      {
        fecha: "2026-08-28",
        httpStatus: 402,
        conclusion: "X_API_CREDENTIAL_OK_BUT_BILLING_BLOCKED",
        nota: "Pay-Per-Use con saldo cero. Se resolvio cargando credito; la credencial nunca fue el problema."
      }
    ],

    /*
      -----------------------------------------------------------
      LO QUE APRENDIO LA MEDICION
      -----------------------------------------------------------

      Las dos metricas que estaban en duda LLEGARON:
      `impression_count` y `bookmark_count`, en las cinco
      publicaciones. No hizo falta un nivel superior.

      Y aparecio un aviso que importa mas que las cifras: TRES DE
      LAS CINCO publicaciones eran retweets. En un retweet, X
      devuelve `like_count: 0`, `reply_count: 0` y `quote_count:
      0` —las reacciones pertenecen al post original, no al acto
      de republicar— mientras `retweet_count` y `impression_count`
      si traen valor.

      Promediar retweets con publicaciones propias hunde
      cualquier media de interaccion y haria parecer inactiva a
      una cuenta que solo amplifica mucho. `normalizarPost` marca
      `esRepost`, `esCita` y `esRespuesta` a partir de
      `referenced_tweets`: el filtro existe y hay que usarlo
      ANTES de cualquier promedio.
      -----------------------------------------------------------
    */
    avisoRetweets:
      "En un retweet, likes, replies y quotes valen 0 porque las reacciones son del post original. No se pueden promediar con publicaciones propias: usar `esRepost` para separarlos.",

    metricasConfirmadas: [
      "like_count",
      "retweet_count",
      "reply_count",
      "quote_count",
      "impression_count",
      "bookmark_count"
    ],

    noCapturadoPorNuestroNormalizador: [
      "listed_count: X puede devolverlo en public_metrics y nuestro normalizador no lo mapea. No es que la API no lo de."
    ]
  },

  capacidades: {
    identidad: c(
      DISP,
      MEDIDO,
      "users/by/username resuelve handle -> id SIN autorizacion del titular. MEDIDO: HTTP 200",
      REQUISITOS.CREDENCIAL
    ),
    cuenta: c(
      DISP,
      MEDIDO,
      "nombre, descripcion y fecha de creacion, del mismo endpoint. MEDIDO: HTTP 200",
      REQUISITOS.CREDENCIAL
    ),
    followers: c(
      DISP,
      MEDIDO,
      "followers_count, following_count y tweet_count. MEDIDO: HTTP 200. `listed_count` no lo mapea nuestro normalizador",
      REQUISITOS.CREDENCIAL
    ),
    publicaciones: c(
      DISP,
      MEDIDO,
      "users/:id/tweets. MEDIDO: HTTP 200, muestra de 5 publicaciones con fecha y URL canonica",
      REQUISITOS.CREDENCIAL
    ),
    views: c(
      DISP,
      MEDIDO,
      "impression_count. MEDIDO: llego en las cinco publicaciones de un tercero. Era la duda principal y quedo resuelta",
      REQUISITOS.CREDENCIAL
    ),
    likes: c(
      DISP,
      MEDIDO,
      "like_count. MEDIDO. OJO: en un retweet vale 0 porque las reacciones son del post original",
      REQUISITOS.CREDENCIAL
    ),
    comments: c(
      DISP,
      MEDIDO,
      "reply_count. MEDIDO. En un retweet vale 0 por el mismo motivo",
      REQUISITOS.CREDENCIAL
    ),
    shares: c(
      DISP,
      MEDIDO,
      "retweet_count y quote_count, SEPARADOS: republicar y citar no son el mismo acto. MEDIDOS los dos",
      REQUISITOS.CREDENCIAL
    ),
    menciones: c(
      DISP,
      NOVER,
      "search/recent por mencion. La capacidad que ninguna otra plataforma ofrece para terceros. NO SE PROBO: quedaba fuera del presupuesto de este gate",
      REQUISITOS.CREDENCIAL
    ),
    busqueda: c(
      DISP,
      NOVER,
      "search/recent cubre 7 dias. NO SE PROBO",
      REQUISITOS.CREDENCIAL
    ),
    historico: c(
      AUTZ,
      DOC,
      "search/all da archivo completo y pertenece a los niveles superiores. No es cuestion de saldo sino de nivel: aunque hubiera credito, este endpoint seguiria fuera",
      REQUISITOS.PLAN_PAGO
    ),
    url_verificable: c(
      DISP,
      MEDIDO,
      "x.com/handle/status/ID. MEDIDA: las cinco URLs se construyeron y quedaron persistidas como evidencia"
    )
  },

  rutaConcreta: [
    "Medir primero cuantas consultas al dia necesita Sentinel de verdad. El plan se elige DESPUES de esa medicion, no antes.",
    "Ver X-PROVIDER-EVAL-01 para la alternativa por proveedor."
  ]
};


export const PLATAFORMAS = Object.freeze([YOUTUBE, TIKTOK, FACEBOOK, INSTAGRAM, X]);


export function matrizDeCapacidades() {
  const filas = CAPACIDADES.map((cap) => ({
    capacidad: cap.id,
    nombre: cap.nombre,

    porPlataforma: Object.fromEntries(
      PLATAFORMAS.map((p) => {
        const celda =
          p.capacidades[cap.id] ||
          c(ESTADOS_CAPACIDAD.NO_DISPONIBLE, VERIFICACION.NO_VERIFICADO, null);

        /* La etiqueta de salida se DERIVA; no se guarda aparte. */
        return [p.plataformaId, { ...celda, celda: celdaDe(celda) }];
      })
    )
  }));

  /*
    `estado` o `verificacion` en null significa «no filtres por
    eso». Sin esta guarda, contar solo por verificacion daba 0:
    la comparacion `x.estado === null` no coincidia con nada.
  */
  const cuenta = (estado, verificacion) =>
    PLATAFORMAS.reduce(
      (s, p) =>
        s +
        Object.values(p.capacidades).filter(
          (x) =>
            (estado ? x.estado === estado : true) &&
            (verificacion ? x.verificacion === verificacion : true)
        ).length,
      0
    );

  const total = PLATAFORMAS.length * CAPACIDADES.length;

  return {
    version: "1.0",

    plataformas: PLATAFORMAS.map((p) => ({
      plataformaId: p.plataformaId,
      plataforma: p.plataforma,
      apiOficial: p.apiOficial,
      terceros: p.terceros,
      autorizacionDelTitular: p.autorizacionDelTitular,
      notaAlcance: p.notaAlcance,
      rutaConcreta: p.rutaConcreta || [],

      /* SOCIAL-PROVIDER-EVAL-01 */
      endpoints: p.endpoints || null,
      autenticacion: p.autenticacion || null,
      programasDeAcceso: p.programasDeAcceso || [],
      medicionReal: p.medicionReal || null,
      viaOficialTerceros: p.viaOficialTerceros || null,

      /*
        Sin declarar estado, NO_PROBADO. Es la respuesta honesta
        para una plataforma a la que no se le ha preguntado.
      */
      comentarios: p.comentarios || {
        estado: ESTADOS_COMENTARIOS.NO_PROBADO,
        motivo: "no se ha probado la obtencion de comentarios en esta plataforma"
      },

      /* La regla, resuelta, para que la interfaz no la reinvente. */
      benchmark: habilitaBenchmark(p.plataformaId),
      apisEvaluadas: p.apisEvaluadas || null,
      credencial: p.credencial || null,

      disponibles: Object.values(p.capacidades).filter(
        (x) => x.estado === ESTADOS_CAPACIDAD.DISPONIBLE
      ).length,

      medidas: Object.values(p.capacidades).filter(
        (x) => x.verificacion === VERIFICACION.MEDIDO_EN_PRODUCCION
      ).length,

      capacidades: p.capacidades
    })),

    filas,

    resumen: {
      celdas: total,
      disponibles: cuenta(ESTADOS_CAPACIDAD.DISPONIBLE),
      medidasEnProduccion: cuenta(null, VERIFICACION.MEDIDO_EN_PRODUCCION),
      requierenAutorizacion: cuenta(ESTADOS_CAPACIDAD.REQUIERE_AUTORIZACION),
      noDisponibles: cuenta(ESTADOS_CAPACIDAD.NO_DISPONIBLE),
      requierenProveedor: cuenta(ESTADOS_CAPACIDAD.REQUIERE_PROVEEDOR_EXTERNO),

      /*
        Recuento por la etiqueta de salida. Es la que responde a
        «que hace falta para tener esto», que es la pregunta que
        se lleva a una reunion.
      */
      porCelda: PLATAFORMAS.reduce((acc, p) => {
        Object.values(p.capacidades).forEach((x) => {
          const e = celdaDe(x);

          acc[e] = (acc[e] || 0) + 1;
        });

        return acc;
      }, {})
    },

    lectura:
      "Solo YouTube tiene capacidades MEDIDAS en produccion. Todo lo demas es documentacion oficial sin comprobar, y se marca como tal: una capacidad documentada puede caerse el dia que se intente.",

    regla:
      "Ninguna celda esta en DISPONIBLE por suposicion. Cada una declara como se sabe lo que dice."
  };
}


/*
  Estado de una capacidad concreta. Lo consume el motor para
  decidir si pedir un dato o declararlo no obtenible.
*/
export function capacidad(plataformaId, capacidadId) {
  const p = PLATAFORMAS.find((x) => x.plataformaId === plataformaId);

  if (!p) {
    return c(
      ESTADOS_CAPACIDAD.NO_DISPONIBLE,
      VERIFICACION.NO_VERIFICADO,
      `plataforma ${plataformaId} no contemplada en la matriz`
    );
  }

  return (
    p.capacidades[capacidadId] ||
    c(
      ESTADOS_CAPACIDAD.NO_DISPONIBLE,
      VERIFICACION.NO_VERIFICADO,
      `capacidad ${capacidadId} no contemplada`
    )
  );
}


/*
===========================================================
QUE HABILITA EL BENCHMARK MULTICANDIDATO
===========================================================

La regla, escrita como funcion en lugar de como convencion.

META-IG-REAL-01 enseno lo facil que es equivocarse: Instagram
respondio a todo sobre nuestra cuenta y, con la matriz de
entonces, habria entrado al benchmark. META-PUBLIC-ACCESS-01
anadio documentacion oficial sobre lo que Instagram PODRIA dar de
terceros — y documentar tampoco habilita.

    Solo MEDIDO_TERCERO habilita. Ni medir lo propio, ni leer la
    documentacion de Meta.

Mientras esto sea una funcion y no una costumbre, nadie puede
saltarselo sin verlo.
===========================================================
*/
export function habilitaBenchmark(plataformaId) {
  const p = PLATAFORMAS.find((x) => x.plataformaId === plataformaId);

  if (!p) {
    return {
      habilita: false,
      motivo: `plataforma ${plataformaId} no contemplada en la matriz`
    };
  }

  const terceros = Object.entries(p.capacidades).filter(
    ([, c]) => celdaDe(c) === ESTADOS_CELDA.MEDIDO
  );

  const propias = Object.values(p.capacidades).filter(
    (c) => celdaDe(c) === ESTADOS_CELDA.MEDIDO_PROPIO
  );

  if (terceros.length) {
    return {
      habilita: true,
      capacidades: terceros.map(([k]) => k),
      motivo: `${terceros.length} capacidad(es) medidas sobre cuentas que no controlamos`
    };
  }

  return {
    habilita: false,
    capacidades: [],
    medidasSobreCuentaPropia: propias.length,
    motivo: propias.length
      ? `Solo hay mediciones sobre nuestra propia cuenta (${propias.length}). Ningun candidato nos va a dar un token, asi que eso no sirve para observarlos.`
      : "No hay ninguna capacidad medida sobre terceros."
  };
}


export default {
  ESTADOS_CAPACIDAD,
  habilitaBenchmark,
  VERIFICACION,
  ALCANCES,
  CAPACIDADES,
  PLATAFORMAS,
  matrizDeCapacidades,
  capacidad
};
