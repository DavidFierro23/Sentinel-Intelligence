import { Sparkles, Tag, MapPin, Radio, FileText, ChevronRight } from "lucide-react";

/*
===========================================================
AGENDA OBSERVADA
===========================================================

El bloque principal. Responde «¿de qué se está hablando?» con
los temas ordenados por ACTIVIDAD OBSERVADA.

DESCUBIERTO ≠ CLASIFICADO, Y SE VE
-----------------------------------------------------------

Un tema puede llegar por dos caminos:

    descubierto por el corpus     Sentinel lo encontró
    clasificado por la taxonomía  cae en una categoría

Un tema descubierto que la taxonomía NO cubre **no se
esconde**. Es justo lo que el Gate C2 existe para no perder: el
día de una inundación, «lluvias» no tiene categoría y es lo más
importante de la pantalla.

Por eso la insignia «Descubierto por Sentinel» es visualmente
prominente y no una nota gris.

LO QUE NO DICE
-----------------------------------------------------------

Ni «tendencia», ni «creciendo», ni «viral». Sin ventana
comparable esas palabras serían afirmaciones sin sustento. Los
estados son de actividad observada, y punto.
===========================================================
*/

const COLOR_ESTADO = {
  alta_actividad_observada: "#0ca30c",
  actividad_media: "#fab219",
  actividad_baja: "#64748b",
  senal_insuficiente: "#334155"
};


function Insignia({ children, color, borde, titulo }) {
  return (
    <span
      title={titulo}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        color,
        fontSize: "9.5px",
        fontWeight: 650,
        letterSpacing: "0.5px",
        textTransform: "uppercase",
        border: `1px solid ${borde}`,
        borderRadius: "var(--radio-pill)",
        padding: "2px 8px",
        whiteSpace: "nowrap"
      }}
    >
      {children}
    </span>
  );
}


function Fila({ tema, onAbrir, seleccionado }) {
  const color = COLOR_ESTADO[tema.estadoActividad] || "#64748b";

  const descubierto =
    tema.origen === "descubierto" || tema.origen === "descubierto_y_clasificado";

  return (
    <button
      onClick={() => onAbrir(tema)}
      className="sentinel-hover"
      style={{
        width: "100%",
        display: "flex",
        alignItems: "flex-start",
        gap: "14px",
        padding: "13px 14px",
        background: seleccionado
          ? "rgba(11,95,255,.14)"
          : "var(--sentinel-surface-alta)",
        border: `1px solid ${
          seleccionado ? "var(--sentinel-cyan)" : "var(--sentinel-borde)"
        }`,
        borderRadius: "var(--radio-m)",
        cursor: "pointer",
        textAlign: "left"
      }}
    >
      <span
        style={{
          color: "var(--sentinel-texto-tenue)",
          fontSize: "13px",
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          minWidth: "22px",
          paddingTop: "1px"
        }}
      >
        {String(tema.posicion).padStart(2, "0")}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: "#FFFFFF",
            fontSize: "14px",
            fontWeight: 650,
            lineHeight: 1.35,
            overflow: "hidden",
            textOverflow: "ellipsis"
          }}
        >
          {tema.etiqueta}
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "7px",
            marginTop: "7px"
          }}
        >
          {descubierto && (
            <Insignia
              color="var(--sentinel-cyan)"
              borde="var(--sentinel-cyan)"
              titulo="Sentinel encontró este tema en el corpus, sin partir de ninguna categoría previa."
            >
              <Sparkles size={9} />
              Descubierto por Sentinel
            </Insignia>
          )}

          {tema.categoria ? (
            <Insignia
              color="var(--sentinel-texto-suave)"
              borde="var(--sentinel-borde-vivo)"
              titulo="Categoría de la taxonomía declarada."
            >
              <Tag size={9} />
              {tema.categoria}
            </Insignia>
          ) : (
            <Insignia
              color="var(--sentinel-texto-tenue)"
              borde="var(--sentinel-borde)"
              titulo="La taxonomía todavía no tiene una categoría para este tema. No se esconde por eso."
            >
              Sin categoría
            </Insignia>
          )}

          {tema.subtemas?.slice(0, 2).map((s) => (
            <Insignia
              key={s.nombre}
              color="var(--sentinel-texto-suave)"
              borde="var(--sentinel-borde)"
              titulo="Entidad nombrada detectada en las evidencias."
            >
              {s.nombre}
            </Insignia>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "14px",
            marginTop: "9px",
            color: "var(--sentinel-texto-suave)",
            fontSize: "11px"
          }}
        >
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
          >
            <FileText size={11} />
            {tema.evidencias} evidencias
          </span>

          <span
            style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
            title="Publicadores distintos. Sin diversidad de fuentes, un medio insistiendo se parece a un hecho cubierto."
          >
            <Radio size={11} />
            {tema.fuentesIndependientes} fuentes
          </span>

          {tema.territorios?.length > 0 && (
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
            >
              <MapPin size={11} />
              {tema.territorios.map((t) => t.nombre).join(" · ")}
            </span>
          )}

          {tema.ultimaObservacion && (
            <span style={{ color: "var(--sentinel-texto-tenue)" }}>
              últ. {String(tema.ultimaObservacion).slice(0, 10)}
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "9px",
          flexShrink: 0,
          paddingTop: "2px"
        }}
      >
        <span
          style={{
            color,
            fontSize: "9.5px",
            fontWeight: 650,
            letterSpacing: "0.4px",
            textAlign: "right",
            maxWidth: "88px",
            lineHeight: 1.3
          }}
        >
          {tema.etiquetaActividad}
        </span>

        <ChevronRight size={14} color="var(--sentinel-texto-tenue)" />
      </div>
    </button>
  );
}


export default function AgendaPanel({ agenda, onAbrirTema, temaAbierto }) {
  const filas = agenda?.agenda || [];

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
          marginBottom: "14px"
        }}
      >
        <span
          style={{
            color: "var(--sentinel-cyan)",
            fontSize: "10px",
            letterSpacing: "1.8px",
            textTransform: "uppercase",
            fontWeight: 600
          }}
        >
          Agenda observada
        </span>

        <span
          style={{ color: "var(--sentinel-texto-tenue)", fontSize: "10.5px" }}
        >
          {agenda?.metricas?.temas ?? 0} temas ·{" "}
          {agenda?.metricas?.sinCategoria ?? 0} sin categoría
        </span>
      </div>

      {filas.length === 0 ? (
        <div
          style={{
            color: "var(--sentinel-texto-suave)",
            fontSize: "12.5px",
            lineHeight: 1.8,
            padding: "16px 0"
          }}
        >
          No existe suficiente observación territorial para construir la agenda.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
          {filas.map((t) => (
            <Fila
              key={t.id}
              tema={t}
              onAbrir={onAbrirTema}
              seleccionado={temaAbierto?.id === t.id}
            />
          ))}
        </div>
      )}

      <div
        style={{
          marginTop: "14px",
          paddingTop: "10px",
          borderTop: "1px solid var(--sentinel-borde)",
          color: "var(--sentinel-texto-tenue)",
          fontSize: "10.5px",
          lineHeight: 1.7
        }}
      >
        Ordenado por <strong>actividad observada</strong>, no por tendencia:{" "}
        <code style={{ fontSize: "10px" }}>
          {agenda?.formula?.expresion}
        </code>
        . Las tres dimensiones se muestran por separado en cada tema. Sin
        ventana comparable no se puede afirmar crecimiento ni viralidad.
      </div>
    </section>
  );
}
