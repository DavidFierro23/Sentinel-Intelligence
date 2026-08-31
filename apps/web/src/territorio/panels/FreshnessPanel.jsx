import { Clock, AlertTriangle, HelpCircle } from "lucide-react";

/*
===========================================================
FRESCURA DEL CORPUS — TERRITORIAL-FRESH-01
===========================================================

Responde «¿qué se publicó HOY?», que no es lo mismo que «¿qué
encontramos hoy?».

LA CIFRA QUE ESTE PANEL EXISTE PARA NO DEJAR CONFUNDIR
-----------------------------------------------------------

En la primera prueba real, la ventana HOY devolvió 63
evidencias. Leído sin este panel, eso parece «hoy han pasado 63
cosas en Cuenca».

Lo que había de verdad:

     8   publicadas hoy
    55   encontradas hoy, publicadas antes

Las 55 son hallazgos nuevos PARA SENTINEL y no son noticias de
hoy. La diferencia es de un orden de magnitud, y sin separarla
cada actualización parecería un día frenético.

CUATRO INSTANTES, NINGUNO SUSTITUYE A OTRO
-----------------------------------------------------------

    publishedAt      lo declara la fuente
    firstObservedAt  la primera vez que Sentinel la vio
    lastObservedAt   la última vez que volvió a verla
    retrievedAt      el instante de esta ejecución

«Fecha no resuelta» tiene casilla propia. No saber cuándo se
publicó algo es un dato, y meterlo en «hoy» sería inventarlo.
===========================================================
*/

const COLOR_CUBO = {
  hoy: "var(--sentinel-cyan)",
  ayer: "#5598e7",
  "2_7_dias": "#2a78d6",
  anterior: "#184f95",
  sin_fecha: "#64748b"
};


function Cifra({ valor, texto, destacada, atenuada, ayuda }) {
  return (
    <div style={{ minWidth: "120px" }}>
      <div
        style={{
          color: destacada
            ? "var(--sentinel-cyan)"
            : atenuada
              ? "var(--sentinel-texto-tenue)"
              : "var(--sentinel-texto)",
          fontSize: destacada ? "26px" : "20px",
          fontWeight: 700,
          lineHeight: 1.1
        }}
      >
        {valor}
      </div>

      <div
        style={{
          color: "var(--sentinel-texto-suave)",
          fontSize: "10.5px",
          lineHeight: 1.5,
          marginTop: "3px",
          display: "flex",
          alignItems: "flex-start",
          gap: "4px"
        }}
      >
        {texto}
        {ayuda && (
          <span title={ayuda} style={{ flexShrink: 0, marginTop: "1px" }}>
            <HelpCircle size={10} color="var(--sentinel-texto-tenue)" />
          </span>
        )}
      </div>
    </div>
  );
}


export default function FreshnessPanel({ frescura }) {
  if (!frescura) return null;

  if (frescura.error) {
    return (
      <section
        style={{
          background: "rgba(201,133,0,.09)",
          border: "1px solid #c98500",
          borderRadius: "var(--radio-l)",
          padding: "12px 16px",
          display: "flex",
          gap: "9px",
          alignItems: "flex-start"
        }}
      >
        <AlertTriangle size={14} color="#eda100" style={{ flexShrink: 0, marginTop: "2px" }} />

        <div style={{ color: "var(--sentinel-texto-suave)", fontSize: "11.5px", lineHeight: 1.6 }}>
          <strong style={{ color: "#eda100" }}>No se pudo calcular la frescura.</strong>{" "}
          {frescura.declaracion}
        </div>
      </section>
    );
  }

  const r = frescura.resumen || {};

  const d = frescura.distribucion || {};

  const maximo = Math.max(1, ...Object.values(d.cubos || {}));

  const actualizacion = frescura.ultimaActualizacion
    ? new Date(frescura.ultimaActualizacion).toLocaleString("es-EC", {
        timeZone: frescura.zona || "America/Guayaquil",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    : null;

  return (
    <section
      style={{
        background: "var(--sentinel-surface)",
        border: "1px solid var(--sentinel-borde)",
        borderRadius: "var(--radio-l)",
        padding: "18px 20px"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "4px"
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            color: "var(--sentinel-cyan)",
            fontSize: "10px",
            letterSpacing: "1.8px",
            textTransform: "uppercase",
            fontWeight: 600
          }}
        >
          <Clock size={13} />
          Frescura del corpus
        </span>

        {actualizacion && (
          <span style={{ color: "var(--sentinel-texto-tenue)", fontSize: "10.5px" }}>
            Última actualización: {actualizacion}
          </span>
        )}
      </div>

      <div
        style={{
          color: "var(--sentinel-texto-suave)",
          fontSize: "11px",
          lineHeight: 1.7,
          marginBottom: "16px"
        }}
      >
        Ventana <strong>{frescura.ventana?.etiqueta || frescura.ventana?.id}</strong>
        {frescura.ventana?.fechaLocal && ` · ${frescura.ventana.fechaLocal}`} · zona{" "}
        {frescura.zona}. Todo se mide sobre <strong>la fecha que declara la fuente</strong>,
        nunca sobre cuándo la encontramos.
      </div>

      {/* --- las cuatro cifras --- */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "26px", marginBottom: "18px" }}>
        <Cifra valor={r.publicadoHoy ?? 0} texto="Publicado hoy" destacada />

        <Cifra
          valor={r.encontradoHoyPublicadoAntes ?? 0}
          texto="Encontrado hoy, publicado antes"
          ayuda="Hallazgos nuevos para Sentinel que la fuente publicó otro día. No son noticias de hoy."
        />

        <Cifra
          valor={r.fechaNoResuelta ?? 0}
          texto="Fecha no resuelta"
          atenuada
          ayuda="La fuente no declara fecha o no es parseable. No se cuenta como hoy: eso sería inventarla."
        />

        <Cifra valor={r.total ?? 0} texto="Evidencias en el corpus" />
      </div>

      {/* --- distribución temporal --- */}
      {d.cubos && (
        <>
          <div
            style={{
              color: "var(--sentinel-texto-tenue)",
              fontSize: "9.5px",
              letterSpacing: "1.2px",
              textTransform: "uppercase",
              marginBottom: "8px"
            }}
          >
            Distribución por fecha de publicación
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
            {Object.entries(d.cubos).map(([clave, valor]) => (
              <div key={clave} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span
                  style={{
                    flex: "0 0 132px",
                    color:
                      clave === "sin_fecha"
                        ? "var(--sentinel-texto-tenue)"
                        : "var(--sentinel-texto-suave)",
                    fontSize: "11px"
                  }}
                >
                  {d.etiquetas?.[clave] || clave}
                </span>

                <div
                  style={{
                    flex: 1,
                    height: "9px",
                    background: "var(--sentinel-bg)",
                    borderRadius: "var(--radio-pill)",
                    overflow: "hidden"
                  }}
                >
                  <div
                    style={{
                      width: `${(valor / maximo) * 100}%`,
                      height: "100%",
                      background: COLOR_CUBO[clave] || "var(--sentinel-cyan)",
                      opacity: clave === "sin_fecha" ? 0.5 : 0.9
                    }}
                  />
                </div>

                <span
                  style={{
                    flex: "0 0 34px",
                    textAlign: "right",
                    color: "var(--sentinel-texto)",
                    fontSize: "11.5px"
                  }}
                >
                  {valor}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* --- reejecución --- */}
      {frescura.ledger && typeof frescura.ledger.observadas === "number" && (
        <div
          style={{
            marginTop: "14px",
            paddingTop: "12px",
            borderTop: "1px solid var(--sentinel-borde)",
            color: "var(--sentinel-texto-suave)",
            fontSize: "11px",
            lineHeight: 1.7
          }}
        >
          <strong style={{ color: "var(--sentinel-texto)" }}>
            {frescura.ledger.nuevasParaSentinel}
          </strong>{" "}
          evidencia(s) nuevas para Sentinel de{" "}
          <strong>{frescura.ledger.observadas}</strong> observadas.{" "}
          {frescura.ledger.yaConocidas > 0 && (
            <>
              Las otras <strong>{frescura.ledger.yaConocidas}</strong> ya estaban: volver a
              observarlas no crea evidencias nuevas.{" "}
            </>
          )}
          {frescura.ledger.nuevasParaSentinel === 0 && frescura.ledger.observadas > 0 && (
            <span style={{ color: "var(--sentinel-texto-tenue)" }}>
              Cero nuevas no es un fallo de recolección: puede ser que no haya aparecido nada
              nuevo.
            </span>
          )}
        </div>
      )}

      <div
        style={{
          marginTop: "10px",
          color: "var(--sentinel-texto-tenue)",
          fontSize: "10px",
          lineHeight: 1.65
        }}
      >
        «Publicado hoy» exige fecha verificable dentro del día territorial. Encontrar algo hoy no
        lo publica hoy.
      </div>
    </section>
  );
}
