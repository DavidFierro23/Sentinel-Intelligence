import { useCallback, useEffect, useRef, useState } from "react";
import { Info, Server } from "lucide-react";

import "./styles/theme.css";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import OSINT from "./components/OSINT";
import AIRouter from "./components/AIRouter";
import Dashboard from "./components/Dashboard";

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

function Reservado({ titulo, descripcion, definidoEn, requiere }) {
  return (
    <section
      className="sentinel-fade"
      style={{
        background: "var(--sentinel-surface)",
        border: "1px solid var(--sentinel-borde)",
        borderRadius: "var(--radio-l)",
        padding: "28px",
        maxWidth: "760px"
      }}
    >
      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
        <Info
          size={20}
          color="var(--sentinel-cyan)"
          style={{ flexShrink: 0, marginTop: "3px" }}
        />

        <div>
          <h1
            style={{
              margin: 0,
              color: "#FFFFFF",
              fontSize: "21px",
              fontWeight: 650
            }}
          >
            {titulo}
          </h1>

          <p
            style={{
              color: "var(--sentinel-texto-suave)",
              fontSize: "13.5px",
              lineHeight: 1.7,
              marginTop: "12px"
            }}
          >
            {descripcion}
          </p>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              marginTop: "18px"
            }}
          >
            {definidoEn && (
              <span
                style={{
                  color: "var(--sentinel-cyan)",
                  fontSize: "11px",
                  border: "1px solid var(--sentinel-borde-vivo)",
                  borderRadius: "var(--radio-pill)",
                  padding: "5px 13px"
                }}
              >
                definido en {definidoEn}
              </span>
            )}

            <span
              style={{
                color: "var(--sentinel-texto-tenue)",
                fontSize: "11px",
                border: "1px solid var(--sentinel-borde)",
                borderRadius: "var(--radio-pill)",
                padding: "5px 13px"
              }}
            >
              pendiente: {requiere}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [modulo, setModulo] = useState("investigaciones");

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
      <Sidebar activo={modulo} onSeleccionar={setModulo} />

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
            Investigaciones, Knowledge Graph y Candidatos comparten
            el MISMO componente y el mismo resultado: son vistas de
            una investigación, no motores distintos. Montarlo una
            sola vez evita perder el resultado al cambiar de vista.
          */}
          <div
            style={{
              display: ["investigaciones", "knowledge_graph", "candidatos"].includes(
                modulo
              )
                ? "block"
                : "none"
            }}
          >
            {investigacion}
          </div>

          {modulo === "war_room" && (
            <Reservado
              titulo="War Room"
              descripcion="Sala de operaciones en tiempo real: mapa inteligente de Cuenca, capas territoriales, radar de candidatos, centro de alertas y Replay Intelligence. El diseño está completo y congelado; la implementación no se ha abierto."
              definidoEn="UX-WR-001 v2.0"
              requiere="sprint de implementación del War Room"
            />
          )}

          {modulo === "correlacion" && (
            <Reservado
              titulo="Correlación Viva"
              descripcion="Seguimiento continuo de la correspondencia de identidad: cómo sube o baja la confianza de cada cuenta a medida que llega evidencia nueva. Hoy la correlación se calcula una vez por investigación, no de forma continua."
              definidoEn="ARQ-SIL-001"
              requiere="Confidence Engine continuo"
            />
          )}

          {modulo === "mapa" && (
            <Reservado
              titulo="Mapa Territorial"
              descripcion="Mapa real de Cuenca con pines por tipo, mapa de calor por parroquia y filtros territoriales. Ninguna evidencia del Core lleva todavía coordenadas, así que no hay nada que situar sin inventarlo."
              definidoEn="UX-WR-001 v2.0"
              requiere="geocodificación de evidencias"
            />
          )}

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
