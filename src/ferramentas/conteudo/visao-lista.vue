<template>
  <div class="ctd-lista">
    <div class="ctd-lista-filtros">
      <button class="ctd-chip-filtro" :class="{ on: filtro === '' }" @click="filtro = ''">
        Todas ({{ pecas.length }})
      </button>
      <button
        v-for="s in STATUS"
        :key="s.chave"
        class="ctd-chip-filtro"
        :class="{ on: filtro === s.chave }"
        @click="filtro = s.chave"
      >
        {{ s.rotulo }} ({{ contagem[s.chave] }})
      </button>
    </div>

    <div v-if="!visiveis.length" class="ctd-vazio">
      <h3>Nada aqui</h3>
      <p>Nenhuma peça {{ filtro ? `em "${rotuloDeStatus(filtro)}"` : '' }} para este perfil.</p>
    </div>

    <div v-else class="ctd-tabela-rolagem">
      <table class="ctd-tabela">
        <thead>
          <tr>
            <th @click="ordenarPor('titulo')">Peça {{ seta('titulo') }}</th>
            <th @click="ordenarPor('formato')">Formato {{ seta('formato') }}</th>
            <th @click="ordenarPor('status')">Situação {{ seta('status') }}</th>
            <th @click="ordenarPor('publicar_em')">Publicar em {{ seta('publicar_em') }}</th>
            <th @click="ordenarPor('updated_at')">Mexida por último {{ seta('updated_at') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="peca in visiveis" :key="peca.id" @click="$emit('abrir', peca)">
            <td>{{ peca.titulo || 'Sem título' }}</td>
            <td>{{ nomeDoFormato(peca.formato) }}</td>
            <td><span class="ctd-pip" :style="{ color: corDeStatus(peca.status) }">{{ rotuloDeStatus(peca.status) }}</span></td>
            <td class="ctd-tabela-data">{{ peca.publicar_em ? dataHoraBRT(peca.publicar_em) : 'sem data' }}</td>
            <td class="ctd-tabela-data">{{ dataHoraBRT(peca.updated_at) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { STATUS, rotuloDeStatus, corDeStatus } from './estados.js'
import { contarPorStatus } from './agrupar-kanban.js'
import { regrasDoFormato } from './formatos.js'
import { dataHoraBRT } from './grade-do-calendario.js'

const props = defineProps({
  pecas: { type: Array, default: () => [] },
})

defineEmits(['abrir'])

const filtro = ref('')
const coluna = ref('publicar_em')
const crescente = ref(true)

const contagem = computed(() => contarPorStatus(props.pecas))

const visiveis = computed(() => {
  const base = filtro.value ? props.pecas.filter(p => p.status === filtro.value) : props.pecas
  const sinal = crescente.value ? 1 : -1
  // [...base]: ordenar aqui não pode reordenar a lista do componente pai.
  return [...base].sort((a, b) => {
    const va = a[coluna.value]
    const vb = b[coluna.value]
    // Sem valor vai sempre para o fim, independente da direção — é o que se
    // espera de "sem data", não que ela lidere a lista quando inverte a ordem.
    if (!va && !vb) return 0
    if (!va) return 1
    if (!vb) return -1
    return String(va).localeCompare(String(vb)) * sinal
  })
})

function ordenarPor(nome) {
  if (coluna.value === nome) { crescente.value = !crescente.value; return }
  coluna.value = nome
  crescente.value = true
}

function seta(nome) {
  if (coluna.value !== nome) return ''
  return crescente.value ? '↑' : '↓'
}

function nomeDoFormato(chave) {
  return regrasDoFormato(chave)?.rotulo || chave || '—'
}
</script>
