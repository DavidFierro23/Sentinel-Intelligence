// apps/backend/services/social/discovery/discoveryEngine.js

import {
  normalizarTexto,
  normalizarUrl,
  extraerDominio,
  detectarPlataformaPorUrl,
  extraerHandle,
  obtenerEnlace,
  textoDeResultado
} from "../../textUtils.js";

import {
  buscarWeb,
  crearSesion,
  resumirSesion,
  diagnosticoProveedores
} from "../../searchProviderLayer.js";

import {
  esPlataformaSocial,
  TIPOS_CON_IDENTIDAD,
  MODOS_ACCESO,
  ESTADOS_PRESENCIA,
  catalogoPlataformas
} from "../socialContracts.js";

/* Sprint 3.2 — Identity First Search */
import {
  ADAPTADORES,
  adaptadorPorPlataforma,
  planificarConsultasDerivadas,
  esRutaDePerfil
} from "./platformAdapters.js";

import { contextBoostDeCandidato } from "../identity/contextBoost.js";

/* SD-1A — descubrimiento desde las evidencias ya existentes. */
import { descubrirDesdeEvidencias, clasificarUrlSocial } from "./socialUrlClassifier.js";

/* Platform Scanner — cuentas declaradas en base de conocimiento. */
import { escanearPlataformas } from "../platforms/platformScanner.js";
import { DOMINIO_POLITICA_EC } from "../identity/contextBoost.js";

/*
===========================================================
DISCOVERY ENGINE
===========================================================

Responsabilidad: producir la lista de CUENTAS CANDIDATAS por
plataforma. Descubre; NO decide si pertenecen al objetivo
(eso es del Identity Matcher).

TRES VÍAS, en orden de fiabilidad (ARQ-SIL-001 §3.1):

  1. Handles ya observados en el Perfil de Referencia
     — la más fiable: la URL ya apareció en evidencias reales.
  2. Evidencias del Fusion Engine que apuntan a plataformas
     sociales — ya están recogidas, no cuesta nada.
  3. Consultas dirigidas vía Search Provider Layer
     — site:instagram.com "Nombre" término_discriminante

PROVEEDORES:

No se consulta ningún buscador directamente. Se pide a la
Search Provider Layer, que resuelve con el proveedor
disponible (Brave si tiene clave, DuckDuckGo como respaldo) y
declara cuál usó. El origen de cada hallazgo queda registrado
con el proveedor REAL que lo encontró.

LÍMITE DEL SPRINT 3.1:

No se lee ningún perfil: no hay Platform Scanner todavía. Por
eso toda presencia descubierta es `presencia_inferida`, y así
se declara. No se sondea la existencia de URLs de perfil por
red (quedaría a merced del bloqueo de las plataformas, el
mismo error que ya cometimos con DuckDuckGo).
===========================================================
*/


const LIMITE_CONSULTAS_DIRIGIDAS = 4;

const PLATAFORMAS = catalogoPlataformas();


/*
-----------------------------------------------------------
REGISTRAR UN CANDIDATO

Un candidato se identifica por plataforma + handle. Si el
mismo aparece por varias vías, se acumulan sus ORÍGENES en
lugar de duplicarlo.
-----------------------------------------------------------
*/

function registrarCandidato(mapa, datos) {
  const {
    plataforma,
    handle,
    url,
    urlNormalizada,
    via,
    proveedor,
    consulta,
    etiquetaConsulta,
    titulo,
    descripcion,
    evidenciaId,

    /*
      L-2 — NO AUTOVERIFICACION.

      Un origen marcado asi ENTRA en la trazabilidad y NO cuenta
      como corroboracion. Ver la nota de la VIA 0.
    */
    noCuentaComoCorroboracion,
    origenDeclarado
  } = datos;

  const clave = `${plataforma.id}:${normalizarTexto(handle)}`;

  if (!mapa.has(clave)) {
    mapa.set(clave, {
      id: `cnd-${mapa.size}`,

      plataformaId: plataforma.id,
      plataforma: plataforma.nombre,
      tipoPlataforma: plataforma.tipo,

      handle,
      handleTipo: datos.handleTipo || "extraido",
      url,
      urlNormalizada,
      dominio: extraerDominio(url),

      /*
        Textos observados en el descubrimiento. Es lo único
        que tenemos del "perfil" mientras no exista el
        Platform Scanner: no se presenta como biografía.
      */
      titulosObservados: [],
      descripcionesObservadas: [],

      /*
        Trazabilidad: cada vía y proveedor que lo aportó.
      */
      origenes: [],

      /*
        Sin Platform Scanner no se lee el perfil.
      */
      modoAcceso: MODOS_ACCESO.PRESENCIA_INFERIDA,
      estadoPresencia: ESTADOS_PRESENCIA.INFERIDA,

      descubiertoEn: new Date().toISOString()
    });
  }

  const candidato = mapa.get(clave);

  /*
    Origen sin duplicar: misma vía + mismo proveedor + misma
    consulta cuenta una sola vez.
  */
  const claveOrigen = `${via}|${proveedor || "-"}|${consulta || "-"}`;

  if (!candidato.origenes.some((o) => o.clave === claveOrigen)) {
    candidato.origenes.push({
      clave: claveOrigen,
      via,
      proveedor: proveedor || null,
      consulta: consulta || null,
      etiquetaConsulta: etiquetaConsulta || null,
      evidenciaId: evidenciaId || null,

      /*
        Quien lo aporto —"analista" o, por omision, el propio
        sistema— y si ese aporte puede corroborar.
      */
      origen: origenDeclarado || "sentinel",
      noCuentaComoCorroboracion: noCuentaComoCorroboracion === true,

      registradoEn: new Date().toISOString()
    });
  }

  if (titulo && !candidato.titulosObservados.includes(titulo)) {
    candidato.titulosObservados.push(titulo);
  }

  if (
    descripcion &&
    descripcion.length > 15 &&
    !candidato.descripcionesObservadas.includes(descripcion)
  ) {
    candidato.descripcionesObservadas.push(descripcion);
  }

  return candidato;
}


/*
-----------------------------------------------------------
EXTRAER CANDIDATO DE UN RESULTADO

Clasifica por DOMINIO, nunca por el texto del título.
-----------------------------------------------------------
*/

function candidatoDesdeResultado(resultado, via, contexto = {}) {
  const enlace = obtenerEnlace(resultado);

  if (!enlace) return null;

  const plataforma = detectarPlataformaPorUrl(enlace);

  if (!plataforma) return null;

  if (!esPlataformaSocial(plataforma.id)) return null;

  if (!TIPOS_CON_IDENTIDAD.includes(plataforma.tipo)) return null;

  /*
    ---------------------------------------------------------
    EL CLASIFICADOR SD-1A ES LA AUTORIDAD SOBRE LA RUTA
    ---------------------------------------------------------

    Defecto detectado al integrar SerpAPI (Sprint 3.2.2).

    Habia DOS autoridades respondiendo a la misma pregunta
    —"¿esta URL es una cuenta, y de quien?"— con criterios
    distintos:

      · clasificarUrlSocial  conoce las rutas de cada
                             plataforma y rechaza el contenido
      · extraerHandle        solo mira la forma del segmento

    Con las URLs reales de Google la discrepancia produjo
    cuentas inventadas. Medido en Daniel Noboa:

      evidencia:  instagram.com/p/DcRCcfKnEjY/     (publicacion)
      candidato:  instagram.com/dcrccfknejy        (INEXISTENTE)

    El codigo de sesion de una publicacion se convirtio en un
    handle y se reconstruyo una URL de perfil que nunca ha
    existido. El propio registro lo delataba con
    `coincideConReconstruida: false`, y se admitia igual.

    Eso es inventar una cuenta: la regla que este modulo no
    puede romper. Ahora manda el clasificador, y
    `extraerHandle` queda como respaldo solo para lo que el
    clasificador admite.
  */
  const clasificacion = clasificarUrlSocial(enlace);

  if (clasificacion?.esSocial && !clasificacion.esCuenta) {
    return {
      descartado: true,
      url: enlace,
      plataformaId: plataforma.id,
      plataforma: plataforma.nombre,
      via,
      tipoUrl: clasificacion.tipo,
      motivo:
        clasificacion.motivoExclusion ||
        `${clasificacion.tipo}: la URL no identifica una cuenta (${clasificacion.motivo || "ruta no reconocida"})`
    };
  }

  let handle = clasificacion?.esCuenta
    ? clasificacion.handle
    : extraerHandle(enlace);

  let handleTipo = clasificacion?.esCuenta
    ? clasificacion.handleDerivadoDeContenido
      ? "derivado_de_contenido"
      : "extraido"
    : "extraido";

  /*
    ---------------------------------------------------------
    SPRINT 3.2.1 · objetivo 3 — NO PERDER URLS CORROBORADAS
    ---------------------------------------------------------

    Antes, si extraerHandle fallaba el candidato se descartaba
    en silencio. Se perdian asi URLs publicas y corroboradas
    de las plataformas exactamente en los casos mas
    frecuentes:

        facebook.com/profile.php?id=100001234
        facebook.com/UnaPagina-123456789
        youtube.com/channel/UCxxxxxxxx

    Descartarlas hacia que el grafo no tuviera nodo para una
    plataforma donde SI hay presencia publica documentada.

    Ahora se conserva la URL con un identificador derivado de
    su ruta y se marca `handleTipo` para que ni el Identity
    Matcher ni el panel la traten como un handle real: S2
    (coincidencia de usuario) no debe premiar un
    "profile.php" ni un identificador de canal.

    Las rutas que NO son perfiles (watch, results, status...)
    se siguen descartando: son contenido, no cuentas.
  */
  if (!handle) {
    const normalizada = normalizarUrl(enlace);

    const ruta = (normalizada || "").split("?")[0].split("/").slice(1);

    const primerSegmento = ruta[0] || "";

    /*
      Sin ningun segmento de ruta es la portada de la
      plataforma, no una cuenta.
    */
    if (!primerSegmento) return null;

    /*
      DEFECTO CORREGIDO EN LA PRUEBA DEL SPRINT:

      Este respaldo burlaba el filtro que lo precede.
      `extraerHandle` rechaza correctamente youtube.com/watch
      porque "watch" no es un usuario; el respaldo lo recuperaba
      derivando el handle "watch" de la ruta, reintroduciendo
      justo lo que se acaba de descartar.

      El respaldo solo debe actuar cuando la ruta SI podria ser
      una cuenta y el handle no es extraible por su forma
      (profile.php, /channel/UCxxx), nunca cuando la ruta es
      contenido.
    */
    const adaptadorRuta = adaptadorPorPlataforma(plataforma.id);

    if (adaptadorRuta && !esRutaDePerfil(adaptadorRuta, primerSegmento)) {
      /*
        No es un candidato, pero tampoco desaparece: se
        devuelve el motivo para que quede en el registro de
        descartes. Nada se pierde en silencio.
      */
      return {
        descartado: true,
        motivo:
          adaptadorRuta.soloPaginasPublicas && primerSegmento === "profile.php"
            ? `Perfil personal de Facebook (profile.php). El adaptador atiende solo PAGINAS publicas: los perfiles personales quedan fuera por acceso y por EX1 del Cap. 14.`
            : `La ruta "/${primerSegmento}" es contenido de la plataforma, no una cuenta.`,
        plataforma: plataforma.nombre,
        url: enlace
      };
    }

    const derivado = ruta.join("-").replace(/[^a-z0-9._-]/g, "").slice(0, 60);

    if (!derivado) return null;

    handle = derivado;

    handleTipo = "derivado_de_url";
  }

  const urlNormalizada = normalizarUrl(enlace);

  if (!urlNormalizada) return null;

  return {
    plataforma: {
      id: plataforma.id,
      nombre: plataforma.nombre,
      tipo: plataforma.tipo
    },
    handle,
    handleTipo,
    url: enlace,
    urlNormalizada,
    via,
    proveedor:
      resultado.motor || resultado.__origen || contexto.proveedor || null,
    consulta: resultado.consulta || contexto.consulta || null,
    etiquetaConsulta: resultado.etiquetaConsulta || contexto.etiqueta || null,
    titulo: (resultado.titulo || "").trim(),
    descripcion: textoDeResultado(resultado).trim(),
    evidenciaId: resultado.id || null
  };
}


/*
-----------------------------------------------------------
VÍA 3 — PLAN DE CONSULTAS DIRIGIDAS

Usa el Perfil de Referencia, no solo el nombre. Es lo que
diferencia esto de una búsqueda ingenua.
-----------------------------------------------------------
*/

export function planificarConsultasSociales(perfil, plataformasObjetivo) {
  const nombre = perfil?.nombrePrincipal;

  if (!nombre) return [];

  const plan = [];
  const vistas = new Set();

  function agregar(consulta, etiqueta, plataformaId) {
    const limpia = consulta.trim();

    const clave = normalizarTexto(limpia);

    if (!limpia || vistas.has(clave)) return;

    vistas.add(clave);

    plan.push({ consulta: limpia, etiqueta, plataformaId });
  }

  /*
    a) Handles ya observados: buscarlos por sí mismos suele
       traer sus otras plataformas. Es la consulta de mayor
       rendimiento.
  */
  (perfil.handlesObservados || []).slice(0, 2).forEach((h) => {
    agregar(`"${h.handle}"`, `handle_observado:${h.handle}`, null);
  });

  /*
    b) Nombre + término discriminante restringido a las
       plataformas sociales. Un solo operador site: con OR no
       es soportado por todos los proveedores, así que se
       consulta por plataforma prioritaria.
  */
  const discriminante = (perfil.terminosDiscriminantes || []).find(
    (t) => t.termino && (t.fuentes || []).length > 0
  );

  plataformasObjetivo.slice(0, 3).forEach((p) => {
    const dominio = p.dominios[0];

    agregar(
      discriminante
        ? `site:${dominio} "${nombre}" ${discriminante.termino}`
        : `site:${dominio} "${nombre}"`,
      `dirigida:${p.id}`,
      p.id
    );
  });

  return plan.slice(0, LIMITE_CONSULTAS_DIRIGIDAS);
}


/*
===========================================================
FUNCIÓN PRINCIPAL
===========================================================
*/

export async function descubrirCandidatos(perfil, opciones = {}) {
  const inicio = Date.now();

  const mapa = new Map();

  const trazas = [];

  const plataformasObjetivo = PLATAFORMAS;

  /*
    ---------------------------------------------------------
    VÍA 0 — CUENTAS DE REFERENCIA DEL ANALISTA
    ---------------------------------------------------------

    QUE ES

    Cuando el analista crea un candidato en un proyecto puede
    escribir las URLs que ya conoce. Hasta L-2 esas URLs se
    guardaban en el expediente y NO entraban al Discovery: el
    motor volvia a buscar a ciegas y, si no las reencontraba,
    la cuenta que el analista habia escrito simplemente no
    aparecia en el resultado. Aqui entran.

    ---------------------------------------------------------
    REGLA ABSOLUTA — NO AUTOVERIFICACION
    ---------------------------------------------------------

    Una cuenta que el analista escribio NO PUEDE servir de
    prueba de si misma. Si entrara como un hallazgo cualquiera,
    Sentinel le sumaria puntos de corroboracion por haberla
    "encontrado", y estaria confirmando lo que le acaban de
    dictar. Eso no es inteligencia: es un eco.

    Por eso el origen se marca `noCuentaComoCorroboracion` y
    queda FUERA de las dos listas que alimentan la señal S6:

        proveedores  -> corroboracion multi-proveedor
        vias         -> vias independientes

    La marca no la esconde: el origen sigue en `origenes`, con
    `origen: "analista"` y `via: "cuenta_referencia"`, asi que
    la trazabilidad es completa. Lo unico que se le niega es el
    derecho a puntuar.

    QUE SI GANA LA CUENTA AQUI

    Entrar al pipeline en igualdad de condiciones: se clasifica
    con el accountClassifier, se puntua por nombre y handle
    —señales que miran la cuenta, no quien la aporto— y si
    ademas la encuentra un proveedor por su cuenta, ESE origen
    si corrobora, porque es independiente.

    Y si el nombre no corresponde al objetivo, se rechaza. El
    analista puede equivocarse al pegar una URL; que la haya
    escrito una persona no la vuelve cierta.
    ---------------------------------------------------------
  */
  const referencias = Array.isArray(opciones.cuentasReferencia)
    ? opciones.cuentasReferencia
    : [];

  const referenciasNoUtilizables = [];

  referencias.forEach((ref) => {
    /*
      SD-1A es la autoridad para leer una URL. No se adivina la
      plataforma por el campo `plataforma` que venga escrito:
      se lee del dominio real.
    */
    const clasificacion = clasificarUrlSocial(ref?.url);

    if (!clasificacion.esSocial || !clasificacion.esCuenta) {
      referenciasNoUtilizables.push({
        url: ref?.url || null,
        plataformaDeclarada: ref?.plataforma || null,
        motivo: clasificacion.motivo || "URL no utilizable"
      });
      return;
    }

    const plataforma = PLATAFORMAS.find(
      (x) => x.id === clasificacion.plataformaId
    );

    if (!plataforma) {
      referenciasNoUtilizables.push({
        url: ref.url,
        plataformaDeclarada: ref?.plataforma || null,
        motivo: `plataforma ${clasificacion.plataformaId} no está en el catálogo`
      });
      return;
    }

    registrarCandidato(mapa, {
      plataforma,
      handle: clasificacion.handle,
      url: clasificacion.urlCanonica || ref.url,
      urlNormalizada: clasificacion.urlNormalizada,
      handleTipo: "declarado_por_analista",
      via: "cuenta_referencia",

      /*
        Sin proveedor: no la encontro ningun buscador. Ademas de
        la marca explicita, esto la mantiene fuera de la lista
        de proveedores por construccion.
      */
      proveedor: null,
      consulta: null,
      etiquetaConsulta: null,
      titulo: null,
      descripcion: null,
      evidenciaId: null,

      origenDeclarado: "analista",
      noCuentaComoCorroboracion: true
    });
  });

  trazas.push({
    via: "cuenta_referencia",
    entrada: referencias.length,
    utilizables: referencias.length - referenciasNoUtilizables.length,
    noUtilizables: referenciasNoUtilizables,
    candidatos: mapa.size,
    corrobora: false,
    nota:
      "URLs escritas por el analista. Entran al pipeline y no cuentan como corroboración de sí mismas."
  });

  /*
    ---------------------------------------------------------
    VÍA 1 — HANDLES YA OBSERVADOS EN EL PERFIL
    La más fiable: la URL ya apareció en evidencias reales.
    ---------------------------------------------------------
  */
  const observados = Array.isArray(perfil?.handlesObservados)
    ? perfil.handlesObservados
    : [];

  observados.forEach((h) => {
    const plataforma = PLATAFORMAS.find(
      (p) =>
        p.id === h.plataformaId ||
        normalizarTexto(p.nombre) === normalizarTexto(h.plataforma)
    );

    if (!plataforma) return;

    registrarCandidato(mapa, {
      plataforma,
      handle: h.handle,
      url: h.enlace,
      urlNormalizada: h.urlNormalizada || normalizarUrl(h.enlace),
      via: "handle_observado",
      proveedor: (h.fuentes || [])[0] || null,
      consulta: null,
      etiquetaConsulta: null,
      titulo: null,
      descripcion: null,
      evidenciaId: (h.evidencias || [])[0] || null
    });
  });

  trazas.push({
    via: "handle_observado",
    entrada: observados.length,
    candidatos: mapa.size
  });

  /*
    ---------------------------------------------------------
    VÍA 2 — EVIDENCIAS YA RECOGIDAS POR EL FUSION ENGINE
    Coste cero: ya están en memoria.
    ---------------------------------------------------------
  */
  const evidenciasPrevias = Array.isArray(opciones.evidenciasPrevias)
    ? opciones.evidenciasPrevias
    : [];

  const antesDeVia2 = mapa.size;

  const descartados = [];

  /*
    ---------------------------------------------------------
    SD-1A · CLASIFICACION DE LAS EVIDENCIAS EXISTENTES
    ---------------------------------------------------------

    Se recorren TODAS las evidencias del Fusion Engine con el
    clasificador de URLs sociales, que distingue pagina,
    canal, perfil, video y post, y solo crea cuenta cuando la
    URL identifica un propietario.

    Su salida es el diagnostico honesto de esta via: cuantas
    URLs se examinaron, cuantas eran de plataforma y por que
    se descarto cada una.
  */
  const sd1a = descubrirDesdeEvidencias(evidenciasPrevias);

  evidenciasPrevias.forEach((ev) => {
    const datos = candidatoDesdeResultado(ev, "evidencia_fusion", {
      proveedor: (ev.motores || []).map((m) => m.nombre).join(" + ") || null
    });

    if (!datos) return;

    if (datos.descartado) {
      descartados.push(datos);
      return;
    }

    registrarCandidato(mapa, datos);
  });

  trazas.push({
    via: "evidencia_fusion",
    entrada: evidenciasPrevias.length,
    candidatosNuevos: mapa.size - antesDeVia2
  });

  /*
    ---------------------------------------------------------
    VIA 4 — PLATFORM SCANNER (cuentas declaradas)
    ---------------------------------------------------------

    La via mas fiable disponible sin APIs de plataforma: las
    cuentas que Wikidata atribuye al objetivo, tras verificar
    la entidad por nombre y por P31 = Q5.

    Se ejecuta ANTES de las consultas dirigidas porque no
    consume presupuesto del proveedor de busqueda -- el cuello
    de botella real de los ultimos sprints.
  */
  let scanner = null;

  const antesDelScanner = mapa.size;

  if (!opciones.omitirScanner) {
    try {
      scanner = await escanearPlataformas(perfil?.nombrePrincipal || "", {
        perfil,
        wikidata: opciones.wikidata || null
      });

      (scanner.cuentas || []).forEach((c) => {
        const plataforma = PLATAFORMAS.find((p) => p.id === c.plataformaId);

        if (!plataforma) return;

        const candidato = registrarCandidato(mapa, {
          plataforma,
          handle: c.handle,
          url: c.url,
          urlNormalizada: c.urlNormalizada,
          via: "plataforma_declarada",
          handleTipo: "declarado",
          proveedor: `${c.fuente.nombre} (${c.fuente.propiedad})`,
          consulta: null,
          etiquetaConsulta: null,
          titulo: null,
          descripcion: null,
          evidenciaId: c.fuente.entidad
        });

        /*
          El modo de acceso del scanner es mas fuerte que la
          presencia inferida por descubrimiento web.
        */
        candidato.modoAcceso = c.modoAcceso;

        candidato.tipoCuenta = c.tipo;

        /*
          GRAFIA CANONICA DEL HANDLE

          Si el candidato ya existia por evidencia web, su
          handle venia como lo escribio el buscador — medido en
          Daniel Noboa: "danielnoboaok" en minusculas, cuando la
          cuenta declarada es "DanielNoboaOk".

          La declaracion es la autoridad sobre la grafia: el
          dedup usa la forma normalizada, asi que sobrescribir
          la visible no rompe la correspondencia.
        */
        candidato.handle = c.handle;

        candidato.handleTipo = "declarado";

        candidato.url = c.url;

        candidato.handleOpaco = Boolean(c.handleOpaco);

        candidato.declaracion = {
          fuente: c.fuente,
          confianza: c.confianza,
          motivoPuntuacion: c.motivoPuntuacion
        };
      });

      trazas.push({
        via: "plataforma_declarada",
        entrada: scanner.entidad ? 1 : 0,
        candidatosNuevos: mapa.size - antesDelScanner,
        entidad: scanner.entidad?.qid || null
      });
    } catch (error) {
      console.error("[discovery] platform scanner fallo:", error);

      trazas.push({
        via: "plataforma_declarada",
        resultado: "error",
        motivo: error?.message || "error desconocido"
      });
    }
  }

  /*
    ---------------------------------------------------------
    VÍA 3 — CONSULTAS DIRIGIDAS VÍA SEARCH PROVIDER LAYER
    ---------------------------------------------------------
  */
  /*
    SPRINT 3.2 — el plan ya no se construye desde el nombre,
    sino desde el Perfil de Referencia: consultas acotadas por
    dominio de plataforma y ANCLADAS al contexto del objetivo.

    Medido en el caso real: «Juan Carlos Vega» devuelve un
    artista fotografico en las tres primeras posiciones;
    «Juan Carlos Vega Cuenca alcalde» devuelve 8 de 8
    resultados del candidato. La diferencia esta en la
    consulta, no en el motor.
  */
  const planificacion = opciones.omitirConsultas
    ? { plan: [], anclas: [], anclasUsadas: [], advertencia: null }
    : planificarConsultasDerivadas(perfil, {
        dominio: opciones.dominio || DOMINIO_POLITICA_EC,
        adaptadores: opciones.adaptadores || ADAPTADORES
      });

  const plan = planificacion.plan;

  const sesion = opciones.sesion || crearSesion({ tipo: "web" });

  /*
    ---------------------------------------------------------
    SD-1 · CORTE TEMPRANO POR PROVEEDOR AGOTADO
    ---------------------------------------------------------

    Defecto medido en las corridas de QA: el descubrimiento
    general consume 1 consulta y el Fusion Engine hasta 4. Al
    llegar aqui, DuckDuckGo ya esta limitado — y el SIL
    lanzaba 10 consultas mas que fallaban todas, tardando
    varios segundos para no obtener nada.

    Peor que la lentitud: gastar el presupuesto en consultas
    condenadas impide que las que SI podrian responder lo
    hagan.

    Ahora se comprueba antes: si ningun proveedor web esta
    utilizable, no se lanza el plan. Las plataformas quedan
    NO COMPROBADAS con su motivo, que es la verdad, en lugar
    de diez bloqueos identicos.
  */
  const diagnostico = diagnosticoProveedores();

  const proveedoresUtilizables = (diagnostico.proveedores || []).filter(
    (p) => p.disponible
  );

  const sinProveedor = proveedoresUtilizables.length === 0;

  if (sinProveedor && plan.length) {
    trazas.push({
      via: "consulta_dirigida",
      resultado: "omitida",
      motivo: `Ningun proveedor web utilizable (${(diagnostico.proveedores || [])
        .map((p) => `${p.nombre}: ${p.estado}`)
        .join("; ")}). No se lanzan las ${plan.length} consultas planificadas.`
    });
  }

  const intentos = [];

  const antesDeVia3 = mapa.size;

  for (const entrada of sinProveedor ? [] : plan) {
    const respuesta = await buscarWeb(entrada.consulta, {
      etiqueta: entrada.etiqueta,
      sesion
    });

    intentos.push({
      plataformaId: entrada.plataformaId || null,
      consulta: entrada.consulta,
      etiqueta: entrada.etiqueta,
      proveedorUsado: respuesta.proveedorUsado?.nombre || null,
      estado: respuesta.estado,
      resultados: respuesta.total,
      coberturaParcial: respuesta.coberturaParcial
    });

    (respuesta.resultados || []).forEach((r) => {
      const datos = candidatoDesdeResultado(r, "consulta_dirigida", {
        proveedor: respuesta.proveedorUsado?.nombre || null,
        consulta: entrada.consulta,
        etiqueta: entrada.etiqueta
      });

      if (!datos) return;

      if (datos.descartado) {
        descartados.push(datos);
        return;
      }

      /*
        Filtro por adaptador: descarta rutas que caen en la
        plataforma pero no son perfiles (x.com/status,
        facebook.com/watch, youtube.com/results...).
      */
      const adaptador = adaptadorPorPlataforma(datos.plataforma.id);

      if (adaptador && !esRutaDePerfil(adaptador, datos.handle)) return;

      datos.adaptadorId = adaptador?.id || null;

      datos.consultaAnclada = entrada.anclada === true;

      datos.anclas = entrada.anclas || [];

      registrarCandidato(mapa, datos);
    });
  }

  trazas.push({
    via: "consulta_dirigida",
    consultas: plan.length,
    candidatosNuevos: mapa.size - antesDeVia3
  });

  /*
    ---------------------------------------------------------
    SALIDA
    ---------------------------------------------------------
  */
  const candidatos = [...mapa.values()].map((c) => ({
    ...c,

    /*
      CONTEXT BOOST (CB-1) — evalua si el contexto de esta
      cuenta es compatible con el del objetivo. Es lo que
      distingue al homonimo de la persona buscada cuando el
      nombre coincide igual de bien en ambos.
    */
    contextBoost: contextBoostDeCandidato(c, perfil, {
      dominio: opciones.dominioId || "politica_ec",
      /*
        Todas las evidencias del descubrimiento: permiten a CB-1
        relacionar el contexto de un dominio propio con la cuenta
        social que comparte su handle.
      */
      evidencias: evidenciasPrevias
    }),

    /*
      Se limpia la clave interna del origen.
    */
    origenes: c.origenes.map(({ clave, ...resto }) => resto),

    totalOrigenes: c.origenes.length,

    /*
      ---------------------------------------------------------
      LO QUE CORROBORA Y LO QUE SOLO CONSTA
      ---------------------------------------------------------

      `vias` y `proveedores` son las dos listas que las señales
      leen para dar puntos de corroboracion. De ellas se excluye
      todo origen marcado `noCuentaComoCorroboracion` —hoy, las
      URLs que escribio el analista—.

      El filtro se hace AQUI, en el limite del Discovery, y no
      en cada señal: una señal futura que lea `vias` heredara la
      garantia sin tener que acordarse de ella. Que la regla
      dependa de recordarla es como se rompen las reglas.

      Nada se oculta: `origenes` conserva todos los origenes con
      su marca, y `viasDeclaradas` dice de donde vino lo que no
      puntua.
      ---------------------------------------------------------
    */
    vias: [
      ...new Set(
        c.origenes
          .filter((o) => o.noCuentaComoCorroboracion !== true)
          .map((o) => o.via)
      )
    ],

    viasDeclaradas: [
      ...new Set(
        c.origenes
          .filter((o) => o.noCuentaComoCorroboracion === true)
          .map((o) => o.via)
      )
    ],

    proveedores: [
      ...new Set(
        c.origenes
          .filter((o) => o.noCuentaComoCorroboracion !== true)
          .map((o) => o.proveedor)
          .filter(Boolean)
      )
    ],

    /*
      Bandera legible para la interfaz: la aporto una persona.
    */
    aportadaPorAnalista: c.origenes.some((o) => o.origen === "analista")
  }));

  /*
    Cobertura por plataforma, incluidas las que NO aparecieron.
    Una plataforma sin hallazgos no es lo mismo que una
    plataforma no comprobada.
  */
  const cobertura = plataformasObjetivo.map((p) => {
    const encontrados = candidatos.filter((c) => c.plataformaId === p.id);

    /*
      Consultas planificadas para esta plataforma y su
      resultado REAL.

      DISTINCIÓN CRÍTICA: "se consultó y no había nada"
      (ausencia) no es lo mismo que "se intentó consultar y
      el proveedor bloqueó" (no comprobada).

      Declarar ausencia tras un bloqueo afirmaría que la
      cuenta no existe cuando en realidad no pudimos mirar.
      Es el mismo error que separó `bloqueado` de
      `0 resultados` en el Search Provider Layer.
    */
    const consultasDeLaPlataforma = intentos.filter((i) =>
      plan.some(
        (e) => e.plataformaId === p.id && e.consulta === i.consulta
      )
    );

    const consultadaConExito = consultasDeLaPlataforma.some(
      (i) => i.estado === "OK"
    );

    const consultadaSinExito =
      consultasDeLaPlataforma.length > 0 && !consultadaConExito;

    /*
      Lo que el Platform Scanner comprobo para esta plataforma.
      Su motivo es mas informativo que el del descubrimiento
      web: distingue "no hay declaracion" de "no se consulto".
    */
    const scannerPlataforma = (scanner?.cobertura || []).find(
      (c) => c.plataformaId === p.id
    );

    let estadoPresencia;
    let motivoCobertura;

    if (encontrados.length) {
      estadoPresencia = ESTADOS_PRESENCIA.INFERIDA;
      motivoCobertura = `${encontrados.length} candidato(s) descubierto(s).`;

      /*
        Si el candidato nacio de una declaracion, el modo de
        acceso real es ese y no la presencia inferida por web.
      */
      if (encontrados.some((c) => c.declaracion)) {
        motivoCobertura +=
          " Origen: declaración en base de conocimiento; el perfil no fue leído.";
      }
    } else if (consultadaConExito) {
      estadoPresencia = ESTADOS_PRESENCIA.AUSENCIA;
      motivoCobertura =
        "Se consultó correctamente y no se encontró presencia.";
    } else if (consultadaSinExito) {
      estadoPresencia = ESTADOS_PRESENCIA.NO_COMPROBADA;
      motivoCobertura = `Se intentó consultar pero el proveedor no respondió (${consultasDeLaPlataforma
        .map((i) => i.estado)
        .join(", ")}). No se puede afirmar ausencia.`;
    } else {
      estadoPresencia = ESTADOS_PRESENCIA.NO_COMPROBADA;
      /*
        Aunque el descubrimiento web no planifico consulta, el
        Platform Scanner SI comprobo la declaracion. Decir "no
        se consulto" cuando si se comprobo algo seria ocultar
        trabajo real al analista.
      */
      motivoCobertura = scannerPlataforma
        ? scannerPlataforma.motivo
        : "No se planificó ninguna consulta para esta plataforma.";
    }

    return {
      plataformaId: p.id,
      plataforma: p.nombre,
      candidatos: encontrados.length,
      estadoPresencia,
      motivoCobertura,

      /*
        Declarar SIEMPRE como se accedio (o no) a la plataforma.
      */
      modoAccesoDeclarado: encontrados.some((c) => c.declaracion)
        ? MODOS_ACCESO.DECLARADA_POR_REFERENCIA
        : encontrados.length
          ? MODOS_ACCESO.PRESENCIA_INFERIDA
          : MODOS_ACCESO.NO_DISPONIBLE,

      comprobadoPorScanner: Boolean(scannerPlataforma),
      consultasIntentadas: consultasDeLaPlataforma.length,
      consultasConExito: consultasDeLaPlataforma.filter((i) => i.estado === "OK")
        .length,
      modoAcceso: MODOS_ACCESO.PRESENCIA_INFERIDA
    };
  });

  const resumen = resumirSesion(sesion);

  return {
    version: "1.0",

    objetivo: perfil?.nombrePrincipal || null,

    candidatos: candidatos.sort((a, b) => b.totalOrigenes - a.totalOrigenes),

    cobertura,

    plan,

    /*
      PLATFORM SCANNER — cuentas declaradas y cobertura.
    */
    platformScanner: scanner
      ? {
          entidad: scanner.entidad,
          sitioWebOficial: scanner.sitioWebOficial,
          cuentas: scanner.cuentas,
          cobertura: scanner.cobertura,
          traza: scanner.traza,
          metricas: scanner.metricas,
          busquedaCompleta: scanner.busquedaCompleta,
          diagnostico: scanner.diagnostico || null,
          limites: scanner.limites
        }
      : null,

    /*
      SD-1A — resultado de clasificar las evidencias que ya
      existian, sin lanzar ninguna consulta nueva.
    */
    desdeEvidencias: {
      version: sd1a.version,
      fichas: sd1a.fichas,
      metricas: sd1a.metricas,
      clasificadas: sd1a.clasificadas,
      descartadas: sd1a.descartadas,
      diagnostico: sd1a.diagnostico
    },

    /*
      SD-1 — estado real del descubrimiento social.
    */
    descubrimientoSocial: {
      proveedoresUtilizables: proveedoresUtilizables.map((p) => p.nombre),
      sinProveedor,
      consultasPlanificadas: plan.length,
      consultasLanzadas: sinProveedor ? 0 : plan.length,
      motivoOmision: sinProveedor
        ? "Ningun proveedor web utilizable al llegar a esta etapa. Las consultas planificadas no se lanzaron."
        : null
    },

    /*
      Anclas de identidad usadas para derivar las consultas.
    */
    anclas: planificacion.anclas,
    anclasUsadas: planificacion.anclasUsadas,
    consultasAncladas: plan.filter((p) => p.anclada).length,
    consultasPorNombre: plan.filter((p) => !p.anclada).length,

    /*
      Adaptadores publicos ejercitados.
    */
    adaptadores: (opciones.adaptadores || ADAPTADORES).map((a) => ({
      id: a.id,
      nombre: a.nombre,
      plataformaId: a.plataformaId,
      publico: a.publico,
      consultas: plan.filter((p) => p.adaptadorId === a.id).length,
      advertencia: a.advertencia || null
    })),

    intentos,

    /*
      URLS DE PLATAFORMA DESCARTADAS, con su motivo.
      Un descarte silencioso haria creer que la URL no existia.
    */
    descartados,

    trazas,

    proveedores: resumen,

    advertencias: [
      ...(planificacion.advertencia ? [planificacion.advertencia] : []),
      ...(resumen?.advertencias || []),
      ...(sd1a.diagnostico ? [sd1a.diagnostico] : []),
      ...(sinProveedor && plan.length
        ? [
            `Descubrimiento social OMITIDO: ningun proveedor web estaba utilizable al llegar a esta etapa. Las ${plan.length} consultas planificadas no se lanzaron y las plataformas quedan NO COMPROBADAS, no ausentes.`
          ]
        : []),
      ...(intentos.some((i) => i.estado !== "OK")
        ? [
            `${intentos.filter((i) => i.estado !== "OK").length} de ${intentos.length} consultas sociales no obtuvieron respuesta del proveedor. Las plataformas afectadas quedan como NO COMPROBADAS, no como ausentes.`
          ]
        : []),
      ...(plan.length === 0 && !opciones.omitirConsultas
        ? ["Sin plan de consultas: el Perfil de Referencia no aportó handles ni términos discriminantes."]
        : []),
      /*
        Declaración obligatoria del límite del sprint.
      */
      "Ningún perfil fue leído: no hay Platform Scanner. Toda presencia es inferida desde descubrimiento web."
    ],

    metricas: {
      candidatosUnicos: candidatos.length,
      candidatosDesdeEvidencias: sd1a.metricas.fichasCandidatas,
      candidatosDeclarados: scanner?.metricas?.cuentas ?? 0,
      urlsDePlataformaEnEvidencias: sd1a.metricas.urlsDePlataforma,
      contextoCompatible: candidatos.filter((c) =>
        ["compatible", "compatible_con_ruido"].includes(c.contextBoost?.veredicto)
      ).length,
      contextoIncompatible: candidatos.filter(
        (c) => c.contextBoost?.veredicto === "incompatible"
      ).length,
      contextoNeutro: candidatos.filter(
        (c) => c.contextBoost?.veredicto === "neutro"
      ).length,
      plataformasConCandidatos: cobertura.filter((c) => c.candidatos > 0).length,
      plataformasNoComprobadas: cobertura.filter(
        (c) => c.estadoPresencia === ESTADOS_PRESENCIA.NO_COMPROBADA
      ).length,
      consultasEjecutadas: intentos.length,
      urlsDescartadas: descartados.length,
      tiempo: `${((Date.now() - inicio) / 1000).toFixed(2)}s`
    },

    generadoEn: new Date().toISOString()
  };
}
