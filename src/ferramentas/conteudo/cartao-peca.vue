<template>
  <!-- O cartão da peça. UM só, usado pelo quadro, pela lista e pela gaveta de
       "sem data" — três cópias divergiriam na primeira semana. -->
  <button class="ctd-cartao" :style="{ '--ctd-cor-status': cor }" @click="$emit('abrir', peca)">
    <img v-if="miniatura" class="ctd-cartao-mini" :src="miniatura" :alt="peca.titulo">
    <span v-else class="ctd-cartao-mini"><IconeFormato :formato="peca.formato" :tamanho="20" /></span>

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
        <span v-if="metrica.curtidas !== null" title="Curtidas">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1l8.8 8.8 8.8-8.8a5 5 0 0 0 0-7.1z"/></svg>{{ fmt(metrica.curtidas) }}
        </span>
        <span v-if="metrica.comentarios !== null" title="Comentários">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-3.8-.9L3 20.5l1.5-4.4A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z"/></svg>{{ fmt(metrica.comentarios) }}
        </span>
        <span v-if="metrica.alcance !== null" title="Alcance">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z"/><circle cx="12" cy="12" r="3"/></svg>{{ fmt(metrica.alcance) }}
        </span>
      </span>
    </span>
  </button>
</template>

<script setup>
import { computed } from 'vue'
import IconeFormato from './icone-formato.vue'
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

const rotulo = computed(() => rotuloDeStatus(props.peca.status))
const cor = computed(() => corDeStatus(props.peca.status))
const nomeDoFormato = computed(() => regrasDoFormato(props.peca.formato)?.rotulo || props.peca.formato || '—')
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
