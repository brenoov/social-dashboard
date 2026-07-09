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
      <label>Granularidade
        <select v-model="granularidade">
          <option value="sku">Por item (SKU)</option>
          <option value="categoria">Por categoria</option>
        </select>
      </label>
      <div class="gc-rel-sel">
        <button v-for="r in RELATORIOS" :key="r.id" type="button"
                :class="{ on: relatorio === r.id }" @click="relatorio = r.id">{{ r.nome }}</button>
      </div>
    </div>

    <div v-if="carregando" class="gc-rel-msg">Carregando…</div>
    <div v-else-if="erro" class="gc-rel-msg erro">{{ erro }}</div>
    <div v-else-if="!linhas.length" class="gc-rel-msg">Sem dados para o período/canal selecionado.</div>

    <template v-else>
      <div class="gc-rel-head">
        <span class="gc-rel-tot">{{ linhas.length }} {{ granularidade === 'sku' ? 'itens' : 'categorias' }}</span>
        <span class="gc-rel-tot">Faturamento: <b>{{ fmtR(totalFat) }}</b></span>
      </div>

      <!-- Curva ABC -->
      <div v-if="relatorio === 'abc'" class="gc-rel-tbwrap">
        <table class="gc-rel-tb">
          <thead><tr>
            <th>Classe</th><th class="l">{{ granularidade === 'sku' ? 'Item' : 'Categoria' }}</th>
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
            <!-- eixos medianos -->
            <line :x1="sx(medPart)" y1="0" :x2="sx(medPart)" :y2="SH" class="gc-bcg-med" />
            <line x1="0" :y1="sy(medCresc)" :x2="SW" :y2="sy(medCresc)" class="gc-bcg-med" />
            <text :x="SW - 4" :y="sy(medCresc) - 5" class="gc-bcg-axl r">participação →</text>
            <text x="4" y="12" class="gc-bcg-axl">↑ crescimento</text>
            <circle v-for="(p, i) in bcgPontos" :key="i" :cx="p.x" :cy="p.y" r="5"
                    :class="'q-' + p.q" :opacity="0.82">
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
              <th>Quadrante</th><th class="l">{{ granularidade === 'sku' ? 'Item' : 'Categoria' }}</th>
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
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { sbClient } from '../../compartilhado/conectar-no-banco-de-dados.js'

const CANAIS = [
  { id: '205834140', nome: 'Tivoli' },
  { id: '205657609', nome: 'Dom Pedro' },
  { id: '205451611', nome: 'Atacado' },
]
const RELATORIOS = [
  { id: 'abc', nome: 'Curva ABC' },
  { id: 'bcg', nome: 'Matriz BCG' },
]
const QUADRANTES = [
  { id: 'estrela', nome: 'Estrela' },
  { id: 'vaca', nome: 'Vaca leiteira' },
  { id: 'interrogacao', nome: 'Interrogação' },
  { id: 'abacaxi', nome: 'Abacaxi' },
]

const canal = ref('0')
const periodo = ref('mes-atual')
const granularidade = ref('sku')
const relatorio = ref('abc')
const mesIni = ref('')
const mesFim = ref('')
const carregando = ref(false)
const erro = ref('')
const linhasRaw = ref([])   // agregado { chave, produto, categoria, unidades, faturamento, fatAnterior }

const anoAtual = new Date().getUTCFullYear()

// ── Helpers de mês (YYYY-MM) ──
function ymDe(d) { return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') }
function addMeses(ym, delta) { const [y, m] = ym.split('-').map(Number); return ymDe(new Date(Date.UTC(y, m - 1 + delta, 1))) }
function rangeYM(ini, fim) { const out = []; let cur = ini; for (let g = 0; g < 240 && cur <= fim; g++) { out.push(cur); cur = addMeses(cur, 1) } return out }
const primeiroDia = (ym) => ym + '-01'

// Meses do período atual + o bloco anterior de mesmo tamanho (p/ crescimento do BCG)
function janelas() {
  const hoje = ymDe(new Date())
  let atuais
  if (periodo.value === 'mes-atual') atuais = [hoje]
  else if (periodo.value === 'mes-passado') atuais = [addMeses(hoje, -1)]
  else if (periodo.value === 'ano') atuais = rangeYM(anoAtual + '-01', hoje)
  else { // custom
    if (!mesIni.value || !mesFim.value) return null
    const [a, b] = mesIni.value <= mesFim.value ? [mesIni.value, mesFim.value] : [mesFim.value, mesIni.value]
    atuais = rangeYM(a, b)
  }
  const L = atuais.length
  const anteriores = rangeYM(addMeses(atuais[0], -L), addMeses(atuais[0], -1))
  return { atuais, anteriores }
}

// ── Carga: lê gc_vendas_item dos meses da janela, agrega por sku/categoria ──
async function carregar() {
  const j = janelas()
  if (!j) { linhasRaw.value = []; return }
  carregando.value = true; erro.value = ''
  try {
    const meses = [...j.atuais, ...j.anteriores].map(primeiroDia)
    const setAtual = new Set(j.atuais.map(primeiroDia))
    const rows = await fetchVendas(meses, canal.value)
    const gran = granularidade.value
    const cur = new Map(), ant = new Map()
    for (const r of rows) {
      const chave = gran === 'sku' ? r.sku : (r.categoria || 'Outros')
      const bucket = setAtual.has(r.mes) ? cur : ant
      let o = bucket.get(chave)
      if (!o) { o = { chave, produto: gran === 'sku' ? (r.produto || r.sku) : chave, categoria: r.categoria || 'Outros', unidades: 0, faturamento: 0 }; bucket.set(chave, o) }
      o.unidades += Number(r.unidades) || 0
      o.faturamento += Number(r.faturamento) || 0
    }
    linhasRaw.value = [...cur.values()].map(o => ({ ...o, fatAnterior: ant.get(o.chave)?.faturamento || 0 }))
  } catch (e) {
    erro.value = 'Falha ao carregar: ' + (e?.message || e)
    linhasRaw.value = []
  } finally {
    carregando.value = false
  }
}

// Paginação (PostgREST corta em 1000 por página)
async function fetchVendas(meses, canalId) {
  const size = 1000, rows = []
  for (let from = 0; ; from += size) {
    let q = sbClient.from('gc_vendas_item')
      .select('mes,canal_loja_id,sku,produto,categoria,unidades,faturamento')
      .in('mes', meses).range(from, from + size - 1)
    if (canalId && canalId !== '0') q = q.eq('canal_loja_id', canalId)
    const { data, error } = await q
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < size) break
  }
  return rows
}

const linhas = computed(() => linhasRaw.value)
const totalFat = computed(() => linhas.value.reduce((s, l) => s + l.faturamento, 0))

// ── Curva ABC (pura) ──
function curvaABC(linhas) {
  const ord = [...linhas].sort((a, b) => b.faturamento - a.faturamento)
  const total = ord.reduce((s, l) => s + l.faturamento, 0) || 1
  let acum = 0
  return ord.map(l => {
    acum += l.faturamento; const p = acum / total
    return { ...l, pct: l.faturamento / total, pctAcum: p, classe: p <= 0.8 ? 'A' : p <= 0.95 ? 'B' : 'C' }
  })
}
const abc = computed(() => curvaABC(linhas.value))

// ── Matriz BCG (pura) ──
function mediana(arr) { const s = [...arr].sort((a, b) => a - b); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0 }
function matrizBCG(linhas) {
  const total = linhas.reduce((s, l) => s + l.faturamento, 0) || 1
  const itens = linhas.map(l => ({
    ...l,
    participacao: l.faturamento / total,
    crescimento: l.fatAnterior > 0 ? (l.faturamento - l.fatAnterior) / l.fatAnterior : (l.faturamento > 0 ? 1 : 0),
  }))
  const mp = mediana(itens.map(i => i.participacao)), mc = mediana(itens.map(i => i.crescimento))
  const q = itens.map(i => ({
    ...i,
    quadrante: i.participacao >= mp && i.crescimento >= mc ? 'Estrela'
      : i.participacao >= mp && i.crescimento < mc ? 'Vaca leiteira'
        : i.participacao < mp && i.crescimento >= mc ? 'Interrogação' : 'Abacaxi',
  }))
  return { itens: q, medPart: mp, medCresc: mc }
}
const bcgAll = computed(() => matrizBCG(linhas.value))
const bcg = computed(() => [...bcgAll.value.itens].sort((a, b) => b.faturamento - a.faturamento))
const medPart = computed(() => bcgAll.value.medPart)
const medCresc = computed(() => bcgAll.value.medCresc)
const contagem = computed(() => {
  const c = {}; for (const i of bcgAll.value.itens) c[quadKey(i.quadrante)] = (c[quadKey(i.quadrante)] || 0) + 1; return c
})

function quadKey(q) {
  return q === 'Estrela' ? 'estrela' : q === 'Vaca leiteira' ? 'vaca' : q === 'Interrogação' ? 'interrogacao' : 'abacaxi'
}

// ── Scatter BCG (coordenadas) ──
const SW = 640, SH = 300, PAD = 24
const maxPart = computed(() => Math.max(0.0001, ...bcgAll.value.itens.map(i => i.participacao)))
const crescMin = computed(() => Math.min(-0.2, ...bcgAll.value.itens.map(i => i.crescimento)))
const crescMax = computed(() => Math.max(0.5, ...bcgAll.value.itens.map(i => i.crescimento)))
function sx(part) { return PAD + (part / maxPart.value) * (SW - 2 * PAD) }
function sy(cresc) { const t = (cresc - crescMin.value) / (crescMax.value - crescMin.value || 1); return SH - PAD - t * (SH - 2 * PAD) }
const bcgPontos = computed(() => bcgAll.value.itens.map(i => ({
  x: sx(i.participacao), y: sy(i.crescimento), q: quadKey(i.quadrante),
  nome: i.produto, quadrante: i.quadrante, participacao: i.participacao, crescimento: i.crescimento,
})))

// ── Formatação ──
const fmtR = v => 'R$ ' + Math.round(Number(v) || 0).toLocaleString('pt-BR')
const fmtPct = v => ((Number(v) || 0) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'

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
.gc-rel-head{display:flex;gap:24px;flex-wrap:wrap;margin-bottom:14px;font-size:calc(13px*var(--gc-fs,1));color:var(--muted);}
.gc-rel-head b{color:var(--text);font-variant-numeric:tabular-nums;}
.gc-rel-tbwrap{overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius-xl);background:var(--surface);}
.gc-rel-tb{width:100%;border-collapse:collapse;font-size:calc(13px*var(--gc-fs,1));}
.gc-rel-tb th,.gc-rel-tb td{padding:9px 14px;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;}
.gc-rel-tb th.l,.gc-rel-tb td.l{text-align:left;white-space:normal;}
.gc-rel-tb thead th{position:sticky;top:0;background:var(--surface2);color:var(--muted);font-family:'Oswald',sans-serif;font-weight:500;font-size:calc(11px*var(--gc-fs,1));text-transform:uppercase;letter-spacing:.8px;border-bottom:1px solid var(--border);}
.gc-rel-tb tbody tr:nth-child(even){background:var(--surface2);}
.gc-rel-tb tbody tr:hover{background:var(--accent-light);}
.gc-rel-tb td.n{color:var(--text);}
.gc-rel-tb td.pos{color:var(--green);}
.gc-rel-tb td.neg{color:var(--red);}
.gc-badge{display:inline-block;min-width:22px;padding:2px 9px;border-radius:20px;font-size:calc(10px*var(--gc-fs,1));font-weight:700;letter-spacing:.5px;color:#fff;}
.gc-badge.abc-A{background:#16a34a;}
.gc-badge.abc-B{background:#d97706;}
.gc-badge.abc-C{background:#64748b;}
.gc-badge.q-estrela{background:#f59e0b;}
.gc-badge.q-vaca{background:#2563eb;}
.gc-badge.q-interrogacao{background:#7c3aed;}
.gc-badge.q-abacaxi{background:#e11d48;}
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
