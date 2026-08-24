// apps/backend/tests/identidad.test.mjs

import {
  clasificarCuenta,
  llevaNombreDelObjetivo,
  zonaDeApellidos
} from "../services/social/classification/accountClassifier.js";

import { normalizarTexto, tokenizar } from "../services/textUtils.js";

/*
===========================================================
PRUEBAS DE LA TUBERIA DE IDENTIDAD
===========================================================

    node tests/identidad.test.mjs

SIN RED Y SIN CUOTA. Ninguna comprobacion consulta SerpAPI,
Brave, DuckDuckGo ni Wikidata: todas son deterministas sobre
cuentas fijas escritas aqui mismo.

QUE SE PROTEGE
-----------------------------------------------------------

Dos defectos opuestos, y hay que sostener los dos a la vez.

  FALSO NEGATIVO (L-1)  La regla exigia el ULTIMO token del
                        nombre, asi que cada apellido de mas que
                        el analista escribia estrechaba el filtro:
                        "Paul Carrasco Carpio" exigia "carpio" y
                        se quedaba en cero cuentas.

  FALSO POSITIVO        Si se relaja a "cualquier token vale",
                        @juan-carlos-garcia-macias vuelve a
                        atribuirse a Juan Carlos Vega, que es otra
                        persona.

Un test que solo cubriera el primero permitiria la correccion
equivocada. Por eso el bloque de falsos positivos no es un extra:
es la mitad del contrato.
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
  console.log("-".repeat(titulo.length));
}

/* Atajos. */
const zona = (nombre) =>
  zonaDeApellidos(tokenizar(normalizarTexto(nombre), 4));

const atribuye = (nombre, handle, extra = {}) =>
  clasificarCuenta({ handle, ...extra }, { nombrePrincipal: nombre }).clase ===
  "cuenta_personal";

/*
===========================================================
T8 — ZONA DE APELLIDOS
===========================================================
*/

bloque("T8.a  la zona de apellidos se delimita bien");

t("Paul Carrasco Carpio -> {carrasco, carpio}", () => {
  const z = zona("Paúl Carrasco Carpio");

  return (
    z.apellidos.join(",") === "carrasco,carpio" && z.criterio === "lexico"
  );
});

t("Juan Cristobal Lloret Valdivieso -> {lloret, valdivieso}", () => {
  const z = zona("Juan Cristóbal Lloret Valdivieso");

  /* Dos nombres de pila seguidos, no solo el primero. */
  return (
    z.apellidos.join(",") === "lloret,valdivieso" &&
    z.pila.join(",") === "juan,cristobal"
  );
});

t("Juan Carlos Vega -> {vega}, y NO incluye juan ni carlos", () => {
  const z = zona("Juan Carlos Vega");

  return (
    z.apellidos.join(",") === "vega" &&
    !z.apellidos.includes("juan") &&
    !z.apellidos.includes("carlos")
  );
});

t("Yaku Perez Guartambel -> {perez, guartambel} por respaldo posicional", () => {
  const z = zona("Yaku Perez Guartambel");

  /*
    "Yaku" no esta en el lexico de nombres de pila, y no hace
    falta que lo este: el respaldo posicional descarta el primero.
    Esto es lo que permite que el lexico sea incompleto sin que el
    sistema dependa de completarlo.
  */
  return (
    z.apellidos.join(",") === "perez,guartambel" &&
    z.criterio === "posicional"
  );
});

t("un nombre de dos tokens no cambia de comportamiento", () => {
  /*
    L-1 es inerte aqui, y tiene que serlo: con dos tokens la zona
    es el segundo, que es exactamente lo que exigia la regla
    anterior. Ningun objetivo de dos tokens puede empeorar.
  */
  return (
    zona("Pedro Palacios").apellidos.join(",") === "palacios" &&
    zona("Daniel Noboa").apellidos.join(",") === "noboa" &&
    zona("Marcelo Cabrera").apellidos.join(",") === "cabrera"
  );
});

t("la zona nunca queda vacia", () => {
  /*
    "Juan Carlos" es todo nombres de pila. Si la zona se vaciara,
    el objetivo se quedaria sin ninguna exigencia y atribuiria
    cualquier cosa. Se conserva el ultimo token.
  */
  const z = zona("Juan Carlos");

  return z.apellidos.length > 0 && z.criterio === "todos_nombres_de_pila";
});

t("un solo token sigue siendo exigible", () => {
  const z = zona("Noboa");

  return z.apellidos.join(",") === "noboa";
});

/*
===========================================================
T8.b — LO QUE SE RECUPERA
===========================================================

Cada caso de aqui estaba RECHAZADO antes de L-1, y esta
verificado contra los grupos de candidatos reales que el
Discovery produjo, no inventado para el test.
*/

bloque("T8.b  cuentas legitimas que la regla vieja perdia");

t("@jotalloretv es de Juan Cristobal Lloret Valdivieso", () => {
  /* Antes exigia "valdivieso"; el handle solo lleva "lloret". */
  return atribuye("Juan Cristóbal Lloret Valdivieso", "jotalloretv");
});

t("las cinco cuentas de Yaku Perez Guartambel", () => {
  /* Antes exigia "guartambel"; casi ninguna lo lleva. */
  return [
    "yakuperezg",
    "yakuperezgu",
    "yaku_perez",
    "yakuperezoficial",
    "yaku.perez"
  ].every((h) => atribuye("Yaku Perez Guartambel", h));
});

t("Paul Carrasco Carpio con solo el primer apellido", () => {
  /*
    El caso que se quedaba en cero: la regla vieja exigia
    "carpio" y las cuentas usan "carrasco".
  */
  return (
    atribuye("Paúl Carrasco Carpio", "paulcarrascoc") &&
    atribuye("Paúl Carrasco Carpio", "paul.carrascocarpio.3")
  );
});

t("da igual el orden en que el analista escriba los apellidos", () => {
  /*
    Basta uno cualquiera: el analista no tiene que adivinar cual
    de los dos apellidos usa la cuenta.
  */
  return (
    atribuye("Juan Cristóbal Lloret Valdivieso", "juancvaldivieso") &&
    atribuye("Juan Cristóbal Lloret Valdivieso", "jclloret")
  );
});

/*
===========================================================
T8.c — LO QUE TIENE QUE SEGUIR RECHAZADO
===========================================================

REGRESION EXPLICITA. Si este bloque se rompe, L-1 se convirtio
en "cualquier token coincide = identidad valida" y hay que
revertirlo, no ajustar el test.
*/

bloque("T8.c  falsos positivos que siguen fuera (regresion)");

t("CASO CONOCIDO: @juan-carlos-garcia-macias NO es Juan Carlos Vega", () => {
  return !atribuye("Juan Carlos Vega", "juan-carlos-garcía-macías-123");
});

t("… ni con el sufijo numerico largo del resultado real", () => {
  return !atribuye("Juan Carlos Vega", "juan-carlos-garcía-macías-69607318a");
});

t("el motivo del rechazo nombra los apellidos exigidos", () => {
  /*
    Un rechazo que no explica que falto es indistinguible de un
    fallo del sistema. El analista tiene que poder leer por que.
  */
  const r = llevaNombreDelObjetivo(
    { handle: "juan-carlos-garcía-macías-123" },
    { nombrePrincipal: "Juan Carlos Vega" }
  );

  return (
    r.lleva === false &&
    r.coincidencias.includes("juan") &&
    r.apellidosCoincidentes.length === 0 &&
    r.motivo.includes("vega")
  );
});

t("compartir solo el nombre de pila no atribuye", () => {
  return (
    !atribuye("Paúl Carrasco Carpio", "paulmoreno") &&
    !atribuye("Pedro Palacios", "pedroXYZ") &&
    !atribuye("Juan Cristóbal Lloret Valdivieso", "juancristobalmora")
  );
});

t("@yakuquito no es Yaku Perez Guartambel", () => {
  /*
    Aparecio en el grupo real de candidatos. Comparte "yaku",
    que aqui es el token de pila, y ningun apellido.
  */
  return !atribuye("Yaku Perez Guartambel", "yakuquito");
});

t("un medio no se atribuye aunque el nombre aparezca", () => {
  return !atribuye("Juan Cristóbal Lloret Valdivieso", "UnsionTV", {
    titulosObservados: ["Juan Cristóbal Lloret habló con Unsion TV"]
  });
});

t("un numero pegado a un nombre de pila no atribuye", () => {
  return !atribuye("Marcelo Cabrera", "marcelo17965608");
});

/*
===========================================================
T8.d — EL CONTRATO EN UNA FRASE
===========================================================
*/

bloque("T8.d  el contrato: un apellido, cualquiera, obligatorio");

t("cualquier apellido de la zona basta; ninguno no basta", () => {
  const nombre = "Juan Cristóbal Lloret Valdivieso";

  const conPrimero = atribuye(nombre, "algo_lloret_algo");

  const conSegundo = atribuye(nombre, "algo_valdivieso_algo");

  const soloPila = atribuye(nombre, "juan_cristobal_otro");

  return conPrimero && conSegundo && !soloPila;
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
