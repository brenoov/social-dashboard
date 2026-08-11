import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const BLING_BASE = 'https://api.bling.com.br/Api/v3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Lista de caminhos permitidos do Bling.
//
// Por que existe: este proxy chama o Bling com o token da EMPRESA, que enxerga
// o ERP inteiro (pedidos, clientes, produtos, estoque, financeiro). Sem esta
// lista, qualquer caminho da API do Bling seria alcançável por aqui. Então só
// liberamos os caminhos que as telas realmente usam hoje.
//
// Quem usa cada caminho:
//   - pedidos/vendas e pedidos/vendas/{id} → Gestão à Vista, Análise de Vendas,
//     e os robôs do coletor (gestor-comercial, relatorios-comerciais).
//   - vendedores/{id}                      → Gestão à Vista.
//   - produtos e produtos/{id}             → Gestão Comercial e os robôs
//     (baixar-fotos-bling, foto-produto).
//   - estoques/saldos                      → robô relatorios-comerciais.
//   - nfe, nfe/{id}, nfce, nfce/{id}       → robô notas-dos-pedidos, que
//     descobre em que dia a venda foi FATURADA. O pedido sozinho não conta essa
//     história: ele guarda o dia em que foi gerado, e a nota do Atacado costuma
//     sair no dia seguinte. Só leitura — nada aqui emite nem cancela nota.
//
// O trecho do id aceita letras, números, hífen e underline. Não aceita ponto
// nem barra, então não dá pra escapar do caminho (ex.: "produtos/../oauth/token").
// Ao adicionar uma tela nova que use um caminho novo do Bling, inclua o caminho
// aqui — senão a tela recebe 403.
const CAMINHOS_PERMITIDOS: RegExp[] = [
  /^pedidos\/vendas$/,
  /^pedidos\/vendas\/[A-Za-z0-9_-]+$/,
  /^vendedores\/[A-Za-z0-9_-]+$/,
  /^produtos$/,
  /^produtos\/[A-Za-z0-9_-]+$/,
  /^estoques\/saldos$/,
  /^nfe$/,
  /^nfe\/[A-Za-z0-9_-]+$/,
  /^nfce$/,
  /^nfce\/[A-Za-z0-9_-]+$/,
];

function caminhoPermitido(endpoint: string): boolean {
  return CAMINHOS_PERMITIDOS.some((re) => re.test(endpoint));
}

async function getValidToken(sb: ReturnType<typeof createClient>): Promise<string> {
  const { data, error } = await sb
    .from('bling_tokens')
    .select('*')
    .order('id', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) throw new Error('No Bling token found');

  if (new Date(data.expires_at) > new Date(Date.now() + 5 * 60 * 1000)) {
    return data.access_token;
  }

  const creds = btoa(`${data.client_id}:${data.client_secret}`);
  const resp = await fetch(`${BLING_BASE}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${creds}`,
    },
    body: `grant_type=refresh_token&refresh_token=${data.refresh_token}`,
  });

  if (!resp.ok) throw new Error(`Token refresh failed: ${await resp.text()}`);

  const tokens = await resp.json();

  await sb.from('bling_tokens').update({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', data.id);

  return tokens.access_token;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    // Quem está chamando? Resolvemos o usuário pelo JWT de quem chamou.
    // Cuidado: a chave anon é um JWT válido do projeto e está publicada no site,
    // então "ter um JWT" não basta — precisa ser um JWT de USUÁRIO logado.
    // auth.getUser() só devolve usuário nesse caso; com a anon key devolve nada.
    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'nao autenticado' }, 401);

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Este proxy alimenta duas áreas: Vendas ('sales' → Gestão à Vista e
    // Análise de Vendas) e Gestão Comercial ('gestor'). Quem tem qualquer uma
    // das duas pode consultar; admin passa direto. Tem gente com 'sales' e sem
    // 'gestor', então exigir só uma das chaves derrubaria telas legítimas.
    const { data: prof } = await sb.from('profiles').select('role, features').eq('id', user.id).single();
    const features = Array.isArray(prof?.features) ? prof.features : [];
    const allowed = !!prof && (prof.role === 'admin' || features.includes('sales') || features.includes('gestor'));
    if (!allowed) return json({ error: 'sem permissao' }, 403);

    const { endpoint, params } = await req.json();

    if (!endpoint || typeof endpoint !== 'string') {
      return json({ error: 'endpoint required' }, 400);
    }

    if (!caminhoPermitido(endpoint)) {
      return json({ error: 'endpoint nao permitido' }, 403);
    }

    const token = await getValidToken(sb);

    const url = new URL(`${BLING_BASE}/${endpoint}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null) continue;
        if (Array.isArray(v)) {
          for (const item of v) url.searchParams.append(k, String(item));
        } else {
          url.searchParams.set(k, String(v));
        }
      }
    }

    const blingResp = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    const text = await blingResp.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    return new Response(JSON.stringify(data), {
      status: blingResp.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
