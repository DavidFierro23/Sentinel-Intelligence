/*
===========================================================
REDES SOCIALES UNIVERSALES — Sprint 3.2.4, Bloque C
===========================================================

Las SEIS plataformas obligatorias, siempre las seis.

La regla que gobierna este panel: una plataforma que no se pudo
comprobar NUNCA se oculta. Se muestra con su estado y su motivo.

Ocultarla haría que el analista leyera «no hay cuenta» donde el
sistema solo puede decir «no lo sé», que es la confusión que
esta plataforma existe para evitar.
===========================================================
*/

const PLATAFORMAS = [
  { id: "facebook", nombre: "Facebook", color: "#1877F2", icono: "f" },
  { id: "x", nombre: "X", color: "#FFFFFF", icono: "X" },
  { id: "instagram", nombre: "Instagram", color: "#E1306C", icono: "ig" },
  { id: "tiktok", nombre: "TikTok", color: "#25D9D9", icono: "tt" },
  { id: "youtube", nombre: "YouTube", color: "#FF3B30", icono: "yt" },
  { id: "linkedin", nombre: "LinkedIn", color: "#3987E5", icono: "in" }
];

const ESTADOS = {
  perfil_leido: { texto: "Perfil leído", color: "#22C55E" },
  inferida: { texto: "Presencia inferida", color: "#60A5FA" },
  ausencia: { texto: "Sin presencia", color: "#64748B" },
  no_comprobada: { texto: "No comprobada", color: "#F59E0B" }
};

const caja = {
  background: "var(--sentinel-surface)",
  border: "1px solid var(--sentinel-borde)",
  borderRadius: "var(--radio-m)",
  padding: "14px",
  boxSizing: "border-box"
};

function Icono({ p }) {
  return (
    <span
      style={{
        width: "26px",
        height: "26px",
        borderRadius: "7px",
        background: `${p.color}1F`,
        border: `1px solid ${p.color}66`,
        color: p.color,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "11px",
        fontWeight: 700,
        flexShrink: 0
      }}
    >
      {p.icono}
    </span>
  );
}

export default function PlatformGrid({ cobertura = [], cuentas = [] }) {
  return (
    <section
      className="sentinel-fade"
      style={{
        width: "100%",
        boxSizing: "border-box",
        marginTop: "28px",
        background: "var(--sentinel-primary)",
        border: "1px solid var(--sentinel-borde)",
        borderRadius: "var(--radio-l)",
        padding: "22px"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "6px"
        }}
      >
        <h2 style={{ margin: 0, color: "#FFFFFF", fontSize: "18px" }}>
          Cobertura por plataforma
        </h2>

        <span
          style={{ color: "var(--sentinel-texto-tenue)", fontSize: "11px" }}
        >
          las seis obligatorias, ninguna se oculta
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(268px, 1fr))",
          gap: "12px",
          marginTop: "16px"
        }}
      >
        {PLATAFORMAS.map((p) => {
          const cob = cobertura.find((c) => c.plataformaId === p.id) || null;

          const propias = cuentas.filter(
            (c) => (c.plataformaId || c.platform) === p.id
          );

          /*
            Solo las cuentas atribuidas al objetivo. Un medio en esta
            plataforma no es presencia del objetivo.
          */
          const estadoId = cob?.estadoPresencia || "no_comprobada";

          const estado = ESTADOS[estadoId] || ESTADOS.no_comprobada;

          const mejor = propias
            .slice()
            .sort(
              (a, b) =>
                (b.correspondencia?.puntuacion ?? b.correspondencia ?? 0) -
                (a.correspondencia?.puntuacion ?? a.correspondencia ?? 0)
            )[0];

          return (
            <div
              key={p.id}
              style={{
                ...caja,
                borderLeft: `3px solid ${propias.length ? p.color : "var(--sentinel-borde)"}`
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "10px"
                }}
              >
                <Icono p={p} />

                <strong style={{ color: "#FFFFFF", fontSize: "13.5px" }}>
                  {p.nombre}
                </strong>

                <span
                  style={{
                    marginLeft: "auto",
                    color: estado.color,
                    fontSize: "9.5px",
                    fontWeight: 700,
                    letterSpacing: "0.8px",
                    textTransform: "uppercase",
                    border: `1px solid ${estado.color}55`,
                    borderRadius: "var(--radio-pill)",
                    padding: "3px 9px"
                  }}
                >
                  {estado.texto}
                </span>
              </div>

              {mejor ? (
                <>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: "10px",
                      flexWrap: "wrap"
                    }}
                  >
                    <a
                      href={mejor.url?.canonica || mejor.url || undefined}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        color: "#FFFFFF",
                        fontSize: "13px",
                        fontWeight: 600,
                        textDecoration: "none",
                        wordBreak: "break-all"
                      }}
                    >
                      @{mejor.handle}
                    </a>

                    <span
                      style={{
                        color: p.color,
                        fontFamily: "monospace",
                        fontSize: "14px"
                      }}
                    >
                      {mejor.correspondencia?.puntuacion ??
                        mejor.correspondencia ??
                        "—"}
                      <span
                        style={{
                          color: "var(--sentinel-texto-tenue)",
                          fontSize: "10px"
                        }}
                      >
                        /100
                      </span>
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      flexWrap: "wrap",
                      marginTop: "9px",
                      color: "var(--sentinel-texto-tenue)",
                      fontSize: "10.5px"
                    }}
                  >
                    <span>
                      proveedor:{" "}
                      <strong style={{ color: "#FCD34D" }}>
                        {(mejor.corroboracion?.proveedores || []).join(", ") ||
                          "—"}
                      </strong>
                    </span>

                    <span>
                      corroboraciones:{" "}
                      <strong style={{ color: "#93C5FD" }}>
                        {mejor.corroboracion?.totalProveedores ?? 1}
                      </strong>
                    </span>
                  </div>

                  {propias.length > 1 && (
                    <div
                      style={{
                        color: "var(--sentinel-texto-tenue)",
                        fontSize: "10px",
                        marginTop: "7px"
                      }}
                    >
                      +{propias.length - 1} cuenta(s) más en esta plataforma
                    </div>
                  )}
                </>
              ) : (
                <div
                  style={{
                    color: "var(--sentinel-texto-suave)",
                    fontSize: "11px",
                    lineHeight: 1.6
                  }}
                >
                  {/*
                    El motivo, siempre. Sin él "No comprobada" es una
                    etiqueta vacía que el analista no puede evaluar.
                  */}
                  {cob?.motivoCobertura ||
                    "No se consultó esta plataforma en esta investigación."}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
