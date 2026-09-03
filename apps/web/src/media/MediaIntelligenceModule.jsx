import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

import {
  Newspaper,
  Radio,
  UserSquare2,
  Sparkles,
  Tag,
  Network,
  BarChart3,
  ShieldCheck,
  Link2,
  AlertTriangle,
  Ban,
  RefreshCw,
  Filter
} from "lucide-react";

import MediaPieceModule from "./MediaPieceModule";

const BACKEND = "http://localhost:3001";

/*
===========================================================
MEDIA INTELLIGENCE — VISTA PRINCIPAL (MEDIA-UX-HOME-01)
===========================================================

Antes de este gate, «Analizar publicacion» ERA todo el modulo.
Ahora es una de sus nueve secciones, y la que el menu abre por
defecto es el RESUMEN del corpus del proyecto.

CUATRO DECISIONES DE INTERFAZ QUE NO SON ESTETICAS
-----------------------------------------------------------

1. Una cifra ausente NO se pinta como 0 ni se oculta: se pinta
   su ESTADO —COBERTURA_INSUFICIENTE, SIN_EVIDENCIA,
   NO_DISPONIBLE— y el motivo debajo. Un 0 afirmaria que se
   midio; ocultarla haria creer que la pregunta no existe.

2. El ranking muestra DOS columnas de recuento: la de la
   ventana y la del corpus. Con una sola, «El Mercurio · 0» en
   la ventana HOY se lee como «no publica», cuando tiene ocho
   piezas observadas y ninguna con fecha utilizable.

3. Las tres cifras de amplificacion —piezas, fuentes,
   contenidos— van juntas y con la frase que las separa.
   Ponerlas en tarjetas distintas invitaria a sumarlas.

4. Los artefactos de recoleccion (google.com y compañia) se
   muestran en su propia lista, fuera del ranking. Ni se
   rankean —no son medios— ni se esconden: el analista tiene
   derecho a saber que parte de su corpus es residuo del
   metodo.

LO QUE ESTA VISTA NO HACE
-----------------------------------------------------------

No ejecuta proveedores y no consume cuota: solo lee lo que el
Knowledge Lake ya guardo. La unica pantalla que gasta cuota
sigue siendo «Analizar publicacion», y lo declara ella misma.
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
  fontSize: "0.6rem",
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color: "var(--sentinel-texto-tenue)"
};

const CAMPO = {
  width: "100%",
  marginTop: "5px",
  padding: "7px 9px",
  background: "var(--sentinel-surface)",
  border: "1px solid var(--sentinel-borde)",
  borderRadius: "var(--radio-s, 8px)",
  color: "var(--sentinel-texto)",
  fontSize: "0.78rem",
  boxSizing: "border-box"
};

const TH = {
  ...ETIQUETA,
  textAlign: "left",
  padding: "7px 10px",
  borderBottom: "1px solid var(--sentinel-borde)",
  whiteSpace: "nowrap"
};

const TD = {
  padding: "8px 10px",
  fontSize: "0.78rem",
  color: "var(--sentinel-texto)",
  borderBottom: "1px solid rgba(20,41,94,.5)",
  verticalAlign: "top"
};


/* Las nueve secciones. El orden es el del contrato del modulo. */
const SECCIONES = [
  { id: "resumen", texto: "Resumen", icono: BarChart3 },
  { id: "medios", texto: "Medios", icono: Newspaper },
  { id: "periodistas", texto: "Periodistas", icono: UserSquare2 },
  { id: "creadores", texto: "Creadores", icono: Sparkles },
  { id: "historias", texto: "Historias / temas", icono: Tag },
  { id: "amplificacion", texto: "Amplificación", icono: Network },
  { id: "presencia", texto: "Ranking / presencia", icono: Radio },
  { id: "fuentes", texto: "Fuentes / evidencias", icono: ShieldCheck },
  { id: "analizar", texto: "Analizar publicación", icono: Link2 }
];


const VENTANAS = [
  { id: "hoy", texto: "Hoy" },
  { id: "7d", texto: "7 días" },
  { id: "15d", texto: "15 días" },
  { id: "30d", texto: "30 días" },
  { id: "90d", texto: "90 días" }
];


/*
  Color por estado. El amarillo es para «no lo sabemos» y el
  rojo NO se usa: un dato que falta no es un error.
*/
const COLOR_ESTADO = {
  COBERTURA_INSUFICIENTE: "#eda100",
  NO_DISPONIBLE: "var(--sentinel-texto-tenue)",
  SIN_EVIDENCIA: "var(--sentinel-texto-tenue)",
  NO_CLASIFICADO: "#eda100",
  METODOLOGIA_EN_CONSTRUCCION: "#eda100",
  FECHA_NO_NORMALIZADA: "#eda100"
};


function Seccion({ icono: Icono, titulo, nota, children, acento }) {
  return (
    <section style={{ ...CAJA, marginBottom: "14px" }}>
      <div style={{ ...TITULO, color: acento || "var(--sentinel-cyan)" }}>
        {Icono ? <Icono size={14} /> : null}
        {titulo}
      </div>

      {nota ? (
        <p
          style={{
            margin: "0 0 12px",
            fontSize: "0.74rem",
            color: "var(--sentinel-texto-suave)",
            lineHeight: 1.55
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
  Una cifra del contrato `medida()`. Es el componente central de
  toda la vista: si `valor` es null pinta el estado, nunca un
  cero, y el motivo queda visible sin desplegar nada.
*/
function Cifra({ etiqueta, m, ancho = "auto" }) {
  if (!m) return null;

  const ausente = m.valor === null || m.valor === undefined;

  const color = ausente
    ? COLOR_ESTADO[m.estado] || "var(--sentinel-texto-tenue)"
    : "var(--sentinel-texto)";

  const texto = ausente
    ? m.etiqueta || (m.estado || "NO_DISPONIBLE").replace(/_/g, " ")
    : Array.isArray(m.valor)
      ? m.valor.join(", ")
      : String(m.valor);

  return (
    <div
      style={{
        minWidth: ancho,
        background: "var(--sentinel-surface-alta)",
        border: "1px solid var(--sentinel-borde)",
        borderRadius: "var(--radio-s, 8px)",
        padding: "11px 13px"
      }}
    >
      <div style={ETIQUETA}>{etiqueta}</div>

      <div
        style={{
          marginTop: "5px",
          fontSize: ausente ? "0.68rem" : "1.35rem",
          fontWeight: ausente ? 600 : 700,
          color,
          lineHeight: 1.25,
          letterSpacing: ausente ? "0.06em" : 0
        }}
      >
        {texto}
      </div>

      {m.motivo ? (
        <div
          style={{
            marginTop: "6px",
            fontSize: "0.66rem",
            color: "var(--sentinel-texto-tenue)",
            lineHeight: 1.5
          }}
        >
          {m.motivo}
        </div>
      ) : null}

      {m.nota ? (
        <div
          style={{
            marginTop: "5px",
            fontSize: "0.66rem",
            color: "var(--sentinel-texto-suave)",
            lineHeight: 1.5
          }}
        >
          {m.nota}
        </div>
      ) : null}
    </div>
  );
}


/* Cifra en una celda de tabla: compacta, misma regla. */
function CeldaCifra({ m }) {
  if (!m) return <span style={{ color: "var(--sentinel-texto-tenue)" }}>—</span>;

  const ausente = m.valor === null || m.valor === undefined;

  if (!ausente) {
    return (
      <span style={{ fontWeight: 650 }}>
        {Array.isArray(m.valor) ? m.valor.join(", ") : String(m.valor)}
      </span>
    );
  }

  return (
    <span
      title={m.motivo || ""}
      style={{
        fontSize: "0.62rem",
        letterSpacing: "0.05em",
        color: COLOR_ESTADO[m.estado] || "var(--sentinel-texto-tenue)",
        fontWeight: 600
      }}
    >
      {m.etiqueta || (m.estado || "NO_DISPONIBLE").replace(/_/g, " ")}
    </span>
  );
}


function Chip({ texto, color }) {
  if (!texto) return null;

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 7px",
        borderRadius: "var(--radio-pill)",
        border: `1px solid ${color || "var(--sentinel-borde-vivo)"}`,
        color: color || "var(--sentinel-texto-suave)",
        fontSize: "0.6rem",
        letterSpacing: "0.06em",
        fontWeight: 600,
        whiteSpace: "nowrap"
      }}
    >
      {texto}
    </span>
  );
}


function Aviso({ children, icono: Icono = AlertTriangle, color = "#eda100" }) {
  if (!children) return null;

  return (
    <div
      style={{
        display: "flex",
        gap: "9px",
        alignItems: "flex-start",
        background: "rgba(237,161,0,.07)",
        border: `1px solid ${color}33`,
        borderRadius: "var(--radio-s, 8px)",
        padding: "10px 12px",
        marginBottom: "12px"
      }}
    >
      <Icono size={13} style={{ color, flexShrink: 0, marginTop: "2px" }} />

      <div style={{ fontSize: "0.72rem", color: "var(--sentinel-texto-suave)", lineHeight: 1.55 }}>
        {children}
      </div>
    </div>
  );
}


function Lista({ items }) {
  if (!items?.length) return null;

  return (
    <ul
      style={{
        margin: "8px 0 0",
        paddingLeft: "17px",
        fontSize: "0.71rem",
        color: "var(--sentinel-texto-tenue)",
        lineHeight: 1.65
      }}
    >
      {items.filter(Boolean).map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  );
}


function fechaCorta(iso) {
  if (!iso) return "—";

  try {
    return new Date(iso).toLocaleString("es-EC", {
      timeZone: "America/Guayaquil",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return iso;
  }
}


/*
===========================================================
TABLA DE PRESENCIA
===========================================================

Se reutiliza en «Ranking / presencia», «Medios» y «Creadores»:
las tres son la misma tabla con un filtro distinto, y duplicarla
habria hecho que un cambio de columna se aplicara a una sola.
===========================================================
*/
function TablaPresencia({ filas, ventanaTexto }) {
  /*
    Que fila tiene abierta su justificacion. Vive en la tabla y no
    en el modulo: es estado de presentacion y cambiar de seccion
    debe olvidarlo.
  */
  const [abierta, setAbierta] = useState(null);

  if (!filas?.length) {
    return (
      <p style={{ fontSize: "0.75rem", color: "var(--sentinel-texto-tenue)", margin: 0 }}>
        Ninguna fuente de esta clase en el corpus del proyecto. No es un cero de
        actividad: es que el corpus no contiene ninguna todavía.
      </p>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "880px" }}>
        <thead>
          <tr>
            <th style={TH}>#</th>
            <th style={TH}>Fuente / medio</th>
            <th style={TH}>Clase</th>
            <th style={TH}>Piezas · {ventanaTexto}</th>
            <th style={TH}>Piezas · corpus</th>
            <th style={TH}>Candidatos</th>
            <th style={TH}>Temas</th>
            <th style={TH}>Cobertura declarada</th>
            <th style={TH}>Última observación</th>
            <th style={TH}>¿Por qué?</th>
          </tr>
        </thead>

        <tbody>
          {filas.map((f) => (
            <Fragment key={f.dominio}>
            <tr>
              <td style={{ ...TD, color: "var(--sentinel-texto-tenue)" }}>
                {f.rank}
                {f.empatadoConAnterior ? (
                  <span title="Empatado con la fila anterior" style={{ marginLeft: 3 }}>
                    =
                  </span>
                ) : null}
              </td>

              <td style={TD}>
                <div style={{ fontWeight: 650 }}>{f.nombre}</div>

                <div
                  style={{
                    fontSize: "0.65rem",
                    color: "var(--sentinel-texto-tenue)",
                    marginTop: "2px"
                  }}
                >
                  {f.dominio}
                </div>

                {f.correspondencias?.length ? (
                  <div style={{ marginTop: "5px" }}>
                    <Chip
                      texto={`~ ${f.correspondencias[0].nombre} · ${f.correspondencias[0].estado}`}
                      color="#eda100"
                    />

                    <div
                      style={{
                        fontSize: "0.62rem",
                        color: "var(--sentinel-texto-tenue)",
                        marginTop: "4px",
                        lineHeight: 1.5,
                        maxWidth: "260px"
                      }}
                    >
                      Correspondencia observada, no verificada. La clase no cambia
                      hasta que un analista la confirme.
                    </div>
                  </div>
                ) : null}
              </td>

              <td style={TD}>
                <Chip
                  texto={f.claseEtiqueta || f.clase}
                  color={
                    f.clase === "MEDIO"
                      ? "var(--sentinel-cyan)"
                      : f.clase === "NO_CLASIFICADO" || f.clase === "NO_DETERMINADO"
                        ? "#eda100"
                        : undefined
                  }
                />

                {f.conflictoDeClase ? (
                  <div style={{ marginTop: "4px" }}>
                    <Chip texto="CLASES EN CONFLICTO" color="#eda100" />
                  </div>
                ) : null}

                {f.tipoEnCatalogo ? (
                  <div
                    style={{
                      fontSize: "0.62rem",
                      color: "var(--sentinel-texto-tenue)",
                      marginTop: "4px"
                    }}
                  >
                    catálogo: {f.tipoEnCatalogo}
                  </div>
                ) : null}
              </td>

              <td style={TD}>
                <CeldaCifra m={f.piezasObservadas} />
              </td>

              <td style={TD}>
                <CeldaCifra m={f.piezasEnCorpus} />

                {f.piezasSinFechaUtilizable?.valor > 0 ? (
                  <div
                    style={{
                      fontSize: "0.62rem",
                      color: "#eda100",
                      marginTop: "3px"
                    }}
                  >
                    {f.piezasSinFechaUtilizable.valor} sin fecha utilizable
                  </div>
                ) : null}
              </td>

              <td style={TD}>
                <CeldaCifra m={f.candidatosMencionados} />

                {f.candidatos?.length ? (
                  <div
                    style={{
                      fontSize: "0.62rem",
                      color: "var(--sentinel-texto-tenue)",
                      marginTop: "3px",
                      maxWidth: "180px"
                    }}
                  >
                    {f.candidatos.join(", ")}
                  </div>
                ) : null}
              </td>

              <td style={TD}>
                <CeldaCifra m={f.temas} />
              </td>

              <td style={TD}>
                <CeldaCifra m={f.territorios} />

                {f.territorios?.nota ? (
                  <div
                    style={{
                      fontSize: "0.6rem",
                      color: "var(--sentinel-texto-tenue)",
                      marginTop: "3px",
                      maxWidth: "190px",
                      lineHeight: 1.45
                    }}
                  >
                    {f.territorios.nota}
                  </div>
                ) : null}
              </td>

              <td style={{ ...TD, color: "var(--sentinel-texto-suave)", whiteSpace: "nowrap" }}>
                {fechaCorta(f.ultimaObservacion)}
              </td>

              {/*
                No abre un panel nuevo ni pide nada al backend: la
                justificacion YA viaja en la fila, construida solo
                con hechos contables del corpus.
              */}
              <td style={TD}>
                <button
                  onClick={() =>
                    setAbierta(abierta === f.dominio ? null : f.dominio)
                  }
                  style={{
                    padding: "4px 9px",
                    borderRadius: "var(--radio-pill)",
                    border: "1px solid var(--sentinel-borde-vivo)",
                    background:
                      abierta === f.dominio ? "rgba(0,212,255,.10)" : "transparent",
                    color: "var(--sentinel-cyan)",
                    fontSize: "0.64rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap"
                  }}
                >
                  {abierta === f.dominio ? "Ocultar" : "¿Por qué?"}
                </button>
              </td>
            </tr>

            {abierta === f.dominio && f.porQue ? (
              <tr>
                <td colSpan={10} style={{ ...TD, background: "rgba(8,28,58,.55)" }}>
                  <div style={{ ...ETIQUETA, marginBottom: "8px" }}>
                    Por qué {f.nombre} está en esta posición
                  </div>

                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: "17px",
                      fontSize: "0.73rem",
                      color: "var(--sentinel-texto-suave)",
                      lineHeight: 1.7
                    }}
                  >
                    {f.porQue.razones.map((r) => (
                      <li key={r.clave}>{r.texto}</li>
                    ))}
                  </ul>

                  <p
                    style={{
                      margin: "10px 0 0",
                      fontSize: "0.68rem",
                      color: "#eda100",
                      lineHeight: 1.6
                    }}
                  >
                    {f.porQue.limite}
                  </p>

                  {/*
                    El enlace a la evidencia todavia no existe como
                    pantalla. Se declara preparado en lugar de
                    pintar un boton que no lleva a ningun sitio.
                  */}
                  <div style={{ marginTop: "10px" }}>
                    <button
                      disabled
                      title="La lista de evidencias por fuente llega con MEDIA-SOURCE-UNIVERSE-01."
                      style={{
                        padding: "4px 10px",
                        borderRadius: "var(--radio-pill)",
                        border: "1px dashed var(--sentinel-borde-vivo)",
                        background: "transparent",
                        color: "var(--sentinel-texto-tenue)",
                        fontSize: "0.64rem",
                        cursor: "not-allowed"
                      }}
                    >
                      Ver evidencia · preparado
                    </button>
                  </div>
                </td>
              </tr>
            ) : null}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}


/*
===========================================================
MODULO
===========================================================
*/
/*
===========================================================
UNIVERSO DE MEDIOS — MEDIA-SOURCE-UNIVERSE-01
===========================================================

Quien publica dentro de este proyecto, con sus activos y su
origen. NO es un ranking: el orden viene por piezas observadas
porque hay que ordenar de alguna forma, y la seccion lo declara.

El alta guarda de verdad. Es un formulario minimo a proposito
—nombre, sitio, tipo— porque lo que importa del alta no son los
campos sino la regla: lo que entra queda DECLARADO y NO
verificado, y verificar es una accion aparte.
===========================================================
*/
function UniversoDeMedios({ universo, onDeclararMedio }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [website, setWebsite] = useState("");
  const [tipo, setTipo] = useState("MEDIA");
  const [subtipo, setSubtipo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const enviar = async () => {
    if (!onDeclararMedio || (!nombre.trim() && !website.trim())) return;

    setEnviando(true);
    setAviso(null);

    const r = await onDeclararMedio({
      canonicalName: nombre.trim() || null,
      website: website.trim() || null,
      tipo,
      subtipo: subtipo || null
    });

    setEnviando(false);

    if (r?.ok) {
      setAviso({
        bien: true,
        texto: `«${r.entidad.canonicalName}» añadido al universo como DECLARADO. No queda verificado: verificar es una acción aparte y explícita.`
      });

      setNombre("");
      setWebsite("");
      setSubtipo("");
    } else {
      setAviso({ bien: false, texto: r?.motivo || "No se pudo guardar." });
    }
  };

  const entidades = universo?.entidades || [];

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <div style={ETIQUETA}>Universo de medios</div>

        {universo?.resumen ? (
          <>
            <Chip texto={`${universo.resumen.entidades} entidades`} color="var(--sentinel-cyan)" />
            <Chip texto={`${universo.resumen.activos.total} activos`} />
            {universo.resumen.verificadas > 0 ? (
              <Chip texto={`${universo.resumen.verificadas} verificadas`} color="var(--sentinel-live)" />
            ) : null}
          </>
        ) : null}
      </div>

      <p
        style={{
          margin: "8px 0 12px",
          fontSize: "0.72rem",
          color: "var(--sentinel-texto-suave)",
          lineHeight: 1.6,
          maxWidth: "780px"
        }}
      >
        {universo?.noEsRanking ||
          "Estar en el universo significa que Sentinel conoce esta fuente dentro del proyecto."}
      </p>

      {entidades.length ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "860px" }}>
            <thead>
              <tr>
                <th style={TH}>Nombre</th>
                <th style={TH}>Tipo</th>
                <th style={TH}>Territorio declarado</th>
                <th style={TH}>Activos</th>
                <th style={TH}>Medición</th>
                <th style={TH}>Origen</th>
                <th style={TH}>Estado</th>
                <th style={TH}>Última observación</th>
              </tr>
            </thead>

            <tbody>
              {entidades.map((e) => (
                <tr key={e.mediaEntityId}>
                  <td style={TD}>
                    <div style={{ fontWeight: 650 }}>{e.canonicalName}</div>

                    {e.correspondenciaPropuesta ? (
                      <div style={{ marginTop: "4px" }}>
                        <Chip
                          texto={`~ ${e.correspondenciaPropuesta.nombre} · sin confirmar`}
                          color="#eda100"
                        />
                      </div>
                    ) : null}
                  </td>

                  <td style={TD}>
                    <Chip
                      texto={e.tipo}
                      color={e.tipo === "MEDIA" ? "var(--sentinel-cyan)" : undefined}
                    />

                    {e.subtipo ? (
                      <div
                        style={{
                          fontSize: "0.62rem",
                          color: "var(--sentinel-texto-tenue)",
                          marginTop: "3px"
                        }}
                      >
                        {e.subtipo}
                      </div>
                    ) : null}
                  </td>

                  <td style={{ ...TD, fontSize: "0.7rem" }}>
                    {e.scope?.declarado ? (
                      e.scope.declarado.unidadId
                    ) : (
                      <span style={{ color: "var(--sentinel-texto-tenue)" }}>
                        Sin alcance declarado
                      </span>
                    )}
                  </td>

                  <td style={{ ...TD, fontSize: "0.7rem" }}>
                    {e.activos.map((a) => (
                      <div key={a.assetId}>
                        {a.plataforma || a.clase.toLowerCase()}
                        {a.handle ? ` · @${a.handle}` : a.dominio ? ` · ${a.dominio}` : ""}
                      </div>
                    ))}

                    {e.cobertura?.activosFueraDeCanales?.length ? (
                      <div style={{ color: "#eda100", marginTop: "3px" }}>
                        {e.cobertura.activosFueraDeCanales.length} fuera de los canales con
                        cobertura declarada
                      </div>
                    ) : null}
                  </td>

                  {/*
                    Estado de MEDICION, que es otra pregunta que la
                    de identidad: conocer un activo no es poder
                    leerlo. Sin snapshot se muestra «no medido», no
                    un cero.
                  */}
                  <td style={{ ...TD, fontSize: "0.68rem" }}>
                    {e.activos.map((a) => {
                      const m = a.ultimaMedicion;

                      const medido =
                        m &&
                        ["MEDIDO_OFICIAL", "MEDIDO_PROVEEDOR", "MEDIDO_PUBLICO", "PARCIAL"].includes(
                          m.estado
                        );

                      return (
                        <div key={a.assetId} style={{ marginBottom: "3px" }}>
                          <span
                            title={m?.motivo || m?.estado || "Sin medición registrada."}
                            style={{
                              color: !m
                                ? "var(--sentinel-texto-tenue)"
                                : medido
                                  ? "var(--sentinel-live)"
                                  : "#eda100",
                              fontWeight: 600
                            }}
                          >
                            {m ? m.estado.replace(/_/g, " ").toLowerCase() : "no medido"}
                          </span>

                          {m?.publicacionesObservadas ? (
                            <span style={{ color: "var(--sentinel-texto-tenue)" }}>
                              {" "}
                              · {m.publicacionesObservadas} piezas
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </td>

                  <td style={{ ...TD, fontSize: "0.7rem" }}>{e.origen}</td>

                  <td style={TD}>
                    <Chip
                      texto={e.estado}
                      color={
                        e.estado === "VERIFICADA"
                          ? "var(--sentinel-live)"
                          : e.estado === "OBSERVADA"
                            ? "var(--sentinel-cyan)"
                            : undefined
                      }
                    />

                    {!e.activa ? (
                      <div style={{ marginTop: "3px" }}>
                        <Chip texto="INACTIVA" color="#eda100" />
                      </div>
                    ) : null}
                  </td>

                  <td style={{ ...TD, whiteSpace: "nowrap", color: "var(--sentinel-texto-suave)" }}>
                    {fechaCorta(e.lastObservedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ fontSize: "0.75rem", color: "var(--sentinel-texto-tenue)" }}>
          Todavía no hay entidades en el universo de este proyecto.
        </p>
      )}

      {universo?.artefactosExcluidos?.length ? (
        <p
          style={{
            marginTop: "10px",
            fontSize: "0.68rem",
            color: "#eda100",
            lineHeight: 1.55
          }}
        >
          {universo.artefactosExcluidos.length} dominio(s) del corpus quedan fuera del
          universo por no ser fuentes que publiquen:{" "}
          {universo.artefactosExcluidos.map((a) => a.dominio).join(", ")}.
        </p>
      ) : null}

      {universo?.posiblesDuplicados?.length ? (
        <p style={{ marginTop: "8px", fontSize: "0.68rem", color: "#eda100" }}>
          {universo.posiblesDuplicados.length} par(es) comparten nombre y NO se
          fusionaron: hace falta un dominio común o un alias declarado.
        </p>
      ) : null}

      <div style={{ marginTop: "14px" }}>
        <button
          onClick={() => setAbierto(!abierto)}
          style={{
            padding: "6px 12px",
            borderRadius: "var(--radio-s, 8px)",
            border: "1px solid var(--sentinel-borde-vivo)",
            background: abierto ? "rgba(0,212,255,.10)" : "transparent",
            color: "var(--sentinel-cyan)",
            fontSize: "0.72rem",
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          {abierto ? "Cancelar" : "+ Agregar medio"}
        </button>

        {abierto ? (
          <div
            style={{
              marginTop: "12px",
              padding: "14px",
              background: "var(--sentinel-surface-alta)",
              border: "1px solid var(--sentinel-borde)",
              borderRadius: "var(--radio-s, 8px)",
              maxWidth: "620px"
            }}
          >
            <Aviso>
              Lo que añadas entra como <strong>DECLARADO</strong> y{" "}
              <strong>no verificado</strong>. Declarar no es verificar: verificar es una
              acción aparte que exige decir quién la hace.
            </Aviso>

            <div style={{ display: "grid", gap: "10px" }}>
              <label style={{ display: "block" }}>
                <div style={ETIQUETA}>Nombre</div>

                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Radio Tomebamba"
                  style={CAMPO}
                />
              </label>

              <label style={{ display: "block" }}>
                <div style={ETIQUETA}>Sitio web</div>

                <input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://radiotomebamba.com.ec"
                  style={CAMPO}
                />
              </label>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <label style={{ flex: 1, minWidth: "160px" }}>
                  <div style={ETIQUETA}>Tipo</div>

                  <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={CAMPO}>
                    {["MEDIA", "INSTITUTION", "CREATOR", "COMMUNITY", "ORGANIZATION", "OTHER"].map(
                      (t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label style={{ flex: 1, minWidth: "160px" }}>
                  <div style={ETIQUETA}>Subtipo (opcional)</div>

                  <select
                    value={subtipo}
                    onChange={(e) => setSubtipo(e.target.value)}
                    style={CAMPO}
                  >
                    <option value="">—</option>

                    {["PRENSA", "RADIO", "TV", "DIGITAL", "PODCAST", "OTRO"].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div>
                <button
                  onClick={enviar}
                  disabled={enviando || (!nombre.trim() && !website.trim())}
                  style={{
                    padding: "7px 14px",
                    borderRadius: "var(--radio-s, 8px)",
                    border: "1px solid var(--sentinel-cyan)",
                    background: "rgba(0,212,255,.12)",
                    color: "#FFFFFF",
                    fontSize: "0.74rem",
                    fontWeight: 650,
                    cursor: enviando ? "default" : "pointer"
                  }}
                >
                  {enviando ? "Guardando…" : "Añadir al universo"}
                </button>
              </div>

              <p
                style={{
                  margin: 0,
                  fontSize: "0.66rem",
                  color: "var(--sentinel-texto-tenue)",
                  lineHeight: 1.55
                }}
              >
                Las cuentas sociales y los feeds se pueden declarar por API. La pantalla
                para editarlos llega con la consolidación de UX.
              </p>
            </div>

            {aviso ? (
              <p
                style={{
                  marginTop: "10px",
                  fontSize: "0.72rem",
                  color: aviso.bien ? "var(--sentinel-live)" : "#ff6b6b",
                  lineHeight: 1.55
                }}
              >
                {aviso.texto}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}


/*
===========================================================
LA VISTA — separada del contenedor a proposito
===========================================================

`MediaIntelligenceVista` no sabe pedir datos: los recibe. El
contenedor de abajo es el que consulta el backend.

La separacion existe por MEDIA-UX-CERT-01: sin ella la pantalla
solo se puede comprobar abriendo un navegador, porque los datos
llegan en un `useEffect` que el render de servidor no ejecuta.
Partida en dos, la vista se renderiza en Node con la respuesta
REAL de la API y se puede comprobar QUE PINTA, que es justo la
distancia donde se colo el fallo de P-CAND-ASSET-TYPE-UI-FIX-01.

No sustituye a mirar la pantalla: no comprueba color ni
espaciado.
===========================================================
*/
export function MediaIntelligenceVista({
  proyectos = [],
  projectId = "",
  proyecto = null,
  ventana = "90d",
  seccion = "resumen",
  home = null,
  universo = null,
  cargando = false,
  error = null,
  onProyecto = () => {},
  onVentana = () => {},
  onSeccion = () => {},
  onRecargar = () => {},
  onDeclararMedio = null
}) {
  const ventanaTexto =
    VENTANAS.find((v) => v.id === ventana)?.texto || ventana;

  const ranking = home?.presencia?.ranking || [];

  return (
    <div className="sentinel-fade" style={{ maxWidth: "1240px" }}>
      {/*
        ---------------------------------------------------------
        CABECERA
        ---------------------------------------------------------
      */}
      <header style={{ marginBottom: "18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Newspaper size={20} style={{ color: "var(--sentinel-cyan)" }} />

          <h1
            style={{
              margin: 0,
              fontSize: "1.32rem",
              letterSpacing: "0.02em",
              color: "var(--sentinel-texto)"
            }}
          >
            Media Intelligence
          </h1>
        </div>

        <p
          style={{
            margin: "8px 0 0",
            fontSize: "0.82rem",
            color: "var(--sentinel-texto-suave)",
            maxWidth: "800px",
            lineHeight: 1.6
          }}
        >
          Quién publica, quién aparece, qué temas circulan y cómo se amplifica la
          conversación pública observable.
        </p>

        {/*
          La frase que este gate existe para poder afirmar. Va en
          la cabecera y no en un pie: es un cambio de modelo
          mental, no una nota.
        */}
        <p
          style={{
            margin: "6px 0 0",
            fontSize: "0.7rem",
            color: "var(--sentinel-texto-tenue)"
          }}
        >
          Media Intelligence no es «Analizar publicación»: analizar una
          publicación es una de sus herramientas.
        </p>
      </header>

      {/*
        ---------------------------------------------------------
        CONTEXTO: PROYECTO + VENTANA
        ---------------------------------------------------------
      */}
      <div
        style={{
          ...CAJA,
          marginBottom: "14px",
          display: "flex",
          gap: "22px",
          flexWrap: "wrap",
          alignItems: "flex-end"
        }}
      >
        <div style={{ minWidth: "280px" }}>
          <div style={ETIQUETA}>Proyecto</div>

          <select
            value={projectId}
            onChange={(e) => onProyecto(e.target.value)}
            style={{
              marginTop: "6px",
              width: "100%",
              padding: "8px 10px",
              background: "var(--sentinel-surface-alta)",
              border: "1px solid var(--sentinel-borde)",
              borderRadius: "var(--radio-s, 8px)",
              color: "var(--sentinel-texto)",
              fontSize: "0.8rem"
            }}
          >
            {proyectos.length === 0 ? <option value="">—</option> : null}

            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>

          {proyecto ? (
            <div
              style={{
                marginTop: "6px",
                fontSize: "0.65rem",
                color: "var(--sentinel-texto-tenue)"
              }}
            >
              {[proyecto.canton, proyecto.provincia, proyecto.pais]
                .filter(Boolean)
                .join(" · ")}
              {" · "}
              <code style={{ fontSize: "0.62rem" }}>{proyecto.id}</code>
            </div>
          ) : null}
        </div>

        <div>
          <div style={ETIQUETA}>Ventana observada</div>

          <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
            {VENTANAS.map((v) => {
              const activo = v.id === ventana;

              return (
                <button
                  key={v.id}
                  onClick={() => onVentana(v.id)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "var(--radio-pill)",
                    border: `1px solid ${
                      activo ? "var(--sentinel-cyan)" : "var(--sentinel-borde)"
                    }`,
                    background: activo ? "rgba(11,95,255,.18)" : "transparent",
                    color: activo ? "#FFFFFF" : "var(--sentinel-texto-suave)",
                    fontSize: "0.72rem",
                    fontWeight: activo ? 650 : 500,
                    cursor: "pointer"
                  }}
                >
                  {v.texto}
                </button>
              );
            })}
          </div>

          {home?.ventana ? (
            <div
              style={{
                marginTop: "6px",
                fontSize: "0.65rem",
                color: "var(--sentinel-texto-tenue)"
              }}
            >
              {home.ventana.zona} · {home.ventana.fechaLocalDesde || home.ventana.fechaLocal} →{" "}
              {home.ventana.fechaLocal}

              {/*
                EL PAR, SIEMPRE JUNTO.

                «0» a secas se lee como «Sentinel no encontró
                actividad». La verdad es otra: no puede situar 26
                piezas en el tiempo. Las dos cifras van pegadas y
                no se suman: una es un recuento de la ventana y la
                otra un hueco de normalización.
              */}
              <div style={{ marginTop: "4px", color: "var(--sentinel-texto-suave)" }}>
                {home.ventana.dentroDeVentana} pieza(s) situada(s) en la ventana
                {home.ventana.sinFechaUtilizable > 0 ? (
                  <>
                    {" · "}
                    <span style={{ color: "#eda100" }}>
                      {home.ventana.sinFechaUtilizable} con fecha no normalizada
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <button
          onClick={onRecargar}
          disabled={cargando || !projectId}
          style={{
            padding: "8px 14px",
            borderRadius: "var(--radio-s, 8px)",
            border: "1px solid var(--sentinel-borde-vivo)",
            background: "transparent",
            color: "var(--sentinel-texto-suave)",
            fontSize: "0.72rem",
            cursor: cargando ? "default" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <RefreshCw size={12} />
          {cargando ? "Leyendo…" : "Recargar"}
        </button>

        <div
          style={{
            fontSize: "0.65rem",
            color: "var(--sentinel-texto-tenue)",
            maxWidth: "260px",
            lineHeight: 1.5
          }}
        >
          Esta vista solo lee el Knowledge Lake. No ejecuta proveedores y no
          consume cuota.
        </div>
      </div>

      {/*
        ---------------------------------------------------------
        NAVEGACION DE LAS NUEVE SECCIONES
        ---------------------------------------------------------
      */}
      <nav
        style={{
          display: "flex",
          gap: "6px",
          flexWrap: "wrap",
          marginBottom: "16px",
          borderBottom: "1px solid var(--sentinel-borde)",
          paddingBottom: "10px"
        }}
      >
        {SECCIONES.map((s) => {
          const activo = s.id === seccion;

          const Icono = s.icono;

          return (
            <button
              key={s.id}
              onClick={() => onSeccion(s.id)}
              style={{
                padding: "7px 13px",
                borderRadius: "var(--radio-pill)",
                border: `1px solid ${
                  activo ? "var(--sentinel-cyan)" : "transparent"
                }`,
                background: activo ? "rgba(0,212,255,.10)" : "transparent",
                color: activo ? "#FFFFFF" : "var(--sentinel-texto-suave)",
                fontSize: "0.74rem",
                fontWeight: activo ? 650 : 500,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <Icono size={13} />
              {s.texto}

              {/*
                «Analizar publicacion» se marca como herramienta:
                es la unica seccion que ejecuta algo.
              */}
              {s.id === "analizar" ? (
                <span
                  style={{
                    fontSize: "0.55rem",
                    letterSpacing: "0.08em",
                    color: "var(--sentinel-texto-tenue)",
                    border: "1px solid var(--sentinel-borde)",
                    borderRadius: "var(--radio-pill)",
                    padding: "1px 5px"
                  }}
                >
                  HERRAMIENTA
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/*
        ---------------------------------------------------------
        ANALIZAR PUBLICACION — intacta, como subvista
        ---------------------------------------------------------
      */}
      {seccion === "analizar" ? (
        <>
          <Aviso icono={Link2} color="var(--sentinel-cyan)">
            Herramienta interna de Media Intelligence. Es la única sección que
            ejecuta proveedores y consume cuota; declara el plan de peticiones
            antes de gastarla.
          </Aviso>

          <MediaPieceModule />
        </>
      ) : null}

      {seccion !== "analizar" ? (
        <>
          {error ? (
            <Aviso icono={Ban} color="#ff6b6b">
              {error}
            </Aviso>
          ) : null}

          {!home && !error ? (
            <p style={{ fontSize: "0.8rem", color: "var(--sentinel-texto-tenue)" }}>
              {cargando ? "Leyendo el corpus del proyecto…" : "Sin datos."}
            </p>
          ) : null}
        </>
      ) : null}

      {home && seccion !== "analizar" ? (
        <>
          {/*
            -----------------------------------------------------
            RESUMEN
            -----------------------------------------------------
          */}
          {seccion === "resumen" ? (
            <>
              <Seccion
                icono={BarChart3}
                titulo={`Resumen ejecutivo · ${ventanaTexto}`}
                nota="Todas las cifras proceden del corpus de este proyecto. Una cifra ausente muestra su estado y su motivo: sin observación no es cero."
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(215px, 1fr))",
                    gap: "10px"
                  }}
                >
                  <Cifra etiqueta="Piezas observadas" m={home.resumen.piezasObservadas} />
                  <Cifra etiqueta="Piezas en el corpus" m={home.resumen.piezasEnCorpus} />
                  <Cifra etiqueta="Piezas analizadas" m={home.resumen.piezasAnalizadas} />
                  <Cifra etiqueta="Piezas relacionadas" m={home.resumen.piezasRelacionadas} />

                  {/*
                    MEDIA-CORPUS-INTEGRATION-01. Sin esta tarjeta el
                    resumen mostraba «1 analizada · 3 relacionadas»
                    sobre un corpus de 103 piezas: las 90 leídas de
                    los activos de los medios quedaban invisibles.
                  */}
                  {home.resumen.piezasMedidas ? (
                    <Cifra etiqueta="Piezas medidas" m={home.resumen.piezasMedidas} />
                  ) : null}
                  <Cifra etiqueta="Contenidos observados" m={home.resumen.contenidosObservados} />
                  <Cifra etiqueta="Fuentes distintas" m={home.resumen.fuentesDistintas} />
                  <Cifra etiqueta="Medios" m={home.resumen.medios} />
                  <Cifra etiqueta="Periodistas" m={home.resumen.periodistas} />
                  <Cifra etiqueta="Creadores" m={home.resumen.creadores} />
                  <Cifra etiqueta="Instituciones" m={home.resumen.instituciones} />
                  <Cifra etiqueta="Cuentas" m={home.resumen.cuentas} />
                  <Cifra etiqueta="No clasificados" m={home.resumen.noClasificados} />
                  <Cifra etiqueta="Candidatos relacionados" m={home.resumen.candidatosRelacionados} />
                  <Cifra etiqueta="Temas observados" m={home.resumen.temasObservados} />
                  <Cifra etiqueta="Territorios observados" m={home.resumen.territoriosObservados} />
                  <Cifra etiqueta="Evidencias disponibles" m={home.resumen.evidenciasDisponibles} />
                </div>
              </Seccion>

              <Seccion
                icono={Filter}
                titulo="Cobertura de las cinco ventanas"
                nota="Cuántas piezas puede situar cada ventana. Una ventana que no puede situar ninguna se declara, en lugar de mostrar un panel vacío sin explicación."
              >
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "620px" }}>
                    <thead>
                      <tr>
                        <th style={TH}>Ventana</th>
                        <th style={TH}>Dentro</th>
                        <th style={TH}>Fuera</th>
                        <th style={TH}>Sin fecha utilizable</th>
                        <th style={TH}>Estado</th>
                      </tr>
                    </thead>

                    <tbody>
                      {(home.ventanas || []).map((v) => (
                        <tr key={v.id}>
                          <td style={{ ...TD, fontWeight: v.id === ventana ? 700 : 500 }}>
                            {v.etiqueta}
                          </td>
                          <td style={TD}>{v.dentroDeVentana}</td>
                          <td style={TD}>{v.fueraDeVentana}</td>
                          <td style={{ ...TD, color: v.sinFechaUtilizable ? "#eda100" : undefined }}>
                            {v.sinFechaUtilizable}
                          </td>
                          <td style={TD}>
                            {v.estado ? (
                              <Chip
                                texto={v.estadoEtiqueta || v.estado.replace(/_/g, " ")}
                                color="#eda100"
                              />
                            ) : (
                              <Chip texto="MEDIBLE" color="var(--sentinel-live)" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Seccion>

              {home.cobertura?.reconciliacion ? (
                <Seccion
                  icono={ShieldCheck}
                  titulo="Cómo se formó este corpus"
                  nota="Las piezas llegan por tres rutas y se reconcilian: una misma nota vista dos veces es una sola pieza, y dos medios que publican lo mismo siguen siendo dos."
                >
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <Cifra
                      etiqueta="Entradas"
                      m={{ valor: home.cobertura.reconciliacion.entradas, estado: null }}
                    />
                    <Cifra
                      etiqueta="Piezas canónicas"
                      m={{ valor: home.cobertura.reconciliacion.canonicas, estado: null }}
                    />
                    <Cifra
                      etiqueta="Duplicadas fundidas"
                      m={{
                        valor:
                          home.cobertura.reconciliacion.exactDuplicates +
                          home.cobertura.reconciliacion.probableDuplicates,
                        estado: null,
                        nota: "Misma URL o mismo titular en el mismo dominio."
                      }}
                    />
                    <Cifra
                      etiqueta="Republicaciones"
                      m={{
                        valor: home.cobertura.reconciliacion.republications,
                        estado: null,
                        nota: "Mismo titular en otro dominio. NO se funden: son dos publicaciones."
                      }}
                    />
                    <Cifra
                      etiqueta="Excluidas"
                      m={{
                        valor: home.cobertura.reconciliacion.excluidas,
                        estado: null,
                        nota: "Artefactos, plataformas, feeds de comentarios e identidades en conflicto."
                      }}
                    />
                  </div>

                  {home.cobertura.procedencias?.length ? (
                    <div style={{ marginTop: "14px" }}>
                      <div style={ETIQUETA}>Rutas de observación</div>

                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
                        {home.cobertura.procedencias.map((r) => (
                          <Chip
                            key={r.ruta}
                            texto={`${r.ruta.replace(/_/g, " ").toLowerCase()} · ${r.piezas}`}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </Seccion>
              ) : null}

              <Seccion
                icono={AlertTriangle}
                titulo="Lo que esta vista no sabe"
                acento="#eda100"
              >
                <Lista items={home.cobertura?.loQueNoSabemos} />
              </Seccion>

              <Seccion icono={Ban} titulo="Lecturas prohibidas" acento="#eda100">
                <Lista items={home.declaraciones?.equivalenciasProhibidas} />
              </Seccion>
            </>
          ) : null}

          {/*
            -----------------------------------------------------
            RANKING DE PRESENCIA
            -----------------------------------------------------
          */}
          {seccion === "presencia" ? (
            <>
              <Seccion
                icono={Radio}
                titulo={`${home.presencia.titulo || "Presencia mediática observable"} · ${home.presencia.subtitulo || ventanaTexto}`}
                nota={home.presencia.dimension?.definicion}
              >
                <Aviso>
                  <strong>{home.presencia.sinScore}</strong>
                  <br />
                  {home.presencia.noEsRankingDeInfluencia}
                </Aviso>

                {home.presencia.ordenDegradado ? (
                  <Aviso>{home.presencia.motivoOrdenDegradado}</Aviso>
                ) : null}

                <TablaPresencia filas={ranking} ventanaTexto={ventanaTexto} />

                {/*
                  Preparacion de TOP 10/20/50 y de las dimensiones
                  futuras. Los controles se muestran DESACTIVADOS y
                  con su requisito: el corpus actual tiene 10
                  fuentes, asi que ofrecer «Top 50» hoy seria
                  ofrecer una lista que no existe.
                */}
                <div
                  style={{
                    marginTop: "14px",
                    paddingTop: "12px",
                    borderTop: "1px solid var(--sentinel-borde)",
                    display: "flex",
                    gap: "18px",
                    flexWrap: "wrap"
                  }}
                >
                  <div>
                    <div style={ETIQUETA}>Tamaño de la lista</div>

                    <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                      {(home.presencia.tamanosDisponibles || []).map((n) => {
                        const alcanzable = ranking.length >= n;

                        return (
                          <span
                            key={n}
                            title={
                              alcanzable
                                ? `El corpus tiene ${ranking.length} fuentes.`
                                : `El corpus solo tiene ${ranking.length} fuente(s): un Top ${n} mostraría una lista que no existe.`
                            }
                            style={{
                              padding: "4px 10px",
                              borderRadius: "var(--radio-pill)",
                              border: "1px solid var(--sentinel-borde)",
                              color: alcanzable
                                ? "var(--sentinel-texto-suave)"
                                : "var(--sentinel-texto-tenue)",
                              opacity: alcanzable ? 1 : 0.45,
                              fontSize: "0.68rem"
                            }}
                          >
                            Top {n}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div style={ETIQUETA}>Dimensiones</div>

                    <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
                      {(home.presencia.dimensionesFuturas || []).map((d) => (
                        <span
                          key={d.id}
                          title={d.disponible ? "Con datos en este corpus." : d.requiere}
                          style={{
                            padding: "4px 10px",
                            borderRadius: "var(--radio-pill)",
                            border: `1px solid ${
                              d.disponible ? "var(--sentinel-cyan)" : "var(--sentinel-borde)"
                            }`,
                            color: d.disponible
                              ? "#FFFFFF"
                              : "var(--sentinel-texto-tenue)",
                            opacity: d.disponible ? 1 : 0.5,
                            fontSize: "0.68rem",
                            fontWeight: d.disponible ? 650 : 500
                          }}
                        >
                          {d.nombre}
                          {d.disponible ? "" : " · pendiente"}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <Lista items={home.presencia.dimension?.noSignifica} />

                <p
                  style={{
                    marginTop: "10px",
                    fontSize: "0.68rem",
                    color: "var(--sentinel-texto-tenue)",
                    lineHeight: 1.55
                  }}
                >
                  {home.presencia.dimension?.sesgoDeclarado}
                </p>

                {home.presencia.notaMetodologica ? (
                  <div
                    style={{
                      marginTop: "12px",
                      paddingTop: "10px",
                      borderTop: "1px solid var(--sentinel-borde)"
                    }}
                  >
                    <div style={ETIQUETA}>
                      {home.presencia.notaMetodologica.titulo}
                    </div>

                    <p
                      style={{
                        margin: "6px 0 0",
                        fontSize: "0.7rem",
                        color: "var(--sentinel-texto-suave)",
                        lineHeight: 1.6
                      }}
                    >
                      {home.presencia.notaMetodologica.texto}
                    </p>
                  </div>
                ) : null}
              </Seccion>

              {home.presencia.artefactosDeRecoleccion?.length ? (
                <Seccion
                  icono={Filter}
                  titulo="Artefactos de recolección — fuera del ranking"
                  acento="#eda100"
                  nota="Dominios que aparecen en el corpus y no son fuentes que publiquen. Se muestran a propósito: son residuo de nuestro método de recolección, no medios."
                >
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={TH}>Dominio</th>
                        <th style={TH}>Tipo</th>
                        <th style={TH}>Piezas</th>
                        <th style={TH}>Motivo de exclusión</th>
                      </tr>
                    </thead>

                    <tbody>
                      {home.presencia.artefactosDeRecoleccion.map((a) => (
                        <tr key={a.dominio}>
                          <td style={TD}>{a.dominio}</td>
                          <td style={TD}>
                            <Chip texto={a.claseEtiqueta || a.tipoEnCatalogo} color="#eda100" />
                          </td>
                          <td style={TD}>{a.piezasObservadas}</td>
                          <td style={{ ...TD, fontSize: "0.7rem", color: "var(--sentinel-texto-suave)" }}>
                            {a.motivoDeExclusion}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Seccion>
              ) : null}

              <Seccion
                icono={Ban}
                titulo="Incidencia"
                acento="#eda100"
                nota={home.incidencia.definicion}
              >
                <Chip
                  texto={
                    home.incidencia.estadoEtiqueta ||
                    home.incidencia.estado?.replace(/_/g, " ")
                  }
                  color="#eda100"
                />

                <p
                  style={{
                    margin: "10px 0 0",
                    fontSize: "0.74rem",
                    color: "var(--sentinel-texto-suave)",
                    lineHeight: 1.6
                  }}
                >
                  {home.incidencia.motivo}
                </p>

                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: "0.72rem",
                    color: "var(--sentinel-texto-tenue)",
                    lineHeight: 1.6
                  }}
                >
                  {home.incidencia.porQueNoHoy}
                </p>

                <div style={{ marginTop: "10px", ...ETIQUETA }}>
                  Requisitos para poder calcularla
                </div>

                <Lista items={home.incidencia.requisitos} />

                <Lista items={home.incidencia.prohibido} />
              </Seccion>
            </>
          ) : null}

          {/*
            -----------------------------------------------------
            MEDIOS
            -----------------------------------------------------
          */}
          {seccion === "medios" ? (
            <Seccion
              icono={Newspaper}
              titulo={`Medios · ${ventanaTexto}`}
              nota="Fuentes clasificadas como MEDIO por el catálogo de medios. La clasificación sale del catálogo, nunca del volumen de publicación: haber publicado sobre el territorio no convierte a un medio en local."
            >
              <TablaPresencia
                filas={ranking.filter((f) => f.grupo === "MEDIO")}
                ventanaTexto={ventanaTexto}
              />

              {/*
                UNIVERSO DE MEDIOS — ya con backend real desde
                MEDIA-SOURCE-UNIVERSE-01. El botón dejó de ser una
                promesa: guarda de verdad, y lo que guarda entra
                DECLARADO y sin verificar.
              */}
              <div
                style={{
                  marginTop: "16px",
                  paddingTop: "14px",
                  borderTop: "1px solid var(--sentinel-borde)"
                }}
              >
                <UniversoDeMedios
                  universo={universo}
                  onDeclararMedio={onDeclararMedio}
                />
              </div>
            </Seccion>
          ) : null}

          {/*
            -----------------------------------------------------
            PERIODISTAS
            -----------------------------------------------------
          */}
          {seccion === "periodistas" ? (
            <Seccion
              icono={UserSquare2}
              titulo={`Periodistas · ${ventanaTexto}`}
              nota="Firmas que las piezas publican en metadata legible. Ninguna se deduce del texto."
            >
              <Cifra etiqueta="Periodistas identificados" m={home.resumen.periodistas} />

              <div style={{ marginTop: "14px" }}>
                {ranking.some((f) => f.autores?.length) ? (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={TH}>Firma</th>
                        <th style={TH}>Fuente</th>
                        <th style={TH}>Clase de la fuente</th>
                      </tr>
                    </thead>

                    <tbody>
                      {ranking.flatMap((f) =>
                        (f.autores || []).map((a) => (
                          <tr key={`${f.dominio}-${a}`}>
                            <td style={{ ...TD, fontWeight: 650 }}>{a}</td>
                            <td style={TD}>{f.nombre}</td>
                            <td style={TD}>
                              <Chip texto={f.claseEtiqueta || f.clase} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ fontSize: "0.76rem", color: "var(--sentinel-texto-tenue)" }}>
                    Ninguna pieza del corpus trae autoría en metadata legible.
                  </p>
                )}
              </div>
            </Seccion>
          ) : null}

          {/*
            -----------------------------------------------------
            CREADORES
            -----------------------------------------------------
          */}
          {seccion === "creadores" ? (
            <>
              <Seccion
                icono={Sparkles}
                titulo={`Creadores · ${ventanaTexto}`}
                nota="Cuentas con evidencia de ser creador. Una cuenta identificada sin esa evidencia NO se asciende por volumen ni por número de seguidores."
              >
                <TablaPresencia
                  filas={ranking.filter((f) => f.grupo === "CREADOR")}
                  ventanaTexto={ventanaTexto}
                />
              </Seccion>

              <Seccion
                icono={AlertTriangle}
                titulo="Fuentes sin clasificar"
                acento="#eda100"
                nota="La fuente está identificada y ninguna evidencia dice QUÉ es. Es un resultado, no un fallo, y alguna de estas podría ser un creador."
              >
                <TablaPresencia
                  filas={ranking.filter(
                    (f) => f.grupo === "NO_CLASIFICADO" || f.grupo === "CUENTA"
                  )}
                  ventanaTexto={ventanaTexto}
                />
              </Seccion>
            </>
          ) : null}

          {/*
            -----------------------------------------------------
            HISTORIAS / TEMAS
            -----------------------------------------------------
          */}
          {seccion === "historias" ? (
            <Seccion
              icono={Tag}
              titulo={`Historias y temas · ${ventanaTexto}`}
              nota="Los temas se derivan de los titulares persistidos con el mismo Topic Engine que usa la línea territorial. No hay motor de temas propio."
            >
              {home.historias.estado ? (
                <Aviso>
                  <Chip
                    texto={
                      home.historias.estadoEtiqueta ||
                      home.historias.estado.replace(/_/g, " ")
                    }
                    color="#eda100"
                  />
                  <div style={{ marginTop: "8px" }}>{home.historias.motivo}</div>
                </Aviso>
              ) : null}

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "12px" }}>
                <Cifra
                  etiqueta="Piezas con titular"
                  m={{ valor: home.historias.piezasConTitular, estado: null }}
                />

                <Cifra
                  etiqueta="Amplificación sin titular"
                  m={{
                    valor: home.historias.piezasDeAmplificacionSinTitular,
                    estado: null,
                    nota: "Una pieza sin titular no aporta tema: el motor agrupa por coocurrencia de términos."
                  }}
                />
              </div>

              {home.historias.temas?.length ? (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={TH}>Tema</th>
                      <th style={TH}>Piezas</th>
                      <th style={TH}>Fuentes</th>
                      <th style={TH}>Términos</th>
                    </tr>
                  </thead>

                  <tbody>
                    {home.historias.temas.map((t) => (
                      <tr key={t.topicId}>
                        <td style={{ ...TD, fontWeight: 650 }}>{t.nombre || t.topicId}</td>
                        <td style={TD}>{t.piezas}</td>
                        <td style={TD}>{t.fuentes ?? "—"}</td>
                        <td style={{ ...TD, fontSize: "0.7rem" }}>
                          {(t.terminos || []).join(", ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}

              <div style={{ marginTop: "16px" }}>
                <div style={ETIQUETA}>
                  Entidades nombradas — no son temas
                </div>

                <p
                  style={{
                    margin: "6px 0 10px",
                    fontSize: "0.72rem",
                    color: "var(--sentinel-texto-tenue)",
                    lineHeight: 1.55
                  }}
                >
                  {home.historias.entidadesNoSonTemas}
                </p>

                {home.historias.entidades?.length ? (
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {home.historias.entidades.map((e) => (
                      <Chip key={e.entidad} texto={`${e.entidad} · ${e.piezas}`} />
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: "0.74rem", color: "var(--sentinel-texto-tenue)" }}>
                    Ninguna entidad extraíble del corpus actual.
                  </p>
                )}
              </div>

              <Lista items={home.historias.prohibido} />
            </Seccion>
          ) : null}

          {/*
            -----------------------------------------------------
            AMPLIFICACION
            -----------------------------------------------------
          */}
          {seccion === "amplificacion" ? (
            <Seccion
              icono={Network}
              titulo={`Amplificación observada · ${ventanaTexto}`}
              nota={home.amplificacion.dimension?.definicion}
            >
              <Aviso>{home.amplificacion.noSeSuman}</Aviso>

              {/*
                Las tres magnitudes en la MISMA fila y con la frase
                que las separa arriba. Separarlas en tarjetas
                distantes invitaria a sumarlas.
              */}
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <Cifra etiqueta="Piezas relacionadas" m={home.amplificacion.piezasRelacionadas} />
                <Cifra etiqueta="Piezas · corpus" m={home.amplificacion.piezasRelacionadasEnCorpus} />
                <Cifra etiqueta="Fuentes distintas" m={home.amplificacion.fuentesDistintas} />
                <Cifra etiqueta="Contenidos relacionados" m={home.amplificacion.contenidosRelacionados} />
              </div>

              <div style={{ marginTop: "16px" }}>
                <div style={ETIQUETA}>Rol de cada pieza frente a la analizada</div>

                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "8px" }}>
                  <thead>
                    <tr>
                      <th style={TH}>Rol</th>
                      <th style={TH}>Piezas</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(home.amplificacion.porRol || []).map((r) => (
                      <tr key={r.rol}>
                        <td style={TD}>
                          <Chip
                            texto={r.rol}
                            color={
                              r.rol === "COBERTURA_RELACIONADA"
                                ? "var(--sentinel-texto-suave)"
                                : undefined
                            }
                          />
                        </td>
                        <td style={TD}>{r.piezas}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <p
                  style={{
                    margin: "10px 0 0",
                    fontSize: "0.72rem",
                    color: "var(--sentinel-texto-suave)",
                    lineHeight: 1.6
                  }}
                >
                  {home.amplificacion.porQueRolPorDefecto}
                </p>
              </div>

              <Lista items={home.amplificacion.noAfirma} />

              <div style={{ marginTop: "16px" }}>
                <div style={ETIQUETA}>Fuentes en la amplificación</div>

                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
                  {(home.amplificacion.fuentes || []).map((f) => (
                    <Chip key={f} texto={f} />
                  ))}
                </div>
              </div>
            </Seccion>
          ) : null}

          {/*
            -----------------------------------------------------
            CANDIDATOS x MEDIOS — visible en resumen y presencia
            -----------------------------------------------------
          */}
          {["resumen", "presencia", "medios"].includes(seccion) ? (
            <Seccion
              icono={UserSquare2}
              titulo="Candidatos × medios"
              nota={home.candidatosPorFuente.esPresenciaMediatica}
            >
              <Aviso>
                {home.candidatosPorFuente.noSignifica.join(" ")}
                {home.candidatosPorFuente.advertenciaDeArista ? (
                  <div style={{ marginTop: "8px" }}>
                    {home.candidatosPorFuente.advertenciaDeArista}
                  </div>
                ) : null}
              </Aviso>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "760px" }}>
                  <thead>
                    <tr>
                      <th style={TH}>Candidato</th>
                      <th style={TH}>Fuentes distintas</th>
                      <th style={TH}>Piezas</th>
                      <th style={TH}>Evidencias directas</th>
                      <th style={TH}>Temas asociados</th>
                      <th style={TH}>Principales fuentes observadas</th>
                      <th style={TH}>Última observación</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(home.candidatosPorFuente.filas || []).map((c) => (
                      <tr key={c.candidateId}>
                        <td style={{ ...TD, fontWeight: 650 }}>
                          {c.nombre || c.candidateId}

                          {c.nombre && c.nombre !== c.candidateId ? (
                            <div
                              style={{
                                fontSize: "0.62rem",
                                fontWeight: 400,
                                color: "var(--sentinel-texto-tenue)",
                                marginTop: "2px"
                              }}
                            >
                              {c.candidateId}
                            </div>
                          ) : null}
                        </td>
                        <td style={TD}>
                          <CeldaCifra m={c.fuentesDistintas} />
                        </td>
                        <td style={TD}>
                          <CeldaCifra m={c.piezasObservadas} />
                        </td>
                        <td style={TD}>
                          <CeldaCifra m={c.evidenciasDirectas} />
                        </td>
                        <td style={TD}>
                          <CeldaCifra m={c.temasAsociados} />
                        </td>
                        <td style={{ ...TD, fontSize: "0.7rem", maxWidth: "300px" }}>
                          {c.principalesFuentes.length
                            ? c.principalesFuentes.join(", ")
                            : "—"}

                          {c.artefactosDeRecoleccion?.length ? (
                            <div
                              style={{
                                marginTop: "5px",
                                fontSize: "0.62rem",
                                color: "#eda100",
                                lineHeight: 1.5
                              }}
                            >
                              + {c.artefactosDeRecoleccion.length} artefacto(s) de
                              recolección, contados aparte:{" "}
                              {c.artefactosDeRecoleccion.join(", ")}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ ...TD, whiteSpace: "nowrap", color: "var(--sentinel-texto-suave)" }}>
                          {fechaCorta(c.ultimaObservacion)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Seccion>
          ) : null}

          {/*
            -----------------------------------------------------
            FUENTES / EVIDENCIAS
            -----------------------------------------------------
          */}
          {seccion === "fuentes" ? (
            <>
              <Seccion
                icono={ShieldCheck}
                titulo="Fuentes y evidencias"
                nota={home.fuentes.declaracion}
              >
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <Cifra etiqueta="Evidencias distintas" m={home.fuentes.evidenciasDistintas} />
                  <Cifra etiqueta="Snapshots guardados" m={home.fuentes.snapshots} />

                  <Cifra
                    etiqueta="Consultas web declaradas"
                    m={{
                      valor: home.fuentes.consumoAcumuladoDeclarado.consultasWeb,
                      estado: null,
                      nota: home.fuentes.consumoAcumuladoDeclarado.nota
                    }}
                  />
                </div>

                <div style={{ marginTop: "16px" }}>
                  <div style={ETIQUETA}>Proveedores que sostienen estas cifras</div>

                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
                    {(home.fuentes.proveedores || []).map((p) => (
                      <Chip
                        key={p.proveedor}
                        texto={`${p.proveedor} · ${p.apariciones}`}
                        color="var(--sentinel-cyan)"
                      />
                    ))}
                  </div>
                </div>
              </Seccion>

              <Seccion
                icono={Link2}
                titulo="Trazabilidad de las piezas analizadas"
                nota="De dónde salió cada dato: pieza, fuente, evidencia, fecha y procedencia del emisor."
              >
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
                    <thead>
                      <tr>
                        <th style={TH}>Fuente</th>
                        <th style={TH}>URL canónica</th>
                        <th style={TH}>Plataforma</th>
                        <th style={TH}>Publicada</th>
                        <th style={TH}>Observada</th>
                        <th style={TH}>evidenceId</th>
                        <th style={TH}>Procedencia del emisor</th>
                      </tr>
                    </thead>

                    <tbody>
                      {(home.fuentes.trazabilidad || []).map((t) => (
                        <tr key={t.evidenceId || t.canonicalUrl}>
                          <td style={TD}>{t.fuente}</td>

                          <td style={{ ...TD, fontSize: "0.68rem", maxWidth: "300px", wordBreak: "break-all" }}>
                            <a
                              href={/^https?:\/\//i.test(t.canonicalUrl) ? t.canonicalUrl : `https://${t.canonicalUrl}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: "var(--sentinel-cyan)" }}
                            >
                              {t.canonicalUrl}
                            </a>
                          </td>

                          <td style={TD}>{t.plataforma || "—"}</td>

                          <td style={TD}>
                            {t.fechaPublicacion ? (
                              fechaCorta(t.fechaPublicacion)
                            ) : (
                              <span title={`Valor en la fila: ${t.fechaPublicacionBruta || "ninguno"}`}>
                                <Chip
                                  texto={
                                    t.fechaPublicacionEstadoEtiqueta ||
                                    (t.fechaPublicacionEstado || "SIN EVIDENCIA").replace(/_/g, " ")
                                  }
                                  color="#eda100"
                                />
                              </span>
                            )}
                          </td>

                          <td style={{ ...TD, whiteSpace: "nowrap" }}>{fechaCorta(t.observadaEn)}</td>

                          <td style={{ ...TD, fontSize: "0.66rem", color: "var(--sentinel-texto-tenue)" }}>
                            {t.evidenceId}
                          </td>

                          <td style={{ ...TD, fontSize: "0.68rem" }}>
                            {t.procedenciaDelEmisor || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Seccion>

              <Seccion
                icono={ShieldCheck}
                titulo="Aislamiento del proyecto"
                nota={home.aislamiento.declaracion}
              >
                <div style={{ fontSize: "0.73rem", color: "var(--sentinel-texto-suave)", lineHeight: 1.6 }}>
                  Proyectos con datos de Media en el Lake:{" "}
                  {home.aislamiento.proyectosDeMediaEnLake.join(", ")}
                  <br />
                  Filas de otros proyectos excluidas:{" "}
                  <strong>{home.aislamiento.filasDeOtrosProyectosExcluidas}</strong>
                  <br />
                  {home.cobertura?.declaracion}
                </div>
              </Seccion>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}


/*
===========================================================
EL CONTENEDOR — estado y datos
===========================================================
*/
export default function MediaIntelligenceModule() {
  const [proyectos, setProyectos] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [ventana, setVentana] = useState("90d");
  const [seccion, setSeccion] = useState("resumen");

  const [home, setHome] = useState(null);
  const [universo, setUniverso] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  /* Proyectos activos. Media Intelligence no existe sin uno. */
  useEffect(() => {
    let vivo = true;

    (async () => {
      try {
        const r = await fetch(`${BACKEND}/api/projects/`);

        const j = await r.json();

        if (!vivo) return;

        const lista = j?.proyectos || [];

        setProyectos(lista);

        /*
          No se elige por nombre ni se codifica ningun proyecto:
          se toma el primero de la lista si el analista no ha
          elegido. Con otro proyecto sale otro corpus.
        */
        setProjectId((actual) => actual || lista[0]?.id || "");
      } catch (e) {
        if (vivo) setError(`No se pudieron listar los proyectos: ${e.message}`);
      }
    })();

    return () => {
      vivo = false;
    };
  }, []);

  const cargar = useCallback(async () => {
    if (!projectId) return;

    setCargando(true);
    setError(null);

    try {
      const r = await fetch(
        `${BACKEND}/api/media/${encodeURIComponent(projectId)}/home?ventana=${encodeURIComponent(ventana)}`
      );

      const j = await r.json();

      if (!r.ok || j?.ok === false) {
        setHome(null);

        setError(j?.motivo || `El backend respondió ${r.status}.`);

        return;
      }

      setHome(j);

      /*
        El universo se pide en paralelo y su fallo NO tumba la
        HOME: son dos preguntas distintas y una pantalla sin
        universo sigue siendo util.
      */
      try {
        const ru = await fetch(
          `${BACKEND}/api/media/${encodeURIComponent(projectId)}/universo`
        );

        const ju = await ru.json();

        setUniverso(ru.ok && ju?.ok !== false ? ju : null);
      } catch {
        setUniverso(null);
      }
    } catch (e) {
      setHome(null);

      setError(`No se pudo leer Media Intelligence: ${e.message}`);
    } finally {
      setCargando(false);
    }
  }, [projectId, ventana]);


  /*
    Declarar un medio. Devuelve el resultado al formulario en
    lugar de manejar el aviso aqui: el contenedor no deberia
    saber como se presenta un error.
  */
  const declararMedio = useCallback(
    async (datos) => {
      try {
        const r = await fetch(
          `${BACKEND}/api/media/${encodeURIComponent(projectId)}/universo`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datos)
          }
        );

        const j = await r.json();

        if (r.ok && j?.ok) await cargar();

        return j;
      } catch (e) {
        return { ok: false, motivo: e.message };
      }
    },
    [projectId, cargar]
  );

  useEffect(() => {
    /* La sección «analizar» no necesita la HOME. */
    if (seccion === "analizar") return undefined;

    /*
      La carga se AGENDA en lugar de lanzarse dentro del efecto.

      Dos razones, y ninguna es cosmética: llamar a `cargar()`
      aquí pone `setCargando(true)` en el cuerpo sincrónico del
      efecto y provoca un render en cascada, y además cambiar de
      proyecto y de ventana seguido disparaba dos lecturas del
      Lake de las que solo la última importa. Con el temporizador,
      el `clearTimeout` del cleanup cancela la primera.
    */
    const temporizador = setTimeout(cargar, 0);

    return () => clearTimeout(temporizador);
  }, [cargar, seccion]);

  const proyecto = useMemo(
    () => proyectos.find((p) => p.id === projectId) || null,
    [proyectos, projectId]
  );

  return (
    <MediaIntelligenceVista
      proyectos={proyectos}
      projectId={projectId}
      proyecto={proyecto}
      ventana={ventana}
      seccion={seccion}
      home={home}
      universo={universo}
      cargando={cargando}
      error={error}
      onProyecto={setProjectId}
      onVentana={setVentana}
      onSeccion={setSeccion}
      onRecargar={cargar}
      onDeclararMedio={declararMedio}
    />
  );
}