<template>
  <div class="rel">
    <!-- PASSO 1. Um relatório por vez, sempre. O pedido do dono foi "tudo
         separadinho, sem ficar confuso" — misturar dois assuntos na mesma
         tabela é exatamente o que ele não quer. -->
    <div class="rel-passo">
      <span class="rel-rotulo">1. Qual relatório?</span>
      <div class="rel-opcoes">
        <button v-for="r in relatorios" :key="r.chave" type="button"
                class="btn" :class="{ 'btn-principal': escolhido === r.chave }"
                @click="escolhido = r.chave">{{ r.titulo }}</button>
      </div>
      <p class="rel-explica" v-if="relatorioAtual">{{ relatorioAtual.explicacao }}</p>
    </div>

    <!-- PASSO 2. O local NUNCA aparece sem a marca na frente: existem duas
         "Fábrica Conchal", de empresas diferentes. -->
    <div class="rel-passo">
      <span class="rel-rotulo">2. De onde?</span>
      <div class="rel-opcoes">
        <label class="rel-radio">
          <input type="radio" value="tudo" v-model="recorte.modo"> Tudo
        </label>
        <label class="rel-radio">
          <input type="radio" value="marca" v-model="recorte.modo"> Uma marca
        </label>
        <label class="rel-radio">
          <input type="radio" value="local" v-model="recorte.modo"> Um local
        </label>
      </div>
      <select class="rel-select" v-model="recorte.empresaId"
              v-if="recorte.modo === 'marca'" aria-label="Marca">
        <option value="">Escolha a marca…</option>
        <option v-for="e in empresas" :key="e.id" :value="e.id">{{ e.nome }}</option>
      </select>
      <select class="rel-select" v-model="recorte.localId"
              v-if="recorte.modo === 'local'" aria-label="Local">
        <option value="">Escolha o local…</option>
        <option v-for="l in locaisParaEscolher" :key="l.id" :value="l.id">{{ l.rotulo }}</option>
      </select>
    </div>

    <!-- PASSO 3. Só existe quando o relatório pede. Campo inútil na tela é o
         começo da confusão. -->
    <div class="rel-passo" v-if="relatorioAtual?.periodo">
      <span class="rel-rotulo">3. Quando?</span>
      <div class="rel-datas">
        <input class="rel-data" type="date" v-model="de" aria-label="Data inicial">
        <span class="rel-ate">até</span>
        <input class="rel-data" type="date" v-model="ate" aria-label="Data final">
      </div>
    </div>

    <p class="rel-aviso rel-aviso-erro" v-if="erro">{{ erro }}</p>
    <p class="rel-aviso" v-else-if="carregando">Montando o relatório…</p>

    <template v-else-if="relatorioAtual">
      <p class="rel-conta">
        <strong>{{ linhas.length }}</strong>
        {{ linhas.length === 1 ? 'linha' : 'linhas' }} · {{ recorteEscrito }}
        <template v-if="relatorioAtual.periodo"> · {{ periodoEscrito }}</template>
      </p>

      <!-- O que ficou fora do recorte NUNCA some calado. Tabela que esconde
           linha em silêncio é como relatório vira mentira. -->
      <p class="rel-fora" v-if="avisoDoQueFicouFora">{{ avisoDoQueFicouFora }}</p>

      <!-- Os botões ficam ANTES da tabela de propósito. Com 350 linhas eles
           cairiam depois de uma rolagem inteira, e no celular ninguém chega
           lá — descoberto abrindo a tela, não lendo o código. -->
      <div class="rel-acoes" v-if="linhas.length">
        <button type="button" class="btn" :disabled="!podeBaixar" @click="exportarExcel">Excel</button>
        <button type="button" class="btn btn-principal" :disabled="!podeBaixar" @click="imprimir">PDF</button>
      </div>
      <p class="rel-explica" v-if="linhas.length && !podeExportar">
        Você pode ver os relatórios, mas não baixar. Quem libera é quem administra.
      </p>

      <p class="rel-vazio" v-if="!linhas.length">
        Nada para mostrar com esta escolha. Tente "Tudo", ou um período maior.
      </p>

      <div class="rel-tabela-wrap rolagem-x" v-else>
        <table class="rel-tabela">
          <thead>
            <tr>
              <th v-for="col in relatorioAtual.colunas" :key="col.chave"
                  :class="{ num: col.tipo !== 'texto' }">{{ col.titulo }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(l, i) in linhas" :key="l.id || i">
              <td v-for="col in relatorioAtual.colunas" :key="col.chave"
                  :class="{ num: col.tipo !== 'texto' }">{{ celula(l, col) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

    </template>

    <!-- A FOLHA. Fica escondida na tela e só aparece na impressão — mesma
         tabela, mesmas colunas, para o papel não discordar do que se viu. -->
    <div class="folha-de-impressao" v-if="relatorioAtual">
      <div class="folha-cabecalho">
        <p class="folha-titulo">{{ relatorioAtual.titulo }}</p>
        <p class="folha-linha">{{ recorteEscrito }}<template v-if="relatorioAtual.periodo"> · {{ periodoEscrito }}</template></p>
        <p class="folha-linha">{{ linhas.length }} {{ linhas.length === 1 ? 'linha' : 'linhas' }} · emitido em {{ dataPorExtenso }}</p>
      </div>
      <table>
        <thead>
          <tr><th v-for="col in relatorioAtual.colunas" :key="col.chave">{{ col.titulo }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="(l, i) in linhas" :key="'f' + (l.id || i)">
            <td v-for="col in relatorioAtual.colunas" :key="col.chave">{{ celula(l, col) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
// A CASCA dos relatórios. Ela não sabe nada sobre Patrimônio nem sobre Frota:
// tudo o que mostra vem do catálogo que recebe em `relatorios`. É o que permite
// a Frota, na Etapa 2, só declarar o catálogo dela e ganhar a aba inteira.

import { computed, ref, watch } from 'vue'
import { montarArvore } from '../arvore-de-locais.js'
import { baixarExcel } from './exportar.js'
import {
  RECORTE_VAZIO, filtrarPorRecorte, rotuloDoRecorte, contarForaDoRecorte, opcoesDeLocal,
} from './recorte.js'
import { hojeLocal } from '../datas.js'
import './folha.css'

const props = defineProps({
  relatorios: { type: Array, required: true },
  contexto: { type: Object, default: () => ({}) },
  empresas: { type: Array, default: () => [] },
  locais: { type: Array, default: () => [] },
  comodos: { type: Array, default: () => [] },
  nomeDoArquivo: { type: String, default: 'relatorio' },
  podeExportar: { type: Boolean, default: false },
})

const escolhido = ref(props.relatorios[0]?.chave || '')
const recorte = ref({ ...RECORTE_VAZIO })
const linhasCruas = ref([])
const carregando = ref(false)
const erro = ref('')

// Período começa nos últimos 30 dias. `hojeLocal()` devolve 'AAAA-MM-DD' no
// fuso de quem está olhando — usar `new Date().toISOString()` traria o dia
// errado depois das 21h no Brasil, que é exatamente quando ninguém confere.
function trintaDiasAtras(iso) {
  const [a, m, d] = String(iso).split('-').map(Number)
  const dt = new Date(Date.UTC(a, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() - 30)
  return dt.toISOString().slice(0, 10)
}
const ate = ref(hojeLocal())
const de = ref(trintaDiasAtras(hojeLocal()))

const relatorioAtual = computed(() =>
  props.relatorios.find((r) => r.chave === escolhido.value) || null)

const arvore = computed(() => montarArvore({
  empresas: props.empresas, locais: props.locais, comodos: props.comodos,
}))
const locaisParaEscolher = computed(() => opcoesDeLocal(arvore.value))

const linhas = computed(() => {
  const r = relatorioAtual.value
  if (!r) return []
  return filtrarPorRecorte(linhasCruas.value, recorte.value, r.pegarIds)
})

const fora = computed(() => {
  const r = relatorioAtual.value
  if (!r) return { semMarca: 0, semLocal: 0 }
  return contarForaDoRecorte(linhasCruas.value, r.pegarIds)
})

const avisoDoQueFicouFora = computed(() => {
  if (recorte.value.modo === 'tudo') return ''
  const { semMarca, semLocal } = fora.value
  const quantos = recorte.value.modo === 'marca' ? semMarca : semLocal
  if (!quantos) return ''
  // "marca" é feminino e "local" é masculino: uma frase só, com "apontado"
  // cravado, escreveria "sem marca apontado" na tela do dono.
  const falta = recorte.value.modo === 'marca' ? 'marca apontada' : 'local apontado'
  return quantos === 1
    ? `1 linha ainda está sem ${falta} — ela só aparece em "Tudo".`
    : `${quantos} linhas ainda estão sem ${falta} — elas só aparecem em "Tudo".`
})

// O recorte por extenso, para o topo da tela E para o cabeçalho da folha —
// a mesma frase nos dois, senão o papel diz uma coisa e a tela diz outra.
const recorteEscrito = computed(() =>
  rotuloDoRecorte(recorte.value, { empresas: props.empresas, locais: props.locais }))

const porExtenso = (iso) => String(iso || '').split('-').reverse().join('/')
const periodoEscrito = computed(() => `${porExtenso(de.value)} a ${porExtenso(ate.value)}`)
const dataPorExtenso = computed(() => porExtenso(hojeLocal()))

const podeBaixar = computed(() => props.podeExportar && linhas.value.length > 0)

// Dinheiro na TELA é texto em reais; no Excel é número (matrizParaExcel cuida
// disso). São saídas diferentes do mesmo dado, de propósito.
function celula(linha, col) {
  const v = linha?.[col.chave]
  if (col.tipo === 'dinheiro') {
    return typeof v === 'number'
      ? (v / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : '—'
  }
  return v === null || v === undefined || v === '' ? '—' : v
}

// `immediate: true` em vez de onMounted: ler estado que ainda não chegou na
// montagem é armadilha conhecida deste projeto.
//
// O `recorte` entra na lista porque há relatório que precisa saber o recorte
// para se montar — o Resumo agrupa por marca em "Tudo" e por local quando uma
// marca foi escolhida.
watch([relatorioAtual, de, ate, recorte], async () => {
  const r = relatorioAtual.value
  if (!r) return
  carregando.value = true
  erro.value = ''
  try {
    linhasCruas.value = await r.montar({
      ...props.contexto, de: de.value, ate: ate.value, recorte: recorte.value,
    })
  } catch (e) {
    // Falhar VISÍVEL. Lista vazia sem aviso é o defeito que se esconde melhor:
    // parece "não tem nada", quando é "não consegui buscar".
    erro.value = e?.message || 'Não consegui montar este relatório.'
    linhasCruas.value = []
  } finally {
    carregando.value = false
  }
}, { immediate: true, deep: true })

function imprimir() {
  document.body.classList.add('imprimindo-relatorio')
  const limpar = () => {
    document.body.classList.remove('imprimindo-relatorio')
    window.removeEventListener('afterprint', limpar)
  }
  window.addEventListener('afterprint', limpar)
  window.print()
  // Safari no iPhone nem sempre dispara afterprint. Sem esta rede, o sistema
  // fica invisível na tela até recarregar a página.
  setTimeout(limpar, 3000)
}

function exportarExcel() {
  const r = relatorioAtual.value
  if (!r) return
  const res = baixarExcel({
    colunas: r.colunas,
    linhas: linhas.value,
    nomeAba: r.titulo,
    nomeArquivo: `${props.nomeDoArquivo}-${r.chave}-${hojeLocal()}.xlsx`,
  })
  if (!res.ok) erro.value = res.motivo
}
</script>

<style scoped>
.rel { display: flex; flex-direction: column; gap: 14px; padding: 14px; }

.rel-passo { display: flex; flex-direction: column; gap: 8px; }
.rel-rotulo {
  font-size: 11.5px; font-weight: 700; letter-spacing: .6px;
  text-transform: uppercase; color: var(--muted);
}
.rel-opcoes { display: flex; flex-wrap: wrap; gap: 8px; }
.rel-explica { margin: 0; font-size: 12.5px; color: var(--muted); line-height: 1.4; }

.rel-radio {
  display: inline-flex; align-items: center; gap: 6px;
  min-height: 40px; padding: 0 4px;
  font-size: 13px; color: var(--text); cursor: pointer;
}

.rel-select, .rel-data {
  min-height: 40px; padding: 0 10px;
  font-family: var(--fonte-principal); font-size: 13px;
  color: var(--text); background: var(--surface);
  border: 1px solid var(--border); border-radius: var(--radius-md);
}
.rel-select { width: 100%; max-width: 420px; }

.rel-datas { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.rel-ate { font-size: 13px; color: var(--muted); }

.rel-conta { margin: 0; font-size: 13px; color: var(--text); }
.rel-fora {
  margin: 0; padding: 8px 10px;
  font-size: 12.5px; line-height: 1.4; color: var(--text);
  background: var(--accent-light); border: 1px solid var(--accent-mid);
  border-radius: var(--radius-md);
}
.rel-vazio { margin: 0; font-size: 13px; color: var(--muted); }
.rel-aviso { margin: 0; font-size: 13px; color: var(--muted); }
.rel-aviso-erro { color: var(--red); }

.rel-tabela-wrap { width: 100%; overflow-x: auto; }
.rel-tabela { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.rel-tabela th, .rel-tabela td {
  padding: 7px 9px; text-align: left; white-space: nowrap;
  border-bottom: 1px solid var(--border);
}
.rel-tabela th {
  position: sticky; top: 0; z-index: 1;
  font-size: 11px; font-weight: 700; letter-spacing: .4px;
  text-transform: uppercase; color: var(--muted); background: var(--surface);
}
.rel-tabela td.num, .rel-tabela th.num { text-align: right; }
.rel-tabela tbody tr:last-child td { border-bottom: none; }

.rel-acoes { display: flex; gap: 8px; flex-wrap: wrap; }

/* Celular primeiro: os botões de baixar ocupam a largura toda, porque é onde
   o dedo erra. */
@media (max-width: 520px) {
  .rel-acoes .btn { flex: 1 1 auto; }
  .rel-select { max-width: none; }
}
</style>
