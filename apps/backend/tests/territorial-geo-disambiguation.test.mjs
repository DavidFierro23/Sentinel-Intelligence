// apps/backend/tests/territorial-geo-disambiguation.test.mjs

/*
===========================================================
TERRITORIAL-SOCIAL-GEO-DISAMBIGUATION-01

Pruebas A-X del gate. Cero red: el `fetch` global esta
contado y se comprueba al final.

Los casos no son inventados: los textos son los de las
evidencias REALES persistidas por el benchmark
(commit 976bb55), recortados.
===========================================================
*/

import assert from "node:assert/strict";

let llamadasDeRed = 0;
const fetchReal = globalThis.fetch;
globalThis.fetch = (...a) => {
  llamadasDeRed += 1;
  return fetchReal(...a);
};

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

const {
  ESTADOS_GEO,
  SENALES_POSITIVAS,
  SENALES_NEGATIVAS,
  esAptoParaMetricas,
  textoParaMostrar,
  desambiguarTerritorio,
  desambiguarLote,
  resumirDesambiguacion
} = await import("../services/territorial/socialGeoDisambiguation.js");

const { construirMatriz } = await import("../services/geo/topicTerritoryCrosstab.js");
const { resolverUbicacion } = await import("../services/geo/geoResolver.js");
const { construirUniversoDeActores } = await import("../services/territorial/actorUniverse.js");

const CUENCA = "ec-azuay-cuenca";

/*
  Se resuelve con el resolutor REAL, no con una ubicacion
  fabricada: si `geoResolver` cambia su comportamiento, estas
  pruebas lo notan.
*/
function resolver(texto, titulo = "") {
  return resolverUbicacion(
    { titulo, descripcion: texto, resumen: texto },
    { ambitoId: CUENCA }
  );
}

function clasificar(evidencia, emisores = new Set()) {
  const texto = `${evidencia.title || ""} ${evidencia.summary || ""}`;
  return desambiguarTerritorio({
    evidencia,
    ubicacion: resolver(texto, evidencia.title || ""),
    emisoresCorroborados: emisores
  });
}


/* =========================================================
   A. «Cuenca» sola no prueba Azuay
   ========================================================= */

console.log("\n--- A-F · señales ---\n");

t("A · «Cuenca» a secas no alcanza para afirmar territorio", () => {
  const r = clasificar({
    sourceId: "x:1",
    summary: "Intentan llevarse cervezas con una transferencia falsa en Cuenca"
  });

  /*
    El resolutor SIGUE ubicando —eso no se toca— pero la
    atribucion no es apta para metricas.
  */
  assert.equal(r.estadoGeo, ESTADOS_GEO.TERRITORIO_AMBIGUO);
  assert.equal(r.aptoParaMetricas, false);
  assert.equal(r.apoyadaSoloEnElTerminoAmbiguo, true);
  return true;
});

t("B · «Cuenca» + «Azuay» corrobora", () => {
  const r = clasificar({
    sourceId: "x:2",
    summary: "Los concejales de Cuenca, en Azuay, aprobaron la ordenanza"
  });

  assert.equal(r.estadoGeo, ESTADOS_GEO.TERRITORIO_CORROBORADO);
  assert.equal(r.aptoParaMetricas, true);
  return true;
});

t("C · «Cuenca» + «Ecuador» corrobora según contexto", () => {
  const r = clasificar({
    sourceId: "x:3",
    summary: "La defensa hídrica en Cuenca, Ecuador, y la protección de los páramos"
  });

  assert.equal(r.estadoGeo, ESTADOS_GEO.TERRITORIO_CORROBORADO);
  assert.ok(
    r.signalsPositive.includes(SENALES_POSITIVAS.CONTEXTO_PAIS_O_PROVINCIA) ||
      r.signalsPositive.includes(SENALES_POSITIVAS.INSTITUCION_LOCAL)
  );
  return true;
});

t("D · una institución inequívocamente local corrobora sin nombrar la provincia", () => {
  /* Caso real: Unsion TV sobre los radares de la EMOV EP. */
  const r = clasificar({
    sourceId: "youtube:UCOw8ehobkl3mW8PE1GqkIrQ",
    publisher: "Unsion TV",
    title: "La EMOV EP todavía no decide si se renovará el contrato de radares en Cuenca"
  });

  assert.equal(r.estadoGeo, ESTADOS_GEO.TERRITORIO_CORROBORADO);
  assert.ok(r.signalsPositive.includes(SENALES_POSITIVAS.INSTITUCION_LOCAL));
  return true;
});

t("E · cuenta extranjera con «Cuenca» en el texto no entra", () => {
  /* Caso real: La Republica, Peru. */
  const r = clasificar({
    sourceId: "x:66746614",
    publisher: "larepublica_pe",
    summary:
      "Lambayeque: alertan que cinco distritos enfrentarían racionamiento de agua. La ausencia de lluvias en la parte alta de la cuenca Chancay - Lambayeque"
  });

  assert.equal(r.estadoGeo, ESTADOS_GEO.FUERA_TERRITORIO);
  assert.equal(r.aptoParaMetricas, false);
  assert.ok(r.signalsNegative.includes(SENALES_NEGATIVAS.LUGAR_INCOMPATIBLE));
  return true;
});

t("F · el uso técnico de «cuenca» no entra por sí solo", () => {
  /* Caso real: la cuenta que explica que «cuenca» es un termino. */
  const r = clasificar({
    sourceId: "x:89837720",
    summary:
      'Es una palabra nueva para muchos, pero acostumbrémonos: "cuenca" es un término geográfico para delimitar un territorio deprimido'
  });

  assert.equal(r.aptoParaMetricas, false);
  assert.ok(r.signalsNegative.includes(SENALES_NEGATIVAS.USO_NO_GEOGRAFICO));
  return true;
});

t("F-bis · el uso hidrográfico NO descarta contenido ambiental local", () => {
  /*
    Limite que fija el gate expresamente: puede existir
    contenido ambiental legitimo de Cuenca hablando de su propia
    cuenca hidrografica. Con anclaje local solido —ETAPA,
    Tomebamba, Azuay— se corrobora, y la coocurrencia queda
    declarada en las señales.
  */
  const r = clasificar({
    sourceId: "x:99",
    summary:
      "ETAPA EP presentó el plan de manejo de la cuenca del río Tomebamba en Cuenca, Azuay"
  });

  assert.equal(r.estadoGeo, ESTADOS_GEO.TERRITORIO_CORROBORADO);
  assert.ok(r.signalsPositive.length > 0);
  assert.ok(r.signalsNegative.includes(SENALES_NEGATIVAS.USO_NO_GEOGRAFICO));
  assert.ok(/sustantivo com[úu]n/i.test(r.resolutionReason));
  return true;
});

t("F-ter · conflicto es anclaje local MÁS otro lugar real compitiendo", () => {
  const r = clasificar({
    sourceId: "x:98",
    summary:
      "El Municipio de Cuenca, Azuay, firmó un convenio con la municipalidad de Lambayeque, Perú"
  });

  assert.equal(r.estadoGeo, ESTADOS_GEO.TERRITORIO_CONFLICTIVO);
  assert.equal(r.aptoParaMetricas, false);
  assert.ok(r.signalsPositive.length > 0);
  assert.ok(r.signalsNegative.includes(SENALES_NEGATIVAS.LUGAR_INCOMPATIBLE));
  return true;
});


/* =========================================================
   G-K. las fuentes locales conocidas no se destruyen
   ========================================================= */

console.log("\n--- G-K · fuentes locales conocidas ---\n");

/*
  El corpus real: Unsion TV y WRadioEc tienen piezas
  corroboradas por contenido y piezas que no. El lote deriva el
  vinculo del emisor de las primeras.
*/
const LOTE_REAL = [
  {
    evidencia: {
      sourceId: "youtube:UCOw8ehobkl3mW8PE1GqkIrQ",
      publisher: "Unsion TV",
      title: "La EMOV EP todavía no decide si se renovará el contrato de radares en Cuenca"
    }
  },
  {
    evidencia: {
      sourceId: "youtube:UCOw8ehobkl3mW8PE1GqkIrQ",
      publisher: "Unsion TV",
      title: "Tres concejales de Cuenca defienden su trabajo de fiscalización"
    }
  },
  {
    evidencia: {
      sourceId: "x:229468495",
      publisher: "WRadioEc",
      summary:
        "La reactivación del sistema de fotorradares queda descartada, según confirmó el exalcalde de Cuenca, Pedro Palacios"
    }
  },
  {
    evidencia: {
      sourceId: "x:229468495",
      publisher: "WRadioEc",
      summary:
        "Un monitoreo constante con cámaras de videovigilancia se ejecuta en instituciones de Cuenca para resguardar el retorno a las aulas"
    }
  },
  {
    evidencia: {
      sourceId: "x:2525848868",
      publisher: "Bomberos_Cuenca",
      summary: "Atendimos un incendio estructural en el sector de Monay, en Cuenca"
    }
  },
  {
    evidencia: {
      sourceId: "x:720510248",
      publisher: "CNEAzuay",
      summary: "El CNE en Azuay informa sobre el cronograma electoral en Cuenca"
    }
  },
  {
    evidencia: {
      sourceId: "x:589368561",
      publisher: "ECU911Austro",
      summary: "ECU911 Austro coordinó la atención de una emergencia en Turi, Cuenca"
    }
  },
  {
    evidencia: {
      sourceId: "x:35058064",
      publisher: "elmercurioec",
      summary: "El Mercurio informa: el Municipio de Cuenca presentó la nueva ordenanza"
    }
  },
  {
    evidencia: {
      sourceId: "x:66746614",
      publisher: "larepublica_pe",
      summary:
        "Lambayeque: racionamiento de agua por el déficit de la cuenca Chancay - Lambayeque, Perú"
    }
  }
];

const lote = LOTE_REAL.map((e) => {
  const texto = `${e.evidencia.title || ""} ${e.evidencia.summary || ""}`;
  return { evidencia: e.evidencia, ubicacion: resolver(texto, e.evidencia.title || "") };
});

const { resultados: RES, emisoresLocalesCorroborados } = desambiguarLote(lote);

const porEmisor = (id) =>
  RES.filter((_, i) => lote[i].evidencia.sourceId === id);

t("G · Unsión TV no se pierde por no repetir «Azuay» en cada pieza", () => {
  const suyas = porEmisor("youtube:UCOw8ehobkl3mW8PE1GqkIrQ");

  assert.equal(suyas.length, 2);

  /* La de la EMOV corrobora por contenido. */
  assert.ok(suyas.some((r) => r.estadoGeo === ESTADOS_GEO.TERRITORIO_CORROBORADO));

  /*
    La otra NO cae a AMBIGUO: hereda el vinculo del emisor y
    queda PROBABLE. Sigue siendo evidencia visible.
  */
  assert.ok(
    suyas.every(
      (r) =>
        r.estadoGeo === ESTADOS_GEO.TERRITORIO_CORROBORADO ||
        r.estadoGeo === ESTADOS_GEO.TERRITORIO_PROBABLE
    )
  );
  return true;
});

t("H · WRadioEc no se pierde", () => {
  const suyas = porEmisor("x:229468495");

  assert.equal(suyas.length, 2);
  assert.ok(
    suyas.every(
      (r) =>
        r.estadoGeo === ESTADOS_GEO.TERRITORIO_CORROBORADO ||
        r.estadoGeo === ESTADOS_GEO.TERRITORIO_PROBABLE
    )
  );
  return true;
});

t("I · Bomberos_Cuenca queda contextualizado por evidencia, no por su nombre", () => {
  const [r] = porEmisor("x:2525848868");

  assert.equal(r.estadoGeo, ESTADOS_GEO.TERRITORIO_CORROBORADO);

  /*
    Lo que corrobora es «Monay», parroquia real del registro, no
    la cadena «Cuenca» del handle.
  */
  assert.ok(r.signalsPositive.includes(SENALES_POSITIVAS.TOPONIMO_LOCAL_NO_AMBIGUO));
  return true;
});

t("J · CNEAzuay queda contextualizado", () => {
  const [r] = porEmisor("x:720510248");

  assert.equal(r.estadoGeo, ESTADOS_GEO.TERRITORIO_CORROBORADO);
  assert.ok(r.signalsPositive.includes(SENALES_POSITIVAS.CONTEXTO_PAIS_O_PROVINCIA));
  return true;
});

t("K · ECU911Austro queda contextualizado", () => {
  const [r] = porEmisor("x:589368561");

  assert.equal(r.estadoGeo, ESTADOS_GEO.TERRITORIO_CORROBORADO);
  assert.ok(r.signalsPositive.includes(SENALES_POSITIVAS.TOPONIMO_LOCAL_NO_AMBIGUO));
  return true;
});

t("K-bis · elmercurioec corrobora por institución local", () => {
  const [r] = porEmisor("x:35058064");

  assert.equal(r.estadoGeo, ESTADOS_GEO.TERRITORIO_CORROBORADO);
  return true;
});

t("K-ter · un emisor no puede corroborarse a sí mismo", () => {
  /*
    Dos piezas del mismo emisor, ninguna corroborada por
    contenido. Si el vinculo del emisor se derivara de piezas
    PROBABLE, se corroborarian mutuamente.
  */
  const solas = [
    { evidencia: { sourceId: "x:solo", summary: "Algo ocurrió en Cuenca" } },
    { evidencia: { sourceId: "x:solo", summary: "Otra cosa ocurrió en Cuenca" } }
  ].map((e) => ({
    evidencia: e.evidencia,
    ubicacion: resolver(e.evidencia.summary)
  }));

  const { resultados, emisoresLocalesCorroborados: corr } = desambiguarLote(solas);

  assert.ok(!corr.includes("x:solo"));
  assert.ok(resultados.every((r) => r.estadoGeo === ESTADOS_GEO.TERRITORIO_AMBIGUO));
  return true;
});

t("K-quater · el emisor extranjero del mismo lote no se corrobora", () => {
  assert.ok(!emisoresLocalesCorroborados.includes("x:66746614"));

  const [r] = porEmisor("x:66746614");

  assert.equal(r.estadoGeo, ESTADOS_GEO.FUERA_TERRITORIO);
  return true;
});


/* =========================================================
   L-N. procedencia, certeza y personas
   ========================================================= */

console.log("\n--- L-N · límites epistémicos ---\n");

t("L · la procedencia de la consulta nunca cuenta como prueba de territorio", () => {
  const r = desambiguarTerritorio({
    evidencia: {
      sourceId: "x:5",
      summary: "El agua en La Habana y la fuente de abasto Cuenca Sur",
      provenance: { queryLabel: "x:neutral:base" },
      queryLabel: "x:neutral:base"
    },
    ubicacion: resolver("El agua en La Habana y la fuente de abasto Cuenca Sur")
  });

  /* Se registra... */
  assert.equal(r.queryProvenance, "x:neutral:base");

  /* ...y no aparece en ninguna de las dos listas de señales. */
  assert.ok(!r.signalsPositive.includes("x:neutral:base"));
  assert.ok(!JSON.stringify(r.signalsPositive).includes("query"));
  assert.equal(r.estadoGeo, ESTADOS_GEO.FUERA_TERRITORIO);
  return true;
});

t("M · un actor descubierto no se auto-verifica al reclasificar", () => {
  const u = construirUniversoDeActores({
    corpus: [
      {
        evidenceId: "e1",
        sourceId: "x:229468495",
        publisher: "WRadioEc",
        domain: "x:229468495",
        summary: "fotorradares en Cuenca, Azuay"
      }
    ]
  });

  const actores = u.actores || u.universo || [];

  assert.ok(actores.length > 0);
  assert.ok(actores.every((a) => a.certeza !== "VERIFICADO_POR_ANALISTA"));
  return true;
});

t("N · a una persona no se le infiere residencia por publicar sobre Cuenca", () => {
  const r = clasificar({
    sourceId: "x:6",
    publisher: "Hola soy mauri",
    author: "mauri",
    title: "Ya no es posible transitar en la feria el Arenal, Cuenca"
  });

  const texto = JSON.stringify(r);

  /* Ni el campo, ni el concepto, ni por la puerta de atrás. */
  assert.ok(!/residen|domicili|vive en|coordenad|latitud|longitud/i.test(texto));
  assert.equal(r.unidadId, CUENCA);

  /*
    Y ademas no es apta: que una persona hable de Cuenca no
    situa ni la pieza ni a la persona.
  */
  assert.equal(r.aptoParaMetricas, false);
  return true;
});


/* =========================================================
   O-Q. exclusión de métricas
   ========================================================= */

console.log("\n--- O-Q · métricas territoriales ---\n");

const AHORA = new Date().toISOString();

function matrizCon(evidencias, ubicaciones, aptitud) {
  return construirMatriz({
    evidencias,
    ubicaciones,
    temas: [{ id: "agua", nombre: "agua", indices: evidencias.map((_, i) => i) }],
    ahora: AHORA,
    aptitudTerritorial: aptitud
  });
}

const TRES = [
  { id: "ok", publishedAt: AHORA, titulo: "El Municipio de Cuenca, Azuay, y el agua" },
  { id: "amb", publishedAt: AHORA, titulo: "Algo del agua en Cuenca" },
  { id: "fuera", publishedAt: AHORA, titulo: "El agua en la cuenca Chancay, Lambayeque, Perú" }
];

const UBIC = TRES.map((e) => resolver(e.titulo));

const CLASES = TRES.map((e, i) =>
  desambiguarTerritorio({ evidencia: { sourceId: `s${i}`, title: e.titulo }, ubicacion: UBIC[i] })
);

const aptitud = (_e, i) => CLASES[i].aptoParaMetricas;

t("O · lo ambiguo no alimenta métricas territoriales", () => {
  assert.equal(CLASES[1].estadoGeo, ESTADOS_GEO.TERRITORIO_AMBIGUO);
  assert.equal(esAptoParaMetricas(CLASES[1].estadoGeo), false);

  const m = matrizCon(TRES, UBIC, aptitud);
  const cuenca = m.filas.filter((f) => f.territorioId === CUENCA);

  /* Solo la corroborada suma en la celda del canton. */
  assert.equal(
    cuenca.reduce((a, f) => a + f.evidencias, 0),
    1
  );
  return true;
});

t("P · lo conflictivo no alimenta métricas", () => {
  const T = "El Municipio de Cuenca, Azuay, y la municipalidad de Lambayeque, Perú";
  const conf = desambiguarTerritorio({
    evidencia: { sourceId: "x:c", summary: T },
    ubicacion: resolver(T)
  });

  assert.equal(conf.estadoGeo, ESTADOS_GEO.TERRITORIO_CONFLICTIVO);
  assert.equal(conf.aptoParaMetricas, false);
  return true;
});

t("Q · lo de fuera del territorio no alimenta métricas", () => {
  assert.equal(CLASES[2].estadoGeo, ESTADOS_GEO.FUERA_TERRITORIO);
  assert.equal(CLASES[2].aptoParaMetricas, false);
  return true;
});

t("Q-bis · PROBABLE tampoco entra: su territorio lo sostiene el emisor, no la pieza", () => {
  const probable = RES.find((r) => r.estadoGeo === ESTADOS_GEO.TERRITORIO_PROBABLE);

  assert.ok(probable, "el lote real debe producir al menos un PROBABLE");
  assert.equal(probable.aptoParaMetricas, false);
  return true;
});


/* =========================================================
   R. el corpus observado se preserva
   ========================================================= */

console.log("\n--- R · corpus observado ---\n");

t("R · excluir de métricas no borra la evidencia", () => {
  const m = matrizCon(TRES, UBIC, aptitud);

  /* Las tres siguen contadas: dos como territorio no resuelto. */
  const total = m.filas.reduce((a, f) => a + f.evidencias, 0);

  assert.equal(total, 3);

  const noResuelto = m.filas
    .filter((f) => f.territorioId === "TERRITORIO_NO_RESUELTO")
    .reduce((a, f) => a + f.evidencias, 0);

  assert.equal(noResuelto, 2);
  return true;
});

t("R-bis · el resumen distingue corpus observado de corpus elegible y cuadra", () => {
  const r = resumirDesambiguacion(RES);

  assert.equal(r.corpusObservado, RES.length);
  assert.ok(r.corpusTerritorialElegible < r.corpusObservado);
  assert.equal(r.cuadra, true);
  assert.equal(r.sumaDeEstados, r.corpusObservado);
  return true;
});

t("R-ter · no se emite porcentaje de confianza fabricado", () => {
  const texto = JSON.stringify(RES);

  assert.ok(!/"confianza(Geografica)?":\s*\d/.test(texto));
  assert.ok(!/probabilidad/i.test(texto));
  return true;
});


/* =========================================================
   S. aislamiento de proyecto
   ========================================================= */

console.log("\n--- S · aislamiento ---\n");

t("S · reclasificar el proyecto A no altera al proyecto B", () => {
  const A = [
    {
      evidencia: { projectId: "alcaldia-cuenca-2027-piloto", sourceId: "x:a", summary: "Cuenca, Azuay" }
    }
  ];

  const B = [
    { evidencia: { projectId: "otro-proyecto", sourceId: "x:b", summary: "Algo en Cuenca" } }
  ];

  const prep = (l) =>
    l.map((e) => ({ evidencia: e.evidencia, ubicacion: resolver(e.evidencia.summary) }));

  const antesB = desambiguarLote(prep(B));

  desambiguarLote(prep(A));

  const despuesB = desambiguarLote(prep(B));

  /*
    La clasificacion es una funcion pura del lote que recibe: no
    hay estado compartido entre proyectos.
  */
  assert.deepEqual(
    antesB.resultados.map((r) => r.estadoGeo),
    despuesB.resultados.map((r) => r.estadoGeo)
  );

  /* Y el emisor corroborado de A no se filtra a B. */
  assert.ok(!despuesB.emisoresLocalesCorroborados.includes("x:a"));
  return true;
});


/* =========================================================
   T. texto visible
   ========================================================= */

console.log("\n--- T · texto visible ---\n");

t("T · sin título, se muestra el resumen y se declara su origen", () => {
  const conTitulo = textoParaMostrar({ title: "Titular", summary: "Cuerpo" });
  const sinTitulo = textoParaMostrar({ title: "", summary: "Un tuit no tiene titular" });
  const vacio = textoParaMostrar({});

  assert.deepEqual(conTitulo, { texto: "Titular", origen: "title" });
  assert.deepEqual(sinTitulo, { texto: "Un tuit no tiene titular", origen: "summary" });
  assert.equal(vacio.texto, "");
  assert.equal(vacio.origen, null);
  return true;
});

t("T-bis · no se inventa un título ni se altera el registro", () => {
  const original = { title: "", summary: "texto original" };
  const copia = JSON.parse(JSON.stringify(original));

  textoParaMostrar(original);

  assert.deepEqual(original, copia);
  return true;
});


/* =========================================================
   U-X. regresiones
   ========================================================= */

console.log("\n--- U-X · regresiones ---\n");

t("U · regresión X: una pieza de X con solo summary sigue clasificándose", () => {
  const r = clasificar({
    sourceId: "x:229468495",
    publisher: "WRadioEc",
    title: "",
    summary: "El Municipio de Cuenca, Azuay, anunció la obra"
  });

  assert.equal(r.unidadId, CUENCA);
  assert.equal(r.estadoGeo, ESTADOS_GEO.TERRITORIO_CORROBORADO);
  return true;
});

t("V · regresión YouTube: una pieza con solo title sigue clasificándose", () => {
  const r = clasificar({
    sourceId: "youtube:UCOw8ehobkl3mW8PE1GqkIrQ",
    publisher: "Unsion TV",
    title: "La EMOV EP y los radares en Cuenca",
    summary: ""
  });

  assert.equal(r.estadoGeo, ESTADOS_GEO.TERRITORIO_CORROBORADO);
  return true;
});

t("W · regresión web/RSS: la prensa local no pierde resolución", () => {
  /*
    El caso que protege este gate por el otro lado: una nota de
    medio local que nombra una parroquia sin repetir la
    provincia. Debe seguir resolviendo Y ser apta.
  */
  const u = resolver("Nueva vía en Sayausí, obra del Municipio de Cuenca");

  assert.ok(u.unidadId);

  const r = desambiguarTerritorio({
    evidencia: { domain: "elmercurio.com.ec", title: "Nueva vía en Sayausí, obra del Municipio de Cuenca" },
    ubicacion: u
  });

  assert.equal(r.aptoParaMetricas, true);
  return true;
});

t("W-bis · sin compuerta inyectada, la matriz se comporta igual que antes", () => {
  const sin = matrizCon(TRES, UBIC, null);
  const cuenca = sin.filas
    .filter((f) => f.territorioId === CUENCA)
    .reduce((a, f) => a + f.evidencias, 0);

  /*
    Las tres se atribuyen a Cuenca: es el comportamiento previo,
    con el defecto incluido. Se conserva para que encender la
    compuerta sea una decision del llamador y no un cambio
    silencioso para Candidate y Media.
  */
  assert.equal(cuenca, 3);
  return true;
});

t("X · regresión territorial: una pieza no resoluble sigue siendo no resoluble", () => {
  const r = desambiguarTerritorio({
    evidencia: { sourceId: "x:9", summary: "Sin ningún topónimo en el texto" },
    ubicacion: resolver("Sin ningún topónimo en el texto")
  });

  assert.equal(r.estadoGeo, ESTADOS_GEO.TERRITORIO_NO_RESOLUBLE);
  assert.equal(r.aptoParaMetricas, false);
  assert.equal(r.unidadId, null);
  return true;
});

t("X-bis · todos los estados declaran etiqueta y motivo", () => {
  const todos = [...RES, ...CLASES];

  assert.ok(todos.every((r) => r.etiqueta && r.resolutionReason));
  assert.ok(todos.every((r) => Array.isArray(r.signalsPositive) && Array.isArray(r.signalsNegative)));
  return true;
});


/* =========================================================
   sin red
   ========================================================= */

console.log("\n--- Sin red ---\n");

t("cero llamadas al fetch global", () => llamadasDeRed === 0);

console.log("\n===========================================");
console.log(`PASS: ${ok}    FALL: ${fall}`);
console.log("===========================================");

if (fall > 0) process.exitCode = 1;
