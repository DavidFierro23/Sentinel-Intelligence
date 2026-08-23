import { Search, User } from "lucide-react";

/*
===========================================================
HEADER EJECUTIVO — Sprint UX-BRAND-001
===========================================================

Logo, estado LIVE, fecha, buscador y avatar.

El buscador NO implementa una búsqueda nueva: delega en la que
ya existe mediante la prop onBuscar. Este sprint es de marca, y
duplicar la lógica de búsqueda sería inventar una segunda
puerta al Discovery Engine.

El indicador LIVE refleja el estado REAL que se le pasa. Un
punto verde permanente que no mide nada es decoración que
miente; si no se conoce el estado, dice "sin conexión".
===========================================================
*/

const DIAS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado"
];

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre"
];

function fechaLarga(d) {
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

export default function Header({
  titulo = "Sentinel Intelligence",
  subtitulo = "Centro de Inteligencia Digital",
  enVivo = false,
  detalleEnVivo = null,
  consulta = "",
  onConsulta = null,
  onBuscar = null,
  ocupado = false,
  usuario = null
}) {
  const hoy = new Date();

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: "18px",
        flexWrap: "wrap",
        padding: "16px 24px",
        background: "var(--sentinel-primary)",
        borderBottom: "1px solid var(--sentinel-borde)",
        boxSizing: "border-box"
      }}
    >
      {/* LOGO + TÍTULO */}

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {/* Mismo isotipo oficial que el Sidebar. */}
        <img
          src="/branding/owl-320.png"
          alt=""
          style={{ height: "38px", width: "auto", flexShrink: 0 }}
        />

        <div>
          <div
            style={{
              color: "#FFFFFF",
              fontSize: "15px",
              fontWeight: 700,
              lineHeight: 1.2
            }}
          >
            {titulo}
          </div>

          <div
            style={{
              color: "var(--sentinel-cyan)",
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "1.3px",
              textTransform: "uppercase",
              marginTop: "3px"
            }}
          >
            {subtitulo}
          </div>
        </div>
      </div>

      {/* ESTADO LIVE */}

      <div
        title={
          detalleEnVivo ||
          (enVivo
            ? "Backend accesible"
            : "No se pudo confirmar el backend")
        }
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 13px",
          borderRadius: "var(--radio-pill)",
          border: `1px solid ${enVivo ? "rgba(34,197,94,.45)" : "var(--sentinel-borde)"}`,
          background: enVivo ? "rgba(34,197,94,.09)" : "transparent"
        }}
      >
        {enVivo ? (
          <span className="sentinel-live-punto" />
        ) : (
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "var(--sentinel-gray)",
              flexShrink: 0
            }}
          />
        )}

        <span
          style={{
            color: enVivo ? "var(--sentinel-live)" : "var(--sentinel-texto-tenue)",
            fontSize: "10.5px",
            fontWeight: 700,
            letterSpacing: "1.3px"
          }}
        >
          {enVivo ? "LIVE" : "SIN CONEXIÓN"}
        </span>
      </div>

      {/* FECHA */}

      <div
        style={{
          color: "var(--sentinel-texto-suave)",
          fontSize: "11.5px",
          textTransform: "capitalize"
        }}
      >
        {fechaLarga(hoy)}
      </div>

      {/* BUSCADOR — delega en la búsqueda existente */}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (onBuscar) onBuscar();
        }}
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}
      >
        <div style={{ position: "relative", display: "flex" }}>
          <Search
            size={14}
            color="var(--sentinel-texto-tenue)"
            style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none"
            }}
          />

          <input
            className="sentinel-entrada"
            value={consulta}
            onChange={(e) => onConsulta && onConsulta(e.target.value)}
            placeholder="Investigar un objetivo…"
            aria-label="Investigar un objetivo"
            disabled={!onConsulta}
            style={{ paddingLeft: "36px", width: "244px" }}
          />
        </div>

        <button
          type="submit"
          className="sentinel-boton sentinel-boton-primario"
          disabled={ocupado || !onBuscar || !consulta.trim()}
        >
          {ocupado ? "Investigando…" : "Investigar"}
        </button>
      </form>

      {/* AVATAR */}

      <div
        title={usuario?.nombre || "Sesión local"}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          paddingLeft: "6px"
        }}
      >
        <div
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "50%",
            background:
              "linear-gradient(140deg, var(--sentinel-blue), var(--sentinel-primary))",
            border: "1px solid var(--sentinel-borde-vivo)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
          }}
        >
          {usuario?.iniciales ? (
            <span
              style={{ color: "#FFFFFF", fontSize: "12px", fontWeight: 700 }}
            >
              {usuario.iniciales}
            </span>
          ) : (
            <User size={16} color="#FFFFFF" />
          )}
        </div>

        <div style={{ lineHeight: 1.3 }}>
          <div style={{ color: "var(--sentinel-texto)", fontSize: "12px" }}>
            {usuario?.nombre || "Analista"}
          </div>

          <div
            style={{ color: "var(--sentinel-texto-tenue)", fontSize: "10px" }}
          >
            {usuario?.rol || "sesión local"}
          </div>
        </div>
      </div>
    </header>
  );
}
