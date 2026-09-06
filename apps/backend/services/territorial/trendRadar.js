// apps/backend/services/territorial/trendRadar.js

/*
===========================================================
TREND RADAR EXPLICABLE
TERRITORIAL-TREND-RADAR-01
===========================================================

Base: TERRITORIAL-OPEN-SOCIAL-COVERAGE-04, commit b9068fb.

LO QUE ESTE MODULO NO DICE
-----------------------------------------------------------

No dice «viral». No dice «todo Cuenca habla de». No dice «la
ciudadania piensa». No dice «tema dominante en Cuenca». No dice
intencion de voto ni representatividad.

Dice, y solo dice:

    «mayor actividad observable en las fuentes cubiertas»
    «crecimiento observable entre dos observaciones»
    «mayor diversidad de fuentes observadas»

TEMA != TENDENCIA
-----------------------------------------------------------

Un tema es una agrupacion de evidencias. Una tendencia exige
tiempo, y con DOS observaciones no hay tendencia: hay una
primera derivada.

De ahi que los estados de cambio se llamen
`RISING_OBSERVED`, `FALLING_OBSERVED`, `NEWLY_OBSERVED` — con
el sufijo puesto a proposito— y que no exista ningun
`TREND_STABLE` ni `MOMENTUM_CONFIRMED`.

LA DISTINCION QUE MAS IMPORTA
-----------------------------------------------------------

    OBSERVED_CONTENT_CHANGE    cambio en lo que se publica
    COLLECTION_COVERAGE_CHANGE cambio en lo que sabemos mirar

Entre la primera y la segunda observacion se activaron tres
motores: Google News, DuckDuckGo y el descubrimiento abierto de
TikTok. Un tema que crece porque ahora observamos TikTok NO
esta creciendo en el territorio: esta creciendo en nuestra
instrumentacion.

Atribuir eso a la campana o a la ciudad seria el error mas
caro que este modulo puede cometer, y por eso cada item lleva
`coverageExpansionContributed` con los motores implicados.

POR QUE NO HAY UN NUMERO DEL 0 AL 100
-----------------------------------------------------------

Se probo. La seccion de sensibilidad del documento tiene los
cinco escenarios de pesos. Si el orden del top cambia segun el
peso elegido, el numero no informa: decora. En ese caso el
modulo expone las dimensiones separadas y lo declara.
===========================================================
*/

import crypto from "node:crypto";


export const VERSION_RADAR = "trend-radar-1.0.0";


/*
===========================================================
VENTANAS
===========================================================

Solo `publishedAt`. `firstObservedAt` NO sustituye a
`publishedAt`: una pieza sin fecha editorial no entra en
ninguna ventana, y sigue existiendo en el corpus.
===========================================================
*/

export const VENTANAS = Object.freeze(["HOY", "7D", "15D", "30D", "90D"]);


/*
===========================================================
ESTADOS DE CAMBIO
===========================================================

Con dos observaciones solo se puede hablar de la primera
derivada. Los nombres lo dicen.
===========================================================
*/

export const CAMBIO = Object.freeze({
  RISING_OBSERVED: "RISING_OBSERVED",
  FALLING_OBSERVED: "FALLING_OBSERVED",
  STABLE_OBSERVED: "STABLE_OBSERVED",
  NEWLY_OBSERVED: "NEWLY_OBSERVED",
  NO_LONGER_OBSERVED: "NO_LONGER_OBSERVED",

  /* Un punto solo, o linaje incompatible. */
  INSUFFICIENT_TEMPORAL_EVIDENCE: "INSUFFICIENT_TEMPORAL_EVIDENCE",

  /* El tema se partio o se fundio: comparar seria mentir. */
  TEMPORAL_COMPARISON_NOT_VALID: "TEMPORAL_COMPARISON_NOT_VALID"
});


/*
  Un tema nuevo en la definicion NO es un asunto nuevo en el
  territorio. Puede ser nuevo porque cambio el corpus, porque
  se partio otro, o porque un motor nuevo lo hizo visible.
*/
export const ORIGEN_DE_NOVEDAD = Object.freeze({
  NEW_TOPIC_DEFINITION: "NEW_TOPIC_DEFINITION",
  NEWLY_OBSERVED_ACTIVITY: "NEWLY_OBSERVED_ACTIVITY",
  COVERAGE_EXPANSION: "COVERAGE_EXPANSION",
  LINEAGE_RESHAPE: "LINEAGE_RESHAPE"
});


export const CONFIANZA_COBERTURA = Object.freeze({ HIGH: "HIGH", MEDIUM: "MEDIUM", LOW: "LOW" });


/*
  Motores activados entre la primera y la segunda observacion.
  Si la evidencia nueva de un tema viene de aqui, su
  crecimiento es de cobertura y no de territorio.

  Se inyecta, no se hardcodea: `radar()` lo recibe.
*/
export const MOTORES_NUEVOS_POR_DEFECTO = Object.freeze([
  "google_news",
  "ddg_web",
  "scrapecreators_tiktok"
]);


/*
===========================================================
OBSERVACIONES DISTINTAS
===========================================================

El almacen puede tener varias escrituras del MISMO calculo:
en este proyecto la pasada del gate anterior se reejecuto tres
veces mientras se corregian defectos, y dejo tres registros
identicos.

Dos escrituras con el mismo corpus, el mismo numero de temas y
el mismo conjunto de topicId son la MISMA observacion, aunque
tengan `runId` distinto. Tratarlas como tres puntos temporales
inventaria historia.
===========================================================
*/

export function observacionesDistintas(registros = []) {
  const porInstante = new Map();

  registros.forEach((r) => {
    const clave = String(r.registradoEn);

    if (!porInstante.has(clave)) porInstante.set(clave, []);

    porInstante.get(clave).push(r);
  });

  const candidatas = [...porInstante.entries()]
    .map(([registradoEn, regs]) => {
      /*
        Un mismo instante puede tener varias escrituras de la
        misma definicion: append-only significa que corregir un
        campo anade una linea, no reemplaza la anterior. Se
        conserva la ULTIMA por topicId, que es la vigente.

        Sin esto, reescribir una observacion para anadir
        `evidenceIds` duplicaba cada tema y el radar contaba el
        doble.
      */
      const porTopicId = new Map();

      regs
        .filter((r) => r.tipo === "TOPIC_DEFINITION")
        .forEach((r) => porTopicId.set(r.topicId, r));

      const defs = [...porTopicId.values()];

      const snaps = regs.filter((r) => r.tipo === "TOPIC_SNAPSHOT");
      const snap = snaps[snaps.length - 1];

      const firma = crypto
        .createHash("sha1")
        .update(
          `${snap?.corpus?.admitido || 0}|${snap?.resumen?.topicCount || 0}|${defs
            .map((d) => d.topicId)
            .sort()
            .join(",")}`
        )
        .digest("hex")
        .slice(0, 12);

      return {
        observationId: registradoEn,
        runId: regs[0]?.runId || null,
        registradoEn,
        firma,
        universo: regs[0]?.universo || null,
        corpus: snap?.corpus?.admitido ?? null,
        topicCount: snap?.resumen?.topicCount ?? null,
        umbral: regs[0]?.umbral ?? null,
        definiciones: defs,
        asignaciones: regs.filter((r) => r.tipo === "TOPIC_ASSIGNMENT")
      };
    })
    .sort((a, b) => String(a.registradoEn).localeCompare(String(b.registradoEn)));

  /* Se conserva la PRIMERA de cada firma: es cuando ocurrio. */
  const vistas = new Set();

  const distintas = candidatas.filter((c) => {
    if (vistas.has(c.firma)) return false;

    vistas.add(c.firma);

    return true;
  });

  return {
    total: candidatas.length,
    distintas,
    colapsadas: candidatas.length - distintas.length,

    declaracion:
      candidatas.length > distintas.length
        ? `${candidatas.length - distintas.length} escritura(s) con contenido idéntico se colapsaron: son la misma observación, no puntos temporales distintos.`
        : "Todas las escrituras tienen contenido distinto."
  };
}


/*
===========================================================
ACTIVIDAD OBSERVABLE
===========================================================

Cuanto esta presente un tema DENTRO de la ventana. La ventana
es el eje: dos temas con diez piezas cada uno no son
comparables si uno tiene 7D=12 y el otro 7D=0.
===========================================================
*/

export function actividadDe(definicion = {}, ventana = "7D") {
  const w = definicion.windowCounts || {};

  const enVentana = w[ventana] ?? null;

  return {
    window: ventana,

    /* Piezas fechadas dentro de la ventana. */
    evidenceCount: enVentana,

    /* Total del tema, para contraste. NO es lo mismo. */
    evidenceCountTotal: definicion.evidenceCount ?? null,

    /*
      Proporcion del tema que cae en la ventana. Distingue un
      asunto que esta pasando de un archivo historico.
    */
    fraccionEnVentana:
      definicion.evidenceCount && enVentana != null
        ? Number((enVentana / definicion.evidenceCount).toFixed(3))
        : null,

    datedEvidenceCount: Object.values(w).length ? w["90D"] ?? null : null,

    windowCounts: w,

    /*
      `missing != zero`: si no hay windowCounts no se dice cero,
      se dice que no se puede calcular.
    */
    calculable: enVentana != null
  };
}


/*
===========================================================
DIVERSIDAD
===========================================================

Diez piezas de una fuente NO equivalen a diez de nueve. Y el
RSS no se penaliza por ser RSS: lo que se detecta es la
CONCENTRACION, venga de donde venga.
===========================================================
*/

export function diversidadDe(definicion = {}) {
  const n = definicion.evidenceCount || 0;

  const fuentes = definicion.uniqueSources ?? null;
  const actores = definicion.uniqueActors ?? null;
  const proveedores = (definicion.providers || []).length;
  const familias = (definicion.sourceFamilies || []).length;

  const plataformas = new Set(
    (definicion.providers || []).map(
      (p) =>
        ({
          x_api: "X",
          youtube_data: "YouTube",
          scrapecreators_tiktok: "TikTok",
          rss_directo: "Web/RSS",
          google_news: "Web/News",
          ddg_web: "Web",
          brave_web: "Web",
          serpapi_google: "Web",
          gdelt_doc: "Web/News"
        })[p] || p
    )
  );

  const concentracionDeFuente = fuentes && n ? Number((1 - (fuentes - 1) / Math.max(1, n - 1)).toFixed(3)) : null;

  return {
    uniqueSources: fuentes,
    uniqueActors: actores,
    providerCount: proveedores,
    platformCount: plataformas.size,
    platforms: [...plataformas],
    sourceFamilyCount: familias,
    sourceFamilies: definicion.sourceFamilies || [],

    /* Fuentes por pieza: 1,0 seria una fuente distinta por evidencia. */
    UNIQUE_SOURCE_DIVERSITY: definicion.sourceDiversity ?? (fuentes && n ? Number((fuentes / n).toFixed(3)) : null),

    PROVIDER_PLATFORM_DIVERSITY: plataformas.size,

    rssShare: definicion.rssShare ?? null,

    /*
      Concentraciones. Se declaran los tres casos por separado
      porque no son lo mismo: una fuente unica, un proveedor
      unico y una familia unica describen problemas distintos.
    */
    singleSourceConcentration: fuentes === 1 && n > 1,
    singleProviderConcentration: proveedores === 1 && n > 1,
    singleFamilyConcentration: familias === 1 && n > 1,

    concentracionDeFuente,

    /*
      Confianza de diversidad, separada de la ACTIVIDAD. Un tema
      puede estar muy activo y ser poco fiable.
    */
    DIVERSITY_CONFIDENCE:
      fuentes == null
        ? CONFIANZA_COBERTURA.LOW
        : fuentes >= 5 && plataformas.size >= 2
          ? CONFIANZA_COBERTURA.HIGH
          : fuentes >= 3 || plataformas.size >= 2
            ? CONFIANZA_COBERTURA.MEDIUM
            : CONFIANZA_COBERTURA.LOW
  };
}


/*
===========================================================
CONVERSACION PUBLICA, SEPARADA
===========================================================

Un tema puede crecer por mas medios sin crecer nada en
conversacion publica. Se muestran los dos.
===========================================================
*/

export function conversacionDe(definicion = {}) {
  const b = definicion.contentNatureBreakdown || {};

  const total = Object.values(b).reduce((a, x) => a + x, 0);

  return {
    publicConversationCount: b.PUBLIC_CONVERSATION ?? 0,
    mediaCount: b.MEDIA ?? 0,
    institutionalCount: b.INSTITUTIONAL ?? 0,
    academicCount: b.ACADEMIC ?? 0,
    searchResultCount: b.SEARCH_RESULT ?? 0,
    otherCount: b.OTHER ?? 0,

    total,

    conversationShare: total ? Number(((b.PUBLIC_CONVERSATION ?? 0) / total).toFixed(3)) : null,

    /*
      Etiqueta honesta del perfil del tema. «institucional» no
      es un defecto: es un hecho que el lector debe saber.
    */
    perfil:
      total === 0
        ? "SIN_DATO"
        : (b.INSTITUTIONAL ?? 0) / total >= 0.7
          ? "INSTITUTIONAL_HEAVY"
          : (b.PUBLIC_CONVERSATION ?? 0) / total >= 0.5
            ? "CONVERSATION_LED"
            : (b.MEDIA ?? 0) / total >= 0.5
              ? "MEDIA_LED"
              : "MIXED"
  };
}


/*
===========================================================
TERRITORIALIDAD
===========================================================

`SOURCE_LOCALITY != CONTENT_TERRITORIALITY`. No se da mas
«tendencia Cuenca» a un tema porque su fuente sea local: se usa
la clasificacion territorial del CONTENIDO.
===========================================================
*/

export function territorialidadDe(definicion = {}) {
  const b = definicion.territorialStratumBreakdown || {};

  const total = Object.values(b).reduce((a, x) => a + x, 0);

  return {
    corroborated: b.TERRITORIO_CORROBORADO ?? 0,
    probable: b.TERRITORIO_PROBABLE ?? 0,
    total,
    corroboratedShare: total ? Number(((b.TERRITORIO_CORROBORADO ?? 0) / total).toFixed(3)) : null,
    nota: "Clasificación del CONTENIDO. La localidad de la fuente no la determina."
  };
}


/*
===========================================================
LINAJE
===========================================================

`topicId` se deriva de los terminos canonicos del tema. Si el
tema absorbe evidencia y su firma cambia, emite otro id. Eso NO
significa que el asunto sea nuevo.

Para poder comparar dos observaciones hay que emparejar por
CONTENIDO cuando el id no coincide. Si el emparejamiento es
ambiguo —dos candidatos igual de buenos— se declara
`TEMPORAL_COMPARISON_NOT_VALID` en lugar de elegir.
===========================================================
*/

export function emparejarPorLinaje(defsAntes = [], defsAhora = []) {
  const idsAntes = new Map(defsAntes.map((d) => [d.topicId, d]));
  const idsAhora = new Map(defsAhora.map((d) => [d.topicId, d]));

  const firmaDe = (d) =>
    new Set([
      ...(d.entities || []).map((e) => `ent:${e}`),
      ...(d.keywords || []).slice(0, 8)
    ]);

  const jaccard = (a, b) => {
    if (!a.size || !b.size) return 0;

    let i = 0;

    a.forEach((x) => { if (b.has(x)) i += 1; });

    return i / (a.size + b.size - i);
  };

  const parejas = [];

  const usadosAhora = new Set();

  defsAntes.forEach((antes) => {
    /* 1. Mismo topicId: emparejamiento exacto. */
    if (idsAhora.has(antes.topicId)) {
      parejas.push({ antes, ahora: idsAhora.get(antes.topicId), via: "TOPIC_ID", similitud: 1, valido: true });
      usadosAhora.add(antes.topicId);
      return;
    }

    /* 2. Por contenido. */
    const fa = firmaDe(antes);

    const puntuadas = defsAhora
      .filter((d) => !usadosAhora.has(d.topicId))
      .map((d) => ({ d, s: jaccard(fa, firmaDe(d)) }))
      .sort((a, b) => b.s - a.s);

    const mejor = puntuadas[0];
    const segundo = puntuadas[1];

    if (!mejor || mejor.s < 0.3) {
      parejas.push({ antes, ahora: null, via: "SIN_PAREJA", similitud: mejor?.s ?? 0, valido: true });
      return;
    }

    /*
      Ambiguo: el segundo candidato esta casi igual de cerca.
      Casi siempre significa que el tema se partio, y comparar
      contra uno de los trozos daria un cambio inventado.
    */
    if (segundo && mejor.s - segundo.s < 0.1) {
      parejas.push({
        antes,
        ahora: null,
        via: "AMBIGUO",
        similitud: mejor.s,
        valido: false,
        motivo: `Dos candidatos casi equivalentes (${mejor.s.toFixed(2)} y ${segundo.s.toFixed(2)}): probable split. Comparar sería inventar el cambio.`
      });
      return;
    }

    parejas.push({ antes, ahora: mejor.d, via: "LINAJE_POR_CONTENIDO", similitud: Number(mejor.s.toFixed(3)), valido: true });
    usadosAhora.add(mejor.d.topicId);
  });

  const nuevos = defsAhora.filter((d) => !usadosAhora.has(d.topicId) && !idsAntes.has(d.topicId));

  return {
    parejas,
    nuevos,
    porVia: parejas.reduce((a, p) => { a[p.via] = (a[p.via] || 0) + 1; return a; }, {}),
    invalidos: parejas.filter((p) => !p.valido).length
  };
}


/*
===========================================================
CAMBIO OBSERVADO
===========================================================
*/

export function cambioDe({ antes = null, ahora = null, ventana = "7D", valido = true, motivo = null, motoresNuevos = MOTORES_NUEVOS_POR_DEFECTO } = {}) {
  const vAntes = antes ? antes.windowCounts?.[ventana] ?? null : null;
  const vAhora = ahora ? ahora.windowCounts?.[ventana] ?? null : null;

  const base = {
    window: ventana,
    previousWindowValue: vAntes,
    currentWindowValue: vAhora,
    absoluteDelta: null,
    relativeDelta: null,
    sourceDelta: null,
    providerDelta: null,
    conversationDelta: null,
    estado: CAMBIO.INSUFFICIENT_TEMPORAL_EVIDENCE,
    coverageExpansionContributed: false,
    motoresQueContribuyeron: [],
    limitacion:
      "Variación basada en dos observaciones. Requiere más puntos para confirmar una tendencia."
  };

  if (!valido) {
    return { ...base, estado: CAMBIO.TEMPORAL_COMPARISON_NOT_VALID, motivo };
  }

  if (!antes && ahora) {
    /*
      Tema presente ahora y no antes. Se distingue POR QUE es
      nuevo: puede ser un asunto nuevo o puede ser que ahora
      mirамos donde antes no mirabamos.
    */
    const deMotorNuevo = (ahora.providers || []).filter((p) => motoresNuevos.includes(p));

    return {
      ...base,
      estado: CAMBIO.NEWLY_OBSERVED,
      currentWindowValue: vAhora,
      origenDeNovedad: deMotorNuevo.length
        ? ORIGEN_DE_NOVEDAD.COVERAGE_EXPANSION
        : ORIGEN_DE_NOVEDAD.NEW_TOPIC_DEFINITION,
      coverageExpansionContributed: deMotorNuevo.length > 0,
      motoresQueContribuyeron: deMotorNuevo,
      nota: deMotorNuevo.length
        ? `Aparece con evidencia de ${deMotorNuevo.join(", ")}, motores activados entre las dos observaciones: es expansión de cobertura, no necesariamente actividad nueva en el territorio.`
        : "Definición de tema nueva. NO implica que el asunto sea nuevo en el territorio."
    };
  }

  if (antes && !ahora) {
    return { ...base, estado: CAMBIO.NO_LONGER_OBSERVED, previousWindowValue: vAntes };
  }

  if (vAntes == null || vAhora == null) return base;

  const delta = vAhora - vAntes;

  /* Base cero: no se emite porcentaje, se declara. */
  const relativo = vAntes === 0 ? null : Number((delta / vAntes).toFixed(3));

  const deMotorNuevo = (ahora.providers || []).filter(
    (p) => motoresNuevos.includes(p) && !(antes.providers || []).includes(p)
  );

  const estado =
    delta > 0 ? CAMBIO.RISING_OBSERVED : delta < 0 ? CAMBIO.FALLING_OBSERVED : CAMBIO.STABLE_OBSERVED;

  return {
    ...base,
    absoluteDelta: delta,
    relativeDelta: relativo,
    relativeDeltaNoCalculable: vAntes === 0 ? "base cero: el porcentaje no se emite" : null,
    sourceDelta: (ahora.uniqueSources ?? 0) - (antes.uniqueSources ?? 0),
    providerDelta: (ahora.providers || []).length - (antes.providers || []).length,
    conversationDelta:
      (ahora.contentNatureBreakdown?.PUBLIC_CONVERSATION ?? 0) -
      (antes.contentNatureBreakdown?.PUBLIC_CONVERSATION ?? 0),
    estado,
    coverageExpansionContributed: deMotorNuevo.length > 0,
    motoresQueContribuyeron: deMotorNuevo,
    nota: deMotorNuevo.length
      ? `Parte del crecimiento viene de ${deMotorNuevo.join(", ")}, activados entre observaciones: COLLECTION_COVERAGE_CHANGE, no solo OBSERVED_CONTENT_CHANGE.`
      : null
  };
}


/*
===========================================================
CONFIANZA DE COBERTURA
===========================================================

No es una probabilidad. Es una lectura de cuanto sostiene la
evidencia disponible.
===========================================================
*/

export function confianzaDe({ diversidad, actividad, territorialidad }) {
  const puntos = [];

  if ((diversidad.uniqueSources ?? 0) >= 5) puntos.push("5+ fuentes distintas");
  if ((diversidad.platformCount ?? 0) >= 2) puntos.push("2+ plataformas");
  if ((territorialidad.corroboratedShare ?? 0) >= 0.7) puntos.push("70%+ territorialmente corroborado");
  if (actividad.calculable && (actividad.evidenceCount ?? 0) > 0) puntos.push("evidencia fechada en la ventana");

  const restas = [];

  if (diversidad.singleSourceConcentration) restas.push("una sola fuente");
  if (diversidad.singleProviderConcentration) restas.push("un solo proveedor");
  if ((diversidad.rssShare ?? 0) === 1) restas.push("100% RSS");
  if (!actividad.calculable) restas.push("sin ventanas calculables");

  const nivel =
    puntos.length >= 3 && restas.length === 0
      ? CONFIANZA_COBERTURA.HIGH
      : puntos.length >= 2 && restas.length <= 1
        ? CONFIANZA_COBERTURA.MEDIUM
        : CONFIANZA_COBERTURA.LOW;

  return {
    coverageConfidence: nivel,
    aFavor: puntos,
    enContra: restas,
    nota: "No es una probabilidad estadística: es una lectura de cuánto sostiene la evidencia disponible."
  };
}


/*
===========================================================
POR QUE — EXPLICACION DETERMINISTA
===========================================================

Se construye con los numeros del propio item. Sin LLM. Si el
texto no coincide con la evidencia, es un fallo de este
modulo, no una alucinacion.
===========================================================
*/

export function porQue({ definicion, actividad, cambio, diversidad, conversacion, territorialidad }) {
  const razones = [];

  if (actividad.calculable) {
    razones.push(
      `${actividad.evidenceCount} de sus ${actividad.evidenceCountTotal} evidencias caen en la ventana ${actividad.window}.`
    );
  } else {
    razones.push(`Sin ventanas calculables: no hay evidencia fechada que situar en ${actividad.window}.`);
  }

  if (cambio.estado === CAMBIO.RISING_OBSERVED) {
    razones.push(
      `Sube porque pasó de ${cambio.previousWindowValue} a ${cambio.currentWindowValue} evidencias fechadas${
        cambio.sourceDelta ? ` y de ${(cambio.currentWindowValue, diversidad.uniqueSources - cambio.sourceDelta)} a ${diversidad.uniqueSources} fuentes` : ""
      }.`
    );
  } else if (cambio.estado === CAMBIO.FALLING_OBSERVED) {
    razones.push(`Baja porque pasó de ${cambio.previousWindowValue} a ${cambio.currentWindowValue} evidencias fechadas.`);
  } else if (cambio.estado === CAMBIO.STABLE_OBSERVED) {
    razones.push(`Se mantiene en ${cambio.currentWindowValue} evidencias fechadas entre las dos observaciones.`);
  } else if (cambio.estado === CAMBIO.NEWLY_OBSERVED) {
    razones.push(
      cambio.origenDeNovedad === ORIGEN_DE_NOVEDAD.COVERAGE_EXPANSION
        ? `Aparece por primera vez, y con evidencia de ${cambio.motoresQueContribuyeron.join(", ")}: es cobertura nueva, no necesariamente actividad nueva.`
        : "Aparece por primera vez como definición de tema. No implica que el asunto sea nuevo en el territorio."
    );
  } else if (cambio.estado === CAMBIO.NO_LONGER_OBSERVED) {
    razones.push("Ya no se observa como tema propio: pudo absorberse en otro o quedar sin evidencia agrupable.");
  } else if (cambio.estado === CAMBIO.TEMPORAL_COMPARISON_NOT_VALID) {
    razones.push(`No se compara: ${cambio.motivo}`);
  }

  if (diversidad.platformCount >= 2) {
    razones.push(`Aparece en ${diversidad.platformCount} plataformas: ${diversidad.platforms.join(", ")}.`);
  } else if (diversidad.platforms.length) {
    razones.push(`Solo en ${diversidad.platforms[0]}.`);
  }

  if (diversidad.singleSourceConcentration) {
    razones.push(
      `Toda su evidencia viene de UNA fuente: ${definicion.evidenceCount} piezas de 1 origen. Actividad alta no equivale a diversidad.`
    );
  }

  if (conversacion.perfil === "INSTITUTIONAL_HEAVY") {
    razones.push(`Perfil institucional: ${conversacion.institutionalCount} de ${conversacion.total} piezas. No es conversación ciudadana.`);
  } else if (conversacion.perfil === "CONVERSATION_LED") {
    razones.push(`Liderado por conversación pública: ${conversacion.publicConversationCount} de ${conversacion.total}.`);
  }

  if (cambio.conversationDelta > 0) {
    razones.push(`La conversación pública creció en ${cambio.conversationDelta} pieza(s).`);
  } else if (cambio.conversationDelta === 0 && cambio.absoluteDelta > 0) {
    razones.push("Creció sin que creciera la conversación pública: el aumento viene de medios o instituciones.");
  }

  if (territorialidad.corroboratedShare != null) {
    razones.push(`${Math.round(territorialidad.corroboratedShare * 100)}% de su evidencia está territorialmente corroborada por el contenido.`);
  }

  return razones;
}


/*
===========================================================
ITEM DEL RADAR
===========================================================
*/

export function itemDeRadar({
  definicion,
  pareja = null,
  ventana = "7D",
  observationIdAntes = null,
  observationIdAhora = null,
  projectId = null,
  tenantId = null,
  motoresNuevos = MOTORES_NUEVOS_POR_DEFECTO
} = {}) {
  const actividad = actividadDe(definicion, ventana);
  const diversidad = diversidadDe(definicion);
  const conversacion = conversacionDe(definicion);
  const territorialidad = territorialidadDe(definicion);

  const cambio = cambioDe({
    antes: pareja?.antes || null,
    ahora: definicion,
    ventana,
    valido: pareja ? pareja.valido !== false : true,
    motivo: pareja?.motivo || null,
    motoresNuevos
  });

  const confianza = confianzaDe({ diversidad, actividad, territorialidad });

  return {
    topicId: definicion.topicId,
    label: definicion.topicLabel,
    window: ventana,

    activity: actividad,
    change: cambio,
    diversity: diversidad,
    conversation: conversacion,
    territoriality: territorialidad,
    coverage: confianza,

    lineage: {
      via: pareja?.via || "SIN_OBSERVACION_ANTERIOR",
      similitud: pareja?.similitud ?? null,
      previousTopicId: pareja?.antes?.topicId || null,
      comparacionValida: pareja ? pareja.valido !== false : false
    },

    why: porQue({ definicion, actividad, cambio, diversidad, conversacion, territorialidad }),

    /* Referencias, nunca cuerpos. */
    evidenceRefs: (definicion.evidenceIds || []).slice(0, 25),
    evidenceRefsTotal: (definicion.evidenceIds || []).length,
    sourceRefs: definicion.sourceFamilies || [],
    providerRefs: definicion.providers || [],

    previousObservationId: observationIdAntes,
    currentObservationId: observationIdAhora,

    projectId,
    tenantId,
    methodVersion: VERSION_RADAR,

    limitations: [
      "Basado en fuentes públicas observables cubiertas por Sentinel.",
      "No representa a toda la población de Cuenca.",
      "Con dos observaciones, el cambio es preliminar y no constituye una tendencia estable.",
      ...(definicion.limitations || []),
      ...(cambio.coverageExpansionContributed
        ? ["Parte de la variación proviene de motores de recolección activados entre observaciones."]
        : [])
    ]
  };
}


/*
===========================================================
RADAR COMPLETO
===========================================================

Rankings SEPARADOS. No hay un unico numero opaco.
===========================================================
*/

export function radar({
  registros = [],
  ventana = "7D",
  projectId = null,
  tenantId = null,
  universo = "PRIMARY_TOPIC_CORPUS",
  motoresNuevos = MOTORES_NUEVOS_POR_DEFECTO
} = {}) {
  const propios = registros.filter((r) => (!projectId || r.projectId === projectId) && r.universo === universo);

  const obs = observacionesDistintas(propios);

  const puntos = obs.distintas;

  if (puntos.length === 0) {
    return {
      window: ventana,
      observaciones: 0,
      items: [],
      estado: CAMBIO.INSUFFICIENT_TEMPORAL_EVIDENCE,
      declaraciones: ["No hay observaciones para este proyecto y universo."]
    };
  }

  const ahora = puntos[puntos.length - 1];
  const antes = puntos.length >= 2 ? puntos[puntos.length - 2] : null;

  const linaje = antes
    ? emparejarPorLinaje(antes.definiciones, ahora.definiciones)
    : { parejas: [], nuevos: ahora.definiciones, porVia: {}, invalidos: 0 };

  const parejaPorId = new Map();

  linaje.parejas.forEach((p) => {
    if (p.ahora) parejaPorId.set(p.ahora.topicId, p);
  });

  const items = ahora.definiciones.map((d) =>
    itemDeRadar({
      definicion: d,
      pareja: parejaPorId.get(d.topicId) || null,
      ventana,
      observationIdAntes: antes?.observationId || null,
      observationIdAhora: ahora.observationId,
      projectId,
      tenantId,
      motoresNuevos
    })
  );

  const conActividad = items.filter((i) => i.activity.calculable);

  const ordenar = (arr, f) => [...arr].sort((a, b) => f(b) - f(a) || a.topicId.localeCompare(b.topicId));

  return {
    window: ventana,
    universo,
    projectId,
    methodVersion: VERSION_RADAR,

    observaciones: puntos.length,
    observacionesColapsadas: obs.colapsadas,
    previousObservationId: antes?.observationId || null,
    currentObservationId: ahora.observationId,

    corpus: { antes: antes?.corpus ?? null, ahora: ahora.corpus },
    temas: { antes: antes?.topicCount ?? null, ahora: ahora.topicCount },

    lineage: { porVia: linaje.porVia, comparacionesInvalidas: linaje.invalidos, nuevos: linaje.nuevos.length },

    items,

    /* RANKINGS SEPARADOS: nunca uno solo y opaco. */
    rankings: {
      TOP_OBSERVED_ACTIVITY: ordenar(conActividad, (i) => i.activity.evidenceCount).slice(0, 10),
      TOP_OBSERVED_GROWTH: ordenar(
        items.filter((i) => i.change.estado === CAMBIO.RISING_OBSERVED),
        (i) => i.change.absoluteDelta
      ).slice(0, 10),
      TOP_OBSERVED_DECLINE: [...items.filter((i) => i.change.estado === CAMBIO.FALLING_OBSERVED)]
        .sort((a, b) => a.change.absoluteDelta - b.change.absoluteDelta)
        .slice(0, 10),
      NEWLY_OBSERVED: items.filter((i) => i.change.estado === CAMBIO.NEWLY_OBSERVED).slice(0, 15),
      HIGHEST_SOURCE_DIVERSITY: ordenar(items, (i) => i.diversity.uniqueSources || 0).slice(0, 10),
      LOWEST_SOURCE_DIVERSITY: [...items]
        .filter((i) => (i.diversity.uniqueSources ?? 0) > 0)
        .sort((a, b) => (a.diversity.UNIQUE_SOURCE_DIVERSITY || 0) - (b.diversity.UNIQUE_SOURCE_DIVERSITY || 0))
        .slice(0, 10),
      COVERAGE_EXPANDED: items.filter((i) => i.change.coverageExpansionContributed)
    },

    declaraciones: [
      obs.declaracion,
      puntos.length < 2
        ? "Una sola observación: no hay cambio que calcular, solo actividad."
        : "Dos observaciones: se puede calcular una primera derivada, NO una tendencia estable.",
      "Los rankings van separados a propósito: actividad, cambio y diversidad responden preguntas distintas y un número único las escondería.",
      "OBSERVED_CONTENT_CHANGE y COLLECTION_COVERAGE_CHANGE se distinguen: los temas marcados COVERAGE_EXPANDED crecieron en parte porque se activaron motores nuevos.",
      "Nada aquí afirma viralidad, opinión pública, intención de voto ni representatividad.",
      "Ordenar por actividad no es un Trend Score: es una lista de inspección."
    ]
  };
}


/*
===========================================================
SENSIBILIDAD DE UN INDICE COMPUESTO
===========================================================

Existe para poder DECIDIR si un numero unico vale la pena. Si
el top cambia segun los pesos, el numero decora en lugar de
informar, y el modulo expone las dimensiones separadas.
===========================================================
*/

export const ESCENARIOS_DE_PESO = Object.freeze([
  { id: "solo_actividad", actividad: 1, fuentes: 0, plataformas: 0 },
  { id: "actividad_dominante", actividad: 0.6, fuentes: 0.25, plataformas: 0.15 },
  { id: "equilibrado", actividad: 0.34, fuentes: 0.33, plataformas: 0.33 },
  { id: "diversidad_dominante", actividad: 0.2, fuentes: 0.5, plataformas: 0.3 },
  { id: "solo_diversidad", actividad: 0, fuentes: 0.6, plataformas: 0.4 }
]);


export function probarSensibilidad(items = [], escenarios = ESCENARIOS_DE_PESO) {
  const max = (f) => Math.max(1, ...items.map(f));

  const mA = max((i) => i.activity.evidenceCount || 0);
  const mF = max((i) => i.diversity.uniqueSources || 0);
  const mP = max((i) => i.diversity.platformCount || 0);

  const tops = escenarios.map((e) => {
    const puntuados = items.map((i) => ({
      topicId: i.topicId,
      label: i.label,
      score: Number(
        (
          e.actividad * ((i.activity.evidenceCount || 0) / mA) +
          e.fuentes * ((i.diversity.uniqueSources || 0) / mF) +
          e.plataformas * ((i.diversity.platformCount || 0) / mP)
        ).toFixed(4)
      )
    }));

    return {
      escenario: e.id,
      pesos: e,
      top5: puntuados.sort((a, b) => b.score - a.score || a.topicId.localeCompare(b.topicId)).slice(0, 5)
    };
  });

  /* ¿Cuanto se mueve el top 5 entre escenarios? */
  const conjuntos = tops.map((t) => new Set(t.top5.map((x) => x.topicId)));

  const interseccion = [...conjuntos[0]].filter((id) => conjuntos.every((c) => c.has(id)));

  const primeros = new Set(tops.map((t) => t.top5[0]?.topicId));

  const estabilidad = Number((interseccion.length / 5).toFixed(2));

  return {
    escenarios: tops,
    top5EstableEn: interseccion.length,
    estabilidadDelTop5: estabilidad,
    primerosDistintos: primeros.size,

    veredicto:
      estabilidad >= 0.8 && primeros.size === 1
        ? "ROBUST"
        : estabilidad >= 0.6
          ? "MODERATE"
          : "FRAGILE",

    recomendacion:
      estabilidad >= 0.8 && primeros.size === 1
        ? "Un índice compuesto sería defendible."
        : "El orden depende de los pesos elegidos: NO se publica índice compuesto. Se exponen las dimensiones separadas."
  };
}


export default {
  VERSION_RADAR,
  VENTANAS,
  CAMBIO,
  ORIGEN_DE_NOVEDAD,
  CONFIANZA_COBERTURA,
  MOTORES_NUEVOS_POR_DEFECTO,
  ESCENARIOS_DE_PESO,
  observacionesDistintas,
  actividadDe,
  diversidadDe,
  conversacionDe,
  territorialidadDe,
  emparejarPorLinaje,
  cambioDe,
  confianzaDe,
  porQue,
  itemDeRadar,
  radar,
  probarSensibilidad
};
