import './estilos/estilos-globais.css'
import { createApp } from 'vue'
import Moldura from './moldura-do-aplicativo.vue'
import { roteador } from './mapa-de-enderecos.js'
import { sbClient } from './compartilhado/conectar-no-banco-de-dados.js'
import { setSession, carregarPerfil, limparEstado, estado } from './compartilhado/controle-de-login-e-usuario.js'
import { detectarFluxoDeSenha } from './ferramentas/login/detectar-fluxo-de-senha.js'

async function iniciar() {
  // Guardado ANTES de qualquer await: o SDK consome e apaga o #access_token do
  // hash de forma assíncrona. Lido depois, o hash já sumiu e a detecção falha.
  window.__fluxoDeSenha = detectarFluxoDeSenha(location.hash, location.search)

  // Recupera sessão salva (se houver) antes de montar, para que um usuário
  // já logado não seja redirecionado ao /login ao recarregar a página.
  const { data } = await sbClient.auth.getSession()
  if (data.session) {
    setSession(data.session)
    await carregarPerfil(data.session)
  }

  // Mantém o estado com o token SEMPRE fresco: o SDK renova o access_token
  // sozinho (~1h). Sem isso, estado.currentSession fica com o token do boot
  // (velho) e as chamadas REST autenticadas por token explícito (ex.: o
  // adFetch do admin) tomam 401 → listas de usuários/contas zeradas.
  //
  // O SDK dispara SIGNED_IN sozinho no visibilitychange, lendo a sessão do
  // localStorage. Se noutra aba alguém trocou de usuário, esta aba recebia a
  // sessão nova e mantinha role/permissions/is_superadmin do usuário ANTERIOR —
  // token de um, flags de outro. Por isso o perfil é recarregado junto.
  //
  // O "|| !estado.userId" cobre o outro caminho: se o getSession() do boot não
  // devolveu sessão (token vencido, renovação em curso), o carregarPerfil nunca
  // rodou — o usuário ficava logado com permissions = {} e a Central vazia.
  //
  // Só recarrega quando o usuário muda (ou quando ainda não há perfil): o
  // TOKEN_REFRESHED dispara a cada ~1h para o mesmo usuário e recarregar ali
  // seria requisição à toa.
  sbClient.auth.onAuthStateChange(async (evento, session) => {
    if (evento === 'SIGNED_OUT' || !session) {
      limparEstado()
      return
    }
    const mudouDeUsuario = estado.userId && session.user?.id !== estado.userId
    setSession(session)
    if (mudouDeUsuario || !estado.userId) {
      await carregarPerfil(session)
    }
  })

  // Veio de link de reset/convite: a sessão existe, mas a pessoa PRECISA definir
  // a senha antes de usar o sistema — senão fica trancada quando a sessão
  // expirar. A guarda deixa /login passar mesmo com sessão, então o destino
  // gruda. O await é necessário: sem ele, a navegação inicial que o roteador
  // dispara ao ser instalado corre junto e pode ganhar, levando ao Início.
  if (window.__fluxoDeSenha) {
    await roteador.replace({ name: 'login' })
  }

  createApp(Moldura).use(roteador).mount('#app')
}

iniciar()
