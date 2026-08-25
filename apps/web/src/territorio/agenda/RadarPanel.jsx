import { Radar } from "lucide-react";

/*
===========================================================
RADAR DE TEMAS
===========================================================

Muestra las TRES DIMENSIONES POR SEPARADO en lugar de un
número único.

POR QUE NO HAY UN SENTINEL SCORE
-----------------------------------------------------------

Un score opaco es una opinión con formato de métrica: nadie
puede desarmarlo y por tanto nadie puede discutirlo.

Aquí se ve que un tema encabeza por volumen, o por diversidad
de fuentes, o por reciente. Son cosas distintas y llevan a
decisiones distintas: cinco notas del mismo medio no valen lo
que cinco notas de cinco medios, aunque el volumen coincida.

La combinación existe —hace falta un orden— pero es explícita,
está documentada, y el test la comprueba.

LOS ESTADOS QUE FALTAN, Y POR QUE
-----------------------------------------------------------

No hay «emergente», «creciendo», «cayendo» ni «viral». Los
cuatro exigen comparar con una ventana anterior que el
recolector todavía no trae. Ponerlos ahora sería inventar la
mitad del significado.
===========================================================
*/

const COLOR = {
  alta_actividad_observada: "#0ca30c",
  actividad_media: "#fab219",
  actividad_baja: "#5598e7",
  senal_insuficiente: "#334155"
};


function Barra({ valor, color, titulo }) {
  return (
    <div
      title={titulo}
      style={{
        flex: 1,
        height: "5px",
        background: "var(--sentinel-bg)",
        borderRadius: "3px",
        overflow: "hidden",
        minWidth: "36px"
      }}
    >
      <div
        style={{
          width: `${Math.max(3, (valor || 0) * 100)}%`,
          height: "100%",
          background: color,
          borderRadius: "3px"
        }}
      />
    </div>
  );
}


export default function RadarPanel({ agenda, onAbrirTema }) {
  const filas = agenda?.agenda || [];

  if (filas.length === 0) return null;

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
          marginBottom: "6px"
        }}
      >
        <Radar size={15} color="var(--sentinel-cyan)" />

        <span
          style={{
            color: "var(--sentinel-cyan)",
            fontSize: "10px",
            letterSpacing: "1.8px",
            textTransform: "uppercase",
            fontWeight: 600
          }}
        >
          Radar de temas
        </span>
      </div>

      <div
        style={{
          color: "var(--sentinel-texto-suave)",
          fontSize: "11px",
          lineHeight: 1.6,
          marginBottom: "14px"
        }}
      >
        Tres dimensiones por separado. No hay puntuación única: un tema puede
        encabezar por volumen, por diversidad de fuentes o por reciente, y no
        significan lo mismo.
      </div>

      {/* Cabecera de columnas */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "0 4px 7px 4px",
          color: "var(--sentinel-texto-tenue)",
          fontSize: "9px",
          letterSpacing: "1px",
          textTransform: "uppercase",
          borderBottom: "1px solid var(--sentinel-borde)"
        }}
      >
        <span style={{ flex: "0 0 168px" }}>Tema</span>
        <span style={{ flex: 1 }}>Evidencias</span>
        <span style={{ flex: 1 }}>Fuentes</span>
        <span style={{ flex: 1 }}>Recencia</span>
        <span style={{ flex: "0 0 92px", textAlign: "right" }}>Estado</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {filas.map((t) => {
          const d = t.dimensiones || {};

          const c = COLOR[t.estadoActividad] || "#64748b";

          return (
            <button
              key={t.id}
              onClick={() => onAbrirTema(t)}
              className="sentinel-hover"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "9px 4px",
                background: "transparent",
                border: "none",
                borderBottom: "1px solid var(--sentinel-borde)",
                cursor: "pointer",
                textAlign: "left",
                width: "100%"
              }}
            >
              <span
                style={{
                  flex: "0 0 168px",
                  color: "var(--sentinel-texto)",
                  fontSize: "12px",
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}
                title={t.etiqueta}
              >
                {t.etiqueta}
              </span>

              <span
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "7px"
                }}
              >
                <Barra
                  valor={d.evidencias?.normalizado}
                  color={c}
                  titulo={`${d.evidencias?.valor} evidencias`}
                />
                <span
                  style={{
                    color: "var(--sentinel-texto-suave)",
                    fontSize: "10.5px",
                    minWidth: "16px",
                    fontVariantNumeric: "tabular-nums"
                  }}
                >
                  {d.evidencias?.valor}
                </span>
              </span>

              <span
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "7px"
                }}
              >
                <Barra
                  valor={d.fuentes?.normalizado}
                  color={c}
                  titulo={`${d.fuentes?.valor} fuentes independientes`}
                />
                <span
                  style={{
                    color: "var(--sentinel-texto-suave)",
                    fontSize: "10.5px",
                    minWidth: "16px",
                    fontVariantNumeric: "tabular-nums"
                  }}
                >
                  {d.fuentes?.valor}
                </span>
              </span>

              <span
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "7px"
                }}
              >
                <Barra
                  valor={d.recencia?.normalizado}
                  color={c}
                  titulo={
                    d.recencia?.valor
                      ? `última observación ${String(d.recencia.valor).slice(0, 10)}`
                      : "sin fecha"
                  }
                />
                <span
                  style={{
                    color: "var(--sentinel-texto-tenue)",
                    fontSize: "9.5px",
                    minWidth: "34px"
                  }}
                >
                  {d.recencia?.valor
                    ? String(d.recencia.valor).slice(5, 10)
                    : "—"}
                </span>
              </span>

              <span
                style={{
                  flex: "0 0 92px",
                  textAlign: "right",
                  color: c,
                  fontSize: "9.5px",
                  fontWeight: 650,
                  lineHeight: 1.3
                }}
              >
                {t.etiquetaActividad}
              </span>
            </button>
          );
        })}
      </div>

      <div
        style={{
          marginTop: "12px",
          color: "var(--sentinel-texto-tenue)",
          fontSize: "10.5px",
          lineHeight: 1.7
        }}
      >
        Estados posibles: alta actividad · media · baja · señal insuficiente.{" "}
        <strong>No</strong> se usa «emergente», «creciendo» ni «viral»: exigen
        una ventana anterior comparable que el recolector todavía no trae.
      </div>
    </section>
  );
}
