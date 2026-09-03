import { useState } from "react";

import { Search, Share2, Layers, Shield, AlertOctagon, FileText } from "lucide-react";

import EstadoChip from "./EstadoChip";

/*
===========================================================
SENTINEL-UX-CONSOLIDATION-01 — INVESTIGACIONES
===========================================================

Reencuadra lo que ya existe. NO implementa Investigations
Intelligence.

QUE CAMBIA DE VERDAD
-----------------------------------------------------------

El Knowledge Graph deja de ser una entrada de menu primaria y
pasa a ser una VISTA de la investigacion, que es lo que
siempre fue: App ya montaba el mismo componente OSINT para
`investigaciones` y para `knowledge_graph`, mostrando y
ocultando el mismo resultado. El menu sugeria dos motores donde
habia uno.

Aqui esa realidad se hace visible: una investigacion con dos
vistas —hallazgos y mapa de relaciones— en lugar de dos
entradas que comparten estado en secreto.

LAS SECCIONES QUE NO EXISTEN
-----------------------------------------------------------

Contraste/Lado B, Narrativas, Crisis y Expedientes se declaran
como destinos con su estado real. No se pintan pantallas vacias
ni contenido simulado: una seccion que promete un motor
inexistente hace perder mas tiempo que una que dice que no
esta.

EL CONTENIDO REAL SE PASA COMO PROP
-----------------------------------------------------------

`investigacion` es el nodo que App ya monta una sola vez. Se
recibe entero y se muestra u oculta, para no perder el
resultado al cambiar de vista. Este componente no toca el
Discovery Engine ni sabe como se ejecuta una investigacion.
===========================================================
*/

const CAJA = {
  background: "var(--sentinel-surface)",
  border: "1px solid var(--sentinel-borde)",
  borderRadius: "var(--radio-m)",
  padding: "18px 20px"
};


const VISTAS = [
  {
    id: "hallazgos",
    etiqueta: "Hallazgos",
    icono: Search,
    estado: null,
    real: true
  },
  {
    id: "relaciones",
    etiqueta: "Mapa de relaciones",
    icono: Share2,
    estado: null,
    real: true,
    nota:
      "Antes «Knowledge Graph» en el menú principal. Es una vista de la investigación, no un motor aparte: siempre compartió el mismo resultado."
  },
  {
    id: "contraste",
    etiqueta: "Contraste / Lado B",
    icono: Layers,
    estado: "EN_PREPARACION",
    real: false,
    nota:
      "Confrontar lo que un actor afirma con lo que la evidencia observada sostiene. No hay motor todavía."
  },
  {
    id: "narrativas",
    etiqueta: "Narrativas",
    icono: FileText,
    estado: "EN_PREPARACION",
    real: false,
    nota:
      "Seguimiento de una narrativa a través de fuentes y tiempo. Requiere normalización de temas."
  },
  {
    id: "crisis",
    etiqueta: "Crisis",
    icono: AlertOctagon,
    estado: "EN_PREPARACION",
    real: false,
    nota:
      "Detección y seguimiento de un episodio de crisis. Requiere series temporales con métricas."
  },
  {
    id: "expedientes",
    etiqueta: "Expedientes",
    icono: Shield,
    estado: "EN_PREPARACION",
    real: false,
    nota:
      "Los expedientes de candidato viven hoy en Candidatos. Aquí llegarán los de actores que no son candidatos."
  }
];


export default function InvestigacionesModule({ investigacion, vistaInicial = "hallazgos" }) {
  const [vista, setVista] = useState(
    VISTAS.some((v) => v.id === vistaInicial) ? vistaInicial : "hallazgos"
  );

  const actual = VISTAS.find((v) => v.id === vista) || VISTAS[0];

  return (
    <div className="sentinel-fade">
      <header style={{ marginBottom: "14px" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "1.16rem",
            color: "var(--sentinel-texto)",
            letterSpacing: "0.01em"
          }}
        >
          Investigaciones
        </h1>

        <p
          style={{
            margin: "6px 0 0",
            fontSize: "0.78rem",
            color: "var(--sentinel-texto-suave)",
            maxWidth: "820px",
            lineHeight: 1.55
          }}
        >
          ¿Qué hay detrás de un actor? Una investigación con sus vistas. Los hallazgos y el
          mapa de relaciones comparten el mismo resultado: cambiar de vista no vuelve a
          consultar nada.
        </p>
      </header>

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
        {VISTAS.map((v) => {
          const activo = v.id === vista;

          const Icono = v.icono;

          return (
            <button
              key={v.id}
              onClick={() => setVista(v.id)}
              style={{
                padding: "6px 12px",
                borderRadius: "var(--radio-pill)",
                border: `1px solid ${activo ? "var(--sentinel-cyan)" : "transparent"}`,
                background: activo ? "rgba(0,212,255,.10)" : "transparent",
                color: activo
                  ? "#FFFFFF"
                  : v.real
                    ? "var(--sentinel-texto-suave)"
                    : "var(--sentinel-texto-tenue)",
                fontSize: "0.74rem",
                fontWeight: activo ? 650 : 500,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <Icono size={13} />
              {v.etiqueta}

              {v.estado ? <EstadoChip estado={v.estado} compacto /> : null}
            </button>
          );
        })}
      </nav>

      {/*
        Las dos vistas reales muestran el MISMO nodo montado por
        App. Se conserva en el DOM y se oculta, para no perder el
        resultado de una investigacion al cambiar de vista.
      */}
      <div style={{ display: actual.real ? "block" : "none" }}>
        {actual.nota && actual.id === "relaciones" ? (
          <p
            style={{
              margin: "0 0 12px",
              fontSize: "0.7rem",
              color: "var(--sentinel-texto-tenue)",
              lineHeight: 1.55,
              maxWidth: "820px"
            }}
          >
            {actual.nota}
          </p>
        ) : null}

        {investigacion}
      </div>

      {!actual.real ? (
        <div style={CAJA}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
              marginBottom: "10px"
            }}
          >
            <div
              style={{
                fontSize: "0.68rem",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--sentinel-cyan)",
                fontWeight: 600
              }}
            >
              {actual.etiqueta}
            </div>

            <EstadoChip estado={actual.estado} compacto />
          </div>

          <p
            style={{
              margin: 0,
              fontSize: "0.8rem",
              color: "var(--sentinel-texto-suave)",
              lineHeight: 1.65,
              maxWidth: "760px"
            }}
          >
            {actual.nota}
          </p>

          <p
            style={{
              margin: "12px 0 0",
              fontSize: "0.68rem",
              color: "var(--sentinel-texto-tenue)",
              lineHeight: 1.55
            }}
          >
            El destino existe en la navegación para que se sepa qué falta. No se muestra
            contenido simulado.
          </p>
        </div>
      ) : null}
    </div>
  );
}
