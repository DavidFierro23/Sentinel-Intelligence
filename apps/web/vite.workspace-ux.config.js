import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/*
===========================================================
CONFIG DE VERIFICACION DE RENDER — WORKSPACE
SENTINEL-UX-CONSOLIDATION-01
===========================================================

Compila `tests/workspace-ux.check.jsx` para renderizar en Node
la navegacion consolidada y comprobar el HTML resultante.

    npx vite build --config vite.workspace-ux.config.js
    node dist-ssr-ux/check.mjs [home.json]

POR QUE EXISTE
-----------------------------------------------------------

Porque este gate reorganiza la navegacion entera y hay cuatro
afirmaciones que una captura no comprueba:

    que War Room, Knowledge Graph y Correlacion Viva NO esten
    en la navegacion primaria;

    que sus ids sigan resolviendo a un destino util;

    que sin proyecto NO se muestren metricas globales;

    que no aparezca ningun porcentaje de avance inventado.

Las cuatro se rompen en silencio y ninguna la detecta un test
de dominio.

NO sustituye a la revision visual: no comprueba color,
espaciado ni jerarquia.
===========================================================
*/

export default defineConfig({
  plugins: [react()],

  build: {
    ssr: true,
    outDir: "dist-ssr-ux",
    emptyOutDir: true,
    rolldownOptions: {
      input: "tests/workspace-ux.check.jsx",
      output: { entryFileNames: "check.mjs" }
    }
  }
});
