import './estilos/estilos-globais.css'
import { createApp } from 'vue'
import Moldura from './moldura-do-aplicativo.vue'
import { roteador } from './mapa-de-enderecos.js'
import { sbClient } from './compartilhado/conectar-no-banco-de-dados.js'
import { setSession } from './compartilhado/controle-de-login-e-usuario.js'

async function iniciar() {
  // Recupera sessão salva (se houver) antes de montar, para que um usuário
  // já logado não seja redirecionado ao /login ao recarregar a página.
  const { data } = await sbClient.auth.getSession()
  if (data.session) setSession(data.session)

  createApp(Moldura).use(roteador).mount('#app')
}

iniciar()
