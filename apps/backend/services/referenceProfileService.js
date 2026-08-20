// apps/backend/services/referenceProfileService.js

import { normalizarObjetivo } from "./identityService.js";

/*
  Sprint 3.1 — el Reference Profile Service es el punto de
  entrada único de la ficha del objetivo. La consolidación
  vive en su propio módulo (no se reescribe este archivo) y
  se reexporta aquí.
*/
export { consolidarFichaObjetivo } from "./social/objectiveProfileConsolidator.js";

import {
  normalizarTexto,
  tokenizar,
  normalizarUrl,
  extraerDominio,
  detectarPlataformaPorUrl,
  extraerHandle,
  obtenerEnlace,
  textoDeResultado,
  contarFrecuencias,
  limitar
} from "./textUtils.js";

/*
===========================================================
SENTINEL INTELLIGENCE
REFERENCE PROFILE SERVICE — Perfil de Referencia
===========================================================

POSICIÓN EN EL FLUJO:

  OBJETIVO
    ↓
  DESCUBRIMIENTO GENERAL      (Google/DDG, News, Wayback, Whois)
    ↓
  PERFIL DE REFERENCIA        ← ESTE SERVICIO
    ↓
  VARIANTES Y CONTEXTO
    ↓
  (siguiente sprint) FUSION SEARCH ENGINE


QUÉ HACE:

Toma los resultados que YA obtuvo el descubrimiento general
y destila un perfil que describe al objetivo con evidencias.


QUÉ NO HACE — reglas estrictas:

1. NO inventa datos. Todo atributo procede de una evidencia
   concreta y guarda su origen.
2. NO afirma identidad. El perfil describe al OBJETIVO
   BUSCADO, no certifica que una cuenta le pertenezca.
3. NO consulta fuentes externas. Es una función pura sobre
   los resultados ya obtenidos.
4. NO puede romper la investigación: ante cualquier fallo
   devuelve null y el flujo continúa.

Los campos `terminosDiscriminantes` y `handlesObservados`
son la salida destinada al Fusion Engine y a Social
Discovery, para dejar de buscar solamente por nombre.
===========================================================
*/


/*
-----------------------------------------------------------
VOCABULARIO DE CONTEXTO

Términos que, cuando aparecen en las evidencias, describen
un contexto público. Son SEÑALES, no afirmaciones: que un
resultado diga "presidente" no convierte al objetivo en
presidente; indica que el contexto recuperado es ese.
-----------------------------------------------------------
*/

const VOCABULARIO_ROL = [
  "presidente", "presidenta", "vicepresidente", "expresidente",
  "candidato", "candidata", "ministro", "ministra", "alcalde",
  "alcaldesa", "prefecto", "prefecta", "gobernador", "gobernadora",
  "asambleista", "diputado", "diputada", "senador", "senadora",
  "concejal", "embajador", "embajadora", "juez", "jueza", "fiscal",
  "empresario", "empresaria", "gerente", "director", "directora",
  "presidente ejecutivo", "fundador", "fundadora", "periodista",
  "abogado", "abogada", "medico", "medica", "profesor", "profesora",
  "investigador", "investigadora", "artista", "cantante", "actor",
  "actriz", "deportista", "futbolista", "escritor", "escritora"
];

const VOCABULARIO_PAIS = [
  "ecuador", "colombia", "peru", "bolivia", "venezuela", "chile",
  "argentina", "brasil", "mexico", "espana", "uruguay", "paraguay",
  "panama", "costa rica", "guatemala", "honduras", "nicaragua",
  "salvador", "republica dominicana", "cuba", "estados unidos"
];

const GENTILICIOS = {
  ecuatoriano: "ecuador",
  ecuatoriana: "ecuador",
  colombiano: "colombia",
  colombiana: "colombia",
  peruano: "peru",
  peruana: "peru",
  boliviano: "bolivia",
  boliviana: "bolivia",
  chileno: "chile",
  chilena: "chile",
  argentino: "argentina",
  argentina: "argentina",
  mexicano: "mexico",
  mexicana: "mexico",
  espanol: "espana",
  espanola: "espana"
};

const VOCABULARIO_ORGANIZACION = [
  "gobierno", "presidencia", "ministerio", "asamblea", "congreso",
  "municipio", "alcaldia", "prefectura", "partido", "movimiento",
  "universidad", "fundacion", "empresa", "corporacion", "grupo",
  "banco", "camara", "federacion", "asociacion", "instituto",
  "secretaria", "consejo", "tribunal", "corte"
];


/*
-----------------------------------------------------------
REGISTRAR EVIDENCIA

Toda señal del perfil se acompaña de la evidencia que la
sustenta. Sin evidencia no hay atributo.
-----------------------------------------------------------
*/

function crearEvidencia(resultado, indice) {
  const enlace = obtenerEnlace(resultado);

  return {
    id: `ev-${indice}`,
    titulo: resultado?.titulo || "(sin título)",
    enlace: enlace || null,
    urlNormalizada: enlace ? normalizarUrl(enlace) : null,
    dominio: enlace ? extraerDominio(enlace) : null,
    origen: resultado?.__origen || "Descubrimiento general",
    fecha: resultado?.fecha || null
  };
}


/*
-----------------------------------------------------------
DETECTAR SEÑALES DE VOCABULARIO en un texto
-----------------------------------------------------------
*/

function detectarEnVocabulario(texto, vocabulario) {
  const encontrados = [];

  vocabulario.forEach((termino) => {
    const patron = new RegExp(`\\b${termino.replace(/\s+/g, "\\s+")}\\b`, "i");

    if (patron.test(texto)) encontrados.push(termino);
  });

  return encontrados;
}


/*
-----------------------------------------------------------
ACUMULAR SEÑAL

Agrupa apariciones del mismo valor y acumula sus evidencias
y las fuentes/motores que lo respaldan.
-----------------------------------------------------------
*/

function acumularSenal(mapa, valor, evidencia) {
  const clave = normalizarTexto(valor);

  if (!clave) return;

  if (!mapa.has(clave)) {
    mapa.set(clave, {
      valor,
      apariciones: 0,
      evidencias: [],
      vistas: new Set(),
      fuentes: new Set()
    });
  }

  const registro = mapa.get(clave);

  /*
    Una misma evidencia cuenta UNA vez por señal.

    Sin esto, "ecuador" detectado por mención directa y por
    gentilicio en el mismo resultado se contaría dos veces
    e inflaría la confianza.
  */
  if (registro.vistas.has(evidencia.id)) return;

  registro.vistas.add(evidencia.id);

  registro.apariciones += 1;

  if (registro.evidencias.length < 5) {
    registro.evidencias.push(evidencia.id);
  }

  registro.fuentes.add(evidencia.origen);
}


/*
-----------------------------------------------------------
SERIALIZAR SEÑALES

Convierte el mapa interno en una lista ordenada y expone
`fuentes` como array (Set no es serializable a JSON).
-----------------------------------------------------------
*/

function serializarSenales(mapa, limite = 12) {
  return [...mapa.values()]
    .sort((a, b) => {
      if (b.fuentes.size !== a.fuentes.size) return b.fuentes.size - a.fuentes.size;
      return b.apariciones - a.apariciones;
    })
    .slice(0, limite)
    .map((registro) => ({
      valor: registro.valor,
      apariciones: registro.apariciones,
      fuentes: [...registro.fuentes],
      evidencias: registro.evidencias
    }));
}


/*
-----------------------------------------------------------
CONSTRUIR PERFIL DE REFERENCIA
-----------------------------------------------------------
*/

export function construirPerfilReferencia(objetivo, resultados = []) {
  const identidad = normalizarObjetivo(objetivo);

  const lista = Array.isArray(resultados) ? resultados : [];

  /*
    Evidencias — una por resultado del descubrimiento general.
  */
  const evidencias = lista.map((resultado, i) => crearEvidencia(resultado, i));

  /*
    Acumuladores de señales.
  */
  const roles = new Map();
  const paises = new Map();
  const organizaciones = new Map();
  const plataformas = new Map();
  const handles = new Map();
  const dominios = new Map();

  const tokensGlobales = [];

  const nombreNormalizado = identidad.normalizado;

  let resultadosConNombre = 0;

  /*
    ---------------------------------------------------------
    RECORRIDO DE EVIDENCIAS
    ---------------------------------------------------------
  */
  lista.forEach((resultado, i) => {
    const evidencia = evidencias[i];

    const texto = textoDeResultado(resultado);
    const textoNorm = normalizarTexto(texto);

    /*
      ¿La evidencia menciona el nombre buscado?
    */
    const mencionaNombre =
      nombreNormalizado && textoNorm.includes(nombreNormalizado);

    if (mencionaNombre) resultadosConNombre += 1;

    /*
      ROL / CONTEXTO PÚBLICO
    */
    detectarEnVocabulario(textoNorm, VOCABULARIO_ROL).forEach((rol) =>
      acumularSenal(roles, rol, evidencia)
    );

    /*
      PAÍS — por mención directa o por gentilicio
    */
    detectarEnVocabulario(textoNorm, VOCABULARIO_PAIS).forEach((pais) =>
      acumularSenal(paises, pais, evidencia)
    );

    Object.entries(GENTILICIOS).forEach(([gentilicio, pais]) => {
      if (new RegExp(`\\b${gentilicio}\\b`, "i").test(textoNorm)) {
        acumularSenal(paises, pais, evidencia);
      }
    });

    /*
      ORGANIZACIÓN
    */
    detectarEnVocabulario(textoNorm, VOCABULARIO_ORGANIZACION).forEach((org) =>
      acumularSenal(organizaciones, org, evidencia)
    );

    /*
      PLATAFORMA · HANDLE · DOMINIO — desde la URL, nunca
      desde el texto del título.
    */
    const enlace = obtenerEnlace(resultado);

    if (enlace) {
      const dominio = extraerDominio(enlace);

      if (dominio) acumularSenal(dominios, dominio, evidencia);

      const plataforma = detectarPlataformaPorUrl(enlace);

      if (plataforma) {
        acumularSenal(plataformas, plataforma.nombre, evidencia);

        /*
          Solo las plataformas sociales y de vídeo tienen
          handles de usuario. Wikipedia o Wayback producirían
          falsos usuarios ("wiki", "web").
        */
        const admiteHandle =
          plataforma.tipo === "social" || plataforma.tipo === "video";

        const handle = admiteHandle ? extraerHandle(enlace) : null;

        if (handle) {
          const clave = `${plataforma.nombre}:${handle}`;

          if (!handles.has(clave)) {
            handles.set(clave, {
              plataforma: plataforma.nombre,
              plataformaId: plataforma.id,
              handle,
              enlace,
              urlNormalizada: normalizarUrl(enlace),
              apariciones: 0,
              evidencias: [],
              fuentes: new Set(),
              coincideConVariante: identidad.variantesHandle.some(
                (v) => normalizarTexto(v) === normalizarTexto(handle)
              )
            });
          }

          const registro = handles.get(clave);

          registro.apariciones += 1;

          if (registro.evidencias.length < 5) registro.evidencias.push(evidencia.id);

          registro.fuentes.add(evidencia.origen);
        }
      }
    }

    /*
      TOKENS para términos discriminantes — solo de
      evidencias que mencionan el nombre buscado, para no
      contaminar el perfil con ruido no relacionado.
    */
    if (mencionaNombre) {
      tokensGlobales.push(...tokenizar(texto));
    }
  });

  /*
    ---------------------------------------------------------
    TÉRMINOS DISCRIMINANTES

    Términos frecuentes en las evidencias del objetivo que
    NO forman parte del propio nombre. Son los que permitirán
    al Fusion Engine distinguir al objetivo de un homónimo.
    ---------------------------------------------------------
  */
  const palabrasDelNombre = new Set(identidad.palabras);

  const frecuencias = contarFrecuencias(
    tokensGlobales.filter((t) => !palabrasDelNombre.has(t))
  );

  /*
    Texto normalizado de cada evidencia, calculado una sola
    vez y reutilizado para localizar el soporte de cada
    término (evita un recorrido cuadrático).
  */
  const textosNormalizados = lista.map((r) =>
    normalizarTexto(textoDeResultado(r))
  );

  const terminosDiscriminantes = [...frecuencias.entries()]
    .filter(([, veces]) => veces >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([termino, veces]) => {
      const soporte = [];

      textosNormalizados.forEach((texto, i) => {
        if (texto.includes(termino)) soporte.push(evidencias[i]);
      });

      return {
        termino,
        apariciones: veces,
        fuentes: [...new Set(soporte.map((ev) => ev.origen))],
        evidencias: soporte.slice(0, 5).map((ev) => ev.id)
      };
    });

  /*
    ---------------------------------------------------------
    HANDLES OBSERVADOS
    ---------------------------------------------------------
  */
  const handlesObservados = [...handles.values()]
    .sort((a, b) => {
      if (a.coincideConVariante !== b.coincideConVariante) {
        return a.coincideConVariante ? -1 : 1;
      }
      return b.apariciones - a.apariciones;
    })
    .slice(0, 20)
    .map((registro) => ({
      plataforma: registro.plataforma,
      plataformaId: registro.plataformaId,
      handle: registro.handle,
      enlace: registro.enlace,
      urlNormalizada: registro.urlNormalizada,
      apariciones: registro.apariciones,
      fuentes: [...registro.fuentes],
      evidencias: registro.evidencias,
      coincideConVariante: registro.coincideConVariante,
      /*
        Un handle observado es un CANDIDATO. Que exista una
        cuenta con nombre parecido no prueba pertenencia.
      */
      estado: "observado_no_verificado"
    }));

  /*
    ---------------------------------------------------------
    CONTEXTO
    ---------------------------------------------------------
  */
  const rolesSerializados = serializarSenales(roles, 8);
  const paisesSerializados = serializarSenales(paises, 5);
  const organizacionesSerializadas = serializarSenales(organizaciones, 8);

  const contexto = {
    rol: rolesSerializados[0]?.valor || null,
    roles: rolesSerializados,
    pais: paisesSerializados[0]?.valor || null,
    paises: paisesSerializados,
    organizaciones: organizacionesSerializadas,
    /*
      Contexto declarado por el usuario con "objetivo: contexto".
      Se marca como declarado, no como evidencia encontrada.
    */
    declaradoPorUsuario: identidad.contexto || null
  };

  /*
    ---------------------------------------------------------
    ATRIBUTOS CON EVIDENCIA Y CONFIANZA

    Cada atributo declara de dónde salió.
    ---------------------------------------------------------
  */
  const atributos = [];

  function registrarAtributo(campo, valor, senal, base) {
    if (!valor || !senal) return;

    const confianza = limitar(
      base + senal.fuentes.length * 10 + Math.min(senal.apariciones * 4, 20),
      0,
      95
    );

    atributos.push({
      campo,
      valor,
      confianza,
      apariciones: senal.apariciones,
      fuentes: senal.fuentes,
      evidencias: senal.evidencias
    });
  }

  registrarAtributo("rol", contexto.rol, rolesSerializados[0], 30);
  registrarAtributo("pais", contexto.pais, paisesSerializados[0], 30);
  registrarAtributo(
    "organizacion",
    organizacionesSerializadas[0]?.valor,
    organizacionesSerializadas[0],
    25
  );

  /*
    ---------------------------------------------------------
    CONFIANZA GLOBAL DEL PERFIL

    Mide cuán sustentado está el perfil, NO cuán cierta es
    una identidad. Es explicable: cada componente se declara.
    ---------------------------------------------------------
  */
  const componentes = [];

  let confianzaGlobal = 0;

  if (lista.length > 0) {
    const puntos = Math.min(lista.length * 2, 20);
    confianzaGlobal += puntos;
    componentes.push({
      componente: "Volumen de evidencias",
      detalle: `${lista.length} resultados en el descubrimiento general`,
      puntos
    });
  }

  if (resultadosConNombre > 0) {
    const puntos = Math.min(resultadosConNombre * 5, 25);
    confianzaGlobal += puntos;
    componentes.push({
      componente: "Evidencias que mencionan el nombre",
      detalle: `${resultadosConNombre} de ${lista.length} resultados mencionan "${identidad.objetivo}"`,
      puntos
    });
  }

  if (contexto.rol) {
    const puntos = 15;
    confianzaGlobal += puntos;
    componentes.push({
      componente: "Contexto de rol identificado",
      detalle: `Rol predominante: "${contexto.rol}" (${rolesSerializados[0].apariciones} apariciones)`,
      puntos
    });
  }

  if (contexto.pais) {
    const puntos = 10;
    confianzaGlobal += puntos;
    componentes.push({
      componente: "Contexto geográfico identificado",
      detalle: `País predominante: "${contexto.pais}"`,
      puntos
    });
  }

  if (terminosDiscriminantes.length > 0) {
    const puntos = Math.min(terminosDiscriminantes.length * 2, 15);
    confianzaGlobal += puntos;
    componentes.push({
      componente: "Términos discriminantes extraídos",
      detalle: `${terminosDiscriminantes.length} términos servirán para distinguir homónimos`,
      puntos
    });
  }

  if (handlesObservados.length > 0) {
    const puntos = Math.min(handlesObservados.length * 3, 15);
    confianzaGlobal += puntos;
    componentes.push({
      componente: "Handles observados",
      detalle: `${handlesObservados.length} posibles usuarios detectados (no verificados)`,
      puntos
    });
  }

  const fuentesDistintas = [...new Set(evidencias.map((ev) => ev.origen))];

  if (fuentesDistintas.length > 1) {
    const puntos = Math.min((fuentesDistintas.length - 1) * 5, 15);
    confianzaGlobal += puntos;
    componentes.push({
      componente: "Diversidad de fuentes",
      detalle: `${fuentesDistintas.length} fuentes distintas: ${fuentesDistintas.join(", ")}`,
      puntos
    });
  }

  confianzaGlobal = limitar(confianzaGlobal, 0, 100);

  let nivelConfianza = "insuficiente";

  if (confianzaGlobal >= 75) nivelConfianza = "alta";
  else if (confianzaGlobal >= 50) nivelConfianza = "media";
  else if (confianzaGlobal >= 25) nivelConfianza = "baja";

  /*
    ---------------------------------------------------------
    PERFIL DE REFERENCIA
    ---------------------------------------------------------
  */
  return {
    version: "1.0",

    nombrePrincipal: identidad.objetivo,

    objetivoOriginal: identidad.original,

    tipoObjetivo: identidad.tipoObjetivo,

    variantes: {
      nombre: identidad.variantesNombre,
      handle: identidad.variantesHandle,
      iniciales: identidad.iniciales
    },

    contexto,

    terminosDiscriminantes,

    handlesObservados,

    dominiosRelevantes: serializarSenales(dominios, 15),

    plataformasDetectadas: serializarSenales(plataformas, 12),

    atributos,

    confianza: {
      global: confianzaGlobal,
      nivel: nivelConfianza,
      componentes,
      /*
        Recordatorio explícito: esto puntúa el SUSTENTO del
        perfil, no la certeza de una identidad.
      */
      significado:
        "Mide cuánto sustento documental tiene el perfil de referencia. No afirma la identidad de ninguna cuenta."
    },

    evidencias,

    metricas: {
      totalEvidencias: evidencias.length,
      evidenciasConNombre: resultadosConNombre,
      fuentesDistintas
    },

    generadoEn: new Date().toISOString(),

    /*
      Contrato para el siguiente sprint.
    */
    listoParaFusion:
      terminosDiscriminantes.length > 0 || handlesObservados.length > 0
  };
}
