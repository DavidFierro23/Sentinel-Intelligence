// apps/backend/services/geo/topicTerritoryCrosstab.js

/*
===========================================================
TEMA x TERRITORIO — Gate C2
===========================================================

Cruza cada tema con los territorios de sus evidencias
GEOLOCALIZABLES, y solo con esas.

Un tema con diez evidencias de las que dos se pudieron ubicar
aparece con dos. No se reparte el resto y no se asume que una
noticia sobre Cuenca aplique a todas sus parroquias: eso seria
desagregar, y GEO-1 lo prohibe.

La cifra `sinGeolocalizar` va SIEMPRE al lado. Sin ella, un
tema cuyas evidencias no se pudieron ubicar parece un tema sin
presencia territorial, cuando lo que pasa es que no se supo
donde ponerlo.
===========================================================
*/

export function cruzarTemaTerritorio({
  temas,
  descubiertos,
  ubicaciones,
  totalEvidencias
}) {
  const cruzar = (t, origen) => {
    const indices = t.indices || [];

    const mapa = new Map();

    let sinUbicar = 0;

    indices.forEach((i) => {
      const u = ubicaciones[i];

      if (!u?.unidadId) {
        sinUbicar += 1;
        return;
      }

      if (!mapa.has(u.unidadId)) {
        mapa.set(u.unidadId, {
          unidadId: u.unidadId,
          nombre: u.unidad || u.unidadId,
          nivel: u.nivel || null,
          evidencias: 0
        });
      }

      mapa.get(u.unidadId).evidencias += 1;
    });

    const territorios = [...mapa.values()].sort(
      (a, b) => b.evidencias - a.evidencias
    );

    return {
      temaId: t.id,
      tema: t.nombre || t.etiquetaPropuesta,
      origen,

      evidenciasTotales: indices.length,
      evidenciasGeolocalizadas: indices.length - sinUbicar,
      sinGeolocalizar: sinUbicar,

      territorios,

      declaracion: territorios.length
        ? `${indices.length - sinUbicar} de ${indices.length} evidencias del tema se pudieron ubicar. Las ${sinUbicar} restantes NO se reparten.`
        : `Ninguna de las ${indices.length} evidencias del tema se pudo ubicar: el tema no tiene presencia territorial atribuible, que no es lo mismo que no tenerla.`
    };
  };

  const filas = [
    ...temas.map((t) => cruzar(t, "clasificado")),
    ...descubiertos.map((t) => cruzar(t, "descubierto"))
  ];

  return {
    filas,

    metricas: {
      temas: filas.length,
      conTerritorio: filas.filter((f) => f.territorios.length > 0).length,
      sinTerritorio: filas.filter((f) => f.territorios.length === 0).length,
      evidenciasTotales: totalEvidencias
    },

    reglas: [
      "Solo se usan evidencias geolocalizables.",
      "Un tema NO se reparte territorialmente por poblacion.",
      "Una noticia sobre el canton NO se atribuye a sus parroquias.",
      "El numero de evidencias sin ubicar viaja siempre al lado del que si."
    ]
  };
}



export default { cruzarTemaTerritorio };
