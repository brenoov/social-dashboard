<template>
  <!-- Tela de UMA peça. É o destino do aviso da hora H, então é pensada para o
       celular: a arte grande, a legenda pronta para copiar e dois botões
       grandes. Quem chega aqui está em pé, na frente do Instagram aberto. -->
  <div class="ctd-tela">
    <div class="ctd-topbar">
      <div class="ctd-tb-left">
        <button class="ctd-back" @click="router.push({ name: 'conteudo' })">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Central de Conteúdo
        </button>
      </div>
      <span class="ctd-title">Hora de publicar</span>
    </div>

    <div class="ctd-body">
      <div v-if="carregando" class="ctd-vazio"><p>Carregando…</p></div>

      <div v-else-if="!peca" class="ctd-vazio">
        <h3>Peça não encontrada</h3>
        <p>Ela pode ter sido excluída, ou você não tem acesso ao perfil dela.</p>
      </div>

      <div v-else class="ctd-peca-wrap">
        <p v-if="erro" class="ctd-aviso ctd-aviso-erro">{{ erro }}</p>

        <div>
          <h1 class="ctd-cal-mes">{{ peca.titulo }}</h1>
          <p class="ctd-ajuda">
            <span class="ctd-pip" :style="{ color: corDeStatus(peca.status) }">{{ rotuloDeStatus(peca.status) }}</span>
            · {{ nomeDoFormato }}
            · {{ peca.publicar_em ? dataHoraBRT(peca.publicar_em) : 'sem data marcada' }}
          </p>
        </div>

        <div v-if="arquivos.length" class="ctd-peca-midia">
          <template v-for="a in arquivos" :key="a.id">
            <img v-if="a.tipo === 'imagem' && urls[a.caminho]" :src="urls[a.caminho]" :alt="peca.titulo">
            <video v-else-if="a.tipo === 'video' && urls[a.caminho]" :src="urls[a.caminho]" controls playsinline></video>
          </template>
        </div>
        <div v-else class="ctd-aviso ctd-aviso-atencao">
          Esta peça não tem nenhum arquivo. Suba a arte antes de publicar.
        </div>

        <div>
          <span class="ctd-rot">Legenda — já com as hashtags</span>
          <div class="ctd-peca-legenda">{{ legendaFinal || '(sem legenda)' }}</div>
        </div>

        <div class="ctd-peca-acoes">
          <button class="ctd-btn" @click="copiar">{{ copiado ? '✓ Copiado' : 'Copiar legenda' }}</button>
          <button v-if="baixavel" class="ctd-btn" @click="baixar">Baixar arquivos</button>
        </div>

        <div class="ctd-peca-acoes">
          <button
            v-if="peca.status === 'agendada'"
            class="ctd-btn ctd-btn-primario"
            :disabled="trabalhando"
            @click="marcarPublicada"
          >Já publiquei</button>

          <button v-if="peca.status === 'agendada'" class="ctd-btn" :disabled="trabalhando" @click="adiando = !adiando">
            Adiar
          </button>
        </div>

        <div v-if="adiando" class="ctd-campo">
          <label class="ctd-rot" for="ctd-adiar">Nova data e hora (Brasília)</label>
          <input id="ctd-adiar" v-model="novaData" type="datetime-local" class="ctd-in">
          <div class="ctd-peca-acoes">
            <button class="ctd-btn ctd-btn-primario" :disabled="!novaData || trabalhando" @click="adiar">Confirmar</button>
            <button class="ctd-btn" @click="adiando = false">Cancelar</button>
          </div>
        </div>

        <p v-if="peca.status === 'publicada'" class="ctd-aviso">
          <b>Publicada</b> em {{ dataHoraBRT(peca.publicado_em) }}.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { rotuloDeStatus, corDeStatus } from './estados.js'
import { regrasDoFormato } from './formatos.js'
import { montarLegendaFinal } from './legenda.js'
import { dataHoraBRT, deCampoDeDataHora } from './grade-do-calendario.js'
import * as dados from './dados-conteudo.js'
import './estilos-conteudo.css'

const props = defineProps({ id: { type: String, required: true } })

const router = useRouter()

const peca = ref(null)
const arquivos = ref([])
const urls = ref({})
const carregando = ref(true)
const erro = ref('')
const copiado = ref(false)
const trabalhando = ref(false)
const adiando = ref(false)
const novaData = ref('')

const legendaFinal = computed(() =>
  peca.value ? montarLegendaFinal(peca.value.legenda, peca.value.hashtags) : '',
)
const nomeDoFormato = computed(() => regrasDoFormato(peca.value?.formato)?.rotulo || '—')
const baixavel = computed(() => arquivos.value.some(a => urls.value[a.caminho]))

async function carregar() {
  try {
    peca.value = await dados.carregarPeca(props.id)
    if (!peca.value) return
    arquivos.value = await dados.listarArquivos(peca.value.id)
    urls.value = await dados.urlsAssinadas(arquivos.value.map(a => a.caminho))
  } catch (e) {
    erro.value = e.message
  } finally {
    carregando.value = false
  }
}

async function copiar() {
  try {
    await navigator.clipboard.writeText(legendaFinal.value)
    copiado.value = true
    setTimeout(() => { copiado.value = false }, 2200)
  } catch {
    erro.value = 'O navegador não deixou copiar. Selecione o texto da legenda e copie na mão.'
  }
}

function baixar() {
  // Uma aba por arquivo. No iPhone o usuário segura a imagem e salva na galeria;
  // é o caminho que funciona sem app nenhum instalado.
  for (const a of arquivos.value) {
    const url = urls.value[a.caminho]
    if (url) window.open(url, '_blank')
  }
}

async function marcarPublicada() {
  trabalhando.value = true
  erro.value = ''
  try {
    peca.value = await dados.mudarStatus(peca.value, 'publicada')
  } catch (e) {
    erro.value = e.message
  } finally {
    trabalhando.value = false
  }
}

async function adiar() {
  trabalhando.value = true
  erro.value = ''
  try {
    // mudarStatus para 'agendada' limpa o avisado_em — sem isso a peça remarcada
    // nunca mais dispararia o aviso.
    peca.value = await dados.mudarStatus(peca.value, 'agendada', {
      publicar_em: deCampoDeDataHora(novaData.value),
    })
    adiando.value = false
  } catch (e) {
    erro.value = e.message
  } finally {
    trabalhando.value = false
  }
}

onMounted(carregar)
</script>
