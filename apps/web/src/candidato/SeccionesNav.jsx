import { SECCIONES } from "./secciones";

/*
===========================================================
NAV DE SECCIONES DE CANDIDATE — §17
===========================================================

Una fila de pestanas. Las que todavia no se agregan a nivel de
proyecto llevan su marca y se pueden abrir: al hacerlo dicen
donde vive hoy su dato en lugar de mostrar una pantalla vacia.

Se pueden abrir a proposito. Una pestana deshabilitada no
explica nada; esta explica.
===========================================================
*/

export default function SeccionesNav({ seccion, onSeleccionar }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "3px",
        flexWrap: "wrap",
        marginTop: "18px",
        borderBottom: "1px solid var(--sentinel-borde)",
        paddingBottom: "1px"
      }}
    >
      {SECCIONES.map((s) => {
        const activa = s.id === seccion;

        return (
          <button
            key={s.id}
            onClick={() => onSeleccionar(s.id)}
            title={s.pregunta}
            style={{
              background: "transparent",
              border: "none",
              borderBottom: activa
                ? "2px solid var(--sentinel-cyan)"
                : "2px solid transparent",
              color: activa ? "#FFFFFF" : "var(--sentinel-texto-suave)",
              fontSize: "11.5px",
              padding: "7px 11px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              whiteSpace: "nowrap"
            }}
          >
            {s.etiqueta}

            {s.estado === "EN_PREPARACION" && (
              <span
                style={{
                  color: "var(--sentinel-texto-tenue)",
                  fontSize: "8px",
                  letterSpacing: "0.8px",
                  border: "1px solid var(--sentinel-borde-vivo)",
                  borderRadius: "var(--radio-pill)",
                  padding: "1px 5px"
                }}
              >
                EN PREP.
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
