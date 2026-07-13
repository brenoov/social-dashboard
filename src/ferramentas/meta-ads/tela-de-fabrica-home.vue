<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { hasPermission } from '../../compartilhado/controle-de-login-e-usuario.js'
import { sb } from '../../compartilhado/buscar-e-salvar-dados.js'
import { sbClient } from '../../compartilhado/conectar-no-banco-de-dados.js'
import TourCoachmark from './tour-coachmark.vue'
import { CHECKLIST, COACH } from './tutorial-fabrica.js'
import './estudio.css'
const router = useRouter()
const CHK_KEY = 'fabrica_checklist_v1', TOUR_KEY = 'fabrica_tour_v1'
const tourAberto = ref(false)
const feitos = ref((localStorage.getItem(CHK_KEY) || '').split(',').filter(Boolean))
const mostrarChecklist = ref(localStorage.getItem('fabrica_checklist_hide_v1') !== '1')
function feito(id) { return feitos.value.includes(id) || (id === 'publicar' && publicadas.value.length > 0) }
function irChecklist(item) {
  if (!feitos.value.includes(item.id)) { feitos.value.push(item.id); localStorage.setItem(CHK_KEY, feitos.value.join(',')) }
  router.push({ name: item.rota })
}
function ocultarChecklist() { mostrarChecklist.value = false; localStorage.setItem('fabrica_checklist_hide_v1', '1') }
function mostrarChecklistDeNovo() { mostrarChecklist.value = true; localStorage.removeItem('fabrica_checklist_hide_v1') }
function reverTour() { tourAberto.value = true }
const emCriacao = ref([])       // fabrica_campanhas em criação (com contagem de criativos)
const publicadas = ref([])
const nums = ref({ criando: 0, criativos: 0, publicadas: 0 })
let timer = null

async function carregar() {
  if (!hasPermission('module:meta:fabrica')) { router.push({ name: 'meta-ads' }); return }
  // em criação
  const camp = await sb("fabrica_campanhas?select=id,nome,status,created_at&fechada_em=is.null&purgado_em=is.null&status=in.(gerando,pronta,erro)&order=created_at.desc")
  // contagem de criativos por campanha (uma consulta por campanha; volume pequeno)
  for (const c of camp) {
    const { count } = await sbClient.from('fabrica_criativos').select('id', { count: 'exact', head: true }).eq('campanha_id', c.id)
    c.qtd = count || 0
  }
  emCriacao.value = camp
  publicadas.value = await sb("fabrica_campanhas?select=id,nome,fechada_em&fechada_em=not.is.null&order=fechada_em.desc&limit=8")
  const { count: totCri } = await sbClient.from('fabrica_criativos').select('id', { count: 'exact', head: true })
  nums.value = { criando: camp.length, criativos: totCri || 0, publicadas: publicadas.value.length }
}
const temGerando = computed(() => emCriacao.value.some((c) => c.status === 'gerando'))
function statusLabel(c) { return c.status === 'gerando' ? `Gerando… ${c.qtd} criativos` : c.status === 'pronta' ? 'Pronta pra curar' : 'Deu erro ao gerar' }
function abrir(c) { router.push({ name: 'fabrica-campanha', params: { id: c.id } }) }
function nova() { router.push({ name: 'fabrica-nova' }) }
function abrirLooks() { router.push({ name: 'fabrica-looks' }) }
function voltarCentral() { router.push({ name: 'inicio' }) }
const GERENCIADOR = 'https://adsmanager.facebook.com/adsmanager/'
async function apagar(c) {
  if (!confirm(`Apagar a campanha "${c.nome}"? ${c.status === 'gerando' ? 'A geração em andamento será cancelada. ' : ''}Isso remove os criativos e não dá pra desfazer.`)) return
  const { error } = await sbClient.functions.invoke('fabrica-apagar', { body: { campanhaId: c.id } })
  if (error) return alert('Falha ao apagar: ' + error.message)
  carregar()
}
onMounted(() => {
  carregar()
  timer = setInterval(() => { if (temGerando.value) carregar() }, 4000)
  if (localStorage.getItem(TOUR_KEY) !== '1') { localStorage.setItem(TOUR_KEY, '1'); setTimeout(() => { tourAberto.value = true }, 600) }
})
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>
<template>
  <div class="fest">
    <div class="shell">
      <header class="topbar">
        <button class="voltar-central" @click="voltarCentral" aria-label="Voltar para a Central">← Central</button>
        <div class="brand"><div class="t">Fábrica de Anúncios</div><div class="s">Painel</div></div>
        <div class="divider"></div>
        <button class="voltar-central" @click="reverTour">Rever tour</button>
        <button class="cmd amber" data-tour="nova-campanha" @click="nova"><span class="ci">▶</span> Nova campanha</button>
      </header>

      <!-- números -->
      <div class="readout" data-tour="numeros">
        <div class="c"><div class="k">Em criação</div><div class="v mono">{{ nums.criando }}</div></div>
        <div class="c"><div class="k">Criativos gerados</div><div class="v mono">{{ nums.criativos }}</div></div>
        <div class="c"><div class="k">Publicadas</div><div class="v mono">{{ nums.publicadas }}</div></div>
      </div>

      <!-- primeiros passos -->
      <div v-if="mostrarChecklist" class="panel">
        <div class="ph"><span class="eyebrow">Primeiros passos</span>
          <button class="mini" @click="ocultarChecklist">Ocultar</button></div>
        <div class="chk-list">
          <div v-for="item in CHECKLIST" :key="item.id" class="chk-item" :class="{ ok: feito(item.id) }">
            <span class="chk-mark">{{ feito(item.id) ? '✓' : '' }}</span>
            <div class="chk-body"><div class="chk-tit">{{ item.titulo }}</div><div class="chk-txt">{{ item.texto }}</div></div>
            <button class="mini" @click="irChecklist(item)">ir</button>
          </div>
        </div>
      </div>
      <p v-else class="empty"><a href="#" @click.prevent="mostrarChecklistDeNovo">mostrar primeiros passos</a></p>

      <!-- em criação -->
      <div class="panel" data-tour="em-criacao">
        <div class="ph"><span class="eyebrow">Campanhas em criação</span></div>
        <div v-if="emCriacao.length" class="home-list">
          <div v-for="c in emCriacao" :key="c.id" class="home-card" :class="c.status">
            <div class="hc-main">
              <div class="hc-nome">{{ c.nome }}</div>
              <div class="hc-status"><i class="led" :class="c.status==='pronta' ? 'go' : c.status==='erro' ? 'abort' : 'run'"></i>{{ statusLabel(c) }}</div>
            </div>
            <div class="hc-acoes">
              <button class="cmd cyan" @click="abrir(c)">Abrir</button>
              <button class="hc-apagar" @click="apagar(c)" aria-label="Apagar">🗑</button>
            </div>
          </div>
        </div>
        <p v-else class="empty">Nenhuma campanha em criação. Clique "Nova campanha" pra começar.</p>
      </div>

      <!-- publicadas -->
      <div class="panel" data-tour="publicadas">
        <div class="ph"><span class="eyebrow">Publicadas recentes</span></div>
        <div v-if="publicadas.length" class="home-list">
          <div v-for="c in publicadas" :key="c.id" class="home-card">
            <div class="hc-main"><div class="hc-nome">{{ c.nome }}</div></div>
            <a class="cmd" :href="GERENCIADOR" target="_blank">Ver no Gerenciador ↗</a>
          </div>
        </div>
        <p v-else class="empty">Nada publicado ainda.</p>
      </div>

      <!-- atalho templates (SP-5A) -->
      <div class="panel" data-tour="looks-card">
        <div class="ph"><span class="eyebrow">Looks & Templates</span></div>
        <div class="home-list">
          <div class="home-card">
            <div class="hc-main">
              <div class="hc-nome">Galeria de looks</div>
              <div class="hc-status">Gerencie, ative/desative e reordene os looks usados na geração</div>
            </div>
            <button class="cmd cyan" @click="abrirLooks">Abrir</button>
          </div>
        </div>
      </div>
      <TourCoachmark :passos="COACH" v-model="tourAberto" />
    </div>
  </div>
</template>
