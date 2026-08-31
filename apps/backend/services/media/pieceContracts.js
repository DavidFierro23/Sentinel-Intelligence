// apps/backend/services/media/pieceContracts.js

/*
===========================================================
MEDIA-PIECE-01 — CONTRATOS DE UNA PIEZA
===========================================================

Este fichero no ejecuta nada. Fija el vocabulario de la pieza
para que los ocho pasos del analisis hablen el mismo idioma y
para que la UI no tenga que adivinar que significa un campo.

POR QUE UN CONTRATO ANTES DE LA LOGICA
-----------------------------------------------------------

El riesgo de este gate no es tecnico, es semantico. Analizar
una publicacion produce cifras grandes —vistas, comentarios,
replicas— y las cifras grandes invitan a conclusiones que los
datos no sostienen. El contrato existe para que la conclusion
prohibida sea IMPOSIBLE DE EXPRESAR, no solo desaconsejada:

    no hay campo `personasAlcanzadas`
    no hay campo `influencia`
    no hay campo `intencionDeVoto`
    no hay campo `poblacionImpactada`

Si manana alguien los necesita, tendra que anadirlos aqui y
explicar de que fuente salen. Esa friccion es el control.

LAS TRES UNIDADES QUE NO SE PUEDEN CONFUNDIR
-----------------------------------------------------------

    PIEZA      un documento publicado, con su URL
    FUENTE     quien lo publica (dominio o cuenta)
    CONTENIDO  el hecho del que hablan varias piezas

Quince piezas de diez fuentes sobre un hecho son 15 / 10 / 1.
Nunca "15 noticias independientes". El contrato obliga a
devolver los tres numeros por separado.
===========================================================
*/

export const VERSION_CONTRATO_PIEZA = "1.0";


/*
-----------------------------------------------------------
PLATAFORMAS RECONOCIBLES DESDE LA URL

Reconocer la plataforma NO es clasificar al emisor: youtube.com
es una plataforma y el canal que hay dentro es el emisor. Esa
distincion ya la hace `sourceUniverse` (TIPOS_SOURCE.PLATFORM);
aqui solo se detecta el contenedor para saber a que adaptador
preguntar por metricas.
-----------------------------------------------------------
*/
export const PLATAFORMAS = Object.freeze({
  YOUTUBE: "youtube",
  FACEBOOK: "facebook",
  INSTAGRAM: "instagram",
  TIKTOK: "tiktok",
  X: "x",
  WEB: "web"
});


/*
-----------------------------------------------------------
CLASE DEL EMISOR

Los ocho valores que pide el gate. `NO_DETERMINADO` no es un
fallo: es el resultado honesto cuando el dominio no esta en
ningun catalogo y la URL no permite afirmar nada.

PROHIBIDO clasificar por numero de seguidores. Un medio con
pocos seguidores sigue siendo un medio, y una cuenta con
muchos no se convierte en medio por tenerlos.
-----------------------------------------------------------
*/
export const CLASES_EMISOR = Object.freeze({
  MEDIO: "MEDIO",
  PERIODISTA: "PERIODISTA",
  CREADOR: "CREADOR",
  INSTITUCIONAL: "INSTITUCIONAL",
  COMUNIDAD: "COMUNIDAD",
  PLATAFORMA: "PLATAFORMA",
  OTRO: "OTRO",

  /*
    MEDIA-REAL-DEMO-01 §6: la cuenta existe y esta identificada,
    pero NINGUNA evidencia dice que sea medio, periodista, creador
    o actor.

    Antes se devolvia CREADOR por defecto con una advertencia. Era
    peor de lo que parecia: en un panel, "CREADOR" se lee como una
    conclusion y la advertencia se ignora. NO_CLASIFICADO no se
    puede malinterpretar.

    Se distingue de NO_DETERMINADO: alli no sabemos QUIEN es el
    emisor; aqui lo sabemos y no sabemos QUE es.
  */
  NO_CLASIFICADO: "NO_CLASIFICADO",

  NO_DETERMINADO: "NO_DETERMINADO"
});


/*
-----------------------------------------------------------
DISPONIBILIDAD DE UNA METRICA

Se reexporta con los mismos nombres que usa
`socialCapabilityMatrix`, para que la respuesta de la API y la
matriz de capacidades no puedan divergir.

La regla dura: `value: null` con `availability` explicito.
NUNCA `value: 0` cuando no se pudo leer. Un cero es una
medicion; un null es una ausencia. Confundirlos falsea toda
comparacion posterior.
-----------------------------------------------------------
*/
export const DISPONIBILIDAD = Object.freeze({
  DISPONIBLE: "DISPONIBLE",
  NO_DISPONIBLE: "NO_DISPONIBLE",
  REQUIERE_AUTORIZACION: "REQUIERE_AUTORIZACION",
  REQUIERE_PROVEEDOR: "REQUIERE_PROVEEDOR",
  OCULTO_POR_LA_CUENTA: "OCULTO_POR_LA_CUENTA"
});


/*
  MEDIA-PIECE-02: se anaden `quotes` y `bookmarks`.

  El usuario ve "guardados" en una publicacion de X y el gate
  anterior no tenia donde ponerlos: una metrica que la interfaz
  muestra y el modelo no contempla se lee como "no existe",
  cuando la verdad es "no la pedimos".

  `capacidad` apunta a la matriz de CUENTA cuando existe alli;
  para las dos nuevas no existe, y su disponibilidad la resuelve
  `pieceFieldMatrix`, que si las modela.
*/
export const METRICAS_PIEZA = Object.freeze([
  { id: "views", nombre: "Visualizaciones / reproducciones", capacidad: "views" },
  { id: "likes", nombre: "Me gusta o reacciones", capacidad: "likes" },
  { id: "comments", nombre: "Comentarios o respuestas", capacidad: "comments" },
  { id: "shares", nombre: "Compartidos o republicaciones", capacidad: "shares" },
  { id: "quotes", nombre: "Citas", capacidad: null },
  { id: "bookmarks", nombre: "Guardados", capacidad: null }
]);


/*
  Una metrica siempre tiene esta forma, tanto si se pudo leer
  como si no. La UI no necesita dos ramas de codigo.
*/
export function metricaVacia(id, availability, motivo, provider = null) {
  return {
    id,
    value: null,
    observedAt: null,
    provider,
    availability,
    motivo: motivo || null,
    evidenceId: null
  };
}


export function metricaLeida(id, value, { observedAt, provider, evidenceId }) {
  return {
    id,
    value,
    observedAt: observedAt || null,
    provider: provider || null,
    availability: DISPONIBILIDAD.DISPONIBLE,
    motivo: null,
    evidenceId: evidenceId || null
  };
}


/*
-----------------------------------------------------------
ROL DE UNA PIEZA FRENTE A LA PIEZA ANALIZADA

`COBERTURA_RELACIONADA` es el valor por defecto DELIBERADO
cuando dos piezas hablan del mismo hecho: afirmar que B copio
a A exige evidencia de la copia —una cita, un enlace, un texto
identico—, no basta con que B sea posterior.

`ORIGINAL` significa siempre "la mas antigua OBSERVADA en esta
ventana", nunca "la primera que existio". Por eso el rol viaja
con `ventanaObservada`.
-----------------------------------------------------------
*/
export const ROLES_PIEZA = Object.freeze({
  ORIGINAL: "ORIGINAL",
  CITA: "CITA",
  REPLICA: "REPLICA",
  COBERTURA_RELACIONADA: "COBERTURA_RELACIONADA",
  NO_DETERMINADO: "NO_DETERMINADO"
});


export const EXPLICACION_ROLES = Object.freeze({
  ORIGINAL:
    "Es la pieza mas antigua observada del grupo. No afirma ser la primera que existio: solo la primera que Sentinel vio en la ventana declarada.",
  CITA:
    "Referencia explicita a la pieza analizada: la enlaza o la nombra, y aporta texto propio.",
  REPLICA:
    "Texto practicamente identico al de la pieza analizada, sin aporte propio detectable.",
  COBERTURA_RELACIONADA:
    "Habla del mismo hecho, pero no se pudo demostrar que derive de la pieza analizada. Es el valor por defecto: la coincidencia temporal no prueba copia.",
  NO_DETERMINADO:
    "No hay fecha utilizable o no hay texto suficiente para decidir el rol."
});


/*
-----------------------------------------------------------
CLASIFICACION DE RENDIMIENTO

Solo se emite si existe baseline comparable. Los cuatro
niveles no tienen umbrales absolutos: un millon de vistas es
excepcional para una cuenta de 80 mil y normal para una de dos
millones. El umbral es un RATIO contra la propia cuenta.
-----------------------------------------------------------
*/
export const NIVELES_RENDIMIENTO = Object.freeze({
  BAJO: "BAJO",
  MEDIO: "MEDIO",
  ALTO: "ALTO",
  EXCEPCIONAL: "EXCEPCIONAL",
  SIN_BASELINE: "SIN_BASELINE_COMPARABLE"
});


/* Ratio contra la mediana de la propia cuenta. */
export const UMBRALES_RATIO = Object.freeze({
  BAJO: 0.5,
  MEDIO: 1.5,
  ALTO: 4.0
  /* > ALTO => EXCEPCIONAL */
});


/* Minimo de piezas comparables para que una mediana signifique algo. */
export const MINIMO_BASELINE = 5;


/*
-----------------------------------------------------------
AFIRMACIONES PROHIBIDAS

Se declaran para que los tests puedan comprobar que ninguna
aparece en la respuesta. Un test que busca estas cadenas es
mas fiable que una nota en un README.
-----------------------------------------------------------
*/
export const AFIRMACIONES_PROHIBIDAS = Object.freeze([
  "personasAlcanzadas",
  "poblacionAlcanzada",
  "poblacionImpactada",
  "intencionDeVoto",
  "influencia",
  "influyoEn",
  "apoyaronAlCandidato",
  "cambioLaIntencion",

  /*
    Generico a proposito: la prohibicion no puede estar atada a
    un territorio concreto o solo protegeria a ese territorio.
  */
  "porcentajeDeLaPoblacion",
  "porcentajeDelTerritorio"
]);


export const EQUIVALENCIAS_PROHIBIDAS = Object.freeze([
  "Views no son personas unicas: una persona puede reproducir un video varias veces.",
  "Interacciones no son apoyo: un comentario puede ser critico.",
  "Comentarios no son poblacion: quien comenta no representa a un territorio.",
  "Alcance no es persuasion: ver algo no es cambiar de opinion.",
  "Publicar sobre alguien no es apoyarlo ni atacarlo."
]);


/*
-----------------------------------------------------------
NOMBRES AUTORIZADOS DE LAS DIMENSIONES

Lo que SI se puede decir. La UI usa estos rotulos y no otros.
-----------------------------------------------------------
*/
export const DIMENSIONES_OBSERVADAS = Object.freeze({
  CONSUMO: "ALCANCE / CONSUMO OBSERVABLE",
  INTERACCION: "INTERACCION OBSERVABLE",
  AMPLIFICACION: "AMPLIFICACION OBSERVABLE",
  CONVERSACION: "CONVERSACION OBSERVABLE",
  TERRITORIO: "HUELLA TERRITORIAL OBSERVABLE",
  PERSISTENCIA: "PERSISTENCIA OBSERVADA",
  DIVERSIDAD: "DIVERSIDAD DE EMISORES OBSERVADA"
});


/*
-----------------------------------------------------------
ESTADO DEL HISTORICO

Con una sola observacion no hay crecimiento que medir. Decirlo
es obligatorio: un panel que muestra "+0%" con un solo punto
esta inventando una serie.
-----------------------------------------------------------
*/
export const ESTADOS_HISTORICO = Object.freeze({
  HISTORICO_INSUFICIENTE: "HISTORICO_INSUFICIENTE",
  COMPARABLE: "COMPARABLE"
});


/*
-----------------------------------------------------------
CONTRATO DE SALIDA

Lo que `analizarPieza()` devuelve siempre, incluso cuando algo
falla. Los motivos de fallo son parte de la respuesta, no una
excepcion que la UI tenga que interpretar.
-----------------------------------------------------------
*/
export const CONTRATO_ANALISIS_PIEZA = Object.freeze({
  version: VERSION_CONTRATO_PIEZA,

  entrada: ["url (obligatorio)", "candidateId (opcional)", "projectId (opcional)"],

  bloques: [
    "pieza",
    "emisor",
    "metricas",
    "candidato",
    "amplificacion",
    "temas",
    "conversacion",
    "territorio",
    "impactoObservado",
    "snapshot",
    "evidencias",
    "limitaciones",
    "cobertura"
  ],

  garantias: [
    "Toda cifra trae evidenceId y canonicalUrl o se declara ausente.",
    "value:null nunca se sustituye por 0.",
    "Ningun snapshot sobrescribe otro: se anexan.",
    "El territorio pasa por GEO-1 o no se afirma.",
    "El rol por defecto entre dos piezas es COBERTURA_RELACIONADA.",
    "Piezas, fuentes y contenidos se cuentan por separado."
  ]
});


export default {
  VERSION_CONTRATO_PIEZA,
  PLATAFORMAS,
  CLASES_EMISOR,
  DISPONIBILIDAD,
  METRICAS_PIEZA,
  metricaVacia,
  metricaLeida,
  ROLES_PIEZA,
  EXPLICACION_ROLES,
  NIVELES_RENDIMIENTO,
  UMBRALES_RATIO,
  MINIMO_BASELINE,
  AFIRMACIONES_PROHIBIDAS,
  EQUIVALENCIAS_PROHIBIDAS,
  DIMENSIONES_OBSERVADAS,
  ESTADOS_HISTORICO,
  CONTRATO_ANALISIS_PIEZA
};
