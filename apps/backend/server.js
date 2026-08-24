import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import osintRoutes from "./routes/osint.js";
import assetRoutes from "./routes/assets.js";
import projectRoutes from "./routes/projects.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

/*
===========================================================
HEALTH OFICIAL DE LA PLATAFORMA
===========================================================

Hallazgo de QA-1: `GET /api/health` devolvía «Cannot GET».

La causa no era que faltara un health, sino que el único que
existía estaba dentro del módulo OSINT
(`/api/osint/health`) y el del SAG en `/api/assets/estado`.
Ambos son diagnósticos DE MÓDULO: responden «¿funciona este
módulo?», no «¿está viva la plataforma?».

Un supervisor, un balanceador o una sonda de despliegue
necesitan lo segundo, y no deben depender de que un módulo
concreto siga existiendo con ese nombre.

Se añade el health de plataforma en la raíz y bajo /api,
porque es donde se lo busca. Los health de módulo se
conservan intactos.
===========================================================
*/

const RAIZ = dirname(fileURLToPath(import.meta.url));

/* La versión sale del package.json: una sola fuente de verdad. */
const VERSION = (() => {
  try {
    return JSON.parse(readFileSync(join(RAIZ, "package.json"), "utf8")).version;
  } catch {
    return "desconocida";
  }
})();

const ARRANCADO_EN = new Date().toISOString();

function formatearUptime(segundos) {
  const s = Math.floor(segundos % 60);
  const m = Math.floor((segundos / 60) % 60);
  const h = Math.floor((segundos / 3600) % 24);
  const d = Math.floor(segundos / 86400);

  const partes = [];

  if (d) partes.push(`${d}d`);
  if (d || h) partes.push(`${h}h`);
  if (d || h || m) partes.push(`${m}m`);

  partes.push(`${s}s`);

  return partes.join(" ");
}

function health(req, res) {
  const segundos = process.uptime();

  res.json({
    status: "ok",
    version: VERSION,
    uptime: formatearUptime(segundos),

    /*
      Complementos útiles para una sonda, sin alterar el
      contrato de los tres campos exigidos.
    */
    uptimeSegundos: Math.floor(segundos),
    arrancadoEn: ARRANCADO_EN,

    /*
      Los health de módulo siguen donde estaban: este endpoint
      los apunta en lugar de duplicar su información.
    */
    modulos: {
      osint: "/api/osint/health",
      assetGateway: "/api/assets/estado"
    }
  });
}

/* Health de plataforma — en la raíz y bajo /api. */
app.get("/health", health);
app.get("/api/health", health);

app.use("/api/osint", osintRoutes);

/* Sentinel Asset Gateway (SAG) */
app.use("/api/assets", assetRoutes);

/* ARQ-INV-002 — proyectos y expedientes. Mismo motor, otro contexto. */
app.use("/api/proyectos", projectRoutes);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Sentinel Backend ejecutándose en http://localhost:${PORT}`);
});