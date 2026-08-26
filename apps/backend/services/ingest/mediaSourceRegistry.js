// apps/backend/services/ingest/mediaSourceRegistry.js

import { extraerDominio } from "../textUtils.js";

/*
===========================================================
MEDIA SOURCE REGISTRY — INGEST-REAL-01
===========================================================

Donde vive lo que Sentinel sabe de cada medio: su sitio, sus
feeds, sus cuentas declaradas, su estado y de donde salio cada
dato.

POR QUE NO BASTA `conversation/mediaRegistry.js`
-----------------------------------------------------------

Aquel es un CATALOGO SEMILLA: una lista escrita a mano que
responde «¿que es elmercurio.com.ec?». Sigue haciendo falta y
no se toca.

Lo que no puede hacer es ACUMULAR. No guarda que feeds tiene un
medio, ni cuando se comprobo por ultima vez, ni si el intento
fallo. Y sin eso, cada ejecucion tiene que redescubrirlo todo:

    «Una fuente descubierta hoy no debe tener que descubrirse
     desde cero mañana.»

Ese es el proposito entero de este modulo.

`lastCheckedAt` ES LA RAZON DE SER
-----------------------------------------------------------

Sin el, un medio marcado SIN_RSS se reintentaria cada hora para
siempre. Con el, se sabe cuando se comprobo y se puede decidir
si merece la pena volver a mirar.

Y hay una distincion que ese campo protege:

    lastSeenAt     la ultima vez que el medio PUBLICO algo
    lastCheckedAt  la ultima vez que Sentinel MIRO

Confundirlas convierte «no hemos mirado» en «no ha publicado».

NO SE CALCULA INFLUENCIA
-----------------------------------------------------------

Ni aqui ni todavia. Que un medio aparezca mucho en el corpus
dice cuanto lo encontraron ESTAS consultas en ESTOS motores,
no cuanta gente lo lee. Media Intelligence usara este registro
como base, pero la influencia exige datos que no se tienen.
===========================================================
*/


export const TIPOS_MEDIO = Object.freeze({
  PRENSA: "PRENSA",
  RADIO: "RADIO",
  TV: "TV",
  DIGITAL: "DIGITAL",
  PODCAST: "PODCAST",
  OTRO: "OTRO"
});


export const ESTADOS_MEDIO = Object.freeze({
  DESCUBIERTO: "DESCUBIERTO",
  OBSERVADO: "OBSERVADO",
  VERIFICADO: "VERIFICADO",
  SIN_RSS: "SIN_RSS",
  INACCESIBLE: "INACCESIBLE",
  REQUIERE_REVISION: "REQUIERE_REVISION"
});


/*
  Igual que en el Source Universe: la observacion repetida
  asciende hasta OBSERVADO y NUNCA hasta VERIFICADO.
*/
export const UMBRAL_OBSERVADO = 3;


function fichaVacia(medioId) {
  return {
    medioId,
    sourceId: null,

    nombre: null,
    dominio: null,
    sitioWeb: null,

    /* Solo feeds DECLARADOS por el sitio o aportados por un analista. */
    rssFeeds: [],

    socialAccounts: [],

    tipoMedio: TIPOS_MEDIO.OTRO,

    /* null mientras no haya razon para afirmarlo. */
    territorio: null,
    territorioId: null,

    fuenteDescubrimiento: null,

    estado: ESTADOS_MEDIO.DESCUBIERTO,
    verificado: false,
    verificadoPor: null,
    verificadoEn: null,

    firstSeenAt: null,
    lastSeenAt: null,

    /*
      Distinto de lastSeenAt. Ver la cabecera: confundirlos
      convierte «no hemos mirado» en «no ha publicado».
    */
    lastCheckedAt: null,

    /* null bloquea igual que false: lo no comprobado no se afirma. */
    license: null,
    termsUrl: null,
    usoComercialPermitido: null,
    robotsMetadata: null,

    observaciones: 0,
    errores: [],

    procedencia: [],
    metadata: {}
  };
}


export function crearRegistroMedios() {
  return { medios: new Map() };
}


/*
-----------------------------------------------------------
REGISTRAR

Idempotente por dominio. Varios metodos pueden descubrir el
mismo medio —el catalogo, una evidencia, un enlace saliente—
y ninguno debe duplicarlo ni pisar lo que otro ya afirmo.
-----------------------------------------------------------
*/

export function registrarMedio(registro, entrada = {}) {
  const dominio =
    entrada.dominio ||
    (entrada.sitioWeb ? extraerDominio(entrada.sitioWeb) : null) ||
    (entrada.url ? extraerDominio(entrada.url) : null);

  const medioId = entrada.medioId || dominio;

  if (!medioId) return null;

  const m = registro.medios.get(medioId) || fichaVacia(medioId);

  /* --- identidad: no se pisa --- */
  m.dominio = m.dominio || dominio;
  m.nombre = m.nombre || entrada.nombre || dominio;
  m.sitioWeb = m.sitioWeb || entrada.sitioWeb || (dominio ? `https://${dominio}` : null);
  m.sourceId = m.sourceId || entrada.sourceId || dominio;

  if (entrada.tipoMedio && m.tipoMedio === TIPOS_MEDIO.OTRO) {
    m.tipoMedio = entrada.tipoMedio;
  }

  if (entrada.territorio && !m.territorio) m.territorio = entrada.territorio;

  if (entrada.territorioId && !m.territorioId) m.territorioId = entrada.territorioId;

  m.fuenteDescubrimiento = m.fuenteDescubrimiento || entrada.fuenteDescubrimiento || null;

  /* --- licencia: solo se rellena, nunca se relaja --- */
  if (entrada.license && !m.license) m.license = entrada.license;

  if (entrada.termsUrl && !m.termsUrl) m.termsUrl = entrada.termsUrl;

  if (
    typeof entrada.usoComercialPermitido === "boolean" &&
    m.usoComercialPermitido === null
  ) {
    m.usoComercialPermitido = entrada.usoComercialPermitido;
  }

  if (entrada.robotsMetadata && !m.robotsMetadata) {
    m.robotsMetadata = entrada.robotsMetadata;
  }

  /* --- feeds: se acumulan sin duplicar --- */
  (entrada.rssFeeds || []).forEach((f) => {
    const url = typeof f === "string" ? f : f?.url;

    if (!url || m.rssFeeds.some((x) => x.url === url)) return;

    m.rssFeeds.push({
      url,
      tipo: typeof f === "string" ? null : f?.tipo || null,
      titulo: typeof f === "string" ? null : f?.titulo || null,

      /*
        De donde salio el feed. Un feed declarado por el sitio
        es un compromiso del medio; uno aportado por un
        analista es una decision suya. No se mezclan.
      */
      origen: typeof f === "string" ? "aportado" : f?.origen || "aportado",

      estado: typeof f === "string" ? null : f?.estado || null,
      lastCheckedAt: null,
      ultimoError: null
    });
  });

  (entrada.socialAccounts || []).forEach((c) => {
    const url = typeof c === "string" ? c : c?.url;

    if (!url || m.socialAccounts.some((x) => x.url === url)) return;

    m.socialAccounts.push({
      url,
      platform: typeof c === "string" ? null : c?.platform || null,
      handle: typeof c === "string" ? null : c?.handle || null,

      /*
        Una cuenta encontrada por buscador NO esta verificada
        como del medio. Es la misma cautela de Handle
        Propagation.
      */
      verificada: false,
      origen: typeof c === "string" ? "aportado" : c?.origen || "aportado"
    });
  });

  /* --- procedencia acumulada --- */
  if (entrada.origen) {
    const yaConsta = m.procedencia.some(
      (p) => p.origen === entrada.origen && p.detalle === (entrada.detalle || null)
    );

    if (!yaConsta) {
      m.procedencia.push({
        origen: entrada.origen,
        detalle: entrada.detalle || null,
        instante: entrada.instante || null
      });
    }
  }

  /* --- observacion --- */
  if (entrada.cuentaObservacion !== false) {
    m.observaciones += entrada.observaciones || 1;
  }

  const inst = entrada.instante || null;

  if (inst) {
    if (!m.firstSeenAt || inst < m.firstSeenAt) m.firstSeenAt = inst;

    if (!m.lastSeenAt || inst > m.lastSeenAt) m.lastSeenAt = inst;
  }

  if (entrada.checkedAt) m.lastCheckedAt = entrada.checkedAt;

  if (entrada.error) {
    m.errores.push({
      mensaje: entrada.error,
      instante: entrada.checkedAt || inst || null
    });
  }

  /* --- estado --- */
  if (entrada.verificado === true && entrada.verificadoPor) {
    m.verificado = true;
    m.estado = ESTADOS_MEDIO.VERIFICADO;
    m.verificadoPor = entrada.verificadoPor;
    m.verificadoEn = entrada.checkedAt || inst || null;
  } else if (entrada.estado && entrada.estado !== ESTADOS_MEDIO.VERIFICADO) {
    m.estado = entrada.estado;
  } else if (
    m.estado === ESTADOS_MEDIO.DESCUBIERTO &&
    m.observaciones >= UMBRAL_OBSERVADO
  ) {
    m.estado = ESTADOS_MEDIO.OBSERVADO;
  }

  registro.medios.set(medioId, m);

  return m;
}


/*
-----------------------------------------------------------
ANOTAR EL RESULTADO DE COMPROBAR UN FEED

Se registra SIEMPRE, tanto si funciono como si no. Un fallo no
anotado se repite; uno anotado se puede espaciar.
-----------------------------------------------------------
*/

export function anotarComprobacionDeFeed(registro, medioId, { feedUrl, estado, error, checkedAt }) {
  const m = registro.medios.get(medioId);

  if (!m) return null;

  m.lastCheckedAt = checkedAt || m.lastCheckedAt;

  const feed = m.rssFeeds.find((f) => f.url === feedUrl);

  if (feed) {
    feed.estado = estado;
    feed.lastCheckedAt = checkedAt || null;
    feed.ultimoError = error || null;
  }

  if (error) m.errores.push({ mensaje: error, instante: checkedAt || null, feedUrl });

  /*
    Si NINGUN feed conocido responde, el medio pasa a
    INACCESIBLE —no a SIN_RSS—. Son cosas distintas: SIN_RSS
    significa «no publica feed»; INACCESIBLE significa «publica
    uno y no responde». La primera es del medio, la segunda
    puede ser nuestra.
  */
  if (m.rssFeeds.length > 0 && m.rssFeeds.every((f) => f.estado && f.estado !== "OK")) {
    if (!m.verificado) m.estado = ESTADOS_MEDIO.INACCESIBLE;
  }

  return m;
}


export function marcarSinRss(registro, medioId, { checkedAt, motivo } = {}) {
  const m = registro.medios.get(medioId);

  if (!m) return null;

  m.lastCheckedAt = checkedAt || m.lastCheckedAt;

  if (!m.verificado) m.estado = ESTADOS_MEDIO.SIN_RSS;

  m.metadata.motivoSinRss =
    motivo ||
    "El sitio no declara feed en su HTML. No se prueban rutas comunes ni se sustituye por raspado.";

  return m;
}


export function listarMedios(registro, filtro = {}) {
  let lista = [...registro.medios.values()];

  if (filtro.estado) lista = lista.filter((m) => m.estado === filtro.estado);

  if (filtro.conFeed) lista = lista.filter((m) => m.rssFeeds.length > 0);

  return lista.sort(
    (a, b) =>
      b.observaciones - a.observaciones ||
      String(a.nombre || a.medioId).localeCompare(String(b.nombre || b.medioId))
  );
}


export function estadoRegistroMedios(registro) {
  const todos = [...registro.medios.values()];

  const porEstado = {};

  const porTipo = {};

  todos.forEach((m) => {
    porEstado[m.estado] = (porEstado[m.estado] || 0) + 1;

    porTipo[m.tipoMedio] = (porTipo[m.tipoMedio] || 0) + 1;
  });

  return {
    medios: todos.length,
    porEstado,
    porTipo,

    conFeedConocido: todos.filter((m) => m.rssFeeds.length > 0).length,
    sinRss: todos.filter((m) => m.estado === ESTADOS_MEDIO.SIN_RSS).length,
    verificados: todos.filter((m) => m.verificado).length,

    nuncaComprobados: todos.filter((m) => !m.lastCheckedAt).length,

    sinLicenciaComprobada: todos.filter((m) => m.usoComercialPermitido === null).length,

    declaraciones: [
      "`lastSeenAt` es la última vez que el medio publicó; `lastCheckedAt` la última vez que Sentinel miró. Confundirlas convierte «no hemos mirado» en «no ha publicado».",
      "SIN_RSS significa que el medio no declara feed. INACCESIBLE significa que declara uno y no responde. La primera es del medio; la segunda puede ser nuestra.",
      "No se calcula influencia. Que un medio aparezca mucho dice cuánto lo encontraron ESTAS consultas, no cuánta gente lo lee.",
      "Ninguna cuenta social está verificada como del medio por haber aparecido en una búsqueda."
    ]
  };
}


export default {
  TIPOS_MEDIO,
  ESTADOS_MEDIO,
  crearRegistroMedios,
  registrarMedio,
  anotarComprobacionDeFeed,
  marcarSinRss,
  listarMedios,
  estadoRegistroMedios
};
