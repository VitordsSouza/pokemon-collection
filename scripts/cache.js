// Cache no localStorage para não repetir consultas de preço e câmbio a cada abertura.
// É descartável: se o navegador não deixar gravar, a aplicação só consulta de novo.
const PREFIXO = "pkm.cache.";

// Retorna { salvoEm, valor } ou null.
export function lerCache(chave) {
  try {
    const bruto = localStorage.getItem(PREFIXO + chave);
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}

export function gravarCache(chave, valor) {
  try {
    localStorage.setItem(PREFIXO + chave, JSON.stringify({ salvoEm: Date.now(), valor }));
  } catch (erro) {
    console.warn("Cache não gravado:", chave, erro);
  }
}

export const estaValido = (salvo, validadeMs) => salvo != null && Date.now() - salvo.salvoEm < validadeMs;
