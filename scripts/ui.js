const formatadores = Object.fromEntries(
  ["BRL", "EUR", "USD"].map((moeda) => [
    moeda,
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: moeda }),
  ]),
);
const moedaBRL = formatadores.BRL;

function formatarData(texto) {
  const data = new Date(texto);
  return Number.isNaN(data.getTime()) ? texto : data.toLocaleDateString("pt-BR");
}

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

const TEXTOS_COTACAO = {
  carregando: "Cotando…",
  erro: "Cotação indisponível",
  "sem-cotacao": "Sem cotação",
};

function valorHTML(carta) {
  if (carta.valor != null) return `<p>${moedaBRL.format(carta.valor)}</p>`;
  const texto = TEXTOS_COTACAO[carta.cotacao?.estado] ?? TEXTOS_COTACAO["sem-cotacao"];
  return `<p class="sem-cotacao">${texto}</p>`;
}

// Junta só o que existe: ["Holo", null, "Rara"] -> "Holo · Rara"
const juntar = (...partes) => partes.filter(Boolean).join(" · ");

// cartas: já filtradas e ordenadas; totalNaColecao: para diferenciar coleção vazia de filtro sem resultado.
export function renderizarGrade(cartas, totalNaColecao) {
  let status = "";
  if (!totalNaColecao) status = "Sua coleção está vazia. Use a busca no topo para adicionar cartas.";
  else if (!cartas.length) status = "Nenhuma carta da coleção corresponde aos filtros.";
  document.querySelector(".secao-minha-colecao .status-colecao").textContent = status;

  document.querySelector(".secao-minha-colecao .grid-minha-colecao").innerHTML = cartas
    .map(
      (carta) => `
        <div class="div-carta ${carta.desejada ? "carta-desejada" : ""}" data-id="${escaparHTML(carta.id)}"
          role="button" tabindex="0" aria-label="Ver detalhes de ${escaparHTML(carta.nome)}">
          ${
            carta.desejada
              ? `<span class="quantidade-carta selo-desejada">Desejada</span>`
              : `<span class="quantidade-carta">${carta.quantidade}x</span>`
          }
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

const formatoPercentual = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});

// resumo: resultado de resumirColecao (precos.js).
export function renderizarResumo(resumo) {
  const escrever = (seletor, texto) => (document.querySelector(seletor).textContent = texto);
  const valorOuTraco = (valor) => (valor != null ? moedaBRL.format(valor) : "—");

  escrever(".valor-total-colecao", moedaBRL.format(resumo.valorTotal));
  escrever(".total-cartas", resumo.totalCartas);
  escrever(".cartas-unicas", resumo.unicas);
  escrever(".media-por-carta", valorOuTraco(resumo.mediaPorCarta));
  escrever(".media-por-unidade", valorOuTraco(resumo.mediaPorUnidade));
  escrever(".total-colecoes", resumo.colecoes);
  escrever(".cartas-desejadas", resumo.desejadas);
  escrever(".cartas-sem-cotacao", resumo.semCotacao);
  document.querySelector(".linha-sem-cotacao").hidden = !resumo.semCotacao;

  const delta = document.querySelector(".resumo-colecao .delta");
  const variacao = resumo.variacao30;
  delta.classList.toggle("negativa", variacao < 0);
  delta.textContent =
    variacao == null
      ? ""
      : `${variacao < 0 ? "▼" : "▲"} ${formatoPercentual.format(variacao)} em relação à média de 30 dias (Cardmarket)`;
}

// progresso: resultado de progressoPorColecao (colecao.js).
export function renderizarColecoes(progresso) {
  const caixa = document.querySelector(".div-colecoes");
  caixa.querySelectorAll(".row-colecao").forEach((linha) => linha.remove());
  caixa.querySelector(".status-colecoes").textContent = progresso.length
    ? ""
    : "As coleções das suas cartas aparecem aqui.";

  caixa.insertAdjacentHTML(
    "beforeend",
    progresso
      .map(
        (set) => `
          <div class="row-colecao">
            <p>${escaparHTML(set.nome)}</p>
            <div class="progress-bar-colecao">
              <div class="progress-bar-colecao-fill" style="width: ${set.percentual ?? 0}%"></div>
              <span>${set.total ? `${set.possuidas}/${set.total}` : `${set.possuidas} ${set.possuidas === 1 ? "carta" : "cartas"}`}</span>
            </div>
          </div>`,
      )
      .join(""),
  );
}

// Opções do filtro de coleção a partir das cartas cadastradas, mantendo a escolha atual.
export function renderizarFiltroColecoes(nomes) {
  const filtro = document.querySelector(".filtro-colecao");
  // Só reconstrói quando a lista muda: refazer as opções fecharia o menu aberto.
  if (filtro.dataset.opcoes === nomes.join("\n")) return;
  filtro.dataset.opcoes = nomes.join("\n");

  const escolhida = nomes.includes(filtro.value) ? filtro.value : "";
  filtro.innerHTML =
    `<option value="">Todas as coleções</option>` +
    nomes.map((nome) => `<option value="${escaparHTML(nome)}">${escaparHTML(nome)}</option>`).join("");
  filtro.value = escolhida;
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

// Detalhe do preço: referência, faixa entre as fontes, cada fonte e o câmbio usado.
function precoModalHTML(cotacao, quantidade = 1) {
  if (cotacao.estado === "carregando") return `<p>Consultando preços…</p>`;
  if (cotacao.estado === "erro") return `<p>Cotação indisponível: ${escaparHTML(cotacao.mensagem)}</p>`;
  if (cotacao.estado === "sem-cotacao") {
    return `<p>Sem cotação para esta versão no Cardmarket e no TCGplayer.</p>`;
  }

  const { preco, cambio } = cotacao;
  const fontes = preco.fontes
    .map((fonte) => {
      const original = formatadores[fonte.moeda];
      const detalhes = juntar(
        fonte.menor != null && `menor anúncio ${original.format(fonte.menor)}`,
        fonte.atualizado && `atualizado em ${formatarData(fonte.atualizado)}`,
      );
      return `
        <li>
          <span>${fonte.nome}</span>
          <span>${original.format(fonte.valor)} · ${moedaBRL.format(fonte.valorBRL)}</span>
          ${detalhes ? `<small>${escaparHTML(detalhes)}</small>` : ""}
        </li>`;
    })
    .join("");

  return `
    <div class="modal-valor">
      <p>${moedaBRL.format(preco.referencia)}</p>
      <span>valor de referência por unidade</span>
    </div>
    ${quantidade > 1 ? `<p>Total com ${quantidade} cópias: ${moedaBRL.format(preco.referencia * quantidade)}</p>` : ""}
    ${preco.fontes.length > 1 ? `<p>Varia de ${moedaBRL.format(preco.minimo)} a ${moedaBRL.format(preco.maximo)} entre as fontes.</p>` : ""}
    <ul class="modal-fontes">${fontes}</ul>
    <p class="modal-nota">
      Preços internacionais convertidos para reais (1 € = ${moedaBRL.format(cambio.EUR)} ·
      1 US$ = ${moedaBRL.format(cambio.USD)}, ${escaparHTML(cambio.fonte)}, ${escaparHTML(formatarData(cambio.data))}).
      Não há cotação do mercado brasileiro disponível por API.
    </p>`;
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
export function renderizarModalBusca({ carta, variantes, variante, quantidade, mensagem, carregando, cotacao }) {
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
    ${cotacao ? precoModalHTML(cotacao) : ""}
    ${quantidadeHTML(quantidade)}
    <button class="botao-primario" data-acao="adicionar" ${carregando ? "disabled" : ""}>Adicionar à coleção</button>
    <button class="botao-secundario" data-acao="desejar" ${carregando ? "disabled" : ""}>Quero esta carta</button>
    <p class="modal-mensagem" role="status">${escaparHTML(mensagem)}</p>`);
}

// Carta já na coleção (ou na lista de desejos): alterar quantidade, marcar como possuída ou remover.
export function renderizarModalColecao({ item, confirmandoRemocao, mensagem }) {
  const precoHTML = item.cotacao
    ? precoModalHTML(item.cotacao, item.quantidade)
    : `<div class="modal-valor">${valorHTML(item)}<span>por unidade</span></div>`;
  const controlesHTML = item.desejada
    ? `<p>Na sua lista de desejos: não entra no valor nem nas contagens da coleção.</p>
       <button class="botao-primario" data-acao="possuir">Já tenho esta carta</button>`
    : quantidadeHTML(item.quantidade);
  const textoRemover = item.desejada ? "Remover da lista de desejos" : "Remover da coleção";

  mostrarModal(`
    ${cabecalhoModalHTML(item, item.varianteNome)}
    ${precoHTML}
    ${controlesHTML}
    <button class="botao-remover" data-acao="remover">
      ${confirmandoRemocao ? "Confirmar remoção" : textoRemover}
    </button>
    <p class="modal-mensagem" role="status">${escaparHTML(mensagem)}</p>`);
}
