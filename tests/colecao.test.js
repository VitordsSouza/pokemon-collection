// Rodar na raiz do projeto com: node --test
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const armazenamento = new Map();
globalThis.localStorage = {
  getItem: (chave) => (armazenamento.has(chave) ? armazenamento.get(chave) : null),
  setItem: (chave, valor) => armazenamento.set(chave, String(valor)),
};

// Cada import com query nova cria outra instância do módulo, simulando reabrir a página.
let abertura = 0;
const abrirColecao = () => import(`../scripts/colecao.js?abertura=${++abertura}`);

beforeEach(() => armazenamento.clear());

test("coleção vazia começa com a semente mock", async () => {
  const colecao = await abrirColecao();
  assert.equal(colecao.obterItens().length, 4);
});

test("adicionar, alterar e remover persistem após reabrir", async () => {
  const antes = await abrirColecao();
  antes.adicionar({ id: "sv08.5-013:holo", nome: "Flareon" }, 2);
  antes.alterarQuantidade("mock-houndstone", 5);
  antes.remover("mock-shedinja");

  const depois = (await abrirColecao()).obterItens();
  assert.equal(depois.length, 4);
  assert.equal(depois.find((i) => i.id === "sv08.5-013:holo").quantidade, 2);
  assert.equal(depois.find((i) => i.id === "mock-houndstone").quantidade, 5);
  assert.equal(depois.find((i) => i.id === "mock-shedinja"), undefined);
});

test("adicionar carta repetida soma a quantidade", async () => {
  const colecao = await abrirColecao();
  colecao.adicionar({ id: "x" });
  colecao.adicionar({ id: "x" }, 3);
  assert.equal(colecao.obterItens().filter((i) => i.id === "x").length, 1);
  assert.equal(colecao.obterItens().find((i) => i.id === "x").quantidade, 4);
});

test("quantidade inválida é rejeitada", async () => {
  const colecao = await abrirColecao();
  assert.throws(() => colecao.alterarQuantidade("mock-houndstone", 0), RangeError);
  assert.throws(() => colecao.adicionar({ id: "y" }, 1.5), RangeError);
  assert.throws(() => colecao.alterarQuantidade("nao-existe", 1));
});

test("dado corrompido é preservado em cópia, sem quebrar a página", async () => {
  armazenamento.set("pkm.colecao.v1", "{quebrado");
  const colecao = await abrirColecao();
  assert.deepEqual(colecao.obterItens(), []);
  assert.equal(armazenamento.get("pkm.colecao.v1.corrompido"), "{quebrado");
});

test("falha ao salvar é avisada a quem chamou", async () => {
  const colecao = await abrirColecao();
  const setItemOriginal = localStorage.setItem;
  localStorage.setItem = () => {
    throw new Error("QuotaExceededError");
  };
  try {
    assert.throws(() => colecao.adicionar({ id: "z" }), /Não foi possível salvar/);
  } finally {
    localStorage.setItem = setItemOriginal;
  }
});

test("lista de desejos: não duplica e vira carta possuída ao adicionar", async () => {
  const colecao = await abrirColecao();
  assert.equal(colecao.desejar({ id: "w" }), true);
  assert.equal(colecao.desejar({ id: "w" }), false);
  assert.equal(colecao.desejar({ id: "mock-houndstone" }), false); // já possuída

  colecao.adicionar({ id: "w" }, 2);
  const item = (await abrirColecao()).obterItens().find((i) => i.id === "w");
  assert.equal(item.desejada, false);
  assert.equal(item.quantidade, 2);
});

test("filtrarColecao busca sem acento, filtra por coleção e ordena", async () => {
  const { filtrarColecao } = await abrirColecao();
  const itens = [
    { nome: "Flareon", setNome: "Evoluções Prismáticas", valor: 5, adicionadoEm: "2026-01-02" },
    { nome: "Pikachu", setNome: "151", valor: null, adicionadoEm: "2026-01-03" },
    { nome: "Charizard", setNome: "151", valor: 50, adicionadoEm: "2026-01-01" },
  ];
  const nomes = (filtros) => filtrarColecao(itens, filtros).map((i) => i.nome);

  assert.deepEqual(nomes({ texto: "prismaticas" }), ["Flareon"]);
  assert.deepEqual(nomes({ colecao: "151" }), ["Pikachu", "Charizard"]);
  assert.deepEqual(nomes({ ordem: "valor" }), ["Charizard", "Flareon", "Pikachu"]);
  assert.deepEqual(nomes({ ordem: "recente" }), ["Pikachu", "Flareon", "Charizard"]);
  assert.deepEqual(itens.map((i) => i.nome), ["Flareon", "Pikachu", "Charizard"]); // não altera a original
});

test("progressoPorColecao conta cartas diferentes, limita a 100% e ignora desejadas", async () => {
  const { progressoPorColecao } = await abrirColecao();
  const progresso = progressoPorColecao([
    { cardId: "a-1", setId: "a", setNome: "A", totalSet: 2 },
    { cardId: "a-1", setId: "a", setNome: "A", totalSet: 2 }, // outra variante da mesma carta
    { cardId: "a-9", setId: "a", setNome: "A", totalSet: 2 },
    { cardId: "a-10", setId: "a", setNome: "A", totalSet: 2 }, // secreta: passa do total
    { cardId: "b-1", setId: "b", setNome: "B", totalSet: 4 },
    { cardId: "c-1", setId: "c", setNome: "C", totalSet: null },
    { cardId: "d-1", setId: "d", setNome: "D", totalSet: 1, desejada: true },
  ]);
  assert.deepEqual(progresso, [
    { nome: "A", total: 2, possuidas: 3, percentual: 100 },
    { nome: "B", total: 4, possuidas: 1, percentual: 25 },
    { nome: "C", total: null, possuidas: 1, percentual: null },
  ]);
});
