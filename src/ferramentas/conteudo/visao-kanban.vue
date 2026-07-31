<template>
  <div class="ctd-kb">
    <div
      v-for="coluna in colunas"
      :key="coluna.chave"
      class="ctd-kb-col"
      :class="{ alvo: alvo === coluna.chave }"
      :style="{ '--ctd-cor-coluna': coluna.cor }"
      @dragover.prevent="aoArrastarSobre(coluna)"
      @dragleave="alvo = alvo === coluna.chave ? '' : alvo"
      @drop.prevent="aoSoltar(coluna)"
    >
      <div class="ctd-kb-cab">
        <span class="ctd-kb-bolinha" :style="{ background: coluna.cor }"></span>
        <span class="ctd-kb-nome">{{ coluna.rotulo }}</span>
        <span class="ctd-kb-conta">{{ coluna.total }}</span>
      </div>

      <div class="ctd-kb-lista">
        <div
          v-for="peca in coluna.pecas"
          :key="peca.id"
          draggable="true"
          @dragstart="arrastando = peca"
          @dragend="arrastando = null; alvo = ''"
        >
          <CartaoPeca
            :peca="peca"
            :miniatura="miniaturas[peca.id]"
            :metrica="metricas[peca.id]"
            com-data
            @abrir="$emit('abrir', $event)"
          />

        </div>

        <p v-if="!coluna.total" class="ctd-kb-vazia">{{ VAZIAS[coluna.chave] }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import CartaoPeca from './cartao-peca.vue'
import { agruparPorStatus } from './agrupar-kanban.js'
import { podeTransicionar } from './estados.js'

const props = defineProps({
  pecas: { type: Array, default: () => [] },
  miniaturas: { type: Object, default: () => ({}) },
  metricas: { type: Object, default: () => ({}) },
  podeAprovar: { type: Boolean, default: false },
})

const emit = defineEmits(['abrir', 'mover'])

// Coluna vazia explica o que entra nela, em vez de um "—" mudo.
const VAZIAS = {
  rascunho: 'Nada em rascunho.',
  em_aprovacao: 'Ninguém esperando aprovação.',
  aprovada: 'Nada aprovado esperando data.',
  agendada: 'Nada agendado.',
  publicada: 'Nada publicado ainda.',
}

const arrastando = ref(null)
const alvo = ref('')

const colunas = computed(() => agruparPorStatus(props.pecas))

function permitido(coluna) {
  if (!arrastando.value) return false
  if (arrastando.value.status === coluna.chave) return false
  return podeTransicionar(arrastando.value.status, coluna.chave, {
    podeAprovar: props.podeAprovar,
    temData: !!arrastando.value.publicar_em,
  }).ok
}

function aoArrastarSobre(coluna) {
  alvo.value = permitido(coluna) ? coluna.chave : ''
}

function aoSoltar(coluna) {
  const peca = arrastando.value
  alvo.value = ''
  arrastando.value = null
  if (!peca || peca.status === coluna.chave) return

  // Quem decide de verdade é quem recebe o evento (e depois o banco). Aqui a
  // checagem serve para não emitir um movimento que já se sabe recusado.
  const veredito = podeTransicionar(peca.status, coluna.chave, {
    podeAprovar: props.podeAprovar,
    temData: !!peca.publicar_em,
  })
  emit('mover', { peca, destino: coluna.chave, veredito })
}
</script>
