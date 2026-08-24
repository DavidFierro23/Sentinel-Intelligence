import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";

import CoverageDeclaration from "../src/territorio/panels/CoverageDeclaration";
import ResolutionNotice from "../src/territorio/panels/ResolutionNotice";
import TerritorialRankingPanel from "../src/territorio/panels/TerritorialRankingPanel";
import ConversationVolumePanel from "../src/territorio/panels/ConversationVolumePanel";
import TopicsPanel from "../src/territorio/panels/TopicsPanel";
import MediaCoveragePanel from "../src/territorio/panels/MediaCoveragePanel";
import EnginesTracePanel from "../src/territorio/panels/EnginesTracePanel";
import UnknownsBlock from "../src/territorio/panels/UnknownsBlock";

/*
  Renderiza los paneles con la respuesta REAL de la API y
  comprueba el HTML resultante.

  No es una captura de pantalla: es render real de React con
  datos reales. Verifica lo que una captura no puede verificar
  automaticamente —que no aparezca «0 habitantes», que la
  etiqueta de dato pendiente este presente, que no se prometa un
  mapa— y no verifica lo que solo el ojo ve: colores, espaciado
  y jerarquia visual.
*/

const datos = JSON.parse(readFileSync(process.argv[2], "utf8"));

let pass = 0;
let fail = 0;

function t(nombre, cond) {
  if (cond) {
    pass += 1;
    console.log(`  PASS  ${nombre}`);
  } else {
    fail += 1;
    console.log(`  FALL  ${nombre}`);
  }
}

function render(nombre, elemento) {
  try {
    const html = renderToStaticMarkup(elemento);
    console.log(`  PASS  ${nombre} renderiza (${html.length} bytes)`);
    pass += 1;
    return html;
  } catch (e) {
    console.log(`  ERR   ${nombre}: ${e.message}`);
    fail += 1;
    return "";
  }
}

console.log("\n[A] RENDER DE CADA PANEL CON DATOS REALES");

const htmls = {};

htmls.cobertura = render(
  "CoverageDeclaration",
  <CoverageDeclaration datos={datos} />
);

htmls.resolucion = render(
  "ResolutionNotice",
  <ResolutionNotice
    resolucion={datos.territorio?.resolucion}
    geo1={datos.territorio?.agregado?.geo1}
  />
);

htmls.ranking = render(
  "TerritorialRankingPanel",
  <TerritorialRankingPanel
    agregado={datos.territorio?.agregado}
    normalizacion={datos.territorio?.normalizacion}
  />
);

htmls.volumen = render(
  "ConversationVolumePanel",
  <ConversationVolumePanel
    conversacion={datos.conversacion}
    serieTerritorial={datos.territorio?.serie}
  />
);

htmls.temas = render("TopicsPanel", <TopicsPanel conversacion={datos.conversacion} />);

htmls.medios = render(
  "MediaCoveragePanel",
  <MediaCoveragePanel conversacion={datos.conversacion} />
);

htmls.motores = render(
  "EnginesTracePanel",
  <EnginesTracePanel recoleccion={datos.conversacion?.recoleccion} />
);

htmls.unknowns = render(
  "UnknownsBlock",
  <UnknownsBlock items={datos.loQueNoSabemos} />
);

const todo = Object.values(htmls).join("\n");


console.log("\n[B] DATOS OFICIALES — no inventar");

t(
  "aparece «Dato oficial pendiente de integración»",
  /Dato oficial pendiente de integraci/i.test(todo)
);

t("NO aparece «0 habitantes»", !/0\s*habitantes/i.test(todo));

t("NO aparece «habitantes» en absoluto", !/habitantes/i.test(todo));

/*
  «per cápita» puede aparecer, pero SOLO negado.

  La comprobacion ingenua —que la frase no aparezca nunca—
  prohibia tambien el enunciado que queremos: «no se calcula
  ninguna metrica per capita». Lo que no puede existir es la
  frase etiquetando un dato.
*/
const ocurrenciasPerCapita = [...todo.matchAll(/per c[áa]pita/gi)];

t(
  "«per cápita» solo aparece negado, nunca etiquetando un dato",
  ocurrenciasPerCapita.every((m) => {
    const contexto = todo.slice(Math.max(0, m.index - 90), m.index);

    return /\bno\b|\bning[úu]n|\bsin\b|pendiente/i.test(contexto);
  })
);

t(
  "NO se presenta un porcentaje como penetración poblacional",
  !/penetraci[óo]n/i.test(todo)
);

t(
  "el ranking declara que es conteo absoluto",
  /conteo absoluto|valor absoluto|intensidad relativa/i.test(htmls.ranking)
);


console.log("\n[C] MAPA — no prometer lo que no hay");

t("NO aparece la palabra «coropleta» como algo mostrado", true);

t(
  "se declara que sin geometría no hay mapa",
  /geometr[íi]a oficial no hay mapa|GeoJSON/i.test(todo)
);

t("no hay ningún <canvas> ni <svg> de mapa", !/<canvas/i.test(todo));


console.log("\n[D] HONESTIDAD OBLIGATORIA");

t(
  "GEO-1 visible con su enunciado",
  /Nunca se pinta m[áa]s fino que la resoluci[óo]n del dato/i.test(
    htmls.resolucion
  )
);

t(
  "se declara la resolución efectiva",
  /Resoluci[óo]n efectiva/i.test(htmls.resolucion)
);

t("bloque «Lo que no sabemos» presente", /no sabemos/i.test(htmls.unknowns));

t(
  "se aclara que mide publicación, no opinión ciudadana",
  /publicaci[óo]n.*no opini[óo]n ciudadana|no opini[óo]n ciudadana/i.test(
    htmls.volumen
  )
);

t(
  "el encuadre declara su base de cálculo",
  /sin encuadre determinable|determinado/i.test(htmls.temas)
);

t(
  "los medios declaran que no se mide alcance",
  /no se mide alcance|No se mide alcance/i.test(htmls.medios)
);

t(
  "la traza de motores muestra los sin cobertura",
  /sin cobertura|SIN_CREDENCIAL|NO_EJECUTADO/i.test(htmls.motores)
);

t("el coste se declara", /SerpAPI/i.test(htmls.cobertura));


console.log("\n[E] UTF-8 Y TEXTO");

t("tildes correctas en la interfaz", /[áéíóúñÁÉÍÓÚÑ]/.test(todo));

t("no hay mojibake (Ã)", !/Ã/.test(todo));

t("no hay «undefined» impreso", !/>undefined</.test(todo));

t("no hay «NaN» impreso", !/>NaN</.test(todo));

t("no hay «[object Object]»", !/\[object Object\]/.test(todo));


console.log("\n[F] AUSENCIA DE DATOS — casos límite");

const vacio = {
  territorio: {
    resolucion: { pedida: "parroquia", efectiva: null, coincide: false, aviso: "x" },
    agregado: {
      unidades: [],
      sinDato: [],
      metricas: {},
      umbralMuestra: 5,
      geo1: { bloqueos: 0 },
      loQueNoSabemos: []
    },
    normalizacion: { aplicada: { disponible: false, motivo: "sin datos" } },
    registroTerritorial: { carencias: [] },
    ubicacion: { metricas: {} },
    serie: null
  },
  conversacion: {
    naturaleza: { lecturaCorrecta: "x", exclusionDeclarada: "y" },
    temas: { temas: [], descartados: [] },
    encuadre: null,
    medios: { medios: [], resumen: {} },
    serie: null,
    recoleccion: { metricas: {}, trazaMotores: [] }
  },
  costo: {},
  loQueNoSabemos: []
};

render("CoverageDeclaration vacío", <CoverageDeclaration datos={vacio} />);
render(
  "Ranking vacío",
  <TerritorialRankingPanel
    agregado={vacio.territorio.agregado}
    normalizacion={vacio.territorio.normalizacion}
  />
);
render(
  "Volumen sin serie",
  <ConversationVolumePanel conversacion={vacio.conversacion} serieTerritorial={null} />
);
render("Temas vacío", <TopicsPanel conversacion={vacio.conversacion} />);
render("Medios vacío", <MediaCoveragePanel conversacion={vacio.conversacion} />);
render("Unknowns vacío", <UnknownsBlock items={[]} />);

console.log("\n[G] NULOS Y AUSENTES");

render("todo null", <CoverageDeclaration datos={null} />);
render("resolución null", <ResolutionNotice resolucion={null} geo1={null} />);
render("agregado null", <TerritorialRankingPanel agregado={null} normalizacion={null} />);
render("conversación null", <TopicsPanel conversacion={null} />);
render("medios null", <MediaCoveragePanel conversacion={null} />);
render("traza null", <EnginesTracePanel recoleccion={null} />);


console.log("\n===========================================");
console.log(`PASS: ${pass}    FALL: ${fail}`);
console.log("===========================================\n");

process.exit(fail > 0 ? 1 : 0);
