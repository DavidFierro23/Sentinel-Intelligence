import { useState } from "react";
import { X, Save, Trash2 } from "lucide-react";

/*
===========================================================
EDITAR IDENTIDAD — P-CAND-UX-01
===========================================================

Todas las redes son OPCIONALES. El analista no tiene que
rellenar seis casillas para corregir un nombre.

Y no hay que borrar y recrear el candidato: recrear perderia el
expediente, las ejecuciones y el inventario consolidado, que es
justo lo que no se quiere perder al arreglar una errata.

LO QUE ESTE FORMULARIO PROMETE Y LO QUE NO

Lo que se escriba aqui entra como DECLARADO POR EL ANALISTA y
sin verificar. Puede pasar despues a corroborado si un proveedor
encuentra la misma cuenta por su cuenta, y entonces las dos cosas
seran verdad. Lo que nunca ocurre es que escribir una URL la
convierta en evidencia.

Retirar una cuenta es explicito, con su boton y su confirmacion:
un formulario enviado a medias no puede borrar identidad.
===========================================================
*/

const CAMPOS = [
  { campo: "facebook", etiqueta: "Facebook", ejemplo: "https://facebook.com/usuario" },
  { campo: "instagram", etiqueta: "Instagram", ejemplo: "https://instagram.com/usuario" },
  { campo: "x", etiqueta: "X", ejemplo: "https://x.com/usuario" },
  { campo: "tiktok", etiqueta: "TikTok", ejemplo: "https://tiktok.com/@usuario" },
  { campo: "youtube", etiqueta: "YouTube", ejemplo: "https://youtube.com/@canal" },
  { campo: "linkedin", etiqueta: "LinkedIn", ejemplo: "https://linkedin.com/in/usuario" },
  { campo: "web", etiqueta: "Web oficial", ejemplo: "https://ejemplo.ec" }
];

const fila = { marginBottom: "11px" };

const rotulo = {
  display: "block",
  color: "var(--sentinel-texto-suave)",
  fontSize: "10.5px",
  marginBottom: "4px"
};


export default function CandidateIdentityForm({
  ficha,
  ocupado,
  onCancelar,
  onGuardar
}) {
  const [form, setForm] = useState({
    nombre: ficha?.nombre || "",
    aliases: "",
    fotoUrl: ficha?.foto?.url || "",
    facebook: "",
    instagram: "",
    x: "",
    tiktok: "",
    youtube: "",
    linkedin: "",
    web: "",
    cuentasExtra: ""
  });

  const [porQuitar, setPorQuitar] = useState([]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const existentes = (ficha?.plataformas || []).flatMap((p) => p.cuentas || []);

  const enviar = () => {
    /*
      Las URLs sueltas van por `cuentas`, que admite varias de la
      misma plataforma: personal y de campana es el caso normal.
    */
    const cuentas = String(form.cuentasExtra || "")
      .split(/[\n,]+/)
      .map((x) => x.trim())
      .filter(Boolean);

    onGuardar({
      nombre: form.nombre,
      aliases: form.aliases,
      fotoUrl: form.fotoUrl,
      fotoOrigen: "analista",
      facebook: form.facebook,
      instagram: form.instagram,
      x: form.x,
      tiktok: form.tiktok,
      youtube: form.youtube,
      linkedin: form.linkedin,
      web: form.web,
      cuentas,
      quitarCuentas: porQuitar
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 120,
        background: "rgba(3,8,20,.74)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "24px",
        overflowY: "auto"
      }}
    >
      <div
        className="sentinel-fade"
        style={{
          width: "min(620px, 100%)",
          background: "var(--sentinel-primary)",
          border: "1px solid var(--sentinel-borde-vivo)",
          borderRadius: "var(--radio-l)",
          padding: "22px 24px",
          boxSizing: "border-box"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "6px"
          }}
        >
          <h2 style={{ margin: 0, color: "#FFFFFF", fontSize: "16.5px" }}>
            Editar identidad
          </h2>

          <button
            className="sentinel-boton"
            onClick={onCancelar}
            aria-label="Cerrar"
            style={{ padding: "5px 9px" }}
          >
            <X size={14} />
          </button>
        </div>

        <p
          style={{
            color: "var(--sentinel-texto-suave)",
            fontSize: "11.5px",
            lineHeight: 1.75,
            margin: "0 0 18px 0"
          }}
        >
          Todas las redes son opcionales. Lo que escribas entra como{" "}
          <strong style={{ color: "#0B5FFF" }}>declarado por el analista</strong>{" "}
          y sin verificar: Sentinel no lo toma como evidencia propia. Si más
          tarde un proveedor encuentra la misma cuenta, pasará también a{" "}
          <strong style={{ color: "#22C55E" }}>corroborada</strong>.
        </p>

        <div style={fila}>
          <label style={rotulo} htmlFor="ci-nombre">
            Nombre
          </label>
          <input
            id="ci-nombre"
            className="sentinel-entrada"
            value={form.nombre}
            onChange={set("nombre")}
            style={{ width: "100%", boxSizing: "border-box" }}
          />
        </div>

        <div style={fila}>
          <label style={rotulo} htmlFor="ci-alias">
            Alias nuevos (separados por comas)
          </label>
          <input
            id="ci-alias"
            className="sentinel-entrada"
            value={form.aliases}
            onChange={set("aliases")}
            placeholder="Jota Lloret, J. C. Lloret"
            style={{ width: "100%", boxSizing: "border-box" }}
          />
        </div>

        <div style={fila}>
          <label style={rotulo} htmlFor="ci-foto">
            URL de la fotografía
          </label>
          <input
            id="ci-foto"
            className="sentinel-entrada"
            value={form.fotoUrl}
            onChange={set("fotoUrl")}
            placeholder="https://…"
            style={{ width: "100%", boxSizing: "border-box" }}
          />
          <div
            style={{
              color: "var(--sentinel-texto-tenue)",
              fontSize: "10px",
              marginTop: "3px"
            }}
          >
            Se guarda su procedencia. No se hace reconocimiento facial y no se
            presentará como «foto oficial».
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
            gap: "10px",
            marginTop: "16px"
          }}
        >
          {CAMPOS.map((c) => (
            <div key={c.campo}>
              <label style={rotulo} htmlFor={`ci-${c.campo}`}>
                {c.etiqueta}
              </label>
              <input
                id={`ci-${c.campo}`}
                className="sentinel-entrada"
                value={form[c.campo]}
                onChange={set(c.campo)}
                placeholder={c.ejemplo}
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </div>
          ))}
        </div>

        <div style={{ ...fila, marginTop: "14px" }}>
          <label style={rotulo} htmlFor="ci-extra">
            Otras URLs (una por línea) — admite varias cuentas de la misma
            plataforma
          </label>
          <textarea
            id="ci-extra"
            className="sentinel-entrada"
            value={form.cuentasExtra}
            onChange={set("cuentasExtra")}
            rows={3}
            style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }}
          />
        </div>

        {/* ---- RETIRAR CUENTAS, explicito ---- */}

        {existentes.length > 0 && (
          <div style={{ marginTop: "16px" }}>
            <div style={rotulo}>Cuentas actuales</div>

            <div
              style={{
                border: "1px solid var(--sentinel-borde)",
                borderRadius: "var(--radio-s)",
                overflow: "hidden"
              }}
            >
              {existentes.map((c) => {
                const id = `${c.plataformaId}:${c.handle || c.url}`;

                const marcada = porQuitar.includes(id);

                return (
                  <div
                    key={id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px 11px",
                      borderTop: "1px solid var(--sentinel-borde)",
                      opacity: marcada ? 0.5 : 1
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ color: "var(--sentinel-texto)", fontSize: "11.5px" }}>
                        {c.plataforma} · {c.handle ? `@${c.handle}` : c.url}
                      </div>
                      <div
                        style={{
                          color: "var(--sentinel-texto-tenue)",
                          fontSize: "10px"
                        }}
                      >
                        {marcada
                          ? "se retirará al guardar"
                          : c.declaradaPorAnalista
                            ? "declarada por el analista"
                            : "descubierta por Sentinel"}
                      </div>
                    </div>

                    <button
                      className="sentinel-boton"
                      onClick={() =>
                        setPorQuitar((p) =>
                          marcada ? p.filter((x) => x !== id) : [...p, id]
                        )
                      }
                      style={{
                        padding: "4px 9px",
                        fontSize: "10px",
                        color: marcada ? "var(--sentinel-texto-suave)" : "#F87171",
                        borderColor: marcada
                          ? "var(--sentinel-borde)"
                          : "#7F1D1D"
                      }}
                    >
                      {marcada ? "conservar" : <Trash2 size={11} />}
                    </button>
                  </div>
                );
              })}
            </div>

            {porQuitar.length > 0 && (
              <div
                style={{
                  color: "#F59E0B",
                  fontSize: "10.5px",
                  marginTop: "7px",
                  lineHeight: 1.7
                }}
              >
                Retirar una cuenta la saca del expediente vigente. El Knowledge
                Lake conserva su historia: no se destruye nada.
              </div>
            )}
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: "10px",
            justifyContent: "flex-end",
            marginTop: "22px"
          }}
        >
          <button className="sentinel-boton" onClick={onCancelar}>
            Cancelar
          </button>

          <button
            className="sentinel-boton sentinel-boton-primario"
            onClick={enviar}
            disabled={ocupado || !form.nombre.trim()}
            style={{ display: "flex", alignItems: "center", gap: "7px" }}
          >
            <Save size={13} />
            {ocupado ? "Guardando…" : "Guardar identidad"}
          </button>
        </div>
      </div>
    </div>
  );
}
