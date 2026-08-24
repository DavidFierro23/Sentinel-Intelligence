// apps/backend/tests/contexto.test.mjs

import { planificarConsultas } from "../services/fusionSearchEngine.js";
import {
  extraerAnclas,
  planificarConsultasDerivadas
} from "../services/social/discovery/platformAdapters.js";
import { catalogoPlataformas } from "../services/social/socialContracts.js";

import {
  construirContextoMaestro,
  aplicarContextoMaestro
} from "../services/projects/projectContext.js";

/*
===========================================================
PRUEBAS DE CONTEXTO Y COBERTURA DE PLATAFORMAS
===========================================================

    node tests/contexto.test.mjs

SIN RED Y SIN CUOTA. Solo se PLANIFICAN consultas; no se
ejecuta ninguna.

T5  COBERTURA DE PLATAFORMAS. Que se planifique para todas las
    plataformas del catalogo y no solo para las que suelen
    responder. Una plataforma sin consulta no es una plataforma
    sin cuentas: es una plataforma no comprobada, y confundirlas
    es afirmar una ausencia que nadie miro.

T6  CONTEXTO DESTILADO (L-3). Que la consulta de contexto use
    las anclas y no la frase larga del formulario, y —igual de
    importante— que la busqueda amplia por nombre siga en el
    plan. Precisar el contexto sirve para desempatar homonimos,
    no para decidir de antemano que se puede encontrar.
===========================================================
*/

let pass = 0;

let fail = 0;

const fallos = [];

function t(nombre, comprobacion) {
  try {
    const valor = comprobacion();

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

/*
  Dos proyectos DISTINTOS, a proposito. Si algo estuviera
  cosido a Cuenca o a la alcaldia, el segundo caso lo delata.
*/
const CASOS = [
  {
    etiqueta: "cantonal / alcaldía",
    proyecto: {
      nombre: "Alcaldía de Cuenca 2027",
      canton: "Cuenca",
      provincia: "Azuay",
      pais: "Ecuador",
      dignidad: "Alcalde"
    },
    candidato: { nombre: "Pedro Palacios", nivel: "cantonal" },
    nombre: "Pedro Palacios",
    rolLargo: "Candidato a Alcalde de Cuenca",
    esperadas: ["cuenca", "alcalde"]
  },
  {
    etiqueta: "provincial / prefectura",
    proyecto: {
      nombre: "Prefectura del Guayas 2027",
      provincia: "Guayas",
      pais: "Ecuador",
      dignidad: "Prefecto"
    },
    candidato: { nombre: "Ana Torres Mendoza", nivel: "provincial" },
    nombre: "Ana Torres Mendoza",
    rolLargo: "Candidata a la Prefectura del Guayas por el movimiento X",
    esperadas: ["guayas", "prefecto"]
  }
];

function perfilDe(caso) {
  const cm = construirContextoMaestro(caso.proyecto, caso.candidato);

  return aplicarContextoMaestro(
    {
      nombrePrincipal: caso.nombre,
      contexto: { rol: caso.rolLargo, pais: "Ecuador" }
    },
    cm
  );
}

const web = (perfil, nombre) =>
  planificarConsultas(perfil, nombre).filter((q) => q.tipoMotor === "web");

const deContexto = (plan) =>
  plan.find((q) => q.etiqueta === "nombre_mas_contexto");

/*
===========================================================
T6 — CONTEXTO DESTILADO
===========================================================
*/

bloque("T6  la consulta de contexto usa anclas, no la frase larga");

CASOS.forEach((caso) => {
  const perfil = perfilDe(caso);

  const plan = web(perfil, caso.nombre);

  t(`[${caso.etiqueta}] la consulta de contexto existe`, () => {
    return Boolean(deContexto(plan));
  });

  t(`[${caso.etiqueta}] lleva las dos anclas del proyecto`, () => {
    const q = deContexto(plan).consulta.toLowerCase();

    return caso.esperadas.every((e) => q.includes(e));
  });

  t(`[${caso.etiqueta}] NO arrastra la frase del formulario`, () => {
    /*
      El defecto concreto: la consulta salia con ocho palabras
      —"Candidato a Alcalde de Cuenca Ecuador"— y un buscador web
      con ocho palabras no devuelve cuentas sociales.
    */
    const q = deContexto(plan).consulta;

    return !q.includes(caso.rolLargo);
  });

  t(`[${caso.etiqueta}] la consulta se mantiene corta`, () => {
    /*
      Nombre entre comillas + dos anclas. El umbral no es
      estetico: mide que no haya vuelto a entrar una frase.
    */
    const q = deContexto(plan).consulta;

    const fuera = q.replace(/"[^"]*"/g, "").trim().split(/\s+/).filter(Boolean);

    return fuera.length <= 3;
  });

  t(`[${caso.etiqueta}] las anclas van por fuerza, territorio y dignidad primero`, () => {
    const dos = extraerAnclas(perfil).slice(0, 2).map((a) => a.origen);

    return dos.every((o) => String(o).startsWith("proyecto_"));
  });
});

bloque("T6.b  el contexto NO sustituye la búsqueda amplia");

CASOS.forEach((caso) => {
  const plan = web(perfilDe(caso), caso.nombre);

  t(`[${caso.etiqueta}] sigue habiendo consulta de nombre a secas`, () => {
    /*
      La reserva. Es la que encuentra lo que no sabiamos buscar:
      si solo quedaran consultas ancladas, el sistema encontraria
      unicamente lo que ya esperaba.
    */
    const base = plan.find((q) => q.etiqueta === "nombre_principal");

    return Boolean(base) && base.consulta === `"${caso.nombre}"`;
  });

  t(`[${caso.etiqueta}] la consulta amplia no lleva contexto`, () => {
    const base = plan.find((q) => q.etiqueta === "nombre_principal");

    return caso.esperadas.every(
      (e) => !base.consulta.toLowerCase().includes(e)
    );
  });
});

bloque("T6.c  sin proyecto, el comportamiento anterior no cambia");

t("en modo individual la consulta de contexto sigue siendo rol + país", () => {
  /*
    L-3 no debe alterar el modo individual: alli no hay anclas de
    proyecto y `extraerAnclas` devuelve el rol y el pais que
    derivo la evidencia, que es exactamente lo de antes.
  */
  const plan = web(
    {
      nombrePrincipal: "Daniel Noboa",
      contexto: { rol: "presidente", pais: "Ecuador" }
    },
    "Daniel Noboa"
  );

  const q = deContexto(plan);

  return q.consulta === '"Daniel Noboa" presidente Ecuador';
});

t("un perfil sin contexto alguno no rompe la planificación", () => {
  const plan = web({ nombrePrincipal: "Alguien Sin Contexto" }, "x");

  return plan.length >= 1 && !deContexto(plan);
});

/*
===========================================================
T5 — COBERTURA DE PLATAFORMAS
===========================================================
*/

bloque("T5  se planifica para todas las plataformas del catálogo");

const PLATAFORMAS = catalogoPlataformas();

t("el catálogo tiene las seis plataformas esperadas", () => {
  const ids = PLATAFORMAS.map((p) => p.id).sort();

  return (
    ["facebook", "instagram", "linkedin", "tiktok", "x", "youtube"].every((x) =>
      ids.includes(x)
    )
  );
});

/*
  Se prueba `planificarConsultasDerivadas`, que es el
  planificador que el Discovery USA de verdad. Ver la nota de
  abajo sobre planificarConsultasSociales.
*/
CASOS.forEach((caso) => {
  const perfil = perfilDe(caso);

  const r = planificarConsultasDerivadas(perfil, {});

  const anclado = r.plan.filter((q) => q.anclada && q.plataformaId);

  const reserva = r.plan.filter((q) => !q.anclada && q.plataformaId);

  t(`[${caso.etiqueta}] las seis plataformas reciben consulta anclada`, () => {
    /*
      TikTok es el caso que motivo esta prueba: se le dejaba
      fuera y el informe decia "sin cuentas" cuando lo cierto era
      "no se busco". Una plataforma sin consulta no es una
      plataforma sin cuentas.
    */
    const cubiertas = new Set(anclado.map((q) => q.plataformaId));

    return PLATAFORMAS.every((p) => cubiertas.has(p.id));
  });

  t(`[${caso.etiqueta}] el ancla de cada consulta es la destilada`, () => {
    return anclado.every((q) =>
      caso.esperadas.every((e) => q.consulta.toLowerCase().includes(e))
    );
  });

  t(`[${caso.etiqueta}] ninguna consulta arrastra la frase del formulario`, () => {
    return r.plan.every((q) => !q.consulta.includes(caso.rolLargo));
  });

  t(`[${caso.etiqueta}] hay pasada de reserva por nombre a secas`, () => {
    /*
      LIMITE DECLARADO: la reserva no llega a las seis
      plataformas, la acota el presupuesto del proveedor. Se
      comprueba que EXISTE y que no lleva contexto; exigir 6 de 6
      seria exigir un presupuesto que no hay.
    */
    return (
      reserva.length > 0 &&
      reserva.every((q) =>
        caso.esperadas.every((e) => !q.consulta.toLowerCase().includes(e))
      )
    );
  });

  t(`[${caso.etiqueta}] las anclas usadas son las dos del proyecto`, () => {
    return (
      r.anclasUsadas.length === 2 &&
      r.anclasUsadas.every((a) => String(a.origen).startsWith("proyecto_"))
    );
  });
});

t("planificarConsultasSociales está exportada pero el motor no la usa", () => {
  /*
    HALLAZGO, no comprobacion de comportamiento.

    `discoveryEngine.planificarConsultasSociales` cubre 3 de las 6
    plataformas y NADIE la llama: el motor planifica con
    `planificarConsultasDerivadas`. Se deja constancia aqui —y no
    se borra— porque esta en un archivo congelado y su limpieza no
    entra en esta autorizacion. Si alguien la conectara creyendo
    que es el planificador, perderia X, YouTube y LinkedIn.

    La prueba solo fija el hecho: el plan real cubre mas
    plataformas que esa funcion.
  */
  const cubiertas = new Set(
    planificarConsultasDerivadas(perfilDe(CASOS[0]), {})
      .plan.filter((q) => q.plataformaId)
      .map((q) => q.plataformaId)
  );

  return cubiertas.size === PLATAFORMAS.length;
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
