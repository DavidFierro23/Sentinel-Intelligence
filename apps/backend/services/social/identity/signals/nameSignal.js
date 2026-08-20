// apps/backend/services/social/identity/signals/nameSignal.js

import { normalizarTexto, tokenizar } from "../../../textUtils.js";
import { senalPorId } from "../../socialContracts.js";

/*
===========================================================
SEÑAL S1 — NOMBRE
===========================================================

Compara el nombre visible de la cuenta con las variantes de
nombre del Perfil de Referencia.

FUENTE DEL "NOMBRE VISIBLE" en el Sprint 3.1:

No hay Platform Scanner, así que no se lee el perfil. El
nombre visible se extrae del TÍTULO observado en el
descubrimiento, que es lo que el buscador devolvió — por
ejemplo «Daniel Noboa (@danielnoboaok) • Instagram».

Se declara así en la explicación: no se presenta como si
viniera del perfil.

PUEDE SER CONTRASEÑAL: un nombre claramente distinto resta.
===========================================================
*/

const DEFINICION = senalPorId("S1");

/*
  Ruido que los buscadores añaden al título y que no forma
  parte del nombre de la cuenta.
*/
const RUIDO_TITULO = [
  "facebook", "instagram", "tiktok", "youtube", "linkedin",
  "twitter", "x com", "perfil", "profile", "cuenta", "oficial",
  "official", "videos", "fotos", "photos", "posts", "inicio",
  "home", "canal", "channel", "watch", "reels", "shorts"
];


function limpiarTitulo(titulo = "") {
  let texto = normalizarTexto(titulo);

  /* Quita el handle entre paréntesis: "(@danielnoboaok)" */
  texto = texto.replace(/\(@[^)]+\)/g, " ");

  /* Corta en el primer separador típico de los títulos. */
  texto = texto.split(/[|•·\-–—:]/)[0];

  RUIDO_TITULO.forEach((r) => {
    texto = texto.replace(new RegExp(`\\b${r}\\b`, "g"), " ");
  });

  return texto.replace(/\s+/g, " ").trim();
}


export function evaluarS1(candidato, perfil) {
  const variantes = perfil?.variantes?.nombre || [];

  const palabrasObjetivo = new Set(
    tokenizar(perfil?.nombrePrincipal || "", 3)
  );

  const titulos = Array.isArray(candidato.titulosObservados)
    ? candidato.titulosObservados
    : [];

  if (!variantes.length) {
    return {
      id: "S1",
      nombre: DEFINICION.nombre,
      activa: false,
      esContrasenal: false,
      puntos: 0,
      pesoMaximo: DEFINICION.pesoMaximo,
      detalle: "El Perfil de Referencia no aportó variantes de nombre.",
      evidencias: []
    };
  }

  if (!titulos.length) {
    return {
      id: "S1",
      nombre: DEFINICION.nombre,
      activa: false,
      esContrasenal: false,
      puntos: 0,
      pesoMaximo: DEFINICION.pesoMaximo,
      detalle:
        "No se observó ningún título para esta cuenta: sin Platform Scanner no hay nombre visible que comparar.",
      evidencias: []
    };
  }

  let mejor = { puntos: 0, tipo: null, titulo: null, variante: null };

  titulos.forEach((titulo) => {
    const limpio = limpiarTitulo(titulo);

    if (!limpio) return;

    variantes.forEach((variante) => {
      const v = normalizarTexto(variante);

      if (!v) return;

      /* Coincidencia completa del nombre. */
      if (limpio === v) {
        if (mejor.puntos < DEFINICION.pesoMaximo) {
          mejor = {
            puntos: DEFINICION.pesoMaximo,
            tipo: "exacta",
            titulo,
            variante
          };
        }
        return;
      }

      /* El nombre está contenido en el título. */
      if (limpio.includes(v)) {
        const puntos = Math.round(DEFINICION.pesoMaximo * 0.8);

        if (mejor.puntos < puntos) {
          mejor = { puntos, tipo: "contenida", titulo, variante };
        }
        return;
      }

      /* Coincidencia parcial por palabras. */
      const palabrasTitulo = new Set(tokenizar(limpio, 3));

      const comunes = [...palabrasObjetivo].filter((p) =>
        palabrasTitulo.has(p)
      );

      if (comunes.length && palabrasObjetivo.size) {
        const proporcion = comunes.length / palabrasObjetivo.size;

        const puntos = Math.round(DEFINICION.pesoMaximo * 0.5 * proporcion);

        if (mejor.puntos < puntos) {
          mejor = {
            puntos,
            tipo: `parcial (${comunes.length}/${palabrasObjetivo.size} palabras)`,
            titulo,
            variante
          };
        }
      }
    });
  });

  /*
    CONTRASEÑAL: se observaron títulos, ninguno comparte una
    sola palabra del nombre. No es solo ausencia de señal: es
    señal en contra.
  */
  if (mejor.puntos === 0) {
    return {
      id: "S1",
      nombre: DEFINICION.nombre,
      activa: false,
      esContrasenal: true,
      puntos: -10,
      pesoMaximo: DEFINICION.pesoMaximo,
      detalle: `Ninguno de los ${titulos.length} título(s) observado(s) comparte palabra alguna con "${perfil.nombrePrincipal}".`,
      evidencias: titulos.slice(0, 3)
    };
  }

  return {
    id: "S1",
    nombre: DEFINICION.nombre,
    activa: true,
    esContrasenal: false,
    puntos: mejor.puntos,
    pesoMaximo: DEFINICION.pesoMaximo,
    detalle: `Coincidencia ${mejor.tipo} con la variante "${mejor.variante}" en el título observado.`,
    procedencia:
      "título devuelto por el buscador, no leído del perfil (sin Platform Scanner)",
    evidencias: [mejor.titulo]
  };
}
