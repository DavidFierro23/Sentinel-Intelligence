// apps/backend/services/media/pieceAmplification.js

import { buscarWeb, crearSesion, resumirSesion } from "../searchProviderLayer.js";

import { normalizarEvidencia } from "../ingest/evidenceContract.js";

import { deduplicarMultifuente } from "../ingest/crossProviderDedup.js";

import { similitud } from "../conversation/nearDuplicate.js";

import { identificarFuente } from "../conversation/mediaRegistry.js";

import { extraerDominio, normalizarUrl } from "../textUtils.js";

import { ROLES_PIEZA, EXPLICACION_ROLES, CLASES_EMISOR } from "./pieceContracts.js";

import { clasificarEmisor, detectarPlataforma } from "./pieceResolver.js";

/*
===========================================================
AMPLIFICACION DE UNA PIEZA — MEDIA-PIECE-01 §6 §7 §8
===========================================================

Busca quien mas publico sobre lo mismo, deduplica, y decide
que papel juega cada pieza encontrada frente a la analizada.

EL LIMITE DE CONSULTAS ES PARTE DEL DISENO
-----------------------------------------------------------

§6 prohibe consultas masivas, y hay una razon medida detras:
el raspado de DuckDuckGo se corta tras una o dos consultas
seguidas y puede dejar el host bloqueado mas de diez minutos.
Una rafaga no solo gasta cuota: inutiliza el motor para el
resto de la sesion.

Por eso `MAX_CONSULTAS` es 4 por defecto y las consultas van
ORDENADAS POR VALOR: si la primera ya responde, las demas
puede que no hagan falta. La sesion de `searchProviderLayer`
respeta el intervalo entre llamadas por si sola.

TRES UNIDADES, TRES CUENTAS
-----------------------------------------------------------

    PIEZAS      documentos distintos (post-dedup)
    FUENTES     dominios distintos que los publican
    CONTENIDOS  grupos de casi-duplicados = hechos distintos

Quince piezas de diez dominios sobre un hecho son 15 / 10 / 1.
La UI recibe los tres numeros y la frase que los explica, para
que nadie escriba "15 noticias independientes".

POR QUE COBERTURA_RELACIONADA ES EL VALOR POR DEFECTO
-----------------------------------------------------------

Que B publique despues de A no prueba que B copiara a A. Puede
que ambos recibieran el mismo boletin, o que el hecho fuera
publico. Afirmar copia exige evidencia de la copia: un enlace,
una cita literal o un texto casi identico. Sin eso, el rol es
COBERTURA_RELACIONADA y se dice por que.
===========================================================
*/


export const MAX_CONSULTAS = 4;

/* Similitud de titular por encima de la cual se habla de replica. */
export const UMBRAL_REPLICA = 0.82;

/* Longitud minima de una frase para servir como huella de busqueda. */
const MIN_FRASE = 40;


/*
-----------------------------------------------------------
CONSTRUIR LAS CONSULTAS

Ordenadas de mas especifica a mas general. Cada una declara
que busca, para que el informe pueda explicar de donde salio
cada hallazgo.

La consulta por URL va primera porque es la unica que
encuentra CITAS con certeza: quien enlaza la pieza la esta
citando.
-----------------------------------------------------------
*/
export function construirConsultas(pieza, opciones = {}) {
  const consultas = [];

  const canon = pieza?.canonicalUrl || pieza?.url || null;

  if (canon) {
    /* Sin protocolo: los buscadores indexan el texto del enlace. */
    const desnuda = canon.replace(/^https?:\/\//i, "").replace(/\/$/, "");

    consultas.push({
      id: "url_citada",
      texto: `"${desnuda}"`,
      busca: "piezas que enlazan o mencionan la URL de la pieza",
      esperaRol: ROLES_PIEZA.CITA
    });
  }

  const titulo = String(pieza?.titulo || "").trim();

  if (titulo.length >= 12) {
    consultas.push({
      id: "titular_exacto",
      texto: `"${titulo}"`,
      busca: "piezas que reproducen el titular literal",
      esperaRol: ROLES_PIEZA.REPLICA
    });
  }

  /*
    Frase distintiva: el fragmento mas largo del extracto. Una
    frase larga y literal es la mejor huella de una replica y la
    peor de una coincidencia casual.
  */
  const frase = fraseDistintiva(pieza?.snippet);

  if (frase) {
    consultas.push({
      id: "frase_distintiva",
      texto: `"${frase}"`,
      busca: "piezas que reproducen una frase literal del cuerpo",
      esperaRol: ROLES_PIEZA.REPLICA
    });
  }

  /*
    El hecho, sin comillas: aqui aparecen las coberturas
    relacionadas, que son la mayoria y las mas informativas
    para medir difusion real.
  */
  const terminos = (opciones.terminosDelHecho || []).filter(Boolean);

  const base = terminos.length ? terminos.join(" ") : titulo;

  if (base) {
    const autor = pieza?.autor ? ` ${pieza.autor}` : "";

    consultas.push({
      id: "hecho_relacionado",
      texto: `${base}${autor}`.trim().slice(0, 220),
      busca: "otras piezas sobre el mismo hecho, sin exigir texto literal",
      esperaRol: ROLES_PIEZA.COBERTURA_RELACIONADA
    });
  }

  if (opciones.nombreCandidato && titulo) {
    consultas.push({
      id: "candidato_y_hecho",
      texto: `"${opciones.nombreCandidato}" ${titulo}`.slice(0, 220),
      busca: "piezas que conectan al candidato con este hecho",
      esperaRol: ROLES_PIEZA.COBERTURA_RELACIONADA
    });
  }

  const max = opciones.maxConsultas ?? MAX_CONSULTAS;

  return {
    consultas: consultas.slice(0, max),
    descartadas: consultas.slice(max).map((c) => ({
      ...c,
      motivo: `Limite de ${max} consultas por analisis: se prioriza no bloquear el motor de busqueda.`
    }))
  };
}


function fraseDistintiva(snippet) {
  const t = String(snippet || "").trim();

  if (t.length < MIN_FRASE) return null;

  const partes = t
    .split(/[.;!?\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= MIN_FRASE);

  if (!partes.length) return t.slice(0, 120);

  return partes.sort((a, b) => b.length - a.length)[0].slice(0, 120);
}


/*
===========================================================
EJECUTAR LA BUSQUEDA

Una sesion compartida para las cuatro consultas: asi el
control de presupuesto e intervalo de `searchProviderLayer`
funciona como esta disenado.
===========================================================
*/
export async function buscarAmplificacion(pieza, opciones = {}) {
  const { consultas, descartadas } = construirConsultas(pieza, opciones);

  const sesion = opciones.sesion || crearSesion({ tipo: "web" });

  const observedAt = opciones.observedAt || new Date().toISOString();

  const ejecutadas = [];

  const brutas = [];

  for (const c of consultas) {
    const r = await buscarWeb(c.texto, {
      sesion,
      fetch: opciones.fetch
    });

    ejecutadas.push({
      consultaId: c.id,
      texto: c.texto,
      busca: c.busca,
      estado: r.estado,
      proveedor: r.proveedorUsado?.id || null,
      resultados: r.total || 0,
      coberturaParcial: r.coberturaParcial === true,
      advertencias: r.advertencias || [],
      tiempo: r.tiempo
    });

    (r.resultados || []).forEach((res) => {
      const ev = normalizarEvidencia(
        {
          url: res.enlace || res.url || null,
          title: res.titulo || res.title || null,
          snippet: res.descripcion || res.snippet || null,
          publishedAt: res.fecha || null,
          platform: res.plataforma || null
        },
        {
          providerId: res.motorId || r.proveedorUsado?.id || null,
          query: c.texto,
          queryType: c.id,
          queryLabel: c.busca,
          observedAt
        }
      );

      brutas.push(ev);
    });

    /*
      Si el motor quedo bloqueado no se insiste: seguir gastaria
      el resto de las consultas contra un motor caido y podria
      extender el bloqueo.
    */
    if (r.estado === "BLOQUEADO") {
      descartadas.push(
        ...consultas
          .slice(consultas.indexOf(c) + 1)
          .map((p) => ({
            ...p,
            motivo:
              "No se ejecuto: el proveedor web quedo BLOQUEADO en una consulta anterior. Insistir prolongaria el bloqueo."
          }))
      );

      break;
    }
  }

  /* La pieza analizada no puede aparecer como su propia replica. */
  const canonPieza = normalizarUrl(pieza?.canonicalUrl || pieza?.url || "");

  const ajenas = brutas.filter(
    (e) => normalizarUrl(e.canonicalUrl || e.url || "") !== canonPieza
  );

  const dedup = deduplicarMultifuente(ajenas);

  return {
    consultasEjecutadas: ejecutadas,
    consultasDescartadas: descartadas,
    evidenciasBrutas: brutas.length,
    evidenciasPropias: brutas.length - ajenas.length,
    piezas: dedup.unicas,
    metricasDedup: dedup.metricas,
    trazaDedup: dedup.traza,
    sesion,
    resumenProveedores: resumirSesion(sesion)
  };
}


/*
===========================================================
ROL DE CADA PIEZA — §8
===========================================================

Orden de decision, de la evidencia mas fuerte a la mas debil:

  1. la pieza enlaza la URL analizada  -> CITA (hay prueba)
  2. titular casi identico             -> REPLICA
  3. hay fechas y la ajena es anterior -> ORIGINAL (de la ajena)
  4. hay algo en comun pero sin prueba -> COBERTURA_RELACIONADA
  5. sin fecha ni texto utilizable     -> NO_DETERMINADO
===========================================================
*/
export function asignarRol(piezaAnalizada, ajena, opciones = {}) {
  const razones = [];

  const canonPieza = String(
    piezaAnalizada?.canonicalUrl || piezaAnalizada?.url || ""
  ).replace(/^https?:\/\//i, "").replace(/\/$/, "");

  const textoAjena = `${ajena?.title || ""} ${ajena?.snippet || ""}`;

  /* --- 1. CITA: la prueba mas fuerte que se puede tener --- */
  if (canonPieza && textoAjena.includes(canonPieza)) {
    razones.push(
      "El texto de la pieza encontrada contiene la URL de la pieza analizada: la esta citando."
    );

    return {
      rol: ROLES_PIEZA.CITA,
      razones,
      explicacion: EXPLICACION_ROLES.CITA,
      similitudTitular: null
    };
  }

  /* --- 2. REPLICA: titular practicamente igual --- */
  const sim =
    piezaAnalizada?.titulo && ajena?.title
      ? similitud(piezaAnalizada.titulo, ajena.title)
      : null;

  if (sim != null && sim >= (opciones.umbralReplica ?? UMBRAL_REPLICA)) {
    razones.push(
      `El titular coincide en un ${(sim * 100).toFixed(0)} % con el de la pieza analizada (umbral ${(
        (opciones.umbralReplica ?? UMBRAL_REPLICA) * 100
      ).toFixed(0)} %).`
    );

    return {
      rol: ROLES_PIEZA.REPLICA,
      razones,
      explicacion: EXPLICACION_ROLES.REPLICA,
      similitudTitular: Number(sim.toFixed(3))
    };
  }

  /* --- 3. ORIGINAL: solo si hay dos fechas comparables --- */
  const fA = fecha(piezaAnalizada?.publishedAt);

  const fB = fecha(ajena?.publishedAt);

  if (fA && fB && fB < fA && sim != null && sim >= 0.5) {
    razones.push(
      `La pieza encontrada es anterior (${fB.toISOString().slice(0, 10)} frente a ${fA
        .toISOString()
        .slice(0, 10)}) y su titular se parece un ${(sim * 100).toFixed(0)} %.`
    );

    razones.push(
      "ORIGINAL significa la mas antigua OBSERVADA en esta ventana, no la primera que existio."
    );

    return {
      rol: ROLES_PIEZA.ORIGINAL,
      razones,
      explicacion: EXPLICACION_ROLES.ORIGINAL,
      similitudTitular: Number(sim.toFixed(3))
    };
  }

  /* --- 5. NO_DETERMINADO: no hay con que decidir --- */
  if (!ajena?.title && !ajena?.snippet) {
    razones.push(
      "La pieza encontrada no trae titulo ni extracto: no hay texto con el que compararla."
    );

    return {
      rol: ROLES_PIEZA.NO_DETERMINADO,
      razones,
      explicacion: EXPLICACION_ROLES.NO_DETERMINADO,
      similitudTitular: null
    };
  }

  /* --- 4. COBERTURA_RELACIONADA: el defecto honesto --- */
  razones.push(
    "Habla del mismo asunto, pero no enlaza la pieza analizada ni reproduce su titular."
  );

  if (!fA || !fB) {
    razones.push(
      "Falta al menos una fecha de publicacion: no se puede establecer el orden temporal."
    );
  } else {
    razones.push(
      "El orden temporal por si solo no prueba que una derive de la otra."
    );
  }

  return {
    rol: ROLES_PIEZA.COBERTURA_RELACIONADA,
    razones,
    explicacion: EXPLICACION_ROLES.COBERTURA_RELACIONADA,
    similitudTitular: sim != null ? Number(sim.toFixed(3)) : null
  };
}


function fecha(v) {
  if (!v) return null;

  const d = new Date(v);

  return Number.isNaN(d.getTime()) ? null : d;
}


/*
===========================================================
MAPA DE AMPLIFICACION — §7 §8
===========================================================

Convierte la lista deduplicada en el mapa que consume la UI:
piezas con su rol y su emisor, y las TRES cuentas separadas.
===========================================================
*/
export function construirMapa(piezaAnalizada, encontradas = [], opciones = {}) {
  const ventana = opciones.ventanaObservada || {
    desde: null,
    hasta: opciones.observedAt || new Date().toISOString(),
    nota: "Ventana no acotada: se observo lo que los buscadores indexan hoy."
  };

  const nodos = encontradas.map((ev) => {
    const url = ev.canonicalUrl || ev.url;

    const plat = detectarPlataforma(url);

    const emisor = clasificarEmisor({
      url,
      plataforma: plat.plataforma,
      cuentaEnUrl: plat.cuentaEnUrl,
      autorDeclarado: ev.author || null
    });

    const r = asignarRol(piezaAnalizada, ev, opciones);

    return {
      pieceId: ev.evidenceId,
      evidenceId: ev.evidenceId,
      url: ev.url,
      canonicalUrl: ev.canonicalUrl,
      dominio: extraerDominio(url),
      titulo: ev.title || null,
      snippet: ev.snippet || null,
      publishedAt: ev.publishedAt || null,
      plataforma: plat.plataforma,

      emisor: {
        clase: emisor.clase,
        nombre: emisor.nombre,
        procedencia: emisor.procedencia,
        razones: emisor.razones
      },

      rol: r.rol,
      rolRazones: r.razones,
      rolExplicacion: r.explicacion,
      similitudTitular: r.similitudTitular,
      ventanaObservada: ventana,

      providersSeenBy: ev.providersSeenBy || [ev.providerId].filter(Boolean),
      consultaOrigen: ev.provenance?.queryType || null
    };
  });

  /*
    ---------------------------------------------------------
    LAS TRES CUENTAS

    CONTENIDOS se cuenta agrupando por casi-duplicado sobre el
    conjunto (pieza analizada incluida): un grupo = un hecho.
    ---------------------------------------------------------
  */
  const dominios = new Set(nodos.map((n) => n.dominio).filter(Boolean));

  const grupos = agruparPorContenido([piezaAnalizada, ...nodos]);

  const porRol = {};

  nodos.forEach((n) => {
    porRol[n.rol] = (porRol[n.rol] || 0) + 1;
  });

  const porClase = {};

  nodos.forEach((n) => {
    porClase[n.emisor.clase] = (porClase[n.emisor.clase] || 0) + 1;
  });

  const piezasTotales = nodos.length + 1; /* + la analizada */

  return {
    ventanaObservada: ventana,

    nodos,

    conteo: {
      piezas: piezasTotales,
      fuentes: dominios.size + 1,
      contenidos: grupos.length,

      /*
        La frase que impide la lectura equivocada. La UI la
        muestra literalmente.
      */
      lectura: `${piezasTotales} PIEZAS · ${dominios.size + 1} FUENTES · ${
        grupos.length
      } CONTENIDO${grupos.length === 1 ? "" : "S"} AMPLIFICADO${
        grupos.length === 1 ? "" : "S"
      }`,

      advertencia:
        "No son piezas independientes: varias pueden reproducir el mismo contenido. Piezas, fuentes y contenidos son tres magnitudes distintas y no se suman entre si."
    },

    porRol,
    porClaseDeEmisor: porClase,

    medios: nodos.filter((n) => n.emisor.clase === CLASES_EMISOR.MEDIO).length,
    creadores: nodos.filter((n) => n.emisor.clase === CLASES_EMISOR.CREADOR).length,
    periodistas: nodos.filter((n) => n.emisor.clase === CLASES_EMISOR.PERIODISTA)
      .length,

    gruposDeContenido: grupos
  };
}


/*
  Agrupacion por contenido: dos piezas cuyo titular se parece
  por encima del umbral hablan del mismo hecho. Es la misma
  heuristica que usa `nearDuplicate` en el Topic Engine, para
  que el numero de "hechos" no dependa de quien lo calcula.
*/
function agruparPorContenido(items) {
  const grupos = [];

  items.forEach((it) => {
    const t = it?.titulo || it?.title || null;

    if (!t) {
      grupos.push({ representante: it, miembros: [it], sinTitulo: true });
      return;
    }

    const g = grupos.find((x) => {
      const tr = x.representante?.titulo || x.representante?.title;

      return tr && similitud(tr, t) >= 0.72;
    });

    if (g) g.miembros.push(it);
    else grupos.push({ representante: it, miembros: [it], sinTitulo: false });
  });

  return grupos.map((g, i) => ({
    contenidoId: `cont-${i + 1}`,
    titularRepresentante: g.representante?.titulo || g.representante?.title || null,
    piezas: g.miembros.length,
    fuentes: new Set(
      g.miembros.map((m) => m.dominio || extraerDominio(m.canonicalUrl || m.url))
    ).size,
    evidenceIds: g.miembros.map((m) => m.evidenceId).filter(Boolean)
  }));
}


/*
===========================================================
FALLBACK WEB PARA UNA PIEZA BLOQUEADA — MEDIA-PIECE-02 §D
===========================================================

Cuando la plataforma no entrega la metadata (muro de Facebook,
X sin credencial), un buscador puede tener la URL indexada y
darnos su titular y su emisor.

LA DISTINCION QUE NO SE PUEDE PERDER
-----------------------------------------------------------

    snippet de buscador  ≠  contenido de la publicacion
    replica              ≠  metrica de la original

Lo que devuelve esta funcion NO es el texto de la publicacion:
es lo que un tercero indexo sobre ella, en un momento que
puede no ser hoy. Por eso:

  · cada campo sale con `procedencia: snippet_de_buscador`
  · se marca `esContenidoOriginal: false`
  · NUNCA rellena una metrica: un contador no se lee de un
    snippet, y si apareciera en uno seria una cifra sin fecha
    de observacion ni fuente responsable

UNA SOLA CONSULTA
-----------------------------------------------------------

Se busca la URL exacta. Si el buscador no la tiene indexada, se
acepta y se declara: insistir con variantes gastaria el
presupuesto del dia para adivinar.
===========================================================
*/
export async function fallbackWebDePieza(pieza, opciones = {}) {
  const canon = pieza?.canonicalUrl || pieza?.url || null;

  if (!canon) {
    return {
      encontrado: false,
      motivo: "La pieza no tiene URL utilizable.",
      consultas: 0
    };
  }

  const desnuda = canon.replace(/^https?:\/\//i, "").replace(/\/$/, "");

  const sesion = opciones.sesion || crearSesion({ tipo: "web" });

  const r = await buscarWeb(`"${desnuda}"`, {
    sesion,
    fetch: opciones.fetch
  });

  const propio = (r.resultados || []).find((res) => {
    const u = normalizarUrl(res.enlace || res.url || "");

    return u && u === normalizarUrl(canon);
  });

  if (!propio) {
    return {
      encontrado: false,

      motivo:
        r.estado === "BLOQUEADO"
          ? "El proveedor web quedo bloqueado: no se pudo comprobar si la URL esta indexada."
          : (r.total || 0) === 0
            ? "Ningun buscador tiene esta URL indexada todavia. Es lo habitual en una publicacion reciente."
            : "Los buscadores devolvieron resultados, pero ninguno es la URL exacta de la pieza.",

      estado: r.estado,
      proveedor: r.proveedorUsado?.id || null,
      resultados: r.total || 0,
      consultas: 1,
      sesion
    };
  }

  const titulo = (propio.titulo || propio.title || "").trim() || null;

  const snippet = (propio.descripcion || propio.snippet || "").trim() || null;

  return {
    encontrado: true,

    campos: {
      titulo: titulo
        ? {
            valor: titulo,
            procedencia: "snippet_de_buscador",
            proveedor: propio.motorId || r.proveedorUsado?.id || null,
            esContenidoOriginal: false
          }
        : null,

      texto: snippet
        ? {
            valor: snippet,
            procedencia: "snippet_de_buscador",
            proveedor: propio.motorId || r.proveedorUsado?.id || null,
            esContenidoOriginal: false
          }
        : null,

      fecha: propio.fecha
        ? {
            valor: propio.fecha,
            procedencia: "snippet_de_buscador",
            proveedor: propio.motorId || r.proveedorUsado?.id || null,
            esContenidoOriginal: false,

            cautela:
              "La fecha que declara un buscador es cuando lo indexo o lo estimo, NO necesariamente cuando se publico."
          }
        : null
    },

    estado: r.estado,
    proveedor: r.proveedorUsado?.id || null,
    consultas: 1,
    sesion,

    advertencia:
      "Estos campos provienen del snippet de un buscador, no de la publicacion. Un snippet no es el contenido original y no habilita ninguna metrica.",

    noAporta: [
      "Ninguna metrica: views, likes, comentarios y compartidos siguen sin resolver.",
      "Ninguna certeza sobre el autor real: el titular indexado puede no nombrarlo."
    ]
  };
}


export default {
  MAX_CONSULTAS,
  UMBRAL_REPLICA,
  construirConsultas,
  buscarAmplificacion,
  asignarRol,
  construirMapa,
  fallbackWebDePieza
};
