// apps/backend/services/social/identity/signals/officialLinkSignal.js

import { normalizarTexto, extraerDominio } from "../../../textUtils.js";
import { senalPorId } from "../../socialContracts.js";

/*
===========================================================
SEÑAL S6 — ENLACES OFICIALES
===========================================================

La señal más fuerte disponible en el Sprint 3.1.

Comprueba si la cuenta está RESPALDADA por una fuente ya
asociada al objetivo. Dos formas, ambas medibles sin leer
el perfil:

  a) La cuenta fue descubierta A TRAVÉS de un dominio que el
     Perfil de Referencia ya asocia al objetivo (Wikipedia,
     un medio, un sitio institucional). Alguien que ya habla
     del objetivo enlaza esa cuenta.

  b) La cuenta fue corroborada por VARIOS proveedores de
     búsqueda independientes: no es un resultado aislado.

NO puede ser contraseñal: la falta de enlace externo no dice
nada en contra.

LÍMITE HONESTO: sin Platform Scanner no se puede leer el
campo "sitio web" del perfil, que sería la comprobación
recíproca más fuerte. Se declara en la explicación.
===========================================================
*/

const DEFINICION = senalPorId("S6");

/*
  Dominios que, si respaldan una cuenta, valen más: son
  fuentes de referencia o institucionales.
*/
const DOMINIOS_DE_ALTA_AUTORIDAD = [
  "wikipedia.org",
  "wikidata.org",
  "britannica.com",
  ".gob.ec",
  ".gov",
  ".gob.",
  ".edu"
];

/*
  Dominios de buscador o agregador: NO son respaldo. Que
  Google News enlace algo no dice nada sobre su titularidad.
*/
const DOMINIOS_NO_RESPALDO = [
  "google.com",
  "news.google.com",
  "duckduckgo.com",
  "bing.com",
  "search.brave.com",
  "webcache.googleusercontent.com",
  "web.archive.org",
  "archive.org"
];


function esNoRespaldo(dominio) {
  if (!dominio) return true;

  return DOMINIOS_NO_RESPALDO.some(
    (d) => dominio === d || dominio.endsWith(d)
  );
}


function autoridadDe(dominio) {
  if (!dominio) return "baja";

  return DOMINIOS_DE_ALTA_AUTORIDAD.some((d) => dominio.includes(d))
    ? "alta"
    : "media";
}


export function evaluarS6(candidato, perfil) {
  const base = {
    id: "S6",
    nombre: DEFINICION.nombre,
    esContrasenal: false,
    pesoMaximo: DEFINICION.pesoMaximo
  };

  /*
    Dominios que el Perfil de Referencia asocia al objetivo.
  */
  const dominiosDelPerfil = new Set(
    (perfil?.dominiosRelevantes || [])
      .map((d) => normalizarTexto(d.valor))
      .filter((d) => d && !esNoRespaldo(d))
  );

  const razones = [];

  let puntos = 0;

  /*
    ---------------------------------------------------------
    a) RESPALDO POR DOMINIO ASOCIADO AL OBJETIVO

    La cuenta llegó por una evidencia cuya página pertenece a
    un dominio que ya habla del objetivo.
    ---------------------------------------------------------
  */
  const dominiosRespaldo = new Set();

  (candidato.origenes || []).forEach((origen) => {
    /*
      En la vía `evidencia_fusion` el proveedor es el motor;
      lo que interesa es si la consulta acotaba un dominio
      del perfil (`site:dominio`) o si el hallazgo procede de
      uno.
    */
    const consulta = normalizarTexto(origen.consulta || "");

    const coincidencia = consulta.match(/site:([\w.-]+)/);

    if (coincidencia) {
      const dominio = coincidencia[1];

      if (dominiosDelPerfil.has(dominio) && !esNoRespaldo(dominio)) {
        dominiosRespaldo.add(dominio);
      }
    }
  });

  /*
    Respaldo declarado explícitamente por el llamador: las
    evidencias del Fusion Engine que mencionan esta cuenta y
    cuyo dominio pertenece al perfil.
  */
  (candidato.dominiosQueLaMencionan || []).forEach((d) => {
    const dominio = normalizarTexto(d);

    if (dominiosDelPerfil.has(dominio) && !esNoRespaldo(dominio)) {
      dominiosRespaldo.add(dominio);
    }
  });

  if (dominiosRespaldo.size) {
    const listado = [...dominiosRespaldo];

    const conAlta = listado.filter((d) => autoridadDe(d) === "alta");

    const ganados = conAlta.length
      ? Math.round(DEFINICION.pesoMaximo * 0.8)
      : Math.round(DEFINICION.pesoMaximo * 0.55);

    puntos += ganados;

    razones.push({
      motivo: "respaldo_por_dominio",
      puntos: ganados,
      detalle: `Referida desde ${listado.length} dominio(s) ya asociado(s) al objetivo: ${listado.join(", ")}${
        conAlta.length ? ` (incluye fuente de referencia: ${conAlta.join(", ")})` : ""
      }.`
    });
  }

  /*
    ---------------------------------------------------------
    b) CORROBORACIÓN MULTI-PROVEEDOR

    Varios buscadores independientes devolvieron esta misma
    cuenta. No es prueba de titularidad, pero descarta el
    resultado aislado o accidental.
    ---------------------------------------------------------
  */
  const proveedores = (candidato.proveedores || []).filter(Boolean);

  const proveedoresUnicos = [...new Set(proveedores.map((p) => normalizarTexto(p)))];

  if (proveedoresUnicos.length >= 2) {
    const ganados = Math.min(
      Math.round(DEFINICION.pesoMaximo * 0.35),
      DEFINICION.pesoMaximo - puntos
    );

    if (ganados > 0) {
      puntos += ganados;

      razones.push({
        motivo: "corroboracion_multiproveedor",
        puntos: ganados,
        detalle: `Devuelta por ${proveedoresUnicos.length} proveedores independientes: ${proveedores.join(", ")}.`
      });
    }
  }

  /*
    ---------------------------------------------------------
    c) DESCUBRIMIENTO POR VÍAS INDEPENDIENTES

    Aparecer por vías distintas refuerza el hallazgo, pero
    solo si son REALMENTE independientes.

    `handle_observado` y `evidencia_fusion` derivan del mismo
    conjunto de evidencias: la primera es el handle que el
    Perfil de Referencia extrajo de la segunda. Contarlas
    como dos vías daría un bono a todos los candidatos por
    igual, que es lo contrario de una señal discriminante.

    Se exige por tanto que al menos una vía aporte
    información nueva: una consulta dirigida.
  */
  const vias = (candidato.vias || []).filter(Boolean);

  const VIAS_DERIVADAS = new Set(["handle_observado", "evidencia_fusion"]);

  const viasIndependientes = vias.filter((v) => !VIAS_DERIVADAS.has(v));

  if (vias.length >= 2 && viasIndependientes.length >= 1) {
    const ganados = Math.min(
      Math.round(DEFINICION.pesoMaximo * 0.2),
      DEFINICION.pesoMaximo - puntos
    );

    if (ganados > 0) {
      puntos += ganados;

      razones.push({
        motivo: "vias_independientes",
        puntos: ganados,
        detalle: `Descubierta por ${vias.length} vías, de las cuales ${viasIndependientes.length} aporta(n) información nueva: ${viasIndependientes.join(", ")}.`
      });
    }
  }

  puntos = Math.min(puntos, DEFINICION.pesoMaximo);

  if (!puntos) {
    return {
      ...base,
      activa: false,
      puntos: 0,
      detalle:
        "Ningún dominio asociado al objetivo respalda esta cuenta, y solo un proveedor la devolvió.",
      limitacion:
        "Sin Platform Scanner no se puede leer el campo «sitio web» del perfil, que sería la comprobación recíproca más fuerte.",
      razones: [],
      evidencias: []
    };
  }

  return {
    ...base,
    activa: true,
    puntos,
    detalle: razones.map((r) => r.detalle).join(" "),
    limitacion:
      "Respaldo indirecto: sin Platform Scanner no se comprueba el enlace recíproco desde el perfil.",
    razones,
    evidencias: [...dominiosRespaldo, ...proveedoresUnicos].slice(0, 5)
  };
}
