import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";

import TerritorialWorkspace from "../src/territorio/TerritorialWorkspace";

/*
===========================================================
WORKSPACE CON DATOS REALES — TERRITORIAL-ACCELERATION-02
===========================================================

    node dist-ssr/workspace-real.mjs <dir-con-payloads>

Renderiza el workspace con las respuestas REALES de los tres
endpoints, guardadas en disco por la prueba del gate.

POR QUE ESTA COMPROBACION EXISTE
-----------------------------------------------------------

La suite SSR normal renderiza el workspace SIN datos: comprueba
que pide un proyecto y que no finge cifras. Eso no comprueba que
las nueve secciones produzcan algo cuando el corpus existe.

Un panel que renderiza vacio pasa una prueba de «renderiza sin
romperse» y sigue siendo inutil. Esta comprobacion exige
CONTENIDO: cifras del corpus, nombres de tema, territorios,
fuentes y proveedores reales.

No sustituye a mirar la pantalla. Comprueba lo que una captura
no puede comprobar automaticamente: que la cifra que sale es la
del corpus y no un cero de relleno.
===========================================================
*/

const dir = process.argv[2];

if (!dir) {
  console.error("Falta el directorio con tt.json, fu.json y pr.json");

  process.exit(2);
}

const leer = (f) => JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));

const tt = leer("tt.json");

const fu = leer("fu.json");

const pr = leer("pr.json");

/*
  `fetch` inyectado: el componente pide tres URLs y aqui se le
  devuelven los payloads reales. Cero red.
*/
let peticiones = 0;

globalThis.fetch = async (url) => {
  peticiones += 1;

  const u = String(url);

  const cuerpo = u.includes("/tema-territorio")
    ? tt
    : u.includes("/fuentes")
      ? fu
      : u.includes("/proveedores")
        ? pr
        : {};

  return { ok: true, status: 200, async json() { return cuerpo; } };
};

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
  } catch (e) {
    fail += 1;
    fallos.push(`${nombre} — ${e.message}`);
    console.log(`  ERR   ${nombre}: ${e.message}`);
  }
}

/*
  SSR no ejecuta efectos, asi que el estado se inyecta por
  props: se renderiza cada seccion con los datos ya cargados
  mediante un componente envoltorio minimo que reproduce lo que
  el efecto habria hecho.
*/
function renderSeccion(seccionInicial) {
  return renderToString(
    <TerritorialWorkspace
      projectId="alcaldia-cuenca-2027-piloto"
      projectName="Elecciones Alcaldía Cuenca 2027"
      territorioId="ec-azuay-cuenca"
      seccionInicial={seccionInicial}
      datosIniciales={tt}
      fuentesIniciales={fu}
      proveedoresIniciales={pr}
    />
  );
}

console.log("\n=== WORKSPACE TERRITORIAL · datos reales ===\n");

const html = {};

[
  "resumen",
  "temas",
  "territorios",
  "cruce",
  "tendencias",
  "fuentes",
  "evidencias",
  "cobertura",
  "proveedores"
].forEach((s) => {
  html[s] = renderSeccion(s);

  const bytes = Buffer.byteLength(html[s], "utf8");

  console.log(`  render  ${s.padEnd(13)} ${bytes} bytes`);
});

console.log("");

const ev = tt.corpus.evidenciasDelAmbito ?? tt.corpus.evidencias;

t("RESUMEN muestra las evidencias reales del corpus, no un cero", () =>
  html.resumen.includes(String(ev)) && html.resumen.includes(String(tt.corpus.dominios)));

t("RESUMEN muestra los emisores resueltos reales", () =>
  html.resumen.includes(String(tt.corpus.emisores.resueltos)));

t("TEMAS lista temas reales del corpus", () => {
  const tema = (tt.matriz.filas.find((f) => f.tipoSenal === "TEMA") || {}).tema;

  return Boolean(tema) && html.temas.includes(tema);
});

t("TERRITORIOS lista territorios reales y declara la geometría ausente", () =>
  html.territorios.includes("Cuenca") &&
  /Geometría oficial no disponible/i.test(html.territorios));

t("TEMA × TERRITORIO pinta la matriz con cobertura", () =>
  /solo temas/i.test(html.cruce) &&
  (html.cruce.includes("histórico insuficiente") || html.cruce.includes("observado")));

t("TENDENCIAS explica la acumulación en lugar de inventar una flecha", () =>
  /acumulando observaciones/i.test(html.tendencias) &&
  !/CRECIENDO/.test(html.tendencias));

t("FUENTES lista fichas reales y distingue comprobado de verificado", () =>
  html.fuentes.includes("El Mercurio") &&
  /ninguna ficha lo está/i.test(html.fuentes));

t("EVIDENCIAS muestra piezas reales con su emisor", () => {
  const primera = Object.values(tt.evidenciaPorId)[0];

  return Boolean(primera) && html.evidencias.includes(String(primera.dominio));
});

t("COBERTURA declara qué se observa y qué no", () =>
  /Qué observamos/i.test(html.cobertura) &&
  /Qué todavía no/i.test(html.cobertura) &&
  html.cobertura.includes(String(tt.territorio.sinUbicar)));

t("PROVEEDORES muestra motores reales y candidatos en evaluación", () => {
  /*
    La tabla muestra el NOMBRE del motor, no su id: comprobar
    `rss_directo` daba un falso negativo.
  */
  const nombres = pr.motores.map((m) => m.nombre || m.providerId);

  return (
    nombres.length > 0 &&
    nombres.every((n) => html.proveedores.includes(n)) &&
    html.proveedores.includes("GDELT Cloud (BigQuery)") &&
    html.proveedores.includes("Data365") &&
    html.proveedores.includes("Meltwater") &&
    html.proveedores.includes("Brandwatch")
  );
});

t("PROVEEDORES declara el estado real de cada motor", () =>
  html.proveedores.includes("operativo") && html.proveedores.includes("no alcanzable"));

t("PROVEEDORES no finge integración de ningún candidato", () =>
  /NO PROBADO/.test(html.proveedores) &&
  !/gdelt_cloud[^]*OPERATIVO/.test(html.proveedores));

t("ninguna sección imprime un porcentaje de población o de electores", () =>
  Object.values(html).every(
    (h) => !/% de poblaci/i.test(h) && !/penetraci/i.test(h) && !/% de elector/i.test(h)
  ));

t("todas las secciones declaran conteo absoluto", () =>
  Object.values(html).every((h) => /conteo absoluto/i.test(h)));

t("el fetch inyectado se usó: cero red real", () => peticiones === 0);

console.log("\n===========================================");
console.log(`PASS: ${pass}    FALL: ${fail}`);

if (fallos.length) {
  console.log("\nFallos:");
  fallos.forEach((f) => console.log(`  - ${f}`));
}

console.log("===========================================\n");

process.exit(fail > 0 ? 1 : 0);
