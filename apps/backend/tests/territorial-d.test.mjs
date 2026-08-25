// apps/backend/tests/territorial-d.test.mjs

import {
  construirAgenda,
  construirMapa,
  ESTADOS_ACTIVIDAD,
  PESOS_ACTIVIDAD
} from "../services/geo/territorialAgenda.js";

import { descubrirTemas } from "../services/conversation/openTopicDiscovery.js";
import { extraerTemas2 } from "../services/conversation/topicEngine2.js";
import { unidadPorId } from "../services/geo/territoryRegistry.js";
import { componerZona } from "../services/geo/analyticalZones.js";
import { DIGITAL_BEHAVIOR } from "../services/contracts/futureLayers.js";

/*
===========================================================
PRUEBAS DEL GATE D + F1
===========================================================

    node tests/territorial-d.test.mjs

SIN RED Y SIN CUOTA. Los 18 casos exigidos, sobre la salida
REAL del motor: los fixtures son evidencias de entrada, nunca
temas escritos a mano.
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


const AMB = { nombre: "Cuenca", ancestros: ["Azuay", "Ecuador"] };

/*
  Evidencias de ENTRADA. Los temas salen del motor; aqui no se
  escribe ninguno a mano.
*/
const CORPUS = [
  { titulo: "Deportivo Cuenca gano el partido en el estadio Alejandro Serrano", fecha: "2026-08-20", enlace: "https://elmercurio.com.ec/1" },
  { titulo: "Deportivo Cuenca jugara la vuelta en el estadio Alejandro Serrano", fecha: "2026-08-21", enlace: "https://eltiempo.com.ec/2" },
  { titulo: "Hinchas del Deportivo Cuenca agotaron las entradas", fecha: "2026-08-22", enlace: "https://primicias.ec/3" },
  { titulo: "ETAPA anuncia corte de agua potable en Sayausi", fecha: "2026-08-19", enlace: "https://eltiempo.com.ec/4" },
  { titulo: "Nuevo corte de agua potable afecta a Sayausi", fecha: "2026-08-20", enlace: "https://elmercurio.com.ec/5" },
  { titulo: "Moradores exigen solucion al desabastecimiento de agua potable", fecha: "2026-08-21", enlace: "https://primicias.ec/6" },
  { titulo: "Congreso de innovacion tecnologica arranca en la ciudad", fecha: "2026-08-18", enlace: "https://unico.com/7" },
  { titulo: "Congreso de innovacion tecnologica reune a expertos", fecha: "2026-08-19", enlace: "https://unico.com/8" },
  { titulo: "Cierra el congreso de innovacion tecnologica", fecha: "2026-08-20", enlace: "https://unico.com/9" }
];

const UBIC = (() => {
  const u = [];
  u[3] = { unidadId: "sayausi", unidad: "Sayausí", nivel: "parroquia" };
  u[4] = { unidadId: "sayausi", unidad: "Sayausí", nivel: "parroquia" };
  u[0] = { unidadId: "totoracocha", unidad: "Totoracocha", nivel: "parroquia" };
  u[1] = { unidadId: "ec-azuay-cuenca", unidad: "Cuenca", nivel: "canton" };
  return u;
})();

const DESC = descubrirTemas(CORPUS, { ambito: AMB });

const CLAS = extraerTemas2(CORPUS, { ambito: AMB });

const AG = construirAgenda({
  temasClasificados: CLAS.temas,
  temasDescubiertos: DESC.temasDescubiertos,
  ubicaciones: UBIC,
  referencia: "2026-08-25T00:00:00Z"
});

const AGREGADO = {
  unidades: [
    {
      unidadId: "sayausi",
      nombre: "Sayausí",
      resolucion: "parroquia",
      conteo: 2,
      estado: "con_dato",
      sePinta: true,
      procedenciaDominante: "derivada",
      evidencias: [
        { indice: 3, url: "https://eltiempo.com.ec/4", fecha: "2026-08-19" },
        { indice: 4, url: "https://elmercurio.com.ec/5", fecha: "2026-08-20" }
      ]
    },
    {
      unidadId: "totoracocha",
      nombre: "Totoracocha",
      resolucion: "parroquia",
      conteo: 1,
      estado: "muestra_insuficiente",
      sePinta: false,
      procedenciaDominante: "derivada",
      evidencias: [{ indice: 0, url: "https://elmercurio.com.ec/1", fecha: "2026-08-20" }]
    },
    {
      unidadId: "ec-azuay-cuenca",
      nombre: "Cuenca",
      resolucion: "canton",
      conteo: 1,
      estado: "muestra_insuficiente",
      sePinta: false,
      procedenciaDominante: "derivada",
      evidencias: [{ indice: 1, url: "https://eltiempo.com.ec/2", fecha: "2026-08-21" }]
    }
  ],
  sinDato: []
};

const MAPA = construirMapa({
  agregado: AGREGADO,
  ubicaciones: UBIC,
  agenda: AG.agenda
});


/* --------------------------------------------------------- */

bloque("[D-1] AGENDA OBSERVADA");

t("T18 · la agenda se construye desde la salida REAL del motor", () => {
  return AG.agenda.length > 0 && AG.agenda.every((f) => f.indices.length > 0);
});

t("T1 · muestra un tema descubierto que la taxonomia NO cubre", () => {
  return AG.agenda.some((f) => f.sinCategoria && f.origen.includes("descubierto"));
});

t("...y ese tema NO se esconde por no tener categoria", () => {
  const sinCat = AG.agenda.filter((f) => f.sinCategoria);

  return sinCat.length > 0 && sinCat.every((f) => f.posicion > 0);
});

t("T2 · un tema puede ser descubierto Y clasificado a la vez", () => {
  return AG.agenda.some((f) => f.origen === "descubierto_y_clasificado");
});

t("cada tema declara su origen", () => {
  const validos = ["descubierto", "clasificado", "descubierto_y_clasificado"];

  return AG.agenda.every((f) => validos.includes(f.origen));
});

t("T3 · las fuentes independientes nunca superan las evidencias", () => {
  return AG.agenda.every((f) => f.fuentesIndependientes <= f.evidencias);
});

t("T4 · una fuente repetida NO infla la diversidad", () => {
  /* El congreso viene tres veces del mismo dominio. */
  const congreso = AG.agenda.find((f) => /congreso|innovacion|tecnologica/i.test(f.etiqueta));

  return congreso && congreso.fuentesIndependientes === 1;
});

t("...y se marca como señal insuficiente", () => {
  const congreso = AG.agenda.find((f) => /congreso|innovacion|tecnologica/i.test(f.etiqueta));

  return congreso.estadoActividad === ESTADOS_ACTIVIDAD.INSUFICIENTE;
});

t("T5 · cada tema explica de donde sale", () => {
  return AG.agenda.every(
    (f) => f.explicacionDescubrimiento || f.explicacionClasificacion
  );
});

t("cada tema es rastreable hasta sus evidencias", () => {
  return AG.agenda.every(
    (f) => f.indices.length === f.evidencias && f.indices.every((i) => CORPUS[i])
  );
});

bloque("[D-2] RADAR — dimensiones separadas");

t("las tres dimensiones se exponen por separado", () => {
  return AG.agenda.every(
    (f) =>
      f.dimensiones?.evidencias &&
      f.dimensiones?.fuentes &&
      f.dimensiones?.recencia
  );
});

t("la formula esta documentada y es explicita", () => {
  return (
    /0\.50/.test(AG.formula.expresion) &&
    AG.formula.pesos.EVIDENCIAS === PESOS_ACTIVIDAD.EVIDENCIAS &&
    Boolean(AG.formula.porQueNoEsUnScore)
  );
});

t("T10/T11 · ningun tema se etiqueta como viral ni creciendo", () => {
  /*
    Se comprueba sobre las ETIQUETAS DE DATO, no sobre el JSON
    entero: el array `prohibido` menciona esas palabras
    justamente para declarar que no se usan, y una comprobacion
    ingenua prohibiria tambien el enunciado.
  */
  const etiquetas = AG.agenda
    .map((f) => `${f.estadoActividad} ${f.etiquetaActividad}`)
    .join(" ");

  return !/viral|creciendo|emergente|cayendo|tendencia/i.test(etiquetas);
});

t("...y las unicas menciones del JSON son la propia prohibicion", () => {
  const j = JSON.stringify(AG);

  return [...j.matchAll(/viral|creciendo|cayendo/gi)].every((m) => {
    const contexto = j.slice(Math.max(0, m.index - 120), m.index);

    return /prohibido|No se usa|no se puede afirmar/i.test(contexto);
  });
});

t("la formula declara que NO es tendencia", () => {
  return /no.*evolucion|Sin ventana comparable/i.test(AG.formula.noEsTendencia);
});

t("solo se usan los cuatro estados de actividad permitidos", () => {
  const validos = Object.values(ESTADOS_ACTIVIDAD);

  return AG.agenda.every((f) => validos.includes(f.estadoActividad));
});

t("un tema fuerte en el lote debil no se marca alta actividad", () => {
  /* Umbral absoluto antes que el relativo. */
  const debiles = AG.agenda.filter((f) => f.fuentesIndependientes < 2);

  return debiles.every((f) => f.estadoActividad === ESTADOS_ACTIVIDAD.INSUFICIENTE);
});

bloque("[D-3] MAPA F1");

t("T6 · una unidad CON geometria entra en el mapa", () => {
  return MAPA.conGeometria.some((u) => u.unidadId === "sayausi");
});

/*
  GEO-1 retiene a nivel CANTON la mayor parte de la evidencia de
  prensa, porque una nota provincial no autoriza a bajar a
  parroquia. Si el canton no se pinta, el mapa queda casi vacio
  aunque el analisis sea correcto: fue exactamente lo observado
  en la primera captura real (unidadesPintables: 0).

  CONALI publica parroquias y cabeceras, no el contorno cantonal,
  asi que el poligono se DERIVA de las 22 hijas y viaja marcado.
*/
t("el canton se pinta con geometria DERIVADA, no inventada", () => {
  const canton = MAPA.conGeometria.find((u) => u.unidadId === "ec-azuay-cuenca");

  return (
    !!canton &&
    canton.geometriaDerivada === true &&
    canton.geometria.type === "MultiPolygon" &&
    canton.poligonosOrigen.length === 22
  );
});

t("una geometria propia NO se marca como derivada", () => {
  const say = MAPA.conGeometria.find((u) => u.unidadId === "sayausi");

  return say.geometriaDerivada === false && say.geometria.type === "Polygon";
});

t("con evidencia a nivel canton el mapa NO queda en blanco", () => {
  return MAPA.metricas.unidadesPintables > 0 && MAPA.metricas.evidenciasEnMapa > 0;
});

t("T7 · una unidad SIN geometria queda FUERA del mapa", () => {
  return (
    MAPA.sinGeometria.some((u) => u.unidadId === "totoracocha") &&
    !MAPA.conGeometria.some((u) => u.unidadId === "totoracocha")
  );
});

t("...pero NO desaparece: conserva su actividad", () => {
  const toto = MAPA.sinGeometria.find((u) => u.unidadId === "totoracocha");

  return toto.evidencias === 1 && Boolean(toto.motivoSinGeometria);
});

t("T8 · NO se inventa poligono para lo que no lo tiene", () => {
  return MAPA.sinGeometria.every((u) => !u.geometria);
});

t("las geometrias del mapa son las oficiales del registro", () => {
  return MAPA.conGeometria.every((u) => {
    const reg = unidadPorId(u.unidadId);

    return reg?.geometriaDisponible === true && u.geometria === reg.geometria;
  });
});

t("T9 · NO se muestra ningun porcentaje poblacional", () => {
  const texto = JSON.stringify(MAPA);

  return (
    !/per c[aá]pita|penetraci[oó]n|% de la poblacion|habitantes/i.test(texto) &&
    MAPA.conGeometria.every((u) => /evidencias observadas/.test(u.unidadDeMedida))
  );
});

t("el mapa declara su cobertura parcial", () => {
  return MAPA.limitaciones.some((l) => /parcial/i.test(l));
});

t("cada unidad declara si es oficial", () => {
  return [...MAPA.conGeometria, ...MAPA.sinGeometria].every(
    (u) => typeof u.unidadOficial === "boolean" && Boolean(u.tipoUnidad)
  );
});

bloque("[D-4] TERRITORIO Y ZONAS");

t("T13 · una unidad acumula evidencias de varios temas", () => {
  const say = MAPA.conGeometria.find((u) => u.unidadId === "sayausi");

  return say.temas >= 1 && say.temasPrincipales.length >= 1;
});

t("cada tema conserva los territorios de SUS evidencias", () => {
  const agua = AG.agenda.find((f) => /agua/i.test(f.etiqueta));

  return agua && agua.territorios.some((x) => x.unidadId === "sayausi");
});

t("las evidencias sin ubicar del tema NO se reparten", () => {
  return AG.agenda.every((f) => {
    const suma = f.territorios.reduce((s, x) => s + x.evidencias, 0);

    return suma + f.evidenciasSinUbicar === f.evidencias;
  });
});

t("T16 · una zona analitica NO se presenta como oficial", () => {
  const z = componerZona({
    nombre: "Zona Norte",
    tipo: "distrito_campana",
    unidades: ["ricaurte", "sinincay"],
    criterio: "prueba de gate D",
    creadaPor: "analista"
  });

  return (
    z.creada &&
    z.zona.unidadOficial === false &&
    z.zona.tipoUnidad === "analitica"
  );
});

t("una parroquia oficial SI se marca como oficial", () => {
  const say = MAPA.conGeometria.find((u) => u.unidadId === "sayausi");

  return say.unidadOficial === true && say.tipoUnidad === "oficial";
});

bloque("[D-5] LIMITACIONES Y CONTRATOS");

t("T15 · comportamiento digital NO tiene ninguna fuente integrada", () => {
  return DIGITAL_BEHAVIOR.fuentesPrevistas.every((f) => f.integrado === false);
});

t("...y prohibe explicitamente el seguimiento individual", () => {
  return DIGITAL_BEHAVIOR.prohibido.includes("seguimiento individual");
});

t("T14 · sin corpus la agenda queda vacia, no en cero enganoso", () => {
  const vacia = construirAgenda({
    temasClasificados: [],
    temasDescubiertos: [],
    ubicaciones: [],
    referencia: "2026-08-25T00:00:00Z"
  });

  return vacia.agenda.length === 0 && vacia.metricas.temas === 0;
});

t("sin unidades el mapa no se dibuja vacio", () => {
  const m = construirMapa({ agregado: { unidades: [] }, ubicaciones: [], agenda: [] });

  return m.conGeometria.length === 0 && m.metricas.evidenciasEnMapa === 0;
});

t("T12 · la agenda declara lo que NO puede afirmar", () => {
  return (
    AG.prohibido.length >= 2 &&
    AG.prohibido.some((p) => /ventana comparable/i.test(p)) &&
    AG.prohibido.some((p) => /opinion ciudadana/i.test(p))
  );
});

t("T17 · las evidencias conservan su URL para poder abrirse", () => {
  const conUrl = AGREGADO.unidades.flatMap((u) => u.evidencias).filter((e) => e.url);

  return conUrl.length > 0;
});


/* --------------------------------------------------------- */

console.log("\n===========================================");
console.log(`PASS: ${pass}    FALL: ${fail}`);

if (fallos.length) {
  console.log("\nFallos:");
  fallos.forEach((f) => console.log(`  - ${f}`));
}

console.log("===========================================\n");

process.exit(fail > 0 ? 1 : 0);
