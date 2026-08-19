import { useState } from "react";
import {
  Brain,
  Sparkles,
  Route,
  DollarSign,
  Clock,
  ShieldCheck,
  Send
} from "lucide-react";
import { ejecutarSentinel } from "../services/sentinelBridge";

export default function AIRouter() {
  const [prompt, setPrompt] = useState("");
  const [resultado, setResultado] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(false);

  function detectarRuta(texto) {
    const t = texto.toLowerCase();

    if (
      t.includes("osint") ||
      t.includes("investiga") ||
      t.includes("facebook") ||
      t.includes("instagram") ||
      t.includes("tiktok") ||
      t.includes("youtube") ||
      t.includes("google") ||
      t.includes("x")
    ) {
      return {
        modelo: "Claude",
        confianza: "98%",
        costo: "Optimizado",
        tiempo: "8-15 s",
        motivo: "Investigación OSINT y análisis contextual."
      };
    }

    if (
      t.includes("imagen") ||
      t.includes("logo") ||
      t.includes("diseño") ||
      t.includes("render")
    ) {
      return {
        modelo: "Gemini",
        confianza: "96%",
        costo: "Medio",
        tiempo: "15-30 s",
        motivo: "Generación y análisis visual."
      };
    }

    if (
      t.includes("codigo") ||
      t.includes("código") ||
      t.includes("react") ||
      t.includes("javascript") ||
      t.includes("python")
    ) {
      return {
        modelo: "GPT",
        confianza: "99%",
        costo: "Optimizado",
        tiempo: "5-12 s",
        motivo: "Desarrollo de software."
      };
    }

    if (
      t.includes("rápido") ||
      t.includes("rapido") ||
      t.includes("resumen")
    ) {
      return {
        modelo: "DeepSeek",
        confianza: "94%",
        costo: "Muy bajo",
        tiempo: "2-6 s",
        motivo: "Respuesta rápida."
      };
    }

    return {
      modelo: "Auto",
      confianza: "90%",
      costo: "Variable",
      tiempo: "5-20 s",
      motivo: "Selección automática."
    };
  }

  async function ejecutar() {
    if (!prompt.trim()) return;

    setCargando(true);

    const ruta = detectarRuta(prompt);

    const respuesta = await ejecutarSentinel(prompt);

    const nuevoResultado = {
      ...ruta,
      sentinel: respuesta
    };

    setResultado(nuevoResultado);

    setHistorial((prev) => [
      {
        id: Date.now(),
        objetivo: prompt,
        ...ruta
      },
      ...prev
    ]);

    setCargando(false);
  }

  return (
    <div>
      <h1 style={{ fontSize: 46, marginBottom: 8 }}>AI Router</h1>

      <p style={{ color: "#A5B4FC" }}>
        Enrutador inteligente del ecosistema Sentinel.
      </p>

      <div
        style={{
          marginTop: 30,
          background: "#0B1738",
          borderRadius: 18,
          padding: 25,
          border: "1px solid #1E3A8A"
        }}
      >
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ejemplo: Investiga Vocero593 en Facebook, TikTok y Google."
          style={{
            width: "100%",
            height: 140,
            background: "#08142F",
            color: "white",
            border: "1px solid #173E77",
            borderRadius: 12,
            padding: 15,
            fontSize: 15,
            resize: "none"
          }}
        />

        <button
          onClick={ejecutar}
          disabled={cargando}
          style={{
            marginTop: 20,
            background: cargando ? "#1E3A8A" : "#2563EB",
            color: "white",
            border: "none",
            padding: "14px 24px",
            borderRadius: 10,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8
          }}
        >
          <Send size={18} />
          {cargando ? "Analizando..." : "Enrutar Inteligencia"}
        </button>
      </div>

      {resultado && (
        <div
          style={{
            marginTop: 30,
            background: "#0B1738",
            borderRadius: 18,
            padding: 25,
            border: "1px solid #1E3A8A"
          }}
        >
          <h2>Ruta seleccionada</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 18,
              marginTop: 20
            }}
          >
            <Tarjeta titulo="Modelo" valor={resultado.modelo} icono={<Brain />} />
            <Tarjeta titulo="Costo" valor={resultado.costo} icono={<DollarSign />} />
            <Tarjeta titulo="Modo" valor="Automático" icono={<Route />} />
            <Tarjeta titulo="Confianza" valor={resultado.confianza} icono={<ShieldCheck />} />
            <Tarjeta titulo="Tiempo" valor={resultado.tiempo} icono={<Clock />} />
            <Tarjeta titulo="Pipeline" valor="Observe" icono={<Sparkles />} />
          </div>

          <div
            style={{
              marginTop: 25,
              background: "#08142F",
              borderRadius: 15,
              padding: 20
            }}
          >
            <h3>Decisión del Router</h3>

            <p style={{ color: "#CBD5E1" }}>
              Objetivo: <strong>{prompt}</strong>
            </p>

            <p style={{ color: "#60A5FA" }}>
              Modelo elegido: <strong>{resultado.modelo}</strong>
            </p>

            <p style={{ color: "#A5B4FC" }}>{resultado.motivo}</p>
          </div>

          <div
            style={{
              marginTop: 25,
              background: "#08142F",
              borderRadius: 15,
              padding: 20
            }}
          >
            <h3>Resultado del Sentinel Core</h3>

            <p>
              <strong>Actor:</strong> {resultado.sentinel.actor}
            </p>

            <p>
              <strong>Observe:</strong>{" "}
              {resultado.sentinel.observe.fuentes.join(", ")}
            </p>

            <p>
              <strong>Understand:</strong>{" "}
              {resultado.sentinel.understand.contexto}
            </p>

            <p>
              <strong>Explain:</strong>{" "}
              {resultado.sentinel.explain.resumen}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-around",
              marginTop: 30
            }}
          >
            <Nodo nombre="Observe" activo />
            <Nodo nombre="Understand" />
            <Nodo nombre="Explain" />
          </div>
        </div>
      )}

      {historial.length > 0 && (
        <div
          style={{
            marginTop: 35,
            background: "#0B1738",
            borderRadius: 18,
            padding: 25
          }}
        >
          <h2>Historial del Router</h2>

          {historial.map((h) => (
            <div
              key={h.id}
              style={{
                background: "#08142F",
                borderRadius: 12,
                padding: 18,
                marginTop: 12,
                borderLeft: "4px solid #2563EB"
              }}
            >
              <strong>{h.objetivo}</strong>

              <p style={{ color: "#60A5FA", margin: "8px 0" }}>
                {h.modelo} • Confianza {h.confianza}
              </p>

              <small style={{ color: "#A5B4FC" }}>{h.motivo}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Tarjeta({ titulo, valor, icono }) {
  return (
    <div
      style={{
        background: "#08142F",
        border: "1px solid #173E77",
        borderRadius: 14,
        padding: 20,
        textAlign: "center"
      }}
    >
      <div style={{ color: "#60A5FA", marginBottom: 8 }}>{icono}</div>

      <h3 style={{ margin: "5px 0" }}>{valor}</h3>

      <p style={{ color: "#A5B4FC", margin: 0 }}>{titulo}</p>
    </div>
  );
}

function Nodo({ nombre, activo }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          width: 70,
          height: 70,
          borderRadius: "50%",
          background: activo ? "#2563EB" : "#1E3A8A",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto"
        }}
      >
        <Sparkles color="white" />
      </div>

      <p>{nombre}</p>
    </div>
  );
}