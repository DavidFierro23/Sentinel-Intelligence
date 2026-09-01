// apps/backend/services/media/mediaHome.js

import {
  leerCorpusDeProyecto,
  resolverVentana,
  aplicarVentana
} from "./mediaCorpus.js";

import { temasDePieza } from "./pieceTopics.js";

import {
  GATE,
  DIMENSIONES,
  ESTADOS_DATO,
  EXPLICACION_ESTADOS,
  SECCIONES,
  GRUPOS_FUENTE,
  VENTANAS_HOME,
  VENTANA_POR_DEFECTO,
  EQUIVALENCIAS_PROHIBIDAS_HOME,
  REGLA_CORRESPONDENCIA,
  CONTRATO_MEDIA_HOME,
  preguntasRespondibles,
  etiquetaDeEstado,
  NOTA_METODOLOGICA,
  DIMENSIONES_FUTURAS,
  TAMANOS_RANKING
} from "./mediaVocabulary.js";

import { contenidoDeProyecto } from "../projects/projectStore.js";

import { unidadPorId } from "../geo/territoryRegistry.js";

/*
===========================================================
MEDIA-UX-HOME-01 — AGREGACION DE LA HOME
===========================================================

Convierte el corpus de un proyecto en las secciones de la vista
principal. Solo lee: ni un proveedor, ni una unidad de cuota,
ni una escritura.

LA REGLA QUE GOBIERNA TODO EL FICHERO
-----------------------------------------------------------

Cada cifra sale por `medida()` y lleva su estado. La pregunta
que hay que responder en cada campo no es «cuanto vale» sino:

    ¿un 0 aqui seria una MEDICION o un HUECO NUESTRO?

Si es una medicion, se devuelve 0. Si es un hueco, se devuelve
`null` con el estado y el motivo. Confundirlos es el error que
convierte «no lo hemos mirado» en «no ocurre», y en un panel de
campana eso se lee como un hecho.

QUE NO SE CALCULA, Y POR QUE
-----------------------------------------------------------

    INCIDENCIA        no hay metodologia; se devuelve sin valor
    TERRITORIO        no se persiste por pieza; se declara
    PIEZAS/CANDIDATO  la arista se deduplica por par; se declara

Las tres podrian rellenarse con una aproximacion creible. Ese
es exactamente el motivo para no hacerlo.

EL AGREGADOR QUE HABRIA ARRUINADO EL RANKING
-----------------------------------------------------------

En el corpus real `google.com` aparece con mas piezas que casi
cualquier medio, porque la cobertura se recogio con SerpAPI y
los enlaces vuelven envueltos en `google.com/goto?url=...`. Un
ranking ingenuo lo colocaria entre los primeros «medios» de
Cuenca.

No es un medio: es un artefacto de nuestra propia recoleccion.
`mediaRegistry` ya lo tipa como AGREGADOR, asi que el ranking
lo separa en una lista aparte, declarada y visible. Ocultarlo
seria igual de malo que rankearlo: el analista tiene que ver
que parte de su corpus es residuo del metodo.
===========================================================
*/


/*
-----------------------------------------------------------
UNA CIFRA CON SU ESTADO

`valor: null` obliga a `estado`. Un test lo comprueba, porque
la tentacion de devolver null «y ya» es permanente.
-----------------------------------------------------------
*/
export function medida(valor, { estado = null, motivo = null, nota = null } = {}) {
  const ausente = valor === null || valor === undefined;

  const estadoFinal = ausente ? estado || ESTADOS_DATO.NO_DISPONIBLE : estado;

  return {
    valor: ausente ? null : valor,

    estado: estadoFinal,

    /*
      MEDIA-UX-CERT-01. La etiqueta humana viaja JUNTO al valor
      tecnico, no en su lugar: la pantalla necesita «Cobertura
      insuficiente» y quien audita necesita COBERTURA_INSUFICIENTE.
      Traducirlo en la UI habria puesto el diccionario en dos
      sitios, y dos diccionarios divergen.
    */
    etiqueta: etiquetaDeEstado(estadoFinal),

    motivo:
      ausente && !motivo
        ? EXPLICACION_ESTADOS[estado] || null
        : motivo,

    nota
  };
}


/*
-----------------------------------------------------------
UNA CIFRA DE VENTANA — el cero que no es un cero

Un recuento por ventana tiene TRES resultados posibles y solo
uno de ellos es un numero:

    no hay piezas de esa fuente          -> 0, y es una medicion
    hay piezas y ninguna es datable      -> null, COBERTURA_INSUFICIENTE
    hay piezas datables                  -> el recuento

El caso del medio es el que importa. El Mercurio tiene ocho
piezas en el corpus y ninguna con fecha ISO utilizable: si la
ventana devuelve 0, la fila se lee «El Mercurio no publico
nada», que es exactamente lo contrario de lo que ocurre. El
hueco es NUESTRO —no persistimos su fecha— y tiene que
aparecer como hueco.
-----------------------------------------------------------
*/
export function medidaEnVentana({
  enVentana,
  enCorpus,
  datablesEnCorpus,
  nota = null
}) {
  if (enCorpus === 0) {
    return medida(0, {
      estado: ESTADOS_DATO.SIN_EVIDENCIA,
      motivo: "No hay ninguna pieza de este tipo en el corpus del proyecto.",
      nota
    });
  }

  if (datablesEnCorpus === 0) {
    return medida(null, {
      estado: ESTADOS_DATO.COBERTURA_INSUFICIENTE,

      motivo: `Hay ${enCorpus} pieza(s) en el corpus y ninguna tiene fecha de publicacion en formato ISO-8601, asi que la ventana no puede situar ni una. Devolver 0 afirmaria que no publico nada.`,

      nota
    });
  }

  return medida(enVentana, {
    nota:
      enCorpus !== enVentana
        ? `${enCorpus} en el corpus completo; ${enCorpus - datablesEnCorpus} sin fecha utilizable y ${datablesEnCorpus - enVentana} fuera de la ventana.`
        : nota
  });
}


/* Tipos de catalogo que NO son fuentes originales de publicacion. */
const TIPOS_NO_ORIGINALES = ["agregador", "enciclopedico"];


function esFuenteOriginal(fuente) {
  if (fuente?.esInfraestructura) return false;

  return !TIPOS_NO_ORIGINALES.includes(fuente?.catalogo?.tipo);
}


/*
  Por que una fuente salio del ranking. Cada motivo nombra una
  categoria distinta de artefacto: mezclarlos en «no es un medio»
  impediria saber si el problema es nuestro metodo de recoleccion
  o la infraestructura del propio publicador.
*/
function motivoDeExclusion(fuente) {
  if (fuente?.esInfraestructura) {
    return "Es un host de infraestructura —un balanceador de carga o una CDN—, no una cabecera. Describe desde que servidor se sirvio la pagina, no quien la publico.";
  }

  if (fuente?.catalogo?.tipo === "agregador") {
    return "Es un agregador o un redirector de buscador: su presencia dice como recogimos la cobertura, no quien publico. Incluirlo en el ranking lo presentaria como un medio.";
  }

  return "No es una fuente original de publicacion.";
}


/*
===========================================================
HOME DE UN PROYECTO
===========================================================
*/
export async function homeDeProyecto(opciones = {}) {
  const ventanaPedida = String(opciones.ventana || VENTANA_POR_DEFECTO);

  const ahora = opciones.ahora || new Date().toISOString();

  /*
    -----------------------------------------------------------
    NOMBRES LEGIBLES

    La certificacion visual encontro `paul-carrasco-carpio`
    pintado tal cual en la tabla de candidatos. Un identificador
    tecnico en una pantalla de campana no es un detalle
    cosmetico: parece que el sistema no sabe quien es.

    El nombre se resuelve del proyecto —la misma fuente que la
    ficha del candidato— y el id NUNCA se pierde: viaja al lado,
    porque es lo que permite auditar la arista.

    Si el proyecto no responde, se sigue con el id. Un fallo
    resolviendo nombres no puede dejar sin HOME al analista.
    -----------------------------------------------------------
  */
  const nombresDeCandidato = new Map();

  try {
    const contenido = await contenidoDeProyecto(opciones.projectId);

    (contenido?.candidatos || []).forEach((c) => {
      const id = c.candidateId || c.id;

      if (id && c.nombre) nombresDeCandidato.set(id, c.nombre);
    });
  } catch {
    /* Sin nombres: se muestran los ids, que siguen siendo correctos. */
  }

  const corpus = await leerCorpusDeProyecto(opciones);

  if (!corpus.ok) {
    return {
      ok: false,
      gate: GATE,
      motivo: corpus.motivo,
      estado: corpus.estado || ESTADOS_DATO.NO_DISPONIBLE
    };
  }

  const ventana = resolverVentana(ventanaPedida, ahora);

  const todasLasPiezas = [...corpus.piezas, ...corpus.amplificacion];

  const enVentana = aplicarVentana(todasLasPiezas, ventana);

  /*
    Las claves de las piezas que la ventana SI puede situar
    dentro. Todo lo que se filtra por ventana se filtra con este
    conjunto, para que no haya dos criterios temporales.
  */
  const clavesEnVentana = new Set(enVentana.dentro.map((p) => p.clave));

  const analizadasEnVentana = corpus.piezas.filter((p) =>
    clavesEnVentana.has(p.clave)
  );

  const relacionadasEnVentana = corpus.amplificacion.filter((p) =>
    clavesEnVentana.has(p.clave)
  );

  const fuentesOriginales = corpus.fuentes.filter(esFuenteOriginal);

  const artefactos = corpus.fuentes.filter((f) => !esFuenteOriginal(f));

  const porGrupo = (grupo) =>
    fuentesOriginales.filter((f) => f.grupo === grupo);

  const noClasificadas = porGrupo(GRUPOS_FUENTE.NO_CLASIFICADO);

  const autores = [
    ...new Set(todasLasPiezas.map((p) => p.autor).filter(Boolean))
  ].sort();

  const piezasSinAutor = todasLasPiezas.filter((p) => !p.autor).length;

  const candidatos = [
    ...new Set(corpus.relaciones.map((r) => r.target).filter(Boolean))
  ].sort();

  const historias = construirHistorias(corpus);

  const evidencias = [
    ...new Set(
      [
        ...todasLasPiezas.map((p) => p.evidenceId),
        ...corpus.relaciones.flatMap((r) => r.evidenceIds || [])
      ].filter(Boolean)
    )
  ];

  return {
    ok: true,
    gate: GATE,
    contrato: CONTRATO_MEDIA_HOME.version,

    proyecto: {
      projectId: corpus.projectId,
      tenantId: corpus.tenantId,

      declaracion:
        "Media Intelligence vive DENTRO de un proyecto. Toda cifra de esta vista pertenece a este projectId y a ningun otro."
    },

    ventana: {
      ...ventana,
      ...enVentana.recuento,
      estado: enVentana.estado,
      declaracionDeCobertura: enVentana.declaracion
    },

    /*
      Las cinco ventanas evaluadas de una vez. La UI ofrece las
      que pueden situar algo y no deja al analista pedir una
      para recibir un panel vacio sin explicacion.
    */
    ventanas: VENTANAS_HOME.map((v) => {
      const w = resolverVentana(v.id, ahora);

      const r = aplicarVentana(todasLasPiezas, w);

      return {
        id: v.id,
        etiqueta: v.etiqueta,
        dias: v.dias,
        desde: w.desde,
        hasta: w.hasta,
        ...r.recuento,
        estado: r.estado,
        estadoEtiqueta: etiquetaDeEstado(r.estado),
        declaracion: r.declaracion
      };
    }),

    /*
      -----------------------------------------------------------
      RESUMEN
      -----------------------------------------------------------
    */
    resumen: {
      piezasObservadas: medidaEnVentana({
        enVentana: enVentana.dentro.length,
        enCorpus: todasLasPiezas.length,
        datablesEnCorpus: enVentana.dentro.length + enVentana.fuera.length,
        nota: `${todasLasPiezas.length} pieza(s) en el corpus del proyecto; ${enVentana.recuento.sinFechaUtilizable} sin fecha utilizable para situarlas en una ventana.`
      }),

      piezasAnalizadas: medidaEnVentana({
        enVentana: analizadasEnVentana.length,
        enCorpus: corpus.piezas.length,
        datablesEnCorpus: corpus.piezas.filter((p) => p.publishedAt).length,
        nota: `${corpus.piezas.length} analizada(s) en el corpus completo. Una pieza analizada es una URL que un analista pego y Sentinel resolvio.`
      }),

      piezasRelacionadas: medidaEnVentana({
        enVentana: relacionadasEnVentana.length,
        enCorpus: corpus.amplificacion.length,
        datablesEnCorpus: corpus.amplificacion.filter((p) => p.publishedAt).length,
        nota: `${corpus.amplificacion.length} relacionada(s) en el corpus completo. Llegan de la busqueda de amplificacion, no de un analisis directo.`
      }),

      /*
        Independiente de la ventana. Es la cifra que un analista
        necesita para saber que el corpus NO esta vacio cuando la
        ventana no puede situar nada.
      */
      piezasEnCorpus: medida(todasLasPiezas.length, {
        nota: "Total del corpus del proyecto, sin filtrar por ventana."
      }),

      /*
        Tercera magnitud. No se suma a las otras dos: es el
        numero de asuntos con amplificacion observada, no de
        documentos.
      */
      contenidosObservados: medida(
        new Set(
          corpus.amplificacion.map((p) => p.piezaOrigen).filter(Boolean)
        ).size,
        {
          nota: "Un contenido es el asunto que varias piezas comparten. Piezas, fuentes y contenidos son magnitudes distintas y no se suman entre si."
        }
      ),

      fuentesDistintas: medida(fuentesOriginales.length, {
        nota:
          artefactos.length > 0
            ? `${artefactos.length} dominio(s) mas quedaron fuera por ser artefactos de recoleccion (agregadores o enciclopedicos), no fuentes que publiquen.`
            : null
      }),

      medios: medida(porGrupo(GRUPOS_FUENTE.MEDIO).length, {
        nota: "Clasificados como MEDIO por el catalogo de medios, no por volumen de publicacion."
      }),

      periodistas: medida(autores.length, {
        estado: piezasSinAutor > 0 ? ESTADOS_DATO.COBERTURA_INSUFICIENTE : null,

        nota: `Solo cuenta la autoria que la pieza publica en metadata legible. ${piezasSinAutor} de ${todasLasPiezas.length} pieza(s) no la traen, asi que esta cifra es un minimo, no un total.`,

        motivo:
          piezasSinAutor > 0
            ? "Ninguna firma se deduce del texto de la pieza. Sin metadata de autor, la pieza no aporta periodista."
            : null
      }),

      creadores: medida(porGrupo(GRUPOS_FUENTE.CREADOR).length, {
        estado:
          porGrupo(GRUPOS_FUENTE.CREADOR).length === 0
            ? ESTADOS_DATO.SIN_EVIDENCIA
            : null,

        nota:
          noClasificadas.length > 0
            ? `${noClasificadas.length} fuente(s) estan en NO_CLASIFICADO y alguna podria ser creador. No se asciende por volumen ni por seguidores.`
            : null
      }),

      instituciones: medida(porGrupo(GRUPOS_FUENTE.INSTITUCION).length),

      cuentas: medida(porGrupo(GRUPOS_FUENTE.CUENTA).length, {
        nota: "Cuentas identificadas cuya clase no esta demostrada (COMUNIDAD u OTRO en el contrato de emisor)."
      }),

      noClasificados: medida(noClasificadas.length, {
        nota: "La fuente esta identificada y ninguna evidencia dice QUE es. Es un resultado, no un fallo."
      }),

      candidatosRelacionados: medida(candidatos.length, {
        nota: "Candidatos con al menos una arista MEDIO_PUBLICA_SOBRE observada en este proyecto."
      }),

      temasObservados: medida(historias.temas.length || null, {
        estado: historias.estado,
        motivo: historias.motivo
      }),

      /*
        El territorio se RESUELVE en el analisis de cada pieza
        —GEO-1 devolvio Cuenca con confianza 80 en la demo real—
        pero la fila que se persiste no lo guarda. Asi que a
        nivel de corpus no existe, y decirlo es la unica opcion
        honesta: lo que hay en el catalogo es donde un medio
        DECLARA cubrir, que es otra afirmacion.
      */
      territoriosObservados: medida(null, {
        estado: ESTADOS_DATO.NO_DISPONIBLE,

        motivo:
          "El territorio se resuelve por GEO-1 al analizar cada pieza, pero no se persiste en la fila de la pieza, asi que no puede agregarse sobre el corpus. Lo que el catalogo aporta es la cobertura DECLARADA de cada medio, que no es territorio observado.",

        nota: `${
          fuentesOriginales.filter((f) => f.coberturaDeclaradaEnCatalogo).length
        } fuente(s) tienen cobertura declarada en el catalogo de medios.`
      }),

      evidenciasDisponibles: medida(evidencias.length, {
        nota: "Identificadores de evidencia distintos alcanzables desde esta vista."
      })
    },

    /*
      -----------------------------------------------------------
      RANKING DE PRESENCIA OBSERVADA
      -----------------------------------------------------------
    */
    presencia: construirPresencia({
      fuentes: fuentesOriginales,
      artefactos,
      clavesEnVentana,
      corpus,
      historias,
      nombresDeCandidato,
      ventana
    }),

    /*
      -----------------------------------------------------------
      CANDIDATOS x MEDIOS
      -----------------------------------------------------------
    */
    candidatosPorFuente: construirCandidatosPorFuente({
      corpus,
      candidatos,
      historias,
      nombresDeCandidato,
      fuentesOriginales
    }),

    historias,

    amplificacion: construirAmplificacion({ corpus, relacionadasEnVentana }),

    fuentes: construirProcedencia({ corpus, evidencias }),

    /*
      -----------------------------------------------------------
      INCIDENCIA — siempre sin valor
      -----------------------------------------------------------
    */
    incidencia: {
      ...DIMENSIONES.INCIDENCIA,

      valor: null,

      /* Misma regla que `medida()`: crudo para auditar, etiqueta para la pantalla. */
      estadoEtiqueta: etiquetaDeEstado(DIMENSIONES.INCIDENCIA.estado),

      /*
        Se calcula lo que falta con los datos REALES, para que la
        declaracion no sea generica: dice cuantas piezas no se
        pueden situar en el tiempo, que es la razon concreta por
        la que hoy no hay metodologia posible.
      */
      porQueNoHoy: `De ${todasLasPiezas.length} pieza(s) del corpus, ${enVentana.recuento.sinFechaUtilizable} no se pueden situar en el tiempo. Sin orden temporal fiable no se puede afirmar que una fuente aparezca antes del crecimiento de un tema, que es la mitad de la definicion de incidencia.`
    },

    /*
      -----------------------------------------------------------
      DIMENSIONES Y VOCABULARIO
      -----------------------------------------------------------
    */
    dimensiones: {
      presencia: DIMENSIONES.PRESENCIA,
      amplificacion: DIMENSIONES.AMPLIFICACION,
      incidencia: DIMENSIONES.INCIDENCIA
    },

    secciones: SECCIONES,

    reglaCorrespondencia: REGLA_CORRESPONDENCIA,

    /*
      Preparacion de Sentinel AI. No hay ninguna respuesta
      generada: solo el mapa de que preguntas sostiene ya la
      forma de esta vista y que ejes le faltan a las demas.
    */
    sentinelAI: {
      implementado: false,

      declaracion:
        "Este gate NO implementa motor conversacional. Se declara que preguntas puede sostener la forma de esta vista, para que la siguiente etapa no tenga que rehacerla.",

      preguntas: preguntasRespondibles()
    },

    cobertura: {
      ...corpus.lectura,
      fechas: corpus.fechas,

      loQueNoSabemos: [
        corpus.aislamiento.declaracion,
        corpus.fechas.declaracion,
        enVentana.declaracion,
        "El corpus contiene lo que se ha analizado y lo que los buscadores devolvieron. Una fuente ausente puede no haber publicado, o no haber sido consultada.",
        ...(artefactos.length
          ? [
              `${artefactos.length} dominio(s) del corpus son artefactos de nuestra propia recoleccion y no fuentes que publiquen. Se listan aparte en presencia.artefactosDeRecoleccion.`
            ]
          : [])
      ]
    },

    aislamiento: corpus.aislamiento,

    declaraciones: {
      equivalenciasProhibidas: EQUIVALENCIAS_PROHIBIDAS_HOME,
      garantias: CONTRATO_MEDIA_HOME.garantias
    }
  };
}


/*
===========================================================
PRESENCIA OBSERVADA
===========================================================

Orden por recuento. Sin score, sin escala 0-100, sin pesos.

Un score compuesto exigiria decidir cuanto vale una pieza
analizada frente a una relacionada, y no hay ninguna
metodologia que lo sostenga: el numero saldria de una
preferencia mia disfrazada de metrica.
===========================================================
*/
/*
  Nombre legible de una unidad territorial. Si el registro no la
  conoce se devuelve el id: es peor un hueco que un id.
*/
function nombreDeUnidad(unidadId) {
  if (!unidadId) return null;

  try {
    return unidadPorId(unidadId)?.nombre || unidadId;
  } catch {
    return unidadId;
  }
}


/*
  Las razones por las que una fila esta donde esta. Solo hechos
  contables, cada uno con el dato que lo sostiene.
*/
function justificacion({ fuente, suyas, enVentana, datables, ventana, nombresDeCandidato }) {
  const razones = [];

  razones.push({
    clave: "piezas",
    texto: `${suyas.length} pieza(s) de esta fuente en el corpus del proyecto.`,
    valor: suyas.length
  });

  if (datables === 0 && suyas.length > 0) {
    razones.push({
      clave: "ventana",
      texto: `Ninguna tiene fecha en formato ISO-8601, asi que la ventana${ventana ? ` de ${ventana.etiqueta.toLowerCase()}` : ""} no puede situarlas. Su posicion la decide el corpus completo, no la ventana.`,
      valor: null
    });
  } else {
    razones.push({
      clave: "ventana",
      texto: `${enVentana.length} de ${datables} pieza(s) datables caen dentro de la ventana${ventana ? ` de ${ventana.etiqueta.toLowerCase()}` : ""}.`,
      valor: enVentana.length
    });
  }

  if (fuente.candidatosMencionados.length) {
    const nombres = fuente.candidatosMencionados.map(
      (id) => nombresDeCandidato.get(id) || id
    );

    razones.push({
      clave: "candidatos",
      texto: `Aristas MEDIO_PUBLICA_SOBRE observadas hacia: ${nombres.join(", ")}.`,
      valor: fuente.candidatosMencionados.length
    });
  } else {
    razones.push({
      clave: "candidatos",
      texto: "Ninguna arista hacia un candidato del proyecto.",
      valor: 0
    });
  }

  razones.push({
    clave: "clase",
    texto:
      fuente.catalogo?.motivo ||
      "La clase de esta fuente no procede del catalogo de medios.",
    valor: null
  });

  if (fuente.correspondencias?.length) {
    razones.push({
      clave: "correspondencia",
      texto: `Correspondencia observada con «${fuente.correspondencias[0].nombre}», en estado ${fuente.correspondencias[0].estado}. No cambia la clase.`,
      valor: null
    });
  }

  return {
    razones,

    /*
      Lo que esta justificacion NO es. Va dentro, porque es
      justo aqui donde alguien leeria «esta el primero, luego
      es el mas importante».
    */
    limite:
      "Estas razones explican la POSICION en el corpus observado. No explican audiencia, alcance ni importancia editorial, que este corpus no mide.",

    evidenciaDisponible: suyas.some((p) => p.evidenceId)
  };
}


export function construirPresencia({
  fuentes = [],
  artefactos = [],
  clavesEnVentana = new Set(),
  corpus,
  historias,
  nombresDeCandidato = new Map(),
  ventana = null
}) {
  const piezasPorClave = new Map(
    [...corpus.piezas, ...corpus.amplificacion].map((p) => [p.clave, p])
  );

  const filas = fuentes
    .map((f) => {
      /*
        Las piezas de esta fuente que caen en la ventana. Se
        recalcula por fuente en lugar de reutilizar el total del
        corpus: el ranking tiene que responder a la ventana o el
        selector seria decorativo.
      */
      const suyas = [...piezasPorClave.values()].filter(
        (p) => p.dominio === f.dominio
      );

      const enVentana = suyas.filter((p) => clavesEnVentana.has(p.clave));

      const datables = suyas.filter((p) => p.publishedAt).length;

      const temas = historias.temasPorFuente[f.dominio] || null;

      return {
        dominio: f.dominio,
        nombre: f.nombre || f.catalogo.nombre || f.dominio,

        clase: f.clase,
        grupo: f.grupo,
        conflictoDeClase: f.conflictoDeClase,
        tipoEnCatalogo: f.catalogo.tipo,

        piezasObservadas: medidaEnVentana({
          enVentana: enVentana.length,
          enCorpus: suyas.length,
          datablesEnCorpus: datables
        }),

        /*
          Siempre un numero, siempre sin ventana. Es lo que
          impide que una fila con la ventana en blanco parezca
          una fuente que no publica.
        */
        piezasEnCorpus: medida(suyas.length),

        piezasSinFechaUtilizable: medida(suyas.length - datables),

        piezasAnalizadas: medida(
          enVentana.filter((p) => p.origen === "ANALIZADA").length
        ),

        piezasRelacionadas: medida(
          enVentana.filter((p) => p.origen === "RELACIONADA").length
        ),

        candidatosMencionados: medida(f.candidatosMencionados.length, {
          nota: f.candidatosMencionados.length
            ? f.candidatosMencionados.join(", ")
            : null
        }),

        candidatos: f.candidatosMencionados,

        temas: medida(temas ? temas.length : null, {
          estado: temas ? null : historias.estado,
          motivo: temas ? null : historias.motivo
        }),

        /*
          Cobertura DECLARADA en el catalogo, nunca «territorio
          de esta fuente». Un medio que declara cubrir Cuenca no
          demuestra haber publicado sobre Cuenca.
        */
        /*
          Nombre de la unidad, no su id. La regla ya estaba fijada
          en MEDIA-REAL-DEMO-01 —«se muestra el NOMBRE del ambito,
          nunca el id tecnico»— y esta tabla la incumplia:
          mostraba `ec-azuay-cuenca`.
        */
        territorios: medida(
          f.coberturaDeclaradaEnCatalogo
            ? [nombreDeUnidad(f.coberturaDeclaradaEnCatalogo.unidadId)]
            : null,
          {
            estado: f.coberturaDeclaradaEnCatalogo
              ? null
              : ESTADOS_DATO.SIN_EVIDENCIA,

            nota: f.coberturaDeclaradaEnCatalogo
              ? `Cobertura DECLARADA en el catalogo (${f.coberturaDeclaradaEnCatalogo.resolucion}), no territorio observado en sus piezas.`
              : null
          }
        ),

        territorioId: f.coberturaDeclaradaEnCatalogo?.unidadId || null,

        autores: f.autores,

        /*
          La correspondencia viaja con la fila y NO cambia la
          clase. Es lo que permite mostrar «@tomebamba ~ Radio
          Tomebamba» sin convertir la cuenta en un medio.
        */
        correspondencias: f.correspondencias,

        ultimaObservacion: f.ultimaObservacion,
        publicacionMasReciente: f.publicacionMasReciente,

        /*
          -----------------------------------------------------
          ¿POR QUE ESTA AQUI?

          La justificacion se ENUMERA a partir de lo ya
          persistido: piezas, candidatos, evidencias y la ultima
          observacion. No hay ningun calculo nuevo y no hay
          ninguna frase generada: cada linea apunta a filas del
          Lake que se pueden abrir.

          Existe porque una lista ordenada sin explicacion se
          discute con opiniones. Con las cuatro lineas delante,
          se discute con evidencia.
          -----------------------------------------------------
        */
        porQue: justificacion({
          fuente: f,
          suyas,
          enVentana,
          datables,
          ventana,
          nombresDeCandidato
        })
      };
    })
    /*
      Orden estable de cuatro criterios.

      El segundo —piezas en el corpus— es el que hace utilizable
      la lista cuando la ventana no puede situar nada: sin el,
      las diez fuentes empatan a null y el orden lo decide el
      alfabeto, que es peor que no ordenar.

      El cuarto existe para que dos ejecuciones con los mismos
      datos devuelvan el mismo orden.
    */
    .sort(
      (a, b) =>
        (b.piezasObservadas.valor || 0) - (a.piezasObservadas.valor || 0) ||
        (b.piezasEnCorpus.valor || 0) - (a.piezasEnCorpus.valor || 0) ||
        (b.candidatosMencionados.valor || 0) -
          (a.candidatosMencionados.valor || 0) ||
        a.dominio.localeCompare(b.dominio)
    )
    .map((fila, i, todas) => ({
      rank: i + 1,

      /*
        Un empate se declara. Sin esto, el puesto 1 y el puesto 2
        con el mismo recuento se leen como una jerarquia.
      */
      empatadoConAnterior:
        i > 0 &&
        (todas[i - 1].piezasObservadas.valor || 0) ===
          (fila.piezasObservadas.valor || 0),

      ...fila
    }));

  /*
    Cuando NINGUNA fila tiene recuento de ventana, el primer
    criterio de orden no discrimina y el ranking lo decide de
    hecho el corpus completo. Eso no invalida la lista, pero
    cambia lo que significa y hay que decirlo en la respuesta.
  */
  const ordenDegradado =
    filas.length > 0 && filas.every((f) => f.piezasObservadas.valor === null);

  return {
    dimension: DIMENSIONES.PRESENCIA,

    ranking: filas,

    ordenDegradado,

    motivoOrdenDegradado: ordenDegradado
      ? "Ninguna fuente tiene piezas datables dentro de la ventana, asi que el orden lo decide el corpus completo y no la ventana seleccionada. La columna de ventana queda en COBERTURA_INSUFICIENTE a proposito."
      : null,

    /*
      Los dominios que NO son fuentes. Visibles a proposito: son
      residuo del metodo de recoleccion y el analista debe saber
      que parte de su corpus lo es.
    */
    artefactosDeRecoleccion: artefactos.map((f) => ({
      dominio: f.dominio,
      tipoEnCatalogo: f.catalogo.tipo,
      piezasObservadas: f.piezasObservadas,

      clase: f.esInfraestructura ? "INFRAESTRUCTURA" : "AGREGADOR",

      claseEtiqueta: f.esInfraestructura
        ? "Infraestructura"
        : "Agregador / redirector",

      motivoDeExclusion: motivoDeExclusion(f)
    })),

    /*
      El titulo que la pantalla debe usar. Se decide en el
      backend para que no haya dos nombres de la misma lista.
    */
    titulo: "PRESENCIA MEDIÁTICA OBSERVABLE",

    subtitulo: ventana ? ventana.etiqueta : null,

    notaMetodologica: NOTA_METODOLOGICA,

    /*
      Preparacion de TOP 10/20/50 y de las dimensiones futuras.
      Se declaran para que la pantalla se construya sabiendo que
      crecera, y para que ninguna dimension pueda encenderse sin
      su metodologia.
    */
    tamanosDisponibles: TAMANOS_RANKING,

    dimensionesFuturas: DIMENSIONES_FUTURAS,

    orden: "piezasObservadas, luego piezasEnCorpus, luego candidatosMencionados, luego dominio",

    sinScore:
      "Este orden es un RECUENTO, no una puntuacion. No hay score 0-100 ni pesos: decidir cuanto vale una pieza frente a otra exigiria una metodologia que no existe.",

    noEsRankingDeInfluencia:
      "PROHIBIDO leer este orden como influencia, poder mediatico o impacto. Mide cuanto aparece una fuente en el corpus observado del proyecto y nada mas."
  };
}


/*
===========================================================
CANDIDATOS x MEDIOS
===========================================================
*/
export function construirCandidatosPorFuente({
  corpus,
  candidatos = [],
  historias,
  nombresDeCandidato = new Map(),
  fuentesOriginales = []
}) {
  const dominiosOriginales = new Set(fuentesOriginales.map((f) => f.dominio));

  const filas = candidatos.map((candidateId) => {
    const suyas = corpus.relaciones.filter((r) => r.target === candidateId);

    const fuentes = [...new Set(suyas.map((r) => r.source).filter(Boolean))];

    const evidencias = [
      ...new Set(suyas.flatMap((r) => r.evidenceIds || []).filter(Boolean))
    ];

    const ultima = suyas
      .map((r) => r.observadaEn)
      .filter(Boolean)
      .sort()
      .pop() || null;

    /*
      Los temas del candidato exigirian el titular de cada pieza
      donde aparece, y la arista no las enumera. Se declara en
      lugar de aproximar con los temas de sus fuentes: los temas
      de un medio no son los temas de un candidato.
    */
    /*
      Las fuentes se separan en dos listas. En la tabla anterior
      aparecian juntas, asi que `google.com` figuraba como uno de
      los «medios» de un candidato con el mismo peso visual que
      El Mercurio. Son cosas distintas y ahora se cuentan aparte.
    */
    const mediaticas = fuentes.filter((d) => dominiosOriginales.has(d)).sort();

    const noMediaticas = fuentes.filter((d) => !dominiosOriginales.has(d)).sort();

    return {
      candidateId,

      /* El nombre para la pantalla; el id sigue viajando al lado. */
      nombre: nombresDeCandidato.get(candidateId) || candidateId,

      nombreResuelto: nombresDeCandidato.has(candidateId),

      fuentesDistintas: medida(mediaticas.length, {
        nota: `Fuentes con al menos una arista observada hacia este candidato.${
          noMediaticas.length
            ? ` Ademas ${noMediaticas.length} artefacto(s) de recoleccion, contados aparte porque no son fuentes que publiquen.`
            : ""
        }`
      }),

      principalesFuentes: mediaticas,

      artefactosDeRecoleccion: noMediaticas,

      /*
        NULL a proposito, con el motivo tecnico exacto. Es la
        cifra que mas se pediria y la que hoy no se puede dar sin
        inventarla.
      */
      piezasObservadas: medida(null, {
        estado: ESTADOS_DATO.NO_DISPONIBLE,

        motivo:
          "La arista MEDIO_PUBLICA_SOBRE se deduplica por el par (fuente, candidato) y conserva la evidencia de la ultima observacion, no la lista completa de piezas. Contar piezas por candidato exige una arista por pieza.",

        nota: `${evidencias.length} evidencia(s) directa(s) alcanzable(s) desde estas aristas.`
      }),

      evidenciasDirectas: medida(evidencias.length),

      evidenceIds: evidencias,

      temasAsociados: medida(null, {
        estado: historias.estado || ESTADOS_DATO.COBERTURA_INSUFICIENTE,

        motivo:
          "Requiere el titular de cada pieza donde aparece el candidato. Los temas de sus fuentes no son sus temas: un medio local publica de todo."
      }),

      ultimaObservacion: ultima,

      tiposDeArista: [...new Set(suyas.map((r) => r.tipo).filter(Boolean))]
    };
  })
    .sort(
      (a, b) =>
        (b.fuentesDistintas.valor || 0) - (a.fuentesDistintas.valor || 0) ||
        a.candidateId.localeCompare(b.candidateId)
    );

  const sinResolver = filas.filter((f) => !f.nombreResuelto).length;

  return {
    filas,

    /*
      Las tres lecturas prohibidas, juntas y en la respuesta. Es
      la seccion que mas invita a interpretar.
    */
    noSignifica: [
      "Mas menciones no es mejor.",
      "Mas menciones no es cobertura favorable: la presencia no tiene signo.",
      "Mas menciones no es intencion de voto."
    ],

    esPresenciaMediatica:
      "Medios y fuentes donde Sentinel OBSERVO una relacion con cada candidato, dentro del corpus de este proyecto. Es presencia mediatica observable y no tiene signo.",

    nombresSinResolver: sinResolver,

    advertenciaDeArista:
      corpus.relaciones.find((r) => r.advertencia)?.advertencia || null
  };
}


/*
===========================================================
AMPLIFICACION OBSERVADA
===========================================================
*/
export function construirAmplificacion({ corpus, relacionadasEnVentana = [] }) {
  const porRol = new Map();

  corpus.amplificacion.forEach((p) => {
    const rol = p.rol || "NO_DETERMINADO";

    porRol.set(rol, (porRol.get(rol) || 0) + 1);
  });

  const fuentes = [
    ...new Set(corpus.amplificacion.map((p) => p.dominio).filter(Boolean))
  ];

  const contenidos = [
    ...new Set(corpus.amplificacion.map((p) => p.piezaOrigen).filter(Boolean))
  ];

  return {
    dimension: DIMENSIONES.AMPLIFICACION,

    /*
      LAS TRES MAGNITUDES, juntas y declaradas. Quince piezas de
      diez fuentes sobre un asunto son 15 / 10 / 1.
    */
    piezasRelacionadas: medidaEnVentana({
      enVentana: relacionadasEnVentana.length,
      enCorpus: corpus.amplificacion.length,
      datablesEnCorpus: corpus.amplificacion.filter((p) => p.publishedAt).length,
      nota: `${corpus.amplificacion.length} en el corpus completo.`
    }),

    piezasRelacionadasEnCorpus: medida(corpus.amplificacion.length),

    fuentesDistintas: medida(fuentes.length),

    contenidosRelacionados: medida(contenidos.length, {
      nota: "Un contenido es el asunto que las piezas comparten, no un documento."
    }),

    noSeSuman:
      "Piezas, fuentes y contenidos son TRES magnitudes distintas y no se suman entre si. Diez cabeceras replicando una nota son diez piezas, diez fuentes y un contenido.",

    porRol: [...porRol.entries()]
      .map(([rol, total]) => ({ rol, piezas: total }))
      .sort((a, b) => b.piezas - a.piezas),

    rolPorDefecto: "COBERTURA_RELACIONADA",

    porQueRolPorDefecto:
      "Cuando dos piezas hablan del mismo asunto y no se puede demostrar derivacion, el rol es COBERTURA_RELACIONADA. Publicar despues no prueba haber copiado.",

    noAfirma: DIMENSIONES.AMPLIFICACION.noSignifica,

    fuentes: fuentes.sort()
  };
}


/*
===========================================================
FUENTES / EVIDENCIAS — de donde salio cada dato
===========================================================
*/
export function construirProcedencia({ corpus, evidencias = [] }) {
  const proveedores = new Map();

  corpus.snapshots.forEach((s) => {
    Object.values(s.metricas || {}).forEach((m) => {
      if (m?.provider) {
        proveedores.set(m.provider, (proveedores.get(m.provider) || 0) + 1);
      }
    });

    (s.cuota?.web?.proveedores || []).forEach((p) => {
      proveedores.set(p, proveedores.get(p) || 0);
    });
  });

  corpus.relaciones.forEach((r) => {
    const p = r.provenance?.proveedor;

    if (p) proveedores.set(p, (proveedores.get(p) || 0) + 1);
  });

  const consultasWeb = corpus.snapshots.reduce(
    (a, s) => a + (s.cuota?.web?.consultas || 0),
    0
  );

  return {
    evidenciasDistintas: medida(evidencias.length),

    proveedores: [...proveedores.entries()]
      .map(([proveedor, apariciones]) => ({ proveedor, apariciones }))
      .sort((a, b) => b.apariciones - a.apariciones),

    snapshots: medida(corpus.snapshots.length, {
      nota: "Cada snapshot es una observacion de metricas anexada, nunca una sobreescritura. T0 no se pierde."
    }),

    consumoAcumuladoDeclarado: {
      consultasWeb,

      nota: "Consumo que las observaciones ya guardadas declararon en su momento. Esta vista NO ejecuta proveedores y no consume cuota."
    },

    trazabilidad: corpus.piezas.map((p) => ({
      pieceId: p.pieceId,
      evidenceId: p.evidenceId,
      canonicalUrl: p.canonicalUrl,
      fuente: p.dominio,
      plataforma: p.plataforma,
      fechaPublicacion: p.publishedAt,
      fechaPublicacionBruta: p.publishedAtBruto,
      fechaPublicacionEstado: p.fechaPublicacionEstado,
      fechaPublicacionEstadoEtiqueta: etiquetaDeEstado(p.fechaPublicacionEstado),
      observadaEn: p.observedAt,
      procedenciaDelEmisor: p.emisor?.procedencia || null
    })),

    declaracion:
      "Toda cifra de esta vista procede de filas del Knowledge Lake escritas por la linea de Media, con su evidenceId y su URL canonica. Ninguna se calcula aqui a partir de una fuente externa."
  };
}


/*
===========================================================
HISTORIAS / TEMAS
===========================================================

Se reutiliza `pieceTopics`, que a su vez llama al Topic Engine 2
del modulo de conversacion. No hay motor de temas nuevo.
===========================================================
*/
export function construirHistorias(corpus) {
  const conTexto = [...corpus.piezas, ...corpus.amplificacion].filter(
    (p) => p.titulo
  );

  const sinTitular = corpus.amplificacion.filter((p) => !p.titulo).length;

  const paraMotor = conTexto.map((p) => ({
    title: p.titulo,
    snippet: null,
    publishedAt: p.publishedAt,
    canonicalUrl: p.canonicalUrl,
    evidenceId: p.evidenceId,
    publisher: p.dominio,
    platform: p.plataforma
  }));

  let salida = null;

  try {
    salida = temasDePieza({
      pieza: paraMotor[0] || null,
      piezasAmplificacion: paraMotor.slice(1)
    });
  } catch (error) {
    salida = {
      temas: [],
      entidades: [],
      limitaciones: [`El motor de temas fallo: ${error?.message || "error"}.`],
      metodo: "fallo_del_motor"
    };
  }

  const temas = salida?.temas || [];

  /*
    El hueco concreto, con su numero. «Cobertura insuficiente» a
    secas no dice que hacer; esto si: los titulares de la
    amplificacion no se persisten.
  */
  const motivo = temas.length
    ? null
    : `Solo ${conTexto.length} pieza(s) del corpus tienen titular persistido. ${sinTitular} pieza(s) de amplificacion no guardan el suyo, y el motor de temas agrupa por coocurrencia de terminos: sin titulares no hay coocurrencia que medir.`;

  /*
    Temas por fuente, para que el ranking pueda mostrar la
    columna sin recalcular nada.
  */
  const temasPorFuente = {};

  temas.forEach((t) => {
    (t.evidenceIds || []).forEach((id) => {
      const p = conTexto.find((x) => x.evidenceId === id);

      if (!p?.dominio) return;

      if (!temasPorFuente[p.dominio]) temasPorFuente[p.dominio] = [];

      if (!temasPorFuente[p.dominio].includes(t.topicId)) {
        temasPorFuente[p.dominio].push(t.topicId);
      }
    });
  });

  return {
    temas,

    /*
      Entidades nombradas: NO son temas. Se devuelven aparte
      porque con un corpus corto es lo unico que se puede
      afirmar, y confundirlas con temas seria el error que
      `pieceTopics` ya evita en el analisis de una pieza.
    */
    entidades: salida?.entidades || [],

    entidadesNoSonTemas:
      "Una entidad es un actor o un lugar nombrado. No dice DE QUE se habla, solo A QUIEN o DONDE se nombra.",

    piezasConTitular: conTexto.length,
    piezasDeAmplificacionSinTitular: sinTitular,

    estado: temas.length ? null : ESTADOS_DATO.COBERTURA_INSUFICIENTE,
    estadoEtiqueta: temas.length
      ? null
      : etiquetaDeEstado(ESTADOS_DATO.COBERTURA_INSUFICIENTE),
    motivo,

    metodo: salida?.metodo || null,
    limitaciones: salida?.limitaciones || [],

    temasPorFuente,

    prohibido: [
      "No usar «viral» sin metodologia.",
      "No usar «tendencia creciente» sin una ventana anterior comparable."
    ]
  };
}


export default {
  medida,
  homeDeProyecto,
  construirPresencia,
  construirCandidatosPorFuente,
  construirAmplificacion,
  construirProcedencia,
  construirHistorias
};
