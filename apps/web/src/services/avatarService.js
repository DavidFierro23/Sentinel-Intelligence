// apps/backend/services/avatarService.js

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
      width="256"
      height="256"
      viewBox="0 0 256 256"
    >
      <rect
        width="256"
        height="256"
        rx="128"
        fill="#0B1738"
      />

      <circle
        cx="128"
        cy="128"
        r="116"
        fill="none"
        stroke="#3B82F6"
        stroke-width="8"
      />

      <text
        x="128"
        y="145"
        text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif"
        font-size="76"
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
    confianza: 70,
    fuente: "local"
  };
}