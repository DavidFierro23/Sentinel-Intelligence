import { textoDeEstado, tonoDeEstado } from "./estados";

/*
===========================================================
SENTINEL-UX-CONSOLIDATION-01 — CHIP DE ESTADO
===========================================================

Solo el componente. La tabla de estados y el traductor viven en
`estados.js`: un fichero que exporta un componente Y una funcion
rompe el fast refresh de Vite, y esa regla ya estaba escrita en
`Sidebar`.

El valor tecnico va en el `title` y la frase es lo que se lee:
quien presenta necesita «Cobertura insuficiente» y quien audita
necesita COBERTURA_INSUFICIENTE.
===========================================================
*/

export default function EstadoChip({ estado, texto, tono, titulo, compacto = false }) {
  if (!estado && !texto) return null;

  const t = tonoDeEstado(estado, tono);

  const visible = texto || textoDeEstado(estado);

  return (
    <span
      title={titulo || estado || undefined}
      style={{
        display: "inline-block",
        padding: compacto ? "1px 6px" : "2px 8px",
        borderRadius: "var(--radio-pill)",
        border: `1px solid ${t.borde}`,
        color: t.color,
        fontSize: compacto ? "0.58rem" : "0.62rem",
        letterSpacing: "0.05em",
        fontWeight: 600,
        whiteSpace: "nowrap",
        textTransform: "uppercase"
      }}
    >
      {visible}
    </span>
  );
}
