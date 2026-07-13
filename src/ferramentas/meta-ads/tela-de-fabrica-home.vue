<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { hasPermission } from '../../compartilhado/controle-de-login-e-usuario.js'
import { sb } from '../../compartilhado/buscar-e-salvar-dados.js'
import { sbClient } from '../../compartilhado/conectar-no-banco-de-dados.js'
import './estudio.css'
const router = useRouter()
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
onMounted(() => { carregar(); timer = setInterval(() => { if (temGerando.value) carregar() }, 4000) })
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>
<template>
  <div class="fest">
    <div class="shell">
      <header class="topbar">
        <button class="voltar-central" @click="voltarCentral" aria-label="Voltar para a Central">← Central</button>
        <div class="brand"><div class="t">Fábrica de Anúncios</div><div class="s">Painel</div></div>
        <div class="divider"></div>
        <button class="cmd amber" @click="nova"><span class="ci">▶</span> Nova campanha</button>
      </header>

      <!-- números -->
      <div class="readout">
        <div class="c"><div class="k">Em criação</div><div class="v mono">{{ nums.criando }}</div></div>
        <div class="c"><div class="k">Criativos gerados</div><div class="v mono">{{ nums.criativos }}</div></div>
        <div class="c"><div class="k">Publicadas</div><div class="v mono">{{ nums.publicadas }}</div></div>
      </div>

      <!-- em criação -->
      <div class="panel">
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
      <div class="panel">
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
      <div class="panel">
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
    </div>
  </div>
</template>
