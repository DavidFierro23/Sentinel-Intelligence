import { useMemo, useState } from "react";
import { Map as MapIcon, AlertTriangle } from "lucide-react";

import {
  escalaPorCuantiles,
  SIN_DATO,
  MUESTRA_INSUFICIENTE,
  fondoHachurado
} from "../viz/palette";

/*
===========================================================
MAPA TERRITORIAL — F1
===========================================================

Coropleta sobre las geometrías OFICIALES disponibles. Nada
más: ni un polígono inventado, ni un barrio dibujado a ojo, ni
el Centro Histórico trazado a mano.

POR QUE SVG Y NO MAPLIBRE
-----------------------------------------------------------

UX-WR-001 especifica MapLibre para el War Room completo, con
basemap, zoom y teselas vectoriales. Eso sigue en pie.

Para F1 no hace falta: hay 22 polígonos de un solo cantón en
EPSG:4326, y dibujarlos como paths de SVG con una proyección
equirectangular corregida por latitud da exactamente el mismo
resultado visual a esta escala.

A cambio se evita una dependencia de varios megabytes y su
mantenimiento. Cuando el mapa necesite basemap, zoom continuo
o teselas, MapLibre entra —y el agregado que lo alimenta es
este mismo, no hay trabajo que rehacer.

LO QUE EL MAPA NO DICE
-----------------------------------------------------------

No dice «el 35 % de Sayausí habla de X». Dice «4 evidencias
observadas asociadas a Sayausí». Lo primero exigiría un
denominador poblacional comparable y sería falso.

Y lo que no tiene polígono NO desaparece: va al bloque de
lugares sin geometría, debajo. Un mapa que omite en silencio
media ciudad sugiere que allí no pasa nada.
===========================================================
*/

const ALTO = 420;

const MARGEN = 14;


/*
  Polygon y MultiPolygon a una sola lista de anillos.

  Hace falta porque el cantón NO tiene polígono propio en el
  fichero de CONALI: se compone como MultiPolygon a partir de
  sus 22 hijas. Sin esto, la unidad que concentra casi toda la
  evidencia —GEO-1 mantiene la mayoría a nivel cantón— era la
  única que el mapa no sabía dibujar.
*/
function anillosDe(geometria) {
  if (!geometria?.coordinates) return [];

  return geometria.type === "MultiPolygon"
    ? geometria.coordinates.flat()
    : geometria.coordinates;
}


function proyectar(features, ancho, alto) {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  features.forEach((f) => {
    anillosDe(f.geometria).forEach((anillo) => {
      anillo.forEach(([lon, lat]) => {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      });
    });
  });

  if (!Number.isFinite(minLon)) return null;

  /*
    Corrección por latitud. Un grado de longitud mide menos que
    uno de latitud según nos alejamos del ecuador; sin esto, el
    cantón sale estirado en horizontal.
  */
  const latMedia = ((minLat + maxLat) / 2) * (Math.PI / 180);

  const factorLon = Math.cos(latMedia);

  const anchoGeo = (maxLon - minLon) * factorLon;

  const altoGeo = maxLat - minLat;

  const escala = Math.min(
    (ancho - MARGEN * 2) / anchoGeo,
    (alto - MARGEN * 2) / altoGeo
  );

  const offsetX = (ancho - anchoGeo * escala) / 2;

  const offsetY = (alto - altoGeo * escala) / 2;

  return ([lon, lat]) => [
    offsetX + (lon - minLon) * factorLon * escala,
    /* SVG crece hacia abajo; la latitud, hacia arriba. */
    offsetY + (maxLat - lat) * escala
  ];
}


function aPath(geometria, proy) {
  return anillosDe(geometria)
    .map((anillo) => {
      const puntos = anillo.map(proy);

      if (puntos.length === 0) return "";

      return (
        `M ${puntos[0][0].toFixed(1)} ${puntos[0][1].toFixed(1)} ` +
        puntos
          .slice(1)
          .map((p) => `L ${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
          .join(" ") +
        " Z"
      );
    })
    .join(" ");
}


export default function TerritorialMap({ mapa, onSeleccionar, seleccionada }) {
  const [hover, setHover] = useState(null);

  /*
    Se memoriza porque `mapa?.conGeometria || []` crea un array
    nuevo en cada render cuando el mapa aun no ha llegado, y eso
    invalidaria los useMemo de la proyeccion y la escala en
    cada pasada.
  */
  const unidades = useMemo(() => mapa?.conGeometria || [], [mapa]);

  const ANCHO = 760;

  const proy = useMemo(() => proyectar(unidades, ANCHO, ALTO), [unidades]);

  /*
    La rampa se calcula SOLO con las unidades que superan el
    umbral de muestra. Si entrasen las de muestra insuficiente,
    dos evidencias sueltas moverian los cuantiles y recolorearian
    a las que si tienen respaldo.
  */
  const escala = useMemo(
    () =>
      escalaPorCuantiles(
        unidades.filter((u) => u.sePinta && u.evidencias > 0).map((u) => u.evidencias)
      ),
    [unidades]
  );

  if (unidades.length === 0 || !proy) {
    return (
      <section
        style={{
          background: "var(--sentinel-surface)",
          border: "1px solid var(--sentinel-borde)",
          borderRadius: "var(--radio-l)",
          padding: "18px 20px"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "9px",
            marginBottom: "10px"
          }}
        >
          <MapIcon size={15} color="var(--sentinel-cyan)" />
          <span
            style={{
              color: "var(--sentinel-cyan)",
              fontSize: "10px",
              letterSpacing: "1.8px",
              textTransform: "uppercase",
              fontWeight: 600
            }}
          >
            Mapa territorial
          </span>
        </div>

        <div
          style={{
            color: "var(--sentinel-texto-suave)",
            fontSize: "12px",
            lineHeight: 1.7
          }}
        >
          Ninguna unidad con geometría oficial acumuló evidencia en esta
          ventana. El mapa no se dibuja vacío: eso sugeriría que no ocurre nada.
        </div>
      </section>
    );
  }

  const activa = hover || seleccionada;

  const derivadas = unidades.filter((u) => u.geometriaDerivada);

  const hayDerivadas = derivadas.length > 0;

  return (
    <section
      style={{
        background: "var(--sentinel-surface)",
        border: "1px solid var(--sentinel-borde)",
        borderRadius: "var(--radio-l)",
        padding: "18px 20px"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "6px"
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            color: "var(--sentinel-cyan)",
            fontSize: "10px",
            letterSpacing: "1.8px",
            textTransform: "uppercase",
            fontWeight: 600
          }}
        >
          <MapIcon size={13} />
          Mapa territorial
        </span>

        <span
          style={{ color: "var(--sentinel-texto-tenue)", fontSize: "10.5px" }}
        >
          {mapa.metricas.unidadesPintables} unidades con geometría oficial
        </span>
      </div>

      {/* La advertencia va ARRIBA del mapa, no debajo. */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "flex-start",
          background: "rgba(201,133,0,.09)",
          border: "1px solid #c98500",
          borderRadius: "var(--radio-m)",
          padding: "9px 11px",
          marginBottom: "14px"
        }}
      >
        <AlertTriangle
          size={13}
          color="#eda100"
          style={{ flexShrink: 0, marginTop: "2px" }}
        />

        <div
          style={{
            color: "var(--sentinel-texto-suave)",
            fontSize: "11px",
            lineHeight: 1.65
          }}
        >
          <strong style={{ color: "#eda100" }}>
            Cobertura geométrica parcial.
          </strong>{" "}
          Las 15 parroquias urbanas de Cuenca no tienen polígono oficial
          publicado.
          {mapa.metricas.unidadesSinGeometria > 0 &&
            ` ${mapa.metricas.unidadesSinGeometria} unidad(es) con actividad no se dibujan y aparecen abajo.`}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          background: "var(--sentinel-bg)",
          borderRadius: "var(--radio-m)"
        }}
        role="img"
        aria-label="Mapa de unidades territoriales con geometría oficial"
      >
        {/*
          El hachurado de la regla §6.6 en SVG. En una tabla es
          un gradiente CSS; aqui tiene que ser un patrón, porque
          `repeating-linear-gradient` no es un valor válido de
          `fill`.
        */}
        <defs>
          {[
            ["hatch-sin-dato", SIN_DATO.color],
            ["hatch-muestra", MUESTRA_INSUFICIENTE.color]
          ].map(([id, color]) => (
            <pattern
              key={id}
              id={id}
              width="8"
              height="8"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="8" height="8" fill="var(--sentinel-bg)" />
              <rect width="4" height="8" fill={color} />
            </pattern>
          ))}
        </defs>

        {unidades.map((u) => {
          /*
            Tres estados distintos y NO intercambiables:

              con muestra suficiente  → color de la rampa
              muestra insuficiente    → hachurado, nunca rampa
              sin evidencia           → hachurado «sin dato»

            «Casi cero» y «no sabemos» no pueden parecerse, y
            «dos notas sueltas» tampoco puede parecerse a un
            territorio con respaldo: seria el mismo error que la
            penetracion del 238 % que originó GEO-1.
          */
          const conMuestra = u.sePinta && u.evidencias > 0;

          const relleno = conMuestra
            ? escala.colorDe(u.evidencias)
            : u.evidencias > 0
              ? "url(#hatch-muestra)"
              : "url(#hatch-sin-dato)";

          const esActiva = activa?.unidadId === u.unidadId;

          return (
            <path
              key={u.unidadId}
              d={aPath(u.geometria, proy)}
              fill={relleno}
              fillOpacity={conMuestra ? 0.88 : 0.65}
              stroke={esActiva ? "var(--sentinel-cyan)" : "#0a1a3d"}
              strokeWidth={esActiva ? 2.2 : 0.9}
              /* Contorno discontinuo = límite derivado, no oficial. */
              strokeDasharray={u.geometriaDerivada ? "5 3" : undefined}
              style={{ cursor: "pointer", transition: "stroke-width 120ms" }}
              onMouseEnter={() => setHover(u)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSeleccionar(u)}
            >
              <title>
                {`${u.nombre}: ${u.evidencias} evidencias observadas` +
                  (conMuestra ? "" : " · muestra insuficiente") +
                  (u.geometriaDerivada
                    ? ` · límite derivado de ${u.poligonosOrigen?.length || 0} polígonos oficiales`
                    : "")}
              </title>
            </path>
          );
        })}
      </svg>

      {/* Leyenda */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "14px",
          marginTop: "12px"
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            color: "var(--sentinel-texto-tenue)",
            fontSize: "10px"
          }}
        >
          evidencias
          {["#cde2fb", "#9ec5f4", "#5598e7", "#2a78d6", "#184f95"].map((c) => (
            <span
              key={c}
              style={{
                width: "16px",
                height: "9px",
                background: c,
                display: "inline-block"
              }}
            />
          ))}
          más
        </span>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            color: "var(--sentinel-texto-tenue)",
            fontSize: "10px"
          }}
        >
          <span
            style={{
              width: "16px",
              height: "9px",
              background: fondoHachurado(SIN_DATO.color),
              border: "1px solid var(--sentinel-borde)",
              display: "inline-block"
            }}
          />
          sin evidencia observada
        </span>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            color: "var(--sentinel-texto-tenue)",
            fontSize: "10px"
          }}
        >
          <span
            style={{
              width: "16px",
              height: "9px",
              background: fondoHachurado(MUESTRA_INSUFICIENTE.color),
              border: "1px solid var(--sentinel-borde)",
              display: "inline-block"
            }}
          />
          muestra insuficiente
        </span>

        {hayDerivadas && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              color: "var(--sentinel-texto-tenue)",
              fontSize: "10px"
            }}
          >
            <span
              style={{
                width: "16px",
                height: "9px",
                border: "1px dashed var(--sentinel-texto-tenue)",
                display: "inline-block"
              }}
            />
            límite derivado
          </span>
        )}

        {activa && (
          <span
            style={{
              marginLeft: "auto",
              color: "var(--sentinel-texto)",
              fontSize: "11.5px",
              fontWeight: 600
            }}
          >
            {activa.nombre} · {activa.evidencias} evidencias observadas
          </span>
        )}
      </div>

      <div
        style={{
          marginTop: "10px",
          color: "var(--sentinel-texto-tenue)",
          fontSize: "10.5px",
          lineHeight: 1.7
        }}
      >
        El color representa <strong>evidencias observadas</strong> por unidad.
        No es un porcentaje de población ni de cobertura territorial: no existe
        denominador comparable para calcularlo.
        {hayDerivadas && (
          <>
            {" "}
            {derivadas.map((u) => u.nombre).join(", ")} se dibuja con{" "}
            <strong>límite derivado</strong>: la fuente oficial publica las
            parroquias, no el contorno, así que se compone sumando{" "}
            {derivadas[0].poligonosOrigen?.length || 0} polígonos oficiales. Es
            una unión declarada, no un polígono publicado por la institución.
          </>
        )}
      </div>
    </section>
  );
}
