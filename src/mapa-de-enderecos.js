import { createRouter, createWebHistory } from 'vue-router'
import { estado } from './compartilhado/controle-de-login-e-usuario.js'

const rotas = [
  { path: '/', name: 'inicio', component: () => import('./ferramentas/inicio/tela-inicial.vue') },
  { path: '/noticias', name: 'noticias', component: () => import('./ferramentas/noticias/tela-de-noticias.vue') },
  { path: '/acessos', name: 'acessos', component: () => import('./ferramentas/acessos/tela-de-acessos.vue') },
  { path: '/login', name: 'login', component: () => import('./ferramentas/login/tela-de-login.vue') },
]

export const roteador = createRouter({
  history: createWebHistory(),
  routes: rotas,
})

// Guarda global: qualquer rota que não seja o login exige sessão ativa.
roteador.beforeEach((to) => {
  if (to.name !== 'login' && !estado.currentSession) return { name: 'login' }
})
