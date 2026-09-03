import { Info } from "lucide-react";

import CandidatePhoto from "../components/CandidatePhoto";
import DimensionCelda from "./DimensionCelda";
import { DIMENSIONES, COBERTURA_DE_DATOS, DISCLAIMER } from "./dimensionesEstrategicas";

/*
===========================================================
COMPARACION ESTRATEGICA — CANDIDATE-STRATEGIC-UX-01
===========================================================

LO QUE HABIA AQUI
-----------------------------------------------------------

Una lista ordenada por `cobertura` descendente, con barra de
progreso y color por tramos: verde arriba, rojo abajo.

    Juan Cristóbal Lloret  68%  ████████████
    Pedro Palacios         68%  ████████████
    Yaku Pérez             63%  ███████████
    ...

Eso es un ranking. El disclaimer decia que no lo era, pero la
forma decia lo contrario, y la forma gana. Un estratega leia
«Lloret va primero».

Y lo que ordenaba la lista era la completitud del expediente:
Lloret aparecia arriba porque se le habia investigado 22 veces
—contra 1 de Palacios—, no por nada que hubiera hecho.

LO QUE HAY AHORA
-----------------------------------------------------------

Una matriz candidato x dimension. Cada columna se lee por
separado y ninguna se combina con otra.

TRES DECISIONES QUE SOSTIENEN LA HONESTIDAD
-----------------------------------------------------------

  1. EL ORDEN ES EL DECLARADO, no un ranking. Los candidatos
     salen en el orden en que el analista los agrego. Sin
     `sort`, porque cualquier criterio de orden se lee como
     posicion.

  2. NO HAY BARRAS. Una barra codifica magnitud sobre un
     maximo, y aqui no hay maximo: 23 medios no es «mas cerca
     de ganar» que 12.

  3. COBERTURA DE DATOS va en la ULTIMA columna, en gris, bajo
     una cabecera que dice «técnico». No ordena nada.
===========================================================
*/

const th = {
  padding: "8px 9px",
  textAlign: "left",
  color: "var(--sentinel-texto-suave)",
  fontSize: "9px",
  letterSpacing: "1.1px",
  textTransform: "uppercase",
  fontWeight: 500,
  whiteSpace: "nowrap",
  borderBottom: "1px solid var(--sentinel-borde)",
  verticalAlign: "bottom"
};

const td = {
  padding: "10px 9px",
  borderBottom: "1px solid var(--sentinel-borde)",
  verticalAlign: "top"
};


export default function ComparacionEstrategica({ filas = [] }) {
  if (filas.length < 2) {
    return (
      <div
        style={{
          background: "var(--sentinel-surface)",
          border: "1px solid var(--sentinel-borde)",
          borderRadius: "var(--radio-m)",
          padding: "16px",
          color: "var(--sentinel-texto-tenue)",
          fontSize: "12px"
        }}
      >
        Disponible cuando haya al menos dos candidatos observados.
        {filas.length === 1 ? " Hay uno." : ""}
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--sentinel-surface)",
        border: "1px solid var(--sentinel-borde)",
        borderRadius: "var(--radio-m)",
        padding: "4px 2px 14px",
        overflowX: "auto"
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "820px" }}>
        <thead>
          <tr>
            <th style={{ ...th, paddingLeft: "14px" }}>Candidato</th>

            {DIMENSIONES.map((d) => (
              <th key={d.id} style={th} title={d.pregunta}>
                {d.corto}
              </th>
            ))}

            {/*
              La columna tecnica se separa del resto con un borde
              y se nombra «técnico» en la propia cabecera. No es
              una dimension estrategica y no debe leerse como una.
            */}
            <th
              style={{
                ...th,
                borderLeft: "1px solid var(--sentinel-borde)",
                color: "var(--sentinel-texto-tenue)",
                textAlign: "right",
                paddingRight: "14px"
              }}
              title={COBERTURA_DE_DATOS.explicacion}
            >
              {COBERTURA_DE_DATOS.nombre}
              <div
                style={{
                  fontSize: "8.5px",
                  letterSpacing: 0,
                  textTransform: "none",
                  color: "var(--sentinel-texto-tenue)",
                  fontWeight: 400
                }}
              >
                indicador técnico
              </div>
            </th>
          </tr>
        </thead>

        <tbody>
          {filas.map((f) => (
            <tr key={f.candidateId}>
              <td style={{ ...td, paddingLeft: "14px", minWidth: "180px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                  {/*
                    La MISMA fotografia que la ficha. `CandidatePhoto`
                    valida la URL y cae a iniciales: la ausencia de
                    foto no puede romper la comparacion.
                  */}
                  <CandidatePhoto
                    foto={f.foto || null}
                    nombre={f.nombre}
                    tamano={34}
                    radio="50%"
                  />

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        color: "var(--sentinel-texto)",
                        fontSize: "12px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {f.nombre}
                    </div>

                    {f.comparabilidad && (
                      <div
                        style={{
                          color: "var(--sentinel-texto-tenue)",
                          fontSize: "9px",
                          marginTop: "2px"
                        }}
                        title={f.comparabilidad.motivo || undefined}
                      >
                        {f.comparabilidad.estado === "COMPARABLE"
                          ? "comparable"
                          : f.comparabilidad.estado === "PARCIALMENTE_COMPARABLE"
                            ? "parcialmente comparable"
                            : "no comparable"}
                      </div>
                    )}
                  </div>
                </div>
              </td>

              {DIMENSIONES.map((d) => {
                const dim = (f.dimensiones || []).find((x) => x.id === d.id);

                return (
                  <td key={d.id} style={td}>
                    <DimensionCelda dimension={dim} compacto />
                  </td>
                );
              })}

              <td
                style={{
                  ...td,
                  borderLeft: "1px solid var(--sentinel-borde)",
                  textAlign: "right",
                  paddingRight: "14px",
                  fontFamily: "monospace",
                  fontSize: "11px",
                  color: "var(--sentinel-texto-tenue)"
                }}
                title={COBERTURA_DE_DATOS.explicacion}
              >
                {f.coberturaDeDatos == null ? "—" : `${f.coberturaDeDatos}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div
        style={{
          display: "flex",
          gap: "9px",
          alignItems: "flex-start",
          color: "var(--sentinel-texto-suave)",
          fontSize: "10.5px",
          lineHeight: 1.65,
          margin: "12px 14px 0",
          paddingTop: "11px",
          borderTop: "1px solid var(--sentinel-borde)"
        }}
      >
        <Info size={13} style={{ flexShrink: 0, marginTop: "2px" }} />

        <span>
          Cada columna se lee por separado y ninguna se combina con otra: no hay
          una cifra única por candidato ni un orden de posición. El orden de las
          filas es el que declaró el analista. {DISCLAIMER}
        </span>
      </div>
    </div>
  );
}
