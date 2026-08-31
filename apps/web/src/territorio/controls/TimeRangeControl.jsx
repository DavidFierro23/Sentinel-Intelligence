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
  /*
    HOY es distinto de los demas y por eso va aparte.

    Los otros rangos son ventanas RODANTES: restan dias al
    instante actual. HOY es un DIA DE CALENDARIO en la zona del
    territorio, y quien lo calcula es el backend —el navegador
    puede estar en otro huso, y a las 21:00 de Cuenca el
    navegador de un analista en Madrid ya esta en el dia
    siguiente—.

    Por eso `id` viaja al backend y las fechas de aqui son solo
    una aproximacion para pintar el control.
  */
  { id: "hoy", dias: 1, texto: "Hoy", esDia: true },
  { id: "7d", dias: 7, texto: "7 días" },
  { id: "15d", dias: 15, texto: "15 días" },
  { id: "30d", dias: 30, texto: "30 días" },
  { id: "90d", dias: 90, texto: "90 días", aviso: true }
];


export default function TimeRangeControl() {
  const { ventana, setVentana, ventanaId, setVentanaId, granularidad, setGranularidad } =
    useTerritorial();

  const diasActuales = Math.round(
    (new Date(ventana.hasta) - new Date(ventana.desde)) / 86400000
  );

  const aplicar = (rango) => {
    const hasta = new Date();

    const desde = new Date(hasta.getTime() - rango.dias * 86400000);

    setVentana({ desde: desde.toISOString(), hasta: hasta.toISOString() });

    /*
      El identificador es lo que manda. El backend recalcula el
      intervalo en la zona del territorio a partir de el.
    */
    setVentanaId(rango.id);

    const dias = rango.dias;

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
          /*
            Se compara por identificador, no por duracion. HOY y
            «7 dias» rodantes pueden dar duraciones parecidas
            segun la hora, y con la comparacion antigua el boton
            activo saltaba solo.
          */
          const activo = ventanaId
            ? ventanaId === r.id
            : Math.abs(diasActuales - r.dias) <= 1;

          return (
            <button
              key={r.id}
              onClick={() => aplicar(r)}
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
