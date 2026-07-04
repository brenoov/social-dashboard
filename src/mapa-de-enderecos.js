import { createRouter, createWebHistory } from 'vue-router'
import { estado } from './compartilhado/controle-de-login-e-usuario.js'

const rotas = [
  { path: '/', name: 'inicio', component: () => import('./ferramentas/inicio/tela-inicial.vue') },
  { path: '/noticias', name: 'noticias', component: () => import('./ferramentas/noticias/tela-de-noticias.vue') },
  { path: '/acessos', name: 'acessos', component: () => import('./ferramentas/acessos/tela-de-acessos.vue') },
  { path: '/banco', name: 'banco', component: () => import('./ferramentas/banco/tela-de-banco.vue') },
  { path: '/vendas', name: 'vendas', component: () => import('./ferramentas/vendas/tela-menu-vendas.vue') },
  { path: '/gestao-vista', name: 'gestao-vista', component: () => import('./ferramentas/gestao-a-vista/tela-gestao-a-vista.vue') },
  { path: '/meta-ads', name: 'meta-ads', component: () => import('./ferramentas/meta-ads/tela-menu-meta-ads.vue') },
  { path: '/meta-campanhas', name: 'meta-campanhas', component: () => import('./ferramentas/analise-campanhas/tela-analise-campanhas.vue') },
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
