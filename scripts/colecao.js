const CHAVE = "pkm.colecao.v1";

let itens = ler();

function ler() {
  let bruto = null;
  try {
    bruto = localStorage.getItem(CHAVE);
  } catch (erro) {
    console.error("localStorage indisponível: a coleção não será salva.", erro);
  }

  if (bruto === null) return [];

  try {
    const dados = JSON.parse(bruto);
    // Descarta as cartas fictícias da fase de protótipo (sem cardId), se ainda estiverem salvas.
    if (Array.isArray(dados)) return dados.filter((item) => item?.cardId);
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

  if (existente?.desejada) {
    // Saiu da lista de desejos: passa a contar como carta possuída a partir de agora.
    Object.assign(existente, { desejada: false, quantidade, adicionadoEm: new Date().toISOString() });
  } else if (existente) {
    existente.quantidade += quantidade;
  } else {
    itens.push({ ...carta, quantidade, adicionadoEm: new Date().toISOString() });
  }
  salvar();
}

// Lista de desejos: fica na coleção com quantidade 0 e não entra em valor nem contagens.
// Retorna false se essa versão já está na coleção ou na lista.
export function desejar(carta) {
  if (itens.some((item) => item.id === carta.id)) return false;
  itens.push({ ...carta, quantidade: 0, desejada: true, adicionadoEm: new Date().toISOString() });
  salvar();
  return true;
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

// ---------- Visões da coleção (funções puras) ----------

const normalizar = (texto) =>
  String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Busca por nome, coleção, número ou variante (sem diferenciar acentos), filtro por coleção e ordem.
export function filtrarColecao(itens, { texto = "", colecao = "", ordem = "" } = {}) {
  const busca = normalizar(texto.trim());
  const filtrados = itens.filter(
    (item) =>
      (!colecao || item.setNome === colecao) &&
      (!busca || normalizar([item.nome, item.setNome, item.numero, item.varianteNome].join(" ")).includes(busca)),
  );

  if (ordem === "valor") return filtrados.sort((a, b) => (b.valor ?? -1) - (a.valor ?? -1));
  if (ordem === "recente") {
    return filtrados.sort((a, b) => (b.adicionadoEm ?? "").localeCompare(a.adicionadoEm ?? ""));
  }
  return filtrados; // ordem em que foram adicionadas
}

// Progresso por coleção: cartas diferentes possuídas (variantes da mesma carta contam uma vez)
// sobre o total oficial do set. Cartas secretas passam do total: o percentual para em 100%.
export function progressoPorColecao(itens) {
  const porSet = new Map();
  for (const item of itens) {
    if (item.desejada) continue;
    const chave = item.setId ?? item.setNome;
    const set = porSet.get(chave) ?? { nome: item.setNome, total: item.totalSet ?? null, cartas: new Set() };
    set.cartas.add(item.cardId ?? item.id);
    porSet.set(chave, set);
  }

  return [...porSet.values()]
    .map(({ nome, total, cartas }) => ({
      nome,
      total,
      possuidas: cartas.size,
      percentual: total ? Math.min(100, (cartas.size / total) * 100) : null,
    }))
    .sort((a, b) => (b.percentual ?? -1) - (a.percentual ?? -1) || b.possuidas - a.possuidas);
}
