export async function buscarWayback(objetivo) {

  try {

    let dominio = objetivo
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");

    const url = `https://archive.org/wayback/available?url=${encodeURIComponent(dominio)}`;

    const respuesta = await fetch(url);

    const data = await respuesta.json();

    const snapshot = data?.archived_snapshots?.closest;

    if (!snapshot) {

      return {
        motor: "Wayback Machine",
        total: 0,
        resultados: []
      };

    }

    return {

      motor: "Wayback Machine",

      total: 1,

      resultados: [
        {
          titulo: `Snapshot histórico de ${dominio}`,
          enlace: snapshot.url,
          descripcion: `Captura del ${snapshot.timestamp}`,
          fecha: snapshot.timestamp
        }
      ]

    };

  } catch {

    return {
      motor: "Wayback Machine",
      total: 0,
      resultados: []
    };

  }

}