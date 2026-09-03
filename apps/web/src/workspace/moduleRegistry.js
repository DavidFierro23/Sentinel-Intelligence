// apps/web/src/workspace/moduleRegistry.js

/*
===========================================================
SENTINEL-UX-CONSOLIDATION-01 — REGISTRO DE MODULOS
===========================================================

Separa dos cosas que estaban pegadas y no son la misma:

    NAVIGATION LABEL   lo que el analista lee
    INTERNAL MODULE ID  con lo que App decide que montar

Estaban pegadas porque el menu nacio antes que los motores. Al
reorganizar la navegacion alrededor del proyecto, un id como
`media_pieza` deja de describir lo que hay detras —ya no es «una
pieza», es Media Intelligence entero— pero SIGUE siendo la clave
que monta el componente y la que aparece en enlaces guardados.

Renombrar el id habria roto los deep links por un motivo
cosmetico. Aqui el id se conserva y la etiqueta cambia.

LO QUE SALE DE LA NAVEGACION PRIMARIA NO SE BORRA
-----------------------------------------------------------

    war_room         -> su pregunta la responde ahora RESUMEN
    knowledge_graph  -> vive dentro de INVESTIGACIONES
    correlacion      -> capacidad interna, futuro de Sentinel AI

Los tres ids siguen resolviendo: `resolverModulo()` traduce un id
antiguo al destino que hoy responde su pregunta, asi que un
enlace guardado de hace un mes sigue llevando a algun sitio util
en lugar de a una pantalla vacia.
===========================================================
*/

/* Los seis destinos del workspace, mas Configuracion aparte. */
export const MODULOS_PRIMARIOS = Object.freeze([
  {
    id: "resumen",
    etiqueta: "Resumen",
    pregunta: "¿Qué está pasando?",
    scoped: true
  },
  {
    id: "candidatos",
    etiqueta: "Candidatos",
    pregunta: "¿Quién compite y con qué presencia?",
    scoped: true
  },
  {
    id: "mapa",
    etiqueta: "Territorio",
    pregunta: "¿Dónde ocurre?",
    scoped: true
  },
  {
    id: "media_pieza",
    etiqueta: "Medios",
    pregunta: "¿Quién publica y cómo se amplifica?",
    scoped: true
  },
  {
    id: "investigaciones",
    etiqueta: "Investigaciones",
    pregunta: "¿Qué hay detrás de un actor?",
    scoped: false
  },
  {
    id: "sentinel_ai",
    etiqueta: "Sentinel AI",
    pregunta: "Pregúntale a Sentinel",
    scoped: true
  }
]);


export const MODULO_CONFIGURACION = Object.freeze({
  id: "configuracion",
  etiqueta: "Configuración",
  scoped: false
});


export const MODULO_POR_DEFECTO = "resumen";


/*
-----------------------------------------------------------
IDS ANTIGUOS -> DESTINO ACTUAL

Cada redireccion lleva a donde HOY se responde esa pregunta, no
a una pantalla de disculpa.
-----------------------------------------------------------
*/
export const REDIRECCIONES = Object.freeze({
  war_room: {
    destino: "resumen",
    motivo:
      "War Room preguntaba «¿qué está pasando ahora?». Esa pregunta la responde Resumen, con los datos que existen."
  },

  knowledge_graph: {
    destino: "investigaciones",
    seccion: "relaciones",
    motivo:
      "El grafo de relaciones vive dentro de Investigaciones, que es donde se investiga a un actor."
  },

  correlacion: {
    destino: "sentinel_ai",
    motivo:
      "Correlación Viva deja de ser un módulo visible: es una capacidad interna, y su destino natural es Sentinel AI."
  }
});


/* Todos los ids que App sabe montar, primarios o heredados. */
export const IDS_VALIDOS = Object.freeze([
  ...MODULOS_PRIMARIOS.map((m) => m.id),
  MODULO_CONFIGURACION.id,
  ...Object.keys(REDIRECCIONES)
]);


/*
===========================================================
RESOLVER UN ID
===========================================================

Devuelve el modulo que hay que montar y, si hubo redireccion,
por que. La UI muestra ese motivo una vez: un enlace que cambia
de destino en silencio confunde mas que uno roto.
===========================================================
*/
export function resolverModulo(id) {
  const limpio = String(id || "").trim();

  if (!limpio) {
    return { id: MODULO_POR_DEFECTO, redirigido: false };
  }

  if (REDIRECCIONES[limpio]) {
    const r = REDIRECCIONES[limpio];

    return {
      id: r.destino,
      seccion: r.seccion || null,
      redirigido: true,
      desde: limpio,
      motivo: r.motivo
    };
  }

  if (MODULOS_PRIMARIOS.some((m) => m.id === limpio)) {
    return { id: limpio, redirigido: false };
  }

  if (limpio === MODULO_CONFIGURACION.id) {
    return { id: limpio, redirigido: false };
  }

  return {
    id: MODULO_POR_DEFECTO,
    redirigido: true,
    desde: limpio,
    motivo: `«${limpio}» no es un módulo de Sentinel. Se abre Resumen.`
  };
}


export function moduloEsScoped(id) {
  const m = MODULOS_PRIMARIOS.find((x) => x.id === id);

  return m ? m.scoped : false;
}


export function etiquetaDeModulo(id) {
  const m = MODULOS_PRIMARIOS.find((x) => x.id === id);

  if (m) return m.etiqueta;

  if (id === MODULO_CONFIGURACION.id) return MODULO_CONFIGURACION.etiqueta;

  return id;
}


export default {
  MODULOS_PRIMARIOS,
  MODULO_CONFIGURACION,
  MODULO_POR_DEFECTO,
  REDIRECCIONES,
  IDS_VALIDOS,
  resolverModulo,
  moduloEsScoped,
  etiquetaDeModulo
};
