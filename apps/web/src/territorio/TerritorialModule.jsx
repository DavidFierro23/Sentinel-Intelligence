import { useEffect, useState } from "react";
import { Loader2, Play, Coins, AlertCircle, Globe2 } from "lucide-react";

import { TerritorialProvider } from "./TerritorialContext";
import { useTerritorial } from "./useTerritorial";

import TerritorySelect from "./controls/TerritorySelect";
import TimeRangeControl from "./controls/TimeRangeControl";
import NormalizationSelect from "./controls/NormalizationSelect";

import ResolutionNotice from "./panels/ResolutionNotice";
import CoverageDeclaration from "./panels/CoverageDeclaration";
import TerritorialRankingPanel from "./panels/TerritorialRankingPanel";
import ConversationVolumePanel from "./panels/ConversationVolumePanel";
import TopicsPanel from "./panels/TopicsPanel";
import MediaCoveragePanel from "./panels/MediaCoveragePanel";
import EnginesTracePanel from "./panels/EnginesTracePanel";
import UnknownsBlock from "./panels/UnknownsBlock";

/* Gate D */
import ExecutiveHeader from "./panels/ExecutiveHeader";
import CoverageWarning from "./panels/CoverageWarning";

/* --- TERRITORIAL-FRESH-01 --- */
import FreshnessPanel from "./panels/FreshnessPanel";
import ProvidersStatusPanel from "./panels/ProvidersStatusPanel";
import TerritorialWorkspace from "./TerritorialWorkspace";
import AgendaPanel from "./agenda/AgendaPanel";
import RadarPanel from "./agenda/RadarPanel";
import TopicDrawer from "./agenda/TopicDrawer";

/* --- Gate D2 --- */
import EntitiesPanel from "./agenda/EntitiesPanel";
import SourceAgendasPanel from "./agenda/SourceAgendasPanel";
import DigitalBehaviorPanel from "./panels/DigitalBehaviorPanel";

/* Gate F1 */
import TerritorialMap from "./map/TerritorialMap";
import PlacesWithoutGeometry from "./map/PlacesWithoutGeometry";
import TerritoryPanel from "./map/TerritoryPanel";

/*
===========================================================
INTELIGENCIA TERRITORIAL Y CONVERSACION PUBLICA
===========================================================

Contenedor del modulo. Precursor sin mapa del War Room: mismo
motor territorial, misma paleta validada, mismas reglas de
honestidad, sin la geometria que todavia no existe.

POR QUE NO SE EJECUTA SOLO AL ABRIR
-----------------------------------------------------------

El analisis toca la red y —en modo web— gasta saldo de
SerpAPI, que es mensual y compartido con el Discovery Engine.
Un modulo que se lanza al montarse consumiria recursos cada
vez que alguien pincha en el menu por curiosidad.

Asi que el analista pulsa. Y antes de pulsar ve el coste del
modo elegido.

ORDEN DE LECTURA
-----------------------------------------------------------

  cobertura y coste   sobre que se construyo todo
  resolucion (GEO-1)  hasta donde se puede leer
  ranking             donde
  volumen             desde cuando
  temas y encuadre    de que
  medios              quien lo publica
  lo que no sabemos   que falta

«Lo que no sabemos» cierra y no abre, pero no esta escondido:
es la ultima cosa que se lee antes de decidir.
===========================================================
*/

const MODOS = [
  {
    id: "lake",
    texto: "Solo histórico",
    coste: "sin coste",
    detalle: "Únicamente lo ya almacenado en el Knowledge Lake."
  },
  {
    id: "noticias",
    texto: "Histórico + noticias",
    coste: "sin coste",
    detalle: "Añade titulares de Google News por RSS. No gasta cuota."
  },
  {
    /*
      Escucha ampliada: activa los adapters que INGEST-REAL-01
      dejo escritos —RSS directo, GDELT y YouTube—. No es un
      motor nuevo: el recolector base sigue funcionando igual y
      sus evidencias se funden con estas.

      Cuesta cuota de YouTube (100 unidades por pasada, de
      10.000 diarias) y por eso se pide explicitamente.
    */
    id: "ampliado",
    texto: "Escucha ampliada",
    coste: "cuota de YouTube",
    detalle:
      "Añade RSS directo, GDELT y YouTube al recolector base. Una búsqueda de YouTube cuesta 100 de las 10.000 unidades diarias."
  },
  {
    id: "web",
    texto: "Añadir búsqueda web",
    coste: "gasta cuota",
    detalle:
      "Añade hasta 3 consultas web. Consume saldo mensual de SerpAPI, compartido con el Discovery Engine."
  }
];


function Barra() {
  const { modo, setModo, analizar, cargando, datos } = useTerritorial();

  const modoActual = MODOS.find((m) => m.id === modo);

  const gasta = modo === "web" || modo === "ampliado";

  return (
    <section
      style={{
        background: "var(--sentinel-surface)",
        border: "1px solid var(--sentinel-borde)",
        borderRadius: "var(--radio-l)",
        padding: "18px 20px",
        display: "flex",
        flexWrap: "wrap",
        gap: "22px",
        alignItems: "flex-start"
      }}
    >
      <TerritorySelect />

      <TimeRangeControl />

      <NormalizationSelect />

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
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
          <Coins size={11} />
          Fuentes y coste
        </span>

        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {MODOS.map((m) => {
            const activo = modo === m.id;

            return (
              <button
                key={m.id}
                onClick={() => setModo(m.id)}
                title={m.detalle}
                style={{
                  padding: "5px 11px",
                  borderRadius: "var(--radio-pill)",
                  border: `1px solid ${
                    activo
                      ? m.id === "web"
                        ? "#c98500"
                        : "var(--sentinel-cyan)"
                      : "var(--sentinel-borde)"
                  }`,
                  background: activo ? "rgba(11,95,255,.18)" : "transparent",
                  color: activo ? "#FFFFFF" : "var(--sentinel-texto-suave)",
                  fontSize: "11px",
                  fontWeight: activo ? 650 : 500,
                  cursor: "pointer"
                }}
              >
                {m.texto}
              </button>
            );
          })}
        </div>

        <span
          style={{
            color: gasta ? "#eda100" : "var(--sentinel-texto-tenue)",
            fontSize: "10px",
            lineHeight: 1.6,
            maxWidth: "300px"
          }}
        >
          {modoActual?.detalle}
        </span>
      </div>

      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          alignItems: "flex-end"
        }}
      >
        <button
          onClick={analizar}
          disabled={cargando}
          className="sentinel-boton sentinel-boton-primario"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            padding: "10px 18px",
            fontSize: "12.5px",
            fontWeight: 650,
            cursor: cargando ? "wait" : "pointer"
          }}
        >
          {cargando ? (
            <Loader2 size={14} className="spin" />
          ) : (
            <Play size={14} />
          )}

          {cargando
            ? "Recolectando…"
            : datos
              ? "Actualizar ahora"
              : "Analizar"}
        </button>

        {datos?.costo && (
          <span
            style={{
              color: "var(--sentinel-texto-tenue)",
              fontSize: "10px"
            }}
          >
            {datos.costo.declaracion}
          </span>
        )}
      </div>
    </section>
  );
}


function Contenido() {
  const { datos, error, cargando, cargarCatalogo } = useTerritorial();

  const [temaAbierto, setTemaAbierto] = useState(null);

  const [unidadAbierta, setUnidadAbierta] = useState(null);

  useEffect(() => {
    cargarCatalogo();
  }, [cargarCatalogo]);

  return (
    <div
      className="sentinel-fade"
      style={{ display: "flex", flexDirection: "column", gap: "18px" }}
    >
      {/*
        La cabecera ejecutiva sustituye al titulo simple: ahora
        lleva las cinco cifras del motor. Se muestra solo con
        datos, asi que aqui queda el titulo minimo mientras no
        los hay.
      */}
      {!datos && (
        <header>
          <h1
            style={{
              margin: 0,
              color: "#FFFFFF",
              fontSize: "21px",
              fontWeight: 650,
              display: "flex",
              alignItems: "center",
              gap: "10px"
            }}
          >
            <Globe2 size={20} color="var(--sentinel-cyan)" />
            Inteligencia Territorial
          </h1>

          <p
            style={{
              color: "var(--sentinel-texto-suave)",
              fontSize: "12.5px",
              lineHeight: 1.7,
              marginTop: "8px",
              maxWidth: "760px"
            }}
          >
            ¿Qué está pasando en el territorio? Agenda observada, radar de
            temas y mapa con las geometrías oficiales disponibles.
          </p>
        </header>
      )}

      <Barra />

      {error && (
        <div
          style={{
            display: "flex",
            gap: "9px",
            alignItems: "flex-start",
            background: "rgba(208,59,59,.10)",
            border: "1px solid #d03b3b",
            borderRadius: "var(--radio-m)",
            padding: "12px 14px",
            color: "var(--sentinel-texto-suave)",
            fontSize: "12px",
            lineHeight: 1.65
          }}
        >
          <AlertCircle
            size={15}
            color="#d03b3b"
            style={{ flexShrink: 0, marginTop: "1px" }}
          />

          <div>
            {error}
            {datos && (
              <div
                style={{
                  color: "var(--sentinel-texto-tenue)",
                  fontSize: "11px",
                  marginTop: "4px"
                }}
              >
                Se conserva el resultado del análisis anterior.
              </div>
            )}
          </div>
        </div>
      )}

      {!datos && !cargando && (
        <section
          style={{
            background: "var(--sentinel-surface)",
            border: "1px solid var(--sentinel-borde)",
            borderRadius: "var(--radio-l)",
            padding: "28px",
            color: "var(--sentinel-texto-suave)",
            fontSize: "12.5px",
            lineHeight: 1.8,
            maxWidth: "720px"
          }}
        >
          Declare el territorio y pulse <strong>Analizar</strong>. El modo por
          defecto no consume saldo de SerpAPI.
          <div
            style={{
              color: "var(--sentinel-texto-tenue)",
              fontSize: "11.5px",
              marginTop: "10px"
            }}
          >
            El análisis no se lanza solo al abrir el módulo: toca la red y, en
            modo web, gasta cuota compartida con el Discovery Engine.
          </div>
        </section>
      )}

      {datos && (
        <>
          {/*
            ORDEN EJECUTIVO. Responde en este orden:
            que pasa -> donde -> de que -> como cambia ->
            como aparece -> quien publica -> por que lo decimos
            -> que no sabemos.
          */}
          <ExecutiveHeader datos={datos} />

          <CoverageWarning limitaciones={datos.coverageLimitations} />

          {/*
            La frescura va ARRIBA, antes de la agenda. Un
            analista que lee «14 temas» sin saber que 55 de 63
            evidencias son de otros días interpreta mal la
            pantalla entera.
          */}
          <FreshnessPanel frescura={datos.frescura} />

          <ProvidersStatusPanel datos={datos} />

          {/*
            WORKSPACE TERRITORIAL — TERRITORIAL-ACCELERATION-02

            Sustituye a `TopicTerritoryPanel`, que hacia solo la
            matriz. Nueve secciones sobre el mismo corpus y con el
            proyecto como ambito; sin proyecto no se muestra nada,
            porque una cifra global leida como si fuera de una
            campaña informa peor que no tener cifra.

            Se carga A DEMANDA contra el corpus persistido:
            `/analisis` recolecta —invoca Google News— y abrir una
            vista de temas no puede costar una recoleccion.
          */}
          <TerritorialWorkspace
            projectId={datos?.proyecto?.id || datos?.proyecto?.proyectoId || null}
            projectName={datos?.proyecto?.nombre || null}
            territorioId={datos?.territorio?.ambito?.unidadId || datos?.ambito?.unidadId || null}
          />

          <AgendaPanel
            agenda={datos.agenda}
            onAbrirTema={setTemaAbierto}
            temaAbierto={temaAbierto}
          />

          <RadarPanel agenda={datos.agenda} onAbrirTema={setTemaAbierto} />

          {/*
            Las entidades van JUSTO detrás de la agenda, no al
            final. Desde D2 salieron del ranking temático, y
            enterrarlas abajo equivaldría a haberlas borrado.
          */}
          <EntitiesPanel escucha={datos.escuchaAbierta} />

          <SourceAgendasPanel escucha={datos.escuchaAbierta} />

          <TerritorialMap
            mapa={datos.mapa}
            onSeleccionar={setUnidadAbierta}
            seleccionada={unidadAbierta}
          />

          {unidadAbierta && (
            <TerritoryPanel
              unidad={unidadAbierta}
              onCerrar={() => setUnidadAbierta(null)}
            />
          )}

          <PlacesWithoutGeometry
            mapa={datos.mapa}
            onSeleccionar={setUnidadAbierta}
          />

          <CoverageDeclaration datos={datos} />

          <ResolutionNotice
            resolucion={datos.territorio?.resolucion}
            geo1={datos.territorio?.agregado?.geo1}
          />

          <TerritorialRankingPanel
            agregado={datos.territorio?.agregado}
            normalizacion={datos.territorio?.normalizacion}
          />

          <ConversationVolumePanel
            conversacion={datos.conversacion}
            serieTerritorial={datos.territorio?.serie}
          />

          <TopicsPanel conversacion={datos.conversacion} />

          <MediaCoveragePanel conversacion={datos.conversacion} />

          <DigitalBehaviorPanel />

          <EnginesTracePanel recoleccion={datos.conversacion?.recoleccion} />

          <UnknownsBlock items={datos.loQueNoSabemos} />

          <TopicDrawer
            tema={temaAbierto}
            evidencias={datos.evidenciasEnriquecidas || []}
            onCerrar={() => setTemaAbierto(null)}
          />
        </>
      )}
    </div>
  );
}


export default function TerritorialModule() {
  return (
    <TerritorialProvider>
      <Contenido />
    </TerritorialProvider>
  );
}
