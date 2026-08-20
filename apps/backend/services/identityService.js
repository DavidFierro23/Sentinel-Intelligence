// apps/backend/services/identityService.js

import { quitarTildes, normalizarTexto } from "./textUtils.js";

/*
===========================================================
SENTINEL INTELLIGENCE
IDENTITY SERVICE — normalización del objetivo y variantes

Este servicio NO consulta fuentes externas ni afirma nada
sobre el objetivo. Solo deriva formas de escritura del
término buscado, que después se usan para:

- construir el Perfil de Referencia
- (más adelante) buscar por handle y no solo por nombre
===========================================================
*/


function capitalizar(texto) {
  return String(texto ?? "")
    .split(" ")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}


/*
-----------------------------------------------------------
NORMALIZAR OBJETIVO

Compatibilidad: mantiene la firma y los campos originales
(original, objetivo, contexto, variantes) y añade campos
nuevos sin eliminar ninguno.

Sintaxis admitida:   "Daniel Noboa: presidente Ecuador"
El texto tras ":" se toma como contexto declarado por el
usuario, NO como evidencia encontrada.
-----------------------------------------------------------
*/

export function normalizarObjetivo(input) {
  const original = String(input ?? "").trim();

  let objetivo = original;
  let contexto = "";

  if (original.includes(":")) {
    const partes = original.split(":");
    objetivo = partes[0].trim();
    contexto = partes.slice(1).join(":").trim();
  }

  objetivo = capitalizar(objetivo);

  const sinTildes = quitarTildes(objetivo);

  const palabras = normalizarTexto(sinTildes)
    .split(" ")
    .filter(Boolean);

  const usuario = sinTildes.toLowerCase().replace(/\s+/g, "");

  const usuarioGuion = sinTildes.toLowerCase().replace(/\s+/g, "_");

  const usuarioPunto = sinTildes.toLowerCase().replace(/\s+/g, ".");

  const usuarioGuionMedio = sinTildes.toLowerCase().replace(/\s+/g, "-");

  const iniciales = palabras.map((p) => p[0]).join("");

  /*
    Variantes originales — se conservan en el mismo orden
    para no romper ningún consumidor existente.
  */
  const variantes = [
    objetivo,
    sinTildes,
    `"${objetivo}"`,
    usuario,
    usuarioGuion,
    iniciales
  ];

  /*
    Variantes de nombre (para coincidencia textual).
  */
  const variantesNombre = [...new Set(
    [
      objetivo,
      sinTildes,
      normalizarTexto(sinTildes),
      palabras.length > 2
        ? capitalizar(`${palabras[0]} ${palabras[palabras.length - 1]}`)
        : null,
      palabras.length > 1
        ? capitalizar(`${palabras[0]} ${palabras[1]}`)
        : null
    ].filter(Boolean)
  )];

  /*
    Variantes de handle (para búsqueda por usuario).
    El Fusion Engine las usará para dejar de buscar
    únicamente por nombre.
  */
  const variantesHandle = [...new Set(
    [
      usuario,
      usuarioGuion,
      usuarioPunto,
      usuarioGuionMedio,
      palabras.length > 1 ? `${palabras[0]}${palabras[palabras.length - 1]}` : null,
      palabras.length > 1 ? `${palabras[0][0]}${palabras[palabras.length - 1]}` : null,
      iniciales.length >= 2 ? iniciales : null
    ]
      .filter(Boolean)
      .filter((v) => v.length >= 3)
  )];

  /*
    Tipo de objetivo: condiciona qué fuentes tienen sentido.
    Un nombre de persona no tiene WHOIS.
  */
  const tipoObjetivo = detectarTipoObjetivo(original);

  return {
    // --- campos originales (compatibilidad) ---
    original,
    objetivo,
    contexto,
    variantes,

    // --- campos nuevos ---
    normalizado: normalizarTexto(objetivo),
    palabras,
    variantesNombre,
    variantesHandle,
    iniciales,
    tipoObjetivo
  };
}


/*
-----------------------------------------------------------
DETECTAR TIPO DE OBJETIVO

Clasificación conservadora y puramente sintáctica.
No infiere nada sobre la persona u organización.
-----------------------------------------------------------
*/

export function detectarTipoObjetivo(entrada = "") {
  const texto = String(entrada ?? "").trim();

  if (!texto) return "desconocido";

  if (/^https?:\/\//i.test(texto)) return "url";

  if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(texto)) return "correo";

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(texto)) return "ip";

  if (/^@[\w.]+$/.test(texto)) return "handle";

  if (/^[\w-]+(\.[\w-]+)+$/.test(texto) && !texto.includes(" ")) return "dominio";

  const palabras = texto.split(/\s+/).filter(Boolean);

  if (palabras.length >= 2 && palabras.length <= 5) return "persona";

  return "termino";
}
