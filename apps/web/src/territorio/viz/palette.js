// apps/web/src/territorio/viz/palette.js

/*
===========================================================
PALETA — la validada en UX-WR-001 §13
===========================================================

No se elige aqui ningun color. Se transcriben los pasos que ya
paso el validador de paletas y que el documento congelado dejo
registrados como WR-D20.

Las cinco reglas derivadas de la medicion, que este archivo
hace cumplir en lugar de solo enunciarlas:

  1. Maximo 3 entidades con color simultaneo. Pasado el
     tercero, ningun orden supera el umbral de todos-los-pares.
  2. Los pines llevan FORMA ademas de color.
  3. Las alertas nunca son solo color: icono + etiqueta.
  4. El color de estado no se reutiliza para series.
  5. Modo claro con pasos propios, no invertidos.

POR QUE EL MORADO ES MAGENTA-ROSADO
-----------------------------------------------------------

El violeta-azulado inicial media ΔE 1.9 en protanopia frente
al azul: indistinguible. Se probaron seis violetas y ninguno
que siga leyendose como violeta pasa de 5.3. La confusion
azul/violeta es intrinseca, y Medios y Conversacion son las
dos capas mas densas, o sea la peor colision posible.

El paso adoptado mide ΔE 15.9 en protanopia y 26.5 en vision
normal.

POR QUE EL ROJO NO ES UNA CAPA
-----------------------------------------------------------

Con cuatro colores de capa el conjunto pasa 5/5. Anadiendo el
rojo como quinto categorico falla contra verde (ΔE 5.9 en
deuteranopia) y contra morado (9.0 normal).

La solucion no es cambiar el rojo: una alerta no es "otro pin
mas", es una interrupcion. Pertenece a la paleta de estado,
exenta del umbral categorico precisamente porque SIEMPRE viaja
con icono y etiqueta.
===========================================================
*/


/*
-----------------------------------------------------------
CAPAS — cuatro, no cinco
-----------------------------------------------------------
*/

export const CAPAS = Object.freeze({
  medios: {
    id: "medios",
    nombre: "Medios de comunicacion",
    color: "#3987e5",
    colorClaro: "#2a78d6",
    forma: "rombo",
    simbolo: "◆"
  },
  conversacion: {
    id: "conversacion",
    nombre: "Conversacion publica",
    color: "#d55181",
    colorClaro: "#e87ba4",
    forma: "circulo",
    simbolo: "●"
  },
  eventos: {
    id: "eventos",
    nombre: "Eventos",
    color: "#c98500",
    colorClaro: "#eda100",
    forma: "triangulo",
    simbolo: "▲"
  },
  actores: {
    id: "actores",
    nombre: "Actividad de actores",
    color: "#008300",
    colorClaro: "#008300",
    forma: "hexagono",
    simbolo: "⬢"
  }
});


/*
-----------------------------------------------------------
ESTADO — nunca solo color, siempre con icono y etiqueta
-----------------------------------------------------------
*/

export const ESTADO = Object.freeze({
  ok: "#0ca30c",
  atencion: "#fab219",
  seria: "#ec835a",
  critica: "#d03b3b"
});


/*
-----------------------------------------------------------
MAGNITUD — rampa secuencial de un solo tono. Nunca arcoiris.
-----------------------------------------------------------
*/

export const RAMPA_MAGNITUD = Object.freeze([
  "#cde2fb",
  "#9ec5f4",
  "#5598e7",
  "#2a78d6",
  "#184f95"
]);


/*
  El medio de la divergente es GRIS y no un tono de la rampa:
  el punto medio debe leerse como «nada», no como un color mas.
*/
export const RAMPA_CAMBIO = Object.freeze({
  subeFuerte: "#184f95",
  sube: "#2a78d6",
  sinCambio: "#383835",
  baja: "#d03b3b",
  bajaFuerte: "#a52222"
});


/*
-----------------------------------------------------------
SERIES — hasta 3 entidades con color. La cuarta va a «Otros».
-----------------------------------------------------------
*/

const COLORES_ENTIDAD = Object.freeze([
  CAPAS.medios.color,
  CAPAS.conversacion.color,
  CAPAS.eventos.color
]);

export const MAXIMO_ENTIDADES_CON_COLOR = 3;

export const COLOR_OTROS = "#64748b";


/*
===========================================================
ASIGNAR COLOR A ENTIDADES

REGLA CONGELADA (§7.3): el color sigue a la ENTIDAD, nunca a
su rango. Si un filtro reduce de 5 a 2, los supervivientes
conservan su color.

Por eso la asignacion se hace UNA vez sobre la lista completa
y estable, y se consulta por id. Repintar por posicion hace
que la vista mienta entre dos estados.
===========================================================
*/

export function asignarColores(ids = []) {
  const mapa = new Map();

  ids.forEach((id, i) => {
    mapa.set(
      id,
      i < MAXIMO_ENTIDADES_CON_COLOR ? COLORES_ENTIDAD[i] : COLOR_OTROS
    );
  });

  return {
    colorDe: (id) => mapa.get(id) || COLOR_OTROS,

    conColor: ids.slice(0, MAXIMO_ENTIDADES_CON_COLOR),

    enOtros: ids.slice(MAXIMO_ENTIDADES_CON_COLOR),

    aviso:
      ids.length > MAXIMO_ENTIDADES_CON_COLOR
        ? `Solo las ${MAXIMO_ENTIDADES_CON_COLOR} primeras entidades llevan color propio. Pasado el tercero, ningun orden de colores supera el umbral de distinguibilidad medido para todos los pares.`
        : null
  };
}


/*
===========================================================
TRAMO DE LA RAMPA PARA UN VALOR

Por CUANTILES sobre las unidades CON dato, nunca sobre el
total: incluir los ceros de las unidades sin dato desplazaria
toda la escala y pintaria de intenso lo meramente presente.
===========================================================
*/

export function escalaPorCuantiles(valores = []) {
  const conDato = valores
    .filter((v) => typeof v === "number" && Number.isFinite(v))
    .sort((a, b) => a - b);

  if (conDato.length === 0) {
    return {
      disponible: false,
      colorDe: () => null,
      cortes: [],
      motivo: "Ninguna unidad con dato: no hay escala que construir."
    };
  }

  const n = RAMPA_MAGNITUD.length;

  const cortes = [];

  for (let i = 1; i < n; i += 1) {
    const pos = Math.floor((conDato.length * i) / n);

    cortes.push(conDato[Math.min(pos, conDato.length - 1)]);
  }

  return {
    disponible: true,

    cortes,

    colorDe(valor) {
      if (typeof valor !== "number" || !Number.isFinite(valor)) return null;

      let tramo = 0;

      while (tramo < cortes.length && valor > cortes[tramo]) tramo += 1;

      return RAMPA_MAGNITUD[tramo];
    },

    base: "cuantiles sobre las unidades con dato, no sobre el total"
  };
}


/*
===========================================================
TRATAMIENTO DE «SIN DATO» Y «MUESTRA INSUFICIENTE»

Regla congelada (§6.6): «sin dato» NUNCA es el tono mas claro
de la rampa. «Casi cero» y «no sabemos» no pueden parecerse.

En una tabla el hachurado a 45 grados se traduce en un patron
de fondo, que es lo que devuelve `fondoHachurado`.
===========================================================
*/

export const SIN_DATO = Object.freeze({
  color: "#1e2a44",
  texto: "#64748b",
  etiqueta: "sin dato"
});

export const MUESTRA_INSUFICIENTE = Object.freeze({
  color: "#243250",
  texto: "#94a3b8",
  etiqueta: "muestra insuficiente"
});


export function fondoHachurado(colorBase = SIN_DATO.color) {
  return `repeating-linear-gradient(45deg, ${colorBase} 0 4px, transparent 4px 8px)`;
}


export default {
  CAPAS,
  ESTADO,
  RAMPA_MAGNITUD,
  RAMPA_CAMBIO,
  MAXIMO_ENTIDADES_CON_COLOR,
  COLOR_OTROS,
  SIN_DATO,
  MUESTRA_INSUFICIENTE,
  asignarColores,
  escalaPorCuantiles,
  fondoHachurado
};
