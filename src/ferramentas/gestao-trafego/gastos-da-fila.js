// O GASTO DE VERDADE DE CADA LINHA DA FILA — e a leitura que ele permite.
//
// POR QUE (pedido do dono, 2026-08-03): a fila mostrava ORÇAMENTO, que é o teto
// que se autoriza, e nunca o GASTO, que é o que de fato saiu. São números
// diferentes, e a diferença entre eles é uma informação e tanto: campanha que
// tem R$ 230 de teto e gastou R$ 104 ontem não vai gastar mais só porque o teto
// subiu — aprovar "subir" ali é mexer num número que não estava sendo usado.
//
// DE ONDE VEM: `campaign_insights`, que o coletor já preenche todo dia. Nada de
// chamada nova à Meta — o dado está no banco, e a leitura confirmou o que cada
// `period_days` significa:
//   0 → HOJE, parcial (fechado só no fim do dia)
//   1 → ONTEM, o último dia completo
//   7 / 14 / 30 → o TOTAL da janela que termina em `captured_at`
//
// PURO: sem rede, sem tela.

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const reais = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Abaixo disto a campanha não está usando o teto que tem. 80% é folgado de
// propósito: a Meta oscila a entrega dia a dia, e chamar de "não gasta" quem
// ficou 5% abaixo seria alarme falso todo dia.
export const LIMITE_DE_USO = 0.8;

// Lê as linhas de `campaign_insights` de UMA campanha e devolve o que interessa.
//
// Só a captura MAIS RECENTE conta: o coletor grava todo dia, e misturar capturas
// somaria janelas que se sobrepõem — os "últimos 7 dias" de ontem e os de hoje
// têm seis dias em comum.
export function lerGastos(linhas) {
  const lista = Array.isArray(linhas) ? linhas.filter((l) => l && l.captured_at) : [];
  if (!lista.length) return null;

  let maisRecente = '';
  for (const l of lista) if (String(l.captured_at) > maisRecente) maisRecente = String(l.captured_at);
  const doDia = lista.filter((l) => String(l.captured_at) === maisRecente);

  const por = (d) => {
    const achou = doDia.find((l) => Number(l.period_days) === d);
    return achou ? num(achou.spend) : null;
  };
  const d7 = por(7), d14 = por(14), d30 = por(30);
  return {
    capturadoEm: maisRecente,
    hoje: por(0),
    ontem: por(1),
    // A MÉDIA vem junto do total porque é ela que se compara com o orçamento
    // diário. Total de 7 dias ao lado de um teto diário são unidades diferentes,
    // e pôr os dois lado a lado sem a média convida à comparação errada.
    d7: d7 == null ? null : { total: d7, media: d7 / 7 },
    d14: d14 == null ? null : { total: d14, media: d14 / 14 },
    d30: d30 == null ? null : { total: d30, media: d30 / 30 },
  };
}

// O NÚMERO QUE VAI NA LINHA, curto.
//
// ONTEM é a escolha, não hoje: hoje é parcial e enganaria — às 9h da manhã toda
// campanha parece ter parado de gastar. Sem ontem, cai na média da semana, que
// é o segundo número mais honesto.
export function gastoDaLinha(gastos) {
  const g = gastos || {};
  if (g.ontem != null) return { valor: g.ontem, rotulo: 'ontem', texto: `${reais(g.ontem)} ontem` };
  if (g.d7 && g.d7.media != null) return { valor: g.d7.media, rotulo: 'média/dia', texto: `${reais(g.d7.media)}/dia na semana` };
  return null;
}

// A LEITURA que o cruzamento com o orçamento permite.
//
// É a razão de o gasto estar aqui: não é decoração, é o que muda a decisão.
// Campanha que não usa o teto que já tem não responde a um teto maior — e isso
// não aparece em lugar nenhum da fila hoje.
export function usoDoOrcamento(gastos, orcamentoCentavos) {
  const teto = num(orcamentoCentavos);
  const g = gastos || {};
  const gasto = g.ontem != null ? g.ontem : (g.d7 ? g.d7.media : null);
  if (!teto || teto <= 0 || gasto == null) return null;

  const tetoReais = teto / 100;
  const fracao = gasto / tetoReais;
  if (fracao >= LIMITE_DE_USO) return { fracao, aperta: false, texto: '' };
  return {
    fracao,
    aperta: true,
    texto: `Esta campanha gastou ${reais(gasto)} no último dia cheio, com teto de ${reais(tetoReais)} por dia — `
      + `está usando ${Math.round(fracao * 100)}% do que já pode gastar. Subir o teto não faz gastar mais.`,
  };
}

// AS LINHAS DO MODAL, do mais recente para o mais largo.
//
// `parcial` existe para o "hoje": mostrar R$ 9,90 sem dizer que o dia não
// acabou faria parecer que a campanha quase parou.
export function linhasDoModal(gastos) {
  const g = gastos || {};
  const saida = [];
  if (g.hoje != null) saida.push({ rotulo: 'Hoje', valor: reais(g.hoje), nota: 'o dia ainda não fechou', parcial: true });
  if (g.ontem != null) saida.push({ rotulo: 'Ontem', valor: reais(g.ontem), nota: 'último dia completo' });
  for (const [chave, rot] of [['d7', '7 dias'], ['d14', '14 dias'], ['d30', '30 dias']]) {
    const j = g[chave];
    if (j && j.total != null) saida.push({ rotulo: rot, valor: reais(j.total), nota: `${reais(j.media)} por dia, em média` });
  }
  return saida;
}
