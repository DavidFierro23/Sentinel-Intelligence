// apps/backend/services/intelligence/socialSourceRouting.js

/*
===========================================================
QUE FUENTE MIDE CADA ACTIVO
P-CAND-INSTAGRAM-FALLBACK-01
===========================================================

Sentinel tiene por primera vez DOS fuentes capaces de medir la
misma plataforma: la oficial y un proveedor externo. Sin una
regla escrita, la eleccion acabaria siendo «la que respondio», y
eso es como se cuela un dato raspado donde habia uno oficial.

LA REGLA
-----------------------------------------------------------

    1. Oficial, si esa via puede medir ESE activo.
    2. Proveedor, solo si la oficial no puede.
    3. Estado explicito, si ninguna puede.

POR ACTIVO, NUNCA POR CANDIDATO
-----------------------------------------------------------

Un candidato con dos Instagram puede tener uno profesional que
Meta mide y otro personal que no. Enrutar por candidato mandaria
los dos al proveedor y perderia la medicion oficial del primero,
que es mejor dato y ademas gratis.

Yaku Perez es exactamente ese caso: `@yakuperezg` lo mide Meta y
`@yaku_perez` no.

LO QUE ESTA FUNCION NO HACE
-----------------------------------------------------------

No funde cifras de dos fuentes. Si la oficial dice 9.718
seguidores y el proveedor dice otra cosa, son DOS observaciones
con dos procedencias, no un promedio. Promediarlas produciria un
numero que no midio nadie.

Y no conoce a ningun proveedor por su nombre: recibe cual es y
lo trata como «el proveedor».
===========================================================
*/

export const CLASE_DE_FUENTE = Object.freeze({
  OFICIAL: "official",
  PROVEEDOR: "provider"
});


export const ESTADO_DE_MEDICION = Object.freeze({
  MEDIDO_OFICIAL: "MEDIDO_OFICIAL",
  MEDIDO_PROVEEDOR: "MEDIDO_PROVEEDOR",

  /* Ninguna de las dos puede. No es lo mismo que no haberlo intentado. */
  SIN_FUENTE: "SIN_FUENTE",

  NO_PROBADO: "NO_PROBADO"
});


/*
  Estados de la via oficial que significan «esta via NO puede
  medir este activo». Son la puerta del fallback.

  NO_SOPORTADO_PERSONAL es el caso de Instagram: la cuenta existe
  y `business_discovery` no la abre ni la abrira.
*/
export const OFICIAL_NO_PUEDE = Object.freeze([
  "NO_SOPORTADO_PERSONAL",
  "NO_SOPORTADO",
  "CAPACIDAD_NO_DISPONIBLE",
  "SIN_CUENTA_EN_LA_VIA",
  "BLOQUEADO_META",
  "REQUIERE_PPCA"
]);


/*
  Y estos significan «la via oficial podria, pero hoy fallo por
  algo nuestro». NO abren el fallback: un token caducado se
  arregla renovando el token, no comprando datos raspados.
*/
export const OFICIAL_FALLO_TEMPORAL = Object.freeze([
  "CREDENCIAL_EXPIRADA",
  "CREDENCIAL_RECHAZADA",
  "CUOTA_AGOTADA",
  "ERROR"
]);


/*
===========================================================
DECIDIR LA FUENTE DE UN ACTIVO
===========================================================

    estadoOficial   lo que dijo la via oficial sobre ESTE activo
    proveedorPuede  si hay proveedor aprobado con esa capacidad
===========================================================
*/
export function fuenteParaActivo(entrada = {}) {
  const {
    platformId = null,
    accountId = null,
    estadoOficial = null,
    proveedorPuede = false,
    proveedorId = null
  } = entrada;

  const base = { platformId, accountId };

  /* 1 · La oficial midio. No se pregunta a nadie mas. */
  if (estadoOficial === "OBSERVADA" || estadoOficial === "MEDIDO_OFICIAL") {
    return {
      ...base,
      fuente: CLASE_DE_FUENTE.OFICIAL,
      estado: ESTADO_DE_MEDICION.MEDIDO_OFICIAL,
      usaProveedor: false,

      motivo:
        "la via oficial midio este activo. No se consulta al proveedor: seria gastar en un dato peor."
    };
  }

  /*
    2 · La oficial fallo por algo nuestro. Tampoco se cae al
    proveedor: eso taparia un problema que se arregla solo con
    renovar una credencial.
  */
  if (OFICIAL_FALLO_TEMPORAL.includes(estadoOficial)) {
    return {
      ...base,
      fuente: null,
      estado: ESTADO_DE_MEDICION.NO_PROBADO,
      usaProveedor: false,

      motivo: `la via oficial fallo con ${estadoOficial}, que es un problema nuestro y no una limitacion de la via. Se arregla ahi, no comprando el dato.`
    };
  }

  /* 3 · La via oficial no alcanza este activo. Aqui SI. */
  if (OFICIAL_NO_PUEDE.includes(estadoOficial)) {
    if (proveedorPuede) {
      return {
        ...base,
        fuente: CLASE_DE_FUENTE.PROVEEDOR,
        proveedorId,
        estado: ESTADO_DE_MEDICION.MEDIDO_PROVEEDOR,
        usaProveedor: true,

        /*
          El motivo del fallo oficial se CONSERVA. Sustituirlo por
          «lo midio el proveedor» borraria la razon por la que la
          via oficial no llega, que es justo lo que hay que saber
          para decidir si merece la pena pedir acceso a Meta.
        */
        estadoOficialConservado: estadoOficial,

        motivo: `la via oficial no alcanza este activo (${estadoOficial}) y el proveedor si. El estado oficial se conserva.`
      };
    }

    return {
      ...base,
      fuente: null,
      estado: ESTADO_DE_MEDICION.SIN_FUENTE,
      usaProveedor: false,
      estadoOficialConservado: estadoOficial,

      motivo: `ni la via oficial (${estadoOficial}) ni ningun proveedor aprobado pueden medir este activo.`
    };
  }

  /* 4 · No se intento nada todavia. */
  return {
    ...base,
    fuente: null,
    estado: ESTADO_DE_MEDICION.NO_PROBADO,
    usaProveedor: false,
    motivo: estadoOficial
      ? `estado oficial ${estadoOficial}: no se contempla como motivo de fallback`
      : "no se ha intentado medir este activo"
  };
}


/*
===========================================================
LA MISMA DECISION PARA TODOS LOS ACTIVOS DE UN CANDIDATO
===========================================================

Devuelve una decision POR ACTIVO. Nunca una por candidato: esa
fue la trampa que este modulo existe para evitar.
===========================================================
*/
export function fuentesDeCandidato(entrada = {}) {
  const { activos = [], proveedorId = null, capacidadDelProveedor = () => false } =
    entrada;

  const decisiones = (activos || []).map((a) =>
    fuenteParaActivo({
      platformId: a.platformId,
      accountId: a.accountId,
      estadoOficial: a.estadoOficial,
      proveedorId,
      proveedorPuede: capacidadDelProveedor(a.platformId, a.accountId) === true
    })
  );

  const cuenta = (e) => decisiones.filter((d) => d.estado === e).length;

  return {
    decisiones,

    resumen: {
      oficial: cuenta(ESTADO_DE_MEDICION.MEDIDO_OFICIAL),
      proveedor: cuenta(ESTADO_DE_MEDICION.MEDIDO_PROVEEDOR),
      sinFuente: cuenta(ESTADO_DE_MEDICION.SIN_FUENTE),
      noProbado: cuenta(ESTADO_DE_MEDICION.NO_PROBADO)
    },

    /*
      Que en el mismo candidato convivan las dos fuentes no es un
      error: es el resultado correcto cuando tiene un activo
      profesional y otro personal.
    */
    fuentesMixtas:
      cuenta(ESTADO_DE_MEDICION.MEDIDO_OFICIAL) > 0 &&
      cuenta(ESTADO_DE_MEDICION.MEDIDO_PROVEEDOR) > 0,

    nota:
      "Una decision por ACTIVO. Enrutar por candidato mandaria al proveedor activos que la via oficial ya mide mejor y gratis."
  };
}


/*
  La procedencia que acompana a cada observacion. Sin esto, dos
  cifras de fuentes distintas se ven iguales en una tabla.
*/
export function marcaDeFuente(entrada = {}) {
  const { fuente = null, proveedorId = null, estado = null } = entrada;

  return {
    sourceKind: fuente,

    providerName:
      fuente === CLASE_DE_FUENTE.OFICIAL ? "meta" : proveedorId || null,

    measurementStatus: estado,

    datoLicenciadoPorLaPlataforma: fuente === CLASE_DE_FUENTE.OFICIAL,

    noSeFunde:
      "Las cifras de fuentes distintas NO se promedian ni se mezclan: son observaciones separadas con procedencias separadas."
  };
}


export default {
  CLASE_DE_FUENTE,
  ESTADO_DE_MEDICION,
  OFICIAL_NO_PUEDE,
  OFICIAL_FALLO_TEMPORAL,
  fuenteParaActivo,
  fuentesDeCandidato,
  marcaDeFuente
};
