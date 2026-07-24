// supabase/functions/enviar-push-vendas/index.ts
// Cron 22h BRT: agrega vendas do dia (hoje vs ontem) por canal e envia UM push
// consolidado a todas as inscrições push_subs. Envia "parcial" se o Bling falhar.
//
// Dados do Bling:
//  - Lista `pedidos/vendas` (barata) -> faturamento (R$) e nº de vendas, EXATOS,
//    com loja.id por pedido.
//  - Itens por pedido: o endpoint de lista NÃO traz itens. Lemos a contagem já
//    salva em `bling_pedido_vendedor.qtd_itens` (cache que a Gestão à Vista popula)
//    e só buscamos o detalhe `pedidos/vendas/{id}` dos pedidos SEM cache — com
//    concorrência e ORÇAMENTO DE TEMPO, pra nunca estourar o limite da função.
//    O que buscamos é regravado no cache (auto-aquece p/ as próximas noites).
//
// Auth do Bling: lemos `bling_tokens` direto (service role), SÓ LEITURA — não
// fazemos refresh aqui pra não competir com o bling-proxy (refresh token é
// single-use). Se o token estiver vencido às 22h, mandamos "dados parciais".
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';
import { agregarVendasPorCanal, montarCorpo } from '../_shared/vendas-do-dia.js';
import { exigirSegredoDeCron } from '../_shared/segredo-de-cron.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BLING_BASE = 'https://api.bling.com.br/Api/v3';

// Orçamento p/ a fase de detalhamento de itens (garantia de não estourar o tempo).
const ITENS_BUDGET_MS = 90_000;   // teto de tempo total buscando detalhes
const ITENS_CONCORRENCIA = 6;     // chamadas simultâneas ao Bling

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

// Datas em BRT (UTC-3, o Brasil não tem mais horário de verão) como YYYY-MM-DD.
function brtDatas(): { hoje: string; ontem: string } {
  const nowBrt = new Date(Date.now() - 3 * 3600 * 1000);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  const ontem = new Date(nowBrt);
  ontem.setUTCDate(ontem.getUTCDate() - 1);
  return { hoje: iso(nowBrt), ontem: iso(ontem) };
}

// Lê o token do Bling do banco. SÓ LEITURA (sem refresh). Retorna null se vencido.
async function lerTokenBling(sb: ReturnType<typeof createClient>): Promise<string | null> {
  const { data } = await sb.from('bling_tokens').select('access_token, expires_at')
    .order('id', { ascending: false }).limit(1).single();
  if (!data?.access_token) return null;
  if (new Date(data.expires_at) <= new Date(Date.now() + 60 * 1000)) return null; // vencido/quase
  return data.access_token as string;
}

async function blingGet(token: string, endpoint: string, params: Record<string, unknown> = {}) {
  const url = new URL(`${BLING_BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) for (const it of v) url.searchParams.append(k, String(it));
    else url.searchParams.set(k, String(v));
  }
  const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`bling ${endpoint} -> ${r.status}`);
  return r.json();
}

// Lista pedidos de vendas (situação 9 = atendido/finalizado) num dia, paginando.
async function listarPedidos(token: string, dia: string) {
  const all: any[] = [];
  for (let page = 1; page <= 10; page++) {
    const resp = await blingGet(token, 'pedidos/vendas', {
      dataInicial: dia, dataFinal: dia, 'idsSituacoes[]': 9, pagina: page, limite: 100,
    });
    const d = resp?.data;
    if (!Array.isArray(d) || d.length === 0) break;
    all.push(...d);
    if (d.length < 100) break;
  }
  return all;
}

// Roda `tarefas` com concorrência limitada e um orçamento de tempo global.
// Retorna { ok: resultados[], estourou: boolean } — estourou=true se o tempo
// acabou antes de terminar tudo.
async function comOrcamento<T>(itens: T[], limite: number, budgetMs: number, fn: (t: T) => Promise<void>) {
  const inicio = Date.now();
  let i = 0;
  let estourou = false;
  async function worker() {
    while (i < itens.length) {
      if (Date.now() - inicio > budgetMs) { estourou = true; return; }
      const idx = i++;
      try { await fn(itens[idx]); } catch { /* pedido isolado falhou; segue */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, worker));
  return { estourou };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  // Auth self-contained (não depende do verify_jwt do gateway): o pg_cron manda
  // `Authorization: Bearer <segredo>` lido da tabela segredos_de_cron. Fail-closed.
  const negado = await exigirSegredoDeCron(req, 'enviar-push-vendas');
  if (negado) return negado;

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // VAPID também vem de segredos_de_cron (service role) — nada de env/secret manual.
  const { data: segr } = await sb.from('segredos_de_cron').select('nome, segredo')
    .in('nome', ['vapid_public_key', 'vapid_private_key', 'vapid_subject']);
  const seg = Object.fromEntries((segr || []).map((r: any) => [r.nome, r.segredo]));
  if (!seg.vapid_public_key || !seg.vapid_private_key) return json({ error: 'vapid_nao_configurado' }, 500);
  webpush.setVapidDetails(seg.vapid_subject || 'mailto:breno@rbvcompany.com', seg.vapid_public_key, seg.vapid_private_key);

  const { hoje, ontem } = brtDatas();

  let parcial = false;
  const token = await lerTokenBling(sb);
  let pedHoje: any[] = [];
  let pedOntem: any[] = [];
  if (!token) {
    parcial = true; // sem token válido -> manda o que der (tudo zero) marcando parcial
  } else {
    try {
      [pedHoje, pedOntem] = await Promise.all([listarPedidos(token, hoje), listarPedidos(token, ontem)]);
    } catch (_e) {
      parcial = true;
    }
  }

  // ── Contagem de itens por pedido: cache no banco + detalhe só do que falta ──
  const todos = [...pedHoje, ...pedOntem];
  const ids = todos.map((p) => parseInt(p.id)).filter(Boolean);
  const cache = new Map<number, number>();
  if (ids.length) {
    // lê em blocos pra não estourar o tamanho do IN
    for (let i = 0; i < ids.length; i += 500) {
      const bloco = ids.slice(i, i + 500);
      const { data } = await sb.from('bling_pedido_vendedor')
        .select('pedido_id, qtd_itens').in('pedido_id', bloco);
      for (const r of (data || [])) if (r.qtd_itens != null) cache.set(r.pedido_id, r.qtd_itens);
    }
  }

  const faltantes = token ? todos.filter((p) => !cache.has(parseInt(p.id))) : [];
  const novos: { pedido_id: number; qtd_itens: number }[] = [];
  if (faltantes.length && token) {
    const { estourou } = await comOrcamento(faltantes, ITENS_CONCORRENCIA, ITENS_BUDGET_MS, async (p) => {
      const det = await blingGet(token, `pedidos/vendas/${p.id}`);
      const qtd = Array.isArray(det?.data?.itens) ? det.data.itens.length : 0;
      const pid = parseInt(p.id);
      cache.set(pid, qtd);
      novos.push({ pedido_id: pid, qtd_itens: qtd });
    });
    if (estourou) parcial = true; // não deu tempo de detalhar tudo -> marca parcial
    // regrava o que buscou (auto-aquece o cache pras próximas noites)
    if (novos.length) await sb.from('bling_pedido_vendedor').upsert(novos, { onConflict: 'pedido_id' });
  }

  const normalizar = (p: any) => ({
    loja_id: p.loja?.id ?? p.loja_id ?? null,
    total: Number(p.total) || 0,
    itens: cache.get(parseInt(p.id)) || 0,
  });

  const { data: lojas } = await sb.from('bling_lojas').select('loja_id,nome');
  const lojasNorm = (lojas || []).map((l: any) => ({ loja_id: l.loja_id, nome: l.nome }));
  const agg = agregarVendasPorCanal({
    pedidosHoje: pedHoje.map(normalizar),
    pedidosOntem: pedOntem.map(normalizar),
    lojas: lojasNorm,
  });
  const payload = JSON.stringify(montarCorpo(agg, { parcial }));

  // ── Envio a todas as inscrições, podando as mortas (410/404) ──
  const { data: subs } = await sb.from('push_subs').select('*');
  let enviados = 0, podados = 0;
  for (const s of (subs || [])) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      );
      enviados++;
    } catch (err: any) {
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await sb.from('push_subs').delete().eq('endpoint', s.endpoint);
        podados++;
      }
    }
  }

  return json({ ok: true, parcial, hoje, ontem, pedidos: todos.length, detalhados: novos.length, enviados, podados, total: agg.total });
});
