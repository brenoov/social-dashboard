// insights-ao-vivo — KPIs EXATOS da Meta. Token da conta lido no servidor, no header (nunca na URL nem retornado).
// Exige USUÁRIO autenticado COM permissão social (mesma regra da tela). Trata CORS (preflight OPTIONS + headers).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const GRAPH = 'https://graph.facebook.com/v21.0'
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (obj: unknown, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

async function apiGet(path: string, params: Record<string, string>, token: string): Promise<any> {
  const url = new URL(`${GRAPH}/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
  return await r.json()
}

Deno.serve(async (req) => {
  // Preflight CORS (o navegador manda OPTIONS antes do POST) — sem isso a chamada real é bloqueada.
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: { user } } = await sb.auth.getUser(jwt)
    if (!user) return json({ meta_erro: 'não autorizado' }, 401)

    // Autorização por permissão (não há dono por conta neste app). Mesma regra da tela:
    // hasPermission('tool:social') = role 'admin' OU features inclui 'social'.
    const { data: perfil } = await sb.from('profiles').select('role,features').eq('id', user.id).single()
    const podeSocial = !!perfil && (perfil.role === 'admin' || (perfil.features ?? []).includes('social'))
    if (!podeSocial) return json({ meta_erro: 'sem acesso' }, 403)

    const { account_id, engSince, engUntil, folSince, folUntil } = await req.json()
    const { data: acc } = await sb.from('accounts').select('instagram_id,access_token').eq('id', account_id).single()
    if (!acc) return json({ meta_erro: 'conta não encontrada' }, 404)
    const ig = acc.instagram_id as string
    const token = acc.access_token as string
    const out: any = { novos: {}, engajamento: {} }

    const f = await apiGet(`${ig}`, { fields: 'followers_count' }, token)
    out.followers_count = f.followers_count ?? null

    const eng = await apiGet(`${ig}/insights`, {
      metric: 'views,reach,total_interactions,profile_views', period: 'day', metric_type: 'total_value',
      since: String(engSince), until: String(engUntil),
    }, token)
    const em: Record<string, number> = {}
    for (const it of (eng.data ?? [])) em[it.name] = it.total_value?.value ?? 0
    out.engajamento = { views: em.views ?? 0, reach: em.reach ?? 0, interacoes: em.total_interactions ?? 0, visitas: em.profile_views ?? 0 }

    // Curtidas/Comentários/Salvamentos/Compart. por tipo de conteúdo → ORGÂNICO (POST+REEL+STORY) vs ANÚNCIO (AD).
    // (o painel "por interação" mostra o orgânico; o número por conta somaria os anúncios, que aqui vão à parte.)
    const bd = await apiGet(`${ig}/insights`, {
      metric: 'likes,comments,saves,shares', period: 'day', metric_type: 'total_value', breakdown: 'media_product_type',
      since: String(engSince), until: String(engUntil),
    }, token)
    const mapa: Record<string, string> = { likes: 'curtidas', comments: 'comentarios', saves: 'salvamentos', shares: 'compartilhamentos' }
    const inter: Record<string, { org: number; ad: number }> = { curtidas: { org: 0, ad: 0 }, comentarios: { org: 0, ad: 0 }, salvamentos: { org: 0, ad: 0 }, compartilhamentos: { org: 0, ad: 0 } }
    for (const it of (bd.data ?? [])) {
      const dest = inter[mapa[it.name]]; if (!dest) continue
      for (const r of (it.total_value?.breakdowns?.[0]?.results ?? [])) {
        const t = (r.dimension_values ?? ['?'])[0]
        if (t === 'AD') dest.ad += (r.value ?? 0); else dest.org += (r.value ?? 0)
      }
    }
    out.interacoes = inter

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
    return json(out)
  } catch (e) {
    console.error('insights-ao-vivo erro:', e)
    return json({ meta_erro: 'erro interno' }, 500)
  }
})
