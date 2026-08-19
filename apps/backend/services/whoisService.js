import whois from "whois-json";

export async function buscarWhois(objetivo) {

  try {

    const dominio = objetivo
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");

    const data = await whois(dominio);

    return {

      motor: "Whois Intelligence",

      total: 1,

      resultados: [
        {
          titulo: dominio,
          descripcion: "Información pública del registro del dominio.",
          dominio,
          registrador: data.registrar || data.Registrar || "No disponible",
          creado: data.creationDate || data.created || "No disponible",
          expira: data.registryExpiryDate || data.expires || "No disponible",
          actualizado: data.updatedDate || data.updated || "No disponible",
          pais: data.country || "No disponible"
        }
      ]

    };

  } catch {

    return {

      motor: "Whois Intelligence",

      total: 0,

      resultados: []

    };

  }

}