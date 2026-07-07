// serie-novos-dia — série DIÁRIA exata de novos seguidores (seguiu/deixou por dia) via BATCH da Meta.
// A Meta exige agregação por janela (follows_and_unfollows só com metric_type=total_value); então fazemos
// 1 chamada por dia, todas num único batch. Auth (usuário social) + CORS iguais a insights-ao-vivo. verify_jwt=false.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const GRAPH = 'https://graph.facebook.com/v21.0'
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (obj: unknown, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: { user } } = await sb.auth.getUser(jwt)
    if (!user) return json({ erro: 'não autorizado' }, 401)
    const { data: perfil } = await sb.from('profiles').select('role,features').eq('id', user.id).single()
    const pode = !!perfil && (perfil.role === 'admin' || (perfil.features ?? []).includes('social'))
    if (!pode) return json({ erro: 'sem acesso' }, 403)

    const { account_id, dias } = await req.json()
    if (!Array.isArray(dias) || !dias.length) return json({ serie: [] })
    const { data: acc } = await sb.from('accounts').select('instagram_id,access_token').eq('id', account_id).single()
    if (!acc) return json({ erro: 'conta não encontrada' }, 404)
    const ig = acc.instagram_id as string, token = acc.access_token as string

    const lista = dias.slice(0, 93) // teto de segurança (~3 meses / 2 batches)
    const serie: any[] = []
    for (let off = 0; off < lista.length; off += 50) {
      const chunk = lista.slice(off, off + 50)
      const form = new URLSearchParams()
      form.set('access_token', token)
      form.set('batch', JSON.stringify(chunk.map((d: any) => ({ method: 'GET', relative_url: `${ig}/insights?metric=follows_and_unfollows&period=day&metric_type=total_value&breakdown=follow_type&since=${d.since}&until=${d.until}` }))))
      const r = await fetch(`${GRAPH}/`, { method: 'POST', body: form })
      const arr = await r.json()
      for (let i = 0; i < chunk.length; i++) {
        let seguiu = 0, deixou = 0
        try { const b = JSON.parse(arr[i].body); for (const x of (b.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [])) { const dv = (x.dimension_values ?? ['?'])[0]; if (dv === 'FOLLOWER') seguiu = x.value; else if (dv === 'NON_FOLLOWER') deixou = x.value } } catch (e) {}
        serie.push({ label: chunk[i].label, seguiu, deixou })
      }
    }
    return json({ serie })
  } catch (e) {
    console.error('serie-novos-dia erro:', e)
    return json({ erro: 'erro interno' }, 500)
  }
})
