import { estaValido, gravarCache, lerCache } from "./cache.js";
import { extrairCotacao } from "./precos.js";

// Base de cartas: TCGdex (https://tcgdex.dev), gratuita e sem chave de API.
// Em português ela só tem as cartas lançadas no Brasil; o inglês completa o restante.
const BASE_TCGDEX = "https://api.tcgdex.net/v2";
const TEMPO_LIMITE_MS = 10000;
export const LIMITE_RESULTADOS = 20;

const HORA_MS = 60 * 60 * 1000;
const VALIDADE_COTACAO_MS = 24 * HORA_MS; // o Cardmarket atualiza uma vez por dia
const VALIDADE_CAMBIO_MS = 12 * HORA_MS;

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
const ehPadrao = (variante) => (variante.size ?? "standard") === "standard"; // jumbo fica de fora
const extrasDe = (variante) => [variante.foil, ...(variante.stamp ?? [])].filter(Boolean);
const chaveDe = (variante) => [variante.type, ...extrasDe(variante)].join("-");

export function listarVariantes(detalhe) {
  const porChave = new Map();
  for (const variante of (detalhe?.variants_detailed ?? []).filter(ehPadrao)) {
    const chave = chaveDe(variante);
    if (porChave.has(chave)) continue;

    const nomeTipo = NOMES_VARIANTES[variante.type] ?? titulo(variante.type);
    const nomeExtras = extrasDe(variante).map((extra) => NOMES_EXTRAS[extra] ?? titulo(extra)).join(", ");
    porChave.set(chave, { chave, nome: nomeExtras ? `${nomeTipo} (${nomeExtras})` : nomeTipo });
  }
  return porChave.size ? [...porChave.values()] : variantesSimples(detalhe);
}

// Dados de preço de uma variante. A base às vezes repete a variante; vale a primeira com preço.
// Só a versão comum pode usar o preço geral da carta: uma versão especial sem preço próprio
// (Master Ball, selo, 1ª edição…) fica sem cotação, em vez de herdar o valor da comum.
export function entradaDaVariante(detalhe, chave) {
  const doTipo = (detalhe?.variants_detailed ?? []).filter((v) => ehPadrao(v) && chaveDe(v) === chave);
  const comPreco = doTipo.find((v) => v.pricing);
  if (comPreco) {
    return { tipo: comPreco.type, foil: comPreco.foil ?? null, selos: comPreco.stamp ?? [], pricing: comPreco.pricing };
  }

  const comum = doTipo[0] ?? (detalhe?.variants?.[chave] ? { type: chave } : null);
  if (!comum || extrasDe(comum).length) return null;
  return { tipo: comum.type, foil: null, selos: [], pricing: detalhe.pricing };
}

const caminhoDetalheEn = (cardId) => `/en/cards/${encodeURIComponent(cardId)}`;

export async function carregarVariantes(cardId) {
  return listarVariantes(await buscarComMemoria(caminhoDetalheEn(cardId)));
}

// Cotação da variante na moeda de cada mercado, guardada por 24 h.
export async function buscarCotacao(cardId, chave) {
  const chaveCache = `cotacao.v2:${cardId}:${chave}`; // v2: inclui a média de 30 dias
  const salvo = lerCache(chaveCache);
  if (estaValido(salvo, VALIDADE_COTACAO_MS)) return salvo.valor;

  try {
    const detalhe = await buscarComMemoria(caminhoDetalheEn(cardId));
    const cotacao = extrairCotacao(entradaDaVariante(detalhe, chave));
    gravarCache(chaveCache, cotacao);
    return cotacao;
  } catch (erro) {
    if (salvo) return salvo.valor; // vencida, mas a data da cotação aparece na tela
    throw erro;
  }
}

// ---------- Câmbio (reais por dólar e por euro) ----------

async function cambioAwesomeApi() {
  const dados = await buscarJSON(
    "https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL",
    "ao serviço de câmbio",
  );
  const usd = Number(dados?.USDBRL?.bid);
  const eur = Number(dados?.EURBRL?.bid);
  if (!(usd > 0 && eur > 0)) throw new Error("Resposta de câmbio inválida (AwesomeAPI).");
  return { USD: usd, EUR: eur, fonte: "AwesomeAPI", data: dados.USDBRL.create_date };
}

async function cambioFrankfurter() {
  const dados = await buscarJSON(
    "https://api.frankfurter.dev/v1/latest?base=EUR&symbols=BRL,USD",
    "ao serviço de câmbio",
  );
  const eur = dados?.rates?.BRL;
  const usdPorEur = dados?.rates?.USD;
  if (!(eur > 0 && usdPorEur > 0)) throw new Error("Resposta de câmbio inválida (Frankfurter).");
  return { USD: eur / usdPorEur, EUR: eur, fonte: "Frankfurter (BCE)", data: dados.date };
}

export async function buscarCambio() {
  const salvo = lerCache("cambio");
  if (estaValido(salvo, VALIDADE_CAMBIO_MS)) return salvo.valor;

  try {
    const cambio = await cambioAwesomeApi().catch((erro) => {
      console.warn("AwesomeAPI indisponível; usando Frankfurter.", erro);
      return cambioFrankfurter();
    });
    gravarCache("cambio", cambio);
    return cambio;
  } catch (erro) {
    if (salvo) return salvo.valor; // vencido, mas a data do câmbio aparece na tela
    throw new Error("Não foi possível obter a cotação do dólar e do euro.", { cause: erro });
  }
}

// ---------- Acesso à rede ----------

async function buscarJSON(url, servico = "à base de cartas") {
  let resposta;
  try {
    resposta = await fetch(url, { signal: AbortSignal.timeout(TEMPO_LIMITE_MS) });
  } catch (erro) {
    throw new Error(
      `Não foi possível conectar ${servico}. Verifique sua internet e tente novamente.`,
      { cause: erro },
    );
  }

  if (resposta.status === 404) return null;
  if (resposta.status === 429) {
    throw new Error("Muitas consultas seguidas. Aguarde alguns segundos e tente novamente.");
  }
  if (!resposta.ok) {
    throw new Error(`O servidor respondeu com erro (${resposta.status}). Tente novamente em instantes.`);
  }
  return resposta.json();
}

// Guarda a promessa para não repetir a mesma consulta enquanto a página estiver aberta.
const memoria = new Map();
function buscarComMemoria(caminho) {
  if (!memoria.has(caminho)) {
    const promessa = buscarJSON(BASE_TCGDEX + caminho).catch((erro) => {
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
    totalSet: total ?? null,
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
