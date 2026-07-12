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
  <section class="stage">
    <div class="stagehead">
      <span class="badge"><i class="led hold"></i>Passo 1 · Gerar</span>
      <h2>Gerar os criativos</h2>
      <p class="lead">Escolha o desconto e quantos criativos criar. O robô monta as artes a partir das bolsas selecionadas.</p>
    </div>

    <div class="panel">
      <div class="ph"><span class="eyebrow">Configuração</span></div>
      <div class="fields">
        <label class="field">
          <span class="fl">Desconto (%)</span>
          <input class="fi num" type="number" v-model.number="form.pct">
        </label>
        <label class="field">
          <span class="fl">Quantos criativos</span>
          <input class="fi num" type="number" v-model.number="form.limite">
        </label>
        <label class="field wide">
          <span class="fl">Looks (vazio = favoritos)</span>
          <input class="fi" v-model="form.looks" placeholder="ex.: 4,5,7,10">
        </label>
      </div>

      <div class="cmdrow">
        <button class="cmd amber" :disabled="job && ['enfileirado','rodando'].includes(job.status)" @click="gerar">
          <span class="ci">▶</span> Gerar criativos
        </button>
        <div v-if="job" class="jobstat">
          <i class="led" :class="job.status==='concluido' ? 'go' : job.status==='erro' ? 'abort' : ['enfileirado','rodando'].includes(job.status) ? 'run' : 'idle'"></i>
          <span>{{ ({ enfileirado:'Na fila…', rodando:'Gerando criativos…', concluido:'Pronto! Criativos gerados.', erro:'Deu erro ao gerar.' })[job.status] || job.status }}</span>
          <span v-if="job.erro" class="js-err">— {{ job.erro }}</span>
        </div>
      </div>
    </div>
  </section>
</template>
