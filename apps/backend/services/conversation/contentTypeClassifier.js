// apps/backend/services/conversation/contentTypeClassifier.js

import { normalizarTexto } from "../textUtils.js";
import { identificarFuente } from "./mediaRegistry.js";

/*
===========================================================
TIPO DE CONTENIDO — que evidencia forma agenda y cual no
===========================================================

No todo lo que devuelve un buscador es agenda publica. En la
ejecucion real de Cuenca, seis de las cincuenta y cuatro
evidencias eran:

    Wikipedia: «Cuenca (Ecuador)»
    Wikipedia: «Provincia de Azuay»
    ViajandoX: directorio turistico
    iStockPhoto: «5.700+ fotos de stock de Cuenca Azuay»
    Facebook: pagina turistica

Ninguna habla de nada que ocurra. Son DESCRIPCIONES DEL LUGAR,
y agrupadas produjeron el tema «azuay · capital · provincia ·
ciudad».

Otras tres eran boletines automaticos: «Clima hoy en Cuenca:
el pronostico del tiempo para...», publicados a diario por un
generador. Produjeron «clima · pronostico · tiempo · agosto».

CUATRO TIPOS
-----------------------------------------------------------

    agenda        hechos, decisiones, declaraciones, conflicto
    referencia    describe el lugar: enciclopedia, turismo,
                  directorios, bancos de imagenes
    automatizado  boletines recurrentes generados: clima,
                  horoscopo, loteria, tipo de cambio
    promocional   venta, ofertas, publicidad

SOLO `agenda` ENTRA AL CLUSTERING
-----------------------------------------------------------

Los otros tres NO se borran: se conservan como evidencia, se
cuentan y se declaran. Un buscador que devuelve seis fichas
turisticas sobre tu territorio es informacion sobre la
cobertura, no basura. Lo que no puede es formar temas.

POR QUE POR DOMINIO Y PATRON, NO POR TEXTO LIBRE
-----------------------------------------------------------

Misma correccion que el Sprint 2.5 aplico a construirEntidades:
clasificar por texto atribuia hallazgos a la plataforma
equivocada. El dominio es un hecho; el texto es interpretable.
El patron lexico solo se usa para lo automatizado, donde la
forma del titular es muy estable.
===========================================================
*/


export const TIPOS_CONTENIDO = Object.freeze({
  AGENDA: "agenda",
  REFERENCIA: "referencia",
  AUTOMATIZADO: "automatizado",
  PROMOCIONAL: "promocional"
});


/*
-----------------------------------------------------------
DOMINIOS DE REFERENCIA

Describen el lugar. No publican agenda.
-----------------------------------------------------------
*/

const DOMINIOS_REFERENCIA = [
  "wikipedia.org",
  "wikidata.org",
  "wikimedia.org",
  "wikivoyage.org",
  "britannica.com",
  "istockphoto.com",
  "shutterstock.com",
  "gettyimages.com",
  "alamy.com",
  "dreamstime.com",
  "tripadvisor.com",
  "tripadvisor.com.ec",
  "booking.com",
  "airbnb.com",
  "expedia.com",
  "lonelyplanet.com",
  "viajandox.com",
  "ec.viajandox.com",
  "metropolitan-touring.com",
  "happygringo.com",
  "es.happygringo.com",
  "numbeo.com",
  "citypopulation.de",
  "mapcarta.com",
  "geonames.org"
];


/*
  Patrones de contenido generado automaticamente. Se exige que
  el patron aparezca en el TITULAR, no en la descripcion: un
  articulo sobre politica climatica menciona el clima sin ser
  un boletin.
*/
const PATRONES_AUTOMATIZADO = [
  /\bclima\b.*\b(hoy|manana)\b/,
  /\bpronostico del tiempo\b/,
  /\bestado del tiempo\b/,
  /\bhoroscopo\b/,
  /\bloteria\b/,
  /\bresultados de la loteria\b/,
  /\btipo de cambio\b/,
  /\bprecio del (dolar|oro|petroleo)\b/,
  /\bhora exacta\b/,
  /\bcalidad del aire\b.*\b(hoy|ahora)\b/
];


const PATRONES_PROMOCIONAL = [
  /\b(oferta|ofertas|descuento|descuentos|promocion|promociones)\b/,
  /\b(compra|comprar|vender|venta) (ya|ahora|online)\b/,
  /\b\d+\s*%\s*(de\s*)?(descuento|off)\b/,
  /\bfotos? de stock\b/,
  /\bimagenes? libres de derechos\b/,
  /\blibres de derechos\b/
];


function coincideDominio(dominio, lista) {
  if (!dominio) return false;

  return lista.some((d) => dominio === d || dominio.endsWith(`.${d}`));
}


/*
===========================================================
CLASIFICAR UNA EVIDENCIA
===========================================================
*/

export function clasificarTipoContenido(evidencia = {}) {
  const fuente = identificarFuente(evidencia);

  const dominio = fuente.dominio || null;

  const titulo = normalizarTexto(evidencia.titulo || "");

  const texto = normalizarTexto(
    [evidencia.titulo, evidencia.descripcion].filter(Boolean).join(" ")
  );

  /*
    1. PROMOCIONAL antes que referencia: un banco de imagenes es
       las dos cosas, y lo que mejor lo describe es que vende.
  */
  const promo = PATRONES_PROMOCIONAL.find((p) => p.test(texto));

  if (promo) {
    return {
      tipo: TIPOS_CONTENIDO.PROMOCIONAL,
      entraEnTemas: false,
      motivo: `El texto contiene lenguaje promocional (${promo.source}). No es agenda publica.`,
      senal: "patron_lexico"
    };
  }

  /*
    2. AUTOMATIZADO por patron en el TITULAR.
  */
  const auto = PATRONES_AUTOMATIZADO.find((p) => p.test(titulo));

  if (auto) {
    return {
      tipo: TIPOS_CONTENIDO.AUTOMATIZADO,
      entraEnTemas: false,
      motivo:
        "Boletin generado automaticamente y publicado de forma recurrente. Su volumen mide la periodicidad del generador, no la atencion publica.",
      senal: "patron_titular"
    };
  }

  /*
    3. REFERENCIA por dominio.
  */
  if (coincideDominio(dominio, DOMINIOS_REFERENCIA)) {
    return {
      tipo: TIPOS_CONTENIDO.REFERENCIA,
      entraEnTemas: false,
      motivo: `${dominio} describe el lugar (enciclopedia, turismo o banco de imagenes). No publica agenda.`,
      senal: "dominio"
    };
  }

  /*
    4. REFERENCIA por tipo de fuente ya establecido.
  */
  if (fuente.tipo === "enciclopedico") {
    return {
      tipo: TIPOS_CONTENIDO.REFERENCIA,
      entraEnTemas: false,
      motivo: "Fuente enciclopedica: describe el lugar, no lo que ocurre en el.",
      senal: "tipo_fuente"
    };
  }

  return {
    tipo: TIPOS_CONTENIDO.AGENDA,
    entraEnTemas: true,
    motivo: null,
    senal: "por_defecto"
  };
}


/*
===========================================================
CLASIFICAR UN LOTE
===========================================================
*/

export function separarPorTipo(evidencias = []) {
  const lista = Array.isArray(evidencias) ? evidencias : [];

  const porIndice = new Map();

  const conteo = {
    agenda: 0,
    referencia: 0,
    automatizado: 0,
    promocional: 0
  };

  const excluidas = [];

  lista.forEach((e, indice) => {
    const c = clasificarTipoContenido(e);

    porIndice.set(indice, c);

    conteo[c.tipo] += 1;

    if (!c.entraEnTemas) {
      excluidas.push({
        indice,
        titulo: e?.titulo || null,
        dominio: e?.dominio || null,
        tipo: c.tipo,
        motivo: c.motivo
      });
    }
  });

  const indicesAgenda = [...porIndice.entries()]
    .filter(([, c]) => c.entraEnTemas)
    .map(([i]) => i);

  return {
    porIndice,
    indicesAgenda,
    excluidas,
    conteo,

    metricas: {
      total: lista.length,
      agenda: conteo.agenda,
      excluidas: excluidas.length,
      porcentajeAgenda:
        lista.length > 0
          ? Number(((conteo.agenda / lista.length) * 100).toFixed(1))
          : 0
    },

    declaracion:
      excluidas.length > 0
        ? `${excluidas.length} de ${lista.length} evidencias NO forman temas por no ser agenda publica (${conteo.referencia} de referencia, ${conteo.automatizado} automatizadas, ${conteo.promocional} promocionales). Se conservan como evidencia y se cuentan; lo que no hacen es agrupar.`
        : "Todas las evidencias se clasificaron como agenda publica."
  };
}


export default {
  TIPOS_CONTENIDO,
  clasificarTipoContenido,
  separarPorTipo
};
