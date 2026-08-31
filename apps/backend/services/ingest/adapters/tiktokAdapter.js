// apps/backend/services/ingest/adapters/tiktokAdapter.js

/*
===========================================================
TIKTOK — LO POCO QUE SE PUEDE MEDIR HOY, MEDIDO
P-CAND-TIKTOK-01
===========================================================

Este adaptador es deliberadamente pequeno. No es un adaptador a
medio hacer: es del tamano de la unica via que existe.

LAS TRES APIS Y POR QUE NINGUNA SIRVE
-----------------------------------------------------------

Ya estaba documentado en `socialCapabilityMatrix`, y no se
repite la investigacion:

    Display API             opera sobre la cuenta que INICIA
                            SESION. El candidato tendria que
                            darnos acceso a la suya.
    Research API            si cubre terceros, y su elegibilidad
                            es academica sin animo de lucro.
    Commercial Content API  solo contenido publicitario.

Es la unica plataforma del grupo donde el problema no es un
permiso que pedir ni un plan que pagar: el caso de uso no encaja
en ningun programa.

LO QUE SI SE MIDIO
-----------------------------------------------------------

`oembed`, endpoint publico y documentado de TikTok, sin
credencial y pensado para incrustar contenido. Sobre la URL de un
PERFIL devuelve HTTP 200 con:

    author_name        el nombre visible REAL de la cuenta
    author_url         la URL canonica
    embed_product_id   el handle
    embed_type         "profile"

Y no devuelve nada mas: ni seguidores, ni videos, ni una sola
metrica.

EL CONTROL QUE LO HACE UTILIZABLE
-----------------------------------------------------------

Un endpoint que responde 200 a cualquier cosa no prueba
existencia. Se probo con dos handles inventados y los dos dieron
**HTTP 400**, asi que un 200 aqui SI es evidencia de que la
cuenta existe.

Sin ese control esto no se podria usar como senal, y la leccion
viene de META-COVERAGE-AUDIT-01: alli un clasificador dio
«perfil» con confianza media para Meta, BBC y NASA, y solo el
control lo descubrio.

LA LINEA QUE NO SE CRUZA
-----------------------------------------------------------

El HTML publico del perfil tambien se midio: HTTP 200 y 1.462
bytes de armazon vacio, sin Open Graph y sin ninguna cifra. No
es un bloqueo ni un captcha: TikTok simplemente no sirve datos a
un cliente que no ejecuta JavaScript.

Sacar cifras de ahi exigiria ejecutar su JavaScript o firmar sus
peticiones, y eso es raspado evasivo. No se hace: un dato asi no
se puede citar en un informe, no se puede auditar y desaparece
en cuanto la plataforma cambia algo.
===========================================================
*/

export const ID = "tiktok_oembed";

export const NOMBRE = "TikTok oEmbed (publico)";

export const TIPO = "social";

export const PRIORIDAD = 9;

export const BASE = "https://www.tiktok.com";

/* Publico: no hay credencial que configurar, y eso es un dato. */
export const REQUIERE_CREDENCIAL = false;

export const COSTE_POR_LLAMADA = 0;

export const CUOTA_DIARIA_GRATUITA = null;

const TIEMPO_MAXIMO_MS = 20000;


export const ESTADOS = Object.freeze({
  /* 200 en oembed: la cuenta existe y trae nombre visible. */
  CUENTA_CONFIRMADA: "CUENTA_CONFIRMADA",

  /*
    400: el handle no resuelve. Comprobado con control, asi que
    esto SI significa «no existe con ese handle» y no «la via
    fallo».
  */
  CUENTA_NO_EXISTE: "CUENTA_NO_EXISTE",

  /* La via respondio algo que no encaja en el contrato. */
  RESPUESTA_INESPERADA: "RESPUESTA_INESPERADA",

  ERROR_PROVEEDOR: "ERROR_PROVEEDOR"
});


/*
  Lo que esta via NO entrega, enumerado en el codigo y no en un
  comentario, para que viaje con cada resultado.

  Una ausencia no es un cero: ninguno de estos campos se rellena
  con 0 ni con «sin datos».
*/
export const NO_DISPONIBLE_POR_ESTA_VIA = Object.freeze([
  "followers",
  "following",
  "likes_totales",
  "media_count",
  "publicaciones",
  "views",
  "likes",
  "comments_count",
  "shares",
  "comments_text",
  "historico"
]);


export function urlDePerfil(handle) {
  const limpio = String(handle || "").trim().replace(/^@+/, "");

  return limpio ? `${BASE}/@${limpio}` : null;
}


function conTiempoLimite(promesa, ms, etiqueta) {
  return Promise.race([
    promesa,
    new Promise((_, rechazar) =>
      setTimeout(
        () => rechazar(new Error(`${etiqueta}: tiempo agotado tras ${ms} ms`)),
        ms
      )
    )
  ]);
}


/*
===========================================================
CONFIRMAR UNA CUENTA POR oEmbed
===========================================================

Una llamada. Devuelve identidad y nada mas, y lo dice.
===========================================================
*/
export async function confirmarCuenta(handle, opciones = {}) {
  const perfil = urlDePerfil(handle);

  if (!perfil) {
    return {
      estado: ESTADOS.RESPUESTA_INESPERADA,
      llamadas: 0,
      motivo: "hace falta un handle"
    };
  }

  const fetchImpl = opciones.fetch || globalThis.fetch;

  const endpoint = `${BASE}/oembed`;

  const url = `${endpoint}?url=${encodeURIComponent(perfil)}`;

  const base = {
    llamadas: 1,
    endpoint,
    handleConsultado: String(handle).replace(/^@+/, ""),
    url: perfil,
    observadoEn: new Date().toISOString(),

    /* Viaja con el resultado, no en la documentacion. */
    noDisponiblePorEstaVia: NO_DISPONIBLE_POR_ESTA_VIA
  };

  let respuesta;

  try {
    respuesta = await conTiempoLimite(
      fetchImpl(url, { headers: { Accept: "application/json" } }),
      TIEMPO_MAXIMO_MS,
      "TikTok oembed"
    );
  } catch (e) {
    return {
      ...base,
      estado: ESTADOS.ERROR_PROVEEDOR,
      motivo: e?.message || "la llamada no se completo"
    };
  }

  const texto = await respuesta.text();

  let datos = null;

  try {
    datos = JSON.parse(texto);
  } catch {
    datos = null;
  }

  /*
    400 medido con control sobre handles inventados. Es la unica
    razon por la que se puede leer como «no existe».
  */
  if (respuesta.status === 400) {
    return {
      ...base,
      estado: ESTADOS.CUENTA_NO_EXISTE,
      httpStatus: 400,

      motivo:
        "oembed devuelve 400 para este handle. Comprobado con control sobre handles inventados, asi que significa que el handle no resuelve, no que la via haya fallado."
    };
  }

  if (!respuesta.ok || !datos) {
    return {
      ...base,
      estado: ESTADOS.ERROR_PROVEEDOR,
      httpStatus: respuesta.status,
      motivo: `oembed respondio ${respuesta.status} sin cuerpo utilizable`
    };
  }

  /*
    Que sea un perfil y no un video importa: el mismo endpoint
    sirve las dos cosas y solo el de perfil responde a la
    pregunta «existe esta cuenta».
  */
  if (datos.embed_type && datos.embed_type !== "profile") {
    return {
      ...base,
      estado: ESTADOS.RESPUESTA_INESPERADA,
      httpStatus: respuesta.status,
      embedType: datos.embed_type,
      motivo: `se pidio un perfil y oembed devolvio embed_type "${datos.embed_type}"`
    };
  }

  const handleDevuelto = datos.embed_product_id || null;

  return {
    ...base,
    estado: ESTADOS.CUENTA_CONFIRMADA,
    httpStatus: respuesta.status,

    cuenta: {
      handle: handleDevuelto,

      /*
        El nombre visible es el unico dato REAL que aporta esta
        via: no es un eco del handle. Medido con @jotalloretv ->
        «Jota Lloret Valdivieso».
      */
      displayName: datos.author_name || null,

      urlCanonica: datos.author_url || perfil,

      /*
        Todo lo demas queda explicitamente sin dato. Nada de
        ceros: un 0 seguidores seria una medicion y esto es una
        ausencia.
      */
      estadisticasPublicas: Object.fromEntries(
        NO_DISPONIBLE_POR_ESTA_VIA.map((m) => [
          m,
          {
            value: null,
            availability: "NO_DISPONIBLE",
            motivo: "oembed no entrega esta metrica por diseno"
          }
        ])
      )
    },

    /*
      Senal de identidad, y solo eso. Que el nombre visible se
      parezca al del candidato es una corroboracion util; que la
      cuenta responda NO dice de quien es.
    */
    senalDeIdentidad: {
      displayNameObservado: datos.author_name || null,
      handleCoincide:
        String(handleDevuelto || "").toLowerCase() ===
        String(handle).replace(/^@+/, "").toLowerCase()
    },

    noSignifica: [
      "MEDIDO_TERCERO",
      "BENCHMARK_HABILITADO",
      "CUENTA_VERIFICADA",
      "PERTENENCIA_CORROBORADA"
    ],

    nota:
      "Confirma que la cuenta existe y su nombre visible. NO entrega ninguna metrica y NO corrobora la pertenencia al candidato."
  };
}


export function diagnostico() {
  return {
    id: ID,
    nombre: NOMBRE,
    requiereCredencial: REQUIERE_CREDENCIAL,
    costePorLlamada: COSTE_POR_LLAMADA,

    capacidadesReales: ["identidad", "displayName", "url_verificable", "existencia"],

    noDisponible: NO_DISPONIBLE_POR_ESTA_VIA,

    porQueTanPoco:
      "Display API exige el login del titular, Research API es academica y Commercial Content API solo cubre publicidad. oembed es la unica via publica, y entrega identidad sin metricas.",

    lineaQueNoSeCruza:
      "El HTML del perfil llega vacio sin JavaScript. Sacar cifras de ahi exigiria ejecutar su JS o firmar sus peticiones, que es raspado evasivo y produce datos que no se pueden auditar ni citar."
  };
}


export default {
  ID,
  NOMBRE,
  TIPO,
  BASE,
  ESTADOS,
  NO_DISPONIBLE_POR_ESTA_VIA,
  urlDePerfil,
  confirmarCuenta,
  diagnostico
};
