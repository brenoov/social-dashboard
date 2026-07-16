// Descobre se a pessoa chegou por um link de "esqueci a senha" ou de convite.
//
// Por que existe: o SDK do Supabase tem detectSessionInUrl ligado por padrão, então
// ele consome o #access_token e cria a sessão sozinho. Sem esta detecção, a pessoa
// era jogada direto no Início e NUNCA via o formulário de senha nova — continuava
// sem saber a senha e ficava trancada quando a sessão expirava.
//
// Roda ANTES do SDK limpar o hash.
//
// Sem imports de propósito: é uma função pura, e qualquer import da cadeia do
// Supabase quebraria o teste no Node (`window is not defined`).
export function detectarFluxoDeSenha(hash, query) {
  const h = new URLSearchParams((hash || '').replace(/^#/, ''))
  const q = new URLSearchParams((query || '').replace(/^\?/, ''))
  const tipo = h.get('type') || q.get('type')
  if (tipo === 'recovery') return 'recovery'
  if (tipo === 'invite') return 'invite'
  return null
}
