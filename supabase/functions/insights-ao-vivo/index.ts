// insights-ao-vivo — devolve os KPIs EXATOS da Meta para a tela de Redes Sociais.
// O token é lido no servidor (accounts.access_token) e NUNCA é retornado ao front.
// Chamadas AGREGADAS (metric_type=total_value sobre since/until). Janelas vêm do front
// (engajamento = mês-calendário; follows = a mesma janela deslocada -1 dia — offset da Meta).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const GRAPH = 'https://graph.facebook.com/v21.0'

async function apiGet(path: string, params: Record<string, string>): Promise<any> {
  const url = new URL(`${GRAPH}/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const r = await fetch(url.toString())
  return await r.json()
}

Deno.serve(async (req) => {
  try {
    const { account_id, engSince, engUntil, folSince, folUntil } = await req.json()
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: acc } = await sb.from('accounts').select('instagram_id,access_token').eq('id', account_id).single()
    if (!acc) return Response.json({ meta_erro: 'conta não encontrada' }, { status: 404 })
    const ig = acc.instagram_id as string
    const token = acc.access_token as string
    const out: any = { novos: {}, engajamento: {} }

    // Total de seguidores — valor ATUAL
    const f = await apiGet(`${ig}`, { fields: 'followers_count', access_token: token })
    out.followers_count = f.followers_count ?? null

    // Engajamento — janela do período (mês-calendário)
    const eng = await apiGet(`${ig}/insights`, {
      metric: 'views,reach,total_interactions,profile_views', period: 'day', metric_type: 'total_value',
      since: String(engSince), until: String(engUntil), access_token: token,
    })
    const em: Record<string, number> = {}
    for (const it of (eng.data ?? [])) em[it.name] = it.total_value?.value ?? 0
    out.engajamento = { views: em.views ?? 0, reach: em.reach ?? 0, interacoes: em.total_interactions ?? 0, visitas: em.profile_views ?? 0 }

    // Novos seguidores — janela deslocada -1 dia; FOLLOWER=seguiu, NON_FOLLOWER=deixou
    const fu = await apiGet(`${ig}/insights`, {
      metric: 'follows_and_unfollows', period: 'day', metric_type: 'total_value', breakdown: 'follow_type',
      since: String(folSince), until: String(folUntil), access_token: token,
    })
    let seguiu = 0, deixou = 0
    for (const r of (fu.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [])) {
      const dv = (r.dimension_values ?? [null])[0]
      if (dv === 'FOLLOWER') seguiu = r.value
      else if (dv === 'NON_FOLLOWER') deixou = r.value
    }
    out.novos = { seguiu, deixou, total: seguiu - deixou }

    if (eng.error || fu.error) out.meta_erro = (eng.error?.message || fu.error?.message || 'erro Meta')
    return Response.json(out)
  } catch (e) {
    return Response.json({ meta_erro: String(e) }, { status: 500 })
  }
})
