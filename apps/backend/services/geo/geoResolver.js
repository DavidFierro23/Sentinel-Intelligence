// apps/backend/services/geo/geoResolver.js

import { normalizarTexto } from "../textUtils.js";

import {
  unidadPorId,
  indiceDeToponimos,
  ancestrosDe,
  estaContenidaEn
} from "./territoryRegistry.js";

import {
  PROCEDENCIAS,
  RESOLUCIONES,
  rangoDeResolucion,
  autorizaAtribucion,
  validarUbicacion
} from "./geoContracts.js";

/*
===========================================================
GEO RESOLVER — ubica un dato y DECLARA su procedencia
===========================================================

Entrada: una evidencia (titulo, descripcion, url, fecha).
Salida: una ubicacion con procedencia, confianza y motivo.

Las cuatro procedencias de WR-D2 no son etiquetas decorativas:
determinan hasta donde puede pintarse el dato despues. Por eso
el resolver nunca devuelve una unidad "a secas".

EL PROBLEMA REAL QUE RESUELVE
-----------------------------------------------------------

El catalogo de Cuenca esta lleno de toponimos que son tambien
otra cosa:

    Sucre        capital de Bolivia, canton de Manabi, y el
                 nombre de una avenida en casi toda ciudad
    Banos        Banos de Agua Santa (Tungurahua) tiene mucha
                 mas presencia en prensa que Banos de Cuenca
    Tarqui       la parroquia mas poblada de Guayaquil
    Machangara   un rio de Quito
    El Valle     sustantivo comun

Resolver "Sucre" a la parroquia de Cuenca porque aparece la
palabra seria repetir, en version geografica, el fallo que
AUD-001 documento con Pedro Palacios: una cronica de ciclismo
de Albacete contaminando el contexto de un alcalde.

Asi que una unidad marcada `ambiguo` NO se resuelve sin que el
texto aporte al menos uno de sus `requiereContexto`. Sin ese
respaldo la mencion se registra, pero no ubica.

DOS PARROQUIAS EN UNA MISMA NOTA
-----------------------------------------------------------

Una nota que nombra Yanuncay y El Batan no se cuenta en las
dos: eso duplicaria la evidencia y el ranking sumaria mas
menciones que notas existen.

Cuando ninguna domina, la ubicacion sube al ancestro comun
—el canton— con procedencia `agregada`, que es literalmente lo
que se sabe: que ocurrio en Cuenca. Las demas quedan en
`tambienMencionadas`, visibles pero sin puntuar.
===========================================================
*/


/*
-----------------------------------------------------------
PREPARAR TEXTO

normalizarTexto quita tildes y baja a minusculas pero conserva
la puntuacion. Para buscar toponimos hace falta ademas que
todo separador sea un espacio, y padding a los lados, para
poder exigir limite de palabra sin una sola expresion regular.
-----------------------------------------------------------
*/

function prepararTexto(texto) {
  const base = normalizarTexto(texto || "").replace(/[^a-z0-9ñ]+/g, " ");

  return ` ${base.replace(/\s+/g, " ").trim()} `;
}


/*
-----------------------------------------------------------
DETECTAR TOPONIMOS — coincidencia mas larga primero

"Santa Ana de los Rios de Cuenca" es el nombre completo del
canton y contiene "Santa Ana", que es una parroquia rural. Sin
preferencia por la coincidencia mas larga, el canton se
resolveria como su propia parroquia.

Se aceptan tramos que no se solapen, empezando por los mas
largos.
-----------------------------------------------------------
*/

function detectarToponimos(texto) {
  const preparado = prepararTexto(texto);

  if (preparado.trim().length === 0) return [];

  const indice = indiceDeToponimos();

  const bruto = [];

  for (const [clave, unidadIds] of indice.entries()) {
    const aguja = ` ${clave} `;

    let desde = 0;

    for (;;) {
      const pos = preparado.indexOf(aguja, desde);

      if (pos === -1) break;

      bruto.push({
        clave,
        unidadIds,
        inicio: pos,
        fin: pos + aguja.length,
        longitud: clave.length
      });

      /*
        Se avanza una sola posicion para no perder
        solapamientos: quien decide es el filtro de mas abajo.
      */
      desde = pos + 1;
    }
  }

  bruto.sort((a, b) => b.longitud - a.longitud || a.inicio - b.inicio);

  const aceptados = [];

  const ocupado = [];

  bruto.forEach((m) => {
    /*
      Los espacios de padding se comparten entre dos
      coincidencias contiguas, asi que el solape se mide sobre
      el interior del tramo.
    */
    const solapa = ocupado.some(
      (o) => m.inicio + 1 < o.fin - 1 && o.inicio + 1 < m.fin - 1
    );

    if (solapa) return;

    ocupado.push({ inicio: m.inicio, fin: m.fin });

    aceptados.push(m);
  });

  return aceptados;
}


/*
-----------------------------------------------------------
CONTEXTO PRESENTE EN EL TEXTO

Para una unidad ambigua, ¿aparece alguno de los terminos que
exige? Se comprueba contra el texto completo, no contra los
toponimos detectados: "parroquia" no es un toponimo pero es
contexto valido.
-----------------------------------------------------------
*/

function contextoPresente(
  unidad,
  textoPreparado,
  ambitoId,
  clavesCoincidentes,
  pistaDeFuente
) {
  const exigidos = unidad.requiereContexto || [];

  const encontrados = [];

  exigidos.forEach((termino) => {
    if (textoPreparado.includes(` ${normalizarTexto(termino)} `)) {
      encontrados.push(termino);
    }
  });

  /*
    -------------------------------------------------------
    AUTODESAMBIGUACION POR LA FORMA USADA

    La ambiguedad es del TOPONIMO, no de la unidad. "Cuenca" a
    secas es ambiguo; "Santa Ana de los Rios de Cuenca" no lo
    es en absoluto. "Banos" colisiona con Tungurahua; "Banos de
    Cuenca" no colisiona con nada.

    Medido: sin esta comprobacion, un titular con el nombre
    oficial completo del canton quedaba SIN UBICAR, que es el
    peor resultado posible sobre la forma mas inequivoca del
    nombre.

    Regla: si la forma que aparecio en el texto ya contiene uno
    de los terminos que la unidad exige, la propia mencion se
    desambigua sola. No hace falta buscarlo en otra parte de la
    nota.
    -------------------------------------------------------
  */
  const declaradosInequivocos = unidad.aliasInequivocos || [];

  const formaInequivoca = [...(clavesCoincidentes || [])].find(
    (clave) =>
      /*
        a) La forma esta DECLARADA como inequivoca en el
           catalogo. Es el caso del nombre oficial completo:
           «Santa Ana de los Rios de Cuenca» no lo lleva ningun
           otro lugar, pero no contiene «azuay» ni «ecuador»,
           asi que la comprobacion (b) por si sola la rechazaba.
      */
      declaradosInequivocos.includes(clave) ||
      /*
        b) La forma ya contiene uno de los terminos exigidos:
           «Banos de Cuenca» se desambigua sola.
      */
      exigidos.some((t) => ` ${clave} `.includes(` ${normalizarTexto(t)} `))
  );

  /*
    El ambito declarado por el ANALISTA tambien es contexto.

    Se distinguen dos casos que NO valen lo mismo:

      esElAmbito       el toponimo ES el ambito que el analista
                       declaro. Su declaracion es evidencia
                       directa sobre esa unidad y abre la
                       puerta, con confianza moderada.

      dentroDelAmbito  la unidad cuelga del ambito. Suma, pero
                       NO abre la puerta: que el proyecto sea de
                       Cuenca no impide que una nota hable de
                       Banos de Ambato.
  */
  const esElAmbito = Boolean(ambitoId) && unidad.id === ambitoId;

  const dentroDelAmbito = ambitoId
    ? estaContenidaEn(unidad.id, ambitoId)
    : false;

  /*
    -------------------------------------------------------
    COBERTURA DECLARADA DE LA FUENTE

    Esto NO es una inferencia sobre el texto: es un dato sobre
    el medio. Que "El Batan" aparezca en un diario cuya
    cobertura declarada es el canton Cuenca es evidencia real
    de que se trata del El Batan de Cuenca, y no del de Quito.

    Por que hacia falta: sin ella, la puerta de ambiguedad
    exigia que cada nota repitiera "Cuenca" para aceptar sus
    propias parroquias. Medido sobre un lote de prueba, "El
    Batan tendra nueva via" quedaba SIN UBICAR. La prensa local
    no repite el nombre de su ciudad en cada titular, asi que
    la regla estricta habria descartado justo la cobertura mas
    util.

    La salida no es relajar GEO-1 —la procedencia sigue siendo
    `derivada` y el tope sigue siendo la parroquia—, sino
    reconocer que la cobertura del medio es contexto declarado.

    DOS LIMITES, ambos medidos sobre casos que fallaban:

    1. La cobertura debe DISCRIMINAR. Un medio nacional cubre
       el pais entero, asi que "esta contenida en su cobertura"
       es cierto para las 40 unidades y no dice nada. Se exige
       cobertura de provincia o mas fina.

    2. Solo despeja ambiguedad EXTERNA. Que un diario de Cuenca
       publique "avenida Sucre" no convierte la avenida en la
       parroquia Sucre: ahi el choque es interno al propio
       canton y la cobertura local, si acaso, lo agrava. Esas
       unidades siguen exigiendo contexto explicito en el
       texto.
    -------------------------------------------------------
  */
  const coberturaDiscrimina =
    Boolean(pistaDeFuente?.unidadId) &&
    (rangoDeResolucion(pistaDeFuente.resolucion) || 0) >=
      rangoDeResolucion(RESOLUCIONES.PROVINCIA);

  const ambiguedadExterna =
    !unidad.ambiguo || unidad.ambiguedad === "externa";

  const respaldadaPorFuente = Boolean(
    coberturaDiscrimina &&
      ambiguedadExterna &&
      pistaDeFuente.unidadId !== unidad.id &&
      estaContenidaEn(unidad.id, pistaDeFuente.unidadId)
  );

  return {
    terminos: encontrados,
    formaInequivoca: formaInequivoca || null,
    esElAmbito,
    dentroDelAmbito,
    respaldadaPorFuente,
    fuenteCobertura: respaldadaPorFuente ? pistaDeFuente.unidadId : null
  };
}


/*
===========================================================
PUNTUACION DE UNA CANDIDATA
===========================================================

Escala 0-100. No se compara con nada externo: solo ordena
candidatas entre si y alimenta la confianza declarada.
===========================================================
*/

const PESOS = Object.freeze({
  BASE: 40,
  NO_AMBIGUA: 25,
  FORMA_INEQUIVOCA: 25,
  FUENTE_LOCAL: 18,
  ES_EL_AMBITO: 12,
  CONTEXTO_POR_TERMINO: 15,
  DENTRO_DEL_AMBITO: 20,
  REPETICION: 8,
  TOPE_REPETICION: 16
});


function puntuar(unidad, ocurrencias, contexto) {
  let p = PESOS.BASE;

  const razones = [`toponimo "${unidad.nombre}" presente en el texto (+${PESOS.BASE})`];

  if (!unidad.ambiguo) {
    p += PESOS.NO_AMBIGUA;
    razones.push(`toponimo no ambiguo en el catalogo (+${PESOS.NO_AMBIGUA})`);
  } else if (contexto.formaInequivoca) {
    p += PESOS.FORMA_INEQUIVOCA;
    razones.push(
      `la forma citada ("${contexto.formaInequivoca}") es inequivoca por si misma (+${PESOS.FORMA_INEQUIVOCA})`
    );
  } else if (contexto.respaldadaPorFuente) {
    p += PESOS.FUENTE_LOCAL;
    razones.push(
      `la unidad esta dentro de la cobertura declarada de la fuente (+${PESOS.FUENTE_LOCAL})`
    );
  } else if (contexto.esElAmbito) {
    p += PESOS.ES_EL_AMBITO;
    razones.push(
      `el toponimo es el ambito declarado por el analista (+${PESOS.ES_EL_AMBITO})`
    );
  }

  const porContexto = Math.min(
    contexto.terminos.length * PESOS.CONTEXTO_POR_TERMINO,
    45
  );

  if (porContexto) {
    p += porContexto;
    razones.push(
      `contexto exigido presente: ${contexto.terminos.join(", ")} (+${porContexto})`
    );
  }

  if (contexto.dentroDelAmbito) {
    p += PESOS.DENTRO_DEL_AMBITO;
    razones.push(
      `la unidad pertenece al ambito declarado por el analista (+${PESOS.DENTRO_DEL_AMBITO})`
    );
  }

  const extra = Math.min(
    (ocurrencias - 1) * PESOS.REPETICION,
    PESOS.TOPE_REPETICION
  );

  if (extra) {
    p += extra;
    razones.push(`mencionada ${ocurrencias} veces (+${extra})`);
  }

  return { puntuacion: Math.min(100, p), razones };
}


/*
===========================================================
RESOLVER UNA EVIDENCIA
===========================================================

`opciones`:

  ambitoId        unidad del proyecto; contexto, no filtro
  pistaDeFuente   { unidadId, resolucion, procedencia, motivo }
                  la aporta quien conoce la fuente (un medio
                  local cubre su canton). El resolver no
                  consulta el registro de medios: eso
                  ataria geo/ a conversation/
  resolucionMaxima  tope duro opcional
===========================================================
*/

export function resolverUbicacion(evidencia = {}, opciones = {}) {
  const ambitoId = opciones.ambitoId || null;

  const sinUbicar = (motivo) => ({
    unidadId: null,
    unidad: null,
    resolucion: null,
    procedencia: PROCEDENCIAS.DESCONOCIDA,
    confianza: 0,
    motivo,
    razones: [],
    toponimosDetectados: [],
    tambienMencionadas: [],
    mencionesNoCertificadas: [],
    candidatas: []
  });

  /*
    ---------------------------------------------------------
    1. UBICACION DECLARADA

    Si el dato ya trae unidad explicita, no hay nada que
    inferir. Es el unico camino que habilita resolucion de
    punto.
    ---------------------------------------------------------
  */
  const declarada = evidencia.ubicacionDeclarada || evidencia.ubicacion || null;

  if (declarada?.unidadId) {
    const unidad = unidadPorId(declarada.unidadId);

    if (unidad) {
      return {
        unidadId: unidad.id,
        unidad,
        resolucion: declarada.resolucion || unidad.resolucion,
        procedencia: PROCEDENCIAS.DECLARADA,
        confianza: 100,
        motivo:
          "La evidencia trae unidad territorial explicita. No se infirio nada.",
        razones: ["ubicacion declarada por la fuente (+100)"],
        toponimosDetectados: [],
        tambienMencionadas: [],
        mencionesNoCertificadas: [],
        candidatas: []
      };
    }
  }

  /*
    ---------------------------------------------------------
    2. TOPONIMOS EN EL TEXTO
    ---------------------------------------------------------
  */
  const texto = [
    evidencia.titulo,
    evidencia.descripcion,
    evidencia.resumen,
    evidencia.contenido
  ]
    .filter((t) => typeof t === "string" && t.trim())
    .join(" . ");

  const preparado = prepararTexto(texto);

  const detectados = detectarToponimos(texto);

  /*
    Ocurrencias por unidad. Un mismo toponimo puede apuntar a
    varias unidades (nombre compartido entre jerarquias).
  */
  const ocurrencias = new Map();

  detectados.forEach((m) => {
    m.unidadIds.forEach((id) => {
      if (!ocurrencias.has(id)) {
        ocurrencias.set(id, { veces: 0, claves: new Set() });
      }

      const entrada = ocurrencias.get(id);

      entrada.veces += 1;

      /*
        Se guarda QUE forma del nombre aparecio, no solo cuantas
        veces. Es lo que permite distinguir "Cuenca" de "Santa
        Ana de los Rios de Cuenca": la segunda se desambigua
        sola y la primera no.
      */
      entrada.claves.add(m.clave);
    });
  });

  if (ocurrencias.size === 0) {
    /*
      -------------------------------------------------------
      3. PISTA DE LA FUENTE

      Sin toponimo, lo unico que queda es lo que se sepa del
      medio que publica. Un diario local de Cuenca cubre
      Cuenca: eso es informacion real, pero AGREGADA, porque
      el dato solo existe a nivel canton.
      -------------------------------------------------------
    */
    const pista = opciones.pistaDeFuente || null;

    if (pista?.unidadId && unidadPorId(pista.unidadId)) {
      const unidad = unidadPorId(pista.unidadId);

      return {
        unidadId: unidad.id,
        unidad,
        resolucion: pista.resolucion || unidad.resolucion,
        procedencia: PROCEDENCIAS.AGREGADA,
        confianza: 40,
        motivo:
          pista.motivo ||
          "Sin toponimo en el texto. Se ubica en el ambito de cobertura de la fuente, y solo en esa unidad.",
        razones: [`ambito de cobertura de la fuente (+40)`],
        toponimosDetectados: [],
        tambienMencionadas: [],
        mencionesNoCertificadas: [],
        candidatas: []
      };
    }

    return sinUbicar(
      "Ningun toponimo del catalogo aparece en el texto y la fuente no declara ambito de cobertura."
    );
  }

  /*
    ---------------------------------------------------------
    4. PUNTUAR Y FILTRAR AMBIGUAS SIN RESPALDO
    ---------------------------------------------------------
  */
  const candidatas = [];

  const descartadas = [];

  /*
    GATE B. Toponimos reconocidos que NO atribuyen: barrios,
    sectores, vias e hitos sin fuente oficial.

    Van en su propia lista y no en `descartadas`, porque no se
    descartaron por sospechosos: se reconocieron y se registro
    la mencion. Lo que no producen es ubicacion.

    Mezclarlos con los descartes por ambiguedad haria imposible
    distinguir «no supimos que era» de «supimos que era, y aun
    asi no ubica».
  */
  const mencionesNoCertificadas = [];

  ocurrencias.forEach((entrada, id) => {
    const unidad = unidadPorId(id);

    if (!unidad) return;

    const permiso = autorizaAtribucion(unidad);

    if (!permiso.autoriza) {
      mencionesNoCertificadas.push({
        unidadId: unidad.id,
        nombre: unidad.nombre,
        tipo: unidad.tipo || null,
        resolucion: unidad.resolucion,
        verificado: unidad.verificado === true,
        padreFuente: unidad.padreFuente || null,
        formaCitada: [...entrada.claves].join(", "),
        motivo: permiso.motivo
      });

      return;
    }

    const contexto = contextoPresente(
      unidad,
      preparado,
      ambitoId,
      entrada.claves,
      opciones.pistaDeFuente || null
    );

    /*
      LA PUERTA. Una unidad ambigua exige respaldo. Cuatro vias
      lo dan, y solo cuatro:

        1. la forma citada ya es inequivoca por si misma
        2. el texto trae alguno de los terminos exigidos
        3. la unidad esta dentro de la cobertura declarada de
           la fuente que publica
        4. el toponimo ES el ambito que declaro el analista

      Pertenecer al ambito del proyecto NO es una de ellas: que
      el proyecto sea de Cuenca no impide que una nota hable de
      Banos de Ambato. La cobertura de la fuente si lo es,
      porque es un dato sobre quien publica, no una suposicion
      sobre lo publicado.
    */
    const respaldada =
      Boolean(contexto.formaInequivoca) ||
      contexto.terminos.length > 0 ||
      contexto.respaldadaPorFuente ||
      contexto.esElAmbito;

    if (unidad.ambiguo && !respaldada) {
      descartadas.push({
        unidadId: unidad.id,
        nombre: unidad.nombre,
        formaCitada: [...entrada.claves].join(", "),
        motivo: `Toponimo ambiguo sin contexto de respaldo. ${
          unidad.notaAmbiguedad || ""
        } Se exige alguno de: ${(unidad.requiereContexto || []).join(", ")}.`.trim()
      });

      return;
    }

    const { puntuacion, razones } = puntuar(unidad, entrada.veces, contexto);

    candidatas.push({
      unidadId: unidad.id,
      unidad,
      resolucion: unidad.resolucion,
      ocurrencias: entrada.veces,
      puntuacion,
      razones
    });
  });

  if (candidatas.length === 0) {
    return {
      ...sinUbicar(
        "Se detectaron toponimos, pero todos son ambiguos y ninguno trae el contexto que el catalogo exige para resolverlo."
      ),
      toponimosDetectados: detectados.map((d) => d.clave),
      candidatas: descartadas,
      mencionesNoCertificadas
    };
  }

  /*
    ---------------------------------------------------------
    5. ELEGIR

    Primero por resolucion mas fina: si la nota nombra el
    canton Y una parroquia, la parroquia es lo que aporta.
    Dentro de la misma resolucion, por puntuacion.
    ---------------------------------------------------------
  */
  candidatas.sort(
    (a, b) =>
      (rangoDeResolucion(b.resolucion) || 0) -
        (rangoDeResolucion(a.resolucion) || 0) ||
      b.puntuacion - a.puntuacion
  );

  const mejor = candidatas[0];

  const empatadas = candidatas.filter(
    (c) =>
      c.resolucion === mejor.resolucion &&
      c.puntuacion === mejor.puntuacion &&
      c.unidadId !== mejor.unidadId
  );

  /*
    ---------------------------------------------------------
    6. EMPATE — no se elige, se sube

    Dos parroquias igual de respaldadas en la misma nota. Elegir
    una seria arbitrario y contarlas ambas duplicaria la
    evidencia. Lo que de verdad se sabe es el ancestro comun.
    ---------------------------------------------------------
  */
  if (empatadas.length > 0) {
    const todas = [mejor, ...empatadas];

    const comun = ancestroComun(todas.map((c) => c.unidadId));

    const nombres = todas.map((c) => c.unidad.nombre).join(", ");

    if (comun) {
      return {
        unidadId: comun.id,
        unidad: comun,
        resolucion: comun.resolucion,
        procedencia: PROCEDENCIAS.AGREGADA,
        confianza: 55,
        motivo: `La evidencia nombra ${todas.length} unidades de igual peso (${nombres}). Atribuirla a una sola seria arbitrario y a todas duplicaria la evidencia: se agrega en el ancestro comun.`,
        razones: [`ancestro comun de ${nombres}`],
        toponimosDetectados: detectados.map((d) => d.clave),
        tambienMencionadas: todas.map((c) => ({
          unidadId: c.unidadId,
          nombre: c.unidad.nombre,
          puntuacion: c.puntuacion
        })),
        candidatas: descartadas,
      mencionesNoCertificadas
      };
    }

    return {
      ...sinUbicar(
        `La evidencia nombra ${todas.length} unidades de igual peso (${nombres}) sin ancestro comun en el registro.`
      ),
      toponimosDetectados: detectados.map((d) => d.clave),
      candidatas: descartadas,
      mencionesNoCertificadas
    };
  }

  /*
    ---------------------------------------------------------
    7. RESULTADO — derivada

    Nunca `declarada`: resolver un toponimo de un texto no es
    lo mismo que que la fuente declare la ubicacion. Es la
    distincion que evita el pin afilado sobre una esquina
    cuando el dato solo decia "Cuenca".
    ---------------------------------------------------------
  */
  const otras = candidatas
    .slice(1)
    .map((c) => ({
      unidadId: c.unidadId,
      nombre: c.unidad.nombre,
      resolucion: c.resolucion,
      puntuacion: c.puntuacion
    }));

  let resolucion = mejor.resolucion;

  /*
    Tope duro opcional del llamante.
  */
  if (
    opciones.resolucionMaxima &&
    (rangoDeResolucion(resolucion) || 0) >
      (rangoDeResolucion(opciones.resolucionMaxima) || 0)
  ) {
    resolucion = opciones.resolucionMaxima;
  }

  return {
    unidadId: mejor.unidadId,
    unidad: mejor.unidad,
    resolucion,
    procedencia: PROCEDENCIAS.DERIVADA,
    confianza: mejor.puntuacion,
    motivo: `Resuelto desde el toponimo "${mejor.unidad.nombre}" citado en el texto.`,
    razones: mejor.razones,
    toponimosDetectados: detectados.map((d) => d.clave),
    tambienMencionadas: otras,
    candidatas: descartadas,
    mencionesNoCertificadas
  };
}


/*
-----------------------------------------------------------
ANCESTRO COMUN MAS PROFUNDO
-----------------------------------------------------------
*/

function ancestroComun(unidadIds) {
  if (!unidadIds?.length) return null;

  const cadenas = unidadIds.map((id) => [
    id,
    ...ancestrosDe(id).map((a) => a.id)
  ]);

  const [primera, ...resto] = cadenas;

  /*
    La primera cadena va de la unidad hacia la raiz, asi que el
    primer elemento compartido por todas es el mas profundo.
  */
  const comun = primera.find((id) => resto.every((c) => c.includes(id)));

  return comun ? unidadPorId(comun) : null;
}


/*
===========================================================
RESOLVER UN LOTE

Devuelve las ubicaciones y el recuento de `sin ubicar`, que es
obligatorio en toda capa (UX-WR-001 §1: "lo que no se puede
ubicar no desaparece").
===========================================================
*/

export function resolverLote(evidencias = [], opciones = {}) {
  const lista = Array.isArray(evidencias) ? evidencias : [];

  const ubicadas = [];

  const sinUbicar = [];

  const porProcedencia = {
    declarada: 0,
    derivada: 0,
    agregada: 0,
    desconocida: 0
  };

  /*
    La pista de fuente es POR EVIDENCIA: cada una la publica un
    dominio distinto y cada dominio cubre un territorio
    distinto.

    Se recibe como funcion y no como dato para que este modulo
    no tenga que importar el registro de medios. geo/ no debe
    depender de conversation/: es el mismo motivo por el que el
    Fusion Engine no conoce a ningun buscador concreto.
  */
  const pistaPorEvidencia =
    typeof opciones.pistaPorEvidencia === "function"
      ? opciones.pistaPorEvidencia
      : null;

  lista.forEach((evidencia, indice) => {
    const pista = pistaPorEvidencia
      ? pistaPorEvidencia(evidencia, indice)
      : opciones.pistaDeFuente || null;

    const ubicacion = resolverUbicacion(evidencia, {
      ...opciones,
      pistaDeFuente: pista
    });

    porProcedencia[ubicacion.procedencia] += 1;

    const registro = { indice, evidencia, ubicacion };

    if (ubicacion.procedencia === PROCEDENCIAS.DESCONOCIDA) {
      sinUbicar.push(registro);
    } else {
      const validacion = validarUbicacion({
        procedencia: ubicacion.procedencia,
        resolucion: ubicacion.resolucion,
        unidadId: ubicacion.unidadId
      });

      if (!validacion.valida) {
        sinUbicar.push({
          ...registro,
          motivoDescartada: validacion.errores.join("; ")
        });

        porProcedencia[ubicacion.procedencia] -= 1;
        porProcedencia.desconocida += 1;

        return;
      }

      ubicadas.push(registro);
    }
  });

  const total = lista.length;

  return {
    total,
    ubicadas,
    sinUbicar,

    metricas: {
      total,
      ubicadas: ubicadas.length,
      sinUbicar: sinUbicar.length,

      porcentajeSinUbicar:
        total > 0 ? Number(((sinUbicar.length / total) * 100).toFixed(1)) : 0,

      porProcedencia
    },

    /*
      Se declara siempre, tambien cuando vale cero: un contador
      que solo aparece cuando hay problema entrena al analista
      a no buscarlo.
    */
    declaracion:
      total === 0
        ? "No se recibio ninguna evidencia que ubicar."
        : `${ubicadas.length} de ${total} evidencias ubicadas. ${sinUbicar.length} sin ubicar (${
            total > 0 ? ((sinUbicar.length / total) * 100).toFixed(1) : 0
          } %). La ausencia de ubicacion no es ausencia de hecho.`
  };
}


export default {
  resolverUbicacion,
  resolverLote,
  RESOLUCIONES,
  PROCEDENCIAS
};
