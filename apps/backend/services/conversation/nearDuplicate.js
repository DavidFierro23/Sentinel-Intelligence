// apps/backend/services/conversation/nearDuplicate.js

import { normalizarTexto } from "../textUtils.js";

/*
===========================================================
CASI-DUPLICADOS
===========================================================

El recolector deduplica por URL canonica o titulo EXACTO. Eso
deja pasar la forma mas comun de repeticion:

    «Clima hoy en Cuenca, Ecuador: el pronostico del tiempo
     para el 21 de agosto»
    «Clima hoy en Cuenca, Ecuador: el pronostico del tiempo
     para el 22 de agosto»
    «Clima hoy en Cuenca, Ecuador: el pronostico del tiempo
     para el 23 de agosto»

Tres URLs distintas, tres titulos distintos, un solo hecho
repetido. Medido: formaron un tema con tres evidencias.

Tambien pasa con la replica entre medios: la misma nota de
agencia publicada por cuatro cabeceras con el titular casi
igual. Ahi el hecho es uno y la cobertura es cuatro, y son dos
cifras distintas que hay que poder dar por separado.

QUE SE HACE Y QUE NO
-----------------------------------------------------------

NO se borra ninguna evidencia. Se AGRUPA y se marca cual es la
representante del grupo. El conteo de evidencias no cambia; lo
que cambia es que el extractor de temas puede pedir «una por
grupo» y dejar de contar tres veces el mismo boletin.

Metodo: similitud de Jaccard sobre los tokens del titular, tras
quitar numeros y fechas. Determinista y explicable, como todo
el resto del modulo.
===========================================================
*/


export const UMBRAL_SIMILITUD = 0.8;


/*
  Se quitan digitos y ordinales antes de comparar: la unica
  diferencia entre dos boletines diarios suele ser la fecha.
*/
function tokensDe(titulo) {
  const t = normalizarTexto(titulo || "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return new Set(t.split(" ").filter((x) => x.length >= 3));
}


export function similitud(a, b) {
  const A = tokensDe(a);

  const B = tokensDe(b);

  if (A.size === 0 || B.size === 0) return 0;

  let interseccion = 0;

  A.forEach((x) => {
    if (B.has(x)) interseccion += 1;
  });

  const union = A.size + B.size - interseccion;

  return union > 0 ? interseccion / union : 0;
}


/*
===========================================================
AGRUPAR

Agrupamiento voraz por primer representante que supere el
umbral. No es clustering optimo y no pretende serlo: con
titulares casi identicos el resultado es el mismo y el
comportamiento es reproducible, que es lo que exige el Replay.
===========================================================
*/

export function agruparCasiDuplicados(evidencias = [], opciones = {}) {
  const umbral = Number.isFinite(opciones.umbral)
    ? opciones.umbral
    : UMBRAL_SIMILITUD;

  const lista = Array.isArray(evidencias) ? evidencias : [];

  const grupos = [];

  const grupoDe = new Map();

  lista.forEach((e, indice) => {
    const titulo = e?.titulo || "";

    if (!titulo.trim()) {
      grupos.push({ representante: indice, miembros: [indice], similitudes: [] });

      grupoDe.set(indice, grupos.length - 1);

      return;
    }

    const encontrado = grupos.find((g) => {
      const s = similitud(lista[g.representante]?.titulo, titulo);

      return s >= umbral;
    });

    if (encontrado) {
      encontrado.miembros.push(indice);

      encontrado.similitudes.push(
        Number(similitud(lista[encontrado.representante]?.titulo, titulo).toFixed(3))
      );

      grupoDe.set(indice, grupos.indexOf(encontrado));

      return;
    }

    grupos.push({ representante: indice, miembros: [indice], similitudes: [] });

    grupoDe.set(indice, grupos.length - 1);
  });

  const conRepeticion = grupos.filter((g) => g.miembros.length > 1);

  return {
    grupos,
    grupoDe,

    /* Un indice por grupo: lo que consume el extractor de temas. */
    representantes: grupos.map((g) => g.representante),

    metricas: {
      evidencias: lista.length,
      gruposUnicos: grupos.length,
      gruposConRepeticion: conRepeticion.length,
      evidenciasRepetidas: conRepeticion.reduce(
        (s, g) => s + g.miembros.length - 1,
        0
      ),
      umbral
    },

    detalle: conRepeticion.map((g) => ({
      representante: lista[g.representante]?.titulo || null,
      repeticiones: g.miembros.length,
      similitudes: g.similitudes,
      titulos: g.miembros.map((i) => lista[i]?.titulo || null)
    })),

    declaracion:
      conRepeticion.length > 0
        ? `${conRepeticion.length} grupo(s) de casi-duplicados detectados: ${conRepeticion.reduce(
            (s, g) => s + g.miembros.length - 1,
            0
          )} evidencias son repeticion de otra. Ninguna se borra; para formar temas se usa una por grupo.`
        : "No se detectaron casi-duplicados."
  };
}


export default { agruparCasiDuplicados, similitud, UMBRAL_SIMILITUD };
