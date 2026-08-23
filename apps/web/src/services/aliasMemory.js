/*
===========================================================
MOTOR DE ALIAS — Sprint 3.2.4, Bloque H
===========================================================

Aprende los alias de un objetivo a partir de lo que la
investigación devolvió, y los conserva entre sesiones.

Ejemplo real, Juan Cristóbal Lloret:

  handle descubierto   jotalloretv
  titular de la cuenta Jota Lloret Valdivieso
  nombre buscado       Juan Cristóbal Lloret

De ahí salen «Jota Lloret», «jotalloretv» y la inicial
«J. C. Lloret»: tres formas de nombrar a la misma persona que
la siguiente investigación no debería tener que redescubrir.

-----------------------------------------------------------
LÍMITE QUE HAY QUE DECIR EN VOZ ALTA
-----------------------------------------------------------

Este módulo vive en el NAVEGADOR. Guarda en localStorage y
alimenta la interfaz.

NO alimenta el planificador de consultas, que es quien
construiría las búsquedas con estos alias, porque ese
planificador está en el backend y este sprint prohíbe tocarlo.

Consecuencia práctica: los alias se aprenden, se conservan y se
ofrecen al analista para que los use con un clic, pero el
Discovery Engine no los usa por su cuenta. La reutilización es
asistida, no automática. Presentarla como automática sería
mentir sobre lo que hace el sistema.

-----------------------------------------------------------
SOLO ALIAS VÁLIDOS
-----------------------------------------------------------

Se conserva un alias únicamente si comparte el apellido del
objetivo —el último token del nombre buscado—. Es la misma
regla que usa el clasificador de cuentas, y por el mismo
motivo: sin ella, «Juan Carlos» convertiría en alias a
cualquier persona que comparta nombre de pila.
===========================================================
*/

const CLAVE = "sentinel.alias.v1";

const LIMITE_OBJETIVOS = 60;

function normalizar(t) {
  return String(t ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function tokens(t, minimo = 4) {
  return normalizar(t)
    .split(/[^a-z0-9]+/)
    .filter((x) => x.length >= minimo);
}

function leer() {
  try {
    const bruto = localStorage.getItem(CLAVE);

    return bruto ? JSON.parse(bruto) : {};
  } catch {
    /* Un localStorage bloqueado no puede tumbar la interfaz. */
    return {};
  }
}

function guardar(datos) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos));

    return true;
  } catch {
    return false;
  }
}

export function claveObjetivo(nombre) {
  return normalizar(nombre).replace(/\s+/g, "-");
}

/*
-----------------------------------------------------------
¿ES UN ALIAS VÁLIDO DE ESTE OBJETIVO?
-----------------------------------------------------------
*/

export function esAliasValido(alias, nombreObjetivo) {
  const partes = tokens(nombreObjetivo);

  if (!partes.length) return false;

  const apellido = partes[partes.length - 1];

  const plano = normalizar(alias).replace(/[^a-z0-9]/g, "");

  if (!plano || plano.length < 4) return false;

  /* El apellido es obligatorio. Misma regla que el clasificador. */
  if (!plano.includes(apellido)) return false;

  /* No se guarda el propio nombre buscado como alias. */
  if (plano === partes.join("")) return false;

  return true;
}

/*
-----------------------------------------------------------
DERIVAR ALIAS DE UN RESULTADO

Tres fuentes, todas evidencia real de la investigación:

  1. el handle de cada cuenta atribuida al objetivo
  2. el nombre del titular, cuando el buscador lo devolvió en
     la forma canónica «Nombre (@handle)»
  3. la inicial del nombre de pila con el apellido, que es
     como la prensa suele citar a una persona pública
-----------------------------------------------------------
*/

export function derivarAlias(resultado) {
  const nombre = resultado?.fichaObjetivo?.nombrePrincipal;

  if (!nombre) return [];

  const encontrados = new Map();

  const anadir = (valor, origen) => {
    const limpio = String(valor ?? "").trim();

    if (!limpio || !esAliasValido(limpio, nombre)) return;

    const clave = normalizar(limpio);

    if (!encontrados.has(clave)) {
      encontrados.set(clave, { alias: limpio, origen });
    }
  };

  /* 1 · handles de las cuentas atribuidas */
  (resultado?.perfilEjecutivo?.tarjetas || []).forEach((t) => {
    anadir(t.handle, `handle en ${t.plataforma}`);
  });

  /* 2 · nombre del titular declarado en el título del resultado */
  (resultado?.fichaObjetivo?.cuentas || []).forEach((c) => {
    (c.titulosObservados || []).forEach((titulo) => {
      const marcador = `(@${c.handle})`;

      const pos = String(titulo).toLowerCase().indexOf(marcador.toLowerCase());

      if (pos > 0) {
        anadir(String(titulo).slice(0, pos).trim(), "titular de la cuenta");
      }
    });
  });

  /* 3 · inicial + apellido */
  const partes = String(nombre).trim().split(/\s+/);

  if (partes.length >= 2) {
    const apellido = partes[partes.length - 1];

    const iniciales = partes
      .slice(0, -1)
      .map((p) => `${p[0].toUpperCase()}.`)
      .join(" ");

    anadir(`${iniciales} ${apellido}`, "forma abreviada");
  }

  return [...encontrados.values()];
}

/*
-----------------------------------------------------------
APRENDER Y RECORDAR
-----------------------------------------------------------
*/

export function aprender(resultado) {
  const nombre = resultado?.fichaObjetivo?.nombrePrincipal;

  if (!nombre) return { aprendidos: [], total: 0 };

  const clave = claveObjetivo(nombre);

  const datos = leer();

  const previo = datos[clave] || { nombre, alias: [], vistoEn: null };

  const existentes = new Set(previo.alias.map((a) => normalizar(a.alias)));

  const nuevos = derivarAlias(resultado).filter(
    (a) => !existentes.has(normalizar(a.alias))
  );

  datos[clave] = {
    nombre,
    alias: [...previo.alias, ...nuevos],
    vistoEn: new Date().toISOString(),
    investigaciones: (previo.investigaciones || 0) + 1
  };

  /* Poda simple: los objetivos menos recientes salen primero. */
  const claves = Object.keys(datos);

  if (claves.length > LIMITE_OBJETIVOS) {
    claves
      .sort((a, b) =>
        String(datos[a].vistoEn || "").localeCompare(String(datos[b].vistoEn || ""))
      )
      .slice(0, claves.length - LIMITE_OBJETIVOS)
      .forEach((k) => delete datos[k]);
  }

  guardar(datos);

  return {
    aprendidos: nuevos,
    total: datos[clave].alias.length,
    investigaciones: datos[clave].investigaciones
  };
}

export function recordar(nombre) {
  if (!nombre) return null;

  const datos = leer();

  return datos[claveObjetivo(nombre)] || null;
}

export function olvidar(nombre) {
  const datos = leer();

  delete datos[claveObjetivo(nombre)];

  guardar(datos);
}

export default { aprender, recordar, olvidar, derivarAlias, esAliasValido };
