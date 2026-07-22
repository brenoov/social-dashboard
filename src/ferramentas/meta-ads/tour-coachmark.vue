<script setup>
import { ref, watch, nextTick, onUnmounted, onMounted } from 'vue'
const props = defineProps({ passos: { type: Array, required: true }, modelValue: Boolean })
const emit = defineEmits(['update:modelValue'])
const idx = ref(0)
const rect = ref(null)   // bounding do alvo atual
const passo = ref(null)  // {selector,titulo,texto}

function medir() {
  const p = props.passos[idx.value]
  passo.value = p || null
  if (!p) return
  const el = document.querySelector(p.selector)
  if (!el) { rect.value = null; return }   // alvo ausente -> sem spotlight, balão centralizado (mostra o texto)
  const r = el.getBoundingClientRect()
  rect.value = { top: r.top, left: r.left, width: r.width, height: r.height }
}
async function irPara(i) {
  const n = Math.max(0, Math.min(i, props.passos.length - 1))
  idx.value = n
  await nextTick()
  // scroll UMA vez ao trocar de passo — NUNCA dentro de medir(): o listener de 'scroll'
  // chama medir, e medir chamando scrollIntoView disparava scroll de novo = loop que trava a tela.
  const el = document.querySelector(props.passos[n].selector)
  if (el) el.scrollIntoView({ block: 'center', behavior: 'auto' })
  medir()
}
function proximo() { irPara(idx.value + 1) }
function anterior() { irPara(idx.value - 1) }
function fechar() { emit('update:modelValue', false) }
function onKey(e) { if (e.key === 'Escape') fechar(); else if (e.key === 'ArrowRight') proximo(); else if (e.key === 'ArrowLeft') anterior() }
function reMedir() { if (props.modelValue) medir() }

async function abrir() {
  idx.value = 0
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', reMedir); window.addEventListener('scroll', reMedir, true)
  await nextTick(); irPara(0)
}

function limpar() {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', reMedir); window.removeEventListener('scroll', reMedir, true)
}

watch(() => props.modelValue, (v) => {
  if (v) abrir()
  else limpar()
})

onMounted(() => {
  if (props.modelValue) abrir()
})

onUnmounted(() => { limpar() })

const estiloRealce = () => rect.value ? { top: rect.value.top - 6 + 'px', left: rect.value.left - 6 + 'px', width: rect.value.width + 12 + 'px', height: rect.value.height + 12 + 'px' } : {}
const estiloBalao = () => {
  if (!rect.value) return { top: '40%', left: '50%', transform: 'translate(-50%,-50%)' }
  const abaixo = rect.value.top + rect.value.height + 12
  return { top: Math.min(abaixo, window.innerHeight - 180) + 'px', left: Math.max(12, Math.min(rect.value.left, window.innerWidth - 320)) + 'px' }
}
</script>
<template>
  <div v-if="modelValue" class="tour-overlay">
    <div v-if="rect" class="tour-realce" :style="estiloRealce()"></div>
    <div class="tour-balao" :style="estiloBalao()" role="dialog">
      <div class="tour-tit">{{ passo?.titulo }}</div>
      <div class="tour-txt">{{ passo?.texto }}</div>
      <div class="tour-acoes">
        <span class="tour-passo">{{ idx + 1 }} / {{ passos.length }}</span>
        <button class="mini" type="button" @click="fechar">Pular</button>
        <button class="mini" type="button" :disabled="idx === 0" @click="anterior">Anterior</button>
        <button class="cmd cyan" type="button" @click="idx >= passos.length - 1 ? fechar() : proximo()">{{ idx >= passos.length - 1 ? 'Concluir' : 'Próximo' }}</button>
      </div>
    </div>
  </div>
</template>
