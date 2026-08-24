// apps/backend/services/conversation/conversationContracts.js

/*
===========================================================
PUBLIC CONVERSATION — CONTRATOS
===========================================================

Que es, exactamente, la "conversacion publica" que este modulo
mide. Definirlo aqui no es burocracia: es lo que impide que la
cifra se lea como otra cosa.

QUE ES
-----------------------------------------------------------

Lo que se publica en la WEB ABIERTA sobre un objetivo o un
territorio, y que Sentinel puede observar con los proveedores
que tiene: buscadores web y titulares de noticias.

QUE NO ES — y la diferencia importa mucho
-----------------------------------------------------------

NO es la conversacion ciudadana. No es lo que la gente dice.

Medir lo que la gente dice exigiria capturar redes sociales a
escala, y eso esta EXCLUIDO POR INDICACION EXPRESA
(UX-WR-001 §15, "Captura masiva de redes: excluido").

Lo que aqui se mide es COBERTURA Y PUBLICACION, no opinion
ciudadana. Un pico en esta serie significa "se publico mas",
no "a la gente le importa mas". Confundir las dos cosas es el
error que convierte un panel de inteligencia en un espejo de
la agenda mediatica presentado como voz popular.

Por eso el modulo se llama Conversacion PUBLICA y no
Conversacion CIUDADANA, y por eso cada respuesta lo declara.

RESOLUCION TERRITORIAL — el techo
-----------------------------------------------------------

UX-WR-001 §0 ya lo fijo midiendo: la conversacion llega, en el
mejor caso, a nivel CIUDAD, con procedencia `agregada`.

Este modulo puede subir a parroquia SOLO cuando el texto
nombra la parroquia y el Geo Resolver lo respalda; entonces la
procedencia es `derivada`, nunca `declarada`. Sin toponimo, el
techo es el canton.
===========================================================
*/


export const NATURALEZA = Object.freeze({
  id: "conversacion_publica",
  nombre: "Conversacion publica",

  mide: "Publicacion y cobertura observable en la web abierta.",

  noMide: "Opinion ciudadana, sentimiento popular ni volumen de redes sociales.",

  exclusionDeclarada:
    "Captura masiva de redes sociales: EXCLUIDA por indicacion expresa (UX-WR-001 §15).",

  resolucionTecho: "canton",

  procedenciaHabitual: "agregada",

  lecturaCorrecta: "Un aumento significa «se publico mas», no «importa mas».",

  fuentes: [
    "Titulares de Google News (RSS, sin coste de cuota)",
    "Buscadores web via Search Provider Layer (SerpAPI, Brave, DuckDuckGo)",
    "Evidencia ya almacenada en el Knowledge Lake"
  ]
});


/*
===========================================================
MODOS DE RECOLECCION

El presupuesto de SerpAPI es un SALDO MENSUAL, no un limite
por hora: 250 busquedas que no se recuperan esperando. Un
modulo territorial que consulte alegremente se come la cuota
que necesita el Discovery Engine.

Por eso el modo por defecto NO gasta nada.
===========================================================
*/

export const MODOS_RECOLECCION = Object.freeze({
  /*
    Solo lee lo que ya existe. Coste cero, cobertura la que
    haya. Es el modo por defecto.
  */
  LAKE: "lake",

  /*
    Lake + Google News por RSS. Sigue sin gastar cuota: el RSS
    de Google News es gratuito y no pasa por el Search Provider
    Layer.
  */
  NOTICIAS: "noticias",

  /*
    Anade consultas web con presupuesto declarado. Gasta cuota
    y por eso exige peticion explicita del analista.
  */
  WEB: "web"
});


export const MODO_POR_DEFECTO = MODOS_RECOLECCION.NOTICIAS;


export const PRESUPUESTO = Object.freeze({
  /*
    Tope duro de consultas web por analisis territorial. Bajo a
    proposito: el Discovery Engine ya usa 6 por investigacion y
    el saldo es compartido.
  */
  CONSULTAS_WEB_MAXIMAS: 3,

  /* Titulares por consulta de noticias. */
  NOTICIAS_POR_CONSULTA: 20,

  motivo:
    "El plan de SerpAPI da 250 busquedas AL MES: un saldo que no se recupera esperando. Este modulo comparte ese saldo con el Discovery Engine, que necesita 6 por investigacion."
});


/*
===========================================================
ESTADOS DE MOTOR — cuatro cosas que NO son lo mismo
===========================================================

    SIN_RESULTADOS    el motor respondio y no habia nada
    NO_EJECUTADO      no se le pregunto
    ERROR             se le pregunto y fallo
    SIN_CREDENCIAL    no se puede preguntar
    BLOQUEADO         el proveedor funciona pero rechazo la peticion
    TIMEOUT           no respondio a tiempo

Confundirlas es el error que gobierna toda esta plataforma. El
Search Provider Layer ya separa `bloqueado` de `0 resultados`;
la capa social separa `ausencia` de `no comprobada`; el
Territorial Timeline separa «periodo sin datos» de «periodo
sin observacion».

Aqui la distincion decide si una respuesta vacia significa
«no se publico nada sobre este territorio» —una conclusion— o
«no lo preguntamos» —una carencia de cobertura—. Son lo
contrario la una de la otra.
===========================================================
*/

export const ESTADOS_MOTOR = Object.freeze({
  OK: "OK",
  SIN_RESULTADOS: "SIN_RESULTADOS",
  NO_EJECUTADO: "NO_EJECUTADO",
  ERROR: "ERROR",
  SIN_CREDENCIAL: "SIN_CREDENCIAL",
  BLOQUEADO: "BLOQUEADO",
  TIMEOUT: "TIMEOUT",
  NO_IMPLEMENTADO: "NO_IMPLEMENTADO"
});


export const SIGNIFICADO_ESTADO = Object.freeze({
  OK: "Respondio y devolvio resultados.",
  SIN_RESULTADOS:
    "Respondio y no habia nada. Es una respuesta legitima: se puede afirmar ausencia en esta fuente.",
  NO_EJECUTADO:
    "No se le pregunto. NO se puede afirmar ausencia: la fuente no se consulto.",
  ERROR: "Se le pregunto y fallo. No se puede afirmar ausencia.",
  SIN_CREDENCIAL:
    "No se puede preguntar: falta la credencial. No se puede afirmar ausencia.",
  BLOQUEADO:
    "El proveedor funciona pero rechazo la peticion (cuota, limite de tasa). No se puede afirmar ausencia.",
  TIMEOUT:
    "No respondio dentro del limite. No se puede afirmar ausencia.",
  NO_IMPLEMENTADO:
    "Declarado en la arquitectura pero sin modulo. Nunca se invoca."
});


/*
  Solo dos estados permiten afirmar que en esa fuente no habia
  nada. Los demas son huecos de cobertura, y la diferencia debe
  llegar hasta la interfaz.
*/
export function permiteAfirmarAusencia(estado) {
  return estado === ESTADOS_MOTOR.OK || estado === ESTADOS_MOTOR.SIN_RESULTADOS;
}


/*
-----------------------------------------------------------
LIMITE DE TIEMPO POR CONSULTA

Google News se consulta por RSS y `rss-parser` trae 60 s de
timeout por defecto. Con cuatro consultas encadenadas eso son
hasta cuatro minutos con la peticion HTTP abierta.

Medido: una ejecucion que normalmente tarda 2,5 s se quedo
colgada mas de dos minutos cuando el feed dejo de responder.

Una llamada externa sin limite dentro de una ruta HTTP es un
fallo de disponibilidad, no un detalle de rendimiento.
-----------------------------------------------------------
*/

export const TIEMPO_LIMITE = Object.freeze({
  NOTICIAS_MS: 12000,
  TOTAL_NOTICIAS_MS: 45000
});


/*
===========================================================
UMBRALES

Los mismos criterios que el motor territorial, por coherencia:
bajo la muestra minima no se afirma nada.
===========================================================
*/

export const UMBRALES = Object.freeze({
  /* Evidencias minimas para que un tema exista como tal. */
  EVIDENCIAS_POR_TEMA: 3,

  /* Apariciones minimas de un termino para ser candidato a tema. */
  FRECUENCIA_TERMINO: 3,

  /* Senales lexicas minimas para arriesgar un encuadre. */
  SENALES_ENCUADRE: 2,

  /* Evidencias minimas para dar volumen por unidad territorial. */
  EVIDENCIAS_POR_UNIDAD: 5
});


/*
===========================================================
ENCUADRE

Cuatro etiquetas, y la cuarta no es relleno: es la salida
correcta la mayor parte de las veces.
===========================================================
*/

export const ENCUADRES = Object.freeze({
  CRITICO: "critico",
  FAVORABLE: "favorable",
  NEUTRO: "neutro",
  NO_DETERMINABLE: "no_determinable"
});


export const CATALOGO_ENCUADRES = Object.freeze([
  {
    id: "critico",
    nombre: "Critico",
    significado:
      "El texto contiene lexico de cuestionamiento, denuncia, conflicto o incumplimiento."
  },
  {
    id: "favorable",
    nombre: "Favorable",
    significado:
      "El texto contiene lexico de logro, entrega, inauguracion o reconocimiento."
  },
  {
    id: "neutro",
    nombre: "Neutro",
    significado:
      "Lexico informativo sin carga en ninguna direccion, o senales contrapuestas que se anulan."
  },
  {
    id: "no_determinable",
    nombre: "No determinable",
    significado:
      "No hay senales lexicas suficientes. NO significa neutro: significa que no se sabe."
  }
]);


/*
-----------------------------------------------------------
LIMITE DEL CLASIFICADOR DE ENCUADRE — se declara siempre

Es lexico, no semantico. No entiende ironia, ni negacion, ni
citas: "el alcalde nego el incumplimiento" contiene
"incumplimiento" y se leera como critico.

Se acepta ese error a cambio de que el metodo sea determinista
y auditable: la alternativa —un modelo de lenguaje— daria
mejores etiquetas y peor explicabilidad, y el Cap. 9 exige
explicabilidad (IA1).

El encuadre califica el TEXTO, jamas a la persona. "Cobertura
critica sobre X" no es "X es criticable".
-----------------------------------------------------------
*/

export const LIMITE_ENCUADRE = Object.freeze({
  metodo: "lexico determinista sobre titular y descripcion",

  noDetecta: ["ironia", "negacion", "citas indirectas", "contexto"],

  ejemploDeFallo:
    '«El alcalde nego el incumplimiento» contiene «incumplimiento» y se clasifica como critico.',

  porQueAsi:
    "Determinista y auditable. Un modelo de lenguaje etiquetaria mejor y explicaria peor, y la explicabilidad es obligatoria (IA1, Cap. 9).",

  alcance:
    "Califica el TEXTO publicado, nunca a la persona mencionada. «Cobertura critica sobre X» no equivale a «X es criticable»."
});


/*
===========================================================
DIMENSIONES DE CONVERSACION PUBLICA — T-13
===========================================================

Que se mide de verdad, que se mide a medias y que no se mide.

Se declara en el contrato y no en un documento aparte porque
un inventario de capacidades que vive fuera del codigo
envejece el dia que alguien anade una funcion y no actualiza
el documento. Aqui viaja en `/catalogo` y en cada respuesta.

`PARCIAL` es una etiqueta honesta, no un aprobado con matices:
significa que lo que se entrega NO es lo que el nombre de la
dimension promete.
===========================================================
*/

export const ESTADO_DIMENSION = Object.freeze({
  IMPLEMENTADO: "IMPLEMENTADO",
  PARCIAL: "PARCIAL",
  NO_IMPLEMENTADO: "NO_IMPLEMENTADO"
});


export const DIMENSIONES = Object.freeze([
  {
    id: "temas",
    nombre: "Temas",
    estado: "IMPLEMENTADO",
    como: "Lexico de dominio declarado + coocurrencia de terminos frecuentes.",
    limite: "Determinista por diseno: solo encuentra categorias escritas, mas lo emergente."
  },
  {
    id: "volumen",
    nombre: "Volumen",
    estado: "IMPLEMENTADO",
    como: "Conteo de publicaciones por periodo.",
    limite: "Mide publicaciones, no lectores ni alcance."
  },
  {
    id: "evolucion",
    nombre: "Evolucion temporal",
    estado: "IMPLEMENTADO",
    como: "Serie por cubos de dia o semana, con barra de observacion.",
    limite: "Sin ingesta continua no se distingue actividad de observacion."
  },
  {
    id: "medios",
    nombre: "Medios",
    estado: "IMPLEMENTADO",
    como: "Catalogo por dominio con cobertura territorial declarada.",
    limite: "Catalogo semilla, todo con verificado:false. No mide alcance."
  },
  {
    id: "actores",
    nombre: "Actores",
    estado: "IMPLEMENTADO",
    como: "Menciones por nombre+apellido con corroboracion multi-dominio.",
    limite: "Requiere que el analista declare los actores. Un apellido suelto no cuenta."
  },
  {
    id: "tendencias",
    nombre: "Tendencias",
    estado: "PARCIAL",
    como: "Anomalias sobre la propia serie (mediana + MAD) y variacion entre periodos.",
    limite:
      "Detecta que una serie se aparta de su nivel habitual. NO identifica una tendencia sostenida ni su direccion futura, y no puede separar cambio real de cambio en el esfuerzo de observacion."
  },
  {
    id: "sentimiento",
    nombre: "Sentimiento",
    estado: "PARCIAL",
    como: "Encuadre lexico del texto: critico / favorable / neutro / no determinable.",
    limite:
      "NO es analisis de sentimiento. Es encuadre lexico del TEXTO PUBLICADO, no emocion de nadie, y no detecta ironia ni negacion. En la ejecucion real, 24 de 29 quedaron «no determinable»."
  },
  {
    id: "comunidades",
    nombre: "Comunidades",
    estado: "NO_IMPLEMENTADO",
    como: null,
    limite:
      "Exigiria grafo de interaccion entre cuentas, y eso requiere captura de redes: excluida por indicacion expresa."
  },
  {
    id: "creadores",
    nombre: "Creadores",
    estado: "NO_IMPLEMENTADO",
    como: null,
    limite:
      "Exigiria identificar autores individuales y su produccion. La web abierta devuelve medios, no creadores."
  },
  {
    id: "engagement",
    nombre: "Engagement",
    estado: "NO_IMPLEMENTADO",
    como: null,
    limite:
      "No hay ninguna fuente de likes, comentarios o compartidos en esta arquitectura. Inventar un proxy seria fabricar una metrica."
  },
  {
    id: "influencia",
    nombre: "Influencia",
    estado: "NO_IMPLEMENTADO",
    como: null,
    limite:
      "Sin audiencia ni engagement no hay influencia medible. Un ranking por numero de publicaciones NO es influencia."
  }
]);


/*
===========================================================
DECLARACION PUBLICA
===========================================================
*/

export function declararContrato() {
  return {
    version: "1.0",

    naturaleza: NATURALEZA,

    modos: MODOS_RECOLECCION,
    modoPorDefecto: MODO_POR_DEFECTO,
    presupuesto: PRESUPUESTO,

    umbrales: UMBRALES,

    estadosMotor: ESTADOS_MOTOR,
    significadoEstado: SIGNIFICADO_ESTADO,
    tiempoLimite: TIEMPO_LIMITE,

    encuadres: CATALOGO_ENCUADRES,
    limiteEncuadre: LIMITE_ENCUADRE,

    dimensiones: DIMENSIONES,

    resumenDimensiones: {
      implementado: DIMENSIONES.filter((d) => d.estado === "IMPLEMENTADO").length,
      parcial: DIMENSIONES.filter((d) => d.estado === "PARCIAL").length,
      noImplementado: DIMENSIONES.filter((d) => d.estado === "NO_IMPLEMENTADO")
        .length
    },

    loQueEsteModuloNoHace: [
      "No captura redes sociales a escala: excluido por indicacion expresa.",
      "No mide opinion ciudadana ni sentimiento popular.",
      "No mide alcance ni audiencia de los medios.",
      "No afirma causa de ningun cambio de volumen.",
      "No desagrega por debajo del canton salvo que el texto nombre la unidad."
    ]
  };
}


export default {
  NATURALEZA,
  MODOS_RECOLECCION,
  MODO_POR_DEFECTO,
  PRESUPUESTO,
  UMBRALES,
  ESTADOS_MOTOR,
  SIGNIFICADO_ESTADO,
  TIEMPO_LIMITE,
  DIMENSIONES,
  ESTADO_DIMENSION,
  permiteAfirmarAusencia,
  ENCUADRES,
  CATALOGO_ENCUADRES,
  LIMITE_ENCUADRE,
  declararContrato
};
