// apps/backend/services/providers/providerAudit.js

import { informeProveedores } from "./providerRegistry.js";

/*
===========================================================
PROVIDER AUDIT — que se puede afirmar de cada proveedor
===========================================================

Una matriz de lo que hay, leida del registro real y no de una
tabla escrita a mano. Si alguien registra un proveedor nuevo,
aparece aqui sin tocar este fichero.

LA REGLA QUE GOBIERNA ESTE MODULO
-----------------------------------------------------------

Un proveedor NO se presenta como integrado si no lo esta.

Suena obvio y es el error mas facil de cometer: cuatro
proveedores declarados en un registro se leen como cuatro
fuentes de corroboracion. En la ultima ejecucion real de
Cuenca, de cuatro proveedores web:

    SerpAPI       no ejecutado
    Brave         sin credencial
    DuckDuckGo    no ejecutado
    Bing          no implementado

Ninguno aporto una sola evidencia. Las 30 vinieron de Google
News por RSS. Un panel que dijera «4 proveedores configurados»
estaria mintiendo por omision.

EL COSTE
-----------------------------------------------------------

`costoPorConsulta: null` significa NO SE SABE, y se propaga:
`costoEstimado` tambien sale null. No se rellena con el precio
de lista de una web, no se estima por comparacion y no se pone
0 «porque no hemos pagado». Un coste inventado es peor que
ninguno: se convierte en la base de una decision de compra.
===========================================================
*/


/*
-----------------------------------------------------------
LO QUE SE SABE DE CADA PROVEEDOR, DECLARADO

Solo hechos comprobables desde este repositorio: si hay modulo,
si hay credencial en el entorno, que limite documenta el plan
contratado. Nada de estimaciones.
-----------------------------------------------------------
*/

const CONOCIMIENTO = Object.freeze({
  serpapi_google: {
    tipo: "API oficial de terceros sobre resultados de Google",
    cuotaDeclarada: "Plan Starter: 1.000 búsquedas/mes, saldo compartido con Discovery Engine",
    costoPorConsulta: null,
    motivoCosto:
      "El plan es de pago pero el coste unitario no consta en el repositorio. No se estima.",
    coberturaDeclarada: ["web", "noticias"],
    limitaciones: [
      "Saldo mensual, no cuota por hora: gastarlo aquí deja sin cuota al Discovery Engine.",
      "No cubre plataformas sociales."
    ],
    trazabilidad: "Cada resultado conserva su motor de origen real."
  },

  brave_web: {
    tipo: "API oficial",
    cuotaDeclarada: null,
    costoPorConsulta: null,
    motivoCosto: "Sin credencial contratada. No hay plan del que leer coste.",
    coberturaDeclarada: ["web"],
    limitaciones: ["Sin credencial: BRAVE_API_KEY no está configurada."],
    trazabilidad: "Módulo implementado; nunca ha devuelto un resultado."
  },

  ddg_web: {
    tipo: "Raspado de HTML público",
    cuotaDeclarada: "Sin cuota contractual; sujeto a bloqueo por frecuencia",
    costoPorConsulta: 0,
    motivoCosto: "No hay contrato ni pago. El coste monetario es cero y consta.",
    coberturaDeclarada: ["web"],
    limitaciones: [
      "Raspado, no API: puede bloquear por frecuencia y ya lo hizo una vez.",
      "Sin garantía de servicio ni condiciones de uso comercial claras."
    ],
    trazabilidad: "Último recurso por decisión declarada, no por calidad."
  },

  bing_web: {
    tipo: "API oficial",
    cuotaDeclarada: null,
    costoPorConsulta: null,
    motivoCosto: "No implementado. No hay nada que costear todavía.",
    coberturaDeclarada: [],
    limitaciones: [
      "Declarado en el registro para que aparezca en cobertura, NUNCA invocado.",
      "Requiere módulo propio y credencial."
    ],
    trazabilidad: "No aplica: no se invoca."
  },

  google_news_rss: {
    tipo: "RSS público",
    cuotaDeclarada: "Sin cuota. Gratuito.",
    costoPorConsulta: 0,
    motivoCosto: "RSS público sin contrato.",
    coberturaDeclarada: ["noticias"],
    limitaciones: [
      "Ventana móvil de pocas semanas: NO es un archivo histórico. Es la razón de que las ventanas comparables deban acumularse.",
      "Oculta el publicador: el enlace apunta a news.google.com y el medio real hay que rescatarlo del sufijo del titular.",
      "Sin control sobre el criterio de selección de Google."
    ],
    trazabilidad: "El publicador rescatado por nombre se marca como tal."
  },

  knowledge_lake: {
    tipo: "Almacén propio append-only",
    cuotaDeclarada: "Sin cuota. Datos propios.",
    costoPorConsulta: 0,
    motivoCosto: "Almacenamiento propio.",
    coberturaDeclarada: ["histórico propio"],
    limitaciones: [
      "Solo contiene lo que Sentinel ya recolectó. Un hueco de ingesta no es un día sin actividad.",
      "La lectura exige proyectoId."
    ],
    trazabilidad: "Completa: cada evento conserva su versión y su hash."
  }
});


/*
-----------------------------------------------------------
PROVEEDORES QUE NO PASAN POR EL REGISTRO

Google News y el Knowledge Lake los invoca el recolector
directamente, no la Search Provider Layer. Si no se declarasen
aqui, la matriz diria que el corpus vino de proveedores que no
ejecutaron nada — que es justo lo contrario de lo que paso.
-----------------------------------------------------------
*/

const FUERA_DEL_REGISTRO = Object.freeze([
  {
    id: "google_news_rss",
    nombre: "Google News (RSS)",
    tipo: "noticias",
    implementado: true,
    enUso: true,
    prioridad: 0
  },
  {
    id: "knowledge_lake",
    nombre: "Knowledge Lake",
    tipo: "histórico",
    implementado: true,
    enUso: true,
    prioridad: 0
  }
]);


/*
===========================================================
MATRIZ

`trazaEjecucion` es el registro real de una ejecucion, si se
tiene. Sin el, `resultados` y `enUso` salen null: «no se ha
observado» y no «no aporta».
===========================================================
*/

export function matrizProveedores({ trazaEjecucion = null } = {}) {
  const delRegistro = informeProveedores().map((p) => ({
    id: p.id,
    nombre: p.nombre,
    tipo: p.tipo,
    prioridad: p.prioridad,
    implementado: p.implementado !== false,
    estado: p.estado?.nombre || p.estado || null,
    presupuesto: p.presupuesto ?? null
  }));

  const todos = [
    ...FUERA_DEL_REGISTRO.map((p) => ({ ...p, estado: null, presupuesto: null })),
    ...delRegistro
  ];

  const porMotor = new Map();

  (trazaEjecucion || []).forEach((t) => {
    const clave = t.motorId || t.fuente || t.motor;

    if (!clave) return;

    const previo = porMotor.get(clave) || { recibidas: 0, nuevas: 0, estados: [] };

    previo.recibidas += Number(t.recibidas || 0);

    previo.nuevas += Number(t.nuevas || 0);

    if (t.estado) previo.estados.push(t.estado);

    porMotor.set(clave, previo);
  });

  const filas = todos.map((p) => {
    const c = CONOCIMIENTO[p.id] || {};

    const observado = porMotor.get(p.id) || null;

    /*
      `credencial` se deriva del estado, que es lo unico
      comprobable sin leer el entorno desde aqui.
    */
    const sinCredencial = /sin configurar/i.test(String(p.estado || ""));

    return {
      provider: p.id,
      nombre: p.nombre,
      tipo: c.tipo || p.tipo || null,

      implementado: p.implementado,

      /*
        EN USO es un hecho de la ejecucion, no del registro.
        Sin traza, null.
      */
      enUso: trazaEjecucion ? Boolean(observado && observado.nuevas > 0) : null,

      credencial: p.implementado ? (sinCredencial ? "ausente" : "presente") : "no aplica",

      cuota: c.cuotaDeclarada ?? null,

      resultados: observado
        ? { recibidas: observado.recibidas, nuevas: observado.nuevas }
        : null,

      cobertura: c.coberturaDeclarada || [],

      limitaciones: c.limitaciones || [],

      /*
        COSTE — null se propaga. Nunca se rellena.
      */
      costoPorConsulta: c.costoPorConsulta ?? null,
      costoConocido: Object.prototype.hasOwnProperty.call(c, "costoPorConsulta")
        ? c.costoPorConsulta !== null
        : false,
      motivoCosto: c.motivoCosto || "Coste no declarado en el repositorio.",

      costoEstimadoEjecucion:
        c.costoPorConsulta !== null &&
        c.costoPorConsulta !== undefined &&
        observado
          ? c.costoPorConsulta * (observado.recibidas || 0)
          : null,

      trazabilidad: c.trazabilidad || null,

      estadoRegistro: p.estado
    };
  });

  const integrados = filas.filter((f) => f.implementado && f.credencial !== "ausente");

  const aportaron = filas.filter((f) => f.enUso === true);

  return {
    filas,

    resumen: {
      declarados: filas.length,
      implementados: filas.filter((f) => f.implementado).length,
      integrados: integrados.length,
      aportaronEvidencia: trazaEjecucion ? aportaron.length : null,
      sinCostoConocido: filas.filter((f) => !f.costoConocido).length
    },

    declaraciones: [
      "Un proveedor declarado no es un proveedor integrado, y uno integrado no es uno que haya aportado evidencia. Las tres cosas se cuentan por separado.",
      "`costoPorConsulta: null` significa «no se sabe» y se propaga a `costoEstimadoEjecucion`. No se estima con precios de lista ni se pone 0 por no haber pagado.",
      trazaEjecucion
        ? null
        : "Sin traza de ejecución, `enUso` y `resultados` salen null: no se ha observado, que no es lo mismo que no aportar."
    ].filter(Boolean)
  };
}


export default { matrizProveedores };
