// apps/backend/services/conversation/topicExtractor.js

import { tokenizar } from "../textUtils.js";
import { UMBRALES } from "./conversationContracts.js";

/*
===========================================================
TOPIC EXTRACTOR — agrupacion tematica determinista
===========================================================

Agrupa evidencias por tema. Sin modelo de lenguaje, y no por
falta de medios: por explicabilidad.

POR QUE DETERMINISTA
-----------------------------------------------------------

El Cap. 9 exige IA1: explicable siempre. Un agrupamiento
semantico por embeddings daria mejores clusters y respondaria
"por que estan juntas estas notas" con un numero de distancia
que nadie puede auditar.

Aqui la respuesta es literal: estan juntas porque comparten
estos terminos, que aparecen estas veces. El analista puede
discrepar mirando la misma evidencia.

Y hay un segundo motivo, mas prosaico: el mismo lote de
evidencias debe producir el mismo agrupamiento hoy y dentro de
un mes. Sin eso, el Replay Intelligence reconstruiria un
pasado distinto del que ocurrio.

DOS CAPAS
-----------------------------------------------------------

  1. LEXICO DE DOMINIO. Categorias declaradas —agua,
     seguridad, movilidad...— con sus terminos. Cuando una
     evidencia los toca, el tema tiene NOMBRE y el nombre es
     auditable.

  2. TEMAS EMERGENTES. Lo que el lexico no cubre se agrupa por
     coocurrencia de terminos frecuentes, y se etiqueta con
     sus propios terminos, no con una categoria inventada.

La segunda capa existe porque un lexico cerrado solo encuentra
lo que ya sabia buscar, y entonces el modulo confirmaria la
agenda del analista en lugar de informarla.
===========================================================
*/


/*
-----------------------------------------------------------
LEXICO DE DOMINIO

Ambito municipal y electoral. Es CONFIGURACION, no motor: un
paquete de dominio distinto (Crisis, Seguridad, Agua) trae su
propio lexico sin tocar una linea de este archivo.

Los terminos van normalizados —sin tildes, en minusculas—
porque asi los devuelve `tokenizar`.
-----------------------------------------------------------
*/

export const LEXICO_DOMINIO = Object.freeze({
  agua: {
    nombre: "Agua y saneamiento",
    terminos: [
      "agua", "potable", "alcantarillado", "etapa", "desabastecimiento",
      "corte", "cortes", "tarifa", "saneamiento", "planta", "acueducto",
      "aguas", "residuales", "sequia"
    ]
  },

  movilidad: {
    nombre: "Movilidad y transporte",
    terminos: [
      "tranvia", "transporte", "trafico", "vial", "vialidad", "vias",
      "movilidad", "bus", "buses", "pasaje", "peaje", "ciclovia",
      "estacionamiento", "semaforo", "congestion"
    ]
  },

  obras: {
    nombre: "Obra publica",
    terminos: [
      "obra", "obras", "construccion", "inauguracion", "inauguro",
      "asfalto", "pavimentacion", "puente", "regeneracion", "mantenimiento",
      "adoquinado", "licitacion", "contrato"
    ]
  },

  seguridad: {
    nombre: "Seguridad ciudadana",
    terminos: [
      "seguridad", "delincuencia", "robo", "robos", "asalto", "policia",
      "homicidio", "extorsion", "violencia", "patrullaje", "camaras",
      "inseguridad", "operativo"
    ]
  },

  salud: {
    nombre: "Salud",
    terminos: [
      "salud", "hospital", "centro", "medico", "medicos", "medicinas",
      "emergencia", "vacunacion", "brote", "epidemia", "atencion"
    ]
  },

  educacion: {
    nombre: "Educacion",
    terminos: [
      "educacion", "escuela", "escuelas", "colegio", "colegios",
      "universidad", "estudiantes", "docentes", "matricula", "clases"
    ]
  },

  ambiente: {
    nombre: "Ambiente y territorio",
    terminos: [
      "ambiental", "ambiente", "basura", "residuos", "reciclaje",
      "contaminacion", "rio", "rios", "paramo", "bosque", "arboles",
      "mineria", "quema"
    ]
  },

  economia: {
    nombre: "Economia y empleo",
    terminos: [
      "empleo", "desempleo", "comerciantes", "comercio", "mercado",
      "mercados", "emprendimiento", "inversion", "presupuesto",
      "impuestos", "predial", "turismo", "economia"
    ]
  },

  gobernanza: {
    nombre: "Gestion y gobernanza",
    terminos: [
      "concejo", "cabildo", "municipio", "municipal", "alcaldia",
      "prefectura", "ordenanza", "sesion", "resolucion", "gestion",
      "rendicion", "cuentas", "veeduria"
    ]
  },

  integridad: {
    nombre: "Integridad publica",
    terminos: [
      "corrupcion", "peculado", "sobreprecio", "irregularidades",
      "contraloria", "fiscalia", "denuncia", "investigacion", "auditoria",
      "glosa", "sancion"
    ]
  },

  electoral: {
    nombre: "Proceso electoral",
    terminos: [
      "campana", "candidato", "candidata", "candidatura", "elecciones",
      "electoral", "votos", "votacion", "encuesta", "binomio", "partido",
      "movimiento", "inscripcion", "papeleta", "cne"
    ]
  },

  social: {
    nombre: "Movilizacion social",
    terminos: [
      "protesta", "marcha", "plantón", "planton", "paro", "huelga",
      "moradores", "vecinos", "dirigentes", "comunidad", "asamblea",
      "reclamo", "exigen"
    ]
  }
});


/*
  Terminos que nunca deben etiquetar un tema. Son frecuentes en
  prensa y no discriminan nada: un tema llamado "dijo" no es un
  tema.
*/
const RUIDO = new Set([
  "dijo", "señalo", "senalo", "indico", "afirmo", "aseguro", "explico",
  "informo", "anuncio", "manifesto", "sostuvo", "agrego", "destaco",
  "durante", "tras", "segun", "ademas", "tambien", "mientras", "luego",
  "ayer", "hoy", "manana", "dias", "dia", "ano", "anos", "hora", "horas",
  "millones", "mil", "dolares", "por ciento", "ciento",
  "ecuador", "ecuatoriano", "ecuatoriana", "nacional", "pais"
]);


function terminosDe(evidencia, excluidos) {
  const texto = [evidencia?.titulo, evidencia?.descripcion]
    .filter((t) => typeof t === "string" && t.trim())
    .join(" ");

  /*
    UN MEDIO NO ES UN TEMA.

    El nombre del publicador se cuela en el titular y en el
    resumen. Medido sobre datos reales de Cuenca: "elmercurio"
    aparecio como tema emergente con 4 evidencias, que es solo
    el nombre del diario que las publico.

    Quien publica es una dimension real —y el registro de
    medios la mide—, pero es OTRA pregunta. Mezclarlas
    convertiria el panel de temas en un ranking de cabeceras.

    Se excluye por evidencia y no por catalogo: asi tambien
    quedan fuera los medios que el catalogo aun no conoce.
  */
  const delMedio = new Set(
    [evidencia?.fuenteDeclarada, evidencia?.dominio]
      .filter(Boolean)
      .flatMap((v) => tokenizar(String(v).replace(/\./g, " "), 3))
  );

  return tokenizar(texto, 4).filter(
    (t) => !RUIDO.has(t) && !excluidos.has(t) && !delMedio.has(t)
  );
}


/*
-----------------------------------------------------------
TERMINOS DEL PROPIO AMBITO

Un analisis de Cuenca produce, sin esto, un tema emergente
llamado "cuenca" con la mitad de las evidencias dentro.
Medido: 15 de 24 en la primera prueba real.

No es un tema: es el criterio de busqueda devuelto como
hallazgo. Todas las evidencias mencionan el territorio porque
se buscaron por el territorio, y agrupar por eso no informa de
nada.

Se excluyen del agrupamiento EMERGENTE, no del texto: si
"Cuenca" forma parte de un termino del lexico de dominio,
sigue contando alli.
-----------------------------------------------------------
*/

function terminosDelAmbito(ambito) {
  const fuera = new Set();

  if (!ambito) return fuera;

  [ambito.nombre, ...(ambito.alias || [])]
    .filter(Boolean)
    .forEach((n) => {
      tokenizar(n, 3).forEach((t) => fuera.add(t));
    });

  return fuera;
}


/*
===========================================================
CAPA 1 — CATEGORIAS DEL LEXICO
===========================================================
*/

function clasificarPorLexico(terminos) {
  const golpes = [];

  Object.entries(LEXICO_DOMINIO).forEach(([id, cat]) => {
    const coincidencias = terminos.filter((t) => cat.terminos.includes(t));

    if (coincidencias.length === 0) return;

    golpes.push({
      id,
      nombre: cat.nombre,
      coincidencias: [...new Set(coincidencias)],
      fuerza: coincidencias.length
    });
  });

  return golpes.sort((a, b) => b.fuerza - a.fuerza);
}


/*
===========================================================
CAPA 2 — TEMAS EMERGENTES POR COOCURRENCIA

Se toman los terminos frecuentes que el lexico no reclamo y se
agrupan las evidencias que los comparten. La etiqueta del tema
son sus propios terminos: no se inventa un nombre de categoria
que nadie declaro.
===========================================================
*/

function temasEmergentes(sinCategoria, umbralFrecuencia) {
  const frecuencia = new Map();

  sinCategoria.forEach(({ terminos }) => {
    /*
      Se cuenta una vez por evidencia, no por aparicion: un
      titular que repite una palabra tres veces no la hace
      tres veces mas relevante.
    */
    [...new Set(terminos)].forEach((t) => {
      frecuencia.set(t, (frecuencia.get(t) || 0) + 1);
    });
  });

  const semillas = [...frecuencia.entries()]
    .filter(([, n]) => n >= umbralFrecuencia)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);

  const temas = [];

  const asignadas = new Set();

  semillas.forEach((semilla) => {
    const miembros = sinCategoria.filter(
      (e) => !asignadas.has(e.indice) && e.terminos.includes(semilla)
    );

    if (miembros.length < UMBRALES.EVIDENCIAS_POR_TEMA) return;

    miembros.forEach((m) => asignadas.add(m.indice));

    /*
      Terminos que acompanan a la semilla en sus miembros: dan
      contexto a la etiqueta sin inventar categoria.
    */
    const acompanan = new Map();

    miembros.forEach((m) => {
      [...new Set(m.terminos)]
        .filter((t) => t !== semilla)
        .forEach((t) => acompanan.set(t, (acompanan.get(t) || 0) + 1));
    });

    const contexto = [...acompanan.entries()]
      .filter(([, n]) => n >= Math.max(2, Math.ceil(miembros.length * 0.4)))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t]) => t);

    temas.push({
      id: `emergente-${semilla}`,
      nombre: [semilla, ...contexto].join(" · "),
      origen: "emergente",
      terminos: [semilla, ...contexto],
      indices: miembros.map((m) => m.indice)
    });
  });

  return { temas, sinAsignar: sinCategoria.filter((e) => !asignadas.has(e.indice)) };
}


/*
===========================================================
EXTRAER TEMAS DE UN LOTE
===========================================================
*/

export function extraerTemas(evidencias = [], opciones = {}) {
  const lista = Array.isArray(evidencias) ? evidencias : [];

  const umbralFrecuencia = Number.isFinite(opciones.frecuenciaMinima)
    ? opciones.frecuenciaMinima
    : UMBRALES.FRECUENCIA_TERMINO;

  const umbralTema = Number.isFinite(opciones.evidenciasPorTema)
    ? opciones.evidenciasPorTema
    : UMBRALES.EVIDENCIAS_POR_TEMA;

  const excluidos = terminosDelAmbito(opciones.ambito);

  (opciones.terminosExcluidos || []).forEach((t) =>
    tokenizar(t, 3).forEach((x) => excluidos.add(x))
  );

  const preparadas = lista.map((e, indice) => ({
    indice,
    evidencia: e,
    terminos: terminosDe(e, excluidos)
  }));

  const sinTexto = preparadas.filter((p) => p.terminos.length === 0);

  const conTexto = preparadas.filter((p) => p.terminos.length > 0);

  /* --- Capa 1 --- */
  const porCategoria = new Map();

  const sinCategoria = [];

  conTexto.forEach((p) => {
    const golpes = clasificarPorLexico(p.terminos);

    if (golpes.length === 0) {
      sinCategoria.push(p);
      return;
    }

    /*
      Una evidencia puede tocar varias categorias —agua y
      protesta, por ejemplo— y se cuenta en todas. Es
      deliberado: forzar una sola perderia la mitad de la
      informacion. La consecuencia se declara: la suma de los
      temas puede superar el numero de evidencias.
    */
    golpes.forEach((g) => {
      if (!porCategoria.has(g.id)) {
        porCategoria.set(g.id, {
          id: g.id,
          nombre: g.nombre,
          origen: "lexico",
          terminos: new Set(),
          indices: []
        });
      }

      const acc = porCategoria.get(g.id);

      g.coincidencias.forEach((c) => acc.terminos.add(c));

      acc.indices.push(p.indice);
    });
  });

  /* --- Capa 2 --- */
  const emergentes = temasEmergentes(sinCategoria, umbralFrecuencia);

  /* --- Union y filtro por umbral --- */
  const crudos = [
    ...[...porCategoria.values()].map((t) => ({
      ...t,
      terminos: [...t.terminos]
    })),
    ...emergentes.temas
  ];

  const temas = crudos
    .filter((t) => t.indices.length >= umbralTema)
    .map((t) => construirTema(t, lista))
    .sort((a, b) => b.evidencias - a.evidencias);

  const descartados = crudos
    .filter((t) => t.indices.length < umbralTema)
    .map((t) => ({
      id: t.id,
      nombre: t.nombre,
      evidencias: t.indices.length,
      motivo: `Por debajo del umbral de ${umbralTema} evidencias. Un tema con menos no es un tema, es una nota.`
    }));

  const cubiertas = new Set(temas.flatMap((t) => t.indices));

  return {
    temas,
    descartados,

    metricas: {
      evidencias: lista.length,
      sinTextoUtilizable: sinTexto.length,
      conCategoria: conTexto.length - sinCategoria.length,
      temasDelLexico: temas.filter((t) => t.origen === "lexico").length,
      temasEmergentes: temas.filter((t) => t.origen === "emergente").length,
      evidenciasEnAlgunTema: cubiertas.size,
      evidenciasSinTema: lista.length - cubiertas.size
    },

    metodo: {
      tipo: "determinista",
      capas: [
        "lexico de dominio declarado (categorias con nombre auditable)",
        "coocurrencia de terminos frecuentes (temas emergentes, etiquetados por sus propios terminos)"
      ],
      porQue:
        "El mismo lote produce el mismo agrupamiento hoy y dentro de un mes. Sin esa estabilidad, Replay Intelligence reconstruiria un pasado distinto del que ocurrio.",
      lexicoDeclarado: Object.keys(LEXICO_DOMINIO),
      terminosExcluidos: [...excluidos]
    },

    loQueNoSabemos: [
      sinTexto.length
        ? `${sinTexto.length} evidencia(s) sin texto utilizable: no entran en ningun tema.`
        : null,

      lista.length - cubiertas.size > 0
        ? `${lista.length - cubiertas.size} evidencia(s) no encajan en ningun tema con la muestra actual. No es que no traten de nada: es que no hay suficientes parecidas.`
        : null,

      descartados.length
        ? `${descartados.length} agrupacion(es) descartadas por no alcanzar el umbral de ${umbralTema} evidencias.`
        : null,

      "Una evidencia puede pertenecer a varios temas, asi que la suma de evidencias por tema puede superar el total del lote.",

      "El lexico de dominio es una decision declarada, no un descubrimiento: solo encuentra las categorias que alguien escribio. Los temas emergentes existen precisamente para cubrir lo que el lexico no previo.",

      excluidos.size
        ? `Los terminos del propio territorio (${[...excluidos]
            .slice(0, 5)
            .join(", ")}) no forman tema: aparecen en casi toda la evidencia porque se busco por ellos.`
        : null
    ].filter(Boolean)
  };
}


function construirTema(crudo, evidencias) {
  const miembros = crudo.indices.map((i) => evidencias[i]).filter(Boolean);

  const fechas = miembros
    .map((m) => m?.fecha)
    .filter(Boolean)
    .sort();

  return {
    id: crudo.id,
    nombre: crudo.nombre,
    origen: crudo.origen,

    terminos: crudo.terminos.slice(0, 8),

    evidencias: crudo.indices.length,
    indices: crudo.indices,

    primeraFecha: fechas[0] || null,
    ultimaFecha: fechas[fechas.length - 1] || null,
    evidenciasSinFecha: miembros.length - fechas.length,

    /*
      Por que estan juntas. Es la respuesta que un agrupamiento
      semantico no puede dar.
    */
    explicacion:
      crudo.origen === "lexico"
        ? `Agrupadas porque contienen terminos del lexico declarado de "${crudo.nombre}": ${crudo.terminos
            .slice(0, 6)
            .join(", ")}.`
        : `Agrupadas por coocurrencia de terminos frecuentes: ${crudo.terminos.join(
            ", "
          )}. No corresponde a ninguna categoria declarada.`,

    titulares: miembros
      .slice(0, 5)
      .map((m) => m?.titulo)
      .filter(Boolean)
  };
}


export default { extraerTemas, LEXICO_DOMINIO };
