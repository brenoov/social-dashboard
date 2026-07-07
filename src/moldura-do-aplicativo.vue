<template>
  <div class="moldura">
    <!-- Alternador de tema claro/escuro — global, disponível em todas as telas.
         Aplica data-theme no <html> (variáveis núcleo do CSS já respondem) e persiste. -->
    <button
      class="btn-tema"
      type="button"
      @click="alternarTema"
      :title="temaEscuro ? 'Mudar para tema claro' : 'Mudar para tema escuro'"
      aria-label="Alternar tema claro/escuro"
    >
      <svg v-if="temaEscuro" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
      <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
    </button>
    <router-view />
  </div>
</template>

<script setup>
// A topbar do dashboard (abas de período, auto-cycle, relógio, seletor de
// perfil) será migrada como componente próprio numa task futura, junto das
// ferramentas que ela controla.
import { ref, onMounted } from 'vue'

const temaEscuro = ref(false)

function aplicarTema(escuro) {
  temaEscuro.value = escuro
  document.documentElement.dataset.theme = escuro ? 'dark' : 'light'
  localStorage.setItem('tema', escuro ? 'dark' : 'light')
}

function alternarTema() {
  aplicarTema(!temaEscuro.value)
}

onMounted(() => {
  // Respeita a escolha salva; se não houver, começa no claro (padrão do app).
  aplicarTema(localStorage.getItem('tema') === 'dark')
})
</script>

<style scoped>
.btn-tema {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9998;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-md);
  cursor: pointer;
  transition: transform .15s ease, box-shadow .15s ease, background .15s ease;
}
.btn-tema:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  color: var(--accent);
}
.btn-tema:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
