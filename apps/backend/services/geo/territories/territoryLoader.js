// apps/backend/services/geo/territories/territoryLoader.js

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/*
===========================================================
CARGA DE CATALOGOS TERRITORIALES
===========================================================

Lee los ficheros de territorio, los valida y DECLARA lo que
falta. Es lo unico que este modulo hace: no resuelve, no
agrega, no normaliza.

POR QUE DECLARAR LO QUE FALTA ES PARTE DEL TRABAJO
-----------------------------------------------------------

Hoy faltan tres cosas: la geometria, la poblacion y el padron.
Un cargador que simplemente devolviera las unidades dejaria
que cada consumidor descubriese la ausencia por su cuenta, y
el que no la descubriera produciria una respuesta que parece
completa.

Asi que la carga devuelve SIEMPRE un bloque `carencias`, y ese
bloque viaja hasta la interfaz.
===========================================================
*/

const RAIZ = dirname(fileURLToPath(import.meta.url));


const FICHEROS = Object.freeze([
  { archivo: "ec-azuay-cuenca.json", obligatorio: true },
  { archivo: "ec-azuay-cuenca-sectores.json", obligatorio: false }
]);

const FICHERO_DENOMINADORES = "ec-azuay-cuenca-denominadores.json";


function leerJson(nombre) {
  const ruta = join(RAIZ, nombre);

  if (!existsSync(ruta)) {
    return { ok: false, motivo: `no existe ${nombre}`, datos: null };
  }

  try {
    return { ok: true, motivo: null, datos: JSON.parse(readFileSync(ruta, "utf8")) };
  } catch (error) {
    return {
      ok: false,
      motivo: `${nombre} ilegible: ${error?.message || "JSON invalido"}`,
      datos: null
    };
  }
}


/*
-----------------------------------------------------------
VALIDACION DE UNA UNIDAD

Minima y estructural. No comprueba que el toponimo exista en
la realidad —eso es lo que significa `verificado:false`—, sino
que la unidad sea utilizable por el resto del motor.
-----------------------------------------------------------
*/

function validarUnidad(unidad, jerarquia) {
  const errores = [];

  if (!unidad?.id) errores.push("unidad sin id");
  if (!unidad?.nombre) errores.push(`unidad ${unidad?.id || "?"} sin nombre`);
  if (!unidad?.resolucion) {
    errores.push(`unidad ${unidad?.id || "?"} sin resolucion`);
  }

  return errores.map((e) => `[${jerarquia}] ${e}`);
}


/*
===========================================================
CARGA COMPLETA
===========================================================

Memorizada: los catalogos son ficheros estaticos y releerlos
en cada consulta no aporta nada. `forzar` existe para el
diagnostico y para las pruebas.
===========================================================
*/

let cache = null;


export function cargarTerritorios({ forzar = false } = {}) {
  if (cache && !forzar) return cache;

  const unidades = [];

  const errores = [];

  const avisos = [];

  const catalogos = [];

  let sinGeometria = 0;

  let sinVerificar = 0;

  for (const { archivo, obligatorio } of FICHEROS) {
    const lectura = leerJson(archivo);

    if (!lectura.ok) {
      const mensaje = `${lectura.motivo}`;

      if (obligatorio) errores.push(mensaje);
      else avisos.push(mensaje);

      continue;
    }

    const catalogo = lectura.datos;

    const jerarquia = catalogo.jerarquia || "sin-jerarquia";

    catalogos.push({
      id: catalogo.id,
      nombre: catalogo.nombre,
      version: catalogo.version,
      jerarquia,
      archivo,
      unidades: (catalogo.unidades || []).length,
      geometriaDisponible: catalogo.geometria?.disponible === true,
      fuenteOficial: catalogo.fuente?.oficial || null,
      verificado: catalogo.fuente?.verificado === true
    });

    (catalogo.unidades || []).forEach((u) => {
      const fallos = validarUnidad(u, jerarquia);

      if (fallos.length) {
        errores.push(...fallos);
        return;
      }

      if (u.verificado !== true) sinVerificar += 1;

      if (!u.geometria) sinGeometria += 1;

      unidades.push({
        ...u,

        jerarquia,

        catalogoId: catalogo.id,

        /*
          Se normaliza la forma para que el registro no tenga
          que preguntar si el campo existe.
        */
        alias: Array.isArray(u.alias) ? u.alias : [],

        ambiguo: u.ambiguo === true,

        /*
          DOS AMBIGUEDADES QUE NO SE RESUELVEN IGUAL

            externa  el toponimo choca con otro sitio FUERA del
                     ambito (Banos de Cuenca vs Banos de Agua
                     Santa). Saber que publica un medio local
                     de Cuenca lo resuelve.

            interna  el toponimo choca con algo DENTRO del
                     mismo ambito (la parroquia Sucre y la
                     avenida Sucre; El Valle parroquia y "el
                     valle" comun). Un medio local NO lo
                     resuelve: si acaso hace mas probable la
                     otra lectura.

            ambas    las dos a la vez. Se trata como interna,
                     que es lo estricto.

          Por defecto `externa`: es la ambiguedad habitual de un
          toponimo, y la unica que la cobertura de la fuente
          puede despejar.
        */
        ambiguedad: u.ambiguo === true ? u.ambiguedad || "externa" : null,
        requiereContexto: Array.isArray(u.requiereContexto)
          ? u.requiereContexto
          : [],

        /*
          Formas del nombre que NO necesitan contexto porque no
          las lleva ningun otro lugar.

          Sin esto, «Santa Ana de los Rios de Cuenca» —el nombre
          oficial completo del canton, inequivoco donde los
          haya— quedaba SIN UBICAR, porque la comprobacion
          buscaba «azuay» o «ecuador» dentro del alias y no
          estaban. El resultado era rechazar justo la forma mas
          precisa del nombre.
        */
        aliasInequivocos: Array.isArray(u.aliasInequivocos)
          ? u.aliasInequivocos.map((a) => String(a).toLowerCase())
          : [],
        solapa: Array.isArray(u.solapa) ? u.solapa : [],
        verificado: u.verificado === true,
        geometria: u.geometria || null
      });
    });
  }

  /*
    -------------------------------------------------------
    DENOMINADORES

    Su ausencia NO es un error: es el estado declarado del
    proyecto. Se carga lo que haya y se cuenta cuantos valores
    reales existen, que es lo que decide si la normalizacion
    esta disponible.
    -------------------------------------------------------
  */
  const lecturaDen = leerJson(FICHERO_DENOMINADORES);

  const denominadores = lecturaDen.ok
    ? lecturaDen.datos?.denominadores || {}
    : {};

  if (!lecturaDen.ok) {
    avisos.push(
      `${lecturaDen.motivo}. La normalizacion quedara declarada como no disponible.`
    );
  }

  const conteoDenominadores = { poblacion: 0, padronElectoral: 0, superficieKm2: 0 };

  Object.values(denominadores).forEach((d) => {
    if (!d) return;

    if (typeof d.poblacion === "number") conteoDenominadores.poblacion += 1;
    if (typeof d.padronElectoral === "number") {
      conteoDenominadores.padronElectoral += 1;
    }
    if (typeof d.superficieKm2 === "number") {
      conteoDenominadores.superficieKm2 += 1;
    }
  });

  /*
    -------------------------------------------------------
    CARENCIAS — el bloque que viaja hasta la interfaz
    -------------------------------------------------------
  */
  const carencias = [];

  if (sinGeometria > 0) {
    carencias.push({
      id: "geometria",
      titulo: "Geometria oficial no integrada",
      detalle: `${sinGeometria} de ${unidades.length} unidades sin poligono. No hay mapa; si hay analisis territorial por toponimo, evidencia, tema, fuente y tendencia.`,
      etiquetaUI: "Dato oficial pendiente de integracion",
      origen: "GAD Municipal de Cuenca / geoportal INEC",
      bloquea: ["mapa", "coropleta", "superficie_km2"],
      noBloquea: ["resolucion_de_toponimos", "ranking", "series", "temas", "medios"]
    });
  }

  if (conteoDenominadores.poblacion === 0) {
    carencias.push({
      id: "poblacion",
      titulo: "Poblacion INEC no integrada",
      detalle:
        "Ninguna unidad tiene poblacion oficial. No se calcula ninguna metrica per capita ni porcentaje poblacional.",
      etiquetaUI: "Dato oficial pendiente de integracion",
      origen: "INEC",
      bloquea: ["normalizacion_por_poblacion", "per_capita", "penetracion"],
      noBloquea: ["conteo_absoluto", "ranking_absoluto", "variacion_porcentual_propia"]
    });
  }

  if (conteoDenominadores.padronElectoral === 0) {
    carencias.push({
      id: "padron",
      titulo: "Padron electoral CNE no integrado",
      detalle:
        "Ninguna unidad tiene padron oficial. No se calcula intensidad por elector.",
      etiquetaUI: "Dato oficial pendiente de integracion",
      origen: "CNE",
      bloquea: ["normalizacion_por_padron"],
      noBloquea: ["conteo_absoluto"]
    });
  }

  if (sinVerificar > 0) {
    carencias.push({
      id: "verificacion",
      titulo: "Nomenclatura no contrastada con fuente oficial",
      detalle: `${sinVerificar} unidades con verificado:false. Los nombres provienen de UX-WR-001 §2.1 y no han sido contrastados contra el GAD ni el INEC.`,
      etiquetaUI: "Dato oficial pendiente de integracion",
      origen: "GAD Municipal de Cuenca / INEC",
      bloquea: ["presentar_como_oficial"],
      noBloquea: ["uso_operativo_interno"]
    });
  }

  cache = {
    cargado: errores.length === 0,

    catalogos,
    unidades,
    denominadores,

    metricas: {
      unidades: unidades.length,
      porResolucion: unidades.reduce((acc, u) => {
        acc[u.resolucion] = (acc[u.resolucion] || 0) + 1;
        return acc;
      }, {}),
      sinGeometria,
      sinVerificar,
      denominadoresConValor: conteoDenominadores
    },

    carencias,
    errores,
    avisos,

    cargadoEn: new Date().toISOString()
  };

  if (errores.length) {
    console.error("[geo] catalogos territoriales con errores:", errores);
  }

  return cache;
}


export function invalidarCache() {
  cache = null;
}


export default { cargarTerritorios, invalidarCache };
