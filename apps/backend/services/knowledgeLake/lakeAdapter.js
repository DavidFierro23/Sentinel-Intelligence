// apps/backend/services/knowledgeLake/lakeAdapter.js

import { appendFile, readFile, mkdir, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";

/*
===========================================================
KNOWLEDGE LAKE — ADAPTADORES DE ALMACENAMIENTO
===========================================================

El Lake no sabe DÓNDE se guardan los registros. Habla con un
adaptador que solo admite dos operaciones:

    anexar(registro)     — nunca sobrescribe
    leerTodos(filtro)    — recupera

No existe `actualizar` ni `eliminar`. La ausencia de esas dos
operaciones EN LA INTERFAZ es lo que hace real el
append-only: no basta con no llamarlas, es que no hay forma
de llamarlas.

TRES ADAPTADORES:

  memoria  desarrollo y pruebas
  fichero  JSONL particionado por fecha — producción inicial
  minio    reservado, no implementado (Cap. 10, DT)

Cambiar de adaptador no cambia una línea del resto del Lake.
Es el mismo patrón del Search Provider Layer, que ya funcionó.
===========================================================
*/


/*
-----------------------------------------------------------
CONTRATO
-----------------------------------------------------------
*/

export const OPERACIONES_PROHIBIDAS = Object.freeze([
  "actualizar",
  "sobrescribir",
  "eliminar",
  "truncar"
]);


/*
===========================================================
ADAPTADOR EN MEMORIA
===========================================================
*/

export function crearAdaptadorMemoria() {
  /* Lista append-only. Nunca se muta un elemento existente. */
  const registros = [];

  return {
    id: "memoria",
    nombre: "Memoria del proceso",
    persistente: false,

    async anexar(registro) {
      /*
        Se congela: cualquier intento posterior de mutarlo
        falla en modo estricto y se ignora en modo laxo. Es
        una barrera adicional al append-only.
      */
      const inmutable = Object.freeze({ ...registro });

      registros.push(inmutable);

      return { anexado: true, posicion: registros.length - 1 };
    },

    async leerTodos() {
      return [...registros];
    },

    async contar() {
      return registros.length;
    },

    async particiones() {
      return [...new Set(registros.map((r) => r.particion).filter(Boolean))];
    },

    async estado() {
      return {
        id: "memoria",
        registros: registros.length,
        persistente: false,
        advertencia:
          "Los registros se pierden al reiniciar el proceso. Adecuado para desarrollo, no para memoria permanente."
      };
    }
  };
}


/*
===========================================================
ADAPTADOR DE FICHERO — JSONL particionado
===========================================================

Un registro por línea, en ficheros particionados por fecha:

    data/knowledge-lake/2026/08/20.jsonl

JSONL y no JSON porque anexar una línea es atómico a nivel de
sistema de ficheros, mientras que reescribir un array JSON
completo exige leer, modificar y sobrescribir — precisamente
lo que el append-only prohíbe.
===========================================================
*/

export function crearAdaptadorFichero(opciones = {}) {
  const raiz =
    opciones.raiz ||
    join(process.cwd(), "data", "knowledge-lake");

  function rutaDeParticion(particion) {
    /* particion = "2026/08/20" */
    return join(raiz, `${particion}.jsonl`);
  }

  async function asegurarDirectorio(ruta) {
    const dir = dirname(ruta);

    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }

  async function listarFicheros(dir = raiz) {
    if (!existsSync(dir)) return [];

    const entradas = await readdir(dir, { withFileTypes: true });

    const ficheros = [];

    for (const entrada of entradas) {
      const ruta = join(dir, entrada.name);

      if (entrada.isDirectory()) {
        ficheros.push(...(await listarFicheros(ruta)));
      } else if (entrada.name.endsWith(".jsonl")) {
        ficheros.push(ruta);
      }
    }

    return ficheros;
  }

  return {
    id: "fichero",
    nombre: "Fichero JSONL particionado",
    persistente: true,
    raiz,

    async anexar(registro) {
      const particion = registro.particion || "sin-particion";

      const ruta = rutaDeParticion(particion);

      await asegurarDirectorio(ruta);

      /*
        appendFile: nunca abre en modo truncado. No existe
        ninguna ruta de código en este adaptador que pueda
        sobrescribir una línea ya escrita.
      */
      await appendFile(ruta, `${JSON.stringify(registro)}\n`, "utf8");

      return { anexado: true, ruta, particion };
    },

    async leerTodos() {
      const ficheros = await listarFicheros();

      const registros = [];

      for (const ruta of ficheros) {
        const contenido = await readFile(ruta, "utf8");

        contenido
          .split("\n")
          .filter((linea) => linea.trim())
          .forEach((linea) => {
            try {
              registros.push(JSON.parse(linea));
            } catch {
              console.error(`[lake] línea ilegible en ${ruta}`);
            }
          });
      }

      return registros;
    },

    async contar() {
      return (await this.leerTodos()).length;
    },

    async particiones() {
      const ficheros = await listarFicheros();

      return ficheros.map((f) =>
        f
          .replace(raiz, "")
          .replace(/\\/g, "/")
          .replace(/^\//, "")
          .replace(/\.jsonl$/, "")
      );
    },

    async estado() {
      const ficheros = await listarFicheros();

      let bytes = 0;

      for (const f of ficheros) {
        try {
          bytes += (await stat(f)).size;
        } catch {
          /* fichero desaparecido entre listado y stat */
        }
      }

      return {
        id: "fichero",
        raiz,
        particiones: ficheros.length,
        bytes,
        persistente: true
      };
    }
  };
}


/*
===========================================================
ADAPTADOR MINIO — reservado, NO implementado
===========================================================

Declarado para que aparezca en el estado del Lake, igual que
Bing en el registro de proveedores. No se invoca: un
adaptador que finge funcionar es peor que uno ausente.
===========================================================
*/

export function crearAdaptadorMinio() {
  const noDisponible = () => {
    throw new Error(
      "Adaptador MinIO no implementado. Requiere credenciales y cliente S3 (Cap. 10 de la Constitución)."
    );
  };

  return {
    id: "minio",
    nombre: "MinIO (S3)",
    persistente: true,
    implementado: false,
    motivo:
      "Reservado. Requiere cliente S3 y credenciales. Preparado arquitectónicamente.",

    anexar: noDisponible,
    leerTodos: noDisponible,
    contar: noDisponible,
    particiones: noDisponible,

    async estado() {
      return {
        id: "minio",
        implementado: false,
        motivo: this.motivo
      };
    }
  };
}


/*
===========================================================
SELECCIÓN DE ADAPTADOR

Por variable de entorno, con memoria como respaldo seguro.
===========================================================
*/

export const ADAPTADORES_DISPONIBLES = Object.freeze([
  "memoria",
  "fichero",
  "minio"
]);


export function crearAdaptador(tipo, opciones = {}) {
  const elegido =
    tipo || process.env.SENTINEL_LAKE_ADAPTER || "fichero";

  switch (elegido) {
    case "memoria":
      return crearAdaptadorMemoria();

    case "fichero":
      return crearAdaptadorFichero(opciones);

    case "minio":
      return crearAdaptadorMinio();

    default:
      console.warn(
        `[lake] adaptador desconocido "${elegido}"; se usa memoria.`
      );

      return crearAdaptadorMemoria();
  }
}
