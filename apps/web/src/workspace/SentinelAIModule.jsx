import { Sparkles, Lock } from "lucide-react";

import EstadoChip from "./EstadoChip";

/*
===========================================================
SENTINEL-UX-CONSOLIDATION-01 — SENTINEL AI
===========================================================

Existe como destino de navegacion y declara que NO esta
terminado. Las dos cosas a la vez, a proposito.

POR QUE APARECE SI NO FUNCIONA
-----------------------------------------------------------

Porque el destino ordena el producto. Las preguntas que un
analista le va a hacer a Sentinel son las que justifican que
Candidate, Territorio y Media compartan proyecto, ventana y
evidencia. Verlas escritas obliga a que los modulos se corten
por donde hace falta.

Lo que NO se hace es fingir. No hay caja de texto que acepte una
consulta y devuelva algo generado: una respuesta plausible sin
motor detras es peor que una pantalla honesta, porque se cita.

LO QUE ESTA PANTALLA NO TIENE
-----------------------------------------------------------

    ningun input activo
    ninguna respuesta de ejemplo presentada como real
    ningun motor conectado

`sentinelAI.implementado` sigue siendo `false` en el backend de
Media, y esta pantalla lo refleja en lugar de contradecirlo.
===========================================================
*/

const CAJA = {
  background: "var(--sentinel-surface)",
  border: "1px solid var(--sentinel-borde)",
  borderRadius: "var(--radio-m)",
  padding: "18px 20px"
};


/*
  Los cinco ejes que una respuesta tendria que cruzar. Se
  declaran con su estado real para que se vea que falta.
*/
const EJES = [
  { eje: "Candidato", estado: "OPERATIVO_CON_LIMITACIONES", nota: "Expedientes y activos sociales observados." },
  { eje: "Territorio", estado: "EN_CALIBRACION", nota: "Resolución social de topónimos en calibración." },
  { eje: "Medios", estado: "OPERATIVO_CON_LIMITACIONES", nota: "Corpus canónico, ranking y evidencia." },
  { eje: "Tiempo", estado: "PARCIAL", nota: "Ventanas reales; sin series con métricas todavía." },
  { eje: "Evidencia", estado: "OPERATIVO", nota: "Toda cifra llega a su evidencia." }
];


const PREGUNTAS = [
  "¿Qué medios están mencionando más a un candidato esta semana?",
  "¿Qué temas se están asociando con cada candidato?",
  "¿Qué historia tuvo mayor amplificación observada?",
  "¿Qué cambió en la presencia mediática frente a la semana anterior?",
  "¿Qué está ocurriendo en un territorio alrededor de un candidato, y por qué?"
];


export default function SentinelAIModule({ proyecto }) {
  return (
    <div className="sentinel-fade" style={{ maxWidth: "980px" }}>
      <header style={{ marginBottom: "18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <Sparkles size={19} style={{ color: "var(--sentinel-cyan)" }} />

          <h1
            style={{
              margin: 0,
              fontSize: "1.2rem",
              color: "var(--sentinel-texto)",
              letterSpacing: "0.01em"
            }}
          >
            Sentinel AI
          </h1>

          <EstadoChip estado="EN_PREPARACION" />
        </div>

        <p
          style={{
            margin: "8px 0 0",
            fontSize: "0.8rem",
            color: "var(--sentinel-texto-suave)",
            maxWidth: "760px",
            lineHeight: 1.6
          }}
        >
          Responderá preguntas en lenguaje natural cruzando candidato, territorio, medios,
          tiempo y evidencia — siempre con la evidencia enlazada. Todavía no está
          conectado, y esta pantalla no simula respuestas.
        </p>
      </header>

      {/* --- LA CAJA, DESACTIVADA A PROPOSITO --- */}
      <div style={{ ...CAJA, marginBottom: "14px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 14px",
            background: "var(--sentinel-surface-alta)",
            border: "1px dashed var(--sentinel-borde-vivo)",
            borderRadius: "var(--radio-s, 8px)"
          }}
        >
          <Lock size={14} style={{ color: "var(--sentinel-texto-tenue)", flexShrink: 0 }} />

          <input
            disabled
            placeholder="Pregúntale a Sentinel…"
            aria-label="Consulta a Sentinel AI (no disponible todavía)"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              color: "var(--sentinel-texto-tenue)",
              fontSize: "0.86rem",
              cursor: "not-allowed"
            }}
          />
        </div>

        <p
          style={{
            margin: "10px 0 0",
            fontSize: "0.7rem",
            color: "var(--sentinel-texto-tenue)",
            lineHeight: 1.55
          }}
        >
          La caja está desactivada porque no hay motor detrás. Una respuesta plausible sin
          datos que la sostengan es peor que ninguna: se cita, y no se puede auditar.
        </p>
      </div>

      {/* --- LOS EJES --- */}
      <div style={{ ...CAJA, marginBottom: "14px" }}>
        <div
          style={{
            fontSize: "0.66rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--sentinel-cyan)",
            fontWeight: 600,
            marginBottom: "12px"
          }}
        >
          Qué haría falta cruzar
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {EJES.map((e) => (
              <tr key={e.eje}>
                <td
                  style={{
                    padding: "7px 10px 7px 0",
                    fontSize: "0.8rem",
                    fontWeight: 650,
                    color: "var(--sentinel-texto)",
                    width: "130px",
                    borderBottom: "1px solid rgba(20,41,94,.5)"
                  }}
                >
                  {e.eje}
                </td>

                <td
                  style={{
                    padding: "7px 10px",
                    borderBottom: "1px solid rgba(20,41,94,.5)",
                    width: "220px"
                  }}
                >
                  <EstadoChip estado={e.estado} compacto />
                </td>

                <td
                  style={{
                    padding: "7px 0 7px 10px",
                    fontSize: "0.72rem",
                    color: "var(--sentinel-texto-suave)",
                    borderBottom: "1px solid rgba(20,41,94,.5)"
                  }}
                >
                  {e.nota}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- LAS PREGUNTAS --- */}
      <div style={CAJA}>
        <div
          style={{
            fontSize: "0.66rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--sentinel-cyan)",
            fontWeight: 600,
            marginBottom: "10px"
          }}
        >
          Preguntas que tendrá que poder responder
        </div>

        <ul
          style={{
            margin: 0,
            paddingLeft: "18px",
            fontSize: "0.78rem",
            color: "var(--sentinel-texto-suave)",
            lineHeight: 1.8
          }}
        >
          {PREGUNTAS.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>

        <p
          style={{
            margin: "14px 0 0",
            fontSize: "0.68rem",
            color: "var(--sentinel-texto-tenue)",
            lineHeight: 1.55,
            borderTop: "1px solid var(--sentinel-borde)",
            paddingTop: "10px"
          }}
        >
          Estas preguntas son el contrato de diseño del workspace
          {proyecto ? ` de ${proyecto.nombre}` : ""}: si un módulo no puede alimentarlas,
          está mal cortado aunque se vea bien.
        </p>
      </div>
    </div>
  );
}
