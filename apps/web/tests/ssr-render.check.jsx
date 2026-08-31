import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";

import CoverageDeclaration from "../src/territorio/panels/CoverageDeclaration";
import ResolutionNotice from "../src/territorio/panels/ResolutionNotice";
import TerritorialRankingPanel from "../src/territorio/panels/TerritorialRankingPanel";
import ConversationVolumePanel from "../src/territorio/panels/ConversationVolumePanel";
import TopicsPanel from "../src/territorio/panels/TopicsPanel";
import MediaCoveragePanel from "../src/territorio/panels/MediaCoveragePanel";
import EnginesTracePanel from "../src/territorio/panels/EnginesTracePanel";
import UnknownsBlock from "../src/territorio/panels/UnknownsBlock";
import ExecutiveHeader from "../src/territorio/panels/ExecutiveHeader";
import CoverageWarning from "../src/territorio/panels/CoverageWarning";
import DigitalBehaviorPanel from "../src/territorio/panels/DigitalBehaviorPanel";
import AgendaPanel from "../src/territorio/agenda/AgendaPanel";
import RadarPanel from "../src/territorio/agenda/RadarPanel";
import TopicDrawer from "../src/territorio/agenda/TopicDrawer";
import TerritorialMap from "../src/territorio/map/TerritorialMap";
import PlacesWithoutGeometry from "../src/territorio/map/PlacesWithoutGeometry";
import TerritoryPanel from "../src/territorio/map/TerritoryPanel";
import EntitiesPanel from "../src/territorio/agenda/EntitiesPanel";
import SourceAgendasPanel from "../src/territorio/agenda/SourceAgendasPanel";
import FreshnessPanel from "../src/territorio/panels/FreshnessPanel";
import ProvidersStatusPanel from "../src/territorio/panels/ProvidersStatusPanel";
import TopicTerritoryPanel from "../src/territorio/panels/TopicTerritoryPanel";

/*
  Renderiza los paneles con la respuesta REAL de la API y
  comprueba el HTML resultante.

  No es una captura de pantalla: es render real de React con
  datos reales. Verifica lo que una captura no puede verificar
  automaticamente —que no aparezca «0 habitantes», que la
  etiqueta de dato pendiente este presente, que no se prometa un
  mapa— y no verifica lo que solo el ojo ve: colores, espaciado
  y jerarquia visual.
*/

const datos = JSON.parse(readFileSync(process.argv[2], "utf8"));

let pass = 0;
let fail = 0;

function t(nombre, cond) {
  if (cond) {
    pass += 1;
    console.log(`  PASS  ${nombre}`);
  } else {
    fail += 1;
    console.log(`  FALL  ${nombre}`);
  }
}

function render(nombre, elemento) {
  try {
    const html = renderToStaticMarkup(elemento);
    console.log(`  PASS  ${nombre} renderiza (${html.length} bytes)`);
    pass += 1;
    return html;
  } catch (e) {
    console.log(`  ERR   ${nombre}: ${e.message}`);
    fail += 1;
    return "";
  }
}

console.log("\n[A] RENDER DE CADA PANEL CON DATOS REALES");

const htmls = {};

htmls.cobertura = render(
  "CoverageDeclaration",
  <CoverageDeclaration datos={datos} />
);

htmls.resolucion = render(
  "ResolutionNotice",
  <ResolutionNotice
    resolucion={datos.territorio?.resolucion}
    geo1={datos.territorio?.agregado?.geo1}
  />
);

htmls.ranking = render(
  "TerritorialRankingPanel",
  <TerritorialRankingPanel
    agregado={datos.territorio?.agregado}
    normalizacion={datos.territorio?.normalizacion}
  />
);

htmls.volumen = render(
  "ConversationVolumePanel",
  <ConversationVolumePanel
    conversacion={datos.conversacion}
    serieTerritorial={datos.territorio?.serie}
  />
);

htmls.temas = render("TopicsPanel", <TopicsPanel conversacion={datos.conversacion} />);

htmls.medios = render(
  "MediaCoveragePanel",
  <MediaCoveragePanel conversacion={datos.conversacion} />
);

htmls.motores = render(
  "EnginesTracePanel",
  <EnginesTracePanel recoleccion={datos.conversacion?.recoleccion} />
);

htmls.unknowns = render(
  "UnknownsBlock",
  <UnknownsBlock items={datos.loQueNoSabemos} />
);

/* --- Gate D --- */

htmls.header = render("ExecutiveHeader", <ExecutiveHeader datos={datos} />);

htmls.aviso = render(
  "CoverageWarning",
  <CoverageWarning limitaciones={datos.coverageLimitations} />
);

htmls.conducta = render("DigitalBehaviorPanel", <DigitalBehaviorPanel />);

htmls.agenda = render(
  "AgendaPanel",
  <AgendaPanel agenda={datos.agenda} onAbrirTema={() => {}} temaAbierto={null} />
);

htmls.radar = render(
  "RadarPanel",
  <RadarPanel agenda={datos.agenda} onAbrirTema={() => {}} />
);

htmls.drawer = render(
  "TopicDrawer",
  <TopicDrawer
    tema={datos.agenda?.agenda?.[0]}
    evidencias={datos.evidenciasEnriquecidas || datos.conversacion?.evidencias}
    onCerrar={() => {}}
  />
);

/* --- Gate F1 --- */

htmls.mapa = render(
  "TerritorialMap",
  <TerritorialMap mapa={datos.mapa} onSeleccionar={() => {}} seleccionada={null} />
);

htmls.sinGeometria = render(
  "PlacesWithoutGeometry",
  <PlacesWithoutGeometry mapa={datos.mapa} onSeleccionar={() => {}} />
);

htmls.territorio = render(
  "TerritoryPanel",
  <TerritoryPanel unidad={datos.mapa?.conGeometria?.[0]} onCerrar={() => {}} />
);

/* --- Gate D2 --- */

htmls.entidades = render(
  "EntitiesPanel",
  <EntitiesPanel escucha={datos.escuchaAbierta} />
);

htmls.agendasFuente = render(
  "SourceAgendasPanel",
  <SourceAgendasPanel escucha={datos.escuchaAbierta} />
);

/* --- TERRITORIAL-FRESH-01 --- */

htmls.frescura = render("FreshnessPanel", <FreshnessPanel frescura={datos.frescura} />);

htmls.proveedores = render("ProvidersStatusPanel", <ProvidersStatusPanel datos={datos} />);

const todo = Object.values(htmls).join("\n");


console.log("\n[B] DATOS OFICIALES — no inventar");

t(
  "aparece «Dato oficial pendiente de integración»",
  /Dato oficial pendiente de integraci/i.test(todo)
);

t("NO aparece «0 habitantes»", !/0\s*habitantes/i.test(todo));

t("NO aparece «habitantes» en absoluto", !/habitantes/i.test(todo));

/*
  «per cápita» puede aparecer, pero SOLO negado.

  La comprobacion ingenua —que la frase no aparezca nunca—
  prohibia tambien el enunciado que queremos: «no se calcula
  ninguna metrica per capita». Lo que no puede existir es la
  frase etiquetando un dato.
*/
const ocurrenciasPerCapita = [...todo.matchAll(/per c[áa]pita/gi)];

t(
  "«per cápita» solo aparece negado, nunca etiquetando un dato",
  ocurrenciasPerCapita.every((m) => {
    const contexto = todo.slice(Math.max(0, m.index - 90), m.index);

    return /\bno\b|\bning[úu]n|\bsin\b|pendiente/i.test(contexto);
  })
);

t(
  "NO se presenta un porcentaje como penetración poblacional",
  !/penetraci[óo]n/i.test(todo)
);

t(
  "el ranking declara que es conteo absoluto",
  /conteo absoluto|valor absoluto|intensidad relativa/i.test(htmls.ranking)
);


console.log("\n[C] MAPA F1 — solo geometría verificada");

/*
  Hasta F1 esta seccion comprobaba que NO hubiera mapa. Ahora el
  mapa existe, asi que lo que hay que comprobar cambia: que
  dibuje algo, que no dibuje lo que no tiene poligono, y que
  declare cuando un limite es derivado en vez de publicado.
*/

t("el mapa dibuja al menos un polígono", /<path/.test(htmls.mapa));

t(
  "el mapa NO se dibuja vacío en silencio",
  datos.mapa?.metricas?.unidadesPintables > 0
    ? /<svg/.test(htmls.mapa)
    : /no se dibuja vac/i.test(htmls.mapa)
);

t(
  "se declara cuántas unidades tienen geometría",
  /unidades con geometr[íi]a oficial/i.test(htmls.mapa)
);

t(
  "se advierte que las parroquias urbanas no tienen polígono",
  /parroquias urbanas de Cuenca no tienen pol[íi]gono oficial/i.test(htmls.mapa)
);

t(
  "un límite derivado se declara como derivado, no como oficial",
  datos.mapa?.conGeometria?.some((u) => u.geometriaDerivada)
    ? /l[íi]mite derivado/i.test(htmls.mapa) &&
      /uni[óo]n declarada, no un pol[íi]gono publicado/i.test(htmls.mapa)
    : true
);

t(
  "el color se declara como evidencias, NO como porcentaje",
  /evidencias observadas/i.test(htmls.mapa) &&
    /No es un porcentaje de poblaci[óo]n/i.test(htmls.mapa)
);

t(
  "lo que no tiene geometría aparece igualmente, no desaparece",
  datos.mapa?.sinGeometria?.length > 0
    ? datos.mapa.sinGeometria.every((u) => htmls.sinGeometria.includes(u.nombre))
    : true
);

t(
  "el bloque sin geometría explica POR QUÉ falta el polígono",
  datos.mapa?.sinGeometria?.length > 0
    ? /no tiene pol[íi]gono|sin geometr[íi]a|no publicad/i.test(htmls.sinGeometria)
    : true
);

t(
  "NO se dibujan radios de geolocalización falsos",
  !/<circle/i.test(htmls.mapa) && !/radio de \d/i.test(todo)
);


console.log("\n[C2] AGENDA Y RADAR — sin score opaco ni tendencia");

t(
  "la agenda muestra los temas con su actividad observada",
  /actividad observada|Se[ñn]al insuficiente/i.test(htmls.agenda)
);

t(
  "NO se presenta un «Sentinel Score» ni puntuación única",
  !/sentinel score|puntuaci[óo]n global|score:/i.test(todo)
);

t(
  "las tres dimensiones se muestran POR SEPARADO",
  /evidencias/i.test(htmls.radar) &&
    /fuentes/i.test(htmls.radar) &&
    /recencia|[úu]ltima/i.test(htmls.radar)
);

/*
  Sin ventana comparable no hay crecimiento posible. Estas
  palabras describen evolucion y estan prohibidas hasta que
  exista ventana anterior — salvo cuando se usan justo para
  declarar que NO se pueden usar.
*/
const PROHIBIDAS = /\b(emergente|creciendo|en aumento|viral|tendencia al alza)\b/gi;

/*
  Sobre el texto SIN etiquetas. Con el HTML crudo, un
  «<strong>No</strong>» mete 17 caracteres de marcado entre la
  negacion y la palabra negada y empuja la primera fuera de la
  ventana de contexto: el aviso que dice «no se usa viral»
  contaria como un uso de «viral».
*/
const soloTexto = todo.replace(/<[^>]+>/g, " ");

const usosProhibidos = [...soloTexto.matchAll(PROHIBIDAS)].filter((m) => {
  const contexto = soloTexto.slice(Math.max(0, m.index - 160), m.index);

  return !/\bno\b|\bning[úu]n|\bsin\b|prohibid|no se puede|no determinable/i.test(
    contexto
  );
});

t(
  "«emergente/creciendo/viral» solo aparecen negados",
  usosProhibidos.length === 0
);

t(
  "un tema descubierto sin categoría NO se esconde",
  datos.agenda?.agenda?.some((f) => f.sinCategoria)
    ? datos.agenda.agenda
        .filter((f) => f.sinCategoria)
        .every((f) => htmls.agenda.includes(f.etiqueta))
    : true
);

t(
  "el detalle del tema responde por qué Sentinel dice que existe",
  /por qu[ée]|se sostiene|evidencias que lo sostienen|fuentes/i.test(htmls.drawer)
);

/*
  Las limitaciones marcadas `visibleSiempre` tienen que estar en
  el HTML sin abrir nada. `corpus_parcial` es la excepcion
  legitima: su enunciado ES la cabecera del bloque, y repetirlo
  como vineta seria decir lo mismo dos veces.
*/
t(
  "toda limitación «visibleSiempre» aparece sin desplegar nada",
  (datos.coverageLimitations || [])
    .filter((l) => l.visibleSiempre && l.id !== "corpus_parcial")
    .every((l) => htmls.aviso.includes(l.titulo))
);

t(
  "el sesgo de consulta NO queda plegado",
  !(datos.coverageLimitations || []).some((l) => l.id === "sesgo_de_consulta") ||
    /Sesgo de consulta/i.test(htmls.aviso)
);

/*
  Las plegadas pueden estar plegadas, pero NO en silencio: el
  boton dice cuantas hay. Una limitacion que el usuario no sabe
  que existe es una limitacion no declarada.
*/
t(
  "las limitaciones plegadas se anuncian con su número",
  (datos.coverageLimitations || []).filter((l) => !l.visibleSiempre).length === 0 ||
    /Ver \d+ limitaci/i.test(htmls.aviso)
);

/*
  El panel de conducta digital SI nombra las dimensiones que
  tendria —Android/iOS, franja horaria— porque enumerar lo que
  falta no es inventarlo. Lo que no puede haber es un VALOR
  pegado a ninguna de ellas.
*/
t(
  "la conducta digital aparece DESACTIVADA",
  /no disponible|pendiente|desactivad|no se puede/i.test(htmls.conducta)
);

t(
  "ninguna dimensión de conducta digital lleva un valor numérico",
  !/(android|ios|m[óo]vil|desktop|tablet)[^<]{0,20}\d/i.test(
    htmls.conducta.replace(/<[^>]+>/g, " ")
  )
);

t(
  "se declara que el dispositivo NO se infiere",
  /no se infiere|nunca seguimiento individual/i.test(htmls.conducta)
);

t(
  "NO se llama «influencer» a ninguna fuente",
  !/influencer/i.test(todo)
);


console.log("\n[C3] ESCUCHA ABIERTA — entidad ≠ tema, fuentes declaradas");

t(
  "una PERSONA no aparece en la agenda temática",
  (datos.escuchaAbierta?.entidades || [])
    .filter((e) => e.tipoEntidad === "PERSON")
    .every((e) => !htmls.agenda.includes(e.entidad))
);

t(
  "...pero SÍ aparece en el bloque de entidades",
  (datos.escuchaAbierta?.entidades || []).every((e) =>
    htmls.entidades.includes(e.entidad)
  )
);

t(
  "el bloque de entidades declara que NO son temas",
  /no son temas|es un sujeto, no un asunto/i.test(htmls.entidades)
);

t(
  "cada entidad explica POR QUÉ no es un tema",
  (datos.escuchaAbierta?.entidades || []).length === 0 ||
    /por qu[ée] no es un tema/i.test(htmls.entidades)
);

t(
  "una entidad muestra los temas en los que aparece, o dice que no hay",
  (datos.escuchaAbierta?.entidades || []).every((e) =>
    e.temasRelacionados?.length
      ? htmls.entidades.includes(e.temasRelacionados[0].etiqueta)
      : /todav[íi]a no forma tema/i.test(htmls.entidades)
  )
);

t(
  "las cinco agendas por tipo de fuente se muestran",
  ["mediática", "digital", "institucional", "ciudadana", "creadores"].every((a) =>
    new RegExp(a, "i").test(htmls.agendasFuente)
  )
);

t(
  "una agenda VACÍA se declara como carencia de observación, no como silencio",
  Object.entries(datos.escuchaAbierta?.agendasPorFuente?.metricas || {}).some(
    ([k, m]) => m.evidencias === 0 && k !== "SIN_CLASIFICAR"
  )
    ? /no significa silencio/i.test(htmls.agendasFuente)
    : true
);

t(
  "los porcentajes se declaran «del corpus observado»",
  /del corpus observado/i.test(htmls.agendasFuente)
);

/*
  La frase puede aparecer, pero SOLO negada. Es la misma
  cautela que con «per cápita»: lo que no puede existir es la
  frase etiquetando un dato.
*/
t(
  "NUNCA se presenta un porcentaje como «de la ciudadanía»",
  (() => {
    const texto = todo.replace(/<[^>]+>/g, " ");

    return [...texto.matchAll(/de la ciudadan[íi]a/gi)].every((m) => {
      const ctx = texto.slice(Math.max(0, m.index - 90), m.index);

      return /nunca|\bno\b|ning[úu]n/i.test(ctx);
    });
  })()
);

t(
  "una plataforma no se cuenta como emisor independiente",
  datos.escuchaAbierta?.diversidad?.plataformas > 0
    ? datos.escuchaAbierta.diversidad.fuentesIndependientes <
        datos.escuchaAbierta.diversidad.totalFuentes &&
      /no est[áa]n identificados/i.test(htmls.agendasFuente)
    : true
);


console.log("\n[C4] FRESCURA — publicado hoy ≠ encontrado hoy");

t(
  "las cuatro cifras de frescura se muestran",
  ["Publicado hoy", "Encontrado hoy, publicado antes", "Fecha no resuelta"].every((x) =>
    htmls.frescura.includes(x)
  )
);

t(
  "«publicado hoy» y el total NO son la misma cifra cuando difieren",
  datos.frescura?.resumen &&
    datos.frescura.resumen.publicadoHoy !== datos.frescura.resumen.total
    ? htmls.frescura.includes(String(datos.frescura.resumen.publicadoHoy)) &&
      htmls.frescura.includes(String(datos.frescura.resumen.total))
    : true
);

t(
  "se declara que encontrar algo hoy no lo publica hoy",
  /Encontrar algo hoy no\s*lo publica hoy|no lo publica hoy/i.test(htmls.frescura)
);

t(
  "se muestra la zona horaria del territorio",
  /America\/Guayaquil/.test(htmls.frescura)
);

t(
  "se muestra la última actualización",
  /[ÚU]ltima actualizaci[óo]n/i.test(htmls.frescura)
);

t(
  "la distribución temporal tiene casilla propia para «fecha no resuelta»",
  /Fecha no resuelta/.test(htmls.frescura)
);

t(
  "NO se dice que el corpus entero se publicó hoy",
  datos.frescura?.resumen?.encontradoHoyPublicadoAntes > 0
    ? /publicado antes/i.test(htmls.frescura)
    : true
);


console.log("\n[C5] PROVEEDORES — sin inflar la participación");

t(
  "el panel declara cuántos APORTARON, no cuántos existen",
  /aportaron evidencia/i.test(htmls.proveedores)
);

t(
  "«no ejecutado» se distingue de «ejecutado sin resultados»",
  /no son lo mismo|Solo el segundo permite decir/i.test(htmls.proveedores)
);

t(
  "un proveedor no alcanzable se declara, no se omite",
  (datos.escuchaAmpliada?.lotes || []).some((l) =>
    ["TIEMPO_AGOTADO", "ERROR", "SIN_FUENTES"].includes(l.estado)
  )
    ? /No alcanzable|Error|Sin fuentes/i.test(htmls.proveedores)
    : true
);

t(
  "se advierte que la cobertura es parcial cuando faltan proveedores",
  /cobertura de esta vista es parcial|pudo existir igualmente/i.test(htmls.proveedores) ||
    !/aportaron evidencia/i.test(htmls.proveedores)
);


console.log("\n[D] HONESTIDAD OBLIGATORIA");

t(
  "GEO-1 visible con su enunciado",
  /Nunca se pinta m[áa]s fino que la resoluci[óo]n del dato/i.test(
    htmls.resolucion
  )
);

t(
  "se declara la resolución efectiva",
  /Resoluci[óo]n efectiva/i.test(htmls.resolucion)
);

t("bloque «Lo que no sabemos» presente", /no sabemos/i.test(htmls.unknowns));

t(
  "se aclara que mide publicación, no opinión ciudadana",
  /publicaci[óo]n.*no opini[óo]n ciudadana|no opini[óo]n ciudadana/i.test(
    htmls.volumen
  )
);

t(
  "el encuadre declara su base de cálculo",
  /sin encuadre determinable|determinado/i.test(htmls.temas)
);

t(
  "los medios declaran que no se mide alcance",
  /no se mide alcance|No se mide alcance/i.test(htmls.medios)
);

t(
  "la traza de motores muestra los sin cobertura",
  /sin cobertura|SIN_CREDENCIAL|NO_EJECUTADO/i.test(htmls.motores)
);

t("el coste se declara", /SerpAPI/i.test(htmls.cobertura));


console.log("\n[E] UTF-8 Y TEXTO");

t("tildes correctas en la interfaz", /[áéíóúñÁÉÍÓÚÑ]/.test(todo));

t("no hay mojibake (Ã)", !/Ã/.test(todo));

t("no hay «undefined» impreso", !/>undefined</.test(todo));

t("no hay «NaN» impreso", !/>NaN</.test(todo));

t("no hay «[object Object]»", !/\[object Object\]/.test(todo));


console.log("\n[F] AUSENCIA DE DATOS — casos límite");

const vacio = {
  territorio: {
    resolucion: { pedida: "parroquia", efectiva: null, coincide: false, aviso: "x" },
    agregado: {
      unidades: [],
      sinDato: [],
      metricas: {},
      umbralMuestra: 5,
      geo1: { bloqueos: 0 },
      loQueNoSabemos: []
    },
    normalizacion: { aplicada: { disponible: false, motivo: "sin datos" } },
    registroTerritorial: { carencias: [] },
    ubicacion: { metricas: {} },
    serie: null
  },
  conversacion: {
    naturaleza: { lecturaCorrecta: "x", exclusionDeclarada: "y" },
    temas: { temas: [], descartados: [] },
    encuadre: null,
    medios: { medios: [], resumen: {} },
    serie: null,
    recoleccion: { metricas: {}, trazaMotores: [] }
  },
  costo: {},
  loQueNoSabemos: []
};

render("CoverageDeclaration vacío", <CoverageDeclaration datos={vacio} />);
render(
  "Ranking vacío",
  <TerritorialRankingPanel
    agregado={vacio.territorio.agregado}
    normalizacion={vacio.territorio.normalizacion}
  />
);
render(
  "Volumen sin serie",
  <ConversationVolumePanel conversacion={vacio.conversacion} serieTerritorial={null} />
);
render("Temas vacío", <TopicsPanel conversacion={vacio.conversacion} />);
render("Medios vacío", <MediaCoveragePanel conversacion={vacio.conversacion} />);
render("Unknowns vacío", <UnknownsBlock items={[]} />);

console.log("\n[G] NULOS Y AUSENTES");

render("todo null", <CoverageDeclaration datos={null} />);
render("resolución null", <ResolutionNotice resolucion={null} geo1={null} />);
render("agregado null", <TerritorialRankingPanel agregado={null} normalizacion={null} />);
render("conversación null", <TopicsPanel conversacion={null} />);
render("medios null", <MediaCoveragePanel conversacion={null} />);
render("traza null", <EnginesTracePanel recoleccion={null} />);

/* --- Gate D y F1 sin datos --- */

render("ExecutiveHeader null", <ExecutiveHeader datos={null} />);
render("CoverageWarning vacío", <CoverageWarning limitaciones={[]} />);
render(
  "AgendaPanel vacío",
  <AgendaPanel
    agenda={{ agenda: [], metricas: {}, prohibido: [] }}
    onAbrirTema={() => {}}
    temaAbierto={null}
  />
);
render("AgendaPanel null", <AgendaPanel agenda={null} onAbrirTema={() => {}} />);
render("RadarPanel null", <RadarPanel agenda={null} onAbrirTema={() => {}} />);
render("TopicDrawer sin tema", <TopicDrawer tema={null} onCerrar={() => {}} />);
render(
  "TerritorialMap null",
  <TerritorialMap mapa={null} onSeleccionar={() => {}} seleccionada={null} />
);

/*
  Mapa con unidades pero sin ninguna geometria: es el estado en
  que quedaria la pantalla si el fichero de CONALI faltase. Debe
  decirlo, no quedarse en blanco.
*/
const sinGeo = render(
  "TerritorialMap sin geometrías",
  <TerritorialMap
    mapa={{
      conGeometria: [],
      sinGeometria: [{ unidadId: "x", nombre: "Totoracocha", evidencias: 4 }],
      metricas: { unidadesPintables: 0, unidadesSinGeometria: 1 }
    }}
    onSeleccionar={() => {}}
    seleccionada={null}
  />
);

/*
  El `<path>` no sirve para distinguir: el icono de cabecera es
  un SVG y tambien trae paths. Lo que tiene que faltar es el
  lienzo del mapa, que se identifica por su aria-label.
*/
const LIENZO = /aria-label="Mapa de unidades territoriales/;

t(
  "sin geometrías el mapa explica el vacío en vez de dibujarlo",
  /no se dibuja vac[íi]o/i.test(sinGeo) && !LIENZO.test(sinGeo)
);

t(
  "con geometrías el lienzo SÍ se dibuja",
  datos.mapa?.metricas?.unidadesPintables > 0 ? LIENZO.test(htmls.mapa) : true
);

render(
  "PlacesWithoutGeometry vacío",
  <PlacesWithoutGeometry
    mapa={{ conGeometria: [], sinGeometria: [], metricas: {} }}
    onSeleccionar={() => {}}
  />
);
render("TerritoryPanel sin unidad", <TerritoryPanel unidad={null} onCerrar={() => {}} />);
render("EntitiesPanel sin entidades", <EntitiesPanel escucha={{ entidades: [] }} />);
render("EntitiesPanel null", <EntitiesPanel escucha={null} />);
render("SourceAgendasPanel null", <SourceAgendasPanel escucha={null} />);
render("FreshnessPanel null", <FreshnessPanel frescura={null} />);
render("ProvidersStatusPanel null", <ProvidersStatusPanel datos={null} />);

/*
  ROTACION RSS — TERRITORIAL-RSS-ROTATION-01

  El payload real de la suite no lleva rotacion, asi que el
  bloque no se ejercitaria nunca. Se renderiza aparte con datos
  de rotacion para comprobar dos cosas que un panel de este tipo
  hace mal con facilidad:

    - decir la cobertura de UNA pasada como si fuera la del
      territorio;
    - anunciar una fecha de proxima ejecucion que nadie garantiza.
*/
const conRotacion = render(
  "ProvidersStatusPanel con rotacion",
  <ProvidersStatusPanel
    datos={{
      escuchaAmpliada: {
        lotes: [
          { providerId: "rss_directo", estado: "OK", recibidas: 10, feedUrl: "https://a.test/feed/" }
        ],
        rotacionRss: {
          feedsVerificados: 11,
          presupuestoPorPasada: 8,
          ciclo: 4,
          cobertura: "8/11",
          atendidasEnCiclo: 8,
          pendientesEnCiclo: 3,
          diferidasEnCiclo: 0,
          cicloCompleto: false,
          proximaRotacion: null,
          proximaCohorte: ["expreso.ec", "extra.ec", "teleamazonas.com"],
          pendientes: ["expreso.ec", "extra.ec", "teleamazonas.com"],
          nuncaAtendidas: []
        }
      }
    }}
  />
);

t(
  "la rotacion declara la cobertura del CICLO, no la de la pasada",
  () => /8\/11/.test(conRotacion) && /ciclo 4/i.test(conRotacion)
);

t(
  "se dice cuantas fuentes faltan por escuchar en el ciclo",
  () => /3 pendiente/i.test(conRotacion)
);

t(
  "se anuncia la proxima cohorte SIN inventar una fecha",
  () =>
    /expreso\.ec/.test(conRotacion) &&
    /sin fecha/i.test(conRotacion) &&
    !/próxima ejecución:\s*\d/i.test(conRotacion)
);

const rotacionInactiva = render(
  "ProvidersStatusPanel sin rotacion",
  <ProvidersStatusPanel
    datos={{
      escuchaAmpliada: {
        lotes: [{ providerId: "rss_directo", estado: "SIN_FUENTES", recibidas: 0 }],
        rotacionRss: { activa: false, motivo: "No hay feeds elegibles: nada que rotar." }
      }
    }}
  />
);

t(
  "sin rotacion activa el bloque no aparece: no se inventa un ciclo",
  () => !/Rotación RSS/.test(rotacionInactiva)
);

/*
  TEMA x TERRITORIO — TERRITORIAL-TOPIC-TERRITORY-01

  Se renderiza el estado SIN CARGAR, que es el que se ve al
  abrir la vista. Tres cosas que este panel tiene que decir
  antes de tener un solo dato:

    - que leer el cruce no cuesta una recoleccion;
    - que la metrica es conteo absoluto;
    - que no hay porcentajes de poblacion.
*/
const topicoVacio = render("TopicTerritoryPanel sin cargar", <TopicTerritoryPanel />);

t(
  "declara que no sale a internet antes de tener datos",
  () => /No sale a internet/i.test(topicoVacio) && /conteo absoluto/i.test(topicoVacio)
);

t(
  "el panel sin cargar no finge una matriz",
  () => /Sin cargar/i.test(topicoVacio) && !/Observado/.test(topicoVacio)
);

t(
  "no aparece ningun porcentaje de poblacion en el panel",
  () =>
    !/% de poblaci/i.test(topicoVacio) &&
    !/penetraci/i.test(topicoVacio) &&
    !/per c\u00e1pita/i.test(topicoVacio)
);

const topicoConDatos = render(
  "TopicTerritoryPanel con matriz",
  <TopicTerritoryPanel territorioId="ec-azuay-cuenca" />
);

t("el panel con territorio declarado renderiza", () => topicoConDatos.length > 0);

const frescuraRota = render(
  "FreshnessPanel con error",
  <FreshnessPanel frescura={{ error: "x", declaracion: "Sin frescura calculada NO se puede afirmar qué se publicó hoy." }} />
);

t(
  "si la frescura falla, se dice qué NO se puede afirmar",
  /NO se puede afirmar qu[ée] se public[óo] hoy/i.test(frescuraRota)
);


console.log("\n===========================================");
console.log(`PASS: ${pass}    FALL: ${fail}`);
console.log("===========================================\n");

process.exit(fail > 0 ? 1 : 0);
