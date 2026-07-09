<template>
  <div class="gc-rel">
    <!-- Filtros -->
    <div class="gc-rel-filtros">
      <label>Canal
        <select v-model="canal">
          <option value="0">Consolidado</option>
          <option v-for="c in CANAIS" :key="c.id" :value="c.id">{{ c.nome }}</option>
        </select>
      </label>
      <label>Período
        <select v-model="periodo">
          <option value="mes-atual">Mês atual</option>
          <option value="mes-passado">Mês passado</option>
          <option value="ano">Ano ({{ anoAtual }})</option>
          <option value="custom">Personalizado</option>
        </select>
      </label>
      <template v-if="periodo === 'custom'">
        <label>De <input type="month" v-model="mesIni"></label>
        <label>Até <input type="month" v-model="mesFim"></label>
      </template>
      <label v-if="!['categoria', 'menos', 'ruptura'].includes(relatorio)">Granularidade
        <select v-model="granularidade">
          <option value="sku">Por item (SKU)</option>
          <option value="categoria">Por categoria</option>
        </select>
      </label>
      <label v-if="['mais', 'menos'].includes(relatorio)">Ordenar por
        <select v-model="metricaMais">
          <option value="faturamento">Faturamento</option>
          <option value="unidades">Unidades</option>
        </select>
      </label>
      <div class="gc-rel-sel">
        <button v-for="r in RELATORIOS" :key="r.id" type="button"
                :class="{ on: relatorio === r.id }" @click="relatorio = r.id">{{ r.nome }}</button>
      </div>
    </div>

    <div v-if="carregando" class="gc-rel-msg">Carregando…</div>
    <div v-else-if="erro" class="gc-rel-msg erro">{{ erro }}</div>
    <div v-else-if="semDados" class="gc-rel-msg">Sem dados para o período/canal selecionado.</div>

    <template v-else>
      <div class="gc-rel-head">
        <span class="gc-rel-tot">{{ linhas.length }} {{ granularidade === 'sku' ? 'itens' : 'categorias' }}</span>
        <span class="gc-rel-tot">Faturamento: <b>{{ fmtR(totalFat) }}</b></span>
        <button v-if="podeExportar" type="button" class="gc-rel-exp" @click="exportar">↓ Exportar</button>
      </div>

      <!-- Curva ABC -->
      <div v-if="relatorio === 'abc'" class="gc-rel-tbwrap">
        <table class="gc-rel-tb">
          <thead><tr>
            <th>Classe</th><th class="l">{{ rotuloChave }}</th>
            <th class="l" v-if="granularidade === 'sku'">Categoria</th>
            <th>Unid.</th><th>Faturamento</th><th>%</th><th>% acum.</th>
          </tr></thead>
          <tbody>
            <tr v-for="l in abc" :key="l.chave">
              <td><span class="gc-badge" :class="'abc-' + l.classe">{{ l.classe }}</span></td>
              <td class="l">{{ l.produto }}</td>
              <td class="l" v-if="granularidade === 'sku'">{{ l.categoria }}</td>
              <td class="n">{{ l.unidades }}</td>
              <td class="n">{{ fmtR(l.faturamento) }}</td>
              <td class="n">{{ fmtPct(l.pct) }}</td>
              <td class="n">{{ fmtPct(l.pctAcum) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Matriz BCG -->
      <div v-else-if="relatorio === 'bcg'" class="gc-rel-bcg">
        <div class="gc-bcg-scatter">
          <svg :viewBox="`0 0 ${SW} ${SH}`" preserveAspectRatio="xMidYMid meet">
            <line :x1="sx(medPart)" y1="0" :x2="sx(medPart)" :y2="SH" class="gc-bcg-med" />
            <line x1="0" :y1="sy(medCresc)" :x2="SW" :y2="sy(medCresc)" class="gc-bcg-med" />
            <text :x="SW - 4" :y="sy(medCresc) - 5" class="gc-bcg-axl r">participação →</text>
            <text x="4" y="12" class="gc-bcg-axl">↑ crescimento</text>
            <circle v-for="(p, i) in bcgPontos" :key="i" :cx="p.x" :cy="p.y" r="5" :class="'q-' + p.q" opacity="0.82">
              <title>{{ p.nome }} — {{ p.quadrante }} · Participação {{ fmtPct(p.participacao) }} · Crescimento {{ fmtPct(p.crescimento) }}</title>
            </circle>
          </svg>
          <div class="gc-bcg-leg">
            <span v-for="q in QUADRANTES" :key="q.id"><i :class="'q-' + q.id"></i>{{ q.nome }} ({{ contagem[q.id] || 0 }})</span>
          </div>
        </div>
        <div class="gc-rel-tbwrap">
          <table class="gc-rel-tb">
            <thead><tr>
              <th>Quadrante</th><th class="l">{{ rotuloChave }}</th>
              <th>Faturamento</th><th>Participação</th><th>Crescimento</th>
            </tr></thead>
            <tbody>
              <tr v-for="l in bcg" :key="l.chave">
                <td><span class="gc-badge" :class="'q-' + quadKey(l.quadrante)">{{ l.quadrante }}</span></td>
                <td class="l">{{ l.produto }}</td>
                <td class="n">{{ fmtR(l.faturamento) }}</td>
                <td class="n">{{ fmtPct(l.participacao) }}</td>
                <td class="n" :class="l.crescimento < 0 ? 'neg' : 'pos'">{{ l.crescimento >= 0 ? '+' : '' }}{{ fmtPct(l.crescimento) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Mais vendidos -->
      <div v-else-if="relatorio === 'mais'" class="gc-rel-tbwrap">
        <table class="gc-rel-tb">
          <thead><tr>
            <th>#</th><th class="l">{{ rotuloChave }}</th><th class="l" v-if="granularidade === 'sku'">Categoria</th>
            <th>Unid.</th><th>Faturamento</th>
          </tr></thead>
          <tbody>
            <tr v-for="(l, i) in mais" :key="l.chave">
              <td class="n">{{ i + 1 }}</td>
              <td class="l">{{ l.produto }}</td>
              <td class="l" v-if="granularidade === 'sku'">{{ l.categoria }}</td>
              <td class="n">{{ l.unidades }}</td>
              <td class="n">{{ fmtR(l.faturamento) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Menos vendidos / encalhados -->
      <div v-else-if="relatorio === 'menos'" class="gc-rel-tbwrap">
        <table class="gc-rel-tb">
          <thead><tr>
            <th class="l">Item</th><th class="l">Categoria</th><th>Unid. vendidas</th>
            <th>Faturamento</th><th>Estoque</th><th>Situação</th>
          </tr></thead>
          <tbody>
            <tr v-for="l in menos" :key="l.chave">
              <td class="l">{{ l.produto }}</td>
              <td class="l">{{ l.categoria }}</td>
              <td class="n">{{ l.unidades }}</td>
              <td class="n">{{ fmtR(l.faturamento) }}</td>
              <td class="n">{{ l.saldo }}</td>
              <td><span v-if="l.unidades === 0 && l.saldo > 0" class="gc-badge alerta">Encalhado</span><span v-else class="gc-mut">—</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Faturamento por categoria × canal -->
      <div v-else-if="relatorio === 'categoria'" class="gc-rel-tbwrap">
        <table class="gc-rel-tb">
          <thead><tr>
            <th class="l">Categoria</th><th v-for="c in CANAIS" :key="c.id">{{ c.nome }}</th><th>Total</th>
          </tr></thead>
          <tbody>
            <tr v-for="row in pivot" :key="row.categoria">
              <td class="l">{{ row.categoria }}</td>
              <td class="n" v-for="c in CANAIS" :key="c.id">{{ fmtR(row.por[c.id] || 0) }}</td>
              <td class="n"><b>{{ fmtR(row.total) }}</b></td>
            </tr>
            <tr class="gc-rel-totrow">
              <td class="l"><b>Total</b></td>
              <td class="n" v-for="c in CANAIS" :key="c.id"><b>{{ fmtR(pivotTotais.por[c.id] || 0) }}</b></td>
              <td class="n"><b>{{ fmtR(pivotTotais.total) }}</b></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Ruptura / cobertura -->
      <div v-else-if="relatorio === 'ruptura'" class="gc-rel-tbwrap">
        <p class="gc-rel-nota">Itens que vendem (≥ {{ MIN_VENDENDO }} un. no período) com cobertura projetada baixa. Dias de cobertura = estoque ÷ (unidades ÷ {{ diasDecorridos }} dias).</p>
        <table class="gc-rel-tb">
          <thead><tr>
            <th class="l">Item</th><th class="l">Categoria</th><th>Unid.</th><th>Estoque</th>
            <th>Un./dia</th><th>Dias cobertura</th><th>Alerta</th>
          </tr></thead>
          <tbody>
            <tr v-for="l in ruptura" :key="l.chave">
              <td class="l">{{ l.produto }}</td>
              <td class="l">{{ l.categoria }}</td>
              <td class="n">{{ l.unidades }}</td>
              <td class="n">{{ l.saldo }}</td>
              <td class="n">{{ l.porDia.toFixed(2) }}</td>
              <td class="n">{{ l.diasCobertura === Infinity ? '∞' : Math.round(l.diasCobertura) }}</td>
              <td><span v-if="l.alerta" class="gc-badge alerta">Repor</span><span v-else class="gc-mut">ok</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { sbClient } from '../../compartilhado/conectar-no-banco-de-dados.js'
import { hasPermission } from '../../compartilhado/controle-de-login-e-usuario.js'

const CANAIS = [
  { id: '205834140', nome: 'Tivoli' },
  { id: '205657609', nome: 'Dom Pedro' },
  { id: '205451611', nome: 'Atacado' },
]
// canal (loja.id das vendas) → depósito (gc_estoque_item)
const DEPS_POR_CANAL = { '205834140': '14888726315', '205657609': '14888617206', '205451611': '14888248253' }
const RELATORIOS = [
  { id: 'abc', nome: 'Curva ABC' },
  { id: 'bcg', nome: 'Matriz BCG' },
  { id: 'mais', nome: 'Mais vendidos' },
  { id: 'menos', nome: 'Encalhados' },
  { id: 'categoria', nome: 'Categoria × canal' },
  { id: 'ruptura', nome: 'Ruptura' },
]
const QUADRANTES = [
  { id: 'estrela', nome: 'Estrela' }, { id: 'vaca', nome: 'Vaca leiteira' },
  { id: 'interrogacao', nome: 'Interrogação' }, { id: 'abacaxi', nome: 'Abacaxi' },
]
const MIN_VENDENDO = 2

const canal = ref('0')
const periodo = ref('mes-atual')
const granularidade = ref('sku')
const relatorio = ref('abc')
const metricaMais = ref('faturamento')
const mesIni = ref('')
const mesFim = ref('')
const carregando = ref(false)
const erro = ref('')
const rowsAtuais = ref([])      // linhas de gc_vendas_item do período (TODOS os canais)
const rowsAnteriores = ref([])  // idem, período anterior (p/ crescimento do BCG)
const estoqueRaw = ref([])      // gc_estoque_item (todos os depósitos)

const anoAtual = new Date().getUTCFullYear()
const podeExportar = computed(() => hasPermission('gestor.relatorios', 'exportar'))
const rotuloChave = computed(() => granularidade.value === 'sku' ? 'Item' : 'Categoria')

// ── Helpers de mês (YYYY-MM) ──
function ymDe(d) { return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') }
function addMeses(ym, delta) { const [y, m] = ym.split('-').map(Number); return ymDe(new Date(Date.UTC(y, m - 1 + delta, 1))) }
function rangeYM(ini, fim) { const out = []; let cur = ini; for (let g = 0; g < 240 && cur <= fim; g++) { out.push(cur); cur = addMeses(cur, 1) } return out }
const primeiroDia = (ym) => ym + '-01'

function janelas() {
  const hoje = ymDe(new Date())
  let atuais
  if (periodo.value === 'mes-atual') atuais = [hoje]
  else if (periodo.value === 'mes-passado') atuais = [addMeses(hoje, -1)]
  else if (periodo.value === 'ano') atuais = rangeYM(anoAtual + '-01', hoje)
  else {
    if (!mesIni.value || !mesFim.value) return null
    const [a, b] = mesIni.value <= mesFim.value ? [mesIni.value, mesFim.value] : [mesFim.value, mesIni.value]
    atuais = rangeYM(a, b)
  }
  const L = atuais.length
  const anteriores = rangeYM(addMeses(atuais[0], -L), addMeses(atuais[0], -1))
  return { atuais, anteriores }
}

// ── Carga ──
async function carregar() {
  const j = janelas()
  if (!j) { rowsAtuais.value = []; rowsAnteriores.value = []; return }
  carregando.value = true; erro.value = ''
  try {
    const setAtual = new Set(j.atuais.map(primeiroDia))
    const meses = [...j.atuais, ...j.anteriores].map(primeiroDia)
    const rows = await fetchVendas(meses)
    rowsAtuais.value = rows.filter(r => setAtual.has(r.mes))
    rowsAnteriores.value = rows.filter(r => !setAtual.has(r.mes))
    estoqueRaw.value = await fetchEstoque()
  } catch (e) {
    erro.value = 'Falha ao carregar: ' + (e?.message || e)
    rowsAtuais.value = []; rowsAnteriores.value = []; estoqueRaw.value = []
  } finally {
    carregando.value = false
  }
}

// Paginação (PostgREST corta em 1000 por página). Busca TODOS os canais.
async function fetchVendas(meses) {
  const size = 1000, rows = []
  for (let from = 0; ; from += size) {
    const { data, error } = await sbClient.from('gc_vendas_item')
      .select('mes,canal_loja_id,sku,produto,categoria,unidades,faturamento')
      .in('mes', meses).range(from, from + size - 1)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < size) break
  }
  return rows
}
async function fetchEstoque() {
  const size = 1000, rows = []
  for (let from = 0; ; from += size) {
    const { data, error } = await sbClient.from('gc_estoque_item')
      .select('deposito_id,sku,produto,categoria,saldo').range(from, from + size - 1)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < size) break
  }
  return rows
}

// Linhas do período, filtradas pelo canal selecionado (consolidado = todos)
const rowsAtuaisCanal = computed(() => canal.value === '0' ? rowsAtuais.value : rowsAtuais.value.filter(r => String(r.canal_loja_id) === canal.value))
const rowsAnterioresCanal = computed(() => canal.value === '0' ? rowsAnteriores.value : rowsAnteriores.value.filter(r => String(r.canal_loja_id) === canal.value))

function agregar(rows, gran) {
  const m = new Map()
  for (const r of rows) {
    const chave = gran === 'sku' ? r.sku : (r.categoria || 'Outros')
    let o = m.get(chave)
    if (!o) { o = { chave, produto: gran === 'sku' ? (r.produto || r.sku) : chave, categoria: r.categoria || 'Outros', unidades: 0, faturamento: 0 }; m.set(chave, o) }
    o.unidades += Number(r.unidades) || 0
    o.faturamento += Number(r.faturamento) || 0
  }
  return m
}

const linhas = computed(() => {
  const cur = agregar(rowsAtuaisCanal.value, granularidade.value)
  const ant = agregar(rowsAnterioresCanal.value, granularidade.value)
  return [...cur.values()].map(o => ({ ...o, fatAnterior: ant.get(o.chave)?.faturamento || 0 }))
})
const linhasSku = computed(() => [...agregar(rowsAtuaisCanal.value, 'sku').values()])
const totalFat = computed(() => linhas.value.reduce((s, l) => s + l.faturamento, 0))
const semDados = computed(() => {
  if (relatorio.value === 'categoria') return !pivot.value.length
  if (relatorio.value === 'menos' || relatorio.value === 'ruptura') return !linhas.value.length && !estoquePorSku.value.size
  return !linhas.value.length
})

// Estoque por sku (somado nos depósitos do canal selecionado)
const estoquePorSku = computed(() => {
  const m = new Map()
  const depAllow = canal.value === '0' ? null : DEPS_POR_CANAL[canal.value]
  for (const r of estoqueRaw.value) {
    if (depAllow && String(r.deposito_id) !== depAllow) continue
    const o = m.get(r.sku) || { sku: r.sku, produto: r.produto, categoria: r.categoria || 'Outros', saldo: 0 }
    o.saldo += Number(r.saldo) || 0
    m.set(r.sku, o)
  }
  return m
})

// ── Curva ABC ──
function curvaABC(linhas) {
  const ord = [...linhas].sort((a, b) => b.faturamento - a.faturamento)
  const total = ord.reduce((s, l) => s + l.faturamento, 0) || 1
  let acum = 0
  return ord.map(l => { acum += l.faturamento; const p = acum / total; return { ...l, pct: l.faturamento / total, pctAcum: p, classe: p <= 0.8 ? 'A' : p <= 0.95 ? 'B' : 'C' } })
}
const abc = computed(() => curvaABC(linhas.value))

// ── Matriz BCG ──
function mediana(arr) { const s = [...arr].sort((a, b) => a - b); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0 }
function matrizBCG(linhas) {
  const total = linhas.reduce((s, l) => s + l.faturamento, 0) || 1
  const itens = linhas.map(l => ({ ...l, participacao: l.faturamento / total, crescimento: l.fatAnterior > 0 ? (l.faturamento - l.fatAnterior) / l.fatAnterior : (l.faturamento > 0 ? 1 : 0) }))
  const mp = mediana(itens.map(i => i.participacao)), mc = mediana(itens.map(i => i.crescimento))
  const q = itens.map(i => ({ ...i, quadrante: i.participacao >= mp && i.crescimento >= mc ? 'Estrela' : i.participacao >= mp && i.crescimento < mc ? 'Vaca leiteira' : i.participacao < mp && i.crescimento >= mc ? 'Interrogação' : 'Abacaxi' }))
  return { itens: q, medPart: mp, medCresc: mc }
}
const bcgAll = computed(() => matrizBCG(linhas.value))
const bcg = computed(() => [...bcgAll.value.itens].sort((a, b) => b.faturamento - a.faturamento))
const medPart = computed(() => bcgAll.value.medPart)
const medCresc = computed(() => bcgAll.value.medCresc)
const contagem = computed(() => { const c = {}; for (const i of bcgAll.value.itens) c[quadKey(i.quadrante)] = (c[quadKey(i.quadrante)] || 0) + 1; return c })
function quadKey(q) { return q === 'Estrela' ? 'estrela' : q === 'Vaca leiteira' ? 'vaca' : q === 'Interrogação' ? 'interrogacao' : 'abacaxi' }

// ── Mais vendidos ──
const mais = computed(() => [...linhas.value].sort((a, b) => b[metricaMais.value] - a[metricaMais.value]))

// ── Menos vendidos / encalhados ──
const menos = computed(() => {
  const vendidos = new Set(linhasSku.value.map(l => l.chave))
  const out = linhasSku.value.map(l => ({ ...l, saldo: estoquePorSku.value.get(l.chave)?.saldo || 0 }))
  for (const [sku, est] of estoquePorSku.value) {
    if (!vendidos.has(sku) && est.saldo > 0) out.push({ chave: sku, produto: est.produto || sku, categoria: est.categoria || 'Outros', unidades: 0, faturamento: 0, saldo: est.saldo })
  }
  return out.sort((a, b) => (a.faturamento - b.faturamento) || (b.saldo - a.saldo))
})

// ── Faturamento por categoria × canal ──
const pivot = computed(() => {
  const cats = new Map()
  for (const r of rowsAtuais.value) {
    const cat = r.categoria || 'Outros', canalId = String(r.canal_loja_id)
    const row = cats.get(cat) || { categoria: cat, por: {}, total: 0 }
    row.por[canalId] = (row.por[canalId] || 0) + (Number(r.faturamento) || 0)
    row.total += Number(r.faturamento) || 0
    cats.set(cat, row)
  }
  return [...cats.values()].sort((a, b) => b.total - a.total)
})
const pivotTotais = computed(() => {
  const t = { por: {}, total: 0 }
  for (const row of pivot.value) { t.total += row.total; for (const c of CANAIS) t.por[c.id] = (t.por[c.id] || 0) + (row.por[c.id] || 0) }
  return t
})

// ── Ruptura / cobertura ──
const diasDecorridos = computed(() => {
  const j = janelas(); if (!j) return 1
  const hoje = new Date(), hojeYM = ymDe(hoje)
  let d = 0
  for (const ym of j.atuais) {
    const [y, m] = ym.split('-').map(Number)
    d += ym === hojeYM ? hoje.getUTCDate() : new Date(Date.UTC(y, m, 0)).getUTCDate()
  }
  return Math.max(1, d)
})
const ruptura = computed(() => {
  const dias = diasDecorridos.value
  return linhasSku.value
    .filter(l => l.unidades >= MIN_VENDENDO)
    .map(l => {
      const saldo = estoquePorSku.value.get(l.chave)?.saldo || 0
      const porDia = l.unidades / dias
      const diasCobertura = porDia > 0 ? saldo / porDia : Infinity
      return { ...l, saldo, porDia, diasCobertura, alerta: diasCobertura <= 20 }
    })
    .sort((a, b) => a.diasCobertura - b.diasCobertura)
})

// ── Scatter BCG ──
const SW = 640, SH = 300, PAD = 24
const maxPart = computed(() => Math.max(0.0001, ...bcgAll.value.itens.map(i => i.participacao)))
const crescMin = computed(() => Math.min(-0.2, ...bcgAll.value.itens.map(i => i.crescimento)))
const crescMax = computed(() => Math.max(0.5, ...bcgAll.value.itens.map(i => i.crescimento)))
function sx(part) { return PAD + (part / maxPart.value) * (SW - 2 * PAD) }
function sy(cresc) { const t = (cresc - crescMin.value) / (crescMax.value - crescMin.value || 1); return SH - PAD - t * (SH - 2 * PAD) }
const bcgPontos = computed(() => bcgAll.value.itens.map(i => ({ x: sx(i.participacao), y: sy(i.crescimento), q: quadKey(i.quadrante), nome: i.produto, quadrante: i.quadrante, participacao: i.participacao, crescimento: i.crescimento })))

// ── Formatação ──
const fmtR = v => 'R$ ' + Math.round(Number(v) || 0).toLocaleString('pt-BR')
const fmtPct = v => ((Number(v) || 0) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'

// ── Export (XLSX se disponível, senão CSV) ──
function tabelaAtiva() {
  const nomeCanal = canal.value === '0' ? 'consolidado' : (CANAIS.find(c => c.id === canal.value)?.nome || canal.value)
  const base = `relatorio-${relatorio.value}-${nomeCanal}-${periodo.value}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-')
  if (relatorio.value === 'abc') return { nome: base, head: ['Classe', rotuloChave.value, 'Categoria', 'Unidades', 'Faturamento', '%', '% acum.'], rows: abc.value.map(l => [l.classe, l.produto, l.categoria, l.unidades, l.faturamento, l.pct, l.pctAcum]) }
  if (relatorio.value === 'bcg') return { nome: base, head: ['Quadrante', rotuloChave.value, 'Faturamento', 'Participação', 'Crescimento'], rows: bcg.value.map(l => [l.quadrante, l.produto, l.faturamento, l.participacao, l.crescimento]) }
  if (relatorio.value === 'mais') return { nome: base, head: ['#', rotuloChave.value, 'Categoria', 'Unidades', 'Faturamento'], rows: mais.value.map((l, i) => [i + 1, l.produto, l.categoria, l.unidades, l.faturamento]) }
  if (relatorio.value === 'menos') return { nome: base, head: ['Item', 'Categoria', 'Unidades', 'Faturamento', 'Estoque', 'Situação'], rows: menos.value.map(l => [l.produto, l.categoria, l.unidades, l.faturamento, l.saldo, l.unidades === 0 && l.saldo > 0 ? 'Encalhado' : '']) }
  if (relatorio.value === 'categoria') return { nome: base, head: ['Categoria', ...CANAIS.map(c => c.nome), 'Total'], rows: [...pivot.value.map(r => [r.categoria, ...CANAIS.map(c => r.por[c.id] || 0), r.total]), ['Total', ...CANAIS.map(c => pivotTotais.value.por[c.id] || 0), pivotTotais.value.total]] }
  if (relatorio.value === 'ruptura') return { nome: base, head: ['Item', 'Categoria', 'Unidades', 'Estoque', 'Un./dia', 'Dias cobertura', 'Alerta'], rows: ruptura.value.map(l => [l.produto, l.categoria, l.unidades, l.saldo, Number(l.porDia.toFixed(2)), l.diasCobertura === Infinity ? '' : Math.round(l.diasCobertura), l.alerta ? 'Repor' : '']) }
  return { nome: base, head: [], rows: [] }
}
function exportar() {
  const { head, rows, nome } = tabelaAtiva()
  if (window.XLSX) {
    const ws = window.XLSX.utils.aoa_to_sheet([head, ...rows])
    const wb = window.XLSX.utils.book_new()
    window.XLSX.utils.book_append_sheet(wb, ws, 'Relatório')
    window.XLSX.writeFile(wb, nome + '.xlsx')
  } else {
    const csv = [head, ...rows].map(r => r.map(c => { const s = String(c ?? ''); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }).join(';')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    a.download = nome + '.csv'; a.click(); URL.revokeObjectURL(a.href)
  }
}

watch([canal, periodo, granularidade, mesIni, mesFim], carregar)
onMounted(() => {
  const hoje = ymDe(new Date())
  mesFim.value = hoje; mesIni.value = addMeses(hoje, -2)
  carregar()
})
</script>

<style scoped>
.gc-rel{max-width:min(98vw,1860px);margin:0 auto;width:100%;padding:clamp(18px,1.8vw,30px) clamp(20px,2.8vw,46px) 96px;font-family:'IBM Plex Sans',sans-serif;}
.gc-rel-filtros{display:flex;flex-wrap:wrap;align-items:flex-end;gap:14px;margin-bottom:22px;}
.gc-rel-filtros label{display:flex;flex-direction:column;gap:4px;font-size:calc(10px*var(--gc-fs,1));text-transform:uppercase;letter-spacing:1px;color:var(--muted);}
.gc-rel-filtros select,.gc-rel-filtros input{font-family:inherit;font-size:calc(13px*var(--gc-fs,1));color:var(--text);border:1px solid var(--border);border-radius:8px;padding:7px 10px;background:var(--surface);cursor:pointer;}
.gc-rel-sel{display:flex;gap:4px;margin-left:auto;flex-wrap:wrap;}
.gc-rel-sel button{appearance:none;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 14px;font-family:'Oswald',sans-serif;font-size:calc(12px*var(--gc-fs,1));letter-spacing:.8px;text-transform:uppercase;color:var(--muted);cursor:pointer;transition:all .15s ease;}
.gc-rel-sel button:hover{color:var(--text);border-color:var(--accent-mid);}
.gc-rel-sel button.on{background:var(--accent);border-color:var(--accent);color:#fff;}
.gc-rel-msg{padding:56px 0;text-align:center;color:var(--muted);font-size:calc(14px*var(--gc-fs,1));}
.gc-rel-msg.erro{color:var(--red);}
.gc-rel-head{display:flex;align-items:center;gap:24px;flex-wrap:wrap;margin-bottom:14px;font-size:calc(13px*var(--gc-fs,1));color:var(--muted);}
.gc-rel-head b{color:var(--text);font-variant-numeric:tabular-nums;}
.gc-rel-exp{margin-left:auto;appearance:none;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:7px 14px;font-family:'Oswald',sans-serif;font-size:calc(12px*var(--gc-fs,1));letter-spacing:.8px;text-transform:uppercase;color:var(--text);cursor:pointer;}
.gc-rel-exp:hover{border-color:var(--accent);color:var(--accent);}
.gc-rel-nota{font-size:calc(12px*var(--gc-fs,1));color:var(--muted);margin:0 0 12px;line-height:1.5;}
.gc-rel-tbwrap{overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius-xl);background:var(--surface);}
.gc-rel-tb{width:100%;border-collapse:collapse;font-size:calc(13px*var(--gc-fs,1));}
.gc-rel-tb th,.gc-rel-tb td{padding:9px 14px;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;}
.gc-rel-tb th.l,.gc-rel-tb td.l{text-align:left;white-space:normal;}
.gc-rel-tb thead th{position:sticky;top:0;background:var(--surface2);color:var(--muted);font-family:'Oswald',sans-serif;font-weight:500;font-size:calc(11px*var(--gc-fs,1));text-transform:uppercase;letter-spacing:.8px;border-bottom:1px solid var(--border);}
.gc-rel-tb tbody tr:nth-child(even){background:var(--surface2);}
.gc-rel-tb tbody tr:hover{background:var(--accent-light);}
.gc-rel-tb tr.gc-rel-totrow{background:var(--surface2);border-top:2px solid var(--border);}
.gc-rel-tb td.n{color:var(--text);}
.gc-rel-tb td.pos{color:var(--green);}
.gc-rel-tb td.neg{color:var(--red);}
.gc-mut{color:var(--muted);}
.gc-badge{display:inline-block;min-width:22px;padding:2px 9px;border-radius:20px;font-size:calc(10px*var(--gc-fs,1));font-weight:700;letter-spacing:.5px;color:#fff;}
.gc-badge.abc-A{background:#16a34a;}
.gc-badge.abc-B{background:#d97706;}
.gc-badge.abc-C{background:#64748b;}
.gc-badge.q-estrela{background:#f59e0b;}
.gc-badge.q-vaca{background:#2563eb;}
.gc-badge.q-interrogacao{background:#7c3aed;}
.gc-badge.q-abacaxi{background:#e11d48;}
.gc-badge.alerta{background:#e11d48;}
.gc-bcg-scatter{margin-bottom:18px;border:1px solid var(--border);border-radius:var(--radius-xl);background:var(--surface);padding:14px;}
.gc-bcg-scatter svg{width:100%;height:auto;display:block;}
.gc-bcg-med{stroke:var(--border);stroke-width:1;stroke-dasharray:4 4;}
.gc-bcg-axl{fill:var(--muted);font-size:10px;font-family:'IBM Plex Sans',sans-serif;}
.gc-bcg-axl.r{text-anchor:end;}
.gc-bcg-scatter circle.q-estrela{fill:#f59e0b;}
.gc-bcg-scatter circle.q-vaca{fill:#2563eb;}
.gc-bcg-scatter circle.q-interrogacao{fill:#7c3aed;}
.gc-bcg-scatter circle.q-abacaxi{fill:#e11d48;}
.gc-bcg-leg{display:flex;flex-wrap:wrap;gap:16px;margin-top:10px;font-size:calc(12px*var(--gc-fs,1));color:var(--muted);}
.gc-bcg-leg span{display:inline-flex;align-items:center;gap:6px;}
.gc-bcg-leg i{width:11px;height:11px;border-radius:50%;display:inline-block;}
.gc-bcg-leg i.q-estrela{background:#f59e0b;}
.gc-bcg-leg i.q-vaca{background:#2563eb;}
.gc-bcg-leg i.q-interrogacao{background:#7c3aed;}
.gc-bcg-leg i.q-abacaxi{background:#e11d48;}
@media (max-width:640px){
  .gc-rel-filtros{gap:10px;}
  .gc-rel-sel{margin-left:0;width:100%;}
  .gc-rel-tb th,.gc-rel-tb td{padding:7px 9px;font-size:calc(12px*var(--gc-fs,1));}
}
</style>
