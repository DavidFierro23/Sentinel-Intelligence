// apps/backend/services/conversation/topicEngine2.js

import { tokenizar, normalizarTexto } from "../textUtils.js";
import { LEXICO_DOMINIO } from "./topicExtractor.js";
import { construirStopConcepts, esResiduoPuro } from "./stopConcepts.js";
import { separarPorTipo } from "./contentTypeClassifier.js";
import { agruparCasiDuplicados } from "./nearDuplicate.js";
import { clasificarEncuadre } from "./framingClassifier.js";
import { identificarFuente } from "./mediaRegistry.js";
import { UMBRALES } from "./conversationContracts.js";
import { esPolisemico } from "./openTopicDiscovery.js";

/*
===========================================================
TOPIC ENGINE 2 — categoria, tema y subtema
===========================================================

QUE CAMBIA RESPECTO DEL ANTERIOR
-----------------------------------------------------------

El extractor original devolvia UNA etiqueta: «Movilidad y
transporte». Es una categoria, no un tema. No responde de que
se esta hablando, solo en que cajon cae.

Ahora hay tres niveles:

    CATEGORIA   Movilidad y transporte      (lexico declarado)
    TEMA        congestion vehicular        (lo discriminante)
    SUBTEMA     Avenida de las Americas     (entidad nombrada)

Y cuatro filtros nuevos, cada uno contra un defecto MEDIDO en
datos reales de Cuenca:

  1. tipo de contenido    quita Wikipedia, turismo, boletines
                          automaticos -> mata «azuay · capital ·
                          provincia · ciudad»
  2. casi-duplicados      tres boletines del clima cuentan como
                          uno para formar tema
  3. stop-concepts        territorio, ancestros, meses, medio,
                          terminos de la query
  4. residuo puro         una etiqueta hecha solo de
                          stop-concepts no es un tema

POR QUE SIGUE SIENDO DETERMINISTA
-----------------------------------------------------------

El mismo lote produce el mismo resultado hoy y dentro de un
mes. Sin esa estabilidad, Replay Intelligence reconstruiria un
pasado distinto del que ocurrio. Ese requisito no se negocia
por mejores etiquetas.

LO QUE ESTE MOTOR NO AFIRMA
-----------------------------------------------------------

Volumen no es opinion ciudadana. Publicaciones no son personas.
Crecimiento no es apoyo politico. Las tres frases viajan en la
respuesta, no en la documentacion.
===========================================================
*/


export const ESTADOS_TEMA = Object.freeze({
  CONSOLIDADO: "consolidado",
  EMERGENTE: "emergente",
  EVIDENCIA_INSUFICIENTE: "evidencia_insuficiente"
});


/*
-----------------------------------------------------------
UMBRALES

`CONSOLIDADO` exige ademas DIVERSIDAD DE FUENTES. Un tema
sostenido por un solo medio que repite no es un tema
consolidado: es un medio insistiendo, y son cosas distintas.
-----------------------------------------------------------
*/

export const UMBRALES_TEMA = Object.freeze({
  EVIDENCIAS_CONSOLIDADO: 5,
  FUENTES_CONSOLIDADO: 2,
  EVIDENCIAS_EMERGENTE: 3,
  FUENTES_EMERGENTE: 2,
  EVIDENCIAS_MINIMAS: 2
});


/*
===========================================================
SUBTEMA — entidades nombradas
===========================================================

Se extraen del titulo ORIGINAL, sin bajar a minusculas: en
espanol la mayuscula inicial de una secuencia de dos o mas
palabras es la senal mas fiable de entidad nombrada sin
recurrir a un modelo.

    «Congestion en la Avenida de las Americas»
     -> Avenida de las Americas

Se filtran contra stop-concepts para que «Cuenca» o «Azuay» no
acaben de subtema, y contra el inicio de frase, donde la
mayuscula es ortografica y no significa nada.
===========================================================
*/

const CONECTORES = new Set([
  "de",
  "del",
  "la",
  "las",
  "el",
  "los",
  "y",
  "e",
  "en",
  "a",
  "al",
  "por",
  "para",
  "con"
]);


export function extraerEntidades(titulo, stop) {
  const texto = String(titulo || "").trim();

  if (!texto) return [];

  /* Se descarta la primera palabra: su mayuscula es ortografica. */
  const palabras = texto.split(/\s+/);

  const entidades = [];

  let actual = [];

  const cerrar = () => {
    /* Se recortan conectores colgando en los extremos. */
    while (actual.length && CONECTORES.has(normalizarTexto(actual[0]))) {
      actual.shift();
    }

    while (
      actual.length &&
      CONECTORES.has(normalizarTexto(actual[actual.length - 1]))
    ) {
      actual.pop();
    }

    if (actual.length >= 2) {
      const nombre = actual.join(" ").replace(/[.,;:!?"»«]+$/g, "");

      const tokens = tokenizar(nombre, 3);

      /*
        Se descarta si TODOS sus tokens son stop-concepts:
        «La Ciudad De Cuenca» no es una entidad util.
      */
      const util = tokens.length > 0 && !tokens.every((t) => stop.has(t));

      if (util) entidades.push(nombre);
    }

    actual = [];
  };

  const esMay = (w) =>
    /^[A-ZÁÉÍÓÚÑÜ]/.test(String(w || "").replace(/[.,;:!?"»«()]+$/g, ""));

  palabras.forEach((p, i) => {
    const limpio = p.replace(/[.,;:!?"»«()]+$/g, "");

    const esMayuscula = /^[A-ZÁÉÍÓÚÑÜ]/.test(limpio);

    const esConector = CONECTORES.has(normalizarTexto(limpio));

    if (i === 0) {
      /*
        La mayuscula de la primera palabra es ortografica, asi
        que por si sola no significa nada. Pero descartarla
        siempre perdia las entidades que ABREN el titular, que
        en prensa son muchas.

        Medido: «Deportivo Cuenca gano el partido» no producia
        ninguna entidad, y el tema descubierto acababa
        etiquetado con el nombre del estadio en vez de con el
        del equipo.

        Regla: la primera palabra inicia entidad solo si la
        SEGUNDA tambien va en mayuscula. «Deportivo Cuenca» si;
        «Congestion vehicular» no.
      */
      if (esMayuscula && esMay(palabras[1])) actual.push(limpio);

      return;
    }

    if (esMayuscula || (esConector && actual.length > 0)) {
      actual.push(limpio);
      return;
    }

    cerrar();
  });

  cerrar();

  return [...new Set(entidades)];
}


/*
===========================================================
TEMA DENTRO DE UNA CATEGORIA
===========================================================

La categoria la da el lexico. El TEMA sale de los terminos que
comparten las evidencias de esa categoria y que NO son del
propio lexico: son los que discriminan un tema de otro dentro
del mismo cajon.

    Movilidad + {congestion, trafico}  -> «congestion vehicular»
    Movilidad + {tranvia, ruta}        -> «tranvia»

Si no hay ningun termino discriminante compartido, el tema es
la categoria a secas, y se dice.
===========================================================
*/

function terminosDiscriminantes(
  indices,
  tokensPorIndice,
  tokensDelNombreDeCategoria,
  stop,
  tokensDeEntidades = new Set()
) {
  const frecuencia = new Map();

  indices.forEach((i) => {
    [...new Set(tokensPorIndice.get(i) || [])].forEach((t) => {
      if (stop.has(t)) return;

      /*
        Se excluyen los tokens del NOMBRE de la categoria, no
        todo su lexico.

        La primera version excluia el lexico entero, y era un
        error: «congestion» y «trafico» pertenecen al lexico de
        Movilidad y son precisamente lo que distingue este tema
        de «tranvia». Al excluirlos, el tema se quedaba sin
        discriminante y su nombre colapsaba en la categoria.

        Lo unico que hay que evitar es «Movilidad y transporte:
        movilidad y transporte».
      */
      if (tokensDelNombreDeCategoria.has(t)) return;

      /*
        Los tokens que ya forman una ENTIDAD nombrada no sirven
        de discriminante: la entidad se muestra entera como
        subtema.

        Sin esto, «Congestion en la Avenida de las Americas»
        producia el tema «Movilidad y transporte: avenida y
        americas» —dos fragmentos de un nombre propio— en lugar
        de «congestion y trafico», que es de lo que trata.
      */
      if (tokensDeEntidades.has(t)) return;

      frecuencia.set(t, (frecuencia.get(t) || 0) + 1);
    });
  });

  const minimo = Math.max(2, Math.ceil(indices.length * 0.35));

  return [...frecuencia.entries()]
    .filter(([, n]) => n >= minimo)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([t]) => t);
}


/*
===========================================================
EXTRAER
===========================================================
*/

export function extraerTemas2(evidencias = [], opciones = {}) {
  const lista = Array.isArray(evidencias) ? evidencias : [];

  const inicio = Date.now();

  /*
    ---------------------------------------------------------
    FILTRO 1 — tipo de contenido
    ---------------------------------------------------------
  */
  const tipos = separarPorTipo(lista);

  /*
    ---------------------------------------------------------
    FILTRO 2 — casi-duplicados
    ---------------------------------------------------------
  */
  const dup = agruparCasiDuplicados(lista, opciones);

  const representantes = new Set(dup.representantes);

  /*
    Universo para FORMAR temas: agenda publica, una por grupo de
    casi-duplicados. El resto sigue existiendo como evidencia.
  */
  const universo = tipos.indicesAgenda.filter((i) => representantes.has(i));

  /*
    ---------------------------------------------------------
    FILTRO 3 — stop-concepts
    ---------------------------------------------------------
  */
  const stop = construirStopConcepts({
    ambito: opciones.ambito || null,
    consultas: opciones.consultas || [],
    evidencias: lista,
    extra: opciones.terminosExcluidos || []
  });

  const tokensPorIndice = new Map();

  universo.forEach((i) => {
    const e = lista[i];

    const texto = [e?.titulo, e?.descripcion].filter(Boolean).join(" ");

    tokensPorIndice.set(
      i,
      tokenizar(texto, 4).filter((t) => !stop.has(t))
    );
  });

  /*
    ---------------------------------------------------------
    CATEGORIAS del lexico declarado
    ---------------------------------------------------------
  */
  const porCategoria = new Map();

  const descartesPolisemia = [];

  universo.forEach((i) => {
    const tokens = tokensPorIndice.get(i) || [];

    Object.entries(LEXICO_DOMINIO).forEach(([catId, cat]) => {
      const golpes = tokens.filter((t) => cat.terminos.includes(t));

      if (golpes.length === 0) return;

      /*
        -------------------------------------------------------
        GUARDA DE POLISEMIA — defecto MEDIDO
        -------------------------------------------------------

        Auditado sobre el catalogo actual:

          «Deportivo Cuenca gano el PARTIDO en el estadio»
              -> Proceso electoral      (partido politico)

          «CORTE de energia electrica afecta sectores»
              -> Agua y saneamiento     (corte de agua)

        Un partido de futbol etiquetado como politica electoral,
        en un producto de inteligencia electoral, no es un
        matiz: es una cifra falsa en el panel.

        El termino NO se elimina del lexico —«partido» es
        legitimo en lo electoral y «corte» en lo hidrico—. Lo
        que se exige es que no sostenga la categoria EL SOLO.
        Con un segundo termino de la misma categoria, la
        asignacion vuelve a ser buena.
      */
      const soloPolisemicos = golpes.every((g) => esPolisemico(g));

      if (soloPolisemicos && golpes.length < 2) {
        descartesPolisemia.push({
          indice: i,
          categoria: cat.nombre,
          termino: golpes[0],
          titulo: lista[i]?.titulo || null,
          motivo: `El unico termino que sostenia "${cat.nombre}" era «${golpes[0]}», que es polisemico. Sin un segundo termino de la categoria, la asignacion no se hace.`
        });

        return;
      }

      if (!porCategoria.has(catId)) {
        porCategoria.set(catId, { catId, nombre: cat.nombre, indices: [], golpes: new Set() });
      }

      const acc = porCategoria.get(catId);

      acc.indices.push(i);

      golpes.forEach((g) => acc.golpes.add(g));
    });
  });

  /*
    ---------------------------------------------------------
    CONSTRUIR TEMAS
    ---------------------------------------------------------
  */
  const temas = [];

  const descartados = [];

  porCategoria.forEach((cat) => {
    /*
      Las entidades se calculan ANTES que los discriminantes,
      para poder excluir sus tokens. El orden importa: al reves,
      el nombre del tema acaba siendo trozos de un nombre propio.
    */
    const entidadesCat = new Map();

    const tokensEntidad = new Set();

    cat.indices.forEach((i) => {
      extraerEntidades(lista[i]?.titulo, stop).forEach((ent) => {
        const k = normalizarTexto(ent);

        entidadesCat.set(k, (entidadesCat.get(k) || 0) + 1);

        tokenizar(ent, 3).forEach((tk) => tokensEntidad.add(tk));
      });
    });

    const disc = terminosDiscriminantes(
      cat.indices,
      tokensPorIndice,
      new Set(tokenizar(cat.nombre, 3)),
      stop,
      tokensEntidad
    );

    /*
      El nombre del tema prefiere los DISCRIMINANTES —de que se
      habla— sobre la entidad —donde o quien—, porque la entidad
      ya se muestra aparte como subtema.
    */
    const nombreTema = disc.length
      ? `${cat.nombre}: ${disc.slice(0, 2).join(" y ")}`
      : cat.nombre;

    const tema = construirTema({
      id: `cat-${cat.catId}`,
      nombre: nombreTema,
      categoria: cat.nombre,
      categoriaId: cat.catId,
      indices: cat.indices,
      terminos: [...cat.golpes].slice(0, 6),
      discriminantes: disc,
      metodo: "lexico_dominio",
      lista,
      stop,
      dup,
      opciones
    });

    if (tema.evidencias < UMBRALES_TEMA.EVIDENCIAS_MINIMAS) {
      descartados.push({
        nombre: tema.nombre,
        evidencias: tema.evidencias,
        motivo: `Por debajo de ${UMBRALES_TEMA.EVIDENCIAS_MINIMAS} evidencias. Un tema con menos no es un tema, es una nota.`
      });

      return;
    }

    temas.push(tema);
  });

  /*
    ---------------------------------------------------------
    EMERGENTES — lo que el lexico no cubre
    ---------------------------------------------------------
  */
  const cubiertos = new Set(temas.flatMap((t) => t.indices));

  const sinCategoria = universo.filter((i) => !cubiertos.has(i));

  const frecuencia = new Map();

  sinCategoria.forEach((i) => {
    [...new Set(tokensPorIndice.get(i) || [])].forEach((t) => {
      frecuencia.set(t, (frecuencia.get(t) || 0) + 1);
    });
  });

  const semillas = [...frecuencia.entries()]
    .filter(([, n]) => n >= UMBRALES.FRECUENCIA_TERMINO)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);

  const asignadas = new Set();

  semillas.forEach((semilla) => {
    const miembros = sinCategoria.filter(
      (i) => !asignadas.has(i) && (tokensPorIndice.get(i) || []).includes(semilla)
    );

    if (miembros.length < UMBRALES_TEMA.EVIDENCIAS_EMERGENTE) return;

    const acompanan = new Map();

    miembros.forEach((i) => {
      [...new Set(tokensPorIndice.get(i) || [])]
        .filter((t) => t !== semilla)
        .forEach((t) => acompanan.set(t, (acompanan.get(t) || 0) + 1));
    });

    const contexto = [...acompanan.entries()]
      .filter(([, n]) => n >= Math.max(2, Math.ceil(miembros.length * 0.4)))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t]) => t);

    const terminos = [semilla, ...contexto];

    /*
      FILTRO 4 — residuo puro. Una etiqueta hecha solo de
      stop-concepts no es un tema.
    */
    if (esResiduoPuro(terminos, stop)) {
      descartados.push({
        nombre: terminos.join(" · "),
        evidencias: miembros.length,
        motivo:
          "Residuo: todos sus terminos son territorio, fecha, medio o terminos de la consulta. No es un tema."
      });

      miembros.forEach((i) => asignadas.add(i));

      return;
    }

    miembros.forEach((i) => asignadas.add(i));

    temas.push(
      construirTema({
        id: `emergente-${semilla}`,
        nombre: null,
        categoria: null,
        categoriaId: null,
        indices: miembros,
        terminos,
        discriminantes: terminos,
        metodo: "coocurrencia",
        lista,
        stop,
        dup,
        opciones
      })
    );
  });

  temas.sort((a, b) => b.evidencias - a.evidencias);

  const enAlgunTema = new Set(temas.flatMap((t) => t.indices));

  return {
    temas,
    descartados,

    contenidoExcluido: {
      porTipo: tipos.excluidas,

      /*
        Asignaciones de categoria que NO se hicieron porque el
        unico termino que las sostenia era polisemico. Se
        declaran: un descarte silencioso es indistinguible de
        no haber mirado.
      */
      polisemia: descartesPolisemia,
      conteo: tipos.conteo,
      declaracion: tipos.declaracion,
      casiDuplicados: dup.detalle,
      declaracionDuplicados: dup.declaracion
    },

    metricas: {
      evidencias: lista.length,
      universoParaTemas: universo.length,
      excluidasPorTipo: tipos.excluidas.length,
      repeticionesAgrupadas: dup.metricas.evidenciasRepetidas,
      temas: temas.length,
      consolidados: temas.filter((t) => t.estado === ESTADOS_TEMA.CONSOLIDADO).length,
      emergentes: temas.filter((t) => t.estado === ESTADOS_TEMA.EMERGENTE).length,
      insuficientes: temas.filter(
        (t) => t.estado === ESTADOS_TEMA.EVIDENCIA_INSUFICIENTE
      ).length,
      evidenciasEnAlgunTema: enAlgunTema.size,
      evidenciasSinTema: universo.length - enAlgunTema.size,
      tiempo: `${((Date.now() - inicio) / 1000).toFixed(3)}s`
    },

    metodo: {
      tipo: "determinista",
      niveles: ["categoria", "tema", "subtema"],
      filtros: [
        "tipo de contenido: solo agenda publica forma temas",
        "casi-duplicados: una evidencia por grupo",
        "stop-concepts: territorio, ancestros, fechas, medio, terminos de la consulta",
        "residuo puro: etiqueta hecha solo de stop-concepts"
      ],
      porQue:
        "El mismo lote produce el mismo resultado hoy y dentro de un mes. Sin esa estabilidad, Replay Intelligence reconstruiria un pasado distinto del que ocurrio.",
      stopConceptsAplicados: [...stop].slice(0, 40),
      totalStopConcepts: stop.size
    },

    loQueNoSabemos: [
      "El volumen mide PUBLICACION, no opinion ciudadana.",
      "Las publicaciones no son personas: una evidencia es un texto publicado, no un ciudadano.",
      "Un tema que crece no indica apoyo politico: indica que se publico mas sobre el.",

      tipos.excluidas.length
        ? tipos.declaracion
        : null,

      dup.metricas.evidenciasRepetidas
        ? dup.declaracion
        : null,

      universo.length - enAlgunTema.size > 0
        ? `${universo.length - enAlgunTema.size} evidencia(s) de agenda no encajan en ningun tema con la muestra actual.`
        : null,

      descartados.length
        ? `${descartados.length} agrupacion(es) descartadas: ${descartados
            .slice(0, 3)
            .map((d) => d.nombre)
            .join(" · ")}`
        : null,

      "Una evidencia puede pertenecer a varios temas, asi que la suma por tema puede superar el total."
    ].filter(Boolean)
  };
}


/*
===========================================================
CONSTRUIR UN TEMA CON TODO SU EXPEDIENTE
===========================================================
*/

function construirTema({
  id,
  nombre,
  categoria,
  categoriaId,
  indices,
  terminos,
  discriminantes,
  metodo,
  lista,
  stop,
  dup,
  opciones
}) {
  const miembros = indices.map((i) => lista[i]).filter(Boolean);

  /* --- fuentes --- */
  const porFuente = new Map();

  indices.forEach((i) => {
    const f = identificarFuente(lista[i]);

    /*
      Clave por DOMINIO cuando existe. Con el nombre como clave,
      la agenda fusionaba mal: el descubrimiento indexa por
      dominio y este motor por nombre, asi que el mismo medio
      entraba dos veces y un tema de 3 evidencias declaraba 6
      fuentes independientes. Imposible, y visible.
    */
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

  /* --- territorios --- */
  const porTerritorio = new Map();

  const ubic = opciones.ubicaciones || null;

  if (ubic) {
    indices.forEach((i) => {
      const u = ubic[i];

      if (!u?.unidadId) return;

      if (!porTerritorio.has(u.unidadId)) {
        porTerritorio.set(u.unidadId, {
          unidadId: u.unidadId,
          nombre: u.unidad || u.nombre || u.unidadId,
          nivel: u.nivel || null,
          evidencias: 0
        });
      }

      porTerritorio.get(u.unidadId).evidencias += 1;
    });
  }

  /* --- encuadre --- */
  const encuadre = { critico: 0, favorable: 0, neutro: 0, no_determinable: 0 };

  indices.forEach((i) => {
    const c = clasificarEncuadre(lista[i]);

    if (encuadre[c.encuadre] !== undefined) encuadre[c.encuadre] += 1;
  });

  const determinadas =
    encuadre.critico + encuadre.favorable + encuadre.neutro;

  /* --- fechas y serie --- */
  const fechas = miembros
    .map((m) => m?.fecha)
    .filter(Boolean)
    .map((f) => new Date(f))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a - b);

  const porDia = new Map();

  fechas.forEach((d) => {
    const k = d.toISOString().slice(0, 10);

    porDia.set(k, (porDia.get(k) || 0) + 1);
  });

  const serie = porDia.size >= 2
    ? [...porDia.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([periodo, valor]) => ({ periodo, valor }))
    : null;

  /* --- subtemas --- */
  const conteoEntidades = new Map();

  indices.forEach((i) => {
    extraerEntidades(lista[i]?.titulo, stop).forEach((ent) => {
      const k = normalizarTexto(ent);

      if (!conteoEntidades.has(k)) {
        conteoEntidades.set(k, { nombre: ent, evidencias: 0 });
      }

      conteoEntidades.get(k).evidencias += 1;
    });
  });

  const subtemas = [...conteoEntidades.values()]
    .filter((s) => s.evidencias >= 2)
    .sort((a, b) => b.evidencias - a.evidencias)
    .slice(0, 5);

  /* --- estado --- */
  const nFuentes = fuentes.length;

  let estado;

  if (
    indices.length >= UMBRALES_TEMA.EVIDENCIAS_CONSOLIDADO &&
    nFuentes >= UMBRALES_TEMA.FUENTES_CONSOLIDADO
  ) {
    estado = ESTADOS_TEMA.CONSOLIDADO;
  } else if (
    indices.length >= UMBRALES_TEMA.EVIDENCIAS_EMERGENTE &&
    nFuentes >= UMBRALES_TEMA.FUENTES_EMERGENTE
  ) {
    estado = ESTADOS_TEMA.EMERGENTE;
  } else {
    estado = ESTADOS_TEMA.EVIDENCIA_INSUFICIENTE;
  }

  /* --- nombre --- */
  const nombreFinal =
    nombre ||
    (subtemas.length
      ? subtemas[0].nombre
      : discriminantes.length
        ? discriminantes.slice(0, 3).join(" · ")
        : null);

  const sinEtiqueta = !nombreFinal;

  /* --- confianza --- */
  const confianza = Math.min(
    90,
    Math.round(
      25 +
        Math.min(indices.length, 12) * 3 +
        Math.min(nFuentes, 5) * 5 +
        (metodo === "lexico_dominio" ? 10 : 0)
    )
  );

  const limitaciones = [];

  if (nFuentes === 1) {
    limitaciones.push(
      `Las ${indices.length} evidencias provienen de UNA sola fuente. Es repeticion de un medio, no cobertura amplia.`
    );
  }

  if (!serie) {
    limitaciones.push(
      "Sin serie temporal: menos de dos periodos con fecha utilizable."
    );
  }

  if (determinadas === 0) {
    limitaciones.push(
      "Ninguna evidencia tiene encuadre determinable: no se puede decir como se presenta."
    );
  }

  if (estado === ESTADOS_TEMA.EVIDENCIA_INSUFICIENTE) {
    limitaciones.push(
      `Evidencia insuficiente: ${indices.length} evidencia(s) de ${nFuentes} fuente(s). No se lee como tema establecido.`
    );
  }

  if (sinEtiqueta) {
    limitaciones.push(
      "No se pudo derivar una etiqueta defendible de las evidencias."
    );
  }

  return {
    id,

    nombre: nombreFinal || "Tema emergente sin etiquetar",
    sinEtiqueta,

    categoria: categoria || "Sin categoria declarada",
    categoriaId,

    subtemas,

    estado,

    evidencias: indices.length,
    volumenObservado: indices.length,
    indices,

    /*
      Cuantas evidencias del tema son repeticion de otra. El
      volumen sin este numero al lado exagera.
    */
    repeticionesIncluidas: indices.filter((i) => {
      const g = dup.grupoDe.get(i);

      return g !== undefined && dup.grupos[g].miembros.length > 1;
    }).length,

    primeraObservacion: fechas.length ? fechas[0].toISOString() : null,
    ultimaObservacion: fechas.length
      ? fechas[fechas.length - 1].toISOString()
      : null,
    sinFecha: indices.length - fechas.length,

    serie,

    fuentes,
    fuentesDistintas: nFuentes,

    territorios: [...porTerritorio.values()].sort(
      (a, b) => b.evidencias - a.evidencias
    ),

    encuadre: determinadas
      ? {
          ...encuadre,
          determinadas,
          base: "sobre las evidencias del tema con encuadre determinado",
          metodo: "lexico"
        }
      : {
          ...encuadre,
          determinadas: 0,
          motivo: "Ninguna evidencia del tema tiene encuadre determinable."
        },

    terminos,

    metodoClasificacion: metodo,

    explicacion:
      metodo === "lexico_dominio"
        ? `Agrupadas porque contienen terminos del lexico declarado de "${categoria}": ${terminos
            .slice(0, 5)
            .join(", ")}.${
            discriminantes.length
              ? ` El tema se acota por los terminos discriminantes: ${discriminantes.join(", ")}.`
              : " No hay terminos discriminantes compartidos: el tema es la categoria completa."
          }`
        : `Agrupadas por coocurrencia de terminos frecuentes: ${terminos.join(
            ", "
          )}. No corresponde a ninguna categoria declarada.`,

    confianza,
    limitaciones,

    titulares: miembros
      .slice(0, 5)
      .map((m) => m?.titulo)
      .filter(Boolean),

    /*
      -------------------------------------------------------
      ALIAS DE COMPATIBILIDAD

      `TopicsPanel.jsx` lee `origen`, `primeraFecha`,
      `ultimaFecha` y `evidenciasSinFecha`, que son los nombres
      del extractor v1.

      El Gate D reorganizara esa interfaz, pero hasta entonces
      no puede quedar rota: sin estos alias, el panel mostraria
      la insignia de origen vacia y las fechas en blanco.

      Romper lo que funciona mientras se construye lo siguiente
      no es aceptable, y anadir cuatro campos es mas barato que
      adelantar el Gate D.
      -------------------------------------------------------
    */
    origen: metodo === "lexico_dominio" ? "lexico" : "emergente",
    primeraFecha: fechas.length ? fechas[0].toISOString() : null,
    ultimaFecha: fechas.length ? fechas[fechas.length - 1].toISOString() : null,
    evidenciasSinFecha: indices.length - fechas.length
  };
}


export default { extraerTemas2, ESTADOS_TEMA, UMBRALES_TEMA, extraerEntidades };
