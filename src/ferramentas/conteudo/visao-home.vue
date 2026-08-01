<template>
  <!-- A HOME. As duas perguntas que um social media faz ao abrir a ferramenta,
       lado a lado: "quando sai o quê?" e "como o perfil vai ficar?".
       Antes eram duas abas, e responder as duas exigia pular de uma para outra
       e montar a comparação na cabeça. Juntas, elas se explicam: dá para ver
       que quinta e sexta são as duas fotos escuras seguidas na grade.

       A proporção não é estética: o calendário é largo por natureza (7 colunas)
       e a grade do Instagram é estreita (3 quadrados). Empilhá-las desperdiçaria
       metade da tela; lado a lado, cada uma fica no tamanho que pede. -->
  <div class="ctd-home">
    <div class="ctd-home-principal">
      <VisaoCalendario
        :pecas="pecas"
        :miniaturas="miniaturas"
        @abrir="$emit('abrir', $event)"
        @nova="$emit('nova', $event)"
      />
    </div>

    <aside class="ctd-home-lado">
      <PreviaDoFeed
        :pecas="pecas"
        :miniaturas="miniaturas"
        :conta="conta"
        @abrir="$emit('abrir', $event)"
      />
    </aside>
  </div>
</template>

<script setup>
import VisaoCalendario from './visao-calendario.vue'
import PreviaDoFeed from './previa-do-feed.vue'

defineProps({
  pecas: { type: Array, default: () => [] },
  miniaturas: { type: Object, default: () => ({}) },
  conta: { type: Object, default: null },
})

defineEmits(['abrir', 'nova'])
</script>
