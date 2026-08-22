/*
===========================================================
PANTALLA DE CARGA — Sprint UX-BRAND-001
===========================================================

Se muestra mientras el Protocolo Universal trabaja.

SOBRE "ILUMINARSE CONFORME AVANZA"
-----------------------------------------------------------

El endpoint devuelve la investigación completa en una sola
respuesta: no emite progreso parcial. Encender plataformas con
un temporizador y presentarlo como avance real sería inventar
información, que es justo lo que esta plataforma no hace.

Lo que sí es verdadero es el ORDEN en que el Discovery Engine
consulta las seis plataformas obligatorias —la pasada a lo
ancho del Protocolo Universal—. Es ese orden el que se anima, y
la pantalla lo dice con estas palabras: «secuencia planificada».

Cuando termina, el resultado real sustituye a la secuencia: ahí
cada plataforma ya lleva su estado medido.

La animación es CSS puro, escalonada con animation-delay. Este
componente no monta un solo temporizador.
===========================================================
*/

/*
  Orden real de consulta, tomado de la pasada a lo ancho del
  planificador (platformAdapters: prioridad 1 primero).
*/
const PLATAFORMAS = [
  "X",
  "Facebook",
  "YouTube",
  "TikTok",
  "LinkedIn",
  "Instagram"
];

export default function LoadingInvestigation({ objetivo = null }) {
  return (
    <section
      className="sentinel-fade"
      aria-live="polite"
      aria-busy="true"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "22px",
        padding: "64px 24px",
        background: "var(--sentinel-surface)",
        border: "1px solid var(--sentinel-borde)",
        borderRadius: "var(--radio-l)",
        boxSizing: "border-box"
      }}
    >
      {/* ISOTIPO CON HALO EN BARRIDO */}

      <div style={{ position: "relative", width: "96px", height: "96px" }}>
        <img
          src="/assets/sentinel/sentinel-logo.svg"
          alt=""
          width={96}
          height={96}
          className="sentinel-halo-gira"
          style={{ display: "block" }}
        />
      </div>

      <div style={{ textAlign: "center" }}>
        <h2
          style={{
            margin: 0,
            color: "#FFFFFF",
            fontSize: "19px",
            fontWeight: 650,
            letterSpacing: "0.2px"
          }}
        >
          Correlacionando evidencias…
        </h2>

        {objetivo && (
          <p
            style={{
              margin: "8px 0 0 0",
              color: "var(--sentinel-cyan)",
              fontSize: "13px"
            }}
          >
            {objetivo}
          </p>
        )}
      </div>

      <div style={{ width: "min(420px, 100%)" }}>
        <div className="sentinel-barra" />
      </div>

      {/* SEIS PLATAFORMAS OBLIGATORIAS, EN ORDEN DE CONSULTA */}

      <div
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          justifyContent: "center",
          maxWidth: "560px"
        }}
      >
        {PLATAFORMAS.map((p) => (
          <span key={p} className="sentinel-plataforma sentinel-secuencia">
            <span className="sentinel-plataforma-punto" />
            {p}
          </span>
        ))}
      </div>

      {/*
        La honestidad de la pantalla: se declara qué significa la
        animación, para que nadie la lea como progreso medido.
      */}
      <p
        style={{
          margin: 0,
          color: "var(--sentinel-texto-tenue)",
          fontSize: "10.5px",
          textAlign: "center",
          maxWidth: "460px",
          lineHeight: 1.7
        }}
      >
        Secuencia planificada de consulta. El backend entrega la
        investigación completa de una vez, así que el estado real de cada
        plataforma aparece al terminar.
      </p>
    </section>
  );
}
