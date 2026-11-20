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
