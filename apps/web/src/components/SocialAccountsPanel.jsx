// apps/web/src/components/SocialAccountsPanel.jsx

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Users,
  AlertTriangle
} from "lucide-react";

import ConfidenceExplainabilityPanel from "./ConfidenceExplainabilityPanel";

/*
===========================================================
SOCIAL ACCOUNTS PANEL
===========================================================

Cuentas candidatas descubiertas por el Social Intelligence
Layer, con su correspondencia. Cada tarjeta se despliega en
el desglose completo de la puntuación.

Presenta también la COBERTURA por plataforma, distinguiendo
tres situaciones que no son lo mismo:

  · inferida        se encontró presencia (no se leyó el perfil)
  · ausencia        se buscó y no se encontró
  · no_comprobada   no se buscó

Ocultar esa distinción haría creer que la ausencia de
resultado es ausencia de cuenta.
===========================================================
*/

const COLOR_PLATAFORMA = {
  Facebook: "#3987e5",
  Instagram: "#d55181",
  TikTok: "#c98500",
  X: "#94A3B8",
  YouTube: "#d03b3b",
  LinkedIn: "#3987e5"
};

const COLOR_NIVEL = {
  muy_alta: "#22C55E",
  alta: "#22C55E",
  media: "#F59E0B",
  baja: "#F97316",
  insuficiente: "#64748B"
};

const ETIQUETA_PRESENCIA = {
  inferida: { texto: "presencia inferida", color: "#60A5FA" },
  perfil_leido: { texto: "perfil leído", color: "#22C55E" },
  ausencia: { texto: "sin presencia", color: "#64748B" },
  no_comprobada: { texto: "no comprobada", color: "#F59E0B" }
};

const caja = {
  background: "#08142F",
  border: "1px solid #1E3A8A",
  borderRadius: "14px",
  padding: "16px",
  boxSizing: "border-box"
};

const etiquetaSeccion = {
  color: "#60A5FA",
  fontSize: "10px",
  letterSpacing: "2px",
  textTransform: "uppercase",
  marginBottom: "10px"
};

export default function SocialAccountsPanel({
  cuentas = [],
  cobertura = [],
  limites = null,
  metricas = null
}) {
  const [abierta, setAbierta] = useState(null);

  if (!Array.isArray(cuentas)) return null;

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
          marginBottom: "6px",
          flexWrap: "wrap"
        }}
      >
        <Users size={24} color="#60A5FA" style={{ flexShrink: 0 }} />

        <h2 style={{ margin: 0, color: "#FFFFFF", fontSize: "22px" }}>
          Cuentas candidatas
        </h2>

        {metricas && (
          <span
            style={{
              marginLeft: "auto",
              color: "#93C5FD",
              fontSize: "12px",
              border: "1px solid #1E3A8A",
              borderRadius: "999px",
              padding: "5px 14px"
            }}
          >
            {metricas.cuentasCandidatas} candidatas ·{" "}
            {metricas.cuentasProbables} probables
            {metricas.fichasFusionadas != null
              ? ` · ${metricas.fichasFusionadas} fusionadas`
              : ""}
          </span>
        )}
      </div>

      <p style={{ margin: "0 0 18px 0", color: "#94A3B8", fontSize: "13px" }}>
        Descubiertas desde el Perfil de Referencia. Ninguna es una identidad
        confirmada: la confirmación es competencia del analista.
      </p>

      {/* LÍMITE DEL SPRINT */}

      {limites?.sinPlatformScanner && (
        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "flex-start",
            background: "rgba(245,158,11,.08)",
            border: "1px solid #92400E",
            borderRadius: "12px",
            padding: "12px 14px",
            marginBottom: "20px"
          }}
        >
          <AlertTriangle
            size={17}
            color="#F59E0B"
            style={{ flexShrink: 0, marginTop: "2px" }}
          />
          <div style={{ color: "#FCD34D", fontSize: "12px", lineHeight: 1.55 }}>
            <div>{limites.sinPlatformScanner}</div>
            {limites.senalesPendientes && (
              <div style={{ marginTop: "4px" }}>{limites.senalesPendientes}</div>
            )}
          </div>
        </div>
      )}

      {/* COBERTURA POR PLATAFORMA */}

      {cobertura.length > 0 && (
        <div style={{ ...caja, marginBottom: "18px" }}>
          <div style={etiquetaSeccion}>Cobertura por plataforma</div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "10px"
            }}
          >
            {cobertura.map((c) => {
              const est = ETIQUETA_PRESENCIA[c.estadoPresencia] || {
                texto: c.estadoPresencia,
                color: "#64748B"
              };

              return (
                <div
                  key={c.plataformaId}
                  style={{
                    border: `1px solid ${
                      COLOR_PLATAFORMA[c.plataforma] || "#1E3A8A"
                    }`,
                    borderRadius: "10px",
                    padding: "10px 12px"
                  }}
                >
                  <div
                    style={{
                      color: COLOR_PLATAFORMA[c.plataforma] || "#60A5FA",
                      fontSize: "13px",
                      marginBottom: "4px"
                    }}
                  >
                    {c.plataforma}
                  </div>

                  <div style={{ color: "#E2E8F0", fontSize: "16px" }}>
                    {c.candidatos}
                  </div>

                  <div style={{ color: est.color, fontSize: "10px", marginTop: "3px" }}>
                    {est.texto}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CUENTAS */}

      {cuentas.length === 0 ? (
        <div style={{ ...caja, color: "#64748B", fontSize: "13px" }}>
          No se descubrieron cuentas candidatas en esta investigación.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {cuentas.map((cuenta) => {
            const c = cuenta.correspondencia;

            const color = c ? COLOR_NIVEL[c.nivel] || "#64748B" : "#64748B";

            const estaAbierta = abierta === cuenta.id;

            return (
              <div
                key={cuenta.id}
                style={{
                  ...caja,
                  borderColor: estaAbierta ? color : "#1E3A8A"
                }}
              >
                {/* FILA PRINCIPAL */}

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    flexWrap: "wrap"
                  }}
                >
                  <span
                    style={{
                      color: COLOR_PLATAFORMA[cuenta.plataforma] || "#60A5FA",
                      fontSize: "12px",
                      letterSpacing: "1px",
                      minWidth: "82px"
                    }}
                  >
                    {cuenta.plataforma}
                  </span>

                  <strong
                    style={{
                      color: "#FFFFFF",
                      fontSize: "15px",
                      wordBreak: "break-all"
                    }}
                  >
                    @{cuenta.handle}
                  </strong>

                  {c && (
                    <>
                      <span
                        style={{
                          color,
                          fontSize: "18px",
                          fontFamily: "monospace"
                        }}
                      >
                        {c.puntuacion}
                        <span style={{ color: "#64748B", fontSize: "12px" }}>/100</span>
                      </span>

                      <span style={{ color: "#CBD5E1", fontSize: "12px" }}>
                        {c.etiqueta}
                      </span>
                    </>
                  )}

                  <span
                    style={{
                      marginLeft: "auto",
                      display: "flex",
                      gap: "10px",
                      alignItems: "center"
                    }}
                  >
                    {cuenta.url && (
                      <a
                        href={cuenta.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          color: "#60A5FA",
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                          fontSize: "12px",
                          textDecoration: "none"
                        }}
                      >
                        <ExternalLink size={13} />
                        abrir
                      </a>
                    )}

                    <button
                      onClick={() => setAbierta(estaAbierta ? null : cuenta.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        background: "transparent",
                        border: `1px solid ${color}`,
                        borderRadius: "999px",
                        color: "#93C5FD",
                        padding: "6px 14px",
                        cursor: "pointer",
                        fontSize: "12px"
                      }}
                    >
                      {estaAbierta ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      {estaAbierta ? "ocultar" : "por qué"}
                    </button>
                  </span>
                </div>

                {/* METADATOS */}

                <div
                  style={{
                    display: "flex",
                    gap: "16px",
                    flexWrap: "wrap",
                    marginTop: "10px",
                    color: "#64748B",
                    fontSize: "11px"
                  }}
                >
                  <span>
                    calidad del dato:{" "}
                    <strong style={{ color: "#93C5FD" }}>
                      {cuenta.calidad?.nivel || "—"}
                    </strong>
                  </span>

                  <span>
                    corroboración:{" "}
                    <strong style={{ color: "#93C5FD" }}>
                      {cuenta.corroboracion?.totalProveedores || 0} proveedor(es)
                    </strong>
                  </span>

                  <span>
                    orígenes:{" "}
                    <strong style={{ color: "#93C5FD" }}>
                      {(cuenta.origenes || []).length}
                    </strong>
                  </span>

                  {cuenta.hash && (
                    <span style={{ fontFamily: "monospace" }}>
                      hash {cuenta.hash.slice(0, 10)}…
                    </span>
                  )}
                </div>

                {/* DESGLOSE */}

                {estaAbierta && (
                  <div style={{ marginTop: "18px" }}>
                    <ConfidenceExplainabilityPanel correspondencia={c} />

                    {/* LINAJE */}

                    {cuenta.linaje && (
                      <div style={{ ...caja, marginTop: "14px" }}>
                        <div style={etiquetaSeccion}>Linaje</div>

                        <div style={{ color: "#94A3B8", fontSize: "12px" }}>
                          {(cuenta.linaje.submotoresImplicados || []).join(" → ")}
                        </div>

                        {(cuenta.linaje.cadena || []).map((paso, i) => (
                          <div
                            key={i}
                            style={{
                              color: "#64748B",
                              fontSize: "11px",
                              marginTop: "6px"
                            }}
                          >
                            <strong style={{ color: "#93C5FD" }}>{paso.via}</strong>
                            {paso.proveedor ? ` · ${paso.proveedor}` : ""}
                            {paso.consulta ? ` · «${paso.consulta}»` : ""}
                          </div>
                        ))}

                        <div
                          style={{
                            color: "#64748B",
                            fontSize: "11px",
                            marginTop: "8px"
                          }}
                        >
                          modo de acceso:{" "}
                          <strong style={{ color: "#FCD34D" }}>
                            {cuenta.modoAcceso}
                          </strong>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
