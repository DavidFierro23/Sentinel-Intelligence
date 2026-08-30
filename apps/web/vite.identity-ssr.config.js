import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/*
===========================================================
CONFIG DE VERIFICACION DE RENDER — EDITOR DE IDENTIDAD
===========================================================

Compila `tests/identity-form.check.jsx` para renderizar en Node
la pantalla «Editar identidad digital» con la respuesta REAL de
la API y comprobar el HTML resultante.

    npx vite build --config vite.identity-ssr.config.js
    node dist-ssr-identidad/check.mjs ./ficha.json

POR QUE EXISTE
-----------------------------------------------------------

Por P-CAND-ASSET-TYPE-UI-FIX-01. El gate anterior dio por
implementado un selector que la pantalla real nunca renderizo:
estaba en otro componente. Los tests de dominio pasaban todos
—y seguian pasando— porque ninguno miraba el HTML.

Un test que comprueba que la funcion devuelve el dato no
comprueba que la pantalla lo pinte. Esa distancia es
exactamente donde se colo el fallo, asi que ahora hay algo que
la cubre.

NO sustituye a mirar la pantalla: no comprueba color ni
espaciado. Comprueba que los selectores existen, cuantos hay y
que opciones ofrecen.
===========================================================
*/

export default defineConfig({
  plugins: [react()],

  build: {
    ssr: true,
    outDir: "dist-ssr-identidad",
    emptyOutDir: true,
    rolldownOptions: {
      input: "tests/identity-form.check.jsx",
      output: { entryFileNames: "check.mjs" }
    }
  }
});
