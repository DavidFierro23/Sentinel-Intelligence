import Parser from "rss-parser";

const parser = new Parser();

export async function buscarGoogleNews(objetivo) {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(objetivo)}&hl=es-419&gl=EC&ceid=EC:es-419`;

    const feed = await parser.parseURL(url);

    const resultados = feed.items.slice(0, 8).map((item) => ({
      titulo: item.title,
      enlace: item.link,
      descripcion: item.contentSnippet || "Noticia encontrada en Google News.",
      fecha: item.pubDate
    }));

    return {
      motor: "Google News",
      total: resultados.length,
      resultados
    };

  } catch (error) {

    return {
      motor: "Google News",
      total: 0,
      resultados: []
    };

  }
}