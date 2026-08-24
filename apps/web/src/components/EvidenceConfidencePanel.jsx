import { useMemo, useState } from "react";
import { Scale, AlertTriangle } from "lucide-react";

/*
===========================================================
CONFIANZA POR EVIDENCIA — Sprint 3.2.4, Bloque G (ARQ-QA-009)
===========================================================

Responde a una sola pregunta: de los puntos que sostienen esta
cuenta, ¿cuántos puso cada subsistema?

NO CAMBIA LA PUNTUACIÓN
-----------------------------------------------------------

Este panel no calcula nada nuevo. Toma el desglose de señales
que el Identity Matcher ya emitió y lo REAGRUPA por el
subsistema que hizo medible cada señal. La suma coincide con la
puntuación que el backend produjo; si no coincidiera sería un
error de este panel, no del motor, y se declara.

EL MAPEO, DECLARADO PARA QUE SEA AUDITABLE
-----------------------------------------------------------

  S8  Declaración de referencia   ->  Wikidata
        La cuenta está declarada como oficial en una base de
        conocimiento.

  S1  Nombre                      ->  SerpAPI
  S6  Enlaces oficiales           ->  SerpAPI
  S7  Presencia cruzada           ->  SerpAPI
        Estas tres solo existen porque un proveedor de búsqueda
        devolvió resultados: el nombre visible, el dominio que
        respalda y la repetición del handle entre plataformas.
        Sin proveedor, valen cero.

  S2  Usuario                     ->  SD-1A
        El handle no está en el texto: se extrae de la RUTA de la
        URL, y distinguir un perfil de una publicación es
        exactamente lo que hace el clasificador SD-1A.

  CB-1 Contexto                   ->  CB-1
        Ajuste por contexto compatible o ajeno, aplicado después
        del tope de concurrencia.

Cuando una señal no está activa aporta cero, y también se
muestra: el hueco informa tanto como el punto.
===========================================================
*/

const SUBSISTEMAS = [
  {
    id: "wikidata",
    nombre: "Wikidata",
    color: "#A855F7",
    senales: ["S8"],
    quePone:
      "Declara la cuenta como oficial del objetivo. Es la afirmación de una base de conocimiento, no una lectura del perfil."
  },
  {
    id: "serpapi",
    nombre: "SerpAPI",
    color: "#0B5FFF",
    senales: ["S1", "S6", "S7"],
    quePone:
      "Aporta el nombre visible, el dominio que respalda la cuenta y la presencia del mismo handle en varias plataformas."
  },
  {
    id: "sd1a",
    nombre: "SD-1A",
    color: "#00D4FF",
    senales: ["S2"],
    quePone:
      "Extrae el handle de la ruta de la URL y distingue un perfil de una publicación."
  }
];

const NO_MEDIDAS = ["S3", "S4", "S5"];

function Campo({ k, v }) {
  return (
    <div style={{ fontSize: "11px", lineHeight: 1.7 }}>
      <strong style={{ color: "var(--sentinel-cyan)" }}>{k}:</strong>{" "}
      <span style={{ color: "var(--sentinel-texto-suave)" }}>{v}</span>
    </div>
  );
}

/*
  La fuente de cada bloque sale de la corroboracion real de la
  cuenta, no de una etiqueta fija: si Wikidata no la declaro, se
  dice que no la declaro.
*/
function fuenteDe(bloque, cuenta) {
  const proveedores = cuenta?.corroboracion?.proveedores || [];

  if (bloque.id === "wikidata") {
    const wd = proveedores.filter((x) => /wikidata/i.test(x));

    return wd.length
      ? wd.join(", ")
      : "Wikidata no declara esta cuenta: el aporte es cero.";
  }

  if (bloque.id === "serpapi") {
    const web = proveedores.filter((x) => !/wikidata/i.test(x));

    return web.length ? web.join(", ") : "ningún proveedor web la devolvió.";
  }

  if (bloque.id === "sd1a") {
    return `clasificador de URL sobre ${
      cuenta?.url?.observada || cuenta?.url?.canonica || "la URL descubierta"
    }`;
  }

  return "Context Boost sobre el texto observado de la cuenta.";
}

function fechaDe(cuenta) {
  const f =
    cuenta?.descubiertoEn ||
    (cuenta?.origenes || [])[0]?.registradoEn ||
    cuenta?.linaje?.registradoEn ||
    null;

  return f ? String(f).slice(0, 19).replace("T", " ") : "no registrada";
}

export default function EvidenceConfidencePanel({ cuentas = [] }) {
  const [abierta, setAbierta] = useState(0);

  /* Bloque E — que barra tiene el detalle desplegado. */
  const [expandido, setExpandido] = useState(null);

  /* Solo las cuentas atribuidas, ordenadas por su puntuación. */
  const ordenadas = useMemo(
    () =>
      cuentas
        .slice()
        .sort(
          (a, b) =>
            (b.correspondencia?.puntuacion ?? 0) -
            (a.correspondencia?.puntuacion ?? 0)
        ),
    [cuentas]
  );

  if (!ordenadas.length) return null;

  const cuenta = ordenadas[Math.min(abierta, ordenadas.length - 1)];

  const c = cuenta.correspondencia || {};

  const senales = c.senales || [];

  const cb = c.explicacion?.contextBoost || c.contextBoost || null;

  const aporte = (ids) =>
    senales
      .filter((s) => ids.includes(s.id) && s.activa)
      .reduce((t, s) => t + (s.puntos || 0), 0);

  const bloques = SUBSISTEMAS.map((sub) => ({
    ...sub,
    puntos: aporte(sub.senales),
    detalle: senales.filter((s) => sub.senales.includes(s.id))
  }));

  const ajusteCb = cb?.ajuste ?? 0;

  bloques.push({
    id: "cb1",
    nombre: "CB-1 · contexto",
    color: ajusteCb < 0 ? "#EF4444" : "#22C55E",
    puntos: ajusteCb,
    quePone:
      "Ajusta según el contexto del hallazgo. Sube si es compatible con el objetivo y hunde a un homónimo cuyo contexto es ajeno.",
    detalle: [],
    veredicto: cb?.veredicto || null
  });

  const sumaDeclarada = bloques.reduce((t, b) => t + b.puntos, 0);

  const puntuacionReal = c.puntuacion ?? 0;

  /*
    El tope por concurrencia y el tope absoluto pueden recortar la
    suma. Ese recorte es información, no un descuadre: se muestra.
  */
  const recorte = puntuacionReal - sumaDeclarada;

  const maximo = Math.max(
    1,
    ...bloques.map((b) => Math.abs(b.puntos)),
    Math.abs(recorte)
  );

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
          gap: "11px",
          flexWrap: "wrap",
          marginBottom: "4px"
        }}
      >
        <Scale size={20} color="var(--sentinel-cyan)" />

        <h2 style={{ margin: 0, color: "#FFFFFF", fontSize: "18px" }}>
          Confianza por evidencia
        </h2>

        <span
          style={{ color: "var(--sentinel-texto-tenue)", fontSize: "11px" }}
        >
          qué subsistema puso cada punto
        </span>
      </div>

      {/* SELECTOR DE CUENTA */}

      {ordenadas.length > 1 && (
        <div
          style={{
            display: "flex",
            gap: "7px",
            flexWrap: "wrap",
            margin: "14px 0 4px 0"
          }}
        >
          {ordenadas.map((x, i) => (
            <button
              key={`${x.plataformaId || x.platform}-${x.handle}`}
              className="sentinel-hover"
              onClick={() => setAbierta(i)}
              style={{
                background:
                  i === abierta ? "rgba(11,95,255,.22)" : "transparent",
                border: `1px solid ${
                  i === abierta
                    ? "var(--sentinel-cyan)"
                    : "var(--sentinel-borde)"
                }`,
                borderRadius: "var(--radio-pill)",
                color: i === abierta ? "#FFFFFF" : "var(--sentinel-texto-suave)",
                padding: "5px 13px",
                cursor: "pointer",
                fontSize: "11px"
              }}
            >
              {x.plataforma} @{x.handle}
            </button>
          ))}
        </div>
      )}

      {/* TOTAL */}

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "12px",
          flexWrap: "wrap",
          margin: "16px 0"
        }}
      >
        <span
          style={{
            color: "#FFFFFF",
            fontSize: "30px",
            fontFamily: "monospace",
            lineHeight: 1
          }}
        >
          {puntuacionReal}
          <span style={{ color: "var(--sentinel-texto-tenue)", fontSize: "14px" }}>
            /100
          </span>
        </span>

        <strong style={{ color: "var(--sentinel-texto)", fontSize: "13px" }}>
          {c.etiqueta || "—"}
        </strong>

        <span
          style={{
            marginLeft: "auto",
            color: "var(--sentinel-texto-tenue)",
            fontSize: "11px"
          }}
        >
          @{cuenta.handle} · {cuenta.plataforma}
        </span>
      </div>

      {/* BARRAS POR SUBSISTEMA */}

      {bloques.map((b) => (
        <div key={b.id} style={{ marginBottom: "13px" }}>
          <button
            onClick={() => setExpandido(expandido === b.id ? null : b.id)}
            aria-expanded={expandido === b.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: "10px",
              width: "100%",
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              textAlign: "left"
            }}
          >
            <span
              style={{
                color: b.puntos ? "var(--sentinel-texto)" : "var(--sentinel-texto-tenue)",
                fontSize: "12.5px",
                fontWeight: b.puntos ? 600 : 500
              }}
            >
              {b.nombre}
              {b.veredicto && (
                <em
                  style={{
                    fontStyle: "normal",
                    color: "var(--sentinel-texto-tenue)",
                    fontSize: "10.5px",
                    marginLeft: "8px"
                  }}
                >
                  {b.veredicto}
                </em>
              )}
            </span>

            <strong
              style={{
                fontFamily: "monospace",
                fontSize: "13px",
                color: b.puntos
                  ? b.puntos < 0
                    ? "#EF4444"
                    : b.color
                  : "var(--sentinel-texto-tenue)"
              }}
            >
              {b.puntos > 0 ? "+" : ""}
              {b.puntos}
              <span
                style={{
                  color: "var(--sentinel-texto-tenue)",
                  fontSize: "10px",
                  marginLeft: "7px"
                }}
              >
                {expandido === b.id ? "ocultar" : "detalle"}
              </span>
            </strong>
          </button>

          <div
            style={{
              height: "6px",
              background: "var(--sentinel-borde)",
              borderRadius: "3px",
              marginTop: "5px",
              overflow: "hidden"
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${(Math.abs(b.puntos) / maximo) * 100}%`,
                background: b.puntos < 0 ? "#EF4444" : b.color,
                borderRadius: "3px",
                transition: "width 220ms"
              }}
            />
          </div>

          <div
            style={{
              color: "var(--sentinel-texto-tenue)",
              fontSize: "10.5px",
              marginTop: "5px",
              lineHeight: 1.6
            }}
          >
            {b.quePone}
          </div>

          {/*
            BLOQUE E — DETALLE AUDITABLE

            Se despliega bajo demanda con la evidencia utilizada, la
            fecha, la fuente, la contribucion y el motivo. Nada de
            esto se calcula aqui: son los campos que el motor ya
            emitio para cada senal.
          */}
          {expandido === b.id && (
            <div
              className="sentinel-fade"
              style={{
                marginTop: "10px",
                padding: "12px",
                background: "var(--sentinel-surface)",
                border: `1px solid ${b.color}44`,
                borderRadius: "var(--radio-s)"
              }}
            >
              <Campo k="Contribución" v={`${b.puntos > 0 ? "+" : ""}${b.puntos} puntos de la puntuación final`} />

              <Campo k="Fuente" v={fuenteDe(b, cuenta)} />

              <Campo k="Fecha" v={fechaDe(cuenta)} />

              <Campo k="Motivo" v={b.quePone} />

              {b.veredicto && (
                <Campo k="Veredicto de contexto" v={b.veredicto} />
              )}

              {b.detalle.length > 0 && (
                <div style={{ marginTop: "10px" }}>
                  <div
                    style={{
                      color: "var(--sentinel-cyan)",
                      fontSize: "9.5px",
                      letterSpacing: "1.4px",
                      textTransform: "uppercase",
                      marginBottom: "7px"
                    }}
                  >
                    Evidencia utilizada
                  </div>

                  {b.detalle.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        color: s.activa
                          ? "var(--sentinel-texto-suave)"
                          : "var(--sentinel-texto-tenue)",
                        fontSize: "10.5px",
                        paddingLeft: "10px",
                        borderLeft: `2px solid ${
                          s.activa ? b.color : "var(--sentinel-borde)"
                        }`,
                        marginBottom: "6px",
                        lineHeight: 1.6
                      }}
                    >
                      <strong>{s.id}</strong> {s.nombre} ·{" "}
                      {s.activa ? `+${s.puntos}` : "no activa"}
                      <div>{s.detalle}</div>
                      {s.evidencias?.length > 0 && (
                        <div
                          style={{
                            color: "var(--sentinel-texto-tenue)",
                            fontSize: "9.5px",
                            marginTop: "2px"
                          }}
                        >
                          evidencias: {s.evidencias.join(" · ")}
                        </div>
                      )}
                      {s.limitacion && (
                        <div
                          style={{
                            color: "#FCD34D",
                            fontSize: "9.5px",
                            marginTop: "2px"
                          }}
                        >
                          límite: {s.limitacion}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {b.id === "cb1" && cb && (
                <div style={{ marginTop: "10px" }}>
                  {(cb.bonificaciones || []).length > 0 && (
                    <div
                      style={{
                        color: "#22C55E",
                        fontSize: "10px",
                        lineHeight: 1.6
                      }}
                    >
                      a favor:{" "}
                      {cb.bonificaciones
                        .map((x) => `${x.termino} (+${x.puntos})`)
                        .join(", ")}
                    </div>
                  )}

                  {(cb.penalizaciones || []).length > 0 && (
                    <div
                      style={{
                        color: "#EF4444",
                        fontSize: "10px",
                        lineHeight: 1.6,
                        marginTop: "4px"
                      }}
                    >
                      en contra:{" "}
                      {cb.penalizaciones
                        .map((x) => `${x.termino} (${x.puntos})`)
                        .join(", ")}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* RECORTE POR TOPE */}

      {recorte !== 0 && (
        <div
          style={{
            display: "flex",
            gap: "9px",
            alignItems: "flex-start",
            background: "rgba(245,158,11,.08)",
            border: "1px solid #78350F",
            borderRadius: "var(--radio-s)",
            padding: "11px",
            marginTop: "6px"
          }}
        >
          <AlertTriangle
            size={14}
            color="#FCD34D"
            style={{ flexShrink: 0, marginTop: "2px" }}
          />

          <div style={{ color: "#FCD34D", fontSize: "11px", lineHeight: 1.65 }}>
            La suma de los aportes es {sumaDeclarada} y la puntuación final{" "}
            {puntuacionReal}: {recorte < 0 ? "el tope" : "el ajuste"} de{" "}
            {recorte > 0 ? "+" : ""}
            {recorte} viene de los límites del motor. Ninguna señal aislada
            confirma identidad, así que la puntuación queda limitada por cuántas
            señales independientes concurren, y nunca alcanza 100.
          </div>
        </div>
      )}

      {/* LO QUE NO SE PUDO MEDIR */}

      <details style={{ marginTop: "14px" }}>
        <summary
          style={{
            color: "var(--sentinel-texto-suave)",
            fontSize: "11.5px",
            cursor: "pointer"
          }}
        >
          Señales que no se pudieron medir ({NO_MEDIDAS.length})
        </summary>

        <div
          style={{
            color: "var(--sentinel-texto-tenue)",
            fontSize: "10.5px",
            marginTop: "9px",
            lineHeight: 1.7
          }}
        >
          {senales
            .filter((s) => NO_MEDIDAS.includes(s.id))
            .map((s) => (
              <div key={s.id}>
                <strong>{s.id}</strong> {s.nombre} — {s.detalle}
              </div>
            ))}

          <div style={{ marginTop: "7px" }}>
            Biografía, cargo y país declarados en el perfil exigen la API de la
            plataforma. Mientras no esté disponible, esos puntos no existen: no
            se estiman.
          </div>
        </div>
      </details>
    </section>
  );
}
