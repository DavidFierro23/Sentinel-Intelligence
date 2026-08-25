import { useState } from "react";
import {
  X,
  Save,
  Trash2,
  Plus,
  RotateCcw,
  AlertTriangle,
  Users,
  Camera,
  AtSign,
  Music2,
  PlaySquare,
  Briefcase,
  Globe
} from "lucide-react";

import { estadoVisual, procedencia } from "../services/identidadCandidato";

/*
===========================================================
EDITAR IDENTIDAD DIGITAL — P-CAND-UX-02
===========================================================

QUE PASABA ANTES

El formulario existia y estaba montado en la rama que renderiza
la LISTA de proyectos, que retorna antes que la del detalle. Al
pulsar «Editar identidad» desde el detalle, el estado cambiaba y
este componente no llegaba a renderizarse nunca. Habia un
formulario y era inalcanzable.

QUE ES AHORA

Un espacio de trabajo por plataforma. Las siete estan siempre, y
cada una admite VARIAS cuentas: un candidato tiene legitimamente
Instagram personal y de campana, y el modelo anterior
—`instagram: string`— solo dejaba una.

LO QUE ESTE FORMULARIO PROMETE Y LO QUE NO

Lo que se escribe aqui es una DECLARACION HUMANA. Entra como
declarada por el analista y sin verificar. Puede pasar despues a
corroborada si un proveedor encuentra la misma cuenta por su
cuenta, y entonces las dos cosas seran verdad a la vez. Lo que
nunca ocurre es que escribir una URL la convierta en evidencia.

Guardar y comprobar son operaciones distintas: la primera es lo
que sabe una persona, la segunda es lo que observa Sentinel.
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

const TONOS = {
  verde: "#22C55E",
  azul: "#0B5FFF",
  ambar: "#F59E0B",
  gris: "var(--sentinel-texto-tenue)",
  rojo: "#EF4444"
};

const color = (t) => TONOS[t] || TONOS.gris;

const pill = (t) => ({
  color: color(t),
  border: `1px solid ${color(t)}`,
  borderRadius: "var(--radio-pill)",
  padding: "2px 8px",
  fontSize: "9.5px",
  whiteSpace: "nowrap"
});

const rotulo = {
  display: "block",
  color: "var(--sentinel-texto-suave)",
  fontSize: "10.5px",
  marginBottom: "4px"
};

/*
  DOMINIOS CONOCIDOS.

  Solo para AVISAR al analista si pega una URL en la casilla
  equivocada. La clasificacion de verdad la hace SD-1A en el
  backend, que es la autoridad: aqui no se decide nada, se avisa.
*/
const DOMINIOS = {
  facebook: ["facebook.com", "fb.com"],
  instagram: ["instagram.com"],
  x: ["x.com", "twitter.com"],
  tiktok: ["tiktok.com"],
  youtube: ["youtube.com", "youtu.be"],
  linkedin: ["linkedin.com"]
};

function plataformaDeUrl(url) {
  const u = String(url || "").toLowerCase();

  if (!u.trim()) return null;

  for (const [id, dominios] of Object.entries(DOMINIOS)) {
    if (dominios.some((d) => u.includes(d))) return id;
  }

  return /^https?:\/\/|\.[a-z]{2,}/i.test(u) ? "web" : null;
}


/*
-----------------------------------------------------------
UNA PLATAFORMA EN MODO EDICION
-----------------------------------------------------------
*/
function BloquePlataforma({ p, nuevas, setNuevas, porQuitar, alternarQuitar }) {
  const Icono = ICONOS[p.plataformaId] || Globe;

  const [borrador, setBorrador] = useState("");

  const propias = nuevas.filter((n) => n.plataformaId === p.plataformaId);

  const detectada = plataformaDeUrl(borrador);

  /*
    Aviso, no bloqueo: el analista puede tener razon y el dominio
    puede ser uno que no conocemos. Manda el backend.
  */
  const discrepa =
    detectada && detectada !== p.plataformaId && borrador.trim().length > 6;

  const agregar = () => {
    const url = borrador.trim();

    if (!url) return;

    setNuevas((xs) => [
      ...xs,
      { url, plataformaId: detectada || p.plataformaId, casilla: p.plataformaId }
    ]);

    setBorrador("");
  };

  return (
    <div
      style={{
        background: "var(--sentinel-surface)",
        border: "1px solid var(--sentinel-borde)",
        borderRadius: "var(--radio-m)",
        padding: "12px 14px"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "9px" }}>
        <Icono size={15} color="var(--sentinel-cyan)" />

        <strong style={{ color: "#FFFFFF", fontSize: "12.5px" }}>
          {p.plataforma}
        </strong>

        {p.total > 0 && (
          <span style={{ color: "var(--sentinel-texto-tenue)", fontSize: "10px" }}>
            {p.total} registrada{p.total > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ---- CUENTAS YA REGISTRADAS ---- */}

      {p.cuentas.map((c) => {
        const marcada = porQuitar.includes(c.id);

        const v = estadoVisual(c.estado);

        return (
          <div
            key={c.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "9px",
              padding: "8px 0",
              borderTop: "1px solid var(--sentinel-borde)",
              opacity: marcada ? 0.45 : 1,
              flexWrap: "wrap"
            }}
          >
            <div style={{ minWidth: 0, flex: "1 1 190px" }}>
              <div style={{ color: "#FFFFFF", fontSize: "11.5px" }}>
                {c.handle ? `@${c.handle}` : c.url}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  flexWrap: "wrap",
                  marginTop: "4px",
                  alignItems: "center"
                }}
              >
                <span style={pill(v.tono)}>{v.etiqueta}</span>

                <span
                  style={{ color: "var(--sentinel-texto-tenue)", fontSize: "9.5px" }}
                >
                  {marcada ? "se retirará al guardar" : procedencia(c)}
                </span>
              </div>
            </div>

            <button
              className="sentinel-boton"
              onClick={() => alternarQuitar(c.id)}
              title={
                marcada
                  ? "Conservar esta cuenta"
                  : "Retirar de la identidad activa. Se conserva su historia."
              }
              style={{
                padding: "4px 9px",
                fontSize: "9.5px",
                display: "flex",
                alignItems: "center",
                gap: "5px",
                color: marcada ? "var(--sentinel-texto-suave)" : "#F87171",
                borderColor: marcada ? "var(--sentinel-borde)" : "#7F1D1D"
              }}
            >
              {marcada ? (
                <>
                  <RotateCcw size={10} /> conservar
                </>
              ) : (
                <>
                  <Trash2 size={10} /> retirar
                </>
              )}
            </button>
          </div>
        );
      })}

      {/* ---- CUENTAS PENDIENTES DE GUARDAR ---- */}

      {propias.map((n, i) => (
        <div
          key={`${n.url}-${i}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "7px 0",
            borderTop: "1px dashed var(--sentinel-borde-vivo)",
            flexWrap: "wrap"
          }}
        >
          <span style={{ color: "var(--sentinel-cyan)", fontSize: "11px", flex: 1, minWidth: 0, wordBreak: "break-all" }}>
            {n.url}
          </span>

          <span style={pill("azul")}>se añadirá</span>

          <button
            className="sentinel-boton"
            onClick={() => setNuevas((xs) => xs.filter((x) => x !== n))}
            style={{ padding: "3px 8px", fontSize: "9.5px" }}
          >
            <X size={10} />
          </button>
        </div>
      ))}

      {/* ---- PLATAFORMA VACIA ---- */}

      {p.total === 0 && propias.length === 0 && (
        <div
          style={{
            color: "var(--sentinel-texto-tenue)",
            fontSize: "10px",
            lineHeight: 1.7,
            marginBottom: "8px"
          }}
        >
          {/*
            No se escribe «el candidato no tiene TikTok». Sentinel
            declara lo que observo, y aqui no observo nada.
          */}
          Sentinel no tiene ninguna cuenta registrada aquí. Esto no implica que
          el candidato no utilice esta plataforma.
        </div>
      )}

      {/* ---- AGREGAR ---- */}

      <div style={{ display: "flex", gap: "7px", marginTop: "8px", flexWrap: "wrap" }}>
        <input
          className="sentinel-entrada"
          value={borrador}
          onChange={(e) => setBorrador(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") agregar();
          }}
          placeholder="URL de la cuenta"
          aria-label={`URL de ${p.plataforma}`}
          style={{ flex: "1 1 170px", minWidth: 0, fontSize: "11px" }}
        />

        <button
          className="sentinel-boton"
          onClick={agregar}
          disabled={!borrador.trim()}
          style={{
            padding: "6px 11px",
            fontSize: "10.5px",
            display: "flex",
            alignItems: "center",
            gap: "5px"
          }}
        >
          <Plus size={11} /> Agregar
        </button>
      </div>

      {discrepa && (
        <div
          style={{
            display: "flex",
            gap: "6px",
            alignItems: "flex-start",
            color: "#F59E0B",
            fontSize: "9.5px",
            marginTop: "7px",
            lineHeight: 1.6
          }}
        >
          <AlertTriangle size={11} style={{ flexShrink: 0, marginTop: "1px" }} />

          <span>
            Esa URL parece de <strong>{detectada}</strong>. Se registrará según
            su dominio real, no según esta casilla.
          </span>
        </div>
      )}
    </div>
  );
}


/*
===========================================================
EL WORKSPACE
===========================================================
*/
export default function CandidateIdentityForm({
  ficha,
  proyecto,
  ocupado,
  onCancelar,
  onGuardar
}) {
  const [nombre, setNombre] = useState(ficha?.nombre || "");

  const [alias, setAlias] = useState("");

  const [fotoUrl, setFotoUrl] = useState(ficha?.foto?.url || "");

  const [nuevas, setNuevas] = useState([]);

  const [porQuitar, setPorQuitar] = useState([]);

  const alternarQuitar = (id) =>
    setPorQuitar((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const hayCambios =
    nuevas.length > 0 ||
    porQuitar.length > 0 ||
    alias.trim() !== "" ||
    nombre !== (ficha?.nombre || "") ||
    fotoUrl !== (ficha?.foto?.url || "");

  const guardar = () => {
    /*
      Se envia solo lo que cambio. Un PATCH parcial no puede
      borrar lo que no menciona: las cuentas van por `cuentas` y
      las retiradas por `quitarCuentas`, cada una explicita.
    */
    const cambios = { nombre };

    if (alias.trim()) cambios.aliases = alias;

    if (fotoUrl !== (ficha?.foto?.url || "")) {
      cambios.fotoUrl = fotoUrl;
      cambios.fotoOrigen = "analista";
    }

    if (nuevas.length) cambios.cuentas = nuevas.map((n) => n.url);

    if (porQuitar.length) cambios.quitarCuentas = porQuitar;

    onGuardar(cambios);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Editar identidad digital"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 140,
        background: "rgba(3,8,20,.78)",
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
          width: "min(880px, 100%)",
          background: "var(--sentinel-primary)",
          border: "1px solid var(--sentinel-borde-vivo)",
          borderRadius: "var(--radio-l)",
          boxSizing: "border-box",
          /*
            Cabecera y pie fijos, cuerpo con scroll propio: con
            siete plataformas el contenido excede la pantalla, y un
            formulario cuyo boton de guardar queda fuera del
            viewport es un formulario que no se puede usar.
          */
          display: "flex",
          flexDirection: "column",
          maxHeight: "calc(100vh - 40px)"
        }}
      >
        {/* ---- CABECERA ---- */}

        <div
          style={{
            padding: "20px 24px 14px 24px",
            borderBottom: "1px solid var(--sentinel-borde)"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "12px"
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, color: "#FFFFFF", fontSize: "16.5px" }}>
                Editar identidad digital
              </h2>

              <div
                style={{ color: "#FFFFFF", fontSize: "13px", marginTop: "6px" }}
              >
                {ficha?.nombre}
              </div>

              <div
                style={{
                  color: "var(--sentinel-cyan)",
                  fontSize: "10.5px",
                  marginTop: "3px"
                }}
              >
                {[
                  proyecto?.nombre,
                  ficha?.dignidad || proyecto?.dignidad,
                  [proyecto?.canton, proyecto?.provincia, proyecto?.pais]
                    .filter(Boolean)
                    .join(", ")
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>

            <button
              className="sentinel-boton"
              onClick={onCancelar}
              aria-label="Cerrar"
              style={{ padding: "5px 9px", flexShrink: 0 }}
            >
              <X size={14} />
            </button>
          </div>

          <p
            style={{
              color: "var(--sentinel-texto-suave)",
              fontSize: "11px",
              lineHeight: 1.75,
              margin: "13px 0 0 0"
            }}
          >
            Las cuentas introducidas manualmente se registran como{" "}
            <strong style={{ color: "#0B5FFF" }}>declaradas por el analista</strong>.
            Sentinel puede corroborarlas posteriormente mediante fuentes
            independientes, y entonces constarán las dos procedencias.
          </p>
        </div>

        {/* ---- CUERPO ---- */}

        <div style={{ padding: "18px 24px", overflowY: "auto", flex: 1 }}>
          {/* DATOS GENERALES */}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: "12px"
            }}
          >
            <div>
              <label style={rotulo} htmlFor="ci-nombre">
                Nombre
              </label>
              <input
                id="ci-nombre"
                className="sentinel-entrada"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box" }}
              />
              <div
                style={{
                  color: "var(--sentinel-texto-tenue)",
                  fontSize: "9.5px",
                  marginTop: "3px"
                }}
              >
                Corregirlo no cambia el identificador ni el expediente.
              </div>
            </div>

            <div>
              <label style={rotulo} htmlFor="ci-alias">
                Alias nuevos (separados por comas)
              </label>
              <input
                id="ci-alias"
                className="sentinel-entrada"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="otra forma de nombrarle"
                style={{ width: "100%", boxSizing: "border-box" }}
              />
              {ficha?.aliases?.length > 0 && (
                <div
                  style={{
                    color: "var(--sentinel-texto-tenue)",
                    fontSize: "9.5px",
                    marginTop: "3px"
                  }}
                >
                  ya registrados: {ficha.aliases.map((a) => a.valor || a).join(" · ")}
                </div>
              )}
            </div>
          </div>

          {/* FOTO */}

          <div
            style={{
              display: "flex",
              gap: "13px",
              alignItems: "flex-start",
              marginTop: "14px"
            }}
          >
            {fotoUrl ? (
              <img
                src={fotoUrl}
                alt="Vista previa de la fotografía"
                style={{
                  width: "58px",
                  height: "58px",
                  objectFit: "cover",
                  borderRadius: "var(--radio-s)",
                  border: "1px solid var(--sentinel-borde-vivo)",
                  flexShrink: 0
                }}
              />
            ) : (
              <div
                style={{
                  width: "58px",
                  height: "58px",
                  borderRadius: "var(--radio-s)",
                  border: "1px dashed var(--sentinel-borde-vivo)",
                  flexShrink: 0
                }}
              />
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={rotulo} htmlFor="ci-foto">
                URL de fotografía de referencia
              </label>
              <input
                id="ci-foto"
                className="sentinel-entrada"
                value={fotoUrl}
                onChange={(e) => setFotoUrl(e.target.value)}
                placeholder="https://…"
                style={{ width: "100%", boxSizing: "border-box" }}
              />
              <div
                style={{
                  color: "var(--sentinel-texto-tenue)",
                  fontSize: "9.5px",
                  marginTop: "3px",
                  lineHeight: 1.6
                }}
              >
                {/*
                  No hay reconocimiento facial, y una imagen
                  encontrada no es una «foto oficial». Se guarda su
                  procedencia y se dice.
                */}
                Se guarda su procedencia. No se hace reconocimiento facial y no
                se presentará como fotografía oficial.
                {ficha?.foto && (
                  <>
                    {" "}
                    Actual:{" "}
                    {ficha.foto.origen === "analista"
                      ? "declarada por el analista"
                      : `encontrada por Sentinel${ficha.foto.provider ? ` (${ficha.foto.provider})` : ""}`}
                    {!ficha.foto.verificadaPorSentinel &&
                      " · no verificada por Sentinel"}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* PLATAFORMAS */}

          <div
            style={{
              color: "var(--sentinel-texto-suave)",
              fontSize: "11px",
              margin: "20px 0 9px 0"
            }}
          >
            Redes sociales y web — cada plataforma admite varias cuentas
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
              gap: "10px"
            }}
          >
            {(ficha?.plataformas || []).map((p) => (
              <BloquePlataforma
                key={p.plataformaId}
                p={p}
                nuevas={nuevas}
                setNuevas={setNuevas}
                porQuitar={porQuitar}
                alternarQuitar={alternarQuitar}
              />
            ))}
          </div>

          {porQuitar.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: "7px",
                alignItems: "flex-start",
                color: "#F59E0B",
                fontSize: "10.5px",
                marginTop: "13px",
                lineHeight: 1.7
              }}
            >
              <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: "2px" }} />

              <span>
                {porQuitar.length} cuenta(s) se retirarán de la identidad activa.
                Quedan registradas como revocadas, con su fecha: no se borra su
                historia y se pueden volver a añadir.
              </span>
            </div>
          )}

          {ficha?.revocadas?.length > 0 && (
            <div
              style={{
                color: "var(--sentinel-texto-tenue)",
                fontSize: "10px",
                marginTop: "13px",
                lineHeight: 1.7
              }}
            >
              Retiradas anteriormente:{" "}
              {ficha.revocadas
                .map((r) => `${r.plataforma} ${r.handle ? `@${r.handle}` : r.url}`)
                .join(" · ")}
              . Vuelve a añadirlas arriba si quieres reactivarlas.
            </div>
          )}
        </div>

        {/* ---- PIE ---- */}

        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid var(--sentinel-borde)",
            display: "flex",
            gap: "10px",
            justifyContent: "flex-end",
            alignItems: "center",
            flexWrap: "wrap"
          }}
        >
          <span
            style={{
              color: "var(--sentinel-texto-tenue)",
              fontSize: "10px",
              marginRight: "auto"
            }}
          >
            Guardar es una declaración. «Comprobar redes» es una observación de
            Sentinel: son operaciones distintas.
          </span>

          <button className="sentinel-boton" onClick={onCancelar}>
            Cancelar
          </button>

          <button
            className="sentinel-boton sentinel-boton-primario"
            onClick={guardar}
            disabled={ocupado || !nombre.trim() || !hayCambios}
            style={{ display: "flex", alignItems: "center", gap: "7px" }}
          >
            <Save size={13} />
            {ocupado ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
