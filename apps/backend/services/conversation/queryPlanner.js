// apps/backend/services/conversation/queryPlanner.js

/*
===========================================================
QUERY PLANNER — escucha abierta con ancla obligatoria
===========================================================

Genera el plan de consultas de un territorio. Sustituye a la
lista de cuatro consultas que traia el recolector, que producia
este reparto medido sobre Cuenca:

    Cuenca Azuay                 8 evidencias   neutral
    Cuenca Ecuador               8 evidencias   neutral
    Cuenca municipio alcaldia    6 evidencias   GESTION
    Cuenca concejo cantonal      8 evidencias   GESTION

El 50 % de las consultas y el 47 % de la evidencia entraban por
vocabulario de gestion publica. Despues el motor descubria que
«en Cuenca se habla de gestion publica», que es lo que se le
habia preguntado.

EL SESGO NO SE ARREGLA EN EL RANKING
-----------------------------------------------------------

Reordenar la salida para bajar los temas de gestion seria
falsificar dos veces: una al pedir el corpus inclinado y otra al
disimularlo. Lo que se corrige es LA ENTRADA.

DOS REGLAS
-----------------------------------------------------------

1. ANCLA OBLIGATORIA. Ninguna consulta sale sin ancla
   territorial. Medido en la primera prueba real, «Cuenca» a
   secas devolvio la feria de San Julian, la A-3 y el Cerro del
   Socorro: Cuenca de ESPANA. El parametro gl=EC no basta
   porque «cuenca» tambien es un sustantivo comun.

2. LA AGENDA GENERAL SE CONSTRUYE CON CORPUS NEUTRAL. Las
   consultas tematicas siguen existiendo —un analista que
   investiga movilidad necesita preguntar por movilidad— pero
   NO definen «lo que habla Cuenca». Se marcan y el consumidor
   decide.

POR QUE UN GENERADOR Y NO UNA LISTA MAS LARGA
-----------------------------------------------------------

Una lista de treinta consultas escritas a mano seria el mismo
problema con mas texto: sigue siendo la opinion de quien la
escribio sobre que es relevante, y no se puede reutilizar en
Gualaceo ni en Loja.

El generador compone desde piezas declaradas —ancla, variante,
tiempo, tipo de fuente, terminos opcionales— y cada consulta
sabe de que pieza salio. Eso permite medir el sesgo en lugar de
discutirlo.
===========================================================
*/


export const TIPOS_CONSULTA = Object.freeze({
  /*
    Solo ancla territorial, sin vocabulario que oriente el tema.
    Es el unico tipo que puede sostener la Agenda General.
  */
  NEUTRAL: "QUERY_NEUTRAL",

  /* Lleva vocabulario de un dominio. Acota, y por tanto sesga. */
  TEMATICA: "QUERY_TEMATICA",

  /* Persona u organizacion concreta. */
  ACTOR: "QUERY_ACTOR",

  /* Institucion publica concreta. */
  INSTITUCIONAL: "QUERY_INSTITUCIONAL",

  /* Dirigida a un medio identificado. */
  MEDIA: "QUERY_MEDIA",

  /* Dirigida a creadores y plataformas de video/social. */
  CREATOR: "QUERY_CREATOR"
});


/*
-----------------------------------------------------------
QUE TIPOS PUEDEN SOSTENER LA AGENDA GENERAL

Solo el neutral. Los demas responden a una pregunta que alguien
formulo; su respuesta no es «lo que pasa», es «lo que pasa sobre
esto».
-----------------------------------------------------------
*/

export const TIPOS_AGENDA_GENERAL = Object.freeze([TIPOS_CONSULTA.NEUTRAL]);


/*
-----------------------------------------------------------
VARIANTES NEUTRAS

Sin sustantivos de dominio. «hoy», «noticias» y «actualidad»
son marcadores de recencia y de genero periodistico, no de
tema: no inclinan hacia gestion, ni hacia deporte, ni hacia
cultura.

`""` es la variante vacia: territorio + ancla y nada mas.
-----------------------------------------------------------
*/

export const VARIANTES_NEUTRAS = Object.freeze([
  "",
  "hoy",
  "noticias",
  "actualidad",
  "qué pasa"
]);


/*
-----------------------------------------------------------
VOCABULARIO DE GESTION — declarado para poder MEDIRLO

Esta lista no filtra consultas: las etiqueta. Sirve para que
`medirSesgo()` devuelva un numero en lugar de una impresion, y
para que una consulta tematica no pueda colarse como neutral
por descuido de quien la escriba.
-----------------------------------------------------------
*/

const VOCABULARIO_GESTION =
  /\b(municipio|municipal|alcald\w*|concejo|cantonal|gesti[oó]n|gobernanza|prefect\w*|gad|obra p[uú]blica|ordenanza|presupuesto)\b/i;


export function llevaVocabularioDeGestion(texto) {
  return VOCABULARIO_GESTION.test(String(texto || ""));
}


/*
-----------------------------------------------------------
TIEMPO

Google News no da archivo historico: su ventana es movil y de
pocas semanas. Declarar la ventana pedida permite dos cosas que
hoy no se pueden hacer: comparar dos ejecuciones que pidieron lo
mismo, y no atribuir a «calma» lo que es «fuera de ventana».
-----------------------------------------------------------
*/

export const VENTANAS = Object.freeze({
  DIA: { id: "24h", dias: 1, etiqueta: "últimas 24 horas" },
  SEMANA: { id: "7d", dias: 7, etiqueta: "últimos 7 días" },
  QUINCENA: { id: "15d", dias: 15, etiqueta: "últimos 15 días" },
  MES: { id: "30d", dias: 30, etiqueta: "últimos 30 días" },
  TRIMESTRE: { id: "90d", dias: 90, etiqueta: "últimos 90 días" }
});


/*
-----------------------------------------------------------
TIPO DE FUENTE BUSCADO

No es un filtro del buscador —Google News no lo acepta— sino la
INTENCION declarada de la consulta. Sirve para separar despues
el corpus por agenda sin tener que adivinar de donde salio cada
evidencia.
-----------------------------------------------------------
*/

export const DESTINOS = Object.freeze({
  CUALQUIERA: "cualquiera",
  NOTICIAS: "noticias",
  INSTITUCIONAL: "institucional",
  SOCIAL: "social",
  VIDEO: "video"
});


function normalizar(t) {
  return String(t || "")
    .trim()
    .replace(/\s+/g, " ");
}


/*
===========================================================
PLANIFICAR
===========================================================

Devuelve consultas ORDENADAS por prioridad, cada una con:

    texto        lo que se envia al motor
    tipo         TIPOS_CONSULTA
    etiqueta     identificador estable para la traza
    prioridad    1 = primero
    anclada      si lleva ancla territorial real
    destino      tipo de fuente buscado
    ventana      ventana temporal pedida
    piezas       de que se compuso, para auditarla
    sesgoDeclarado  si lleva vocabulario de dominio

El orden importa: los motores tienen tope de consultas, asi que
lo que va primero es lo que efectivamente se ejecuta. Las
neutras van primero POR ESO, no por elegancia.
===========================================================
*/

export function planificarConsultasAbiertas({
  ambito = null,
  actores = [],
  temas = [],
  instituciones = [],
  ventana = VENTANAS.MES,
  maxNeutrales = 5,
  incluirCreadores = true
} = {}) {
  const territorio = normalizar(ambito?.nombre);

  const ancestros = (ambito?.ancestros || []).filter(Boolean);

  /* El mas cercano discrimina mas: provincia antes que pais. */
  const anclaPrincipal = ancestros[0] || null;

  const anclaPais = ancestros[ancestros.length - 1] || null;

  const consultas = [];

  const agregar = (spec) => {
    const texto = normalizar(spec.texto);

    if (!texto) return;

    if (consultas.some((c) => c.texto.toLowerCase() === texto.toLowerCase())) {
      return;
    }

    consultas.push({
      texto,
      tipo: spec.tipo,
      etiqueta: spec.etiqueta,
      prioridad: spec.prioridad,
      destino: spec.destino || DESTINOS.CUALQUIERA,
      ventana: { id: ventana.id, dias: ventana.dias, etiqueta: ventana.etiqueta },
      anclada: Boolean(anclaPrincipal || anclaPais),
      piezas: spec.piezas,

      /*
        Una consulta NEUTRAL que lleve vocabulario de gestion
        esta mal construida. Se declara en lugar de corregirse
        en silencio: si aparece, es un fallo del generador y hay
        que verlo.
      */
      sesgoDeclarado: llevaVocabularioDeGestion(texto)
        ? "vocabulario_de_gestion"
        : null
    });
  };

  if (!territorio) return [];

  /*
    ---------------------------------------------------------
    1. NEUTRALES — el nucleo de la escucha abierta
    ---------------------------------------------------------

    Prioridad 1..N para que se ejecuten siempre, aunque el tope
    del motor recorte el resto del plan.
  */
  const anclas = [anclaPrincipal, anclaPais].filter(
    (a, i, arr) => a && arr.indexOf(a) === i
  );

  let p = 1;

  VARIANTES_NEUTRAS.slice(0, Math.max(1, maxNeutrales)).forEach((variante, i) => {
    /*
      La variante vacia se combina con TODAS las anclas —es la
      consulta mas limpia y conviene tenerla por provincia y por
      pais—. Las demas usan solo el ancla mas cercana, para no
      multiplicar el plan sin ganar cobertura.
    */
    const anclasDeEsta = variante === "" ? anclas : anclas.slice(0, 1);

    anclasDeEsta.forEach((ancla) => {
      agregar({
        texto: `${territorio} ${ancla} ${variante}`,
        tipo: TIPOS_CONSULTA.NEUTRAL,
        etiqueta: `neutral:${variante || "base"}:${ancla}`,
        prioridad: p++,
        destino: DESTINOS.CUALQUIERA,
        piezas: { territorio, ancla, variante: variante || null, tipo: "neutral" }
      });
    });

    void i;
  });

  const finNeutrales = p;

  /*
    ---------------------------------------------------------
    2. INSTITUCIONALES — declaradas como tales

    El vocabulario de gestion NO desaparece: sigue haciendo
    falta para observar al municipio. Lo que cambia es que ya no
    se disfraza de escucha general.
    ---------------------------------------------------------
  */
  const institucionesEfectivas =
    instituciones.length > 0
      ? instituciones
      : ["municipio alcaldía", "concejo cantonal"];

  institucionesEfectivas.slice(0, 4).forEach((inst) => {
    agregar({
      texto: `${territorio} ${anclaPrincipal || anclaPais || ""} ${inst}`,
      tipo: TIPOS_CONSULTA.INSTITUCIONAL,
      etiqueta: `institucional:${inst}`,
      prioridad: p++,
      destino: DESTINOS.INSTITUCIONAL,
      piezas: { territorio, ancla: anclaPrincipal, institucion: inst }
    });
  });

  /*
    ---------------------------------------------------------
    3. ACTORES
    ---------------------------------------------------------
  */
  actores.slice(0, 6).forEach((a) => {
    if (!a?.nombre) return;

    const ancla = [territorio, anclaPrincipal].filter(Boolean).join(" ");

    agregar({
      texto: `"${a.nombre}" ${ancla}`,
      tipo: TIPOS_CONSULTA.ACTOR,
      etiqueta: `actor:${a.id || a.nombre}`,
      prioridad: p++,
      destino: DESTINOS.CUALQUIERA,
      piezas: { territorio, ancla: anclaPrincipal, actor: a.nombre }
    });
  });

  /*
    ---------------------------------------------------------
    4. TEMATICAS — solo las que el analista pidio

    No hay tematicas por defecto. Una tematica por defecto es
    exactamente el sesgo que este modulo existe para quitar.
    ---------------------------------------------------------
  */
  temas.slice(0, 4).forEach((t) => {
    agregar({
      texto: `${territorio} ${anclaPrincipal || ""} ${t}`,
      tipo: TIPOS_CONSULTA.TEMATICA,
      etiqueta: `tema:${t}`,
      prioridad: p++,
      destino: DESTINOS.CUALQUIERA,
      piezas: { territorio, ancla: anclaPrincipal, tema: t }
    });
  });

  /*
    ---------------------------------------------------------
    5. CREADORES Y VIDEO

    Declaradas aparte porque su corpus NO es comparable con el
    de prensa: un video no es una nota. Alimentan la agenda de
    creadores, no la mediatica.
    ---------------------------------------------------------
  */
  if (incluirCreadores) {
    agregar({
      texto: `${territorio} ${anclaPrincipal || anclaPais || ""} video`,
      tipo: TIPOS_CONSULTA.CREATOR,
      etiqueta: "creator:video",
      prioridad: p++,
      destino: DESTINOS.VIDEO,
      piezas: { territorio, ancla: anclaPrincipal, destino: "video" }
    });
  }

  /*
    ---------------------------------------------------------
    SIN NINGUN ANCESTRO

    El vocabulario acota el tema pero no el pais. Se marca todo
    el plan en lugar de dejar creer que esta acotado.
    ---------------------------------------------------------
  */
  if (!anclaPrincipal && !anclaPais) {
    consultas.forEach((c) => {
      c.anclada = false;

      c.aviso =
        "El ámbito no declara provincia ni país. La consulta no lleva ancla territorial y puede traer homónimos de otros países: «Cuenca» sin ancla devuelve Cuenca de España.";
    });
  }

  void finNeutrales;

  return consultas.sort((a, b) => a.prioridad - b.prioridad);
}


/*
===========================================================
MEDIR EL SESGO DE UN PLAN

Devuelve numeros, no adjetivos. Un plan se compara con otro y
la mejora se demuestra.

`porEvidencia` solo se calcula si se pasan los resultados: el
sesgo que importa no es cuantas consultas se lanzaron con
vocabulario de dominio, sino cuanta EVIDENCIA entro por ellas.
Cuatro consultas al 50 % pueden dar un corpus al 20 % o al 80 %.
===========================================================
*/

export function medirSesgo(consultas = [], registroPorEtiqueta = null) {
  const total = consultas.length;

  const porTipo = {};

  consultas.forEach((c) => {
    porTipo[c.tipo] = (porTipo[c.tipo] || 0) + 1;
  });

  const conGestion = consultas.filter((c) => c.sesgoDeclarado).length;

  const neutrales = consultas.filter(
    (c) => c.tipo === TIPOS_CONSULTA.NEUTRAL
  ).length;

  const medida = {
    consultas: total,
    porTipo,
    neutrales,
    conVocabularioDeGestion: conGestion,

    proporcionNeutral: total ? Number((neutrales / total).toFixed(3)) : 0,
    proporcionConGestion: total ? Number((conGestion / total).toFixed(3)) : 0,

    /* Solo con resultados. Sin ellos, null: no se estima. */
    porEvidencia: null,

    unidad: "proporción de consultas del plan",
    declaracion:
      "Mide la composición del PLAN. Que una consulta sea neutral no garantiza que el buscador devuelva un corpus neutral: eso solo se sabe con los resultados."
  };

  if (registroPorEtiqueta) {
    let evTotal = 0;

    let evNeutral = 0;

    let evGestion = 0;

    consultas.forEach((c) => {
      const n = Number(registroPorEtiqueta[c.etiqueta] || 0);

      evTotal += n;

      if (c.tipo === TIPOS_CONSULTA.NEUTRAL) evNeutral += n;

      if (c.sesgoDeclarado) evGestion += n;
    });

    medida.porEvidencia = {
      evidencias: evTotal,
      desdeConsultaNeutral: evNeutral,
      desdeVocabularioDeGestion: evGestion,
      proporcionNeutral: evTotal ? Number((evNeutral / evTotal).toFixed(3)) : 0,
      proporcionConGestion: evTotal ? Number((evGestion / evTotal).toFixed(3)) : 0
    };
  }

  return medida;
}


/*
===========================================================
CORPUS PARA LA AGENDA GENERAL

Separa lo que puede sostener «esto es lo que se habla» de lo
que solo responde a una pregunta concreta.

Una evidencia entra en el corpus general si CUALQUIERA de las
consultas que la trajeron es neutral. Es deliberado: que una
nota tambien aparezca al preguntar por el municipio no la
convierte en una nota sobre el municipio.
===========================================================
*/

export function separarCorpusPorTipoDeConsulta(evidencias = [], consultas = []) {
  const tipoPorEtiqueta = new Map(consultas.map((c) => [c.etiqueta, c.tipo]));

  const general = [];

  const dirigido = [];

  const sinProcedencia = [];

  evidencias.forEach((ev) => {
    const etiquetas = ev.consultasOrigen || (ev.etiquetaConsulta ? [ev.etiquetaConsulta] : []);

    if (etiquetas.length === 0) {
      /*
        Sin saber que consulta la trajo no se puede afirmar que
        sea corpus neutral. No se descarta —la evidencia existe—
        pero no sostiene la agenda general.
      */
      sinProcedencia.push(ev);

      return;
    }

    const tipos = etiquetas.map((e) => tipoPorEtiqueta.get(e)).filter(Boolean);

    if (tipos.some((t) => TIPOS_AGENDA_GENERAL.includes(t))) {
      general.push(ev);
    } else {
      dirigido.push(ev);
    }
  });

  return {
    general,
    dirigido,
    sinProcedencia,

    metricas: {
      total: evidencias.length,
      general: general.length,
      dirigido: dirigido.length,
      sinProcedencia: sinProcedencia.length
    },

    declaracion:
      "La Agenda General se construye SOLO con el corpus neutral. El corpus dirigido responde a una pregunta que alguien formuló y no puede sostener «esto es lo que se habla».",

    limitacion:
      sinProcedencia.length > 0
        ? `${sinProcedencia.length} evidencia(s) no declaran qué consulta las trajo y quedan fuera del corpus general.`
        : null
  };
}


export default {
  TIPOS_CONSULTA,
  TIPOS_AGENDA_GENERAL,
  VARIANTES_NEUTRAS,
  VENTANAS,
  DESTINOS,
  planificarConsultasAbiertas,
  medirSesgo,
  separarCorpusPorTipoDeConsulta,
  llevaVocabularioDeGestion
};
