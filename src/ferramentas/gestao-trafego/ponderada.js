// Métrica ponderada: em vez de contar interações no bruto, converte cada uma em
// PONTOS conforme o valor que ela representa (um salvamento vale mais que uma
// curtida) e mede o custo por ponto contra uma meta.
// PURO: sem rede, sem tela, sem Supabase — só entram números e saem números.
// É isso que permite testar a conta inteira com `node --test`.

// VISITA entra com peso 5 (decisão do dono, 2026-07-28), e o número foi escolhido
// medindo: com peso 25 a visita virava 59% a 100% dos pontos em 7 das 13 campanhas
// de engajamento dele, e a PIOR campanha do ranking virava a MELHOR — a ponderada
// deixava de medir engajamento e passava a medir tráfego. Com 5 ela conta de
// verdade sem sequestrar o resultado.
//
// SEGUIDOR ficou de fora de propósito: a Meta não reporta seguidor por campanha
// nem por anúncio (conferido em todas as 5 contas). O que existe é seguidor por
// PERFIL por dia, que é a soma de tudo — campanha, post orgânico, indicação.
// Atribuir isso a uma campanha seria inventar.
export const PESOS_PADRAO = Object.freeze({ curtidas: 1, comentarios: 10, salvamentos: 30, compartilhamentos: 20, visitas: 5 });
export const LIMIARES_PADRAO = Object.freeze({ escalarForte: 0.8, dentroMeta: 1.0, manter: 1.3 });

// Ordem importa: a LÍQUIDA vem primeiro e vence a bruta. Líquida já desconta quem
// descurtiu/dessalvou, e a casa toda usa a régua "líquido com sinal".
const FONTES = {
  curtidas: ['onsite_conversion.post_net_like', 'post_reaction'],
  comentarios: ['onsite_conversion.post_net_comment', 'comment'],
  salvamentos: ['onsite_conversion.post_net_save', 'onsite_conversion.post_save'],
  compartilhamentos: ['post', 'share'],
  // Visita = quem REALMENTE chegou no destino (landing_page_view). O clique
  // (link_click) é a queda: alguém pode clicar e desistir antes de a página abrir.
  visitas: ['landing_page_view', 'link_click'],
};

function numero(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

// Devolve o valor da PRIMEIRA ação encontrada na ordem pedida.
// Achar com valor 0 é diferente de não achar: 0 é resposta, não ausência.
function valorDaAcao(acoes, tipos) {
  if (!Array.isArray(acoes)) return null;
  for (const tipo of tipos) {
    const achou = acoes.find((a) => a && a.action_type === tipo);
    if (achou) return numero(achou.value);
  }
  return null;
}

export function quantidadesDoInsight(linha) {
  const acoes = linha && linha.actions;
  const q = { gasto: numero(linha && linha.spend) };
  // A API do Meta não envia um action_type quando a contagem é zero — ele
  // simplesmente fica de fora do array de actions. Para essas quatro métricas,
  // ausência DE VERDADE significa "zero interações", não dado faltante. Então
  // o 0 aqui é honesto, não inventado. A regra "ausente ≠ zero" continua
  // valendo para VALORES DERIVADOS (custo por ponto, qualidade, índice),
  // que ficam null quando não há nada a dividir.
  for (const chave of Object.keys(FONTES)) {
    const v = valorDaAcao(acoes, FONTES[chave]);
    q[chave] = v == null ? 0 : v;
  }
  return { curtidas: q.curtidas, comentarios: q.comentarios, salvamentos: q.salvamentos, compartilhamentos: q.compartilhamentos, gasto: q.gasto };
}

// Exportada porque TODOS os baldes usam este mesmo semáforo (ver alvos.js).
// Copiar a regra em outro arquivo faria uma mudança futura valer só pra metade
// da ferramenta.
export function faixaDoIndice(indice, limiares) {
  const l = { ...LIMIARES_PADRAO, ...(limiares || {}) };
  if (indice == null) return 'sem-dados';
  if (indice <= l.escalarForte) return 'escalar-forte';
  if (indice <= l.dentroMeta) return 'dentro-da-meta';
  if (indice <= l.manter) return 'manter';
  return 'otimizar';
}

export function calcularPonderada(quantidades, opcoes) {
  const o = opcoes || {};
  const pesos = { ...PESOS_PADRAO, ...(o.pesos || {}) };
  const limiares = { ...LIMIARES_PADRAO, ...(o.limiares || {}) };
  const meta = numero(o.meta);
  const gasto = numero(quantidades && quantidades.gasto);

  let pontos = 0, interacoes = 0;
  for (const chave of Object.keys(pesos)) {
    const qtd = numero(quantidades && quantidades[chave]);
    pontos += qtd * numero(pesos[chave]);
    interacoes += qtd;
  }

  const custoPorPonto = pontos > 0 ? gasto / pontos : null;
  const qualidade = interacoes > 0 ? pontos / interacoes : null;
  const indice = (custoPorPonto != null && meta > 0) ? custoPorPonto / meta : null;

  return { pontos, interacoes, custoPorPonto, qualidade, indice, faixa: faixaDoIndice(indice, limiares) };
}
