<template>
  <!-- Porte fiel de #meta-ads-hub-screen (legacy/index.html L11982-12028). Tela
       pequena e estática (sem innerHTML/createElement) — mesmo padrão simples de
       tela-menu-vendas.vue: bindings @click do Vue, sem precisar expor nada em
       window. Root vira .tela-menu-meta-ads (sem display:none — quem controla a
       visibilidade agora é o vue-router). -->
  <div class="tela-menu-meta-ads">
    <div class="smenu-topbar">
      <button class="smenu-back" @click="voltar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>Central
      </button>
      <div style="display:flex;align-items:center;gap:10px">
        <img class="rbv-logo rbv-logo-light" :src="logoClaroUrl" alt="RBV">
        <img class="rbv-logo rbv-logo-dark" :src="logoEscuroUrl" alt="RBV">
        <span class="smenu-title">Meta Ads</span>
      </div>
      <div class="view-toggle" style="display:flex;gap:3px;">
        <button class="view-toggle-btn" :class="{ active: visualizacao === 'grid' }" @click="definirVisualizacao('grid')" title="Cards">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        </button>
        <button class="view-toggle-btn" :class="{ active: visualizacao === 'list' }" @click="definirVisualizacao('list')" title="Lista">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        </button>
      </div>
    </div>
    <div class="smenu-body">
      <div class="smenu-headline">
        <h2>Escolha o módulo</h2>
        <p>Ferramentas de tráfego pago para suas contas</p>
      </div>
      <div class="smenu-cards" :class="{ 'view-list': visualizacao === 'list' }">
        <div class="smenu-card" v-if="hasPermission('module:meta:campanha')" @click="ir('meta-campanhas')">
          <span class="smenu-card-num">01</span>
          <div class="smenu-card-icon" style="background:linear-gradient(135deg,#1877F2,#0062E0)">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
          </div>
          <div class="smenu-card-title">Análise de Campanhas</div>
          <div class="smenu-card-desc">KPIs de performance, funil de conversão, CTR, CPC, CPM e breakdown completo por campanha e objetivo.</div>
          <span class="smenu-card-enter">→</span>
        </div>
        <div class="smenu-card" v-if="hasPermission('module:meta:gestor')" @click="ir('gestao-trafego')">
          <span class="smenu-card-num">02</span>
          <div class="smenu-card-icon" style="background:linear-gradient(135deg,#7c3aed,#4f46e5)">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
          </div>
          <div class="smenu-card-title">Gestão de Tráfego</div>
          <div class="smenu-card-desc">Agente IA analisa campanhas e sugere ações: pausar, escalar, ajustar budget e testar criativos.</div>
          <span class="smenu-card-enter">→</span>
        </div>
        <div class="smenu-card" v-if="hasPermission('module:meta:fabrica')" @click="ir('fabrica-estudio')">
          <span class="smenu-card-num">03</span>
          <div class="smenu-card-icon" style="background:linear-gradient(135deg,#0891b2,#4338ca)">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 7.2H22l-6 4.4 2.3 7.1L12 16.3 5.7 20.7 8 13.6l-6-4.4h7.6z"/></svg>
          </div>
          <div class="smenu-card-title">Estúdio de Criativos</div>
          <div class="smenu-card-desc">Fluxo guiado em 4 passos: gerar, curar, subir e conferir os criativos de uma campanha.</div>
          <span class="smenu-card-enter">→</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { hasPermission } from '../../compartilhado/controle-de-login-e-usuario.js'
import { adminToast } from '../../compartilhado/avisos.js'

const router = useRouter()

const logoClaroUrl = '/midia/LOGOTIPOBRENOPRETO.png'
const logoEscuroUrl = '/midia/LOGOTIPOBRENOBRANCO.png'

// Equivalente a closeMetaAds() do legado (display:none + showHome()).
function voltar() {
  router.push({ name: 'inicio' })
}

// Os dois módulos (Análise de Campanhas e Gestão de Tráfego) já têm rota de
// verdade (equivalente a openMetaCampanha()/openGestaoTrafego() do legado).
function ir(nome) {
  router.push({ name: nome })
}

// Porte de setMaHubView (legacy/index.html L8626-8633). Ao contrário do
// smenu-view da tela de vendas, este toggle NÃO persiste em localStorage no
// legado (setMaHubView nunca grava nada) — reproduzido aqui fielmente: começa
// sempre em 'grid' e não é salvo.
const visualizacao = ref('grid')
function definirVisualizacao(v) {
  visualizacao.value = v
}

// Guarda de acesso (equivalente ao if(!hasPermission('tool:meta'))return; do
// openMetaAds original).
onMounted(() => {
  if (!hasPermission('tool:meta')) {
    adminToast('Sem acesso', false)
    router.push({ name: 'inicio' })
    return
  }
})
</script>

<style scoped>
/* Porte das regras .smenu- (compartilhadas com tela-menu-vendas.vue — cada
   tela traz sua própria cópia, seguindo o padrão já estabelecido para essas
   classes reutilizadas pelo monólito legado: legacy L902-921, L1708-1715,
   L581-586). #meta-ads-hub-screen vira .tela-menu-meta-ads (sem display:none —
   a visibilidade é do router). Tela 100% estática (sem innerHTML/createElement),
   então nenhum seletor precisa de :deep(). */
.tela-menu-meta-ads{min-height:100vh;display:flex;flex-direction:column;background:var(--bg);position:relative;z-index:1;}
.tela-menu-meta-ads .smenu-topbar{display:flex;align-items:center;justify-content:space-between;padding:13px 24px;border-bottom:1px solid var(--border);background:var(--surface);gap:16px;position:sticky;top:0;z-index:10;}
.tela-menu-meta-ads .smenu-back{font-family:var(--fonte-principal);font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--accent);cursor:pointer;background:none;border:1px solid var(--accent-mid);border-radius:5px;padding:5px 10px;display:flex;align-items:center;gap:5px;transition:background .15s,opacity .15s;white-space:nowrap;}
.tela-menu-meta-ads .smenu-back:hover{background:var(--accent-light);}
.tela-menu-meta-ads .smenu-title{font-family:var(--fonte-principal);font-size:15px;font-weight:500;letter-spacing:2.5px;text-transform:uppercase;color:var(--text);}
.tela-menu-meta-ads .smenu-body{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;gap:40px;}
.tela-menu-meta-ads .smenu-headline{text-align:center;}
.tela-menu-meta-ads .smenu-headline h2{font-family:var(--fonte-principal);font-size:26px;font-weight:500;letter-spacing:3px;text-transform:uppercase;color:var(--text);margin-bottom:6px;}
.tela-menu-meta-ads .smenu-headline p{font-family:var(--fonte-principal);font-size:12px;color:var(--muted);}
.tela-menu-meta-ads .smenu-cards{display:flex;gap:22px;flex-wrap:wrap;justify-content:center;}
.tela-menu-meta-ads .smenu-card{position:relative;width:270px;min-height:210px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-xl);padding:30px 24px 48px;cursor:pointer;transition:all .25s;display:flex;flex-direction:column;gap:14px;overflow:hidden;}
.tela-menu-meta-ads .smenu-card::before{content:'';position:absolute;inset:0;background:var(--accent);opacity:0;transition:opacity .2s;border-radius:18px;}
.tela-menu-meta-ads .smenu-card:hover::before{opacity:.05;}
.tela-menu-meta-ads .smenu-card:hover{border-color:var(--accent);transform:translateY(-3px);box-shadow:0 8px 32px rgba(0,0,0,.1);}
.tela-menu-meta-ads .smenu-card-num{font-family:var(--fonte-principal);font-size:10px;letter-spacing:3px;color:var(--muted);text-transform:uppercase;font-weight:600;}
.tela-menu-meta-ads .smenu-card-icon{width:48px;height:48px;background:var(--accent);border-radius:12px;display:flex;align-items:center;justify-content:center;}
.tela-menu-meta-ads .smenu-card-title{font-family:var(--fonte-principal);font-size:18px;font-weight:500;letter-spacing:1.5px;text-transform:uppercase;color:var(--text);line-height:1.2;}
.tela-menu-meta-ads .smenu-card-desc{font-family:var(--fonte-principal);font-size:11px;color:var(--muted);line-height:1.7;}
.tela-menu-meta-ads .smenu-card-enter{position:absolute;bottom:16px;right:18px;font-size:18px;color:var(--muted);transition:all .2s;}
.tela-menu-meta-ads .smenu-card:hover .smenu-card-enter{transform:translateX(4px);color:var(--accent);}
.tela-menu-meta-ads .smenu-cards.view-list{flex-direction:column;align-items:stretch;gap:8px;width:100%;max-width:640px;}
.tela-menu-meta-ads .smenu-cards.view-list .smenu-card{width:100%;min-height:unset;flex-direction:row;padding:14px 18px 14px 20px;gap:16px;align-items:center;}
.tela-menu-meta-ads .smenu-cards.view-list .smenu-card-num{display:none;}
.tela-menu-meta-ads .smenu-cards.view-list .smenu-card-icon{width:42px;height:42px;border-radius:9px;flex-shrink:0;}
.tela-menu-meta-ads .smenu-cards.view-list .smenu-card-title{font-size:14px;letter-spacing:1px;}
.tela-menu-meta-ads .smenu-cards.view-list .smenu-card-desc{font-size:11px;margin:0;}
.tela-menu-meta-ads .smenu-cards.view-list .smenu-card-enter{position:static;margin-left:auto;}
@media(max-width:640px){
  .tela-menu-meta-ads .smenu-topbar{padding:8px 14px;flex-wrap:wrap;}
  .tela-menu-meta-ads .smenu-card{width:calc(50% - 11px);min-width:130px;min-height:auto;padding:20px 14px 34px;}
}
@media(max-width:380px){
  .tela-menu-meta-ads .smenu-card{width:100%;}
}
</style>
