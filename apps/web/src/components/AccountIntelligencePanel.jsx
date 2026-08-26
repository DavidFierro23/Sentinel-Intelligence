import { useState } from "react";
import {
  X,
  Activity,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Info,
  Link2,
  MapPin,
  Newspaper,
  Share2,
  FileText,
  Clock,
  ExternalLink
} from "lucide-react";

import { fechaLocal } from "../services/identidadCandidato";

/*
===========================================================
CANDIDATE INTELLIGENCE — V1
===========================================================

Una cuenta consolidada deja de ser solo identidad y pasa a ser
objeto de observacion longitudinal.

LO QUE ESTA PANTALLA SE PROHIBE

    NO puntuacion por candidato.
    NO ranking.
    NO indice compuesto de presencia.
    NO «actividad baja» sin metodologia.
    NO llamar personas a las publicaciones.
    NO decir «el candidato no publica» cuando lo que ocurrio es
       que no pudimos leer sus publicaciones.
    NO presentar una relacion digital observada como una
       relacion politica real.

ESTADOS VACIOS HONESTOS

Casi todo va a estar vacio en esta fase, y esta bien: lo que NO
se puede hacer es que un hueco parezca un dato. Cada seccion
vacia dice por que lo esta.

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

/* Estados de Account Resolution. */
const TONO_RESOLUCION = {
  CONSOLIDADA: "#22C55E",
  CORROBORADA: "#22C55E",
  DECLARADA: "#0B5FFF",
  CANDIDATA: "#F59E0B",
  DESCUBIERTA: "var(--sentinel-texto-tenue)",
  NO_REENCONTRADA: "#F59E0B",
  DUDOSA: "#EF4444",
  DESCARTADA: "var(--sentinel-texto-tenue)"
};

const CAPACIDAD_TEXTO = {
  ADAPTER_AVAILABLE: "adaptador propio disponible",
  PUBLIC_METADATA_ONLY: "solo metadata pública",
  API_REQUIRED: "requiere API de la plataforma",
  PROVIDER_REQUIRED: "requiere un proveedor de datos",
  BLOCKED: "la plataforma lo bloquea",
  UNSUPPORTED: "no contemplado"
};

/*
  Diez secciones. La ficha compacta del candidato sigue siendo
  compacta: todo lo profundo vive aqui.
*/
const SECCIONES = [
  "Resumen",
  "Identidad",
  "Actividad",
  "Amplificación",
  "Medios",
  "Temas",
  "Relaciones",
  "Territorio",
  "Histórico",
  "Evidencias"
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

const parrafo = {
  color: "var(--sentinel-texto-suave)",
  fontSize: "11px",
  lineHeight: 1.75
};

const tenue = {
  color: "var(--sentinel-texto-tenue)",
  fontSize: "10px",
  lineHeight: 1.7
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


/* Una advertencia que hay que leer antes de mirar la cifra. */
function Aviso({ texto, icono: Icono = AlertTriangle, color = "#F59E0B" }) {
  return (
    <div
      style={{
        ...caja,
        borderColor: color,
        color,
        fontSize: "10.5px",
        lineHeight: 1.75,
        display: "flex",
        gap: "9px",
        alignItems: "flex-start"
      }}
    >
      <Icono size={13} style={{ flexShrink: 0, marginTop: "2px" }} />
      <span>{texto}</span>
    </div>
  );
}


/*
  El boton que hace verificable una afirmacion. Si no hay URL
  canonica no se dibuja: un «Ver evidencia» que no lleva a
  ninguna parte es peor que no ofrecerlo.
*/
function VerEvidencia({ url, etiqueta = "Ver evidencia" }) {
  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        color: "var(--sentinel-cyan)",
        border: "1px solid var(--sentinel-cyan)",
        borderRadius: "var(--radio-pill)",
        padding: "2px 9px",
        fontSize: "9.5px",
        textDecoration: "none",
        whiteSpace: "nowrap"
      }}
    >
      <ExternalLink size={10} /> {etiqueta}
    </a>
  );
}


/*
  Las senales de cross-link de UNA cuenta. Es lo que explica por
  que ascendio: quien publico el enlace, cuando se vio por
  primera vez y cuantas veces se ha vuelto a ver.
*/
function CrossLinks({ senales, proyecto }) {
  if (!senales?.length) return null;

  return (
    <div style={{ marginTop: "9px" }}>
      <div style={{ ...rotulo, marginBottom: "4px" }}>
        Enlaces cruzados observados
      </div>

      {senales.map((s) => (
        <div
          key={s.relationId}
          style={{
            display: "flex",
            gap: "8px",
            alignItems: "baseline",
            flexWrap: "wrap",
            marginTop: "5px"
          }}
        >
          <Link2 size={11} color="#22C55E" style={{ flexShrink: 0 }} />

          <span style={pill("#22C55E")}>{s.direccion}</span>

          <span style={{ ...tenue, flex: "1 1 240px", wordBreak: "break-all" }}>
            {s.sourceUrl}
          </span>

          <span style={tenue}>
            {s.firstObservedAt
              ? `1.ª vez ${fechaLocal(s.firstObservedAt, proyecto)}`
              : "sin primera observación"}
            {s.lastObservedAt && s.lastObservedAt !== s.firstObservedAt
              ? ` · última ${fechaLocal(s.lastObservedAt, proyecto)}`
              : ""}
            {s.observationCount > 1 ? ` · ${s.observationCount} observaciones` : ""}
          </span>

          <VerEvidencia url={s.sourceUrl} etiqueta="Ver origen" />
        </div>
      ))}

      <div style={{ ...tenue, marginTop: "6px" }}>
        Una relación vista varias veces sigue siendo UNA señal: el recuento
        son observaciones, no corroboraciones.
      </div>
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


/*
  Una barra explicable: el valor y de que se compone. Sin los
  componentes seria un numero sin defensa.
*/
function Medida({ titulo, valor, maximo = 100, componentes, formula, nota }) {
  return (
    <div style={caja}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "10px"
        }}
      >
        <div style={rotulo}>{titulo}</div>

        <div
          style={{
            color: valor == null ? "var(--sentinel-texto-tenue)" : "#FFFFFF",
            fontSize: "15px",
            fontFamily: "monospace"
          }}
        >
          {valor == null ? "sin dato" : `${valor}/${maximo}`}
        </div>
      </div>

      {valor != null && (
        <div
          style={{
            height: "4px",
            background: "var(--sentinel-borde)",
            borderRadius: "2px",
            overflow: "hidden",
            margin: "8px 0"
          }}
        >
          <div
            style={{
              width: `${Math.min(100, (valor / maximo) * 100)}%`,
              height: "100%",
              background: "var(--sentinel-cyan)"
            }}
          />
        </div>
      )}

      {(componentes || []).map((c) => (
        <div
          key={c.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "10px",
            marginTop: "5px"
          }}
        >
          <span style={{ ...tenue, flex: 1 }}>
            {c.nombre} — {c.detalle}
          </span>

          <span
            style={{
              color: "var(--sentinel-texto)",
              fontSize: "10px",
              fontFamily: "monospace",
              whiteSpace: "nowrap"
            }}
          >
            {c.valor}/{c.maximo}
          </span>
        </div>
      ))}

      {formula && <div style={{ ...tenue, marginTop: "9px" }}>{formula}</div>}

      {nota && <div style={{ ...tenue, marginTop: "7px" }}>{nota}</div>}
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

  const resolucion = datos.resolucion || null;

  const solidez = datos.solidez || null;

  const amplificacion = datos.amplificacion || null;

  const presencia = datos.presencia || null;

  const rejilla = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
    gap: "10px"
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Candidate Intelligence"
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
          width: "min(1040px, 100%)",
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
                  Candidate Intelligence
                </h2>

                <span style={pill("var(--sentinel-cyan)")}>v1</span>
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
          {/* =============== RESUMEN =============== */}

          {seccion === "Resumen" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={rejilla}>
                <Dato etiqueta="Cuentas en el expediente" valor={r.cuentasTotales} />
                <Dato
                  etiqueta="Corroboradas"
                  valor={resolucion?.resumen?.corroboradas}
                  nota="Con al menos una señal independiente del nombre."
                />
                <Dato
                  etiqueta="Sin señal independiente"
                  valor={resolucion?.resumen?.sinSenalIndependiente}
                  nota="El nombre coincide, y eso no corrobora."
                />
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
              </div>

              {/*
                PRESENCIA DIGITAL OBSERVADA. El indice compuesto se
                muestra NO DISPONIBLE a proposito: es lo que
                impide que alguien lea la pantalla como un ranking.
              */}
              {presencia && (
                <>
                  <div style={caja}>
                    <div style={rotulo}>{presencia.etiqueta}</div>

                    <div
                      style={{
                        color: "var(--sentinel-texto-tenue)",
                        fontSize: "20px",
                        fontFamily: "monospace"
                      }}
                    >
                      NO DISPONIBLE
                    </div>

                    <div style={{ ...tenue, marginTop: "7px" }}>
                      {presencia.indice?.motivo}
                    </div>

                    <div style={{ ...tenue, marginTop: "9px" }}>
                      Falta:{" "}
                      {(presencia.indice?.requisitos || [])
                        .filter((x) => !x.cumplido)
                        .map((x) => x.id)
                        .join(" · ")}
                    </div>
                  </div>

                  <div style={rejilla}>
                    {(presencia.dimensiones || []).map((d) => (
                      <Dato
                        key={d.id}
                        etiqueta={d.nombre}
                        valor={d.valor}
                        nota={d.motivoNoDisponible || `${d.unidad} · ${d.metodologia}`}
                      />
                    ))}
                  </div>

                  <Aviso
                    texto={`${presencia.declaracion?.texto} ${presencia.declaracion?.universo}`}
                  />
                </>
              )}

              {/*
                LIMITACIONES. En el resumen, no escondidas en una
                pestaña: son parte del resultado.
              */}
              {(r.limitaciones || []).length > 0 && (
                <div style={caja}>
                  <div style={rotulo}>Limitaciones registradas</div>

                  {(r.limitaciones || []).map((l) => (
                    <div key={l} style={{ ...tenue, marginTop: "5px" }}>
                      · {l}
                    </div>
                  ))}
                </div>
              )}

              <div style={tenue}>
                Ningún estado de esta pantalla afirma que el candidato no
                publique o no tenga presencia: describen lo que Sentinel pudo o
                no pudo observar con las fuentes disponibles.
              </div>
            </div>
          )}

          {/* =============== IDENTIDAD =============== */}

          {seccion === "Identidad" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {/*
                LAS DOS METRICAS, SEPARADAS. La segunda mide a
                nuestros proveedores y por eso NO se resta de la
                primera.
              */}
              {solidez && (
                <>
                  <Medida
                    titulo="Solidez del expediente (identidad)"
                    valor={solidez.identidad?.valor}
                    componentes={solidez.identidad?.componentes}
                    formula={solidez.identidad?.formula}
                    nota={(solidez.identidad?.noEs || []).join(" ")}
                  />

                  <Medida
                    titulo="Reencontrabilidad en la última verificación"
                    valor={solidez.reencontrabilidad?.valor}
                    formula={solidez.reencontrabilidad?.formula}
                    nota={
                      solidez.reencontrabilidad?.advertencia ||
                      solidez.reencontrabilidad?.motivo
                    }
                  />

                  <div style={tenue}>{solidez.relacion}</div>
                </>
              )}

              {resolucion?.resumen?.multiplesPorPlataforma?.length > 0 &&
                resolucion.resumen.multiplesPorPlataforma.map((m) => (
                  <Aviso
                    key={m.plataformaId}
                    texto={`${m.plataformaId}: ${m.cuentas.length} cuentas. ${m.nota}`}
                  />
                ))}

              {datos.crossLinks && (
                <div style={caja}>
                  <div style={rotulo}>Evidencia de enlace cruzado</div>

                  <div style={parrafo}>
                    {datos.crossLinks.total} relación(es) observada(s) ·{" "}
                    {datos.crossLinks.aportanCorroboracion} aporta(n)
                    corroboración independiente
                  </div>

                  {Object.entries(datos.crossLinks.porDireccion || {}).map(
                    ([k, v]) => (
                      <div key={k} style={{ ...tenue, marginTop: "5px" }}>
                        {v} × {k}
                      </div>
                    )
                  )}

                  <div style={{ ...tenue, marginTop: "7px" }}>
                    {datos.crossLinks.nota}
                  </div>

                  {(datos.crossLinks.ultimosIntentos || []).length > 0 && (
                    <div style={{ marginTop: "9px" }}>
                      <div style={{ ...rotulo, marginBottom: "4px" }}>
                        Última observación de enlaces
                      </div>

                      {datos.crossLinks.ultimosIntentos.map((i, n) => (
                        <div
                          key={`${i.sourceUrl}-${n}`}
                          style={{
                            display: "flex",
                            gap: "8px",
                            alignItems: "baseline",
                            flexWrap: "wrap",
                            marginTop: "4px"
                          }}
                        >
                          <span
                            style={pill(
                              i.estado === "OBSERVADA"
                                ? "#22C55E"
                                : i.estado === "ERROR" || i.estado === "BLOQUEADA"
                                  ? "#EF4444"
                                  : "#F59E0B"
                            )}
                          >
                            {i.estado}
                          </span>

                          <span
                            style={{ ...tenue, flex: "1 1 200px", wordBreak: "break-all" }}
                          >
                            {i.sourceUrl}
                          </span>

                          <span style={tenue}>
                            {i.cuentasEnlazadas != null
                              ? `${i.cuentasEnlazadas} cuenta(s)`
                              : ""}
                            {i.motivo ? ` · ${i.motivo}` : ""}
                            {i.notaMismoDominio ? ` · ${i.notaMismoDominio}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={caja}>
                <div style={rotulo}>Regla de corroboración</div>
                <div style={parrafo}>{resolucion?.regla}</div>
                <div style={{ ...tenue, marginTop: "7px" }}>
                  Prohibido: {(resolucion?.prohibido || []).join(" · ")}
                </div>
              </div>

              {(datos.cuentas || []).length === 0 ? (
                <Vacio texto="Este candidato no tiene ninguna cuenta en el expediente. Cárgalas desde «Editar identidad» y vuelve aquí." />
              ) : (
                (datos.cuentas || []).map((c) => {
                  const obs = (datos.observaciones || []).find(
                    (o) => o.accountId === c.accountId
                  );

                  const estadoObs = obs?.estado || "NO_EJECUTADA";

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
                          {c.plataforma || c.plataformaId}{" "}
                          {c.handle ? `@${c.handle}` : ""}
                        </strong>

                        <span
                          style={pill(
                            TONO_RESOLUCION[c.estado] || "var(--sentinel-texto-tenue)"
                          )}
                        >
                          {c.estado}
                        </span>

                        <span style={pill(TONOS[estadoObs])}>{estadoObs}</span>

                        {c.procedencia?.declaradaPorAnalista && (
                          <span style={pill("#0B5FFF")}>declarada</span>
                        )}

                        <span
                          style={{
                            marginLeft: "auto",
                            color: "var(--sentinel-texto)",
                            fontSize: "10.5px",
                            fontFamily: "monospace"
                          }}
                        >
                          {c.solidez?.valor ?? 0}/100
                        </span>
                      </div>

                      {/* POR QUE ese estado. */}
                      <div style={{ ...tenue, marginTop: "7px" }}>
                        {(c.razones || []).join(" · ")}
                      </div>

                      {/*
                        LAS SENALES, con su independencia a la
                        vista: es lo que distingue una atribucion
                        sostenida de un parecido de nombre.
                      */}
                      {(c.senales || []).length > 0 && (
                        <div style={{ marginTop: "8px" }}>
                          {c.senales.map((s) => (
                            <div
                              key={s.id}
                              style={{
                                display: "flex",
                                gap: "8px",
                                alignItems: "baseline",
                                flexWrap: "wrap",
                                marginTop: "4px"
                              }}
                            >
                              <span
                                style={pill(
                                  s.independiente
                                    ? "#22C55E"
                                    : "var(--sentinel-texto-tenue)"
                                )}
                              >
                                {s.independiente ? "independiente" : "no corrobora"}
                              </span>

                              <span
                                style={{
                                  color: "var(--sentinel-texto)",
                                  fontSize: "10px"
                                }}
                              >
                                {s.nombre}
                              </span>

                              <span style={{ ...tenue, flex: "1 1 180px" }}>
                                {s.detalle || s.explicacion}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/*
                        LOS ENLACES CRUZADOS DE ESTA CUENTA.
                        Es la evidencia concreta que la sostiene.
                      */}
                      <CrossLinks
                        senales={(datos.crossLinks?.senales || []).filter(
                          (s) => s.accountId === c.accountId
                        )}
                        proyecto={proyecto}
                      />

                      {c.observacion?.nota && (
                        <div
                          style={{
                            ...tenue,
                            marginTop: "8px",
                            color: "#F59E0B"
                          }}
                        >
                          {c.observacion.nota}
                        </div>
                      )}

                      <div style={{ ...tenue, marginTop: "8px" }}>
                        {c.firstSeenAt
                          ? `primera observación ${fechaLocal(c.firstSeenAt, proyecto)}`
                          : "sin primera observación registrada"}
                        {c.lastSeenAt
                          ? ` · última vista ${fechaLocal(c.lastSeenAt, proyecto)}`
                          : ""}
                        {c.lastCheckedAt
                          ? ` · última verificación ${fechaLocal(c.lastCheckedAt, proyecto)}`
                          : ""}
                        {c.historiaIncompleta
                          ? " · historia incompleta: el expediente es anterior al contrato longitudinal"
                          : ""}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* =============== ACTIVIDAD =============== */}

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

              {/* Publicaciones propias. */}
              <div style={caja}>
                <div style={rotulo}>Publicaciones propias observadas</div>
                <div style={parrafo}>
                  {datos.publicaciones?.length
                    ? `${datos.publicaciones.length} publicación(es).`
                    : datos.notaPublicaciones}
                </div>
              </div>

              {(datos.publicaciones || []).map((p) => (
                <div key={p.postId} style={caja}>
                  <div style={{ color: "#FFFFFF", fontSize: "12px" }}>
                    {p.title || p.text?.slice(0, 120) || p.url}
                  </div>
                  <div style={{ ...tenue, marginTop: "5px" }}>
                    {p.platform} ·{" "}
                    {p.publishedAt ? fechaLocal(p.publishedAt, proyecto) : "sin fecha"}
                  </div>
                </div>
              ))}

              {/*
                ESTADO DE LAS METRICAS DE RENDIMIENTO. Ninguna
                disponible, y cada una dice que le falta. No hay
                etiqueta «viral» en ninguna parte.
              */}
              {datos.metricas && (
                <div style={caja}>
                  <div style={rotulo}>
                    Métricas de rendimiento — {datos.metricas.disponibles} de{" "}
                    {datos.metricas.total} disponibles
                  </div>

                  {(datos.metricas.tipos || []).map((m) => (
                    <div key={m.id} style={{ marginTop: "8px" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          alignItems: "baseline",
                          flexWrap: "wrap"
                        }}
                      >
                        <span
                          style={pill(
                            m.disponible ? "#22C55E" : "var(--sentinel-texto-tenue)"
                          )}
                        >
                          {m.disponible ? "disponible" : "no disponible"}
                        </span>

                        <strong style={{ color: "#FFFFFF", fontSize: "11.5px" }}>
                          {m.nombre}
                        </strong>
                      </div>

                      <div style={{ ...tenue, marginTop: "4px" }}>
                        {m.metodologia}
                      </div>

                      {!m.disponible && (
                        <div style={{ ...tenue, marginTop: "3px", color: "#F59E0B" }}>
                          falta: {m.motivoNoDisponible}
                        </div>
                      )}
                    </div>
                  ))}

                  <div style={{ ...tenue, marginTop: "9px" }}>
                    {datos.metricas.nota}
                  </div>
                </div>
              )}

              {/*
                PREPARACION PARA OBSERVACION REAL. Lo que hace
                falta de una persona, dicho donde se ve.
              */}
              {datos.preparacion && (
                <div style={caja}>
                  <div style={rotulo}>Preparación para observación real</div>

                  {(datos.preparacion.plataformas || []).map((p) => (
                    <div
                      key={p.plataformaId}
                      style={{
                        display: "flex",
                        gap: "8px",
                        alignItems: "baseline",
                        flexWrap: "wrap",
                        marginTop: "6px"
                      }}
                    >
                      <span
                        style={pill(
                          p.estado === "LISTO"
                            ? "#22C55E"
                            : p.estado === "SIN_CREDENCIAL"
                              ? "#F59E0B"
                              : "var(--sentinel-texto-tenue)"
                        )}
                      >
                        {p.estado}
                      </span>

                      <strong style={{ color: "#FFFFFF", fontSize: "11.5px" }}>
                        {p.plataforma}
                      </strong>

                      <span style={{ ...tenue, flex: "1 1 200px" }}>
                        {p.motivo}
                      </span>
                    </div>
                  ))}

                  {(datos.preparacion.accionRequerida || []).map((x) => (
                    <div
                      key={x.variable}
                      style={{ ...tenue, marginTop: "8px", color: "#F59E0B" }}
                    >
                      Requiere configurar <strong>{x.variable}</strong>
                      {x.cuotaDeclarada
                        ? ` · cuota declarada por el adaptador: ${x.cuotaDeclarada} unidades/día`
                        : ""}
                    </div>
                  ))}

                  <div style={{ ...tenue, marginTop: "8px" }}>
                    {datos.preparacion.nota}
                  </div>
                </div>
              )}

              {/* CAPACIDAD REAL POR PLATAFORMA. */}
              <Aviso texto={r.metricasNoComparables} />

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

                    <span style={{ ...tenue, fontSize: "9.5px" }}>
                      {CAPACIDAD_TEXTO[p.capacidad] || p.capacidad}
                    </span>
                  </div>

                  <div style={{ ...tenue, marginTop: "6px" }}>
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

          {/* =============== AMPLIFICACIÓN =============== */}

          {seccion === "Amplificación" && amplificacion && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {/*
                LAS TRES CIFRAS, SEPARADAS. Diez portales copiando
                una nota son diez piezas, un hecho y N fuentes: no
                diez señales.
              */}
              <div style={rejilla}>
                <Dato
                  etiqueta="Presencia propia"
                  valor={amplificacion.propia?.piezas}
                  nota={amplificacion.propia?.definicion}
                />
                <Dato
                  etiqueta="Piezas de terceros"
                  valor={amplificacion.ganada?.piezas}
                  nota="Lo que se encontró."
                />
                <Dato
                  etiqueta="Hechos distintos"
                  valor={amplificacion.ganada?.hechosDistintos}
                  nota="Cuántas cosas distintas se dijeron, ya deduplicadas."
                />
                <Dato
                  etiqueta="Fuentes distintas"
                  valor={amplificacion.ganada?.fuentesDistintas}
                  nota="Cuántos actores lo dijeron."
                />
                <Dato
                  etiqueta="Piezas que son réplica"
                  valor={amplificacion.ganada?.piezasQueSonReplica}
                />
                <Dato
                  etiqueta="Personas"
                  valor={null}
                  nota={amplificacion.notaPersonas}
                />
              </div>

              <div style={caja}>
                <div style={rotulo}>Interpretación</div>
                <div style={parrafo}>{amplificacion.ganada?.interpretacion}</div>
              </div>

              {amplificacion.propia?.advertencia && (
                <Vacio texto={amplificacion.propia.advertencia} />
              )}

              {amplificacion.corpus?.nota && (
                <Vacio texto={amplificacion.corpus.nota} />
              )}

              {/* Grupos de réplica, con sus títulos. */}
              {(amplificacion.ganada?.replicas || []).map((rep, i) => (
                <div key={`${rep.representante}-${i}`} style={caja}>
                  <div
                    style={{
                      display: "flex",
                      gap: "9px",
                      alignItems: "center",
                      flexWrap: "wrap"
                    }}
                  >
                    <Share2 size={12} color="#F59E0B" />

                    <strong style={{ color: "#FFFFFF", fontSize: "11.5px" }}>
                      {rep.representante}
                    </strong>

                    <span style={pill("#F59E0B")}>{rep.piezas} piezas · 1 hecho</span>
                  </div>

                  <div style={{ ...tenue, marginTop: "6px" }}>{rep.nota}</div>
                </div>
              ))}

              {/* Los cuatro planos de conversación. */}
              {datos.conversacion && (
                <>
                  <div style={caja}>
                    <div style={rotulo}>Conversación pública relacionada</div>

                    {(datos.conversacion.planos || []).map((p) => (
                      <div
                        key={p.clave}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "10px",
                          marginTop: "7px"
                        }}
                      >
                        <span style={{ ...tenue, flex: 1 }}>
                          <strong style={{ color: "var(--sentinel-texto)" }}>
                            {p.nombre}
                          </strong>
                          <br />
                          {p.definicion}
                        </span>

                        <span
                          style={{
                            color: "#FFFFFF",
                            fontSize: "13px",
                            fontFamily: "monospace"
                          }}
                        >
                          {p.piezasObservadas}
                        </span>
                      </div>
                    ))}
                  </div>

                  <Aviso texto={datos.conversacion.prohibicion} />
                </>
              )}
            </div>
          )}

          {/* =============== MEDIOS =============== */}

          {seccion === "Medios" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={rejilla}>
                <Dato
                  etiqueta="Dominios distintos"
                  valor={datos.medios?.dominiosDistintos}
                  nota="La diversidad se mide en dominios, no en piezas."
                />
                <Dato etiqueta="Locales" valor={datos.medios?.locales} />
                <Dato etiqueta="Nacionales" valor={datos.medios?.nacionales} />
                <Dato
                  etiqueta="Fuera del catálogo"
                  valor={datos.medios?.desconocidos}
                  nota="No se les asigna tipo por conjetura."
                />
              </div>

              {(datos.medios?.detalle || []).length === 0 ? (
                <Vacio texto="Todavía no hay ningún medio en el corpus de este candidato. El corpus lo escriben las investigaciones: se acumula desde la primera posterior a este contrato." />
              ) : (
                (datos.medios.detalle || []).map((m) => (
                  <div key={m.dominio} style={caja}>
                    <div
                      style={{
                        display: "flex",
                        gap: "9px",
                        alignItems: "center",
                        flexWrap: "wrap"
                      }}
                    >
                      <Newspaper size={12} color="var(--sentinel-cyan)" />

                      <strong style={{ color: "#FFFFFF", fontSize: "11.5px" }}>
                        {m.nombre || m.dominio}
                      </strong>

                      <span style={pill("var(--sentinel-texto-tenue)")}>{m.tipo}</span>

                      <span
                        style={{
                          marginLeft: "auto",
                          color: "var(--sentinel-texto)",
                          fontSize: "10.5px",
                          fontFamily: "monospace"
                        }}
                      >
                        {m.evidencias} pieza(s)
                      </span>
                    </div>

                    <div style={{ ...tenue, marginTop: "6px" }}>
                      {m.dominio}
                      {m.primeraFecha ? ` · desde ${m.primeraFecha}` : ""}
                      {m.ultimaFecha ? ` · hasta ${m.ultimaFecha}` : ""}
                    </div>
                  </div>
                ))
              )}

              {(datos.medios?.loQueNoSabemos || []).map((x) => (
                <div key={x} style={tenue}>
                  · {x}
                </div>
              ))}

              {/* El contrato con Media Intelligence, declarado. */}
              {datos.medios?.contrato && (
                <div style={caja}>
                  <div style={rotulo}>
                    Contrato con Media Intelligence — {datos.medios.contrato.estado}
                  </div>

                  <div style={parrafo}>{datos.medios.contrato.motivo}</div>

                  <div style={{ ...tenue, marginTop: "8px" }}>
                    Debe devolver:{" "}
                    {(datos.medios.contrato.debeDevolverMediaIntelligence || []).join(
                      " · "
                    )}
                  </div>

                  {(datos.medios.contrato.reglas || []).map((x) => (
                    <div key={x} style={{ ...tenue, marginTop: "5px" }}>
                      · {x}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =============== TEMAS =============== */}

          {seccion === "Temas" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={caja}>
                <div style={rotulo}>{datos.temas?.ambito}</div>
                <div style={parrafo}>
                  {datos.temas?.definicion}
                  <br />
                  <em
                    style={{
                      fontStyle: "normal",
                      color: "var(--sentinel-texto-tenue)"
                    }}
                  >
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
                    <div style={{ ...tenue, marginTop: "4px" }}>
                      {t.evidencias} publicación(es) · {(t.terminos || []).join(", ")}
                    </div>
                  </div>
                ))
              ) : (
                <Vacio texto={datos.temas?.advertencia || "Sin temas propios."} />
              )}
            </div>
          )}

          {/* =============== RELACIONES =============== */}

          {seccion === "Relaciones" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {/*
                LA ADVERTENCIA VA PRIMERA. Un grafo de relaciones
                sin ella se lee como un mapa de alianzas.
              */}
              <Aviso
                icono={Link2}
                texto={`${datos.relaciones?.advertencia?.titulo}. ${datos.relaciones?.advertencia?.texto}`}
              />

              <div style={rejilla}>
                <Dato
                  etiqueta="Relaciones observadas"
                  valor={datos.relaciones?.total}
                />
                {Object.entries(datos.relaciones?.porTipo || {}).map(([k, v]) => (
                  <Dato key={k} etiqueta={k} valor={v} />
                ))}
              </div>

              {(datos.relaciones?.relaciones || []).length === 0 ? (
                <Vacio
                  texto={
                    datos.relaciones?.nota ||
                    "Sin relaciones observables todavía."
                  }
                />
              ) : (
                (datos.relaciones.relaciones || []).slice(0, 40).map((x) => (
                  <div key={x.relationId} style={caja}>
                    <div
                      style={{
                        display: "flex",
                        gap: "9px",
                        alignItems: "baseline",
                        flexWrap: "wrap"
                      }}
                    >
                      <span style={pill("var(--sentinel-cyan)")}>{x.tipo}</span>

                      <span
                        style={{ color: "#FFFFFF", fontSize: "11.5px" }}
                      >
                        {x.source}
                      </span>

                      <span style={tenue}>→ {x.target}</span>

                      {x.timestamp && (
                        <span style={{ ...tenue, marginLeft: "auto" }}>
                          {x.timestamp}
                        </span>
                      )}
                    </div>

                    <div style={{ ...tenue, marginTop: "6px" }}>
                      confianza: {x.confidence == null ? "sin dato" : x.confidence} ·{" "}
                      {x.explicacionConfidence}
                    </div>
                  </div>
                ))
              )}

              {(datos.relaciones?.noImplementado || []).length > 0 && (
                <div style={caja}>
                  <div style={rotulo}>No observable todavía</div>

                  {datos.relaciones.noImplementado.map((x) => (
                    <div key={x} style={{ ...tenue, marginTop: "5px" }}>
                      · {x}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =============== TERRITORIO =============== */}

          {seccion === "Territorio" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={rejilla}>
                <Dato
                  etiqueta="Piezas ubicadas"
                  valor={datos.territorio?.total}
                  nota="Se ubica la pieza, nunca a la persona."
                />
                <Dato
                  etiqueta="Rechazadas por GEO-1"
                  valor={datos.territorio?.rechazados}
                />
              </div>

              <Vacio texto={datos.territorio?.nota} />

              {Object.entries(datos.territorio?.motivosDeRechazo || {}).length > 0 && (
                <div style={caja}>
                  <div style={rotulo}>Motivos de rechazo</div>

                  {Object.entries(datos.territorio.motivosDeRechazo).map(([k, v]) => (
                    <div key={k} style={{ ...tenue, marginTop: "5px" }}>
                      {v} × {k}
                    </div>
                  ))}
                </div>
              )}

              {(datos.territorio?.vinculos || []).map((v) => (
                <div key={v.evidenceId} style={caja}>
                  <div
                    style={{
                      display: "flex",
                      gap: "9px",
                      alignItems: "center",
                      flexWrap: "wrap"
                    }}
                  >
                    <MapPin size={12} color="var(--sentinel-cyan)" />

                    <strong style={{ color: "#FFFFFF", fontSize: "11.5px" }}>
                      {v.territoryId}
                    </strong>

                    <span style={pill("var(--sentinel-texto-tenue)")}>
                      {v.geoResolution}
                    </span>
                  </div>

                  <div style={{ ...tenue, marginTop: "6px" }}>
                    método {v.provenance?.metodo} · {v.nota}
                  </div>
                </div>
              ))}

              <div style={caja}>
                <div style={rotulo}>Métodos prohibidos por diseño</div>
                <div style={tenue}>
                  {(datos.territorio?.metodosProhibidos || []).join(" · ")}
                </div>
              </div>
            </div>
          )}

          {/* =============== HISTÓRICO =============== */}

          {seccion === "Histórico" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={caja}>
                <div style={rotulo}>Serie de observaciones</div>
                <div style={parrafo}>{datos.historico?.nota}</div>
              </div>

              {/* LAS CUATRO VENTANAS. */}
              {(datos.historico?.ventanas || []).map((v) => (
                <div key={v.id} style={caja}>
                  <div
                    style={{
                      display: "flex",
                      gap: "9px",
                      alignItems: "center",
                      flexWrap: "wrap"
                    }}
                  >
                    <Clock size={12} color="var(--sentinel-cyan)" />

                    <strong style={{ color: "#FFFFFF", fontSize: "11.5px" }}>
                      {v.nombre}
                    </strong>

                    <span
                      style={pill(
                        v.comparable ? "#22C55E" : "var(--sentinel-texto-tenue)"
                      )}
                    >
                      {v.estado}
                    </span>

                    <span style={{ ...tenue, marginLeft: "auto" }}>
                      {v.observaciones} observación(es)
                    </span>
                  </div>

                  <div style={{ ...tenue, marginTop: "6px" }}>
                    {v.motivo || v.delta?.nota}
                  </div>
                </div>
              ))}

              {/* CAMBIO DE INVENTARIO. */}
              {datos.historico?.identidad?.ultimoCambio ? (
                <div style={caja}>
                  <div style={rotulo}>Cambios en el inventario de cuentas</div>

                  <div style={parrafo}>
                    aparecidas:{" "}
                    {datos.historico.identidad.ultimoCambio.aparecidas.length} ·
                    permanecen:{" "}
                    {datos.historico.identidad.ultimoCambio.permanecen.length} ·
                    ausentes del inventario:{" "}
                    {
                      datos.historico.identidad.ultimoCambio.ausentesDelInventario
                        .length
                    }
                  </div>

                  <div style={{ ...tenue, marginTop: "7px" }}>
                    {datos.historico.identidad.ultimoCambio.nota}
                  </div>
                </div>
              ) : (
                <Vacio
                  texto={
                    datos.historico?.identidad?.nota ||
                    "Todavía no hay dos fotos del inventario que comparar."
                  }
                />
              )}

              {/* SNAPSHOTS DE CUENTA. */}
              {datos.historico?.total ? (
                (datos.historico.snapshots || []).slice(0, 40).map((sn) => (
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

                      <span style={{ ...tenue, fontSize: "10px" }}>
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

          {/* =============== EVIDENCIAS =============== */}

          {seccion === "Evidencias" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={rejilla}>
                <Dato etiqueta="Piezas en el corpus" valor={datos.evidencias?.total} />
                <Dato
                  etiqueta="Lotes acumulados"
                  valor={datos.historico?.corpus?.lotes}
                  nota="Uno por investigación: no se sobrescriben."
                />
                <Dato
                  etiqueta="Recortadas por tope"
                  valor={datos.historico?.corpus?.truncadas}
                />
              </div>

              <div style={caja}>
                <div style={rotulo}>Procedencia temporal</div>
                <div style={parrafo}>
                  «Observada por Sentinel» es cuándo la vimos nosotros.
                  «Recuperada» significa que la pieza es anterior a nuestra
                  primera mirada: Sentinel no estaba observando cuando se
                  publicó.
                </div>
              </div>

              {(datos.historico?.corpus?.muestraDeProcedencia || []).map((p) => (
                <div key={p.url} style={caja}>
                  <div
                    style={{
                      display: "flex",
                      gap: "9px",
                      alignItems: "baseline",
                      flexWrap: "wrap"
                    }}
                  >
                    <FileText size={12} color="var(--sentinel-cyan)" />

                    <span
                      style={pill(
                        p.procedencia === "OBSERVADA_POR_SENTINEL"
                          ? "#22C55E"
                          : "#F59E0B"
                      )}
                    >
                      {p.procedencia}
                    </span>

                    <span style={{ ...tenue, flex: "1 1 220px", wordBreak: "break-all" }}>
                      {p.url}
                    </span>
                  </div>

                  <div style={{ ...tenue, marginTop: "6px" }}>
                    observada {fechaLocal(p.firstObservedBySentinel, proyecto)} ·
                    declarada por la fuente {p.fechaDeclaradaPorLaFuente || "sin fecha"}
                    {p.nota ? ` · ${p.nota}` : ""}
                  </div>
                </div>
              ))}

              {/*
                SNAPSHOTS DE METRICAS. Cada observacion se
                conserva: 100k ayer y 150k hoy son dos puntos.
              */}
              {(datos.publicaciones || []).map((p) => (
                <div key={p.publicationId} style={caja}>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "baseline",
                      flexWrap: "wrap"
                    }}
                  >
                    <strong style={{ color: "#FFFFFF", fontSize: "11.5px" }}>
                      {p.title || p.canonicalUrl}
                    </strong>

                    <VerEvidencia url={p.canonicalUrl} />
                  </div>

                  <div style={{ ...tenue, marginTop: "5px" }}>
                    publicada{" "}
                    {p.publishedAt ? fechaLocal(p.publishedAt, proyecto) : "sin fecha"}
                    {" · "}observada por 1.ª vez{" "}
                    {fechaLocal(p.firstObservedAt, proyecto)}
                    {p.observationCount > 1
                      ? ` · ${p.observationCount} observaciones`
                      : ""}
                  </div>

                  {(p.metricas || []).map((m, n) => (
                    <div
                      key={`${m.metrica}-${m.observedAt}-${n}`}
                      style={{
                        display: "flex",
                        gap: "8px",
                        alignItems: "baseline",
                        flexWrap: "wrap",
                        marginTop: "4px"
                      }}
                    >
                      <span style={tenue}>{m.nombre}</span>

                      <span
                        style={{
                          color:
                            m.value == null ? "var(--sentinel-texto-tenue)" : "#FFFFFF",
                          fontSize: "11px",
                          fontFamily: "monospace"
                        }}
                      >
                        {m.value == null ? "sin dato" : m.value}
                      </span>

                      <span style={tenue}>
                        {fechaLocal(m.observedAt, proyecto)} · {m.availability}
                        {m.motivo ? ` · ${m.motivo}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              ))}

              {(datos.evidencias?.muestra || []).length === 0 ? (
                <Vacio texto={datos.evidencias?.nota} />
              ) : (
                (datos.evidencias.muestra || []).map((e) => (
                  <div key={e.url || e.id} style={caja}>
                    <div style={{ color: "#FFFFFF", fontSize: "11.5px" }}>
                      {e.titulo || e.url}
                    </div>

                    <div style={{ ...tenue, marginTop: "5px", wordBreak: "break-all" }}>
                      {e.url}
                    </div>

                    <div style={{ ...tenue, marginTop: "5px" }}>
                      {e.fecha ? `fuente: ${e.fecha}` : "sin fecha de la fuente"} ·
                      observada {fechaLocal(e.observadaEn, proyecto)}
                      {e.vecesObservada > 1 ? ` · vista ${e.vecesObservada} veces` : ""}
                    </div>
                  </div>
                ))
              )}
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
            ? `Observación ejecutada · ${datos.traza.peticionesRealizadas} de ${datos.traza.topePeticiones} peticiones · ${datos.traza.snapshotsEscritos} snapshot(s) de cuenta · ${datos.traza.snapshotDeIdentidadEscrito ? "1" : "0"} snapshot de identidad`
            : "Estado leído sin salir a la red. Pulsa «Observar cuentas» para consultar las plataformas que lo permitan."}
        </div>
      </div>
    </div>
  );
}
