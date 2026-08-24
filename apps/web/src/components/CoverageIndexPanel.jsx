import { useMemo, useState } from "react";
import { Gauge, HelpCircle, Check, Minus } from "lucide-react";

/*
===========================================================
ÍNDICE DE COBERTURA — Sprint 3.2.4, Bloque A (ARQ-WR-005)
===========================================================

Mide qué tan COMPLETO está el expediente, no qué tan importante
es la persona. Es una medida sobre nuestro propio trabajo.

POR QUÉ NO ES LA HUELLA DIGITAL
-----------------------------------------------------------

Son dos cosas distintas y conviene no confundirlas:

  Huella digital  la calcula el backend y mide la amplitud y
                  solidez de la presencia pública del objetivo.

  Cobertura       se calcula AQUÍ y mide cuántas piezas del
                  expediente hemos conseguido reunir.

Un objetivo puede tener huella baja y cobertura alta: significa
que hicimos bien nuestro trabajo y el resultado honesto es que
apenas tiene presencia. Y al revés: cobertura baja avisa de que
el expediente está incompleto y no se debe concluir todavía.

El cálculo del backend NO se toca. Este índice se compone de
seis piezas que el backend ya devuelve; aquí solo se cuentan y
se representan.

LO QUE NO MIDE, DICHO EN EL PROPIO PANEL
-----------------------------------------------------------

Ni popularidad ni intención de voto. El tooltip lo dice con esas
palabras porque un porcentaje grande junto al nombre de un
candidato invita exactamente a esa lectura equivocada.
===========================================================
*/

const TEXTO_TOOLTIP =
  "El Índice de Cobertura mide qué tan completo está el expediente de " +
  "inteligencia del candidato. No representa popularidad ni intención de voto.";

/*
  Escala de color fijada por el sprint.
*/
function colorDe(pct) {
  if (pct >= 90) return { color: "#22C55E", etiqueta: "Expediente completo" };
  if (pct >= 70) return { color: "#0B5FFF", etiqueta: "Expediente sólido" };
  if (pct >= 50) return { color: "#F59E0B", etiqueta: "Expediente parcial" };
  if (pct >= 30) return { color: "#F97316", etiqueta: "Expediente escaso" };
  return { color: "#EF4444", etiqueta: "Expediente insuficiente" };
}

const caja = {
  background: "var(--sentinel-surface)",
  border: "1px solid var(--sentinel-borde)",
  borderRadius: "var(--radio-m)",
  padding: "14px",
  boxSizing: "border-box"
};

export default function CoverageIndexPanel({ resultado, alias = null }) {
  const [tooltip, setTooltip] = useState(false);

  const piezas = useMemo(() => {
    const f = resultado?.fichaObjetivo || null;

    const pe = resultado?.perfilEjecutivo || null;

    const inte = resultado?.identidad?.inteligencia || null;

    /*
      Redes verificadas: plataformas distintas con al menos una
      cuenta atribuida al objetivo, sobre las seis obligatorias.
    */
    const plataformas = new Set(
      (pe?.tarjetas || []).map((t) => t.plataformaId).filter(Boolean)
    );

    /* Foto: la cascada usó un nivel real, no el respaldo generado. */
    const fotoReal =
      Boolean(inte) && (inte.nivelUsado || 4) < 4 && (inte.confianza || 0) > 0;

    /* Narrativas: términos que se repiten en los titulares. */
    /* Solo titulares web: los sociales los genera Sentinel. */
    const titulos = (f?.evidencias?.web || []).map((e) => e.titulo || "");

    const repetidos = new Map();

    titulos.forEach((t) =>
      String(t)
        .toLowerCase()
        .split(/[^a-záéíóúñ0-9]+/i)
        .filter((p) => p.length >= 6)
        .forEach((p) => repetidos.set(p, (repetidos.get(p) || 0) + 1))
    );

    const narrativas = [...repetidos.values()].filter((n) => n >= 2).length;

    /* Grafo: nodos de cuenta que el backend construyó. */
    const nodos = (resultado?.entidades || []).filter(
      (e) => e.origenNodo === "social_intelligence_layer"
    ).length;

    return [
      {
        id: "redes",
        nombre: "Redes verificadas",
        peso: 30,
        valor: plataformas.size,
        de: 6,
        cumplido: plataformas.size / 6,
        detalle:
          plataformas.size > 0
            ? `${plataformas.size} de 6 plataformas con cuenta atribuida.`
            : "Ninguna plataforma con cuenta atribuida."
      },
      {
        id: "alias",
        nombre: "Alias",
        peso: 10,
        valor: alias?.alias?.length || 0,
        de: null,
        cumplido: (alias?.alias?.length || 0) > 0 ? 1 : 0,
        detalle: alias?.alias?.length
          ? `${alias.alias.length} alias aprendido(s) de este objetivo.`
          : "Sin alias aprendidos todavía."
      },
      {
        id: "foto",
        nombre: "Foto oficial",
        peso: 15,
        valor: fotoReal ? 1 : 0,
        de: null,
        cumplido: fotoReal ? 1 : 0,
        detalle: fotoReal
          ? `Nivel ${inte.nivelUsado} · ${inte.fuente} · confianza ${inte.confianza}/100.`
          : "Sin fotografía verificada: el motor prefiere no mostrar ninguna antes que la de un homónimo."
      },
      {
        id: "medios",
        nombre: "Medios relacionados",
        peso: 15,
        valor: pe?.metricas?.medios || 0,
        de: null,
        cumplido: (pe?.metricas?.medios || 0) > 0 ? 1 : 0,
        detalle: (pe?.metricas?.medios || 0)
          ? `${pe.metricas.medios} medio(s) que cubren al objetivo, separados de sus cuentas.`
          : "No se identificó ningún medio que cubra al objetivo."
      },
      {
        id: "narrativas",
        nombre: "Narrativas detectadas",
        peso: 15,
        valor: narrativas,
        de: null,
        cumplido: narrativas > 0 ? Math.min(1, narrativas / 5) : 0,
        detalle: narrativas
          ? `${narrativas} término(s) recurrente(s) en los titulares. Es frecuencia medida, no análisis de discurso.`
          : "Ningún término se repite lo suficiente en la cobertura."
      },
      {
        id: "grafo",
        nombre: "Grafo construido",
        peso: 15,
        valor: nodos,
        de: null,
        cumplido: nodos > 0 ? 1 : 0,
        detalle: nodos
          ? `${nodos} nodo(s) de cuenta en el grafo.`
          : "El grafo no tiene nodos de cuenta."
      }
    ];
  }, [resultado, alias]);

  const porcentaje = useMemo(
    () =>
      Math.round(
        piezas.reduce((t, p) => t + p.peso * Math.min(1, p.cumplido), 0)
      ),
    [piezas]
  );

  const { color, etiqueta } = colorDe(porcentaje);

  if (!resultado?.fichaObjetivo) return null;

  return (
    <section
      className="sentinel-fade"
      style={{
        width: "100%",
        boxSizing: "border-box",
        marginTop: "28px",
        background: "var(--sentinel-primary)",
        border: "1px solid var(--sentinel-borde)",
        borderRadius: "var(--radio-l)",
        padding: "22px"
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
        <Gauge size={20} color={color} />

        {/* TÍTULO CON TOOLTIP OBLIGATORIO */}
        <span
          onMouseEnter={() => setTooltip(true)}
          onMouseLeave={() => setTooltip(false)}
          onFocus={() => setTooltip(true)}
          onBlur={() => setTooltip(false)}
          tabIndex={0}
          title={TEXTO_TOOLTIP}
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            cursor: "help",
            outline: "none"
          }}
        >
          <h2 style={{ margin: 0, color: "#FFFFFF", fontSize: "18px" }}>
            Cobertura
          </h2>

          <HelpCircle size={14} color="var(--sentinel-cyan)" />

          {tooltip && (
            <span
              role="tooltip"
              style={{
                position: "absolute",
                top: "calc(100% + 10px)",
                left: 0,
                zIndex: 20,
                width: "330px",
                background: "var(--sentinel-primary)",
                border: "1px solid var(--sentinel-cyan)",
                borderRadius: "var(--radio-s)",
                boxShadow: "var(--glow-cyan)",
                padding: "12px 14px",
                color: "var(--sentinel-texto)",
                fontSize: "11.5px",
                lineHeight: 1.7,
                fontWeight: 400
              }}
            >
              {TEXTO_TOOLTIP}
            </span>
          )}
        </span>

        <span
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "baseline",
            gap: "10px"
          }}
        >
          <strong
            style={{
              color,
              fontSize: "34px",
              fontFamily: "monospace",
              lineHeight: 1
            }}
          >
            {porcentaje}%
          </strong>

          <span style={{ color: "var(--sentinel-texto-suave)", fontSize: "12px" }}>
            {etiqueta}
          </span>
        </span>
      </div>

      {/* BARRA GLOBAL */}

      <div
        style={{
          height: "9px",
          background: "var(--sentinel-borde)",
          borderRadius: "var(--radio-pill)",
          overflow: "hidden",
          margin: "16px 0 18px 0"
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${porcentaje}%`,
            background: color,
            borderRadius: "var(--radio-pill)",
            transition: "width 320ms"
          }}
        />
      </div>

      {/* DESGLOSE */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(258px, 1fr))",
          gap: "10px"
        }}
      >
        {piezas.map((p) => {
          const logrado = Math.round(p.peso * Math.min(1, p.cumplido));

          const completo = p.cumplido >= 1;

          return (
            <div key={p.id} style={caja}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "8px"
                }}
              >
                {completo ? (
                  <Check size={14} color="#22C55E" style={{ flexShrink: 0 }} />
                ) : (
                  <Minus
                    size={14}
                    color="var(--sentinel-texto-tenue)"
                    style={{ flexShrink: 0 }}
                  />
                )}

                <strong
                  style={{
                    color: completo ? "#FFFFFF" : "var(--sentinel-texto-suave)",
                    fontSize: "12.5px"
                  }}
                >
                  {p.nombre}
                </strong>

                <span
                  style={{
                    marginLeft: "auto",
                    color: logrado ? color : "var(--sentinel-texto-tenue)",
                    fontFamily: "monospace",
                    fontSize: "12px"
                  }}
                >
                  {logrado}/{p.peso}
                </span>
              </div>

              <div
                style={{
                  height: "4px",
                  background: "var(--sentinel-borde)",
                  borderRadius: "2px",
                  overflow: "hidden"
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(1, p.cumplido) * 100}%`,
                    background: logrado ? color : "transparent"
                  }}
                />
              </div>

              <div
                style={{
                  color: "var(--sentinel-texto-tenue)",
                  fontSize: "10.5px",
                  marginTop: "7px",
                  lineHeight: 1.6
                }}
              >
                {p.detalle}
              </div>
            </div>
          );
        })}
      </div>

      <p
        style={{
          color: "var(--sentinel-texto-tenue)",
          fontSize: "10px",
          lineHeight: 1.7,
          marginTop: "14px",
          marginBottom: 0
        }}
      >
        Este índice se calcula en la interfaz a partir de lo que el motor
        devolvió, y mide nuestro propio trabajo: no es la Huella Digital, que
        mide la presencia pública del objetivo. Una cobertura baja avisa de que
        el expediente está incompleto y todavía no se debe concluir.
      </p>
    </section>
  );
}
