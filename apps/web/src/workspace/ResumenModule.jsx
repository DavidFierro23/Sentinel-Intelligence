import { useCallback, useEffect, useState } from "react";

import {
  Activity,
  Users,
  MapPin,
  Newspaper,
  ShieldCheck,
  AlertTriangle,
  ArrowRight
} from "lucide-react";

import EstadoChip from "./EstadoChip";

import { textoDeEstado } from "./estados";

const BACKEND = "http://localhost:3001";

/*
===========================================================
SENTINEL-UX-CONSOLIDATION-01 — RESUMEN DEL PROYECTO
===========================================================

El nuevo punto de entrada. Responde «¿QUE ESTA PASANDO?» con lo
que Sentinel sabe HOY, y dice con la misma claridad lo que
todavia no sabe.

LA REGLA QUE GOBIERNA ESTA PANTALLA
-----------------------------------------------------------

Cada cifra sale de un endpoint real o no sale. No hay ningun
numero calculado aqui, ningun porcentaje de avance y ningun
score compuesto: esta pantalla AGREGA VISTAS, no crea metricas.

Es la tentacion obvia de un resumen ejecutivo —cuatro numerones
grandes y una flecha verde— y es exactamente lo que haria
inutil el producto. Un +0 % inventado en la primera pantalla
contamina todo lo que el analista lea despues.

DE DONDE SALE CADA BLOQUE
-----------------------------------------------------------

    MEDIOS      GET /api/media/:proyecto/home        real
    CANDIDATOS  GET /api/proyectos/:proyecto         real
    TERRITORIO  GET /api/territorio/salud            real
    CAMBIOS     no hay endpoint de series             se declara

CAMBIOS / SEÑALES no tiene fuente todavia. No se rellena con la
diferencia entre dos ventanas —eso seria una serie de dos puntos
presentada como tendencia— y se declara HISTORICO INSUFICIENTE.
===========================================================
*/

const CAJA = {
  background: "var(--sentinel-surface)",
  border: "1px solid var(--sentinel-borde)",
  borderRadius: "var(--radio-m)",
  padding: "16px 18px"
};

const TITULO = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "0.68rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--sentinel-cyan)",
  fontWeight: 600
};

const ETIQUETA = {
  fontSize: "0.58rem",
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color: "var(--sentinel-texto-tenue)"
};


/*
  Una cifra del resumen. Si no hay valor pinta el estado, nunca
  un cero: es la misma regla que Media ya aplica, unificada.
*/
function Cifra({ etiqueta, valor, estado, nota, onIr }) {
  const ausente = valor === null || valor === undefined;

  return (
    <div
      style={{
        background: "var(--sentinel-surface-alta)",
        border: "1px solid var(--sentinel-borde)",
        borderRadius: "var(--radio-s, 8px)",
        padding: "11px 13px",
        minWidth: "150px",
        flex: "1 1 150px",
        cursor: onIr ? "pointer" : "default"
      }}
      onClick={onIr || undefined}
    >
      <div style={ETIQUETA}>{etiqueta}</div>

      {ausente ? (
        <div style={{ marginTop: "6px" }}>
          <EstadoChip estado={estado || "SIN_DATOS"} compacto />
        </div>
      ) : (
        <div
          style={{
            marginTop: "4px",
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "var(--sentinel-texto)",
            lineHeight: 1.1
          }}
        >
          {valor}
        </div>
      )}

      {nota ? (
        <div
          style={{
            marginTop: "5px",
            fontSize: "0.62rem",
            color: "var(--sentinel-texto-tenue)",
            lineHeight: 1.45
          }}
        >
          {nota}
        </div>
      ) : null}
    </div>
  );
}


function Bloque({ icono: Icono, titulo, estado, children, onIr, etiquetaIr }) {
  return (
    <section style={{ ...CAJA, marginBottom: "14px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "12px",
          flexWrap: "wrap"
        }}
      >
        <div style={TITULO}>
          {Icono ? <Icono size={14} /> : null}
          {titulo}
        </div>

        {estado ? <EstadoChip estado={estado} compacto /> : null}

        {onIr ? (
          <button
            onClick={onIr}
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "3px 10px",
              borderRadius: "var(--radio-pill)",
              border: "1px solid var(--sentinel-borde-vivo)",
              background: "transparent",
              color: "var(--sentinel-cyan)",
              fontSize: "0.66rem",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            {etiquetaIr || "Abrir"} <ArrowRight size={11} />
          </button>
        ) : null}
      </div>

      {children}
    </section>
  );
}


export default function ResumenModule({ projectId, proyecto, ventana = "7d", onIrA }) {
  const [media, setMedia] = useState(null);
  const [contenido, setContenido] = useState(null);
  const [territorio, setTerritorio] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    if (!projectId) return;

    setCargando(true);
    setError(null);

    /*
      Las tres lecturas son independientes: si una falla, las
      otras dos siguen mostrandose. Un resumen que se cae entero
      porque un modulo no responde es peor que un resumen
      incompleto y declarado.
    */
    const pedir = async (url) => {
      try {
        const r = await fetch(url);

        const j = await r.json();

        return r.ok && j?.ok !== false ? j : null;
      } catch {
        return null;
      }
    };

    const [m, c, t] = await Promise.all([
      pedir(
        `${BACKEND}/api/media/${encodeURIComponent(projectId)}/home?ventana=${encodeURIComponent(ventana)}`
      ),
      pedir(`${BACKEND}/api/proyectos/${encodeURIComponent(projectId)}`),
      pedir(`${BACKEND}/api/territorio/salud`)
    ]);

    setMedia(m);
    setContenido(c);
    setTerritorio(t);

    if (!m && !c && !t) setError("Ningún módulo respondió. ¿Está el backend arriba?");

    setCargando(false);
  }, [projectId, ventana]);

  useEffect(() => {
    const id = setTimeout(cargar, 0);

    return () => clearTimeout(id);
  }, [cargar]);

  if (!projectId) return null;

  const candidatos = contenido?.candidatos || [];

  const resumenMedia = media?.resumen || null;

  const ranking = media?.presencia?.ranking || [];

  return (
    <div className="sentinel-fade" style={{ maxWidth: "1280px" }}>
      <header style={{ marginBottom: "16px" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "1.18rem",
            letterSpacing: "0.01em",
            color: "var(--sentinel-texto)"
          }}
        >
          ¿Qué está pasando?
        </h1>

        <p
          style={{
            margin: "6px 0 0",
            fontSize: "0.76rem",
            color: "var(--sentinel-texto-suave)",
            maxWidth: "820px",
            lineHeight: 1.55
          }}
        >
          Estado observable de{" "}
          <strong style={{ color: "var(--sentinel-texto)" }}>{proyecto?.nombre}</strong> con
          los datos que Sentinel tiene hoy. Cada cifra procede de un módulo real; lo que
          todavía no se puede medir se declara y no se rellena.
        </p>
      </header>

      {error ? (
        <div
          style={{
            ...CAJA,
            marginBottom: "14px",
            borderColor: "#ff808055",
            color: "#ff8080",
            fontSize: "0.78rem"
          }}
        >
          {error}
        </div>
      ) : null}

      {cargando && !media && !contenido ? (
        <p style={{ fontSize: "0.8rem", color: "var(--sentinel-texto-tenue)" }}>
          Leyendo el estado del proyecto…
        </p>
      ) : null}

      {/*
        ---------------------------------------------------------
        A · CAMBIOS / SEÑALES

        Sin fuente de series todavia. Se declara en lugar de
        calcular una diferencia entre dos ventanas y llamarla
        tendencia.
        ---------------------------------------------------------
      */}
      <Bloque icono={Activity} titulo="Cambios y señales" estado="HISTORICO_INSUFICIENTE">
        <p
          style={{
            margin: 0,
            fontSize: "0.78rem",
            color: "var(--sentinel-texto-suave)",
            lineHeight: 1.6,
            maxWidth: "820px"
          }}
        >
          Histórico insuficiente para calcular cambio. Sentinel acumula observaciones desde
          la primera ejecución guardada y no reconstruye lo que no observó, así que todavía
          no hay dos ventanas completas que comparar.
        </p>

        <p
          style={{
            margin: "8px 0 0",
            fontSize: "0.7rem",
            color: "var(--sentinel-texto-tenue)",
            lineHeight: 1.55
          }}
        >
          No se muestra ningún porcentaje: una diferencia entre dos puntos no es una
          tendencia, y presentarla como tal es el error que hace inservible un panel de
          campaña.
        </p>
      </Bloque>

      {/*
        ---------------------------------------------------------
        B · CANDIDATOS
        ---------------------------------------------------------
      */}
      <Bloque
        icono={Users}
        titulo="Candidatos"
        onIr={onIrA ? () => onIrA("candidatos") : null}
        etiquetaIr="Abrir Candidatos"
      >
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Cifra
            etiqueta="Candidatos en el proyecto"
            valor={candidatos.length || null}
            estado="SIN_DATOS"
          />

          <Cifra
            etiqueta="Presencia digital observable"
            valor={null}
            estado="PARCIAL"
            nota="Se calcula por candidato en su expediente. No hay índice compuesto."
          />

          <Cifra
            etiqueta="Momentum"
            valor={null}
            estado="HISTORICO_INSUFICIENTE"
            nota="Exige dos ventanas comparables. No se sustituye por un score."
          />
        </div>

        {candidatos.length ? (
          <div style={{ marginTop: "14px" }}>
            <div style={ETIQUETA}>En este proyecto</div>

            <div
              style={{
                display: "flex",
                gap: "6px",
                flexWrap: "wrap",
                marginTop: "8px"
              }}
            >
              {candidatos.map((c) => (
                <span
                  key={c.candidateId || c.id}
                  style={{
                    padding: "3px 9px",
                    borderRadius: "var(--radio-pill)",
                    border: "1px solid var(--sentinel-borde-vivo)",
                    color: "var(--sentinel-texto-suave)",
                    fontSize: "0.7rem"
                  }}
                >
                  {c.nombre}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <p
          style={{
            margin: "14px 0 0",
            fontSize: "0.68rem",
            color: "var(--sentinel-texto-tenue)",
            lineHeight: 1.55,
            borderTop: "1px solid var(--sentinel-borde)",
            paddingTop: "10px"
          }}
        >
          Inteligencia digital observable. No representa intención de voto, aprobación ni
          predicción electoral.
        </p>
      </Bloque>

      {/*
        ---------------------------------------------------------
        C · TERRITORIO
        ---------------------------------------------------------
      */}
      <Bloque
        icono={MapPin}
        titulo="Territorio"
        estado={territorio ? null : "SIN_DATOS"}
        onIr={onIrA ? () => onIrA("mapa") : null}
        etiquetaIr="Abrir Territorio"
      >
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Cifra
            etiqueta="Unidades del registro"
            valor={territorio?.unidades ?? territorio?.registro?.unidades ?? null}
            estado="SIN_DATOS"
            nota="Registro territorial oficial cargado."
          />

          <Cifra
            etiqueta="Resolución territorial social"
            valor={null}
            estado="EN_CALIBRACION"
            nota="La desambiguación de topónimos en redes está en calibración."
          />
        </div>

        <p
          style={{
            margin: "14px 0 0",
            fontSize: "0.72rem",
            color: "var(--sentinel-texto-suave)",
            lineHeight: 1.6,
            maxWidth: "820px"
          }}
        >
          Mientras la resolución social esté en calibración, Sentinel no afirma que un
          corpus ambiguo sea «la conversación de Cuenca». La huella territorial se declara
          por evidencia, con su unidad y su confianza, o no se afirma.
        </p>
      </Bloque>

      {/*
        ---------------------------------------------------------
        D · MEDIOS — el bloque con datos reales
        ---------------------------------------------------------
      */}
      <Bloque
        icono={Newspaper}
        titulo="Medios"
        estado={media ? "OPERATIVO_CON_LIMITACIONES" : "SIN_DATOS"}
        onIr={onIrA ? () => onIrA("media_pieza") : null}
        etiquetaIr="Abrir Medios"
      >
        {resumenMedia ? (
          <>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <Cifra
                etiqueta="Piezas en el corpus"
                valor={resumenMedia.piezasEnCorpus?.valor ?? null}
                estado="SIN_DATOS"
              />

              <Cifra
                etiqueta={`Piezas en ventana`}
                valor={resumenMedia.piezasObservadas?.valor ?? null}
                estado={resumenMedia.piezasObservadas?.estado || "COBERTURA_INSUFICIENTE"}
                nota={
                  media.ventana
                    ? `${media.ventana.sinFechaUtilizable} sin fecha utilizable`
                    : null
                }
              />

              <Cifra
                etiqueta="Fuentes distintas"
                valor={resumenMedia.fuentesDistintas?.valor ?? null}
                estado="SIN_DATOS"
              />

              <Cifra
                etiqueta="Medios identificados"
                valor={resumenMedia.medios?.valor ?? null}
                estado="SIN_DATOS"
              />

              <Cifra
                etiqueta="Candidatos relacionados"
                valor={resumenMedia.candidatosRelacionados?.valor ?? null}
                estado="SIN_DATOS"
              />
            </div>

            {ranking.length ? (
              <div style={{ marginTop: "16px" }}>
                <div style={ETIQUETA}>
                  {media.presencia?.titulo || "Presencia mediática observable"} ·{" "}
                  {media.presencia?.subtitulo || ventana}
                </div>

                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    marginTop: "8px"
                  }}
                >
                  <tbody>
                    {ranking.slice(0, 5).map((f) => (
                      <tr key={f.dominio}>
                        <td
                          style={{
                            padding: "5px 8px 5px 0",
                            fontSize: "0.72rem",
                            color: "var(--sentinel-texto-tenue)",
                            width: "26px"
                          }}
                        >
                          {f.rank}
                        </td>

                        <td
                          style={{
                            padding: "5px 8px",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            color: "var(--sentinel-texto)"
                          }}
                        >
                          {f.nombre}
                        </td>

                        <td style={{ padding: "5px 8px", fontSize: "0.74rem" }}>
                          {f.piezasObservadas?.valor === null ? (
                            <EstadoChip
                              estado={f.piezasObservadas.estado}
                              titulo={f.piezasObservadas.motivo}
                              compacto
                            />
                          ) : (
                            <span style={{ fontWeight: 650 }}>
                              {f.piezasObservadas?.valor} piezas
                            </span>
                          )}
                        </td>

                        <td
                          style={{
                            padding: "5px 0 5px 8px",
                            fontSize: "0.68rem",
                            color: "var(--sentinel-texto-tenue)",
                            textAlign: "right"
                          }}
                        >
                          {f.piezasEnCorpus?.valor} en corpus
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <p
                  style={{
                    margin: "10px 0 0",
                    fontSize: "0.66rem",
                    color: "var(--sentinel-texto-tenue)",
                    lineHeight: 1.5
                  }}
                >
                  Recuento sobre el corpus observado. No mide audiencia, alcance ni
                  influencia.
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <EstadoChip estado="SIN_DATOS" />
        )}
      </Bloque>

      {/*
        ---------------------------------------------------------
        E · EVIDENCIAS
        ---------------------------------------------------------
      */}
      <Bloque icono={ShieldCheck} titulo="Evidencias y procedencia">
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Cifra
            etiqueta="Evidencias alcanzables"
            valor={resumenMedia?.evidenciasDisponibles?.valor ?? null}
            estado="SIN_DATOS"
            nota="Identificadores distintos accesibles desde Medios."
          />

          {media?.cobertura?.reconciliacion ? (
            <>
              <Cifra
                etiqueta="Piezas canónicas"
                valor={media.cobertura.reconciliacion.canonicas}
                nota="Tras reconciliar las rutas de observación."
              />

              <Cifra
                etiqueta="Excluidas del corpus"
                valor={media.cobertura.reconciliacion.excluidas}
                nota="Artefactos, plataformas y feeds de comentarios."
              />
            </>
          ) : null}
        </div>

        {media?.cobertura?.loQueNoSabemos?.length ? (
          <div style={{ marginTop: "14px" }}>
            <div style={{ ...ETIQUETA, color: "#eda100" }}>
              <AlertTriangle size={11} style={{ verticalAlign: "-1px" }} /> Lo que no
              sabemos
            </div>

            <ul
              style={{
                margin: "8px 0 0",
                paddingLeft: "17px",
                fontSize: "0.7rem",
                color: "var(--sentinel-texto-tenue)",
                lineHeight: 1.65
              }}
            >
              {media.cobertura.loQueNoSabemos.slice(0, 4).map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <p
          style={{
            margin: "14px 0 0",
            fontSize: "0.68rem",
            color: "var(--sentinel-texto-tenue)",
            lineHeight: 1.55,
            borderTop: "1px solid var(--sentinel-borde)",
            paddingTop: "10px"
          }}
        >
          Este resumen no calcula ninguna métrica propia: agrega lo que cada módulo ya
          mide, con su estado. Si una cifra no está aquí es porque todavía no existe, no
          porque valga cero — y el estado lo dice:{" "}
          <em>{textoDeEstado("HISTORICO_INSUFICIENTE")}</em>,{" "}
          <em>{textoDeEstado("EN_CALIBRACION")}</em>,{" "}
          <em>{textoDeEstado("COBERTURA_INSUFICIENTE")}</em>.
        </p>
      </Bloque>
    </div>
  );
}
