/*
===========================================================
FICHA DE IDENTIDAD — HELPERS
===========================================================

Funciones puras, sin React y sin red, para poder probarlas.
Deciden tres cosas que la interfaz no debe improvisar:

  · como se nombra cada estado de una cuenta
  · como se muestra una fecha al analista
  · como se llama la metrica del expediente

Las tres son decisiones de honestidad, no de estetica.
===========================================================
*/


/*
-----------------------------------------------------------
ZONA HORARIA DEL PROYECTO

Se PERSISTE en UTC, siempre. Se MUESTRA en la hora del
territorio del proyecto.

Un analista en Cuenca que ve «17:23» tiene que poder comparar
ese dato con su reloj. Mostrarle UTC le obliga a restar cinco
horas mentalmente cada vez, y tarde o temprano alguien no las
resta y fecha mal un hallazgo.

Configurable por proyecto: hoy Ecuador, mañana otro pais.
-----------------------------------------------------------
*/
export const ZONA_POR_PAIS = Object.freeze({
  Ecuador: "America/Guayaquil",
  Colombia: "America/Bogota",
  Peru: "America/Lima",
  Perú: "America/Lima",
  Mexico: "America/Mexico_City",
  México: "America/Mexico_City"
});

export const ZONA_POR_DEFECTO = "America/Guayaquil";


export function zonaDelProyecto(proyecto) {
  return (
    proyecto?.zonaHoraria ||
    ZONA_POR_PAIS[proyecto?.pais] ||
    ZONA_POR_DEFECTO
  );
}


/*
  Formatea un instante UTC en la hora local del proyecto.

  Devuelve null si no hay fecha, en lugar de una cadena vacia o
  un «Invalid Date»: quien la use debe decidir que escribir
  cuando no hay dato, y no heredar un texto roto.
*/
export function fechaLocal(iso, proyecto, opciones = {}) {
  if (!iso) return null;

  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return null;

  const zona = zonaDelProyecto(proyecto);

  try {
    return new Intl.DateTimeFormat("es-EC", {
      timeZone: zona,
      dateStyle: opciones.soloHora ? undefined : "short",
      timeStyle: opciones.conSegundos ? "medium" : "short"
    }).format(d);
  } catch {
    /*
      Si el entorno no conoce la zona, se dice en UTC y se
      ETIQUETA como UTC. Nunca se presenta UTC como si fuera
      hora local.
    */
    return `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
  }
}


/*
-----------------------------------------------------------
ESTADOS DE UNA CUENTA

Cada estado dice algo distinto y ninguno afirma mas de lo que
sabemos. En particular:

  NO_REENCONTRADA   no se pudo ver en la ultima verificacion.
                    NO significa que ya no sea del candidato.

  PENDIENTE         no hay nada en esta plataforma todavia.
                    NO significa que el candidato no la use.

Confundir cualquiera de las dos con una ausencia real convierte
una limitacion nuestra en una afirmacion sobre una persona.
-----------------------------------------------------------
*/
export const ESTADOS = Object.freeze({
  CONSOLIDADA: {
    etiqueta: "Consolidada",
    tono: "verde",
    explicacion:
      "Atribuida al candidato y sostenida en el expediente del proyecto."
  },
  REVALIDADA: {
    etiqueta: "Consolidada · revalidada",
    tono: "verde",
    explicacion: "Vuelta a observar en la última verificación."
  },
  ATRIBUIDA: {
    etiqueta: "Atribuida",
    tono: "verde",
    explicacion: "El clasificador la atribuyó al candidato."
  },
  DECLARADA_POR_ANALISTA: {
    etiqueta: "Declarada por el analista",
    tono: "azul",
    explicacion:
      "La proporcionó una persona. Sentinel no la ha corroborado por su cuenta."
  },
  NO_REENCONTRADA_EN_ULTIMA_VERIFICACION: {
    etiqueta: "Consolidada · no reencontrada en la última verificación",
    tono: "ambar",
    explicacion:
      "Sigue vinculada al candidato. El buscador no la devolvió esta vez, y eso no revoca su identidad."
  },
  PENDIENTE: {
    etiqueta: "Sin cuenta atribuida",
    tono: "gris",
    explicacion:
      "Sentinel no tiene ninguna cuenta aquí. No es una afirmación de que el candidato no use esta plataforma."
  },
  DESCUBIERTA: {
    etiqueta: "Descubierta",
    tono: "gris",
    explicacion: "Hallada, sin veredicto de identidad todavía."
  },
  REVOCADA: {
    etiqueta: "Revocada",
    tono: "rojo",
    explicacion: "Retirada del expediente por decisión, no por ausencia."
  }
});


export function estadoVisual(estado) {
  return (
    ESTADOS[estado] || {
      etiqueta: String(estado || "sin estado"),
      tono: "gris",
      explicacion: null
    }
  );
}


/*
  Procedencia en palabras. Las dos pueden ser verdad a la vez, y
  cuando lo son hay que decirlo: es informacion mas rica, no una
  contradiccion.
*/
export function procedencia(cuenta) {
  const partes = [];

  if (cuenta?.declaradaPorAnalista) partes.push("declarada por el analista");

  if (cuenta?.corroboradaPorSentinel) partes.push("corroborada por Sentinel");
  else if (cuenta?.descubiertaPorSentinel) partes.push("descubierta por Sentinel");

  return partes.length ? partes.join(" · ") : "sin procedencia registrada";
}


/*
-----------------------------------------------------------
LA METRICA DEL EXPEDIENTE

Se llamaba «huella digital» y se mostraba como un porcentaje
suelto junto al nombre de un candidato. Con ese formato, un 53 %
se lee como respaldo y un 35 % como caida, y ninguna de las dos
lecturas tiene nada que ver con lo que mide.

La formula suma cuatro cosas: en cuantas plataformas hay cuenta
atribuible, cuanto sostiene la mejor correspondencia, cuantas
cuentas tienen mas de una fuente independiente y cuantas estan
declaradas en una base de referencia. Es decir: **amplitud y
solidez del expediente observado**.

`SOLIDEZ DEL EXPEDIENTE` es el nombre exacto para eso.
«Cobertura de identidad» describiria solo el primer componente,
que son 40 de los 100 puntos.

La formula NO se toca aqui. Lo que cambia es como se presenta.
-----------------------------------------------------------
*/
export const METRICA = Object.freeze({
  nombre: "Solidez del expediente",
  abreviado: "Solidez",
  aclaracion:
    "Esta métrica refleja amplitud y corroboración del expediente digital observado. No representa intención de voto, popularidad ni apoyo ciudadano.",
  componentes: [
    "Cobertura de plataformas (40)",
    "Solidez de la mejor correspondencia (30)",
    "Corroboración multiproveedor (20)",
    "Declaración en base de referencia (10)"
  ]
});


/*
  Nivel cualitativo, con los mismos cortes que el backend. Se
  nombra por lo que es —cuanto se ha documentado— y nunca por
  cuanto apoyo tiene alguien.
*/
export function nivelSolidez(valor) {
  if (valor == null) return { etiqueta: "sin medir", tono: "gris" };

  if (valor >= 75) return { etiqueta: "expediente amplio", tono: "verde" };

  if (valor >= 50) return { etiqueta: "expediente moderado", tono: "verde" };

  if (valor >= 25) return { etiqueta: "expediente limitado", tono: "ambar" };

  return { etiqueta: "expediente mínimo", tono: "ambar" };
}


/*
-----------------------------------------------------------
PRIMERA OBSERVACION — BUG-20

Las cuentas que vienen de un expediente anterior al contrato de
identidad no tienen `firstSeenAt` reconstruible. Al reobservarlas
el campo tomo el instante de esa corrida, asi que dice «hoy»
cuando en realidad se conocian desde antes.

Mientras `historiaIncompleta` sea true, la interfaz NO escribe
«vista por primera vez»: seria una fecha inventada con
apariencia de dato. Dice que el historial previo esta incompleto,
que es lo unico que sabemos.
-----------------------------------------------------------
*/
export function textoPrimeraObservacion(cuenta, proyecto) {
  if (cuenta?.historiaIncompleta) {
    return "historial previo incompleto";
  }

  const f = fechaLocal(cuenta?.firstSeenAt, proyecto);

  return f ? `vista por primera vez el ${f}` : "sin primera observación registrada";
}


export function textoUltimaVerificacion(cuenta, proyecto) {
  const visto = fechaLocal(cuenta?.lastSeenAt, proyecto);

  const revisado = fechaLocal(cuenta?.lastCheckedAt, proyecto);

  if (cuenta?.seenInCurrentRun && visto) {
    return `observada el ${visto}`;
  }

  /*
    La distincion que importa: se REVISO y no se VIO. Colapsarlas
    haria creer que nadie ha mirado.
  */
  if (revisado && visto) {
    return `revisada el ${revisado} · vista por última vez el ${visto}`;
  }

  if (revisado) return `revisada el ${revisado}, sin observarla`;

  return "sin verificar todavía";
}
