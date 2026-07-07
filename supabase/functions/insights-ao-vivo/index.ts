// insights-ao-vivo — KPIs EXATOS da Meta. Token da conta lido no servidor, no header (nunca na URL nem retornado).
// Exige USUÁRIO autenticado COM permissão social (mesma regra da tela). Trata CORS. verify_jwt=false (auth feita aqui).
// Devolve a janela ATUAL + a ANTERIOR (quando enviada) para o comparativo ser exato.
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

// Novos seguidores: follows_and_unfollows na janela de FOLLOWS (já vem deslocada -1 dia do front).
async function novos(ig: string, fS: string, fU: string, token: string) {
  const fu = await apiGet(`${ig}/insights`, { metric: 'follows_and_unfollows', period: 'day', metric_type: 'total_value', breakdown: 'follow_type', since: String(fS), until: String(fU) }, token)
  let s = 0, d = 0
  for (const r of (fu.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [])) { const dv = (r.dimension_values ?? [null])[0]; if (dv === 'FOLLOWER') s = r.value; else if (dv === 'NON_FOLLOWER') d = r.value }
  return { seguiu: s, deixou: d, total: s - d, erro: fu.error }
}

async function engaj(ig: string, eS: string, eU: string, token: string) {
  const eng = await apiGet(`${ig}/insights`, { metric: 'views,reach,total_interactions,profile_views', period: 'day', metric_type: 'total_value', since: String(eS), until: String(eU) }, token)
  const em: Record<string, number> = {}
  for (const it of (eng.data ?? [])) em[it.name] = it.total_value?.value ?? 0
  return { obj: { views: em.views ?? 0, reach: em.reach ?? 0, interacoes: em.total_interactions ?? 0, visitas: em.profile_views ?? 0 }, erro: eng.error }
}

// Curtidas/Comentários/Salvamentos/Compart. por tipo de conteúdo → ORGÂNICO (POST+REEL+STORY) vs ANÚNCIO (AD).
async function interacoes(ig: string, eS: string, eU: string, token: string) {
  const bd = await apiGet(`${ig}/insights`, { metric: 'likes,comments,saves,shares', period: 'day', metric_type: 'total_value', breakdown: 'media_product_type', since: String(eS), until: String(eU) }, token)
  const mapa: Record<string, string> = { likes: 'curtidas', comments: 'comentarios', saves: 'salvamentos', shares: 'compartilhamentos' }
  const inter: Record<string, { org: number; ad: number }> = { curtidas: { org: 0, ad: 0 }, comentarios: { org: 0, ad: 0 }, salvamentos: { org: 0, ad: 0 }, compartilhamentos: { org: 0, ad: 0 } }
  for (const it of (bd.data ?? [])) { const dest = inter[mapa[it.name]]; if (!dest) continue; for (const r of (it.total_value?.breakdowns?.[0]?.results ?? [])) { const t = (r.dimension_values ?? ['?'])[0]; if (t === 'AD') dest.ad += (r.value ?? 0); else dest.org += (r.value ?? 0) } }
  return inter
}

// Investimento: gasto de TODAS as campanhas da conta de anúncio. Ads usam datas; eng-until é exclusivo → -1 dia = último dia inclusivo.
async function gasto(adAccountId: string, eS: string, eU: string, token: string) {
  const dstr = (u: number) => new Date(u * 1000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const ads = await apiGet(`act_${adAccountId}/insights`, { fields: 'spend', level: 'account', time_range: JSON.stringify({ since: dstr(Number(eS)), until: dstr(Number(eU) - 86400) }) }, token)
  return parseFloat(ads.data?.[0]?.spend ?? '0') || 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: { user } } = await sb.auth.getUser(jwt)
    if (!user) return json({ meta_erro: 'não autorizado' }, 401)
    const { data: perfil } = await sb.from('profiles').select('role,features').eq('id', user.id).single()
    const podeSocial = !!perfil && (perfil.role === 'admin' || (perfil.features ?? []).includes('social'))
    if (!podeSocial) return json({ meta_erro: 'sem acesso' }, 403)

    const { account_id, engSince, engUntil, folSince, folUntil, prevEngSince, prevEngUntil, prevFolSince, prevFolUntil } = await req.json()
    const { data: acc } = await sb.from('accounts').select('instagram_id,access_token,ad_account_id').eq('id', account_id).single()
    if (!acc) return json({ meta_erro: 'conta não encontrada' }, 404)
    const ig = acc.instagram_id as string, token = acc.access_token as string, adAcc = acc.ad_account_id as string | null
    const out: any = { novos: {}, engajamento: {}, investimento: null }

    const f = await apiGet(`${ig}`, { fields: 'followers_count' }, token)
    out.followers_count = f.followers_count ?? null
    const e = await engaj(ig, engSince, engUntil, token)
    out.engajamento = e.obj
    out.interacoes = await interacoes(ig, engSince, engUntil, token)
    const nv = await novos(ig, folSince, folUntil, token)
    out.novos = { seguiu: nv.seguiu, deixou: nv.deixou, total: nv.total }
    if (adAcc) out.investimento = await gasto(adAcc, engSince, engUntil, token)

    // ANTERIOR (comparativo exato): mesmas métricas na janela do período anterior, quando enviada.
    if (prevEngSince && prevEngUntil && prevFolSince && prevFolUntil) {
      const pe = await engaj(ig, prevEngSince, prevEngUntil, token)
      const pnv = await novos(ig, prevFolSince, prevFolUntil, token)
      out.anterior = {
        engajamento: pe.obj,
        interacoes: await interacoes(ig, prevEngSince, prevEngUntil, token),
        novos: { seguiu: pnv.seguiu, deixou: pnv.deixou, total: pnv.total },
        investimento: adAcc ? await gasto(adAcc, prevEngSince, prevEngUntil, token) : null,
      }
    }

    if (e.erro || nv.erro) out.meta_erro = 'meta_incompleto'
    return json(out)
  } catch (e) {
    console.error('insights-ao-vivo erro:', e)
    return json({ meta_erro: 'erro interno' }, 500)
  }
})
