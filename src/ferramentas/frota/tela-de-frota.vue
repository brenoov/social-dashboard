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
import BarraDeTopo from '../../compartilhado/barra-de-topo.vue'
import { useRouter } from 'vue-router'
import { sbClient } from '../../compartilhado/conectar-no-banco-de-dados.js'
import { hasPermission, estado } from '../../compartilhado/controle-de-login-e-usuario.js'
import { estadoDoVeiculo, resumoDoEstado, ordenarEstados, rotuloDoTanque, NIVEIS_TANQUE, problemasDaDevolucao, ultimoHodometro } from './estado-do-veiculo.js'
import { AREAS, areasVisiveis, areaInicial, painelDoMotorista, resumoDoMotorista } from './areas-da-frota.js'
import {
  SITUACOES, problemasDaRequisicao, bloqueios, podeDecidir, motivoEmPortugues,
  ordenarFila, quando,
} from './requisicoes.js'
import { revisoesDoVeiculo, resumoDeRevisoes, problemasDoItem, avisoAoDesativar } from './revisoes.js'
import { linkDoWhatsapp, telefoneLegivel, porQueNaoDaLink } from '../../compartilhado/whatsapp.js'
import PainelDeChecklist from './painel-de-checklist.vue'
import { cadenciasDoDia, quemFaltaHoje, resumoDaCobranca } from '../../../supabase/functions/_shared/checklist.js'

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

// O checklist do dia: os itens que o gestor definiu, a cadência (dia_semanal
// etc.) e as fichas já preenchidas, de onde saem "última semanal" e "última
// mensal" de cada carro.
const itensDeChecklist = ref([])
const configDeChecklist = ref({ dia_semanal: 5, semana_mensal: 1, dia_mensal: 3 })
const fichas = ref([])

// A data de HOJE em BRT, como texto. `toISOString()` puro daria a data em UTC,
// e depois das 21h no Brasil isso já é o dia seguinte — o checklist de hoje
// apareceria como o de amanhã.
const hoje = computed(() =>
  new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10))

// O carro fixo desta pessoa: é o que ela vai conferir hoje.
const meuCarroFixo = computed(() =>
  veiculos.value.find((v) => v.pessoa_id && v.pessoa_id === euId.value) || null)

const fichaDeHoje = computed(() => !meuCarroFixo.value ? null
  : fichas.value.find((f) => f.veiculo_id === meuCarroFixo.value.id && f.feita_em === hoje.value) || null)

const ultimaDoTipo = (veiculoId, cadencia) => {
  const l = fichas.value
    .filter((f) => f.veiculo_id === veiculoId && (f.cadencias || []).includes(cadencia))
    .map((f) => f.feita_em)
    .sort()
  return l.length ? l[l.length - 1] : null
}

function voltar() { router.push({ name: 'gestao-interna' }) }

async function carregar() {
  carregando.value = true
  falha.value = ''
  const [v, u, p, q, pl, rv, bn, ci, cc, cf] = await Promise.all([
    sbClient.from('frota_veiculos').select('*').order('nome'),
    // Só o que interessa pra montar a tela: o aberto de cada carro e as
    // devoluções recentes. Puxar o histórico inteiro cresceria pra sempre.
    sbClient.from('frota_uso').select('*').order('saida_em', { ascending: false }).limit(400),
    sbClient.from('acessos_pessoas').select('id,nome,email_corporativo').order('nome'),
    // A agenda de reservas: quem vê a Frota vê a agenda inteira. Saber que o
    // carro está reservado é o que evita o conflito de viagens — esconder isso
    // de quem dirige recriaria no app o problema que o papel tem.
    sbClient.from('frota_requisicoes').select('*').order('retirada_prevista'),
    sbClient.from('frota_plano_revisao').select('*').order('ordem'),
    sbClient.from('frota_revisoes').select('*'),
    // Bens do Patrimônio que são veículos — a lista do seletor de ligação na
    // ficha. Pode falhar sem derrubar nada: quem não tem Patrimônio ainda
    // gere a frota.
    sbClient.from('patrimonio_bens').select('id,nome,numero').order('nome').limit(500),
    sbClient.from('frota_checklist_itens').select('*').order('ordem'),
    sbClient.from('frota_checklist_config').select('*').limit(1),
    // 120 dias: o bastante pra saber quando foi a última mensal, sem crescer
    // pra sempre.
    sbClient.from('frota_checklist').select('*')
      .gte('feita_em', new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10))
      .order('feita_em', { ascending: false }),
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
  plano.value = pl && !pl.error ? (pl.data || []) : []
  revisoes.value = rv && !rv.error ? (rv.data || []) : []
  bensVeiculo.value = bn && !bn.error ? (bn.data || []) : []
  // Mesmo padrão tolerante a falha: sem o checklist a Frota ainda serve pra
  // pegar e devolver carro.
  itensDeChecklist.value = ci && !ci.error ? (ci.data || []) : []
  configDeChecklist.value = cc && !cc.error && cc.data?.[0] ? cc.data[0] : configDeChecklist.value
  fichas.value = cf && !cf.error ? (cf.data || []) : []
  carregando.value = false
}

const nomeDaPessoa = (id) => (pessoas.value.find((x) => x.id === id) || {}).nome || null

const linhas = computed(() => ordenarEstados(
  veiculos.value.map((v) => estadoDoVeiculo(
    { ...v, pessoa_nome: nomeDaPessoa(v.pessoa_id) },
    usos.value,
    fichas.value,
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

/* ── O checklist do dia (F6) ──────────────────────────────────────────────── */

// Erro PRÓPRIO do checklist, não o `falha` de carregamento: `falha` está
// numa cadeia `v-else-if` que troca a tela inteira (Motorista/Gestão) por uma
// linha de texto. Reaproveitá-lo aqui faria uma falha ao GRAVAR o checklist
// esconder a lista de carros inteira — o mesmo tipo de defeito silencioso que
// a guarda de estilo existe pra pegar, só que em comportamento, não em CSS.
const erroChecklist = ref('')

async function gravarChecklist({ ficha, respostas }) {
  if (gravando.value) return
  gravando.value = true
  erroChecklist.value = ''
  const { data, error } = await sbClient.from('frota_checklist')
    // `estado` não tem campo `perfil` — o nome de quem preenche vem de
    // `pessoas`, do mesmo jeito que a retirada e a requisição já fazem.
    .insert({ ...ficha, pessoa_id: euId.value, pessoa_nome: euId.value ? nomeDaPessoa(euId.value) : null })
    .select('id').single()
  if (error) {
    gravando.value = false
    erroChecklist.value = /duplicate|unique/i.test(error.message || '')
      ? 'O checklist deste carro já foi preenchido hoje.'
      : 'Não consegui gravar o checklist. Confira a conexão e tente de novo.'
    return
  }
  // A ficha já tem `data.id` aqui — as respostas são um segundo insert, e
  // podem falhar sozinhas (rede caiu no meio, permissão faltando). Capturar o
  // erro é OBRIGATÓRIO: sem isso a ficha fica gravada sem nenhuma resposta,
  // e a tela segue como se tivesse dado tudo certo — ninguém percebe até
  // alguém abrir o banco e ver a contagem zerada.
  const { error: erroRespostas } = await sbClient.from('frota_checklist_respostas')
    .insert(respostas.map((r) => ({ ...r, checklist_id: data.id })))
  gravando.value = false
  if (erroRespostas) {
    // NÃO chama carregar(): recarregar acharia a ficha (ela gravou) e trocaria
    // o cartão pela frase "Checklist de hoje já feito" — sensação de sucesso
    // bem no caminho que falhou. A pessoa precisa ver que faltou a parte de
    // dentro, e saber a quem recorrer, porque tentar de novo bate no índice
    // "um carro, um dia, uma ficha" e é recusado como duplicidade.
    erroChecklist.value = 'A ficha do checklist foi registrada, mas as respostas dos itens não '
      + 'foram salvas. Avise quem administra a Frota antes de tentar de novo — tentar de novo '
      + 'vai recusar dizendo que o checklist de hoje já existe.'
    return
  }
  await carregar()
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

/* ── Revisões (F4) ───────────────────────────────────────────────────────────
   O plano diz de quantos em quantos km cada item se troca; o histórico diz
   quando cada um foi trocado em cada carro; e o KM vem sozinho das devoluções.
   Com os três, o alerta se calcula — que é o que a aba "Alertas" da planilha
   nunca conseguiu, porque o KM dela dependia de alguém digitar. */
const plano = ref([])
const revisoes = ref([])

// A aba Revisões mostra SÓ O QUE ESTÁ CHEGANDO (correção do dono). Listar
// todos os itens de todos os carros virava uma parede de "em dia" onde o que
// importa se perdia. Item em dia, sem registro ou sem quilometragem não é
// notícia — quem quiser o histórico completo abre a ficha do carro na Gestão.
const revisoesPorVeiculo = computed(() => linhas.value.map((l) => {
  const todos = revisoesDoVeiculo({
    veiculo: l.veiculo, kmAtual: l.km, plano: plano.value, revisoes: revisoes.value,
  })
  const itens = todos.filter((i) => i.situacao === 'vencida' || i.situacao === 'perto')
  return { linha: l, itens, resumo: resumoDeRevisoes(todos) }
})
  .filter((r) => r.itens.length)
  .sort((a, b) => {
    const ordem = { vencida: 0, perto: 1 }
    return (ordem[a.resumo.nivel] ?? 9) - (ordem[b.resumo.nivel] ?? 9)
  }))

// O editor de limiares: o dono acrescenta e ajusta sem depender de programador,
// porque quem muda de opinião é o mecânico.
const itemEmEdicao = ref(null)
const itemForm = reactive({ item: '', aCadaKm: '', observacao: '' })
const errosDoItem = ref([])

function abrirItem(p) {
  itemEmEdicao.value = p || { novo: true }
  errosDoItem.value = []
  Object.assign(itemForm, {
    item: p ? p.item : '', aCadaKm: p ? String(p.a_cada_km) : '', observacao: (p && p.observacao) || '',
  })
}
function fecharItem() { itemEmEdicao.value = null; errosDoItem.value = [] }

async function salvarItem() {
  if (gravando.value) return
  const km = parseInt(String(itemForm.aCadaKm).replace(/\D/g, ''), 10)
  errosDoItem.value = problemasDoItem({
    item: itemForm.item, aCadaKm: km,
    existentes: plano.value, idAtual: itemEmEdicao.value && itemEmEdicao.value.id,
  })
  if (errosDoItem.value.length) return

  gravando.value = true
  const dados = { item: itemForm.item.trim(), a_cada_km: km, observacao: itemForm.observacao.trim() || null }
  const r = itemEmEdicao.value.novo
    ? await sbClient.from('frota_plano_revisao').insert({ ...dados, ordem: plano.value.length + 1 })
    : await sbClient.from('frota_plano_revisao').update(dados).eq('id', itemEmEdicao.value.id)
  gravando.value = false
  if (r.error) { errosDoItem.value = ['Não consegui gravar. Tente de novo.']; return }
  fecharItem()
  carregar()
}

async function alternarItem(p) {
  const { error } = await sbClient.from('frota_plano_revisao').update({ ativo: !p.ativo }).eq('id', p.id)
  if (!error) carregar()
}

// O link de WhatsApp do contato do carro. Já leva o modelo e a placa escritos:
// quem recebe atende sabendo de qual carro se fala, sem precisar perguntar.
function zapDoVeiculo(v) {
  if (!v) return null
  return linkDoWhatsapp(v.contato_telefone, `Olá! É sobre o ${v.nome} (${v.placa}).`)
}

// A OFICINA é um contato à parte (correção do dono): ela se procura quando o
// carro precisa de revisão, e o contato geral quando o problema é outro.
// A mensagem já leva a quilometragem, que é a primeira coisa que o mecânico
// pergunta.
function zapDaOficina(v, km) {
  if (!v) return null
  const quilometragem = Number.isInteger(km) ? ` Está com ${km.toLocaleString('pt-BR')} km.` : ''
  return linkDoWhatsapp(v.oficina_telefone, `Olá! É sobre o ${v.nome} (${v.placa}).${quilometragem}`)
}

/* ── A ficha do veículo (aba Gestão) ─────────────────────────────────────────
   Tudo do carro num lugar só: identificação, contrato, seguro, tag de pedágio,
   rastreador, a ligação com o Patrimônio, quem é o responsável, e o histórico
   de manutenção. Pedido do dono — antes só dava pra ver, não pra mexer. */
const veiculoAberto = ref(null)
const vForm = reactive({})
const errosDoVeiculo = ref([])
const CAMPOS_VEICULO = [
  'nome', 'placa', 'marca', 'ano', 'cor', 'combustivel', 'renavam', 'chassi', 'tipo_oleo',
  'contrato', 'codigo_patrimonial', 'categoria_comercial', 'situacao', 'pessoa_id', 'local_texto',
  'seguro_seguradora', 'seguro_apolice', 'seguro_vence_em', 'tag_pedagio', 'rastreador',
  'contato_nome', 'contato_telefone', 'contato_papel',
  'oficina_nome', 'oficina_telefone',
  'bem_id', 'observacao',
]

// Os bens do Patrimônio que são veículos — a lista do seletor de ligação.
const bensVeiculo = ref([])

function abrirVeiculo(v) {
  veiculoAberto.value = v
  errosDoVeiculo.value = []
  for (const c of CAMPOS_VEICULO) vForm[c] = v[c] ?? ''
  vForm.aluguel = v.aluguel_centavos == null ? '' : (v.aluguel_centavos / 100).toString()
  vForm.fipe = v.fipe_centavos == null ? '' : (v.fipe_centavos / 100).toString()
  vForm.seguroValor = v.seguro_valor_centavos == null ? '' : (v.seguro_valor_centavos / 100).toString()
  novaRevisao.item = plano.value.length ? plano.value[0].item : ''
  novaRevisao.km = ''
  novaRevisao.feita_em = ''
  novaRevisao.oficina = ''
  novaRevisao.custo = ''
}
function fecharVeiculo() { veiculoAberto.value = null; errosDoVeiculo.value = [] }

// Dinheiro em centavos, sempre — float com centavo vira erro de arredondamento
// que ninguém acha depois.
const centavosDe = (v) => {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(String(v).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) : null
}

async function salvarVeiculo() {
  if (gravando.value) return
  if (!String(vForm.nome || '').trim() || !String(vForm.placa || '').trim()) {
    errosDoVeiculo.value = ['Nome e placa são obrigatórios — é por eles que o carro é reconhecido.']
    return
  }
  gravando.value = true
  const dados = {}
  for (const c of CAMPOS_VEICULO) dados[c] = vForm[c] === '' ? null : vForm[c]
  dados.placa = String(vForm.placa).toUpperCase().replace(/[^A-Z0-9]/g, '')
  dados.ano = vForm.ano ? parseInt(vForm.ano, 10) : null
  dados.aluguel_centavos = centavosDe(vForm.aluguel)
  dados.fipe_centavos = centavosDe(vForm.fipe)
  dados.seguro_valor_centavos = centavosDe(vForm.seguroValor)
  dados.atualizado_em = new Date().toISOString()

  const { error } = await sbClient.from('frota_veiculos').update(dados).eq('id', veiculoAberto.value.id)
  gravando.value = false
  if (error) {
    errosDoVeiculo.value = [/duplicate|unique/i.test(error.message || '')
      ? 'Já existe outro veículo com essa placa.'
      : 'Não consegui gravar. Confira a conexão e tente de novo.']
    return
  }
  fecharVeiculo()
  carregar()
}

// Histórico de manutenção do carro aberto, do mais recente pro mais antigo.
const historicoDoVeiculo = computed(() => {
  if (!veiculoAberto.value) return []
  return revisoes.value
    .filter((r) => r.veiculo_id === veiculoAberto.value.id)
    .slice()
    .sort((a, b) => (b.km ?? 0) - (a.km ?? 0))
})

const novaRevisao = reactive({ item: '', km: '', feita_em: '', oficina: '', custo: '' })

async function gravarRevisao() {
  if (gravando.value || !veiculoAberto.value) return
  const km = parseInt(String(novaRevisao.km).replace(/\D/g, ''), 10)
  if (!novaRevisao.item || !Number.isInteger(km)) {
    errosDoVeiculo.value = ['Escolha o item e informe com quantos quilômetros ele foi trocado.']
    return
  }
  gravando.value = true
  const { error } = await sbClient.from('frota_revisoes').insert({
    veiculo_id: veiculoAberto.value.id,
    item: novaRevisao.item,
    km,
    feita_em: novaRevisao.feita_em || null,
    oficina: novaRevisao.oficina || null,
    custo_centavos: centavosDe(novaRevisao.custo),
  })
  gravando.value = false
  if (error) { errosDoVeiculo.value = ['Não consegui gravar a manutenção.']; return }
  errosDoVeiculo.value = []
  novaRevisao.km = ''; novaRevisao.feita_em = ''; novaRevisao.oficina = ''; novaRevisao.custo = ''
  await carregar()
}

async function apagarRevisao(r) {
  const { error } = await sbClient.from('frota_revisoes').delete().eq('id', r.id)
  if (!error) carregar()
}

onMounted(async () => {
  await carregar()
  // Só depois de saber as permissões dá pra escolher a aba de abertura.
  area.value = areaInicial(pode)
})
</script>

<template>
  <div class="tela-frota">
    <barra-de-topo voltar="Gestão Interna" titulo="Frota" @voltar="voltar" />

    <!-- Duas áreas (D8). Quem só dirige vê uma aba só — e nesse caso a barra
         não aparece: barra de uma aba é enfeite que come altura de tela. -->
    <div class="abas" v-if="abas.length > 1" role="tablist">
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

      <!-- O checklist de hoje, só pra quem tem carro fixo (D6/D9): quem usa
           carro de rodízio o preenche na hora de pegar (F7, tarefa futura). -->
      <PainelDeChecklist
        v-if="meuCarroFixo && !fichaDeHoje"
        :veiculo="meuCarroFixo"
        :itens="itensDeChecklist"
        :config="configDeChecklist"
        :ultima-semanal="ultimaDoTipo(meuCarroFixo.id, 'semanal')"
        :ultima-mensal="ultimaDoTipo(meuCarroFixo.id, 'mensal')"
        :ultimo-km="ultimoHodometro(fichas, meuCarroFixo.id)"
        :hoje="hoje"
        :gravando="gravando"
        @gravar="gravarChecklist" />
      <p class="fr-aviso" v-else-if="meuCarroFixo && fichaDeHoje">
        Checklist de hoje já feito, com {{ fichaDeHoje.hodometro.toLocaleString('pt-BR') }} km.
      </p>
      <p class="fr-erro" v-if="erroChecklist">{{ erroChecklist }}</p>

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
            <div class="fr-acoes">
              <button class="fr-btn primario" v-if="podeEditar" @click="abrirDevolucao(l)">Devolver</button>
              <a v-if="zapDoVeiculo(l.veiculo)" class="fr-btn fr-zap" :href="zapDoVeiculo(l.veiculo)"
               target="_blank" rel="noopener"
               :title="l.veiculo.contato_nome ? ('Falar com ' + l.veiculo.contato_nome + ' no WhatsApp') : 'Falar no WhatsApp'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.47 14.38c-.3-.15-1.74-.86-2-.96-.27-.1-.47-.15-.66.15-.2.29-.76.95-.93 1.15-.17.2-.34.22-.63.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.29-.02-.45.13-.6.13-.13.3-.34.44-.51.15-.17.2-.29.3-.49.1-.2.05-.37-.02-.51-.08-.15-.66-1.59-.9-2.18-.24-.57-.48-.5-.66-.51h-.57c-.2 0-.51.07-.78.37-.27.29-1.02 1-1.02 2.43s1.05 2.82 1.2 3.02c.15.2 2.06 3.14 4.99 4.4.7.3 1.24.48 1.66.62.7.22 1.33.19 1.83.12.56-.08 1.74-.71 1.98-1.4.24-.68.24-1.27.17-1.39-.07-.12-.27-.2-.56-.34M12 2a10 10 0 0 0-8.6 15.1L2 22l5.05-1.32A10 10 0 1 0 12 2"/></svg>
              WhatsApp
            </a>
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
          <div class="fr-acoes">
            <button class="fr-btn primario" v-if="podeEditar" @click="abrirRetirada(l)">Vou usar</button>
            <!-- Pegar agora e reservar pra depois são coisas diferentes. O
                 manual da planilha pede 3 dias de antecedência justamente pra
                 não atropelar viagem de outro departamento. -->
            <button class="fr-btn" v-if="podeEditar" @click="abrirPedido(l.veiculo.id)">Reservar</button>
            <a v-if="zapDoVeiculo(l.veiculo)" class="fr-btn fr-zap" :href="zapDoVeiculo(l.veiculo)"
               target="_blank" rel="noopener"
               :title="l.veiculo.contato_nome ? ('Falar com ' + l.veiculo.contato_nome + ' no WhatsApp') : 'Falar no WhatsApp'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.47 14.38c-.3-.15-1.74-.86-2-.96-.27-.1-.47-.15-.66.15-.2.29-.76.95-.93 1.15-.17.2-.34.22-.63.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.29-.02-.45.13-.6.13-.13.3-.34.44-.51.15-.17.2-.29.3-.49.1-.2.05-.37-.02-.51-.08-.15-.66-1.59-.9-2.18-.24-.57-.48-.5-.66-.51h-.57c-.2 0-.51.07-.78.37-.27.29-1.02 1-1.02 2.43s1.05 2.82 1.2 3.02c.15.2 2.06 3.14 4.99 4.4.7.3 1.24.48 1.66.62.7.22 1.33.19 1.83.12.56-.08 1.74-.71 1.98-1.4.24-.68.24-1.27.17-1.39-.07-.12-.27-.2-.56-.34M12 2a10 10 0 0 0-8.6 15.1L2 22l5.05-1.32A10 10 0 1 0 12 2"/></svg>
              WhatsApp
            </a>
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

    <!-- GESTÃO. `v-else-if` EXPLÍCITO, nunca `v-else` solto: com `v-else` esta
         lista era o fim da corrente que começa lá em cima no "carregando", e
         qualquer aba que não fosse Motorista caía aqui — Revisões e Plano de
         manutenção mostravam a frota inteira em cartões. -->
    <div class="fr-lista" v-else-if="area === 'gestao'">
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

        <!-- Sem "Vou usar" aqui (correção do dono): esta aba é para GERIR a
             frota. Pegar carro é na aba Motorista. -->
        <div class="fr-acoes">
          <button class="fr-btn primario" v-if="podeEditar" @click="abrirVeiculo(l.veiculo)">Abrir ficha</button>
          <button v-if="podeEditar && l.naRua" class="fr-btn" @click="abrirDevolucao(l)">Devolver</button>
          <a v-if="zapDoVeiculo(l.veiculo)" class="fr-btn fr-zap" :href="zapDoVeiculo(l.veiculo)"
               target="_blank" rel="noopener"
               :title="l.veiculo.contato_nome ? ('Falar com ' + l.veiculo.contato_nome + ' no WhatsApp') : 'Falar no WhatsApp'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.47 14.38c-.3-.15-1.74-.86-2-.96-.27-.1-.47-.15-.66.15-.2.29-.76.95-.93 1.15-.17.2-.34.22-.63.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.29-.02-.45.13-.6.13-.13.3-.34.44-.51.15-.17.2-.29.3-.49.1-.2.05-.37-.02-.51-.08-.15-.66-1.59-.9-2.18-.24-.57-.48-.5-.66-.51h-.57c-.2 0-.51.07-.78.37-.27.29-1.02 1-1.02 2.43s1.05 2.82 1.2 3.02c.15.2 2.06 3.14 4.99 4.4.7.3 1.24.48 1.66.62.7.22 1.33.19 1.83.12.56-.08 1.74-.71 1.98-1.4.24-.68.24-1.27.17-1.39-.07-.12-.27-.2-.56-.34M12 2a10 10 0 0 0-8.6 15.1L2 22l5.05-1.32A10 10 0 1 0 12 2"/></svg>
              WhatsApp
            </a>
        </div>
      </div>
    </div>

    <!-- ÁREA REVISÕES: o que está vencendo, e o plano que o dono edita. -->
    <template v-if="area === 'revisoes' && !carregando && !falha">
      <h2 class="fr-secao">Chegando a hora</h2>
      <p class="fr-aviso" v-if="!revisoesPorVeiculo.length">
        Nada vencendo agora. Quando algum carro chegar perto de uma troca, ele aparece aqui —
        o histórico completo de cada um fica na ficha dele, na aba Gestão.
      </p>
      <div class="fr-lista" v-else>
        <div v-for="r in revisoesPorVeiculo" :key="r.linha.veiculo.id"
             class="fr-card" :class="{ espera: r.resumo.nivel === 'perto', ruimzao: r.resumo.nivel === 'vencida' }">
          <div class="fr-card-topo">
            <div class="fr-card-ident">
              <span class="fr-card-nome">{{ r.linha.veiculo.nome }}</span>
              <span class="fr-placa">{{ r.linha.km == null ? 'sem quilometragem' : r.linha.km.toLocaleString('pt-BR') + ' km' }}</span>
            </div>
            <span class="fr-selo"
                  :class="{ ruim: r.resumo.nivel === 'vencida', espera: r.resumo.nivel === 'perto', boa: r.resumo.nivel === 'em-dia' }">
              {{ r.resumo.texto }}
            </span>
          </div>
          <ul class="fr-itens">
            <li v-for="i in r.itens" :key="i.item" :class="i.situacao">
              <span class="fr-item-nome">{{ i.item }}</span>
              <span class="fr-item-txt">{{ i.texto }}</span>
            </li>
          </ul>
          <!-- Falar com a mecânica é o passo seguinte a ver "vencida". O botão
               fica aqui pra não obrigar a abrir a ficha só pra achar o número. -->
          <div class="fr-acoes" v-if="zapDaOficina(r.linha.veiculo, r.linha.km)">
            <a class="fr-btn fr-zap" :href="zapDaOficina(r.linha.veiculo, r.linha.km)" target="_blank" rel="noopener"
               :title="'Falar com ' + (r.linha.veiculo.oficina_nome || 'a oficina') + ' no WhatsApp'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.47 14.38c-.3-.15-1.74-.86-2-.96-.27-.1-.47-.15-.66.15-.2.29-.76.95-.93 1.15-.17.2-.34.22-.63.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.29-.02-.45.13-.6.13-.13.3-.34.44-.51.15-.17.2-.29.3-.49.1-.2.05-.37-.02-.51-.08-.15-.66-1.59-.9-2.18-.24-.57-.48-.5-.66-.51h-.57c-.2 0-.51.07-.78.37-.27.29-1.02 1-1.02 2.43s1.05 2.82 1.2 3.02c.15.2 2.06 3.14 4.99 4.4.7.3 1.24.48 1.66.62.7.22 1.33.19 1.83.12.56-.08 1.74-.71 1.98-1.4.24-.68.24-1.27.17-1.39-.07-.12-.27-.2-.56-.34M12 2a10 10 0 0 0-8.6 15.1L2 22l5.05-1.32A10 10 0 1 0 12 2"/></svg>
              {{ r.linha.veiculo.oficina_nome || 'Oficina' }}
            </a>
          </div>
        </div>
      </div>

    </template>

    <!-- FICHA DO VEÍCULO: tudo do carro num lugar só, e editável. -->
    <div class="fr-ficha-fundo" v-if="veiculoAberto" @click.self="fecharVeiculo">
      <div class="fr-ficha larga" role="dialog">
        <div class="fr-ficha-topo">
          <span class="fr-ficha-titulo">{{ veiculoAberto.nome }} · {{ veiculoAberto.placa }}</span>
          <button class="fr-fechar" @click="fecharVeiculo" aria-label="Fechar">✕</button>
        </div>
        <div class="fr-ficha-corpo">
          <h3 class="fr-grupo">Identificação</h3>
          <div class="fr-dupla">
            <label class="fr-campo"><span class="fr-lab">Nome</span><input v-model="vForm.nome" type="text"></label>
            <label class="fr-campo"><span class="fr-lab">Placa</span><input v-model="vForm.placa" type="text"></label>
            <label class="fr-campo"><span class="fr-lab">Marca</span><input v-model="vForm.marca" type="text"></label>
            <label class="fr-campo"><span class="fr-lab">Ano</span><input v-model="vForm.ano" type="text" inputmode="numeric"></label>
            <label class="fr-campo"><span class="fr-lab">Cor</span><input v-model="vForm.cor" type="text"></label>
            <label class="fr-campo"><span class="fr-lab">Combustível</span><input v-model="vForm.combustivel" type="text"></label>
            <label class="fr-campo"><span class="fr-lab">Renavam</span><input v-model="vForm.renavam" type="text"></label>
            <label class="fr-campo"><span class="fr-lab">Chassi</span><input v-model="vForm.chassi" type="text"></label>
            <label class="fr-campo"><span class="fr-lab">Tipo de óleo</span><input v-model="vForm.tipo_oleo" type="text"></label>
            <label class="fr-campo">
              <span class="fr-lab">Situação</span>
              <select v-model="vForm.situacao">
                <option value="ativo">Ativo</option>
                <option value="em_manutencao">Em manutenção</option>
                <option value="inativo">Parado</option>
                <option value="alienado">Fora da frota</option>
              </select>
            </label>
          </div>

          <h3 class="fr-grupo">Onde está</h3>
          <div class="fr-dupla">
            <label class="fr-campo">
              <span class="fr-lab">Responsável</span>
              <select v-model="vForm.pessoa_id">
                <option value="">— ninguém —</option>
                <option v-for="p in pessoas" :key="p.id" :value="p.id">{{ p.nome }}</option>
              </select>
              <span class="fr-ajuda">Carro com responsável deixa de aparecer como livre para os outros.</span>
            </label>
            <label class="fr-campo">
              <span class="fr-lab">Local</span>
              <input v-model="vForm.local_texto" type="text" placeholder="Barracão, Conchal…">
            </label>
          </div>

          <h3 class="fr-grupo">Contato</h3>
          <div class="fr-dupla">
            <label class="fr-campo"><span class="fr-lab">Quem é</span><input v-model="vForm.contato_nome" type="text" placeholder="JHM Auto Center"></label>
            <label class="fr-campo"><span class="fr-lab">O que faz</span><input v-model="vForm.contato_papel" type="text" placeholder="Oficina, locadora, seguro, guincho…"></label>
            <label class="fr-campo">
              <span class="fr-lab">Telefone</span>
              <input v-model="vForm.contato_telefone" type="tel" inputmode="tel" placeholder="(19) 3033-9837">
              <!-- Diz POR QUE não dá link, em vez de só não mostrar o botão: sem
                   DDD o app se recusa a montar o link, e a pessoa precisa saber
                   que é isso — não que o WhatsApp "não funciona". -->
              <span class="fr-ajuda" v-if="vForm.contato_telefone && !linkDoWhatsapp(vForm.contato_telefone)">
                {{ porQueNaoDaLink(vForm.contato_telefone) }}
              </span>
            </label>
          </div>

          <h3 class="fr-grupo">Contrato e valores</h3>
          <div class="fr-dupla">
            <label class="fr-campo"><span class="fr-lab">Contrato</span><input v-model="vForm.contrato" type="text" placeholder="CTR-007"></label>
            <label class="fr-campo"><span class="fr-lab">Aluguel por mês (R$)</span><input v-model="vForm.aluguel" type="text" inputmode="decimal"></label>
            <label class="fr-campo"><span class="fr-lab">Valor FIPE (R$)</span><input v-model="vForm.fipe" type="text" inputmode="decimal"></label>
            <label class="fr-campo"><span class="fr-lab">Categoria comercial</span><input v-model="vForm.categoria_comercial" type="text"></label>
          </div>

          <h3 class="fr-grupo">Seguro</h3>
          <div class="fr-dupla">
            <label class="fr-campo"><span class="fr-lab">Seguradora</span><input v-model="vForm.seguro_seguradora" type="text"></label>
            <label class="fr-campo"><span class="fr-lab">Apólice</span><input v-model="vForm.seguro_apolice" type="text"></label>
            <label class="fr-campo"><span class="fr-lab">Vence em</span><input v-model="vForm.seguro_vence_em" type="date"></label>
            <label class="fr-campo"><span class="fr-lab">Valor (R$)</span><input v-model="vForm.seguroValor" type="text" inputmode="decimal"></label>
          </div>

          <h3 class="fr-grupo">Oficina</h3>
          <div class="fr-dupla">
            <label class="fr-campo"><span class="fr-lab">Mecânica</span><input v-model="vForm.oficina_nome" type="text" placeholder="JHM Auto Center"></label>
            <label class="fr-campo">
              <span class="fr-lab">Telefone da oficina</span>
              <input v-model="vForm.oficina_telefone" type="tel" inputmode="tel" placeholder="(19) 3033-9837">
              <span class="fr-ajuda" v-if="vForm.oficina_telefone && !linkDoWhatsapp(vForm.oficina_telefone)">
                {{ porQueNaoDaLink(vForm.oficina_telefone) }}
              </span>
            </label>
          </div>

          <h3 class="fr-grupo">Equipamentos e patrimônio</h3>
          <div class="fr-dupla">
            <label class="fr-campo"><span class="fr-lab">Tag de pedágio</span><input v-model="vForm.tag_pedagio" type="text" placeholder="Sem Parar, número da tag…"></label>
            <label class="fr-campo"><span class="fr-lab">Rastreador</span><input v-model="vForm.rastreador" type="text" placeholder="empresa, identificador…"></label>
            <label class="fr-campo"><span class="fr-lab">Código patrimonial</span><input v-model="vForm.codigo_patrimonial" type="text" placeholder="RBB-007"></label>
            <label class="fr-campo">
              <span class="fr-lab">Bem no Patrimônio</span>
              <select v-model="vForm.bem_id">
                <option value="">— não ligado —</option>
                <option v-for="b in bensVeiculo" :key="b.id" :value="b.id">
                  {{ b.numero ? String(b.numero).padStart(6, '0') + ' · ' : '' }}{{ b.nome }}
                </option>
              </select>
              <span class="fr-ajuda">Só para carro próprio. Os alugados não são bens da empresa.</span>
            </label>
          </div>

          <label class="fr-campo">
            <span class="fr-lab">Observação</span>
            <input v-model="vForm.observacao" type="text">
          </label>

          <h3 class="fr-grupo">Histórico de manutenção</h3>
          <ul class="fr-hist" v-if="historicoDoVeiculo.length">
            <li v-for="h in historicoDoVeiculo" :key="h.id">
              <span class="fr-item-nome">{{ h.item }}</span>
              <span class="fr-item-txt">
                {{ h.km ? h.km.toLocaleString('pt-BR') + ' km' : 'sem km' }}
                <template v-if="h.feita_em"> · {{ h.feita_em.split('-').reverse().join('/') }}</template>
                <template v-if="h.oficina"> · {{ h.oficina }}</template>
              </span>
              <button class="fr-mini" @click="apagarRevisao(h)" title="Apagar este registro">✕</button>
            </li>
          </ul>
          <p class="fr-ajuda" v-else>Nenhuma manutenção registrada neste carro ainda.</p>

          <div class="fr-dupla">
            <label class="fr-campo">
              <span class="fr-lab">O que foi feito</span>
              <select v-model="novaRevisao.item">
                <option v-for="p in plano" :key="p.id" :value="p.item">{{ p.item }}</option>
              </select>
            </label>
            <label class="fr-campo"><span class="fr-lab">Com quantos km</span><input v-model="novaRevisao.km" type="text" inputmode="numeric"></label>
            <label class="fr-campo"><span class="fr-lab">Quando</span><input v-model="novaRevisao.feita_em" type="date"></label>
            <label class="fr-campo"><span class="fr-lab">Oficina</span><input v-model="novaRevisao.oficina" type="text"></label>
            <label class="fr-campo"><span class="fr-lab">Custo (R$)</span><input v-model="novaRevisao.custo" type="text" inputmode="decimal"></label>
          </div>
          <div class="fr-acoes">
            <button class="fr-btn" :disabled="gravando" @click="gravarRevisao">+ Registrar manutenção</button>
          </div>

          <ul class="fr-problemas" v-if="errosDoVeiculo.length">
            <li v-for="(e, i) in errosDoVeiculo" :key="i">{{ e }}</li>
          </ul>
        </div>
        <div class="fr-ficha-rodape">
          <button class="fr-btn" @click="fecharVeiculo">Fechar</button>
          <button class="fr-btn primario" :disabled="gravando" @click="salvarVeiculo">
            {{ gravando ? 'Gravando…' : 'Gravar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ABA PLANO DE MANUTENÇÃO: os limiares que geram os avisos da aba
         Revisões. Ficava no rodapé daquela aba e o dono não achava — virou aba
         com nome próprio. -->
    <template v-if="area === 'plano' && !carregando && !falha">
      <h2 class="fr-secao">Plano de manutenção — de quantos em quantos quilômetros</h2>
      <p class="fr-aviso">
        Estes números são os que geram os avisos acima. Mude quando o mecânico mandar,
        e acrescente o que faltar.
      </p>
      <ul class="fr-pedidos">
        <li v-for="p in plano" :key="p.id" class="fr-pedido" :class="{ desligado: !p.ativo }">
          <div class="fr-pedido-topo">
            <strong>{{ p.item }}</strong>
            <span class="fr-item-km">{{ p.a_cada_km.toLocaleString('pt-BR') }} km</span>
          </div>
          <div class="fr-pedido-quando" v-if="p.observacao">{{ p.observacao }}</div>
          <div class="fr-acoes">
            <button class="fr-btn" @click="abrirItem(p)">Editar</button>
            <button class="fr-btn" @click="alternarItem(p)">{{ p.ativo ? 'Desativar' : 'Reativar' }}</button>
          </div>
        </li>
      </ul>
      <div class="fr-acoes" style="padding:12px 14px 40px">
        <button class="fr-btn primario" @click="abrirItem(null)">+ Acrescentar item</button>
      </div>
    </template>

    <!-- EDITOR DE UM ITEM DO PLANO -->
    <div class="fr-ficha-fundo" v-if="itemEmEdicao" @click.self="fecharItem">
      <div class="fr-ficha" role="dialog">
        <div class="fr-ficha-topo">
          <span class="fr-ficha-titulo">{{ itemEmEdicao.novo ? 'Novo item de revisão' : 'Editar item' }}</span>
          <button class="fr-fechar" @click="fecharItem" aria-label="Fechar">✕</button>
        </div>
        <div class="fr-ficha-corpo">
          <label class="fr-campo">
            <span class="fr-lab">O que se troca</span>
            <input v-model="itemForm.item" type="text" placeholder="Filtro de ar, fluido de freio…">
          </label>
          <label class="fr-campo">
            <span class="fr-lab">A cada quantos quilômetros</span>
            <input v-model="itemForm.aCadaKm" type="text" inputmode="numeric" placeholder="20000">
            <span class="fr-ajuda">O aviso começa quando faltarem 10% disso.</span>
          </label>
          <label class="fr-campo">
            <span class="fr-lab">Observação</span>
            <input v-model="itemForm.observacao" type="text" placeholder="opcional">
          </label>
          <p class="fr-ajuda" v-if="itemEmEdicao.ativo === false">{{ avisoAoDesativar(itemEmEdicao.item) }}</p>
          <ul class="fr-problemas" v-if="errosDoItem.length">
            <li v-for="(e, i) in errosDoItem" :key="i">{{ e }}</li>
          </ul>
        </div>
        <div class="fr-ficha-rodape">
          <button class="fr-btn" @click="fecharItem">Cancelar</button>
          <button class="fr-btn primario" :disabled="gravando" @click="salvarItem">
            {{ gravando ? 'Gravando…' : 'Gravar' }}
          </button>
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
.tela-frota .fr-card.ruimzao{border-left-color:var(--red,#c0392b);}
.tela-frota .fr-itens{margin:12px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px;}
.tela-frota .fr-itens li{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-family:var(--fonte-principal);font-size:12.5px;color:var(--muted);padding-left:10px;border-left:2px solid var(--border);}
/* A cor fica na BORDA, não no texto: item vencido em vermelho sobre fundo
   claro e escuro fica ilegível num dos dois temas. */
.tela-frota .fr-itens li.vencida{border-left-color:var(--red,#c0392b);}
.tela-frota .fr-itens li.perto{border-left-color:var(--orange,#d97706);}
.tela-frota .fr-itens li.em-dia{border-left-color:var(--green,#16a34a);}
.tela-frota .fr-item-nome{color:var(--text);font-weight:600;}
.tela-frota .fr-item-txt{font-variant-numeric:tabular-nums;}
.tela-frota .fr-item-km{font-family:var(--fonte-dados);font-size:12.5px;font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums;}
.tela-frota .fr-pedido.desligado{opacity:.5;}
/* A ficha do veículo é longa: no computador ela abre mais larga e os campos
   ficam em duas colunas, pra não virar um rolo de 40 linhas. */
.tela-frota .fr-ficha.larga{max-width:720px;}
.tela-frota .fr-grupo{margin:6px 0 2px;font-family:var(--fonte-principal);font-size:10px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:var(--accent);}
.tela-frota .fr-dupla{display:grid;grid-template-columns:1fr;gap:12px;}
@media(min-width:560px){ .tela-frota .fr-dupla{grid-template-columns:1fr 1fr;} }
.tela-frota .fr-hist{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px;}
.tela-frota .fr-hist li{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 10px;background:var(--surface2,var(--surface));border:1px solid var(--border);border-radius:9px;font-family:var(--fonte-principal);font-size:12.5px;color:var(--muted);}
.tela-frota .fr-hist .fr-item-txt{flex:1;min-width:0;}
.tela-frota .fr-mini{appearance:none;border:1px solid var(--border);background:none;color:var(--muted);border-radius:7px;width:28px;height:28px;font-size:12px;cursor:pointer;flex:0 0 auto;}
.tela-frota .fr-mini:hover{border-color:var(--red,#c0392b);color:var(--red,#c0392b);}
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
/* Verde do WhatsApp, que e como as pessoas reconhecem o botao sem ler. */
.tela-frota .fr-zap{display:inline-flex;align-items:center;justify-content:center;gap:7px;text-decoration:none;border-color:#25d366;color:#128c4a;}
.tela-frota .fr-zap:hover{background:color-mix(in srgb,#25d366 12%,transparent);}
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
