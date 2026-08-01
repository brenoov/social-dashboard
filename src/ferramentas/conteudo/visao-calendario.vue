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
          :class="{
            fora: !dia.doMes, hoje: dia.iso === hoje, vazio: !dia.pecas.length,
            alvo: alvo === dia.iso,
          }"
          @dragover.prevent="aoArrastarSobre($event, dia)"
          @dragleave="aoSair($event, dia)"
          @drop.prevent="aoSoltar(dia)"
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
              :class="{ arrastando: arrastando?.id === peca.id }"
              :style="{ '--ctd-cor-status': corDeStatus(peca.status) }"
              :draggable="podeRemarcar(peca)"
              :title="tituloDaPeca(peca)"
              @click="$emit('abrir', peca)"
              @dragstart="aoComecar($event, peca)"
              @dragend="arrastando = null; alvo = ''"
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

const emit = defineEmits(['abrir', 'nova', 'remarcar'])

const hoje = hojeLocal()

// ── ARRASTAR PARA REMARCAR ─────────────────────────────────────────────────
//
// Remarcar era a ação mais comum e a mais cara: abrir a peça, achar o campo de
// data, digitar, salvar. O gesto natural é puxar do dia 12 para o dia 15.
const arrastando = ref(null)
const alvo = ref('')

// Peça publicada não se remarca: a data dela é fato registrado, não plano.
function podeRemarcar(peca) {
  return peca?.status !== 'publicada'
}

function tituloDaPeca(peca) {
  const base = `${peca.titulo} — ${rotuloDeStatus(peca.status)} — ${horaDaPeca(peca.publicar_em)}`
  return podeRemarcar(peca) ? `${base}\nArraste para outro dia para remarcar.` : base
}

// O FIREFOX EXIGE `setData` para o arraste começar: sem isso o dragstart até
// dispara, mas nenhum drop acontece. (Foi assim que o arrastar do quadro ficou
// morto num navegador inteiro, em silêncio.)
function aoComecar(ev, peca) {
  if (!podeRemarcar(peca)) { ev.preventDefault(); return }
  arrastando.value = peca
  if (ev.dataTransfer) {
    ev.dataTransfer.effectAllowed = 'move'
    ev.dataTransfer.setData('text/plain', peca.id)
  }
}

function aoArrastarSobre(ev, dia) {
  const ok = !!arrastando.value && dia?.iso && dia.iso !== diaDaPecaArrastada.value
  if (ev.dataTransfer) ev.dataTransfer.dropEffect = ok ? 'move' : 'none'
  alvo.value = ok ? dia.iso : ''
}

// `dragleave` borbulha das peças dentro do dia, e sem esta guarda o realce
// piscava a cada peça que o cursor cruzava.
function aoSair(ev, dia) {
  if (ev.currentTarget.contains(ev.relatedTarget)) return
  if (alvo.value === dia.iso) alvo.value = ''
}

const diaDaPecaArrastada = computed(() =>
  arrastando.value?.publicar_em ? String(arrastando.value.publicar_em).slice(0, 10) : '',
)

function aoSoltar(dia) {
  const peca = arrastando.value
  alvo.value = ''
  arrastando.value = null
  if (!peca || !dia?.iso) return
  // Soltar no mesmo dia não é remarcação — é engano de mira.
  if (dia.iso === diaDaPecaArrastada.value) return
  emit('remarcar', { peca, dia: dia.iso })
}
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
