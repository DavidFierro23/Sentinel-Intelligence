// apps/backend/services/ingest/crossProviderDedup.js

import { similitud, UMBRAL_SIMILITUD } from "../conversation/nearDuplicate.js";
import { extraerDominio } from "../textUtils.js";

/*
===========================================================
DEDUPLICACION MULTIFUENTE — INGEST-REAL-01
===========================================================

La misma nota de El Mercurio puede llegar por Google News, por
el RSS del propio medio, por Brave, por SerpAPI y por GDELT.

ESO NO SON CINCO EVIDENCIAS.

Y no es un detalle de limpieza: si no se deduplica, cada
proveedor que se añada INFLA el corpus sin añadir informacion,
y todas las metricas que dependen del volumen —actividad de un
tema, concentracion de fuentes, cuota por agenda— se mueven por
razones que no tienen nada que ver con el territorio.

Peor aun: el numero de fuentes independientes subiria, porque
cinco proveedores parecerian cinco puntos de vista. Es la
version multifuente del error que ya se midio con YouTube.

CUATRO CRITERIOS, DE MAS FUERTE A MAS DEBIL
-----------------------------------------------------------

  1. URL canonica identica          certeza
  2. URL normalizada identica       certeza practica
  3. mismo dominio + titulo casi
     identico                       muy probable
  4. titulo casi identico en
     dominios distintos             SINDICACION, no duplicado

El cuarto es el que hay que tratar con cuidado. Que El Universo
y Expreso publiquen la misma nota de agencia NO las convierte
en la misma evidencia: son dos medios que decidieron
publicarla, y esa decision es informacion. Se marcan como
`sindicadas` y se CONSERVAN por separado.

Un duplicado es la misma publicacion vista dos veces. Dos
medios publicando lo mismo son dos publicaciones.

LO QUE NUNCA SE PIERDE
-----------------------------------------------------------

`providersSeenBy[]` y `sourceObservations[]`. Cuando cinco
proveedores traen la misma nota, eso no es ruido: es
corroboracion, y es exactamente el dato que el benchmark
necesita para saber que aporta cada proveedor de nuevo.

Borrar los duplicados sin conservar quien los vio dejaria el
benchmark ciego.
===========================================================
*/


export const CRITERIOS = Object.freeze({
  CANONICAL: "url_canonica_identica",
  URL: "url_normalizada_identica",
  DOMINIO_Y_TITULO: "mismo_dominio_y_titulo_casi_identico",
  SINDICACION: "titulo_casi_identico_en_otro_dominio"
});


export const FUERZA_CRITERIO = Object.freeze({
  url_canonica_identica: "certeza",
  url_normalizada_identica: "certeza_practica",
  mismo_dominio_y_titulo_casi_identico: "muy_probable",
  titulo_casi_identico_en_otro_dominio: "sindicacion_no_duplicado"
});


/*
  Umbral deliberadamente mas alto que el de `nearDuplicate`
  (0.8). Alli se agrupan notas parecidas para no repetir un
  tema; aqui se FUNDEN dos registros en uno, y equivocarse
  borra una publicacion real.
*/
export const UMBRAL_TITULO = 0.88;


function claveCanonical(ev) {
  return ev.canonicalUrl || null;
}


function claveUrl(ev) {
  return ev.urlNormalizada || ev.canonicalUrl || ev.url || null;
}


function dominioDe(ev) {
  return ev.sourceId || extraerDominio(ev.canonicalUrl || ev.url || "") || null;
}


function nuevaAgrupada(ev) {
  return {
    ...ev,

    /*
      Quien la vio, cuantas veces y con que consulta. Es lo que
      convierte «llego cinco veces» en corroboracion medible.
    */
    providersSeenBy: ev.providerId ? [ev.providerId] : [],

    sourceObservations: [
      {
        providerId: ev.providerId || null,
        url: ev.url || null,
        query: ev.provenance?.query || null,
        queryType: ev.provenance?.queryType || null,
        observedAt: ev.observedAt || null
      }
    ],

    firstObservedAt: ev.observedAt || null,
    lastObservedAt: ev.observedAt || null,

    duplicadosAbsorbidos: 0,
    criteriosDeFusion: [],

    /* Publicaciones distintas del mismo texto. NO se funden. */
    sindicadaCon: []
  };
}


function absorber(base, ev, criterio) {
  if (ev.providerId && !base.providersSeenBy.includes(ev.providerId)) {
    base.providersSeenBy.push(ev.providerId);
  }

  base.sourceObservations.push({
    providerId: ev.providerId || null,
    url: ev.url || null,
    query: ev.provenance?.query || null,
    queryType: ev.provenance?.queryType || null,
    observedAt: ev.observedAt || null
  });

  if (ev.observedAt) {
    if (!base.firstObservedAt || ev.observedAt < base.firstObservedAt) {
      base.firstObservedAt = ev.observedAt;
    }

    if (!base.lastObservedAt || ev.observedAt > base.lastObservedAt) {
      base.lastObservedAt = ev.observedAt;
    }
  }

  /*
    COMPLETAR SIN PISAR.

    Un proveedor puede traer el publicador y otro la fecha. El
    registro fusionado se queda con lo mejor de cada uno, pero
    NUNCA sobrescribe un valor ya afirmado: el primero que lo
    afirmo tiene su procedencia registrada y pisarlo la
    invalidaria.
  */
  ["publisher", "author", "publishedAt", "language", "canonicalUrl"].forEach((c) => {
    if (!base[c] && ev[c]) {
      base[c] = ev[c];

      base.criteriosDeFusion.push(`«${c}» aportado por ${ev.providerId || "otro proveedor"}`);
    }
  });

  if (!base.snippet && ev.snippet) base.snippet = ev.snippet;

  base.duplicadosAbsorbidos += 1;

  if (!base.criteriosDeFusion.includes(criterio)) {
    base.criteriosDeFusion.push(criterio);
  }

  return base;
}


/*
===========================================================
DEDUPLICAR
===========================================================
*/

export function deduplicarMultifuente(evidencias = [], opciones = {}) {
  const umbralTitulo = opciones.umbralTitulo ?? UMBRAL_TITULO;

  const unicas = [];

  const porCanonical = new Map();

  const porUrl = new Map();

  const traza = [];

  evidencias.forEach((ev) => {
    const cCanon = claveCanonical(ev);

    const cUrl = claveUrl(ev);

    /* --- 1. canonica identica --- */
    if (cCanon && porCanonical.has(cCanon)) {
      const base = porCanonical.get(cCanon);

      absorber(base, ev, CRITERIOS.CANONICAL);

      traza.push({
        evidenceId: ev.evidenceId,
        fusionadaCon: base.evidenceId,
        criterio: CRITERIOS.CANONICAL,
        fuerza: FUERZA_CRITERIO[CRITERIOS.CANONICAL]
      });

      return;
    }

    /* --- 2. url normalizada identica --- */
    if (cUrl && porUrl.has(cUrl)) {
      const base = porUrl.get(cUrl);

      absorber(base, ev, CRITERIOS.URL);

      traza.push({
        evidenceId: ev.evidenceId,
        fusionadaCon: base.evidenceId,
        criterio: CRITERIOS.URL,
        fuerza: FUERZA_CRITERIO[CRITERIOS.URL]
      });

      return;
    }

    /* --- 3 y 4. por titulo --- */
    const dom = dominioDe(ev);

    let fusionada = false;

    for (const base of unicas) {
      if (!ev.title || !base.title) continue;

      const s = similitud(ev.title, base.title);

      if (s < umbralTitulo) continue;

      const mismoDominio = dom && dominioDe(base) === dom;

      if (mismoDominio) {
        absorber(base, ev, CRITERIOS.DOMINIO_Y_TITULO);

        traza.push({
          evidenceId: ev.evidenceId,
          fusionadaCon: base.evidenceId,
          criterio: CRITERIOS.DOMINIO_Y_TITULO,
          fuerza: FUERZA_CRITERIO[CRITERIOS.DOMINIO_Y_TITULO],
          similitudTitulo: Number(s.toFixed(3))
        });

        fusionada = true;

        break;
      }

      /*
        DOMINIOS DISTINTOS: sindicacion, no duplicado.

        Se anotan mutuamente y las DOS se conservan. Que dos
        medios publiquen la misma nota de agencia es
        informacion sobre los dos medios, no ruido.
      */
      base.sindicadaCon.push({
        evidenceId: ev.evidenceId,
        dominio: dom,
        similitudTitulo: Number(s.toFixed(3))
      });

      traza.push({
        evidenceId: ev.evidenceId,
        relacionadaCon: base.evidenceId,
        criterio: CRITERIOS.SINDICACION,
        fuerza: FUERZA_CRITERIO[CRITERIOS.SINDICACION],
        similitudTitulo: Number(s.toFixed(3)),
        nota: "Se CONSERVAN las dos: son dos publicaciones del mismo texto, no la misma publicación vista dos veces."
      });
    }

    if (fusionada) return;

    const nueva = nuevaAgrupada(ev);

    /*
      La sindicacion es simetrica: si esta se anoto en otra,
      la otra tiene que constar en esta.
    */
    unicas.forEach((base) => {
      const enlace = base.sindicadaCon.find((s) => s.evidenceId === ev.evidenceId);

      if (enlace) {
        nueva.sindicadaCon.push({
          evidenceId: base.evidenceId,
          dominio: dominioDe(base),
          similitudTitulo: enlace.similitudTitulo
        });
      }
    });

    unicas.push(nueva);

    if (cCanon) porCanonical.set(cCanon, nueva);

    if (cUrl) porUrl.set(cUrl, nueva);
  });

  const absorbidos = evidencias.length - unicas.length;

  const corroboradas = unicas.filter((u) => u.providersSeenBy.length > 1);

  const porProveedor = {};

  evidencias.forEach((ev) => {
    const p = ev.providerId || "desconocido";

    porProveedor[p] = porProveedor[p] || { brutas: 0, unicas: 0, nuevas: 0 };

    porProveedor[p].brutas += 1;
  });

  unicas.forEach((u) => {
    const primero = u.providersSeenBy[0] || "desconocido";

    if (porProveedor[primero]) porProveedor[primero].unicas += 1;

    /*
      APORTE NUEVO: evidencias que SOLO ese proveedor trajo.
      Es la metrica que justifica añadir un proveedor; el
      volumen bruto no lo justifica.
    */
    if (u.providersSeenBy.length === 1 && porProveedor[primero]) {
      porProveedor[primero].nuevas += 1;
    }
  });

  return {
    unicas,

    metricas: {
      brutas: evidencias.length,
      unicas: unicas.length,
      duplicadosAbsorbidos: absorbidos,

      tasaDuplicado: evidencias.length
        ? Number((absorbidos / evidencias.length).toFixed(3))
        : 0,

      corroboradasPorVariosProveedores: corroboradas.length,

      sindicadas: unicas.filter((u) => u.sindicadaCon.length > 0).length,

      porProveedor
    },

    traza,

    declaraciones: [
      "Una nota traída por cinco proveedores es UNA evidencia corroborada cinco veces, no cinco evidencias.",
      "Dos medios distintos publicando el mismo texto son DOS publicaciones. Se marcan como sindicadas y se conservan por separado: que cada uno decidiera publicarla es información.",
      "`providersSeenBy` y `sourceObservations` no se borran nunca. Sin ellos, el benchmark no puede saber qué aporta cada proveedor de nuevo."
    ]
  };
}


export default {
  CRITERIOS,
  FUERZA_CRITERIO,
  UMBRAL_TITULO,
  deduplicarMultifuente,
  UMBRAL_SIMILITUD
};
