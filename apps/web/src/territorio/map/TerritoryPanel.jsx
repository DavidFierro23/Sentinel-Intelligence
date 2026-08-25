import { X, MapPin, FileText, Radio, Tags, Clock, ShieldCheck } from "lucide-react";

/*
===========================================================
PANEL DE TERRITORIO
===========================================================

Lo que se sabe de una unidad al seleccionarla en el mapa o en
la lista de lugares sin geometría.

LA PRIMERA LINEA ES LA QUE IMPORTA
-----------------------------------------------------------

    oficial / analítica / topónimo no certificado

Un distrito de campaña y una parroquia se pintan igual en un
mapa, y no valen lo mismo. Si el panel no lo dice en la
primera línea, la diferencia se pierde.
===========================================================
*/

const TIPO_ETIQUETA = {
  oficial: { texto: "Unidad oficial", color: "#0ca30c" },
  analitica: { texto: "Zona analítica", color: "#eda100" },
  toponimo_no_certificado: {
    texto: "Topónimo no certificado",
    color: "#ec835a"
  }
};


function Dato({ icono: Icono, valor, etiqueta }) {
  return (
    <div style={{ minWidth: "78px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
          color: "var(--sentinel-texto-tenue)",
          fontSize: "9px",
          letterSpacing: "1px",
          textTransform: "uppercase"
        }}
      >
        <Icono size={10} />
        {etiqueta}
      </div>

      <div
        style={{
          color: "#FFFFFF",
          fontSize: "20px",
          fontWeight: 700,
          marginTop: "3px"
        }}
      >
        {valor}
      </div>
    </div>
  );
}


export default function TerritoryPanel({ unidad, onCerrar }) {
  if (!unidad) return null;

  const tipo =
    TIPO_ETIQUETA[unidad.tipoUnidad] || TIPO_ETIQUETA.toponimo_no_certificado;

  return (
    <section
      style={{
        background: "var(--sentinel-surface-alta)",
        border: "1px solid var(--sentinel-cyan)",
        borderRadius: "var(--radio-l)",
        padding: "16px 18px"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          marginBottom: "14px"
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "9px",
              flexWrap: "wrap"
            }}
          >
            <MapPin size={15} color="var(--sentinel-cyan)" />

            <span
              style={{ color: "#FFFFFF", fontSize: "16px", fontWeight: 700 }}
            >
              {unidad.nombre}
            </span>

            <span
              style={{
                color: tipo.color,
                fontSize: "9.5px",
                fontWeight: 650,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                border: `1px solid ${tipo.color}`,
                borderRadius: "var(--radio-pill)",
                padding: "2px 8px"
              }}
            >
              {tipo.texto}
            </span>

            {unidad.unidadOficial && (
              <span
                title="Nomenclatura respaldada por fuente oficial."
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                  color: "var(--sentinel-live)",
                  fontSize: "9.5px"
                }}
              >
                <ShieldCheck size={10} />
                verificada
              </span>
            )}
          </div>

          <div
            style={{
              color: "var(--sentinel-texto-suave)",
              fontSize: "11px",
              marginTop: "5px",
              marginLeft: "24px"
            }}
          >
            {unidad.nivel}
            {unidad.tipo ? ` · ${unidad.tipo}` : ""}
            {unidad.codigoOficial ? ` · DPA ${unidad.codigoOficial}` : ""}
          </div>
        </div>

        <button
          onClick={onCerrar}
          className="sentinel-hover"
          aria-label="Cerrar"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--sentinel-texto-suave)",
            padding: "3px",
            flexShrink: 0
          }}
        >
          <X size={16} />
        </button>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "24px",
          paddingBottom: "14px",
          borderBottom: "1px solid var(--sentinel-borde)"
        }}
      >
        <Dato icono={FileText} valor={unidad.evidencias} etiqueta="Evidencias" />
        <Dato icono={Radio} valor={unidad.fuentes} etiqueta="Fuentes" />
        <Dato icono={Tags} valor={unidad.temas} etiqueta="Temas" />
      </div>

      {unidad.temasPrincipales?.length > 0 && (
        <div style={{ marginTop: "14px" }}>
          <div
            style={{
              color: "var(--sentinel-texto-tenue)",
              fontSize: "9.5px",
              letterSpacing: "1.1px",
              textTransform: "uppercase",
              marginBottom: "7px"
            }}
          >
            Temas principales
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {unidad.temasPrincipales.map((t) => (
              <span
                key={t.id}
                style={{
                  color: "var(--sentinel-texto)",
                  fontSize: "11px",
                  background: "var(--sentinel-surface)",
                  border: "1px solid var(--sentinel-borde)",
                  borderRadius: "var(--radio-pill)",
                  padding: "3px 10px"
                }}
              >
                {t.etiqueta} · {t.evidencias}
              </span>
            ))}
          </div>
        </div>
      )}

      {unidad.ultimaObservacion && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            color: "var(--sentinel-texto-suave)",
            fontSize: "11px",
            marginTop: "13px"
          }}
        >
          <Clock size={11} />
          Última observación: {String(unidad.ultimaObservacion).slice(0, 16)}
        </div>
      )}

      <div
        style={{
          marginTop: "13px",
          paddingTop: "10px",
          borderTop: "1px solid var(--sentinel-borde)",
          color: "var(--sentinel-texto-tenue)",
          fontSize: "10.5px",
          lineHeight: 1.7
        }}
      >
        {unidad.unidadDeMedida}.
        {unidad.motivoSinGeometria ? ` ${unidad.motivoSinGeometria}` : ""}
        {unidad.estado === "muestra_insuficiente"
          ? " Muestra insuficiente: no se rankea."
          : ""}
      </div>
    </section>
  );
}
