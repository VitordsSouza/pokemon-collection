import { pesquisarCartas } from "./api.js";
import { obterItens } from "./colecao.js";
import {
  mostrarStatusPesquisa,
  renderizarGrade,
  renderizarResultados,
  renderizarResumo,
} from "./ui.js";

renderizarGrade(obterItens());
renderizarResumo(obterItens());

const campoBusca = document.querySelector(".secao-de-pesquisa input");
const botaoBusca = document.querySelector(".secao-de-pesquisa button");
let buscaAtual = 0;

async function executarBusca() {
  const termo = campoBusca.value.trim();
  if (!termo) return;

  // Só a busca mais recente pode atualizar a tela, mesmo que uma anterior responda depois.
  const busca = ++buscaAtual;
  mostrarStatusPesquisa("Buscando cartas…");

  try {
    const resultado = await pesquisarCartas(termo);
    if (busca === buscaAtual) renderizarResultados(termo, resultado);
  } catch (erro) {
    console.error(erro);
    if (busca === buscaAtual) mostrarStatusPesquisa(erro.message);
  }
}

botaoBusca.addEventListener("click", executarBusca);
campoBusca.addEventListener("keydown", (evento) => {
  if (evento.key === "Enter") executarBusca();
});
