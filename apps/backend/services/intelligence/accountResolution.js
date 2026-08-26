// apps/backend/services/intelligence/accountResolution.js

/*
===========================================================
ACCOUNT RESOLUTION — CANDIDATE INTELLIGENCE V1
===========================================================

Un candidato puede tener VARIAS cuentas en la MISMA plataforma.
Es el caso normal, no la excepcion: perfil personal, cuenta de
campana, cuenta institucional del cargo. Y tambien es el caso en
que se cuelan homonimos y suplantaciones.

Por eso la pregunta «¿esta cuenta es del candidato?» no se
responde con un booleano ni con un parecido de nombre: se
responde con SENALES, y cada senal queda escrita.

    LA REGLA QUE GOBIERNA ESTE MODULO

    Una cuenta DESCUBIERTA no pasa a CORROBORADA por parecerse
    el nombre. Nunca. El nombre es lo que hace que la miremos,
    no lo que la confirma.

Corroborar exige al menos una senal INDEPENDIENTE del nombre:
que otra cuenta ya consolidada la enlace, que la web declarada
la publique, que su propia biografia publica la identifique, que
una referencia externa independiente la respalde, o que varios
proveedores distintos la devuelvan por vias distintas.

    NO reconocimiento facial. NO biometria.

Y la procedencia no se pierde: quien la declaro, quien la
descubrio, quien la corroboro y cuando son cuatro hechos
distintos que se guardan por separado.
===========================================================
*/

import { normalizarTexto } from "../textUtils.js";


/*
-----------------------------------------------------------
ESTADOS DE RESOLUCION

Ocho estados. Los cinco primeros describen cuanto sabemos; los
tres ultimos, que decidimos.

COMPATIBILIDAD: estos nombres conviven con `ESTADOS_IDENTIDAD`
de `projectStore`, que sigue siendo la fuente del inventario.
`ESTADO_EQUIVALENTE` traduce en una direccion y solo en una: se
lee el estado historico y se le da una lectura de resolucion,
sin reescribir nada en el expediente.
-----------------------------------------------------------
*/
export const ESTADOS_RESOLUCION = Object.freeze({
  /* La escribio el analista. Procedencia, no evidencia. */
  DECLARADA: "DECLARADA",

  /* La encontro Sentinel. Todavia sin veredicto. */
  DESCUBIERTA: "DESCUBIERTA",

  /*
    Descubierta Y con indicios de pertenecer al candidato, pero
    ninguno independiente del nombre. Es el estado que impide el
    salto que este modulo existe para impedir.
  */
  CANDIDATA: "CANDIDATA",

  /* Sostenida por al menos una senal independiente del nombre. */
  CORROBORADA: "CORROBORADA",

  /* Corroborada y sostenida en el inventario a lo largo del tiempo. */
  CONSOLIDADA: "CONSOLIDADA",

  /*
    Estuvo en el inventario y esta vez no se pudo observar. NO es
    una baja: es una ausencia de observacion, y la diferencia es
    el punto entero del contrato de identidad.
  */
  NO_REENCONTRADA: "NO_REENCONTRADA",

  /*
    Hay senales en conflicto: por ejemplo dos cuentas del mismo
    handle en la misma plataforma con evidencias que se
    contradicen. Se marca para que la mire una persona.
  */
  DUDOSA: "DUDOSA",

  /* Retirada por decision del analista, nunca por ausencia. */
  DESCARTADA: "DESCARTADA"
});


/*
  Lectura de resolucion de un estado historico del inventario.
  Solo traduce; no altera el expediente.
*/
export const ESTADO_EQUIVALENTE = Object.freeze({
  DESCUBIERTA: ESTADOS_RESOLUCION.DESCUBIERTA,
  ATRIBUIDA: ESTADOS_RESOLUCION.CANDIDATA,
  CONSOLIDADA: ESTADOS_RESOLUCION.CONSOLIDADA,
  DECLARADA_POR_ANALISTA: ESTADOS_RESOLUCION.DECLARADA,
  REVALIDADA: ESTADOS_RESOLUCION.CONSOLIDADA,
  NO_REENCONTRADA_EN_ULTIMA_VERIFICACION: ESTADOS_RESOLUCION.NO_REENCONTRADA,
  REVOCADA: ESTADOS_RESOLUCION.DESCARTADA
});


/*
===========================================================
SENALES DE ATRIBUCION
===========================================================

`independiente` es el campo que decide todo. Una senal
independiente no depende de que el nombre se parezca; una
dependiente, si.

Se puede juntar cualquier cantidad de senales dependientes y
seguir sin poder corroborar. Eso es deliberado: mil formas de
comprobar que el nombre coincide siguen sin decir de quien es la
cuenta.
===========================================================
*/
export const SENALES = Object.freeze({
  /* ---------- INDEPENDIENTES DEL NOMBRE ---------- */

  ENLACE_CRUZADO: {
    id: "enlace_cruzado",
    nombre: "Enlazada desde otra cuenta ya consolidada",
    independiente: true,
    explicacion:
      "una cuenta que ya pertenece al candidato enlaza a esta, asi que el vinculo lo declara el propio sujeto"
  },

  WEB_DECLARADA: {
    id: "web_declarada",
    nombre: "Publicada en la web declarada del candidato",
    independiente: true,
    explicacion:
      "la web propia del candidato publica esta cuenta como suya"
  },

  BIO_PUBLICA: {
    id: "bio_publica",
    nombre: "La biografia publica de la cuenta identifica al candidato",
    independiente: true,
    explicacion:
      "la propia cuenta se identifica con datos del candidato mas alla del nombre: cargo, organizacion o enlace propio"
  },

  REFERENCIA_INDEPENDIENTE: {
    id: "referencia_independiente",
    nombre: "Referencia externa independiente",
    independiente: true,
    explicacion:
      "una fuente ajena al candidato y ajena a Sentinel publica esta cuenta como suya"
  },

  MULTI_PROVEEDOR_MULTI_VIA: {
    id: "multi_proveedor_multi_via",
    nombre: "Varios proveedores por vias distintas",
    independiente: true,
    explicacion:
      "proveedores distintos la devolvieron por vias distintas, asi que no es el sesgo de un solo buscador"
  },

  /* ---------- DEPENDIENTES DEL NOMBRE: NO CORROBORAN ---------- */

  COINCIDENCIA_NOMBRE: {
    id: "coincidencia_nombre",
    nombre: "El nombre coincide",
    independiente: false,
    noCorrobora: true,
    explicacion:
      "el nombre es lo que hace que miremos esta cuenta, no lo que la confirma: los homonimos existen y la suplantacion copia nombres"
  },

  COINCIDENCIA_HANDLE: {
    id: "coincidencia_handle",
    nombre: "El handle coincide con otra plataforma",
    independiente: false,
    noCorrobora: true,
    explicacion:
      "mismo handle no es misma persona: amplia la busqueda, no cierra la identidad"
  },

  DECLARACION_DEL_ANALISTA: {
    id: "declaracion_del_analista",
    nombre: "Declarada por el analista",
    independiente: false,
    noCorrobora: true,
    explicacion:
      "una declaracion es procedencia y es valiosa, pero no es evidencia externa: si contara como corroboracion, Sentinel se estaria confirmando a si mismo"
  }
});


const POR_ID = Object.fromEntries(
  Object.values(SENALES).map((s) => [s.id, s])
);


/*
  Senales presentes en una cuenta del inventario. Se leen de lo
  que el expediente ya guarda; no se infiere nada nuevo.
*/
export function senalesDeCuenta(cuenta = {}, contexto = {}) {
  const encontradas = [];

  const anadir = (senal, detalle) => {
    if (!senal) return;

    encontradas.push({
      id: senal.id,
      nombre: senal.nombre,
      independiente: senal.independiente === true,
      explicacion: senal.explicacion,
      detalle: detalle || null
    });
  };

  if (cuenta.declaradaPorAnalista === true) {
    anadir(SENALES.DECLARACION_DEL_ANALISTA, null);
  }

  /*
    Multiproveedor Y multivia. Las dos condiciones: el mismo
    buscador devolviendo la misma URL dos veces no es
    corroboracion, es repeticion.
  */
  const corr = cuenta.corroboracion || null;

  const proveedores =
    cuenta.proveedoresHistoricos || cuenta.proveedores || [];

  const nProveedores =
    corr?.totalProveedores ?? new Set(proveedores).size;

  if (nProveedores > 1 && corr?.multiVia === true) {
    anadir(
      SENALES.MULTI_PROVEEDOR_MULTI_VIA,
      `${nProveedores} proveedores por vias distintas`
    );
  }

  const vias = cuenta.vias || corr?.vias || [];

  if (vias.includes("plataforma_declarada")) {
    anadir(SENALES.REFERENCIA_INDEPENDIENTE, "declarada en base de referencia");
  }

  /*
    Enlace cruzado y web declarada llegan del contexto, porque
    dependen de las OTRAS cuentas del candidato y de su web. Una
    cuenta no puede corroborarse mirandose a si misma.
  */
  const enlaces = (contexto.enlacesCruzados || []).filter(
    (e) => e.hacia === cuenta.id
  );

  enlaces.forEach((e) =>
    anadir(
      e.desde === "web" ? SENALES.WEB_DECLARADA : SENALES.ENLACE_CRUZADO,
      `enlazada desde ${e.desde}`
    )
  );

  /*
    La biografia publica solo cuenta si dice algo MAS que el
    nombre. Si solo repite el nombre, es coincidencia de nombre y
    entra por la otra puerta.
  */
  const bio = normalizarTexto(String(cuenta.profileBio || ""));

  const anclas = (contexto.anclasIdentidad || [])
    .map((a) => normalizarTexto(String(a)))
    .filter((a) => a.length >= 4);

  const ancladas = anclas.filter((a) => bio.includes(a));

  if (bio && ancladas.length) {
    anadir(SENALES.BIO_PUBLICA, `la biografia menciona: ${ancladas.join(", ")}`);
  }

  /*
    Coincidencia de nombre. Se registra SIEMPRE que exista,
    precisamente para dejar por escrito que esta ahi y que no
    corrobora.
  */
  if (cuenta.correspondencia != null) {
    anadir(
      SENALES.COINCIDENCIA_NOMBRE,
      `correspondencia ${cuenta.correspondencia}/100`
    );
  }

  if (cuenta.propagadaPorHandle === true) {
    anadir(SENALES.COINCIDENCIA_HANDLE, null);
  }

  return encontradas;
}


/*
===========================================================
SOLIDEZ DE UNA ATRIBUCION

Se publica SOLO porque es explicable: es un recuento de senales
independientes, no un modelo. De cada punto se puede decir de
donde sale.

Si no hay ninguna senal independiente, el valor es 0 y el estado
no puede pasar de CANDIDATA. No es una penalizacion: es que no
sabemos.
===========================================================
*/
export function solidezDeAtribucion(senales = []) {
  const independientes = senales.filter((s) => s.independiente);

  const dependientes = senales.filter((s) => !s.independiente);

  /*
    25 por senal independiente distinta, tope 100. Cuatro senales
    independientes distintas es todo lo que este modulo puede
    exigir hoy; mas alla no habria con que medir.
  */
  const distintas = new Set(independientes.map((s) => s.id));

  const valor = Math.min(100, distintas.size * 25);

  return {
    valor,
    maximo: 100,

    senalesIndependientes: [...distintas],
    senalesDependientes: [...new Set(dependientes.map((s) => s.id))],

    formula:
      "25 puntos por cada senal independiente DISTINTA, con tope de 100. Las senales que dependen del nombre no suman: coincidencia de nombre, coincidencia de handle y declaracion del analista aportan 0.",

    explicacion: distintas.size
      ? `${valor}/100 sostenido por ${distintas.size} senal(es) independiente(s): ${[...distintas].join(", ")}.`
      : "0/100: no hay ninguna senal independiente del nombre. La cuenta puede ser del candidato, pero hoy no hay con que sostenerlo.",

    /*
      Dicho aqui para que no haga falta suponerlo en ningun sitio.
    */
    noEs:
      "No es una probabilidad ni una medida de influencia. Es un recuento de evidencias independientes de atribucion."
  };
}


/*
===========================================================
RESOLVER UNA CUENTA
===========================================================
*/
export function resolverCuenta(cuenta = {}, contexto = {}) {
  const senales = senalesDeCuenta(cuenta, contexto);

  const solidez = solidezDeAtribucion(senales);

  const independientes = solidez.senalesIndependientes.length;

  const razones = [];

  /*
    ORDEN DE DECISION. Lo primero es lo que ya se decidio: una
    baja del analista y una ausencia de observacion no las puede
    revertir un recuento de senales.
  */
  let estado;

  const historico = cuenta.estado || null;

  if (historico === "REVOCADA" || cuenta.descartada === true) {
    estado = ESTADOS_RESOLUCION.DESCARTADA;

    razones.push("retirada por decision del analista");
  } else if (contexto.enConflicto === true) {
    estado = ESTADOS_RESOLUCION.DUDOSA;

    razones.push(
      "hay senales en conflicto con otra cuenta del mismo handle: lo decide una persona"
    );
  } else if (independientes > 0) {
    /*
      Corroborada. Y CONSOLIDADA solo si ademas se ha sostenido en
      el tiempo: primera y ultima observacion distintas, o mas de
      una ejecucion detras.
    */
    const sostenida =
      cuenta.firstSeenAt &&
      cuenta.lastSeenAt &&
      cuenta.firstSeenAt !== cuenta.lastSeenAt;

    estado = sostenida
      ? ESTADOS_RESOLUCION.CONSOLIDADA
      : ESTADOS_RESOLUCION.CORROBORADA;

    razones.push(
      `${independientes} senal(es) independiente(s) del nombre: ${solidez.senalesIndependientes.join(", ")}`
    );

    if (sostenida) {
      razones.push("observada en mas de un momento distinto");
    }
  } else if (cuenta.declaradaPorAnalista === true) {
    estado = ESTADOS_RESOLUCION.DECLARADA;

    razones.push(
      "la declaro el analista y no hay ninguna senal independiente que la corrobore"
    );
  } else if (senales.some((s) => s.id === SENALES.COINCIDENCIA_NOMBRE.id)) {
    estado = ESTADOS_RESOLUCION.CANDIDATA;

    razones.push(
      "el nombre coincide, y eso no corrobora: sin senal independiente no pasa de candidata"
    );
  } else {
    estado = ESTADOS_RESOLUCION.DESCUBIERTA;

    razones.push("encontrada, sin indicios de pertenencia todavia");
  }

  /*
    La ausencia de observacion se superpone: NO cambia lo que
    sabemos de la identidad, solo dice que esta vez no se vio.
    Por eso va como plano aparte y no como estado sustitutivo,
    salvo cuando no hay nada mas que decir.
  */
  const noReencontrada =
    historico === "NO_REENCONTRADA_EN_ULTIMA_VERIFICACION" ||
    (cuenta.lastCheckedAt &&
      cuenta.lastSeenAt &&
      cuenta.lastCheckedAt > cuenta.lastSeenAt);

  return {
    /* Identidad estable: plataforma + handle normalizado. */
    accountId: idDeCuenta(cuenta),

    candidateId: contexto.candidateId || null,
    projectId: contexto.projectId || null,

    plataformaId: cuenta.plataformaId || null,
    plataforma: cuenta.plataforma || null,
    handle: cuenta.handle || null,
    url: cuenta.url || null,

    estado,
    estadoHistorico: historico,
    lecturaDelHistorico: historico ? ESTADO_EQUIVALENTE[historico] || null : null,

    razones,

    senales,
    solidez,

    /* ---- procedencia: cuatro hechos distintos ---- */
    procedencia: {
      declaradaPorAnalista: cuenta.declaradaPorAnalista === true,
      descubiertaPorSentinel: cuenta.descubiertaPorSentinel === true,
      corroboradaPorSentinel: independientes > 0,
      proveedores: cuenta.proveedoresHistoricos || cuenta.proveedores || []
    },

    /* ---- fechas: cada una es un hecho distinto ---- */
    firstSeenAt: cuenta.firstSeenAt || null,
    lastSeenAt: cuenta.lastSeenAt || null,
    lastCheckedAt: cuenta.lastCheckedAt || null,
    declaredAt: cuenta.declaredAt || cuenta.creadaEn || null,
    corroboratedAt: independientes > 0 ? cuenta.lastSeenAt || null : null,

    /* Plano de observacion, separado del de identidad. */
    observacion: {
      noReencontradaEnLaUltimaVerificacion: noReencontrada === true,
      nota: noReencontrada
        ? "No se pudo observar en la ultima verificacion. Eso NO la revoca ni la da de baja: la ausencia de una observacion no es evidencia de ausencia."
        : null
    },

    historial: cuenta.historialEstados || [],
    historiaIncompleta: cuenta.historiaIncompleta === true
  };
}


/*
  Identidad estable de una cuenta. Es la misma forma que ya usa la
  ficha —plataforma + handle normalizado—, a proposito: cambiarla
  romperia las referencias que ya existen.
*/
export function idDeCuenta(cuenta = {}) {
  const p = normalizarTexto(String(cuenta.plataformaId || cuenta.platform || ""));

  const h = normalizarTexto(String(cuenta.handle || ""));

  if (cuenta.id) return cuenta.id;

  if (!p || !h) return null;

  return `${p}:${h}`;
}


/*
===========================================================
RESOLVER TODAS LAS CUENTAS DE UN CANDIDATO
===========================================================

Varias cuentas en la misma plataforma NO es un error que haya
que resolver eligiendo una. Un candidato puede tener perfil
personal y cuenta de campana, y las dos son suyas.

Lo que si hace falta es DECLARARLO, para que nadie lea «tres
cuentas de Instagram» como un fallo del motor ni como tres
personas. Y cuando dos cuentas comparten handle exacto en la
misma plataforma —lo que no deberia poder pasar—, ahi si hay
conflicto y las dos quedan DUDOSAS.
===========================================================
*/
export function resolverCuentasDelCandidato(entrada = {}) {
  const {
    cuentas = [],
    candidateId = null,
    projectId = null,
    anclasIdentidad = [],
    enlacesCruzados = []
  } = entrada;

  /* Handles repetidos dentro de la misma plataforma. */
  const cuenta = new Map();

  cuentas.forEach((c) => {
    const k = idDeCuenta(c);

    if (!k) return;

    cuenta.set(k, (cuenta.get(k) || 0) + 1);
  });

  const resueltas = cuentas.map((c) =>
    resolverCuenta(c, {
      candidateId,
      projectId,
      anclasIdentidad,
      enlacesCruzados,
      enConflicto: cuenta.get(idDeCuenta(c)) > 1
    })
  );

  /* Pluralidad por plataforma: se declara, no se corrige. */
  const porPlataforma = {};

  resueltas.forEach((r) => {
    const p = r.plataformaId || "sin_plataforma";

    porPlataforma[p] = porPlataforma[p] || [];

    porPlataforma[p].push(r.accountId);
  });

  const multiples = Object.entries(porPlataforma)
    .filter(([, ids]) => ids.length > 1)
    .map(([plataformaId, ids]) => ({
      plataformaId,
      cuentas: ids,
      nota:
        "Mas de una cuenta atribuida en esta plataforma. Puede ser legitimo —perfil personal y cuenta de campana— o puede haber un homonimo. Cada cuenta se sostiene con sus propias senales; ninguna hereda la corroboracion de la otra."
    }));

  const porEstado = {};

  resueltas.forEach((r) => {
    porEstado[r.estado] = (porEstado[r.estado] || 0) + 1;
  });

  return {
    candidateId,
    projectId,

    cuentas: resueltas,

    resumen: {
      total: resueltas.length,
      porEstado,

      corroboradas: resueltas.filter(
        (r) =>
          r.estado === ESTADOS_RESOLUCION.CORROBORADA ||
          r.estado === ESTADOS_RESOLUCION.CONSOLIDADA
      ).length,

      sinSenalIndependiente: resueltas.filter(
        (r) => r.solidez.senalesIndependientes.length === 0
      ).length,

      multiplesPorPlataforma: multiples
    },

    regla:
      "Ninguna cuenta pasa a CORROBORADA por parecido de nombre. Hace falta al menos una senal independiente del nombre.",

    prohibido: [
      "reconocimiento facial",
      "biometria",
      "corroborar por similitud de nombre",
      "heredar la corroboracion de otra cuenta de la misma plataforma"
    ]
  };
}


export default {
  ESTADOS_RESOLUCION,
  ESTADO_EQUIVALENTE,
  SENALES,
  senalesDeCuenta,
  solidezDeAtribucion,
  resolverCuenta,
  resolverCuentasDelCandidato,
  idDeCuenta,
  POR_ID
};
