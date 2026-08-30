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
6 · EL CLASIFICADOR NO INVENTA UN TIPO
===========================================================

META-COVERAGE-AUDIT-01 encontro esto por un control. El
clasificador daba once perfiles de once activos reales, con
confianza MEDIA. Sonaba demasiado limpio.

Se probo contra paginas conocidas —Meta, BBC News, NASA— y las
tres salieron «perfil». Los tokens que se estaban usando estan
en el armazon que Facebook sirve sin sesion, en cualquier URL:
eran plantilla, no senal.

Un clasificador que acierta el 0 % con confianza alta es peor
que uno que dice «no lo se».
===========================================================
*/
bloque("el HTML publico de Facebook no distingue perfil de pagina");

await t("el armazon sin sesion NO produce una clasificacion", () => {
  /* Lo que Facebook devuelve a un visitante sin sesion. */
  const armazon = `
    <meta property="og:type" content="video.other"/>
    <link rel="canonical" href="https://www.facebook.com/algo"/>
    <script>{"userID":"0","profile_id":null}</script>
  `;

  const t2 = ca.tipoDesdeSenales(ca.senalesDeHtmlFacebook(armazon));

  return t2.assetType === ca.TIPOS_ACTIVO.UNKNOWN && t2.confidence === "NINGUNA";
});

await t("og:type=website tampoco decide: lo usan las dos", () => {
  const t2 = ca.tipoDesdeSenales(
    ca.senalesDeHtmlFacebook('<meta property="og:type" content="website"/>')
  );

  return t2.assetType === ca.TIPOS_ACTIVO.UNKNOWN;
});

await t("og:type=profile SI decide, con confianza alta", () => {
  const t2 = ca.tipoDesdeSenales(
    ca.senalesDeHtmlFacebook('<meta property="og:type" content="profile"/>')
  );

  return (
    t2.assetType === ca.TIPOS_ACTIVO.FACEBOOK_PROFILE && t2.confidence === "ALTA"
  );
});

await t("un canonical con /pages/ decide pagina", () => {
  const t2 = ca.tipoDesdeSenales(
    ca.senalesDeHtmlFacebook(
      '<link rel="canonical" href="https://www.facebook.com/pages/Algo/123"/>'
    )
  );

  return t2.assetType === ca.TIPOS_ACTIVO.FACEBOOK_PAGE;
});

await t("y el UNKNOWN explica que se comprobo con un control", () => {
  const t2 = ca.tipoDesdeSenales(ca.senalesDeHtmlFacebook("<html></html>"));

  return t2.comprobado.includes("control");
});


/*
===========================================================
7 · LA REGLA NO SE DEBILITA
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

/*
  META-COVERAGE-AUDIT-01: auditar cobertura NO es medir. Aunque
  el audit encontrara activos potencialmente elegibles, nada de
  eso habilita el benchmark.
*/
await t("auditar cobertura no cambia habilitaBenchmark", () => {
  return (
    scm.habilitaBenchmark("instagram").habilita === false &&
    scm.habilitaBenchmark("facebook").habilita === false &&
    scm.habilitaBenchmark("youtube").habilita === true &&
    scm.habilitaBenchmark("x").habilita === true
  );
});

await t("UNKNOWN no cuenta ni como elegible ni como no elegible", () => {
  const e = ca.elegibilidadMeta(ca.TIPOS_ACTIVO.UNKNOWN);

  return (
    e.estado === "INDETERMINADA" &&
    e.estado !== "POTENCIALMENTE_ELEGIBLE_META" &&
    e.estado !== "NO_ELEGIBLE_META_PUBLIC_PAGE_API"
  );
});

await t("varios activos de un candidato no lo cuentan varias veces", () => {
  const r = ca.activosDeCandidato({
    candidateId: "uno-solo",
    cuentas: [
      { id: "facebook:a", plataformaId: "facebook", handle: "a", url: "https://www.facebook.com/a" },
      { id: "facebook:b", plataformaId: "facebook", handle: "b", url: "https://www.facebook.com/b" },
      { id: "instagram:c", plataformaId: "instagram", handle: "c", url: "https://www.instagram.com/c" }
    ]
  });

  /* Tres activos, UN candidato. */
  return (
    r.total === 3 &&
    new Set(r.activos.map((a) => a.candidateId)).size === 1
  );
});


/* =========================================================
   P-CAND-ASSET-TYPE-DECLARE-01
   DECLARACION DE TIPO POR EL ANALISTA

   La linea que estas pruebas defienden:

       DECLARADO_POR_ANALISTA != VERIFICADO_TECNICAMENTE

   Es facil de escribir y facil de perder. Basta con que
   alguien, dentro de tres meses, pinte un check verde al lado
   de un tipo declarado para que una hipotesis se convierta en
   una comprobacion sin que nadie decida nada.
========================================================= */

bloque("Declaracion de tipo — Facebook");

/* Cuenta de fixture: URL de vanidad, que es el caso real. */
const cuentaFb = (id, handle) => ({
  id: `facebook:${id}`,
  plataformaId: "facebook",
  url: `https://www.facebook.com/${handle}`,
  handle,
  declaradaPorAnalista: true
});

const cuentaIg = (id, handle) => ({
  id: `instagram:${id}`,
  plataformaId: "instagram",
  url: `https://www.instagram.com/${handle}`,
  handle,
  declaradaPorAnalista: true
});

const declarar = (assetId, platform, declaredType) =>
  ca.crearDeclaracionDeTipo({
    candidateId: "c-1",
    assetId,
    platform,
    url: "https://ejemplo",
    declaredType
  }).declaracion;

await t("1 · una Page declarada queda POTENCIALMENTE_ELEGIBLE_DECLARADA", () => {
  const r = ca.activosDeCandidato({
    candidateId: "c-1",
    cuentas: [cuentaFb("pagina", "pagina")],
    declaraciones: [declarar("facebook:pagina", "facebook", "FACEBOOK_PAGE")]
  });

  const a = r.activos[0];

  return (
    a.assetType === "FACEBOOK_PAGE" &&
    a.assetTypeSource === ca.FUENTE_TIPO.ANALYST_DECLARATION &&
    a.elegibilidadMeta.estado ===
      ca.ELEGIBILIDAD_META.POTENCIALMENTE_ELEGIBLE_DECLARADA
  );
});

await t("2 · un perfil personal declarado NO es elegible por ninguna via", () => {
  const r = ca.activosDeCandidato({
    candidateId: "c-1",
    cuentas: [cuentaFb("perfil", "perfil")],
    declaraciones: [declarar("facebook:perfil", "facebook", "FACEBOOK_PROFILE")]
  });

  const a = r.activos[0];

  return (
    a.assetType === "FACEBOOK_PROFILE" &&
    a.elegibilidadMeta.estado === ca.ELEGIBILIDAD_META.NO_ELEGIBLE &&
    a.elegibilidadMeta.via === null
  );
});

bloque("Declaracion de tipo — Instagram");

await t("3 · «profesional sin afinar» es un tipo valido y elegible", () => {
  /*
    El analista suele saber que la cuenta es profesional sin
    saber si Meta la tiene como Business o Creator. Obligarle a
    elegir seria obligarle a inventar.
  */
  const r = ca.activosDeCandidato({
    candidateId: "c-1",
    cuentas: [cuentaIg("pro", "pro")],
    declaraciones: [declarar("instagram:pro", "instagram", "INSTAGRAM_PROFESSIONAL")]
  });

  const a = r.activos[0];

  return (
    a.assetType === "INSTAGRAM_PROFESSIONAL" &&
    a.elegibilidadMeta.estado ===
      ca.ELEGIBILIDAD_META.POTENCIALMENTE_ELEGIBLE_DECLARADA
  );
});

await t("4 · una cuenta personal de Instagram no la abre ninguna via oficial", () => {
  const r = ca.activosDeCandidato({
    candidateId: "c-1",
    cuentas: [cuentaIg("personal", "personal")],
    declaraciones: [declarar("instagram:personal", "instagram", "INSTAGRAM_PERSONAL")]
  });

  return (
    r.activos[0].elegibilidadMeta.estado ===
    ca.ELEGIBILIDAD_META.NO_ELEGIBLE_INSTAGRAM
  );
});

await t("5 · sin declaracion, UNKNOWN sigue siendo UNKNOWN e INDETERMINADA", () => {
  const r = ca.activosDeCandidato({
    candidateId: "c-1",
    cuentas: [cuentaFb("vanidad", "vanidad"), cuentaIg("vanidad", "vanidad")],
    declaraciones: []
  });

  return r.activos.every(
    (a) =>
      a.assetType === "UNKNOWN" &&
      a.assetTypeSource === ca.FUENTE_TIPO.NINGUNA &&
      a.elegibilidadMeta.estado === ca.ELEGIBILIDAD_META.INDETERMINADA
  );
});

bloque("Declarar no es verificar");

await t("6 · declarar el tipo NO verifica el activo", () => {
  const r = ca.activosDeCandidato({
    candidateId: "c-1",
    cuentas: [cuentaFb("pagina", "pagina")],
    declaraciones: [declarar("facebook:pagina", "facebook", "FACEBOOK_PAGE")]
  });

  const a = r.activos[0];

  return (
    a.assetTypeVerification === "NO_VERIFICADA" &&
    a.elegibilidadMeta.verificadaTecnicamente === false &&
    a.elegibilidadMeta.basadaEnDeclaracion === true
  );
});

await t("7 · una declaracion NO es MEDIDO_TERCERO", () => {
  const e = ca.elegibilidadMeta("FACEBOOK_PAGE", ca.FUENTE_TIPO.ANALYST_DECLARATION);

  const texto = JSON.stringify(e);

  /*
    Ni el estado ni ninguna nota deben poder confundirse con
    una medicion de terceros.
  */
  return (
    e.estado !== scm.ESTADOS_CELDA.MEDIDO &&
    e.estado !== scm.ESTADOS_CELDA.MEDIDO_PROPIO &&
    !texto.includes("MEDIDO_TERCERO")
  );
});

await t("8 · declarar Page o Professional NO habilita el benchmark", () => {
  /*
    El invariante mas caro de perder del gate. Se comprueba la
    funcion real, no una copia.
  */
  ca.activosDeCandidato({
    candidateId: "c-1",
    cuentas: [cuentaFb("pagina", "pagina"), cuentaIg("pro", "pro")],
    declaraciones: [
      declarar("facebook:pagina", "facebook", "FACEBOOK_PAGE"),
      declarar("instagram:pro", "instagram", "INSTAGRAM_BUSINESS")
    ]
  });

  return (
    scm.habilitaBenchmark("facebook").habilita === false &&
    scm.habilitaBenchmark("instagram").habilita === false &&
    scm.habilitaBenchmark("youtube").habilita === true &&
    scm.habilitaBenchmark("x").habilita === true
  );
});

bloque("La declaracion no toca la identidad");

await t("9 · declarar un tipo no funde ni elimina activos hermanos", () => {
  const r = ca.activosDeCandidato({
    candidateId: "c-1",
    cuentas: [cuentaFb("uno", "uno"), cuentaFb("dos", "dos")],
    declaraciones: [declarar("facebook:uno", "facebook", "FACEBOOK_PAGE")]
  });

  return (
    r.total === 2 &&
    r.porPlataforma.facebook.length === 2 &&
    r.variosPorPlataforma.length === 1
  );
});

await t("10 · clasificar un activo deja intacto al hermano", () => {
  const cuentas = [cuentaFb("uno", "uno"), cuentaFb("dos", "dos")];

  const antes = ca.activosDeCandidato({ candidateId: "c-1", cuentas });

  const despues = ca.activosDeCandidato({
    candidateId: "c-1",
    cuentas,
    declaraciones: [declarar("facebook:uno", "facebook", "FACEBOOK_PAGE")]
  });

  const hermanoAntes = antes.activos.find((a) => a.accountId === "facebook:dos");

  const hermanoDespues = despues.activos.find((a) => a.accountId === "facebook:dos");

  /*
    Identidad, tipo y elegibilidad del hermano: los tres igual
    que antes. La declaracion se busca por accountId, asi que
    no hay forma de que alcance a otro registro — y esta prueba
    lo fija por si alguien cambia la clave.
  */
  return (
    hermanoDespues.url === hermanoAntes.url &&
    hermanoDespues.handle === hermanoAntes.handle &&
    hermanoDespues.assetType === "UNKNOWN" &&
    hermanoDespues.assetTypeSource === ca.FUENTE_TIPO.NINGUNA &&
    hermanoDespues.elegibilidadMeta.estado === ca.ELEGIBILIDAD_META.INDETERMINADA
  );
});

await t("11 · un candidato puede tener Page y Profile a la vez", () => {
  /*
    El caso real que motiva el gate: dos activos de Facebook,
    uno de cada clase. Ninguno sustituye al otro y el
    candidato es alcanzable por la pagina sin que eso vuelva
    alcanzable al perfil.
  */
  const r = ca.activosDeCandidato({
    candidateId: "c-1",
    cuentas: [cuentaFb("uno", "uno"), cuentaFb("dos", "dos")],
    declaraciones: [
      declarar("facebook:uno", "facebook", "FACEBOOK_PROFILE"),
      declarar("facebook:dos", "facebook", "FACEBOOK_PAGE")
    ]
  });

  const tipos = r.activos.map((a) => a.assetType).sort();

  const elegibles = r.activos.filter(
    (a) =>
      a.elegibilidadMeta.estado ===
      ca.ELEGIBILIDAD_META.POTENCIALMENTE_ELEGIBLE_DECLARADA
  );

  return (
    r.total === 2 &&
    tipos.join(",") === "FACEBOOK_PAGE,FACEBOOK_PROFILE" &&
    elegibles.length === 1
  );
});

bloque("Persistencia y aislamiento");

await t("12 · las declaraciones no se filtran entre proyectos", async () => {
  const idA = `tipos-a-${Date.now()}`;
  const idB = `tipos-b-${Date.now()}`;

  await ps.crearProyecto({ id: idA, nombre: "Tipos A" });
  await ps.crearProyecto({ id: idB, nombre: "Tipos B" });

  await ps.guardarDeclaracionesDeTipo(idA, "cand-1", [
    declarar("facebook:x", "facebook", "FACEBOOK_PAGE")
  ]);

  const enA = await ps.declaracionesDeTipoDe(idA, "cand-1");
  const enB = await ps.declaracionesDeTipoDe(idB, "cand-1");

  return enA.total === 1 && enB.total === 0;
});

await t("13 · ida y vuelta: se guarda, se lee y gana la ultima", async () => {
  const id = `tipos-rt-${Date.now()}`;

  await ps.crearProyecto({ id, nombre: "Tipos RT" });

  await ps.guardarDeclaracionesDeTipo(
    id,
    "cand-1",
    [declarar("facebook:x", "facebook", "FACEBOOK_PROFILE")],
    { declaradoEn: "2026-08-01T00:00:00.000Z" }
  );

  /* El analista se corrige: era una pagina. */
  await ps.guardarDeclaracionesDeTipo(
    id,
    "cand-1",
    [declarar("facebook:x", "facebook", "FACEBOOK_PAGE")],
    { declaradoEn: "2026-08-02T00:00:00.000Z" }
  );

  const r = await ps.declaracionesDeTipoDe(id, "cand-1");

  /*
    Una vigente y DOS en el historial: corregirse no borra que
    antes se dijo otra cosa.
  */
  return (
    r.total === 1 &&
    r.declaraciones[0].declaredType === "FACEBOOK_PAGE" &&
    r.historial.length === 2 &&
    r.declaraciones[0].source === "ANALYST_DECLARATION" &&
    r.declaraciones[0].verificationStatus === "NO_VERIFICADA"
  );
});

bloque("Cobertura en tres niveles");

const conActivos = (candidateId, cuentas, declaraciones) =>
  ca.activosDeCandidato({ candidateId, cuentas, declaraciones });

await t("14 · la cobertura declarada no se suma a la confirmada", () => {
  const c = ca.coberturaMetaDeclarada([
    conActivos("a", [cuentaFb("a", "a")], [declarar("facebook:a", "facebook", "FACEBOOK_PAGE")]),
    conActivos("b", [cuentaFb("b", "b")], [])
  ]);

  return (
    c.COBERTURA_DECLARADA.candidatos === 1 &&
    c.COBERTURA_CONFIRMADA.candidatos === 0 &&
    c.COBERTURA_DESCONOCIDA.candidatos === 1 &&
    c.noEsMedicion.includes("MEDIDO_TERCERO")
  );
});

await t("15 · UNKNOWN no cuenta como elegible", () => {
  const c = ca.coberturaMetaDeclarada([
    conActivos("a", [cuentaFb("a", "a")], []),
    conActivos("b", [cuentaIg("b", "b")], [])
  ]);

  return (
    c.COBERTURA_CONFIRMADA.candidatos === 0 &&
    c.COBERTURA_DECLARADA.candidatos === 0 &&
    c.COBERTURA_DESCONOCIDA.candidatos === 2
  );
});

await t("16 · UNKNOWN tampoco cuenta como NO elegible", () => {
  /*
    El error que casi se comete en META-COVERAGE-AUDIT-01. Un
    candidato con un perfil personal declarado Y un activo sin
    clasificar NO esta fuera: el segundo activo podria ser una
    pagina.
  */
  const c = ca.coberturaMetaDeclarada([
    conActivos(
      "a",
      [cuentaFb("perfil", "perfil"), cuentaFb("otro", "otro")],
      [declarar("facebook:perfil", "facebook", "FACEBOOK_PROFILE")]
    )
  ]);

  return (
    c.SIN_COBERTURA.candidatos === 0 &&
    c.COBERTURA_DESCONOCIDA.candidatos === 1 &&
    c.reglaUnknown.toLowerCase().includes("no se suma")
  );
});

await t("17 · solo con TODOS los activos no elegibles se declara fuera", () => {
  const c = ca.coberturaMetaDeclarada([
    conActivos(
      "a",
      [cuentaFb("perfil", "perfil"), cuentaIg("personal", "personal")],
      [
        declarar("facebook:perfil", "facebook", "FACEBOOK_PROFILE"),
        declarar("instagram:personal", "instagram", "INSTAGRAM_PERSONAL")
      ]
    )
  ]);

  return c.SIN_COBERTURA.candidatos === 1 && c.COBERTURA_DESCONOCIDA.candidatos === 0;
});

await t("18 · no tener cuenta en una plataforma no es «no elegible»", () => {
  /*
    Un candidato real del proyecto no tiene Facebook. Eso no
    dice nada sobre si su Facebook seria elegible.
  */
  const c = ca.coberturaMetaDeclarada([
    conActivos("a", [cuentaIg("a", "a")], [declarar("instagram:a", "instagram", "INSTAGRAM_BUSINESS")])
  ]);

  return (
    c.porPlataforma.facebook.noElegible === 0 &&
    c.porPlataforma.facebook.desconocida === 0 &&
    c.porPlataforma.instagram.declarada === 1
  );
});

bloque("Validacion de tipos");

await t("19 · un tipo de otra plataforma se rechaza", () => {
  const r = ca.crearDeclaracionDeTipo({
    assetId: "facebook:x",
    platform: "facebook",
    declaredType: "INSTAGRAM_BUSINESS"
  });

  return r.valido === false && r.motivo.includes("no es un tipo valido");
});

await t("20 · la declaracion de tipo no aplica fuera de Meta", () => {
  const r = ca.crearDeclaracionDeTipo({
    assetId: "x:y",
    platform: "x",
    declaredType: "FACEBOOK_PAGE"
  });

  return r.valido === false && r.motivo.includes("solo aplica a activos de Meta");
});

await t("21 · retirar la clasificacion devuelve el activo a UNKNOWN", () => {
  const n = ca.normalizarTipoDeclarado("facebook", "");

  return n.valido === true && n.tipo === "UNKNOWN";
});

await t("22 · una declaracion que contradice a la URL deja la discrepancia visible", () => {
  /*
    `/profile.php?id=` es inequivoco. Si el analista declara
    que es una pagina, uno de los dos esta mal: se conserva la
    declaracion y se registra el conflicto en lugar de tapar
    uno con otro.
  */
  const r = ca.activosDeCandidato({
    candidateId: "c-1",
    cuentas: [
      {
        id: "facebook:num",
        plataformaId: "facebook",
        url: "https://www.facebook.com/profile.php?id=100001",
        handle: null
      }
    ],
    declaraciones: [declarar("facebook:num", "facebook", "FACEBOOK_PAGE")]
  });

  const a = r.activos[0];

  return (
    a.assetType === "FACEBOOK_PAGE" &&
    a.assetTypeTecnico === "FACEBOOK_PROFILE" &&
    typeof a.assetTypeConflicto === "string" &&
    a.assetTypeConflicto.includes("una de las dos esta mal")
  );
});


/* =========================================================
   P-CAND-ASSET-TYPE-UI-FIX-01

   El gate anterior implemento el selector en un componente que
   la pantalla real no usa, y lo reporto como hecho. Las 1037
   pruebas seguian pasando: el backend devolvia los tipos bien y
   ninguna prueba miraba lo que la pantalla recibia.

   Lo que sigue cubre el lado del backend —que la ficha lleve lo
   que el selector necesita—. El render lo comprueba
   `apps/web/tests/identity-form.check.jsx`, porque que la
   funcion devuelva el dato no significa que la pantalla lo
   pinte.
========================================================= */

bloque("La ficha lleva lo que el selector necesita");

await t("23 · cada activo Meta declara sus tipos admitidos", () => {
  const r = ca.activosDeCandidato({
    candidateId: "c-1",
    cuentas: [cuentaFb("a", "a"), cuentaIg("b", "b")]
  });

  const fb = r.activos.find((x) => x.platform === "facebook");
  const ig = r.activos.find((x) => x.platform === "instagram");

  /*
    La UI pinta estas listas. Si vinieran vacias el selector se
    renderiza sin opciones, que es indistinguible de no estar.
  */
  return (
    fb.tiposAdmitidos.length === 3 &&
    ig.tiposAdmitidos.length === 5 &&
    fb.tiposAdmitidos[0] === "UNKNOWN" &&
    ig.tiposAdmitidos[0] === "UNKNOWN"
  );
});

await t("24 · un activo que no es de Meta no ofrece tipos", () => {
  const r = ca.activosDeCandidato({
    candidateId: "c-1",
    cuentas: [
      { id: "x:handle", plataformaId: "x", url: "https://x.com/handle", handle: "handle" }
    ]
  });

  /* Sin tipos no hay selector, que es lo correcto: la distincion
     perfil/pagina no existe fuera de Meta. */
  return r.activos[0].tiposAdmitidos.length === 0;
});

await t("25 · el tipo declarado viaja aparte del efectivo", () => {
  /*
    El selector se pinta con `assetTypeDeclared`, no con
    `assetType`. Si usara el efectivo, un activo cuyo tipo salio
    de la URL apareceria como si el analista lo hubiera
    declarado.
  */
  const r = ca.activosDeCandidato({
    candidateId: "c-1",
    cuentas: [
      {
        id: "facebook:num",
        plataformaId: "facebook",
        url: "https://www.facebook.com/profile.php?id=100002",
        handle: null
      }
    ]
  });

  const a = r.activos[0];

  return (
    a.assetType === "FACEBOOK_PROFILE" &&
    a.assetTypeDeclared === null &&
    a.assetTypeSource === "PUBLIC_METADATA"
  );
});

await t("26 · el estado de identidad y el tipo son campos distintos", () => {
  /*
    Una cuenta puede estar consolidada —sabemos que es suya— y
    seguir sin tipo. Y al reves. La pantalla los pinta por
    separado porque lo son.
  */
  const r = ca.activosDeCandidato({
    candidateId: "c-1",
    cuentas: [
      {
        ...cuentaFb("consolidada", "consolidada"),
        estado: "CONSOLIDADA",
        senalesIndependientes: [{ tipo: "CROSS_LINK" }]
      }
    ]
  });

  const a = r.activos[0];

  return (
    a.verificationStatus === "VERIFICADA" &&
    a.relationshipToCandidate === "OFFICIAL" &&
    a.assetType === "UNKNOWN" &&
    a.assetTypeVerification === "NO_VERIFICADA"
  );
});

await t("27 · declarar un tipo no asciende la verificacion de identidad", () => {
  const cuentas = [cuentaFb("solo", "solo")];

  const antes = ca.activosDeCandidato({ candidateId: "c-1", cuentas }).activos[0];

  const despues = ca.activosDeCandidato({
    candidateId: "c-1",
    cuentas,
    declaraciones: [declarar("facebook:solo", "facebook", "FACEBOOK_PAGE")]
  }).activos[0];

  return (
    antes.relationshipToCandidate === despues.relationshipToCandidate &&
    antes.verificationStatus === despues.verificationStatus &&
    despues.verificationStatus === "NO_VERIFICADA"
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
