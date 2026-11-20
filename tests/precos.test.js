import { test } from "node:test";
import assert from "node:assert/strict";
import { extrairCotacao, calcularPreco, resumirColecao } from "../scripts/precos.js";

// Recorte real da TCGdex (sv03.5-025, Pikachu da coleção 151).
const pricingPikachu = {
  cardmarket: { updated: "2026-11-19", trend: 0.16, avg30: 0.15, low: 0.02, "trend-holo": 0.66, "avg30-holo": 0.56, "low-holo": 0.04 },
  tcgplayer: {
    updated: "2026-11-19",
    normal: { marketPrice: 0.28, midPrice: 0.29, lowPrice: 0.05, highPrice: 999 },
    "reverse-holofoil": { marketPrice: 0.76, midPrice: 0.83, lowPrice: 0.2, highPrice: 999 },
  },
};

test("versão comum usa os campos comuns de cada mercado", () => {
  const cotacao = extrairCotacao({ tipo: "normal", pricing: pricingPikachu });
  assert.deepEqual(cotacao.cardmarket, { valor: 0.16, menor: 0.02, media30: 0.15, atualizado: "2026-11-19" });
  assert.deepEqual(cotacao.tcgplayer, { valor: 0.28, menor: 0.05, atualizado: "2026-11-19" });
});

test("reverse usa os campos -holo do Cardmarket e reverse-holofoil do TCGplayer", () => {
  const cotacao = extrairCotacao({ tipo: "reverse", pricing: pricingPikachu });
  assert.equal(cotacao.cardmarket.valor, 0.66);
  assert.equal(cotacao.tcgplayer.valor, 0.76);
});

test("zero conta como ausente e cai para a média de 30 dias", () => {
  const cotacao = extrairCotacao({
    tipo: "reverse",
    foil: "cosmos",
    pricing: { cardmarket: { trend: 0, "trend-holo": 0, "avg30-holo": 14.31, "low-holo": 9.95 } },
  });
  assert.equal(cotacao.cardmarket.valor, 14.31);
  assert.equal(cotacao.tcgplayer, null);
});

test("reverse comum não pega o preço do holo; reverse especial pega", () => {
  const pricing = { tcgplayer: { holofoil: { marketPrice: 19.2 } } };
  assert.equal(extrairCotacao({ tipo: "reverse", pricing }).tcgplayer, null);
  assert.equal(extrairCotacao({ tipo: "reverse", foil: "masterball", pricing }).tcgplayer.valor, 19.2);
});

test("1ª edição usa os subtipos 1st-edition e, sem detalhamento, não usa o Cardmarket", () => {
  const pricing = {
    cardmarket: { trend: 441.68 },
    tcgplayer: { holofoil: { marketPrice: 1001 }, "1st-edition-holofoil": { marketPrice: 5000 } },
  };
  const detalhada = extrairCotacao({ tipo: "holo", selos: ["1st-edition"], pricing });
  assert.equal(detalhada.tcgplayer.valor, 5000);
  assert.equal(detalhada.cardmarket.valor, 441.68);

  const simples = extrairCotacao({ tipo: "firstEdition", pricing });
  assert.equal(simples.tcgplayer.valor, 5000);
  assert.equal(simples.cardmarket, null);
});

test("sem pricing não há cotação", () => {
  assert.deepEqual(extrairCotacao(null), { cardmarket: null, tcgplayer: null });
  assert.equal(calcularPreco(extrairCotacao(null), { EUR: 6, USD: 5 }), null);
});

test("calcularPreco converte, arredonda e tira a média das fontes", () => {
  const preco = calcularPreco(
    { cardmarket: { valor: 18.74, menor: 8 }, tcgplayer: { valor: 19.2, menor: null } },
    { EUR: 6.5, USD: 5.93 },
  );
  assert.equal(preco.fontes[0].valorBRL, 121.81); // 18,74 × 6,50
  assert.equal(preco.fontes[0].menorBRL, 52);
  assert.equal(preco.fontes[1].valorBRL, 113.86); // 19,20 × 5,93
  assert.equal(preco.fontes[1].menorBRL, null);
  assert.equal(preco.referencia, 117.84); // (121,81 + 113,86) / 2 = 117,835
  assert.equal(preco.minimo, 113.86);
  assert.equal(preco.maximo, 121.81);
});

test("com uma só fonte, a referência é ela mesma", () => {
  const preco = calcularPreco({ cardmarket: null, tcgplayer: { valor: 10, menor: 8 } }, { EUR: 6, USD: 5 });
  assert.equal(preco.referencia, 50);
  assert.equal(preco.fontes.length, 1);
});

test("resumirColecao separa média por carta e por unidade, e ignora desejadas e sem cotação", () => {
  const cm = (valor, media30) => ({ preco: { fontes: [{ nome: "Cardmarket", valor, media30 }] } });
  const resumo = resumirColecao([
    { valor: 100, quantidade: 1, setId: "a", cotacao: cm(10, 8) },
    { valor: 10, quantidade: 4, setId: "a", cotacao: cm(1, 1) },
    { valor: null, quantidade: 2, setId: "b" }, // sem cotação: conta nas cartas, não no valor
    { valor: 999, quantidade: 0, setId: "c", desejada: true },
  ]);

  assert.equal(resumo.valorTotal, 140); // 100×1 + 10×4
  assert.equal(resumo.totalCartas, 7);
  assert.equal(resumo.unicas, 3);
  assert.equal(resumo.colecoes, 2);
  assert.equal(resumo.desejadas, 1);
  assert.equal(resumo.semCotacao, 1);
  assert.equal(resumo.mediaPorCarta, 55); // (100 + 10) / 2 cartas cotadas
  assert.equal(resumo.mediaPorUnidade, 28); // 140 / 5 unidades cotadas
  assert.equal(resumo.variacao30.toFixed(4), (14 / 12 - 1).toFixed(4)); // (10 + 4) / (8 + 4)
});

test("resumirColecao vazia não divide por zero", () => {
  const resumo = resumirColecao([]);
  assert.equal(resumo.valorTotal, 0);
  assert.equal(resumo.mediaPorCarta, null);
  assert.equal(resumo.mediaPorUnidade, null);
  assert.equal(resumo.variacao30, null);
});
