import { useMemo, useState } from "react";
import {
  Camera,
  Info,
  ShieldAlert,
  Tags,
  Globe,
  Users,
  Layers,
  MessageSquare
} from "lucide-react";

import { aprender, recordar } from "../services/aliasMemory";

/*
===========================================================
DASHBOARD EJECUTIVO — Sprint 3.2.4, Bloques B, F y H
===========================================================

Convierte las tarjetas en inteligencia, con una condición
innegociable: TODO sale de la evidencia que el backend devolvió.
Ningún indicador se estima.

QUÉ SE ENTREGA Y QUÉ NO
-----------------------------------------------------------

  Cuenta principal          de las cuentas atribuidas
  Índice de Huella Digital  ya lo calcula el backend
  Evidencias web            recuento real
  Evidencias sociales       recuento real
  Plataformas verificadas   de la cobertura real
  Narrativa dominante       DERIVADA de los títulos de las
                            evidencias: términos que se repiten
  Riesgos                   riesgos DE LA INVESTIGACIÓN, no
                            políticos. Ver la nota de abajo.

SOBRE «RIESGOS DETECTADOS»
-----------------------------------------------------------

El Core no produce ninguna señal de riesgo político, y no hay
forma honesta de inferirla de un recuento de cuentas. Inventar
un semáforo de riesgo sobre una persona real sería lo más grave
que esta interfaz podría hacer.

Lo que sí se puede medir con rigor son los riesgos DE LA
INVESTIGACIÓN: qué puede llevar al analista a una conclusión
equivocada. Plataformas sin comprobar, cuentas sostenidas por un
solo proveedor, homónimos con el mismo apellido. Eso es lo que
enumera la tarjeta, y su título lo dice.

SOBRE «NARRATIVA DOMINANTE»
-----------------------------------------------------------

Se calcula aquí, sobre los títulos de las evidencias reales, y
se declara como lo que es: los términos más repetidos en la
cobertura, no un análisis de discurso. El módulo de narrativas
no existe todavía.
===========================================================
*/

const VACIAS = new Set(
  ("de la el los las un una y o en con por para del al que se su sus es " +
    "sobre entre como mas más este esta estos estas fue ser son tras " +
    "ante desde hasta cuando donde quien cual cuales todo toda todos " +
    "todas otro otra hay han hace tiene tras via vía nueva nuevo").split(" ")
);

const caja = {
  background: "var(--sentinel-surface)",
  border: "1px solid var(--sentinel-borde)",
  borderRadius: "var(--radio-m)",
  padding: "16px",
  boxSizing: "border-box"
};

const etiqueta = {
  color: "var(--sentinel-cyan)",
  fontSize: "9.5px",
  letterSpacing: "1.8px",
  textTransform: "uppercase",
  marginBottom: "10px",
  display: "flex",
  alignItems: "center",
  gap: "7px"
};

function Metrica({ icono, titulo, valor, pie, color = "#FFFFFF" }) {
  return (
    <div style={caja}>
      <div style={etiqueta}>
        {icono}
        {titulo}
      </div>

      <div
        style={{
          color,
          fontSize: "27px",
          fontFamily: "monospace",
          lineHeight: 1
        }}
      >
        {valor}
      </div>

      {pie && (
        <div
          style={{
            color: "var(--sentinel-texto-tenue)",
            fontSize: "10.5px",
            marginTop: "8px",
            lineHeight: 1.55
          }}
        >
          {pie}
        </div>
      )}
    </div>
  );
}

/*
-----------------------------------------------------------
BLOQUE B · VER EVIDENCIA DE LA FOTO
-----------------------------------------------------------
*/

function EvidenciaFoto({ identidad }) {
  const [abierto, setAbierto] = useState(false);

  const inte = identidad?.inteligencia || null;

  const NIVELES = {
    1: "Wikipedia",
    2: "Perfil oficial corroborado",
    3: "Wikidata / fotografía pública",
    4: "Sin fotografía: avatar generado"
  };

  return (
    <div style={caja}>
      <div style={etiqueta}>
        <Camera size={13} />
        Fotografía
      </div>

      <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
        {identidad?.avatar && (
          <img
            src={identidad.avatar}
            alt=""
            style={{
              width: "62px",
              height: "62px",
              borderRadius: "50%",
              objectFit: "cover",
              border: "1px solid var(--sentinel-borde-vivo)",
              flexShrink: 0
            }}
          />
        )}

        <div style={{ minWidth: 0 }}>
          <div style={{ color: "#FFFFFF", fontSize: "12.5px" }}>
            {inte?.fuente || identidad?.fuente || "sin fuente declarada"}
          </div>

          <div
            style={{
              color:
                (inte?.confianza ?? 0) >= 70
                  ? "#22C55E"
                  : (inte?.confianza ?? 0) > 0
                    ? "#F59E0B"
                    : "var(--sentinel-texto-tenue)",
              fontSize: "11px",
              marginTop: "4px"
            }}
          >
            {inte?.confianzaEvaluada === false || inte == null
              ? "confianza no evaluada"
              : `confianza ${inte.confianza}/100 · ${inte.etiquetaConfianza || "—"}`}
          </div>

          <button
            className="sentinel-boton"
            onClick={() => setAbierto(!abierto)}
            style={{ marginTop: "9px", padding: "5px 13px", fontSize: "11px" }}
          >
            {abierto ? "ocultar evidencia" : "Ver evidencia"}
          </button>
        </div>
      </div>

      {abierto && (
        <div
          style={{
            marginTop: "14px",
            paddingTop: "12px",
            borderTop: "1px solid var(--sentinel-borde)",
            color: "var(--sentinel-texto-suave)",
            fontSize: "11px",
            lineHeight: 1.75
          }}
        >
          <div>
            <strong style={{ color: "var(--sentinel-cyan)" }}>Fuente:</strong>{" "}
            {inte?.fuente || "—"}
            {inte?.tipoFuente ? ` (${inte.tipoFuente})` : ""}
          </div>

          <div>
            <strong style={{ color: "var(--sentinel-cyan)" }}>Nivel:</strong>{" "}
            {inte?.nivelUsado
              ? `${inte.nivelUsado} — ${NIVELES[inte.nivelUsado] || "—"}`
              : "—"}
          </div>

          <div>
            <strong style={{ color: "var(--sentinel-cyan)" }}>Fecha:</strong>{" "}
            {inte?.activo?.consultadoEn
              ? String(inte.activo.consultadoEn).slice(0, 19).replace("T", " ")
              : "no registrada"}
          </div>

          <div>
            <strong style={{ color: "var(--sentinel-cyan)" }}>
              Motivo de selección:
            </strong>{" "}
            {inte?.motivoSeleccion || "—"}
          </div>

          <div>
            <strong style={{ color: "var(--sentinel-cyan)" }}>Licencia:</strong>{" "}
            {inte?.licencia || "—"}
          </div>

          {inte?.urlFuente && (
            <div style={{ marginTop: "6px" }}>
              <a
                href={inte.urlFuente}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#60A5FA" }}
              >
                abrir la página de la fuente
              </a>
            </div>
          )}

          <div
            style={{
              color: "var(--sentinel-texto-tenue)",
              fontSize: "10px",
              marginTop: "9px"
            }}
          >
            La imagen se sirve por el Asset Gateway, nunca directamente desde
            el origen. Si la verificación de nombre no supera sus controles, el
            motor prefiere no mostrar foto antes que mostrar la de un homónimo.
          </div>
        </div>
      )}
    </div>
  );
}

/*
===========================================================
DASHBOARD
===========================================================
*/

export default function ExecutiveDashboard({ resultado }) {
  const ficha = resultado?.fichaObjetivo || null;

  const pe = resultado?.perfilEjecutivo || null;

  /*
    BLOQUE H — aprender los alias de este resultado y recuperar los
    que ya se conocian del mismo objetivo.

    Va en useMemo y no en useEffect + useState a proposito: con un
    efecto habria que llamar setState dentro de el, lo que provoca
    un render en cascada que React marca como antipatron. Aqui el
    valor se deriva del resultado en un solo paso.

    `aprender` escribe en localStorage, que es un efecto lateral,
    pero es idempotente —deduplica por alias— y se ejecuta una vez
    por resultado nuevo, no en cada render.
  */
  const alias = useMemo(() => {
    const nombre = resultado?.fichaObjetivo?.nombrePrincipal;

    if (!nombre) return null;

    aprender(resultado);

    return recordar(nombre);
  }, [resultado]);

  const narrativa = useMemo(() => {
    const titulos = [
      ...((ficha?.evidencias?.web || []).map((e) => e.titulo || "")),
      ...((ficha?.evidencias?.sociales || []).map((e) => e.titulo || ""))
    ];

    const nombre = new Set(
      String(ficha?.nombrePrincipal || "")
        .toLowerCase()
        .split(/\s+/)
    );

    const cuenta = new Map();

    titulos.forEach((t) => {
      String(t)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .split(/[^a-z0-9]+/)
        .filter(
          (p) => p.length >= 5 && !VACIAS.has(p) && !nombre.has(p)
        )
        .forEach((p) => cuenta.set(p, (cuenta.get(p) || 0) + 1));
    });

    return [...cuenta.entries()]
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [ficha]);

  const riesgos = useMemo(() => {
    const lista = [];

    const noComp = (ficha?.coberturaPlataformas || []).filter(
      (c) => c.estadoPresencia === "no_comprobada"
    );

    if (noComp.length) {
      lista.push({
        nivel: "medio",
        texto: `${noComp.length} plataforma(s) sin comprobar (${noComp
          .map((c) => c.plataforma)
          .join(", ")}). No se puede afirmar que el objetivo no esté en ellas.`
      });
    }

    const solas = (pe?.tarjetas || []).filter(
      (t) => (t.proveedores || []).length <= 1
    );

    if (solas.length) {
      lista.push({
        nivel: "medio",
        texto: `${solas.length} cuenta(s) sostenida(s) por un solo proveedor. Una segunda fuente independiente elevaría su correspondencia.`
      });
    }

    const homonimos = (pe?.tarjetas || []).filter(
      (t) => (t.correspondencia ?? 0) < 50
    );

    if (homonimos.length) {
      lista.push({
        nivel: "alto",
        texto: `${homonimos.length} cuenta(s) llevan el apellido del objetivo pero con correspondencia baja: probables homónimos (${homonimos
          .map((t) => `@${t.handle}`)
          .join(", ")}). Requieren revisión antes de usarlas.`
      });
    }

    if (!pe?.tarjetas?.length) {
      lista.push({
        nivel: "alto",
        texto:
          "Ninguna cuenta pudo atribuirse al objetivo. No equivale a ausencia de cuentas: ninguna de las descubiertas lleva su nombre."
      });
    }

    if (resultado?.origenDescubrimiento === "duckduckgo") {
      lista.push({
        nivel: "medio",
        texto:
          "El descubrimiento recayó en DuckDuckGo, cuyo límite es de una o dos consultas por investigación. La cobertura puede estar incompleta."
      });
    }

    return lista;
  }, [ficha, pe, resultado]);

  if (!ficha) return null;

  const principal = (pe?.tarjetas || [])[0] || null;

  const verificadas = (ficha.coberturaPlataformas || []).filter(
    (c) => c.estadoPresencia === "inferida" || c.estadoPresencia === "perfil_leido"
  ).length;

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
      <h2
        style={{
          margin: "0 0 16px 0",
          color: "#FFFFFF",
          fontSize: "18px"
        }}
      >
        Dashboard ejecutivo
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(232px, 1fr))",
          gap: "12px"
        }}
      >
        <EvidenciaFoto identidad={resultado?.identidad} />

        <div style={caja}>
          <div style={etiqueta}>
            <Users size={13} />
            Cuenta principal
          </div>

          {principal ? (
            <>
              <div style={{ color: "#FFFFFF", fontSize: "15px", fontWeight: 600 }}>
                @{principal.handle}
              </div>

              <div
                style={{
                  color: "var(--sentinel-cyan)",
                  fontSize: "11px",
                  marginTop: "4px"
                }}
              >
                {principal.plataforma} · {principal.correspondencia}/100{" "}
                {principal.etiqueta}
              </div>

              <div
                style={{
                  color: "var(--sentinel-texto-tenue)",
                  fontSize: "10px",
                  marginTop: "8px",
                  lineHeight: 1.55
                }}
              >
                descubierta por {(principal.proveedores || []).join(", ") || "—"}.
                No confirmada: confirmar es competencia del analista.
              </div>
            </>
          ) : (
            <div
              style={{ color: "var(--sentinel-texto-tenue)", fontSize: "11.5px" }}
            >
              Ninguna cuenta atribuida.
            </div>
          )}
        </div>

        <Metrica
          icono={<Layers size={13} />}
          titulo="Huella digital"
          valor={`${pe?.huellaDigital?.valor ?? "—"}`}
          color={
            (pe?.huellaDigital?.valor ?? 0) >= 50 ? "#22C55E" : "#F59E0B"
          }
          pie={pe?.huellaDigital?.nivel}
        />

        <Metrica
          icono={<Globe size={13} />}
          titulo="Evidencias web"
          valor={(ficha.evidencias?.web || []).length}
          pie="hallazgos en dominios no sociales"
        />

        <Metrica
          icono={<MessageSquare size={13} />}
          titulo="Evidencias sociales"
          valor={(ficha.evidencias?.sociales || []).length}
          pie="hallazgos en dominios de plataforma"
        />

        <Metrica
          icono={<Layers size={13} />}
          titulo="Plataformas verificadas"
          valor={`${verificadas}/6`}
          color={verificadas >= 4 ? "#22C55E" : "#F59E0B"}
          pie="con presencia atribuible, de las seis obligatorias"
        />
      </div>

      {/* NARRATIVA DOMINANTE */}

      <div style={{ ...caja, marginTop: "12px" }}>
        <div style={etiqueta}>
          <Tags size={13} />
          Narrativa dominante
        </div>

        {narrativa.length ? (
          <>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {narrativa.map(([termino, n]) => (
                <span
                  key={termino}
                  style={{
                    color: "var(--sentinel-texto)",
                    fontSize: "11.5px",
                    border: "1px solid var(--sentinel-borde-vivo)",
                    borderRadius: "var(--radio-pill)",
                    padding: "4px 12px"
                  }}
                >
                  {termino}
                  <em
                    style={{
                      fontStyle: "normal",
                      color: "var(--sentinel-cyan)",
                      marginLeft: "7px"
                    }}
                  >
                    {n}
                  </em>
                </span>
              ))}
            </div>

            <div
              style={{
                color: "var(--sentinel-texto-tenue)",
                fontSize: "10px",
                marginTop: "10px",
                lineHeight: 1.6
              }}
            >
              Términos que se repiten en los titulares de la cobertura, con su
              número de apariciones. Es frecuencia medida, no análisis de
              discurso: el módulo de narrativas no existe todavía.
            </div>
          </>
        ) : (
          <div
            style={{ color: "var(--sentinel-texto-tenue)", fontSize: "11.5px" }}
          >
            Ningún término se repite lo suficiente en la cobertura para
            declarar una narrativa.
          </div>
        )}
      </div>

      {/* RIESGOS DE LA INVESTIGACIÓN */}

      <div style={{ ...caja, marginTop: "12px" }}>
        <div style={etiqueta}>
          <ShieldAlert size={13} />
          Riesgos de la investigación
        </div>

        {riesgos.length ? (
          riesgos.map((r, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: "9px",
                alignItems: "flex-start",
                paddingLeft: "10px",
                borderLeft: `2px solid ${
                  r.nivel === "alto" ? "#EF4444" : "#F59E0B"
                }`,
                marginBottom: "9px"
              }}
            >
              <span
                style={{
                  color: "var(--sentinel-texto-suave)",
                  fontSize: "11.5px",
                  lineHeight: 1.65
                }}
              >
                {r.texto}
              </span>
            </div>
          ))
        ) : (
          <div
            style={{ color: "var(--sentinel-texto-tenue)", fontSize: "11.5px" }}
          >
            Sin riesgos detectados en la calidad de esta investigación.
          </div>
        )}

        <div
          style={{
            color: "var(--sentinel-texto-tenue)",
            fontSize: "10px",
            marginTop: "8px",
            lineHeight: 1.6
          }}
        >
          Riesgos de la INVESTIGACIÓN: qué puede llevar a una conclusión
          equivocada. No es un juicio sobre la persona; el Core no produce
          señales de riesgo político y no se inventan.
        </div>
      </div>

      {/* ALIAS APRENDIDOS — BLOQUE H */}

      {alias?.alias?.length > 0 && (
        <div style={{ ...caja, marginTop: "12px" }}>
          <div style={etiqueta}>
            <Info size={13} />
            Alias conocidos de este objetivo
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {alias.alias.map((a) => (
              <span
                key={a.alias}
                title={`aprendido de: ${a.origen}`}
                style={{
                  color: "#FFFFFF",
                  fontSize: "11.5px",
                  background: "rgba(11,95,255,.16)",
                  border: "1px solid var(--sentinel-borde-vivo)",
                  borderRadius: "var(--radio-pill)",
                  padding: "4px 12px"
                }}
              >
                {a.alias}
              </span>
            ))}
          </div>

          <div
            style={{
              color: "var(--sentinel-texto-tenue)",
              fontSize: "10px",
              marginTop: "10px",
              lineHeight: 1.6
            }}
          >
            Aprendidos en {alias.investigaciones || 1} investigación(es) de este
            objetivo y conservados en este navegador. Se ofrecen para que el
            analista los reutilice; el planificador de consultas todavía no los
            consume por su cuenta.
          </div>
        </div>
      )}
    </section>
  );
}
