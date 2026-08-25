import {
  X,
  Sparkles,
  Tag,
  FileText,
  Radio,
  MapPin,
  Clock,
  ExternalLink,
  AlertTriangle,
  Users
} from "lucide-react";

/*
===========================================================
DETALLE DE TEMA
===========================================================

Responde la única pregunta que convierte un panel en
inteligencia:

    ¿POR QUE Sentinel dice que este tema existe?

Todo lo que hay aquí es rastreable hasta una evidencia. Si una
afirmación no se puede abrir, no debería estar.

CADA EVIDENCIA DECLARA COMO SE UBICO
-----------------------------------------------------------

No basta con decir «esta nota es de Sayausí». Hay que decir si
se supo por el texto, por la cobertura del medio o por un
metadato, porque las tres cosas no valen lo mismo y el
analista tiene que poder ponderarlas.
===========================================================
*/

const METODO_CORTO = {
  geometria_oficial: "geometría oficial",
  mencion_textual: "mención en el texto",
  metadato_fuente: "metadato de la fuente",
  cobertura_declarada_de_la_fuente: "cobertura del medio",
  asociacion_analitica_definida: "zona analítica",
  no_resoluble: "no resoluble"
};


function Seccion({ icono: Icono, titulo, children, nota }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "7px",
          color: "var(--sentinel-cyan)",
          fontSize: "9.5px",
          letterSpacing: "1.4px",
          textTransform: "uppercase",
          fontWeight: 600,
          marginBottom: "8px"
        }}
      >
        <Icono size={11} />
        {titulo}
      </div>

      {children}

      {nota && (
        <div
          style={{
            color: "var(--sentinel-texto-tenue)",
            fontSize: "10px",
            lineHeight: 1.6,
            marginTop: "6px"
          }}
        >
          {nota}
        </div>
      )}
    </div>
  );
}


export default function TopicDrawer({ tema, evidencias = [], onCerrar }) {
  if (!tema) return null;

  const propias = (tema.indices || [])
    .map((i) => evidencias[i])
    .filter(Boolean);

  const descubierto =
    tema.origen === "descubierto" || tema.origen === "descubierto_y_clasificado";

  return (
    <aside
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: "min(520px, 92vw)",
        background: "var(--sentinel-surface)",
        borderLeft: "1px solid var(--sentinel-borde-vivo)",
        boxShadow: "-18px 0 48px rgba(0,0,0,.45)",
        zIndex: 60,
        display: "flex",
        flexDirection: "column"
      }}
    >
      {/* cabecera */}
      <div
        style={{
          padding: "18px 20px",
          borderBottom: "1px solid var(--sentinel-borde)",
          display: "flex",
          alignItems: "flex-start",
          gap: "12px"
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              color: "#FFFFFF",
              fontSize: "16px",
              fontWeight: 700,
              lineHeight: 1.3
            }}
          >
            {tema.etiqueta}
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "7px",
              marginTop: "9px"
            }}
          >
            {descubierto && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  color: "var(--sentinel-cyan)",
                  fontSize: "9.5px",
                  fontWeight: 650,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  border: "1px solid var(--sentinel-cyan)",
                  borderRadius: "var(--radio-pill)",
                  padding: "2px 8px"
                }}
              >
                <Sparkles size={9} />
                Descubierto por Sentinel
              </span>
            )}

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                color: tema.categoria
                  ? "var(--sentinel-texto-suave)"
                  : "var(--sentinel-texto-tenue)",
                fontSize: "9.5px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                border: "1px solid var(--sentinel-borde)",
                borderRadius: "var(--radio-pill)",
                padding: "2px 8px"
              }}
            >
              <Tag size={9} />
              {tema.categoria || "Sin categoría en la taxonomía"}
            </span>
          </div>
        </div>

        <button
          onClick={onCerrar}
          className="sentinel-hover"
          aria-label="Cerrar"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--sentinel-texto-suave)",
            padding: "3px",
            flexShrink: 0
          }}
        >
          <X size={17} />
        </button>
      </div>

      {/* cuerpo */}
      <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
        {(tema.explicacionDescubrimiento || tema.explicacionClasificacion) && (
          <Seccion icono={Sparkles} titulo="Por qué existe este tema">
            {tema.explicacionDescubrimiento && (
              <div
                style={{
                  color: "var(--sentinel-texto-suave)",
                  fontSize: "11.5px",
                  lineHeight: 1.7,
                  marginBottom: tema.explicacionClasificacion ? "8px" : 0
                }}
              >
                {tema.explicacionDescubrimiento}
              </div>
            )}

            {tema.explicacionClasificacion && (
              <div
                style={{
                  color: "var(--sentinel-texto-tenue)",
                  fontSize: "11px",
                  lineHeight: 1.7
                }}
              >
                {tema.explicacionClasificacion}
              </div>
            )}
          </Seccion>
        )}

        <Seccion
          icono={FileText}
          titulo="Evidencia"
          nota="Los documentos observados no son personas. N evidencias no son N ciudadanos hablando."
        >
          <div style={{ display: "flex", gap: "26px" }}>
            <div>
              <div style={{ color: "#FFFFFF", fontSize: "22px", fontWeight: 700 }}>
                {tema.evidencias}
              </div>
              <div
                style={{ color: "var(--sentinel-texto-suave)", fontSize: "10.5px" }}
              >
                documentos
              </div>
            </div>

            <div>
              <div style={{ color: "#FFFFFF", fontSize: "22px", fontWeight: 700 }}>
                {tema.fuentesIndependientes}
              </div>
              <div
                style={{ color: "var(--sentinel-texto-suave)", fontSize: "10.5px" }}
              >
                fuentes independientes
              </div>
            </div>
          </div>
        </Seccion>

        {tema.subtemas?.length > 0 && (
          <Seccion icono={Tag} titulo="Subtemas">
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {tema.subtemas.map((s) => (
                <span
                  key={s.nombre}
                  style={{
                    color: "var(--sentinel-texto)",
                    fontSize: "11px",
                    background: "var(--sentinel-surface-alta)",
                    border: "1px solid var(--sentinel-borde)",
                    borderRadius: "var(--radio-pill)",
                    padding: "3px 10px"
                  }}
                >
                  {s.nombre} · {s.evidencias}
                </span>
              ))}
            </div>
          </Seccion>
        )}

        {tema.entidades?.length > 0 && (
          <Seccion
            icono={Users}
            titulo="Entidades detectadas"
            nota="Aparecer en una evidencia no atribuye postura a nadie."
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {tema.entidades.slice(0, 10).map((e) => (
                <span
                  key={e.nombre}
                  style={{
                    color: "var(--sentinel-texto-suave)",
                    fontSize: "11px",
                    border: "1px solid var(--sentinel-borde)",
                    borderRadius: "var(--radio-pill)",
                    padding: "3px 10px"
                  }}
                >
                  {e.nombre} · {e.documentos}
                </span>
              ))}
            </div>
          </Seccion>
        )}

        <Seccion
          icono={MapPin}
          titulo="Territorio"
          nota={
            tema.evidenciasSinUbicar
              ? `${tema.evidenciasSinUbicar} evidencia(s) del tema sin ubicar. No se reparten.`
              : null
          }
        >
          {tema.territorios?.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              {tema.territorios.map((t) => (
                <div
                  key={t.unidadId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "9px",
                    color: "var(--sentinel-texto)",
                    fontSize: "11.5px"
                  }}
                >
                  <span style={{ flex: 1 }}>{t.nombre}</span>

                  {!t.geometriaDisponible && (
                    <span
                      style={{
                        color: "var(--sentinel-texto-tenue)",
                        fontSize: "9.5px",
                        border: "1px solid var(--sentinel-borde)",
                        borderRadius: "var(--radio-pill)",
                        padding: "1px 7px"
                      }}
                    >
                      sin geometría
                    </span>
                  )}

                  <span
                    style={{
                      color: "var(--sentinel-texto-suave)",
                      fontWeight: 700,
                      fontVariantNumeric: "tabular-nums"
                    }}
                  >
                    {t.evidencias}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{ color: "var(--sentinel-texto-suave)", fontSize: "11.5px" }}
            >
              Ninguna evidencia del tema se pudo ubicar. No es que no tenga
              presencia territorial: es que no se supo dónde ponerla.
            </div>
          )}
        </Seccion>

        <Seccion icono={Radio} titulo="Fuentes observadas">
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {(tema.fuentes || []).map((f) => (
              <div
                key={f.dominio || f.nombre}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "9px",
                  color: "var(--sentinel-texto-suave)",
                  fontSize: "11px"
                }}
              >
                <span style={{ flex: 1 }}>{f.nombre}</span>

                <span
                  style={{
                    color: "var(--sentinel-texto-tenue)",
                    fontSize: "9.5px"
                  }}
                >
                  {f.tipo}
                </span>

                <span style={{ fontWeight: 700 }}>{f.evidencias}</span>
              </div>
            ))}
          </div>
        </Seccion>

        <Seccion icono={Clock} titulo="Tiempo">
          <div
            style={{
              color: "var(--sentinel-texto-suave)",
              fontSize: "11.5px",
              lineHeight: 1.7
            }}
          >
            Primera observación:{" "}
            <strong style={{ color: "var(--sentinel-texto)" }}>
              {tema.primeraObservacion
                ? String(tema.primeraObservacion).slice(0, 10)
                : "sin fecha"}
            </strong>
            <br />
            Última observación:{" "}
            <strong style={{ color: "var(--sentinel-texto)" }}>
              {tema.ultimaObservacion
                ? String(tema.ultimaObservacion).slice(0, 10)
                : "sin fecha"}
            </strong>
          </div>
        </Seccion>

        <Seccion icono={FileText} titulo={`Evidencias (${propias.length})`}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {propias.map((e, i) => (
              <div
                key={`${e.url || e.titulo}-${i}`}
                style={{
                  background: "var(--sentinel-surface-alta)",
                  border: "1px solid var(--sentinel-borde)",
                  borderRadius: "var(--radio-m)",
                  padding: "10px 12px"
                }}
              >
                <div
                  style={{
                    color: "var(--sentinel-texto)",
                    fontSize: "11.5px",
                    lineHeight: 1.5,
                    fontWeight: 600
                  }}
                >
                  {e.titulo || "(sin título)"}
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "10px",
                    marginTop: "6px",
                    color: "var(--sentinel-texto-tenue)",
                    fontSize: "10px"
                  }}
                >
                  <span>{e.medio?.nombre || "fuente desconocida"}</span>

                  <span>{e.fecha ? String(e.fecha).slice(0, 16) : "sin fecha"}</span>

                  {e.territorio && (
                    <span title={`Método: ${METODO_CORTO[e.metodoGeo] || "—"}`}>
                      {e.territorio.unidad}
                      {e.territorio.procedencia
                        ? ` · ${e.territorio.procedencia}`
                        : ""}
                    </span>
                  )}

                  {e.url && (
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        color: "var(--sentinel-cyan)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "3px",
                        textDecoration: "none"
                      }}
                    >
                      abrir <ExternalLink size={9} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Seccion>

        {tema.limitaciones?.length > 0 && (
          <Seccion icono={AlertTriangle} titulo="Limitaciones">
            <ul
              style={{
                margin: 0,
                paddingLeft: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "5px"
              }}
            >
              {tema.limitaciones.map((l, i) => (
                <li
                  key={i}
                  style={{
                    color: "var(--sentinel-texto-suave)",
                    fontSize: "11px",
                    lineHeight: 1.65
                  }}
                >
                  {l}
                </li>
              ))}
            </ul>
          </Seccion>
        )}
      </div>
    </aside>
  );
}
