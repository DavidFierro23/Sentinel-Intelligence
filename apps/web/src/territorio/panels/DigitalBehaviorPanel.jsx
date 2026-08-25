import { Smartphone, Lock } from "lucide-react";

/*
===========================================================
COMPORTAMIENTO DIGITAL — reservado
===========================================================

Bloque visible y DESHABILITADO. Ninguna cifra.

POR QUE APARECE SI NO HAY DATOS
-----------------------------------------------------------

Porque la pregunta «¿desde qué dispositivos se consume esto?»
se la va a hacer cualquiera que abra el panel, y es mejor
responderla con «no hay fuente que lo sostenga» que con
silencio.

Un bloque ausente parece un olvido. Uno presente y bloqueado
declara una decisión.

LO QUE NUNCA VA A HACER
-----------------------------------------------------------

Inferir el dispositivo desde una publicación. Que una nota
salga en una app no dice desde qué teléfono la leyó nadie.

Cuando esta capa exista, será AGREGADA: analytics propios,
campañas propias o una fuente licenciada. Nunca seguimiento
individual.
===========================================================
*/

const CAMPOS = [
  "Móvil / Desktop / Tablet",
  "Android / iOS",
  "Navegador",
  "Franja horaria",
  "Plataforma",
  "Interacción agregada"
];


export default function DigitalBehaviorPanel() {
  return (
    <section
      style={{
        background: "var(--sentinel-surface)",
        border: "1px dashed var(--sentinel-borde-vivo)",
        borderRadius: "var(--radio-l)",
        padding: "16px 20px",
        opacity: 0.82
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "9px",
          marginBottom: "8px"
        }}
      >
        <Smartphone size={14} color="var(--sentinel-texto-tenue)" />

        <span
          style={{
            color: "var(--sentinel-texto-tenue)",
            fontSize: "10px",
            letterSpacing: "1.8px",
            textTransform: "uppercase",
            fontWeight: 600
          }}
        >
          Comportamiento digital
        </span>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            color: "var(--sentinel-texto-tenue)",
            fontSize: "9px",
            letterSpacing: "0.6px",
            textTransform: "uppercase",
            border: "1px solid var(--sentinel-borde)",
            borderRadius: "var(--radio-pill)",
            padding: "2px 8px"
          }}
        >
          <Lock size={9} />
          No disponible todavía
        </span>
      </div>

      <div
        style={{
          color: "var(--sentinel-texto-suave)",
          fontSize: "11.5px",
          lineHeight: 1.7,
          maxWidth: "620px"
        }}
      >
        No existe ninguna fuente integrada que lo sostenga. El dispositivo{" "}
        <strong>no se infiere</strong> desde las publicaciones: que una nota
        salga en una app no dice desde qué teléfono la leyó nadie.
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
          marginTop: "11px"
        }}
      >
        {CAMPOS.map((c) => (
          <span
            key={c}
            style={{
              color: "var(--sentinel-texto-tenue)",
              fontSize: "10px",
              border: "1px dashed var(--sentinel-borde)",
              borderRadius: "var(--radio-pill)",
              padding: "3px 9px"
            }}
          >
            {c}
          </span>
        ))}
      </div>

      <div
        style={{
          color: "var(--sentinel-texto-tenue)",
          fontSize: "10px",
          lineHeight: 1.65,
          marginTop: "11px"
        }}
      >
        Cuando exista, será <strong>agregado</strong>: analytics propios,
        campañas propias o fuente licenciada. Nunca seguimiento individual.
      </div>
    </section>
  );
}
