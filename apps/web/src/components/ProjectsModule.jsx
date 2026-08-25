import { useCallback, useEffect, useState } from "react";
import {
  FolderPlus,
  FolderOpen,
  UserPlus,
  Users,
  Landmark,
  Play,
  BarChart3,
  Info,
  Loader2,
  MoreHorizontal,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
  AlertTriangle
} from "lucide-react";

import CandidateIdentityCard from "./CandidateIdentityCard";
import CandidateIdentityForm from "./CandidateIdentityForm";
import { METRICA, fechaLocal } from "../services/identidadCandidato";

/*
===========================================================
MÓDULO DE PROYECTOS — ARQ-INV-003
===========================================================

Interfaz del modo proyecto. No investiga nada por su cuenta:
llama a las rutas de proyecto, que a su vez usan el MISMO
motor que la investigación individual.

DOS SEPARACIONES QUE LA INTERFAZ TIENE QUE SOSTENER
-----------------------------------------------------------

  1. CANDIDATOS y ACTORES DE REFERENCIA van en listas
     distintas. Un actor no aparece nunca entre los candidatos,
     porque no lo es. Los actores son OPCIONALES y el estado
     normal de esa lista es «ninguno».

  2. La COMPARACIÓN principal es candidato contra candidato. La
     del actor contra los candidatos es un análisis aparte, y
     solo existe si el analista lo activa.

Y una tercera que es de lenguaje: la cuenta que aporta el
analista se muestra siempre como «proporcionada por el
analista», nunca como cuenta verificada. Sentinel no la ha
verificado.
===========================================================
*/

const BACKEND = "http://localhost:3001";

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
  marginBottom: "12px",
  display: "flex",
  alignItems: "center",
  gap: "7px"
};

const NIVELES = ["cantonal", "provincial", "nacional", "internacional"];

function Campo({ etiqueta: e, valor, onChange, placeholder, opciones = null }) {
  return (
    <label style={{ display: "block", marginBottom: "11px" }}>
      <span
        style={{
          display: "block",
          color: "var(--sentinel-texto-suave)",
          fontSize: "10.5px",
          marginBottom: "5px"
        }}
      >
        {e}
      </span>

      {opciones ? (
        <select
          className="sentinel-entrada"
          value={valor}
          onChange={(ev) => onChange(ev.target.value)}
          style={{ width: "100%", borderRadius: "var(--radio-s)" }}
        >
          <option value="">—</option>
          {opciones.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          className="sentinel-entrada"
          value={valor}
          onChange={(ev) => onChange(ev.target.value)}
          placeholder={placeholder || ""}
          style={{ width: "100%", borderRadius: "var(--radio-s)" }}
        />
      )}
    </label>
  );
}

/*
  Plural en espanol natural: "1 proyecto guardado", "5 proyectos
  guardados". "5 guardado(s)" es una plantilla, no una frase.
*/
function contarProyectos(n) {
  return n === 1 ? "1 proyecto guardado" : `${n} proyectos guardados`;
}


function colorCobertura(p) {
  if (p >= 90) return "#22C55E";
  if (p >= 70) return "#0B5FFF";
  if (p >= 50) return "#F59E0B";
  if (p >= 30) return "#F97316";
  return "#EF4444";
}

/*
-----------------------------------------------------------
EL ID DEL PROYECTO VIVE EN LA URL

Antes vivia solo en useState, y ahi estaba el defecto: al
recargar, React se reinicia y el proyecto parecia haber
desaparecido. No habia desaparecido —estaba en disco— pero la
interfaz no tenia como volver a el.

Se reutiliza el mecanismo de deep link que ya existe (?q=), sin
montar un segundo sistema de rutas.
-----------------------------------------------------------
*/
function proyectoDeLaUrl() {
  try {
    return new URLSearchParams(window.location.search).get("proyecto") || null;
  } catch {
    return null;
  }
}

function fijarProyectoEnUrl(id) {
  try {
    const u = new URL(window.location.href);

    if (id) u.searchParams.set("proyecto", id);
    else u.searchParams.delete("proyecto");

    window.history.replaceState({}, "", u);
  } catch {
    /* Sin history API el modulo sigue funcionando, solo pierde el
       enlace directo. */
  }
}


/*
===========================================================
TARJETA DE PROYECTO CON MENU CONTEXTUAL
===========================================================

El menu va detras de un [...] y no como botones sueltos: un boton
rojo permanente junto a cada proyecto invita al accidente que
precisamente se quiere evitar.
===========================================================
*/

function TarjetaProyecto({
  p,
  abrir,
  menuAbierto,
  setMenuAbierto,
  renombrando,
  setRenombrando,
  nombreEditado,
  setNombreEditado,
  renombrar,
  cambiarEstado,
  setPorEliminar,
  ocupado
}) {
  const abierto = menuAbierto === p.id;

  const editando = renombrando === p.id;

  return (
    <div style={{ ...caja, position: "relative" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          flexWrap: "wrap"
        }}
      >
        <div style={{ minWidth: 0, flex: "1 1 240px" }}>
          {editando ? (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input
                className="sentinel-entrada"
                value={nombreEditado}
                onChange={(e) => setNombreEditado(e.target.value)}
                autoFocus
                style={{ flex: "1 1 240px", borderRadius: "var(--radio-s)" }}
              />

              <button
                className="sentinel-boton sentinel-boton-primario"
                onClick={() => renombrar(p.id)}
                disabled={
                  !nombreEditado.trim() || ocupado === `renombrar:${p.id}`
                }
                style={{ padding: "6px 13px", fontSize: "11px" }}
              >
                {ocupado === `renombrar:${p.id}` ? "Guardando…" : "Guardar"}
              </button>

              <button
                className="sentinel-boton"
                onClick={() => setRenombrando(null)}
                style={{ padding: "6px 13px", fontSize: "11px" }}
              >
                cancelar
              </button>
            </div>
          ) : (
            <>
              <div
                style={{ color: "#FFFFFF", fontSize: "14.5px", fontWeight: 600 }}
              >
                {p.nombre}
              </div>

              <div
                style={{
                  color: "var(--sentinel-cyan)",
                  fontSize: "11px",
                  marginTop: "4px"
                }}
              >
                {[p.canton, p.provincia, p.pais].filter(Boolean).join(" · ")}
                {p.dignidad ? ` — ${p.dignidad}` : ""}
              </div>

              <div
                style={{
                  color: "var(--sentinel-texto-tenue)",
                  fontSize: "10px",
                  marginTop: "4px"
                }}
              >
                {p.creadoEn ? `creado el ${String(p.creadoEn).slice(0, 10)}` : ""}
                {p.nombreAnterior ? ` · antes «${p.nombreAnterior}»` : ""}
              </div>

              {/*
                CODIFICACION SOSPECHOSA. Se avisa en lugar de
                sustituir el texto: adivinar que decia seria
                inventar datos, y taparlo esconderia el problema.
              */}
              {p.codificacionSospechosa && (
                <div
                  style={{
                    display: "flex",
                    gap: "7px",
                    alignItems: "flex-start",
                    color: "#FCD34D",
                    fontSize: "10px",
                    marginTop: "7px",
                    lineHeight: 1.6
                  }}
                >
                  <AlertTriangle size={11} style={{ flexShrink: 0, marginTop: "2px" }} />

                  <span>
                    Texto con codificación corrupta en{" "}
                    {(p.camposConCodificacionSospechosa || []).join(", ")}. Se
                    guardó así, no es un problema de visualización. Vuelve a
                    crear el proyecto o elimínalo.
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {!editando && (
          <>
            <button
              className="sentinel-boton"
              onClick={() => abrir(p.id)}
              style={{ marginLeft: "auto" }}
            >
              Abrir
            </button>

            <button
              className="sentinel-boton"
              onClick={() => setMenuAbierto(abierto ? null : p.id)}
              aria-label="Más acciones"
              aria-expanded={abierto}
              style={{
                padding: "6px 10px",
                border: "1px solid var(--sentinel-borde)",
                color: "var(--sentinel-texto-suave)"
              }}
            >
              <MoreHorizontal size={15} />
            </button>
          </>
        )}
      </div>

      {/* MENU */}

      {abierto && (
        <div
          className="sentinel-fade"
          style={{
            position: "absolute",
            right: "16px",
            top: "56px",
            zIndex: 30,
            minWidth: "210px",
            background: "var(--sentinel-primary)",
            border: "1px solid var(--sentinel-borde-vivo)",
            borderRadius: "var(--radio-m)",
            boxShadow: "0 12px 28px rgba(0,0,0,.45)",
            overflow: "hidden"
          }}
        >
          {[
            {
              id: "renombrar",
              icono: <Pencil size={13} />,
              texto: "Renombrar proyecto",
              accion: () => {
                setNombreEditado(p.nombre);
                setRenombrando(p.id);
                setMenuAbierto(null);
              }
            },
            {
              id: "archivar",
              icono: <Archive size={13} />,
              texto: "Archivar proyecto",
              accion: () => cambiarEstado(p.id, "archivado")
            },
            {
              id: "eliminar",
              icono: <Trash2 size={13} />,
              texto: "Eliminar proyecto",
              peligroso: true,
              accion: () => {
                setPorEliminar(p);
                setMenuAbierto(null);
              }
            }
          ].map((o) => (
            <button
              key={o.id}
              className="sentinel-hover"
              onClick={o.accion}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                background: "transparent",
                border: "none",
                borderTop:
                  o.id === "eliminar" ? "1px solid var(--sentinel-borde)" : "none",
                color: o.peligroso ? "#F87171" : "var(--sentinel-texto)",
                padding: "11px 14px",
                cursor: "pointer",
                fontSize: "12.5px",
                textAlign: "left"
              }}
            >
              {o.icono}
              {o.texto}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


/*
===========================================================
MODAL DE ELIMINACION

Dos pasos siempre: nadie elimina un expediente con un clic. Y se
dice con claridad que el borrado es logico, porque prometer una
destruccion que no ocurre seria mentir en la direccion contraria.
===========================================================
*/

function ModalEliminar({ proyecto, ocupado, onCancelar, onConfirmar }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(3,8,20,.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px"
      }}
    >
      <div
        className="sentinel-fade"
        style={{
          width: "min(480px, 100%)",
          background: "var(--sentinel-primary)",
          border: "1px solid #7F1D1D",
          borderRadius: "var(--radio-l)",
          padding: "24px",
          boxSizing: "border-box"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "11px",
            marginBottom: "14px"
          }}
        >
          <Trash2 size={19} color="#F87171" />

          <h2 style={{ margin: 0, color: "#FFFFFF", fontSize: "17px" }}>
            ¿Eliminar este proyecto?
          </h2>
        </div>

        <div
          style={{
            background: "var(--sentinel-surface)",
            border: "1px solid var(--sentinel-borde)",
            borderRadius: "var(--radio-s)",
            padding: "12px 14px",
            marginBottom: "14px"
          }}
        >
          <div style={{ color: "#FFFFFF", fontSize: "14px", fontWeight: 600 }}>
            {proyecto.nombre}
          </div>

          <div
            style={{
              color: "var(--sentinel-cyan)",
              fontSize: "11px",
              marginTop: "4px"
            }}
          >
            {[proyecto.canton, proyecto.provincia, proyecto.pais]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>

        <p
          style={{
            color: "var(--sentinel-texto-suave)",
            fontSize: "12.5px",
            lineHeight: 1.75,
            margin: "0 0 20px 0"
          }}
        >
          El proyecto dejará de aparecer en Mis proyectos. Sus datos
          permanecerán conservados internamente para evitar pérdidas
          accidentales.
        </p>

        <div
          style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}
        >
          <button className="sentinel-boton" onClick={onCancelar}>
            Cancelar
          </button>

          <button
            className="sentinel-boton"
            onClick={onConfirmar}
            disabled={ocupado}
            style={{
              background: "rgba(248,113,113,.14)",
              borderColor: "#7F1D1D",
              color: "#F87171",
              fontWeight: 600
            }}
          >
            {ocupado ? "Eliminando…" : "Eliminar proyecto"}
          </button>
        </div>
      </div>
    </div>
  );
}


export default function ProjectsModule() {
  const [proyecto, setProyecto] = useState(null);

  const [lista, setLista] = useState(null);

  const [cargando, setCargando] = useState(true);

  const [candidatos, setCandidatos] = useState([]);

  const [actores, setActores] = useState([]);

  const [ocupado, setOcupado] = useState(null);

  const [aviso, setAviso] = useState(null);

  /* Formularios */
  const [nuevoProyecto, setNuevoProyecto] = useState({
    nombre: "",
    pais: "Ecuador",
    provincia: "",
    canton: "",
    dignidad: "",
    tipoEleccion: "Elección seccional",
    fecha: ""
  });

  const [nuevoCandidato, setNuevoCandidato] = useState({
    nombre: "",
    rol: "",
    facebook: "",
    instagram: "",
    x: "",
    tiktok: "",
    youtube: "",
    linkedin: ""
  });

  const [nuevoActor, setNuevoActor] = useState({
    nombre: "",
    rol: "",
    nivel: "nacional",
    territorio: "",
    urlReferencia: "",
    incluirEnComparativo: false
  });

  const [verFormCandidato, setVerFormCandidato] = useState(false);

  const [verFormActor, setVerFormActor] = useState(false);

  const [verFormProyecto, setVerFormProyecto] = useState(false);

  /* Gestion del ciclo de vida. */
  const [menuAbierto, setMenuAbierto] = useState(null);

  const [renombrando, setRenombrando] = useState(null);

  const [nombreEditado, setNombreEditado] = useState("");

  const [porEliminar, setPorEliminar] = useState(null);

  const [verArchivados, setVerArchivados] = useState(false);

  /*
    FICHA DE IDENTIDAD. Se pide al backend, que es la fuente
    autoritativa del inventario consolidado: la interfaz no
    reconstruye cuentas desde la ultima corrida.
  */
  const [fichaAbierta, setFichaAbierta] = useState(null);

  const [ficha, setFicha] = useState(null);

  const [editando, setEditando] = useState(false);

  const [archivados, setArchivados] = useState([]);

  const pedir = useCallback(async (ruta, cuerpo = null, metodo = null) => {
    const r = await fetch(`${BACKEND}/api/proyectos${ruta}`, {
      method: metodo || (cuerpo === null ? "GET" : "POST"),
      headers: { "Content-Type": "application/json" },
      body: cuerpo === null ? undefined : JSON.stringify(cuerpo)
    });

    const j = await r.json();

    if (!r.ok) throw new Error(j?.motivo || j?.error || `HTTP ${r.status}`);

    return j;
  }, []);

  /*
    Abrir un proyecto: se pide su contenido al backend, que es la
    fuente de verdad. React solo cachea lo que llega.
  */
  const abrir = useCallback(
    async (id) => {
      setCargando(true);
      setAviso(null);

      try {
        const j = await pedir(`/${id}`);

        setProyecto({ ...j.proyecto, contextoMaestro: j.contextoMaestro });

        setCandidatos(j.candidatos || []);

        setActores(j.actores || []);

        fijarProyectoEnUrl(id);
      } catch (e) {
        setAviso(e.message);

        fijarProyectoEnUrl(null);
      } finally {
        setCargando(false);
      }
    },
    [pedir]
  );

  /*
    CARGA INICIAL. Se ejecuta al entrar al modulo y tras cada
    recarga del navegador. Solo LEE: no lanza ninguna
    investigacion, asi que recargar no gasta cuota de SerpAPI.
  */
  useEffect(() => {
    let vigente = true;

    (async () => {
      try {
        const j = await pedir("");

        if (!vigente) return;

        setLista(j.proyectos || []);

        const idUrl = proyectoDeLaUrl();

        if (idUrl && (j.proyectos || []).some((p) => p.id === idUrl)) {
          await abrir(idUrl);

          return;
        }
      } catch (e) {
        if (vigente) setAviso(e.message);
      }

      if (vigente) setCargando(false);
    })();

    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recargarLista = useCallback(async () => {
    try {
      const j = await pedir("");

      setLista(j.proyectos || []);
    } catch {
      /* La lista se recupera en la siguiente entrada al modulo. */
    }
  }, [pedir]);

  const cargarArchivados = useCallback(async () => {
    try {
      const j = await pedir("?estado=archivado");

      setArchivados(j.proyectos || []);
    } catch (e) {
      setAviso(e.message);
    }
  }, [pedir]);

  const renombrar = async (id) => {
    setOcupado(`renombrar:${id}`);

    try {
      const j = await pedir(`/${id}/renombrar`, { nombre: nombreEditado });

      setAviso(j.aviso);

      setRenombrando(null);

      await recargarLista();

      /* Si el proyecto renombrado esta abierto, se refresca. */
      if (proyecto?.id === id) await abrir(id);
    } catch (e) {
      setAviso(e.message);
    } finally {
      setOcupado(null);
    }
  };

  const cambiarEstado = async (id, estado) => {
    setOcupado(`estado:${id}`);

    try {
      const j = await pedir(`/${id}/estado`, { estado });

      setAviso(j.aviso);

      setPorEliminar(null);

      setMenuAbierto(null);

      await recargarLista();

      if (verArchivados) await cargarArchivados();

      /* Si estaba abierto y deja de estar activo, se cierra. */
      if (proyecto?.id === id && estado !== "activo") {
        setProyecto(null);
        setCandidatos([]);
        setActores([]);
        fijarProyectoEnUrl(null);
      }
    } catch (e) {
      setAviso(e.message);
    } finally {
      setOcupado(null);
    }
  };

  const crear = async () => {
    setOcupado("proyecto");
    setAviso(null);

    try {
      const j = await pedir("", nuevoProyecto);

      setProyecto({ ...j.proyecto, contextoMaestro: j.contextoMaestro });
      setCandidatos([]);
      setActores([]);

      fijarProyectoEnUrl(j.proyecto.id);

      recargarLista();
    } catch (e) {
      setAviso(e.message);
    } finally {
      setOcupado(null);
    }
  };

  const agregarCandidato = async () => {
    setOcupado("candidato");
    setAviso(null);

    try {
      await pedir(`/${proyecto.id}/candidatos`, nuevoCandidato);

      /*
        Se relee del backend en lugar de confiar en el estado
        local: la fuente de verdad es el almacenamiento, y asi la
        fusion de cuentas de referencia que hace el servidor se ve
        reflejada.
      */
      await abrir(proyecto.id);

      setNuevoCandidato({
        nombre: "",
        rol: "",
        facebook: "",
        instagram: "",
        x: "",
        tiktok: "",
        youtube: "",
        linkedin: ""
      });

      setVerFormCandidato(false);
    } catch (e) {
      setAviso(e.message);
    } finally {
      setOcupado(null);
    }
  };

  const agregarActor = async () => {
    setOcupado("actor");
    setAviso(null);

    try {
      const j = await pedir(`/${proyecto.id}/actores`, nuevoActor);

      await abrir(proyecto.id);

      setNuevoActor({
        nombre: "",
        rol: "",
        nivel: "nacional",
        territorio: "",
        urlReferencia: "",
        incluirEnComparativo: false
      });

      setVerFormActor(false);
      setAviso(j.aviso);
    } catch (e) {
      setAviso(e.message);
    } finally {
      setOcupado(null);
    }
  };

  /*
    -----------------------------------------------------------
    FICHA DE IDENTIDAD
    -----------------------------------------------------------
  */
  const abrirFicha = async (candidatoId) => {
    setOcupado(`ficha:${candidatoId}`);

    try {
      const f = await pedir(`/${proyecto.id}/candidatos/${candidatoId}/identidad`);

      setFicha(f);

      setFichaAbierta(candidatoId);
    } catch (e) {
      setAviso(e.message);
    } finally {
      setOcupado(null);
    }
  };

  const guardarIdentidad = async (cambios) => {
    setOcupado(`editar:${fichaAbierta}`);

    try {
      const j = await pedir(
        `/${proyecto.id}/candidatos/${fichaAbierta}`,
        cambios,
        "PATCH"
      );

      setFicha(j.ficha);

      setEditando(false);

      setAviso(j.aviso);

      /*
        El estado del proyecto se recarga del backend: editar la
        identidad cambia el candidato persistido, y la lista debe
        reflejarlo sin inventar nada.
      */
      const contenido = await pedir(`/${proyecto.id}`);

      setCandidatos(contenido.candidatos || []);
    } catch (e) {
      setAviso(e.message);
    } finally {
      setOcupado(null);
    }
  };

  /*
    COMPROBAR REDES. Reutiliza la ruta de investigacion, que ya
    reverifica sin destruir: el inventario consolidado conserva
    las cuentas atribuidas aunque el proveedor falle. No es
    «borrar y redescubrir».

    Consume cuota, asi que se lanza solo cuando el analista lo
    pide.
  */
  const comprobarRedes = async (candidatoId) => {
    await investigar("candidato", candidatoId);

    if (fichaAbierta === candidatoId) await abrirFicha(candidatoId);
  };

  const investigar = async (tipo, id) => {
    setOcupado(`${tipo}:${id}`);
    setAviso(null);

    try {
      const j = await pedir(
        `/${proyecto.id}/${tipo === "candidato" ? "candidatos" : "actores"}/${id}/investigar`,
        {}
      );

      /*
        -----------------------------------------------------------
        ESTADO AUTORITATIVO — BUG-11
        -----------------------------------------------------------

        Antes se parcheaba el candidato en memoria con `cobertura`,
        `cuentas` y `expediente`, y NO con `estadoInvestigacion`.
        El porcentaje tiene respaldo —`c.resumen?.huellaDigital ??
        c.cobertura`— y el estado no tenia ninguno, asi que los
        numeros se actualizaban y el boton seguia diciendo
        "Investigar candidato".

        No fue cosmetico: el analista volvia a pulsar y se gastaba
        cuota por duplicado. Ocurrio en el piloto de Lloret, que se
        investigo dos veces para obtener las mismas cuentas.

        Ahora el estado se RECARGA del backend, que es su unica
        fuente legitima. No se deduce "completada" de que la
        petición no fallara: eso seria simular un exito que no
        consta en la persistencia.
        -----------------------------------------------------------
      */
      const contenido = await pedir(`/${proyecto.id}`);

      /*
        `expediente` es lo unico que NO esta en el estado
        persistido: es el "que hay de nuevo" de ESTA ejecucion, y
        el unico sitio de donde puede venir es esta respuesta. Se
        conserva sobre el candidato recargado.
      */
      const conNovedades = (lista) =>
        (lista || []).map((x) =>
          x.id === id ? { ...x, expediente: j?.expediente || null } : x
        );

      setProyecto((prev) => ({
        ...prev,
        ...contenido.proyecto,
        contextoMaestro: contenido.contextoMaestro
      }));

      setCandidatos(
        tipo === "candidato"
          ? conNovedades(contenido.candidatos)
          : contenido.candidatos || []
      );

      setActores(
        tipo === "actor"
          ? conNovedades(contenido.actores)
          : contenido.actores || []
      );

      setAviso(j?.expediente?.mensaje || null);
    } catch (e) {
      setAviso(e.message);
    } finally {
      setOcupado(null);
    }
  };

  const cambiarComparativo = async (actorId, activar) => {
    setOcupado(`comp:${actorId}`);

    try {
      const j = await pedir(
        `/${proyecto.id}/actores/${actorId}/comparativo`,
        { activar }
      );

      setActores((a) =>
        a.map((x) => (x.id === actorId ? { ...x, ...j.actor } : x))
      );

      setAviso(j.aviso);
    } catch (e) {
      setAviso(e.message);
    } finally {
      setOcupado(null);
    }
  };

  /* =============================================================
     SIN PROYECTO — formulario de creación
     ============================================================= */

  if (cargando) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          color: "var(--sentinel-texto-suave)",
          fontSize: "13px"
        }}
      >
        <Loader2 size={16} color="var(--sentinel-cyan)" />
        Recuperando proyectos…
      </div>
    );
  }

  /* =============================================================
     MIS PROYECTOS — lo que faltaba: la lista persistente
     ============================================================= */

  if (!proyecto && lista && lista.length > 0 && !verFormProyecto) {
    return (
      <section className="sentinel-fade">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "11px",
            flexWrap: "wrap",
            marginBottom: "6px"
          }}
        >
          <FolderOpen size={21} color="var(--sentinel-cyan)" />

          <h1 style={{ margin: 0, color: "#FFFFFF", fontSize: "21px" }}>
            Mis proyectos
          </h1>

          <span
            style={{ color: "var(--sentinel-texto-tenue)", fontSize: "11px" }}
          >
            {contarProyectos(lista.length)}
          </span>

          <button
            className="sentinel-boton sentinel-boton-primario"
            onClick={() => setVerFormProyecto(true)}
            style={{ marginLeft: "auto" }}
          >
            + Nuevo proyecto
          </button>
        </div>

        <p
          style={{
            color: "var(--sentinel-texto-suave)",
            fontSize: "12px",
            lineHeight: 1.7,
            margin: "0 0 18px 0"
          }}
        >
          Un proyecto es un expediente permanente: sigue aquí hasta que lo
          elimines. Abrirlo recupera sus candidatos y sus investigaciones sin
          volver a buscar nada.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {lista.map((p) => (
            <TarjetaProyecto
              key={p.id}
              p={p}
              abrir={abrir}
              menuAbierto={menuAbierto}
              setMenuAbierto={setMenuAbierto}
              renombrando={renombrando}
              setRenombrando={setRenombrando}
              nombreEditado={nombreEditado}
              setNombreEditado={setNombreEditado}
              renombrar={renombrar}
              cambiarEstado={cambiarEstado}
              setPorEliminar={setPorEliminar}
              ocupado={ocupado}
            />
          ))}
        </div>

        {/* ARCHIVADOS — acceso discreto */}

        <div style={{ marginTop: "22px" }}>
          <button
            className="sentinel-boton"
            onClick={async () => {
              const nuevo = !verArchivados;

              setVerArchivados(nuevo);

              if (nuevo) await cargarArchivados();
            }}
            style={{
              padding: "5px 13px",
              fontSize: "11px",
              border: "1px solid var(--sentinel-borde)",
              color: "var(--sentinel-texto-suave)"
            }}
          >
            {verArchivados ? "ocultar archivados" : "Ver archivados"}
          </button>

          {verArchivados && (
            <div style={{ marginTop: "12px" }}>
              {archivados.length === 0 ? (
                <div
                  style={{
                    ...caja,
                    color: "var(--sentinel-texto-tenue)",
                    fontSize: "11.5px"
                  }}
                >
                  Ningún proyecto archivado.
                </div>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: "9px" }}
                >
                  {archivados.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        ...caja,
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        flexWrap: "wrap",
                        opacity: 0.82
                      }}
                    >
                      <div>
                        <div
                          style={{
                            color: "var(--sentinel-texto)",
                            fontSize: "13.5px"
                          }}
                        >
                          {p.nombre}
                        </div>

                        <div
                          style={{
                            color: "var(--sentinel-texto-tenue)",
                            fontSize: "10.5px",
                            marginTop: "3px"
                          }}
                        >
                          archivado
                          {p.archivadoEn
                            ? ` el ${String(p.archivadoEn).slice(0, 10)}`
                            : ""}{" "}
                          · conserva candidatos, expedientes y evidencias
                        </div>
                      </div>

                      <button
                        className="sentinel-boton"
                        onClick={() => cambiarEstado(p.id, "activo")}
                        disabled={ocupado === `estado:${p.id}`}
                        style={{
                          marginLeft: "auto",
                          padding: "5px 12px",
                          fontSize: "11px",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px"
                        }}
                      >
                        <ArchiveRestore size={12} /> Recuperar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* MODAL DE ELIMINACION */}

        {/* EDITAR IDENTIDAD */}

        {editando && ficha && (
          <CandidateIdentityForm
            ficha={ficha}
            ocupado={ocupado === `editar:${fichaAbierta}`}
            onCancelar={() => setEditando(false)}
            onGuardar={guardarIdentidad}
          />
        )}

        {porEliminar && (
          <ModalEliminar
            proyecto={porEliminar}
            ocupado={ocupado === `estado:${porEliminar.id}`}
            onCancelar={() => setPorEliminar(null)}
            onConfirmar={() => cambiarEstado(porEliminar.id, "eliminado")}
          />
        )}
      </section>
    );
  }

  if (!proyecto) {
    return (
      <section className="sentinel-fade" style={{ maxWidth: "620px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "11px",
            marginBottom: "16px"
          }}
        >
          <FolderPlus size={21} color="var(--sentinel-cyan)" />

          <h1 style={{ margin: 0, color: "#FFFFFF", fontSize: "21px" }}>
            Nuevo proyecto
          </h1>
        </div>

        <p
          style={{
            color: "var(--sentinel-texto-suave)",
            fontSize: "12.5px",
            lineHeight: 1.7,
            marginBottom: "20px"
          }}
        >
          Un proyecto declara el territorio y la dignidad en disputa. Ese
          contexto lo fijas tú, y tiene prioridad sobre lo que devuelva un
          buscador: una noticia de un homónimo no puede desplazarlo.
        </p>

        {lista?.length > 0 && (
          <button
            className="sentinel-boton"
            onClick={() => setVerFormProyecto(false)}
            style={{ marginBottom: "14px" }}
          >
            ← volver a mis proyectos
          </button>
        )}

        <div style={caja}>
          <Campo
            etiqueta="Nombre del proyecto"
            valor={nuevoProyecto.nombre}
            onChange={(v) => setNuevoProyecto({ ...nuevoProyecto, nombre: v })}
            placeholder="Elecciones Alcaldía Cuenca 2027"
          />

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 160px" }}>
              <Campo
                etiqueta="País"
                valor={nuevoProyecto.pais}
                onChange={(v) => setNuevoProyecto({ ...nuevoProyecto, pais: v })}
              />
            </div>

            <div style={{ flex: "1 1 160px" }}>
              <Campo
                etiqueta="Provincia"
                valor={nuevoProyecto.provincia}
                onChange={(v) =>
                  setNuevoProyecto({ ...nuevoProyecto, provincia: v })
                }
                placeholder="Azuay"
              />
            </div>

            <div style={{ flex: "1 1 160px" }}>
              <Campo
                etiqueta="Cantón"
                valor={nuevoProyecto.canton}
                onChange={(v) => setNuevoProyecto({ ...nuevoProyecto, canton: v })}
                placeholder="Cuenca"
              />
            </div>
          </div>

          <Campo
            etiqueta="Dignidad"
            valor={nuevoProyecto.dignidad}
            onChange={(v) => setNuevoProyecto({ ...nuevoProyecto, dignidad: v })}
            placeholder="Alcaldía de Cuenca"
          />

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 200px" }}>
              <Campo
                etiqueta="Tipo de elección"
                valor={nuevoProyecto.tipoEleccion}
                onChange={(v) =>
                  setNuevoProyecto({ ...nuevoProyecto, tipoEleccion: v })
                }
              />
            </div>

            <div style={{ flex: "1 1 160px" }}>
              <Campo
                etiqueta="Fecha (opcional)"
                valor={nuevoProyecto.fecha}
                onChange={(v) => setNuevoProyecto({ ...nuevoProyecto, fecha: v })}
                placeholder="2027-03-15"
              />
            </div>
          </div>

          <button
            className="sentinel-boton sentinel-boton-primario"
            onClick={crear}
            disabled={!nuevoProyecto.nombre.trim() || ocupado === "proyecto"}
            style={{ marginTop: "8px" }}
          >
            {ocupado === "proyecto" ? "Creando…" : "Crear proyecto"}
          </button>
        </div>

        {aviso && (
          <div
            style={{
              ...caja,
              marginTop: "12px",
              borderColor: "#78350F",
              color: "#FCD34D",
              fontSize: "11.5px"
            }}
          >
            {aviso}
          </div>
        )}
      </section>
    );
  }

  /* =============================================================
     VISTA DEL PROYECTO
     ============================================================= */

  const comparables = candidatos
    .map((c) => ({
      ...c,
      cobertura: c.resumen?.huellaDigital ?? c.cobertura ?? null,
      cuentas: c.resumen?.cuentas ?? c.cuentas ?? 0
    }))
    .filter((c) => c.cobertura != null);

  const actoresActivos = actores.filter((a) => a.incluirEnComparativo);

  return (
    <section className="sentinel-fade">
      {/* CABECERA */}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap"
        }}
      >
        <h1 style={{ margin: 0, color: "#FFFFFF", fontSize: "23px" }}>
          {proyecto.nombre}
        </h1>

        <button
          className="sentinel-boton"
          onClick={() => {
            setProyecto(null);
            setCandidatos([]);
            setActores([]);
            fijarProyectoEnUrl(null);
            recargarLista();
          }}
          style={{ marginLeft: "auto", padding: "6px 14px", fontSize: "11px" }}
        >
          ← mis proyectos
        </button>
      </div>

      <div
        style={{
          color: "var(--sentinel-cyan)",
          fontSize: "11.5px",
          marginTop: "6px",
          letterSpacing: "0.6px"
        }}
      >
        {[proyecto.canton, proyecto.provincia, proyecto.pais]
          .filter(Boolean)
          .join(" · ")}
        {proyecto.dignidad ? ` — ${proyecto.dignidad}` : ""}
      </div>

      {aviso && (
        <div
          style={{
            ...caja,
            marginTop: "14px",
            borderColor: "#1E3A8A",
            color: "var(--sentinel-texto-suave)",
            fontSize: "11.5px",
            lineHeight: 1.65
          }}
        >
          {aviso}
        </div>
      )}

      {/* CANDIDATOS */}

      <div style={{ marginTop: "26px" }}>
        <div style={etiqueta}>
          <Users size={13} />
          Candidatos ({candidatos.length})
        </div>

        {candidatos.length === 0 && (
          <div style={{ ...caja, color: "var(--sentinel-texto-tenue)", fontSize: "12px" }}>
            Ningún candidato todavía. Los candidatos son el núcleo del proyecto:
            tú declaras quién lo es, Sentinel no lo deduce.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {candidatos.map((c) => (
            <div key={c.id} style={caja}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  flexWrap: "wrap"
                }}
              >
                <strong style={{ color: "#FFFFFF", fontSize: "14.5px" }}>
                  {c.nombre}
                </strong>

                {c.rol && (
                  <span
                    style={{
                      color: "var(--sentinel-texto-suave)",
                      fontSize: "11px"
                    }}
                  >
                    {c.rol}
                    <em
                      style={{
                        fontStyle: "normal",
                        color: "var(--sentinel-texto-tenue)",
                        marginLeft: "6px"
                      }}
                    >
                      (declarado por el analista)
                    </em>
                  </span>
                )}

                {/*
                  ESTADO PERSISTENTE. Viene del backend, derivado de
                  que exista expediente. Si ya se investigo, el boton
                  principal deja de invitar a investigar.
                */}
                {c.estadoInvestigacion === "completada" && (
                  <span
                    style={{
                      color: "#22C55E",
                      fontSize: "10.5px",
                      border: "1px solid rgba(34,197,94,.4)",
                      borderRadius: "var(--radio-pill)",
                      padding: "3px 10px"
                    }}
                  >
                    ● Investigación completada
                  </span>
                )}

                {/*
                  ULTIMA ACTUALIZACION. Viene del expediente
                  persistido, no del momento en que se pinta: dice
                  cuando se investigo de verdad.
                */}
                {c.estadoInvestigacion === "completada" &&
                  c.resumen?.actualizadoEn && (
                    <span
                      style={{
                        color: "var(--sentinel-texto-tenue)",
                        fontSize: "10px"
                      }}
                      title={c.resumen.actualizadoEn}
                    >
                      {/*
                        Se PERSISTE en UTC y se MUESTRA en la hora
                        del territorio del proyecto. Un analista en
                        Cuenca no tiene que restar cinco horas
                        mentalmente cada vez que lee una fecha.
                      */}
                      última actualización{" "}
                      {fechaLocal(c.resumen.actualizadoEn, proyecto)}
                    </span>
                  )}

                {/*
                  LA METRICA, CON SU NOMBRE Y SU LIMITE.

                  Antes era un «42 %» suelto junto al nombre de un
                  candidato, y en rojo cuando era bajo. Asi se lee
                  como respaldo o como caida, y no mide ninguna de
                  las dos cosas: mide cuanto expediente hay
                  documentado. Se nombra y se acota.
                */}
                {(c.resumen?.huellaDigital ?? c.cobertura) != null && (
                  <span
                    title={METRICA.aclaracion}
                    style={{
                      display: "inline-flex",
                      alignItems: "baseline",
                      gap: "5px",
                      color: "var(--sentinel-texto-suave)",
                      fontSize: "10.5px"
                    }}
                  >
                    {METRICA.abreviado}
                    <strong
                      style={{
                        color: "var(--sentinel-cyan)",
                        fontFamily: "monospace",
                        fontSize: "14px"
                      }}
                    >
                      {c.resumen?.huellaDigital ?? c.cobertura}/100
                    </strong>
                  </span>
                )}

                <button
                  className="sentinel-boton"
                  onClick={() =>
                    fichaAbierta === c.id
                      ? setFichaAbierta(null)
                      : abrirFicha(c.id)
                  }
                  disabled={ocupado === `ficha:${c.id}`}
                  title="Ficha de identidad: las seis redes y la web, con su estado y procedencia"
                  style={{ padding: "6px 13px", fontSize: "11px" }}
                >
                  {fichaAbierta === c.id ? "ocultar identidad" : "Ver identidad"}
                </button>

                <button
                  className={
                    c.estadoInvestigacion === "completada"
                      ? "sentinel-boton"
                      : "sentinel-boton sentinel-boton-primario"
                  }
                  onClick={() => investigar("candidato", c.id)}
                  disabled={ocupado === `candidato:${c.id}`}
                  title={
                    c.estadoInvestigacion === "completada"
                      ? "Vuelve a consultar los proveedores y consume cuota"
                      : "Lanza la investigación"
                  }
                  style={{
                    marginLeft: "auto",
                    padding: "6px 14px",
                    fontSize: "11px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  {ocupado === `candidato:${c.id}` ? (
                    <>
                      <Loader2 size={12} /> Investigando…
                    </>
                  ) : (
                    <>
                      <Play size={12} />
                      {c.estadoInvestigacion === "completada"
                        ? "Actualizar investigación"
                        : "Investigar candidato"}
                    </>
                  )}
                </button>
              </div>

              {/* CUENTA DE REFERENCIA */}
              {(c.cuentasReferencia || []).length > 0 && (
                <div style={{ marginTop: "11px" }}>
                  {c.cuentasReferencia.map((r) => (
                    <div
                      key={r.url}
                      style={{
                        display: "flex",
                        gap: "9px",
                        alignItems: "center",
                        flexWrap: "wrap",
                        fontSize: "10.5px",
                        color: "var(--sentinel-texto-tenue)"
                      }}
                    >
                      <span style={{ color: "#FCD34D" }}>
                        cuenta de referencia
                      </span>

                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#60A5FA" }}
                      >
                        {r.plataforma || "URL"}
                      </a>

                      <span>proporcionada por el analista · no verificada por Sentinel</span>
                    </div>
                  ))}
                </div>
              )}

              {c.resumen && (
                <div
                  style={{
                    color: "var(--sentinel-texto-suave)",
                    fontSize: "11px",
                    marginTop: "10px",
                    lineHeight: 1.65
                  }}
                >
                  +{c.resumen.cuentas} cuentas · +{c.resumen.medios} medios · +
                  {c.resumen.evidenciasWeb} evidencias web
                  {c.resumen.actualizadoEn
                    ? ` · última actualización ${String(c.resumen.actualizadoEn).slice(0, 10)}`
                    : ""}
                </div>
              )}

              {/*
                LA FICHA DE IDENTIDAD. Se pide al backend y se
                muestra entera: las siete plataformas, tambien las
                vacias. Nada queda detras de un «+3 cuentas».
              */}
              {fichaAbierta === c.id && ficha && (
                <div style={{ marginTop: "12px" }}>
                  <CandidateIdentityCard
                    ficha={ficha}
                    proyecto={proyecto}
                    solidez={c.resumen?.huellaDigital ?? c.cobertura ?? null}
                    componentesSolidez={null}
                    ocupado={ocupado === `candidato:${c.id}`}
                    onEditar={() => setEditando(true)}
                    onComprobar={() => comprobarRedes(c.id)}
                    onExpediente={() => investigar("candidato", c.id)}
                  />
                </div>
              )}

              {c.expediente?.mensaje && (
                <div
                  style={{
                    color: "var(--sentinel-texto-tenue)",
                    fontSize: "10.5px",
                    marginTop: "8px",
                    lineHeight: 1.6
                  }}
                >
                  {c.expediente.mensaje}
                  {c.expediente.nuevosHallazgos && (
                    <>
                      {" "}
                      +{c.expediente.nuevosHallazgos.cuentas} cuentas, +
                      {c.expediente.nuevosHallazgos.medios} medios, +
                      {c.expediente.nuevosHallazgos.evidenciasWeb} evidencias web.
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {verFormCandidato ? (
          <div style={{ ...caja, marginTop: "10px" }}>
            <Campo
              etiqueta="Nombre"
              valor={nuevoCandidato.nombre}
              onChange={(v) => setNuevoCandidato({ ...nuevoCandidato, nombre: v })}
              placeholder="Pedro Palacios"
            />

            <Campo
              etiqueta="Rol dentro del proyecto"
              valor={nuevoCandidato.rol}
              onChange={(v) => setNuevoCandidato({ ...nuevoCandidato, rol: v })}
              placeholder="Candidato a la Alcaldía de Cuenca"
            />

            <Campo
              etiqueta="URL de Facebook (semilla de investigación)"
              valor={nuevoCandidato.facebook}
              onChange={(v) =>
                setNuevoCandidato({ ...nuevoCandidato, facebook: v })
              }
              placeholder="https://www.facebook.com/…"
            />

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {["instagram", "x", "tiktok", "youtube", "linkedin"].map((k) => (
                <div key={k} style={{ flex: "1 1 150px" }}>
                  <Campo
                    etiqueta={k}
                    valor={nuevoCandidato[k]}
                    onChange={(v) =>
                      setNuevoCandidato({ ...nuevoCandidato, [k]: v })
                    }
                    placeholder="opcional"
                  />
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
              <button
                className="sentinel-boton sentinel-boton-primario"
                onClick={agregarCandidato}
                disabled={!nuevoCandidato.nombre.trim() || ocupado === "candidato"}
              >
                {ocupado === "candidato" ? "Agregando…" : "Agregar candidato"}
              </button>

              <button
                className="sentinel-boton"
                onClick={() => setVerFormCandidato(false)}
              >
                cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            className="sentinel-boton"
            onClick={() => setVerFormCandidato(true)}
            style={{
              marginTop: "10px",
              display: "flex",
              alignItems: "center",
              gap: "7px"
            }}
          >
            <UserPlus size={13} /> Agregar candidato
          </button>
        )}
      </div>

      {/* ACTORES DE REFERENCIA */}

      <div style={{ marginTop: "30px" }}>
        <div style={etiqueta}>
          <Landmark size={13} />
          Actores de referencia — opcional
        </div>

        {actores.length === 0 && (
          <div style={{ ...caja, color: "var(--sentinel-texto-tenue)", fontSize: "12px" }}>
            Ninguno agregado. Son opcionales: el proyecto funciona
            perfectamente sin ellos, y mientras no agregues ninguno nada afecta
            a los candidatos.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {actores.map((a) => (
            <div
              key={a.id}
              style={{
                ...caja,
                borderLeft: `3px solid ${a.incluirEnComparativo ? "#A855F7" : "var(--sentinel-borde)"}`
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  flexWrap: "wrap"
                }}
              >
                <strong style={{ color: "#FFFFFF", fontSize: "14px" }}>
                  {a.nombre}
                </strong>

                <span
                  style={{
                    color: "var(--sentinel-texto-suave)",
                    fontSize: "11px"
                  }}
                >
                  {a.rol} · nivel {a.nivel || "no declarado"}
                  {a.territorio ? ` · ${a.territorio}` : ""}
                </span>

                <span
                  style={{
                    color: "var(--sentinel-texto-tenue)",
                    fontSize: "9.5px",
                    border: "1px solid var(--sentinel-borde)",
                    borderRadius: "var(--radio-pill)",
                    padding: "2px 9px"
                  }}
                >
                  NO ES CANDIDATO
                </span>

                <button
                  className="sentinel-boton"
                  onClick={() => investigar("actor", a.id)}
                  disabled={ocupado === `actor:${a.id}`}
                  style={{ marginLeft: "auto", padding: "6px 13px", fontSize: "11px" }}
                >
                  {ocupado === `actor:${a.id}` ? "Investigando…" : "Investigar actor"}
                </button>
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "9px",
                  marginTop: "12px",
                  cursor: "pointer"
                }}
              >
                <input
                  type="checkbox"
                  checked={a.incluirEnComparativo === true}
                  onChange={(e) => cambiarComparativo(a.id, e.target.checked)}
                  disabled={ocupado === `comp:${a.id}`}
                />

                <span
                  style={{
                    color: a.incluirEnComparativo
                      ? "#A855F7"
                      : "var(--sentinel-texto-suave)",
                    fontSize: "11.5px"
                  }}
                >
                  Incluir en análisis comparativo
                </span>
              </label>

              <div
                style={{
                  color: "var(--sentinel-texto-tenue)",
                  fontSize: "10px",
                  marginTop: "7px",
                  lineHeight: 1.6
                }}
              >
                {a.incluirEnComparativo
                  ? "Activado: se puede calcular correlación observable con los candidatos. La correlación no implica transferencia de votos ni causalidad."
                  : "Desactivado: este actor no afecta a ningún candidato, ni a su cobertura, ni a su grafo."}
              </div>
            </div>
          ))}
        </div>

        {verFormActor ? (
          <div style={{ ...caja, marginTop: "10px" }}>
            <Campo
              etiqueta="Nombre"
              valor={nuevoActor.nombre}
              onChange={(v) => setNuevoActor({ ...nuevoActor, nombre: v })}
              placeholder="Daniel Noboa"
            />

            <Campo
              etiqueta="Rol"
              valor={nuevoActor.rol}
              onChange={(v) => setNuevoActor({ ...nuevoActor, rol: v })}
              placeholder="Presidente de Ecuador"
            />

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 170px" }}>
                <Campo
                  etiqueta="Nivel"
                  valor={nuevoActor.nivel}
                  onChange={(v) => setNuevoActor({ ...nuevoActor, nivel: v })}
                  opciones={NIVELES}
                />
              </div>

              <div style={{ flex: "1 1 170px" }}>
                <Campo
                  etiqueta="Territorio"
                  valor={nuevoActor.territorio}
                  onChange={(v) => setNuevoActor({ ...nuevoActor, territorio: v })}
                  placeholder="Ecuador"
                />
              </div>
            </div>

            <Campo
              etiqueta="URL de referencia (opcional)"
              valor={nuevoActor.urlReferencia}
              onChange={(v) => setNuevoActor({ ...nuevoActor, urlReferencia: v })}
              placeholder="https://x.com/…"
            />

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "9px",
                margin: "4px 0 12px 0",
                cursor: "pointer"
              }}
            >
              <input
                type="checkbox"
                checked={nuevoActor.incluirEnComparativo}
                onChange={(e) =>
                  setNuevoActor({
                    ...nuevoActor,
                    incluirEnComparativo: e.target.checked
                  })
                }
              />

              <span
                style={{ color: "var(--sentinel-texto-suave)", fontSize: "11.5px" }}
              >
                Incluir en análisis comparativo (desactivado por defecto)
              </span>
            </label>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="sentinel-boton sentinel-boton-primario"
                onClick={agregarActor}
                disabled={!nuevoActor.nombre.trim() || ocupado === "actor"}
              >
                {ocupado === "actor" ? "Agregando…" : "Agregar actor"}
              </button>

              <button
                className="sentinel-boton"
                onClick={() => setVerFormActor(false)}
              >
                cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            className="sentinel-boton"
            onClick={() => setVerFormActor(true)}
            style={{
              marginTop: "10px",
              display: "flex",
              alignItems: "center",
              gap: "7px"
            }}
          >
            <UserPlus size={13} /> Agregar actor
          </button>
        )}
      </div>

      {/* COMPARACIÓN — candidato vs candidato */}

      <div style={{ marginTop: "30px" }}>
        <div style={etiqueta}>
          <BarChart3 size={13} />
          Comparación de candidatos
        </div>

        {comparables.length < 2 ? (
          <div style={{ ...caja, color: "var(--sentinel-texto-tenue)", fontSize: "12px" }}>
            Disponible cuando haya al menos dos candidatos investigados.
            {comparables.length === 1 ? " Hay uno." : ""}
          </div>
        ) : (
          <div style={caja}>
            {comparables
              .slice()
              .sort((a, b) => (b.cobertura || 0) - (a.cobertura || 0))
              .map((c) => (
                <div key={c.id} style={{ marginBottom: "12px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      color: "var(--sentinel-texto)",
                      fontSize: "12.5px"
                    }}
                  >
                    <span>{c.nombre}</span>

                    <span style={{ fontFamily: "monospace" }}>
                      {c.cobertura}% · {c.cuentas} cuentas
                    </span>
                  </div>

                  <div
                    style={{
                      height: "6px",
                      background: "var(--sentinel-borde)",
                      borderRadius: "3px",
                      marginTop: "5px"
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${c.cobertura}%`,
                        background: colorCobertura(c.cobertura),
                        borderRadius: "3px"
                      }}
                    />
                  </div>
                </div>
              ))}

            <div
              style={{
                display: "flex",
                gap: "9px",
                alignItems: "flex-start",
                color: "#FCD34D",
                fontSize: "10.5px",
                lineHeight: 1.65,
                marginTop: "6px",
                paddingTop: "10px",
                borderTop: "1px solid var(--sentinel-borde)"
              }}
            >
              <Info size={13} style={{ flexShrink: 0, marginTop: "2px" }} />

              <span>
                Estas cifras miden completitud de investigación y presencia
                digital documentada. No son intención de voto, ni aprobación, ni
                probabilidad electoral, y no hay «mejor» ni «peor» candidato en
                estos datos.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ANÁLISIS SECUNDARIO — solo si hay actores activados */}

      {actoresActivos.length > 0 && (
        <div style={{ marginTop: "30px" }}>
          <div style={etiqueta}>
            <BarChart3 size={13} />
            Análisis secundario · actor ↔ candidatos
          </div>

          <div style={{ ...caja, borderColor: "#6B21A8" }}>
            <div
              style={{
                color: "var(--sentinel-texto-suave)",
                fontSize: "11.5px",
                lineHeight: 1.7
              }}
            >
              {actoresActivos.map((a) => a.nombre).join(", ")} está en análisis
              comparativo. La correlación que se calcule es <strong>observable</strong>:
              coincidencia de medios, temas, tiempo y territorio.
            </div>

            <div
              style={{
                color: "#FCD34D",
                fontSize: "10.5px",
                lineHeight: 1.7,
                marginTop: "10px",
                paddingTop: "9px",
                borderTop: "1px solid var(--sentinel-borde)"
              }}
            >
              No implica transferencia de votos. No implica respaldo ni acuerdo.
              No implica causalidad: coincidir no es influir. Es un análisis
              separado y no modifica el expediente de ningún candidato.
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
