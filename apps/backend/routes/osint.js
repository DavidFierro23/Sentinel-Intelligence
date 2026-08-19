import express from "express";
import { investigarObjetivo } from "../services/osintEngine.js";

const router = express.Router();

router.post("/google", async (req, res) => {
  try {
    const { objetivo } = req.body;

    if (!objetivo) {
      return res.status(400).json({
        error: "Debe enviar un objetivo."
      });
    }

    const resultado = await investigarObjetivo(objetivo);

    res.json(resultado);

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
    res.json(resultado);

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
    version: "3.0",
    fusionEngine: "Activo"
  });
});

export default router;