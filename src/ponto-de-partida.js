import './estilos/estilos-globais.css'
import { createApp } from 'vue'
import Moldura from './moldura-do-aplicativo.vue'
import { roteador } from './mapa-de-enderecos.js'
import { sbClient } from './compartilhado/conectar-no-banco-de-dados.js'
import { setSession, carregarPerfil } from './compartilhado/controle-de-login-e-usuario.js'

async function iniciar() {
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
  sbClient.auth.onAuthStateChange((_evento, session) => { setSession(session) })

  createApp(Moldura).use(roteador).mount('#app')
}

iniciar()
