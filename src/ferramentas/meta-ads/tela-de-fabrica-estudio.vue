<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import BarraDeTopo from '../../compartilhado/barra-de-topo.vue'
import { useRoute, useRouter } from 'vue-router'
import { hasPermission } from '../../compartilhado/controle-de-login-e-usuario.js'
import { sb } from '../../compartilhado/buscar-e-salvar-dados.js'
import PainelGerar from './painel-gerar.vue'
import PainelCurar from './painel-curar.vue'
import PainelSubir from './painel-subir.vue'
import PainelConferir from './painel-conferir.vue'
import './estudio.css'
const route = useRoute(); const router = useRouter()
function voltarHome() { router.push({ name: 'fabrica-estudio' }) }
const logoClaroUrl = '/midia/LOGOTIPOBRENOPRETO.png'
const logoEscuroUrl = '/midia/LOGOTIPOBRENOBRANCO.png'
const campanhaId = ref(route.params.id || null)
const passo = ref(campanhaId.value ? 'curar' : 'gerar')
const subirResultado = ref(null)
const retomarSubirJobId = ref(null)
// Resume: o subir cria as campanhas num job (fabrica_jobs, alguns min). Se o usuário sai e volta,
// o subirResultado (só em memória) se perdia e o Conferir sumia — mesmo com as campanhas já
// criadas. Ao (re)entrar numa campanha, busca o ÚLTIMO subir dela:
//   • concluído com anúncios → restaura o resultado e vai pro Conferir (destrava ativar/revisar);
//   • ainda rodando/na fila → volta pro Subir e RETOMA o banner/polling (passa o jobId pro painel),
//     travando re-clique (senão criava campanha duplicada) e auto-avançando pro Conferir ao concluir.
async function resumirSubir(id) {
  subirResultado.value = null
  retomarSubirJobId.value = null
  if (!id) return
  try {
    const jobs = await sb(`fabrica_jobs?select=id,status,resultado&tipo=eq.subir&params->>campanhaId=eq.${id}&order=created_at.desc&limit=1`)
    const j = jobs?.[0]
    if (!j) return
    if (j.status === 'concluido' && j.resultado?.adIds?.length) { subirResultado.value = j.resultado; passo.value = 'conferir' }
    else if (['enfileirado', 'rodando'].includes(j.status)) { retomarSubirJobId.value = j.id; passo.value = 'subir' }
  } catch (e) { /* resume é best-effort — não trava a tela */ }
}
watch(() => route.params.id, (id) => {
  campanhaId.value = id || null
  passo.value = id ? 'curar' : 'gerar'
  resumirSubir(id)
})
onMounted(() => {
  if (!hasPermission('module:meta:fabrica')) { router.push({ name: 'meta-ads' }); return }
  resumirSubir(campanhaId.value)
})
// nova campanha: ao disparar, navega pra /:id (a tela recarrega já como campanha, no Curar)
function aoGerar(id) { router.push({ name: 'fabrica-campanha', params: { id } }) }
function aoSubir(res) { subirResultado.value = res; passo.value = 'conferir' }

// --- extras de apresentação (não interferem na lógica acima) ---
const ordem = ['gerar', 'curar', 'subir', 'conferir']
const idxAtual = computed(() => ordem.indexOf(passo.value))
// Botão "Avançar" por etapa (Gerar já avança ao gerar; Conferir é o último).
const podeAvancar = computed(() => {
  if (passo.value === 'curar') return !!campanhaId.value
  if (passo.value === 'subir') return !!subirResultado.value // habilita depois que a subida rodou
  return false
})
function avancar() {
  if (passo.value === 'curar') passo.value = 'subir'
  else if (passo.value === 'subir') passo.value = 'conferir'
}
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
      <barra-de-topo voltar="Fábrica" titulo="Estúdio de Criativos" @voltar="voltarHome">
        <template #acoes>
  <div class="sys">
            <span class="sig"><i class="led go"></i>Banco de dados</span>
            <span class="sig"><i class="led go"></i>Meta (anúncios)</span>
            <span class="sig"><i class="led" :class="passo==='conferir' ? 'run' : 'idle'"></i>Publicando</span>
            <span class="sig"><i class="led hold"></i>Limite da Meta</span>
          </div>
        </template>
      </barra-de-topo>

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
          <PainelSubir v-else-if="passo==='subir'" :campanha-id="campanhaId" :retomar-job-id="retomarSubirJobId" @subido="aoSubir" />
          <PainelConferir v-else :subir-resultado="subirResultado" />
        </main>
      </div>

      <div class="foot">
        <span>Estúdio de Criativos</span>
        <span>Passo {{ idxAtual + 1 }} de 4</span>
        <button v-if="passo==='curar' || passo==='subir'" class="cmd cyan" :disabled="!podeAvancar" @click="avancar"
          :title="passo==='subir' && !podeAvancar ? 'Suba os anúncios primeiro' : ''">
          Avançar → {{ passo==='curar' ? 'Subir' : 'Conferir' }}
        </button>
      </div>
    </div>
  </div>
</template>
