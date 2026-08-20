// apps/backend/services/social/identity/signals/crossPresenceSignal.js

import { normalizarTexto } from "../../../textUtils.js";
import { senalPorId } from "../../socialContracts.js";

/*
===========================================================
SEÑAL S7 — PRESENCIA CRUZADA
===========================================================

Comprueba si el MISMO handle aparece en varias plataformas
del conjunto de candidatos del objetivo.

Fundamento: una persona pública suele reservar el mismo
usuario en todas las redes. Encontrar @danielnoboaok en X,
Instagram y Facebook es mucho más informativo que
encontrarlo solo en una.

CARÁCTER ESPECIAL DE ESTA SEÑAL:

Es la única que NO se puede evaluar candidato a candidato de
forma aislada: necesita el conjunto completo. Por eso el
Identity Matcher la calcula en una segunda pasada, cuando ya
conoce todos los candidatos.

NO puede ser contraseñal: estar en una sola red es normal.

CAUTELA: handles muy genéricos (nombres comunes, palabras de
diccionario) coincidirían entre personas distintas. Se exige
longitud mínima y se penaliza la genericidad.
===========================================================
*/

const DEFINICION = senalPorId("S7");

const LONGITUD_MINIMA_FIABLE = 6;


function normalizarHandle(handle = "") {
  return normalizarTexto(handle).replace(/[^a-z0-9]/g, "");
}


/*
-----------------------------------------------------------
AGRUPAR CANDIDATOS POR HANDLE

Devuelve un mapa handle → plataformas en las que aparece.
-----------------------------------------------------------
*/

export function agruparPorHandle(candidatos = []) {
  const mapa = new Map();

  candidatos.forEach((c) => {
    const h = normalizarHandle(c.handle);

    if (!h) return;

    if (!mapa.has(h)) mapa.set(h, []);

    mapa.get(h).push({
      plataformaId: c.plataformaId,
      plataforma: c.plataforma,
      handle: c.handle,
      url: c.url,
      candidatoId: c.id
    });
  });

  return mapa;
}


export function evaluarS7(candidato, perfil, contexto = {}) {
  const base = {
    id: "S7",
    nombre: DEFINICION.nombre,
    esContrasenal: false,
    pesoMaximo: DEFINICION.pesoMaximo
  };

  const grupos = contexto.gruposPorHandle;

  if (!grupos) {
    return {
      ...base,
      activa: false,
      puntos: 0,
      detalle:
        "No se aportó el conjunto de candidatos: esta señal requiere evaluar todo el grupo.",
      evidencias: []
    };
  }

  const h = normalizarHandle(candidato.handle);

  const grupo = grupos.get(h) || [];

  /*
    Plataformas DISTINTAS en las que aparece este handle.
  */
  const plataformas = [...new Set(grupo.map((g) => g.plataformaId))];

  if (plataformas.length < 2) {
    return {
      ...base,
      activa: false,
      puntos: 0,
      detalle: `El handle "@${candidato.handle}" solo aparece en ${candidato.plataforma}. Estar en una única red es habitual: no es indicio en contra.`,
      evidencias: []
    };
  }

  /*
    Handle demasiado corto o genérico: la coincidencia entre
    plataformas podría ser casual.
  */
  if (h.length < LONGITUD_MINIMA_FIABLE) {
    const puntos = Math.round(DEFINICION.pesoMaximo * 0.3);

    return {
      ...base,
      activa: true,
      puntos,
      detalle: `Presente en ${plataformas.length} plataformas, pero el handle "@${candidato.handle}" tiene solo ${h.length} caracteres: la coincidencia puede ser casual.`,
      cautela: "handle_corto",
      plataformas,
      evidencias: grupo
        .filter((g) => g.candidatoId !== candidato.id)
        .map((g) => `${g.plataforma}: ${g.url}`)
        .slice(0, 4)
    };
  }

  /*
    Escala por número de plataformas: 2 redes ya es señal
    fuerte; 4 o más satura el peso máximo.
  */
  const proporcion = Math.min(1, (plataformas.length - 1) / 3);

  const puntos = Math.round(
    DEFINICION.pesoMaximo * (0.6 + 0.4 * proporcion)
  );

  const otras = grupo.filter((g) => g.candidatoId !== candidato.id);

  return {
    ...base,
    activa: true,
    puntos: Math.min(puntos, DEFINICION.pesoMaximo),
    detalle: `El mismo handle "@${candidato.handle}" aparece en ${plataformas.length} plataformas: ${plataformas.join(", ")}.`,
    plataformas,
    evidencias: otras.map((g) => `${g.plataforma}: ${g.url}`).slice(0, 4)
  };
}
