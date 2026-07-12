<script setup>
import { reactive, watch } from 'vue'
import { sbClient } from '../../compartilhado/conectar-no-banco-de-dados.js'
import { useJobStatus } from './use-job-status.js'
const emit = defineEmits(['gerado'])
const form = reactive({ pct: 50, limite: 8, looks: '' })
const { job, start } = useJobStatus()
async function gerar() {
  const { data, error } = await sbClient.functions.invoke('fabrica-trigger', { body: { tipo: 'gerar', params: { pct: form.pct, limite: form.limite, looks: form.looks || null } } })
  if (error) return alert('Falha ao disparar: ' + error.message)
  if (!data?.job_id) return alert('Sem job_id na resposta')
  start(data.job_id)
}
watch(job, (j) => { if (j?.status === 'concluido' && j.resultado?.campanhaId) emit('gerado', j.resultado.campanhaId) })
</script>
<template>
  <div class="painel">
    <label>Desconto %<input type="number" v-model.number="form.pct"></label>
    <label>Limite<input type="number" v-model.number="form.limite"></label>
    <label>Looks (vazio = favoritos)<input v-model="form.looks" placeholder="ex.: 4,5,7,10"></label>
    <button :disabled="job && ['enfileirado','rodando'].includes(job.status)" @click="gerar">Gerar</button>
    <p v-if="job">Status: {{ job.status }} <span v-if="job.erro">— {{ job.erro }}</span></p>
  </div>
</template>
