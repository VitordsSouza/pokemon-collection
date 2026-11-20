// Base de cartas: TCGdex (https://tcgdex.dev), gratuita e sem chave de API.
// Em português ela só tem as cartas lançadas no Brasil; o inglês completa o restante.
const BASE_TCGDEX = "https://api.tcgdex.net/v2";
const TEMPO_LIMITE_MS = 10000;
export const LIMITE_RESULTADOS = 20;

const NOMES_VARIANTES = {
  normal: "Normal",
  holo: "Holo",
  reverse: "Reverse",
  firstEdition: "1ª edição",
  wPromo: "Promo",
};

const NOMES_EXTRAS = {
  "1st-edition": "1ª edição",
  pokeball: "Poké Ball",
  masterball: "Master Ball",
};

const titulo = (texto) => texto.replace(/-/g, " ").replace(/\b\w/g, (letra) => letra.toUpperCase());

// Resumo das versões (Normal, Holo, Reverse…) a partir dos indicadores simples da API.
function variantesSimples(detalhe) {
  return Object.keys(NOMES_VARIANTES)
    .filter((chave) => detalhe?.variants?.[chave])
    .map((chave) => ({ chave, nome: NOMES_VARIANTES[chave] }));
}

// Versões físicas da carta. Cada uma tem preço próprio: um reverse Master Ball vale
// muito mais que o reverse comum. Tamanho jumbo fica de fora.
// Usar o detalhe em inglês: em português a API traduz tipo, acabamento e tamanho.
export function listarVariantes(detalhe) {
  const porChave = new Map();
  for (const variante of detalhe?.variants_detailed ?? []) {
    if ((variante.size ?? "standard") !== "standard") continue;

    const extras = [variante.foil, ...(variante.stamp ?? [])].filter(Boolean);
    const chave = [variante.type, ...extras].join("-");
    const nomeTipo = NOMES_VARIANTES[variante.type] ?? titulo(variante.type);
    const nomeExtras = extras.map((extra) => NOMES_EXTRAS[extra] ?? titulo(extra)).join(", ");
    porChave.set(chave, { chave, nome: nomeExtras ? `${nomeTipo} (${nomeExtras})` : nomeTipo });
  }
  return porChave.size ? [...porChave.values()] : variantesSimples(detalhe);
}

export async function carregarVariantes(cardId) {
  return listarVariantes(await buscarComMemoria(`/en/cards/${encodeURIComponent(cardId)}`));
}

async function buscarJSON(caminho) {
  let resposta;
  try {
    resposta = await fetch(BASE_TCGDEX + caminho, {
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
  } catch (erro) {
    throw new Error(
      "Não foi possível conectar à base de cartas. Verifique sua internet e tente novamente.",
      { cause: erro },
    );
  }

  if (resposta.status === 404) return null;
  if (resposta.status === 429) {
    throw new Error("Muitas buscas seguidas. Aguarde alguns segundos e tente novamente.");
  }
  if (!resposta.ok) {
    throw new Error(`A base de cartas respondeu com erro (${resposta.status}). Tente novamente em instantes.`);
  }
  return resposta.json();
}

// Guarda a promessa para não repetir a mesma consulta enquanto a página estiver aberta.
const memoria = new Map();
function buscarComMemoria(caminho) {
  if (!memoria.has(caminho)) {
    const promessa = buscarJSON(caminho).catch((erro) => {
      memoria.delete(caminho); // erro não fica em memória: a próxima tentativa refaz a consulta
      throw erro;
    });
    memoria.set(caminho, promessa);
  }
  return memoria.get(caminho);
}

const normalizarNumero = (numero) => numero.toLowerCase().replace(/^0+(?=.)/, "");

// "charizard 4/102" -> { nome: "charizard", filtro: "4/102" }. Só a última palavra com dígito
// vira filtro (número ou coleção, como "151"); assim "Mr. Mime" continua sendo nome.
export function interpretarBusca(termo) {
  const partes = termo.trim().split(/\s+/);
  if (partes.length > 1 && /\d/.test(partes.at(-1))) {
    return { nome: partes.slice(0, -1).join(" "), filtro: partes.at(-1) };
  }
  return { nome: partes.join(" "), filtro: null };
}

// O id da carta é "<set>-<número>"; o set mais longo vence ("30th-c-001" é do set "30th-c").
export function encontrarSet(cardId, sets) {
  let melhor = null;
  for (const set of sets) {
    if (cardId.startsWith(`${set.id}-`) && (!melhor || set.id.length > melhor.id.length)) {
      melhor = set;
    }
  }
  return melhor;
}

// Filtra pelo número ou pela coleção e ordena das coleções mais novas para as mais antigas.
export function filtrarEOrdenar(resumos, sets, filtro) {
  const [numero, total] = filtro ? filtro.split("/") : [];
  const numeroFiltro = numero && normalizarNumero(numero);
  const textoFiltro = filtro?.toLowerCase();

  let itens = resumos
    .map((resumo) => {
      const set = encontrarSet(resumo.id, sets);
      return { resumo, set, ordem: set ? sets.indexOf(set) : -1 };
    })
    .filter(
      ({ resumo, set }) =>
        !filtro ||
        normalizarNumero(resumo.localId) === numeroFiltro ||
        set?.name.toLowerCase().includes(textoFiltro) ||
        set?.id.toLowerCase() === textoFiltro,
    );

  // "4/102": se algum set tiver 102 cartas, fica só ele; senão vale apenas o número.
  const doTotal = itens.filter(({ set }) => String(set?.cardCount?.official) === total);
  if (doTotal.length) itens = doTotal;

  return itens.sort(
      (a, b) =>
        b.ordem - a.ordem ||
        a.resumo.localId.localeCompare(b.resumo.localId, undefined, { numeric: true }),
    );
}

function montarCarta({ resumo, set }, detalhe) {
  const total = set?.cardCount?.official;
  return {
    id: resumo.id,
    nome: resumo.name,
    numero: /^\d+$/.test(resumo.localId) && total ? `${resumo.localId}/${total}` : resumo.localId,
    setId: set?.id ?? null,
    setNome: set?.name ?? "Coleção desconhecida",
    imagem: resumo.image ?? null, // URL base; o tamanho é escolhido na exibição
    idioma: resumo.idioma, // "pt" ou "en": de onde vieram nome, raridade e variantes
    raridade: detalhe?.rarity && detalhe.rarity !== "None" ? detalhe.rarity : null, // a API usa "None" como texto
    variantes: variantesSimples(detalhe), // a lista completa vem de carregarVariantes()
  };
}

// Une as listas por id: o português tem prioridade, o inglês preenche cartas e imagens faltantes.
export function combinarResumos(resumosPt, resumosEn) {
  const porId = new Map(resumosEn.map((resumo) => [resumo.id, { ...resumo, idioma: "en" }]));
  for (const resumo of resumosPt) {
    const ingles = porId.get(resumo.id);
    porId.set(resumo.id, { ...resumo, image: resumo.image ?? ingles?.image, idioma: "pt" });
  }
  return [...porId.values()];
}

// A lista em inglês tem todos os sets, em ordem de lançamento; o nome vem em português quando existe.
export function combinarSets(setsPt, setsEn, idsPocket) {
  const nomesPt = new Map(setsPt.map((set) => [set.id, set.name]));
  return setsEn
    .filter((set) => !idsPocket.has(set.id))
    .map((set) => ({ ...set, name: nomesPt.get(set.id) ?? set.name }));
}

export async function pesquisarCartas(termo) {
  const { nome, filtro } = interpretarBusca(termo);
  const consulta = `/cards?name=${encodeURIComponent(nome)}`;
  const [resumosPt, resumosEn, setsPt, setsEn, seriePocket] = await Promise.all([
    buscarComMemoria(`/pt${consulta}`),
    buscarComMemoria(`/en${consulta}`),
    buscarComMemoria("/pt/sets"),
    buscarComMemoria("/en/sets"),
    buscarComMemoria("/en/series/tcgp"), // TCG Pocket é digital: fica fora da coleção física
  ]);

  const idsPocket = new Set((seriePocket?.sets ?? []).map((set) => set.id));
  const sets = combinarSets(setsPt ?? [], setsEn ?? [], idsPocket);
  const resumos = combinarResumos(resumosPt ?? [], resumosEn ?? []);

  // Cartas sem set conhecido (como as do Pocket) são descartadas.
  const encontradas = filtrarEOrdenar(resumos, sets, filtro).filter(({ set }) => set);
  const exibidas = encontradas.slice(0, LIMITE_RESULTADOS);

  // Raridade e variantes só vêm no detalhe; uma falha aqui não derruba a busca inteira.
  const detalhes = await Promise.all(
    exibidas.map(({ resumo }) =>
      buscarComMemoria(`/${resumo.idioma}/cards/${encodeURIComponent(resumo.id)}`).catch(() => null),
    ),
  );

  return {
    total: encontradas.length,
    cartas: exibidas.map((item, i) => montarCarta(item, detalhes[i])),
  };
}
