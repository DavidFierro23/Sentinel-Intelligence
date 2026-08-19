import { useState } from "react";
import OSINT from "./OSINT";
import AIRouter from "./AIRouter";

import {
  Search,
  Brain,
  FileText,
  Shield,
  Home
} from "lucide-react";

export default function Dashboard() {
  const [modulo, setModulo] = useState("Dashboard");

  const Item = ({ nombre, icono }) => (
    <button
      onClick={() => setModulo(nombre)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        width: "100%",
        background: modulo === nombre ? "#1E3A8A" : "transparent",
        color: "white",
        border: "none",
        padding: "14px",
        borderRadius: "10px",
        cursor: "pointer",
        marginBottom: "8px",
        transition: "0.2s"
      }}
    >
      {icono}
      {nombre}
    </button>
  );

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#020B24",
        color: "white"
      }}
    >
      {/* Sidebar */}

      <div
        style={{
          width: "240px",
          background: "#06122F",
          padding: "20px",
          borderRight: "1px solid #163A70"
        }}
      >
        <h2 style={{ color: "#3B82F6", marginBottom: "25px" }}>
          SENTINEL
        </h2>

        <Item nombre="Dashboard" icono={<Home size={20} />} />
        <Item nombre="OSINT" icono={<Search size={20} />} />
        <Item nombre="AI Router" icono={<Brain size={20} />} />
        <Item nombre="Reportes" icono={<FileText size={20} />} />
        <Item nombre="Seguridad" icono={<Shield size={20} />} />
      </div>

      {/* Contenido */}

      <div
        style={{
          flex: 1,
          padding: "40px"
        }}
      >
        {modulo === "Dashboard" && (
          <>
            <h1>Dashboard</h1>

            <p style={{ color: "#A5B4FC" }}>
              Módulo activo de Sentinel Intelligence Platform
            </p>

            {/* Métricas */}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,1fr)",
                gap: "20px",
                marginTop: "30px"
              }}
            >
              {[
                ["Motores", "3"],
                ["Fuentes", "12"],
                ["Reportes", "0"],
                ["Estado", "Online"]
              ].map(([titulo, valor]) => (
                <div
                  key={titulo}
                  style={{
                    background: "#0B1738",
                    borderRadius: "18px",
                    padding: "25px",
                    textAlign: "center",
                    border: "1px solid #173E77"
                  }}
                >
                  <h1 style={{ color: "#60A5FA", margin: 0 }}>
                    {valor}
                  </h1>

                  <p>{titulo}</p>
                </div>
              ))}
            </div>

            {/* Pipeline */}

            <div
              style={{
                marginTop: "25px",
                background: "#0B1738",
                borderRadius: "18px",
                padding: "30px"
              }}
            >
              <h2>Pipeline de Inteligencia</h2>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-around",
                  marginTop: "25px"
                }}
              >
                {["Observe", "Understand", "Explain"].map((etapa) => (
                  <div
                    key={etapa}
                    style={{
                      textAlign: "center"
                    }}
                  >
                    <div
                      style={{
                        width: "80px",
                        height: "80px",
                        borderRadius: "50%",
                        background: "#2563EB",
                        margin: "0 auto"
                      }}
                    />

                    <p>{etapa}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Estado */}

            <div
              style={{
                marginTop: "25px",
                background: "#0B1738",
                borderRadius: "18px",
                padding: "25px"
              }}
            >
              <h2>Actividad en tiempo real</h2>

              <div
                style={{
                  marginTop: "15px",
                  borderLeft: "3px solid #2563EB",
                  paddingLeft: "15px"
                }}
              >
                <p>🟢 Sentinel Core iniciado.</p>
                <p>🔎 Centro OSINT operativo.</p>
                <p>🤖 AI Router listo.</p>
                <p>📄 Reportes preparados.</p>
              </div>
            </div>
          </>
        )}

        {/* OSINT */}

        {modulo === "OSINT" && <OSINT />}

        {/* AI ROUTER */}

        {modulo === "AI Router" && <AIRouter />}

        {/* REPORTES */}

        {modulo === "Reportes" && (
          <>
            <h1>Reportes</h1>

            <p style={{ color: "#A5B4FC" }}>
              Generación automática de informes ejecutivos.
            </p>

            <div
              style={{
                marginTop: "25px",
                background: "#0B1738",
                borderRadius: "18px",
                padding: "30px"
              }}
            >
              <h2>Exportaciones disponibles</h2>

              <ul style={{ lineHeight: "2" }}>
                <li>PDF Ejecutivo</li>
                <li>Word Institucional</li>
                <li>PowerPoint Automático</li>
                <li>Informe OSINT</li>
                <li>Resumen IA</li>
              </ul>
            </div>
          </>
        )}

        {/* SEGURIDAD */}

        {modulo === "Seguridad" && (
          <>
            <h1>Seguridad</h1>

            <p style={{ color: "#A5B4FC" }}>
              Centro de administración de Sentinel.
            </p>

            <div
              style={{
                marginTop: "25px",
                background: "#0B1738",
                borderRadius: "18px",
                padding: "30px"
              }}
            >
              <h2>Estado del sistema</h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3,1fr)",
                  gap: "20px",
                  marginTop: "20px"
                }}
              >
                {[
                  ["Usuarios", "1"],
                  ["API Keys", "0"],
                  ["Auditoría", "Activa"]
                ].map(([t, v]) => (
                  <div
                    key={t}
                    style={{
                      background: "#08142F",
                      border: "1px solid #173E77",
                      borderRadius: "15px",
                      padding: "20px",
                      textAlign: "center"
                    }}
                  >
                    <h2 style={{ color: "#60A5FA", margin: 0 }}>
                      {v}
                    </h2>

                    <p>{t}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}