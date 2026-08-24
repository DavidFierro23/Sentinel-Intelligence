import { Coins, MapPinOff, Database, FileWarning } from "lucide-react";

/*
===========================================================
DECLARACION DE COBERTURA Y COSTE
===========================================================

Cuatro cifras que el analista debe ver SIEMPRE, no solo cuando
son malas:

  sin ubicar     lo que no se pudo situar y por tanto no esta
                 en ninguna cifra territorial
  coste          cuanto saldo de SerpAPI consumio esta vista
  evidencias     sobre cuanto se construyo todo
  carencias      que dato oficial falta

La primera es la que UX-WR-001 §1 exige por capa: «lo que no
se puede ubicar no desaparece». Un panel con 40 pines y 300
registros sin ubicar da una impresion falsa si no lo dice.

La segunda existe porque el saldo de SerpAPI es mensual y
compartido con el Discovery Engine. Un analista que no sabe lo
que costo una vista no puede decidir si repetirla.
===========================================================
*/

function Cifra({ icono: Icono, valor, etiqueta, detalle, tono = "normal" }) {
  const color =
    tono === "alerta"
      ? "#eda100"
      : tono === "ok"
        ? "var(--sentinel-live)"
        : "var(--sentinel-texto)";

  return (
    <div
      style={{
        flex: "1 1 160px",
        minWidth: "150px",
        background: "var(--sentinel-surface-alta)",
        border: "1px solid var(--sentinel-borde)",
        borderRadius: "var(--radio-m)",
        padding: "12px 14px"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "7px",
          color: "var(--sentinel-texto-tenue)",
          fontSize: "10px",
          letterSpacing: "1.2px",
          textTransform: "uppercase"
        }}
      >
        <Icono size={12} style={{ flexShrink: 0 }} />
        {etiqueta}
      </div>

      <div
        style={{
          color,
          fontSize: "20px",
          fontWeight: 700,
          marginTop: "6px",
          lineHeight: 1.1
        }}
      >
        {valor}
      </div>

      {detalle && (
        <div
          style={{
            color: "var(--sentinel-texto-suave)",
            fontSize: "10.5px",
            lineHeight: 1.6,
            marginTop: "5px"
          }}
        >
          {detalle}
        </div>
      )}
    </div>
  );
}


export default function CoverageDeclaration({ datos }) {
  if (!datos) return null;

  const ubic = datos.territorio?.ubicacion?.metricas || {};

  const rec = datos.conversacion?.recoleccion?.metricas || {};

  const costo = datos.costo || {};

  const carencias = datos.territorio?.registroTerritorial?.carencias || [];

  const sinUbicar = ubic.sinUbicar || 0;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
      <Cifra
        icono={Database}
        etiqueta="Evidencias"
        valor={rec.evidencias ?? 0}
        detalle={`${
          rec.publicadoresDeclarados || rec.dominiosDelEnlace || 0
        } publicadores · ${rec.sinFecha ?? 0} sin fecha`}
      />

      <Cifra
        icono={MapPinOff}
        etiqueta="Sin ubicar"
        valor={`${sinUbicar}`}
        tono={sinUbicar > 0 ? "alerta" : "normal"}
        detalle={
          sinUbicar > 0
            ? `${ubic.porcentajeSinUbicar} % del total. No están en ninguna cifra territorial.`
            : "Todas las evidencias se pudieron situar."
        }
      />

      <Cifra
        icono={Coins}
        etiqueta="Coste"
        valor={
          costo.cuotaConsumida > 0
            ? `${costo.cuotaConsumida} búsq.`
            : "0"
        }
        tono={costo.cuotaConsumida > 0 ? "alerta" : "ok"}
        detalle={costo.declaracion}
      />

      {/*
        La etiqueta literal, no los identificadores internos.

        Antes mostraba «geometria · poblacion · padron», que a un
        analista no le dice nada: parecen nombres de campos, no
        una carencia. La frase que se acordó es
        «Dato oficial pendiente de integración», y es la que
        tiene que leerse.
      */}
      <Cifra
        icono={FileWarning}
        etiqueta="Datos oficiales"
        valor={
          carencias.length ? `${carencias.length} pendientes` : "completos"
        }
        tono={carencias.length ? "alerta" : "ok"}
        detalle={
          carencias.length
            ? `Dato oficial pendiente de integración: ${carencias
                .map((c) => c.titulo || c.id)
                .join(" · ")}`
            : "Sin carencias declaradas."
        }
      />
    </div>
  );
}
