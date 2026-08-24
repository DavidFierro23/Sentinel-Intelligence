// apps/backend/services/conversation/actorMentions.js

import { normalizarTexto, extraerDominio } from "../textUtils.js";
import { identificarFuente } from "./mediaRegistry.js";

/*
===========================================================
ACTOR MENTIONS — quien aparece, donde y cuanto
===========================================================

Cuenta menciones de los actores en seguimiento sobre un lote de
evidencias ya recolectadas. No busca nada: no gasta cuota.

LA REGLA QUE EVITA EL FALSO POSITIVO MAS CARO
-----------------------------------------------------------

Un APELLIDO SUELTO NO CUENTA como mencion.

En el ambito ecuatoriano los apellidos politicos se repiten
—Cordero, Palacios, Noboa, Cabrera, Vega— y en una nota
cualquiera pueden referirse a otra persona, a una calle, a una
parroquia o a un familiar. La parroquia "Octavio Cordero
Palacios" contiene dos apellidos politicos: contar "Cordero"
como mencion del actor Cordero convertiria cada nota sobre esa
parroquia en cobertura de un candidato.

Es el mismo fallo que AUD-001 documento con Pedro Palacios, y
que el contexto maestro cerro en la investigacion individual.
Aqui se cierra igual: se exige nombre + apellido.

CORROBORACION, NO SOLO CONTEO
-----------------------------------------------------------

Veinte menciones en un solo dominio no son lo mismo que veinte
en ocho dominios distintos. Lo primero puede ser un medio
repitiendo; lo segundo es cobertura. Se cuentan las dos cosas
por separado y nunca se presenta el total sin el numero de
dominios que lo sostiene.
===========================================================
*/


/*
-----------------------------------------------------------
VARIANTES DE UN NOMBRE

De "Pedro Xavier Palacios Ordonez" se generan:

    pedro xavier palacios ordonez   completo
    pedro palacios                  nombre + primer apellido
    pedro ordonez                   nombre + segundo apellido
    pedro xavier palacios           sin segundo apellido

NO se genera "palacios" ni "ordonez": ver la regla de arriba.
-----------------------------------------------------------
*/

export function variantesDeNombre(nombre, aliasExtra = []) {
  const limpio = normalizarTexto(nombre || "");

  if (!limpio) return [];

  const partes = limpio.split(" ").filter((p) => p.length >= 2);

  const variantes = new Set();

  if (partes.length >= 2) variantes.add(limpio);

  if (partes.length >= 3) {
    /* nombre + cada uno de los apellidos posibles */
    for (let i = 1; i < partes.length; i += 1) {
      variantes.add(`${partes[0]} ${partes[i]}`);
    }

    /* sin la ultima parte: "pedro xavier palacios" */
    variantes.add(partes.slice(0, -1).join(" "));
  }

  if (partes.length === 2) variantes.add(limpio);

  /*
    Alias que aporta el analista. Se aceptan tal cual, incluso
    de una sola palabra: si el analista declara que "Yaku" es
    este actor, eso es una decision suya y consta como tal.
  */
  aliasExtra.forEach((a) => {
    const n = normalizarTexto(a || "");

    if (n) variantes.add(n);
  });

  /*
    Un nombre de una sola palabra sin alias no produce ninguna
    variante utilizable: contarlo seria contar cualquier
    homonimo.
  */
  return [...variantes].filter((v) => v.split(" ").length >= 2 || aliasExtra.length > 0);
}


function prepararTexto(texto) {
  return ` ${normalizarTexto(texto || "")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}


/*
===========================================================
CONTAR MENCIONES
===========================================================

`actores`: [{ id, nombre, alias?, rol?, unidadId? }]
`evidencias`: lote ya recolectado
`ubicaciones`: opcional, alineado por indice con evidencias
               (salida de geoResolver). Permite decir DONDE se
               menciona a cada actor.
===========================================================
*/

export function contarMenciones(evidencias = [], actores = [], opciones = {}) {
  const lista = Array.isArray(evidencias) ? evidencias : [];

  const ubicaciones = opciones.ubicaciones || null;

  const preparados = actores
    .map((a) => ({
      ...a,
      variantes: variantesDeNombre(a.nombre, a.alias || [])
    }))
    .filter((a) => {
      if (a.variantes.length > 0) return true;

      return false;
    });

  const descartados = actores
    .filter((a) => variantesDeNombre(a.nombre, a.alias || []).length === 0)
    .map((a) => ({
      id: a.id,
      nombre: a.nombre,
      motivo:
        "Nombre de una sola palabra y sin alias declarado. Contarlo produciria una mencion por cada homonimo; se excluye en lugar de inflar la cifra."
    }));

  const acumulador = new Map(
    preparados.map((a) => [
      a.id,
      {
        id: a.id,
        nombre: a.nombre,
        rol: a.rol || null,
        variantesUsadas: a.variantes,
        menciones: 0,
        dominios: new Set(),
        unidades: new Map(),
        fechas: [],
        indices: [],
        titulares: []
      }
    ])
  );

  lista.forEach((e, indice) => {
    const texto = prepararTexto(
      [e?.titulo, e?.descripcion].filter(Boolean).join(" . ")
    );

    if (texto.trim().length === 0) return;

    preparados.forEach((a) => {
      const coincide = a.variantes.some((v) => texto.includes(` ${v} `));

      if (!coincide) return;

      const acc = acumulador.get(a.id);

      /*
        UNA mencion por evidencia, aunque el nombre aparezca
        cinco veces. Un titular no es cinco coberturas.
      */
      acc.menciones += 1;

      acc.indices.push(indice);

      const dominio = extraerDominio(e?.enlace || e?.url || "");

      if (dominio) acc.dominios.add(dominio);

      if (e?.fecha) acc.fechas.push(e.fecha);

      if (e?.titulo && acc.titulares.length < 5) acc.titulares.push(e.titulo);

      const u = ubicaciones?.[indice]?.unidadId || null;

      if (u) acc.unidades.set(u, (acc.unidades.get(u) || 0) + 1);
    });
  });

  const resultados = [...acumulador.values()]
    .map((a) => {
      const fechas = a.fechas.slice().sort();

      return {
        id: a.id,
        nombre: a.nombre,
        rol: a.rol,

        menciones: a.menciones,

        /*
          Nunca se entrega el total sin esto al lado.
        */
        dominiosDistintos: a.dominios.size,
        dominios: [...a.dominios],

        corroborado: a.dominios.size > 1,

        concentracion:
          a.dominios.size > 0
            ? Number((a.menciones / a.dominios.size).toFixed(2))
            : null,

        avisoConcentracion:
          a.dominios.size === 1 && a.menciones > 2
            ? `Las ${a.menciones} menciones provienen de un unico dominio. Es repeticion de una fuente, no cobertura amplia.`
            : null,

        porUnidad: [...a.unidades.entries()]
          .map(([unidadId, n]) => ({ unidadId, menciones: n }))
          .sort((x, y) => y.menciones - x.menciones),

        primeraFecha: fechas[0] || null,
        ultimaFecha: fechas[fechas.length - 1] || null,
        sinFecha: a.menciones - fechas.length,

        variantesUsadas: a.variantesUsadas,
        indices: a.indices,
        titulares: a.titulares
      };
    })
    .sort((a, b) => b.menciones - a.menciones);

  const totalMenciones = resultados.reduce((s, r) => s + r.menciones, 0);

  return {
    actores: resultados,
    descartados,

    metricas: {
      evidencias: lista.length,
      actoresEvaluados: preparados.length,
      actoresDescartados: descartados.length,
      actoresConAlgunaMencion: resultados.filter((r) => r.menciones > 0).length,
      totalMenciones
    },

    reglas: {
      apellidoSuelto:
        "No cuenta. Se exige nombre + apellido, o un alias declarado explicitamente por el analista.",
      unaPorEvidencia:
        "Una mencion por evidencia, aunque el nombre se repita dentro del texto.",
      corroboracion:
        "El total nunca se presenta sin el numero de dominios distintos que lo sostiene."
    },

    loQueNoSabemos: [
      descartados.length
        ? `${descartados.length} actor(es) excluidos por nombre no discriminante.`
        : null,

      "Una mencion no mide relevancia ni alcance: mide que un texto publicado nombro al actor.",

      "El reparto entre actores refleja lo que las fuentes consultadas publicaron, no la atencion del electorado."
    ].filter(Boolean)
  };
}


/*
===========================================================
QUE MEDIOS CUBREN A CADA ACTOR

Separado del conteo porque responde a otra pregunta: no
«cuanto se habla» sino «quien habla». La mezcla de ambas es lo
que produce rankings de influencia sin datos de audiencia.
===========================================================
*/

export function mediosPorActor(evidencias = [], resultadoMenciones) {
  return (resultadoMenciones?.actores || []).map((a) => {
    const fuentes = new Map();

    a.indices.forEach((i) => {
      const f = identificarFuente(evidencias[i]);

      if (!f.dominio) return;

      if (!fuentes.has(f.dominio)) {
        fuentes.set(f.dominio, {
          dominio: f.dominio,
          nombre: f.nombre,
          tipo: f.tipo,
          menciones: 0
        });
      }

      fuentes.get(f.dominio).menciones += 1;
    });

    const medios = [...fuentes.values()].sort(
      (x, y) => y.menciones - x.menciones
    );

    return {
      actorId: a.id,
      nombre: a.nombre,
      medios,
      locales: medios.filter((m) => m.tipo === "medio_local").length,
      nacionales: medios.filter((m) => m.tipo === "medio_nacional").length
    };
  });
}


export default { variantesDeNombre, contarMenciones, mediosPorActor };
