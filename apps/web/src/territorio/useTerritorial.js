import { createContext, useContext } from "react";

/*
===========================================================
CONTEXTO Y HOOK — en fichero propio, sin componente
===========================================================

Separado de TerritorialContext.jsx a proposito.

`reactRefresh.configs.vite` prohibe exportar cualquier cosa que
no sea un componente desde un fichero que exporta componentes:
rompe el fast refresh de Vite. Es el mismo motivo por el que
Sidebar.jsx no exporta su lista de modulos.

Asi que el contexto y el hook viven aqui —sin ningun
componente— y el Provider vive alla —sin ninguna otra
exportacion—.
===========================================================
*/

export const TerritorialCtx = createContext(null);


export function useTerritorial() {
  const ctx = useContext(TerritorialCtx);

  if (!ctx) {
    throw new Error(
      "useTerritorial debe usarse dentro de <TerritorialProvider>."
    );
  }

  return ctx;
}
