// custo-openai — devolve o GASTO REAL da conta OpenAI (Costs API), pro painel
// Claude Status mostrar o número verdadeiro das tarefas que criam imagem.
//
// Por que existe: a Fábrica gera criativo com gpt-image-2, que é API PAGA da
// OpenAI, e até 18/08/2026 a tela afirmava que isso custava R$ 0. O custo por
// execução continua desconhecido (ninguém precificou o motor), mas o TOTAL
// cobrado é conhecido — é o que esta função traz.
//
// Segurança: igual à custo-anthropic. verify_jwt=true + checagem de ADMIN (dado
// de faturamento é só pra admin), e a chave (sk-admin) vive na tabela
// segredos_de_cron, lida aqui pelo service role. O front nunca a vê.
//
// ⚠️ A PEGADINHA QUE MUDA O VALOR EM 100×: na Anthropic o `amount` vem em
// CENTAVOS de dólar; na OpenAI, `amount.value` vem em DÓLARES. Medido ao vivo em
// 18/08/2026: 60 dias somam US$ 98,71 — bate com a medição feita pela chave do
// dono. Não copie a divisão por 100 da outra função.
//
// O que a OpenAI dá de melhor que a Anthropic: custo REAL por chave de API
// (group_by=api_key_id). Lá o "quem gastou" é rateado por uso; aqui é a conta de
// verdade. Por isso este retorno usa `usd`, e não `usdEstimado`.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CAMBIO = 5.5; // US$ -> R$ (mesmo valor da custo-anthropic e dos logs dos robôs)
const API = 'https://api.openai.com/v1/organization';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Lê a chave admin do segredo (service role). Fail-closed.
async function lerChaveAdmin(sb: ReturnType<typeof createClient>): Promise<string> {
  const { data, error } = await sb.from('segredos_de_cron').select('segredo').eq('nome', 'openai_admin_key').single();
  if (error || !data?.segredo) throw new Error('chave_admin_nao_configurada');
  return String(data.segredo);
}

// Uma varredura da Costs API cobrindo [inicio, fim) em baldes de 1 dia.
// `limit` tem teto de 180 baldes; ainda assim paginamos com next_page, porque
// truncar em silêncio é exatamente o defeito que este painel existe para evitar.
async function varrer(chave: string, inicio: number, fim: number, agrupar?: string) {
  const baldes: Array<{ data: string; results: any[] }> = [];
  let page: string | null = null;
  let guarda = 0; // trava anti-loop
  do {
    const url = new URL(`${API}/costs`);
    url.searchParams.set('start_time', String(inicio));
    url.searchParams.set('end_time', String(fim));
    url.searchParams.set('bucket_width', '1d');
    url.searchParams.set('limit', '180');
    if (agrupar) url.searchParams.append('group_by[]', agrupar);
    if (page) url.searchParams.set('page', page);
    const r = await fetch(url, { headers: { Authorization: `Bearer ${chave}` } });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`costs_http_${r.status}: ${txt.slice(0, 200)}`);
    }
    const j = await r.json();
    for (const b of (j.data ?? [])) {
      baldes.push({ data: String(b.start_time_iso ?? '').slice(0, 10) || isoDoUnix(b.start_time), results: b.results ?? [] });
    }
    page = j.has_more ? j.next_page : null;
  } while (page && ++guarda < 50);
  return baldes;
}

const isoDoUnix = (s: unknown) => (s == null ? '' : new Date(Number(s) * 1000).toISOString().slice(0, 10));
// DÓLARES, não centavos. Ver o aviso no topo.
const valor = (x: any) => Number(x?.amount?.value ?? 0);

// Nome de cada chave de API (key_… → "FabricadeAnuncios"). Sem isso o painel
// mostraria um identificador que não diz nada a quem lê.
async function nomesDasChaves(chave: string): Promise<Record<string, string>> {
  const nomes: Record<string, string> = {};
  try {
    const rp = await fetch(`${API}/projects?limit=50`, { headers: { Authorization: `Bearer ${chave}` } });
    if (!rp.ok) return nomes;
    const jp = await rp.json();
    for (const p of (jp.data ?? [])) {
      const rk = await fetch(`${API}/projects/${p.id}/api_keys?limit=100`, { headers: { Authorization: `Bearer ${chave}` } });
      if (!rk.ok) continue;
      const jk = await rk.json();
      for (const k of (jk.data ?? [])) if (k?.id) nomes[k.id] = k.name || k.id;
    }
  } catch { /* segue sem nome: o id ainda identifica */ }
  return nomes;
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

    // 3) janela: mesma régua da custo-anthropic — padrão 30 dias, teto 90, e o
    // fim é meia-noite UTC de amanhã, para o dia de hoje entrar inteiro.
    let diasRaw = new URL(req.url).searchParams.get('dias');
    if (!diasRaw) {
      try { const body = await req.json(); if (body && body.dias != null) diasRaw = String(body.dias); } catch { /* sem corpo */ }
    }
    const dias = Math.min(90, Math.max(1, Number(diasRaw || '30')));
    const agora = new Date();
    const fim = Math.floor(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate() + 1) / 1000);
    const inicio = fim - dias * 86400;

    const chave = await lerChaveAdmin(sb);

    // O total é obrigatório: se ele falhar, a função devolve erro em vez de zero.
    const baldes = await varrer(chave, inicio, fim);
    const porDia = baldes.map((b) => ({ data: b.data, usd: b.results.reduce((s: number, x: any) => s + valor(x), 0) }));
    const totalUsd = porDia.reduce((s, d) => s + d.usd, 0);

    // Os dois detalhamentos são acessórios: se falharem, viram lista vazia e a
    // tela diz "indisponível" — nunca inventam número, e não derrubam o total.
    const detalhe = async (agrupar: string, campo: string) => {
      try {
        const bs = await varrer(chave, inicio, fim, agrupar);
        const acc: Record<string, number> = {};
        for (const b of bs) for (const x of b.results) {
          const k = String(x?.[campo] ?? '(sem nome)');
          acc[k] = (acc[k] ?? 0) + valor(x);
        }
        return acc;
      } catch { return {}; }
    };

    const [catAcc, chaveAcc, nomes] = await Promise.all([
      detalhe('line_item', 'line_item'),
      detalhe('api_key_id', 'api_key_id'),
      nomesDasChaves(chave),
    ]);

    const porCategoria = Object.entries(catAcc)
      .map(([item, usd]) => ({ item, usd: Number(usd.toFixed(6)) }))
      .filter((c) => c.usd > 0)
      .sort((a, b) => b.usd - a.usd);

    const porChave = Object.entries(chaveAcc)
      .map(([id, usd]) => ({ nome: nomes[id] || id, usd: Number(usd.toFixed(6)) }))
      .filter((c) => c.usd > 0)
      .sort((a, b) => b.usd - a.usd);

    return json({
      desde: isoDoUnix(inicio),
      ate: isoDoUnix(fim),
      cambio: CAMBIO,
      totalUsd: Number(totalUsd.toFixed(4)),
      totalBrl: Number((totalUsd * CAMBIO).toFixed(2)),
      dias: porDia,
      porCategoria, // [{item, usd}] — real, por modelo e tipo de token
      porChave,     // [{nome, usd}] — REAL por chave (não é rateio, ao contrário da Anthropic)
    });
  } catch (e) {
    return json({ error: 'falha', detalhe: e instanceof Error ? e.message : String(e) }, 500);
  }
});
