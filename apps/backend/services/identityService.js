// apps/backend/services/identityService.js

function quitarTildes(texto) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function capitalizar(texto) {
  return texto
    .split(" ")
    .filter(Boolean)
    .map(
      p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
    )
    .join(" ");
}

export function normalizarObjetivo(input) {
  const original = input.trim();

  let objetivo = original;
  let contexto = "";

  if (original.includes(":")) {
    const partes = original.split(":");
    objetivo = partes[0].trim();
    contexto = partes.slice(1).join(":").trim();
  }

  objetivo = capitalizar(objetivo);

  const sinTildes = quitarTildes(objetivo);

  const usuario = sinTildes
    .toLowerCase()
    .replace(/\s+/g, "");

  const usuarioGuion = sinTildes
    .toLowerCase()
    .replace(/\s+/g, "_");

  const iniciales = objetivo
    .split(" ")
    .map(p => p[0])
    .join("")
    .toLowerCase();

  return {
    original,
    objetivo,
    contexto,
    variantes: [
      objetivo,
      sinTildes,
      `"${objetivo}"`,
      usuario,
      usuarioGuion,
      iniciales
    ]
  };
}