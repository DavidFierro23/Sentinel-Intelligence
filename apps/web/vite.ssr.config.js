import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/*
===========================================================
CONFIG DE VERIFICACION DE RENDER — no es un build de produccion
===========================================================

Compila `tests/ssr-render.check.jsx` para poder renderizar los
paneles del modulo territorial en Node y comprobar el HTML
resultante.

    node ../backend/... (arranca el backend en el puerto que sea)
    curl ... /api/territorio/analisis -o payload.json
    npx vite build --config vite.ssr.config.js
    node dist-ssr/check.mjs ./payload.json

POR QUE EXISTE
-----------------------------------------------------------

Comprueba automaticamente lo que una captura de pantalla no
puede comprobar: que no aparezca «0 habitantes» donde el dato
es desconocido, que la etiqueta «Dato oficial pendiente de
integracion» este presente, que no se prometa un mapa que no
existe y que ningun porcentaje se presente como poblacional.

Son las reglas de honestidad del modulo. Sin esta verificacion,
la unica forma de detectar que una de ellas se rompio es que
alguien la vea, y las reglas que dependen de que alguien mire
se rompen en silencio.

NO sustituye a la revision visual: no comprueba color,
espaciado ni jerarquia. Comprueba texto y estructura.
===========================================================
*/

export default defineConfig({
  plugins: [react()],

  build: {
    ssr: true,
    outDir: "dist-ssr",
    emptyOutDir: true,
    rolldownOptions: {
      input: "tests/ssr-render.check.jsx",
      output: { entryFileNames: "check.mjs" }
    }
  }
});
