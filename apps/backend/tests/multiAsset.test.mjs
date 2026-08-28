// apps/backend/tests/multiAsset.test.mjs

/*
===========================================================
PRUEBAS DE MULTI-ACTIVO POR PLATAFORMA
P-CAND-FB-MULTI-ASSET-01
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/multiAsset.test.mjs

SIN RED. Fixtures sinteticos con la misma forma que el caso
real.

LA REGLA QUE DEFIENDEN
-----------------------------------------------------------

    UN CANDIDATO PUEDE TENER N ACTIVOS POR PLATAFORMA.

El caso que lo motiva es real: un candidato con perfil Y pagina
de Facebook. Perder uno de los dos —por deduplicacion, por
sustitucion al editar, o porque alguien eligio «el principal»—
es perder la mitad de su presencia en esa plataforma.

Y una segunda regla, mas facil de romper todavia:

    ELEGIBLE PARA META != MEDIBLE.

Que una pagina PODRIA alcanzarse con Page Public Content Access
no significa que se mida hoy, ni habilita el benchmark.
===========================================================
*/

process.env.SENTINEL_LAKE_ADAPTER = "memoria";

const ps = await import("../services/projects/projectStore.js");

const ca = await import("../services/intelligence/candidateAssets.js");

const scm = await import("../services/intelligence/socialCapabilityMatrix.js");

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
    console.log(`  ERR   ${nombre}  ${error.message}`);
  }
}

function bloque(titulo) {
  console.log(`\n--- ${titulo} ---`);
}


/*
===========================================================
1 · CLASIFICACION DE ACTIVOS
===========================================================
*/
bloque("perfil y pagina: solo cuando hay senal");

await t("profile.php?id= es un PERFIL", () => {
  const r = ca.clasificarActivoFacebook({
    url: "https://www.facebook.com/profile.php?id=100001234567890"
  });

  return r.assetType === ca.TIPOS_ACTIVO.FACEBOOK_PROFILE && r.determinado === true;
});

await t("/pages/ es una PAGINA", () => {
  const r = ca.clasificarActivoFacebook({
    url: "https://www.facebook.com/pages/Algo-Ficticio/123456789"
  });

  return r.assetType === ca.TIPOS_ACTIVO.FACEBOOK_PAGE && r.determinado === true;
});

/*
  EL CASO REAL. Las dos URLs de Jota son de vanidad, y esa forma
  la usan tanto los perfiles como las paginas.
*/
await t("una URL de vanidad NO se clasifica: queda UNKNOWN", () => {
  const r = ca.clasificarActivoFacebook({
    url: "https://www.facebook.com/nombre_ficticio"
  });

  return r.assetType === ca.TIPOS_ACTIVO.UNKNOWN && r.determinado === false;
});

await t("y explica por que no se adivina", () => {
  const r = ca.clasificarActivoFacebook({
    url: "https://www.facebook.com/nombre_ficticio"
  });

  return (
    r.motivo.includes("tanto los perfiles como las paginas") &&
    r.comoSeSabria.length === 3
  );
});

await t("og:type si decide cuando existe", () => {
  const r = ca.clasificarActivoFacebook({
    url: "https://www.facebook.com/nombre_ficticio",
    ogType: "profile"
  });

  return r.assetType === ca.TIPOS_ACTIVO.FACEBOOK_PROFILE;
});

await t("senales en conflicto NO se resuelven por mayoria", () => {
  const r = ca.clasificarActivoFacebook({
    url: "https://www.facebook.com/pages/x/1",
    ogType: "profile"
  });

  return r.assetType === ca.TIPOS_ACTIVO.UNKNOWN && r.motivo.includes("conflicto");
});


/*
===========================================================
2 · ELEGIBILIDAD POR ACTIVO, NO POR CANDIDATO
===========================================================
*/
bloque("elegibilidad Meta por activo");

await t("una PAGINA es potencialmente elegible", () => {
  const e = ca.elegibilidadMeta(ca.TIPOS_ACTIVO.FACEBOOK_PAGE);

  return (
    e.estado === "POTENCIALMENTE_ELEGIBLE_META" &&
    e.via === "Page Public Content Access"
  );
});

await t("un PERFIL no lo es por ninguna via", () => {
  const e = ca.elegibilidadMeta(ca.TIPOS_ACTIVO.FACEBOOK_PROFILE);

  return (
    e.estado === "NO_ELEGIBLE_META_PUBLIC_PAGE_API" &&
    e.nota.includes("no existe")
  );
});

/*
  LA CONFUSION QUE HAY QUE EVITAR. Elegible no es medible.
*/
await t("elegible NO habilita el benchmark", () => {
  const e = ca.elegibilidadMeta(ca.TIPOS_ACTIVO.FACEBOOK_PAGE);

  return (
    e.habilitaBenchmark === false &&
    e.nota.includes("no medicion") &&
    scm.habilitaBenchmark("facebook").habilita === false
  );
});

await t("una pagina elegible NO vuelve elegible al perfil del mismo candidato", () => {
  const r = ca.activosDeCandidato({
    candidateId: "cand-x",
    cuentas: [
      {
        id: "facebook:pagina",
        plataformaId: "facebook",
        url: "https://www.facebook.com/pages/Ficticia/1",
        handle: "pagina"
      },
      {
        id: "facebook:perfil",
        plataformaId: "facebook",
        url: "https://www.facebook.com/profile.php?id=100009",
        handle: "perfil"
      }
    ]
  });

  const pagina = r.activos.find((a) => a.accountId === "facebook:pagina");

  const perfil = r.activos.find((a) => a.accountId === "facebook:perfil");

  return (
    pagina.elegibilidadMeta.estado === "POTENCIALMENTE_ELEGIBLE_META" &&
    perfil.elegibilidadMeta.estado === "NO_ELEGIBLE_META_PUBLIC_PAGE_API"
  );
});

await t("sin tipo determinado la elegibilidad es INDETERMINADA, no optimista", () => {
  return (
    ca.elegibilidadMeta(ca.TIPOS_ACTIVO.UNKNOWN).estado === "INDETERMINADA"
  );
});


/*
===========================================================
3 · RELACION CON EL CANDIDATO
===========================================================
*/
bloque("no se regala oficialidad");

await t("declarada por el analista y sin corroborar: DECLARED_BY_ANALYST", () => {
  const r = ca.relacionConCandidato({ declaradaPorAnalista: true });

  return (
    r.relationshipToCandidate === ca.RELACION.DECLARED_BY_ANALYST &&
    r.verificationStatus === "NO_VERIFICADA"
  );
});

await t("devuelta por un proveedor: ASSOCIATED, todavia no verificada", () => {
  const r = ca.relacionConCandidato({ corroboradaPorSentinel: true });

  return (
    r.relationshipToCandidate === ca.RELACION.ASSOCIATED &&
    r.verificationStatus === "NO_VERIFICADA"
  );
});

await t("solo con senal independiente se llega a OFFICIAL", () => {
  const r = ca.relacionConCandidato({
    senalesIndependientes: ["web_declarada"]
  });

  return (
    r.relationshipToCandidate === ca.RELACION.OFFICIAL &&
    r.verificationStatus === "VERIFICADA"
  );
});

await t("tener mas seguidores NO asciende a OFFICIAL", () => {
  const r = ca.relacionConCandidato({
    declaradaPorAnalista: true,
    followers: 999999
  });

  return r.relationshipToCandidate === ca.RELACION.DECLARED_BY_ANALYST;
});


/*
===========================================================
4 · EL CASO DE REGRESION
===========================================================
*/
bloque("dos activos de Facebook en un mismo candidato");

const PID = "multi-asset";

await ps.crearProyecto({
  id: PID,
  nombre: "Multi activo",
  canton: "Canton Ficticio",
  pais: "Ecuador",
  dignidad: "Alcaldía"
});

await ps.agregarCandidato(PID, { nombre: "Aspirante Con Dos Facebook" });

const CID = "aspirante-con-dos-facebook";

const URL_A = "https://www.facebook.com/perfil.ficticio";

const URL_B = "https://www.facebook.com/paginaficticia";

await t("se pueden agregar DOS cuentas de Facebook", async () => {
  await ps.editarCandidato(PID, CID, {
    cuentas: [
      { url: URL_A, plataformaId: "facebook" },
      { url: URL_B, plataformaId: "facebook" }
    ]
  });

  const f = await ps.fichaIdentidad(PID, CID, "candidato");

  const fb = f.plataformas.flatMap((p) => p.cuentas || []).filter(
    (c) => c.plataformaId === "facebook"
  );

  return fb.length === 2;
});

await t("las dos sobreviven a la relectura desde el Lake", async () => {
  const cand = await ps.obtenerCandidato(PID, CID);

  const fb = (cand.cuentasReferencia || []).filter(
    (c) => c.plataformaId === "facebook"
  );

  return fb.length === 2;
});

await t("tienen identidad separada: plataforma + handle", async () => {
  const f = await ps.fichaIdentidad(PID, CID, "candidato");

  const ids = f.plataformas
    .flatMap((p) => p.cuentas || [])
    .filter((c) => c.plataformaId === "facebook")
    .map((c) => c.id);

  return new Set(ids).size === 2;
});

/*
  EL FALSO DUPLICADO QUE HAY QUE EVITAR: mismo candidato, misma
  plataforma, mismo nombre para mostrar. Nada de eso las hace la
  misma cuenta.
*/
await t("NO se deduplican por compartir candidato y plataforma", async () => {
  const f = await ps.fichaIdentidad(PID, CID, "candidato");

  const fb = f.plataformas
    .flatMap((p) => p.cuentas || [])
    .filter((c) => c.plataformaId === "facebook");

  return fb.length === 2 && fb[0].handle !== fb[1].handle;
});

await t("agregar una TERCERA no sustituye a las anteriores", async () => {
  await ps.editarCandidato(PID, CID, {
    cuentas: [{ url: "https://www.facebook.com/tercera.ficticia", plataformaId: "facebook" }]
  });

  const f = await ps.fichaIdentidad(PID, CID, "candidato");

  const fb = f.plataformas
    .flatMap((p) => p.cuentas || [])
    .filter((c) => c.plataformaId === "facebook");

  return fb.length === 3;
});

await t("editar otro campo NO borra ninguna cuenta", async () => {
  await ps.editarCandidato(PID, CID, { nombre: "Aspirante Con Dos Facebook" });

  const f = await ps.fichaIdentidad(PID, CID, "candidato");

  const fb = f.plataformas
    .flatMap((p) => p.cuentas || [])
    .filter((c) => c.plataformaId === "facebook");

  return fb.length === 3;
});

await t("la misma URL dos veces SI se deduplica: es el mismo activo", async () => {
  await ps.editarCandidato(PID, CID, {
    cuentas: [{ url: URL_A, plataformaId: "facebook" }]
  });

  const f = await ps.fichaIdentidad(PID, CID, "candidato");

  const fb = f.plataformas
    .flatMap((p) => p.cuentas || [])
    .filter((c) => c.plataformaId === "facebook");

  return fb.length === 3;
});

await t("el motor de activos declara la pluralidad sin corregirla", async () => {
  const f = await ps.fichaIdentidad(PID, CID, "candidato");

  const r = ca.activosDeCandidato({
    candidateId: CID,
    cuentas: f.plataformas.flatMap((p) => p.cuentas || [])
  });

  const fb = r.variosPorPlataforma.find((x) => x.plataforma === "facebook");

  return fb.activos === 3 && fb.nota.includes("ninguno sustituye al otro");
});

await t("NO se elige un activo principal automaticamente", async () => {
  const f = await ps.fichaIdentidad(PID, CID, "candidato");

  const r = ca.activosDeCandidato({
    candidateId: CID,
    cuentas: f.plataformas.flatMap((p) => p.cuentas || [])
  });

  return (
    r.principal === null &&
    r.notaPrincipal.includes("deduce del numero de seguidores") &&
    r.notaPrincipal.includes("No se elige")
  );
});

await t("otro candidato del mismo proyecto no ve estas cuentas", async () => {
  await ps.agregarCandidato(PID, { nombre: "Otro Aspirante Ficticio" });

  const f = await ps.fichaIdentidad(PID, "otro-aspirante-ficticio", "candidato");

  const fb = f.plataformas
    .flatMap((p) => p.cuentas || [])
    .filter((c) => c.plataformaId === "facebook");

  return fb.length === 0;
});


/*
===========================================================
5 · DISCOVERY: ENCONTRAR UNO NO CIERRA LA PLATAFORMA
===========================================================

El gap que este gate encontro. La propagacion de handles omitia
la PLATAFORMA entera en cuanto tenia una cuenta atribuida, asi
que el segundo activo de Facebook no se buscaba nunca por esa
via.
===========================================================
*/
bloque("un activo encontrado no cierra el discovery de su plataforma");

const pa = await import("../services/social/discovery/platformAdapters.js");

const pc = await import("../services/projects/projectContext.js");

const ctx = pc.construirContextoMaestro(
  {
    nombre: "Proyecto Ficticio",
    canton: "Canton Ficticio",
    pais: "Ecuador",
    dignidad: "Alcaldía"
  },
  { nombre: "Persona Ficticia Ejemplo", nivel: "cantonal" }
);

const baseCtx = pc.aplicarContextoMaestro(
  {
    nombrePrincipal: "Persona Ficticia Ejemplo",
    contexto: { rol: "Candidato", pais: "Ecuador" }
  },
  ctx
);

const planDe = (handles) =>
  pa.planificarConsultasDerivadas({ ...baseCtx, handlesConocidos: handles }, {});

/* Un handle YA atribuido en Facebook, y otro distinto por probar. */
const DOS_HANDLES = [
  {
    handle: "handleatribuido",
    plataformaId: "facebook",
    plataforma: "Facebook",
    url: "https://facebook.com/handleatribuido",
    atribuida: true
  },
  { handle: "segundohandle", atribuida: false }
];

await t("el MISMO handle no se repregunta en su plataforma", () => {
  const r = planDe(DOS_HANDLES);

  return (r.propagacionOmitidaPorAtribuida || []).some((x) =>
    x.startsWith("facebook:handleatribuido")
  );
});

/*
  LA CORRECCION, EN UNA LINEA: la omision es por PAR, no por
  plataforma. Antes esta lista habria cerrado «facebook» entero;
  ahora nombra el handle concreto que ya esta resuelto.
*/
await t("la omision nombra el par plataforma:handle, no la plataforma sola", () => {
  const omitidas = planDe(DOS_HANDLES).propagacionOmitidaPorAtribuida || [];

  return (
    omitidas.length > 0 &&
    omitidas.every((x) => x.includes(":")) &&
    !omitidas.includes("facebook")
  );
});

await t("el segundo handle NO se omite por estar Facebook resuelto", () => {
  const r = planDe(DOS_HANDLES);

  /*
    Puede no llegar a ejecutarse por el tope de propagadas —que
    se declara en `propagadasTruncadas`—, pero eso es un limite
    de presupuesto y no una plataforma cerrada. Son dos cosas
    distintas y solo una era el defecto.
  */
  const omitido = (r.propagacionOmitidaPorAtribuida || []).some((x) =>
    x.includes("segundohandle")
  );

  return omitido === false && r.propagadasTruncadas >= 0;
});

await t("Facebook deja de estar cerrado: sin competencia, se propaga", () => {
  const soloOtro = planDe([
    {
      handle: "handleatribuido",
      plataformaId: "facebook",
      plataforma: "Facebook",
      url: "https://facebook.com/handleatribuido",
      atribuida: true
    }
  ]);

  /*
    Con un unico handle atribuido en Facebook, la propagacion ya
    no evita esa plataforma por principio: solo evita repetir ese
    handle. El resto del plan lo decide el presupuesto.
  */
  const omitidas = soloOtro.propagacionOmitidaPorAtribuida || [];

  return omitidas.every((x) => x === "facebook:handleatribuido");
});


/*
===========================================================
6 · LA REGLA NO SE DEBILITA
===========================================================
*/
bloque("elegibilidad no es medicion");

await t("MEDIDO_PROPIO sigue sin habilitar el benchmark", () => {
  return (
    scm.habilitaBenchmark("instagram").habilita === false &&
    scm.habilitaBenchmark("facebook").habilita === false
  );
});

await t("y solo YouTube y X lo habilitan", () => {
  return (
    scm.habilitaBenchmark("youtube").habilita === true &&
    scm.habilitaBenchmark("x").habilita === true
  );
});

await t("el motor de activos lo dice por escrito", () => {
  const r = ca.activosDeCandidato({ candidateId: "x", cuentas: [] });

  return r.elegibilidadNoEsMedicion.includes("no habilita el benchmark");
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
