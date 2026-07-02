import { createClient } from 'jsr:@supabase/supabase-js@2';

const GRAPH = 'https://graph.facebook.com/v21.0';
const APP_ID = Deno.env.get('META_APP_ID') ?? '';
const APP_SECRET = Deno.env.get('META_APP_SECRET') ?? '';
const ALERT_WEBHOOK_URL = Deno.env.get('ALERT_WEBHOOK_URL') ?? '';

const AD_ACCOUNTS: Record<string, string> = {
  '17841401847160442': '591630990582441',
  '17841401284454639': '1523458001735386',
  '17841406451230767': '786453150398609',
  '17841462952561833': '1197997517858139',
  '17841464138609037': '803642218253857',
};

const PERIODS = [0, 1, 7, 14, 30];
const ENG_KEYS = ['likes', 'comments', 'saves', 'shares', 'reach', 'views', 'total_interactions', 'accounts_engaged', 'profile_views'];

function todayBR(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function localDate(ts: string): string {
  return new Date(ts).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function brDateMinus(daysAgo: number): string {
  const dt = new Date(`${todayBR()}T12:00:00-03:00`);
  dt.setDate(dt.getDate() - daysAgo);
  return dt.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function periodLabel(dias: number): string {
  return dias === 99 ? 'mês' : `${dias}d`;
}

async function apiGet(path: string, params: Record<string, string>): Promise<any> {
  const url = new URL(`${GRAPH}/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`Meta API ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function apiGetAll(path: string, params: Record<string, string>): Promise<any[]> {
  const all: any[] = [];
  let data = await apiGet(path, { ...params, limit: '500' });
  all.push(...(data.data ?? []));
  while (data.paging?.next) {
    const r = await fetch(data.paging.next);
    if (!r.ok) break;
    data = await r.json();
    all.push(...(data.data ?? []));
  }
  return all;
}

async function renovarToken(token: string): Promise<string> {
  if (!APP_ID || !APP_SECRET) return token;
  try {
    const d = await apiGet('oauth/access_token', {
      grant_type: 'fb_exchange_token',
      client_id: APP_ID,
      client_secret: APP_SECRET,
      fb_exchange_token: token,
    });
    return d.access_token || token;
  } catch { return token; }
}

async function coletarSeguidores(igId: string, token: string): Promise<number> {
  const d = await apiGet(igId, { fields: 'followers_count', access_token: token });
  return d.followers_count ?? 0;
}

async function coletarFollowsDia(igId: string, dia: string, token: string): Promise<{ gained: number; lost: number } | null> {
  const since = Math.floor(new Date(`${dia}T00:00:00-03:00`).getTime() / 1000);
  const until = Math.floor(new Date(`${dia}T23:59:59-03:00`).getTime() / 1000);
  try {
    const d = await apiGet(`${igId}/insights`, {
      metric: 'follows_and_unfollows', period: 'day',
      metric_type: 'total_value', breakdown: 'follow_type',
      since: String(since), until: String(until), access_token: token,
    });
    const rows = d.data ?? [];
    if (!rows.length) return null;
    const bd = rows[0].total_value?.breakdowns ?? [];
    const results = bd[0]?.results ?? [];
    if (!results.length) return null;
    let gained = 0, lost = 0;
    for (const r of results) {
      const dv = (r.dimension_values ?? [null])[0];
      const v = r.value ?? 0;
      if (dv === 'FOLLOWER') gained = v;
      else if (dv === 'NON_FOLLOWER') lost = v;
    }
    return { gained, lost };
  } catch { return null; }
}

async function coletarEngajamentoConta(igId: string, token: string, dias: number): Promise<Record<string, number> | null> {
  const now = Math.floor(Date.now() / 1000);
  const startOf = (dia: string) => Math.floor(new Date(`${dia}T00:00:00-03:00`).getTime() / 1000);
  let since: number, until: number;
  if (dias === 0) { since = startOf(todayBR()); until = now; }
  else if (dias === 1) { since = startOf(brDateMinus(1)); until = startOf(todayBR()); }
  else if (dias === 99) { since = startOf(`${todayBR().slice(0, 7)}-01`); until = now; }
  else { since = startOf(brDateMinus(dias)); until = startOf(todayBR()); } // últimos N dias COMPLETOS (fecha à meia-noite BRT, = "Últimos N dias" do Business Suite)
  try {
    const d = await apiGet(`${igId}/insights`, {
      metric: 'likes,comments,saves,shares,reach,views,total_interactions,accounts_engaged,profile_views', period: 'day', metric_type: 'total_value',
      since: String(since), until: String(until), access_token: token,
    });
    const v: Record<string, number> = {};
    for (const it of d.data ?? []) v[it.name] = it.total_value?.value ?? 0;
    return v;
  } catch { return null; }
}

function bdSum(v: Record<string, number> | null): number {
  if (!v) return 0;
  return (Number(v.likes) || 0) + (Number(v.comments) || 0) + (Number(v.saves) || 0) + (Number(v.shares) || 0);
}
function engOk(v: Record<string, number> | null): boolean {
  if (!v) return false;
  if (!((Number(v.reach) || 0) > 0)) return false;
  if ((Number(v.total_interactions) || 0) > 0 && bdSum(v) === 0) return false;
  return true;
}
function bdBroken(v: Record<string, number> | null): boolean {
  return !!v && (Number(v.total_interactions) || 0) > 0 && bdSum(v) === 0;
}

async function coletarEngResiliente(igId: string, token: string, dias: number): Promise<{ eng: Record<string, number> | null; ok: boolean }> {
  let last: Record<string, number> | null = null;
  for (let i = 0; i < 5; i++) {
    last = await coletarEngajamentoConta(igId, token, dias);
    if (engOk(last)) return { eng: last, ok: true };
    if (i < 4) await new Promise((r) => setTimeout(r, 350 * (i + 1)));
  }
  return { eng: last, ok: false };
}

async function carregarUltimoBom(sb: any, accountId: string, dias: number): Promise<Record<string, number> | null> {
  const { data } = await sb.from('engagement_snapshots')
    .select('likes,comments,saves,shares,reach,views,total_interactions,accounts_engaged,profile_views')
    .eq('account_id', accountId).eq('period_days', dias).gt('reach', 0)
    .order('captured_at', { ascending: false }).limit(8);
  for (const row of (data ?? [])) { if (!bdBroken(row)) return row; }
  return (data && data[0]) ?? null;
}

function engCols(v: Record<string, number> | null): Record<string, number> | null {
  if (!v) return null;
  const out: Record<string, number> = {};
  for (const k of ENG_KEYS) if (k in v) out[k] = v[k] ?? 0;
  return Object.keys(out).length ? out : null;
}

async function gravarEng(sb: any, accountId: string, hoje: string, dias: number, igId: string, token: string, name: string, degraded: string[]) {
  if (dias === 0) {
    let v: Record<string, number> | null = null;
    for (let i = 0; i < 4; i++) {
      v = await coletarEngajamentoConta(igId, token, dias);
      if (!bdBroken(v)) break;
      if (i < 3) await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
    const engC0 = engCols(v);
    if (engC0) await sb.from('engagement_snapshots').upsert(
      { account_id: accountId, captured_at: hoje, period_days: dias, ...engC0 },
      { onConflict: 'account_id,captured_at,period_days' }
    );
    return;
  }
  const { eng, ok } = await coletarEngResiliente(igId, token, dias);
  let merged: Record<string, number> | null = eng ? { ...eng } : null;
  if (!ok) {
    const prev = await carregarUltimoBom(sb, accountId, dias);
    if (prev) {
      merged = merged || {};
      for (const k of ENG_KEYS) if (!(Number(merged[k]) > 0)) merged[k] = prev[k] ?? 0;
      degraded.push(`${name} ${periodLabel(dias)}`);
    } else {
      if (!merged || !(Number(merged.reach) > 0)) { degraded.push(`${name} ${periodLabel(dias)} (sem histórico)`); return; }
    }
  }
  const engC = engCols(merged);
  if (engC) await sb.from('engagement_snapshots').upsert(
    { account_id: accountId, captured_at: hoje, period_days: dias, ...engC },
    { onConflict: 'account_id,captured_at,period_days' }
  );
}

async function coletarStoriesHoje(igId: string, token: string): Promise<Record<string, number>> {
  const hoje = todayBR();
  const zero = { count: 0, shares: 0, replies: 0, reach: 0, interactions: 0, navigation: 0, profile_visits: 0, follows: 0, nav_forward: 0, nav_back: 0, nav_exit: 0, nav_next: 0 };
  try {
    const d = await apiGet(`${igId}/stories`, { fields: 'id,timestamp', access_token: token, limit: '100' });
    const stories = (d.data ?? []).filter((s: any) => s.timestamp && localDate(s.timestamp) === hoje);
    const tot = { ...zero, count: stories.length };
    await Promise.all(stories.map(async (s: any) => {
      try {
        const ins = await apiGet(`${s.id}/insights`, { metric: 'reach,replies,shares,total_interactions,navigation,profile_visits,follows', access_token: token });
        for (const item of ins.data ?? []) {
          const v = item.value ?? (item.values?.[0]?.value ?? 0);
          if (item.name === 'shares') tot.shares += v;
          else if (item.name === 'replies') tot.replies += v;
          else if (item.name === 'reach') tot.reach += v;
          else if (item.name === 'total_interactions') tot.interactions += v;
          else if (item.name === 'navigation') tot.navigation += v;
          else if (item.name === 'profile_visits') tot.profile_visits += v;
          else if (item.name === 'follows') tot.follows += v;
        }
      } catch { /* ignora erro por story */ }
      try {
        const nb = await apiGet(`${s.id}/insights`, { metric: 'navigation', breakdown: 'story_navigation_action_type', access_token: token });
        const results = nb.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
        for (const r of results) {
          const k = (r.dimension_values ?? [null])[0];
          const v = r.value ?? 0;
          if (k === 'tap_forward') tot.nav_forward += v;
          else if (k === 'tap_back') tot.nav_back += v;
          else if (k === 'tap_exit') tot.nav_exit += v;
          else if (k === 'swipe_forward') tot.nav_next += v;
        }
      } catch { /* breakdown opcional */ }
    }));
    return tot;
  } catch { return zero; }
}

async function coletarMidias(igId: string, token: string, dias: number) {
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const hojeDate = new Date(hoje + 'T12:00:00');
  let fromDate: string, toDate: string | null = null;
  if (dias === 0) { fromDate = hoje; toDate = hoje; }
  else if (dias === 1) {
    const d = new Date(hojeDate); d.setDate(d.getDate() - 1);
    fromDate = d.toLocaleDateString('en-CA'); toDate = fromDate;
  } else {
    const d = new Date(hojeDate); d.setDate(d.getDate() - dias);
    fromDate = d.toLocaleDateString('en-CA');
  }
  let posts = 0, reels = 0;
  try {
    const d = await apiGet(`${igId}/media`, {
      fields: 'id,media_product_type,timestamp,owner',
      access_token: token, limit: '100',
    });
    for (const m of (d.data ?? [])) {
      const ownerId = m.owner?.id ?? igId;
      if (ownerId !== igId) continue;
      const produto = m.media_product_type ?? '';
      if (produto === 'STORY') continue;
      if (m.timestamp) {
        const pubDate = localDate(m.timestamp);
        if (pubDate < fromDate) continue;
        if (toDate && pubDate > toDate) continue;
      }
      if (produto === 'REELS') reels++; else posts++;
    }
  } catch { /* ignora conta sem acesso */ }
  return { posts, reels };
}

async function sincronizarCampanhas(sb: any, accountId: string, adAccountId: string, token: string) {
  try {
    const items = await apiGetAll(`act_${adAccountId}/campaigns`, {
      fields: 'id,name,objective,status', access_token: token,
    });
    const rows = items.map((c: any) => ({
      campaign_id: c.id, account_id: accountId,
      name: c.name ?? '', objective: c.objective ?? '',
      status: c.status ?? '', synced_at: todayBR(),
    }));
    if (rows.length) await sb.from('campaigns').upsert(rows, { onConflict: 'campaign_id' });
  } catch { /* sem ads */ }
}

async function coletarAdsPorCampanha(sb: any, adAccountId: string, accountId: string, token: string, dias: number, hoje: string) {
  const until = hoje;
  const d = new Date(hoje + 'T12:00:00'); d.setDate(d.getDate() - dias);
  const since = d.toLocaleDateString('en-CA');
  try {
    const items = await apiGetAll(`act_${adAccountId}/insights`, {
      fields: 'campaign_id,spend,impressions,clicks,reach',
      time_range: JSON.stringify({ since, until }),
      level: 'campaign', access_token: token,
    });
    const rows = items.map((r: any) => ({
      campaign_id: r.campaign_id, account_id: accountId,
      captured_at: hoje, period_days: dias,
      spend: parseFloat(r.spend ?? '0'),
      impressions: parseInt(r.impressions ?? '0'),
      clicks: parseInt(r.clicks ?? '0'),
      reach: parseInt(r.reach ?? '0'),
    }));
    if (rows.length) await sb.from('campaign_insights').upsert(rows, { onConflict: 'campaign_id,account_id,captured_at,period_days' });
  } catch { /* sem dados de ads */ }
}

async function processarConta(sb: any, acc: any, degraded: string[]) {
  const { id: accountId, instagram_id: igId, name, access_token: token } = acc;
  if (!token) { console.log(`⚠ Sem token: ${name}`); return null; }
  const hoje = todayBR();
  console.log(`▶ ${name}`);

  const seguidores = await coletarSeguidores(igId, token);
  await sb.from('daily_snapshots').upsert(
    { account_id: accountId, captured_at: hoje, followers_count: seguidores },
    { onConflict: 'account_id,captured_at' }
  );

  for (let dd = 0; dd < 3; dd++) {
    const dia = brDateMinus(dd);
    const fu = await coletarFollowsDia(igId, dia, token);
    if (fu) {
      await sb.from('daily_snapshots').update({ gained: fu.gained, lost: fu.lost })
        .eq('account_id', accountId).eq('captured_at', dia);
    }
  }

  const stories = await coletarStoriesHoje(igId, token);

  for (const dias of PERIODS) {
    const m = await coletarMidias(igId, token, dias);
    await gravarEng(sb, accountId, hoje, dias, igId, token, name, degraded);
    const row: any = { account_id: accountId, captured_at: hoje, period_days: dias, posts_count: m.posts, reels_count: m.reels };
    if (dias <= 1) {
      row.stories_count = stories.count; row.story_shares = stories.shares; row.story_replies = stories.replies;
      row.story_reach = stories.reach; row.story_interactions = stories.interactions; row.story_navigation = stories.navigation;
      row.story_profile_visits = stories.profile_visits; row.story_follows = stories.follows;
      row.story_nav_forward = stories.nav_forward; row.story_nav_back = stories.nav_back; row.story_nav_exit = stories.nav_exit; row.story_nav_next = stories.nav_next;
    }
    await sb.from('content_snapshots').upsert(row, { onConflict: 'account_id,captured_at,period_days' });
  }

  await gravarEng(sb, accountId, hoje, 99, igId, token, name, degraded);

  const adAccountId = AD_ACCOUNTS[igId];
  if (adAccountId) {
    await sincronizarCampanhas(sb, accountId, adAccountId, token);
    for (const dias of PERIODS) await coletarAdsPorCampanha(sb, adAccountId, accountId, token, dias, hoje);
  }

  const novoToken = await renovarToken(token);
  if (novoToken !== token) {
    await sb.from('accounts').update({ access_token: novoToken }).eq('id', accountId);
  }
  console.log(`✓ ${name}: ${seguidores} seguidores, ${stories.count} stories`);
  return novoToken;
}

async function avisarSuperAdmin(sb: any, degraded: string[]) {
  if (!degraded.length) return;
  const lista = degraded.join(' · ');
  const msg = `⚠️ Coleta IG: a Meta retornou métricas zeradas/inconsistentes (alcance 0 ou likes/comments/saves/shares zerados com interações>0) mesmo após 5 tentativas em: ${lista}. Mantive o valor mais recente válido (não zerei o painel). Verificar token/permissões da Meta.`;
  try {
    await sb.from('data_integrity_checks').insert({
      checked_date: todayBR(), status: 'fail', check_name: 'coleta_zerada',
      detail: msg.slice(0, 900),
    });
  } catch (e) { console.error('alerta DB:', e); }
  if (ALERT_WEBHOOK_URL) {
    try {
      await fetch(ALERT_WEBHOOK_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msg, content: msg }),
      });
    } catch (e) { console.error('webhook:', e); }
  }
}

async function rodarColeta() {
  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: accounts, error } = await sb.from('accounts').select('id,name,instagram_id,access_token');
  if (error) throw error;
  console.log(`Iniciando coleta — ${new Date().toISOString()} — ${accounts.length} contas`);
  const degraded: string[] = [];
  for (const acc of accounts) {
    try { await processarConta(sb, acc, degraded); } catch (e) { console.error(`Erro ${acc.name}:`, e); }
  }
  await avisarSuperAdmin(sb, degraded);
  return { contas: accounts.length, degradados: degraded };
}

// SINCRONO: aguarda a coleta inteira (~120s) e responde no fim. O invocador precisa segurar a
// conexão — o cron usa net.http_post com timeout_milliseconds:=180000 (background não é confiável
// aqui: EdgeRuntime.waitUntil foi morto pela reciclação da instância).
Deno.serve(async (_req: Request) => {
  try {
    const r = await rodarColeta();
    return new Response(JSON.stringify({ ok: true, ts: new Date().toISOString(), ...r }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
