const moedaBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

// Os dados virão de API externa: escapar antes de inserir via innerHTML.
function escaparHTML(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function renderizarGrade(cartas) {
  document.querySelector(".grid-minha-colecao").innerHTML = cartas
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

export function renderizarResumo(cartas) {
  const valorTotal = cartas.reduce((soma, c) => soma + c.valor * c.quantidade, 0);
  const totalCartas = cartas.reduce((soma, c) => soma + c.quantidade, 0);

  document.querySelector(".valor-total-colecao").textContent = moedaBRL.format(valorTotal);
  document.querySelector(".total-cartas").textContent = totalCartas;
}
