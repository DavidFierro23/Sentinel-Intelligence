// apps/backend/services/media/pieceEnrichment.js

import { leerMetadataPublica, ESTADOS_LECTURA, PROCEDENCIAS_CAMPO } from "./publicMetadata.js";

import { estadoDeCampo, ESTADOS_CAMPO } from "./pieceFieldMatrix.js";

import { PLATAFORMAS, CLASES_EMISOR } from "./pieceContracts.js";

/*
===========================================================
ENRIQUECER UNA PIEZA — MEDIA-PIECE-02
===========================================================

Toma la pieza recien resuelta desde la URL y trata de rellenar
titulo, texto, autor y fecha con la metadata publica.

ES EL ARREGLO DEL CASO 2, Y TAMBIEN DEL CASO MAS COMUN
-----------------------------------------------------------

El informe del usuario decia, para un reel de Facebook:

    titulo: no resuelto
    autor: no resuelto
    fecha: no resuelto
    0 piezas con texto utilizable
    sin temas

Las cinco lineas tienen una sola causa: MEDIA-PIECE-01 no leia
la pagina. Y sin titulo no hay temas, porque el motor de temas
agrupa por coocurrencia de terminos del titular; y sin titulo
tampoco hay buenas consultas de amplificacion, porque tres de
las cuatro se construyen a partir de el.

Asi que este paso no anade un campo: desbloquea la cadena.

QUE SE PROMETE Y QUE NO
-----------------------------------------------------------

En un medio digital esto funciona casi siempre: og:title existe
porque el medio quiere que exista.

En Facebook, Instagram y X lo normal es un muro. Cuando lo hay,
se declara `BLOQUEADA_POR_LA_PLATAFORMA` y los campos siguen
`null` con su motivo. No se rodea el muro y no se rellena el
hueco con el snippet de un buscador haciendolo pasar por
contenido de la publicacion: si un snippet aporta el titular, se
etiqueta como `snippet_de_buscador` y se dice que no es el
contenido original.

CADA CAMPO CONSERVA DE DONDE VINO
-----------------------------------------------------------

`procedenciaCampos` acompana a la pieza hasta la UI. Un titulo
de og:title y un titulo de un snippet de Brave no valen lo
mismo, y quien decide tiene que poder verlo.
===========================================================
*/


/* Plataformas donde la lectura publica suele topar con un muro. */
const CON_MURO_HABITUAL = [
  PLATAFORMAS.FACEBOOK,
  PLATAFORMAS.INSTAGRAM,
  PLATAFORMAS.TIKTOK,
  PLATAFORMAS.X
];


/*
  El og:title de una red social suele venir con la forma
  "Nombre De La Cuenta on Facebook: ..." o "Nombre (@handle) en X".
  De ahi se puede sacar el emisor, que es lo que la URL de un
  reel no da. Se extrae con patrones EXPLICITOS y, si ninguno
  encaja, no se inventa.
*/
const PATRONES_EMISOR_EN_TITULO = [
  { re: /^(.+?)\s+on\s+(?:Facebook|Instagram|Threads|X)\b/i, grupo: 1 },
  { re: /^(.+?)\s+en\s+(?:Facebook|Instagram|X)\b/i, grupo: 1 },
  { re: /^(.+?)\s+\(@[^)]+\)\s+(?:on|en)\s+X\b/i, grupo: 1 },
  { re: /^(.+?)\s*[|·-]\s*Facebook\s*$/i, grupo: 1 }
];


export function emisorDesdeTitulo(titulo) {
  const t = String(titulo || "").trim();

  if (!t) return null;

  for (const p of PATRONES_EMISOR_EN_TITULO) {
    const m = t.match(p.re);

    if (m && m[p.grupo]) {
      const nombre = m[p.grupo].trim();

      /* Un "emisor" de una sola letra o kilometrico no es un emisor. */
      if (nombre.length >= 2 && nombre.length <= 80) {
        return { nombre, patron: String(p.re) };
      }
    }
  }

  return null;
}


/*
===========================================================
ENRIQUECER
===========================================================
*/
export async function enriquecerPieza(pieza, emisor, opciones = {}) {
  const plataforma = pieza?.plataforma || PLATAFORMAS.WEB;

  const procedencia = {
    titulo: pieza?.titulo ? PROCEDENCIAS_CAMPO.ANALISTA : null,
    snippet: pieza?.snippet ? PROCEDENCIAS_CAMPO.ANALISTA : null,
    autor: pieza?.autor ? PROCEDENCIAS_CAMPO.ANALISTA : null,
    publishedAt: pieza?.publishedAt ? PROCEDENCIAS_CAMPO.ANALISTA : null
  };

  const limitaciones = [];

  /*
    Si el analista ya declaro todo, no se molesta a la
    plataforma. Un dato declarado por una persona vale mas que
    uno raspado, y ahorra una peticion.
  */
  const faltaAlgo =
    !pieza?.titulo || !pieza?.publishedAt || (!pieza?.autor && !emisor?.nombre);

  if (!faltaAlgo) {
    return {
      pieza,
      emisor,
      metadata: {
        estado: ESTADOS_LECTURA.NO_INTENTADA,
        motivo: "El analista ya aporto titulo, autor y fecha: no se pidio la pagina."
      },
      procedenciaCampos: procedencia,
      limitaciones,
      peticiones: 0
    };
  }

  /*
    Se pide la URL ORIGINAL, no la canonica: la canonica es un
    identificador sin esquema y no es una direccion.
  */
  const lectura = await leerMetadataPublica(pieza.url || pieza.canonicalUrl, {
    fetch: opciones.fetch,
    desactivado: opciones.sinMetadataPublica === true,
    timeoutMs: opciones.timeoutMs
  });

  let p = { ...pieza };

  let e = emisor;

  if (lectura.estado === ESTADOS_LECTURA.OK) {
    const c = lectura.campos;

    if (!p.titulo && c.titulo.valor) {
      p.titulo = c.titulo.valor;
      procedencia.titulo = c.titulo.procedencia;
      p.tituloEtiqueta = c.titulo.etiqueta;
    }

    if (!p.snippet && c.descripcion.valor) {
      p.snippet = c.descripcion.valor;
      procedencia.snippet = c.descripcion.procedencia;

      /*
        og:description es un extracto que recorta la plataforma.
        Decirlo evita que se lea como el caption completo.
      */
      if (CON_MURO_HABITUAL.includes(plataforma)) {
        limitaciones.push(
          "El texto proviene de og:description: es un extracto recortado por la plataforma, NO el contenido completo de la publicacion."
        );
      }
    }

    if (!p.publishedAt && c.publishedAt.valor) {
      p.publishedAt = c.publishedAt.valor;
      procedencia.publishedAt = c.publishedAt.procedencia;
      p.publishedAtProcedencia = c.publishedAt.procedencia;
    }

    if (!p.autor && c.autor.valor) {
      p.autor = c.autor.valor;
      procedencia.autor = c.autor.procedencia;
      p.autorProcedencia = c.autor.procedencia;
    }

    /*
      La canonica declarada por el documento manda sobre la
      normalizada: es lo que dice el propio editor.
    */
    if (c.canonical.valor && c.canonical.procedencia === PROCEDENCIAS_CAMPO.CANONICAL) {
      p.canonicalDeclarada = c.canonical.valor;
    }

    /*
      Emisor: si seguia pendiente, el titulo de la tarjeta suele
      llevarlo. Es la via que resuelve el reel de Facebook.
    */
    if (e?.pendienteDeResolver || e?.clase === CLASES_EMISOR.NO_DETERMINADO) {
      const desdeTitulo = c.titulo.valor ? emisorDesdeTitulo(c.titulo.valor) : null;

      const desdeSitio =
        c.sitio.valor && c.sitio.procedencia === PROCEDENCIAS_CAMPO.OG
          ? c.sitio.valor
          : null;

      const nombre = desdeTitulo?.nombre || p.autor || null;

      if (nombre) {
        e = {
          ...e,
          clase: CLASES_EMISOR.CREADOR,
          nombre,
          pendienteDeResolver: false,
          procedencia: `open_graph (${desdeTitulo ? "og:title" : "autor declarado"})`,

          razones: [
            ...(e.razones || []),
            desdeTitulo
              ? `La tarjeta publica de la pagina identifica al emisor en og:title: "${nombre}".`
              : `La pagina declara el autor: "${nombre}".`
          ],

          advertencia:
            "CREADOR es la clase por defecto para una cuenta de plataforma. Podria ser un medio, un periodista o una institucion: exige verificacion del analista y NO se deduce de sus seguidores."
        };
      } else if (desdeSitio && plataforma === PLATAFORMAS.WEB) {
        e = {
          ...e,
          nombre: desdeSitio,
          procedencia: "open_graph:og:site_name",
          razones: [
            ...(e.razones || []),
            `La pagina declara su nombre de sitio: "${desdeSitio}".`
          ]
        };
      }
    }
  } else {
    /* --- no se pudo leer: se explica, con el detalle util --- */
    const esperado = CON_MURO_HABITUAL.includes(plataforma);

    if (lectura.estado === ESTADOS_LECTURA.BLOQUEADA_POR_LA_PLATAFORMA) {
      limitaciones.push(
        `${plataforma}: la plataforma no entrega la metadata publica a un agente no autenticado (${lectura.motivo}). No se rodea el muro. Titulo, autor y fecha quedan sin resolver.`
      );
    } else if (lectura.estado === ESTADOS_LECTURA.PROHIBIDA_POR_ROBOTS) {
      limitaciones.push(
        `No se leyo la pagina: ${lectura.motivo} Se obedece robots.txt aunque el contenido sea publico.`
      );
    } else if (lectura.estado === ESTADOS_LECTURA.SIN_METADATA) {
      limitaciones.push(
        "La pagina respondio pero no publica Open Graph, Twitter Card ni JSON-LD utilizables."
      );
    } else if (lectura.estado === ESTADOS_LECTURA.NO_INTENTADA) {
      limitaciones.push("Lectura de metadata publica desactivada por el llamador.");
    } else {
      limitaciones.push(
        `No se pudo leer la metadata publica: ${lectura.motivo || lectura.estado}.`
      );
    }

    if (esperado && lectura.estado === ESTADOS_LECTURA.BLOQUEADA_POR_LA_PLATAFORMA) {
      limitaciones.push(
        `Este resultado es el ESPERADO en ${plataforma} sin API autorizada: la matriz de campos ya lo declara. No es un fallo del modulo.`
      );
    }
  }

  /* Que campos siguen vacios y por que dice la matriz que estan vacios. */
  const pendientes = [];

  [
    ["titulo", p.titulo],
    ["texto", p.snippet],
    ["autor", p.autor || e?.nombre],
    ["publishedAt", p.publishedAt]
  ].forEach(([campoId, valor]) => {
    if (valor) return;

    const est = estadoDeCampo(plataforma, campoId);

    pendientes.push({
      campo: campoId,
      estado: est.estado,
      via: est.via,
      motivo: est.nota,

      accionable:
        est.estado === ESTADOS_CAMPO.REQUIERE_AUTORIZACION
          ? "Requiere credencial o autorizacion: es una decision humana, no un cambio de codigo."
          : est.estado === ESTADOS_CAMPO.DISPONIBLE_PROVEEDOR
            ? "Requiere proveedor comercial con licencia (pendiente de benchmark)."
            : est.estado === ESTADOS_CAMPO.DISPONIBLE_WEB_INDIRECTO
              ? "La via existe pero esta vez no dio resultado. El analista puede declarar el dato a mano."
              : "No hay via conocida."
    });
  });

  return {
    pieza: p,
    emisor: e,
    metadata: lectura,
    procedenciaCampos: procedencia,
    camposPendientes: pendientes,
    limitaciones,
    peticiones: lectura.peticiones || 0
  };
}


export default { enriquecerPieza, emisorDesdeTitulo };
