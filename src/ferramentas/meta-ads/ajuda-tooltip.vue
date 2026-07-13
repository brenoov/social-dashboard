<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { AJUDA } from './tutorial-fabrica.js'
const props = defineProps({ chave: { type: String, required: true } })
const aberto = ref(false)
const conteudo = computed(() => AJUDA[props.chave] || null)
function onKey(e) { if (e.key === 'Escape') aberto.value = false }
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>
<template>
  <span class="ajuda" v-if="conteudo">
    <button class="ajuda-btn" type="button" :aria-expanded="aberto" aria-label="Ajuda" @click.stop="aberto = !aberto">?</button>
    <div v-if="aberto" class="ajuda-back" @click="aberto = false"></div>
    <div v-if="aberto" class="ajuda-balao" role="dialog">
      <div class="ajuda-tit">{{ conteudo.titulo }}</div>
      <div v-for="it in conteudo.itens" :key="it.termo" class="ajuda-item">
        <b>{{ it.termo }}</b><span>{{ it.texto }}</span>
      </div>
      <button class="ajuda-fechar" type="button" @click="aberto = false">Fechar</button>
    </div>
  </span>
</template>
