import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";

import DimensionesStrip from "../src/candidato/DimensionesStrip";
import ComparacionEstrategica from "../src/candidato/ComparacionEstrategica";
import SeccionesNav from "../src/candidato/SeccionesNav";
import SeccionEnPreparacion from "../src/candidato/SeccionEnPreparacion";

import {
  DIMENSIONES,
  PLATAFORMAS_PRINCIPALES,
  COBERTURA_DE_DATOS,
  DISCLAIMER,
  VOCABULARIO_PROHIBIDO,
  dimensionesDeCandidato,
  coberturaDeDatos,
  activosAdicionales,
  identidadDeActivo,
  corroboracionDeActivo,
  cambioDeInteligencia,
  momentumDeProyecto
} from "../src/candidato/dimensionesEstrategicas";

import { SECCIONES, seccionPorId } from "../src/candidato/secciones";

import { METRICA } from "../src/services/identidadCandidato";

/*
===========================================================
VERIFICACION DE RENDER — CANDIDATE ESTRATEGICO
CANDIDATE-STRATEGIC-UX-01
===========================================================

Fija como invariantes las decisiones de producto del gate.
Ninguna prueba toca la red.

La mayoria comprueban que algo NO esta: un ranking por
completitud, un cero inventado, un enum crudo. Eso es lo que un
rediseno posterior rompe en silencio, y lo que un test de
dominio no ve.

Los fixtures reproducen la forma REAL de los endpoints del
piloto —incluido el delta contaminado de `historico.ventanas`,
que existe para comprobar que NO se pinta—.

    npx vite build --config vite.candidate-ux.config.js
    node dist-ssr-cand/check.mjs [linea-base.json]
===========================================================
*/

let pass = 0;

let fail = 0;

const fallos = [];

const t = (nombre, condicion) => {
  if (condicion === true) {
    pass += 1;

    console.log(`  PASS  ${nombre}`);
  } else {
    fail += 1;

    fallos.push(nombre);

    console.log(`  FALL  ${nombre}`);
  }
};

const sinTags = (html) => html.replace(/<[^>]*>/g, "\n");


/*
-----------------------------------------------------------
FIXTURES — la forma real del piloto
-----------------------------------------------------------
*/

const BASE_COMPLETA = {
  candidateId: "yaku-perez",
  nombre: "Yaku Perez",
  estados: {
    x: "MEDIDO",
    youtube: "MEDIDO",
    instagram: "MEDIDO",
    facebook: "MEDIDO",
    tiktok: "MEDIDO"
  },
  cobertura: {
    medidas: 5,
    objetivo: 5,
    expresion: "5/5 plataformas objetivo medidas",
    plataformasMedidas: ["x", "youtube", "instagram", "facebook", "tiktok"],
    plataformasSinCuenta: [],
    plataformasNoMedidas: [],
    porcentaje: null,
    notaPorcentaje:
      "No se expresa en porcentaje a proposito: eso supondria que las cinco plataformas pesan igual."
  },
  comparabilidad: {
    estado: "COMPARABLE",
    plataformasComunes: ["x", "youtube", "instagram", "facebook", "tiktok"],
    faltan: [],
    motivo: "Medido en las mismas plataformas que la referencia."
  }
};

const BASE_PARCIAL = {
  candidateId: "juan-carlos-vega",
  nombre: "Juan Carlos Vega",
  estados: {
    x: "MEDIDO",
    youtube: "SIN_CUENTA",
    instagram: "MEDIDO",
    facebook: "SIN_CUENTA",
    tiktok: "MEDIDO"
  },
  cobertura: {
    medidas: 3,
    objetivo: 5,
    expresion: "3/5 plataformas objetivo medidas",
    plataformasMedidas: ["x", "instagram", "tiktok"],
    plataformasSinCuenta: ["youtube", "facebook"],
    plataformasNoMedidas: [],
    porcentaje: null
  },
  comparabilidad: {
    estado: "PARCIALMENTE_COMPARABLE",
    faltan: ["youtube", "facebook"],
    motivo: "No medido en youtube, facebook."
  }
};

/*
  El historico del piloto, con el defecto incluido. Los dos
  extremos son de CUENTAS DISTINTAS: 360 seguidores de una
  cuenta de Instagram y 29.413 de X. La ventana de 7 dias
  declara -29.053 y la de 30 declara +334 sobre periodos que
  comparten los mismos hechos.
*/
const INTELIGENCIA = {
  conversacion: {
    total: 147,
    planos: [
      { id: "A", clave: "candidato", nombre: "Publicado por el candidato", piezasObservadas: 14 },
      { id: "B", clave: "medios", nombre: "Publicado por medios", piezasObservadas: 63 }
    ],
    prohibicion:
      "Ninguna de estas cifras se puede expresar en personas."
  },
  medios: {
    dominiosDistintos: 23,
    locales: 1,
    regionales: 0,
    nacionales: 6,
    desconocidos: 7,
    loQueNoSabemos: ["7 dominio(s) fuera del catalogo."]
  },
  amplificacion: {
    ganada: { piezas: 133, hechosDistintos: 90, fuentesDistintas: 23 }
  },
  territorio: {
    total: 0,
    rechazados: 147,
    motivosDeRechazo: { "la evidencia no trae contrato de GEO-1": 147 },
    metodosProhibidos: ["ip", "dispositivo"],
    nota:
      "Ninguna evidencia trae contrato de GEO-1 todavia. Sin geolocalizacion verificada no se ubica nada."
  },
  historico: {
    total: 8,
    snapshots: [
      { accountId: "youtube:jotalloretv", platform: "youtube", capturedAt: "2026-08-26T14:30:03.719Z", followers: 26 },
      { accountId: "x:jotalloretv", platform: "x", capturedAt: "2026-08-28T18:16:20.615Z", followers: 29413 },
      { accountId: "instagram:jotalloretv", platform: "instagram", capturedAt: "2026-08-31T15:53:08.897Z", followers: 10822 },
      { accountId: "tiktok:jotalloretv", platform: "tiktok", capturedAt: "2026-08-31T17:30:20.346Z", followers: null },
      { accountId: "facebook:jotalloretv", platform: "facebook", capturedAt: "2026-08-31T17:47:20.121Z", followers: 55855 },
      { accountId: "instagram:lloretvaldivieso", platform: "instagram", capturedAt: "2026-09-01T23:09:02.343Z", followers: 360 },
      { accountId: "tiktok:jotalloretv", platform: "tiktok", capturedAt: "2026-09-01T23:52:15.596Z", followers: 29100 },
      { accountId: "instagram:lloretvaldivieso", platform: "instagram", capturedAt: "2026-09-03T20:39:35.311Z", followers: 360 }
    ],
    ventanas: [
      { id: "7d", estado: "COMPARABLE", comparable: true, delta: { followers: -29053, postsObserved: -5 } },
      { id: "30d", estado: "COMPARABLE", comparable: true, delta: { followers: 334, postsObserved: -3 } }
    ],
    metricas: { series: [{ metrica: "views", comparable: true, delta: 0 }] }
  }
};

const MOMENTUM_PROYECTO = {
  disponible: false,
  estado: "HISTORICO_INSUFICIENTE",
  motivo:
    "T0 es el primer punto. Delta, velocidad y aceleracion necesitan dos observaciones comparables."
};

const CANDIDATO = {
  id: "yaku-perez",
  nombre: "Yaku Perez",
  resumen: { huellaDigital: 63, cuentas: 8, medios: 10, evidenciasWeb: 34 }
};

const ACTIVOS_POR_PLATAFORMA = {
  facebook: [{ accountId: "facebook:a" }, { accountId: "facebook:b" }],
  instagram: [{ accountId: "instagram:a" }],
  x: [{ accountId: "x:a" }],
  tiktok: [{ accountId: "tiktok:a" }],
  youtube: [{ accountId: "youtube:a" }],
  linkedin: [{ accountId: "linkedin:a" }],
  web: [{ accountId: "web:a" }]
};

const real = process.argv[2] ? JSON.parse(readFileSync(process.argv[2], "utf8")) : null;


/* Las dimensiones de un candidato con todo cargado. */
const dimsCompletas = dimensionesDeCandidato({
  base: BASE_COMPLETA,
  inteligencia: INTELIGENCIA,
  momentum: MOMENTUM_PROYECTO
});

/* Y de uno cuya inteligencia todavia no se ha pedido. */
const dimsSinIntel = dimensionesDeCandidato({
  base: BASE_COMPLETA,
  inteligencia: null,
  momentum: MOMENTUM_PROYECTO
});

const strip = renderToStaticMarkup(<DimensionesStrip dimensiones={dimsCompletas} />);

const stripSinIntel = renderToStaticMarkup(
  <DimensionesStrip dimensiones={dimsSinIntel} />
);

const FILAS = [
  {
    candidateId: "yaku-perez",
    nombre: "Yaku Perez",
    comparabilidad: BASE_COMPLETA.comparabilidad,
    dimensiones: dimsCompletas,
    coberturaDeDatos: 63
  },
  {
    candidateId: "juan-carlos-vega",
    nombre: "Juan Carlos Vega",
    comparabilidad: BASE_PARCIAL.comparabilidad,
    dimensiones: dimensionesDeCandidato({
      base: BASE_PARCIAL,
      inteligencia: null,
      momentum: MOMENTUM_PROYECTO
    }),
    coberturaDeDatos: 45
  },
  {
    candidateId: "lloret",
    nombre: "Juan Cristóbal Lloret Valdivieso",
    comparabilidad: BASE_COMPLETA.comparabilidad,
    dimensiones: dimsCompletas,
    coberturaDeDatos: 68
  }
];

const comparacion = renderToStaticMarkup(<ComparacionEstrategica filas={FILAS} />);

const todo = strip + stripSinIntel + comparacion;


/*
===========================================================
A · «SOLIDEZ» YA NO ES EL KPI PRINCIPAL
===========================================================
*/

console.log("\n== A · SOLIDEZ NO ES KPI PRINCIPAL ==");

t(
  "A · la palabra «Solidez» no aparece en la vista estratégica",
  !/[Ss]olidez/.test(todo)
);

t(
  "A · la métrica compartida ya no se llama «Solidez»",
  METRICA.nombre === "Cobertura de datos" && METRICA.abreviado === "Cobertura de datos"
);

t(
  "A · no hay ningún «/100» como cifra destacada",
  !todo.includes("/100")
);


/*
===========================================================
B–C · COBERTURA DE DATOS ES UN INDICADOR TECNICO
===========================================================
*/

console.log("\n== B–C · COBERTURA DE DATOS ==");

t(
  "B · «Cobertura de datos» existe en la comparación",
  comparacion.includes("Cobertura de datos")
);

t(
  "B · va marcada como indicador técnico",
  comparacion.includes("indicador técnico")
);

t(
  "C · lleva su aclaración metodológica",
  comparacion.includes("No mide desempeño electoral")
);

t(
  "C · la aclaración niega explícitamente el desempeño electoral",
  COBERTURA_DE_DATOS.explicacion.includes("No mide desempeño electoral") &&
    COBERTURA_DE_DATOS.noEs.includes("intención de voto")
);

t(
  "C · no aparece en el bloque estratégico de la ficha",
  !strip.includes("Cobertura de datos")
);


/*
===========================================================
D–E · LA COMPARACION NO ES UN RANKING
===========================================================
*/

console.log("\n== D–E · LA COMPARACIÓN NO ORDENA POR COMPLETITUD ==");

/*
  El orden de las filas tiene que ser el de entrada. Si alguien
  vuelve a meter un `sort` por cobertura, Lloret (68) subiria a
  la primera fila y esta prueba falla.
*/
const ordenPintado = FILAS.map((f) => comparacion.indexOf(f.nombre));

t(
  "D · las filas conservan el orden declarado, no el de cobertura",
  ordenPintado.every((p, i) => p > 0 && (i === 0 || p > ordenPintado[i - 1]))
);

t(
  "D · el candidato con más cobertura (68) NO está primero",
  comparacion.indexOf("Yaku Perez") <
    comparacion.indexOf("Juan Cristóbal Lloret Valdivieso")
);

t(
  "D · se declara que el orden no es de posición",
  comparacion.includes("no hay") &&
    /orden de posición/.test(sinTags(comparacion))
);

/*
  NINGUNA BARRA DE PROGRESO.

  La antigua se dibujaba con un div de `width: N%` donde N era
  la cobertura. Buscar `width:\d+%` a secas da un falso positivo
  —la tabla es `width: 100%`—, asi que la prueba es la que
  importa de verdad: que NINGUN ancho dependa de los datos.

  Se pinta la misma comparacion con las coberturas permutadas.
  Si algun ancho codificara un valor, cambiaria.
*/
const anchos = (html) => (html.match(/width:\s*[^;"]+/g) || []).sort().join("|");

const comparacionPermutada = renderToStaticMarkup(
  <ComparacionEstrategica
    filas={FILAS.map((f, i) => ({
      ...f,
      coberturaDeDatos: [95, 5, 50][i]
    }))}
  />
);

t(
  "E · ningún ancho de la comparación depende de los datos",
  anchos(comparacion) === anchos(comparacionPermutada) &&
    anchos(comparacion).length > 0
);

t(
  "E · el único ancho porcentual es el del contenedor, no una barra",
  (comparacion.match(/width:\s*(\d+(\.\d+)?)%/g) || []).every((w) =>
    w.includes("100%")
  )
);

t(
  "E · no hay un score compuesto por candidato",
  !/[Ii]ndice|[Ss]core|[Pp]untaje|[Pp]untuaci/.test(sinTags(comparacion))
);


/*
===========================================================
F–G · MOMENTUM SIN HISTORIA
===========================================================
*/

console.log("\n== F–G · MOMENTUM ==");

const momentum = dimsCompletas.find((d) => d.id === "momentum");

t(
  "F · momentum se muestra como HISTÓRICO INSUFICIENTE",
  strip.includes("Histórico insuficiente")
);

t(
  "F · el estado técnico viaja para auditoría",
  momentum.estado === "HISTORICO_INSUFICIENTE" && momentum.valor === null
);

t(
  "G · momentum NO se inventa como 0",
  momentumDeProyecto(MOMENTUM_PROYECTO).valor === null
);

t(
  "G · momentum sin dato alguno tampoco da 0",
  momentumDeProyecto(null).valor === null &&
    momentumDeProyecto(null).estado === "HISTORICO_INSUFICIENTE"
);

t(
  "G · no aparece «estable» ni «neutral» como lectura de momentum",
  !/estable|neutral/i.test(sinTags(strip))
);


/*
===========================================================
H–I · PLATAFORMAS PRINCIPALES Y ACTIVOS ADICIONALES
===========================================================
*/

console.log("\n== H–I · PLATAFORMAS ==");

t(
  "H · las cinco plataformas principales son las de la metodología",
  PLATAFORMAS_PRINCIPALES.length === 5 &&
    ["facebook", "instagram", "tiktok", "x", "youtube"].every((p) =>
      PLATAFORMAS_PRINCIPALES.includes(p)
    )
);

t(
  "H · la presencia se expresa sobre las cinco, no sobre dos",
  dimsCompletas.find((d) => d.id === "presencia").unidad.includes("de 5 plataformas")
);

t(
  "I · LinkedIn NO entra en las plataformas principales",
  !PLATAFORMAS_PRINCIPALES.includes("linkedin")
);

const adicionales = activosAdicionales(ACTIVOS_POR_PLATAFORMA);

t(
  "I · LinkedIn y web se separan como activos adicionales",
  adicionales.length === 2 &&
    adicionales.some((a) => a.plataforma === "linkedin") &&
    adicionales.some((a) => a.plataforma === "web")
);

t(
  "I · los adicionales no se suman a la cobertura de las cinco",
  dimsCompletas.find((d) => d.id === "presencia").valor === 5
);


/*
===========================================================
J–K · IDENTIDAD ≠ MEDICION
===========================================================
*/

console.log("\n== J–K · IDENTIDAD vs MEDICIÓN ==");

const declarada = {
  relationshipToCandidate: "DECLARED_BY_ANALYST",
  verificationStatus: "NO_VERIFICADA"
};

t(
  "J · identidad y corroboración son dos ejes distintos",
  identidadDeActivo(declarada) !== null &&
    corroboracionDeActivo(declarada) !== null &&
    identidadDeActivo(declarada).texto !== corroboracionDeActivo(declarada).texto
);

t(
  "K · una cuenta declarada por analista se lee como confirmada por analista",
  identidadDeActivo(declarada).texto === "Referencia confirmada por analista"
);

t(
  "K · no se presenta como identidad falsa por no estar corroborada",
  !/falsa|incorrecta|inválida/i.test(identidadDeActivo(declarada).texto) &&
    identidadDeActivo(declarada).tono === "bien"
);

t(
  "K · la falta de corroboración se explica sin culpar al analista",
  corroboracionDeActivo(declarada).explica.includes(
    "No significa que la cuenta sea incorrecta"
  )
);


/*
===========================================================
L · VOCABULARIO PROHIBIDO
===========================================================
*/

console.log("\n== L · VOCABULARIO ==");

const textoVisible = sinTags(todo);

/*
  El disclaimer SI puede nombrar «intención de voto», porque su
  trabajo es negar esa lectura. Lo que no puede aparecer es como
  etiqueta de una cifra. Se comprueba por linea: una linea que
  contenga el termino tiene que contener tambien una negacion.
*/
const lineasSospechosas = textoVisible
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && VOCABULARIO_PROHIBIDO.some((v) => l.toLowerCase().includes(v)))
  .filter((l) => !/\bno\b|nunca|tampoco/i.test(l));

t(
  "L · ningún término electoral aparece sin negación",
  lineasSospechosas.length === 0
);

if (lineasSospechosas.length) console.log("      ", lineasSospechosas);

t(
  "L · ninguna cifra se etiqueta como aprobación o favorabilidad",
  !/aprobación|favorabilidad|preferencia electoral/i.test(
    textoVisible.replace(DISCLAIMER, "")
  )
);


/*
===========================================================
N · UN CANDIDATO SIN DATOS NO RECIBE UN SCORE
===========================================================
*/

console.log("\n== N · SIN DATOS ==");

const vacio = dimensionesDeCandidato({ base: null, inteligencia: null, momentum: null });

t(
  "N · sin línea base, ninguna dimensión trae un número",
  vacio.every((d) => d.valor === null)
);

t(
  "N · la presencia sin base declara SIN_DATOS, no 0",
  vacio.find((d) => d.id === "presencia").estado === "SIN_DATOS"
);

t(
  "N · sin cobertura calculada no se inventa un 0",
  coberturaDeDatos({ resumen: {} }) === null &&
    coberturaDeDatos(CANDIDATO) === 63
);

const stripVacio = renderToStaticMarkup(<DimensionesStrip dimensiones={vacio} />);

t(
  "N · la ficha vacía no pinta ningún cero",
  !/>0<|>\s0\s</.test(stripVacio)
);


/*
===========================================================
O–P · «INVESTIGACION COMPLETADA» Y EL CTA
===========================================================

El texto vive en `ProjectsModule`, que no se puede renderizar
aislado —necesita el backend—. Se comprueba sobre el fuente,
que es donde esta la afirmacion.
===========================================================
*/

console.log("\n== O–P · LENGUAJE DE ESTADO Y CTA ==");

const fuenteBruta = readFileSync(
  new URL("../src/components/ProjectsModule.jsx", import.meta.url),
  "utf8"
);

/*
  SE QUITAN LOS COMENTARIOS ANTES DE COMPROBAR.

  Los textos viejos siguen citados en los comentarios que
  explican por que cambiaron —eso es deliberado y hay que
  conservarlo—. Buscar sobre el fuente crudo daba un falso
  positivo: encontraba la cita, no la pantalla.
*/
const fuente = fuenteBruta
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ");

t(
  "O · ya no se pinta «Investigación completada»",
  !/Investigación completada/.test(fuente)
);

t(
  "O · el estado dice que la observación continúa",
  fuente.includes("● Observación activa")
);

t(
  "P · el CTA ya no dice «Actualizar investigación»",
  !/\?\s*"Actualizar investigación"/.test(fuente) &&
    fuente.includes('"Actualizar observación"')
);

t(
  "P · el primer CTA habla de observar, no de investigar",
  fuente.includes('"Observar candidato"')
);

t(
  "P · la línea base ya no se describe como «X y YouTube»",
  !/Lo observado en X y YouTube/.test(fuente)
);


/*
===========================================================
Q · EL DELTA CONTAMINADO NO SE USA
===========================================================

La prueba mas importante del gate.
===========================================================
*/

console.log("\n== Q · EL DELTA DE VENTANAS NO SE PINTA ==");

const cambio = cambioDeInteligencia(INTELIGENCIA);

t(
  "Q · el cambio no toma el valor de `ventanas[].delta`",
  cambio.valor !== -29053 && cambio.valor !== 334
);

t(
  "Q · el −29.053 no aparece en ninguna pantalla",
  !todo.includes("29.053") && !todo.includes("-29053") && !todo.includes("29053")
);

t(
  "Q · el cambio se expresa como recuento de activos reobservados",
  cambio.valor === 2 && cambio.unidad.includes("activos con más de una observación")
);

t(
  "Q · y se declara que NO es una tendencia",
  cambio.motivo.includes("no una tendencia")
);

t(
  "Q · con un solo snapshot por activo el cambio es HISTÓRICO INSUFICIENTE",
  cambioDeInteligencia({
    historico: {
      snapshots: [{ accountId: "x:a", followers: 10 }],
      metricas: { series: [] }
    }
  }).estado === "HISTORICO_INSUFICIENTE"
);


/*
===========================================================
R · TERRITORIO NO SE INVENTA
===========================================================
*/

console.log("\n== R · TERRITORIO ==");

const territorio = dimsCompletas.find((d) => d.id === "territorio");

t(
  "R · sin geolocalización verificada el territorio es SIN_DATOS",
  territorio.valor === null && territorio.estado === "SIN_DATOS"
);

t(
  "R · se da el motivo real del backend",
  /GEO-1|geolocalizaci/i.test(territorio.motivo)
);

t(
  "R · no se nombra ninguna parroquia ni cantón inventado",
  !/parroquia|Cuenca|Azuay/i.test(sinTags(strip))
);


/*
===========================================================
S · CONVERSACION Y MEDIOS
===========================================================
*/

console.log("\n== S · CONVERSACIÓN Y MEDIOS ==");

t(
  "S · la conversación se cuenta en piezas observadas",
  dimsCompletas.find((d) => d.id === "conversacion").valor === 147 &&
    dimsCompletas
      .find((d) => d.id === "conversacion")
      .unidad.includes("piezas observadas")
);

t(
  "S · los medios se cuentan en dominios distintos, no en piezas",
  dimsCompletas.find((d) => d.id === "medios").valor === 23 &&
    dimsCompletas.find((d) => d.id === "medios").unidad.includes("medios distintos")
);

t(
  "S · nada se expresa en personas ni en votantes",
  !/personas|votantes|ciudadanos opinan|la gente piensa/i.test(sinTags(todo))
);


/*
===========================================================
T · «SIN CALCULAR» ≠ «SIN DATOS»
===========================================================
*/

console.log("\n== T · NO CARGADO ==");

t(
  "T · una dimensión no pedida se marca sin calcular, no sin datos",
  stripSinIntel.includes("sin calcular") &&
    dimsSinIntel.find((d) => d.id === "conversacion").cargado === false
);

t(
  "T · y no afirma que no haya conversación observable",
  dimsSinIntel.find((d) => d.id === "conversacion").estado !== "SIN_EVIDENCIA"
);

t(
  "T · presencia y momentum sí están, porque vienen de la línea base",
  dimsSinIntel.find((d) => d.id === "presencia").cargado === true &&
    dimsSinIntel.find((d) => d.id === "momentum").cargado === true
);


/*
===========================================================
U · SUBNAVEGACION SIN PAGINAS FALSAS
===========================================================
*/

console.log("\n== U · SUBNAVEGACIÓN ==");

const nav = renderToStaticMarkup(
  <SeccionesNav seccion="resumen" onSeleccionar={() => {}} />
);

t(
  "U · las nueve secciones del gate están presentes",
  SECCIONES.length === 9 &&
    ["resumen", "comparacion", "redes", "contenido", "conversacion", "medios",
     "territorio", "historico", "evidencias"].every((id) =>
      SECCIONES.some((s) => s.id === id)
    )
);

t(
  "U · las que no existen se marcan en preparación",
  nav.includes("EN PREP.")
);

t(
  "U · las cuatro reales NO se marcan en preparación",
  ["resumen", "comparacion", "redes"].every(
    (id) => seccionPorId(id).estado === null
  )
);

const enPrep = renderToStaticMarkup(
  <SeccionEnPreparacion seccion={seccionPorId("conversacion")} />
);

t(
  "U · una sección declarada dice qué responderá",
  enPrep.includes("Responderá") && enPrep.includes("En preparación")
);

t(
  "U · y dice dónde vive hoy ese dato",
  enPrep.includes("Ver inteligencia")
);


/*
===========================================================
V · DISCLAIMER Y ENUMS
===========================================================
*/

console.log("\n== V · DISCLAIMER Y ESTADOS LEGIBLES ==");

t(
  "V · el disclaimer electoral se mantiene",
  DISCLAIMER.includes("No representa intención de voto") &&
    comparacion.includes("No representa intención de voto")
);

/*
  Ningun enum crudo en pantalla. Se buscan palabras en
  MAYUSCULAS_CON_GUION, que es la forma de los estados internos.
*/
const enumsCrudos = (sinTags(todo).match(/\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/g) || [])
  .filter((e) => e !== "GEO-1");

t(
  "V · ningún estado se muestra como enum crudo",
  enumsCrudos.length === 0
);

if (enumsCrudos.length) console.log("      ", [...new Set(enumsCrudos)]);

t(
  "V · las seis dimensiones del producto están declaradas",
  DIMENSIONES.length === 6 &&
    ["presencia", "conversacion", "medios", "territorio", "cambio", "momentum"].every(
      (id) => DIMENSIONES.some((d) => d.id === id)
    )
);

t(
  "V · cada dimensión declara la pregunta que responde",
  DIMENSIONES.every((d) => typeof d.pregunta === "string" && d.pregunta.includes("?"))
);


/*
===========================================================
W · SOBRE EL PAYLOAD REAL, SI SE PASA
===========================================================
*/

if (real) {
  console.log("\n== W · PAYLOAD REAL DE /linea-base ==");

  const cands = real.candidatos || [];

  t("W · el payload real trae candidatos", cands.length > 0);

  const dimsReales = cands.map((c) =>
    dimensionesDeCandidato({ base: c, inteligencia: null, momentum: real.momentum })
  );

  t(
    "W · ninguna presencia real se expresa en porcentaje",
    cands.every((c) => c.cobertura?.porcentaje == null)
  );

  t(
    "W · todas las presencias reales traen un valor medido",
    dimsReales.every((d) => d.find((x) => x.id === "presencia").valor != null)
  );

  t(
    "W · el momentum real es HISTÓRICO INSUFICIENTE",
    dimsReales.every(
      (d) => d.find((x) => x.id === "momentum").estado === "HISTORICO_INSUFICIENTE"
    )
  );

  const filasReales = cands.map((c) => ({
    candidateId: c.candidateId,
    nombre: c.nombre,
    comparabilidad: c.comparabilidad,
    dimensiones: dimensionesDeCandidato({
      base: c,
      inteligencia: null,
      momentum: real.momentum
    }),
    coberturaDeDatos: null
  }));

  const compReal = renderToStaticMarkup(<ComparacionEstrategica filas={filasReales} />);

  t("W · la comparación real no dice «Solidez»", !/[Ss]olidez/.test(compReal));

  t(
    "W · la comparación real no pinta barras",
    (compReal.match(/width:\s*(\d+(\.\d+)?)%/g) || []).every((w) =>
      w.includes("100%")
    )
  );

  t(
    "W · con los 7 candidatos reales el orden sigue siendo el declarado",
    filasReales
      .map((f) => compReal.indexOf(f.nombre))
      .every((p, i, arr) => p > 0 && (i === 0 || p > arr[i - 1]))
  );
}


/*
===========================================================
*/

console.log(`\n=========================================`);
console.log(`CANDIDATE ESTRATÉGICO — pass=${pass} fall=${fail}`);

if (fail) {
  console.log("\nFALLOS:");

  fallos.forEach((f) => console.log(`  · ${f}`));
}

console.log(`=========================================\n`);

process.exit(fail ? 1 : 0);
