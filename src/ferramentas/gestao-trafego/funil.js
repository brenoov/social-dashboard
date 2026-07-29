// O FUNIL de cada objetivo que a conta roda.
//
// A descoberta que define este arquivo: NEM TODO OBJETIVO TEM FUNIL. Medido nas
// contas reais (29/07), empilhar as etapas em engajamento devolve "11.262% de
// quem clicou" — porque a interação (curtida, salvamento) não vem DEPOIS do
// clique, ela acontece NO LUGAR dele. Em tráfego dá 100,97%, já que visita e
// clique são quase a mesma coisa medida duas vezes.
//
// Então há duas leituras:
//
//   FUNIL     mensagens, leads, vendas — o resultado vem depois do clique, e a
//             queda entre as etapas é a informação (viu → clicou → conversou).
//   PROPORÇÃO engajamento, tráfego, reconhecimento — o resultado é uma razão,
//             não uma etapa. Quanto foi visto, quantas vezes por pessoa, quanto
//             rendeu por pessoa alcançada.
//
// Forçar o mesmo desenho nos dois casos produziria um número que não quer dizer
// nada, e um número sem sentido ao lado de números certos contamina os certos.
// PURO: sem rede, sem tela.
import { quantidadesDoInsight, PESOS_PADRAO } from './ponderada.js';

// Como cada objetivo se lê, e qual ação conta como resultado dele.
//
// `singular` é declarado em vez de derivado: tirar o "s" do fim funciona em
// "conversas" e falha em "interações" ("interaçõe") e "impressões". O primeiro
// texto gerado dizia "R$ 1 compra 512 interaçãos".
export const LEITURA = {
  mensagens: {
    tipo: 'funil', rotulo: 'Mensagens', resultado: 'conversas', singular: 'conversa',
    acoes: ['onsite_conversion.messaging_conversation_started_7d', 'onsite_conversion.messaging_conversation_started'],
    explica: 'Cada pessoa que abriu conversa depois de clicar.',
  },
  leads: {
    tipo: 'funil', rotulo: 'Leads', resultado: 'cadastros', singular: 'cadastro',
    acoes: ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead'],
    explica: 'Cada cadastro recebido depois do clique.',
  },
  vendas: {
    tipo: 'funil', rotulo: 'Vendas', resultado: 'compras', singular: 'compra',
    acoes: ['purchase', 'offsite_conversion.fb_pixel_purchase'],
    explica: 'Cada compra concluída depois do clique.',
  },
  trafego: {
    // Visita É o clique que vingou — quando as duas quase se igualam (medido
    // 100,97% na Raíssa), o que importa não é a "queda" e sim se as pessoas
    // chegam ao destino.
    tipo: 'proporcao', rotulo: 'Tráfego', resultado: 'visitas', singular: 'visita',
    acoes: ['landing_page_view', 'link_click'],
    explica: 'Quem clicou e realmente chegou no destino.',
  },
  engajamento: {
    tipo: 'proporcao', rotulo: 'Engajamento', resultado: 'interações', singular: 'interação',
    acoes: ['post_engagement', 'page_engagement'],
    explica: 'Curtida, comentário, salvamento e compartilhamento somados.',
  },
  reconhecimento: {
    tipo: 'proporcao', rotulo: 'Reconhecimento', resultado: 'impressões', singular: 'impressão',
    acoes: [], explica: 'Aqui o resultado é aparecer — o número é a própria exibição.',
  },
};

const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

function somaAcao(insight, tipos) {
  for (const t of tipos || []) {
    const a = ((insight && insight.actions) || []).find((x) => x && x.action_type === t);
    if (a) return n(a.value);
  }
  return 0;
}

// Junta as campanhas de um mesmo objetivo num funil só.
// campanhas: [{ balde, insight }] — `balde` já resolvido (ver baldes.js).
// → [{ balde, tipo, rotulo, campanhas, gasto, alcance, impressoes, cliques,
//      resultados, frequencia, ctr, taxaResultado, porPessoa, custoPorResultado }]
//   ordenado por gasto. `taxaResultado` só existe em funil; `porPessoa` só em
//   proporção — cada um devolve o que faz sentido no seu tipo, e nunca os dois.
export function montarFunis(campanhas) {
  const porBalde = new Map();
  for (const c of campanhas || []) {
    if (!c || !c.balde) continue;
    const leitura = LEITURA[c.balde];
    if (!leitura) continue;
    if (!porBalde.has(c.balde)) {
      porBalde.set(c.balde, {
        balde: c.balde, tipo: leitura.tipo, rotulo: leitura.rotulo,
        resultadoRotulo: leitura.resultado, singular: leitura.singular, explica: leitura.explica,
        campanhas: 0, gasto: 0, alcance: 0, impressoes: 0, cliques: 0, resultados: 0,
      });
    }
    const f = porBalde.get(c.balde);
    const i = c.insight || {};
    f.campanhas += 1;
    f.gasto += n(i.spend);
    f.alcance += n(i.reach);
    f.impressoes += n(i.impressions);
    f.cliques += n(i.clicks);
    // Reconhecimento não tem ação: o resultado é a própria impressão.
    f.resultados += c.balde === 'reconhecimento' ? n(i.impressions) : somaAcao(i, leitura.acoes);
    // ENGAJAMENTO se abre por TIPO de interação (pedido do dono, 2026-07-29):
    // "212.407 interações" é um número só e não diz o que as pessoas fizeram —
    // curtir e salvar são coisas muito diferentes, e é justamente essa diferença
    // que a régua pondera (curtida 1, salvamento 30).
    if (c.balde === 'engajamento') {
      const q = quantidadesDoInsight(i) || {};
      f.porTipo = f.porTipo || {};
      for (const k of Object.keys(PESOS_PADRAO)) f.porTipo[k] = (f.porTipo[k] || 0) + n(q[k]);
    }
  }

  const saida = [...porBalde.values()].map((f) => {
    const div = (a, b) => (b > 0 ? a / b : null);
    return {
      ...f,
      frequencia: div(f.impressoes, f.alcance),
      ctr: div(f.cliques, f.impressoes),
      custoPorResultado: div(f.gasto, f.resultados),
      // Só no funil: quanto de quem clicou chegou ao fim.
      taxaResultado: f.tipo === 'funil' ? div(f.resultados, f.cliques) : null,
      // Só na proporção: quanto rendeu por pessoa alcançada.
      porPessoa: f.tipo === 'proporcao' ? div(f.resultados, f.alcance) : null,
    };
  });
  return saida.sort((a, b) => b.gasto - a.gasto);
}

// A quebra do engajamento por tipo de interação, da mais frequente pra menos.
// Cada linha traz o PESO junto: é o que explica por que 200 mil curtidas podem
// valer menos que 500 salvamentos na régua.
// → [{ chave, rotulo, quantidade, peso, fatia }] ou [] quando não há quebra.
const ROTULO_INTERACAO = {
  curtidas: 'Curtidas', comentarios: 'Comentários',
  salvamentos: 'Salvamentos', compartilhamentos: 'Compartilhamentos',
};
export function quebraDeInteracoes(f, pesos) {
  const t = (f && f.porTipo) || null;
  if (!t) return [];
  const p = pesos || PESOS_PADRAO;
  const total = Object.values(t).reduce((a, b) => a + b, 0);
  if (total <= 0) return [];
  return Object.entries(t)
    .filter(([, q]) => q > 0)
    .map(([chave, q]) => ({
      chave, rotulo: ROTULO_INTERACAO[chave] || chave, quantidade: q,
      peso: p[chave] ?? null, fatia: q / total,
    }))
    .sort((a, b) => b.quantidade - a.quantidade);
}

// Um número por unidade que fica ABAIXO de um centavo (ou de 0,01) vira zero ao
// ser arredondado, e "R$ 0,00 por interação" mente: parece que não custa nada.
// Nesses casos a leitura se inverte — "R$ 1 compra 512 interações" diz a mesma
// coisa e dá pra ler. Medido: R$ 415 por 212.407 interações = R$ 0,00195.
// → { texto, invertido }
export function porUnidade(valor, quantidade, singular, plural, moeda) {
  const v = Number(valor), q = Number(quantidade);
  if (!Number.isFinite(v) || !Number.isFinite(q) || q <= 0 || v <= 0) return null;
  const razao = v / q;
  const fmt = (x, casas) => x.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  if (razao >= 0.01) {
    return { texto: (moeda ? 'R$ ' : '') + fmt(razao, 2) + ` por ${singular}`, invertido: false };
  }
  const inverso = q / v;
  return {
    texto: moeda
      ? `R$ 1 compra ${fmt(inverso, 0)} ${plural || singular}`
      : `1 ${singular} a cada ${fmt(inverso, 0)}`,
    invertido: true,
  };
}

// As ETAPAS prontas pra desenhar, na ordem, já com a largura relativa de cada
// barra. A largura sai do ALCANCE (o topo), nunca do maior número absoluto:
// em engajamento as interações passam das pessoas alcançadas, e ancorar no
// maior faria a barra do topo encolher como se menos gente tivesse visto.
// → [{ chave, rotulo, valor, largura, nota }]
export function etapasDoFunil(f) {
  if (!f) return [];
  const base = f.alcance > 0 ? f.alcance : Math.max(f.impressoes, 1);
  const larg = (v) => Math.max(2, Math.min(100, Math.round((v / base) * 100)));
  const pct = (v) => (v == null ? null : (v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%');

  const etapas = [
    { chave: 'alcance', rotulo: 'Pessoas alcançadas', valor: f.alcance, largura: 100,
      nota: f.frequencia ? `viram ${f.frequencia.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}× cada` : null },
    { chave: 'cliques', rotulo: 'Cliques', valor: f.cliques, largura: larg(f.cliques),
      nota: f.ctr ? `${pct(f.ctr)} das exibições` : null },
  ];
  if (f.tipo === 'funil') {
    etapas.push({
      chave: 'resultados', rotulo: f.resultadoRotulo.charAt(0).toUpperCase() + f.resultadoRotulo.slice(1),
      valor: f.resultados, largura: larg(f.resultados),
      nota: f.taxaResultado != null ? `${pct(f.taxaResultado)} de quem clicou` : null,
    });
    return etapas;
  }
  // Proporção: o resultado NÃO entra como etapa da pilha — ele não vem depois do
  // clique. Vai como linha própria, com a razão que faz sentido.
  return etapas.concat([{
    chave: 'resultados', rotulo: f.resultadoRotulo.charAt(0).toUpperCase() + f.resultadoRotulo.slice(1),
    valor: f.resultados, largura: null,
    nota: (() => {
      if (!f.resultados || !f.alcance) return null;
      // A razão aqui é resultado/pessoa (não custo), e abaixo de 0,01 ela vira
      // "0 por pessoa" — que não diz nada. Aí se inverte.
      return f.porPessoa >= 0.01
        ? `${f.porPessoa.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} por pessoa alcançada`
        : `1 ${f.singular} a cada ${Math.round(f.alcance / f.resultados).toLocaleString('pt-BR')} pessoas`;
    })(),
  }]);
}
