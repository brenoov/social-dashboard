<template>
  <div class="tela-patrimonio">
    <div class="pat-topbar">
      <button class="pat-back" @click="voltar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>Gestão Interna
      </button>
      <span class="pat-title">Patrimônio</span>
      <button class="pat-btn-novo" @click="abrirNovo" v-if="podeCriar" title="Cadastrar bem">+</button>
    </div>

    <div class="pat-resumo">
      <span class="pat-resumo-qtd">{{ resumo.quantidade }}</span>
      <span class="pat-resumo-lab">{{ resumo.quantidade === 1 ? 'item' : 'itens' }}</span>
      <span class="pat-resumo-sep">·</span>
      <span class="pat-resumo-total">{{ formatarValor(resumo.totalCentavos) }}</span>
    </div>

    <div class="pat-busca-wrap">
      <input
        class="pat-busca"
        v-model="filtro.busca"
        type="search"
        inputmode="search"
        placeholder="Buscar por nome, número da etiqueta ou pessoa…"
        aria-label="Buscar bem">
    </div>

    <!-- Faixa de filtros: ROLA na horizontal, nunca quebra em linhas. -->
    <div class="pat-filtros rolagem-x">
      <select class="pat-select" v-model="filtro.empresaId" aria-label="Empresa">
        <option value="">Todas as empresas</option>
        <option v-for="e in empresas" :key="e.id" :value="e.id">{{ e.nome }}</option>
      </select>
      <select class="pat-select" v-model="filtro.localId" aria-label="Local">
        <option value="">Todos os locais</option>
        <option v-for="l in locais" :key="l.id" :value="l.id">{{ l.nome }}</option>
      </select>
      <select class="pat-select" v-model="filtro.categoriaId" aria-label="Categoria">
        <option value="">Todas as categorias</option>
        <option v-for="c in categorias" :key="c.id" :value="c.id">{{ c.nome }}</option>
      </select>
      <select class="pat-select" v-model="filtro.situacao" aria-label="Situação">
        <option value="">Todas as situações</option>
        <option v-for="s in SITUACOES" :key="s.valor" :value="s.valor">{{ s.rotulo }}</option>
      </select>
      <button class="pat-chip" :class="{ ativo: filtro.semDono }" @click="filtro.semDono = !filtro.semDono">Sem dono</button>
      <button class="pat-chip" v-if="temFiltro" @click="limparFiltros">Limpar</button>
    </div>

    <div class="pat-body">
      <div class="pat-aviso" v-if="carregando">Carregando os bens…</div>

      <div class="pat-aviso pat-aviso-erro" v-else-if="erro">
        Não consegui carregar o patrimônio: {{ erro }}
      </div>

      <!-- Tela vazia que ENSINA: diz o que fazer e por quê, não só "vazio". -->
      <div class="pat-vazio" v-else-if="!bens.length">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
        <h3>Nenhum bem cadastrado ainda</h3>
        <p>
          Aqui fica tudo que a empresa tem: computador, celular, mesa, máquina, carro.
          Cada bem guarda onde está, quanto custou e com quem está — e quando alguém
          é desligado, você sabe na hora o que precisa voltar.
        </p>
        <button class="pat-btn primario" @click="abrirNovo" v-if="podeCriar">Cadastrar o primeiro bem</button>
      </div>

      <div class="pat-vazio" v-else-if="!bensFiltrados.length">
        <h3>Nenhum bem para esses filtros</h3>
        <p>Tente limpar a busca ou escolher outra empresa, local ou situação.</p>
        <button class="pat-btn" @click="limparFiltros">Limpar filtros</button>
      </div>

      <template v-else>
        <!-- CELULAR e TABLET: cartões. É a única forma que funciona com uma mão. -->
        <div class="pat-cards">
          <button class="pat-card" v-for="bem in bensFiltrados" :key="bem.id" @click="abrirBem(bem)">
            <div class="pat-card-topo">
              <span class="pat-card-nome">{{ bem.nome }}</span>
              <span class="pat-pill" :class="classeDaSituacao(bem.situacao)">{{ rotuloDaSituacao(bem.situacao) }}</span>
            </div>
            <div class="pat-card-meta">
              <span v-if="bem.numero">Nº {{ bem.numero }}</span>
              <span v-if="bem.numero" class="pat-card-sep">·</span>
              <span>{{ formatarValor(bem.valor_centavos) }}</span>
            </div>
            <div class="pat-card-linha">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {{ nomeDoLocal(bem) }}
            </div>
            <div class="pat-card-linha">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              {{ textoDoDono(bem, pessoasById) }}
            </div>
          </button>
        </div>

        <!-- DESKTOP (≥1025px): a tabela larga, que só faz sentido com mouse e tela grande. -->
        <div class="pat-tabela-wrap rolagem-x">
          <table class="pat-tabela">
            <thead>
              <tr>
                <th>Nº</th><th>Item</th><th>Categoria</th><th>Empresa</th>
                <th>Local</th><th>Com quem</th><th>Situação</th><th class="pat-dir">Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="bem in bensFiltrados" :key="bem.id" @click="abrirBem(bem)">
                <td>{{ bem.numero ?? '—' }}</td>
                <td>{{ bem.nome }}</td>
                <td>{{ nomeDe(categorias, bem.categoria_id) }}</td>
                <td>{{ nomeDe(empresas, bem.empresa_id) }}</td>
                <td>{{ nomeDoLocal(bem) }}</td>
                <td>{{ textoDoDono(bem, pessoasById) }}</td>
                <td><span class="pat-pill" :class="classeDaSituacao(bem.situacao)">{{ rotuloDaSituacao(bem.situacao) }}</span></td>
                <td class="pat-dir">{{ formatarValor(bem.valor_centavos) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { sbClient } from '../../compartilhado/conectar-no-banco-de-dados.js'
import { adminToast } from '../../compartilhado/avisos.js'
import { hasPermission } from '../../compartilhado/controle-de-login-e-usuario.js'
import { formatarValor } from './patrimonio.js'
import { SITUACOES, rotuloDaSituacao, classeDaSituacao, textoDoDono } from './rotulos-do-bem.js'
import { FILTRO_VAZIO, filtrarBens, resumoDaLista } from './filtro-de-bens.js'

const router = useRouter()

const carregando = ref(true)
const erro = ref('')
const bens = ref([])
const empresas = ref([])
const locais = ref([])
const comodos = ref([])
const categorias = ref([])
const pessoas = ref([])

const filtro = reactive({ ...FILTRO_VAZIO })

const podeCriar = computed(() => hasPermission('patrimonio', 'criar'))

const pessoasById = computed(() => {
  const mapa = {}
  pessoas.value.forEach((p) => { mapa[p.id] = p })
  return mapa
})

const bensFiltrados = computed(() => filtrarBens(bens.value, filtro))
const resumo = computed(() => resumoDaLista(bensFiltrados.value))

const temFiltro = computed(() =>
  !!filtro.busca || !!filtro.empresaId || !!filtro.localId ||
  !!filtro.categoriaId || !!filtro.situacao || !!filtro.pessoaId || filtro.semDono)

function limparFiltros() {
  Object.assign(filtro, FILTRO_VAZIO)
}

function nomeDe(lista, id) {
  if (!id) return '—'
  const achou = lista.find((x) => x.id === id)
  return achou ? achou.nome : '—'
}

// Local e cômodo juntos numa linha só: no cartão do celular não cabe uma linha
// pra cada, e "Sede Limeira · RH" é como a pessoa fala.
function nomeDoLocal(bem) {
  const local = nomeDe(locais.value, bem.local_id)
  const comodo = nomeDe(comodos.value, bem.comodo_id)
  if (local === '—' && comodo === '—') return 'Local não informado'
  if (comodo === '—') return local
  if (local === '—') return comodo
  return `${local} · ${comodo}`
}

function voltar() {
  router.push({ name: 'gestao-interna' })
}

// Qual bem está aberto na ficha (null = ficha fechada). Declarado ANTES das
// funções que mexem nele — `const` não sobe (hoisting), e usá-lo antes daria
// ReferenceError em runtime, não erro de build.
const bemAberto = ref(null)

function abrirBem(bem) {
  bemAberto.value = bem
}
function abrirNovo() {
  bemAberto.value = { novo: true }
}

async function carregar() {
  carregando.value = true
  erro.value = ''
  const [rBens, rEmp, rLoc, rCom, rCat, rPes] = await Promise.all([
    sbClient.from('patrimonio_bens').select('*').order('numero', { ascending: true, nullsFirst: false }),
    sbClient.from('patrimonio_empresas').select('id,nome').order('ordem').order('nome'),
    sbClient.from('patrimonio_locais').select('id,nome').order('ordem').order('nome'),
    sbClient.from('patrimonio_comodos').select('id,nome').order('ordem').order('nome'),
    sbClient.from('patrimonio_categorias').select('id,nome,vida_util_anos').order('ordem').order('nome'),
    sbClient.from('acessos_pessoas').select('id,nome,status').order('nome'),
  ])
  if (rBens.error) {
    erro.value = rBens.error.message
    carregando.value = false
    return
  }
  bens.value = rBens.data || []
  empresas.value = rEmp.data || []
  locais.value = rLoc.data || []
  comodos.value = rCom.data || []
  categorias.value = rCat.data || []
  // Colaboradores vêm do módulo vizinho: é o ÚNICO ponto em que Patrimônio
  // depende de Colaboradores e Acessos. Se a pessoa não tiver acesso àquele
  // módulo, a RLS devolve lista vazia — e a tela segue funcionando, mostrando
  // o nome solto (dono_texto) quando houver.
  pessoas.value = rPes.data || []
  carregando.value = false
}

onMounted(() => {
  if (!hasPermission('patrimonio', 'ver')) {
    adminToast('Sem acesso', false)
    router.push({ name: 'inicio' })
    return
  }
  carregar()
})
</script>

<style scoped>
/* Celular-primeiro: o que está fora de media query É o celular.
   A tabela larga só aparece a partir de 1025px. */
.tela-patrimonio{min-height:100vh;display:flex;flex-direction:column;background:var(--bg);width:100%;}

.tela-patrimonio .pat-topbar{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border);background:var(--surface);position:sticky;top:0;z-index:10;}
.tela-patrimonio .pat-back{font-family:var(--fonte-principal);font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--accent);cursor:pointer;background:none;border:1px solid var(--accent-mid);border-radius:5px;padding:6px 10px;display:flex;align-items:center;gap:5px;white-space:nowrap;touch-action:manipulation;}
.tela-patrimonio .pat-title{font-family:var(--fonte-principal);font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:var(--text);flex:1;min-width:0;}
.tela-patrimonio .pat-btn-novo{width:38px;height:38px;flex-shrink:0;border-radius:10px;border:none;background:var(--accent);color:#fff;font-size:22px;line-height:1;cursor:pointer;touch-action:manipulation;}

.tela-patrimonio .pat-resumo{display:flex;align-items:baseline;gap:6px;padding:12px 14px 4px;font-family:var(--fonte-principal);}
.tela-patrimonio .pat-resumo-qtd{font-size:22px;font-weight:700;color:var(--text);}
.tela-patrimonio .pat-resumo-lab,.tela-patrimonio .pat-resumo-sep{font-size:12px;color:var(--muted);}
.tela-patrimonio .pat-resumo-total{font-size:15px;font-weight:600;color:var(--accent);}

.tela-patrimonio .pat-busca-wrap{padding:8px 14px;}
/* 16px obrigatório: abaixo disso o iOS dá zoom sozinho ao focar o campo. */
.tela-patrimonio .pat-busca{width:100%;font-size:16px;font-family:var(--fonte-principal);padding:11px 13px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text);}

.tela-patrimonio .pat-filtros{display:flex;gap:8px;padding:4px 14px 12px;white-space:nowrap;}
.tela-patrimonio .pat-select{font-size:16px;font-family:var(--fonte-principal);padding:9px 11px;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--text);flex-shrink:0;max-width:190px;}
.tela-patrimonio .pat-chip{font-size:12px;font-family:var(--fonte-principal);font-weight:600;padding:9px 14px;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--text);cursor:pointer;flex-shrink:0;touch-action:manipulation;}
.tela-patrimonio .pat-chip.ativo{background:var(--accent);border-color:var(--accent);color:#fff;}

.tela-patrimonio .pat-body{flex:1;padding:0 14px 40px;}
.tela-patrimonio .pat-aviso{padding:26px 4px;color:var(--muted);font-family:var(--fonte-principal);font-size:13px;}
.tela-patrimonio .pat-aviso-erro{color:#dc2626;}

.tela-patrimonio .pat-vazio{display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;padding:48px 18px;color:var(--muted);}
.tela-patrimonio .pat-vazio h3{font-family:var(--fonte-principal);font-size:16px;font-weight:600;color:var(--text);}
.tela-patrimonio .pat-vazio p{font-family:var(--fonte-principal);font-size:13px;line-height:1.7;max-width:420px;}

.tela-patrimonio .pat-btn{font-family:var(--fonte-principal);font-size:13px;font-weight:600;padding:11px 18px;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--text);cursor:pointer;touch-action:manipulation;}
.tela-patrimonio .pat-btn.primario{background:var(--accent);border-color:var(--accent);color:#fff;}

.tela-patrimonio .pat-cards{display:flex;flex-direction:column;gap:10px;}
.tela-patrimonio .pat-card{display:flex;flex-direction:column;gap:6px;width:100%;text-align:left;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px;cursor:pointer;font-family:var(--fonte-principal);color:var(--text);touch-action:manipulation;}
.tela-patrimonio .pat-card:active{border-color:var(--accent);}
.tela-patrimonio .pat-card-topo{display:flex;align-items:center;gap:8px;}
.tela-patrimonio .pat-card-nome{font-size:15px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.tela-patrimonio .pat-card-meta{font-size:12px;color:var(--muted);display:flex;gap:5px;}
.tela-patrimonio .pat-card-linha{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);}

.tela-patrimonio .pat-pill{font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;padding:4px 9px;border-radius:999px;flex-shrink:0;}
.tela-patrimonio .pat-pill-uso{background:#dcfce7;color:#166534;}
.tela-patrimonio .pat-pill-estoque{background:#e0e7ff;color:#3730a3;}
.tela-patrimonio .pat-pill-manutencao{background:#fef3c7;color:#92400e;}
.tela-patrimonio .pat-pill-baixado{background:#f1f5f9;color:#475569;}
.tela-patrimonio .pat-pill-neutro{background:#f1f5f9;color:#475569;}

/* A tabela NAO existe no celular. */
.tela-patrimonio .pat-tabela-wrap{display:none;}

@media(min-width:1025px){
  .tela-patrimonio .pat-topbar{padding:13px 24px;}
  .tela-patrimonio .pat-resumo,.tela-patrimonio .pat-busca-wrap,.tela-patrimonio .pat-filtros{padding-left:24px;padding-right:24px;}
  .tela-patrimonio .pat-body{padding:0 24px 48px;}
  .tela-patrimonio .pat-cards{display:none;}
  .tela-patrimonio .pat-tabela-wrap{display:block;}
  .tela-patrimonio .pat-tabela{width:100%;border-collapse:collapse;font-family:var(--fonte-principal);font-size:13px;}
  .tela-patrimonio .pat-tabela th{text-align:left;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--muted);padding:10px 12px;border-bottom:1px solid var(--border);white-space:nowrap;}
  .tela-patrimonio .pat-tabela td{padding:11px 12px;border-bottom:1px solid var(--border);color:var(--text);}
  .tela-patrimonio .pat-tabela tbody tr{cursor:pointer;}
  .tela-patrimonio .pat-tabela tbody tr:hover{background:var(--surface2);}
  .tela-patrimonio .pat-dir{text-align:right;}
}
</style>
