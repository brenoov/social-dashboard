// insights-ao-vivo — devolve os KPIs EXATOS da Meta para a tela de Redes Sociais.
// O token da conta é lido no servidor (accounts.access_token) e NUNCA é retornado ao front,
// e vai no header Authorization (não na URL). Exige USUÁRIO autenticado (não a chave anon pública).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const GRAPH = 'https://graph.facebook.com/v21.0'

async function apiGet(path: string, params: Record<string, string>, token: string): Promise<any> {
  const url = new URL(`${GRAPH}/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
  return await r.json()
}

Deno.serve(async (req) => {
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // AUTORIZAÇÃO: exige um usuário logado de verdade. A chave anon é pública, então sem esta
    // checagem qualquer um poderia pedir insights de qualquer conta. verify_jwt sozinho aceita a anon.
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: { user } } = await sb.auth.getUser(jwt)
    if (!user) return Response.json({ meta_erro: 'não autorizado' }, { status: 401 })

    // AUTORIZAÇÃO por permissão (não por dono — não há dono por conta neste app; contas são da org).
    // Mesma regra da tela: hasPermission('tool:social') = role 'admin' OU features inclui 'social'.
    const { data: perfil } = await sb.from('profiles').select('role,features').eq('id', user.id).single()
    const podeSocial = !!perfil && (perfil.role === 'admin' || (perfil.features ?? []).includes('social'))
    if (!podeSocial) return Response.json({ meta_erro: 'sem acesso' }, { status: 403 })

    const { account_id, engSince, engUntil, folSince, folUntil } = await req.json()
    const { data: acc } = await sb.from('accounts').select('instagram_id,access_token').eq('id', account_id).single()
    if (!acc) return Response.json({ meta_erro: 'conta não encontrada' }, { status: 404 })
    const ig = acc.instagram_id as string
    const token = acc.access_token as string
    const out: any = { novos: {}, engajamento: {} }

    // Total de seguidores — valor ATUAL
    const f = await apiGet(`${ig}`, { fields: 'followers_count' }, token)
    out.followers_count = f.followers_count ?? null

    // Engajamento — janela do período (mês-calendário)
    const eng = await apiGet(`${ig}/insights`, {
      metric: 'views,reach,total_interactions,profile_views', period: 'day', metric_type: 'total_value',
      since: String(engSince), until: String(engUntil),
    }, token)
    const em: Record<string, number> = {}
    for (const it of (eng.data ?? [])) em[it.name] = it.total_value?.value ?? 0
    out.engajamento = { views: em.views ?? 0, reach: em.reach ?? 0, interacoes: em.total_interactions ?? 0, visitas: em.profile_views ?? 0 }

    // Novos seguidores — janela deslocada -1 dia; FOLLOWER=seguiu, NON_FOLLOWER=deixou
    const fu = await apiGet(`${ig}/insights`, {
      metric: 'follows_and_unfollows', period: 'day', metric_type: 'total_value', breakdown: 'follow_type',
      since: String(folSince), until: String(folUntil),
    }, token)
    let seguiu = 0, deixou = 0
    for (const r of (fu.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [])) {
      const dv = (r.dimension_values ?? [null])[0]
      if (dv === 'FOLLOWER') seguiu = r.value
      else if (dv === 'NON_FOLLOWER') deixou = r.value
    }
    out.novos = { seguiu, deixou, total: seguiu - deixou }

    if (eng.error || fu.error) out.meta_erro = 'meta_incompleto'
    return Response.json(out)
  } catch (e) {
    console.error('insights-ao-vivo erro:', e)
    return Response.json({ meta_erro: 'erro interno' }, { status: 500 })
  }
})
