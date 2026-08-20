// apps/backend/services/social/identity/signals/handleSignal.js

import { normalizarTexto } from "../../../textUtils.js";
import { senalPorId } from "../../socialContracts.js";

/*
===========================================================
SEÑAL S2 — USUARIO (HANDLE)
===========================================================

Compara el handle de la cuenta con las variantes de handle
derivadas del nombre del objetivo.

NO puede ser contraseñal: un handle sin relación con el
nombre es normalísimo (apodos, marcas personales). Su
ausencia no es indicio en contra — solo falta de sustento.
===========================================================
*/

const DEFINICION = senalPorId("S2");


/*
-----------------------------------------------------------
DISTANCIA DE LEVENSHTEIN

Necesaria para reconocer sufijos y variantes: "danielnoboaok"
frente a "danielnoboa" es un handle real con "ok" añadido, no
una cuenta distinta.
-----------------------------------------------------------
*/

function levenshtein(a, b) {
  if (a === b) return 0;

  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let previa = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i += 1) {
    const actual = [i];

    for (let j = 1; j <= b.length; j += 1) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;

      actual[j] = Math.min(
        previa[j] + 1,
        actual[j - 1] + 1,
        previa[j - 1] + costo
      );
    }

    previa = actual;
  }

  return previa[b.length];
}


function similitud(a, b) {
  const largo = Math.max(a.length, b.length);

  if (!largo) return 0;

  return 1 - levenshtein(a, b) / largo;
}


export function evaluarS2(candidato, perfil) {
  const variantes = perfil?.variantes?.handle || [];

  const handle = normalizarTexto(candidato.handle || "").replace(
    /[^a-z0-9]/g,
    ""
  );

  const base = {
    id: "S2",
    nombre: DEFINICION.nombre,
    esContrasenal: false,
    pesoMaximo: DEFINICION.pesoMaximo
  };

  if (!handle) {
    return {
      ...base,
      activa: false,
      puntos: 0,
      detalle: "La cuenta no expone un handle utilizable.",
      evidencias: []
    };
  }

  if (!variantes.length) {
    return {
      ...base,
      activa: false,
      puntos: 0,
      detalle: "El Perfil de Referencia no aportó variantes de handle.",
      evidencias: []
    };
  }

  let mejor = { puntos: 0, tipo: null, variante: null, similitud: 0 };

  variantes.forEach((variante) => {
    const v = normalizarTexto(variante).replace(/[^a-z0-9]/g, "");

    if (!v || v.length < 3) return;

    /* Coincidencia exacta. */
    if (handle === v) {
      if (mejor.puntos < DEFINICION.pesoMaximo) {
        mejor = {
          puntos: DEFINICION.pesoMaximo,
          tipo: "exacta",
          variante,
          similitud: 1
        };
      }
      return;
    }

    /*
      La variante es prefijo del handle: el patrón real de
      "nombreapellido" + sufijo (ok, oficial, ec, 593...).
    */
    if (handle.startsWith(v)) {
      const sufijo = handle.slice(v.length);

      const puntos =
        sufijo.length <= 4
          ? Math.round(DEFINICION.pesoMaximo * 0.88)
          : Math.round(DEFINICION.pesoMaximo * 0.6);

      if (mejor.puntos < puntos) {
        mejor = {
          puntos,
          tipo: `variante con sufijo "${sufijo}"`,
          variante,
          similitud: similitud(handle, v)
        };
      }
      return;
    }

    /* La variante está contenida en el handle. */
    if (handle.includes(v) && v.length >= 6) {
      const puntos = Math.round(DEFINICION.pesoMaximo * 0.7);

      if (mejor.puntos < puntos) {
        mejor = {
          puntos,
          tipo: "variante contenida en el handle",
          variante,
          similitud: similitud(handle, v)
        };
      }
      return;
    }

    /* Similitud por distancia de edición. */
    const s = similitud(handle, v);

    if (s >= 0.75) {
      const puntos = Math.round(DEFINICION.pesoMaximo * 0.6 * s);

      if (mejor.puntos < puntos) {
        mejor = {
          puntos,
          tipo: `similitud ${(s * 100).toFixed(0)} %`,
          variante,
          similitud: s
        };
      }
    }
  });

  if (mejor.puntos === 0) {
    return {
      ...base,
      activa: false,
      puntos: 0,
      detalle: `El handle "@${candidato.handle}" no se parece a ninguna variante del nombre. No es indicio en contra: un apodo o marca personal es habitual.`,
      evidencias: []
    };
  }

  return {
    ...base,
    activa: true,
    puntos: mejor.puntos,
    detalle: `Coincidencia ${mejor.tipo} entre "@${candidato.handle}" y la variante "${mejor.variante}".`,
    similitud: Number(mejor.similitud.toFixed(3)),
    evidencias: [`@${candidato.handle}`]
  };
}
