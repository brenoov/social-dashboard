import { createRouter, createWebHistory } from 'vue-router'
import { estado } from './compartilhado/controle-de-login-e-usuario.js'

const rotas = [
  { path: '/', name: 'inicio', component: () => import('./ferramentas/inicio/tela-de-inicio.vue') },
  { path: '/noticias', name: 'noticias', component: () => import('./ferramentas/noticias/tela-de-noticias.vue') },
  { path: '/acessos', name: 'acessos', component: () => import('./ferramentas/acessos/tela-de-acessos.vue') },
  { path: '/banco', name: 'banco', component: () => import('./ferramentas/banco/tela-de-banco.vue') },
  { path: '/vendas', name: 'vendas', component: () => import('./ferramentas/vendas/tela-de-menu-vendas.vue') },
  { path: '/gestao-vista', name: 'gestao-vista', component: () => import('./ferramentas/gestao-a-vista/tela-de-gestao-a-vista.vue') },
  { path: '/analise-vendas-marca', name: 'analise-vendas-marca', component: () => import('./ferramentas/analise-vendas/tela-de-marca-vendas.vue') },
  { path: '/analise-vendas', name: 'analise-vendas', component: () => import('./ferramentas/analise-vendas/tela-de-analise-vendas.vue') },
  { path: '/meta-ads', name: 'meta-ads', component: () => import('./ferramentas/meta-ads/tela-de-menu-meta-ads.vue') },
  { path: '/meta-campanhas', name: 'meta-campanhas', component: () => import('./ferramentas/analise-campanhas/tela-de-analise-campanhas.vue') },
  { path: '/gestao-trafego', name: 'gestao-trafego', component: () => import('./ferramentas/gestao-trafego/tela-de-gestao-trafego.vue') },
  { path: '/fabrica-anuncios', name: 'fabrica-anuncios', component: () => import('./ferramentas/meta-ads/tela-de-fabrica-de-anuncios.vue') },
  { path: '/fabrica-estudio', name: 'fabrica-estudio', component: () => import('./ferramentas/meta-ads/tela-de-fabrica-estudio.vue') },
  { path: '/gestao-comercial', name: 'gestao-comercial', component: () => import('./ferramentas/gestao-comercial/tela-de-gestao-comercial.vue') },
  { path: '/login', name: 'login', component: () => import('./ferramentas/login/tela-de-login.vue') },
  { path: '/redes', name: 'redes', component: () => import('./ferramentas/redes-sociais/tela-de-menu-redes.vue') },
  { path: '/redes-sociais', name: 'redes-sociais', component: () => import('./ferramentas/redes-sociais/tela-de-redes-sociais.vue') },
  { path: '/redes-relatorio', name: 'redes-relatorio', component: () => import('./ferramentas/redes-sociais/tela-de-relatorio-redes.vue') },
  { path: '/admin', name: 'admin', component: () => import('./ferramentas/admin/tela-de-admin.vue') },
]

export const roteador = createRouter({
  history: createWebHistory(),
  routes: rotas,
})

// Guarda global: qualquer rota que não seja o login exige sessão ativa.
roteador.beforeEach((to) => {
  if (to.name !== 'login' && !estado.currentSession) return { name: 'login' }
})
