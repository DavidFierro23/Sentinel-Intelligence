// apps/backend/services/geo/spatialAggregator.js

import { unidadPorId, ancestrosDe, listarUnidades } from "./territoryRegistry.js";

import {
  comprobarGeo1,
  rangoDeResolucion,
  esMasFina,
  ESTADOS_UNIDAD,
  TRATAMIENTO_VISUAL,
  UMBRAL_MUESTRA_POR_DEFECTO,
  PROCEDENCIAS,
  GEO_1
} from "./geoContracts.js";

/*
===========================================================
SPATIAL AGGREGATOR — aqui vive GEO-1
===========================================================

Agrega evidencias ya resueltas por unidad territorial. Es el
unico modulo autorizado a decidir en que unidad cae un dato, y
tiene una sola prohibicion absoluta:

    NUNCA DESAGREGA.

Un dato que llego a nivel canton no se reparte entre las 36
parroquias, ni siquiera ponderado por poblacion, ni siquiera
"solo para visualizar". Ese reparto es exactamente lo que
produjo el 134 % y el 238 % del informe de Meta Ads del Azuay,
y es el motivo por el que GEO-1 esta congelada.

LO QUE SI HACE: SUBIR
-----------------------------------------------------------

Cuando la unidad del dato es MAS FINA que la resolucion
pedida, se sube por la cadena de ancestros. Subir es seguro:
si algo ocurrio en Yanuncay, ocurrio en Cuenca. Bajar no lo
es: que algo ocurriera en Cuenca no dice que ocurriera en
Yanuncay.

Toda subida queda registrada en `degradadas`, con su motivo.

EL CASO DEL CENTRO HISTORICO
-----------------------------------------------------------

Es un sector, no una parroquia, y solapa cinco parroquias —dos
de ellas parcialmente—. Su ficha declara
`reglaDeAgregacion: prohibida_por_composicion`.

La prohibicion no necesita un caso especial en este archivo:
componer el sector desde sus parroquias seria BAJAR de
parroquia a sector, y bajar no existe aqui. La regla se
cumple por construccion, no por una comprobacion que alguien
pueda olvidar. Aun asi se declara en la respuesta, porque
cumplir una regla en silencio no es auditarla.
===========================================================
*/


/*
-----------------------------------------------------------
SUBIR HASTA LA RESOLUCION PEDIDA

Devuelve la unidad en la que de verdad cae el dato, que no
siempre es la de la resolucion pedida: el Centro Historico no
tiene ancestro `parroquia`, asi que sube directo a canton.
-----------------------------------------------------------
*/

function subirHasta(unidad, resolucionObjetivo) {
  if (!unidad) return null;

  if (unidad.resolucion === resolucionObjetivo) {
    return { unidad, subida: false, saltos: 0 };
  }

  /* Mas gruesa que lo pedido: se queda donde esta. Nunca baja. */
  if (!esMasFina(unidad.resolucion, resolucionObjetivo)) {
    return { unidad, subida: false, saltos: 0 };
  }

  const cadena = ancestrosDe(unidad.id);

  const exacto = cadena.findIndex((a) => a.resolucion === resolucionObjetivo);

  if (exacto !== -1) {
    return { unidad: cadena[exacto], subida: true, saltos: exacto + 1 };
  }

  /*
    No hay ancestro en la resolucion pedida —el caso del sector
    patrimonial—. Se toma el primero MAS GRUESO que lo pedido:
    subir de mas es conservador, inventar un intermedio no.
  */
  const masGrueso = cadena.findIndex(
    (a) => !esMasFina(a.resolucion, resolucionObjetivo)
  );

  if (masGrueso !== -1) {
    return {
      unidad: cadena[masGrueso],
      subida: true,
      saltos: masGrueso + 1,
      sinAncestroExacto: true
    };
  }

  return { unidad, subida: false, saltos: 0, sinAncestroExacto: true };
}


/*
===========================================================
AGREGAR
===========================================================

Entrada: la salida de geoResolver.resolverLote().

`opciones`:
  resolucion       la que pide el analista
  umbralMuestra    minimo para pintar una unidad
  ambitoId         limita el universo de unidades listadas
  incluirVacias    lista tambien las unidades con cero
===========================================================
*/

export function agregar(resueltas, opciones = {}) {
  const resolucionPedida = opciones.resolucion || "parroquia";

  const umbral = Number.isFinite(opciones.umbralMuestra)
    ? opciones.umbralMuestra
    : UMBRAL_MUESTRA_POR_DEFECTO;

  const ubicadas = resueltas?.ubicadas || [];

  const sinUbicarN = resueltas?.sinUbicar?.length || 0;

  const total = resueltas?.total ?? ubicadas.length + sinUbicarN;

  const cubos = new Map();

  const degradadas = [];

  const bloqueosGeo1 = [];

  ubicadas.forEach(({ evidencia, ubicacion, indice }) => {
    /*
      -------------------------------------------------------
      1. GEO-1
      -------------------------------------------------------
    */
    const veredicto = comprobarGeo1(
      {
        procedencia: ubicacion.procedencia,
        resolucion: ubicacion.resolucion,
        unidadId: ubicacion.unidadId
      },
      resolucionPedida
    );

    if (!veredicto.permitido) {
      bloqueosGeo1.push({
        indice,
        unidadId: ubicacion.unidadId,
        procedencia: ubicacion.procedencia,
        resolucionDelDato: ubicacion.resolucion,
        resolucionPedida,
        resolucionEfectiva: veredicto.resolucionEfectiva,
        motivo: veredicto.motivo
      });
    }

    /*
      Cuando GEO-1 bloquea, el dato NO se descarta: se agrega en
      la unidad que si sostiene. Descartarlo perderia
      informacion real; repartirlo la inventaria.
    */
    const objetivo = veredicto.resolucionEfectiva || ubicacion.resolucion;

    if (!objetivo) return;

    /*
      -------------------------------------------------------
      2. SUBIR SI HACE FALTA
      -------------------------------------------------------
    */
    const origen = unidadPorId(ubicacion.unidadId);

    const destino = subirHasta(origen, objetivo);

    if (!destino?.unidad) return;

    if (destino.subida) {
      degradadas.push({
        indice,
        de: origen?.nombre || ubicacion.unidadId,
        deResolucion: origen?.resolucion || null,
        a: destino.unidad.nombre,
        aResolucion: destino.unidad.resolucion,
        motivo: destino.sinAncestroExacto
          ? `"${origen?.nombre}" no tiene ancestro de resolucion "${objetivo}". Se agrega en "${destino.unidad.resolucion}", que es la unidad mas fina que lo contiene.`
          : `Agregado hacia arriba hasta "${objetivo}", que es la resolucion pedida.`
      });
    }

    /*
      -------------------------------------------------------
      3. ACUMULAR
      -------------------------------------------------------
    */
    const u = destino.unidad;

    if (!cubos.has(u.id)) {
      cubos.set(u.id, {
        unidadId: u.id,
        nombre: u.nombre,
        resolucion: u.resolucion,
        tipo: u.tipo || null,
        jerarquia: u.jerarquia,
        verificado: u.verificado === true,
        conteo: 0,
        procedencias: {
          declarada: 0,
          derivada: 0,
          agregada: 0
        },
        sumaConfianza: 0,
        evidencias: []
      });
    }

    const cubo = cubos.get(u.id);

    cubo.conteo += 1;

    if (cubo.procedencias[ubicacion.procedencia] !== undefined) {
      cubo.procedencias[ubicacion.procedencia] += 1;
    }

    cubo.sumaConfianza += Number(ubicacion.confianza) || 0;

    cubo.evidencias.push({
      indice,
      titulo: evidencia?.titulo || null,
      url: evidencia?.enlace || evidencia?.url || null,
      fecha: evidencia?.fecha || null,
      procedencia: ubicacion.procedencia,
      confianza: ubicacion.confianza
    });
  });

  /*
    ---------------------------------------------------------
    4. UMBRAL DE MUESTRA — §6.6 regla 3

    Bajo el minimo la unidad NO se pinta. Se marca
    `muestra_insuficiente`, que no es `sin_dato` ni es cero:
    son tres estados distintos y confundirlos es el mismo error
    que confundir `bloqueado` con `0 resultados`.
    ---------------------------------------------------------
  */
  const unidades = [...cubos.values()].map((c) => ({
    unidadId: c.unidadId,
    nombre: c.nombre,
    resolucion: c.resolucion,
    tipo: c.tipo,
    jerarquia: c.jerarquia,
    verificado: c.verificado,

    conteo: c.conteo,

    estado:
      c.conteo >= umbral
        ? ESTADOS_UNIDAD.CON_DATO
        : ESTADOS_UNIDAD.MUESTRA_INSUFICIENTE,

    sePinta: c.conteo >= umbral,

    tratamientoVisual:
      c.conteo >= umbral
        ? TRATAMIENTO_VISUAL.con_dato
        : TRATAMIENTO_VISUAL.muestra_insuficiente,

    procedencias: c.procedencias,

    /*
      La procedencia dominante decide la marca del ancla y, con
      ella, cuanta precision comunica la unidad.
    */
    procedenciaDominante:
      Object.entries(c.procedencias).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      PROCEDENCIAS.DESCONOCIDA,

    confianzaMedia:
      c.conteo > 0 ? Number((c.sumaConfianza / c.conteo).toFixed(1)) : null,

    evidencias: c.evidencias
  }));

  /*
    ---------------------------------------------------------
    5. UNIDADES SIN DATO

    Se listan aparte y con estado propio. "Casi cero" y "no
    sabemos" no pueden parecerse (§6.6 regla 2).
    ---------------------------------------------------------
  */
  const universo = opciones.incluirVacias
    ? listarUnidades({ resolucion: resolucionPedida }).filter((u) =>
        opciones.ambitoId
          ? u.id === opciones.ambitoId ||
            ancestrosDe(u.id).some((a) => a.id === opciones.ambitoId)
          : true
      )
    : [];

  const sinDato = universo
    .filter((u) => !cubos.has(u.id))
    .map((u) => ({
      unidadId: u.id,
      nombre: u.nombre,
      resolucion: u.resolucion,
      tipo: u.tipo || null,
      conteo: 0,
      estado: ESTADOS_UNIDAD.SIN_DATO,
      sePinta: false,
      tratamientoVisual: TRATAMIENTO_VISUAL.sin_dato,
      verificado: u.verificado === true
    }));

  unidades.sort((a, b) => b.conteo - a.conteo || a.nombre.localeCompare(b.nombre));

  /*
    ---------------------------------------------------------
    6. RESOLUCION EFECTIVA REAL

    No la pedida: la mas fina que de verdad se alcanzo. Es lo
    que la interfaz debe anunciar, y lo que impide que un zoom
    a parroquia sugiera un detalle que no existe.
    ---------------------------------------------------------
  */
  const resolucionEfectiva =
    unidades.length > 0
      ? unidades
          .map((u) => u.resolucion)
          .sort((a, b) => (rangoDeResolucion(b) || 0) - (rangoDeResolucion(a) || 0))[0]
      : null;

  const conDato = unidades.filter((u) => u.sePinta).length;

  const insuficientes = unidades.length - conDato;

  return {
    resolucionPedida,
    resolucionEfectiva,

    coincideConLoPedido: resolucionEfectiva === resolucionPedida,

    umbralMuestra: umbral,

    unidades,
    sinDato,

    metricas: {
      evidenciasTotales: total,
      evidenciasAgregadas: ubicadas.length,
      sinUbicar: sinUbicarN,
      porcentajeSinUbicar:
        total > 0 ? Number(((sinUbicarN / total) * 100).toFixed(1)) : 0,
      unidadesConDato: conDato,
      unidadesMuestraInsuficiente: insuficientes,
      unidadesSinDato: sinDato.length
    },

    /*
      -------------------------------------------------------
      AUDITORIA DE GEO-1

      Se declara siempre, tambien cuando no bloqueo nada. Una
      regla que solo aparece cuando falla no se puede
      comprobar que este activa.
      -------------------------------------------------------
    */
    geo1: {
      regla: GEO_1,
      aplicada: true,
      bloqueos: bloqueosGeo1.length,
      detalle: bloqueosGeo1,
      composicionDeSectores:
        "Prohibida por construccion: este agregador solo sube por la cadena de ancestros y no tiene ninguna ruta de codigo que reparta hacia abajo. El Centro Historico no se compone sumando parroquias (WR-D10, riesgo WR-4)."
    },

    degradadas,

    /*
      -------------------------------------------------------
      LO QUE NO SABEMOS — obligatorio (WR-D14)
      -------------------------------------------------------
    */
    loQueNoSabemos: construirLoQueNoSabemos({
      total,
      sinUbicarN,
      resolucionPedida,
      resolucionEfectiva,
      bloqueos: bloqueosGeo1.length,
      degradadas: degradadas.length,
      insuficientes,
      umbral
    })
  };
}


function construirLoQueNoSabemos({
  total,
  sinUbicarN,
  resolucionPedida,
  resolucionEfectiva,
  bloqueos,
  degradadas,
  insuficientes,
  umbral
}) {
  const lista = [];

  if (sinUbicarN > 0) {
    lista.push(
      `${sinUbicarN} de ${total} evidencias sin ubicacion (${(
        (sinUbicarN / total) *
        100
      ).toFixed(1)} %). No se pintan y no estan en ningun conteo territorial.`
    );
  }

  if (bloqueos > 0) {
    lista.push(
      `GEO-1 impidio ${bloqueos} atribucion(es) a resolucion "${resolucionPedida}" porque el dato no la sostiene. Esas evidencias se agregaron en su unidad real.`
    );
  }

  if (degradadas > 0) {
    lista.push(
      `${degradadas} evidencia(s) se agregaron en una unidad mas gruesa que la suya. Subir conserva la verdad; el detalle fino se pierde.`
    );
  }

  if (resolucionEfectiva && resolucionEfectiva !== resolucionPedida) {
    lista.push(
      `Se pidio resolucion "${resolucionPedida}" y la mas fina alcanzada es "${resolucionEfectiva}". La vista no debe sugerir mas detalle del disponible.`
    );
  }

  if (insuficientes > 0) {
    lista.push(
      `${insuficientes} unidad(es) por debajo del umbral de ${umbral} evidencias: se marcan «muestra insuficiente», no se pintan y no se rankean.`
    );
  }

  lista.push(
    "Sin geometria oficial no hay mapa: este agregado es tabular y por toponimo. Dato oficial pendiente de integracion."
  );

  return lista;
}


export default { agregar };
