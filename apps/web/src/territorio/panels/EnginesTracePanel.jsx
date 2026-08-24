import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  CircleSlash,
  KeyRound,
  AlertTriangle,
  Clock,
  Ban,
  MinusCircle
} from "lucide-react";

/*
===========================================================
TRAZA DE MOTORES
===========================================================

Qué se preguntó, a quién, y qué contestó. Incluidos los
motores que NO se consultaron.

POR QUE LOS NO EJECUTADOS SON LO IMPORTANTE
-----------------------------------------------------------

Un panel que solo lista los motores que respondieron hace
parecer que la cobertura fue completa. Estos cuatro estados no
significan lo mismo y no se pueden pintar igual:

    SIN_RESULTADOS   respondió, no había nada     → se puede
                                                    afirmar ausencia
    NO_EJECUTADO     no se le preguntó            → NO se puede
    SIN_CREDENCIAL   no se le puede preguntar     → NO se puede
    ERROR / TIMEOUT  se le preguntó y falló       → NO se puede

Solo el primero autoriza a decir «no hay nada publicado». Los
otros tres son huecos de cobertura disfrazados de silencio.

Va plegado por defecto: es información de auditoría, no la
lectura principal. Pero el recuento de motores sin cobertura
se ve SIN desplegar, porque eso sí cambia cómo se lee todo lo
demás.
===========================================================
*/

const ICONO = {
  OK: { icono: CheckCircle2, color: "#0ca30c" },
  SIN_RESULTADOS: { icono: MinusCircle, color: "#64748b" },
  NO_EJECUTADO: { icono: CircleSlash, color: "#fab219" },
  SIN_CREDENCIAL: { icono: KeyRound, color: "#fab219" },
  ERROR: { icono: AlertTriangle, color: "#d03b3b" },
  TIMEOUT: { icono: Clock, color: "#ec835a" },
  BLOQUEADO: { icono: Ban, color: "#ec835a" },
  NO_IMPLEMENTADO: { icono: CircleSlash, color: "#334155" }
};


export default function EnginesTracePanel({ recoleccion }) {
  const [abierto, setAbierto] = useState(false);

  const traza = recoleccion?.trazaMotores || [];

  if (traza.length === 0) return null;

  const sinCobertura = traza.filter((t) => !t.permiteAfirmarAusencia);

  return (
    <section
      style={{
        background: "var(--sentinel-surface)",
        border: "1px solid var(--sentinel-borde)",
        borderRadius: "var(--radio-l)",
        overflow: "hidden"
      }}
    >
      <button
        onClick={() => setAbierto((v) => !v)}
        className="sentinel-hover"
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "14px 18px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left"
        }}
      >
        {abierto ? (
          <ChevronDown size={14} color="var(--sentinel-cyan)" />
        ) : (
          <ChevronRight size={14} color="var(--sentinel-cyan)" />
        )}

        <span
          style={{
            color: "var(--sentinel-cyan)",
            fontSize: "10px",
            letterSpacing: "1.8px",
            textTransform: "uppercase",
            fontWeight: 600
          }}
        >
          Motores consultados
        </span>

        <span
          style={{
            flex: 1,
            color: "var(--sentinel-texto-tenue)",
            fontSize: "11px"
          }}
        >
          {traza.filter((t) => t.estado === "OK").length} respondieron ·{" "}
          {traza.length} declarados
        </span>

        {/* Esto se ve SIN desplegar. */}
        {sinCobertura.length > 0 && (
          <span
            style={{
              color: "#eda100",
              fontSize: "10.5px",
              border: "1px solid #c98500",
              borderRadius: "var(--radio-pill)",
              padding: "2px 9px",
              flexShrink: 0
            }}
          >
            {sinCobertura.length} sin cobertura
          </span>
        )}
      </button>

      {abierto && (
        <div style={{ padding: "0 18px 16px 18px" }}>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "5px" }}
          >
            {traza.map((t) => {
              const cfg = ICONO[t.estado] || ICONO.NO_EJECUTADO;

              const Icono = cfg.icono;

              return (
                <div
                  key={t.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "9px",
                    padding: "9px 11px",
                    background: "var(--sentinel-surface-alta)",
                    border: "1px solid var(--sentinel-borde)",
                    borderRadius: "var(--radio-m)"
                  }}
                >
                  <Icono
                    size={13}
                    color={cfg.color}
                    style={{ flexShrink: 0, marginTop: "2px" }}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: "9px",
                        flexWrap: "wrap"
                      }}
                    >
                      <span
                        style={{
                          color: "var(--sentinel-texto)",
                          fontSize: "12px",
                          fontWeight: 600
                        }}
                      >
                        {t.motor}
                      </span>

                      <span
                        style={{
                          color: cfg.color,
                          fontSize: "9.5px",
                          letterSpacing: "0.8px"
                        }}
                      >
                        {t.estado}
                      </span>

                      <span
                        style={{
                          color: "var(--sentinel-texto-tenue)",
                          fontSize: "10.5px"
                        }}
                      >
                        {t.consultas} consulta(s) · {t.resultados} resultado(s)
                        {t.costoCuota > 0 ? ` · ${t.costoCuota} de cuota` : ""}
                      </span>
                    </div>

                    <div
                      style={{
                        color: "var(--sentinel-texto-suave)",
                        fontSize: "10.5px",
                        lineHeight: 1.6,
                        marginTop: "3px"
                      }}
                    >
                      {t.motivoSiNoEjecutado || t.error || t.significado}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              marginTop: "12px",
              paddingTop: "10px",
              borderTop: "1px solid var(--sentinel-borde)",
              color: "var(--sentinel-texto-tenue)",
              fontSize: "10.5px",
              lineHeight: 1.7
            }}
          >
            Solo <strong>OK</strong> y <strong>SIN_RESULTADOS</strong> permiten
            afirmar que en esa fuente no había nada. Los demás estados son
            huecos de cobertura: la fuente no se pudo consultar, y su silencio
            no es una respuesta.
          </div>
        </div>
      )}
    </section>
  );
}
