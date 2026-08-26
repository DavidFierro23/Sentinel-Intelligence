// apps/backend/services/ingest/coverageObservability.js

/*
===========================================================
COVERAGE OBSERVABILITY — INGEST-REAL-01
===========================================================

Una sola respuesta a «¿que se miro, que no, y que no se puede
afirmar por eso?».

LA REGLA QUE GOBIERNA ESTE MODULO
-----------------------------------------------------------

    LA AUSENCIA DE COBERTURA TIENE QUE SER VISIBLE.

Es la version general de lo que ya se aprendio dos veces:

  · «7 fuentes» donde la mayor era una plataforma con doce
    emisores sin identificar
  · tres agendas a cero leidas como si el territorio callara

Las dos veces el dato estaba, y las dos veces se leyo al reves
porque lo que faltaba no se veia.

TRES ESTADOS QUE NO SON EL MISMO
-----------------------------------------------------------

    se preguntó y no había      →  ausencia observada
    se preguntó y falló         →  ausencia de lectura
    no se preguntó              →  ausencia de pregunta

Solo el primero autoriza a decir «no hay». Los otros dos
autorizan a decir «no lo sabemos», que es una frase distinta y
mucho mas honesta.
===========================================================
*/


export const ESTADOS_COBERTURA = Object.freeze({
  OBSERVADA: "AUSENCIA_OBSERVADA",
  SIN_LECTURA: "AUSENCIA_DE_LECTURA",
  SIN_PREGUNTA: "AUSENCIA_DE_PREGUNTA"
});


const ESTADOS_QUE_NO_PERMITEN_AFIRMAR = new Set([
  "SIN_CREDENCIAL",
  "ERROR",
  "TIEMPO_AGOTADO",
  "CUOTA_AGOTADA",
  "BLOQUEADO",
  "INACCESIBLE",
  "LIMITE_DE_TASA",
  "RESPUESTA_NO_JSON",
  "NO_EJECUTADO",
  "NO_IMPLEMENTADO"
]);


export function componerCobertura({
  run = null,
  universo = null,
  registroMedios = null,
  dedup = null,
  agendas = null,
  territorio = null
} = {}) {
  /*
    ---------------------------------------------------------
    PROVEEDORES
    ---------------------------------------------------------
  */
  const filas = run?.providers || [];

  const proveedores = {
    declarados: filas.length,

    ejecutados: filas.filter((p) => !ESTADOS_QUE_NO_PERMITEN_AFIRMAR.has(p.estado)).length,

    sinCredencial: filas.filter((p) => p.estado === "SIN_CREDENCIAL").map((p) => p.providerId),

    conError: filas
      .filter((p) => ["ERROR", "TIEMPO_AGOTADO", "INACCESIBLE", "RESPUESTA_NO_JSON"].includes(p.estado))
      .map((p) => ({ providerId: p.providerId, error: p.error })),

    cuotaAgotada: filas
      .filter((p) => ["CUOTA_AGOTADA", "LIMITE_DE_TASA"].includes(p.estado))
      .map((p) => p.providerId),

    aportaronEvidencia: filas.filter((p) => (p.rawResults || 0) > 0).map((p) => p.providerId),

    /*
      El numero que decide como se lee TODO lo demas. Si es
      menor que el total, ninguna afirmacion de ausencia es
      valida.
    */
    permitenAfirmarAusencia: filas.filter((p) => p.permiteAfirmarAusencia).length
  };

  const coberturaCompleta =
    filas.length > 0 && proveedores.permitenAfirmarAusencia === filas.length;

  /*
    ---------------------------------------------------------
    FUENTES
    ---------------------------------------------------------
  */
  const fuentes = universo
    ? (() => {
        const todas = [...universo.fuentes.values()];

        return {
          total: todas.length,
          descubiertas: todas.filter((f) => f.estado === "DESCUBIERTA").length,
          observadas: todas.filter((f) => f.estado === "OBSERVADA").length,
          verificadas: todas.filter((f) => f.verificada).length,
          plataformas: todas.filter((f) => f.esPlataforma).length,
          emisores: todas.filter((f) => !f.esPlataforma).length,
          sinLicenciaComprobada: todas.filter((f) => f.usoComercialPermitido === null).length
        };
      })()
    : null;

  const medios = registroMedios
    ? (() => {
        const todos = [...registroMedios.medios.values()];

        return {
          total: todos.length,
          conFeedConocido: todos.filter((m) => m.rssFeeds.length > 0).length,
          sinRss: todos.filter((m) => m.estado === "SIN_RSS").length,
          inaccesibles: todos.filter((m) => m.estado === "INACCESIBLE").length,
          nuncaComprobados: todos.filter((m) => !m.lastCheckedAt).length
        };
      })()
    : null;

  /*
    ---------------------------------------------------------
    EVIDENCIA
    ---------------------------------------------------------
  */
  const evidencia = dedup
    ? {
        bruto: dedup.brutas ?? 0,
        unico: dedup.unicas ?? 0,
        duplicado: dedup.duplicadosAbsorbidos ?? 0,
        tasaDuplicado: dedup.tasaDuplicado ?? null,
        corroboradaPorVariosProveedores: dedup.corroboradasPorVariosProveedores ?? 0,
        sindicada: dedup.sindicadas ?? 0,

        /* Lo rellena quien tenga la salida del geolocalizador. */
        geolocalizable: null
      }
    : null;

  /*
    ---------------------------------------------------------
    AGENDAS

    Una agenda a cero es el caso que este panel existe para no
    dejar pasar en silencio.
    ---------------------------------------------------------
  */
  const agendasVacias = agendas
    ? Object.entries(agendas)
        .filter(([k, m]) => k !== "SIN_CLASIFICAR" && (m?.evidencias || 0) === 0)
        .map(([k]) => k)
    : [];

  /*
    ---------------------------------------------------------
    TERRITORIO
    ---------------------------------------------------------
  */
  const territorioCobertura = territorio
    ? {
        canton: territorio.canton ?? null,
        parroquia: territorio.parroquia ?? null,
        toponimo: territorio.toponimo ?? null,
        noLocalizado: territorio.noLocalizado ?? null
      }
    : null;

  /*
    ---------------------------------------------------------
    HUECOS — lo que no se puede afirmar y por que
    ---------------------------------------------------------
  */
  const huecos = [];

  proveedores.sinCredencial.forEach((p) => {
    huecos.push({
      ambito: "proveedor",
      referencia: p,
      estado: ESTADOS_COBERTURA.SIN_PREGUNTA,
      mensaje: `No se preguntó a ${p}: falta credencial. Su silencio no es ausencia de contenido.`
    });
  });

  proveedores.conError.forEach((p) => {
    huecos.push({
      ambito: "proveedor",
      referencia: p.providerId,
      estado: ESTADOS_COBERTURA.SIN_LECTURA,
      mensaje: `${p.providerId} falló (${p.error || "error"}). Ausencia de lectura, no de hechos.`
    });
  });

  proveedores.cuotaAgotada.forEach((p) => {
    huecos.push({
      ambito: "proveedor",
      referencia: p,
      estado: ESTADOS_COBERTURA.SIN_LECTURA,
      mensaje: `${p} agotó su cuota. Lo que no llegó pudo existir.`
    });
  });

  agendasVacias.forEach((a) => {
    huecos.push({
      ambito: "agenda",
      referencia: a,
      estado: ESTADOS_COBERTURA.SIN_PREGUNTA,
      mensaje: `${a} sin una sola evidencia. Vacío NO significa silencio: significa que ninguna fuente de ese tipo entró en el corpus.`
    });
  });

  if (medios?.nuncaComprobados > 0) {
    huecos.push({
      ambito: "medios",
      referencia: `${medios.nuncaComprobados} medio(s)`,
      estado: ESTADOS_COBERTURA.SIN_PREGUNTA,
      mensaje: `${medios.nuncaComprobados} medio(s) del registro nunca se han comprobado. No se sabe si publican feed.`
    });
  }

  if (fuentes?.plataformas > 0) {
    huecos.push({
      ambito: "fuentes",
      referencia: `${fuentes.plataformas} plataforma(s)`,
      estado: ESTADOS_COBERTURA.SIN_PREGUNTA,
      mensaje: `${fuentes.plataformas} plataforma(s) en el corpus. Sus emisores reales solo se identifican con la API oficial de cada una.`
    });
  }

  return {
    coberturaCompleta,

    proveedores,
    fuentes,
    medios,
    evidencia,

    agendas: agendas
      ? { metricas: agendas, vacias: agendasVacias }
      : null,

    territorio: territorioCobertura,

    huecos,

    /*
      La frase que resume si se puede afirmar ausencia. Va
      primero deliberadamente: es la que condiciona la lectura
      de todo lo demas.
    */
    veredicto: coberturaCompleta
      ? "Todos los proveedores respondieron. Una ausencia en este corpus es una ausencia observada."
      : `${filas.length - proveedores.permitenAfirmarAusencia} de ${filas.length} proveedores no respondieron. NO se puede afirmar que algo no exista: solo que no llegó.`,

    declaraciones: [
      "«Se preguntó y no había», «se preguntó y falló» y «no se preguntó» son tres cosas distintas. Solo la primera autoriza a decir «no hay».",
      "La ausencia de cobertura es visible por diseño: un hueco que no se ve se lee como un cero."
    ]
  };
}


export default { ESTADOS_COBERTURA, componerCobertura };
