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
        <button class="ctd-btn" @click="anotando = !anotando">+ Anotar ideia</button>
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

    <!-- Anotar uma ideia na mão -->
    <div v-if="anotando" class="ctd-campo ctd-anotar">
      <label class="ctd-rot" for="ctd-nova-ideia">A ideia, do jeito que vier</label>
      <input
        id="ctd-nova-ideia"
        v-model="rascunhoIdeia"
        class="ctd-in"
        placeholder="Ex.: bastidor da montagem da vitrine nova"
        @keyup.enter="anotar"
      >
      <div class="ctd-peca-acoes">
        <button class="ctd-btn ctd-btn-primario" :disabled="!rascunhoIdeia.trim()" @click="anotar">Anotar</button>
        <button class="ctd-btn" @click="anotando = false">Cancelar</button>
      </div>
    </div>

    <div v-if="!visiveis.length" class="ctd-vazio">
      <h3>{{ ideias.length ? 'Nada com esse filtro' : 'Nenhuma ideia ainda' }}</h3>
      <p v-if="!ideias.length">
        Aqui ficam as pautas sem compromisso: sem arte, sem data. Anote as suas, ou peça para a IA
        sugerir a partir do que já funcionou nesta marca.
      </p>
    </div>

    <div v-else class="ctd-ideias-grade">
      <article v-for="ideia in visiveis" :key="ideia.id" class="ctd-ideia" :class="{ usada: ideia.situacao === 'usada' }">
        <header class="ctd-ideia-cab">
          <span v-if="ideia.origem === 'ia'" class="ctd-ideia-selo" title="Sugerida pela IA"><IconeFaisca /></span>
          <h3 class="ctd-ideia-titulo">{{ ideia.titulo }}</h3>
          <button
            class="ctd-mini-btn"
            :title="ideia.situacao === 'favorita' ? 'Tirar dos favoritos' : 'Favoritar'"
            @click="alternarFavorita(ideia)"
          ><IconeEstrela :cheia="ideia.situacao === 'favorita'" /></button>
        </header>

        <div class="ctd-ideia-tags">
          <span v-if="ideia.formato" class="ctd-formato">{{ nomeDoFormato(ideia.formato) }}</span>
          <span v-if="ideia.pilar" class="ctd-formato">{{ ideia.pilar }}</span>
        </div>

        <p v-if="ideia.gancho" class="ctd-ideia-gancho">“{{ ideia.gancho }}”</p>
        <p v-if="ideia.por_que_agora" class="ctd-ideia-porque"><b>Por que agora:</b> {{ ideia.por_que_agora }}</p>

        <details v-if="ideia.roteiro?.length" class="ctd-ideia-roteiro">
          <summary>Roteiro ({{ ideia.roteiro.length }} cenas)</summary>
          <ol>
            <li v-for="(c, i) in ideia.roteiro" :key="i">
              {{ c.fala }}<span v-if="c.duracao_s"> ({{ c.duracao_s }}s)</span>
            </li>
          </ol>
        </details>

        <footer class="ctd-ideia-rodape">
          <button
            v-if="ideia.situacao !== 'usada'"
            class="ctd-btn ctd-btn-primario"
            :disabled="trabalhando"
            @click="virarPeca(ideia)"
          >Virar peça</button>
          <span v-else class="ctd-ajuda ctd-ideia-feita"><IconeCerto /> Já virou peça</span>
          <button
            v-if="ideia.situacao !== 'usada'"
            class="ctd-mini-btn perigo"
            title="Descartar"
            @click="descartar(ideia)"
          >×</button>
        </footer>
      </article>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { IconeEstrela, IconeFaisca, IconeCerto } from './icones.js'
import { regrasDoFormato } from './formatos.js'
import * as dados from './dados-conteudo.js'

const props = defineProps({
  ideias: { type: Array, default: () => [] },
  accountId: { type: String, required: true },
})

const emit = defineEmits(['mudou', 'abrir-peca'])

const filtro = ref('')
const erro = ref('')
const job = ref(null)
const anotando = ref(false)
const rascunhoIdeia = ref('')
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

async function anotar() {
  const titulo = rascunhoIdeia.value.trim()
  if (!titulo) return
  try {
    await dados.criarIdeia({ account_id: props.accountId, titulo })
    rascunhoIdeia.value = ''
    anotando.value = false
    emit('mudou')
  } catch (e) {
    erro.value = e.message
  }
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
