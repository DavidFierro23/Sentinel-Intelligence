// apps/web/src/components/IdentityCorrelationPanel.jsx

import {
  ShieldCheck,
  ExternalLink,
  Sparkles
} from "lucide-react";

const coloresPlataforma = {
  Facebook: "#1877F2",
  Instagram: "#E1306C",
  X: "#64748B",
  Twitter: "#1DA1F2",
  TikTok: "#25F4EE",
  LinkedIn: "#0A66C2",
  YouTube: "#FF0000"
};

const letrasPlataforma = {
  Facebook: "f",
  Instagram: "◎",
  X: "X",
  Twitter: "𝕏",
  TikTok: "♪",
  LinkedIn: "in",
  YouTube: "▶"
};

function obtenerColor(plataforma) {
  return coloresPlataforma[plataforma] || "#60A5FA";
}

function obtenerLetra(plataforma) {
  return letrasPlataforma[plataforma] || "?";
}

export default function IdentityCorrelationPanel({
  identidades = []
}) {
  if (!Array.isArray(identidades) || identidades.length === 0) {
    return null;
  }

  return (
    <section
      style={{
        width: "100%",
        boxSizing: "border-box",
        marginTop: "28px",
        marginBottom: "28px",
        background: "#0B1738",
        border: "1px solid #1E3A8A",
        borderRadius: "20px",
        padding: "24px",
        overflow: "hidden"
      }}
    >
      {/* CABECERA */}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "8px"
        }}
      >
        <Sparkles
          size={24}
          color="#60A5FA"
          style={{ flexShrink: 0 }}
        />

        <h2
          style={{
            margin: 0,
            color: "#FFFFFF",
            fontSize: "22px",
            lineHeight: 1.2
          }}
        >
          Identity Correlation Engine
        </h2>
      </div>

      <p
        style={{
          margin: "0 0 22px 0",
          color: "#94A3B8",
          fontSize: "14px"
        }}
      >
        Perfiles y cuentas detectados durante la investigación.
      </p>

      {/* TARJETAS */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "16px",
          width: "100%"
        }}
      >
        {identidades.map((item, index) => {
          const plataforma = item.plataforma || "Web";
          const color = obtenerColor(plataforma);
          const letra = obtenerLetra(plataforma);

          const confianza = Math.max(
            0,
            Math.min(100, Number(item.confianza) || 0)
          );

          return (
            <article
              key={`${plataforma}-${item.usuario || index}-${index}`}
              style={{
                minWidth: 0,
                boxSizing: "border-box",
                background: "#08142F",
                border: `1px solid ${color}`,
                borderRadius: "16px",
                padding: "18px",
                overflow: "hidden"
              }}
            >
              {/* PLATAFORMA */}

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                  marginBottom: "16px"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    minWidth: 0
                  }}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      minWidth: "40px",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: color,
                      color:
                        plataforma === "TikTok"
                          ? "#06111F"
                          : "#FFFFFF",
                      fontWeight: "800",
                      fontSize:
                        plataforma === "LinkedIn"
                          ? "15px"
                          : "20px"
                    }}
                  >
                    {letra}
                  </div>

                  <strong
                    style={{
                      color: "#FFFFFF",
                      fontSize: "16px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {plataforma}
                  </strong>
                </div>

                <ShieldCheck
                  size={20}
                  color={
                    item.verificado
                      ? "#22C55E"
                      : "#64748B"
                  }
                  style={{ flexShrink: 0 }}
                />
              </div>

              {/* USUARIO */}

              <div
                style={{
                  marginBottom: "14px"
                }}
              >
                <div
                  style={{
                    color: "#60A5FA",
                    fontSize: "17px",
                    fontWeight: "700",
                    wordBreak: "break-word"
                  }}
                >
                  {item.usuario
                    ? `@${item.usuario}`
                    : "Identidad detectada"}
                </div>

                <div
                  style={{
                    marginTop: "6px",
                    color: "#94A3B8",
                    fontSize: "12px"
                  }}
                >
                  Origen: {item.origen || "Fusion Engine"}
                </div>
              </div>

              {/* CONFIANZA */}

              <div
                style={{
                  marginBottom: "14px"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "7px",
                    color: "#CBD5E1",
                    fontSize: "13px"
                  }}
                >
                  <span>Confianza</span>

                  <strong
                    style={{
                      color: "#FFFFFF"
                    }}
                  >
                    {confianza}%
                  </strong>
                </div>

                <div
                  style={{
                    width: "100%",
                    height: "7px",
                    background: "#1E293B",
                    borderRadius: "999px",
                    overflow: "hidden"
                  }}
                >
                  <div
                    style={{
                      width: `${confianza}%`,
                      height: "100%",
                      background: color,
                      borderRadius: "999px",
                      transition: "width 0.3s ease"
                    }}
                  />
                </div>
              </div>

              {/* EVIDENCIAS */}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 0",
                  borderTop: "1px solid #1E293B",
                  borderBottom: "1px solid #1E293B",
                  marginBottom: "14px",
                  color: "#CBD5E1",
                  fontSize: "13px"
                }}
              >
                <span>Evidencias</span>

                <strong
                  style={{
                    color: "#FFFFFF"
                  }}
                >
                  {item.evidencias || 1}
                </strong>
              </div>

              {/* BOTÓN */}

              {item.enlace && (
                <a
                  href={item.enlace}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    background: color,
                    color:
                      plataforma === "TikTok"
                        ? "#06111F"
                        : "#FFFFFF",
                    textDecoration: "none",
                    fontSize: "13px",
                    fontWeight: "700"
                  }}
                >
                  <ExternalLink size={16} />
                  Abrir perfil
                </a>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}