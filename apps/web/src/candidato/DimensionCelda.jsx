import { textoDeEstado, tonoDeEstado } from "../workspace/estados";

/*
===========================================================
UNA DIMENSION ESTRATEGICA — CANDIDATE-STRATEGIC-UX-01
===========================================================

La celda que pinta una dimension. La usan la ficha y la
comparacion, y por eso vive aparte: dos componentes distintos
para lo mismo acabarian divergiendo, que es como aparecio el
«68 %» en dos formatos.

TRES ESTADOS VISUALES, Y NINGUNO ES UN CERO
-----------------------------------------------------------

  1. MEDIDO       el numero, con su unidad debajo.
  2. SIN DATO     el estado en palabras y su motivo en el title.
  3. NO CARGADO   una raya, y el title dice como se carga.

El tercero existe porque «no lo hemos pedido» y «no hay» son
cosas distintas. Decir SIN DATOS sin haber mirado es una
afirmacion falsa sobre el candidato.

El valor tecnico del estado viaja en el `title`, igual que en
el resto del workspace: la frase es lo que se lee, el enum es
lo que se audita.
===========================================================
*/

export default function DimensionCelda({ dimension, compacto = false }) {
  const d = dimension || {};

  const tono = tonoDeEstado(d.estado);

  /* --- NO CARGADO: la dimension existe, el dato no se ha pedido --- */
  if (d.cargado === false) {
    return (
      <div title={d.motivo || undefined} style={{ minWidth: 0 }}>
        <div
          style={{
            color: "var(--sentinel-texto-tenue)",
            fontFamily: "monospace",
            fontSize: compacto ? "13px" : "15px",
            lineHeight: 1.2
          }}
        >
          —
        </div>

        {!compacto && (
          <div
            style={{
              color: "var(--sentinel-texto-tenue)",
              fontSize: "9.5px",
              marginTop: "3px"
            }}
          >
            sin calcular
          </div>
        )}
      </div>
    );
  }

  /* --- SIN DATO: estado en palabras, nunca un numero --- */
  if (d.valor == null) {
    return (
      <div title={[d.estado, d.motivo].filter(Boolean).join(" · ")} style={{ minWidth: 0 }}>
        <span
          style={{
            color: tono.color,
            border: `1px solid ${tono.borde}`,
            borderRadius: "var(--radio-pill)",
            padding: "2px 8px",
            fontSize: compacto ? "9px" : "9.5px",
            whiteSpace: "nowrap",
            display: "inline-block"
          }}
        >
          {textoDeEstado(d.estado) || "sin dato"}
        </span>
      </div>
    );
  }

  /* --- MEDIDO: el numero manda, la unidad lo acota --- */
  return (
    <div title={[d.motivo, d.estado].filter(Boolean).join(" · ")} style={{ minWidth: 0 }}>
      <div
        style={{
          color: "#FFFFFF",
          fontFamily: "monospace",
          fontSize: compacto ? "13px" : "16px",
          lineHeight: 1.2
        }}
      >
        {typeof d.valor === "number" ? d.valor.toLocaleString("es-EC") : d.valor}
      </div>

      {d.unidad && (
        <div
          style={{
            color: "var(--sentinel-texto-tenue)",
            fontSize: "9.5px",
            marginTop: "3px",
            lineHeight: 1.4
          }}
        >
          {d.unidad}
        </div>
      )}

      {/*
        Un valor medido puede llevar aviso: «parcial» no es lo
        mismo que «medido», y la diferencia importa mas que el
        numero.
      */}
      {d.estado && d.estado !== "MEDIDO" && !compacto && (
        <div style={{ color: tono.color, fontSize: "9px", marginTop: "2px" }}>
          {textoDeEstado(d.estado)}
        </div>
      )}
    </div>
  );
}
