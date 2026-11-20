import { obterItens } from "./colecao.js";
import { renderizarGrade, renderizarResumo } from "./ui.js";

renderizarGrade(obterItens());
renderizarResumo(obterItens());
