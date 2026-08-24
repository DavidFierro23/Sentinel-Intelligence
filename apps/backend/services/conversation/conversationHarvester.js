// apps/backend/services/conversation/conversationHarvester.js

import { buscarGoogleNews } from "../googleNewsService.js";

import {
  buscarWeb,
  crearSesion,
  diagnosticoProveedores
} from "../searchProviderLayer.js";

import { obtenerEventosProyecto } from "../knowledgeLake/lakeQuery.js";
import { normalizarUrl, extraerDominio, limpiarHtml } from "../textUtils.js";

import {
  MODOS_RECOLECCION,
  MODO_POR_DEFECTO,
  PRESUPUESTO,
  ESTADOS_MOTOR,
  SIGNIFICADO_ESTADO,
  TIEMPO_LIMITE,
  permiteAfirmarAusencia
} from "./conversationContracts.js";


/*
-----------------------------------------------------------
LIMITE DE TIEMPO

`googleNewsService` no admite senal de aborto y `rss-parser`
trae 60 s por defecto. No se modifica ese servicio —lo comparte
el osintEngine— sino que se acota AQUI.

La promesa original sigue viva en segundo plano; lo que se
acota es cuanto espera este modulo. Es la unica forma de
limitarlo sin tocar codigo compartido.
-----------------------------------------------------------
*/

function conTiempoLimite(promesa, ms, etiqueta) {
  let temporizador;

  const limite = new Promise((_, rechazar) => {
    temporizador = setTimeout(
      () => rechazar(new Error(`${etiqueta} no respondio en ${ms / 1000}s`)),
      ms
    );
  });

  return Promise.race([promesa, limite]).finally(() =>
    clearTimeout(temporizador)
  );
}

/*
===========================================================
CONVERSATION HARVESTER — recoleccion con coste declarado
===========================================================

Reune la evidencia sobre la que trabajan el extractor de
temas, el clasificador de encuadre y el contador de menciones.

EL PRESUPUESTO NO ES UN DETALLE DE IMPLEMENTACION
-----------------------------------------------------------

SerpAPI da 250 busquedas AL MES. No es un limite por hora que
se recupere esperando: es un saldo. Y ese saldo lo comparte
este modulo con el Discovery Engine, que gasta 6 por
investigacion.

Un modulo territorial que consultara libremente dejaria sin
cuota a la funcion principal de la plataforma, y lo haria sin
que nadie lo notara hasta que empezaran a fallar las
investigaciones.

De ahi tres decisiones:

  1. El modo POR DEFECTO no gasta cuota. Lee el Knowledge Lake
     y los titulares de Google News, que van por RSS gratuito.

  2. El modo `web` exige peticion explicita y tiene tope duro
     de 3 consultas.

  3. El coste se DECLARA en la respuesta, gastado o no. Un
     analista que no sabe cuanto le costo una vista no puede
     decidir si repetirla.

COBERTURA PARCIAL, SIEMPRE DECLARADA
-----------------------------------------------------------

Lo que este modulo devuelve no es "la conversacion publica":
es lo que estas fuentes devolvieron hoy. Google News muestra
una ventana movil de semanas, no un archivo. Si una consulta
se bloquea, la ausencia de resultados NO es ausencia de
hechos: es la misma distincion entre `bloqueado` y `0
resultados` que gobierna el Search Provider Layer.
===========================================================
*/


/*
-----------------------------------------------------------
SEPARAR TITULAR Y PUBLICADOR

Google News entrega el titular como

    «Cortes de agua en Yanuncay - El Mercurio»

y el enlace apunta a `news.google.com`, no al medio. Sin
separar el sufijo, el publicador se pierde por completo:
medido sobre una consulta real de Cuenca, 24 titulares
produjeron UN unico dominio y el registro de medios quedaba
inservible.

Se corta por el ULTIMO " - " y solo si lo que queda detras
parece un nombre de medio: corto, sin puntuacion de frase y
sin digitos sueltos. Un titular como «Obras 2026 - lo que
falta» no debe perder su segunda mitad.
-----------------------------------------------------------
*/

function separarPublicador(titulo) {
  const t = String(titulo || "").trim();

  const corte = t.lastIndexOf(" - ");

  if (corte === -1) return { titulo: t, publicador: null };

  const cola = t.slice(corte + 3).trim();

  const cabeza = t.slice(0, corte).trim();

  /*
    Dos formas validas de nombre de medio, y las dos aparecen
    en el mismo feed:

      «El Comercio Ecuador»   nombre, sin puntuacion de frase
      «elmercurio.com.ec»     dominio

    La primera version rechazaba la segunda por contener
    puntos, y el resultado medido fue que "elmercurio" se
    quedaba dentro del titular y acababa convertido en un tema
    emergente con 4 evidencias. Un medio no es un tema.
  */
  const pareceDominio = /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(cola);

  const pareceNombre =
    !/[.,;:!?]/.test(cola) && cola.split(/\s+/).length <= 6;

  const pareceMedio =
    cola.length >= 3 &&
    cola.length <= 45 &&
    cabeza.length >= 10 &&
    (pareceDominio || pareceNombre);

  return pareceMedio
    ? { titulo: cabeza, publicador: cola }
    : { titulo: t, publicador: null };
}


function normalizarEvidencia(bruto, contexto = {}) {
  const enlace = bruto?.enlace || bruto?.url || bruto?.urlCanonica || null;

  const crudo = limpiarHtml(bruto?.titulo || "");

  /*
    Solo se separa en Google News. En un resultado web el
    titulo es el de la pagina y el dominio ya identifica al
    publicador: cortarlo perderia texto util sin ganar nada.
  */
  const { titulo, publicador } =
    contexto.motorId === "google_news"
      ? separarPublicador(crudo)
      : { titulo: crudo, publicador: null };

  return {
    titulo,
    descripcion: limpiarHtml(bruto?.descripcion || ""),
    enlace,
    dominio: extraerDominio(enlace),
    fecha: bruto?.fecha || bruto?.instante || null,

    /*
      Nombre del medio tal como lo declaro la fuente. El
      registro de medios lo usa para recuperar el dominio real
      cuando el enlace es de un agregador.
    */
    fuenteDeclarada: publicador,

    origen: contexto.origen || bruto?.motor || null,
    motorId: contexto.motorId || bruto?.motorId || null,
    consulta: contexto.consulta || bruto?.consulta || null
  };
}


/*
-----------------------------------------------------------
CONSULTAS

Se construyen desde el AMBITO declarado por el analista, no
desde lo que devuelva ninguna busqueda previa. Es la misma
doctrina del contexto maestro: el territorio lo fija el
analista y no puede ser desplazado por la evidencia.
-----------------------------------------------------------
*/

export function planificarConsultas({ ambito, actores = [], temas = [] } = {}) {
  const territorio = (ambito?.nombre || "").trim();

  /*
    -------------------------------------------------------
    ANCLAJE OBLIGATORIO — el fallo que esto cierra
    -------------------------------------------------------

    Medido en la primera prueba real. La consulta "Cuenca", sin
    mas, devolvio de Google News:

        Feria de San Julian con Morante y Talavante
        Accidente en la A-3 con retenciones
        El eclipse visto desde el Cerro del Socorro

    Todo de CUENCA, ESPANA. Y no por un fallo del buscador:
    "Cuenca" es una ciudad espanola de medio millon de
    resultados y ademas un sustantivo comun.

    Es exactamente el fallo que AUD-001 documento con Pedro
    Palacios —una cronica de ciclismo de Albacete contaminando
    a un alcalde ecuatoriano— trasladado al territorio. Y no lo
    arregla el parametro regional: googleNewsService ya pide
    gl=EC y aun asi llegaron.

    La solucion es la misma que ya funciono alli: el ANCLA
    territorial que declaro el analista entra en la consulta y
    no es opcional. Nunca se emite el nombre del ambito a
    secas.
    -------------------------------------------------------
  */
  const ancestros = (ambito?.ancestros || []).filter(Boolean);

  /* El mas cercano discrimina mas: provincia antes que pais. */
  const anclaPrincipal = ancestros[0] || null;

  const anclaPais = ancestros[ancestros.length - 1] || null;

  const consultas = [];

  const agregar = (texto, etiqueta, prioridad) => {
    const t = String(texto || "").trim();

    if (!t) return;

    if (consultas.some((c) => c.texto.toLowerCase() === t.toLowerCase())) return;

    consultas.push({ texto: t, etiqueta, prioridad, anclada: true });
  };

  if (territorio) {
    if (anclaPrincipal) {
      agregar(`${territorio} ${anclaPrincipal}`, "territorio", 1);
    }

    if (anclaPais && anclaPais !== anclaPrincipal) {
      agregar(`${territorio} ${anclaPais}`, "territorio_pais", 2);
    }

    /*
      El vocabulario de gestion publica acota hacia la
      conversacion que interesa y aleja el ruido deportivo o
      turistico, que fue la otra mitad de la contaminacion
      medida.
    */
    agregar(`${territorio} municipio alcaldia`, "territorio_gestion", 3);

    agregar(`${territorio} concejo cantonal`, "territorio_gobernanza", 5);
  }

  actores.slice(0, 6).forEach((a) => {
    if (!a?.nombre) return;

    const ancla = [territorio, anclaPrincipal].filter(Boolean).join(" ");

    agregar(
      ancla ? `"${a.nombre}" ${ancla}` : `"${a.nombre}"`,
      `actor:${a.id || a.nombre}`,
      4
    );
  });

  temas.slice(0, 3).forEach((t) => {
    const ancla = [territorio, anclaPrincipal].filter(Boolean).join(" ");

    agregar(ancla ? `${ancla} ${t}` : t, `tema:${t}`, 6);
  });

  /*
    SIN NINGUN ANCESTRO ninguna consulta esta realmente
    anclada: el vocabulario de gestion acota el tema, pero no
    el pais. Se marcan todas y se explica, en lugar de dejar
    creer que el resultado esta acotado al territorio correcto.
  */
  if (territorio && !anclaPrincipal && !anclaPais) {
    consultas.forEach((c) => {
      c.anclada = false;

      c.aviso =
        "El ambito no declara provincia ni pais. La consulta no lleva ancla territorial y puede traer homonimos de otros paises: «Cuenca» sin ancla devuelve Cuenca de Espana.";
    });
  }

  return consultas.sort((a, b) => a.prioridad - b.prioridad);
}


/*
===========================================================
RECOLECTAR
===========================================================
*/

export async function recolectar(opciones = {}) {
  const modo = Object.values(MODOS_RECOLECCION).includes(opciones.modo)
    ? opciones.modo
    : MODO_POR_DEFECTO;

  const inicio = Date.now();

  const consultas = planificarConsultas(opciones);

  const evidencias = [];

  const vistas = new Set();

  const registro = [];

  const advertencias = [];

  /*
    Si alguna consulta salio sin ancla territorial, es lo
    primero que hay que saber al leer el resultado: sin ancla
    puede haber homonimos de otro pais dentro del conteo.
  */
  const sinAncla = consultas.filter((c) => c.anclada === false);

  if (sinAncla.length) {
    advertencias.push(
      `${sinAncla.length} consulta(s) sin ancla territorial. ${sinAncla[0].aviso}`
    );
  }

  const costo = {
    consultasWeb: 0,
    consultasNoticias: 0,
    lecturasLake: 0,
    cuotaConsumida: 0,
    topeWeb: PRESUPUESTO.CONSULTAS_WEB_MAXIMAS
  };

  const anexar = (items, contexto) => {
    let nuevas = 0;

    (Array.isArray(items) ? items : []).forEach((bruto) => {
      const e = normalizarEvidencia(bruto, contexto);

      if (!e.titulo && !e.descripcion) return;

      /*
        Dedup por URL canonica. Sin enlace se usa el titulo:
        Google News y un buscador devuelven la misma nota con
        URLs distintas mas veces de las que parece.
      */
      const clave =
        (e.enlace && normalizarUrl(e.enlace)) ||
        `titulo:${e.titulo.toLowerCase().slice(0, 120)}`;

      if (!clave || vistas.has(clave)) return;

      vistas.add(clave);

      evidencias.push(e);

      nuevas += 1;
    });

    return nuevas;
  };

  /*
    ---------------------------------------------------------
    1. KNOWLEDGE LAKE — coste cero, siempre
    ---------------------------------------------------------
  */
  if (opciones.proyectoId) {
    try {
      const lake = await obtenerEventosProyecto(opciones.proyectoId, {
        desde: opciones.desde,
        hasta: opciones.hasta
      });

      costo.lecturasLake += 1;

      const n = anexar(
        (lake?.eventos || []).map((ev) => ({
          titulo: ev.titulo,
          descripcion: ev.descripcion,
          url: ev.urlCanonica,
          fecha: ev.instante
        })),
        { origen: "Knowledge Lake", motorId: "knowledge_lake" }
      );

      registro.push({
        fuente: "knowledge_lake",
        consulta: `proyecto ${opciones.proyectoId}`,
        estado: "OK",
        recibidas: lake?.eventos?.length || 0,
        nuevas: n,
        costoCuota: 0
      });

      if (lake?.huecosDeIngesta?.length) {
        advertencias.push(
          `${lake.huecosDeIngesta.length} hueco(s) de ingesta en el histórico del proyecto. La ausencia de eventos en esos dias no es evidencia de calma.`
        );
      }
    } catch (error) {
      registro.push({
        fuente: "knowledge_lake",
        estado: "ERROR",
        detalle: error?.message || "fallo de lectura",
        recibidas: 0,
        nuevas: 0,
        costoCuota: 0
      });

      advertencias.push(
        `No se pudo leer el histórico del proyecto: ${error?.message || "error"}. La vista se construye solo con lo recolectado ahora.`
      );
    }
  }

  if (modo === MODOS_RECOLECCION.LAKE) {
    return cerrar();
  }

  /*
    ---------------------------------------------------------
    2. GOOGLE NEWS — RSS, sin coste de cuota
    ---------------------------------------------------------
  */
  const paraNoticias = consultas.slice(0, 8);

  const arranqueNoticias = Date.now();

  for (const c of paraNoticias) {
    /*
      Tope global ademas del tope por consulta: cuatro consultas
      lentas pero dentro de su limite individual sumarian 48 s.
    */
    if (Date.now() - arranqueNoticias > TIEMPO_LIMITE.TOTAL_NOTICIAS_MS) {
      registro.push({
        fuente: "google_news",
        consulta: c.texto,
        etiqueta: c.etiqueta,
        estado: ESTADOS_MOTOR.NO_EJECUTADO,
        detalle: `Se alcanzo el tope global de ${
          TIEMPO_LIMITE.TOTAL_NOTICIAS_MS / 1000
        }s para noticias antes de lanzar esta consulta.`,
        recibidas: 0,
        nuevas: 0,
        costoCuota: 0
      });

      continue;
    }

    try {
      const r = await conTiempoLimite(
        buscarGoogleNews(c.texto),
        TIEMPO_LIMITE.NOTICIAS_MS,
        "Google News"
      );

      costo.consultasNoticias += 1;

      const n = anexar(r?.resultados, {
        origen: "Google News",
        motorId: "google_news",
        consulta: c.texto
      });

      const recibidas = r?.total || 0;

      registro.push({
        fuente: "google_news",
        consulta: c.texto,
        etiqueta: c.etiqueta,

        /*
          `SIN_RESULTADOS` y `OK` son estados distintos, y aqui
          la distincion es fragil: googleNewsService devuelve
          `{total:0, resultados:[]}` tanto si no habia noticias
          como si el feed fallo, porque traga la excepcion.

          No se puede resolver desde aqui sin tocar ese servicio
          —lo comparte el osintEngine—, asi que se marca
          SIN_RESULTADOS y se declara la ambiguedad en las
          advertencias. Declarar un limite conocido es mejor que
          fingir una certeza.
        */
        estado: recibidas > 0 ? ESTADOS_MOTOR.OK : ESTADOS_MOTOR.SIN_RESULTADOS,

        recibidas,
        nuevas: n,
        costoCuota: 0
      });
    } catch (error) {
      const esTimeout = /no respondio en/.test(error?.message || "");

      registro.push({
        fuente: "google_news",
        consulta: c.texto,
        etiqueta: c.etiqueta,
        estado: esTimeout ? ESTADOS_MOTOR.TIMEOUT : ESTADOS_MOTOR.ERROR,
        detalle: error?.message || "fallo",
        recibidas: 0,
        nuevas: 0,
        costoCuota: 0
      });

      advertencias.push(
        `Google News: consulta "${c.texto}" ${
          esTimeout ? "agotó el tiempo límite" : "falló"
        }. No se puede afirmar ausencia de publicaciones para esa consulta.`
      );
    }
  }

  const noticiasVacias = registro.filter(
    (r) =>
      r.fuente === "google_news" && r.estado === ESTADOS_MOTOR.SIN_RESULTADOS
  ).length;

  if (noticiasVacias) {
    advertencias.push(
      `${noticiasVacias} consulta(s) de noticias sin resultados. googleNewsService devuelve el mismo objeto vacío si no hubo noticias y si el feed falló, así que en esas consultas no se puede distinguir «sin noticias» de «feed no disponible».`
    );
  }

  if (modo === MODOS_RECOLECCION.NOTICIAS) {
    return cerrar();
  }

  /*
    ---------------------------------------------------------
    3. WEB — gasta cuota. Tope duro.
    ---------------------------------------------------------
  */
  const tope = Math.min(
    Number.isFinite(opciones.maxConsultasWeb)
      ? opciones.maxConsultasWeb
      : PRESUPUESTO.CONSULTAS_WEB_MAXIMAS,
    PRESUPUESTO.CONSULTAS_WEB_MAXIMAS
  );

  const sesion = crearSesion({ tipo: "web" });

  for (const c of consultas.slice(0, tope)) {
    const r = await buscarWeb(c.texto, {
      sesion,
      etiqueta: `conversacion:${c.etiqueta}`,
      limite: 10
    });

    costo.consultasWeb += 1;

    if (r.proveedorUsado) costo.cuotaConsumida += 1;

    const n = anexar(r?.resultados, {
      origen: r?.proveedorUsado?.nombre || "Web",
      motorId: r?.proveedorUsado?.id || null,
      consulta: c.texto
    });

    registro.push({
      fuente: "web",
      consulta: c.texto,
      etiqueta: c.etiqueta,
      estado: r.estado,
      proveedor: r.proveedorUsado?.nombre || null,
      recibidas: r.total || 0,
      nuevas: n,
      costoCuota: r.proveedorUsado ? 1 : 0
    });

    if (r.estado === "Bloqueado") {
      advertencias.push(
        `Consulta "${c.texto}" bloqueada por el proveedor. Bloqueado NO es cero resultados: no se puede afirmar ausencia.`
      );
    }
  }

  return cerrar();


  /*
    ---------------------------------------------------------
    TRAZA DE MOTORES — T-3.1

    Incluye los motores que NO se ejecutaron, y por que. Es lo
    que convierte una respuesta vacia en informacion util: sin
    esto, «0 resultados de Brave» y «Brave no tiene credencial»
    se ven igual, y solo el primero permite afirmar ausencia.
    ---------------------------------------------------------
  */
  function construirTraza() {
    const traza = [];

    const agrupar = (fuente) => {
      const filas = registro.filter((r) => r.fuente === fuente);

      if (filas.length === 0) return null;

      const conError = filas.find(
        (f) =>
          f.estado === ESTADOS_MOTOR.ERROR || f.estado === ESTADOS_MOTOR.TIMEOUT
      );

      const algunOk = filas.some((f) => f.estado === ESTADOS_MOTOR.OK);

      const estado = algunOk
        ? ESTADOS_MOTOR.OK
        : conError
          ? conError.estado
          : filas[0].estado;

      return {
        consultas: filas.filter((f) => f.estado !== ESTADOS_MOTOR.NO_EJECUTADO)
          .length,
        resultados: filas.reduce((s, f) => s + (f.recibidas || 0), 0),
        nuevas: filas.reduce((s, f) => s + (f.nuevas || 0), 0),
        estado,
        error: conError?.detalle || null,
        costoCuota: filas.reduce((s, f) => s + (f.costoCuota || 0), 0)
      };
    };

    /* --- Knowledge Lake --- */
    const lake = agrupar("knowledge_lake");

    traza.push({
      motor: "Knowledge Lake",
      id: "knowledge_lake",
      tipo: "almacen",
      ...(lake || {
        estado: opciones.proyectoId
          ? ESTADOS_MOTOR.NO_EJECUTADO
          : ESTADOS_MOTOR.NO_EJECUTADO,
        consultas: 0,
        resultados: 0,
        nuevas: 0,
        error: null,
        costoCuota: 0
      }),
      motivoSiNoEjecutado: lake
        ? null
        : "No se indico proyectoId: el historico esta particionado por proyecto y sin el no hay nada que leer."
    });

    /* --- Google News --- */
    const news = agrupar("google_news");

    traza.push({
      motor: "Google News (RSS)",
      id: "google_news",
      tipo: "noticias",
      ...(news || {
        estado: ESTADOS_MOTOR.NO_EJECUTADO,
        consultas: 0,
        resultados: 0,
        nuevas: 0,
        error: null,
        costoCuota: 0
      }),
      motivoSiNoEjecutado: news
        ? null
        : `Modo "${modo}": las noticias solo se consultan en modo "noticias" o "web".`
    });

    /* --- Proveedores web del Search Provider Layer --- */
    let diagnostico = { proveedores: [] };

    try {
      diagnostico = diagnosticoProveedores();
    } catch {
      /* El diagnostico no debe poder tumbar la recoleccion. */
    }

    const ejecutadoWeb = modo === MODOS_RECOLECCION.WEB;

    const filasWeb = registro.filter((r) => r.fuente === "web");

    diagnostico.proveedores.forEach((p) => {
      const usado = filasWeb.filter((f) => f.proveedor === p.nombre);

      let estado;

      let motivo = null;

      if (usado.length > 0) {
        estado = usado.some((u) => u.recibidas > 0)
          ? ESTADOS_MOTOR.OK
          : ESTADOS_MOTOR.SIN_RESULTADOS;
      } else if (p.implementado === false) {
        estado = ESTADOS_MOTOR.NO_IMPLEMENTADO;
        motivo = p.detalle;
      } else if (!p.configurado) {
        estado = ESTADOS_MOTOR.SIN_CREDENCIAL;
        motivo = p.detalle;
      } else if (!ejecutadoWeb) {
        estado = ESTADOS_MOTOR.NO_EJECUTADO;
        motivo = `Modo "${modo}": la busqueda web solo se ejecuta en modo "web", que consume saldo.`;
      } else {
        /*
          Configurado, modo web, y aun asi no aparece: la cadena
          de intentos se detuvo antes de llegar a el porque otro
          proveedor de mayor prioridad ya respondio.
        */
        estado = ESTADOS_MOTOR.NO_EJECUTADO;
        motivo =
          "Un proveedor de mayor prioridad respondio primero; la cadena de intentos no llego hasta este.";
      }

      traza.push({
        motor: p.nombre,
        id: p.id,
        tipo: "web",
        estado,
        consultas: usado.length,
        resultados: usado.reduce((s, u) => s + (u.recibidas || 0), 0),
        nuevas: usado.reduce((s, u) => s + (u.nuevas || 0), 0),
        error:
          usado.find((u) => u.estado === "Error" || u.estado === "Bloqueado")
            ?.estado || null,
        costoCuota: usado.reduce((s, u) => s + (u.costoCuota || 0), 0),
        motivoSiNoEjecutado: motivo,
        credencial: p.configurado ? "presente" : "ausente"
      });
    });

    return traza.map((t) => ({
      ...t,
      significado: SIGNIFICADO_ESTADO[t.estado] || null,
      permiteAfirmarAusencia: permiteAfirmarAusencia(t.estado)
    }));
  }


  function cerrar() {
    const conFecha = evidencias.filter((e) => e.fecha).length;

    const traza = construirTraza();

    const sinCobertura = traza.filter((t) => !t.permiteAfirmarAusencia);

    return {
      modo,

      evidencias,

      consultasPlanificadas: consultas,
      registro,

      /*
        Matriz MOTOR | ESTADO | CONSULTAS | RESULTADOS | ERROR.
        Disponible siempre, tambien cuando todo fue bien.
      */
      trazaMotores: traza,

      costo: {
        ...costo,
        declaracion:
          costo.cuotaConsumida > 0
            ? `Esta vista consumio ${costo.cuotaConsumida} busqueda(s) del saldo mensual de SerpAPI.`
            : "Esta vista NO consumio saldo de SerpAPI."
      },

      metricas: {
        evidencias: evidencias.length,
        conFecha,
        sinFecha: evidencias.length - conFecha,

        /*
          DOS CIFRAS, NO UNA.

          El dominio del ENLACE no es el del publicador cuando la
          fuente es un agregador: con Google News, 29 evidencias
          de 9 medios distintos daban `dominiosDistintos: 1`.

          Publicar solo esa cifra contradecia al panel de medios,
          que ya rescata al publicador y mostraba 9. Dos numeros
          distintos para lo mismo en la misma respuesta destruyen
          la confianza en las dos.
        */
        dominiosDelEnlace: new Set(
          evidencias.map((e) => e.dominio).filter(Boolean)
        ).size,

        publicadoresDeclarados: new Set(
          evidencias.map((e) => e.fuenteDeclarada).filter(Boolean)
        ).size,

        notaDominios:
          "«dominios del enlace» cuenta la URL tal cual; con agregadores como Google News colapsa a uno. El publicador real lo resuelve el registro de medios.",

        consultasEjecutadas: registro.filter(
          (r) => r.estado !== ESTADOS_MOTOR.NO_EJECUTADO
        ).length,

        tiempo: `${((Date.now() - inicio) / 1000).toFixed(2)}s`
      },

      advertencias,

      cobertura: {
        parcial: advertencias.length > 0 || sinCobertura.length > 0,

        declaracion:
          "Lo recolectado es lo que estas fuentes devolvieron ahora, no «la conversacion publica». Google News ofrece una ventana movil de semanas, no un archivo historico.",

        fuentesConsultadas: [...new Set(registro.map((r) => r.fuente))],

        /*
          Motores sobre los que NO se puede afirmar ausencia. Es
          la cifra que convierte «no encontramos nada» en «no
          preguntamos a estos».
        */
        motoresSinCobertura: sinCobertura.map((t) => ({
          motor: t.motor,
          estado: t.estado,
          motivo: t.motivoSiNoEjecutado || t.error || t.significado
        }))
      }
    };
  }
}


export default { recolectar, planificarConsultas, MODOS_RECOLECCION };
