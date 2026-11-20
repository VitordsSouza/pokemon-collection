const moedaBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const NOMES_IDIOMAS = { pt: "Português", en: "Inglês" };

// Os dados vêm de API externa: escapar antes de inserir via innerHTML.
function escaparHTML(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// shortcut: caminhos locais existem só no mock (sai na Fase 6); as URLs da API recebem o tamanho.
function imagemHTML(carta, tamanho) {
  if (!carta.imagem) {
    return `<div class="carta-sem-imagem"><span>Imagem indisponível</span></div>`;
  }
  const url = carta.imagem.startsWith("http") ? `${carta.imagem}/${tamanho}.webp` : carta.imagem;
  return `<img src="${escaparHTML(url)}" alt="${escaparHTML(carta.nome)}" loading="lazy" />`;
}

function valorHTML(carta) {
  return carta.valor != null
    ? `<p>${moedaBRL.format(carta.valor)}</p>`
    : `<p class="sem-cotacao">Sem cotação</p>`;
}

// Junta só o que existe: ["Holo", null, "Rara"] -> "Holo · Rara"
const juntar = (...partes) => partes.filter(Boolean).join(" · ");

export function renderizarGrade(cartas) {
  document.querySelector(".secao-minha-colecao .grid-minha-colecao").innerHTML = cartas
    .map(
      (carta) => `
        <div class="div-carta" data-id="${escaparHTML(carta.id)}" role="button" tabindex="0"
          aria-label="Ver detalhes de ${escaparHTML(carta.nome)}">
          <span class="quantidade-carta">${carta.quantidade}x</span>
          ${imagemHTML(carta, "low")}
          <h4>${escaparHTML(carta.nome)}</h4>
          <p>${escaparHTML(juntar(carta.setNome, carta.varianteNome))}</p>
          <div>
            ${valorHTML(carta)}
            <span>${escaparHTML(carta.numero)}</span>
          </div>
        </div>`,
    )
    .join("");
}

const secaoResultados = document.querySelector(".secao-resultados-pesquisa");

export function mostrarStatusPesquisa(mensagem) {
  secaoResultados.hidden = false;
  secaoResultados.querySelector(".status-pesquisa").textContent = mensagem;
  secaoResultados.querySelector(".grid-resultados").innerHTML = "";
}

function cartaResultadoHTML(carta) {
  const variantes =
    carta.variantes.length > 2
      ? `${carta.variantes.length} variantes`
      : carta.variantes.map((variante) => variante.nome).join(" · ");

  return `
    <div class="div-carta" data-id="${escaparHTML(carta.id)}">
      ${imagemHTML(carta, "low")}
      <h4>${escaparHTML(carta.nome)}</h4>
      <p>${escaparHTML(carta.setNome)}</p>
      ${variantes ? `<p>${escaparHTML(variantes)}</p>` : ""}
      <div>
        <span>${escaparHTML(carta.raridade ?? "")}</span>
        <span>${escaparHTML(carta.numero)}</span>
      </div>
      <button class="botao-adicionar">Adicionar</button>
    </div>`;
}

export function renderizarResultados(termo, { total, cartas }) {
  let mensagem = `Nenhuma carta encontrada para "${termo}".`;
  if (total === 1) mensagem = "1 carta encontrada.";
  if (total > 1) mensagem = `${total} cartas encontradas.`;
  if (total > cartas.length) {
    mensagem += ` Mostrando as ${cartas.length} mais recentes; refine com o número (ex.: Charizard 4/102).`;
  }

  mostrarStatusPesquisa(mensagem);
  secaoResultados.querySelector(".grid-resultados").innerHTML = cartas
    .map(cartaResultadoHTML)
    .join("");
}

export function renderizarResumo(cartas) {
  const valorTotal = cartas.reduce((soma, c) => soma + (c.valor ?? 0) * c.quantidade, 0);
  const totalCartas = cartas.reduce((soma, c) => soma + c.quantidade, 0);

  document.querySelector(".valor-total-colecao").textContent = moedaBRL.format(valorTotal);
  document.querySelector(".total-cartas").textContent = totalCartas;
}

// ---------- Modal de detalhes ----------

const modal = document.querySelector(".modal-carta");

function cabecalhoModalHTML(carta, ...detalhes) {
  return `
    <button class="modal-fechar" data-acao="fechar" aria-label="Fechar">×</button>
    ${imagemHTML(carta, "high")}
    <h3>${escaparHTML(carta.nome)}</h3>
    <p>${escaparHTML(juntar(carta.setNome, carta.numero))}</p>
    <p>${escaparHTML(juntar(...detalhes, carta.raridade, NOMES_IDIOMAS[carta.idioma]))}</p>`;
}

function quantidadeHTML(quantidade) {
  return `
    <div class="modal-quantidade">
      <button data-acao="menos" aria-label="Diminuir quantidade" ${quantidade <= 1 ? "disabled" : ""}>−</button>
      <span aria-live="polite">${quantidade}</span>
      <button data-acao="mais" aria-label="Aumentar quantidade">+</button>
    </div>`;
}

function mostrarModal(html) {
  modal.innerHTML = html;
  if (!modal.open) modal.showModal();
}

export function fecharModal() {
  modal.close();
}

// Carta vinda da busca: escolher variante e quantidade antes de adicionar.
export function renderizarModalBusca({ carta, variantes, variante, quantidade, mensagem, carregando }) {
  const opcoes = carregando
    ? `<option>Carregando variantes…</option>`
    : variantes
        .map(
          (opcao) =>
            `<option value="${escaparHTML(opcao.chave)}" ${opcao.chave === variante ? "selected" : ""}>${escaparHTML(opcao.nome)}</option>`,
        )
        .join("");

  mostrarModal(`
    ${cabecalhoModalHTML(carta)}
    <label class="modal-campo">
      Variante
      <select data-campo="variante" ${carregando ? "disabled" : ""}>${opcoes}</select>
    </label>
    ${quantidadeHTML(quantidade)}
    <button class="botao-primario" data-acao="adicionar" ${carregando ? "disabled" : ""}>Adicionar à coleção</button>
    <p class="modal-mensagem" role="status">${escaparHTML(mensagem)}</p>`);
}

// Carta já na coleção: alterar quantidade ou remover.
export function renderizarModalColecao({ item, confirmandoRemocao, mensagem }) {
  mostrarModal(`
    ${cabecalhoModalHTML(item, item.varianteNome)}
    <div class="modal-valor">
      ${valorHTML(item)}
      <span>por unidade</span>
    </div>
    ${quantidadeHTML(item.quantidade)}
    <button class="botao-remover" data-acao="remover">
      ${confirmandoRemocao ? "Confirmar remoção" : "Remover da coleção"}
    </button>
    <p class="modal-mensagem" role="status">${escaparHTML(mensagem)}</p>`);
}
