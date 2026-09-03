// apps/backend/services/territorial/socialAssetResolution.js

/*
===========================================================
DEL ACTOR CORROBORADO AL ACTIVO SOCIAL OBSERVABLE
TERRITORIAL-COLLECTOR-EXPANSION-01
===========================================================

POR QUE EXISTE ESTE CAMINO
-----------------------------------------------------------

Facebook, Instagram y TikTok son KNOWN_ACCOUNT_ONLY con la
infraestructura disponible: los doce endpoints del proveedor
piden una URL o un handle y ninguno acepta una consulta. No hay
escucha abierta en esas tres plataformas, y fingirla seria
mentir sobre la cobertura.

Pero si hay un camino honesto, y es el inverso:

    otra fuente descubre y corrobora un actor
            v
    el actor entra al universo de fuentes
            v
    se resuelve su activo social publico
            v
    el proveedor observa ESE activo
            v
    su contenido pasa por resolucion territorial
            v
    corpus territorial

El descubrimiento lo hace la web y lo social solo observa. Eso
es valido y util, y es distinto de escuchar la plataforma.

LA TRAMPA QUE ESTE MODULO NO COMETE
-----------------------------------------------------------

Que un actor sea local NO hace local cada cosa que publica.

    El Mercurio es un medio de Cuenca.
    El Mercurio publica una nota sobre el dolar.
    Esa nota no habla de Cuenca.

Asi que un activo derivado de un actor corroborado NO nace
territorialmente corroborado. Cada pieza sigue pasando por
`socialGeoDisambiguation`, igual que las demas. Lo que hereda
el activo es IDENTIDAD, no geografia del contenido.

CUATRO ESTADOS QUE NO SE MEZCLAN
-----------------------------------------------------------

    DISCOVERED_BY     quien lo encontro
    OBSERVED_BY       quien lee su contenido
    IDENTITY_STATE    cuanta certeza hay de que la cuenta es
                      de quien dice ser
    TERRITORIAL_STATE se calcula por PIEZA, nunca por cuenta

Confundir el tercero con el cuarto es exactamente el error que
corrigio el gate anterior.
===========================================================
*/


export const ESTADOS_IDENTIDAD = Object.freeze({
  /*
    El enlace salio del sitio oficial del propio actor o de un
    perfil ya persistido con evidencia. Es lo mas fuerte que
    hay sin intervencion humana.
  */
  ENLAZADO_DESDE_FUENTE_OFICIAL: "ENLAZADO_DESDE_FUENTE_OFICIAL",

  /* Apareció en una búsqueda y coincide el nombre. Nada más. */
  COINCIDENCIA_POR_BUSQUEDA: "COINCIDENCIA_POR_BUSQUEDA",

  /* Una persona lo verificó y lo firmó. */
  VERIFICADO_POR_ANALISTA: "VERIFICADO_POR_ANALISTA",

  /* No se pudo establecer. */
  NO_RESUELTO: "NO_RESUELTO"
});


/*
  Solo estos dos autorizan a gastar un credito del proveedor.
  Una coincidencia de nombre en una busqueda no basta: gastar
  una llamada sobre la cuenta equivocada cuesta dinero y ademas
  mete contenido ajeno en el corpus.
*/
const IDENTIDAD_SUFICIENTE = Object.freeze([
  ESTADOS_IDENTIDAD.ENLAZADO_DESDE_FUENTE_OFICIAL,
  ESTADOS_IDENTIDAD.VERIFICADO_POR_ANALISTA
]);


export function autorizaObservacion(estadoIdentidad) {
  return IDENTIDAD_SUFICIENTE.includes(estadoIdentidad);
}


export const PLATAFORMAS_DE_ACTIVO = Object.freeze({
  web: { patron: null, modo: "OPEN_DISCOVERY" },
  rss: { patron: null, modo: "OPEN_DISCOVERY" },
  x: { patron: /(?:^|\/\/)(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})/i, modo: "OPEN_DISCOVERY" },
  youtube: { patron: /youtube\.com\/(?:@|channel\/|c\/|user\/)([A-Za-z0-9_\-.]+)/i, modo: "OPEN_DISCOVERY" },
  facebook: { patron: /facebook\.com\/([A-Za-z0-9_.\-]+)/i, modo: "KNOWN_ACCOUNT_ONLY" },
  instagram: { patron: /instagram\.com\/([A-Za-z0-9_.]+)/i, modo: "KNOWN_ACCOUNT_ONLY" },
  tiktok: { patron: /tiktok\.com\/@([A-Za-z0-9_.]+)/i, modo: "KNOWN_ACCOUNT_ONLY" }
});


/*
  Rutas de Facebook e Instagram que NO son una cuenta. Sin esto,
  «facebook.com/sharer» se convierte en un actor y se gasta un
  credito en un boton de compartir.
*/
const RUTAS_QUE_NO_SON_CUENTA = new Set([
  "sharer", "share", "sharer.php", "dialog", "plugins", "tr", "help",
  "policies", "legal", "login", "privacy", "profile.php", "groups",
  "watch", "events", "hashtag", "explore", "reel", "reels", "p", "accounts",
  "intent", "home", "search", "i", "settings", "about", "developers"
]);


/*
===========================================================
EXTRAER ACTIVOS DE UN TEXTO O DE UN HTML

No se inventa ninguna URL: se extraen enlaces que ya existen
en material publicado —el sitio oficial del actor, su ficha, un
perfil ya persistido—.
===========================================================
*/

export function extraerActivos(texto = "", origen = {}) {
  const encontrados = [];

  const visto = new Set();

  Object.entries(PLATAFORMAS_DE_ACTIVO).forEach(([plataforma, def]) => {
    if (!def.patron) return;

    const re = new RegExp(def.patron.source, "gi");

    let m = re.exec(String(texto || ""));

    while (m) {
      const handle = (m[1] || "").replace(/\/$/, "");

      const clave = `${plataforma}:${handle.toLowerCase()}`;

      if (handle && !visto.has(clave) && !RUTAS_QUE_NO_SON_CUENTA.has(handle.toLowerCase())) {
        visto.add(clave);

        encontrados.push({
          plataforma,
          handle,
          url: m[0].startsWith("http") ? m[0] : `https://${m[0].replace(/^\/\//, "")}`,
          modoDeObservacion: def.modo,

          /*
            De donde salio el enlace. Es lo que separa
            «lo publica su propia web» de «lo dijo una búsqueda».
          */
          descubiertoEn: origen.tipo || "TEXTO",
          descubiertoDesde: origen.url || origen.dominio || null,

          estadoIdentidad:
            origen.tipo === "SITIO_OFICIAL" || origen.tipo === "PERFIL_PERSISTIDO"
              ? ESTADOS_IDENTIDAD.ENLAZADO_DESDE_FUENTE_OFICIAL
              : ESTADOS_IDENTIDAD.COINCIDENCIA_POR_BUSQUEDA
        });
      }

      m = re.exec(String(texto || ""));
    }
  });

  return encontrados;
}


/*
===========================================================
MAPA DE ACTIVOS DE UN ACTOR
===========================================================

Para cada actor corroborado: que plataformas se le conocen y
que plataformas quedan sin resolver. La segunda lista es tan
importante como la primera, porque es la que dice cuanto del
ecosistema NO se esta observando.
===========================================================
*/

export function mapaDeActivos({ actor = {}, activos = [] } = {}) {
  const porPlataforma = {};

  Object.keys(PLATAFORMAS_DE_ACTIVO).forEach((p) => {
    porPlataforma[p] = [];
  });

  activos.forEach((a) => {
    if (porPlataforma[a.plataforma]) porPlataforma[a.plataforma].push(a);
  });

  const resueltas = Object.entries(porPlataforma)
    .filter(([, v]) => v.length > 0)
    .map(([k]) => k);

  const sinResolver = Object.entries(porPlataforma)
    .filter(([, v]) => v.length === 0)
    .map(([k]) => k);

  const observables = activos.filter((a) => autorizaObservacion(a.estadoIdentidad));

  return {
    actorId: actor.actorId || actor.sourceId || actor.emitterId || null,
    nombre: actor.nombre || actor.publisher || null,

    /* Por qué este actor está aquí: lo corroboró OTRA fuente. */
    discoveredBy: actor.discoveredBy || actor.descubiertoPor || null,
    territorialStateDelActor:
      "NO APLICA. El territorio se calcula por pieza, no por cuenta.",

    porPlataforma,
    plataformasResueltas: resueltas,
    plataformasSinResolver: sinResolver,

    activosObservables: observables.length,
    activosNoObservables: activos.length - observables.length,

    declaraciones: [
      "Un activo derivado de un actor corroborado NO nace territorialmente corroborado: su contenido pasa por resolución territorial pieza a pieza.",
      "Solo se observa un activo cuya identidad esté enlazada desde fuente oficial o verificada por un analista. Una coincidencia de nombre en una búsqueda no autoriza gasto.",
      `Plataformas sin resolver para este actor: ${sinResolver.join(", ") || "ninguna"}. Eso es ecosistema no observado, no ausencia de actividad.`
    ]
  };
}


/*
===========================================================
PLAN DE OBSERVACION CON PRESUPUESTO
===========================================================

Convierte activos en llamadas, con tope duro. El presupuesto
se aplica aqui y no en la disciplina de quien ejecuta: un tope
que depende de acordarse no es un tope.
===========================================================
*/

export function planDeObservacion({
  mapas = [],
  creditosDisponibles = 20,
  costePorLlamada = 1,
  plataformas = ["facebook", "instagram", "tiktok"]
} = {}) {
  const candidatos = [];

  mapas.forEach((m) => {
    plataformas.forEach((p) => {
      (m.porPlataforma?.[p] || []).forEach((a) => {
        if (!autorizaObservacion(a.estadoIdentidad)) {
          candidatos.push({ ...a, actorId: m.actorId, nombre: m.nombre, incluido: false, motivo: "IDENTIDAD_INSUFICIENTE" });
          return;
        }

        candidatos.push({ ...a, actorId: m.actorId, nombre: m.nombre, incluido: null, motivo: null });
      });
    });
  });

  let gastado = 0;

  const plan = candidatos.map((c) => {
    if (c.incluido === false) return c;

    if (gastado + costePorLlamada > creditosDisponibles) {
      return { ...c, incluido: false, motivo: "PRESUPUESTO_AGOTADO" };
    }

    gastado += costePorLlamada;

    return { ...c, incluido: true, motivo: null, costeEstimado: costePorLlamada };
  });

  return {
    plan,
    aObservar: plan.filter((c) => c.incluido),
    excluidos: plan.filter((c) => !c.incluido),
    creditosPlanificados: gastado,
    creditosDisponibles,
    topeRespetado: gastado <= creditosDisponibles,

    declaracion:
      "El tope se aplica en el plan, antes de llamar. Los excluidos declaran si fue por identidad insuficiente o por presupuesto."
  };
}


export default {
  ESTADOS_IDENTIDAD,
  PLATAFORMAS_DE_ACTIVO,
  autorizaObservacion,
  extraerActivos,
  mapaDeActivos,
  planDeObservacion
};
