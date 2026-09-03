// apps/backend/services/intelligence/metaObservationContext.js

/*
===========================================================
CONTEXTO META DE UNA OBSERVACION — P-CAND-IG-ROUTE-01
===========================================================

`business_discovery` no se puede pedir «en general». Hace falta
preguntar DESDE una cuenta profesional propia, y eso son dos
datos que no estan en el expediente del candidato:

    idParaBusinessDiscovery   el IG vinculado a una Pagina nuestra
    cuentasPropias            que handles administramos

El segundo es el que impide el falso positivo. Sobre una cuenta
propia y sobre una ajena Meta responde igual —mismo 200, mismos
campos— asi que MEDIDO_TERCERO y MEDIDO_PROPIO_AUTORIZADO solo se
distinguen cruzando el handle con `me/accounts`. Sin esa lista,
observar la cuenta que administramos se leeria como acceso a
terceros, que es justo lo que casi paso en
META-THIRD-PARTY-REAL-02.

POR QUE ESTO VIVE EN EL BACKEND
-----------------------------------------------------------

Los dos datos se derivan del token. Resolverlos en el cliente
exigiria mandarle el token al navegador, y entonces la credencial
de Meta viajaria a cada pestana abierta. El cliente pide
«observa a este candidato»; que Paginas administramos no es
asunto suyo y no se le cuenta.

PRESUPUESTO
-----------------------------------------------------------

UNA llamada, y solo si la ejecucion incluye Instagram. Pedir
`me/accounts` para observar YouTube seria gastar por nada.
===========================================================
*/

export const ESTADOS_CONTEXTO_META = Object.freeze({
  /* Resuelto: hay Pagina propia con Instagram vinculado. */
  RESUELTO: "RESUELTO",

  /* No hacia falta: la ejecucion no incluye Instagram. */
  NO_REQUERIDO: "NO_REQUERIDO",

  /* Falta el token de Facebook Login. */
  SIN_CREDENCIAL: "SIN_CREDENCIAL",

  /*
    El token vale y ninguna Pagina administrada tiene Instagram
    profesional vinculado. Es un requisito de la via, no un
    fallo nuestro, y se dice con su nombre.
  */
  SIN_VINCULO_INSTAGRAM: "SIN_VINCULO_INSTAGRAM",

  ERROR: "ERROR"
});


/*
  Las plataformas que necesitan este contexto.

  Instagram: para `business_discovery`, como siempre.

  Facebook -P-CAND-OPERATIONAL-CLOSURE-01-: NO para leer terceros
  -eso sigue cerrado por PPCA y no se abre pidiendo este
  contexto- sino para saber que Paginas administramos
  (`paginasPropias`), la misma llamada `me/accounts` que ya se
  hacia para Instagram. Sin esto, `observarFacebook` no puede
  distinguir una Pagina propia de una de tercero y arriesgaria
  el mismo falso positivo que este archivo ya evita para
  Instagram.
*/
const REQUIEREN_CONTEXTO = ["instagram", "facebook"];


export async function contextoMetaDeObservacion(entrada = {}) {
  const { plataformas = [], fetchImpl = undefined, adapter = null } = entrada;

  const haceFalta = (plataformas || []).some((p) =>
    REQUIEREN_CONTEXTO.includes(p)
  );

  const vacio = {
    idParaBusinessDiscovery: null,
    cuentasPropias: [],
    paginasPropias: [],
    llamadas: 0
  };

  if (!haceFalta) {
    return {
      ...vacio,
      estado: ESTADOS_CONTEXTO_META.NO_REQUERIDO,
      motivo:
        "esta ejecucion no incluye Instagram, asi que no se pide me/accounts. Una llamada que no hace falta tambien cuesta."
    };
  }

  /*
    El adapter se puede inyectar para poder probar esta funcion
    sin red. Por defecto es el que ya existe.
  */
  const ig =
    adapter ||
    (await import("../ingest/adapters/instagramAdapter.js"));

  const r = await ig.paginasQueAdministramos(
    fetchImpl ? { fetch: fetchImpl } : {}
  );

  if (r.estado === "SIN_CREDENCIAL") {
    return {
      ...vacio,
      estado: ESTADOS_CONTEXTO_META.SIN_CREDENCIAL,
      llamadas: r.llamadas || 0,
      familiaRequerida: r.familiaRequerida || null,
      motivo: r.motivo || "falta el token de Facebook Login"
    };
  }

  if (r.estado !== "OK") {
    return {
      ...vacio,
      estado: ESTADOS_CONTEXTO_META.ERROR,
      llamadas: r.llamadas || 0,
      httpStatus: r.httpStatus ?? null,
      codigoMeta: r.codigo ?? null,
      motivo: r.motivo || "me/accounts no respondio"
    };
  }

  /*
    Los handles de NUESTROS Instagram. Se normalizan aqui porque
    es la lista contra la que se compara un handle del
    expediente, y una mayuscula de diferencia convertiria un
    activo propio en «tercero».
  */
  const cuentasPropias = (r.paginas || [])
    .map((p) => p.instagramUsername)
    .filter(Boolean)
    .map((h) => String(h).trim().replace(/^@+/, "").toLowerCase());

  /*
    Paginas de Facebook que administramos, tal cual las devuelve
    `paginasQueAdministramos` -pageId/nombre/username-. Es lo que
    `observarFacebook` necesita para distinguir propia de tercero
    sin repetir la llamada a `me/accounts`.
  */
  const paginasPropias = r.paginas || [];

  if (!r.idParaBusinessDiscovery) {
    return {
      ...vacio,
      cuentasPropias,
      paginasPropias,
      estado: ESTADOS_CONTEXTO_META.SIN_VINCULO_INSTAGRAM,
      llamadas: r.llamadas || 0,
      motivo: r.requisitoDelVinculo
    };
  }

  return {
    estado: ESTADOS_CONTEXTO_META.RESUELTO,

    idParaBusinessDiscovery: r.idParaBusinessDiscovery,
    cuentasPropias,
    paginasPropias,

    llamadas: r.llamadas || 0,
    paginasAdministradas: (r.paginas || []).length,
    requisitoDelVinculo: r.requisitoDelVinculo,

    /*
      Lo que este contexto NO es. Tenerlo resuelto habilita la
      via; no dice que ningun tercero se haya medido.
    */
    noSignifica: ["MEDIDO_TERCERO", "BENCHMARK_HABILITADO"],

    nota:
      "Contexto resuelto en el backend. Ni el id ni la lista de cuentas propias viajan al cliente con la credencial: el token no sale de aqui."
  };
}


export default { ESTADOS_CONTEXTO_META, contextoMetaDeObservacion };
