import { useState } from "react";
import {
  X,
  Activity,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Info
} from "lucide-react";

import { fechaLocal } from "../services/identidadCandidato";

/*
===========================================================
ACCOUNT INTELLIGENCE — FASE 1 (P-CAND-AI-01)
===========================================================

Una cuenta consolidada deja de ser solo identidad y pasa a ser
objeto de observacion.

LO QUE ESTA PANTALLA SE PROHIBE

    NO puntuacion por candidato.
    NO ranking.
    NO «actividad baja» sin metodologia.
    NO decir «el candidato no publica» cuando lo que ocurrio es
       que no pudimos leer sus publicaciones.

ESTADOS VACIOS HONESTOS

Casi todo va a estar vacio en esta fase, y esta bien: lo que NO
se puede hacer es que un hueco parezca un dato. Cada seccion
vacia dice por que lo esta, y cada plataforma declara su
capacidad real.

    SIN_DATOS_PUBLICOS   se consulto y no habia metadata util
    PROVIDER_LIMITED     haria falta una API que no tenemos
    NO_EJECUTADA         no se intento
    ERROR                se intento y fallo
    OBSERVADA            se obtuvieron datos publicos
===========================================================
*/

const TONOS = {
  OBSERVADA: "#22C55E",
  SIN_DATOS_PUBLICOS: "#F59E0B",
  PROVIDER_LIMITED: "#F59E0B",
  NO_EJECUTADA: "var(--sentinel-texto-tenue)",
  ERROR: "#EF4444"
};

const CAPACIDAD_TEXTO = {
  ADAPTER_AVAILABLE: "adaptador propio disponible",
  PUBLIC_METADATA_ONLY: "solo metadata pública",
  API_REQUIRED: "requiere API de la plataforma",
  PROVIDER_REQUIRED: "requiere un proveedor de datos",
  BLOCKED: "la plataforma lo bloquea",
  UNSUPPORTED: "no contemplado"
};

const SECCIONES = [
  "Resumen",
  "Cuentas",
  "Actividad",
  "Publicaciones",
  "Temas",
  "Métricas",
  "Histórico",
  "Limitaciones"
];

const caja = {
  background: "var(--sentinel-surface)",
  border: "1px solid var(--sentinel-borde)",
  borderRadius: "var(--radio-m)",
  padding: "13px 15px"
};

const pill = (color) => ({
  color,
  border: `1px solid ${color}`,
  borderRadius: "var(--radio-pill)",
  padding: "2px 8px",
  fontSize: "9.5px",
  whiteSpace: "nowrap"
});

const rotulo = {
  color: "var(--sentinel-texto-suave)",
  fontSize: "10.5px",
  marginBottom: "6px"
};


/*
  Un hueco que explica por que esta vacio. Es la pieza que evita
  que la ausencia de datos se lea como un dato.
*/
function Vacio({ texto }) {
  return (
    <div
      style={{
        ...caja,
        color: "var(--sentinel-texto-tenue)",
        fontSize: "11px",
        lineHeight: 1.75,
        display: "flex",
        gap: "9px",
        alignItems: "flex-start"
      }}
    >
      <Info size={13} style={{ flexShrink: 0, marginTop: "2px" }} />
      <span>{texto}</span>
    </div>
  );
}


function Dato({ etiqueta, valor, nota }) {
  return (
    <div style={caja}>
      <div style={rotulo}>{etiqueta}</div>

      <div
        style={{
          color: valor == null ? "var(--sentinel-texto-tenue)" : "#FFFFFF",
          fontSize: "17px",
          fontFamily: "monospace"
        }}
      >
        {/*
          `null` no es cero. Cero seguidores es un dato; no
          saberlo es otra cosa, y se escribe distinto.
        */}
        {valor == null ? "sin dato" : valor}
      </div>

      {nota && (
        <div
          style={{
            color: "var(--sentinel-texto-tenue)",
            fontSize: "9.5px",
            marginTop: "5px",
            lineHeight: 1.6
          }}
        >
          {nota}
        </div>
      )}
    </div>
  );
}


export default function AccountIntelligencePanel({
  datos,
  proyecto,
  ocupado,
  onObservar,
  onCerrar
}) {
  const [seccion, setSeccion] = useState("Resumen");

  if (!datos) return null;

  const r = datos.resumen || {};

  const rejilla = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
    gap: "10px"
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Account Intelligence"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 150,
        background: "rgba(3,8,20,.8)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "20px",
        overflowY: "auto"
      }}
    >
      <div
        className="sentinel-fade"
        style={{
          width: "min(980px, 100%)",
          background: "var(--sentinel-primary)",
          border: "1px solid var(--sentinel-borde-vivo)",
          borderRadius: "var(--radio-l)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "calc(100vh - 40px)",
          boxSizing: "border-box"
        }}
      >
        {/* ---- CABECERA ---- */}

        <div
          style={{
            padding: "18px 22px 12px 22px",
            borderBottom: "1px solid var(--sentinel-borde)"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap"
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "9px"
                }}
              >
                <Activity size={17} color="var(--sentinel-cyan)" />

                <h2 style={{ margin: 0, color: "#FFFFFF", fontSize: "16px" }}>
                  Account Intelligence
                </h2>

                <span style={pill("var(--sentinel-cyan)")}>fase 1</span>
              </div>

              <div style={{ color: "#FFFFFF", fontSize: "13px", marginTop: "7px" }}>
                {datos.nombre}
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                className="sentinel-boton"
                onClick={onObservar}
                disabled={ocupado}
                title="Consulta la metadata pública de las cuentas que lo permitan y escribe un snapshot. Sale a la red."
                style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "11px" }}
              >
                {ocupado ? <Loader2 size={12} /> : <RefreshCw size={12} />}
                {ocupado ? "Observando…" : "Observar cuentas"}
              </button>

              <button
                className="sentinel-boton"
                onClick={onCerrar}
                aria-label="Cerrar"
                style={{ padding: "5px 9px" }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/*
            Lo primero que se lee: esta fase no puntua. Sin esto,
            cualquier cifra de la pantalla invita a compararla con
            otro candidato.
          */}
          <div
            style={{
              color: "var(--sentinel-texto-suave)",
              fontSize: "10.5px",
              lineHeight: 1.7,
              marginTop: "11px"
            }}
          >
            {r.notaPuntuacion}
          </div>
        </div>

        {/* ---- PESTAÑAS ---- */}

        <div
          style={{
            display: "flex",
            gap: "6px",
            padding: "11px 22px",
            borderBottom: "1px solid var(--sentinel-borde)",
            overflowX: "auto"
          }}
        >
          {SECCIONES.map((s) => (
            <button
              key={s}
              className="sentinel-boton"
              onClick={() => setSeccion(s)}
              style={{
                padding: "5px 11px",
                fontSize: "10.5px",
                whiteSpace: "nowrap",
                borderColor:
                  seccion === s ? "var(--sentinel-cyan)" : "var(--sentinel-borde)",
                color: seccion === s ? "var(--sentinel-cyan)" : "var(--sentinel-texto-suave)"
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* ---- CUERPO ---- */}

        <div style={{ padding: "18px 22px", overflowY: "auto", flex: 1 }}>
          {seccion === "Resumen" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={rejilla}>
                <Dato etiqueta="Cuentas en el expediente" valor={r.cuentasTotales} />
                <Dato
                  etiqueta="Monitorizables hoy"
                  valor={r.cuentasMonitorizables}
                  nota="Plataformas que admiten alguna lectura con la infraestructura actual."
                />
                <Dato etiqueta="Observadas" valor={r.cuentasObservadas} />
                <Dato
                  etiqueta="Última observación"
                  valor={
                    r.ultimaObservacion
                      ? fechaLocal(r.ultimaObservacion, proyecto)
                      : null
                  }
                />
                <Dato
                  etiqueta="Publicaciones observadas"
                  valor={datos.actividad?.publicacionesObservadas ?? 0}
                  nota={datos.notaPublicaciones}
                />
                <Dato
                  etiqueta="Temas propios detectados"
                  valor={datos.temas?.temas?.length ?? 0}
                />
              </div>

              {r.proveedores?.length > 0 && (
                <div style={caja}>
                  <div style={rotulo}>Proveedores utilizados</div>
                  <div style={{ color: "var(--sentinel-texto)", fontSize: "11.5px" }}>
                    {r.proveedores.join(" · ")}
                  </div>
                </div>
              )}
            </div>
          )}

          {seccion === "Cuentas" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
              {datos.cuentas.length === 0 ? (
                <Vacio texto="Este candidato no tiene ninguna cuenta en el expediente. Cárgalas desde «Editar identidad» y vuelve aquí." />
              ) : (
                datos.cuentas.map((c) => {
                  const obs = (datos.observaciones || []).find(
                    (o) => o.accountId === c.accountId
                  );

                  const estado = obs?.estado || "NO_EJECUTADA";

                  return (
                    <div key={c.accountId} style={caja}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "9px",
                          flexWrap: "wrap"
                        }}
                      >
                        <strong style={{ color: "#FFFFFF", fontSize: "12.5px" }}>
                          {c.plataformaId} {c.handle ? `@${c.handle}` : ""}
                        </strong>

                        <span style={pill(TONOS[estado])}>{estado}</span>

                        {c.procedencia?.corroboradaPorSentinel && (
                          <span style={pill("#22C55E")}>corroborada</span>
                        )}

                        {c.procedencia?.declaradaPorAnalista && (
                          <span style={pill("#0B5FFF")}>declarada</span>
                        )}
                      </div>

                      <div
                        style={{
                          color: "var(--sentinel-texto-suave)",
                          fontSize: "10px",
                          marginTop: "6px",
                          lineHeight: 1.7
                        }}
                      >
                        {obs?.motivo || obs?.limitaciones?.[0] || "sin observación todavía"}

                        {obs?.metricasNoDisponibles?.length > 0 && (
                          <>
                            <br />
                            no obtenible hoy: {obs.metricasNoDisponibles.join(", ")}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {seccion === "Actividad" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={rejilla}>
                <Dato
                  etiqueta="Publicaciones 7 días"
                  valor={datos.actividad?.publicacionesObservadas7d}
                />
                <Dato
                  etiqueta="Publicaciones 30 días"
                  valor={datos.actividad?.publicacionesObservadas30d}
                />
                <Dato
                  etiqueta="Frecuencia (por día)"
                  valor={datos.actividad?.frecuenciaPublicacion}
                  nota={datos.actividad?.regla}
                />
                <Dato
                  etiqueta="Última actividad"
                  valor={
                    datos.actividad?.ultimaActividad
                      ? fechaLocal(datos.actividad.ultimaActividad, proyecto)
                      : null
                  }
                />
              </div>

              {datos.actividad?.advertencia && (
                <Vacio texto={datos.actividad.advertencia} />
              )}
            </div>
          )}

          {seccion === "Publicaciones" && (
            <>
              {datos.publicaciones?.length === 0 ? (
                <Vacio texto={datos.notaPublicaciones} />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
                  {datos.publicaciones.map((p) => (
                    <div key={p.postId} style={caja}>
                      <div style={{ color: "#FFFFFF", fontSize: "12px" }}>
                        {p.title || p.text?.slice(0, 120) || p.url}
                      </div>
                      <div
                        style={{
                          color: "var(--sentinel-texto-tenue)",
                          fontSize: "10px",
                          marginTop: "5px"
                        }}
                      >
                        {p.platform} ·{" "}
                        {p.publishedAt ? fechaLocal(p.publishedAt, proyecto) : "sin fecha"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {seccion === "Temas" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={caja}>
                <div style={rotulo}>{datos.temas?.ambito}</div>
                <div
                  style={{
                    color: "var(--sentinel-texto-suave)",
                    fontSize: "11px",
                    lineHeight: 1.75
                  }}
                >
                  {datos.temas?.definicion}
                  <br />
                  <em style={{ fontStyle: "normal", color: "var(--sentinel-texto-tenue)" }}>
                    {datos.temas?.noEs}
                  </em>
                </div>
              </div>

              {datos.temas?.temas?.length ? (
                datos.temas.temas.map((t) => (
                  <div key={t.id} style={caja}>
                    <strong style={{ color: "#FFFFFF", fontSize: "12px" }}>
                      {t.nombre}
                    </strong>
                    <div
                      style={{
                        color: "var(--sentinel-texto-tenue)",
                        fontSize: "10px",
                        marginTop: "4px"
                      }}
                    >
                      {t.evidencias} publicación(es) · {(t.terminos || []).join(", ")}
                    </div>
                  </div>
                ))
              ) : (
                <Vacio texto={datos.temas?.advertencia || "Sin temas propios."} />
              )}
            </div>
          )}

          {seccion === "Métricas" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div
                style={{
                  ...caja,
                  borderColor: "#F59E0B",
                  color: "#F59E0B",
                  fontSize: "10.5px",
                  lineHeight: 1.75,
                  display: "flex",
                  gap: "9px"
                }}
              >
                <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: "2px" }} />
                <span>{r.metricasNoComparables}</span>
              </div>

              {(r.plataformas || []).map((p) => (
                <div key={p.plataformaId} style={caja}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "9px",
                      flexWrap: "wrap"
                    }}
                  >
                    <strong style={{ color: "#FFFFFF", fontSize: "12px" }}>
                      {p.plataforma}
                    </strong>

                    <span style={pill(TONOS[p.estado] || TONOS.NO_EJECUTADA)}>
                      {p.estado || "sin cuenta"}
                    </span>

                    <span
                      style={{ color: "var(--sentinel-texto-tenue)", fontSize: "9.5px" }}
                    >
                      {CAPACIDAD_TEXTO[p.capacidad] || p.capacidad}
                    </span>
                  </div>

                  <div
                    style={{
                      color: "var(--sentinel-texto-suave)",
                      fontSize: "10px",
                      marginTop: "6px",
                      lineHeight: 1.7
                    }}
                  >
                    {p.nota || p.motivoCapacidad}

                    {p.metricasNecesarias?.length > 0 && (
                      <>
                        <br />
                        haría falta poder leer: {p.metricasNecesarias.join(", ")}
                      </>
                    )}

                    {p.metricasObtenidas?.length > 0 && (
                      <>
                        <br />
                        obtenido: {p.metricasObtenidas.join(", ")}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {seccion === "Histórico" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
              <div style={caja}>
                <div style={rotulo}>Snapshots acumulados</div>
                <div
                  style={{
                    color: "var(--sentinel-texto-suave)",
                    fontSize: "11px",
                    lineHeight: 1.75
                  }}
                >
                  {datos.historico?.nota}
                </div>
              </div>

              {datos.historico?.total ? (
                datos.historico.snapshots.map((sn) => (
                  <div key={sn.snapshotId} style={caja}>
                    <div
                      style={{
                        display: "flex",
                        gap: "9px",
                        alignItems: "center",
                        flexWrap: "wrap"
                      }}
                    >
                      <strong style={{ color: "#FFFFFF", fontSize: "11.5px" }}>
                        {sn.platform}
                      </strong>

                      <span style={pill(TONOS[sn.estado] || TONOS.NO_EJECUTADA)}>
                        {sn.estado}
                      </span>

                      <span
                        style={{ color: "var(--sentinel-texto-tenue)", fontSize: "10px" }}
                      >
                        {fechaLocal(sn.capturedAt, proyecto)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <Vacio texto="Todavía no hay ningún snapshot. Se acumulan desde la primera observación: no se reconstruye historia anterior." />
              )}
            </div>
          )}

          {seccion === "Limitaciones" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
              {(r.limitaciones || []).length === 0 ? (
                <Vacio texto="Sin limitaciones registradas todavía: aparecerán al ejecutar la primera observación." />
              ) : (
                (r.limitaciones || []).map((l) => (
                  <div
                    key={l}
                    style={{
                      ...caja,
                      color: "var(--sentinel-texto-suave)",
                      fontSize: "11px",
                      lineHeight: 1.7
                    }}
                  >
                    {l}
                  </div>
                ))
              )}

              <div
                style={{
                  color: "var(--sentinel-texto-tenue)",
                  fontSize: "10px",
                  marginTop: "6px",
                  lineHeight: 1.7
                }}
              >
                Ningún estado de esta pantalla afirma que el candidato no
                publique o no tenga presencia: describen lo que Sentinel pudo o
                no pudo observar con las fuentes disponibles.
              </div>
            </div>
          )}
        </div>

        {/* ---- PIE: TRAZA ---- */}

        <div
          style={{
            padding: "11px 22px",
            borderTop: "1px solid var(--sentinel-borde)",
            color: "var(--sentinel-texto-tenue)",
            fontSize: "9.5px",
            lineHeight: 1.7
          }}
        >
          {datos.traza?.ejecutado
            ? `Observación ejecutada · ${datos.traza.peticionesRealizadas} de ${datos.traza.topePeticiones} peticiones · ${datos.traza.snapshotsEscritos} snapshot(s) escritos`
            : "Estado leído sin salir a la red. Pulsa «Observar cuentas» para consultar las plataformas que lo permitan."}
        </div>
      </div>
    </div>
  );
}
