import { test } from "node:test";
import assert from "node:assert/strict";
import {
  interpretarBusca,
  encontrarSet,
  filtrarEOrdenar,
  combinarResumos,
  combinarSets,
  listarVariantes,
} from "../scripts/api.js";

const sets = [
  { id: "base1", name: "Coleção Básica" },
  { id: "sv03.5", name: "151" },
  { id: "30th", name: "Celebração de 30 Anos" },
  { id: "30th-c", name: "Coleção Clássica de 30 Anos", cardCount: { official: 30 } },
];

test("interpretarBusca separa o número só quando a última palavra tem dígito", () => {
  assert.deepEqual(interpretarBusca(" charizard  4/102 "), { nome: "charizard", filtro: "4/102" });
  assert.deepEqual(interpretarBusca("Mr. Mime"), { nome: "Mr. Mime", filtro: null });
  assert.deepEqual(interpretarBusca("Charizard ex"), { nome: "Charizard ex", filtro: null });
  assert.deepEqual(interpretarBusca("Porygon2"), { nome: "Porygon2", filtro: null });
});

test("encontrarSet escolhe o set mais longo", () => {
  assert.equal(encontrarSet("30th-c-001", sets).id, "30th-c");
  assert.equal(encontrarSet("30th-001", sets).id, "30th");
  assert.equal(encontrarSet("xyz-1", sets), null);
});

test("filtrarEOrdenar filtra por número (ignora zeros à esquerda) ou coleção", () => {
  const resumos = [
    { id: "base1-4", localId: "4" },
    { id: "sv03.5-006", localId: "006" },
    { id: "30th-c-004", localId: "004" },
  ];
  const ids = (filtro) => filtrarEOrdenar(resumos, sets, filtro).map((r) => r.resumo.id);

  assert.deepEqual(ids("4"), ["30th-c-004", "base1-4"]); // mais novo primeiro
  assert.deepEqual(ids("4/30"), ["30th-c-004"]); // o total escolhe o set
  assert.deepEqual(ids("4/999"), ["30th-c-004", "base1-4"]); // total desconhecido: só o número
  assert.deepEqual(ids("151"), ["sv03.5-006"]);
  assert.deepEqual(ids(null), ["30th-c-004", "sv03.5-006", "base1-4"]);
});

test("combinarResumos prioriza o português e usa a imagem em inglês quando falta", () => {
  const pt = [{ id: "sm7.5-3", localId: "3", name: "Charizard" }];
  const en = [
    { id: "sm7.5-3", localId: "3", name: "Charizard", image: "en/sm7.5/3" },
    { id: "base1-4", localId: "4", name: "Charizard", image: "en/base1/4" },
  ];
  const porId = Object.fromEntries(combinarResumos(pt, en).map((r) => [r.id, r]));

  assert.deepEqual(porId["sm7.5-3"], { id: "sm7.5-3", localId: "3", name: "Charizard", image: "en/sm7.5/3", idioma: "pt" });
  assert.equal(porId["base1-4"].idioma, "en");
});

test("combinarSets segue a ordem em inglês, traduz nomes e remove o Pocket", () => {
  const resultado = combinarSets(
    [{ id: "base1", name: "Coleção Básica" }],
    [{ id: "base1", name: "Base Set" }, { id: "A1", name: "Genetic Apex" }, { id: "me06", name: "Delta" }],
    new Set(["A1"]),
  );
  assert.deepEqual(resultado.map((s) => s.name), ["Coleção Básica", "Delta"]);
});

test("listarVariantes remove repetidas e jumbo, e nomeia acabamentos e selos", () => {
  const detalhe = {
    variants_detailed: [
      { type: "holo", size: "standard" },
      { type: "holo", size: "standard", stamp: ["1st-edition"] },
      { type: "holo", size: "standard" },
      { type: "holo", size: "jumbo" },
      { type: "reverse", size: "standard", foil: "masterball" },
      { type: "normal", size: "standard", stamp: ["pokemon-together"] },
    ],
  };
  assert.deepEqual(listarVariantes(detalhe), [
    { chave: "holo", nome: "Holo" },
    { chave: "holo-1st-edition", nome: "Holo (1ª edição)" },
    { chave: "reverse-masterball", nome: "Reverse (Master Ball)" },
    { chave: "normal-pokemon-together", nome: "Normal (Pokemon Together)" },
  ]);
});

test("listarVariantes usa os indicadores simples quando não há detalhamento", () => {
  assert.deepEqual(listarVariantes({ variants: { normal: true, reverse: true, holo: false } }), [
    { chave: "normal", nome: "Normal" },
    { chave: "reverse", nome: "Reverse" },
  ]);
  assert.deepEqual(listarVariantes(null), []);
});
