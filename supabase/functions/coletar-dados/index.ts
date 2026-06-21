import { createClient } from 'jsr:@supabase/supabase-js@2';

const GRAPH = 'https://graph.facebook.com/v21.0';
const APP_ID = Deno.env.get('META_APP_ID') ?? '';
const APP_SECRET = Deno.env.get('META_APP_SECRET') ?? '';

const AD_ACCOUNTS: Record<string, string> = {
  '17841401847160442': '591630990582441',
  '17841401284454639': '1523458001735386',
  '17841406451230767': '786453150398609',
  '17841462952561833': '1197997517858139',
  '17841464138609037': '803642218253857',
};

const PERIODS = [0, 1, 7, 14, 30];

function todayBR(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function localDate(ts: string): string {
  return new Date(ts).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

// Data BRT de N dias atrás, no formato YYYY-MM-DD (ancorada ao meio-dia p/ não escorregar de fuso).
function brDateMinus(daysAgo: number): string {
  const dt = new Date(`${todayBR()}T12:00:00-03:00`);
  dt.setDate(dt.getDate() - daysAgo);
  return dt.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

async function apiGet(path: string, params: Record<string, string>): Promise<any> {
  const url = new URL(`${GRAPH}/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`Meta API ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}

// Busca todas as páginas de um endpoint Meta e retorna todos os itens de data[]
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

// Follows/unfollows BRUTOS de um dia (métrica follows_and_unfollows) → { gained, lost } ou null.
// A Meta finaliza essa métrica com atraso (e às vezes para de entregar) — por isso retornamos null
// quando não há dado, e o dashboard cai na variação da contagem ("em consolidação").
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

async function coletarStoriesHoje(igId: string, token: string): Promise<{ count: number; shares: number; replies: number }> {
  const hoje = todayBR();
  try {
    const d = await apiGet(`${igId}/stories`, { fields: 'id,timestamp', access_token: token, limit: '100' });
    const stories = (d.data ?? []).filter((s: any) => {
      if (!s.timestamp) return false;
      return localDate(s.timestamp) === hoje;
    });
    let shares = 0, replies = 0;
    await Promise.all(stories.map(async (s: any) => {
      try {
        const ins = await apiGet(`${s.id}/insights`, { metric: 'replies,shares', access_token: token });
        for (const item of ins.data ?? []) {
          const v = item.value ?? (item.values?.[0]?.value ?? 0);
          if (item.name === 'shares') shares += v;
          if (item.name === 'replies') replies += v;
        }
      } catch { /* ignora erro por story */ }
    }));
    return { count: stories.length, shares, replies };
  } catch { return { count: 0, shares: 0, replies: 0 }; }
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
  let likes = 0, saves = 0, shares = 0, posts = 0, reels = 0;
  try {
    const d = await apiGet(`${igId}/media`, {
      fields: 'id,media_type,media_product_type,timestamp,like_count,owner',
      access_token: token, limit: '100',
    });
    await Promise.all((d.data ?? []).map(async (m: any) => {
      const ownerId = m.owner?.id ?? igId;
      if (ownerId !== igId) return;
      const produto = m.media_product_type ?? '';
      if (produto === 'STORY') return;
      if (m.timestamp) {
        const pubDate = localDate(m.timestamp);
        if (pubDate < fromDate) return;
        if (toDate && pubDate > toDate) return;
      }
      likes += m.like_count ?? 0;
      if (produto === 'REELS') reels++; else posts++;
      try {
        const ins = await apiGet(`${m.id}/insights`, { metric: 'saved,shares', access_token: token });
        for (const item of ins.data ?? []) {
          const v = item.value ?? (item.values?.[0]?.value ?? 0);
          if (item.name === 'saved') saves += v;
          if (item.name === 'shares') shares += v;
        }
      } catch { /* ignora erro por mídia */ }
    }));
  } catch { /* ignora conta sem acesso */ }
  return { likes, saves, shares, posts, reels };
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
    // Busca todas as páginas — sem paginação o Meta API trunca em 25 por padrão
    // fazendo D30 < D14 quando há campanhas extras antigas fora da janela de 14 dias
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

async function processarConta(sb: any, acc: any) {
  const { id: accountId, instagram_id: igId, name, access_token: token } = acc;
  if (!token) { console.log(`⚠ Sem token: ${name}`); return null; }
  const hoje = todayBR();
  console.log(`▶ ${name}`);

  const seguidores = await coletarSeguidores(igId, token);
  await sb.from('daily_snapshots').upsert(
    { account_id: accountId, captured_at: hoje, followers_count: seguidores },
    { onConflict: 'account_id,captured_at' }
  );

  // gained/lost (bruto follows_and_unfollows): re-coleta os últimos 3 dias a cada run, pois a métrica
  // finaliza com atraso (e às vezes a Meta para de entregar). Quando vem, atualiza; quando não, o
  // dashboard usa a variação da contagem ("em consolidação") e isso se auto-corrige quando a Meta volta.
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
    await sb.from('engagement_snapshots').upsert(
      { account_id: accountId, captured_at: hoje, period_days: dias, likes: m.likes, saves: m.saves, shares: m.shares },
      { onConflict: 'account_id,captured_at,period_days' }
    );
    const row: any = { account_id: accountId, captured_at: hoje, period_days: dias, posts_count: m.posts, reels_count: m.reels };
    if (dias <= 1) { row.stories_count = stories.count; row.story_shares = stories.shares; row.story_replies = stories.replies; }
    await sb.from('content_snapshots').upsert(row, { onConflict: 'account_id,captured_at,period_days' });
  }

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

Deno.serve(async (req: Request) => {
  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  try {
    const { data: accounts, error } = await sb.from('accounts').select('id,name,instagram_id,access_token');
    if (error) throw error;
    console.log(`Iniciando coleta — ${new Date().toISOString()} — ${accounts.length} contas`);
    for (const acc of accounts) {
      try { await processarConta(sb, acc); } catch (e) { console.error(`Erro ${acc.name}:`, e); }
    }
    return new Response(JSON.stringify({ ok: true, ts: new Date().toISOString(), contas: accounts.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
});
