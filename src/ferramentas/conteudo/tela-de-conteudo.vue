<template>
  <!-- CENTRAL DE CONTEÚDO. Casca fina: topbar, seletor de marca, abas e carga
       dos dados. Cada visão é um componente próprio, e a regra de negócio mora
       nos .js puros ao lado (estados.js, formatos.js, agrupar-kanban.js…).
       Classes .ctd- para não colidir com o CSS global. -->
  <div class="ctd-tela">
    <div class="ctd-topbar">
      <div class="ctd-tb-left">
        <button class="ctd-back" @click="router.push({ name: 'inicio' })">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Central
        </button>
        <img class="rbv-logo rbv-logo-light" src="/midia/LOGOTIPOBRENOPRETO.png" alt="RBV">
        <img class="rbv-logo rbv-logo-dark" src="/midia/LOGOTIPOBRENOBRANCO.png" alt="RBV">
      </div>
      <span class="ctd-title">Central de Conteúdo</span>
      <div class="ctd-tb-right">
        <select v-model="contaSel" class="ctd-marca" aria-label="Perfil">
          <option v-for="c in contas" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <button class="ctd-btn ctd-btn-primario" :disabled="!contaSel" @click="abrirNova()">+ Nova peça</button>
      </div>
    </div>

    <div class="ctd-body">
      <p v-if="permissaoPelaMetade" class="ctd-aviso ctd-aviso-atencao">
        <b>Sua permissão está pela metade.</b> A ferramenta aparece para você, mas o banco de dados
        ainda não liberou o acesso — por isso a lista pode vir vazia mesmo tendo peças cadastradas.
        Peça a um administrador para abrir seu usuário em <b>Administração › Usuários</b> e salvar de
        novo; isso acerta os dois lados.
      </p>

      <p v-if="erro" class="ctd-aviso ctd-aviso-erro">{{ erro }}</p>

      <div v-if="carregando" class="ctd-vazio"><p>Carregando…</p></div>

      <template v-else-if="contas.length">
        <div class="ctd-selos">
          <span v-for="s in selos" :key="s.chave" class="ctd-selo">
            <i :style="{ background: s.cor }"></i>{{ s.rotulo }} <b>{{ s.total }}</b>
          </span>
          <span v-if="aguardando" class="ctd-selo ctd-selo-pergunta">
            <i style="background:#f59e0b"></i>Esperando você confirmar o post <b>{{ aguardando }}</b>
          </span>
        </div>

        <div class="ctd-tabs">
          <button :class="{ on: aba === 'calendario' }" @click="aba = 'calendario'">Calendário</button>
          <button :class="{ on: aba === 'quadro' }" @click="aba = 'quadro'">Quadro</button>
          <button :class="{ on: aba === 'lista' }" @click="aba = 'lista'">Lista</button>
        </div>

        <div v-if="!pecas.length" class="ctd-vazio">
          <h3>Nenhuma peça ainda</h3>
          <p>
            Aqui é onde o conteúdo desta marca é planejado: você monta a peça, ela passa pela aprovação
            e fica agendada. Na hora marcada chega um aviso no celular com tudo pronto para publicar.
          </p>
          <button class="ctd-btn ctd-btn-primario" @click="abrirNova()">Criar a primeira peça</button>
        </div>

        <template v-else>
          <VisaoCalendario
            v-show="aba === 'calendario'"
            :pecas="pecas"
            :miniaturas="miniaturas"
            @abrir="abrir"
            @nova="abrirNova"
          />
          <VisaoKanban
            v-show="aba === 'quadro'"
            :pecas="pecas"
            :miniaturas="miniaturas"
            :metricas="metricas"
            :pode-aprovar="podeAprovar"
            @abrir="abrir"
            @mover="mover"
          />
          <VisaoLista v-show="aba === 'lista'" :pecas="pecas" @abrir="abrir" />
        </template>
      </template>

      <div v-else class="ctd-vazio">
        <h3>Nenhum perfil disponível</h3>
        <p>Você não tem acesso a nenhum perfil de rede social. Fale com um administrador.</p>
      </div>
    </div>

    <PainelPeca
      v-if="painelAberto"
      :peca="pecaEmEdicao"
      :account-id="contaSel"
      :data-sugerida="dataSugerida"
      :pode-aprovar="podeAprovar"
      @fechar="fecharPainel"
      @mudou="recarregar"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import VisaoCalendario from './visao-calendario.vue'
import VisaoKanban from './visao-kanban.vue'
import VisaoLista from './visao-lista.vue'
import PainelPeca from './painel-peca.vue'
import { STATUS, corDeStatus } from './estados.js'
import { contarPorStatus } from './agrupar-kanban.js'
import * as dados from './dados-conteudo.js'
import './estilos-conteudo.css'

const router = useRouter()

const contas = ref([])
const contaSel = ref('')
const pecas = ref([])
const miniaturas = ref({})
const metricas = ref({})
const aguardando = ref(0)
const aba = ref('calendario')
const carregando = ref(true)
const erro = ref('')

const painelAberto = ref(false)
const pecaEmEdicao = ref(null)
const dataSugerida = ref('')

const podeAprovar = dados.podeAprovar()
const permissaoPelaMetade = dados.permissaoIncompleta()

// Só os selos que interessam no dia a dia — sete contagens viram ruído.
const DESTACADOS = ['em_aprovacao', 'aprovada', 'agendada']
const selos = computed(() => {
  const c = contarPorStatus(pecas.value)
  return STATUS.filter(s => DESTACADOS.includes(s.chave))
    .map(s => ({ chave: s.chave, rotulo: s.rotulo, cor: corDeStatus(s.chave), total: c[s.chave] }))
})

async function carregarContas() {
  try {
    contas.value = await dados.listarContas()
    if (contas.value.length && !contaSel.value) contaSel.value = contas.value[0].id
  } catch (e) {
    erro.value = e.message
  }
}

async function recarregar() {
  if (!contaSel.value) { pecas.value = []; return }
  try {
    erro.value = ''
    pecas.value = await dados.listarPecas(contaSel.value)
    await carregarMiniaturas()
  } catch (e) {
    erro.value = e.message
  }
}

async function carregarMiniaturas() {
  // Miniatura e métrica são enfeite: se falharem, os cartões mostram o ícone do
  // formato e seguem funcionando. Não vale poluir a faixa de erro por isso.
  const ids = pecas.value.map(p => p.id)
  try {
    miniaturas.value = await dados.miniaturasDasPecas(ids)
  } catch {
    miniaturas.value = {}
  }
  try {
    metricas.value = await dados.metricasDasPecas(ids)
    // Quantas peças estão com a pergunta "É este post?" esperando resposta.
    // Vira o selo da topbar — senão a pergunta ficaria escondida dentro de cada
    // peça, e ninguém abre peça publicada para conferir.
    aguardando.value = Object.keys(await dados.sugestoesDeCasamento(ids)).length
  } catch {
    metricas.value = {}
    aguardando.value = 0
  }
}

function abrir(peca) {
  pecaEmEdicao.value = peca
  dataSugerida.value = ''
  painelAberto.value = true
}

function abrirNova(dia = '') {
  pecaEmEdicao.value = null
  dataSugerida.value = dia
  painelAberto.value = true
}

function fecharPainel() {
  painelAberto.value = false
  pecaEmEdicao.value = null
}

async function mover({ peca, destino, veredito }) {
  if (!veredito.ok) { erro.value = veredito.motivo; return }
  try {
    erro.value = ''
    if (destino === 'aprovada' || destino === 'reprovada') {
      await dados.decidir(peca.id, destino)
    } else {
      await dados.mudarStatus(peca, destino)
    }
    await recarregar()
  } catch (e) {
    erro.value = e.message
  }
}

watch(contaSel, recarregar)

onMounted(async () => {
  await carregarContas()
  await recarregar()
  carregando.value = false
})
</script>
