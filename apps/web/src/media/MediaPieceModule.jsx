import { useCallback, useState } from "react";

import {
  Link2,
  Search,
  AlertTriangle,
  ExternalLink,
  Eye,
  ThumbsUp,
  MessageSquare,
  Share2,
  Users,
  MapPin,
  Tag,
  FileText,
  Ban,
  Clock,
  Network,
  ShieldAlert
} from "lucide-react";

const BACKEND = "http://localhost:3001";


/*
  La `canonicalUrl` del contrato de evidencia es un IDENTIFICADOR
  y viene sin esquema (`x.com/a/status/1`). Usarla como `href`
  la convertiria en una ruta relativa del propio frontend y el
  enlace llevaria a ninguna parte.

  `urlPublica` es la direccion navegable; esta es el respaldo.
*/
function enlace(...candidatos) {
  const v = candidatos.find((x) => x);

  if (!v) return null;

  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

/*
===========================================================
ANALIZAR PUBLICACION — MEDIA-PIECE-01 §16
===========================================================

Una pantalla: pegar URL, analizar, leer.

DECISIONES DE INTERFAZ QUE NO SON ESTETICAS
-----------------------------------------------------------

1. Una metrica ausente NO se pinta como 0 ni se oculta. Se
   pinta el motivo. Ocultarla haria creer que no existe; un 0
   afirmaria que se midio.

2. El bloque LIMITACIONES no es un pie de pagina plegable. Va
   antes de las conclusiones, porque condiciona como se leen.

3. Las tres cifras de amplificacion —piezas, fuentes,
   contenidos— se muestran juntas y con la frase que las
   explica. Separarlas invitaria a sumar lo que no se suma.

4. Cada cifra fuerte lleva su enlace a la evidencia. "Ver
   publicacion original" y "ver evidencia" son parte del
   contrato, no adornos.

5. El boton VER PLAN existe para poder mirar que se va a pedir
   antes de gastar cuota.
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
  fontSize: "0.72rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--sentinel-cyan)",
  marginBottom: "12px",
  fontWeight: 600
};

const ETIQUETA = {
  fontSize: "0.62rem",
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color: "var(--sentinel-texto-tenue)"
};


function Seccion({ icono: Icono, titulo, children, nota }) {
  return (
    <section style={{ ...CAJA, marginBottom: "14px" }}>
      <div style={TITULO}>
        {Icono ? <Icono size={14} /> : null}
        {titulo}
      </div>

      {nota ? (
        <p
          style={{
            margin: "0 0 12px",
            fontSize: "0.74rem",
            color: "var(--sentinel-texto-suave)",
            lineHeight: 1.5
          }}
        >
          {nota}
        </p>
      ) : null}

      {children}
    </section>
  );
}


/*
  MEDIA-PIECE-02: un campo puede llevar su PROCEDENCIA. No es
  decoracion: un titulo de `og:title` lo escribio el editor y uno
  de `snippet_de_buscador` lo escribio un buscador sobre la
  pieza. Quien decide tiene que poder distinguirlos.
*/
function Campo({ etiqueta, valor, mono = false, procedencia = null }) {
  return (
    <div style={{ minWidth: "140px", flex: "1 1 160px", marginBottom: "10px" }}>
      <div style={ETIQUETA}>{etiqueta}</div>

      <div
        style={{
          fontSize: mono ? "0.72rem" : "0.86rem",
          color: valor ? "var(--sentinel-texto)" : "var(--sentinel-texto-tenue)",
          fontFamily: mono ? "ui-monospace, monospace" : "inherit",
          wordBreak: "break-word",
          marginTop: "3px"
        }}
      >
        {valor || "no resuelto"}
      </div>

      {valor && procedencia ? (
        <div
          style={{
            fontSize: "0.58rem",
            color:
              procedencia === "snippet_de_buscador"
                ? "#eda100"
                : "var(--sentinel-texto-tenue)",
            marginTop: "2px",
            fontFamily: "ui-monospace, monospace",
            letterSpacing: "0.02em"
          }}
          title={
            procedencia === "snippet_de_buscador"
              ? "Proviene del snippet de un buscador, NO de la publicación original."
              : `Procedencia del dato: ${procedencia}`
          }
        >
          {procedencia}
        </div>
      ) : null}
    </div>
  );
}


/*
  LA PIEZA CLAVE DE LA UI.

  Una metrica tiene tres estados posibles y los tres se ven
  distintos: valor, ausencia con motivo, y oculta por la cuenta.
*/
function Metrica({ icono: Icono, nombre, m }) {
  const hayValor = m && m.value != null;

  return (
    <div
      style={{
        flex: "1 1 170px",
        minWidth: "160px",
        background: "var(--sentinel-surface-alta)",
        border: "1px solid var(--sentinel-borde)",
        borderRadius: "var(--radio-s)",
        padding: "12px 14px"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          ...ETIQUETA
        }}
      >
        <Icono size={12} />
        {nombre}
      </div>

      {hayValor ? (
        <div
          style={{
            fontSize: "1.45rem",
            fontWeight: 600,
            color: "var(--sentinel-texto)",
            marginTop: "6px",
            fontVariantNumeric: "tabular-nums"
          }}
        >
          {Number(m.value).toLocaleString("es-EC")}
        </div>
      ) : (
        <>
          <div
            style={{
              fontSize: "0.82rem",
              fontWeight: 600,
              color: "#eda100",
              marginTop: "6px",
              letterSpacing: "0.04em"
            }}
          >
            {m?.availability || "NO_DISPONIBLE"}
          </div>

          <div
            style={{
              fontSize: "0.66rem",
              color: "var(--sentinel-texto-tenue)",
              marginTop: "4px",
              lineHeight: 1.45
            }}
          >
            {m?.motivo || "sin motivo declarado"}
          </div>
        </>
      )}

      {m?.provider ? (
        <div
          style={{
            fontSize: "0.6rem",
            color: "var(--sentinel-texto-tenue)",
            marginTop: "6px",
            fontFamily: "ui-monospace, monospace"
          }}
        >
          {m.provider}
          {m.observedAt ? ` · ${m.observedAt.slice(0, 16).replace("T", " ")}` : ""}
        </div>
      ) : null}
    </div>
  );
}


function Pastilla({ texto, tono = "neutro" }) {
  const c =
    tono === "alerta"
      ? "#eda100"
      : tono === "ok"
        ? "var(--sentinel-live)"
        : tono === "mal"
          ? "#e5484d"
          : "var(--sentinel-cyan)";

  return (
    <span
      style={{
        display: "inline-block",
        border: `1px solid ${c}`,
        color: c,
        borderRadius: "var(--radio-pill)",
        padding: "2px 9px",
        fontSize: "0.62rem",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        marginRight: "6px",
        marginBottom: "6px"
      }}
    >
      {texto}
    </span>
  );
}


export default function MediaPieceModule() {
  const [url, setUrl] = useState("");
  const [projectId, setProjectId] = useState("");
  const [candidateId, setCandidateId] = useState("");

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [plan, setPlan] = useState(null);
  const [r, setR] = useState(null);

  const pedir = useCallback(
    async (ruta, cuerpo) => {
      const resp = await fetch(`${BACKEND}/api/media${ruta}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo)
      });

      const j = await resp.json();

      if (!resp.ok || j.ok === false) {
        throw new Error(j?.motivo || `HTTP ${resp.status}`);
      }

      return j;
    },
    []
  );

  const cuerpo = () => ({
    url: url.trim(),
    projectId: projectId.trim() || null,
    candidateId: candidateId.trim() || null
  });

  const verPlan = async () => {
    setError(null);
    setR(null);
    setCargando(true);

    try {
      setPlan(await pedir("/pieza/plan", cuerpo()));
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  const analizar = async () => {
    setError(null);
    setCargando(true);

    try {
      setR(await pedir("/pieza/analizar", cuerpo()));
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  const amp = r?.amplificacion;
  const met = r?.metricas || [];
  const buscar = (id) => met.find((m) => m.id === id);

  return (
    <div style={{ maxWidth: "1180px" }}>
      <header style={{ marginBottom: "18px" }}>
        <h2
          style={{
            margin: 0,
            fontSize: "1.05rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--sentinel-texto)"
          }}
        >
          Analizar publicación
        </h2>

        <p
          style={{
            margin: "6px 0 0",
            fontSize: "0.8rem",
            color: "var(--sentinel-texto-suave)"
          }}
        >
          Pega la URL de una noticia o publicación. Sentinel identifica la pieza,
          su emisor, lo que se puede medir y lo que no.
        </p>
      </header>

      {/* ---------------- ENTRADA ---------------- */}
      <div style={{ ...CAJA, marginBottom: "16px" }}>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ flex: "3 1 420px" }}>
            <div style={ETIQUETA}>URL de la publicación</div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "5px"
              }}
            >
              <Link2 size={15} color="var(--sentinel-cyan)" />

              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                style={{
                  flex: 1,
                  background: "var(--sentinel-bg)",
                  border: "1px solid var(--sentinel-borde-vivo)",
                  borderRadius: "var(--radio-s)",
                  color: "var(--sentinel-texto)",
                  padding: "9px 11px",
                  fontSize: "0.85rem",
                  fontFamily: "ui-monospace, monospace"
                }}
              />
            </div>
          </div>

          <div style={{ flex: "1 1 150px" }}>
            <div style={ETIQUETA}>projectId (opcional)</div>

            <input
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="proyecto"
              style={{
                width: "100%",
                marginTop: "5px",
                background: "var(--sentinel-bg)",
                border: "1px solid var(--sentinel-borde)",
                borderRadius: "var(--radio-s)",
                color: "var(--sentinel-texto)",
                padding: "9px 11px",
                fontSize: "0.8rem"
              }}
            />
          </div>

          <div style={{ flex: "1 1 150px" }}>
            <div style={ETIQUETA}>candidateId (opcional)</div>

            <input
              value={candidateId}
              onChange={(e) => setCandidateId(e.target.value)}
              placeholder="candidato"
              style={{
                width: "100%",
                marginTop: "5px",
                background: "var(--sentinel-bg)",
                border: "1px solid var(--sentinel-borde)",
                borderRadius: "var(--radio-s)",
                color: "var(--sentinel-texto)",
                padding: "9px 11px",
                fontSize: "0.8rem"
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
          <button
            onClick={analizar}
            disabled={cargando || !url.trim()}
            style={{
              background: "var(--sentinel-cyan)",
              color: "#04121c",
              border: "none",
              borderRadius: "var(--radio-s)",
              padding: "10px 22px",
              fontSize: "0.78rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: cargando || !url.trim() ? "not-allowed" : "pointer",
              opacity: cargando || !url.trim() ? 0.5 : 1
            }}
          >
            <Search size={13} style={{ marginRight: "6px", verticalAlign: "-2px" }} />
            {cargando ? "Analizando…" : "Analizar"}
          </button>

          <button
            onClick={verPlan}
            disabled={cargando || !url.trim()}
            title="Muestra qué peticiones se harían, sin ejecutarlas ni gastar cuota"
            style={{
              background: "transparent",
              color: "var(--sentinel-texto-suave)",
              border: "1px solid var(--sentinel-borde-vivo)",
              borderRadius: "var(--radio-s)",
              padding: "10px 18px",
              fontSize: "0.74rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer"
            }}
          >
            Ver plan
          </button>
        </div>
      </div>

      {error ? (
        <div
          style={{
            ...CAJA,
            marginBottom: "14px",
            borderColor: "#e5484d",
            color: "#e5484d",
            fontSize: "0.82rem"
          }}
        >
          <AlertTriangle size={14} style={{ verticalAlign: "-2px", marginRight: "6px" }} />
          {error}
        </div>
      ) : null}

      {/* ---------------- PLAN ---------------- */}
      {plan && !r ? (
        <Seccion
          icono={Search}
          titulo="Plan de peticiones — nada ejecutado"
          nota="Esto es lo que se pediría al analizar. Ninguna petición se ha lanzado y no se ha consumido cuota."
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
            <Campo etiqueta="Plataforma" valor={plan.pieza?.plataforma} />
            <Campo etiqueta="publicationId" valor={plan.pieza?.publicationId} mono />
            <Campo etiqueta="Emisor" valor={plan.emisor?.nombre} />
            <Campo etiqueta="Clase" valor={plan.emisor?.clase} />
          </div>

          <div style={{ ...ETIQUETA, marginTop: "8px" }}>Consultas web planeadas</div>

          <ul style={{ margin: "6px 0 0", paddingLeft: "18px" }}>
            {(plan.requestsPlaneados?.consultasWeb || []).map((c) => (
              <li
                key={c.id}
                style={{
                  fontSize: "0.76rem",
                  color: "var(--sentinel-texto-suave)",
                  marginBottom: "4px"
                }}
              >
                <code>{c.texto}</code> — {c.busca}
              </li>
            ))}
          </ul>

          <div style={{ ...ETIQUETA, marginTop: "10px" }}>
            Cuota estimada: {plan.cuotaEstimada?.youtube || 0} unidades YouTube ·{" "}
            {plan.cuotaEstimada?.consultasWeb || 0} consultas web
          </div>
        </Seccion>
      ) : null}

      {/* ---------------- RESULTADO ---------------- */}
      {r ? (
        <>
          {/* LIMITACIONES PRIMERO: condicionan como se lee lo demás */}
          {r.limitaciones?.length ? (
            <Seccion icono={ShieldAlert} titulo="Limitaciones de este análisis">
              <ul style={{ margin: 0, paddingLeft: "18px" }}>
                {r.limitaciones.map((l, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: "0.78rem",
                      color: "#eda100",
                      marginBottom: "5px",
                      lineHeight: 1.5
                    }}
                  >
                    {l}
                  </li>
                ))}
              </ul>
            </Seccion>
          ) : null}

          <Seccion icono={FileText} titulo="Publicación original">
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
              <Campo
                etiqueta="Título"
                valor={r.pieza?.titulo}
                procedencia={r.procedenciaCampos?.titulo}
              />
              <Campo
                etiqueta="Autor"
                valor={r.pieza?.autor}
                procedencia={r.procedenciaCampos?.autor}
              />
              <Campo
                etiqueta="Medio / cuenta"
                valor={r.emisor?.nombre}
                procedencia={r.emisor?.procedencia}
              />
              <Campo etiqueta="Clase del emisor" valor={r.emisor?.clase} />
              <Campo etiqueta="Plataforma" valor={r.pieza?.plataforma} />
              <Campo
                etiqueta="Fecha de publicación"
                valor={r.pieza?.publishedAt || null}
                mono
                procedencia={r.procedenciaCampos?.publishedAt}
              />
            </div>

            {/*
              MEDIA-PIECE-02: por qué un campo está vacío. Sin
              esto, el analista no puede distinguir «no lo hemos
              pedido» de «no se puede obtener».
            */}
            {r.camposPendientes?.length ? (
              <div
                style={{
                  marginTop: "10px",
                  borderTop: "1px solid var(--sentinel-borde)",
                  paddingTop: "10px"
                }}
              >
                <div style={ETIQUETA}>Campos sin resolver y por qué</div>

                {r.camposPendientes.map((c) => (
                  <div
                    key={c.campo}
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--sentinel-texto-tenue)",
                      marginTop: "6px",
                      lineHeight: 1.5
                    }}
                  >
                    <strong style={{ color: "var(--sentinel-texto-suave)" }}>
                      {c.campo}
                    </strong>{" "}
                    <Pastilla
                      texto={c.estado}
                      tono={
                        c.estado === "REQUIERE_AUTORIZACION"
                          ? "alerta"
                          : c.estado === "NO_DISPONIBLE"
                            ? "mal"
                            : "neutro"
                      }
                    />
                    <div>{c.motivo}</div>
                    <div style={{ color: "#eda100" }}>{c.accionable}</div>
                  </div>
                ))}
              </div>
            ) : null}

            <div style={{ marginTop: "6px" }}>
              <a
                href={enlace(r.pieza?.urlPublica, r.pieza?.url, r.pieza?.canonicalUrl)}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: "var(--sentinel-cyan)",
                  fontSize: "0.76rem",
                  textDecoration: "none"
                }}
              >
                <ExternalLink size={12} style={{ verticalAlign: "-2px" }} /> Ver
                publicación original
              </a>
            </div>

            {r.emisor?.razones?.length ? (
              <div
                style={{
                  marginTop: "10px",
                  fontSize: "0.7rem",
                  color: "var(--sentinel-texto-tenue)",
                  lineHeight: 1.5
                }}
              >
                <strong style={{ color: "var(--sentinel-texto-suave)" }}>
                  Por qué se clasificó así:{" "}
                </strong>
                {r.emisor.razones.join(" ")}
              </div>
            ) : null}

            {r.emisor?.advertencia ? (
              <div
                style={{
                  marginTop: "6px",
                  fontSize: "0.7rem",
                  color: "#eda100",
                  lineHeight: 1.5
                }}
              >
                {r.emisor.advertencia}
              </div>
            ) : null}
          </Seccion>

          <Seccion
            icono={Eye}
            titulo="Métricas observadas"
            nota={r.disponibilidadMetricas?.declaracion}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              <Metrica icono={Eye} nombre="Views" m={buscar("views")} />
              <Metrica icono={ThumbsUp} nombre="Likes" m={buscar("likes")} />
              <Metrica icono={MessageSquare} nombre="Comentarios" m={buscar("comments")} />
              <Metrica icono={Share2} nombre="Shares / reposts" m={buscar("shares")} />
            </div>

            <div
              style={{
                marginTop: "12px",
                fontSize: "0.7rem",
                color: "var(--sentinel-texto-tenue)",
                lineHeight: 1.55
              }}
            >
              {(r.impactoObservado?.equivalenciasProhibidas || []).map((e, i) => (
                <div key={i}>· {e}</div>
              ))}
            </div>
          </Seccion>

          <Seccion icono={Users} titulo="Candidato relacionado">
            {r.candidato?.vinculado ? (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
                  <Campo etiqueta="Candidato" valor={r.candidato.candidato?.nombre} />
                  <Campo
                    etiqueta="candidateId"
                    valor={r.candidato.candidato?.candidateId}
                    mono
                  />
                  <Campo
                    etiqueta="Variante encontrada"
                    valor={r.candidato.menciona?.varianteEncontrada}
                  />
                  <Campo
                    etiqueta="Piezas que lo nombran"
                    valor={String(r.candidato.menciona?.totalPiezasQueLoNombran ?? 0)}
                  />
                </div>

                {r.candidato.plano ? (
                  <Pastilla texto={r.candidato.plano.plano} tono="ok" />
                ) : null}

                <p
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--sentinel-texto-tenue)",
                    lineHeight: 1.55,
                    marginTop: "8px"
                  }}
                >
                  {r.candidato.advertencia}
                </p>
              </>
            ) : (
              <p
                style={{
                  margin: 0,
                  fontSize: "0.8rem",
                  color: "var(--sentinel-texto-tenue)"
                }}
              >
                {r.candidato?.motivo || "La pieza no menciona al candidato indicado."}
              </p>
            )}
          </Seccion>

          <Seccion icono={Network} titulo="Amplificación">
            {amp ? (
              <>
                <div
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "var(--sentinel-cyan)",
                    letterSpacing: "0.06em",
                    marginBottom: "8px"
                  }}
                >
                  {amp.conteo?.lectura}
                </div>

                <p
                  style={{
                    fontSize: "0.72rem",
                    color: "#eda100",
                    lineHeight: 1.55,
                    margin: "0 0 12px"
                  }}
                >
                  {amp.conteo?.advertencia}
                </p>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
                  <Campo etiqueta="Medios" valor={String(amp.medios ?? 0)} />
                  <Campo etiqueta="Creadores" valor={String(amp.creadores ?? 0)} />
                  <Campo etiqueta="Periodistas" valor={String(amp.periodistas ?? 0)} />
                </div>

                <div style={{ marginTop: "4px", marginBottom: "10px" }}>
                  {Object.entries(amp.porRol || {}).map(([rol, n]) => (
                    <Pastilla
                      key={rol}
                      texto={`${rol}: ${n}`}
                      tono={rol === "COBERTURA_RELACIONADA" ? "alerta" : "neutro"}
                    />
                  ))}
                </div>

                {(amp.nodos || []).slice(0, 12).map((n) => (
                  <div
                    key={n.pieceId}
                    style={{
                      borderTop: "1px solid var(--sentinel-borde)",
                      padding: "9px 0"
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "10px",
                        flexWrap: "wrap"
                      }}
                    >
                      <a
                        href={enlace(n.url, n.canonicalUrl)}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          color: "var(--sentinel-texto)",
                          fontSize: "0.79rem",
                          textDecoration: "none",
                          flex: "1 1 380px"
                        }}
                      >
                        {n.titulo || n.canonicalUrl}
                      </a>

                      <Pastilla texto={n.rol} />
                    </div>

                    <div
                      style={{
                        fontSize: "0.66rem",
                        color: "var(--sentinel-texto-tenue)",
                        marginTop: "3px"
                      }}
                    >
                      {n.dominio} · {n.emisor?.clase}
                      {n.publishedAt ? ` · ${n.publishedAt.slice(0, 10)}` : ""}
                      {n.similitudTitular != null
                        ? ` · similitud ${(n.similitudTitular * 100).toFixed(0)} %`
                        : ""}
                    </div>

                    <div
                      style={{
                        fontSize: "0.66rem",
                        color: "var(--sentinel-texto-tenue)",
                        marginTop: "3px",
                        lineHeight: 1.45
                      }}
                    >
                      {(n.rolRazones || []).join(" ")}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <p
                style={{
                  margin: 0,
                  fontSize: "0.8rem",
                  color: "var(--sentinel-texto-tenue)"
                }}
              >
                No se ejecutó búsqueda de amplificación.
              </p>
            )}
          </Seccion>

          <Seccion icono={Tag} titulo="Temas">
            {r.temas?.temas?.length ? (
              r.temas.temas.map((t) => (
                <div
                  key={t.topicId}
                  style={{
                    borderTop: "1px solid var(--sentinel-borde)",
                    padding: "9px 0"
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.86rem",
                      color: "var(--sentinel-texto)",
                      fontWeight: 600
                    }}
                  >
                    {t.nombre}
                  </div>

                  <div style={{ ...ETIQUETA, marginTop: "3px" }}>
                    {t.piezas} piezas · {t.fuentes ?? "?"} fuentes
                    {t.primeraFecha ? ` · desde ${t.primeraFecha.slice(0, 10)}` : ""}
                  </div>

                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--sentinel-texto-tenue)",
                      marginTop: "4px",
                      lineHeight: 1.5
                    }}
                  >
                    {t.explicacion}
                  </div>
                </div>
              ))
            ) : (
              <p
                style={{
                  margin: 0,
                  fontSize: "0.8rem",
                  color: "var(--sentinel-texto-tenue)"
                }}
              >
                {r.temas?.limitaciones?.[0] || "Sin temas calculados."}
              </p>
            )}

            {r.temas?.entidades?.length ? (
              <div style={{ marginTop: "10px" }}>
                <div style={ETIQUETA}>Entidades detectadas (no son temas)</div>

                <div style={{ marginTop: "6px" }}>
                  {r.temas.entidades.slice(0, 12).map((e) => (
                    <Pastilla key={e.entidad} texto={`${e.entidad} (${e.piezas})`} />
                  ))}
                </div>
              </div>
            ) : null}
          </Seccion>

          <Seccion
            icono={MessageSquare}
            titulo="Conversación observable"
            nota={r.conversacion?.declaracion}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
              <Campo
                etiqueta="Comentarios observables"
                valor={
                  r.conversacion?.comentariosObservables != null
                    ? String(r.conversacion.comentariosObservables)
                    : null
                }
              />
              <Campo
                etiqueta="Citas"
                valor={String(r.conversacion?.detalle?.citas ?? 0)}
              />
              <Campo
                etiqueta="Réplicas"
                valor={String(r.conversacion?.detalle?.replicas ?? 0)}
              />
              <Campo
                etiqueta="Cobertura relacionada"
                valor={String(r.conversacion?.detalle?.coberturaRelacionada ?? 0)}
              />
            </div>

            <p
              style={{
                fontSize: "0.7rem",
                color: "var(--sentinel-texto-tenue)",
                lineHeight: 1.55,
                margin: "4px 0 0"
              }}
            >
              {r.conversacion?.motivoSinTexto} {r.conversacion?.noRepresenta}
            </p>
          </Seccion>

          <Seccion icono={MapPin} titulo="Territorio">
            {/*
              El ambito no se pide al usuario: lo declara el
              proyecto. Se muestra su NOMBRE, nunca el id tecnico.
            */}
            {r.ambito?.nombre ? (
              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: "0.72rem",
                  color: "var(--sentinel-texto-tenue)",
                  lineHeight: 1.5
                }}
              >
                Ámbito del proyecto: <strong style={{ color: "var(--sentinel-texto-suave)" }}>{r.ambito.nombre}</strong>
                {r.ambito.procedencia === "declarado_en_el_proyecto"
                  ? " — declarado en el proyecto, no inferido."
                  : ""}
              </p>
            ) : null}

            <div style={{ marginBottom: "8px" }}>
              <Pastilla
                texto={r.territorio?.rotulo || "SIN DATO"}
                tono={r.territorio?.tieneEvidenciaTerritorial ? "ok" : "alerta"}
              />
            </div>

            {r.territorio?.tieneEvidenciaTerritorial ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
                <Campo etiqueta="Unidad" valor={r.territorio.unidad} />
                <Campo etiqueta="Resolución" valor={r.territorio.resolucion} />
                <Campo etiqueta="Procedencia" valor={r.territorio.procedencia} />
              </div>
            ) : (
              <p
                style={{
                  margin: 0,
                  fontSize: "0.8rem",
                  color: "var(--sentinel-texto-tenue)"
                }}
              >
                {r.territorio?.motivo}
              </p>
            )}

            <div
              style={{
                marginTop: "10px",
                fontSize: "0.68rem",
                color: "var(--sentinel-texto-tenue)",
                lineHeight: 1.55
              }}
            >
              {(r.territorio?.noAfirma || []).map((n, i) => (
                <div key={i}>
                  <Ban size={10} style={{ verticalAlign: "-1px", marginRight: "4px" }} />
                  {n}
                </div>
              ))}
            </div>
          </Seccion>

          <Seccion icono={Clock} titulo="Persistencia e histórico">
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
              <Campo
                etiqueta="Estado del histórico"
                valor={r.serie?.estado}
              />
              <Campo
                etiqueta="Observaciones"
                valor={String(r.serie?.observaciones ?? 0)}
              />
              <Campo
                etiqueta="Horas desde publicación"
                valor={
                  r.persistencia?.horasDesdePublicacion != null
                    ? String(r.persistencia.horasDesdePublicacion)
                    : null
                }
              />
            </div>

            <p
              style={{
                margin: "4px 0 0",
                fontSize: "0.74rem",
                color: "var(--sentinel-texto-suave)",
                lineHeight: 1.5
              }}
            >
              {r.serie?.declaracion}
            </p>

            <p
              style={{
                margin: "8px 0 0",
                fontSize: "0.7rem",
                color: "var(--sentinel-texto-tenue)"
              }}
            >
              Rendimiento: <strong>{r.impactoObservado?.rendimiento?.nivel}</strong>
              {r.impactoObservado?.rendimiento?.motivo
                ? ` — ${r.impactoObservado.rendimiento.motivo}`
                : ""}
            </p>
          </Seccion>

          <Seccion
            icono={FileText}
            titulo={`Evidencias (${r.evidencias?.length || 0})`}
            nota="Toda cifra de este análisis proviene de una de estas evidencias."
          >
            {(r.evidencias || []).map((e) => (
              <div
                key={e.evidenceId}
                style={{
                  borderTop: "1px solid var(--sentinel-borde)",
                  padding: "7px 0",
                  fontSize: "0.72rem"
                }}
              >
                <code
                  style={{
                    color: "var(--sentinel-cyan)",
                    fontSize: "0.68rem"
                  }}
                >
                  {e.evidenceId}
                </code>

                <span style={{ color: "var(--sentinel-texto-tenue)" }}>
                  {" "}
                  · {e.tipo} · {e.provider || "sin proveedor"} ·{" "}
                  {e.observedAt?.slice(0, 16).replace("T", " ")}
                </span>

                {e.canonicalUrl ? (
                  <>
                    {" "}
                    <a
                      href={enlace(e.canonicalUrl)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--sentinel-cyan)" }}
                    >
                      ver evidencia
                    </a>
                  </>
                ) : null}
              </div>
            ))}
          </Seccion>

          <div
            style={{
              ...CAJA,
              fontSize: "0.7rem",
              color: "var(--sentinel-texto-tenue)",
              lineHeight: 1.6
            }}
          >
            <strong style={{ color: "var(--sentinel-texto-suave)" }}>Cuota:</strong>{" "}
            YouTube {r.cuota?.youtube?.unidadesConsumidas ?? 0} unidades ·{" "}
            {r.cuota?.web?.consultas ?? 0} consultas web{" "}
            {r.cuota?.web?.proveedores?.length
              ? `(${r.cuota.web.proveedores.join(", ")})`
              : ""}{" "}
            · {r.tiempo} ·{" "}
            {r.persistencia_lake?.persistido
              ? "guardado en el Knowledge Lake"
              : `sin persistir: ${r.persistencia_lake?.motivo || "—"}`}
            <br />
            {r.impactoObservado?.sinScore}
          </div>
        </>
      ) : null}
    </div>
  );
}
