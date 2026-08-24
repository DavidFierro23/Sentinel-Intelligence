import { CalendarRange } from "lucide-react";

import { useTerritorial } from "../useTerritorial";

/*
===========================================================
VENTANA TEMPORAL
===========================================================

Rangos cortos. Y una advertencia que no es decorativa:

Google News ofrece una VENTANA MOVIL de semanas, no un
archivo. Pedir 90 dias no devuelve 90 dias de cobertura:
devuelve lo que hoy sigue indexado. Si el control ofreciera
rangos largos sin decirlo, el analista leeria un descenso de
volumen que en realidad es el borde del indice.

Por eso el rango largo lleva su propio aviso, y el defecto son
30 dias.
===========================================================
*/

const RANGOS = [
  { dias: 7, texto: "7 días" },
  { dias: 15, texto: "15 días" },
  { dias: 30, texto: "30 días" },
  { dias: 90, texto: "90 días", aviso: true }
];


export default function TimeRangeControl() {
  const { ventana, setVentana, granularidad, setGranularidad } =
    useTerritorial();

  const diasActuales = Math.round(
    (new Date(ventana.hasta) - new Date(ventana.desde)) / 86400000
  );

  const aplicar = (dias) => {
    const hasta = new Date();

    const desde = new Date(hasta.getTime() - dias * 86400000);

    setVentana({ desde: desde.toISOString(), hasta: hasta.toISOString() });

    /*
      Mas de 30 dias en cubos diarios produce un grafico de 90
      columnas ilegible. Se cambia solo, y se dice.
    */
    setGranularidad(dias > 30 ? "semana" : "dia");
  };

  const largo = diasActuales > 30;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          color: "var(--sentinel-texto-tenue)",
          fontSize: "9.5px",
          letterSpacing: "1.2px",
          textTransform: "uppercase"
        }}
      >
        <CalendarRange size={11} />
        Ventana · {granularidad === "semana" ? "por semana" : "por día"}
      </span>

      <div style={{ display: "flex", gap: "6px" }}>
        {RANGOS.map((r) => {
          const activo = Math.abs(diasActuales - r.dias) <= 1;

          return (
            <button
              key={r.dias}
              onClick={() => aplicar(r.dias)}
              style={{
                padding: "5px 11px",
                borderRadius: "var(--radio-pill)",
                border: `1px solid ${
                  activo ? "var(--sentinel-cyan)" : "var(--sentinel-borde)"
                }`,
                background: activo ? "rgba(11,95,255,.18)" : "transparent",
                color: activo ? "#FFFFFF" : "var(--sentinel-texto-suave)",
                fontSize: "11px",
                fontWeight: activo ? 650 : 500,
                cursor: "pointer"
              }}
            >
              {r.texto}
            </button>
          );
        })}
      </div>

      {largo && (
        <span
          style={{
            color: "#eda100",
            fontSize: "10px",
            lineHeight: 1.6,
            maxWidth: "340px"
          }}
        >
          Google News mantiene una ventana móvil de semanas, no un archivo. En
          rangos largos, un descenso puede ser el borde del índice y no una
          caída real.
        </span>
      )}
    </div>
  );
}
