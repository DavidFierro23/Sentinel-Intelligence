import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/*
===========================================================
COMPILA LA VERIFICACION DEL WORKSPACE CON DATOS REALES
===========================================================

    npx vite build --config vite.workspace-ssr.config.js
    node dist-ssr/workspace-real.mjs <dir-con-payloads>

Aparte de `vite.ssr.config.js` porque son dos comprobaciones
distintas: aquella renderiza los paneles SIN datos y fija las
reglas de honestidad; esta los renderiza CON el corpus real y
exige que las nueve secciones produzcan contenido.
===========================================================
*/

export default defineConfig({
  plugins: [react()],

  build: {
    ssr: true,

    /*
      Sale en `dist-ssr` —que .gitignore ya cubre— y NO vacia el
      directorio: ahi vive tambien `check.mjs`, la otra
      comprobacion. Un `outDir` propio habria dejado salida de
      build sin ignorar.
    */
    outDir: "dist-ssr",
    emptyOutDir: false,
    rolldownOptions: {
      input: "tests/workspace-real.check.jsx",
      output: { entryFileNames: "workspace-real.mjs" }
    }
  }
});
