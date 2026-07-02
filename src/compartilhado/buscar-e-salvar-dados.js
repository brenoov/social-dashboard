import { SUPABASE_URL, SUPABASE_ANON_KEY } from './conectar-no-banco-de-dados.js'
import { estado } from './controle-de-login-e-usuario.js'

// Helper de leitura ao REST do Supabase — portado VERBATIM de legacy/index.html
// L3277-3286 (única mudança: currentSession -> estado.currentSession).
export async function sb(path) {
  try {
    const token = estado.currentSession?.access_token || SUPABASE_ANON_KEY
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    })
    const json = await r.json()
    return Array.isArray(json) ? json : []
  } catch (e) { return [] }
}
