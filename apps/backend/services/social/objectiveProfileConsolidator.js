// apps/backend/services/social/objectiveProfileConsolidator.js

/*
===========================================================
CONSOLIDADOR DE LA FICHA DEL OBJETIVO
===========================================================

Reúne en un único objeto todo lo que la plataforma sabe del
objetivo, uniendo las tres capas ya implementadas:

  · Perfil de Referencia   nombre, avatar, variantes,
                           contexto, términos discriminantes
                           y confianza del perfil
  · Fusion Engine          motores utilizados y evidencias web
  · Social Intelligence    cuentas candidatas con su
                           correspondencia explicada

Es lo que consume `ReferenceProfilePanel` en el frontend.

REGLA DE DISEÑO: esta función NO calcula ninguna métrica
nueva. Solo reúne y ordena lo ya calculado, conservando la
explicación de cada cifra. Si inventara una métrica propia
habría que explicarla, y nadie podría auditarla contra su
origen.

Se expone a través de `referenceProfileService.js` para que
el Reference Profile Service sea el punto de entrada único,
sin reescribir ese archivo.
===========================================================
*/


export function consolidarFichaObjetivo({
  objetivo,
  perfil = null,
  identidad = null,
  fusion = null,
  social = null
} = {}) {
  if (!perfil) return null;

  /*
    ---------------------------------------------------------
    MOTORES UTILIZADOS

    Se toman del Fusion Engine y de la Search Provider Layer;
    no se reconstruyen. Cada uno declara su estado real,
    incluidos los no disponibles.
    ---------------------------------------------------------
  */
  const motoresFusion = (fusion?.motores || []).map((m) => ({
    id: m.id,
    nombre: m.nombre,
    tipo: m.tipo || null,
    disponible: m.disponible !== false,
    estado: m.estado || (m.disponible === false ? "no disponible" : "ok"),
    consultas: m.consultasEjecutadas ?? null,
    bloqueadas: m.consultasBloqueadas ?? null,
    resultados: m.resultadosBrutos ?? null,
    motivo: m.motivo || null
  }));

  const proveedoresWeb = (fusion?.proveedores?.registro || []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    prioridad: p.prioridad,
    estado: p.estado,
    disponible: p.disponible,
    implementado: p.implementado,
    detalle: p.detalle
  }));

  /*
    ---------------------------------------------------------
    CUENTAS CANDIDATAS

    Del Social Intelligence Layer: ya deduplicadas y con su
    correspondencia explicada.
    ---------------------------------------------------------
  */
  const cuentas = (social?.fichas || []).map((f) => ({
    id: f.id,
    plataforma: f.plataforma,
    plataformaId: f.platform,
    handle: f.handle,
    url: f.url?.canonica || null,
    urlNormalizada: f.url?.clave || null,

    estadoPresencia: f.estadoPresencia,
    modoAcceso: f.modoAcceso,

    correspondencia: f.correspondencia
      ? {
          puntuacion: f.correspondencia.puntuacion,
          nivel: f.correspondencia.nivel,
          etiqueta: f.correspondencia.etiqueta,
          estado: f.correspondencia.estado,
          requiereRevisionHumana: f.correspondencia.requiereRevisionHumana,
          puedeConfirmarloElSistema: false,
          senales: f.correspondencia.senales,
          contrasenales: f.correspondencia.contrasenales,
          explicacion: f.correspondencia.explicacion
        }
      : null,

    calidad: f.quality,
    corroboracion: f.corroboracion,
    origenes: f.origenes,
    titulosObservados: f.titulosObservados,
    linaje: f.linaje,
    hash: f.hash
  }));

  /*
    ---------------------------------------------------------
    EVIDENCIAS — web (Fusion) + sociales (SIL)
    ---------------------------------------------------------
  */
  const evidenciasWeb = (fusion?.evidencias || []).map((e) => ({
    id: e.id,
    tipo: "web",
    titulo: e.titulo,
    descripcion: e.descripcion,
    url: e.url,
    urlNormalizada: e.urlNormalizada,
    dominio: e.dominio,
    plataforma: e.plataforma,
    fecha: e.fecha,
    motores: (e.motores || []).map((m) => m.nombre),
    totalMotores: e.totalMotores,
    corroboracionMultiMotor: e.corroboracionMultiMotor,
    calidad: e.calidad
  }));

  const evidenciasSociales = (social?.evidencias || []).map((e) => ({
    id: e.id,
    tipo: `social:${e.tipo}`,
    titulo: e.titulo,
    descripcion: e.descripcion,
    url: e.url,
    urlNormalizada: e.urlNormalizada,
    plataforma: e.platform,
    handle: e.handle,
    fecha: e.fecha,
    confianza: e.confianza,
    calidad: e.quality,
    origen: e.origen
  }));

  /*
    ---------------------------------------------------------
    CONFIANZA CONSOLIDADA

    Las dos confianzas se exponen SEPARADAS, sin fusionarlas
    en un número único, porque miden cosas distintas:

      · la del perfil    → cuánto sustento documental hay
      · la de una cuenta → si esa cuenta corresponde al objetivo

    Un perfil muy bien documentado puede tener cuentas de
    correspondencia dudosa, y al revés. Promediarlas
    produciría una cifra que no significa nada.
    ---------------------------------------------------------
  */
  const conCorrespondencia = cuentas.filter((c) => c.correspondencia);

  const mejorCuenta =
    conCorrespondencia.sort(
      (a, b) => b.correspondencia.puntuacion - a.correspondencia.puntuacion
    )[0] || null;

  const confianza = {
    perfil: perfil.confianza
      ? {
          puntuacion: perfil.confianza.global,
          nivel: perfil.confianza.nivel,
          componentes: perfil.confianza.componentes,
          significado: perfil.confianza.significado
        }
      : null,

    mejorCorrespondencia: mejorCuenta
      ? {
          puntuacion: mejorCuenta.correspondencia.puntuacion,
          nivel: mejorCuenta.correspondencia.nivel,
          etiqueta: mejorCuenta.correspondencia.etiqueta,
          plataforma: mejorCuenta.plataforma,
          handle: mejorCuenta.handle,
          estado: mejorCuenta.correspondencia.estado,
          explicacion: mejorCuenta.correspondencia.explicacion
        }
      : null,

    aclaracion:
      "Son dos medidas distintas y no se promedian: la del perfil mide el sustento documental del objetivo; la de correspondencia mide si una cuenta concreta le pertenece."
  };

  return {
    esquema: "sentinel.objetivo.ficha.v1",
    version: "1.0",

    /* ---- IDENTIDAD ---- */
    nombrePrincipal: perfil.nombrePrincipal,
    objetivoOriginal: perfil.objetivoOriginal || objetivo || null,
    tipoObjetivo: perfil.tipoObjetivo,

    avatar: identidad?.avatar || null,
    avatarFuente: identidad?.fuente || null,

    variantes: perfil.variantes,
    contexto: perfil.contexto,
    terminosDiscriminantes: perfil.terminosDiscriminantes,
    atributos: perfil.atributos,

    /* ---- CONFIANZA ---- */
    confianza,

    /* ---- CUENTAS CANDIDATAS ---- */
    cuentas,
    coberturaPlataformas: social?.cobertura || [],

    /* ---- MOTORES ---- */
    motores: {
      fusion: motoresFusion,
      proveedoresWeb,
      resumenSesion: fusion?.proveedores?.sesion || null
    },

    /* ---- EVIDENCIAS ---- */
    evidencias: {
      web: evidenciasWeb,
      sociales: evidenciasSociales,
      total: evidenciasWeb.length + evidenciasSociales.length
    },

    /* ---- MÉTRICAS ---- */
    metricas: {
      evidenciasWeb: evidenciasWeb.length,
      evidenciasSociales: evidenciasSociales.length,
      cuentasCandidatas: cuentas.length,
      cuentasProbables: cuentas.filter(
        (c) => c.correspondencia?.estado === "probable"
      ).length,
      fichasFusionadas: social?.deduplicacion?.fusionadas ?? null,
      plataformasNoComprobadas:
        social?.metricas?.plataformasNoComprobadas ?? null,
      senalesMedidas: (social?.senales?.implementadas || []).length,
      senalesTotales: (social?.senales?.catalogo || []).length || 7
    },

    /* ---- LÍMITES DECLARADOS ---- */
    limites: {
      ...(social?.limites || {}),
      senalesNoMedidas: social?.senales?.noImplementadas || []
    },

    advertencias: [
      ...(fusion?.advertencias || []),
      ...(social?.advertencias || [])
    ],

    generadoEn: new Date().toISOString()
  };
}
