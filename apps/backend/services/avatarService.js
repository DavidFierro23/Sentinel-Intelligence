function limpiarNombre(nombre = "") {
  return String(nombre)
    .replace(/\s+/g, " ")
    .trim();
}

function obtenerIniciales(nombre = "") {
  const limpio = limpiarNombre(nombre);

  if (!limpio) {
    return "OS";
  }

  const partes = limpio
    .split(" ")
    .filter(Boolean);

  if (partes.length === 1) {
    return partes[0]
      .substring(0, 2)
      .toUpperCase();
  }

  return (
    partes[0].charAt(0) +
    partes[partes.length - 1].charAt(0)
  ).toUpperCase();
}

function crearAvatarLocal(nombre = "") {
  const iniciales = obtenerIniciales(nombre);

  const svg = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="512"
      height="512"
      viewBox="0 0 512 512"
    >
      <rect
        width="512"
        height="512"
        rx="256"
        fill="#0B1738"
      />

      <circle
        cx="256"
        cy="256"
        r="232"
        fill="none"
        stroke="#3B82F6"
        stroke-width="10"
      />

      <text
        x="256"
        y="285"
        text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif"
        font-size="150"
        font-weight="700"
        fill="#FFFFFF"
      >
        ${iniciales}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export async function obtenerAvatar(objetivo) {
  const nombre = limpiarNombre(objetivo);

  return {
    nombre,
    tipo: "objetivo",
    avatar: crearAvatarLocal(nombre),

    /*
      B2 (QA-1): antes devolvía 70, un número fijo que no medía
      nada. Este servicio solo genera un SVG con iniciales: no
      tiene forma de estimar si corresponde a la persona.
      La autoridad sobre la confianza es el Avatar Intelligence
      Engine; aquí `null` significa "no evaluado".
    */
    confianza: null,
    fuente: "local"
  };
}