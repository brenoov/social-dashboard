<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { sbClient } from '../../compartilhado/conectar-no-banco-de-dados.js'
import { sb } from '../../compartilhado/buscar-e-salvar-dados.js'
import { useJobStatus } from './use-job-status.js'
import AjudaTooltip from './ajuda-tooltip.vue'
const props = defineProps({ campanhaId: String, retomarJobId: String })
const emit = defineEmits(['subido'])
const ACCOUNT_ID = 'b6883e82-07cb-4f21-9fd7-ea7626786174', ACT = 'act_1197997517858139'
const campanhas = ref([]); const destino = reactive({ tipo: 'nova', lojas: ['tivoli'], campaignId: '' })
const LOJAS = [{ slug: 'tivoli', nome: 'Tivoli' }, { slug: 'dp', nome: 'Dom Pedro' }]
const { job, start } = useJobStatus()

// ===== Localização + Público POR LOJA (abas; só quando destino.tipo === 'nova') =====
// `publico` = config da loja ATIVA (reactive estável); publicoPorLoja[slug] guarda o snapshot de
// cada loja. Ao trocar de aba, salva a atual e carrega a outra. Default de cada loja = a(s)
// cidade(s) de origem dela (fabrica_lojas.geo_cities).
const presets = ref([])
const lojasCfg = ref([]) // fabrica_lojas: {nome, geo_cities}
function cidadesDaLoja(slug) {
  const alias = slug === 'dp' ? 'dom pedro' : slug
  const row = lojasCfg.value.find((l) => (l.nome || '').toLowerCase().includes(alias))
  return (row?.geo_cities || []).map((key) => ({ key: String(key), nome: row.nome || 'Cidade da loja', radius: 20, distance_unit: 'kilometer' }))
}
function publicoBase(slug) {
  return { presetId: '', nome: '', geo: { cities: cidadesDaLoja(slug), excluded: [] }, idade_min: 18, idade_max: 65, generos: [], interesses: [], custom_audiences: [] }
}
const publico = reactive(publicoBase('tivoli'))
const publicoPorLoja = reactive({})   // slug -> snapshot do público daquela loja
const lojaAtiva = ref('tivoli')
const clone = (o) => JSON.parse(JSON.stringify(o))
function salvarAtiva() { if (lojaAtiva.value) publicoPorLoja[lojaAtiva.value] = clone(publico) }
function carregarLoja(slug) { Object.assign(publico, clone(publicoPorLoja[slug] || publicoBase(slug))) }
function trocarAba(slug) { if (slug === lojaAtiva.value) return; salvarAtiva(); lojaAtiva.value = slug; carregarLoja(slug) }
function toggleLoja(slug) {
  const i = destino.lojas.indexOf(slug)
  if (i > -1) {
    destino.lojas.splice(i, 1); delete publicoPorLoja[slug]
    if (lojaAtiva.value === slug) { lojaAtiva.value = destino.lojas[0] || ''; if (lojaAtiva.value) carregarLoja(lojaAtiva.value) }
  } else {
    salvarAtiva(); destino.lojas.push(slug)
    if (!publicoPorLoja[slug]) publicoPorLoja[slug] = publicoBase(slug)
    lojaAtiva.value = slug; carregarLoja(slug)
  }
}
const buscaCidade = ref(''); const cidadesAchadas = ref([])
const buscaInteresse = ref(''); const interessesAchados = ref([])
async function carregarPresets() { presets.value = await sb('fabrica_publicos?select=*&ativo=eq.true&order=created_at.desc') }
function aplicarPreset() {
  const p = presets.value.find((x) => x.id === publico.presetId)
  if (!p) { Object.assign(publico, { nome: '', geo: { cities: [], excluded: [] }, idade_min: 18, idade_max: 65, generos: [], interesses: [], custom_audiences: [] }); return }
  Object.assign(publico, { nome: p.nome, geo: p.geo || { cities: [], excluded: [] }, idade_min: p.idade_min, idade_max: p.idade_max, generos: p.generos || [], interesses: p.interesses || [], custom_audiences: p.custom_audiences || [] })
}
async function buscarCidades() {
  if (!buscaCidade.value.trim()) return
  const { data } = await sbClient.functions.invoke('meta-proxy', { body: { accountId: ACCOUNT_ID, path: '/search', params: { type: 'adgeolocation', location_types: JSON.stringify(['city']), q: buscaCidade.value, limit: 10 }, method: 'GET' } })
  cidadesAchadas.value = data?.data || []
}
function addCidade(c) { if (!publico.geo.cities.some((x) => x.key === c.key)) publico.geo.cities.push({ key: c.key, nome: `${c.name}${c.region ? ' · ' + c.region : ''}`, radius: 20, distance_unit: 'kilometer' }); cidadesAchadas.value = []; buscaCidade.value = '' }
function rmCidade(key) { publico.geo.cities = publico.geo.cities.filter((x) => x.key !== key) }
function excluirCidade(c) { if (!publico.geo.excluded.some((x) => x.key === c.key)) publico.geo.excluded.push({ key: c.key, nome: c.name, type: 'city' }); cidadesAchadas.value = []; buscaCidade.value = '' }
function rmExcluida(key) { publico.geo.excluded = publico.geo.excluded.filter((x) => x.key !== key) }
async function buscarInteresses() {
  if (!buscaInteresse.value.trim()) return
  const { data } = await sbClient.functions.invoke('meta-proxy', { body: { accountId: ACCOUNT_ID, path: '/search', params: { type: 'adinterest', q: buscaInteresse.value, limit: 10 }, method: 'GET' } })
  interessesAchados.value = data?.data || []
}
function addInteresse(i) { if (!publico.interesses.some((x) => x.id === i.id)) publico.interesses.push({ id: i.id, name: i.name }); interessesAchados.value = []; buscaInteresse.value = '' }
function rmInteresse(id) { publico.interesses = publico.interesses.filter((x) => x.id !== id) }
function toggleGenero(g) { const i = publico.generos.indexOf(g); i > -1 ? publico.generos.splice(i, 1) : publico.generos.push(g) }
function publicoParaEnvio(p = publico) {
  return { geo: { cities: p.geo.cities.map((c) => ({ key: c.key, nome: c.nome, radius: c.radius, distance_unit: c.distance_unit })), excluded: p.geo.excluded.map((e) => ({ key: e.key, nome: e.nome, type: e.type })) }, idade_min: p.idade_min, idade_max: p.idade_max, generos: [...p.generos], interesses: p.interesses.map((i) => ({ id: i.id, name: i.name })), custom_audiences: p.custom_audiences.map((a) => ({ id: a.id, name: a.name, subtype: a.subtype })) }
}
async function salvarPreset() {
  const nome = prompt('Nome do preset:', publico.nome || ''); if (!nome) return
  const preset = { ...publicoParaEnvio(), nome }
  if (publico.presetId) preset.id = publico.presetId
  const { data, error } = await sbClient.functions.invoke('fabrica-publicos', { body: { acao: 'salvar', preset } })
  if (error) return alert('Falha ao salvar: ' + error.message)
  publico.nome = nome; await carregarPresets(); if (data?.id) publico.presetId = data.id
}
async function apagarPreset() {
  if (!publico.presetId) return; if (!confirm('Apagar este preset?')) return
  const { error } = await sbClient.functions.invoke('fabrica-publicos', { body: { acao: 'apagar', id: publico.presetId } })
  if (error) return alert('Falha ao apagar: ' + error.message)
  publico.presetId = ''; await carregarPresets()
}

// ===== Públicos salvos (audiences do Meta: engajamento/lookalike) =====
const audiences = ref([]); const carregandoAud = ref(false)
const IG_ID = '17841462952561833', PAGE_ID = '324679337390168' // marca única hoje; futuro = da tabela de marcas
const erroAud = ref('')
async function listarAudiences() {
  carregandoAud.value = true; erroAud.value = ''
  // approximate_count foi removido na Graph v22 (dava #100 e a chamada falhava em silêncio) —
  // usa approximate_count_upper_bound. E surfaça erro (Meta ou meta-proxy) em vez de engolir.
  const { data, error } = await sbClient.functions.invoke('meta-proxy', { body: { accountId: ACCOUNT_ID, path: `/${ACT}/customaudiences`, params: { fields: 'id,name,subtype,approximate_count_lower_bound,approximate_count_upper_bound', limit: 100 }, method: 'GET' } })
  carregandoAud.value = false
  if (error || data?.error) { erroAud.value = (data?.error?.message || error?.message || 'Falha ao carregar públicos'); audiences.value = []; return }
  audiences.value = (data?.data || []).map((a) => ({ ...a, aprox: a.approximate_count_upper_bound }))
}
function toggleAudiencia(a) {
  const i = publico.custom_audiences.findIndex((x) => x.id === a.id)
  i > -1 ? publico.custom_audiences.splice(i, 1) : publico.custom_audiences.push({ id: a.id, name: a.name, subtype: a.subtype })
}
// Regra no formato flexible-rule documentado do Meta (v22): inclusions>rules>event_sources +
// retention_seconds + filter{field:'event',operator:'eq',value:'ig_business_profile_all'}. Passa o
// objeto direto (o meta-proxy faz JSON.stringify). OBS (validado ao vivo 2026-07-12): a CRIAÇÃO de
// custom audience via API está bloqueada nesta conta/versão (o Graph recusa o rule mesmo com o valor
// canônico, ex.: 'page_engaged' → code 2654) — provável restrição de elegibilidade da fonte/transporte
// do proxy (params vão por query string). O caminho que FUNCIONA é "Carregar públicos" (selecionar os
// que já existem no Gerenciador). Estas funções ficam no formato certo p/ quando o bloqueio sair.
const ERRO_AUD = 'A criação de público via API está bloqueada nesta conta pelo Meta. Crie o público no Gerenciador de Anúncios e use "Carregar públicos" pra selecioná-lo aqui.'
async function criarEngajamento() {
  const nome = prompt('Nome do público de engajamento:', 'Engajou IG 365d'); if (!nome) return
  const rule = { inclusions: { operator: 'or', rules: [{ event_sources: [{ type: 'ig_business', id: IG_ID }], retention_seconds: 31536000, filter: { operator: 'or', filters: [{ field: 'event', operator: 'eq', value: 'ig_business_profile_all' }] } }] } }
  const { data, error } = await sbClient.functions.invoke('meta-proxy', { body: { accountId: ACCOUNT_ID, path: `/${ACT}/customaudiences`, method: 'POST', params: { name: nome, subtype: 'ENGAGEMENT', rule } } })
  if (error || !data?.id) return alert(ERRO_AUD + '\n\n(' + (error?.message || (data?.error?.message) || JSON.stringify(data)) + ')')
  publico.custom_audiences.push({ id: data.id, name: nome, subtype: 'ENGAGEMENT' }); await listarAudiences()
}
async function criarLookalike(origem) {
  const nome = prompt('Nome do lookalike:', 'Lookalike 1%'); if (!nome) return
  const lookalike_spec = { country: 'BR', ratio: 0.01, type: 'similarity' }
  const { data, error } = await sbClient.functions.invoke('meta-proxy', { body: { accountId: ACCOUNT_ID, path: `/${ACT}/customaudiences`, method: 'POST', params: { name: nome, subtype: 'LOOKALIKE', origin_audience_id: origem, lookalike_spec } } })
  if (error || !data?.id) return alert(ERRO_AUD + '\n\n(' + (error?.message || (data?.error?.message) || JSON.stringify(data)) + ')')
  publico.custom_audiences.push({ id: data.id, name: nome, subtype: 'LOOKALIKE' }); await listarAudiences()
}

onMounted(async () => {
  lojasCfg.value = await sb('fabrica_lojas?select=nome,geo_cities')
  // (re)inicializa o público de cada loja já selecionada com a cidade de origem dela
  for (const slug of destino.lojas) publicoPorLoja[slug] = publicoBase(slug)
  lojaAtiva.value = destino.lojas[0] || 'tivoli'
  carregarLoja(lojaAtiva.value)
  const { data } = await sbClient.functions.invoke('meta-proxy', { body: { accountId: ACCOUNT_ID, path: `/${ACT}/campaigns`, params: { fields: 'id,name', limit: 200 }, method: 'GET' } })
  campanhas.value = data?.data || []
  await carregarPresets()
  listarAudiences() // auto-carrega os públicos (audiences) já existentes no Meta — não bloqueia o mount
  // Retoma um subir em andamento (usuário saiu e voltou): reata o banner/polling e trava re-clique.
  if (props.retomarJobId) start(props.retomarJobId)
})
async function subir() {
  if (destino.tipo === 'nova' && !destino.lojas.length) return alert('Selecione ao menos uma loja.')
  salvarAtiva() // persiste a aba atual antes de montar o payload
  const params = { campanhaId: props.campanhaId, destino: destino.tipo === 'existente'
    ? { tipo: 'existente', campaignId: destino.campaignId }
    : { tipo: 'nova', lojas: destino.lojas.map((slug) => ({ slug, publico: publicoParaEnvio(publicoPorLoja[slug] || publico) })) } }
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
      <h2>Publicar na Meta <AjudaTooltip chave="subir" /></h2>
      <p class="lead">Os anúncios sobem <b>pausados</b> — ninguém vê e não gastam nada até você ativar. Escolha onde publicar.</p>
    </div>

    <div class="panel">
      <div class="ph"><span class="eyebrow">Destino</span></div>
      <div class="choices">
        <label class="choice" :class="{ sel: destino.tipo==='nova' }">
          <input type="radio" value="nova" v-model="destino.tipo">
          <span class="ch-nm">Nova campanha por loja</span>
          <span v-if="destino.tipo==='nova'" class="lojas" @click.stop>
            <button type="button" v-for="l in LOJAS" :key="l.slug" class="loja-chip" :class="{ sel: destino.lojas.includes(l.slug) }" @click.prevent="toggleLoja(l.slug)">{{ l.nome }}</button>
          </span>
        </label>
        <label class="choice" :class="{ sel: destino.tipo==='existente' }">
          <input type="radio" value="existente" v-model="destino.tipo">
          <span class="ch-nm">Campanha existente</span>
          <select v-if="destino.tipo==='existente'" v-model="destino.campaignId"><option v-for="c in campanhas" :key="c.id" :value="c.id">{{ c.name }}</option></select>
        </label>
      </div>

      <div class="cmdrow">
        <button class="cmd amber" :disabled="job && ['enfileirado','rodando'].includes(job.status)" @click="subir">
          <span class="ci">▶</span> {{ (job && ['enfileirado','rodando'].includes(job.status)) ? 'Publicando…' : 'Publicar (pausado)' }}
        </button>
      </div>

      <!-- BANNER de progresso do subir (chamativo) -->
      <div v-if="job" class="subir-banner" :class="job.status">
        <div v-if="['enfileirado','rodando'].includes(job.status)" class="sb-body">
          <span class="sb-spin"></span>
          <div>
            <b>Publicando na Meta…</b>
            <div class="sb-sub">Criando as campanhas e anúncios (pausados). Pode levar ~2 min — <b>pode aguardar aqui</b>, não feche a tela. Se sair, ao voltar você retoma no Conferir.</div>
          </div>
        </div>
        <div v-else-if="job.status==='concluido'" class="sb-body">
          <span class="sb-ic">✅</span>
          <div><b>Publicado (pausado)!</b><div class="sb-sub">{{ job.resultado?.adIds?.length || 0 }} anúncios criados. Indo para o Conferir…</div></div>
        </div>
        <div v-else-if="job.status==='erro'" class="sb-body">
          <span class="sb-ic">⚠️</span>
          <div><b>Deu erro ao publicar.</b><div class="sb-sub js-err">{{ job.erro }}</div></div>
        </div>
      </div>
    </div>

    <div class="panel" v-if="destino.tipo==='nova'">
      <div class="ph">
        <span class="eyebrow">Localização + Público</span>
        <span class="eyebrow muted">por loja</span>
      </div>
      <!-- abas por loja: cada loja tem seu próprio público (default = cidade de origem) -->
      <div v-if="destino.lojas.length > 1" class="lojas" style="margin-bottom:12px">
        <button type="button" v-for="slug in destino.lojas" :key="slug" class="loja-chip" :class="{ sel: lojaAtiva===slug }" @click="trocarAba(slug)">
          {{ LOJAS.find(l=>l.slug===slug)?.nome || slug }}
        </button>
      </div>
      <p v-if="destino.lojas.length > 1" class="eyebrow muted" style="margin:-4px 0 10px">Editando o público de <b>{{ LOJAS.find(l=>l.slug===lojaAtiva)?.nome || lojaAtiva }}</b>.</p>

      <div class="fields">
        <label class="field wide">
          <span class="fl">Usar preset salvo</span>
          <select class="fi" v-model="publico.presetId" @change="aplicarPreset">
            <option value="">— nenhum —</option>
            <option v-for="p in presets" :key="p.id" :value="p.id">{{ p.nome }}</option>
          </select>
        </label>
      </div>

      <div class="fields" style="margin-top:12px">
        <label class="field wide">
          <span class="fl">Buscar cidade (incluir ou excluir)</span>
          <div class="searchrow">
            <input class="fi" v-model="buscaCidade" placeholder="ex.: São Paulo" @keyup.enter="buscarCidades">
            <button class="marcar-todos" type="button" @click="buscarCidades">Buscar</button>
          </div>
        </label>
      </div>

      <ul v-if="cidadesAchadas.length" class="resultlist">
        <li v-for="c in cidadesAchadas" :key="c.key">
          <span>{{ c.name }}<span v-if="c.region"> · {{ c.region }}</span></span>
          <span class="resultacoes">
            <button class="marcar-todos" type="button" @click="addCidade(c)">Incluir</button>
            <button class="marcar-todos" type="button" @click="excluirCidade(c)">Excluir</button>
          </span>
        </li>
      </ul>

      <div class="chips" v-if="publico.geo.cities.length">
        <span class="chip" v-for="c in publico.geo.cities" :key="c.key">
          {{ c.nome }}
          <input class="fi num chip-radius" type="number" min="1" max="80" v-model.number="c.radius">
          <select class="chip-unit" v-model="c.distance_unit">
            <option value="kilometer">km</option>
            <option value="mile">mi</option>
          </select>
          <button class="chip-x" type="button" @click="rmCidade(c.key)">×</button>
        </span>
      </div>

      <div class="chips" v-if="publico.geo.excluded.length">
        <span class="chip excluido" v-for="e in publico.geo.excluded" :key="e.key">
          excluir: {{ e.nome }}
          <button class="chip-x" type="button" @click="rmExcluida(e.key)">×</button>
        </span>
      </div>

      <div class="fields" style="margin-top:12px">
        <label class="field">
          <span class="fl">Idade mínima</span>
          <input class="fi num" type="number" min="13" max="65" v-model.number="publico.idade_min">
        </label>
        <label class="field">
          <span class="fl">Idade máxima</span>
          <input class="fi num" type="number" min="13" max="65" v-model.number="publico.idade_max">
        </label>
        <label class="field wide">
          <span class="fl">Gênero</span>
          <div class="lojas">
            <button type="button" class="loja-chip" :class="{ sel: publico.generos.includes(1) }" @click="toggleGenero(1)">Homens</button>
            <button type="button" class="loja-chip" :class="{ sel: publico.generos.includes(2) }" @click="toggleGenero(2)">Mulheres</button>
            <span v-if="!publico.generos.length" class="ch-nm" style="font-weight:400;color:var(--ink-dim)">Todos (vazio = ambos)</span>
          </div>
        </label>
      </div>

      <div class="fields" style="margin-top:12px">
        <label class="field wide">
          <span class="fl">Buscar interesse</span>
          <div class="searchrow">
            <input class="fi" v-model="buscaInteresse" placeholder="ex.: moda feminina" @keyup.enter="buscarInteresses">
            <button class="marcar-todos" type="button" @click="buscarInteresses">Buscar</button>
          </div>
        </label>
      </div>

      <ul v-if="interessesAchados.length" class="resultlist">
        <li v-for="i in interessesAchados" :key="i.id">
          <span>{{ i.name }}</span>
          <button class="marcar-todos" type="button" @click="addInteresse(i)">Adicionar</button>
        </li>
      </ul>

      <div class="chips" v-if="publico.interesses.length">
        <span class="chip" v-for="i in publico.interesses" :key="i.id">
          {{ i.name }}
          <button class="chip-x" type="button" @click="rmInteresse(i.id)">×</button>
        </span>
      </div>

      <div class="cmdrow">
        <button class="cmd cyan" type="button" @click="salvarPreset">Salvar preset</button>
        <button class="cmd cyan" type="button" :disabled="!publico.presetId" @click="apagarPreset">Apagar preset</button>
      </div>

      <div class="ph" style="margin-top:16px"><span class="eyebrow">Públicos salvos</span></div>

      <div class="cmdrow">
        <button class="cmd cyan" type="button" @click="listarAudiences">{{ carregandoAud ? 'Carregando…' : 'Carregar públicos' }}</button>
        <button class="cmd cyan" type="button" @click="criarEngajamento">Criar engajamento</button>
      </div>
      <p v-if="erroAud" style="color:var(--abort);font-size:13px;margin:4px 0">{{ erroAud }}</p>

      <ul v-if="audiences.length" class="resultlist">
        <li v-for="a in audiences" :key="a.id">
          <label class="ch-nm" style="font-weight:400;display:flex;align-items:center;gap:8px">
            <input type="checkbox" :checked="publico.custom_audiences.some((x) => x.id === a.id)" @change="toggleAudiencia(a)">
            {{ a.name }} <span style="color:var(--ink-dim)">· {{ a.subtype }}<span v-if="a.aprox != null"> · ~{{ a.aprox }}</span></span>
          </label>
          <span class="resultacoes">
            <button class="marcar-todos" type="button" @click="criarLookalike(a.id)">Criar lookalike desta</button>
          </span>
        </li>
      </ul>

      <div class="chips" v-if="publico.custom_audiences.length">
        <span class="chip" v-for="a in publico.custom_audiences" :key="a.id">
          {{ a.name }} <span style="color:var(--ink-dim)">· {{ a.subtype }}</span>
          <button class="chip-x" type="button" @click="toggleAudiencia(a)">×</button>
        </span>
      </div>
    </div>
  </section>
</template>
