// apps/backend/services/geo/analyticalZones.js

import { unidadPorId, listarUnidades } from "./territoryRegistry.js";
import { rangoDeResolucion } from "./geoContracts.js";

/*
===========================================================
ZONAS ANALITICAS — Norte, Sur, Centro, corredores
===========================================================

Una zona analitica es una agrupacion de unidades territoriales
que define EL ANALISTA para operar. No es una division
administrativa y este modulo no deja que se confunda con una.

POR QUE ESTE FICHERO NACE VACIO
-----------------------------------------------------------

Porque no existe ninguna division oficial de Cuenca en «Zona
Norte» y «Zona Sur». Es una convencion de campana, y cada
equipo traza la linea donde le conviene.

Inventar aqui que Ricaurte es Norte y Turi es Sur seria
exactamente el error que este modulo lleva cinco gates
evitando: fabricar una unidad territorial sin fuente y dejar
que el mapa la presente como un hecho.

Asi que el registro arranca sin ninguna zona. Lo que se entrega
es la CAPACIDAD de definirlas, con su procedencia, su autor y
su fecha.

TRES GARANTIAS
-----------------------------------------------------------

  1. `unidadOficial: false` SIEMPRE. Ninguna zona analitica
     puede presentarse como oficial, ni aunque agrupe unidades
     que si lo son.

  2. Composicion EXPLICITA. Una zona se define enumerando sus
     unidades hijas, una por una. No se deriva de un criterio
     automatico —«las que estan al norte del rio»— porque eso
     exigiria geometria y criterio, y ambos serian decisiones
     encubiertas.

  3. Geometria DERIVADA y declarada. Si todas sus hijas tienen
     poligono oficial, la zona puede dibujarse como su union, y
     entonces lleva `geometriaDerivada: true` con la lista de
     poligonos que la originaron. Si alguna hija no lo tiene,
     la zona NO tiene geometria: media zona pintada es peor que
     ninguna.
===========================================================
*/


export const TIPOS_ZONA = Object.freeze({
  DISTRITO_CAMPANA: "distrito_campana",
  ZONA_OPERATIVA: "zona_operativa",
  CORREDOR: "corredor",
  AGRUPACION: "agrupacion"
});


export const TIPOS_UNIDAD = Object.freeze({
  OFICIAL: "oficial",
  ANALITICA: "analitica",
  TOPONIMO_NO_CERTIFICADO: "toponimo_no_certificado"
});


/*
-----------------------------------------------------------
CONTRATO DE UNA ZONA
-----------------------------------------------------------
*/

export const CONTRATO_ZONA = Object.freeze({
  id: "identificador estable, generado desde el nombre",
  nombre: "como la llama el analista",
  tipo: "distrito_campana | zona_operativa | corredor | agrupacion",
  unidades: "array de unidadId, ENUMERADAS explicitamente",
  criterio: "por que estas unidades y no otras. Texto libre, obligatorio",
  creadaPor: "quien la definio",
  fecha: "cuando",
  fuente: "documento o decision que la respalda, si existe. Puede ser null",
  verificado: "true solo si existe un instrumento formal que la establezca",
  notas: "opcional",

  /* Derivados, no declarados por el analista */
  unidadOficial: "SIEMPRE false",
  tipoUnidad: "SIEMPRE analitica",
  geometriaDerivada: "true si TODAS sus hijas tienen poligono oficial",
  poligonosOrigen: "que unidades aportaron geometria"
});


/*
===========================================================
REGISTRO
===========================================================

En memoria. La persistencia de zonas pertenece al proyecto
—cada proyecto tendra las suyas— y ese almacen es el Knowledge
Lake, que ya existe. Este modulo no decide donde se guardan:
valida, compone y declara.
===========================================================
*/

function idDesde(nombre) {
  return String(nombre || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}


export function validarZona(definicion = {}) {
  const errores = [];

  const avisos = [];

  if (!definicion.nombre) errores.push("la zona necesita un nombre");

  if (!Object.values(TIPOS_ZONA).includes(definicion.tipo)) {
    errores.push(
      `tipo invalido: "${definicion.tipo}". Admitidos: ${Object.values(TIPOS_ZONA).join(", ")}`
    );
  }

  const unidades = Array.isArray(definicion.unidades) ? definicion.unidades : [];

  if (unidades.length === 0) {
    errores.push(
      "una zona se define ENUMERANDO sus unidades. No se deriva de un criterio automatico."
    );
  }

  if (!definicion.criterio) {
    errores.push(
      "falta `criterio`: por que estas unidades y no otras. Una zona sin criterio no se puede auditar."
    );
  }

  if (!definicion.creadaPor) {
    errores.push("falta `creadaPor`: una zona la define alguien, y consta quien.");
  }

  const desconocidas = unidades.filter((u) => !unidadPorId(u));

  if (desconocidas.length) {
    errores.push(
      `unidades inexistentes en el registro territorial: ${desconocidas.join(", ")}`
    );
  }

  const existentes = unidades.map((u) => unidadPorId(u)).filter(Boolean);

  /*
    Mezclar niveles no es un error, pero casi siempre lo es:
    agrupar una parroquia con el canton entero produce una zona
    que se solapa consigo misma.
  */
  const niveles = [...new Set(existentes.map((u) => u.resolucion))];

  if (niveles.length > 1) {
    avisos.push(
      `la zona mezcla ${niveles.length} niveles territoriales (${niveles.join(", ")}). Comprueba que no se solapen entre si.`
    );
  }

  const noOficiales = existentes.filter((u) => u.verificado !== true);

  if (noOficiales.length) {
    avisos.push(
      `${noOficiales.length} unidad(es) de la zona no estan verificadas: ${noOficiales
        .map((u) => u.nombre)
        .join(", ")}`
    );
  }

  return { valida: errores.length === 0, errores, avisos };
}


export function componerZona(definicion = {}) {
  const validacion = validarZona(definicion);

  if (!validacion.valida) {
    return { creada: false, ...validacion, zona: null };
  }

  const unidades = definicion.unidades.map((u) => unidadPorId(u));

  const conGeometria = unidades.filter((u) => u.geometriaDisponible);

  const sinGeometria = unidades.filter((u) => !u.geometriaDisponible);

  /*
    Geometria derivada SOLO si TODAS las hijas la tienen. Media
    zona pintada es peor que ninguna: sugiere que la parte en
    blanco no tiene actividad, cuando lo que no tiene es
    poligono.
  */
  const geometriaDerivada = sinGeometria.length === 0 && conGeometria.length > 0;

  const superficie = geometriaDerivada
    ? Number(
        unidades
          .reduce((s, u) => s + (u.superficieKm2 || 0), 0)
          .toFixed(3)
      )
    : null;

  const resolucionMasGruesa = unidades
    .map((u) => u.resolucion)
    .sort((a, b) => (rangoDeResolucion(a) || 0) - (rangoDeResolucion(b) || 0))[0];

  return {
    creada: true,
    errores: [],
    avisos: validacion.avisos,

    zona: {
      id: definicion.id || idDesde(definicion.nombre),
      nombre: definicion.nombre,
      tipo: definicion.tipo,

      unidades: unidades.map((u) => ({
        unidadId: u.id,
        nombre: u.nombre,
        resolucion: u.resolucion,
        oficial: u.verificado === true,
        geometriaDisponible: u.geometriaDisponible === true
      })),

      criterio: definicion.criterio,
      creadaPor: definicion.creadaPor,
      fecha: definicion.fecha || new Date().toISOString(),
      fuente: definicion.fuente || null,
      notas: definicion.notas || null,

      /*
        Innegociable. Una zona analitica NUNCA es oficial, ni
        aunque agrupe unidades que si lo son.
      */
      unidadOficial: false,
      tipoUnidad: TIPOS_UNIDAD.ANALITICA,

      verificado: Boolean(definicion.fuente) && definicion.verificado === true,

      geometriaDerivada,

      poligonosOrigen: geometriaDerivada
        ? conGeometria.map((u) => ({
            unidadId: u.id,
            nombre: u.nombre,
            codigoOficial: u.codigoOficial || null
          }))
        : [],

      motivoSinGeometria: geometriaDerivada
        ? null
        : `${sinGeometria.length} de ${unidades.length} unidades sin poligono oficial (${sinGeometria
            .map((u) => u.nombre)
            .join(", ")}). La zona no se dibuja: media zona pintada sugiere que el resto no tiene actividad, cuando lo que no tiene es geometria.`,

      superficieKm2: superficie,

      resolucionEquivalente: resolucionMasGruesa || null,

      advertencia:
        "Zona analitica definida por el analista. NO es una division administrativa oficial y no debe presentarse como tal."
    }
  };
}


/*
===========================================================
REGISTRO EN MEMORIA
===========================================================
*/

export function crearRegistroDeZonas(definiciones = []) {
  const zonas = [];

  const rechazadas = [];

  definiciones.forEach((d) => {
    const r = componerZona(d);

    if (r.creada) zonas.push(r.zona);
    else rechazadas.push({ definicion: d, errores: r.errores });
  });

  const porUnidad = new Map();

  zonas.forEach((z) => {
    z.unidades.forEach((u) => {
      if (!porUnidad.has(u.unidadId)) porUnidad.set(u.unidadId, []);

      porUnidad.get(u.unidadId).push(z);
    });
  });

  return {
    zonas,
    rechazadas,

    zonaDe(unidadId) {
      const lista = porUnidad.get(unidadId) || [];

      return lista[0] || null;
    },

    zonasDe(unidadId) {
      return porUnidad.get(unidadId) || [];
    },

    estado() {
      const unidadesCubiertas = porUnidad.size;

      const totalParroquias = listarUnidades({ resolucion: "parroquia" }).length;

      return {
        zonasDefinidas: zonas.length,
        rechazadas: rechazadas.length,
        unidadesCubiertas,
        totalParroquias,
        cobertura:
          totalParroquias > 0
            ? `${unidadesCubiertas} de ${totalParroquias} parroquias asignadas a alguna zona`
            : null,

        conGeometriaDerivada: zonas.filter((z) => z.geometriaDerivada).length,

        declaracion:
          zonas.length === 0
            ? "No hay ninguna zona analitica definida. Sentinel NO inventa una division Norte/Sur de Cuenca: no existe como division oficial y trazarla es una decision del analista."
            : `${zonas.length} zona(s) analitica(s) definidas por el analista. Ninguna es una division administrativa oficial.`
      };
    }
  };
}


/*
  Registro vacio por defecto. Ver la cabecera: nace sin zonas a
  proposito.
*/
export const REGISTRO_VACIO = crearRegistroDeZonas([]);


export default {
  TIPOS_ZONA,
  TIPOS_UNIDAD,
  CONTRATO_ZONA,
  validarZona,
  componerZona,
  crearRegistroDeZonas,
  REGISTRO_VACIO
};
