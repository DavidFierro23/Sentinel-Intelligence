import { useState } from "react";
import {
  LayoutDashboard,
  Search,
  Bot,
  FileText,
  Shield
} from "lucide-react";

import OSINT from "./components/OSINT";
import AIRouter from "./components/AIRouter";
import Dashboard from "./components/Dashboard";

export default function App() {
  const [modulo, setModulo] = useState("osint");

  const Item = ({ id, icon, texto }) => (
    <button
      onClick={() => setModulo(id)}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "14px 16px",
        borderRadius: "12px",
        border: "none",
        cursor: "pointer",
        background: modulo === id ? "#1D4ED8" : "transparent",
        color: "white",
        fontWeight: modulo === id ? 700 : 500,
        textAlign: "left",
        transition: ".2s"
      }}
    >
      {icon}
      {texto}
    </button>
  );

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        minHeight: "100vh",
        background: "#020F2F",
        overflow: "hidden"
      }}
    >
      {/* SIDEBAR */}

      <aside
        style={{
          width: "170px",
          minWidth: "170px",
          background: "#04153A",
          borderRight: "1px solid #123A7A",
          padding: "22px 14px",
          display: "flex",
          flexDirection: "column",
          gap: "18px"
        }}
      >
        <h2
          style={{
            color: "#3B82F6",
            margin: 0,
            marginBottom: "18px"
          }}
        >
          SENTINEL
        </h2>

        <Item
          id="dashboard"
          icon={<LayoutDashboard size={20} />}
          texto="Dashboard"
        />

        <Item
          id="osint"
          icon={<Search size={20} />}
          texto="OSINT"
        />

        <Item
          id="router"
          icon={<Bot size={20} />}
          texto="AI Router"
        />

        <Item
          id="reportes"
          icon={<FileText size={20} />}
          texto="Reportes"
        />

        <Item
          id="seguridad"
          icon={<Shield size={20} />}
          texto="Seguridad"
        />
      </aside>

      {/* CONTENIDO */}

      <main
        style={{
          flex: 1,
          width: 0,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "24px",
          background: "#020F2F"
        }}
      >
        {modulo === "dashboard" && <Dashboard />}

        {modulo === "osint" && <OSINT />}

        {modulo === "router" && <AIRouter />}

        {modulo === "reportes" && (
          <div style={{ color: "white" }}>
            Próximamente Reportes.
          </div>
        )}

        {modulo === "seguridad" && (
          <div style={{ color: "white" }}>
            Próximamente Seguridad.
          </div>
        )}
      </main>
    </div>
  );
}