import { useCallback, useMemo, useState } from "react";

import { TerritorialCtx } from "./useTerritorial";

/*
===========================================================
TERRITORIAL CONTEXT — unica fuente de verdad de la vista
===========================================================

Los paneles LEEN de aqui y EMITEN intenciones. Ninguno guarda
estado propio de filtro.

Es lo que garantiza que las vistas nunca se contradigan: si el
ranking dice «parroquia» y la serie dice «canton», el analista
no tiene forma de saber cual creer. Con un solo estado, esa
contradiccion no puede existir.

Equivale al WarRoomContext de UX-WR-001 §10.1, reducido a lo
que este modulo puede sostener hoy: sin instante de replay
—que exige el Replay Reconstructor— y sin capas de mapa
—que exigen la geometria oficial—.
===========================================================
*/

const BACKEND = "http://localhost:3001";


/*
  Ventana por defecto: 30 dias. No 7 como el War Room, y por un
  motivo medido: sin ingesta continua, siete dias de
  observacion bajo demanda dejan casi siempre una serie de
  tres o cuatro puntos, que esta por debajo del minimo para que
  «nivel habitual» signifique algo.
*/
function ventanaPorDefecto() {
  const hasta = new Date();

  const desde = new Date(hasta.getTime() - 30 * 24 * 60 * 60 * 1000);

  return { desde: desde.toISOString(), hasta: hasta.toISOString() };
}


export function TerritorialProvider({ children }) {
  const [territorio, setTerritorio] = useState({
    pais: "Ecuador",
    provincia: "Azuay",
    canton: "Cuenca"
  });

  const [proyectoId, setProyectoId] = useState(null);

  const [ventana, setVentana] = useState(ventanaPorDefecto);

  const [resolucion, setResolucion] = useState("parroquia");

  const [normalizacion, setNormalizacion] = useState("absoluto");

  const [granularidad, setGranularidad] = useState("dia");

  /*
    El modo decide si la vista gasta saldo de SerpAPI. Por
    defecto NO. Ver conversationContracts: el saldo es mensual
    y se comparte con el Discovery Engine.
  */
  const [modo, setModo] = useState("noticias");

  const [seleccion, setSeleccion] = useState(null);

  const [datos, setDatos] = useState(null);

  const [catalogo, setCatalogo] = useState(null);

  const [cargando, setCargando] = useState(false);

  const [error, setError] = useState(null);

  const cargarCatalogo = useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND}/api/territorio/catalogo`);

      if (!r.ok) throw new Error(`HTTP ${r.status}`);

      setCatalogo(await r.json());
    } catch (e) {
      setError(
        `No se pudo leer el catálogo territorial: ${e?.message || "error"}.`
      );
    }
  }, []);

  const analizar = useCallback(async () => {
    setCargando(true);

    setError(null);

    try {
      const r = await fetch(`${BACKEND}/api/territorio/analisis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proyectoId,
          territorio,
          modo,
          resolucion,
          normalizacion,
          granularidad,
          desde: ventana.desde,
          hasta: ventana.hasta
        })
      });

      const j = await r.json();

      if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`);

      setDatos(j);
    } catch (e) {
      setError(e?.message || "fallo el análisis");

      /*
        El resultado anterior NO se borra al fallar. Dejar la
        pantalla en blanco haria perder un análisis que costó
        tiempo —y quizá cuota— por un error de red.
      */
    } finally {
      setCargando(false);
    }
  }, [
    proyectoId,
    territorio,
    modo,
    resolucion,
    normalizacion,
    granularidad,
    ventana
  ]);

  const valor = useMemo(
    () => ({
      BACKEND,

      territorio,
      setTerritorio,

      proyectoId,
      setProyectoId,

      ventana,
      setVentana,

      resolucion,
      setResolucion,

      normalizacion,
      setNormalizacion,

      granularidad,
      setGranularidad,

      modo,
      setModo,

      seleccion,
      setSeleccion,

      datos,
      catalogo,
      cargando,
      error,

      analizar,
      cargarCatalogo,

      /*
        Atajos de lectura. Los paneles no deberian navegar seis
        niveles de la respuesta para pintar una cifra.
      */
      agregado: datos?.territorio?.agregado || null,
      conversacion: datos?.conversacion || null,
      loQueNoSabemos: datos?.loQueNoSabemos || [],
      costo: datos?.costo || null,
      carencias: datos?.territorio?.registroTerritorial?.carencias || []
    }),
    [
      territorio,
      proyectoId,
      ventana,
      resolucion,
      normalizacion,
      granularidad,
      modo,
      seleccion,
      datos,
      catalogo,
      cargando,
      error,
      analizar,
      cargarCatalogo
    ]
  );

  return (
    <TerritorialCtx.Provider value={valor}>{children}</TerritorialCtx.Provider>
  );
}
