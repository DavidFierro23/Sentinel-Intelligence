import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/*
===========================================================
CONFIG DE VERIFICACION DE RENDER — MEDIA INTELLIGENCE
MEDIA-UX-CERT-01
===========================================================

Compila `tests/media-home.check.jsx` para renderizar en Node las
secciones reales de Media Intelligence con la respuesta REAL de
la API y comprobar el HTML resultante.

    curl .../api/media/<proyecto>/home?ventana=90d -o home.json
    npx vite build --config vite.media-ssr.config.js
    node dist-ssr-media/check.mjs ./home.json

POR QUE EXISTE
-----------------------------------------------------------

Porque este entorno no tiene navegador automatizable, y porque
—aunque lo tuviera— una captura no detecta que una etiqueta diga
COBERTURA_INSUFICIENTE en vez de «Cobertura insuficiente», ni
que un balanceador de AWS se haya colado en el puesto 5 de un
ranking de medios.

Comprueba las reglas de honestidad de la pantalla: que ningun
hueco se pinte como cero, que ningun identificador tecnico
sustituya a un nombre, que la palabra «influencia» no aparezca y
que los artefactos de recoleccion no parezcan medios.

NO sustituye a la revision visual: no comprueba color,
espaciado ni jerarquia.
===========================================================
*/

export default defineConfig({
  plugins: [react()],

  build: {
    ssr: true,
    outDir: "dist-ssr-media",
    emptyOutDir: true,
    rolldownOptions: {
      input: "tests/media-home.check.jsx",
      output: { entryFileNames: "check.mjs" }
    }
  }
});
