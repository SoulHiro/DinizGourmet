// "Xis Coração" -> "xis coracao". Usado na busca rápida do garçom.
export const normalizarBusca = (texto: string) =>
  texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
