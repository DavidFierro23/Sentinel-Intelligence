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
  { archivo: "ec-azuay-cuenca-sectores.json", obligatorio: false },

  /*
    GATE B. Barrios, sectores, vias e hitos que la prensa
    nombra. Ninguno tiene fuente oficial y ninguno atribuye:
    entran para que la MENCION sea visible y para que el dia
    que exista fuente baste con rellenar el fichero.
  */
  { archivo: "toponimos-cuenca.json", obligatorio: false }
]);

const FICHERO_DENOMINADORES = "ec-azuay-cuenca-denominadores.json";

const FICHERO_GEOMETRIA = "ec-azuay-cuenca-parroquias.geojson";

const FICHERO_FUENTES = "fuentes-oficiales.json";


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

  /*
    ---------------------------------------------------------
    GEOMETRIA OFICIAL

    Vive en su PROPIO fichero, no dentro del catalogo. Son dos
    cosas distintas y el proyecto lo pidio explicitamente:

      unidad territorial oficialmente reconocida
      geometria oficial disponible

    Una parroquia urbana de Cuenca es lo primero —la respalda
    la ordenanza municipal de 1982— sin ser lo segundo: la DPA
    nacional no publica su poligono. Meter la geometria dentro
    del catalogo obligaria a que ambas cosas viajaran juntas, y
    entonces «sin poligono» acabaria leyendose como «no existe».
    ---------------------------------------------------------
  */
  const lecturaGeo = leerJson(FICHERO_GEOMETRIA);

  const geometrias = new Map();

  let metadataGeo = null;

  if (lecturaGeo.ok) {
    metadataGeo = lecturaGeo.datos?.metadata || null;

    (lecturaGeo.datos?.features || []).forEach((f) => {
      const id = f?.properties?.unidadId;

      if (!id || !f.geometry) return;

      geometrias.set(id, {
        geometry: f.geometry,
        propiedades: f.properties
      });
    });
  } else {
    avisos.push(
      `${lecturaGeo.motivo}. El modulo funciona sin geometria: no habra mapa.`
    );
  }

  /* Registro de procedencia. Sin el, un dato no es auditable. */
  const lecturaFuentes = leerJson(FICHERO_FUENTES);

  const fuentes = lecturaFuentes.ok ? lecturaFuentes.datos?.fuentes || [] : [];

  if (!lecturaFuentes.ok) {
    avisos.push(
      `${lecturaFuentes.motivo}. Los datos oficiales quedan sin procedencia declarada.`
    );
  }

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

      const geo = geometrias.get(u.id) || null;

      if (!geo) sinGeometria += 1;

      unidades.push({
        ...u,

        jerarquia,

        catalogoId: catalogo.id,

        /*
          La geometria se ADJUNTA, no se declara en el catalogo.
          `verificado` sigue hablando de la unidad; `geometria`
          habla del poligono. Son independientes.
        */
        geometria: geo?.geometry || null,

        geometriaDisponible: Boolean(geo),

        codigoOficial: u.codigoOficial ?? geo?.propiedades?.codigoDPA ?? null,

        superficieKm2: geo?.propiedades?.superficieKm2 ?? null,

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

        /*
          GATE B. Hasta donde puede atribuir ESTA unidad, que no
          es lo mismo que hasta donde llega el dato (eso es
          GEO-1). Si el fichero lo declara null, la unidad no
          atribuye nada: solo registra la mencion.

          Se conserva `undefined` cuando el fichero no lo
          declara, para que las unidades administrativas sigan
          comportandose como siempre.
        */
        ...(Object.hasOwn(u, "resolucionMaximaAutorizada")
          ? { resolucionMaximaAutorizada: u.resolucionMaximaAutorizada }
          : {}),

        padreFuente: u.padreFuente || (u.padre ? "catalogo" : null)
      });
    });
  }

  /*
    ---------------------------------------------------------
    GEOMETRIA DERIVADA DEL CANTON

    CONALI publica parroquias y cabeceras, no el contorno del
    canton. Sin esto, el mapa se quedaba VACIO en la practica:
    GEO-1 mantiene casi toda la evidencia a nivel canton, y el
    canton no tenia poligono que pintar.

    Se compone como la union de sus hijas. Es legitimo y por la
    MISMA regla que rige las zonas analiticas: solo se deriva si
    TODAS las hijas tienen poligono. Las 21 parroquias rurales
    mas la cabecera cantonal teselan el canton exactamente, sin
    huecos ni solapes.

    Se marca `geometriaDerivada: true` y se conserva de que
    unidades salio. No es un poligono oficial del canton: es la
    suma declarada de poligonos oficiales, y la diferencia
    tiene que viajar con el dato.
    ---------------------------------------------------------
  */
  const derivadas = [];

  unidades.forEach((u) => {
    if (u.geometriaDisponible) return;

    if (!["canton", "provincia", "pais"].includes(u.resolucion)) return;

    const hijas = unidades.filter(
      (h) =>
        h.geometriaDisponible &&
        (h.padre === u.id || (h.jerarquia === "sectorial" && h.padre === u.id))
    );

    if (hijas.length === 0) return;

    /* Todas las hijas administrativas deben tener poligono. */
    const hijasAdministrativas = unidades.filter(
      (h) => h.padre === u.id && h.jerarquia === "administrativa"
    );

    const faltan = hijasAdministrativas.filter((h) => !h.geometriaDisponible);

    /*
      Las 15 urbanas no tienen poligono INDIVIDUAL, pero su area
      esta cubierta por la cabecera cantonal. Se comprueba que
      exista esa cobertura antes de derivar.
    */
    const cubiertasPorCabecera = faltan.every((h) =>
      unidades.some(
        (s) =>
          s.geometriaDisponible &&
          (s.solapa || []).some((x) => x.unidadId === h.id)
      )
    );

    if (!cubiertasPorCabecera) return;

    u.geometria = {
      type: "MultiPolygon",
      coordinates: hijas.map((h) =>
        h.geometria.type === "Polygon"
          ? h.geometria.coordinates
          : h.geometria.coordinates.flat()
      )
    };

    u.geometriaDisponible = true;

    u.geometriaDerivada = true;

    u.poligonosOrigen = hijas.map((h) => ({
      unidadId: h.id,
      nombre: h.nombre,
      codigoOficial: h.codigoOficial || null
    }));

    u.superficieKm2 = Number(
      hijas.reduce((s, h) => s + (h.superficieKm2 || 0), 0).toFixed(3)
    );

    delete u.motivoSinGeometria;

    sinGeometria -= 1;

    derivadas.push({
      unidadId: u.id,
      nombre: u.nombre,
      desde: hijas.length,
      nota: "Union declarada de poligonos oficiales, no un poligono oficial propio."
    });
  });

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

  /*
    Un denominador cuenta SOLO si esta verificado. Un valor sin
    verificar es una cifra sin respaldo, y para el caso vale lo
    mismo que no tenerla: no habilita ninguna metrica.

    Se cuentan ademas los NIVELES presentes: una poblacion de
    «parroquia» y otra de «bloque_urbano_agregado» no son
    comparables entre si, y esa incompatibilidad tiene que
    llegar hasta el normalizador.
  */
  const conteoDenominadores = {
    poblacionOficial: 0,
    padronElectoral: 0,
    superficieKm2: 0
  };

  const nivelesPorCampo = {
    poblacionOficial: new Set(),
    padronElectoral: new Set(),
    superficieKm2: new Set()
  };

  let restriccionUsoComercial = false;

  Object.values(denominadores).forEach((d) => {
    if (!d) return;

    ["poblacionOficial", "padronElectoral", "superficieKm2"].forEach((campo) => {
      const v = d[campo];

      if (!v || v.verificado !== true || typeof v.valor !== "number") return;

      conteoDenominadores[campo] += 1;

      if (v.nivel) nivelesPorCampo[campo].add(v.nivel);

      if (v.usoComercialPermitido === false) restriccionUsoComercial = true;
    });
  });

  /*
    -------------------------------------------------------
    CARENCIAS — el bloque que viaja hasta la interfaz
    -------------------------------------------------------
  */
  const carencias = [];

  const conGeometria = unidades.length - sinGeometria;

  if (sinGeometria > 0) {
    const urbanasSinGeo = unidades.filter(
      (u) => u.tipo === "urbana" && !u.geometriaDisponible
    ).length;

    carencias.push({
      id: "geometria",
      titulo:
        conGeometria > 0
          ? "Cobertura geometrica PARCIAL"
          : "Geometria oficial no integrada",
      detalle:
        conGeometria > 0
          ? `${conGeometria} unidades con geometria oficial y ${sinGeometria} sin ella, de las cuales ${urbanasSinGeo} son parroquias urbanas. El mapa se puede dibujar, pero NO esta completo.`
          : `${sinGeometria} de ${unidades.length} unidades sin poligono. No hay mapa.`,
      etiquetaUI: "Dato oficial pendiente de integracion",
      origen: "GAD Municipal de Cuenca (poligono urbano no publicado)",
      cobertura: { conGeometria, sinGeometria, urbanasSinGeometria: urbanasSinGeo },
      bloquea:
        conGeometria > 0
          ? ["mapa_completo", "coropleta_urbana", "superficie_urbana"]
          : ["mapa", "coropleta", "superficie_km2"],
      noBloquea: [
        "mapa_parcial",
        "resolucion_de_toponimos",
        "ranking",
        "series",
        "temas",
        "medios"
      ]
    });
  }

  if (conteoDenominadores.poblacionOficial === 0) {
    carencias.push({
      id: "poblacion",
      titulo: "Poblacion oficial no integrada",
      detalle:
        "Ninguna unidad tiene poblacion oficial verificada. No se calcula ninguna metrica per capita ni porcentaje poblacional.",
      etiquetaUI: "Dato oficial pendiente de integracion",
      origen: "INEC / GAD",
      bloquea: ["normalizacion_por_poblacion", "per_capita", "penetracion"],
      noBloquea: ["conteo_absoluto", "ranking_absoluto", "variacion_porcentual_propia"]
    });
  } else {
    /*
      Hay poblacion, pero NO para todas las unidades y no en un
      solo nivel. Declararlo como carencia distinta es lo que
      impide que «hay poblacion» se lea como «se puede
      normalizar todo».
    */
    const sinPoblacion = unidades.filter((u) => {
      const d = denominadores[u.id];

      return !(d?.poblacionOficial?.verificado === true);
    }).length;

    if (sinPoblacion > 0) {
      carencias.push({
        id: "poblacion_parcial",
        titulo: "Poblacion oficial PARCIAL",
        detalle: `${conteoDenominadores.poblacionOficial} unidades con poblacion oficial y ${sinPoblacion} sin ella. Las unidades sin denominador quedan FUERA de cualquier ranking normalizado, no al final de la lista.`,
        etiquetaUI: "Dato oficial pendiente de integracion",
        origen: "GAD Municipal de Cuenca (censo INEC 2022)",
        niveles: [...nivelesPorCampo.poblacionOficial],
        bloquea:
          nivelesPorCampo.poblacionOficial.size > 1
            ? ["normalizacion_por_poblacion_entre_niveles_distintos"]
            : [],
        noBloquea: ["normalizacion_dentro_del_mismo_nivel"]
      });
    }

    if (restriccionUsoComercial) {
      carencias.push({
        id: "licencia_poblacion",
        titulo: "Restriccion de licencia en el denominador poblacional",
        detalle:
          "La fuente poblacional integrada tiene licencia Creative Commons NonCommercial, que PROHIBE el uso comercial. Sentinel es un producto propietario con modelo SaaS. Antes de explotar comercialmente cualquier metrica derivada hace falta permiso del GAD o sustituir el denominador por la fuente primaria del INEC.",
        etiquetaUI: "Restriccion de licencia",
        origen: "GAD Municipal de Cuenca - CC NonCommercial",
        bloquea: ["uso_comercial_de_metricas_normalizadas"],
        noBloquea: ["uso_interno", "analisis", "conteo_absoluto"]
      });
    }
  }

  if (conteoDenominadores.padronElectoral === 0) {
    const cne = fuentes.find((f) => f.dominio === "padron_electoral");

    carencias.push({
      id: "padron",
      titulo: "Padron electoral CNE no integrado",
      detalle:
        cne?.motivoBloqueo ||
        "Ninguna unidad tiene padron oficial. No se calcula intensidad por elector.",
      etiquetaUI: "Dato oficial pendiente de integracion",
      origen: "CNE",
      estadoFuente: cne?.estado || "no_localizada",
      bloquea: ["normalizacion_por_padron"],
      noBloquea: ["conteo_absoluto"]
    });
  }

  if (sinVerificar > 0) {
    carencias.push({
      id: "verificacion",
      titulo: "Nomenclatura no contrastada con fuente oficial",
      detalle: `${sinVerificar} de ${unidades.length} unidades con verificado:false.`,
      etiquetaUI: "Dato oficial pendiente de integracion",
      origen: "GAD Municipal de Cuenca / CONALI",
      bloquea: ["presentar_como_oficial"],
      noBloquea: ["uso_operativo_interno"]
    });
  }

  cache = {
    cargado: errores.length === 0,

    catalogos,
    unidades,
    denominadores,

    /* Procedencia de cada dato oficial. Sin esto no es auditable. */
    fuentesOficiales: fuentes,

    geometria: {
      disponible: geometrias.size > 0,
      unidadesConGeometria: geometrias.size + derivadas.length,
      unidadesConPoligonoPropio: geometrias.size,
      derivadas,
      metadata: metadataGeo
    },

    metricas: {
      unidades: unidades.length,
      porResolucion: unidades.reduce((acc, u) => {
        acc[u.resolucion] = (acc[u.resolucion] || 0) + 1;
        return acc;
      }, {}),
      conGeometria,
      sinGeometria,
      geometriasDerivadas: derivadas.length,
      sinVerificar,
      denominadoresConValor: conteoDenominadores,
      nivelesDenominador: Object.fromEntries(
        Object.entries(nivelesPorCampo).map(([k, v]) => [k, [...v]])
      ),
      restriccionUsoComercial
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
