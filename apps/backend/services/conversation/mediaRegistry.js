// apps/backend/services/conversation/mediaRegistry.js

import { extraerDominio } from "../textUtils.js";

/*
===========================================================
MEDIA REGISTRY — quien publica y que territorio cubre
===========================================================

Dos funciones, y conviene no confundirlas:

  1. CLASIFICAR la fuente de una evidencia: medio local,
     medio nacional, institucion, plataforma o desconocido.

  2. DECLARAR su AMBITO DE COBERTURA, que el Geo Resolver usa
     como contexto para desambiguar toponimos.

La segunda tiene consecuencias reales: que este registro diga
que `elmercurio.com.ec` cubre el canton Cuenca es lo que
permite resolver "El Batan" sin que la nota repita "Cuenca".
Una entrada equivocada aqui produce ubicaciones equivocadas
alla.

POR ESO, TRES CAUTELAS
-----------------------------------------------------------

  a) Todo el catalogo nace con `verificado: false`. Son datos
     semilla, no un padron de medios. Se curan con el uso.

  b) Un dominio DESCONOCIDO no recibe ambito de cobertura. El
     valor por defecto es "no se sabe", nunca "nacional" ni
     "local". Sin esto, cualquier blog desconocido desambiguaria
     toponimos como si fuera prensa local.

  c) La cobertura de un medio NACIONAL es el pais, y el Geo
     Resolver ya exige cobertura de provincia o mas fina para
     desambiguar. Un medio nacional, por tanto, no desambigua
     nada. Es deliberado.

LO QUE ESTE REGISTRO NO HACE
-----------------------------------------------------------

No mide alcance, ni audiencia, ni credibilidad, ni linea
editorial. Un ranking de medios por "influencia" sin datos de
audiencia seria una opinion con formato de metrica.

Y no mezcla medios con cuentas del objetivo: esa es una regla
congelada del Protocolo Universal (ARQ-PUI-001). Un medio que
cubre al objetivo es contexto, no identidad.
===========================================================
*/


export const TIPOS_FUENTE = Object.freeze({
  MEDIO_LOCAL: "medio_local",
  MEDIO_REGIONAL: "medio_regional",
  MEDIO_NACIONAL: "medio_nacional",
  INSTITUCION: "institucion",
  PLATAFORMA: "plataforma",
  AGREGADOR: "agregador",
  ENCICLOPEDICO: "enciclopedico",
  DESCONOCIDO: "desconocido"
});


/*
-----------------------------------------------------------
EL CRITERIO — verificable, no circular

    medio_local      redaccion o sede en el canton
    medio_regional   ambito provincial declarado
    medio_nacional   circulacion nacional

Lo que NO define a un medio local: haber publicado sobre
Cuenca. Ese criterio seria circular —cualquier medio que
aparezca en una busqueda territorial se clasificaria como
local— y convertiria el panel de medios en un espejo de la
propia consulta.

La clasificacion sale del CATALOGO, no de la evidencia. Un
dominio que no esta en el catalogo se queda en `desconocido`
por mucho que publique sobre el territorio.

`medio_regional` esta declarado y hoy VACIO: no hay ningun
medio de ambito estrictamente provincial cuya sede se pueda
afirmar sin verificar. Declarar la categoria y dejarla vacia
es mejor que meter un medio nacional en ella o que fingir que
la distincion no existe.
-----------------------------------------------------------
*/

export const CRITERIO_CLASIFICACION = Object.freeze({
  medio_local: "Redaccion o sede declarada en el canton.",
  medio_regional: "Ambito de circulacion provincial declarado.",
  medio_nacional: "Circulacion nacional.",
  noEsCriterio:
    "Haber publicado sobre el territorio NO clasifica a un medio como local: seria circular.",
  procedencia:
    "La clasificacion sale del catalogo semilla, nunca de la evidencia recolectada.",
  verificacion:
    "Ninguna entrada esta contrastada contra un registro oficial de medios: todas llevan verificado:false."
});


/*
-----------------------------------------------------------
CATALOGO SEMILLA

`cobertura` usa ids del Territory Registry. Solo se declara
cuando hay una razon clara: un medio con sede y redaccion en
Cuenca cubre Cuenca.

Ausente = no se sabe = no desambigua. Es el caso por defecto.
-----------------------------------------------------------
*/

const CATALOGO = [
  /* --- Prensa con base en Cuenca / Azuay --- */
  {
    dominio: "elmercurio.com.ec",
    nombre: "El Mercurio",
    tipo: TIPOS_FUENTE.MEDIO_LOCAL,
    cobertura: { unidadId: "ec-azuay-cuenca", resolucion: "canton" }
  },
  {
    dominio: "eltiempo.com.ec",
    nombre: "El Tiempo",
    tipo: TIPOS_FUENTE.MEDIO_LOCAL,
    cobertura: { unidadId: "ec-azuay-cuenca", resolucion: "canton" }
  },
  {
    dominio: "radiotomebamba.com.ec",
    nombre: "Radio Tomebamba",
    tipo: TIPOS_FUENTE.MEDIO_LOCAL,
    cobertura: { unidadId: "ec-azuay-cuenca", resolucion: "canton" }
  },
  {
    dominio: "unsion.tv",
    nombre: "Unsion TV",
    tipo: TIPOS_FUENTE.MEDIO_LOCAL,
    cobertura: { unidadId: "ec-azuay-cuenca", resolucion: "canton" }
  },
  {
    dominio: "ondacero.com.ec",
    nombre: "Radio Onda Cero",
    tipo: TIPOS_FUENTE.MEDIO_LOCAL,
    cobertura: { unidadId: "ec-azuay-cuenca", resolucion: "canton" }
  },

  /* --- Prensa nacional --- */
  { dominio: "elcomercio.com", nombre: "El Comercio", tipo: TIPOS_FUENTE.MEDIO_NACIONAL },
  { dominio: "eluniverso.com", nombre: "El Universo", tipo: TIPOS_FUENTE.MEDIO_NACIONAL },
  { dominio: "primicias.ec", nombre: "Primicias", tipo: TIPOS_FUENTE.MEDIO_NACIONAL },
  { dominio: "ecuavisa.com", nombre: "Ecuavisa", tipo: TIPOS_FUENTE.MEDIO_NACIONAL },
  { dominio: "teleamazonas.com", nombre: "Teleamazonas", tipo: TIPOS_FUENTE.MEDIO_NACIONAL },
  { dominio: "expreso.ec", nombre: "Expreso", tipo: TIPOS_FUENTE.MEDIO_NACIONAL },
  { dominio: "lahora.com.ec", nombre: "La Hora", tipo: TIPOS_FUENTE.MEDIO_NACIONAL },
  { dominio: "eltelegrafo.com.ec", nombre: "El Telegrafo", tipo: TIPOS_FUENTE.MEDIO_NACIONAL },
  { dominio: "extra.ec", nombre: "Extra", tipo: TIPOS_FUENTE.MEDIO_NACIONAL },
  { dominio: "vistazo.com", nombre: "Vistazo", tipo: TIPOS_FUENTE.MEDIO_NACIONAL },
  { dominio: "planv.com.ec", nombre: "Plan V", tipo: TIPOS_FUENTE.MEDIO_NACIONAL },
  { dominio: "gk.city", nombre: "GK", tipo: TIPOS_FUENTE.MEDIO_NACIONAL },
  { dominio: "ecuadorinmediato.com", nombre: "Ecuador Inmediato", tipo: TIPOS_FUENTE.MEDIO_NACIONAL },
  { dominio: "laposta.ec", nombre: "La Posta", tipo: TIPOS_FUENTE.MEDIO_NACIONAL },

  /* --- Instituciones --- */
  {
    dominio: "cuenca.gob.ec",
    nombre: "GAD Municipal de Cuenca",
    tipo: TIPOS_FUENTE.INSTITUCION,
    cobertura: { unidadId: "ec-azuay-cuenca", resolucion: "canton" }
  },
  {
    dominio: "etapa.net.ec",
    nombre: "ETAPA EP",
    tipo: TIPOS_FUENTE.INSTITUCION,
    cobertura: { unidadId: "ec-azuay-cuenca", resolucion: "canton" }
  },
  {
    dominio: "azuay.gob.ec",
    nombre: "Prefectura del Azuay",
    tipo: TIPOS_FUENTE.INSTITUCION,
    cobertura: { unidadId: "ec-azuay", resolucion: "provincia" }
  },
  { dominio: "cne.gob.ec", nombre: "Consejo Nacional Electoral", tipo: TIPOS_FUENTE.INSTITUCION },
  { dominio: "presidencia.gob.ec", nombre: "Presidencia de la Republica", tipo: TIPOS_FUENTE.INSTITUCION },
  { dominio: "asambleanacional.gob.ec", nombre: "Asamblea Nacional", tipo: TIPOS_FUENTE.INSTITUCION },
  { dominio: "inec.gob.ec", nombre: "INEC", tipo: TIPOS_FUENTE.INSTITUCION }
];


/*
  Dominios que NO son fuentes originales. Su presencia no dice
  quien publico: news.google.com es un escaparate, no un medio.
*/
const AGREGADORES = ["news.google.com", "google.com", "webcache.googleusercontent.com", "msn.com"];

const ENCICLOPEDICOS = ["wikipedia.org", "wikidata.org", "wikimedia.org"];

const PLATAFORMAS = [
  "facebook.com",
  "instagram.com",
  "x.com",
  "twitter.com",
  "tiktok.com",
  "youtube.com",
  "youtu.be",
  "linkedin.com"
];


const INDICE = new Map(CATALOGO.map((m) => [m.dominio, m]));

/*
-----------------------------------------------------------
INDICE POR NOMBRE DE MEDIO

Google News no devuelve la URL del publicador: devuelve una
URL de `news.google.com`. Medido sobre una consulta real de
Cuenca, 24 titulares produjeron UN solo dominio distinto, y
todo el registro de medios quedaba inservible: sin publicador
no hay cobertura declarada, y sin cobertura no se desambigua
"El Batan".

Lo que si trae Google News es el nombre del medio, al final
del titular: «Titular de la nota - El Mercurio». Este indice
permite recuperar el dominio desde ese nombre.

Es una resolucion por NOMBRE, mas fragil que por dominio, asi
que se marca aparte en la respuesta (`resueltoPorNombre`) para
que nunca se confunda con haber leido el dominio real.
-----------------------------------------------------------
*/

const INDICE_POR_NOMBRE = new Map(
  CATALOGO.map((m) => [normalizarNombre(m.nombre), m])
);

function normalizarNombre(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}


export function identificarPorNombre(nombre) {
  const bruto = String(nombre ?? "").trim().toLowerCase();

  if (!bruto) return null;

  /*
    El feed declara el medio unas veces por nombre («El
    Comercio Ecuador») y otras por dominio
    («elmercurio.com.ec»). Se prueba el dominio primero: es la
    forma inequivoca.
  */
  if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(bruto)) {
    const limpio = bruto.replace(/^www\./, "");

    const directo =
      INDICE.get(limpio) ||
      CATALOGO.find((m) => limpio.endsWith(`.${m.dominio}`)) ||
      null;

    if (directo) return directo;
  }

  const clave = normalizarNombre(nombre);

  if (!clave || clave.length < 3) return null;

  const exacto = INDICE_POR_NOMBRE.get(clave);

  if (exacto) return exacto;

  /*
    Coincidencia por contencion, en un solo sentido y exigiendo
    longitud: "El Mercurio de Cuenca" debe encontrar "El
    Mercurio", pero "El" no debe encontrar nada.
  */
  for (const [nombreCatalogo, entrada] of INDICE_POR_NOMBRE.entries()) {
    if (nombreCatalogo.length < 5) continue;

    if (clave === nombreCatalogo || clave.includes(nombreCatalogo)) {
      return entrada;
    }
  }

  return null;
}


function coincide(dominio, lista) {
  return lista.some((d) => dominio === d || dominio.endsWith(`.${d}`));
}


/*
===========================================================
IDENTIFICAR LA FUENTE DE UNA EVIDENCIA
===========================================================
*/

export function identificarFuente(urlOEvidencia) {
  const url =
    typeof urlOEvidencia === "string"
      ? urlOEvidencia
      : urlOEvidencia?.enlace || urlOEvidencia?.url || "";

  const dominio = extraerDominio(url);

  if (!dominio) {
    return {
      dominio: null,
      nombre: null,
      tipo: TIPOS_FUENTE.DESCONOCIDO,
      cobertura: null,
      verificado: false,
      motivo: "La evidencia no trae una URL utilizable."
    };
  }

  /* Coincidencia exacta o de subdominio contra el catalogo. */
  const entrada =
    INDICE.get(dominio) ||
    CATALOGO.find((m) => dominio.endsWith(`.${m.dominio}`)) ||
    null;

  if (entrada) {
    return {
      dominio,
      nombre: entrada.nombre,
      tipo: entrada.tipo,
      cobertura: entrada.cobertura || null,

      /*
        Semilla, no padron. Ver la cautela (a) de la cabecera.
      */
      verificado: false,
      motivo: `Dominio ${dominio} presente en el catalogo semilla.`
    };
  }

  if (coincide(dominio, AGREGADORES)) {
    /*
      RESCATE DEL PUBLICADOR

      La URL es del agregador, pero el nombre del medio puede
      venir declarado aparte (Google News lo pone al final del
      titular; el recolector lo extrae y lo pasa como
      `fuenteDeclarada`).

      Sin este rescate, TODA la cobertura recogida via Google
      News colapsa en un unico "dominio" y el registro de
      medios no sirve para nada.
    */
    const declarada =
      typeof urlOEvidencia === "object"
        ? urlOEvidencia?.fuenteDeclarada
        : null;

    const porNombre = declarada ? identificarPorNombre(declarada) : null;

    if (porNombre) {
      return {
        dominio: porNombre.dominio,
        nombre: porNombre.nombre,
        tipo: porNombre.tipo,
        cobertura: porNombre.cobertura || null,
        verificado: false,

        /*
          Se marca. Resolver por nombre es mas fragil que leer
          el dominio, y quien audite la ubicacion de una
          evidencia debe poder verlo.
        */
        resueltoPorNombre: true,
        nombreDeclarado: declarada,
        dominioDelEnlace: dominio,

        motivo: `El enlace apunta al agregador ${dominio}, pero el titular declara "${declarada}", que corresponde a ${porNombre.nombre} (${porNombre.dominio}).`
      };
    }

    return {
      dominio,
      nombre: declarada || dominio,
      tipo: TIPOS_FUENTE.AGREGADOR,
      cobertura: null,
      verificado: false,
      nombreDeclarado: declarada || null,
      motivo: declarada
        ? `${dominio} es un agregador. El titular declara "${declarada}", que no esta en el catalogo: no se le asigna cobertura.`
        : `${dominio} es un agregador: la URL no identifica al publicador original.`
    };
  }

  if (coincide(dominio, ENCICLOPEDICOS)) {
    return {
      dominio,
      nombre: dominio,
      tipo: TIPOS_FUENTE.ENCICLOPEDICO,
      cobertura: null,
      verificado: false,
      motivo: `${dominio} es una fuente enciclopedica.`
    };
  }

  if (coincide(dominio, PLATAFORMAS)) {
    return {
      dominio,
      nombre: dominio,
      tipo: TIPOS_FUENTE.PLATAFORMA,
      cobertura: null,
      verificado: false,
      motivo: `${dominio} es una plataforma social: el publicador es la cuenta, no el dominio.`
    };
  }

  /*
    DESCONOCIDO. Sin cobertura, deliberadamente. Ver la cautela
    (b): un dominio que no conocemos no puede desambiguar
    toponimos.

    Se detecta el sufijo .ec solo para informar, nunca para
    asignar cobertura.
  */
  return {
    dominio,
    nombre: dominio,
    tipo: TIPOS_FUENTE.DESCONOCIDO,
    cobertura: null,
    verificado: false,
    esEcuatorianoPorSufijo: dominio.endsWith(".ec"),
    motivo: `${dominio} no esta en el catalogo. No se le asigna ambito de cobertura: un dominio desconocido no puede desambiguar toponimos.`
  };
}


/*
===========================================================
PISTA DE FUENTE PARA EL GEO RESOLVER

Traduce la ficha del medio al contrato minimo que espera
geoResolver, sin que geo/ tenga que importar nada de
conversation/.
===========================================================
*/

export function pistaDeFuente(urlOEvidencia) {
  const fuente = identificarFuente(urlOEvidencia);

  if (!fuente.cobertura?.unidadId) return null;

  return {
    unidadId: fuente.cobertura.unidadId,
    resolucion: fuente.cobertura.resolucion,
    motivo: `Ambito de cobertura declarado de ${fuente.nombre} (${fuente.dominio}).`
  };
}


/*
===========================================================
RESUMEN DE COBERTURA MEDIATICA DE UN LOTE
===========================================================
*/

export function resumirMedios(evidencias = []) {
  const porDominio = new Map();

  const porTipo = {};

  (Array.isArray(evidencias) ? evidencias : []).forEach((e) => {
    const f = identificarFuente(e);

    porTipo[f.tipo] = (porTipo[f.tipo] || 0) + 1;

    if (!f.dominio) return;

    if (!porDominio.has(f.dominio)) {
      porDominio.set(f.dominio, {
        dominio: f.dominio,
        nombre: f.nombre,
        tipo: f.tipo,
        cobertura: f.cobertura || null,
        enCatalogo: f.tipo !== TIPOS_FUENTE.DESCONOCIDO,
        verificado: f.verificado,
        evidencias: 0,
        primeraFecha: null,
        ultimaFecha: null
      });
    }

    const acc = porDominio.get(f.dominio);

    acc.evidencias += 1;

    const fecha = e?.fecha || null;

    if (fecha) {
      if (!acc.primeraFecha || fecha < acc.primeraFecha) acc.primeraFecha = fecha;
      if (!acc.ultimaFecha || fecha > acc.ultimaFecha) acc.ultimaFecha = fecha;
    }
  });

  const medios = [...porDominio.values()].sort(
    (a, b) => b.evidencias - a.evidencias
  );

  const locales = medios.filter((m) => m.tipo === TIPOS_FUENTE.MEDIO_LOCAL);

  const regionales = medios.filter(
    (m) => m.tipo === TIPOS_FUENTE.MEDIO_REGIONAL
  );

  const nacionales = medios.filter((m) => m.tipo === TIPOS_FUENTE.MEDIO_NACIONAL);

  const desconocidos = medios.filter((m) => m.tipo === TIPOS_FUENTE.DESCONOCIDO);

  return {
    medios,

    porTipo,

    criterio: CRITERIO_CLASIFICACION,

    resumen: {
      dominiosDistintos: medios.length,
      locales: locales.length,
      regionales: regionales.length,
      nacionales: nacionales.length,
      desconocidos: desconocidos.length
    },

    /*
      Separados y con etiqueta. Regla congelada del Protocolo
      Universal: nunca mezclar medios con cuentas del objetivo.
    */
    localesDestacados: locales.slice(0, 10),
    nacionalesDestacados: nacionales.slice(0, 10),

    loQueNoSabemos: [
      desconocidos.length
        ? `${desconocidos.length} dominio(s) fuera del catalogo. No se les asigna tipo ni cobertura: aparecen como desconocidos en lugar de clasificarse por conjetura.`
        : null,

      "El catalogo de medios es semilla, no un padron: todas las entradas llevan verificado:false.",

      "No se mide alcance ni audiencia. Un ranking de medios por influencia sin datos de audiencia seria una opinion con formato de metrica."
    ].filter(Boolean)
  };
}


export function catalogoMedios() {
  return {
    total: CATALOGO.length,
    verificado: false,
    nota: "Catalogo semilla. Se cura con el uso; ninguna entrada esta contrastada contra un registro oficial de medios.",
    medios: CATALOGO.map((m) => ({
      dominio: m.dominio,
      nombre: m.nombre,
      tipo: m.tipo,
      cobertura: m.cobertura || null,
      desambigua: Boolean(m.cobertura)
    }))
  };
}


export default {
  TIPOS_FUENTE,
  CRITERIO_CLASIFICACION,
  identificarFuente,
  pistaDeFuente,
  resumirMedios,
  catalogoMedios
};
