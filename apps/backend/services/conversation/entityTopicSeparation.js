// apps/backend/services/conversation/entityTopicSeparation.js

import { METODOS_DESCUBRIMIENTO } from "./openTopicDiscovery.js";

/*
===========================================================
ENTITY != TOPIC
===========================================================

En la validacion visual, la agenda de Cuenca quedo asi:

    01  Marisol Peñaloza        4 ev · 3 fuentes
    02  elecciones seccionales  3 ev · 3 fuentes
    03  denuncian falta         3 ev · 2 fuentes
    04  Gestión y gobernanza    2 ev · 1 fuente

El primer puesto no es un tema. Es una PERSONA. Y compite en
la misma lista que «elecciones seccionales», que si lo es.

POR QUE ESTO IMPORTA MAS DE LO QUE PARECE
-----------------------------------------------------------

Un ranking que mezcla las dos cosas responde mal a la pregunta
que se le hace. «¿Que esta pasando en Cuenca?» no se contesta
con «Marisol Peñaloza»: eso es un sujeto sin predicado. Lo que
esta pasando es el proceso electoral; ella es quien aparece
dentro.

Y hay un efecto peor. Los nombres propios son la senal mas
discriminante del corpus —por eso el descubridor los usa—, asi
que tienden a formar clusters compactos y a ENCABEZAR siempre.
El resultado es una agenda que se llena de nombres y esconde
los asuntos, justo al reves de lo que necesita un analista.

LA CORRECCION NO ES BORRAR
-----------------------------------------------------------

Una persona repetida es una senal real y valiosa. No se
descarta: se mueve a su propio bloque, conserva sus evidencias
y se declara CON QUE TEMAS aparece. Se pierde un puesto en un
ranking equivocado y se gana la relacion, que es lo que
realmente interesa.

DONDE ESTA EL LIMITE
-----------------------------------------------------------

Un LUGAR repetido tampoco es un tema: «Cuenca» aparece en las
30 evidencias de un corpus de Cuenca y no significa nada. Un
EVENTO si puede serlo —«el paro de noviembre» es un evento y es
un tema—, y por eso los eventos son la unica clase de entidad
que puede seguir en la agenda tematica.

COMO SE DECIDE, SIN MODELO NI RED
-----------------------------------------------------------

Con morfologia y contexto, que es lo que hay disponible sin
romper el determinismo:

  persona        dos o mas palabras capitalizadas, ninguna en
                 el lexico de organizacion, lugar ni evento
  organizacion   contiene un termino de organizacion
  lugar          esta en el gazetteer, o lleva un generico
                 geografico
  evento         contiene un termino de evento

Cada decision viaja con su razon. Cuando ninguna regla aplica,
OTRA_ENTIDAD: no se fuerza.
===========================================================
*/


export const TIPOS_ENTIDAD = Object.freeze({
  PERSON: "PERSON",
  ORGANIZATION: "ORGANIZATION",
  PLACE: "PLACE",
  EVENT: "EVENT",
  OTHER: "OTHER_ENTITY"
});


export const NIVELES_TEMA = Object.freeze({
  CATEGORY: "CATEGORY",
  TOPIC: "TOPIC",
  SUBTOPIC: "SUBTOPIC"
});


/*
-----------------------------------------------------------
LEXICOS

Cortos y explicitos a proposito. Una lista larga acierta mas
casos y se vuelve imposible de auditar; estas caben en una
pantalla y cualquiera puede discutir cada entrada.
-----------------------------------------------------------
*/

const TERMINOS_ORGANIZACION =
  /\b(municipio|municipal|alcald[ií]a|gad|prefectura|concejo|consejo|ministerio|secretar[ií]a|direcci[oó]n|empresa|corporaci[oó]n|fundaci[oó]n|asociaci[oó]n|colectivo|comit[eé]|c[aá]mara|federaci[oó]n|sindicato|universidad|hospital|club|partido|movimiento|alianza|etapa|emov|emac)\b/i;

const TERMINOS_EVENTO =
  /\b(paro|marcha|protesta|elecciones|comicios|feria|festival|congreso|foro|cumbre|jornada|sesi[oó]n|asamblea|inundaci[oó]n|sismo|terremoto|incendio|apag[oó]n|huelga|desfile|carnaval|independencia|aniversario)\b/i;

const GENERICOS_GEOGRAFICOS =
  /\b(parroquia|cant[oó]n|provincia|barrio|sector|avenida|calle|plaza|parque|r[ií]o|cerro|urbanizaci[oó]n|ciudadela)\b/i;

/*
  Palabras que preceden a un nombre propio de persona. Si el
  titular dice «el alcalde Cristian Zamora», «Cristian Zamora»
  es una persona aunque tambien exista un dominio con su nombre.
*/
const TITULOS_PERSONALES =
  /\b(alcalde|alcaldesa|prefecto|prefecta|concejal|concejala|candidat[oa]|asamble[ií]sta|ministr[oa]|presidente|presidenta|gobernador|gobernadora|director|directora|se[nñ]or|se[nñ]ora|doctor|doctora|ingenier[oa]|licenciad[oa])\b/i;


function palabras(texto) {
  return String(texto || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}


function capitalizada(p) {
  return /^[A-ZÁÉÍÓÚÑÜ]/.test(p);
}


/*
  Conectores que no rompen un nombre propio: «Marisol Peñaloza
  de la Torre» sigue siendo una persona.
*/
const CONECTORES = new Set(["de", "del", "la", "las", "los", "y", "e", "van", "da"]);


/*
===========================================================
CLASIFICAR UNA ENTIDAD
===========================================================

`contexto` es el texto donde aparecio —normalmente el titular—.
Se usa solo para buscar titulos personales; nunca para inferir
otra cosa.

`gazetteer` es un Set de nombres de lugar normalizados. Si se
pasa, manda sobre la morfologia: un lugar del registro
territorial es un lugar aunque parezca un nombre de persona
(«Santa Ana», «San Joaquín»).
===========================================================
*/

export function clasificarEntidad(nombre, { contexto = "", gazetteer = null } = {}) {
  const texto = String(nombre || "").trim();

  const razones = [];

  if (!texto) {
    return {
      nombre: texto,
      tipo: TIPOS_ENTIDAD.OTHER,
      confianza: 0,
      razones: ["Entidad vacía."],
      puedeSerTema: false
    };
  }

  const normal = texto.toLowerCase();

  /*
    ---------------------------------------------------------
    1. GAZETTEER — manda sobre todo lo demas

    Un nombre que el registro territorial reconoce como unidad
    es un lugar. «Santa Ana» tiene forma de nombre de persona y
    es una parroquia de Cuenca.
    ---------------------------------------------------------
  */
  if (gazetteer && gazetteer.has(normal)) {
    razones.push(
      `«${texto}» es una unidad del registro territorial. Un lugar repetido no es un tema: en un corpus de Cuenca, «Cuenca» aparece en todas las evidencias y no significa nada.`
    );

    return {
      nombre: texto,
      tipo: TIPOS_ENTIDAD.PLACE,
      confianza: 0.95,
      razones,
      puedeSerTema: false,
      metodo: "gazetteer"
    };
  }

  /*
    ---------------------------------------------------------
    2. EVENTO — la unica entidad que sigue siendo tema
    ---------------------------------------------------------
  */
  if (TERMINOS_EVENTO.test(normal)) {
    razones.push(
      `«${texto}» contiene un término de evento. Un evento SÍ puede ser un tema: «el paro de noviembre» es las dos cosas.`
    );

    return {
      nombre: texto,
      tipo: TIPOS_ENTIDAD.EVENT,
      confianza: 0.75,
      razones,
      puedeSerTema: true,
      metodo: "lexico_evento"
    };
  }

  /*
    ---------------------------------------------------------
    3. ORGANIZACION
    ---------------------------------------------------------
  */
  if (TERMINOS_ORGANIZACION.test(normal)) {
    razones.push(
      `«${texto}» contiene un término de organización. Una organización es un actor, no un asunto: aparece EN los temas, no ES un tema.`
    );

    return {
      nombre: texto,
      tipo: TIPOS_ENTIDAD.ORGANIZATION,
      confianza: 0.8,
      razones,
      puedeSerTema: false,
      metodo: "lexico_organizacion"
    };
  }

  /*
    ---------------------------------------------------------
    4. LUGAR POR GENERICO GEOGRAFICO
    ---------------------------------------------------------
  */
  if (GENERICOS_GEOGRAFICOS.test(normal)) {
    razones.push(
      `«${texto}» lleva un genérico geográfico. Se trata como lugar, no como asunto.`
    );

    return {
      nombre: texto,
      tipo: TIPOS_ENTIDAD.PLACE,
      confianza: 0.7,
      razones,
      puedeSerTema: false,
      metodo: "generico_geografico"
    };
  }

  /*
    ---------------------------------------------------------
    5. PERSONA POR MORFOLOGIA

    Dos o mas palabras, todas capitalizadas salvo conectores.
    Un titulo personal en el contexto sube la confianza sin ser
    obligatorio.
    ---------------------------------------------------------
  */
  const ps = palabras(texto);

  const significativas = ps.filter((p) => !CONECTORES.has(p.toLowerCase()));

  const todasCapitalizadas =
    significativas.length >= 2 && significativas.every(capitalizada);

  if (todasCapitalizadas) {
    const conTitulo = TITULOS_PERSONALES.test(contexto);

    razones.push(
      `«${texto}» son ${significativas.length} palabras capitalizadas sin término de organización, lugar ni evento: tiene forma de nombre propio de persona.`
    );

    if (conTitulo) {
      razones.push(
        "El contexto trae un título personal (alcalde, candidato, concejal…), que refuerza la lectura."
      );
    }

    razones.push(
      "Una persona repetida es una señal real, pero no es un asunto. Se conserva como entidad y se declara con qué temas aparece."
    );

    return {
      nombre: texto,
      tipo: TIPOS_ENTIDAD.PERSON,
      confianza: conTitulo ? 0.85 : 0.65,
      razones,
      puedeSerTema: false,
      metodo: conTitulo ? "morfologia_y_titulo" : "morfologia"
    };
  }

  /*
    ---------------------------------------------------------
    6. NO SE FUERZA
    ---------------------------------------------------------
  */
  razones.push(
    `«${texto}» no encaja en persona, organización, lugar ni evento. No se fuerza una clase.`
  );

  return {
    nombre: texto,
    tipo: TIPOS_ENTIDAD.OTHER,
    confianza: 0.2,
    razones,
    puedeSerTema: true,
    metodo: "sin_regla_aplicable"
  };
}


/*
===========================================================
SEPARAR UN LOTE DE TEMAS DESCUBIERTOS
===========================================================

Recibe la salida de `descubrirTemas()` y la parte en dos:

    temas       lo que puede encabezar la agenda temática
    entidades   personas, organizaciones y lugares, con los
                temas en los que aparecen

Un tema descubierto se considera ENTIDAD cuando su etiqueta ES
la entidad: el cluster se formo por una entidad nombrada y esa
entidad es practicamente todo lo que lo define. Si el cluster
se formo por bigramas o coocurrencia y ademas menciona
personas, sigue siendo un tema — «denuncian falta» lo es
aunque en sus notas aparezcan nombres.
===========================================================
*/

export function separarEntidadesDeTemas(temasDescubiertos = [], opciones = {}) {
  const gazetteer = opciones.gazetteer || null;

  const temas = [];

  const entidades = [];

  temasDescubiertos.forEach((t) => {
    /*
      `etiquetaPropuesta` es el campo que emite el descubridor;
      `etiqueta` y `nombre` cubren los temas clasificados y las
      pruebas. El orden importa: leer solo `etiqueta` dejaba
      todos los temas descubiertos con cadena vacía y ninguna
      entidad se separaba.
    */
    const etiqueta = t.etiquetaPropuesta || t.etiqueta || t.nombre || "";

    /*
      Contexto: los titulares del propio cluster. Es donde
      aparecen los titulos personales.
    */
    const contexto = (t.titulares || []).join(" · ");

    /*
      ¿La etiqueta de este tema ES su propia señal de
      descubrimiento? Dos caminos llevan a lo mismo:

        descubridor abierto   metodoDescubrimiento = entidad
        Topic Engine 2        origen != "lexico"

      El segundo hizo falta al medirlo sobre el corpus real: la
      persona se separaba de los temas descubiertos y VOLVIA a
      entrar por la rama de los clasificados, donde el motor la
      emite como `emergente-marisol`. Filtrar solo una de las
      dos ramas es no filtrar.

      Una categoria de lexico NUNCA es candidata: «Proceso
      electoral» la escribio alguien como categoria, no la
      encontro el motor como nombre propio.
    */
    const porEntidad =
      t.metodoDescubrimiento === METODOS_DESCUBRIMIENTO.ENTIDAD ||
      (Boolean(t.origen) && t.origen !== "lexico");

    const clase = clasificarEntidad(etiqueta, { contexto, gazetteer });

    /*
      Solo se saca de la agenda tematica si LAS DOS cosas se
      cumplen: el cluster nacio de una entidad nombrada Y la
      clase no puede ser tema.

      La doble condicion evita el falso positivo obvio: un tema
      de coocurrencia cuya etiqueta casualmente tenga forma de
      nombre propio no debe salir de la agenda.
    */
    if (porEntidad && !clase.puedeSerTema) {
      entidades.push({
        ...t,

        entidad: clase.nombre,
        tipoEntidad: clase.tipo,
        confianzaEntidad: clase.confianza,
        razonesEntidad: clase.razones,
        metodoEntidad: clase.metodo,

        /*
          Los temas en los que aparece se rellenan despues, con
          la agenda ya construida: aqui todavia no existe.
        */
        temasRelacionados: [],

        declaracion:
          "Entidad observada en el corpus. No encabeza la agenda temática: es un sujeto, no un asunto."
      });

      return;
    }

    temas.push({
      ...t,

      /*
        Se conserva la clasificacion aunque el tema se quede:
        permite explicar por que «elecciones seccionales» sigue
        siendo tema pese a contener un termino de evento.
      */
      claseDeEtiqueta: clase.tipo,
      razonDeClase: clase.razones[0] || null,
      nivel: NIVELES_TEMA.TOPIC
    });
  });

  return {
    temas,
    entidades,

    metricas: {
      entrada: temasDescubiertos.length,
      temas: temas.length,
      entidades: entidades.length,
      porTipoEntidad: entidades.reduce((acc, e) => {
        acc[e.tipoEntidad] = (acc[e.tipoEntidad] || 0) + 1;

        return acc;
      }, {})
    },

    declaracion:
      "Una entidad no encabeza la agenda temática. «Marisol Peñaloza» no responde «¿qué está pasando?»: es un sujeto sin predicado. Se conserva como señal y se relaciona con los temas en los que aparece.",

    limitaciones: [
      "La clasificación es morfológica y léxica, sin modelo de lenguaje: un nombre propio de una sola palabra no se distingue de un sustantivo capitalizado por inicio de titular.",
      "Un evento SÍ puede ser tema. Es la única clase de entidad que permanece en la agenda temática."
    ]
  };
}


/*
-----------------------------------------------------------
RELACIONAR ENTIDADES CON TEMAS

Por solapamiento de evidencias, que es un hecho. No por
parecido de etiqueta, que seria una interpretacion — la misma
regla que usa la fusion de la agenda.
-----------------------------------------------------------
*/

export function relacionarEntidadesConTemas(entidades = [], temas = [], minimo = 1) {
  return entidades.map((e) => {
    const suyos = new Set(e.indices || []);

    const relacionados = temas
      .map((t) => {
        const comunes = (t.indices || []).filter((i) => suyos.has(i));

        return {
          temaId: t.id,
          etiqueta: t.etiquetaPropuesta || t.etiqueta || t.nombre,
          evidenciasCompartidas: comunes.length,
          indices: comunes
        };
      })
      .filter((r) => r.evidenciasCompartidas >= minimo)
      .sort((a, b) => b.evidenciasCompartidas - a.evidenciasCompartidas);

    return {
      ...e,
      temasRelacionados: relacionados,

      explicacion: relacionados.length
        ? `«${e.entidad}» aparece en ${e.indices.length} evidencias, que se reparten entre ${relacionados.length} tema(s): ${relacionados
            .slice(0, 3)
            .map((r) => `${r.etiqueta} (${r.evidenciasCompartidas})`)
            .join(", ")}.`
        : `«${e.entidad}» aparece en ${e.indices.length} evidencias que no coinciden con ningún tema descubierto. La entidad existe; el asunto que la rodea todavía no forma tema.`
    };
  });
}


export default {
  TIPOS_ENTIDAD,
  NIVELES_TEMA,
  clasificarEntidad,
  separarEntidadesDeTemas,
  relacionarEntidadesConTemas
};
