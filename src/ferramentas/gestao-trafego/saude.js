// A SAÚDE da campanha: fadiga de audiência e sinais de criativo que não conecta.
// Lê só o que a Meta entrega (frequência, CTR, gasto, impressões, resultado do
// objetivo) e não depende de meta nenhuma — por isso vale mesmo em conta sem
// régua definida.
//
// Vive num módulo próprio desde 2026-07-29: ela morava dentro do .vue, na faixa
// de recomendação do cartão, e quando o julgamento migrou para a Fila a saúde
// ficou sem lugar. Agora a FILA a consome, junto das análises do robô — o caso
// que importa é quando os dois discordam (robô manda escalar uma campanha que
// está queimando a audiência).
//
// PURO: sem rede, sem tela, sem formatação de moeda (quem monta a frase é quem
// mostra — este módulo devolve os números e o motivo em texto simples).

// Os limiares. Vieram do GT_CRIT que já governava o cartão; mudar qualquer um
// muda o que a fila mostra, então mexer aqui é decisão de produto.
export const CRITERIOS = {
  minGasto: 20, minImpressoes: 1000,     // abaixo disso não há leitura confiável
  freqSatura: 4, freqAtencao: 3.5,
  lead: { pausGasto: 80, pausImpr: 4000, escCTR: 2.0, escCPLf: 0.85, monCTR: 1.5, monGasto: 50 },
  // Mensagem tem os mesmos números do lead: o que muda é O QUE se conta como
  // resultado — conversa iniciada, não cadastro.
  mensagem: { pausGasto: 80, pausImpr: 4000, monCTR: 1.5, monGasto: 50 },
  trafego: { pausCTR: 0.5, pausGasto: 40, pausImpr: 2000, escCTR: 2.0, escCPC: 2.0, monCTR: 1.0, monGasto: 40 },
  engajamento: { pausGasto: 60, pausEng: 10, pausImpr: 2000, escEng: 100, escCTR: 1.0, monCTR: 0.5, monGasto: 30 },
  video: { monGasto: 50, monViews: 100, escViews: 500, escCTR: 0.8 },
};

// A categoria é MAIS GROSSA que o balde de alvos.js de propósito: aqui interessa
// o tipo de leitura de saúde (um lead e uma venda se leem igual), não a unidade
// da meta.
//
// `ehWhatsapp` (o que a Meta afirma no CONJUNTO, ver ehDeWhatsapp em baldes.js)
// ganha do objetivo declarado. Sem isso a saúde media `lead` numa campanha que
// compra CONVERSA e acusava "R$ 3.478 gastos e nenhum resultado" numa campanha
// da Motoeasy que teve mais de mil conversas — um alerta falso, e do tipo que
// faz o dono pausar algo que está funcionando.
export function categoriaDoObjetivo(objetivo, ehWhatsapp) {
  if (ehWhatsapp) return 'mensagem';
  const o = String(objetivo || '').toUpperCase();
  if (o.includes('LEAD')) return 'lead';
  if (o.includes('CONVERSION') || o.includes('SALE')) return 'conversion';
  if (o.includes('ENGAGEMENT') || o === 'POST_ENGAGEMENT' || o === 'PAGE_LIKES') return 'engagement';
  if (o.includes('VIDEO') || o === 'VIDEO_VIEWS') return 'video';
  if (o.includes('AWARENESS') || o === 'BRAND_AWARENESS' || o === 'REACH') return 'awareness';
  if (o.includes('TRAFFIC') || o === 'LINK_CLICKS') return 'traffic';
  return 'other';
}

const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const pct = (v) => n(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
const num = (v, d = 0) => n(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const rs = (v) => 'R$ ' + n(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// m: { categoria, gasto, impressoes, ctr, frequencia, cliques, cpc, resultados,
//      cpl, cplMedioDaConta, engajamentos, plays, alcance }
// → { nivel, veredito, porque }
//   `nivel`: 'alerta' (pede ação), 'atencao' (vale olhar), 'ok', 'sem-volume'.
//   Só 'alerta' e 'atencao' aparecem na fila — 'ok' não é notícia.
export function lerSaude(m) {
  const e = m || {};
  const C = CRITERIOS;
  const gasto = n(e.gasto), impr = n(e.impressoes), ctr = n(e.ctr), freq = n(e.frequencia);

  if (gasto < C.minGasto || impr < C.minImpressoes) {
    return { nivel: 'sem-volume', veredito: 'coletando', porque: `Volume baixo (${rs(gasto)} · ${num(impr)} impressões) — ainda não dá para ler.` };
  }
  // A frequência vem ANTES do objetivo: audiência queimada é problema em
  // qualquer tipo de campanha, e é o sinal que mais contradiz um "escalar".
  if (freq >= C.freqSatura) {
    return { nivel: 'alerta', veredito: 'reduzir', porque: `Frequência ${num(freq, 1)}× — o mesmo público já viu demais. Subir verba aqui só repete o anúncio para quem já cansou.` };
  }
  if (freq >= C.freqAtencao) {
    return { nivel: 'atencao', veredito: 'monitorar', porque: `Frequência ${num(freq, 1)}× — começando a saturar o público.` };
  }

  const cat = e.categoria || 'other';
  if (cat === 'lead' || cat === 'conversion') {
    const c = C.lead, res = n(e.resultados);
    if (res === 0 && gasto >= c.pausGasto && impr >= c.pausImpr) {
      return { nivel: 'alerta', veredito: 'pausar', porque: `${rs(gasto)} gastos e nenhum resultado. Vale pausar e revisar oferta ou público.` };
    }
    if (res === 0 && ctr >= c.monCTR && gasto >= c.monGasto) {
      return { nivel: 'atencao', veredito: 'monitorar', porque: `CTR ${pct(ctr)} bom, mas nenhuma conversão — o gargalo provavelmente está depois do clique.` };
    }
    return { nivel: 'ok', veredito: 'saudavel', porque: `${num(res)} resultados · CTR ${pct(ctr)}.` };
  }
  if (cat === 'mensagem') {
    const c = C.mensagem, conversas = n(e.resultados);
    if (conversas === 0 && gasto >= c.pausGasto && impr >= c.pausImpr) {
      return { nivel: 'alerta', veredito: 'pausar', porque: `${rs(gasto)} gastos e nenhuma conversa iniciada. Vale pausar e revisar a oferta.` };
    }
    if (conversas === 0 && ctr >= c.monCTR && gasto >= c.monGasto) {
      return { nivel: 'atencao', veredito: 'monitorar', porque: `CTR ${pct(ctr)} bom, mas ninguém puxou conversa — o gargalo está na mensagem de abertura.` };
    }
    return { nivel: 'ok', veredito: 'saudavel', porque: `${num(conversas)} conversas · CTR ${pct(ctr)}.` };
  }
  if (cat === 'traffic') {
    const c = C.trafego;
    if (ctr < c.pausCTR && gasto >= c.pausGasto && impr >= c.pausImpr) {
      return { nivel: 'alerta', veredito: 'pausar', porque: `CTR ${pct(ctr)} muito baixo com ${rs(gasto)} gastos — quase ninguém está clicando.` };
    }
    if (ctr < c.monCTR && gasto >= c.monGasto) {
      return { nivel: 'atencao', veredito: 'monitorar', porque: `CTR ${pct(ctr)} fraco para tráfego — vale testar outro criativo.` };
    }
    return { nivel: 'ok', veredito: 'saudavel', porque: `${num(e.cliques)} cliques · CTR ${pct(ctr)}.` };
  }
  if (cat === 'engagement') {
    const c = C.engajamento, eng = n(e.engajamentos);
    if (gasto >= c.pausGasto && eng < c.pausEng && impr >= c.pausImpr) {
      return { nivel: 'alerta', veredito: 'pausar', porque: `${rs(gasto)} gastos e só ${num(eng)} interações — o criativo não está conectando.` };
    }
    if (ctr < c.monCTR && gasto >= c.monGasto) {
      return { nivel: 'atencao', veredito: 'monitorar', porque: `CTR ${pct(ctr)} baixo para engajamento.` };
    }
    return { nivel: 'ok', veredito: 'saudavel', porque: `${num(eng)} interações · CTR ${pct(ctr)}.` };
  }
  if (cat === 'video') {
    const c = C.video, plays = n(e.plays);
    if (gasto >= c.monGasto && plays < c.monViews) {
      return { nivel: 'atencao', veredito: 'monitorar', porque: `Poucos plays (${num(plays)}) com ${rs(gasto)} gastos — o começo do vídeo pode estar fraco.` };
    }
    return { nivel: 'ok', veredito: 'saudavel', porque: `${num(plays)} plays · CTR ${pct(ctr)}.` };
  }
  return { nivel: 'ok', veredito: 'saudavel', porque: `CTR ${pct(ctr)} · ${rs(gasto)} gastos.` };
}

// A saúde CONTRADIZ esta sugestão do robô?
//
// É o caso que justifica ligar as duas leituras: o robô olha eficiência (CTR,
// CPC, custo por resultado) e pode mandar escalar uma campanha que está com a
// audiência queimada. Aprovar ali é pagar mais para repetir o anúncio para quem
// já cansou. Medido em 29/07 nas cinco contas.
//
// Só 'alerta' contradiz — 'atencao' é observação, não veto.
export function contradiz(saude, veredito) {
  if (!saude || saude.nivel !== 'alerta') return false;
  return veredito === 'escalar' && (saude.veredito === 'reduzir' || saude.veredito === 'pausar');
}
