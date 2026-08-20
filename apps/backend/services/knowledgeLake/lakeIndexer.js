// apps/backend/services/knowledgeLake/lakeIndexer.js

/*
===========================================================
KNOWLEDGE LAKE — INDEXADOR
===========================================================

Índices en memoria sobre las SEIS dimensiones de consulta
(Fase 4):

    entidad · territorio · narrativa · plataforma
    fecha · proyecto

Más dos índices estructurales que el versionado necesita:

    porClaveEntidad   todas las versiones de una entidad
    porHash           acceso directo a un registro

DECISIÓN DE DISEÑO: los índices se DERIVAN del almacén, no se
almacenan. Al arrancar se reconstruyen leyendo el Lake
completo. Así no pueden desincronizarse: un índice persistido
que se corrompe produce respuestas incorrectas sin que nada
falle visiblemente, que es el peor modo de fallo posible.

Cuando el volumen lo exija, estos índices pasarán a
OpenSearch (Cap. 10, DT). La interfaz no cambiará.
===========================================================
*/


function normalizar(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}


/*
  Extrae las claves indexables de un valor que puede ser una
  cadena, un objeto con id/nombre, o una lista de ambos.
*/
function clavesDe(valor) {
  if (valor === null || valor === undefined) return [];

  if (Array.isArray(valor)) return valor.flatMap(clavesDe);

  if (typeof valor === "object") {
    return [valor.id, valor.clave, valor.nombre, valor.valor]
      .filter(Boolean)
      .map(normalizar);
  }

  const n = normalizar(valor);

  return n ? [n] : [];
}


export function crearIndice() {
  const porEntidad = new Map();
  const porTerritorio = new Map();
  const porNarrativa = new Map();
  const porPlataforma = new Map();
  const porFecha = new Map();
  const porProyecto = new Map();

  const porClaveEntidad = new Map();
  const porHash = new Map();

  const registros = [];

  function agregar(mapa, clave, registro) {
    if (!clave) return;

    if (!mapa.has(clave)) mapa.set(clave, []);

    mapa.get(clave).push(registro);
  }

  async function indexar(registro) {
    if (!registro) return;

    /* Idempotente: un mismo hash no se indexa dos veces. */
    if (registro.hash && porHash.has(registro.hash)) return;

    registros.push(registro);

    if (registro.hash) porHash.set(registro.hash, registro);

    /* --- 1. ENTIDAD --- */
    clavesDe(registro.entidad).forEach((c) =>
      agregar(porEntidad, c, registro)
    );

    /* --- 2. TERRITORIO --- */
    clavesDe(registro.territorio).forEach((c) =>
      agregar(porTerritorio, c, registro)
    );

    /* --- 3. NARRATIVA --- */
    clavesDe(registro.narrativa).forEach((c) =>
      agregar(porNarrativa, c, registro)
    );

    /* --- 4. PLATAFORMA --- */
    clavesDe(registro.plataforma).forEach((c) =>
      agregar(porPlataforma, c, registro)
    );

    /* --- 5. FECHA (por día de detección) --- */
    if (registro.particion) agregar(porFecha, registro.particion, registro);

    /* --- 6. PROYECTO --- */
    if (registro.proyectoId) {
      agregar(porProyecto, normalizar(registro.proyectoId), registro);
    }

    /* --- ESTRUCTURAL: versiones por entidad --- */
    if (registro.claveEntidad) {
      agregar(porClaveEntidad, registro.claveEntidad, registro);
    }
  }


  async function indexarLote(lista = []) {
    for (const r of lista) await indexar(r);

    return { indexados: lista.length, total: registros.length };
  }


  /*
    Reconstrucción completa desde el almacén. Es la operación
    de arranque.
  */
  async function reconstruir(adaptador) {
    porEntidad.clear();
    porTerritorio.clear();
    porNarrativa.clear();
    porPlataforma.clear();
    porFecha.clear();
    porProyecto.clear();
    porClaveEntidad.clear();
    porHash.clear();
    registros.length = 0;

    const todos = await adaptador.leerTodos();

    /*
      Orden estable por versión: el versionado depende de
      poder identificar la ÚLTIMA versión con certeza, y el
      orden de lectura del almacén no está garantizado.
    */
    todos.sort((a, b) => {
      if (a.claveEntidad === b.claveEntidad) {
        return (a.version || 0) - (b.version || 0);
      }

      return String(a.escritoEn || "").localeCompare(String(b.escritoEn || ""));
    });

    await indexarLote(todos);

    return {
      reconstruido: true,
      registros: registros.length,
      entidades: porClaveEntidad.size,
      proyectos: porProyecto.size
    };
  }


  /*
    ÚLTIMA VERSIÓN de una entidad. La usa el escritor para
    decidir el número de versión y el encadenado.
  */
  async function ultimaVersionDe(clave) {
    const versiones = porClaveEntidad.get(clave);

    if (!versiones || !versiones.length) return null;

    return versiones.reduce(
      (max, r) => ((r.version || 0) > (max.version || 0) ? r : max),
      versiones[0]
    );
  }


  async function versionesDe(clave) {
    return [...(porClaveEntidad.get(clave) || [])].sort(
      (a, b) => (a.version || 0) - (b.version || 0)
    );
  }


  function buscar(dimension, clave) {
    const mapas = {
      entidad: porEntidad,
      territorio: porTerritorio,
      narrativa: porNarrativa,
      plataforma: porPlataforma,
      fecha: porFecha,
      proyecto: porProyecto
    };

    const mapa = mapas[dimension];

    if (!mapa) return [];

    /* La fecha no se normaliza: es una partición literal. */
    const k = dimension === "fecha" ? clave : normalizar(clave);

    return [...(mapa.get(k) || [])];
  }


  function clavesDeDimension(dimension) {
    const mapas = {
      entidad: porEntidad,
      territorio: porTerritorio,
      narrativa: porNarrativa,
      plataforma: porPlataforma,
      fecha: porFecha,
      proyecto: porProyecto
    };

    const mapa = mapas[dimension];

    if (!mapa) return [];

    return [...mapa.entries()]
      .map(([clave, lista]) => ({ clave, registros: lista.length }))
      .sort((a, b) => b.registros - a.registros);
  }


  function todos() {
    return [...registros];
  }


  function porHashExacto(hash) {
    return porHash.get(hash) || null;
  }


  function estado() {
    return {
      registros: registros.length,
      indices: {
        entidad: porEntidad.size,
        territorio: porTerritorio.size,
        narrativa: porNarrativa.size,
        plataforma: porPlataforma.size,
        fecha: porFecha.size,
        proyecto: porProyecto.size
      },
      entidadesVersionadas: porClaveEntidad.size,
      derivados: true,
      nota:
        "Índices derivados del almacén, no persistidos: se reconstruyen al arrancar y no pueden desincronizarse."
    };
  }


  return {
    indexar,
    indexarLote,
    reconstruir,
    ultimaVersionDe,
    versionesDe,
    buscar,
    clavesDeDimension,
    porHashExacto,
    todos,
    estado
  };
}
