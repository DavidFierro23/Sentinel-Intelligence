// apps/backend/tests/alias.test.mjs

/*
===========================================================
PRUEBAS DE ALIAS → PLANIFICADOR (T9)
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/alias.test.mjs

SIN RED Y SIN CUOTA. Se PLANIFICAN consultas y se escribe en un
Lake en memoria; no se ejecuta ninguna busqueda.

QUE SE PROTEGE
-----------------------------------------------------------

Un alias es otra forma de nombrar a la misma persona. Sirve
para AMPLIAR el descubrimiento —«Jota Lloret» encuentra lo que
«Juan Cristobal Lloret Valdivieso» no encuentra— y para nada
mas.

La linea que estas pruebas defienden:

    el alias amplia el RECALL
    el nombre principal gobierna la PRECISION

Si un alias pudiera atribuir identidad, bastaria escribir
«Alcalde» en el formulario para que cualquier cuenta que lo
lleve pasara a ser del candidato: el analista habria dictado la
conclusion y Sentinel se la habria devuelto como hallazgo. Ese
es el falso positivo que T9.c existe para impedir.
===========================================================
*/

process.env.SENTINEL_LAKE_ADAPTER = "memoria";

const [pa, pc, ac, ps] = await Promise.all([
  import("../services/social/discovery/platformAdapters.js"),
  import("../services/projects/projectContext.js"),
  import("../services/social/classification/accountClassifier.js"),
  import("../services/projects/projectStore.js")
]);

const { catalogoPlataformas } = await import("../services/social/socialContracts.js");

let pass = 0;

let fail = 0;

const fallos = [];

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

const NOMBRE = "Juan Cristóbal Lloret Valdivieso";

const contexto = pc.construirContextoMaestro(
  {
    nombre: "Alcaldía de Cuenca 2027",
    canton: "Cuenca",
    provincia: "Azuay",
    pais: "Ecuador",
    dignidad: "Alcalde"
  },
  { nombre: NOMBRE, nivel: "cantonal" }
);

const perfilBase = pc.aplicarContextoMaestro(
  {
    nombrePrincipal: NOMBRE,
    contexto: { rol: "Candidato a Alcalde de Cuenca", pais: "Ecuador" }
  },
  contexto
);

const conAlias = (aliases) =>
  pa.planificarConsultasDerivadas(
    { ...perfilBase, aliasDeclarados: aliases },
    {}
  );

const SIN = pa.planificarConsultasDerivadas(perfilBase, {});

const CON = conAlias([
  { valor: "Jota Lloret", origen: "analista", noCuentaComoCorroboracion: true },
  { valor: "J. C. Lloret", origen: "analista" }
]);

const PLATAFORMAS = catalogoPlataformas();

/*
===========================================================
T9.a — EL ALIAS LLEGA AL PLANIFICADOR
===========================================================
*/

bloque("T9.a  el alias genera consultas que el nombre solo no generaba");

await t("sin alias, el plan no tiene ninguna consulta de alias", () => {
  return (
    SIN.aliasUsados.length === 0 &&
    SIN.plan.every((q) => !String(q.etiqueta).startsWith("alias:"))
  );
});

await t("con dos alias, aparecen dos consultas de alias", () => {
  const deAlias = CON.plan.filter((q) =>
    String(q.etiqueta).startsWith("alias:")
  );

  return deAlias.length === 2;
});

await t("el planificador declara qué alias usó", () => {
  return (
    CON.aliasUsados.length === 2 &&
    CON.aliasUsados.includes("Jota Lloret")
  );
});

await t("las consultas de alias van ancladas al contexto", () => {
  /*
    Un alias es mas corto y mas ambiguo que el nombre completo:
    sin contexto es justo la consulta que devuelve homonimos.
  */
  return CON.plan
    .filter((q) => String(q.etiqueta).startsWith("alias:"))
    .every(
      (q) =>
        q.anclada === true &&
        q.consulta.includes("Cuenca") &&
        q.consulta.includes("alcalde")
    );
});

await t("es el MISMO planificador, no uno paralelo", () => {
  /*
    Las consultas de alias salen de planificarConsultasDerivadas
    y comparten la forma del resto del plan: mismo dedup, mismas
    anclas, misma estructura.
  */
  const q = CON.plan.find((x) => String(x.etiqueta).startsWith("alias:"));

  return (
    typeof q.id === "string" &&
    Object.prototype.hasOwnProperty.call(q, "anclada") &&
    Object.prototype.hasOwnProperty.call(q, "anclas")
  );
});

/*
===========================================================
T9.b — AMPLIAN, NO REEMPLAZAN
===========================================================
*/

bloque("T9.b  los alias amplían el Discovery, no lo sustituyen");

await t("el plan CRECE: se añaden consultas", () => {
  return CON.plan.length > SIN.plan.length;
});

await t("el nombre principal conserva TODAS sus consultas", () => {
  /*
    Lo que no puede pasar: que un alias le quite al nombre
    principal una consulta.
  */
  const delNombre = (r) =>
    r.plan.filter((q) => q.consulta.includes(`"${NOMBRE}"`)).length;

  return delNombre(CON) === delNombre(SIN) && delNombre(CON) > 0;
});

await t("las SEIS plataformas siguen cubiertas", () => {
  const cubiertas = new Set(
    CON.plan.filter((q) => q.plataformaId).map((q) => q.plataformaId)
  );

  return PLATAFORMAS.every((p) => cubiertas.has(p.id));
});

await t("la reserva por nombre a secas sobrevive", () => {
  return CON.plan.some((q) => String(q.etiqueta).startsWith("nombre:"));
});

await t("los alias van AL FINAL, después de nombre y plataformas", () => {
  /*
    El orden dice la prioridad. Cuando el presupuesto del
    proveedor se agota tiene que perderse lo ultimo, no lo
    primero: un alias no puede costarle a una plataforma su
    consulta.
  */
  const idx = (pred) => CON.plan.findIndex(pred);

  const primerAlias = idx((q) => String(q.etiqueta).startsWith("alias:"));

  const ultimaPlataforma = CON.plan.reduce(
    (acc, q, i) => (q.plataformaId ? i : acc),
    -1
  );

  return primerAlias > ultimaPlataforma;
});

/*
===========================================================
T9.c — UN ALIAS NO VERIFICA IDENTIDAD
===========================================================

REGLA ABSOLUTA, la misma que la cuenta de referencia. Si este
bloque se rompe, el alias se convirtio en una forma de dictarle
a Sentinel de quien es una cuenta.
*/

bloque("T9.c  un alias NO decide de quién es una cuenta");

await t("el clasificador ignora aliasDeclarados por completo", () => {
  /*
    El caso peligroso: el analista escribe el alias «Alcalde de
    Cuenca» y una cuenta institucional lo lleva en el handle. Si
    el alias atribuyera, esa cuenta pasaria a ser del candidato.
  */
  const r = ac.clasificarCuenta(
    { handle: "alcaldedecuenca" },
    {
      nombrePrincipal: NOMBRE,
      aliasDeclarados: [{ valor: "Alcalde de Cuenca" }]
    }
  );

  return r.clase !== "cuenta_personal";
});

await t("la atribución da lo mismo con alias y sin alias", () => {
  const cuenta = { handle: "jotalloretv" };

  const sin = ac.clasificarCuenta(cuenta, { nombrePrincipal: NOMBRE });

  const con = ac.clasificarCuenta(cuenta, {
    nombrePrincipal: NOMBRE,
    aliasDeclarados: [{ valor: "Jota Lloret" }, { valor: "Alcalde" }]
  });

  return sin.clase === con.clase && con.clase === "cuenta_personal";
});

await t("un alias no rescata una cuenta que el apellido rechaza", () => {
  /*
    @juan-carlos-garcia-macias sigue siendo otra persona aunque
    el analista declare un alias que encaje con ella.
  */
  const r = ac.clasificarCuenta(
    { handle: "juan-carlos-garcía-macías-123" },
    {
      nombrePrincipal: "Juan Carlos Vega",
      aliasDeclarados: [{ valor: "Juan Carlos García" }]
    }
  );

  return r.clase !== "cuenta_personal";
});

await t("el alias conserva su procedencia y su marca", async () => {
  const p = await ps.crearProyecto({
    id: "t9-alias",
    nombre: "Proyecto T9",
    canton: "Cuenca",
    pais: "Ecuador",
    dignidad: "Alcalde"
  });

  await ps.agregarCandidato(p.proyecto.id, {
    nombre: NOMBRE,
    aliases: ["Jota Lloret", "J. C. Lloret"]
  });

  const c = await ps.contenidoDeProyecto(p.proyecto.id);

  const cand = c.candidatos[0];

  return (
    cand.aliases.length === 2 &&
    cand.aliases.every(
      (a) => a.origen === "analista" && a.noCuentaComoCorroboracion === true
    )
  );
});

/*
===========================================================
T9.d — HIGIENE
===========================================================
*/

bloque("T9.d  deduplicación y casos límite");

await t("un alias repetido no genera dos consultas", () => {
  const r = conAlias([
    { valor: "Jota Lloret" },
    { valor: "Jota  LLORET" },
    { valor: "jota lloret" }
  ]);

  return r.aliasUsados.length === 1;
});

await t("un alias igual al nombre principal se descarta", () => {
  /*
    No aporta ninguna consulta nueva: seria gastar presupuesto
    en repetir lo que ya se busco.
  */
  const r = conAlias([{ valor: NOMBRE }, { valor: "  " }, null]);

  return r.aliasUsados.length === 0;
});

await t("se admite un alias en texto plano, no solo objeto", () => {
  const r = conAlias(["Jota Lloret"]);

  return r.aliasUsados.length === 1 && r.aliasUsados[0] === "Jota Lloret";
});

await t("muchos alias no desbordan el presupuesto", () => {
  /*
    Con mas de dos, el presupuesto se iria en variantes de nombre
    en lugar de en plataformas, que es el reparto que ARQ-PUI-001
    corrigio.
  */
  const r = conAlias(
    ["A Lloret", "B Lloret", "C Lloret", "D Lloret", "E Lloret"].map((v) => ({
      valor: v
    }))
  );

  const cubiertas = new Set(
    r.plan.filter((q) => q.plataformaId).map((q) => q.plataformaId)
  );

  return (
    r.aliasUsados.length === 2 &&
    r.aliasDeclarados === 5 &&
    PLATAFORMAS.every((p) => cubiertas.has(p.id))
  );
});

await t("sin alias declarados el plan es idéntico al de antes", () => {
  /*
    El patch no debe cambiar nada para quien no usa alias.
  */
  const vacio = conAlias([]);

  return (
    vacio.plan.length === SIN.plan.length &&
    vacio.plan.every((q, i) => q.consulta === SIN.plan[i].consulta)
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
