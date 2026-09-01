// apps/backend/tests/snapshotPersistenceHttp.test.mjs

/*
===========================================================
PERSISTENCIA DE SNAPSHOT DE CUENTA POR LA RUTA HTTP REAL
P-CAND-SNAPSHOTS-01
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/snapshotPersistenceHttp.test.mjs

SIN RED. Mismo patron que instagramHttpFallback.test.mjs: servidor
Express real en puerto efimero, un solo host interceptado
(api.scrapecreators.com), todo lo demas pasa por fetch real.

QUE DEFIENDE ESTA SUITE
-----------------------------------------------------------

Hallazgo de tres gates (BENCH-02, BENCH-02A): `POST /observar` con
`proveedorInstagram: true` medía en vivo pero nunca escribía el
snapshot de CUENTA -solo publicaciones-. Esta suite prueba que,
tras el parche de P-CAND-SNAPSHOTS-01, la persistencia es real,
generica (no hardcodeada a un candidato ni a Instagram), con
accountId canonico, dedupe correcto entre llamadas reales
distintas, y aislamiento de proyecto.
===========================================================
*/

process.env.SENTINEL_LAKE_ADAPTER = "memoria";
process.env.SOCIAL_EXTERNAL_PROVIDER_ENABLED = "true";
process.env.SCRAPECREATORS_API_KEY = "clave-ficticia-de-prueba";
process.env.FACEBOOK_USER_ACCESS_TOKEN = "EAA-TOKEN-FICTICIO-NO-REAL-000";
process.env.INSTAGRAM_ACCESS_TOKEN = "IGQ-TOKEN-FICTICIO-NO-REAL-000";
process.env.META_APP_ID = "000000000000000";
process.env.META_APP_SECRET = "SECRETO-FICTICIO-NO-REAL-000";

import express from "express";

const ps = await import("../services/projects/projectStore.js");
const ca = await import("../services/intelligence/candidateAssets.js");
const rutas = (await import("../routes/projects.js")).default;

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
      console.log(`  FALL  ${nombre}  (devolvio ${JSON.stringify(valor)})`);
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

const fetchReal = globalThis.fetch;

const json = (cuerpo, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(cuerpo)
});

let contadorSeguidores = 100;

const perfilProveedorSintetico = (handle) => ({
  data: {
    user: {
      id: "3600000000",
      username: handle,
      full_name: "Nombre Sintetico",
      is_private: false,
      edge_followed_by: { count: contadorSeguidores },
      edge_follow: { count: 10 },
      edge_owner_to_timeline_media: { count: 5 }
    }
  }
});

globalThis.fetch = async (url, opciones) => {
  const u = String(url);
  if (u.includes("api.scrapecreators.com")) {
    const handle = new URL(u).searchParams.get("handle") || "desconocido";
    return json(perfilProveedorSintetico(handle));
  }
  if (!u.includes("graph.facebook.com")) return fetchReal(url, opciones);
  return json({ error: { code: 100 } }, 400);
};

const app = express();
app.use(express.json());
app.use("/api/proyectos", rutas);
const servidor = await new Promise((resolve) => {
  const s = app.listen(0, "127.0.0.1", () => resolve(s));
});
const BASE = `http://127.0.0.1:${servidor.address().port}/api/proyectos`;

const observar = async (proyectoId, candidatoId, cuerpo = {}) => {
  const r = await fetchReal(`${BASE}/${proyectoId}/candidatos/${candidatoId}/observar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plataformas: ["instagram"], proveedorInstagram: true, ...cuerpo })
  });
  return { status: r.status, cuerpo: await r.json() };
};

async function crearProyectoConCandidato(pid, handleMayus) {
  await ps.crearProyecto({
    id: pid,
    nombre: `Prueba persistencia ${pid}`,
    canton: "Cuenca",
    pais: "Ecuador",
    dignidad: "Alcaldia"
  });
  await ps.agregarCandidato(pid, {
    nombre: "Candidato De Prueba",
    cuentas: [`https://www.instagram.com/${handleMayus}/`]
  });
  const cid = "candidato-de-prueba";
  const d = ca.crearDeclaracionDeTipo({
    candidateId: cid,
    assetId: `instagram:${handleMayus.toLowerCase()}`,
    platform: "instagram",
    url: `https://www.instagram.com/${handleMayus}`,
    declaredType: "INSTAGRAM_PERSONAL"
  });
  if (!d.valido) throw new Error(`declaracion invalida: ${d.motivo}`);
  await ps.guardarDeclaracionesDeTipo(pid, cid, [d.declaracion], {
    declaradoEn: new Date().toISOString()
  });
  return cid;
}

/* ---------------------------------------------------------
   A · LA RUTA HTTP PERSISTE EL SNAPSHOT DE CUENTA MEDIDO POR PROVEEDOR
--------------------------------------------------------- */
bloque("A · persistencia real via HTTP");

const PID_A = "proyecto-snapshot-persist-a";
const HANDLE_A = "CandidatoMixtoA";
const cidA = await crearProyectoConCandidato(PID_A, HANDLE_A);

const antesA = await ps.snapshotsDe(PID_A, cidA);

contadorSeguidores = 4321;
const rA = await observar(PID_A, cidA);

await t("la respuesta HTTP confirma snapshotsDeProveedorGuardados", () => {
  return rA.cuerpo.snapshotsDeProveedorGuardados?.total === 1;
});

const despuesA = await ps.snapshotsDe(PID_A, cidA);

await t("el snapshot de cuenta quedo persistido (no solo en la respuesta HTTP)", () => {
  return despuesA.length === antesA.length + 1;
});

const snapA = despuesA.find((s) => s.platform === "instagram");

await t("el accountId persistido es canonico (minuscula, sin @)", () => {
  return snapA.accountId === `instagram:${HANDLE_A.toLowerCase()}`;
});

await t("followers real, no null-a-cero ni inventado", () => {
  return snapA.followers === 4321;
});

await t("provider correcto en el snapshot", () => {
  return snapA.provider === "scrapecreators";
});

/* ---------------------------------------------------------
   B · DEDUPE: DOS OBSERVACIONES REALES EN INSTANTES DISTINTOS
        NO SE COLAPSAN, PERO TAMPOCO EXPLOTAN
--------------------------------------------------------- */
bloque("B · dedupe entre observaciones reales distintas");

contadorSeguidores = 5555;
await new Promise((r) => setTimeout(r, 5));
await observar(PID_A, cidA);

const trasSegunda = await ps.snapshotsDe(PID_A, cidA);

await t("una segunda observacion real (otro instante) agrega un snapshot, no lo pisa", () => {
  return trasSegunda.length === despuesA.length + 1;
});

await t("el snapshot mas nuevo tiene el valor real mas nuevo, no el anterior repetido", () => {
  const masNuevo = [...trasSegunda].sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1))[0];
  return masNuevo.followers === 5555;
});

/* ---------------------------------------------------------
   C · PROJECT ISOLATION: MISMO HANDLE, OTRO PROYECTO, 0 FUGAS
--------------------------------------------------------- */
bloque("C · project isolation");

const PID_B = "proyecto-snapshot-persist-b";
const cidB = await crearProyectoConCandidato(PID_B, HANDLE_A); // mismo handle a proposito

contadorSeguidores = 9999;
await observar(PID_B, cidB);

const snapsProyectoA = await ps.snapshotsDe(PID_A, cidA);
const snapsProyectoB = await ps.snapshotsDe(PID_B, cidB);

await t("el proyecto A no ve los snapshots del proyecto B", () => {
  return snapsProyectoA.every((s) => s.followers !== 9999);
});

await t("el proyecto B tiene su propio snapshot con su propio valor", () => {
  return snapsProyectoB.some((s) => s.followers === 9999);
});

await t("candidateId+accountId identicos en dos proyectos no colisionan (claves incluyen projectId)", () => {
  return snapsProyectoA.length >= 2 && snapsProyectoB.length === 1;
});

console.log(`\n===========================================\nPASS: ${pass}    FALL: ${fail}\n===========================================`);
if (fail > 0) {
  console.log("Fallos:", fallos);
  process.exitCode = 1;
}
servidor.close();
globalThis.fetch = fetchReal;
