<template>
  <div class="moldura">
    <!-- Perfil (avatar + menu) — canto superior direito, global, só quando logado.
         Restaura o badge de usuário do legado (setGlobalUserBtn): trocar senha e sair. -->
    <div v-if="estado.user && !naTelaLogin" class="perfil-menu">
      <button class="perfil-avatar" type="button" @click="menuAberto = !menuAberto" :title="estado.user.email" aria-label="Menu do perfil">
        <img v-if="estado.avatarUrl" :src="estado.avatarUrl" alt="Perfil">
        <span v-else class="perfil-avatar-ph">{{ iniciais }}</span>
      </button>
      <template v-if="menuAberto">
        <div class="perfil-backdrop" @click="menuAberto = false"></div>
        <div class="perfil-dropdown">
          <div class="perfil-dropdown-email">{{ estado.user.email }}</div>
          <div class="perfil-dropdown-role" v-if="estado.role === 'admin'">Administrador</div>
          <div class="perfil-dropdown-sep"></div>
          <button class="perfil-dropdown-item" type="button" @click="abrirTrocarSenha">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Trocar senha
          </button>
          <button class="perfil-dropdown-item perfil-dropdown-sair" type="button" @click="sair">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sair
          </button>
        </div>
      </template>
    </div>

    <!-- Modal Trocar senha (o próprio usuário digita a nova senha) -->
    <div v-if="trocarSenhaAberto" class="perfil-modal-overlay" @click.self="fecharTrocarSenha">
      <div class="perfil-modal">
        <div class="perfil-modal-titulo">Trocar senha</div>
        <input class="perfil-modal-input" type="password" v-model="novaSenha" placeholder="Nova senha (mín. 6 caracteres)" autocomplete="new-password">
        <input class="perfil-modal-input" type="password" v-model="confirmaSenha" placeholder="Confirmar nova senha" autocomplete="new-password" @keyup.enter="salvarSenha">
        <div v-if="msgSenha" class="perfil-modal-msg" :class="{ erro: msgErro }">{{ msgSenha }}</div>
        <div class="perfil-modal-acoes">
          <button class="perfil-modal-btn" type="button" @click="fecharTrocarSenha" :disabled="salvando">Cancelar</button>
          <button class="perfil-modal-btn primario" type="button" @click="salvarSenha" :disabled="salvando">{{ salvando ? 'Salvando…' : 'Salvar' }}</button>
        </div>
      </div>
    </div>

    <!-- Alternador de tema claro/escuro — global, em todas as telas. -->
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
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { estado } from './compartilhado/controle-de-login-e-usuario.js'
import { sbClient } from './compartilhado/conectar-no-banco-de-dados.js'

const router = useRouter()
const route = useRoute()

/* ── Perfil ── */
const menuAberto = ref(false)
const naTelaLogin = computed(() => route.name === 'login')
const iniciais = computed(() => {
  const email = estado.user?.email || ''
  return (email.trim()[0] || '?').toUpperCase()
})

async function sair() {
  menuAberto.value = false
  try { await sbClient.auth.signOut() } catch (e) { /* segue para o login de qualquer forma */ }
  router.push({ name: 'login' })
}

/* ── Trocar senha (o usuário digita a própria senha nova) ── */
const trocarSenhaAberto = ref(false)
const novaSenha = ref('')
const confirmaSenha = ref('')
const msgSenha = ref('')
const msgErro = ref(false)
const salvando = ref(false)

function abrirTrocarSenha() {
  menuAberto.value = false
  novaSenha.value = ''
  confirmaSenha.value = ''
  msgSenha.value = ''
  msgErro.value = false
  trocarSenhaAberto.value = true
}
function fecharTrocarSenha() {
  if (salvando.value) return
  trocarSenhaAberto.value = false
}
async function salvarSenha() {
  msgErro.value = false
  if (novaSenha.value.length < 6) { msgErro.value = true; msgSenha.value = 'A senha precisa de pelo menos 6 caracteres.'; return }
  if (novaSenha.value !== confirmaSenha.value) { msgErro.value = true; msgSenha.value = 'As senhas não coincidem.'; return }
  salvando.value = true
  msgSenha.value = ''
  try {
    const { error } = await sbClient.auth.updateUser({ password: novaSenha.value })
    if (error) { msgErro.value = true; msgSenha.value = 'Não deu pra trocar: ' + error.message }
    else {
      msgSenha.value = 'Senha alterada com sucesso!'
      setTimeout(() => { trocarSenhaAberto.value = false }, 1200)
    }
  } catch (e) {
    msgErro.value = true; msgSenha.value = 'Erro inesperado ao trocar a senha.'
  } finally {
    salvando.value = false
  }
}

/* ── Tema claro/escuro (global, persiste) ── */
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
  aplicarTema(localStorage.getItem('tema') === 'dark')
})
</script>

<style scoped>
/* ── Perfil ── */
.perfil-menu { position: fixed; top: 16px; right: 18px; z-index: 9999; }
.perfil-avatar {
  width: 40px; height: 40px; border-radius: 50%; padding: 0; overflow: hidden;
  border: 2px solid var(--border); background: var(--surface2); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  box-shadow: var(--shadow-sm); transition: border-color .15s ease, transform .15s ease;
}
.perfil-avatar:hover { border-color: var(--accent); transform: translateY(-1px); }
.perfil-avatar:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.perfil-avatar img { width: 100%; height: 100%; object-fit: cover; }
.perfil-avatar-ph {
  font-family: 'Oswald', sans-serif; font-size: 17px; font-weight: 600;
  color: #fff; background: var(--accent); width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
}
.perfil-backdrop { position: fixed; inset: 0; z-index: 9998; }
.perfil-dropdown {
  position: absolute; top: 48px; right: 0; z-index: 9999; min-width: 210px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
  box-shadow: var(--shadow-lg); padding: 8px; font-family: 'IBM Plex Sans', sans-serif;
}
.perfil-dropdown-email { font-size: 12.5px; color: var(--text); font-weight: 600; padding: 6px 8px 2px; word-break: break-all; }
.perfil-dropdown-role { font-size: 10.5px; color: var(--accent); text-transform: uppercase; letter-spacing: .6px; padding: 0 8px 4px; }
.perfil-dropdown-sep { height: 1px; background: var(--border); margin: 6px 4px; }
.perfil-dropdown-item {
  display: flex; align-items: center; gap: 9px; width: 100%; text-align: left;
  background: none; border: none; cursor: pointer; padding: 9px 8px; border-radius: 8px;
  font-size: 13px; color: var(--text); transition: background .12s ease;
}
.perfil-dropdown-item:hover { background: var(--accent-light); }
.perfil-dropdown-item svg { color: var(--muted); flex-shrink: 0; }
.perfil-dropdown-sair { color: var(--red); }
.perfil-dropdown-sair svg { color: var(--red); }

/* ── Modal Trocar senha ── */
.perfil-modal-overlay {
  position: fixed; inset: 0; z-index: 10000; background: rgba(0,0,0,.45);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.perfil-modal {
  background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
  box-shadow: var(--shadow-lg); padding: 22px; width: 100%; max-width: 340px;
  font-family: 'IBM Plex Sans', sans-serif; display: flex; flex-direction: column; gap: 12px;
}
.perfil-modal-titulo { font-size: 16px; font-weight: 700; color: var(--text); }
.perfil-modal-input {
  width: 100%; box-sizing: border-box; padding: 11px 12px; border-radius: 8px;
  border: 1px solid var(--border); background: var(--surface2); color: var(--text);
  font-size: 13.5px; font-family: inherit;
}
.perfil-modal-input:focus { outline: none; border-color: var(--accent); }
.perfil-modal-msg { font-size: 12.5px; color: var(--green); }
.perfil-modal-msg.erro { color: var(--red); }
.perfil-modal-acoes { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.perfil-modal-btn {
  padding: 9px 16px; border-radius: 8px; border: 1px solid var(--border);
  background: var(--surface2); color: var(--text); font-size: 13px; cursor: pointer;
  font-family: inherit; transition: all .14s ease;
}
.perfil-modal-btn:hover:not(:disabled) { border-color: var(--accent); }
.perfil-modal-btn.primario { background: var(--accent); border-color: var(--accent); color: #fff; }
.perfil-modal-btn:disabled { opacity: .6; cursor: default; }

/* ── Toggle de tema ── */
.btn-tema {
  position: fixed; bottom: 20px; right: 20px; z-index: 9998;
  width: 42px; height: 42px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--surface); color: var(--text); border: 1px solid var(--border);
  box-shadow: var(--shadow-md); cursor: pointer;
  transition: transform .15s ease, box-shadow .15s ease, color .15s ease;
}
.btn-tema:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); color: var(--accent); }
.btn-tema:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
