import { useState } from "react";
import { Grid3x3, Loader2, Play, X, MapPin, Clock, FileText } from "lucide-react";

/*
===========================================================
TEMA x TERRITORIO — TERRITORIAL-TOPIC-TERRITORY-01
===========================================================

La matriz explicable: que tema, en que territorio, con cuanta
evidencia y con QUE evidencia.

POR QUE SE CARGA A DEMANDA Y NO CON EL ANALISIS
-----------------------------------------------------------

`/analisis` recolecta —invoca Google News— y abrir una vista de
temas no puede costar una recoleccion. Este panel pide
`/tema-territorio`, que lee el corpus ya persistido y no sale a
internet: coste 0.

LO QUE ESTE PANEL SE NIEGA A MOSTRAR
-----------------------------------------------------------

Porcentajes de poblacion. No hay denominador oficial con
licencia, asi que la metrica es CONTEO ABSOLUTO y se dice.

Y no oculta lo que no sabe: las filas `TERRITORIO_NO_RESUELTO`
se muestran. Descartarlas haria que el total no cuadrase con el
corpus y nadie sabria por que.

TEMA NO ES LUGAR
-----------------------------------------------------------

En el corpus real, la señal con mas evidencias era «cuenca».
Eso no es un tema: es el territorio. Las señales marcadas como
LUGAR se separan, porque responder «¿de que se habla en
Cuenca?» con «de Cuenca» no informa.
===========================================================
*/

const BACKEND = "http://localhost:3001";

const VENTANAS = [
  { id: "hoy", etiqueta: "Hoy" },
  { id: "7d", etiqueta: "7 días" },
  { id: "15d", etiqueta: "15 días" },
  { id: "30d", etiqueta: "30 días" },
  { id: "90d", etiqueta: "90 días" }
];

const COBERTURA_VISUAL = {
  OBSERVADO: { color: "#22c55e", texto: "Observado" },
  COBERTURA_BAJA: { color: "#eda100", texto: "Cobertura baja" },
  HISTORICO_INSUFICIENTE: { color: "#8b5cf6", texto: "Histórico insuficiente" },
  SIN_EVIDENCIA: { color: "#64748b", texto: "Sin evidencia" },
  TERRITORIO_NO_RESUELTO: { color: "#64748b", texto: "Territorio no resuelto" }
};

const TENDENCIA_VISUAL = {
  CRECIENDO: { color: "#22c55e", texto: "Creciendo" },
  DISMINUYENDO: { color: "#ef4444", texto: "Disminuyendo" },
  ESTABLE: { color: "#94a3b8", texto: "Estable" },
  HISTORICO_INSUFICIENTE: { color: "#8b5cf6", texto: "Histórico insuficiente" },
  MUESTRA_INSUFICIENTE: { color: "#eda100", texto: "Muestra insuficiente" }
};

const etiqueta = {
  fontSize: "10px",
  letterSpacing: "1.8px",
  textTransform: "uppercase",
  fontWeight: 600
};

const celdaTabla = {
  padding: "7px 9px",
  fontSize: "11px",
  borderBottom: "1px solid var(--sentinel-borde)",
  textAlign: "left"
};


function Chip({ color, texto }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 7px",
        borderRadius: "999px",
        border: `1px solid ${color}`,
        color,
        fontSize: "9.5px",
        whiteSpace: "nowrap"
      }}
    >
      {texto}
    </span>
  );
}


/*
  Cajón de evidencia. Cada afirmación de la matriz se abre aquí:
  sin esto, «auditable» sería una promesa.
*/
function EvidenceDrawer({ celda, evidenciaPorId, tendencia, onClose }) {
  if (!celda) return null;

  const evidencias = (celda.evidenceIds || [])
    .map((id) => evidenciaPorId?.[id])
    .filter(Boolean);

  const t = TENDENCIA_VISUAL[tendencia?.estado] || null;

  return (
    <div
      style={{
        marginTop: "12px",
        border: "1px solid var(--sentinel-cyan)",
        borderRadius: "var(--radio-l)",
        padding: "14px 16px",
        background: "var(--sentinel-surface)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
        <div>
          <div style={{ color: "var(--sentinel-texto)", fontSize: "13px", fontWeight: 600 }}>
            {celda.tema}
          </div>

          <div style={{ color: "var(--sentinel-texto-suave)", fontSize: "11px", marginTop: "2px" }}>
            <MapPin size={11} style={{ verticalAlign: "-1px" }} /> {celda.territorio}
            {celda.nivel ? ` · ${celda.nivel}` : ""} · ventana {celda.ventana?.id}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "var(--sentinel-texto-tenue)",
            cursor: "pointer"
          }}
        >
          <X size={15} />
        </button>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "14px",
          margin: "11px 0",
          fontSize: "11px",
          color: "var(--sentinel-texto-suave)"
        }}
      >
        <span>
          <strong style={{ color: "var(--sentinel-texto)" }}>{celda.evidencias}</strong> evidencia(s)
        </span>

        <span>
          <strong style={{ color: "var(--sentinel-texto)" }}>{celda.fuentes}</strong> fuente(s)
        </span>

        <span>
          <strong style={{ color: "var(--sentinel-texto)" }}>{celda.emisores}</strong> emisor(es)
          {celda.emisoresSinResolver > 0 ? ` · ${celda.emisoresSinResolver} sin resolver` : ""}
        </span>

        <span>publicado hoy: {celda.publicadoHoy}</span>

        <span>publicado 7d: {celda.publicado7d}</span>
      </div>

      {/*
        La tendencia se muestra con su estado, y cuando no se
        puede declarar se dice POR QUE. Un hueco sin explicación
        se lee como cero.
      */}
      {t && (
        <div style={{ marginBottom: "10px", fontSize: "11px" }}>
          <Clock size={11} style={{ verticalAlign: "-1px" }} /> Cambio temporal:{" "}
          <Chip color={t.color} texto={t.texto} />
          {tendencia.motivo && (
            <div
              style={{
                color: "var(--sentinel-texto-tenue)",
                fontSize: "10.5px",
                marginTop: "3px",
                lineHeight: 1.6
              }}
            >
              {tendencia.motivo}
            </div>
          )}
        </div>
      )}

      {celda.atribucion?.length > 0 && (
        <div
          style={{
            color: "var(--sentinel-texto-tenue)",
            fontSize: "10.5px",
            marginBottom: "10px",
            lineHeight: 1.6
          }}
        >
          Atribución territorial: {celda.atribucion.join(" · ")}
        </div>
      )}

      <div style={{ ...etiqueta, color: "var(--sentinel-cyan)", marginBottom: "6px" }}>
        Evidencia que lo sostiene
      </div>

      {evidencias.map((e) => (
        <div
          key={e.evidenceId}
          style={{
            padding: "8px 0",
            borderTop: "1px solid var(--sentinel-borde)",
            fontSize: "11px"
          }}
        >
          <div style={{ color: "var(--sentinel-texto)", lineHeight: 1.5 }}>
            <FileText size={11} style={{ verticalAlign: "-1px" }} /> {e.titulo || "(sin titular)"}
          </div>

          <div
            style={{
              color: "var(--sentinel-texto-tenue)",
              fontSize: "10.5px",
              marginTop: "3px",
              lineHeight: 1.65
            }}
          >
            {e.dominio}
            {e.tipoFuente ? ` · ${e.tipoFuente}` : ""} · emisor: {e.emisor || "SIN RESOLVER"}
            <br />
            publicado: {e.publishedAt || "sin fecha declarada"} · observado: {e.firstObservedAt}
            <br />
            territorio: {e.territorio?.unidadId}
            {e.territorio?.nivel ? ` (${e.territorio.nivel})` : ""}
            <br />
            <span style={{ opacity: 0.75 }}>{e.evidenceId}</span>
          </div>
        </div>
      ))}
    </div>
  );
}


export default function TopicTerritoryPanel({ territorioId }) {
  const [datos, setDatos] = useState(null);

  const [cargando, setCargando] = useState(false);

  const [error, setError] = useState(null);

  const [ventana, setVentana] = useState("30d");

  const [soloTemas, setSoloTemas] = useState(true);

  const [territorioFiltro, setTerritorioFiltro] = useState("");

  const [abierta, setAbierta] = useState(null);

  async function cargar(v = ventana) {
    setCargando(true);

    setError(null);

    setAbierta(null);

    try {
      const r = await fetch(`${BACKEND}/api/territorio/tema-territorio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          territorio: territorioId || "ec-azuay-cuenca",
          ventana: v
        })
      });

      const j = await r.json();

      if (j.error) throw new Error(j.error);

      setDatos(j);
    } catch (e) {
      setError(e?.message || "no se pudo cargar el cruce");
    } finally {
      setCargando(false);
    }
  }

  const filas = (datos?.matriz?.filas || []).filter((f) => {
    if (soloTemas && f.tipoSenal !== "TEMA") return false;

    if (territorioFiltro && f.territorioId !== territorioFiltro) return false;

    return true;
  });

  const territorios = [
    ...new Set((datos?.matriz?.filas || []).map((f) => f.territorioId))
  ];

  const tendenciaDe = (temaId) =>
    (datos?.comparacion?.filas || []).find((f) => f.temaId === temaId) || null;

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
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "10px",
          flexWrap: "wrap"
        }}
      >
        <span
          style={{
            ...etiqueta,
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            color: "var(--sentinel-cyan)"
          }}
        >
          <Grid3x3 size={13} />
          Tema × Territorio
        </span>

        <button
          type="button"
          onClick={() => cargar()}
          disabled={cargando}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "5px 11px",
            borderRadius: "var(--radio-m, 6px)",
            border: "1px solid var(--sentinel-cyan)",
            background: "transparent",
            color: "var(--sentinel-cyan)",
            fontSize: "11px",
            cursor: cargando ? "default" : "pointer"
          }}
        >
          {cargando ? <Loader2 size={12} /> : <Play size={12} />}
          {datos ? "Recargar" : "Cargar cruce"}
        </button>
      </div>

      <div
        style={{
          color: "var(--sentinel-texto-suave)",
          fontSize: "11px",
          lineHeight: 1.7,
          marginBottom: "12px"
        }}
      >
        Lee el corpus ya observado. <strong>No sale a internet y no consume cuota.</strong> La
        métrica es <strong>conteo absoluto</strong>: no hay denominador poblacional con licencia, así
        que no se calculan porcentajes de población ni de electores.
      </div>

      {error && (
        <div style={{ color: "#ef4444", fontSize: "11px", marginBottom: "10px" }}>{error}</div>
      )}

      {!datos && !cargando && (
        <div style={{ color: "var(--sentinel-texto-tenue)", fontSize: "11px" }}>
          Sin cargar. La matriz se construye a demanda.
        </div>
      )}

      {datos && (
        <>
          {/* --- controles --- */}
          <div
            style={{
              display: "flex",
              gap: "6px",
              flexWrap: "wrap",
              alignItems: "center",
              marginBottom: "11px"
            }}
          >
            {VENTANAS.map((v) => {
              const info = datos.porVentana?.[v.id];

              const activa = v.id === ventana;

              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setVentana(v.id);

                    cargar(v.id);
                  }}
                  style={{
                    padding: "3px 9px",
                    borderRadius: "999px",
                    border: `1px solid ${activa ? "var(--sentinel-cyan)" : "var(--sentinel-borde)"}`,
                    background: "transparent",
                    color: activa ? "var(--sentinel-cyan)" : "var(--sentinel-texto-suave)",
                    fontSize: "10.5px",
                    cursor: "pointer"
                  }}
                >
                  {v.etiqueta}
                  {info ? ` (${info.celdas})` : ""}
                </button>
              );
            })}

            <label
              style={{
                fontSize: "10.5px",
                color: "var(--sentinel-texto-suave)",
                marginLeft: "6px",
                cursor: "pointer"
              }}
            >
              <input
                type="checkbox"
                checked={soloTemas}
                onChange={(ev) => setSoloTemas(ev.target.checked)}
                style={{ verticalAlign: "-1px", marginRight: "4px" }}
              />
              solo temas (ocultar lugares)
            </label>

            {territorios.length > 1 && (
              <select
                value={territorioFiltro}
                onChange={(ev) => setTerritorioFiltro(ev.target.value)}
                style={{
                  fontSize: "10.5px",
                  padding: "3px 6px",
                  background: "var(--sentinel-fondo, transparent)",
                  color: "var(--sentinel-texto-suave)",
                  border: "1px solid var(--sentinel-borde)",
                  borderRadius: "var(--radio-m, 6px)"
                }}
              >
                <option value="">todos los territorios</option>

                {territorios.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* --- lo que la ventana NO cubre --- */}
          {datos.matriz?.ventana?.historicoCubre === false && (
            <div
              style={{
                color: "#8b5cf6",
                fontSize: "10.5px",
                lineHeight: 1.65,
                marginBottom: "10px"
              }}
            >
              {datos.matriz.ventana.motivo}
            </div>
          )}

          <div
            style={{
              color: "var(--sentinel-texto-tenue)",
              fontSize: "10.5px",
              marginBottom: "8px"
            }}
          >
            {datos.corpus.evidencias} evidencia(s) en el corpus · {datos.matriz.metricas.temas}{" "}
            tema(s) · {datos.matriz.metricas.territorios} territorio(s) ·{" "}
            {datos.matriz.metricas.senalesQueSonLugar} señal(es) que son un lugar, no un tema ·{" "}
            {datos.territorio.sinUbicar} evidencia(s) sin territorio resuelto
          </div>

          {/* --- matriz --- */}
          {filas.length === 0 ? (
            <div style={{ color: "var(--sentinel-texto-tenue)", fontSize: "11px" }}>
              Ninguna celda en esta ventana. Eso NO significa que no haya temas en el territorio:
              significa que no hay evidencia observada con fecha dentro de la ventana.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Tema", "Territorio", "Ev.", "Fuentes", "Emis.", "Hoy", "Cobertura", "Cambio"].map(
                      (h) => (
                        <th
                          key={h}
                          style={{
                            ...celdaTabla,
                            ...etiqueta,
                            fontSize: "9.5px",
                            color: "var(--sentinel-texto-tenue)"
                          }}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody>
                  {filas.map((f, i) => {
                    const cob = COBERTURA_VISUAL[f.coverageStatus] || {
                      color: "#64748b",
                      texto: f.coverageStatus
                    };

                    const tend = tendenciaDe(f.temaId);

                    const tv = TENDENCIA_VISUAL[tend?.estado];

                    return (
                      <tr
                        key={`${f.temaId}-${f.territorioId}-${i}`}
                        onClick={() => setAbierta(f)}
                        style={{ cursor: "pointer" }}
                      >
                        <td style={{ ...celdaTabla, color: "var(--sentinel-texto)" }}>
                          {f.tema}
                          {f.tipoSenal === "LUGAR" && (
                            <span
                              style={{
                                color: "var(--sentinel-texto-tenue)",
                                fontSize: "9.5px",
                                marginLeft: "5px"
                              }}
                            >
                              (lugar)
                            </span>
                          )}
                        </td>

                        <td style={{ ...celdaTabla, color: "var(--sentinel-texto-suave)" }}>
                          {f.territorio}
                        </td>

                        <td style={{ ...celdaTabla, color: "var(--sentinel-texto)" }}>
                          {f.evidencias}
                        </td>

                        <td style={{ ...celdaTabla, color: "var(--sentinel-texto-suave)" }}>
                          {f.fuentes}
                        </td>

                        <td style={{ ...celdaTabla, color: "var(--sentinel-texto-suave)" }}>
                          {f.emisores}
                          {f.emisoresSinResolver > 0 ? (
                            <span style={{ color: "#eda100" }}> +{f.emisoresSinResolver}?</span>
                          ) : null}
                        </td>

                        <td style={{ ...celdaTabla, color: "var(--sentinel-texto-suave)" }}>
                          {f.publicadoHoy}
                        </td>

                        <td style={celdaTabla}>
                          <Chip color={cob.color} texto={cob.texto} />
                        </td>

                        <td style={celdaTabla}>
                          {tv ? <Chip color={tv.color} texto={tv.texto} /> : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <EvidenceDrawer
            celda={abierta}
            evidenciaPorId={datos.evidenciaPorId}
            tendencia={abierta ? tendenciaDe(abierta.temaId) : null}
            onClose={() => setAbierta(null)}
          />

          {/*
            Geometría: si no hay polígono oficial, se dice. No se
            dibuja una unidad que no está verificada.
          */}
          <div
            style={{
              marginTop: "12px",
              paddingTop: "10px",
              borderTop: "1px solid var(--sentinel-borde)",
              color: "var(--sentinel-texto-tenue)",
              fontSize: "10.5px",
              lineHeight: 1.65
            }}
          >
            Geometría oficial no disponible para las unidades urbanas: la lectura territorial es por
            tabla, no por mapa. No se dibujan polígonos sin fuente oficial.
            <br />
            Métricas no disponibles: {Object.keys(datos.metricasNoDisponibles)
              .filter((k) => k !== "motivo")
              .join(", ")}
            . {datos.metricasNoDisponibles.motivo}
          </div>
        </>
      )}
    </section>
  );
}
