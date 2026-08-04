<script setup>
/* Frota — onde está cada carro, e quem pegou.
 *
 * É a aba "Resumo Geral" da planilha, com uma diferença que muda tudo: aqui o
 * KM não é digitado. Ele sai da última devolução. Na planilha a coluna
 * "KM Atual" é preenchida à mão, e por isso a aba "Alertas" — que depende dela
 * — nasceu vazia e nunca avisou nada.
 *
 * Fase 1: cadastro, "onde está" e o ciclo de retirada/devolução. Requisição
 * com aprovação, multas e plano de revisão vêm nas fases seguintes; o desenho
 * inteiro está em docs/superpowers/specs/2026-08-04-frota-design.md. */
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { sbClient } from '../../compartilhado/conectar-no-banco-de-dados.js'
import { hasPermission, estado } from '../../compartilhado/controle-de-login-e-usuario.js'
import { estadoDoVeiculo, resumoDoEstado, ordenarEstados, rotuloDoTanque, NIVEIS_TANQUE, problemasDaDevolucao } from './estado-do-veiculo.js'
import { AREAS, areasVisiveis, areaInicial, painelDoMotorista, resumoDoMotorista } from './areas-da-frota.js'
import {
  SITUACOES, problemasDaRequisicao, bloqueios, podeDecidir, motivoEmPortugues,
  ordenarFila, quando,
} from './requisicoes.js'

const router = useRouter()
const logoClaroUrl = '/midia/LOGOTIPOBRENOPRETO.png'
const logoEscuroUrl = '/midia/LOGOTIPOBRENOBRANCO.png'

const veiculos = ref([])
const usos = ref([])
const pessoas = ref([])
const carregando = ref(true)
const falha = ref('')
const podeEditar = computed(() => hasPermission('frota', 'editar'))
// Duas áreas (D8): Motorista pra quem dirige, Gestão pra quem administra.
// A separação é de ATENÇÃO, não de sigilo — quem só dirige não precisa de FIPE,
// contrato e chassi na frente enquanto pega o carro pra sair.
const pode = (acao) => hasPermission('frota', acao)
const abas = computed(() => AREAS.filter((a) => areasVisiveis(pode).includes(a.chave)))
const area = ref('motorista')
const euId = computed(() => meuId())
const painel = computed(() => painelDoMotorista(linhas.value, euId.value))

function voltar() { router.push({ name: 'gestao-interna' }) }

async function carregar() {
  carregando.value = true
  falha.value = ''
  const [v, u, p, q] = await Promise.all([
    sbClient.from('frota_veiculos').select('*').order('nome'),
    // Só o que interessa pra montar a tela: o aberto de cada carro e as
    // devoluções recentes. Puxar o histórico inteiro cresceria pra sempre.
    sbClient.from('frota_uso').select('*').order('saida_em', { ascending: false }).limit(400),
    sbClient.from('acessos_pessoas').select('id,nome,email_corporativo').order('nome'),
    // A agenda de reservas: quem vê a Frota vê a agenda inteira. Saber que o
    // carro está reservado é o que evita o conflito de viagens — esconder isso
    // de quem dirige recriaria no app o problema que o papel tem.
    sbClient.from('frota_requisicoes').select('*').order('retirada_prevista'),
  ])
  if (v.error || u.error) {
    falha.value = 'Não consegui carregar a frota. Recarregue a página; se continuar, avise.'
    carregando.value = false
    return
  }
  veiculos.value = v.data || []
  usos.value = u.data || []
  pessoas.value = (p.data || [])
  // A agenda pode falhar sozinha (permissão nova ainda não concedida) sem
  // derrubar o resto da tela: sem ela a Frota ainda serve pra pegar e devolver.
  requisicoes.value = q && !q.error ? (q.data || []) : []
  carregando.value = false
}

const nomeDaPessoa = (id) => (pessoas.value.find((x) => x.id === id) || {}).nome || null

const linhas = computed(() => ordenarEstados(
  veiculos.value.map((v) => estadoDoVeiculo(
    { ...v, pessoa_nome: nomeDaPessoa(v.pessoa_id) },
    usos.value,
  )),
))

const naRua = computed(() => linhas.value.filter((l) => l.naRua).length)
const livres = computed(() => linhas.value.filter((l) => l.disponivel).length)

/* ── Retirar e devolver ──────────────────────────────────────────────────── */

const ficha = ref(null)          // { modo: 'retirar'|'devolver', linha }
const form = reactive({ pessoaId: '', km: '', tanque: '', destino: '', finalidade: '', observacao: '' })
const problemas = ref([])
const gravando = ref(false)

function abrirRetirada(linha) {
  ficha.value = { modo: 'retirar', linha }
  Object.assign(form, {
    pessoaId: meuId() || '', km: linha.km == null ? '' : String(linha.km),
    tanque: linha.tanque == null ? '' : String(linha.tanque),
    destino: '', finalidade: '', observacao: '',
  })
  problemas.value = []
}
function abrirDevolucao(linha) {
  const aberto = usos.value.find((u) => u.veiculo_id === linha.veiculo.id && !u.volta_em)
  ficha.value = { modo: 'devolver', linha, uso: aberto }
  Object.assign(form, { pessoaId: '', km: '', tanque: '', destino: '', finalidade: '', observacao: '' })
  problemas.value = []
}
function fecharFicha() { ficha.value = null; problemas.value = [] }

// Quem está logado, ligado ao colaborador pelo e-mail corporativo. Serve de
// sugestão na retirada (o campo continua editável — quem pega pode ser outra
// pessoa) e é o que a área Motorista usa pra saber qual carro é "o meu".
//
// A coluna chama `email_corporativo`, não `email` — a primeira versão procurava
// por `p.email`, que não existe, e sem trazer a coluna na consulta. Devolvia
// nulo SEMPRE, calada.
function meuId() {
  const email = estado.user && estado.user.email
  if (!email) return null
  const eu = pessoas.value.find((p) => (p.email_corporativo || '').toLowerCase() === email.toLowerCase())
  return eu ? eu.id : null
}

const inteiro = (v) => { const n = parseInt(String(v).replace(/\D/g, ''), 10); return Number.isInteger(n) ? n : null }

async function confirmar() {
  const f = ficha.value
  if (!f || gravando.value) return
  const km = inteiro(form.km)
  const tanque = form.tanque === '' ? null : inteiro(form.tanque)

  if (f.modo === 'devolver') {
    problemas.value = problemasDaDevolucao({ kmSaida: f.uso ? f.uso.km_saida : null, kmVolta: km })
    // Aviso de salto grande é confirmável: a segunda tentativa grava. Bloqueio
    // de KM menor que o da saída não — esse é erro de digitação, sempre.
    const soAviso = problemas.value.length && problemas.value.every((t) => /Confirme/i.test(t))
    if (problemas.value.length && !(soAviso && f.jaAvisado)) {
      if (soAviso) f.jaAvisado = true
      return
    }
  } else if (!km) {
    problemas.value = ['Informe o KM que está no painel agora.']
    return
  }

  gravando.value = true
  let erro = null
  if (f.modo === 'retirar') {
    const r = await sbClient.from('frota_uso').insert({
      veiculo_id: f.linha.veiculo.id,
      pessoa_id: form.pessoaId || null,
      pessoa_nome: form.pessoaId ? nomeDaPessoa(form.pessoaId) : null,
      km_saida: km,
      tanque_quartos: tanque,
      destino: form.destino || null,
      finalidade: form.finalidade || null,
      observacao: form.observacao || null,
    })
    erro = r.error
  } else {
    const r = await sbClient.from('frota_uso')
      .update({ volta_em: new Date().toISOString(), km_volta: km, tanque_quartos: tanque })
      .eq('id', f.uso.id)
    erro = r.error
  }
  gravando.value = false
  if (erro) {
    // O índice único do banco é quem garante que um carro não saia duas vezes.
    // Se dois celulares registrarem ao mesmo tempo, um perde — e tem que saber.
    problemas.value = [/duplicate|unique/i.test(erro.message || '')
      ? 'Alguém registrou a retirada deste carro agora há pouco. Recarregue para ver.'
      : 'Não consegui gravar. Confira a conexão e tente de novo.']
    return
  }
  fecharFicha()
  carregar()
}

/* ── Requisição de uso (F2) ──────────────────────────────────────────────────
   O formulário de papel virando tela. A parte que o papel nunca fez: avisar do
   CONFLITO DE VIAGENS — o manual da planilha diz que os 3 dias de antecedência
   existem justamente pra isso, e cada requisição de papel é uma folha solta que
   ninguém compara com as outras. */
const requisicoes = ref([])
const podeAprovar = computed(() => hasPermission('frota.aprovar', 'ver'))

const pedido = ref(null)   // o formulário aberto, ou nulo
const pedidoForm = reactive({
  veiculoId: '', pessoaId: '', departamento: '', destino: '', finalidade: '',
  retirada: '', devolucao: '', observacao: '',
})
const avisosDoPedido = ref([])
const jaAvisado = ref(false)

// As minhas: pendentes e aprovadas ainda não usadas.
const minhasRequisicoes = computed(() => ordenarFila(
  requisicoes.value.filter((r) =>
    ['pendente', 'aprovada'].includes(r.situacao)
    && (r.pessoa_id === euId.value || r.criada_por === (estado.user && estado.user.id)))))

// A fila de quem aprova: tudo que está pendente, de todo mundo.
const filaDeAprovacao = computed(() =>
  ordenarFila(requisicoes.value.filter((r) => r.situacao === 'pendente')))

function abrirPedido(veiculoId) {
  pedido.value = { aberto: true }
  jaAvisado.value = false
  avisosDoPedido.value = []
  Object.assign(pedidoForm, {
    veiculoId: veiculoId || '', pessoaId: euId.value || '', departamento: '',
    destino: '', finalidade: '', retirada: '', devolucao: '', observacao: '',
  })
}
function fecharPedido() { pedido.value = null; avisosDoPedido.value = [] }

// <input type="datetime-local"> devolve hora LOCAL sem fuso. Mandar essa string
// crua pro banco gravaria como se fosse UTC — três horas de diferença, que é
// exatamente o tipo de erro que faz duas pessoas pegarem o mesmo carro.
const paraIso = (local) => (local ? new Date(local).toISOString() : null)

const rascunhoDoPedido = computed(() => ({
  id: null,
  veiculo_id: pedidoForm.veiculoId || null,
  pessoa_id: pedidoForm.pessoaId || null,
  destino: pedidoForm.destino,
  retirada_prevista: paraIso(pedidoForm.retirada),
  devolucao_prevista: paraIso(pedidoForm.devolucao),
}))

function conferirPedido() {
  avisosDoPedido.value = problemasDaRequisicao(
    rascunhoDoPedido.value, requisicoes.value, new Date().toISOString())
  return avisosDoPedido.value
}

async function enviarPedido() {
  if (gravando.value) return
  const probs = conferirPedido()
  if (bloqueios(probs).length) return
  // Avisos (conflito, antecedência, data passada) pedem uma segunda confirmação
  // em vez de travar: são combinados entre pessoas, não impossibilidades.
  if (probs.length && !jaAvisado.value) { jaAvisado.value = true; return }

  gravando.value = true
  const { error } = await sbClient.from('frota_requisicoes').insert({
    veiculo_id: pedidoForm.veiculoId,
    pessoa_id: pedidoForm.pessoaId || null,
    pessoa_nome: pedidoForm.pessoaId ? nomeDaPessoa(pedidoForm.pessoaId) : null,
    departamento: pedidoForm.departamento || null,
    destino: pedidoForm.destino || null,
    finalidade: pedidoForm.finalidade || null,
    retirada_prevista: paraIso(pedidoForm.retirada),
    devolucao_prevista: paraIso(pedidoForm.devolucao),
    observacao: pedidoForm.observacao || null,
    criada_por: estado.user && estado.user.id,
  })
  gravando.value = false
  if (error) {
    avisosDoPedido.value = [{ bloqueia: true, texto: 'Não consegui enviar o pedido. Confira a conexão e tente de novo.' }]
    return
  }
  fecharPedido()
  carregar()
}

const decisao = ref(null)   // { requisicao, acao: 'aprovada'|'recusada' }
const motivoDaRecusa = ref('')
const erroDaDecisao = ref('')

function abrirDecisao(requisicao, acao) {
  decisao.value = { requisicao, acao }
  motivoDaRecusa.value = ''
  erroDaDecisao.value = ''
}
function fecharDecisao() { decisao.value = null; erroDaDecisao.value = '' }

function porQueNaoDecido(r) {
  return podeDecidir({
    requisicao: r,
    minhaPessoaId: euId.value,
    meuUsuarioId: estado.user && estado.user.id,
    temPermissaoAprovar: podeAprovar.value,
  })
}

async function confirmarDecisao() {
  const d = decisao.value
  if (!d || gravando.value) return
  if (d.acao === 'recusada' && !motivoDaRecusa.value.trim()) {
    erroDaDecisao.value = 'Diga o motivo. Quem pediu precisa saber o que fazer diferente.'
    return
  }
  gravando.value = true
  const { error } = await sbClient.from('frota_requisicoes')
    .update({ situacao: d.acao, motivo_decisao: motivoDaRecusa.value.trim() || null })
    .eq('id', d.requisicao.id)
  gravando.value = false
  if (error) {
    // O gatilho do banco é quem barra de verdade: sem permissão, ou tentando
    // decidir a própria requisição. A mensagem dele já vem em português.
    erroDaDecisao.value = error.message && /aprovar|sua/i.test(error.message)
      ? error.message
      : 'Não consegui gravar a decisão. Tente de novo.'
    return
  }
  fecharDecisao()
  carregar()
}

onMounted(async () => {
  await carregar()
  // Só depois de saber as permissões dá pra escolher a aba de abertura.
  area.value = areaInicial(pode)
})
</script>

<template>
  <div class="tela-frota">
    <div class="fr-topbar">
      <button class="fr-back" @click="voltar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>Gestão Interna
      </button>
      <img class="rbv-logo rbv-logo-light" :src="logoClaroUrl" alt="RBV">
      <img class="rbv-logo rbv-logo-dark" :src="logoEscuroUrl" alt="RBV">
      <span class="fr-title">Frota</span>
    </div>

    <!-- Duas áreas (D8). Quem só dirige vê uma aba só — e nesse caso a barra
         não aparece: barra de uma aba é enfeite que come altura de tela. -->
    <div class="fr-abas" v-if="abas.length > 1" role="tablist">
      <button v-for="ab in abas" :key="ab.chave" role="tab" type="button"
              :class="{ on: area === ab.chave }" @click="area = ab.chave">{{ ab.rotulo }}</button>
    </div>

    <div class="fr-resumo" v-if="!carregando && !falha && area === 'gestao'">
      <span><strong>{{ livres }}</strong> {{ livres === 1 ? 'livre' : 'livres' }}</span>
      <span class="fr-sep">·</span>
      <span><strong>{{ naRua }}</strong> na rua</span>
      <span class="fr-sep">·</span>
      <span><strong>{{ linhas.length }}</strong> {{ linhas.length === 1 ? 'veículo' : 'veículos' }}</span>
    </div>

    <p v-if="carregando" class="fr-vazio">Carregando…</p>
    <p v-else-if="falha" class="fr-erro">{{ falha }}</p>
    <p v-else-if="!linhas.length" class="fr-vazio">Nenhum veículo cadastrado ainda.</p>

    <!-- ÁREA MOTORISTA: o carro que está comigo (pra devolver) e os livres (pra
         pegar). Sem FIPE, contrato, chassi ou Renavam — quem está de pé no
         estacionamento não precisa disso na frente. -->
    <template v-else-if="area === 'motorista'">
      <p class="fr-motorista-resumo">{{ resumoDoMotorista(painel) }}</p>

      <p class="fr-aviso" v-if="!euId">
        Não achei você na lista de colaboradores pelo seu e-mail, então não consigo dizer qual
        carro está com você. Dá pra pegar e devolver normalmente, escolhendo o nome na hora.
      </p>

      <template v-if="painel.comigo.length">
        <h2 class="fr-secao">Com você agora</h2>
        <div class="fr-lista">
          <div v-for="l in painel.comigo" :key="l.veiculo.id" class="fr-card rua">
            <div class="fr-card-topo">
              <div class="fr-card-ident">
                <span class="fr-card-nome">{{ l.veiculo.nome }}</span>
                <span class="fr-placa">{{ l.veiculo.placa }}</span>
              </div>
            </div>
            <div class="fr-dados">
              <div class="fr-dado">
                <span class="fr-dado-lab">Saiu com</span>
                <span class="fr-dado-val">{{ l.km == null ? '—' : l.km.toLocaleString('pt-BR') + ' km' }}</span>
              </div>
              <div class="fr-dado">
                <span class="fr-dado-lab">Combustível</span>
                <span class="fr-dado-val" :class="{ alerta: l.precisaAbastecer }">{{ rotuloDoTanque(l.tanque) }}</span>
              </div>
            </div>
            <div class="fr-acoes" v-if="podeEditar">
              <button class="fr-btn primario" @click="abrirDevolucao(l)">Devolver</button>
            </div>
          </div>
        </div>
      </template>

      <!-- As reservas da pessoa: o que ela pediu e ainda não usou. -->
      <template v-if="minhasRequisicoes.length">
        <h2 class="fr-secao">Seus pedidos</h2>
        <ul class="fr-pedidos">
          <li v-for="r in minhasRequisicoes" :key="r.id" class="fr-pedido">
            <div class="fr-pedido-topo">
              <strong>{{ (veiculos.find((v) => v.id === r.veiculo_id) || {}).nome || 'Veículo' }}</strong>
              <span class="fr-selo" :class="SITUACOES[r.situacao].cor">{{ SITUACOES[r.situacao].rotulo }}</span>
            </div>
            <div class="fr-pedido-quando">{{ quando(r.retirada_prevista) }}<span v-if="r.destino"> · {{ r.destino }}</span></div>
            <div class="fr-pedido-motivo" v-if="r.situacao === 'recusada' && r.motivo_decisao">{{ r.motivo_decisao }}</div>
          </li>
        </ul>
      </template>

      <h2 class="fr-secao">{{ painel.livres.length ? 'Livres para pegar' : 'Nenhum carro livre' }}</h2>
      <p class="fr-aviso" v-if="!painel.livres.length">
        Todos estão na rua ou na oficina. Assim que alguém devolver, aparece aqui.
      </p>
      <div class="fr-lista" v-else>
        <div v-for="l in painel.livres" :key="l.veiculo.id" class="fr-card">
          <div class="fr-card-topo">
            <div class="fr-card-ident">
              <span class="fr-card-nome">{{ l.veiculo.nome }}</span>
              <span class="fr-placa">{{ l.veiculo.placa }}</span>
            </div>
            <span class="fr-selo livre" v-if="l.ondeEsta">Em {{ l.ondeEsta }}</span>
          </div>
          <div class="fr-dados">
            <div class="fr-dado">
              <span class="fr-dado-lab">Quilometragem</span>
              <span class="fr-dado-val">{{ l.km == null ? '—' : l.km.toLocaleString('pt-BR') + ' km' }}</span>
            </div>
            <div class="fr-dado">
              <span class="fr-dado-lab">Combustível</span>
              <span class="fr-dado-val" :class="{ alerta: l.precisaAbastecer }">
                {{ rotuloDoTanque(l.tanque) }}<template v-if="l.precisaAbastecer"> · abastecer</template>
              </span>
            </div>
          </div>
          <div class="fr-acoes" v-if="podeEditar">
            <button class="fr-btn primario" @click="abrirRetirada(l)">Vou usar</button>
            <!-- Pegar agora e reservar pra depois são coisas diferentes. O
                 manual da planilha pede 3 dias de antecedência justamente pra
                 não atropelar viagem de outro departamento. -->
            <button class="fr-btn" @click="abrirPedido(l.veiculo.id)">Reservar</button>
          </div>
        </div>
      </div>

      <!-- Os que estão com outras pessoas: sem botão, só pra ninguém achar que
           o carro sumiu da lista. -->
      <template v-if="painel.comOutros.length">
        <h2 class="fr-secao">Na rua com outras pessoas</h2>
        <ul class="fr-outros">
          <li v-for="l in painel.comOutros" :key="l.veiculo.id">
            <strong>{{ l.veiculo.nome }}</strong>
            <span v-if="l.comQuem"> · com {{ l.comQuem }}</span>
          </li>
        </ul>
      </template>
    </template>

    <div class="fr-lista" v-else>
      <div v-for="l in linhas" :key="l.veiculo.id" class="fr-card" :class="{ rua: l.naRua, parado: !l.disponivel && !l.naRua }">
        <div class="fr-card-topo">
          <div class="fr-card-ident">
            <span class="fr-card-nome">{{ l.veiculo.nome }}</span>
            <span class="fr-placa">{{ l.veiculo.placa }}</span>
          </div>
          <span class="fr-selo" :class="{ rua: l.naRua, livre: l.disponivel }">{{ resumoDoEstado(l) }}</span>
        </div>

        <div class="fr-dados">
          <div class="fr-dado">
            <span class="fr-dado-lab">Quilometragem</span>
            <span class="fr-dado-val">{{ l.km == null ? '—' : l.km.toLocaleString('pt-BR') + ' km' }}</span>
          </div>
          <div class="fr-dado">
            <span class="fr-dado-lab">Combustível</span>
            <span class="fr-dado-val" :class="{ alerta: l.precisaAbastecer }">
              {{ rotuloDoTanque(l.tanque) }}<template v-if="l.precisaAbastecer"> · abastecer</template>
            </span>
          </div>
        </div>

        <div class="fr-acoes" v-if="podeEditar">
          <button v-if="l.naRua" class="fr-btn primario" @click="abrirDevolucao(l)">Devolver</button>
          <button v-else-if="l.disponivel" class="fr-btn primario" @click="abrirRetirada(l)">Vou usar</button>
        </div>
      </div>
    </div>

    <!-- FILA DE APROVAÇÃO, na área de Gestão. Só aparece pra quem aprova. -->
    <template v-if="area === 'gestao' && podeAprovar && filaDeAprovacao.length">
      <h2 class="fr-secao">Aguardando sua decisão ({{ filaDeAprovacao.length }})</h2>
      <div class="fr-lista">
        <div v-for="r in filaDeAprovacao" :key="r.id" class="fr-card espera">
          <div class="fr-card-topo">
            <div class="fr-card-ident">
              <span class="fr-card-nome">{{ (veiculos.find((v) => v.id === r.veiculo_id) || {}).nome || 'Veículo' }}</span>
              <span class="fr-placa">{{ r.pessoa_nome || 'sem motorista informado' }}</span>
            </div>
            <span class="fr-selo espera">{{ quando(r.retirada_prevista) }}</span>
          </div>
          <div class="fr-dados">
            <div class="fr-dado">
              <span class="fr-dado-lab">Destino</span>
              <span class="fr-dado-val">{{ r.destino || '—' }}</span>
            </div>
            <div class="fr-dado" v-if="r.devolucao_prevista">
              <span class="fr-dado-lab">Devolve</span>
              <span class="fr-dado-val">{{ quando(r.devolucao_prevista) }}</span>
            </div>
          </div>
          <p class="fr-pedido-motivo" v-if="r.finalidade">{{ r.finalidade }}</p>

          <div class="fr-acoes" v-if="porQueNaoDecido(r).pode">
            <button class="fr-btn primario" @click="abrirDecisao(r, 'aprovada')">Aprovar</button>
            <button class="fr-btn" @click="abrirDecisao(r, 'recusada')">Recusar</button>
          </div>
          <p class="fr-aviso" v-else>{{ motivoEmPortugues(porQueNaoDecido(r).motivo) }}</p>
        </div>
      </div>
    </template>

    <!-- PEDIR O CARRO PARA UMA DATA -->
    <div class="fr-ficha-fundo" v-if="pedido" @click.self="fecharPedido">
      <div class="fr-ficha" role="dialog">
        <div class="fr-ficha-topo">
          <span class="fr-ficha-titulo">Reservar veículo</span>
          <button class="fr-fechar" @click="fecharPedido" aria-label="Fechar">✕</button>
        </div>
        <div class="fr-ficha-corpo">
          <label class="fr-campo">
            <span class="fr-lab">Veículo</span>
            <select v-model="pedidoForm.veiculoId" @change="conferirPedido">
              <option value="">— escolha —</option>
              <option v-for="v in veiculos.filter((x) => x.situacao === 'ativo')" :key="v.id" :value="v.id">
                {{ v.nome }} · {{ v.placa }}
              </option>
            </select>
          </label>
          <label class="fr-campo">
            <span class="fr-lab">Quem vai dirigir</span>
            <select v-model="pedidoForm.pessoaId">
              <option value="">— escolha —</option>
              <option v-for="p in pessoas" :key="p.id" :value="p.id">{{ p.nome }}</option>
            </select>
          </label>
          <label class="fr-campo">
            <span class="fr-lab">Retirada</span>
            <input v-model="pedidoForm.retirada" type="datetime-local" @change="conferirPedido">
          </label>
          <label class="fr-campo">
            <span class="fr-lab">Devolução prevista</span>
            <input v-model="pedidoForm.devolucao" type="datetime-local" @change="conferirPedido">
          </label>
          <label class="fr-campo">
            <span class="fr-lab">Destino</span>
            <input v-model="pedidoForm.destino" type="text" placeholder="Conchal, Campinas…">
          </label>
          <label class="fr-campo">
            <span class="fr-lab">Para quê</span>
            <input v-model="pedidoForm.finalidade" type="text" placeholder="Homologação, buscar pedido…">
          </label>
          <label class="fr-campo">
            <span class="fr-lab">Departamento</span>
            <input v-model="pedidoForm.departamento" type="text" placeholder="Administrativo, Marketing…">
          </label>

          <ul class="fr-problemas" v-if="avisosDoPedido.length">
            <li v-for="(a, i) in avisosDoPedido" :key="i">{{ a.texto }}</li>
          </ul>
        </div>
        <div class="fr-ficha-rodape">
          <button class="fr-btn" @click="fecharPedido">Cancelar</button>
          <button class="fr-btn primario" :disabled="gravando" @click="enviarPedido">
            {{ gravando ? 'Enviando…' : (jaAvisado && avisosDoPedido.length ? 'Pedir assim mesmo' : 'Pedir') }}
          </button>
        </div>
      </div>
    </div>

    <!-- APROVAR OU RECUSAR -->
    <div class="fr-ficha-fundo" v-if="decisao" @click.self="fecharDecisao">
      <div class="fr-ficha" role="dialog">
        <div class="fr-ficha-topo">
          <span class="fr-ficha-titulo">{{ decisao.acao === 'aprovada' ? 'Aprovar' : 'Recusar' }} requisição</span>
          <button class="fr-fechar" @click="fecharDecisao" aria-label="Fechar">✕</button>
        </div>
        <div class="fr-ficha-corpo">
          <p class="fr-recado">
            {{ (veiculos.find((v) => v.id === decisao.requisicao.veiculo_id) || {}).nome }}
            para {{ decisao.requisicao.pessoa_nome || 'motorista não informado' }},
            {{ quando(decisao.requisicao.retirada_prevista) }}<span v-if="decisao.requisicao.destino">, {{ decisao.requisicao.destino }}</span>.
          </p>
          <label class="fr-campo">
            <span class="fr-lab">{{ decisao.acao === 'recusada' ? 'Motivo (obrigatório)' : 'Observação' }}</span>
            <input v-model="motivoDaRecusa" type="text"
                   :placeholder="decisao.acao === 'recusada' ? 'O carro já está reservado nesse dia…' : 'opcional'">
          </label>
          <ul class="fr-problemas" v-if="erroDaDecisao"><li>{{ erroDaDecisao }}</li></ul>
        </div>
        <div class="fr-ficha-rodape">
          <button class="fr-btn" @click="fecharDecisao">Cancelar</button>
          <button class="fr-btn primario" :disabled="gravando" @click="confirmarDecisao">
            {{ gravando ? 'Gravando…' : (decisao.acao === 'aprovada' ? 'Aprovar' : 'Recusar') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Ficha de retirada / devolução. Centralizada com margem, como os outros
         modais desta central. -->
    <div class="fr-ficha-fundo" v-if="ficha" @click.self="fecharFicha">
      <div class="fr-ficha" role="dialog">
        <div class="fr-ficha-topo">
          <span class="fr-ficha-titulo">
            {{ ficha.modo === 'retirar' ? 'Retirar' : 'Devolver' }} · {{ ficha.linha.veiculo.nome }}
          </span>
          <button class="fr-fechar" @click="fecharFicha" aria-label="Fechar">✕</button>
        </div>

        <div class="fr-ficha-corpo">
          <label class="fr-campo" v-if="ficha.modo === 'retirar'">
            <span class="fr-lab">Quem vai usar</span>
            <select v-model="form.pessoaId">
              <option value="">— escolha —</option>
              <option v-for="p in pessoas" :key="p.id" :value="p.id">{{ p.nome }}</option>
            </select>
          </label>

          <label class="fr-campo">
            <span class="fr-lab">
              KM no painel {{ ficha.modo === 'devolver' ? 'agora' : 'ao sair' }}
            </span>
            <input v-model="form.km" type="text" inputmode="numeric" placeholder="145928">
            <span class="fr-ajuda" v-if="ficha.modo === 'devolver' && ficha.uso && ficha.uso.km_saida">
              Saiu com {{ ficha.uso.km_saida.toLocaleString('pt-BR') }} km.
            </span>
          </label>

          <label class="fr-campo">
            <span class="fr-lab">Combustível no painel</span>
            <select v-model="form.tanque">
              <option value="">— não informar —</option>
              <option v-for="(n, i) in NIVEIS_TANQUE" :key="i" :value="String(i)">{{ n }}</option>
            </select>
          </label>

          <template v-if="ficha.modo === 'retirar'">
            <label class="fr-campo">
              <span class="fr-lab">Destino</span>
              <input v-model="form.destino" type="text" placeholder="Conchal, Rio Claro…">
            </label>
            <label class="fr-campo">
              <span class="fr-lab">Para quê</span>
              <input v-model="form.finalidade" type="text" placeholder="Homologação, buscar pedido…">
            </label>
          </template>

          <label class="fr-campo">
            <span class="fr-lab">Observação</span>
            <input v-model="form.observacao" type="text" placeholder="opcional">
          </label>

          <ul class="fr-problemas" v-if="problemas.length">
            <li v-for="(p, i) in problemas" :key="i">{{ p }}</li>
          </ul>
        </div>

        <div class="fr-ficha-rodape">
          <button class="fr-btn" @click="fecharFicha">Cancelar</button>
          <button class="fr-btn primario" :disabled="gravando" @click="confirmar">
            {{ gravando ? 'Gravando…' : (ficha.jaAvisado ? 'Gravar assim mesmo' : 'Confirmar') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tela-frota{min-height:100vh;display:flex;flex-direction:column;background:transparent;}
.tela-frota .fr-topbar{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border);background:var(--surface);position:sticky;top:0;z-index:10;}
.tela-frota .fr-topbar .rbv-logo{height:22px;width:auto;flex-shrink:0;}
.tela-frota .fr-back{display:inline-flex;align-items:center;gap:6px;background:none;border:none;color:var(--muted);font-family:var(--fonte-principal);font-size:11px;font-weight:600;cursor:pointer;text-transform:uppercase;letter-spacing:1.2px;flex-shrink:0;}
.tela-frota .fr-title{font-family:var(--fonte-principal);font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:var(--text);flex:1;min-width:0;text-align:right;}
.tela-frota .fr-abas{display:flex;gap:4px;padding:2px 14px 0;border-bottom:1px solid var(--border);}
.tela-frota .fr-abas button{flex:1;appearance:none;background:none;border:none;border-bottom:2px solid transparent;margin-bottom:-1px;padding:11px 10px;font-family:var(--fonte-principal);font-size:11.5px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:var(--muted);cursor:pointer;touch-action:manipulation;}
.tela-frota .fr-abas button.on{color:var(--accent);border-bottom-color:var(--accent);}
.tela-frota .fr-motorista-resumo{margin:0;padding:14px 14px 4px;font-family:var(--fonte-principal);font-size:15px;font-weight:600;color:var(--text);}
.tela-frota .fr-secao{margin:16px 0 8px;padding:0 14px;font-family:var(--fonte-principal);font-size:10px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:var(--muted);}
.tela-frota .fr-aviso{margin:0;padding:4px 14px 10px;font-family:var(--fonte-principal);font-size:12.5px;line-height:1.55;color:var(--muted);}
/* Os carros de outras pessoas: lista simples, sem cartão e sem botão. Dar
   cartão a eles daria a entender que há algo a fazer, e não há. */
.tela-frota .fr-outros{margin:0;padding:0 14px 40px;list-style:none;display:flex;flex-direction:column;gap:7px;font-family:var(--fonte-principal);font-size:12.5px;color:var(--muted);}
.tela-frota .fr-outros strong{color:var(--text);font-weight:600;}
.tela-frota .fr-pedidos{margin:0;padding:0 14px;list-style:none;display:flex;flex-direction:column;gap:9px;}
.tela-frota .fr-pedido{background:var(--surface);border:1px solid var(--border);border-radius:11px;padding:12px 14px;}
.tela-frota .fr-pedido-topo{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;font-family:var(--fonte-principal);font-size:13px;color:var(--text);}
.tela-frota .fr-pedido-quando{margin-top:4px;font-family:var(--fonte-principal);font-size:12px;color:var(--muted);}
.tela-frota .fr-pedido-motivo{margin:8px 0 0;font-family:var(--fonte-principal);font-size:12.5px;line-height:1.5;color:var(--muted);}
.tela-frota .fr-recado{margin:0 0 4px;font-family:var(--fonte-principal);font-size:13.5px;line-height:1.6;color:var(--text);}
.tela-frota .fr-card.espera{border-left-color:var(--orange,#d97706);}
.tela-frota .fr-selo.espera{background:color-mix(in srgb,var(--orange,#d97706) 18%,transparent);color:var(--orange,#d97706);}
.tela-frota .fr-selo.boa{background:color-mix(in srgb,var(--green,#16a34a) 18%,transparent);color:var(--green,#16a34a);}
.tela-frota .fr-selo.ruim{background:color-mix(in srgb,var(--red,#c0392b) 16%,transparent);color:var(--red,#c0392b);}
.tela-frota .fr-selo.neutra{background:color-mix(in srgb,var(--muted) 16%,transparent);color:var(--muted);}
.tela-frota .fr-resumo{display:flex;align-items:center;gap:7px;padding:10px 14px;font-family:var(--fonte-principal);font-size:12.5px;color:var(--muted);}
.tela-frota .fr-resumo strong{color:var(--text);font-variant-numeric:tabular-nums;}
.tela-frota .fr-sep{opacity:.45;}
.tela-frota .fr-vazio,.tela-frota .fr-erro{padding:40px 20px;text-align:center;font-family:var(--fonte-principal);font-size:13px;color:var(--muted);}
.tela-frota .fr-erro{color:var(--red,#c0392b);}

.tela-frota .fr-lista{display:flex;flex-direction:column;gap:10px;padding:4px 14px 40px;}
.tela-frota .fr-card{background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--green,#16a34a);border-radius:12px;padding:14px 16px;}
.tela-frota .fr-card.rua{border-left-color:var(--accent);}
.tela-frota .fr-card.parado{border-left-color:var(--muted);opacity:.72;}
.tela-frota .fr-card-topo{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;}
.tela-frota .fr-card-ident{display:flex;flex-direction:column;gap:2px;min-width:0;}
.tela-frota .fr-card-nome{font-family:var(--fonte-principal);font-size:13.5px;font-weight:700;color:var(--text);}
.tela-frota .fr-placa{font-family:var(--fonte-dados);font-size:11px;letter-spacing:1.5px;color:var(--muted);}
.tela-frota .fr-selo{font-family:var(--fonte-principal);font-size:10px;font-weight:700;letter-spacing:.4px;padding:4px 10px;border-radius:999px;background:color-mix(in srgb,var(--muted) 16%,transparent);color:var(--text);white-space:nowrap;}
.tela-frota .fr-selo.livre{background:color-mix(in srgb,var(--green,#16a34a) 18%,transparent);color:var(--green,#16a34a);}
.tela-frota .fr-selo.rua{background:color-mix(in srgb,var(--accent) 18%,transparent);color:var(--accent);}

.tela-frota .fr-dados{display:flex;gap:26px;margin-top:12px;flex-wrap:wrap;}
.tela-frota .fr-dado{display:flex;flex-direction:column;gap:1px;}
.tela-frota .fr-dado-lab{font-family:var(--fonte-principal);font-size:9.5px;letter-spacing:.8px;text-transform:uppercase;color:var(--muted);}
.tela-frota .fr-dado-val{font-family:var(--fonte-dados);font-size:13px;font-weight:600;color:var(--text);font-variant-numeric:tabular-nums;}
.tela-frota .fr-dado-val.alerta{color:var(--orange,#d97706);}
.tela-frota .fr-acoes{display:flex;gap:8px;margin-top:14px;}

/* 44px de altura em tudo que se toca: é o alvo que o dedo acerta. Esta
   ferramenta é usada em pé, no estacionamento, com uma mão só. */
.tela-frota .fr-btn{flex:1 1 auto;min-height:44px;font-family:var(--fonte-principal);font-size:13.5px;font-weight:600;padding:11px 16px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text);cursor:pointer;touch-action:manipulation;}
.tela-frota .fr-btn.primario{background:var(--accent);border-color:var(--accent);color:#fff;}
.tela-frota .fr-btn:disabled{opacity:.6;cursor:default;}

.tela-frota .fr-ficha-fundo{position:fixed;inset:0;z-index:1200;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:14px;}
.tela-frota .fr-ficha{width:100%;max-width:460px;max-height:calc(100dvh - 28px);display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.35);}
.tela-frota .fr-ficha-topo{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 15px;border-bottom:1px solid var(--border);}
.tela-frota .fr-ficha-titulo{font-family:var(--fonte-principal);font-size:12.5px;font-weight:700;letter-spacing:.6px;color:var(--text);}
.tela-frota .fr-fechar{appearance:none;border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:9px;width:34px;height:34px;font-size:15px;cursor:pointer;flex:0 0 auto;}
.tela-frota .fr-ficha-corpo{padding:14px 15px;overflow-y:auto;display:flex;flex-direction:column;gap:13px;}
.tela-frota .fr-campo{display:flex;flex-direction:column;gap:5px;}
.tela-frota .fr-lab{font-family:var(--fonte-principal);font-size:10.5px;letter-spacing:.8px;text-transform:uppercase;color:var(--muted);}
/* 16px nos campos: abaixo disso o iPhone dá zoom sozinho ao tocar. */
.tela-frota .fr-campo input,.tela-frota .fr-campo select{font-family:var(--fonte-principal);font-size:16px;padding:11px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text);width:100%;box-sizing:border-box;}
.tela-frota .fr-ajuda{font-family:var(--fonte-principal);font-size:11.5px;color:var(--muted);}
.tela-frota .fr-problemas{margin:0;padding:11px 13px 11px 30px;background:color-mix(in srgb,var(--orange,#d97706) 12%,transparent);border:1px solid color-mix(in srgb,var(--orange,#d97706) 34%,transparent);border-radius:10px;font-family:var(--fonte-principal);font-size:12.5px;line-height:1.55;color:var(--text);}
.tela-frota .fr-ficha-rodape{display:flex;gap:9px;padding:13px 15px;border-top:1px solid var(--border);}

@media(min-width:900px){
  .tela-frota .fr-topbar{padding:12px 24px;}
  .tela-frota .fr-resumo{padding:12px 24px;}
  .tela-frota .fr-lista{padding:4px 24px 40px;display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;}
}
</style>
