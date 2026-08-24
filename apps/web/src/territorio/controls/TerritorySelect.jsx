import { MapPinned, Layers3 } from "lucide-react";

import { useTerritorial } from "../useTerritorial";

/*
===========================================================
TERRITORIO Y RESOLUCION
===========================================================

El territorio lo declara el ANALISTA. No se deriva de ninguna
busqueda, y esa es la doctrina que ARQ-INV-002 ya fijo para la
investigacion individual: el contexto del proyecto entra con
fuerza superior a cualquier termino derivado de evidencia,
porque una noticia de un homonimo no puede desplazarlo.

Aqui pasa lo mismo en version territorial. Medido: la consulta
"Cuenca" sin provincia ni pais devolvio la feria de San Julian
y un accidente en la A-3 — Cuenca, Espana. Por eso provincia y
pais no son campos opcionales de relleno: son las anclas que
entran en cada consulta.
===========================================================
*/

const RESOLUCIONES = [
  { id: "canton", texto: "Cantón" },
  { id: "parroquia", texto: "Parroquia" },
  { id: "sector", texto: "Sector" }
];


function Campo({ etiqueta, valor, onChange, ancla }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <span
        style={{
          color: ancla ? "var(--sentinel-cyan)" : "var(--sentinel-texto-tenue)",
          fontSize: "9.5px",
          letterSpacing: "1.1px",
          textTransform: "uppercase"
        }}
      >
        {etiqueta}
        {ancla ? " · ancla" : ""}
      </span>

      <input
        value={valor || ""}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "128px",
          padding: "7px 10px",
          background: "var(--sentinel-bg)",
          border: "1px solid var(--sentinel-borde)",
          borderRadius: "var(--radio-m)",
          color: "var(--sentinel-texto)",
          fontSize: "12px",
          outline: "none"
        }}
      />
    </label>
  );
}


export default function TerritorySelect() {
  const { territorio, setTerritorio, resolucion, setResolucion, catalogo } =
    useTerritorial();

  const set = (campo) => (v) =>
    setTerritorio((t) => ({ ...t, [campo]: v }));

  const sinAncla = !territorio.provincia && !territorio.pais;

  const resolucionMasFina =
    catalogo?.territorio?.registro?.metricas?.porResolucion || {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          color: "var(--sentinel-texto-tenue)",
          fontSize: "9.5px",
          letterSpacing: "1.2px",
          textTransform: "uppercase"
        }}
      >
        <MapPinned size={11} />
        Territorio declarado
      </span>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <Campo etiqueta="Cantón" valor={territorio.canton} onChange={set("canton")} />

        <Campo
          etiqueta="Provincia"
          valor={territorio.provincia}
          onChange={set("provincia")}
          ancla
        />

        <Campo
          etiqueta="País"
          valor={territorio.pais}
          onChange={set("pais")}
          ancla
        />
      </div>

      {sinAncla && (
        <span
          style={{
            color: "#eda100",
            fontSize: "10px",
            lineHeight: 1.6,
            maxWidth: "380px"
          }}
        >
          Sin provincia ni país, las consultas van sin ancla territorial y
          pueden traer homónimos de otros países.
        </span>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            color: "var(--sentinel-texto-tenue)",
            fontSize: "9.5px",
            letterSpacing: "1.2px",
            textTransform: "uppercase"
          }}
        >
          <Layers3 size={11} />
          Resolución pedida
        </span>

        <div style={{ display: "flex", gap: "6px" }}>
          {RESOLUCIONES.map((r) => {
            const activa = resolucion === r.id;

            const unidades = resolucionMasFina[r.id] || 0;

            return (
              <button
                key={r.id}
                onClick={() => setResolucion(r.id)}
                title={`${unidades} unidad(es) de esta resolución en el registro. Pedirla no garantiza obtenerla: GEO-1 puede degradarla si el dato no la sostiene.`}
                style={{
                  padding: "5px 11px",
                  borderRadius: "var(--radio-pill)",
                  border: `1px solid ${
                    activa ? "var(--sentinel-cyan)" : "var(--sentinel-borde)"
                  }`,
                  background: activa ? "rgba(11,95,255,.18)" : "transparent",
                  color: activa ? "#FFFFFF" : "var(--sentinel-texto-suave)",
                  fontSize: "11px",
                  fontWeight: activa ? 650 : 500,
                  cursor: "pointer"
                }}
              >
                {r.texto}
                {unidades ? (
                  <span
                    style={{
                      color: "var(--sentinel-texto-tenue)",
                      marginLeft: "5px",
                      fontSize: "9.5px"
                    }}
                  >
                    {unidades}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
