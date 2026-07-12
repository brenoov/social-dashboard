<script setup>
import { ref, watch } from 'vue'
import { sb } from '../../compartilhado/buscar-e-salvar-dados.js'
import { sbClient } from '../../compartilhado/conectar-no-banco-de-dados.js'
const props = defineProps({ campanhaId: String })
const itens = ref([])
async function carregar() {
  if (!props.campanhaId) return
  itens.value = await sb(`fabrica_criativos?select=id,url,arquetipo,formato,escolhido,purgado_em&campanha_id=eq.${props.campanhaId}&order=created_at`)
}
async function alternar(it) {
  const novo = !it.escolhido; it.escolhido = novo // otimista
  const { error } = await sbClient.from('fabrica_criativos').update({ escolhido: novo }).eq('id', it.id)
  if (error) { it.escolhido = !novo; alert('Falha ao salvar') }
}
watch(() => props.campanhaId, carregar, { immediate: true })
</script>
<template>
  <div class="grid">
    <div v-for="it in itens" :key="it.id" class="card" :class="{ on: it.escolhido }" @click="!it.purgado_em && alternar(it)">
      <img v-if="!it.purgado_em" :src="it.url" loading="lazy">
      <div v-else class="placeholder">subido — ver no Gerenciador</div>
      <span class="tag">{{ it.arquetipo }} · {{ it.formato }}</span>
    </div>
  </div>
</template>
