<template>
  <!-- PRÉVIA DO FEED: como o perfil vai FICAR.
       Nenhuma ferramenta de kanban mostra isso, e é a primeira coisa que um
       social media confere antes de aprovar uma sequência — se a cor bate, se
       não ficaram três fotos parecidas lado a lado, se a grade respira.
       Trello mostra cartões; aqui se vê o resultado. -->
  <section class="ctd-previa">
    <header class="ctd-previa-cab">
      <div>
        <h2 class="ctd-previa-t">Como o perfil vai ficar</h2>
        <p class="ctd-previa-d">
          O que já está no ar, seguido do que está agendado — na ordem em que vai aparecer na grade.
        </p>
      </div>
      <div class="ctd-previa-legenda">
        <span><i class="pub"></i>no ar</span>
        <span><i class="age"></i>agendado</span>
      </div>
    </header>

    <div v-if="!celulas.length" class="ctd-vazio">
      <h3>Nada para prever ainda</h3>
      <p>Assim que houver peça com arte, a grade aparece aqui do jeito que vai ficar no perfil.</p>
    </div>

    <div v-else class="ctd-previa-grade">
      <button
        v-for="c in celulas"
        :key="c.peca.id"
        class="ctd-celula"
        :class="c.agendada ? 'agendada' : 'publicada'"
        :title="`${c.peca.titulo} — ${c.quando}`"
        @click="$emit('abrir', c.peca)"
      >
        <img v-if="c.img" :src="c.img" :alt="c.peca.titulo" loading="lazy">
        <span v-else class="ctd-celula-sem"><IconeFormato :formato="c.peca.formato" :tamanho="26" /></span>

        <span class="ctd-celula-veu">
          <span class="ctd-celula-quando">{{ c.quando }}</span>
          <span class="ctd-celula-titulo">{{ c.peca.titulo }}</span>
        </span>

        <span v-if="c.peca.formato !== 'feed'" class="ctd-celula-marca"><IconeFormato :formato="c.peca.formato" :tamanho="15" /></span>
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import IconeFormato from './icone-formato.vue'
import { dataHoraBRT } from './grade-do-calendario.js'

const props = defineProps({
  pecas: { type: Array, default: () => [] },
  miniaturas: { type: Object, default: () => ({}) },
})

defineEmits(['abrir'])

// Story não entra: ele não fica na grade do perfil, some em 24h. Colocá-lo aqui
// mostraria uma grade que nunca vai existir.
const NA_GRADE = new Set(['feed', 'carrossel', 'reels'])

const celulas = computed(() =>
  props.pecas
    .filter(p => NA_GRADE.has(p.formato))
    .filter(p => p.status === 'publicada' || p.status === 'agendada')
    .sort((a, b) => {
      // O Instagram mostra o mais novo primeiro. A prévia tem que seguir a mesma
      // ordem, senão ela não é prévia de nada.
      const da = a.publicado_em || a.publicar_em || ''
      const db = b.publicado_em || b.publicar_em || ''
      return String(db).localeCompare(String(da))
    })
    .slice(0, 12)
    .map(p => ({
      peca: p,
      img: props.miniaturas[p.id] || '',
      agendada: p.status === 'agendada',
      quando: dataHoraBRT(p.publicado_em || p.publicar_em),
    })),
)
</script>
