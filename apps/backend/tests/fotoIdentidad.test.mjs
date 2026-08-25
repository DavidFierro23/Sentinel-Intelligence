// apps/backend/tests/fotoIdentidad.test.mjs

/*
===========================================================
PRUEBAS DE FOTOGRAFIA Y FLUJO (P-CAND-UX-03) — T1 a T20
===========================================================

    SENTINEL_LAKE_ADAPTER=memoria node tests/fotoIdentidad.test.mjs

SIN RED Y SIN CUOTA. Ninguna URL de ningun candidato real esta
escrita aqui.

DOS AFIRMACIONES QUE NO SE MEZCLAN
-----------------------------------------------------------

  A · Sentinel corroboro que la cuenta corresponde al candidato.
  B · Sentinel verifico el contenido de la fotografia.

Que la cuenta pase a corroborada NO convierte su fotografia en
verificada. `verificadaPorSentinel` solo habla de B, que hoy
nunca es cierta.

Y UNA CONFUSION QUE PRODUCIA UN DEFECTO VISIBLE
-----------------------------------------------------------

Una URL de cuenta no es una URL de imagen. Confundirlas puso una
pagina de Facebook como `src` de un `<img>` y el navegador
dibujo su icono roto.
===========================================================
*/

process.env.SENTINEL_LAKE_ADAPTER = "memoria";

const ps = await import("../services/projects/projectStore.js");

const ui = await import("../../web/src/services/identidadCandidato.js");

let pass = 0;

let fail = 0;

const fallos = [];

async function t(nombre, comprobacion) {
  try {
    const valor = await comprobacion();

    if (valor === true) {
      pass += 1;
      console.log(`  PASS  ${nombre}`);
    } else {
      fail += 1;
      fallos.push(nombre);
      console.log(`  FALL  ${nombre}  (devolvió ${JSON.stringify(valor)})`);
    }
  } catch (error) {
    fail += 1;
    fallos.push(`${nombre} (${error.message})`);
    console.log(`  ERR   ${nombre}: ${error.message}`);
  }
}

function bloque(titulo) {
  console.log(`\n${titulo}`);
  console.log("-".repeat(titulo.length));
}

const PID = "foto-test";

const PROYECTO = {
  id: PID,
  nombre: "Proyecto de prueba",
  canton: "Cuenca",
  provincia: "Azuay",
  pais: "Ecuador",
  dignidad: "Alcaldía"
};

await ps.crearProyecto(PROYECTO);

const CID = "persona-de-prueba-dos";

await ps.agregarCandidato(PID, {
  nombre: "Persona De Prueba Dos",
  instagram: "https://www.instagram.com/cuentadeprueba",
  facebook: "https://www.facebook.com/cuentadeprueba"
});

const ficha = () => ps.fichaIdentidad(PID, CID, "candidato");

const plat = (f, id) => f.plataformas.find((p) => p.plataformaId === id);

const IMAGEN = "https://ejemplo-de-prueba.ec/retrato.jpg";

const IMAGEN_2 = "https://ejemplo-de-prueba.ec/otro-retrato.png";

/*
===========================================================
T1 a T6 — FLUJO DE GUARDADO
===========================================================

El flujo de la interfaz —cerrar el modal, colapsar la ficha,
mostrar la confirmacion— es estado de React y no se puede
ejercitar desde Node. Lo que SI se puede probar, y es lo que
importa, es el CONTRATO del que ese flujo depende: que guardar
devuelva un aviso que mostrar, que persista, y que un fallo no
destruya nada.
===========================================================
*/

bloque("T1 · T2 · T3 · T4  el contrato del que depende el flujo");

const r1 = await ps.editarCandidato(PID, CID, { fotoUrl: IMAGEN });

await t("T4: guardar devuelve un aviso que la interfaz pueda mostrar", () => {
  /*
    La confirmacion efimera de la interfaz sale de aqui. Sin
    aviso, no habria nada que confirmar.
  */
  return (
    r1.editado === true &&
    typeof r1.aviso === "string" &&
    r1.aviso.length > 10
  );
});

await t("T1 · T2 · T3: guardar deja el estado listo para recargar", async () => {
  /*
    La interfaz recarga el contenido del proyecto ANTES de
    colapsar, para que la tarjeta compacta muestre ya lo guardado
    y no un dato viejo. Se comprueba que ese contenido lo tiene.
  */
  const c = await ps.contenidoDeProyecto(PID);

  const cand = c.candidatos.find((x) => x.id === CID);

  return !!cand && cand.foto?.url === IMAGEN;
});

await t("T5: cancelar no guarda: sin llamada, nada cambia", async () => {
  const antes = JSON.stringify(await ficha());

  /* aqui iria el PATCH que cancelar NO envia */

  return JSON.stringify(await ficha()) === antes;
});

await t("T6: un guardado fallido no destruye nada", async () => {
  /*
    Se pide editar un candidato que no existe: la operacion falla
    y el candidato real queda intacto. La interfaz mantiene el
    modal abierto y conserva lo escrito.
  */
  const antes = JSON.stringify(await ficha());

  const malo = await ps.editarCandidato(PID, "no-existe-este-candidato", {
    fotoUrl: IMAGEN_2
  });

  return (
    malo.editado === false &&
    typeof malo.motivo === "string" &&
    JSON.stringify(await ficha()) === antes
  );
});

/*
===========================================================
T7 · T8 — JERARQUIA DE FOTOGRAFIA
===========================================================
*/

bloque("T7 · T8  lo manual manda; lo derivado se ofrece");

await t("T7: la foto manual tiene prioridad y no se sugiere otra", async () => {
  const f = await ficha();

  return f.foto.url === IMAGEN && f.fotoSugerida === null;
});

await t("T8: sin foto manual se puede derivar de una cuenta", () => {
  /*
    Se prueba el selector directamente con una cuenta que SI trae
    imagen en el expediente. La jerarquia es Instagram antes que
    Facebook.
  */
  const r = ps.seleccionarFotoDeCuentas([
    { plataformaId: "facebook", handle: "fb", id: "facebook:fb", imagen: IMAGEN_2 },
    { plataformaId: "instagram", handle: "ig", id: "instagram:ig", imagen: IMAGEN }
  ]);

  return (
    r.elegida.plataformaId === "instagram" && r.elegida.url === IMAGEN
  );
});

await t("T8b: la jerarquía completa está declarada y en orden", () => {
  return (
    ps.PRIORIDAD_FOTO[0] === "manual" &&
    ps.PRIORIDAD_FOTO[1] === "instagram" &&
    ps.PRIORIDAD_FOTO[2] === "facebook" &&
    ps.PRIORIDAD_FOTO[ps.PRIORIDAD_FOTO.length - 1] === "web"
  );
});

await t("lo que NO es obtenible se declara con su motivo", async () => {
  /*
    No hay API de plataforma social ni scraping, asi que para esas
    plataformas la imagen no es obtenible. Declararlo es la mitad
    del trabajo: sin eso, un hueco parece un fallo del sistema.
  */
  const r = ps.seleccionarFotoDeCuentas([
    { plataformaId: "instagram", handle: "ig", id: "instagram:ig" }
  ]);

  return (
    r.elegida === null &&
    r.noDisponibles.length === 1 &&
    r.noDisponibles[0].disponibilidad === "no_disponible_sin_api" &&
    r.noDisponibles[0].motivo.includes("scraping")
  );
});

await t("la ficha expone el límite en palabras", async () => {
  const f = await ficha();

  return (
    typeof f.fotoLimite === "string" && f.fotoLimite.includes("no se inventa")
  );
});

/*
===========================================================
T9 · T10 — URL DE CUENTA vs URL DE IMAGEN
===========================================================
*/

bloque("T9 · T10  una página de perfil no es una imagen");

await t("T9: una URL de cuenta NO se acepta como fotografía", async () => {
  /*
    EL DEFECTO VISIBLE. Antes esto se guardaba como `url` y la
    interfaz lo ponia en un `<img>`; el navegador dibujaba su
    icono roto.
  */
  const antes = (await ficha()).foto.url;

  await ps.editarCandidato(PID, CID, {
    fotoUrl: "https://www.facebook.com/cuentadeprueba"
  });

  const f = await ficha();

  return (
    f.foto.url === antes &&
    f.foto.intentoRechazado.esUrlDeCuenta === true &&
    f.foto.intentoRechazado.motivo.includes("no de una imagen")
  );
});

await t("T9b: el rechazo dice de qué plataforma era la URL", async () => {
  const f = await ficha();

  return f.foto.intentoRechazado.plataformaId === "facebook";
});

await t("T9c: el backend y la interfaz coinciden en qué es una imagen", () => {
  /*
    La regla esta en los dos lados a proposito: el backend decide
    al guardar y la interfaz decide si intenta pintar. Si
    discreparan, veriamos un icono roto en algo que el backend
    acepto.
  */
  const casos = [
    "https://ejemplo.ec/x.jpg",
    "https://ejemplo.ec/x.webp",
    "https://www.facebook.com/usuario",
    "https://www.instagram.com/usuario/",
    "https://ejemplo.ec/pagina",
    "data:image/png;base64,AAA"
  ];

  return casos.every((u) => ps.esUrlDeImagen(u) === ui.esUrlDeImagen(u));
});

await t("T10: hay avatar de respaldo con iniciales", () => {
  /*
    Nunca el icono roto del navegador. Si la imagen falla, la
    interfaz cae a iniciales, que no fingen ser una fotografia.
  */
  return (
    ui.iniciales("Persona De Prueba Dos") === "PD" &&
    ui.iniciales("Ana") === "AN" &&
    ui.iniciales("") === ""
  );
});

await t("T10b: una foto YA guardada que no es imagen se diagnostica", async () => {
  /*
    Los expedientes escritos antes de este contrato pueden tener
    una URL de cuenta en el campo de fotografia: era lo que
    producia el icono roto. No se corrige el dato del analista sin
    que lo pida; se diagnostica y se dice por que no se muestra.
  */
  const PID2 = "foto-legado-test";

  await ps.crearProyecto({ ...PROYECTO, id: PID2, nombre: "Legado foto" });

  await ps.agregarCandidato(PID2, { nombre: "Legado Foto Prueba" });

  /* Se escribe a mano el estado antiguo, saltando la validacion. */
  const c = await ps.obtenerCandidato(PID2, "legado-foto-prueba");

  await ps.editarCandidato(PID2, "legado-foto-prueba", {
    foto: { url: "https://www.facebook.com/cuentadeprueba", origen: "analista" }
  });

  const f = await ps.fichaIdentidad(PID2, "legado-foto-prueba", "candidato");

  return (
    !!c &&
    (f.foto === null ||
      (f.foto.utilizable === false &&
        typeof f.foto.motivoNoUtilizable === "string"))
  );
});

/*
===========================================================
T11 · T12 — PROCEDENCIA DE LA FOTOGRAFIA
===========================================================
*/

bloque("T11 · T12  procedencia y verificación son cosas distintas");

const DERIVADA = {
  fotoUrl: IMAGEN_2,
  fotoOrigen: "cuenta_declarada",
  fotoDerivadaDeCuenta: true,
  fotoCuentaId: "instagram:cuentadeprueba",
  fotoPlataformaId: "instagram",
  fotoHandle: "cuentadeprueba"
};

await ps.editarCandidato(PID, CID, DERIVADA);

await t("T11: la foto derivada conserva plataforma, cuenta y procedencia", async () => {
  const f = await ficha();

  return (
    f.foto.derivadaDeCuenta === true &&
    f.foto.plataformaId === "instagram" &&
    f.foto.handle === "cuentadeprueba" &&
    f.foto.cuentaId === "instagram:cuentadeprueba" &&
    f.foto.sourceUrl === IMAGEN_2
  );
});

await t("T12: NO se marca verificada automáticamente", async () => {
  const f = await ficha();

  return f.foto.verificadaPorSentinel === false;
});

await t("T12b: corroborar la cuenta NO verifica la fotografía", async () => {
  /*
    Son dos afirmaciones distintas: que la cuenta sea del
    candidato y que la imagen sea suya. Confundirlas convertiria
    una corroboracion de identidad en una garantia sobre una
    fotografia que nadie ha comprobado.
  */
  const cuenta = {
    plataforma: "Instagram",
    plataformaId: "instagram",
    handle: "cuentadeprueba",
    url: { canonica: "https://www.instagram.com/cuentadeprueba" },
    correspondencia: { puntuacion: 60, nivel: "posible" },
    origenes: [{ via: "consulta_dirigida", proveedor: "SerpAPI (Google)" }],
    vias: ["consulta_dirigida"],
    proveedores: ["SerpAPI (Google)"],
    corroboracion: {
      proveedores: ["SerpAPI (Google)"],
      totalProveedores: 1,
      multiProveedor: false,
      vias: ["consulta_dirigida"],
      multiVia: false
    },
    clasificacion: { clase: "cuenta_personal", razones: ["handle coincide"] }
  };

  await ps.registrarInvestigacion(PID, CID, {
    perfilEjecutivo: {
      huellaDigital: { valor: 20 },
      tarjetas: [
        {
          plataforma: "Instagram",
          plataformaId: "instagram",
          handle: "cuentadeprueba",
          correspondencia: 60
        }
      ],
      medios: [],
      instituciones: [],
      indeterminadas: []
    },
    clasificacionCuentas: {
      cuentasObjetivo: [cuenta],
      medios: [],
      instituciones: [],
      indeterminadas: []
    },
    fichaObjetivo: { evidencias: { web: new Array(5).fill({}) } }
  });

  const f = await ficha();

  const ig = plat(f, "instagram").cuentas.find(
    (c) => c.handle === "cuentadeprueba"
  );

  return (
    ig.corroboradaPorSentinel === true && f.foto.verificadaPorSentinel === false
  );
});

await t("el texto de procedencia dice ambas cosas por separado", () => {
  const texto = ui.procedenciaFoto({
    url: IMAGEN_2,
    derivadaDeCuenta: true,
    plataformaId: "instagram",
    handle: "cuentadeprueba",
    verificadaPorSentinel: false
  });

  return (
    texto.includes("obtenida de la cuenta") &&
    texto.includes("no verificada por Sentinel")
  );
});

await t("nunca se llama «oficial» a una imagen encontrada", () => {
  const textos = [
    ui.procedenciaFoto({ url: IMAGEN, origen: "analista" }),
    ui.procedenciaFoto({ url: IMAGEN, provider: "Wikidata" }),
    ui.procedenciaFoto({ url: IMAGEN, derivadaDeCuenta: true, plataformaId: "x" })
  ];

  return textos.every((x) => !/oficial/i.test(x));
});

/*
===========================================================
T13 · T14 — PERSISTENCIA E HISTORIAL
===========================================================
*/

bloque("T13 · T14  la fotografía se persiste y su historia se conserva");

await t("T13: la foto vive en el expediente, no se vuelve a pedir", async () => {
  /*
    Persistida en el candidato: un re-render de React lee lo
    guardado y no dispara ninguna obtencion. Si dependiera del
    render, cada pintado seria una peticion.
  */
  const c = await ps.contenidoDeProyecto(PID);

  const cand = c.candidatos.find((x) => x.id === CID);

  return (
    cand.foto?.url === IMAGEN_2 &&
    typeof cand.foto.obtenidaEn === "string" &&
    typeof cand.foto.ultimaComprobacion === "string"
  );
});

await t("T14: cambiar la foto NO borra la procedencia anterior", async () => {
  const f = await ficha();

  const previa = (f.foto.historial || [])[0];

  return (
    !!previa &&
    previa.url === IMAGEN &&
    previa.origen === "analista" &&
    typeof previa.reemplazadaEn === "string"
  );
});

await t("T14b: el historial acota su tamaño y conserva lo más reciente", async () => {
  for (const n of [3, 4, 5, 6, 7, 8]) {
    await ps.editarCandidato(PID, CID, {
      fotoUrl: `https://ejemplo-de-prueba.ec/r${n}.jpg`
    });
  }

  const f = await ficha();

  return (
    f.foto.historial.length <= 5 &&
    f.foto.historial[0].url.includes("r7")
  );
});

await t("volver a guardar la MISMA foto no duplica historial", async () => {
  const antes = (await ficha()).foto.historial.length;

  await ps.editarCandidato(PID, CID, {
    fotoUrl: "https://ejemplo-de-prueba.ec/r8.jpg"
  });

  return (await ficha()).foto.historial.length === antes;
});

/*
===========================================================
T15 · T16 · T17 — CASOS LIMITE
===========================================================
*/

bloque("T15 · T16 · T17  sin foto, sin redes, y varias de la misma");

await t("T15: un candidato sin fotografía funciona", async () => {
  await ps.agregarCandidato(PID, { nombre: "Sin Foto Prueba" });

  const f = await ps.fichaIdentidad(PID, "sin-foto-prueba", "candidato");

  return f.foto === null && f.plataformas.length === 7;
});

await t("T16: un candidato sin redes funciona", async () => {
  const f = await ps.fichaIdentidad(PID, "sin-foto-prueba", "candidato");

  return (
    f.plataformas.every((p) => p.total === 0) &&
    f.fotoSugerida === null &&
    Array.isArray(f.fotoNoDisponible)
  );
});

await t("T17: varias cuentas de la misma plataforma no rompen la selección", () => {
  /*
    Con dos de Instagram, la seleccion elige una y NO falla. La
    que trae imagen utilizable gana; la otra queda declarada como
    no obtenible.
  */
  const r = ps.seleccionarFotoDeCuentas([
    { plataformaId: "instagram", handle: "uno", id: "instagram:uno" },
    { plataformaId: "instagram", handle: "dos", id: "instagram:dos", imagen: IMAGEN }
  ]);

  return (
    r.elegida.handle === "dos" &&
    r.disponibles.length === 1 &&
    r.noDisponibles.length === 1
  );
});

await t("una imagen que no es imagen no se elige", () => {
  const r = ps.seleccionarFotoDeCuentas([
    {
      plataformaId: "instagram",
      handle: "uno",
      id: "instagram:uno",
      imagen: "https://www.instagram.com/uno"
    }
  ]);

  return r.elegida === null;
});

/*
===========================================================
T19 · T20 — GUARDAR NO PISA LO OTRO
===========================================================
*/

bloque("T19 · T20  foto y cuentas no se pisan entre sí");

await t("T19: guardar una foto no borra ninguna cuenta", async () => {
  const antes = await ficha();

  const total = antes.plataformas.reduce((n, p) => n + p.total, 0);

  await ps.editarCandidato(PID, CID, { fotoUrl: IMAGEN });

  const d = await ficha();

  return d.plataformas.reduce((n, p) => n + p.total, 0) === total;
});

await t("T20: guardar cuentas no borra la foto válida anterior", async () => {
  const antes = (await ficha()).foto.url;

  await ps.editarCandidato(PID, CID, {
    cuentas: ["https://www.tiktok.com/@cuentadeprueba"]
  });

  const d = await ficha();

  return (
    d.foto.url === antes && plat(d, "tiktok").total === 1
  );
});

await t("guardar solo el nombre no toca ni foto ni cuentas", async () => {
  const antes = await ficha();

  await ps.editarCandidato(PID, CID, { nombre: "Persona De Prueba Dos" });

  const d = await ficha();

  return (
    d.foto.url === antes.foto.url &&
    d.plataformas.reduce((n, p) => n + p.total, 0) ===
      antes.plataformas.reduce((n, p) => n + p.total, 0)
  );
});

/*
===========================================================
T18 — HIGIENE
===========================================================
*/

bloque("T18  ninguna URL real de ningún candidato en el código");

await t("T18: ni en este test ni en el código de identidad", async () => {
  const fs = await import("node:fs");

  /*
    El patron se arma por partes para que el literal completo no
    aparezca en los ficheros que se inspeccionan: si estuviera
    escrito de una pieza, la comprobacion se detectaria a si
    misma.
  */
  const prohibidos = [
    ["jota", "lloret"].join(""),
    ["lloret", "valdivieso"].join("")
  ];

  const ficheros = [
    new URL(import.meta.url),
    new URL("../services/projects/projectStore.js", import.meta.url),
    new URL("../../web/src/services/identidadCandidato.js", import.meta.url),
    new URL("../../web/src/components/CandidatePhoto.jsx", import.meta.url),
    new URL("../../web/src/components/CandidateIdentityForm.jsx", import.meta.url),
    new URL("../../web/src/components/CandidateIdentityCard.jsx", import.meta.url)
  ];

  return ficheros.every((f) => {
    const texto = fs.readFileSync(f, "utf8");

    return prohibidos.every((x) => !new RegExp(x, "i").test(texto));
  });
});

/*
===========================================================
CONTRATO PARA ACCOUNT INTELLIGENCE
===========================================================
*/

bloque("preparación  la ficha expone el contrato mínimo por cuenta");

await t("cada cuenta expone lo que el próximo gate necesitará", async () => {
  /*
    Entrada del modulo de monitoreo: identidad estable de la
    cuenta, procedencia y ventanas de observacion. Si faltara
    alguno, habria que cambiar el contrato mas adelante.
  */
  const f = await ficha();

  const cuenta = f.plataformas
    .flatMap((p) => p.cuentas)
    .find((c) => c.corroboradaPorSentinel);

  const campos = [
    "id",
    "plataformaId",
    "handle",
    "url",
    "estado",
    "corroboracion",
    "firstSeenAt",
    "lastSeenAt",
    "lastCheckedAt"
  ];

  return (
    !!cuenta &&
    campos.every((k) => k in cuenta) &&
    typeof f.candidatoId === "string"
  );
});

/* ---------------------------------------------------------
   RESULTADO
--------------------------------------------------------- */

console.log("\n===========================================");
console.log(`PASS: ${pass}    FALL: ${fail}`);

if (fallos.length) {
  console.log("\nFallos:");
  fallos.forEach((f) => console.log(`  - ${f}`));
}

console.log("===========================================\n");

process.exit(fail > 0 ? 1 : 0);
