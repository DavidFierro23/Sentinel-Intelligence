import express from "express";
import { investigarObjetivo } from "../services/osintEngine.js";

import {
  obtenerImagen,
  estadoCache,
  HOSTS_PERMITIDOS
} from "../services/avatar/avatarProxy.js";

import { absolutizarAvatares } from "../services/avatar/avatarIntelligenceEngine.js";

const router = express.Router();

/*
  Toda respuesta de investigación pasa por aquí para
  convertir las rutas de proxy relativas en URLs absolutas.
  Es la única capa que conoce el host de la petición.
*/
function responder(res, req, resultado) {
  return res.json(absolutizarAvatares(resultado, req));
}

router.post("/google", async (req, res) => {
  try {
    const { objetivo } = req.body;

    if (!objetivo) {
      return res.status(400).json({
        error: "Debe enviar un objetivo."
      });
    }

    const resultado = await investigarObjetivo(objetivo);

    responder(res, req, resultado);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message
    });
  }
});

router.get("/google/:objetivo", async (req, res) => {
  try {
    const resultado = await investigarObjetivo(req.params.objetivo);

    responder(res, req, resultado);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message
    });
  }
});

/*
===========================================================
AVATAR PROXY  (Sprint 3.2.1 — resuelve B1)
===========================================================

El frontend nunca carga la imagen desde Wikimedia: la pide
aquí. El backend resuelve la cadena de redirecciones, valida
host y tipo, y sirve los bytes desde nuestro propio origen,
donde el CORS está bajo nuestro control.

No es un proxy abierto: solo hosts de Wikimedia, con
validación del host FINAL tras las redirecciones.
===========================================================
*/
router.get("/avatar", async (req, res) => {
  const src = req.query.src;

  if (!src) {
    return res.status(400).json({
      error: "Falta el parámetro src.",
      hostsPermitidos: HOSTS_PERMITIDOS
    });
  }

  try {
    const imagen = await obtenerImagen(String(src));

    if (!imagen.ok) {
      return res.status(imagen.estado || 502).json({
        error: imagen.motivo,
        /*
          Se distingue "no pudimos consultar" de "no existe",
          igual que en el resto de la plataforma.
        */
        noConsultado: imagen.noConsultado === true,
        hostsPermitidos: HOSTS_PERMITIDOS
      });
    }

    res.set({
      "Content-Type": imagen.contentType,
      "Content-Length": String(imagen.bytes),
      /*
        Cacheable: la fotografía de una persona no cambia a
        menudo, y el navegador la pide en cada render del grafo.
      */
      "Cache-Control": "public, max-age=86400",
      /*
        Atribución en cabeceras: la licencia viaja con la
        imagen, no solo en el JSON.
      */
      "X-Sentinel-Fuente-Original": imagen.urlFinal,
      "X-Sentinel-Licencia": "Wikimedia Commons",
      "X-Sentinel-Cache": imagen.desdeCache ? "hit" : "miss"
    });

    return res.send(imagen.buffer);

  } catch (error) {
    console.error("[avatar proxy]", error);

    return res.status(500).json({ error: error.message });
  }
});

router.get("/health", (req, res) => {
  res.json({
    modulo: "OSINT",
    estado: "Operativo",
    version: "3.2.1",
    fusionEngine: "Activo",
    avatarProxy: {
      activo: true,
      hostsPermitidos: HOSTS_PERMITIDOS,
      cache: estadoCache()
    }
  });
});

export default router;
