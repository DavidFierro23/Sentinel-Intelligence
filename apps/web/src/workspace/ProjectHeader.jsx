import { Building2, CalendarRange, Database } from "lucide-react";

import EstadoChip from "./EstadoChip";

/*
===========================================================
SENTINEL-UX-CONSOLIDATION-01 — CONTEXTO DEL PROYECTO
===========================================================

Una franja compacta con lo unico que el analista necesita tener
delante en todo momento: en que proyecto esta, que ventana esta
mirando y si los datos que ve vienen del Lake.

DOS COSAS QUE ESTA BARRA NO HACE
-----------------------------------------------------------

1. No ocupa media pantalla. El espacio vertical de un workspace
   de analisis es para las tablas, no para el contexto. Una
   linea de 56 px basta para no perderse.

2. No muestra ninguna metrica. La tentacion de poner cuatro
   numerones aqui es fuerte y seria un error: los numeros
   dependen de la ventana y de la seccion, y repetidos arriba
   quedarian desactualizados o contradiciendo la tabla de
   debajo.
===========================================================
*/

const VENTANAS = [
  { id: "hoy", texto: "Hoy" },
  { id: "7d", texto: "7D" },
  { id: "15d", texto: "15D" },
  { id: "30d", texto: "30D" },
  { id: "90d", texto: "90D" }
];


export default function ProjectHeader({
  proyectos = [],
  projectId = "",
  proyecto = null,
  ventana = "7d",
  mostrarVentana = true,
  onProyecto = () => {},
  onVentana = () => {},
  estadoDatos = null
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "18px",
        flexWrap: "wrap",
        padding: "10px 24px",
        background: "var(--sentinel-surface)",
        borderBottom: "1px solid var(--sentinel-borde)"
      }}
    >
      {/* --- PROYECTO --- */}
      <div style={{ display: "flex", alignItems: "center", gap: "9px", minWidth: "260px" }}>
        <Building2 size={15} style={{ color: "var(--sentinel-cyan)", flexShrink: 0 }} />

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: "0.55rem",
              letterSpacing: "0.11em",
              textTransform: "uppercase",
              color: "var(--sentinel-texto-tenue)"
            }}
          >
            Proyecto
          </div>

          <select
            value={projectId}
            onChange={(e) => onProyecto(e.target.value)}
            aria-label="Proyecto activo"
            style={{
              marginTop: "1px",
              maxWidth: "300px",
              padding: "2px 6px 2px 0",
              background: "transparent",
              border: "none",
              borderBottom: "1px solid var(--sentinel-borde-vivo)",
              color: "var(--sentinel-texto)",
              fontSize: "0.86rem",
              fontWeight: 650,
              cursor: "pointer"
            }}
          >
            {projectId ? null : <option value="">Selecciona un proyecto…</option>}

            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {proyecto ? (
        <div
          style={{
            fontSize: "0.68rem",
            color: "var(--sentinel-texto-suave)",
            borderLeft: "1px solid var(--sentinel-borde)",
            paddingLeft: "16px"
          }}
        >
          {[proyecto.canton, proyecto.provincia, proyecto.pais].filter(Boolean).join(" · ") ||
            "Sin territorio declarado"}
        </div>
      ) : null}

      {/* --- VENTANA --- */}
      {mostrarVentana ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            borderLeft: "1px solid var(--sentinel-borde)",
            paddingLeft: "16px"
          }}
        >
          <CalendarRange size={13} style={{ color: "var(--sentinel-texto-tenue)" }} />

          <div style={{ display: "flex", gap: "4px" }}>
            {VENTANAS.map((v) => {
              const activo = v.id === ventana;

              return (
                <button
                  key={v.id}
                  onClick={() => onVentana(v.id)}
                  style={{
                    padding: "3px 10px",
                    borderRadius: "var(--radio-pill)",
                    border: `1px solid ${
                      activo ? "var(--sentinel-cyan)" : "transparent"
                    }`,
                    background: activo ? "rgba(0,212,255,.10)" : "transparent",
                    color: activo ? "#FFFFFF" : "var(--sentinel-texto-suave)",
                    fontSize: "0.68rem",
                    fontWeight: activo ? 700 : 500,
                    cursor: "pointer"
                  }}
                >
                  {v.texto}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* --- ESTADO DE DATOS, solo cuando aporta --- */}
      {estadoDatos ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "7px",
            marginLeft: "auto"
          }}
        >
          <Database size={12} style={{ color: "var(--sentinel-texto-tenue)" }} />

          <EstadoChip
            estado={estadoDatos.estado}
            texto={estadoDatos.texto}
            titulo={estadoDatos.titulo}
            compacto
          />
        </div>
      ) : null}
    </div>
  );
}
