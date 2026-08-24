import { Radio, Building2, Globe, HelpCircle, Link2 } from "lucide-react";

/*
===========================================================
COBERTURA MEDIATICA — quien publica
===========================================================

Responde una pregunta distinta de la del volumen: no «cuanto
se habla» sino «quien habla».

TRES REGLAS QUE ESTE PANEL RESPETA
-----------------------------------------------------------

1. Medios LOCALES y NACIONALES separados, nunca en una sola
   lista ordenada por conteo. Que un diario local publique
   tres notas sobre su canton y uno nacional publique tres
   sobre el pais no son cifras comparables, y ponerlas juntas
   invita a compararlas.

2. NUNCA se mezclan medios con cuentas del objetivo. Regla
   congelada del Protocolo Universal (ARQ-PUI-001): un medio
   que cubre al objetivo es contexto, no identidad.

3. NO hay ranking de influencia. Sin datos de audiencia, un
   orden por «influencia» seria una opinion con formato de
   metrica. Se ordena por numero de publicaciones y se dice
   que eso es lo unico que mide.

EL AGREGADOR
-----------------------------------------------------------

Google News devuelve URLs de `news.google.com`, no del medio.
El recolector rescata el nombre del publicador del titular y
el registro lo traduce a dominio. Lo que no se pudo rescatar
queda como agregador, visible y contado: esconderlo haria
parecer que la cobertura tiene menos fuentes de las que tiene.
===========================================================
*/

const ICONO = {
  medio_local: Radio,
  medio_nacional: Globe,
  institucion: Building2,
  agregador: Link2,
  plataforma: Link2,
  enciclopedico: Link2,
  desconocido: HelpCircle
};


function Lista({ titulo, medios, nota }) {
  if (!medios?.length) return null;

  return (
    <div style={{ flex: "1 1 240px", minWidth: "220px" }}>
      <div
        style={{
          color: "var(--sentinel-texto-suave)",
          fontSize: "10px",
          letterSpacing: "1.3px",
          textTransform: "uppercase",
          marginBottom: "8px"
        }}
      >
        {titulo}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
        {medios.map((m) => {
          const Icono = ICONO[m.tipo] || HelpCircle;

          return (
            <div
              key={m.dominio}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "7px 9px",
                background: "var(--sentinel-surface-alta)",
                border: "1px solid var(--sentinel-borde)",
                borderRadius: "var(--radio-m)"
              }}
            >
              <Icono
                size={13}
                color="var(--sentinel-texto-tenue)"
                style={{ flexShrink: 0 }}
              />

              <span
                style={{
                  flex: 1,
                  color: "var(--sentinel-texto)",
                  fontSize: "11.5px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}
                title={m.dominio}
              >
                {m.nombre || m.dominio}
              </span>

              {m.cobertura && (
                <span
                  title={`Cobertura declarada: ${m.cobertura.unidadId} (${m.cobertura.resolucion}). Se usa para desambiguar topónimos.`}
                  style={{
                    color: "var(--sentinel-cyan)",
                    fontSize: "9px",
                    border: "1px solid var(--sentinel-borde-vivo)",
                    borderRadius: "var(--radio-pill)",
                    padding: "1px 6px",
                    flexShrink: 0
                  }}
                >
                  desambigua
                </span>
              )}

              <span
                style={{
                  color: "var(--sentinel-texto-suave)",
                  fontSize: "12px",
                  fontWeight: 700,
                  flexShrink: 0
                }}
              >
                {m.evidencias}
              </span>
            </div>
          );
        })}
      </div>

      {nota && (
        <div
          style={{
            color: "var(--sentinel-texto-tenue)",
            fontSize: "10px",
            lineHeight: 1.6,
            marginTop: "7px"
          }}
        >
          {nota}
        </div>
      )}
    </div>
  );
}


export default function MediaCoveragePanel({ conversacion }) {
  const medios = conversacion?.medios;

  if (!medios) return null;

  const todos = medios.medios || [];

  const locales = todos.filter((m) => m.tipo === "medio_local");

  const nacionales = todos.filter((m) => m.tipo === "medio_nacional");

  const instituciones = todos.filter((m) => m.tipo === "institucion");

  const otros = todos.filter(
    (m) =>
      !["medio_local", "medio_nacional", "institucion"].includes(m.tipo)
  );

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
          marginBottom: "14px"
        }}
      >
        <span
          style={{
            color: "var(--sentinel-cyan)",
            fontSize: "10px",
            letterSpacing: "1.8px",
            textTransform: "uppercase",
            fontWeight: 600
          }}
        >
          Quién publica
        </span>

        <span
          style={{ color: "var(--sentinel-texto-tenue)", fontSize: "10.5px" }}
        >
          {medios.resumen?.dominiosDistintos ?? 0} dominios ·{" "}
          {medios.resumen?.locales ?? 0} locales ·{" "}
          {medios.resumen?.nacionales ?? 0} nacionales
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "18px" }}>
        <Lista
          titulo="Medios locales"
          medios={locales}
          nota="Su cobertura declarada desambigua topónimos del cantón."
        />

        <Lista titulo="Medios nacionales" medios={nacionales} />

        <Lista titulo="Instituciones" medios={instituciones} />

        <Lista
          titulo="Sin publicador identificado"
          medios={otros}
          nota="Agregadores y dominios fuera del catálogo. No se les asigna cobertura: un dominio desconocido no puede desambiguar topónimos."
        />
      </div>

      <div
        style={{
          marginTop: "14px",
          paddingTop: "10px",
          borderTop: "1px solid var(--sentinel-borde)",
          color: "var(--sentinel-texto-tenue)",
          fontSize: "10.5px",
          lineHeight: 1.7
        }}
      >
        Ordenado por número de publicaciones, que es lo único que se mide. No
        se mide alcance ni audiencia: un ranking de influencia sin datos de
        audiencia sería una opinión con formato de métrica. El catálogo de
        medios es semilla y todas sus entradas llevan{" "}
        <code>verificado: false</code>.
      </div>
    </section>
  );
}
