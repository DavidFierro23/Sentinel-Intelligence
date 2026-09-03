// apps/backend/services/territorial/socialGeoDisambiguation.js

/*
===========================================================
DESAMBIGUACION TERRITORIAL DE CONTENIDO SOCIAL
TERRITORIAL-SOCIAL-GEO-DISAMBIGUATION-01
===========================================================

Base: TERRITORIAL-SOCIAL-BENCHMARK-01, commit 976bb55.

EL DEFECTO, LOCALIZADO CON PRECISION
-----------------------------------------------------------

El catalogo territorial ya declaraba lo correcto:

    Cuenca
      ambiguo: true
      ambiguedad: "ambas"
      requiereContexto: ["azuay", "ecuador"]

Y `geoResolver` ya tenia una puerta que respeta eso: un
toponimo ambiguo no se resuelve sin contexto de respaldo.

La puerta se saltaba por una de sus cuatro llaves:

    respaldada =
        formaInequivoca
      | terminos.length > 0
      | respaldadaPorFuente
      | esElAmbito            <-- esta

`esElAmbito` significa «el toponimo ES el ambito que declaro el
analista». Como el ambito del piloto es `ec-azuay-cuenca`,
cualquier texto que diga «cuenca» satisfacia la puerta.

Eso es circular: **el proyecto ser de Cuenca se usaba como
prueba de que el texto habla de Cuenca.** El propio comentario
del resolutor dice que pertenecer al ambito del proyecto no es
respaldo valido —y `dentroDelAmbito` esta correctamente excluido—
pero `esElAmbito` es la misma suposicion con otro nombre.

Medido sobre las 75 evidencias sociales persistidas: 58 quedaron
ubicadas y **28 de ellas descansaban unicamente en esa llave**,
sin ningun contexto exigido presente.

POR QUE NO SE ARREGLA EN `geoResolver`
-----------------------------------------------------------

Porque ahi la llave hace falta. Con prensa local de Cuenca,
«el tranvia suma dos unidades» sin repetir «Azuay» es
correctamente local, y esas piezas son la cobertura mas util del
corpus. Quitar la llave en la infraestructura compartida
convertiria 13 falsos positivos medidos en un numero mucho mayor
de falsos negativos, que es justo lo que este gate prohibe.

Ademas `geoResolver` lo consumen tambien Candidate y Media. Un
cambio de semantica ahi no es mio.

Asi que el resolutor sigue resolviendo, y ESTA capa decide si lo
resuelto es apto para afirmar territorio. La resolucion se
conserva entera; lo que se calcula aqui es su clase de evidencia.

LO QUE NO SE HACE
-----------------------------------------------------------

    No se exige «Cuenca + Azuay» en cada pieza.
    No se descartan las 28 en bloque.
    No se aceptan las 28 en bloque.
    No se infiere residencia de ninguna persona.
    No se fabrica porcentaje de confianza.
    No se borra evidencia: se la excluye de agregados.

La consulta que trajo la pieza NUNCA cuenta como prueba de
territorio. `queryProvenance` viaja aparte de `signalsPositive`.
===========================================================
*/

import { hijosDe } from "../geo/territoryRegistry.js";
import { candidatosPara } from "./verifiedSourceUniverse.js";


/*
===========================================================
ESTADOS
===========================================================

Los cuatro primeros son nuevos: gradan la ATRIBUCION de una
pieza ya ubicada, que es una pregunta distinta de la que
responde `territorialScope.ALCANCES` (esa clasifica el origen:
territorio explicito / fuente local / nacional / no resoluble).

No se duplican: se componen. Una pieza puede ser
TERRITORIO_EXPLICITO por alcance y FUERA_TERRITORIO por
desambiguacion, y esa combinacion es precisamente el falso
positivo que este gate persigue.
===========================================================
*/

export const ESTADOS_GEO = Object.freeze({
  /* El contenido de la pieza sostiene el territorio. */
  TERRITORIO_CORROBORADO: "TERRITORIO_CORROBORADO",

  /*
    La pieza no lo sostiene, pero su emisor tiene vinculo
    territorial demostrado por OTRAS piezas corroboradas por
    contenido. Es una pista fuerte, no una prueba.
  */
  TERRITORIO_PROBABLE: "TERRITORIO_PROBABLE",

  /* Solo esta el termino ambiguo. Nada mas. */
  TERRITORIO_AMBIGUO: "TERRITORIO_AMBIGUO",

  /* Hay senal local Y senal incompatible. No se elige por el usuario. */
  TERRITORIO_CONFLICTIVO: "TERRITORIO_CONFLICTIVO",

  /* Senal incompatible sin ninguna senal local. */
  FUERA_TERRITORIO: "FUERA_TERRITORIO",

  /* El resolutor no ubico nada. */
  TERRITORIO_NO_RESOLUBLE: "TERRITORIO_NO_RESOLUBLE"
});


export const ETIQUETAS_GEO = Object.freeze({
  [ESTADOS_GEO.TERRITORIO_CORROBORADO]: "Territorio corroborado por el contenido",
  [ESTADOS_GEO.TERRITORIO_PROBABLE]: "Territorio probable · vínculo del emisor",
  [ESTADOS_GEO.TERRITORIO_AMBIGUO]: "Ambiguo · solo el término «Cuenca»",
  [ESTADOS_GEO.TERRITORIO_CONFLICTIVO]: "Conflictivo · señales incompatibles",
  [ESTADOS_GEO.FUERA_TERRITORIO]: "Fuera del territorio",
  [ESTADOS_GEO.TERRITORIO_NO_RESOLUBLE]: "Territorio no resoluble"
});


/*
===========================================================
APTITUD PARA METRICAS TERRITORIALES
===========================================================

Solo CORROBORADO afirma territorio.

PROBABLE queda fuera a proposito. Es informacion util —ordena
lectura humana, alimenta el universo de actores— pero su
territorio descansa en el emisor, no en la pieza. Contarla
seria volver a la circularidad por otra puerta.

Ninguno de estos estados borra nada. La evidencia sigue en el
ledger y sigue visible; lo que no hace es sumar en un agregado
que dice «esto pasa en Cuenca».
===========================================================
*/

const APTOS = Object.freeze(new Set([ESTADOS_GEO.TERRITORIO_CORROBORADO]));

export function esAptoParaMetricas(estadoGeo) {
  return APTOS.has(estadoGeo);
}


/* ---------------------------------------------------------
   SENALES POSITIVAS

   Todas se comprueban sobre el contenido de la pieza o sobre
   metadatos publicos del emisor. Ninguna sobre la consulta.
   --------------------------------------------------------- */

export const SENALES_POSITIVAS = Object.freeze({
  CONTEXTO_PAIS_O_PROVINCIA: "CONTEXTO_PAIS_O_PROVINCIA",
  TOPONIMO_LOCAL_NO_AMBIGUO: "TOPONIMO_LOCAL_NO_AMBIGUO",
  INSTITUCION_LOCAL: "INSTITUCION_LOCAL",
  DOMINIO_LOCAL_EN_UNIVERSO: "DOMINIO_LOCAL_EN_UNIVERSO",
  METADATO_DEL_EMISOR: "METADATO_DEL_EMISOR",
  EMISOR_LOCAL_CORROBORADO: "EMISOR_LOCAL_CORROBORADO"
});

export const SENALES_NEGATIVAS = Object.freeze({
  LUGAR_INCOMPATIBLE: "LUGAR_INCOMPATIBLE",
  USO_NO_GEOGRAFICO: "USO_NO_GEOGRAFICO"
});


/* Azuay, Ecuador o la bandera. Es el contexto que el catalogo exige. */
const RE_CONTEXTO = /\bazuay\b|\becuador\b|\becuatorian[oa]s?\b|🇪🇨/i;

/*
  Instituciones cuyo nombre no es ambiguo. Salen del universo de
  fuentes comprobado del proyecto —no de una lista inventada— mas
  las siglas de las empresas municipales, que aparecen en texto
  sin el dominio.

  «GAD», «EMOV», «EMAC», «ETAPA», «EMUVI» y «Farmasol» son
  ecuatorianas y no existen en la Cuenca de Espana. «Alcaldia» y
  «Municipio» tambien discriminan: Espana usa «Ayuntamiento».
*/
const RE_INSTITUCION = new RegExp(
  [
    "\\bgad\\b",
    "\\bemov\\b",
    "\\bemac\\b",
    "\\betapa\\s?ep\\b",
    "\\bemuvi\\b",
    "\\bfarmasol\\b",
    "\\bucuenca\\b",
    "universidad de cuenca",
    "municipio de cuenca",
    "alcald[íi]a de cuenca",
    "alcalde de cuenca",
    "prefectura del azuay",
    "tranv[íi]a de cuenca"
  ].join("|"),
  "i"
);

/*
  Usos en los que «cuenca» es sustantivo comun o nombra otra
  cosa. Se detecta el patron completo, no la palabra sola.

  Ojo con el limite que fija el gate: esto NO descarta por si
  mismo. Puede existir contenido ambiental legitimo de Cuenca
  hablando de su propia cuenca hidrografica, y por eso una senal
  negativa junto a una positiva produce CONFLICTIVO, no FUERA.
*/
const RE_USO_NO_GEOGRAFICO = new RegExp(
  [
    "cuenca\\s+(hidrogr[áa]fica|hidrol[óo]gica|minera|lacustre|amaz[óo]nica|carbon[íi]fera)",
    "cuenca\\s+del\\s+r[íi]o",
    "cuenca\\s+(sur|norte|alta|baja)\\b",
    "cuenca\\s+r[íi]o\\s+bravo",
    "cuenca\\s+chancay",
    "organismo\\s+de\\s+cuenca",
    "\"cuenca\"\\s+es\\s+un\\s+t[ée]rmino",
    "t[ée]rmino\\s+geogr[áa]fico"
  ].join("|"),
  "i"
);

/*
  Lugares incompatibles. La lista NO es la metodologia: es
  evidencia de conflicto cuando el texto la trae literalmente.
  Se poblo con lo que aparecio de verdad en el corpus del
  benchmark, no con un atlas.
*/
const RE_LUGAR_INCOMPATIBLE = new RegExp(
  [
    "\\bespa[ñn]a\\b",
    "castilla-?\\s?la\\s?mancha",
    "\\bcortesclm\\b",
    "\\bceuta\\b",
    "\\bper[úu]\\b",
    "\\blambayeque\\b",
    "\\btinajones\\b",
    "\\bchile\\b",
    "\\bpuc[óo]n\\b",
    "\\baraucan[íi]a\\b",
    "\\bcuba\\b",
    "\\bla\\s+habana\\b",
    "\\bartemisa\\b",
    "\\buruguay\\b",
    "santa\\s+luc[íi]a",
    "\\bm[ée]xico\\b",
    "nuevo\\s+le[óo]n\\b",
    "\\bconagua\\b",
    "\\bsantiago,\\s*nuevo",
    "\\bargentina\\b",
    "\\bjujuy\\b",
    "\\bneuqu[ée]n\\b",
    "\\bneuquinos\\b",
    "\\bpozuelos\\b",
    "🇨🇺",
    "🇪🇸",
    "🇵🇪",
    "🇦🇷"
  ].join("|"),
  "i"
);


/*
  Toponimos no ambiguos del canton, tomados del registro. Si el
  registro cambia, esto cambia con el: no hay lista duplicada.

  Se excluyen las unidades que el propio registro marca
  `ambiguo`, porque «Sucre», «Santa Ana» o «Banos» no
  discriminan nada por si solos.
*/
let cacheToponimos = null;

function toponimosLocalesNoAmbiguos() {
  if (cacheToponimos) return cacheToponimos;

  const nombres = hijosDe("ec-azuay-cuenca")
    .filter((u) => !u.ambiguo && u.nombre)
    /* «Cuenca (area urbana)» contiene el termino ambiguo: no sirve. */
    .filter((u) => !/^cuenca/i.test(u.nombre))
    .map((u) => u.nombre);

  cacheToponimos = nombres;
  return cacheToponimos;
}


/*
  Dominios del universo de fuentes con territorio declarado.
  Sirve para el enlace canonico: si la pieza apunta a
  `emov.gob.ec`, eso es una senal real y verificada.
*/
let cacheDominios = null;

function dominiosLocalesDeclarados() {
  if (cacheDominios) return cacheDominios;

  cacheDominios = new Set(
    candidatosPara("ec-azuay-cuenca")
      .filter((c) => c.territorioDeclarado && c.dominio)
      .map((c) => c.dominio.toLowerCase())
  );

  return cacheDominios;
}


/* ---------------------------------------------------------
   TEXTO VISIBLE

   Un tuit no tiene titular: su texto vive en `summary`. La capa
   territorial leia `title` y pintaba una fila vacia.

   No se inventa un titulo ni se altera el registro. Se expone
   un campo derivado, y se declara de donde salio.
   --------------------------------------------------------- */

export function textoParaMostrar(evidencia = {}) {
  const titulo = String(evidencia.title || evidencia.titulo || "").trim();

  if (titulo) return { texto: titulo, origen: "title" };

  const resumen = String(evidencia.summary || evidencia.resumen || "").trim();

  if (resumen) return { texto: resumen, origen: "summary" };

  return { texto: "", origen: null };
}


/* ---------------------------------------------------------
   DESAMBIGUAR UNA PIEZA
   --------------------------------------------------------- */

export function desambiguarTerritorio({
  evidencia = {},
  ubicacion = null,
  emisoresCorroborados = new Set(),
  territorioObjetivo = "ec-azuay-cuenca"
} = {}) {
  const positivas = [];
  const negativas = [];

  /*
    Procedencia de la consulta. Se registra y se aparta: no
    entra en ninguna de las dos listas de senales.
  */
  const queryProvenance = evidencia.provenance?.queryLabel || evidencia.queryLabel || null;

  if (!ubicacion?.unidadId) {
    return {
      estadoGeo: ESTADOS_GEO.TERRITORIO_NO_RESOLUBLE,
      etiqueta: ETIQUETAS_GEO[ESTADOS_GEO.TERRITORIO_NO_RESOLUBLE],
      unidadId: null,
      aptoParaMetricas: false,
      signalsPositive: [],
      signalsNegative: [],
      queryProvenance,
      resolutionReason: "El resolutor territorial no ubicó la pieza. No hay nada que desambiguar."
    };
  }

  /*
    Si el resolutor NO se apoyo en el termino ambiguo, no hay
    nada que discutir: resolvio por un toponimo propio, por
    contexto exigido o por ubicacion declarada.
  */
  const razones = ubicacion.razones || [];
  const apoyadaSoloEnElAmbito =
    razones.some((r) => /es el ambito declarado/i.test(r)) &&
    !razones.some((r) => /contexto exigido presente/i.test(r)) &&
    !razones.some((r) => /no ambiguo en el catalogo/i.test(r)) &&
    !razones.some((r) => /es inequivoca por si misma/i.test(r)) &&
    !razones.some((r) => /ubicacion declarada por la fuente/i.test(r));

  const { texto: visible } = textoParaMostrar(evidencia);

  const cuerpo = [
    evidencia.title,
    evidencia.titulo,
    evidencia.summary,
    evidencia.resumen,
    visible
  ]
    .filter((t) => typeof t === "string" && t.trim())
    .join(" . ");

  /* --- positivas de contenido --- */

  if (RE_CONTEXTO.test(cuerpo)) positivas.push(SENALES_POSITIVAS.CONTEXTO_PAIS_O_PROVINCIA);

  if (RE_INSTITUCION.test(cuerpo)) positivas.push(SENALES_POSITIVAS.INSTITUCION_LOCAL);

  const tops = toponimosLocalesNoAmbiguos().filter((n) =>
    new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(cuerpo)
  );

  if (tops.length) positivas.push(SENALES_POSITIVAS.TOPONIMO_LOCAL_NO_AMBIGUO);

  /* --- positivas del emisor --- */

  const dominios = dominiosLocalesDeclarados();
  const url = String(evidencia.canonicalUrl || "").toLowerCase();
  const dom = String(evidencia.domain || "").toLowerCase();

  if ([...dominios].some((d) => dom === d || url.includes(d))) {
    positivas.push(SENALES_POSITIVAS.DOMINIO_LOCAL_EN_UNIVERSO);
  }

  /*
    Metadato publico del emisor que diga Ecuador/Azuay de forma
    explicita. Es el nombre publico del canal o medio, no una
    inferencia sobre una persona.
  */
  const metadato = String(evidencia.publisher || "");

  if (RE_CONTEXTO.test(metadato)) positivas.push(SENALES_POSITIVAS.METADATO_DEL_EMISOR);

  /*
    Emisor con vinculo territorial ya demostrado por otras
    piezas suyas corroboradas POR CONTENIDO. El calculo lo hace
    `desambiguarLote`, que es quien ve el corpus entero.
  */
  const emisorId = evidencia.emitterId || evidencia.sourceId || evidencia.domain || null;

  if (emisorId && emisoresCorroborados.has(emisorId)) {
    positivas.push(SENALES_POSITIVAS.EMISOR_LOCAL_CORROBORADO);
  }

  /* --- negativas --- */

  if (RE_LUGAR_INCOMPATIBLE.test(cuerpo)) negativas.push(SENALES_NEGATIVAS.LUGAR_INCOMPATIBLE);

  if (RE_USO_NO_GEOGRAFICO.test(cuerpo)) negativas.push(SENALES_NEGATIVAS.USO_NO_GEOGRAFICO);

  /* --- decidir --- */

  const deContenido = positivas.filter(
    (s) =>
      s === SENALES_POSITIVAS.CONTEXTO_PAIS_O_PROVINCIA ||
      s === SENALES_POSITIVAS.TOPONIMO_LOCAL_NO_AMBIGUO ||
      s === SENALES_POSITIVAS.INSTITUCION_LOCAL
  );

  const delEmisor = positivas.filter(
    (s) =>
      s === SENALES_POSITIVAS.DOMINIO_LOCAL_EN_UNIVERSO ||
      s === SENALES_POSITIVAS.METADATO_DEL_EMISOR ||
      s === SENALES_POSITIVAS.EMISOR_LOCAL_CORROBORADO
  );

  const base = {
    unidadId: ubicacion.unidadId,
    signalsPositive: positivas,
    signalsNegative: negativas,
    queryProvenance,
    /* Se conserva la clase de evidencia que ya emitia el resolutor. */
    evidenceClass: ubicacion.procedencia || null,
    apoyadaSoloEnElTerminoAmbiguo: apoyadaSoloEnElAmbito
  };

  const decidir = (estadoGeo, resolutionReason) => ({
    ...base,
    estadoGeo,
    etiqueta: ETIQUETAS_GEO[estadoGeo],
    aptoParaMetricas: esAptoParaMetricas(estadoGeo),
    resolutionReason
  });

  /*
    El resolutor no se apoyo en el termino ambiguo: su
    resolucion se respeta tal cual. Sigue pudiendo entrar en
    conflicto si el texto trae un lugar incompatible.
  */
  if (!apoyadaSoloEnElAmbito) {
    if (negativas.includes(SENALES_NEGATIVAS.LUGAR_INCOMPATIBLE)) {
      return decidir(
        ESTADOS_GEO.TERRITORIO_CONFLICTIVO,
        `El resolutor ubicó la pieza sin depender del término ambiguo, pero el texto nombra otro lugar real (${negativas.join(", ")}). No se elige por el analista.`
      );
    }

    return decidir(
      ESTADOS_GEO.TERRITORIO_CORROBORADO,
      negativas.includes(SENALES_NEGATIVAS.USO_NO_GEOGRAFICO)
        ? "El resolutor no dependió del término ambiguo: resolvió por topónimo propio, contexto exigido o ubicación declarada. Se detectó además «cuenca» como sustantivo común, que aquí no contradice nada: puede ser contenido ambiental del propio cantón."
        : "El resolutor no dependió del término ambiguo: resolvió por topónimo propio, contexto exigido o ubicación declarada."
    );
  }

  /* Desde aqui, lo unico que trajo el resolutor fue «Cuenca». */

  /*
    Conflicto de verdad: hay anclaje local Y ademas OTRO LUGAR
    real compitiendo en el mismo texto. Ahi no elige el sistema.

    El uso de «cuenca» como sustantivo comun NO basta para
    declarar conflicto cuando el anclaje local es solido: «la
    cuenca del rio Tomebamba, en Cuenca, Azuay» es contenido
    ambiental de Cuenca, y el gate advierte expresamente de no
    tratarlo como foraneo. Se declara la coocurrencia en las
    senales y se corrobora.
  */
  if (deContenido.length && negativas.includes(SENALES_NEGATIVAS.LUGAR_INCOMPATIBLE)) {
    return decidir(
      ESTADOS_GEO.TERRITORIO_CONFLICTIVO,
      `Hay señal local en el contenido (${deContenido.join(", ")}) y a la vez otro lugar real compitiendo (${negativas.join(", ")}). No se resuelve sin lectura humana.`
    );
  }

  if (deContenido.length) {
    return decidir(
      ESTADOS_GEO.TERRITORIO_CORROBORADO,
      negativas.length
        ? `El contenido sostiene el territorio (${deContenido.join(", ")}). Se detectó además uso de «cuenca» como sustantivo común, que aquí no contradice nada: puede ser contenido ambiental del propio cantón.`
        : `El contenido de la pieza sostiene el territorio por señal independiente del término ambiguo (${deContenido.join(", ")}).`
    );
  }

  if (negativas.length) {
    return decidir(
      ESTADOS_GEO.FUERA_TERRITORIO,
      `El único apoyo era el término ambiguo y el texto trae señal incompatible (${negativas.join(", ")}). No se cuenta como territorio.`
    );
  }

  if (delEmisor.length) {
    return decidir(
      ESTADOS_GEO.TERRITORIO_PROBABLE,
      `La pieza no sostiene el territorio, pero su emisor tiene vínculo territorial demostrado (${delEmisor.join(", ")}). Pista fuerte, no prueba: no alimenta métricas.`
    );
  }

  return decidir(
    ESTADOS_GEO.TERRITORIO_AMBIGUO,
    `El único apoyo es el término «Cuenca», que es a la vez el cantón, una ciudad de España y un sustantivo común. El catálogo exige ${JSON.stringify(["azuay", "ecuador"])} y no aparece ninguno. No se afirma ni se niega el territorio.`
  );
}


/*
===========================================================
LOTE

Dos pasadas, y el orden importa.

La primera clasifica solo por contenido. La segunda usa el
resultado de la primera para saber que emisores tienen vinculo
territorial demostrado, y reclasifica.

Asi el vinculo del emisor descansa siempre en piezas
corroboradas POR CONTENIDO, nunca en otras piezas que tambien
descansaban en el emisor. Sin las dos pasadas, un emisor podria
corroborarse a si mismo.
===========================================================
*/

export function desambiguarLote(entradas = [], opciones = {}) {
  const primera = entradas.map((e) =>
    desambiguarTerritorio({
      evidencia: e.evidencia,
      ubicacion: e.ubicacion,
      emisoresCorroborados: new Set(),
      ...opciones
    })
  );

  const corroborados = new Set();

  primera.forEach((r, i) => {
    if (r.estadoGeo !== ESTADOS_GEO.TERRITORIO_CORROBORADO) return;

    const e = entradas[i].evidencia;
    const id = e.emitterId || e.sourceId || e.domain || null;

    if (id) corroborados.add(id);
  });

  const segunda = entradas.map((e) =>
    desambiguarTerritorio({
      evidencia: e.evidencia,
      ubicacion: e.ubicacion,
      emisoresCorroborados: corroborados,
      ...opciones
    })
  );

  return {
    resultados: segunda,
    emisoresLocalesCorroborados: [...corroborados],
    declaracion:
      "El vínculo territorial de un emisor se deriva únicamente de sus piezas corroboradas por contenido. Un emisor no puede corroborarse a sí mismo."
  };
}


/*
===========================================================
CORPUS OBSERVADO vs CORPUS TERRITORIALMENTE ELEGIBLE
===========================================================

Son dos cosas y hay que poder decir las dos.

Una pieza de Lambayeque que entro por la busqueda «Cuenca» es
evidencia REAL de recoleccion: dice que la consulta trae ruido y
cuanto. Eso se conserva y se reporta.

Lo que no puede hacer es convertirse en conversacion de Cuenca.
===========================================================
*/

export function resumirDesambiguacion(resultados = []) {
  const porEstado = Object.fromEntries(Object.values(ESTADOS_GEO).map((e) => [e, 0]));

  resultados.forEach((r) => {
    if (r?.estadoGeo && porEstado[r.estadoGeo] !== undefined) porEstado[r.estadoGeo] += 1;
  });

  const observado = resultados.length;
  const elegible = resultados.filter((r) => r?.aptoParaMetricas).length;

  return {
    corpusObservado: observado,
    corpusTerritorialElegible: elegible,
    porEstado,

    /* Debe cuadrar. Si no cuadra, hay un estado sin contar. */
    sumaDeEstados: Object.values(porEstado).reduce((a, b) => a + b, 0),
    cuadra: Object.values(porEstado).reduce((a, b) => a + b, 0) === observado,

    declaraciones: [
      "El corpus observado incluye piezas de otros territorios traídas por un término ambiguo. Son evidencia de recolección, no de territorio.",
      "Solo TERRITORIO_CORROBORADO alimenta métricas territoriales.",
      "TERRITORIO_PROBABLE se conserva como evidencia y queda fuera de los agregados: su territorio descansa en el emisor, no en la pieza.",
      "Ninguna pieza se borra. Excluir de un agregado no es eliminar del ledger.",
      "No se emite porcentaje de confianza: las señales se enumeran y el lector las ve."
    ]
  };
}


export default {
  ESTADOS_GEO,
  ETIQUETAS_GEO,
  SENALES_POSITIVAS,
  SENALES_NEGATIVAS,
  esAptoParaMetricas,
  textoParaMostrar,
  desambiguarTerritorio,
  desambiguarLote,
  resumirDesambiguacion
};
