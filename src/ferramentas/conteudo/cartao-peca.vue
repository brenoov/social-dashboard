<template>
  <!-- O cartão da peça. UM só, usado pelo quadro, pela lista e pela gaveta de
       "sem data" — três cópias divergiriam na primeira semana. -->
  <button class="ctd-cartao" :style="{ '--ctd-cor-status': cor }" @click="$emit('abrir', peca)">
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

      <!-- Só aparece depois que o post foi encontrado no Instagram. Métrica que
           a Meta não respondeu fica de fora em vez de virar zero. -->
      <span v-if="temMetrica" class="ctd-cartao-metricas">
        <span v-if="metrica.curtidas !== null" title="Curtidas">♥ {{ fmt(metrica.curtidas) }}</span>
        <span v-if="metrica.comentarios !== null" title="Comentários">✉ {{ fmt(metrica.comentarios) }}</span>
        <span v-if="metrica.alcance !== null" title="Alcance">◎ {{ fmt(metrica.alcance) }}</span>
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
  metrica: { type: Object, default: null },
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

// Só mostra o rodapé se houver ALGUM número. Uma peça medida em que a Meta não
// respondeu nada renderizaria uma linha vazia.
const temMetrica = computed(() => {
  const m = props.metrica
  return !!m && [m.curtidas, m.comentarios, m.alcance].some(v => v !== null && v !== undefined)
})

// 1200 vira "1,2 mil": em cartão pequeno o número inteiro quebra a linha.
function fmt(n) {
  if (n === null || n === undefined) return '—'
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')} mil` : String(n)
}
</script>
