// apps/backend/services/social/classification/accountClassifier.js

import { normalizarTexto, tokenizar } from "../../textUtils.js";

/*
===========================================================
SENTINEL INTELLIGENCE
CLASIFICADOR DE CUENTAS — ARQ-PUI-001, Bloque C
===========================================================

Separa las cuentas descubiertas en clases, para que el panel
nunca mezcle un medio de comunicación con la cuenta oficial de
una persona.

EL PROBLEMA MEDIDO
-----------------------------------------------------------

Con SerpAPI devolviendo resultados reales, el panel se llenó
de medios que HABLAN del objetivo, no de cuentas DEL objetivo:

  Juan Cristóbal Lloret
    @UNSIONTV              60/100
    @RedInformativaCuenca  51/100
    @Cuenca4rios           51/100
    ...
    @jotalloretv           29/100   <- su cuenta real, la ultima

La razón es que CB-1 bonifica el contexto compatible, y un
medio de Cuenca que cubre elecciones tiene, por definición, un
contexto perfectamente compatible. CB-1 sabe distinguir un
homónimo extranjero; no sabe distinguir «habla de X» de
«es X».

Este módulo responde a esa pregunta distinta, y la responde
CLASIFICANDO, no puntuando: la lógica de confianza no se toca.

EL ORDEN DE LAS REGLAS ES LO QUE IMPORTA
-----------------------------------------------------------

La tentación es aplicar un léxico de medios sobre el handle.
Sería un error grave y aquí está el contraejemplo:

  @jotalloretv   ->  "Jota Lloret V"

Termina en «tv». Un léxico de medios ingenuo clasificaría como
medio la única cuenta real de Lloret que el sistema ha
encontrado.

Por eso la regla de nombre tiene PRIORIDAD ABSOLUTA sobre el
léxico: si el handle o el nombre visible contienen los tokens
distintivos del objetivo, es una cuenta de persona, dijera lo
que dijera el léxico. Un medio que cubre a X no lleva el
nombre de X en su handle; si lo lleva, no es un medio hablando
de X.

SIN LÓGICA POR CANDIDATO
-----------------------------------------------------------

Regla congelada del sprint. Aquí no hay ni un nombre propio de
objetivo: solo morfemas de tipo de entidad (radio, tv, diario,
ministerio...) que describen QUÉ CLASE de cosa es una cuenta,
nunca QUIÉN es. El mismo código corre para toda persona.

NO SE BORRA NADA
-----------------------------------------------------------

Un medio no es basura: es quién cubre al objetivo, y eso es
inteligencia. Se SEPARA en su propia colección, con su motivo,
y sigue disponible para el analista.
===========================================================
*/


export const CLASES = Object.freeze({
  CUENTA_PERSONAL: "cuenta_personal",
  MEDIO: "medio",
  INSTITUCION: "institucion",
  NO_DETERMINADO: "no_determinado"
});


/*
-----------------------------------------------------------
LÉXICO DE MEDIOS

Morfemas de tipo de entidad. Describen la clase de cosa, no la
identidad. Se aplican SOLO cuando el nombre del objetivo no
aparece en la cuenta.
-----------------------------------------------------------
*/

const LEXICO_MEDIO = Object.freeze([
  "radio", "fm", "tv", "television", "televisora", "canal",
  "diario", "periodico", "prensa", "noticias", "noticiero",
  "informativ", "informativa", "redaccion", "revista",
  "agencia", "agencianoticias", "cronica", "gaceta",
  "telecom", "multicanal", "broadcast", "podcast",
  "endirecto", "envivo", "entiemporeal", "ultimahora",
  "primeraplana", "primicias", "medios", "comunicacion",
  "editorial", "reportaje", "corresponsal", "magazine",
  "extra", "expreso", "universo", "telegrafo", "mercurio",
  "comercio", "hora", "posta", "vistazo", "ecuavisa",
  "teleamazonas", "tvc", "rtu", "cnn", "efe", "reuters", "ap"
]);


/*
-----------------------------------------------------------
LÉXICO INSTITUCIONAL

Una institución puede tener contexto perfectísimamente
compatible con el objetivo —de hecho suele tenerlo, porque el
objetivo trabaja en ella— y NO es su cuenta personal.

Caso claro: @PresidenciaEC no es la cuenta de Daniel Noboa,
aunque él sea el presidente.
-----------------------------------------------------------
*/

const LEXICO_INSTITUCION = Object.freeze([
  "presidencia", "vicepresidencia", "ministerio", "minister",
  "fiscalia", "cancilleria", "prefectura", "municipio",
  "municipal", "alcaldia", "asamblea", "consejo", "corte",
  "judicatura", "defensoria", "secretaria", "superintendencia",
  "contraloria", "procuraduria", "embajada", "consulado",
  "gobernacion", "gobierno", "gad", "senescyt", "iess",
  "policia", "fuerzasarmadas", "ejercito", "armada",
  "registrocivil", "aduana", "sri", "banco", "instituto",
  "universidad", "escuela", "colegio", "hospital",
  "agricultura", "educacion", "salud", "ambiente", "turismo",
  "energia", "finanzas", "interior", "defensa", "trabajo",
  "oficial", "gob", "gub"
]);


/*
  Sufijos de país o siglas territoriales que un medio o
  institución añade a su handle. No clasifican por sí solos,
  pero refuerzan.
*/
const SUFIJOS_TERRITORIALES = Object.freeze([
  "ec", "ecu", "ecuador", "azuay", "cuenca", "quito",
  "guayaquil", "peru", "colombia", "latam"
]);


/*
-----------------------------------------------------------
COINCIDENCIA POR LONGITUD DEL TERMINO

Defecto detectado en la primera pasada real, y era grave.

El handle de LinkedIn

    ing-ivonne-carolina-pineda-bermeo-547459182

—un perfil personal— se clasifico como MEDIO porque el termino
"ap" (Associated Press) aparece dentro de "caroLINA Pineda".

Un token de dos o tres letras como subcadena casa en cualquier
parte. Asi que:

  · termino de 4 o mas caracteres  -> subcadena (un handle real
    concatena: "elmercurioec" contiene "mercurio")

  · termino de 3 o menos           -> solo al principio o al
    final del handle, o delimitado. "UNSIONTV" acaba en "tv" y
    es un medio; "carolinapineda" contiene "ap" en el medio y
    no lo es.
-----------------------------------------------------------
*/

const LONGITUD_MINIMA_SUBCADENA = 4;

function contiene(texto, lista) {
  const encontrados = [];

  lista.forEach((termino) => {
    if (!texto.includes(termino)) return;

    if (termino.length >= LONGITUD_MINIMA_SUBCADENA) {
      encontrados.push(termino);
      return;
    }

    /*
      Token corto: exige borde. Se admite al inicio, al final,
      o rodeado de separadores.
    */
    const alInicio = texto.startsWith(termino);

    const alFinal = texto.endsWith(termino);

    const delimitado = new RegExp(
      `(^|[^a-z0-9])${termino}([^a-z0-9]|$)`
    ).test(texto);

    if (alInicio || alFinal || delimitado) encontrados.push(termino);
  });

  return encontrados;
}


/*
-----------------------------------------------------------
¿LA CUENTA LLEVA EL NOMBRE DEL OBJETIVO?

Se comparan los tokens distintivos del nombre —los de 4
caracteres o más, que son los que discriminan— contra el
handle y el nombre visible, ambos sin puntuación.

"jotalloretv" contiene "lloret"  -> SI
"unsiontv"    contiene "lloret"  -> NO
-----------------------------------------------------------
*/

/*
-----------------------------------------------------------
NOMBRE PROPIO DE LA CUENTA vs CONTENIDO DEL RESULTADO

Defecto detectado por la primera prueba de este modulo, y era
grave: la regla mirara tambien el TITULO del resultado de
busqueda, y el titulo de una publicacion de un medio SIEMPRE
menciona al objetivo —es justamente por eso que la URL se
encontro—. Resultado medido: Lloret con 8 de 8 cuentas
clasificadas como suyas, incluidos @UNSIONTV y
@RedInformativaCuenca. Peor que no clasificar.

El titulo es CONTENIDO, no el nombre de la cuenta. Solo cuenta
como nombre propio cuando el buscador lo devuelve en la forma
canonica que las plataformas usan para las cuentas:

  "Jota Lloret Valdivieso (@jotalloretv) / Posts / X"
  "Daniel Noboa (@danielnoboaok) - Instagram"

Ahi el nombre precede al handle entre parentesis: es el nombre
del titular. En cambio:

  "Juan Cristobal Lloret, actual prefecto del Azuay, ya no..."

es el texto de una publicacion, y no nombra a ningun titular.

Se extrae por tanto SOLO el nombre que acompana al handle.
-----------------------------------------------------------
*/

export function extraerNombreVisible(cuenta) {
  const handle = String(cuenta?.handle || "").trim();

  if (!handle) return null;

  /*
    Sin construir expresiones regulares: un handle puede
    contener puntos y guiones, y escaparlos correctamente es
    una fuente de errores gratuita. Con busqueda literal de
    subcadena no hay nada que escapar.
  */
  const marcadores = [`(@${handle})`, `(${handle})`, `[@${handle}]`];

  for (const titulo of cuenta?.titulosObservados || []) {
    const texto = String(titulo || "");

    const bajo = texto.toLowerCase();

    for (const marcador of marcadores) {
      const posicion = bajo.indexOf(marcador.toLowerCase());

      /*
        El nombre del titular precede al handle. Si el handle
        abre el titulo no hay nombre que extraer.
      */
      if (posicion > 0) {
        const previo = texto.slice(0, posicion).trim();

        if (previo.length >= 2 && previo.length <= 70) return previo;
      }
    }
  }

  return null;
}


export function llevaNombreDelObjetivo(cuenta, perfil) {
  const tokensNombre = tokenizar(
    normalizarTexto(perfil?.nombrePrincipal || ""),
    4
  );

  if (!tokensNombre.length) {
    return { lleva: false, coincidencias: [], motivo: "el objetivo no aporta tokens distintivos" };
  }

  /*
    Handle sin puntuación: un handle real concatena
    («jotalloretv»), así que la comparación es por inclusión de
    subcadena, no por token.
  */
  const handlePlano = normalizarTexto(cuenta?.handle || "").replace(
    /[^a-z0-9]/g,
    ""
  );

  /*
    SOLO el nombre propio de la cuenta. Nunca el titulo ni la
    descripcion del resultado: eso es contenido. Ver la nota de
    extraerNombreVisible.
  */
  const nombreVisible = normalizarTexto(
    cuenta?.nombreVisible || extraerNombreVisible(cuenta) || ""
  );

  const coincidencias = tokensNombre.filter(
    (t) => handlePlano.includes(t) || nombreVisible.includes(t)
  );

  /*
    ---------------------------------------------------------
    EL APELLIDO ES OBLIGATORIO
    ---------------------------------------------------------

    Defecto detectado en el QA de los cinco casos. Con "basta un
    token" se atribuyo a Juan Carlos Vega la cuenta

        @juan-carlos-garcia-macias

    que es otra persona: coincidian "juan" y "carlos", nombres de
    pila que comparten miles de personas.

    El ultimo token del nombre buscado es el que discrimina.
    Comprobado en los cinco objetivos del QA:

        Daniel Noboa           -> noboa    en DanielNoboaOk
        Juan Cristobal Lloret  -> lloret   en jotalloretv
        Yaku Perez             -> perez    en yakuperezg
        Marcelo Cabrera        -> cabrera  en MarceloHCabrera
        Juan Carlos Vega       -> vega     en JuanCVegaEC

    y rechaza garcia-macias, que es el resultado correcto.

    LIMITE CONOCIDO: si la consulta anade apellidos finales que
    la cuenta no usa ("Yaku Perez Guartambel" frente a
    @yakuperezg), la regla es mas estricta de lo necesario. Es
    el lado seguro del error: mejor no atribuir que atribuir a
    quien no es.
  */
  const apellido = tokensNombre[tokensNombre.length - 1];

  const llevaApellido = coincidencias.includes(apellido);

  const lleva = coincidencias.length > 0 && llevaApellido;

  return {
    lleva,
    coincidencias,
    enHandle: coincidencias.some((t) => handlePlano.includes(t)),
    nombreVisible: nombreVisible || null,

    apellidoRequerido: apellido,
    llevaApellido,

    motivo: lleva
      ? `la cuenta lleva ${coincidencias.join(", ")} del nombre del objetivo${
          nombreVisible ? ` (titular: "${nombreVisible}")` : ""
        }`
      : coincidencias.length
        ? `coincide en ${coincidencias.join(", ")} pero NO en el apellido "${apellido}", que es el token discriminante`
        : "ni el handle ni el nombre del titular contienen el nombre del objetivo"
  };
}


/*
===========================================================
CLASIFICAR
===========================================================
*/

export function clasificarCuenta(cuenta, perfil) {
  const handlePlano = normalizarTexto(cuenta?.handle || "").replace(
    /[^a-z0-9]/g,
    ""
  );

  const textoVisible = normalizarTexto(
    [
      ...(cuenta?.titulosObservados || []),
      ...(cuenta?.descripcionesObservadas || []),
      cuenta?.nombreVisible || ""
    ].join(" ")
  ).replace(/[^a-z0-9 ]/g, "");

  const razones = [];

  /*
    ---------------------------------------------------------
    REGLA 1 · NOMBRE DEL OBJETIVO — PRIORIDAD ABSOLUTA
    ---------------------------------------------------------

    Va primero para que el léxico no pueda destruir una cuenta
    real. Ver la nota de @jotalloretv en la cabecera.
  */
  const nombre = llevaNombreDelObjetivo(cuenta, perfil);

  if (nombre.lleva) {
    razones.push(nombre.motivo);

    /*
      Excepción estrecha: una institución cuyo nombre coincide
      con el del objetivo por pura homonimia territorial
      («prefectura del azuay» no lleva un nombre de persona).
      Solo se aplica si el token coincidente NO esta en el
      handle sino en el nombre del titular.
    */
    const institucional = contiene(handlePlano, LEXICO_INSTITUCION);

    if (!nombre.enHandle && institucional.length) {
      return {
        clase: CLASES.INSTITUCION,
        confianzaClase: "media",
        razones: [
          `el handle contiene el término institucional "${institucional[0]}"`,
          "el nombre del objetivo no está en el handle: la cuenta no se llama como él"
        ],
        esCandidataDelObjetivo: false,
        motivoSeparacion:
          "Cuenta institucional que menciona al objetivo. Separada para no mezclar instituciones con cuentas personales."
      };
    }

    return {
      clase: CLASES.CUENTA_PERSONAL,
      confianzaClase: nombre.enHandle ? "alta" : "media",
      razones: nombre.enHandle
        ? [`el handle "${cuenta.handle}" contiene ${nombre.coincidencias.join(", ")} del nombre del objetivo`]
        : [nombre.motivo, "el nombre está en el nombre del titular, no en el handle"],
      esCandidataDelObjetivo: true,
      motivoSeparacion: null
    };
  }

  /*
    ---------------------------------------------------------
    REGLA 2 · INSTITUCIÓN
    ---------------------------------------------------------
  */
  const inst = [
    ...contiene(handlePlano, LEXICO_INSTITUCION),
    ...contiene(textoVisible, LEXICO_INSTITUCION)
  ];

  const medio = [
    ...contiene(handlePlano, LEXICO_MEDIO),
    ...contiene(textoVisible, LEXICO_MEDIO)
  ];

  const instEnHandle = contiene(handlePlano, LEXICO_INSTITUCION);

  const medioEnHandle = contiene(handlePlano, LEXICO_MEDIO);

  /*
    El handle pesa más que el texto: el texto puede mencionar un
    ministerio de pasada, el handle es lo que la cuenta ES.
  */
  if (medioEnHandle.length && !instEnHandle.length) {
    return {
      clase: CLASES.MEDIO,
      confianzaClase: "alta",
      razones: [
        `el handle contiene ${medioEnHandle.slice(0, 3).join(", ")}, propio de un medio de comunicación`,
        "no lleva el nombre del objetivo: cubre al objetivo, no le pertenece"
      ],
      esCandidataDelObjetivo: false,
      motivoSeparacion:
        "Medio de comunicación. Separado para no mezclar medios con cuentas oficiales (regla congelada del Protocolo Universal)."
    };
  }

  if (instEnHandle.length) {
    return {
      clase: CLASES.INSTITUCION,
      confianzaClase: "alta",
      razones: [
        `el handle contiene ${instEnHandle.slice(0, 3).join(", ")}, propio de una institución`,
        "no lleva el nombre del objetivo"
      ],
      esCandidataDelObjetivo: false,
      motivoSeparacion:
        "Cuenta institucional. Una institución donde el objetivo trabaja no es su cuenta personal."
    };
  }

  if (medio.length >= 2) {
    return {
      clase: CLASES.MEDIO,
      confianzaClase: "media",
      razones: [
        `el texto visible contiene ${medio.slice(0, 3).join(", ")}, propio de un medio`,
        "no lleva el nombre del objetivo"
      ],
      esCandidataDelObjetivo: false,
      motivoSeparacion: "Probable medio de comunicación, separado del panel de cuentas."
    };
  }

  if (inst.length >= 2) {
    return {
      clase: CLASES.INSTITUCION,
      confianzaClase: "media",
      razones: [
        `el texto visible contiene ${inst.slice(0, 3).join(", ")}, propio de una institución`,
        "no lleva el nombre del objetivo"
      ],
      esCandidataDelObjetivo: false,
      motivoSeparacion: "Probable cuenta institucional, separada del panel de cuentas."
    };
  }

  /*
    ---------------------------------------------------------
    REGLA 3 · NO DETERMINADO
    ---------------------------------------------------------

    No lleva el nombre del objetivo y no hay léxico que la
    clasifique. NO se afirma que sea del objetivo —eso sería
    inventarlo— pero tampoco se descarta: queda declarada como
    indeterminada para que el analista decida.
  */
  const territorial = contiene(handlePlano, SUFIJOS_TERRITORIALES);

  return {
    clase: CLASES.NO_DETERMINADO,
    confianzaClase: "baja",
    razones: [
      "no lleva el nombre del objetivo",
      territorial.length
        ? `el handle solo aporta el sufijo territorial "${territorial[0]}"`
        : "ningún término la identifica como medio ni como institución"
    ],
    /*
      Sin nombre y sin clase, no se presenta como cuenta del
      objetivo. Aparece aparte, sin afirmar nada.
    */
    esCandidataDelObjetivo: false,
    motivoSeparacion:
      "No se pudo determinar de quién es. No lleva el nombre del objetivo y no hay indicios de medio ni institución: declararla suya sería inventarlo."
  };
}


/*
===========================================================
CLASIFICAR UN CONJUNTO Y SEPARARLO
===========================================================
*/

export function clasificarYSeparar(cuentas, perfil) {
  const cuentasObjetivo = [];
  const medios = [];
  const instituciones = [];
  const indeterminadas = [];

  (cuentas || []).forEach((c) => {
    const clasificacion = clasificarCuenta(c, perfil);

    const conClase = { ...c, clasificacion };

    if (clasificacion.clase === CLASES.CUENTA_PERSONAL) {
      cuentasObjetivo.push(conClase);
    } else if (clasificacion.clase === CLASES.MEDIO) {
      medios.push(conClase);
    } else if (clasificacion.clase === CLASES.INSTITUCION) {
      instituciones.push(conClase);
    } else {
      indeterminadas.push(conClase);
    }
  });

  return {
    version: "1.0",

    cuentasObjetivo,
    medios,
    instituciones,
    indeterminadas,

    metricas: {
      total: (cuentas || []).length,
      delObjetivo: cuentasObjetivo.length,
      medios: medios.length,
      instituciones: instituciones.length,
      indeterminadas: indeterminadas.length
    },

    /*
      IA1 — el criterio queda declarado, no solo aplicado.
    */
    criterio: {
      reglaPrincipal:
        "El nombre del objetivo en el handle o el nombre visible tiene prioridad absoluta sobre el léxico de tipo de entidad.",
      porQue:
        "Sin esa prioridad, un handle como @jotalloretv («Jota Lloret V») se clasificaría como medio por terminar en «tv», descartando la única cuenta real encontrada.",
      medios:
        "Un medio cubre al objetivo; no le pertenece. Se separa, no se descarta: quién cubre al objetivo es inteligencia.",
      instituciones:
        "Una institución donde el objetivo trabaja no es su cuenta personal.",
      indeterminadas:
        "Sin nombre y sin clase no se afirma pertenencia: declararla del objetivo sería inventarlo."
    }
  };
}


export default { CLASES, clasificarCuenta, clasificarYSeparar, llevaNombreDelObjetivo };
