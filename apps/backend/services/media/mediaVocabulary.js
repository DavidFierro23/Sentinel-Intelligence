// apps/backend/services/media/mediaVocabulary.js

import { CLASES_EMISOR } from "./pieceContracts.js";

/*
===========================================================
MEDIA-UX-HOME-01 — VOCABULARIO OFICIAL DE MEDIA INTELLIGENCE
===========================================================

Este fichero no ejecuta nada. Fija las palabras ANTES de que
exista la metrica, que es el unico momento en que fijarlas
sirve para algo.

POR QUE EL VOCABULARIO VA PRIMERO
-----------------------------------------------------------

El gate anterior analizaba UNA pieza y la tentacion semantica
estaba acotada. Una HOME de corpus ordena fuentes de mayor a
menor, y una lista ordenada se lee como un ranking de poder
aunque el titulo diga otra cosa. En una presentacion de
campana, «El Mercurio 12 · Expreso 3» se cuenta como «El
Mercurio influye cuatro veces mas», y nadie mira la nota al
pie.

Por eso las tres dimensiones se declaran aqui con lo que NO
significan, y `INCIDENCIA` se declara sin valor: existe como
concepto para que nadie la sustituya por un conteo.

LAS TRES DIMENSIONES
-----------------------------------------------------------

    PRESENCIA OBSERVADA      cuanto aparece en el corpus
    AMPLIFICACION OBSERVADA  que se propaga con que
    INCIDENCIA               quien mueve los temas  <- SIN METODOLOGIA

Las dos primeras son recuentos sobre evidencia guardada y se
pueden auditar fila por fila. La tercera exige demostrar que
una fuente aparece consistentemente asociada al NACIMIENTO,
CRECIMIENTO o PERSISTENCIA de un tema, y eso necesita series
temporales con dos ventanas completas que hoy no existen.
===========================================================
*/

export const VERSION_VOCABULARIO_MEDIA = "1.0";

export const GATE = "MEDIA-UX-HOME-01";


/*
-----------------------------------------------------------
LAS TRES DIMENSIONES

Cada una viaja con `noSignifica`. No es documentacion: la UI
lo imprime al lado de la cifra y un test comprueba que sigue
ahi.
-----------------------------------------------------------
*/
export const DIMENSIONES = Object.freeze({
  PRESENCIA: Object.freeze({
    id: "PRESENCIA_OBSERVADA",
    nombre: "PRESENCIA OBSERVADA",

    definicion:
      "Cantidad y diversidad de apariciones o publicaciones observadas dentro del corpus del proyecto y de la ventana seleccionada.",

    unidad: "piezas observadas y fuentes distintas, contadas por separado",

    noSignifica: Object.freeze([
      "No significa popularidad.",
      "No significa aprobacion ni respaldo.",
      "No significa intencion de voto.",
      "No significa influencia.",
      "No significa audiencia: no hay datos de audiencia en este corpus."
    ]),

    /*
      El sesgo mas grande de la cifra, y el que un analista
      olvida primero: el corpus no es el universo. Contiene lo
      que Sentinel pidio, no lo que se publico.
    */
    sesgoDeclarado:
      "El corpus se compone de lo que se ha analizado y de la cobertura que los buscadores devolvieron. Una fuente ausente puede no haber publicado, o no haber sido consultada. Presencia mide el corpus, no el ecosistema mediatico."
  }),

  AMPLIFICACION: Object.freeze({
    id: "AMPLIFICACION_OBSERVADA",
    nombre: "AMPLIFICACION OBSERVADA",

    definicion:
      "Fuentes y piezas relacionadas con la propagacion o cobertura de un contenido o tema, segun la evidencia disponible.",

    unidad: "piezas, fuentes y contenidos: tres magnitudes distintas que NO se suman",

    noSignifica: Object.freeze([
      "No afirma copia: publicar despues no prueba haber copiado.",
      "No afirma causalidad.",
      "No afirma coordinacion ni campana concertada.",
      "No afirma que la pieza analizada sea el origen del asunto."
    ]),

    sesgoDeclarado:
      "El rol por defecto entre dos piezas es COBERTURA_RELACIONADA precisamente porque la coincidencia temporal no demuestra derivacion."
  }),

  INCIDENCIA: Object.freeze({
    id: "INCIDENCIA",
    nombre: "INCIDENCIA",

    definicion:
      "Fuentes que aparecen consistentemente asociadas al nacimiento, el crecimiento o la persistencia de un tema.",

    /*
      Deliberadamente sin valor. Si algun dia se calcula,
      tendra que pasar por `requisitos` y alguien tendra que
      borrar esta declaracion a mano.
    */
    unidad: null,

    estado: "METODOLOGIA_EN_CONSTRUCCION",

    disponible: false,

    motivo:
      "No existe metodologia suficiente. Demostrar incidencia exige comparar al menos dos ventanas completas del mismo tema y poder situar cada pieza en el tiempo; hoy el corpus no lo permite.",

    requisitos: Object.freeze([
      "Fecha de publicacion normalizada en la mayoria de las piezas del tema.",
      "Dos ventanas temporales completas y comparables del mismo tema.",
      "Orden temporal verificable entre la aparicion de una fuente y el crecimiento del tema.",
      "Un contrafactual declarado: temas donde esa fuente NO aparecio."
    ]),

    prohibido: Object.freeze([
      "PROHIBIDO sustituir incidencia por un numero de piezas.",
      "PROHIBIDO llamar incidencia al orden de un ranking de presencia.",
      "PROHIBIDO derivar incidencia de que una fuente publique antes: ser el primero del corpus no es originar el tema."
    ])
  })
});


/*
-----------------------------------------------------------
LA PALABRA PROHIBIDA

`influencia` ya esta en AFIRMACIONES_PROHIBIDAS de
`pieceContracts`, que audita la respuesta de UNA pieza. Aqui
se repite para el corpus, junto a las formas que un ranking
invita a usar.
-----------------------------------------------------------
*/
export const TERMINOS_PROHIBIDOS = Object.freeze([
  "influencia",
  "influyente",
  "influyentes",
  "ranking de influencia",
  "poder mediatico",
  "impacto real",
  "viral",
  "tendencia creciente",
  "engagement rate",
  "sentimiento",
  "favorabilidad",
  "intencionDeVoto",
  "personasAlcanzadas"
]);


export const EQUIVALENCIAS_PROHIBIDAS_HOME = Object.freeze([
  "Mas menciones no es mejor: un medio puede publicar mucho y en contra.",
  "Mas menciones no es favorable: la presencia no tiene signo.",
  "Mas menciones no es intencion de voto.",
  "Aparecer primero en el corpus no es haber originado el tema.",
  "Piezas, fuentes y contenidos son magnitudes distintas y no se suman entre si."
]);


/*
-----------------------------------------------------------
ESTADOS DE UN DATO AUSENTE

SIN OBSERVACION != CERO. Cada estado responde una pregunta
distinta, y colapsarlos en «sin datos» es lo que convierte un
hueco nuestro en una afirmacion sobre el mundo.
-----------------------------------------------------------
*/
export const ESTADOS_DATO = Object.freeze({
  /* Se puede observar, pero esta vez no se pudo. */
  NO_DISPONIBLE: "NO_DISPONIBLE",

  /* Se miro y no hay ninguna evidencia que lo sostenga. */
  SIN_EVIDENCIA: "SIN_EVIDENCIA",

  /* Hay evidencia, pero no la suficiente para la ventana pedida. */
  COBERTURA_INSUFICIENTE: "COBERTURA_INSUFICIENTE",

  /* La entidad existe y no sabemos QUE es. */
  NO_CLASIFICADO: "NO_CLASIFICADO",

  /* Se podria calcular, pero no hay metodo que lo sostenga. */
  METODOLOGIA_EN_CONSTRUCCION: "METODOLOGIA_EN_CONSTRUCCION",

  /* El dato existe en la fila y no se puede interpretar. */
  FECHA_NO_NORMALIZADA: "FECHA_NO_NORMALIZADA"
});


export const EXPLICACION_ESTADOS = Object.freeze({
  NO_DISPONIBLE:
    "El dato es observable en principio, pero no se obtuvo. No es un cero.",
  SIN_EVIDENCIA:
    "Se busco en el corpus del proyecto y no hay ninguna fila que lo sostenga.",
  COBERTURA_INSUFICIENTE:
    "Hay evidencia, pero no cubre la ventana pedida. Comparar sobre esto daria un numero con aspecto de tendencia calculado sobre casi nada.",
  NO_CLASIFICADO:
    "La fuente esta identificada y ninguna evidencia dice si es medio, periodista, creador o cuenta. No se clasifica por volumen ni por seguidores.",
  METODOLOGIA_EN_CONSTRUCCION:
    "La pregunta es legitima y el metodo para responderla no existe todavia. No se sustituye por una aproximacion.",
  FECHA_NO_NORMALIZADA:
    "La fila trae una fecha que no esta en formato ISO-8601 y no se interpreta. Adivinarla situaria la pieza en una ventana que nadie observo."
});


/*
-----------------------------------------------------------
LAS NUEVE SECCIONES DEL MODULO

El menu de Media Intelligence, declarado en el backend para
que la UI no invente entradas ni prometa secciones que el
contrato no sostiene.

`profundidad` es la parte incomoda y la que evita que este
gate se lea como nueve modulos terminados:

    CORPUS      agrega lo persistido y responde hoy
    PARCIAL     responde con lo que hay y declara el hueco
    PREPARADA   navegacion y contrato listos, sin agregacion

`ANALIZAR PUBLICACION` es la unica OPERATIVA de extremo a
extremo, y pasa a ser una herramienta interna del modulo.
-----------------------------------------------------------
*/
export const SECCIONES = Object.freeze([
  {
    id: "resumen",
    nombre: "Resumen",
    profundidad: "CORPUS",
    pregunta: "Que hay observado en este proyecto y con que cobertura."
  },
  {
    id: "medios",
    nombre: "Medios",
    profundidad: "CORPUS",
    pregunta: "Que medios del catalogo aparecen en el corpus del proyecto."
  },
  {
    id: "periodistas",
    nombre: "Periodistas",
    profundidad: "PARCIAL",
    pregunta: "Que firmas aparecen en las piezas observadas.",
    limite:
      "Solo existe autoria cuando la pieza la publica en metadata legible. Ninguna firma se deduce del texto."
  },
  {
    id: "creadores",
    nombre: "Creadores",
    profundidad: "PARCIAL",
    pregunta: "Que cuentas no institucionales aparecen publicando.",
    limite:
      "Una cuenta identificada sin evidencia de que sea creador se queda en NO_CLASIFICADO. No se asciende por volumen."
  },
  {
    id: "historias",
    nombre: "Historias / temas",
    profundidad: "PARCIAL",
    pregunta: "Que asuntos circulan en el corpus del proyecto.",
    limite:
      "Los temas se derivan de los titulares persistidos. Una pieza sin titular no aporta tema."
  },
  {
    id: "amplificacion",
    nombre: "Amplificacion",
    profundidad: "CORPUS",
    pregunta: "Que piezas y fuentes acompanan a un contenido."
  },
  {
    id: "presencia",
    nombre: "Ranking / presencia",
    profundidad: "CORPUS",
    pregunta: "Que fuentes aparecen con mayor presencia observada.",
    limite:
      "Es un orden por recuento sobre el corpus. No es un ranking de influencia y no lleva score compuesto."
  },
  {
    id: "fuentes",
    nombre: "Fuentes / evidencias",
    profundidad: "CORPUS",
    pregunta: "De donde salio cada dato."
  },
  {
    id: "analizar",
    nombre: "Analizar publicacion",
    profundidad: "OPERATIVA",
    pregunta: "Analizar una publicacion concreta a partir de su URL.",
    herramientaInterna: true,
    gate: "MEDIA-PIECE-01 / MEDIA-PIECE-02 / MEDIA-REAL-DEMO-01"
  }
]);


/*
-----------------------------------------------------------
CLASES DE FUENTE EN LA HOME

No se inventa una taxonomia nueva. Se REUTILIZA `CLASES_EMISOR`
de `pieceContracts` y se declara el mapa hacia los cinco
grupos que la HOME muestra.

`INSTITUCION` corresponde a `INSTITUCIONAL`, y `CUENTA` es el
grupo donde caen las cuentas identificadas sin clase
demostrada: `COMUNIDAD`, `OTRO` y `NO_CLASIFICADO`. Es un
AGRUPAMIENTO DE PRESENTACION, no una clasificacion nueva: la
clase original viaja siempre al lado.
-----------------------------------------------------------
*/
export const GRUPOS_FUENTE = Object.freeze({
  MEDIO: "MEDIO",
  PERIODISTA: "PERIODISTA",
  CREADOR: "CREADOR",
  INSTITUCION: "INSTITUCION",
  CUENTA: "CUENTA",
  PLATAFORMA: "PLATAFORMA",
  AGREGADOR: "AGREGADOR",
  NO_CLASIFICADO: "NO_CLASIFICADO"
});


export const MAPA_CLASE_A_GRUPO = Object.freeze({
  [CLASES_EMISOR.MEDIO]: GRUPOS_FUENTE.MEDIO,
  [CLASES_EMISOR.PERIODISTA]: GRUPOS_FUENTE.PERIODISTA,
  [CLASES_EMISOR.CREADOR]: GRUPOS_FUENTE.CREADOR,
  [CLASES_EMISOR.INSTITUCIONAL]: GRUPOS_FUENTE.INSTITUCION,
  [CLASES_EMISOR.PLATAFORMA]: GRUPOS_FUENTE.PLATAFORMA,
  [CLASES_EMISOR.COMUNIDAD]: GRUPOS_FUENTE.CUENTA,
  [CLASES_EMISOR.OTRO]: GRUPOS_FUENTE.CUENTA,
  [CLASES_EMISOR.NO_CLASIFICADO]: GRUPOS_FUENTE.NO_CLASIFICADO,
  [CLASES_EMISOR.NO_DETERMINADO]: GRUPOS_FUENTE.NO_CLASIFICADO
});


export function grupoDeClase(clase) {
  return MAPA_CLASE_A_GRUPO[clase] || GRUPOS_FUENTE.NO_CLASIFICADO;
}


/*
  Una correspondencia observada NO cambia el grupo.

  `@tomebamba` coincide con «Radio Tomebamba» del catalogo y
  eso es una pista, no una identidad: puede ser una parodia, un
  homonimo o un programa distinto del mismo grupo. La HOME
  muestra la propuesta y la cuenta sigue en NO_CLASIFICADO
  hasta que un analista la confirme.
*/
export const REGLA_CORRESPONDENCIA = Object.freeze({
  titulo: "Una correspondencia observada no asciende a una clase",

  texto:
    "Cuando el handle de una cuenta se parece al nombre de un medio del catalogo, se muestra la correspondencia con su fuerza y su motivo, en estado OBSERVADA_NO_VERIFICADA. La clase del emisor NO cambia. Solo la confirmacion de un analista, o un enlace declarado por el propio medio, cierra ese salto.",

  estados: Object.freeze({
    OBSERVADA_NO_VERIFICADA: "OBSERVADA_NO_VERIFICADA",
    VERIFICADA: "VERIFICADA"
  })
});


/*
-----------------------------------------------------------
VENTANAS

Los ids son los de `territorial/temporalWindows` mas `hoy`.
No se declara aqui ninguna semantica temporal: la calcula
`dayWindow`, que ya resuelve el dia calendario en la zona del
territorio. Duplicarla produciria dos «hoy» distintos.
-----------------------------------------------------------
*/
export const VENTANAS_HOME = Object.freeze([
  { id: "hoy", dias: 1, etiqueta: "Hoy" },
  { id: "7d", dias: 7, etiqueta: "7 dias" },
  { id: "15d", dias: 15, etiqueta: "15 dias" },
  { id: "30d", dias: 30, etiqueta: "30 dias" },
  { id: "90d", dias: 90, etiqueta: "90 dias" }
]);


export const VENTANA_POR_DEFECTO = "90d";


/*
-----------------------------------------------------------
PREGUNTAS QUE SENTINEL AI DEBERA PODER RESPONDER

No se implementa ninguna respuesta. Se declaran para que la
forma de la HOME quede obligada a sostenerlas: cada pregunta
apunta a los ejes que hacen falta, y si un eje no esta en el
corpus, la pregunta queda marcada como todavia no respondible.

Sirve de contrato de diseno: una HOME que no pueda alimentar
estas preguntas esta mal cortada, aunque se vea bien.
-----------------------------------------------------------
*/
export const PREGUNTAS_OBJETIVO = Object.freeze([
  {
    id: "medios-por-candidato-semana",
    pregunta: "¿Que medios estan mencionando mas a un candidato esta semana?",
    ejes: ["candidato", "fuente", "tiempo", "evidencia"]
  },
  {
    id: "medios-de-un-candidato",
    pregunta: "¿Que medios estan hablando de un candidato?",
    ejes: ["candidato", "fuente", "evidencia"]
  },
  {
    id: "temas-por-candidato",
    pregunta: "¿Que temas se estan asociando con cada candidato?",
    ejes: ["candidato", "tema", "evidencia"]
  },
  {
    id: "historia-mas-amplificada-hoy",
    pregunta: "¿Que historia tuvo mayor amplificacion observada hoy?",
    ejes: ["tema", "amplificacion", "tiempo"]
  },
  {
    id: "variacion-presencia-semana",
    pregunta:
      "¿Que cambio en la presencia mediatica de un candidato frente a la semana anterior?",
    ejes: ["candidato", "fuente", "tiempo", "ventanaAnterior"]
  },
  {
    id: "fuentes-de-un-tema",
    pregunta: "¿Que fuentes estan impulsando la conversacion sobre un tema?",
    ejes: ["tema", "fuente", "tiempo", "incidencia"]
  },
  {
    id: "que-ocurre-en-territorio",
    pregunta:
      "¿Que esta ocurriendo en un territorio alrededor de un candidato, y por que?",
    ejes: ["territorio", "candidato", "tema", "tiempo", "evidencia"]
  }
]);


/*
  Los ejes que el corpus sostiene HOY. `incidencia` y
  `ventanaAnterior` no estan, y por eso dos de las siete
  preguntas quedan fuera de alcance: se declara, no se
  disimula.
*/
export const EJES_DISPONIBLES = Object.freeze([
  "candidato",
  "fuente",
  "tema",
  "amplificacion",
  "evidencia",
  "tiempo"
]);


export function preguntasRespondibles() {
  return PREGUNTAS_OBJETIVO.map((p) => {
    const faltan = p.ejes.filter((e) => !EJES_DISPONIBLES.includes(e));

    return {
      ...p,
      respondible: faltan.length === 0,
      ejesQueFaltan: faltan,

      motivo: faltan.length
        ? `Faltan los ejes: ${faltan.join(", ")}.`
        : "El corpus sostiene todos los ejes de esta pregunta. Falta el motor conversacional, que este gate NO implementa."
    };
  });
}


/*
-----------------------------------------------------------
CONTRATO DE LA HOME
-----------------------------------------------------------
*/
export const CONTRATO_MEDIA_HOME = Object.freeze({
  version: VERSION_VOCABULARIO_MEDIA,
  gate: GATE,

  entrada: [
    "projectId (obligatorio): Media Intelligence no existe fuera de un proyecto.",
    "ventana (opcional): hoy | 7d | 15d | 30d | 90d.",
    "tenantId (opcional)."
  ],

  bloques: [
    "proyecto",
    "ventana",
    "resumen",
    "presencia",
    "candidatosPorFuente",
    "historias",
    "amplificacion",
    "fuentes",
    "incidencia",
    "cobertura",
    "aislamiento",
    "declaraciones"
  ],

  garantias: [
    "Ninguna cifra procede de otro proyecto: el corpus se filtra por projectId y el aislamiento se declara en la respuesta.",
    "Reanalizar la misma pieza NO aumenta su presencia: solo cuenta la version vigente de cada entidad.",
    "Una ausencia de observacion nunca se devuelve como 0: viaja con un estado de ESTADOS_DATO.",
    "No existe campo de influencia, y un test lo comprueba sobre la respuesta serializada.",
    "INCIDENCIA se devuelve siempre sin valor, con sus requisitos.",
    "Piezas, fuentes y contenidos se cuentan por separado.",
    "Una fecha que no es ISO-8601 no se interpreta: se declara FECHA_NO_NORMALIZADA.",
    "La HOME es de solo lectura: no ejecuta proveedores ni consume cuota."
  ]
});


export default {
  VERSION_VOCABULARIO_MEDIA,
  GATE,
  DIMENSIONES,
  TERMINOS_PROHIBIDOS,
  EQUIVALENCIAS_PROHIBIDAS_HOME,
  ESTADOS_DATO,
  EXPLICACION_ESTADOS,
  SECCIONES,
  GRUPOS_FUENTE,
  MAPA_CLASE_A_GRUPO,
  grupoDeClase,
  REGLA_CORRESPONDENCIA,
  VENTANAS_HOME,
  VENTANA_POR_DEFECTO,
  PREGUNTAS_OBJETIVO,
  EJES_DISPONIBLES,
  preguntasRespondibles,
  CONTRATO_MEDIA_HOME
};


/*
===========================================================
MEDIA-UX-CERT-01 — AÑADIDOS DE LA CERTIFICACION VISUAL
===========================================================
*/


/*
-----------------------------------------------------------
HOSTS DE INFRAESTRUCTURA

La certificacion visual encontro
`mw-public-alb-prod-1982631391.us-east-1.elb.amazonaws.com` en el
puesto #5 del ranking, entre El Universo y Expreso. Es un
balanceador de carga de AWS —el servidor de origen desde el que
se sirvio una pagina—, no una cabecera.

En una presentacion de campana eso se lee como un medio mas, y es
el mismo error de categoria que `google.com`: no describe a quien
publica, describe COMO llego el dato hasta nosotros.

La lista es deliberadamente corta y solo contiene sufijos que
NUNCA son una marca editorial. Un dominio propio raro se queda
donde esta: preferimos una fuente sin clasificar a una fuente
reclasificada por parecerlo.

No se borra ninguna evidencia: el host pasa a la lista de
artefactos, visible y con su motivo.
-----------------------------------------------------------
*/
export const SUFIJOS_INFRAESTRUCTURA = Object.freeze([
  ".elb.amazonaws.com",
  ".amazonaws.com",
  ".cloudfront.net",
  ".akamaized.net",
  ".akamaihd.net",
  ".fastly.net",
  ".azureedge.net",
  ".googleusercontent.com",
  ".cloudflare.net",
  ".herokuapp.com"
]);


export function esHostDeInfraestructura(dominio) {
  const d = String(dominio || "").toLowerCase();

  if (!d) return false;

  return SUFIJOS_INFRAESTRUCTURA.some((s) => d.endsWith(s));
}


/*
-----------------------------------------------------------
ETIQUETAS HUMANAS DE LOS ESTADOS

El contrato conserva `COBERTURA_INSUFICIENTE`; la pantalla dice
«Cobertura insuficiente». Se traduce en un solo sitio para que
backend y UI no puedan divergir, y la etiqueta viaja JUNTO al
valor tecnico: quien audita necesita el crudo, quien presenta
necesita la frase.
-----------------------------------------------------------
*/
export const ETIQUETAS_ESTADO = Object.freeze({
  NO_DISPONIBLE: "Dato no disponible",
  SIN_EVIDENCIA: "Sin evidencia observable",
  COBERTURA_INSUFICIENTE: "Cobertura insuficiente",
  NO_CLASIFICADO: "Pendiente de clasificación",
  METODOLOGIA_EN_CONSTRUCCION: "Metodología en construcción",
  FECHA_NO_NORMALIZADA: "Fecha no normalizada"
});


export function etiquetaDeEstado(estado) {
  if (!estado) return null;

  return ETIQUETAS_ESTADO[estado] || String(estado).replace(/_/g, " ").toLowerCase();
}


/*
-----------------------------------------------------------
ETIQUETAS HUMANAS DE LA CLASE DE EMISOR
-----------------------------------------------------------
*/
export const ETIQUETAS_CLASE = Object.freeze({
  MEDIO: "Medio",
  PERIODISTA: "Periodista",
  CREADOR: "Creador",
  INSTITUCIONAL: "Institución",
  COMUNIDAD: "Comunidad",
  PLATAFORMA: "Plataforma",
  OTRO: "Cuenta",
  NO_CLASIFICADO: "Sin clasificar",
  NO_DETERMINADO: "Sin determinar"
});


export function etiquetaDeClase(clase) {
  if (!clase) return "Sin determinar";

  return ETIQUETAS_CLASE[clase] || String(clase).replace(/_/g, " ").toLowerCase();
}


/*
-----------------------------------------------------------
NOTA METODOLOGICA

Una sola frase, y va visible junto al ranking. No es un aviso
legal: es la condicion que hace verdadera la lista.
-----------------------------------------------------------
*/
export const NOTA_METODOLOGICA = Object.freeze({
  titulo: "Cómo leer este ranking",

  texto:
    "Ranking basado en evidencia digital observable dentro de las fuentes y la ventana seleccionadas. No mide audiencia, alcance ni influencia, y el corpus no es el ecosistema mediático: una fuente ausente puede no haber publicado, o no haber sido consultada.",

  etiquetaAcceso: "Metodología y cobertura"
});


/*
-----------------------------------------------------------
DIMENSIONES FUTURAS DEL RANKING

Se declaran para que la pantalla se diseñe sabiendo que crecera,
y para que ninguna se pueda encender sin metodologia. Hoy la
unica con datos es PRESENCIA.
-----------------------------------------------------------
*/
export const DIMENSIONES_FUTURAS = Object.freeze([
  { id: "presencia", nombre: "Presencia", disponible: true },
  { id: "interaccion", nombre: "Interacción", disponible: false, requiere: "Métricas por pieza en la mayoría del corpus." },
  { id: "amplificacion", nombre: "Amplificación", disponible: false, requiere: "Rol de derivación demostrado, no solo cobertura relacionada." },
  { id: "conversacion", nombre: "Conversación", disponible: false, requiere: "Texto de comentarios, que hoy ninguna vía entrega." },
  { id: "video", nombre: "Video", disponible: false, requiere: "Métricas de reproducción por plataforma." },
  { id: "momentum", nombre: "Momentum", disponible: false, requiere: "Dos ventanas completas comparables." }
]);


/* Tamaños de lista previstos. La UI ya los ofrece; el corpus decide. */
export const TAMANOS_RANKING = Object.freeze([10, 20, 50]);
