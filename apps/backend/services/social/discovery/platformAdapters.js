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

  function agregar(consulta, etiqueta, adaptador, anclasUsadas) {
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
        Una consulta sin anclas es una búsqueda por nombre: la
        que produjo el homónimo. Se marca para poder medir.
      */
      anclada: anclasUsadas.length > 0
    });
  }

  /*
    Las dos anclas más fuertes bastan para acotar; añadir más
    reduce demasiado el resultado.
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
    PASADA 2 — reserva por nombre, para plataformas donde un
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
