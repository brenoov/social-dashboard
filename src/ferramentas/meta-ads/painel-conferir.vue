<script setup>
import { computed } from 'vue'
import { sbClient } from '../../compartilhado/conectar-no-banco-de-dados.js'
import { useJobStatus } from './use-job-status.js'
const props = defineProps({ subirResultado: Object })
const n = computed(() => props.subirResultado?.adIds?.length || 0)
const { job, start } = useJobStatus()
const gerenciador = 'https://adsmanager.facebook.com/adsmanager/'
async function ativarTudo() {
  if (!confirm(`Ativar ${n.value} anúncios? Isso COMEÇA A GASTAR verba imediatamente.`)) return
  const { adIds, adsetIds, metaCampaignId, criouCampanha } = props.subirResultado
  const { data, error } = await sbClient.functions.invoke('fabrica-trigger', { body: { tipo: 'ativar', params: { adIds, adsetIds, metaCampaignId, criouCampanha } } })
  if (error) return alert('Falha: ' + error.message)
  if (!data?.job_id) return alert('Sem job_id na resposta')
  start(data.job_id)
}
</script>
<template>
  <div class="painel">
    <p>{{ n }} anúncios subidos — <strong>PAUSED</strong>.</p>
    <div class="acoes">
      <a :href="gerenciador" target="_blank" class="btn">Manter pausado (ativo manual no Gerenciador)</a>
      <button :disabled="job && ['enfileirado','rodando'].includes(job.status)" @click="ativarTudo">Ativar tudo</button>
    </div>
    <p v-if="job">Ativação: {{ job.status }} <span v-if="job.erro">— {{ job.erro }}</span></p>
    <p v-if="job?.status==='concluido'">✅ Ativado. {{ job.resultado?.ativados }} objetos ACTIVE.</p>
  </div>
</template>
