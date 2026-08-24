// apps/backend/services/geo/territoryRegistry.js

import { cargarTerritorios, invalidarCache } from "./territories/territoryLoader.js";
import { normalizarTexto } from "../textUtils.js";
import { RESOLUCIONES, rangoDeResolucion } from "./geoContracts.js";

/*
===========================================================
TERRITORY REGISTRY
===========================================================

Fuente unica de verdad sobre QUE unidades territoriales
existen, como se llaman, de quien cuelgan y con quien se
solapan.

JERARQUIAS ARBITRARIAS — WR-D19
-----------------------------------------------------------

Esta es la condicion de reutilizacion del motor, y no es una
floritura de diseno. UX-WR-001 §12.3 lo demuestra con dos
casos reales del propio proyecto:

  · el Centro Historico NO coincide con ningun limite
    parroquial: abarca tres parroquias enteras y bordes de
    otras dos

  · el paquete Agua necesitara CUENCAS HIDROGRAFICAS, que no
    coinciden con nada administrativo

Si el registro solo admitiera un arbol de parroquias, ninguno
de los dos cabria, y el motor geografico habria nacido atado a
elecciones (riesgo WR-10).

Asi que aqui una unidad pertenece a UNA jerarquia por su padre
y a CUALQUIER numero de ellas por sus solapamientos. Son dos
relaciones distintas y no se mezclan: `padre` es contencion
administrativa, `solapa` es interseccion geografica.

LO QUE ESTE REGISTRO NO HACE
-----------------------------------------------------------

No resuelve texto (eso es geoResolver), no agrega (eso es
spatialAggregator) y no inventa un denominador que no tiene:
si la poblacion es null, devuelve null y lo declara.
===========================================================
*/


let registro = null;


function construirIndices(datos) {
  const porId = new Map();

  /*
    Indice de toponimos: nombre normalizado -> [unidadId].
    Es una LISTA y no un valor unico porque dos jerarquias
    pueden aportar el mismo nombre, y porque la desambiguacion
    no es competencia del indice.
  */
  const porToponimo = new Map();

  const hijosDe = new Map();

  const solapadoPor = new Map();

  datos.unidades.forEach((u) => {
    porId.set(u.id, u);

    const nombres = [u.nombre, ...u.alias];

    nombres.forEach((n) => {
      const clave = normalizarTexto(n);

      if (!clave) return;

      if (!porToponimo.has(clave)) porToponimo.set(clave, []);

      const lista = porToponimo.get(clave);

      if (!lista.includes(u.id)) lista.push(u.id);
    });

    if (u.padre) {
      if (!hijosDe.has(u.padre)) hijosDe.set(u.padre, []);
      hijosDe.get(u.padre).push(u.id);
    }

    u.solapa.forEach((s) => {
      if (!s?.unidadId) return;

      if (!solapadoPor.has(s.unidadId)) solapadoPor.set(s.unidadId, []);

      solapadoPor.get(s.unidadId).push({
        unidadId: u.id,
        cobertura: s.cobertura || "desconocida"
      });
    });
  });

  return { porId, porToponimo, hijosDe, solapadoPor };
}


export function abrirRegistro({ forzar = false } = {}) {
  if (registro && !forzar) return registro;

  const datos = cargarTerritorios({ forzar });

  registro = { datos, indices: construirIndices(datos) };

  return registro;
}


export function recargarRegistro() {
  invalidarCache();

  registro = null;

  return abrirRegistro({ forzar: true });
}


/*
===========================================================
CONSULTAS
===========================================================
*/

export function unidadPorId(id) {
  if (!id) return null;

  return abrirRegistro().indices.porId.get(String(id)) || null;
}


export function listarUnidades(filtro = {}) {
  const { unidades } = abrirRegistro().datos;

  return unidades.filter((u) => {
    if (filtro.resolucion && u.resolucion !== filtro.resolucion) return false;
    if (filtro.jerarquia && u.jerarquia !== filtro.jerarquia) return false;
    if (filtro.tipo && u.tipo !== filtro.tipo) return false;
    if (filtro.padre && u.padre !== filtro.padre) return false;

    return true;
  });
}


/*
  Unidades candidatas para un toponimo. Devuelve TODAS las que
  comparten el nombre: la eleccion entre ellas la hace el
  resolver, que es quien tiene el contexto.
*/
export function buscarPorToponimo(texto) {
  const clave = normalizarTexto(texto);

  if (!clave) return [];

  const ids = abrirRegistro().indices.porToponimo.get(clave) || [];

  return ids.map((id) => unidadPorId(id)).filter(Boolean);
}


/*
  El indice completo, para que el resolver pueda recorrer un
  texto sin preguntar unidad por unidad. Se devuelve una copia
  de solo lectura del mapa de claves.
*/
export function indiceDeToponimos() {
  return abrirRegistro().indices.porToponimo;
}


export function hijosDe(id) {
  const ids = abrirRegistro().indices.hijosDe.get(String(id)) || [];

  return ids.map((h) => unidadPorId(h)).filter(Boolean);
}


export function ancestrosDe(id) {
  const cadena = [];

  let actual = unidadPorId(id);

  /*
    Guarda contra un ciclo en los datos. Un catalogo mal
    editado no debe colgar el proceso.
  */
  const vistos = new Set();

  while (actual?.padre && !vistos.has(actual.padre)) {
    vistos.add(actual.padre);

    const padre = unidadPorId(actual.padre);

    if (!padre) break;

    cadena.push(padre);

    actual = padre;
  }

  return cadena;
}


/*
  Interseccion geografica, NO contencion. Un sector especial
  solapa parroquias sin contenerlas ni pertenecerles.
*/
export function solapamientosDe(id) {
  const u = unidadPorId(id);

  if (!u) return { solapa: [], solapadoPor: [] };

  return {
    solapa: u.solapa.map((s) => ({
      unidad: unidadPorId(s.unidadId),
      cobertura: s.cobertura || "desconocida"
    })),

    solapadoPor: (abrirRegistro().indices.solapadoPor.get(String(id)) || []).map(
      (s) => ({
        unidad: unidadPorId(s.unidadId),
        cobertura: s.cobertura
      })
    )
  };
}


/*
  ¿La unidad `posible` esta dentro de `contenedor`, subiendo
  por la cadena de padres? Lo usa el resolver para puntuar el
  contexto: "El Batan" gana peso si el texto tambien dice
  "Cuenca".
*/
export function estaContenidaEn(posibleId, contenedorId) {
  if (!posibleId || !contenedorId) return false;

  if (posibleId === contenedorId) return true;

  return ancestrosDe(posibleId).some((a) => a.id === contenedorId);
}


/*
===========================================================
DENOMINADORES

Devuelve SIEMPRE la misma forma, tenga valor o no. Un null
silencioso obligaria a cada consumidor a inventarse el motivo.
===========================================================
*/

export function denominadorDe(unidadId, campo) {
  const { denominadores } = abrirRegistro().datos;

  const fila = denominadores[String(unidadId)] || null;

  const valor = fila && typeof fila[campo] === "number" ? fila[campo] : null;

  return {
    unidadId,
    campo,
    valor,
    disponible: valor !== null,
    verificado: fila?.verificado === true,
    fuente: fila?.fuente || null,
    motivo:
      valor === null
        ? "Dato oficial pendiente de integracion."
        : null
  };
}


/*
===========================================================
UNIDAD RAIZ DE UN AMBITO

El proyecto declara pais / provincia / canton como texto
libre. Esta funcion lo traduce a la unidad mas fina que el
registro reconoce, que es el ambito del analisis.

Devuelve null si no reconoce nada: preferible a suponer que
"Cuenca" es el canton Cuenca cuando el proyecto hablaba de
otra cosa.
===========================================================
*/

export function resolverAmbito({ pais, provincia, canton } = {}) {
  const intentos = [
    { texto: canton, resolucion: RESOLUCIONES.CANTON },
    { texto: provincia, resolucion: RESOLUCIONES.PROVINCIA },
    { texto: pais, resolucion: RESOLUCIONES.PAIS }
  ];

  for (const intento of intentos) {
    if (!intento.texto) continue;

    const candidatas = buscarPorToponimo(intento.texto).filter(
      (u) => u.resolucion === intento.resolucion
    );

    if (candidatas.length === 1) {
      return {
        unidad: candidatas[0],
        resolucion: intento.resolucion,
        reconocido: true,
        motivo: null
      };
    }

    if (candidatas.length > 1) {
      return {
        unidad: null,
        resolucion: intento.resolucion,
        reconocido: false,
        motivo: `"${intento.texto}" coincide con ${candidatas.length} unidades de resolucion ${intento.resolucion}. El ambito no se adivina.`
      };
    }
  }

  return {
    unidad: null,
    resolucion: null,
    reconocido: false,
    motivo:
      "El territorio declarado por el proyecto no corresponde a ninguna unidad del registro cargado. Hoy solo esta cargado el canton Cuenca."
  };
}


/*
===========================================================
ESTADO PUBLICO DEL REGISTRO
===========================================================
*/

export function estadoRegistro() {
  const { datos } = abrirRegistro();

  return {
    cargado: datos.cargado,

    catalogos: datos.catalogos,

    metricas: datos.metricas,

    resolucionMasFinaDisponible: [...new Set(datos.unidades.map((u) => u.resolucion))]
      .sort((a, b) => (rangoDeResolucion(b) || 0) - (rangoDeResolucion(a) || 0))[0] || null,

    /*
      Viaja hasta la interfaz. Ver territoryLoader: declarar lo
      que falta es parte del trabajo del cargador.
    */
    carencias: datos.carencias,

    errores: datos.errores,
    avisos: datos.avisos,

    cargadoEn: datos.cargadoEn
  };
}


export default {
  abrirRegistro,
  recargarRegistro,
  unidadPorId,
  listarUnidades,
  buscarPorToponimo,
  indiceDeToponimos,
  hijosDe,
  ancestrosDe,
  solapamientosDe,
  estaContenidaEn,
  denominadorDe,
  resolverAmbito,
  estadoRegistro
};
