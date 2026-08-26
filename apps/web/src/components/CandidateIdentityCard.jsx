import { useState } from "react";
/*
  Los iconos de marca (Facebook, Instagram, Twitter…) se
  retiraron de lucide-react por motivos de licencia de marca. Se
  usan iconos genericos que describen la NATURALEZA de cada
  plataforma; el nombre de la plataforma va escrito al lado, que
  es lo que de verdad la identifica.
*/
import {
  Users,
  Camera,
  AtSign,
  Music2,
  PlaySquare,
  Briefcase,
  Globe,
  ExternalLink,
  Pencil,
  RefreshCw,
  FolderOpen,
  Activity,
  Image as ImageIcon,
  Info,
  Loader2
} from "lucide-react";

import CandidatePhoto from "./CandidatePhoto";
import {
  estadoVisual,
  procedencia,
  procedenciaFoto,
  METRICA,
  nivelSolidez,
  textoPrimeraObservacion,
  textoUltimaVerificacion
} from "../services/identidadCandidato";

/*
===========================================================
FICHA DE IDENTIDAD DEL CANDIDATO — P-CAND-UX-01
===========================================================

QUE CAMBIA RESPECTO A LA TARJETA ANTERIOR

La tarjeta decia «42 %, 2 cuentas» y nada mas. Con eso el
analista no podia ver que Instagram se habia hallado el dia
anterior y hoy no, que ocho de catorce consultas no obtuvieron
respuesta, ni por que se habia rechazado un candidato de TikFok.
Todo eso ya estaba persistido; solo faltaba mostrarlo.

Ahora se ven LAS SIETE plataformas, tambien las vacias, cada una
con su estado y su procedencia. Nada queda detras de un
«+3 cuentas»: si hay tres cuentas, se ven las tres.

LAS DOS DISTINCIONES QUE LA FICHA NO PUEDE PERDER

  declarada por el analista   vs   corroborada por Sentinel
  no reencontrada             vs   no existe

La primera es de procedencia y las dos pueden ser verdad a la
vez. La segunda es la diferencia entre una limitacion nuestra y
una afirmacion sobre una persona.
===========================================================
*/

const ICONOS = {
  facebook: Users,
  instagram: Camera,
  x: AtSign,
  tiktok: Music2,
  youtube: PlaySquare,
  linkedin: Briefcase,
  web: Globe
};

/*
  Los tonos se traducen a los colores que ya usa el sistema. No
  se inventa ninguno.
*/
const TONOS = {
  verde: "#22C55E",
  azul: "#0B5FFF",
  ambar: "#F59E0B",
  gris: "var(--sentinel-texto-tenue)",
  rojo: "#EF4444"
};

const color = (tono) => TONOS[tono] || TONOS.gris;

const pill = (tono) => ({
  color: color(tono),
  border: `1px solid ${color(tono)}`,
  borderRadius: "var(--radio-pill)",
  padding: "2px 9px",
  fontSize: "10px",
  whiteSpace: "nowrap"
});

const caja = {
  background: "var(--sentinel-surface)",
  border: "1px solid var(--sentinel-borde)",
  borderRadius: "var(--radio-m)",
  padding: "14px 16px"
};


/*
-----------------------------------------------------------
UNA CUENTA
-----------------------------------------------------------
*/
function Cuenta({ cuenta, proyecto }) {
  const v = estadoVisual(cuenta.estado);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        padding: "9px 0",
        borderTop: "1px solid var(--sentinel-borde)",
        flexWrap: "wrap"
      }}
    >
      <div style={{ minWidth: 0, flex: "1 1 260px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <strong style={{ color: "#FFFFFF", fontSize: "12.5px" }}>
            {cuenta.handle ? `@${cuenta.handle}` : cuenta.url}
          </strong>

          <span style={pill(v.tono)} title={v.explicacion || undefined}>
            {v.etiqueta}
          </span>

          {cuenta.correspondencia != null && (
            <span
              style={{
                color: "var(--sentinel-texto-tenue)",
                fontFamily: "monospace",
                fontSize: "11px"
              }}
              title="Correspondencia con el objetivo. No es un porcentaje de certeza."
            >
              corr. {cuenta.correspondencia}
            </span>
          )}
        </div>

        <div
          style={{
            color: "var(--sentinel-texto-suave)",
            fontSize: "10.5px",
            marginTop: "4px",
            lineHeight: 1.7
          }}
        >
          {/* PROCEDENCIA. Las dos pueden aparecer juntas. */}
          {procedencia(cuenta)}

          <br />

          {textoUltimaVerificacion(cuenta, proyecto)}

          <br />

          {/*
            BUG-20: si el historial previo esta incompleto NO se
            escribe una fecha de primera observacion, porque seria
            inventada.
          */}
          {textoPrimeraObservacion(cuenta, proyecto)}

          {(cuenta.proveedoresHistoricos || []).length > 0 && (
            <>
              <br />
              {`observada por: ${cuenta.proveedoresHistoricos.join(", ")}`}
              {(cuenta.proveedoresUltimaObservacion || []).length === 0 &&
                " — ninguno la devolvió en la última verificación"}
            </>
          )}

          {cuenta.noCuentaComoCorroboracion && (
            <>
              <br />
              <em style={{ fontStyle: "normal", color: "#F59E0B" }}>
                No cuenta como corroboración: la aportó una persona.
              </em>
            </>
          )}
        </div>
      </div>

      <a
        href={cuenta.url}
        target="_blank"
        rel="noreferrer"
        className="sentinel-boton"
        style={{
          padding: "5px 11px",
          fontSize: "10.5px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          textDecoration: "none"
        }}
      >
        <ExternalLink size={11} /> Abrir
      </a>
    </div>
  );
}


/*
-----------------------------------------------------------
UNA PLATAFORMA — se muestra tambien si esta vacia
-----------------------------------------------------------
*/
function Plataforma({ p, proyecto }) {
  const Icono = ICONOS[p.plataformaId] || Globe;

  const v = estadoVisual(p.estado);

  return (
    <div style={{ ...caja, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <Icono size={16} color="var(--sentinel-cyan)" />

        <strong style={{ color: "#FFFFFF", fontSize: "13px" }}>{p.plataforma}</strong>

        {p.total === 0 && (
          <span style={pill(v.tono)} title={v.explicacion || undefined}>
            {v.etiqueta}
          </span>
        )}

        {p.total > 1 && (
          <span
            style={{ color: "var(--sentinel-texto-tenue)", fontSize: "10.5px" }}
          >
            {p.total} cuentas
          </span>
        )}
      </div>

      {p.total === 0 ? (
        <div
          style={{
            color: "var(--sentinel-texto-tenue)",
            fontSize: "10.5px",
            marginTop: "7px",
            lineHeight: 1.7
          }}
        >
          {/*
            No se escribe «no tiene cuenta». Sentinel declara lo
            que observo, y aqui no observo nada.
          */}
          {v.explicacion}
        </div>
      ) : (
        p.cuentas.map((c) => (
          <Cuenta key={`${c.plataformaId}:${c.handle || c.url}`} cuenta={c} proyecto={proyecto} />
        ))
      )}
    </div>
  );
}


/*
-----------------------------------------------------------
LA METRICA DEL EXPEDIENTE

Antes se pintaba en rojo cuando era baja, y un numero rojo junto
al nombre de un candidato se lee como un juicio. Un expediente
poco documentado no es «malo»: es poco documentado. La escala es
neutra a proposito.
-----------------------------------------------------------
*/
function Solidez({ valor, componentes }) {
  const [abierto, setAbierto] = useState(false);

  if (valor == null) return null;

  const n = nivelSolidez(valor);

  return (
    <div style={{ position: "relative" }}>
      <button
        className="sentinel-boton"
        onClick={() => setAbierto((x) => !x)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "5px 12px",
          fontSize: "11px",
          borderColor: color(n.tono)
        }}
        title={METRICA.aclaracion}
      >
        <span style={{ color: "var(--sentinel-texto-suave)" }}>
          {METRICA.nombre}
        </span>

        <span
          style={{ color: color(n.tono), fontFamily: "monospace", fontSize: "14px" }}
        >
          {valor}/100
        </span>

        <Info size={11} />
      </button>

      {abierto && (
        <div
          className="sentinel-fade"
          style={{
            position: "absolute",
            zIndex: 40,
            top: "38px",
            left: 0,
            width: "min(360px, 80vw)",
            background: "var(--sentinel-primary)",
            border: "1px solid var(--sentinel-borde-vivo)",
            borderRadius: "var(--radio-m)",
            padding: "13px 15px",
            boxShadow: "0 12px 28px rgba(0,0,0,.45)"
          }}
        >
          <div
            style={{
              color: "#FFFFFF",
              fontSize: "12px",
              marginBottom: "8px"
            }}
          >
            {METRICA.nombre} — {n.etiqueta}
          </div>

          <div
            style={{
              color: "var(--sentinel-texto-suave)",
              fontSize: "11px",
              lineHeight: 1.75,
              marginBottom: "10px"
            }}
          >
            {METRICA.aclaracion}
          </div>

          <div style={{ color: "var(--sentinel-texto-tenue)", fontSize: "10.5px" }}>
            {(componentes && componentes.length
              ? componentes.map((c) => `${c.nombre} ${c.valor}/${c.maximo}`)
              : METRICA.componentes
            ).map((linea) => (
              <div key={linea} style={{ marginTop: "3px" }}>
                · {linea}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


/*
===========================================================
LA FICHA
===========================================================
*/
export default function CandidateIdentityCard({
  ficha,
  proyecto,
  solidez,
  componentesSolidez,
  onEditar,
  onComprobar,
  onExpediente,
  onObtenerFoto,
  onAnalizar,
  fotoIntentos,
  ocupado,
  ocupadoFoto,
  ocupadoAnalisis
}) {
  if (!ficha) return null;

  const m = ficha.metricas || {};

  return (
    <div style={{ ...caja, padding: "18px 20px" }}>
      {/* ---- CABECERA: foto, nombre, alias, contexto ---- */}

      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        {/*
          Nunca una URL de cuenta como `src`, y nunca el icono
          roto del navegador. Ver CandidatePhoto.
        */}
        <CandidatePhoto
          foto={ficha.foto?.utilizable ? ficha.foto : null}
          nombre={ficha.nombre}
          tamano={74}
        />

        <div style={{ minWidth: 0, flex: "1 1 260px" }}>
          <div style={{ color: "#FFFFFF", fontSize: "17px", fontWeight: 600 }}>
            {ficha.nombre}
          </div>

          {ficha.aliases?.length > 0 && (
            <div
              style={{
                color: "var(--sentinel-texto-suave)",
                fontSize: "11px",
                marginTop: "4px"
              }}
            >
              también: {ficha.aliases.map((a) => a.valor || a).join(" · ")}
              <em
                style={{
                  fontStyle: "normal",
                  color: "var(--sentinel-texto-tenue)",
                  marginLeft: "6px"
                }}
              >
                (declarados por el analista)
              </em>
            </div>
          )}

          <div
            style={{
              color: "var(--sentinel-cyan)",
              fontSize: "11px",
              marginTop: "5px"
            }}
          >
            {[proyecto?.nombre, ficha.dignidad || proyecto?.dignidad]
              .filter(Boolean)
              .join(" · ")}
            {proyecto &&
              ` — ${[proyecto.canton, proyecto.provincia, proyecto.pais]
                .filter(Boolean)
                .join(", ")}`}
          </div>

          {(ficha.foto || ficha.fotoSugerida) && (
            <div
              style={{
                color: "var(--sentinel-texto-tenue)",
                fontSize: "10px",
                marginTop: "5px",
                lineHeight: 1.6
              }}
            >
              {/*
                No se llama «foto oficial» a una imagen solo por
                haberla encontrado: se dice de donde salio y si
                esta verificada, que son dos cosas distintas.
              */}
              {ficha.foto?.utilizable
                ? procedenciaFoto(ficha.foto)
                : ficha.fotoSugerida
                  ? `sugerida: ${procedenciaFoto(ficha.fotoSugerida)}`
                  : "sin fotografía"}

              {/*
                Si hay una URL guardada que no es una imagen, se
                dice por que no se muestra. Un hueco sin
                explicacion parece un fallo del sistema.
              */}
              {ficha.foto?.url && !ficha.foto.utilizable && (
                <>
                  <br />
                  <em style={{ fontStyle: "normal", color: "#F59E0B" }}>
                    La fotografía guardada no se puede mostrar:{" "}
                    {ficha.foto.motivoNoUtilizable}
                  </em>
                </>
              )}

              {ficha.foto?.intentoRechazado && (
                <>
                  <br />
                  <em style={{ fontStyle: "normal", color: "#F59E0B" }}>
                    El último enlace indicado no se usó: {ficha.foto.intentoRechazado.motivo}
                  </em>
                </>
              )}

              {ficha.foto?.historial?.length > 0 && (
                <>
                  <br />
                  {`${ficha.foto.historial.length} fotografía(s) anterior(es) conservada(s)`}
                </>
              )}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            alignItems: "flex-end"
          }}
        >
          <Solidez valor={solidez} componentes={componentesSolidez} />

          {onObtenerFoto && (
            <button
              className="sentinel-boton"
              onClick={onObtenerFoto}
              disabled={ocupadoFoto}
              title="Lee la metadata publica de las cuentas declaradas para intentar obtener una imagen. Sin login y sin scraping."
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "5px 11px",
                fontSize: "10.5px"
              }}
            >
              {ocupadoFoto ? <Loader2 size={11} /> : <ImageIcon size={11} />}
              {ocupadoFoto ? "Buscando foto…" : "Obtener foto desde fuentes"}
            </button>
          )}
        </div>
      </div>

      {/* ---- RESUMEN DE IDENTIDAD ---- */}

      <div
        style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          margin: "14px 0 4px 0"
        }}
      >
        <span style={pill("verde")}>{m.consolidadas || 0} consolidadas</span>
        <span style={pill("azul")}>{m.declaradas || 0} declaradas</span>
        <span style={pill("verde")}>{m.corroboradas || 0} corroboradas</span>

        {m.noReencontradas > 0 && (
          <span style={pill("ambar")}>
            {m.noReencontradas} no reencontrada(s) en la última verificación
          </span>
        )}

        {m.plataformasPendientes > 0 && (
          <span style={pill("gris")}>
            {m.plataformasPendientes} plataforma(s) sin cuenta atribuida
          </span>
        )}
      </div>

      {/* ---- ACCIONES ---- */}

      <div style={{ display: "flex", gap: "9px", flexWrap: "wrap", margin: "12px 0" }}>
        <button
          className="sentinel-boton sentinel-boton-primario"
          onClick={onEditar}
          style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "11px" }}
        >
          <Pencil size={12} /> Editar identidad
        </button>

        <button
          className="sentinel-boton"
          onClick={onComprobar}
          disabled={ocupado}
          title="Reverifica las cuentas consolidadas y busca en las plataformas que faltan. No borra ninguna cuenta ya atribuida. Consume cuota de proveedores."
          style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "11px" }}
        >
          {ocupado ? <Loader2 size={12} /> : <RefreshCw size={12} />}
          {ocupado ? "Comprobando…" : "Comprobar redes"}
        </button>

        <button
          className="sentinel-boton"
          onClick={onExpediente}
          style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "11px" }}
        >
          <FolderOpen size={12} /> Abrir expediente
        </button>

        <button
          className="sentinel-boton"
          onClick={onAnalizar}
          disabled={!onAnalizar || ocupadoAnalisis}
          title="Account Intelligence: que se puede observar en estas cuentas, con su traza y sus limites. Abrirlo no sale a la red."
          style={{
            display: "flex",
            alignItems: "center",
            gap: "7px",
            fontSize: "11px",
            opacity: onAnalizar ? 1 : 0.45,
            cursor: onAnalizar ? "pointer" : "not-allowed"
          }}
        >
          {ocupadoAnalisis ? <Loader2 size={12} /> : <Activity size={12} />}
          Analizar actividad
        </button>
      </div>

      {/*
        INTENTOS DE OBTENCION DE FOTOGRAFIA. No se ocultan los
        fallos: el analista tiene que poder ver que fuente se
        probo y por que no dio imagen.
      */}
      {fotoIntentos?.length > 0 && (
        <div style={{ ...caja, marginBottom: "10px" }}>
          <strong style={{ color: "#FFFFFF", fontSize: "11.5px" }}>
            Intentos de obtencion de fotografia
          </strong>

          {fotoIntentos.map((i, n) => (
            <div
              key={`${i.plataformaId}-${n}`}
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "baseline",
                flexWrap: "wrap",
                marginTop: "7px"
              }}
            >
              <span style={pill(i.resultado === "RESUELTA" ? "verde" : "ambar")}>
                {i.resultado}
              </span>

              <span style={{ color: "var(--sentinel-texto)", fontSize: "10.5px" }}>
                {i.plataforma || i.plataformaId}
              </span>

              <span
                style={{
                  color: "var(--sentinel-texto-tenue)",
                  fontSize: "9.5px",
                  flex: "1 1 200px"
                }}
              >
                {i.metadataKey ? `${i.metadataKey} · ` : ""}
                {i.motivo || (i.imageUrl ? "imagen obtenida" : "")}
                {i.httpStatus ? ` · HTTP ${i.httpStatus}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ---- LAS SIETE PLATAFORMAS ---- */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "10px",
          marginTop: "6px"
        }}
      >
        {(ficha.plataformas || []).map((p) => (
          <Plataforma key={p.plataformaId} p={p} proyecto={proyecto} />
        ))}
      </div>

      {ficha.otras?.length > 0 && (
        <div style={{ ...caja, marginTop: "10px" }}>
          <strong style={{ color: "#FFFFFF", fontSize: "12.5px" }}>
            Otras URLs relevantes
          </strong>

          {ficha.otras.map((c) => (
            <Cuenta key={c.url} cuenta={c} proyecto={proyecto} />
          ))}
        </div>
      )}

      <div
        style={{
          color: "var(--sentinel-texto-tenue)",
          fontSize: "10px",
          marginTop: "12px",
          lineHeight: 1.7
        }}
      >
        Una plataforma sin cuenta atribuida no afirma que el candidato no la
        use: afirma que Sentinel no ha encontrado ninguna. Ningún perfil se
        leyó desde su plataforma; toda presencia se infiere de búsqueda
        pública.
      </div>
    </div>
  );
}
