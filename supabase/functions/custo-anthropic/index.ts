// custo-anthropic — devolve o GASTO REAL da conta Anthropic (Cost Report API), pro painel
// Claude Status mostrar o número verdadeiro, não só o que os robôs anotaram em ia_execucoes.
//
// Segurança:
//  - verify_jwt=true + checagem de ADMIN (dado de faturamento é só pra admin).
//  - a chave admin (sk-ant-admin) NUNCA está no front (repo público): vive na tabela
//    segredos_de_cron, lida aqui pelo service role. O front só chama esta função.
//
// A API de custo tem uma pegadinha: os buckets vêm da data inicial PRA FRENTE e o `limit`
// tem teto (~31). Pedir demais/ordem errada trunca silenciosamente (aprendido medindo).
// Por isso paginamos com next_page até cobrir a janela toda.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CAMBIO = 5.5; // US$ -> R$ (mesmo valor usado no painel e nos logs dos robôs)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Lê a chave admin do segredo (service role). Fail-closed.
async function lerChaveAdmin(sb: ReturnType<typeof createClient>): Promise<string> {
  const { data, error } = await sb.from('segredos_de_cron').select('segredo').eq('nome', 'anthropic_admin_key').single();
  if (error || !data?.segredo) throw new Error('chave_admin_nao_configurada');
  return String(data.segredo);
}

// Chama a Cost Report API cobrindo [inicio, fim), paginando com next_page.
async function buscarCusto(chave: string, inicioISO: string, fimISO: string) {
  const dias: Array<{ data: string; usd: number }> = [];
  let page: string | null = null;
  let guarda = 0; // trava anti-loop
  do {
    const url = new URL('https://api.anthropic.com/v1/organizations/cost_report');
    url.searchParams.set('starting_at', inicioISO);
    url.searchParams.set('ending_at', fimISO);
    url.searchParams.set('bucket_width', '1d');
    url.searchParams.set('limit', '31');
    if (page) url.searchParams.set('page', page);
    const r = await fetch(url, { headers: { 'x-api-key': chave, 'anthropic-version': '2023-06-01' } });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`cost_report_http_${r.status}: ${txt.slice(0, 200)}`);
    }
    const j = await r.json();
    for (const b of (j.data ?? [])) {
      // amount vem em CENTAVOS de dólar (decimal string). Somamos por dia.
      const centavos = (b.results ?? []).reduce((s: number, x: any) => s + Number(x.amount ?? 0), 0);
      dias.push({ data: String(b.starting_at ?? '').slice(0, 10), usd: centavos / 100 });
    }
    page = j.has_more ? j.next_page : null;
  } while (page && ++guarda < 50);

  const totalUsd = dias.reduce((s, d) => s + d.usd, 0);
  return { dias, totalUsd };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    // 1) quem chama? (auth.getUser só resolve com JWT de usuário; anon key não resolve)
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'nao_autenticado' }, 401);

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    // 2) só ADMIN vê faturamento
    const { data: prof } = await sb.from('profiles').select('role').eq('id', user.id).single();
    if (!prof || prof.role !== 'admin') return json({ error: 'sem_permissao' }, 403);

    // 3) janela: dias vem do corpo (sbClient.functions.invoke manda POST) OU da query.
    // Padrão 30, teto 90 (a Cost API pagina de 31 em 31; 90 já cobre bem o painel).
    let diasRaw = new URL(req.url).searchParams.get('dias');
    if (!diasRaw) {
      try { const body = await req.json(); if (body && body.dias != null) diasRaw = String(body.dias); } catch { /* sem corpo */ }
    }
    const dias = Math.min(90, Math.max(1, Number(diasRaw || '30')));
    const agora = new Date();
    const fim = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate() + 1)); // até amanhã 00:00 UTC (inclui hoje)
    const inicio = new Date(fim.getTime() - dias * 86400000);
    const inicioISO = inicio.toISOString().replace(/\.\d+Z$/, 'Z');
    const fimISO = fim.toISOString().replace(/\.\d+Z$/, 'Z');

    const chave = await lerChaveAdmin(sb);
    const { dias: buckets, totalUsd } = await buscarCusto(chave, inicioISO, fimISO);

    return json({
      desde: inicioISO.slice(0, 10),
      ate: fimISO.slice(0, 10),
      cambio: CAMBIO,
      totalUsd: Number(totalUsd.toFixed(4)),
      totalBrl: Number((totalUsd * CAMBIO).toFixed(2)),
      dias: buckets,
    });
  } catch (e) {
    return json({ error: 'falha', detalhe: e instanceof Error ? e.message : String(e) }, 500);
  }
});
