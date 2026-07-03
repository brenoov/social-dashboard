// coletor/budget-ia.mjs
// Robô semanal: analisa campanhas em veiculação com Opus 4.8 e grava sugestões
// de budget em gt_budget_analises. Roda via .github/workflows/budget-ia.yml.

const VEREDITOS = new Set(['escalar', 'reduzir', 'manter', 'pausar']);
const VEREDITOS_AD = new Set(['manter', 'pausar']);

// Campanha "em veiculação real": ACTIVE e (sem stop_time OU stop_time no futuro).
export function campanhaEmVeiculacao(camp, agoraMs) {
  if (!camp || camp.effective_status !== 'ACTIVE') return false;
  if (!camp.stop_time) return true;
  const t = Date.parse(camp.stop_time);
  return Number.isNaN(t) ? true : t > agoraMs;
}

// Monta as mensagens (system + user) pro Opus: analisa a campanha E os anúncios dela.
export function montarMensagens(camp, ins, ads) {
  const system =
    'Você é um gestor de tráfego pago sênior. Analise UMA campanha do Meta Ads E os anúncios dela, e recomende: ' +
    '(1) o orçamento diário ideal da CAMPANHA; (2) por ANÚNCIO, manter ou pausar o criativo. ' +
    'Respeite o OBJETIVO da campanha (Vendas: ROAS/CAC; Tráfego: CPC/CTR; Reconhecimento: alcance/CPM; Leads: custo por lead; Engajamento: engajamento/CTR). ' +
    'CONCEITOS (obrigatórios): performance RUIM nunca vira "escalar" — CTR muito abaixo do aceitável pro objetivo, CPC/CPL alto, ROAS baixo, ou frequência alta (fadiga) → "reduzir" ou "pausar", NUNCA "escalar". ' +
    '"escalar" só com EVIDÊNCIA de eficiência (bom resultado a custo baixo) E volume/dado suficiente. Seja conservador quando faltar dado. ' +
    'Por anúncio: "pausar" criativo com performance ruim ou fadiga; "manter" os que vão bem. ' +
    'Responda SOMENTE com um JSON válido, sem texto antes ou depois, no formato: ' +
    '{"budget_sugerido_centavos": <inteiro, centavos de R$/dia>, ' +
    '"veredito": "escalar"|"reduzir"|"manter"|"pausar", ' +
    '"justificativa": "<1-2 frases PT-BR>", ' +
    '"impacto_estimado": "<estimativa curta PT-BR>", ' +
    '"anuncios": [ {"ad_id": "<id>", "veredito": "manter"|"pausar", "justificativa": "<1 frase PT-BR>"} ]}';
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
    anuncios: (ads || []).map((a) => ({
      ad_id: a.ad_id || a.id || '',
      nome: a.ad_name || a.adset_name || '',
      gasto: num(a.spend),
      ctr_pct: num(a.ctr),
      cpc: num(a.cpc),
      impressoes: num(a.impressions),
      alcance: num(a.reach),
      frequencia: num(a.frequency),
    })),
  };
  const user =
    'Dados da campanha e dos anúncios (janela recente):\n' + JSON.stringify(dados) +
    '\nResponda apenas o JSON pedido.';
  return { system, user };
}

// Extrai e valida o JSON da resposta. Retorna o objeto validado (com anuncios) ou null.
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
  const anuncios = Array.isArray(o.anuncios)
    ? o.anuncios
        .filter((a) => a && typeof a.ad_id === 'string' && a.ad_id.trim()
          && VEREDITOS_AD.has(a.veredito)
          && typeof a.justificativa === 'string' && a.justificativa.trim())
        .map((a) => ({ ad_id: a.ad_id.trim(), veredito: a.veredito, justificativa: a.justificativa.trim() }))
    : [];
  return {
    budget_sugerido_centavos: Math.round(b),
    veredito: o.veredito,
    justificativa: o.justificativa.trim(),
    impacto_estimado: o.impacto_estimado.trim(),
    anuncios,
  };
}

function num(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : null; }

// ---------- infra (rede) — só roda no main(), não é importado nos testes ----------
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY_TRAFEGO || process.env.ANTHROPIC_API_KEY_BUDGET || process.env.ANTHROPIC_API_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const MODEL = process.env.BUDGET_MODEL || 'claude-opus-4-8';
const GRAPH = 'https://graph.facebook.com/v21.0';
const REST = SUPABASE_URL + '/rest/v1';
const DRY = process.argv.includes('--dry');

const sbHeaders = { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sbGet(path) {
  const r = await fetch(REST + path, { headers: sbHeaders });
  if (!r.ok) throw new Error('REST GET ' + path + ' -> ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}
async function sbUpsert(path, body) {
  const r = await fetch(REST + path, {
    method: 'POST',
    headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(body),
  });
  if (!r.ok && ![200, 201, 204].includes(r.status)) {
    throw new Error('REST POST ' + path + ' -> ' + r.status + ' ' + (await r.text()).slice(0, 200));
  }
  return r;
}
function cleanAcc(id) { return String(id || '').replace(/^act_/, ''); }
async function graphGet(path, params, token) {
  const url = new URL(GRAPH + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v)));
  url.searchParams.set('access_token', token);
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error('Graph ' + path + ' -> ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}

async function anthropic(body, tentativas = 6) {
  for (let t = 0; t < tentativas; t++) {
    let r;
    try {
      r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch { await sleep(Math.min(60, 8 * (t + 1)) * 1000); continue; }
    if (r.ok) return r.json();
    if (r.status === 429 || r.status >= 500) {
      const ra = parseInt(r.headers.get('retry-after') || '0', 10);
      await sleep((ra > 0 ? ra : Math.min(60, 8 * (t + 1))) * 1000);
      continue;
    }
    throw new Error('Anthropic ' + r.status + ' ' + (await r.text()).slice(0, 300));
  }
  throw new Error('Anthropic: tentativas esgotadas');
}

// Extrai o texto (fora dos blocos de thinking) e detecta refusal.
function textoDaResposta(resp) {
  if (resp && resp.stop_reason === 'refusal') return null;
  const blocks = (resp && resp.content) || [];
  return blocks.filter((b) => b && b.type === 'text').map((b) => b.text).join('').trim();
}

async function main() {
  if (!ANTHROPIC_API_KEY || !SERVICE_KEY) {
    console.error('✗ Faltam segredos: ' + (!ANTHROPIC_API_KEY ? 'ANTHROPIC_API_KEY_TRAFEGO ' : '') + (!SERVICE_KEY ? 'SUPABASE_SERVICE_KEY' : ''));
    process.exit(1);
  }
  const agoraMs = Date.now();
  const proximaSegunda = new Date(agoraMs + 7 * 86400000).toISOString();
  const iso = (d) => d.toISOString().slice(0, 10);
  const since = iso(new Date(agoraMs - 7 * 86400000));
  const until = iso(new Date(agoraMs));

  // accounts guarda contas IG/página com access_token; a coluna ad_account_id é vazia.
  // A(s) conta(s) de anúncio são descobertas em runtime via Graph /me/adaccounts (igual ao meta-proxy).
  const contas = await sbGet('/accounts?select=id,access_token');
  let total = 0, gravadas = 0, puladas = 0;

  const seenAdAcc = new Set();
  const campFields = 'id,name,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time';
  const insFields = 'campaign_id,impressions,clicks,spend,ctr,cpc,reach,frequency,actions,action_values,purchase_roas,objective';
  for (const acc of contas) {
    if (!acc.access_token) continue;
    let adAccounts;
    try {
      adAccounts = (await graphGet('/me/adaccounts', { fields: 'account_id', limit: 200 }, acc.access_token)).data || [];
    } catch (e) { console.log('  conta ' + acc.id + ' falhou /me/adaccounts: ' + e.message); continue; }
    for (const aa of adAccounts) {
      const adAcc = cleanAcc(aa.account_id || aa.id);
      if (!adAcc || seenAdAcc.has(adAcc)) continue;
      seenAdAcc.add(adAcc);
      let camps, insights;
      try {
        camps = (await graphGet(`/act_${adAcc}/campaigns`, { fields: campFields, effective_status: ['ACTIVE'], limit: 500 }, acc.access_token)).data || [];
        insights = (await graphGet(`/act_${adAcc}/insights`, { level: 'campaign', fields: insFields, time_range: { since, until }, limit: 500 }, acc.access_token)).data || [];
      } catch (e) { console.log('  act_' + adAcc + ' falhou no Graph: ' + e.message); continue; }
      const insByCamp = {};
      insights.forEach((i) => { insByCamp[i.campaign_id] = i; });
      const ativas = camps.filter((c) => campanhaEmVeiculacao(c, agoraMs));
      console.log(`Conta ${acc.id} / act_${adAcc}: ${ativas.length} campanhas em veiculação.`);

    for (const camp of ativas) {
      total++;
      const ins = insByCamp[camp.id] || {};
      const { system, user } = montarMensagens(camp, ins);
      if (DRY) { console.log('  [dry] ' + (camp.name || camp.id)); continue; }
      let saida;
      try {
        const resp = await anthropic({ model: MODEL, max_tokens: 4096, thinking: { type: 'adaptive' }, system, messages: [{ role: 'user', content: user }] });
        saida = parsearSaida(textoDaResposta(resp));
      } catch (e) { console.log('  ✗ ' + (camp.name || camp.id) + ': ' + e.message); puladas++; continue; }
      if (!saida) { console.log('  ⚠ ' + (camp.name || camp.id) + ': sem sugestão válida'); puladas++; continue; }
      try {
        await sbUpsert('/gt_budget_analises', [{
          campaign_id: camp.id,
          account_id: acc.id,
          objetivo: camp.objective || null,
          effective_status: camp.effective_status || null,
          budget_atual_centavos: camp.daily_budget != null ? Number(camp.daily_budget) : null,
          budget_sugerido_centavos: saida.budget_sugerido_centavos,
          veredito: saida.veredito,
          justificativa: saida.justificativa,
          impacto_estimado: saida.impacto_estimado,
          modelo: MODEL,
          gerado_em: new Date().toISOString(),
          valida_ate: proximaSegunda,
        }]);
        gravadas++;
      } catch (e) {
        console.log('  ✗ gravar ' + (camp.name || camp.id) + ': ' + e.message);
        puladas++;
        continue;
      }
    }
    }
  }
  console.log(`Concluído: ${total} analisadas, ${gravadas} gravadas, ${puladas} puladas.`);
}

// Só roda main() quando executado como script (não quando importado nos testes).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
