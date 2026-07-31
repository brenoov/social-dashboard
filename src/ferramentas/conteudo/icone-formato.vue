<template>
  <!-- Ícone do formato do post, em SVG.
       Antes eram glifos de texto (▣ ❐ ▶ ◔): eles mudam de desenho conforme a
       fonte instalada, não aceitam espessura de traço e desalinham da linha de
       base — é o que faz uma tela parecer amadora de perto. Regra do projeto:
       SVG próprio, nunca emoji nem caractere como ícone.
       Traço de 1.75 e caixa de 24 em todos, para não haver dois pesos na tela. -->
  <svg
    :width="tamanho" :height="tamanho" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
    :aria-label="rotulo" role="img"
  >
    <!-- Feed: uma foto -->
    <template v-if="formato === 'feed'">
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </template>

    <!-- Carrossel: folhas empilhadas -->
    <template v-else-if="formato === 'carrossel'">
      <rect x="7" y="4" width="13" height="16" rx="2.5" />
      <path d="M4 7v10a2 2 0 0 0 1 1.7" />
    </template>

    <!-- Reels: claquete com play -->
    <template v-else-if="formato === 'reels'">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M8.5 4l3 4M14.5 4l3 4M3 8h18" />
      <path d="M10.5 12.5l4 2.2-4 2.2z" fill="currentColor" stroke="none" />
    </template>

    <!-- Story: o anel tracejado, como no app -->
    <template v-else-if="formato === 'stories'">
      <circle cx="12" cy="12" r="8.5" stroke-dasharray="3.2 2.6" />
      <circle cx="12" cy="12" r="3.2" />
    </template>

    <!-- Formato desconhecido: um quadro neutro, nunca nada. -->
    <template v-else>
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
    </template>
  </svg>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  formato: { type: String, default: 'feed' },
  tamanho: { type: [Number, String], default: 18 },
})

const ROTULOS = {
  feed: 'Post do feed',
  carrossel: 'Carrossel',
  reels: 'Reels',
  stories: 'Story',
}

// Um ícone sem rótulo é invisível para leitor de tela.
const rotulo = computed(() => ROTULOS[props.formato] || 'Publicação')
</script>
