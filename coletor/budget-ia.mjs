// coletor/budget-ia.mjs
// Robô semanal: analisa campanhas em veiculação com Opus 4.8 e grava sugestões
// de budget em gt_budget_analises. Roda via .github/workflows/budget-ia.yml.

const VEREDITOS = new Set(['escalar', 'reduzir', 'manter', 'pausar']);

// Campanha "em veiculação real": ACTIVE e (sem stop_time OU stop_time no futuro).
export function campanhaEmVeiculacao(camp, agoraMs) {
  if (!camp || camp.effective_status !== 'ACTIVE') return false;
  if (!camp.stop_time) return true;
  const t = Date.parse(camp.stop_time);
  return Number.isNaN(t) ? true : t > agoraMs;
}

// Monta as mensagens (system + user) pro Opus. Pede SOMENTE um JSON.
export function montarMensagens(camp, ins) {
  const system =
    'Você é um gestor de tráfego pago sênior. Analise UMA campanha do Meta Ads e ' +
    'recomende o orçamento diário ideal, respeitando o OBJETIVO da campanha ' +
    '(Vendas: priorize ROAS/CAC; Tráfego: CPC/CTR; Reconhecimento: alcance/CPM; ' +
    'Leads: custo por lead). Seja conservador quando faltar dado. Se o gasto não se ' +
    'justifica pela performance, use veredito "pausar". ' +
    'Responda SOMENTE com um JSON válido, sem texto antes ou depois, no formato: ' +
    '{"budget_sugerido_centavos": <inteiro, orçamento diário em centavos de R$>, ' +
    '"veredito": "escalar"|"reduzir"|"manter"|"pausar", ' +
    '"justificativa": "<1-2 frases em PT-BR>", ' +
    '"impacto_estimado": "<estimativa curta do efeito em PT-BR, ex.: +30% budget → ~+25% compras>"}';
  const dados = {
    nome: camp.name || '',
    objetivo: camp.objective || '',
    budget_diario_atual_centavos: camp.daily_budget != null ? Number(camp.daily_budget) : null,
    budget_total_centavos: camp.lifetime_budget != null ? Number(camp.lifetime_budget) : null,
    gasto: num(ins.spend),
    impressoes: num(ins.impressions),
    cliques: num(ins.clicks),
    ctr_pct: num(ins.ctr),
    cpc: num(ins.cpc),
    alcance: num(ins.reach),
    frequencia: num(ins.frequency),
    roas: Array.isArray(ins.purchase_roas) && ins.purchase_roas[0] ? num(ins.purchase_roas[0].value) : null,
    acoes: ins.actions || null,
    valores_acao: ins.action_values || null,
  };
  const user =
    'Dados da campanha (janela recente):\n' + JSON.stringify(dados) +
    '\nResponda apenas o JSON pedido.';
  return { system, user };
}

// Extrai e valida o JSON da resposta. Retorna o objeto validado ou null.
export function parsearSaida(text) {
  if (!text || typeof text !== 'string') return null;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  let o;
  try { o = JSON.parse(m[0]); } catch { return null; }
  if (!o || typeof o !== 'object') return null;
  const b = o.budget_sugerido_centavos;
  if (!Number.isFinite(b) || b < 0) return null;
  if (!VEREDITOS.has(o.veredito)) return null;
  if (typeof o.justificativa !== 'string' || !o.justificativa.trim()) return null;
  if (typeof o.impacto_estimado !== 'string' || !o.impacto_estimado.trim()) return null;
  return {
    budget_sugerido_centavos: Math.round(b),
    veredito: o.veredito,
    justificativa: o.justificativa.trim(),
    impacto_estimado: o.impacto_estimado.trim(),
  };
}

function num(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : null; }
