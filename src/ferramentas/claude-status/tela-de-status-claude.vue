<template>
  <!-- Painel de Status do Claude: mission control em linguagem simples (pra quem não é
       técnico). Robôs de IA em produção (custo/tempo/volume reais de ia_execucoes) +
       status dos projetos (projetos_status, derivado dos planos). Classes .csc- para não
       colidir com o CSS global. Full-bleed e responsivo. -->
  <div class="csc-tela">
    <div class="csc-topbar">
      <div class="csc-tb-left">
        <button class="csc-back" @click="voltar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>Central</button>
        <img class="rbv-logo rbv-logo-light" :src="logoClaroUrl" alt="RBV">
        <img class="rbv-logo rbv-logo-dark" :src="logoEscuroUrl" alt="RBV">
      </div>
      <span class="csc-title">Status do Claude</span>
      <div class="csc-tb-right">
        <span class="csc-live"><i></i>Ao vivo</span>
        <div class="csc-clock">{{ relogio }}</div>
        <div class="csc-upd">{{ statusCarga }}</div>
      </div>
    </div>

    <div class="csc-body">
      <!-- Abas: Visão geral | Extrato de gastos -->
      <div class="csc-tabs">
        <button :class="{ on: aba === 'visao' }" @click="aba = 'visao'">Visão geral</button>
        <button :class="{ on: aba === 'extrato' }" @click="aba = 'extrato'">Extrato de gastos</button>
      </div>

      <div v-show="aba === 'visao'" class="csc-wrap">
      <!-- HERO: resumo do mês em uma frase + total gasto -->
      <section class="csc-hero">
        <div class="csc-hero-txt">
          <span class="csc-hero-eyebrow">Central de robôs de inteligência artificial</span>
          <h1 class="csc-hero-h1">O que a IA fez por você</h1>
          <p class="csc-hero-p">
            Nos últimos 30 dias, os robôs fizeram <b>{{ kpis.acoes }} tarefas</b>,
            produziram <b>{{ fmtNum(kpis.itens) }} itens</b> (criativos, anúncios, relatórios…)
            e trabalharam por <b>{{ fmtDur(kpis.tempoMs) }}</b> no total.
          </p>
        </div>
        <div class="csc-hero-gasto">
          <span class="csc-hero-gasto-lbl">Custo no mês</span>
          <span class="csc-hero-gasto-val">{{ fmtBRL(kpis.usdMes * CAMBIO) }}</span>
          <span class="csc-hero-gasto-sub">equivale a {{ fmtUsd(kpis.usdMes) }} · hoje: {{ fmtBRL(kpis.usdHoje * CAMBIO) }}</span>
        </div>
      </section>

      <!-- LEGENDA: o que é "custo zero" -->
      <div class="csc-legenda">
        <span class="csc-tag csc-tag-zero">Custo zero</span>
        <p>Tarefas que <b>criam imagens</b> ou <b>sobem anúncios</b> não usam a API paga (que cobra por uso) — só a assinatura. Então custam <b>R$ 0</b>. Já os <b>textos</b> (relatórios, análises, resumos) usam a API paga e têm custo em reais.</p>
      </div>

      <!-- ROBÔS -->
      <div class="csc-sec">
        <h2 class="csc-sec-t">Os robôs de IA</h2>
        <p class="csc-sec-d">Programas que trabalham sozinhos pra você. Aqui está o que cada um fez por último.</p>
      </div>
      <div class="csc-robos">
        <article v-for="r in robosView" :key="r.slug" class="csc-robo" :class="'st-' + (r.ult ? r.ult.status : 'idle')">
          <header class="csc-robo-head">
            <span class="csc-robo-dot"></span>
            <div>
              <h3 class="csc-robo-nome">{{ r.label }}</h3>
              <p class="csc-robo-faz">{{ r.faz }}</p>
            </div>
          </header>
          <div v-if="r.ult" class="csc-robo-corpo">
            <p class="csc-robo-frase"><b>{{ r.verbo }} {{ fmtNum(r.ult.itens) }} {{ unid(r.ult.itens, r.ult.unidade) }}</b><span v-if="r.ult.status==='erro'"> — mas deu erro</span>.</p>
            <ul class="csc-robo-detalhes">
              <li><span class="csc-di-lbl">Última vez</span><span class="csc-di-val">{{ tempoRel(r.ult.run_at) }}</span></li>
              <li v-if="r.ult.duracao_ms"><span class="csc-di-lbl">Tempo que levou</span><span class="csc-di-val">{{ fmtDur(r.ult.duracao_ms) }}</span></li>
              <li><span class="csc-di-lbl">Custo</span><span class="csc-di-val" :class="{ 'csc-zero': Number(r.ult.usd)===0 }">{{ custoFrase(r.ult.usd) }}</span></li>
            </ul>
          </div>
          <div v-else class="csc-robo-corpo csc-robo-vazio">Ainda não rodou nenhuma vez.</div>
          <footer class="csc-robo-foot">Roda: {{ r.quando }}</footer>
        </article>
      </div>

      <!-- PROJETOS -->
      <div class="csc-sec csc-sec-proj">
        <div>
          <h2 class="csc-sec-t">Projetos em construção</h2>
          <p class="csc-sec-d">Em que pé está cada coisa. Atualiza sozinho pelos planos — e você pode <b>arrastar os cards</b> entre as colunas, ou usar o lápis pra editar.</p>
        </div>
        <button class="csc-add-btn" @click="abrirNovo('em-andamento')">+ Novo projeto</button>
      </div>
      <div class="csc-kanban">
        <div v-for="col in colunas" :key="col.key" class="csc-col" :class="{ 'is-over': arrastando }" @dragover.prevent @dragenter.prevent @drop="onDropCol(col.key)">
          <div class="csc-col-head" :class="'sit-' + col.key">
            <span class="csc-col-nome">{{ col.label }}</span>
            <span class="csc-col-acoes">
              <span class="csc-col-cont">{{ (projetosPorSit[col.key] || []).length }}</span>
              <button class="csc-col-add" title="Adicionar aqui" @click="abrirNovo(col.key)">+</button>
            </span>
          </div>
          <p class="csc-col-desc">{{ col.desc }}</p>
          <div class="csc-col-body">
            <div v-for="p in (projetosPorSit[col.key] || [])" :key="p.projeto" class="csc-proj" draggable="true" @dragstart="onDrag(p)" @dragend="arrastando = null">
              <div class="csc-proj-top">
                <span class="csc-proj-titulo">{{ p.titulo }}</span>
                <span class="csc-proj-tags">
                  <span v-if="p.etapa" class="csc-proj-etapa" title="Etapa/fase atual">{{ p.etapa }}</span>
                  <span v-if="p.manual" class="csc-proj-manual" title="Editado à mão (a leitura automática não mexe nele)">à mão</span>
                </span>
              </div>
              <div v-if="p.descricao" class="csc-proj-desc">{{ p.descricao }}</div>
              <template v-if="p.checkboxes_total">
                <div class="csc-bar"><i :style="{ width: p.progresso + '%' }"></i></div>
                <div class="csc-proj-prog">{{ p.progresso }}% pronto ({{ p.checkboxes_feitos }} de {{ p.checkboxes_total }} passos)</div>
              </template>
              <div class="csc-proj-ferramentas">
                <button title="Editar" @click="abrirEditar(p)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
                <button title="Remover" @click="excluir(p)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
              </div>
            </div>
            <div v-if="!(projetosPorSit[col.key] || []).length" class="csc-col-vazio">Nada por aqui. Arraste um card ou clique no +.</div>
          </div>
        </div>
      </div>

      <!-- LINHA DO TEMPO -->
      <div class="csc-sec">
        <h2 class="csc-sec-t">Linha do tempo</h2>
        <p class="csc-sec-d">Tudo que os robôs fizeram recentemente, do mais novo para o mais antigo.</p>
      </div>
      <div class="csc-feed">
        <div v-for="(e, i) in feed" :key="e.id || i" class="csc-fi" :class="'st-' + e.status">
          <span class="csc-fi-dot"></span>
          <div class="csc-fi-main">
            <p class="csc-fi-frase"><b>{{ nomeRobo(e.robo) }}</b> {{ fraseAcao(e) }}</p>
            <p class="csc-fi-det">
              <span v-if="e.duracao_ms">Levou {{ fmtDur(e.duracao_ms) }}.</span>
              <span :class="{ 'csc-zero': Number(e.usd)===0 }">{{ custoFrase(e.usd) }}</span>
            </p>
          </div>
          <span class="csc-fi-quando">{{ tempoRel(e.run_at) }}</span>
        </div>
        <div v-if="!feed.length" class="csc-fi-vazio">Nenhuma tarefa registrada ainda. Quando um robô rodar, aparece aqui.</div>
      </div>
      </div><!-- fim aba visão geral -->

      <!-- ABA: EXTRATO DE GASTOS -->
      <div v-show="aba === 'extrato'" class="csc-wrap">
        <div class="csc-ex-head">
          <div>
            <h2 class="csc-sec-t">Extrato de gastos</h2>
            <p class="csc-sec-d">Quanto a IA custou, por período e por área. Só as tarefas que usam a API paga têm valor; as de "custo zero" entram como R$ 0.</p>
          </div>
          <div class="csc-periodo">
            <button v-for="op in periodos" :key="op.d" :class="{ on: periodo === op.d }" @click="periodo = op.d">{{ op.label }}</button>
          </div>
        </div>

        <div class="csc-kpis">
          <div class="csc-kpi"><span class="csc-kpi-lbl">Total gasto no período</span><span class="csc-kpi-val">{{ fmtBRL(exResumo.usd * CAMBIO) }}</span><span class="csc-kpi-sub">equivale a {{ fmtUsd(exResumo.usd) }}</span></div>
          <div class="csc-kpi"><span class="csc-kpi-lbl">Tarefas que custaram</span><span class="csc-kpi-val">{{ exResumo.pagas }}</span><span class="csc-kpi-sub">de {{ exResumo.total }} no total</span></div>
          <div class="csc-kpi"><span class="csc-kpi-lbl">Tarefas de custo zero</span><span class="csc-kpi-val">{{ exResumo.zero }}</span><span class="csc-kpi-sub">não usaram API paga</span></div>
          <div class="csc-kpi"><span class="csc-kpi-lbl">Média por tarefa paga</span><span class="csc-kpi-val">{{ fmtBRL(exResumo.mediaPaga * CAMBIO) }}</span><span class="csc-kpi-sub">no período</span></div>
        </div>

        <div class="csc-sec"><h2 class="csc-sec-t">Quem está gastando mais</h2><p class="csc-sec-d">Total por área no período, do maior para o menor. Fábrica e Painel aparecem em R$ 0 (não usam API paga).</p></div>
        <div class="csc-ranking">
          <div v-for="(a, i) in gastoPorArea" :key="a.area" class="csc-rank" :class="{ topo: i === 0 && a.usd > 0 }">
            <div class="csc-rank-top">
              <span class="csc-rank-nome"><b>{{ i + 1 }}º</b> {{ a.area }}</span>
              <span class="csc-rank-val">{{ a.usd === 0 ? 'R$ 0' : fmtBRL(a.usd * CAMBIO) }}</span>
            </div>
            <div class="csc-rank-bar"><i :style="{ width: a.barPct + '%' }"></i></div>
            <div class="csc-rank-sub">{{ a.pct }}% do total · {{ a.acoes }} tarefa{{ a.acoes === 1 ? '' : 's' }}</div>
          </div>
          <div v-if="!gastoPorArea.length" class="csc-col-vazio">Nenhuma tarefa no período.</div>
        </div>

        <div class="csc-sec"><h2 class="csc-sec-t">Extrato detalhado</h2><p class="csc-sec-d">Cada tarefa do período, da mais recente para a mais antiga — como um extrato de banco.</p></div>
        <div class="csc-extrato">
          <div class="csc-ex-row csc-ex-cab"><span>Quando</span><span>Área</span><span>O que a IA fez</span><span class="csc-ex-v">Valor</span></div>
          <div v-for="(e, i) in execucoesPeriodo" :key="e.id || i" class="csc-ex-row">
            <span class="csc-ex-data">{{ fmtData(e.run_at) }}</span>
            <span class="csc-ex-area">{{ areaDe(e.robo) }}</span>
            <span class="csc-ex-oque">{{ fraseAcaoMaiuscula(e) }}</span>
            <span class="csc-ex-v" :class="{ 'csc-zero': Number(e.usd) === 0 }">{{ Number(e.usd) === 0 ? 'R$ 0' : fmtBRL(e.usd * CAMBIO) }}</span>
          </div>
          <div v-if="execucoesPeriodo.length" class="csc-ex-row csc-ex-tot"><span></span><span></span><span>Total do período</span><span class="csc-ex-v">{{ fmtBRL(exResumo.usd * CAMBIO) }}</span></div>
          <div v-if="!execucoesPeriodo.length" class="csc-fi-vazio">Nenhuma tarefa nesse período.</div>
        </div>
      </div><!-- fim aba extrato -->
    </div>

    <!-- Modal criar/editar projeto -->
    <div v-if="modal.aberto" class="csc-modal-bg" @click.self="fecharModal">
      <div class="csc-modal">
        <h3 class="csc-modal-t">{{ modal.editando ? 'Editar projeto' : 'Novo projeto' }}</h3>
        <label class="csc-campo"><span>Nome do projeto</span><input v-model="modal.titulo" type="text" placeholder="Ex.: Portal de Notícias" @keyup.enter="salvarModal"></label>
        <label class="csc-campo"><span>Etapa (opcional)</span><input v-model="modal.etapa" type="text" placeholder="Ex.: Fase 2, SP6…"></label>
        <label class="csc-campo"><span>Descrição (opcional)</span><textarea v-model="modal.descricao" rows="3" placeholder="Em que pé está, em uma ou duas frases."></textarea></label>
        <label class="csc-campo"><span>Situação</span>
          <select v-model="modal.situacao">
            <option v-for="c in colunas" :key="c.key" :value="c.key">{{ c.label }}</option>
          </select>
        </label>
        <div class="csc-modal-foot">
          <button class="csc-btn-sec" @click="fecharModal">Cancelar</button>
          <button class="csc-btn-pri" @click="salvarModal">{{ modal.editando ? 'Salvar' : 'Criar' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { sb } from '../../compartilhado/buscar-e-salvar-dados.js'
import { sbClient } from '../../compartilhado/conectar-no-banco-de-dados.js'
import { adminToast } from '../../compartilhado/avisos.js'

const router = useRouter()
const voltar = () => router.push({ name: 'inicio' })
const logoClaroUrl = '/midia/LOGOTIPOBRENOPRETO.png'
const logoEscuroUrl = '/midia/LOGOTIPOBRENOBRANCO.png'

const CAMBIO = 5.5 // US$ -> R$ (mesmo valor usado nos logs dos robôs)

// Robôs conhecidos: rótulo, o que faz (leigo), quando roda (leigo) e o verbo da produção.
const ROBOS = [
  { slug: 'gestor-comercial', label: 'Gestor Comercial', faz: 'Escreve o relatório comercial da semana (metas, concorrência, estoque).', quando: 'toda segunda de manhã', verbo: 'Escreveu' },
  { slug: 'budget-ia',        label: 'Consultor de Anúncios', faz: 'Analisa as campanhas do Meta e sugere o orçamento de cada uma.', quando: 'toda segunda de manhã', verbo: 'Analisou' },
  { slug: 'coletor-noticias', label: 'Coletor de Notícias', faz: 'Lê e resume as novidades dos concorrentes.', quando: 'toda segunda de manhã', verbo: 'Resumiu' },
  { slug: 'panorama',         label: 'Panorama do Mercado', faz: 'Escreve o resumão do que rolou no mercado.', quando: 'quando você pede', verbo: 'Escreveu' },
  { slug: 'fabrica-gerar',    label: 'Fábrica · Criar Criativos', faz: 'Cria as imagens (criativos) dos anúncios.', quando: 'quando você manda', verbo: 'Criou' },
  { slug: 'fabrica-subir',    label: 'Fábrica · Subir Campanha', faz: 'Monta a campanha e sobe os anúncios para o Meta.', quando: 'quando você manda', verbo: 'Subiu' },
  { slug: 'fabrica-ativar',   label: 'Fábrica · Ligar Anúncios', faz: 'Liga os anúncios no Gerenciador do Meta.', quando: 'quando você manda', verbo: 'Ligou' },
  { slug: 'status-projetos',  label: 'Atualizador do Painel', faz: 'Atualiza este painel com o andamento dos projetos.', quando: 'a cada mudança nos planos', verbo: 'Atualizou' },
]
const META = Object.fromEntries(ROBOS.map(r => [r.slug, r]))
const nomeRobo = (slug) => (META[slug]?.label) || slug

// Colunas do kanban, em linguagem bem literal.
const colunas = [
  { key: 'em-andamento', label: 'Fazendo agora',      desc: 'Está sendo construído neste momento.' },
  { key: 'planejado',    label: 'Ainda não começou',  desc: 'Está planejado, mas o trabalho não começou.' },
  { key: 'pausado',      label: 'Parado',             desc: 'Começou mas travou, esperando alguma coisa.' },
  { key: 'no-ar',        label: 'Pronto e no ar',     desc: 'Terminado e já funcionando de verdade.' },
]

const execucoes = ref([])
const projetos = ref([])
const relogio = ref('')
const statusCarga = ref('carregando…')

// ── formatação ──
const fmtUsd = (v) => 'US$ ' + Number(v || 0).toFixed(2)
const fmtBRL = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtNum = (v) => Number(v || 0).toLocaleString('pt-BR')
function fmtDur(ms) {
  const s = Math.round((ms || 0) / 1000)
  if (s < 1) return 'menos de 1 segundo'
  if (s < 60) return s + (s === 1 ? ' segundo' : ' segundos')
  const m = Math.floor(s / 60), r = s % 60
  if (m < 60) return r ? `${m} min e ${r}s` : `${m} minuto${m === 1 ? '' : 's'}`
  const h = Math.floor(m / 60), mm = m % 60
  return `${h}h${mm ? ' e ' + mm + 'min' : ''}`
}
function tempoRel(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.round(diff / 1000)
  if (s < 60) return 'agora há pouco'
  const m = Math.floor(s / 60); if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60); if (h < 24) return `há ${h} hora${h === 1 ? '' : 's'}`
  const d = Math.floor(h / 24)
  return d === 1 ? 'ontem' : `há ${d} dias`
}
// Frase do custo, em reais e explicando o "custo zero".
function custoFrase(usd) {
  return Number(usd) === 0 ? 'R$ 0 — não usou API paga, somente a assinatura' : `${fmtBRL(Number(usd) * CAMBIO)} (${fmtUsd(usd)})`
}
// Coloca a unidade no singular quando a quantidade é 1 ("1 relatório", não "1 relatórios").
function unid(n, u) {
  return Number(n) === 1 ? String(u || '').replace(/s$/, '') : u
}
// Frase de ação para a linha do tempo, ex.: "criou 100 criativos".
function fraseAcao(e) {
  const verbo = (META[e.robo]?.verbo || 'Fez').toLowerCase()
  if (e.itens != null && e.unidade) return `${verbo} ${fmtNum(e.itens)} ${unid(e.itens, e.unidade)}`
  return e.acao
}

// ── agregações ──
const feed = computed(() => execucoes.value.slice(0, 30))

const kpis = computed(() => {
  const now = Date.now()
  const DIA = 86400000
  const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0)
  let usdHoje = 0, usdMes = 0, acoes = 0, itens = 0, tempoMs = 0
  for (const e of execucoes.value) {
    const t = new Date(e.run_at).getTime()
    const usd = Number(e.usd) || 0
    if (t >= inicioHoje.getTime()) usdHoje += usd
    if (now - t <= 30 * DIA) { usdMes += usd; acoes++; itens += Number(e.itens) || 0; tempoMs += Number(e.duracao_ms) || 0 }
  }
  return { usdHoje, usdMes, acoes, itens, tempoMs }
})

// Robôs: mostra os que já rodaram primeiro (por última execução), depois os conhecidos que faltam.
const robosView = computed(() => {
  const ultimaPorRobo = {}
  for (const e of execucoes.value) if (!ultimaPorRobo[e.robo]) ultimaPorRobo[e.robo] = e // execucoes vem desc
  const lista = ROBOS.map(r => ({ ...r, ult: ultimaPorRobo[r.slug] || null }))
  return lista.sort((a, b) => {
    const ta = a.ult ? new Date(a.ult.run_at).getTime() : -1
    const tb = b.ult ? new Date(b.ult.run_at).getTime() : -1
    return tb - ta
  })
})

const projetosPorSit = computed(() => {
  const g = {}
  for (const p of projetos.value) (g[p.situacao] = g[p.situacao] || []).push(p)
  return g
})

// ── extrato de gastos ──
const aba = ref('visao')
const periodos = [{ d: 7, label: '7 dias' }, { d: 14, label: '14 dias' }, { d: 30, label: '30 dias' }, { d: 3650, label: 'Tudo' }]
const periodo = ref(30)

// Cada robô pertence a uma "área" (o que o usuário chama de projeto) — pra consolidar o gasto.
const AREA = {
  'gestor-comercial': 'Gestão Comercial',
  'budget-ia': 'Anúncios (orçamento)',
  'coletor-noticias': 'Notícias',
  'panorama': 'Notícias',
  'fabrica-gerar': 'Fábrica de Anúncios',
  'fabrica-subir': 'Fábrica de Anúncios',
  'fabrica-ativar': 'Fábrica de Anúncios',
  'status-projetos': 'Painel do Sistema',
}
const areaDe = (robo) => AREA[robo] || nomeRobo(robo)

const execucoesPeriodo = computed(() => {
  const lim = Date.now() - periodo.value * 86400000
  return execucoes.value.filter((e) => new Date(e.run_at).getTime() >= lim)
})
const exResumo = computed(() => {
  let usd = 0, pagas = 0, zero = 0
  for (const e of execucoesPeriodo.value) {
    const v = Number(e.usd) || 0
    usd += v
    if (v > 0) pagas++; else zero++
  }
  return { usd, pagas, zero, total: execucoesPeriodo.value.length, mediaPaga: pagas ? usd / pagas : 0 }
})
const gastoPorArea = computed(() => {
  const g = {}
  for (const e of execucoesPeriodo.value) {
    const a = areaDe(e.robo)
    if (!g[a]) g[a] = { area: a, usd: 0, acoes: 0 }
    g[a].usd += Number(e.usd) || 0
    g[a].acoes++
  }
  const arr = Object.values(g).sort((x, y) => y.usd - x.usd || y.acoes - x.acoes)
  const max = arr.reduce((m, x) => Math.max(m, x.usd), 0) || 1
  const tot = arr.reduce((s, x) => s + x.usd, 0) || 1
  return arr.map((x) => ({ ...x, pct: Math.round((x.usd / tot) * 100), barPct: Math.max(2, Math.round((x.usd / max) * 100)) }))
})
function fmtData(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' · ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
// "Escreveu 1 relatório" (com maiúscula) + nome do robô, pra linha do extrato.
function fraseAcaoMaiuscula(e) {
  const f = fraseAcao(e)
  return nomeRobo(e.robo) + ' — ' + f.charAt(0).toUpperCase() + f.slice(1)
}

// ── carga ──
async function carregar() {
  const [ex, pr] = await Promise.all([
    sb('ia_execucoes?select=*&order=run_at.desc&limit=200'),
    sb('projetos_status?select=*&arquivado=is.false&order=ordem.desc'),
  ])
  execucoes.value = ex
  projetos.value = pr
  const hh = new Date()
  statusCarga.value = 'atualizado às ' + hh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// ── kanban interativo: arrastar + criar/editar/excluir ──
const arrastando = ref(null)
function onDrag(p) { arrastando.value = p }
async function onDropCol(situacao) {
  const p = arrastando.value
  arrastando.value = null
  if (!p || p.situacao === situacao) return
  await moverPara(p, situacao)
}
async function moverPara(p, situacao) {
  p.situacao = situacao // otimista
  const { error } = await sbClient.from('projetos_status')
    .update({ situacao, manual: true, atualizado_em: new Date().toISOString() })
    .eq('projeto', p.projeto)
  if (error) { adminToast('Não consegui mover: ' + error.message, false); carregar() }
  else adminToast('Movido para "' + (colunas.find(c => c.key === situacao)?.label || situacao) + '"', true)
}

// Modal de criar/editar
const modal = reactive({ aberto: false, editando: null, titulo: '', etapa: '', descricao: '', situacao: 'em-andamento' })
function abrirNovo(situacao) {
  Object.assign(modal, { aberto: true, editando: null, titulo: '', etapa: '', descricao: '', situacao: situacao || 'em-andamento' })
}
function abrirEditar(p) {
  Object.assign(modal, { aberto: true, editando: p, titulo: p.titulo || '', etapa: p.etapa || '', descricao: p.descricao || '', situacao: p.situacao })
}
function fecharModal() { modal.aberto = false }
function slugDe(txt) {
  const base = (txt || 'projeto').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'projeto'
  return 'm-' + base + '-' + Math.random().toString(36).slice(2, 6)
}
async function salvarModal() {
  const t = modal.titulo.trim()
  if (!t) { adminToast('Dá um nome pro projeto.', false); return }
  const campos = { titulo: t, etapa: modal.etapa.trim() || null, descricao: modal.descricao.trim() || null, situacao: modal.situacao, manual: true, atualizado_em: new Date().toISOString() }
  if (modal.editando) {
    const { error } = await sbClient.from('projetos_status').update(campos).eq('projeto', modal.editando.projeto)
    if (error) { adminToast('Erro ao salvar: ' + error.message, false); return }
    adminToast('Projeto atualizado.', true)
  } else {
    const { error } = await sbClient.from('projetos_status').insert({ ...campos, projeto: slugDe(t), progresso: 0, arquivado: false, ordem: Math.floor(Date.now() / 86400000) })
    if (error) { adminToast('Erro ao criar: ' + error.message, false); return }
    adminToast('Projeto criado.', true)
  }
  modal.aberto = false
  await carregar()
}
async function excluir(p) {
  if (!window.confirm(`Tirar "${p.titulo}" do painel?`)) return
  const { error } = await sbClient.from('projetos_status').update({ arquivado: true, manual: true }).eq('projeto', p.projeto)
  if (error) { adminToast('Erro ao excluir: ' + error.message, false); return }
  adminToast('Removido do painel.', true)
  await carregar()
}

let _clockTimer = null, _refreshTimer = null
function tickRelogio() {
  relogio.value = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
onMounted(() => {
  tickRelogio()
  _clockTimer = setInterval(tickRelogio, 1000)
  carregar()
  _refreshTimer = setInterval(carregar, 60000)
})
onUnmounted(() => {
  if (_clockTimer) clearInterval(_clockTimer)
  if (_refreshTimer) clearInterval(_refreshTimer)
})
</script>

<style scoped>
/* Fontes (Sora + IBM Plex Mono/Sans) carregadas no index.html, junto das demais do app. */
.csc-tela {
  --fs: 'IBM Plex Sans', system-ui, sans-serif;
  --fd: 'Sora', system-ui, sans-serif;
  --fm: 'IBM Plex Mono', ui-monospace, 'SF Mono', monospace;
  --violet: #8b5cf6;
  min-height: 100vh; background: var(--bg); color: var(--text); font-family: var(--fs);
}
@keyframes cscUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

/* Topbar */
.csc-topbar { display: flex; align-items: center; gap: 16px; padding: 13px clamp(16px, 2.5vw, 44px); border-bottom: 1px solid var(--border); background: color-mix(in srgb, var(--surface) 88%, transparent); backdrop-filter: saturate(1.4) blur(10px); position: sticky; top: 0; z-index: 20; }
.csc-tb-left { display: flex; align-items: center; gap: 14px; }
.csc-back { display: inline-flex; align-items: center; gap: 5px; background: none; border: 1px solid var(--border); color: var(--muted); font-size: 12px; font-weight: 500; padding: 6px 11px; border-radius: var(--radius-sm); cursor: pointer; transition: border-color .18s, color .18s; }
.csc-back:hover { border-color: var(--accent); color: var(--text); }
.rbv-logo { height: 22px; width: auto; }
.rbv-logo-light { display: block; } .rbv-logo-dark { display: none; }
:global([data-theme="dark"]) .rbv-logo-light { display: none; }
:global([data-theme="dark"]) .rbv-logo-dark { display: block; }
.csc-title { font-family: var(--fs); font-size: 15px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: var(--text); flex: 1; }
.csc-tb-right { display: flex; align-items: center; gap: 16px; }
.csc-live { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--green); }
.csc-live i { width: 7px; height: 7px; border-radius: 50%; background: var(--green); animation: cscPulse 1.8s infinite; }
@keyframes cscPulse { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,.5); } 70% { box-shadow: 0 0 0 7px rgba(34,197,94,0); } 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); } }
.csc-clock { font-family: var(--fm); font-size: 15px; font-weight: 500; letter-spacing: .5px; color: var(--text); font-variant-numeric: tabular-nums; }
.csc-upd { font-size: 10px; color: var(--muted); letter-spacing: .2px; }

.csc-body { padding: clamp(16px, 2vw, 40px) clamp(16px, 2.5vw, 48px) 64px; display: flex; flex-direction: column; gap: clamp(20px, 2.2vw, 32px); width: 100%; }

/* HERO */
.csc-hero { display: flex; flex-wrap: wrap; align-items: stretch; justify-content: space-between; gap: 28px; padding: clamp(24px, 3.2vw, 44px); border-radius: 20px; border: 1px solid var(--border); animation: cscUp .5s cubic-bezier(.22,1,.36,1) both; background:
    radial-gradient(85% 130% at 100% 0%, color-mix(in srgb, var(--accent) 20%, transparent) 0%, transparent 58%),
    radial-gradient(70% 120% at 0% 100%, color-mix(in srgb, var(--violet) 15%, transparent) 0%, transparent 52%),
    var(--surface); box-shadow: var(--shadow-md); overflow: hidden; }
.csc-hero-txt { flex: 1 1 380px; display: flex; flex-direction: column; justify-content: center; }
.csc-hero-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; color: var(--accent); }
.csc-hero-h1 { font-family: var(--fd); font-size: clamp(30px, 4.6vw, 52px); font-weight: 600; letter-spacing: -.5px; color: var(--text); margin: 10px 0 14px; line-height: 1.02; }
.csc-hero-p { font-size: clamp(14px, 1.1vw, 16px); line-height: 1.65; color: var(--muted); max-width: 620px; }
.csc-hero-p b { color: var(--text); font-weight: 600; }
.csc-hero-gasto { flex: 0 0 auto; display: flex; flex-direction: column; justify-content: center; gap: 5px; padding: 4px 4px 4px 26px; border-left: 1px solid var(--border); }
.csc-hero-gasto-lbl { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--muted); }
.csc-hero-gasto-val { font-family: var(--fm); font-size: clamp(32px, 5.2vw, 56px); font-weight: 600; color: var(--text); line-height: 1; letter-spacing: -1px; font-variant-numeric: tabular-nums; }
.csc-hero-gasto-sub { font-size: 12px; color: var(--muted); font-family: var(--fm); }

/* LEGENDA */
.csc-legenda { display: flex; align-items: center; gap: 14px; padding: 13px 18px; border-radius: var(--radius-md); border: 1px dashed var(--border); background: var(--surface2); }
.csc-legenda p { font-size: 13px; line-height: 1.5; color: var(--muted); }
.csc-legenda b { color: var(--text); font-weight: 600; }
.csc-tag { flex-shrink: 0; font-size: 11px; font-weight: 700; letter-spacing: .5px; padding: 4px 10px; border-radius: 20px; }
.csc-tag-zero { color: var(--green); background: rgba(26,110,69,.10); border: 1px solid rgba(26,110,69,.30); }
:global([data-theme="dark"]) .csc-tag-zero { background: rgba(34,197,94,.14); border-color: rgba(34,197,94,.34); }

/* Seções */
.csc-sec { margin-top: 8px; }
.csc-sec-t { font-family: var(--fd); font-size: clamp(20px, 2.2vw, 26px); font-weight: 600; letter-spacing: -.3px; color: var(--text); line-height: 1.1; }
.csc-sec-d { font-size: 13.5px; color: var(--muted); margin-top: 4px; line-height: 1.5; max-width: 720px; }

/* KPIs (cards de resumo) */
.csc-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; }
.csc-kpi { position: relative; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 16px 18px; display: flex; flex-direction: column; gap: 5px; box-shadow: var(--shadow-sm); overflow: hidden; animation: cscUp .5s cubic-bezier(.22,1,.36,1) both; }
.csc-kpi::before { content: ''; position: absolute; inset: 0 0 auto 0; height: 3px; background: linear-gradient(90deg, var(--accent), var(--violet)); opacity: .85; }
.csc-kpi-lbl { font-size: 10.5px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); }
.csc-kpi-val { font-family: var(--fm); font-size: clamp(24px, 2.6vw, 30px); font-weight: 600; color: var(--text); line-height: 1.05; letter-spacing: -.5px; font-variant-numeric: tabular-nums; }
.csc-kpi-sub { font-size: 11.5px; color: var(--muted); }

/* Robôs */
.csc-robos { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
.csc-robo { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; box-shadow: var(--shadow-sm); border-top: 3px solid var(--border); transition: box-shadow .2s, transform .14s, border-color .2s; animation: cscUp .5s cubic-bezier(.22,1,.36,1) both; }
.csc-robo:hover { box-shadow: var(--shadow-lg); transform: translateY(-3px); }
.csc-robo.st-ok { border-top-color: var(--green); }
.csc-robo.st-erro { border-top-color: var(--red); }
.csc-robo.st-parcial { border-top-color: var(--orange); }
.csc-robo-head { display: flex; align-items: flex-start; gap: 10px; }
.csc-robo-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--muted); flex-shrink: 0; margin-top: 5px; }
.csc-robo.st-ok .csc-robo-dot { background: var(--green); }
.csc-robo.st-erro .csc-robo-dot { background: var(--red); }
.csc-robo.st-parcial .csc-robo-dot { background: var(--orange); }
.csc-robo-nome { font-size: 15px; font-weight: 600; color: var(--text); line-height: 1.2; }
.csc-robo-faz { font-size: 12.5px; color: var(--muted); line-height: 1.45; margin-top: 3px; }
.csc-robo-corpo { display: flex; flex-direction: column; gap: 10px; }
.csc-robo-frase { font-size: 15px; color: var(--text); line-height: 1.35; }
.csc-robo-frase b { font-weight: 600; }
.csc-robo-detalhes { list-style: none; display: flex; flex-direction: column; gap: 5px; }
.csc-robo-detalhes li { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; font-size: 13px; }
.csc-di-lbl { color: var(--muted); }
.csc-di-val { color: var(--text); font-weight: 600; text-align: right; }
.csc-di-val.csc-zero, .csc-zero { color: var(--green); }
.csc-robo-vazio { font-size: 13px; color: var(--muted); font-style: italic; }
.csc-robo-foot { margin-top: auto; font-size: 11px; color: var(--muted); border-top: 1px solid var(--border); padding-top: 9px; }

/* Kanban */
.csc-kanban { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; align-items: start; }
.csc-col { background: var(--surface2); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; animation: cscUp .5s cubic-bezier(.22,1,.36,1) both; transition: border-color .2s; }
.csc-col-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 15px 4px; }
.csc-col-nome { font-family: var(--fs); font-size: 12.5px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; }
.csc-col-head.sit-em-andamento .csc-col-nome { color: var(--accent); }
.csc-col-head.sit-no-ar .csc-col-nome { color: var(--green); }
.csc-col-head.sit-pausado .csc-col-nome { color: var(--yellow); }
.csc-col-head.sit-planejado .csc-col-nome { color: var(--muted); }
.csc-col-cont { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1px 9px; font-size: 12px; font-weight: 600; color: var(--text); }
.csc-col-desc { font-size: 11.5px; color: var(--muted); padding: 0 15px 10px; border-bottom: 1px solid var(--border); }
.csc-col-body { padding: 11px; display: flex; flex-direction: column; gap: 10px; }
.csc-proj { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 11px 13px; display: flex; flex-direction: column; gap: 7px; }
.csc-proj-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.csc-proj-titulo { font-weight: 600; font-size: 13.5px; color: var(--text); }
.csc-proj-etapa { font-size: 10px; font-weight: 700; letter-spacing: .5px; color: var(--accent); background: var(--accent-light); border: 1px solid var(--accent-mid); border-radius: 5px; padding: 2px 7px; flex-shrink: 0; }
.csc-proj-desc { font-size: 12px; line-height: 1.45; color: var(--muted); }
.csc-bar { height: 6px; background: var(--surface2); border-radius: 4px; overflow: hidden; }
.csc-bar i { display: block; height: 100%; background: var(--accent); border-radius: 4px; transition: width .4s ease; }
.csc-proj-prog { font-size: 11px; color: var(--muted); }
.csc-col-vazio { text-align: center; color: var(--muted); font-size: 12.5px; padding: 8px 6px; line-height: 1.4; }

/* Kanban interativo */
.csc-sec-proj { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.csc-sec-d b { color: var(--text); font-weight: 600; }
.csc-add-btn { flex-shrink: 0; background: var(--accent); color: #fff; border: none; border-radius: var(--radius-sm); padding: 9px 16px; font-size: 13px; font-weight: 600; cursor: pointer; transition: filter .15s, transform .12s; }
.csc-add-btn:hover { filter: brightness(1.08); transform: translateY(-1px); }
.csc-col.is-over { outline: 2px dashed var(--accent-mid); outline-offset: -2px; }
.csc-col-acoes { display: flex; align-items: center; gap: 7px; }
.csc-col-add { width: 22px; height: 22px; border-radius: 5px; border: 1px solid var(--border); background: var(--surface); color: var(--muted); font-size: 16px; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: border-color .15s, color .15s; }
.csc-col-add:hover { border-color: var(--accent); color: var(--accent); }
.csc-proj { cursor: grab; position: relative; }
.csc-proj:active { cursor: grabbing; }
.csc-proj-tags { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
.csc-proj-manual { font-size: 9px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; color: var(--muted); background: var(--surface2); border: 1px solid var(--border); border-radius: 4px; padding: 2px 5px; }
.csc-proj-ferramentas { position: absolute; top: 8px; right: 8px; display: flex; gap: 4px; opacity: 0; transition: opacity .15s; }
.csc-proj:hover .csc-proj-ferramentas, .csc-proj:focus-within .csc-proj-ferramentas { opacity: 1; }
.csc-proj-ferramentas button { width: 24px; height: 24px; border-radius: 5px; border: 1px solid var(--border); background: var(--surface); color: var(--muted); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: border-color .15s, color .15s; }
.csc-proj-ferramentas button:hover { border-color: var(--accent); color: var(--accent); }
.csc-proj-ferramentas button:last-child:hover { border-color: var(--red); color: var(--red); }

/* Modal */
.csc-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px; backdrop-filter: blur(2px); }
.csc-modal { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 22px; width: min(440px, 100%); box-shadow: var(--shadow-lg); display: flex; flex-direction: column; gap: 13px; }
.csc-modal-t { font-family: var(--fd); font-size: 23px; font-weight: 600; color: var(--text); letter-spacing: -.3px; }
.csc-campo { display: flex; flex-direction: column; gap: 5px; }
.csc-campo span { font-size: 12px; font-weight: 600; color: var(--muted); }
.csc-campo input, .csc-campo textarea, .csc-campo select { font-family: inherit; font-size: 14px; color: var(--text); background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 9px 11px; outline: none; transition: border-color .15s; }
.csc-campo input:focus, .csc-campo textarea:focus, .csc-campo select:focus { border-color: var(--accent); }
.csc-campo textarea { resize: vertical; }
.csc-modal-foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }
.csc-btn-sec { background: none; border: 1px solid var(--border); color: var(--muted); border-radius: var(--radius-sm); padding: 9px 16px; font-size: 13px; font-weight: 500; cursor: pointer; }
.csc-btn-sec:hover { border-color: var(--muted); color: var(--text); }
.csc-btn-pri { background: var(--accent); color: #fff; border: none; border-radius: var(--radius-sm); padding: 9px 18px; font-size: 13px; font-weight: 600; cursor: pointer; }
.csc-btn-pri:hover { filter: brightness(1.08); }

/* Abas + extrato */
.csc-wrap { display: contents; }
.csc-tabs { display: flex; gap: 4px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 4px; width: fit-content; }
.csc-tabs button { border: none; background: none; color: var(--muted); font-family: inherit; font-size: 13.5px; font-weight: 600; padding: 8px 18px; border-radius: var(--radius-sm); cursor: pointer; transition: background .15s, color .15s; }
.csc-tabs button.on { background: var(--surface); color: var(--text); box-shadow: var(--shadow-sm); }
.csc-tabs button:not(.on):hover { color: var(--text); }
.csc-ex-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.csc-periodo { display: flex; gap: 4px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 4px; flex-shrink: 0; }
.csc-periodo button { border: none; background: none; color: var(--muted); font-family: inherit; font-size: 12.5px; font-weight: 600; padding: 6px 13px; border-radius: var(--radius-sm); cursor: pointer; transition: background .15s, color .15s; }
.csc-periodo button.on { background: var(--accent); color: #fff; }
.csc-periodo button:not(.on):hover { color: var(--text); }

/* Ranking por área */
.csc-ranking { display: flex; flex-direction: column; gap: 11px; }
.csc-rank { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 15px 18px; display: flex; flex-direction: column; gap: 8px; box-shadow: var(--shadow-sm); }
.csc-rank.topo { border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); box-shadow: 0 4px 20px color-mix(in srgb, var(--accent) 12%, transparent); }
.csc-rank-top { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.csc-rank-nome { font-size: 15px; color: var(--text); }
.csc-rank-nome b { color: var(--accent); font-weight: 700; margin-right: 6px; font-family: var(--fm); }
.csc-rank-val { font-family: var(--fm); font-size: 20px; font-weight: 600; color: var(--text); letter-spacing: -.5px; font-variant-numeric: tabular-nums; }
.csc-rank-bar { height: 9px; background: var(--surface2); border-radius: 6px; overflow: hidden; }
.csc-rank-bar i { display: block; height: 100%; background: var(--accent); border-radius: 6px; opacity: .55; transition: width .6s cubic-bezier(.22,1,.36,1); }
.csc-rank.topo .csc-rank-bar i { opacity: 1; background: linear-gradient(90deg, var(--accent), var(--violet)); box-shadow: 0 0 14px color-mix(in srgb, var(--violet) 45%, transparent); }
.csc-rank-sub { font-size: 11.5px; color: var(--muted); }

/* Extrato (tabela estilo banco) */
.csc-extrato { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm); }
.csc-ex-row { display: grid; grid-template-columns: 130px 160px 1fr 120px; align-items: center; gap: 12px; padding: 11px 18px; border-bottom: 1px solid var(--border); font-size: 13.5px; }
.csc-ex-row:last-child { border-bottom: none; }
.csc-ex-cab { background: var(--surface2); font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); }
.csc-ex-data { color: var(--muted); font-family: var(--fm); font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.csc-ex-area { font-weight: 600; color: var(--text); }
.csc-ex-oque { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.csc-ex-v { text-align: right; font-family: var(--fm); font-size: 15px; font-weight: 600; color: var(--text); letter-spacing: -.3px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.csc-ex-v.csc-zero { color: var(--green); }
.csc-ex-tot { background: var(--surface2); font-weight: 700; }
.csc-ex-tot span:nth-child(3) { font-size: 12px; letter-spacing: .5px; text-transform: uppercase; color: var(--muted); }
.csc-ex-tot .csc-ex-v { font-size: 18px; color: var(--text); }

/* Linha do tempo */
.csc-feed { position: relative; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 6px 6px 6px 4px; box-shadow: var(--shadow-sm); }
.csc-fi { display: flex; align-items: flex-start; gap: 14px; padding: 13px 16px; border-bottom: 1px solid var(--border); position: relative; }
.csc-fi:last-child { border-bottom: none; }
.csc-fi-dot { width: 11px; height: 11px; border-radius: 50%; background: var(--green); flex-shrink: 0; margin-top: 3px; box-shadow: 0 0 0 4px color-mix(in srgb, var(--green) 15%, transparent); }
.csc-fi.st-erro .csc-fi-dot { background: var(--red); box-shadow: 0 0 0 4px color-mix(in srgb, var(--red) 15%, transparent); }
.csc-fi.st-parcial .csc-fi-dot { background: var(--orange); }
.csc-fi-main { flex: 1; min-width: 0; }
.csc-fi-frase { font-size: 14px; color: var(--text); line-height: 1.4; }
.csc-fi-frase b { font-weight: 600; }
.csc-fi-det { font-size: 12.5px; color: var(--muted); margin-top: 2px; display: flex; gap: 6px; flex-wrap: wrap; }
.csc-fi-quando { font-size: 12px; color: var(--muted); white-space: nowrap; flex-shrink: 0; margin-top: 1px; }
.csc-fi-vazio { padding: 26px; text-align: center; color: var(--muted); font-size: 13.5px; }

/* Mobile: nada estoura a tela */
@media (max-width: 680px) {
  .csc-title { font-size: 15px; letter-spacing: 1px; }
  .csc-tb-right { gap: 8px; }
  .csc-clock { font-size: 14px; }
  .csc-upd { display: none; }
  .csc-hero { flex-direction: column; align-items: flex-start; }
  .csc-hero-gasto { text-align: left; padding-left: 16px; border-left-width: 3px; }
  .csc-robos { grid-template-columns: 1fr; }
  .csc-tabs, .csc-periodo { width: 100%; }
  .csc-tabs button, .csc-periodo button { flex: 1; text-align: center; }
  /* Extrato empilhado no celular */
  .csc-ex-cab { display: none; }
  .csc-ex-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 3px 10px; padding: 12px 14px; }
  .csc-ex-data { order: 1; flex-basis: 100%; font-size: 11px; }
  .csc-ex-area { order: 2; }
  .csc-ex-oque { order: 3; flex: 1 1 auto; white-space: normal; min-width: 0; }
  .csc-ex-v { order: 4; }
  .csc-ex-tot { flex-wrap: nowrap; justify-content: space-between; }
  .csc-ex-tot span:nth-child(1), .csc-ex-tot span:nth-child(2) { display: none; }
}
</style>
