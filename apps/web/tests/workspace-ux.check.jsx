import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";

import Sidebar from "../src/components/Sidebar";
import ProjectHeader from "../src/workspace/ProjectHeader";
import ResumenModule from "../src/workspace/ResumenModule";
import SentinelAIModule from "../src/workspace/SentinelAIModule";
import InvestigacionesModule from "../src/workspace/InvestigacionesModule";
import SinProyecto from "../src/workspace/SinProyecto";

import {
  MODULOS_PRIMARIOS,
  REDIRECCIONES,
  resolverModulo,
  moduloEsScoped,
  MODULO_POR_DEFECTO
} from "../src/workspace/moduleRegistry";

/*
===========================================================
VERIFICACION DE RENDER — WORKSPACE CONSOLIDADO
SENTINEL-UX-CONSOLIDATION-01
===========================================================

Comprueba las afirmaciones de este gate sobre el HTML real y
sobre el registro de modulos. Ninguna toca la red.

La mitad comprueban que algo NO esta: es lo que un rediseno
rompe en silencio.
===========================================================
*/

const PROYECTOS = [
  {
    id: "alcaldia-cuenca-2027-piloto",
    nombre: "Elecciones Alcaldía Cuenca 2027",
    canton: "Cuenca",
    provincia: "Azuay",
    pais: "Ecuador"
  },
  { id: "ensayo-tipos-1787962022520", nombre: "Ensayo tipos" }
];

const PROYECTO = PROYECTOS[0];

const home = process.argv[2] ? JSON.parse(readFileSync(process.argv[2], "utf8")) : null;

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
===========================================================
A · PROYECTO ACTIVO
===========================================================
*/

console.log("\n== A · PROYECTO ACTIVO ==");

const headerConProyecto = renderToStaticMarkup(
  <ProjectHeader
    proyectos={PROYECTOS}
    projectId={PROYECTO.id}
    proyecto={PROYECTO}
    ventana="7d"
  />
);

t(
  "A · el proyecto activo se ve en la franja de contexto",
  headerConProyecto.includes("Elecciones Alcaldía Cuenca 2027")
);

t(
  "A · el territorio del proyecto se muestra",
  headerConProyecto.includes("Cuenca") && headerConProyecto.includes("Azuay")
);

t(
  "A · las cinco ventanas estan disponibles",
  ["Hoy", "7D", "15D", "30D", "90D"].every((v) => headerConProyecto.includes(`>${v}<`))
);


/*
===========================================================
B · SIN PROYECTO
===========================================================
*/

console.log("\n== B · SIN PROYECTO ==");

const sinProyecto = renderToStaticMarkup(<SinProyecto hayProyectos seccion="resumen" />);

t(
  "B · sin proyecto se pide elegir uno",
  sinProyecto.includes("Selecciona un proyecto para comenzar")
);

t(
  "B · y se explica por que no hay vista general",
  /no existe/.test(sinTags(sinProyecto)) && /varios proyectos/.test(sinTags(sinProyecto))
);

t(
  "B · sin ningun proyecto se invita a crear uno",
  renderToStaticMarkup(<SinProyecto hayProyectos={false} />).includes(
    "Todavía no hay ningún proyecto"
  )
);

/* Las secciones analiticas exigen proyecto; Investigaciones no. */
t(
  "B · las secciones analiticas son project-scoped",
  ["resumen", "candidatos", "mapa", "media_pieza", "sentinel_ai"].every((m) =>
    moduloEsScoped(m)
  )
);

t("B · Investigaciones no exige proyecto", moduloEsScoped("investigaciones") === false);


/*
===========================================================
C · NAVEGACION PRIMARIA NUEVA
===========================================================
*/

console.log("\n== C · NAVEGACION PRIMARIA ==");

const sidebar = renderToStaticMarkup(<Sidebar activo="resumen" onSeleccionar={() => {}} />);

const textoSidebar = sinTags(sidebar);

["Resumen", "Candidatos", "Territorio", "Medios", "Investigaciones", "Sentinel AI"].forEach(
  (etiqueta) => {
    t(`C · «${etiqueta}» esta en la navegacion`, textoSidebar.includes(etiqueta));
  }
);

t("C · Configuracion sigue disponible, aparte", textoSidebar.includes("Configuración"));

t("C · seis destinos primarios", MODULOS_PRIMARIOS.length === 6);

t("C · el punto de entrada es Resumen", MODULO_POR_DEFECTO === "resumen");


/*
===========================================================
D/E/F · LO QUE SALE DE LA NAVEGACION PRIMARIA
===========================================================
*/

console.log("\n== D/E/F · FUERA DE LA NAVEGACION PRIMARIA ==");

t("D · War Room NO aparece en el menu", !textoSidebar.includes("War Room"));

t("E · Knowledge Graph NO aparece en el menu", !textoSidebar.includes("Knowledge Graph"));

t("F · Correlación Viva NO aparece en el menu", !textoSidebar.includes("Correlación Viva"));

/* Pero sus ids siguen llevando a algun sitio util. */
t(
  "D · war_room redirige a Resumen",
  resolverModulo("war_room").id === "resumen" && resolverModulo("war_room").redirigido
);

t(
  "E · knowledge_graph redirige a Investigaciones, vista relaciones",
  resolverModulo("knowledge_graph").id === "investigaciones" &&
    resolverModulo("knowledge_graph").seccion === "relaciones"
);

t(
  "F · correlacion redirige a Sentinel AI",
  resolverModulo("correlacion").id === "sentinel_ai"
);

t(
  "D/E/F · cada redireccion explica su motivo",
  Object.values(REDIRECCIONES).every((r) => typeof r.motivo === "string" && r.motivo.length > 30)
);

t(
  "un id desconocido no rompe: abre Resumen y lo dice",
  resolverModulo("inventado").id === "resumen" && resolverModulo("inventado").redirigido
);

t("un id vacio abre el destino por defecto", resolverModulo("").id === MODULO_POR_DEFECTO);


/*
===========================================================
G · RESUMEN
===========================================================
*/

console.log("\n== G · RESUMEN ==");

const resumen = renderToStaticMarkup(
  <ResumenModule projectId={PROYECTO.id} proyecto={PROYECTO} ventana="7d" />
);

const textoResumen = sinTags(resumen);

t("G · el Resumen pregunta «¿Qué está pasando?»", resumen.includes("¿Qué está pasando?"));

t("G · nombra el proyecto activo", resumen.includes("Elecciones Alcaldía Cuenca 2027"));

t(
  "G · los cinco bloques estan",
  ["Cambios y señales", "Candidatos", "Territorio", "Medios", "Evidencias"].every((b) =>
    textoResumen.includes(b)
  )
);

t(
  "G · sin proyecto el Resumen no pinta nada",
  renderToStaticMarkup(<ResumenModule projectId="" proyecto={null} />) === ""
);


/*
===========================================================
S/T/U · HONESTIDAD
===========================================================
*/

console.log("\n== S/T/U · HONESTIDAD ==");

t(
  "S · Cambios declara HISTORICO INSUFICIENTE en lugar de un cero",
  textoResumen.includes("Histórico insuficiente")
);

t(
  "S · y explica que no se muestra ningun porcentaje",
  /no es una tendencia/.test(textoResumen)
);

t(
  "T · no hay ningun porcentaje de avance inventado",
  !/\b\d{1,3}\s?%/.test(textoResumen)
);

t(
  "T · no hay flechas de tendencia fabricadas",
  !/[+−-]\s?0\s?%/.test(textoResumen)
);

t(
  "U · Momentum se declara sin sustituirlo por un score",
  textoResumen.includes("Momentum") && /dos ventanas comparables/.test(textoResumen)
);

t(
  "U · la resolucion territorial social se declara en calibracion",
  textoResumen.includes("En calibración") || textoResumen.includes("calibración")
);

/*
  La frase PUEDE aparecer: el Resumen la nombra para decir que
  Sentinel NO la afirma. Lo que no puede es aparecer afirmada.
  Se comprueba linea a linea, como en el check de Media con la
  palabra «influencia».
*/
/*
  La frase PUEDE aparecer: el Resumen la nombra para decir que
  Sentinel NO la afirma. Lo que no puede es aparecer afirmada.

  Se comprueba por FRASE y no por linea: el JSX parte el texto
  en varias lineas de codigo, asi que la negacion y la frase
  caen en lineas distintas y una comprobacion por linea daria
  un falso positivo. Es el mismo cuidado que en el check de
  Media con la palabra «influencia».
*/
const textoPlano = textoResumen.replace(/\s+/g, " ");

const idx = textoPlano.search(/conversación de Cuenca/i);

const contexto = idx >= 0 ? textoPlano.slice(Math.max(0, idx - 180), idx) : "";

t(
  "U · «la conversación de Cuenca» aparece solo negada, no afirmada",
  idx >= 0 && /no afirma/i.test(contexto)
);

t(
  "el disclaimer electoral esta visible en Candidatos",
  /No representa intención de voto/.test(textoResumen)
);

/* Ningun enum crudo en pantalla. */
const CRUDOS = [
  "HISTORICO_INSUFICIENTE",
  "COBERTURA_INSUFICIENTE",
  "EN_PREPARACION",
  "SIN_DATOS",
  "REQUIERE_CREDENCIAL",
  "EN_CALIBRACION"
];

CRUDOS.forEach((c) => {
  t(`U · «${c}» no se pinta crudo`, !textoResumen.includes(c));
});


/*
===========================================================
K/L · INVESTIGACIONES Y MAPA DE RELACIONES
===========================================================
*/

console.log("\n== K/L · INVESTIGACIONES ==");

const investigaciones = renderToStaticMarkup(
  <InvestigacionesModule investigacion={<div>NODO-OSINT</div>} />
);

const textoInv = sinTags(investigaciones);

t("K · Investigaciones abre", investigaciones.includes("Investigaciones"));

t("K · monta el nodo de investigacion existente", investigaciones.includes("NODO-OSINT"));

t("L · el Mapa de relaciones esta accesible aqui", textoInv.includes("Mapa de relaciones"));

/*
  La nota que explica de donde viene el mapa se muestra EN la
  vista de relaciones, que es donde el analista lo busca. En la
  vista de hallazgos seria ruido, asi que se comprueba donde
  corresponde.
*/
const invRelaciones = sinTags(
  renderToStaticMarkup(
    <InvestigacionesModule investigacion={<div>X</div>} vistaInicial="relaciones" />
  )
);

t(
  "L · en la vista de relaciones se explica que era el Knowledge Graph",
  /Knowledge Graph/.test(invRelaciones)
);

t(
  "las secciones sin motor se declaran, no se simulan",
  textoInv.includes("En preparación") &&
    ["Contraste / Lado B", "Narrativas", "Crisis", "Expedientes"].every((x) =>
      textoInv.includes(x)
    )
);

t(
  "abrir por la vista relaciones respeta la vista pedida",
  renderToStaticMarkup(
    <InvestigacionesModule investigacion={<div>X</div>} vistaInicial="relaciones" />
  ).includes("vista de la investigación")
);


/*
===========================================================
M · SENTINEL AI
===========================================================
*/

console.log("\n== M · SENTINEL AI ==");

const ai = renderToStaticMarkup(<SentinelAIModule proyecto={PROYECTO} />);

const textoAi = sinTags(ai);

t("M · Sentinel AI abre", ai.includes("Sentinel AI"));

t("M · declara que esta en preparacion", textoAi.includes("En preparación"));

t("M · la caja de consulta esta desactivada", ai.includes("disabled"));

t(
  "M · no hay ninguna respuesta generada",
  !/según Sentinel|la respuesta es|hemos detectado/i.test(textoAi)
);

t(
  "M · declara los cinco ejes con su estado real",
  ["Candidato", "Territorio", "Medios", "Tiempo", "Evidencia"].every((e) =>
    textoAi.includes(e)
  )
);

t(
  "M · y explica por que la caja no acepta consultas",
  /no hay motor detrás/.test(textoAi)
);


/*
===========================================================
D · MEDIOS CON DATOS REALES, SI SE PASA EL PAYLOAD
===========================================================
*/

if (home) {
  console.log("\n== D · MEDIOS EN EL RESUMEN, CON DATOS REALES ==");

  const conMedia = renderToStaticMarkup(
    <ResumenModule projectId={PROYECTO.id} proyecto={PROYECTO} ventana="7d" />
  );

  /*
    El Resumen pide sus datos por fetch, que el render de
    servidor no ejecuta. Lo que se comprueba aqui es que el
    payload real tiene la forma que el bloque de Medios consume:
    si el contrato cambiara, el bloque quedaria vacio en el
    navegador sin que nada fallara.
  */
  t("D · el payload real trae el resumen de Medios", Boolean(home.resumen));

  t(
    "D · con las cifras que el bloque de Medios lee",
    ["piezasEnCorpus", "piezasObservadas", "fuentesDistintas", "medios"].every(
      (k) => home.resumen[k] && "valor" in home.resumen[k]
    )
  );

  t("D · y el ranking con su titulo", Boolean(home.presencia?.titulo));

  t(
    "D · las cifras del ranking NO se hardcodean en la UI",
    !conMedia.includes("103") && !conMedia.includes("90 piezas")
  );
}


console.log(`\nPASS: ${pass}    FALL: ${fail}`);

if (fail > 0) {
  console.log("\nFALLOS:");

  fallos.forEach((f) => console.log(`  - ${f}`));

  process.exit(1);
}
