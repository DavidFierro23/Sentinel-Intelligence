import {
  Search,
  Network,
  Users,
  TrendingUp,
  Map,
  Settings
} from "lucide-react";

/*
===========================================================
SIDEBAR — Sprint UX-BRAND-001
===========================================================

Menú definitivo de la identidad oficial. El icono de War Room
es el propio isotipo: es el búho de la marca, no un emoji.

Cada entrada declara si el módulo está OPERATIVO o RESERVADO.
Un menú que lleva a una pantalla vacía sin avisar hace perder
el tiempo al analista; uno que declara el estado, no.
===========================================================
*/

/*
  Sin `export`: un archivo que exporta constantes ademas del
  componente rompe el fast refresh de Vite. Solo lo usa este
  componente.
*/
const MODULOS = [
  {
    id: "war_room",
    texto: "War Room",
    icono: "buho",
    estado: "reservado",
    nota: "Diseño congelado en UX-WR-001 v2.0. Sin implementar."
  },
  {
    id: "investigaciones",
    texto: "Investigaciones",
    icono: Search,
    estado: "operativo"
  },
  {
    id: "knowledge_graph",
    texto: "Knowledge Graph",
    icono: Network,
    estado: "operativo",
    nota: "Se construye desde una investigación."
  },
  {
    id: "candidatos",
    texto: "Candidatos",
    icono: Users,
    estado: "operativo",
    nota: "Se puebla desde una investigación."
  },
  {
    id: "correlacion",
    texto: "Correlación Viva",
    icono: TrendingUp,
    estado: "reservado",
    nota: "Requiere el Confidence Engine continuo."
  },
  {
    id: "mapa",
    texto: "Mapa Territorial",
    icono: Map,
    estado: "reservado",
    nota: "Mapa de Cuenca definido en UX-WR-001. Sin implementar."
  },
  {
    id: "configuracion",
    texto: "Configuración",
    icono: Settings,
    estado: "operativo"
  }
];

function IconoBuho({ activo }) {
  return (
    <img
      src="/assets/sentinel/sentinel-icon.svg"
      alt=""
      width={20}
      height={20}
      style={{
        borderRadius: "5px",
        flexShrink: 0,
        opacity: activo ? 1 : 0.75,
        transition: "opacity 180ms"
      }}
    />
  );
}

export default function Sidebar({ activo, onSeleccionar }) {
  return (
    <aside
      style={{
        width: "252px",
        minWidth: "252px",
        background: "var(--sentinel-primary)",
        borderRight: "1px solid var(--sentinel-borde)",
        padding: "22px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        boxSizing: "border-box"
      }}
    >
      {/* MARCA */}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "4px 8px 20px 8px",
          borderBottom: "1px solid var(--sentinel-borde)",
          marginBottom: "16px"
        }}
      >
        <img
          src="/assets/sentinel/sentinel-logo.svg"
          alt="Sentinel Intelligence"
          width={42}
          height={42}
          style={{ flexShrink: 0 }}
        />

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              color: "#FFFFFF",
              fontSize: "15px",
              fontWeight: 700,
              lineHeight: 1.25,
              letterSpacing: "0.2px"
            }}
          >
            Sentinel Intelligence
          </div>

          <div
            style={{
              color: "var(--sentinel-cyan)",
              fontSize: "9.5px",
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              marginTop: "3px"
            }}
          >
            Centro de Inteligencia Digital
          </div>
        </div>
      </div>

      {/* MENÚ */}

      <nav style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {MODULOS.map((m) => {
          const seleccionado = activo === m.id;

          const Icono = m.icono;

          return (
            <button
              key={m.id}
              className="sentinel-hover"
              onClick={() => onSeleccionar(m.id)}
              title={m.nota || m.texto}
              aria-current={seleccionado ? "page" : undefined}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 14px",
                borderRadius: "var(--radio-m)",
                border: "1px solid",
                borderColor: seleccionado
                  ? "var(--sentinel-cyan)"
                  : "transparent",
                cursor: "pointer",
                background: seleccionado
                  ? "rgba(11,95,255,.22)"
                  : "transparent",
                color: seleccionado
                  ? "#FFFFFF"
                  : "var(--sentinel-texto-suave)",
                fontWeight: seleccionado ? 650 : 500,
                fontSize: "13.5px",
                textAlign: "left",
                boxShadow: seleccionado ? "var(--glow-cyan)" : "none"
              }}
            >
              {m.icono === "buho" ? (
                <IconoBuho activo={seleccionado} />
              ) : (
                <Icono size={19} style={{ flexShrink: 0 }} />
              )}

              <span style={{ flex: 1, minWidth: 0 }}>{m.texto}</span>

              {/*
                Estado del módulo. Se declara en el propio menú
                para no prometer pantallas que no existen.
              */}
              {m.estado === "reservado" && (
                <span
                  style={{
                    fontSize: "8.5px",
                    letterSpacing: "0.8px",
                    color: "var(--sentinel-texto-tenue)",
                    border: "1px solid var(--sentinel-borde)",
                    borderRadius: "var(--radio-pill)",
                    padding: "2px 7px",
                    flexShrink: 0
                  }}
                >
                  RESERVADO
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div style={{ flex: 1 }} />

      <div
        style={{
          color: "var(--sentinel-texto-tenue)",
          fontSize: "10px",
          padding: "12px 10px 0 10px",
          borderTop: "1px solid var(--sentinel-borde)",
          lineHeight: 1.6
        }}
      >
        El sistema no confirma identidades.
        <br />
        Confirmar es competencia del analista.
      </div>
    </aside>
  );
}
