import { useState } from "react";
import { ShieldAlert, ChevronDown, ChevronRight } from "lucide-react";

/*
===========================================================
AVISO DE COBERTURA
===========================================================

El corpus llega con sesgo de recolección demostrado: 2 de las
4 consultas por defecto llevan vocabulario de gestión pública.

Esconderlo convertiría una lectura parcial en una conclusión.

DOS NIVELES, A PROPOSITO
-----------------------------------------------------------

Las limitaciones marcadas `visibleSiempre` se leen sin hacer
nada. El resto se pliega.

Un aviso que hay que desplegar para verlo no es un aviso: es
una nota al pie. Y las tres que más cambian la lectura —corpus
parcial, sin ventana comparable, publicaciones no personas—
tienen que verse antes que las cifras, no después.
===========================================================
*/

export default function CoverageWarning({ limitaciones = [] }) {
  const [abierto, setAbierto] = useState(false);

  const lista = limitaciones || [];

  if (lista.length === 0) return null;

  const siempre = lista.filter((l) => l.visibleSiempre);

  const plegadas = lista.filter((l) => !l.visibleSiempre);

  return (
    <section
      style={{
        background: "rgba(201,133,0,.08)",
        border: "1px solid #c98500",
        borderRadius: "var(--radio-l)",
        padding: "14px 18px"
      }}
    >
      <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
        <ShieldAlert
          size={16}
          color="#eda100"
          style={{ flexShrink: 0, marginTop: "2px" }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              color: "#eda100",
              fontSize: "11.5px",
              fontWeight: 650,
              letterSpacing: "0.3px"
            }}
          >
            Lectura basada en las fuentes y consultas actualmente observadas
          </div>

          <div
            style={{
              color: "var(--sentinel-texto-suave)",
              fontSize: "11.5px",
              lineHeight: 1.7,
              marginTop: "6px"
            }}
          >
            No representa la totalidad de la conversación de Cuenca.
          </div>

          <ul
            style={{
              margin: "9px 0 0 0",
              paddingLeft: "17px",
              display: "flex",
              flexDirection: "column",
              gap: "5px"
            }}
          >
            {siempre
              .filter((l) => l.id !== "corpus_parcial")
              .map((l) => (
                <li
                  key={l.id}
                  style={{
                    color: "var(--sentinel-texto-suave)",
                    fontSize: "11px",
                    lineHeight: 1.65
                  }}
                >
                  <strong style={{ color: "var(--sentinel-texto)" }}>
                    {l.titulo}.
                  </strong>{" "}
                  {l.detalle}
                </li>
              ))}
          </ul>

          {plegadas.length > 0 && (
            <>
              <button
                onClick={() => setAbierto((v) => !v)}
                className="sentinel-hover"
                style={{
                  marginTop: "9px",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "2px 0",
                  color: "#eda100",
                  fontSize: "11px",
                  fontWeight: 600
                }}
              >
                {abierto ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {abierto
                  ? "Ver menos"
                  : `Ver ${plegadas.length} limitación(es) más`}
              </button>

              {abierto && (
                <ul
                  style={{
                    margin: "8px 0 0 0",
                    paddingLeft: "17px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "5px"
                  }}
                >
                  {plegadas.map((l) => (
                    <li
                      key={l.id}
                      style={{
                        color: "var(--sentinel-texto-tenue)",
                        fontSize: "10.5px",
                        lineHeight: 1.65
                      }}
                    >
                      <strong>{l.titulo}.</strong> {l.detalle}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
