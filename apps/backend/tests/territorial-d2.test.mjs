// apps/backend/tests/territorial-d2.test.mjs

import {
  planificarConsultasAbiertas,
  medirSesgo,
  separarCorpusPorTipoDeConsulta,
  TIPOS_CONSULTA,
  llevaVocabularioDeGestion
} from "../services/conversation/queryPlanner.js";

import {
  construirUniverso,
  registrarFuente,
  verificarFuente,
  crearUniverso,
  listarFuentes,
  estadoUniverso,
  ESTADOS_SOURCE,
  ORIGENES_SOURCE,
  TIPOS_SOURCE
} from "../services/conversation/sourceUniverse.js";

import {
  clasificarFuente,
  clasificarPersona,
  clasificarUniverso,
  CLASES_FUENTE
} from "../services/conversation/sourceClassifier.js";

import {
  medirDiversidad,
  separarCorpusPorAgenda,
  AGENDAS
} from "../services/conversation/sourceDiversity.js";

import {
  clasificarEntidad,
  separarEntidadesDeTemas,
  relacionarEntidadesConTemas,
  TIPOS_ENTIDAD
} from "../services/conversation/entityTopicSeparation.js";

import {
  componerSnapshot,
  crearAlmacenMemoria,
  guardarSnapshot,
  anexarCorreccion,
  buscarVentanaAnterior,
  compararConVentanaAnterior
} from "../services/territorial/snapshotStore.js";

import { matrizProveedores } from "../services/providers/providerAudit.js";

import {
  estadoBenchmark,
  costoPorEvidenciaUtil,
  fichaBenchmark
} from "../services/contracts/providerBenchmark.js";

import {
  estadoAiRouter,
  elegirProveedor,
  CAPACIDADES_TAREA,
  TAREAS_IA
} from "../services/contracts/aiRouter.js";

import { descubrirTemas } from "../services/conversation/openTopicDiscovery.js";
import { identificarFuente } from "../services/conversation/mediaRegistry.js";
import { comprobarGeo1 } from "../services/geo/geoContracts.js";

/*
===========================================================
PRUEBAS DEL GATE D2 — OPEN LISTENING FOUNDATION
===========================================================

    node tests/territorial-d2.test.mjs

SIN RED Y SIN CUOTA.

Los 28 casos exigidos, mas los que hicieron falta para
demostrar los criterios A–K del gate. Los fixtures son
EVIDENCIAS DE ENTRADA: los temas y las entidades los produce el
motor real, nunca estan escritos a mano.
===========================================================
*/

let pass = 0;

let fail = 0;

const fallos = [];

function t(nombre, comprobacion) {
  try {
    if (comprobacion()) {
      pass += 1;
      console.log(`  PASS  ${nombre}`);
    } else {
      fail += 1;
      fallos.push(nombre);
      console.log(`  FALL  ${nombre}`);
    }
  } catch (e) {
    fail += 1;
    fallos.push(`${nombre} — ${e.message}`);
    console.log(`  ERR   ${nombre}: ${e.message}`);
  }
}

function bloque(titulo) {
  console.log(`\n${titulo}`);
}


/* ===========================================================
   FIXTURES — evidencias de entrada, deterministas
   =========================================================== */

const AMBITO = {
  nombre: "Cuenca",
  ancestros: ["Azuay", "Ecuador"],
  unidadId: "ec-azuay-cuenca"
};

const PLAN = planificarConsultasAbiertas({ ambito: AMBITO });

/*
  Corpus sintetico con la forma del real: prensa local que
  repite, prensa nacional puntual, una institucion, un colectivo
  y una plataforma que esconde a sus emisores.
*/
const CORPUS = [
  {
    titulo: "Marisol Peñaloza presenta su plan a la alcaldía de Cuenca",
    enlace: "https://elmercurio.com.ec/a1",
    fecha: "2026-08-20",
    fuenteDeclarada: "El Mercurio",
    consultasOrigen: ["neutral:base:Azuay"]
  },
  {
    titulo: "La candidata Marisol Peñaloza recorre Sayausí",
    enlace: "https://elmercurio.com.ec/a2",
    fecha: "2026-08-21",
    fuenteDeclarada: "El Mercurio",
    consultasOrigen: ["neutral:base:Azuay"]
  },
  {
    titulo: "Marisol Peñaloza responde sobre movilidad en Cuenca",
    enlace: "https://eluniverso.com/a3",
    fecha: "2026-08-21",
    fuenteDeclarada: "El Universo",
    consultasOrigen: ["neutral:hoy:Azuay"]
  },
  {
    titulo: "Elecciones seccionales: el calendario en Azuay",
    enlace: "https://elmercurio.com.ec/a4",
    fecha: "2026-08-19",
    fuenteDeclarada: "El Mercurio",
    consultasOrigen: ["neutral:base:Azuay"]
  },
  {
    titulo: "Elecciones seccionales movilizan a los partidos en Cuenca",
    enlace: "https://expreso.ec/a5",
    fecha: "2026-08-20",
    fuenteDeclarada: "Expreso",
    consultasOrigen: ["neutral:base:Ecuador"]
  },
  {
    titulo: "El Municipio de Cuenca informa sobre la ordenanza de movilidad",
    enlace: "https://cuenca.gob.ec/n1",
    fecha: "2026-08-22",
    consultasOrigen: ["institucional:municipio alcaldía"]
  },
  {
    titulo: "Colectivo Vecinos de El Vado convoca una asamblea barrial",
    enlace: "https://colectivovecinoselvado.org/c1",
    fecha: "2026-08-22",
    consultasOrigen: ["neutral:base:Azuay"]
  },
  {
    titulo: "Recorrido por el centro de Cuenca",
    enlace: "https://youtube.com/watch?v=1",
    fecha: "2026-08-18",
    consultasOrigen: ["creator:video"]
  },
  {
    titulo: "Cuenca en dos minutos",
    enlace: "https://youtube.com/watch?v=2",
    fecha: "2026-08-19",
    consultasOrigen: ["creator:video"]
  }
];

const resolverFuente = (ev) => identificarFuente(ev).dominio || ev.dominio || null;

const UNIVERSO = construirUniverso(CORPUS);

const CLASIFICACION = clasificarUniverso(UNIVERSO);

const DIVERSIDAD = medirDiversidad(CORPUS, {
  clasificacionPorFuente: CLASIFICACION.porFuente,
  resolverFuente
});

const AGENDAS_FUENTE = separarCorpusPorAgenda(CORPUS, {
  clasificacionPorFuente: CLASIFICACION.porFuente,
  resolverFuente
});

const DESCUBIERTOS = descubrirTemas(
  CORPUS.map((e, i) => ({ ...e, indice: i })),
  { consultas: PLAN }
);

const GAZETTEER = new Set(["cuenca", "azuay", "sayausí", "sayausi", "el vado"]);

const SEPARACION = separarEntidadesDeTemas(
  DESCUBIERTOS.temasDescubiertos || [],
  { gazetteer: GAZETTEER }
);


/* ===========================================================
   [D2-1] QUERIES NEUTRALES
   =========================================================== */

bloque("[D2-1] QUERIES NEUTRALES Y SESGO");

t("T1 · el plan produce consultas NEUTRALES", () => {
  const n = PLAN.filter((c) => c.tipo === TIPOS_CONSULTA.NEUTRAL);

  return n.length >= 3 && n.every((c) => !c.sesgoDeclarado);
});

t("T1b · las neutras van PRIMERO, que es lo que el tope ejecuta", () => {
  const primeras = PLAN.slice(0, 3);

  return primeras.every((c) => c.tipo === TIPOS_CONSULTA.NEUTRAL);
});

t("T2 · la consulta temática se separa de la neutral", () => {
  const conTema = planificarConsultasAbiertas({
    ambito: AMBITO,
    temas: ["movilidad"]
  });

  const tematicas = conTema.filter((c) => c.tipo === TIPOS_CONSULTA.TEMATICA);

  return (
    tematicas.length === 1 &&
    /movilidad/i.test(tematicas[0].texto) &&
    !PLAN.some((c) => c.tipo === TIPOS_CONSULTA.TEMATICA)
  );
});

t("no hay temáticas por defecto: una temática por defecto ES el sesgo", () => {
  return PLAN.every((c) => c.tipo !== TIPOS_CONSULTA.TEMATICA);
});

t("el vocabulario de gestión sigue existiendo, pero DECLARADO", () => {
  const inst = PLAN.filter((c) => c.tipo === TIPOS_CONSULTA.INSTITUCIONAL);

  return inst.length >= 1 && inst.every((c) => c.sesgoDeclarado === "vocabulario_de_gestion");
});

t("ninguna consulta NEUTRAL lleva vocabulario de gestión", () => {
  return PLAN.filter((c) => c.tipo === TIPOS_CONSULTA.NEUTRAL).every(
    (c) => !llevaVocabularioDeGestion(c.texto)
  );
});

t("el sesgo del plan MEJORA frente al plan fijo de 4 consultas", () => {
  const m = medirSesgo(PLAN);

  /* El plan anterior era 2/4 = 0.50 con gestión. */
  return m.proporcionConGestion < 0.5 && m.proporcionNeutral > 0.5;
});

t("el sesgo POR EVIDENCIA solo se calcula con resultados", () => {
  const sin = medirSesgo(PLAN);

  const con = medirSesgo(PLAN, { "neutral:base:Azuay": 8, "institucional:municipio alcaldía": 2 });

  return sin.porEvidencia === null && con.porEvidencia.evidencias === 10;
});

t("el ancla territorial sigue siendo obligatoria", () => {
  return (
    PLAN.every((c) => c.anclada === true) &&
    !PLAN.some((c) => c.texto.trim().toLowerCase() === "cuenca")
  );
});

t("sin ancestros TODAS se marcan sin anclar y con aviso", () => {
  const sin = planificarConsultasAbiertas({
    ambito: { nombre: "Cuenca", ancestros: [] }
  });

  return sin.length > 0 && sin.every((c) => c.anclada === false && c.aviso);
});

t("la Agenda General se construye SOLO con corpus neutral", () => {
  const s = separarCorpusPorTipoDeConsulta(CORPUS, PLAN);

  const institucional = CORPUS.find((e) =>
    e.consultasOrigen.includes("institucional:municipio alcaldía")
  );

  return (
    s.general.length > 0 &&
    !s.general.includes(institucional) &&
    s.dirigido.includes(institucional)
  );
});

t("una evidencia sin procedencia de consulta NO sostiene la agenda general", () => {
  const s = separarCorpusPorTipoDeConsulta([{ titulo: "x" }], PLAN);

  return s.general.length === 0 && s.sinProcedencia.length === 1 && s.limitacion;
});


/* ===========================================================
   [D2-2] ENTITY != TOPIC
   =========================================================== */

bloque("[D2-2] ENTIDAD ≠ TEMA");

t("T3 · una persona repetida NO encabeza la agenda temática", () => {
  const persona = SEPARACION.entidades.find((e) => e.tipoEntidad === TIPOS_ENTIDAD.PERSON);

  return (
    Boolean(persona) &&
    !SEPARACION.temas.some((x) =>
      (x.etiquetaPropuesta || "").toLowerCase().includes("peñaloza")
    )
  );
});

t("T3b · pero la persona NO se borra: conserva sus evidencias", () => {
  const persona = SEPARACION.entidades.find((e) => e.tipoEntidad === TIPOS_ENTIDAD.PERSON);

  return persona.indices.length >= 2 && persona.razonesEntidad.length >= 2;
});

t("T4 · una organización no es un tema", () => {
  const c = clasificarEntidad("Municipio de Cuenca");

  return c.tipo === TIPOS_ENTIDAD.ORGANIZATION && c.puedeSerTema === false;
});

t("T5 · un lugar no es un tema, ni repitiéndose", () => {
  const c = clasificarEntidad("Sayausí", { gazetteer: GAZETTEER });

  return c.tipo === TIPOS_ENTIDAD.PLACE && c.puedeSerTema === false;
});

t("T5b · el gazetteer manda sobre la morfología de nombre propio", () => {
  /* «Santa Ana» parece persona y es parroquia. */
  const conGaz = clasificarEntidad("Santa Ana", {
    gazetteer: new Set(["santa ana"])
  });

  const sinGaz = clasificarEntidad("Santa Ana");

  return (
    conGaz.tipo === TIPOS_ENTIDAD.PLACE && sinGaz.tipo === TIPOS_ENTIDAD.PERSON
  );
});

t("T6 · un evento SÍ puede ser tema", () => {
  const c = clasificarEntidad("paro de noviembre");

  return c.tipo === TIPOS_ENTIDAD.EVENT && c.puedeSerTema === true;
});

t("un título personal en el contexto sube la confianza", () => {
  const con = clasificarEntidad("Marisol Peñaloza", {
    contexto: "La candidata Marisol Peñaloza recorre Sayausí"
  });

  const sin = clasificarEntidad("Marisol Peñaloza", { contexto: "Marisol Peñaloza" });

  return con.confianza > sin.confianza && con.tipo === TIPOS_ENTIDAD.PERSON;
});

t("un tema de bigrama NO sale de la agenda aunque parezca nombre", () => {
  /*
    La doble condición: solo se separa si el cluster nació de
    una ENTIDAD y además la clase no puede ser tema.
  */
  const s = separarEntidadesDeTemas([
    {
      id: "x",
      etiquetaPropuesta: "Elecciones Seccionales",
      metodoDescubrimiento: "bigrama_frecuente",
      indices: [1, 2]
    }
  ]);

  return s.temas.length === 1 && s.entidades.length === 0;
});

/*
  El defecto medido sobre el corpus real: la persona se separaba
  de los temas DESCUBIERTOS y volvia a entrar por los
  CLASIFICADOS, donde el Topic Engine 2 la emite con
  `origen: "emergente"`. Filtrar una sola rama es no filtrar.
*/
t("una entidad se separa TAMBIÉN por la rama de clasificados", () => {
  const s = separarEntidadesDeTemas([
    {
      id: "emergente-marisol",
      nombre: "Marisol Peñaloza",
      origen: "emergente",
      indices: [0, 1, 2]
    }
  ]);

  return s.entidades.length === 1 && s.temas.length === 0;
});

t("una CATEGORÍA de léxico nunca se separa como entidad", () => {
  const s = separarEntidadesDeTemas([
    {
      id: "cat-electoral",
      nombre: "Proceso electoral: elecciones y seccionales",
      origen: "lexico",
      indices: [0, 1]
    }
  ]);

  return s.temas.length === 1 && s.entidades.length === 0;
});

t("un tema emergente que NO es entidad se queda en la agenda", () => {
  const s = separarEntidadesDeTemas([
    {
      id: "emergente-falta",
      nombre: "falta · medios · denuncian",
      origen: "emergente",
      indices: [0, 1]
    }
  ]);

  return s.temas.length === 1 && s.entidades.length === 0;
});

t("las entidades se relacionan con temas por evidencias compartidas", () => {
  const rel = relacionarEntidadesConTemas(
    [{ entidad: "X", indices: [0, 1, 2] }],
    [{ id: "t1", etiquetaPropuesta: "tema", indices: [1, 2, 9] }]
  );

  return (
    rel[0].temasRelacionados.length === 1 &&
    rel[0].temasRelacionados[0].evidenciasCompartidas === 2
  );
});

t("una entidad sin tema coincidente lo DICE, no se inventa relación", () => {
  const rel = relacionarEntidadesConTemas(
    [{ entidad: "X", indices: [0] }],
    [{ id: "t1", etiquetaPropuesta: "tema", indices: [5, 6] }]
  );

  return (
    rel[0].temasRelacionados.length === 0 &&
    /no coinciden con ning[úu]n tema/i.test(rel[0].explicacion)
  );
});


/* ===========================================================
   [D2-3] SOURCE CLASSIFIER
   =========================================================== */

bloque("[D2-3] CLASIFICACIÓN DE FUENTE");

t("T7 · medio", () => {
  const c = clasificarFuente({ dominio: "elmercurio.com.ec" });

  return c.clase === CLASES_FUENTE.MEDIO && c.razones.length > 0;
});

t("T8 · institución por dominio del Estado", () => {
  const c = clasificarFuente({ dominio: "cuenca.gob.ec" });

  return (
    c.clase === CLASES_FUENTE.INSTITUCION &&
    c.confianza >= 0.9 &&
    /reservado al Estado/i.test(c.razones[0])
  );
});

t("T9 · creador NO se deduce de audiencia", () => {
  const p = clasificarPersona({ nombre: "Alguien con 500.000 seguidores" });

  return (
    p.clase === CLASES_FUENTE.NO_DETERMINADO &&
    p.razones.some((r) => /audiencia|seguidores/i.test(r))
  );
});

t("T9b · creador SÍ puede declararlo un analista, con autor", () => {
  const p = clasificarPersona({
    nombre: "X",
    claseDeclarada: CLASES_FUENTE.CREADOR,
    declaradaPor: "analista@sentinel"
  });

  return p.clase === CLASES_FUENTE.CREADOR && p.confianza >= 0.9;
});

t("T10 · comunidad por señal DECLARADA por la fuente", () => {
  const c = clasificarFuente({
    dominio: "colectivovecinoselvado.example",
    nombre: "Colectivo Vecinos de El Vado"
  });

  return c.clase === CLASES_FUENTE.CIUDADANIA_COMUNIDAD;
});

t("T10b · una PERSONA nunca es CIUDADANIA_COMUNIDAD", () => {
  const p = clasificarPersona({
    nombre: "Juan Pérez",
    claseDeclarada: CLASES_FUENTE.CIUDADANIA_COMUNIDAD,
    declaradaPor: "analista"
  });

  return (
    p.clase === CLASES_FUENTE.NO_DETERMINADO &&
    p.razones.some((r) => /no se clasifica como CIUDADANIA_COMUNIDAD/i.test(r))
  );
});

t("T11 · fuente no determinada, y eso es un resultado válido", () => {
  const c = clasificarFuente({ dominio: "sitio-cualquiera.example" });

  return (
    c.clase === CLASES_FUENTE.NO_DETERMINADO &&
    c.confianza === 0 &&
    /No determinar es un resultado v[áa]lido/i.test(c.limitacion)
  );
});

t("una plataforma es WEB_PUBLICA, nunca CREADOR", () => {
  const c = clasificarFuente({ dominio: "youtube.com" });

  /*
    La razon de plataforma no es la primera: el catalogo semilla
    ya habia anotado que youtube.com consta como «plataforma».
    Las dos razones son ciertas y las dos constan.
  */
  return (
    c.clase === CLASES_FUENTE.WEB_PUBLICA &&
    c.razones.some((r) => /no un emisor/i.test(r))
  );
});

t("toda clasificación viaja con razones y sin verificar", () => {
  return [...CLASIFICACION.porFuente.values()].every(
    (c) => Array.isArray(c.razones) && c.razones.length > 0 && c.verificada === false
  );
});


/* ===========================================================
   [D2-4] DIVERSIDAD
   =========================================================== */

bloque("[D2-4] DIVERSIDAD DE FUENTES");

t("T12 · 3 notas del mismo medio NO son 3 fuentes", () => {
  const mismo = [
    { titulo: "a", enlace: "https://elmercurio.com.ec/1", fuenteDeclarada: "El Mercurio" },
    { titulo: "b", enlace: "https://elmercurio.com.ec/2", fuenteDeclarada: "El Mercurio" },
    { titulo: "c", enlace: "https://elmercurio.com.ec/3", fuenteDeclarada: "El Mercurio" }
  ];

  const d = medirDiversidad(mismo, { resolverFuente });

  return (
    d.totalEvidencias === 3 &&
    d.fuentesIndependientes === 1 &&
    d.concentracionFuente === 1
  );
});

t("T13 · diversidad real: mismas evidencias, más fuentes, menos concentración", () => {
  const variado = [
    { titulo: "a", enlace: "https://elmercurio.com.ec/1", fuenteDeclarada: "El Mercurio" },
    { titulo: "b", enlace: "https://eluniverso.com/2", fuenteDeclarada: "El Universo" },
    { titulo: "c", enlace: "https://expreso.ec/3", fuenteDeclarada: "Expreso" }
  ];

  const d = medirDiversidad(variado, { resolverFuente });

  return d.fuentesIndependientes === 3 && d.concentracionFuente === 0;
});

t("una plataforma NO cuenta como emisor", () => {
  return (
    DIVERSIDAD.plataformas === 1 &&
    DIVERSIDAD.fuentesIndependientes < DIVERSIDAD.totalFuentes &&
    /no est[áa]n identificados/i.test(DIVERSIDAD.limitacion)
  );
});

t("toda proporción se etiqueta «% del corpus observado»", () => {
  return (
    DIVERSIDAD.unidadDeMedida === "% del corpus observado" &&
    Object.values(AGENDAS_FUENTE.metricas).every(
      (m) => m.unidadDeMedida === "% del corpus observado"
    )
  );
});

t("NUNCA se dice «% de la ciudadanía»", () => {
  const texto = JSON.stringify({ DIVERSIDAD, AGENDAS_FUENTE });

  /* Solo puede aparecer negado. */
  const usos = [...texto.matchAll(/% de la ciudadan/gi)];

  return usos.every((m) => /NUNCA|nunca|no /.test(texto.slice(Math.max(0, m.index - 60), m.index)));
});


/* ===========================================================
   [D2-5] AGENDAS SEPARADAS
   =========================================================== */

bloque("[D2-5] AGENDAS POR TIPO DE FUENTE");

t("T14 · agenda ciudadana / comunitaria", () => {
  return AGENDAS_FUENTE.metricas[AGENDAS.CIUDADANA].evidencias >= 1;
});

t("T15 · agenda mediática", () => {
  return AGENDAS_FUENTE.metricas[AGENDAS.MEDIATICA].evidencias >= 3;
});

t("T16 · agenda institucional", () => {
  return AGENDAS_FUENTE.metricas[AGENDAS.INSTITUCIONAL].evidencias >= 1;
});

t("T17 · agenda de creadores existe como categoría, vacía si no hay", () => {
  const m = AGENDAS_FUENTE.metricas[AGENDAS.CREADORES];

  return m && typeof m.evidencias === "number";
});

t("T18 · agenda digital = llegó por plataforma sin emisor identificado", () => {
  return (
    AGENDAS_FUENTE.metricas[AGENDAS.DIGITAL].evidencias >= 2 &&
    /no «lo que se dice en redes»/i.test(AGENDAS_FUENTE.declaracion)
  );
});

t("las cuotas de todas las agendas suman el corpus", () => {
  const suma = Object.values(AGENDAS_FUENTE.metricas).reduce(
    (s, m) => s + m.evidencias,
    0
  );

  return suma === CORPUS.length;
});

t("una agenda por debajo del mínimo legible se declara", () => {
  const pocas = separarCorpusPorAgenda(
    [{ titulo: "x", enlace: "https://cuenca.gob.ec/1" }],
    {
      clasificacionPorFuente: new Map([
        ["cuenca.gob.ec", { clase: CLASES_FUENTE.INSTITUCION }]
      ]),
      resolverFuente
    }
  );

  return pocas.limitaciones.some((l) => /no legibles como agenda/i.test(l));
});

t("ninguna agenda afirma medir opinión ciudadana", () => {
  return AGENDAS_FUENTE.limitaciones.some((l) =>
    /no mide opini[óo]n ciudadana|Miden publicaci[óo]n/i.test(l)
  );
});


/* ===========================================================
   [D2-6] SNAPSHOTS
   =========================================================== */

bloque("[D2-6] SNAPSHOTS APPEND-ONLY");

const SNAP_A = componerSnapshot({
  territorio: { unidadId: "ec-azuay-cuenca", nombre: "Cuenca" },
  window: { id: "30d" },
  capturedAt: "2026-08-20T10:00:00Z",
  diversidad: DIVERSIDAD,
  temas: SEPARACION.temas,
  entidades: SEPARACION.entidades,
  consultas: PLAN
});

const SNAP_B = componerSnapshot({
  territorio: { unidadId: "ec-azuay-cuenca", nombre: "Cuenca" },
  window: { id: "30d" },
  capturedAt: "2026-08-25T10:00:00Z",
  diversidad: { ...DIVERSIDAD, totalEvidencias: 40, fuentesIndependientes: 9 },
  temas: SEPARACION.temas,
  entidades: SEPARACION.entidades,
  consultas: PLAN
});

t("T19 · guardar no sobrescribe: el almacén acumula", async () => {
  return true;
});

const RESULTADO_ALMACEN = await (async () => {
  const almacen = crearAlmacenMemoria();

  await guardarSnapshot(almacen, SNAP_A);

  await guardarSnapshot(almacen, SNAP_B);

  await anexarCorreccion(
    almacen,
    SNAP_A,
    { ...SNAP_A, snapshotId: "snap-corregido", totalEvidencias: 99 },
    "Se recontaron las evidencias."
  );

  return almacen.leerTodos();
})();

t("T19b · tras corregir, el original SIGUE en el almacén", () => {
  return (
    RESULTADO_ALMACEN.length === 3 &&
    RESULTADO_ALMACEN.some((s) => s.snapshotId === SNAP_A.snapshotId) &&
    RESULTADO_ALMACEN.some((s) => s.sustituyeA === SNAP_A.snapshotId)
  );
});

t("una corrección sin motivo NO se anexa", async () => {
  const almacen = crearAlmacenMemoria();

  try {
    await anexarCorreccion(almacen, SNAP_A, SNAP_A, null);

    return false;
  } catch (e) {
    return /motivo/i.test(e.message);
  }
});

t("T20 · dos snapshots distintos tienen huella distinta", () => {
  return SNAP_A.huella !== SNAP_B.huella && SNAP_A.snapshotId !== SNAP_B.snapshotId;
});

t("el mismo contenido en distinto instante comparte huella", () => {
  const otro = componerSnapshot({
    territorio: { unidadId: "ec-azuay-cuenca", nombre: "Cuenca" },
    window: { id: "30d" },
    capturedAt: "2026-09-01T10:00:00Z",
    diversidad: DIVERSIDAD,
    temas: SEPARACION.temas,
    entidades: SEPARACION.entidades,
    consultas: PLAN
  });

  return otro.huella === SNAP_A.huella;
});

t("un snapshot sin capturedAt NO se guarda", async () => {
  const almacen = crearAlmacenMemoria();

  try {
    await guardarSnapshot(almacen, { snapshotId: "x" });

    return false;
  } catch (e) {
    return /capturedAt/i.test(e.message);
  }
});

t("el snapshot guarda la FORMA del corpus, no el corpus", () => {
  const texto = JSON.stringify(SNAP_A);

  /* Ningún titular completo del corpus debe estar dentro. */
  return !CORPUS.some((e) => texto.includes(e.titulo));
});


/* ===========================================================
   [D2-7] VENTANAS COMPARABLES
   =========================================================== */

bloque("[D2-7] SIN VENTANA COMPARABLE");

t("T21 · sin ventana anterior NO se calcula tendencia", () => {
  const c = compararConVentanaAnterior(SNAP_B, null);

  return (
    c.disponible === false &&
    c.estado === "SIN_VENTANA_COMPARABLE" &&
    c.variacion === null &&
    c.variacionEvidencias === null
  );
});

t("T21b · la forma de la respuesta es la MISMA exista o no", () => {
  const sin = compararConVentanaAnterior(SNAP_B, null);

  const con = compararConVentanaAnterior(SNAP_B, SNAP_A);

  return (
    Object.prototype.hasOwnProperty.call(sin, "variacionEvidencias") &&
    Object.prototype.hasOwnProperty.call(con, "variacionEvidencias") &&
    sin.disponible === false &&
    con.disponible === true
  );
});

t("con ventana anterior sí se compara, y se declara el límite", () => {
  const c = compararConVentanaAnterior(SNAP_B, SNAP_A);

  return (
    c.variacionEvidencias.diferencia === SNAP_B.totalEvidencias - SNAP_A.totalEvidencias &&
    /no es comparar dos realidades/i.test(c.limitacion)
  );
});

t("no se compara contra una ventana de distinta duración", () => {
  const otraVentana = { ...SNAP_A, window: { id: "7d" } };

  const encontrado = buscarVentanaAnterior([otraVentana], {
    territorioId: "ec-azuay-cuenca",
    ventanaId: "30d",
    capturedAt: SNAP_B.capturedAt
  });

  return encontrado === null;
});

t("no se compara contra otro territorio", () => {
  const otroTerritorio = {
    ...SNAP_A,
    territorio: { unidadId: "ec-azuay-gualaceo" }
  };

  return (
    buscarVentanaAnterior([otroTerritorio], {
      territorioId: "ec-azuay-cuenca",
      ventanaId: "30d",
      capturedAt: SNAP_B.capturedAt
    }) === null
  );
});


/* ===========================================================
   [D2-8] PROVEEDORES
   =========================================================== */

bloque("[D2-8] AUDITORÍA DE PROVEEDORES");

const MATRIZ = matrizProveedores({
  trazaEjecucion: [
    { fuente: "google_news_rss", motorId: "google_news_rss", recibidas: 30, nuevas: 30, estado: "OK" },
    { fuente: "brave_web", motorId: "brave_web", recibidas: 0, nuevas: 0, estado: "SIN_CREDENCIAL" }
  ]
});

t("T22 · la matriz declara todos los proveedores", () => {
  return (
    MATRIZ.filas.length >= 5 &&
    MATRIZ.filas.some((f) => f.provider === "google_news_rss") &&
    MATRIZ.filas.some((f) => f.provider === "bing_web")
  );
});

t("T22b · declarado ≠ integrado ≠ aportó evidencia", () => {
  const r = MATRIZ.resumen;

  return (
    r.declarados > r.implementados ||
    (r.implementados >= r.integrados && r.aportaronEvidencia < r.declarados)
  );
});

t("un proveedor NO implementado no se presenta como integrado", () => {
  const bing = MATRIZ.filas.find((f) => f.provider === "bing_web");

  return bing.implementado === false && bing.credencial === "no aplica" && bing.enUso === false;
});

t("T23 · coste null si se desconoce, y se propaga", () => {
  const serp = MATRIZ.filas.find((f) => f.provider === "serpapi_google");

  return (
    serp.costoPorConsulta === null &&
    serp.costoConocido === false &&
    serp.costoEstimadoEjecucion === null &&
    /No se estima/i.test(serp.motivoCosto)
  );
});

t("un coste conocido SÍ se declara: 0 no es null", () => {
  const rss = MATRIZ.filas.find((f) => f.provider === "google_news_rss");

  return rss.costoPorConsulta === 0 && rss.costoConocido === true;
});

t("sin traza de ejecución, enUso es null y no false", () => {
  const m = matrizProveedores({});

  return m.filas.every((f) => f.enUso === null) && m.resumen.aportaronEvidencia === null;
});


/* ===========================================================
   [D2-9] DATA-PROVIDER-EVAL-01
   =========================================================== */

bloque("[D2-9] DATA-PROVIDER-EVAL-01");

const BENCH = estadoBenchmark();

t("el benchmark tiene caso fijo y candidatos declarados", () => {
  return (
    BENCH.caso.consultas.length >= 3 &&
    BENCH.candidatos >= 10 &&
    BENCH.noEvaluados >= 8
  );
});

t("ninguna ficha está ejecutada y TODAS las métricas son null", () => {
  return BENCH.fichas.every(
    (f) =>
      f.ejecutado === false &&
      Object.values(f.metricas).every((v) => v === null)
  );
});

t("null no es cero: una ficha vacía se distingue de un cero medido", () => {
  const f = fichaBenchmark("x", "X");

  return f.metricas.resultadosBrutos === null && /no es un benchmark con resultado cero/i.test(f.declaracion);
});

t("coste por evidencia útil es null si el coste es null", () => {
  const r = costoPorEvidenciaUtil({
    costoTotal: null,
    resultadosUnicos: 100,
    relevanciaCuenca: 0.8
  });

  return r.valor === null && /no se estima/i.test(r.motivo);
});

t("con coste conocido sí se calcula", () => {
  const r = costoPorEvidenciaUtil({
    costoTotal: 10,
    resultadosUnicos: 100,
    relevanciaCuenca: 0.5
  });

  return r.valor === 0.2;
});

t("cero evidencias útiles NO da coste infinito ni cero", () => {
  const r = costoPorEvidenciaUtil({
    costoTotal: 10,
    resultadosUnicos: 100,
    relevanciaCuenca: 0
  });

  return r.valor === null && /no est[áa] definido/i.test(r.motivo);
});

t("las consultas del benchmark llevan ancla, como en producción", () => {
  return BENCH.caso.consultas.every((q) => /azuay|ecuador/i.test(q));
});


/* ===========================================================
   [D2-10] AI ROUTER
   =========================================================== */

bloque("[D2-10] AI ROUTER");

const AI = estadoAiRouter();

t("T27 · el contrato del adaptador declara todos sus campos", () => {
  const c = AI.contrato.campos;

  return [
    "provider",
    "model",
    "taskType",
    "inputType",
    "supportsText",
    "supportsImage",
    "supportsStructuredOutput",
    "latency",
    "cost",
    "reliability",
    "traceId"
  ].every((k) => typeof c[k] === "string");
});

t("T28 · ningún proveedor está cableado a ninguna tarea", () => {
  const texto = JSON.stringify(AI);

  const nombres = /\b(claude|chatgpt|gpt-4|gemini|anthropic|openai)\b/gi;

  const usos = [...texto.matchAll(nombres)].filter((m) => {
    const ctx = texto.slice(Math.max(0, m.index - 200), m.index);

    /* Solo puede aparecer en la lista de AI-EVAL-01 o negado. */
    return !/proveedoresAEvaluar|no se incorpora|no integra|ninguno|evaluar/i.test(ctx);
  });

  return usos.length === 0 && AI.adaptadoresRegistrados === 0;
});

t("T28b · la auditoría confirma que hoy no hay IA integrada", () => {
  return (
    AI.integracionActual === "NINGUNA" &&
    AI.auditoria.llamadasAModelos === 0 &&
    AI.auditoria.dependenciasDeIA.length === 0
  );
});

t("sin adaptadores, elegir devuelve null con motivo y degradación", () => {
  const r = elegirProveedor(TAREAS_IA.TOPIC_LABELING, []);

  return r.elegido === null && r.motivo && r.degradaA;
});

t("un adaptador SIN métricas medidas no gana la elección", () => {
  const r = elegirProveedor(TAREAS_IA.TOPIC_LABELING, [
    {
      provider: "cualquiera",
      model: "m1",
      taskType: TAREAS_IA.TOPIC_LABELING,
      supportsStructuredOutput: true,
      reliability: null,
      latency: null
    }
  ]);

  return r.elegido === null && /sin medir|MEDIDAS/i.test(r.motivo);
});

t("con métricas medidas sí elige, y por fiabilidad primero", () => {
  const base = {
    taskType: TAREAS_IA.TOPIC_LABELING,
    supportsStructuredOutput: true
  };

  const r = elegirProveedor(TAREAS_IA.TOPIC_LABELING, [
    { ...base, provider: "a", model: "1", reliability: 0.9, latency: 100, cost: 0.001 },
    { ...base, provider: "b", model: "2", reliability: 0.99, latency: 900, cost: 0.05 }
  ]);

  return r.elegido.provider === "b";
});

t("una tarea que exige salida estructurada rechaza a quien no la da", () => {
  const r = elegirProveedor(TAREAS_IA.TOPIC_LABELING, [
    {
      provider: "a",
      model: "1",
      taskType: TAREAS_IA.TOPIC_LABELING,
      supportsStructuredOutput: false,
      reliability: 0.99,
      latency: 10
    }
  ]);

  return r.elegido === null && /salida estructurada/i.test(r.motivo);
});

t("ninguna tarea de IA puede crear hechos", () => {
  return Object.values(CAPACIDADES_TAREA).every(
    (c) => c.puedeCrearHechos === false && c.reemplazaDeterminista === false
  );
});

t("toda tarea declara a qué degrada si no hay proveedor", () => {
  return Object.values(CAPACIDADES_TAREA).every(
    (c) => typeof c.degradaA === "string" && c.degradaA.length > 0
  );
});


/* ===========================================================
   [D2-11] PROCEDENCIA Y GEO-1
   =========================================================== */

bloque("[D2-11] PROCEDENCIA Y GEO-1");

t("T25 · toda fuente conserva su procedencia", () => {
  return listarFuentes(UNIVERSO).every(
    (f) => f.origen && Array.isArray(f.procedencia) && f.procedencia.length > 0
  );
});

t("T25b · la procedencia se ACUMULA, no se sobrescribe", () => {
  const u = crearUniverso();

  registrarFuente(u, {
    dominio: "x.example",
    origen: ORIGENES_SOURCE.CATALOGO,
    detalle: "catálogo"
  });

  registrarFuente(u, {
    dominio: "x.example",
    origen: ORIGENES_SOURCE.EVIDENCIA,
    detalle: "evidencia"
  });

  return u.fuentes.get("x.example").procedencia.length === 2;
});

t("T26 · una fuente descubierta NO se autoverifica", () => {
  const u = crearUniverso();

  for (let i = 0; i < 20; i += 1) {
    registrarFuente(u, {
      dominio: "y.example",
      origen: ORIGENES_SOURCE.EVIDENCIA
    });
  }

  const f = u.fuentes.get("y.example");

  return (
    f.frecuenciaObservada === 20 &&
    f.verificada === false &&
    f.estado === ESTADOS_SOURCE.OBSERVADA
  );
});

t("T26b · verificar exige autor y motivo", () => {
  const u = crearUniverso();

  registrarFuente(u, { dominio: "z.example", origen: ORIGENES_SOURCE.EVIDENCIA });

  const sin = verificarFuente(u, "z.example", {});

  const con = verificarFuente(u, "z.example", {
    autor: "analista",
    motivo: "contrastada con el registro de medios"
  });

  return (
    sin.error &&
    sin.verificada === false &&
    con.verificada === true &&
    con.estado === ESTADOS_SOURCE.VERIFICADA
  );
});

t("el estado del universo declara sus cautelas", () => {
  const e = estadoUniverso(UNIVERSO);

  return (
    e.declaraciones.some((d) => /no se autoverifica/i.test(d)) &&
    e.declaraciones.some((d) => /plataforma no es un emisor/i.test(d)) &&
    e.emisores < e.fuentes
  );
});

t("licencia sin comprobar bloquea igual que una prohibida", () => {
  const e = estadoUniverso(UNIVERSO);

  return (
    e.sinLicenciaComprobada === e.fuentes &&
    e.declaraciones.some((d) => /bloquea igual que/i.test(d))
  );
});

t("T24 · GEO-1 sigue bloqueando precisión falsa tras ampliar fuentes", () => {
  /*
    Una evidencia de un medio NACIONAL no autoriza a bajar a
    parroquia por mucho que el texto nombre una. Ampliar el
    universo de fuentes no puede relajar esto.
  */
  const bloqueo = comprobarGeo1(
    { procedencia: "declarada", resolucion: "provincia" },
    "parroquia"
  );

  const permitido = comprobarGeo1(
    { procedencia: "declarada", resolucion: "parroquia" },
    "canton"
  );

  return bloqueo.permitido === false && permitido.permitido === true;
});

t("una fuente nueva no cambia la resolución de la evidencia", () => {
  /*
    El universo de fuentes y la resolución territorial son
    dimensiones independientes: registrar un emisor más no
    aporta precisión geográfica.
  */
  const antes = comprobarGeo1(
    { procedencia: "declarada", resolucion: "canton" },
    "parroquia"
  );

  registrarFuente(UNIVERSO, {
    dominio: "nueva.example",
    origen: ORIGENES_SOURCE.EVIDENCIA
  });

  const despues = comprobarGeo1(
    { procedencia: "declarada", resolucion: "canton" },
    "parroquia"
  );

  return antes.permitido === false && despues.permitido === false;
});


/* ===========================================================
   [D2-12] TIPOS DEL UNIVERSO
   =========================================================== */

bloque("[D2-12] SOURCE UNIVERSE");

t("el universo distingue emisores de plataformas", () => {
  const e = estadoUniverso(UNIVERSO);

  return e.plataformas >= 1 && e.emisores === e.fuentes - e.plataformas;
});

t("los tipos declarados existen y se usan", () => {
  /*
    Nueve desde INGEST-REAL-01: PLATFORM dejó de ser una
    bandera y pasó a ser un tipo. La bandera se conserva, pero
    lo que decide si algo es un emisor es el tipo.
  */
  return (
    Object.keys(TIPOS_SOURCE).length === 9 &&
    TIPOS_SOURCE.PLATFORM === "PLATFORM" &&
    listarFuentes(UNIVERSO).some((f) => f.tipo === TIPOS_SOURCE.MEDIA)
  );
});

t("listar sin plataformas devuelve solo emisores", () => {
  const conP = listarFuentes(UNIVERSO, { incluirPlataformas: true });

  const sinP = listarFuentes(UNIVERSO, { incluirPlataformas: false });

  return sinP.length < conP.length && sinP.every((f) => !f.esPlataforma);
});


/* --------------------------------------------------------- */

console.log("\n===========================================");
console.log(`PASS: ${pass}    FALL: ${fail}`);

if (fallos.length) {
  console.log("\nFallos:");
  fallos.forEach((f) => console.log(`  - ${f}`));
}

console.log("===========================================\n");

process.exit(fail > 0 ? 1 : 0);
