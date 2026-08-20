// apps/backend/services/identityCorrelationService.js

import {
  obtenerEnlace,
  normalizarUrl,
  detectarPlataformaPorUrl,
  extraerHandle
} from "./textUtils.js";

/*
===========================================================
IDENTITY CORRELATION SERVICE

Agrupa las evidencias en identidades (perfil/cuenta) por
plataforma + usuario.

CORRECCIÓN (Sprint 2, defecto B):

La versión anterior leía `item.enlace` en crudo. Cuando el
buscador devolvía una redirección
(//duckduckgo.com/l/?uddg=...), el dominio detectado era el
del BUSCADOR, nunca el de la red social. Resultado: este
motor devolvía 0 identidades de forma silenciosa.

Ahora:

1. Se resuelve el enlace con obtenerEnlace() de textUtils,
   que desenvuelve la redirección.
2. La plataforma se detecta por DOMINIO de la URL, nunca por
   el título o la descripción.
3. El usuario se extrae con extraerHandle(), que descarta
   segmentos que no son usuarios (watch, profile.php...).
4. Se registran los MOTORES que aportaron cada identidad,
   para corroboración multi-motor.

NOTA sobre `confianza`:
Se conserva la heurística existente (base + evidencias) para
no romper el panel actual. La puntuación definitiva es
trabajo del Confidence Engine (sprint siguiente).
===========================================================
*/

/*
  Presentación por plataforma. La detección NO depende de
  esta tabla: se usa solo para color e icono en la interfaz.

  twitter.com se normaliza a "X" en textUtils, por lo que
  ambos dominios convergen en una sola identidad en lugar de
  producir dos.
*/
const PRESENTACION = {
  Facebook:  { color: "#1877F2", icono: "facebook" },
  Instagram: { color: "#E1306C", icono: "instagram" },
  X:         { color: "#111827", icono: "x" },
  Twitter:   { color: "#1DA1F2", icono: "twitter" },
  TikTok:    { color: "#25F4EE", icono: "music" },
  LinkedIn:  { color: "#0A66C2", icono: "linkedin" },
  YouTube:   { color: "#FF0000", icono: "youtube" },
  Wikipedia: { color: "#CBD5E1", icono: "book" }
};

/*
  Plataformas que representan una CUENTA de una persona u
  organización. Wikipedia o Wayback no son identidades.
*/
const TIPOS_CON_IDENTIDAD = new Set(["social", "video"]);


function presentacionDe(nombre) {
  return PRESENTACION[nombre] || { color: "#60A5FA", icono: "globe" };
}


export function correlacionarIdentidades(resultados = []) {
  const lista = Array.isArray(resultados) ? resultados : [];

  const mapa = new Map();

  lista.forEach((item) => {
    if (!item) return;

    /*
      1. Enlace REAL (redirección desenvuelta).
    */
    const enlace = obtenerEnlace(item);

    if (!enlace) return;

    /*
      2. Plataforma por DOMINIO.
    */
    const plataforma = detectarPlataformaPorUrl(enlace);

    if (!plataforma) return;

    if (!TIPOS_CON_IDENTIDAD.has(plataforma.tipo)) return;

    /*
      3. Usuario / handle.
    */
    const usuario = extraerHandle(enlace);

    if (!usuario) return;

    const clave = `${plataforma.nombre}:${usuario.toLowerCase()}`;

    const presentacion = presentacionDe(plataforma.nombre);

    /*
      Motor que aportó esta evidencia.
    */
    const motor =
      item.__origen ||
      item.motor ||
      (item.origenPivot ? "Pivot Search" : "Descubrimiento general");

    if (!mapa.has(clave)) {
      mapa.set(clave, {
        plataforma: plataforma.nombre,
        plataformaId: plataforma.id,
        usuario,
        enlace,
        urlNormalizada: normalizarUrl(enlace),
        dominio: plataforma.dominio,
        color: presentacion.color,
        icono: presentacion.icono,

        confianza: 80,
        evidencias: 1,

        /*
          Corroboración: qué motores y qué URLs distintas
          apuntan a esta misma identidad.
        */
        motores: new Set([motor]),
        urls: new Set([normalizarUrl(enlace)].filter(Boolean)),

        /*
          Compatibilidad con el panel actual.
        */
        origen: motor,
        verificado: false
      });

      return;
    }

    const actual = mapa.get(clave);

    actual.evidencias += 1;

    actual.motores.add(motor);

    const normalizada = normalizarUrl(enlace);

    if (normalizada) actual.urls.add(normalizada);

    /*
      Heurística provisional, se conserva tal cual.
      El Confidence Engine la sustituirá.
    */
    actual.confianza = Math.min(99, actual.confianza + 3);
  });

  return [...mapa.values()]
    .map((identidad) => ({
      ...identidad,

      /*
        Set no es serializable a JSON.
      */
      motores: [...identidad.motores],
      urls: [...identidad.urls],
      totalMotores: identidad.motores.size,
      corroboracionMultiMotor: identidad.motores.size > 1
    }))
    .sort((a, b) => {
      if (b.totalMotores !== a.totalMotores) return b.totalMotores - a.totalMotores;
      return b.confianza - a.confianza;
    });
}
