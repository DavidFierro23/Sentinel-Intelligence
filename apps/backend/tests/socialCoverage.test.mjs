// apps/backend/tests/socialCoverage.test.mjs

/*
===========================================================
COBERTURA SOCIAL DE CANDIDATE INTELLIGENCE
P-CAND-SOCIAL-COVERAGE-01
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/socialCoverage.test.mjs

SIN RED. `fetch` inyectado con la forma REAL de las respuestas
de Meta medidas en los gates anteriores.

LAS DOS REGLAS QUE DEFIENDEN
-----------------------------------------------------------

    MEDIDO_PROPIO_AUTORIZADO != MEDIDO_TERCERO

Las dos devuelven HTTP 200 y los mismos campos. Se distinguen
por si el token administra la cuenta, no por la respuesta —y en
META-THIRD-PARTY-REAL-02 esa confusion estuvo a punto de
producir un falso positivo.

    UNA AUSENCIA NO ES UN CERO

Una metrica que Meta no devuelve queda NO_DISPONIBLE. Un 0 es
una medicion; la ausencia no lo es, y rellenarla convierte «no
lo sabemos» en «no tiene».
===========================================================
*/

process.env.SENTINEL_LAKE_ADAPTER = "memoria";

process.env.INSTAGRAM_ACCESS_TOKEN = "IGQ-TOKEN-FICTICIO-NO-REAL-000";

process.env.FACEBOOK_USER_ACCESS_TOKEN = "EAA-TOKEN-FICTICIO-NO-REAL-000";

const ps = await import("../services/projects/projectStore.js");

const co = await import("../services/intelligence/candidateObservation.js");

const cb = await import("../services/intelligence/candidateBaseline.js");

const scm = await import("../services/intelligence/socialCapabilityMatrix.js");

const ig = await import("../services/ingest/adapters/instagramAdapter.js");

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


/* Respuesta con la forma real de business_discovery. */
const respuestaBd = (handle, extra = {}) => async () => ({
  ok: true,
  status: 200,
  text: async () =>
    JSON.stringify({
      business_discovery: {
        username: handle,
        name: "Nombre Ficticio",
        followers_count: 9719,
        media_count: 1635,
        media: {
          data: [
            {
              id: "18138113440516091",
              permalink: "https://www.instagram.com/p/DXBOgKHjmEC/",
              timestamp: "2026-04-12T05:02:45+0000",
              media_type: "IMAGE",
              like_count: 19,
              comments_count: 1
            },
            {
              id: "18066323309741557",
              permalink: "https://www.instagram.com/reel/DcORd82x4kA/",
              timestamp: "2026-03-22T13:16:51+0000",
              media_type: "VIDEO",
              like_count: 28,
              comments_count: 0
            }
          ]
        },
        ...extra
      }
    })
});

const cuentaIg = (handle) => ({
  id: `instagram:${handle}`,
  plataformaId: "instagram",
  url: `https://www.instagram.com/${handle}`,
  handle
});

const observar = (handle, opciones = {}) =>
  co.observarInstagram({
    candidateId: "cand-1",
    projectId: "proj-1",
    cuenta: cuentaIg(handle),
    idParaBusinessDiscovery: "17841404365486006",
    cuentasPropias: opciones.propias || [],
    maximoPublicaciones: 5,
    observedAt: "2026-08-30T12:00:00.000Z",
    fetchImpl: opciones.fetch || respuestaBd(handle)
  });


bloque("Tercero y propio: identicos en la respuesta, distintos en el dato");

await t("una cuenta que NO administramos es MEDIDO_TERCERO", async () => {
  const r = await observar("tercero_ficticio", { propias: ["otra_cuenta"] });

  return (
    r.estado === "OBSERVADA" &&
    r.alcanceDeLaMedicion === "MEDIDO_TERCERO" &&
    r.esPropia === false
  );
});

await t("la misma respuesta, sobre cuenta propia, es MEDIDO_PROPIO_AUTORIZADO", async () => {
  /*
    Identica respuesta de Meta. Lo unico que cambia es que el
    handle esta en `cuentasPropias`. Si esta prueba se rompiera,
    Sentinel presentaria una consulta a si mismo como
    observacion de un candidato.
  */
  const r = await observar("propia_ficticia", { propias: ["propia_ficticia"] });

  return (
    r.estado === "OBSERVADA" &&
    r.alcanceDeLaMedicion === "MEDIDO_PROPIO_AUTORIZADO" &&
    r.esPropia === true &&
    r.notaAlcance.includes("NO demuestra acceso a terceros")
  );
});

await t("el alcance no se deduce de la respuesta: distingue mayusculas y arrobas", async () => {
  const r = await observar("Propia_Ficticia", { propias: ["@propia_ficticia"] });

  return r.alcanceDeLaMedicion === "MEDIDO_PROPIO_AUTORIZADO";
});

bloque("Multi-activo: ningun activo se colapsa");

await t("tres activos del mismo candidato producen tres observaciones", async () => {
  const cuentas = ["uno", "dos", "tres"].map(cuentaIg);

  const r = await co.observarCandidato({
    candidateId: "cand-1",
    projectId: "proj-1",
    cuentas,
    plataformas: ["instagram"],
    idParaBusinessDiscovery: "17841404365486006",
    cuentasPropias: [],
    observedAt: "2026-08-30T12:00:00.000Z",
    fetchImpl: respuestaBd("cualquiera")
  });

  const ids = r.resultados.map((x) => x.accountId);

  return (
    r.resultados.length === 3 &&
    new Set(ids).size === 3 &&
    r.publicaciones.length === 6
  );
});

await t("encontrar uno NO cierra la plataforma", async () => {
  const cuentas = [cuentaIg("uno"), cuentaIg("dos")];

  const r = await co.observarCandidato({
    candidateId: "cand-1",
    projectId: "proj-1",
    cuentas,
    plataformas: ["instagram"],
    idParaBusinessDiscovery: "17841404365486006",
    observedAt: "2026-08-30T12:00:00.000Z",
    fetchImpl: respuestaBd("cualquiera")
  });

  /* Las dos observadas, no la primera y basta. */
  return r.resultados.filter((x) => x.estado === "OBSERVADA").length === 2;
});

bloque("Una ausencia no es un cero");

await t("una metrica que Meta no devuelve queda NO_DISPONIBLE", async () => {
  const sinLikes = async () => ({
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        business_discovery: {
          username: "x",
          followers_count: 100,
          media_count: 10,
          media: {
            data: [
              {
                id: "1",
                permalink: "https://www.instagram.com/p/A/",
                timestamp: "2026-08-01T00:00:00+0000",
                media_type: "IMAGE",
                comments_count: 3
              }
            ]
          }
        }
      })
  });

  const r = await observar("x", { fetch: sinLikes });

  const pub = r.publicaciones[0];

  const likes = (pub.metricas || []).find((m) => m.metrica === "likes");

  const coments = (pub.metricas || []).find((m) => m.metrica === "comments");

  return (
    likes.value === null &&
    likes.availability === "NO_DISPONIBLE" &&
    likes.value !== 0 &&
    /* Y un 3 real sigue siendo un 3. */
    coments.value === 3 &&
    coments.availability === "DISPONIBLE"
  );
});

await t("un cero real SI es un dato", async () => {
  const r = await observar("x");

  const segunda = r.publicaciones[1];

  const coments = (segunda.metricas || []).find((m) => m.metrica === "comments");

  /*
    La segunda publicacion del fixture trae comments_count: 0.
    Cero no es ausencia: es que nadie comento.
  */
  return coments.value === 0 && coments.availability === "DISPONIBLE";
});

await t("no se inventan owner insights para el tercero", async () => {
  const r = await observar("x");

  const nombres = (r.publicaciones[0].metricas || []).map((m) => m.metrica);

  return (
    !nombres.includes("reach") &&
    !nombres.includes("impressions") &&
    !nombres.includes("saved") &&
    !nombres.includes("shares")
  );
});

bloque("Cuenta personal: la via no la alcanza, y no es un error nuestro");

await t("business_discovery sobre una personal da NO_SOPORTADO_PERSONAL", async () => {
  const noProfesional = async () => ({
    ok: false,
    status: 400,
    text: async () =>
      JSON.stringify({
        error: {
          message:
            "Unsupported get request. Object with ID does not exist, cannot be loaded due to missing permissions",
          type: "GraphMethodException",
          code: 100
        }
      })
  });

  const r = await observar("personal_ficticia", { fetch: noProfesional });

  /*
    No es CUENTA_NO_RESUELTA: la cuenta existe. Leerlo asi
    mandaria a revisar el handle en lugar de a buscar otra
    fuente.
  */
  return (
    r.estado === "NO_SOPORTADO_PERSONAL" &&
    r.publicaciones.length === 0 &&
    r.motivo.includes("NO prueba que la cuenta no exista")
  );
});

await t("un bloqueo no produce ni una publicacion ni un cero", async () => {
  const expirado = async () => ({
    ok: false,
    status: 400,
    text: async () =>
      JSON.stringify({
        error: {
          message: "Error validating access token: Session has expired on Sunday",
          type: "OAuthException",
          code: 190
        }
      })
  });

  const r = await observar("x", { fetch: expirado });

  const texto = JSON.stringify(r);

  return (
    r.publicaciones.length === 0 &&
    !/"value":\s*0/.test(texto) &&
    r.estado === "CREDENCIAL_EXPIRADA"
  );
});

await t("expirado NO es rechazado: la accion es distinta", async () => {
  const b = co.clasificarBloqueo({
    estado: "CREDENCIAL_EXPIRADA",
    motivo: "Session has expired"
  });

  /*
    Los tokens del Graph API Explorer duran ~1 hora. Regenerar
    otro corto caduca igual: la accion correcta es conseguir uno
    de larga duracion, y por eso el mensaje lo dice.
  */
  return (
    b.tipo === "CREDENCIAL_EXPIRADA" &&
    b.reintentable === false &&
    b.accion.includes("larga duracion")
  );
});

bloque("Persistencia, evidencia y reejecucion");

await t("cada publicacion trae evidenceId derivado de su permalink", async () => {
  const r = await observar("x");

  return (
    r.publicaciones.every((p) => typeof p.evidenceId === "string") &&
    r.publicaciones.every((p) => p.canonicalUrl.startsWith("https://")) &&
    /* Dos publicaciones distintas, dos evidencias distintas. */
    new Set(r.publicaciones.map((p) => p.evidenceId)).size === 2
  );
});

await t("el evidenceId es estable entre ejecuciones", async () => {
  const a = await observar("x");
  const b = await observar("x");

  /*
    Es lo que impide duplicar la misma publicacion al volver a
    observar. Un id aleatorio serviria para deduplicar dentro de
    una ejecucion y para nada entre dos.
  */
  return a.publicaciones[0].evidenceId === b.publicaciones[0].evidenceId;
});

await t("reejecutar no duplica publicaciones y acumula metricas", async () => {
  const id = `cov-rt-${Date.now()}`;

  await ps.crearProyecto({ id, nombre: "Cobertura RT" });

  const primera = await observar("x");

  await ps.guardarPublicaciones(id, "cand-1", primera.publicaciones, {
    observadoEn: "2026-08-30T12:00:00.000Z"
  });

  const segunda = await co.observarInstagram({
    candidateId: "cand-1",
    projectId: id,
    cuenta: cuentaIg("x"),
    idParaBusinessDiscovery: "17841404365486006",
    observedAt: "2026-08-31T12:00:00.000Z",
    fetchImpl: respuestaBd("x")
  });

  await ps.guardarPublicaciones(id, "cand-1", segunda.publicaciones, {
    observadoEn: "2026-08-31T12:00:00.000Z"
  });

  const serie = await ps.publicacionesDe(id, "cand-1");

  const urls = serie.publicaciones.map((p) => p.canonicalUrl);

  const conVariasMetricas = serie.publicaciones.filter(
    (p) => (p.metricas || []).length > 2
  );

  /*
    Dos observaciones de las mismas dos publicaciones: siguen
    siendo DOS, con la serie de metricas acumulada. 100k ayer y
    150k hoy son dos observaciones, no un campo que cambio.
  */
  return (
    serie.publicaciones.length === 2 &&
    new Set(urls).size === 2 &&
    conVariasMetricas.length === 2
  );
});

await t("las observaciones no se filtran entre proyectos", async () => {
  const a = `cov-a-${Date.now()}`;
  const b = `cov-b-${Date.now()}`;

  await ps.crearProyecto({ id: a, nombre: "A" });
  await ps.crearProyecto({ id: b, nombre: "B" });

  const r = await observar("x");

  await ps.guardarPublicaciones(a, "cand-1", r.publicaciones, {});

  const enA = await ps.publicacionesDe(a, "cand-1");
  const enB = await ps.publicacionesDe(b, "cand-1");

  return enA.publicaciones.length === 2 && enB.publicaciones.length === 0;
});

bloque("Matriz social: ninguna celda vacia se rellena");

const filaDe = (activos, observaciones = []) => ({
  candidateId: "c",
  nombre: "C",
  activos,
  observaciones
});

await t("sin activos es SIN_CUENTA, que no es NO_PROBADO", () => {
  const m = cb.matrizSocialDelProyecto({ candidatos: [filaDe([])] });

  const c = m.filas[0].celdas.instagram;

  return c.estado === "SIN_CUENTA" && c.activos === 0;
});

await t("con activos y sin intentar es NO_PROBADO, que no es SIN_CUENTA", () => {
  const m = cb.matrizSocialDelProyecto({
    candidatos: [filaDe([{ platform: "instagram", accountId: "instagram:x" }])]
  });

  const c = m.filas[0].celdas.instagram;

  /*
    Los dos se verian igual pintados como «sin datos», y uno
    dice «no tiene cuenta» y el otro «no hemos mirado».
  */
  return c.estado === "NO_PROBADO" && c.activos === 1;
});

await t("dos de tres activos medidos es PARCIAL, no MEDIDO", () => {
  const m = cb.matrizSocialDelProyecto({
    candidatos: [
      filaDe(
        ["a", "b", "c"].map((h) => ({ platform: "instagram", accountId: `instagram:${h}` })),
        ["a", "b"].map((h) => ({
          platform: "instagram",
          accountId: `instagram:${h}`,
          alcance: "MEDIDO_TERCERO",
          publicaciones: 2,
          snapshots: 4,
          observedAt: "2026-08-30T12:00:00.000Z"
        }))
      )
    ]
  });

  const c = m.filas[0].celdas.instagram;

  return (
    c.estado === "PARCIAL" &&
    c.activos === 3 &&
    c.observadosSobreTerceros === 2 &&
    c.nota.includes("no se rellena")
  );
});

await t("MEDIDO_PROPIO no cuenta como cobertura del candidato", () => {
  const m = cb.matrizSocialDelProyecto({
    candidatos: [
      filaDe(
        [{ platform: "instagram", accountId: "instagram:propia" }],
        [
          {
            platform: "instagram",
            accountId: "instagram:propia",
            alcance: "MEDIDO_PROPIO_AUTORIZADO",
            publicaciones: 5,
            snapshots: 10,
            observedAt: "2026-08-30T12:00:00.000Z"
          }
        ]
      )
    ]
  });

  const f = m.filas[0];

  return (
    f.celdas.instagram.estado === "MEDIDO_PROPIO" &&
    /* Cinco publicaciones reales y CERO plataformas con tercero. */
    f.plataformasConTercero === 0 &&
    m.reglaDePropio.includes("no cuenta como cobertura")
  );
});

bloque("Facebook: bloqueo clasificado y benchmark intacto");

await t("el bloqueo de terceros en Facebook sigue siendo por permisos", () => {
  const f = scm.PLATAFORMAS.find((p) => p.plataformaId === "facebook");

  const b = f.medicionReal.etapaB.sobrePaginaDeTercero;

  return (
    b.resultado === "BLOQUEADO_PERMISOS" &&
    b.httpStatus === 400 &&
    b.codigoMeta === 100 &&
    b.alternativasQueMetaNombra.length === 3
  );
});

await t("sin credencial de Facebook la Page no se pide", async () => {
  const previo = process.env.FACEBOOK_USER_ACCESS_TOKEN;

  delete process.env.FACEBOOK_USER_ACCESS_TOKEN;

  const r = await ig.paginaDeTercero("cualquiera", {
    fetch: async () => {
      throw new Error("no deberia haber llamada");
    }
  });

  process.env.FACEBOOK_USER_ACCESS_TOKEN = previo;

  return r.estado === "SIN_CREDENCIAL" && r.llamadas === 0;
});

await t("el intercambio a token largo no se intenta sin app id y secret", async () => {
  const r = await ig.tokenDeLargaDuracion({
    fetch: async () => {
      throw new Error("no deberia haber llamada");
    }
  });

  return (
    r.estado === "SIN_CREDENCIAL" &&
    r.llamadas === 0 &&
    r.faltan.includes("META_APP_ID") &&
    r.faltan.includes("META_APP_SECRET")
  );
});

await t("habilitaBenchmark: Facebook y TikTok siguen en false", () => {
  return (
    scm.habilitaBenchmark("facebook").habilita === false &&
    scm.habilitaBenchmark("tiktok").habilita === false &&
    scm.habilitaBenchmark("instagram").habilita === true &&
    scm.habilitaBenchmark("x").habilita === true &&
    scm.habilitaBenchmark("youtube").habilita === true
  );
});

await t("observar no cambia habilitaBenchmark", async () => {
  const antes = scm.habilitaBenchmark("instagram").habilita;

  await observar("x");

  /*
    Lo que habilita es la matriz de capacidades, no el hecho de
    haber ejecutado una observacion. Si esto se rompiera,
    cualquier llamada afortunada ascenderia una plataforma.
  */
  return scm.habilitaBenchmark("instagram").habilita === antes;
});

bloque("Ningun token en los resultados");

await t("ni la observacion ni la traza contienen el token", async () => {
  const r = await observar("x");

  const texto = JSON.stringify(r);

  return (
    !texto.includes("EAA-TOKEN-FICTICIO-NO-REAL-000") &&
    !texto.includes("IGQ-TOKEN-FICTICIO-NO-REAL-000") &&
    !/access_token=[^&"]*[A-Za-z0-9]{10}/.test(texto)
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
