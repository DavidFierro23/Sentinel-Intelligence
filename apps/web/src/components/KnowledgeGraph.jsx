import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";

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

    const entidades = resultado.entidades || [];
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
        color: colores[e.nombre] || "#3B82F6",
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
  }, [resultado]);

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
        height: "560px",
        background: "#08142F",
        borderRadius: "20px",
        border: "1px solid #1E3A8A",
        overflow: "hidden"
      }}
    >
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

          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 2.5;
          ctx.stroke();

          ctx.fillStyle = "white";
          ctx.font = "bold 14px Arial";
          ctx.textAlign = "center";
          ctx.fillText(node.nombre, x, y + r + 18);

          ctx.font = "12px Arial";
          ctx.fillStyle = "#93C5FD";
          ctx.fillText(`${node.evidencias || 1} evid.`, x, y + r + 34);
        }}
      />
    </div>
  );
}