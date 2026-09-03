import DimensionCelda from "./DimensionCelda";

/*
===========================================================
BLOQUE ESTRATEGICO DE LA FICHA — CANDIDATE-STRATEGIC-UX-01
===========================================================

Las seis dimensiones, en linea, como PRIMER contenido de la
ficha del candidato. Antes ese sitio lo ocupaba «Solidez
68/100».

POR QUE VA ARRIBA
-----------------------------------------------------------

Porque es la respuesta a «¿que esta pasando digitalmente con
este candidato?», que es la pregunta con la que alguien abre
esta pantalla. La completitud del expediente es una propiedad
de nuestro trabajo y baja al segundo nivel.

NO HAY TOTAL NI PROMEDIO
-----------------------------------------------------------

Seis dimensiones, seis lecturas. No se combinan: un indice
compuesto sin metodologia se leeria como un ranking, y el
propio backend ya se niega a producirlo —`presencia.indice`
llega con `disponible:false` y cinco requisitos sin cumplir—.
===========================================================
*/

export default function DimensionesStrip({ dimensiones = [], onVerEvidencias = null }) {
  if (!dimensiones.length) return null;

  return (
    <div style={{ marginTop: "13px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))",
          gap: "10px",
          alignItems: "start"
        }}
      >
        {dimensiones.map((d) => (
          <div key={d.id} title={d.pregunta} style={{ minWidth: 0 }}>
            <div
              style={{
                color: "var(--sentinel-texto-suave)",
                fontSize: "9px",
                letterSpacing: "1.1px",
                textTransform: "uppercase",
                marginBottom: "5px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
            >
              {d.corto}
            </div>

            <DimensionCelda dimension={d} />
          </div>
        ))}
      </div>

      {/*
        LA RUTA senal -> explicacion -> evidencia. El «¿por que?»
        no genera ninguna explicacion causal: lleva a la
        evidencia que sostiene el estado, que es lo unico que hoy
        se puede sostener.
      */}
      {onVerEvidencias && (
        <button
          className="sentinel-boton"
          onClick={onVerEvidencias}
          title="Lleva a la evidencia que sostiene estos estados. No genera explicaciones causales."
          style={{
            marginTop: "11px",
            padding: "4px 11px",
            fontSize: "10px"
          }}
        >
          ¿Por qué?
        </button>
      )}
    </div>
  );
}
