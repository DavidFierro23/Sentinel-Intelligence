// apps/backend/services/geo/topicTerritoryCrosstab.js

import { ventanaDeDias, ZONA_POR_DEFECTO } from "../territorial/dayWindow.js";
import { ESTADOS_VENTANA } from "../territorial/temporalWindows.js";

/*
===========================================================
TEMA x TERRITORIO — Gate C2, completado en
TERRITORIAL-TOPIC-TERRITORY-01
===========================================================

Cruza cada tema con los territorios de sus evidencias
GEOLOCALIZABLES, y solo con esas.

Un tema con diez evidencias de las que dos se pudieron ubicar
aparece con dos. No se reparte el resto y no se asume que una
noticia sobre Cuenca aplique a todas sus parroquias: eso seria
desagregar, y GEO-1 lo prohibe.

La cifra `sinGeolocalizar` va SIEMPRE al lado. Sin ella, un
tema cuyas evidencias no se pudieron ubicar parece un tema sin
presencia territorial, cuando lo que pasa es que no se supo
donde ponerlo.

LO QUE AÑADE TERRITORIAL-TOPIC-TERRITORY-01
-----------------------------------------------------------

`cruzarTemaTerritorio` contaba evidencias por tema y unidad, y
nada mas. Con eso no se puede responder ninguna de las
preguntas que justifican el modulo:

    ¿que fuentes hablan de este tema aqui?
    ¿esto esta creciendo?
    ¿que evidencia sostiene la afirmacion?

`construirMatriz` completa la celda: fuentes, emisores,
ventana, rango de publicacion, primera y ultima observacion, y
los `evidenceId` que la sostienen. Sin los ids no hay
auditoria: hay una cifra que hay que creerse.
===========================================================
*/


/*
-----------------------------------------------------------
TERRITORIO NO RESUELTO

No es un territorio: es la declaracion de que no se supo cual.

Se le da un identificador propio y una fila propia porque la
alternativa —descartar esas evidencias— haria que el total de
la matriz no cuadrase con el corpus, y nadie sabria por que.

No se fuerza una parroquia. Si la evidencia solo sostiene
«Cuenca», el territorio es Cuenca a nivel canton. Si solo
sostiene «Azuay», es Azuay. Si no sostiene nada, es esto.
-----------------------------------------------------------
*/

export const TERRITORIO_NO_RESUELTO = "TERRITORIO_NO_RESUELTO";


export const ESTADOS_COBERTURA = Object.freeze({
  /* Evidencia suficiente y de mas de una fuente. */
  OBSERVADO: "OBSERVADO",

  /*
    Hay evidencia, pero poca o de una sola fuente. Se muestra
    —existe— y se marca: una nota de un solo medio no sostiene
    una afirmacion sobre el territorio.
  */
  COBERTURA_BAJA: "COBERTURA_BAJA",

  /*
    La ventana pedida empieza antes de que Sentinel empezara a
    observar. El conteo no es cero: es incompleto, y decir «3
    evidencias en 90 dias» cuando solo se observaron 6 dias
    seria informar mal.
  */
  HISTORICO_INSUFICIENTE: ESTADOS_VENTANA.INSUFICIENTE,

  /*
    Se pregunto por esta celda y no hay evidencia. Distinto de
    que la celda no exista: esto es una ausencia COMPROBADA.
  */
  SIN_EVIDENCIA: "SIN_EVIDENCIA",

  TERRITORIO_NO_RESUELTO: "TERRITORIO_NO_RESUELTO"
});


export const ESTADOS_TENDENCIA = Object.freeze({
  CRECIENDO: "CRECIENDO",
  DISMINUYENDO: "DISMINUYENDO",
  ESTABLE: "ESTABLE",

  /* No se observaba la ventana anterior: no hay con que comparar. */
  HISTORICO_INSUFICIENTE: ESTADOS_VENTANA.INSUFICIENTE,

  /*
    Se observaban las dos ventanas pero hay tan poca evidencia
    que la variacion no significa nada. Una nota frente a cero
    no es un tema creciendo.
  */
  MUESTRA_INSUFICIENTE: "MUESTRA_INSUFICIENTE"
});


/*
-----------------------------------------------------------
UMBRALES — decisiones declaradas, no estandares

Se dejan visibles y configurables porque son juicios. Lo que
no es un juicio es que tengan que estar escritos en algun
sitio en lugar de repartidos por el codigo.
-----------------------------------------------------------
*/

export const UMBRALES = Object.freeze({
  /* Por debajo de esto, la celda es COBERTURA_BAJA. */
  evidenciasParaObservado: 2,

  /* Una sola fuente no confirma: puede ser una nota resubida. */
  fuentesParaObservado: 2,

  /*
    Minimo de evidencias SUMANDO las dos ventanas para que una
    variacion se pueda llamar tendencia.
  */
  evidenciasParaTendencia: 4,

  /*
    Variacion relativa por debajo de la cual se dice ESTABLE.
    0.25 es una decision declarada: con 4 evidencias, una mas o
    una menos no es un cambio de agenda.
  */
  umbralEstable: 0.25
});


/*
===========================================================
NORMALIZAR UNA EVIDENCIA PARA LA MATRIZ

El corpus llega de dos sitios con nombres distintos: del libro
de evidencias (`title`, `publishedAt`, `sourceId`) y de la ruta
de analisis (`titulo`, `fecha`, `dominio`). Se acepta cualquiera
de los dos y NO se inventa lo que falte.
===========================================================
*/

export function normalizarEvidenciaMatriz(e = {}, indice = null) {
  const emisor = e.publisher || e.fuenteDeclarada || null;

  return {
    indice,

    evidenceId: e.evidenceId || null,

    titulo: e.title || e.titulo || null,

    url: e.canonicalUrl || e.url || e.enlace || null,

    /* Donde vive. */
    fuente: e.sourceId || e.dominio || null,

    /*
      Quien publica. Puede ser null —el 40 % del corpus de
      YouTube llegaba asi— y en ese caso NO se cuenta como
      emisor: se cuenta como emisor sin resolver.
    */
    emisor,

    providerId: e.providerId || e.origen || e.motorId || null,

    publishedAt: e.publishedAt || e.fecha || null,

    firstObservedAt: e.firstObservedAt || null,
    lastObservedAt: e.lastObservedAt || e.retrievedAt || null
  };
}


/*
===========================================================
TEMA O LUGAR

Un nombre propio de territorio NO es un tema.

Medido sobre el corpus real: la señal con mas evidencias era
«cuenca», con 30, seguida de «azuay · estado» con 4. Ninguna de
las dos es un tema: son el territorio. El extractor las produce
como etiquetas emergentes —`emergente-cuenca`— porque el
toponimo es, literalmente, la palabra que mas se repite en un
corpus territorial.

Dejarlas en el ranking convierte la pregunta «¿de que se habla
en Cuenca?» en la respuesta «de Cuenca».

El criterio es verificable y no inventado: se comparan los
tokens del nombre contra los toponimos del REGISTRO
TERRITORIAL, que se inyectan. Si TODOS los tokens
significativos son toponimos, la señal es un LUGAR.

«alcaldia cuenca» se queda como TEMA: `alcaldia` no es un
toponimo, y la señal habla de la alcaldia, no del canton.

Las filas de LUGAR no se borran —existen, y su evidencia es
real— pero salen del ranking de temas y se cuentan aparte.
===========================================================
*/

export const TIPOS_SENAL = Object.freeze({
  TEMA: "TEMA",
  LUGAR: "LUGAR",

  /*
    Un TOKEN GENERICO tampoco es un tema.

    Medido en TERRITORIAL-LOCAL-SOURCE-EXPANSION-01 sobre el
    corpus real: «caso» 9 evidencias, «autoridades» 10, «pais» 9,
    «cerca» 8. Son palabras que aparecen en cualquier noticia;
    presentarlas como agenda del territorio es ruido con formato
    de hallazgo.

    La lista se declara aqui y NO en `stopConcepts.js`, que es un
    modulo compartido: aquel ya cubre verbos de atribucion y
    descriptores administrativos, y ampliarlo cambiaria el
    comportamiento de otros gates sin haberlo medido.

    Se aplica la misma regla que a LUGAR y TEMPORAL: TODOS los
    tokens significativos tienen que ser genericos. «caso
    Serrano» sigue siendo un tema.
  */
  GENERICO: "GENERICO",

  /*
    Una FECHA tampoco es un tema.

    Medido en TERRITORIAL-ACCELERATION-02: al persistir los
    resumenes de RSS, el descubrimiento abierto empezo a
    proponer señales como «agosto · lunes» con ocho evidencias.
    Es la fecha del articulo, no su asunto.

    Los nombres de mes y de dia son una lista cerrada del
    idioma: comprobable, no inventada.
  */
  TEMPORAL: "TEMPORAL"
});


/*
  Genericos observados en el corpus real. Sustantivos y adverbios
  que no distinguen un tema de otro.
*/
const TOKENS_GENERICOS = new Set([
  "caso", "casos", "autoridad", "autoridades", "pais", "cerca", "lejos",
  "persona", "personas", "hombre", "mujer", "gente",
  "nuevo", "nueva", "nuevos", "nuevas", "gran", "grande",
  "primer", "primera", "ultimo", "ultima", "mayor", "menor",
  "tema", "temas", "hecho", "hechos", "parte", "partes",
  "forma", "manera", "vez", "veces", "momento", "situacion",
  "punto", "cosa", "cosas", "tipo", "clase", "grupo",
  "informacion", "detalles", "declaraciones"
]);


const TOKENS_TEMPORALES = new Set([
  "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
  "agosto", "septiembre", "setiembre", "octubre", "noviembre", "diciembre",
  "lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo",
  "hoy", "ayer", "manana", "semana", "mes", "año", "ano", "hora", "horas",
  "minutos", "dias", "dia"
]);


/* Conectores que no deciden nada. */
const TOKENS_VACIOS = new Set(["de", "del", "la", "el", "los", "las", "en", "y", "e", "estado"]);


export function normalizarToponimo(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}


export function clasificarSenal(nombre, toponimos = null) {
  if (!toponimos || toponimos.size === 0) return TIPOS_SENAL.TEMA;

  const tokens = normalizarToponimo(nombre)
    .split(/[^a-z0-9ñ]+/)
    .filter((t) => t.length >= 3 && !TOKENS_VACIOS.has(t));

  if (tokens.length === 0) return TIPOS_SENAL.TEMA;

  /*
    Igual que con los toponimos: TODOS los tokens tienen que ser
    temporales. «crisis de agosto» sigue siendo un tema.
  */
  if (tokens.every((t) => TOKENS_TEMPORALES.has(t) || /^\d{1,4}$/.test(t))) {
    return TIPOS_SENAL.TEMPORAL;
  }

  /* Y lo mismo con los genericos: «caso Serrano» no es generico. */
  if (tokens.every((t) => TOKENS_GENERICOS.has(t))) return TIPOS_SENAL.GENERICO;

  /*
    TODOS los tokens significativos tienen que ser toponimos.
    Con «alguno» bastaria para que «agua en Cuenca» dejara de
    ser un tema, y es justo el tema que interesa.
  */
  return tokens.every((t) => toponimos.has(t)) ? TIPOS_SENAL.LUGAR : TIPOS_SENAL.TEMA;
}


/* Del registro territorial al conjunto que usa el clasificador. */
export function toponimosDe(unidades = []) {
  const set = new Set();

  unidades.forEach((u) => {
    const nombre = typeof u === "string" ? u : u?.nombre || u?.id;

    normalizarToponimo(nombre)
      .split(/[^a-z0-9ñ]+/)
      .filter((t) => t.length >= 3 && !TOKENS_VACIOS.has(t))
      .forEach((t) => set.add(t));
  });

  return set;
}


/*
  Orden por INSTANTE, no por cadena.

  El libro de evidencias mezcla dos formatos de `publishedAt`:
  ISO (`2026-08-28T09:13:34Z`) y RFC 2822
  (`Wed, 26 Aug 2026 17:25:53 GMT`), porque cada proveedor
  declara la fecha a su manera y el contrato no la normaliza.

  Ordenar esas cadenas alfabeticamente pone «Wed, 26 Aug»
  despues de «2026-08-28» y el rango de publicacion sale al
  reves. Medido sobre el corpus real: desde 28-ago hasta 26-ago.
*/
function porInstante(a, b) {
  const ta = new Date(a).getTime();

  const tb = new Date(b).getTime();

  if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;

  if (Number.isNaN(ta)) return 1;

  if (Number.isNaN(tb)) return -1;

  return ta - tb;
}


function dentroDe(instante, ventana) {
  if (!instante || !ventana) return false;

  const t = new Date(instante).getTime();

  if (Number.isNaN(t)) return false;

  return t >= new Date(ventana.desde).getTime() && t <= new Date(ventana.hasta).getTime();
}


/*
  Cuando empezo Sentinel a observar. Es el limite de lo que se
  puede afirmar sobre el pasado: una ventana que empieza antes
  de esto no esta vacia, esta sin observar.
*/
export function inicioDeObservacion(evidencias = []) {
  const instantes = evidencias
    .map((e) => e.firstObservedAt || e.lastObservedAt)
    .filter(Boolean)
    .sort(porInstante);

  return instantes[0] || null;
}


/*
  Ventana anterior comparable: mismo numero de dias, pegada a
  la actual y sin solaparse.
*/
export function ventanaAnteriorComparable(ventana, dias) {
  if (!ventana) return null;

  const inicio = new Date(ventana.desde).getTime();

  const duracion = dias * 86400000;

  return {
    id: `${ventana.id}_anterior`,
    etiqueta: `${ventana.etiqueta} anteriores`,
    dias,
    desde: new Date(inicio - duracion).toISOString(),
    hasta: new Date(inicio - 1).toISOString()
  };
}


/*
===========================================================
CONSTRUIR UNA CELDA
===========================================================
*/

function construirCelda({ tema, origenTema, territorio, evidencias, ventana, historicoCubre, tipoSenal }) {
  const fuentes = new Set();

  const emisores = new Set();

  let emisoresSinResolver = 0;

  const evidenceIds = [];

  let publicadoHoy = 0;

  let publicado7d = 0;

  let sinFecha = 0;

  const publicaciones = [];

  const observaciones = [];

  const hoy = ventana.hoy;

  const siete = ventana.siete;

  evidencias.forEach((e) => {
    if (e.fuente) fuentes.add(e.fuente);

    if (e.emisor) emisores.add(e.emisor);
    else emisoresSinResolver += 1;

    /*
      Un `evidenceId` no entra dos veces en la misma celda. Una
      evidencia que pertenece a dos temas cuenta en los dos
      —habla de los dos— pero nunca dos veces en el mismo.
    */
    if (e.evidenceId && !evidenceIds.includes(e.evidenceId)) evidenceIds.push(e.evidenceId);

    if (!e.publishedAt) sinFecha += 1;
    else {
      publicaciones.push(e.publishedAt);

      if (dentroDe(e.publishedAt, hoy)) publicadoHoy += 1;

      if (dentroDe(e.publishedAt, siete)) publicado7d += 1;
    }

    if (e.firstObservedAt) observaciones.push(e.firstObservedAt);
  });

  publicaciones.sort(porInstante);

  observaciones.sort(porInstante);

  const esNoResuelto = territorio.unidadId === TERRITORIO_NO_RESUELTO;

  /*
    La cobertura EVIDENCIAL se juzga siempre, y aparte del
    historico. Son dos preguntas distintas:

      ¿hay suficiente evidencia y de suficientes fuentes?
      ¿estabamos observando durante la ventana pedida?

    Colapsarlas en un solo campo perderia informacion: una celda
    con seis evidencias de cuatro medios en una ventana que no
    observabamos no es lo mismo que una celda con una evidencia
    de un medio, y ambas saldrian como HISTORICO_INSUFICIENTE.
  */
  let coberturaEvidencial;

  if (evidencias.length === 0) coberturaEvidencial = ESTADOS_COBERTURA.SIN_EVIDENCIA;
  else if (
    evidencias.length < UMBRALES.evidenciasParaObservado ||
    fuentes.size < UMBRALES.fuentesParaObservado
  ) {
    coberturaEvidencial = ESTADOS_COBERTURA.COBERTURA_BAJA;
  } else coberturaEvidencial = ESTADOS_COBERTURA.OBSERVADO;

  /*
    El estado que manda. El historico pesa mas que el conteo:
    si no observabamos, el conteo es incompleto y presentarlo
    como cobertura seria informar mal.
  */
  let coverageStatus;

  if (esNoResuelto) coverageStatus = ESTADOS_COBERTURA.TERRITORIO_NO_RESUELTO;
  else if (evidencias.length === 0) coverageStatus = ESTADOS_COBERTURA.SIN_EVIDENCIA;
  else if (!historicoCubre) coverageStatus = ESTADOS_COBERTURA.HISTORICO_INSUFICIENTE;
  else coverageStatus = coberturaEvidencial;

  return {
    temaId: tema.id,
    tema: tema.nombre,
    origenTema,

    /*
      LUGAR significa que la señal es el territorio, no un tema.
      La fila se conserva —su evidencia es real— pero sale del
      ranking de temas.
    */
    tipoSenal,

    territorioId: territorio.unidadId,
    territorio: territorio.nombre,
    nivel: territorio.nivel,

    ventana: { id: ventana.actual.id, etiqueta: ventana.actual.etiqueta },

    evidencias: evidencias.length,
    fuentes: fuentes.size,
    emisores: emisores.size,

    /*
      No se suma a `emisores`: no saber quien publica no es un
      emisor mas. Es el hueco declarado.
    */
    emisoresSinResolver,

    listaFuentes: [...fuentes],
    listaEmisores: [...emisores],

    publicadoHoy,
    publicado7d,
    sinFechaDePublicacion: sinFecha,

    rangoPublicacion: publicaciones.length
      ? { desde: publicaciones[0], hasta: publicaciones[publicaciones.length - 1] }
      : null,

    primeraObservacion: observaciones[0] || null,
    ultimaObservacion: observaciones[observaciones.length - 1] || null,

    evidenceIds,

    coverageStatus,
    coberturaEvidencial,

    /* Razones de atribucion territorial, sin repetir. */
    atribucion: territorio.razones || [],

    /*
      Un tema visto por primera vez dentro de la ventana es un
      HECHO. NO es «emergente»: para eso habria que saber que
      antes no estaba, y antes puede que no estuviesemos
      mirando.
    */
    primeraObservacionEnLaVentana: Boolean(
      observaciones[0] && dentroDe(observaciones[0], ventana.actual)
    ),

    /*
      Viralidad: no hay metodologia declarada, asi que no hay
      cifra. Inventar un umbral y llamarlo viral seria peor que
      no decir nada.
    */
    viral: null,
    motivoViral:
      "NO_DISPONIBLE: no hay metodología de viralidad declarada. Exige velocidad de propagación y origen, que este módulo no observa."
  };
}


/*
===========================================================
CONSTRUIR LA MATRIZ
===========================================================

`ubicaciones[i]` es la ubicacion de la evidencia `i`, tal como
la deja el agregador territorial: `{ unidadId, unidad, nivel,
procedencia, confianzaGeografica }`.

Las evidencias de un tema que no se pudieron ubicar NO se
descartan: van a la fila `TERRITORIO_NO_RESUELTO`, que se ve.
===========================================================
*/

export function construirMatriz({
  evidencias = [],
  temas = [],
  descubiertos = [],
  ubicaciones = [],
  ventanaId = "7d",
  ahora = new Date().toISOString(),
  zona = ZONA_POR_DEFECTO,
  umbrales = UMBRALES,

  /*
    Toponimos del registro territorial. Se inyectan para que
    geo/topicTerritoryCrosstab no tenga que importar el registro:
    el mismo motivo por el que `resolverLote` recibe la pista de
    fuente como funcion.
  */
  toponimos = null,

  /*
    ---------------------------------------------------------
    COMPUERTA DE APTITUD TERRITORIAL
    TERRITORIAL-SOCIAL-GEO-DISAMBIGUATION-01

    Predicado opcional `(evidencia, indice) => boolean`. Cuando
    se inyecta, una evidencia NO apta deja de atribuir
    territorio: pasa a `TERRITORIO_NO_RESUELTO` con motivo
    declarado.

    Por que hace falta. La busqueda social abierta trae piezas
    de Lambayeque, La Habana o Neuquen porque «cuenca» es
    tambien un sustantivo comun. Medido: 13 de 28 atribuciones
    que descansaban solo en ese termino eran de otro lugar. Sin
    compuerta, esas 13 sumaban en una celda que afirma «esto
    pasa en Cuenca».

    Por que es opcional y no obligatoria. La firman los
    llamadores que sepan calcular la aptitud —hoy, la ruta
    territorial con `socialGeoDisambiguation`—. Encenderla por
    defecto cambiaria en silencio el resultado de Candidate y
    Media, que tambien consumen esta matriz.

    La pieza NO se borra ni sale del corpus observado: sigue
    contando como evidencia de recoleccion. Lo unico que pierde
    es el derecho a afirmar territorio.
    ---------------------------------------------------------
  */
  aptitudTerritorial = null
} = {}) {
  const DIAS = { hoy: 1, "24h": 1, "7d": 7, "15d": 15, "30d": 30, "90d": 90 };

  const dias = DIAS[ventanaId] || 7;

  const actual = ventanaDeDias(dias, ahora, zona);

  const anterior = ventanaAnteriorComparable(actual, dias);

  const hoy = ventanaDeDias(1, ahora, zona);

  const siete = ventanaDeDias(7, ahora, zona);

  const normalizadas = evidencias.map((e, i) => normalizarEvidenciaMatriz(e, i));

  const inicioObs = inicioDeObservacion(normalizadas);

  /*
    ¿Cubre el historico la ventana pedida? Si la ventana empieza
    antes de que empezaramos a observar, el conteo esta
    incompleto y la celda lo dice.
  */
  const historicoCubre = Boolean(
    inicioObs && new Date(inicioObs).getTime() <= new Date(actual.desde).getTime()
  );

  const historicoCubreAnterior = Boolean(
    inicioObs && new Date(inicioObs).getTime() <= new Date(anterior.desde).getTime()
  );

  const ctx = { actual, anterior, hoy, siete };

  const territorioDe = (i) => {
    const u = ubicaciones[i];

    /*
      Compuerta primero: da igual lo bien que resolviera el
      resolutor si la pieza no es apta para afirmar territorio.
    */
    if (typeof aptitudTerritorial === "function" && !aptitudTerritorial(normalizadas[i], i)) {
      return {
        unidadId: TERRITORIO_NO_RESUELTO,
        nombre: "Territorio no resuelto",
        nivel: null,
        noAptaParaMetricas: true,
        razones: [
          "La evidencia se observó y se conserva, pero su atribución territorial no es apta para métricas. No suma en ninguna celda de territorio."
        ]
      };
    }

    if (!u?.unidadId) {
      return {
        unidadId: TERRITORIO_NO_RESUELTO,
        nombre: "Territorio no resuelto",
        nivel: null,
        razones: []
      };
    }

    const razones = [];

    if (u.procedencia) razones.push(`procedencia: ${u.procedencia}`);

    if (u.confianzaGeografica != null) razones.push(`confianza: ${u.confianzaGeografica}`);

    if (Array.isArray(u.razones)) razones.push(...u.razones);

    /*
      `unidad` llega como cadena desde el agregador territorial y
      como OBJETO desde `resolverUbicacion`. Sin esto, la
      interfaz imprime «[object Object]» como nombre de
      territorio: comprobado en la prueba real.
    */
    const nombre =
      typeof u.unidad === "string"
        ? u.unidad
        : u.unidad?.nombre || u.nombre || u.unidadId;

    return {
      unidadId: u.unidadId,
      nombre,
      nivel: u.nivel || u.resolucion || null,
      razones
    };
  };

  const filas = [];

  const procesarTema = (t, origen) => {
    const id = t.id || t.temaId || t.termino || t.etiquetaPropuesta;

    const nombre = t.nombre || t.etiquetaPropuesta || t.termino || id;

    const tema = { id, nombre };

    const tipoSenal = clasificarSenal(nombre, toponimos);

    /*
      Solo las evidencias del tema que caen DENTRO de la ventana.
      Una evidencia sin fecha no entra en ninguna ventana: la
      fuente no la declaro y no se le pone una.
    */
    const indices = (t.indices || []).filter((i) => {
      const e = normalizadas[i];

      return e && dentroDe(e.publishedAt, actual);
    });

    if (indices.length === 0) return;

    const porTerritorio = new Map();

    indices.forEach((i) => {
      const terr = territorioDe(i);

      if (!porTerritorio.has(terr.unidadId)) {
        porTerritorio.set(terr.unidadId, { territorio: terr, evidencias: [] });
      }

      const bucket = porTerritorio.get(terr.unidadId);

      bucket.evidencias.push(normalizadas[i]);

      /* Razones acumuladas sin duplicar. */
      terr.razones.forEach((r) => {
        if (!bucket.territorio.razones.includes(r)) bucket.territorio.razones.push(r);
      });
    });

    porTerritorio.forEach(({ territorio, evidencias: evs }) => {
      filas.push(
        construirCelda({
          tema,
          origenTema: origen,
          territorio,
          evidencias: evs,
          ventana: ctx,
          historicoCubre,
          tipoSenal
        })
      );
    });
  };

  temas.forEach((t) => procesarTema(t, "clasificado"));

  descubiertos.forEach((t) => procesarTema(t, "descubierto"));

  filas.sort(
    (a, b) =>
      b.evidencias - a.evidencias ||
      String(a.tema).localeCompare(String(b.tema)) ||
      String(a.territorioId).localeCompare(String(b.territorioId))
  );

  /* --- metricas del conjunto --- */
  const temasVistos = new Set(
    filas.filter((f) => f.tipoSenal === TIPOS_SENAL.TEMA).map((f) => f.temaId)
  );

  const lugaresComoSenal = new Set(
    filas.filter((f) => f.tipoSenal === TIPOS_SENAL.LUGAR).map((f) => f.temaId)
  );

  const temporalesComoSenal = new Set(
    filas.filter((f) => f.tipoSenal === TIPOS_SENAL.TEMPORAL).map((f) => f.temaId)
  );

  const genericasComoSenal = new Set(
    filas.filter((f) => f.tipoSenal === TIPOS_SENAL.GENERICO).map((f) => f.temaId)
  );

  const territoriosVistos = new Set(
    filas.filter((f) => f.territorioId !== TERRITORIO_NO_RESUELTO).map((f) => f.territorioId)
  );

  const enVentana = normalizadas.filter((e) => dentroDe(e.publishedAt, actual));

  return {
    ventana: {
      ...actual,
      anterior,
      historicoCubre,
      historicoCubreAnterior,
      inicioDeObservacion: inicioObs,

      motivo: historicoCubre
        ? null
        : `La ventana empieza el ${actual.desde} y Sentinel empezó a observar el ${inicioObs || "—"}. El conteo está INCOMPLETO, no vacío.`
    },

    filas,

    metricas: {
      celdas: filas.length,
      temas: temasVistos.size,

      /*
        Señales que son el territorio y no un tema. Se cuentan
        aparte para que «23 temas» no incluya «cuenca».
      */
      senalesQueSonLugar: lugaresComoSenal.size,

      /* Señales que son una fecha, no un asunto. */
      senalesQueSonFecha: temporalesComoSenal.size,

      /* Señales que son una palabra genérica, no un asunto. */
      senalesGenericas: genericasComoSenal.size,
      territorios: territoriosVistos.size,

      evidenciasEnVentana: enVentana.length,
      evidenciasEnCorpus: normalizadas.length,

      celdasSinTerritorio: filas.filter((f) => f.territorioId === TERRITORIO_NO_RESUELTO).length,

      porCobertura: filas.reduce((acc, f) => {
        acc[f.coverageStatus] = (acc[f.coverageStatus] || 0) + 1;

        return acc;
      }, {}),

      porCoberturaEvidencial: filas.reduce((acc, f) => {
        acc[f.coberturaEvidencial] = (acc[f.coberturaEvidencial] || 0) + 1;

        return acc;
      }, {}),

      /* Sin emisor resuelto: el hueco, contado. */
      emisoresSinResolver: filas.reduce((n, f) => n + f.emisoresSinResolver, 0)
    },

    reglas: [
      "Solo se usan evidencias geolocalizables. Las que no se pudieron ubicar van a TERRITORIO_NO_RESUELTO, que se ve: descartarlas haría que el total no cuadrase con el corpus.",
      "Un tema NO se reparte territorialmente por población. Una noticia sobre el cantón NO se atribuye a sus parroquias.",
      "Una evidencia sin fecha no entra en ninguna ventana: la fuente no la declaró y no se le pone una.",
      "Un mismo `evidenceId` no se cuenta dos veces en la misma celda. En dos temas distintos sí cuenta en los dos: habla de los dos.",
      "No se calculan porcentajes de población ni de electores: no hay denominador oficial con licencia. La métrica es CONTEO ABSOLUTO.",
      "Cero evidencias no se usa nunca para decir «desconocido»: para eso están SIN_EVIDENCIA e HISTORICO_INSUFICIENTE.",
      "Un token genérico —«caso», «autoridades», «país»— tampoco es un tema: aparece en cualquier noticia y presentarlo como agenda es ruido con formato de hallazgo.",
      "Una fecha tampoco es un tema: «agosto · lunes» es cuándo se publicó, no de qué habla. Los nombres de mes y de día son una lista cerrada del idioma, comprobable.",
      "Un nombre propio de territorio NO es un tema. «cuenca» era la señal con más evidencias del corpus real; queda marcada como LUGAR y fuera del ranking, porque responder «¿de qué se habla en Cuenca?» con «de Cuenca» no informa.",
      "`coverageStatus` y `coberturaEvidencial` responden dos preguntas distintas: si hay suficiente evidencia, y si se estaba observando la ventana. La segunda pesa más, porque sin observación el conteo es incompleto.",
      "«Emergente» y «viral» no se declaran: la primera exigiría saber que antes no estaba —y antes puede que no estuviéramos mirando— y la segunda una metodología de propagación que este módulo no tiene."
    ]
  };
}


/*
===========================================================
COMPARAR VENTANAS

Solo se declara tendencia cuando se observaban LAS DOS
ventanas y hay evidencia suficiente en ellas.

El orden de las comprobaciones importa: primero si habia
observacion, despues si hay muestra. Al reves, un tema del que
no se observaba nada saldria como MUESTRA_INSUFICIENTE, que
suena a «hay poco» cuando lo que pasa es que no mirabamos.
===========================================================
*/

export function compararVentanas({
  evidencias = [],
  temas = [],
  descubiertos = [],
  ventanaId = "7d",
  ahora = new Date().toISOString(),
  zona = ZONA_POR_DEFECTO,
  umbrales = UMBRALES
} = {}) {
  const DIAS = { hoy: 1, "24h": 1, "7d": 7, "15d": 15, "30d": 30, "90d": 90 };

  const dias = DIAS[ventanaId] || 7;

  const actual = ventanaDeDias(dias, ahora, zona);

  const anterior = ventanaAnteriorComparable(actual, dias);

  const normalizadas = evidencias.map((e, i) => normalizarEvidenciaMatriz(e, i));

  const inicioObs = inicioDeObservacion(normalizadas);

  const observabamosAnterior = Boolean(
    inicioObs && new Date(inicioObs).getTime() <= new Date(anterior.desde).getTime()
  );

  const señales = [...temas.map((t) => [t, "clasificado"]), ...descubiertos.map((t) => [t, "descubierto"])];

  const filas = señales.map(([t, origen]) => {
    const id = t.id || t.temaId || t.termino || t.etiquetaPropuesta;

    const indices = t.indices || [];

    const enActual = indices.filter((i) => dentroDe(normalizadas[i]?.publishedAt, actual)).length;

    const enAnterior = indices.filter((i) => dentroDe(normalizadas[i]?.publishedAt, anterior)).length;

    let estado;

    let variacion = null;

    if (!observabamosAnterior) {
      estado = ESTADOS_TENDENCIA.HISTORICO_INSUFICIENTE;
    } else if (enActual + enAnterior < umbrales.evidenciasParaTendencia) {
      estado = ESTADOS_TENDENCIA.MUESTRA_INSUFICIENTE;
    } else {
      /*
        Con base cero no se calcula una variacion relativa: dar
        «+infinito %» por una primera aparicion es exactamente
        el error que este gate tiene prohibido.
      */
      variacion = enAnterior === 0 ? null : (enActual - enAnterior) / enAnterior;

      if (variacion === null) estado = ESTADOS_TENDENCIA.CRECIENDO;
      else if (variacion > umbrales.umbralEstable) estado = ESTADOS_TENDENCIA.CRECIENDO;
      else if (variacion < -umbrales.umbralEstable) estado = ESTADOS_TENDENCIA.DISMINUYENDO;
      else estado = ESTADOS_TENDENCIA.ESTABLE;
    }

    return {
      temaId: id,
      tema: t.nombre || t.etiquetaPropuesta || t.termino || id,
      origenTema: origen,

      ventanaActual: { ...actual, evidencias: enActual },
      ventanaAnterior: { ...anterior, evidencias: enAnterior },

      variacionRelativa: variacion === null ? null : Number(variacion.toFixed(3)),

      estado,

      motivo:
        estado === ESTADOS_TENDENCIA.HISTORICO_INSUFICIENTE
          ? `La ventana anterior empieza el ${anterior.desde} y Sentinel empezó a observar el ${inicioObs || "—"}. No se puede comparar contra un periodo que no se observaba.`
          : estado === ESTADOS_TENDENCIA.MUESTRA_INSUFICIENTE
            ? `${enActual + enAnterior} evidencia(s) entre las dos ventanas: por debajo de ${umbrales.evidenciasParaTendencia} una variación no significa nada.`
            : enAnterior === 0
              ? "Sin evidencia en la ventana anterior. Se declara CRECIENDO sin variación relativa: dividir por cero daría un porcentaje inventado."
              : null
    };
  });

  const conTendencia = filas.filter(
    (f) =>
      f.estado === ESTADOS_TENDENCIA.CRECIENDO ||
      f.estado === ESTADOS_TENDENCIA.DISMINUYENDO ||
      f.estado === ESTADOS_TENDENCIA.ESTABLE
  );

  return {
    ventanaActual: actual,
    ventanaAnterior: anterior,

    inicioDeObservacion: inicioObs,
    observabamosLaVentanaAnterior: observabamosAnterior,

    filas: filas.sort((a, b) => b.ventanaActual.evidencias - a.ventanaActual.evidencias),

    metricas: {
      señales: filas.length,
      conTendenciaDeclarable: conTendencia.length,

      porEstado: filas.reduce((acc, f) => {
        acc[f.estado] = (acc[f.estado] || 0) + 1;

        return acc;
      }, {})
    },

    umbrales,

    declaraciones: [
      "Una tendencia exige haber observado LAS DOS ventanas. Comparar contra un periodo que no se observaba produciría un crecimiento inventado.",
      "Con base cero no se da variación relativa: «+infinito %» por una primera aparición no es información.",
      "Una sola publicación no sostiene una tendencia. Por debajo del mínimo declarado, MUESTRA_INSUFICIENTE.",
      "«Emergente» no se declara por una aparición nueva: puede ser nueva para nosotros y vieja en el territorio."
    ]
  };
}


/*
===========================================================
CRUCE BASICO — Gate C2, sin cambios

Se conserva tal cual: `routes/territorio.js` y las suites
`territorial-c2` y `-d` dependen de su forma exacta.
===========================================================
*/

export function cruzarTemaTerritorio({
  temas,
  descubiertos,
  ubicaciones,
  totalEvidencias
}) {
  const cruzar = (t, origen) => {
    const indices = t.indices || [];

    const mapa = new Map();

    let sinUbicar = 0;

    indices.forEach((i) => {
      const u = ubicaciones[i];

      if (!u?.unidadId) {
        sinUbicar += 1;
        return;
      }

      if (!mapa.has(u.unidadId)) {
        mapa.set(u.unidadId, {
          unidadId: u.unidadId,
          nombre: u.unidad || u.unidadId,
          nivel: u.nivel || null,
          evidencias: 0
        });
      }

      mapa.get(u.unidadId).evidencias += 1;
    });

    const territorios = [...mapa.values()].sort(
      (a, b) => b.evidencias - a.evidencias
    );

    return {
      temaId: t.id,
      tema: t.nombre || t.etiquetaPropuesta,
      origen,

      evidenciasTotales: indices.length,
      evidenciasGeolocalizadas: indices.length - sinUbicar,
      sinGeolocalizar: sinUbicar,

      territorios,

      declaracion: territorios.length
        ? `${indices.length - sinUbicar} de ${indices.length} evidencias del tema se pudieron ubicar. Las ${sinUbicar} restantes NO se reparten.`
        : `Ninguna de las ${indices.length} evidencias del tema se pudo ubicar: el tema no tiene presencia territorial atribuible, que no es lo mismo que no tenerla.`
    };
  };

  const filas = [
    ...temas.map((t) => cruzar(t, "clasificado")),
    ...descubiertos.map((t) => cruzar(t, "descubierto"))
  ];

  return {
    filas,

    metricas: {
      temas: filas.length,
      conTerritorio: filas.filter((f) => f.territorios.length > 0).length,
      sinTerritorio: filas.filter((f) => f.territorios.length === 0).length,
      evidenciasTotales: totalEvidencias
    },

    reglas: [
      "Solo se usan evidencias geolocalizables.",
      "Un tema NO se reparte territorialmente por poblacion.",
      "Una noticia sobre el canton NO se atribuye a sus parroquias.",
      "El numero de evidencias sin ubicar viaja siempre al lado del que si."
    ]
  };
}


export default {
  TERRITORIO_NO_RESUELTO,
  TIPOS_SENAL,
  clasificarSenal,
  toponimosDe,
  normalizarToponimo,
  ESTADOS_COBERTURA,
  ESTADOS_TENDENCIA,
  UMBRALES,
  normalizarEvidenciaMatriz,
  inicioDeObservacion,
  ventanaAnteriorComparable,
  construirMatriz,
  compararVentanas,
  cruzarTemaTerritorio
};
