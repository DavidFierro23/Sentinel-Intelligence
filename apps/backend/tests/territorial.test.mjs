// apps/backend/tests/territorial.test.mjs

import {
  resolverUbicacion,
  resolverLote
} from "../services/geo/geoResolver.js";

import { agregar } from "../services/geo/spatialAggregator.js";
import { normalizar } from "../services/geo/normalizer.js";
import { comprobarGeo1 } from "../services/geo/geoContracts.js";

import {
  estadoRegistro,
  denominadorDe,
  listarUnidades,
  unidadPorId,
  abrirRegistro
} from "../services/geo/territoryRegistry.js";

import { extraerTemas } from "../services/conversation/topicExtractor.js";
import { clasificarEncuadre } from "../services/conversation/framingClassifier.js";

import {
  contarMenciones,
  variantesDeNombre
} from "../services/conversation/actorMentions.js";

import { identificarFuente } from "../services/conversation/mediaRegistry.js";

import { planificarConsultas } from "../services/conversation/conversationHarvester.js";

/*
===========================================================
PRUEBAS DEL NUCLEO TERRITORIAL
===========================================================

    node tests/territorial.test.mjs

SIN RED Y SIN CUOTA. Todas las comprobaciones son
deterministas sobre entradas fijas: no consultan Google News,
no consultan SerpAPI y no dependen de que hoy se publique algo
sobre Cuenca.

Es deliberado. Una prueba que dependa de datos vivos falla el
dia que cambia la actualidad, y entonces deja de distinguirse
un fallo real de una noticia distinta.

Lo que SI se prueba con datos vivos —que los motores
responden— se comprueba aparte, contra el endpoint, y se
compara COMPORTAMIENTO, no numeros absolutos.

QUE CUBRE
-----------------------------------------------------------

  1. registro territorial y carencias declaradas
  2. GEO-1: nunca mas fino que el dato
  3. desambiguacion: interna vs externa, tildes, empates
  4. agregacion: sin ubicar, degradacion, umbral de muestra
  5. normalizacion: la regla dura sin denominador
  6. conversacion: temas, encuadre, menciones
  7. medios: cobertura y rescate de publicador
  8. planner: anclaje territorial obligatorio
===========================================================
*/

let pass = 0;

let fail = 0;

const fallos = [];

function t(nombre, comprobacion) {
  try {
    if (comprobacion()) {
      pass += 1;
      console.log(`  PASS  ${nombre}`);
    } else {
      fail += 1;
      fallos.push(nombre);
      console.log(`  FALL  ${nombre}`);
    }
  } catch (error) {
    fail += 1;
    fallos.push(`${nombre} (${error.message})`);
    console.log(`  ERR   ${nombre}: ${error.message}`);
  }
}

function bloque(titulo) {
  console.log(`\n${titulo}`);
}


const AMBITO = "ec-azuay-cuenca";

const FUENTE_LOCAL = { unidadId: AMBITO, resolucion: "canton" };

const FUENTE_NACIONAL = { unidadId: "ec", resolucion: "pais" };


/* ---------------------------------------------------------
   1. REGISTRO TERRITORIAL
--------------------------------------------------------- */

bloque("[1] REGISTRO TERRITORIAL");

const registro = estadoRegistro();

t("carga sin errores", () => registro.errores.length === 0);

t("41 unidades (39 administrativas + 2 sectores)", () => {
  return registro.metricas.unidades === 41;
});

t("36 parroquias", () => registro.metricas.porResolucion.parroquia === 36);

t("2 sectores: centro historico y cabecera cantonal", () => {
  return registro.metricas.porResolucion.sector === 2;
});

t("las carencias siguen declarandose", () => {
  const ids = registro.carencias.map((c) => c.id);

  return ["geometria", "padron", "verificacion"].every((x) => ids.includes(x));
});

t("solo el Centro Historico queda sin verificar", () => {
  return registro.metricas.sinVerificar === 1;
});

t("22 unidades con geometria oficial", () => {
  return registro.metricas.conGeometria === 22;
});

t("las 15 urbanas siguen SIN geometria", () => {
  const urbanas = listarUnidades({ tipo: "urbana" });

  return urbanas.length === 15 && urbanas.every((u) => !u.geometriaDisponible);
});


/* ---------------------------------------------------------
   1-BIS. DATOS OFICIALES — GATE A
--------------------------------------------------------- */

bloque("[1b] DATOS OFICIALES INTEGRADOS");

const RURALES = listarUnidades({ tipo: "rural" });

t("21 parroquias rurales", () => RURALES.length === 21);

t("las 21 rurales tienen geometria oficial", () => {
  return RURALES.every((u) => u.geometriaDisponible === true);
});

t("las 21 rurales tienen codigo DPA oficial", () => {
  return RURALES.every((u) => /^0101\d\d$/.test(String(u.codigoOficial)));
});

t("los codigos DPA son unicos", () => {
  const cods = RURALES.map((u) => u.codigoOficial);

  return new Set(cods).size === cods.length;
});

t("la cabecera cantonal tiene su codigo DPA 010150", () => {
  return unidadPorId("cuenca-cabecera")?.codigoOficial === "010150";
});

t("NINGUNA unidad de otro canton se colo", () => {
  const conCodigo = listarUnidades().filter((u) => u.codigoOficial);

  return conCodigo.every(
    (u) =>
      u.codigoOficial === "01" ||
      u.codigoOficial === "0101" ||
      String(u.codigoOficial).startsWith("0101")
  );
});

t("geometria en EPSG:4326, dentro del bbox de Cuenca", () => {
  const u = unidadPorId("molleturo");

  const pts = u.geometria.coordinates.flat();

  return pts.every(
    ([lon, lat]) => lon > -80 && lon < -78.5 && lat > -3.5 && lat < -2.3
  );
});

t("el CRS de origen queda declarado en la procedencia", () => {
  return /EPSG:32717/.test(registro.geometria?.metadata?.crsOrigen || "");
});

t("la procedencia declara institucion, URL, licencia y fecha", () => {
  const conali = (registro.fuentesOficiales || []).find(
    (f) => f.id === "conali-otp-2025"
  );

  return Boolean(
    conali &&
      /CONALI/.test(conali.institucion) &&
      /datosabiertos\.gob\.ec/.test(conali.url) &&
      /cc-by/i.test(conali.licencia) &&
      conali.fechaDescarga
  );
});

t("la simplificacion declara su error de area", () => {
  const s = registro.geometria?.metadata?.simplificacion;

  return Boolean(s?.toleranciaMetros && s?.errorAreaMedio && s?.errorAreaMaximo);
});

t("las 15 urbanas estan verificadas pese a no tener geometria", () => {
  const urbanas = listarUnidades({ tipo: "urbana" });

  return urbanas.every(
    (u) => u.verificado === true && u.geometriaDisponible === false
  );
});

t("cada urbana declara por que no tiene geometria", () => {
  return listarUnidades({ tipo: "urbana" }).every((u) =>
    Boolean(u.motivoSinGeometria)
  );
});

t("las urbanas NO inventan codigo DPA", () => {
  return listarUnidades({ tipo: "urbana" }).every(
    (u) => u.codigoOficial === null
  );
});

bloque("[1c] INEC — poblacion");

const POB_BANOS = denominadorDe("banos", "poblacionOficial");

t("poblacion rural disponible y verificada", () => {
  return POB_BANOS.disponible === true && POB_BANOS.verificado === true;
});

t("declara tipoDato CENSO, no proyeccion", () => POB_BANOS.tipoDato === "CENSO");

t("declara el anio 2022", () => POB_BANOS.anio === 2022);

t("declara el nivel territorial", () => POB_BANOS.nivel === "parroquia");

t("declara la fuente con institucion y URL", () => {
  return Boolean(POB_BANOS.fuente?.institucion && POB_BANOS.fuente?.url);
});

t("la restriccion de licencia viaja con el dato", () => {
  return POB_BANOS.usoComercialPermitido === false;
});

t("el bloque urbano declara nivel DISTINTO al de una parroquia", () => {
  return (
    denominadorDe("cuenca-cabecera", "poblacionOficial").nivel ===
    "bloque_urbano_agregado"
  );
});

t("una parroquia urbana NO tiene poblacion inventada", () => {
  const d = denominadorDe("el-batan", "poblacionOficial");

  return d.valor === null && d.disponible === false && Boolean(d.motivo);
});

t("la poblacion cantonal NO se repartio entre parroquias", () => {
  const suma = RURALES.map(
    (u) => denominadorDe(u.id, "poblacionOficial").valor || 0
  ).reduce((a, b) => a + b, 0);

  const cabecera = denominadorDe("cuenca-cabecera", "poblacionOficial").valor;

  /* 596 101 del censo 2022: rurales + bloque urbano, sin reparto. */
  return suma + cabecera === 596101;
});

bloque("[1d] CNE — bloqueado, no inventado");

const PAD = denominadorDe("banos", "padronElectoral");

t("padron sigue null", () => PAD.valor === null);

t("padron NO verificado", () => PAD.verificado === false);

t("declara estadoFuente acceso_oficial_bloqueado", () => {
  return PAD.estadoFuente === "acceso_oficial_bloqueado";
});

t("ninguna unidad tiene padron", () => {
  return registro.metricas.denominadoresConValor.padronElectoral === 0;
});

bloque("[1e] SUPERFICIE — calculada, no inventada");

t("superficie desde geometria oficial", () => {
  const s = denominadorDe("molleturo", "superficieKm2");

  return s.disponible && s.valor > 900 && s.valor < 1050;
});

t("superficie calculada en EPSG:32717, no en Web Mercator", () => {
  const denominadoresRaw = abrirRegistro().datos.denominadores;

  return denominadoresRaw["molleturo"].superficieKm2.calculadaEn === "EPSG:32717";
});

t("la superficie cuadra con la publicada por el GAD", () => {
  /*
    Cruce independiente: el CSV municipal publica el area de
    cada parroquia. Si mi calculo desde la geometria CONALI se
    aparta de el, una de las dos cosas esta mal.
    Molleturo GAD = 984 km2.
  */
  const s = denominadorDe("molleturo", "superficieKm2").valor;

  return Math.abs(s - 984) < 1.5;
});

t("sin geometria no hay superficie", () => {
  return denominadorDe("el-batan", "superficieKm2").disponible === false;
});


/* ---------------------------------------------------------
   2. GEO-1
--------------------------------------------------------- */

bloque("[2] GEO-1 — nunca mas fino que el dato");

t("dato de canton, se pide parroquia: BLOQUEA", () => {
  return (
    comprobarGeo1(
      { procedencia: "agregada", resolucion: "canton", unidadId: AMBITO },
      "parroquia"
    ).permitido === false
  );
});

t("...y degrada a canton, no descarta", () => {
  return (
    comprobarGeo1(
      { procedencia: "agregada", resolucion: "canton", unidadId: AMBITO },
      "parroquia"
    ).resolucionEfectiva === "canton"
  );
});

t("derivada NO habilita resolucion de punto", () => {
  return (
    comprobarGeo1(
      { procedencia: "derivada", resolucion: "parroquia", unidadId: "yanuncay" },
      "punto"
    ).permitido === false
  );
});

t("desconocida nunca se pinta", () => {
  return comprobarGeo1({ procedencia: "desconocida" }, "canton").permitido === false;
});

t("declarada en parroquia, se pide canton: permite (subir es seguro)", () => {
  return (
    comprobarGeo1(
      { procedencia: "declarada", resolucion: "parroquia", unidadId: "yanuncay" },
      "canton"
    ).permitido === true
  );
});


/* ---------------------------------------------------------
   3. DESAMBIGUACION
--------------------------------------------------------- */

bloque("[3] DESAMBIGUACION DE TOPONIMOS");

t("parroquia inequivoca resuelve", () => {
  return (
    resolverUbicacion({ titulo: "Obras en Yanuncay" }, { ambitoId: AMBITO })
      .unidadId === "yanuncay"
  );
});

t("procedencia es derivada, NUNCA declarada", () => {
  return (
    resolverUbicacion({ titulo: "Obras en Yanuncay" }, { ambitoId: AMBITO })
      .procedencia === "derivada"
  );
});

t("ambigua EXTERNA + fuente local: resuelve", () => {
  return (
    resolverUbicacion(
      { titulo: "Turistas llenan Banos" },
      { ambitoId: AMBITO, pistaDeFuente: FUENTE_LOCAL }
    ).unidadId === "banos"
  );
});

t("ambigua externa + fuente NACIONAL: no resuelve", () => {
  return (
    resolverUbicacion(
      { titulo: "Turistas llenan Banos" },
      { ambitoId: AMBITO, pistaDeFuente: FUENTE_NACIONAL }
    ).unidadId === null
  );
});

t("ambigua externa SIN fuente: no resuelve", () => {
  return (
    resolverUbicacion({ titulo: "Turistas llenan Banos" }, { ambitoId: AMBITO })
      .unidadId === null
  );
});

t("ambigua INTERNA + fuente local: NO resuelve (avenida Sucre)", () => {
  return (
    resolverUbicacion(
      { titulo: "Choque en la avenida Sucre deja dos heridos" },
      { ambitoId: AMBITO, pistaDeFuente: FUENTE_LOCAL }
    ).unidadId === null
  );
});

t("interna con contexto explicito: resuelve", () => {
  return (
    resolverUbicacion(
      { titulo: "La parroquia Sucre celebra su aniversario" },
      { ambitoId: AMBITO, pistaDeFuente: FUENTE_LOCAL }
    ).unidadId === "sucre"
  );
});

t("rio Machangara NO se atribuye a la parroquia", () => {
  return (
    resolverUbicacion(
      { titulo: "Contaminacion del rio Machangara preocupa" },
      { ambitoId: AMBITO, pistaDeFuente: FUENTE_LOCAL }
    ).unidadId === null
  );
});

t("tildes: Machangara == Machángara", () => {
  const a = resolverUbicacion(
    { titulo: "La parroquia Machángara estrena obra" },
    { ambitoId: AMBITO }
  );

  const b = resolverUbicacion(
    { titulo: "La parroquia Machangara estrena obra" },
    { ambitoId: AMBITO }
  );

  return a.unidadId === b.unidadId && a.unidadId === "machangara";
});

t("el nombre mostrado lleva su tilde", () => {
  return (
    resolverUbicacion(
      { titulo: "La parroquia Machángara estrena obra" },
      { ambitoId: AMBITO }
    ).unidad.nombre === "Machángara"
  );
});

t("forma inequivoca se resuelve sola, sin ambito", () => {
  return (
    resolverUbicacion(
      { titulo: "Santa Ana de los Rios de Cuenca celebra su fundacion" },
      {}
    ).unidadId === AMBITO
  );
});

t("empate entre parroquias sube al ancestro comun", () => {
  const r = resolverUbicacion(
    { titulo: "Cortes de agua en Yanuncay y Totoracocha" },
    { ambitoId: AMBITO }
  );

  return r.unidadId === AMBITO && r.procedencia === "agregada";
});

t("sector especial resuelve", () => {
  return (
    resolverUbicacion(
      { titulo: "Centro Historico de Cuenca con nueva peatonizacion" },
      { ambitoId: AMBITO }
    ).unidadId === "centro-historico"
  );
});

t("sin toponimo y sin fuente: sin ubicar", () => {
  return (
    resolverUbicacion(
      { titulo: "El candidato presento su plan de gobierno" },
      { ambitoId: AMBITO }
    ).procedencia === "desconocida"
  );
});


/* ---------------------------------------------------------
   4. AGREGACION
--------------------------------------------------------- */

bloque("[4] AGREGACION ESPACIAL");

const EVIDENCIAS = [
  { titulo: "Obras viales avanzan en Yanuncay" },
  { titulo: "Yanuncay reclama alcantarillado" },
  { titulo: "Vecinos de Yanuncay protestan" },
  { titulo: "Centro Historico de Cuenca con nueva peatonizacion" },
  { titulo: "Nota generica sin ninguna referencia" }
];

const resueltas = resolverLote(EVIDENCIAS, { ambitoId: AMBITO });

const agregado = agregar(resueltas, {
  resolucion: "parroquia",
  umbralMuestra: 2,
  ambitoId: AMBITO
});

t("los sin ubicar se cuentan, no se pierden", () => {
  return resueltas.metricas.sinUbicar === 1;
});

t("el total cuadra: ubicadas + sin ubicar", () => {
  return (
    resueltas.metricas.ubicadas + resueltas.metricas.sinUbicar ===
    EVIDENCIAS.length
  );
});

t("sector sin ancestro parroquia sube a canton", () => {
  return agregado.degradadas.some((d) => d.aResolucion === "canton");
});

t("unidad bajo umbral no se pinta", () => {
  return agregado.unidades.some(
    (u) => !u.sePinta && u.estado === "muestra_insuficiente"
  );
});

t("GEO-1 se declara aunque no bloquee nada", () => {
  return agregado.geo1.aplicada === true;
});

t("composicion de sectores declarada como prohibida", () => {
  return /Prohibida por construccion/.test(agregado.geo1.composicionDeSectores);
});

t("loQueNoSabemos nunca viene vacio", () => {
  return agregado.loQueNoSabemos.length > 0;
});

t("resolucion efectiva se declara", () => {
  return typeof agregado.coincideConLoPedido === "boolean";
});


/* ---------------------------------------------------------
   5. NORMALIZACION — LA REGLA DURA
--------------------------------------------------------- */

bloque("[5] NORMALIZACION — sin denominador no se calcula");

/*
  Este agregado solo contiene Yanuncay (urbana, sin poblacion)
  y Cuenca canton. Ninguno tiene denominador poblacional, asi
  que la normalizacion sigue bloqueada — ahora por AUSENCIA,
  no porque no exista el dato en el sistema.
*/
t("sin denominador en las unidades del agregado: bloqueada", () => {
  return normalizar(agregado, { modo: "poblacion" }).disponible === false;
});

t("no devuelve NINGUNA unidad calculada", () => {
  return normalizar(agregado, { modo: "poblacion" }).unidades.length === 0;
});

t("declara el motivo del bloqueo", () => {
  return Boolean(normalizar(agregado, { modo: "poblacion" }).motivo);
});

t("padron NO disponible (CNE bloqueado)", () => {
  return normalizar(agregado, { modo: "padron" }).disponible === false;
});

/*
  REGLA DE NIVEL. Un agregado que mezcle parroquias rurales con
  el bloque urbano tiene denominadores de DOS niveles, y no son
  comparables: uno cubre una parroquia y el otro quince.
*/
const agregadoMixto = {
  unidades: [
    { unidadId: "banos", nombre: "Baños", conteo: 10, sePinta: true },
    { unidadId: "molleturo", nombre: "Molleturo", conteo: 8, sePinta: true },
    {
      unidadId: "cuenca-cabecera",
      nombre: "Cuenca (area urbana)",
      conteo: 40,
      sePinta: true
    }
  ]
};

t("niveles mezclados: normalizacion BLOQUEADA", () => {
  return normalizar(agregadoMixto, { modo: "poblacion" }).disponible === false;
});

t("...y declara cuales son los niveles en conflicto", () => {
  return /nivel|niveles/i.test(
    normalizar(agregadoMixto, { modo: "poblacion" }).motivo || ""
  );
});

/*
  Mismo nivel: SI se puede normalizar. Es lo que demuestra que
  el bloqueo anterior es por incompatibilidad, no por incapacidad.
*/
const agregadoRural = {
  unidades: [
    { unidadId: "banos", nombre: "Baños", conteo: 10, sePinta: true },
    { unidadId: "molleturo", nombre: "Molleturo", conteo: 8, sePinta: true }
  ]
};

t("mismo nivel (rural): normalizacion DISPONIBLE", () => {
  return normalizar(agregadoRural, { modo: "poblacion" }).disponible === true;
});

t("...y calcula el valor correcto", () => {
  const n = normalizar(agregadoRural, { modo: "poblacion" });

  const banos = n.unidades.find((u) => u.unidadId === "banos");

  /* 10 evidencias / 21797 hab * 1000 = 0.459 */
  return Math.abs(banos.valorNormalizado - 0.459) < 0.01;
});

t("...declarando el denominador y su fuente", () => {
  const n = normalizar(agregadoRural, { modo: "poblacion" });

  const banos = n.unidades.find((u) => u.unidadId === "banos");

  return banos.denominador.valor === 21797 && Boolean(banos.denominador.fuente);
});

t("superficie SI disponible para las rurales", () => {
  return normalizar(agregadoRural, { modo: "area" }).disponible === true;
});

t("absoluto SI disponible", () => {
  return normalizar(agregado, { modo: "absoluto" }).disponible === true;
});

t("absoluto etiqueta su cuota como observada, no poblacional", () => {
  const n = normalizar(agregado, { modo: "absoluto" });

  return /NO de la poblacion/.test(n.unidades[0].etiquetaCuota);
});

t("denominador ausente devuelve null CON motivo", () => {
  const d = denominadorDe("yanuncay", "poblacion");

  return d.valor === null && d.disponible === false && Boolean(d.motivo);
});

t("bloqueo ofrece alternativa disponible", () => {
  return Boolean(normalizar(agregado, { modo: "poblacion" }).alternativaDisponible);
});


/* ---------------------------------------------------------
   6. CONVERSACION PUBLICA
--------------------------------------------------------- */

bloque("[6] CONVERSACION PUBLICA");

t("un MEDIO nunca se convierte en tema", () => {
  const r = extraerTemas(
    [
      { titulo: "Primera obra municipal", fuenteDeclarada: "El Mercurio" },
      { titulo: "Segunda obra municipal", fuenteDeclarada: "El Mercurio" },
      { titulo: "Tercera obra municipal", fuenteDeclarada: "El Mercurio" }
    ],
    { evidenciasPorTema: 2 }
  );

  return !r.temas.some((x) => /mercurio/i.test(x.nombre));
});

t("el TERRITORIO nunca se convierte en tema", () => {
  const r = extraerTemas(
    [
      { titulo: "Cuenca inaugura obra" },
      { titulo: "Cuenca aprueba plan" },
      { titulo: "Cuenca presenta informe" }
    ],
    { ambito: { nombre: "Cuenca" }, evidenciasPorTema: 2 }
  );

  return !r.temas.some((x) => /^cuenca/i.test(x.nombre));
});

t("cada tema explica por que sus evidencias estan juntas", () => {
  const r = extraerTemas(
    [
      { titulo: "Corte de agua potable afecta al sector" },
      { titulo: "Desabastecimiento de agua en la zona" },
      { titulo: "ETAPA anuncia corte de agua" }
    ],
    { evidenciasPorTema: 2 }
  );

  return r.temas.length > 0 && r.temas.every((x) => Boolean(x.explicacion));
});

t("sin senal lexica: no_determinable, NO neutro", () => {
  return clasificarEncuadre({ titulo: "Lo que ocurre por alli" }).encuadre ===
    "no_determinable";
});

t("lexico informativo sin carga: neutro", () => {
  return (
    clasificarEncuadre({
      titulo: "Sesion del concejo cantonal segun la agenda ordinaria"
    }).encuadre === "neutro"
  );
});

t("lexico de cuestionamiento: critico", () => {
  return (
    clasificarEncuadre({
      titulo: "Denuncian sobreprecio e irregularidades en el contrato"
    }).encuadre === "critico"
  );
});

t("senales contrapuestas se anulan: neutro", () => {
  return (
    clasificarEncuadre({
      titulo: "Inauguran la obra tras meses de reclamos"
    }).encuadre === "neutro"
  );
});

t("el encuadre nunca alcanza confianza 100", () => {
  return (
    clasificarEncuadre({
      titulo: "Denuncian corrupcion peculado sobreprecio y fraude"
    }).confianza <= 85
  );
});

t("el encuadre declara que califica el texto, no la persona", () => {
  return /no la persona/.test(
    clasificarEncuadre({ titulo: "Denuncian irregularidades graves" }).califica
  );
});

t("un apellido suelto no genera variantes", () => {
  return variantesDeNombre("Cordero").length === 0;
});

t("nombre + apellido si genera variantes", () => {
  return variantesDeNombre("Maria Cordero").length > 0;
});

t("un apellido suelto NO cuenta como mencion", () => {
  const r = contarMenciones([{ titulo: "Cordero opina sobre el tema" }], [
    { id: "a", nombre: "Maria Cordero" }
  ]);

  return r.actores[0].menciones === 0;
});

t("una mencion por evidencia, aunque el nombre se repita", () => {
  const r = contarMenciones(
    [{ titulo: "Maria Cordero y Maria Cordero", enlace: "https://x.com/a" }],
    [{ id: "a", nombre: "Maria Cordero" }]
  );

  return r.actores[0].menciones === 1;
});

t("el total viaja siempre con sus dominios distintos", () => {
  const r = contarMenciones(
    [{ titulo: "Maria Cordero presenta", enlace: "https://elmercurio.com.ec/a" }],
    [{ id: "a", nombre: "Maria Cordero" }]
  );

  return typeof r.actores[0].dominiosDistintos === "number";
});


/* ---------------------------------------------------------
   7. MEDIOS
--------------------------------------------------------- */

bloque("[7] REGISTRO DE MEDIOS");

t("dominio desconocido NO recibe cobertura", () => {
  return identificarFuente("https://sitio-desconocido.xyz/nota").cobertura === null;
});

t("medio local declara su cobertura", () => {
  return (
    identificarFuente("https://elmercurio.com.ec/nota").cobertura?.unidadId ===
    AMBITO
  );
});

t("agregador: rescata publicador por NOMBRE", () => {
  return (
    identificarFuente({
      enlace: "https://news.google.com/x",
      fuenteDeclarada: "El Mercurio"
    }).dominio === "elmercurio.com.ec"
  );
});

t("agregador: rescata publicador por DOMINIO", () => {
  return (
    identificarFuente({
      enlace: "https://news.google.com/x",
      fuenteDeclarada: "elmercurio.com.ec"
    }).tipo === "medio_local"
  );
});

t("el rescate por nombre se marca como tal", () => {
  return (
    identificarFuente({
      enlace: "https://news.google.com/x",
      fuenteDeclarada: "El Mercurio"
    }).resueltoPorNombre === true
  );
});

t("publicador fuera del catalogo NO recibe cobertura", () => {
  return (
    identificarFuente({
      enlace: "https://news.google.com/x",
      fuenteDeclarada: "Diario Que No Existe"
    }).cobertura === null
  );
});

t("ninguna entrada se presenta como verificada", () => {
  return identificarFuente("https://elmercurio.com.ec/x").verificado === false;
});


/* ---------------------------------------------------------
   8. PLANNER — ANCLAJE OBLIGATORIO
--------------------------------------------------------- */

bloque("[8] PLANNER TERRITORIAL");

const conAncla = planificarConsultas({
  ambito: { nombre: "Cuenca", ancestros: ["Azuay", "Ecuador"] }
});

const sinAncla = planificarConsultas({
  ambito: { nombre: "Cuenca", ancestros: [] }
});

t("nunca se emite el ambito a secas", () => {
  return !conAncla.some((c) => c.texto.trim().toLowerCase() === "cuenca");
});

t("la provincia entra como ancla principal", () => {
  return conAncla.some((c) => /Cuenca Azuay/i.test(c.texto));
});

t("el pais entra como ancla de respaldo", () => {
  return conAncla.some((c) => /Cuenca Ecuador/i.test(c.texto));
});

t("todas las consultas ancladas se marcan como tales", () => {
  return conAncla.every((c) => c.anclada === true);
});

t("sin ancestros TODAS se marcan sin anclar", () => {
  return sinAncla.every((c) => c.anclada === false);
});

t("sin ancestros se declara el aviso", () => {
  return sinAncla.every((c) => Boolean(c.aviso));
});

t("no hay consultas duplicadas", () => {
  const textos = conAncla.map((c) => c.texto.toLowerCase());

  return new Set(textos).size === textos.length;
});


/* ---------------------------------------------------------
   RESULTADO
--------------------------------------------------------- */

console.log("\n===========================================");
console.log(`PASS: ${pass}    FALL: ${fail}`);

if (fallos.length) {
  console.log("\nFallos:");
  fallos.forEach((f) => console.log(`  - ${f}`));
}

console.log("===========================================\n");

process.exit(fail > 0 ? 1 : 0);
