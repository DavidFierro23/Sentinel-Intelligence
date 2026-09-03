/*
===========================================================
SECCION DECLARADA — §17
===========================================================

Lo que ve el analista al abrir una seccion que todavia no se
agrega a nivel de proyecto: la pregunta que respondera, el
estado real y DONDE VIVE HOY ese dato.

Esa ultima linea es la que evita el malentendido. Sin ella, una
pestana «Conversación · EN PREP.» se lee como «Sentinel no
observa conversación», cuando en el piloto hay 147 piezas
observadas por candidato.
===========================================================
*/

export default function SeccionEnPreparacion({ seccion }) {
  if (!seccion) return null;

  return (
    <div
      style={{
        background: "var(--sentinel-surface)",
        border: "1px solid var(--sentinel-borde)",
        borderRadius: "var(--radio-m)",
        padding: "18px 19px",
        marginTop: "16px"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap"
        }}
      >
        <strong style={{ color: "#FFFFFF", fontSize: "13.5px" }}>
          {seccion.etiqueta}
        </strong>

        <span
          style={{
            color: "var(--sentinel-texto-suave)",
            border: "1px solid var(--sentinel-borde-vivo)",
            borderRadius: "var(--radio-pill)",
            padding: "2px 9px",
            fontSize: "9.5px"
          }}
        >
          En preparación
        </span>
      </div>

      <div
        style={{
          color: "var(--sentinel-texto-suave)",
          fontSize: "11.5px",
          marginTop: "9px",
          lineHeight: 1.7
        }}
      >
        Responderá: <em style={{ fontStyle: "normal", color: "var(--sentinel-texto)" }}>
          {seccion.pregunta}
        </em>
      </div>

      {seccion.donde && (
        <div
          style={{
            color: "var(--sentinel-texto-tenue)",
            fontSize: "10.5px",
            marginTop: "8px",
            lineHeight: 1.7
          }}
        >
          {seccion.donde}
        </div>
      )}
    </div>
  );
}
