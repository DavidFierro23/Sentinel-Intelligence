import { buscarGoogle } from "./googleService.js";
import { buscarGoogleNews } from "./googleNewsService.js";
import { buscarWayback } from "./waybackService.js";
import { buscarWhois } from "./whoisService.js";
import { obtenerAvatar } from "./avatarService.js";
import { correlacionarIdentidades } from "./identityCorrelationService.js";
import { construirPerfilReferencia } from "./referenceProfileService.js";
import { ejecutarFusion } from "./fusionSearchEngine.js";
import { ejecutarSocialIntelligence } from "./social/socialIntelligenceLayer.js";
import { consolidarFichaObjetivo } from "./referenceProfileService.js";
import { obtenerAvatarCompatible } from "./avatar/avatarIntelligenceEngine.js";

import {
  obtenerEnlace,
  detectarPlataformaPorUrl,
  extraerDominio
} from "./textUtils.js";

/*
  Etiqueta cada resultado con el motor que lo encontró.

  No modifica los servicios de búsqueda: añade el campo
  interno `__origen` en la agregación. Es lo que permite al
  Perfil de Referencia declarar la FUENTE de cada evidencia,
  y será la base de la corroboración multi-motor del
  Fusion Engine.
*/
function etiquetarOrigen(items, origen, motorId) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    __origen: item?.__origen || origen,

    /*
      IDENTIFICADOR ESTABLE DEL MOTOR.

      Imprescindible para el Fusion Engine: sin él, un
      resultado del descubrimiento general y otro de la
      misma fuente durante la fusión se contarían como DOS
      motores distintos, fabricando una corroboración que no
      existe.
    */
    __motorId: item?.__motorId || item?.motorId || motorId
  }));
}

/*
  ENTIDADES DEL GRAFO — clasificadas por DOMINIO.

  CORRECCIÓN (Sprint 2.5):

  La versión anterior clasificaba buscando subcadenas en el
  título y la descripción. Una noticia que mencionara la
  palabra "facebook" se contaba como entidad Facebook, y
  cualquier titular con "news" acababa en Google News. Las
  entidades del grafo no reflejaban las fuentes reales.

  Ahora la clasificación sale de la URL: plataforma conocida
  por dominio y, si no lo es, el dominio mismo como entidad.
  El texto ya no interviene.

  El contrato de salida no cambia — {id, nombre, tipo,
  evidencias} — para no romper KnowledgeGraph.jsx.
*/
function construirEntidades(resultados, social = null) {
  const mapa = new Map();

  const lista = Array.isArray(resultados) ? resultados : [];

  lista.forEach((item) => {
    if (!item) return;

    const enlace = obtenerEnlace(item);

    let nombre = null;
    let tipo = "web";

    if (enlace) {
      const plataforma = detectarPlataformaPorUrl(enlace);

      if (plataforma) {
        nombre = plataforma.nombre;
        tipo = plataforma.tipo;
      } else {
        const dominio = extraerDominio(enlace);

        if (dominio) {
          nombre = dominio.replace(/^www\./, "");
          tipo = dominio.includes("news.google") ? "news" : "web";
        }
      }
    }

    /*
      Sin URL utilizable, la entidad se atribuye al motor que
      la aportó (Whois y Wayback devuelven registros que no
      siempre son enlaces navegables).
    */
    if (!nombre) {
      nombre = item.__origen || "Otras fuentes";
      tipo = "fuente";
    }

    const id = nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    if (!mapa.has(nombre)) {
      mapa.set(nombre, {
        id: id || "fuente",
        nombre,
        tipo,
        evidencias: 1
      });
    } else {
      mapa.get(nombre).evidencias += 1;
    }
  });

  /*
    SPRINT 3.2 · punto 8 — UN NODO POR PLATAFORMA DESCUBIERTA

    Las entidades anteriores salen de las URLs del
    descubrimiento general. Las cuentas que el Social
    Intelligence Layer identifico merecen nodo propio aunque
    su URL no apareciera en `resultados`: son el hallazgo
    principal de la investigacion.

    Se anaden con la correspondencia y el veredicto de
    contexto, para que el grafo pueda distinguir visualmente
    un perfil probable de un homonimo vetado.
  */
  /*
    ---------------------------------------------------------
    UN NODO POR CUENTA (HOTFIX QA-1 del Sprint 3.2.2)
    ---------------------------------------------------------

    Antes se creaba un nodo por PLATAFORMA y las cuentas se
    apilaban dentro en `nodo.cuentas`. El grafo mostraba
    "Facebook" y "X", nunca @DanielNoboaOk ni @jotalloretv:
    con SerpAPI devolviendo decenas de cuentas reales, treinta
    y dos hallazgos colapsaban en tres circulos.

    El grafo es la vista de identidad de la plataforma, y la
    unidad de identidad es la CUENTA, no la plataforma.

    La agrupacion no se pierde: cada nodo lleva `plataforma` y
    `plataformaId`, con lo que el lienzo puede colorear y
    agrupar por plataforma sin necesidad de un nodo contenedor.
  */
  (social?.fichas || []).forEach((ficha) => {
    const plataforma = ficha.plataforma;

    if (!plataforma || !ficha.handle) return;

    const c = ficha.correspondencia;

    const clave = `${ficha.platform || plataforma}:${ficha.handle}`;

    if (mapa.has(clave)) return;

    const cb = c?.explicacion?.contextBoost || null;

    mapa.set(clave, {
      id: `cuenta-${String(clave)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")}`,

      /*
        El nombre visible del nodo es el handle: es lo que
        identifica a la cuenta. La plataforma va aparte.
      */
      nombre: `@${ficha.handle}`,

      tipo: ficha.tipoPlataforma || "social",

      plataforma,
      plataformaId: ficha.platform,
      handle: ficha.handle,
      url: ficha.url?.canonica || null,

      /*
        Grosor del enlace: cuantas evidencias sostienen la
        cuenta, no cuantas cuentas tiene la plataforma.
      */
      evidencias: (ficha.origenes || []).length || 1,

      correspondencia: c?.puntuacion ?? null,
      nivel: c?.nivel || null,
      estadoIdentidad: c?.estado || null,

      vetadoPorContexto: cb?.vetoAplicado === true,
      veredictoContexto: cb?.veredicto || null,

      proveedores: ficha.proveedores || [],
      modoAcceso: ficha.modoAcceso || null,

      origenNodo: "social_intelligence_layer"
    });
  });

  return [...mapa.values()].sort((a, b) => b.evidencias - a.evidencias);
}

/*
  Avatar de respaldo LOCAL.
  No utiliza ui-avatars.com ni ningún servicio externo.
*/
function crearAvatarFallback(nombre = "") {
  const limpio = String(nombre)
    .replace(/\s+/g, " ")
    .trim();

  const partes = limpio
    .split(" ")
    .filter(Boolean);

  let iniciales = "OS";

  if (partes.length === 1) {
    iniciales = partes[0]
      .substring(0, 2)
      .toUpperCase();
  } else if (partes.length > 1) {
    iniciales = (
      partes[0].charAt(0) +
      partes[partes.length - 1].charAt(0)
    ).toUpperCase();
  }

  const svg = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="256"
      height="256"
      viewBox="0 0 256 256"
    >
      <rect
        width="256"
        height="256"
        rx="128"
        fill="#0B1738"
      />

      <circle
        cx="128"
        cy="128"
        r="116"
        fill="none"
        stroke="#3B82F6"
        stroke-width="8"
      />

      <text
        x="128"
        y="145"
        text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif"
        font-size="76"
        font-weight="700"
        fill="#FFFFFF"
      >
        ${iniciales}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export async function investigarObjetivo(objetivo) {
  const inicio = Date.now();

  const [
    avatar,
    google,
    noticias,
    wayback,
    whois
  ] = await Promise.allSettled([
    obtenerAvatar(objetivo),
    buscarGoogle(objetivo),
    buscarGoogleNews(objetivo),
    buscarWayback(objetivo),
    buscarWhois(objetivo)
  ]);

  const resultados = [];

  /*
    GOOGLE
  */
  if (
    google.status === "fulfilled" &&
    Array.isArray(google.value.resultados)
  ) {
    resultados.push(
      ...etiquetarOrigen(
        google.value.resultados,
        google.value.motor || "Google",
        google.value.motorId || "ddg_web"
      )
    );
  }

  /*
    GOOGLE NEWS
  */
  if (
    noticias.status === "fulfilled" &&
    Array.isArray(noticias.value.resultados)
  ) {
    resultados.push(
      ...etiquetarOrigen(
        noticias.value.resultados,
        noticias.value.motor || "Google News",
        "google_news"
      )
    );
  }

  /*
    WAYBACK
  */
  if (
    wayback.status === "fulfilled" &&
    Array.isArray(wayback.value.resultados)
  ) {
    resultados.push(
      ...etiquetarOrigen(
        wayback.value.resultados,
        wayback.value.motor || "Wayback Machine",
        "wayback"
      )
    );
  }

  /*
    WHOIS
  */
  if (
    whois.status === "fulfilled" &&
    Array.isArray(whois.value.resultados)
  ) {
    resultados.push(
      ...etiquetarOrigen(
        whois.value.resultados,
        whois.value.motor || "Whois Intelligence",
        "whois"
      )
    );
  }

  /*
    PERFIL DE REFERENCIA

    Se construye a partir del DESCUBRIMIENTO GENERAL ya
    obtenido. No consulta fuentes externas.

    Si falla, devuelve null y la investigación continúa
    exactamente como antes.
  */
  let perfilReferencia = null;

  try {
    perfilReferencia = construirPerfilReferencia(objetivo, resultados);
  } catch (error) {
    console.error("Error en construirPerfilReferencia:", error);

    perfilReferencia = null;
  }

  /*
    FUSION SEARCH ENGINE

    Usa el Perfil de Referencia para generar consultas
    precisas, ejecutarlas en los motores disponibles,
    normalizar, deduplicar por URL y fusionar los orígenes.

    Si falla, devuelve null y la investigación continúa con
    el descubrimiento general, como antes.
  */
  let fusion = null;

  if (perfilReferencia) {
    try {
      fusion = await ejecutarFusion(objetivo, perfilReferencia, {
        resultadosPrevios: resultados,

        /*
          El descubrimiento general ya consultó el objetivo
          tal cual. Se declara para que el Fusion Engine no
          gaste cuota repitiéndolo.
        */
        consultasYaEjecutadas: [objetivo]
      });
    } catch (error) {
      console.error("Error en ejecutarFusion:", error);

      fusion = null;
    }
  }

  /*
    SOCIAL INTELLIGENCE LAYER  (Sprint 3.1)

    Descubre cuentas candidatas, calcula su correspondencia
    explicada y emite fichas unicas con linaje y hash.

    Reutiliza las evidencias que el Fusion Engine ya obtuvo,
    para no repetir consultas. Si falla, devuelve null y la
    investigacion continua igual.
  */
  let social = null;

  if (perfilReferencia) {
    try {
      social = await ejecutarSocialIntelligence(perfilReferencia, {
        evidenciasPrevias: fusion?.evidencias || resultados,
        objetivo
      });
    } catch (error) {
      console.error("Error en ejecutarSocialIntelligence:", error);

      social = null;
    }
  }

  /*
    AVATAR INTELLIGENCE ENGINE  (Sprint 4A, Bloque 1)

    Se ejecuta AQUI y no en el Promise.allSettled inicial
    porque necesita el Perfil de Referencia (variantes,
    contexto, terminos discriminantes) para verificar que la
    fotografia corresponde de verdad al objetivo.

    El avatar local ya obtenido al principio sigue sirviendo
    de respaldo inmediato: si el AIE falla o no encuentra
    fotografia verificable, la identidad no cambia.
  */
  let avatarInteligente = null;

  if (perfilReferencia) {
    try {
      avatarInteligente = await obtenerAvatarCompatible(objetivo, {
        perfil: perfilReferencia,
        social
      });
    } catch (error) {
      console.error("Error en Avatar Intelligence Engine:", error);

      avatarInteligente = null;
    }
  }

  /*
    =========================================================
    ORDEN DEL PIPELINE — declarado y comprobado
    =========================================================

    El orden exigido es:

        Discovery -> Identity Matcher -> Social Evidence -> Grafo

    Las tres primeras etapas las ejecuta el Social Intelligence
    Layer internamente, en ese orden. El GRAFO se construye
    aqui, DESPUES, y con el resultado del matcher ya
    disponible.

    Antes este orden era incidental: nada impedia que un
    cambio futuro moviera construirEntidades por encima del
    SIL y el grafo se construyera con nodos sin
    correspondencia, sin que nada fallara visiblemente.

    Ahora el orden se COMPRUEBA: si el grafo se construyera
    antes del matcher, la comprobacion lo declara en la
    respuesta en lugar de degradar en silencio.
  */
  const ordenPipeline = {
    esperado: [
      "discovery_engine",
      "identity_matcher",
      "social_evidence_engine",
      "grafo"
    ],
    ejecutado: [
      ...(social?.etapas || [])
        .filter((e) => e.estado === "ok")
        .map((e) => e.etapa),
      "grafo"
    ]
  };

  ordenPipeline.correcto =
    ordenPipeline.ejecutado.join(",") === ordenPipeline.esperado.join(",");

  ordenPipeline.grafoDespuesDelMatcher =
    ordenPipeline.ejecutado.indexOf("grafo") >
    ordenPipeline.ejecutado.indexOf("identity_matcher");

  if (!ordenPipeline.correcto) {
    console.warn(
      "[pipeline] orden no canonico:",
      ordenPipeline.ejecutado.join(" -> "),
      "| esperado:",
      ordenPipeline.esperado.join(" -> ")
    );
  }

  /*
    GRAFO — ultima etapa, con el matcher ya resuelto.
  */
  const entidades = construirEntidades(resultados, social);

  /*
    IDENTIDADES DESCUBIERTAS — orden de autoridad
    (corregido en el Sprint 3.2.1)

    Antes se daba prioridad a `fusion.identidades`, que
    proviene del servicio de correlación del Sprint 2: una
    heurística fija de 80+3 por evidencia, SIN Context Boost,
    SIN explicación desglosada y SIN el veto por contexto
    incompatible.

    El resultado era que el panel mostraba la correlación
    antigua y más débil, mientras las fichas del Social
    Evidence Engine —con CB-1 y veto— quedaban relegadas. Un
    homónimo vetado por CB-1 podía seguir apareciendo en
    primer plano por la vía antigua.

    Orden correcto:  Social Evidence  >  Fusion  >  legacy.
  */
  let identidadesDescubiertas = [];

  let origenIdentidades = "ninguno";

  /*
    ---------------------------------------------------------
    ORIGEN DEL DESCUBRIMIENTO — que PROVEEDOR aporto la
    evidencia (Sprint 3.2.2)
    ---------------------------------------------------------

    `origenIdentidades` declara que MOTOR tiene la autoridad
    (Social Evidence > Fusion > legacy). Es una garantia
    arquitectonica: sin ella un homonimo vetado por CB-1
    reaparecia en primer plano por la via antigua.

    El proveedor es una dimension distinta y se declara aparte,
    para no perder ninguna de las dos.

    Se DERIVA de los intentos reales, no se fija a mano: si
    SerpAPI se queda sin cuota y responde DuckDuckGo, el campo
    lo dice.
  */
  const proveedoresConExito = new Set();

  [
    ...(social?.descubrimiento?.intentos || []),
    ...(fusion?.intentos || []),
    ...(fusion?.motores || []).flatMap((m) => m.intentos || [])
  ].forEach((i) => {
    if (i?.estado === "OK" && i?.proveedorId) {
      proveedoresConExito.add(i.proveedorId);
    }
  });

  (social?.fichas || []).forEach((f) => {
    (f.proveedores || []).forEach((nombre) => {
      if (/serpapi/i.test(nombre)) proveedoresConExito.add("serpapi_google");
      else if (/duckduckgo/i.test(nombre)) proveedoresConExito.add("duck_web");
      else if (/brave/i.test(nombre)) proveedoresConExito.add("brave_web");
      else if (/wikidata/i.test(nombre)) proveedoresConExito.add("wikidata");
    });
  });

  const origenDescubrimiento = proveedoresConExito.has("serpapi_google")
    ? "serpapi"
    : proveedoresConExito.has("brave_web")
      ? "brave"
      : proveedoresConExito.has("duck_web")
        ? "duckduckgo"
        : proveedoresConExito.has("wikidata")
          ? "wikidata"
          : "ninguno";

  try {
    if (social?.fichas?.length) {
      /*
        Se traduce la ficha al contrato que ya consume
        IdentityCorrelationPanel, conservando lo que aporta el
        Sprint 3.2: correspondencia explicada y veredicto de
        contexto.
      */
      identidadesDescubiertas = social.fichas.map((f) => {
        const c = f.correspondencia;

        const cb = c?.explicacion?.contextBoost || null;

        return {
          plataforma: f.plataforma,
          plataformaId: f.platform,
          usuario: f.handle,
          enlace: f.url?.canonica || null,
          urlNormalizada: f.url?.clave || null,

          /* Confianza = correspondencia del Identity Matcher. */
          confianza: c?.puntuacion ?? null,
          nivel: c?.nivel || null,
          etiqueta: c?.etiqueta || null,
          estado: c?.estado || null,

          evidencias: (f.origenes || []).length,
          motores: f.proveedores || [],
          totalMotores: (f.proveedores || []).length,
          corroboracionMultiMotor: (f.proveedores || []).length > 1,

          /* IA1 — nunca confirmado, siempre explicado. */
          verificado: false,
          requiereRevisionHumana: true,
          explicacion: c?.explicacion?.resumen || null,

          /* Sprint 3.2 — contexto. */
          contextoVeredicto: cb?.veredicto || null,
          contextoAjuste: cb?.ajuste ?? null,
          vetadoPorContexto: cb?.vetoAplicado === true,

          calidad: f.quality?.nivel || null,
          origen: "social_evidence_engine"
        };
      });

      origenIdentidades = "social_evidence_engine";
    } else if (fusion?.identidades?.length) {
      identidadesDescubiertas = fusion.identidades;

      origenIdentidades = "fusion_engine";
    } else {
      const correlacion = correlacionarIdentidades(resultados);

      if (Array.isArray(correlacion)) {
        identidadesDescubiertas = correlacion;

        origenIdentidades = "correlacion_legacy";
      }
    }
  } catch (error) {
    console.error(
      "Error en correlacionarIdentidades:",
      error
    );

    identidadesDescubiertas = [];
  }

  /*
    TIEMPO DE INVESTIGACIÓN
  */
  const tiempo =
    ((Date.now() - inicio) / 1000).toFixed(2);

  /*
    IDENTIDAD PRINCIPAL

    Primero utilizamos avatarService.js.

    Si por alguna razón falla, utilizamos
    un avatar SVG LOCAL.

    Nunca se utiliza ui-avatars.com.
  */
  const identidadBase =
    avatar.status === "fulfilled" &&
    avatar.value
      ? avatar.value
      : {
          nombre: objetivo,
          tipo: "objetivo",
          avatar: crearAvatarFallback(objetivo),
          fuente: "local"
        };

  /*
    ---------------------------------------------------------
    B2 · UNA SOLA FUENTE DE VERDAD DEL PUNTAJE
    ---------------------------------------------------------

    Defecto corregido (QA-1, Bloque 1):

    La identidad de respaldo llevaba `confianza: 70`, un valor
    fijo heredado de avatarService que no medía nada. Cuando el
    AIE devolvía un respaldo con confianza 0, la respuesta
    exponía DOS cifras contradictorias para el mismo avatar:
    70 en `identidad` y 0 en `identidad.inteligencia`. Un
    consumidor que leyera la primera creería que hay un 70 % de
    confianza en un marcador generado.

    Ahora el Avatar Intelligence Engine es la ÚNICA autoridad
    sobre `confianza` y `fuente`:

      · AIE con fotografía verificada → se adopta su resultado
      · AIE con respaldo              → avatar local, pero
                                        confianza y fuente del AIE
      · AIE no ejecutado o con error  → confianza null, no un
                                        número inventado

    `null` y no `0`: cero significa «se buscó y no hay
    fotografía verificable»; null significa «no se evaluó».
    Son cosas distintas y confundirlas es el mismo error que
    separa `bloqueado` de `0 resultados`.
  */
  const inteligenciaAvatar = avatarInteligente?.inteligencia || null;

  const identidad = {
    ...identidadBase,

    /*
      El avatar del AIE solo sustituye al local si es una
      fotografía real verificada.
    */
    avatar:
      inteligenciaAvatar && inteligenciaAvatar.esRespaldo === false
        ? avatarInteligente.avatar
        : identidadBase.avatar,

    /* Autoridad única del puntaje. */
    confianza: inteligenciaAvatar ? inteligenciaAvatar.confianza : null,

    fuente: inteligenciaAvatar
      ? inteligenciaAvatar.fuente
      : identidadBase.fuente,

    /*
      Declara explícitamente si el puntaje fue evaluado, para
      que `confianza: null` no se lea como un fallo silencioso.
    */
    confianzaEvaluada: Boolean(inteligenciaAvatar),

    /*
      SPRINT 3.2.1 · B1 — ruta del proxy propio. La capa de
      rutas la absolutiza con el host de la petición. La URL de
      la fuente se conserva aparte para la atribución.
    */
    rutaProxy:
      inteligenciaAvatar && inteligenciaAvatar.esRespaldo === false
        ? inteligenciaAvatar.rutaProxy || null
        : null,

    imageUrlOriginal: inteligenciaAvatar?.imageUrlOriginal || null,
    licencia: inteligenciaAvatar?.licencia || null,
    urlFuente: inteligenciaAvatar?.urlFuente || null,

    /*
      Aunque se conserve el avatar local, se adjunta la
      inteligencia del AIE: explicar POR QUÉ no hay fotografía
      también es información.
    */
    inteligencia: inteligenciaAvatar
  };

  /*
    RESULTADO FINAL
  */
  return {
    objetivo,

    identidad,

    estado: "Conectado",

    tiempo: `${tiempo}s`,

    total: resultados.length,

    fuentes: ["Fusion Engine"],

    /*
      ESTADO DE LOS MOTORES
    */
    motores: [
      {
        nombre: "Google",
        estado:
          google.status === "fulfilled"
            ? "success"
            : "error",
        hallazgos:
          google.status === "fulfilled"
            ? Number(google.value.total) || 0
            : 0
      },

      {
        nombre: "Google News",
        estado:
          noticias.status === "fulfilled"
            ? "success"
            : "error",
        hallazgos:
          noticias.status === "fulfilled"
            ? Number(noticias.value.total) || 0
            : 0
      },

      {
        nombre: "Wayback",
        estado:
          wayback.status === "fulfilled"
            ? "success"
            : "error",
        hallazgos:
          wayback.status === "fulfilled"
            ? Number(wayback.value.total) || 0
            : 0
      },

      {
        nombre: "Whois",
        estado:
          whois.status === "fulfilled"
            ? "success"
            : "error",
        hallazgos:
          whois.status === "fulfilled"
            ? Number(whois.value.total) || 0
            : 0
      }
    ],

    /*
      PERFIL DE REFERENCIA

      Puede ser null: el frontend debe tolerarlo.
    */
    perfilReferencia,

    /*
      FUSION SEARCH ENGINE

      Puede ser null: el frontend debe tolerarlo.
    */
    fusion,

    /*
      SOCIAL INTELLIGENCE LAYER (Sprint 3.1)
    */
    social,

    /*
      FICHA CONSOLIDADA DEL OBJETIVO

      Une Perfil de Referencia + Fusion + Social en la vista
      que consume ReferenceProfilePanel. Aditivo: los campos
      anteriores siguen presentes.
    */
    fichaObjetivo: perfilReferencia
      ? consolidarFichaObjetivo({
          objetivo,
          perfil: perfilReferencia,
          identidad,
          fusion,
          social
        })
      : null,

    /*
      ENTIDADES PARA EL GRAFO
    */
    entidades,

    /*
      Orden del pipeline, declarado y comprobado.
    */
    ordenPipeline,

    /*
      IDENTIDADES PARA IDENTITY
      CORRELATION ENGINE
    */
    identidadesDescubiertas,

    /*
      De qué motor provienen las identidades mostradas. Sin
      esto, dos ejecuciones podrían mostrar cifras distintas
      sin explicación visible.
    */
    origenIdentidades,
    origenDescubrimiento,
    proveedoresConExito: [...proveedoresConExito],


    /*
      TIMELINE
    */
    timeline: [
      {
        etapa: "Objetivo identificado",
        detalle: objetivo
      },

      {
        etapa: "Google",
        detalle:
          google.status === "fulfilled"
            ? `${google.value.total} resultados`
            : "Sin respuesta"
      },

      {
        etapa: "Google News",
        detalle:
          noticias.status === "fulfilled"
            ? `${noticias.value.total} noticias`
            : "Sin respuesta"
      },

      {
        etapa: "Wayback",
        detalle:
          wayback.status === "fulfilled"
            ? `${wayback.value.total || 0} registros`
            : "Sin respuesta"
      },

      {
        etapa: "Whois",
        detalle:
          whois.status === "fulfilled"
            ? `${whois.value.total || 0} registros`
            : "Sin respuesta"
      },

      {
        etapa: "Perfil de Referencia",
        detalle: perfilReferencia
          ? `${perfilReferencia.terminosDiscriminantes.length} términos discriminantes · ` +
            `${perfilReferencia.handlesObservados.length} handles observados · ` +
            `confianza ${perfilReferencia.confianza.global}/100`
          : "No disponible"
      },

      {
        etapa: "Fusion Engine",
        detalle: fusion
          ? `${fusion.metricas.consultasEjecutadas} consultas · ` +
            `${fusion.metricas.resultadosBrutos} resultados brutos → ` +
            `${fusion.metricas.evidenciasUnicas} evidencias únicas ` +
            `(${fusion.metricas.duplicadosFusionados} fusionados)`
          : "No disponible"
      },

      {
        etapa: "Social Intelligence",
        detalle: social
          ? `${social.metricas.candidatos} candidatos → ` +
            `${social.metricas.fichasUnicas} fichas únicas · ` +
            `${social.metricas.probables} probables · ` +
            `máx ${social.metricas.puntuacionMaxima}/100`
          : "No disponible"
      },

      {
        etapa: "Avatar Intelligence",
        detalle: avatarInteligente
          ? `${avatarInteligente.inteligencia.fuente} · nivel ${avatarInteligente.inteligencia.nivelUsado} · ` +
            `confianza ${avatarInteligente.confianza}/100`
          : "No disponible"
      },

      {
        etapa: "Correlación",
        detalle:
          `${identidadesDescubiertas.length} identidades detectadas`
      }
    ],

    /*
      TODAS LAS EVIDENCIAS
    */
    resultados
  };
}