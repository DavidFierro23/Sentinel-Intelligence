// apps/backend/tests/instagramProviderFallback.test.mjs

/*
===========================================================
ORQUESTADOR DEL FALLBACK DE INSTAGRAM
P-CAND-INSTAGRAM-FALLBACK-01
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/instagramProviderFallback.test.mjs

SIN RED. `fetch` inyectado con la FORMA real medida sobre
@paulcarrascoc, con valores sinteticos.

LO QUE DEFIENDE
-----------------------------------------------------------

    NO SE PIDE AL PROVEEDOR SI LA OFICIAL YA MIDIO

    EL RESULTADO OFICIAL NUNCA DESAPARECE, SE USE O NO EL FALLBACK

    UN PROVEEDOR SIN APROBAR NO SALE A LA RED DESDE AQUI TAMPOCO

Esta funcion no duplica la guarda de `socialProviderClient`: la
reutiliza. Si el proveedor no esta aprobado, `pedirAlProveedor`
lo bloquea igual que en cualquier otro llamador.
===========================================================
*/

process.env.SENTINEL_LAKE_ADAPTER = "memoria";

const orq = await import("../services/intelligence/instagramProviderFallback.js");

const esp = await import("../services/intelligence/externalSocialProvider.js");

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


const json = (cuerpo, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(cuerpo)
});

const perfilSintetico = {
  data: {
    user: {
      id: "3600000000",
      username: "cuenta.sintetica",
      full_name: "Nombre Sintetico",
      is_private: false,
      edge_followed_by: { count: 985 },
      edge_follow: { count: 200 },
      edge_owner_to_timeline_media: { count: 266 }
    }
  }
};

const entornoAprobado = {
  SOCIAL_EXTERNAL_PROVIDER_ENABLED: "true",
  SCRAPECREATORS_API_KEY: "clave-ficticia-de-prueba"
};


bloque("Si la oficial ya midio, no se toca el proveedor");

let llamado = false;

const r1 = await orq.observarInstagramConFallback({
  cuenta: { id: "instagram:pedropalaciosu", handle: "pedropalaciosu" },
  resultadoOficial: { estado: "OBSERVADA", canal: { followers: 9718 } },
  entorno: entornoAprobado,
  fetchImpl: async () => {
    llamado = true;

    return json(perfilSintetico);
  }
});

await t("no se llama al proveedor", () => {
  return llamado === false && r1.usoFallback === false;
});

await t("el resultado oficial se devuelve intacto", () => {
  return r1.resultadoOficial.canal.followers === 9718;
});

await t("la decision registra que fue MEDIDO_OFICIAL", () => {
  return r1.decision.estado === "MEDIDO_OFICIAL";
});


bloque("Si la oficial no alcanza, el fallback SI llama al proveedor");

llamado = false;

const r2 = await orq.observarInstagramConFallback({
  cuenta: { id: "instagram:paulcarrascoc", handle: "paulcarrascoc" },
  resultadoOficial: { estado: "NO_SOPORTADO_PERSONAL", motivo: "personal" },
  entorno: entornoAprobado,
  fetchImpl: async () => {
    llamado = true;

    return json(perfilSintetico);
  }
});

await t("se llama al proveedor exactamente una vez", () => {
  return llamado === true && r2.llamadas === 1;
});

await t("usoFallback es true y la marca de fuente es provider", () => {
  return r2.usoFallback === true && r2.marca.sourceKind === "provider";
});

await t("el perfil del proveedor llega mapeado", () => {
  return r2.perfil.followers === 985 && r2.perfil.accountProviderId === "3600000000";
});

await t("el resultado oficial NUNCA desaparece, incluso usando el fallback", () => {
  return r2.resultadoOficial.estado === "NO_SOPORTADO_PERSONAL";
});

await t("la decision conserva el estado oficial que motivo el fallback", () => {
  return r2.decision.estadoOficialConservado === "NO_SOPORTADO_PERSONAL";
});


bloque("Un proveedor SIN APROBAR no sale a la red ni aqui");

llamado = false;

const r3 = await orq.observarInstagramConFallback({
  cuenta: { id: "instagram:otro", handle: "otro" },
  resultadoOficial: { estado: "NO_SOPORTADO_PERSONAL" },
  proveedorId: "socialcrawl",
  entorno: {
    SOCIAL_EXTERNAL_PROVIDER_ENABLED: "true",
    SOCIALCRAWL_API_KEY: "clave-ficticia"
  },
  fetchImpl: async () => {
    llamado = true;

    return json(perfilSintetico);
  }
});

await t("SocialCrawl sigue sin aprobar y la guarda de siempre lo bloquea", () => {
  return llamado === false && r3.usoFallback === false;
});

await t("queda SIN_FUENTE y no un exito falso", () => {
  return r3.decision.estado === "SIN_FUENTE" && r3.proveedorError !== undefined;
});

await t("el estado oficial sigue disponible aunque el fallback fallo", () => {
  return r3.resultadoOficial.estado === "NO_SOPORTADO_PERSONAL";
});


bloque("Sin bandera de entorno, tampoco sale a la red");

llamado = false;

const r4 = await orq.observarInstagramConFallback({
  cuenta: { id: "instagram:otro2", handle: "otro2" },
  resultadoOficial: { estado: "NO_SOPORTADO_PERSONAL" },
  entorno: {},
  fetchImpl: async () => {
    llamado = true;

    return json(perfilSintetico);
  }
});

await t("bandera apagada bloquea el fallback igual que a cualquier proveedor", () => {
  return llamado === false && r4.usoFallback === false;
});


bloque("Confirmacion cruzada con el estado registrado en ScrapeCreators");

await t("scrapecreators sigue siendo el unico proveedor aprobado", () => {
  return (
    esp.proveedor("scrapecreators").aprobadoParaOperar === true &&
    esp.proveedor("socialcrawl").aprobadoParaOperar === false
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

process.exitCode = fail > 0 ? 1 : 0;
