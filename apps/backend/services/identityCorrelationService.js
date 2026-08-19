// apps/backend/services/identityCorrelationService.js

const plataformas = [
  {
    nombre: "Facebook",
    dominio: "facebook.com",
    color: "#1877F2",
    icono: "facebook"
  },
  {
    nombre: "Instagram",
    dominio: "instagram.com",
    color: "#E1306C",
    icono: "instagram"
  },
  {
    nombre: "X",
    dominio: "x.com",
    color: "#111827",
    icono: "x"
  },
  {
    nombre: "Twitter",
    dominio: "twitter.com",
    color: "#1DA1F2",
    icono: "twitter"
  },
  {
    nombre: "TikTok",
    dominio: "tiktok.com",
    color: "#25F4EE",
    icono: "music"
  },
  {
    nombre: "LinkedIn",
    dominio: "linkedin.com",
    color: "#0A66C2",
    icono: "linkedin"
  },
  {
    nombre: "YouTube",
    dominio: "youtube.com",
    color: "#FF0000",
    icono: "youtube"
  }
];

function extraerUsuario(url) {
  try {
    const u = new URL(url);

    const partes = u.pathname.split("/").filter(Boolean);

    if (!partes.length) return null;

    return partes[0];
  } catch {
    return null;
  }
}

export function correlacionarIdentidades(resultados = []) {
  const mapa = new Map();

  resultados.forEach((item) => {
    const enlace = item.enlace || "";

    plataformas.forEach((p) => {
      if (!enlace.toLowerCase().includes(p.dominio)) return;

      const usuario = extraerUsuario(enlace);

      if (!usuario) return;

      const clave = `${p.nombre}:${usuario.toLowerCase()}`;

      if (!mapa.has(clave)) {
        mapa.set(clave, {
          plataforma: p.nombre,
          usuario,
          enlace,
          color: p.color,
          icono: p.icono,
          confianza: 80,
          evidencias: 1,
          origen: item.origenPivot ? "Pivot Search" : "Google Discovery",
          verificado: false
        });
      } else {
        const actual = mapa.get(clave);

        actual.evidencias++;

        actual.confianza = Math.min(99, actual.confianza + 3);
      }
    });
  });

  return [...mapa.values()].sort((a, b) => b.confianza - a.confianza);
}