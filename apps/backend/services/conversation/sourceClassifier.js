// apps/backend/services/conversation/sourceClassifier.js

import { identificarFuente, TIPOS_FUENTE } from "./mediaRegistry.js";
import { esPlataforma, nombrePlataforma } from "./sourceUniverse.js";

/*
===========================================================
SOURCE CLASSIFIER — de que naturaleza es quien publica
===========================================================

Decide si una fuente es un medio, una institucion, un creador,
una comunidad, una organizacion, un candidato o web publica.
Y sobre todo: decide cuando NO puede decidirlo.

QUE SIGNIFICA «CIUDADANIA_COMUNIDAD»
-----------------------------------------------------------

Una fuente COLECTIVA y publica: una pagina de barrio, un foro
vecinal, un colectivo, un grupo abierto.

NO significa «esta persona representa a los ciudadanos». Una
persona individual nunca se clasifica como ciudadania. Ese
salto —de un individuo a «la gente»— es el que convierte un
panel de escucha en una encuesta inventada, y esta prohibido
aqui de forma explicita: `clasificarPersona()` devuelve
NO_DETERMINADO por diseno.

POR QUE NO HAY UMBRAL DE SEGUIDORES
-----------------------------------------------------------

«Mas de N seguidores = creador» es la clase de regla que
parece objetiva y no lo es: N no sale de ningun sitio, y el
recuento de seguidores ni siquiera se lee (no hay integracion
con ninguna API de plataforma). CREADOR exige evidencia
observable de publicacion propia y recurrente, no audiencia.

CONFIANZA, NO CERTEZA
-----------------------------------------------------------

Cada clasificacion viaja con `confianza`, `razones`, `metodo` y
`evidencia`. Una clase con confianza 0.4 y una razon debil se
puede discutir; una clase sin razones no.
===========================================================
*/


export const CLASES_FUENTE = Object.freeze({
  CIUDADANIA_COMUNIDAD: "CIUDADANIA_COMUNIDAD",
  MEDIO: "MEDIO",
  INSTITUCION: "INSTITUCION",
  CREADOR: "CREADOR",
  ORGANIZACION: "ORGANIZACION",
  CANDIDATO: "CANDIDATO",
  WEB_PUBLICA: "WEB_PUBLICA",
  NO_DETERMINADO: "NO_DETERMINADO"
});


export const METODOS = Object.freeze({
  CATALOGO: "catalogo_semilla",
  DOMINIO_INSTITUCIONAL: "dominio_institucional",
  PLATAFORMA: "plataforma_conocida",
  DECLARACION_ANALISTA: "declaracion_analista",
  SENAL_TEXTUAL: "senal_textual",
  SIN_METODO: "sin_metodo_aplicable"
});


/*
-----------------------------------------------------------
DOMINIOS INSTITUCIONALES

`.gob.ec` y `.gov` son un hecho administrativo verificable, no
una interpretacion: solo el Estado los emite. Es la unica senal
de este modulo que llega a confianza alta por si sola.

`.edu.ec` NO da INSTITUCION publica: una universidad privada
tambien lo lleva. Va a ORGANIZACION.
-----------------------------------------------------------
*/

const SUFIJOS_ESTADO = [".gob.ec", ".gov.ec", ".gob.", ".gov.", ".gouv."];

const SUFIJOS_ACADEMICOS = [".edu.ec", ".edu.", ".ac."];

const SUFIJOS_ORGANIZACION = [".org.ec", ".org", ".ong"];


function terminaEn(dominio, sufijos) {
  const d = String(dominio || "").toLowerCase();

  return sufijos.some((s) => d.endsWith(s) || d.includes(s));
}


function resultado(clase, confianza, metodo, razones, extra = {}) {
  return {
    clase,
    confianza: Number(confianza.toFixed(2)),
    metodo,
    razones,
    evidencia: extra.evidencia || null,
    dominio: extra.dominio || null,
    plataforma: extra.plataforma || null,

    /*
      Toda clasificacion es revisable. Marcarlo evita que un
      consumidor la trate como un hecho del registro civil.
    */
    verificada: false,

    limitacion:
      clase === CLASES_FUENTE.NO_DETERMINADO
        ? "No hay señal suficiente para afirmar la naturaleza de esta fuente. No determinar es un resultado válido."
        : null
  };
}


/*
===========================================================
CLASIFICAR UNA FUENTE
===========================================================
*/

export function clasificarFuente(entrada = {}) {
  const dominio =
    entrada.dominio ||
    (entrada.url ? identificarFuente(entrada.url).dominio : null);

  const razones = [];

  /*
    ---------------------------------------------------------
    0. DECLARACION DEL ANALISTA — gana a todo

    Con autor. Una declaracion anonima no se puede auditar.
    ---------------------------------------------------------
  */
  if (entrada.claseDeclarada && entrada.declaradaPor) {
    razones.push(
      `Declarada como ${entrada.claseDeclarada} por ${entrada.declaradaPor}.`
    );

    return resultado(
      entrada.claseDeclarada,
      0.95,
      METODOS.DECLARACION_ANALISTA,
      razones,
      { dominio }
    );
  }

  /*
    ---------------------------------------------------------
    1. DOMINIO DEL ESTADO — hecho administrativo
    ---------------------------------------------------------
  */
  if (terminaEn(dominio, SUFIJOS_ESTADO)) {
    razones.push(
      `El dominio ${dominio} usa un sufijo reservado al Estado, que solo la administración pública puede registrar.`
    );

    return resultado(
      CLASES_FUENTE.INSTITUCION,
      0.92,
      METODOS.DOMINIO_INSTITUCIONAL,
      razones,
      { dominio }
    );
  }

  /*
    ---------------------------------------------------------
    2. CATALOGO SEMILLA
    ---------------------------------------------------------
  */
  /*
    DOMINIO ANTES QUE URL, y no al reves.

    Cuando el Source Universe ya resolvio el publicador real
    —«El Mercurio» rescatado del sufijo del titular—, `dominio`
    trae `elmercurio.com.ec` mientras `url` sigue apuntando a
    `news.google.com`. Consultando la URL, las seis fuentes de
    prensa del corpus real salian NO_DETERMINADO y el 100 % del
    reparto por clase se perdia.
  */
  const ident = identificarFuente(dominio || entrada.url || "");

  if (ident.nombre) {
    razones.push(`«${ident.nombre}» consta en el catálogo semilla como ${ident.tipo}.`);

    if (ident.resueltoPorNombre) {
      razones.push(
        "Resuelto por el nombre del publicador, no por el dominio: es más frágil."
      );
    }

    const mapa = {
      [TIPOS_FUENTE.MEDIO_LOCAL]: CLASES_FUENTE.MEDIO,
      [TIPOS_FUENTE.MEDIO_REGIONAL]: CLASES_FUENTE.MEDIO,
      [TIPOS_FUENTE.MEDIO_NACIONAL]: CLASES_FUENTE.MEDIO,
      [TIPOS_FUENTE.INSTITUCION]: CLASES_FUENTE.INSTITUCION
    };

    const clase = mapa[ident.tipo];

    if (clase) {
      /*
        El catalogo no esta contrastado contra ningun registro
        oficial de medios: lleva verificado:false por decision
        propia. Por eso 0.80 y no 0.95.
      */
      return resultado(
        clase,
        ident.resueltoPorNombre ? 0.7 : 0.8,
        METODOS.CATALOGO,
        razones,
        { dominio: ident.dominio }
      );
    }
  }

  /*
    ---------------------------------------------------------
    3. PLATAFORMA

    Una plataforma es WEB_PUBLICA, nunca CREADOR. Que un video
    este en YouTube no dice nada de quien lo hizo: el emisor
    real esta dentro y aqui no se lee.
    ---------------------------------------------------------
  */
  if (esPlataforma(dominio)) {
    const plat = nombrePlataforma(dominio);

    razones.push(
      `${plat} es una plataforma de alojamiento, no un emisor. Quien publica está dentro y este módulo no lo lee.`
    );

    return resultado(
      CLASES_FUENTE.WEB_PUBLICA,
      0.85,
      METODOS.PLATAFORMA,
      razones,
      { dominio, plataforma: plat }
    );
  }

  /*
    ---------------------------------------------------------
    4. SENAL TEXTUAL DE COMUNIDAD

    ANTES que los sufijos organizativos, y no despues. `.org`
    lo registra cualquiera y vale 0.45; un nombre que dice
    «Colectivo Vecinos de El Vado» es una senal mas fuerte que
    el sufijo que lo aloja. Con el orden inverso —que es como
    estaba— ese colectivo salia ORGANIZACION y la agenda
    ciudadana quedaba vacia con una fuente ciudadana delante.

    Se mira el NOMBRE, la DESCRIPCION y el DOMINIO. Los tres los
    declara la propia fuente sobre si misma. Lo que NUNCA se
    mira es el contenido de una nota: que un articulo hable de
    vecinos no lo publica un colectivo vecinal.
    ---------------------------------------------------------
  */
  const textoDeclarado = `${entrada.nombre || ""} ${entrada.descripcion || ""} ${dominio || ""}`;

  const SENAL_COMUNIDAD =
    /\b(colectivo|vecin\w+|barrial|comunidad|comunitari\w+|asamblea (de |del )?(barrio|vecin\w+)|foro|junta parroquial|comit[ée] (de |del )?barrio)/i;

  if (SENAL_COMUNIDAD.test(textoDeclarado)) {
    razones.push(
      `El nombre o el dominio declarados por la fuente («${textoDeclarado.trim().slice(0, 60)}») indican un colectivo, no una persona.`
    );

    razones.push(
      "CIUDADANIA_COMUNIDAD designa una fuente colectiva observable, nunca a un individuo que «represente» a la ciudadanía."
    );

    return resultado(
      CLASES_FUENTE.CIUDADANIA_COMUNIDAD,
      0.55,
      METODOS.SENAL_TEXTUAL,
      razones,
      { dominio, evidencia: textoDeclarado.trim() }
    );
  }

  /*
    ---------------------------------------------------------
    5. SUFIJOS ORGANIZATIVOS Y ACADEMICOS

    Confianza deliberadamente media: `.org` lo registra
    cualquiera.
    ---------------------------------------------------------
  */
  if (terminaEn(dominio, SUFIJOS_ACADEMICOS)) {
    razones.push(
      `El dominio ${dominio} es académico. No implica institución pública: una universidad privada también lo lleva.`
    );

    return resultado(
      CLASES_FUENTE.ORGANIZACION,
      0.6,
      METODOS.DOMINIO_INSTITUCIONAL,
      razones,
      { dominio }
    );
  }

  if (terminaEn(dominio, SUFIJOS_ORGANIZACION)) {
    razones.push(
      `El dominio ${dominio} usa un sufijo organizativo, que cualquiera puede registrar. Señal débil.`
    );

    return resultado(
      CLASES_FUENTE.ORGANIZACION,
      0.45,
      METODOS.DOMINIO_INSTITUCIONAL,
      razones,
      { dominio }
    );
  }

  /*
    ---------------------------------------------------------
    6. NO DETERMINADO

    El caso por defecto, y el mas honesto. Un dominio suelto sin
    catalogo, sin sufijo informativo y sin declaracion no dice
    de que naturaleza es quien publica.
    ---------------------------------------------------------
  */
  razones.push(
    dominio
      ? `${dominio} no consta en el catálogo, no lleva sufijo informativo y no hay declaración del analista.`
      : "La fuente no aporta dominio utilizable."
  );

  return resultado(
    CLASES_FUENTE.NO_DETERMINADO,
    0.0,
    METODOS.SIN_METODO,
    razones,
    { dominio }
  );
}


/*
===========================================================
UNA PERSONA NO ES UNA CLASE DE FUENTE
===========================================================

Existe como funcion propia para que el intento quede
registrado y devuelva siempre lo mismo.

Un individuo puede ser CANDIDATO —eso lo declara un analista
con un registro electoral delante— o CREADOR —eso exige
evidencia de publicacion propia recurrente—. Lo que nunca es,
por el hecho de ser una persona con audiencia, es «ciudadania».
===========================================================
*/

export function clasificarPersona(persona = {}) {
  const razones = [
    "Una persona individual no se clasifica como CIUDADANIA_COMUNIDAD. Esa clase designa fuentes colectivas observables.",
    "Tener audiencia no convierte a nadie en CREADOR: el recuento de seguidores no se lee y no habría umbral defendible si se leyera."
  ];

  if (persona.claseDeclarada && persona.declaradaPor) {
    const permitidas = [CLASES_FUENTE.CANDIDATO, CLASES_FUENTE.CREADOR];

    if (permitidas.includes(persona.claseDeclarada)) {
      return resultado(
        persona.claseDeclarada,
        0.9,
        METODOS.DECLARACION_ANALISTA,
        [`Declarada como ${persona.claseDeclarada} por ${persona.declaradaPor}.`],
        { evidencia: persona.evidencia || null }
      );
    }

    razones.push(
      `«${persona.claseDeclarada}» no es una clase admisible para una persona individual.`
    );
  }

  return resultado(
    CLASES_FUENTE.NO_DETERMINADO,
    0.0,
    METODOS.SIN_METODO,
    razones,
    { evidencia: persona.nombre || null }
  );
}


/*
-----------------------------------------------------------
CLASIFICAR TODO UN UNIVERSO
-----------------------------------------------------------
*/

export function clasificarUniverso(universo) {
  const salida = new Map();

  universo.fuentes.forEach((f, id) => {
    salida.set(id, {
      ...clasificarFuente({
        dominio: f.dominio,
        url: f.url,
        nombre: f.nombre,
        descripcion: f.descripcion
      }),
      fuenteId: id,
      frecuenciaObservada: f.frecuenciaObservada
    });
  });

  const porClase = {};

  salida.forEach((c) => {
    porClase[c.clase] = (porClase[c.clase] || 0) + 1;
  });

  return {
    porFuente: salida,

    metricas: {
      clasificadas: salida.size,
      porClase,
      noDeterminadas: porClase[CLASES_FUENTE.NO_DETERMINADO] || 0
    },

    declaracion:
      "Toda clasificación es revisable y lleva razones. NO_DETERMINADO es un resultado válido, no un fallo."
  };
}


export default {
  CLASES_FUENTE,
  METODOS,
  clasificarFuente,
  clasificarPersona,
  clasificarUniverso
};
