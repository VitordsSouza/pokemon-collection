// Estratégia de precificação (lógica pura, sem rede).
//
// Fontes: Cardmarket (Europa, EUR) e TCGplayer (EUA, USD), via TCGdex.
// - Cardmarket: "trend" (tendência de vendas); sem ele, a média de 30 dias.
// - TCGplayer: "marketPrice" (vendas recentes); sem ele, o preço mediano dos anúncios.
// O "highPrice" do TCGplayer nunca entra: costuma trazer anúncios absurdos (ex.: 999).
// Valor de referência = média das fontes disponíveis, já convertidas para BRL.

const positivo = (numero) => (typeof numero === "number" && numero > 0 ? numero : null); // a API usa 0 para "sem dado"
const centavos = (valor) => Math.round(valor * 100) / 100;

function subtiposTcgplayer({ tipo, foil, primeiraEdicao }) {
  if (primeiraEdicao) return ["1st-edition-holofoil", "1st-edition-normal"];
  // Reverse com acabamento especial (Poké Ball, Master Ball…) é um produto próprio, listado como "holofoil".
  if (tipo === "reverse") return foil ? ["reverse-holofoil", "holofoil"] : ["reverse-holofoil"];
  if (tipo === "holo") return ["holofoil", "unlimited-holofoil"];
  return ["normal", "holofoil"]; // a base às vezes marca como "normal" uma carta que é holo
}

// entrada: { tipo, foil, selos, pricing } da variante (ver entradaDaVariante em api.js).
// Retorna os valores na moeda original de cada mercado.
export function extrairCotacao(entrada) {
  if (!entrada?.pricing) return { cardmarket: null, tcgplayer: null };

  const { tipo, foil = null, selos = [], pricing } = entrada;
  const primeiraEdicao = tipo === "firstEdition" || selos.includes("1st-edition");

  // No Cardmarket, os campos "-holo" são o reverse; os demais, a versão comum do produto.
  // "firstEdition" sem detalhamento usaria o produto comum (ilimitado): melhor não cotar.
  let cardmarket = null;
  const cm = pricing.cardmarket;
  if (cm && tipo !== "firstEdition") {
    const sufixo = tipo === "reverse" ? "-holo" : "";
    const valor = positivo(cm[`trend${sufixo}`]) ?? positivo(cm[`avg30${sufixo}`]);
    if (valor) {
      cardmarket = {
        valor,
        menor: positivo(cm[`low${sufixo}`]),
        media30: positivo(cm[`avg30${sufixo}`]), // usada na variação de 30 dias do Resumo
        atualizado: cm.updated ?? null,
      };
    }
  }

  let tcgplayer = null;
  const tp = pricing.tcgplayer;
  const subtipo = subtiposTcgplayer({ tipo, foil, primeiraEdicao })
    .map((nome) => tp?.[nome])
    .find(Boolean);
  const valorTp = positivo(subtipo?.marketPrice) ?? positivo(subtipo?.midPrice);
  if (valorTp) tcgplayer = { valor: valorTp, menor: positivo(subtipo.lowPrice), atualizado: tp.updated ?? null };

  return { cardmarket, tcgplayer };
}

// Indicadores do Resumo. Cada item traz `valor` (referência por unidade em BRL, ou null),
// `quantidade`, `desejada` e, nas cartas reais, `cotacao` (ver comPreco em main.js).
export function resumirColecao(itens) {
  const soma = (lista, parcela) => lista.reduce((total, item) => total + parcela(item), 0);
  const possuidas = itens.filter((item) => !item.desejada);
  const cotadas = possuidas.filter((item) => item.valor != null);

  const valorTotal = soma(cotadas, (item) => item.valor * item.quantidade);
  const unidadesCotadas = soma(cotadas, (item) => item.quantidade);

  // Variação: tendência atual do Cardmarket contra a média de 30 dias, só nas cartas que têm os dois.
  // Os dois lados estão em euro, então o câmbio não interfere.
  const comMedia = possuidas
    .map((item) => ({ item, cm: item.cotacao?.preco?.fontes.find((fonte) => fonte.nome === "Cardmarket") }))
    .filter(({ cm }) => cm?.media30);
  const atual = soma(comMedia, ({ item, cm }) => cm.valor * item.quantidade);
  const media = soma(comMedia, ({ item, cm }) => cm.media30 * item.quantidade);

  return {
    valorTotal: centavos(valorTotal),
    totalCartas: soma(possuidas, (item) => item.quantidade),
    unicas: possuidas.length,
    colecoes: new Set(possuidas.map((item) => item.setId ?? item.setNome)).size,
    desejadas: itens.length - possuidas.length,
    semCotacao: possuidas.length - cotadas.length,
    mediaPorCarta: cotadas.length ? centavos(soma(cotadas, (item) => item.valor) / cotadas.length) : null,
    mediaPorUnidade: unidadesCotadas ? centavos(valorTotal / unidadesCotadas) : null,
    variacao30: media ? atual / media - 1 : null,
  };
}

// cambio: { EUR, USD } em reais. Retorna null quando nenhuma fonte tem preço.
export function calcularPreco(cotacao, cambio) {
  const fontes = [
    cotacao?.cardmarket && { nome: "Cardmarket", moeda: "EUR", ...cotacao.cardmarket },
    cotacao?.tcgplayer && { nome: "TCGplayer", moeda: "USD", ...cotacao.tcgplayer },
  ]
    .filter(Boolean)
    .map((fonte) => ({
      ...fonte,
      valorBRL: centavos(fonte.valor * cambio[fonte.moeda]),
      menorBRL: fonte.menor != null ? centavos(fonte.menor * cambio[fonte.moeda]) : null,
    }));

  if (!fontes.length) return null;

  const valores = fontes.map((fonte) => fonte.valorBRL);
  return {
    fontes,
    referencia: centavos(valores.reduce((soma, valor) => soma + valor, 0) / valores.length),
    minimo: Math.min(...valores),
    maximo: Math.max(...valores),
  };
}
