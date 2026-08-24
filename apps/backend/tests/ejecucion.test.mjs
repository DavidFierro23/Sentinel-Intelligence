// apps/backend/tests/ejecucion.test.mjs

/*
===========================================================
PRUEBAS DE EJECUCION SIN DELTA (BUG-13)
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/ejecucion.test.mjs

SIN RED Y SIN CUOTA. El resultado es un objeto fijo.

EL CASO EXACTO QUE FALLO EN LA REPRUEBA REAL
-----------------------------------------------------------

    Investigacion N     2 cuentas · 7 medios · 28 evidencias
    Investigacion N+1   las mismas 2 · los mismos 7 · las mismas 28

`registrarInvestigacion` omitia la escritura cuando el resumen
no cambiaba. Correcto para los hallazgos —reinvestigar no debe
duplicar cuentas— y catastrofico para la traza: una reejecucion
sin delta es exactamente el caso en que se necesita mirar la
traza, y era el unico en que se tiraba.

LA DISTINCION QUE ESTAS PRUEBAS FIJAN

    EXPEDIENTE  el conjunto ACUMULADO de hallazgos. Se deduplica.
    EJECUCION   el EVENTO de haber investigado. Ocurrio.

Un hecho no deja de haber ocurrido porque su resultado coincida
con el de ayer. Y ningun hallazgo se duplica para conseguirlo:
lo que se guarda aparte es el evento, que es genuinamente nuevo.
===========================================================
*/

process.env.SENTINEL_LAKE_ADAPTER = "memoria";

const ps = await import("../services/projects/projectStore.js");

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

/*
  El resultado real de Lloret: 2 cuentas, 7 medios, 28 evidencias
  web. Se reutiliza IDENTICO en las dos ejecuciones, que es lo
  que reproduce el fallo.
*/
const medios = Array.from({ length: 7 }, (_, i) => ({
  plataforma: "Instagram",
  plataformaId: "instagram",
  handle: `medio${i}`,
  url: `https://www.instagram.com/medio${i}`,
  motivo: "handle propio de un medio"
}));

const RESULTADO = {
  perfilEjecutivo: {
    huellaDigital: { valor: 22 },
    tarjetas: [
      {
        plataforma: "X",
        plataformaId: "x",
        handle: "jotalloretv",
        url: "https://x.com/jotalloretv",
        correspondencia: 31,
        proveedores: ["SerpAPI (Google)"]
      },
      {
        plataforma: "Facebook",
        plataformaId: "facebook",
        handle: "juancristobal.lloretvaldivieso",
        url: "https://www.facebook.com/juancristobal.lloretvaldivieso",
        correspondencia: 25,
        proveedores: []
      }
    ],
    medios,
    instituciones: [],
    indeterminadas: [
      {
        plataforma: "Instagram",
        plataformaId: "instagram",
        handle: "juancristobalmora",
        url: "https://www.instagram.com/juancristobalmora",
        motivo:
          "coincide en juan, cristobal, que son nombres de pila, pero en ningún apellido (lloret / valdivieso)"
      }
    ]
  },

  social: {
    cobertura: [
      { plataformaId: "x", plataforma: "X", candidatos: 1, estadoPresencia: "inferida", motivoCobertura: "1 candidato." },
      { plataformaId: "facebook", plataforma: "Facebook", candidatos: 1, estadoPresencia: "inferida", motivoCobertura: "1 candidato." },
      { plataformaId: "instagram", plataforma: "Instagram", candidatos: 1, estadoPresencia: "inferida", motivoCobertura: "1 candidato." },
      { plataformaId: "youtube", plataforma: "YouTube", candidatos: 0, estadoPresencia: "ausencia", motivoCobertura: "Consultada, sin presencia." },
      { plataformaId: "tiktok", plataforma: "TikTok", candidatos: 0, estadoPresencia: "no_comprobada", motivoCobertura: "El proveedor bloqueó." },
      { plataformaId: "linkedin", plataforma: "LinkedIn", candidatos: 0, estadoPresencia: "no_comprobada", motivoCobertura: "No se planificó consulta." }
    ],

    candidatos: [
      { plataforma: "X", plataformaId: "x", handle: "jotalloretv", url: "https://x.com/jotalloretv", vias: ["consulta_dirigida"], viasDeclaradas: [], proveedores: ["SerpAPI (Google)"], aportadaPorAnalista: false, origenes: [{ via: "consulta_dirigida", proveedor: "SerpAPI (Google)", consulta: 'site:x.com "Lloret" Cuenca' }] },
      { plataforma: "Facebook", plataformaId: "facebook", handle: "juancristobal.lloretvaldivieso", url: "https://www.facebook.com/juancristobal.lloretvaldivieso", vias: [], viasDeclaradas: ["cuenta_referencia"], proveedores: [], aportadaPorAnalista: true, origenes: [{ via: "cuenta_referencia", proveedor: null, origen: "analista", noCuentaComoCorroboracion: true }] },
      { plataforma: "Instagram", plataformaId: "instagram", handle: "juancristobalmora", url: "https://www.instagram.com/juancristobalmora", vias: ["consulta_dirigida"], viasDeclaradas: [], proveedores: ["DuckDuckGo Web"], aportadaPorAnalista: false, origenes: [{ via: "consulta_dirigida", proveedor: "DuckDuckGo Web", consulta: 'site:instagram.com "Lloret" Cuenca' }] }
    ],

    descubrimiento: {
      anclasUsadas: [{ termino: "Cuenca" }, { termino: "alcaldia" }],
      aliasUsados: [],
      advertencias: ["Ningún perfil fue leído."],

      plan: [
        { consulta: 'site:x.com "Lloret" Cuenca', etiqueta: "identidad:x", plataformaId: "x" },
        { consulta: 'site:instagram.com "Lloret" Cuenca', etiqueta: "identidad:instagram", plataformaId: "instagram" },
        { consulta: 'site:youtube.com "Lloret" Cuenca', etiqueta: "identidad:youtube", plataformaId: "youtube" },
        { consulta: 'site:tiktok.com "Lloret" Cuenca', etiqueta: "identidad:tiktok", plataformaId: "tiktok" },
        { consulta: 'site:linkedin.com "Lloret" Cuenca', etiqueta: "identidad:linkedin", plataformaId: "linkedin" }
      ],

      intentos: [
        { consulta: 'site:x.com "Lloret" Cuenca', etiqueta: "identidad:x", plataformaId: "x", proveedorUsado: "SerpAPI (Google)", estado: "OK", resultados: 3 },
        { consulta: 'site:instagram.com "Lloret" Cuenca', etiqueta: "identidad:instagram", plataformaId: "instagram", proveedorUsado: "DuckDuckGo Web", estado: "OK", resultados: 1 },
        { consulta: 'site:youtube.com "Lloret" Cuenca', etiqueta: "identidad:youtube", plataformaId: "youtube", proveedorUsado: "SerpAPI (Google)", estado: "OK", resultados: 0 },
        { consulta: 'site:tiktok.com "Lloret" Cuenca', etiqueta: "identidad:tiktok", plataformaId: "tiktok", proveedorUsado: "DuckDuckGo Web", estado: "BLOQUEADO", resultados: 0 }
      ],

      descartados: [
        { url: "https://www.instagram.com/p/ABC/", plataforma: { nombre: "Instagram" }, motivo: "no_cuenta: la URL no identifica una cuenta", tipo: "no_cuenta" }
      ],

      proveedores: {
        proveedores: [
          { id: "serpapi", nombre: "SerpAPI (Google)", intentos: 2, exitos: 2, bloqueos: 0, errores: 0, noIntentados: 0, resultados: 3 },
          { id: "duckduckgo", nombre: "DuckDuckGo Web", intentos: 2, exitos: 1, bloqueos: 1, errores: 0, noIntentados: 0, resultados: 1 }
        ]
      }
    }
  },

  /*
    OJO AL DETALLE, y no es un adorno del test: `clavesCuenta`
    —la clave con la que el diferencial deduplica— se deriva de
    `clasificacionCuentas.cuentasObjetivo`, no de
    `perfilEjecutivo.tarjetas`. Son dos fuentes distintas para la
    misma cosa. Omitirla daba un delta de +2 cuentas en la segunda
    ejecucion. Ver BUG-14.
  */
  /*
    -----------------------------------------------------------
    FORMA REAL, NO LA QUE UNO SUPONE
    -----------------------------------------------------------

    `clasificacionCuentas` es lo que produce `clasificarYSeparar`
    sobre las fichas consolidadas: cada entrada conserva TODOS los
    campos de la ficha —`origenes`, `vias`, `proveedores`,
    `corroboracion`, `correspondencia`— y se le añade
    `clasificacion` con la clase y sus razones.

    Es la fuente de la traza, y por eso el fixture la reproduce
    con fidelidad. La version anterior de estas pruebas usaba solo
    `perfilEjecutivo`, que es una PROYECCION para la interfaz: al
    escribir el test contra la proyeccion, el test confirmaba mi
    suposicion en lugar de la estructura del motor. Paso en verde
    mientras la traza real salia vacia. Un fixture que no se
    parece a la realidad no prueba nada.
    -----------------------------------------------------------
  */
  clasificacionCuentas: {
    version: "1.0",

    cuentasObjetivo: [
      {
        plataforma: "X",
        plataformaId: "x",
        handle: "jotalloretv",
        url: { canonica: "https://x.com/jotalloretv" },
        correspondencia: { puntuacion: 31, nivel: "posible" },
        origenes: [
        { via: "consulta_dirigida", proveedor: "SerpAPI (Google)", consulta: 'site:x.com "Juan Cristóbal Lloret Valdivieso" Cuenca alcaldia' }
        ],
        vias: ["consulta_dirigida"],
        proveedores: ["SerpAPI (Google)"],
        corroboracion: {
          proveedores: ["SerpAPI (Google)"],
          totalProveedores: 1,
          multiProveedor: false,
          vias: ["consulta_dirigida"],
          multiVia: false
        },
        clasificacion: {
          clase: "cuenta_personal",
          razones: ["el handle jotalloretv contiene lloret del nombre del objetivo"]
        }
      },
      {
        plataforma: "Facebook",
        plataformaId: "facebook",
        handle: "juancristobal.lloretvaldivieso",
        url: { canonica: "https://facebook.com/juancristobal.lloretvaldivieso" },
        correspondencia: { puntuacion: 25, nivel: "posible" },
        origenes: [
        { via: "cuenta_referencia", proveedor: null, origen: "analista", noCuentaComoCorroboracion: true }
        ],
        vias: [],
        proveedores: [],
        corroboracion: {
          proveedores: [],
          totalProveedores: 0,
          multiProveedor: false,
          vias: [],
          multiVia: false
        },
        clasificacion: {
          clase: "cuenta_personal",
          razones: ["el handle contiene lloret, valdivieso del nombre del objetivo"]
        }
      }
    ],

    medios: [
      {
        plataforma: "Instagram",
        plataformaId: "instagram",
        handle: "unsiontv",
        url: { canonica: "https://instagram.com/unsiontv" },
        correspondencia: { puntuacion: 12, nivel: "posible" },
        origenes: [
        { via: "consulta_dirigida", proveedor: "DuckDuckGo Web", consulta: 'site:instagram.com "Juan Cristóbal Lloret Valdivieso"' }
        ],
        vias: ["consulta_dirigida"],
        proveedores: ["DuckDuckGo Web"],
        corroboracion: {
          proveedores: ["DuckDuckGo Web"],
          totalProveedores: 1,
          multiProveedor: false,
          vias: ["consulta_dirigida"],
          multiVia: false
        },
        clasificacion: {
          clase: "medio",
          razones: ["el handle contiene «tv», propio de un medio"]
        }
      }
    ],

    instituciones: [],

    /*
      Los rechazados. Sin ellos no se puede saber si el matcher
      pierde cuentas que el Discovery si encontro, que es la
      pregunta de P-CAND-01.
    */
    indeterminadas: [
      {
        plataforma: "Instagram",
        plataformaId: "instagram",
        handle: "juancristobalmora",
        url: { canonica: "https://instagram.com/juancristobalmora" },
        correspondencia: { puntuacion: 8, nivel: "posible" },
        origenes: [
        { via: "consulta_dirigida", proveedor: "DuckDuckGo Web", consulta: 'site:instagram.com "Juan Cristóbal Lloret Valdivieso"' }
        ],
        vias: ["consulta_dirigida"],
        proveedores: ["DuckDuckGo Web"],
        corroboracion: {
          proveedores: ["DuckDuckGo Web"],
          totalProveedores: 1,
          multiProveedor: false,
          vias: ["consulta_dirigida"],
          multiVia: false
        },
        clasificacion: {
          clase: "no_determinado",
          razones: ["coincide en juan, cristobal, que son nombres de pila, pero en ningún apellido (lloret / valdivieso)"]
        }
      },
      {
        plataforma: "LinkedIn",
        plataformaId: "linkedin",
        handle: "jlloretv",
        url: { canonica: "https://linkedin.com/in/jlloretv" },
        correspondencia: { puntuacion: 18, nivel: "posible" },
        origenes: [
        { via: "consulta_dirigida", proveedor: "SerpAPI (Google)", consulta: 'site:linkedin.com "Juan Cristóbal Lloret Valdivieso" Cuenca alcaldia' }
        ],
        vias: ["consulta_dirigida"],
        proveedores: ["SerpAPI (Google)"],
        corroboracion: {
          proveedores: ["SerpAPI (Google)"],
          totalProveedores: 1,
          multiProveedor: false,
          vias: ["consulta_dirigida"],
          multiVia: false
        },
        clasificacion: {
          clase: "no_determinado",
          razones: ["coincide en lloret pero la correspondencia no alcanza el umbral"]
        }
      },
      {
        plataforma: "LinkedIn",
        plataformaId: "linkedin",
        handle: "cristobal-mora-l",
        url: { canonica: "https://linkedin.com/in/cristobal-mora-l" },
        correspondencia: { puntuacion: 6, nivel: "posible" },
        origenes: [
        { via: "consulta_dirigida", proveedor: "SerpAPI (Google)", consulta: 'site:linkedin.com "Juan Cristóbal Lloret Valdivieso" Cuenca alcaldia' }
        ],
        vias: ["consulta_dirigida"],
        proveedores: ["SerpAPI (Google)"],
        corroboracion: {
          proveedores: ["SerpAPI (Google)"],
          totalProveedores: 1,
          multiProveedor: false,
          vias: ["consulta_dirigida"],
          multiVia: false
        },
        clasificacion: {
          clase: "no_determinado",
          razones: ["coincide en cristobal, que es nombre de pila, pero en ningún apellido (lloret / valdivieso)"]
        }
      }
    ]
  },

  fichaObjetivo: { evidencias: { web: new Array(28).fill({}) } }
};

const PID = "ejec-test";

const CID = "juan-cristobal-lloret-valdivieso";

await ps.crearProyecto({
  id: PID,
  nombre: "Proyecto ejecución",
  canton: "Cuenca",
  provincia: "Azuay",
  pais: "Ecuador",
  dignidad: "Alcaldía de Cuenca"
});

await ps.agregarCandidato(PID, {
  nombre: "Juan Cristóbal Lloret Valdivieso",
  facebook: "https://www.facebook.com/juancristobal.lloretvaldivieso"
});

/* INVESTIGACION N */
const N = await ps.registrarInvestigacion(PID, CID, RESULTADO);

/* INVESTIGACION N+1 — resultado IDENTICO, byte a byte. */
const N1 = await ps.registrarInvestigacion(PID, CID, RESULTADO);

const contenido = await ps.contenidoDeProyecto(PID);

const cand = contenido.candidatos.find((c) => c.id === CID);

/*
===========================================================
LA EJECUCION SIN DELTA SE REGISTRA
===========================================================
*/

bloque("BUG-13.a  N+1 sin delta queda registrada");

await t("N registró ejecución y creó expediente", () => {
  return N.ejecucionRegistrada === true && N.expedienteActualizado === true;
});

await t("N+1 NO aporta hallazgos: delta 0/0/0", () => {
  return (
    N1.delta.cuentas === 0 &&
    N1.delta.medios === 0 &&
    N1.delta.evidenciasWeb === 0 &&
    N1.sinCambios === true
  );
});

await t("N+1 SÍ queda registrada como ejecución", () => {
  /*
    EL CORAZON DEL FALLO. Antes esto era false y no quedaba
    ningun rastro de que la investigacion hubiera corrido.
  */
  return N1.ejecucionRegistrada === true;
});

await t("delta cero y ejecución registrada COEXISTEN", () => {
  return (
    N1.sinCambios === true &&
    N1.expedienteActualizado === false &&
    N1.ejecucionRegistrada === true &&
    N1.trazaPersistida === true
  );
});

await t("N y N+1 tienen identidad de ejecución distinta", () => {
  /*
    Se distinguen por su instante autoritativo, no por
    aleatoriedad: son dos hechos distintos.
  */
  return (
    typeof N.investigacionId === "string" &&
    typeof N1.investigacionId === "string" &&
    N.investigacionId !== N1.investigacionId &&
    N.ejecutadaEn !== N1.ejecutadaEn
  );
});

/*
===========================================================
NO SE DUPLICAN HALLAZGOS
===========================================================
*/

bloque("BUG-13.b  ningún hallazgo se duplica");

await t("sigue habiendo 2 cuentas, no 4", () => {
  return cand.expediente.cuentas.length === 2;
});

await t("siguen habiendo 7 medios, no 14", () => {
  return cand.expediente.medios.length === 7;
});

await t("las evidencias web no se suman dos veces", () => {
  return cand.expediente.evidenciasWeb === 28;
});

await t("un solo candidato, no dos", () => {
  return contenido.candidatos.filter((c) => c.id === CID).length === 1;
});

await t("el expediente NO tiene una versión redundante", () => {
  /*
    La deduplicacion de hallazgos se conserva intacta: N+1 no
    reescribio el expediente porque no aportaba nada.
  */
  return N1.expedienteActualizado === false;
});

/*
===========================================================
AMBAS EJECUCIONES SON RECUPERABLES
===========================================================
*/

bloque("BUG-13.c  N y N+1 son recuperables");

await t("el candidato expone dos ejecuciones", () => {
  return cand.totalEjecuciones === 2 && cand.ejecuciones.length === 2;
});

await t("la más reciente va primero", () => {
  return (
    cand.ultimaEjecucion.investigacionId === N1.investigacionId &&
    cand.ejecuciones[1].investigacionId === N.investigacionId
  );
});

await t("ambas declaran que se ejecutaron", () => {
  return cand.ejecuciones.every(
    (e) => e.ejecutada === true && e.estado === "completada"
  );
});

await t("N+1 conserva su delta cero, como resultado válido", () => {
  const u = cand.ultimaEjecucion;

  return (
    u.delta.cuentas === 0 &&
    u.delta.medios === 0 &&
    u.sinCambiosEnHallazgos === true
  );
});

/*
===========================================================
LA TRAZA DE N+1 SOBREVIVE ENTERA
===========================================================
*/

bloque("BUG-13.d  la traza de N+1 sobrevive al Knowledge Lake");

const tz = cand.ultimaEjecucion?.traza;

await t("N+1 tiene traza", () => {
  return !!tz && tz.version === "1.0";
});

await t("conserva las queries con su proveedor y resultados", () => {
  const q = (tz.consultas || []).find((x) => x.consulta.includes("site:x.com"));

  return q.proveedor === "SerpAPI (Google)" && q.estado === "OK" && q.resultados === 3;
});

await t("conserva la consulta planificada y no lanzada", () => {
  const q = (tz.consultas || []).find((x) =>
    x.consulta.includes("site:linkedin.com")
  );

  return q.ejecutada === false && q.estado === "NO_EJECUTADA";
});

await t("conserva coberturaPlataformas con las 6 y sus 5 estados", () => {
  const ESTADOS = [
    "ATRIBUIDA",
    "ENCONTRADA_NO_ATRIBUIDA",
    "BUSCADA_SIN_RESULTADO",
    "NO_EJECUTADA",
    "ERROR_PROVIDER"
  ];

  const ids = (tz.coberturaPlataformas || []).map((c) => c.plataformaId);

  return (
    ["facebook", "instagram", "x", "tiktok", "youtube", "linkedin"].every((p) =>
      ids.includes(p)
    ) && tz.coberturaPlataformas.every((c) => ESTADOS.includes(c.estado))
  );
});

await t("conserva los candidatos rechazados con su motivo", () => {
  const r = (tz.candidatosSociales || []).find(
    (c) => c.handle === "juancristobalmora"
  );

  return r.aceptado === false && r.motivo.includes("apellido");
});

await t("conserva los errores de proveedor: TikTok bloqueado", () => {
  const tk = (tz.coberturaPlataformas || []).find(
    (c) => c.plataformaId === "tiktok"
  );

  return (
    tk.estado === "ERROR_PROVIDER" && tk.estadosDeProveedor.includes("BLOQUEADO")
  );
});

await t("conserva consultas intentadas y completadas por proveedor", () => {
  const d = (tz.proveedores || []).find((p) => p.proveedor === "DuckDuckGo Web");

  return (
    d.consultasIntentadas === 2 && d.consultasCompletadas === 1 && d.bloqueos === 1
  );
});

await t("conserva los truncamientos declarados", () => {
  return (
    tz.consultasTruncadas === 0 &&
    tz.candidatosTruncados === 0 &&
    typeof tz.totalConsultas === "number"
  );
});

await t("costeMonetario null con su nota, sin inventar cifras", () => {
  return (tz.proveedores || []).every(
    (p) => p.costeMonetario === null && typeof p.notaDeCoste === "string"
  );
});

await t("la referencia del analista sigue sin autoverificarse", () => {
  const ref = (tz.candidatosSociales || []).find(
    (c) => c.handle === "juancristobal.lloretvaldivieso"
  );

  return ref.origen === "analista" && ref.proveedores.length === 0;
});

/*
===========================================================
DOS EJECUCIONES CONSECUTIVAS IDENTICAS
===========================================================
*/

bloque("BUG-13.e  dos ejecuciones consecutivas con hallazgos idénticos");

await t("una tercera ejecución idéntica también se registra", async () => {
  const N2 = await ps.registrarInvestigacion(PID, CID, RESULTADO);

  const c = await ps.contenidoDeProyecto(PID);

  const x = c.candidatos.find((y) => y.id === CID);

  return (
    N2.ejecucionRegistrada === true &&
    N2.sinCambios === true &&
    x.totalEjecuciones === 3 &&
    /* y los hallazgos siguen sin duplicarse */
    x.expediente.cuentas.length === 2 &&
    x.expediente.medios.length === 7
  );
});

await t("las tres ejecuciones tienen id distinto y traza propia", async () => {
  const c = await ps.contenidoDeProyecto(PID);

  const x = c.candidatos.find((y) => y.id === CID);

  const ids = new Set(x.ejecuciones.map((e) => e.investigacionId));

  return ids.size === 3 && x.ejecuciones.every((e) => !!e.traza);
});

await t("el estado de investigación sigue siendo completada", async () => {
  const c = await ps.contenidoDeProyecto(PID);

  return (
    c.candidatos.find((y) => y.id === CID).estadoInvestigacion === "completada"
  );
});

/*
===========================================================
UN CANDIDATO SIN INVESTIGAR NO INVENTA EJECUCIONES
===========================================================
*/

bloque("BUG-13.f  sin investigar, sin ejecuciones");

await t("un candidato nuevo tiene 0 ejecuciones y ninguna última", async () => {
  await ps.agregarCandidato(PID, { nombre: "Nadie Investigado Aun" });

  const c = await ps.contenidoDeProyecto(PID);

  const x = c.candidatos.find((y) => y.id === "nadie-investigado-aun");

  return (
    x.totalEjecuciones === 0 &&
    x.ultimaEjecucion === null &&
    x.estadoInvestigacion === "sin_investigar"
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
