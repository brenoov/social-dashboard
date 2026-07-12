<script setup>
import { ref, watch, computed } from 'vue'
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
const visiveis = computed(() => itens.value.filter((i) => !i.purgado_em))
const todosEscolhidos = computed(() => visiveis.value.length > 0 && visiveis.value.every((i) => i.escolhido))
async function alternarTodos() {
  const alvo = visiveis.value
  if (!alvo.length) return
  const novo = !todosEscolhidos.value
  const antes = alvo.map((i) => [i, i.escolhido])
  alvo.forEach((i) => { i.escolhido = novo })                 // otimista
  const { error } = await sbClient.from('fabrica_criativos').update({ escolhido: novo }).in('id', alvo.map((i) => i.id))
  if (error) { antes.forEach(([i, v]) => { i.escolhido = v }); alert('Falha ao salvar') }
}
watch(() => props.campanhaId, carregar, { immediate: true })
</script>
<template>
  <section class="stage">
    <div class="stagehead">
      <span class="badge"><i class="led hold"></i>Passo 2 · Curar</span>
      <h2>Escolha os melhores</h2>
      <p class="lead">Toque para marcar os criativos que vão virar anúncio. Os escolhidos ficam com a borda âmbar.</p>
    </div>

    <div class="readout">
      <div class="c"><div class="k">Gerados</div><div class="v mono">{{ itens.length }}</div></div>
      <div class="c"><div class="k">Escolhidos</div><div class="v mono amber">{{ itens.filter(i => i.escolhido).length }}</div></div>
    </div>

    <div class="panel">
      <div class="ph">
        <span class="eyebrow">Criativos</span>
        <span class="ph-right">
          <button v-if="visiveis.length" class="marcar-todos" @click="alternarTodos">{{ todosEscolhidos ? 'Desmarcar todos' : 'Marcar todos' }}</button>
          <span class="eyebrow muted">toque para escolher</span>
        </span>
      </div>
      <div v-if="itens.length" class="cg">
        <div v-for="it in itens" :key="it.id" class="tile" :class="{ ok: it.escolhido, subido: it.purgado_em }" @click="!it.purgado_em && alternar(it)">
          <img v-if="!it.purgado_em" class="art" :src="it.url" loading="lazy">
          <div v-else class="art placeholder">subido — ver no Gerenciador</div>
          <span class="cap">{{ it.arquetipo }} · {{ it.formato }}</span>
        </div>
      </div>
      <p v-else class="empty">Nenhum criativo por aqui ainda. Volte ao passo Gerar.</p>
    </div>
  </section>
</template>
