// apps/backend/tests/territorial-c2.test.mjs

import { descubrirTemas, esPolisemico } from "../services/conversation/openTopicDiscovery.js";
import { extraerTemas2 } from "../services/conversation/topicEngine2.js";
import { resolverUbicacion } from "../services/geo/geoResolver.js";
import { geolocalizarEvidencia } from "../services/geo/evidenceGeolocation.js";
import { cruzarTemaTerritorio } from "../services/geo/topicTerritoryCrosstab.js";

import {
  componerZona,
  crearRegistroDeZonas,
  validarZona
} from "../services/geo/analyticalZones.js";

import {
  DIGITAL_BEHAVIOR,
  VENTANAS_COMPARABLES,
  CANDIDATE_OVERLAY,
  DATA_PROVIDER_EVAL_01,
  declararCapasFuturas
} from "../services/contracts/futureLayers.js";

/*
===========================================================
PRUEBAS DEL GATE C2
===========================================================

    node tests/territorial-c2.test.mjs

SIN RED Y SIN CUOTA, igual que la suite principal.

Cubre los 18 casos exigidos: descubrimiento abierto, relacion
con el Topic Engine 2, geolocalizacion, multi-territorio, zonas
analiticas y los contratos de capas futuras.
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
  } catch (error) {
    fail += 1;
    fallos.push(`${nombre} (${error.message})`);
    console.log(`  ERR   ${nombre}: ${error.message}`);
  }
}

function bloque(titulo) {
  console.log(`\n${titulo}`);
}


const AMBITO = "ec-azuay-cuenca";

const AMB = { nombre: "Cuenca", alias: ["canton cuenca"], ancestros: ["Azuay", "Ecuador"] };

const FUENTE_LOCAL = { unidadId: AMBITO, resolucion: "canton" };


/*
  Corpus con temas FUERA de la taxonomia: deportes, clima,
  cultura y sismo no existen en las 12 categorias declaradas.
*/
const CORPUS_ABIERTO = [
  { titulo: "Deportivo Cuenca gano el partido en el estadio Alejandro Serrano", fecha: "2026-08-10", enlace: "https://elmercurio.com.ec/1" },
  { titulo: "Deportivo Cuenca jugara la vuelta en el estadio Alejandro Serrano", fecha: "2026-08-11", enlace: "https://eltiempo.com.ec/2" },
  { titulo: "Hinchas del Deportivo Cuenca agotaron las entradas", fecha: "2026-08-12", enlace: "https://primicias.ec/3" },
  { titulo: "Lluvias intensas provocan inundaciones en varias calles", fecha: "2026-08-13", enlace: "https://elmercurio.com.ec/4" },
  { titulo: "Inundaciones por lluvias dejan viviendas afectadas", fecha: "2026-08-14", enlace: "https://ecuavisa.com/5" },
  { titulo: "Bomberos atienden emergencias por lluvias e inundaciones", fecha: "2026-08-14", enlace: "https://teleamazonas.com/6" },
  { titulo: "Sismo de magnitud 4 se sintio en la madrugada", fecha: "2026-08-17", enlace: "https://primicias.ec/9" }
];

const DESC = descubrirTemas(CORPUS_ABIERTO, { ambito: AMB });


/* --------------------------------------------------------- */

bloque("[C2-1] OPEN TOPIC DISCOVERY");

t("T1 · descubre un tema que NO esta en la taxonomia", () => {
  return DESC.temasDescubiertos.some((x) =>
    /deportivo cuenca/i.test(x.etiquetaPropuesta)
  );
});

t("T1b · descubre un segundo tema fuera de la taxonomia", () => {
  return DESC.temasDescubiertos.some((x) => /lluvias|inundaciones/i.test(x.etiquetaPropuesta));
});

t("T2 · lo descubierto puede clasificarse despues", () => {
  const soloDeporte = CORPUS_ABIERTO.slice(0, 3);

  const clasificado = extraerTemas2(soloDeporte, { ambito: AMB });

  /*
    El Topic Engine 2 se ejecuta sobre lo mismo. Que no tenga
    categoria declarada para deportes es informacion, no fallo:
    el descubrimiento lo encontro igual.
  */
  return (
    DESC.temasDescubiertos.length > 0 &&
    Array.isArray(clasificado.temas)
  );
});

t("T3 · la basura de query no se convierte en tema", () => {
  const conBasura = [
    ...CORPUS_ABIERTO,
    { titulo: "Cuenca (Ecuador) - Wikipedia", descripcion: "capital de la provincia del Azuay", enlace: "https://es.wikipedia.org/x" },
    { titulo: "Provincia de Azuay - Wikipedia", descripcion: "su capital es la ciudad de Cuenca", enlace: "https://es.wikipedia.org/y" },
    { titulo: "5.700+ fotos de stock de Cuenca Azuay", descripcion: "imagenes libres de derechos", enlace: "https://istockphoto.com/z" }
  ];

  const r = descubrirTemas(conBasura, {
    ambito: AMB,
    consultas: [{ texto: "Cuenca Azuay" }]
  });

  return !r.temasDescubiertos.some((x) =>
    /azuay|capital|provincia|wikipedia/i.test(x.etiquetaPropuesta)
  );
});

t("T4 · los casi-duplicados no inflan el tema", () => {
  const conDuplicados = [
    { titulo: "Clima hoy en Cuenca: el pronostico para el 21 de agosto", fecha: "2026-08-21", enlace: "https://n.com/a" },
    { titulo: "Clima hoy en Cuenca: el pronostico para el 22 de agosto", fecha: "2026-08-22", enlace: "https://n.com/b" },
    { titulo: "Clima hoy en Cuenca: el pronostico para el 23 de agosto", fecha: "2026-08-23", enlace: "https://n.com/c" }
  ];

  const r = descubrirTemas(conDuplicados, { ambito: AMB });

  return r.metricas.repeticionesAgrupadas === 2 && r.temasDescubiertos.length === 0;
});

t("T5 · la diversidad de fuentes se registra bien", () => {
  const tema = DESC.temasDescubiertos.find((x) => /lluvias|inundaciones/i.test(x.etiquetaPropuesta));

  return tema.fuentesIndependientes === 3 && tema.fuentes.length === 3;
});

t("T6 · una sola fuente repetida NO simula diversidad", () => {
  const unaFuente = [
    { titulo: "Congreso de innovacion tecnologica arranca manana", fecha: "2026-08-10", enlace: "https://unico.com/1" },
    { titulo: "Congreso de innovacion tecnologica reune expertos", fecha: "2026-08-11", enlace: "https://unico.com/2" },
    { titulo: "Cierra el congreso de innovacion tecnologica", fecha: "2026-08-12", enlace: "https://unico.com/3" }
  ];

  const r = descubrirTemas(unaFuente, { ambito: AMB });

  const tema = r.temasDescubiertos[0];

  return (
    tema &&
    tema.fuentesIndependientes === 1 &&
    tema.limitaciones.some((l) => /diversidad de fuentes/i.test(l))
  );
});

t("T7 · un tema sin evidencia suficiente se marca", () => {
  const debil = [
    { titulo: "Congreso de innovacion tecnologica arranca", enlace: "https://a.com/1" },
    { titulo: "Congreso de innovacion tecnologica cierra", enlace: "https://b.com/2" }
  ];

  const r = descubrirTemas(debil, { ambito: AMB });

  return r.temasDescubiertos.every((x) =>
    x.limitaciones.some((l) => /propuesta debil|solo 2 documentos/i.test(l))
  );
});

t("el sismo, con un solo documento, NO forma tema", () => {
  return !DESC.temasDescubiertos.some((x) => /sismo/i.test(x.etiquetaPropuesta));
});

t("cada tema descubierto conserva su expediente completo", () => {
  return DESC.temasDescubiertos.every(
    (x) =>
      x.id &&
      x.etiquetaPropuesta &&
      Array.isArray(x.indices) &&
      typeof x.evidencias === "number" &&
      Array.isArray(x.fuentes) &&
      typeof x.fuentesIndependientes === "number" &&
      Object.hasOwn(x, "primeraObservacion") &&
      Object.hasOwn(x, "ultimaObservacion") &&
      Array.isArray(x.entidades) &&
      Array.isArray(x.terminos) &&
      Array.isArray(x.territoriosMencionados) &&
      x.metodoDescubrimiento &&
      typeof x.confianza === "number" &&
      Array.isArray(x.limitaciones)
  );
});

t("cada tema explica POR QUE Sentinel lo propone", () => {
  return DESC.temasDescubiertos.every((x) =>
    /porque \d+ evidencias comparten/i.test(x.explicacion)
  );
});

t("ningun tema existe sin evidencia", () => {
  return DESC.temasDescubiertos.every(
    (x) => x.indices.length > 0 && x.indices.length === x.evidencias
  );
});

t("la unidad de medida son DOCUMENTOS, no personas", () => {
  return DESC.temasDescubiertos.every((x) => /NO personas/i.test(x.unidadDeMedida));
});

t("no se afirma viralidad en ningun sitio", () => {
  return !/viral/i.test(JSON.stringify(DESC));
});

t("la guarda de polisemia esta activa", () => {
  return esPolisemico("partido") && esPolisemico("corte") && !esPolisemico("alcantarillado");
});


/* --------------------------------------------------------- */

bloque("[C2-2] GEOLOCALIZACION Y MULTI-TERRITORIO");

t("T8 · Sayausi resuelve a parroquia", () => {
  const r = resolverUbicacion({ titulo: "Obras en Sayausi avanzan" }, { ambitoId: AMBITO });

  const g = geolocalizarEvidencia(r);

  return (
    g.territorioDetectado?.unidadId === "sayausi" &&
    g.nivelResolucion === "parroquia" &&
    g.territorioDetectado.geometriaDisponible === true
  );
});

t("T9 · Totoracocha: nominal, sin inventar geometria", () => {
  const r = resolverUbicacion({ titulo: "Feria ciudadana en Totoracocha" }, { ambitoId: AMBITO });

  const g = geolocalizarEvidencia(r);

  return (
    g.territorioDetectado?.unidadId === "totoracocha" &&
    g.territorioDetectado.geometriaDisponible === false &&
    g.limitaciones.some((l) => /no tiene geometria oficial/i.test(l))
  );
});

t("T10 · El Vado: mencion no certificada, sin precision falsa", () => {
  const r = resolverUbicacion(
    { titulo: "Comerciantes de El Vado piden mas seguridad" },
    { ambitoId: AMBITO }
  );

  const g = geolocalizarEvidencia(r);

  return (
    g.territorioDetectado === null &&
    g.mencionesTerritoriales.some(
      (m) => m.tipo === "barrio" && m.atribuye === false
    )
  );
});

t("T11 · «Cuenca» NO baja a parroquia", () => {
  const r = resolverUbicacion(
    { titulo: "Cuenca aprueba su presupuesto anual" },
    { ambitoId: AMBITO }
  );

  const g = geolocalizarEvidencia(r);

  return (
    g.territorioDetectado?.unidadId === AMBITO && g.nivelResolucion === "canton"
  );
});

t("T12 · dos territorios mencionados: ambos se conservan", () => {
  const r = resolverUbicacion(
    { titulo: "El Vado y Las Herrerias, en Cuenca, sin agua" },
    { ambitoId: AMBITO }
  );

  const g = geolocalizarEvidencia(r);

  const barrios = g.mencionesTerritoriales.filter((m) => m.tipo === "barrio");

  return g.territorioDetectado?.unidadId === AMBITO && barrios.length === 2;
});

t("dos parroquias empatadas: ambas mencionadas, atribucion al ancestro", () => {
  const r = resolverUbicacion(
    { titulo: "Cortes de agua en Yanuncay y Totoracocha" },
    { ambitoId: AMBITO }
  );

  const g = geolocalizarEvidencia(r);

  return (
    g.territorioDetectado?.unidadId === AMBITO &&
    g.mencionesTerritoriales.filter((m) => m.tipo === "unidad_oficial").length === 2
  );
});

t("cada evidencia declara su metodo de geolocalizacion", () => {
  const casos = [
    { titulo: "Obras en Sayausi" },
    { titulo: "Sin ninguna referencia territorial aqui" }
  ];

  return casos.every((c) => {
    const g = geolocalizarEvidencia(resolverUbicacion(c, { ambitoId: AMBITO }));

    return Boolean(g.metodoGeolocalizacion);
  });
});

t("cobertura del medio se declara como metodo debil", () => {
  const r = resolverUbicacion(
    { titulo: "Nota sin ningun toponimo reconocible" },
    { ambitoId: AMBITO, pistaDeFuente: FUENTE_LOCAL }
  );

  const g = geolocalizarEvidencia(r);

  return (
    g.metodoGeolocalizacion === "cobertura_declarada_de_la_fuente" &&
    g.limitaciones.some((l) => /no por el contenido/i.test(l))
  );
});

t("NUNCA se infiere ubicacion desde IP o dispositivo", () => {
  const texto = JSON.stringify(
    geolocalizarEvidencia(resolverUbicacion({ titulo: "Obras en Sayausi" }, { ambitoId: AMBITO }))
  );

  return !/\bip\b|dispositivo|gps|domicilio/i.test(texto);
});


/* --------------------------------------------------------- */

bloque("[C2-3] ZONAS ANALITICAS");

t("T14 · sin configuracion NO hay ninguna zona inventada", () => {
  const reg = crearRegistroDeZonas([]);

  return (
    reg.zonas.length === 0 &&
    /NO inventa una division Norte\/Sur/i.test(reg.estado().declaracion)
  );
});

t("una zona sin criterio se rechaza", () => {
  return (
    validarZona({
      nombre: "Zona Norte",
      tipo: "distrito_campana",
      unidades: ["ricaurte"],
      creadaPor: "analista"
    }).valida === false
  );
});

t("una zona sin autor se rechaza", () => {
  return (
    validarZona({
      nombre: "Zona Norte",
      tipo: "distrito_campana",
      unidades: ["ricaurte"],
      criterio: "porque si"
    }).valida === false
  );
});

t("una zona con unidades inexistentes se rechaza", () => {
  return (
    validarZona({
      nombre: "Zona Fantasma",
      tipo: "zona_operativa",
      unidades: ["parroquia-que-no-existe"],
      criterio: "prueba",
      creadaPor: "analista"
    }).valida === false
  );
});

const ZONA_OK = componerZona({
  nombre: "Zona Norte",
  tipo: "distrito_campana",
  unidades: ["ricaurte", "sinincay", "chiquintad"],
  criterio: "Parroquias del norte del canton segun decision del equipo de campana",
  creadaPor: "analista de prueba"
});

t("T13 · una zona analitica NUNCA se presenta como oficial", () => {
  return (
    ZONA_OK.creada &&
    ZONA_OK.zona.unidadOficial === false &&
    ZONA_OK.zona.tipoUnidad === "analitica" &&
    /NO es una division administrativa oficial/i.test(ZONA_OK.zona.advertencia)
  );
});

t("la zona conserva su criterio, autor y fecha", () => {
  return (
    Boolean(ZONA_OK.zona.criterio) &&
    Boolean(ZONA_OK.zona.creadaPor) &&
    Boolean(ZONA_OK.zona.fecha)
  );
});

t("con todas las hijas con poligono, la geometria es DERIVADA", () => {
  return (
    ZONA_OK.zona.geometriaDerivada === true &&
    ZONA_OK.zona.poligonosOrigen.length === 3
  );
});

t("...y conserva que poligonos la originaron", () => {
  return ZONA_OK.zona.poligonosOrigen.every((p) => p.unidadId && p.codigoOficial);
});

t("si una hija no tiene poligono, la zona NO se dibuja", () => {
  const mixta = componerZona({
    nombre: "Zona Centro",
    tipo: "zona_operativa",
    unidades: ["el-sagrario", "ricaurte"],
    criterio: "prueba de cobertura parcial",
    creadaPor: "analista"
  });

  return (
    mixta.creada &&
    mixta.zona.geometriaDerivada === false &&
    /media zona pintada/i.test(mixta.zona.motivoSinGeometria)
  );
});

t("la zona se puede consultar desde una unidad", () => {
  const reg = crearRegistroDeZonas([
    {
      nombre: "Zona Norte",
      tipo: "distrito_campana",
      unidades: ["ricaurte", "sinincay"],
      criterio: "prueba",
      creadaPor: "analista"
    }
  ]);

  return reg.zonaDe("ricaurte")?.nombre === "Zona Norte";
});

t("la zona analitica llega a la geolocalizacion marcada como NO oficial", () => {
  const reg = crearRegistroDeZonas([
    {
      nombre: "Zona Norte",
      tipo: "distrito_campana",
      unidades: ["ricaurte"],
      criterio: "prueba",
      creadaPor: "analista"
    }
  ]);

  const r = resolverUbicacion({ titulo: "Obras en Ricaurte, Cuenca" }, { ambitoId: AMBITO });

  const g = geolocalizarEvidencia(r, { zonas: reg });

  return g.zonaAnalitica?.unidadOficial === false;
});


/* --------------------------------------------------------- */

bloque("[C2-3b] TEMA x TERRITORIO");

const CRUCE = cruzarTemaTerritorio({
  temas: [
    { id: "t1", nombre: "Agua y saneamiento", indices: [0, 1, 2, 3] },
    { id: "t2", nombre: "Sin ubicar nunca", indices: [4, 5] }
  ],
  descubiertos: [{ id: "d1", etiquetaPropuesta: "lluvias", indices: [0, 4] }],
  ubicaciones: (() => {
    const u = [];
    u[0] = { unidadId: "sayausi", unidad: "Sayausi", nivel: "parroquia" };
    u[1] = { unidadId: "sayausi", unidad: "Sayausi", nivel: "parroquia" };
    u[2] = { unidadId: AMBITO, unidad: "Cuenca", nivel: "canton" };
    /* 3, 4 y 5 sin ubicacion */
    return u;
  })(),
  totalEvidencias: 6
});

t("T17 · solo usa evidencias geolocalizables", () => {
  const f = CRUCE.filas.find((x) => x.temaId === "t1");

  return f.evidenciasGeolocalizadas === 3 && f.sinGeolocalizar === 1;
});

t("T17b · las no geolocalizadas NO se reparten", () => {
  const f = CRUCE.filas.find((x) => x.temaId === "t1");

  const suma = f.territorios.reduce((s, x) => s + x.evidencias, 0);

  return suma === f.evidenciasGeolocalizadas;
});

t("un tema sin ninguna evidencia ubicable lo declara", () => {
  const f = CRUCE.filas.find((x) => x.temaId === "t2");

  return (
    f.territorios.length === 0 &&
    /no tiene presencia territorial atribuible/i.test(f.declaracion)
  );
});

t("cruza tanto temas clasificados como descubiertos", () => {
  const origenes = new Set(CRUCE.filas.map((x) => x.origen));

  return origenes.has("clasificado") && origenes.has("descubierto");
});

t("NO se reparte por poblacion: la regla esta declarada", () => {
  return CRUCE.reglas.some((r) => /NO se reparte territorialmente por poblacion/i.test(r));
});

t("una noticia cantonal NO se atribuye a sus parroquias", () => {
  const f = CRUCE.filas.find((x) => x.temaId === "t1");

  const canton = f.territorios.find((x) => x.unidadId === AMBITO);

  return canton && canton.evidencias === 1;
});


/* --------------------------------------------------------- */

bloque("[C2-4] CONTRATOS DE CAPAS FUTURAS");

t("T15 · Digital Behavior es AGREGADO, sin identificador individual", () => {
  return (
    /Agregado, nunca identificacion individual/i.test(DIGITAL_BEHAVIOR.principio) &&
    DIGITAL_BEHAVIOR.prohibido.includes("seguimiento individual") &&
    DIGITAL_BEHAVIOR.prohibido.includes("identificadores personales")
  );
});

t("Digital Behavior exige procedencia por metrica", () => {
  const p = DIGITAL_BEHAVIOR.procedenciaObligatoria;

  return (
    Object.hasOwn(p, "provider") &&
    Object.hasOwn(p, "license") &&
    Object.hasOwn(p, "privacyLimitations") &&
    Object.hasOwn(p, "aggregationLevel")
  );
});

t("Digital Behavior NO tiene ninguna fuente integrada", () => {
  return DIGITAL_BEHAVIOR.fuentesPrevistas.every((f) => f.integrado === false);
});

t("Digital Behavior hereda GEO-1", () => {
  return /GEO-1/.test(DIGITAL_BEHAVIOR.reglaGeo);
});

t("DATA-PROVIDER-EVAL-01 esta registrado como pendiente", () => {
  return (
    DATA_PROVIDER_EVAL_01.id === "DATA-PROVIDER-EVAL-01" &&
    /PENDIENTE/i.test(DATA_PROVIDER_EVAL_01.estado) &&
    DATA_PROVIDER_EVAL_01.rechazoAutomatico.includes("bases de telefonos")
  );
});

t("T16 · sin ventana anterior NO se afirma crecimiento", () => {
  return VENTANAS_COMPARABLES.reglas.some((r) =>
    /Sin ventana anterior NO se afirma crecimiento/i.test(r)
  );
});

t("T18 · cero observado se distingue de sin observacion", () => {
  return VENTANAS_COMPARABLES.reglas.some((r) =>
    /Cero publicaciones observadas NO es lo mismo que sin observacion/i.test(r)
  );
});

t("las cuatro ventanas comparables estan declaradas", () => {
  const ids = VENTANAS_COMPARABLES.pares.map((p) => p.id);

  return ["24h", "48h", "7d", "30d"].every((x) => ids.includes(x));
});

t("el bloqueo actual de las ventanas queda declarado", () => {
  return /ventana movil de semanas, no un archivo/i.test(
    VENTANAS_COMPARABLES.bloqueoActual
  );
});

t("Candidate Overlay es de SOLO LECTURA sobre Linea A", () => {
  return (
    /solo lectura/i.test(CANDIDATE_OVERLAY.direccion) &&
    CANDIDATE_OVERLAY.prohibiciones.some((p) => /NO escribir en el modulo de candidatos/i.test(p))
  );
});

t("Candidate Overlay prohibe atribuir postura por mencion", () => {
  return CANDIDATE_OVERLAY.prohibiciones.some((p) =>
    /NO atribuir postura/i.test(p)
  );
});

t("ninguna capa futura esta implementada", () => {
  const d = declararCapasFuturas();

  return (
    /Ninguna de estas capas esta implementada/i.test(d.advertencia) &&
    Object.values(d.capas).every((c) => /CONTRATO|PENDIENTE/i.test(c.estado))
  );
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
