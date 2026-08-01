<template>
  <!-- PROGRAMAÇÃO. O trabalho em andamento, de dois jeitos.
       Quadro e Lista mostram exatamente as mesmas peças — mudam a pergunta que
       respondem: o quadro é "em que pé está cada uma?", a lista é "me mostra
       tudo de uma vez, ordenado". Eram duas abas irmãs longe uma da outra;
       aqui a troca é um clique e o contexto não se perde. -->
  <div class="ctd-prog">
    <div class="ctd-prog-troca" role="tablist" aria-label="Como ver a programação">
      <button
        role="tab"
        :aria-selected="modo === 'quadro'"
        :class="{ on: modo === 'quadro' }"
        @click="modo = 'quadro'"
      >Quadro</button>
      <button
        role="tab"
        :aria-selected="modo === 'lista'"
        :class="{ on: modo === 'lista' }"
        @click="modo = 'lista'"
      >Lista</button>
    </div>

    <VisaoKanban
      v-show="modo === 'quadro'"
      :pecas="pecas"
      :miniaturas="miniaturas"
      :metricas="metricas"
      :pode-aprovar="podeAprovar"
      @abrir="$emit('abrir', $event)"
      @mover="$emit('mover', $event)"
    />
    <VisaoLista v-show="modo === 'lista'" :pecas="pecas" @abrir="$emit('abrir', $event)" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import VisaoKanban from './visao-kanban.vue'
import VisaoLista from './visao-lista.vue'

defineProps({
  pecas: { type: Array, default: () => [] },
  miniaturas: { type: Object, default: () => ({}) },
  metricas: { type: Object, default: () => ({}) },
  podeAprovar: { type: Boolean, default: false },
})

defineEmits(['abrir', 'mover'])

// Quadro é o padrão: é a visão que mostra ONDE cada peça está travada, que é a
// pergunta de quem abre a programação. A lista serve para varrer muita coisa.
const modo = ref('quadro')
</script>
