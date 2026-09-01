// apps/backend/services/territorial/journalistUniverse.js

import { clasificarEntidad, TIPOS_ENTIDAD } from "../conversation/entityTopicSeparation.js";

/*
===========================================================
FIRMAS — TERRITORIAL-OPEN-LISTENING-EXPANSION-01
===========================================================

Quien firma las piezas, derivado de la firma que la propia
fuente publica.

EL HALLAZGO QUE JUSTIFICA ESTE MODULO
-----------------------------------------------------------

`rssAdapter` ya extraia el autor de `dc:creator` y `author`
desde INGEST-REAL-01, y el libro de evidencias lo tiraba al
persistir.

Medido sobre cuatro feeds locales reales —El Mercurio, La Voz
del Tomebamba, Unsion TV y EMAC—: **40 de 40 items declaran
autor**. Se estaba perdiendo el 100 % de una señal que ya
estaba en los datos, sin coste y sin proveedor.

FIRMA NO ES PERIODISTA
-----------------------------------------------------------

Y esa es toda la dificultad. Los mismos cuatro feeds devuelven:

    «Andrés Mazza»            una persona
    «Juan Pablo Campoverde»   una persona
    «Pedro Andrade»           una persona
    «Redes Sociales»          una SECCION, no alguien

Tratar las cuatro igual produciria un «periodista» llamado
Redes Sociales. Por eso la firma se guarda siempre —es un hecho
sobre la pieza— y la promocion a PERSONA exige que el
clasificador de entidades lo respalde.

Y aun asi el clasificador es heuristico: en §13-quindecies tipo
«Barcelona SC» como PERSON por ser dos palabras capitalizadas.
Su confianza viaja con el veredicto en lugar de esconderse.

LO QUE ESTE MODULO NO HACE
-----------------------------------------------------------

NO construye perfiles de personas. Guarda el nombre publicado,
el medio y las piezas que lo sostienen, y nada mas: ni contacto,
ni redes, ni biografia, ni atributos sensibles.

Una firma es un dato editorial publico. Un perfil es otra cosa,
y no se hace.
===========================================================
*/


export const TIPOS_FIRMA = Object.freeze({
  /* La firma parece una persona y el clasificador lo respalda. */
  PERSONA: "PERSONA",

  /*
    Seccion, mesa de redaccion o etiqueta generica. Se guarda
    porque es la firma real de la pieza, pero no es alguien.
  */
  SECCION: "SECCION",

  /* Hay firma y no se puede decir cual de las dos es. */
  NO_CLASIFICADA: "NO_CLASIFICADA"
});


/*
  Etiquetas editoriales observadas o previsibles. No son
  personas por mucho que ocupen el campo `author`.
*/
const ETIQUETAS_DE_SECCION = new Set([
  "redes sociales",
  "redaccion",
  "redacción",
  "editorial",
  "administrador",
  "admin",
  "comunicacion",
  "comunicación",
  "prensa",
  "webmaster",
  "noticias",
  "informativo",
  "informativos",
  "agencia",
  "equipo",
  "staff",
  "digital",
  "web"
]);


const UMBRAL_PERSONA = 0.5;


function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}


export function firmaIdDe(nombre, medio) {
  return `firma-${normalizar(medio)}-${normalizar(nombre).replace(/[^a-z0-9]+/g, "-")}`.replace(
    /-+$/,
    ""
  );
}


/*
===========================================================
CLASIFICAR UNA FIRMA
===========================================================
*/

export function clasificarFirma(nombre) {
  const limpio = String(nombre || "").trim();

  if (!limpio) {
    return { tipo: TIPOS_FIRMA.NO_CLASIFICADA, confianza: 0, razon: "Sin firma." };
  }

  const norm = normalizar(limpio);

  if (ETIQUETAS_DE_SECCION.has(norm)) {
    return {
      tipo: TIPOS_FIRMA.SECCION,
      confianza: 0.9,

      razon: `«${limpio}» es una etiqueta editorial, no alguien. Se conserva como firma de la pieza.`
    };
  }

  const r = clasificarEntidad(limpio, { contexto: "" });

  if (r?.tipo === TIPOS_ENTIDAD.PERSON && (r.confianza ?? 0) >= UMBRAL_PERSONA) {
    return {
      tipo: TIPOS_FIRMA.PERSONA,
      confianza: r.confianza,
      razon: (r.razones || [])[0] || null,

      advertencia:
        "Clasificación heurística SIN verificar: un nombre de dos palabras capitalizadas se tipa como persona aunque no lo sea."
    };
  }

  return {
    tipo: TIPOS_FIRMA.NO_CLASIFICADA,
    confianza: r?.confianza ?? 0,

    razon: `No hay señal suficiente para decir que «${limpio}» sea una persona. No se fuerza.`
  };
}


/*
===========================================================
CONSTRUIR EL UNIVERSO DE FIRMAS

Una firma pertenece a UN medio: «Andrés Mazza» en El Mercurio y
«Andrés Mazza» en otro medio son dos entradas hasta que alguien
demuestre que son la misma persona. Unificarlas por nombre seria
resolucion de identidad, y eso no se hace por coincidencia de
cadena.
===========================================================
*/

export function construirUniversoDeFirmas({ corpus = [], projectId = null } = {}) {
  const firmas = new Map();

  let sinFirma = 0;

  corpus.forEach((e) => {
    const nombre = e.author || null;

    if (!nombre) {
      sinFirma += 1;

      return;
    }

    const medio = e.emitterId || e.sourceId || e.domain || "sin-medio";

    const clave = `${medio}::${normalizar(nombre)}`;

    if (!firmas.has(clave)) {
      const c = clasificarFirma(nombre);

      firmas.set(clave, {
        projectId,
        firmaId: firmaIdDe(nombre, medio),

        nombre,
        medio,
        medioNombre: e.publisher || medio,

        tipo: c.tipo,
        confianza: c.confianza,
        razon: c.razon,
        advertencia: c.advertencia || null,

        piezas: 0,
        evidenceIds: [],

        primeraObservacion: null,
        ultimaObservacion: null,

        procedencia: "firma_declarada_por_la_fuente",

        /*
          Nada mas. Ni contacto, ni redes, ni biografia: una
          firma es un dato editorial, no un perfil.
        */
        datosPersonales: null
      });
    }

    const f = firmas.get(clave);

    f.piezas += 1;

    if (e.evidenceId && !f.evidenceIds.includes(e.evidenceId)) f.evidenceIds.push(e.evidenceId);

    const pri = e.firstObservedAt;

    const ult = e.lastObservedAt || e.firstObservedAt;

    if (pri && (!f.primeraObservacion || pri < f.primeraObservacion)) f.primeraObservacion = pri;

    if (ult && (!f.ultimaObservacion || ult > f.ultimaObservacion)) f.ultimaObservacion = ult;
  });

  const lista = [...firmas.values()].sort((a, b) => b.piezas - a.piezas);

  const porTipo = {};

  lista.forEach((f) => {
    porTipo[f.tipo] = (porTipo[f.tipo] || 0) + 1;
  });

  return {
    projectId,

    firmas: lista,

    metricas: {
      total: lista.length,
      porTipo,

      personas: porTipo[TIPOS_FIRMA.PERSONA] || 0,
      secciones: porTipo[TIPOS_FIRMA.SECCION] || 0,
      sinClasificar: porTipo[TIPOS_FIRMA.NO_CLASIFICADA] || 0,

      /* Piezas del corpus que no traen firma. */
      piezasSinFirma: sinFirma,

      mediosConFirma: new Set(lista.map((f) => f.medio)).size
    },

    declaraciones: [
      "La firma se guarda tal como la publica la fuente. Puede ser una persona, una sección o una etiqueta genérica: «Redes Sociales» es una firma real y no es alguien.",
      "La promoción a PERSONA exige que el clasificador de entidades lo respalde, y su confianza viaja con el veredicto porque es heurístico y falla de forma visible.",
      "Una firma pertenece a UN medio. El mismo nombre en dos medios son dos entradas: unificarlas por coincidencia de cadena sería resolución de identidad, y eso no se hace así.",
      "No se construyen perfiles: nombre publicado, medio y piezas que lo sostienen. Ni contacto, ni redes, ni biografía, ni atributos sensibles."
    ]
  };
}


export default {
  TIPOS_FIRMA,
  firmaIdDe,
  clasificarFirma,
  construirUniversoDeFirmas
};
