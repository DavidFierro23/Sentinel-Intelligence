import { Info } from "lucide-react";

import CandidatePhoto from "../components/CandidatePhoto";
import { textoDeEstado, tonoDeEstado } from "../workspace/estados";
import {
  ETIQUETA_PLATAFORMA,
  IDENTIDAD,
  ayudaDeMedicion,
  DISCLAIMER
} from "./dimensionesEstrategicas";

/*
===========================================================
MATRIZ CANONICA DE PLATAFORMAS — CANDIDATE-STRATEGIC-UX-01B
===========================================================

7 candidatos x 5 plataformas = 35 celdas, visibles de golpe.

QUE FALLO EN LA CERTIFICACION ANTERIOR
-----------------------------------------------------------

`BaselineT0Panel` tenia las columnas escritas a mano, y solo
para dos plataformas:

    X segs · X pub · orig · rep · X vistas · X likes
    YT subs · YT vid · YT vistas · Cobertura

El payload de `/linea-base` traia las CINCO en
`candidatos[].plataformas`. Facebook, Instagram y TikTok
llegaban al navegador y no se pintaban nunca.

Asi que Candidate Intelligence parecia medir dos plataformas,
y la pregunta obvia era «¿dónde están Facebook, Instagram y
TikTok?».

LO QUE ESTA TABLA RESPONDE
-----------------------------------------------------------

«¿Que activos tenemos resueltos y cuales podemos medir?»

NO responde «¿quien va ganando?», y por eso:

    no suma nada entre plataformas —un seguidor de TikTok y un
    suscriptor de YouTube no son la misma unidad—;

    no ordena las filas por numero de celdas medidas;

    no pinta barras ni semaforos de desempeno.

DOS EJES POR CELDA
-----------------------------------------------------------

Arriba la MEDICION, debajo la IDENTIDAD. Son preguntas
distintas y la matriz existe en parte para que no se confundan:
el caso de Yaku Perez en YouTube es identidad confirmada por el
analista con medicion sin via disponible.

EL COLOR NO CALIFICA AL CANDIDATO
-----------------------------------------------------------

Verde es «medido», ambar es «no lo sabemos», gris es «no hay
via». Rojo solo aparece en un conflicto de identidad, que es lo
unico que exige una decision humana.

Ninguno dice si el candidato esta mejor o peor: dicen en que
estado esta NUESTRA medicion.
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
  padding: "9px",
  borderBottom: "1px solid var(--sentinel-borde)",
  verticalAlign: "top"
};


/* Un numero legible, o una raya. Nunca un 0 que signifique «no sé». */
function Metrica({ metrica, activosTotal }) {
  if (!metrica || metrica.valor == null) {
    return (
      <div
        title="No hay métrica disponible para este activo. Un «—» no es un cero."
        style={{
          color: "var(--sentinel-texto-tenue)",
          fontFamily: "monospace",
          fontSize: "11px",
          marginTop: "4px"
        }}
      >
        —
      </div>
    );
  }

  /*
    Si hay varios activos y solo uno medido, el numero es de UNO.
    Decirlo evita que se lea como el total de la plataforma.
  */
  const parcial =
    activosTotal > 1 && metrica.activosConMetrica < activosTotal;

  return (
    <div
      title={[
        `${metrica.valor.toLocaleString("es-EC")} ${metrica.nombre}`,
        metrica.accountId,
        metrica.provider ? `vía ${metrica.provider}` : null,
        metrica.capturedAt ? `medido ${String(metrica.capturedAt).slice(0, 10)}` : null,
        parcial
          ? `de ${metrica.activosConMetrica} de ${activosTotal} activos`
          : null
      ]
        .filter(Boolean)
        .join(" · ")}
      style={{ marginTop: "4px" }}
    >
      <span
        style={{
          color: "var(--sentinel-texto)",
          fontFamily: "monospace",
          fontSize: "11.5px"
        }}
      >
        {metrica.valor.toLocaleString("es-EC")}
      </span>

      <span
        style={{
          color: "var(--sentinel-texto-tenue)",
          fontSize: "9px",
          marginLeft: "4px"
        }}
      >
        {metrica.nombre}
        {parcial ? " ·¹" : ""}
      </span>
    </div>
  );
}


function Celda({ celda }) {
  if (!celda) {
    return (
      <td style={td}>
        <span style={{ color: "var(--sentinel-texto-tenue)" }}>—</span>
      </td>
    );
  }

  const estado = celda.medicion?.estado || null;

  const tono = tonoDeEstado(estado);

  const ident = IDENTIDAD[celda.identidad?.estado] || null;

  return (
    <td style={td}>
      {/* EJE 1 — ¿podemos medirla? */}
      <span
        title={[ayudaDeMedicion(estado), celda.medicion?.motivo, estado]
          .filter(Boolean)
          .join(" · ")}
        style={{
          color: tono.color,
          border: `1px solid ${tono.borde}`,
          borderRadius: "var(--radio-pill)",
          padding: "2px 7px",
          fontSize: "9px",
          whiteSpace: "nowrap",
          display: "inline-block"
        }}
      >
        {textoDeEstado(estado)}
      </span>

      <Metrica metrica={celda.metrica} activosTotal={celda.activosTotal} />

      {/* EJE 2 — ¿de quién es? */}
      {ident && (
        <div
          title={ident.explica}
          style={{
            color: "var(--sentinel-texto-tenue)",
            fontSize: "9px",
            marginTop: "4px",
            lineHeight: 1.4
          }}
        >
          {ident.texto}
          {celda.activosTotal > 1 ? ` · ${celda.activosTotal} activos` : ""}
        </div>
      )}

      {/*
        LA MEDICION QUE NO CASA. Se muestra porque sin ella la
        celda diria «sin vía disponible» mientras hay una medicion
        real persistida que la clasificacion no puede usar.
      */}
      {celda.medicionesHuerfanas && (
        <div
          title={`${celda.medicionesHuerfanas.motivo} Medición: ${celda.medicionesHuerfanas.accountIds.join(", ")}. Activo de la ficha: ${celda.medicionesHuerfanas.activosDeLaFicha.join(", ")}.`}
          style={{
            color: "#eda100",
            fontSize: "9px",
            marginTop: "4px",
            lineHeight: 1.4
          }}
        >
          ⚠ medición sin activo que case
        </div>
      )}
    </td>
  );
}


export default function MatrizPlataformas({ matriz }) {
  if (!matriz) return null;

  if (matriz.ok === false) {
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
        {matriz.motivo || "La matriz de plataformas no está disponible."}
      </div>
    );
  }

  const plataformas = matriz.plataformas || [];

  const filas = matriz.candidatos || [];

  if (!filas.length) {
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
        Ningún candidato observado todavía en este proyecto.
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--sentinel-surface)",
        border: "1px solid var(--sentinel-borde)",
        borderRadius: "var(--radio-m)",
        padding: "4px 2px 14px"
      }}
    >
      {/*
        Scroll horizontal controlado: en pantalla estrecha la
        tabla se desplaza, pero NUNCA se oculta una plataforma.
        Ocultarla sin decirlo es como se produjo el defecto que
        este gate corrige.
      */}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", minWidth: "880px" }}
        >
          <thead>
            <tr>
              <th style={{ ...th, paddingLeft: "14px" }}>Candidato</th>

              {plataformas.map((p) => (
                <th key={p} style={th}>
                  {ETIQUETA_PLATAFORMA[p] || p}
                </th>
              ))}

              <th
                style={{
                  ...th,
                  borderLeft: "1px solid var(--sentinel-borde)",
                  textAlign: "right",
                  paddingRight: "14px"
                }}
              >
                Cobertura
              </th>
            </tr>
          </thead>

          <tbody>
            {filas.map((f) => (
              <tr key={f.candidateId}>
                <td style={{ ...td, paddingLeft: "14px", minWidth: "170px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                    <CandidatePhoto
                      foto={f.foto || null}
                      nombre={f.nombre}
                      tamano={30}
                      radio="50%"
                    />

                    <div
                      style={{
                        color: "var(--sentinel-texto)",
                        fontSize: "11.5px",
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                      }}
                    >
                      {f.nombre}
                    </div>
                  </div>
                </td>

                {plataformas.map((p) => (
                  <Celda key={p} celda={f.celdas?.[p]} />
                ))}

                {/*
                  DOS CUENTAS, NO UNA — §12.

                  «5/5» a secas decia «medidas» y no lo eran.
                  Resueltas es siempre 5 de 5 porque el cierre lo
                  garantiza, y por si solo no dice nada del
                  candidato; medidas es la que importa.
                */}
                <td
                  style={{
                    ...td,
                    borderLeft: "1px solid var(--sentinel-borde)",
                    textAlign: "right",
                    paddingRight: "14px",
                    whiteSpace: "nowrap"
                  }}
                  title={f.cobertura?.noEs}
                >
                  <div
                    style={{
                      color: "var(--sentinel-texto)",
                      fontFamily: "monospace",
                      fontSize: "11.5px"
                    }}
                  >
                    {f.cobertura?.expresionMedidas}
                  </div>

                  <div
                    style={{
                      color: "var(--sentinel-texto-tenue)",
                      fontSize: "9px",
                      marginTop: "3px"
                    }}
                  >
                    {f.cobertura?.expresionResueltas}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* RECUENTO REAL. Sale de los datos, no de una constante. */}
      <div
        style={{
          display: "flex",
          gap: "14px",
          flexWrap: "wrap",
          alignItems: "center",
          margin: "12px 14px 0",
          paddingTop: "11px",
          borderTop: "1px solid var(--sentinel-borde)"
        }}
      >
        <span
          style={{ color: "var(--sentinel-texto-suave)", fontSize: "10.5px" }}
          title="Cada celda tiene un estado operacional explícito. Ninguna queda sin resolver."
        >
          {matriz.celdasResueltas} de {matriz.totalCeldas} celdas resueltas
        </span>

        {Object.entries(matriz.distribucion || {})
          .sort((a, b) => b[1] - a[1])
          .map(([estado, n]) => {
            const tono = tonoDeEstado(estado);

            return (
              <span
                key={estado}
                title={ayudaDeMedicion(estado) || estado}
                style={{ color: tono.color, fontSize: "10px" }}
              >
                {n} {textoDeEstado(estado)}
              </span>
            );
          })}
      </div>

      {/* LO QUE ESTA MATRIZ NO SABE. Lo declara el backend. */}
      {(matriz.limitaciones || []).length > 0 && (
        <div
          style={{
            display: "flex",
            gap: "9px",
            alignItems: "flex-start",
            color: "var(--sentinel-texto-tenue)",
            fontSize: "10px",
            lineHeight: 1.7,
            margin: "10px 14px 0"
          }}
        >
          <Info size={13} style={{ flexShrink: 0, marginTop: "2px" }} />

          <div>
            {matriz.limitaciones.map((l) => (
              <div key={l.id} style={{ marginBottom: "3px" }}>
                {l.texto}
              </div>
            ))}

            <div style={{ marginTop: "6px" }}>
              Las columnas no se suman: un seguidor de TikTok y un suscriptor de
              YouTube no son la misma unidad. Un «—» significa que no hay dato,
              no que valga cero. {DISCLAIMER}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
