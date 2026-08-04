<script setup>
// O avatar do perfil como peça NORMAL da barra de cima, não como botão flutuando
// por cima da tela.
//
// Por que existe: o avatar era position:fixed no canto superior direito, com
// z-index alto, e cobria o que cada ferramenta punha ali. Tentei resolver
// reservando espaço por CSS global e QUEBREI 10 topbars que usam flex-wrap —
// um item extra de 64px não reserva espaço num contêiner que quebra linha, ele
// empurra o último elemento pra segunda linha. A solução certa é esta: o avatar
// vira um filho da barra, e cada tela decide onde ele entra.
//
// A tela que usa este componente avisa a moldura (avatarNaBarra) para o avatar
// flutuante sumir — senão apareceriam os dois.
import { onMounted, onUnmounted, computed } from 'vue'
import { estado } from './controle-de-login-e-usuario.js'
import { avatarNaBarra, menuDoPerfilAberto } from './estado-do-avatar.js'

const iniciais = computed(() => {
  const email = estado.user?.email || ''
  const nome = email.split('@')[0] || '?'
  return nome.slice(0, 2).toUpperCase()
})

onMounted(() => { avatarNaBarra.value = true })
onUnmounted(() => { avatarNaBarra.value = false })
</script>

<template>
  <button v-if="estado.user" class="avatar-na-barra" type="button"
          @click="menuDoPerfilAberto.value = !menuDoPerfilAberto.value"
          :title="estado.user.email" aria-label="Menu do perfil">
    <img v-if="estado.avatarUrl" :src="estado.avatarUrl" alt="Perfil">
    <span v-else class="avatar-na-barra-ph">{{ iniciais }}</span>
  </button>
</template>

<style scoped>
/* Pequeno de propósito: ele entra numa barra que já está cheia. 30px cabe em
   qualquer topbar do app sem disputar espaço com o que já estava lá. */
.avatar-na-barra{
  width:30px;height:30px;flex-shrink:0;border-radius:50%;padding:0;overflow:hidden;
  border:1px solid var(--border);background:var(--surface2);cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  transition:border-color .15s ease;touch-action:manipulation;
}
.avatar-na-barra:hover{border-color:var(--accent);}
.avatar-na-barra:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}
.avatar-na-barra img{width:100%;height:100%;object-fit:cover;}
.avatar-na-barra-ph{
  font-family:var(--fonte-principal);font-size:12px;font-weight:600;
  color:#fff;background:var(--accent);width:100%;height:100%;
  display:flex;align-items:center;justify-content:center;
}
</style>
