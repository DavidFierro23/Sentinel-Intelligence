// apps/backend/services/social/identity/signals/declarationSignal.js

/*
===========================================================
SEÑAL S8 — DECLARACIÓN DE REFERENCIA
===========================================================

Se activa cuando una base de conocimiento con procedencia
auditable atribuye la cuenta al objetivo.

POR QUÉ ES UNA SEÑAL NUEVA Y NO S6
-----------------------------------------------------------

S6 mide que un dominio YA asociado al objetivo enlace la
cuenta. Aquí el enlace no viene del objetivo: viene de un
tercero de referencia que afirma la propiedad de la cuenta.

Son cosas distintas y —esto es lo que importa para el tope de
concurrencia— son INDEPENDIENTES: proceden de fuentes
distintas. S1, S2, S6 y S7 se calculan sobre las evidencias
del buscador; S8 se calcula sobre una base de conocimiento
que el buscador no produjo. Contar S8 como señal concurrente
es legítimo precisamente por eso.

POR QUÉ NO CONFIRMA
-----------------------------------------------------------

Una declaración es fuerte, pero es la afirmación de un
tercero, no una lectura del perfil. Puede estar
desactualizada, la cuenta puede haber cambiado de manos o de
nombre. Por eso S8 pesa 30 y no más, y por eso sigue rigiendo
el tope humano: el sistema no confirma identidades.
===========================================================
*/

const PESO_MAXIMO = 30;

export function evaluarS8(candidato, perfil) {
  const declaracion = candidato?.declaracion || null;

  const base = {
    id: "S8",
    nombre: "Declaración de referencia",
    esContrasenal: false,
    pesoMaximo: PESO_MAXIMO
  };

  if (!declaracion?.fuente) {
    return {
      ...base,
      activa: false,
      puntos: 0,
      detalle:
        "Ninguna base de conocimiento declara esta cuenta como perteneciente al objetivo.",
      /*
        Ausencia de declaración NO es señal en contra: la
        mayoría de las cuentas legítimas no están registradas
        en ninguna base de referencia.
      */
      interpretacion: "no_declarada"
    };
  }

  const { nombre, entidad, propiedad } = declaracion.fuente;

  /*
    La declaración solo vale si la entidad fue verificada como
    el objetivo. Sin esa verificación estaríamos importando las
    cuentas de un homónimo — el fallo más grave posible aquí.
  */
  const verificada = candidato.declaracion?.confianza?.valor > 0;

  if (!verificada) {
    return {
      ...base,
      activa: false,
      puntos: 0,
      detalle: `${nombre} declara la cuenta, pero la entidad ${entidad || "?"} no quedó verificada como el objetivo.`,
      interpretacion: "declaracion_no_verificable"
    };
  }

  let puntos = PESO_MAXIMO;

  const matices = [];

  /*
    Identificador opaco (id de canal de YouTube): la
    declaración vale, pero no aporta un nombre elegido que
    corroborar contra el objetivo.
  */
  if (candidato.handleOpaco || declaracion.handleOpaco) {
    puntos -= 4;
    matices.push("el identificador es opaco y no corrobora el nombre");
  }

  return {
    ...base,
    activa: true,
    puntos,
    detalle:
      `${nombre} declara esta cuenta como oficial del objetivo ` +
      `(entidad ${entidad}, propiedad ${propiedad})` +
      (matices.length ? `; ${matices.join("; ")}` : "") +
      ". Es la afirmación de una fuente de referencia, no una lectura del perfil.",
    interpretacion: "declarada",
    fuente: declaracion.fuente,
    /*
      IA4 — de dónde salió exactamente el dato.
      IA1 — por qué suma lo que suma.
    */
    limite:
      "Una declaración puede estar desactualizada: no sustituye la verificación del perfil."
  };
}

export default { evaluarS8 };
