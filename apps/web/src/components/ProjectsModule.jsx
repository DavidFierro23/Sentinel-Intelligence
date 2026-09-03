import { useCallback, useEffect, useState, useRef } from "react";
import {
  FolderPlus,
  FolderOpen,
  UserPlus,
  Users,
  Landmark,
  Play,
  BarChart3,
  Loader2,
  Check,
  MoreHorizontal,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
  AlertTriangle
} from "lucide-react";

import CandidateIdentityCard from "./CandidateIdentityCard";

/*
  `CandidatePhoto` ya no se importa aqui: la unica pantalla de
  este modulo que pintaba una fotografia fuera de la ficha era
  la comparacion, y ahora vive en `ComparacionEstrategica`, que
  usa EL MISMO componente. Sigue habiendo uno solo.
*/

import BaselineT0Panel from "./BaselineT0Panel";
import CandidateIdentityForm from "./CandidateIdentityForm";
import AccountIntelligencePanel from "./AccountIntelligencePanel";
/*
  `METRICA` se consume ahora donde corresponde: en la ficha de
  identidad, que es el segundo nivel. Este modulo usa
  `COBERTURA_DE_DATOS`, que nombra el mismo indicador sin
  volverlo a definir.
*/
import { fechaLocal } from "../services/identidadCandidato";

/*
  CANDIDATE-STRATEGIC-UX-01. Las seis dimensiones estrategicas y
  la comparacion por dimension. El traductor NO calcula nada
  nuevo: lee campos que `/linea-base` y `/inteligencia` ya
  devolvian y que esta ficha no consumia.
*/
import DimensionesStrip from "../candidato/DimensionesStrip";
import ComparacionEstrategica from "../candidato/ComparacionEstrategica";
import SeccionesNav from "../candidato/SeccionesNav";
import SeccionEnPreparacion from "../candidato/SeccionEnPreparacion";
import { SECCION_POR_DEFECTO, seccionPorId } from "../candidato/secciones";
import {
  dimensionesDeCandidato,
  coberturaDeDatos,
  COBERTURA_DE_DATOS,
  DISCLAIMER,
  PLATAFORMAS_PRINCIPALES,
  ETIQUETA_PLATAFORMA,
  activosAdicionales,
  NOTA_ACTIVOS_ADICIONALES
} from "../candidato/dimensionesEstrategicas";

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


/*
  `colorCobertura` vivia aqui: pintaba de verde al candidato con
  mas expediente documentado y de rojo al que tenia menos.

  Se elimina con el ranking que la usaba (§8). Un semaforo sobre
  la completitud de nuestro propio trabajo se leia como un
  semaforo sobre el candidato.
*/

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

  /* Account Intelligence — fase 1. */
  const [inteligencia, setInteligencia] = useState(null);

  /*
    LINEA BASE T0.

    CANDIDATE-STRATEGIC-UX-01 la pasa a carga automatica. Antes
    se pedia solo al pulsar un boton al final de la pagina, y
    ahi estaba el defecto de producto: la inteligencia
    estrategica —estado por plataforma, comparabilidad,
    momentum— quedaba enterrada, mientras «Solidez 68/100» era
    el titular de cada ficha.

    Se puede cargar sin pensarlo porque se ARMA DESDE EL LAKE:
    ~25 ms medidos, cero peticiones externas, cero cuota.
  */
  const [lineaBase, setLineaBase] = useState(null);

  /* El panel detallado sigue siendo opcional; el dato ya no. */
  const [verLineaBase, setVerLineaBase] = useState(false);

  /*
    Activos por candidato: distingue las cinco plataformas de la
    metodologia de los activos adicionales declarados —LinkedIn,
    web—. Tambien local.
  */
  const [activosMeta, setActivosMeta] = useState(null);

  /*
    Account Intelligence por candidato. Se guarda por id porque
    conversacion, medios y territorio se calculan por candidato
    y no vienen en la linea base. NO se precarga: son ~400 KB por
    candidato y el analista mira de uno en uno.
  */
  const [intelPorCandidato, setIntelPorCandidato] = useState({});

  /* Seccion abierta dentro de Candidate — §17. */
  const [seccion, setSeccion] = useState(SECCION_POR_DEFECTO);

  const [fotoIntentos, setFotoIntentos] = useState(null);

  /*
    CONFIRMACION EFIMERA. Un aviso que no se va obliga al analista
    a cerrarlo, y con muchos candidatos eso es fricción por cada
    guardado. Se borra sola.
  */
  const [confirmacion, setConfirmacion] = useState(null);

  const temporizadorConfirmacion = useRef(null);

  const confirmar = (texto) => {
    setConfirmacion(texto);

    if (temporizadorConfirmacion.current) {
      clearTimeout(temporizadorConfirmacion.current);
    }

    temporizadorConfirmacion.current = setTimeout(
      () => setConfirmacion(null),
      4000
    );
  };

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

        /*
          LA VISTA ESTRATEGICA SE CARGA CON EL PROYECTO.

          Las dos peticiones leen del Lake y no salen a la red.
          Van despues de pintar candidatos y cada una falla por
          separado: si la linea base falla, la lista de
          candidatos sigue en pantalla con sus dimensiones en
          «sin calcular», que es la verdad.
        */
        pedir(`/${id}/linea-base`)
          .then((b) => setLineaBase(b))
          .catch(() => setLineaBase(null));

        pedir(`/${id}/cobertura-meta`)
          .then((m) => setActivosMeta(m))
          .catch(() => setActivosMeta(null));

        setIntelPorCandidato({});

        setVerLineaBase(false);

        setSeccion(SECCION_POR_DEFECTO);
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

      /*
        -----------------------------------------------------------
        VUELTA A LA TARJETA COMPACTA
        -----------------------------------------------------------

        Antes se cerraba el modal y la ficha quedaba desplegada.
        Con un candidato se tolera; con veinte, cada guardado deja
        un panel abierto y la lista se vuelve ilegible.

        Se recarga el estado autoritativo del backend ANTES de
        colapsar, para que la tarjeta compacta ya muestre lo
        guardado y no un dato viejo durante un instante.
        -----------------------------------------------------------
      */
      const contenido = await pedir(`/${proyecto.id}`);

      setCandidatos(contenido.candidatos || []);

      setEditando(false);

      /* Colapsa la ficha: se vuelve a abrir con «Ver identidad». */
      setFichaAbierta(null);

      setFicha(null);

      confirmar(j.aviso || "Identidad actualizada correctamente.");
    } catch (e) {
      /*
        El modal NO se cierra y `ficha` no se toca: el formulario
        conserva su estado local y el analista no tiene que
        volver a escribir las URLs. Perder lo escrito por un fallo
        de red seria castigarle por un problema que no es suyo.
      */
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

  /*
    -----------------------------------------------------------
    FOTOGRAFIA DESDE FUENTES DECLARADAS
    -----------------------------------------------------------

    Solo cuando el analista lo pide. Nunca en cada render: una
    fotografia que se recalcula al pintar seria una peticion por
    pintado.
  */
  const obtenerFoto = async (candidatoId, forzar = false) => {
    setOcupado(`foto:${candidatoId}`);

    setFotoIntentos(null);

    try {
      const j = await pedir(`/${proyecto.id}/candidatos/${candidatoId}/foto`, {
        forzar
      });

      setFicha(j.ficha);

      setFotoIntentos(j.intentos || []);

      confirmar(
        j.resuelta
          ? `Fotografia obtenida desde ${j.fotoActual?.plataformaId || "la fuente indicada"}.`
          : "Ninguna fuente declaro una imagen utilizable. Se mantiene el avatar."
      );
    } catch (e) {
      setAviso(e.message);
    } finally {
      setOcupado(null);
    }
  };

  /*
    -----------------------------------------------------------
    ACCOUNT INTELLIGENCE
    -----------------------------------------------------------

    Abrir el panel NO sale a la red: describe el estado y los
    limites. Observar si, y solo cuando el analista lo pide.
  */
  const abrirInteligencia = async (candidatoId) => {
    setOcupado(`ai:${candidatoId}`);

    try {
      const j = await pedir(
        `/${proyecto.id}/candidatos/${candidatoId}/inteligencia`
      );

      setInteligencia(j);

      /*
        La misma respuesta alimenta las dimensiones de la ficha.
        Se guarda por id para no volver a pedirla: es la peticion
        mas pesada del modulo (~400 KB) y ya la tenemos.
      */
      setIntelPorCandidato((prev) => ({ ...prev, [candidatoId]: j }));
    } catch (e) {
      setAviso(e.message);
    } finally {
      setOcupado(null);
    }
  };

  const observarCuentas = async (candidatoId) => {
    setOcupado(`ai:${candidatoId}`);

    try {
      const j = await pedir(
        `/${proyecto.id}/candidatos/${candidatoId}/inteligencia`,
        {}
      );

      setInteligencia(j);

      confirmar(
        `Observacion registrada: ${j.traza?.snapshotsEscritos || 0} snapshot(s).`
      );
    } catch (e) {
      setAviso(e.message);
    } finally {
      setOcupado(null);
    }
  };

  /*
    DECLARAR EL TIPO DE UN ACTIVO META.

    No sale a la red y no consume cuota: el analista esta
    clasificando una cuenta que ya existe. Tampoco toca su
    identidad —la declaracion se guarda en su propia serie— y
    no la verifica.
  */
  const declararTipoActivo = async (candidatoId, assetId, declaredType, desde) => {
    setOcupado(`ai:${candidatoId}`);

    try {
      const j = await pedir(
        `/${proyecto.id}/candidatos/${candidatoId}/tipos-activo`,
        { assetId, declaredType }
      );

      if (j.rechazadas?.length) {
        setAviso(j.rechazadas[0].motivo);
      }

      /*
        Se recarga la pantalla desde la que se declaro. Son dos
        rutas distintas —la ficha alimenta el editor de
        identidad y `/inteligencia` el panel— y refrescar la que
        no toca dejaria el selector mostrando el valor viejo
        aunque el dato ya estuviera guardado.
      */
      if (desde === "ficha") {
        const f = await pedir(
          `/${proyecto.id}/candidatos/${candidatoId}/identidad`
        );

        setFicha(f);
      } else {
        const fresco = await pedir(
          `/${proyecto.id}/candidatos/${candidatoId}/inteligencia`
        );

        setInteligencia(fresco);
      }
    } catch (e) {
      setAviso(e.message);
    } finally {
      setOcupado(null);
    }
  };

  /*
    LINEA BASE T0. Se ARMA desde el Lake: no consume cuota de
    ningun proveedor. Lo que se observo ya esta persistido.
  */
  const abrirLineaBase = async () => {
    setOcupado("linea-base");

    try {
      const j = await pedir(`/${proyecto.id}/linea-base`);

      setLineaBase(j);

      setVerLineaBase(true);
    } catch (e) {
      setAviso(e.message);
    } finally {
      setOcupado(null);
    }
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

  /*
    =============================================================
    LA VISTA ESTRATEGICA — CANDIDATE-STRATEGIC-UX-01
    =============================================================

    Tres lecturas por candidato, cada una de su fuente:

      linea base      estado por plataforma, comparabilidad
      cobertura-meta  activos, y cuales quedan fuera de la matriz
      inteligencia    conversacion, medios, territorio, historico

    Ninguna se combina con otra en un numero.
  */
  const baseDe = (id) =>
    (lineaBase?.candidatos || []).find((b) => b.candidateId === id) || null;

  const activosDe = (id) =>
    (activosMeta?.porCandidato || []).find((a) => a.candidateId === id) || null;

  const dimensionesDe = (c) =>
    dimensionesDeCandidato({
      base: baseDe(c.id),
      inteligencia: intelPorCandidato[c.id] || null,
      momentum: lineaBase?.momentum || null
    });

  /*
    SIN `sort`, Y ES DELIBERADO.

    Lo que habia aqui ordenaba por cobertura descendente y
    pintaba una barra de progreso por tramos de color. El
    disclaimer decia que no era un ranking; la forma decia lo
    contrario, y la forma gana.

    El orden es el que declaro el analista.
  */
  const filasComparacion = candidatos
    .filter((c) => baseDe(c.id))
    .map((c) => ({
      candidateId: c.id,
      nombre: c.nombre,
      foto: c.foto || null,
      comparabilidad: baseDe(c.id)?.comparabilidad || null,
      dimensiones: dimensionesDe(c),
      coberturaDeDatos: coberturaDeDatos(c)
    }));

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

      {/*
        DISCLAIMER — §18.

        Visible y sin alarmismo: es una precision metodologica,
        no una advertencia de peligro. Va arriba, una vez, en
        lugar de repetirse en cada bloque.
      */}
      <div
        style={{
          color: "var(--sentinel-texto-tenue)",
          fontSize: "10.5px",
          lineHeight: 1.7,
          marginTop: "10px"
        }}
      >
        {DISCLAIMER}
      </div>

      {/* SUBNAVEGACION — §17 */}

      <SeccionesNav seccion={seccion} onSeleccionar={setSeccion} />

      {seccionPorId(seccion).estado === "EN_PREPARACION" && (
        <SeccionEnPreparacion seccion={seccionPorId(seccion)} />
      )}

      {/* CANDIDATOS */}

      <div
        style={{
          marginTop: "26px",
          display: seccion === "resumen" ? "block" : "none"
        }}
      >
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

                  DECIA «Investigación completada» — §19.

                  Y eso era enganoso, porque Candidate ya no hace una
                  investigacion que termina: hace observacion
                  longitudinal. El backend sigue reobservando cuentas
                  y acumulando snapshots despues de ese estado, asi
                  que «completada» sugeria que Sentinel habia dejado
                  de mirar.

                  El estado real que sostiene el dato es «hay
                  expediente inicial y la observacion continua». Se
                  dice asi.
                */}
                {c.estadoInvestigacion === "completada" && (
                  <span
                    title="Existe expediente inicial y la observación continúa: Sentinel sigue reobservando estas cuentas."
                    style={{
                      color: "#22C55E",
                      fontSize: "10.5px",
                      border: "1px solid rgba(34,197,94,.4)",
                      borderRadius: "var(--radio-pill)",
                      padding: "3px 10px"
                    }}
                  >
                    ● Observación activa
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
                  AQUI ESTABA «Solidez 68/100» — §1 y §7.

                  Era el unico numero grande de la ficha, en cian,
                  junto al nombre del candidato. Un estratega leia
                  «68 % de algo» y la pregunta inevitable era «¿eso
                  significa que este candidato esta mejor?».

                  No significa eso. Mide cuanto expediente digital
                  observable tiene Sentinel: es un indicador de
                  NUESTRO trabajo, no del candidato.

                  El calculo NO se toca. Baja al segundo nivel de la
                  ficha, con el nombre «Cobertura de datos» y su
                  aclaracion. Lo que ocupa este sitio ahora son las
                  seis dimensiones estrategicas.
                */}

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
                      : "Lanza la primera observación del candidato"
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
                      {/*
                        DECIA «Actualizar investigación» — §20.

                        Lo que ejecuta este boton es una nueva
                        OBSERVACION: vuelve a leer las cuentas y
                        escribe snapshots nuevos. El comportamiento
                        del backend no cambia; la etiqueta pasa a
                        decir lo que hace.
                      */}
                      {c.estadoInvestigacion === "completada"
                        ? "Actualizar observación"
                        : "Observar candidato"}
                    </>
                  )}
                </button>
              </div>

              {/*
                ================================================
                PRIMER NIVEL: QUE ESTA PASANDO — §3 y §16
                ================================================

                Las seis dimensiones, inmediatamente debajo del
                nombre. Este es el sitio que ocupaba «Solidez
                68/100».

                Presencia, cambio y momentum salen de la linea
                base, que ya esta cargada. Conversacion, medios y
                territorio se calculan por candidato, asi que
                hasta que se abra su inteligencia aparecen como
                «sin calcular» —no como «sin datos», que seria
                afirmar algo que no hemos mirado—.
              */}
              <DimensionesStrip
                dimensiones={dimensionesDe(c)}
                onVerEvidencias={
                  intelPorCandidato[c.id] ? () => abrirInteligencia(c.id) : null
                }
              />

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

              {/*
                ================================================
                SEGUNDO NIVEL: LO TECNICO — §7, §16 y §21
                ================================================

                Todo lo que describe el estado de NUESTRO
                expediente, junto y en gris. Incluye la cobertura
                de datos, que es de donde venia el «68 %».
              */}
              {(c.resumen || activosDe(c.id)) && (
                <div
                  style={{
                    marginTop: "12px",
                    paddingTop: "10px",
                    borderTop: "1px solid var(--sentinel-borde)",
                    display: "flex",
                    gap: "16px",
                    flexWrap: "wrap",
                    alignItems: "baseline",
                    color: "var(--sentinel-texto-tenue)",
                    fontSize: "10.5px",
                    lineHeight: 1.7
                  }}
                >
                  {/*
                    ACTIVOS POR PLATAFORMA — §5.

                    Un candidato puede tener N activos por
                    plataforma y encontrar uno no cierra el
                    discovery. Se muestran por plataforma en lugar
                    de un total, porque «9 activos» esconde que
                    dos de ellos son de Facebook.

                    Y 7 cuentas NO es mejor candidato: es solo mas
                    superficie observable.
                  */}
                  {activosDe(c.id) && (
                    <span title="Activos observados en las cinco plataformas de la metodología. Un candidato puede tener varios por plataforma.">
                      {PLATAFORMAS_PRINCIPALES.map((p) => {
                        const n = (activosDe(c.id).porPlataforma?.[p] || []).length;

                        return n ? `${ETIQUETA_PLATAFORMA[p]} ${n}` : null;
                      })
                        .filter(Boolean)
                        .join(" · ") || "sin activos en las plataformas principales"}
                    </span>
                  )}

                  {/*
                    ACTIVOS ADICIONALES — §21.

                    LinkedIn y la web existen y NO se borran. Pero
                    van aparte: no tienen medicion equivalente, asi
                    que sumarlos a la matriz de cinco plataformas
                    daria una cobertura que nadie ha medido.
                  */}
                  {activosDe(c.id) &&
                    activosAdicionales(activosDe(c.id).porPlataforma).length > 0 && (
                      <span
                        title={NOTA_ACTIVOS_ADICIONALES}
                        style={{ color: "var(--sentinel-texto-suave)" }}
                      >
                        adicionales:{" "}
                        {activosAdicionales(activosDe(c.id).porPlataforma)
                          .map((a) => `${a.etiqueta} ${a.activos}`)
                          .join(" · ")}
                      </span>
                    )}

                  {c.resumen?.evidenciasWeb != null && (
                    <span>{c.resumen.evidenciasWeb} evidencias web</span>
                  )}

                  {c.resumen?.actualizadoEn && (
                    <span title={c.resumen.actualizadoEn}>
                      última observación{" "}
                      {fechaLocal(c.resumen.actualizadoEn, proyecto)}
                    </span>
                  )}

                  {/*
                    COBERTURA DE DATOS. El mismo calculo que antes
                    se llamaba «Solidez» y ocupaba el titular:
                    ahora es una linea gris entre los datos
                    tecnicos, con su aclaracion en el `title` y en
                    el pie de la seccion.
                  */}
                  {coberturaDeDatos(c) != null && (
                    <span
                      title={`${COBERTURA_DE_DATOS.nombre}: ${COBERTURA_DE_DATOS.explicacion}`}
                      style={{ marginLeft: "auto", whiteSpace: "nowrap" }}
                    >
                      {COBERTURA_DE_DATOS.nombre}{" "}
                      <strong style={{ fontFamily: "monospace", fontWeight: 500 }}>
                        {coberturaDeDatos(c)}%
                      </strong>
                    </span>
                  )}
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
                    onObtenerFoto={() => obtenerFoto(c.id)}
                    onAnalizar={() => abrirInteligencia(c.id)}
                    fotoIntentos={fotoIntentos}
                    ocupadoFoto={ocupado === `foto:${c.id}`}
                    ocupadoAnalisis={ocupado === `ai:${c.id}`}
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

      <div
        style={{
          marginTop: "30px",
          display: seccion === "resumen" ? "block" : "none"
        }}
      >
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

      {/* COMPARACIÓN — candidato vs candidato, dimensión por dimensión */}

      <div
        style={{
          marginTop: "30px",
          display: seccion === "comparacion" ? "block" : "none"
        }}
      >
        <div style={etiqueta}>
          <BarChart3 size={13} />
          Comparación de candidatos
        </div>

        <div
          style={{
            color: "var(--sentinel-texto-tenue)",
            fontSize: "10.5px",
            lineHeight: 1.7,
            marginTop: "-6px",
            marginBottom: "10px"
          }}
        >
          Dimensión por dimensión. No hay una cifra única por candidato ni un
          orden de posición.
        </div>

        <ComparacionEstrategica filas={filasComparacion} />
      </div>

      {/*
        =============================================================
        LO QUE HABIA AQUI — §8
        =============================================================

        Una lista de candidatos ordenada por `cobertura`
        descendente, con barra de progreso y color por tramos
        (verde >=70, ambar >=50, rojo <30):

            Juan Cristóbal Lloret  68%  ████████████
            Pedro Palacios         68%  ████████████
            Yaku Pérez             63%  ███████████
            Paúl Carrasco          40%  ███████

        Funcionaba como ranking politico. Llevaba disclaimer, pero
        el orden y la barra decian otra cosa, y eso es lo que se
        lee primero.

        Ademas lo que ordenaba la lista era la completitud del
        expediente: Lloret salia arriba porque se le habia
        observado 22 veces contra 1 de Palacios. Es decir, la
        posicion medía cuanto trabajo habiamos hecho nosotros.

        `colorCobertura` desaparece con ella: era la funcion que
        pintaba de rojo a los candidatos peor documentados.

        No se sustituye por otro indice compuesto. Hoy no hay
        metodologia que lo sostenga, y el propio backend ya se
        niega a producirlo: `presencia.indice` llega con
        `disponible:false` y cinco requisitos sin cumplir.
        =============================================================
      */}


      {/* LÍNEA BASE DIGITAL T0 — P-CAND-BENCH-01 */}

      <div
        style={{
          marginTop: "26px",
          display: seccion === "redes" ? "block" : "none"
        }}
      >
        <div style={etiqueta}>
          <BarChart3 size={13} />
          Línea base digital · T0
        </div>

        {verLineaBase && lineaBase ? (
          <BaselineT0Panel datos={lineaBase} onCerrar={() => setVerLineaBase(false)} />
        ) : (
          <div style={caja}>
            <div
              style={{
                color: "var(--sentinel-texto-suave)",
                fontSize: "11.5px",
                lineHeight: 1.7
              }}
            >
              {/*
                DECIA «Lo observado en X y YouTube» — §4.

                Se quedo escrito cuando esas eran las dos
                plataformas legibles. El backend mide las cinco
                desde hace varios gates —`PLATAFORMAS_OBJETIVO` en
                `candidateBaseline.js`— y la frase seguia
                describiendo una limitacion que ya no existe.
              */}
              Lo observado por candidato en Facebook, Instagram, TikTok, X y
              YouTube, plataforma por plataforma. Se arma desde lo ya
              persistido: <strong>no consume cuota de ningún proveedor</strong>.
            </div>

            <button
              className="sentinel-boton"
              onClick={() =>
                lineaBase ? setVerLineaBase(true) : abrirLineaBase()
              }
              disabled={ocupado === "linea-base"}
              style={{ marginTop: "10px", fontSize: "11px" }}
            >
              {ocupado === "linea-base" ? "Cargando…" : "Ver detalle por plataforma"}
            </button>
          </div>
        )}
      </div>

      {/* ANÁLISIS SECUNDARIO — solo si hay actores activados */}

      {actoresActivos.length > 0 && (
        <div
          style={{
            marginTop: "30px",
            display: seccion === "comparacion" ? "block" : "none"
          }}
        >
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
      {/*
        EDITAR IDENTIDAD — en la rama del DETALLE del proyecto.

        Estaba montado en la rama de la LISTA de proyectos, que
        retorna antes. Al pulsar el boton desde el detalle,
        `editando` pasaba a true y este JSX no llegaba a
        renderizarse nunca: el formulario existia y era
        inalcanzable. Es la causa raiz de P-CAND-UX-02.
      */}
      {/*
        CONFIRMACION NO INTRUSIVA. Flota abajo a la derecha, no
        bloquea nada y se va sola. Ver `confirmar`.
      */}
      {confirmacion && (
        <div
          className="sentinel-fade"
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            bottom: "22px",
            right: "22px",
            zIndex: 160,
            display: "flex",
            alignItems: "center",
            gap: "9px",
            maxWidth: "min(420px, calc(100vw - 44px))",
            background: "var(--sentinel-primary)",
            border: "1px solid #22C55E",
            borderRadius: "var(--radio-m)",
            padding: "11px 15px",
            boxShadow: "0 12px 28px rgba(0,0,0,.45)"
          }}
        >
          <Check size={14} color="#22C55E" style={{ flexShrink: 0 }} />

          <span style={{ color: "var(--sentinel-texto)", fontSize: "11.5px", lineHeight: 1.6 }}>
            {confirmacion}
          </span>
        </div>
      )}

      {inteligencia && (
        <AccountIntelligencePanel
          datos={inteligencia}
          proyecto={proyecto}
          ocupado={ocupado === `ai:${inteligencia.candidatoId}`}
          onObservar={() => observarCuentas(inteligencia.candidatoId)}
          onDeclararTipo={(assetId, tipo) =>
            declararTipoActivo(inteligencia.candidatoId, assetId, tipo)
          }
          onCerrar={() => setInteligencia(null)}
        />
      )}

      {editando && ficha && (
        <CandidateIdentityForm
          ficha={ficha}
          proyecto={proyecto}
          /*
            Tambien mientras se declara un tipo: si no, el
            selector admite un segundo cambio antes de que
            vuelva el primero y la ficha se recarga con el
            valor equivocado.
          */
          ocupado={
            ocupado === `editar:${fichaAbierta}` ||
            ocupado === `ai:${fichaAbierta}`
          }
          onCancelar={() => setEditando(false)}
          onGuardar={guardarIdentidad}
          onDeclararTipo={(assetId, tipo) =>
            declararTipoActivo(fichaAbierta, assetId, tipo, "ficha")
          }
        />
      )}

    </section>
  );
}
