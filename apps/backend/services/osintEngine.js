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
function construirEntidades(resultados) {
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
    ENTIDADES DEL GRAFO
  */
  const entidades = construirEntidades(resultados);

  /*
    MOTOR DE CORRELACIÓN DE IDENTIDAD

    Si el Fusion Engine se ejecutó, ya correlacionó sobre el
    conjunto fusionado (más amplio y sin duplicados). En ese
    caso se reutiliza su resultado en lugar de recalcular
    sobre el descubrimiento general.
  */
  let identidadesDescubiertas = [];

  try {
    const correlacion = fusion?.identidades?.length
      ? fusion.identidades
      : correlacionarIdentidades(resultados);

    if (Array.isArray(correlacion)) {
      identidadesDescubiertas = correlacion;
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
          confianza: 70,
          fuente: "local"
        };

  /*
    Solo se sustituye si el AIE aporta una fotografia REAL
    verificada. Un respaldo generado por el AIE no es mejor
    que el avatar local que ya teniamos.
  */
  const identidad =
    avatarInteligente && avatarInteligente.inteligencia?.esRespaldo === false
      ? avatarInteligente
      : {
          ...identidadBase,
          /*
            Aunque se conserve el avatar local, se adjunta la
            inteligencia del AIE: explica POR QUE no hay
            fotografia, que es informacion util.
          */
          inteligencia: avatarInteligente?.inteligencia || null
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
      IDENTIDADES PARA IDENTITY
      CORRELATION ENGINE
    */
    identidadesDescubiertas,

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