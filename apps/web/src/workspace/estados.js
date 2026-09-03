// apps/web/src/workspace/estados.js

/*
===========================================================
SENTINEL-UX-CONSOLIDATION-01 — VOCABULARIO DE ESTADOS
===========================================================

La tabla y el traductor viven en un `.js` aparte, sin JSX, por
la misma razon que `Sidebar` ya declaraba: un fichero que
exporta un componente Y una funcion rompe el fast refresh de
Vite. La regla existia y la salte al escribir el chip; queda
corregida.

UN SOLO SITIO DONDE UN ENUM SE VUELVE UNA FRASE
-----------------------------------------------------------

Cada linea tenia su propio vocabulario: Media traducia
COBERTURA_INSUFICIENTE, Candidate mostraba REQUIERE_PROVEEDOR
crudo y Territorial usaba sus propios estados. El analista veia
tres idiomas en tres pantallas del mismo producto.

El valor tecnico NO desaparece: viaja en el `title` del chip
para quien audita, y la frase es lo que se lee.

EL ROJO NO SE USA PARA UN DATO QUE FALTA
-----------------------------------------------------------

Un hueco de cobertura no es un error. El ambar es para «no lo
sabemos», el verde para «medido», y el rojo solo para un
conflicto que exige decision humana.
===========================================================
*/

export const ESTADOS = Object.freeze({
  /* --- medido --- */
  OPERATIVO: { texto: "Operativo", tono: "bien" },
  MEDIDO: { texto: "Medido", tono: "bien" },
  MEDIDO_OFICIAL: { texto: "Medido · vía oficial", tono: "bien" },
  MEDIDO_PROVEEDOR: { texto: "Medido · vía proveedor", tono: "bien" },
  MEDIDO_PUBLICO: { texto: "Medido · vía pública", tono: "bien" },
  VERIFICADA: { texto: "Verificada", tono: "bien" },

  /* --- medido a medias --- */
  OPERATIVO_CON_LIMITACIONES: { texto: "Operativo con limitaciones", tono: "aviso" },
  PARCIAL: { texto: "Parcial", tono: "aviso" },
  OBSERVADA: { texto: "Observada", tono: "neutro" },
  ENCONTRADO: { texto: "Encontrado, sin medir", tono: "aviso" },

  /* --- no lo sabemos --- */
  HISTORICO_INSUFICIENTE: { texto: "Histórico insuficiente", tono: "aviso" },
  COBERTURA_INSUFICIENTE: { texto: "Cobertura insuficiente", tono: "aviso" },
  SIN_DATOS: { texto: "Sin datos", tono: "neutro" },
  SIN_EVIDENCIA: { texto: "Sin evidencia observable", tono: "neutro" },
  NO_DISPONIBLE: { texto: "Dato no disponible", tono: "neutro" },
  SIN_ACTIVO_CONOCIDO: { texto: "Sin activo conocido", tono: "neutro" },
  NO_PROBADO: { texto: "No probado", tono: "neutro" },
  FECHA_NO_NORMALIZADA: { texto: "Fecha no normalizada", tono: "aviso" },

  /* --- falta algo nuestro --- */
  REQUIERE_CREDENCIAL: { texto: "Requiere credencial", tono: "aviso" },
  REQUIERE_PROVEEDOR: { texto: "Requiere proveedor", tono: "aviso" },
  BLOQUEADO: { texto: "Bloqueado por la fuente", tono: "aviso" },
  NO_SOPORTADO: { texto: "Sin vía disponible", tono: "neutro" },

  /* --- todavia no existe --- */
  EN_PREPARACION: { texto: "En preparación", tono: "neutro" },
  METODOLOGIA_EN_CONSTRUCCION: { texto: "Metodología en construcción", tono: "aviso" },
  RESERVADO: { texto: "Reservado", tono: "neutro" },
  EN_CALIBRACION: { texto: "En calibración", tono: "aviso" },

  /* --- exige una persona --- */
  CONFLICTO_IDENTIDAD: { texto: "Conflicto de identidad", tono: "alerta" },
  NO_CLASIFICADO: { texto: "Pendiente de clasificación", tono: "aviso" },
  IDENTIDAD_INSUFICIENTE: { texto: "Identidad insuficiente", tono: "alerta" }
});


export const TONOS = Object.freeze({
  bien: { color: "var(--sentinel-live)", borde: "var(--sentinel-live)" },
  neutro: { color: "var(--sentinel-texto-suave)", borde: "var(--sentinel-borde-vivo)" },
  aviso: { color: "#eda100", borde: "#eda10055" },
  alerta: { color: "#ff8080", borde: "#ff808055" }
});


export function textoDeEstado(estado) {
  if (!estado) return null;

  const e = ESTADOS[estado];

  if (e) return e.texto;

  /*
    Estado desconocido: se humaniza en lugar de mostrarse en
    mayusculas con guiones bajos. Es peor un enum crudo que una
    frase imperfecta.
  */
  return String(estado).replace(/_/g, " ").toLowerCase();
}


export function tonoDeEstado(estado, tono) {
  return TONOS[tono || ESTADOS[estado]?.tono || "neutro"];
}
