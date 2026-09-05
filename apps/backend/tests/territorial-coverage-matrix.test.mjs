// apps/backend/tests/territorial-coverage-matrix.test.mjs

/*
===========================================================
TERRITORIAL-SOURCE-COVERAGE-MATRIX-01

Pruebas A-V. Cero red: el `fetch` global esta contado.

Lo que este fichero protege son cuatro confusiones que
degradarian el producto entero:

  «existe el fichero»      != «esta operativo»
  «cuenta conocida»        != «descubrimiento abierto»
  «no soportado»           != «cero conversacion»
  «cobertura de fuentes»   != «cobertura de poblacion»

Las cuatro han sido errores reales en gates anteriores de este
proyecto. Las pruebas B, C, D y T existen para que no vuelvan.
===========================================================
*/

import assert from "node:assert/strict";

let red = 0;
const fetchReal = globalThis.fetch;
globalThis.fetch = (...a) => { red += 1; return fetchReal(...a); };

let ok = 0;
let fall = 0;

function t(nombre, fn) {
  try {
    const r = fn();
    if (r === false) throw new Error("devolvio false");
    console.log(`  PASS  ${nombre}`);
    ok += 1;
  } catch (e) {
    console.log(`  FALL  ${nombre}\n        ${e.message}`);
    fall += 1;
  }
}

const M = await import("../services/territorial/sourceCoverageMatrix.js");
const L = await import("../services/territorial/evidenceLedger.js");

const E = M.ESTADOS;
const C = M.CAPACIDADES;

/* Aporte real medido en la auditoría, para las pruebas de contribución. */
const APORTE = {
  rss_directo: { evidenceCount: 373, uniqueSources: 20, uniqueActors: 20, datedEvidence: 373, undatedEvidence: 0, CORROBORADO: 121, NO_RESOLUBLE: 225, PUBLIC_CONVERSATION: 0, MEDIA: 285, INSTITUTIONAL: 78 },
  x_api: { evidenceCount: 143, uniqueSources: 74, uniqueActors: 74, datedEvidence: 143, undatedEvidence: 0, CORROBORADO: 70, NO_RESOLUBLE: 36, PUBLIC_CONVERSATION: 143, MEDIA: 0, INSTITUTIONAL: 0 },
  youtube_data: { evidenceCount: 83, uniqueSources: 29, uniqueActors: 29, datedEvidence: 83, undatedEvidence: 0, CORROBORADO: 43, NO_RESOLUBLE: 22, PUBLIC_CONVERSATION: 0, MEDIA: 0, INSTITUTIONAL: 0 },
  brave_web: { evidenceCount: 20, uniqueSources: 15, uniqueActors: 15, datedEvidence: 6, undatedEvidence: 14, CORROBORADO: 15, NO_RESOLUBLE: 1, PUBLIC_CONVERSATION: 0, MEDIA: 3, INSTITUTIONAL: 6 }
};


/* =========================================================
   A-D · LAS CUATRO CONFUSIONES
   ========================================================= */

console.log("\n--- A-D · las cuatro confusiones ---\n");

t("A · el inventario de motores es determinista y cada estado trae su evidencia", () => {
  const a = M.estadoDeLaMatriz();
  const b = M.estadoDeLaMatriz();

  assert.deepEqual(a, b);
  assert.equal(a.motores, M.MOTORES.length);

  /* Sin evidencia una fila sería una opinión. */
  assert.ok(M.MOTORES.every((m) => typeof m.evidencia === "string" && m.evidencia.length > 30));
  assert.ok(M.MOTORES.every((m) => Object.values(E).includes(m.estado)));
  return true;
});

t("B · CONFIGURADO no es OPERATIVO, e IMPLEMENTADO no es CABLEADO", () => {
  const e = M.estadoDeLaMatriz();

  /* DuckDuckGo: configurado, utilizable y Territorial no lo llama. */
  const ddg = M.MOTORES.find((m) => m.id === "ddg_web");

  assert.equal(ddg.configurado, true);
  assert.equal(ddg.estado, E.CONFIGURED_NOT_USED);
  assert.equal(M.esCoberturaReal(ddg.estado), false);
  assert.ok(e.configuradosSinUsar.includes("ddg_web"));

  /* Instagram oficial: credencial presente, 16 exports, cero cableado. */
  const ig = M.MOTORES.find((m) => m.id === "instagram_graph");

  assert.equal(ig.configurado, true);
  assert.deepEqual(ig.cableadoEn, []);
  assert.equal(ig.estado, E.IMPLEMENTED_NOT_WIRED);
  assert.equal(M.esCoberturaReal(ig.estado), false);
  return true;
});

t("C · cuenta conocida NO es descubrimiento abierto", () => {
  /* Las capacidades viven en listas distintas. */
  assert.ok(M.esDescubrimiento(C.OPEN_KEYWORD_DISCOVERY));
  assert.ok(M.esDescubrimiento(C.HASHTAG_DISCOVERY));
  assert.ok(!M.esDescubrimiento(C.KNOWN_ACCOUNT_PROFILE));
  assert.ok(!M.esDescubrimiento(C.KNOWN_ACCOUNT_CONTENT));
  assert.ok(!M.esDescubrimiento(C.COMMENTS));

  /* TikTok observa cuentas y no descubre nada. */
  const s = M.resumenSocial().TikTok;

  assert.equal(s.permiteSeguimientoDeCuentas, true);
  assert.equal(s.permiteEscuchaAbierta, false);
  assert.equal(s.descubrimientoCubierto, 0);

  /* Y el proveedor está clasificado como tal, no como operativo. */
  const sc = M.MOTORES.find((m) => m.id === "scrapecreators");

  assert.equal(sc.estado, E.KNOWN_ACCOUNT_ONLY);
  assert.equal(M.esCoberturaReal(sc.estado), false);
  return true;
});

t("D · UNSUPPORTED no es CERO: la ausencia se redacta, no se inventa", () => {
  const a = M.redactarAusencia({
    plataforma: "TikTok",
    capacidad: C.OPEN_KEYWORD_DISCOVERY,
    estado: E.UNSUPPORTED
  });

  assert.ok(a);
  assert.match(a.formulacionCorrecta, /UNSUPPORTED con los conectores actuales/);
  assert.match(a.formulacionProhibida, /0 conversación en TikTok/);
  assert.match(a.formulacionProhibida, /no sobre nuestra instrumentación/);

  /* Y para algo que sí está cubierto no hay ausencia que redactar. */
  assert.equal(
    M.redactarAusencia({ plataforma: "X", capacidad: C.PUBLISHED_AT, estado: E.OPERATIVE }),
    null
  );
  return true;
});

t("D-bis · UNKNOWN no se convierte en UNSUPPORTED", () => {
  assert.notEqual(E.UNKNOWN, E.UNSUPPORTED);
  assert.equal(M.esCoberturaReal(E.UNKNOWN), false);
  assert.equal(M.esCoberturaReal(E.UNSUPPORTED), false);

  /*
    GDELT es el caso real: cableado, sin credencial necesaria y
    con 0 evidencias en toda la historia. Sin red no se puede
    saber si nunca se llamó o si respondió vacío, así que es
    UNKNOWN y no UNSUPPORTED.
  */
  const g = M.MOTORES.find((m) => m.id === "gdelt_doc");

  assert.equal(g.estado, E.UNKNOWN);
  assert.ok(g.cableadoEn.length > 0, "GDELT sí está cableado");
  assert.match(g.limitaciones.join(" "), /NOT_RECONSTRUCTABLE/);

  /* Y por tanto NO cuenta entre los operativos. */
  assert.ok(!M.estadoDeLaMatriz().operativos.includes("gdelt_doc"));
  return true;
});


/* =========================================================
   E-F · CONTRIBUCIÓN Y AISLAMIENTO
   ========================================================= */

console.log("\n--- E-F · contribución y aislamiento ---\n");

t("E · la contribución por proveedor no cuenta dos veces la misma evidencia", () => {
  /* Una evidencia observada por dos proveedores es UNA evidencia. */
  const corpus = [
    { evidenceId: "e1", providers: ["rss_directo"], domain: "a.ec" },
    { evidenceId: "e2", providers: ["rss_directo", "gdelt_doc"], domain: "b.ec" },
    { evidenceId: "e2", providers: ["rss_directo", "gdelt_doc"], domain: "b.ec" }
  ];

  const unicas = new Set(corpus.map((e) => e.evidenceId));

  assert.equal(unicas.size, 2);

  /* Y la celda de cobertura distingue evidencias de referencias. */
  const celda = M.celdaDeCobertura({
    family: M.FAMILIAS.NEWS,
    provider: "rss_directo",
    capability: C.OPEN_KEYWORD_DISCOVERY,
    status: E.OPERATIVE,
    evidenceCount: unicas.size,
    uniqueSources: 2,
    evidenceRefs: [...unicas]
  });

  assert.equal(celda.evidenceCount, 2);
  assert.equal(celda.evidenceRefs.length, 2);
  return true;
});

t("E-bis · la celda de cobertura guarda referencias, no copias de evidencia", () => {
  const celda = M.celdaDeCobertura({
    family: M.FAMILIAS.SOCIAL_OPEN,
    platform: "X",
    provider: "x_api",
    capability: C.OPEN_TOPIC_DISCOVERY,
    status: E.OPERATIVE_WITH_LIMITATIONS,
    evidenceCount: 143,
    evidenceRefs: Array.from({ length: 200 }, (_, i) => `ev-${i}`)
  });

  /* Se topan a 25: es un índice, no un almacén. */
  assert.equal(celda.evidenceRefs.length, 25);
  assert.equal(celda.evidenceCount, 143);
  assert.ok(!JSON.stringify(celda).includes("summary"));
  return true;
});

t("F · la celda de cobertura es project-scoped", () => {
  const a = M.celdaDeCobertura({
    family: M.FAMILIAS.WEB, provider: "brave_web", capability: C.CANONICAL_URL,
    status: E.OPERATIVE, projectId: "alcaldia-cuenca-2027-piloto", tenantId: "sentinel"
  });

  const b = M.celdaDeCobertura({
    family: M.FAMILIAS.WEB, provider: "brave_web", capability: C.CANONICAL_URL,
    status: E.OPERATIVE, projectId: "proyecto-b-fixture", tenantId: "sentinel"
  });

  assert.equal(a.projectId, "alcaldia-cuenca-2027-piloto");
  assert.equal(b.projectId, "proyecto-b-fixture");
  assert.notEqual(a.projectId, b.projectId);

  /* Y el ledger sigue aislando: proyecto inexistente = 0. */
  const obs = [
    { evidenceId: "e1", projectId: "alcaldia-cuenca-2027-piloto", retrievedAt: "2026-09-05T00:00:00Z", firstObservedAt: "2026-09-05T00:00:00Z" }
  ];

  assert.equal(L.reconstruirEstado(obs, { projectId: "alcaldia-cuenca-2027-piloto" }).size, 1);
  assert.equal(L.reconstruirEstado(obs, { projectId: "proyecto-b-fixture" }).size, 0);
  return true;
});


/* =========================================================
   G-K · UNA FILA POR PLATAFORMA Y CAPACIDAD
   ========================================================= */

console.log("\n--- G-K · capacidades por plataforma ---\n");

const CAPACIDADES_ESPERADAS = Object.values(C);

function comprobarPlataforma(nombre) {
  const celdas = M.MATRIZ_SOCIAL[nombre];

  assert.ok(celdas, `falta la plataforma ${nombre}`);

  /* Las 17 capacidades clasificadas, cada una con estado y razón. */
  CAPACIDADES_ESPERADAS.forEach((cap) => {
    assert.ok(celdas[cap], `${nombre} sin clasificar ${cap}`);
    assert.ok(Object.values(E).includes(celdas[cap].estado), `${nombre}.${cap} estado inválido`);
    assert.ok(
      typeof celdas[cap].razon === "string" && celdas[cap].razon.length > 10,
      `${nombre}.${cap} sin razón`
    );
  });

  return celdas;
}

t("G · X clasificada capacidad por capacidad", () => {
  const c = comprobarPlataforma("X");

  /* Descubrimiento real y ventana declarada. */
  assert.ok(M.esCoberturaReal(c[C.OPEN_KEYWORD_DISCOVERY].estado));
  assert.match(c[C.OPEN_KEYWORD_DISCOVERY].razon, /7 d[íi]as/);

  /* Sin geo: el territorio se resuelve por el texto. */
  assert.equal(c[C.GEO_SIGNAL].estado, E.UNSUPPORTED);

  /* Histórico bloqueado por plan, no por falta de soporte. */
  assert.equal(c[C.HISTORICAL_DEPTH].estado, E.BLOCKED_PERMISSION);
  return true;
});

t("H · YouTube clasificada capacidad por capacidad", () => {
  const c = comprobarPlataforma("YouTube");

  assert.ok(M.esCoberturaReal(c[C.OPEN_KEYWORD_DISCOVERY].estado));

  /* Comentarios: la API los ofrece y nuestro adaptador no. */
  assert.equal(c[C.COMMENTS].estado, E.NOT_IMPLEMENTED);
  assert.notEqual(c[C.COMMENTS].estado, E.UNSUPPORTED);
  return true;
});

t("I · Facebook clasificada, y sin descubrimiento abierto", () => {
  const c = comprobarPlataforma("Facebook");

  assert.equal(c[C.OPEN_KEYWORD_DISCOVERY].estado, E.UNSUPPORTED);
  assert.equal(c[C.HASHTAG_DISCOVERY].estado, E.UNSUPPORTED);

  /* Pero la observación de cuenta conocida sí está medida. */
  assert.ok(M.esCoberturaReal(c[C.KNOWN_ACCOUNT_CONTENT].estado));
  assert.match(c[C.KNOWN_ACCOUNT_CONTENT].razon, /6 publicaciones/);
  return true;
});

t("J · Instagram clasificada: bloqueada por el proveedor, no «sin datos»", () => {
  const c = comprobarPlataforma("Instagram");

  assert.equal(c[C.KNOWN_ACCOUNT_PROFILE].estado, E.BLOCKED_PROVIDER);
  assert.equal(c[C.KNOWN_ACCOUNT_CONTENT].estado, E.BLOCKED_PROVIDER);
  assert.match(c[C.KNOWN_ACCOUNT_PROFILE].razon, /internal_server_error/);

  /* Lo no alcanzado queda UNKNOWN, no UNSUPPORTED. */
  assert.equal(c[C.COMMENTS].estado, E.UNKNOWN);

  /* Ninguna capacidad cubierta: es la peor fila de la matriz. */
  assert.equal(M.resumenSocial().Instagram.capacidadesCubiertas, 0);
  return true;
});

t("K · TikTok clasificada: observa cuentas, no descubre", () => {
  const c = comprobarPlataforma("TikTok");

  assert.equal(c[C.OPEN_KEYWORD_DISCOVERY].estado, E.UNSUPPORTED);
  assert.ok(M.esCoberturaReal(c[C.KNOWN_ACCOUNT_CONTENT].estado));
  assert.match(c[C.KNOWN_ACCOUNT_CONTENT].razon, /10 v[íi]deos/);
  return true;
});

t("K-bis · solo 2 de 5 plataformas sociales permiten escucha abierta", () => {
  const s = M.resumenSocial();

  const abiertas = Object.entries(s).filter(([, v]) => v.permiteEscuchaAbierta).map(([k]) => k);

  assert.deepEqual(abiertas.sort(), ["X", "YouTube"]);
  assert.equal(Object.keys(s).length, 5);
  return true;
});


/* =========================================================
   L-N · PROVEEDOR, GDELT Y GOOGLE NEWS
   ========================================================= */

console.log("\n--- L-N · proveedor externo, GDELT, Google News ---\n");

t("L · ScrapeCreators: la distinción cuenta-conocida está en el código, no en una opinión", () => {
  const sc = M.MOTORES.find((m) => m.id === "scrapecreators");

  assert.equal(sc.estado, E.KNOWN_ACCOUNT_ONLY);

  /* La evidencia cita los endpoints y la comprobación programática. */
  assert.match(sc.evidencia, /12 endpoints/);
  assert.match(sc.evidencia, /url. o .handle/i);
  assert.match(sc.evidencia, /comprobado program[áa]ticamente/i);

  /* Las tres plataformas que cubre están sin descubrimiento. */
  ["Facebook", "Instagram", "TikTok"].forEach((p) => {
    assert.equal(M.resumenSocial()[p].permiteEscuchaAbierta, false);
  });
  return true;
});

t("M · el estado de GDELT se deriva del código y de los datos", () => {
  const g = M.MOTORES.find((m) => m.id === "gdelt_doc");

  assert.equal(g.requiereCredencial, false);
  assert.ok(g.cableadoEn.includes("territorialCollector.js"));
  assert.match(g.evidencia, /0 evidencias en el proyecto y 0 en el legado/);

  /* Su limitación real: no devuelve extracto. */
  assert.match(g.limitaciones.join(" "), /NO devuelve extracto/);
  return true;
});

t("N · el estado de Google News se deriva del código, no de los docs", () => {
  const gn = M.MOTORES.find((m) => m.id === "google_news_rss");

  assert.equal(gn.estado, E.IMPLEMENTED_NOT_WIRED);
  assert.match(gn.evidencia, /feed RSS/i);
  assert.match(gn.evidencia, /114 evidencias en el LEGADO/);
  assert.deepEqual(gn.cableadoEn, []);

  /* Producción histórica fuera del proyecto por falta de projectId. */
  assert.match(gn.limitaciones.join(" "), /projectId/);
  return true;
});


/* =========================================================
   O-S · APORTE Y COBERTURA POR FAMILIA
   ========================================================= */

console.log("\n--- O-S · aporte y familias ---\n");

t("O · la contribución de RSS se mide con diversidad, no con volumen", () => {
  const rss = APORTE.rss_directo;

  /* 373 piezas pero solo 20 fuentes: mucho volumen, poca diversidad. */
  assert.equal(rss.evidenceCount, 373);
  assert.equal(rss.uniqueSources, 20);
  assert.ok(rss.NO_RESOLUBLE > rss.CORROBORADO);

  const f = M.coberturaPorFamilia(APORTE, {});

  /* Y por eso NEWS no es GOOD pese a ser la familia más voluminosa. */
  assert.equal(f.familias[M.FAMILIAS.NEWS].nivel, M.NIVELES.PARTIAL);
  assert.match(f.familias[M.FAMILIAS.NEWS].criterio, /solo 20 fuentes/);
  return true;
});

t("P · la conversación pública se mide por emisores y depende de una sola plataforma", () => {
  const x = APORTE.x_api;

  assert.equal(x.PUBLIC_CONVERSATION, 143);
  assert.equal(x.uniqueActors, 74);

  /* RSS y YouTube no aportan ninguna. */
  assert.equal(APORTE.rss_directo.PUBLIC_CONVERSATION, 0);
  assert.equal(APORTE.youtube_data.PUBLIC_CONVERSATION, 0);

  const f = M.coberturaPorFamilia(APORTE, {});
  const pc = f.familias[M.FAMILIAS.PUBLIC_CONVERSATION];

  assert.equal(pc.nivel, M.NIVELES.PARTIAL);
  assert.equal(pc.plataformas, 1);
  assert.match(pc.criterio, /una sola plataforma/);
  return true;
});

t("Q · la cobertura por familia NO se decide por volumen", () => {
  const f = M.coberturaPorFamilia(APORTE, { instituciones: 9, mediosLocales: 4, universidades: 3 });

  /* INSTITUTIONS es GOOD con muchas menos piezas que NEWS. */
  assert.equal(f.familias[M.FAMILIAS.INSTITUTIONS].nivel, M.NIVELES.GOOD);
  assert.equal(f.familias[M.FAMILIAS.NEWS].nivel, M.NIVELES.PARTIAL);

  assert.match(f.declaraciones.join(" "), /NO se basa en volumen/);

  /* Las 11 familias clasificadas, cada una con criterio escrito. */
  assert.equal(Object.keys(f.familias).length, 11);
  assert.ok(Object.values(f.familias).every((x) => x.criterio && x.criterio.length > 30));
  return true;
});

t("R · el hueco de organizaciones está declarado con su causa medida", () => {
  const f = M.coberturaPorFamilia(APORTE, {});
  const org = f.familias[M.FAMILIAS.ORGANIZATIONS];

  assert.equal(org.nivel, M.NIVELES.INSUFFICIENT);
  assert.equal(org.entidades, 0);
  assert.match(org.criterio, /renderizan en cliente/);

  const gap = M.HUECOS.find((h) => h.familia === M.FAMILIAS.ORGANIZATIONS);

  assert.ok(gap);
  assert.equal(gap.impacto, "ALTO");
  /* Y el estado es UNKNOWN, no UNSUPPORTED: existen, no las podemos corroborar. */
  assert.equal(gap.estadoActual, E.UNKNOWN);
  return true;
});

t("S · el hueco de comunidades está declarado sin reclasificar instituciones", () => {
  const f = M.coberturaPorFamilia(APORTE, {});
  const com = f.familias[M.FAMILIAS.COMMUNITIES];

  assert.equal(com.nivel, M.NIVELES.INSUFFICIENT);
  assert.equal(com.entidades, 0);
  assert.match(com.criterio, /No se reclasificó ninguna institución/);

  /* Y siguen siendo familias distintas. */
  assert.notEqual(M.FAMILIAS.COMMUNITIES, M.FAMILIAS.INSTITUTIONS);
  return true;
});

t("S-bis · los huecos están priorizados y cada uno trae el dato que lo justifica", () => {
  assert.ok(M.HUECOS.length >= 6);
  assert.ok(M.HUECOS.every((h) => /^GAP-\d{2}$/.test(h.id)));
  assert.ok(M.HUECOS.every((h) => h.dato && h.dato.length > 20));
  assert.ok(M.HUECOS.every((h) => ["ALTO", "MEDIO", "BAJO"].includes(h.impacto)));

  /* El primero es el descubrimiento abierto en las tres plataformas. */
  assert.match(M.HUECOS[0].titulo, /Descubrimiento abierto/i);
  assert.equal(M.HUECOS[0].impacto, "ALTO");
  return true;
});


/* =========================================================
   T-V · POBLACIÓN, RED Y SECRETOS
   ========================================================= */

console.log("\n--- T-V · población, red y secretos ---\n");

t("T · nada en la matriz afirma cobertura de población", () => {
  const texto =
    JSON.stringify(M.estadoDeLaMatriz()) +
    JSON.stringify(M.MOTORES) +
    JSON.stringify(M.MATRIZ_SOCIAL) +
    JSON.stringify(M.coberturaPorFamilia(APORTE, {})) +
    JSON.stringify(M.HUECOS);

  assert.ok(
    !/% de (los )?(cuencanos|ciudadanos|habitantes)|penetraci[óo]n electoral|representatividad estad[íi]stica|opini[óo]n p[úu]blica de Cuenca|poblaci[óo]n de Cuenca/i.test(
      texto
    )
  );

  /* Y lo declara explícitamente. */
  assert.match(M.estadoDeLaMatriz().declaraciones.join(" "), /COBERTURA DE FUENTES != COBERTURA DE POBLACIÓN/);

  const celda = M.celdaDeCobertura({ family: M.FAMILIAS.WEB, provider: "brave_web", capability: C.RAW_TEXT, status: E.OPERATIVE });

  assert.match(celda.declaracion, /No describe población/);
  return true;
});

t("T-bis · la cobertura de un tema no autoriza a decir «viral en Cuenca»", () => {
  const c = M.coberturaDeTema(
    { topicId: "t:abc", topicLabel: "intercambiador monay", providers: ["x_api", "youtube_data", "rss_directo"], evidenceCount: 11, uniqueSources: 9 },
    APORTE
  );

  assert.equal(c.coverageStatus, M.NIVELES.GOOD);
  assert.match(c.formulacionPermitida, /actividad observable en las fuentes cubiertas/);
  assert.match(c.formulacionProhibida, /viral en Cuenca/);

  /* Y declara qué plataformas quedan sin observar. */
  assert.ok(c.missingCapabilities.some((x) => /Facebook, Instagram, TikTok/.test(x)));
  return true;
});

t("T-ter · un tema de una sola fuente no se clasifica como bien cubierto", () => {
  const c = M.coberturaDeTema(
    { topicId: "t:xyz", topicLabel: "farmasol", providers: ["rss_directo"], evidenceCount: 10, uniqueSources: 1 },
    APORTE
  );

  /* 10 piezas y 1 fuente: INSUFFICIENT, no GOOD. */
  assert.equal(c.coverageStatus, M.NIVELES.INSUFFICIENT);
  return true;
});

t("U · construir la matriz no hace ninguna petición externa", () => {
  const antes = red;

  M.estadoDeLaMatriz();
  M.resumenSocial();
  M.coberturaPorFamilia(APORTE, {});
  M.coberturaDeTema({ providers: ["x_api"] }, APORTE);
  M.redactarAusencia({ plataforma: "X", capacidad: C.GEO_SIGNAL, estado: E.UNSUPPORTED });

  assert.equal(red, antes);
  return true;
});

t("V · ninguna salida contiene credenciales ni secretos", () => {
  const texto =
    JSON.stringify(M.MOTORES) +
    JSON.stringify(M.estadoDeLaMatriz()) +
    JSON.stringify(M.REQUISITOS_DE_PROVEEDOR);

  /* Se nombran variables de entorno, nunca sus valores. */
  assert.ok(!/Bearer\s+[A-Za-z0-9]|AIza[0-9A-Za-z_-]{10,}|sk-[A-Za-z0-9]{10,}/.test(texto));

  /* Y la variable declarada no lleva valor pegado. */
  const conVar = M.MOTORES.filter((m) => m.variableEntorno);

  assert.ok(conVar.length > 0);
  assert.ok(conVar.every((m) => !/=/.test(m.variableEntorno) || /\+/.test(m.variableEntorno)));
  return true;
});

t("V-bis · los requisitos de proveedor rechazan explícitamente known-account-only", () => {
  const r = M.REQUISITOS_DE_PROVEEDOR;

  assert.ok(r.obligatorios.length >= 10);
  assert.match(r.criterioDeRechazo, /Known-account-only NO cumple/i);
  assert.match(r.comoSeMide, /consulta real por palabra clave/i);
  assert.match(r.comoSeMide, /folleto no cuenta/i);

  /* Los candidatos conocidos NO se recomiendan. */
  assert.ok(r.candidatosConocidos.every((c) => c.estado === "KNOWN_CANDIDATE"));
  assert.ok(!JSON.stringify(r.candidatosConocidos).includes("RECOMMENDED"));
  return true;
});


/* =========================================================
   sin red
   ========================================================= */

console.log("\n--- Sin red ---\n");

t("cero llamadas al fetch global", () => red === 0);

console.log("\n===========================================");
console.log(`PASS: ${ok}    FALL: ${fall}`);
console.log("===========================================");

if (fall > 0) process.exitCode = 1;
