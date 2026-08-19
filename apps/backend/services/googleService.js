export async function buscarGoogle(objetivo) {
  try {
    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(objetivo)}`;

    const respuesta = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const html = await respuesta.text();

    const resultados = [];

    const regex =
      /result__title[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;

    let match;

    while ((match = regex.exec(html)) !== null && resultados.length < 10) {
      resultados.push({
        titulo: match[2].replace(/<[^>]+>/g, ""),
        enlace: match[1],
        descripcion: "Resultado obtenido mediante búsqueda abierta."
      });
    }

    return {
      objetivo,
      motor: "DuckDuckGo Intelligence",
      total: resultados.length,
      tiempo: "Tiempo real",
      resultados
    };
  } catch (error) {
    console.error(error);

    return {
      objetivo,
      motor: "DuckDuckGo Intelligence",
      total: 0,
      tiempo: "0",
      resultados: []
    };
  }
}