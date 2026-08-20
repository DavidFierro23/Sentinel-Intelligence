// apps/web/src/components/ReferenceProfilePanel.jsx

import { useState } from "react";
import {
  Fingerprint,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertTriangle
} from "lucide-react";

/*
===========================================================
REFERENCE PROFILE PANEL

Muestra el PERFIL DE REFERENCIA construido a partir del
descubrimiento general.

Reglas de presentación:

- Si no hay perfil, no renderiza nada (igual que
  IdentityCorrelationPanel). El flujo actual no se rompe.
- Toda señal muestra las FUENTES que la respaldan.
- Los handles se presentan como OBSERVADOS, no verificados.
===========================================================
*/

const coloresPlataforma = {
  Facebook: "#1877F2",
  Instagram: "#E1306C",
  X: "#94A3B8",
  Twitter: "#1DA1F2",
  TikTok: "#25F4EE",
  LinkedIn: "#0A66C2",
  YouTube: "#FF0000",
  Wikipedia: "#CBD5E1",
  Wayback: "#8B5CF6"
};

function colorNivel(nivel) {
  if (nivel === "alta") return "#22C55E";
  if (nivel === "media") return "#F59E0B";
  if (nivel === "baja") return "#F97316";
  return "#64748B";
}

const caja = {
  background: "#08142F",
  border: "1px solid #1E3A8A",
  borderRadius: "16px",
  padding: "18px",
  boxSizing: "border-box"
};

const etiquetaSeccion = {
  color: "#60A5FA",
  fontSize: "11px",
  letterSpacing: "2px",
  marginBottom: "12px",
  textTransform: "uppercase"
};

function Chip({ texto, detalle, color = "#1E3A8A" }) {
  return (
    <span
      title={detalle}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        border: `1px solid ${color}`,
        borderRadius: "999px",
        padding: "6px 12px",
        fontSize: "13px",
        color: "#E2E8F0",
        background: "rgba(37,99,235,.08)"
      }}
    >
      {texto}
      {detalle && (
        <span style={{ color: "#64748B", fontSize: "11px" }}>{detalle}</span>
      )}
    </span>
  );
}

export default function ReferenceProfilePanel({ perfil }) {
  const [abierto, setAbierto] = useState(false);

  if (!perfil || typeof perfil !== "object") return null;

  const confianza = perfil.confianza || {};
  const contexto = perfil.contexto || {};
  const variantes = perfil.variantes || {};

  const terminos = perfil.terminosDiscriminantes || [];
  const handles = perfil.handlesObservados || [];
  const plataformas = perfil.plataformasDetectadas || [];
  const dominios = perfil.dominiosRelevantes || [];
  const atributos = perfil.atributos || [];
  const evidencias = perfil.evidencias || [];
  const componentes = confianza.componentes || [];

  const nivel = confianza.nivel || "insuficiente";
  const global = Number(confianza.global) || 0;

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
        <Fingerprint size={24} color="#60A5FA" style={{ flexShrink: 0 }} />

        <h2 style={{ margin: 0, color: "#FFFFFF", fontSize: "22px", lineHeight: 1.2 }}>
          Perfil de Referencia
        </h2>

        <span
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            border: `1px solid ${colorNivel(nivel)}`,
            borderRadius: "999px",
            padding: "6px 16px"
          }}
        >
          <strong style={{ color: colorNivel(nivel), fontSize: "18px" }}>
            {global}/100
          </strong>
          <span style={{ color: "#CBD5E1", fontSize: "13px", textTransform: "capitalize" }}>
            sustento {nivel}
          </span>
        </span>
      </div>

      <p style={{ margin: "0 0 6px 0", color: "#94A3B8", fontSize: "14px" }}>
        Base de identidad destilada del descubrimiento general. Alimentará al
        Fusion Engine para dejar de buscar solamente por nombre.
      </p>

      {/* ADVERTENCIA METODOLÓGICA */}

      <div
        style={{
          display: "flex",
          gap: "10px",
          alignItems: "flex-start",
          background: "rgba(245,158,11,.08)",
          border: "1px solid #92400E",
          borderRadius: "12px",
          padding: "12px 14px",
          margin: "16px 0 22px 0"
        }}
      >
        <AlertTriangle size={18} color="#F59E0B" style={{ flexShrink: 0, marginTop: "2px" }} />
        <span style={{ color: "#FCD34D", fontSize: "13px", lineHeight: 1.5 }}>
          {confianza.significado ||
            "Esta puntuación mide el sustento documental del perfil. No afirma la identidad de ninguna cuenta."}
        </span>
      </div>

      {/* IDENTIDAD Y CONTEXTO */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "16px",
          marginBottom: "20px"
        }}
      >
        <div style={caja}>
          <div style={etiquetaSeccion}>Nombre principal</div>

          <div style={{ fontSize: "20px", color: "#FFFFFF", marginBottom: "10px" }}>
            {perfil.nombrePrincipal}
          </div>

          <div style={{ color: "#64748B", fontSize: "12px" }}>
            Tipo detectado: <strong style={{ color: "#93C5FD" }}>{perfil.tipoObjetivo}</strong>
          </div>
        </div>

        <div style={caja}>
          <div style={etiquetaSeccion}>Contexto encontrado</div>

          {contexto.rol || contexto.pais || (contexto.organizaciones || []).length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {contexto.rol && <Chip texto={contexto.rol} color="#2563EB" />}
              {contexto.pais && <Chip texto={contexto.pais} color="#0E7490" />}
              {(contexto.organizaciones || []).slice(0, 3).map((o) => (
                <Chip key={o.valor} texto={o.valor} detalle={`×${o.apariciones}`} />
              ))}
            </div>
          ) : (
            <div style={{ color: "#64748B", fontSize: "13px" }}>
              Sin contexto suficiente en las evidencias.
            </div>
          )}

          {contexto.declaradoPorUsuario && (
            <div style={{ marginTop: "12px", color: "#64748B", fontSize: "12px" }}>
              Declarado por el usuario:{" "}
              <strong style={{ color: "#93C5FD" }}>{contexto.declaradoPorUsuario}</strong>
            </div>
          )}
        </div>

        <div style={caja}>
          <div style={etiquetaSeccion}>Variantes del nombre</div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
            {(variantes.nombre || []).map((v) => (
              <Chip key={v} texto={v} />
            ))}
          </div>

          <div style={etiquetaSeccion}>Variantes de usuario</div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {(variantes.handle || []).map((v) => (
              <Chip key={v} texto={`@${v}`} color="#334155" />
            ))}
          </div>
        </div>
      </div>

      {/* TÉRMINOS DISCRIMINANTES */}

      <div style={{ ...caja, marginBottom: "16px" }}>
        <div style={etiquetaSeccion}>
          Términos discriminantes · para distinguir homónimos
        </div>

        {terminos.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {terminos.map((t) => (
              <Chip
                key={t.termino}
                texto={t.termino}
                detalle={`×${t.apariciones}`}
                color="#2563EB"
              />
            ))}
          </div>
        ) : (
          <div style={{ color: "#64748B", fontSize: "13px" }}>
            Sin términos recurrentes. El Fusion Engine solo podrá apoyarse en el nombre.
          </div>
        )}
      </div>

      {/* HANDLES OBSERVADOS */}

      <div style={{ ...caja, marginBottom: "16px" }}>
        <div style={etiquetaSeccion}>
          Handles observados · candidatos NO verificados
        </div>

        {handles.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: "12px"
            }}
          >
            {handles.map((h, i) => (
              <div
                key={`${h.plataforma}-${h.handle}-${i}`}
                style={{
                  background: "#0B1738",
                  border: `1px solid ${coloresPlataforma[h.plataforma] || "#1E3A8A"}`,
                  borderRadius: "12px",
                  padding: "14px"
                }}
              >
                <div
                  style={{
                    color: coloresPlataforma[h.plataforma] || "#60A5FA",
                    fontSize: "12px",
                    letterSpacing: "1px",
                    marginBottom: "6px"
                  }}
                >
                  {h.plataforma}
                </div>

                <div style={{ color: "#FFFFFF", fontSize: "16px", wordBreak: "break-all" }}>
                  @{h.handle}
                </div>

                {h.coincideConVariante && (
                  <div style={{ color: "#22C55E", fontSize: "11px", marginTop: "6px" }}>
                    ✓ coincide con una variante del nombre
                  </div>
                )}

                <div style={{ color: "#64748B", fontSize: "11px", marginTop: "8px" }}>
                  {h.apariciones} aparición(es) · {(h.fuentes || []).join(", ")}
                </div>

                {h.enlace && (
                  <a
                    href={h.enlace}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      color: "#60A5FA",
                      textDecoration: "none",
                      fontSize: "12px",
                      marginTop: "10px"
                    }}
                  >
                    <ExternalLink size={13} />
                    Abrir
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: "#64748B", fontSize: "13px" }}>
            No se observaron handles en las URLs del descubrimiento general.
          </div>
        )}
      </div>

      {/* DETALLE PLEGABLE */}

      <button
        onClick={() => setAbierto(!abierto)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "transparent",
          border: "1px solid #2563EB",
          borderRadius: "999px",
          color: "#93C5FD",
          padding: "10px 18px",
          cursor: "pointer",
          fontSize: "13px"
        }}
      >
        {abierto ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        {abierto ? "Ocultar" : "Ver"} desglose de la puntuación y evidencias
      </button>

      {abierto && (
        <div style={{ marginTop: "18px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* DESGLOSE DE PUNTUACIÓN */}

          <div style={caja}>
            <div style={etiquetaSeccion}>Por qué {global}/100</div>

            {componentes.map((c, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "baseline",
                  padding: "8px 0",
                  borderBottom: i < componentes.length - 1 ? "1px solid #13224A" : "none"
                }}
              >
                <strong
                  style={{
                    color: "#22C55E",
                    minWidth: "44px",
                    fontSize: "15px"
                  }}
                >
                  +{c.puntos}
                </strong>

                <div>
                  <div style={{ color: "#E2E8F0", fontSize: "14px" }}>{c.componente}</div>
                  <div style={{ color: "#64748B", fontSize: "12px" }}>{c.detalle}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ATRIBUTOS CON SU FUENTE */}

          {atributos.length > 0 && (
            <div style={caja}>
              <div style={etiquetaSeccion}>Atributos y fuentes que los respaldan</div>

              {atributos.map((a, i) => (
                <div
                  key={i}
                  style={{
                    padding: "10px 0",
                    borderBottom: i < atributos.length - 1 ? "1px solid #13224A" : "none"
                  }}
                >
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "baseline" }}>
                    <span style={{ color: "#60A5FA", fontSize: "12px", minWidth: "90px" }}>
                      {a.campo}
                    </span>
                    <strong style={{ color: "#FFFFFF" }}>{a.valor}</strong>
                    <span style={{ color: colorNivel(a.confianza >= 75 ? "alta" : a.confianza >= 50 ? "media" : "baja"), fontSize: "12px" }}>
                      {a.confianza}/100
                    </span>
                  </div>

                  <div style={{ color: "#64748B", fontSize: "12px", marginTop: "4px" }}>
                    {a.apariciones} aparición(es) · fuentes: {(a.fuentes || []).join(", ")} ·
                    evidencias: {(a.evidencias || []).join(", ")}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* PLATAFORMAS Y DOMINIOS */}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "16px"
            }}
          >
            <div style={caja}>
              <div style={etiquetaSeccion}>Plataformas detectadas</div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {plataformas.length > 0 ? (
                  plataformas.map((p) => (
                    <Chip
                      key={p.valor}
                      texto={p.valor}
                      detalle={`×${p.apariciones}`}
                      color={coloresPlataforma[p.valor] || "#1E3A8A"}
                    />
                  ))
                ) : (
                  <span style={{ color: "#64748B", fontSize: "13px" }}>Ninguna.</span>
                )}
              </div>
            </div>

            <div style={caja}>
              <div style={etiquetaSeccion}>Dominios relevantes</div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {dominios.length > 0 ? (
                  dominios.map((d) => (
                    <Chip key={d.valor} texto={d.valor} detalle={`×${d.apariciones}`} />
                  ))
                ) : (
                  <span style={{ color: "#64748B", fontSize: "13px" }}>Ninguno.</span>
                )}
              </div>
            </div>
          </div>

          {/* EVIDENCIAS UTILIZADAS */}

          <div style={caja}>
            <div style={etiquetaSeccion}>
              Evidencias utilizadas ({evidencias.length})
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {evidencias.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    display: "flex",
                    gap: "10px",
                    alignItems: "baseline",
                    flexWrap: "wrap"
                  }}
                >
                  <span
                    style={{
                      color: "#60A5FA",
                      fontSize: "11px",
                      fontFamily: "monospace",
                      minWidth: "46px"
                    }}
                  >
                    {ev.id}
                  </span>

                  <span style={{ color: "#E2E8F0", fontSize: "13px", flex: 1, minWidth: "180px" }}>
                    {ev.titulo}
                  </span>

                  <span
                    style={{
                      color: "#94A3B8",
                      fontSize: "11px",
                      border: "1px solid #1E3A8A",
                      borderRadius: "999px",
                      padding: "2px 10px"
                    }}
                  >
                    {ev.origen}
                  </span>

                  {ev.enlace && (
                    <a
                      href={ev.enlace}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#60A5FA", display: "flex", alignItems: "center" }}
                    >
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
