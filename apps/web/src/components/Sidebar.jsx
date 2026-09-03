import {
  Search,
  Users,
  Map,
  Newspaper,
  Settings,
  LayoutDashboard,
  Sparkles
} from "lucide-react";

/*
===========================================================
SIDEBAR — SENTINEL-UX-CONSOLIDATION-01
===========================================================

Seis destinos ordenados por la PREGUNTA que responden, no por
el motor que hay detras. Configuracion queda aparte, porque no
es una pregunta de analisis.

QUE SALE DE LA NAVEGACION PRIMARIA, Y POR QUE NO SE BORRA
-----------------------------------------------------------

    War Room         reservado, prometia una sala que no existe;
                     su pregunta —«¿que esta pasando?»— la
                     responde ahora RESUMEN, con datos reales.

    Knowledge Graph  no era un motor: App montaba el MISMO
                     componente que Investigaciones y solo
                     cambiaba que se veia. El menu sugeria dos
                     cosas donde habia una. Pasa a ser una vista
                     dentro de Investigaciones.

    Correlacion Viva reservado. Es una capacidad interna y su
                     destino natural es Sentinel AI.

Los tres ids siguen resolviendo en `moduleRegistry`: un enlace
guardado no se rompe, se redirige a donde hoy vive su respuesta.

El estado por entrada se conserva —un menu que lleva a una
pantalla vacia sin avisar hace perder el tiempo— pero ya no hay
ninguna entrada primaria RESERVADA: todas llevan a algo.
===========================================================
*/

/*
  Sin `export`: un archivo que exporta constantes ademas del
  componente rompe el fast refresh de Vite. Solo lo usa este
  componente.
*/
const MODULOS = [
  {
    id: "resumen",
    texto: "Resumen",
    icono: LayoutDashboard,
    estado: "operativo",
    nota: "¿Qué está pasando? Estado observable del proyecto activo."
  },
  {
    id: "candidatos",
    texto: "Candidatos",
    icono: Users,
    estado: "operativo",
    nota: "Proyectos, candidatos y sus expedientes de identidad digital."
  },
  {
    /*
      El id sigue siendo `mapa` por compatibilidad: es la clave
      con la que App monta el modulo territorial y la que llevan
      los enlaces guardados.
    */
    id: "mapa",
    texto: "Territorio",
    icono: Map,
    estado: "operativo",
    nota: "¿Dónde ocurre? Inteligencia territorial y conversación pública."
  },
  {
    /*
      Igual con `media_pieza`: nacio cuando el modulo era «analizar
      una pieza». Hoy es Media Intelligence entero, y renombrar el
      id habria roto los deep links por un motivo cosmetico.
    */
    id: "media_pieza",
    texto: "Medios",
    icono: Newspaper,
    estado: "operativo",
    nota: "¿Quién publica y cómo se amplifica? Presencia mediática observable."
  },
  {
    id: "investigaciones",
    texto: "Investigaciones",
    icono: Search,
    estado: "operativo",
    nota: "¿Qué hay detrás de un actor? Incluye el mapa de relaciones."
  },
  {
    id: "sentinel_ai",
    texto: "Sentinel AI",
    icono: Sparkles,
    estado: "preparacion",
    nota: "Consulta en lenguaje natural. Todavía no está conectado."
  }
];


/* Configuracion va aparte: no es una pregunta de analisis. */
const APARTE = [
  {
    id: "configuracion",
    texto: "Configuración",
    icono: Settings,
    estado: "operativo"
  }
];


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
          flexDirection: "column",
          alignItems: "center",
          gap: "10px",
          padding: "4px 4px 18px 4px",
          borderBottom: "1px solid var(--sentinel-borde)",
          marginBottom: "16px"
        }}
      >
        {/*
          Isotipo oficial a 60 px de alto, con width automatico para
          respetar la proporcion original del archivo.
        */}
        <img
          src="/branding/owl-320.png"
          alt="Sentinel Intelligence"
          style={{ height: "60px", width: "auto", flexShrink: 0 }}
        />

        <div style={{ minWidth: 0, textAlign: "center", width: "100%" }}>
          <div
            style={{
              color: "#FFFFFF",
              fontSize: "15.5px",
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: "0.2px",
              whiteSpace: "nowrap"
            }}
          >
            Sentinel Intelligence
          </div>

          {/*
            Contraste de marca: titulo en blanco puro, subtitulo en
            cian oficial.
          */}
          <div
            style={{
              color: "var(--sentinel-cyan)",
              fontSize: "8.5px",
              fontWeight: 600,
              letterSpacing: "1.1px",
              textTransform: "uppercase",
              marginTop: "5px",
              lineHeight: 1.5
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
                fontSize: "13px",
                textAlign: "left",
                lineHeight: 1.35,
                boxShadow: seleccionado ? "var(--glow-cyan)" : "none"
              }}
            >
              {/*
                El buho de la marca era el icono de War Room, que
                sale de la navegacion primaria. El isotipo sigue
                en la cabecera del sidebar y deja de repetirse en
                una entrada de menu.
              */}
              <Icono size={19} style={{ flexShrink: 0 }} />

              <span style={{ flex: 1, minWidth: 0 }}>{m.texto}</span>

              {/*
                Estado del modulo, declarado en el propio menu.
                Ya no hay ninguna entrada RESERVADA: la unica que
                no esta terminada es Sentinel AI, y dice que esta
                en preparacion en lugar de prometer una sala que
                no existe.
              */}
              {m.estado === "preparacion" && (
                <span
                  style={{
                    fontSize: "8.5px",
                    letterSpacing: "0.8px",
                    color: "#eda100",
                    border: "1px solid #eda10055",
                    borderRadius: "var(--radio-pill)",
                    padding: "2px 7px",
                    flexShrink: 0
                  }}
                >
                  EN PREP.
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div style={{ flex: 1 }} />

      {/*
        CONFIGURACION, separada del bloque analitico por una
        linea. No responde una pregunta de inteligencia y
        mezclarla con las seis obligaba a leerla cada vez.
      */}
      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          paddingTop: "12px",
          borderTop: "1px solid var(--sentinel-borde)",
          marginBottom: "4px"
        }}
      >
        {APARTE.map((m) => {
          const seleccionado = activo === m.id;

          const Icono = m.icono;

          return (
            <button
              key={m.id}
              className="sentinel-hover"
              onClick={() => onSeleccionar(m.id)}
              aria-current={seleccionado ? "page" : undefined}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 14px",
                borderRadius: "var(--radio-m)",
                border: "1px solid",
                borderColor: seleccionado ? "var(--sentinel-cyan)" : "transparent",
                cursor: "pointer",
                background: seleccionado ? "rgba(11,95,255,.22)" : "transparent",
                color: seleccionado ? "#FFFFFF" : "var(--sentinel-texto-tenue)",
                fontWeight: seleccionado ? 650 : 500,
                fontSize: "12.5px",
                textAlign: "left"
              }}
            >
              <Icono size={17} style={{ flexShrink: 0 }} />

              <span style={{ flex: 1, minWidth: 0 }}>{m.texto}</span>
            </button>
          );
        })}
      </nav>

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
