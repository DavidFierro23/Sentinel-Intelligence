// apps/backend/services/territorial/verifiedSourceUniverse.js

import { catalogoMedios, TIPOS_FUENTE } from "../conversation/mediaRegistry.js";

/*
===========================================================
UNIVERSO DE FUENTES VERIFICADO — TERRITORIAL-SOURCE-UNIVERSE-01
===========================================================

Que fuentes de un territorio se pueden LEER hoy, cual es su
feed, y con que evidencia se afirma cada cosa.

POR QUE HACIA FALTA ESTE MODULO Y NO OTRO CATALOGO
-----------------------------------------------------------

Ya habia tres piezas y ninguna respondia la pregunta:

  conversation/mediaRegistry.js   CATALOGO SEMILLA
      «¿que es elmercurio.com.ec?» — clasificacion escrita a
      mano. No sabe si tiene feed. NO SE TOCA.

  conversation/sourceUniverse.js  REGISTRO OBSERVADO
      «¿que fuentes han aparecido en la evidencia?» — crece con
      la recoleccion. Descubrir no es verificar.

  ingest/mediaSourceRegistry.js   FICHA ACUMULADA
      la estructura correcta —feeds, lastCheckedAt, procedencia—
      pero VIVE EN MEMORIA: cada arranque la olvida.

Falta lo que este modulo aporta: una lista de CANDIDATOS
territoriales derivada del catalogo, y el contrato de la ficha
que resulta de haber ido a comprobar cada uno de verdad.

EL DEFECTO ESTRUCTURAL QUE CIERRA
-----------------------------------------------------------

`territorialCollector` recibe `feeds` y, si llega vacia, declara
`SIN_FUENTES` y no ejecuta RSS. Correcto: no sale a descubrir
feeds en mitad de una recoleccion.

Pero NADIE le pasaba feeds nunca. `routes/territorio.js` los
tomaba solo del cuerpo de la peticion. Resultado medido en
TERRITORIAL-FRESH-01: RSS en `SIN_FUENTES` de forma permanente y
56 de 63 evidencias —el 89 %— entrando por un unico proveedor
que ademas oculta al publicador.

COMPROBADO NO ES VERIFICADO
-----------------------------------------------------------

Dos palabras distintas, a proposito:

  comprobado    Sentinel fue al sitio por HTTP y anoto que paso.
                Es una observacion nuestra, con fecha.

  verificado    contrastado contra un registro OFICIAL de medios
                por un analista.

Hoy `registroOficialContrastado` es `false` en TODAS las fichas:
no se ha consultado ningun registro oficial de medios del
Ecuador. Haber leido un feed no convierte a nadie en fuente
verificada; solo demuestra que el feed responde.

Una URL plausible no es una fuente comprobada. Un dominio que
alguien propuso y que nunca respondio termina en NO_RESUELTO, y
eso es lo que dice la ficha.
===========================================================
*/


export const VERSION_UNIVERSO = "1.0";


/*
-----------------------------------------------------------
ESTADOS

Cinco, y ninguno redundante. La diferencia entre ellos es
QUIEN tiene el problema y QUE se puede afirmar despues.
-----------------------------------------------------------
*/

export const ESTADOS_FUENTE = Object.freeze({
  /*
    El sitio DECLARA feed, el feed responde y trae entradas
    parseables. Es el UNICO estado que alimenta al recolector.
  */
  VERIFICADO_FEED: "VERIFICADO_FEED",

  /*
    La portada respondio y NO declara ningun feed.

    Es un hecho sobre el medio, no un fallo nuestro, y saberlo
    evita volver a pedirle la portada cada hora.
  */
  NO_PUBLICA_RSS: "NO_PUBLICA_RSS",

  /*
    La portada respondio y SI declara feed, pero ninguno resulto
    usable: no respondio, o respondio algo que no es un feed.

    Distinto de NO_PUBLICA_RSS: aqui el medio si ofrece feed. El
    sitio queda comprobado; el feed no.
  */
  VERIFICADO_SIN_FEED: "VERIFICADO_SIN_FEED",

  /*
    La portada no respondio: red, tiempo agotado, 4xx o 5xx.

    No se afirma nada sobre sus feeds, porque no se llego a
    mirar. Y el problema puede ser nuestro.
  */
  INACCESIBLE: "INACCESIBLE",

  /*
    No se llego a comprobar: sin homepage declarada, robots.txt
    lo desaconseja, o se agoto el presupuesto de la pasada.

    Nunca se afirma nada de una fuente en este estado.
  */
  NO_RESUELTO: "NO_RESUELTO"
});


/* Estados en los que el sitio SI respondio. */
const ESTADOS_COMPROBADOS = Object.freeze([
  ESTADOS_FUENTE.VERIFICADO_FEED,
  ESTADOS_FUENTE.NO_PUBLICA_RSS,
  ESTADOS_FUENTE.VERIFICADO_SIN_FEED
]);


export function esComprobado(estado) {
  return ESTADOS_COMPROBADOS.includes(estado);
}


/*
-----------------------------------------------------------
METODO DE DESCUBRIMIENTO

De donde salio la fuente. No es lo mismo una entrada del
catalogo que un dominio que alguien propuso.
-----------------------------------------------------------
*/

export const METODOS_DESCUBRIMIENTO = Object.freeze({
  CATALOGO_SEMILLA: "catalogo_semilla",
  DECLARADO_POR_ANALISTA: "declarado_por_analista",

  /*
    Un dominio propuesto es una HIPOTESIS. Se comprueba igual
    que los demas, y si no responde queda NO_RESUELTO: no se
    promueve por parecer razonable.
  */
  DOMINIO_PROPUESTO: "dominio_propuesto_por_analista"
});


export const ORIGEN_CLASIFICACION = Object.freeze({
  CATALOGO: "catalogo_semilla",
  ANALISTA: "declarada_por_analista",
  SIN_CLASIFICAR: "no_clasificado"
});


export const PRIORIDADES = Object.freeze({
  MEDIO_LOCAL: 1,
  MEDIO_REGIONAL_O_NACIONAL: 2,
  INSTITUCION_PUBLICA: 3,
  UNIVERSIDAD_O_ENTIDAD: 4,
  OTRA_FUENTE_PUBLICA: 5
});


/*
===========================================================
CANDIDATOS TERRITORIALES DECLARADOS

Lo que el catalogo semilla no trae y es relevante para
Cuenca / Azuay: empresas publicas municipales y universidades
con publicacion noticiosa.

Esto NO es un segundo catalogo de clasificacion de medios. Es
la lista de QUE COMPROBAR, y cada entrada declara de donde
salio. La clasificacion de los medios sigue viniendo de
`mediaRegistry`; aqui solo hay entidades que ese catalogo no
recoge, marcadas como declaradas por analista.

Ninguna entrada afirma tener feed. El feed lo decide la
comprobacion.
===========================================================
*/

const CANDIDATOS_DECLARADOS = [
  /* --- Empresas publicas del canton Cuenca --- */
  {
    dominio: "emov.gob.ec",
    nombre: "EMOV EP",
    tipo: TIPOS_FUENTE.INSTITUCION,
    subtipo: "EMPRESA_PUBLICA_MUNICIPAL",
    cobertura: { unidadId: "ec-azuay-cuenca", resolucion: "canton" },
    prioridad: PRIORIDADES.INSTITUCION_PUBLICA,
    metodo: METODOS_DESCUBRIMIENTO.DECLARADO_POR_ANALISTA,
    nota: "Movilidad y transito del canton. Dominio institucional .gob.ec."
  },
  {
    dominio: "emac.gob.ec",
    nombre: "EMAC EP",
    tipo: TIPOS_FUENTE.INSTITUCION,
    subtipo: "EMPRESA_PUBLICA_MUNICIPAL",
    cobertura: { unidadId: "ec-azuay-cuenca", resolucion: "canton" },
    prioridad: PRIORIDADES.INSTITUCION_PUBLICA,
    metodo: METODOS_DESCUBRIMIENTO.DECLARADO_POR_ANALISTA,
    nota: "Aseo y areas verdes del canton. Dominio institucional .gob.ec."
  },

  /* --- Universidades con sede en Cuenca --- */
  {
    dominio: "ucuenca.edu.ec",
    nombre: "Universidad de Cuenca",
    tipo: TIPOS_FUENTE.INSTITUCION,
    subtipo: "UNIVERSIDAD_PUBLICA",
    cobertura: { unidadId: "ec-azuay-cuenca", resolucion: "canton" },
    prioridad: PRIORIDADES.UNIVERSIDAD_O_ENTIDAD,
    metodo: METODOS_DESCUBRIMIENTO.DECLARADO_POR_ANALISTA,
    nota: "Universidad publica con sede en el canton."
  },
  {
    dominio: "uazuay.edu.ec",
    nombre: "Universidad del Azuay",
    tipo: TIPOS_FUENTE.INSTITUCION,
    subtipo: "UNIVERSIDAD_PRIVADA",
    cobertura: { unidadId: "ec-azuay-cuenca", resolucion: "canton" },
    prioridad: PRIORIDADES.UNIVERSIDAD_O_ENTIDAD,
    metodo: METODOS_DESCUBRIMIENTO.DECLARADO_POR_ANALISTA,
    nota: "Universidad privada con sede en el canton. Se declara privada: no es entidad publica."
  },
  {
    dominio: "ups.edu.ec",
    nombre: "Universidad Politecnica Salesiana",
    tipo: TIPOS_FUENTE.INSTITUCION,
    subtipo: "UNIVERSIDAD_PRIVADA",

    /*
      Multisede. No se declara cobertura cantonal: su
      publicacion no es especifica de Cuenca.
    */
    cobertura: null,
    prioridad: PRIORIDADES.UNIVERSIDAD_O_ENTIDAD,
    metodo: METODOS_DESCUBRIMIENTO.DECLARADO_POR_ANALISTA,
    nota: "Universidad privada multisede, una de ellas en Cuenca. Cobertura territorial no declarada."
  },

  /*
    --- CONFIRMADO en TERRITORIAL-LOCAL-SOURCE-EXPANSION-01 ---

    Entro como DOMINIO_PROPUESTO en §13-undecies y respondio. Ya
    no es una hipotesis: hay evidencia publica de que
    `lavozdeltomebamba.com` es el sitio oficial de La Voz del
    Tomebamba, emisora de Cuenca en 1070 AM y 102.1 FM.

    Se declara MEDIO_LOCAL con cobertura cantonal. Aportaba 10
    evidencias contadas como «nacional / sin declarar» solo
    porque nadie la habia clasificado.

    Y de paso corrige el catalogo: `radiotomebamba.com.ec` da
    ENOTFOUND y las guias de radio apuntan a la MISMA emisora en
    102.1. El dominio del catalogo semilla esta equivocado; el
    real es este.
  */
  {
    dominio: "lavozdeltomebamba.com",
    nombre: "La Voz del Tomebamba",
    tipo: TIPOS_FUENTE.MEDIO_LOCAL,
    subtipo: "RADIO",
    cobertura: { unidadId: "ec-azuay-cuenca", resolucion: "canton" },
    prioridad: PRIORIDADES.MEDIO_LOCAL,
    metodo: METODOS_DESCUBRIMIENTO.DECLARADO_POR_ANALISTA,
    nota:
      "Emisora de Cuenca (1070 AM / 102.1 FM). Sitio oficial confirmado contra evidencia publica. Sustituye a la entrada erronea `radiotomebamba.com.ec`, que no resuelve."
  },

  /*
    --- Empresas publicas del canton no cubiertas todavia ---

    Entran como DOMINIO_PROPUESTO: son empresas publicas
    municipales de Cuenca cuya existencia es publica, pero el
    dominio exacto NO esta confirmado. La comprobacion decide, y
    si no responde queda NO_RESUELTO sin ascender.
  */
  {
    dominio: "farmasol.gob.ec",
    nombre: "Farmasol EP (propuesto)",
    tipo: null,
    subtipo: null,
    cobertura: { unidadId: "ec-azuay-cuenca", resolucion: "canton" },
    prioridad: PRIORIDADES.INSTITUCION_PUBLICA,
    metodo: METODOS_DESCUBRIMIENTO.DOMINIO_PROPUESTO,
    nota: "Empresa publica municipal de Cuenca. Dominio propuesto, sin confirmar."
  },
  {
    dominio: "emuvi.gob.ec",
    nombre: "EMUVI EP (propuesto)",
    tipo: null,
    subtipo: null,
    cobertura: { unidadId: "ec-azuay-cuenca", resolucion: "canton" },
    prioridad: PRIORIDADES.INSTITUCION_PUBLICA,
    metodo: METODOS_DESCUBRIMIENTO.DOMINIO_PROPUESTO,
    nota: "Empresa municipal de vivienda de Cuenca. Dominio propuesto, sin confirmar."
  },
  {
    dominio: "bomberos.gob.ec",
    nombre: "Cuerpo de Bomberos de Cuenca (propuesto)",
    tipo: null,
    subtipo: null,
    cobertura: null,
    prioridad: PRIORIDADES.INSTITUCION_PUBLICA,
    metodo: METODOS_DESCUBRIMIENTO.DOMINIO_PROPUESTO,
    nota:
      "Dominio propuesto. Puede ser nacional en lugar de cantonal: por eso NO se declara cobertura."
  },

  /*
    --- Observado en el agregador, ambito por confirmar ---

    `Ecuador 221` aparecio seis veces en las consultas de Google
    News sobre Cuenca. Que aparezca NO lo hace local —ese
    criterio seria circular— asi que entra sin tipo ni cobertura.
  */
  {
    dominio: "ecuador221.com",
    nombre: "Ecuador 221 (propuesto)",
    tipo: null,
    subtipo: null,
    cobertura: null,
    prioridad: PRIORIDADES.MEDIO_REGIONAL_O_NACIONAL,
    metodo: METODOS_DESCUBRIMIENTO.DOMINIO_PROPUESTO,
    nota:
      "Observado en el agregador cubriendo Cuenca. Ambito sin confirmar: aparecer en una consulta territorial no clasifica a un medio como local."
  },

  /*
    --- Club deportivo del canton ---

    El gate pregunta explicitamente por Deportivo Cuenca. Existe
    como club; el dominio NO esta confirmado.
  */
  {
    dominio: "deportivocuenca.com",
    nombre: "Deportivo Cuenca (propuesto)",
    tipo: null,
    subtipo: "CLUB",
    cobertura: { unidadId: "ec-azuay-cuenca", resolucion: "canton" },
    prioridad: PRIORIDADES.OTRA_FUENTE_PUBLICA,
    metodo: METODOS_DESCUBRIMIENTO.DOMINIO_PROPUESTO,
    nota: "Club de futbol del canton. Dominio propuesto, sin confirmar."
  }
];


/*
-----------------------------------------------------------
PRIORIDAD DE UNA ENTRADA DEL CATALOGO
-----------------------------------------------------------
*/

function prioridadDeTipo(tipo, cobertura) {
  if (tipo === TIPOS_FUENTE.MEDIO_LOCAL) return PRIORIDADES.MEDIO_LOCAL;

  if (tipo === TIPOS_FUENTE.MEDIO_REGIONAL) return PRIORIDADES.MEDIO_REGIONAL_O_NACIONAL;

  if (tipo === TIPOS_FUENTE.MEDIO_NACIONAL) return PRIORIDADES.MEDIO_REGIONAL_O_NACIONAL;

  if (tipo === TIPOS_FUENTE.INSTITUCION) return PRIORIDADES.INSTITUCION_PUBLICA;

  return cobertura ? PRIORIDADES.OTRA_FUENTE_PUBLICA : PRIORIDADES.OTRA_FUENTE_PUBLICA;
}


/*
  ¿Cubre esta entrada el territorio pedido?

  `ec-azuay-cuenca` es hijo de `ec-azuay`: una fuente provincial
  cubre el canton. Al reves NO.
*/
function cubreTerritorio(cobertura, territorioId) {
  if (!cobertura?.unidadId || !territorioId) return false;

  return territorioId === cobertura.unidadId || territorioId.startsWith(`${cobertura.unidadId}-`);
}


/*
===========================================================
CANDIDATOS PARA UN TERRITORIO

Tres grupos, y cada uno con su razon declarada:

  1  cobertura territorial declarada en el catalogo
  2  nacionales SIN cobertura medida de este territorio
  3  candidatos declarados por analista

El grupo 2 se incluye porque sus feeds son legibles y gratis,
pero su ficha dice `coberturaTerritorialMedida: false`. Que un
medio nacional publique sobre Cuenca no lo hace local —eso
seria circular, y el catalogo semilla ya lo advierte—.
===========================================================
*/

export function candidatosPara(territorioId, opciones = {}) {
  const incluirNacionales = opciones.incluirNacionales !== false;

  const catalogo = catalogoMedios();

  const candidatos = [];

  catalogo.medios.forEach((m) => {
    const cubre = cubreTerritorio(m.cobertura, territorioId);

    const esNacional = m.tipo === TIPOS_FUENTE.MEDIO_NACIONAL;

    if (!cubre && !(esNacional && incluirNacionales)) return;

    candidatos.push({
      sourceId: m.dominio,
      dominio: m.dominio,
      nombre: m.nombre,
      tipo: m.tipo,
      subtipo: null,

      origenClasificacion: ORIGEN_CLASIFICACION.CATALOGO,

      territorioDeclarado: cubre ? m.cobertura.unidadId : null,
      resolucionCobertura: cubre ? m.cobertura.resolucion : null,
      coberturaTerritorialMedida: false,

      prioridad: prioridadDeTipo(m.tipo, m.cobertura),
      metodoDescubrimiento: METODOS_DESCUBRIMIENTO.CATALOGO_SEMILLA,

      homepage: `https://${m.dominio}`,

      nota: cubre
        ? null
        : "Ámbito nacional. Su cobertura de este territorio NO está medida: se incluye porque su feed es legible sin coste, no porque sea local."
    });
  });

  CANDIDATOS_DECLARADOS.forEach((c) => {
    const cubre = cubreTerritorio(c.cobertura, territorioId);

    /*
      Un candidato declarado sin cobertura entra igual: la
      declaro un analista para ESTE trabajo territorial y la
      ficha dice que su cobertura no esta declarada.
    */
    if (c.cobertura && !cubre) return;

    if (candidatos.some((x) => x.dominio === c.dominio)) return;

    candidatos.push({
      sourceId: c.dominio,
      dominio: c.dominio,
      nombre: c.nombre,
      tipo: c.tipo,
      subtipo: c.subtipo || null,

      origenClasificacion: c.tipo
        ? ORIGEN_CLASIFICACION.ANALISTA
        : ORIGEN_CLASIFICACION.SIN_CLASIFICAR,

      territorioDeclarado: cubre ? c.cobertura.unidadId : null,
      resolucionCobertura: cubre ? c.cobertura.resolucion : null,
      coberturaTerritorialMedida: false,

      prioridad: c.prioridad,
      metodoDescubrimiento: c.metodo,

      homepage: `https://${c.dominio}`,

      nota: c.nota || null
    });
  });

  return candidatos.sort(
    (a, b) => a.prioridad - b.prioridad || a.nombre.localeCompare(b.nombre)
  );
}


/*
===========================================================
FICHA DE FUENTE

El resultado de haber ido a comprobar un candidato. Todo lo
que no se comprobo es `null`, nunca un valor por defecto
optimista.
===========================================================
*/

export function fichaDeFuente(candidato, resultado = {}) {
  const estado = resultado.estado || ESTADOS_FUENTE.NO_RESUELTO;

  return {
    version: VERSION_UNIVERSO,

    sourceId: candidato.sourceId,
    nombre: candidato.nombre,
    dominio: candidato.dominio,

    tipo: candidato.tipo || null,
    subtipo: candidato.subtipo || null,
    origenClasificacion: candidato.origenClasificacion,

    territorioDeclarado: candidato.territorioDeclarado || null,
    resolucionCobertura: candidato.resolucionCobertura || null,
    coberturaTerritorialMedida: false,

    prioridad: candidato.prioridad,

    homepage: candidato.homepage || null,

    /*
      Feeds COMPROBADOS. Un feed declarado por el sitio que no
      respondio no entra aqui: entra en `feedsDescartados`.
    */
    feeds: resultado.feeds || [],
    feedsDescartados: resultado.feedsDescartados || [],

    metodoDescubrimiento: candidato.metodoDescubrimiento,

    /*
      Comprobado por Sentinel via HTTP, con fecha. NO es lo
      mismo que verificado contra un registro oficial.
    */
    comprobadoEn: resultado.comprobadoEn || null,
    comprobado: esComprobado(estado),

    estadoVerificacion: estado,

    /*
      Ningun registro oficial de medios del Ecuador ha sido
      consultado. Se declara en cada ficha para que nadie lea
      «comprobado» como «verificado».
    */
    registroOficialContrastado: false,

    /* Cada afirmacion, con su origen y su instante. */
    procedencia: resultado.procedencia || [],

    robots: resultado.robots || null,

    /* Licencia y terminos: nadie los ha leido. null bloquea. */
    licencia: null,
    terminosUrl: null,
    usoComercialPermitido: null,

    restricciones: resultado.restricciones || [],

    observaciones: resultado.observaciones || candidato.nota || null,

    motivo: resultado.motivo || null
  };
}


/*
===========================================================
RESOLVER LOS FEEDS QUE ALIMENTAN AL RECOLECTOR

Solo VERIFICADO_FEED. Un feed que no respondio no se le pasa
al recolector «por si acaso»: gastaria la pasada y volveria a
fallar.

La forma de salida es la que `territorialCollector` ya espera
—`{ url, publisher, sourceId }`—. No se cambia el contrato del
recolector ni se reimplementa RSS.
===========================================================
*/

/*
  Un feed de COMENTARIOS no es la agenda del medio: es la
  reaccion de sus lectores. WordPress declara los dos en el
  mismo `link rel=alternate` y, medido en la pasada real, el de
  comentarios se comio una plaza de las ocho disponibles y metio
  diez comentarios en el corpus etiquetados como NOTICIA.

  No se borra de la ficha —el sitio lo declara y eso es un
  hecho— pero no se recolecta como noticia.
*/
const RE_FEED_DE_COMENTARIOS = /\/comments\/feed\/?$|\/comentarios\/feed\/?$/i;


export function esFeedDeComentarios(url) {
  try {
    return RE_FEED_DE_COMENTARIOS.test(new URL(url).pathname);
  } catch {
    return false;
  }
}


/*
  ORDEN DE RECOLECCION

  Primero lo que tiene territorio DECLARADO, y solo despues la
  prioridad. Sin esto, en la pasada real los nacionales de P2
  —cuya cobertura de Azuay NO esta medida— desplazaron a EMAC,
  EMOV y ETAPA, que son del canton. En un modulo territorial eso
  es exactamente el orden inverso al que sirve.
*/
function ordenDeRecoleccion(a, b) {
  const territorial = (f) => (f.territorioDeclarado ? 0 : 1);

  return territorial(a) - territorial(b) || a.prioridad - b.prioridad;
}


export function feedsParaRecoleccion(fichas = [], opciones = {}) {
  const limite = opciones.limite || null;

  const incluirComentarios = opciones.incluirComentarios === true;

  const feeds = [];

  [...fichas]
    .sort(ordenDeRecoleccion)
    .forEach((f) => {
      if (f.estadoVerificacion !== ESTADOS_FUENTE.VERIFICADO_FEED) return;

      f.feeds.forEach((feed) => {
        /*
          Un feed valido pero VACIO no se le pasa al recolector:
          gastaria la pasada para traer cero entradas. Se queda
          en la ficha, que es donde consta que existe.
        */
        if (feed.conContenido === false) return;

        if (!incluirComentarios && (feed.esDeComentarios || esFeedDeComentarios(feed.url))) return;

        if (feeds.some((x) => x.url === feed.url)) return;

        feeds.push({
          url: feed.url,
          publisher: f.nombre,
          sourceId: f.sourceId,
          prioridad: f.prioridad,
          territorioDeclarado: f.territorioDeclarado || null
        });
      });
    });

  return limite ? feeds.slice(0, limite) : feeds;
}


/*
===========================================================
ESTADO DEL UNIVERSO
===========================================================
*/

export function estadoUniverso(fichas = []) {
  const porEstado = {};

  const porPrioridad = {};

  fichas.forEach((f) => {
    porEstado[f.estadoVerificacion] = (porEstado[f.estadoVerificacion] || 0) + 1;

    porPrioridad[f.prioridad] = (porPrioridad[f.prioridad] || 0) + 1;
  });

  const conFeed = fichas.filter((f) => f.estadoVerificacion === ESTADOS_FUENTE.VERIFICADO_FEED);

  return {
    fuentes: fichas.length,

    porEstado,
    porPrioridad,

    comprobadas: fichas.filter((f) => f.comprobado).length,
    conFeedValido: conFeed.length,
    feedsValidos: conFeed.reduce((n, f) => n + f.feeds.length, 0),

    sinClasificar: fichas.filter(
      (f) => f.origenClasificacion === ORIGEN_CLASIFICACION.SIN_CLASIFICAR
    ).length,

    /* Nadie ha leido licencias: se cuenta y se dice. */
    sinLicenciaComprobada: fichas.filter((f) => f.usoComercialPermitido === null).length,

    registroOficialContrastado: false,

    declaraciones: [
      "«Comprobado» significa que Sentinel fue al sitio por HTTP y anotó qué pasó. «Verificado» significaría contrastado contra un registro oficial de medios: hoy NINGUNA ficha lo está.",
      "NO_PUBLICA_RSS es un hecho sobre el medio: la portada respondió y no declara feed. VERIFICADO_SIN_FEED es que sí declara feed y no resultó usable. INACCESIBLE es que la portada no respondió, y eso puede ser nuestro.",
      "NO_RESUELTO no afirma nada: es que no se llegó a comprobar. Un dominio propuesto que nunca respondió se queda aquí y NO asciende por parecer razonable.",
      "Solo VERIFICADO_FEED alimenta al recolector. Ningún feed entra por haber sido adivinado: se lee el `link rel=alternate` que el propio sitio declara.",
      "La cobertura territorial de los medios nacionales NO está medida. Que publiquen sobre el territorio no los hace locales: ese criterio sería circular.",
      "Un feed de comentarios NO es la agenda del medio: consta en la ficha porque el sitio lo declara, pero no se recolecta como noticia.",
      "Licencia y términos de uso siguen sin leer en todas las fichas: `usoComercialPermitido` es null y null bloquea igual que false."
    ]
  };
}


export default {
  VERSION_UNIVERSO,
  ESTADOS_FUENTE,
  METODOS_DESCUBRIMIENTO,
  ORIGEN_CLASIFICACION,
  PRIORIDADES,
  esComprobado,
  esFeedDeComentarios,
  candidatosPara,
  fichaDeFuente,
  feedsParaRecoleccion,
  estadoUniverso
};
