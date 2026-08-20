// apps/backend/services/avatar/avatarIntelligenceEngine.js

import { normalizarTexto, tokenizar, limpiarHtml } from "../textUtils.js";
import { obtenerAvatar as avatarLocalDeRespaldo } from "../avatarService.js";
/*
  SPRINT SAG — el AIE ya no tiene proxy propio: registra el
  activo en el Sentinel Asset Gateway, que es la capa unica
  para servir activos externos.
*/
import {
  registrarActivo,
  TIPOS_ACTIVO,
  absolutizar
} from "../assets/assetGateway.js";

/*
===========================================================
SENTINEL INTELLIGENCE
AVATAR INTELLIGENCE ENGINE (AIE)
===========================================================

Sustituye el avatar genérico por la mejor fotografía PÚBLICA
disponible, en este orden:

  1. Wikipedia          (si existe y VERIFICA)
  2. Perfil oficial corroborado
  3. Fotografía pública de alta confianza (Wikidata/Commons)
  4. Respaldo generado localmente

-----------------------------------------------------------
EL RIESGO REAL DE ESTE MOTOR
-----------------------------------------------------------

Medido antes de escribir una línea, buscando en Wikipedia los
cuatro objetivos de prueba:

  "Juan Cristóbal Lloret" → 1.er resultado: «Joan Capri»
                            (actor y humorista catalán)
  "Juan Carlos Vega"      → 1.er resultado: «Juan Carlos Álvarez»
                            2.º: «Asesinato de Juan Carlos Vega Llona»

Un motor que tomase el primer resultado atribuiría la cara de
Joan Capri a Juan Cristóbal Lloret. Poner el rostro de una
persona real sobre el nombre de otra es el peor fallo que
este módulo puede cometer: no es un dato impreciso, es una
identidad falsa con formato de hecho.

Por eso el AIE es DELIBERADAMENTE CONSERVADOR: ante la duda
devuelve el respaldo generado y explica por qué. Un avatar
genérico no informa; un avatar equivocado desinforma.

-----------------------------------------------------------
REGLAS
-----------------------------------------------------------

· Nunca se descargan imágenes: se devuelven URLs públicas.
· Nunca se inventa una imagen ni se deduce una URL probable.
· Solo fuentes públicas y de licencia abierta (Wikimedia).
· Toda selección declara su motivo y su confianza.
· Si nada verifica, respaldo generado + explicación.
===========================================================
*/


const AGENTE = "SentinelIntelligence/1.0 (plataforma de inteligencia; contacto interno)";

const TIEMPO_MAXIMO_MS = 12000;

const IDIOMAS_WIKIPEDIA = ["es", "en"];

/*
  Wikimedia limita la tasa de peticiones anonimas: en la
  bateria de prueba con cuatro objetivos seguidos devolvio
  HTTP 429 al cuarto. Se serializan las peticiones con una
  pausa minima, como ya se hizo con el Search Provider Layer.
*/
const PAUSA_ENTRE_PETICIONES_MS = 350;

let ultimaPeticion = 0;

async function esperarTurno() {
  const transcurrido = Date.now() - ultimaPeticion;

  if (ultimaPeticion && transcurrido < PAUSA_ENTRE_PETICIONES_MS) {
    await new Promise((r) => setTimeout(r, PAUSA_ENTRE_PETICIONES_MS - transcurrido));
  }

  ultimaPeticion = Date.now();
}


export const TIPOS_FUENTE = Object.freeze({
  ENCICLOPEDIA: "enciclopedia",
  PERFIL_OFICIAL: "perfil_oficial",
  BASE_CONOCIMIENTO: "base_conocimiento",
  GENERADO: "generado"
});


export const NIVELES = Object.freeze([
  { id: "muy_alta", etiqueta: "Muy alta", desde: 90 },
  { id: "alta", etiqueta: "Alta", desde: 75 },
  { id: "media", etiqueta: "Media", desde: 55 },
  { id: "baja", etiqueta: "Baja", desde: 30 },
  { id: "ninguna", etiqueta: "Sin fotografía verificada", desde: 0 }
]);

function nivelDe(puntuacion) {
  return NIVELES.find((n) => puntuacion >= n.desde) || NIVELES[NIVELES.length - 1];
}


/*
-----------------------------------------------------------
TÍTULOS QUE NO SON BIOGRAFÍAS

Un artículo puede contener el nombre completo del objetivo y
no ser sobre él: «Asesinato de Juan Carlos Vega Llona»,
«Elecciones municipales de Cuenca de 2026», «Primer Gobierno
de Daniel Noboa».

La comprobación definitiva es P31 = Q5 (instancia de: ser
humano) en Wikidata, pero este filtro evita la petición
cuando el título ya lo delata.
-----------------------------------------------------------
*/

const PATRONES_NO_BIOGRAFIA = [
  /^asesinato\b/i,
  /^muerte\b/i,
  /^atentado\b/i,
  /^caso\b/i,
  /^elecciones\b/i,
  /^gobierno\b/i,
  /^primer gobierno\b/i,
  /^segundo gobierno\b/i,
  /^presidencia\b/i,
  /^alcald[ií]a\b/i,
  /^prefectura\b/i,
  /^movimiento\b/i,
  /^partido\b/i,
  /^anexo:/i,
  /^categor[ií]a:/i,
  /^lista de\b/i,
  /^familia\b/i
];

function pareceBiografia(titulo) {
  return !PATRONES_NO_BIOGRAFIA.some((p) => p.test(String(titulo || "").trim()));
}


/*
-----------------------------------------------------------
VERIFICACIÓN DEL NOMBRE

Exige que TODOS los tokens significativos del nombre buscado
estén en el título. Es lo que separa los casos reales:

  "Yaku Pérez" ⊂ "Yaku Pérez Guartambel"        → ACEPTA
  "Juan Carlos Vega" ⊄ "Juan Carlos Álvarez"    → RECHAZA
  "Juan Cristóbal Lloret" ⊄ "Joan Capri"        → RECHAZA

Que el título tenga tokens ADICIONALES es normal (segundo
apellido, nombre completo). Que le FALTE alguno del objetivo
no lo es.
-----------------------------------------------------------
*/

export function verificarNombre(nombreObjetivo, tituloCandidato, variantes = []) {
  const objetivo = normalizarTexto(nombreObjetivo);

  const titulo = normalizarTexto(tituloCandidato);

  if (!objetivo || !titulo) {
    return { verificado: false, tipo: "sin_datos", motivo: "falta nombre o título" };
  }

  /* Coincidencia exacta con el nombre o con una variante. */
  const todasLasVariantes = [nombreObjetivo, ...variantes]
    .filter(Boolean)
    .map(normalizarTexto);

  if (todasLasVariantes.includes(titulo)) {
    return {
      verificado: true,
      tipo: "exacta",
      motivo: `el título coincide exactamente con "${tituloCandidato}"`,
      fuerza: 1
    };
  }

  /* Todos los tokens del objetivo presentes en el título. */
  const tokensObjetivo = tokenizar(objetivo, 3);

  if (!tokensObjetivo.length) {
    return {
      verificado: false,
      tipo: "nombre_insuficiente",
      motivo: "el nombre buscado no aporta tokens comparables"
    };
  }

  const tokensTitulo = new Set(tokenizar(titulo, 3));

  const faltantes = tokensObjetivo.filter((t) => !tokensTitulo.has(t));

  if (faltantes.length === 0) {
    const extra = [...tokensTitulo].filter((t) => !tokensObjetivo.includes(t));

    return {
      verificado: true,
      tipo: extra.length ? "contenida" : "equivalente",
      motivo: extra.length
        ? `el título "${tituloCandidato}" contiene el nombre completo y añade ${extra.join(", ")}`
        : `el título "${tituloCandidato}" equivale al nombre buscado`,
      fuerza: extra.length ? 0.9 : 1,
      tokensAdicionales: extra
    };
  }

  return {
    verificado: false,
    tipo: "tokens_faltantes",
    motivo: `el título "${tituloCandidato}" no contiene ${faltantes.join(", ")} del nombre buscado`,
    faltantes
  };
}


/*
-----------------------------------------------------------
LIMPIAR URL DE IMAGEN

Wikipedia devuelve la URL con parámetros de rastreo añadidos.
Se retiran: la URL debe ser estable y comparable.
-----------------------------------------------------------
*/

export function limpiarUrlImagen(url) {
  if (!url) return null;

  try {
    const u = new URL(url);

    [...u.searchParams.keys()]
      .filter((k) => k.startsWith("utm_") || k === "ref" || k === "source")
      .forEach((k) => u.searchParams.delete(k));

    const q = u.searchParams.toString();

    return `${u.origin}${u.pathname}${q ? `?${q}` : ""}`;
  } catch {
    return url;
  }
}


/*
-----------------------------------------------------------
PETICIÓN JSON con tiempo máximo
-----------------------------------------------------------
*/

async function pedirJson(url) {
  await esperarTurno();

  const control = new AbortController();

  const temporizador = setTimeout(() => control.abort(), TIEMPO_MAXIMO_MS);

  try {
    const respuesta = await fetch(url, {
      headers: { "User-Agent": AGENTE, Accept: "application/json" },
      signal: control.signal
    });

    if (!respuesta.ok) {
      /*
        429 y 5xx no significan "no existe": significan "no
        pudimos consultar". La distincion es la misma que
        separa `bloqueado` de `0 resultados` en el Search
        Provider Layer, y aqui importa mas: decir "no hay
        fotografia" cuando no miramos es afirmar algo falso.
      */
      const limitado = respuesta.status === 429 || respuesta.status >= 500;

      return {
        ok: false,
        estado: respuesta.status,
        noConsultado: limitado,
        motivo: limitado
          ? `el proveedor limito la peticion (HTTP ${respuesta.status})`
          : `HTTP ${respuesta.status}`
      };
    }

    return { ok: true, datos: await respuesta.json() };
  } catch (error) {
    return {
      ok: false,
      noConsultado: true,
      error: error?.name === "AbortError" ? "tiempo agotado" : error?.message,
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
===========================================================
NIVEL 1 · WIKIPEDIA
===========================================================
*/

async function buscarEnWikipedia(nombre, idioma) {
  const url =
    `https://${idioma}.wikipedia.org/w/api.php?action=query&format=json` +
    `&list=search&srsearch=${encodeURIComponent(nombre)}&srlimit=5`;

  const r = await pedirJson(url);

  if (!r.ok) {
    return { ok: false, motivo: r.motivo || r.error, noConsultado: r.noConsultado };
  }

  return {
    ok: true,
    resultados: (r.datos?.query?.search || []).map((s) => s.title)
  };
}


async function obtenerPaginaWikipedia(titulo, idioma) {
  const url =
    `https://${idioma}.wikipedia.org/w/api.php?action=query&format=json` +
    `&prop=pageimages%7Cextracts%7Cpageprops&piprop=original%7Cthumbnail` +
    `&pithumbsize=512&exintro=1&explaintext=1` +
    `&titles=${encodeURIComponent(titulo)}`;

  const r = await pedirJson(url);

  if (!r.ok) {
    return { ok: false, motivo: r.motivo || r.error, noConsultado: r.noConsultado };
  }

  const paginas = r.datos?.query?.pages || {};

  const pagina = Object.values(paginas)[0];

  if (!pagina || pagina.missing !== undefined) {
    return { ok: false, motivo: "la página no existe" };
  }

  return {
    ok: true,
    titulo: pagina.title,
    imagen: limpiarUrlImagen(pagina.original?.source),
    miniatura: limpiarUrlImagen(pagina.thumbnail?.source),
    extracto: limpiarHtml(pagina.extract || ""),
    wikidata: pagina.pageprops?.wikibase_item || null,
    urlPagina: `https://${idioma}.wikipedia.org/wiki/${encodeURIComponent(
      pagina.title.replace(/ /g, "_")
    )}`
  };
}


/*
-----------------------------------------------------------
¿ES UN SER HUMANO? — Wikidata P31 = Q5

Comprobación definitiva contra artículos que contienen el
nombre sin ser una biografía.
-----------------------------------------------------------
*/

async function verificarEsPersona(idWikidata) {
  if (!idWikidata) {
    return { comprobado: false, motivo: "la página no tiene entidad en Wikidata" };
  }

  const url =
    `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json` +
    `&ids=${encodeURIComponent(idWikidata)}&props=claims`;

  const r = await pedirJson(url);

  if (!r.ok) {
    return {
      comprobado: false,
      noConsultado: r.noConsultado,
      motivo: r.motivo || r.error
    };
  }

  const entidad = r.datos?.entities?.[idWikidata];

  const claims = entidad?.claims || {};

  const instanciaDe = (claims.P31 || [])
    .map((c) => c?.mainsnak?.datavalue?.value?.id)
    .filter(Boolean);

  const imagenes = (claims.P18 || [])
    .map((c) => c?.mainsnak?.datavalue?.value)
    .filter(Boolean);

  return {
    comprobado: true,
    esPersona: instanciaDe.includes("Q5"),
    instanciaDe,
    imagenesWikidata: imagenes,
    motivo: instanciaDe.includes("Q5")
      ? "Wikidata la declara instancia de ser humano (P31 = Q5)"
      : `Wikidata no la declara persona (P31 = ${instanciaDe.join(", ") || "sin dato"})`
  };
}


/*
-----------------------------------------------------------
REFUERZO POR CONTEXTO

Los términos discriminantes del Perfil de Referencia deben
aparecer en el extracto de la biografía. No es obligatorio,
pero sube la confianza y distingue homónimos que superasen
las comprobaciones anteriores.
-----------------------------------------------------------
*/

function evaluarContexto(extracto, perfil) {
  const texto = normalizarTexto(extracto);

  if (!texto) {
    return { coincidencias: [], puntos: 0, motivo: "sin extracto que comparar" };
  }

  const terminos = (perfil?.terminosDiscriminantes || [])
    .map((t) => t.termino)
    .filter(Boolean);

  const contexto = [perfil?.contexto?.rol, perfil?.contexto?.pais].filter(Boolean);

  const candidatos = [...new Set([...contexto, ...terminos])];

  const coincidencias = candidatos.filter((c) => texto.includes(normalizarTexto(c)));

  return {
    coincidencias,
    puntos: Math.min(coincidencias.length * 2, 7),
    motivo: coincidencias.length
      ? `el extracto menciona ${coincidencias.slice(0, 4).join(", ")}`
      : "el extracto no menciona ningún término discriminante del objetivo"
  };
}


/*
===========================================================
INTENTO NIVEL 1 — Wikipedia verificada
===========================================================
*/

async function intentarWikipedia(nombre, perfil, traza) {
  const variantes = perfil?.variantes?.nombre || [];

  for (const idioma of IDIOMAS_WIKIPEDIA) {
    const busqueda = await buscarEnWikipedia(nombre, idioma);

    if (!busqueda.ok) {
      traza.push({
        nivel: 1,
        fuente: `wikipedia:${idioma}`,
        resultado: busqueda.noConsultado ? "no_consultado" : "error",
        motivo: busqueda.motivo
      });

      continue;
    }

    if (!busqueda.resultados.length) {
      traza.push({
        nivel: 1,
        fuente: `wikipedia:${idioma}`,
        resultado: "sin_resultados",
        motivo: `ninguna página para "${nombre}"`
      });

      continue;
    }

    /*
      Se examinan los candidatos en orden, aplicando las tres
      comprobaciones. El primero que las pase se acepta; los
      rechazados quedan en la traza con su motivo.
    */
    for (const titulo of busqueda.resultados) {
      /* --- Comprobación A: ¿parece una biografía? --- */
      if (!pareceBiografia(titulo)) {
        traza.push({
          nivel: 1,
          fuente: `wikipedia:${idioma}`,
          candidato: titulo,
          resultado: "rechazado",
          motivo: "el título corresponde a un artículo temático, no a una biografía"
        });

        continue;
      }

      /* --- Comprobación B: ¿el nombre coincide? --- */
      const nombreOk = verificarNombre(nombre, titulo, variantes);

      if (!nombreOk.verificado) {
        traza.push({
          nivel: 1,
          fuente: `wikipedia:${idioma}`,
          candidato: titulo,
          resultado: "rechazado",
          motivo: nombreOk.motivo
        });

        continue;
      }

      const pagina = await obtenerPaginaWikipedia(titulo, idioma);

      if (!pagina.ok) {
        traza.push({
          nivel: 1,
          fuente: `wikipedia:${idioma}`,
          candidato: titulo,
          resultado: "error",
          motivo: pagina.motivo
        });

        continue;
      }

      /* --- Comprobación C: ¿es un ser humano? --- */
      const persona = await verificarEsPersona(pagina.wikidata);

      if (persona.comprobado && !persona.esPersona) {
        traza.push({
          nivel: 1,
          fuente: `wikipedia:${idioma}`,
          candidato: titulo,
          resultado: "rechazado",
          motivo: persona.motivo
        });

        continue;
      }

      if (!pagina.imagen && !pagina.miniatura) {
        traza.push({
          nivel: 1,
          fuente: `wikipedia:${idioma}`,
          candidato: titulo,
          resultado: "verificado_sin_imagen",
          motivo: "la página verifica pero no tiene fotografía",
          wikidata: pagina.wikidata,
          imagenesWikidata: persona.imagenesWikidata || []
        });

        /*
          Verificó pero no hay foto: se guarda la entidad para
          que el nivel 3 pueda intentarlo en Wikidata.
        */
        return {
          encontrado: false,
          verificadoSinImagen: true,
          wikidata: pagina.wikidata,
          titulo: pagina.title,
          idioma
        };
      }

      const contexto = evaluarContexto(pagina.extracto, perfil);

      /*
        --- Comprobación D: HOMÓNIMO CON NOMBRES ADICIONALES ---

        Un título "contenido" tiene tokens extra: puede ser el
        nombre completo del objetivo (Yaku Pérez → Yaku Pérez
        Guartambel) o una persona DISTINTA que comparte todos
        sus tokens (Juan Carlos Vega → Juan Carlos Caballero
        Vega, panameño).

        La verificación de nombre no puede distinguirlos. El
        contexto sí: si el extracto no menciona ni el rol ni el
        país ni un solo término discriminante del objetivo, no
        hay nada que sostenga que sea la misma persona.

        Caso real detectado en la prueba: la página panameña no
        tenía fotografía y el fallo fue inocuo. Con foto habría
        atribuido una cara ajena.
      */
      if (nombreOk.tipo === "contenida" && contexto.coincidencias.length === 0) {
        traza.push({
          nivel: 1,
          fuente: `wikipedia:${idioma}`,
          candidato: titulo,
          resultado: "rechazado",
          motivo: `el título añade ${(nombreOk.tokensAdicionales || []).join(", ")} al nombre buscado y el extracto no menciona ningún término discriminante del objetivo: podría ser un homónimo con nombres adicionales`
        });

        continue;
      }

      /* --- ACEPTADO --- */
      const base = nombreOk.tipo === "exacta" ? 92 : 88;

      const confianza = Math.min(
        97,
        base +
          (persona.esPersona ? 2 : 0) +
          contexto.puntos -
          (idioma === "es" ? 0 : 2)
      );

      traza.push({
        nivel: 1,
        fuente: `wikipedia:${idioma}`,
        candidato: titulo,
        resultado: "aceptado",
        motivo: nombreOk.motivo
      });

      return {
        encontrado: true,
        imageUrl: pagina.imagen || pagina.miniatura,
        miniatura: pagina.miniatura,
        fuente: `Wikipedia (${idioma})`,
        tipoFuente: TIPOS_FUENTE.ENCICLOPEDIA,
        urlFuente: pagina.urlPagina,
        licencia: "Wikimedia Commons — ver la página del archivo",
        confianza,
        verificaciones: [
          { comprobacion: "titulo_biografico", pasa: true },
          {
            comprobacion: "coincidencia_nombre",
            pasa: true,
            tipo: nombreOk.tipo,
            detalle: nombreOk.motivo
          },
          {
            comprobacion: "instancia_de_humano",
            pasa: persona.esPersona === true,
            detalle: persona.motivo
          },
          {
            comprobacion: "contexto_discriminante",
            pasa: contexto.coincidencias.length > 0,
            detalle: contexto.motivo
          },
          {
            comprobacion: "descarte_de_homonimo_con_nombres_adicionales",
            pasa: true,
            detalle:
              nombreOk.tipo === "exacta"
                ? "no aplica: el título coincide exactamente"
                : `el título añade ${(nombreOk.tokensAdicionales || []).join(", ")} y el contexto lo respalda`
          }
        ],
        motivoSeleccion:
          `Fotografía de la página de Wikipedia en ${idioma} «${pagina.titulo}». ` +
          `Verificada: ${nombreOk.motivo}; ${persona.motivo}; ${contexto.motivo}.`,
        wikidata: pagina.wikidata,
        extracto: pagina.extracto.slice(0, 220)
      };
    }
  }

  return { encontrado: false };
}


/*
===========================================================
NIVEL 2 · PERFIL OFICIAL CORROBORADO
===========================================================

Se apoya en el Identity Matcher y el Social Evidence Engine:
una cuenta con correspondencia `probable` sería la mejor
fuente de fotografía... si se pudiera leer.

ESTADO REAL: no se puede. Leer la imagen de perfil de
Facebook, Instagram, TikTok o X exige API oficial, y ninguna
está implementada (Sprint 3.2). Deducir la URL de la foto a
partir del handle sería inventarla.

Así que este nivel NO devuelve imagen: devuelve la
DECLARACIÓN de que existe una fuente mejor que no es
accesible todavía, para que el informe lo diga en lugar de
presentar el respaldo como si no hubiera alternativa.
===========================================================
*/

function intentarPerfilOficial(perfil, social, traza) {
  const cuentas = (social?.fichas || []).filter(
    (f) => f.correspondencia?.estado === "probable"
  );

  if (!cuentas.length) {
    traza.push({
      nivel: 2,
      fuente: "perfil_oficial",
      resultado: "sin_candidatos",
      motivo:
        "el Identity Matcher no halló ninguna cuenta con correspondencia probable"
    });

    return { encontrado: false, candidatos: [] };
  }

  const mejores = cuentas
    .sort(
      (a, b) => b.correspondencia.puntuacion - a.correspondencia.puntuacion
    )
    .slice(0, 3)
    .map((f) => ({
      plataforma: f.plataforma,
      handle: f.handle,
      url: f.url?.canonica || null,
      correspondencia: f.correspondencia.puntuacion,
      etiqueta: f.correspondencia.etiqueta,
      modoAcceso: f.modoAcceso
    }));

  traza.push({
    nivel: 2,
    fuente: "perfil_oficial",
    resultado: "no_accesible",
    motivo: `${mejores.length} cuenta(s) probable(s) identificada(s), pero leer su fotografía de perfil exige la API de la plataforma (Platform Scanner, Sprint 3.2)`,
    candidatos: mejores
  });

  return {
    encontrado: false,
    bloqueadoPorAcceso: true,
    candidatos: mejores
  };
}


/*
===========================================================
NIVEL 3 · FOTOGRAFÍA PÚBLICA DE ALTA CONFIANZA
           (Wikidata P18 → Wikimedia Commons)
===========================================================

Cubre el caso de una entidad con imagen en Wikidata cuya
página de Wikipedia no la muestra, y el de entidades con
Wikidata pero sin artículo.
===========================================================
*/

function urlCommons(nombreArchivo) {
  if (!nombreArchivo) return null;

  /*
    Special:FilePath resuelve el archivo sin necesidad de
    calcular el hash de la ruta de Commons. No se deduce
    ninguna URL: se usa el punto de entrada oficial.
  */
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
    nombreArchivo
  )}?width=512`;
}


async function intentarWikidata(nombre, perfil, idWikidataConocido, traza) {
  let qid = idWikidataConocido || null;

  /* Sin entidad conocida, se busca. */
  if (!qid) {
    const url =
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json` +
      `&search=${encodeURIComponent(nombre)}&language=es&uselang=es&limit=5&type=item`;

    const r = await pedirJson(url);

    if (!r.ok) {
      traza.push({
        nivel: 3,
        fuente: "wikidata",
        resultado: r.noConsultado ? "no_consultado" : "error",
        motivo: r.motivo || r.error
      });

      return { encontrado: false };
    }

    const candidatos = r.datos?.search || [];

    const variantes = perfil?.variantes?.nombre || [];

    const valido = candidatos.find((c) => {
      const v = verificarNombre(nombre, c.label, variantes);

      if (!v.verificado) {
        traza.push({
          nivel: 3,
          fuente: "wikidata",
          candidato: c.label,
          resultado: "rechazado",
          motivo: v.motivo
        });
      }

      return v.verificado;
    });

    if (!valido) {
      traza.push({
        nivel: 3,
        fuente: "wikidata",
        resultado: "sin_coincidencia_verificada",
        motivo: `ninguna de las ${candidatos.length} entidades coincide con el nombre buscado`
      });

      return { encontrado: false };
    }

    qid = valido.id;
  }

  const persona = await verificarEsPersona(qid);

  if (!persona.comprobado) {
    traza.push({
      nivel: 3,
      fuente: "wikidata",
      candidato: qid,
      resultado: persona.noConsultado ? "no_consultado" : "error",
      motivo: persona.motivo
    });

    return { encontrado: false };
  }

  if (!persona.esPersona) {
    traza.push({
      nivel: 3,
      fuente: "wikidata",
      candidato: qid,
      resultado: "rechazado",
      motivo: persona.motivo
    });

    return { encontrado: false };
  }

  const archivo = (persona.imagenesWikidata || [])[0];

  if (!archivo) {
    traza.push({
      nivel: 3,
      fuente: "wikidata",
      candidato: qid,
      resultado: "sin_imagen",
      motivo: "la entidad es una persona verificada pero no tiene imagen (P18)"
    });

    return { encontrado: false };
  }

  traza.push({
    nivel: 3,
    fuente: "wikidata",
    candidato: qid,
    resultado: "aceptado",
    motivo: `imagen P18 «${archivo}»`
  });

  return {
    encontrado: true,
    imageUrl: urlCommons(archivo),
    fuente: "Wikidata / Wikimedia Commons",
    tipoFuente: TIPOS_FUENTE.BASE_CONOCIMIENTO,
    urlFuente: `https://www.wikidata.org/wiki/${qid}`,
    licencia: "Wikimedia Commons — ver la página del archivo",
    confianza: idWikidataConocido ? 85 : 78,
    verificaciones: [
      { comprobacion: "coincidencia_nombre", pasa: true },
      { comprobacion: "instancia_de_humano", pasa: true, detalle: persona.motivo },
      { comprobacion: "imagen_declarada_P18", pasa: true, detalle: archivo }
    ],
    motivoSeleccion:
      `Imagen declarada en Wikidata (P18) para la entidad ${qid}, verificada como persona. ` +
      (idWikidataConocido
        ? "La entidad procede de la página de Wikipedia ya verificada."
        : "La entidad se localizó y verificó por nombre."),
    wikidata: qid
  };
}


/*
===========================================================
NIVEL 4 · RESPALDO GENERADO
===========================================================

NOTA sobre la especificación: el sprint pedía «fallback UI
Avatar». Se usa el generador LOCAL ya existente en
avatarService.js —un SVG con las iniciales— y no el servicio
externo ui-avatars.com, porque el propio código del proyecto
lo prohíbe explícitamente ("Nunca se utiliza
ui-avatars.com"). Se respeta la intención (un avatar
generado) sin contradecir una regla ya establecida ni enviar
el nombre del objetivo a un tercero.
===========================================================
*/

async function respaldoGenerado(nombre, motivo, traza) {
  const local = await avatarLocalDeRespaldo(nombre);

  traza.push({
    nivel: 4,
    fuente: "generado_local",
    resultado: "aplicado",
    motivo
  });

  return {
    encontrado: true,
    imageUrl: local.avatar,
    fuente: "Generado localmente (iniciales)",
    tipoFuente: TIPOS_FUENTE.GENERADO,
    urlFuente: null,
    licencia: "N/A — generado por Sentinel",
    confianza: 0,
    verificaciones: [],
    motivoSeleccion: motivo,
    esRespaldo: true
  };
}


/*
===========================================================
FUNCIÓN PRINCIPAL
===========================================================

  perfil  → Perfil de Referencia (variantes, contexto,
            términos discriminantes)
  social  → salida del Social Intelligence Layer
            (cuentas con correspondencia)
===========================================================
*/

export async function obtenerAvatarInteligente(objetivo, contexto = {}) {
  const inicio = Date.now();

  const perfil = contexto.perfil || null;

  const social = contexto.social || null;

  const nombre = perfil?.nombrePrincipal || String(objetivo ?? "").trim();

  const traza = [];

  if (!nombre) {
    return {
      ...(await respaldoGenerado("", "no se recibió ningún nombre", traza)),
      objetivo: null,
      traza,
      tiempo: "0s"
    };
  }

  /*
    El motor solo busca fotografía de PERSONAS. Para un
    dominio, una IP o un correo no tiene sentido.
  */
  const tipo = perfil?.tipoObjetivo || "desconocido";

  if (tipo !== "persona" && tipo !== "termino" && tipo !== "desconocido") {
    const respaldo = await respaldoGenerado(
      nombre,
      `el objetivo es de tipo "${tipo}", no una persona: no se busca fotografía`,
      traza
    );

    return {
      ...respaldo,
      objetivo: nombre,
      tipoObjetivo: tipo,
      nivelUsado: 4,
      traza,
      tiempo: `${((Date.now() - inicio) / 1000).toFixed(2)}s`
    };
  }

  /*
    ---------------------------------------------------------
    NIVEL 1 · WIKIPEDIA
    ---------------------------------------------------------
  */
  const wiki = await intentarWikipedia(nombre, perfil, traza);

  if (wiki.encontrado) {
    return componer(wiki, 1, nombre, tipo, traza, inicio, null);
  }

  /*
    ---------------------------------------------------------
    NIVEL 2 · PERFIL OFICIAL CORROBORADO
    ---------------------------------------------------------
  */
  const oficial = intentarPerfilOficial(perfil, social, traza);

  /*
    ---------------------------------------------------------
    NIVEL 3 · WIKIDATA / COMMONS

    Si el nivel 1 verificó una página sin foto, se reutiliza
    su entidad: ya está verificada, no hace falta buscarla.
    ---------------------------------------------------------
  */
  const wd = await intentarWikidata(nombre, perfil, wiki.wikidata || null, traza);

  if (wd.encontrado) {
    return componer(wd, 3, nombre, tipo, traza, inicio, oficial);
  }

  /*
    ---------------------------------------------------------
    NIVEL 4 · RESPALDO
    ---------------------------------------------------------
  */
  const rechazos = traza.filter((t) => t.resultado === "rechazado");

  const noConsultados = traza.filter((t) => t.resultado === "no_consultado");

  /*
    DISTINCION OBLIGATORIA

    Si ninguna fuente pudo consultarse, NO se puede afirmar
    que no exista fotografia: no se miro. Decirlo al reves
    seria afirmar un hecho falso.
  */
  const nadaConsultado =
    noConsultados.length > 0 && rechazos.length === 0;

  let motivo = nadaConsultado
    ? `No se pudo consultar ninguna fuente de fotografías (${noConsultados
        .map((t) => `${t.fuente}: ${t.motivo}`)
        .join("; ")}). La ausencia de fotografía NO está comprobada: se usa respaldo por indisponibilidad, no por inexistencia.`
    : "No se encontró ninguna fotografía pública verificable de esta persona.";

  if (rechazos.length) {
    motivo +=
      ` Se descartaron ${rechazos.length} candidata(s) por no superar la verificación de identidad` +
      ` (p. ej.: ${rechazos[0].candidato} — ${rechazos[0].motivo}).`;
  }

  if (oficial.bloqueadoPorAcceso) {
    motivo +=
      ` Existe ${oficial.candidatos.length} cuenta(s) con correspondencia probable, pero su fotografía` +
      ` de perfil no es accesible sin la API de la plataforma.`;
  }

  const respaldo = await respaldoGenerado(nombre, motivo, traza);

  const compuesto = componer(respaldo, 4, nombre, tipo, traza, inicio, oficial);

  compuesto.busquedaCompleta = !nadaConsultado;

  compuesto.motivoRespaldo = nadaConsultado
    ? "indisponibilidad_de_fuentes"
    : "sin_fotografia_verificable";

  compuesto.fuentesNoConsultadas = noConsultados.map((t) => ({
    fuente: t.fuente,
    motivo: t.motivo
  }));

  return compuesto;
}


function componer(resultado, nivel, nombre, tipoObjetivo, traza, inicio, oficial) {
  const nivelConfianza = nivelDe(resultado.confianza || 0);

  /*
    SPRINT 3.2.1 · B1 — el frontend no debe cargar la imagen
    desde Wikimedia. Se calcula la ruta del proxy propio; la
    URL de la fuente se CONSERVA para atribucion y auditoria.
  */
  /*
    Se registra la fotografia como activo del SAG. Devuelve
    assetId, licencia y la ruta por la que el frontend la
    pedira. Si el origen no esta permitido, no se registra y
    la imagen se sirve tal cual (caso del data: URI local).
  */
  const activo =
    resultado.imageUrl && !resultado.esRespaldo
      ? registrarActivo({
          sourceType: TIPOS_ACTIVO.FOTOGRAFIA_PUBLICA,
          sourceUrl: resultado.imageUrl,
          license: resultado.licencia,
          contexto: {
            objetivo: nombre,
            fuente: resultado.fuente,
            nivelAIE: nivel,
            confianza: resultado.confianza
          }
        })
      : { registrado: false };

  const rutaProxy = activo.registrado ? activo.ruta : null;

  return {
    /* ---- CAMPOS EXIGIDOS ---- */

    /*
      `imageUrl` es lo que el frontend debe cargar: la ruta del
      proxy si la imagen es remota, o el data: URI local si es
      un respaldo generado.
    */
    imageUrl: rutaProxy || resultado.imageUrl,

    /*
      La URL original NO se pierde: es la atribucion.
    */
    imageUrlOriginal: resultado.imageUrl,
    servidaPorProxy: Boolean(rutaProxy),
    rutaProxy,

    /*
      FICHA DEL ACTIVO (SAG) — los cinco campos exigidos.
    */
    activo: activo.registrado
      ? {
          assetId: activo.assetId,
          sourceType: activo.sourceType,
          sourceUrl: activo.sourceUrl,
          license: activo.license,
          fetchedAt: activo.fetchedAt,
          cacheStatus: activo.cacheStatus,
          /*
            Fecha de consulta de la FUENTE (Wikipedia/Wikidata),
            distinta de fetchedAt, que es la de la imagen.
          */
          consultadoEn: new Date().toISOString()
        }
      : null,
    fuente: resultado.fuente,
    tipoFuente: resultado.tipoFuente,
    confianza: resultado.confianza,
    motivoSeleccion: resultado.motivoSeleccion,

    /* ---- CONTEXTO DE LA DECISIÓN ---- */
    nivelUsado: nivel,
    nivelConfianza: nivelConfianza.id,
    etiquetaConfianza: nivelConfianza.etiqueta,

    objetivo: nombre,
    tipoObjetivo,

    urlFuente: resultado.urlFuente || null,
    licencia: resultado.licencia || null,
    miniatura: resultado.miniatura || null,
    wikidata: resultado.wikidata || null,
    extracto: resultado.extracto || null,

    verificaciones: resultado.verificaciones || [],

    esRespaldo: resultado.esRespaldo === true,

    /*
      Fuentes mejores que existen pero no son accesibles.
      Declararlas evita presentar el respaldo como si no
      hubiera alternativa.
    */
    fuentesNoAccesibles: oficial?.bloqueadoPorAcceso
      ? {
          nivel: 2,
          motivo:
            "Fotografía de perfil oficial: requiere la API de la plataforma (Platform Scanner, Sprint 3.2).",
          candidatos: oficial.candidatos
        }
      : null,

    /*
      Traza completa: cada candidata examinada y por qué se
      aceptó o se rechazó.
    */
    traza,

    /* ---- GARANTÍAS ---- */
    garantias: {
      imagenDescargada: false,
      soloFuentesPublicas: true,
      urlNoDeducida: true,
      nota:
        "El AIE nunca descarga la imagen ni deduce su URL: devuelve el localizador público que la fuente declara."
    },

    tiempo: `${((Date.now() - inicio) / 1000).toFixed(2)}s`,
    generadoEn: new Date().toISOString()
  };
}


/*
===========================================================
COMPATIBILIDAD

Devuelve la forma que ya consumen `osintEngine` y
`KnowledgeGraph.jsx`: {nombre, tipo, avatar, confianza,
fuente}, con el resultado completo anexado.
===========================================================
*/

/*
===========================================================
ABSOLUTIZAR AVATARES DE UNA RESPUESTA

Recorre la respuesta de investigarObjetivo y convierte las
rutas de proxy relativas en URLs absolutas con el host de la
peticion. Lo llama la capa de rutas, que es la unica que
conoce ese host.

Se mantienen intactos fuente, licencia y confianza: solo
cambia el localizador que el navegador debe pedir.
===========================================================
*/

export function absolutizarAvatares(resultado, req) {
  if (!resultado || typeof resultado !== "object") return resultado;

  const absolutizarUno = (obj) => {
    if (!obj) return;

    const ruta = obj.rutaProxy || obj.inteligencia?.rutaProxy;

    if (!ruta) return;

    const url = absolutizar(ruta, req);

    if (obj.avatar !== undefined) obj.avatar = url;

    if (obj.imageUrl !== undefined) obj.imageUrl = url;
  };

  /* identidad.avatar — lo que consume el grafo. */
  absolutizarUno(resultado.identidad);

  if (resultado.identidad?.inteligencia) {
    absolutizarUno(resultado.identidad.inteligencia);
  }

  /* ficha consolidada. */
  if (resultado.fichaObjetivo) {
    const ruta = resultado.identidad?.inteligencia?.rutaProxy;

    if (ruta) resultado.fichaObjetivo.avatar = absolutizar(ruta, req);
  }

  return resultado;
}


export async function obtenerAvatarCompatible(objetivo, contexto = {}) {
  const resultado = await obtenerAvatarInteligente(objetivo, contexto);

  return {
    nombre: resultado.objetivo,
    tipo: "objetivo",
    avatar: resultado.imageUrl,
    confianza: resultado.confianza,
    fuente: resultado.fuente,

    /* Para que la capa de rutas pueda absolutizar. */
    rutaProxy: resultado.rutaProxy || null,
    imageUrlOriginal: resultado.imageUrlOriginal || null,

    /* Resultado completo, para quien lo necesite. */
    inteligencia: resultado
  };
}
