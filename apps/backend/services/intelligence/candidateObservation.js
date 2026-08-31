// apps/backend/services/intelligence/candidateObservation.js

/*
===========================================================
OBSERVACION REAL DE UN CANDIDATO — P-CAND-03
===========================================================

Traduce lo que devuelve un adapter de plataforma al contrato
COMUN de Candidate Intelligence. Aqui no se habla HTTP con nadie:
eso es trabajo del adapter, que ya existe.

    adapter de plataforma  →  PublicationObservation
                              MetricSnapshot
                              evidencia

Es la pieza que permite que TikTok, Instagram, Facebook, X y
YouTube alimenten los mismos contratos en lugar de cinco silos.

-----------------------------------------------------------
DE DONDE SALE LA CUENTA A OBSERVAR
-----------------------------------------------------------

Del EXPEDIENTE, nunca de una busqueda por nombre. Buscar el
nombre de una persona y quedarse con el primer resultado no es
resolver identidad: es aceptar el criterio de relevancia de un
buscador como si fuera evidencia.

Y observar no cambia la identidad: si la cuenta estaba
DECLARADA, sigue declarada. Leer sus datos no la corrobora — lo
que se lee es lo que publica una cuenta cuya pertenencia se
sostiene aparte. Confundir «pude leerla» con «es suya» seria la
autoverificacion que todo este modulo evita.

-----------------------------------------------------------
PRESUPUESTO
-----------------------------------------------------------

Cada llamada declara lo que cuesta y el resultado dice cuanto se
gasto. Una observacion pequena por diseno: validar el pipeline no
exige recorrer un canal entero.
===========================================================
*/

import {
  crearPublicacionObservada,
  crearSnapshotDeMetrica,
  DISPONIBILIDAD,
  TIPOS_PUBLICACION
} from "./publicationObservation.js";

import { resolverAdaptador, ESTADOS_ADAPTADOR } from "./platformAdapterPort.js";

import { capacidad, ESTADOS_CAPACIDAD } from "./socialCapabilityMatrix.js";


export const ESTADOS_OBSERVACION_REAL = Object.freeze({
  /* Se pidio y se obtuvieron publicaciones. */
  OBSERVADA: "OBSERVADA",

  /* La cuenta no resuelve en la plataforma. */
  CUENTA_NO_RESUELTA: "CUENTA_NO_RESUELTA",

  /* Resuelve y no devuelve publicaciones. */
  SIN_PUBLICACIONES: "SIN_PUBLICACIONES",

  /* Falta credencial o adapter. */
  NO_EJECUTABLE: "NO_EJECUTABLE",

  /* La capacidad no existe para terceros en esta plataforma. */
  CAPACIDAD_NO_DISPONIBLE: "CAPACIDAD_NO_DISPONIBLE",

  /*
    LA CUENTA EXISTE Y LA VIA NO LA ALCANZA.

    `business_discovery` solo responde sobre cuentas Business o
    Creator. Sobre una personal devuelve error, y leerlo como
    CUENTA_NO_RESUELTA seria decir «no encontramos la cuenta»
    cuando la verdad es «la cuenta esta ahi y esta via no la
    abre, ni ahora ni despues de ninguna revision».

    La diferencia cambia la accion: una invita a revisar el
    handle, la otra a buscar otra fuente.
  */
  NO_SOPORTADO_PERSONAL: "NO_SOPORTADO_PERSONAL",

  CUOTA_AGOTADA: "CUOTA_AGOTADA",

  /*
    La credencial vale y el acceso esta cerrado por facturacion.
    Medido en X-REAL-01: HTTP 402 Payment Required con una cuenta
    Pay-Per-Use a saldo cero.

    Es distinto de CREDENCIAL_RECHAZADA —eso seria 401— y distinto
    de PERMISOS_INSUFICIENTES —eso seria 403—. Confundirlos manda
    a revisar el token cuando lo que falta es pagar.
  */
  BILLING_BLOQUEADO: "BILLING_BLOQUEADO",

  /* 401: el token no vale. */
  CREDENCIAL_RECHAZADA: "CREDENCIAL_RECHAZADA",

  /*
    El token ESTUVO bien y caduco. Medido en
    P-CAND-SOCIAL-COVERAGE-01: el de Facebook expiro entre la
    validacion y la ejecucion, porque los del Graph API Explorer
    duran alrededor de una hora.

    Separarlo de RECHAZADA cambia la accion: uno manda a revisar
    de donde salio el token, el otro a conseguir uno de larga
    duracion. Regenerar otro corto vuelve a caducar.
  */
  CREDENCIAL_EXPIRADA: "CREDENCIAL_EXPIRADA",

  /* 403: el token vale y el plan no cubre este endpoint. */
  PERMISOS_INSUFICIENTES: "PERMISOS_INSUFICIENTES",

  ERROR: "ERROR"
});


/*
===========================================================
CLASIFICAR UN BLOQUEO DE PROVEEDOR
===========================================================

Cuatro causas que se parecen en pantalla y no se arreglan igual:

    401  el token no vale          → revisar credencial
    402  hace falta pagar          → cargar saldo
    403  el plan no lo cubre       → contratar otro nivel
    429  demasiadas peticiones     → esperar

MEDIDO EN X-REAL-01, y con una leccion. El adapter devolvio
`motivo: "HTTP 402"` sin `httpStatus`, y mi primer clasificador
—que solo miraba el campo numerico y unas palabras clave— lo
etiqueto `ERROR`. La parada fue correcta, pero el diagnostico
habria mandado a mirar el token cuando el problema era el saldo.

Por eso ahora el codigo se lee TAMBIEN del texto: un adapter
puede no exponer el campo, pero el numero esta ahi.
===========================================================
*/
export function clasificarBloqueo(r) {
  if (!r) return null;

  const texto = String(r.motivo || "");

  /* El campo si existe; si no, se saca del texto. */
  const codigo =
    r.httpStatus ?? Number((texto.match(/\b(4\d{2}|5\d{2})\b/) || [])[1]) ?? null;

  const minusculas = texto.toLowerCase();

  const hablaDePago =
    /insufficient|credit|billing|payment required|saldo|usage cap|not enrolled|purchase/.test(
      minusculas
    );

  if (codigo === 402 || hablaDePago) {
    return {
      tipo: ESTADOS_OBSERVACION_REAL.BILLING_BLOQUEADO,
      httpStatus: codigo,
      reintentable: false,
      motivo:
        "La credencial no fue rechazada: el acceso esta cerrado por facturacion. Reintentar no cambia nada y cargar saldo es una decision de una persona.",
      accion: "cargar saldo o contratar un plan en el portal del proveedor"
    };
  }

  if (r.estado === "CREDENCIAL_EXPIRADA") {
    return {
      tipo: ESTADOS_OBSERVACION_REAL.CREDENCIAL_EXPIRADA,
      reintentable: false,
      motivo:
        "el token caduco. No estaba mal: duraba poco, y los del Graph API Explorer viven alrededor de una hora.",
      accion:
        "Conseguir un token de larga duracion. Regenerar otro corto caducara igual antes de la siguiente ejecucion"
    };
  }

  if (codigo === 401 || r.estado === "CREDENCIAL_RECHAZADA") {
    return {
      tipo: ESTADOS_OBSERVACION_REAL.CREDENCIAL_RECHAZADA,
      httpStatus: codigo,
      reintentable: false,
      motivo: "El proveedor rechazo la credencial.",
      accion: "revisar la variable de entorno"
    };
  }

  if (codigo === 403 || r.estado === "PLAN_INSUFICIENTE") {
    return {
      tipo: ESTADOS_OBSERVACION_REAL.PERMISOS_INSUFICIENTES,
      httpStatus: codigo,
      reintentable: false,
      motivo: "El plan contratado no cubre este endpoint.",
      accion: "contratar un nivel que lo incluya"
    };
  }

  if (codigo === 429 || r.estado === "LIMITE_DE_PETICIONES") {
    return {
      tipo: ESTADOS_OBSERVACION_REAL.CUOTA_AGOTADA,
      httpStatus: codigo,

      /*
        El unico reintentable de los cuatro, y aun asi no se
        reintenta aqui: esperar lo decide quien programa la
        siguiente observacion, no un bucle.
      */
      reintentable: true,
      motivo: "Se superaron las peticiones permitidas.",
      accion: "esperar a que se restablezca la ventana"
    };
  }

  return null;
}


/*
  Traduce las metricas de un video de YouTube a snapshots del
  contrato comun. La `availability` que declara el adapter se
  respeta tal cual: es el adapter quien sabe si YouTube omitio el
  campo o el canal lo cerro.
*/
function snapshotsDeVideo(video, contexto) {
  const observedAt = contexto.observedAt;

  return Object.entries(video.metricas || {}).map(([nombre, m]) =>
    crearSnapshotDeMetrica({
      metrica: nombre,
      value: m.value,
      observedAt,
      provider: contexto.provider,
      source: video.canonicalUrl,
      availability: m.availability || DISPONIBILIDAD.NO_DISPONIBLE,
      motivo: m.motivo
    })
  );
}


/*
===========================================================
OBSERVAR UNA CUENTA DE YOUTUBE
===========================================================

Tres llamadas, en el orden mas barato posible:

    channels.list?forHandle   1 unidad   handle -> canal
    playlistItems.list        1 unidad   muestra de subidas
    videos.list               1 unidad   estadisticas

Total: 3 unidades. La alternativa por `search.list` habria
costado 100 y habria ordenado por relevancia en lugar de por
lo que el canal publico.
===========================================================
*/
export async function observarYouTube(entrada = {}) {
  const {
    candidateId = null,
    projectId = null,
    cuenta = null,
    maximoPublicaciones = 5,
    observedAt = new Date().toISOString(),
    fetchImpl = undefined
  } = entrada;

  const traza = {
    plataformaId: "youtube",
    llamadas: [],
    unidadesConsumidas: 0
  };

  const registrar = (endpoint, r) => {
    traza.llamadas.push({
      endpoint,
      estado: r?.estado || "ERROR",
      unidades: r?.unidadesConsumidas ?? 0,
      motivo: r?.motivo || null
    });

    traza.unidadesConsumidas += r?.unidadesConsumidas ?? 0;
  };

  const salida = (estado, extra = {}) => ({
    estado,
    plataformaId: "youtube",
    candidateId,
    accountId: cuenta?.id || null,
    canal: null,
    publicaciones: [],
    traza,
    ...extra
  });

  if (!cuenta?.handle) {
    return salida(ESTADOS_OBSERVACION_REAL.CUENTA_NO_RESUELTA, {
      motivo: "la cuenta del expediente no trae handle"
    });
  }

  /* La matriz decide si esto se puede pedir siquiera. */
  const capPub = capacidad("youtube", "publicaciones");

  if (capPub.estado !== ESTADOS_CAPACIDAD.DISPONIBLE) {
    return salida(ESTADOS_OBSERVACION_REAL.CAPACIDAD_NO_DISPONIBLE, {
      motivo: capPub.nota
    });
  }

  const puerto = await resolverAdaptador("youtube");

  if (
    puerto.estado === ESTADOS_ADAPTADOR.ADAPTADOR_NO_DISPONIBLE ||
    puerto.estado === ESTADOS_ADAPTADOR.SIN_CREDENCIAL
  ) {
    return salida(ESTADOS_OBSERVACION_REAL.NO_EJECUTABLE, {
      motivo: puerto.motivo
    });
  }

  const adapter = await import(puerto.adaptador.ruta);

  const opciones = fetchImpl ? { fetch: fetchImpl } : {};

  /*
    ---- 1 · handle -> canal ----

    No todos los expedientes guardan un handle. Paul Carrasco
    tiene un channelId —`UC...`, 24 caracteres— porque su URL es
    `/channel/...` y no `/@handle`. `forHandle` con un id no
    resuelve nada.

    Se detecta la forma y se usa el endpoint que corresponde. Y
    cuando es un id, la lista de subidas se deriva sustituyendo
    `UC` por `UU`: es la convencion estable de YouTube y evita
    una llamada extra. Si no funcionara, `listarSubidas`
    devolveria vacio y quedaria declarado, no adivinado.
  */
  const esChannelId = /^UC[A-Za-z0-9_-]{20,24}$/.test(String(cuenta.handle));

  let rc;

  if (esChannelId) {
    const porId = await adapter.resolverCanales([cuenta.handle], opciones);

    registrar("channels.list?id", porId);

    const canalPorId = (porId.canales || [])[0] || null;

    if (canalPorId) {
      canalPorId.listaDeSubidas = `UU${String(cuenta.handle).slice(2)}`;

      canalPorId.handleConsultado = cuenta.handle;

      canalPorId.resueltoPor = "channelId";
    }

    rc = {
      estado: porId.estado,
      canal: canalPorId,
      unidadesConsumidas: porId.unidadesConsumidas,
      motivo: porId.motivo || (canalPorId ? null : "el channelId no resolvio ningun canal")
    };
  } else {
    rc = await adapter.resolverCanalPorHandle(cuenta.handle, opciones);

    registrar("channels.list?forHandle", rc);
  }

  if (rc.estado === "CUOTA_AGOTADA") {
    return salida(ESTADOS_OBSERVACION_REAL.CUOTA_AGOTADA, { motivo: rc.motivo });
  }

  if (rc.estado !== "OK" || !rc.canal) {
    return salida(ESTADOS_OBSERVACION_REAL.CUENTA_NO_RESUELTA, {
      motivo:
        rc.motivo ||
        `el handle @${cuenta.handle} no resuelve a ningun canal. NO significa que el candidato no tenga YouTube: significa que ese handle no resuelve.`
    });
  }

  const canal = rc.canal;

  /*
    Snapshots de la CUENTA. `hiddenSubscriberCount` es el caso
    que justifica todo el contrato de disponibilidad: el dato
    existe y el canal lo cerro.
  */
  const est = canal.estadisticasPublicas || {};

  const metricasDeCuenta = [
    crearSnapshotDeMetrica({
      metrica: "subscribers",
      value: est.ocultos ? null : est.suscriptores,
      observedAt,
      provider: "youtube_data",
      source: canal.url,
      availability: est.ocultos
        ? DISPONIBILIDAD.OCULTO_POR_LA_CUENTA
        : est.suscriptores == null
          ? DISPONIBILIDAD.NO_DISPONIBLE
          : DISPONIBILIDAD.DISPONIBLE,
      motivo: est.ocultos
        ? "el canal oculta su numero de suscriptores. El dato existe y esta cerrado: no es cero"
        : null
    }),

    crearSnapshotDeMetrica({
      metrica: "views",
      value: est.vistas,
      observedAt,
      provider: "youtube_data",
      source: canal.url
    })
  ];

  /* ---- 2 · muestra de subidas ---- */
  if (!canal.listaDeSubidas) {
    return salida(ESTADOS_OBSERVACION_REAL.SIN_PUBLICACIONES, {
      canal,
      metricasDeCuenta,
      motivo: "el canal no declara lista de subidas"
    });
  }

  const rl = await adapter.listarSubidas(canal.listaDeSubidas, {
    ...opciones,
    maximo: maximoPublicaciones
  });

  registrar("playlistItems.list", rl);

  if (rl.estado === "CUOTA_AGOTADA") {
    return salida(ESTADOS_OBSERVACION_REAL.CUOTA_AGOTADA, {
      canal,
      metricasDeCuenta,
      motivo: rl.motivo
    });
  }

  if (rl.estado !== "OK" || !rl.videos.length) {
    return salida(ESTADOS_OBSERVACION_REAL.SIN_PUBLICACIONES, {
      canal,
      metricasDeCuenta,
      motivo:
        rl.motivo ||
        "el canal resuelve y no devuelve publicaciones en su lista de subidas"
    });
  }

  /* ---- 3 · estadisticas de esa muestra ---- */
  const ids = rl.videos.map((v) => v.videoId);

  const rv = await adapter.resolverVideos(ids, opciones);

  registrar("videos.list", rv);

  const porId = new Map((rv.videos || []).map((v) => [v.videoId, v]));

  const publicaciones = rl.videos.map((v) => {
    const stats = porId.get(v.videoId) || null;

    const metricas = stats
      ? snapshotsDeVideo(stats, { observedAt, provider: "youtube_data" })
      : ["views", "likes", "comments"].map((m) =>
          crearSnapshotDeMetrica({
            metrica: m,
            value: null,
            observedAt,
            provider: "youtube_data",
            source: v.canonicalUrl,
            availability: DISPONIBILIDAD.NO_CONSULTADO,
            motivo: "videos.list no devolvio este video"
          })
        );

    return crearPublicacionObservada({
      candidateId,
      projectId,
      accountId: cuenta.id,
      platformId: "youtube",

      canonicalUrl: v.canonicalUrl,

      /* La fuente dice cuando se publico; nosotros cuando lo vimos. */
      publishedAt: v.publishedAt,
      firstObservedAt: observedAt,
      lastObservedAt: observedAt,

      title: v.title,
      text: null,

      /*
        Una subida de YouTube es contenido propio. La plataforma
        no tiene un equivalente del retweet dentro de la lista de
        subidas de un canal.
      */
      tipoPublicacion: TIPOS_PUBLICACION.ORIGINAL,

      metricas,
      metricsObservedAt: observedAt,

      provider: "youtube_data",
      observationMethod: "youtube_data_api_v3",

      /*
        `evidenceId` derivado de la URL canonica: estable, y el
        mismo video observado otro dia produce el mismo id.
      */
      evidenceId: `ev-yt-${v.videoId}`
    });
  });

  return salida(ESTADOS_OBSERVACION_REAL.OBSERVADA, {
    canal,
    metricasDeCuenta,
    publicaciones,
    noDevueltos: rv.noDevueltos || [],

    /*
      Se dice explicitamente: leer una cuenta NO la corrobora.
      Es la frase que impide que «pude observarla» se convierta
      en «es suya».
      */
    notaIdentidad:
      "La observacion NO altera la resolucion de identidad. Que una cuenta se pueda leer no dice de quien es: su pertenencia se sostiene con las senales de Account Resolution, no con el hecho de haberla consultado."
  });
}


/*
===========================================================
OBSERVAR UNA CUENTA DE X
===========================================================

Dos llamadas: perfil y muestra de publicaciones. En X las
metricas vienen EN el propio post, asi que no hay una tercera
llamada como `videos.list` de YouTube.

Un bloqueo del proveedor detiene la secuencia y NO se reintenta.
Medido en X-REAL-01: la primera llamada devolvio 402 y la
observacion se detuvo ahi.
===========================================================
*/
export async function observarX(entrada = {}) {
  const {
    candidateId = null,
    projectId = null,
    cuenta = null,
    maximoPublicaciones = 5,
    observedAt = new Date().toISOString(),
    fetchImpl = undefined
  } = entrada;

  const traza = { plataformaId: "x", llamadas: [], unidadesConsumidas: 0 };

  const registrar = (endpoint, r) => {
    traza.llamadas.push({
      endpoint,
      estado: r?.estado || "ERROR",

      /* En X se cuentan LLAMADAS: no hay unidades como en YouTube. */
      unidades: r?.llamadas ?? 0,
      httpStatus: r?.httpStatus ?? null,
      motivo: r?.motivo || null
    });

    traza.unidadesConsumidas += r?.llamadas ?? 0;
  };

  const salida = (estado, extra = {}) => ({
    estado,
    plataformaId: "x",
    candidateId,
    accountId: cuenta?.id || null,
    canal: null,
    publicaciones: [],
    traza,
    ...extra
  });

  if (!cuenta?.handle) {
    return salida(ESTADOS_OBSERVACION_REAL.CUENTA_NO_RESUELTA, {
      motivo: "la cuenta del expediente no trae handle"
    });
  }

  const puerto = await resolverAdaptador("x");

  if (
    puerto.estado === ESTADOS_ADAPTADOR.ADAPTADOR_NO_DISPONIBLE ||
    puerto.estado === ESTADOS_ADAPTADOR.SIN_CREDENCIAL
  ) {
    return salida(ESTADOS_OBSERVACION_REAL.NO_EJECUTABLE, {
      motivo: puerto.motivo
    });
  }

  const adapter = await import(puerto.adaptador.ruta);

  const opciones = fetchImpl ? { fetch: fetchImpl } : {};

  /* ---- 1 · handle -> cuenta ---- */
  const rc = await adapter.resolverCuentaPorHandle(cuenta.handle, opciones);

  registrar("GET /2/users/by/username", rc);

  const bloqueo = clasificarBloqueo(rc);

  if (bloqueo) {
    return salida(bloqueo.tipo, {
      bloqueo,
      motivo: `${bloqueo.motivo} ${bloqueo.accion}.`
    });
  }

  if (rc.estado !== "OK" || !rc.cuenta) {
    return salida(ESTADOS_OBSERVACION_REAL.CUENTA_NO_RESUELTA, {
      motivo:
        rc.motivo ||
        `el handle @${cuenta.handle} no resuelve a ninguna cuenta. NO significa que no exista: significa que ese handle no resuelve.`
    });
  }

  const perfil = rc.cuenta;

  const est = perfil.estadisticasPublicas || {};

  const metricaDeCuenta = (nombre, valor) =>
    crearSnapshotDeMetrica({
      metrica: nombre,
      value: valor,
      observedAt,
      provider: "x_api",
      source: perfil.url,
      availability:
        valor == null ? DISPONIBILIDAD.NO_DISPONIBLE : DISPONIBILIDAD.DISPONIBLE,
      motivo: valor == null ? "la API no incluyo esta metrica" : null
    });

  const metricasDeCuenta = [
    metricaDeCuenta("followers", est.followers),
    metricaDeCuenta("following", est.following)
  ];

  /* ---- 2 · muestra de publicaciones ---- */
  const rp = await adapter.listarPublicaciones(perfil.userId, {
    ...opciones,
    handle: perfil.handle,
    maximo: maximoPublicaciones,
    observedAt
  });

  registrar("GET /2/users/:id/tweets", rp);

  const bloqueo2 = clasificarBloqueo(rp);

  if (bloqueo2) {
    return salida(bloqueo2.tipo, {
      canal: perfil,
      metricasDeCuenta,
      bloqueo: bloqueo2,
      motivo: `${bloqueo2.motivo} ${bloqueo2.accion}.`
    });
  }

  if (rp.estado !== "OK" || !rp.publicaciones.length) {
    return salida(ESTADOS_OBSERVACION_REAL.SIN_PUBLICACIONES, {
      canal: perfil,
      metricasDeCuenta,
      motivo:
        rp.motivo ||
        "la cuenta resuelve y no devuelve publicaciones en la ventana consultada"
    });
  }

  /*
    Traduccion al contrato comun. Un post de X y un video de
    YouTube son la misma cosa: `PublicationObservation` con
    `platformId` distinto.
  */
  const publicaciones = rp.publicaciones.map((ev) => {
    const m = ev.x?.metricas || {};

    const metricas = Object.entries(m).map(([nombre, v]) =>
      crearSnapshotDeMetrica({
        metrica: nombre,
        value: v.value,
        observedAt,
        provider: "x_api",
        source: ev.x.canonicalUrl,
        availability:
          v.availability === "DISPONIBLE"
            ? DISPONIBILIDAD.DISPONIBLE
            : DISPONIBILIDAD.NO_DISPONIBLE,
        motivo: v.motivo
      })
    );

    return crearPublicacionObservada({
      candidateId,
      projectId,
      accountId: cuenta.id,
      platformId: "x",

      canonicalUrl: ev.x.canonicalUrl,

      publishedAt: ev.publishedAt,
      firstObservedAt: observedAt,
      lastObservedAt: observedAt,

      title: null,
      text: ev.snippet || null,

      /*
        El tipo lo determina `referenced_tweets`, que el adapter
        ya traduce. Sin esto, un retweet con 0 likes entraria en
        la media de rendimiento propio y la hundiria.
      */
      tipoPublicacion: ev.x?.esRepost
        ? TIPOS_PUBLICACION.REPOST
        : ev.x?.esRespuesta
          ? TIPOS_PUBLICACION.REPLY
          : ev.x?.esCita
            ? TIPOS_PUBLICACION.QUOTE
            : TIPOS_PUBLICACION.ORIGINAL,

      metricas,
      metricsObservedAt: observedAt,

      provider: "x_api",
      observationMethod: "x_api_v2",

      /* El evidenceId lo produce el contrato de evidencia comun. */
      evidenceId: ev.evidenceId
    });
  });

  return salida(ESTADOS_OBSERVACION_REAL.OBSERVADA, {
    canal: perfil,
    metricasDeCuenta,
    publicaciones,

    notaIdentidad:
      "La observacion NO altera la resolucion de identidad. Que una cuenta se pueda leer no dice de quien es: su pertenencia se sostiene con las senales de Account Resolution, no con el hecho de haberla consultado."
  });
}


/*
===========================================================
OBSERVAR UN INSTAGRAM DE TERCERO — business_discovery
===========================================================

P-CAND-SOCIAL-COVERAGE-01.

UNA llamada por activo, y en ella cabe todo: identidad,
seguidores, recuento de publicaciones y una muestra de cinco con
sus metricas. Meta permite anidar la muestra dentro del mismo
`fields`, asi que pedir metrica por metrica seria gastar de mas
sin obtener nada distinto.

LA DISTINCION QUE ESTA FUNCION NO PUEDE PERDER
-----------------------------------------------------------

    MEDIDO_TERCERO            la cuenta no es nuestra
    MEDIDO_PROPIO_AUTORIZADO  el token la administra

Las dos devuelven HTTP 200 y los mismos campos. Se separan
mirando `me/accounts`, no la respuesta: por la respuesta son
indistinguibles, y ahi esta el riesgo. META-THIRD-PARTY-REAL-02
casi declaro acceso a terceros con una consulta que nuestra
propia cuenta se hizo a si misma.

Por eso `cuentasPropias` es un parametro y no un detalle
opcional: sin el, esta funcion no puede afirmar que midio un
tercero.

LO QUE business_discovery NO DEVUELVE
-----------------------------------------------------------

`reach`, `impressions`, `saved` y `shares` son OWNER_INSIGHT.
No se piden y no se rellenan: una cifra ausente queda
NO_DISPONIBLE, nunca 0.
===========================================================
*/
function idEstable(texto) {
  let acumulado = 0;

  const t = String(texto || "");

  for (let i = 0; i < t.length; i += 1) {
    acumulado = (acumulado * 31 + t.charCodeAt(i)) % 0xffffffff;
  }

  return acumulado.toString(36);
}


export async function observarInstagram(entrada = {}) {
  const {
    candidateId = null,
    projectId = null,
    cuenta = null,
    idParaBusinessDiscovery = null,
    cuentasPropias = [],
    maximoPublicaciones = 5,
    observedAt = new Date().toISOString(),
    fetchImpl = undefined
  } = entrada;

  const traza = { plataformaId: "instagram", llamadas: [], unidadesConsumidas: 0 };

  const registrar = (endpoint, r) => {
    traza.llamadas.push({
      endpoint,
      estado: r?.estado || "ERROR",
      unidades: r?.llamadas ?? 0,
      httpStatus: r?.httpStatus ?? null,
      codigoMeta: r?.codigo ?? null,
      motivo: r?.motivo || null
    });

    traza.unidadesConsumidas += r?.llamadas ?? 0;
  };

  const salida = (estado, extra = {}) => ({
    estado,
    plataformaId: "instagram",
    candidateId,
    accountId: cuenta?.id || null,
    canal: null,
    publicaciones: [],
    traza,
    ...extra
  });

  if (!cuenta?.handle) {
    return salida(ESTADOS_OBSERVACION_REAL.CUENTA_NO_RESUELTA, {
      motivo: "la cuenta del expediente no trae handle"
    });
  }

  if (!idParaBusinessDiscovery) {
    return salida(ESTADOS_OBSERVACION_REAL.NO_EJECUTABLE, {
      motivo:
        "business_discovery se pide DESDE nuestra cuenta profesional y no hay ninguna Pagina propia con Instagram vinculado. Sin ese vinculo la via no existe."
    });
  }

  const puerto = await resolverAdaptador("instagram");

  if (
    puerto.estado === ESTADOS_ADAPTADOR.ADAPTADOR_NO_DISPONIBLE ||
    puerto.estado === ESTADOS_ADAPTADOR.SIN_CREDENCIAL
  ) {
    return salida(ESTADOS_OBSERVACION_REAL.NO_EJECUTABLE, {
      motivo: puerto.motivo
    });
  }

  const adapter = await import(puerto.adaptador.ruta);

  /*
    ANTES de llamar: la cuenta es nuestra o no lo es. Se decide
    aqui porque la respuesta de Meta no lo dice.
  */
  const normal = (x) => String(x || "").trim().toLowerCase().replace(/^@+/, "");

  const esPropia = (cuentasPropias || []).map(normal).includes(normal(cuenta.handle));

  const r = await adapter.descubrirCuentaProfesional(
    idParaBusinessDiscovery,
    cuenta.handle,
    {
      ...(fetchImpl ? { fetch: fetchImpl } : {}),
      host: adapter.BASE_FB,
      limiteDeMedia: maximoPublicaciones,
      observedAt
    }
  );

  registrar("GET graph.facebook.com/{ig}?fields=business_discovery.username()", r);

  const bloqueo = clasificarBloqueo(r);

  if (bloqueo) {
    return salida(bloqueo.tipo, {
      bloqueo,
      esPropia,
      motivo: `${bloqueo.motivo} ${bloqueo.accion}.`
    });
  }

  /*
    UN CASO QUE NO ES UN FALLO Y SE CONFUNDE CON UNO.

    `business_discovery` solo responde sobre cuentas Business o
    Creator. Sobre una personal devuelve error, y eso NO
    significa que la cuenta no exista ni que Sentinel este mal
    configurado: significa que esa cuenta queda fuera de la via
    oficial, hoy y despues de cualquier revision.

    Se le da su propio estado para que en la matriz no aparezca
    como un error nuestro.
  */
  if (r.estado !== "OK" || !r.cuenta) {
    const texto = String(r.motivo || "").toLowerCase();

    const noProfesional =
      /not a business|not an instagram business|does not exist|no matching user|cannot be loaded/.test(
        texto
      );

    return salida(
      noProfesional
        ? ESTADOS_OBSERVACION_REAL.NO_SOPORTADO_PERSONAL
        : ESTADOS_OBSERVACION_REAL.CUENTA_NO_RESUELTA,
      {
        esPropia,
        httpStatus: r.httpStatus ?? null,
        codigoMeta: r.codigo ?? null,

        motivo: noProfesional
          ? `business_discovery no devuelve @${cuenta.handle}: solo alcanza cuentas Business o Creator. Que no responda NO prueba que la cuenta no exista; prueba que esta fuera de la via oficial.`
          : r.motivo || "la respuesta no incluye business_discovery"
      }
    );
  }

  const perfil = r.cuenta;

  const est = perfil.estadisticasPublicas || {};

  const metricaDeCuenta = (nombre, m) =>
    crearSnapshotDeMetrica({
      metrica: nombre,
      value: m?.value ?? null,
      observedAt,
      provider: "instagram_graph",
      source: perfil.url,
      availability:
        m?.value == null ? DISPONIBILIDAD.NO_DISPONIBLE : DISPONIBILIDAD.DISPONIBLE,
      motivo: m?.value == null ? "business_discovery no incluyo esta metrica" : null
    });

  const metricasDeCuenta = [
    metricaDeCuenta("followers", est.followers),
    metricaDeCuenta("publicaciones", est.publicaciones)
  ];

  const publicaciones = (perfil.publicaciones || []).map((ev) => {
    const m = ev.metricas || {};

    const metricas = Object.entries(m).map(([nombre, v]) =>
      crearSnapshotDeMetrica({
        metrica: nombre,
        value: v?.value ?? null,
        observedAt,
        provider: "instagram_graph",
        source: ev.canonicalUrl,
        availability:
          v?.value == null
            ? DISPONIBILIDAD.NO_DISPONIBLE
            : DISPONIBILIDAD.DISPONIBLE,
        motivo: v?.value == null ? "business_discovery no incluyo esta metrica" : null
      })
    );

    return crearPublicacionObservada({
      candidateId,
      projectId,
      accountId: cuenta.id,
      platformId: "instagram",

      canonicalUrl: ev.canonicalUrl,

      publishedAt: ev.publishedAt,
      firstObservedAt: observedAt,
      lastObservedAt: observedAt,

      title: null,
      text: ev.caption || null,

      /*
        business_discovery no distingue original de repost: no
        expone nada equivalente a `referenced_tweets`. Decir
        ORIGINAL seria afirmar algo que no consta.
      */
      tipoPublicacion: TIPOS_PUBLICACION.NO_DETERMINADO,

      metricas,
      metricsObservedAt: observedAt,

      provider: "instagram_graph",
      observationMethod: "instagram_business_discovery",

      /*
        El evidenceId se deriva del permalink, que es la URL
        canonica de la publicacion. Asi la evidencia es
        REENCONTRABLE: cualquiera puede abrirla y comprobar que
        existe, hoy y en seis meses.

        Un id aleatorio serviria para deduplicar y para nada
        mas. Este ademas es estable entre ejecuciones, que es
        justo lo que impide duplicar la misma publicacion al
        volver a observar.
      */
      evidenceId:
        ev.evidenceId ||
        (ev.canonicalUrl ? `ev-ig-${idEstable(ev.canonicalUrl)}` : null)
    });
  });

  return salida(ESTADOS_OBSERVACION_REAL.OBSERVADA, {
    canal: perfil,
    metricasDeCuenta,
    publicaciones,

    esPropia,

    /*
      El campo que impide el falso positivo. No sale de la
      respuesta de Meta —ahi son identicas— sino de si el token
      administra la cuenta.
    */
    alcanceDeLaMedicion: esPropia ? "MEDIDO_PROPIO_AUTORIZADO" : "MEDIDO_TERCERO",

    notaAlcance: esPropia
      ? "El token administra esta cuenta: la consulta fue sobre un activo propio. NO demuestra acceso a terceros."
      : "Cuenta que no administramos. Esta si es una observacion de tercero.",

    tipoVerificado: "INSTAGRAM_PROFESSIONAL",

    evidenciaDelTipo:
      "business_discovery solo responde sobre cuentas Business o Creator, asi que responder ES la evidencia de que la cuenta es profesional.",

    notaIdentidad:
      "La observacion NO altera la resolucion de identidad. Que una cuenta se pueda leer no dice de quien es."
  });
}


/*
===========================================================
OBSERVAR LO QUE SE PUEDA DE UN CANDIDATO
===========================================================

Recorre sus cuentas y, para cada plataforma, o la observa o
declara por que no. La lista de estados es la respuesta honesta
a «que sabemos de este candidato»: no una lista de exitos.
===========================================================
*/
export async function observarCandidato(entrada = {}) {
  const {
    candidateId = null,
    projectId = null,
    cuentas = [],
    maximoPublicaciones = 5,
    observedAt = new Date().toISOString(),
    fetchImpl = undefined,
    plataformas = ["youtube"]
  } = entrada;

  const resultados = [];

  let unidades = 0;

  for (const cuenta of cuentas) {
    if (!plataformas.includes(cuenta.plataformaId)) {
      const cap = capacidad(cuenta.plataformaId, "publicaciones");

      resultados.push({
        plataformaId: cuenta.plataformaId,
        accountId: cuenta.id,
        estado:
          cap.estado === ESTADOS_CAPACIDAD.DISPONIBLE
            ? ESTADOS_OBSERVACION_REAL.NO_EJECUTABLE
            : ESTADOS_OBSERVACION_REAL.CAPACIDAD_NO_DISPONIBLE,
        publicaciones: [],
        motivo:
          cap.estado === ESTADOS_CAPACIDAD.DISPONIBLE
            ? "plataforma no incluida en esta ejecucion"
            : cap.nota,
        capacidad: cap
      });

      continue;
    }

    if (cuenta.plataformaId === "x") {
      const r = await observarX({
        candidateId,
        projectId,
        cuenta,
        maximoPublicaciones,
        observedAt,
        fetchImpl
      });

      unidades += r.traza?.unidadesConsumidas || 0;

      resultados.push(r);

      continue;
    }

    if (cuenta.plataformaId === "instagram") {
      const r = await observarInstagram({
        candidateId,
        projectId,
        cuenta,
        idParaBusinessDiscovery: entrada.idParaBusinessDiscovery || null,
        cuentasPropias: entrada.cuentasPropias || [],
        maximoPublicaciones,
        observedAt,
        fetchImpl
      });

      unidades += r.traza?.unidadesConsumidas || 0;

      resultados.push(r);

      continue;
    }

    if (cuenta.plataformaId === "youtube") {
      const r = await observarYouTube({
        candidateId,
        projectId,
        cuenta,
        maximoPublicaciones,
        observedAt,
        fetchImpl
      });

      unidades += r.traza?.unidadesConsumidas || 0;

      resultados.push(r);
    }
  }

  const publicaciones = resultados.flatMap((r) => r.publicaciones || []);

  return {
    candidateId,
    projectId,
    observedAt,

    resultados,
    publicaciones,

    unidadesConsumidas: unidades,

    resumen: {
      cuentas: cuentas.length,
      observadas: resultados.filter(
        (r) => r.estado === ESTADOS_OBSERVACION_REAL.OBSERVADA
      ).length,
      publicaciones: publicaciones.length,

      snapshots: publicaciones.reduce((s, p) => s + (p.metricas || []).length, 0)
    }
  };
}


export default {
  ESTADOS_OBSERVACION_REAL,
  clasificarBloqueo,
  observarYouTube,
  observarX,
  observarInstagram,
  observarCandidato
};
