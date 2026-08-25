import { MapPinOff, HelpCircle } from "lucide-react";

/*
===========================================================
LUGARES MENCIONADOS SIN GEOMETRÍA DISPONIBLE
===========================================================

Todo lo que tiene actividad pero no se puede dibujar.

Es el bloque que impide el engaño más silencioso de un mapa
incompleto: si Totoracocha acumula evidencias y el mapa no la
pinta porque falta su polígono, un lector razonable concluye
que allí no pasa nada.

DOS CASOS DISTINTOS, SEPARADOS
-----------------------------------------------------------

    unidad oficial sin polígono
        Totoracocha existe, la respalda la ordenanza municipal
        de 1982, y su atribución es válida. Lo que falta es la
        geometría.

    topónimo no certificado
        El Vado se menciona, pero no hay fuente que diga en qué
        parroquia está. No atribuye nada; se registra la
        mención.

Confundirlos haría parecer que ambos tienen el mismo respaldo,
y no lo tienen.
===========================================================
*/

function Fila({ u, onSeleccionar }) {
  const esOficial = u.unidadOficial;

  return (
    <button
      onClick={() => onSeleccionar?.(u)}
      className="sentinel-hover"
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "11px",
        padding: "9px 11px",
        background: "var(--sentinel-surface-alta)",
        border: "1px solid var(--sentinel-borde)",
        borderRadius: "var(--radio-m)",
        cursor: onSeleccionar ? "pointer" : "default",
        textAlign: "left"
      }}
    >
      <MapPinOff
        size={13}
        color="var(--sentinel-texto-tenue)"
        style={{ flexShrink: 0 }}
      />

      <span
        style={{
          flex: 1,
          color: "var(--sentinel-texto)",
          fontSize: "12px",
          fontWeight: 600,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis"
        }}
      >
        {u.nombre}
      </span>

      <span
        title={
          esOficial
            ? "Unidad oficialmente reconocida. Lo que falta es el polígono."
            : "Topónimo sin fuente oficial: se registra la mención, no la ubicación."
        }
        style={{
          color: esOficial ? "var(--sentinel-texto-suave)" : "#eda100",
          fontSize: "9px",
          letterSpacing: "0.5px",
          textTransform: "uppercase",
          border: `1px solid ${
            esOficial ? "var(--sentinel-borde)" : "#c98500"
          }`,
          borderRadius: "var(--radio-pill)",
          padding: "2px 7px",
          whiteSpace: "nowrap",
          flexShrink: 0
        }}
      >
        {esOficial ? "oficial · sin geometría" : "resolución no certificada"}
      </span>

      <span
        style={{
          color: "var(--sentinel-texto)",
          fontSize: "12.5px",
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          minWidth: "26px",
          textAlign: "right",
          flexShrink: 0
        }}
      >
        {u.evidencias}
      </span>
    </button>
  );
}


export default function PlacesWithoutGeometry({ mapa, onSeleccionar }) {
  const lista = mapa?.sinGeometria || [];

  if (lista.length === 0) return null;

  const oficiales = lista.filter((u) => u.unidadOficial);

  const noCertificados = lista.filter((u) => !u.unidadOficial);

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
          marginBottom: "6px"
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
          Lugares mencionados sin geometría disponible
        </span>

        <span
          style={{ color: "var(--sentinel-texto-tenue)", fontSize: "10.5px" }}
        >
          {mapa.metricas.evidenciasFueraDelMapa} evidencias fuera del mapa
        </span>
      </div>

      <div
        style={{
          color: "var(--sentinel-texto-suave)",
          fontSize: "11px",
          lineHeight: 1.65,
          marginBottom: "13px"
        }}
      >
        Sentinel reconoce la señal sin fabricar el mapa. Que un lugar no se
        pinte <strong>no</strong> significa que allí no ocurra nada.
      </div>

      {oficiales.length > 0 && (
        <div style={{ marginBottom: noCertificados.length ? "14px" : 0 }}>
          <div
            style={{
              color: "var(--sentinel-texto-tenue)",
              fontSize: "9.5px",
              letterSpacing: "1.1px",
              textTransform: "uppercase",
              marginBottom: "7px"
            }}
          >
            Unidades oficiales sin polígono publicado
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {oficiales.map((u) => (
              <Fila key={u.unidadId} u={u} onSeleccionar={onSeleccionar} />
            ))}
          </div>
        </div>
      )}

      {noCertificados.length > 0 && (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: "var(--sentinel-texto-tenue)",
              fontSize: "9.5px",
              letterSpacing: "1.1px",
              textTransform: "uppercase",
              marginBottom: "7px"
            }}
          >
            <HelpCircle size={10} />
            Topónimos sin fuente oficial
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {noCertificados.map((u) => (
              <Fila key={u.unidadId} u={u} onSeleccionar={onSeleccionar} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
