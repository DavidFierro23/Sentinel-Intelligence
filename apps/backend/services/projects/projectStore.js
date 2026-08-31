// apps/backend/services/projects/projectStore.js

import { normalizarTexto } from "../textUtils.js";

import {
  escribirEnLake,
  obtenerHistorialEntidad,
  obtenerVersionEntidad,
  obtenerEventosProyecto
} from "../knowledgeLake/lakeQuery.js";

/*
  SD-1A es la autoridad para leer una URL: de que plataforma es y
  cual es su handle. No se adivina por el campo del formulario,
  porque el analista puede pegar una URL de Instagram en la
  casilla de Facebook.
*/
import { clasificarUrlSocial } from "../social/discovery/socialUrlClassifier.js";

/*
  Reglas de fusion de las series longitudinales. Se importan en
  lugar de reescribirse aqui: dos reglas de fusion distintas
  para el mismo dato acabarian discrepando, y la que gobierna es
  la del contrato.
*/
import { fusionarSenales } from "../intelligence/crossLinkEvidence.js";

import { fusionarPublicacion } from "../intelligence/publicationObservation.js";

/*
===========================================================
ALMACÉN DE PROYECTOS Y EXPEDIENTES — ARQ-INV-002
===========================================================

Proyectos, candidatos y expedientes vivos, persistidos sobre el
Knowledge Lake que ya existe. No se escribe un almacén nuevo.

POR QUÉ EL LAKE Y NO OTRA COSA
-----------------------------------------------------------

El Lake ya resuelve exactamente lo que este sprint pide, y lo
resuelve desde su diseño:

  append-only     una segunda investigación no borra la primera
  versionado      el expediente tiene historia consultable
  proyectoId      AISLAMIENTO por proyecto, requisito DT1

Ese último punto es el importante. La regla «Proyecto Cuenca y
Proyecto Loja no deben mezclarse» no se implementa con un filtro
que alguien puede olvidar: la clave de entidad del Lake es

    tenantId :: proyectoId :: tipoEntidad :: entidad

Dos proyectos distintos producen claves distintas. El
aislamiento es estructural, no una comprobación.

EXPEDIENTE VIVO
-----------------------------------------------------------

Una segunda investigación del mismo candidato NO crea un segundo
candidato: escribe una versión nueva de su expediente y devuelve
el diferencial —qué cuentas, medios y menciones son nuevas—.

Si nada cambió, no se escribe. Tres investigaciones idénticas
dejarían tres versiones idénticas y el historial dejaría de
significar nada.
===========================================================
*/


const TENANT = "sentinel-local";

const SUBMOTOR = "arq_inv_002_proyectos";

/*
  El Lake valida `tipoEntidad` contra su catálogo. Se usan los
  tipos que ya existen: no se inventan tipos nuevos para no tocar
  el modelo del Lake, que este sprint declara intocable.
*/
const TIPO_PROYECTO = "documento";

const TIPO_EXPEDIENTE = "persona";

/*
===========================================================
HALLAZGO vs EJECUCION — BUG-13
===========================================================

Son dos cosas distintas y hasta ahora compartian un solo
registro, que es lo que produjo el fallo.

  EXPEDIENTE  el conjunto ACUMULADO de hallazgos: cuentas,
              medios, instituciones. Se deduplica a proposito:
              reinvestigar a alguien no debe crear un segundo
              candidato ni duplicar sus cuentas.

  EJECUCION   el EVENTO de haber investigado. Ocurrio a una hora,
              lanzo unas consultas, obtuvo unas respuestas. Es un
              hecho, y un hecho no deja de haber ocurrido porque
              su resultado coincida con el de ayer.

EL FALLO

`registrarInvestigacion` omitia la escritura cuando el resumen
no cambiaba —`sinCambios`—, correcto para los hallazgos y
catastrofico para la traza: una reejecucion sin delta es
exactamente el caso en que se necesita mirar la traza, y era el
unico caso en que se tiraba. Comprobado en la reprueba real de
Lloret: la investigacion corrio, gasto cuota y no dejo rastro.

LA SEPARACION

El expediente sigue deduplicando hallazgos, sin tocar. La
ejecucion se guarda SIEMPRE, en su propia entidad. No se
duplica ninguna cuenta ni ninguna evidencia para forzar que un
hash cambie: lo que se persiste aparte es el evento, que es
genuinamente nuevo.

La identidad de cada ejecucion es su instante autoritativo, el
mismo que ya se escribia en `actualizadoEn`. No se añade
aleatoriedad para evadir la deduplicacion: dos investigaciones
distintas son dos hechos distintos y ya se distinguen por
cuando ocurrieron.
===========================================================
*/
const PREFIJO_EJECUCION = "ejecucion-";


/*
===========================================================
FICHA DE IDENTIDAD — P-CAND-UX-01
===========================================================

Las seis plataformas obligatorias mas la web oficial. La ficha
declara SIEMPRE las siete, tambien las que no tienen cuenta: una
plataforma sin cuenta no es una plataforma sin comprobar, y
ocultarla haria imposible distinguirlas.
===========================================================
*/

export const PLATAFORMAS_FICHA = Object.freeze([
  { id: "facebook", nombre: "Facebook", campo: "facebook" },
  { id: "instagram", nombre: "Instagram", campo: "instagram" },
  { id: "x", nombre: "X", campo: "x" },
  { id: "tiktok", nombre: "TikTok", campo: "tiktok" },
  { id: "youtube", nombre: "YouTube", campo: "youtube" },
  { id: "linkedin", nombre: "LinkedIn", campo: "linkedin" },
  { id: "web", nombre: "Web oficial", campo: "web" }
]);


/*
-----------------------------------------------------------
UNA CUENTA DE REFERENCIA

COLECCION, NO CAMPO. El modelo anterior era `instagram: string`,
asi que un candidato con dos cuentas de Instagram —la personal y
la de campana, que es lo normal— solo podia tener una.

Ahora es una entrada de coleccion con identidad propia:
plataforma + handle normalizado. Se admiten varias de la misma
plataforma; lo que no se admite es la misma dos veces.

PROCEDENCIA, SIEMPRE. Lo que escribe el analista entra como
declarado y NO como verificado. Puede pasar despues a corroborado
si un proveedor la encuentra por su cuenta, y entonces las dos
cosas son verdad a la vez: la declaro una persona Y la
corroboro Sentinel. La ficha debe poder decir ambas.
-----------------------------------------------------------
*/
function construirCuentaReferencia(url, plataformaDeclarada) {
  const limpia = String(url || "").trim();

  if (!limpia) return null;

  const clasificacion = clasificarUrlSocial(limpia);

  /*
    Manda el dominio, no la casilla del formulario. Si la URL no
    es de una plataforma conocida se trata como web: no se
    descarta, porque una web propia es una senal de identidad
    legitima.
  */
  const plataformaId = clasificacion?.esSocial
    ? clasificacion.plataformaId
    : "web";

  const plataforma = clasificacion?.esSocial
    ? clasificacion.plataforma
    : plataformaDeclarada || "Web oficial";

  const handle = clasificacion?.handle || null;

  const ahora = new Date().toISOString();

  return {
    /*
      Identidad estable de la entrada. Con handle es
      plataforma:handle; sin handle —una web— la URL normalizada
      hace de clave.
    */
    id: `${plataformaId}:${normalizarTexto(handle || clasificacion?.urlNormalizada || limpia)}`,

    plataformaId,
    plataforma,
    url: clasificacion?.urlCanonica || limpia,
    urlOriginal: limpia,
    handle,

    tipo: "cuenta_referencia",

    /* ---- PROCEDENCIA ---- */
    origen: "analista",
    pertenenciaDeclarada: true,
    verificadaPorSentinel: false,
    noCuentaComoCorroboracion: true,
    estado: ESTADOS_IDENTIDAD.DECLARADA_POR_ANALISTA,

    creadaEn: ahora,
    actualizadaEn: null,

    nota:
      "Cuenta proporcionada por el analista como referencia inicial. Sentinel no la ha verificado."
  };
}


/*
===========================================================
FOTOGRAFIA DEL CANDIDATO — P-CAND-UX-03
===========================================================

QUE ES Y QUE NO ES

Una fotografia vinculada a una CUENTA no demuestra identidad. Es
un dato mas del expediente, con su procedencia, y se presenta
como lo que es.

    NO hay reconocimiento facial.
    NO hay identificacion biometrica.
    NO se infiere identidad a partir de una cara.
    NO se llama «foto oficial» a una imagen encontrada.

DOS AFIRMACIONES QUE NO SE MEZCLAN

  A · Sentinel corroboro que la cuenta corresponde al candidato.
  B · Sentinel verifico el contenido de la fotografia.

Que la cuenta pase a corroborada NO convierte su fotografia en
verificada. Son cosas distintas y `verificadaPorSentinel` solo
habla de la segunda, que hoy nunca es cierta.

LIMITE REAL, DECLARADO

No existe API de ninguna plataforma social en este sistema, y el
scraping esta excluido. Por tanto **no hay mecanismo legitimo
para obtener el avatar de Instagram, Facebook, TikTok, X,
YouTube ni LinkedIn**. La jerarquia esta implementada entera,
pero esas plataformas registran `no_disponible_sin_api` con su
motivo en lugar de fingir una imagen.

Lo que si puede producir imagen: una URL que el analista escriba,
y una imagen ya presente en el expediente —por ejemplo la que el
Avatar Intelligence Engine obtiene de Wikidata P18—.
===========================================================
*/

/*
  Jerarquia de seleccion. El orden lo fija el gate; lo que cambia
  entre plataformas es si hay forma legitima de obtener la imagen.
*/
export const PRIORIDAD_FOTO = Object.freeze([
  "manual",
  "instagram",
  "facebook",
  "tiktok",
  "x",
  "youtube",
  "linkedin",
  "web"
]);

/*
  Plataformas para las que NO tenemos forma legitima de obtener la
  imagen con la infraestructura actual. No es una opinion sobre la
  plataforma: es el estado de nuestra infraestructura, y se dice.
*/
const SIN_MECANISMO_DE_IMAGEN = Object.freeze({
  instagram: "no hay API de Instagram y el scraping esta excluido",
  facebook: "no hay API de Facebook y el scraping esta excluido",
  tiktok: "no hay API de TikTok y el scraping esta excluido",
  x: "no hay API de X y el scraping esta excluido",
  youtube: "no hay API de YouTube y el scraping esta excluido",
  linkedin: "no hay API de LinkedIn y el scraping esta excluido"
});


/*
-----------------------------------------------------------
UNA URL DE CUENTA NO ES UNA URL DE IMAGEN

El defecto visible que esto corrige: el analista pego
`facebook.com/usuario` en el campo de fotografia y la interfaz lo
puso como `src` de un `<img>`. El navegador mostro su icono roto.

Una pagina de perfil no es un archivo de imagen. Confundirlas
produce una imagen rota y, peor, hace creer que se intento
obtener algo cuando lo que se hizo fue pedirle al navegador que
dibujara una pagina HTML.
-----------------------------------------------------------
*/
const EXTENSIONES_IMAGEN = /\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?|#|$)/i;

const SERVICIOS_DE_IMAGEN =
  /(pbs\.twimg\.com|cdninstagram|fbcdn\.net|licdn\.com\/.*media|ytimg\.com|tiktokcdn|upload\.wikimedia\.org|gravatar\.com|googleusercontent\.com)/i;

export function esUrlDeImagen(url) {
  const u = String(url || "").trim();

  if (!u) return false;

  /* Data URI de imagen: es la imagen misma. */
  if (/^data:image\//i.test(u)) return true;

  if (!/^https?:\/\//i.test(u)) return false;

  return EXTENSIONES_IMAGEN.test(u) || SERVICIOS_DE_IMAGEN.test(u);
}


/*
  Diagnostico de por que una URL no sirve como fotografia. Se
  devuelve el motivo en lugar de fallar en silencio: el analista
  tiene que poder corregirlo.
*/
export function diagnosticarUrlFoto(url) {
  const u = String(url || "").trim();

  if (!u) return { valida: false, motivo: "no se indicó ninguna URL" };

  if (esUrlDeImagen(u)) return { valida: true, motivo: null };

  const clasificacion = clasificarUrlSocial(u);

  if (clasificacion?.esSocial) {
    return {
      valida: false,
      esUrlDeCuenta: true,
      plataformaId: clasificacion.plataformaId,
      motivo: `es la URL de una cuenta de ${clasificacion.plataforma}, no de una imagen. Pega el enlace directo a la fotografía.`
    };
  }

  return {
    valida: false,
    motivo:
      "no parece un enlace directo a una imagen (se esperaba .jpg, .png, .webp… o un servicio de imágenes conocido)"
  };
}


/*
-----------------------------------------------------------
CONSTRUIR LA FOTOGRAFIA

Historial: cuando la fotografia cambia, la anterior NO se
destruye en silencio. Se guarda en `historial`, acotado, para que
se pueda ver que hubo otra antes y de donde venia.
-----------------------------------------------------------
*/
const TOPE_HISTORIAL_FOTO = 5;

function construirFoto(datos, previa) {
  const bruta = String(datos?.fotoUrl || datos?.foto?.url || "").trim();

  /* Sin URL nueva: se conserva exactamente lo que habia. */
  if (!bruta) return previa || null;

  const diagnostico = diagnosticarUrlFoto(bruta);

  const ahora = new Date().toISOString();

  if (!diagnostico.valida) {
    /*
      NO se guarda como `url`: eso es lo que producia la imagen
      rota. Se guarda el intento con su motivo y se conserva la
      fotografia anterior, si habia.
    */
    return {
      ...(previa || {}),
      url: previa?.url || null,
      intentoRechazado: {
        url: bruta,
        motivo: diagnostico.motivo,
        esUrlDeCuenta: diagnostico.esUrlDeCuenta === true,
        plataformaId: diagnostico.plataformaId || null,
        rechazadoEn: ahora
      }
    };
  }

  const nueva = {
    url: bruta,
    sourceUrl: datos?.fotoSourceUrl || datos?.foto?.sourceUrl || bruta,

    origen: datos?.fotoOrigen || datos?.foto?.origen || "analista",
    provider: datos?.fotoProvider || datos?.foto?.provider || null,

    /* Vinculo con la cuenta de la que proviene, si proviene de una. */
    derivadaDeCuenta: datos?.fotoDerivadaDeCuenta === true,
    cuentaId: datos?.fotoCuentaId || null,
    plataformaId: datos?.fotoPlataformaId || null,
    handle: datos?.fotoHandle || null,

    obtenidaEn: ahora,
    ultimaComprobacion: ahora,

    /*
      Solo Sentinel puede marcarla verificada, y hoy no lo hace
      nunca. Que el analista la pegue no la verifica, y que la
      cuenta se corrobore tampoco: son dos afirmaciones distintas.
    */
    verificadaPorSentinel: false,

    /* Nada nuevo que rechazar. */
    intentoRechazado: null
  };

  /* Misma URL: se actualiza la comprobacion, no se duplica historia. */
  if (previa?.url && previa.url === nueva.url) {
    return {
      ...previa,
      ...nueva,
      obtenidaEn: previa.obtenidaEn || nueva.obtenidaEn,
      historial: previa.historial || []
    };
  }

  /*
    Cambio de fotografia: la anterior pasa al historial con su
    procedencia. Destruirla en silencio borraria de donde venia lo
    que el analista veia ayer.
  */
  const historial = previa?.url
    ? [
        {
          url: previa.url,
          sourceUrl: previa.sourceUrl || null,
          origen: previa.origen || null,
          plataformaId: previa.plataformaId || null,
          handle: previa.handle || null,
          cuentaId: previa.cuentaId || null,
          derivadaDeCuenta: previa.derivadaDeCuenta === true,
          obtenidaEn: previa.obtenidaEn || null,
          reemplazadaEn: ahora
        },
        ...(previa.historial || [])
      ].slice(0, TOPE_HISTORIAL_FOTO)
    : previa?.historial || [];

  return { ...nueva, historial };
}


/*
-----------------------------------------------------------
FOTOGRAFIA DERIVADA DE UNA CUENTA

Recorre la jerarquia sobre las cuentas que YA existen en el
expediente. No crea otro registro de redes y no consulta a nadie:
solo mira si alguna cuenta trae ya una imagen utilizable.

Para las seis plataformas sociales no hay mecanismo legitimo, asi
que se registra `no_disponible_sin_api` con el motivo. Declarar la
ausencia es la mitad del trabajo: sin eso, un hueco parece un
fallo y no una limitacion conocida.
-----------------------------------------------------------
*/
export function seleccionarFotoDeCuentas(cuentas, opciones = {}) {
  const disponibles = [];

  const noDisponibles = [];

  PRIORIDAD_FOTO.filter((x) => x !== "manual").forEach((plataformaId) => {
    const suyas = (cuentas || []).filter(
      (c) => c.plataformaId === plataformaId
    );

    if (!suyas.length) return;

    suyas.forEach((c) => {
      /*
        Una imagen ya presente en el expediente —por ejemplo la
        que el Avatar Intelligence Engine obtuvo de Wikidata— es
        utilizable. Se comprueba que sea de verdad una imagen.
      */
      const candidata = c.imagen || c.avatar || c.fotoUrl || null;

      if (candidata && esUrlDeImagen(candidata)) {
        disponibles.push({
          url: candidata,
          sourceUrl: c.url || null,
          plataformaId,
          handle: c.handle || null,
          cuentaId: c.id || null,
          origen: c.declaradaPorAnalista ? "cuenta_declarada" : "cuenta_descubierta",
          provider: (c.proveedoresHistoricos || [])[0] || null
        });

        return;
      }

      const motivo = SIN_MECANISMO_DE_IMAGEN[plataformaId];

      noDisponibles.push({
        plataformaId,
        handle: c.handle || null,
        cuentaId: c.id || null,
        disponibilidad: motivo ? "no_disponible_sin_api" : "sin_imagen_en_el_expediente",
        motivo:
          motivo ||
          "la cuenta no trae ninguna imagen en el expediente y no se consulta la plataforma"
      });
    });
  });

  return {
    /* La primera por orden de prioridad, si hay alguna. */
    elegida: disponibles[0] || null,
    disponibles,
    noDisponibles,

    limite:
      "No hay API de plataforma social en este sistema y el scraping esta excluido: para esas plataformas la fotografia no es obtenible y se declara, no se inventa."
  };
}


export const ESTADOS_IDENTIDAD = Object.freeze({
  /* Hallada, sin veredicto de identidad todavia. */
  DESCUBIERTA: "DESCUBIERTA",

  /* El clasificador la atribuyo al objetivo en esta ejecucion. */
  ATRIBUIDA: "ATRIBUIDA",

  /* Atribuida y sostenida en el inventario del proyecto. */
  CONSOLIDADA: "CONSOLIDADA",

  /* La escribio el analista. Procedencia distinta, no evidencia. */
  DECLARADA_POR_ANALISTA: "DECLARADA_POR_ANALISTA",

  /* Consolidada y vuelta a observar en esta ejecucion. */
  REVALIDADA: "REVALIDADA",

  /*
    No se pudo observar esta vez. NO es lo mismo que revocada, y
    la diferencia es el punto entero de este contrato.
  */
  NO_REENCONTRADA: "NO_REENCONTRADA_EN_ULTIMA_VERIFICACION",

  /* Retirada por decision, nunca por ausencia. */
  REVOCADA: "REVOCADA"
});


/*
  Estados que solo existen en la FICHA, no en el inventario:
  describen una plataforma, no una cuenta.
*/
export const ESTADOS_IDENTIDAD_FICHA = Object.freeze({
  /*
    No hay ninguna cuenta atribuida ni declarada en esta
    plataforma. NO afirma que el candidato no la use: afirma que
    Sentinel no tiene nada. Es la distincion que impide que la
    interfaz escriba «no tiene redes».
  */
  PENDIENTE: "PENDIENTE"
});




/*
  Clave canonica de una cuenta dentro de un candidato:
  plataforma + handle normalizado. La URL puede variar en
  esquema, «www» o barra final; el par plataforma+handle no.
*/
function claveIdentidad(cuenta) {
  const plataforma = normalizarTexto(
    String(cuenta?.plataformaId || cuenta?.platform || cuenta?.plataforma || "")
  );

  const handle = normalizarTexto(String(cuenta?.handle || ""));

  if (!plataforma || !handle) return null;

  return `${plataforma}:${handle}`;
}


function urlDe(c) {
  return c?.url?.canonica || c?.url?.original || c?.url || null;
}


function puntuacionDe(c) {
  return (
    c?.correspondencia?.puntuacion ??
    (typeof c?.correspondencia === "number" ? c.correspondencia : null)
  );
}


/*
-----------------------------------------------------------
CUENTAS ATRIBUIDAS EN ESTA EJECUCION

Se leen de `clasificacionCuentas`, que trae el veredicto y la
procedencia en el mismo objeto, con respaldo en las tarjetas del
perfil ejecutivo.
-----------------------------------------------------------
*/
function atribuidasDeLaEjecucion(resultado) {
  const cl = resultado?.clasificacionCuentas;

  const lista = cl?.cuentasObjetivo?.length
    ? cl.cuentasObjetivo
    : resultado?.perfilEjecutivo?.tarjetas || [];

  return lista
    .map((c) => {
      const origenes = c.origenes || [];

      const analista = origenes.some((o) => o.origen === "analista");

      return {
        clave: claveIdentidad(c),
        plataforma: c.plataforma || null,
        plataformaId: c.plataformaId || c.platform || null,
        handle: c.handle || null,
        url: urlDe(c),
        displayName: c.nombreVisible || null,

        correspondencia: puntuacionDe(c),
        nivelCorrespondencia: c.correspondencia?.nivel || c.nivel || null,

        vias: c.vias || c.corroboracion?.vias || [],
        proveedores: c.proveedores || c.corroboracion?.proveedores || [],

        corroboracion: c.corroboracion
          ? {
              totalProveedores: c.corroboracion.totalProveedores ?? null,
              multiProveedor: c.corroboracion.multiProveedor ?? null,
              multiVia: c.corroboracion.multiVia ?? null
            }
          : null,

        referenciaAnalista: analista,
        noCuentaComoCorroboracion: origenes.some(
          (o) => o.noCuentaComoCorroboracion === true
        ),

        evidenciaAtribucion:
          (c.clasificacion?.razones || [])[0] || c.motivoClase || null
      };
    })
    .filter((c) => c.clave);
}


/*
-----------------------------------------------------------
CONSOLIDAR

Se funde el inventario que ya existia con lo observado ahora.
Nada se borra por no haber sido visto.

LIMITE DECLARADO: los expedientes escritos antes de este
contrato no tienen `firstSeenAt`. No se inventa una fecha
plausible —seria un dato falso con apariencia de dato—: queda
`null` y `historiaIncompleta: true` lo dice.
-----------------------------------------------------------
*/
function consolidarIdentidades(anterior, resultado, contexto) {
  const { ejecutadaEn, investigacionId } = contexto;

  const previas = Array.isArray(anterior?.cuentas) ? anterior.cuentas : [];

  const inventario = new Map();

  /* 1 · lo que ya se sabia. */
  previas.forEach((c) => {
    const clave = claveIdentidad(c) || claveIdentidad({ ...c, plataformaId: c.plataformaId });

    if (!clave) return;

    inventario.set(clave, {
      ...c,

      /*
        Un expediente anterior a este contrato no traia estos
        campos. Se completan sin fabricar historia.
      */
      firstSeenAt: c.firstSeenAt ?? null,
      lastSeenAt: c.lastSeenAt ?? null,
      lastCheckedAt: c.lastCheckedAt ?? null,
      historiaIncompleta: c.firstSeenAt == null,

      estado: c.estado || ESTADOS_IDENTIDAD.CONSOLIDADA,

      /* Se recalcula abajo con lo de esta corrida. */
      seenInCurrentRun: false
    });
  });

  /* 2 · lo observado ahora. */
  atribuidasDeLaEjecucion(resultado).forEach((obs) => {
    const previa = inventario.get(obs.clave);

    if (!previa) {
      inventario.set(obs.clave, {
        ...obs,

        firstSeenAt: ejecutadaEn,
        lastSeenAt: ejecutadaEn,
        lastCheckedAt: ejecutadaEn,
        historiaIncompleta: false,

        seenInCurrentRun: true,
        ultimaEjecucionObservada: investigacionId,

        estado: obs.referenciaAnalista
          ? ESTADOS_IDENTIDAD.DECLARADA_POR_ANALISTA
          : ESTADOS_IDENTIDAD.ATRIBUIDA,

        proveedoresHistoricos: [...(obs.proveedores || [])],
        proveedoresUltimaObservacion: [...(obs.proveedores || [])]
      });

      return;
    }

    /*
      Ya estaba: se REVALIDA. La identidad no se reconstruye, se
      confirma, y los proveedores historicos se acumulan porque
      son memoria de quien la ha visto alguna vez.
    */
    inventario.set(obs.clave, {
      ...previa,
      ...obs,

      firstSeenAt: previa.firstSeenAt ?? ejecutadaEn,
      lastSeenAt: ejecutadaEn,
      lastCheckedAt: ejecutadaEn,
      historiaIncompleta: previa.firstSeenAt == null,

      seenInCurrentRun: true,
      ultimaEjecucionObservada: investigacionId,

      estado:
        previa.estado === ESTADOS_IDENTIDAD.REVOCADA
          ? ESTADOS_IDENTIDAD.REVOCADA
          : ESTADOS_IDENTIDAD.REVALIDADA,

      proveedoresHistoricos: [
        ...new Set([
          ...(previa.proveedoresHistoricos || previa.proveedores || []),
          ...(obs.proveedores || [])
        ])
      ],
      proveedoresUltimaObservacion: [...(obs.proveedores || [])]
    });
  });

  /* 3 · lo que existia y esta vez no se vio. */
  return [...inventario.values()].map((c) => {
    if (c.seenInCurrentRun) return c;

    /*
      AQUI ESTA LA REGLA. No se borra, no se revoca: se declara
      que no se pudo observar. `lastCheckedAt` avanza porque SI se
      mira; `lastSeenAt` no, porque no se vio.
    */
    return {
      ...c,
      lastCheckedAt: ejecutadaEn,
      estado:
        c.estado === ESTADOS_IDENTIDAD.REVOCADA
          ? ESTADOS_IDENTIDAD.REVOCADA
          : ESTADOS_IDENTIDAD.NO_REENCONTRADA,
      proveedoresUltimaObservacion: []
    };
  });
}


/*
-----------------------------------------------------------
INVENTARIO CONSOLIDADO DE UN CANDIDATO

Lectura autoritativa, la misma que usa `contenidoDeProyecto`.
Existe como funcion propia porque `obtenerCandidato` devuelve el
registro crudo y NO trae expediente: leerlo de ahi fue el
defecto BUG-17.
-----------------------------------------------------------
*/
export async function expedienteDe(proyectoId, tipo, id) {
  const nombres = [`expediente-${tipo}-${id}`, `expediente-${id}`];

  for (const nombre of nombres) {
    try {
      const v = await obtenerVersionEntidad(
        claveLake(proyectoId, TIPO_EXPEDIENTE, nombre),
        {}
      );

      if (v?.registro?.datos) return v.registro.datos;
    } catch {
      /* Se prueba el siguiente nombre. */
    }
  }

  return null;
}


export async function inventarioConsolidado(proyectoId, tipo, id) {
  const expediente = await expedienteDe(proyectoId, tipo, id);

  const cuentas = (expediente?.cuentas || []).filter(
    (c) => c.estado !== ESTADOS_IDENTIDAD.REVOCADA
  );

  return cuentas.map((c) => ({
    plataforma: c.plataforma || null,
    plataformaId: c.plataformaId || null,
    handle: c.handle || null,
    url: c.url || null,
    estado: c.estado || ESTADOS_IDENTIDAD.CONSOLIDADA,
    seenInCurrentRun: c.seenInCurrentRun === true,
    referenciaAnalista: c.referenciaAnalista === true,
    noCuentaComoCorroboracion: c.noCuentaComoCorroboracion === true
  }));
}

/*
  Los proyectos viven en un espacio propio para que el catálogo de
  proyectos no quede dentro de ningún proyecto.
*/
const CATALOGO = "catalogo-proyectos";

/*
  Prefijos de entidad. Son lo que mantiene separados candidatos y
  actores dentro del mismo proyecto.
*/
const PREFIJO_CANDIDATO = "candidato-";

const PREFIJO_ACTOR = "actor-";


function idDesde(texto) {
  return normalizarTexto(texto || "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 60);
}

function linaje(paso) {
  return { submotor: SUBMOTOR, cadena: [paso] };
}

function claveLake(proyectoId, tipo, entidad) {
  return `${TENANT}::${proyectoId}::${tipo}::${entidad}`;
}


/*
===========================================================
PROYECTOS
===========================================================
*/

export async function crearProyecto(datos = {}) {
  const nombre = String(datos.nombre || "").trim();

  if (!nombre) {
    return { creado: false, motivo: "el proyecto necesita un nombre" };
  }

  const id = datos.id || idDesde(nombre);

  const proyecto = {
    id,
    nombre,
    pais: datos.pais || null,
    provincia: datos.provincia || null,
    canton: datos.canton || null,
    dignidad: datos.dignidad || null,
    tipoEleccion: datos.tipoEleccion || null,
    fecha: datos.fecha || null,
    estado: datos.estado || "activo",
    creadoEn: new Date().toISOString(),
    /* El proyecto lo define el analista, no Sentinel. */
    origen: "analista"
  };

  const r = await escribirEnLake(
    {
      entidad: id,
      tipoEntidad: TIPO_PROYECTO,
      tenantId: TENANT,
      proyectoId: CATALOGO,
      fuente: SUBMOTOR,
      linaje: linaje("crear_proyecto"),
      datos: proyecto
    },
    {}
  );

  return { creado: r?.escrito === true, proyecto, motivo: r?.motivo || null };
}


export async function obtenerProyecto(proyectoId) {
  if (!proyectoId) return null;

  try {
    const v = await obtenerVersionEntidad(
      claveLake(CATALOGO, TIPO_PROYECTO, proyectoId),
      {}
    );

    return v?.registro?.datos || null;
  } catch {
    return null;
  }
}


/*
===========================================================
RECUPERACIÓN — el hotfix de persistencia
===========================================================

El defecto que motivó este hotfix no estaba en el
almacenamiento: los proyectos SÍ se escribían a disco, y ahí
seguían. Lo que no existía era cómo LEERLOS de vuelta.

No había forma de listar proyectos ni de listar los candidatos de
un proyecto, así que el frontend solo podía enseñar lo que tenía
en memoria. Al recargar, la memoria se vaciaba y el proyecto
parecía haber desaparecido. No había desaparecido: estaba en
disco, inalcanzable.

Estas dos funciones se apoyan en `obtenerEventosProyecto`, que el
Knowledge Lake ya exponía. No se modifica el Lake.
===========================================================
*/

async function entidadesDe(proyectoId) {
  try {
    const r = await obtenerEventosProyecto(proyectoId, { tenantId: TENANT });

    const vistas = new Set();

    /* Un evento por version; solo interesa la lista de entidades. */
    return (r?.eventos || [])
      .map((e) => ({ entidad: e.entidad, claveEntidad: e.claveEntidad }))
      .filter((e) => {
        if (!e.entidad || vistas.has(e.entidad)) return false;

        vistas.add(e.entidad);

        return true;
      });
  } catch {
    return [];
  }
}


/*
-----------------------------------------------------------
CODIFICACION SOSPECHOSA

U+FFFD es el caracter de reemplazo: aparece cuando unos bytes
no eran UTF-8 valido y alguien los decodifico igualmente. Si
esta en un registro, ese texto se corrompio ANTES de llegar aqui.

Se DETECTA y se declara; no se corrige por sustitucion. Adivinar
que decia un texto corrupto es inventar datos, y ademas taparia
el problema de origen en lugar de mostrarlo.
-----------------------------------------------------------
*/
const REEMPLAZO = "\uFFFD";

function camposCorruptos(objeto) {
  return Object.entries(objeto || {})
    .filter(([, v]) => typeof v === "string" && v.includes(REEMPLAZO))
    .map(([k]) => k);
}


export const ESTADOS = Object.freeze({
  ACTIVO: "activo",
  ARCHIVADO: "archivado",
  ELIMINADO: "eliminado"
});


/*
  Por defecto se listan solo los ACTIVOS. Archivados y eliminados
  se piden explicitamente.
*/
export async function listarProyectos(opciones = {}) {
  const estados = opciones.estados || [ESTADOS.ACTIVO];

  const entidades = await entidadesDe(CATALOGO);

  const proyectos = [];

  for (const e of entidades) {
    const p = await obtenerProyecto(e.entidad);

    if (!p) continue;

    /*
      Los proyectos creados antes de que existieran los estados no
      tienen campo `estado`: se tratan como activos, que es lo que
      eran.
    */
    const estado = p.estado || ESTADOS.ACTIVO;

    if (!estados.includes(estado)) continue;

    const corruptos = camposCorruptos(p);

    proyectos.push({
      ...p,
      estado,
      codificacionSospechosa: corruptos.length > 0,
      camposConCodificacionSospechosa: corruptos
    });
  }

  return proyectos.sort((a, b) =>
    String(b.creadoEn || "").localeCompare(String(a.creadoEn || ""))
  );
}


/*
===========================================================
CICLO DE VIDA DEL PROYECTO
===========================================================

Todo pasa por una version nueva en el Lake, que es append-only.
Nada se destruye: eliminar es marcar un estado, y el expediente
sigue ahi, recuperable.
===========================================================
*/

async function guardarProyecto(proyecto, paso) {
  const r = await escribirEnLake(
    {
      entidad: proyecto.id,
      tipoEntidad: TIPO_PROYECTO,
      tenantId: TENANT,
      proyectoId: CATALOGO,
      fuente: SUBMOTOR,
      linaje: linaje(paso),
      datos: proyecto
    },
    {}
  );

  return r?.escrito === true;
}


/*
  RENOMBRAR — solo el nombre visible.

  El id NO cambia, y no puede cambiar: es la clave con la que el
  Lake guarda candidatos, actores y expedientes. Cambiarlo
  desconectaria el proyecto de todo su contenido.
*/
export async function renombrarProyecto(proyectoId, nombreNuevo) {
  const proyecto = await obtenerProyecto(proyectoId);

  if (!proyecto) {
    return { renombrado: false, motivo: `no existe el proyecto ${proyectoId}` };
  }

  const nombre = String(nombreNuevo || "").trim();

  if (!nombre) {
    return { renombrado: false, motivo: "el nombre no puede quedar vacío" };
  }

  if (nombre === proyecto.nombre) {
    return { renombrado: false, motivo: "el nombre no cambió", proyecto };
  }

  const actualizado = {
    ...proyecto,

    nombre,

    /* Se conserva el anterior: el historial no se pierde. */
    nombreAnterior: proyecto.nombre,

    renombradoEn: new Date().toISOString()
  };

  const ok = await guardarProyecto(actualizado, "renombrar_proyecto");

  return {
    renombrado: ok,
    proyecto: actualizado,
    aviso:
      "Solo cambió el nombre visible. El identificador, el territorio, la dignidad, los candidatos y los expedientes siguen intactos."
  };
}


/*
  CAMBIAR ESTADO — archivar, recuperar o eliminar logicamente.
*/
export async function cambiarEstadoProyecto(proyectoId, estado) {
  if (!Object.values(ESTADOS).includes(estado)) {
    return { actualizado: false, motivo: `estado no válido: ${estado}` };
  }

  const proyecto = await obtenerProyecto(proyectoId);

  if (!proyecto) {
    return { actualizado: false, motivo: `no existe el proyecto ${proyectoId}` };
  }

  const anterior = proyecto.estado || ESTADOS.ACTIVO;

  const actualizado = {
    ...proyecto,

    estado,

    estadoAnterior: anterior,

    /* Sello del cambio, para poder auditar cuando ocurrio. */
    [estado === ESTADOS.ARCHIVADO
      ? "archivadoEn"
      : estado === ESTADOS.ELIMINADO
        ? "eliminadoEn"
        : "recuperadoEn"]: new Date().toISOString()
  };

  const ok = await guardarProyecto(actualizado, `estado_${estado}`);

  const avisos = {
    [ESTADOS.ARCHIVADO]:
      "Proyecto archivado. No aparece en la vista principal, y conserva candidatos, actores, expedientes y evidencias.",
    [ESTADOS.ELIMINADO]:
      "Proyecto eliminado de la vista. Es un borrado lógico: sus datos siguen conservados en el Knowledge Lake y se pueden recuperar.",
    [ESTADOS.ACTIVO]: "Proyecto recuperado. Vuelve a aparecer en Mis proyectos."
  };

  return { actualizado: ok, proyecto: actualizado, aviso: avisos[estado] };
}


/*
  Contenido completo de un proyecto: candidatos, actores y el
  expediente de cada uno si ya fue investigado.

  Devolver el expediente AQUI es lo que permite que la interfaz
  muestre "investigación completada" tras una recarga en lugar de
  volver a lanzar la investigación. Recargar no debe gastar cuota.
*/
/*
-----------------------------------------------------------
EJECUCIONES DE UN CANDIDATO

Una entidad por ejecucion, nunca versiones de la misma: cada
investigacion es un hecho aparte. Se devuelven de la mas
reciente a la mas antigua.
-----------------------------------------------------------
*/
async function ejecucionesDe(proyectoId, entidades, tipo, id) {
  const prefijo = `${PREFIJO_EJECUCION}${tipo}-${id}-`;

  /*
    Se usa la `claveEntidad` que el propio Lake devuelve, en vez
    de reconstruirla: `claveLake` normaliza a minusculas y el
    instante ISO del nombre lleva mayusculas (`T`, `Z`), asi que
    una clave reconstruida a mano no encontraria nada. La
    autoritativa es la que ya viene en el indice.
  */
  const encontradas = (entidades || []).filter(
    (e) => typeof e.entidad === "string" && e.entidad.startsWith(prefijo)
  );

  const ejecuciones = [];

  for (const { claveEntidad } of encontradas) {
    try {
      const v = await obtenerVersionEntidad(claveEntidad, {});

      const datos = v?.registro?.datos;

      if (datos) ejecuciones.push(datos);
    } catch {
      /* Una ejecucion ilegible no invalida las demas. */
    }
  }

  return ejecuciones.sort((a, b) =>
    String(b.ejecutadaEn || "").localeCompare(String(a.ejecutadaEn || ""))
  );
}


export async function contenidoDeProyecto(proyectoId) {
  const proyecto = await obtenerProyecto(proyectoId);

  if (!proyecto) return null;

  const entidades = await entidadesDe(proyectoId);

  const candidatos = [];

  const actores = [];

  for (const e of entidades) {
    const nombre = e.entidad;

    if (nombre.startsWith("expediente-")) continue;

    /* Las ejecuciones se leen aparte, por candidato. */
    if (nombre.startsWith(PREFIJO_EJECUCION)) continue;

    const esActor = nombre.startsWith(PREFIJO_ACTOR);

    const esCandidato = nombre.startsWith(PREFIJO_CANDIDATO);

    if (!esActor && !esCandidato) continue;

    const id = nombre.replace(esActor ? PREFIJO_ACTOR : PREFIJO_CANDIDATO, "");

    const datos = esActor
      ? await obtenerActor(proyectoId, id)
      : await obtenerCandidato(proyectoId, id);

    if (!datos) continue;

    /*
      Expediente, si existe. Sin investigar nada. Se lee con
      `expedienteDe`, la misma via que usa la propagacion de
      handles: una sola lectura autoritativa evita que dos sitios
      discrepen sobre cual es el expediente vigente.
    */
    const expediente = await expedienteDe(
      proyectoId,
      esActor ? "actor" : "candidato",
      id
    );

    /*
      EJECUCIONES de este candidato, la mas reciente primero. El
      expediente dice QUE se sabe; la ejecucion, COMO se supo y
      cuando. Para diagnosticar hace falta la segunda.
    */
    const ejecuciones = await ejecucionesDe(
      proyectoId,
      entidades,
      esActor ? "actor" : "candidato",
      id
    );

    const registro = {
      ...datos,

      /*
        ESTADO PERSISTENTE de la investigacion. Se deriva de que
        exista expediente, no de una bandera que alguien tenga que
        acordarse de escribir.
      */
      estadoInvestigacion: expediente ? "completada" : "sin_investigar",

      /*
        Historial de ejecuciones. `ultimaEjecucion` es la que
        lleva la traza de la ultima vez que se busco de verdad,
        haya cambiado algo o no.
      */
      ejecuciones,
      totalEjecuciones: ejecuciones.length,
      ultimaEjecucion: ejecuciones[0] || null,

      expediente,

      resumen: expediente
        ? {
            cuentas: (expediente.cuentas || []).length,
            medios: (expediente.medios || []).length,
            evidenciasWeb: expediente.evidenciasWeb ?? null,
            evidenciasSociales: expediente.evidenciasSociales ?? null,
            huellaDigital: expediente.huellaDigital ?? null,
            actualizadoEn: expediente.actualizadoEn || null
          }
        : null
    };

    if (esActor) actores.push(registro);
    else candidatos.push(registro);
  }

  const corruptos = camposCorruptos(proyecto);

  return {
    proyecto: {
      ...proyecto,
      estado: proyecto.estado || ESTADOS.ACTIVO,
      codificacionSospechosa: corruptos.length > 0,
      camposConCodificacionSospechosa: corruptos
    },
    candidatos,
    actores,
    metricas: {
      candidatos: candidatos.length,
      actores: actores.length,
      investigaciones: [...candidatos, ...actores].filter(
        (x) => x.estadoInvestigacion === "completada"
      ).length
    }
  };
}


/*
===========================================================
CANDIDATOS DEL PROYECTO
===========================================================
*/

export async function agregarCandidato(proyectoId, datos = {}) {
  const proyecto = await obtenerProyecto(proyectoId);

  if (!proyecto) {
    return { agregado: false, motivo: `no existe el proyecto ${proyectoId}` };
  }

  const nombre = String(datos.nombre || "").trim();

  if (!nombre) {
    return { agregado: false, motivo: "el candidato necesita un nombre" };
  }

  const id = idDesde(nombre);

  /*
    ---------------------------------------------------------
    CUENTA DE REFERENCIA
    ---------------------------------------------------------

    La URL que aporta el analista es una SEMILLA, no un
    veredicto. Se marca con su origen y su estado para que la
    interfaz nunca la presente como cuenta verificada por
    Sentinel: no lo es, y confundirlo seria atribuir a Sentinel
    una conclusion que tomo una persona.
  */
  /*
    Las siete casillas de la ficha, mas cualquier URL suelta. Se
    admite tambien un array `cuentas` para varias de la misma
    plataforma, que es el caso normal: personal y de campana.
  */
  const entradas = [
    ...PLATAFORMAS_FICHA.map((pf) => ({
      url: datos[pf.campo],
      plataforma: pf.nombre
    })),
    { url: datos.urlReferencia, plataforma: datos.plataformaReferencia || null },
    ...(Array.isArray(datos.cuentas) ? datos.cuentas : []).map((c) =>
      typeof c === "string" ? { url: c, plataforma: null } : c
    )
  ];

  const cuentasReferencia = entradas
    .map((e) => construirCuentaReferencia(e?.url, e?.plataforma))
    .filter(Boolean);


  /*
    -----------------------------------------------------------
    ALIAS DECLARADOS POR EL ANALISTA
    -----------------------------------------------------------

    Otras formas de nombrar a la misma persona: «Jota Lloret»,
    «Paul Carrasco», el apodo con el que aparece en prensa.

    QUE HACEN Y QUE NO HACEN

    AMPLIAN el descubrimiento: generan consultas que el nombre
    principal solo no habria generado.

    NO deciden identidad. La atribucion sigue juzgandose contra
    el nombre principal, nunca contra el alias. Si un alias
    pudiera atribuir, el analista estaria dictando de quien es
    una cuenta con solo escribir una palabra, y Sentinel
    confirmaria su propia entrada. Ver la nota de la PASADA 3 en
    platformAdapters.

    Se admite un array o una cadena separada por comas, porque el
    formulario escribe una cosa y la API la otra.
  */
  const aliasEntrantes = (
    Array.isArray(datos.aliases)
      ? datos.aliases
      : String(datos.aliases || datos.alias || "").split(",")
  )
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  const previo = await obtenerCandidato(proyectoId, id);

  const candidato = {
    id,
    nombre,
    /* El rol lo escribe el analista. Sentinel no inventa candidaturas. */
    rol: datos.rol || previo?.rol || null,
    rolOrigen: datos.rol || previo?.rol ? "analista" : null,
    nivel: datos.nivel || previo?.nivel || null,
    dignidad: datos.dignidad || previo?.dignidad || proyecto.dignidad || null,

    /*
      Las cuentas de referencia se ACUMULAN y se deduplican por
      URL: aportar una nueva no borra las anteriores.
    */
    /*
      Se ACUMULAN y se deduplican por identidad de cuenta
      —plataforma + handle—, no por URL literal: la misma cuenta
      escrita con y sin «www» es una sola. Y se admiten varias de
      la misma plataforma, porque son cuentas distintas.
    */
    cuentasReferencia: [
      ...(previo?.cuentasReferencia || []),
      ...cuentasReferencia
    ].filter(
      (r, i, todas) => todas.findIndex((x) => (x.id || x.url) === (r.id || r.url)) === i
    ),

    /* Foto, con su procedencia. Ver construirFoto. */
    foto: construirFoto(datos, previo?.foto),

    /*
      Se ACUMULAN y se deduplican sin distinguir mayusculas ni
      acentos, igual que las cuentas de referencia: aportar uno
      nuevo no borra los anteriores, y escribir «Jota Lloret» dos
      veces no lo guarda dos veces.

      Nunca se guarda un alias igual al nombre principal: no
      aporta ninguna consulta nueva.
    */
    aliases: [
      ...(previo?.aliases || []),
      ...aliasEntrantes.map((valor) => ({
        valor,
        origen: "analista",
        declaradoEn: new Date().toISOString(),
        /*
          La misma marca que llevan las cuentas de referencia, y
          por el mismo motivo.
        */
        noCuentaComoCorroboracion: true
      }))
    ].filter((al, i, todas) => {
      const clave = normalizarTexto(al.valor);

      if (!clave || clave === normalizarTexto(nombre)) return false;

      return (
        todas.findIndex((x) => normalizarTexto(x.valor) === clave) === i
      );
    }),

    agregadoEn: previo?.agregadoEn || new Date().toISOString(),
    actualizadoEn: previo ? new Date().toISOString() : null
  };

  const r = await escribirEnLake(
    {
      entidad: `${PREFIJO_CANDIDATO}${id}`,
      tipoEntidad: TIPO_EXPEDIENTE,
      tenantId: TENANT,
      proyectoId,
      fuente: SUBMOTOR,
      linaje: linaje("agregar_candidato"),
      datos: candidato
    },
    {}
  );

  return {
    agregado: r?.escrito === true,
    candidato,
    proyecto,
    motivo: r?.motivo || null
  };
}


export async function obtenerCandidato(proyectoId, candidatoId) {
  try {
    const v = await obtenerVersionEntidad(
      claveLake(proyectoId, TIPO_EXPEDIENTE, `${PREFIJO_CANDIDATO}${candidatoId}`),
      {}
    );

    return v?.registro?.datos || null;
  } catch {
    return null;
  }
}


/*
===========================================================
ACTORES DE REFERENCIA — ARQ-INV-003
===========================================================

OPCIONAL. Un proyecto funciona perfectamente con cero actores, y
ese es el caso por defecto.

POR QUE SON UNA ENTIDAD APARTE Y NO UN CANDIDATO CON UNA
ETIQUETA
-----------------------------------------------------------

Porque la separacion tiene que ser estructural, no una
convencion que alguien pueda saltarse. Un actor de referencia se
guarda bajo un prefijo de entidad distinto, asi que:

  · no aparece al listar candidatos
  · no entra en la comparacion de candidatos
  · no entra en el calculo de cobertura de ningun candidato

Daniel Noboa no puede colarse en la lista de candidatos a la
alcaldia de Cuenca por accidente: no esta guardado ahi.

`incluirEnComparativo` nace en FALSE. Mientras siga en false el
actor existe, se puede investigar y tiene su propio expediente,
pero no toca nada de los candidatos.
===========================================================
*/

export async function agregarActor(proyectoId, datos = {}) {
  const proyecto = await obtenerProyecto(proyectoId);

  if (!proyecto) {
    return { agregado: false, motivo: `no existe el proyecto ${proyectoId}` };
  }

  const nombre = String(datos.nombre || "").trim();

  if (!nombre) {
    return { agregado: false, motivo: "el actor necesita un nombre" };
  }

  const id = idDesde(nombre);

  const cuentasReferencia = [];

  if (datos.urlReferencia) {
    cuentasReferencia.push({
      plataforma: datos.plataformaReferencia || null,
      url: String(datos.urlReferencia).trim(),
      tipo: "cuenta_referencia",
      origen: "analista",
      estado: "proporcionada_por_analista",
      verificadaPorSentinel: false,
      nota:
        "Cuenta proporcionada por el analista como referencia inicial. Sentinel no la ha verificado."
    });
  }

  const actor = {
    id,
    nombre,
    rol: datos.rol || null,
    rolOrigen: datos.rol ? "analista" : null,
    /* El nivel lo declara el analista; Sentinel no lo adivina. */
    nivel: datos.nivel || null,
    territorio: datos.territorio || null,
    dignidad: datos.dignidad || null,
    cuentasReferencia,

    /*
      NACE DESACTIVADO. Mientras siga asi, este actor no toca
      ningun candidato.
    */
    incluirEnComparativo: datos.incluirEnComparativo === true,

    esActorDeReferencia: true,

    agregadoEn: new Date().toISOString()
  };

  const r = await escribirEnLake(
    {
      entidad: `${PREFIJO_ACTOR}${id}`,
      tipoEntidad: TIPO_EXPEDIENTE,
      tenantId: TENANT,
      proyectoId,
      fuente: SUBMOTOR,
      linaje: linaje("agregar_actor"),
      datos: actor
    },
    {}
  );

  return {
    agregado: r?.escrito === true,
    actor,
    proyecto,
    aviso:
      "Actor de referencia creado. No es candidato y no afecta a los candidatos mientras el análisis comparativo esté desactivado.",
    motivo: r?.motivo || null
  };
}


export async function obtenerActor(proyectoId, actorId) {
  try {
    const v = await obtenerVersionEntidad(
      claveLake(proyectoId, TIPO_EXPEDIENTE, `${PREFIJO_ACTOR}${actorId}`),
      {}
    );

    return v?.registro?.datos || null;
  } catch {
    return null;
  }
}


export async function activarComparativo(proyectoId, actorId, activar) {
  const actor = await obtenerActor(proyectoId, actorId);

  if (!actor) {
    return { actualizado: false, motivo: `no existe el actor ${actorId}` };
  }

  const nuevo = { ...actor, incluirEnComparativo: activar === true };

  const r = await escribirEnLake(
    {
      entidad: `${PREFIJO_ACTOR}${actorId}`,
      tipoEntidad: TIPO_EXPEDIENTE,
      tenantId: TENANT,
      proyectoId,
      fuente: SUBMOTOR,
      linaje: linaje("activar_comparativo"),
      datos: nuevo
    },
    {}
  );

  return {
    actualizado: r?.escrito === true,
    actor: nuevo,
    aviso: nuevo.incluirEnComparativo
      ? "Análisis comparativo activado. La correlación que se calcule es OBSERVABLE: coincidencia de temas, medios y tiempo. No implica transferencia de votos ni causalidad."
      : "Análisis comparativo desactivado. El actor no afecta a ningún candidato."
  };
}


/*
===========================================================
EXPEDIENTE VIVO
===========================================================
*/

/*
===========================================================
CONTRATO DE FULL DISCOVERY — ESTADO POR PLATAFORMA
===========================================================

Para cada una de las seis plataformas obligatorias el
expediente devuelve EXACTAMENTE UNO de estos cinco estados.

    ATRIBUIDA               hay una cuenta atribuida al objetivo
    ENCONTRADA_NO_ATRIBUIDA se hallaron candidatos, ninguno paso
    BUSCADA_SIN_RESULTADO   se consulto bien y no habia nada
    NO_EJECUTADA            no se lanzo ninguna consulta
    ERROR_PROVIDER          se intento y el proveedor no respondio

POR QUE CINCO Y NO DOS

Porque "no tiene cuenta" y "no pudimos mirar" son cosas
distintas, y colapsarlas convierte una limitacion nuestra en
una afirmacion sobre la persona. Sentinel no dice "no tiene red
social": dice que observo.

Las tres ultimas son las que el diagnostico del piloto no pudo
distinguir, porque el expediente no las guardaba.
===========================================================
*/

export const ESTADOS_PLATAFORMA = Object.freeze({
  ATRIBUIDA: "ATRIBUIDA",
  ENCONTRADA_NO_ATRIBUIDA: "ENCONTRADA_NO_ATRIBUIDA",
  BUSCADA_SIN_RESULTADO: "BUSCADA_SIN_RESULTADO",
  NO_EJECUTADA: "NO_EJECUTADA",
  ERROR_PROVIDER: "ERROR_PROVIDER"
});


/*
  Tope de candidatos sociales que se guardan por expediente.

  Existe para que un expediente no crezca sin limite en un Lake
  append-only. Cuando recorta, lo DICE: `candidatosTruncados`
  lleva la cuenta. Un recorte silencioso se leeria como "esto es
  todo lo que habia", que es justo el error que este patch
  corrige.
*/
const TOPE_CANDIDATOS = 120;

const TOPE_CONSULTAS = 60;


/*
  Clave estable plataforma+handle, para cruzar lo que descubrio
  el Discovery con el veredicto de la clasificacion.
*/
function claveCuenta(c) {
  const plataforma = c?.plataformaId || c?.platform || c?.plataforma || "";

  return `${normalizarTexto(String(plataforma))}:${normalizarTexto(
    String(c?.handle || "")
  )}`;
}


/*
-----------------------------------------------------------
CONSULTAS EJECUTADAS

Se juntan las que se LANZARON (`intentos`, con su proveedor y su
estado real) con las que se PLANIFICARON y nunca salieron. Las
segundas son la diferencia entre "no habia nada" y "no se
busco", y sin ellas el expediente no puede sostener el contrato
de arriba.
-----------------------------------------------------------
*/
function consultasDeLaInvestigacion(resultado) {
  const d = resultado?.social?.descubrimiento || {};

  const intentos = Array.isArray(d.intentos) ? d.intentos : [];

  const plan = Array.isArray(d.plan) ? d.plan : [];

  const lanzadas = intentos.map((i) => ({
    consulta: i.consulta,
    proposito: i.etiqueta || null,
    plataformaId: i.plataformaId || null,
    proveedor: i.proveedorUsado || null,
    ejecutada: true,
    estado: i.estado || null,
    resultados: Number.isFinite(i.resultados) ? i.resultados : null,
    coberturaParcial: i.coberturaParcial ?? null
  }));

  const consultadas = new Set(intentos.map((i) => normalizarTexto(i.consulta)));

  const noLanzadas = plan
    .filter((e) => !consultadas.has(normalizarTexto(e.consulta)))
    .map((e) => ({
      consulta: e.consulta,
      proposito: e.etiqueta || null,
      plataformaId: e.plataformaId || null,
      proveedor: null,
      ejecutada: false,
      estado: "NO_EJECUTADA",
      resultados: null,
      motivo:
        d.descubrimientoSocial?.motivoOmision ||
        "Planificada y no lanzada: sin proveedor utilizable o presupuesto agotado."
    }));

  return [...lanzadas, ...noLanzadas];
}


/*
-----------------------------------------------------------
COBERTURA NORMALIZADA POR PLATAFORMA

El Discovery ya calcula `estadoPresencia`. Aqui se traduce al
contrato de cinco estados, cruzandolo con si alguna cuenta de
esa plataforma llego a ATRIBUIRSE, que es lo que el
`estadoPresencia` por si solo no distingue.
-----------------------------------------------------------
*/
function coberturaNormalizada(resultado, consultas, descartadas) {
  const cobertura = resultado?.social?.cobertura || [];

  const atribuidas = resultado?.perfilEjecutivo?.tarjetas || [];

  return cobertura.map((c) => {
    const deLaPlataforma = consultas.filter(
      (q) => q.plataformaId === c.plataformaId
    );

    const lanzadas = deLaPlataforma.filter((q) => q.ejecutada);

    const conExito = lanzadas.filter((q) => q.estado === "OK");

    /*
      RESULTADOS DEVUELTOS por el buscador para esta plataforma.
      Es el dato que faltaba: sin el no se distingue "la consulta
      volvio vacia" de "volvio con diez enlaces y ninguno era un
      perfil".
    */
    const resultados = conExito.reduce(
      (n, q) => n + (Number.isFinite(q.resultados) ? q.resultados : 0),
      0
    );

    const descartesDeLaPlataforma = (descartadas || []).filter(
      (d) =>
        d.plataformaId === c.plataformaId ||
        (d.plataforma &&
          normalizarTexto(d.plataforma) === normalizarTexto(c.plataforma))
    );

    const nAtribuidas = atribuidas.filter(
      (t) => (t.plataformaId || t.platform) === c.plataformaId
    ).length;

    let estado;

    let explicacion;

    if (nAtribuidas > 0) {
      estado = ESTADOS_PLATAFORMA.ATRIBUIDA;
      explicacion = `${nAtribuidas} cuenta(s) atribuida(s) al objetivo.`;
    } else if ((c.candidatos || 0) > 0) {
      /*
        Se encontraron cuentas y ninguna paso el clasificador.
        Aqui vive la perdida del matcher, si la hay.
      */
      estado = ESTADOS_PLATAFORMA.ENCONTRADA_NO_ATRIBUIDA;
      explicacion = `${c.candidatos} candidato(s) encontrado(s), ninguno atribuido.`;
    } else if (resultados > 0 || descartesDeLaPlataforma.length > 0) {
      /*
        ---------------------------------------------------------
        BUG-15 — EL BUSCADOR SI DEVOLVIO ALGO
        ---------------------------------------------------------

        Antes esto caia en BUSCADA_SIN_RESULTADO, que afirma algo
        distinto y mas fuerte: que no habia nada. En la reprueba
        real Instagram devolvio DIEZ enlaces —todos publicaciones
        y reels— y quedo etiquetada como si la busqueda hubiera
        vuelto vacia.

        Son dos hechos distintos:

            no habia nada                    ausencia
            habia contenido, no perfiles     no atribuible

        Colapsarlos es exactamente lo que el contrato de cinco
        estados existe para evitar. El descarte y su motivo van
        adjuntos para que se pueda leer por que.
        ---------------------------------------------------------
      */
      estado = ESTADOS_PLATAFORMA.ENCONTRADA_NO_ATRIBUIDA;
      explicacion = `El buscador devolvió ${resultados} resultado(s) y ${descartesDeLaPlataforma.length} URL(s) se descartaron por no identificar una cuenta. No se encontró ningún perfil atribuible; no es una ausencia.`;
    } else if (conExito.length > 0) {
      estado = ESTADOS_PLATAFORMA.BUSCADA_SIN_RESULTADO;
      explicacion = "Se consultó correctamente y el buscador no devolvió resultados.";
    } else if (lanzadas.length > 0) {
      estado = ESTADOS_PLATAFORMA.ERROR_PROVIDER;
      explicacion = `Se intentó consultar y el proveedor no respondió (${[
        ...new Set(lanzadas.map((q) => q.estado).filter(Boolean))
      ].join(", ")}). No se puede afirmar ausencia.`;
    } else {
      estado = ESTADOS_PLATAFORMA.NO_EJECUTADA;
      explicacion = "No se lanzó ninguna consulta para esta plataforma.";
    }

    return {
      plataformaId: c.plataformaId,
      plataforma: c.plataforma,
      estado,
      explicacion,

      atribuidas: nAtribuidas,
      candidatos: c.candidatos || 0,

      /* El dato que faltaba, expuesto. */
      resultadosDelBuscador: resultados,

      urlsDescartadas: descartesDeLaPlataforma.length,
      motivosDeDescarte: [
        ...new Set(descartesDeLaPlataforma.map((d) => d.motivo).filter(Boolean))
      ].slice(0, 5),

      consultasPlanificadas: deLaPlataforma.length,
      consultasLanzadas: lanzadas.length,
      consultasConExito: conExito.length,
      estadosDeProveedor: [
        ...new Set(lanzadas.map((q) => q.estado).filter(Boolean))
      ],

      /* El motivo que ya redactaba el Discovery, sin reescribirlo. */
      motivo: c.motivoCobertura || null,
      estadoPresencia: c.estadoPresencia || null,
      modoAccesoDeclarado: c.modoAccesoDeclarado || null
    };
  });
}


/*
-----------------------------------------------------------
CANDIDATOS SOCIALES, ACEPTADOS Y RECHAZADOS

Se cruza lo que el Discovery descubrio —que trae proveedor, via
y procedencia— con el veredicto de la clasificacion, que trae el
motivo. Ninguno de los dos lados solo alcanza: el Discovery no
sabe por que se rechazo, y la clasificacion no sabe quien lo
aporto.
-----------------------------------------------------------
*/
function candidatosSociales(resultado) {
  /*
    -----------------------------------------------------------
    LA FUENTE REAL — BUG-15
    -----------------------------------------------------------

    La primera version leia `resultado.social.candidatos`, que NO
    EXISTE: `socialIntelligenceLayer` devuelve `fichas`, no
    `candidatos`. La lista salia vacia siempre, y en la reprueba
    real de Lloret se perdieron los motivos de 24 rechazos de 26
    candidatos. Un campo mal elegido convirtio la traza en un
    formulario en blanco.

    La fuente correcta es `clasificacionCuentas`, y es la mejor
    porque trae las dos mitades en el mismo objeto:

        el VEREDICTO      clasificacion.clase y sus razones
        la PROCEDENCIA    origenes, vias, proveedores

    Sus cuatro grupos son el grupo completo de candidatos ya
    clasificados. `social.fichas` queda como respaldo para el
    caso en que la clasificacion no llegue a construirse.

    Aqui NO se clasifica nada: solo se preserva lo que el motor
    ya decidio.
    -----------------------------------------------------------
  */
  const cl = resultado?.clasificacionCuentas || null;

  const grupos = cl
    ? [
        { lista: cl.cuentasObjetivo, aceptado: true, clase: "cuenta_personal" },
        { lista: cl.medios, aceptado: false, clase: "medio" },
        { lista: cl.instituciones, aceptado: false, clase: "institucion" },
        { lista: cl.indeterminadas, aceptado: false, clase: "no_determinado" }
      ]
    : [
        /*
          Respaldo: sin clasificacion no hay veredicto, y se dice
          en el motivo en lugar de dejarlo en blanco.
          `social.candidatos` se conserva por si una version
          futura del layer lo expone.
        */
        {
          lista: resultado?.social?.fichas || resultado?.social?.candidatos || [],
          aceptado: null,
          clase: null
        }
      ];

  const url = (c) => c?.url?.canonica || c?.url?.original || c?.url || null;

  const score = (c) =>
    c?.correspondencia?.puntuacion ?? (
      typeof c?.correspondencia === "number" ? c.correspondencia : null
    );

  const filas = [];

  grupos.forEach(({ lista, aceptado, clase }) => {
    (lista || []).forEach((c) => {
      const origenes = c.origenes || [];

      const razones = c.clasificacion?.razones || [];

      filas.push({
        plataforma: c.plataforma || null,
        plataformaId: c.plataformaId || c.platform || null,
        url: url(c),
        handle: c.handle || null,
        displayName: c.nombreVisible || c.nombreObservado || null,

        /* ---- veredicto, tal como lo dejo el motor ---- */
        aceptado: aceptado === null ? null : aceptado,
        clase: c.clasificacion?.clase || clase,
        score: score(c),
        nivelCorrespondencia: c.correspondencia?.nivel || null,

        motivo:
          razones[0] ||
          c.clasificacion?.motivoSeparacion ||
          c.correspondencia?.explicacion?.resumen ||
          (aceptado === null
            ? "La clasificación no llegó a construirse en esta ejecución."
            : null),

        razones,

        /* ---- procedencia ---- */
        origenes,
        vias: c.vias || c.corroboracion?.vias || [],

        /*
          El consolidador no propaga `viasDeclaradas`, pero SI
          propaga los origenes con su marca, asi que se deriva de
          ahi. Es la misma razon por la que la procedencia del
          analista se calcula y no se lee: el dato existe, solo
          hay que mirarlo donde esta.
        */
        viasDeclaradas:
          c.viasDeclaradas && c.viasDeclaradas.length
            ? c.viasDeclaradas
            : [
                ...new Set(
                  origenes
                    .filter((o) => o.noCuentaComoCorroboracion === true)
                    .map((o) => o.via)
                    .filter(Boolean)
                )
              ],
        proveedores: c.proveedores || c.corroboracion?.proveedores || [],

        corroboracion: c.corroboracion
          ? {
              proveedores: c.corroboracion.proveedores || [],
              totalProveedores: c.corroboracion.totalProveedores ?? null,
              multiProveedor: c.corroboracion.multiProveedor ?? null,
              vias: c.corroboracion.vias || [],
              multiVia: c.corroboracion.multiVia ?? null
            }
          : null,

        consultas: [
          ...new Set(origenes.map((o) => o.consulta).filter(Boolean))
        ],

        /*
          Procedencia del analista. Se deriva de los origenes y no
          de una bandera que el consolidador podria no propagar:
          las fichas no llevan `aportadaPorAnalista`, pero si
          llevan los origenes con su marca.
        */
        origen: origenes.some((o) => o.origen === "analista")
          ? "analista"
          : "sentinel",
        aportadaPorAnalista: origenes.some((o) => o.origen === "analista"),
        noCuentaComoCorroboracion: origenes.some(
          (o) => o.noCuentaComoCorroboracion === true
        )
      });
    });
  });

  /*
    URLs de plataforma que SD-1A descarto antes de llegar a ser
    candidatas: un post, un reel, una ruta sin propietario. Se
    guardan aparte porque su motivo es de otra naturaleza —la URL
    no identifica una cuenta— y porque son la explicacion de que
    una plataforma devuelva resultados y ningun perfil.
  */
  const descartadasPorUrl = (
    resultado?.social?.descubrimiento?.descartados || []
  ).map((d) => ({
    url: d.url || d.enlace || null,
    plataforma: d.plataforma?.nombre || d.plataforma || null,
    plataformaId: d.plataformaId || d.plataforma?.id || null,
    motivo: d.motivo || d.motivoDescarte || null,
    tipoUrl: d.tipo || d.tipoUrl || null
  }));

  return { filas, descartadasPorUrl };
}


/*
-----------------------------------------------------------
CONSUMO OBSERVABLE POR PROVEEDOR

Consultas, no dinero. El coste monetario real no lo conoce el
sistema y no se inventa: se registra lo que si es observable
—intentos, exitos, bloqueos, errores y resultados— que es lo
que permite explicar despues por que una plataforma quedo sin
mirar.
-----------------------------------------------------------
*/
function consumoDeProveedores(resultado) {
  const r = resultado?.social?.descubrimiento?.proveedores || null;

  const lista = Array.isArray(r) ? r : r?.proveedores || [];

  return lista.map((p) => ({
    id: p.id || null,
    proveedor: p.nombre || null,
    consultasIntentadas: p.intentos ?? null,
    consultasCompletadas: p.exitos ?? null,
    bloqueos: p.bloqueos ?? null,
    errores: p.errores ?? null,
    noIntentadas: p.noIntentados ?? null,
    resultados: p.resultados ?? null,
    costeMonetario: null,
    notaDeCoste:
      "Consumo observable en consultas. El sistema no conoce el coste monetario y no lo estima."
  }));
}


function resumirExpediente(resultado, anterior = null, contexto = {}) {
  const pe = resultado?.perfilEjecutivo || null;

  const f = resultado?.fichaObjetivo || null;

  const cl = resultado?.clasificacionCuentas || null;

  const clave = (c) =>
    `${c.plataformaId || c.platform}:${String(c.handle).toLowerCase()}`;

  /*
    -----------------------------------------------------------
    TRAZA DE AUDITORIA — BUG-12
    -----------------------------------------------------------

    El motor ya calculaba todo esto y se tiraba al persistir. Sin
    ello una investigacion no se puede diagnosticar despues: no
    habia forma de saber si una plataforma se busco y estaba
    vacia, o no se busco.

    No se recalcula nada aqui y no hay un segundo motor: se leen
    las estructuras que `descubrirCandidatos` y `perfilEjecutivo`
    ya devuelven, y se les da forma estable.

    No se guardan claves de API ni payloads de proveedor: solo
    consultas, estados y recuentos.
    -----------------------------------------------------------
  */
  const consultas = consultasDeLaInvestigacion(resultado);

  const { filas: sociales, descartadasPorUrl } = candidatosSociales(resultado);

  /*
    La cobertura necesita los descartes: son la unica forma de
    explicar que una plataforma devuelva resultados y ningun
    perfil.
  */
  const cobertura = coberturaNormalizada(resultado, consultas, descartadasPorUrl);

  return {
    /*
      TRAZA. Va primero porque es lo que se mira cuando algo
      sale vacio.
    */
    traza: {
      version: "1.0",

      consultas: consultas.slice(0, TOPE_CONSULTAS),
      totalConsultas: consultas.length,
      consultasTruncadas: Math.max(0, consultas.length - TOPE_CONSULTAS),

      coberturaPlataformas: cobertura,

      candidatosSociales: sociales.slice(0, TOPE_CANDIDATOS),
      totalCandidatosSociales: sociales.length,
      candidatosTruncados: Math.max(0, sociales.length - TOPE_CANDIDATOS),

      urlsDescartadas: descartadasPorUrl.slice(0, TOPE_CANDIDATOS),
      totalUrlsDescartadas: descartadasPorUrl.length,

      proveedores: consumoDeProveedores(resultado),

      anclasUsadas: (resultado?.social?.descubrimiento?.anclasUsadas || []).map(
        (a) => a.termino || a
      ),

      aliasUsados: resultado?.social?.descubrimiento?.aliasUsados || [],

      /*
        Propagacion de handles: que se pregunto en otras
        plataformas, que se omitio por estar ya resuelto y que no
        cupo en el tope. El truncamiento se declara: un recorte
        silencioso se leeria como "no habia mas que preguntar".
      */
      handlesPropagados:
        resultado?.social?.descubrimiento?.handlesPropagados || [],
      consultasPropagadas:
        resultado?.social?.descubrimiento?.consultasPropagadas || 0,
      propagadasTruncadas:
        resultado?.social?.descubrimiento?.propagadasTruncadas || 0,
      propagacionOmitidaPorAtribuida:
        resultado?.social?.descubrimiento?.propagacionOmitidaPorAtribuida || [],

      advertencias: resultado?.social?.descubrimiento?.advertencias || [],

      contrato:
        "Cada plataforma declara uno de cinco estados. ATRIBUIDA, ENCONTRADA_NO_ATRIBUIDA, BUSCADA_SIN_RESULTADO, NO_EJECUTADA o ERROR_PROVIDER. Ninguno de ellos afirma que la persona no tenga cuenta."
    },

    /*
      ---------------------------------------------------------
      INVENTARIO CONSOLIDADO — BUG-19
      ---------------------------------------------------------

      Antes: `(pe?.tarjetas || []).map(...)`. El expediente se
      reescribia con lo de la ultima corrida, asi que una cuenta
      atribuida desaparecia si el buscador no la devolvia otra
      vez.

      Ahora se funde con lo que ya habia. La ausencia de
      observacion no revoca una identidad: la marca como no
      reencontrada y sigue en el inventario. Ver
      `consolidarIdentidades`.
      ---------------------------------------------------------
    */
    cuentas: consolidarIdentidades(anterior, resultado, {
      ejecutadaEn: contexto.ejecutadaEn || null,
      investigacionId: contexto.investigacionId || null
    }),

    medios: (pe?.medios || []).map((m) => ({
      plataforma: m.plataforma,
      handle: m.handle,
      url: m.url
    })),

    instituciones: (pe?.instituciones || []).map((m) => ({
      plataforma: m.plataforma,
      handle: m.handle,
      url: m.url
    })),

    /*
      MENCIONES vs PUBLICACIONES PROPIAS.

      Una evidencia cuya URL pertenece a una cuenta atribuida es
      publicacion propia. Cualquier otra que nombre al objetivo es
      mencion de un tercero. No se mezclan.
    */
    menciones: (f?.evidencias?.web || []).length,

    evidenciasWeb: (f?.evidencias?.web || []).length,

    evidenciasSociales: (f?.evidencias?.sociales || []).length,

    huellaDigital: pe?.huellaDigital?.valor ?? null,

    clavesCuenta: (cl?.cuentasObjetivo || []).map(clave).sort()
  };
}


/*
===========================================================
EDITAR LA IDENTIDAD DE UN CANDIDATO
===========================================================

Sin borrar y recrear. Recrear perderia el expediente, las
ejecuciones y el inventario consolidado, que es justo lo que el
analista NO quiere perder al corregir un nombre.

Lo que llega con valor se actualiza; lo que llega vacio se deja
como estaba. Para quitar una cuenta hay que pedirlo
explicitamente por su id: un formulario enviado a medias no
puede borrar identidad.
===========================================================
*/
export async function editarCandidato(proyectoId, candidatoId, cambios = {}) {
  const previo = await obtenerCandidato(proyectoId, candidatoId);

  if (!previo) {
    return {
      editado: false,
      motivo: `el candidato ${candidatoId} no está en el proyecto ${proyectoId}`
    };
  }

  const nombre = String(cambios.nombre || "").trim();

  /*
    El id NO cambia aunque cambie el nombre: es la clave con la
    que el Lake guarda el expediente y las ejecuciones. Es la
    misma razon por la que renombrar un proyecto no cambia su id.
  */
  const nuevasEntradas = [
    ...PLATAFORMAS_FICHA.map((pf) => ({
      url: cambios[pf.campo],
      plataforma: pf.nombre
    })),
    ...(Array.isArray(cambios.cuentas) ? cambios.cuentas : []).map((c) =>
      typeof c === "string" ? { url: c, plataforma: null } : c
    )
  ]
    .map((e) => construirCuentaReferencia(e?.url, e?.plataforma))
    .filter(Boolean);

  /* Retiradas explicitas, por id. */
  const aQuitar = new Set(
    (Array.isArray(cambios.quitarCuentas) ? cambios.quitarCuentas : []).map(
      String
    )
  );

  const ahora = new Date().toISOString();

  const acumuladas = [...(previo.cuentasReferencia || []), ...nuevasEntradas]
    .filter(
      (r, i, todas) => todas.findIndex((x) => (x.id || x.url) === (r.id || r.url)) === i
    )
    .map((r) => {
      /*
        ---------------------------------------------------------
        RETIRAR ES MARCAR, NO BORRAR
        ---------------------------------------------------------

        La primera version filtraba la entrada fuera del array, y
        con ella desaparecia por que se habia declarado, cuando y
        quien lo hizo. Retirar una cuenta es una decision del
        analista, y una decision es un dato: hay que poder leer
        despues que se tomo.

        REVOCADA es lo contrario de NO_REENCONTRADA. Una la decide
        una persona; la otra, el silencio de un buscador. Por eso
        la revocada consta con su fecha y la no reencontrada no
        cambia de estado de identidad.
        ---------------------------------------------------------
      */
      if (aQuitar.has(String(r.id))) {
        return {
          ...r,
          estado: ESTADOS_IDENTIDAD.REVOCADA,
          revocadaEn: ahora,
          revocadaPor: "analista",
          /* Se conserva el estado que tenia antes de retirarla. */
          estadoAnterior: r.estado || null,
          actualizadaEn: ahora
        };
      }

      /*
        Reintroducir una cuenta revocada la reactiva: el analista
        cambio de opinion y eso tambien es una decision.
      */
      if (
        r.estado === ESTADOS_IDENTIDAD.REVOCADA &&
        nuevasEntradas.some((n) => n.id === r.id)
      ) {
        return {
          ...r,
          estado: ESTADOS_IDENTIDAD.DECLARADA_POR_ANALISTA,
          reactivadaEn: ahora,
          actualizadaEn: ahora
        };
      }

      return nuevasEntradas.some((n) => n.id === r.id)
        ? { ...r, actualizadaEn: ahora }
        : r;
    });

  /* Alias: se acumulan y se deduplican, como en agregarCandidato. */
  const aliasEntrantes = (
    Array.isArray(cambios.aliases)
      ? cambios.aliases
      : String(cambios.aliases || cambios.alias || "").split(",")
  )
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  const aliases = [
    ...(previo.aliases || []),
    ...aliasEntrantes.map((valor) => ({
      valor,
      origen: "analista",
      declaradoEn: new Date().toISOString(),
      noCuentaComoCorroboracion: true
    }))
  ].filter((al, i, todas) => {
    const clave = normalizarTexto(al.valor);

    if (!clave || clave === normalizarTexto(nombre || previo.nombre)) return false;

    return todas.findIndex((x) => normalizarTexto(x.valor) === clave) === i;
  });

  const candidato = {
    ...previo,

    nombre: nombre || previo.nombre,
    nombreAnterior: nombre && nombre !== previo.nombre ? previo.nombre : previo.nombreAnterior || null,

    rol: cambios.rol || previo.rol || null,
    nivel: cambios.nivel || previo.nivel || null,
    dignidad: cambios.dignidad || previo.dignidad || null,

    aliases,
    cuentasReferencia: acumuladas,
    foto: construirFoto(cambios, previo.foto),

    actualizadoEn: new Date().toISOString()
  };

  const r = await escribirEnLake(
    {
      entidad: `${PREFIJO_CANDIDATO}${candidatoId}`,
      tipoEntidad: TIPO_EXPEDIENTE,
      tenantId: TENANT,
      proyectoId,
      fuente: SUBMOTOR,
      linaje: linaje("editar_candidato"),
      datos: candidato
    },
    {}
  );

  return {
    editado: r?.escrito === true,
    candidato,
    aviso:
      "Identidad actualizada. El identificador, el expediente y las cuentas ya consolidadas no cambian; las URLs que escribiste entran como declaradas por el analista y sin verificar."
  };
}


/*
===========================================================
FICHA DE IDENTIDAD PARA LA INTERFAZ
===========================================================

Une lo que el analista declaro con lo que Sentinel consolido, y
devuelve SIEMPRE las siete plataformas de la ficha, incluso las
vacias.

POR QUE SIEMPRE LAS SIETE

Porque «no tiene cuenta» y «no hemos encontrado cuenta» son cosas
distintas, y una lista que solo muestra lo hallado las vuelve
indistinguibles. La misma razon por la que la cobertura declara
las seis plataformas aunque esten vacias.

Y por que las dos procedencias a la vez: una cuenta puede estar
declarada por el analista Y corroborada por Sentinel. No es una
contradiccion, es informacion mas rica, y la ficha la muestra
entera.
===========================================================
*/
export async function fichaIdentidad(proyectoId, candidatoId, tipo = "candidato") {
  const candidato =
    tipo === "actor"
      ? await obtenerActor(proyectoId, candidatoId)
      : await obtenerCandidato(proyectoId, candidatoId);

  if (!candidato) return null;

  const expediente = await expedienteDe(proyectoId, tipo, candidatoId);

  const consolidadas = expediente?.cuentas || [];

  const declaradas = candidato.cuentasReferencia || [];

  const claveDe = (c) =>
    `${normalizarTexto(String(c.plataformaId || ""))}:${normalizarTexto(
      String(c.handle || "")
    )}`;

  const porClave = new Map();

  /* 1 · lo consolidado por Sentinel. */
  consolidadas.forEach((c) => {
    porClave.set(claveDe(c), {
      /*
        Identidad de la entrada. La interfaz la necesita para
        pedir una retirada por id exacto: comparar por handle
        suelto fallaria con acentos o mayusculas.
      */
      id: claveDe(c),
      plataformaId: c.plataformaId,
      plataforma: c.plataforma,
      url: c.url,
      handle: c.handle,

      estado: c.estado || ESTADOS_IDENTIDAD.CONSOLIDADA,

      /* Las dos procedencias, por separado y a la vez. */
      declaradaPorAnalista: c.referenciaAnalista === true,
      descubiertaPorSentinel: c.referenciaAnalista !== true,
      corroboradaPorSentinel:
        (c.proveedoresHistoricos || c.proveedores || []).length > 0,

      seenInCurrentRun: c.seenInCurrentRun === true,
      firstSeenAt: c.firstSeenAt || null,
      lastSeenAt: c.lastSeenAt || null,
      lastCheckedAt: c.lastCheckedAt || null,
      historiaIncompleta: c.historiaIncompleta === true,

      proveedoresHistoricos: c.proveedoresHistoricos || c.proveedores || [],
      proveedoresUltimaObservacion: c.proveedoresUltimaObservacion || [],
      corroboracion: c.corroboracion || null,
      correspondencia: c.correspondencia ?? null,
      noCuentaComoCorroboracion: c.noCuentaComoCorroboracion === true
    });
  });

  /*
    2 · lo declarado que aun no se ha consolidado.

    Las REVOCADAS no entran en la ficha activa: el analista las
    retiro. Pero no se pierden —se devuelven aparte en
    `revocadas`— porque una decision tambien es un dato.
  */
  const declaradasActivas = declaradas.filter(
    (d) => d.estado !== ESTADOS_IDENTIDAD.REVOCADA
  );

  declaradasActivas.forEach((d) => {
    const clave = claveDe(d);

    const ya = porClave.get(clave);

    if (ya) {
      /*
        Ya la conocia Sentinel: se marca tambien como declarada.
        Las dos cosas son verdad.
      */
      ya.declaradaPorAnalista = true;

      return;
    }

    porClave.set(clave, {
      id: d.id || clave,
      plataformaId: d.plataformaId,
      plataforma: d.plataforma,
      url: d.url,
      handle: d.handle,

      estado: d.estado || ESTADOS_IDENTIDAD.DECLARADA_POR_ANALISTA,
      revocadaEn: d.revocadaEn || null,

      declaradaPorAnalista: true,
      descubiertaPorSentinel: false,
      corroboradaPorSentinel: false,

      seenInCurrentRun: false,
      firstSeenAt: d.creadaEn || null,
      lastSeenAt: null,
      lastCheckedAt: null,
      historiaIncompleta: false,

      proveedoresHistoricos: [],
      proveedoresUltimaObservacion: [],
      corroboracion: null,
      correspondencia: null,
      noCuentaComoCorroboracion: true
    });
  });

  const cuentas = [...porClave.values()];

  /*
    FOTOGRAFIA DERIVADA. Se calcula sobre las cuentas que ya
    estan en el expediente: no se crea otro registro de redes y
    no se consulta a nadie. Lo que no es obtenible se declara.
  */
  const fotoDeCuentas = seleccionarFotoDeCuentas(cuentas);

  /*
    DIAGNOSTICO DE LA FOTOGRAFIA YA GUARDADA.

    Los expedientes escritos antes de este contrato pueden tener
    una URL de cuenta en el campo de fotografia: era lo que
    producia el icono roto. La interfaz ya no la pinta, pero
    callarse el motivo dejaria un hueco sin explicacion.

    No se corrige el dato: se diagnostica. Reescribir el
    expediente del analista sin que lo pida seria decidir por el.
  */
  const foto = candidato.foto || null;

  const diagnosticoFoto = foto?.url
    ? diagnosticarUrlFoto(foto.url)
    : { valida: false, motivo: "no hay fotografía registrada" };

  /* 3 · las siete plataformas, tambien las vacias. */
  const plataformas = PLATAFORMAS_FICHA.map((pf) => {
    const suyas = cuentas.filter((c) => c.plataformaId === pf.id);

    return {
      plataformaId: pf.id,
      plataforma: pf.nombre,
      cuentas: suyas,
      total: suyas.length,

      /*
        PENDIENTE no afirma ausencia: dice que aqui todavia no hay
        nada atribuido. Es lo que la interfaz necesita para no
        escribir «no tiene».
      */
      estado: suyas.length
        ? suyas[0].estado
        : ESTADOS_IDENTIDAD_FICHA.PENDIENTE
    };
  });

  return {
    candidatoId,
    tipo,
    nombre: candidato.nombre,
    aliases: candidato.aliases || [],
    foto: candidato.foto || null,
    rol: candidato.rol || null,
    nivel: candidato.nivel || null,
    dignidad: candidato.dignidad || null,

    plataformas,

    /*
      -----------------------------------------------------------
      FOTOGRAFIA: LO MANUAL MANDA, Y LO QUE FALTA SE EXPLICA
      -----------------------------------------------------------

      `foto` es la vigente. `fotoSugerida` es la que se derivaria
      de una cuenta si no hubiera manual, y `fotoNoDisponible`
      dice por que las demas plataformas no dan imagen.

      Ese ultimo campo importa: sin el, un hueco parece un fallo
      del sistema en lugar de una limitacion conocida y declarada.
    */
    /*
      `foto.utilizable` dice si se puede pintar. Si no, `motivo`
      explica por que, y se sugiere una derivada como si no
      hubiera ninguna: una URL que no es imagen no es una
      fotografia.
    */
    foto: foto
      ? {
          ...foto,
          utilizable: diagnosticoFoto.valida === true,
          motivoNoUtilizable: diagnosticoFoto.valida ? null : diagnosticoFoto.motivo,
          esUrlDeCuenta: diagnosticoFoto.esUrlDeCuenta === true
        }
      : null,

    fotoSugerida: diagnosticoFoto.valida ? null : fotoDeCuentas.elegida,
    fotoCandidatas: fotoDeCuentas.disponibles,
    fotoNoDisponible: fotoDeCuentas.noDisponibles,
    fotoLimite: fotoDeCuentas.limite,
    prioridadFoto: PRIORIDAD_FOTO,

    /* Cuentas fuera de las siete casillas, si las hubiera. */
    otras: cuentas.filter(
      (c) => !PLATAFORMAS_FICHA.some((pf) => pf.id === c.plataformaId)
    ),

    /*
      Historia de las retiradas. No se muestran como identidad
      activa y no se borran: el analista debe poder ver que las
      retiro y cuando, y volver a activarlas si se equivoco.
    */
    revocadas: declaradas
      .filter((d) => d.estado === ESTADOS_IDENTIDAD.REVOCADA)
      .map((d) => ({
        id: d.id,
        plataformaId: d.plataformaId,
        plataforma: d.plataforma,
        url: d.url,
        handle: d.handle,
        revocadaEn: d.revocadaEn || null,
        revocadaPor: d.revocadaPor || null,
        estadoAnterior: d.estadoAnterior || null
      })),

    metricas: {
      cuentas: cuentas.length,
      consolidadas: cuentas.filter((c) =>
        [
          ESTADOS_IDENTIDAD.CONSOLIDADA,
          ESTADOS_IDENTIDAD.REVALIDADA,
          ESTADOS_IDENTIDAD.ATRIBUIDA
        ].includes(c.estado)
      ).length,
      declaradas: cuentas.filter((c) => c.declaradaPorAnalista).length,
      corroboradas: cuentas.filter((c) => c.corroboradaPorSentinel).length,
      noReencontradas: cuentas.filter(
        (c) => c.estado === ESTADOS_IDENTIDAD.NO_REENCONTRADA
      ).length,
      plataformasPendientes: plataformas.filter(
        (p) => p.estado === ESTADOS_IDENTIDAD_FICHA.PENDIENTE
      ).length
    }
  };
}


/*
===========================================================
SNAPSHOTS DE ACCOUNT INTELLIGENCE — P-CAND-AI-01
===========================================================

Uno por observacion, en su propia entidad del Lake. Append-only:
nunca se sobrescribe el anterior, porque sin la serie no hay 7d,
15d, 30d ni 90d y comparar seria inventar.

Entidad propia por instante, igual que las ejecuciones de
investigacion y por el mismo motivo: cada observacion es un hecho
distinto, no una version del anterior.
===========================================================
*/
const PREFIJO_SNAPSHOT = "snapshot-";

export async function guardarSnapshots(proyectoId, candidatoId, snapshots = []) {
  const escritos = [];

  for (const snap of snapshots) {
    const cuando = snap.capturedAt || new Date().toISOString();

    const entidad = `${PREFIJO_SNAPSHOT}${candidatoId}-${snap.platform}-${cuando}`;

    try {
      const r = await escribirEnLake(
        {
          entidad,
          tipoEntidad: TIPO_EXPEDIENTE,
          tenantId: TENANT,
          proyectoId,
          fuente: SUBMOTOR,
          linaje: linaje("observar_cuenta"),
          datos: { ...snap, candidatoId }
        },
        {}
      );

      escritos.push({ entidad, escrito: r?.escrito === true, motivo: r?.motivo || null });
    } catch (e) {
      escritos.push({ entidad, escrito: false, motivo: e?.message || "fallo de escritura" });
    }
  }

  return { total: snapshots.length, escritos };
}


/*
  Historial de snapshots de un candidato, del mas reciente al mas
  antiguo. Es la entrada de cualquier comparacion temporal futura.
*/
export async function snapshotsDe(proyectoId, candidatoId) {
  return leerSerie(proyectoId, `${PREFIJO_SNAPSHOT}${candidatoId}-`);
}


/*
===========================================================
SNAPSHOTS DE IDENTIDAD — CANDIDATE-LONGITUDINAL-01
===========================================================

La foto del inventario de cuentas en un instante. Sin ella no se
puede responder a «que cuentas tenia Sentinel atribuidas el 12
de septiembre», que es una pregunta sobre el pasado y por tanto
imposible de responder con una escritura destructiva.

Entidad propia por instante, como los snapshots de cuenta y por
el mismo motivo.
===========================================================
*/
const PREFIJO_IDENTIDAD = "identidad-";

export async function guardarSnapshotDeIdentidad(
  proyectoId,
  candidatoId,
  snapshot
) {
  const cuando = snapshot?.capturedAt || new Date().toISOString();

  const entidad = `${PREFIJO_IDENTIDAD}${candidatoId}-${cuando}`;

  try {
    const r = await escribirEnLake(
      {
        entidad,
        tipoEntidad: TIPO_EXPEDIENTE,
        tenantId: TENANT,
        proyectoId,
        fuente: SUBMOTOR,
        linaje: linaje("snapshot_identidad"),
        datos: { ...snapshot, candidatoId }
      },
      {}
    );

    return { entidad, escrito: r?.escrito === true, motivo: r?.motivo || null };
  } catch (e) {
    return {
      entidad,
      escrito: false,
      motivo: e?.message || "fallo de escritura"
    };
  }
}


export async function snapshotsDeIdentidadDe(proyectoId, candidatoId) {
  return leerSerie(proyectoId, `${PREFIJO_IDENTIDAD}${candidatoId}-`);
}


/*
===========================================================
CORPUS DE EVIDENCIAS — append-only por ejecucion
===========================================================

El expediente guardaba el RECUENTO de evidencias, no las
evidencias. Con un recuento no se puede deduplicar, ni agrupar
replicas, ni saber que medio publico que: son justo las
preguntas de Amplificacion.

Se guardan por ejecucion, en su propia entidad. Al leerlas se
funden por URL y se conserva la PRIMERA vez que Sentinel las
vio, que es un dato distinto de la fecha que declara la fuente.
===========================================================
*/
const PREFIJO_EVIDENCIAS = "evidencias-";

/* Tope por ejecucion. El recorte se declara, no se disimula. */
const TOPE_EVIDENCIAS = 120;

export async function guardarEvidencias(
  proyectoId,
  candidatoId,
  evidencias = [],
  contexto = {}
) {
  const cuando = contexto.ejecutadaEn || new Date().toISOString();

  const lista = (evidencias || []).slice(0, TOPE_EVIDENCIAS).map((e) => ({
    id: e.id || e.url || e.enlace || null,
    tipo: e.tipo || null,
    titulo: e.titulo || null,
    descripcion: e.descripcion || null,
    url: e.url || e.enlace || null,
    dominio: e.dominio || null,
    plataforma: e.plataforma || null,

    /* Fecha que declara la fuente. Puede ser anterior a todo. */
    fecha: e.fecha || null,

    /*
      Cuando lo vimos NOSOTROS. Nunca se sustituye por `fecha`:
      seria afirmar una vigilancia que no existio.
    */
    observadaEn: cuando,

    motores: e.motores || [],
    corroboracionMultiMotor: e.corroboracionMultiMotor ?? null
  }));

  const entidad = `${PREFIJO_EVIDENCIAS}${candidatoId}-${cuando}`;

  try {
    const r = await escribirEnLake(
      {
        entidad,
        tipoEntidad: TIPO_EXPEDIENTE,
        tenantId: TENANT,
        proyectoId,
        fuente: SUBMOTOR,
        linaje: linaje("corpus_evidencias"),
        datos: {
          candidatoId,
          ejecucionId: contexto.investigacionId || null,
          observadaEn: cuando,
          total: (evidencias || []).length,
          guardadas: lista.length,
          truncadas: Math.max(0, (evidencias || []).length - lista.length),
          evidencias: lista
        }
      },
      {}
    );

    return { entidad, escrito: r?.escrito === true, guardadas: lista.length };
  } catch (e) {
    return { entidad, escrito: false, motivo: e?.message || "fallo de escritura" };
  }
}


export async function evidenciasDe(proyectoId, candidatoId) {
  const lotes = await leerSerie(proyectoId, `${PREFIJO_EVIDENCIAS}${candidatoId}-`);

  const porUrl = new Map();

  let truncadas = 0;

  /* Del mas antiguo al mas nuevo: la primera vista gana. */
  [...lotes].reverse().forEach((lote) => {
    truncadas += lote.truncadas || 0;

    (lote.evidencias || []).forEach((e) => {
      const clave = String(e.url || e.id || "").toLowerCase();

      if (!clave) return;

      const ya = porUrl.get(clave);

      if (!ya) {
        porUrl.set(clave, { ...e, vecesObservada: 1 });

        return;
      }

      /*
        Vista otra vez. `observadaEn` NO se toca: es la primera
        vez que la vimos, y ese es el dato que no se puede
        reescribir.
      */
      ya.vecesObservada += 1;

      ya.ultimaVezObservada = e.observadaEn || ya.observadaEn;
    });
  });

  return {
    evidencias: [...porUrl.values()],
    total: porUrl.size,
    lotes: lotes.length,
    truncadas,
    nota: lotes.length
      ? "Corpus acumulado de todas las ejecuciones. `observadaEn` es la PRIMERA vez que Sentinel vio cada pieza; `fecha` es lo que declara la fuente."
      : "Todavia no hay corpus de evidencias: se acumula desde la primera investigacion posterior a este contrato. Las investigaciones anteriores solo guardaron recuentos."
  };
}


/*
===========================================================
SENALES DE CROSS-LINK — P-CAND-02
===========================================================

Un lote por ejecucion de observacion de enlaces. Append-only,
como todo lo demas: la relacion «esta pagina enlaza esta cuenta»
es un hecho fechado, y saber CUANDO se vio por primera vez es
justo lo que un campo sobrescrito borraria.

`senalesCrossLinkDe` funde los lotes conservando
`firstObservedAt` y acumulando `observationCount` y
`evidenceIds`. La fusion vive en `crossLinkEvidence`; aqui solo
se leen los lotes y se delega, para no tener dos reglas de
fusion distintas.
===========================================================
*/
const PREFIJO_CROSSLINK = "crosslink-";

export async function guardarSenalesCrossLink(
  proyectoId,
  candidatoId,
  senales = [],
  contexto = {}
) {
  const cuando = contexto.observadoEn || new Date().toISOString();

  const entidad = `${PREFIJO_CROSSLINK}${candidatoId}-${cuando}`;

  try {
    const r = await escribirEnLake(
      {
        entidad,
        tipoEntidad: TIPO_EXPEDIENTE,
        tenantId: TENANT,
        proyectoId,
        fuente: SUBMOTOR,
        linaje: linaje("observar_enlaces_salientes"),
        datos: {
          candidatoId,
          observadaEn: cuando,
          total: senales.length,
          intentos: contexto.intentos || [],
          senales
        }
      },
      {}
    );

    return { entidad, escrito: r?.escrito === true, total: senales.length };
  } catch (e) {
    return { entidad, escrito: false, motivo: e?.message || "fallo de escritura" };
  }
}


export async function senalesCrossLinkDe(proyectoId, candidatoId) {
  const lotes = await leerSerie(
    proyectoId,
    `${PREFIJO_CROSSLINK}${candidatoId}-`
  );

  /* Del mas antiguo al mas nuevo: la primera vista gana. */
  const cronologico = [...lotes].reverse();

  let acumuladas = [];

  for (const lote of cronologico) {
    const r = fusionarSenales(acumuladas, lote.senales || []);

    acumuladas = r.senales;
  }

  return {
    senales: acumuladas,
    total: acumuladas.length,
    lotes: lotes.length,

    ultimosIntentos: lotes[0]?.intentos || [],

    nota: lotes.length
      ? "Senales fusionadas por identidad de relacion. `firstObservedAt` es la primera vez que Sentinel vio el enlace y no se reescribe."
      : "Todavia no se ha observado ningun enlace saliente. Se acumulan desde la primera observacion."
  };
}


/*
===========================================================
PUBLICACIONES OBSERVADAS — P-CAND-02
===========================================================

Un lote por observacion. Las metricas son SNAPSHOTS: al leer se
funden las publicaciones por `publicationId` acumulando la serie
completa de metricas en lugar de quedarse con la ultima.

    100k ayer y 150k hoy son dos observaciones, no un campo
    que cambio de valor.
===========================================================
*/
const PREFIJO_PUBLICACION = "publicaciones-";


/*
===========================================================
TIPO DE ACTIVO DECLARADO POR EL ANALISTA
===========================================================

P-CAND-ASSET-TYPE-DECLARE-01.

Serie aparte, y la razon importa: la alternativa era guardar
el tipo dentro de `cuentasReferencia`, que es donde vive la
identidad de la cuenta. Habria funcionado, y cada vez que
alguien clasificara un activo estaria reescribiendo el registro
que sostiene su identidad —su URL, su handle, su estado— por
un campo que no tiene nada que ver.

Aqui una declaracion no puede alterar la identidad ni por
accidente: son entidades distintas del Lake. Y se gana el
historial gratis, que es lo que se quiere de una clasificacion
hecha a mano: quien dijo que, cuando, y que dijo antes.

Un lote por guardado. Al leer se conserva la ultima por
activo, sin borrar las anteriores.
===========================================================
*/
const PREFIJO_TIPO_ACTIVO = "tipoactivo-";

export async function guardarDeclaracionesDeTipo(
  proyectoId,
  candidatoId,
  declaraciones = [],
  contexto = {}
) {
  const cuando = contexto.declaradoEn || new Date().toISOString();

  /*
    ---------------------------------------------------------
    LA CLAVE NO PUEDE SER SOLO CANDIDATO + FECHA
    ---------------------------------------------------------

    Lo era, y META-THIRD-PARTY-REAL-02 lo descubrio de la peor
    forma: dos lotes del mismo candidato guardados con el mismo
    `declaradoEn` producian la MISMA entidad, y el Lake devuelve
    la ultima version de una entidad. El primer lote seguia
    escrito y dejaba de leerse.

    No se pierde el dato —el Lake conserva versiones— pero
    desaparece de la serie, que para quien la lee es lo mismo.
    Y falla en silencio: la escritura devuelve `escrito: true`.

    Con un `new Date()` por lote la colision es improbable; con
    una fecha pasada a mano, como en una verificacion que se
    fecha con el momento de la observacion, es lo normal.

    Asi que la clave lleva ademas un discriminante de contenido:
    dos lotes distintos son dos entidades, y el mismo lote
    reescrito sigue siendo el mismo.
    ---------------------------------------------------------
  */
  const huella = (declaraciones || [])
    .map((d) => `${d?.assetId || ""}:${d?.declaredType || ""}:${d?.source || ""}`)
    .sort()
    .join("|");

  let acumulado = 0;

  for (let i = 0; i < huella.length; i += 1) {
    acumulado = (acumulado * 31 + huella.charCodeAt(i)) % 0xffffffff;
  }

  const discriminante = acumulado.toString(36);

  const entidad = `${PREFIJO_TIPO_ACTIVO}${candidatoId}-${cuando}-${discriminante}`;

  try {
    const r = await escribirEnLake(
      {
        entidad,
        tipoEntidad: TIPO_EXPEDIENTE,
        tenantId: TENANT,
        proyectoId,
        fuente: SUBMOTOR,
        linaje: linaje("declarar_tipo_de_activo"),
        datos: {
          candidatoId,
          declaradoEn: cuando,
          declaradoPor: contexto.declaradoPor || "analista",
          total: declaraciones.length,
          declaraciones
        }
      },
      {}
    );

    return { entidad, escrito: r?.escrito === true, total: declaraciones.length };
  } catch (e) {
    return { entidad, escrito: false, motivo: e?.message || "fallo de escritura" };
  }
}


export async function declaracionesDeTipoDe(proyectoId, candidatoId) {
  const lotes = await leerSerie(
    proyectoId,
    `${PREFIJO_TIPO_ACTIVO}${candidatoId}-`
  );

  /*
    Del mas antiguo al mas nuevo: la ultima declaracion manda.
    Se ordena por `declaradoEn` explicitamente en lugar de
    confiar en el orden de `leerSerie`, que ordena por otros
    campos de fecha que estos registros no tienen.
  */
  const cronologico = [...lotes].sort((x, y) =>
    String(x.declaradoEn || "").localeCompare(String(y.declaradoEn || ""))
  );

  const vigentes = new Map();

  const historial = [];

  for (const lote of cronologico) {
    for (const d of lote.declaraciones || []) {
      if (!d?.assetId) continue;

      const conFecha = {
        ...d,
        declaredAt: d.declaredAt || lote.declaradoEn || null
      };

      historial.push(conFecha);

      vigentes.set(String(d.assetId), conFecha);
    }
  }

  return {
    declaraciones: [...vigentes.values()],
    total: vigentes.size,
    historial,
    lotes: lotes.length,

    nota: lotes.length
      ? "Tipo declarado por el analista, no verificado contra ninguna API. Se conserva la ultima declaracion por activo y el historial completo."
      : "Ningun activo tiene tipo declarado todavia."
  };
}

export async function guardarPublicaciones(
  proyectoId,
  candidatoId,
  publicaciones = [],
  contexto = {}
) {
  const cuando = contexto.observadoEn || new Date().toISOString();

  const entidad = `${PREFIJO_PUBLICACION}${candidatoId}-${cuando}`;

  try {
    const r = await escribirEnLake(
      {
        entidad,
        tipoEntidad: TIPO_EXPEDIENTE,
        tenantId: TENANT,
        proyectoId,
        fuente: SUBMOTOR,
        linaje: linaje("observar_publicaciones"),
        datos: {
          candidatoId,
          observadaEn: cuando,
          provider: contexto.provider || null,
          total: publicaciones.length,
          publicaciones
        }
      },
      {}
    );

    return { entidad, escrito: r?.escrito === true, total: publicaciones.length };
  } catch (e) {
    return { entidad, escrito: false, motivo: e?.message || "fallo de escritura" };
  }
}


export async function publicacionesDe(proyectoId, candidatoId) {
  const lotes = await leerSerie(
    proyectoId,
    `${PREFIJO_PUBLICACION}${candidatoId}-`
  );

  const porId = new Map();

  /* Del mas antiguo al mas nuevo, para que la fusion acumule. */
  [...lotes].reverse().forEach((lote) => {
    (lote.publicaciones || []).forEach((p) => {
      if (!p?.publicationId) return;

      const previa = porId.get(p.publicationId) || null;

      porId.set(
        p.publicationId,
        previa ? fusionarPublicacion(previa, p) : { ...p }
      );
    });
  });

  const publicaciones = [...porId.values()];

  return {
    publicaciones,
    total: publicaciones.length,
    lotes: lotes.length,

    snapshotsDeMetricas: publicaciones.reduce(
      (s, p) => s + (p.metricas || []).length,
      0
    ),

    nota: lotes.length
      ? "Las metricas son snapshots acumulados: ninguna observacion sustituye a la anterior."
      : "Todavia no hay ninguna publicacion observada. La lista vacia NO significa que el candidato no publique."
  };
}


/*
  Lectura de una serie append-only, de la mas reciente a la mas
  antigua. Comun a snapshots de cuenta, de identidad, a los
  lotes de evidencias, a las senales de cross-link y a las
  publicaciones: cinco series con la misma mecanica.
*/
async function leerSerie(proyectoId, prefijo) {
  const entidades = await entidadesDe(proyectoId);

  const suyas = (entidades || []).filter(
    (e) => typeof e.entidad === "string" && e.entidad.startsWith(prefijo)
  );

  const registros = [];

  for (const { claveEntidad } of suyas) {
    try {
      const v = await obtenerVersionEntidad(claveEntidad, {});

      if (v?.registro?.datos) registros.push(v.registro.datos);
    } catch {
      /* Un registro ilegible no invalida la serie. */
    }
  }

  return registros.sort((a, b) =>
    String(b.capturedAt || b.observadaEn || "").localeCompare(
      String(a.capturedAt || a.observadaEn || "")
    )
  );
}


export async function registrarInvestigacion(
  proyectoId,
  candidatoId,
  resultado,
  tipo = "candidato"
) {
  /*
    Expedientes separados por tipo: el de un actor de referencia no
    puede pisar el de un candidato ni aparecer en su lugar.
  */
  const entidad = `expediente-${tipo}-${candidatoId}`;

  const clave = claveLake(proyectoId, TIPO_EXPEDIENTE, entidad);

  /* Estado anterior del expediente. */
  let anterior = null;

  let versiones = 0;

  try {
    const h = await obtenerHistorialEntidad(entidad, {
      tenantId: TENANT,
      proyectoId
    });

    versiones = (h?.versiones || []).length;

    if (versiones) {
      const v = await obtenerVersionEntidad(clave, {});

      anterior = v?.registro?.datos || null;
    }
  } catch {
    anterior = null;
  }

  /*
    El instante de la ejecucion se fija ANTES de consolidar: es el
    mismo que sella los `lastSeenAt` y `lastCheckedAt` del
    inventario y el que identifica la ejecucion. Dos relojes
    distintos para el mismo hecho serian dos verdades.
  */
  const ejecutadaEn = new Date().toISOString();

  const investigacionId = `inv-${tipo}-${candidatoId}-${ejecutadaEn}`;

  const actual = resumirExpediente(resultado, anterior, {
    ejecutadaEn,
    investigacionId
  });

  /*
    ---------------------------------------------------------
    DIFERENCIAL
    ---------------------------------------------------------
  */
  const previas = new Set(anterior?.clavesCuenta || []);

  const cuentasNuevas = actual.cuentas.filter(
    (c) => !previas.has(`${c.plataformaId}:${String(c.handle).toLowerCase()}`)
  );

  const mediosPrevios = new Set(
    (anterior?.medios || []).map((m) => String(m.url || m.handle).toLowerCase())
  );

  const mediosNuevos = actual.medios.filter(
    (m) => !mediosPrevios.has(String(m.url || m.handle).toLowerCase())
  );

  /*
    Huella del plano de OBSERVACION: que cuentas se vieron esta
    vez y en que estado quedo cada una.

    Hace falta porque con el inventario consolidado las claves ya
    no cambian cuando una cuenta deja de reencontrarse —siguen
    todas—, y sin esto el expediente no se reescribiria y
    `seenInCurrentRun` se quedaria mintiendo con el valor de ayer.
  */
  const huellaObservacion = (e) =>
    JSON.stringify(
      (e?.cuentas || [])
        .map((c) => `${c.plataformaId}:${c.handle}:${c.estado}:${c.seenInCurrentRun}`)
        .sort()
    );

  const sinCambios =
    anterior !== null &&
    JSON.stringify(anterior.clavesCuenta) === JSON.stringify(actual.clavesCuenta) &&
    (anterior.medios || []).length === actual.medios.length &&
    anterior.evidenciasWeb === actual.evidenciasWeb &&
    huellaObservacion(anterior) === huellaObservacion(actual);

  let escritura = null;

  /*
    ---------------------------------------------------------
    LA EJECUCION SE GUARDA SIEMPRE — BUG-13
    ---------------------------------------------------------

    Antes de cualquier decision sobre los hallazgos. `sinCambios`
    gobierna el expediente y no debe gobernar esto: una
    investigacion que corrio, gasto cuota y no encontro nada
    nuevo sigue siendo una investigacion que corrio, y su traza
    es la unica forma de saber despues por que no encontro nada.

    Entidad propia por ejecucion, identificada por su instante
    autoritativo. No hay aleatoriedad y no se duplica ningun
    hallazgo: lo nuevo es el evento.
    ---------------------------------------------------------
  */
  const delta = {
    cuentas: cuentasNuevas.length,
    medios: mediosNuevos.length,
    evidenciasWeb:
      anterior === null
        ? actual.evidenciasWeb ?? 0
        : Math.max(0, (actual.evidenciasWeb ?? 0) - (anterior.evidenciasWeb ?? 0))
  };

  let escrituraEjecucion = null;

  try {
    escrituraEjecucion = await escribirEnLake(
      {
        entidad: `${PREFIJO_EJECUCION}${tipo}-${candidatoId}-${ejecutadaEn}`,
        tipoEntidad: TIPO_EXPEDIENTE,
        tenantId: TENANT,
        proyectoId,
        fuente: SUBMOTOR,
        motorOrigen: resultado?.origenDescubrimiento || null,
        linaje: linaje("ejecutar_investigacion"),
        datos: {
          investigacionId,
          candidatoId,
          tipo,
          ejecutadaEn,

          /*
            Que la investigacion OCURRIO es independiente de que
            haya cambiado algo.
          */
          estado: "completada",
          ejecutada: true,

          /* Un delta de cero es un resultado valido, no un fallo. */
          delta,
          sinCambiosEnHallazgos: sinCambios,

          /*
            Identidad frente a observacion, separadas. Una cuenta
            consolidada que no se vio hoy no es una cuenta perdida.
          */
          inventario: {
            total: (actual.cuentas || []).length,
            observadasEnEstaEjecucion: (actual.cuentas || []).filter(
              (c) => c.seenInCurrentRun
            ).length,
            noReencontradas: (actual.cuentas || []).filter(
              (c) => !c.seenInCurrentRun
            ).length,
            porEstado: (actual.cuentas || []).reduce((acc, c) => {
              acc[c.estado] = (acc[c.estado] || 0) + 1;

              return acc;
            }, {})
          },

          /*
            LA TRAZA. Es la razon de ser de este registro.
          */
          traza: actual.traza || null,

          /* Fotografia del resumen en el momento de esta ejecucion. */
          resumen: {
            cuentas: (actual.cuentas || []).length,
            medios: (actual.medios || []).length,
            instituciones: (actual.instituciones || []).length,
            evidenciasWeb: actual.evidenciasWeb ?? null,
            evidenciasSociales: actual.evidenciasSociales ?? null,
            huellaDigital: actual.huellaDigital ?? null
          }
        }
      },
      {}
    );
  } catch (e) {
    escrituraEjecucion = {
      escrito: false,
      motivo: e?.message || "fallo al registrar la ejecución"
    };
  }

  /*
    ---------------------------------------------------------
    CORPUS DE EVIDENCIAS DE ESTA EJECUCION
    ---------------------------------------------------------

    Fuera de la guarda `sinCambios`, y por la misma razon que la
    ejecucion: lo que se guarda es un HECHO fechado —estas piezas
    se vieron este dia—, no una version del expediente. Un lote
    identico al de ayer sigue siendo la observacion de hoy, y sin
    ella la serie temporal tendria agujeros donde si mirabamos.
    ---------------------------------------------------------
  */
  let escrituraEvidencias = null;

  const evidenciasDeLaEjecucion = [
    ...(resultado?.fichaObjetivo?.evidencias?.web || []),
    ...(resultado?.fichaObjetivo?.evidencias?.sociales || [])
  ];

  if (evidenciasDeLaEjecucion.length) {
    escrituraEvidencias = await guardarEvidencias(
      proyectoId,
      candidatoId,
      evidenciasDeLaEjecucion,
      { ejecutadaEn, investigacionId }
    );
  }

  if (!sinCambios) {
    try {
      escritura = await escribirEnLake(
        {
          entidad,
          tipoEntidad: TIPO_EXPEDIENTE,
          tenantId: TENANT,
          proyectoId,
          fuente: SUBMOTOR,
          motorOrigen: resultado?.origenDescubrimiento || null,
          linaje: linaje("registrar_investigacion"),
          datos: { ...actual, candidatoId, actualizadoEn: new Date().toISOString() }
        },
        {}
      );
    } catch (e) {
      escritura = { escrito: false, motivo: e?.message || "fallo de escritura" };
    }
  }

  return {
    version: "1.0",

    proyectoId,
    candidatoId,

    primeraInvestigacion: versiones === 0,

    investigacionesPrevias: versiones,

    /*
      Regla del sprint: una segunda investigacion no crea un
      segundo candidato. Actualiza el mismo expediente.
    */
    /*
      DOS HECHOS DISTINTOS, DECLARADOS APARTE.

      `ejecucionRegistrada` dice que la investigacion consta.
      `expedienteActualizado` dice si aporto hallazgos nuevos.
      Que el segundo sea false no vuelve false al primero.
    */
    investigacionId,
    ejecutadaEn,

    /*
      El delta de esta ejecucion. Un cero es un resultado valido:
      significa que se busco y no habia nada nuevo, no que no se
      buscara.
    */
    delta,

    ejecucionRegistrada: escrituraEjecucion?.escrito === true,
    motivoEjecucion: escrituraEjecucion?.motivo || null,
    trazaPersistida:
      escrituraEjecucion?.escrito === true && !!actual.traza,

    expedienteActualizado: sinCambios ? false : escritura?.escrito === true,

    /*
      Tercer hecho, tambien aparte: el corpus de esta ejecucion.
      Es lo que permite deduplicar y agrupar replicas despues.
    */
    corpusEvidencias: {
      guardadas: escrituraEvidencias?.guardadas ?? 0,
      escrito: escrituraEvidencias?.escrito === true,
      motivo: escrituraEvidencias?.motivo || null
    },

    sinCambios,

    mensaje: sinCambios
      ? "Sin cambios relevantes desde la última investigación."
      : versiones === 0
        ? "Expediente creado."
        : "Expediente actualizado.",

    nuevosHallazgos: {
      cuentas: cuentasNuevas.length,
      medios: mediosNuevos.length,
      evidenciasWeb: Math.max(
        0,
        actual.evidenciasWeb - (anterior?.evidenciasWeb || 0)
      ),
      evidenciasSociales: Math.max(
        0,
        actual.evidenciasSociales - (anterior?.evidenciasSociales || 0)
      ),
      detalleCuentas: cuentasNuevas.map((c) => `${c.plataforma} @${c.handle}`),
      detalleMedios: mediosNuevos.map((m) => `${m.plataforma} @${m.handle}`)
    },

    /*
      Una cuenta que no reaparece NO se declara cerrada: puede que
      el proveedor no la devolviera esta vez.
      Misma disciplina que separa `ausencia` de `no_comprobada`.
    */
    advertencia:
      anterior && cuentasNuevas.length === 0 && !sinCambios
        ? "Cambió el volumen de evidencia pero no el conjunto de cuentas. Una cuenta que no reaparece no se declara cerrada."
        : null,

    estadoActual: actual
  };
}


export default {
  ESTADOS,
  crearProyecto,
  obtenerProyecto,
  listarProyectos,
  contenidoDeProyecto,
  renombrarProyecto,
  cambiarEstadoProyecto,
  agregarCandidato,
  obtenerCandidato,
  agregarActor,
  obtenerActor,
  activarComparativo,
  registrarInvestigacion,

  /* P-CAND-UX-01 */
  editarCandidato,
  fichaIdentidad,
  guardarSnapshots,
  snapshotsDe,

  /* Candidate Intelligence V1 — series longitudinales */
  guardarSnapshotDeIdentidad,
  snapshotsDeIdentidadDe,
  guardarEvidencias,
  evidenciasDe,

  /* P-CAND-02 — cross-link y publicaciones */
  guardarSenalesCrossLink,
  senalesCrossLinkDe,
  guardarPublicaciones,
  publicacionesDe,

  inventarioConsolidado,
  expedienteDe,
  PLATAFORMAS_FICHA,
  ESTADOS_IDENTIDAD,
  ESTADOS_IDENTIDAD_FICHA
};
