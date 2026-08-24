import { Layers, ShieldAlert } from "lucide-react";

/*
===========================================================
RESOLUTION NOTICE — GEO-1, visible
===========================================================

Anuncia la resolucion EFECTIVA, que no siempre es la pedida.

Regla de interaccion 3 (§11): «la resolucion se anuncia antes
de enganar». Si el analista pide parroquia y el dato solo
sostiene canton, tiene que verlo ANTES de leer las cifras, no
en una nota al pie despues de haber sacado conclusiones.

Y se muestra tambien cuando SI coincide. Un aviso que solo
aparece al fallar entrena a no buscarlo, y entonces su
ausencia deja de significar nada.
===========================================================
*/

export default function ResolutionNotice({ resolucion, geo1 }) {
  if (!resolucion) return null;

  const degradada = resolucion.coincide === false;

  const bloqueos = geo1?.bloqueos || 0;

  return (
    <div
      style={{
        display: "flex",
        gap: "10px",
        alignItems: "flex-start",
        background: degradada
          ? "rgba(201,133,0,.10)"
          : "var(--sentinel-surface-alta)",
        border: `1px solid ${
          degradada ? "#c98500" : "var(--sentinel-borde)"
        }`,
        borderRadius: "var(--radio-m)",
        padding: "12px 14px"
      }}
    >
      {degradada ? (
        <ShieldAlert
          size={16}
          color="#c98500"
          style={{ flexShrink: 0, marginTop: "1px" }}
        />
      ) : (
        <Layers
          size={16}
          color="var(--sentinel-cyan)"
          style={{ flexShrink: 0, marginTop: "1px" }}
        />
      )}

      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            color: degradada ? "#eda100" : "var(--sentinel-texto)",
            fontSize: "12.5px",
            fontWeight: 600
          }}
        >
          Resolución efectiva: {resolucion.efectiva || "ninguna"}
          {degradada && ` — se pidió ${resolucion.pedida}`}
        </div>

        <div
          style={{
            color: "var(--sentinel-texto-suave)",
            fontSize: "11.5px",
            lineHeight: 1.65,
            marginTop: "5px"
          }}
        >
          {resolucion.aviso ||
            `Los datos sostienen la resolución solicitada (${resolucion.pedida}).`}
        </div>

        {bloqueos > 0 && (
          <div
            style={{
              color: "var(--sentinel-texto-tenue)",
              fontSize: "11px",
              lineHeight: 1.6,
              marginTop: "6px",
              borderTop: "1px solid var(--sentinel-borde)",
              paddingTop: "6px"
            }}
          >
            <strong style={{ color: "var(--sentinel-texto-suave)" }}>
              GEO-1
            </strong>{" "}
            impidió {bloqueos} atribución(es) a una unidad más fina que la que
            el dato sostiene. Esas evidencias no se descartaron: se agregaron
            en su unidad real.
          </div>
        )}

        <div
          style={{
            color: "var(--sentinel-texto-tenue)",
            fontSize: "10.5px",
            marginTop: "6px",
            fontStyle: "italic"
          }}
        >
          Nunca se pinta más fino que la resolución del dato.
        </div>
      </div>
    </div>
  );
}
