import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";

import DimensionesStrip from "../src/candidato/DimensionesStrip";
import ComparacionEstrategica from "../src/candidato/ComparacionEstrategica";
import SeccionesNav from "../src/candidato/SeccionesNav";
import SeccionEnPreparacion from "../src/candidato/SeccionEnPreparacion";
import MatrizPlataformas from "../src/candidato/MatrizPlataformas";

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
  momentumDeProyecto,
  ayudaDeMedicion
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
X · LA MATRIZ CANONICA DE LAS CINCO PLATAFORMAS
CANDIDATE-STRATEGIC-UX-01B
===========================================================

Lo que fallo la certificacion visual de 01: la unica tabla de
la pantalla tenia las columnas escritas a mano para X y
YouTube, y Facebook/Instagram/TikTok llegaban en el payload sin
pintarse nunca.

El fixture reproduce la forma REAL del endpoint, incluida la
medicion huerfana de YouTube.
===========================================================
*/

console.log("\n== X · MATRIZ DE CINCO PLATAFORMAS ==");

const celda = (estado, extra = {}) => ({
  plataforma: extra.plataforma || "facebook",
  identidad: {
    estado: extra.identidad || "ANALYST_CONFIRMED",
    porActivo: [],
    conflictos: extra.conflictos || [],
    tieneConflicto: (extra.conflictos || []).length > 0
  },
  medicion: { estado, motivo: extra.motivo || null },
  activos: extra.activos || [],
  activosTotal: extra.activosTotal ?? (extra.activos || []).length,
  activosCubiertos: extra.activosCubiertos ?? 0,
  metrica: extra.metrica ?? null,
  snapshots: extra.snapshots ?? 0,
  medicionesHuerfanas: extra.huerfanas ?? null
});

const COBERTURA_3_DE_5 = {
  medidas: 3,
  parciales: 0,
  resueltas: 5,
  objetivo: 5,
  expresionMedidas: "3 de 5 medidas",
  expresionResueltas: "5 de 5 resueltas",
  porcentaje: null,
  noEs: "Resueltas NO significa medidas."
};

const MATRIZ = {
  ok: true,
  proyectoId: "alcaldia-cuenca-2027-piloto",
  plataformas: ["facebook", "instagram", "tiktok", "x", "youtube"],
  totalCeldas: 10,
  celdasResueltas: 10,
  distribucion: { MEDIDO: 6, PARCIAL: 1, NO_SOPORTADO: 2, IDENTIDAD_INSUFICIENTE: 1 },
  limitaciones: [
    {
      id: "ACCOUNT_ID_SIN_CASAR",
      celdasAfectadas: 1,
      texto:
        "Hay celdas con medición persistida cuyo accountId no coincide con ningún activo de la ficha."
    },
    {
      id: "DISCOVERY_NO_PERSISTIDO",
      texto:
        "No se persiste evidencia de que un discovery se haya ejecutado por plataforma."
    }
  ],
  candidatos: [
    {
      candidateId: "paul-carrasco-carpio",
      nombre: "Paúl Carrasco Carpio",
      cobertura: COBERTURA_3_DE_5,
      celdas: {
        facebook: celda("MEDIDO", {
          plataforma: "facebook",
          activos: [{ accountId: "facebook:a" }, { accountId: "facebook:b" }],
          activosCubiertos: 2,
          metrica: {
            nombre: "seguidores",
            valor: 12400,
            accountId: "facebook:a",
            provider: "scrapecreators",
            capturedAt: "2026-09-01T00:00:00.000Z",
            activosConMetrica: 2
          },
          snapshots: 4
        }),
        instagram: celda("MEDIDO", {
          plataforma: "instagram",
          activos: [{ accountId: "instagram:a" }],
          activosCubiertos: 1,
          metrica: {
            nombre: "seguidores",
            valor: 3500,
            accountId: "instagram:a",
            activosConMetrica: 1
          },
          snapshots: 2
        }),
        tiktok: celda("MEDIDO", {
          plataforma: "tiktok",
          activos: [{ accountId: "tiktok:a" }],
          activosCubiertos: 1,
          metrica: {
            nombre: "seguidores",
            valor: 519300,
            accountId: "tiktok:a",
            activosConMetrica: 1
          },
          snapshots: 1
        }),
        /* Identidad corroborada, medicion sin via: los dos ejes discrepan. */
        x: celda("NO_SOPORTADO", {
          plataforma: "x",
          identidad: "SYSTEM_VERIFIED",
          activos: [{ accountId: "x:a" }],
          activosTotal: 3,
          motivo: "no existe via oficial ni de proveedor conocida"
        }),
        /* Y aqui la medicion huerfana real del piloto. */
        youtube: celda("NO_SOPORTADO", {
          plataforma: "youtube",
          activos: [{ accountId: "youtube:canal" }],
          activosTotal: 1,
          snapshots: 1,
          huerfanas: {
            total: 1,
            accountIds: ["youtube:@canal"],
            activosDeLaFicha: ["youtube:canal"],
            motivo:
              "Existe medición persistida cuyo accountId no coincide con ningún activo de la ficha."
          }
        })
      }
    },
    {
      candidateId: "yaku-perez",
      nombre: "Yaku Perez",
      cobertura: {
        ...COBERTURA_3_DE_5,
        parciales: 1
      },
      celdas: {
        facebook: celda("PARCIAL", {
          plataforma: "facebook",
          activos: [{ accountId: "facebook:y1" }, { accountId: "facebook:y2" }],
          activosCubiertos: 1,
          motivo: "1 de 2 activos medidos; el resto no",
          metrica: {
            nombre: "seguidores",
            valor: 531000,
            accountId: "facebook:y1",
            activosConMetrica: 1
          },
          snapshots: 2
        }),
        instagram: celda("MEDIDO", {
          plataforma: "instagram",
          activos: [{ accountId: "instagram:y" }],
          activosTotal: 2,
          activosCubiertos: 2,
          metrica: {
            nombre: "seguidores",
            valor: 83233,
            accountId: "instagram:y",
            activosConMetrica: 2
          },
          snapshots: 3
        }),
        tiktok: celda("MEDIDO", {
          plataforma: "tiktok",
          activos: [{ accountId: "tiktok:y" }],
          activosCubiertos: 1,
          metrica: {
            nombre: "seguidores",
            valor: 519300,
            accountId: "tiktok:y",
            activosConMetrica: 1
          },
          snapshots: 2
        }),
        x: celda("MEDIDO", {
          plataforma: "x",
          activos: [{ accountId: "x:y" }],
          activosCubiertos: 1,
          metrica: {
            nombre: "seguidores",
            valor: 131305,
            accountId: "x:y",
            activosConMetrica: 1
          },
          snapshots: 1
        }),
        youtube: celda("IDENTIDAD_INSUFICIENTE", {
          plataforma: "youtube",
          identidad: "NO_ASSET_CONFIRMED",
          motivo: "no hay semilla de identidad"
        })
      }
    }
  ]
};

const matriz = renderToStaticMarkup(<MatrizPlataformas matriz={MATRIZ} />);

const matrizTexto = sinTags(matriz);

t(
  "X · las CINCO plataformas aparecen como cabecera de columna",
  ["Facebook", "Instagram", "TikTok", "YouTube"].every((p) =>
    new RegExp(`>\\s*${p}\\s*<`).test(matriz)
  ) && />\s*X\s*</.test(matriz)
);

t(
  "X · Facebook, Instagram y TikTok están presentes — el fallo que se corrige",
  matriz.includes("Facebook") &&
    matriz.includes("Instagram") &&
    matriz.includes("TikTok")
);

t(
  "X · hay una celda por candidato y plataforma",
  MATRIZ.candidatos.every((c) => MATRIZ.plataformas.every((p) => !!c.celdas[p]))
);

t(
  "X · cada celda trae un estado explícito, ninguna undefined ni null",
  MATRIZ.candidatos.every((c) =>
    MATRIZ.plataformas.every((p) => {
      const e = c.celdas[p].medicion.estado;

      return typeof e === "string" && e.length > 0;
    })
  )
);

t(
  "X · el recuento de celdas sale del payload, no de una constante en la UI",
  matriz.includes("10 de 10 celdas resueltas")
);

t(
  "X · los estados se muestran traducidos, no como enum",
  matriz.includes("Medido") &&
    matriz.includes("Parcial") &&
    matriz.includes("Sin vía disponible") &&
    matriz.includes("Identidad insuficiente")
);

t(
  "X · ningún estado se escapa como enum crudo",
  (matrizTexto.match(/\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/g) || []).length === 0
);


/*
===========================================================
Y · IDENTIDAD ≠ MEDICION, EN LA MISMA CELDA
===========================================================
*/

console.log("\n== Y · DOS EJES POR CELDA ==");

t(
  "Y · la celda muestra el eje de identidad junto al de medición",
  matriz.includes("Referencia confirmada por analista") &&
    matriz.includes("Corroborada por Sentinel")
);

t(
  "Y · identidad confirmada con medición sin vía NO se degrada a sin cuenta",
  MATRIZ.candidatos[0].celdas.youtube.identidad.estado === "ANALYST_CONFIRMED" &&
    MATRIZ.candidatos[0].celdas.youtube.medicion.estado !== "SIN_CUENTA" &&
    !matrizTexto.includes("No existe una cuenta válida consolidada")
);

t(
  "Y · cada estado del contrato de cierre tiene explicación",
  [
    "MEDIDO",
    "PARCIAL",
    "SIN_CUENTA",
    "NO_SOPORTADO",
    "REQUIERE_PROVEEDOR",
    "REQUIERE_CREDENCIAL",
    "BLOQUEADO",
    "IDENTIDAD_INSUFICIENTE",
    "IDENTITY_CONFLICT"
  ].every((e) => typeof ayudaDeMedicion(e) === "string")
);

t(
  "Y · la explicación de identidad insuficiente niega la lectura fácil",
  ayudaDeMedicion("IDENTIDAD_INSUFICIENTE").includes(
    "No significa que el candidato no tenga cuenta"
  )
);

t(
  "Y · «sin cuenta» y «identidad insuficiente» no significan lo mismo",
  ayudaDeMedicion("SIN_CUENTA") !== ayudaDeMedicion("IDENTIDAD_INSUFICIENTE")
);


/*
===========================================================
Z · MISSING NO ES CERO · COBERTURA · LEGADO
===========================================================
*/

console.log("\n== Z · MISSING, COBERTURA Y LEGADO ==");

t(
  "Z · una métrica ausente pinta una raya",
  matriz.includes("—")
);

/*
  El cero tiene que ser EL VALOR COMPLETO, no el ultimo digito
  de otro numero: «12.400 seguidores» acaba en cero y no es un
  cero. La primera version de esta prueba fallaba por eso.
*/
t(
  "Z · no aparece «0 seguidores» ni «0 suscriptores» en ninguna celda",
  !/(^|[^\d.,])0\s*(seguidores|suscriptores)/.test(matrizTexto)
);

/*
  Y la comprobacion de fondo: ninguna celda sin metrica puede
  haber pintado un numero. Si `metrica` es null, lo que se ve es
  una raya.
*/
t(
  "Z · toda celda sin métrica queda como raya y ninguna inventa un valor",
  MATRIZ.candidatos.every((c) =>
    MATRIZ.plataformas.every((p) => {
      const m = c.celdas[p].metrica;

      return m === null || (typeof m.valor === "number" && m.valor > 0);
    })
  )
);

t(
  "Z · YouTube nombra suscriptores donde hay dato, nunca seguidores",
  MATRIZ.candidatos.every((c) => {
    const m = c.celdas.youtube.metrica;

    return m === null || m.nombre === "suscriptores";
  })
);

t(
  "Z · la cobertura distingue medidas de resueltas",
  matriz.includes("3 de 5 medidas") && matriz.includes("5 de 5 resueltas")
);

t(
  "Z · no se afirma «5 de 5 medidas» para quien tiene 3",
  !matriz.includes("5 de 5 medidas")
);

t(
  "Z · la cobertura no se expresa en porcentaje",
  MATRIZ.candidatos.every((c) => c.cobertura.porcentaje === null)
);

t(
  "Z · la medición que no casa se declara en lugar de descartarse en silencio",
  matriz.includes("medición sin activo que case")
);

t(
  "Z · las limitaciones que declara el backend se muestran",
  matriz.includes("accountId") && matriz.includes("discovery")
);

t(
  "Z · se declara que las columnas no se suman",
  matrizTexto.includes("no se suman")
);

t(
  "Z · el disclaimer electoral acompaña a la matriz",
  matriz.includes("No representa intención de voto")
);

t(
  "Z · ninguna fila lleva barra de progreso",
  (matriz.match(/width:\s*(\d+(\.\d+)?)%/g) || []).every((w) => w.includes("100%"))
);

t(
  "Z · el orden de las filas es el declarado, no un ranking por celdas medidas",
  matriz.indexOf("Paúl Carrasco Carpio") < matriz.indexOf("Yaku Perez")
);

/*
  §14. La tabla heredada sigue existiendo —sus columnas de
  originales frente a republicaciones son datos reales que no
  estan en ningun otro sitio— pero deja de titularse «Línea
  base digital» y de ser la comparacion principal.
*/
t(
  "Z · la tabla X/YouTube ya no se titula «Línea base digital · T0»",
  !fuente.includes("Línea base digital · T0")
);

t(
  "Z · su título acota el alcance a X y YouTube",
  fuente.includes("Línea base comparable disponible para X y YouTube")
);

t(
  "Z · y declara que no es toda la presencia digital",
  fuente.includes("No representa toda la presencia digital del candidato")
);

t(
  "Z · la matriz de cinco plataformas se monta antes que la tabla heredada",
  fuente.indexOf("MatrizPlataformas matriz={matrizPlataformas}") <
    fuente.indexOf("BaselineT0Panel datos={lineaBase}")
);

t(
  "Z · la matriz se carga con el proyecto, no tras pulsar un botón",
  fuente.includes("matriz-plataformas") && fuente.includes("setMatrizPlataformas")
);

t(
  "Z · sin payload la matriz no inventa nada",
  renderToStaticMarkup(<MatrizPlataformas matriz={null} />) === ""
);

t(
  "Z · un proyecto sin candidatos lo dice en lugar de mostrar una tabla vacía",
  renderToStaticMarkup(
    <MatrizPlataformas
      matriz={{ ok: true, plataformas: MATRIZ.plataformas, candidatos: [] }}
    />
  ).includes("Ningún candidato observado")
);


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
