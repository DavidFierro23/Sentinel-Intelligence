import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";

/*
  LEYENDA PERMANENTE (ARQ-PUI-001, Bloque D)

  Permanente y no plegable: un grafo donde no se distingue la
  cuenta del objetivo de un medio que lo cubre induce
  exactamente el error que el Protocolo Universal prohibe.
*/
/*
  LEYENDA OFICIAL (UX-BRAND-001)

  Los colores salen de la paleta oficial y cada uno corresponde a
  UNA clase que el backend ya produce. Nada se recolorea "porque
  queda bien": si no hay clase que lo respalde, no hay color.

  Aliado y Oposicion figuran en la identidad visual pero el Core
  NO los clasifica todavia: no existe motor que decida alianza ni
  oposicion. Se declaran con `sinDatos` para que aparezcan en la
  leyenda —la marca los reserva— sin que ningun nodo pueda
  pintarse de ellos. Inventar esa asignacion seria atribuir una
  postura politica sin evidencia.
*/
const CLASES_GRAFO = [
  { clase: "cuenta_personal", etiqueta: "Cuenta oficial", color: "#0B5FFF" },
  { clase: "institucion", etiqueta: "Institución", color: "#22C55E" },
  { clase: "medio", etiqueta: "Medio", color: "#F59E0B" },
  { clase: "aliado", etiqueta: "Aliado", color: "#A855F7", sinDatos: true },
  { clase: "oposicion", etiqueta: "Oposición", color: "#EF4444", sinDatos: true },
  { clase: "no_determinado", etiqueta: "Pendiente", color: "#94A3B8" }
];

/*
  FILTROS DE VISTA. Solo ocultan; no alteran el grafo que el
  backend produjo ni recalculan nada.
*/
const FILTROS = [
  { id: "todo", etiqueta: "Ecosistema", clases: null },
  { id: "cuentas", etiqueta: "Solo cuentas", clases: ["cuenta_personal"] },
  { id: "medios", etiqueta: "Medios", clases: ["medio"] },
  { id: "instituciones", etiqueta: "Instituciones", clases: ["institucion"] }
];

const colores = {
  Facebook: "#1877F2",
  Instagram: "#E1306C",
  TikTok: "#25D9D9",
  X: "#FFFFFF",
  YouTube: "#FF3B30",
  Web: "#64748B",
  "Google News": "#0EA5E9",
  Wayback: "#8B5CF6",
  Whois: "#F59E0B"
};

export default function KnowledgeGraph({ resultado }) {
  const fgRef = useRef();
  const [avatar, setAvatar] = useState(null);
  const [filtro, setFiltro] = useState("todo");

  useEffect(() => {
    if (!resultado?.identidad?.avatar) {
      setAvatar(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = resultado.identidad.avatar;

    img.onload = () => setAvatar(img);
    img.onerror = () => setAvatar(null);
  }, [resultado]);

  const graphData = useMemo(() => {
    if (!resultado) return { nodes: [], links: [] };

    const nodes = [];
    const links = [];

    nodes.push({
      id: "objetivo",
      nombre: resultado.objetivo,
      tipo: "objetivo",
      radius: 52,
      x: 0,
      y: 0,
      fx: 0,
      fy: 0
    });

    const clasesVisibles =
      (FILTROS.find((f) => f.id === filtro) || {}).clases || null;

    const entidades = (resultado.entidades || []).filter((e) => {
      if (!clasesVisibles) return true;

      /* Los nodos de dominio (no sociales) solo en Ecosistema. */
      if (e.origenNodo !== "social_intelligence_layer") return false;

      return clasesVisibles.includes(e.clase || "no_determinado");
    });
    const radio = 180;
    const total = entidades.length || 1;

    entidades.forEach((e, i) => {
      const angulo = (Math.PI * 2 * i) / total;

      nodes.push({
        id: e.id,
        nombre: e.nombre,
        tipo: e.tipo,
        evidencias: e.evidencias,
        radius: 18 + Math.min(e.evidencias * 1.5, 12),
        /*
          Los nodos sociales pasan a llamarse "@handle", asi que
          el color debe venir de la PLATAFORMA. Sin esto todas
          las cuentas saldrian del mismo azul generico.
        */
        /*
          UX-BRAND-001: el color dominante pasa a ser la CLASE,
          porque es lo que la leyenda oficial declara. La
          plataforma se conserva y se dibuja como borde.
        */
        color:
          (CLASES_GRAFO.find(
            (c) => c.clase === (e.clase || "no_determinado")
          ) || {}).color || "#3B82F6",
        colorPlataforma: colores[e.plataforma] || colores[e.nombre] || "#3B82F6",
        plataforma: e.plataforma || null,
        clase: e.clase || null,
        esDelObjetivo: e.esDelObjetivo === true,
        handle: e.handle || null,
        correspondencia: e.correspondencia ?? null,
        vetadoPorContexto: e.vetadoPorContexto === true,
        x: Math.cos(angulo) * radio,
        y: Math.sin(angulo) * radio,
        fx: Math.cos(angulo) * radio,
        fy: Math.sin(angulo) * radio
      });

      links.push({
        source: "objetivo",
        target: e.id,
        width: 2 + e.evidencias * 0.25
      });
    });

    return { nodes, links };
  }, [resultado, filtro]);

  useEffect(() => {
    if (!fgRef.current) return;

    setTimeout(() => {
      fgRef.current.centerAt(0, 0, 500);
      fgRef.current.zoom(1, 500);
    }, 150);
  }, [graphData]);

  if (!resultado) return null;

  return (
    <div
      style={{
        width: "100%",
        background: "#08142F",
        borderRadius: "20px",
        border: "1px solid #1E3A8A",
        overflow: "hidden"
      }}
    >
      {/* FILTROS DE VISTA — solo ocultan, no recalculan nada. */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          alignItems: "center",
          padding: "12px 18px",
          borderBottom: "1px solid var(--sentinel-borde)",
          background: "var(--sentinel-primary)"
        }}
      >
        {FILTROS.map((f) => {
          const activo = filtro === f.id;

          return (
            <button
              key={f.id}
              className="sentinel-hover"
              onClick={() => setFiltro(f.id)}
              aria-pressed={activo}
              style={{
                background: activo ? "rgba(11,95,255,.22)" : "transparent",
                border: `1px solid ${
                  activo ? "var(--sentinel-cyan)" : "var(--sentinel-borde)"
                }`,
                borderRadius: "var(--radio-pill)",
                color: activo ? "#FFFFFF" : "var(--sentinel-texto-suave)",
                padding: "6px 15px",
                cursor: "pointer",
                fontSize: "11.5px",
                fontWeight: activo ? 650 : 500
              }}
            >
              {f.etiqueta}
            </button>
          );
        })}

        <span
          style={{
            marginLeft: "auto",
            color: "var(--sentinel-texto-tenue)",
            fontSize: "10.5px"
          }}
        >
          {Math.max(0, graphData.nodes.length - 1)} nodo(s) visibles
        </span>
      </div>

      {/*
        LEYENDA PERMANENTE. Sin ella el analista no puede saber si
        un circulo es la cuenta del objetivo o un medio que lo
        cubre.
      */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          flexWrap: "wrap",
          alignItems: "center",
          padding: "11px 18px",
          borderBottom: "1px solid var(--sentinel-borde)",
          background: "var(--sentinel-surface)"
        }}
      >
        <span
          style={{
            color: "var(--sentinel-cyan)",
            fontSize: "10px",
            letterSpacing: "2px",
            textTransform: "uppercase"
          }}
        >
          Leyenda
        </span>

        {CLASES_GRAFO.map((c) => (
          <span
            key={c.clase}
            title={
              c.sinDatos
                ? "Reservado por la identidad visual. El Core no clasifica esta categoria todavia, asi que ningun nodo puede recibirla."
                : c.etiqueta
            }
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: c.sinDatos
                ? "var(--sentinel-texto-tenue)"
                : "var(--sentinel-texto-suave)",
              fontSize: "11px"
            }}
          >
            <span
              style={{
                width: "9px",
                height: "9px",
                borderRadius: "50%",
                background: c.sinDatos ? "transparent" : c.color,
                border: c.sinDatos ? `1.5px dashed ${c.color}` : "none",
                boxSizing: "border-box",
                flexShrink: 0
              }}
            />
            {c.etiqueta}
            {c.sinDatos && (
              <em
                style={{
                  fontStyle: "normal",
                  fontSize: "9px",
                  color: "var(--sentinel-texto-tenue)",
                  border: "1px solid var(--sentinel-borde)",
                  borderRadius: "var(--radio-pill)",
                  padding: "1px 6px"
                }}
              >
                sin datos
              </em>
            )}
          </span>
        ))}

        <span
          style={{
            marginLeft: "auto",
            color: "var(--sentinel-texto-tenue)",
            fontSize: "10.5px"
          }}
        >
          el relleno indica la clase · el borde, la plataforma
        </span>
      </div>

      <div style={{ width: "100%", height: "560px" }}>
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        backgroundColor="#08142F"
        cooldownTicks={0}
        enableNodeDrag={false}
        enableZoomInteraction
        enablePanInteraction
        linkColor={() => "#60A5FA"}
        linkWidth={(l) => l.width || 2}
        nodeCanvasObject={(node, ctx) => {
          const x = node.x;
          const y = node.y;
          const r = node.radius;

          if (node.id === "objetivo") {
            ctx.beginPath();
            ctx.arc(x, y, r + 5, 0, Math.PI * 2);
            ctx.fillStyle = "#2563EB";
            ctx.fill();

            ctx.save();

            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.clip();

            if (avatar) {
              ctx.drawImage(avatar, x - r, y - r, r * 2, r * 2);
            } else {
              ctx.fillStyle = "#0B1738";
              ctx.fillRect(x - r, y - r, r * 2, r * 2);

              ctx.fillStyle = "white";
              ctx.font = `bold ${r * 0.9}px Arial`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";

              const iniciales = resultado.objetivo
                .split(" ")
                .slice(0, 2)
                .map((p) => p[0])
                .join("");

              ctx.fillText(iniciales, x, y);
            }

            ctx.restore();

            ctx.beginPath();
            ctx.arc(x, y, r + 5, 0, Math.PI * 2);
            ctx.strokeStyle = "#60A5FA";
            ctx.lineWidth = 3;
            ctx.stroke();

            ctx.fillStyle = "white";
            ctx.font = "bold 22px Arial";
            ctx.textAlign = "center";
            ctx.fillText(resultado.objetivo, x, y + r + 34);

            return;
          }

          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = node.color || "#3B82F6";
          ctx.fill();

          /*
            EL RELLENO INDICA LA CLASE; EL BORDE, LA PLATAFORMA.

            Invertido en UX-BRAND-001 respecto de la version
            anterior: la leyenda oficial asigna color a la CLASE,
            asi que la clase debe dominar visualmente. Distinguir
            la cuenta del objetivo de un medio que lo cubre es la
            lectura principal del grafo.
          */
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.strokeStyle = node.colorPlataforma || "#FFFFFF";
          ctx.lineWidth = node.esDelObjetivo ? 4 : 2.5;
          ctx.stroke();

          ctx.fillStyle = node.esDelObjetivo ? "white" : "#CBD5E1";
          ctx.font = node.esDelObjetivo ? "bold 14px Arial" : "13px Arial";
          ctx.textAlign = "center";
          ctx.fillText(node.nombre, x, y + r + 18);

          ctx.font = "12px Arial";
          ctx.fillStyle = "#93C5FD";
          ctx.fillText(`${node.evidencias || 1} evid.`, x, y + r + 34);
        }}
      />

      </div>
    </div>
  );
}