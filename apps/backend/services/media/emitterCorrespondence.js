// apps/backend/services/media/emitterCorrespondence.js

import { catalogoMedios, TIPOS_FUENTE } from "../conversation/mediaRegistry.js";

import { normalizarTexto } from "../textUtils.js";

/*
===========================================================
CORRESPONDENCIA ENTRE UNA CUENTA Y EL CATALOGO DE MEDIOS
MEDIA-REAL-DEMO-01 §6
===========================================================

EL PROBLEMA REAL
-----------------------------------------------------------

El catalogo de medios conoce `radiotomebamba.com.ec` como
«Radio Tomebamba», medio local. Y una pieza puede llegar desde
`x.com/tomebamba`.

Son, casi con seguridad, el mismo emisor. Pero el catalogo
indexa por DOMINIO WEB y una cuenta de X no tiene ese dominio,
asi que la clasificacion se pierde: el emisor queda sin
clasificar aunque el catalogo tenga la respuesta a un paso.

POR QUE NO SE RESUELVE AUTOMATICAMENTE
-----------------------------------------------------------

Porque «tomebamba» pareciendose a «Radio Tomebamba» es una
CORRESPONDENCIA, no una identidad. Puede haber cuentas de
parodia, homonimos, cuentas de exempleados o de programas
distintos del mismo grupo.

La doctrina del proyecto ya resolvio esta discusion en el modulo
OSINT: los handles se marcan `observado_no_verificado` y el
resultado se expresa como CORRESPONDENCIA explicando por que.
Aqui se aplica igual.

QUE HACE ESTE FICHERO Y QUE NO HACE
-----------------------------------------------------------

    SI  propone candidatos del catalogo con su motivo
    SI  puntua la fuerza de la correspondencia
    NO  cambia la clase del emisor
    NO  afirma que la cuenta pertenezca al medio

La clase solo cambia si un analista confirma. Hasta entonces el
emisor sigue NO_CLASIFICADO y la correspondencia viaja al lado,
visible, para que la persona decida en un clic.
===========================================================
*/


function catalogoSeguro() {
  try {
    const c = catalogoMedios();

    return Array.isArray(c) ? c : c?.medios || [];
  } catch {
    return [];
  }
}


export const ESTADOS_CORRESPONDENCIA = Object.freeze({
  OBSERVADA_NO_VERIFICADA: "OBSERVADA_NO_VERIFICADA",
  CONFIRMADA_POR_ANALISTA: "CONFIRMADA_POR_ANALISTA",
  DESCARTADA_POR_ANALISTA: "DESCARTADA_POR_ANALISTA"
});


/*
-----------------------------------------------------------
TERMINOS QUE NO DISTINGUEN

Un termino es generico si lo comparten VARIOS medios del
catalogo: "radio" no distingue a nadie cuando hay cinco radios.

Se DERIVAN del catalogo, no se escriben a mano.

Escribirlos a mano fue el primer intento y estaba mal por dos
razones. Una: la lista incluia "cuenca", y eso codifica un
territorio dentro del motor —en otro proyecto "Cuenca" seria
justo el termino distintivo—. Dos: una lista fija envejece en
cuanto entra un medio nuevo al catalogo.

Derivarlo tiene un efecto util: el motor se adapta solo al
catalogo de cada proyecto.
-----------------------------------------------------------
*/

/* Aparecer en 2 o mas medios convierte un termino en generico. */
const MINIMO_PARA_SER_GENERICO = 2;

/* Estructurales del idioma: no dependen de ningun territorio. */
const ESTRUCTURALES = new Set([
  "el",
  "la",
  "los",
  "las",
  "de",
  "del",
  "com",
  "net",
  "org",
  "gob",
  "www"
]);

let genericasCache = null;


function terminosGenericos(catalogo) {
  if (genericasCache) return genericasCache;

  const cuenta = new Map();

  (catalogo || []).forEach((m) => {
    const propios = new Set([
      ...tokens(m?.nombre),
      ...tokens(String(m?.dominio || "").replace(/\./g, " "))
    ]);

    propios.forEach((t) => cuenta.set(t, (cuenta.get(t) || 0) + 1));
  });

  const derivados = [...cuenta.entries()]
    .filter(([, n]) => n >= MINIMO_PARA_SER_GENERICO)
    .map(([t]) => t);

  genericasCache = new Set([...ESTRUCTURALES, ...derivados]);

  return genericasCache;
}


/* Para los tests y para una recarga del catalogo. */
export function limpiarCacheGenericas() {
  genericasCache = null;
}


function tokens(s) {
  return normalizarTexto(String(s || ""))
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}


function distintivos(s, genericas) {
  return tokens(s).filter((t) => !genericas.has(t));
}


/*
-----------------------------------------------------------
FUERZA DE LA CORRESPONDENCIA

Solo cuenta lo DISTINTIVO. Que dos nombres compartan «radio» o
«cuenca» no dice nada: la mitad del catalogo los comparte.

    1.0  el handle ES un token distintivo del nombre
    0.8  el handle contiene un token distintivo completo
    0.6  el handle y el dominio comparten un token distintivo
    0    sin token distintivo en comun
-----------------------------------------------------------
*/
export function fuerzaDeCorrespondencia(handle, medio, genericas = null) {
  const h = normalizarTexto(String(handle || "")).replace(/[^a-z0-9]/g, "");

  if (!h || h.length < 4) {
    return { fuerza: 0, motivo: "El handle es demasiado corto para comparar." };
  }

  const g = genericas || terminosGenericos(catalogoSeguro());

  const delNombre = distintivos(medio?.nombre, g);

  const delDominio = distintivos(
    String(medio?.dominio || "").replace(/\.(com|ec|tv|net|org|gob)/g, " "),
    g
  );

  const universo = [...new Set([...delNombre, ...delDominio])];

  if (!universo.length) {
    return { fuerza: 0, motivo: "El medio no aporta ningun termino distintivo." };
  }

  const exacto = universo.find((t) => t === h);

  if (exacto) {
    return {
      fuerza: 1.0,
      motivo: `El handle "@${handle}" coincide exactamente con el termino distintivo "${exacto}" de "${medio.nombre}".`,
      terminos: [exacto]
    };
  }

  /*
    Coincidencia parcial: el termino esta DENTRO del handle.

    Exige COBERTURA. Un termino que ocupa poco del handle es una
    coincidencia debil, y produce falsos positivos reales:
    `@cuencadigital` contiene el termino de «GAD Municipal de
    Cuenca», pero solo cubre 6 de 14 caracteres. Son emisores
    distintos.

    El umbral se expresa en proporcion del handle, no en una
    lista de palabras: asi la regla no menciona ningun territorio
    ni envejece con el catalogo.

        @tomebamba     -> "tomebamba"  100 %  exacto
        @UNSIONTV      -> "unsion"      75 %  aceptado
        @cuencadigital -> "cuenca"      43 %  rechazado
  */
  const COBERTURA_MINIMA = 0.6;

  const contenido = universo.filter(
    (t) => h.includes(t) && t.length / h.length >= COBERTURA_MINIMA
  );

  const debiles = universo.filter(
    (t) => h.includes(t) && t.length / h.length < COBERTURA_MINIMA
  );

  if (contenido.length) {
    const compartidoConDominio = contenido.some((t) => delDominio.includes(t));

    return {
      fuerza: compartidoConDominio ? 0.8 : 0.6,

      motivo: `El handle "@${handle}" contiene ${
        contenido.length === 1 ? "el termino" : "los terminos"
      } distintivo${contenido.length === 1 ? "" : "s"} "${contenido.join(
        ", "
      )}" de "${medio.nombre}"${
        compartidoConDominio ? ", presente tambien en su dominio" : ""
      }.`,

      terminos: contenido
    };
  }

  if (debiles.length) {
    return {
      fuerza: 0,

      motivo: `El handle "@${handle}" contiene "${debiles.join(
        ", "
      )}" de "${medio.nombre}", pero cubre menos del ${Math.round(
        COBERTURA_MINIMA * 100
      )} % del handle: coincidencia demasiado debil para proponerla.`,

      terminos: []
    };
  }

  return {
    fuerza: 0,
    motivo: `El handle "@${handle}" no comparte ningun termino distintivo con "${medio.nombre}".`
  };
}


/*
===========================================================
BUSCAR CORRESPONDENCIAS
===========================================================
*/
export function correspondenciasDeCuenta(handle, opciones = {}) {
  const minimo = opciones.minimo ?? 0.6;

  const catalogo = catalogoSeguro();

  const genericas = terminosGenericos(catalogo);

  if (!handle) {
    return {
      handle: null,
      candidatos: [],
      total: 0,
      motivo: "No se recibio handle.",
      declaracion: DECLARACION
    };
  }

  const candidatos = catalogo
    .map((m) => {
      const f = fuerzaDeCorrespondencia(handle, m, genericas);

      return {
        medioId: m.dominio,
        nombre: m.nombre,
        dominio: m.dominio,
        tipoEnCatalogo: m.tipo,
        cobertura: m.cobertura || null,

        fuerza: f.fuerza,
        motivo: f.motivo,
        terminos: f.terminos || [],

        estado: ESTADOS_CORRESPONDENCIA.OBSERVADA_NO_VERIFICADA,

        /*
          Que clase TENDRIA el emisor si un analista confirmara.
          Se declara para que la accion sea obvia, pero no se
          aplica: `claseSugerida` no es `clase`.
          */
        claseSugerida:
          m.tipo === TIPOS_FUENTE.INSTITUCION
            ? "INSTITUCIONAL"
            : String(m.tipo || "").startsWith("medio")
              ? "MEDIO"
              : null,

        requiereConfirmacion: true
      };
    })
    .filter((c) => c.fuerza >= minimo)
    .sort((a, b) => b.fuerza - a.fuerza)
    .slice(0, 3);

  return {
    handle,
    candidatos,
    total: candidatos.length,

    /*
      Si hay mas de uno con la misma fuerza, se dice: elegir por
      el llamador seria fabricar una certeza que no existe.
    */
    ambiguo:
      candidatos.length > 1 && candidatos[0].fuerza === candidatos[1].fuerza,

    motivo: candidatos.length
      ? null
      : `Ningun medio del catalogo (${catalogo.length} registrados) comparte un termino distintivo con "@${handle}".`,

    declaracion: DECLARACION
  };
}


const DECLARACION = Object.freeze({
  titulo: "Una correspondencia no es una identidad",

  texto:
    "El parecido entre un handle y el nombre de un medio del catalogo es una CORRESPONDENCIA OBSERVADA. No prueba que la cuenta pertenezca a ese medio: puede ser una parodia, un homonimo, un programa distinto del mismo grupo o una cuenta antigua. La clase del emisor NO cambia hasta que un analista lo confirme.",

  porQueNoSeAutomatiza:
    "El catalogo indexa por dominio web y una cuenta de red social no lo tiene. Salvar ese salto exige una comprobacion humana, o el enlace declarado por el propio medio en su web."
});


export default {
  ESTADOS_CORRESPONDENCIA,
  fuerzaDeCorrespondencia,
  correspondenciasDeCuenta,
  limpiarCacheGenericas
};
