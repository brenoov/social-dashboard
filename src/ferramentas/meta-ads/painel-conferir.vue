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
  <section class="stage">
    <div class="stagehead">
      <span class="badge"><i class="led hold"></i>Passo 4 · Conferir</span>
      <h2>Confira antes de publicar</h2>
      <p class="lead"><b>{{ n }} anúncios</b> foram criados e estão <b>pausados</b>. Enquanto ficarem pausados, ninguém vê e <b>não gastam nada</b>. Você decide como publicar.</p>
    </div>

    <div class="readout">
      <div class="c"><div class="k">Anúncios criados</div><div class="v mono amber">{{ n }}</div></div>
      <div class="c"><div class="k">Situação</div><div class="v hold">Pausado</div></div>
    </div>

    <section class="launch">
      <h3>Como você quer publicar?</h3>
      <p class="sh">Escolha uma opção:</p>
      <div class="opts">
        <a :href="gerenciador" target="_blank" class="opt manter">
          <span class="oh"><span class="oi">⏸</span> Manter pausados <span class="rec">recomendado</span></span>
          <span class="od">Deixa tudo como está. Você liga cada anúncio na hora que quiser, direto no Gerenciador da Meta. Nada gasta até você ligar.</span>
        </a>
        <button class="opt ativar" :disabled="job && ['enfileirado','rodando'].includes(job.status)" @click="ativarTudo">
          <span class="oh"><span class="oi">▶</span> Ativar todos agora</span>
          <span class="od">Liga os {{ n }} anúncios de uma vez. Eles começam a aparecer para as pessoas — e a gastar verba — na hora.</span>
        </button>
      </div>
      <div class="aviso">
        <span>⚠️</span>
        <span><b>Ativar todos</b> começa a gastar dinheiro imediatamente. Antes de executar, o sistema pergunta “tem certeza?” pra evitar clique sem querer.</span>
      </div>

      <div v-if="job" class="jobstat launchstat">
        <i class="led" :class="job.status==='concluido' ? 'go' : job.status==='erro' ? 'abort' : ['enfileirado','rodando'].includes(job.status) ? 'run' : 'idle'"></i>
        <span>{{ ({ enfileirado:'Na fila…', rodando:'Ativando anúncios…', concluido:'Anúncios ativados.', erro:'Deu erro ao ativar.' })[job.status] || job.status }}</span>
        <span v-if="job.erro" class="js-err">— {{ job.erro }}</span>
      </div>
      <p v-if="job?.status==='concluido'" class="okline">✅ Ativado. {{ job.resultado?.ativados }} anúncios agora estão no ar.</p>
    </section>
  </section>
</template>
