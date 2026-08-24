// apps/backend/services/projects/actorCorrelation.js

/*
===========================================================
CORRELACIÓN OBSERVABLE — ARQ-INV-003
===========================================================

Mide coincidencias entre dos expedientes. Nada más.

LO QUE ESTE MÓDULO NO DIRÁ NUNCA
-----------------------------------------------------------

No dirá que un actor transfiere votos, ni que garantiza apoyo,
ni que provoca crecimiento electoral. No porque falte precisión,
sino porque el dato no lo sostiene: dos personas que aparecen en
los mismos medios el mismo mes coinciden, y coincidir no es
causar.

Cada resultado sale acompañado de qué NO significa. La
prohibición está en el contrato de salida, no solo en la
documentación, para que ninguna interfaz pueda presentarlo de
otra forma sin quitarla a mano.

LO QUE SÍ MIDE
-----------------------------------------------------------

  coincidencia temática   términos compartidos entre las
                          narrativas de ambos expedientes
  medios compartidos      cuentas de medios que cubren a los dos
  coincidencia temporal   solape de los periodos con evidencia
  presencia territorial   si ambos aparecen en el mismo territorio

Cada una con su recuento y su lista, para que el analista pueda
mirar la evidencia y no el número.
===========================================================
*/


function normalizar(t) {
  return String(t ?? "").toLowerCase().trim();
}


function interseccion(a, b) {
  const s = new Set(b.map(normalizar));

  return a.filter((x) => s.has(normalizar(x)));
}


/*
===========================================================
CORRELACIONAR DOS EXPEDIENTES
===========================================================
*/

export function correlacionObservable(entrada = {}) {
  const { actor, candidato, expedienteActor, expedienteCandidato } = entrada;

  if (!expedienteActor || !expedienteCandidato) {
    return {
      version: "1.0",
      disponible: false,
      motivo:
        "Faltan expedientes: la correlación exige que ambos hayan sido investigados. No se estima nada a partir de un solo lado."
    };
  }

  /*
    ---------------------------------------------------------
    MEDIOS COMPARTIDOS
    ---------------------------------------------------------

    La señal más sólida de las cuatro: un medio que cubre a los
    dos es un hecho comprobable, no una interpretación.
  */
  const mediosActor = (expedienteActor.medios || []).map(
    (m) => `${m.plataforma}:${normalizar(m.handle)}`
  );

  const mediosCandidato = (expedienteCandidato.medios || []).map(
    (m) => `${m.plataforma}:${normalizar(m.handle)}`
  );

  const mediosComunes = interseccion(mediosActor, mediosCandidato);

  /*
    ---------------------------------------------------------
    COINCIDENCIA TEMÁTICA
    ---------------------------------------------------------
  */
  const temasActor = expedienteActor.temas || [];

  const temasCandidato = expedienteCandidato.temas || [];

  const temasComunes = interseccion(temasActor, temasCandidato);

  /*
    ---------------------------------------------------------
    COINCIDENCIA TEMPORAL
    ---------------------------------------------------------
  */
  const rango = (e) => {
    const f = [e.primeraFecha, e.ultimaFecha].filter(Boolean).sort();

    return f.length ? { desde: f[0], hasta: f[f.length - 1] } : null;
  };

  const ra = rango(expedienteActor);

  const rc = rango(expedienteCandidato);

  let solapeTemporal = null;

  if (ra && rc) {
    const desde = ra.desde > rc.desde ? ra.desde : rc.desde;

    const hasta = ra.hasta < rc.hasta ? ra.hasta : rc.hasta;

    solapeTemporal = desde <= hasta ? { desde, hasta } : null;
  }

  /*
    ---------------------------------------------------------
    PRESENCIA TERRITORIAL
    ---------------------------------------------------------
  */
  const territorioComun =
    actor?.territorio &&
    candidato?.territorio &&
    normalizar(actor.territorio) === normalizar(candidato.territorio)
      ? actor.territorio
      : null;

  const senales = [
    {
      id: "medios_compartidos",
      nombre: "Medios que cubren a ambos",
      valor: mediosComunes.length,
      detalle: mediosComunes.length
        ? mediosComunes.slice(0, 8).join(", ")
        : "ningún medio del corpus cubre a los dos",
      comprobable: true
    },
    {
      id: "coincidencia_tematica",
      nombre: "Coincidencia temática",
      valor: temasComunes.length,
      detalle: temasComunes.length
        ? temasComunes.slice(0, 8).join(", ")
        : "sin términos compartidos entre las narrativas",
      comprobable: true
    },
    {
      id: "coincidencia_temporal",
      nombre: "Coincidencia temporal",
      valor: solapeTemporal ? 1 : 0,
      detalle: solapeTemporal
        ? `evidencia fechada solapada entre ${String(solapeTemporal.desde).slice(0, 10)} y ${String(solapeTemporal.hasta).slice(0, 10)}`
        : "sin periodos fechados que se solapen, o sin fechas en la evidencia",
      comprobable: Boolean(solapeTemporal)
    },
    {
      id: "presencia_territorial",
      nombre: "Presencia territorial",
      valor: territorioComun ? 1 : 0,
      detalle: territorioComun
        ? `ambos declarados en ${territorioComun}`
        : "territorios declarados distintos o no declarados",
      comprobable: Boolean(territorioComun)
    }
  ];

  const activas = senales.filter((x) => x.valor > 0).length;

  return {
    version: "1.0",

    disponible: true,

    /* Etiqueta obligatoria del sprint. */
    etiqueta: "Correlación observable",

    actor: { id: actor?.id, nombre: actor?.nombre, rol: actor?.rol },

    candidato: {
      id: candidato?.id,
      nombre: candidato?.nombre,
      rol: candidato?.rol
    },

    senales,

    senalesConCoincidencia: activas,

    /*
      Se declara la INTENSIDAD de la coincidencia, no una
      probabilidad. Cuatro señales de cuatro sigue siendo
      coincidencia.
    */
    intensidad:
      activas >= 3
        ? "coincidencia alta"
        : activas === 2
          ? "coincidencia media"
          : activas === 1
            ? "coincidencia baja"
            : "sin coincidencias observables",

    resumen:
      activas === 0
        ? "No se observa ninguna coincidencia entre los dos expedientes con la evidencia disponible."
        : `Se observan ${activas} de 4 coincidencias: ${senales
            .filter((x) => x.valor > 0)
            .map((x) => x.nombre.toLowerCase())
            .join(", ")}.`,

    /*
      ---------------------------------------------------------
      LO QUE NO SIGNIFICA — parte del contrato de salida
      ---------------------------------------------------------
    */
    noImplica: [
      "No implica transferencia de votos.",
      "No implica respaldo, alianza ni acuerdo entre las partes.",
      "No implica causalidad: coincidir en medios, temas o fechas no es influir.",
      "No es una previsión electoral ni una probabilidad de resultado."
    ],

    lecturaCorrecta:
      "Estas cifras describen coincidencias en la evidencia recogida. Interpretar qué significan es competencia del analista.",

    generadoEn: new Date().toISOString()
  };
}


export default { correlacionObservable };
