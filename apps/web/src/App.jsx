import { useCallback, useEffect, useRef, useState } from "react";
import { Server } from "lucide-react";

import "./styles/theme.css";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import OSINT from "./components/OSINT";
import AIRouter from "./components/AIRouter";
import Dashboard from "./components/Dashboard";
import ProjectsModule from "./components/ProjectsModule";
import TerritorialModule from "./territorio/TerritorialModule";
import MediaIntelligenceModule from "./media/MediaIntelligenceModule";

import ProjectHeader from "./workspace/ProjectHeader";
import ResumenModule from "./workspace/ResumenModule";
import SentinelAIModule from "./workspace/SentinelAIModule";
import InvestigacionesModule from "./workspace/InvestigacionesModule";
import SinProyecto from "./workspace/SinProyecto";
import { resolverModulo, moduloEsScoped, MODULO_POR_DEFECTO } from "./workspace/moduleRegistry";

/*
===========================================================
APP — Sprint UX-BRAND-001
===========================================================

Cambia el envoltorio de marca; no cambia una línea de lógica de
investigación. Todo lo que ocurre bajo Investigaciones sigue
siendo el mismo componente OSINT que ya funcionaba.

Dos decisiones que conviene dejar escritas:

1. El buscador del Header no duplica la búsqueda. App mantiene
   el texto y llama al handle que OSINT expone; OSINT —única
   puerta al Discovery Engine— es quien ejecuta.

2. Los módulos del menú que todavía no existen NO muestran una
   pantalla vacía: declaran qué son, en qué sprint se definieron
   y qué falta. Un menú que lleva a la nada hace perder el
   tiempo al analista.
===========================================================
*/

const BACKEND = "http://localhost:3001";

/*
-----------------------------------------------------------
BLOQUE D — CONSULTA DESDE LA URL

  /?q=Daniel+Noboa
  /investigacion?q=Daniel+Noboa

Se lee una sola vez, al arrancar. Sirve para compartir una
investigacion, para que el QA sea reproducible y para capturar
pantallas sin conducir la interfaz a mano.

No cambia el motor: rellena el buscador y dispara el MISMO
handle que usa el boton, que sigue siendo la unica puerta al
Discovery Engine.
-----------------------------------------------------------
*/
function consultaDeLaUrl() {
  try {
    const p = new URLSearchParams(window.location.search);

    /* Se admite q y tambien objetivo, por comodidad. */
    const v = p.get("q") || p.get("objetivo") || "";

    return v.replace(/\+/g, " ").trim();
  } catch {
    return "";
  }
}

/*
  `Reservado` se retira: era la pantalla de War Room y Correlacion
  Viva, las dos entradas que salen de la navegacion primaria. Sus
  ids siguen resolviendo en `moduleRegistry`, que redirige al
  destino donde hoy vive su respuesta, asi que ya no hace falta
  una pantalla que diga «esto no existe».
*/

export default function App() {
  /*
    Si la URL trae ?proyecto=, se abre el modulo de proyectos.

    Forma parte del arreglo de persistencia: sin esto, recargar
    con un proyecto abierto devolvia al usuario a Investigaciones
    y el proyecto seguia pareciendo perdido, aunque estuviera en
    disco y el modulo supiera recuperarlo.
  */
  /*
    SENTINEL-UX-CONSOLIDATION-01.

    El punto de entrada pasa a ser RESUMEN: la primera pregunta
    de un analista al abrir un proyecto es «¿que esta pasando?»,
    no «a quien investigo».

    `?modulo=` admite tambien los ids antiguos —war_room,
    knowledge_graph, correlacion—: `resolverModulo` los traduce
    al destino que hoy responde su pregunta en lugar de dejar el
    enlace roto.
  */
  const [modulo, setModulo] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search);

      const pedido = p.get("modulo") || p.get("m");

      if (pedido) return resolverModulo(pedido).id;

      return MODULO_POR_DEFECTO;
    } catch {
      return MODULO_POR_DEFECTO;
    }
  });

  /* Motivo de una redireccion de id antiguo, para decirlo una vez. */
  const [avisoRedireccion, setAvisoRedireccion] = useState(() => {
    try {
      const pedido =
        new URLSearchParams(window.location.search).get("modulo") ||
        new URLSearchParams(window.location.search).get("m");

      if (!pedido) return null;

      const r = resolverModulo(pedido);

      return r.redirigido ? r.motivo : null;
    } catch {
      return null;
    }
  });

  /*
    -----------------------------------------------------------
    PROYECTO ACTIVO — el contexto de todo el workspace

    Se lee de la URL (`?proyecto=`) para que un enlace sea
    reproducible, y se recuerda en `localStorage` para que
    recargar no devuelva al analista al punto de partida.

    Sin proyecto NO se muestran metricas globales mezcladas: el
    Lake contiene datos de varios proyectos y sumarlos daria
    cifras que no son de ninguna campana.
    -----------------------------------------------------------
  */
  const [proyectos, setProyectos] = useState([]);

  const [projectId, setProjectId] = useState(() => {
    try {
      const deLaUrl = new URLSearchParams(window.location.search).get("proyecto");

      return deLaUrl || window.localStorage.getItem("sentinel.proyecto") || "";
    } catch {
      return "";
    }
  });

  const [ventana, setVentana] = useState(() => {
    try {
      return window.localStorage.getItem("sentinel.ventana") || "7d";
    } catch {
      return "7d";
    }
  });

  const [seccionInvestigacion, setSeccionInvestigacion] = useState("hallazgos");

  const [consulta, setConsulta] = useState(consultaDeLaUrl);

  /*
    Handle de la investigacion. El buscador del Header lo invoca;
    la logica sigue viviendo entera en OSINT.
  */
  const osintRef = useRef(null);

  const [estado, setEstado] = useState({ cargando: false, tieneResultado: false });

  const [salud, setSalud] = useState({ vivo: false, detalle: "comprobando…" });

  /*
    ESTADO LIVE REAL

    Se consulta el endpoint de salud que ya existe. No se
    modifica ningún endpoint: solo se lee. Un LED verde fijo que
    no mide nada sería decoración que engaña.
  */
  useEffect(() => {
    let vigente = true;

    const comprobar = async () => {
      try {
        const r = await fetch(`${BACKEND}/api/health`);

        if (!r.ok) throw new Error(`HTTP ${r.status}`);

        const j = await r.json();

        if (vigente) {
          setSalud({
            vivo: j?.status === "ok",
            detalle: `backend v${j?.version || "?"} · activo ${j?.uptime || "—"}`
          });
        }
      } catch (e) {
        if (vigente) {
          setSalud({
            vivo: false,
            detalle: `sin respuesta del backend (${e?.message || "error"})`
          });
        }
      }
    };

    comprobar();

    const id = setInterval(comprobar, 30000);

    return () => {
      vigente = false;
      clearInterval(id);
    };
  }, []);

  /*
    Disparo automatico del deep link. Se hace en un efecto porque
    depende de que OSINT ya este montado para exponer su handle, y
    se marca con un ref para que no se repita en cada render.
  */
  const deepLinkLanzado = useRef(false);

  useEffect(() => {
    if (deepLinkLanzado.current) return;

    const inicial = consultaDeLaUrl();

    if (!inicial) return;

    deepLinkLanzado.current = true;

    /*
      No hace falta cambiar de modulo: "investigaciones" ya es el
      inicial. Llamar a setModulo aqui provocaria un render en
      cascada sin ganar nada.
    */

    /*
      SIN setTimeout, y por un motivo concreto.

      La primera version programaba el disparo con setTimeout y lo
      cancelaba en la limpieza del efecto. En StrictMode React
      ejecuta cada efecto DOS veces: la primera pasada programaba
      el disparo, la limpieza lo cancelaba, y la segunda salia
      antes por el flag. Resultado medido: el buscador se rellenaba
      con el nombre y la investigacion nunca arrancaba.

      No hace falta esperar: cuando este efecto corre, los hijos ya
      estan montados y el handle de OSINT existe.
    */
    if (osintRef.current) osintRef.current.buscar();
  }, []);

  /*
    -----------------------------------------------------------
    PROYECTOS ACTIVOS

    Una sola lectura al arrancar. Si el proyecto recordado ya no
    existe —se archivo o se elimino— NO se cae: se limpia y el
    workspace pide elegir uno.
    -----------------------------------------------------------
  */
  useEffect(() => {
    let vivo = true;

    const cargar = async () => {
      try {
        const r = await fetch(`${BACKEND}/api/proyectos/`);

        const j = await r.json();

        if (!vivo) return;

        const lista = j?.proyectos || [];

        setProyectos(lista);

        setProjectId((actual) => {
          if (actual && lista.some((p) => p.id === actual)) return actual;

          /*
            No se elige por nombre ni se codifica ningun proyecto:
            si hay uno solo se abre, y si hay varios se pide
            elegir en lugar de adivinar.
          */
          return lista.length === 1 ? lista[0].id : "";
        });
      } catch {
        if (vivo) setProyectos([]);
      }
    };

    const id = setTimeout(cargar, 0);

    return () => {
      vivo = false;

      clearTimeout(id);
    };
  }, []);


  /*
    El contexto se recuerda y se refleja en la URL, para que un
    enlace lleve exactamente a lo que el analista estaba viendo.
    `replaceState` y no `pushState`: cambiar de proyecto no debe
    llenar el historial de pasos intermedios.
  */
  useEffect(() => {
    try {
      if (projectId) window.localStorage.setItem("sentinel.proyecto", projectId);

      window.localStorage.setItem("sentinel.ventana", ventana);

      const url = new URL(window.location.href);

      if (projectId) url.searchParams.set("proyecto", projectId);
      else url.searchParams.delete("proyecto");

      url.searchParams.set("modulo", modulo);

      window.history.replaceState(null, "", url);
    } catch {
      /* Sin almacenamiento el workspace sigue funcionando. */
    }
  }, [projectId, ventana, modulo]);


  /*
    Navegar entre modulos, resolviendo ids antiguos. Es la unica
    puerta: asi un enlace guardado y un clic del menu pasan por
    la misma traduccion.
  */
  const irA = useCallback((id) => {
    const r = resolverModulo(id);

    setModulo(r.id);

    if (r.seccion) setSeccionInvestigacion(r.seccion);

    setAvisoRedireccion(r.redirigido ? r.motivo : null);
  }, []);


  const proyectoActivo = proyectos.find((p) => p.id === projectId) || null;

  const necesitaProyecto = moduloEsScoped(modulo) && !projectId;

  const lanzar = useCallback(() => {
    if (!consulta.trim()) return;

    setModulo("investigaciones");

    if (osintRef.current) osintRef.current.buscar();
  }, [consulta]);

  const investigacion = (
    <OSINT
      ref={osintRef}
      consultaExterna={consulta}
      onConsultaExterna={setConsulta}
      onEstado={setEstado}
    />
  );

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        minHeight: "100vh",
        background: "var(--sentinel-bg)",
        overflow: "hidden"
      }}
    >
      <Sidebar activo={modulo} onSeleccionar={irA} />

      <div
        style={{
          flex: 1,
          width: 0,
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh"
        }}
      >
        <Header
          enVivo={salud.vivo}
          detalleEnVivo={salud.detalle}
          consulta={consulta}
          onConsulta={setConsulta}
          onBuscar={lanzar}
          ocupado={estado.cargando}
        />

        {/*
          FRANJA DE CONTEXTO. Una linea con el proyecto activo y
          la ventana: lo unico que el analista necesita tener
          delante en todo momento.

          No se muestra en Configuracion, que no analiza nada, y
          la ventana solo aparece donde hay soporte temporal real
          —Resumen y Medios—: ofrecerla en una pantalla que la
          ignora ensena un control que no hace nada.
        */}
        {modulo !== "configuracion" ? (
          <ProjectHeader
            proyectos={proyectos}
            projectId={projectId}
            proyecto={proyectoActivo}
            ventana={ventana}
            mostrarVentana={["resumen", "media_pieza"].includes(modulo)}
            onProyecto={setProjectId}
            onVentana={setVentana}
          />
        ) : null}

        {avisoRedireccion ? (
          <div
            style={{
              padding: "8px 24px",
              background: "rgba(237,161,0,.07)",
              borderBottom: "1px solid #eda10033",
              color: "#eda100",
              fontSize: "0.72rem",
              lineHeight: 1.5
            }}
          >
            {avisoRedireccion}
          </div>
        ) : null}

        <main
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "24px",
            boxSizing: "border-box"
          }}
        >
          {/*
            SENTINEL-UX-CONSOLIDATION-01.

            Las secciones que dependen del proyecto no se montan
            sin uno: en su lugar se pide elegir. Sin proyecto NO
            se muestran metricas globales mezcladas, porque el
            Lake contiene varios proyectos —dos de ellos de
            prueba— y sumarlos daria cifras que no son de ninguna
            campana.
          */}
          {necesitaProyecto ? (
            <SinProyecto
              hayProyectos={proyectos.length > 0}
              seccion={modulo}
            />
          ) : null}

          {/*
            RESUMEN — el nuevo punto de entrada. Agrega lo que
            cada modulo ya mide; no calcula ninguna metrica
            propia.
          */}
          {!necesitaProyecto && modulo === "resumen" ? (
            <ResumenModule
              projectId={projectId}
              proyecto={proyectoActivo}
              ventana={ventana}
              onIrA={irA}
            />
          ) : null}

          {/*
            "Candidatos" es el modulo de PROYECTOS: los candidatos
            viven dentro de un proyecto, asi que es su sitio
            natural.
          */}
          {!necesitaProyecto && modulo === "candidatos" && <ProjectsModule />}

          {/*
            INVESTIGACIONES envuelve el MISMO nodo OSINT que ya se
            montaba, con dos vistas: hallazgos y mapa de
            relaciones. Se conserva en el DOM y se oculta, para no
            perder el resultado al cambiar de vista.

            El Knowledge Graph deja de ser entrada de menu: App ya
            montaba este mismo componente para los dos ids y solo
            cambiaba que se veia. El menu sugeria dos motores
            donde habia uno.
          */}
          <div style={{ display: modulo === "investigaciones" ? "block" : "none" }}>
            <InvestigacionesModule
              investigacion={investigacion}
              vistaInicial={seccionInvestigacion}
            />
          </div>

          {/*
            ARQ-GEO-001. El motor territorial existe y esta
            probado; lo que sigue sin existir es el MAPA, porque
            falta el GeoJSON oficial de las parroquias. El modulo
            lo declara en su propia interfaz en lugar de dibujar
            una geometria inventada.
          */}
          {!necesitaProyecto && modulo === "mapa" && <TerritorialModule />}

          {/*
            MEDIA — congelado tecnicamente en
            MEDIA-CORPUS-INTEGRATION-01. El id `media_pieza` se
            conserva por compatibilidad de enlaces; la etiqueta
            del menu dice «Medios».
          */}
          {!necesitaProyecto && modulo === "media_pieza" && (
            <MediaIntelligenceModule projectIdInicial={projectId} />
          )}

          {/*
            SENTINEL AI — destino real que declara que no esta
            conectado. Ninguna respuesta generada.
          */}
          {!necesitaProyecto && modulo === "sentinel_ai" ? (
            <SentinelAIModule proyecto={proyectoActivo} />
          ) : null}

          {modulo === "configuracion" && (
            <div
              className="sentinel-fade"
              style={{ display: "flex", flexDirection: "column", gap: "18px" }}
            >
              <section
                style={{
                  background: "var(--sentinel-surface)",
                  border: "1px solid var(--sentinel-borde)",
                  borderRadius: "var(--radio-l)",
                  padding: "24px",
                  maxWidth: "760px"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    alignItems: "center",
                    marginBottom: "14px"
                  }}
                >
                  <Server size={19} color="var(--sentinel-cyan)" />

                  <h1
                    style={{
                      margin: 0,
                      color: "#FFFFFF",
                      fontSize: "20px",
                      fontWeight: 650
                    }}
                  >
                    Configuración
                  </h1>
                </div>

                <div
                  style={{
                    color: "var(--sentinel-texto-suave)",
                    fontSize: "13px",
                    lineHeight: 1.8
                  }}
                >
                  <div>
                    Backend:{" "}
                    <strong
                      style={{
                        color: salud.vivo
                          ? "var(--sentinel-live)"
                          : "var(--sentinel-gray)"
                      }}
                    >
                      {salud.vivo ? "accesible" : "sin respuesta"}
                    </strong>{" "}
                    — {salud.detalle}
                  </div>

                  <div style={{ marginTop: "6px" }}>
                    Endpoint: <code>{BACKEND}</code>
                  </div>
                </div>
              </section>

              {/*
                Resumen y AI Router existen y funcionan, pero no
                figuran en el menú definitivo. Se conservan
                accesibles aquí para no dejar inalcanzable nada que
                ya funcionaba.
              */}
              <section
                style={{
                  background: "var(--sentinel-surface)",
                  border: "1px solid var(--sentinel-borde)",
                  borderRadius: "var(--radio-l)",
                  padding: "24px"
                }}
              >
                <div
                  style={{
                    color: "var(--sentinel-cyan)",
                    fontSize: "10px",
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    marginBottom: "14px"
                  }}
                >
                  Módulos técnicos
                </div>

                <p
                  style={{
                    color: "var(--sentinel-texto-tenue)",
                    fontSize: "12px",
                    marginTop: 0,
                    marginBottom: "16px"
                  }}
                >
                  Fuera del menú definitivo, conservados para no perder acceso a
                  lo que ya funcionaba.
                </p>

                <AIRouter />

                <div style={{ marginTop: "24px" }}>
                  <Dashboard />
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
