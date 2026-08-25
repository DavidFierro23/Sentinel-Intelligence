// apps/backend/services/conversation/openTopicDiscovery.js

import { tokenizar, normalizarTexto } from "../textUtils.js";
import { construirStopConcepts, esResiduoPuro } from "./stopConcepts.js";
import { separarPorTipo } from "./contentTypeClassifier.js";
import { agruparCasiDuplicados } from "./nearDuplicate.js";
import { identificarFuente } from "./mediaRegistry.js";
import { extraerEntidades } from "./topicEngine2.js";

/*
===========================================================
OPEN TOPIC DISCOVERY
===========================================================

Descubre de que habla el corpus SIN partir de una lista de
temas.

POR QUE HACIA FALTA
-----------------------------------------------------------

El Topic Engine 2 organiza bien, pero solo encuentra lo que su
lexico previo contempla. Auditado sobre el catalogo actual de
12 categorias:

    "Lluvias e inundaciones anegan calles"   SIN CATEGORIA
    "Festival de artes escenicas"            SIN CATEGORIA
    "Sismo se sintio en la madrugada"        SIN CATEGORIA

Clima, desastres, cultura y deportes no existen en la
taxonomia. Un motor que solo mira por ahi responderia «en
Cuenca se habla de gestion publica y elecciones» el dia de una
inundacion.

Y el sesgo empieza antes: de las cuatro consultas por defecto
del planificador, DOS llevan vocabulario de gestion publica
—«municipio alcaldia», «concejo cantonal»—. El corpus llega ya
inclinado.

Este modulo no arregla el sesgo de recoleccion, que es un
pendiente declarado. Lo que hace es no anadirle un segundo
sesgo en la interpretacion.

DESCUBRIMIENTO NO ES CLASIFICACION
-----------------------------------------------------------

    Open Topic Discovery   ¿que parece estar apareciendo?
    Topic Engine 2         ¿como lo organizamos y explicamos?

El primero propone «Deportivo Cuenca · partido · estadio»
mirando el corpus. El segundo decide despues si eso cae en
alguna categoria declarada, y si no cae, lo dice.

QUE SENALES USA, Y POR QUE ESTAS
-----------------------------------------------------------

  entidades nombradas   lo mas discriminante en prensa
  bigramas              «casa de la cultura» dice mas que
                        «casa» y «cultura» por separado
  unigramas salientes   frecuentes en el corpus y raros en el
                        resto de documentos

Sin dependencias nuevas y sin servicio externo. Se evaluo si
convenia incorporar embeddings o un modelo de lenguaje y se
descarto por dos motivos concretos:

  1. Explicabilidad (IA1). Un cluster semantico responde «por
     que estan juntas» con una distancia coseno que nadie
     puede auditar. Aqui la respuesta es literal: comparten
     estas senales, que aparecen en estos documentos.

  2. Estabilidad. Replay Intelligence exige que el mismo lote
     produzca el mismo resultado dentro de un ano. Un modelo
     que se actualiza rompe esa garantia en silencio.

No es una limitacion asumida por comodidad: es el mismo
criterio que ya rige el resto del modulo.
===========================================================
*/


export const METODOS_DESCUBRIMIENTO = Object.freeze({
  ENTIDAD: "entidad_nombrada",
  BIGRAMA: "bigrama_frecuente",
  COOCURRENCIA: "coocurrencia_de_terminos"
});


export const UMBRALES_DESCUBRIMIENTO = Object.freeze({
  /* Documentos minimos para proponer un tema. */
  DOCUMENTOS: 2,

  /* Fuentes independientes minimas para no ser «una sola fuente». */
  FUENTES_INDEPENDIENTES: 2,

  /* Solapamiento de senales para unir dos documentos. */
  SIMILITUD_CLUSTER: 0.25,

  /* Un bigrama debe aparecer en al menos tantos documentos. */
  DOCUMENTOS_POR_BIGRAMA: 2,

  /* Un unigrama saliente, en al menos tantos. */
  DOCUMENTOS_POR_UNIGRAMA: 3
});


/*
-----------------------------------------------------------
TERMINOS POLISEMICOS DEL LEXICO

Defecto MEDIDO sobre el catalogo actual:

    «Deportivo Cuenca gano el PARTIDO en el estadio»
        -> clasificado como Proceso electoral
           (partido, en el sentido de partido politico)

    «CORTE de energia electrica afecta sectores»
        -> clasificado como Agua y saneamiento
           (corte, en el sentido de corte de agua)

Un partido de futbol etiquetado como politica electoral, en un
producto de inteligencia electoral, no es un matiz.

Estos terminos NO se eliminan del lexico: siguen siendo
legitimos en su categoria. Lo que se exige es que no la
sostengan SOLOS. Con un segundo termino de la misma categoria,
la asignacion vuelve a ser buena.
-----------------------------------------------------------
*/

export const TERMINOS_POLISEMICOS = Object.freeze({
  partido: ["electoral", "deportes"],
  corte: ["agua", "energia", "justicia"],
  campana: ["electoral", "salud", "publicidad"],
  planta: ["agua", "industria", "botanica"],
  red: ["agua", "telecomunicaciones", "social"],
  banda: ["seguridad", "musica"],
  operativo: ["seguridad", "administrativo"],
  golpe: ["seguridad", "deportes", "politica"],
  cancha: ["deportes", "obras"],
  hincha: ["deportes"],
  clave: ["generico"],
  frente: ["generico", "politica"]
});


export function esPolisemico(termino) {
  return Object.hasOwn(TERMINOS_POLISEMICOS, normalizarTexto(termino));
}


/*
===========================================================
SENALES DE UN DOCUMENTO
===========================================================
*/

function bigramas(tokens) {
  const out = [];

  for (let i = 0; i < tokens.length - 1; i += 1) {
    out.push(`${tokens[i]} ${tokens[i + 1]}`);
  }

  return out;
}


function senalesDe(evidencia, stop) {
  const titulo = evidencia?.titulo || "";

  const texto = [titulo, evidencia?.descripcion].filter(Boolean).join(" . ");

  const tokens = tokenizar(texto, 4).filter((t) => !stop.has(t));

  const entidades = extraerEntidades(titulo, stop).map((e) => normalizarTexto(e));

  return {
    entidades: new Set(entidades),
    bigramas: new Set(bigramas(tokens)),
    unigramas: new Set(tokens),
    tokens
  };
}


/*
===========================================================
DESCUBRIR
===========================================================
*/

export function descubrirTemas(evidencias = [], opciones = {}) {
  const inicio = Date.now();

  const lista = Array.isArray(evidencias) ? evidencias : [];

  const minDocs = Number.isFinite(opciones.documentosMinimos)
    ? opciones.documentosMinimos
    : UMBRALES_DESCUBRIMIENTO.DOCUMENTOS;

  /*
    ---------------------------------------------------------
    MISMOS FILTROS QUE EL GATE C

    El descubrimiento abierto NO puede resucitar la basura ya
    identificada. Si Wikipedia no forma temas en el Topic
    Engine 2, tampoco puede formarlos aqui por la puerta de
    atras.
    ---------------------------------------------------------
  */
  const tipos = separarPorTipo(lista);

  const dup = agruparCasiDuplicados(lista, opciones);

  const representantes = new Set(dup.representantes);

  const universo = tipos.indicesAgenda.filter((i) => representantes.has(i));

  const stop = construirStopConcepts({
    ambito: opciones.ambito || null,
    consultas: opciones.consultas || [],
    evidencias: lista,
    extra: opciones.terminosExcluidos || []
  });

  /*
    ---------------------------------------------------------
    SENALES POR DOCUMENTO
    ---------------------------------------------------------
  */
  const senales = new Map();

  universo.forEach((i) => senales.set(i, senalesDe(lista[i], stop)));

  /*
    ---------------------------------------------------------
    SENALES COMPARTIDAS

    Solo interesan las que aparecen en varios documentos: una
    senal que sale una vez no agrupa nada.
    ---------------------------------------------------------
  */
  const docsPorSenal = new Map();

  const registrar = (senal, indice, tipo) => {
    const k = `${tipo}:${senal}`;

    if (!docsPorSenal.has(k)) {
      docsPorSenal.set(k, { senal, tipo, docs: new Set() });
    }

    docsPorSenal.get(k).docs.add(indice);
  };

  universo.forEach((i) => {
    const s = senales.get(i);

    s.entidades.forEach((e) => registrar(e, i, METODOS_DESCUBRIMIENTO.ENTIDAD));

    s.bigramas.forEach((b) => registrar(b, i, METODOS_DESCUBRIMIENTO.BIGRAMA));

    s.unigramas.forEach((u) =>
      registrar(u, i, METODOS_DESCUBRIMIENTO.COOCURRENCIA)
    );
  });

  const compartidas = [...docsPorSenal.values()].filter((s) => {
    if (s.tipo === METODOS_DESCUBRIMIENTO.ENTIDAD) {
      return s.docs.size >= minDocs;
    }

    if (s.tipo === METODOS_DESCUBRIMIENTO.BIGRAMA) {
      return s.docs.size >= UMBRALES_DESCUBRIMIENTO.DOCUMENTOS_POR_BIGRAMA;
    }

    return s.docs.size >= UMBRALES_DESCUBRIMIENTO.DOCUMENTOS_POR_UNIGRAMA;
  });

  /*
    ---------------------------------------------------------
    CLUSTERING

    Aglomerativo voraz sobre solapamiento de senales. Se
    ordenan las senales por poder discriminante —entidad, luego
    bigrama, luego unigrama, y a igualdad por cobertura— y cada
    una siembra un cluster con los documentos que la comparten.

    Un documento puede caer en varios clusters: una nota sobre
    una inundacion que corta una via pertenece a los dos temas,
    y forzar uno perderia informacion. La consecuencia se
    declara.
    ---------------------------------------------------------
  */
  const peso = {
    [METODOS_DESCUBRIMIENTO.ENTIDAD]: 3,
    [METODOS_DESCUBRIMIENTO.BIGRAMA]: 2,
    [METODOS_DESCUBRIMIENTO.COOCURRENCIA]: 1
  };

  compartidas.sort(
    (a, b) => peso[b.tipo] - peso[a.tipo] || b.docs.size - a.docs.size
  );

  const clusters = [];

  const cubiertos = new Set();

  compartidas.forEach((semilla) => {
    const docs = [...semilla.docs];

    if (docs.length < minDocs) return;

    /*
      ABSORCION POR CONTENCION

      Si los documentos de esta senal ya estan CONTENIDOS en un
      cluster existente, no se crea otro: es el mismo tema visto
      por otra senal, y aparecerian duplicados con etiquetas
      distintas.

      Medido: «Deportivo Cuenca» generaba dos temas —uno
      sembrado por el termino «deportivo» con 3 documentos y
      otro por la entidad con 2— porque la comprobacion exigia
      solapamiento del 80 % en AMBOS sentidos y 2 de 3 se queda
      en 0,67.

      Lo correcto es mirar la contencion del PEQUENO en el
      GRANDE: si el subconjunto ya esta cubierto, su senal
      enriquece el cluster existente en lugar de fundar uno.
    */
    const yaRepresentado = clusters.find((c) => {
      const inter = docs.filter((d) => c.docs.has(d)).length;

      const menor = Math.min(docs.length, c.docs.size);

      return menor > 0 && inter / menor >= 0.8;
    });

    if (yaRepresentado) {
      yaRepresentado.senales.push(semilla);

      return;
    }

    clusters.push({
      docs: new Set(docs),
      senales: [semilla],
      metodoPrincipal: semilla.tipo
    });

    docs.forEach((d) => cubiertos.add(d));
  });

  /*
    ---------------------------------------------------------
    CONSTRUIR TEMAS DESCUBIERTOS
    ---------------------------------------------------------
  */
  const descartados = [];

  const temas = clusters
    .map((c) =>
      construirTemaDescubierto(c, lista, senales, stop, dup, opciones, descartados)
    )
    .filter(Boolean);

  temas.sort(
    (a, b) => b.evidencias - a.evidencias || b.fuentesIndependientes - a.fuentesIndependientes
  );

  const enAlgunTema = new Set(temas.flatMap((t) => t.indices));

  return {
    temasDescubiertos: temas,
    descartados,

    contenidoExcluido: {
      conteo: tipos.conteo,
      declaracion: tipos.declaracion,
      declaracionDuplicados: dup.declaracion
    },

    metricas: {
      evidencias: lista.length,
      universoAnalizado: universo.length,
      excluidasPorTipo: tipos.excluidas.length,
      repeticionesAgrupadas: dup.metricas.evidenciasRepetidas,
      senalesCompartidas: compartidas.length,
      clusters: clusters.length,
      temasPropuestos: temas.length,
      descartados: descartados.length,
      evidenciasEnAlgunTema: enAlgunTema.size,
      evidenciasSinTema: universo.length - enAlgunTema.size,
      tiempo: `${((Date.now() - inicio) / 1000).toFixed(3)}s`
    },

    metodo: {
      tipo: "determinista",
      abierto: true,
      senales: [
        "entidades nombradas",
        "bigramas frecuentes",
        "coocurrencia de terminos"
      ],
      sinTaxonomiaPrevia:
        "No se parte de ninguna lista de temas. Las categorias del Topic Engine 2 se aplican DESPUES, para organizar lo descubierto.",
      porQueNoEmbeddings:
        "Explicabilidad (IA1) y estabilidad para Replay. Un cluster semantico no puede explicar por que agrupo, y un modelo que se actualiza rompe la reproducibilidad en silencio.",
      filtrosHeredados: [
        "tipo de contenido",
        "casi-duplicados",
        "stop-concepts",
        "residuo puro"
      ],
      umbrales: UMBRALES_DESCUBRIMIENTO
    },

    loQueNoSabemos: [
      "El corpus llega con sesgo de consulta: 2 de las 4 consultas por defecto llevan vocabulario de gestion publica. Este modulo no lo corrige, solo evita anadir un segundo sesgo al interpretar.",

      "Volumen observado = documentos observados. NO son personas: 500 evidencias no son 500 personas hablando.",

      "Un tema descubierto es una PROPUESTA sostenida por evidencia, no un hecho establecido.",

      universo.length - enAlgunTema.size > 0
        ? `${universo.length - enAlgunTema.size} evidencia(s) no comparten senal con ninguna otra: no forman tema y no por eso son irrelevantes.`
        : null,

      "Un documento puede pertenecer a varios temas descubiertos, asi que la suma por tema puede superar el total.",

      tipos.excluidas.length ? tipos.declaracion : null,

      dup.metricas.evidenciasRepetidas ? dup.declaracion : null
    ].filter(Boolean)
  };
}


/*
===========================================================
CONSTRUIR UN TEMA DESCUBIERTO
===========================================================
*/

function construirTemaDescubierto(
  cluster,
  lista,
  senales,
  stop,
  dup,
  opciones,
  descartados
) {
  const indices = [...cluster.docs].sort((a, b) => a - b);

  /* --- fuentes independientes --- */
  const porFuente = new Map();

  indices.forEach((i) => {
    const f = identificarFuente(lista[i]);

    const clave = f.dominio || f.nombre || "desconocido";

    if (!porFuente.has(clave)) {
      porFuente.set(clave, {
        nombre: f.nombre || clave,
        dominio: f.dominio || null,
        tipo: f.tipo,
        evidencias: 0
      });
    }

    porFuente.get(clave).evidencias += 1;
  });

  const fuentes = [...porFuente.values()].sort(
    (a, b) => b.evidencias - a.evidencias
  );

  /* --- senales ordenadas --- */
  const porTipo = {
    entidad: cluster.senales.filter(
      (s) => s.tipo === METODOS_DESCUBRIMIENTO.ENTIDAD
    ),
    bigrama: cluster.senales.filter(
      (s) => s.tipo === METODOS_DESCUBRIMIENTO.BIGRAMA
    ),
    unigrama: cluster.senales.filter(
      (s) => s.tipo === METODOS_DESCUBRIMIENTO.COOCURRENCIA
    )
  };

  /* --- entidades del cluster (forma original, no normalizada) --- */
  const entidadesOriginales = new Map();

  indices.forEach((i) => {
    extraerEntidades(lista[i]?.titulo, stop).forEach((e) => {
      const k = normalizarTexto(e);

      if (!entidadesOriginales.has(k)) {
        entidadesOriginales.set(k, { nombre: e, documentos: 0 });
      }

      entidadesOriginales.get(k).documentos += 1;
    });
  });

  const entidades = [...entidadesOriginales.values()]
    .filter((e) => e.documentos >= 2)
    .sort((a, b) => b.documentos - a.documentos);

  /* --- etiqueta --- */
  const terminos = [
    ...porTipo.entidad.map((s) => s.senal),
    ...porTipo.bigrama.map((s) => s.senal),
    ...porTipo.unigrama.map((s) => s.senal)
  ].slice(0, 6);

  if (esResiduoPuro(terminos, stop)) {
    descartados.push({
      etiqueta: terminos.join(" · "),
      documentos: indices.length,
      motivo:
        "Residuo: todas sus senales son territorio, fecha, medio o terminos de la consulta."
    });

    return null;
  }

  const etiqueta =
    entidades.length > 0
      ? entidades[0].nombre
      : porTipo.bigrama.length > 0
        ? porTipo.bigrama[0].senal
        : porTipo.unigrama.slice(0, 3).map((s) => s.senal).join(" · ");

  const sinEtiqueta = !etiqueta || etiqueta.trim().length === 0;

  /* --- territorios --- */
  const territorios = [];

  const ubic = opciones.ubicaciones || null;

  if (ubic) {
    const mapa = new Map();

    indices.forEach((i) => {
      const u = ubic[i];

      if (!u?.unidadId) return;

      if (!mapa.has(u.unidadId)) {
        mapa.set(u.unidadId, {
          unidadId: u.unidadId,
          nombre: u.unidad || u.nombre || u.unidadId,
          nivel: u.nivel || u.resolucion || null,
          evidencias: 0
        });
      }

      mapa.get(u.unidadId).evidencias += 1;
    });

    territorios.push(...[...mapa.values()].sort((a, b) => b.evidencias - a.evidencias));
  }

  /* --- fechas --- */
  const fechas = indices
    .map((i) => lista[i]?.fecha)
    .filter(Boolean)
    .map((f) => new Date(f))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a - b);

  /* --- confianza --- */
  const nFuentes = fuentes.length;

  const confianza = Math.min(
    85,
    Math.round(
      15 +
        Math.min(indices.length, 10) * 4 +
        Math.min(nFuentes, 5) * 6 +
        (porTipo.entidad.length > 0 ? 10 : 0)
    )
  );

  const limitaciones = [];

  if (nFuentes < UMBRALES_DESCUBRIMIENTO.FUENTES_INDEPENDIENTES) {
    limitaciones.push(
      `Las ${indices.length} evidencias provienen de ${nFuentes} fuente(s). Sin diversidad de fuentes no se puede distinguir un hecho cubierto de un medio insistiendo.`
    );
  }

  if (indices.length < 3) {
    limitaciones.push(
      `Solo ${indices.length} documentos sostienen este tema: es una propuesta debil.`
    );
  }

  if (fechas.length === 0) {
    limitaciones.push("Ninguna evidencia trae fecha: no hay ventana observable.");
  }

  if (territorios.length === 0) {
    limitaciones.push(
      "Ninguna evidencia del tema se pudo geolocalizar: no se puede asociar a un territorio."
    );
  }

  if (sinEtiqueta) {
    limitaciones.push("No se pudo derivar una etiqueta defendible.");
  }

  const repeticiones = indices.filter((i) => {
    const g = dup.grupoDe.get(i);

    return g !== undefined && dup.grupos[g].miembros.length > 1;
  }).length;

  return {
    id: `desc-${normalizarTexto(etiqueta || "sin-etiqueta").replace(/[^a-z0-9]+/g, "-").slice(0, 48)}`,

    etiquetaPropuesta: sinEtiqueta ? "Tema descubierto sin etiquetar" : etiqueta,
    sinEtiqueta,

    evidencias: indices.length,
    indices,

    documentosObservados: indices.length,
    unidadDeMedida: "documentos observados, NO personas",

    repeticionesIncluidas: repeticiones,

    fuentes,
    fuentesIndependientes: nFuentes,

    primeraObservacion: fechas.length ? fechas[0].toISOString() : null,
    ultimaObservacion: fechas.length
      ? fechas[fechas.length - 1].toISOString()
      : null,

    entidades,

    terminos,

    senales: cluster.senales.map((s) => ({
      senal: s.senal,
      tipo: s.tipo,
      documentos: s.docs.size
    })),

    territoriosMencionados: territorios,

    metodoDescubrimiento: cluster.metodoPrincipal,

    explicacion: `Sentinel propone este tema porque ${
      indices.length
    } evidencias comparten ${cluster.senales.length} senal(es): ${cluster.senales
      .slice(0, 4)
      .map((s) => `«${s.senal}» (${s.tipo}, ${s.docs.size} docs)`)
      .join(", ")}.`,

    confianza,
    limitaciones,

    titulares: indices
      .slice(0, 5)
      .map((i) => lista[i]?.titulo)
      .filter(Boolean)
  };
}


export default {
  descubrirTemas,
  METODOS_DESCUBRIMIENTO,
  UMBRALES_DESCUBRIMIENTO,
  TERMINOS_POLISEMICOS,
  esPolisemico
};
