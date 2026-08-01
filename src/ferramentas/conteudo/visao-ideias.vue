<template>
  <div class="ctd-ideias">
    <div class="ctd-ideias-topo">
      <div class="ctd-lista-filtros">
        <button class="ctd-chip-filtro" :class="{ on: filtro === '' }" @click="filtro = ''">
          Todas ({{ ideias.length }})
        </button>
        <button class="ctd-chip-filtro" :class="{ on: filtro === 'favorita' }" @click="filtro = 'favorita'">
          <IconeEstrela cheia /> Favoritas ({{ contagem.favorita }})
        </button>
        <button class="ctd-chip-filtro" :class="{ on: filtro === 'ia' }" @click="filtro = 'ia'">
          Da IA ({{ contagem.ia }})
        </button>
        <button class="ctd-chip-filtro" :class="{ on: filtro === 'usada' }" @click="filtro = 'usada'">
          Já viraram post ({{ contagem.usada }})
        </button>
      </div>

      <div class="ctd-ideias-acoes">
        <button class="ctd-btn" @click="anotarNoModal">+ Anotar ideia</button>
        <button class="ctd-btn ctd-btn-primario" :disabled="!!job" @click="gerar">
          <IconeFaisca v-if="!job" /><span>{{ job ? 'Pensando…' : 'Gerar ideias com IA' }}</span>
        </button>
      </div>
    </div>

    <p v-if="erro" class="ctd-aviso ctd-aviso-erro">{{ erro }}</p>

    <p v-if="job" class="ctd-aviso">
      <b>A IA está montando as pautas.</b> Leva de 1 a 3 minutos — ela está lendo o que já foi
      publicado nesta marca, o que rendeu mais, o que já está na agenda e o que os concorrentes
      andam postando. Pode deixar a tela aberta.
    </p>

    <div v-if="!visiveis.length" class="ctd-vazio">
      <h3>{{ ideias.length ? 'Nada com esse filtro' : 'Nenhuma ideia ainda' }}</h3>
      <p v-if="!ideias.length">
        Aqui ficam as pautas sem compromisso: sem arte, sem data. Anote as suas, ou peça para a IA
        sugerir a partir do que já funcionou nesta marca.
      </p>
    </div>

    <div v-else class="ctd-ideias-grade">
      <!-- O cartão inteiro abre o roteiro. Quem vem de Trello já tenta clicar no
           cartão por instinto; obrigar a mirar num link seria atrito à toa.
           Os botões de dentro param a propagação para não abrirem junto. -->
      <article
        v-for="ideia in visiveis"
        :key="ideia.id"
        class="ctd-ideia ctd-ideia-abrivel"
        :class="{ usada: ideia.situacao === 'usada' }"
        role="button"
        tabindex="0"
        :aria-label="`Abrir o roteiro de ${ideia.titulo}`"
        @click="abrirIdeia(ideia)"
        @keydown.enter="abrirIdeia(ideia)"
        @keydown.space.prevent="abrirIdeia(ideia)"
      >
        <header class="ctd-ideia-cab">
          <span v-if="ideia.origem === 'ia'" class="ctd-ideia-selo" title="Sugerida pela IA"><IconeFaisca /></span>
          <h3 class="ctd-ideia-titulo">{{ ideia.titulo }}</h3>
          <button
            class="ctd-mini-btn"
            :title="ideia.situacao === 'favorita' ? 'Tirar dos favoritos' : 'Favoritar'"
            @click.stop="alternarFavorita(ideia)"
          ><IconeEstrela :cheia="ideia.situacao === 'favorita'" /></button>
        </header>

        <div class="ctd-ideia-tags">
          <span v-if="ideia.formato" class="ctd-formato">{{ nomeDoFormato(ideia.formato) }}</span>
          <span v-if="ideia.pilar" class="ctd-formato">{{ ideia.pilar }}</span>
        </div>

        <p v-if="ideia.gancho" class="ctd-ideia-gancho">“{{ ideia.gancho }}”</p>
        <p v-if="ideia.por_que_agora" class="ctd-ideia-porque"><b>Por que agora:</b> {{ ideia.por_que_agora }}</p>

        <!-- O resumo do roteiro. O passo a passo inteiro mora no painel: repetir
             aqui encheria o cartão e tiraria o motivo de abrir. -->
        <p v-if="ideia.roteiro?.length" class="ctd-ideia-roteiro-resumo">
          {{ ideia.roteiro.length }} {{ rotuloDoPasso(ideia.roteiro.length, ideia.formato) }}
          <template v-if="duracaoTotalEmSegundos(ideia.roteiro)">
            · {{ duracaoTotalEmSegundos(ideia.roteiro) }}s
          </template>
          <span>ver o roteiro</span>
        </p>

        <footer class="ctd-ideia-rodape">
          <button
            v-if="ideia.situacao !== 'usada'"
            class="ctd-btn ctd-btn-primario"
            :disabled="trabalhando"
            @click.stop="virarPeca(ideia)"
          >Virar peça</button>
          <span v-else class="ctd-ajuda ctd-ideia-feita"><IconeCerto /> Já virou peça</span>
          <button
            v-if="ideia.situacao !== 'usada'"
            class="ctd-mini-btn perigo"
            title="Descartar"
            @click.stop="descartar(ideia)"
          >×</button>
        </footer>
      </article>
    </div>

    <PainelIdeia
      v-if="aberta"
      :ideia="aberta"
      :account-id="accountId"
      :comecar-editando="criandoNova"
      @fechar="fecharPainel"
      @mudou="$emit('mudou')"
      @virar-peca="i => { fecharPainel(); virarPeca(i) }"
    />
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { IconeEstrela, IconeFaisca, IconeCerto } from './icones.js'
import { regrasDoFormato } from './formatos.js'
import { rotuloDoPasso, duracaoTotalEmSegundos } from './roteiro.js'
import PainelIdeia from './painel-ideia.vue'
import * as dados from './dados-conteudo.js'

const props = defineProps({
  ideias: { type: Array, default: () => [] },
  accountId: { type: String, required: true },
})

const emit = defineEmits(['mudou', 'abrir-peca'])

const filtro = ref('')
const erro = ref('')
const job = ref(null)
const aberta = ref(null)
const criandoNova = ref(false)
const trabalhando = ref(false)
let relogio = null

const contagem = computed(() => ({
  favorita: props.ideias.filter(i => i.situacao === 'favorita').length,
  ia: props.ideias.filter(i => i.origem === 'ia').length,
  usada: props.ideias.filter(i => i.situacao === 'usada').length,
}))

const visiveis = computed(() => {
  if (filtro.value === 'ia') return props.ideias.filter(i => i.origem === 'ia')
  if (filtro.value) return props.ideias.filter(i => i.situacao === filtro.value)
  // Sem filtro, o que já virou peça sai da frente: o banco de ideias serve para
  // o que ainda não foi feito.
  return props.ideias.filter(i => i.situacao !== 'usada')
})

function nomeDoFormato(chave) {
  return regrasDoFormato(chave)?.rotulo || chave
}

async function gerar() {
  erro.value = ''
  try {
    const r = await dados.pedirIdeiasParaIA(props.accountId, 12)
    job.value = r?.job_id || null
    if (job.value) acompanhar()
  } catch (e) {
    erro.value = e.message
  }
}

// A rodada leva minutos e roda fora daqui (GitHub Actions). Consultar de 5 em 5
// segundos é o suficiente para a tela não parecer travada.
//
// O LIMITE DE PACIÊNCIA não é excesso de zelo. Quem grava 'erro' no job é o
// próprio robô — então uma falha ANTES de ele começar (dependência faltando,
// GitHub fora do ar, disparo que não pegou) deixava o job em 'enfileirado' para
// sempre e esta tela girando a ampulheta sem fim, sem nada para clicar.
// Aconteceu de verdade. O workflow agora fecha o job por conta própria, mas
// isso depende de o workflow ter chegado a rodar; aqui é a garantia de que a
// tela sempre devolve o controle para a pessoa.
const PACIENCIA_MS = 10 * 60 * 1000

function acompanhar() {
  clearInterval(relogio)
  const comecou = Date.now()
  relogio = setInterval(async () => {
    if (Date.now() - comecou > PACIENCIA_MS) {
      clearInterval(relogio)
      job.value = null
      erro.value = 'A rodada demorou mais que o esperado e paramos de aguardar. '
        + 'Se as ideias aparecerem depois, é só recarregar a página. '
        + 'Você também pode tentar de novo.'
      return
    }
    const j = await dados.verJob(job.value)
    if (!j) return
    if (j.status === 'concluido') {
      clearInterval(relogio)
      job.value = null
      emit('mudou')
    } else if (j.status === 'erro') {
      clearInterval(relogio)
      job.value = null
      erro.value = `A IA não conseguiu desta vez: ${j.erro || 'motivo desconhecido'}`
    }
  }, 5000)
}

onUnmounted(() => clearInterval(relogio))

// "+ Anotar ideia" abre o MESMO painel do roteiro, em branco.
//
// Antes era um campo de título solto, e o resultado eram ideias de uma linha
// convivendo com roteiros completos na mesma lista — a anotada à mão nascia
// pobre por desenho. Agora a estrutura é a mesma; muda só quem preenche.
function anotarNoModal() {
  criandoNova.value = true
  aberta.value = { roteiro: [] }
}

function abrirIdeia(ideia) {
  criandoNova.value = false
  aberta.value = ideia
}

function fecharPainel() {
  aberta.value = null
  criandoNova.value = false
}

async function alternarFavorita(ideia) {
  try {
    await dados.mudarSituacaoDaIdeia(ideia.id, ideia.situacao === 'favorita' ? 'nova' : 'favorita')
    emit('mudou')
  } catch (e) {
    erro.value = e.message
  }
}

async function descartar(ideia) {
  try {
    await dados.mudarSituacaoDaIdeia(ideia.id, 'descartada')
    emit('mudou')
  } catch (e) {
    erro.value = e.message
  }
}

async function virarPeca(ideia) {
  trabalhando.value = true
  erro.value = ''
  try {
    const peca = await dados.ideiaViraPeca(ideia.id, props.accountId)
    emit('mudou')
    emit('abrir-peca', peca)
  } catch (e) {
    erro.value = e.message
  } finally {
    trabalhando.value = false
  }
}
</script>
