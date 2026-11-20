import { carregarVariantes, pesquisarCartas } from "./api.js";
import { adicionar, alterarQuantidade, obterItens, remover } from "./colecao.js";
import {
  fecharModal,
  mostrarStatusPesquisa,
  renderizarGrade,
  renderizarModalBusca,
  renderizarModalColecao,
  renderizarResultados,
  renderizarResumo,
} from "./ui.js";

function atualizarColecao() {
  renderizarGrade(obterItens());
  renderizarResumo(obterItens());
}

atualizarColecao();

// ---------- Busca ----------

const campoBusca = document.querySelector(".secao-de-pesquisa input");
const botaoBusca = document.querySelector(".secao-de-pesquisa button");
let buscaAtual = 0;
let resultados = new Map(); // id -> carta da última busca exibida

async function executarBusca() {
  const termo = campoBusca.value.trim();
  if (!termo) return;

  // Só a busca mais recente pode atualizar a tela, mesmo que uma anterior responda depois.
  const busca = ++buscaAtual;
  mostrarStatusPesquisa("Buscando cartas…");

  try {
    const resultado = await pesquisarCartas(termo);
    if (busca !== buscaAtual) return;
    resultados = new Map(resultado.cartas.map((carta) => [carta.id, carta]));
    renderizarResultados(termo, resultado);
  } catch (erro) {
    console.error(erro);
    if (busca === buscaAtual) mostrarStatusPesquisa(erro.message);
  }
}

botaoBusca.addEventListener("click", executarBusca);
campoBusca.addEventListener("keydown", (evento) => {
  if (evento.key === "Enter") executarBusca();
});

// ---------- Modal ----------

let modal = null; // estado do modal aberto

function desenharModal() {
  if (modal.modo === "busca") renderizarModalBusca(modal);
  else renderizarModalColecao(modal);
}

async function abrirCartaDaBusca(id) {
  const carta = resultados.get(id);
  if (!carta) return;

  const estado = { modo: "busca", carta, variantes: [], quantidade: 1, mensagem: "", carregando: true };
  modal = estado;
  desenharModal();

  let variantes = [];
  try {
    variantes = await carregarVariantes(carta.id);
  } catch (erro) {
    console.error(erro);
  }
  if (!variantes.length) variantes = carta.variantes; // resumo simples da busca
  if (!variantes.length) variantes = [{ chave: "padrao", nome: "Não informada pela base" }];

  // O usuário pode ter fechado ou aberto outra carta enquanto carregava.
  if (modal !== estado || !elementoModal.open) return;
  Object.assign(estado, { variantes, variante: variantes[0].chave, carregando: false });
  desenharModal();
}

function abrirCartaDaColecao(id) {
  const item = obterItens().find((item) => item.id === id);
  if (!item) return;

  modal = { modo: "colecao", item, confirmandoRemocao: false, mensagem: "" };
  desenharModal();
}

function adicionarCartaDoModal() {
  const { carta, variantes } = modal;
  const variante = variantes.find((opcao) => opcao.chave === modal.variante);
  const id = `${carta.id}:${variante.chave}`;

  adicionar(
    {
      id,
      cardId: carta.id,
      variante: variante.chave,
      varianteNome: variante.nome,
      nome: carta.nome,
      setId: carta.setId,
      setNome: carta.setNome,
      numero: carta.numero,
      raridade: carta.raridade,
      imagem: carta.imagem,
      idioma: carta.idioma,
    },
    modal.quantidade,
  );

  const total = obterItens().find((item) => item.id === id).quantidade;
  modal.mensagem = `Adicionada! Você tem ${total} ${total === 1 ? "cópia" : "cópias"} desta versão.`;
  modal.quantidade = 1;
}

function mudarQuantidade(diferenca) {
  if (modal.modo === "busca") {
    modal.quantidade = Math.max(1, modal.quantidade + diferenca);
    return;
  }
  alterarQuantidade(modal.item.id, Math.max(1, modal.item.quantidade + diferenca));
  modal.confirmandoRemocao = false;
}

const acoesModal = {
  fechar: fecharModal,
  menos: () => mudarQuantidade(-1),
  mais: () => mudarQuantidade(1),
  adicionar: adicionarCartaDoModal,
  remover() {
    // Primeiro clique só pede confirmação.
    if (!modal.confirmandoRemocao) {
      modal.confirmandoRemocao = true;
      return;
    }
    remover(modal.item.id);
    fecharModal();
  },
};

const elementoModal = document.querySelector(".modal-carta");

elementoModal.addEventListener("click", (evento) => {
  // Clique fora da caixa (no fundo escurecido) fecha o modal.
  if (evento.target === elementoModal) {
    const caixa = elementoModal.getBoundingClientRect();
    const dentro =
      evento.clientX >= caixa.left && evento.clientX <= caixa.right &&
      evento.clientY >= caixa.top && evento.clientY <= caixa.bottom;
    if (!dentro) fecharModal();
    return;
  }

  const acao = evento.target.closest("[data-acao]")?.dataset.acao;
  if (!acao) return;

  try {
    modal.mensagem = "";
    acoesModal[acao]();
  } catch (erro) {
    console.error(erro);
    modal.mensagem = erro.message;
  }
  atualizarColecao();
  if (elementoModal.open) desenharModal();
});

elementoModal.addEventListener("change", (evento) => {
  if (evento.target.dataset.campo === "variante") modal.variante = evento.target.value;
});

document.querySelector(".grid-resultados").addEventListener("click", (evento) => {
  const carta = evento.target.closest("[data-id]");
  if (carta) abrirCartaDaBusca(carta.dataset.id);
});

const gradeColecao = document.querySelector(".secao-minha-colecao .grid-minha-colecao");

gradeColecao.addEventListener("click", (evento) => {
  const carta = evento.target.closest("[data-id]");
  if (carta) abrirCartaDaColecao(carta.dataset.id);
});

gradeColecao.addEventListener("keydown", (evento) => {
  const carta = evento.target.closest("[data-id]");
  if (carta && (evento.key === "Enter" || evento.key === " ")) {
    evento.preventDefault();
    abrirCartaDaColecao(carta.dataset.id);
  }
});
