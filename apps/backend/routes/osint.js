import express from "express";
import { investigarObjetivo } from "../services/osintEngine.js";

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

router.get("/health", (req, res) => {
  res.json({
    modulo: "OSINT",
    estado: "Operativo",
    version: "3.3.0",
    fusionEngine: "Activo",
    /*
      El proxy de avatares del Sprint 3.2.1 fue sustituido por
      el Sentinel Asset Gateway, capa unica para todos los
      activos. Diagnostico en GET /api/assets/estado.
    */
    assetGateway: {
      activo: true,
      ruta: "/api/assets",
      diagnostico: "/api/assets/estado"
    }
  });
});

export default router;
