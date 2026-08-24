// apps/backend/tests/referencia.test.mjs

import { descubrirCandidatos } from "../services/social/discovery/discoveryEngine.js";
import { evaluarS6 } from "../services/social/identity/signals/officialLinkSignal.js";

/*
===========================================================
PRUEBAS DE LA CUENTA DE REFERENCIA (L-2)
===========================================================

    node tests/referencia.test.mjs

SIN RED Y SIN CUOTA. Se llama al Discovery con

    omitirConsultas: true      no toca el Search Provider Layer
    omitirScanner:   true      no toca Wikidata

asi que las unicas cuentas que puede haber en el resultado son
las que se le pasan aqui escritas. Si alguna prueba tardase
segundos o fallase por red, seria un defecto del aislamiento y
no del caso.

QUE SE PROTEGE
-----------------------------------------------------------

T3  Que la URL del analista LLEGUE. Antes de L-2 se guardaba en
    el expediente y el Discovery no la miraba nunca.

T4  Que esa URL NO SE CORROBORE A SI MISMA. Es la regla
    absoluta: si el sistema se suma puntos por "encontrar" lo
    que le acaban de dictar, esta confirmando un eco. T4 es la
    prueba que impide que L-2 se convierta en eso.
===========================================================
*/

let pass = 0;

let fail = 0;

const fallos = [];

/*
  El helper ESPERA el resultado. Varias comprobaciones de aqui
  vuelven a llamar al Discovery, que es asincrono, y una promesa
  es siempre "verdadera": un t() sincrono las habria dado por
  buenas sin comprobar nada. Un test que no puede fallar no
  protege de nada.
*/
async function t(nombre, comprobacion) {
  try {
    const valor = await comprobacion();

    if (valor === true) {
      pass += 1;
      console.log(`  PASS  ${nombre}`);
    } else {
      fail += 1;
      fallos.push(nombre);
      console.log(`  FALL  ${nombre}  (devolvió ${JSON.stringify(valor)})`);
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

const AISLADO = { omitirConsultas: true, omitirScanner: true };

const descubrir = (perfil, cuentasReferencia) =>
  descubrirCandidatos(perfil, { ...AISLADO, cuentasReferencia });

const PERFIL = { nombrePrincipal: "Yaku Pérez Guartambel" };

/* Las URLs tal como el analista las pegaria. */
const REFERENCIAS = [
  {
    plataforma: "X",
    url: "https://x.com/yakuperezg",
    tipo: "cuenta_referencia",
    origen: "analista",
    verificadaPorSentinel: false
  },
  {
    plataforma: "Facebook",
    url: "https://www.facebook.com/yakuperezoficial",
    tipo: "cuenta_referencia",
    origen: "analista",
    verificadaPorSentinel: false
  }
];

const r = await descubrir(PERFIL, REFERENCIAS);

const porHandle = (h) =>
  (r.candidatos || []).find((c) => c.handle?.toLowerCase() === h);

/*
===========================================================
T3 — LA REFERENCIA LLEGA
===========================================================
*/

bloque("T3  la cuenta de referencia entra al Discovery");

await t("las dos URLs escritas producen candidatos", () => {
  return !!porHandle("yakuperezg") && !!porHandle("yakuperezoficial");
});

await t("entran con via: cuenta_referencia", () => {
  const c = porHandle("yakuperezg");

  return c.origenes.some((o) => o.via === "cuenta_referencia");
});

await t("entran con origen: analista", () => {
  const c = porHandle("yakuperezg");

  return c.origenes.some((o) => o.origen === "analista");
});

await t("la plataforma se lee del dominio, no del campo escrito", () => {
  /*
    SD-1A es la autoridad. Si el analista se equivoca al elegir
    la plataforma en el formulario, manda la URL.
  */
  return porHandle("yakuperezg").plataforma === "X";
});

await t("queda marcada como aportada por el analista", () => {
  return porHandle("yakuperezg").aportadaPorAnalista === true;
});

await t("hay traza de la vía con su recuento", () => {
  const traza = (r.trazas || []).find((x) => x.via === "cuenta_referencia");

  return traza && traza.entrada === 2 && traza.corrobora === false;
});

await t("una URL que no identifica cuenta se declara, no se inventa", () => {
  /*
    Un post de Instagram no tiene propietario en la URL. No se
    puede convertir en cuenta: se rechaza y se dice por que.
  */
  return descubrir(PERFIL, [
    { plataforma: "Instagram", url: "https://www.instagram.com/p/DcRCcfKnEjY/" }
  ]).then((x) => {
    const traza = (x.trazas || []).find((v) => v.via === "cuenta_referencia");

    return (
      traza.utilizables === 0 &&
      traza.noUtilizables.length === 1 &&
      typeof traza.noUtilizables[0].motivo === "string"
    );
  });
});

await t("una URL vacía no rompe nada", () => {
  return descubrir(PERFIL, [{ plataforma: "X", url: "" }, null]).then(
    (x) => (x.candidatos || []).length === 0
  );
});

/*
===========================================================
T4 — NO AUTOVERIFICACION
===========================================================

REGLA ABSOLUTA. Si este bloque falla, L-2 debe revertirse.
*/

bloque("T4  la referencia NO se corrobora a sí misma");

await t("no aporta ningún proveedor", () => {
  /*
    El punto exacto del riesgo: officialLinkSignal cuenta
    `proveedores` y da puntos a partir de 2. La referencia no
    puede sumar ni uno.
  */
  return porHandle("yakuperezg").proveedores.length === 0;
});

await t("no aporta ninguna vía corroborante", () => {
  /*
    El segundo punto del riesgo, y el menos evidente:
    officialLinkSignal premia "vías independientes" y
    cuenta_referencia no está entre las vías derivadas, así que
    habría contado como información nueva. No está en `vias`.
  */
  const c = porHandle("yakuperezg");

  return (
    c.vias.length === 0 && !c.vias.includes("cuenta_referencia")
  );
});

await t("el origen lleva la marca explícita", () => {
  const o = porHandle("yakuperezg").origenes.find(
    (x) => x.via === "cuenta_referencia"
  );

  return o.noCuentaComoCorroboracion === true;
});

await t("S6 no da NI UN PUNTO por una cuenta solo declarada", () => {
  /*
    La comprobacion que importa: no se mira la lista, se mira el
    puntaje que sale de la señal.
  */
  const s6 = evaluarS6(porHandle("yakuperezg"), PERFIL);

  return s6.puntos === 0;
});

await t("… ni con seis URLs declaradas a la vez", () => {
  /*
    Acumular declaraciones no fabrica corroboracion. Si esto
    fallara, bastaria pegar seis URLs para inflar el puntaje.
  */
  return descubrir(PERFIL, [
    { url: "https://x.com/yakuperezg" },
    { url: "https://www.facebook.com/yakuperezoficial" },
    { url: "https://www.instagram.com/yakuperezg" },
    { url: "https://www.tiktok.com/@yaku.perez" },
    { url: "https://www.youtube.com/@yakuperez" },
    { url: "https://www.linkedin.com/in/yakuperez" }
  ]).then((x) =>
    (x.candidatos || []).every(
      (c) =>
        c.proveedores.length === 0 &&
        c.vias.length === 0 &&
        evaluarS6(c, PERFIL).puntos === 0
    )
  );
});

await t("la marca no oculta el origen: consta en viasDeclaradas", () => {
  /*
    Negarle puntos no es esconderla. El analista tiene que poder
    ver que esa cuenta la puso él.
  */
  return porHandle("yakuperezg").viasDeclaradas.includes("cuenta_referencia");
});

/*
===========================================================
T4.b — LO QUE SI DEBE CORROBORAR
===========================================================

El filtro tiene que ser exacto: si de paso silenciara a los
proveedores reales, habria roto la corroboracion legitima.
*/

bloque("T4.b  un hallazgo real sí corrobora, en la misma cuenta");

const MIXTO = await descubrirCandidatos(
  { ...PERFIL, handlesObservados: [] },
  {
    ...AISLADO,
    cuentasReferencia: [{ url: "https://x.com/yakuperezg" }],
    evidenciasPrevias: [
      {
        enlace: "https://x.com/yakuperezg",
        titulo: "Yaku Pérez (@yakuperezg) / X",
        motores: [{ nombre: "serpapi" }]
      }
    ]
  }
);

await t("la misma cuenta acumula los dos orígenes", () => {
  const c = (MIXTO.candidatos || []).find((x) => x.handle === "yakuperezg");

  return c && c.origenes.length === 2;
});

await t("el proveedor real SÍ entra en proveedores", () => {
  const c = (MIXTO.candidatos || []).find((x) => x.handle === "yakuperezg");

  return c.proveedores.includes("serpapi");
});

await t("la vía real SÍ entra en vias, la declarada no", () => {
  const c = (MIXTO.candidatos || []).find((x) => x.handle === "yakuperezg");

  return (
    c.vias.includes("evidencia_fusion") &&
    !c.vias.includes("cuenta_referencia") &&
    c.viasDeclaradas.includes("cuenta_referencia")
  );
});

await t("declarar una cuenta no le resta lo que ya tenía", () => {
  /*
    El filtro es de exclusion, no de castigo: la cuenta puntua
    igual que si el analista no hubiera escrito nada.
  */
  const conRef = (MIXTO.candidatos || []).find((x) => x.handle === "yakuperezg");

  return descubrirCandidatos(PERFIL, {
    ...AISLADO,
    evidenciasPrevias: [
      {
        enlace: "https://x.com/yakuperezg",
        titulo: "Yaku Pérez (@yakuperezg) / X",
        motores: [{ nombre: "serpapi" }]
      }
    ]
  }).then((solo) => {
    const sinRef = (solo.candidatos || []).find((x) => x.handle === "yakuperezg");

    return (
      evaluarS6(conRef, PERFIL).puntos ===
      evaluarS6(sinRef, PERFIL).puntos
    );
  });
});

/*
===========================================================
T4.c — LA REFERENCIA NO ES UN PASE LIBRE
===========================================================
*/

bloque("T4.c  el analista puede equivocarse");

await t("una URL de otra persona entra, pero sin corroboracion", async () => {
  /*
    Que la haya escrito una persona no la vuelve cierta. Entra al
    pipeline —el analista tiene derecho a ver que paso con lo que
    escribio— y llega sin un solo punto de corroboracion, que es
    lo que la deja a merced del juicio por nombre.
  */
  /*
    En Facebook y no en X a proposito: el handle de X admite 15
    caracteres y "juan-carlos-garcia-macias" tiene 25, asi que
    SD-1A lo rechazaria por la forma de la URL y la prueba no
    llegaria a comprobar lo que quiere comprobar.
  */
  const x = await descubrir({ nombrePrincipal: "Juan Carlos Vega" }, [
    { url: "https://www.facebook.com/juan-carlos-garcia-macias" }
  ]);

  const c = (x.candidatos || [])[0];

  return (
    !!c &&
    c.aportadaPorAnalista === true &&
    c.proveedores.length === 0 &&
    c.vias.length === 0
  );
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
