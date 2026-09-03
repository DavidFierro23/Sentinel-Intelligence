// apps/web/src/candidato/secciones.js

/*
===========================================================
SUBNAVEGACION DE CANDIDATE — CANDIDATE-STRATEGIC-UX-01 §17
===========================================================

Nueve secciones. Cuatro llevan a algo que ya existe; cinco
declaran que todavia no se agregan a nivel de proyecto.

LA REGLA: NINGUNA PAGINA FALSA
-----------------------------------------------------------

Una pestana que abre una pantalla vacia con titulos de adorno
es peor que una pestana que dice «en preparación», porque la
primera se descubre como falsa despues de haber generado
confianza.

POR QUE CINCO ESTAN EN PREPARACION
-----------------------------------------------------------

No es que falten los datos. Contenido, conversacion, medios,
territorio e historico EXISTEN, pero por candidato, dentro de
su Account Intelligence. Lo que no existe es la vista agregada
de proyecto, que exige decidir como se suma —o si se puede
sumar— entre candidatos.

Cada una dice donde esta hoy su dato, para que el analista no
concluya que no lo tenemos.
===========================================================
*/

export const SECCIONES = Object.freeze([
  {
    id: "resumen",
    etiqueta: "Resumen",
    pregunta: "¿Qué está pasando con cada candidato?",
    estado: null
  },
  {
    id: "comparacion",
    etiqueta: "Comparación",
    pregunta: "¿Cómo se comparan entre ellos, dimensión por dimensión?",
    estado: null
  },
  {
    id: "redes",
    etiqueta: "Redes",
    pregunta: "¿Qué se observó en cada plataforma?",
    estado: null
  },
  {
    id: "contenido",
    etiqueta: "Contenido",
    pregunta: "¿Qué publican y con qué frecuencia?",
    estado: "EN_PREPARACION",
    donde:
      "Hoy vive por candidato, en «Ver inteligencia» → publicaciones observadas."
  },
  {
    id: "conversacion",
    etiqueta: "Conversación",
    pregunta: "¿Qué se publica alrededor de su nombre?",
    estado: "EN_PREPARACION",
    donde: "Hoy vive por candidato, en «Ver inteligencia» → conversación."
  },
  {
    id: "medios",
    etiqueta: "Medios",
    pregunta: "¿Qué medios los publican?",
    estado: "EN_PREPARACION",
    donde:
      "Hoy vive por candidato, en «Ver inteligencia» → amplificación. La vista de medios del proyecto está en el módulo Medios."
  },
  {
    id: "territorio",
    etiqueta: "Territorio",
    pregunta: "¿Dónde ocurre, geográficamente?",
    estado: "EN_PREPARACION",
    donde:
      "Hoy no hay ningún vínculo territorial verificado: la evidencia todavía no trae contrato de geolocalización."
  },
  {
    id: "historico",
    etiqueta: "Histórico",
    pregunta: "¿Qué cambió respecto a antes?",
    estado: "EN_PREPARACION",
    donde:
      "Hoy vive por candidato, en «Ver inteligencia» → histórico. El cambio agregado por candidato no tiene metodología todavía."
  },
  {
    id: "evidencias",
    etiqueta: "Evidencias",
    pregunta: "¿Con qué se sostiene cada dato?",
    estado: "EN_PREPARACION",
    donde:
      "Hoy vive por candidato, en «Ver inteligencia» → evidencias, con su fuente, plataforma, URL y fechas."
  }
]);


export const SECCION_POR_DEFECTO = "resumen";


export function seccionPorId(id) {
  return SECCIONES.find((s) => s.id === id) || SECCIONES[0];
}
