// apps/backend/routes/assets.js

import express from "express";

import {
  obtenerActivo,
  fichaDeActivo,
  estadoGateway
} from "../services/assets/assetGateway.js";

const router = express.Router();

/*
-----------------------------------------------------------
CABECERAS: SOLO ASCII

Las cabeceras HTTP no admiten caracteres fuera de latin1, y
Node las rechaza con ERR_INVALID_CHAR. La licencia por
defecto («Wikimedia Commons — ver la página del archivo»)
lleva raya y tilde, así que ponerla tal cual devolvía un 500.

Detectado por la propia prueba de QA de este sprint: el
endpoint respondía 500 en lugar de servir la imagen.

El valor íntegro viaja en el JSON de la ficha, que es su
sitio; la cabecera lleva una transliteración segura, porque
su función es la atribución rápida, no el texto legal exacto.
-----------------------------------------------------------
*/
function aAsciiSeguro(valor, respaldo = "no declarada") {
  const texto = String(valor ?? "").trim();

  if (!texto) return respaldo;

  const limpio = texto
    .normalize("NFD")
    /* quita diacríticos */
    .replace(/[̀-ͯ]/g, "")
    /* rayas y guiones tipográficos → guion simple */
    .replace(/[‐-―]/g, "-")
    /* comillas tipográficas → rectas */
    .replace(/[‘’“”]/g, "'")
    /* cualquier resto fuera de ASCII imprimible */
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return limpio || respaldo;
}

/*
===========================================================
SENTINEL ASSET GATEWAY — rutas
===========================================================

  GET /api/assets/estado         diagnóstico del gateway
  GET /api/assets/:assetId/ficha metadatos del activo
  GET /api/assets/:assetId?src=  el activo servido

El frontend nunca pide el activo al origen externo: lo pide
aquí. La respuesta sale de NUESTRO origen, así que el CORS
está bajo nuestro control y la cadena de redirecciones de
Wikimedia deja de ser un problema del navegador.
===========================================================
*/

router.get("/estado", (req, res) => {
  res.json(estadoGateway());
});


router.get("/:assetId/ficha", (req, res) => {
  const ficha = fichaDeActivo(req.params.assetId);

  if (!ficha) {
    return res.status(404).json({
      error: "activo no registrado en esta instancia",
      /*
        El registro vive en memoria: tras un reinicio los
        assetId siguen siendo válidos (son deterministas) pero
        su ficha se reconstruye al volver a registrarlos.
      */
      nota:
        "El registro es en memoria. El assetId es determinista, así que la ruta del activo sigue funcionando; la ficha se repuebla al registrarlo de nuevo."
    });
  }

  res.json(ficha);
});


router.get("/:assetId", async (req, res) => {
  const { assetId } = req.params;

  /*
    B2 (QA-1): `src` es OPCIONAL. La via principal es el
    registro del gateway, para que ninguna URL de Wikimedia
    aparezca en el frontend. `src` solo sirve de respaldo tras
    un reinicio del backend.
  */
  const src = req.query.src ? String(req.query.src) : null;

  try {
    const activo = await obtenerActivo(
      assetId,
      src,
      req.query.tipo ? String(req.query.tipo) : null
    );

    if (!activo.ok) {
      return res.status(activo.estado || 502).json({
        error: activo.motivo,
        assetId,
        /*
          Se distingue «no pudimos consultar» de «no existe»,
          igual que en el resto de la plataforma.
        */
        noConsultado: activo.noConsultado === true
      });
    }

    res.set({
      "Content-Type": activo.contentType,
      "Content-Length": String(activo.bytes),
      "Cache-Control": "public, max-age=86400",

      /*
        Los metadatos exigidos viajan también en cabeceras: la
        atribución no debe depender de que alguien lea el JSON.
      */
      "X-Asset-Id": activo.assetId,
      "X-Asset-Source-Type": activo.sourceType,
      "X-Asset-Source-Url": aAsciiSeguro(activo.urlFinal, "no declarada"),
      "X-Asset-License": aAsciiSeguro(activo.license),
      "X-Asset-Fetched-At": activo.fetchedAt,
      "X-Asset-Cache-Status": activo.cacheStatus
    });

    return res.send(activo.buffer);

  } catch (error) {
    console.error("[SAG]", error);

    return res.status(500).json({ error: error.message });
  }
});

export default router;
