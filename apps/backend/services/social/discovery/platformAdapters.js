// apps/backend/services/social/discovery/platformAdapters.js

import { normalizarTexto } from "../../textUtils.js";

/*
===========================================================
SENTINEL INTELLIGENCE
ADAPTADORES PÚBLICOS DE DESCUBRIMIENTO POR PLATAFORMA
===========================================================

Qué son y qué NO son — la distinción importa.

NO son clientes de la API de cada red. Son ESTRATEGIAS DE
CONSULTA ACOTADA POR DOMINIO que se ejecutan a través de la
Search Provider Layer:

    site:x.com "Juan Carlos Vega" Cuenca alcalde

Es descubrimiento web público. No toca ninguna API
restringida, no requiere credencial de plataforma y no elude
ningún muro de sesión — la condición que el sprint fija.

-----------------------------------------------------------
POR QUÉ NO HAY UN ADAPTADOR LLAMADO "GOOGLE"
-----------------------------------------------------------

El sprint pide adaptadores de «Google, Brave, X, Facebook
Pages, YouTube». Los dos primeros son BUSCADORES; los tres
últimos son PLATAFORMAS. Son cosas distintas y se resuelven
en capas distintas:

  · Google y Brave son PROVEEDORES, y ya los gestiona el
    Search Provider Layer, que elige el disponible y declara
    cuál usó. Brave entra en cuanto exista BRAVE_API_KEY.
    Google no tiene búsqueda pública sin clave: registrar un
    adaptador llamado «Google» que en realidad consulta
    DuckDuckGo fabricaría una fuente inexistente, que es
    justo lo que este proyecto lleva cuatro sprints evitando.

  · X, Facebook Pages y YouTube son DESTINOS de la consulta,
    y son estos adaptadores.

Así, cada resultado conserva dos datos separados y ciertos:
el proveedor que lo encontró y la plataforma donde vive.
===========================================================
*/


/*
-----------------------------------------------------------
PRIORIDAD DE DESCUBRIMIENTO (SD-1)

El sprint acota el descubrimiento a cinco plataformas:
Facebook Page, X, YouTube, TikTok y LinkedIn. Instagram sigue
soportado, pero va DESPUES: con un presupuesto de consultas
escaso, el orden decide que se descubre y que no.

`prioridad` 1 = se consulta primero.
-----------------------------------------------------------
*/

export const ADAPTADORES = Object.freeze([
  {
    id: "x",
    prioridad: 1,
    nombre: "X",
    plataformaId: "x",
    dominios: ["x.com", "twitter.com"],
    tipo: "social",
    /*
      Rutas que NO son perfiles. Se usan para descartar
      resultados que caen en la plataforma pero no son cuentas.
    */
    rutasNoPerfil: ["status", "search", "hashtag", "i", "explore", "home"],
    presupuesto: 2,
    publico: true
  },
  {
    id: "facebook_pages",
    prioridad: 1,
    nombre: "Facebook Pages",
    plataformaId: "facebook",
    dominios: ["facebook.com", "m.facebook.com", "fb.com"],
    tipo: "social",
    /*
      Solo PÁGINAS públicas: el sprint excluye Graph API y los
      perfiles personales quedan fuera por acceso y por ética
      (EX1, Cap. 14).
    */
    rutasNoPerfil: [
      "watch", "groups", "events", "marketplace", "photo", "story",
      "sharer", "login", "profile.php", "permalink.php"
    ],
    soloPaginasPublicas: true,
    presupuesto: 2,
    publico: true
  },
  {
    id: "youtube",
    prioridad: 1,
    nombre: "YouTube",
    plataformaId: "youtube",
    dominios: ["youtube.com", "youtu.be"],
    tipo: "video",
    rutasNoPerfil: ["watch", "results", "playlist", "shorts", "feed", "hashtag"],
    presupuesto: 2,
    publico: true
  },
  {
    id: "instagram",
    prioridad: 3,
    nombre: "Instagram",
    plataformaId: "instagram",
    dominios: ["instagram.com"],
    tipo: "social",
    rutasNoPerfil: ["p", "reel", "reels", "explore", "stories", "tv"],
    presupuesto: 1,
    publico: true
  },
  {
    id: "tiktok",
    prioridad: 1,
    nombre: "TikTok",
    plataformaId: "tiktok",
    dominios: ["tiktok.com"],
    tipo: "social",
    rutasNoPerfil: ["video", "tag", "discover", "foryou"],
    presupuesto: 1,
    publico: true
  },
  {
    id: "linkedin",
    prioridad: 2,
    nombre: "LinkedIn",
    plataformaId: "linkedin",
    dominios: ["linkedin.com"],
    tipo: "social",
    rutasNoPerfil: ["posts", "feed", "jobs", "pulse", "company", "school"],
    /*
      Las condiciones de LinkedIn prohíben el raspado. Se
      descubre solo lo que un buscador ya indexó públicamente,
      sin acceder al sitio.
      Presupuesto mínimo y declarado.
    */
    presupuesto: 1,
    publico: true,
    advertencia:
      "Solo se usa lo que el buscador ya indexó. No se accede a linkedin.com ni se raspa el sitio."
  }
]);


export function adaptadorPorId(id) {
  return ADAPTADORES.find((a) => a.id === id) || null;
}


export function adaptadorPorPlataforma(plataformaId) {
  return ADAPTADORES.find((a) => a.plataformaId === plataformaId) || null;
}


/*
===========================================================
PLANIFICADOR DE CONSULTAS DERIVADAS
===========================================================

El corazón de «Identity First Search»: las consultas no se
construyen desde el nombre, sino desde el PERFIL DE
REFERENCIA.

Medido en el caso real: la consulta «Juan Carlos Vega»
devuelve un artista fotográfico en las tres primeras
posiciones. La consulta «Juan Carlos Vega Cuenca alcalde»
devuelve 8 de 8 resultados del candidato. La diferencia no
está en el motor: está en la consulta.
===========================================================
*/


/*
-----------------------------------------------------------
ANCLAS DE IDENTIDAD

Los términos que amarran la consulta a ESTE objetivo y no a
su homónimo. Se toman, en orden de fuerza:

  1. contexto.rol y contexto.pais del Perfil de Referencia
  2. términos discriminantes corroborados por varias fuentes
  3. términos afines del paquete de dominio presentes en el
     propio perfil
-----------------------------------------------------------
*/

export function extraerAnclas(perfil, dominio = null) {
  const anclas = [];

  const vistas = new Set();

  function agregar(valor, fuerza, origen) {
    const v = String(valor || "").trim();

    const clave = normalizarTexto(v);

    if (!v || vistas.has(clave)) return;

    vistas.add(clave);

    anclas.push({ termino: v, fuerza, origen });
  }

  /*
    0 · CONTEXTO MAESTRO DEL PROYECTO (ARQ-INV-002)

    Cuando la investigacion ocurre dentro de un proyecto, el
    territorio y la dignidad los fija el ANALISTA. Entran con
    fuerza 18 o mas, y como esta funcion ordena por fuerza
    descendente al final, ningun termino derivado de evidencia
    —cuyo maximo es 10— puede desplazarlos.

    No es una preferencia configurable: es una imposibilidad
    estructural, y existe por el fallo auditado en AUD-001, donde
    una cronica de ciclismo de Albacete sustituyo el contexto de
    Cuenca y las seis consultas salieron buscando a un juez.
  */
  (perfil?.contextoMaestro?.anclas || []).forEach((a) => {
    agregar(a.termino, a.fuerza, a.origen);
  });

  /* 1 · Contexto del perfil — las anclas más fuertes. */
  agregar(perfil?.contexto?.rol, 10, "contexto_rol");
  agregar(perfil?.contexto?.pais, 9, "contexto_pais");

  (perfil?.contexto?.organizaciones || []).slice(0, 2).forEach((o) => {
    agregar(o.valor, 7, "contexto_organizacion");
  });

  /*
    2 · Términos discriminantes corroborados por más de una
        fuente. La corroboración importa: un término que solo
        aparece en una evidencia puede ser ruido.
  */
  (perfil?.terminosDiscriminantes || [])
    .filter((t) => (t.fuentes || []).length >= 2)
    .slice(0, 4)
    .forEach((t) => agregar(t.termino, 8, "discriminante_corroborado"));

  /* 3 · Discriminantes de una sola fuente, como reserva. */
  (perfil?.terminosDiscriminantes || [])
    .filter((t) => (t.fuentes || []).length === 1)
    .slice(0, 3)
    .forEach((t) => agregar(t.termino, 5, "discriminante"));

  /*
    4 · Términos afines del dominio que ya aparecen en el
        perfil: confirman la vertical del objetivo.
  */
  if (dominio) {
    const textoPerfil = normalizarTexto(
      [
        perfil?.contexto?.rol,
        perfil?.contexto?.pais,
        ...(perfil?.terminosDiscriminantes || []).map((t) => t.termino),
        ...(perfil?.contexto?.organizaciones || []).map((o) => o.valor)
      ].join(" ")
    );

    dominio.afines
      .filter((a) => textoPerfil.includes(normalizarTexto(a.termino)))
      .slice(0, 3)
      .forEach((a) => agregar(a.termino, 6, "afin_dominio"));
  }

  return anclas.sort((a, b) => b.fuerza - a.fuerza);
}


/*
-----------------------------------------------------------
PLANIFICAR CONSULTAS DERIVADAS

Genera, por adaptador, consultas acotadas al dominio de la
plataforma y ancladas al contexto del objetivo.

Cada consulta declara su etiqueta y las anclas usadas, para
que el resultado sea explicable.
-----------------------------------------------------------
*/

/*
===========================================================
SEMILLAS DE HANDLE
===========================================================

Un handle puede llegar escrito de muchas formas. Todas estas son
la misma semilla:

    @JotaLloretV
    jotalloretv
    x.com/jotalloretv
    https://instagram.com/jotalloretv/

Se normaliza a `jotalloretv` y se deduplica sin distinguir
mayusculas. Sin esto, propagar tres formas del mismo nombre
gastaria tres consultas para preguntar lo mismo.

REGLA CENTRAL: MISMO HANDLE != MISMA PERSONA.

Una semilla solo sirve para BUSCAR. Lo que se encuentre pasa por
el clasificador de cuentas igual que cualquier otro candidato.
Que dos plataformas compartan un nombre de usuario no dice nada
sobre quien esta detras de cada una.
===========================================================
*/

export function normalizarSemillaHandle(valor) {
  let v = String(valor || "").trim();

  if (!v) return null;

  /*
    Si parece una URL, se descarta el host y se toma el primer
    segmento de la ruta.

    El host se identifica POR POSICION, no por llevar un punto:
    un handle tambien puede llevarlo
    —`juancristobal.lloretvaldivieso`— y descartar «lo que tenga
    punto» lo borraba entero.
  */
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v) || /^[\w.-]+\.[a-z]{2,}\//i.test(v)) {
    v = v.split("?")[0].split("#")[0];

    /* Fuera el esquema, si lo hay. */
    const sinEsquema = v.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");

    const segmentos = sinEsquema.split("/").filter(Boolean);

    /* El primero es el host; el siguiente es lo que interesa. */
    v = segmentos[1] || "";
  }

  v = v.replace(/^@+/, "").replace(/\/+$/, "").trim();

  if (!v) return null;

  /*
    Un handle de dos caracteres o menos no discrimina nada y
    convertiria la propagacion en ruido.
  */
  if (v.length < 3) return null;

  return v;
}


/*
  Semillas normalizadas y deduplicadas, conservando la
  procedencia de cada una: de que plataforma vino, si Sentinel la
  habia ATRIBUIDO o la escribio el analista.
*/
export function semillasDeHandle(perfil) {
  const vistas = new Map();

  (perfil?.handlesConocidos || []).forEach((h) => {
    const bruto = typeof h === "string" ? h : h?.handle || h?.valor;

    const handle = normalizarSemillaHandle(bruto);

    if (!handle) return;

    const clave = normalizarTexto(handle);

    const previa = vistas.get(clave);

    const semilla = {
      handle,
      plataformaOrigenId: h?.plataformaOrigenId || h?.plataformaId || null,
      plataformaOrigen: h?.plataformaOrigen || h?.plataforma || null,
      cuentaOrigen: h?.cuentaOrigen || h?.url || h?.enlace || null,
      /*
        `atribuida` significa que Sentinel la clasifico como del
        objetivo en una investigacion anterior. Es lo que permite
        no gastar una consulta en una plataforma ya resuelta.
      */
      atribuida: h?.atribuida === true,
      origenAnalista: h?.origen === "analista" || h?.origenAnalista === true
    };

    if (!previa) {
      vistas.set(clave, {
        ...semilla,
        plataformasOrigen: [semilla.plataformaOrigenId].filter(Boolean)
      });

      return;
    }

    /*
      La misma semilla vista en dos plataformas: se acumulan sus
      origenes en lugar de duplicarla. Una semilla ATRIBUIDA pesa
      mas que una solo declarada, asi que gana la atribucion.
    */
    previa.atribuida = previa.atribuida || semilla.atribuida;

    /*
      Deja de ser "solo del analista" en cuanto Sentinel la ve por
      su cuenta.
    */
    previa.origenAnalista = previa.origenAnalista && semilla.origenAnalista;

    if (
      semilla.plataformaOrigenId &&
      !previa.plataformasOrigen.includes(semilla.plataformaOrigenId)
    ) {
      previa.plataformasOrigen.push(semilla.plataformaOrigenId);
    }
  });

  return [...vistas.values()];
}


/*
  Tope de consultas propagadas por plan. Con las seis plataformas
  y varias semillas el producto crece rapido, y el presupuesto del
  proveedor no.
*/
const TOPE_PROPAGADAS = 4;


export function planificarConsultasDerivadas(perfil, opciones = {}) {
  const nombre = perfil?.nombrePrincipal;

  if (!nombre) return { plan: [], anclas: [] };

  const dominio = opciones.dominio || null;

  const anclas = extraerAnclas(perfil, dominio);

  const adaptadores = [...(opciones.adaptadores || ADAPTADORES)]
    .filter((a) => a.publico)
    .sort((a, b) => (a.prioridad || 9) - (b.prioridad || 9));

  const plan = [];

  const vistas = new Set();

  function agregar(consulta, etiqueta, adaptador, anclasUsadas, extra = null) {
    const limpia = consulta.trim();

    const clave = normalizarTexto(limpia);

    if (!limpia || vistas.has(clave)) return;

    vistas.add(clave);

    plan.push({
      id: `q${plan.length}`,
      consulta: limpia,
      etiqueta,
      adaptadorId: adaptador?.id || null,
      plataformaId: adaptador?.plataformaId || null,
      anclas: anclasUsadas.map((a) => a.termino),

      /*
        Procedencia de la consulta. Las derivadas de un handle
        propagado la traen; el resto queda con la via por defecto
        del Discovery.
      */
      ...(extra || {}),
      /*
        Una consulta sin anclas es una búsqueda por nombre: la
        que produjo el homónimo. Se marca para poder medir.
      */
      anclada: anclasUsadas.length > 0
    });
  }

  /*
    DOS anclas, tambien con contexto maestro.

    La primera version usaba TRES cuando habia proyecto, y se
    midio el efecto: con

        site:x.com "Pedro Palacios" Cuenca alcaldia Azuay

    X no devolvio ninguna cuenta, mientras la auditoria AUD-001
    habia encontrado x.com/pedropalaciosu con solo

        site:x.com "Pedro Palacios" Cuenca

    Tres anclas estrechan el resultado hasta perder cuentas que
    existen. Con contexto maestro las dos primeras son canton y
    dignidad, que es lo que de verdad discrimina; provincia y pais
    quedan como respaldo si faltara alguna.
  */
  const anclasPrincipales = anclas.slice(0, 2);

  const textoAnclas = anclasPrincipales.map((a) => a.termino).join(" ");

  /*
    ---------------------------------------------------------
    REPARTO A LO ANCHO (ARQ-PUI-001, Bloque A)
    ---------------------------------------------------------

    Antes el plan se construia plataforma por plataforma, con
    sus DOS consultas seguidas:

        x anclada · x nombre · facebook anclada · facebook
        nombre · youtube anclada · ...

    Con el presupuesto del proveedor en 4, X y Facebook se lo
    comian entero y YouTube, TikTok, LinkedIn e Instagram nunca
    llegaban a ejecutarse. Medido en Daniel Noboa: cuatro
    consultas OK y seis Bloqueado.

    El Protocolo Universal exige que las SEIS plataformas se
    cubran. Asi que primero va UNA consulta anclada por
    plataforma —una pasada a lo ancho— y solo despues las
    variantes por nombre.

    Con esto el presupuesto se agota, si se agota, habiendo
    tocado las seis, no habiendo agotado dos.
  */

  /* PASADA 1 — una consulta anclada por plataforma. */
  if (textoAnclas) {
    adaptadores.forEach((adaptador) => {
      agregar(
        `site:${adaptador.dominios[0]} "${nombre}" ${textoAnclas}`,
        `identidad:${adaptador.id}`,
        adaptador,
        anclasPrincipales
      );
    });
  }

  /*
    ---------------------------------------------------------
    PASADA 2 — HANDLES PROPAGADOS
    ---------------------------------------------------------

    QUE RESUELVE

    Medido en la ejecucion real de las 22:14: Sentinel atribuyo
    `jotalloretv` en X y en Instagram, y TikTok se quedo sin
    cuenta. Su unica consulta —el nombre completo mas el
    contexto— devolvio un solo resultado, de otra persona. El
    perfil de TikTok con ese mismo handle nunca se busco.

    Un handle ya confirmado en dos plataformas es la mejor pista
    disponible para las que faltan, y no cuesta casi nada
    preguntarlo.

    ---------------------------------------------------------
    MISMO HANDLE != MISMA PERSONA
    ---------------------------------------------------------

    Esta pasada solo GENERA CANDIDATOS. Nada de lo que encuentre
    queda atribuido por coincidir el nombre de usuario: pasa por
    el mismo clasificador de cuentas que cualquier otro hallazgo,
    y si el nombre no corresponde, se rechaza.

    El caso que hay que sostener: si `tiktok.com/@jotalloretv`
    fuera de otra persona, el Discovery debe encontrarlo y el
    clasificador debe rechazarlo. Atribuir por igualdad de
    username seria autoverificacion, y ademas una forma
    especialmente mala: la de suponer que un nombre es una
    identidad.

    ---------------------------------------------------------
    DONDE VA Y POR QUE AQUI — BUG-18
    ---------------------------------------------------------

    Inmediatamente despues de la pasada anclada por plataforma, y
    ANTES de la reserva por nombre.

    La primera version la puso al final, para no degradar ninguna
    consulta existente. El efecto medido en produccion fue que no
    se ejecutaba nunca: SerpAPI agotaba sus seis intentos en la
    pasada anclada y las cuatro propagadas devolvian Error sin
    proveedor.

    Y las tres consultas de reserva que iban delante tampoco
    aportaron nada: fallaron las tres. Estaban ocupando el turno
    sin producir.

    Asi que el orden nuevo es por VALOR ESPERADO, no por
    antiguedad: un handle ya confirmado en dos plataformas es una
    pista mucho mas fuerte que repetir el nombre completo sin
    contexto. La cobertura de las seis plataformas sigue primero,
    que es lo que no se puede perder. No se subio ningun tope.

    Y no se gasta en plataformas que YA tienen cuenta atribuida:
    preguntar por un handle donde ya hay respuesta es tirar
    presupuesto.
    ---------------------------------------------------------
  */
  const semillas = semillasDeHandle(perfil);

  /*
    ---------------------------------------------------------
    QUE SE OMITE: EL PAR, NO LA PLATAFORMA
    ---------------------------------------------------------

    Antes se omitia la PLATAFORMA entera en cuanto tenia una
    cuenta atribuida. La intencion era buena —no gastar
    presupuesto preguntando por algo ya resuelto— pero cerraba
    demasiado.

    Encontrado con un caso real: un candidato con perfil Y pagina
    de Facebook. En cuanto se atribuia el primero, la propagacion
    dejaba de preguntar por Facebook, y el segundo activo no se
    buscaba nunca por esta via.

    Un candidato puede tener N activos por plataforma —perfil,
    pagina, pagina de campana— y encontrar uno no significa
    haberlos encontrado todos.

    Lo que si sigue siendo tirar presupuesto es repreguntar por el
    MISMO handle en la MISMA plataforma. Eso es lo que se omite
    ahora: el par exacto, no la plataforma.
    ---------------------------------------------------------
  */
  const yaResueltas = new Set(
    semillas
      .filter((x) => x.atribuida)
      .flatMap((x) =>
        (x.plataformasOrigen || [])
          .filter(Boolean)
          .map((p) => `${p}:${normalizarTexto(String(x.handle || ""))}`)
      )
  );

  const propagadas = [];

  const omitidasPorResueltas = [];

  semillas.forEach((semilla) => {
    adaptadores.forEach((adaptador) => {
      const par = `${adaptador.plataformaId}:${normalizarTexto(String(semilla.handle || ""))}`;

      if (yaResueltas.has(par)) {
        omitidasPorResueltas.push(
          `${adaptador.plataformaId}:${semilla.handle}`
        );

        return;
      }

      propagadas.push({ semilla, adaptador });
    });
  });

  /*
    Tope propio, para no inflar el plan por la puerta de atras.
    Lo que quede fuera se DECLARA: un recorte silencioso se leeria
    como "no habia mas que preguntar".
  */
  const enPlan = propagadas.slice(0, TOPE_PROPAGADAS);

  enPlan.forEach(({ semilla, adaptador }) => {
    agregar(
      `site:${adaptador.dominios[0]} "${semilla.handle}"`,
      `handle_propagado:${semilla.handle}`,
      adaptador,
      [],
      {
        via: "handle_propagado",
        handle: semilla.handle,
        handleOrigen: semilla.handle,
        plataformaOrigenId: semilla.plataformaOrigenId,
        plataformaOrigen: semilla.plataformaOrigen,
        cuentaOrigen: semilla.cuentaOrigen,
        cuentaOrigenAtribuida: semilla.atribuida,

        /*
          Si la semilla viene SOLO de lo que declaro el analista,
          lo que se encuentre con ella no puede corroborarse por
          ese origen. La declaracion orienta la busqueda; no es
          evidencia independiente.
        */
        origenAnalista: semilla.origenAnalista,
        noCuentaComoCorroboracion: semilla.origenAnalista === true
      }
    );
  });

  /*
    PASADA 3 — reserva por nombre, para plataformas donde un
    perfil puede existir sin mencionar el contexto. Va despues:
    si el presupuesto no llega, se pierde una reserva, nunca la
    cobertura de una plataforma.
  */
  adaptadores.forEach((adaptador) => {
    if ((adaptador.presupuesto || 1) >= 2 && adaptador.prioridad === 1) {
      agregar(
        `site:${adaptador.dominios[0]} "${nombre}"`,
        `nombre:${adaptador.id}`,
        adaptador,
        []
      );
    }
  });

  /*
    ---------------------------------------------------------
    PASADA 3 — ALIAS DECLARADOS POR EL ANALISTA
    ---------------------------------------------------------

    Otras formas de nombrar a la misma persona. Amplian el
    descubrimiento: «Jota Lloret» encuentra lo que «Juan
    Cristobal Lloret Valdivieso» no encuentra.

    POR QUE VA AL FINAL

    Porque el presupuesto del proveedor se agota, y cuando se
    agota tiene que perderse lo ultimo, no lo primero. El orden
    dice la prioridad: cobertura de las seis plataformas, luego
    la reserva por nombre, y solo despues los alias. Un alias no
    puede costarle a ninguna plataforma su consulta ni sustituir
    la busqueda por el nombre principal.

    UN ALIAS NO VERIFICA IDENTIDAD

    Aqui solo se generan CONSULTAS. El alias no llega al
    accountClassifier, que sigue juzgando la atribucion contra
    `nombrePrincipal` y solo contra el. La distincion es la que
    sostiene todo esto:

        el alias amplia el RECALL
        el nombre principal gobierna la PRECISION

    Si el alias pudiera atribuir, bastaria escribir «Alcalde» en
    el formulario para que cualquier cuenta que lo lleve pasara a
    ser del candidato. El analista habria dictado la conclusion y
    Sentinel se la habria devuelto como hallazgo.

    Van anclados: un alias es mas corto y mas ambiguo que el
    nombre completo, asi que sin contexto es justo la consulta
    que devuelve homonimos.
    ---------------------------------------------------------
  */
  const alias = (perfil?.aliasDeclarados || [])
    .map((a) => String((typeof a === "string" ? a : a?.valor) || "").trim())
    .filter(Boolean);

  /* Deduplicado, y nunca el nombre principal repetido. */
  const aliasUnicos = [];

  const aliasVistos = new Set([normalizarTexto(nombre)]);

  alias.forEach((a) => {
    const clave = normalizarTexto(a);

    if (!clave || aliasVistos.has(clave)) return;

    aliasVistos.add(clave);

    aliasUnicos.push(a);
  });

  /*
    Dos como maximo. Con mas, el presupuesto se va en variantes
    de nombre en lugar de en plataformas, que es el reparto que
    ARQ-PUI-001 corrigio.
  */
  aliasUnicos.slice(0, 2).forEach((a) => {
    if (textoAnclas) {
      agregar(
        `"${a}" ${textoAnclas}`,
        `alias:${a}`,
        null,
        anclasPrincipales
      );
    }
  });

  /*
    c) CONSULTA GENERAL ANCLADA, sin acotar plataforma.
       Es la que descubre perfiles en dominios propios y
       menciones cruzadas.
  */
  if (textoAnclas) {
    agregar(
      `"${nombre}" ${textoAnclas}`,
      "identidad:general",
      null,
      anclasPrincipales
    );
  }

  return {
    plan,
    anclas,
    anclasUsadas: anclasPrincipales,

    /*
      Que alias se usaron, para que el informe pueda decir que
      una cuenta se hallo por un alias que escribio el analista
      y no por el nombre.
    */
    aliasUsados: aliasUnicos.slice(0, 2),
    aliasDeclarados: aliasUnicos.length,

    /*
      HANDLES PROPAGADOS — lo que se pregunto, lo que se omitio
      por estar ya resuelto y lo que no cupo.
    */
    handlesPropagados: [...new Set(enPlan.map((x) => x.semilla.handle))],
    semillasDeHandle: semillas.length,
    consultasPropagadas: enPlan.length,
    propagadasTruncadas: Math.max(0, propagadas.length - TOPE_PROPAGADAS),
    propagacionOmitidaPorAtribuida: omitidasPorResueltas,
    /*
      Diagnóstico honesto: sin anclas, este sprint no puede
      hacer su trabajo.
      El planificador lo declara en lugar de degradar en
      silencio a búsqueda por nombre.
    */
    advertencia: anclasPrincipales.length
      ? null
      : "El Perfil de Referencia no aportó anclas de identidad (rol, país ni términos discriminantes corroborados). Las consultas serán por nombre, con riesgo de homónimo."
  };
}


/*
-----------------------------------------------------------
¿LA RUTA DE ESTA URL ES UN PERFIL?

Complementa a extraerHandle de textUtils con las rutas
específicas de cada adaptador.
-----------------------------------------------------------
*/

export function esRutaDePerfil(adaptador, handle) {
  if (!adaptador || !handle) return false;

  return !adaptador.rutasNoPerfil.includes(normalizarTexto(handle));
}
