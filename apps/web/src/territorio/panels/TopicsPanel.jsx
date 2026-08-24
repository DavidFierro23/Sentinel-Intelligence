import { useState } from "react";
import { Tags, ChevronDown, ChevronRight } from "lucide-react";

/*
===========================================================
TEMAS Y ENCUADRE
===========================================================

DOS COSAS QUE ESTE PANEL HACE Y CASI NINGUNO HACE
-----------------------------------------------------------

1. Cada tema explica POR QUE sus evidencias estan juntas.
   El agrupamiento es determinista y la explicacion es
   literal: comparten estos terminos. Un cluster semantico
   respondaria con una distancia que nadie puede auditar
   (IA1, Cap. 9).

2. El reparto de encuadre se calcula sobre las evidencias
   DETERMINADAS, y las no determinables se muestran aparte con
   su propia cifra.

   Es la decision que mas cambia la lectura. Metido en el
   denominador, «critico 12 %» parece marginal; fuera de el,
   el mismo dato es «critico 60 % de lo que se pudo
   clasificar, y el 80 % no se pudo clasificar». Las dos
   frases son ciertas y solo la segunda es util.
===========================================================
*/

const COLOR_ENCUADRE = {
  critico: "#d55181",
  favorable: "#008300",
  neutro: "#64748b",
  no_determinable: "#334155"
};

const ETIQUETA_ENCUADRE = {
  critico: "crítico",
  favorable: "favorable",
  neutro: "neutro",
  no_determinable: "no determinable"
};


function Tema({ tema }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div
      style={{
        border: "1px solid var(--sentinel-borde)",
        borderRadius: "var(--radio-m)",
        background: "var(--sentinel-surface-alta)",
        overflow: "hidden"
      }}
    >
      <button
        onClick={() => setAbierto((v) => !v)}
        className="sentinel-hover"
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "10px 12px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left"
        }}
      >
        {abierto ? (
          <ChevronDown size={13} color="var(--sentinel-texto-tenue)" />
        ) : (
          <ChevronRight size={13} color="var(--sentinel-texto-tenue)" />
        )}

        <span
          style={{
            flex: 1,
            color: "var(--sentinel-texto)",
            fontSize: "12.5px",
            fontWeight: 600,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis"
          }}
        >
          {tema.nombre}
        </span>

        <span
          style={{
            color: "var(--sentinel-texto-tenue)",
            fontSize: "9.5px",
            border: "1px solid var(--sentinel-borde)",
            borderRadius: "var(--radio-pill)",
            padding: "2px 7px",
            flexShrink: 0
          }}
        >
          {tema.origen === "lexico" ? "léxico declarado" : "emergente"}
        </span>

        <span
          style={{
            color: "var(--sentinel-cyan)",
            fontSize: "13px",
            fontWeight: 700,
            flexShrink: 0
          }}
        >
          {tema.evidencias}
        </span>
      </button>

      {abierto && (
        <div
          style={{
            padding: "0 12px 12px 35px",
            display: "flex",
            flexDirection: "column",
            gap: "8px"
          }}
        >
          {/* POR QUE estan juntas */}
          <div
            style={{
              color: "var(--sentinel-texto-suave)",
              fontSize: "11.5px",
              lineHeight: 1.7
            }}
          >
            {tema.explicacion}
          </div>

          {tema.titulares?.length > 0 && (
            <ul
              style={{
                margin: 0,
                paddingLeft: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "4px"
              }}
            >
              {tema.titulares.map((t, i) => (
                <li
                  key={i}
                  style={{
                    color: "var(--sentinel-texto-tenue)",
                    fontSize: "11px",
                    lineHeight: 1.6
                  }}
                >
                  {t}
                </li>
              ))}
            </ul>
          )}

          <div
            style={{
              color: "var(--sentinel-texto-tenue)",
              fontSize: "10.5px"
            }}
          >
            {tema.primeraFecha ? `desde ${tema.primeraFecha.slice(0, 10)}` : "sin fecha"}
            {tema.ultimaFecha ? ` · hasta ${tema.ultimaFecha.slice(0, 10)}` : ""}
            {tema.evidenciasSinFecha
              ? ` · ${tema.evidenciasSinFecha} sin fecha`
              : ""}
          </div>
        </div>
      )}
    </div>
  );
}


export default function TopicsPanel({ conversacion }) {
  const temas = conversacion?.temas?.temas || [];

  const encuadre = conversacion?.encuadre;

  const conteo = encuadre?.conteo || {};

  const reparto = encuadre?.reparto;

  const noDeterminables = conteo.no_determinable || 0;

  const total = encuadre?.metricas?.total || 0;

  return (
    <section
      style={{
        background: "var(--sentinel-surface)",
        border: "1px solid var(--sentinel-borde)",
        borderRadius: "var(--radio-l)",
        padding: "18px 20px"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "9px",
          marginBottom: "14px"
        }}
      >
        <Tags size={15} color="var(--sentinel-cyan)" />

        <span
          style={{
            color: "var(--sentinel-cyan)",
            fontSize: "10px",
            letterSpacing: "1.8px",
            textTransform: "uppercase",
            fontWeight: 600
          }}
        >
          Temas y encuadre
        </span>
      </div>

      {/* ENCUADRE */}
      {encuadre && (
        <div style={{ marginBottom: "16px" }}>
          <div
            style={{
              display: "flex",
              height: "10px",
              borderRadius: "3px",
              overflow: "hidden",
              background: "var(--sentinel-bg)"
            }}
          >
            {["critico", "favorable", "neutro"].map((k) => {
              const v = reparto?.[k] || 0;

              if (!v) return null;

              return (
                <div
                  key={k}
                  title={`${ETIQUETA_ENCUADRE[k]}: ${v} % de lo determinado`}
                  style={{ width: `${v}%`, background: COLOR_ENCUADRE[k] }}
                />
              );
            })}
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              marginTop: "9px"
            }}
          >
            {["critico", "favorable", "neutro"].map((k) => (
              <span
                key={k}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  color: "var(--sentinel-texto-suave)",
                  fontSize: "11px"
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "2px",
                    background: COLOR_ENCUADRE[k],
                    flexShrink: 0
                  }}
                />
                {ETIQUETA_ENCUADRE[k]} {conteo[k] || 0}
                {reparto ? ` (${reparto[k]} %)` : ""}
              </span>
            ))}
          </div>

          {/*
            Las no determinables, FUERA del reparto y con su
            propia cifra. Es la parte que decide como se lee
            todo lo anterior.
          */}
          <div
            style={{
              marginTop: "10px",
              padding: "9px 11px",
              background: "var(--sentinel-surface-alta)",
              border: "1px solid var(--sentinel-borde)",
              borderRadius: "var(--radio-m)",
              color: "var(--sentinel-texto-suave)",
              fontSize: "11px",
              lineHeight: 1.7
            }}
          >
            <strong style={{ color: "var(--sentinel-texto)" }}>
              {noDeterminables} de {total}
            </strong>{" "}
            sin encuadre determinable
            {total > 0
              ? ` (${encuadre.metricas.porcentajeNoDeterminable} %)`
              : ""}
            . No se cuentan como neutras y quedan fuera de los porcentajes de
            arriba, que son{" "}
            <em>{reparto?.base || "sobre lo determinado"}</em>.
            <div
              style={{
                color: "var(--sentinel-texto-tenue)",
                fontSize: "10.5px",
                marginTop: "5px"
              }}
            >
              El clasificador es léxico: no detecta ironía ni negación, y
              califica el texto publicado, nunca a la persona mencionada.
            </div>
          </div>
        </div>
      )}

      {/* TEMAS */}
      {temas.length === 0 ? (
        <div
          style={{
            color: "var(--sentinel-texto-suave)",
            fontSize: "12px",
            lineHeight: 1.7
          }}
        >
          Ningún grupo de evidencias alcanzó el umbral para constituir un tema.
          No es que no traten de nada: es que no hay suficientes parecidas.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
          {temas.map((t) => (
            <Tema key={t.id} tema={t} />
          ))}
        </div>
      )}

      {conversacion?.temas?.descartados?.length > 0 && (
        <div
          style={{
            marginTop: "12px",
            paddingTop: "10px",
            borderTop: "1px solid var(--sentinel-borde)",
            color: "var(--sentinel-texto-tenue)",
            fontSize: "10.5px",
            lineHeight: 1.7
          }}
        >
          {conversacion.temas.descartados.length} agrupación(es) descartadas por
          no alcanzar el umbral:{" "}
          {conversacion.temas.descartados
            .slice(0, 6)
            .map((d) => `${d.nombre} (${d.evidencias})`)
            .join(" · ")}
        </div>
      )}
    </section>
  );
}
