// Decisão pura de acesso à rota — separada do router e da cadeia de imports do
// Supabase para poder ser testada sem stub de `window` nem instanciar o roteador.
//
// Isto NÃO é segurança: o front é público, qualquer um lê o bundle e pula esta
// guarda pelo console do navegador. Quem garante o acesso de verdade é o RLS
// do banco e as Edge Functions. Esta guarda é só aparência — evita que uma tela
// sem gate próprio fique visível por esquecimento (foi o caso de /claude-status
// e /noticias) e evita tela branca em rota que não existe mais.
//
// Devolve `true` (pode entrar) ou o destino do redirecionamento (objeto de
// rota do vue-router: { name }).
export function podeEntrar(rota, temSessao, checarPermissao) {
  if (rota.name === 'login') return true
  if (!temSessao) return { name: 'login' }
  if (!rota.name) return { name: 'inicio' } // rota inexistente: Início, nunca tela branca
  const recurso = rota.meta?.recurso
  if (recurso && !checarPermissao(recurso)) return { name: 'inicio' }
  return true
}
