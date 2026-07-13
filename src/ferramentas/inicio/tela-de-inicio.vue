<template>
  <div class="tela-inicio">
    <div class="home-header">
      <div class="home-header-brand">
        <img class="rbv-logo rbv-logo-light" :src="logoClaroUrl" alt="RBV">
        <img class="rbv-logo rbv-logo-dark" :src="logoEscuroUrl" alt="RBV">
        <h1>Inteligência RBV</h1>
      </div>
      <!-- No legado (#home-header-user) este bloco também nasce com
           display:none e nunca é revelado por script nenhum — o badge de
           usuário exibido de fato é o global (setGlobalUserBtn, fora do
           escopo desta tela). Mantemos a mesma aparência (oculto) aqui;
           o e-mail já fica amarrado ao estado para quando isso mudar. -->
      <div class="home-header-user" style="display:none">
        <span class="user-badge">
          <span id="home-user-email">{{ estado.user?.email }}</span>
          <!-- Papel (admin/viewer) depende do sistema de permissões, que
               ainda não foi portado para o Vue — fica vazio por enquanto. -->
          <span class="user-role-chip" id="home-user-role"></span>
        </span>
      </div>
    </div>
    <div class="home-main">
      <div class="home-toolbar">
        <span class="home-toolbar-label">Ferramentas</span>
        <div class="view-toggle">
          <button class="view-toggle-btn" :class="{ active: visualizacao === 'grid' }" id="vt-grid" @click="definirVisualizacao('grid')" title="Cards">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="0" y="0" width="6" height="6" rx="1"/><rect x="8" y="0" width="6" height="6" rx="1"/><rect x="0" y="8" width="6" height="6" rx="1"/><rect x="8" y="8" width="6" height="6" rx="1"/></svg>
          </button>
          <button class="view-toggle-btn" :class="{ active: visualizacao === 'list' }" id="vt-list" @click="definirVisualizacao('list')" title="Lista">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="0" y="1" width="14" height="2.5" rx="1"/><rect x="0" y="5.75" width="14" height="2.5" rx="1"/><rect x="0" y="10.5" width="14" height="2.5" rx="1"/></svg>
          </button>
        </div>
      </div>
      <div class="home-cards" :class="{ 'view-list': visualizacao === 'list' }" id="home-cards">
        <!-- Administração: rota já existe (src/ferramentas/admin/tela-de-admin.vue). -->
        <div class="home-card card-admin" id="home-card-admin" v-show="ehAdmin" @click="ir('admin')" @mouseenter="definirTemaFundo('admin')" @mouseleave="definirTemaFundo('default')">
          <div class="home-card-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
          </div>
          <div class="home-card-text">
            <h3>Administração</h3>
            <p>Controle total da Central de Inteligência</p>
          </div>
          <span class="home-card-enter">→</span>
        </div>
        <div class="home-card" id="home-card-social" v-show="podeRedes" @click="irRedes" @mouseenter="definirTemaFundo('social')" @mouseleave="definirTemaFundo('default')">
          <div class="home-card-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          </div>
          <div class="home-card-text">
            <h3>Dashboard<br>Redes Sociais</h3>
            <p>Métricas e KPIs do Instagram para todas as marcas</p>
          </div>
          <span class="home-card-enter">→</span>
        </div>
        <!-- Dashboard de Vendas: Menu de Vendas + Gestão à Vista já migrados. -->
        <div class="home-card" id="home-card-sales" v-show="podeVendas" @click="ir('vendas')" @mouseenter="definirTemaFundo('sales')" @mouseleave="definirTemaFundo('default')">
          <div class="home-card-icon" style="background:linear-gradient(135deg,#1d4ed8 0%,#2563eb 100%)">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          </div>
          <div class="home-card-text">
            <h3>Dashboard<br>de Vendas</h3>
            <p>Gestão à vista, análise por loja e vendedor</p>
          </div>
          <span class="home-card-enter">→</span>
        </div>
        <!-- Meta Ads: Menu + Análise de Campanhas já migrados. -->
        <div class="home-card" id="home-card-meta" v-show="podeMeta" @click="ir('meta-ads')" @mouseenter="definirTemaFundo('meta')" @mouseleave="definirTemaFundo('default')">
          <div class="home-card-icon" style="background:linear-gradient(135deg,#1877F2 0%,#0062E0 100%)">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <div class="home-card-text">
            <h3>Meta<br>Ads</h3>
            <p>Análise de campanhas e gestão de tráfego pago</p>
          </div>
          <span class="home-card-enter">→</span>
        </div>
        <!-- Banco de Arquivos: rota ainda não existe. -->
        <div class="home-card" id="home-card-banco" v-show="podeBanco" @click="ir('banco')">
          <div class="home-card-icon" style="background:linear-gradient(135deg,#0f4c81 0%,#1d4ed8 100%)">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/></svg>
          </div>
          <div class="home-card-text">
            <h3>Banco de<br>Arquivos</h3>
            <p>Downloads e uploads de materiais e recursos visuais</p>
          </div>
          <span class="home-card-enter">→</span>
        </div>
        <!-- Portal de Notícias: única ferramenta já migrada, navega de verdade. -->
        <div class="home-card" id="home-card-noticias" v-show="podeNoticias" @click="ir('noticias')" @mouseenter="definirTemaFundo('default')" @mouseleave="definirTemaFundo('default')">
          <div class="home-card-icon" style="background:linear-gradient(135deg,#0f4c81 0%,#1d4ed8 100%)">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v16a2 2 0 0 1-2 2 2 2 0 0 1-2-2V9a1 1 0 0 1 1-1h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8z"/></svg>
          </div>
          <div class="home-card-text">
            <h3>Portal de<br>Notícias</h3>
            <p>Inteligência de concorrentes por marca, atualizada toda semana</p>
          </div>
          <span class="home-card-enter">→</span>
        </div>
        <div class="home-card" id="home-card-gestor" v-show="podeGestor" @click="ir('gestao-comercial')" @mouseenter="definirTemaFundo('default')" @mouseleave="definirTemaFundo('default')">
          <div class="home-card-icon" style="background:linear-gradient(135deg,#0f4c81 0%,#1d4ed8 100%)">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>
          </div>
          <div class="home-card-text">
            <h3>Gestão<br>Comercial</h3>
            <p>Briefing semanal do gestor de IA: metas, concorrência e estoque</p>
          </div>
          <span class="home-card-enter">→</span>
        </div>
        <!-- Colaboradores e Acessos: única ferramenta além de Notícias já migrada, navega de verdade. -->
        <div class="home-card" id="home-card-acessos" v-show="podeAcessos" @click="ir('acessos')">
          <div class="home-card-icon" style="background:linear-gradient(135deg,#0f766e 0%,#0d9488 100%)">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <div class="home-card-text">
            <h3>Colaboradores<br>e Acessos</h3>
            <p>Pessoas, dispositivos e termo de responsabilidade</p>
          </div>
          <span class="home-card-enter">→</span>
        </div>
        <div class="home-card" id="home-card-claude-status" v-show="podeClaudeStatus" @click="ir('claude-status')" @mouseenter="definirTemaFundo('default')" @mouseleave="definirTemaFundo('default')">
          <div class="home-card-icon" style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%)">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <div class="home-card-text">
            <h3>Painel de Status<br>do Claude</h3>
            <p>Robôs de IA, custo por ação e status dos projetos em desenvolvimento</p>
          </div>
          <span class="home-card-enter">→</span>
        </div>
        <!-- Escritório 3D dos Agentes: rota ainda não existe. -->
        <div class="home-card" id="home-card-hq3d" @click="abrirEscritorio3D" @mouseenter="definirTemaFundo('default')" @mouseleave="definirTemaFundo('default')">
          <div class="home-card-icon" style="background:linear-gradient(135deg,#0d9488 0%,#16a89a 100%)">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><line x1="9" y1="9" x2="9" y2="9.01"/><line x1="9" y1="13" x2="9" y2="13.01"/><line x1="9" y1="17" x2="9" y2="17.01"/></svg>
          </div>
          <div class="home-card-text">
            <h3>Escritório 3D<br>dos Agentes</h3>
            <p>HQ navegável com os agentes de IA e status ao vivo</p>
          </div>
          <span class="home-card-enter">→</span>
        </div>
      </div>
    </div>
    <footer class="home-footer">
      <div class="home-footer-phrase">Mentalidade Vencedora</div>
    </footer>

    <div class="tela-inicio-aviso" v-if="avisoFerramenta">{{ avisoFerramenta }}</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { estado, hasPermission } from '../../compartilhado/controle-de-login-e-usuario.js'

const router = useRouter()

// Card de Administração só aparece pra quem é admin (a rota /admin já existe).
const ehAdmin = computed(() => estado.is_superadmin)
// Cada card só aparece pra quem tem 'ver' no recurso (o de Admin é gateado por super-admin acima).
const podeRedes = computed(() => hasPermission('social', 'ver') || hasPermission('social.relatorio', 'ver'))
const podeVendas = computed(() => hasPermission('sales.gestao', 'ver') || hasPermission('sales.analise', 'ver'))
const podeMeta = computed(() => hasPermission('meta.campanha', 'ver') || hasPermission('meta.gestor', 'ver'))
const podeBanco = computed(() => hasPermission('banco', 'ver'))
const podeNoticias = computed(() => hasPermission('noticias', 'ver'))
const podeGestor = computed(() => hasPermission('gestor', 'ver'))
const podeAcessos = computed(() => hasPermission('acessos', 'ver'))
const podeClaudeStatus = computed(() => hasPermission('claude.status', 'ver'))

// Caminho absoluto: servido em produção via rewrite do Vercel (/midia/:path*),
// igual ao legado. Ligação dinâmica (:src) evita que o Vite tente resolver
// o caminho como módulo em tempo de build (mesmo padrão de tela-de-login.vue).
const logoClaroUrl = '/midia/LOGOTIPOBRENOPRETO.png'
const logoEscuroUrl = '/midia/LOGOTIPOBRENOBRANCO.png'

// Navegação real — só existe rota para as ferramentas já migradas.
function ir(nome) {
  router.push({ name: nome })
}

// Redes Sociais: admin vê o submenu (Dashboard + Relatório); os demais vão direto
// pra dashboard (só têm 1 opção, então o submenu seria inútil pra eles).
function irRedes() {
  router.push({ name: ehAdmin.value ? 'redes' : 'redes-sociais' })
}

// Escritório 3D dos Agentes: página estática (three.js) servida em public/escritorio-3d/.
// Abre em nova aba, igual ao openEscritorio3D() do legado.
function abrirEscritorio3D() {
  window.open('/escritorio-3d/index.html', '_blank')
}

// Ferramentas cuja rota ainda não existe na versão Vue (equivalente aos
// antigos openAdmin()/openDashboard()/openMetaAds()/openEscritorio3D() do
// legado — openSalesDashboard()/openBanco()/openAcessos() já viraram rotas
// reais).
// Quando cada uma ganhar sua rota própria em src/mapa-de-enderecos.js,
// troque a chamada do card correspondente por router.push({ name: '...' })
// (igual ao card de Notícias, que já é real).
const avisoFerramenta = ref('')
let avisoTimer = null
function aindaNaoMigrada(nome) {
  avisoFerramenta.value = `A ferramenta "${nome}" ainda será migrada.`
  clearTimeout(avisoTimer)
  avisoTimer = setTimeout(() => { avisoFerramenta.value = '' }, 3200)
}

// Alternância grade/lista (equivalente a setHomeView do legado), com a
// mesma persistência em localStorage.
const visualizacao = ref(localStorage.getItem('home-view') || 'grid')
function definirVisualizacao(v) {
  visualizacao.value = v
  localStorage.setItem('home-view', v)
}

// Tema do fundo animado ao passar o mouse nos cards (equivalente a
// setHomeBgTheme do legado). O fundo em si (#bg-shapes) é uma camada
// global fora do escopo desta tela — ainda não existe como componente
// Vue — então por enquanto só guardamos o tema reativo aqui, pronto para
// ser consumido quando essa camada for portada.
const temaFundo = ref('default')
function definirTemaFundo(tipo) {
  temaFundo.value = tipo
}

onMounted(() => {
  definirVisualizacao(visualizacao.value)
})
</script>

<style scoped>
/* Peeled from legacy #home-screen (estilos-globais.css) — display:none
   removido porque no Vue quem controla a visibilidade é o vue-router
   (o componente só existe no DOM quando a rota está ativa). */
.tela-inicio{min-height:100vh;display:flex;flex-direction:column;background:transparent;position:relative;z-index:1;}

.tela-inicio-aviso{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:var(--text);color:var(--bg);font-family:'IBM Plex Sans',sans-serif;font-size:12.5px;padding:10px 18px;border-radius:8px;box-shadow:var(--shadow-lg);z-index:9999;}
</style>
