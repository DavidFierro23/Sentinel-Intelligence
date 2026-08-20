// apps/backend/services/knowledgeLake/lakeQuery.js

import { crearAdaptador } from "./lakeAdapter.js";
import { crearIndice } from "./lakeIndexer.js";
import { crearEscritor } from "./lakeWriter.js";
import { crearLector } from "./lakeReader.js";

/*
===========================================================
KNOWLEDGE LAKE — API INTERNA
===========================================================

Punto de entrada único del Lake. Monta adaptador, índice,
escritor y lector, y expone las cuatro consultas de la Fase 5:

    obtenerHistorialEntidad()
    obtenerEventosProyecto()
    obtenerVersionEntidad()
    obtenerNarrativasProyecto()

REGLA DE RESPUESTA: toda consulta declara su COBERTURA —
cuántos registros la sustentan, qué quedó fuera y qué no se
puede saber. Una respuesta sin cobertura declarada invita a
confundir «no hay datos» con «no ocurrió».
===========================================================
*/


let instancia = null;


export async function abrirLake(opciones = {}) {
  if (instancia && !opciones.forzarNueva) return instancia;

  const adaptador = crearAdaptador(opciones.adaptador, opciones);

  const indice = crearIndice();

  const reconstruccion = adaptador.leerTodos
    ? await indice.reconstruir(adaptador)
    : { reconstruido: false };

  const escritor = crearEscritor(adaptador, indice);

  const lector = crearLector(indice);

  instancia = {
    adaptador,
    indice,
    escritor,
    lector,
    reconstruccion,
    abiertoEn: new Date().toISOString()
  };

  return instancia;
}


export function cerrarLake() {
  instancia = null;
}


/*
-----------------------------------------------------------
COBERTURA — se adjunta a cada respuesta
-----------------------------------------------------------
*/

function construirCobertura(lake, registros, filtros = {}, notas = []) {
  const totalLake = lake.indice.todos().length;

  const sinFechaHecho = registros.filter((r) => !r.fechaHecho).length;

  const sinLinaje = registros.filter((r) => !r.linaje?.submotor).length;

  const fuentes = [...new Set(registros.map((r) => r.fuente).filter(Boolean))];

  const motores = [
    ...new Set(registros.map((r) => r.motorOrigen).filter(Boolean))
  ];

  return {
    registrosDevueltos: registros.length,
    registrosEnLake: totalLake,
    filtrosAplicados: Object.keys(filtros).filter(
      (k) => filtros[k] !== undefined && filtros[k] !== null
    ),
    fuentes,
    motores,
    loQueNoSabemos: [
      ...(sinFechaHecho
        ? [
            `${sinFechaHecho} registro(s) sin fecha de hecho: su posición temporal se apoya en la fecha de detección.`
          ]
        : []),
      ...(sinLinaje
        ? [`${sinLinaje} registro(s) sin linaje declarado.`]
        : []),
      ...(totalLake === 0
        ? [
            "El Lake está vacío: la ausencia de resultados no indica ausencia de hechos."
          ]
        : []),
      ...notas
    ]
  };
}


/*
===========================================================
1 · HISTORIAL DE UNA ENTIDAD
===========================================================

Todas las versiones de una entidad, con lo que cambió en cada
una y la verificación de la cadena.
===========================================================
*/

export async function obtenerHistorialEntidad(entidad, opciones = {}) {
  const lake = await abrirLake(opciones);

  const filtros = {
    tenantId: opciones.tenantId,
    proyectoId: opciones.proyectoId,
    tipoEntidad: opciones.tipoEntidad
  };

  /*
    Si llega la clave interna, se usa directamente. Si llega
    un nombre, se resuelve y se declara la ambigüedad en lugar
    de elegir por el llamador.
  */
  let clave = opciones.claveEntidad || null;

  let resolucion = null;

  if (!clave) {
    resolucion = lake.lector.resolverEntidad(entidad, filtros);

    if (!resolucion.coincidencias.length) {
      return {
        consulta: "obtenerHistorialEntidad",
        entidad,
        encontrada: false,
        resolucion,
        cobertura: construirCobertura(lake, [], filtros, [
          `Sin registros para la entidad "${entidad}".`
        ])
      };
    }

    if (resolucion.coincidencias.length > 1) {
      return {
        consulta: "obtenerHistorialEntidad",
        entidad,
        encontrada: false,
        ambigua: true,
        resolucion,
        nota:
          "Varias entidades coinciden. Especifique `claveEntidad` para desambiguar; el Lake no elige por usted.",
        cobertura: construirCobertura(lake, [], filtros)
      };
    }

    clave = resolucion.coincidencias[0].claveEntidad;
  }

  const versiones = await lake.lector.versiones(clave);

  const historial = await lake.lector.historial(clave);

  const timeline = await lake.lector.timeline(clave);

  const auditoria = await lake.lector.auditoria(clave);

  return {
    consulta: "obtenerHistorialEntidad",
    entidad,
    claveEntidad: clave,
    encontrada: versiones.length > 0,

    vigente: historial.vigente,
    totalVersiones: historial.total,
    primeraDeteccion: historial.primeraDeteccion,
    ultimaDeteccion: historial.ultimaDeteccion,

    versiones: historial.versiones,
    timeline,
    cadena: historial.cadena,
    auditoria,

    cobertura: construirCobertura(lake, versiones, filtros)
  };
}


/*
===========================================================
2 · EVENTOS DE UN PROYECTO
===========================================================

Todo lo registrado en un proyecto, ordenado en el tiempo. Es
la base del Timeline Universal.
===========================================================
*/

export async function obtenerEventosProyecto(proyectoId, opciones = {}) {
  const lake = await abrirLake(opciones);

  const filtros = {
    tenantId: opciones.tenantId,
    tipoEntidad: opciones.tipoEntidad,
    desde: opciones.desde,
    hasta: opciones.hasta,
    zona: opciones.zona,
    soloVigentes: opciones.soloVigentes
  };

  const base = lake.indice.buscar("proyecto", proyectoId);

  const registros = lake.lector.aplicarFiltros(base, filtros);

  const eventos = registros
    .map((r) => ({
      id: r.id,
      instante: r.fechaHecho || r.fechaDeteccion,
      instanteDeteccion: r.fechaDeteccion,
      fechaHechoDisponible: Boolean(r.fechaHecho),
      latenciaDeteccionMs: r.latenciaDeteccionMs,

      entidad: r.entidad,
      tipoEntidad: r.tipoEntidad,
      claveEntidad: r.claveEntidad,

      titulo: r.titulo,
      descripcion: r.descripcion,

      fuente: r.fuente,
      motorOrigen: r.motorOrigen,
      consulta: r.consulta,

      urlCanonica: r.urlCanonica,
      territorio: r.territorio,
      narrativa: r.narrativa,
      plataforma: r.plataforma,

      confianza: r.confianza,
      calidad: r.calidad,

      version: r.version,
      hash: r.hash
    }))
    .sort((a, b) =>
      String(a.instante || "").localeCompare(String(b.instante || ""))
    );

  /*
    Distribución por día: permite ver huecos de ingesta, que
    es lo que el Replay necesita declarar.
  */
  const porDia = new Map();

  registros.forEach((r) => {
    const dia = (r.fechaDeteccion || "").slice(0, 10);

    if (dia) porDia.set(dia, (porDia.get(dia) || 0) + 1);
  });

  const dias = [...porDia.entries()]
    .map(([dia, total]) => ({ dia, registros: total }))
    .sort((a, b) => a.dia.localeCompare(b.dia));

  const huecos = detectarHuecos(dias);

  return {
    consulta: "obtenerEventosProyecto",
    proyectoId,

    eventos,
    total: eventos.length,

    porTipoEntidad: agrupar(registros, (r) => r.tipoEntidad),
    porFuente: agrupar(registros, (r) => r.fuente),
    porDia: dias,

    /*
      Los huecos son parte de la respuesta, no una nota al pie.
    */
    huecosDeIngesta: huecos,

    cobertura: construirCobertura(
      lake,
      registros,
      filtros,
      huecos.length
        ? [
            `${huecos.length} hueco(s) de ingesta detectado(s): días sin ningún registro dentro del rango. La ausencia de eventos en esos días no es evidencia de calma.`
          ]
        : []
    )
  };
}


function agrupar(registros, extraer) {
  const mapa = new Map();

  registros.forEach((r) => {
    const clave = extraer(r);

    if (!clave) return;

    mapa.set(clave, (mapa.get(clave) || 0) + 1);
  });

  return [...mapa.entries()]
    .map(([clave, total]) => ({ clave, registros: total }))
    .sort((a, b) => b.registros - a.registros);
}


function detectarHuecos(dias) {
  if (dias.length < 2) return [];

  const huecos = [];

  for (let i = 1; i < dias.length; i += 1) {
    const previo = new Date(`${dias[i - 1].dia}T00:00:00Z`).getTime();

    const actual = new Date(`${dias[i].dia}T00:00:00Z`).getTime();

    const diferenciaDias = Math.round((actual - previo) / 86400000);

    if (diferenciaDias > 1) {
      huecos.push({
        desde: dias[i - 1].dia,
        hasta: dias[i].dia,
        diasSinRegistros: diferenciaDias - 1
      });
    }
  }

  return huecos;
}


/*
===========================================================
3 · VERSIÓN CONCRETA DE UNA ENTIDAD
===========================================================

Por número de versión o por instante. El segundo caso es la
reconstrucción histórica que necesita Replay Intelligence.
===========================================================
*/

export async function obtenerVersionEntidad(claveEntidad, opciones = {}) {
  const lake = await abrirLake(opciones);

  const versiones = await lake.lector.versiones(claveEntidad);

  if (!versiones.length) {
    return {
      consulta: "obtenerVersionEntidad",
      claveEntidad,
      encontrada: false,
      cobertura: construirCobertura(lake, [], {}, [
        `Sin versiones registradas para "${claveEntidad}".`
      ])
    };
  }

  /*
    a) POR INSTANTE — reconstrucción histórica.
  */
  if (opciones.instante) {
    const estado = await lake.lector.enInstante(claveEntidad, opciones.instante);

    return {
      consulta: "obtenerVersionEntidad",
      modo: "por_instante",
      claveEntidad,
      instante: opciones.instante,
      encontrada: Boolean(estado?.existia),
      ...estado,
      totalVersionesHoy: versiones.length,
      nota:
        estado?.existia && estado.versionesPosteriores > 0
          ? `Se muestra el estado tal como se conocía entonces. Hay ${estado.versionesPosteriores} versión(es) posterior(es) que en ese instante aún no existían.`
          : null,
      cobertura: construirCobertura(lake, versiones)
    };
  }

  /*
    b) POR NÚMERO DE VERSIÓN.
  */
  if (opciones.version != null) {
    const registro = versiones.find((r) => r.version === Number(opciones.version));

    return {
      consulta: "obtenerVersionEntidad",
      modo: "por_numero",
      claveEntidad,
      version: Number(opciones.version),
      encontrada: Boolean(registro),
      registro: registro || null,
      versionesDisponibles: versiones.map((r) => r.version),
      cobertura: construirCobertura(lake, versiones)
    };
  }

  /*
    c) VIGENTE.
  */
  const vigente = await lake.lector.vigente(claveEntidad);

  return {
    consulta: "obtenerVersionEntidad",
    modo: "vigente",
    claveEntidad,
    encontrada: true,
    version: vigente.version,
    registro: vigente,
    totalVersiones: versiones.length,
    cobertura: construirCobertura(lake, versiones)
  };
}


/*
===========================================================
4 · NARRATIVAS DE UN PROYECTO
===========================================================

Narrativas registradas en un proyecto, con su volumen,
ventana temporal, territorios y plataformas.

LÍMITE DECLARADO: el Lake no DETECTA narrativas — las
almacena y agrupa. La detección y el agrupamiento temático
son trabajo del futuro Media Intelligence. Si un registro
llega sin campo `narrativa`, aquí no aparece, y eso se dice.
===========================================================
*/

export async function obtenerNarrativasProyecto(proyectoId, opciones = {}) {
  const lake = await abrirLake(opciones);

  const filtros = {
    tenantId: opciones.tenantId,
    desde: opciones.desde,
    hasta: opciones.hasta
  };

  const registros = lake.lector.aplicarFiltros(
    lake.indice.buscar("proyecto", proyectoId),
    filtros
  );

  const conNarrativa = registros.filter((r) => r.narrativa);

  const sinNarrativa = registros.length - conNarrativa.length;

  /*
    Agrupación por narrativa.
  */
  const mapa = new Map();

  conNarrativa.forEach((r) => {
    const claves = Array.isArray(r.narrativa) ? r.narrativa : [r.narrativa];

    claves.forEach((n) => {
      const clave =
        typeof n === "string" ? n : n?.id || n?.nombre || n?.valor;

      if (!clave) return;

      if (!mapa.has(clave)) {
        mapa.set(clave, {
          narrativa: clave,
          registros: 0,
          territorios: new Set(),
          plataformas: new Set(),
          fuentes: new Set(),
          entidades: new Set(),
          primeraDeteccion: null,
          ultimaDeteccion: null
        });
      }

      const acc = mapa.get(clave);

      acc.registros += 1;

      [r.territorio].flat().filter(Boolean).forEach((t) =>
        acc.territorios.add(typeof t === "string" ? t : t?.nombre || t?.id)
      );

      [r.plataforma].flat().filter(Boolean).forEach((p) =>
        acc.plataformas.add(typeof p === "string" ? p : p?.nombre || p?.id)
      );

      if (r.fuente) acc.fuentes.add(r.fuente);

      const ent =
        typeof r.entidad === "string" ? r.entidad : r.entidad?.nombre || r.entidad?.id;

      if (ent) acc.entidades.add(ent);

      const f = r.fechaHecho || r.fechaDeteccion;

      if (f) {
        if (!acc.primeraDeteccion || f < acc.primeraDeteccion) {
          acc.primeraDeteccion = f;
        }

        if (!acc.ultimaDeteccion || f > acc.ultimaDeteccion) {
          acc.ultimaDeteccion = f;
        }
      }
    });
  });

  const narrativas = [...mapa.values()]
    .map((n) => ({
      narrativa: n.narrativa,
      registros: n.registros,
      territorios: [...n.territorios].filter(Boolean),
      plataformas: [...n.plataformas].filter(Boolean),
      fuentes: [...n.fuentes],
      entidades: [...n.entidades].filter(Boolean),
      primeraDeteccion: n.primeraDeteccion,
      ultimaDeteccion: n.ultimaDeteccion
    }))
    .sort((a, b) => b.registros - a.registros);

  return {
    consulta: "obtenerNarrativasProyecto",
    proyectoId,

    narrativas,
    total: narrativas.length,

    cobertura: construirCobertura(lake, registros, filtros, [
      ...(sinNarrativa
        ? [
            `${sinNarrativa} de ${registros.length} registro(s) no tienen narrativa asignada y no aparecen en este agrupamiento.`
          ]
        : []),
      "El Lake agrupa narrativas ya etiquetadas; no las detecta. La detección temática corresponde al futuro Media Intelligence."
    ])
  };
}


/*
===========================================================
ESCRITURA — expuesta aquí para que el Lake tenga un único
punto de entrada
===========================================================
*/

export async function escribirEnLake(entrada, opciones = {}) {
  const lake = await abrirLake(opciones);

  return lake.escritor.escribir(entrada, opciones);
}


export async function escribirLoteEnLake(entradas, opciones = {}) {
  const lake = await abrirLake(opciones);

  return lake.escritor.escribirLote(entradas, opciones);
}


/*
===========================================================
ESTADO DEL LAKE
===========================================================
*/

export async function estadoLake(opciones = {}) {
  const lake = await abrirLake(opciones);

  const integridad = lake.lector.verificarTodo();

  return {
    adaptador: await lake.adaptador.estado(),
    indice: lake.indice.estado(),
    integridad,
    reconstruccion: lake.reconstruccion,
    dimensiones: {
      entidad: lake.indice.clavesDeDimension("entidad").length,
      territorio: lake.indice.clavesDeDimension("territorio").length,
      narrativa: lake.indice.clavesDeDimension("narrativa").length,
      plataforma: lake.indice.clavesDeDimension("plataforma").length,
      fecha: lake.indice.clavesDeDimension("fecha").length,
      proyecto: lake.indice.clavesDeDimension("proyecto").length
    },
    appendOnly: true,
    abiertoEn: lake.abiertoEn
  };
}
