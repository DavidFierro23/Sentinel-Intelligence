// apps/backend/services/social/identity/matchExplainer.js

import {
  SENALES,
  nivelDeCorrespondencia,
  topeDeConcurrencia,
  TOPE_POR_CONCURRENCIA
} from "../socialContracts.js";

/*
===========================================================
MATCH EXPLAINER
===========================================================

Convierte una puntuación en una EXPLICACIÓN auditable.

Cumple IA1 (explicabilidad obligatoria): el sistema no
devuelve "94/100", devuelve cómo se construyó ese 94 —
qué sumó, qué restó, qué tope se aplicó y qué no se pudo
medir.

Regla de diseño: si alguien lee la explicación y no puede
reconstruir la cifra a mano, la explicación está incompleta.
===========================================================
*/


export function construirExplicacion({
  senales,
  contrasenales,
  bruto,
  topeAplicado,
  puntuacionFinal,
  senalesActivas,
  contextBoost = null,
  trasTope = null,
  vetoPorContexto = false
}) {
  const nivel = nivelDeCorrespondencia(puntuacionFinal);

  /*
    ---------------------------------------------------------
    APORTES — lo que sumó, en orden de magnitud
    ---------------------------------------------------------
  */
  const aportes = senales
    .filter((s) => s.activa && s.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos)
    .map((s) => ({
      senal: s.id,
      nombre: s.nombre,
      puntos: s.puntos,
      pesoMaximo: s.pesoMaximo,
      aprovechado: s.pesoMaximo
        ? `${Math.round((s.puntos / s.pesoMaximo) * 100)} %`
        : "—",
      motivo: s.detalle,
      limitacion: s.limitacion || null,
      procedencia: s.procedencia || null,
      evidencias: s.evidencias || []
    }));

  /*
    ---------------------------------------------------------
    PENALIZACIONES — lo que restó
    ---------------------------------------------------------
  */
  const penalizaciones = contrasenales.map((s) => ({
    senal: s.id,
    nombre: s.nombre,
    puntos: s.puntos,
    motivo: s.detalle,
    evidencias: s.evidencias || []
  }));

  /*
    ---------------------------------------------------------
    NO MEDIDO — señales sin implementar y sin datos

    Esto es tan importante como lo medido: dice al analista
    qué parte del juicio está pendiente.
    ---------------------------------------------------------
  */
  const sinImplementar = SENALES.filter((s) => !s.implementada).map((s) => ({
    senal: s.id,
    nombre: s.nombre,
    fuerza: s.fuerza,
    motivo: s.requiere || "No implementada",
    descripcion: s.descripcion
  }));

  const sinDatos = senales
    .filter((s) => !s.activa && !s.esContrasenal)
    .map((s) => ({
      senal: s.id,
      nombre: s.nombre,
      motivo: s.detalle
    }));

  /*
    ---------------------------------------------------------
    CÁLCULO PASO A PASO — reproducible a mano
    ---------------------------------------------------------
  */
  const pasos = [];

  aportes.forEach((a) => {
    pasos.push({
      paso: `${a.senal} · ${a.nombre}`,
      operacion: `+${a.puntos}`,
      detalle: a.motivo
    });
  });

  penalizaciones.forEach((p) => {
    pasos.push({
      paso: `${p.senal} · ${p.nombre} (contraseñal)`,
      operacion: `${p.puntos}`,
      detalle: p.motivo
    });
  });

  pasos.push({
    paso: "Subtotal",
    operacion: `= ${bruto}`,
    detalle: "Suma de aportes menos penalizaciones."
  });

  const seAplicoTope = puntuacionFinal < bruto;

  pasos.push({
    paso: `Tope por concurrencia (${senalesActivas} señal${
      senalesActivas === 1 ? "" : "es"
    } activa${senalesActivas === 1 ? "" : "s"})`,
    operacion: seAplicoTope ? `→ ${topeAplicado}` : `sin efecto (${topeAplicado})`,
    detalle: seAplicoTope
      ? `Ninguna señal aislada confirma identidad: con ${senalesActivas} señal(es) el máximo admisible es ${topeAplicado}.`
      : `El subtotal no alcanza el tope de ${topeAplicado} para ${senalesActivas} señal(es); no se recorta.`
  });

  /*
    CONTEXT BOOST (CB-1) — Sprint 3.2.
    Se muestra como paso propio: no es una senal de identidad,
    es un modulador de contexto, y confundirlos haria
    inexplicable la cifra.
  */
  if (contextBoost) {
    contextBoost.bonificaciones.forEach((b) => {
      pasos.push({
        paso: `CB-1 · contexto afin "${b.termino}"`,
        operacion: `+${b.puntos}`,
        detalle: `${b.tipo} (origen: ${b.origen})`
      });
    });

    contextBoost.penalizaciones.forEach((p) => {
      pasos.push({
        paso: `CB-1 · contexto ajeno "${p.termino}"`,
        operacion: `${p.puntos}`,
        detalle: `${p.tipo} (origen: ${p.origen})`
      });
    });

    pasos.push({
      paso: `CB-1 · ajuste de contexto (${contextBoost.veredicto})`,
      operacion: `${contextBoost.ajuste >= 0 ? "+" : ""}${contextBoost.ajuste}`,
      detalle: contextBoost.motivo
    });
  }

  if (vetoPorContexto) {
    pasos.push({
      paso: "VETO POR CONTEXTO INCOMPATIBLE",
      operacion: "→ máx 29",
      detalle:
        "El contexto no es compatible con el del objetivo: la coincidencia de nombre no sostiene la identidad, por perfecta que sea. Se degrada, no se elimina: el hallazgo sigue siendo auditable."
    });
  }

  pasos.push({
    paso: "PUNTUACIÓN FINAL",
    operacion: `${puntuacionFinal}/100`,
    detalle: nivel.etiqueta
  });

  /*
    ---------------------------------------------------------
    RESUMEN EN UNA FRASE
    ---------------------------------------------------------
  */
  const resumen = aportes.length
    ? `${puntuacionFinal}/100 — ${nivel.etiqueta}. ` +
      `Sostenida por ${aportes.length} señal(es): ${aportes
        .map((a) => `${a.nombre} (+${a.puntos})`)
        .join(", ")}.` +
      (penalizaciones.length
        ? ` Penalizada por: ${penalizaciones
            .map((p) => `${p.nombre} (${p.puntos})`)
            .join(", ")}.`
        : "") +
      (seAplicoTope
        ? ` Recortada de ${bruto} a ${puntuacionFinal} por el tope de concurrencia.`
        : "")
    : `${puntuacionFinal}/100 — ${nivel.etiqueta}. Ninguna señal se activó.`;

  return {
    resumen:
      resumen +
      (contextBoost && contextBoost.ajuste !== 0
        ? ` Contexto (CB-1): ${contextBoost.ajuste >= 0 ? "+" : ""}${
            contextBoost.ajuste
          } — ${contextBoost.veredicto}.`
        : "") +
      (vetoPorContexto
        ? " VETADA por contexto incompatible: probablemente otra persona con el mismo nombre."
        : ""),

    contextBoost: contextBoost
      ? {
          version: contextBoost.version,
          ajuste: contextBoost.ajuste,
          veredicto: contextBoost.veredicto,
          motivo: contextBoost.motivo,
          bonificaciones: contextBoost.bonificaciones,
          penalizaciones: contextBoost.penalizaciones,
          dominiosAjenos: contextBoost.dominiosAjenos,
          vetoAplicado: vetoPorContexto,
          puntuacionAntesDeContexto: trasTope
        }
      : null,

    nivel: nivel.id,
    etiquetaNivel: nivel.etiqueta,

    aportes,
    penalizaciones,

    calculo: {
      bruto,
      senalesActivas,
      topeAplicado,
      seAplicoTope,
      puntuacionFinal,
      tablaDeTopes: TOPE_POR_CONCURRENCIA
    },

    pasos,

    noMedido: {
      senalesSinImplementar: sinImplementar,
      senalesSinDatos: sinDatos,
      /*
        Cuánto peso teórico queda sin medir. Es la medida
        honesta de la incertidumbre.
      */
      pesoNoDisponible: SENALES.filter((s) => !s.implementada).length,
      advertencia:
        sinImplementar.length > 0
          ? `${sinImplementar.length} de las 7 señales no están implementadas todavía (${sinImplementar
              .map((s) => s.senal)
              .join(", ")}): requieren leer el perfil en la plataforma. La puntuación se construye solo con las señales disponibles.`
          : null
    },

    /*
      TOPE HUMANO — recordatorio en la propia explicación.
    */
    limiteDelSistema:
      "El sistema no confirma identidades. Su techo es «Muy Alta Correspondencia» y el estado «probable». Solo un analista puede confirmar o descartar (IA2)."
  };
}
