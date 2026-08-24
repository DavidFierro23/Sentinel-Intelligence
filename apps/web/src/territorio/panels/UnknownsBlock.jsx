import { useState } from "react";
import { ChevronDown, ChevronRight, EyeOff } from "lucide-react";

/*
===========================================================
LO QUE NO SABEMOS — bloque obligatorio (WR-D14)
===========================================================

No es un descargo legal: es la parte que impide una mala
decision. Un panel que solo enumera lo que encontro produce
exceso de confianza.

TRES DECISIONES DE PRESENTACION
-----------------------------------------------------------

1. NO se puede ocultar del todo. Se puede plegar la lista
   larga, pero el encabezado y el recuento quedan siempre a la
   vista. Un bloque cerrable por completo se cierra una vez y
   no se vuelve a abrir nunca.

2. Las primeras entradas se ven SIN desplegar. Si hay que
   hacer clic para leer la primera advertencia, no se lee.

3. Cuando la lista esta vacia tambien se dice, en lugar de
   desaparecer. «No hay limitaciones declaradas» es una
   afirmacion; la ausencia del bloque no dice nada.
===========================================================
*/

const VISIBLES_SIN_DESPLEGAR = 3;


export default function UnknownsBlock({ items = [], titulo = "Lo que no sabemos" }) {
  const [abierto, setAbierto] = useState(false);

  const lista = (items || []).filter(Boolean);

  const ocultos = Math.max(0, lista.length - VISIBLES_SIN_DESPLEGAR);

  const mostradas = abierto ? lista : lista.slice(0, VISIBLES_SIN_DESPLEGAR);

  return (
    <section
      style={{
        background: "var(--sentinel-surface)",
        border: "1px solid var(--sentinel-borde-vivo)",
        borderRadius: "var(--radio-l)",
        padding: "16px 18px"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "9px",
          marginBottom: lista.length ? "10px" : 0
        }}
      >
        <EyeOff size={15} color="var(--sentinel-cyan)" style={{ flexShrink: 0 }} />

        <span
          style={{
            color: "var(--sentinel-cyan)",
            fontSize: "10px",
            letterSpacing: "1.8px",
            textTransform: "uppercase",
            fontWeight: 600
          }}
        >
          {titulo}
        </span>

        <span
          style={{
            color: "var(--sentinel-texto-tenue)",
            fontSize: "10.5px"
          }}
        >
          {lista.length}
        </span>
      </div>

      {lista.length === 0 ? (
        <div
          style={{
            color: "var(--sentinel-texto-suave)",
            fontSize: "12px",
            lineHeight: 1.7
          }}
        >
          No hay limitaciones declaradas para esta vista. Ejecute un análisis
          para conocerlas.
        </div>
      ) : (
        <>
          <ul
            style={{
              margin: 0,
              paddingLeft: "18px",
              display: "flex",
              flexDirection: "column",
              gap: "7px"
            }}
          >
            {mostradas.map((t, i) => (
              <li
                key={i}
                style={{
                  color: "var(--sentinel-texto-suave)",
                  fontSize: "12px",
                  lineHeight: 1.7
                }}
              >
                {t}
              </li>
            ))}
          </ul>

          {ocultos > 0 && (
            <button
              onClick={() => setAbierto((v) => !v)}
              className="sentinel-hover"
              style={{
                marginTop: "10px",
                display: "flex",
                alignItems: "center",
                gap: "5px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "3px 0",
                color: "var(--sentinel-cyan)",
                fontSize: "11.5px",
                fontWeight: 600
              }}
            >
              {abierto ? (
                <ChevronDown size={13} />
              ) : (
                <ChevronRight size={13} />
              )}

              {abierto
                ? "Ver menos"
                : `Ver las otras ${ocultos} limitaciones declaradas`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
