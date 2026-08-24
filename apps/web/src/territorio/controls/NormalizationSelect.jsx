import { Scale, Lock } from "lucide-react";

import { useTerritorial } from "../useTerritorial";

/*
===========================================================
SELECTOR DE NORMALIZACION — A LA VISTA, no en ajustes
===========================================================

Regla congelada §6.3: el selector va en la barra superior.
Cambiar el denominador cambia el resultado, y quien lo lee
debe saber cuál está mirando sin abrir un panel de ajustes.

LAS OPCIONES BLOQUEADAS SE MUESTRAN, NO SE ESCONDEN
-----------------------------------------------------------

Población y padrón aparecen deshabilitadas con el motivo
visible: «Dato oficial pendiente de integración».

Ocultarlas seria mas limpio y peor: el analista no sabria que
la normalizacion por poblacion EXISTE como capacidad del
sistema y que lo unico que falta es el dato del INEC. Una
opcion ausente parece una carencia de diseño; una opcion
bloqueada con motivo es una hoja de ruta.
===========================================================
*/

export default function NormalizationSelect() {
  const { normalizacion, setNormalizacion, catalogo, datos } = useTerritorial();

  /*
    Disponibilidad real: la del analisis en curso si lo hay, y
    la del catalogo si aun no se ejecuto ninguno.
  */
  const opciones =
    datos?.territorio?.normalizacion?.disponibles ||
    catalogo?.territorio?.normalizaciones ||
    [];

  if (opciones.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          color: "var(--sentinel-texto-tenue)",
          fontSize: "9.5px",
          letterSpacing: "1.2px",
          textTransform: "uppercase"
        }}
      >
        <Scale size={11} />
        Normalizar por
      </span>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {opciones.map((o) => {
          const activa = normalizacion === o.id;

          const bloqueada = o.disponible === false;

          return (
            <button
              key={o.id}
              disabled={bloqueada}
              onClick={() => setNormalizacion(o.id)}
              title={
                bloqueada
                  ? `${o.motivo} Dato oficial pendiente de integración.`
                  : o.aviso || o.nombre
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "5px 11px",
                borderRadius: "var(--radio-pill)",
                border: `1px solid ${
                  activa ? "var(--sentinel-cyan)" : "var(--sentinel-borde)"
                }`,
                background: activa ? "rgba(11,95,255,.18)" : "transparent",
                color: bloqueada
                  ? "var(--sentinel-texto-tenue)"
                  : activa
                    ? "#FFFFFF"
                    : "var(--sentinel-texto-suave)",
                fontSize: "11px",
                fontWeight: activa ? 650 : 500,
                cursor: bloqueada ? "not-allowed" : "pointer",
                opacity: bloqueada ? 0.55 : 1
              }}
            >
              {bloqueada && <Lock size={9} style={{ flexShrink: 0 }} />}
              {o.nombre}
            </button>
          );
        })}
      </div>

      {/*
        Aviso permanente del modo absoluto. No enganna usarlo:
        enganna usarlo creyendo que mide intensidad.
      */}
      {normalizacion === "absoluto" && (
        <span
          style={{
            color: "var(--sentinel-texto-tenue)",
            fontSize: "10px",
            lineHeight: 1.6,
            maxWidth: "340px"
          }}
        >
          Mapa de conteo: refleja tamaño y actividad de publicación, no
          intensidad relativa.
        </span>
      )}
    </div>
  );
}
