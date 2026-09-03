import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  Tags,
  MapPin,
  Grid3x3,
  TrendingUp,
  Radio,
  FileText,
  ShieldAlert,
  Plug,
  Loader2,
  RefreshCw,
  X
} from "lucide-react";

/*
===========================================================
WORKSPACE TERRITORIAL — TERRITORIAL-ACCELERATION-02
===========================================================

Nueve secciones sobre un mismo corpus, con el proyecto como
ambito.

POR QUE ESTA VISTA EXISTE
-----------------------------------------------------------

Territorial funcionaba y se leia como infraestructura: paneles
tecnicos apilados sin jerarquia. Un analista que abre esto no
pregunta «¿que estados de cobertura hay?», pregunta «¿que esta
pasando en Cuenca?».

Las nueve secciones responden en ese orden.

TODO PERTENECE A UN PROYECTO
-----------------------------------------------------------

Sin proyecto no se muestra corpus. Un numero global leido como
si fuera de una campaña es peor que no tener numero: el libro de
evidencias es infraestructura compartida y la lectura es por
proyecto.

LO QUE ESTA VISTA SE NIEGA A HACER
-----------------------------------------------------------

Porcentajes de poblacion o de electores. No hay denominador
oficial con licencia, asi que todo es CONTEO ABSOLUTO.

Y no maquilla el historico: si no hay ventana comparable, la
seccion de tendencias lo dice en lugar de dibujar una flecha.
===========================================================
*/

const BACKEND = "http://localhost:3001";

/* Identidad Sentinel. */
const C = {
  profundo: "#081C3A",
  azul: "#0077FF",
  cian: "#00D4FF",
  noche: "#07111F",
  blanco: "#ffffff"
};

const SECCIONES = [
  {
    id: "resumen",
    etiqueta: "Resumen",
    icono: LayoutDashboard,
    explica: "Panorama general de la actividad territorial observable."
  },
  {
    id: "temas",
    etiqueta: "Temas",
    icono: Tags,
    explica: "Asuntos que aparecen y evolucionan."
  },
  {
    id: "territorios",
    etiqueta: "Territorios",
    icono: MapPin,
    explica: "Dónde aparecen las evidencias observadas."
  },
  {
    id: "cruce",
    etiqueta: "Tema × Territorio",
    icono: Grid3x3,
    explica: "Qué tema aparece en qué lugar y con qué evidencia."
  },
  {
    id: "tendencias",
    etiqueta: "Tendencias",
    icono: TrendingUp,
    explica: "Cambios entre ventanas comparables."
  },
  {
    id: "fuentes",
    etiqueta: "Fuentes",
    icono: Radio,
    explica: "Medios, instituciones y fuentes observadas."
  },
  {
    id: "evidencias",
    etiqueta: "Evidencias",
    icono: FileText,
    explica: "Publicaciones que sustentan los resultados."
  },
  {
    id: "cobertura",
    etiqueta: "Cobertura",
    icono: ShieldAlert,
    explica: "Qué puede y qué no puede observar Sentinel."
  },
  {
    id: "proveedores",
    etiqueta: "Proveedores",
    icono: Plug,
    explica: "Motores actuales y fuentes externas en evaluación."
  }
];

const VENTANAS = [
  { id: "hoy", etiqueta: "Hoy" },
  { id: "7d", etiqueta: "7D" },
  { id: "15d", etiqueta: "15D" },
  { id: "30d", etiqueta: "30D" },
  { id: "90d", etiqueta: "90D" }
];

const ESTADO_COLOR = {
  OPERATIVO: "#22c55e",
  OBSERVADO: "#22c55e",
  RESUELTO: "#22c55e",
  VERIFICADO_FEED: "#22c55e",
  APTO_PARA_PRUEBA: C.cian,
  COBERTURA_BAJA: "#eda100",
  OBSERVADO_NO_VERIFICADO: "#eda100",
  REQUIERE_CONTACTO: "#eda100",
  VERIFICADO_SIN_FEED: "#eda100",
  NO_PUBLICA_RSS: "#94a3b8",
  HISTORICO_INSUFICIENTE: "#8b5cf6",
  MUESTRA_INSUFICIENTE: "#eda100",
  CRECIENDO: "#22c55e",
  DISMINUYENDO: "#ef4444",
  ESTABLE: "#94a3b8",
  NO_ALCANZABLE: "#ef4444",
  INACCESIBLE: "#ef4444",
  NO_RESUELTO: "#64748b",
  TERRITORIO_NO_RESUELTO: "#64748b",
  SIN_EVIDENCIA: "#64748b",
  NO_VERIFICADO: "#64748b"
};

const eyebrow = {
  fontSize: "9.5px",
  letterSpacing: "1.9px",
  textTransform: "uppercase",
  fontWeight: 600
};

const td = {
  padding: "8px 10px",
  fontSize: "11.5px",
  borderBottom: "1px solid var(--sentinel-borde)",
  textAlign: "left",
  verticalAlign: "top"
};


/*
  Un tuit no tiene titular: su texto vive en el resumen. La tabla
  pintaba «(sin titular)» en filas que si tenian contenido.

  No se inventa un titulo. Se muestra el texto que hay y se marca
  de donde salio, para que el lector sepa que esta leyendo el
  cuerpo y no un titular editorial.

  Espejo de socialGeoDisambiguation.textoParaMostrar en el backend.
*/
function textoVisible(e) {
  const titulo = String(e?.titulo || e?.title || "").trim();

  if (titulo) return { texto: titulo, esResumen: false };

  const resumen = String(e?.resumen || e?.summary || "").trim();

  if (resumen) return { texto: resumen, esResumen: true };

  return { texto: "(sin texto declarado)", esResumen: false };
}


function Badge({ estado, texto }) {
  const color = ESTADO_COLOR[estado] || "#64748b";

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "999px",
        border: `1px solid ${color}`,
        color,
        fontSize: "9.5px",
        letterSpacing: "0.3px",
        whiteSpace: "nowrap"
      }}
    >
      {texto || String(estado || "").replace(/_/g, " ").toLowerCase()}
    </span>
  );
}


/* Cifra grande con su etiqueta. Nunca un porcentaje. */
function Cifra({ valor, etiqueta, nota, acento }) {
  return (
    <div
      style={{
        flex: "1 1 130px",
        minWidth: "130px",
        padding: "13px 15px",
        borderRadius: "var(--radio-l)",
        border: "1px solid var(--sentinel-borde)",
        background: "var(--sentinel-surface)"
      }}
    >
      <div
        style={{
          fontSize: "23px",
          fontWeight: 600,
          lineHeight: 1.1,
          color: acento || "var(--sentinel-texto)"
        }}
      >
        {valor}
      </div>

      <div style={{ ...eyebrow, color: "var(--sentinel-texto-suave)", marginTop: "5px" }}>
        {etiqueta}
      </div>

      {nota && (
        <div
          style={{
            color: "var(--sentinel-texto-tenue)",
            fontSize: "10px",
            marginTop: "4px",
            lineHeight: 1.5
          }}
        >
          {nota}
        </div>
      )}
    </div>
  );
}


function Vacio({ texto }) {
  return (
    <div
      style={{
        padding: "22px",
        border: "1px dashed var(--sentinel-borde)",
        borderRadius: "var(--radio-l)",
        color: "var(--sentinel-texto-tenue)",
        fontSize: "11.5px",
        lineHeight: 1.7
      }}
    >
      {texto}
    </div>
  );
}


function Tabla({ cabeceras, filas, onFila }) {
  if (!filas.length) return <Vacio texto="Sin filas en esta ventana." />;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {cabeceras.map((h) => (
              <th
                key={h}
                style={{ ...td, ...eyebrow, color: "var(--sentinel-texto-tenue)" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {filas.map((f, i) => (
            <tr
              key={i}
              onClick={onFila ? () => onFila(f.__fila) : undefined}
              style={{ cursor: onFila ? "pointer" : "default" }}
            >
              {f.celdas.map((c, j) => (
                <td key={j} style={{ ...td, color: j === 0 ? "var(--sentinel-texto)" : "var(--sentinel-texto-suave)" }}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


function CajonEvidencia({ celda, evidenciaPorId, tendencia, onClose }) {
  if (!celda) return null;

  const evs = (celda.evidenceIds || []).map((id) => evidenciaPorId?.[id]).filter(Boolean);

  return (
    <div
      style={{
        marginTop: "14px",
        border: `1px solid ${C.cian}`,
        borderRadius: "var(--radio-l)",
        padding: "15px 17px",
        background: "var(--sentinel-surface)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
        <div>
          <div style={{ color: "var(--sentinel-texto)", fontSize: "13.5px", fontWeight: 600 }}>
            {celda.tema}
          </div>

          <div style={{ color: "var(--sentinel-texto-suave)", fontSize: "11px", marginTop: "3px" }}>
            {celda.territorio}
            {celda.nivel ? ` · ${celda.nivel}` : ""} · ventana {celda.ventana?.id}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{ background: "none", border: "none", color: "var(--sentinel-texto-tenue)", cursor: "pointer" }}
        >
          <X size={15} />
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: "16px",
          flexWrap: "wrap",
          margin: "12px 0",
          fontSize: "11.5px",
          color: "var(--sentinel-texto-suave)"
        }}
      >
        <span>{celda.evidencias} evidencia(s)</span>
        <span>{celda.fuentes} fuente(s)</span>
        <span>
          {celda.emisores} emisor(es)
          {celda.emisoresSinResolver ? ` · ${celda.emisoresSinResolver} sin resolver` : ""}
        </span>
        <Badge estado={celda.coverageStatus} />
        {tendencia && <Badge estado={tendencia.estado} />}
      </div>

      {tendencia?.motivo && (
        <div style={{ color: "var(--sentinel-texto-tenue)", fontSize: "10.5px", marginBottom: "10px", lineHeight: 1.6 }}>
          {tendencia.motivo}
        </div>
      )}

      {celda.atribucion?.length > 0 && (
        <div style={{ color: "var(--sentinel-texto-tenue)", fontSize: "10.5px", marginBottom: "10px", lineHeight: 1.6 }}>
          Atribución territorial: {celda.atribucion.join(" · ")}
        </div>
      )}

      <div style={{ ...eyebrow, color: C.cian, marginBottom: "7px" }}>
        Evidencia que lo sostiene
      </div>

      {evs.map((e) => (
        <div key={e.evidenceId} style={{ padding: "9px 0", borderTop: "1px solid var(--sentinel-borde)", fontSize: "11.5px" }}>
          <div style={{ color: "var(--sentinel-texto)", lineHeight: 1.5 }}>
            {textoVisible(e).texto}
            {textoVisible(e).esResumen && (
              <span style={{ color: "var(--sentinel-texto-tenue)", fontSize: "10px" }}> · texto de la pieza</span>
            )}
          </div>

          <div style={{ color: "var(--sentinel-texto-tenue)", fontSize: "10.5px", marginTop: "4px", lineHeight: 1.7 }}>
            {e.dominio}
            {e.tipoFuente ? ` · ${e.tipoFuente}` : ""} · emisor: {e.emisor || "SIN RESOLVER"}
            <br />
            publicado: {e.publishedAt || "sin fecha declarada"} · observado: {e.firstObservedAt}
            <br />
            territorio: {e.territorio?.unidadId}
            {e.territorio?.nivel ? ` (${e.territorio.nivel})` : ""} · proveedor: {e.providerId || "—"}
            <br />
            <span style={{ opacity: 0.7 }}>{e.evidenceId}</span>
          </div>
        </div>
      ))}
    </div>
  );
}


export default function TerritorialWorkspace({
  projectId,
  projectName,
  territorioId,

  /*
    ESTADO INYECTADO

    Permite renderizar el workspace con datos ya disponibles, sin
    depender del efecto de carga. Lo usa la verificacion de
    render del gate —SSR no ejecuta efectos, asi que sin esto
    solo se puede comprobar el estado vacio— y sirve igual para
    cualquier render de servidor.

    No cambia el camino normal: si no se inyecta nada, el
    componente carga como siempre.
  */
  seccionInicial = "resumen",
  datosIniciales = null,
  fuentesIniciales = null,
  proveedoresIniciales = null
}) {
  const [seccion, setSeccion] = useState(seccionInicial);

  const [ventana, setVentana] = useState("30d");

  const [datos, setDatos] = useState(datosIniciales);

  const [fuentes, setFuentes] = useState(fuentesIniciales);

  const [proveedores, setProveedores] = useState(proveedoresIniciales);

  const [cargando, setCargando] = useState(false);

  const [error, setError] = useState(null);

  const [abierta, setAbierta] = useState(null);

  const [soloTemas, setSoloTemas] = useState(true);

  const cargar = useCallback(
    async (v) => {
      if (!projectId) return;

      setCargando(true);

      setError(null);

      setAbierta(null);

      try {
        const [rCruce, rFuentes, rProv] = await Promise.all([
          fetch(`${BACKEND}/api/territorio/tema-territorio`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              proyectoId: projectId,
              territorio: territorioId || "ec-azuay-cuenca",
              ventana: v
            })
          }),
          fetch(
            `${BACKEND}/api/territorio/fuentes?territorio=${encodeURIComponent(territorioId || "ec-azuay-cuenca")}`
          ),
          fetch(`${BACKEND}/api/territorio/proveedores`)
        ]);

        const jCruce = await rCruce.json();

        if (jCruce.error) throw new Error(jCruce.error);

        setDatos(jCruce);

        setFuentes(await rFuentes.json());

        setProveedores(await rProv.json());
      } catch (e) {
        setError(e?.message || "no se pudo cargar la inteligencia territorial");
      } finally {
        setCargando(false);
      }
    },
    [projectId, territorioId]
  );

  /*
    Carga inicial al fijarse el proyecto.

    El `await` saca el `setState` del cuerpo SINCRONO del efecto:
    llamarlo ahi dispara renders en cascada y el linter lo marca
    con razon. Y el guardia `vivo` evita tocar estado de un
    componente ya desmontado, que es el fallo clasico de un
    fetch en un efecto.
  */
  useEffect(() => {
    if (!projectId || datosIniciales) return undefined;

    let vivo = true;

    (async () => {
      await Promise.resolve();

      if (vivo) cargar(ventana);
    })();

    return () => {
      vivo = false;
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [projectId]);

  /* --------------------------------------------------------- */
  /* SIN PROYECTO                                              */
  /* --------------------------------------------------------- */

  if (!projectId) {
    return (
      <section
        style={{
          padding: "34px 30px",
          borderRadius: "var(--radio-l)",
          border: "1px solid var(--sentinel-borde)",
          background: `linear-gradient(160deg, ${C.profundo} 0%, var(--sentinel-surface) 100%)`
        }}
      >
        <div style={{ ...eyebrow, color: C.cian, marginBottom: "9px" }}>
          Inteligencia Territorial
        </div>

        <div style={{ color: C.blanco, fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
          Selecciona un proyecto para consultar Inteligencia Territorial.
        </div>

        <div
          style={{
            color: "var(--sentinel-texto-suave)",
            fontSize: "11.5px",
            lineHeight: 1.75,
            maxWidth: "620px"
          }}
        >
          Toda evidencia, fuente, tema y territorio pertenece a un proyecto. El libro de
          evidencias es infraestructura compartida, pero la lectura es por proyecto:{" "}
          <strong>no se muestra un corpus global</strong>, porque una cifra global leída como si
          fuera de una campaña informa peor que no tener cifra.
        </div>
      </section>
    );
  }

  const m = datos?.matriz;

  const filasCruce = (m?.filas || []).filter((f) => !soloTemas || f.tipoSenal === "TEMA");

  const tendenciaDe = (temaId) =>
    (datos?.comparacion?.filas || []).find((f) => f.temaId === temaId) || null;

  /* --- agregados para RESUMEN, TEMAS y TERRITORIOS --- */
  const porTema = new Map();

  const porTerritorio = new Map();

  (m?.filas || []).forEach((f) => {
    if (f.tipoSenal === "TEMA") {
      const t = porTema.get(f.temaId) || {
        tema: f.tema,
        temaId: f.temaId,
        evidencias: 0,
        fuentes: 0,
        territorios: new Set()
      };

      t.evidencias += f.evidencias;

      t.fuentes = Math.max(t.fuentes, f.fuentes);

      if (f.territorioId !== "TERRITORIO_NO_RESUELTO") t.territorios.add(f.territorioId);

      porTema.set(f.temaId, t);
    }

    const k = f.territorioId;

    const u = porTerritorio.get(k) || {
      territorioId: k,
      territorio: f.territorio,
      nivel: f.nivel,
      evidencias: 0,
      temas: new Set()
    };

    u.evidencias += f.evidencias;

    u.temas.add(f.temaId);

    porTerritorio.set(k, u);
  });

  const temasOrdenados = [...porTema.values()].sort((a, b) => b.evidencias - a.evidencias);

  const territoriosOrdenados = [...porTerritorio.values()].sort(
    (a, b) => b.evidencias - a.evidencias
  );

  const seccionActual = SECCIONES.find((s) => s.id === seccion);

  /* --------------------------------------------------------- */
  /* RENDER                                                    */
  /* --------------------------------------------------------- */

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* ---------- CABECERA ---------- */}
      <section
        style={{
          padding: "20px 24px",
          borderRadius: "var(--radio-l)",
          border: "1px solid var(--sentinel-borde)",
          background: `linear-gradient(135deg, ${C.profundo} 0%, ${C.noche} 100%)`
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px",
            flexWrap: "wrap"
          }}
        >
          <div>
            <div style={{ ...eyebrow, color: C.cian, marginBottom: "7px" }}>
              Inteligencia Territorial
            </div>

            <div style={{ color: C.blanco, fontSize: "17px", fontWeight: 600, letterSpacing: "-0.2px" }}>
              {projectName || projectId}
            </div>

            <div style={{ color: "var(--sentinel-texto-suave)", fontSize: "11.5px", marginTop: "5px" }}>
              {(datos?.territorioId || territorioId || "—").replace(/^ec-azuay-cuenca$/, "Cuenca · Azuay · Ecuador")}
            </div>
          </div>

          <div style={{ display: "flex", gap: "5px", alignItems: "center", flexWrap: "wrap" }}>
            {VENTANAS.map((v) => {
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
                    padding: "4px 11px",
                    borderRadius: "999px",
                    border: `1px solid ${activa ? C.cian : "rgba(255,255,255,0.16)"}`,
                    background: activa ? "rgba(0,212,255,0.11)" : "transparent",
                    color: activa ? C.cian : "var(--sentinel-texto-suave)",
                    fontSize: "10.5px",
                    fontWeight: activa ? 600 : 400,
                    cursor: "pointer"
                  }}
                >
                  {v.etiqueta}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => cargar(ventana)}
              disabled={cargando}
              title="Recargar. Lee el corpus observado: no sale a internet."
              style={{
                marginLeft: "5px",
                padding: "4px 9px",
                borderRadius: "var(--radio-m, 6px)",
                border: `1px solid ${C.azul}`,
                background: "transparent",
                color: C.cian,
                fontSize: "10.5px",
                cursor: cargando ? "default" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px"
              }}
            >
              {cargando ? <Loader2 size={11} /> : <RefreshCw size={11} />}
              {cargando ? "Cargando" : "Recargar"}
            </button>
          </div>
        </div>
      </section>

      {/* ---------- NAVEGACION ---------- */}
      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
        {SECCIONES.map((s) => {
          const Icono = s.icono;

          const activa = s.id === seccion;

          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSeccion(s.id)}
              title={s.explica}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 13px",
                borderRadius: "var(--radio-m, 7px)",
                border: `1px solid ${activa ? C.azul : "var(--sentinel-borde)"}`,
                background: activa ? "rgba(0,119,255,0.12)" : "transparent",
                color: activa ? C.cian : "var(--sentinel-texto-suave)",
                fontSize: "11.5px",
                fontWeight: activa ? 600 : 400,
                cursor: "pointer"
              }}
            >
              <Icono size={13} />
              {s.etiqueta}
            </button>
          );
        })}
      </div>

      {/* ---------- EXPLICACION DE LA SECCION ---------- */}
      <div
        style={{
          color: "var(--sentinel-texto-suave)",
          fontSize: "11.5px",
          lineHeight: 1.7,
          paddingLeft: "2px"
        }}
      >
        {seccionActual?.explica}
      </div>

      {error && (
        <div style={{ color: "#ef4444", fontSize: "11.5px" }}>
          {error}
          <div style={{ color: "var(--sentinel-texto-tenue)", fontSize: "10.5px", marginTop: "4px" }}>
            El backend tiene que estar en {BACKEND}.
          </div>
        </div>
      )}

      {!datos && !error && (
        <Vacio texto={cargando ? "Cargando la inteligencia territorial del proyecto…" : "Sin datos cargados."} />
      )}

      {datos && (
        <section
          style={{
            background: "var(--sentinel-surface)",
            border: "1px solid var(--sentinel-borde)",
            borderRadius: "var(--radio-l)",
            padding: "19px 21px"
          }}
        >
          {/* ================= RESUMEN ================= */}
          {seccion === "resumen" && (
            <>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
                <Cifra valor={datos.corpus.evidenciasDelAmbito ?? datos.corpus.evidencias} etiqueta="Evidencias observadas" />
                <Cifra valor={datos.corpus.dominios} etiqueta="Fuentes" />
                <Cifra
                  valor={datos.corpus.emisores?.resueltos ?? 0}
                  etiqueta="Emisores resueltos"
                  acento={datos.corpus.emisores?.resueltos ? "#22c55e" : undefined}
                  nota={
                    datos.corpus.emisores?.sinResolver
                      ? `${datos.corpus.emisores.sinResolver} sin resolver`
                      : null
                  }
                />
                <Cifra valor={m.metricas.temas} etiqueta="Temas" nota={`${m.metricas.senalesQueSonLugar || 0} son un lugar`} />
                <Cifra valor={m.metricas.territorios} etiqueta="Territorios" />
                <Cifra
                  valor={(m.filas || []).reduce((n, f) => n + f.publicadoHoy, 0)}
                  etiqueta="Publicado hoy"
                  acento={C.cian}
                />
              </div>

              <div style={{ ...eyebrow, color: C.cian, marginBottom: "8px" }}>Cobertura temporal</div>

              <div
                style={{
                  color: m.ventana.historicoCubre ? "var(--sentinel-texto-suave)" : "#8b5cf6",
                  fontSize: "11.5px",
                  lineHeight: 1.7,
                  marginBottom: "16px"
                }}
              >
                {m.ventana.historicoCubre
                  ? `La ventana ${m.ventana.id} está cubierta por la observación.`
                  : m.ventana.motivo}
              </div>

              <div style={{ ...eyebrow, color: C.cian, marginBottom: "8px" }}>Temas principales</div>

              <Tabla
                cabeceras={["Tema", "Evidencias", "Fuentes", "Territorios"]}
                filas={temasOrdenados.slice(0, 6).map((t) => ({
                  celdas: [t.tema, t.evidencias, t.fuentes, t.territorios.size]
                }))}
              />

              <div style={{ ...eyebrow, color: C.cian, margin: "16px 0 8px" }}>
                Territorios con mayor actividad observada
              </div>

              <Tabla
                cabeceras={["Territorio", "Nivel", "Evidencias", "Temas"]}
                filas={territoriosOrdenados.slice(0, 6).map((u) => ({
                  celdas: [u.territorio, u.nivel || "—", u.evidencias, u.temas.size]
                }))}
              />

              <div style={{ ...eyebrow, color: C.cian, margin: "16px 0 8px" }}>Cambios recientes</div>

              <div style={{ color: "var(--sentinel-texto-suave)", fontSize: "11.5px", lineHeight: 1.7 }}>
                {datos.comparacion.metricas.conTendenciaDeclarable > 0
                  ? `${datos.comparacion.metricas.conTendenciaDeclarable} de ${datos.comparacion.filas.length} señales con tendencia declarable.`
                  : "Ninguna tendencia declarable todavía. Sentinel está acumulando observaciones para establecer una línea base temporal comparable."}
              </div>
            </>
          )}

          {/* ================= TEMAS ================= */}
          {seccion === "temas" && (
            <Tabla
              cabeceras={["Tema", "Evidencias", "Fuentes", "Territorios", "Cambio"]}
              filas={temasOrdenados.map((t) => {
                const tend = tendenciaDe(t.temaId);

                return {
                  celdas: [
                    t.tema,
                    t.evidencias,
                    t.fuentes,
                    t.territorios.size,
                    tend ? <Badge key="b" estado={tend.estado} /> : "—"
                  ]
                };
              })}
            />
          )}

          {/* ================= TERRITORIOS ================= */}
          {seccion === "territorios" && (
            <>
              <Tabla
                cabeceras={["Territorio", "Nivel", "Evidencias", "Temas"]}
                filas={territoriosOrdenados.map((u) => ({
                  celdas: [
                    u.territorioId === "TERRITORIO_NO_RESUELTO" ? (
                      <Badge key="b" estado="TERRITORIO_NO_RESUELTO" texto="territorio no resuelto" />
                    ) : (
                      u.territorio
                    ),
                    u.nivel || "—",
                    u.evidencias,
                    u.temas.size
                  ]
                }))}
              />

              <div
                style={{
                  marginTop: "14px",
                  paddingTop: "11px",
                  borderTop: "1px solid var(--sentinel-borde)",
                  color: "var(--sentinel-texto-tenue)",
                  fontSize: "10.5px",
                  lineHeight: 1.7
                }}
              >
                <strong>Geometría oficial no disponible</strong> para las unidades urbanas del cantón:
                la lectura territorial es por tabla, no por mapa. No se dibujan polígonos sin fuente
                oficial. {datos.territorio.sinUbicar} evidencia(s) no se pudieron ubicar y{" "}
                <strong>no se reparten</strong>.
              </div>
            </>
          )}

          {/* ================= TEMA x TERRITORIO ================= */}
          {seccion === "cruce" && (
            <>
              <label
                style={{
                  fontSize: "10.5px",
                  color: "var(--sentinel-texto-suave)",
                  cursor: "pointer",
                  display: "inline-block",
                  marginBottom: "11px"
                }}
              >
                <input
                  type="checkbox"
                  checked={soloTemas}
                  onChange={(e) => setSoloTemas(e.target.checked)}
                  style={{ verticalAlign: "-1px", marginRight: "5px" }}
                />
                solo temas (ocultar lugares y fechas)
              </label>

              <Tabla
                cabeceras={["Tema", "Territorio", "Ev.", "Fuentes", "Emis.", "Hoy", "Cobertura"]}
                filas={filasCruce.map((f) => ({
                  __fila: f,
                  celdas: [
                    f.tema,
                    f.territorio,
                    f.evidencias,
                    f.fuentes,
                    f.emisores,
                    f.publicadoHoy,
                    <Badge key="b" estado={f.coverageStatus} />
                  ]
                }))}
                onFila={setAbierta}
              />

              <CajonEvidencia
                celda={abierta}
                evidenciaPorId={datos.evidenciaPorId}
                tendencia={abierta ? tendenciaDe(abierta.temaId) : null}
                onClose={() => setAbierta(null)}
              />
            </>
          )}

          {/* ================= TENDENCIAS ================= */}
          {seccion === "tendencias" && (
            <>
              <div
                style={{
                  color: "var(--sentinel-texto-suave)",
                  fontSize: "11.5px",
                  lineHeight: 1.75,
                  marginBottom: "13px"
                }}
              >
                Ventana actual{" "}
                <strong style={{ color: "var(--sentinel-texto)" }}>
                  {datos.comparacion.ventanaActual.id}
                </strong>{" "}
                frente a la anterior comparable.{" "}
                {datos.comparacion.observabamosLaVentanaAnterior
                  ? "Se observaban las dos ventanas."
                  : "No se observaba la ventana anterior."}
              </div>

              {datos.comparacion.metricas.conTendenciaDeclarable === 0 && (
                <div
                  style={{
                    padding: "13px 15px",
                    borderRadius: "var(--radio-l)",
                    border: "1px solid #8b5cf6",
                    color: "#c4b5fd",
                    fontSize: "11.5px",
                    lineHeight: 1.75,
                    marginBottom: "14px"
                  }}
                >
                  <strong>Sentinel está acumulando observaciones</strong> para establecer una línea
                  base temporal comparable. Ninguna tendencia es declarable todavía, y eso no se
                  maquilla: comparar contra un periodo que no se observaba produciría un crecimiento
                  inventado.
                </div>
              )}

              <Tabla
                cabeceras={["Señal", "Actual", "Anterior", "Variación", "Estado"]}
                filas={datos.comparacion.filas
                  .filter((f) => f.ventanaActual.evidencias + f.ventanaAnterior.evidencias > 0)
                  .slice(0, 40)
                  .map((f) => ({
                    celdas: [
                      f.tema,
                      f.ventanaActual.evidencias,
                      f.ventanaAnterior.evidencias,
                      f.variacionRelativa === null ? "—" : f.variacionRelativa,
                      <Badge key="b" estado={f.estado} />
                    ]
                  }))}
              />
            </>
          )}

          {/* ================= FUENTES ================= */}
          {seccion === "fuentes" && (
            <>
              <Tabla
                cabeceras={["Fuente", "Tipo", "Territorio", "Estado", "Feed", "Última comprobación"]}
                filas={(fuentes?.fuentes || []).map((f) => ({
                  celdas: [
                    f.nombre,
                    f.tipo || "no clasificado",
                    f.territorioDeclarado || "no declarado",
                    <Badge key="b" estado={f.estadoVerificacion} />,
                    (f.feeds || []).length ? `${f.feeds.length} feed(s)` : "—",
                    f.ultimaComprobacionEn ? String(f.ultimaComprobacionEn).slice(0, 10) : "nunca"
                  ]
                }))}
              />

              <div
                style={{
                  marginTop: "13px",
                  color: "var(--sentinel-texto-tenue)",
                  fontSize: "10.5px",
                  lineHeight: 1.7
                }}
              >
                «Comprobado» significa que Sentinel fue al sitio por HTTP y anotó qué pasó.
                «Verificado» significaría contrastado contra un registro oficial de medios:{" "}
                <strong>ninguna ficha lo está</strong>.
              </div>
            </>
          )}

          {/* ================= EVIDENCIAS ================= */}
          {seccion === "evidencias" && (
            <Tabla
              cabeceras={["Título", "Fuente", "Emisor", "Publicado", "Observado", "Territorio", "Proveedor"]}
              filas={Object.values(datos.evidenciaPorId || {})
                .slice(0, 60)
                .map((e) => ({
                  celdas: [
                    <span key="t" title={e.evidenceId}>
                      {textoVisible(e).texto.slice(0, 70)}
                    </span>,
                    e.dominio,
                    e.emisor || <Badge key="b" estado="NO_RESUELTO" texto="no resuelto" />,
                    e.publishedAt ? String(e.publishedAt).slice(0, 16) : "sin fecha",
                    String(e.firstObservedAt || "").slice(0, 10),
                    e.territorio?.unidadId === "TERRITORIO_NO_RESUELTO" ? "no resuelto" : e.territorio?.unidadId,
                    e.providerId || "—"
                  ]
                }))}
            />
          )}

          {/* ================= COBERTURA ================= */}
          {seccion === "cobertura" && (
            <>
              <div style={{ ...eyebrow, color: "#22c55e", marginBottom: "8px" }}>Qué observamos</div>

              <ul
                style={{
                  color: "var(--sentinel-texto-suave)",
                  fontSize: "11.5px",
                  lineHeight: 1.85,
                  margin: "0 0 17px",
                  paddingLeft: "18px"
                }}
              >
                <li>
                  <strong>{datos.corpus.evidenciasDelAmbito ?? datos.corpus.evidencias}</strong>{" "}
                  evidencias del proyecto, de <strong>{datos.corpus.dominios}</strong> dominios.
                </li>
                <li>
                  <strong>{datos.corpus.emisores?.resueltos ?? 0}</strong> con emisor RESUELTO por
                  feed comprobado del propio medio.
                </li>
                <li>
                  <strong>{datos.territorio.ubicadas}</strong> con territorio resuelto.
                </li>
                <li>
                  <strong>{datos.corpus.conResumen ?? 0}</strong> con resumen persistido.
                </li>
              </ul>

              <div style={{ ...eyebrow, color: "#eda100", marginBottom: "8px" }}>Qué todavía no</div>

              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
                <Badge estado="HISTORICO_INSUFICIENTE" texto="histórico insuficiente" />
                <Badge estado="TERRITORIO_NO_RESUELTO" texto="territorio no resuelto" />
                <Badge estado="NO_RESUELTO" texto="emisor no resuelto" />
                <Badge estado="NO_VERIFICADO" texto="geometría no disponible" />
                <Badge estado="NO_VERIFICADO" texto="denominador no disponible" />
              </div>

              <ul
                style={{
                  color: "var(--sentinel-texto-suave)",
                  fontSize: "11.5px",
                  lineHeight: 1.85,
                  margin: 0,
                  paddingLeft: "18px"
                }}
              >
                <li>
                  <strong>{datos.territorio.sinUbicar}</strong> evidencias sin territorio resuelto.
                  No se reparten ni se descartan: se ven.
                </li>
                <li>
                  <strong>{datos.corpus.emisores?.sinResolver ?? 0}</strong> sin emisor resuelto —
                  las que llegaron por agregador, que oculta al publicador por diseño.
                </li>
                <li>
                  Ninguna tendencia declarable: el histórico del proyecto empezó al persistir la
                  primera observación.
                </li>
                <li>
                  <strong>Geometría oficial no disponible</strong> para las 15 parroquias urbanas: no
                  se dibujan polígonos sin fuente.
                </li>
                <li>
                  <strong>Sin denominador poblacional con licencia comercial</strong> ni padrón
                  electoral: {datos.metricasNoDisponibles?.motivo}
                </li>
              </ul>
            </>
          )}

          {/* ================= PROVEEDORES ================= */}
          {seccion === "proveedores" && (
            <>
              <div style={{ ...eyebrow, color: C.cian, marginBottom: "8px" }}>Motores actuales</div>

              <Tabla
                cabeceras={["Motor", "Estado", "Observaciones en el corpus", "Nota"]}
                filas={(proveedores?.motores || []).map((p) => ({
                  celdas: [
                    p.nombre || p.providerId,
                    <Badge key="b" estado={p.estado} />,
                    p.observacionesEnElCorpus ?? 0,
                    <span key="n" style={{ fontSize: "10.5px" }}>
                      {p.nota}
                    </span>
                  ]
                }))}
              />

              <div style={{ ...eyebrow, color: C.cian, margin: "17px 0 8px" }}>
                Candidatos externos en evaluación
              </div>

              <Tabla
                cabeceras={["Proveedor", "Tipo", "Estado", "Cuenca", "Trial", "Coste", "Qué añade"]}
                filas={(proveedores?.candidatos || []).map((c) => ({
                  celdas: [
                    `#${c.ranking} ${c.nombre}`,
                    c.tipo,
                    <Badge key="b" estado={c.estado} />,
                    c.cuenca,
                    c.trial,
                    c.coste,
                    <span key="a" style={{ fontSize: "10.5px" }}>
                      {c.aporta}
                    </span>
                  ]
                }))}
              />

              <div
                style={{
                  marginTop: "13px",
                  color: "var(--sentinel-texto-tenue)",
                  fontSize: "10.5px",
                  lineHeight: 1.7
                }}
              >
                {proveedores?.evaluacion?.declaracion} Documento:{" "}
                <code>{proveedores?.evaluacion?.documento}</code>
              </div>
            </>
          )}
        </section>
      )}

      {/* ---------- PIE: la regla que no se rompe ---------- */}
      <div
        style={{
          color: "var(--sentinel-texto-tenue)",
          fontSize: "10px",
          lineHeight: 1.7,
          paddingLeft: "2px"
        }}
      >
        Métrica: <strong>conteo absoluto</strong>. Sin porcentajes de población ni de electores
        mientras no haya denominador oficial con licencia.
      </div>
    </div>
  );
}
