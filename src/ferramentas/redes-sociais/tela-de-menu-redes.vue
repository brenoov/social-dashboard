<template>
  <!-- Submenu da área de Redes Sociais (padrão de tela-de-menu-vendas.vue).
       Chega aqui quem tem MAIS DE UMA ferramenta da área; quem tem só uma vai
       direto nela (ver irRedes() em tela-de-inicio.vue). Antes o desvio era por
       ser admin, o que passou a esconder a Central de Conteúdo de quem tinha
       permissão só dela. Card do Relatório continua só para admin. -->
  <div class="tela-menu-redes">
    <div class="smenu-topbar">
      <button class="smenu-back" @click="voltar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>Central
      </button>
      <div style="display:flex;align-items:center;gap:10px">
        <img class="rbv-logo rbv-logo-light" :src="logoClaroUrl" alt="RBV">
        <img class="rbv-logo rbv-logo-dark" :src="logoEscuroUrl" alt="RBV">
        <span class="smenu-title">Redes Sociais</span>
      </div>
      <div style="width:60px"></div>
    </div>
    <div class="smenu-body">
      <div class="smenu-headline">
        <h2>Escolha a ferramenta</h2>
        <p>Medir o que já aconteceu, ou planejar o que vem</p>
      </div>
      <div class="smenu-cards">
        <div class="smenu-card" @click="ir('redes-sociais')">
          <span class="smenu-card-num">01</span>
          <div class="smenu-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          </div>
          <div class="smenu-card-title">Dashboard</div>
          <div class="smenu-card-desc">Métricas e KPIs do Instagram ao vivo — seguidores, engajamento, conteúdo e anúncios de todas as marcas.</div>
          <span class="smenu-card-enter">→</span>
        </div>
        <div class="smenu-card" v-if="ehAdmin" @click="ir('redes-relatorio')">
          <span class="smenu-card-num">02</span>
          <div class="smenu-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
          </div>
          <div class="smenu-card-title">Relatório Interativo</div>
          <div class="smenu-card-desc">Planilha do histórico coletado, dia a dia, por perfil — para curadoria e conferência. Ordena, filtra e exporta.</div>
          <span class="smenu-card-enter">→</span>
        </div>
        <!-- Central de Conteúdo mora aqui, e não num card solto na Central: as
             duas primeiras MEDEM o que já aconteceu, esta PLANEJA o que vem.
             É a mesma área de trabalho. -->
        <div class="smenu-card" v-if="podeConteudo" @click="ir('conteudo')">
          <span class="smenu-card-num">03</span>
          <div class="smenu-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="12" cy="16" r="2"/></svg>
          </div>
          <div class="smenu-card-title">Central de Conteúdo</div>
          <div class="smenu-card-desc">Planeje o que vai ser publicado: calendário, aprovação, agendamento e a prévia de como o perfil vai ficar.</div>
          <span class="smenu-card-enter">→</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { estado, hasPermission } from '../../compartilhado/controle-de-login-e-usuario.js'
import { adminToast } from '../../compartilhado/avisos.js'

const router = useRouter()
const logoClaroUrl = '/midia/LOGOTIPOBRENOPRETO.png'
const logoEscuroUrl = '/midia/LOGOTIPOBRENOBRANCO.png'

const ehAdmin = computed(() => estado.role === 'admin')
const podeConteudo = computed(() => hasPermission('conteudo', 'ver'))

function voltar() { router.push({ name: 'inicio' }) }
function ir(nome) { router.push({ name: nome }) }

onMounted(() => {
  // A Central de Conteúdo passou a morar aqui dentro, então quem tem SÓ ela
  // também precisa entrar. Com a guarda antiga (só `tool:social`) essa pessoa
  // era expulsa para o Início antes de ver o card — sem acesso a uma ferramenta
  // que ela tem permissão de usar.
  if (!hasPermission('tool:social') && !hasPermission('conteudo', 'ver')) {
    adminToast('Sem acesso', false)
    router.push({ name: 'inicio' })
  }
})
</script>

<style scoped>
/* Mesmo visual do submenu de vendas (.smenu-). Tela estática — sem :deep(). */
.tela-menu-redes{min-height:100vh;display:flex;flex-direction:column;background:var(--bg);position:relative;z-index:1;}
.tela-menu-redes .smenu-topbar{display:flex;align-items:center;justify-content:space-between;padding:13px 24px;border-bottom:1px solid var(--border);background:var(--surface);gap:16px;position:sticky;top:0;z-index:10;}
.tela-menu-redes .smenu-back{font-family:'IBM Plex Sans',sans-serif;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--accent);cursor:pointer;background:none;border:1px solid var(--accent-mid);border-radius:5px;padding:5px 10px;display:flex;align-items:center;gap:5px;transition:background .15s,opacity .15s;white-space:nowrap;}
.tela-menu-redes .smenu-back:hover{background:var(--accent-light);}
.tela-menu-redes .smenu-title{font-family:'Oswald',sans-serif;font-size:15px;font-weight:500;letter-spacing:2.5px;text-transform:uppercase;color:var(--text);}
.tela-menu-redes .smenu-body{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;gap:40px;}
.tela-menu-redes .smenu-headline{text-align:center;}
.tela-menu-redes .smenu-headline h2{font-family:'Oswald',sans-serif;font-size:26px;font-weight:500;letter-spacing:3px;text-transform:uppercase;color:var(--text);margin-bottom:6px;}
.tela-menu-redes .smenu-headline p{font-family:'IBM Plex Sans',sans-serif;font-size:12px;color:var(--muted);}
.tela-menu-redes .smenu-cards{display:flex;gap:22px;flex-wrap:wrap;justify-content:center;}
.tela-menu-redes .smenu-card{position:relative;width:270px;min-height:210px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-xl);padding:30px 24px 48px;cursor:pointer;transition:all .25s;display:flex;flex-direction:column;gap:14px;overflow:hidden;}
.tela-menu-redes .smenu-card::before{content:'';position:absolute;inset:0;background:var(--accent);opacity:0;transition:opacity .2s;border-radius:18px;}
.tela-menu-redes .smenu-card:hover::before{opacity:.05;}
.tela-menu-redes .smenu-card:hover{border-color:var(--accent);transform:translateY(-3px);box-shadow:0 8px 32px rgba(0,0,0,.1);}
.tela-menu-redes .smenu-card-num{font-family:'IBM Plex Sans',sans-serif;font-size:10px;letter-spacing:3px;color:var(--muted);text-transform:uppercase;font-weight:600;}
.tela-menu-redes .smenu-card-icon{width:48px;height:48px;background:var(--accent);border-radius:12px;display:flex;align-items:center;justify-content:center;}
.tela-menu-redes .smenu-card-title{font-family:'Oswald',sans-serif;font-size:18px;font-weight:500;letter-spacing:1.5px;text-transform:uppercase;color:var(--text);line-height:1.2;}
.tela-menu-redes .smenu-card-desc{font-family:'IBM Plex Sans',sans-serif;font-size:11px;color:var(--muted);line-height:1.7;}
.tela-menu-redes .smenu-card-enter{position:absolute;bottom:16px;right:18px;font-size:18px;color:var(--muted);transition:all .2s;}
.tela-menu-redes .smenu-card:hover .smenu-card-enter{transform:translateX(4px);color:var(--accent);}
@media(max-width:640px){
  .tela-menu-redes .smenu-topbar{padding:8px 14px;flex-wrap:wrap;}
  .tela-menu-redes .smenu-card{width:calc(50% - 11px);min-width:130px;min-height:auto;padding:20px 14px 34px;}
}
@media(max-width:380px){
  .tela-menu-redes .smenu-card{width:100%;}
}
</style>
