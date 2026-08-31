// apps/backend/services/media/commercialProviderBenchmark.js

import { ESTADOS_CAMPO, CAMPOS_PIEZA } from "./pieceFieldMatrix.js";

/*
===========================================================
BENCHMARK DE PROVEEDORES COMERCIALES — MEDIA-PIECE-02 §F
===========================================================

FICHA, NO COMPRA. Aqui no se integra ningun proveedor y no se
contrata nada. Se fija QUE hay que medir y COMO se compara,
antes de que exista una factura que sesgue el criterio.

POR QUE LA FICHA VA ANTES QUE LA EVALUACION
-----------------------------------------------------------

Un proveedor de datos sociales se vende con una lista de
plataformas y un precio por millar de llamadas. Ninguna de las
dos cifras dice si sirve: lo que decide es cuantas EVIDENCIAS
UTILES entrega por dolar sobre las cuentas que nos importan,
que en nuestro caso son ecuatorianas y a menudo pequenas.

Un proveedor con cobertura mundial y sin cobertura de un medio
local de provincia es peor, para nosotros, que uno mas modesto
que si lo cubra. Esa comparacion solo se puede hacer si las
metricas estan fijadas de antemano.

LA METRICA QUE MANDA
-----------------------------------------------------------

    coste por evidencia util

No el coste por llamada. Una llamada que devuelve un post sin
URL verificable, o con metricas de hace tres semanas, o de una
cuenta que no es la que pedimos, ha costado lo mismo y no vale
nada.

REGLA DE ADMISION
-----------------------------------------------------------

Un proveedor que no entregue URL verificable de cada pieza
queda descartado sin pasar a evaluacion economica: sin enlace
no hay evidencia, y sin evidencia el dato no puede entrar en
Sentinel. Es la misma regla que ya rige en
`CONTRATO_MEDIA_RELATION`.
===========================================================
*/


export const ESTADO_BENCHMARK = Object.freeze({
  SIN_EVALUAR: "SIN_EVALUAR",
  EN_EVALUACION: "EN_EVALUACION",
  DESCARTADO: "DESCARTADO",
  APTO: "APTO"
});


/*
-----------------------------------------------------------
DIMENSIONES A MEDIR

Las que pide el gate, cada una con COMO se mide. Una dimension
sin metodo de medida se convierte en una impresion.
-----------------------------------------------------------
*/
export const DIMENSIONES_BENCHMARK = Object.freeze([
  {
    id: "plataformas",
    nombre: "Plataformas cubiertas",
    como: "Lista declarada por el proveedor, verificada con una consulta real por plataforma.",
    tipo: "cobertura"
  },
  {
    id: "publicaciones",
    nombre: "Resolucion de posts / reels / videos de terceros",
    como: "Pedir 10 URLs publicas conocidas por plataforma y contar cuantas resuelve con id + autor + fecha.",
    tipo: "capacidad"
  },
  {
    id: "metricas",
    nombre: "Metricas por publicacion",
    como: "Por cada URL resuelta, contar cuantas de views/likes/comments/shares/quotes/bookmarks entrega con valor y con fecha de observacion.",
    tipo: "capacidad"
  },
  {
    id: "perfiles",
    nombre: "Perfiles y seguidores",
    como: "Resolver 10 cuentas ecuatorianas declaradas y comparar followers contra lo visible en la interfaz el mismo dia.",
    tipo: "capacidad"
  },
  {
    id: "historico",
    nombre: "Historico entregado por la fuente",
    como: "Comprobar si devuelve serie temporal propia o solo el valor de hoy. Si solo hoy, el historico lo construimos nosotros con snapshots.",
    tipo: "capacidad"
  },
  {
    id: "busqueda",
    nombre: "Busqueda / menciones",
    como: "Buscar un termino local y contar resultados con URL verificable en los ultimos 7 y 30 dias.",
    tipo: "capacidad"
  },
  {
    id: "coste",
    nombre: "Coste",
    como: "Precio de lista en USD por unidad de consumo, con el minimo mensual y el compromiso anual si existe.",
    tipo: "economico"
  },
  {
    id: "limites",
    nombre: "Limites de uso",
    como: "Peticiones por minuto, por dia y por mes. Si hay tope duro, cual y que ocurre al alcanzarlo.",
    tipo: "operativo"
  },
  {
    id: "terminos",
    nombre: "Terminos y licencia",
    como: "Leer el contrato: si permite ALMACENAR, si permite MOSTRAR a un cliente, y si obliga a borrar. Un dato que no se puede conservar rompe el historico.",
    tipo: "legal"
  },
  {
    id: "estabilidad",
    nombre: "Estabilidad",
    como: "Repetir la misma consulta 20 veces en 3 dias y contar respuestas identicas, errores y latencia p95.",
    tipo: "operativo"
  },
  {
    id: "cobertura_ec",
    nombre: "Cobertura Ecuador",
    como: "Muestra fija de 15 cuentas ecuatorianas (medios locales, creadores de provincia, instituciones) y contar cuantas resuelve. Es el criterio que mas veces descarta a un proveedor grande.",
    tipo: "cobertura"
  },
  {
    id: "evidence_url",
    nombre: "URL verificable por pieza",
    como: "Comprobar que cada resultado trae la URL publica de la pieza y que esa URL abre. Sin esto, DESCARTADO.",
    tipo: "admision"
  },
  {
    id: "coste_evidencia_util",
    nombre: "Coste por evidencia util",
    como: "coste_total_de_la_prueba / evidencias con (URL que abre + al menos una metrica con fecha + autor). Es la cifra de decision.",
    tipo: "economico"
  }
]);


/*
-----------------------------------------------------------
CRITERIOS DE ADMISION — antes de mirar el precio
-----------------------------------------------------------
*/
export const CRITERIOS_ADMISION = Object.freeze([
  {
    id: "url_verificable",
    regla: "Cada pieza devuelta trae su URL publica y esa URL abre.",
    siFalla: ESTADO_BENCHMARK.DESCARTADO,
    motivo: "Sin enlace no hay evidencia, y sin evidencia el dato no entra en Sentinel."
  },
  {
    id: "fecha_de_observacion",
    regla: "Cada metrica trae CUANDO se midio, no solo el valor.",
    siFalla: ESTADO_BENCHMARK.DESCARTADO,
    motivo: "Una cifra sin fecha no se puede comparar con la siguiente: destruye la serie."
  },
  {
    id: "licencia_de_almacenamiento",
    regla: "El contrato permite conservar el dato para comparacion historica.",
    siFalla: ESTADO_BENCHMARK.DESCARTADO,
    motivo: "Si hay que borrar, el histórico —que es el valor diferencial de Sentinel— no se puede construir."
  },
  {
    id: "sin_datos_personales",
    regla: "No entrega datos personales de usuarios individuales ni perfilado privado.",
    siFalla: ESTADO_BENCHMARK.DESCARTADO,
    motivo: "Violaria EX1 y la doctrina del producto. No es negociable por precio."
  },
  {
    id: "origen_licito",
    regla: "El proveedor declara como obtiene el dato y su via es licita.",
    siFalla: ESTADO_BENCHMARK.DESCARTADO,
    motivo: "Comprar scraping evasivo a un tercero es hacerlo por delegacion: el riesgo legal y reputacional sigue siendo nuestro."
  }
]);


/*
===========================================================
CANDIDATOS A EVALUAR

Se nombran por CATEGORIA y por lo que habria que comprobar de
cada uno. NO se afirma su precio, su cobertura ni su calidad:
nada de eso se ha medido, y ponerlo aqui de oidas convertiria un
rumor en una linea de presupuesto.

Cada ficha entra con `estado: SIN_EVALUAR` y `verificado: false`.
===========================================================
*/
function ficha(datos) {
  return Object.freeze({
    estado: ESTADO_BENCHMARK.SIN_EVALUAR,
    verificado: false,
    medidoEn: null,

    plataformasDeclaradas: [],
    plataformasVerificadas: [],

    resultados: null,

    costePorEvidenciaUtil: null,

    ...datos
  });
}


export const CANDIDATOS = Object.freeze([
  ficha({
    id: "api_oficial_x_plan_pago",
    nombre: "X API v2 — plan de pago",
    categoria: "API_OFICIAL",

    plataformasDeclaradas: ["x"],

    porQueEstaEnLaLista:
      "Es la unica via de esta lista que ya esta IMPLEMENTADA en el codigo. `xAdapter.resolverPosts` existe y mapea las seis metricas; solo falta la credencial. Evaluarlo es comparar planes, no integrar.",

    queHayQueComprobar: [
      "Que nivel incluye `tweets?ids=` con `public_metrics` para publicaciones de terceros.",
      "Si `impression_count` viene en ese nivel o solo en los superiores.",
      "Si `bookmark_count` viene: el usuario lo ve en pantalla y es la metrica mas dudosa.",
      "Cuota real por mes y que ocurre al agotarla.",
      "Ventana del archivo de busqueda: 7 dias no cubre una campana."
    ],

    riesgo:
      "El precio y los niveles han cambiado varias veces. Cualquier calculo de coste caduca rapido.",

    prioridad: 1,

    motivoPrioridad:
      "Coste de integracion practicamente cero y resuelve el CASO 1 completo. Es la unica brecha de este gate que se cierra con una decision y no con una solicitud a un tercero."
  }),

  ficha({
    id: "meta_app_review",
    nombre: "Meta Graph API — con revision de app",
    categoria: "API_OFICIAL",

    plataformasDeclaradas: ["facebook", "instagram"],

    porQueEstaEnLaLista:
      "Es la unica via legitima a metricas de Facebook e Instagram. No es un proveedor: es un tramite.",

    queHayQueComprobar: [
      "Si nuestro caso de uso encaja en algun permiso concedible (Page Public Content Access o similar).",
      "Que exige la revision: politica de privacidad, demostracion en video, empresa verificada.",
      "Si el permiso cubre paginas que NO administramos, que es el caso real.",
      "Plazo del tramite y probabilidad de rechazo."
    ],

    riesgo:
      "El resultado no depende de nosotros. Puede rechazarse sin apelacion util y el plazo es de semanas o meses.",

    prioridad: 2,

    motivoPrioridad:
      "Resuelve el CASO 2, pero no es comprable: es una solicitud. Conviene iniciarlo pronto precisamente porque no se puede acelerar con dinero."
  }),

  ficha({
    id: "proveedor_social_listening",
    nombre: "Proveedor de social listening con licencia de reventa",
    categoria: "PROVEEDOR_COMERCIAL",

    plataformasDeclaradas: ["x", "facebook", "instagram", "tiktok"],

    porQueEstaEnLaLista:
      "Categoria de proveedores que ya tienen acuerdos con las plataformas y revenden acceso agregado. Es la via tipica para cubrir TikTok, donde no hay API comercial.",

    queHayQueComprobar: [
      "Si entrega la publicacion CONCRETA por URL, o solo agregados por termino. La segunda no sirve para analizar una pieza.",
      "URL verificable por resultado: criterio de admision.",
      "Cobertura real de cuentas ecuatorianas pequenas: aqui se cae la mayoria.",
      "Si la licencia permite mostrar el dato a un cliente final y conservarlo.",
      "Latencia entre publicacion y disponibilidad del dato."
    ],

    riesgo:
      "Muchos venden cobertura mundial que en la practica ignora medios locales de provincia. La muestra de 15 cuentas ecuatorianas es el filtro que hay que aplicar primero.",

    prioridad: 3,

    motivoPrioridad:
      "Es la unica via para TikTok y un plan B para Meta, pero es la mas cara y la que mas riesgo de licencia trae. No se evalua hasta cerrar las dos anteriores."
  }),

  ficha({
    id: "proveedor_creator_analytics",
    nombre: "Proveedor de analitica de creadores / influencers",
    categoria: "PROVEEDOR_COMERCIAL",

    plataformasDeclaradas: ["instagram", "tiktok", "youtube", "x"],

    porQueEstaEnLaLista:
      "Cubre la dimension que hoy falta por completo: metricas de creadores e influencers como actores, no como cuentas sueltas.",

    queHayQueComprobar: [
      "Si el universo de creadores incluye Ecuador o solo mercados grandes.",
      "Si entrega la publicacion individual o solo agregados del perfil.",
      "Si aporta AUDIENCIA, que es la pieza que bloquea `MEDIA INCIDENCE OBSERVED`.",
      "Si la audiencia es medida o estimada por modelo: una estimacion no puede presentarse como medicion."
    ],

    riesgo:
      "Suelen entregar estimaciones modeladas sin decirlo. Un dato estimado que entre como medido contaminaria toda la explicabilidad del producto.",

    prioridad: 4,

    motivoPrioridad:
      "Es el unico camino conocido para desbloquear el indicador de incidencia, pero exige una comprobacion de honestidad metodologica mas dura que las demas."
  })
]);


/*
-----------------------------------------------------------
PROTOCOLO DE PRUEBA

Igual para todos, o la comparacion no vale. Se fija aqui para
que nadie ajuste la prueba al proveedor que ya le gusta.
-----------------------------------------------------------
*/
export const PROTOCOLO = Object.freeze({
  muestra: {
    urlsPorPlataforma: 10,
    cuentasEcuatorianas: 15,

    composicion:
      "5 medios nacionales, 5 medios o creadores locales de provincia, 5 instituciones. La mitad de la muestra debe ser pequena a proposito: es donde los proveedores fallan.",

    fijaAntesDeContactar: true,

    motivo:
      "Si la muestra se elige despues de ver que cubre el proveedor, la prueba mide la muestra y no al proveedor."
  },

  repeticiones: {
    veces: 20,
    dias: 3,
    mide: ["respuestas identicas", "errores", "latencia p95"]
  },

  registro: [
    "Cada consulta se guarda con su respuesta cruda.",
    "Cada evidencia se marca util / no util con el motivo.",
    "El coste se anota por consulta, no estimado al final."
  ],

  salida:
    "Una tabla comparable por proveedor con las 13 dimensiones y el coste por evidencia util. Sin esa tabla no se autoriza ninguna contratacion."
});


/*
-----------------------------------------------------------
QUE DESBLOQUEA CADA UNO

Enlaza el benchmark con la matriz por campo: para cada
proveedor, que campos pasarian de bloqueado a disponible. Es lo
que convierte una decision de compra en una decision de
producto.
-----------------------------------------------------------
*/
export function queDesbloquea(candidatoId) {
  const mapa = {
    api_oficial_x_plan_pago: {
      plataforma: "x",
      campos: ["texto", "publishedAt", "views", "likes", "comments", "shares", "quotes", "bookmarks", "pagina", "followers"],
      pasariaA: ESTADOS_CAMPO.DISPONIBLE_OFICIAL,
      nota: "El codigo ya esta escrito: la credencial cambia el estado sin tocar un fichero."
    },

    meta_app_review: {
      plataforma: "facebook",
      campos: ["pagina", "views", "likes", "comments", "shares", "followers"],
      pasariaA: ESTADOS_CAMPO.DISPONIBLE_OFICIAL,
      nota: "Requiere escribir un adapter de Meta que hoy no existe."
    },

    proveedor_social_listening: {
      plataforma: "tiktok",
      campos: ["views", "likes", "comments", "shares", "bookmarks", "followers"],
      pasariaA: ESTADOS_CAMPO.DISPONIBLE_PROVEEDOR,
      nota: "Unica via conocida para TikTok."
    },

    proveedor_creator_analytics: {
      plataforma: "varias",
      campos: ["followers", "audiencia"],
      pasariaA: ESTADOS_CAMPO.DISPONIBLE_PROVEEDOR,
      nota: "Desbloquearia MEDIA INCIDENCE OBSERVED, hoy bloqueado por falta de fuente de audiencia."
    }
  };

  return mapa[candidatoId] || null;
}


/*
===========================================================
PENDIENTES REGISTRADOS — §G

No se implementan aqui. Se registran para que existan en el
codigo y no solo en una conversacion.
===========================================================
*/
export const PENDIENTES = Object.freeze([
  {
    id: "UX-MEDIA-01",
    titulo: "projectId y candidateId deben ser selectores, no campos de texto",
    gate: "pendiente",

    problema:
      "Hoy la UI pide escribir los IDs a mano. Un analista no los memoriza y un ID mal escrito produce un analisis sin contexto que parece un fallo del modulo.",

    solucion:
      "Dos desplegables encadenados: Proyecto existente -> candidato de ese proyecto. Los datos ya existen en `GET /api/proyectos` y en el contenido del proyecto; no hace falta backend nuevo.",

    porQueNoSeHizoAqui:
      "MEDIA-PIECE-02 cierra una brecha de ADQUISICION DE DATOS. Mezclarla con un cambio de interfaz haria el gate mas dificil de revisar y de revertir.",

    impacto:
      "Alto en usabilidad, nulo en capacidad: no desbloquea ningun dato nuevo.",

    prioridad: 1
  },

  {
    id: "UX-MEDIA-02",
    titulo: "Exponer en la UI el interruptor de busqueda web",
    gate: "pendiente",

    problema:
      "`sinBusquedaWeb` existe en la API y no en la interfaz. El analista no puede decidir analizar una pieza sin gastar el presupuesto de consultas del dia.",

    solucion: "Una casilla: «solo metricas, sin buscar replicas».",

    impacto: "Medio: ahorra cuota en analisis repetidos de la misma pieza.",

    prioridad: 2
  },

  {
    id: "OPS-MEDIA-01",
    titulo: "Anadir los tests de media al script `npm test`",
    gate: "pendiente",

    problema:
      "El script `test` del backend enumera los ficheros uno a uno y no incluye `mediaPiece`, `mediaPieceWet` ni `mediaPiece02`. Pasan con `node --test`, pero no entran en la suite estandar.",

    solucion: "Anadirlos al script, o mejor, sustituir la enumeracion por `node --test tests/`.",

    impacto: "Alto en seguridad de regresion, nulo para el usuario final.",

    prioridad: 1
  }
]);


export function fichaCompleta() {
  return {
    gate: "MEDIA-PIECE-02",
    estado: "FICHA_DEFINIDA_SIN_EVALUAR",

    declaracion:
      "Ningun proveedor ha sido contactado, evaluado ni contratado. Este fichero define COMO se comparara cuando se autorice la evaluacion.",

    dimensiones: DIMENSIONES_BENCHMARK,
    criteriosAdmision: CRITERIOS_ADMISION,
    candidatos: CANDIDATOS.map((c) => ({ ...c, desbloquea: queDesbloquea(c.id) })),
    protocolo: PROTOCOLO,
    pendientes: PENDIENTES,

    campoDeReferencia: CAMPOS_PIEZA.map((c) => c.id),

    metricaDeDecision: "coste por evidencia util",

    reglaDura:
      "Un proveedor sin URL verificable por pieza queda descartado antes de mirar su precio."
  };
}


export default {
  ESTADO_BENCHMARK,
  DIMENSIONES_BENCHMARK,
  CRITERIOS_ADMISION,
  CANDIDATOS,
  PROTOCOLO,
  PENDIENTES,
  queDesbloquea,
  fichaCompleta
};
