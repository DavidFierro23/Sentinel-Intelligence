// apps/web/src/components/ConfidenceExplainabilityPanel.jsx

import { AlertTriangle, Minus, Scale, UserCheck } from "lucide-react";

/*
===========================================================
CONFIDENCE EXPLAINABILITY PANEL
===========================================================

Muestra CÓMO se construyó una puntuación de correspondencia.

Regla que gobierna este componente: nunca se muestra la cifra
sola. Un "94/100" sin desglose es una opinión con formato de
dato. Aquí se despliega:

  · lo que sumó, señal por señal, con su motivo
  · lo que restó (contraseñales)
  · el tope por concurrencia y si recortó
  · el cálculo paso a paso, reproducible a mano
  · lo que NO se pudo medir
  · el límite del sistema: nunca confirma identidades

Cumple IA1 (explicabilidad) e IA2 (human-in-the-loop).
===========================================================
*/

const COLOR_NIVEL = {
  muy_alta: "#22C55E",
  alta: "#22C55E",
  media: "#F59E0B",
  baja: "#F97316",
  insuficiente: "#64748B"
};

function colorNivel(nivel) {
  return COLOR_NIVEL[nivel] || "#64748B";
}

const COLOR_ESTADO = {
  probable: "#22C55E",
  candidato: "#F59E0B",
  descubierto: "#64748B"
};

const caja = {
  background: "#08142F",
  border: "1px solid #1E3A8A",
  borderRadius: "14px",
  padding: "16px",
  boxSizing: "border-box"
};

const etiqueta = {
  color: "#60A5FA",
  fontSize: "10px",
  letterSpacing: "2px",
  textTransform: "uppercase",
  marginBottom: "10px"
};

/*
  Barra de aporte de una señal: cuánto de su peso máximo
  aprovechó.
*/
function BarraSenal({ puntos, pesoMaximo, color }) {
  const proporcion = pesoMaximo ? Math.min(1, puntos / pesoMaximo) : 0;

  return (
    <div
      style={{
        height: "6px",
        background: "#13224A",
        borderRadius: "999px",
        overflow: "hidden",
        minWidth: "80px",
        flex: 1
      }}
    >
      <div
        style={{
          width: `${proporcion * 100}%`,
          height: "100%",
          background: color,
          borderRadius: "999px"
        }}
      />
    </div>
  );
}

export default function ConfidenceExplainabilityPanel({ correspondencia }) {
  if (!correspondencia || typeof correspondencia !== "object") return null;

  const explicacion = correspondencia.explicacion || {};
  const calculo = explicacion.calculo || {};
  const noMedido = explicacion.noMedido || {};

  const aportes = explicacion.aportes || [];
  const penalizaciones = explicacion.penalizaciones || [];
  const pasos = explicacion.pasos || [];

  const nivel = correspondencia.nivel;
  const color = colorNivel(nivel);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* PUNTUACIÓN Y RESUMEN */}

      <div style={{ ...caja, borderColor: color }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "14px",
            flexWrap: "wrap",
            marginBottom: "10px"
          }}
        >
          <strong style={{ color, fontSize: "34px", lineHeight: 1 }}>
            {correspondencia.puntuacion}
            <span style={{ fontSize: "16px", color: "#64748B" }}>/100</span>
          </strong>

          <span style={{ color: "#E2E8F0", fontSize: "16px" }}>
            {correspondencia.etiqueta}
          </span>

          <span
            style={{
              marginLeft: "auto",
              color: COLOR_ESTADO[correspondencia.estado] || "#64748B",
              border: `1px solid ${COLOR_ESTADO[correspondencia.estado] || "#64748B"}`,
              borderRadius: "999px",
              padding: "3px 12px",
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "1px"
            }}
          >
            {correspondencia.estado}
          </span>
        </div>

        <p style={{ margin: 0, color: "#94A3B8", fontSize: "13px", lineHeight: 1.6 }}>
          {explicacion.resumen}
        </p>
      </div>

      {/* TOPE HUMANO */}

      <div
        style={{
          display: "flex",
          gap: "10px",
          alignItems: "flex-start",
          background: "rgba(37,99,235,.10)",
          border: "1px solid #1E40AF",
          borderRadius: "12px",
          padding: "12px 14px"
        }}
      >
        <UserCheck size={18} color="#60A5FA" style={{ flexShrink: 0, marginTop: "2px" }} />
        <span style={{ color: "#93C5FD", fontSize: "12px", lineHeight: 1.55 }}>
          {explicacion.limiteDelSistema}
        </span>
      </div>

      {/* APORTES */}

      {aportes.length > 0 && (
        <div style={caja}>
          <div style={etiqueta}>Señales que sumaron</div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {aportes.map((a) => (
              <div key={a.senal}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    flexWrap: "wrap",
                    marginBottom: "6px"
                  }}
                >
                  <span
                    style={{
                      color: "#60A5FA",
                      fontFamily: "monospace",
                      fontSize: "12px",
                      minWidth: "26px"
                    }}
                  >
                    {a.senal}
                  </span>

                  <strong style={{ color: "#E2E8F0", fontSize: "13px" }}>
                    {a.nombre}
                  </strong>

                  <BarraSenal puntos={a.puntos} pesoMaximo={a.pesoMaximo} color="#22C55E" />

                  <span
                    style={{
                      color: "#22C55E",
                      fontSize: "13px",
                      fontFamily: "monospace",
                      minWidth: "72px",
                      textAlign: "right"
                    }}
                  >
                    +{a.puntos}/{a.pesoMaximo}
                  </span>
                </div>

                <div style={{ color: "#94A3B8", fontSize: "12px", lineHeight: 1.5 }}>
                  {a.motivo}
                </div>

                {a.procedencia && (
                  <div style={{ color: "#64748B", fontSize: "11px", marginTop: "3px" }}>
                    Procedencia: {a.procedencia}
                  </div>
                )}

                {a.limitacion && (
                  <div style={{ color: "#FCD34D", fontSize: "11px", marginTop: "3px" }}>
                    ⚠ {a.limitacion}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PENALIZACIONES */}

      {penalizaciones.length > 0 && (
        <div style={{ ...caja, borderColor: "#7F1D1D" }}>
          <div style={{ ...etiqueta, color: "#F87171" }}>
            Contraseñales que restaron
          </div>

          {penalizaciones.map((p) => (
            <div key={p.senal} style={{ marginBottom: "8px" }}>
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  alignItems: "center",
                  flexWrap: "wrap"
                }}
              >
                <Minus size={13} color="#F87171" />
                <span
                  style={{
                    color: "#F87171",
                    fontFamily: "monospace",
                    fontSize: "12px"
                  }}
                >
                  {p.senal}
                </span>
                <strong style={{ color: "#E2E8F0", fontSize: "13px" }}>{p.nombre}</strong>
                <span
                  style={{
                    marginLeft: "auto",
                    color: "#F87171",
                    fontFamily: "monospace",
                    fontSize: "13px"
                  }}
                >
                  {p.puntos}
                </span>
              </div>

              <div style={{ color: "#94A3B8", fontSize: "12px", marginTop: "3px" }}>
                {p.motivo}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CÁLCULO PASO A PASO */}

      <div style={caja}>
        <div style={{ ...etiqueta, display: "flex", alignItems: "center", gap: "8px" }}>
          <Scale size={13} color="#60A5FA" />
          Cálculo paso a paso
        </div>

        <div style={{ fontFamily: "monospace", fontSize: "12px" }}>
          {pasos.map((p, i) => {
            const esFinal = p.paso === "PUNTUACIÓN FINAL";
            const esSubtotal = p.paso === "Subtotal";

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12px",
                  padding: "6px 0",
                  borderTop: esFinal || esSubtotal ? "1px solid #1E3A8A" : "none",
                  color: esFinal ? "#FFFFFF" : "#CBD5E1",
                  fontWeight: esFinal ? 700 : 400
                }}
              >
                <span>{p.paso}</span>
                <span style={{ color: esFinal ? color : "#93C5FD", whiteSpace: "nowrap" }}>
                  {p.operacion}
                </span>
              </div>
            );
          })}
        </div>

        {calculo.seAplicoTope && (
          <div
            style={{
              marginTop: "10px",
              color: "#FCD34D",
              fontSize: "11px",
              lineHeight: 1.5
            }}
          >
            ⚠ Recortada de {calculo.bruto} a {calculo.puntuacionFinal}: con{" "}
            {calculo.senalesActivas} señal(es) activa(s) el máximo admisible es{" "}
            {calculo.topeAplicado}. Ninguna señal aislada confirma identidad.
          </div>
        )}
      </div>

      {/* LO QUE NO SE PUDO MEDIR */}

      {(noMedido.senalesSinImplementar?.length > 0 ||
        noMedido.senalesSinDatos?.length > 0) && (
        <div
          style={{
            ...caja,
            borderColor: "#92400E",
            background: "rgba(245,158,11,.06)"
          }}
        >
          <div
            style={{
              ...etiqueta,
              color: "#FCD34D",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <AlertTriangle size={13} color="#F59E0B" />
            Lo que no se pudo medir
          </div>

          {noMedido.advertencia && (
            <p
              style={{
                margin: "0 0 12px 0",
                color: "#FCD34D",
                fontSize: "12px",
                lineHeight: 1.55
              }}
            >
              {noMedido.advertencia}
            </p>
          )}

          {(noMedido.senalesSinImplementar || []).map((s) => (
            <div
              key={s.senal}
              style={{ color: "#94A3B8", fontSize: "12px", marginBottom: "5px" }}
            >
              <span style={{ color: "#F59E0B", fontFamily: "monospace" }}>
                {s.senal}
              </span>{" "}
              <strong style={{ color: "#CBD5E1" }}>{s.nombre}</strong>{" "}
              <span style={{ color: "#64748B" }}>
                (fuerza {s.fuerza}) — {s.motivo}
              </span>
            </div>
          ))}

          {(noMedido.senalesSinDatos || []).map((s) => (
            <div
              key={s.senal}
              style={{ color: "#64748B", fontSize: "11px", marginTop: "5px" }}
            >
              <span style={{ fontFamily: "monospace" }}>{s.senal}</span> {s.nombre}:{" "}
              {s.motivo}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
