import { MapPin, Anchor, CircleDashed } from "lucide-react";

import {
  escalaPorCuantiles,
  SIN_DATO,
  MUESTRA_INSUFICIENTE,
  fondoHachurado
} from "../viz/palette";

/*
===========================================================
RANKING TERRITORIAL — la coropleta que todavia no puede ser
===========================================================

Sin el GeoJSON oficial no hay mapa (riesgo WR-3). Pero la
coropleta y este ranking responden a la MISMA pregunta —«que
unidad concentra mas»— y usan el MISMO agregado, la misma
escala por cuantiles y el mismo tratamiento de «sin dato».

Cuando llegue la geometria, el mapa se dibuja con estos
valores y esta escala. No es un sustituto provisional que
haya que tirar: es la tabla que UX-WR-001 §11 exige que
exista SIEMPRE junto al mapa, por accesibilidad y auditoria
(regla de interaccion 4).

TRES ESTADOS, NO DOS
-----------------------------------------------------------

    con dato               se pinta y se rankea
    muestra insuficiente   ni se pinta ni se rankea
    sin dato               ni siquiera se observo

El segundo y el tercero llevan hachurado, NUNCA el tono mas
claro de la rampa: «casi cero» y «no sabemos» no pueden
parecerse (§6.6).

EL ANCLA
-----------------------------------------------------------

Cada fila muestra la procedencia dominante con su marca. Es lo
que evita el engano central de los mapas de inteligencia: una
cifra con aspecto de precision cuando el dato solo decia
«Cuenca».
===========================================================
*/

const MARCA_PROCEDENCIA = {
  declarada: { icono: MapPin, texto: "declarada", nota: "la fuente dio la ubicación" },
  derivada: { icono: Anchor, texto: "derivada", nota: "resuelta desde un topónimo del texto" },
  agregada: {
    icono: CircleDashed,
    texto: "agregada",
    nota: "el dato solo existe en esta unidad, no más fina"
  }
};


export default function TerritorialRankingPanel({ agregado, normalizacion }) {
  if (!agregado) return null;

  const unidades = agregado.unidades || [];

  const sinDato = agregado.sinDato || [];

  const escala = escalaPorCuantiles(
    unidades.filter((u) => u.sePinta).map((u) => u.conteo)
  );

  const normalizado = normalizacion?.aplicada;

  const perCapitaBloqueado =
    normalizado && normalizado.disponible === false;

  /*
    ---------------------------------------------------------
    LA DECLARACION VA SIEMPRE, NO SOLO AL BLOQUEAR
    ---------------------------------------------------------

    Defecto medido en la verificacion de render: el aviso de
    «Dato oficial pendiente de integracion» solo aparecia si el
    analista ELEGIA una normalizacion bloqueada. En el modo por
    defecto —conteo absoluto, que es lo unico disponible hoy—
    la pantalla mostraba cifras sin decir en ningun sitio que
    eran conteos ni que faltaba el denominador oficial.

    Eso es justo el escenario peligroso: quien no toca el
    selector nunca se entera. Un aviso que hay que provocar no
    es un aviso.

    Asi que la declaracion de QUE se esta mostrando es
    permanente, y la etiqueta de dato pendiente aparece siempre
    que falte el denominador, se haya pedido o no.
  */
  const sinDenominadores =
    (normalizacion?.disponibles || []).some(
      (n) => n.id !== "absoluto" && n.disponible === false
    ) || perCapitaBloqueado;

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
          Ranking territorial
        </span>

        <span
          style={{ color: "var(--sentinel-texto-tenue)", fontSize: "10.5px" }}
        >
          {agregado.metricas?.unidadesConDato ?? 0} con dato ·{" "}
          {agregado.metricas?.unidadesMuestraInsuficiente ?? 0} muestra
          insuficiente
        </span>
      </div>

      {/*
        Va ARRIBA de las cifras, siempre. Si va debajo, se leen
        las cifras primero y se interpretan como intensidad.
      */}
      <div
        style={{
          background: sinDenominadores
            ? "rgba(201,133,0,.10)"
            : "var(--sentinel-surface-alta)",
          border: `1px solid ${
            sinDenominadores ? "#c98500" : "var(--sentinel-borde)"
          }`,
          borderRadius: "var(--radio-m)",
          padding: "10px 12px",
          marginBottom: "14px",
          color: "var(--sentinel-texto-suave)",
          fontSize: "11.5px",
          lineHeight: 1.65
        }}
      >
        {sinDenominadores && (
          <strong style={{ color: "#eda100" }}>
            Dato oficial pendiente de integración.{" "}
          </strong>
        )}

        {perCapitaBloqueado && normalizado?.motivo ? `${normalizado.motivo} ` : ""}

        Las cifras son <strong>conteo absoluto</strong> de evidencias: reflejan
        tamaño y actividad de publicación, <strong>no</strong> intensidad
        relativa a la población.

        {sinDenominadores && (
          <div
            style={{
              color: "var(--sentinel-texto-tenue)",
              fontSize: "10.5px",
              marginTop: "5px"
            }}
          >
            Sin población del INEC ni padrón del CNE no se calcula ninguna
            métrica per cápita ni porcentaje poblacional. No se estima.
          </div>
        )}
      </div>

      {unidades.length === 0 ? (
        <div
          style={{
            color: "var(--sentinel-texto-suave)",
            fontSize: "12px",
            padding: "18px 0"
          }}
        >
          Ninguna unidad territorial acumuló evidencia en esta ventana. No
          significa que no ocurriera nada: significa que nada de lo recolectado
          pudo situarse aquí.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {unidades.map((u, i) => {
            const marca =
              MARCA_PROCEDENCIA[u.procedenciaDominante] ||
              MARCA_PROCEDENCIA.agregada;

            const Icono = marca.icono;

            const color = u.sePinta
              ? escala.colorDe(u.conteo)
              : MUESTRA_INSUFICIENTE.color;

            const maximo = unidades[0]?.conteo || 1;

            return (
              <div
                key={u.unidadId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "11px",
                  padding: "9px 10px",
                  borderRadius: "var(--radio-m)",
                  background: u.sePinta
                    ? "var(--sentinel-surface-alta)"
                    : "transparent",
                  border: `1px solid ${
                    u.sePinta ? "var(--sentinel-borde)" : "transparent"
                  }`,
                  opacity: u.sePinta ? 1 : 0.72
                }}
              >
                <span
                  style={{
                    color: "var(--sentinel-texto-tenue)",
                    fontSize: "10.5px",
                    width: "16px",
                    flexShrink: 0
                  }}
                >
                  {u.sePinta ? i + 1 : "—"}
                </span>

                <span
                  style={{
                    flex: "0 0 150px",
                    color: "var(--sentinel-texto)",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}
                  title={`${u.nombre} · ${u.resolucion}${
                    u.tipo ? ` (${u.tipo})` : ""
                  }`}
                >
                  {u.nombre}
                </span>

                {/* Barra: color por cuantiles, ancho por valor */}
                <div
                  style={{
                    flex: 1,
                    minWidth: "60px",
                    height: "16px",
                    background: "var(--sentinel-bg)",
                    borderRadius: "3px",
                    overflow: "hidden"
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(3, (u.conteo / maximo) * 100)}%`,
                      height: "100%",
                      background: u.sePinta
                        ? color
                        : fondoHachurado(MUESTRA_INSUFICIENTE.color),
                      borderRadius: "3px"
                    }}
                  />
                </div>

                <span
                  style={{
                    color: "var(--sentinel-texto)",
                    fontSize: "12.5px",
                    fontWeight: 700,
                    width: "34px",
                    textAlign: "right",
                    flexShrink: 0
                  }}
                >
                  {u.conteo}
                </span>

                <span
                  title={`Procedencia ${marca.texto}: ${marca.nota}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    color: "var(--sentinel-texto-tenue)",
                    fontSize: "10px",
                    flex: "0 0 88px"
                  }}
                >
                  <Icono size={11} style={{ flexShrink: 0 }} />
                  {marca.texto}
                </span>

                {!u.sePinta && (
                  <span
                    style={{
                      color: MUESTRA_INSUFICIENTE.texto,
                      fontSize: "9.5px",
                      border: "1px solid var(--sentinel-borde)",
                      borderRadius: "var(--radio-pill)",
                      padding: "2px 7px",
                      whiteSpace: "nowrap",
                      flexShrink: 0
                    }}
                  >
                    muestra insuficiente
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {sinDato.length > 0 && (
        <div
          style={{
            marginTop: "14px",
            paddingTop: "12px",
            borderTop: "1px solid var(--sentinel-borde)"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "var(--sentinel-texto-tenue)",
              fontSize: "10.5px",
              marginBottom: "8px"
            }}
          >
            <span
              style={{
                width: "14px",
                height: "10px",
                borderRadius: "2px",
                background: fondoHachurado(SIN_DATO.color),
                border: "1px solid var(--sentinel-borde)",
                flexShrink: 0
              }}
            />
            {sinDato.length} unidad(es) SIN DATO — no es cero, es que no se
            observó nada en ellas.
          </div>

          <div
            style={{
              color: "var(--sentinel-texto-tenue)",
              fontSize: "11px",
              lineHeight: 1.7
            }}
          >
            {sinDato.map((u) => u.nombre).join(" · ")}
          </div>
        </div>
      )}

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
        Escala por {escala.base || "cuantiles"}. Umbral de muestra:{" "}
        {agregado.umbralMuestra}. Sin geometría oficial no hay mapa; esta tabla
        usa el mismo agregado y la misma escala que usará la coropleta cuando
        el GeoJSON se integre.
      </div>
    </section>
  );
}
