import { Radio, CheckCircle2, XCircle, MinusCircle, AlertTriangle } from "lucide-react";

/*
===========================================================
ESTADO REAL DE LOS PROVEEDORES — TERRITORIAL-FRESH-01
===========================================================

Cuántos proveedores participaron DE VERDAD en esta ejecución.

LO QUE ESTE PANEL EXISTE PARA IMPEDIR
-----------------------------------------------------------

Escribir «6/6» cuando participaron dos.

En la prueba real de la ventana HOY, de nueve proveedores
declarados aportaron evidencia exactamente DOS: Google News y
YouTube. Los demás quedaron así:

    GDELT         no alcanzable desde esta máquina
    RSS directo   sin feeds declarados todavía
    SerpAPI       no ejecutado (modo sin coste)
    Brave         no ejecutado
    DuckDuckGo    no ejecutado
    Bing          no implementado

Un panel que dijera «6 proveedores configurados» estaría
mintiendo por omisión, y peor: haría leer la ausencia de un
tema como ausencia en el territorio.

TRES COSAS DISTINTAS
-----------------------------------------------------------

    aportó evidencia   participó y trajo algo
    ejecutado sin nada se le preguntó y no había
    no ejecutado       no se le preguntó

Solo el segundo autoriza a decir «no hay». Los otros dos
autorizan a decir «no lo sabemos».
===========================================================
*/

const ESTADO_VISUAL = {
  OK: { icono: CheckCircle2, color: "#22c55e", texto: "Ejecutado" },
  EJECUTADO: { icono: CheckCircle2, color: "#22c55e", texto: "Ejecutado" },
  CONFIGURADO: { icono: MinusCircle, color: "#64748b", texto: "Configurado" },
  SIN_CREDENCIAL: { icono: XCircle, color: "#eda100", texto: "Sin credencial" },
  NO_CONFIGURADO: { icono: XCircle, color: "#eda100", texto: "Sin credencial" },
  SIN_FUENTES: { icono: AlertTriangle, color: "#eda100", texto: "Sin fuentes" },
  TIEMPO_AGOTADO: { icono: XCircle, color: "#ef4444", texto: "No alcanzable" },
  ERROR: { icono: XCircle, color: "#ef4444", texto: "Error" },
  NO_EJECUTADO: { icono: MinusCircle, color: "#64748b", texto: "No ejecutado" },
  NO_IMPLEMENTADO: { icono: MinusCircle, color: "#475569", texto: "No implementado" },
  CUOTA_AGOTADA: { icono: XCircle, color: "#eda100", texto: "Cuota agotada" },
  SIN_CONFIGURAR: { icono: XCircle, color: "#eda100", texto: "Sin credencial" }
};


function Fila({ nombre, estado, detalle, aporto }) {
  const v = ESTADO_VISUAL[estado] || {
    icono: MinusCircle,
    color: "#64748b",
    texto: estado || "desconocido"
  };

  const Icono = v.icono;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "9px",
        padding: "6px 0",
        borderBottom: "1px solid rgba(255,255,255,.04)"
      }}
    >
      <Icono size={13} color={v.color} style={{ flexShrink: 0, marginTop: "2px" }} />

      <span
        style={{
          flex: "0 0 148px",
          color: aporto ? "var(--sentinel-texto)" : "var(--sentinel-texto-suave)",
          fontSize: "11.5px",
          fontWeight: aporto ? 600 : 400
        }}
      >
        {nombre}
      </span>

      <span style={{ flex: "0 0 104px", color: v.color, fontSize: "10.5px" }}>{v.texto}</span>

      <span
        style={{
          flex: 1,
          color: "var(--sentinel-texto-tenue)",
          fontSize: "10.5px",
          lineHeight: 1.55,
          minWidth: 0
        }}
      >
        {detalle}
      </span>
    </div>
  );
}


export default function ProvidersStatusPanel({ datos }) {
  const traza = datos?.conversacion?.recoleccion?.trazaMotores || [];

  const ampliada = datos?.escuchaAmpliada;

  const lotes = ampliada?.lotes || [];

  /* TERRITORIAL-RSS-ROTATION-01 */
  const rot = ampliada?.rotacionRss;

  const rotacionActiva = Boolean(rot && rot.activa !== false && rot.feedsVerificados > 0);

  if (traza.length === 0 && lotes.length === 0) return null;

  /* --- recolector base --- */
  const base = traza.map((m) => ({
    nombre: m.fuente || m.motor || m.motorId,
    estado: m.estado,
    aporto: (m.nuevas || 0) > 0,
    detalle:
      (m.nuevas || 0) > 0
        ? `${m.nuevas} evidencia(s) aportadas`
        : m.detalle || m.motivoSiNoEjecutado || m.significado || "sin resultados"
  }));

  /* --- adapters de la escucha ampliada, agrupados por proveedor --- */
  const porProveedor = new Map();

  lotes.forEach((l) => {
    const previo = porProveedor.get(l.providerId) || {
      recibidas: 0,
      estados: [],
      motivos: [],
      cuota: 0
    };

    previo.recibidas += l.recibidas || 0;

    previo.estados.push(l.estado);

    if (l.motivo) previo.motivos.push(l.motivo);

    previo.cuota += l.unidadesConsumidas || 0;

    porProveedor.set(l.providerId, previo);
  });

  const ampliados = [...porProveedor.entries()].map(([id, v]) => ({
    nombre: id,
    estado: v.estados.find((e) => e === "OK") || v.estados[0],
    aporto: v.recibidas > 0,
    detalle: v.recibidas
      ? `${v.recibidas} recibida(s)${v.cuota ? ` · ${v.cuota} unidades de cuota` : ""}`
      : v.motivos[0] || "sin resultados"
  }));

  const todos = [...base, ...ampliados];

  const aportaron = todos.filter((p) => p.aporto).length;

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
          <Radio size={13} />
          Proveedores
        </span>

        {/*
          El numerador son los que APORTARON, no los declarados.
          Es la diferencia entre informar y presumir.
        */}
        <span style={{ color: "var(--sentinel-texto-suave)", fontSize: "11px" }}>
          <strong style={{ color: "var(--sentinel-texto)" }}>{aportaron}</strong> de {todos.length}{" "}
          aportaron evidencia
        </span>
      </div>

      <div
        style={{
          color: "var(--sentinel-texto-suave)",
          fontSize: "11px",
          lineHeight: 1.7,
          marginBottom: "12px"
        }}
      >
        «No ejecutado» y «ejecutado sin resultados» no son lo mismo. Solo el segundo permite decir
        que no hay nada.
      </div>

      <div>
        {todos.map((p, i) => (
          <Fila key={`${p.nombre}-${i}`} {...p} />
        ))}
      </div>

      {/*
        ROTACION RSS — TERRITORIAL-RSS-ROTATION-01

        El presupuesto por pasada es menor que el universo de
        feeds comprobados, asi que cada pasada lee un subconjunto.
        Sin esta linea, un panel que dijera «RSS: 8 recibidas»
        haria leer la cobertura de una pasada como la del
        territorio.

        Lo que importa no es cuantos feeds hay, sino cuantos
        FALTAN por escuchar en este ciclo.
      */}
      {rotacionActiva && (
        <div
          style={{
            marginTop: "12px",
            paddingTop: "11px",
            borderTop: "1px solid var(--sentinel-borde)",
            color: "var(--sentinel-texto-suave)",
            fontSize: "10.5px",
            lineHeight: 1.7
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
            <span style={{ color: "var(--sentinel-texto)", fontWeight: 600 }}>
              Rotación RSS · ciclo {rot.ciclo}
            </span>

            <span>
              <strong style={{ color: "var(--sentinel-texto)" }}>{rot.cobertura}</strong> cubiertos
            </span>
          </div>

          <div>
            {rot.feedsVerificados} feed(s) comprobado(s) · {rot.presupuestoPorPasada} por pasada
            {rot.pendientesEnCiclo > 0
              ? ` · ${rot.pendientesEnCiclo} pendiente(s) de escuchar en este ciclo`
              : " · ciclo completo"}
            {rot.diferidasEnCiclo > 0 ? ` · ${rot.diferidasEnCiclo} diferida(s) por fallo` : ""}
          </div>

          {/*
            La proxima cohorte SI se puede decir —el algoritmo es
            determinista—. CUANDO ocurrira, no: no hay scheduler,
            y una fecha inventada seria peor que ninguna.
          */}
          {rot.proximaCohorte?.length > 0 && (
            <div style={{ color: "var(--sentinel-texto-tenue)", marginTop: "3px" }}>
              Próxima cohorte: {rot.proximaCohorte.slice(0, 4).join(", ")}
              {rot.proximaCohorte.length > 4 ? ` y ${rot.proximaCohorte.length - 4} más` : ""}
              {" · sin fecha: no hay ingesta programada"}
            </div>
          )}

          {rot.nuncaAtendidas?.length > 0 && (
            <div style={{ color: "#eda100", marginTop: "3px" }}>
              {rot.nuncaAtendidas.length} fuente(s) nunca escuchada(s) todavía.
            </div>
          )}
        </div>
      )}

      {aportaron < todos.length && (
        <div
          style={{
            marginTop: "11px",
            color: "var(--sentinel-texto-tenue)",
            fontSize: "10.5px",
            lineHeight: 1.65
          }}
        >
          {todos.length - aportaron} proveedor(es) no aportaron. Lo que no llegó por ellos pudo
          existir igualmente: la cobertura de esta vista es parcial.
        </div>
      )}
    </section>
  );
}
