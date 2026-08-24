import { Activity, AlertTriangle } from "lucide-react";

import EvolutionChart from "../viz/EvolutionChart";

/*
===========================================================
VOLUMEN DE CONVERSACION PUBLICA
===========================================================

La advertencia va ARRIBA del grafico y no debajo.

«Conversacion publica» se lee inevitablemente como «lo que
dice la gente». No lo es: es lo que se PUBLICA en la web
abierta. Si esa aclaracion aparece bajo la curva, se lee
despues de haber interpretado el pico, y ya no corrige nada.

Un pico significa «se publico mas», no «importa mas».
===========================================================
*/

export default function ConversationVolumePanel({ conversacion, serieTerritorial }) {
  if (!conversacion) return null;

  const serie = conversacion.serie;

  const naturaleza = conversacion.naturaleza;

  /*
    Se prefiere la serie TERRITORIAL cuando existe: desglosa por
    unidad, que es la pregunta de este modulo. La de conversacion
    aporta el total y la ingesta.
  */
  const series = serieTerritorial?.series?.length
    ? serieTerritorial.series
    : (serie?.seriesPorTema || []).map((s) => ({
        unidadId: s.temaId,
        nombre: s.nombre,
        total: s.total,
        puntos: s.puntos
      }));

  const cubos = serieTerritorial?.cubos?.length
    ? serieTerritorial.cubos
    : serie?.cubos || [];

  const ingesta = serieTerritorial?.ingesta || serie?.ingesta || null;

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
          marginBottom: "12px"
        }}
      >
        <Activity size={15} color="var(--sentinel-cyan)" />

        <span
          style={{
            color: "var(--sentinel-cyan)",
            fontSize: "10px",
            letterSpacing: "1.8px",
            textTransform: "uppercase",
            fontWeight: 600
          }}
        >
          Volumen de conversación pública
        </span>
      </div>

      {/* LA ACLARACION, ANTES DEL GRAFICO */}
      <div
        style={{
          display: "flex",
          gap: "9px",
          alignItems: "flex-start",
          background: "var(--sentinel-surface-alta)",
          border: "1px solid var(--sentinel-borde)",
          borderRadius: "var(--radio-m)",
          padding: "10px 12px",
          marginBottom: "16px"
        }}
      >
        <AlertTriangle
          size={14}
          color="#eda100"
          style={{ flexShrink: 0, marginTop: "2px" }}
        />

        <div
          style={{
            color: "var(--sentinel-texto-suave)",
            fontSize: "11.5px",
            lineHeight: 1.7
          }}
        >
          Esto mide <strong>publicación</strong>, no opinión ciudadana.{" "}
          {naturaleza?.lecturaCorrecta}{" "}
          <span style={{ color: "var(--sentinel-texto-tenue)" }}>
            {naturaleza?.exclusionDeclarada}
          </span>
        </div>
      </div>

      <EvolutionChart
        series={series}
        cubos={cubos}
        ingesta={ingesta}
        unidad="publicaciones"
      />

      {serie?.metricas && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            marginTop: "14px",
            paddingTop: "12px",
            borderTop: "1px solid var(--sentinel-borde)",
            color: "var(--sentinel-texto-tenue)",
            fontSize: "10.5px"
          }}
        >
          <span>
            en serie: <strong>{serie.metricas.enSerie}</strong>
          </span>

          <span>
            sin fecha: <strong>{serie.metricas.sinFecha}</strong>
          </span>

          <span>
            pico máximo: <strong>{serie.metricas.picoMaximo}</strong>
          </span>

          <span>
            periodos sin observación:{" "}
            <strong>{serie.metricas.periodosSinDato}</strong>
          </span>
        </div>
      )}
    </section>
  );
}
