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
  denominadorDe
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

t("40 unidades", () => registro.metricas.unidades === 40);

t("36 parroquias", () => registro.metricas.porResolucion.parroquia === 36);

t("1 sector especial", () => registro.metricas.porResolucion.sector === 1);

t("las 4 carencias estan declaradas", () => {
  const ids = registro.carencias.map((c) => c.id).sort();

  return ["geometria", "padron", "poblacion", "verificacion"].every((x) =>
    ids.includes(x)
  );
});

t("ninguna unidad se presenta como verificada", () => {
  return registro.metricas.sinVerificar === 40;
});

t("ninguna unidad tiene geometria", () => {
  return registro.metricas.sinGeometria === 40;
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

t("poblacion NO disponible", () => {
  return normalizar(agregado, { modo: "poblacion" }).disponible === false;
});

t("poblacion no devuelve NINGUNA unidad calculada", () => {
  return normalizar(agregado, { modo: "poblacion" }).unidades.length === 0;
});

t("poblacion declara motivo", () => {
  return Boolean(normalizar(agregado, { modo: "poblacion" }).motivo);
});

t("padron NO disponible", () => {
  return normalizar(agregado, { modo: "padron" }).disponible === false;
});

t("superficie NO disponible", () => {
  return normalizar(agregado, { modo: "area" }).disponible === false;
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
