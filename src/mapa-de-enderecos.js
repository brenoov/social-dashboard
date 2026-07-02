import { createRouter, createWebHistory } from 'vue-router'

const rotas = [
  { path: '/', name: 'inicio', component: () => import('./ferramentas/inicio/tela-inicial.vue') },
  { path: '/noticias', name: 'noticias', component: () => import('./ferramentas/noticias/tela-de-noticias.vue') },
]

export const roteador = createRouter({
  history: createWebHistory(),
  routes: rotas,
})
