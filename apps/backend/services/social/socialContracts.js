// apps/backend/services/social/socialContracts.js

import { PLATAFORMAS_CONOCIDAS } from "../textUtils.js";

/*
===========================================================
SENTINEL INTELLIGENCE
SOCIAL CONTRACTS — esquemas, enumeraciones y validadores
===========================================================

Implementa los contratos definidos en
docs/architecture/Social-Intelligence-Layer.md (ARQ-SIL-001).

Todo el Social Intelligence Layer se apoya en este archivo.
No contiene lógica de negocio: define QUÉ forma tienen los
datos y qué valores son legales.
===========================================================
*/


/*
-----------------------------------------------------------
PLATAFORMAS SOPORTADAS

Solo las seis aprobadas en ARQ-SIL-001 §3. Threads,
Telegram, Reddit y Bluesky quedan fuera por decisión
expresa del Founder.
-----------------------------------------------------------
*/

export const PLATAFORMAS_SOCIALES = Object.freeze([
  "facebook",
  "instagram",
  "tiktok",
  "x",
  "youtube",
  "linkedin"
]);

export function esPlataformaSocial(id) {
  return PLATAFORMAS_SOCIALES.includes(String(id || "").toLowerCase());
}

/*
  Solo estas plataformas producen CUENTAS de una persona u
  organización. Wikipedia o Wayback son referencia, no
  identidad.
*/
export const TIPOS_CON_IDENTIDAD = Object.freeze(["social", "video"]);


/*
-----------------------------------------------------------
MODO DE ACCESO A LA PLATAFORMA

Declara CÓMO se obtuvo (o no se pudo obtener) el perfil.
En el Sprint 3.1 ninguna plataforma se lee: todo llega por
descubrimiento web, así que el modo real es
`presencia_inferida`.
-----------------------------------------------------------
*/

export const MODOS_ACCESO = Object.freeze({
  API_OFICIAL: "api_oficial",
  PUBLICO_LIMITADO: "publico_limitado",
  PRESENCIA_INFERIDA: "presencia_inferida",
  SIN_CONFIGURAR: "sin_configurar",
  NO_DISPONIBLE: "no_disponible"
});


/*
-----------------------------------------------------------
ESTADO DE PRESENCIA en una plataforma
-----------------------------------------------------------
*/

export const ESTADOS_PRESENCIA = Object.freeze({
  PERFIL_LEIDO: "perfil_leido",
  INFERIDA: "inferida",
  AUSENCIA: "ausencia",
  NO_COMPROBADA: "no_comprobada"
});


/*
-----------------------------------------------------------
ESTADO DE LA CORRESPONDENCIA

TOPE HUMANO (decisión congelada del Founder, IA2):

El sistema NUNCA alcanza `confirmado`. Su techo es
`probable`. Solo un analista puede confirmar o descartar.
-----------------------------------------------------------
*/

export const ESTADOS_CORRESPONDENCIA = Object.freeze({
  DESCUBIERTO: "descubierto",
  CANDIDATO: "candidato",
  PROBABLE: "probable",
  /* Estos dos requieren intervención humana: */
  CONFIRMADO: "confirmado",
  DESCARTADO: "descartado"
});

/*
  Estados que el sistema puede asignar por sí mismo.
*/
export const ESTADOS_AUTOMATICOS = Object.freeze([
  ESTADOS_CORRESPONDENCIA.DESCUBIERTO,
  ESTADOS_CORRESPONDENCIA.CANDIDATO,
  ESTADOS_CORRESPONDENCIA.PROBABLE
]);

export function esEstadoAutomatico(estado) {
  return ESTADOS_AUTOMATICOS.includes(estado);
}


/*
-----------------------------------------------------------
NIVELES DE CORRESPONDENCIA

El nivel máximo es "Muy Alta Correspondencia".
No existe "Identidad confirmada" como salida del sistema.
-----------------------------------------------------------
*/

export const NIVELES_CORRESPONDENCIA = Object.freeze([
  { id: "muy_alta", etiqueta: "Muy Alta Correspondencia", desde: 85 },
  { id: "alta", etiqueta: "Alta Correspondencia", desde: 70 },
  { id: "media", etiqueta: "Correspondencia Media", desde: 50 },
  { id: "baja", etiqueta: "Correspondencia Baja", desde: 30 },
  { id: "insuficiente", etiqueta: "Correspondencia Insuficiente", desde: 0 }
]);

export function nivelDeCorrespondencia(puntuacion) {
  const valor = Number(puntuacion) || 0;

  return (
    NIVELES_CORRESPONDENCIA.find((n) => valor >= n.desde) ||
    NIVELES_CORRESPONDENCIA[NIVELES_CORRESPONDENCIA.length - 1]
  );
}


/*
-----------------------------------------------------------
SEÑALES DEL IDENTITY MATCHER

Las siete definidas en ARQ-SIL-001 §3.2. El Sprint 3.1
implementa S1, S2, S6 y S7 — las calculables SIN leer la
plataforma. S3, S4 y S5 requieren el Platform Scanner y se
declaran aquí como `implementada: false` para que el panel
pueda mostrar qué falta por medir.
-----------------------------------------------------------
*/

export const SENALES = Object.freeze([
  {
    id: "S1",
    nombre: "Nombre",
    descripcion: "Nombre visible frente a las variantes del objetivo",
    fuerza: "media",
    pesoMaximo: 25,
    puedeSerContrasenal: true,
    implementada: true
  },
  {
    id: "S2",
    nombre: "Usuario",
    descripcion: "Handle de la cuenta frente a las variantes de handle",
    fuerza: "media",
    pesoMaximo: 25,
    puedeSerContrasenal: false,
    implementada: true
  },
  {
    id: "S3",
    nombre: "Biografía",
    descripcion: "Términos discriminantes del objetivo en la biografía",
    fuerza: "alta",
    pesoMaximo: 0,
    puedeSerContrasenal: true,
    implementada: false,
    requiere: "Platform Scanner (Sprint 3.2)"
  },
  {
    id: "S4",
    nombre: "Cargo",
    descripcion: "Rol declarado frente al contexto del objetivo",
    fuerza: "alta",
    pesoMaximo: 0,
    puedeSerContrasenal: true,
    implementada: false,
    requiere: "Platform Scanner (Sprint 3.2)"
  },
  {
    id: "S5",
    nombre: "País",
    descripcion: "Ubicación o idioma frente al contexto geográfico",
    fuerza: "media",
    pesoMaximo: 0,
    puedeSerContrasenal: true,
    implementada: false,
    requiere: "Platform Scanner (Sprint 3.2)"
  },
  {
    id: "S6",
    nombre: "Enlaces oficiales",
    descripcion:
      "La cuenta aparece en un dominio ya asociado al objetivo, o un dominio oficial la enlaza",
    fuerza: "muy_alta",
    pesoMaximo: 30,
    puedeSerContrasenal: false,
    implementada: true
  },
  {
    id: "S7",
    nombre: "Presencia cruzada",
    descripcion: "El mismo handle aparece en varias plataformas del objetivo",
    fuerza: "muy_alta",
    pesoMaximo: 20,
    puedeSerContrasenal: false,
    implementada: true
  }
]);

export const SENALES_IMPLEMENTADAS = Object.freeze(
  SENALES.filter((s) => s.implementada).map((s) => s.id)
);

export function senalPorId(id) {
  return SENALES.find((s) => s.id === id) || null;
}


/*
-----------------------------------------------------------
TOPE POR CONCURRENCIA DE SEÑALES

Principio innegociable de ARQ-SIL-001 §3.2:
"Ninguna señal aislada confirma identidad."

Se implementa numéricamente: la puntuación queda limitada
por cuántas señales INDEPENDIENTES se activaron. Una sola
señal, por fuerte que sea, no puede producir una
correspondencia alta.

El tope de 4 señales es 97: nunca 100. La certeza absoluta
no es una salida del sistema.
-----------------------------------------------------------
*/

export const TOPE_POR_CONCURRENCIA = Object.freeze({
  0: 0,
  1: 45,
  2: 70,
  3: 88,
  4: 97
});

export function topeDeConcurrencia(numeroDeSenales) {
  const n = Math.max(0, Math.min(4, Number(numeroDeSenales) || 0));

  return TOPE_POR_CONCURRENCIA[n];
}


/*
-----------------------------------------------------------
TIPOS DE EVIDENCIA SOCIAL
-----------------------------------------------------------
*/

export const TIPOS_EVIDENCIA = Object.freeze({
  DESCUBRIMIENTO: "descubrimiento",
  PERFIL: "perfil",
  CORRESPONDENCIA: "correspondencia",
  ACTIVIDAD: "actividad",
  PUBLICACION: "publicacion",
  ENLACE_CRUZADO: "enlace_cruzado",
  AUSENCIA: "ausencia"
});


/*
-----------------------------------------------------------
CALIDAD DE LA EVIDENCIA

Mismo vocabulario que el Fusion Engine, para que una
evidencia social y una web se puedan comparar.
-----------------------------------------------------------
*/

export const CALIDADES = Object.freeze({
  COMPLETA: "completa",
  PARCIAL: "parcial",
  MINIMA: "mínima"
});


/*
-----------------------------------------------------------
VALIDADORES
-----------------------------------------------------------
*/

export function validarCandidato(candidato) {
  const errores = [];

  if (!candidato) return { valido: false, errores: ["candidato vacío"] };

  if (!esPlataformaSocial(candidato.plataformaId)) {
    errores.push(`plataforma no soportada: ${candidato.plataformaId}`);
  }

  if (!candidato.handle) errores.push("falta handle");

  if (!candidato.urlNormalizada) errores.push("falta urlNormalizada");

  if (!Array.isArray(candidato.origenes) || !candidato.origenes.length) {
    errores.push("falta al menos un origen de descubrimiento");
  }

  return { valido: errores.length === 0, errores };
}


export function validarCorrespondencia(correspondencia) {
  const errores = [];

  if (!correspondencia) return { valido: false, errores: ["correspondencia vacía"] };

  const p = Number(correspondencia.puntuacion);

  if (!Number.isFinite(p) || p < 0 || p > 100) {
    errores.push(`puntuación fuera de rango: ${correspondencia.puntuacion}`);
  }

  /*
    TOPE HUMANO — el validador lo hace cumplir.
  */
  if (!esEstadoAutomatico(correspondencia.estado)) {
    errores.push(
      `estado "${correspondencia.estado}" solo puede asignarlo un analista (IA2)`
    );
  }

  if (!Array.isArray(correspondencia.senales)) {
    errores.push("falta el desglose de señales");
  }

  if (correspondencia.senales?.length && !correspondencia.explicacion) {
    errores.push("una puntuación sin explicación no es admisible (IA1)");
  }

  return { valido: errores.length === 0, errores };
}


export function validarEvidenciaSocial(evidencia) {
  const errores = [];

  if (!evidencia) return { valido: false, errores: ["evidencia vacía"] };

  if (!evidencia.platform) errores.push("falta platform");

  if (!evidencia.url) errores.push("falta url");

  if (!Object.values(TIPOS_EVIDENCIA).includes(evidencia.tipo)) {
    errores.push(`tipo no válido: ${evidencia.tipo}`);
  }

  if (!evidencia.origen?.submotor) errores.push("falta linaje: origen.submotor");

  return { valido: errores.length === 0, errores };
}


/*
-----------------------------------------------------------
CATÁLOGO DE PLATAFORMAS con su tipo, derivado de textUtils
para no duplicar la tabla de dominios.
-----------------------------------------------------------
*/

export function catalogoPlataformas() {
  return PLATAFORMAS_CONOCIDAS.filter((p) =>
    PLATAFORMAS_SOCIALES.includes(p.id)
  ).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    tipo: p.tipo,
    dominios: p.dominios
  }));
}
