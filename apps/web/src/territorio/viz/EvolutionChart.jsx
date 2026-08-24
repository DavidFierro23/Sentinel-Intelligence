import { useMemo, useState } from "react";

import { asignarColores, COLOR_OTROS } from "./palette";

/*
===========================================================
EVOLUTION CHART — SVG, UN SOLO EJE
===========================================================

Regla congelada WR-D12: un solo eje vertical. Dos magnitudes
de escala distinta van a dos graficos o se indexan a base
comun. Un doble eje permite «demostrar» cualquier correlacion
eligiendo las escalas, y ese es exactamente el uso que un
panel de inteligencia no debe habilitar.

El color sigue a la ENTIDAD, no a su rango: la asignacion se
hace sobre la lista completa y estable, de modo que ocultar
una serie no repinta las demas.

LA BARRA DE COBERTURA
-----------------------------------------------------------

Bajo el eje temporal, siempre. Sentinel observa bajo demanda,
asi que un tramo en cero significa «no se miro», no «no
paso nada». Sin esta barra, el grafico afirma calma donde solo
hubo ceguera (riesgo WR-7).

SVG a mano y no una libreria: son cuatro elementos, no hay
dependencia nueva y el eje no puede duplicarse por descuido.
===========================================================
*/

const ALTO = 180;

const MARGEN = { arriba: 12, derecha: 12, abajo: 34, izquierda: 40 };


export default function EvolutionChart({
  series = [],
  cubos = [],
  ingesta = null,
  unidad = "evidencias",
  alto = ALTO
}) {
  const [ocultas, setOcultas] = useState(() => new Set());

  /*
    Asignacion estable: sobre TODAS las series recibidas, no
    sobre las visibles. Es lo que impide que ocultar una serie
    cambie el color de las otras.
  */
  const paleta = useMemo(
    () => asignarColores(series.map((s) => s.unidadId || s.temaId || s.nombre)),
    [series]
  );

  const visibles = series.filter(
    (s) => !ocultas.has(s.unidadId || s.temaId || s.nombre)
  );

  const puntosPorSerie = visibles.map((s) => s.puntos || []);

  const maximo = Math.max(
    1,
    ...puntosPorSerie.flat().map((p) => p.valor || 0)
  );

  const n = cubos.length || puntosPorSerie[0]?.length || 0;

  if (n === 0) {
    return (
      <div
        style={{
          color: "var(--sentinel-texto-tenue)",
          fontSize: "12px",
          padding: "24px 0",
          textAlign: "center"
        }}
      >
        Sin serie temporal: ninguna evidencia trae fecha utilizable.
      </div>
    );
  }

  const ancho = 720;

  const anchoUtil = ancho - MARGEN.izquierda - MARGEN.derecha;

  const altoUtil = alto - MARGEN.arriba - MARGEN.abajo;

  const x = (i) => MARGEN.izquierda + (n === 1 ? anchoUtil / 2 : (anchoUtil * i) / (n - 1));

  const y = (v) => MARGEN.arriba + altoUtil - (altoUtil * (v || 0)) / maximo;

  const etiquetaFecha = (iso) => {
    try {
      const d = new Date(iso);

      return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
    } catch {
      return "";
    }
  };

  const alternar = (id) => {
    setOcultas((prev) => {
      const s = new Set(prev);

      if (s.has(id)) s.delete(id);
      else s.add(id);

      return s;
    });
  };

  const cobertura = ingesta?.barraDeCobertura || [];

  return (
    <div>
      <svg
        viewBox={`0 0 ${ancho} ${alto}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label={`Evolución de ${unidad}`}
      >
        {/* Rejilla y UN SOLO eje vertical */}
        {[0, 0.5, 1].map((f) => {
          const valor = Math.round(maximo * f);

          return (
            <g key={f}>
              <line
                x1={MARGEN.izquierda}
                x2={ancho - MARGEN.derecha}
                y1={y(valor)}
                y2={y(valor)}
                stroke="var(--sentinel-borde)"
                strokeWidth="1"
              />

              <text
                x={MARGEN.izquierda - 8}
                y={y(valor) + 3.5}
                textAnchor="end"
                fill="var(--sentinel-texto-tenue)"
                fontSize="9.5"
              >
                {valor}
              </text>
            </g>
          );
        })}

        {/* Series */}
        {visibles.map((s) => {
          const id = s.unidadId || s.temaId || s.nombre;

          const puntos = s.puntos || [];

          const d = puntos
            .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.valor)}`)
            .join(" ");

          return (
            <path
              key={id}
              d={d}
              fill="none"
              stroke={paleta.colorDe(id)}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })}

        {/* Eje X */}
        {cubos.map((c, i) => {
          const cada = Math.max(1, Math.ceil(n / 8));

          if (i % cada !== 0) return null;

          return (
            <text
              key={c.inicio || i}
              x={x(i)}
              y={alto - MARGEN.abajo + 14}
              textAnchor="middle"
              fill="var(--sentinel-texto-tenue)"
              fontSize="9.5"
            >
              {etiquetaFecha(c.inicio)}
            </text>
          );
        })}

        {/*
          BARRA DE COBERTURA DE OBSERVACION — obligatoria.
          Tramo lleno = se observo. Tramo hueco = no se miro.
        */}
        {cobertura.length > 0 &&
          cobertura.map((c, i) => (
            <rect
              key={c.inicio || i}
              x={x(i) - anchoUtil / (2 * Math.max(1, n))}
              y={alto - 12}
              width={Math.max(2, anchoUtil / Math.max(1, n))}
              height="6"
              fill={c.observado ? "var(--sentinel-blue)" : "transparent"}
              stroke={c.observado ? "none" : "var(--sentinel-borde-vivo)"}
              strokeWidth="1"
              strokeDasharray={c.observado ? undefined : "2 2"}
            />
          ))}
      </svg>

      {/* Leyenda conmutable */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          marginTop: "10px"
        }}
      >
        {series.map((s) => {
          const id = s.unidadId || s.temaId || s.nombre;

          const oculta = ocultas.has(id);

          return (
            <button
              key={id}
              onClick={() => alternar(id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
                opacity: oculta ? 0.4 : 1,
                color: "var(--sentinel-texto-suave)",
                fontSize: "11.5px"
              }}
            >
              <span
                style={{
                  width: "10px",
                  height: "3px",
                  borderRadius: "2px",
                  background: paleta.colorDe(id),
                  flexShrink: 0
                }}
              />

              {s.nombre}

              <span style={{ color: "var(--sentinel-texto-tenue)" }}>
                {s.total}
              </span>
            </button>
          );
        })}
      </div>

      {paleta.aviso && (
        <div
          style={{
            color: "var(--sentinel-texto-tenue)",
            fontSize: "10.5px",
            marginTop: "8px",
            lineHeight: 1.6
          }}
        >
          {paleta.aviso} Las restantes comparten el gris de «otros» (
          <span style={{ color: COLOR_OTROS }}>■</span>).
        </div>
      )}

      {ingesta && (
        <div
          style={{
            color: "var(--sentinel-texto-tenue)",
            fontSize: "10.5px",
            marginTop: "8px",
            lineHeight: 1.6,
            borderTop: "1px solid var(--sentinel-borde)",
            paddingTop: "8px"
          }}
        >
          <strong style={{ color: "var(--sentinel-texto-suave)" }}>
            Cobertura de observación:
          </strong>{" "}
          {ingesta.interpretacion}
        </div>
      )}
    </div>
  );
}
