<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { hasPermission } from '../../compartilhado/controle-de-login-e-usuario.js'
import PainelGerar from './painel-gerar.vue'
import PainelCurar from './painel-curar.vue'
import PainelSubir from './painel-subir.vue'
import PainelConferir from './painel-conferir.vue'
import './estudio.css'
const route = useRoute(); const router = useRouter()
function voltarCentral() { router.push({ name: 'inicio' }) }
function voltarHome() { router.push({ name: 'fabrica-estudio' }) }
const campanhaId = ref(route.params.id || null)
const passo = ref(campanhaId.value ? 'curar' : 'gerar')
const subirResultado = ref(null)
onMounted(() => { if (!hasPermission('module:meta:fabrica')) router.push({ name: 'meta-ads' }) })
// nova campanha: ao disparar, navega pra /:id (a tela recarrega já como campanha, no Curar)
function aoGerar(id) { router.push({ name: 'fabrica-campanha', params: { id } }) }
function aoSubir(res) { subirResultado.value = res; passo.value = 'conferir' }

// --- extras de apresentação (não interferem na lógica acima) ---
const ordem = ['gerar', 'curar', 'subir', 'conferir']
const idxAtual = computed(() => ordem.indexOf(passo.value))
const relogio = ref('--:--:--')
let _clockTimer = null
onMounted(() => {
  const tick = () => {
    const d = new Date()
    relogio.value = [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':')
  }
  tick(); _clockTimer = setInterval(tick, 1000)
})
onUnmounted(() => { if (_clockTimer) clearInterval(_clockTimer) })
</script>
<template>
  <div class="fest">
    <div class="shell">
      <!-- BARRA DE STATUS -->
      <header class="topbar">
        <button class="voltar-central" @click="voltarCentral" aria-label="Voltar para a Central">← Central</button>
        <button class="voltar-central" @click="voltarHome" aria-label="Voltar para a Fábrica">← Fábrica</button>
        <div class="brand">
          <div class="t">Fábrica de Anúncios</div>
          <div class="s">Estúdio de Criativos</div>
        </div>
        <div class="sys">
          <span class="sig"><i class="led go"></i>Banco de dados</span>
          <span class="sig"><i class="led go"></i>Meta (anúncios)</span>
          <span class="sig"><i class="led" :class="passo==='conferir' ? 'run' : 'idle'"></i>Publicando</span>
          <span class="sig"><i class="led hold"></i>Limite da Meta</span>
        </div>
        <div class="divider"></div>
        <div class="clock">
          <div class="v num">{{ relogio }}</div>
          <small>Horário · BRT</small>
        </div>
      </header>

      <div class="grid">
        <!-- TRILHO DE PASSOS -->
        <aside>
          <nav class="panel seq" aria-label="Passos">
            <div class="ph"><span class="eyebrow">Passos</span><span class="eyebrow muted">4 etapas</span></div>
            <button class="step" :class="{ agora: passo==='gerar', feito: idxAtual > 0 }" @click="passo='gerar'">
              <span class="idx num">01</span>
              <span class="stbody"><span class="nm">1. Gerar</span><span class="st">criar os criativos</span></span>
              <i class="led rl" :class="passo==='gerar' ? 'hold' : idxAtual > 0 ? 'go' : 'idle'"></i>
            </button>
            <button class="step" :class="{ agora: passo==='curar', feito: idxAtual > 1 }" :disabled="!campanhaId" @click="passo='curar'">
              <span class="idx num">02</span>
              <span class="stbody"><span class="nm">2. Curar</span><span class="st">escolher os melhores</span></span>
              <i class="led rl" :class="passo==='curar' ? 'hold' : idxAtual > 1 ? 'go' : 'idle'"></i>
            </button>
            <button class="step" :class="{ agora: passo==='subir', feito: idxAtual > 2 }" :disabled="!campanhaId" @click="passo='subir'">
              <span class="idx num">03</span>
              <span class="stbody"><span class="nm">3. Subir</span><span class="st">publicar na Meta</span></span>
              <i class="led rl" :class="passo==='subir' ? 'hold' : idxAtual > 2 ? 'go' : 'idle'"></i>
            </button>
            <button class="step" :class="{ agora: passo==='conferir' }" :disabled="!subirResultado" @click="passo='conferir'">
              <span class="idx num">04</span>
              <span class="stbody"><span class="nm">4. Conferir</span><span class="st">decidir e ativar</span></span>
              <i class="led rl" :class="passo==='conferir' ? 'hold' : 'idle'"></i>
            </button>
          </nav>
        </aside>

        <!-- PALCO -->
        <main class="stage-wrap">
          <PainelGerar v-if="passo==='gerar'" @gerado="aoGerar" />
          <PainelCurar v-else-if="passo==='curar'" :campanha-id="campanhaId" />
          <PainelSubir v-else-if="passo==='subir'" :campanha-id="campanhaId" @subido="aoSubir" />
          <PainelConferir v-else :subir-resultado="subirResultado" />
        </main>
      </div>

      <div class="foot">
        <span>Estúdio de Criativos</span>
        <span>Passo {{ idxAtual + 1 }} de 4</span>
      </div>
    </div>
  </div>
</template>
