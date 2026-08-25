import { useState } from "react";
import { User } from "lucide-react";

import { esUrlDeImagen, iniciales } from "../services/identidadCandidato";

/*
===========================================================
FOTOGRAFIA DEL CANDIDATO — P-CAND-UX-03
===========================================================

EL DEFECTO QUE CORRIGE

El analista pego `facebook.com/usuario` en el campo de fotografia
y la interfaz lo puso como `src` de un `<img>`. El navegador
mostro su icono roto.

Una pagina de perfil no es un archivo de imagen. Aqui se
comprueba ANTES de intentar dibujarla, y si aun asi la carga
falla, se cae a un avatar propio.

    nunca el icono roto del navegador
    nunca una URL de cuenta como src

TRES CAMINOS Y NINGUNA SORPRESA

  1. hay URL y es de imagen   se intenta cargar
  2. la carga falla           avatar con iniciales
  3. no hay URL utilizable    avatar con iniciales o icono

El avatar de respaldo no finge ser una fotografia: son iniciales
sobre el fondo del sistema.
===========================================================
*/

export default function CandidatePhoto({
  foto,
  nombre,
  tamano = 74,
  radio = "var(--radio-m)"
}) {
  const [fallo, setFallo] = useState(false);

  const url = foto?.url || null;

  /*
    Se valida la URL antes de intentar pintarla. Sin esto, una
    pagina HTML llegaria a `src` y el navegador dibujaria su
    icono de imagen rota, que es exactamente lo que no debe pasar.
  */
  const utilizable = !!url && esUrlDeImagen(url) && !fallo;

  const base = {
    width: `${tamano}px`,
    height: `${tamano}px`,
    borderRadius: radio,
    flexShrink: 0,
    objectFit: "cover"
  };

  if (utilizable) {
    return (
      <img
        src={url}
        alt={`Fotografía de ${nombre || "el candidato"}`}
        onError={() => setFallo(true)}
        style={{
          ...base,
          border: "1px solid var(--sentinel-borde-vivo)",
          background: "var(--sentinel-surface)"
        }}
      />
    );
  }

  const texto = iniciales(nombre);

  return (
    <div
      style={{
        ...base,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--sentinel-surface)",
        border: `1px ${url ? "solid" : "dashed"} var(--sentinel-borde-vivo)`,
        color: "var(--sentinel-cyan)",
        fontSize: `${Math.max(11, Math.round(tamano * 0.32))}px`,
        fontWeight: 600,
        letterSpacing: "0.5px",
        userSelect: "none"
      }}
      title={
        url
          ? fallo
            ? "La imagen no se pudo cargar"
            : "El enlace indicado no es una imagen"
          : "Sin fotografía"
      }
      aria-label={`Sin fotografía de ${nombre || "el candidato"}`}
    >
      {texto || <User size={Math.round(tamano * 0.35)} />}
    </div>
  );
}
