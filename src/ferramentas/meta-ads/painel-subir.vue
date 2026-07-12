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
  <section class="stage">
    <div class="stagehead">
      <span class="badge"><i class="led hold"></i>Passo 3 · Subir</span>
      <h2>Publicar na Meta</h2>
      <p class="lead">Os anúncios sobem <b>pausados</b> — ninguém vê e não gastam nada até você ativar. Escolha onde publicar.</p>
    </div>

    <div class="panel">
      <div class="ph"><span class="eyebrow">Destino</span></div>
      <div class="choices">
        <label class="choice" :class="{ sel: destino.tipo==='nova' }">
          <input type="radio" value="nova" v-model="destino.tipo">
          <span class="ch-nm">Nova campanha por loja</span>
          <select v-if="destino.tipo==='nova'" v-model="destino.loja"><option value="tivoli">Tivoli</option><option value="dp">Dom Pedro</option></select>
        </label>
        <label class="choice" :class="{ sel: destino.tipo==='existente' }">
          <input type="radio" value="existente" v-model="destino.tipo">
          <span class="ch-nm">Campanha existente</span>
          <select v-if="destino.tipo==='existente'" v-model="destino.campaignId"><option v-for="c in campanhas" :key="c.id" :value="c.id">{{ c.name }}</option></select>
        </label>
      </div>

      <div class="cmdrow">
        <button class="cmd amber" :disabled="job && ['enfileirado','rodando'].includes(job.status)" @click="subir">
          <span class="ci">▶</span> Publicar (pausado)
        </button>
        <div v-if="job" class="jobstat">
          <i class="led" :class="job.status==='concluido' ? 'go' : job.status==='erro' ? 'abort' : ['enfileirado','rodando'].includes(job.status) ? 'run' : 'idle'"></i>
          <span>{{ ({ enfileirado:'Na fila…', rodando:'Publicando na Meta…', concluido:'Publicado (pausado).', erro:'Deu erro ao publicar.' })[job.status] || job.status }}</span>
          <span v-if="job.erro" class="js-err">— {{ job.erro }}</span>
        </div>
      </div>

      <p v-if="job?.resultado?.adIds" class="okline">{{ job.resultado.adIds.length }} anúncios criados e pausados. Confira e decida no passo seguinte.</p>
    </div>
  </section>
</template>
