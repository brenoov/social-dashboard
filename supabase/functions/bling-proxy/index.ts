import { createClient } from 'jsr:@supabase/supabase-js@2';
// A regra de quais canais de venda a pessoa vê. Mora em `_shared` porque as duas
// telas de venda usam a MESMA — ver o cabeçalho do módulo.
import { canaisDoEscopo, recortarRespostaDoBling } from '../_shared/canais-de-venda-permitidos.js';

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
    const { data: prof } = await sb
      .from('profiles')
      .select('role, features, is_superadmin, escopo_por_equipe')
      .eq('id', user.id)
      .single();
    const features = Array.isArray(prof?.features) ? prof.features : [];
    const allowed = !!prof && (prof.role === 'admin' || features.includes('sales') || features.includes('gestor'));
    if (!allowed) return json({ error: 'sem permissao' }, 403);

    // ── DE QUAIS CANAIS ESSA PESSOA VÊ O FATURAMENTO (B1f, 13/08/2026) ───────
    //
    // Até aqui a edge perguntava só "essa pessoa PODE?" e devolvia os pedidos de
    // TODOS os canais. Quem estava limitada a uma loja via o faturamento das
    // outras — bastava abrir o console, porque o recorte existia só na tela.
    //
    // Quem decide é o módulo puro, não um `if` reescrito aqui: é o jeito de a
    // tela e a edge não contarem histórias diferentes sobre a mesma pessoa.
    // O `if` abaixo é só economia de consulta para os 16 perfis não limitados —
    // ele não pode mudar a resposta, porque a regra devolve `null` de qualquer
    // jeito quando `escopo_por_equipe` não é `true`.
    let times: { id: string; canal_loja_id: number | null }[] = [];
    let membros: { equipe_id: string; profile_id: string }[] = [];
    if (prof.escopo_por_equipe === true) {
      const { data: m } = await sb.from('equipes_membros').select('equipe_id, profile_id').eq('profile_id', user.id);
      membros = m || [];
      const ids = membros.map((x) => x.equipe_id);
      if (ids.length) {
        const { data: t } = await sb.from('equipes').select('id, canal_loja_id').in('id', ids);
        times = t || [];
      }
    }
    // `null` = vê todos os canais (quase todo mundo, e a conta de serviço dos
    // robôs). `[]` = não vê canal nenhum, que é DIFERENTE de `null`.
    const canais = canaisDoEscopo({
      isSuperadmin: !!prof.is_superadmin,
      escopoPorEquipe: prof.escopo_por_equipe === true,
      meuId: user.id,
      times,
      membros,
    });

    const { endpoint, params } = await req.json();

    if (!endpoint || typeof endpoint !== 'string') {
      return json({ error: 'endpoint required' }, 400);
    }

    if (!caminhoPermitido(endpoint)) {
      return json({ error: 'endpoint nao permitido' }, 403);
    }

    const token = await getValidToken(sb);

    const chamarBling = async (paramsDaVez: Record<string, unknown> | null) => {
      const url = new URL(`${BLING_BASE}/${endpoint}`);
      if (paramsDaVez) {
        for (const [k, v] of Object.entries(paramsDaVez)) {
          if (v === undefined || v === null) continue;
          if (Array.isArray(v)) {
            for (const item of v) url.searchParams.append(k, String(item));
          } else {
            url.searchParams.set(k, String(v));
          }
        }
      }
      const resp = await fetch(url.toString(), { headers: { 'Authorization': `Bearer ${token}` } });
      const text = await resp.text();
      let corpo;
      try { corpo = JSON.parse(text); } catch { corpo = { raw: text }; }
      return { status: resp.status, corpo };
    };

    const limitada = Array.isArray(canais);
    const devolver = (corpo: unknown, status = 200) =>
      new Response(JSON.stringify(corpo), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    // ── A LISTA DE PEDIDOS, para quem está limitada a uma loja ───────────────
    //
    // AQUI MORA O CUIDADO QUE QUASE VIROU DEFEITO. O primeiro jeito óbvio é
    // pedir a lista inteira ao Bling e jogar fora o que não é dela. Só que a
    // tela pagina assim (`paginasDoBling`, src/compartilhado/chamada-do-bling.js):
    // pede de 100 em 100 e PARA quando a página vem com menos de 100. Jogando
    // fora depois, a página de 100 chegaria com 30 na tela dela e a busca
    // pararia na primeira página — a vendedora veria MENOS venda da PRÓPRIA
    // loja, calada. Número errado é pior que tela travada.
    //
    // Então quem recorta é o Bling: `idLoja` (no singular). Medido contra a API
    // em 13/08/2026, com a conta de serviço: `idLoja` é honrado, e nem
    // `idsLojas[]` nem `idsLojas` nem `loja` são — os três voltam com tudo.
    //
    // `idLoja` aceita UMA loja por chamada, então quem estiver em dois times com
    // canais diferentes vira duas chamadas, e as páginas se somam. Isso continua
    // certo com a parada da tela: uma página só fica curta quando aquela loja
    // acabou, então a soma só fica curta quando TODAS acabaram. Hoje as duas
    // pessoas limitadas têm um canal cada (medido em 13/08) — o laço existe para
    // o dia em que alguém tiver dois, não para hoje.
    if (limitada && endpoint === 'pedidos/vendas') {
      // Sem canal nenhum não se pergunta ao Bling: a resposta já é conhecida, e
      // é vazia. A tela explica o porquê (`fraseDoRecorte`).
      if (!canais.length) return devolver({ data: [] });

      const pedidos: unknown[] = [];
      for (const canal of canais) {
        const r = await chamarBling({ ...(params || {}), idLoja: canal });
        // Erro do Bling sobe como veio: a tela sabe distinguir "deu ruim" de
        // "não vendeu nada", e essa diferença foi cara de conquistar.
        if (r.status >= 400) return devolver(r.corpo, r.status);
        if (Array.isArray(r.corpo?.data)) pedidos.push(...r.corpo.data);
      }

      // CINTO E SUSPENSÓRIO: recorta de novo, agora do nosso lado. Se isto
      // tirar alguma coisa, quer dizer que o `idLoja` deixou de ser honrado —
      // e aí a resposta certa é um erro visível, não uma lista que parece boa e
      // está torta pela paginação.
      const conferido = recortarRespostaDoBling(endpoint, { data: pedidos }, canais);
      if (conferido.corpo.data.length !== pedidos.length) {
        return devolver({
          error: 'O filtro de loja do Bling parou de funcionar. Nao vou devolver '
            + 'uma lista pela metade: avise quem cuida do sistema.',
        }, 502);
      }
      return devolver(conferido.corpo);
    }

    // ── Todo o resto ────────────────────────────────────────────────────────
    const r = await chamarBling(params);
    const { corpo, negado } = recortarRespostaDoBling(endpoint, r.corpo, canais);
    if (negado) return json({ error: 'sem permissao para este canal' }, 403);
    return devolver(corpo, r.status);
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
