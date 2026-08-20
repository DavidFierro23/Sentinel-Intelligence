// apps/backend/services/social/platforms/platformScanner.js

import { normalizarTexto, tokenizar, normalizarUrl } from "../../textUtils.js";

import {
  MODOS_ACCESO,
  ESTADOS_PRESENCIA,
  catalogoPlataformas
} from "../socialContracts.js";

/*
===========================================================
SENTINEL INTELLIGENCE
PLATFORM SCANNER
===========================================================

Descubre cuentas públicas de un objetivo SIN usar ninguna API
de plataforma.

-----------------------------------------------------------
POR QUÉ WIKIDATA Y NO LAS APIS SOCIALES
-----------------------------------------------------------

El sprint prohíbe implementar APIs sociales, y con razón:
Facebook Graph exige app y revisión, X cobra, Instagram solo
sirve cuentas propias autorizadas y LinkedIn prohíbe el
raspado. Ese camino está cerrado.

Pero existe una fuente que declara las cuentas oficiales de
una persona pública y que YA se consulta en esta plataforma
para las fotografías: **Wikidata**.

  P2002  X / Twitter
  P2013  Facebook
  P2397  canal de YouTube
  P7085  TikTok
  P6634  LinkedIn
  P2003  Instagram
  P856   sitio web oficial

Medido antes de escribir el módulo:

  Daniel Noboa (Q112075625)      X, Facebook e Instagram
  Yaku Pérez (Q51256569)         X, Facebook, Instagram y web
  Juan Cristóbal Lloret (Q129837409)  ninguna

No es una API social: es la misma API pública de Wikidata que
el Avatar Intelligence Engine usa para P18 y P31. No toca
ninguna plataforma, no requiere credencial y no elude ningún
muro de sesión.

-----------------------------------------------------------
QUÉ CLASE DE EVIDENCIA ES
-----------------------------------------------------------

Una cuenta declarada en Wikidata es evidencia MÁS FUERTE que
un resultado de buscador —la declara una base de conocimiento
con procedencia y edición auditable— pero SIGUE SIN SER una
lectura del perfil.

Por eso el modo de acceso es `declarada_por_referencia`, y no
`api_oficial`: no hemos leído la biografía, ni los
seguidores, ni verificado que la cuenta siga activa. Lo que
sabemos es que una fuente de referencia la atribuye al
objetivo.

Y sigue rigiendo el tope humano: por fuerte que sea la
declaración, el sistema no confirma identidades.

-----------------------------------------------------------
NO INVENTAR CUENTAS
-----------------------------------------------------------

  · La entidad se VERIFICA antes de leer sus propiedades:
    nombre coincidente y P31 = Q5 (ser humano). Sin eso, las
    cuentas de un homónimo se atribuirían al objetivo.
  · Si una plataforma no tiene propiedad declarada, queda
    `no_comprobada` con su motivo. Nunca se deduce un handle
    a partir del nombre.
  · Si no hay entidad, no hay cuentas. Cero, y se declara.
===========================================================
*/


const AGENTE =
  "SentinelIntelligence/1.0 (plataforma de inteligencia; contacto interno)";

const TIEMPO_MAXIMO_MS = 12000;


/*
-----------------------------------------------------------
PROPIEDADES DE CUENTA Y CÓMO SE CONVIERTEN EN URL

La plantilla es el patrón canónico y público de cada
plataforma. No se deduce nada: se compone la URL del handle
que Wikidata declara.
-----------------------------------------------------------
*/

export const PROPIEDADES_SOCIALES = Object.freeze([
  {
    propiedad: "P2013",
    plataformaId: "facebook",
    plataforma: "Facebook",
    tipo: "pagina",
    url: (h) => `https://www.facebook.com/${h}`,
    peso: 30
  },
  {
    propiedad: "P2002",
    plataformaId: "x",
    plataforma: "X",
    tipo: "perfil",
    url: (h) => `https://x.com/${h}`,
    peso: 30
  },
  {
    propiedad: "P2397",
    plataformaId: "youtube",
    plataforma: "YouTube",
    tipo: "canal",
    url: (h) => `https://www.youtube.com/channel/${h}`,
    peso: 30,
    handleOpaco: true
  },
  {
    propiedad: "P7085",
    plataformaId: "tiktok",
    plataforma: "TikTok",
    tipo: "perfil",
    url: (h) => `https://www.tiktok.com/@${h}`,
    peso: 30
  },
  {
    propiedad: "P6634",
    plataformaId: "linkedin",
    plataforma: "LinkedIn",
    tipo: "perfil",
    url: (h) => `https://www.linkedin.com/in/${h}`,
    peso: 28
  },
  {
    propiedad: "P2003",
    plataformaId: "instagram",
    plataforma: "Instagram",
    tipo: "perfil",
    url: (h) => `https://www.instagram.com/${h}`,
    peso: 28
  }
]);


/* Sitio web oficial: no es cuenta, pero es contexto valioso. */
const PROPIEDAD_SITIO_WEB = "P856";


async function pedirJson(url) {
  const control = new AbortController();

  const temporizador = setTimeout(() => control.abort(), TIEMPO_MAXIMO_MS);

  try {
    const r = await fetch(url, {
      headers: { "User-Agent": AGENTE, Accept: "application/json" },
      signal: control.signal
    });

    if (!r.ok) {
      const limitado = r.status === 429 || r.status >= 500;

      return {
        ok: false,
        noConsultado: limitado,
        motivo: limitado
          ? `el proveedor limitó la petición (HTTP ${r.status})`
          : `HTTP ${r.status}`
      };
    }

    return { ok: true, datos: await r.json() };
  } catch (error) {
    return {
      ok: false,
      noConsultado: true,
      motivo:
        error?.name === "AbortError"
          ? "tiempo agotado sin respuesta"
          : `fallo de red: ${error?.message || "desconocido"}`
    };
  } finally {
    clearTimeout(temporizador);
  }
}


/*
-----------------------------------------------------------
VERIFICAR EL NOMBRE DE LA ENTIDAD

Misma disciplina que el Avatar Intelligence Engine: todos los
tokens del nombre buscado deben estar en la etiqueta. Sin
esto, las cuentas de un homónimo se atribuirían al objetivo —
que es el fallo más grave que este módulo puede cometer.
-----------------------------------------------------------
*/

export function verificarEtiqueta(nombreObjetivo, etiqueta) {
  const tokensObjetivo = tokenizar(normalizarTexto(nombreObjetivo), 3);

  if (!tokensObjetivo.length) {
    return { verificado: false, motivo: "el nombre no aporta tokens comparables" };
  }

  const tokensEtiqueta = new Set(tokenizar(normalizarTexto(etiqueta), 3));

  const faltantes = tokensObjetivo.filter((t) => !tokensEtiqueta.has(t));

  if (faltantes.length) {
    return {
      verificado: false,
      motivo: `la etiqueta "${etiqueta}" no contiene ${faltantes.join(", ")} del nombre buscado`
    };
  }

  const extra = [...tokensEtiqueta].filter((t) => !tokensObjetivo.includes(t));

  return {
    verificado: true,
    tipo: extra.length ? "contenida" : "exacta",
    motivo: extra.length
      ? `la etiqueta "${etiqueta}" contiene el nombre completo y añade ${extra.join(", ")}`
      : `la etiqueta coincide con "${etiqueta}"`
  };
}


/*
-----------------------------------------------------------
LOCALIZAR LA ENTIDAD

Si el Avatar Intelligence Engine ya resolvió una entidad para
este objetivo, se reutiliza: está verificada y ahorra una
petición.
-----------------------------------------------------------
*/

async function localizarEntidad(nombre, perfil, qidConocido, traza) {
  if (qidConocido) {
    traza.push({
      paso: "entidad",
      resultado: "reutilizada",
      motivo: `entidad ${qidConocido} ya verificada por el Avatar Intelligence Engine`
    });

    return { qid: qidConocido, verificacion: { verificado: true, tipo: "heredada", motivo: "verificada previamente" } };
  }

  const url =
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json` +
    `&search=${encodeURIComponent(nombre)}&language=es&uselang=es&limit=5&type=item`;

  const r = await pedirJson(url);

  if (!r.ok) {
    traza.push({
      paso: "entidad",
      resultado: r.noConsultado ? "no_consultado" : "error",
      motivo: r.motivo
    });

    return { qid: null, noConsultado: r.noConsultado, motivo: r.motivo };
  }

  const candidatas = r.datos?.search || [];

  for (const c of candidatas) {
    const v = verificarEtiqueta(nombre, c.label);

    if (!v.verificado) {
      traza.push({
        paso: "entidad",
        candidato: `${c.id} ${c.label}`,
        resultado: "rechazada",
        motivo: v.motivo
      });

      continue;
    }

    traza.push({
      paso: "entidad",
      candidato: `${c.id} ${c.label}`,
      resultado: "aceptada",
      motivo: v.motivo
    });

    return { qid: c.id, etiqueta: c.label, verificacion: v };
  }

  traza.push({
    paso: "entidad",
    resultado: "sin_coincidencia",
    motivo: `ninguna de las ${candidatas.length} entidades verifica el nombre`
  });

  return { qid: null, motivo: "sin entidad verificada" };
}


/*
===========================================================
ESCANEAR

Devuelve las cuentas declaradas y la cobertura por
plataforma, incluidas las que NO tienen declaración.
===========================================================
*/

export async function escanearPlataformas(objetivo, opciones = {}) {
  const inicio = Date.now();

  const perfil = opciones.perfil || null;

  const nombre = perfil?.nombrePrincipal || String(objetivo ?? "").trim();

  const traza = [];

  const plataformasSoportadas = catalogoPlataformas();

  const coberturaVacia = (motivo, estado) =>
    plataformasSoportadas.map((p) => ({
      plataformaId: p.id,
      plataforma: p.nombre,
      cuentas: 0,
      estadoPresencia: estado,
      modoAcceso: MODOS_ACCESO.NO_DISPONIBLE,
      motivo
    }));

  if (!nombre) {
    return {
      version: "1.0",
      cuentas: [],
      cobertura: coberturaVacia("sin objetivo", ESTADOS_PRESENCIA.NO_COMPROBADA),
      traza,
      metricas: { cuentas: 0, plataformasConCuenta: 0, confianzaMaxima: 0, tiempo: "0s" }
    };
  }

  /*
    Solo tiene sentido para personas y términos.
  */
  const tipo = perfil?.tipoObjetivo || "desconocido";

  if (!["persona", "termino", "desconocido"].includes(tipo)) {
    return {
      version: "1.0",
      cuentas: [],
      cobertura: coberturaVacia(
        `el objetivo es de tipo "${tipo}", no una persona u organización`,
        ESTADOS_PRESENCIA.NO_COMPROBADA
      ),
      traza,
      metricas: { cuentas: 0, plataformasConCuenta: 0, confianzaMaxima: 0, tiempo: "0s" }
    };
  }

  /*
    ---------------------------------------------------------
    1 · ENTIDAD VERIFICADA
    ---------------------------------------------------------
  */
  const entidad = await localizarEntidad(
    nombre,
    perfil,
    opciones.wikidata || null,
    traza
  );

  if (!entidad.qid) {
    return {
      version: "1.0",
      objetivo: nombre,
      entidad: null,
      cuentas: [],
      cobertura: coberturaVacia(
        entidad.noConsultado
          ? `no se pudo consultar la base de referencia: ${entidad.motivo}`
          : "no existe una entidad de referencia verificada para este objetivo",
        ESTADOS_PRESENCIA.NO_COMPROBADA
      ),
      traza,
      /*
        Distinción obligatoria: no encontrar entidad es
        distinto de no poder consultarla.
      */
      busquedaCompleta: !entidad.noConsultado,
      diagnostico: entidad.noConsultado
        ? "La base de referencia no respondió: la ausencia de cuentas NO está comprobada."
        : `No hay entidad de referencia verificada para "${nombre}". Sin ella no se pueden atribuir cuentas: hacerlo sería inventarlas.`,
      metricas: { cuentas: 0, plataformasConCuenta: 0, confianzaMaxima: 0, tiempo: `${((Date.now() - inicio) / 1000).toFixed(2)}s` }
    };
  }

  /*
    ---------------------------------------------------------
    2 · PROPIEDADES DE LA ENTIDAD
    ---------------------------------------------------------
  */
  const url =
    `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json` +
    `&ids=${encodeURIComponent(entidad.qid)}&props=claims%7Clabels&languages=es`;

  const r = await pedirJson(url);

  if (!r.ok) {
    traza.push({ paso: "propiedades", resultado: "no_consultado", motivo: r.motivo });

    return {
      version: "1.0",
      objetivo: nombre,
      entidad: { qid: entidad.qid },
      cuentas: [],
      cobertura: coberturaVacia(
        `no se pudieron leer las propiedades de ${entidad.qid}: ${r.motivo}`,
        ESTADOS_PRESENCIA.NO_COMPROBADA
      ),
      traza,
      busquedaCompleta: false,
      metricas: { cuentas: 0, plataformasConCuenta: 0, confianzaMaxima: 0, tiempo: `${((Date.now() - inicio) / 1000).toFixed(2)}s` }
    };
  }

  const ent = r.datos?.entities?.[entidad.qid];

  const claims = ent?.claims || {};

  const etiqueta = ent?.labels?.es?.value || entidad.etiqueta || null;

  /*
    VERIFICACIÓN DE PERSONA — P31 = Q5.
  */
  const instanciaDe = (claims.P31 || [])
    .map((c) => c?.mainsnak?.datavalue?.value?.id)
    .filter(Boolean);

  const esPersona = instanciaDe.includes("Q5");

  traza.push({
    paso: "verificacion",
    resultado: esPersona ? "persona" : "no_persona",
    motivo: esPersona
      ? "Wikidata la declara instancia de ser humano (P31 = Q5)"
      : `P31 = ${instanciaDe.join(", ") || "sin dato"}`
  });

  /*
    ---------------------------------------------------------
    PUERTA DE TIPO DE ENTIDAD
    ---------------------------------------------------------

    Coincidir de nombre NO basta. Medido en la primera prueba:
    "Juan Carlos Vega" resuelve a Q61301982, que es un LUGAR de
    Ecuador (Q20202352, con coordenadas y pais), no una
    persona.

    Ese caso no declaraba cuentas, asi que no hizo dano. Pero
    una pelicula, un disco o un municipio homonimo SI pueden
    declarar Facebook o X, y sin esta puerta Sentinel le
    atribuiria esas cuentas a una persona. Es exactamente el
    fallo que este modulo no puede permitirse.

    Por eso: si la entidad no es un ser humano, no se emiten
    cuentas. Se declara por que.
  */
  if (!esPersona) {
    return {
      version: "1.0",
      objetivo: nombre,
      entidad: {
        qid: entidad.qid,
        etiqueta,
        esPersona: false,
        instanciaDe,
        url: `https://www.wikidata.org/wiki/${entidad.qid}`
      },
      cuentas: [],
      cobertura: coberturaVacia(
        `la entidad ${entidad.qid} ("${etiqueta}") coincide de nombre pero NO es una persona (P31 = ${instanciaDe.join(", ") || "sin dato"}). No se le atribuyen cuentas.`,
        ESTADOS_PRESENCIA.NO_COMPROBADA
      ),
      traza,
      busquedaCompleta: true,
      diagnostico: `"${nombre}" coincide con la entidad ${entidad.qid}, que no es un ser humano. Atribuirle cuentas seria un falso positivo: se descarta.`,
      metricas: {
        cuentas: 0,
        plataformasConCuenta: 0,
        confianzaMaxima: 0,
        tiempo: `${((Date.now() - inicio) / 1000).toFixed(2)}s`
      }
    };
  }

  const sitioWeb = (claims[PROPIEDAD_SITIO_WEB] || [])
    .map((c) => c?.mainsnak?.datavalue?.value)
    .filter((v) => typeof v === "string")[0] || null;

  /*
    ---------------------------------------------------------
    3 · CUENTAS DECLARADAS
    ---------------------------------------------------------
  */
  const cuentas = [];

  const sinDeclaracion = [];

  PROPIEDADES_SOCIALES.forEach((def) => {
    const valores = (claims[def.propiedad] || [])
      .map((c) => c?.mainsnak?.datavalue?.value)
      .filter((v) => typeof v === "string" && v.trim());

    if (!valores.length) {
      sinDeclaracion.push(def);
      return;
    }

    valores.slice(0, 2).forEach((handle) => {
      const urlCuenta = def.url(handle.trim());

      /*
        CONFIANZA Y SU MOTIVO — desglosado, nunca una cifra
        suelta (IA1).
      */
      const razones = [
        {
          motivo: `declarada como cuenta oficial en Wikidata (${def.propiedad}) para la entidad ${entidad.qid}`,
          puntos: def.peso
        }
      ];

      let valor = def.peso;

      /*
        Llegar aqui implica que la puerta de tipo se paso: la
        entidad es un ser humano verificado.
      */
      valor += 20;
      razones.push({
        motivo: "la entidad está verificada como persona (P31 = Q5)",
        puntos: 20
      });

      if (entidad.verificacion?.tipo === "exacta") {
        valor += 15;
        razones.push({
          motivo: `la etiqueta de la entidad coincide exactamente con el nombre buscado`,
          puntos: 15
        });
      } else if (entidad.verificacion?.verificado) {
        valor += 10;
        razones.push({
          motivo: entidad.verificacion.motivo,
          puntos: 10
        });
      }

      if (def.handleOpaco) {
        valor -= 5;
        razones.push({
          motivo: "el identificador es opaco (id de canal), no un nombre elegido",
          puntos: -5
        });
      }

      /*
        Techo deliberado: 85. Una cuenta declarada por una
        fuente de referencia es evidencia fuerte, pero NO se ha
        leído el perfil: no puede alcanzar el techo de una
        lectura verificada, y desde luego no puede confirmar
        una identidad (IA2).
      */
      valor = Math.max(0, Math.min(85, valor));

      cuentas.push({
        plataforma: def.plataforma,
        plataformaId: def.plataformaId,
        handle: handle.trim(),
        url: urlCuenta,
        urlNormalizada: normalizarUrl(urlCuenta),
        tipo: def.tipo,

        confianza: {
          valor,
          razones,
          significado:
            "Confianza en que esta cuenta pertenezca al objetivo, según su declaración en una base de conocimiento. No se ha leído el perfil.",
          techo: 85,
          motivoTecho:
            "Cuenta declarada, no leída: sin Platform Scanner por API no puede subir más."
        },

        motivoPuntuacion: razones
          .map((x) => `${x.puntos >= 0 ? "+" : ""}${x.puntos} ${x.motivo}`)
          .join(" · "),

        modoAcceso: MODOS_ACCESO.DECLARADA_POR_REFERENCIA,
        estadoPresencia: ESTADOS_PRESENCIA.INFERIDA,

        fuente: {
          tipo: "base_conocimiento",
          nombre: "Wikidata",
          entidad: entidad.qid,
          propiedad: def.propiedad,
          url: `https://www.wikidata.org/wiki/${entidad.qid}#${def.propiedad}`
        },

        handleOpaco: Boolean(def.handleOpaco),

        /* IA2 — el sistema no confirma. */
        requiereRevisionHumana: true,
        estado: "probable",

        descubiertoEn: new Date().toISOString()
      });

      traza.push({
        paso: "cuenta",
        resultado: "declarada",
        motivo: `${def.plataforma}: ${def.propiedad} = "${handle}"`
      });
    });
  });

  /*
    ---------------------------------------------------------
    4 · COBERTURA — incluidas las plataformas SIN cuenta
    ---------------------------------------------------------
  */
  const cobertura = plataformasSoportadas.map((p) => {
    const propias = cuentas.filter((c) => c.plataformaId === p.id);

    const definicion = PROPIEDADES_SOCIALES.find((d) => d.plataformaId === p.id);

    if (propias.length) {
      return {
        plataformaId: p.id,
        plataforma: p.nombre,
        cuentas: propias.length,
        estadoPresencia: ESTADOS_PRESENCIA.INFERIDA,
        modoAcceso: MODOS_ACCESO.DECLARADA_POR_REFERENCIA,
        motivo: `${propias.length} cuenta(s) declarada(s) en Wikidata (${definicion?.propiedad}).`
      };
    }

    if (!definicion) {
      return {
        plataformaId: p.id,
        plataforma: p.nombre,
        cuentas: 0,
        estadoPresencia: ESTADOS_PRESENCIA.NO_COMPROBADA,
        modoAcceso: MODOS_ACCESO.NO_DISPONIBLE,
        motivo:
          "sin propiedad equivalente en la base de conocimiento y sin API de plataforma"
      };
    }

    /*
      La entidad se leyó y esta propiedad NO está declarada.
      No es ausencia comprobada de cuenta: es ausencia de
      declaración. La cuenta puede existir sin estar registrada
      en Wikidata.
    */
    return {
      plataformaId: p.id,
      plataforma: p.nombre,
      cuentas: 0,
      estadoPresencia: ESTADOS_PRESENCIA.NO_COMPROBADA,
      modoAcceso: MODOS_ACCESO.NO_DISPONIBLE,
      motivo: `la entidad ${entidad.qid} no declara ${definicion.propiedad} (${p.nombre}). Ausencia de DECLARACIÓN, no de cuenta: podría existir sin estar registrada. Comprobarlo exige la API de la plataforma.`
    };
  });

  return {
    version: "1.0",

    objetivo: nombre,

    entidad: {
      qid: entidad.qid,
      etiqueta,
      esPersona,
      verificacion: entidad.verificacion,
      url: `https://www.wikidata.org/wiki/${entidad.qid}`
    },

    sitioWebOficial: sitioWeb,

    cuentas,

    cobertura,

    traza,

    busquedaCompleta: true,

    metricas: {
      cuentas: cuentas.length,
      plataformasConCuenta: new Set(cuentas.map((c) => c.plataformaId)).size,
      plataformasSinDeclaracion: sinDeclaracion.length,
      confianzaMaxima: cuentas.reduce(
        (m, c) => Math.max(m, c.confianza.valor),
        0
      ),
      tiempo: `${((Date.now() - inicio) / 1000).toFixed(2)}s`
    },

    limites: {
      sinLecturaDePerfil:
        "Ninguna cuenta fue leída en su plataforma. Se declara lo que una base de conocimiento atribuye al objetivo.",
      topeHumano:
        "El sistema no confirma identidades: el techo es «probable». Confirmar es competencia del analista (IA2).",
      ausenciaNoComprobada:
        "Una plataforma sin declaración queda NO COMPROBADA, nunca ausente: la cuenta puede existir sin estar registrada."
    },

    generadoEn: new Date().toISOString()
  };
}
