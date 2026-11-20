import { minhaColecao as semente } from "../data/pokemons.js";

const CHAVE = "pkm.colecao.v1";

let itens = ler();

function ler() {
  let bruto = null;
  try {
    bruto = localStorage.getItem(CHAVE);
  } catch (erro) {
    console.error("localStorage indisponível: a coleção não será salva.", erro);
  }

  // shortcut: coleção vazia começa com o mock; a semente sai na Fase 6.
  if (bruto === null) return structuredClone(semente);

  try {
    const dados = JSON.parse(bruto);
    if (Array.isArray(dados)) return dados;
  } catch {
    // tratado abaixo
  }

  // Dado corrompido: guarda uma cópia antes que o próximo salvamento o sobrescreva.
  try {
    localStorage.setItem(`${CHAVE}.corrompido`, bruto);
  } catch {
    // sem espaço para a cópia; o original segue no console abaixo
  }
  console.error(`Coleção salva estava corrompida. Cópia em "${CHAVE}.corrompido".`, bruto);
  return [];
}

function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(itens));
  } catch (erro) {
    // A alteração fica só na memória: avisa quem chamou para a tela não dizer que foi salvo.
    throw new Error(
      "Não foi possível salvar a coleção neste navegador. A alteração vale só até fechar a página.",
      { cause: erro },
    );
  }
}

function validarQuantidade(quantidade) {
  if (!Number.isInteger(quantidade) || quantidade < 1) {
    throw new RangeError(`Quantidade inválida: ${quantidade}`);
  }
}

export function obterItens() {
  return itens;
}

export function adicionar(carta, quantidade = 1) {
  validarQuantidade(quantidade);
  const existente = itens.find((item) => item.id === carta.id);

  if (existente) {
    existente.quantidade += quantidade;
  } else {
    itens.push({ ...carta, quantidade, adicionadoEm: new Date().toISOString() });
  }
  salvar();
}

export function alterarQuantidade(id, quantidade) {
  validarQuantidade(quantidade);
  const item = itens.find((item) => item.id === id);
  if (!item) throw new Error(`Carta não está na coleção: ${id}`);

  item.quantidade = quantidade;
  salvar();
}

export function remover(id) {
  itens = itens.filter((item) => item.id !== id);
  salvar();
}
