// apps/backend/tests/territorial-topic.test.mjs

import {
  TERRITORIO_NO_RESUELTO,
  TIPOS_SENAL,
  ESTADOS_COBERTURA,
  ESTADOS_TENDENCIA,
  UMBRALES,
  clasificarSenal,
  toponimosDe,
  normalizarToponimo,
  normalizarEvidenciaMatriz,
  inicioDeObservacion,
  ventanaAnteriorComparable,
  construirMatriz,
  compararVentanas,
  cruzarTemaTerritorio
} from "../services/geo/topicTerritoryCrosstab.js";

import { ventanaDeDias } from "../services/territorial/dayWindow.js";

/*
===========================================================
PRUEBAS DE TERRITORIAL-TOPIC-TERRITORY-01
===========================================================

    node tests/territorial-topic.test.mjs

SIN RED: este gate no invoca ningun adapter. El contador sobre
`fetch` lo comprueba.

El corpus de las pruebas es sintetico y DELIBERADAMENTE
incomodo: fechas en dos formatos, evidencias sin fecha,
evidencias sin territorio y una señal que es un toponimo. Son
los cuatro casos que aparecieron en el corpus real.
===========================================================
*/

let pass = 0;

let fail = 0;

const fallos = [];

function t(nombre, comprobacion) {
  try {
    if (comprobacion()) {
      pass += 1;
      console.log(`  PASS  ${nombre}`);
    } else {
      fail += 1;
      fallos.push(nombre);
      console.log(`  FALL  ${nombre}`);
    }
  } catch (e) {
    fail += 1;
    fallos.push(`${nombre} — ${e.message}`);
    console.log(`  ERR   ${nombre}: ${e.message}`);
  }
}

async function ta(nombre, comprobacion) {
  try {
    if (await comprobacion()) {
      pass += 1;
      console.log(`  PASS  ${nombre}`);
    } else {
      fail += 1;
      fallos.push(nombre);
      console.log(`  FALL  ${nombre}`);
    }
  } catch (e) {
    fail += 1;
    fallos.push(`${nombre} — ${e.message}`);
    console.log(`  ERR   ${nombre}: ${e.message}`);
  }
}


let llamadasDeRed = 0;

const fetchOriginal = globalThis.fetch;

globalThis.fetch = () => {
  llamadasDeRed += 1;

  return Promise.reject(new Error("RED PROHIBIDA EN LAS PRUEBAS"));
};


const AHORA = "2026-08-31T14:00:00.000Z";

const CUENCA = "ec-azuay-cuenca";

const TOPONIMOS = toponimosDe(["Ecuador", "Azuay", "Cuenca", "Machángara", "El Batán"]);

const ubic = (unidadId, nombre, nivel, razones = ["toponimo presente (+40)"]) => ({
  unidadId,
  unidad: nombre,
  nivel,
  procedencia: "derivada",
  confianzaGeografica: 72,
  razones
});


/*
  Corpus sintetico.

  Las fechas se dan en los DOS formatos que trae el libro real:
  ISO y RFC 2822. `ev-nofecha` no tiene fecha a proposito.
*/
function corpus() {
  return [
    {
      evidenceId: "ev-a",
      titulo: "Nueva ordenanza de movilidad en el centro",
      sourceId: "elmercurio.com.ec",
      publisher: "El Mercurio",
      publishedAt: "2026-08-30T10:00:00Z",
      firstObservedAt: "2026-08-30T12:00:00.000Z"
    },
    {
      evidenceId: "ev-b",
      titulo: "El tranvia amplia su horario",
      sourceId: "unsion.tv",
      publisher: "Unsion TV",
      publishedAt: "Sat, 29 Aug 2026 09:00:00 GMT",
      firstObservedAt: "2026-08-30T12:00:00.000Z"
    },
    {
      evidenceId: "ev-c",
      titulo: "Obras de alcantarillado en la parroquia",
      sourceId: "etapa.net.ec",
      publisher: "ETAPA EP",
      publishedAt: "2026-08-28T08:00:00Z",
      firstObservedAt: "2026-08-30T12:00:00.000Z"
    },
    {
      evidenceId: "ev-d",
      titulo: "Feria de emprendimiento",
      sourceId: "news.google.com",

      /* Emisor sin resolver: el agregador oculta al publicador. */
      publisher: null,
      publishedAt: "2026-08-31T07:00:00Z",
      firstObservedAt: "2026-08-31T09:00:00.000Z"
    },
    {
      evidenceId: "ev-nofecha",
      titulo: "Nota sin fecha declarada",
      sourceId: "elmercurio.com.ec",
      publisher: "El Mercurio",
      publishedAt: null,
      firstObservedAt: "2026-08-30T12:00:00.000Z"
    },
    {
      evidenceId: "ev-viejo",
      titulo: "Presupuesto participativo del año pasado",
      sourceId: "elmercurio.com.ec",
      publisher: "El Mercurio",
      publishedAt: "2026-01-15T10:00:00Z",
      firstObservedAt: "2026-08-30T12:00:00.000Z"
    }
  ];
}

/* indices: 0=a 1=b 2=c 3=d 4=nofecha 5=viejo */
const UBICACIONES = [
  ubic(CUENCA, "Cuenca", "canton"),
  ubic(CUENCA, "Cuenca", "canton"),
  ubic("ec-azuay-cuenca-machangara", "Machángara", "parroquia"),

  /* ev-d sin territorio: hueco declarado, no descartado. */
  undefined,
  ubic(CUENCA, "Cuenca", "canton"),
  ubic(CUENCA, "Cuenca", "canton")
];

const TEMAS = [
  { id: "movilidad", nombre: "Movilidad y transporte", indices: [0, 1] },
  { id: "agua", nombre: "Agua y saneamiento", indices: [2] },
  { id: "gobernanza", nombre: "Gestion y gobernanza", indices: [3, 4, 5] }
];

const DESCUBIERTOS = [
  /* Un toponimo colandose como tema: el caso del corpus real. */
  { id: "emergente-cuenca", etiquetaPropuesta: "cuenca", indices: [0, 1, 2, 3] }
];


/* =========================================================
   1. TEMA NO ES LUGAR
   ========================================================= */

console.log("\n--- Tema, lugar y entidad ---\n");

t("un toponimo no es un tema", () =>
  clasificarSenal("cuenca", TOPONIMOS) === TIPOS_SENAL.LUGAR &&
  clasificarSenal("azuay", TOPONIMOS) === TIPOS_SENAL.LUGAR &&
  clasificarSenal("cuenca ecuador", TOPONIMOS) === TIPOS_SENAL.LUGAR);

t("un tema con un toponimo dentro SIGUE siendo un tema", () =>
  clasificarSenal("alcaldia cuenca", TOPONIMOS) === TIPOS_SENAL.TEMA &&
  clasificarSenal("agua en Cuenca", TOPONIMOS) === TIPOS_SENAL.TEMA &&
  clasificarSenal("Movilidad y transporte", TOPONIMOS) === TIPOS_SENAL.TEMA);

t("los acentos no cambian la clasificacion", () =>
  clasificarSenal("Machángara", TOPONIMOS) === TIPOS_SENAL.LUGAR &&
  clasificarSenal("machangara", TOPONIMOS) === TIPOS_SENAL.LUGAR &&
  normalizarToponimo("Machángara") === "machangara");

t("sin gazetteer no se inventa: todo es TEMA", () =>
  clasificarSenal("cuenca", null) === TIPOS_SENAL.TEMA &&
  clasificarSenal("cuenca", new Set()) === TIPOS_SENAL.TEMA);

t("el conectivo «estado» no convierte a azuay en tema", () =>
  clasificarSenal("azuay · estado", TOPONIMOS) === TIPOS_SENAL.LUGAR);

t("las señales que son lugar se cuentan APARTE, no se borran", () => {
  const m = construirMatriz({
    evidencias: corpus(),
    temas: TEMAS,
    descubiertos: DESCUBIERTOS,
    ubicaciones: UBICACIONES,
    ventanaId: "7d",
    ahora: AHORA,
    toponimos: TOPONIMOS
  });

  const lugares = m.filas.filter((f) => f.tipoSenal === TIPOS_SENAL.LUGAR);

  return (
    lugares.length > 0 &&
    m.metricas.senalesQueSonLugar === 1 &&
    !m.metricas.temas === false &&
    m.metricas.temas === 3
  );
});


/* =========================================================
   2. VENTANAS
   ========================================================= */

console.log("\n--- Ventanas ---\n");

t("una evidencia SIN fecha no entra en ninguna ventana", () => {
  const m = construirMatriz({
    evidencias: corpus(),
    temas: TEMAS,
    descubiertos: [],
    ubicaciones: UBICACIONES,
    ventanaId: "90d",
    ahora: AHORA,
    toponimos: TOPONIMOS
  });

  const todos = m.filas.flatMap((f) => f.evidenceIds);

  return !todos.includes("ev-nofecha");
});

t("una evidencia fuera de la ventana no entra", () => {
  const corta = construirMatriz({
    evidencias: corpus(),
    temas: TEMAS,
    descubiertos: [],
    ubicaciones: UBICACIONES,
    ventanaId: "7d",
    ahora: AHORA,
    toponimos: TOPONIMOS
  });

  const larga = construirMatriz({
    evidencias: corpus(),
    temas: TEMAS,
    descubiertos: [],
    ubicaciones: UBICACIONES,
    ventanaId: "90d",
    ahora: AHORA,
    toponimos: TOPONIMOS
  });

  const enCorta = corta.filas.flatMap((f) => f.evidenceIds);

  const enLarga = larga.filas.flatMap((f) => f.evidenceIds);

  /* `ev-viejo` es de enero: cabe en 90d pero no en 7d. */
  return !enCorta.includes("ev-viejo") && enLarga.includes("ev-viejo") === false;
});

t("las cinco ventanas del gate se calculan", () =>
  ["hoy", "7d", "15d", "30d", "90d"].every((v) => {
    const m = construirMatriz({
      evidencias: corpus(),
      temas: TEMAS,
      descubiertos: [],
      ubicaciones: UBICACIONES,
      ventanaId: v,
      ahora: AHORA,
      toponimos: TOPONIMOS
    });

    return Boolean(m.ventana.desde && m.ventana.hasta);
  }));

t("HOY es un dia de calendario en la zona del territorio", () => {
  const m = construirMatriz({
    evidencias: corpus(),
    temas: TEMAS,
    descubiertos: [],
    ubicaciones: UBICACIONES,
    ventanaId: "hoy",
    ahora: AHORA,
    toponimos: TOPONIMOS
  });

  /* UTC-5: el dia local empieza a las 05:00 UTC. */
  return m.ventana.desde === "2026-08-31T05:00:00.000Z";
});

t("la ventana anterior es adyacente y NO se solapa", () => {
  const actual = ventanaDeDias(7, AHORA);

  const anterior = ventanaAnteriorComparable(actual, 7);

  return (
    new Date(anterior.hasta).getTime() < new Date(actual.desde).getTime() &&
    Math.round(
      (new Date(actual.desde).getTime() - new Date(anterior.desde).getTime()) / 86400000
    ) === 7
  );
});


/* =========================================================
   3. TERRITORIO
   ========================================================= */

console.log("\n--- Territorio ---\n");

const matriz7d = construirMatriz({
  evidencias: corpus(),
  temas: TEMAS,
  descubiertos: DESCUBIERTOS,
  ubicaciones: UBICACIONES,
  ventanaId: "7d",
  ahora: AHORA,
  toponimos: TOPONIMOS
});

t("una evidencia sin territorio es VISIBLE, no descartada", () => {
  const fila = matriz7d.filas.find((f) => f.territorioId === TERRITORIO_NO_RESUELTO);

  return (
    Boolean(fila) &&
    fila.coverageStatus === ESTADOS_COBERTURA.TERRITORIO_NO_RESUELTO &&
    fila.evidenceIds.includes("ev-d") &&
    matriz7d.metricas.celdasSinTerritorio >= 1
  );
});

t("no se fuerza una parroquia: cada celda lleva su nivel real", () => {
  const parroquia = matriz7d.filas.find((f) => f.nivel === "parroquia");

  const canton = matriz7d.filas.find((f) => f.nivel === "canton");

  return Boolean(parroquia) && Boolean(canton) && parroquia.territorioId !== canton.territorioId;
});

t("cada celda declara POR QUE se atribuyo ese territorio", () => {
  const c = matriz7d.filas.find((f) => f.territorioId === CUENCA);

  return (
    c.atribucion.length > 0 &&
    c.atribucion.some((r) => /procedencia/.test(r)) &&
    c.atribucion.some((r) => /confianza/.test(r))
  );
});

t("el nombre del territorio nunca es un objeto", () => {
  const conObjeto = construirMatriz({
    evidencias: corpus(),
    temas: [{ id: "x", nombre: "Tema", indices: [0] }],
    descubiertos: [],

    /* `resolverUbicacion` devuelve `unidad` como OBJETO. */
    ubicaciones: [
      { unidadId: CUENCA, unidad: { id: CUENCA, nombre: "Cuenca" }, resolucion: "canton" }
    ],
    ventanaId: "7d",
    ahora: AHORA
  });

  return conObjeto.filas[0].territorio === "Cuenca";
});

t("un tema NO se reparte entre las parroquias del canton", () => {
  const agua = matriz7d.filas.filter((f) => f.temaId === "agua");

  /* Una sola evidencia, un solo territorio: no se replica. */
  return agua.length === 1 && agua[0].evidencias === 1;
});


/* =========================================================
   4. FUENTES Y EMISORES
   ========================================================= */

console.log("\n--- Fuentes y emisores ---\n");

t("se cuentan fuentes y emisores por separado", () => {
  const mov = matriz7d.filas.find((f) => f.temaId === "movilidad");

  return mov.fuentes === 2 && mov.emisores === 2 && mov.listaFuentes.length === 2;
});

t("un emisor sin resolver NO se cuenta como emisor", () => {
  const fila = matriz7d.filas.find((f) => f.evidenceIds.includes("ev-d"));

  return fila.emisores === 0 && fila.emisoresSinResolver === 1;
});

t("una sola fuente es COBERTURA_BAJA aunque haya varias evidencias", () => {
  const m = construirMatriz({
    evidencias: corpus(),
    temas: [{ id: "solo", nombre: "De un solo medio", indices: [0, 4] }],
    descubiertos: [],
    ubicaciones: UBICACIONES,
    ventanaId: "7d",
    ahora: AHORA
  });

  const f = m.filas[0];

  return f.fuentes === 1 && f.coberturaEvidencial === ESTADOS_COBERTURA.COBERTURA_BAJA;
});


/* =========================================================
   5. COBERTURA Y CERO FALSO
   ========================================================= */

console.log("\n--- Cobertura y cero falso ---\n");

t("dos evidencias de dos fuentes en ventana observada son OBSERVADO", () => {
  /*
    El corpus base se empezo a observar el 30 de agosto, asi que
    su ventana de 7 dias NO esta cubierta: por eso aqui se usa un
    corpus observado desde antes. La distincion es justo la que
    prueba el caso siguiente.
  */
  const observadoDesdeAntes = corpus().map((e) => ({
    ...e,
    firstObservedAt: "2026-08-01T00:00:00.000Z"
  }));

  const m = construirMatriz({
    evidencias: observadoDesdeAntes,
    temas: TEMAS,
    descubiertos: [],
    ubicaciones: UBICACIONES,
    ventanaId: "7d",
    ahora: AHORA,
    toponimos: TOPONIMOS
  });

  const mov = m.filas.find((f) => f.temaId === "movilidad");

  return m.ventana.historicoCubre === true && mov.coverageStatus === ESTADOS_COBERTURA.OBSERVADO;
});


t("el corpus base NO cubre su ventana de 7 dias, y se dice", () =>
  matriz7d.ventana.historicoCubre === false &&
  matriz7d.filas.find((f) => f.temaId === "movilidad").coverageStatus ===
    ESTADOS_COBERTURA.HISTORICO_INSUFICIENTE);

t("HISTORICO_INSUFICIENTE cuando la ventana empieza antes de observar", () => {
  const m = construirMatriz({
    evidencias: corpus(),
    temas: TEMAS,
    descubiertos: [],
    ubicaciones: UBICACIONES,
    ventanaId: "90d",
    ahora: AHORA
  });

  return (
    m.ventana.historicoCubre === false &&
    /INCOMPLETO/.test(m.ventana.motivo) &&
    m.filas.some((f) => f.coverageStatus === ESTADOS_COBERTURA.HISTORICO_INSUFICIENTE)
  );
});

t("la cobertura evidencial se conserva aparte del historico", () => {
  const m = construirMatriz({
    evidencias: corpus(),
    temas: TEMAS,
    descubiertos: [],
    ubicaciones: UBICACIONES,
    ventanaId: "90d",
    ahora: AHORA
  });

  const mov = m.filas.find((f) => f.temaId === "movilidad");

  /* El historico manda, pero no borra el juicio de cobertura. */
  return (
    mov.coverageStatus === ESTADOS_COBERTURA.HISTORICO_INSUFICIENTE &&
    mov.coberturaEvidencial === ESTADOS_COBERTURA.OBSERVADO
  );
});

t("CERO NUNCA significa desconocido: no hay celdas vacias inventadas", () => {
  /* Ninguna fila tiene 0 evidencias: las celdas sin evidencia no se fabrican. */
  return matriz7d.filas.every((f) => f.evidencias > 0);
});

t("una ventana sin evidencia da matriz vacia, no ceros", () => {
  const m = construirMatriz({
    evidencias: corpus(),
    temas: TEMAS,
    descubiertos: [],
    ubicaciones: UBICACIONES,
    ventanaId: "hoy",
    ahora: "2026-09-15T14:00:00.000Z",
    toponimos: TOPONIMOS
  });

  return m.filas.length === 0 && m.metricas.celdas === 0 && m.metricas.evidenciasEnVentana === 0;
});

t("SIN_EVIDENCIA existe como estado declarado", () =>
  ESTADOS_COBERTURA.SIN_EVIDENCIA === "SIN_EVIDENCIA" &&
  ESTADOS_COBERTURA.HISTORICO_INSUFICIENTE === "HISTORICO_INSUFICIENTE");


/* =========================================================
   6. EVIDENCIA AUDITABLE Y DEDUP
   ========================================================= */

console.log("\n--- Evidencia y dedup ---\n");

t("cada celda lleva los evidenceId que la sostienen", () => {
  const mov = matriz7d.filas.find((f) => f.temaId === "movilidad");

  return (
    mov.evidenceIds.length === mov.evidencias &&
    mov.evidenceIds.includes("ev-a") &&
    mov.evidenceIds.includes("ev-b")
  );
});

t("la misma evidencia NO se cuenta dos veces en la misma celda", () => {
  const m = construirMatriz({
    evidencias: corpus(),

    /* El mismo indice repetido: no debe duplicar. */
    temas: [{ id: "rep", nombre: "Repetida", indices: [0, 0, 0] }],
    descubiertos: [],
    ubicaciones: UBICACIONES,
    ventanaId: "7d",
    ahora: AHORA
  });

  return m.filas[0].evidenceIds.length === 1 && m.filas[0].evidenceIds[0] === "ev-a";
});

t("una evidencia en DOS temas cuenta en los dos: habla de los dos", () => {
  const m = construirMatriz({
    evidencias: corpus(),
    temas: [
      { id: "t1", nombre: "Tema uno", indices: [0] },
      { id: "t2", nombre: "Tema dos", indices: [0] }
    ],
    descubiertos: [],
    ubicaciones: UBICACIONES,
    ventanaId: "7d",
    ahora: AHORA
  });

  return (
    m.filas.length === 2 && m.filas.every((f) => f.evidenceIds.length === 1 && f.evidencias === 1)
  );
});

t("el rango de publicacion sale bien con fechas ISO y RFC 2822 mezcladas", () => {
  const mov = matriz7d.filas.find((f) => f.temaId === "movilidad");

  /* ev-b es RFC 2822 del 29; ev-a es ISO del 30. */
  return (
    new Date(mov.rangoPublicacion.desde).getTime() <
    new Date(mov.rangoPublicacion.hasta).getTime()
  );
});

t("se declara la primera y la ultima observacion", () => {
  const mov = matriz7d.filas.find((f) => f.temaId === "movilidad");

  return mov.primeraObservacion === "2026-08-30T12:00:00.000Z" && Boolean(mov.ultimaObservacion);
});

t("inicioDeObservacion es el minimo real, no el primero de la lista", () =>
  inicioDeObservacion([
    { firstObservedAt: "2026-08-31T09:00:00.000Z" },
    { firstObservedAt: "2026-08-30T12:00:00.000Z" }
  ]) === "2026-08-30T12:00:00.000Z");

t("normalizar acepta los dos vocabularios sin inventar lo que falta", () => {
  const delLibro = normalizarEvidenciaMatriz({ title: "T", sourceId: "d.ec", publishedAt: "x" });

  const deLaRuta = normalizarEvidenciaMatriz({ titulo: "T", dominio: "d.ec", fecha: "x" });

  return (
    delLibro.titulo === "T" &&
    deLaRuta.titulo === "T" &&
    delLibro.fuente === deLaRuta.fuente &&
    delLibro.emisor === null
  );
});


/* =========================================================
   7. TENDENCIA
   ========================================================= */

console.log("\n--- Comparacion temporal ---\n");

/*
  Corpus con historico de verdad: observado desde el 1 de agosto,
  asi que las dos ventanas de 7 dias caen dentro de la
  observacion.
*/
function corpusConHistorico() {
  const ev = [];

  const meter = (n, fecha) => {
    for (let i = 0; i < n; i += 1) {
      ev.push({
        evidenceId: `ev-${fecha}-${i}`,
        titulo: `Nota ${i} de ${fecha}`,
        sourceId: `medio${i % 3}.ec`,
        publisher: `Medio ${i % 3}`,
        publishedAt: `${fecha}T10:00:00Z`,
        firstObservedAt: "2026-08-01T00:00:00.000Z"
      });
    }
  };

  /* ventana actual 7d: 25..31 ago */
  meter(8, "2026-08-27");

  /* ventana anterior 7d: 18..24 ago */
  meter(3, "2026-08-20");

  return ev;
}

const CON_HISTORICO = corpusConHistorico();

const indicesActual = CON_HISTORICO.map((_, i) => i).filter((i) =>
  CON_HISTORICO[i].publishedAt.startsWith("2026-08-27")
);

const indicesAnterior = CON_HISTORICO.map((_, i) => i).filter((i) =>
  CON_HISTORICO[i].publishedAt.startsWith("2026-08-20")
);

t("CRECIENDO cuando se observaban las dos ventanas y hay muestra", () => {
  const c = compararVentanas({
    evidencias: CON_HISTORICO,
    temas: [{ id: "sube", nombre: "Sube", indices: [...indicesActual, ...indicesAnterior] }],
    descubiertos: [],
    ventanaId: "7d",
    ahora: AHORA
  });

  const f = c.filas[0];

  return (
    c.observabamosLaVentanaAnterior === true &&
    f.ventanaActual.evidencias === 8 &&
    f.ventanaAnterior.evidencias === 3 &&
    f.estado === ESTADOS_TENDENCIA.CRECIENDO &&
    f.variacionRelativa > 0
  );
});

t("DISMINUYENDO es el caso simetrico", () => {
  const invertido = CON_HISTORICO.map((e) => ({
    ...e,
    publishedAt: e.publishedAt.startsWith("2026-08-27")
      ? e.publishedAt.replace("2026-08-27", "2026-08-20")
      : e.publishedAt.replace("2026-08-20", "2026-08-27")
  }));

  const c = compararVentanas({
    evidencias: invertido,
    temas: [{ id: "baja", nombre: "Baja", indices: invertido.map((_, i) => i) }],
    descubiertos: [],
    ventanaId: "7d",
    ahora: AHORA
  });

  return c.filas[0].estado === ESTADOS_TENDENCIA.DISMINUYENDO;
});

t("ESTABLE cuando la variacion esta por debajo del umbral declarado", () => {
  const ev = [];

  const meter = (n, fecha) => {
    for (let i = 0; i < n; i += 1) {
      ev.push({
        evidenceId: `e-${fecha}-${i}`,
        titulo: `N${i}`,
        sourceId: "m.ec",
        publishedAt: `${fecha}T10:00:00Z`,
        firstObservedAt: "2026-08-01T00:00:00.000Z"
      });
    }
  };

  meter(8, "2026-08-27");

  meter(8, "2026-08-20");

  const c = compararVentanas({
    evidencias: ev,
    temas: [{ id: "igual", nombre: "Igual", indices: ev.map((_, i) => i) }],
    descubiertos: [],
    ventanaId: "7d",
    ahora: AHORA
  });

  return c.filas[0].estado === ESTADOS_TENDENCIA.ESTABLE && c.filas[0].variacionRelativa === 0;
});

t("HISTORICO_INSUFICIENTE cuando NO se observaba la ventana anterior", () => {
  const c = compararVentanas({
    evidencias: corpus(),
    temas: TEMAS,
    descubiertos: [],
    ventanaId: "7d",
    ahora: AHORA
  });

  return (
    c.observabamosLaVentanaAnterior === false &&
    c.filas.every((f) => f.estado === ESTADOS_TENDENCIA.HISTORICO_INSUFICIENTE) &&
    c.metricas.conTendenciaDeclarable === 0 &&
    /No se puede comparar/.test(c.filas[0].motivo) &&
    /empezó a observar/.test(c.filas[0].motivo)
  );
});

t("UNA sola publicacion no sostiene una tendencia", () => {
  const ev = [
    {
      evidenceId: "uno",
      titulo: "Unica",
      sourceId: "m.ec",
      publishedAt: "2026-08-27T10:00:00Z",
      firstObservedAt: "2026-08-01T00:00:00.000Z"
    }
  ];

  const c = compararVentanas({
    evidencias: ev,
    temas: [{ id: "solo", nombre: "Solo una", indices: [0] }],
    descubiertos: [],
    ventanaId: "7d",
    ahora: AHORA
  });

  return (
    c.filas[0].estado === ESTADOS_TENDENCIA.MUESTRA_INSUFICIENTE &&
    c.filas[0].variacionRelativa === null
  );
});

t("con base cero NO se da variacion relativa", () => {
  const ev = [];

  for (let i = 0; i < 5; i += 1) {
    ev.push({
      evidenceId: `n${i}`,
      titulo: `N${i}`,
      sourceId: `m${i}.ec`,
      publishedAt: "2026-08-27T10:00:00Z",
      firstObservedAt: "2026-08-01T00:00:00.000Z"
    });
  }

  const c = compararVentanas({
    evidencias: ev,
    temas: [{ id: "nuevo", nombre: "Nuevo", indices: ev.map((_, i) => i) }],
    descubiertos: [],
    ventanaId: "7d",
    ahora: AHORA
  });

  return (
    c.filas[0].ventanaAnterior.evidencias === 0 &&
    c.filas[0].variacionRelativa === null &&
    c.filas[0].estado === ESTADOS_TENDENCIA.CRECIENDO &&
    /dividir por cero/.test(c.filas[0].motivo)
  );
});

t("el umbral de tendencia esta declarado, no escondido", () =>
  UMBRALES.evidenciasParaTendencia > 1 && UMBRALES.umbralEstable > 0);


/* =========================================================
   8. NADA DE PORCENTAJES NI «VIRAL»
   ========================================================= */

console.log("\n--- Lo que no se calcula ---\n");

t("ninguna celda trae porcentaje poblacional ni de electores", () => {
  const json = JSON.stringify(matriz7d);

  return [
    "porcentajePoblacion",
    "penetracion",
    "perCapita",
    "porcentajeElectores",
    "padron",
    "intencionVoto",
    "aprobacion",
    "influencia",
    "probabilidadElectoral"
  ].every((p) => !json.includes(p));
});

t("las reglas dicen explicitamente que la metrica es conteo absoluto", () =>
  matriz7d.reglas.some((r) => /CONTEO ABSOLUTO/.test(r)) &&
  matriz7d.reglas.some((r) => /denominador oficial/.test(r)));

t("«viral» es null con su motivo, no un numero inventado", () =>
  matriz7d.filas.every((f) => f.viral === null && /NO_DISPONIBLE/.test(f.motivoViral)));

t("«emergente» no se declara: solo el hecho de la primera observacion", () => {
  const json = JSON.stringify(matriz7d.filas);

  return (
    !json.includes('"emergente"') &&
    matriz7d.filas.every((f) => typeof f.primeraObservacionEnLaVentana === "boolean")
  );
});


/* =========================================================
   9. AISLAMIENTO Y COMPATIBILIDAD
   ========================================================= */

console.log("\n--- Aislamiento y compatibilidad ---\n");

t("dos corpus distintos dan matrices independientes", () => {
  const a = construirMatriz({
    evidencias: corpus(),
    temas: TEMAS,
    descubiertos: [],
    ubicaciones: UBICACIONES,
    ventanaId: "7d",
    ahora: AHORA
  });

  const b = construirMatriz({
    evidencias: [],
    temas: TEMAS,
    descubiertos: [],
    ubicaciones: [],
    ventanaId: "7d",
    ahora: AHORA
  });

  return a.filas.length > 0 && b.filas.length === 0 && b.metricas.evidenciasEnCorpus === 0;
});

t("la matriz no muta el corpus que recibe", () => {
  const c = corpus();

  const copia = JSON.stringify(c);

  construirMatriz({
    evidencias: c,
    temas: TEMAS,
    descubiertos: DESCUBIERTOS,
    ubicaciones: UBICACIONES,
    ventanaId: "7d",
    ahora: AHORA,
    toponimos: TOPONIMOS
  });

  return JSON.stringify(c) === copia;
});

t("el cruce basico del Gate C2 sigue funcionando igual", () => {
  const r = cruzarTemaTerritorio({
    temas: TEMAS,
    descubiertos: [],
    ubicaciones: UBICACIONES,
    totalEvidencias: 6
  });

  return (
    r.filas.length === 3 &&
    r.metricas.evidenciasTotales === 6 &&
    r.filas.some((f) => f.sinGeolocalizar === 1) &&
    r.reglas.length === 4
  );
});


/* =========================================================
   10. SIN RED Y LA RUTA COMPILA
   ========================================================= */

console.log("\n--- Sin red y ruta ---\n");

t("cero llamadas al fetch global", () => llamadasDeRed === 0);

globalThis.fetch = fetchOriginal;

await ta("routes/territorio.js compila con el cruce conectado", async () => {
  const modulo = await import("../routes/territorio.js");

  return typeof modulo.default === "function";
});


/* --------------------------------------------------------- */

console.log("\n===========================================");
console.log(`PASS: ${pass}    FALL: ${fail}`);

if (fallos.length) {
  console.log("\nFallos:");
  fallos.forEach((f) => console.log(`  - ${f}`));
}

console.log("===========================================\n");

process.exit(fail > 0 ? 1 : 0);
