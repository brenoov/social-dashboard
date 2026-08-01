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

    <!-- AÇÕES EM LOTE. Aprovar oito rascunhos no fim do dia eram oito idas ao
         painel. Os destinos são a INTERSEÇÃO do que serve para todas as
         selecionadas — oferecer o que serve para metade daria meia operação e
         um erro no meio. -->
    <div v-if="marcadas.size" class="ctd-lote">
      <span class="ctd-lote-conta">
        {{ marcadas.size }} {{ marcadas.size === 1 ? 'selecionada' : 'selecionadas' }}
      </span>
      <template v-if="destinos.length">
        <span class="ctd-lote-rot">mover para</span>
        <button
          v-for="d in destinos"
          :key="d.chave"
          class="ctd-kb-mover-btn"
          :style="{ '--ctd-cor-destino': d.cor }"
          :disabled="trabalhando"
          @click="$emit('mover-lote', { pecas: selecionadas, destino: d.chave })"
        >{{ d.rotulo }}</button>
      </template>
      <span v-else class="ctd-ajuda">
        Não há uma etapa que sirva para todas as selecionadas ao mesmo tempo.
      </span>
      <button class="ctd-btn ctd-lote-limpar" @click="marcadas.clear()">Limpar seleção</button>
    </div>

    <div v-if="visiveis.length" class="ctd-tabela-rolagem">
      <table class="ctd-tabela">
        <thead>
          <tr>
            <th class="ctd-tab-sel">
              <input
                type="checkbox"
                :checked="todasMarcadas"
                :indeterminate.prop="algumasMarcadas"
                aria-label="Selecionar todas as peças visíveis"
                @change="alternarTodas"
              >
            </th>
            <th @click="ordenarPor('titulo')">Peça {{ seta('titulo') }}</th>
            <th @click="ordenarPor('formato')">Formato {{ seta('formato') }}</th>
            <th @click="ordenarPor('status')">Situação {{ seta('status') }}</th>
            <th @click="ordenarPor('publicar_em')">Publicar em {{ seta('publicar_em') }}</th>
            <th @click="ordenarPor('updated_at')">Mexida por último {{ seta('updated_at') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="peca in visiveis"
            :key="peca.id"
            :class="{ marcada: marcadas.has(peca.id) }"
            @click="$emit('abrir', peca)"
          >
            <td class="ctd-tab-sel" @click.stop>
              <input
                type="checkbox"
                :checked="marcadas.has(peca.id)"
                :aria-label="`Selecionar ${peca.titulo || 'peça sem título'}`"
                @change="alternar(peca.id)"
              >
            </td>
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
import { ref, computed, reactive, watch } from 'vue'
import { STATUS, rotuloDeStatus, corDeStatus, destinosEmLote } from './estados.js'
import { contarPorStatus } from './agrupar-kanban.js'
import { regrasDoFormato } from './formatos.js'
import { dataHoraBRT } from './grade-do-calendario.js'

const props = defineProps({
  pecas: { type: Array, default: () => [] },
  podeAprovar: { type: Boolean, default: false },
  trabalhando: { type: Boolean, default: false },
})

defineEmits(['abrir', 'mover-lote'])

// A seleção é `reactive(new Set())` e não um array: a pergunta feita a cada
// linha é "esta está marcada?", que num array de 200 itens seria uma varredura
// por linha a cada redesenho.
const marcadas = reactive(new Set())

const filtro = ref('')
const coluna = ref('publicar_em')
const crescente = ref(true)

const contagem = computed(() => contarPorStatus(props.pecas))

const selecionadas = computed(() => props.pecas.filter(p => marcadas.has(p.id)))
const destinos = computed(() => destinosEmLote(selecionadas.value, { podeAprovar: props.podeAprovar }))

const todasMarcadas = computed(() =>
  visiveis.value.length > 0 && visiveis.value.every(p => marcadas.has(p.id)))
const algumasMarcadas = computed(() =>
  !todasMarcadas.value && visiveis.value.some(p => marcadas.has(p.id)))

function alternar(id) {
  if (marcadas.has(id)) marcadas.delete(id)
  else marcadas.add(id)
}

function alternarTodas() {
  if (todasMarcadas.value) visiveis.value.forEach(p => marcadas.delete(p.id))
  else visiveis.value.forEach(p => marcadas.add(p.id))
}

// SELEÇÃO NÃO SOBREVIVE À LISTA. Trocar o filtro ou a marca deixaria peças
// marcadas fora de vista, e a barra diria "8 selecionadas" mostrando três — o
// tipo de coisa que faz alguém aprovar o que não viu.
watch(() => props.pecas, () => marcadas.clear())
watch(filtro, () => marcadas.clear())

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
