const moedaBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

// Os dados virão de API externa: escapar antes de inserir via innerHTML.
function escaparHTML(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function renderizarGrade(cartas) {
  document.querySelector(".secao-minha-colecao .grid-minha-colecao").innerHTML = cartas
    .map(
      (carta) => `
        <div class="div-carta">
          <img src="${escaparHTML(carta.imagem)}" alt="${escaparHTML(carta.nome)}" />
          <h4>${escaparHTML(carta.nome)}</h4>
          <p>${escaparHTML(carta.colecao)}</p>
          <div>
            <p>${moedaBRL.format(carta.valor)}</p>
            <span>${escaparHTML(carta.numeracao)}</span>
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
  const imagem = carta.imagem
    ? `<img src="${escaparHTML(carta.imagem)}/low.webp" alt="${escaparHTML(carta.nome)}" loading="lazy" />`
    : `<div class="carta-sem-imagem"><span>Imagem indisponível</span></div>`;

  return `
    <div class="div-carta">
      ${imagem}
      <h4>${escaparHTML(carta.nome)}</h4>
      <p>${escaparHTML(carta.setNome)}</p>
      ${carta.variantes.length ? `<p>${escaparHTML(carta.variantes.join(" · "))}</p>` : ""}
      <div>
        <span>${escaparHTML(carta.raridade ?? "")}</span>
        <span>${escaparHTML(carta.numero)}</span>
      </div>
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
  const valorTotal = cartas.reduce((soma, c) => soma + c.valor * c.quantidade, 0);
  const totalCartas = cartas.reduce((soma, c) => soma + c.quantidade, 0);

  document.querySelector(".valor-total-colecao").textContent = moedaBRL.format(valorTotal);
  document.querySelector(".total-cartas").textContent = totalCartas;
}
