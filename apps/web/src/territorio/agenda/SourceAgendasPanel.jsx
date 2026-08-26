import { Layers, AlertTriangle } from "lucide-react";

/*
===========================================================
AGENDAS POR TIPO DE FUENTE — D2
===========================================================

Cinco agendas —ciudadana, mediática, institucional, de
creadores y digital— con el reparto del corpus entre ellas.

LO QUE ESTE PANEL EXISTE PARA IMPEDIR
-----------------------------------------------------------

Leer una agenda hecha al 100 % de prensa como si fuera «lo que
piensa Cuenca». En la primera lectura real el reparto era:

    mediática   60 %   6 emisores
    digital     40 %   1 plataforma, emisores sin identificar
    ciudadana    0 %
    institucional 0 %
    creadores    0 %

Tres agendas a cero. Sin este panel, esa composición no se ve y
la pantalla parece hablar de la ciudad entera.

VACÍO NO ES SILENCIO
-----------------------------------------------------------

Que la agenda ciudadana esté a cero no significa que la
ciudadanía calle: significa que ninguna consulta trajo una
fuente comunitaria. Es una carencia de la OBSERVACIÓN, y se
dice con esas palabras.
===========================================================
*/

const ORDEN = [
  "AGENDA_MEDIATICA",
  "AGENDA_DIGITAL",
  "AGENDA_INSTITUCIONAL",
  "AGENDA_CIUDADANA",
  "AGENDA_CREADORES",
  "SIN_CLASIFICAR"
];


export default function SourceAgendasPanel({ escucha }) {
  const bloque = escucha?.agendasPorFuente;

  const diversidad = escucha?.diversidad;

  if (!bloque?.metricas) return null;

  const filas = ORDEN.map((id) => ({
    id,
    etiqueta: bloque.etiquetas?.[id] || id,
    ...bloque.metricas[id]
  })).filter((f) => typeof f.evidencias === "number");

  const maximo = Math.max(1, ...filas.map((f) => f.evidencias));

  const vacias = filas.filter(
    (f) => f.evidencias === 0 && f.id !== "SIN_CLASIFICAR"
  );

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
          marginBottom: "4px"
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
          <Layers size={13} />
          Quién compone el corpus
        </span>

        {diversidad && (
          <span
            style={{ color: "var(--sentinel-texto-tenue)", fontSize: "10.5px" }}
          >
            {diversidad.fuentesIndependientes} emisores
            {diversidad.plataformas > 0 &&
              ` · ${diversidad.plataformas} plataforma(s)`}
          </span>
        )}
      </div>

      <div
        style={{
          color: "var(--sentinel-texto-suave)",
          fontSize: "11px",
          lineHeight: 1.7,
          marginBottom: "14px"
        }}
      >
        Reparto del <strong>corpus observado</strong> por naturaleza de quien
        publica. No es un reparto de la población ni de la opinión: son
        publicaciones.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
        {filas.map((f) => {
          const vacia = f.evidencias === 0;

          return (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span
                style={{
                  flex: "0 0 172px",
                  color: vacia
                    ? "var(--sentinel-texto-tenue)"
                    : "var(--sentinel-texto)",
                  fontSize: "11.5px"
                }}
              >
                {f.etiqueta}
              </span>

              <div
                style={{
                  flex: 1,
                  height: "9px",
                  background: "var(--sentinel-bg)",
                  borderRadius: "var(--radio-pill)",
                  overflow: "hidden"
                }}
              >
                <div
                  style={{
                    width: `${(f.evidencias / maximo) * 100}%`,
                    height: "100%",
                    background:
                      f.id === "SIN_CLASIFICAR"
                        ? "var(--sentinel-texto-tenue)"
                        : "var(--sentinel-cyan)",
                    opacity: f.id === "SIN_CLASIFICAR" ? 0.45 : 0.85
                  }}
                />
              </div>

              <span
                style={{
                  flex: "0 0 128px",
                  textAlign: "right",
                  color: vacia
                    ? "var(--sentinel-texto-tenue)"
                    : "var(--sentinel-texto-suave)",
                  fontSize: "10.5px"
                }}
              >
                {f.evidencias} ev · {f.fuentes} f ·{" "}
                {Math.round((f.cuotaDelCorpus || 0) * 100)} %
              </span>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: "10px",
          color: "var(--sentinel-texto-tenue)",
          fontSize: "10px"
        }}
      >
        Los porcentajes son <strong>del corpus observado</strong>, nunca de la
        ciudadanía.
      </div>

      {vacias.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: "8px",
            alignItems: "flex-start",
            background: "rgba(201,133,0,.09)",
            border: "1px solid #c98500",
            borderRadius: "var(--radio-m)",
            padding: "9px 11px",
            marginTop: "13px"
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
              {vacias.length} agenda(s) sin una sola evidencia:
            </strong>{" "}
            {vacias.map((v) => v.etiqueta).join(", ")}. Vacío{" "}
            <strong>no significa silencio</strong>: significa que ninguna fuente
            de ese tipo entró en el corpus. Es una carencia de la observación,
            no un hallazgo sobre el territorio.
          </div>
        </div>
      )}

      {diversidad?.limitacion && (
        <div
          style={{
            marginTop: "10px",
            color: "var(--sentinel-texto-tenue)",
            fontSize: "10.5px",
            lineHeight: 1.65
          }}
        >
          {diversidad.limitacion}
        </div>
      )}
    </section>
  );
}
