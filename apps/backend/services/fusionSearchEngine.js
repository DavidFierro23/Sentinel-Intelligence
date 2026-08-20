// apps/backend/services/fusionSearchEngine.js

import { buscarGoogle } from "./googleService.js";
import { buscarGoogleNews } from "./googleNewsService.js";
import { correlacionarIdentidades } from "./identityCorrelationService.js";

import {
  normalizarTexto,
  normalizarUrl,
  extraerDominio,
  detectarPlataformaPorUrl,
  extraerHandle,
  obtenerEnlace,
  textoDeResultado
} from "./textUtils.js";

/*
===========================================================
SENTINEL INTELLIGENCE
FUSION SEARCH ENGINE
===========================================================

  OBJETIVO
    ↓
  PERFIL DE REFERENCIA        (entra ya construido)
    ↓
  MOTORES DE BÚSQUEDA         plan de consultas derivado del perfil
    ↓
  NORMALIZACIÓN               un mismo esquema para todo resultado
    ↓
  DEDUPLICACIÓN               clave = URL normalizada
    ↓
  FUSIÓN                      una evidencia, múltiples orígenes
    ↓
  CORRELACIÓN                 identidades por plataforma + usuario
    ↓
  EVIDENCIAS

PRINCIPIO CENTRAL:

Los motores NO son búsquedas independientes que se acumulan.
Si dos motores devuelven la misma URL, se produce UNA
evidencia con dos orígenes y corroboración reforzada, no dos
hallazgos ni dos identidades.

LÍMITE DE ESTE SPRINT:

No se calcula una puntuación de confianza 0–100. Se PREPARAN
las señales que el Confidence Engine usará después.
===========================================================
*/


/*
-----------------------------------------------------------
REGISTRO DE MOTORES

Declara la disponibilidad REAL de cada motor. Un motor sin
implementación se declara `disponible: false` y no se
invoca: no se simula corroboración inexistente.

ADVERTENCIA DE HONESTIDAD:

`ddg_web` es el único motor web implementado en el proyecto.
El archivo se llama googleService.js por histórico, pero
consulta DuckDuckGo. NO se registra dos veces bajo dos
nombres, porque eso fabricaría una corroboración falsa.

Para añadir un motor nuevo (Bing, Brave, Google CSE) basta
con añadir una entrada aquí con su función `buscar`.
-----------------------------------------------------------
*/

export const MOTORES = [
  {
    id: "ddg_web",
    nombre: "DuckDuckGo Web",
    tipo: "web",
    disponible: true,
    aceptaOperadores: true,

    /*
      LIMITACIÓN DE TASA MEDIDA:

      DuckDuckGo deja de devolver resultados tras unas pocas
      consultas seguidas. Verificado empíricamente: la 1.ª
      consulta responde, la 2.ª y siguientes devuelven una
      página sin resultados.

      Por eso este motor se ejecuta EN SERIE con pausa entre
      consultas, y con un presupuesto reducido.
    */
    intervaloMs: 3500,
    presupuesto: 4,

    buscar: (consulta, opciones) => buscarGoogle(consulta, opciones)
  },
  {
    id: "google_news",
    nombre: "Google News",
    tipo: "noticias",
    disponible: true,
    aceptaOperadores: false,

    /* RSS, sin limitación observada. */
    intervaloMs: 500,
    presupuesto: 3,

    buscar: (consulta) => buscarGoogleNews(consulta)
  },
  {
    id: "bing_web",
    nombre: "Bing Web",
    tipo: "web",
    disponible: false,
    motivo: "Sin implementación en el proyecto. Preparado arquitectónicamente.",
    aceptaOperadores: true,
    intervaloMs: 0,
    presupuesto: 0,
    buscar: null
  }
];


/*
-----------------------------------------------------------
PRESUPUESTO GLOBAL DE CONSULTAS

El presupuesto real por motor está en el registro. Estos
topes acotan el PLAN antes de repartirlo.
-----------------------------------------------------------
*/

const LIMITE_CONSULTAS_WEB = 4;
const LIMITE_CONSULTAS_NOTICIAS = 3;


/*
-----------------------------------------------------------
PLANIFICADOR DE CONSULTAS

Deriva las consultas del PERFIL DE REFERENCIA. Es lo que
diferencia al Fusion Engine de una búsqueda por nombre:
usa términos discriminantes, handles y contexto.

Cada consulta lleva `etiqueta` para poder explicar después
POR QUÉ se ejecutó.
-----------------------------------------------------------
*/

export function planificarConsultas(perfil, objetivo) {
  const nombre = perfil?.nombrePrincipal || String(objetivo ?? "").trim();

  const plan = [];
  const vistas = new Set();

  function agregar(consulta, etiqueta, tipoMotor) {
    const limpia = String(consulta ?? "").trim();

    if (!limpia) return;

    const clave = `${tipoMotor}::${normalizarTexto(limpia)}`;

    if (vistas.has(clave)) return;

    vistas.add(clave);

    plan.push({
      id: `q${plan.length}`,
      consulta: limpia,
      etiqueta,
      tipoMotor
    });
  }

  /*
    1. CONSULTA BASE — nombre principal.
  */
  agregar(`"${nombre}"`, "nombre_principal", "web");
  agregar(nombre, "nombre_principal", "noticias");

  if (!perfil) return plan;

  /*
    2. CONTEXTO — rol y país encontrados en las evidencias.
       Es lo que separa a un homónimo del objetivo.
  */
  const contexto = perfil.contexto || {};

  const piezasContexto = [contexto.rol, contexto.pais].filter(Boolean);

  if (piezasContexto.length) {
    agregar(
      `"${nombre}" ${piezasContexto.join(" ")}`,
      "nombre_mas_contexto",
      "web"
    );
  }

  /*
    3. TÉRMINOS DISCRIMINANTES — los más corroborados.
  */
  const terminos = (perfil.terminosDiscriminantes || [])
    .filter((t) => t.termino && (t.fuentes || []).length > 0)
    .slice(0, 3);

  terminos.forEach((t) => {
    agregar(
      `"${nombre}" ${t.termino}`,
      `termino_discriminante:${t.termino}`,
      "web"
    );
  });

  if (terminos.length >= 2) {
    agregar(
      `${nombre} ${terminos[0].termino}`,
      "noticias_con_discriminante",
      "noticias"
    );
  }

  /*
    4. HANDLES OBSERVADOS — buscar por usuario, no por nombre.
       Este es el objetivo declarado del Perfil de Referencia.
  */
  const handles = (perfil.handlesObservados || []).slice(0, 3);

  handles.forEach((h) => {
    agregar(`"${h.handle}"`, `handle_observado:${h.handle}`, "web");
  });

  /*
    5. VARIANTES DE HANDLE que aún no se han observado.
       Solo si quedan consultas disponibles.
  */
  const handlesVistos = new Set(
    handles.map((h) => normalizarTexto(h.handle))
  );

  (perfil.variantes?.handle || [])
    .filter((v) => !handlesVistos.has(normalizarTexto(v)))
    .slice(0, 2)
    .forEach((v) => {
      agregar(`"${v}"`, `variante_handle:${v}`, "web");
    });

  /*
    6. DOMINIOS RELEVANTES — acotar al dominio ya visto.
  */
  const dominios = (perfil.dominiosRelevantes || [])
    .filter((d) => d.valor && !d.valor.includes("google.com"))
    .slice(0, 2);

  dominios.forEach((d) => {
    agregar(
      `site:${d.valor} "${nombre}"`,
      `dominio_relevante:${d.valor}`,
      "web"
    );
  });

  /*
    7. VARIANTES DE NOMBRE distintas del principal.
  */
  (perfil.variantes?.nombre || [])
    .filter((v) => normalizarTexto(v) !== normalizarTexto(nombre))
    .slice(0, 1)
    .forEach((v) => {
      agregar(`"${v}"`, `variante_nombre:${v}`, "web");
    });

  /*
    Aplicar el presupuesto por tipo de motor.
  */
  const web = plan.filter((p) => p.tipoMotor === "web").slice(0, LIMITE_CONSULTAS_WEB);

  const noticias = plan
    .filter((p) => p.tipoMotor === "noticias")
    .slice(0, LIMITE_CONSULTAS_NOTICIAS);

  return [...web, ...noticias];
}


/*
-----------------------------------------------------------
NORMALIZACIÓN

Todo resultado, venga del motor que venga, adopta el MISMO
esquema. Es el requisito previo de la deduplicación.
-----------------------------------------------------------
*/

export function normalizarResultado(bruto, contexto = {}) {
  if (!bruto) return null;

  const urlOriginal = obtenerEnlace(bruto);

  if (!urlOriginal) return null;

  const urlNormalizada = normalizarUrl(urlOriginal);

  if (!urlNormalizada) return null;

  const plataforma = detectarPlataformaPorUrl(urlOriginal);

  const descripcion =
    typeof bruto.descripcion === "string" ? bruto.descripcion.trim() : "";

  return {
    /* ---- identidad del hallazgo ---- */
    url: urlOriginal,
    urlNormalizada,
    dominio: extraerDominio(urlOriginal),

    /* ---- contenido ---- */
    titulo: (bruto.titulo || "").trim(),
    descripcion,
    snippetDisponible:
      typeof bruto.snippetDisponible === "boolean"
        ? bruto.snippetDisponible
        : Boolean(descripcion),
    fecha: bruto.fecha || null,

    /* ---- clasificación ---- */
    plataforma: plataforma?.nombre || null,
    plataformaId: plataforma?.id || null,
    tipoPlataforma: plataforma?.tipo || null,
    handle:
      plataforma && (plataforma.tipo === "social" || plataforma.tipo === "video")
        ? extraerHandle(urlOriginal)
        : null,

    /* ---- procedencia ---- */
    motorId: contexto.motorId || bruto.motorId || null,
    motorNombre: contexto.motorNombre || bruto.motor || null,
    consulta: contexto.consulta || bruto.consulta || null,
    etiquetaConsulta: contexto.etiqueta || null
  };
}


/*
-----------------------------------------------------------
SEÑALES PARA EL CONFIDENCE ENGINE

Se PREPARAN, no se puntúan. El sprint siguiente decidirá
cuánto vale cada una.
-----------------------------------------------------------
*/

function calcularSenales(evidencia, perfil) {
  const nombre = normalizarTexto(perfil?.nombrePrincipal || "");

  const titulo = normalizarTexto(evidencia.titulo);
  const snippet = normalizarTexto(evidencia.descripcion);
  const texto = `${titulo} ${snippet}`;

  const variantesNombre = (perfil?.variantes?.nombre || []).filter((v) =>
    texto.includes(normalizarTexto(v))
  );

  const variantesHandle = (perfil?.variantes?.handle || []).filter(
    (v) =>
      evidencia.handle &&
      normalizarTexto(evidencia.handle) === normalizarTexto(v)
  );

  const terminosPresentes = (perfil?.terminosDiscriminantes || [])
    .filter((t) => texto.includes(normalizarTexto(t.termino)))
    .map((t) => t.termino);

  const contexto = perfil?.contexto || {};

  const contextoPresente = [contexto.rol, contexto.pais]
    .filter(Boolean)
    .filter((c) => texto.includes(normalizarTexto(c)));

  const dominiosPerfil = new Set(
    (perfil?.dominiosRelevantes || []).map((d) => d.valor)
  );

  return {
    nombreEnTitulo: Boolean(nombre) && titulo.includes(nombre),
    nombreEnSnippet: Boolean(nombre) && snippet.includes(nombre),
    variantesNombreCoincidentes: variantesNombre,
    handleCoincideConVariante: variantesHandle.length > 0,
    terminosDiscriminantesPresentes: terminosPresentes,
    contextoPresente,
    dominioYaConocido: dominiosPerfil.has(evidencia.dominio),
    esPlataformaSocial:
      evidencia.tipoPlataforma === "social" ||
      evidencia.tipoPlataforma === "video",
    tieneSnippetReal: evidencia.snippetDisponible,
    tieneFecha: Boolean(evidencia.fecha)
  };
}


/*
-----------------------------------------------------------
FUSIÓN

Deduplica por URL normalizada y acumula orígenes.

REGLA: una misma URL encontrada por N motores o por M
consultas produce UNA evidencia con N motores y M consultas.
-----------------------------------------------------------
*/

export function fusionar(normalizados, perfil) {
  const mapa = new Map();

  let descartadosPorFusion = 0;

  normalizados.forEach((item) => {
    if (!item) return;

    const clave = item.urlNormalizada;

    if (!mapa.has(clave)) {
      mapa.set(clave, {
        id: `fx-${mapa.size}`,

        url: item.url,
        urlNormalizada: clave,
        dominio: item.dominio,

        titulo: item.titulo,
        descripcion: item.descripcion,
        snippetDisponible: item.snippetDisponible,
        fecha: item.fecha,

        plataforma: item.plataforma,
        plataformaId: item.plataformaId,
        tipoPlataforma: item.tipoPlataforma,
        handle: item.handle,

        motores: new Map(),
        consultas: [],
        urlsVistas: new Set([item.url]),

        apariciones: 0
      });
    }

    const evidencia = mapa.get(clave);

    if (evidencia.apariciones > 0) descartadosPorFusion += 1;

    evidencia.apariciones += 1;

    evidencia.urlsVistas.add(item.url);

    /*
      Motor de origen — sin duplicar.
    */
    if (item.motorId && !evidencia.motores.has(item.motorId)) {
      evidencia.motores.set(item.motorId, {
        id: item.motorId,
        nombre: item.motorNombre
      });
    }

    /*
      Consulta que lo encontró — sin duplicar.
    */
    const yaRegistrada = evidencia.consultas.some(
      (c) => c.consulta === item.consulta && c.motorId === item.motorId
    );

    if (!yaRegistrada) {
      evidencia.consultas.push({
        consulta: item.consulta,
        etiqueta: item.etiquetaConsulta,
        motorId: item.motorId
      });
    }

    /*
      ENRIQUECIMIENTO: se conserva el mejor dato disponible.
      Un motor puede traer snippet y otro no; un motor puede
      traer fecha y otro no.
    */
    if (!evidencia.snippetDisponible && item.snippetDisponible) {
      evidencia.descripcion = item.descripcion;
      evidencia.snippetDisponible = true;
    }

    if (!evidencia.fecha && item.fecha) evidencia.fecha = item.fecha;

    if (!evidencia.titulo && item.titulo) evidencia.titulo = item.titulo;

    if (!evidencia.handle && item.handle) evidencia.handle = item.handle;
  });

  const evidencias = [...mapa.values()]
    .map((e) => {
      const motores = [...e.motores.values()];

      const salida = {
        ...e,
        motores,
        totalMotores: motores.length,
        totalConsultas: e.consultas.length,
        corroboracionMultiMotor: motores.length > 1,
        corroboracionMultiConsulta: e.consultas.length > 1,
        urlsVistas: [...e.urlsVistas]
      };

      salida.senales = calcularSenales(salida, perfil);

      return salida;
    })
    .sort((a, b) => {
      if (b.totalMotores !== a.totalMotores) return b.totalMotores - a.totalMotores;
      if (b.totalConsultas !== a.totalConsultas) return b.totalConsultas - a.totalConsultas;
      return b.apariciones - a.apariciones;
    });

  return { evidencias, descartadosPorFusion };
}


/*
-----------------------------------------------------------
EJECUTOR CON CONCURRENCIA LIMITADA
-----------------------------------------------------------
*/

function pausa(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


/*
  EJECUCIÓN RESPETANDO EL LÍMITE DE CADA MOTOR.

  Motores distintos corren EN PARALELO (no comparten cuota).
  Las consultas de un mismo motor corren EN SERIE con la
  pausa declarada en el registro.

  Lanzar todo en paralelo es lo que provocaba que DuckDuckGo
  devolviera 0 resultados en 7 consultas.
*/
const BLOQUEOS_PARA_ABRIR_CIRCUITO = 2;

async function ejecutarPorMotor(tareasPorMotor) {
  const porMotor = [...tareasPorMotor.entries()].map(
    async ([, { motor, tareas }]) => {
      const salidas = [];

      let bloqueosSeguidos = 0;

      for (let i = 0; i < tareas.length; i += 1) {
        /*
          CORTACIRCUITOS

          Si el motor ya devolvió N respuestas bloqueadas
          seguidas, las consultas restantes también lo
          estarán. Se abortan y se declaran omitidas, en
          lugar de gastar segundos de espera.
        */
        if (bloqueosSeguidos >= BLOQUEOS_PARA_ABRIR_CIRCUITO) {
          salidas.push({
            status: "fulfilled",
            value: {
              motor,
              entrada: null,
              respuesta: null,
              omitidaPorCircuito: true
            }
          });

          continue;
        }

        if (i > 0 && motor.intervaloMs) {
          await pausa(motor.intervaloMs);
        }

        try {
          const valor = await tareas[i]();

          if (valor?.respuesta?.bloqueado) bloqueosSeguidos += 1;
          else bloqueosSeguidos = 0;

          salidas.push({ status: "fulfilled", value: valor });
        } catch (error) {
          salidas.push({ status: "rejected", reason: error });
        }
      }

      return salidas;
    }
  );

  const resultados = await Promise.all(porMotor);

  return resultados.flat();
}


/*
-----------------------------------------------------------
AGRUPAR VALORES (plataformas, dominios)
-----------------------------------------------------------
*/

function agrupar(evidencias, extraer) {
  const mapa = new Map();

  evidencias.forEach((e) => {
    const valor = extraer(e);

    if (!valor) return;

    if (!mapa.has(valor)) {
      mapa.set(valor, { valor, evidencias: 0, motores: new Set() });
    }

    const registro = mapa.get(valor);

    registro.evidencias += 1;

    e.motores.forEach((m) => registro.motores.add(m.nombre));
  });

  return [...mapa.values()]
    .map((r) => ({
      valor: r.valor,
      evidencias: r.evidencias,
      motores: [...r.motores]
    }))
    .sort((a, b) => b.evidencias - a.evidencias);
}


/*
===========================================================
FUNCIÓN PRINCIPAL
===========================================================
*/

export async function ejecutarFusion(objetivo, perfil, opciones = {}) {
  const inicio = Date.now();

  const plan = planificarConsultas(perfil, objetivo);

  const disponibles = MOTORES.filter((m) => m.disponible && m.buscar);

  const noDisponibles = MOTORES.filter((m) => !m.disponible).map((m) => ({
    id: m.id,
    nombre: m.nombre,
    disponible: false,
    motivo: m.motivo || "No disponible"
  }));

  /*
    Emparejar cada consulta con los motores compatibles.
  */
  const tareasPorMotor = new Map();

  let totalTareas = 0;

  /*
    Consultas que el llamador YA ejecutó (descubrimiento
    general). Repetirlas gastaría cuota de un motor limitado
    para obtener resultados que ya tenemos.
  */
  const yaEjecutadas = new Set(
    (opciones.consultasYaEjecutadas || []).map((c) => normalizarTexto(c))
  );

  const omitidas = [];

  plan.forEach((entrada) => {
    /*
      Una consulta entrecomillada del nombre equivale a la
      búsqueda simple del nombre ya realizada.
    */
    const sinComillas = normalizarTexto(entrada.consulta.replace(/"/g, ""));

    if (yaEjecutadas.has(sinComillas)) {
      omitidas.push({
        ...entrada,
        motivo: "ya ejecutada en el descubrimiento general"
      });

      return;
    }

    disponibles
      .filter((motor) => motor.tipo === entrada.tipoMotor)
      .forEach((motor) => {
        if (!tareasPorMotor.has(motor.id)) {
          tareasPorMotor.set(motor.id, { motor, tareas: [] });
        }

        const registro = tareasPorMotor.get(motor.id);

        /*
          Presupuesto por motor: no se le envían más
          consultas de las que tolera.
        */
        if (registro.tareas.length >= (motor.presupuesto || 1)) return;

        registro.tareas.push(async () => {
          const respuesta = await motor.buscar(entrada.consulta, {
            etiqueta: entrada.etiqueta
          });

          return { motor, entrada, respuesta };
        });

        totalTareas += 1;
      });
  });

  const resueltas = await ejecutarPorMotor(tareasPorMotor);

  /*
    NORMALIZACIÓN
  */
  const normalizados = [];

  const estadoMotores = new Map();

  disponibles.forEach((m) =>
    estadoMotores.set(m.id, {
      id: m.id,
      nombre: m.nombre,
      tipo: m.tipo,
      disponible: true,
      consultasEjecutadas: 0,
      consultasBloqueadas: 0,
      consultasFallidas: 0,
      consultasOmitidasPorCircuito: 0,
      resultadosBrutos: 0,
      intervaloMs: m.intervaloMs || 0
    })
  );

  resueltas.forEach((resultado) => {
    if (resultado.status !== "fulfilled" || !resultado.value) return;

    const { motor, entrada, respuesta, omitidaPorCircuito } = resultado.value;

    const estado = estadoMotores.get(motor.id);

    if (omitidaPorCircuito) {
      if (estado) estado.consultasOmitidasPorCircuito += 1;

      return;
    }

    if (estado) {
      estado.consultasEjecutadas += 1;

      /*
        Un bloqueo NO es "0 resultados": es una consulta que
        no se pudo realizar. Se reporta por separado.
      */
      if (respuesta?.bloqueado) estado.consultasBloqueadas += 1;
    }

    const brutos = Array.isArray(respuesta?.resultados) ? respuesta.resultados : [];

    if (estado) estado.resultadosBrutos += brutos.length;

    brutos.forEach((bruto) => {
      const normalizado = normalizarResultado(bruto, {
        motorId: motor.id,
        motorNombre: motor.nombre,
        consulta: entrada.consulta,
        etiqueta: entrada.etiqueta
      });

      if (normalizado) normalizados.push(normalizado);
    });
  });

  resueltas.forEach((resultado) => {
    if (resultado.status === "rejected") {
      console.error("[fusion] consulta fallida:", resultado.reason?.message);
    }
  });

  /*
    Resultados adicionales que el llamador ya obtuvo
    (descubrimiento general). Se fusionan en el mismo espacio
    para que una URL ya vista no cuente dos veces.
  */
  (opciones.resultadosPrevios || []).forEach((bruto) => {
    const normalizado = normalizarResultado(bruto, {
      motorId: bruto.__motorId || "descubrimiento",
      motorNombre: bruto.__origen || "Descubrimiento general",
      consulta: bruto.consulta || objetivo,
      etiqueta: "descubrimiento_general"
    });

    if (normalizado) normalizados.push(normalizado);
  });

  /*
    DEDUPLICACIÓN + FUSIÓN
  */
  const { evidencias, descartadosPorFusion } = fusionar(normalizados, perfil);

  /*
    CORRELACIÓN — reutiliza el servicio existente.
  */
  const identidades = correlacionarIdentidades(
    evidencias.map((e) => ({
      titulo: e.titulo,
      descripcion: e.descripcion,
      enlace: e.url,
      __origen: e.motores.map((m) => m.nombre).join(" + ") || "Fusion"
    }))
  );

  const tiempo = ((Date.now() - inicio) / 1000).toFixed(2);

  return {
    version: "1.0",

    objetivo: perfil?.nombrePrincipal || objetivo,

    /*
      Qué se usó del Perfil de Referencia.
    */
    perfilUsado: perfil
      ? {
          nombrePrincipal: perfil.nombrePrincipal,
          variantesNombre: perfil.variantes?.nombre || [],
          variantesHandle: perfil.variantes?.handle || [],
          terminosDiscriminantes: (perfil.terminosDiscriminantes || [])
            .slice(0, 5)
            .map((t) => t.termino),
          handlesObservados: (perfil.handlesObservados || []).map((h) => h.handle),
          contexto: {
            rol: perfil.contexto?.rol || null,
            pais: perfil.contexto?.pais || null
          },
          confianzaPerfil: perfil.confianza?.global ?? null
        }
      : null,

    plan,

    consultasOmitidas: omitidas,

    motores: [...estadoMotores.values(), ...noDisponibles],

    evidencias,

    plataformas: agrupar(evidencias, (e) => e.plataforma),

    dominios: agrupar(evidencias, (e) => e.dominio),

    identidades,

    /*
      Aviso operativo cuando un motor fue limitado: sin esto,
      una investigación degradada parecería completa.
    */
    advertencias: [...estadoMotores.values()]
      .filter((e) => e.consultasBloqueadas > 0)
      .map(
        (e) =>
          `${e.nombre}: ${e.consultasBloqueadas} de ${e.consultasEjecutadas} consultas ` +
          `sin respuesta por limitación de tasa del proveedor. Cobertura parcial.`
      ),

    metricas: {
      consultasPlanificadas: plan.length,
      consultasEjecutadas: totalTareas,
      consultasBloqueadas: [...estadoMotores.values()].reduce(
        (suma, e) => suma + e.consultasBloqueadas,
        0
      ),
      resultadosBrutos: normalizados.length,
      evidenciasUnicas: evidencias.length,
      duplicadosFusionados: descartadosPorFusion,
      tasaDeduplicacion:
        normalizados.length > 0
          ? `${((descartadosPorFusion / normalizados.length) * 100).toFixed(1)}%`
          : "0%",
      evidenciasMultiMotor: evidencias.filter((e) => e.corroboracionMultiMotor).length,
      evidenciasMultiConsulta: evidencias.filter((e) => e.corroboracionMultiConsulta)
        .length,
      evidenciasConSnippetReal: evidencias.filter((e) => e.snippetDisponible).length,
      identidadesDetectadas: identidades.length,
      tiempo: `${tiempo}s`
    },

    /*
      Aviso explícito: la puntuación es del sprint siguiente.
    */
    pendiente:
      "Puntuación de correspondencia 0–100: Confidence Engine (sprint siguiente). Las señales por evidencia ya están calculadas en `senales`.",

    generadoEn: new Date().toISOString()
  };
}
