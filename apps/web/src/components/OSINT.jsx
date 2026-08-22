import { useMemo, useState } from "react";
import {
  Search,
  ShieldCheck,
  ExternalLink,
  Loader2,
  UserCircle
} from "lucide-react";

import KnowledgeGraph from "./KnowledgeGraph";
import IdentityCorrelationPanel from "./IdentityCorrelationPanel";
import ReferenceProfilePanel from "./ReferenceProfilePanel";
import SocialAccountsPanel from "./SocialAccountsPanel";
import ExecutiveProfilePanel from "./ExecutiveProfilePanel";

export default function OSINT() {
  const [consulta, setConsulta] = useState("");
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [entidadActiva, setEntidadActiva] = useState("Todas");

  async function ejecutarBusqueda() {
    if (!consulta.trim()) return;

    setCargando(true);

    try {
      const res = await fetch(
        `http://localhost:3001/api/osint/google/${encodeURIComponent(consulta)}`
      );

      const data = await res.json();

      if (data.error) alert(data.error);
      else {
        setResultado(data);
        setEntidadActiva("Todas");
      }
    } catch {
      alert("No fue posible conectar con Sentinel Backend.");
    } finally {
      setCargando(false);
    }
  }

  const entidades = useMemo(() => resultado?.entidades || [], [resultado]);

  const evidencias = useMemo(() => {
    if (!resultado?.resultados) return [];
    if (entidadActiva === "Todas") return resultado.resultados;

    return resultado.resultados.filter((item) =>
      `${item.titulo || ""} ${item.descripcion || ""}`
        .toLowerCase()
        .includes(entidadActiva.toLowerCase())
    );
  }, [resultado, entidadActiva]);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        padding: "24px",
        color: "white",
        overflowX: "hidden"
      }}
    >
      {/* CABECERA */}

      <div
        style={{
          textAlign: "center",
          marginBottom: "30px"
        }}
      >
        <h1
          style={{
            fontSize: "clamp(38px,5vw,60px)",
            margin: 0
          }}
        >
          Centro OSINT
        </h1>

        <p
          style={{
            color: "#93C5FD",
            marginTop: "12px"
          }}
        >
          Motor de Inteligencia de Fuentes Abiertas de Sentinel.
        </p>
      </div>

      {/* BUSCADOR */}

      <div
        style={{
          display: "flex",
          width: "100%",
          border: "1px solid #2563EB",
          borderRadius: "18px",
          overflow: "hidden",
          marginBottom: "28px",
          boxShadow: "0 0 18px rgba(37,99,235,.25)"
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            background: "#08142F",
            padding: "0 18px"
          }}
        >
          <Search color="#60A5FA" size={22} />

          <input
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            placeholder="Persona, empresa, IP, dominio, correo o URL..."
            onKeyDown={(e) => e.key === "Enter" && ejecutarBusqueda()}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "white",
              padding: "18px",
              fontSize: "16px"
            }}
          />
        </div>

        <button
          onClick={ejecutarBusqueda}
          disabled={cargando}
          style={{
            width: "180px",
            background: cargando ? "#1E40AF" : "#2563EB",
            color: "white",
            border: "none",
            cursor: cargando ? "wait" : "pointer",
            fontWeight: "700",
            fontSize: "17px"
          }}
        >
          {cargando ? (
            <span
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <Loader2 size={18} className="spin" />
              Analizando
            </span>
          ) : (
            "🔍 Investigar"
          )}
        </button>
      </div>

      {resultado && (
        <>
          {/* TARJETA OBJETIVO */}

          <div
            style={{
              width: "100%",
              background: "#08142F",
              border: "1px solid #1E3A8A",
              borderRadius: "22px",
              padding: "34px",
              textAlign: "center",
              boxSizing: "border-box",
              marginBottom: "28px"
            }}
          >
            <div
              style={{
                color: "#60A5FA",
                letterSpacing: "3px",
                fontSize: "12px"
              }}
            >
              OBJETIVO PREPARADO
            </div>

            <h2
              style={{
                fontSize: "clamp(34px,4vw,50px)",
                marginTop: "18px",
                marginBottom: "14px"
              }}
            >
              {resultado.objetivo}
            </h2>

            <p
              style={{
                color: "#CBD5E1",
                margin: 0
              }}
            >
              Fusion Engine inició una investigación estructurada.
            </p>
          </div>

          {/* REPORTE */}

          <div
            style={{
              width: "100%",
              background: "#08142F",
              border: "1px solid #1E3A8A",
              borderRadius: "22px",
              padding: "26px",
              boxSizing: "border-box"
            }}
          >
            <h2
              style={{
                textAlign: "center",
                marginBottom: "20px"
              }}
            >
              Sentinel Intelligence Report
            </h2>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: "24px"
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  border: "1px solid #2563EB",
                  borderRadius: "999px",
                  padding: "10px 22px"
                }}
              >
                <ShieldCheck color="#60A5FA" size={18} />
                Conectado
              </div>
            </div>

            {/* PERFIL DE REFERENCIA + FICHA CONSOLIDADA */}

            <ReferenceProfilePanel
              perfil={resultado.perfilReferencia}
              ficha={resultado.fichaObjetivo}
            />

            {/* CUENTAS CANDIDATAS · Social Intelligence Layer */}

            {/*
              ARQ-PUI-001 Bloque F — va ANTES del panel de
              candidatas: primero lo que se atribuye al objetivo,
              despues el material bruto del descubrimiento.
            */}
            <ExecutiveProfilePanel perfil={resultado.perfilEjecutivo} />

            <SocialAccountsPanel
              cuentas={resultado.fichaObjetivo?.cuentas || []}
              cobertura={resultado.fichaObjetivo?.coberturaPlataformas || []}
              limites={resultado.fichaObjetivo?.limites || null}
              metricas={resultado.fichaObjetivo?.metricas || null}
              origenDescubrimiento={resultado.origenDescubrimiento || null}
            />

            {/* GRAFO */}

            <KnowledgeGraph resultado={resultado} />

            {/* IDENTIDADES */}

           <IdentityCorrelationPanel
  identidades={resultado.identidadesDescubiertas || []}
/>

            <div
              style={{
                marginTop: "34px",
                background: "#0B1738",
                borderRadius: "20px",
                padding: "24px"
              }}
            >
              <h3
                style={{
                  textAlign: "center",
                  marginBottom: "20px"
                }}
              >
                Explorador de Evidencias
              </h3>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "10px",
                  marginBottom: "24px"
                }}
              >
                <button
                  onClick={() => setEntidadActiva("Todas")}
                  style={boton(entidadActiva === "Todas")}
                >
                  Todas ({resultado.total})
                </button>

                {entidades.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setEntidadActiva(e.nombre)}
                    style={boton(entidadActiva === e.nombre)}
                  >
                    {e.nombre} ({e.evidencias})
                  </button>
                ))}
              </div>

              <div
                style={{
                  textAlign: "center",
                  color: "#93C5FD",
                  marginBottom: "18px"
                }}
              >
                Mostrando: <strong>{entidadActiva}</strong>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px"
                }}
              >
                {evidencias.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      background: "#08142F",
                      border: "1px solid #1E3A8A",
                      borderRadius: "16px",
                      padding: "18px"
                    }}
                  >
                    <h4
                      style={{
                        color: "#60A5FA",
                        marginTop: 0
                      }}
                    >
                      {item.titulo}
                    </h4>

                    <p>{item.descripcion}</p>

                    {item.enlace && (
                      <a
                        href={item.enlace}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          color: "#60A5FA",
                          textDecoration: "none",
                          display: "flex",
                          gap: "8px",
                          alignItems: "center"
                        }}
                      >
                        <ExternalLink size={15} />
                        Abrir fuente
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function boton(activo) {
  return {
    background: activo ? "#2563EB" : "transparent",
    color: "white",
    border: "1px solid #2563EB",
    borderRadius: "999px",
    padding: "10px 16px",
    cursor: "pointer"
  };
}