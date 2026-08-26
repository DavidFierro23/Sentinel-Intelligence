// apps/backend/services/conversation/sourceUniverse.js

import { extraerDominio } from "../textUtils.js";
import { identificarFuente, TIPOS_FUENTE } from "./mediaRegistry.js";

/*
===========================================================
SOURCE UNIVERSE — quien habla, y como lo sabemos
===========================================================

El registro de que fuentes existen en un territorio, de donde
salio cada una y en que estado esta.

POR QUE HACE FALTA UN REGISTRO Y NO BASTA EL CATALOGO
-----------------------------------------------------------

`mediaRegistry` es un CATALOGO SEMILLA: una lista escrita a
mano de medios e instituciones conocidos. Responde «¿que es
elmercurio.com.ec?».

No responde «¿que fuentes hemos observado en Cuenca, cuando
aparecieron por primera vez, cuantas veces, y cuales entraron
por descubrimiento en lugar de por catalogo?». Eso es un
registro acumulado, y es lo que permite que el universo de
escucha CREZCA sin que nadie tenga que escribir la lista.

EL NUMERO QUE MOTIVO ESTE MODULO
-----------------------------------------------------------

La ultima prueba real declaro «7 fuentes». Auditado:

    12  YouTube          agregador   40 % del corpus
     9  El Mercurio      medio local
     3  El Universo      medio nacional
     3  Expreso          medio nacional
     1  Ecuavisa · Primicias · La Hora

La fuente mas grande NO era una fuente: era una plataforma, y
englobaba a doce emisores distintos que no sabemos cuales son.
«7 fuentes» sobrestimaba la diversidad real.

DOS REGLAS
-----------------------------------------------------------

1. DESCUBRIR NO ES VERIFICAR. Una fuente que aparece en la
   evidencia entra como DESCUBIERTA. Solo un catalogo con
   respaldo o un analista la mueven a VERIFICADA. Si el
   descubrimiento se autoverificase, el registro seria un
   espejo de la recoleccion y no una fuente de verdad.

2. SEGUIDORES NO CLASIFICAN. Nadie es CREADOR por tener
   audiencia: eso lo decide `sourceClassifier` con evidencia
   observable, y por defecto no lo decide.
===========================================================
*/


export const TIPOS_SOURCE = Object.freeze({
  MEDIA: "MEDIA",
  INSTITUTION: "INSTITUTION",
  CREATOR: "CREATOR",
  COMMUNITY: "COMMUNITY",
  ORGANIZATION: "ORGANIZATION",
  CANDIDATE: "CANDIDATE",

  /*
    PLATFORM es un tipo, no una propiedad, desde INGEST-REAL-01.

    Antes bastaba `esPlataforma: true` sobre un tipo cualquiera.
    Con seis proveedores hay que poder responder «¿esto es un
    emisor o el sitio donde el emisor publica?» sin mirar una
    bandera: youtube.com es una PLATAFORMA, y el canal que hay
    dentro es un CREATOR o un MEDIA.

    La bandera se conserva porque distingue a las plataformas de
    todo lo demas en un solo test, pero el tipo es el que manda.
  */
  PLATFORM: "PLATFORM",

  PUBLIC_WEB: "PUBLIC_WEB",
  OTHER: "OTHER"
});


/*
-----------------------------------------------------------
SUBTIPOS DE MEDIA

Un periodico y una radio no se leen igual ni publican igual.
La distincion la usara Media Intelligence; aqui solo se
conserva, y `null` es valido: no se adivina.
-----------------------------------------------------------
*/

export const SUBTIPOS_MEDIA = Object.freeze({
  PRENSA: "PRENSA",
  RADIO: "RADIO",
  TV: "TV",
  DIGITAL: "DIGITAL",
  PODCAST: "PODCAST",
  OTRO: "OTRO"
});


/*
-----------------------------------------------------------
ESTADOS — un ciclo, no una etiqueta

    DESCUBIERTA  se vio una vez; nada mas
    OBSERVADA    aparece de forma repetida en el corpus
    VERIFICADA   respaldada por catalogo o por un analista
    INACTIVA     no aparece desde hace tiempo
    BLOQUEADA    el proveedor no puede leerla

OBSERVADA no es un grado de confianza: es un hecho de
frecuencia. Una fuente puede estar muy observada y seguir sin
verificar, y eso es justo lo que hay que poder decir.
-----------------------------------------------------------
*/

export const ESTADOS_SOURCE = Object.freeze({
  DESCUBIERTA: "DESCUBIERTA",
  OBSERVADA: "OBSERVADA",
  VERIFICADA: "VERIFICADA",
  INACTIVA: "INACTIVA",
  BLOQUEADA: "BLOQUEADA"
});


export const ORIGENES_SOURCE = Object.freeze({
  CONFIGURACION: "configuracion_inicial",
  CATALOGO: "catalogo_semilla",
  DESCUBRIMIENTO_WEB: "descubrimiento_web",
  EVIDENCIA: "evidencia_observada",
  ENLACE_SALIENTE: "enlace_saliente",
  PROVEEDOR: "proveedor",
  ANALISTA: "analista"
});


/* Umbral para pasar de DESCUBIERTA a OBSERVADA. */
export const UMBRAL_OBSERVADA = 3;


/*
-----------------------------------------------------------
PLATAFORMAS

Un dominio de plataforma NO es un emisor. `youtube.com` no
publica: aloja. Marcarlo como fuente y contarlo junto a un
periodico inflaria la diversidad, que es exactamente el error
medido.

Se registran igual —hay que saber que el corpus pasa por ahi—
pero llevan `esPlataforma: true` y el calculo de diversidad los
trata aparte.
-----------------------------------------------------------
*/

const PLATAFORMAS = Object.freeze({
  "youtube.com": "YouTube",
  "youtu.be": "YouTube",
  "facebook.com": "Facebook",
  "instagram.com": "Instagram",
  "tiktok.com": "TikTok",
  "x.com": "X",
  "twitter.com": "X",
  "linkedin.com": "LinkedIn",
  "news.google.com": "Google News"
});


export function esPlataforma(dominio) {
  const d = String(dominio || "").toLowerCase();

  return Object.keys(PLATAFORMAS).some((p) => d === p || d.endsWith(`.${p}`));
}


export function nombrePlataforma(dominio) {
  const d = String(dominio || "").toLowerCase();

  const clave = Object.keys(PLATAFORMAS).find(
    (p) => d === p || d.endsWith(`.${p}`)
  );

  return clave ? PLATAFORMAS[clave] : null;
}


/*
-----------------------------------------------------------
DEL TIPO DEL CATALOGO AL TIPO DEL UNIVERSO

`mediaRegistry` distingue medio local / regional / nacional,
que es una distincion de COBERTURA. El universo distingue
MEDIA / INSTITUTION / ..., que es una distincion de NATURALEZA.

Las dos hacen falta y no se solapan: un medio local y uno
nacional son ambos MEDIA.
-----------------------------------------------------------
*/

function tipoDesdeCatalogo(tipoCatalogo) {
  switch (tipoCatalogo) {
    case TIPOS_FUENTE.MEDIO_LOCAL:
    case TIPOS_FUENTE.MEDIO_REGIONAL:
    case TIPOS_FUENTE.MEDIO_NACIONAL:
      return TIPOS_SOURCE.MEDIA;

    case TIPOS_FUENTE.INSTITUCION:
      return TIPOS_SOURCE.INSTITUTION;

    case TIPOS_FUENTE.PLATAFORMA:
    case TIPOS_FUENTE.AGREGADOR:
    case TIPOS_FUENTE.ENCICLOPEDICO:
      return TIPOS_SOURCE.PUBLIC_WEB;

    default:
      return TIPOS_SOURCE.OTHER;
  }
}


function fichaVacia(id) {
  return {
    id,

    /*
      `sourceId` estable. Para un dominio es el dominio; para un
      canal de plataforma es `plataforma:id`. Nunca la URL de un
      documento concreto: eso cambiaria en cada publicacion.
    */
    sourceId: id,

    nombre: null,
    tipo: TIPOS_SOURCE.OTHER,
    subtipo: null,

    url: null,
    website: null,
    dominio: null,
    plataforma: null,

    /* Solo feeds DECLARADOS o aportados. Nunca adivinados. */
    feedUrls: [],
    socialUrls: [],

    /* Territorio: null mientras no haya razon para afirmarlo. */
    territorio: null,
    territorioId: null,
    ciudad: null,
    provincia: null,
    pais: null,

    idioma: null,
    activa: true,

    origen: null,
    origenDescubrimiento: null,
    descubiertaPor: null,
    verificada: false,
    verificadaPor: null,
    verificadaEn: null,
    estado: ESTADOS_SOURCE.DESCUBIERTA,

    primeraObservacion: null,
    ultimaObservacion: null,

    /*
      Distinto de `ultimaObservacion`. Aquella es cuando la
      fuente publico; esta es cuando Sentinel miro. Sin la
      segunda, «no hemos mirado» se lee como «no ha publicado».
    */
    ultimaComprobacion: null,

    frecuenciaObservada: 0,

    providers: [],

    /*
      TODOS los proveedores que la han traido alguna vez, no
      solo los de esta ejecucion. Es lo que permite decir «esta
      fuente solo la trae GDELT» sin volver a ejecutarlo todo.
    */
    proveedoresHistoricos: [],

    esPlataforma: false,

    /*
      Campos de CREADOR / COMUNIDAD. Opcionales y vacios salvo
      que la fuente sea una cuenta de plataforma.

      `territoryClaim` es una DECLARACION del propio canal, no
      una localizacion: nunca autoriza a atribuir territorio ni
      a inferir residencia de nadie.
    */
    handle: null,
    displayName: null,
    descripcion: null,
    territoryClaim: null,
    verificationStatus: "NO_VERIFICADO",

    robotsMetadata: null,
    errores: [],
    metadata: {},

    /*
      Licencia y condiciones de uso: `null` mientras no se hayan
      leido. Un `null` aqui bloquea el uso comercial del
      contenido de esa fuente tanto como un «no permitido»: lo
      que no se ha comprobado no se puede afirmar.
    */
    licencia: null,
    terminosUrl: null,
    usoComercialPermitido: null,

    notas: [],
    procedencia: []
  };
}


/*
===========================================================
REGISTRO
===========================================================
*/

export function crearUniverso() {
  return {
    fuentes: new Map(),
    creado: null
  };
}


/*
-----------------------------------------------------------
REGISTRAR UNA OBSERVACION

Idempotente por id. Cada llamada acumula procedencia en lugar
de sobrescribirla: si una fuente entro por catalogo y luego
apareció en la evidencia, las dos cosas son ciertas y las dos
constan.
-----------------------------------------------------------
*/

export function registrarFuente(universo, entrada = {}) {
  const dominio =
    entrada.dominio || (entrada.url ? extraerDominio(entrada.url) : null);

  const id = entrada.id || dominio || (entrada.nombre || "").toLowerCase() || null;

  if (!id) return null;

  const existente = universo.fuentes.get(id);

  const f = existente || fichaVacia(id);

  /*
    Los campos identitarios NO se pisan una vez fijados. Una
    observacion posterior no puede renombrar una fuente ya
    conocida: eso perderia trazabilidad sin ganar nada.
  */
  f.nombre = f.nombre || entrada.nombre || null;

  f.dominio = f.dominio || dominio || null;

  f.url = f.url || entrada.url || null;

  if (entrada.tipo && f.tipo === TIPOS_SOURCE.OTHER) f.tipo = entrada.tipo;

  f.esPlataforma = f.esPlataforma || esPlataforma(f.dominio);

  f.plataforma = f.plataforma || nombrePlataforma(f.dominio);

  /*
    Una plataforma se tipa como PLATFORM salvo que ya se le
    haya dado otro tipo explicito. Es la correccion del error
    medido: youtube.com contaba como fuente editorial.

    Ojo: un CANAL de YouTube tiene id `youtube:UCxxxx`, no
    `youtube.com`, asi que NO cae aqui. El canal es un emisor;
    la plataforma no.
  */
  if (f.esPlataforma && f.tipo === TIPOS_SOURCE.OTHER) {
    f.tipo = TIPOS_SOURCE.PLATFORM;
  }

  if (entrada.idioma && !f.idioma) f.idioma = entrada.idioma;

  if (entrada.territorio && !f.territorio) f.territorio = entrada.territorio;

  if (entrada.ciudad && !f.ciudad) f.ciudad = entrada.ciudad;

  if (entrada.provincia && !f.provincia) f.provincia = entrada.provincia;

  if (entrada.pais && !f.pais) f.pais = entrada.pais;

  if (entrada.licencia && !f.licencia) f.licencia = entrada.licencia;

  if (entrada.terminosUrl && !f.terminosUrl) f.terminosUrl = entrada.terminosUrl;

  if (
    typeof entrada.usoComercialPermitido === "boolean" &&
    f.usoComercialPermitido === null
  ) {
    f.usoComercialPermitido = entrada.usoComercialPermitido;
  }

  /* --- procedencia acumulada --- */
  if (entrada.origen) {
    f.origen = f.origen || entrada.origen;

    const yaConsta = f.procedencia.some(
      (pr) => pr.origen === entrada.origen && pr.detalle === (entrada.detalle || null)
    );

    if (!yaConsta) {
      f.procedencia.push({
        origen: entrada.origen,
        detalle: entrada.detalle || null,
        instante: entrada.instante || null
      });
    }
  }

  f.descubiertaPor = f.descubiertaPor || entrada.descubiertaPor || entrada.origen || null;

  if (entrada.provider && !f.providers.includes(entrada.provider)) {
    f.providers.push(entrada.provider);
  }

  if (entrada.provider && !f.proveedoresHistoricos.includes(entrada.provider)) {
    f.proveedoresHistoricos.push(entrada.provider);
  }

  /* --- campos añadidos en INGEST-REAL-01 --- */

  if (entrada.subtipo && !f.subtipo) f.subtipo = entrada.subtipo;

  if (entrada.website && !f.website) f.website = entrada.website;

  if (entrada.territorioId && !f.territorioId) f.territorioId = entrada.territorioId;

  if (entrada.origenDescubrimiento && !f.origenDescubrimiento) {
    f.origenDescubrimiento = entrada.origenDescubrimiento;
  }

  if (entrada.checkedAt) f.ultimaComprobacion = entrada.checkedAt;

  if (entrada.robotsMetadata && !f.robotsMetadata) {
    f.robotsMetadata = entrada.robotsMetadata;
  }

  if (entrada.error) {
    f.errores.push({
      mensaje: entrada.error,
      instante: entrada.checkedAt || entrada.instante || null
    });
  }

  /* Feeds y cuentas: se acumulan sin duplicar. */
  (entrada.feedUrls || []).forEach((u) => {
    const url = typeof u === "string" ? u : u?.url;

    if (url && !f.feedUrls.some((x) => x.url === url)) {
      f.feedUrls.push({
        url,
        origen: typeof u === "string" ? "aportado" : u?.origen || "aportado"
      });
    }
  });

  (entrada.socialUrls || []).forEach((u) => {
    const url = typeof u === "string" ? u : u?.url;

    if (url && !f.socialUrls.some((x) => x.url === url)) {
      f.socialUrls.push({
        url,
        platform: typeof u === "string" ? null : u?.platform || null,

        /* Aparecer en una búsqueda no verifica una cuenta. */
        verificada: false
      });
    }
  });

  /* --- creador / comunidad --- */

  if (entrada.handle && !f.handle) f.handle = entrada.handle;

  if (entrada.displayName && !f.displayName) f.displayName = entrada.displayName;

  if (entrada.descripcion && !f.descripcion) f.descripcion = entrada.descripcion;

  /*
    Declaracion del propio canal. Se guarda con su marca y NO
    se copia a `territorio`: eso lo convertiria en una
    ubicacion afirmada, que es justo lo que no es.
  */
  if (entrada.territoryClaim && !f.territoryClaim) {
    f.territoryClaim = {
      ...entrada.territoryClaim,
      declarado: true,
      verificado: false
    };
  }

  if (entrada.nota && !f.notas.includes(entrada.nota)) f.notas.push(entrada.nota);

  /* --- frecuencia y fechas --- */
  if (entrada.cuentaObservacion !== false) {
    f.frecuenciaObservada += entrada.observaciones || 1;
  }

  const inst = entrada.instante || null;

  if (inst) {
    if (!f.primeraObservacion || inst < f.primeraObservacion) {
      f.primeraObservacion = inst;
    }

    if (!f.ultimaObservacion || inst > f.ultimaObservacion) {
      f.ultimaObservacion = inst;
    }
  }

  /*
    --- estado ---

    Solo se ASCIENDE por frecuencia hasta OBSERVADA. VERIFICADA
    exige acto explicito: nunca la otorga la observacion.
  */
  if (entrada.verificada === true) {
    f.verificada = true;

    f.estado = ESTADOS_SOURCE.VERIFICADA;

    f.verificadaPor = entrada.verificadaPor || f.verificadaPor;

    f.verificadaEn = entrada.checkedAt || entrada.instante || f.verificadaEn;
  } else if (entrada.estado && entrada.estado !== ESTADOS_SOURCE.VERIFICADA) {
    f.estado = entrada.estado;
  } else if (
    f.estado === ESTADOS_SOURCE.DESCUBIERTA &&
    f.frecuenciaObservada >= UMBRAL_OBSERVADA
  ) {
    f.estado = ESTADOS_SOURCE.OBSERVADA;
  }

  universo.fuentes.set(id, f);

  return f;
}


/*
-----------------------------------------------------------
VERIFICAR — acto explicito, con autor

Sin autor no se verifica. Una verificacion anonima no se puede
auditar ni revertir con criterio.
-----------------------------------------------------------
*/

export function verificarFuente(universo, id, { autor, motivo, instante = null } = {}) {
  const f = universo.fuentes.get(id);

  if (!f) return null;

  if (!autor || !motivo) {
    return {
      ...f,
      error:
        "Verificar exige autor y motivo. Una verificación sin autor no se puede auditar ni revertir."
    };
  }

  f.verificada = true;

  f.estado = ESTADOS_SOURCE.VERIFICADA;

  f.procedencia.push({
    origen: ORIGENES_SOURCE.ANALISTA,
    detalle: `Verificada por ${autor}: ${motivo}`,
    instante
  });

  return f;
}


/*
===========================================================
CONSTRUIR EL UNIVERSO DESDE UN CORPUS
===========================================================

Cada evidencia aporta como maximo una fuente. El catalogo
semilla resuelve el nombre y el tipo cuando puede; cuando no,
la fuente entra igual, como DESCUBIERTA y sin tipo afirmado.

Una fuente sin catalogo NO se descarta. Descartarla dejaria el
universo reducido a lo que alguien ya habia escrito, que es lo
contrario de escucha abierta.
===========================================================
*/

export function construirUniverso(evidencias = [], opciones = {}) {
  const universo = crearUniverso();

  evidencias.forEach((ev) => {
    const ident = identificarFuente(ev);

    const dominioReal = ident.dominio || extraerDominio(ev.url || ev.enlace || "");

    if (!dominioReal) return;

    registrarFuente(universo, {
      dominio: dominioReal,
      nombre: ident.nombre || ev.fuenteDeclarada || dominioReal,
      url: ev.url || ev.enlace || null,
      tipo: ident.nombre ? tipoDesdeCatalogo(ident.tipo) : TIPOS_SOURCE.OTHER,

      origen: ident.nombre
        ? ORIGENES_SOURCE.CATALOGO
        : ORIGENES_SOURCE.EVIDENCIA,

      detalle: ident.resueltoPorNombre
        ? "Publicador rescatado del sufijo del titular, no del dominio."
        : null,

      descubiertaPor: opciones.descubiertaPor || ORIGENES_SOURCE.EVIDENCIA,

      provider: ev.motorId || ev.origen || null,

      instante: ev.fecha || ev.instante || null,

      idioma: opciones.idioma || null
    });
  });

  return universo;
}


/*
-----------------------------------------------------------
LISTAR — con las cautelas visibles
-----------------------------------------------------------
*/

export function listarFuentes(universo, { incluirPlataformas = true } = {}) {
  const todas = [...universo.fuentes.values()];

  const lista = incluirPlataformas ? todas : todas.filter((f) => !f.esPlataforma);

  return lista.sort(
    (a, b) =>
      b.frecuenciaObservada - a.frecuenciaObservada ||
      String(a.nombre || a.id).localeCompare(String(b.nombre || b.id))
  );
}


export function estadoUniverso(universo) {
  const todas = [...universo.fuentes.values()];

  const porEstado = {};

  const porTipo = {};

  todas.forEach((f) => {
    porEstado[f.estado] = (porEstado[f.estado] || 0) + 1;

    porTipo[f.tipo] = (porTipo[f.tipo] || 0) + 1;
  });

  const plataformas = todas.filter((f) => f.esPlataforma);

  return {
    fuentes: todas.length,
    emisores: todas.length - plataformas.length,
    plataformas: plataformas.length,

    porEstado,
    porTipo,

    verificadas: todas.filter((f) => f.verificada).length,

    sinLicenciaComprobada: todas.filter((f) => f.usoComercialPermitido === null)
      .length,

    declaraciones: [
      "Una fuente DESCUBIERTA no está verificada. El descubrimiento no se autoverifica: si lo hiciera, el registro sería un espejo de la recolección.",
      "Una plataforma no es un emisor. YouTube alojando doce vídeos no son doce fuentes ni una fuente: son una plataforma con doce emisores sin identificar.",
      "`usoComercialPermitido: null` bloquea igual que `false`. Lo que no se ha comprobado no se puede afirmar."
    ]
  };
}


export default {
  TIPOS_SOURCE,
  ESTADOS_SOURCE,
  ORIGENES_SOURCE,
  UMBRAL_OBSERVADA,
  crearUniverso,
  registrarFuente,
  verificarFuente,
  construirUniverso,
  listarFuentes,
  estadoUniverso,
  esPlataforma,
  nombrePlataforma
};
