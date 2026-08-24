import { useState } from "react";
import { Users, MapPin, ExternalLink, AlertTriangle } from "lucide-react";

/*
===========================================================
POSIBLES IDENTIDADES — ARQ-INV-003, modo individual
===========================================================

Cuando un nombre lo comparten varias personas, este panel las
separa y NO elige. La elección es del analista, que para eso
tiene «Investigar esta identidad».

La confianza que se muestra no es confianza de identidad: es la
cuota de evidencia que sostiene cada grupo. El propio panel lo
dice, porque un porcentaje junto a un nombre invita a leerlo
como «probabilidad de ser esta persona», y no lo es.
===========================================================
*/

const caja = {
  background: "var(--sentinel-surface)",
  border: "1px solid var(--sentinel-borde)",
  borderRadius: "var(--radio-m)",
  padding: "16px",
  boxSizing: "border-box"
};

export default function PlausibleIdentitiesPanel({
  identidades,
  onInvestigarIdentidad = null
}) {
  const [abierta, setAbierta] = useState(null);

  if (!identidades) return null;

  /*
    Con una sola identidad no se monta el panel: no habría nada
    que separar y sugeriría una ambigüedad que no existe.
  */
  if (!identidades.variasIdentidades) {
    if (!identidades.suficienteEvidencia) {
      return (
        <section
          className="sentinel-fade"
          style={{
            ...caja,
            marginTop: "28px",
            display: "flex",
            gap: "11px",
            alignItems: "flex-start"
          }}
        >
          <AlertTriangle
            size={17}
            color="#FCD34D"
            style={{ flexShrink: 0, marginTop: "2px" }}
          />

          <div>
            <strong style={{ color: "#FCD34D", fontSize: "13px" }}>
              No se pudieron separar identidades
            </strong>

            <p
              style={{
                color: "var(--sentinel-texto-suave)",
                fontSize: "11.5px",
                lineHeight: 1.7,
                margin: "6px 0 0 0"
              }}
            >
              {identidades.motivo || identidades.diagnostico}
            </p>
          </div>
        </section>
      );
    }

    return null;
  }

  return (
    <section
      className="sentinel-fade"
      style={{
        width: "100%",
        boxSizing: "border-box",
        marginTop: "28px",
        background: "var(--sentinel-primary)",
        border: "1px solid #78350F",
        borderRadius: "var(--radio-l)",
        padding: "22px"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "11px",
          flexWrap: "wrap",
          marginBottom: "6px"
        }}
      >
        <Users size={20} color="#FCD34D" />

        <h2 style={{ margin: 0, color: "#FFFFFF", fontSize: "18px" }}>
          Se detectaron posibles identidades
        </h2>

        <span
          style={{
            color: "#FCD34D",
            fontSize: "10.5px",
            border: "1px solid #78350F",
            borderRadius: "var(--radio-pill)",
            padding: "3px 11px"
          }}
        >
          {identidades.identidades.length} grupos · evidencias sin mezclar
        </span>
      </div>

      <p
        style={{
          color: "var(--sentinel-texto-suave)",
          fontSize: "12px",
          lineHeight: 1.7,
          margin: "0 0 18px 0"
        }}
      >
        {identidades.diagnostico}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "12px"
        }}
      >
        {identidades.identidades.map((i) => {
          const abierto = abierta === i.id;

          return (
            <div
              key={i.id}
              style={{
                ...caja,
                borderLeft: `3px solid ${
                  i.territorio ? "var(--sentinel-cyan)" : "var(--sentinel-gray)"
                }`
              }}
            >
              <div style={{ color: "#FFFFFF", fontSize: "15px", fontWeight: 600 }}>
                {i.nombre}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  color: i.territorio
                    ? "var(--sentinel-cyan)"
                    : "var(--sentinel-texto-tenue)",
                  fontSize: "12px",
                  marginTop: "5px"
                }}
              >
                <MapPin size={12} />
                {i.territorio || "territorio no comprobado"}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "16px",
                  marginTop: "13px",
                  alignItems: "baseline"
                }}
              >
                <div>
                  <div
                    style={{
                      color: "#FFFFFF",
                      fontSize: "21px",
                      fontFamily: "monospace",
                      lineHeight: 1
                    }}
                  >
                    {i.confianza}%
                  </div>

                  <div
                    style={{
                      color: "var(--sentinel-texto-tenue)",
                      fontSize: "9.5px",
                      marginTop: "3px"
                    }}
                  >
                    cuota de evidencia
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      color: "#FFFFFF",
                      fontSize: "21px",
                      fontFamily: "monospace",
                      lineHeight: 1
                    }}
                  >
                    {i.evidencias}
                  </div>

                  <div
                    style={{
                      color: "var(--sentinel-texto-tenue)",
                      fontSize: "9.5px",
                      marginTop: "3px"
                    }}
                  >
                    evidencias
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  flexWrap: "wrap",
                  marginTop: "13px"
                }}
              >
                {i.terminosDistintivos.slice(0, 6).map((t) => (
                  <span
                    key={t}
                    style={{
                      color: "var(--sentinel-texto-suave)",
                      fontSize: "10.5px",
                      border: "1px solid var(--sentinel-borde)",
                      borderRadius: "var(--radio-pill)",
                      padding: "2px 9px"
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>

              <div
                style={{
                  color: "var(--sentinel-texto-tenue)",
                  fontSize: "10px",
                  marginTop: "11px",
                  lineHeight: 1.6
                }}
              >
                {i.senalTerritorial}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  marginTop: "14px",
                  flexWrap: "wrap"
                }}
              >
                <button
                  className="sentinel-boton"
                  onClick={() => setAbierta(abierto ? null : i.id)}
                  style={{ padding: "6px 13px", fontSize: "11px" }}
                >
                  {abierto ? "ocultar evidencia" : "Ver identidad"}
                </button>

                {onInvestigarIdentidad && (
                  <button
                    className="sentinel-boton sentinel-boton-primario"
                    onClick={() => onInvestigarIdentidad(i)}
                    style={{ padding: "6px 13px", fontSize: "11px" }}
                    title="Reinvestiga usando únicamente los términos de esta identidad"
                  >
                    Investigar esta identidad
                  </button>
                )}
              </div>

              {abierto && (
                <div
                  className="sentinel-fade"
                  style={{
                    marginTop: "13px",
                    paddingTop: "11px",
                    borderTop: "1px solid var(--sentinel-borde)"
                  }}
                >
                  <div
                    style={{
                      color: "var(--sentinel-cyan)",
                      fontSize: "9.5px",
                      letterSpacing: "1.4px",
                      textTransform: "uppercase",
                      marginBottom: "8px"
                    }}
                  >
                    Evidencia de este grupo
                  </div>

                  {i.titulares.map((t, n) => (
                    <div
                      key={n}
                      style={{
                        color: "var(--sentinel-texto-suave)",
                        fontSize: "11px",
                        lineHeight: 1.6,
                        marginBottom: "5px"
                      }}
                    >
                      · {t}
                    </div>
                  ))}

                  <div
                    style={{
                      color: "var(--sentinel-texto-tenue)",
                      fontSize: "10px",
                      marginTop: "9px"
                    }}
                  >
                    dominios: {i.dominios.join(", ")}
                  </div>

                  {i.urls?.length > 0 && (
                    <a
                      href={i.urls[0]}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        color: "#60A5FA",
                        fontSize: "10.5px",
                        marginTop: "8px",
                        textDecoration: "none"
                      }}
                    >
                      <ExternalLink size={11} />
                      abrir la primera evidencia
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* LÍMITES */}

      <div
        style={{
          color: "var(--sentinel-texto-tenue)",
          fontSize: "10px",
          lineHeight: 1.75,
          marginTop: "16px",
          paddingTop: "12px",
          borderTop: "1px solid var(--sentinel-borde)"
        }}
      >
        {Object.values(identidades.limites || {})
          .filter(Boolean)
          .map((t, n) => (
            <div key={n}>{t}</div>
          ))}
      </div>
    </section>
  );
}
