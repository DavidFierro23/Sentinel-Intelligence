import { Users, Building2, MapPin, CalendarClock, HelpCircle } from "lucide-react";

/*
===========================================================
ENTIDADES OBSERVADAS — D2
===========================================================

Desde D2 la agenda temática ya no muestra personas. «Marisol
Peñaloza» encabezaba la lista por delante de «elecciones
seccionales», y eso responde mal a la pregunta que se le hace:
un nombre propio es un sujeto sin predicado.

Pero sacarla de la agenda sin ponerla en ningún sitio habría
BORRADO información de la pantalla, que es peor que tenerla mal
colocada. Este bloque es la otra mitad de esa corrección.

QUÉ APORTA QUE NO APORTABA EL RANKING
-----------------------------------------------------------

La relación. En la agenda, «Marisol Peñaloza» era una fila con
un número. Aquí es una entidad con los temas en los que
aparece, y esa es la información que un analista usa: no
importa tanto que se la nombre mucho como EN QUÉ se la nombra.

Cuando no coincide con ningún tema, también se dice. Una
persona muy mencionada cuyas notas no forman tema es un hecho
que merece verse, no un hueco que rellenar.
===========================================================
*/

const ICONO = {
  PERSON: Users,
  ORGANIZATION: Building2,
  PLACE: MapPin,
  EVENT: CalendarClock,
  OTHER_ENTITY: HelpCircle
};

const ETIQUETA = {
  PERSON: "persona",
  ORGANIZATION: "organización",
  PLACE: "lugar",
  EVENT: "evento",
  OTHER_ENTITY: "sin clasificar"
};


export default function EntitiesPanel({ escucha }) {
  const entidades = escucha?.entidades || [];

  if (entidades.length === 0) return null;

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
          <Users size={13} />
          Entidades observadas
        </span>

        <span style={{ color: "var(--sentinel-texto-tenue)", fontSize: "10.5px" }}>
          {entidades.length} · fuera de la agenda temática
        </span>
      </div>

      <div
        style={{
          color: "var(--sentinel-texto-suave)",
          fontSize: "11px",
          lineHeight: 1.7,
          marginBottom: "14px"
        }}
      >
        Quién aparece en el corpus. <strong>No son temas</strong>: una persona o
        una organización es un sujeto, no un asunto. Se muestran con los temas
        en los que aparecen.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {entidades.map((e) => {
          const Icono = ICONO[e.tipoEntidad] || HelpCircle;

          return (
            <div
              key={e.id || e.entidad}
              style={{
                background: "var(--sentinel-bg)",
                border: "1px solid var(--sentinel-borde)",
                borderRadius: "var(--radio-m)",
                padding: "11px 13px"
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "9px",
                  flexWrap: "wrap"
                }}
              >
                <Icono size={13} color="var(--sentinel-cyan)" style={{ flexShrink: 0 }} />

                <span
                  style={{
                    color: "var(--sentinel-texto)",
                    fontSize: "13px",
                    fontWeight: 650
                  }}
                >
                  {e.entidad}
                </span>

                <span
                  style={{
                    color: "var(--sentinel-texto-tenue)",
                    fontSize: "9.5px",
                    border: "1px solid var(--sentinel-borde)",
                    borderRadius: "var(--radio-pill)",
                    padding: "2px 7px"
                  }}
                >
                  {ETIQUETA[e.tipoEntidad] || e.tipoEntidad}
                </span>

                <span
                  style={{
                    marginLeft: "auto",
                    color: "var(--sentinel-texto-suave)",
                    fontSize: "11px"
                  }}
                >
                  {(e.indices || []).length} evidencias observadas
                </span>
              </div>

              {/*
                La relación con los temas es lo que este bloque
                aporta y el ranking no aportaba.
              */}
              {e.temasRelacionados?.length > 0 ? (
                <div
                  style={{
                    marginTop: "8px",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "6px",
                    alignItems: "center"
                  }}
                >
                  <span
                    style={{ color: "var(--sentinel-texto-tenue)", fontSize: "10px" }}
                  >
                    aparece en
                  </span>

                  {e.temasRelacionados.slice(0, 4).map((r) => (
                    <span
                      key={r.temaId}
                      style={{
                        background: "rgba(34,211,238,.08)",
                        border: "1px solid rgba(34,211,238,.28)",
                        borderRadius: "var(--radio-pill)",
                        padding: "2px 8px",
                        color: "var(--sentinel-texto-suave)",
                        fontSize: "10.5px"
                      }}
                    >
                      {r.etiqueta} · {r.evidenciasCompartidas}
                    </span>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    marginTop: "7px",
                    color: "var(--sentinel-texto-tenue)",
                    fontSize: "10.5px",
                    lineHeight: 1.6
                  }}
                >
                  No coincide con ningún tema descubierto. La entidad existe; el
                  asunto que la rodea todavía no forma tema.
                </div>
              )}

              {/*
                Por qué Sentinel la trata como entidad y no como
                tema. Sin esto, la decisión sería opaca.
              */}
              {e.razonesEntidad?.length > 0 && (
                <details style={{ marginTop: "8px" }}>
                  <summary
                    style={{
                      cursor: "pointer",
                      color: "var(--sentinel-cyan)",
                      fontSize: "10px",
                      listStyle: "none"
                    }}
                  >
                    ¿por qué no es un tema?
                  </summary>

                  <ul
                    style={{
                      margin: "6px 0 0 0",
                      paddingLeft: "16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px"
                    }}
                  >
                    {e.razonesEntidad.map((r, i) => (
                      <li
                        key={i}
                        style={{
                          color: "var(--sentinel-texto-tenue)",
                          fontSize: "10.5px",
                          lineHeight: 1.6
                        }}
                      >
                        {r}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
