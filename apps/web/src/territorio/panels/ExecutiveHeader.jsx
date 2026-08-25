import { Globe2, FileText, Radio, Tags, MapPin, CalendarClock } from "lucide-react";

/*
===========================================================
CABECERA EJECUTIVA
===========================================================

Responde de un vistazo la unica pregunta que importa al abrir:

    ¿QUE ESTA PASANDO EN CUENCA?

y no

    ¿que categorias existen en la base?

CINCO CIFRAS, NI UNA MAS
-----------------------------------------------------------

evidencias · fuentes · temas · territorios · cobertura temporal

Todas salen del motor. Ninguna está escrita a mano.

LA QUINTA ES LA QUE SUELE FALTAR
-----------------------------------------------------------

«Cobertura de observación» dice cuántos días abarca lo
observado. No es cobertura poblacional ni territorial, y por
eso lleva su etiqueta explícita: sin ella, un lector razonable
la confunde con «qué porcentaje de Cuenca cubrimos», que es
otra cosa y que no sabemos.
===========================================================
*/

function Cifra({ icono: Icono, valor, etiqueta, detalle }) {
  return (
    <div style={{ minWidth: "104px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          color: "var(--sentinel-texto-tenue)",
          fontSize: "9.5px",
          letterSpacing: "1.1px",
          textTransform: "uppercase"
        }}
      >
        <Icono size={11} style={{ flexShrink: 0 }} />
        {etiqueta}
      </div>

      <div
        style={{
          color: "#FFFFFF",
          fontSize: "26px",
          fontWeight: 700,
          lineHeight: 1.15,
          marginTop: "4px"
        }}
      >
        {valor}
      </div>

      {detalle && (
        <div
          style={{
            color: "var(--sentinel-texto-suave)",
            fontSize: "10px",
            marginTop: "2px"
          }}
        >
          {detalle}
        </div>
      )}
    </div>
  );
}


function diasDeCobertura(serie) {
  const cubos = serie?.cubos || [];

  if (cubos.length === 0) return { dias: 0, observados: 0 };

  const observados = cubos.filter((c) => (c.total || 0) > 0).length;

  return { dias: cubos.length, observados };
}


export default function ExecutiveHeader({ datos }) {
  const ambito = datos?.ambito;

  const conv = datos?.conversacion;

  const terr = datos?.territorio;

  const evidencias = conv?.evidencias?.length ?? 0;

  const fuentes = conv?.medios?.resumen?.dominiosDistintos ?? 0;

  const temas = datos?.agenda?.agenda?.length ?? 0;

  const territorios =
    (terr?.agregado?.unidades?.length ?? 0) +
    (datos?.mapa?.sinGeometria?.length ? 0 : 0);

  const cob = diasDeCobertura(terr?.serie);

  const jerarquia = [ambito?.nombre, ...(ambito?.ancestros || [])]
    .filter(Boolean)
    .join(" · ");

  return (
    <header
      style={{
        background:
          "linear-gradient(135deg, var(--sentinel-primary) 0%, var(--sentinel-surface) 100%)",
        border: "1px solid var(--sentinel-borde-vivo)",
        borderRadius: "var(--radio-l)",
        padding: "22px 26px"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "11px",
          marginBottom: "3px"
        }}
      >
        <Globe2 size={19} color="var(--sentinel-cyan)" style={{ flexShrink: 0 }} />

        <h1
          style={{
            margin: 0,
            color: "#FFFFFF",
            fontSize: "20px",
            fontWeight: 700,
            letterSpacing: "0.2px"
          }}
        >
          Inteligencia Territorial
        </h1>
      </div>

      <div
        style={{
          color: "var(--sentinel-cyan)",
          fontSize: "12.5px",
          fontWeight: 600,
          letterSpacing: "0.4px",
          marginLeft: "30px"
        }}
      >
        {jerarquia || "Territorio sin declarar"}
      </div>

      <div
        style={{
          color: "var(--sentinel-texto-suave)",
          fontSize: "11.5px",
          marginLeft: "30px",
          marginTop: "3px"
        }}
      >
        Conversación pública observada
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "30px",
          marginTop: "20px",
          paddingTop: "18px",
          borderTop: "1px solid var(--sentinel-borde)"
        }}
      >
        <Cifra
          icono={FileText}
          etiqueta="Evidencias"
          valor={evidencias}
          detalle="documentos observados"
        />

        <Cifra
          icono={Radio}
          etiqueta="Fuentes"
          valor={fuentes}
          detalle="publicadores distintos"
        />

        <Cifra
          icono={Tags}
          etiqueta="Temas detectados"
          valor={temas}
          detalle={
            datos?.agenda?.metricas?.sinCategoria
              ? `${datos.agenda.metricas.sinCategoria} sin categoría`
              : null
          }
        />

        <Cifra
          icono={MapPin}
          etiqueta="Territorios"
          valor={territorios}
          detalle="unidades con evidencia"
        />

        {/*
          Cobertura DE OBSERVACION. La etiqueta es explicita a
          proposito: sin ella se lee como cobertura poblacional,
          que es otra cosa y que no sabemos.
        */}
        <Cifra
          icono={CalendarClock}
          etiqueta="Cobertura de observación"
          valor={cob.dias ? `${cob.observados}/${cob.dias}` : "—"}
          detalle={cob.dias ? "días con observación" : "sin serie temporal"}
        />
      </div>
    </header>
  );
}
