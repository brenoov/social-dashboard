<script setup>
/* O checklist do dia, como o motorista preenche.
 *
 * Componente separado de propósito: tela-de-frota.vue já tem 1.243 linhas e
 * quatro áreas. Enfiar o checklist lá dentro deixaria o arquivo grande demais
 * pra qualquer um (pessoa ou máquina) segurar na cabeça de uma vez.
 *
 * Toda a decisão de O QUE perguntar mora em checklist.js, testado. Aqui só tem
 * tela. */
import { ref, reactive, computed } from 'vue'
import { cadenciasDoDia, itensDaFicha, problemasDaFicha, hodometroAceito } from '../../../supabase/functions/_shared/checklist.js'

const props = defineProps({
  veiculo: { type: Object, required: true },
  itens: { type: Array, default: () => [] },
  config: { type: Object, required: true },
  ultimaSemanal: { type: String, default: null },
  ultimaMensal: { type: String, default: null },
  ultimoKm: { type: Number, default: null },
  hoje: { type: String, required: true },
  gravando: { type: Boolean, default: false },
})
const emit = defineEmits(['gravar'])

const cadencias = computed(() => cadenciasDoDia({
  hoje: props.hoje, config: props.config,
  ultimaSemanal: props.ultimaSemanal, ultimaMensal: props.ultimaMensal,
}))
const daFicha = computed(() => itensDaFicha(props.itens, cadencias.value))

const respostas = reactive({})
const hodometro = ref('')
const justificativa = ref('')
const anomalias = ref('')
const resultado = ref('liberado')
const erros = ref([])

const hodometroNumero = computed(() => {
  const n = parseInt(String(hodometro.value).replace(/\D/g, ''), 10)
  return Number.isInteger(n) ? n : null
})
// O aviso aparece enquanto a pessoa digita, não só ao gravar: descobrir o
// problema depois de responder 15 itens é o jeito de fazer ela desistir.
const avisoDoHodometro = computed(() => {
  if (hodometro.value === '') return null
  const r = hodometroAceito(hodometroNumero.value, props.ultimoKm)
  return r.ok ? null : r
})

const titulo = computed(() => {
  if (cadencias.value.includes('mensal')) return 'Checklist de hoje · com a conferência do mês'
  if (cadencias.value.includes('semanal')) return 'Checklist de hoje · com a conferência da semana'
  return 'Checklist de hoje'
})

function gravar() {
  erros.value = problemasDaFicha({
    hodometro: hodometroNumero.value, ultimoKm: props.ultimoKm,
    justificativa: justificativa.value, respostas, itens: daFicha.value,
  })
  if (erros.value.length) return
  emit('gravar', {
    ficha: {
      veiculo_id: props.veiculo.id,
      feita_em: props.hoje,
      cadencias: cadencias.value,
      hodometro: hodometroNumero.value,
      hodometro_justificativa: justificativa.value.trim() || null,
      resultado: resultado.value,
      anomalias: anomalias.value.trim() || null,
    },
    respostas: daFicha.value.map((i) => ({
      item_id: i.id,
      item_texto: i.item,
      cadencia: i.cadencia,
      estado: respostas[i.id],
      observacao: null,
    })),
  })
}
</script>

<template>
  <section class="ck" v-if="daFicha.length">
    <header class="ck-topo">
      <h2 class="ck-titulo">{{ titulo }}</h2>
      <span class="ck-carro">{{ veiculo.nome }} · {{ veiculo.placa }}</span>
    </header>

    <label class="ck-campo">
      <span class="ck-lab">Quilometragem do painel</span>
      <input v-model="hodometro" type="text" inputmode="numeric" placeholder="148320">
    </label>
    <p class="ck-aviso" v-if="avisoDoHodometro">{{ avisoDoHodometro.motivo }}</p>
    <label class="ck-campo" v-if="avisoDoHodometro && avisoDoHodometro.precisaJustificar">
      <span class="ck-lab">O que aconteceu</span>
      <input v-model="justificativa" type="text"
             placeholder="Ex.: painel trocado na oficina, o odômetro zerou">
    </label>

    <ul class="ck-itens">
      <li v-for="i in daFicha" :key="i.id" class="ck-item">
        <span class="ck-item-nome">{{ i.item }}</span>
        <div class="ck-opcoes">
          <button type="button" class="ck-op" :class="{ marcado: respostas[i.id] === 'ok' }"
                  @click="respostas[i.id] = 'ok'">OK</button>
          <button type="button" class="ck-op ruim" :class="{ marcado: respostas[i.id] === 'nao_ok' }"
                  @click="respostas[i.id] = 'nao_ok'">Não OK</button>
          <button type="button" class="ck-op" :class="{ marcado: respostas[i.id] === 'na' }"
                  @click="respostas[i.id] = 'na'">Não se aplica</button>
        </div>
      </li>
    </ul>

    <label class="ck-campo">
      <span class="ck-lab">Anomalias e providências</span>
      <textarea v-model="anomalias" rows="2"
                placeholder="Só se tiver algo a dizer"></textarea>
    </label>

    <div class="ck-resultado">
      <button type="button" class="ck-op" :class="{ marcado: resultado === 'liberado' }"
              @click="resultado = 'liberado'">Liberado</button>
      <button type="button" class="ck-op" :class="{ marcado: resultado === 'com_ressalvas' }"
              @click="resultado = 'com_ressalvas'">Com ressalvas</button>
      <button type="button" class="ck-op ruim" :class="{ marcado: resultado === 'nao_liberado' }"
              @click="resultado = 'nao_liberado'">Não liberado</button>
    </div>
    <!-- O carro NUNCA trava (D14). Dizer isso na tela evita a pessoa não marcar
         "não liberado" com medo de deixar a empresa a pé. -->
    <p class="ck-nota">
      Marcar "não liberado" não tira o carro de ninguém — só avisa quem administra.
    </p>

    <ul class="ck-erros" v-if="erros.length">
      <li v-for="e in erros" :key="e">{{ e }}</li>
    </ul>
    <button class="ck-gravar" :disabled="gravando" @click="gravar">
      {{ gravando ? 'Gravando…' : 'Gravar checklist' }}
    </button>
  </section>
</template>

<style scoped>
.ck { border: 1px solid var(--borda, #e3e3e3); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
.ck-topo { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; margin-bottom: 12px; }
.ck-titulo { font-size: 1rem; font-weight: 700; margin: 0; }
.ck-carro { font-size: .85rem; opacity: .7; }
.ck-campo { display: block; margin-bottom: 10px; }
.ck-lab { display: block; font-size: .8rem; opacity: .75; margin-bottom: 4px; }
.ck-campo input, .ck-campo textarea { width: 100%; box-sizing: border-box; padding: 8px; border-radius: 8px; border: 1px solid var(--borda, #e3e3e3); font: inherit; }
.ck-aviso { font-size: .85rem; color: #a15c00; margin: 0 0 10px; }
.ck-itens { list-style: none; padding: 0; margin: 0 0 12px; }
.ck-item { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--borda, #eee); }
.ck-item-nome { flex: 1 1 180px; }
.ck-opcoes, .ck-resultado { display: flex; flex-wrap: wrap; gap: 6px; }
.ck-op { padding: 6px 10px; border-radius: 999px; border: 1px solid var(--borda, #ddd); background: transparent; font: inherit; cursor: pointer; }
.ck-op.marcado { background: #1c7c3f; border-color: #1c7c3f; color: #fff; }
.ck-op.ruim.marcado { background: #a12727; border-color: #a12727; }
.ck-nota { font-size: .8rem; opacity: .7; margin: 8px 0 0; }
.ck-erros { color: #a12727; font-size: .9rem; padding-left: 18px; }
.ck-gravar { margin-top: 12px; width: 100%; padding: 12px; border-radius: 10px; border: 0; background: #111; color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
.ck-gravar:disabled { opacity: .6; cursor: default; }
@media (max-width: 520px) {
  .ck-item { flex-direction: column; align-items: stretch; }
}
</style>
