<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { sbClient } from '../../compartilhado/conectar-no-banco-de-dados.js'
import { useJobStatus } from './use-job-status.js'
const props = defineProps({ campanhaId: String })
const emit = defineEmits(['subido'])
const ACCOUNT_ID = 'b6883e82-07cb-4f21-9fd7-ea7626786174', ACT = 'act_1197997517858139'
const campanhas = ref([]); const destino = reactive({ tipo: 'nova', loja: 'tivoli', campaignId: '' })
const { job, start } = useJobStatus()
onMounted(async () => {
  const { data } = await sbClient.functions.invoke('meta-proxy', { body: { accountId: ACCOUNT_ID, path: `/${ACT}/campaigns`, params: { fields: 'id,name', limit: 200 }, method: 'GET' } })
  campanhas.value = data?.data || []
})
async function subir() {
  const params = { campanhaId: props.campanhaId, destino: destino.tipo === 'existente' ? { tipo: 'existente', campaignId: destino.campaignId } : { tipo: 'nova', loja: destino.loja } }
  const { data, error } = await sbClient.functions.invoke('fabrica-trigger', { body: { tipo: 'subir', params } })
  if (error) return alert('Falha: ' + error.message)
  if (!data?.job_id) return alert('Sem job_id na resposta')
  start(data.job_id)
}
// ao concluir a subida, entrega o resultado (adIds/adsetIds/metaCampaignId/criouCampanha) pro passo Conferir
watch(job, (j) => { if (j?.status === 'concluido' && j.resultado) emit('subido', j.resultado) })
</script>
<template>
  <div class="painel">
    <label><input type="radio" value="nova" v-model="destino.tipo"> Nova campanha por loja</label>
    <select v-if="destino.tipo==='nova'" v-model="destino.loja"><option value="tivoli">Tivoli</option><option value="dp">Dom Pedro</option></select>
    <label><input type="radio" value="existente" v-model="destino.tipo"> Campanha existente</label>
    <select v-if="destino.tipo==='existente'" v-model="destino.campaignId"><option v-for="c in campanhas" :key="c.id" :value="c.id">{{ c.name }}</option></select>
    <button :disabled="job && ['enfileirado','rodando'].includes(job.status)" @click="subir">Subir (PAUSED)</button>
    <p v-if="job">Status: {{ job.status }} <span v-if="job.erro">— {{ job.erro }}</span></p>
    <p v-if="job?.resultado?.adIds">{{ job.resultado.adIds.length }} ads criados (PAUSED). Revisar no Gerenciador.</p>
  </div>
</template>
