import { useState } from "react";
import {
  Award,
  Briefcase,
  MapPin,
  Calendar,
  Radio,
  Landmark,
  HelpCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertTriangle
} from "lucide-react";

/*
===========================================================
PERFIL EJECUTIVO — ARQ-PUI-001, Bloques C y F
===========================================================

Tres cosas que este panel hace y que el anterior no podía:

  1. Muestra SOLO las cuentas atribuidas al objetivo. Los
     medios y las instituciones van en sus propias secciones,
     porque mezclarlos es la confusión que el sprint prohíbe.

  2. Da el Índice de Huella Digital con su desglose. Un índice
     sin desglose es un número que nadie puede discutir.

  3. Declara los campos que NO se leyeron y por qué. Seguidores
     y biografía exigen la API de la plataforma; el hueco se
     muestra explicado, no relleno.
===========================================================
*/

const COLOR_PLATAFORMA = {
  Facebook: "#1877F2",
  Instagram: "#E1306C",
  TikTok: "#25D9D9",
  X: "#FFFFFF",
  YouTube: "#FF3B30",
  LinkedIn: "#3987e5"
};

const COLOR_NIVEL = {
  muy_alta: "#22C55E",
  alta: "#22C55E",
  media: "#F59E0B",
  baja: "#F97316",
  insuficiente: "#64748B"
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

function ListaSeparada({ titulo, icono, items, color, nota }) {
  const [abierto, setAbierto] = useState(false);

  if (!items?.length) return null;

  return (
    <div style={{ ...caja, marginTop: "12px" }}>
      <button
        onClick={() => setAbierto(!abierto)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          width: "100%",
          background: "transparent",
          border: "none",
          color: "#E2E8F0",
          cursor: "pointer",
          padding: 0,
          fontSize: "13px"
        }}
      >
        {icono}

        <strong>{titulo}</strong>

        <span
          style={{
            color,
            border: `1px solid ${color}`,
            borderRadius: "999px",
            padding: "2px 10px",
            fontSize: "11px"
          }}
        >
          {items.length}
        </span>

        <span style={{ marginLeft: "auto", color: "#64748B" }}>
          {abierto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {nota && (
        <p style={{ margin: "8px 0 0 0", color: "#64748B", fontSize: "11px" }}>
          {nota}
        </p>
      )}

      {abierto && (
        <div style={{ marginTop: "12px" }}>
          {items.map((x, i) => (
            <div
              key={`${x.plataforma}-${x.handle}-${i}`}
              style={{
                display: "flex",
                gap: "10px",
                alignItems: "center",
                flexWrap: "wrap",
                padding: "7px 0",
                borderTop: i ? "1px solid #14224A" : "none"
              }}
            >
              <span
                style={{
                  color: COLOR_PLATAFORMA[x.plataforma] || "#60A5FA",
                  fontSize: "11px",
                  minWidth: "72px"
                }}
              >
                {x.plataforma}
              </span>

              <span style={{ color: "#CBD5E1", fontSize: "12px" }}>
                @{x.handle}
              </span>

              {x.url && (
                <a
                  href={x.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#60A5FA", display: "flex", alignItems: "center" }}
                >
                  <ExternalLink size={12} />
                </a>
              )}

              <span
                style={{
                  color: "#64748B",
                  fontSize: "11px",
                  marginLeft: "auto",
                  maxWidth: "60%",
                  textAlign: "right"
                }}
              >
                {x.motivo}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ExecutiveProfilePanel({ perfil }) {
  const [verDesglose, setVerDesglose] = useState(false);

  if (!perfil) return null;

  const h = perfil.huellaDigital;

  const colorHuella =
    h?.valor >= 75
      ? "#22C55E"
      : h?.valor >= 50
        ? "#F59E0B"
        : h?.valor >= 25
          ? "#F97316"
          : "#64748B";

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
          flexWrap: "wrap",
          marginBottom: "6px"
        }}
      >
        <Award size={24} color="#60A5FA" style={{ flexShrink: 0 }} />

        <h2 style={{ margin: 0, color: "#FFFFFF", fontSize: "22px" }}>
          Perfil ejecutivo
        </h2>

        {perfil.origenDescubrimiento && (
          <span
            style={{
              color: "#FCD34D",
              fontSize: "11px",
              border: "1px solid #78350F",
              borderRadius: "999px",
              padding: "4px 12px"
            }}
          >
            descubrimiento: {perfil.origenDescubrimiento}
          </span>
        )}
      </div>

      {/* ÍNDICE DE HUELLA DIGITAL */}

      {h && (
        <div style={{ ...caja, marginTop: "14px" }}>
          <div style={etiquetaSeccion}>Índice de Huella Digital</div>

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "12px",
              flexWrap: "wrap"
            }}
          >
            <span
              style={{
                color: colorHuella,
                fontSize: "38px",
                fontFamily: "monospace",
                lineHeight: 1
              }}
            >
              {h.valor}
              <span style={{ color: "#64748B", fontSize: "16px" }}>/100</span>
            </span>

            <strong style={{ color: "#E2E8F0", fontSize: "15px" }}>
              {h.nivel}
            </strong>

            <button
              onClick={() => setVerDesglose(!verDesglose)}
              style={{
                marginLeft: "auto",
                background: "transparent",
                border: `1px solid ${colorHuella}`,
                borderRadius: "999px",
                color: "#93C5FD",
                padding: "6px 14px",
                cursor: "pointer",
                fontSize: "12px"
              }}
            >
              {verDesglose ? "ocultar desglose" : "cómo se calcula"}
            </button>
          </div>

          {verDesglose && (
            <div style={{ marginTop: "14px" }}>
              {h.componentes.map((c) => (
                <div key={c.id} style={{ marginBottom: "10px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      color: "#CBD5E1",
                      fontSize: "12px"
                    }}
                  >
                    <span>{c.nombre}</span>

                    <strong style={{ fontFamily: "monospace" }}>
                      {c.valor}/{c.maximo}
                    </strong>
                  </div>

                  <div
                    style={{
                      height: "5px",
                      background: "#14224A",
                      borderRadius: "3px",
                      marginTop: "5px"
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${(c.valor / c.maximo) * 100}%`,
                        background: colorHuella,
                        borderRadius: "3px"
                      }}
                    />
                  </div>

                  <div
                    style={{ color: "#64748B", fontSize: "11px", marginTop: "4px" }}
                  >
                    {c.detalle}
                  </div>
                </div>
              ))}

              {/* QUÉ NO MIDE — dicho antes de que nadie lo suponga */}
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  alignItems: "flex-start",
                  background: "rgba(245,158,11,.08)",
                  border: "1px solid #78350F",
                  borderRadius: "10px",
                  padding: "10px",
                  marginTop: "12px"
                }}
              >
                <AlertTriangle size={14} color="#FCD34D" style={{ flexShrink: 0, marginTop: "2px" }} />

                <div style={{ color: "#FCD34D", fontSize: "11px", lineHeight: 1.6 }}>
                  {Object.values(h.limites || {}).map((t, i) => (
                    <div key={i}>{t}</div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* RESUMEN EJECUTIVO */}

      {perfil.resumenEjecutivo?.length > 0 && (
        <div style={{ ...caja, marginTop: "12px" }}>
          <div style={etiquetaSeccion}>Resumen ejecutivo</div>

          {perfil.resumenEjecutivo.map((f, i) => (
            <div
              key={i}
              style={{
                color: "#CBD5E1",
                fontSize: "12.5px",
                lineHeight: 1.65,
                paddingLeft: "12px",
                borderLeft: "2px solid #1E3A8A",
                marginBottom: "8px"
              }}
            >
              {f}
            </div>
          ))}
        </div>
      )}

      {/* TARJETAS DEL OBJETIVO */}

      <div style={{ marginTop: "18px" }}>
        <div style={etiquetaSeccion}>
          Cuentas atribuidas al objetivo ({perfil.tarjetas?.length || 0})
        </div>

        {!perfil.tarjetas?.length ? (
          <div style={{ ...caja, color: "#64748B", fontSize: "13px" }}>
            Ninguna cuenta descubierta lleva el nombre del objetivo. No equivale
            a ausencia de cuentas: significa que no se pudo atribuir ninguna sin
            inventarla.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {perfil.tarjetas.map((t, i) => (
              <div
                key={`${t.plataformaId}-${t.handle}-${i}`}
                style={{
                  ...caja,
                  borderLeft: `3px solid ${COLOR_PLATAFORMA[t.plataforma] || "#60A5FA"}`
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    flexWrap: "wrap"
                  }}
                >
                  <span
                    style={{
                      color: COLOR_PLATAFORMA[t.plataforma] || "#60A5FA",
                      fontSize: "12px",
                      minWidth: "78px"
                    }}
                  >
                    {t.plataforma}
                  </span>

                  <strong
                    style={{
                      color: "#FFFFFF",
                      fontSize: "15px",
                      wordBreak: "break-all"
                    }}
                  >
                    @{t.handle}
                  </strong>

                  {t.correspondencia != null && (
                    <>
                      <span
                        style={{
                          color: COLOR_NIVEL[t.nivel] || "#64748B",
                          fontSize: "17px",
                          fontFamily: "monospace"
                        }}
                      >
                        {t.correspondencia}
                        <span style={{ color: "#64748B", fontSize: "11px" }}>
                          /100
                        </span>
                      </span>

                      <span style={{ color: "#CBD5E1", fontSize: "11.5px" }}>
                        {t.etiqueta}
                      </span>
                    </>
                  )}

                  {t.url && (
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        marginLeft: "auto",
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
                </div>

                {/* BLOQUE E — lo que se sabe */}
                <div
                  style={{
                    display: "flex",
                    gap: "18px",
                    flexWrap: "wrap",
                    marginTop: "12px",
                    color: "#94A3B8",
                    fontSize: "11.5px"
                  }}
                >
                  {t.cargo && (
                    <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <Briefcase size={12} color="#60A5FA" />
                      {t.cargo}
                    </span>
                  )}

                  {t.pais && (
                    <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <MapPin size={12} color="#60A5FA" />
                      {t.pais}
                    </span>
                  )}

                  {t.ultimaEvidenciaFechada && (
                    <span
                      style={{ display: "flex", alignItems: "center", gap: "5px" }}
                      title="Fecha de la evidencia más reciente indexada, no del último mensaje de la cuenta."
                    >
                      <Calendar size={12} color="#60A5FA" />
                      última evidencia{" "}
                      {String(t.ultimaEvidenciaFechada).slice(0, 10)}
                    </span>
                  )}
                </div>

                {/* BLOQUE E — lo que NO se pudo leer */}
                {t.camposNoLeidos?.length > 0 && (
                  <div
                    style={{
                      color: "#64748B",
                      fontSize: "11px",
                      marginTop: "10px",
                      paddingTop: "8px",
                      borderTop: "1px solid #14224A"
                    }}
                  >
                    Sin leer ({t.camposNoLeidos.join(", ")}): requieren la API de
                    la plataforma, hoy no disponible. No se rellenan con
                    estimaciones.
                  </div>
                )}

                {t.motivoClase && (
                  <div
                    style={{ color: "#475569", fontSize: "10.5px", marginTop: "6px" }}
                  >
                    atribución: {t.motivoClase}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* COLECCIONES SEPARADAS — Bloque C */}

      <div style={{ marginTop: "18px" }}>
        <div style={etiquetaSeccion}>Separado del objetivo</div>

        <ListaSeparada
          titulo="Medios de comunicación"
          icono={<Radio size={15} color="#F59E0B" />}
          items={perfil.medios}
          color="#F59E0B"
          nota="Cubren al objetivo; no le pertenecen. Se conservan porque quién cubre a alguien es inteligencia."
        />

        <ListaSeparada
          titulo="Instituciones"
          icono={<Landmark size={15} color="#8B5CF6" />}
          items={perfil.instituciones}
          color="#8B5CF6"
          nota="Una institución donde el objetivo trabaja no es su cuenta personal."
        />

        <ListaSeparada
          titulo="Sin determinar"
          icono={<HelpCircle size={15} color="#64748B" />}
          items={perfil.indeterminadas}
          color="#64748B"
          nota="No llevan el nombre del objetivo y no hay indicios de medio ni institución. Declararlas suyas sería inventarlo."
        />
      </div>
    </section>
  );
}
