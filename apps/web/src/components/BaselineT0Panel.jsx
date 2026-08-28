import { AlertTriangle, Info } from "lucide-react";

import CandidatePhoto from "./CandidatePhoto";

/*
===========================================================
LINEA BASE DIGITAL T0 — P-CAND-BENCH-01
===========================================================

Lo que Sentinel observo en un momento concreto. No es un
ranking, no hay ganador y no hay una cifra unica por candidato.

LO QUE ESTA PANTALLA SE PROHIBE

    NO sumar vistas de X con vistas de YouTube.
    NO rellenar un hueco con 0.
    NO promediar repost con publicaciones propias.
    NO ordenar por «quien va ganando».

Las columnas van POR PLATAFORMA a proposito. Una impresion de X
y una reproduccion de YouTube no miden lo mismo, asi que no
comparten celda ni total.
===========================================================
*/

const caja = {
  background: "var(--sentinel-surface)",
  border: "1px solid var(--sentinel-borde)",
  borderRadius: "var(--radio-m)",
  padding: "13px 15px"
};

const pill = (color) => ({
  color,
  border: `1px solid ${color}`,
  borderRadius: "var(--radio-pill)",
  padding: "2px 8px",
  fontSize: "9px",
  whiteSpace: "nowrap"
});

const tenue = {
  color: "var(--sentinel-texto-tenue)",
  fontSize: "10px",
  lineHeight: 1.7
};

const TONO_COMPARABILIDAD = {
  COMPARABLE: "#22C55E",
  PARCIALMENTE_COMPARABLE: "#F59E0B",
  NO_COMPARABLE: "var(--sentinel-texto-tenue)"
};

/*
  Un hueco NO es un cero. Se dibuja distinto a proposito: si un
  candidato sin cuenta de YouTube mostrara «0 suscriptores», eso
  seria un dato falso sobre esa persona.
*/
function Celda({ valor, titulo }) {
  const vacio = valor === null || valor === undefined;

  return (
    <td
      title={titulo}
      style={{
        padding: "7px 8px",
        textAlign: "right",
        fontFamily: "monospace",
        fontSize: "11px",
        color: vacio ? "var(--sentinel-texto-tenue)" : "#FFFFFF",
        whiteSpace: "nowrap"
      }}
    >
      {vacio ? "—" : valor.toLocaleString("es-EC")}
    </td>
  );
}

const th = {
  padding: "7px 8px",
  textAlign: "right",
  color: "var(--sentinel-texto-suave)",
  fontSize: "9.5px",
  fontWeight: 500,
  whiteSpace: "nowrap",
  borderBottom: "1px solid var(--sentinel-borde)"
};


export default function BaselineT0Panel({ datos, onCerrar }) {
  if (!datos) return null;

  const filas = datos.candidatos || [];

  return (
    <div style={{ marginTop: "18px" }}>
      {/* LA ADVERTENCIA VA PRIMERA, NO AL PIE. */}
      <div
        style={{
          ...caja,
          borderColor: "#FCD34D",
          color: "#FCD34D",
          fontSize: "10.5px",
          lineHeight: 1.7,
          display: "flex",
          gap: "9px",
          alignItems: "flex-start",
          marginBottom: "10px"
        }}
      >
        <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: "2px" }} />
        <span>{datos.advertencia}</span>
      </div>

      <div style={{ ...caja, padding: "0", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left" }}>Candidato</th>

              <th style={th} title="Seguidores en X">X segs</th>
              <th style={th} title="Publicaciones observadas en X">X pub</th>
              <th style={th} title="De ellas, originales">orig</th>
              <th style={th} title="De ellas, republicaciones">rep</th>
              <th style={th} title="Vistas de las publicaciones ORIGINALES en X">X vistas</th>
              <th style={th} title="Me gusta de las publicaciones ORIGINALES en X">X likes</th>

              <th style={th} title="Suscriptores de YouTube">YT subs</th>
              <th style={th} title="Vídeos observados">YT víd</th>
              <th style={th} title="Reproducciones observadas en YouTube">YT vistas</th>

              <th style={{ ...th, textAlign: "center" }}>Cobertura</th>
            </tr>
          </thead>

          <tbody>
            {filas.map((c) => {
              const x = c.plataformas?.x || null;

              const y = c.plataformas?.youtube || null;

              return (
                <tr key={c.candidateId} style={{ borderTop: "1px solid var(--sentinel-borde)" }}>
                  <td style={{ padding: "7px 8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                      <CandidatePhoto
                        foto={c.foto || null}
                        nombre={c.nombre}
                        tamano={30}
                        radio="50%"
                      />

                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: "#FFFFFF", fontSize: "11.5px" }}>
                          {c.nombre}
                        </div>

                        <div
                          style={{
                            ...tenue,
                            color: TONO_COMPARABILIDAD[c.comparabilidad?.estado]
                          }}
                          title={c.comparabilidad?.motivo}
                        >
                          {c.comparabilidad?.estado?.toLowerCase().replace(/_/g, " ")}
                        </div>
                      </div>
                    </div>
                  </td>

                  <Celda valor={x?.cuenta?.followers} titulo="Seguidores en X" />
                  <Celda valor={x?.publicacionesObservadas} />
                  <Celda
                    valor={x?.porTipo?.originales}
                    titulo={x?.tipoIndeterminado?.efecto}
                  />
                  <Celda valor={x?.porTipo?.reposts} />
                  <Celda
                    valor={x?.rendimientoDeOriginales?.viewsTotal}
                    titulo={x?.rendimientoDeOriginales?.nota}
                  />
                  <Celda
                    valor={x?.rendimientoDeOriginales?.likesTotal}
                    titulo={x?.rendimientoDeOriginales?.nota}
                  />

                  <Celda valor={y?.cuenta?.followers} titulo="Suscriptores" />
                  <Celda valor={y?.publicacionesObservadas} />
                  <Celda valor={y?.rendimientoDeOriginales?.viewsTotal} />

                  <td style={{ padding: "7px 8px", textAlign: "center" }}>
                    <span
                      style={pill(
                        c.cobertura?.medidas >= 2
                          ? "#22C55E"
                          : c.cobertura?.medidas === 1
                            ? "#F59E0B"
                            : "var(--sentinel-texto-tenue)"
                      )}
                      title={c.cobertura?.noEs}
                    >
                      {c.cobertura?.medidas}/{c.cobertura?.objetivo}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/*
        Por que las columnas no se suman. Va visible, no en un
        tooltip: es la diferencia entre una tabla honesta y una
        que invita a inventar una audiencia.
      */}
      <div style={{ ...tenue, marginTop: "9px" }}>
        Las columnas de X y de YouTube no se suman: una impresión de X y una
        reproducción de YouTube no miden lo mismo. Un «—» significa que no hay
        dato, no que valga cero.
      </div>

      {/* Observaciones POR PLATAFORMA. Nunca un ganador global. */}
      {(datos.observaciones || []).map((o) => (
        <div
          key={o.plataformaId}
          style={{ ...caja, marginTop: "9px", display: "flex", gap: "9px" }}
        >
          <Info size={13} style={{ flexShrink: 0, marginTop: "2px", color: "var(--sentinel-cyan)" }} />

          <div>
            <div style={{ color: "var(--sentinel-texto)", fontSize: "11px", lineHeight: 1.7 }}>
              {o.lectura}
            </div>

            <div style={{ ...tenue, marginTop: "4px" }}>{o.noEs}</div>
          </div>
        </div>
      ))}

      {/* Estado histórico: T0 no tiene contra qué compararse. */}
      <div style={{ ...caja, marginTop: "9px" }}>
        <div style={{ color: "var(--sentinel-texto-suave)", fontSize: "10.5px" }}>
          Estado histórico ·{" "}
          <span style={{ fontFamily: "monospace" }}>{datos.momentum?.estado}</span>
        </div>

        <div style={{ ...tenue, marginTop: "5px" }}>{datos.momentum?.motivo}</div>
      </div>

      <div style={{ display: "flex", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
        <div style={tenue}>
          {datos.resumen?.candidatos} candidatos ·{" "}
          {datos.resumen?.comparables} comparables ·{" "}
          {datos.resumen?.parcialmenteComparables} parcialmente ·{" "}
          {datos.resumen?.noComparables} no comparables
        </div>

        {onCerrar && (
          <button
            className="sentinel-boton"
            onClick={onCerrar}
            style={{ marginLeft: "auto", fontSize: "10.5px", padding: "4px 10px" }}
          >
            Ocultar
          </button>
        )}
      </div>
    </div>
  );
}
