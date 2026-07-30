<template>
  <!-- O cartão da peça. UM só, usado pelo quadro, pela lista e pela gaveta de
       "sem data" — três cópias divergiriam na primeira semana. -->
  <button class="ctd-cartao" @click="$emit('abrir', peca)">
    <img v-if="miniatura" class="ctd-cartao-mini" :src="miniatura" :alt="peca.titulo">
    <span v-else class="ctd-cartao-mini">{{ iconeDoFormato }}</span>

    <span class="ctd-cartao-corpo">
      <span class="ctd-cartao-titulo">{{ peca.titulo || 'Sem título' }}</span>
      <span class="ctd-cartao-meta">
        <span class="ctd-pip" :style="{ color: cor }">{{ rotulo }}</span>
        <span class="ctd-formato">{{ nomeDoFormato }}</span>
        <span v-if="hora" class="ctd-cartao-hora">{{ hora }}</span>
        <span v-else class="ctd-cartao-hora">sem data</span>
      </span>
    </span>
  </button>
</template>

<script setup>
import { computed } from 'vue'
import { rotuloDeStatus, corDeStatus } from './estados.js'
import { regrasDoFormato } from './formatos.js'
import { horaDaPeca, dataHoraBRT } from './grade-do-calendario.js'

const props = defineProps({
  peca: { type: Object, required: true },
  miniatura: { type: String, default: '' },
  // No quadro a data completa importa (a coluna não diz o dia); no calendário
  // o dia já é o quadro, então só a hora basta.
  comData: { type: Boolean, default: false },
})

defineEmits(['abrir'])

const ICONES = { feed: '▣', carrossel: '❐', reels: '▶', stories: '◔' }

const rotulo = computed(() => rotuloDeStatus(props.peca.status))
const cor = computed(() => corDeStatus(props.peca.status))
const nomeDoFormato = computed(() => regrasDoFormato(props.peca.formato)?.rotulo || props.peca.formato || '—')
const iconeDoFormato = computed(() => ICONES[props.peca.formato] || '▣')
const hora = computed(() =>
  props.comData ? (props.peca.publicar_em ? dataHoraBRT(props.peca.publicar_em) : '') : horaDaPeca(props.peca.publicar_em),
)
</script>
