import { ArrowDown, ArrowUp, Minus, HelpCircle } from "lucide-react";

import { RAMPA_CAMBIO } from "./palette";

/*
===========================================================
DELTA BADGE
===========================================================

Variacion con ICONO Y SIGNO, nunca solo color (§13, regla
derivada de la medicion).

Y un cuarto estado que la mayoria de los paneles olvida: la
variacion NO DISPONIBLE. Cuando la base del periodo anterior
es demasiado pequena, un porcentaje es ruido con forma de
titular —de 1 a 3 evidencias es «+200 %»—, asi que el backend
devuelve `relativaDisponible: false` y aqui se muestra la
variacion absoluta con su motivo, en lugar de un numero que
impresiona y no significa nada.
===========================================================
*/

export default function DeltaBadge({
  absoluta = 0,
  relativa = null,
  disponible = true,
  motivo = null,
  sufijo = ""
}) {
  const sinCambio = absoluta === 0;

  const sube = absoluta > 0;

  const color = sinCambio
    ? RAMPA_CAMBIO.sinCambio
    : sube
      ? RAMPA_CAMBIO.sube
      : RAMPA_CAMBIO.baja;

  const Icono = sinCambio ? Minus : sube ? ArrowUp : ArrowDown;

  const texto =
    disponible && typeof relativa === "number"
      ? `${relativa > 0 ? "+" : ""}${relativa} %`
      : `${absoluta > 0 ? "+" : ""}${absoluta}${sufijo ? ` ${sufijo}` : ""}`;

  return (
    <span
      title={
        motivo ||
        (disponible
          ? `Variación de ${absoluta > 0 ? "+" : ""}${absoluta} respecto del periodo anterior`
          : undefined)
      }
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        color,
        fontSize: "11.5px",
        fontWeight: 600,
        whiteSpace: "nowrap"
      }}
    >
      <Icono size={12} strokeWidth={2.6} style={{ flexShrink: 0 }} />

      {texto}

      {/*
        Cuando el porcentaje no se puede calcular se dice, en el
        propio sitio donde iria el numero. Omitirlo dejaria creer
        que no hubo variacion.
      */}
      {!disponible && (
        <HelpCircle
          size={11}
          style={{ opacity: 0.75, flexShrink: 0 }}
          aria-label="porcentaje no disponible"
        />
      )}
    </span>
  );
}
