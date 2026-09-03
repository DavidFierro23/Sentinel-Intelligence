import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/*
===========================================================
CONFIG DE VERIFICACION DE RENDER — CANDIDATE ESTRATEGICO
CANDIDATE-STRATEGIC-UX-01
===========================================================

    npx vite build --config vite.candidate-ux.config.js
    node dist-ssr-cand/check.mjs [linea-base.json]

POR QUE EXISTE
-----------------------------------------------------------

Porque este gate mueve una jerarquia visual, y las cinco cosas
que arregla se rompen en silencio:

    que «Solidez» vuelva a ser el titular;
    que la comparacion vuelva a ordenarse por completitud;
    que un hueco se pinte como 0;
    que momentum diga «estable»;
    que `historico.ventanas[].delta` acabe en una tarjeta.

La ultima es la que mas importa: ese campo resta snapshots de
CUENTAS DISTINTAS, y pintado en una ficha se leeria como
«perdio 29.000 seguidores esta semana».

Ningun test de dominio ve nada de esto, porque todas las
funciones devuelven lo que deben. El defecto esta en que la
pantalla elige mal que campo pintar.

NO sustituye a la revision visual: no comprueba color,
espaciado ni jerarquia real.
===========================================================
*/

export default defineConfig({
  plugins: [react()],

  build: {
    ssr: true,
    outDir: "dist-ssr-cand",
    emptyOutDir: true,
    rolldownOptions: {
      input: "tests/candidate-ux.check.jsx",
      output: { entryFileNames: "check.mjs" }
    }
  }
});
