import { limpiarHtml, desenvolverRedireccion } from "./textUtils.js";

/*
===========================================================
SENTINEL INTELLIGENCE
BÚSQUEDA WEB GENERAL

IMPORTANTE — identidad real del motor:

Este servicio consulta el endpoint HTML de DuckDuckGo.
Se conserva el nombre de archivo `googleService.js` y la
función `buscarGoogle()` por compatibilidad con el código
existente, pero el motor declarado es DuckDuckGo.

No se inventa ninguna API ni clave.

Cambios respecto a la versión anterior:

1. Endpoint  html.duckduckgo.com/html/  vía POST.
   Devuelve URLs DIRECTAS en lugar de redirecciones
   //duckduckgo.com/l/?uddg=...

2. Se extrae el SNIPPET REAL (result__snippet).
   Antes se rellenaba con el texto fijo "Resultado obtenido
   mediante búsqueda abierta", que contaminaba los términos
   discriminantes del Perfil de Referencia.

3. Si un resultado no trae snippet, la descripción queda
   VACÍA y se marca `snippetDisponible: false`.
   Nunca se fabrica una descripción.
===========================================================
*/

const MOTOR_ID = "ddg_web";
const MOTOR_NOMBRE = "DuckDuckGo Web";

const ENDPOINT_POST = "https://html.duckduckgo.com/html/";
const ENDPOINT_GET = "https://duckduckgo.com/html/";

const AGENTE =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const LIMITE_RESULTADOS = 10;


/*
-----------------------------------------------------------
DESCARGAR HTML

POST al endpoint html.duckduckgo.com (más fiable y con
enlaces directos). Si falla, se reintenta con el GET
original para no perder capacidad respecto a la versión
anterior.
-----------------------------------------------------------
*/

async function descargarHtml(consulta) {
  const cabeceras = {
    "User-Agent": AGENTE,
    "Accept-Language": "es-419,es;q=0.9,en;q=0.8"
  };

  try {
    const respuesta = await fetch(ENDPOINT_POST, {
      method: "POST",
      headers: {
        ...cabeceras,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({ q: consulta }).toString()
    });

    if (respuesta.ok) {
      const html = await respuesta.text();

      if (html && html.includes("result__a")) {
        return { html, via: "POST" };
      }
    }
  } catch (error) {
    console.error("[ddg_web] POST falló:", error.message);
  }

  try {
    const respuesta = await fetch(
      `${ENDPOINT_GET}?q=${encodeURIComponent(consulta)}`,
      { headers: cabeceras }
    );

    const html = await respuesta.text();

    return { html, via: "GET" };
  } catch (error) {
    console.error("[ddg_web] GET falló:", error.message);

    return { html: "", via: "ninguna" };
  }
}


/*
-----------------------------------------------------------
DETECTAR LIMITACIÓN DE TASA

DuckDuckGo limita el raspado tras unas pocas consultas
seguidas: responde 200 con una página SIN resultados.

Sin esta detección, un bloqueo sería indistinguible de una
búsqueda legítimamente vacía, y el Fusion Engine reportaría
"0 resultados" cuando en realidad no pudo consultar.
-----------------------------------------------------------
*/

function pareceBloqueado(html) {
  if (!html) return true;

  /*
    La marca fiable es la ausencia total del contenedor de
    resultados. Una búsqueda legítimamente vacía sí trae la
    estructura de resultados.
  */
  return !html.includes("result__a");
}


/*
-----------------------------------------------------------
EXTRAER RESULTADOS

Se recorre bloque por bloque para poder emparejar cada
título con SU snippet. Un regex global sobre todo el
documento desalinearía los pares cuando algún resultado no
trae snippet.
-----------------------------------------------------------
*/

function extraerResultados(html) {
  if (!html) return [];

  const resultados = [];

  /*
    Cada resultado empieza en un enlace con clase result__a.
    Se corta el documento por esas apariciones y se analiza
    la ventana de cada uno.
  */
  const partes = html.split(/<a[^>]+class="[^"]*result__a[^"]*"/i);

  // partes[0] es el encabezado del documento: se descarta.
  for (let i = 1; i < partes.length && resultados.length < LIMITE_RESULTADOS; i += 1) {
    const bloque = partes[i];

    /*
      TÍTULO Y ENLACE
    */
    const enlaceMatch = bloque.match(/^[^>]*href="([^"]+)"/i);

    const tituloMatch = bloque.match(/^[^>]*>([\s\S]*?)<\/a>/i);

    if (!enlaceMatch || !tituloMatch) continue;

    const enlace = desenvolverRedireccion(enlaceMatch[1]);

    const titulo = limpiarHtml(tituloMatch[1]);

    if (!enlace || !titulo) continue;

    /*
      SNIPPET REAL

      Se busca dentro de la ventana de ESTE resultado, antes
      de que empiece el siguiente bloque.
    */
    const snippetMatch = bloque.match(
      /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i
    );

    const snippet = snippetMatch ? limpiarHtml(snippetMatch[1]) : "";

    resultados.push({
      titulo,
      enlace,

      /*
        Descripción REAL o cadena vacía.
        Nunca texto fabricado.
      */
      descripcion: snippet,

      snippetDisponible: Boolean(snippet),

      motor: MOTOR_NOMBRE,
      motorId: MOTOR_ID
    });
  }

  return resultados;
}


/*
-----------------------------------------------------------
BÚSQUEDA WEB

Firma conservada: buscarGoogle(objetivo).
Segundo parámetro opcional para que el Fusion Engine
registre la consulta exacta utilizada.
-----------------------------------------------------------
*/

export async function buscarGoogle(objetivo, opciones = {}) {
  const consulta = String(objetivo ?? "").trim();

  const inicio = Date.now();

  if (!consulta) {
    return {
      objetivo: consulta,
      motor: MOTOR_NOMBRE,
      motorId: MOTOR_ID,
      consulta,
      total: 0,
      tiempo: "0",
      resultados: []
    };
  }

  try {
    const { html, via } = await descargarHtml(consulta);

    const bloqueado = pareceBloqueado(html);

    const resultados = bloqueado
      ? []
      : extraerResultados(html).map((item) => ({
          ...item,
          consulta,
          etiquetaConsulta: opciones.etiqueta || null
        }));

    if (bloqueado) {
      console.warn(
        `[ddg_web] sin estructura de resultados para "${consulta}" — probable limitación de tasa`
      );
    }

    return {
      objetivo: consulta,
      motor: MOTOR_NOMBRE,
      motorId: MOTOR_ID,
      consulta,
      via,

      /*
        `bloqueado` distingue "no pude consultar" de
        "consulté y no hay nada".
      */
      bloqueado,
      estado: bloqueado ? "bloqueado" : "ok",

      total: resultados.length,
      tiempo: `${((Date.now() - inicio) / 1000).toFixed(2)}s`,
      resultados
    };
  } catch (error) {
    console.error("[ddg_web] error:", error.message);

    return {
      objetivo: consulta,
      motor: MOTOR_NOMBRE,
      motorId: MOTOR_ID,
      consulta,
      total: 0,
      tiempo: "0",
      resultados: []
    };
  }
}


export { MOTOR_ID, MOTOR_NOMBRE };
