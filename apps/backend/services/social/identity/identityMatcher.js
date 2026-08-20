// apps/backend/services/social/identity/identityMatcher.js

import { evaluarS1 } from "./signals/nameSignal.js";
import { evaluarS2 } from "./signals/handleSignal.js";
import { evaluarS6 } from "./signals/officialLinkSignal.js";
import { evaluarS7, agruparPorHandle } from "./signals/crossPresenceSignal.js";

import { construirExplicacion } from "./matchExplainer.js";

import {
  ESTADOS_CORRESPONDENCIA,
  esEstadoAutomatico,
  nivelDeCorrespondencia,
  topeDeConcurrencia,
  SENALES_IMPLEMENTADAS,
  validarCorrespondencia
} from "../socialContracts.js";

/*
===========================================================
IDENTITY MATCHER
===========================================================

Estima la CORRESPONDENCIA entre una cuenta candidata y el
objetivo. Produce un grado explicado, nunca una afirmación.

SEÑALES DEL SPRINT 3.1: S1, S2, S6, S7 — las calculables sin
leer el perfil en la plataforma. S3, S4 y S5 quedan
declaradas como no medidas.

CUATRO PRINCIPIOS INNEGOCIABLES (ARQ-SIL-001 §3.2):

  1. Ninguna señal aislada confirma identidad
     → tope por concurrencia.
  2. Las contraseñales restan
     → un modelo que solo suma confirma cualquier homónimo.
  3. TOPE HUMANO: el sistema llega como máximo a `probable`.
     `confirmado` y `descartado` solo los asigna un analista.
  4. Toda puntuación se devuelve desglosada.
===========================================================
*/


/*
-----------------------------------------------------------
ESTADO A PARTIR DE LA PUNTUACIÓN

Nunca devuelve `confirmado`. Es la implementación del tope
humano, y está verificada por el validador de contratos.
-----------------------------------------------------------
*/

function estadoDesdePuntuacion(puntuacion) {
  if (puntuacion >= 70) return ESTADOS_CORRESPONDENCIA.PROBABLE;

  if (puntuacion >= 50) return ESTADOS_CORRESPONDENCIA.CANDIDATO;

  return ESTADOS_CORRESPONDENCIA.DESCUBIERTO;
}


/*
-----------------------------------------------------------
EVALUAR UN CANDIDATO
-----------------------------------------------------------
*/

export function evaluarCandidato(candidato, perfil, contexto = {}) {
  /*
    Las cuatro señales implementadas.
  */
  const resultados = [
    evaluarS1(candidato, perfil),
    evaluarS2(candidato, perfil),
    evaluarS6(candidato, perfil),
    evaluarS7(candidato, perfil, contexto)
  ];

  const senales = resultados.filter((s) => !s.esContrasenal);

  const contrasenales = resultados.filter((s) => s.esContrasenal);

  /*
    Señales ACTIVAS e independientes: la base del tope.
  */
  const senalesActivas = senales.filter((s) => s.activa && s.puntos > 0).length;

  const suma = senales
    .filter((s) => s.activa)
    .reduce((total, s) => total + s.puntos, 0);

  const resta = contrasenales.reduce((total, s) => total + s.puntos, 0);

  const bruto = Math.max(0, Math.min(100, suma + resta));

  /*
    TOPE POR CONCURRENCIA — principio 1.
  */
  const topeAplicado = topeDeConcurrencia(senalesActivas);

  const puntuacionFinal = Math.min(bruto, topeAplicado);

  const nivel = nivelDeCorrespondencia(puntuacionFinal);

  const estado = estadoDesdePuntuacion(puntuacionFinal);

  const explicacion = construirExplicacion({
    senales,
    contrasenales,
    bruto,
    topeAplicado,
    puntuacionFinal,
    senalesActivas
  });

  const correspondencia = {
    candidatoId: candidato.id,

    plataformaId: candidato.plataformaId,
    plataforma: candidato.plataforma,
    handle: candidato.handle,
    url: candidato.url,
    urlNormalizada: candidato.urlNormalizada,

    puntuacion: puntuacionFinal,
    nivel: nivel.id,
    etiqueta: nivel.etiqueta,

    /*
      TOPE HUMANO — nunca `confirmado`.
    */
    estado,
    requiereRevisionHumana: true,
    puedeConfirmarloElSistema: false,

    senales: senales.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      activa: s.activa,
      puntos: s.puntos,
      pesoMaximo: s.pesoMaximo,
      detalle: s.detalle,
      limitacion: s.limitacion || null,
      evidencias: s.evidencias || []
    })),

    contrasenales: contrasenales.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      puntos: s.puntos,
      detalle: s.detalle,
      evidencias: s.evidencias || []
    })),

    explicacion,

    senalesImplementadas: SENALES_IMPLEMENTADAS,

    evaluadoEn: new Date().toISOString()
  };

  /*
    El validador hace cumplir el tope humano y la
    obligatoriedad de la explicación.
  */
  const validacion = validarCorrespondencia(correspondencia);

  if (!validacion.valido) {
    console.error(
      "[identityMatcher] correspondencia inválida:",
      validacion.errores
    );
  }

  correspondencia.valida = validacion.valido;

  if (!validacion.valido) correspondencia.erroresValidacion = validacion.errores;

  return correspondencia;
}


/*
===========================================================
FUNCIÓN PRINCIPAL — evalúa el CONJUNTO

S7 (presencia cruzada) necesita todos los candidatos a la
vez, así que el conjunto se evalúa junto, no candidato a
candidato desde fuera.
===========================================================
*/

export function correlacionarCandidatos(candidatos = [], perfil = null) {
  const lista = Array.isArray(candidatos) ? candidatos : [];

  /*
    Primera pasada: agrupar por handle para habilitar S7.
  */
  const gruposPorHandle = agruparPorHandle(lista);

  const contexto = { gruposPorHandle };

  const correspondencias = lista
    .map((c) => evaluarCandidato(c, perfil, contexto))
    .sort((a, b) => b.puntuacion - a.puntuacion);

  /*
    Comprobación de invariante: ninguna correspondencia puede
    salir del matcher con un estado que exija a un humano.
  */
  const violaciones = correspondencias.filter(
    (c) => !esEstadoAutomatico(c.estado)
  );

  if (violaciones.length) {
    console.error(
      "[identityMatcher] VIOLACIÓN DEL TOPE HUMANO en",
      violaciones.length,
      "correspondencia(s)"
    );
  }

  const porNivel = correspondencias.reduce((acc, c) => {
    acc[c.nivel] = (acc[c.nivel] || 0) + 1;
    return acc;
  }, {});

  return {
    version: "1.0",

    objetivo: perfil?.nombrePrincipal || null,

    correspondencias,

    metricas: {
      evaluadas: correspondencias.length,
      porNivel,
      probables: correspondencias.filter(
        (c) => c.estado === ESTADOS_CORRESPONDENCIA.PROBABLE
      ).length,
      candidatas: correspondencias.filter(
        (c) => c.estado === ESTADOS_CORRESPONDENCIA.CANDIDATO
      ).length,
      conPresenciaCruzada: correspondencias.filter((c) =>
        c.senales.some((s) => s.id === "S7" && s.activa)
      ).length,
      puntuacionMaxima: correspondencias[0]?.puntuacion ?? 0,
      violacionesDelTopeHumano: violaciones.length
    },

    /*
      Declaración permanente del límite.
    */
    limiteDelSistema:
      "Ninguna de estas correspondencias es una identidad confirmada. El techo del sistema es «probable» / «Muy Alta Correspondencia». La confirmación es competencia del analista (IA2).",

    senalesNoMedidas: ["S3", "S4", "S5"],

    generadoEn: new Date().toISOString()
  };
}
