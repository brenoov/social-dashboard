<template>
  <div class="ctd-cal">
    <div class="ctd-cal-topo">
      <span class="ctd-cal-mes">{{ grade.nomeDoMes }} de {{ grade.ano }}</span>
      <div class="ctd-cal-nav">
        <button class="ctd-btn" @click="andar(-1)" aria-label="Mês anterior">‹</button>
        <button class="ctd-btn" @click="irParaHoje">Hoje</button>
        <button class="ctd-btn" @click="andar(1)" aria-label="Próximo mês">›</button>
      </div>
    </div>

    <div class="ctd-cal-grade">
      <div v-for="d in DIAS_DA_SEMANA" :key="d" class="ctd-cal-cab">{{ d }}</div>

      <template v-for="(semana, i) in grade.semanas" :key="i">
        <div
          v-for="dia in semana"
          :key="dia.iso"
          class="ctd-cal-dia"
          :class="{ fora: !dia.doMes, hoje: dia.iso === hoje, vazio: !dia.pecas.length }"
        >
          <div class="ctd-cal-cabdia">
            <span class="ctd-cal-num">{{ dia.numero }}</span>
            <button class="ctd-cal-add" :title="`Nova peça em ${dia.numero}`" @click="$emit('nova', dia.iso)">+</button>
          </div>
          <!-- A ARTE, não o título. Num calendário de conteúdo a pessoa
               reconhece o post pela imagem — o texto é a legenda da imagem, não
               o contrário. É o que separa isto de um quadro de tarefas. -->
          <div class="ctd-cal-pecas">
            <button
              v-for="peca in dia.pecas"
              :key="peca.id"
              class="ctd-cal-peca"
              :style="{ '--ctd-cor-status': corDeStatus(peca.status) }"
              :title="`${peca.titulo} — ${rotuloDeStatus(peca.status)} — ${horaDaPeca(peca.publicar_em)}`"
              @click="$emit('abrir', peca)"
            >
              <img v-if="miniaturas[peca.id]" :src="miniaturas[peca.id]" :alt="peca.titulo" loading="lazy">
              <span v-else class="ctd-cal-peca-sem"><IconeFormato :formato="peca.formato" :tamanho="20" /></span>

              <span class="ctd-cal-peca-info">
                <span class="ctd-cal-peca-hora">{{ horaDaPeca(peca.publicar_em) }}</span>
                <span class="ctd-cal-peca-titulo">{{ peca.titulo || 'Sem título' }}</span>
              </span>
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- Peça sem data não some: ela é justamente a que precisa de decisão. -->
    <div v-if="grade.semData.length" class="ctd-semdata">
      <span class="ctd-semdata-t">Ainda sem data ({{ grade.semData.length }})</span>
      <div class="ctd-semdata-lista">
        <CartaoPeca
          v-for="peca in grade.semData"
          :key="peca.id"
          :peca="peca"
          :miniatura="miniaturas[peca.id]"
          @abrir="$emit('abrir', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import CartaoPeca from './cartao-peca.vue'
import IconeFormato from './icone-formato.vue'
import { DIAS_DA_SEMANA, montarMes, horaDaPeca } from './grade-do-calendario.js'
import { corDeStatus, rotuloDeStatus } from './estados.js'
import { hojeLocal } from '../../compartilhado/datas.js'

const props = defineProps({
  pecas: { type: Array, default: () => [] },
  miniaturas: { type: Object, default: () => ({}) },
})

defineEmits(['abrir', 'nova'])

const hoje = hojeLocal()
const [anoDeHoje, mesDeHoje] = hoje.split('-').map(Number)

const ano = ref(anoDeHoje)
const mes = ref(mesDeHoje)

const grade = computed(() => montarMes(ano.value, mes.value, props.pecas))

function andar(passo) {
  let m = mes.value + passo
  let a = ano.value
  if (m < 1) { m = 12; a-- }
  if (m > 12) { m = 1; a++ }
  mes.value = m
  ano.value = a
}

function irParaHoje() {
  ano.value = anoDeHoje
  mes.value = mesDeHoje
}
</script>
