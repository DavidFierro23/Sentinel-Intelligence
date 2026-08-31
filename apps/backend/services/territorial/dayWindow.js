// apps/backend/services/territorial/dayWindow.js

/*
===========================================================
VENTANA «HOY» Y FRESCURA — TERRITORIAL-FRESH-01
===========================================================

Responde «¿que se publico HOY en este territorio?», que NO es
la misma pregunta que «¿que encontramos hoy?».

LA DISTINCION QUE GOBIERNA EL MODULO
-----------------------------------------------------------

    ENCONTRADO HOY  !=  PUBLICADO HOY

Sentinel puede descubrir hoy una nota del 25 de agosto. Es un
hallazgo nuevo PARA SENTINEL y no es una noticia de hoy. Cuatro
instantes distintos, y ninguno sustituye a otro:

    publishedAt      lo que declara la fuente
    firstObservedAt  la primera vez que Sentinel la vio
    lastObservedAt   la ultima vez que volvio a verla
    retrievedAt      el instante de ESTA ejecucion

Usar `retrievedAt` como si fuera `publishedAt` convertiria cada
recoleccion en «hoy han pasado 40 cosas», que es falso y ademas
crece cada vez que se pulsa actualizar.

POR QUE UN DIA CALENDARIO Y NO 24 HORAS RODANTES
-----------------------------------------------------------

El control actual construye las ventanas restando dias al
instante presente: a las 15:00, «7 dias» empieza a las 15:00
de hace siete dias. Para rangos largos da igual.

Para HOY no. «Hoy» es un dia del calendario en el sitio del que
se habla, no las ultimas 24 horas. A las 09:00 en Cuenca, una
ventana rodante de 24 h incluiria media tarde de ayer y
llamaria «hoy» a lo de anoche.

Y la zona importa: Ecuador va a UTC-5. Entre las 19:00 y la
medianoche de Cuenca, el servidor en UTC ya esta en el dia
siguiente. Calculando en UTC, «hoy» se vaciaria cada tarde.

NO SE FIJA NINGUNA FECHA
-----------------------------------------------------------

El dia se calcula siempre desde el reloj y la zona. La fecha de
una validacion concreta es un dato de esa prueba, no del
codigo.
===========================================================
*/


export const ZONA_POR_DEFECTO = "America/Guayaquil";


/*
-----------------------------------------------------------
DIA CALENDARIO EN UNA ZONA

`Intl.DateTimeFormat` con `timeZone` da las partes de la fecha
tal como se ven ALLI. Es la unica via en Node sin dependencias
que respeta horario de verano y cambios de huso.

Ecuador no aplica horario de verano, pero el modulo no puede
asumirlo: sirve para cualquier territorio.
-----------------------------------------------------------
*/

function partesEnZona(instante, zona) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const p = {};

  fmt.formatToParts(new Date(instante)).forEach((x) => {
    if (x.type !== "literal") p[x.type] = x.value;
  });

  return p;
}


/*
  Desplazamiento de la zona en ese instante, en minutos.

  Se calcula comparando la hora local con la UTC del mismo
  instante. Es la forma de construir un ISO correcto para
  medianoche local sin cablear «-05:00».
*/
function desfaseMinutos(instante, zona) {
  const p = partesEnZona(instante, zona);

  const comoUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour === "24" ? "00" : p.hour),
    Number(p.minute),
    Number(p.second)
  );

  return Math.round((comoUtc - new Date(instante).getTime()) / 60000);
}


export function fechaLocal(instante, zona = ZONA_POR_DEFECTO) {
  const p = partesEnZona(instante, zona);

  return `${p.year}-${p.month}-${p.day}`;
}


/*
===========================================================
VENTANA DEL DIA

Devuelve el intervalo [00:00:00, 23:59:59.999] del dia local,
expresado en instantes UTC para poder comparar con cualquier
`publishedAt`.
===========================================================
*/

export function ventanaDelDia(instante = new Date().toISOString(), zona = ZONA_POR_DEFECTO) {
  const desfase = desfaseMinutos(instante, zona);

  const p = partesEnZona(instante, zona);

  const inicioLocalUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), 0, 0, 0, 0);

  /*
    El desfase se RESTA: si la zona va a UTC-5, la medianoche
    local son las 05:00 UTC.
  */
  const desde = new Date(inicioLocalUtc - desfase * 60000);

  const hasta = new Date(desde.getTime() + 86400000 - 1);

  return {
    id: "hoy",
    etiqueta: "Hoy",

    fechaLocal: `${p.year}-${p.month}-${p.day}`,
    zona,

    desde: desde.toISOString(),
    hasta: hasta.toISOString(),

    /* Referencia para que el consumidor pueda auditarlo. */
    calculadaDesde: new Date(instante).toISOString(),
    desfaseMinutos: desfase,

    declaracion:
      "Día CALENDARIO en la zona del territorio, no las últimas 24 horas. A las 09:00, una ventana rodante llamaría «hoy» a media tarde de ayer."
  };
}


/*
-----------------------------------------------------------
VENTANA DE N DIAS, TAMBIEN POR CALENDARIO

Para que «HOY» sea un subconjunto exacto de «7 días» hacen
falta los dos extremos alineados al mismo huso. Si HOY se
calcula por calendario y 7d por resta de milisegundos, HOY
puede caer parcialmente fuera —y entonces el subconjunto no lo
es—.
-----------------------------------------------------------
*/

export function ventanaDeDias(dias, instante = new Date().toISOString(), zona = ZONA_POR_DEFECTO) {
  const hoy = ventanaDelDia(instante, zona);

  /*
    `dias: 1` es HOY. `dias: 7` son hoy y los seis anteriores:
    siete dias de calendario, no ocho.
  */
  const desde = new Date(new Date(hoy.desde).getTime() - (dias - 1) * 86400000);

  return {
    id: dias === 1 ? "hoy" : `${dias}d`,
    etiqueta: dias === 1 ? "Hoy" : `Últimos ${dias} días`,

    dias,
    zona,

    /*
      El dia local del extremo SUPERIOR. Hacia falta: sin el, la
      interfaz mostraba «7d |  | America/Guayaquil», con la
      fecha vacia, y no habia forma de saber a que dia estaba
      anclada la ventana.
    */
    fechaLocal: hoy.fechaLocal,
    fechaLocalDesde: fechaLocal(desde.toISOString(), zona),

    desde: desde.toISOString(),
    hasta: hoy.hasta,

    calculadaDesde: hoy.calculadaDesde
  };
}


/*
===========================================================
CLASIFICAR LA FRESCURA DE UNA EVIDENCIA
===========================================================
*/

export const FRESCURA = Object.freeze({
  PUBLICADO_HOY: "PUBLICADO_HOY",
  ENCONTRADA_HOY_PUBLICADA_ANTES: "ENCONTRADA_HOY_PUBLICADA_ANTES",
  PUBLICADO_ANTES: "PUBLICADO_ANTES",
  FECHA_NO_RESUELTA: "FECHA_NO_RESUELTA"
});


export const ETIQUETAS_FRESCURA = Object.freeze({
  PUBLICADO_HOY: "Publicado hoy",
  ENCONTRADA_HOY_PUBLICADA_ANTES: "Encontrado hoy, publicado antes",
  PUBLICADO_ANTES: "Publicado antes",
  FECHA_NO_RESUELTA: "Fecha no resuelta"
});


/*
-----------------------------------------------------------
¿ES UNA FECHA UTILIZABLE?

Un `publishedAt` que no se puede parsear NO es una fecha. Y una
fecha en el futuro tampoco sirve: algunos feeds publican
`pubDate` mal formados o con husos incorrectos, y aceptar el
futuro convertiria un error del feed en «lo mas reciente».

Se admite un margen de una hora sobre el instante de
recuperacion, que cubre desajustes de reloj sin admitir un
articulo fechado la semana que viene.
-----------------------------------------------------------
*/

const MARGEN_FUTURO_MS = 3600000;


export function fechaUtilizable(publishedAt, referencia) {
  if (!publishedAt) return { utilizable: false, motivo: "La fuente no declara fecha." };

  const t = new Date(publishedAt).getTime();

  if (Number.isNaN(t)) {
    return { utilizable: false, motivo: `«${publishedAt}» no es una fecha parseable.` };
  }

  const ref = new Date(referencia).getTime();

  if (!Number.isNaN(ref) && t > ref + MARGEN_FUTURO_MS) {
    return {
      utilizable: false,
      motivo:
        "La fecha declarada está en el futuro. Un feed mal formado no puede convertirse en «lo más reciente»."
    };
  }

  return { utilizable: true, motivo: null, instante: t };
}


/*
===========================================================
CLASIFICAR

`retrievedAt` se usa SOLO para saber si la evidencia se
recuperó hoy —es decir, para distinguir «encontrada hoy» de
«ya la teníamos»—. NUNCA para decidir cuándo se publicó.
===========================================================
*/

export function clasificarFrescura(evidencia, { ventana, retrievedAt = null } = {}) {
  const ref = retrievedAt || ventana?.hasta || new Date().toISOString();

  const f = fechaUtilizable(evidencia?.publishedAt, ref);

  const recuperadaHoy = (() => {
    const r = evidencia?.retrievedAt || retrievedAt;

    if (!r || !ventana) return false;

    const t = new Date(r).getTime();

    return t >= new Date(ventana.desde).getTime() && t <= new Date(ventana.hasta).getTime();
  })();

  if (!f.utilizable) {
    return {
      estado: FRESCURA.FECHA_NO_RESUELTA,
      etiqueta: ETIQUETAS_FRESCURA.FECHA_NO_RESUELTA,

      motivo: f.motivo,

      /*
        NO se cuenta como publicada hoy. Y no se rellena con
        `retrievedAt`: eso seria inventar la fecha que falta.
      */
      cuentaComoPublicadoHoy: false,
      recuperadaHoy,

      declaracion:
        "Fecha desconocida NO es fecha de hoy. `retrievedAt` no sustituye a `publishedAt`."
    };
  }

  const dentro =
    ventana &&
    f.instante >= new Date(ventana.desde).getTime() &&
    f.instante <= new Date(ventana.hasta).getTime();

  if (dentro) {
    return {
      estado: FRESCURA.PUBLICADO_HOY,
      etiqueta: ETIQUETAS_FRESCURA.PUBLICADO_HOY,
      motivo: null,
      cuentaComoPublicadoHoy: true,
      recuperadaHoy
    };
  }

  return {
    estado: recuperadaHoy
      ? FRESCURA.ENCONTRADA_HOY_PUBLICADA_ANTES
      : FRESCURA.PUBLICADO_ANTES,

    etiqueta: recuperadaHoy
      ? ETIQUETAS_FRESCURA.ENCONTRADA_HOY_PUBLICADA_ANTES
      : ETIQUETAS_FRESCURA.PUBLICADO_ANTES,

    motivo: recuperadaHoy
      ? "Hallazgo nuevo para Sentinel, pero la fuente la publicó antes del día actual."
      : null,

    cuentaComoPublicadoHoy: false,
    recuperadaHoy
  };
}


/*
===========================================================
DISTRIBUCION TEMPORAL DEL CORPUS

Siempre sobre `publishedAt`. Nunca sobre el orden en que el
buscador devolvio los resultados: ese orden es una decision del
buscador, no un hecho sobre el territorio.
===========================================================
*/

export const CUBOS = Object.freeze(["hoy", "ayer", "2_7_dias", "anterior", "sin_fecha"]);

export const ETIQUETAS_CUBO = Object.freeze({
  hoy: "Hoy",
  ayer: "Ayer",
  "2_7_dias": "2–7 días",
  anterior: "Anterior",
  sin_fecha: "Fecha no resuelta"
});


export function distribucionTemporal(evidencias = [], { instante, zona = ZONA_POR_DEFECTO } = {}) {
  const hoy = ventanaDelDia(instante, zona);

  const inicioHoy = new Date(hoy.desde).getTime();

  const conteo = { hoy: 0, ayer: 0, "2_7_dias": 0, anterior: 0, sin_fecha: 0 };

  evidencias.forEach((ev) => {
    const f = fechaUtilizable(ev?.publishedAt, hoy.hasta);

    if (!f.utilizable) {
      conteo.sin_fecha += 1;

      return;
    }

    const diasAtras = Math.floor((inicioHoy - f.instante) / 86400000);

    if (diasAtras < 0) conteo.hoy += 1;
    else if (diasAtras === 0) conteo.ayer += 1;
    else if (diasAtras <= 5) conteo["2_7_dias"] += 1;
    else conteo.anterior += 1;
  });

  return {
    cubos: conteo,
    etiquetas: ETIQUETAS_CUBO,

    total: evidencias.length,
    ventanaHoy: hoy,

    declaraciones: [
      "La distribución se calcula SOBRE `publishedAt`. El orden en que un buscador devuelve resultados es una decisión del buscador, no un hecho sobre el territorio.",
      "«Fecha no resuelta» no es cero ni es hoy: es una casilla propia porque no saber cuándo se publicó algo es un dato."
    ]
  };
}


/*
-----------------------------------------------------------
RESUMEN PARA LA INTERFAZ
-----------------------------------------------------------
*/

export function resumirFrescura(evidencias = [], { ventana, retrievedAt } = {}) {
  let publicadoHoy = 0;

  let encontradoHoyPublicadoAntes = 0;

  let sinFecha = 0;

  let publicadoAntes = 0;

  evidencias.forEach((ev) => {
    const c = clasificarFrescura(ev, { ventana, retrievedAt });

    if (c.estado === FRESCURA.PUBLICADO_HOY) publicadoHoy += 1;
    else if (c.estado === FRESCURA.ENCONTRADA_HOY_PUBLICADA_ANTES) encontradoHoyPublicadoAntes += 1;
    else if (c.estado === FRESCURA.FECHA_NO_RESUELTA) sinFecha += 1;
    else publicadoAntes += 1;
  });

  return {
    total: evidencias.length,

    publicadoHoy,
    encontradoHoyPublicadoAntes,
    publicadoAntes,
    fechaNoResuelta: sinFecha,

    ventana,

    declaracion:
      "«Publicado hoy» exige `publishedAt` verificable dentro del día territorial. Encontrar algo hoy no lo publica hoy."
  };
}


export default {
  ZONA_POR_DEFECTO,
  FRESCURA,
  ETIQUETAS_FRESCURA,
  CUBOS,
  ETIQUETAS_CUBO,
  ventanaDelDia,
  ventanaDeDias,
  fechaLocal,
  fechaUtilizable,
  clasificarFrescura,
  distribucionTemporal,
  resumirFrescura
};
