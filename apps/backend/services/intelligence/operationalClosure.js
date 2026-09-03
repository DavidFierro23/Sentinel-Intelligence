/*
===========================================================
CIERRE OPERACIONAL — P-CAND-OPERATIONAL-CLOSURE-01
===========================================================

Reclasifica el resultado de `clasificarCeldaConIdentidad`
(socialBenchmarkMatrix.js, sin tocar) a la taxonomia de CIERRE
que este gate exige: ninguna celda puede quedar `NO_PROBADO`
-"nunca medida, sin razon"- si la razon SI se puede determinar
tecnicamente. `NO_PROBADO` se reclasifica siempre a uno de:

    REQUIERE_PROVEEDOR    identidad suficiente + proveedor capaz
                          conocido para esta plataforma, sin medir
    IDENTIDAD_INSUFICIENTE  identidad demasiado debil para gastar
                            en un proveedor, o sin ninguna semilla
    IDENTITY_CONFLICT     conflicto conocido -nunca se mide-
    NO_SOPORTADO          no existe via conocida, oficial ni de
                          proveedor, para esta plataforma/activo

Esto NO reemplaza `clasificarCeldaConIdentidad`: la envuelve. Los
35 tests de BENCH-02/02A/SNAPSHOTS-01 sobre esa funcion siguen
intactos, sin cambiar su comportamiento.
*/

import { ESTADOS_CELDA, IDENTITY_STATES } from "./socialBenchmarkMatrix.js";

export const ESTADOS_CIERRE = Object.freeze({
  MEDIDO: "MEDIDO",
  PARCIAL: "PARCIAL",
  SIN_CUENTA: "SIN_CUENTA",
  NO_SOPORTADO: "NO_SOPORTADO",
  BLOQUEADO: "BLOQUEADO",
  REQUIERE_CREDENCIAL: "REQUIERE_CREDENCIAL",
  REQUIERE_PROVEEDOR: "REQUIERE_PROVEEDOR",
  IDENTIDAD_INSUFICIENTE: "IDENTIDAD_INSUFICIENTE",
  IDENTITY_CONFLICT: "IDENTITY_CONFLICT",
  ERROR_PROVEEDOR: "ERROR_PROVEEDOR",
  ERROR_OFICIAL: "ERROR_OFICIAL"
});

/*
  Plataformas con un proveedor real, ya probado, capaz de medir
  metricas cuando la via oficial no alcanza. Instagram y Facebook
  vía `pedirAlProveedor` (ScrapeCreators, perfil). TikTok vía el
  mismo proveedor -certificado real en `P-CAND-SOCIAL-BENCH-02`
  (Yaku Perez, 519 300 seguidores) y `SNAPSHOTS-01` (Lloret
  Valdivieso, 29 100)-. X y YouTube NO tienen fallback de
  proveedor probado en este proyecto: su unica via es la oficial.
*/
export const PLATAFORMAS_CON_PROVEEDOR_CAPAZ = new Set(["instagram", "facebook", "tiktok"]);

/*
  Convierte el resultado de `clasificarCeldaConIdentidad` a un
  estado de CIERRE. `plataforma` decide si existe un proveedor
  capaz; `identidadDominante` decide si vale la pena intentarlo.
*/
export function cerrarCelda({ plataforma, celda, identidadDominante }) {
  const base = { ...celda };

  if (identidadDominante === IDENTITY_STATES.IDENTITY_CONFLICT) {
    return {
      ...base,
      estadoCierre: ESTADOS_CIERRE.IDENTITY_CONFLICT,
      motivoCierre: "activo excluido por conflicto de identidad conocido; no se mide ni se cuenta como cobertura"
    };
  }

  // Estados ya definitivos: no requieren reclasificacion.
  const YA_CERRADO = {
    [ESTADOS_CELDA.MEDIDO]: ESTADOS_CIERRE.MEDIDO,
    [ESTADOS_CELDA.PARCIAL]: ESTADOS_CIERRE.PARCIAL,
    [ESTADOS_CELDA.SIN_CUENTA]: ESTADOS_CIERRE.SIN_CUENTA,
    [ESTADOS_CELDA.REQUIERE_PROVEEDOR]: ESTADOS_CIERRE.REQUIERE_PROVEEDOR
  };
  if (YA_CERRADO[celda.estado]) {
    return { ...base, estadoCierre: YA_CERRADO[celda.estado], motivoCierre: celda.motivo };
  }

  if (celda.estado === ESTADOS_CELDA.NO_PROBADO) {
    if (identidadDominante === IDENTITY_STATES.DISCOVERED) {
      return {
        ...base,
        estadoCierre: ESTADOS_CIERRE.IDENTIDAD_INSUFICIENTE,
        motivoCierre: "identidad descubierta automaticamente, sin confirmar por el analista ni corroborada por Sentinel: no se gasta en ella"
      };
    }
    if (PLATAFORMAS_CON_PROVEEDOR_CAPAZ.has(plataforma)) {
      return {
        ...base,
        estadoCierre: ESTADOS_CIERRE.REQUIERE_PROVEEDOR,
        motivoCierre: "identidad suficiente y proveedor tecnicamente capaz para esta plataforma; no medido por decision de presupuesto, no por imposibilidad"
      };
    }
    return {
      ...base,
      estadoCierre: ESTADOS_CIERRE.NO_SOPORTADO,
      motivoCierre: "no existe via oficial ni de proveedor conocida y probada para esta plataforma en este proyecto"
    };
  }

  if (celda.estado === ESTADOS_CELDA.NO_PROBADO_SIN_REFERENCIA) {
    /*
      Sin ninguna referencia del analista y sin evidencia de
      discovery: no hay ninguna semilla de identidad, ni siquiera
      debil. Es identidad insuficiente, no ausencia de cuenta
      -eso inventaria una conclusion que la evidencia no sostiene,
      exactamente lo que P-CAND-SOCIAL-BENCH-02A prohibio-.
    */
    return {
      ...base,
      estadoCierre: ESTADOS_CIERRE.IDENTIDAD_INSUFICIENTE,
      motivoCierre: "no existe referencia declarada por el analista ni evidencia de discovery para esta plataforma: no hay semilla de identidad"
    };
  }

  return { ...base, estadoCierre: ESTADOS_CIERRE.NO_SOPORTADO, motivoCierre: celda.motivo || "estado no contemplado" };
}
