import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";

import CandidateIdentityForm from "../src/components/CandidateIdentityForm";

/*
===========================================================
VERIFICACION DE RENDER — «Editar identidad digital»
P-CAND-ASSET-TYPE-UI-FIX-01
===========================================================

Renderiza la pantalla real con la respuesta real de la API y
comprueba el HTML.

Existe por lo que fallo: el gate anterior implemento el
selector de tipo en `AccountIntelligencePanel`, que es otra
pantalla, y lo reporto como hecho. Las 1037 pruebas de dominio
pasaban —el backend devolvia los tipos correctamente— y ninguna
miraba el HTML, asi que ninguna podia detectarlo.

    Que la funcion devuelva el dato no significa que la
    pantalla lo pinte.

Esto cubre esa distancia.
===========================================================
*/

const ruta = process.argv[2];

if (!ruta) {
  console.error("uso: node check.mjs <ficha.json>");

  process.exit(2);
}

const ficha = JSON.parse(readFileSync(ruta, "utf8"));

const html = renderToStaticMarkup(
  <CandidateIdentityForm
    ficha={ficha}
    proyecto={{ id: "verificacion", nombre: "Verificacion" }}
    ocupado={false}
    onCancelar={() => {}}
    onGuardar={() => {}}
    onDeclararTipo={() => {}}
  />
);

if (process.env.VOLCAR) { require("node:fs").writeFileSync(process.env.VOLCAR, html, "utf8"); }

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

/* Cuenta los <select> cuyo aria-label nombra a un handle dado. */
const selectoresDe = (handle) => {
  const re = new RegExp(
    `<select[^>]*aria-label="Tipo de cuenta de ${handle.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    )}"`,
    "g"
  );

  return (html.match(re) || []).length;
};

const activos = ficha.activosMeta?.porActivo || {};

const deFacebook = Object.keys(activos).filter((k) => k.startsWith("facebook:"));

const deInstagram = Object.keys(activos).filter((k) => k.startsWith("instagram:"));

console.log(`\n--- ${ficha.nombre} ---`);
console.log(
  `  activos Meta en la ficha: ${deFacebook.length} Facebook, ${deInstagram.length} Instagram`
);

const totalSelects = (html.match(/aria-label="Tipo de cuenta de /g) || []).length;

console.log(`  <select> de tipo renderizados: ${totalSelects}\n`);

t(
  `hay un selector por cada activo Meta (${deFacebook.length + deInstagram.length})`,
  totalSelects === deFacebook.length + deInstagram.length
);

t(
  "cada activo de Facebook tiene EL SUYO, exactamente uno",
  deFacebook.length > 0 && deFacebook.every((id) => selectoresDe(id) === 1)
);

t(
  "cada activo de Instagram tiene EL SUYO, exactamente uno",
  deInstagram.length > 0 && deInstagram.every((id) => selectoresDe(id) === 1)
);

/*
  Las opciones. Se comprueban por etiqueta visible, que es lo
  que el analista lee, no por el valor interno.
*/
t(
  "Facebook ofrece perfil y pagina",
  html.includes(">Perfil personal<") && html.includes(">Pagina / Fan Page<")
);

t(
  "Instagram ofrece las cuatro clases",
  html.includes(">Profesional (sin afinar)<") &&
    html.includes(">Business<") &&
    html.includes(">Creator<") &&
    html.includes(">Personal<")
);

t("«Sin clasificar» esta disponible", html.includes(">Sin clasificar<"));

/*
  El estado de identidad no se toca: sigue en su sitio, y el
  tipo aparece ademas, no en su lugar.
*/
t(
  "el estado de identidad sigue visible junto al tipo",
  /Consolidada|Corroborada|Declarada|Descubierta|Dudosa|Revocada/i.test(html)
);

t("la palabra «Tipo» rotula el selector", html.includes(">Tipo<"));

/* Procedencia: solo donde hay declaracion, y nunca «verificado». */
const declarados = Object.values(activos).filter(
  (a) => a.assetTypeSource === "ANALYST_DECLARATION"
).length;

const etiquetas = (html.match(/declarado por analista · no verificado/g) || []).length;

console.log(`\n  activos declarados: ${declarados} · etiquetas de procedencia: ${etiquetas}`);

t(
  "la procedencia aparece exactamente en los activos declarados",
  etiquetas === declarados
);

t(
  "en ningun caso se afirma que el tipo este verificado",
  !/tipo[^<]{0,40}verificad[oa]\b/i.test(html.replace(/no verificado/gi, ""))
);

/*
  Sin declaracion, el selector muestra «Sin clasificar» y no
  elige por el analista. React marca la opcion activa con
  `selected` DESPUES del value: `<option value="X" selected="">`.
*/
const seleccionada = (valor) =>
  (html.match(new RegExp(`<option value="${valor}" selected`, "g")) || []).length;

const sinDeclarar = Object.entries(activos).filter(([, a]) => !a.assetTypeDeclared);

t(
  "un activo sin clasificar no aparece preclasificado",
  sinDeclarar.length === 0 ||
    seleccionada("UNKNOWN") === sinDeclarar.length
);

/* Cada activo declarado conserva SU tipo, no el de su hermano. */
const conTipo = Object.entries(activos).filter(([, a]) => a.assetTypeDeclared);

t(
  "cada activo declarado conserva su propio tipo",
  conTipo.length === 0 ||
    conTipo.every(([, a]) => seleccionada(a.assetTypeDeclared) >= 1)
);

const distintos = new Set(conTipo.map(([, a]) => a.assetTypeDeclared));

if (distintos.size > 1) {
  t(
    `coexisten ${distintos.size} tipos distintos en la misma ficha`,
    [...distintos].every((tipo) => seleccionada(tipo) >= 1)
  );
}

console.log("\n===========================================");
console.log(`PASS: ${pass}    FALL: ${fail}`);

if (fallos.length) {
  console.log("\nFallos:");

  fallos.forEach((f) => console.log(`  - ${f}`));
}

console.log("===========================================\n");

process.exit(fail > 0 ? 1 : 0);
