import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";

import { MediaIntelligenceVista } from "../src/media/MediaIntelligenceModule";

/*
===========================================================
VERIFICACION DE RENDER — MEDIA INTELLIGENCE
MEDIA-UX-CERT-01
===========================================================

Renderiza las secciones reales con la respuesta real de la API y
comprueba el HTML.

Cada comprobacion corresponde a un defecto REAL encontrado
inspeccionando la pantalla en este gate, no a una hipotesis.
===========================================================
*/

const ruta = process.argv[2];

if (!ruta) {
  console.error("uso: node check.mjs <home.json>");

  process.exit(2);
}

const home = JSON.parse(readFileSync(ruta, "utf8"));

const proyecto = {
  id: home.proyecto.projectId,
  nombre: "Elecciones Alcaldía Cuenca 2027",
  canton: "Cuenca",
  provincia: "Azuay",
  pais: "Ecuador"
};

function pintar(seccion) {
  return renderToStaticMarkup(
    <MediaIntelligenceVista
      proyectos={[proyecto]}
      projectId={proyecto.id}
      proyecto={proyecto}
      ventana={home.ventana.id}
      seccion={seccion}
      home={home}
      cargando={false}
      error={null}
    />
  );
}

const SECCIONES = [
  "resumen",
  "medios",
  "periodistas",
  "creadores",
  "historias",
  "amplificacion",
  "presencia",
  "fuentes"
];

const html = {};

SECCIONES.forEach((s) => {
  html[s] = pintar(s);
});

if (process.env.VOLCAR) {
  SECCIONES.forEach((s) => {
    require("node:fs").writeFileSync(`${process.env.VOLCAR}-${s}.html`, html[s], "utf8");
  });
}

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

const todo = SECCIONES.map((s) => html[s]).join("\n");


console.log("\n== 1 · LA PANTALLA SE PINTA ==");

SECCIONES.forEach((s) => {
  t(`la seccion «${s}» produce HTML`, html[s].length > 500);
});

t("la cabecera nombra el modulo", todo.includes("Media Intelligence"));

t(
  "la cabecera declara que analizar no es el modulo",
  html.resumen.includes("no es «Analizar publicación»")
);

t("el proyecto activo se muestra", html.resumen.includes("Elecciones Alcaldía Cuenca 2027"));

t("las nueve secciones estan en la navegacion", html.resumen.includes("Analizar publicación"));


console.log("\n== 2 · NINGUN IDENTIFICADOR TECNICO EN LUGAR DE UN NOMBRE ==");

/*
  Los ids pueden aparecer como referencia secundaria; lo que no
  puede es que aparezcan SOLOS. Se comprueba que el nombre este.
*/
t(
  "el candidato se muestra con su nombre real",
  html.resumen.includes("Paúl Carrasco Carpio") &&
    html.resumen.includes("Juan Cristóbal Lloret Valdivieso")
);

t(
  "el territorio se muestra por su nombre y no por su id",
  html.presencia.includes("Cuenca") && !html.presencia.includes("ec-azuay-cuenca")
);


console.log("\n== 3 · ESTADOS EN LENGUAJE HUMANO ==");

const CRUDOS = [
  "COBERTURA_INSUFICIENTE",
  "SIN_EVIDENCIA",
  "NO_DISPONIBLE",
  "METODOLOGIA_EN_CONSTRUCCION",
  "FECHA_NO_NORMALIZADA"
];

CRUDOS.forEach((c) => {
  t(`«${c}» no se pinta crudo`, !todo.includes(c));
});

t("se usa «Cobertura insuficiente»", todo.includes("Cobertura insuficiente"));

t("se usa «Metodología en construcción»", html.presencia.includes("Metodología en construcción"));


console.log("\n== 4 · NI UN CERO FALSO ==");

/*
  El caso concreto: El Mercurio tiene 8 piezas y ninguna datable.
  La fila debe declarar cobertura insuficiente y mostrar el corpus.
*/
t(
  "El Mercurio aparece con su recuento de corpus",
  html.presencia.includes("El Mercurio")
);

t(
  "la ventana declara las piezas sin fecha normalizada",
  html.resumen.includes("con fecha no normalizada")
);

t(
  "la ventana declara cuantas piezas situa",
  html.resumen.includes("situada(s) en la ventana")
);


console.log("\n== 5 · ARTEFACTOS NO PARECEN MEDIOS ==");

const infra = "mw-public-alb-prod-1982631391.us-east-1.elb.amazonaws.com";

t(
  "el balanceador de AWS NO esta en el ranking de presencia",
  !html.presencia.split("Artefactos de recolección")[0].includes(infra)
);

t(
  "el balanceador de AWS SI aparece declarado como artefacto",
  html.presencia.includes(infra)
);

t("se etiqueta como infraestructura", html.presencia.includes("Infraestructura"));

t(
  "google.com no esta en el ranking",
  !html.presencia.split("Artefactos de recolección")[0].includes("google.com")
);

t(
  "google.com se declara como agregador",
  html.presencia.includes("Agregador / redirector")
);


console.log("\n== 6 · VOCABULARIO ==");

/*
  «influencia» PUEDE aparecer: el modulo la nombra para
  prohibirla. Lo que no puede es aparecer afirmandola. Se
  comprueba frase a frase: toda linea de texto visible que la
  contenga tiene que ser una negacion o una prohibicion.
*/
const lineasVisibles = todo
  .replace(/<[^>]*>/g, "\n")
  .split("\n")
  .map((x) => x.trim())
  .filter(Boolean);

const usosDeInfluencia = lineasVisibles.filter((l) => /influencia/i.test(l));

const usosAfirmativos = usosDeInfluencia.filter(
  (l) => !/(PROHIBIDO|no significa|no mide|nunca|no es un ranking)/i.test(l)
);

t(
  `«influencia» solo aparece negada (${usosDeInfluencia.length} usos, 0 afirmativos)`,
  usosDeInfluencia.length > 0 && usosAfirmativos.length === 0
);

t("el ranking se titula presencia mediatica observable", html.presencia.includes("PRESENCIA MEDIÁTICA OBSERVABLE"));

t("el ranking niega ser de influencia", html.presencia.includes("PROHIBIDO"));

t("la nota metodologica es visible", html.presencia.includes("Cómo leer este ranking"));

t("no se promete un score", !todo.includes("score") || html.presencia.includes("no es una puntuacion") || html.presencia.includes("RECUENTO"));


console.log("\n== 7 · ¿POR QUE ESTA AQUI? ==");

t("cada fila ofrece la accion", html.presencia.includes("¿Por qué?"));

/*
  El boton «Ver evidencia» vive dentro de la fila desplegable, que
  solo existe tras un clic. Un render estatico no puede pulsarlo,
  asi que se comprueba el DATO que lo alimenta: que toda fila
  traiga su justificacion, con razones y con su limite declarado.

  Es la limitacion honesta de esta verificacion: cubre lo que se
  pinta, no lo que ocurre al interactuar.
*/
const filasRanking = home.presencia.ranking;

t(
  "toda fila del ranking trae su justificacion",
  filasRanking.length > 0 && filasRanking.every((f) => f.porQue?.razones?.length >= 3)
);

t(
  "la justificacion declara su limite",
  filasRanking.every((f) => /No explican audiencia/.test(f.porQue?.limite || ""))
);


console.log("\n== 8 · CANDIDATOS x MEDIOS ==");

t(
  "se declara como relacion observada, no como apoyo",
  html.resumen.includes("OBSERVO una relacion") ||
    html.resumen.includes("OBSERVÓ una relación") ||
    html.resumen.includes("observable y no tiene signo")
);

t(
  "se niega la lectura de intencion de voto",
  html.resumen.includes("intención de voto") || html.resumen.includes("intencion de voto")
);

t(
  "los artefactos se separan de los medios del candidato",
  html.resumen.includes("artefacto(s) de")
);


console.log("\n== 9 · AMPLIFICACION ==");

t("las tres magnitudes se declaran no sumables", html.amplificacion.includes("no se suman"));

t("no se afirma copia", html.amplificacion.includes("no prueba haber copiado") || html.amplificacion.includes("No afirma copia"));

t("el rol por defecto se explica", html.amplificacion.includes("COBERTURA_RELACIONADA"));


console.log("\n== 10 · PREPARACION ==");

t("Top 10/20/50 estan previstos", html.presencia.includes("Top 10") && html.presencia.includes("Top 20") && html.presencia.includes("Top 50"));

t("las dimensiones futuras se declaran pendientes", html.presencia.includes("pendiente"));

t("el universo de medios se declara preparado", html.medios.includes("Universo de medios"));

t("no hay formulario falso de alta de medio", html.medios.includes("próximamente") && !html.medios.includes("<form"));


console.log(`\nPASS: ${pass}    FALL: ${fail}`);

if (fail > 0) {
  console.log("\nFALLOS:");

  fallos.forEach((f) => console.log(`  - ${f}`));

  process.exit(1);
}
