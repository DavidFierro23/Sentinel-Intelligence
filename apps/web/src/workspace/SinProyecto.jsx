import { FolderOpen } from "lucide-react";

/*
===========================================================
SENTINEL-UX-CONSOLIDATION-01 — SIN PROYECTO ACTIVO
===========================================================

Lo que se ve cuando no hay proyecto seleccionado, en las
secciones que dependen de uno.

LA REGLA QUE ESTA PANTALLA PROTEGE
-----------------------------------------------------------

Sin proyecto NO se muestran metricas globales mezcladas. El Lake
contiene datos de varios proyectos —incluidos dos de prueba— y
un panel que los sumara mostraria cifras que no son de ninguna
campana. Es la misma regla que Media aplica en su corpus,
subida al nivel del workspace.

Asi que no hay «vista general»: hay una invitacion a elegir.
===========================================================
*/

export default function SinProyecto({ hayProyectos = true, seccion = null }) {
  return (
    <div
      className="sentinel-fade"
      style={{
        maxWidth: "620px",
        margin: "48px auto 0",
        textAlign: "center",
        padding: "36px 28px",
        background: "var(--sentinel-surface)",
        border: "1px solid var(--sentinel-borde)",
        borderRadius: "var(--radio-l, 14px)"
      }}
    >
      <FolderOpen size={30} style={{ color: "var(--sentinel-cyan)", opacity: 0.9 }} />

      <h2
        style={{
          margin: "14px 0 0",
          fontSize: "1.02rem",
          color: "var(--sentinel-texto)",
          fontWeight: 650
        }}
      >
        {hayProyectos
          ? "Selecciona un proyecto para comenzar."
          : "Todavía no hay ningún proyecto."}
      </h2>

      <p
        style={{
          margin: "10px 0 0",
          fontSize: "0.8rem",
          color: "var(--sentinel-texto-suave)",
          lineHeight: 1.65
        }}
      >
        {hayProyectos ? (
          <>
            Todo lo que Sentinel analiza pertenece a un proyecto
            {seccion ? ` — incluida esta sección` : ""}. Elige uno en la barra superior.
          </>
        ) : (
          <>
            Crea un proyecto en <strong>Candidatos</strong> para empezar a observar
            candidatos, territorio y medios.
          </>
        )}
      </p>

      <p
        style={{
          margin: "16px 0 0",
          fontSize: "0.7rem",
          color: "var(--sentinel-texto-tenue)",
          lineHeight: 1.6,
          borderTop: "1px solid var(--sentinel-borde)",
          paddingTop: "14px"
        }}
      >
        No se muestra una vista general porque no existe: el repositorio contiene datos de
        varios proyectos y sumarlos daría cifras que no son de ninguna campaña.
      </p>
    </div>
  );
}
