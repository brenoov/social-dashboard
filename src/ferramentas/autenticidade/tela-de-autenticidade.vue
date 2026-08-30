<template>
  <div class="tela-autenticidade">
    <barra-de-topo voltar="Gestão Interna" titulo="Autenticidade e Garantia" @voltar="voltar" />

    <div class="abas" role="tablist">
      <button v-for="ab in ABAS" :key="ab.chave" role="tab" type="button"
              :class="{ on: aba === ab.chave }" @click="aba = ab.chave">{{ ab.rotulo }}</button>
    </div>

    <p v-if="carregando" class="au-vazio">Carregando…</p>
    <p v-else-if="falha" class="au-erro">{{ falha }}</p>

    <!-- ── LOTES ────────────────────────────────────────────────────────── -->
    <template v-else-if="aba === 'lotes'">
      <div class="au-topo-acao" v-if="podeCriar">
        <button class="au-botao" type="button" @click="abrirFormulario">Gerar lote de etiquetas</button>
      </div>

      <p v-if="!lotes.length" class="au-vazio">
        Nenhum lote criado ainda. Um lote é uma fornada de bolsas do mesmo modelo — cada
        peça sai com o seu próprio código.
      </p>

      <div class="au-lista">
        <div v-for="l in lotes" :key="l.id" class="au-card">
          <div class="au-card-topo">
            <span class="au-modelo">{{ l.modelo }}</span>
            <span class="au-progresso">{{ progressoDoLote(pecasDoLote(l.id)).texto }} gravadas</span>
          </div>
          <div class="au-card-linha">
            <span v-if="l.cor">{{ l.cor }}</span>
            <span v-if="l.sku" class="au-ref">ref. {{ l.sku }}</span>
            <span>{{ l.quantidade }} {{ l.quantidade === 1 ? 'peça' : 'peças' }}</span>
            <span>{{ dataCurta(l.fabricado_em) }}</span>
          </div>
          <button class="au-link" type="button" @click="irGravar(l.id)">Gravar as etiquetas deste lote →</button>
        </div>
      </div>
    </template>

    <!-- ── GRAVAR ───────────────────────────────────────────────────────── -->
    <template v-else-if="aba === 'gravar'">
      <!-- O PASSO A PASSO. Ele existe porque o dono abriu a tela pronta e disse
           "ficou muito mal explicado": ela dizia "Crie um lote", "Gravei essa" e
           mais nada. Aqui a etapa de agora fica aberta e as outras recolhidas —
           quem já sabe o caminho passa direto, quem não sabe é conduzido. -->
      <ol class="au-passos">
        <li v-for="p in PASSOS" :key="p.n"
            :class="['au-passo-item', { agora: p.n === passo, feito: p.n < passo }]">
          <span class="au-passo-n" aria-hidden="true">{{ p.n }}</span>
          <div class="au-passo-txt">
            <strong>{{ p.titulo }}</strong>
            <span v-if="p.n === passo" class="au-passo-resumo">{{ p.resumo }}</span>
          </div>
        </li>
      </ol>
      <p class="au-rever">
        <button class="au-link" type="button" @click="abrirGuia">Rever o passo a passo completo</button>
      </p>

      <p v-if="!lotes.length" class="au-vazio">
        Ainda não existe lote. Um lote é uma fornada de bolsas do mesmo modelo, e cada
        bolsa dele ganha um código diferente. Abra a aba <strong>Lotes</strong> para criar o primeiro.
      </p>

      <template v-else>
        <label class="au-campo">
          <span class="au-rot">Lote</span>
          <!-- travado durante a gravação: trocar de lote no meio dos 8 segundos
               era o caminho que gravava uma peça e marcava outra -->
          <select v-model="loteEscolhido" :disabled="gravando">
            <option v-for="l in lotes" :key="l.id" :value="l.id">
              {{ l.modelo }}<span v-if="l.cor"> · {{ l.cor }}</span> — {{ progressoDoLote(pecasDoLote(l.id)).texto }}
            </option>
          </select>
        </label>

        <p v-if="!proxima" class="au-pronto">
          Todas as etiquetas deste lote já foram gravadas. Nada a fazer aqui.
        </p>

        <div v-else class="au-gravacao">
          <p class="au-passo">
            Peça {{ proxima.numero_na_serie }} de {{ loteAtual?.quantidade }} ·
            {{ progressoDoLote(pecasDoLote(loteEscolhido)).texto }} prontas
          </p>

          <p class="au-instrucao">
            A etiqueta vai costurada no forro interno, longe de fecho, rebite e corrente:
            NFC não funciona encostado em metal.
          </p>

          <!-- MODO NFC: só existe onde o navegador grava (Chrome no Android) -->
          <template v-if="gravaPorNfc">
            <div class="au-endereco">{{ enderecoDaTag(proxima.codigo) }}</div>
            <p v-if="recadoNfc" class="au-recado-nfc">{{ recadoNfc }}</p>
            <div class="au-acoes">
              <button class="au-botao" type="button" :disabled="gravando || !podeEditar"
                      @click="gravarNaEtiqueta">
                {{ gravando ? 'Encoste a etiqueta…' : 'Gravar nesta etiqueta' }}
              </button>
              <!-- travado durante a gravação: o recado (inclusive o "PARE: esta
                   etiqueta já tem OUTRA peça") só existe dentro deste v-if, e
                   trocar de modo no meio o faria sumir -->
              <button class="au-botao secundario" type="button" :disabled="gravando"
                      @click="gravaPorNfc = false">
                Gravar pelo aplicativo
              </button>
            </div>
            <label class="au-trava">
              <input type="checkbox" v-model="travarDepois">
              <span>Travar a etiqueta depois de gravar — <strong>não tem volta</strong></span>
            </label>
          </template>

          <!-- MODO DE HOJE: iPhone, computador, ou quem preferir o aplicativo -->
          <template v-else>
            <p class="au-instrucao">
              Copie o endereço abaixo e grave na etiqueta pelo aplicativo do celular.
              Depois toque em “Gravei essa” — é isso que impede de perder a conta no meio
              de {{ loteAtual?.quantidade }} etiquetas iguais.
            </p>
            <div class="au-endereco">{{ enderecoDaTag(proxima.codigo) }}</div>
            <div class="au-acoes">
              <button class="au-botao secundario" type="button" @click="copiar">{{ textoCopiar }}</button>
              <!-- `marcarGravada()` com os parênteses: sem eles o @click passaria o
                   evento do clique no lugar do código da peça -->
              <button class="au-botao" type="button" v-if="podeEditar" @click="marcarGravada()">✓ Gravei essa</button>
              <button v-if="temSuporte()" class="au-botao secundario" type="button" @click="gravaPorNfc = true">
                Gravar encostando o celular
              </button>
            </div>
          </template>

          <!-- GRAVADOR DE MESA -->
          <details class="au-mesa">
            <!-- A seta é desenhada aqui porque `display:flex` no <summary> apaga o
                 triângulo que o Chrome desenha sozinho — e o triângulo era a única
                 pista de que esta gaveta abre. Em SVG, nunca emoji. -->
            <summary>
              <svg class="au-seta" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"
                   fill="none" stroke="currentColor" stroke-width="2.4"
                   stroke-linecap="round" stroke-linejoin="round"><polyline points="9 5 16 12 9 19" /></svg>
              <span>Gravador de mesa</span>
            </summary>
            <button class="au-botao secundario" type="button" @click="baixarListaDoGravador">
              Baixar a lista das que faltam
            </button>
            <textarea v-model="textoDoGravador" class="au-colar"
                      placeholder="Cole aqui o que o gravador devolveu"></textarea>
            <button v-if="podeEditar && !confirmacaoDoGravador" class="au-botao" type="button"
                    @click="pedirParaMarcarPeloGravador">
              Marcar as gravadas
            </button>
            <div v-if="podeEditar && confirmacaoDoGravador" class="au-confirma">
              <p class="au-confirma-texto">
                Marcar {{ confirmacaoDoGravador.reconhecidos.length }} peça(s) como gravadas?
                Isso não confere etiqueta nenhuma — só use depois de gravar de verdade
                no gravador de mesa.
              </p>
              <div class="au-acoes">
                <button class="au-botao secundario" type="button"
                        @click="confirmacaoDoGravador = null">Cancelar</button>
                <button class="au-botao" type="button" @click="marcarPeloGravador">
                  Sim, marcar
                </button>
              </div>
            </div>
          </details>
        </div>
      </template>
    </template>

    <!-- ── O GUIA DA PRIMEIRA VEZ ──────────────────────────────────────────
         Abre sozinho na primeira visita e some depois. O "pular" fica sempre
         visível: guia que prende a pessoa vira estorvo, não ajuda. -->
    <div v-if="guiaAberto" class="au-guia-fundo" role="dialog" aria-modal="true"
         aria-label="Como gravar as etiquetas">
      <div class="au-guia">
        <p class="au-guia-conta">{{ telaDoGuia + 1 }} de {{ TELAS_DO_GUIA.length }}</p>
        <h3 class="au-guia-titulo">{{ TELAS_DO_GUIA[telaDoGuia].titulo }}</h3>
        <p class="au-guia-texto">{{ TELAS_DO_GUIA[telaDoGuia].texto }}</p>
        <div class="au-guia-acoes">
          <button class="au-botao secundario" type="button" @click="fecharGuia">Pular</button>
          <button class="au-botao" type="button" @click="avancarGuia">
            {{ telaDoGuia + 1 === TELAS_DO_GUIA.length ? 'Entendi, começar' : 'Continuar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── REGISTROS ────────────────────────────────────────────────────── -->
    <template v-else-if="aba === 'registros'">
      <div class="au-topo-acao">
        <input v-model="busca" class="au-busca" type="search" placeholder="Buscar por nome ou código">
        <button class="au-botao secundario" type="button" v-if="registros.length" @click="baixarPlanilha">
          Baixar planilha
        </button>
      </div>

      <p v-if="!registros.length" class="au-vazio">
        Nenhuma cliente registrou a garantia ainda.
      </p>
      <p v-else-if="!registrosFiltrados.length" class="au-vazio">
        Nada encontrado para “{{ busca }}”.
      </p>

      <div class="au-lista">
        <div v-for="r in registrosFiltrados" :key="r.codigo" class="au-card">
          <div class="au-card-topo">
            <span class="au-modelo">{{ r.nome }}</span>
            <span class="au-progresso">até {{ dataCurta(r.garantia_ate) }}</span>
          </div>
          <div class="au-card-linha">
            <span class="au-ref">{{ r.codigo }}</span>
            <span>{{ r.whatsapp }}</span>
            <span v-if="r.onde_comprou">{{ r.onde_comprou }}</span>
            <span v-if="r.comprado_em">comprou {{ dataCurta(r.comprado_em) }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- ── ALERTAS ──────────────────────────────────────────────────────── -->
    <template v-else>
      <p class="au-instrucao">
        A etiqueta guarda um endereço, e endereço se copia — por isso a etiqueta sozinha
        não impede falsificação. O que denuncia a cópia é o mesmo código sendo lido de
        muitos aparelhos diferentes, ou alguém tentando adivinhar códigos.
      </p>

      <p v-if="resumo.limpo" class="au-pronto">
        Nada suspeito nos últimos 30 dias. Foram {{ alertas?.total_leituras || 0 }} leituras.
      </p>

      <template v-else>
        <h2 class="au-secao" v-if="resumo.repetidas">Peças lidas de muitos aparelhos</h2>
        <div class="au-lista">
          <div v-for="a in (alertas?.repetidas || [])" :key="a.codigo" class="au-card alerta">
            <div class="au-card-topo">
              <span class="au-modelo">{{ a.codigo }}</span>
              <span class="au-progresso">{{ a.aparelhos }} aparelhos</span>
            </div>
            <div class="au-card-linha">
              <span>{{ a.leituras }} leituras</span>
              <span>última em {{ dataCurta(a.ultima) }}</span>
            </div>
          </div>
        </div>

        <h2 class="au-secao" v-if="resumo.invalidas">Códigos que não existem, tentados</h2>
        <div class="au-lista">
          <div v-for="a in (alertas?.invalidas || [])" :key="a.codigo" class="au-card alerta">
            <div class="au-card-topo">
              <span class="au-modelo">{{ a.codigo }}</span>
              <span class="au-progresso">{{ a.tentativas }} tentativas</span>
            </div>
            <div class="au-card-linha"><span>última em {{ dataCurta(a.ultima) }}</span></div>
          </div>
        </div>
      </template>
    </template>

    <!-- ── FORMULÁRIO DE LOTE ───────────────────────────────────────────── -->
    <div v-if="formulario" class="au-fundo" @click.self="formulario = false">
      <form class="au-folha" @submit.prevent="gerarLote">
        <h2>Gerar lote de etiquetas</h2>
        <p class="au-instrucao">
          Um código diferente para cada peça. Depois de criar, a aba “Gravar” conduz
          etiqueta por etiqueta.
        </p>

        <label class="au-campo"><span class="au-rot">Modelo</span>
          <input v-model="novo.modelo" type="text" maxlength="80" required placeholder="Mônaco"></label>
        <label class="au-campo"><span class="au-rot">Cor</span>
          <input v-model="novo.cor" type="text" maxlength="60" placeholder="Quartz"></label>
        <label class="au-campo"><span class="au-rot">Referência</span>
          <input v-model="novo.sku" type="text" maxlength="40" placeholder="LV1021"></label>
        <label class="au-campo"><span class="au-rot">Quantidade de peças</span>
          <input v-model.number="novo.quantidade" type="number" min="1" max="500" required></label>
        <label class="au-campo"><span class="au-rot">Data de fabricação</span>
          <input v-model="novo.fabricado_em" type="date"></label>

        <p class="au-erro" v-if="erroForm">{{ erroForm }}</p>

        <div class="au-acoes">
          <button class="au-botao secundario" type="button" @click="formulario = false">Cancelar</button>
          <button class="au-botao" type="submit" :disabled="salvando">
            {{ salvando ? 'Gerando…' : 'Gerar' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
/*
 * Painel do Selo Vessel — o lado de dentro da página pública /verify.
 *
 * A tela não inventa código nenhum: quem sorteia é o banco (vessel_gerar_lote),
 * porque a garantia de "nenhum código repetido" é da chave primária. Ver
 * db/migrations/2026-08-05-vessel-painel.sql.
 */
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import BarraDeTopo from '../../compartilhado/barra-de-topo.vue'
import { sbClient } from '../../compartilhado/conectar-no-banco-de-dados.js'
import { hasPermission } from '../../compartilhado/controle-de-login-e-usuario.js'
import { adminToast } from '../../compartilhado/avisos.js'
import { enderecoDaTag, progressoDoLote, proximaPorGravar, linhasDoCsv, resumoDeAlertas } from './lotes.js'
import { conferirLeitura, listaParaGravadorDeMesa, codigosNoTextoDoGravador } from './nfc-fila.js'
import { PASSOS, TELAS_DO_GUIA, passoAtual, guiaJaVisto, marcarGuiaVisto, proximaTelaDoGuia } from './tutorial.js'
import { temSuporte, traduzirFalha, criarGravador } from './gravador-nfc.js'

const ABAS = [
  { chave: 'lotes', rotulo: 'Lotes' },
  { chave: 'gravar', rotulo: 'Gravar' },
  { chave: 'registros', rotulo: 'Registros' },
  { chave: 'alertas', rotulo: 'Alertas' },
]

const router = useRouter()
const aba = ref('lotes')
const carregando = ref(true)
const falha = ref('')

const lotes = ref([])
const pecas = ref([])
const registros = ref([])
const alertas = ref(null)

const loteEscolhido = ref('')
const busca = ref('')
const formulario = ref(false)
const salvando = ref(false)
const erroForm = ref('')
const textoCopiar = ref('Copiar endereço')

// Chrome no Android grava NFC pelo navegador; iPhone e computador não. Quem
// não grava cai no modo de hoje, que continua inteiro logo abaixo.
const gravaPorNfc = ref(temSuporte())
const travarDepois = ref(false)            // ⚠️ PERMANENTE — nasce desligado

// ── O TUTORIAL ────────────────────────────────────────────────────────────
// O passo a passo fica sempre na tela; o guia abre uma vez só. O "já vi" mora
// no aparelho e não no banco: é conveniência de quem está usando, não dado da
// empresa. Quem trocar de celular vê de novo, e tudo bem.
const passo = computed(() => passoAtual({
  temLote: Boolean(loteEscolhido.value),
  pecas: pecasDoLote(loteEscolhido.value),
}))
const guiaAberto = ref(false)
const telaDoGuia = ref(0)

function abrirGuia() { telaDoGuia.value = 0; guiaAberto.value = true }
function fecharGuia() { guiaAberto.value = false; marcarGuiaVisto() }
function avancarGuia() {
  const proxima = proximaTelaDoGuia(telaDoGuia.value)
  if (proxima === null) fecharGuia()
  else telaDoGuia.value = proxima
}
const gravando = ref(false)
const recadoNfc = ref('')
const textoDoGravador = ref('')
const confirmacaoDoGravador = ref(null)  // { reconhecidos, ignorados } enquanto a pergunta está na tela

const novo = reactive({ modelo: '', cor: '', sku: '', quantidade: 20, fabricado_em: '' })

const podeCriar = computed(() => hasPermission('autenticidade', 'criar'))
const podeEditar = computed(() => hasPermission('autenticidade', 'editar'))

const pecasDoLote = (id) => pecas.value.filter((p) => p.lote_id === id)
const loteAtual = computed(() => lotes.value.find((l) => l.id === loteEscolhido.value) || null)
const proxima = computed(() => proximaPorGravar(pecasDoLote(loteEscolhido.value)))
const resumo = computed(() => resumoDeAlertas(alertas.value))

const registrosFiltrados = computed(() => {
  const termo = busca.value.trim().toLowerCase()
  if (!termo) return registros.value
  return registros.value.filter((r) =>
    (r.nome || '').toLowerCase().includes(termo) || (r.codigo || '').toLowerCase().includes(termo))
})

// Data sempre no fuso de São Paulo: o banco guarda em UTC, e sem isso um
// registro feito às 22h aparece com a data do dia seguinte.
function dataCurta(valor) {
  if (!valor) return '—'
  const d = new Date(String(valor).length === 10 ? `${valor}T12:00:00Z` : valor)
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(d)
}

// TROCAR DE LOTE APAGA OS RECADOS DO LOTE ANTERIOR.
// Os dois falam de uma peça específica: o `recadoNfc` (inclusive o "PARE: esta
// etiqueta já tem OUTRA peça gravada") e a pergunta do gravador de mesa, que já
// carrega a lista de códigos contada. Deixados na tela sob um lote novo, viram
// aviso do lote errado — e aviso do lote errado é pior que aviso nenhum.
// O seletor fica travado enquanto `gravando`, então isto nunca apaga o recado
// de uma gravação em curso.
watch(loteEscolhido, () => {
  recadoNfc.value = ''
  confirmacaoDoGravador.value = null
})

function voltar() { router.push({ name: 'gestao-interna' }) }

function irGravar(id) {
  loteEscolhido.value = id
  aba.value = 'gravar'
}

function abrirFormulario() {
  erroForm.value = ''
  formulario.value = true
}

async function carregar() {
  carregando.value = true
  falha.value = ''
  try {
    const [l, p, r, a] = await Promise.all([
      sbClient.from('vessel_lotes').select('*').order('criado_em', { ascending: false }),
      sbClient.from('vessel_pecas').select('codigo,lote_id,numero_na_serie,gravada_em'),
      sbClient.from('vessel_registros').select('*').order('registrado_em', { ascending: false }),
      sbClient.rpc('vessel_alertas'),
    ])
    if (l.error) throw l.error
    lotes.value = l.data || []
    pecas.value = p.data || []
    registros.value = r.data || []
    alertas.value = a.data || null
    if (!loteEscolhido.value && lotes.value.length) loteEscolhido.value = lotes.value[0].id
  } catch (e) {
    falha.value = 'Não consegui carregar. Confira sua conexão e tente de novo.'
  } finally {
    carregando.value = false
  }
}

async function gerarLote() {
  erroForm.value = ''
  if (!novo.modelo.trim()) { erroForm.value = 'Escreva o modelo da bolsa.'; return }
  if (!(novo.quantidade >= 1 && novo.quantidade <= 500)) {
    erroForm.value = 'A quantidade precisa ser de 1 a 500 peças.'; return
  }
  salvando.value = true
  try {
    const { data, error } = await sbClient.rpc('vessel_gerar_lote', {
      p_modelo: novo.modelo, p_cor: novo.cor, p_sku: novo.sku,
      p_quantidade: novo.quantidade,
      p_fabricado_em: novo.fabricado_em || null,
      p_fotos: null,
    })
    if (error) throw error
    if (!data?.ok) {
      erroForm.value = data?.motivo === 'sem_permissao'
        ? 'Você não tem permissão para gerar lotes.'
        : 'Não consegui gerar. Confira os dados.'
      return
    }
    formulario.value = false
    adminToast(`Lote criado com ${novo.quantidade} códigos`)
    novo.modelo = ''; novo.cor = ''; novo.sku = ''; novo.quantidade = 20; novo.fabricado_em = ''
    await carregar()
    irGravar(data.lote_id)
  } catch (e) {
    erroForm.value = 'Não consegui gerar o lote agora. Tente de novo.'
  } finally {
    salvando.value = false
  }
}

async function copiar() {
  if (!proxima.value) return
  try {
    await navigator.clipboard.writeText(enderecoDaTag(proxima.value.codigo))
    textoCopiar.value = 'Copiado!'
    setTimeout(() => { textoCopiar.value = 'Copiar endereço' }, 1800)
  } catch (e) {
    adminToast('Não consegui copiar — selecione o endereço na mão', false)
  }
}

// O CÓDIGO ENTRA POR ARGUMENTO, e isto não é preferência de estilo.
// `gravarNaEtiqueta` escolhe a peça no começo e leva até 8 segundos com o
// "Encoste a etiqueta…" na tela. Relendo `proxima.value` aqui no fim, quem
// trocasse de lote no meio gravava a etiqueta do lote A e marcava como pronta a
// peça do lote B — e a bolsa B saía da fábrica marcada como pronta com a
// etiqueta em branco costurada dentro. A leitura de volta não protegia nada
// nesse caminho: conferia A e marcava B.
//
// Devolve `true` só quando o banco confirmou. Quem chama decide o que dizer —
// recado de "pronta" sem marcação é a mesma mentira que a tela não conta.
async function marcarGravada(codigo = proxima.value?.codigo) {
  if (!codigo) return false
  try {
    const { data, error } = await sbClient.rpc('vessel_marcar_gravada', { p_codigo: codigo })
    if (error) throw error
    if (!data?.ok) { adminToast('Sem permissão para marcar', false); return false }
    // atualiza só a peça, sem recarregar tudo: a equipe está gravando em
    // sequência e uma recarga inteira a cada etiqueta trava o ritmo
    const alvo = pecas.value.find((p) => p.codigo === codigo)
    if (alvo) alvo.gravada_em = new Date().toISOString()
    textoCopiar.value = 'Copiar endereço'
    return true
  } catch (e) {
    adminToast('Não consegui marcar agora', false)
    return false
  }
}

// A REGRA INTEIRA ESTÁ AQUI: lê antes, grava, lê depois, e só então marca.
// Marcar porque o `write` não deu erro é marcar no escuro — e no escuro a peça
// entra como pronta com a etiqueta em branco costurada dentro da bolsa.
async function gravarNaEtiqueta() {
  const peca = proxima.value
  if (!peca || gravando.value) return
  const gravador = criarGravador()
  if (!gravador) { gravaPorNfc.value = false; return }

  gravando.value = true
  recadoNfc.value = 'Encoste a etiqueta no celular e segure parado…'
  try {
    // 1. LER ANTES: etiqueta com outra peça não pode ser sobrescrita
    const antes = await gravador.lerUmaVez()
    const situacao = conferirLeitura(antes, peca.codigo)
    if (situacao === 'outra-peca') {
      recadoNfc.value = 'PARE: esta etiqueta já tem OUTRA peça gravada. '
        + 'Separe ela e pegue uma etiqueta em branco.'
      return
    }
    if (situacao === 'confere') {
      // já estava gravada com esta peça: marca sem regravar
      recadoNfc.value = await marcarGravada(peca.codigo)
        ? 'Esta etiqueta já estava certa. Marquei e passei para a próxima.'
        : 'Esta etiqueta já estava certa, mas não consegui marcar a peça. Encoste de novo.'
      return
    }

    // 2. GRAVAR
    recadoNfc.value = 'Gravando… não tire o celular.'
    await gravador.gravar(enderecoDaTag(peca.codigo))

    // 3. LER DEPOIS: a prova de que gravou é a etiqueta devolver
    const depois = await gravador.lerUmaVez()
    if (conferirLeitura(depois, peca.codigo) !== 'confere') {
      recadoNfc.value = 'Gravei, mas a etiqueta não devolveu o endereço certo. '
        + 'Não marquei a peça. Encoste de novo.'
      return
    }

    if (travarDepois.value) await gravador.travar()
    recadoNfc.value = await marcarGravada(peca.codigo)
      ? `Peça ${peca.numero_na_serie} pronta. Pegue a próxima etiqueta.`
      : `Gravei a etiqueta da peça ${peca.numero_na_serie}, mas não consegui marcá-la `
        + 'como pronta. NÃO pegue outra etiqueta: encoste esta de novo.'
  } catch (erro) {
    recadoNfc.value = traduzirFalha(erro)
  } finally {
    gravando.value = false
  }
}

// ── O GRAVADOR DE MESA: a mesma fila, de ida e de volta ────────────────────

function baixarListaDoGravador() {
  const lista = listaParaGravadorDeMesa(pecasDoLote(loteEscolhido.value))
  if (!lista) { adminToast('Não falta nenhuma etiqueta neste lote', false); return }
  const url = URL.createObjectURL(new Blob([lista], { type: 'text/plain;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `etiquetas-${loteAtual.value?.modelo || 'lote'}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

// ESTE É O ÚNICO CAMINHO QUE MARCA PEÇA SEM CONFERIR ETIQUETA NENHUMA.
// `codigosNoTextoDoGravador` aceita qualquer texto que contenha os códigos —
// colar de volta o próprio arquivo que acabou de ser baixado marcaria o lote
// inteiro num clique, sem nenhuma etiqueta ter sido tocada. Por isso passa por
// uma pergunta que diz o número e diz o que NÃO foi conferido.
function pedirParaMarcarPeloGravador() {
  const { reconhecidos, ignorados } = codigosNoTextoDoGravador(
    textoDoGravador.value, pecasDoLote(loteEscolhido.value))
  if (!reconhecidos.length) {
    adminToast('Não achei nenhum código deste lote no texto colado', false)
    return
  }
  // guarda o que foi contado: é exatamente isso que a pergunta promete marcar,
  // mesmo que alguém mexa na caixa de colar antes de responder
  confirmacaoDoGravador.value = { reconhecidos, ignorados }
}

async function marcarPeloGravador() {
  const pedido = confirmacaoDoGravador.value
  if (!pedido) return
  const { reconhecidos, ignorados } = pedido
  confirmacaoDoGravador.value = null
  // `sbClient.rpc` NÃO estoura: devolve `{ data, error }`. Sem contar o que deu
  // certo, um bloco inteiro barrado pela permissão sairia com o aviso de
  // "marcadas" — e a tela nunca mente (PADRAO-DA-CENTRAL, item 9).
  let feitas = 0
  for (const codigo of reconhecidos) {
    const { data, error } = await sbClient.rpc('vessel_marcar_gravada', { p_codigo: codigo })
    if (!error && data?.ok) feitas += 1
  }
  // Aqui recarregar É certo: veio um bloco inteiro de uma vez. No caminho de
  // uma etiqueta por vez, `marcarGravada` atualiza SÓ a peça de propósito —
  // recarga inteira a cada etiqueta trava o ritmo de quem está gravando em
  // sequência.
  await carregar()
  textoDoGravador.value = ''
  if (feitas < reconhecidos.length) {
    adminToast(`Marquei ${feitas} de ${reconhecidos.length}. As outras não deram certo `
      + '— confira sua permissão e tente de novo.', false)
    return
  }
  adminToast(ignorados.length
    ? `${reconhecidos.length} marcadas. ${ignorados.length} código(s) de OUTRO lote foram ignorados — confira se o arquivo é deste lote.`
    : `${reconhecidos.length} etiqueta(s) marcadas como gravadas.`)
}

function baixarPlanilha() {
  const csv = linhasDoCsv(registrosFiltrados.value)
  // BOM na frente: sem ele o Excel abre "Mônaco" como "MÃ´naco"
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'garantias-vessel.csv'
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(() => {
  carregar()
  // só na primeira visita de quem grava — e nunca se o depósito estiver
  // bloqueado, porque aí `guiaJaVisto` devolve falso para sempre e o guia
  // voltaria a cada abertura, virando estorvo.
  if (podeEditar.value && !guiaJaVisto()) guiaAberto.value = true
})
</script>

<style scoped>
.tela-autenticidade{min-height:100vh;background:transparent;position:relative;z-index:1;padding-bottom:48px;}
.abas{display:flex;gap:8px;padding:16px 24px 0;flex-wrap:wrap;}
.abas button{font-family:var(--fonte-principal);font-size:max(9px, calc(10px * var(--escala-texto, 1)));font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);background:none;border:1px solid var(--border);border-radius:5px;padding:7px 13px;cursor:pointer;transition:all .15s;}
.abas button.on{color:var(--accent);border-color:var(--accent);}

.au-vazio,.au-erro,.au-pronto{font-family:var(--fonte-principal);font-size:max(9px, calc(13px * var(--escala-texto, 1)));color:var(--muted);padding:28px 24px;line-height:1.7;max-width:620px;}
.au-erro{color:var(--red);}
.au-pronto{color:var(--accent);}
.au-instrucao{font-family:var(--fonte-principal);font-size:max(9px, calc(12.5px * var(--escala-texto, 1)));color:var(--muted);line-height:1.7;padding:16px 24px 0;max-width:620px;}
.au-secao{font-family:var(--fonte-principal);font-size:max(9px, calc(11px * var(--escala-texto, 1)));font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--text);padding:24px 24px 4px;}

.au-topo-acao{display:flex;gap:10px;align-items:center;padding:18px 24px 0;flex-wrap:wrap;}
.au-busca{flex:1;min-width:180px;font-family:var(--fonte-principal);font-size:max(9px, calc(13px * var(--escala-texto, 1)));padding:9px 12px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);}

.au-botao{font-family:var(--fonte-principal);font-size:max(9px, calc(11px * var(--escala-texto, 1)));font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--sobre-cor);background:var(--accent);border:1px solid var(--accent);border-radius:6px;padding:10px 16px;cursor:pointer;}
.au-botao[disabled]{opacity:.6;cursor:default;}
.au-botao.secundario{color:var(--accent);background:transparent;}

.au-lista{display:flex;flex-direction:column;gap:10px;padding:16px 24px 0;max-width:720px;}
.au-card{border:1px solid var(--border);border-radius:8px;background:var(--surface);padding:14px 16px;}
.au-card.alerta{border-color:var(--orange);}
.au-card-topo{display:flex;justify-content:space-between;align-items:baseline;gap:12px;}
.au-modelo{font-family:var(--fonte-principal);font-size:max(9px, calc(14px * var(--escala-texto, 1)));font-weight:600;color:var(--text);}
.au-progresso{font-family:var(--fonte-principal);font-size:max(9px, calc(11px * var(--escala-texto, 1)));color:var(--accent);white-space:nowrap;}
.au-card-linha{display:flex;gap:14px;flex-wrap:wrap;margin-top:6px;font-family:var(--fonte-principal);font-size:max(9px, calc(12px * var(--escala-texto, 1)));color:var(--muted);}
.au-ref{font-family:var(--fonte-dados);}
.au-link{margin-top:10px;font-family:var(--fonte-principal);font-size:max(9px, calc(11px * var(--escala-texto, 1)));font-weight:600;color:var(--accent);background:none;border:none;padding:0;cursor:pointer;}

.au-campo{display:block;padding:16px 24px 0;max-width:520px;}
.au-rot{display:block;font-family:var(--fonte-principal);font-size:max(9px, calc(10px * var(--escala-texto, 1)));font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:6px;}
.au-campo input,.au-campo select{width:100%;font-family:var(--fonte-principal);font-size:max(9px, calc(14px * var(--escala-texto, 1)));padding:9px 12px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);}
/* Medido a 375px: o seletor de lote saía com 39,5px de altura e 14px de fonte
   — abaixo dos 40px de alvo de dedo e dos 16px abaixo dos quais o iOS dá zoom
   ao focar. É o único `select` desta tela. */
.au-campo select{min-height:40px;box-sizing:border-box;font-size:max(16px, calc(16px * var(--escala-texto, 1)));}

.au-gravacao{padding:8px 24px 0;max-width:620px;}
.au-passo{font-family:var(--fonte-principal);font-size:max(9px, calc(11px * var(--escala-texto, 1)));font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--accent);padding-top:18px;}
/* O endereço é o que a pessoa vai conferir letra por letra na hora de gravar:
   fonte de dados, tamanho grande e quebra garantida em tela de celular. */
.au-endereco{font-family:var(--fonte-dados);font-size:max(16px, calc(17px * var(--escala-texto, 1)));line-height:1.6;color:var(--text);background:var(--surface);border:1px solid var(--accent);border-radius:8px;padding:16px;margin-top:14px;word-break:break-all;user-select:all;}
.au-acoes{display:flex;gap:10px;padding:16px 24px 0;flex-wrap:wrap;}
.au-gravacao .au-acoes{padding-left:0;padding-right:0;}
/* Mesmo motivo do `.au-acoes` logo acima: dentro do bloco de gravação o
   recuo já vem do `.au-gravacao`. Sem isto o texto de instrução ficava 24px
   mais para dentro que o endereço, e a coluna saía torta. */
.au-gravacao .au-instrucao{padding-left:0;padding-right:0;}
/* Medido a 375px: sem isto os botões da gaveta do gravador de mesa saíam com
   35,5px de altura — dedo não acerta menos que 40. */
.au-gravacao .au-botao{min-height:40px;box-sizing:border-box;}

/* O recado da gravação é o que a pessoa lê de pé, com o celular numa mão e a
   etiqueta na outra: corpo grande e contraste alto nos DOIS temas.
   Os tokens são --surface2 e --text (src/estilos/estilos-globais.css). */
.au-recado-nfc{margin:12px 0 0;padding:10px 12px;border-radius:var(--radius-md);background:var(--surface2);color:var(--text);font-family:var(--fonte-principal);font-size:max(9px, calc(15px * var(--escala-texto, 1)));line-height:1.45;overflow-wrap:anywhere;}
/* O alvo do dedo é a linha inteira, não o quadradinho: min-height 40px. */
.au-trava{display:flex;gap:8px;align-items:center;min-height:40px;margin-top:14px;font-family:var(--fonte-principal);font-size:max(9px, calc(13px * var(--escala-texto, 1)));line-height:1.5;color:var(--text);cursor:pointer;}
.au-trava input{width:20px;height:20px;flex-shrink:0;}
.au-mesa{margin-top:22px;}
/* Bloco de aviso pelo desenho do PADRAO-DA-CENTRAL: a cor é o sinal, o texto é
   para ler — por isso o `--text` e não o `--orange` na letra. */
.au-confirma{margin-top:10px;padding:12px 14px;border-radius:var(--radius-md);background:color-mix(in srgb, var(--orange) 10%, var(--surface));border:1px solid color-mix(in srgb, var(--orange) 38%, var(--surface));}
.au-confirma-texto{font-family:var(--fonte-principal);font-size:max(9px, calc(14px * var(--escala-texto, 1)));line-height:1.5;color:var(--text);overflow-wrap:anywhere;}
.au-confirma .au-acoes{padding:12px 0 0;}
/* `display:flex` no <summary> APAGA o triângulo que o Chrome desenha sozinho, e
   sem ele nada dizia que a gaveta abre. O marcador nativo sai de cena nos dois
   motores (`list-style` no padrão, `::-webkit-details-marker` no WebKit velho) e
   a seta vira o SVG do template, que gira ao abrir e existe igual em todo
   navegador. */
.au-mesa summary{display:flex;align-items:center;gap:8px;min-height:40px;cursor:pointer;font-family:var(--fonte-principal);font-size:max(9px, calc(13px * var(--escala-texto, 1)));font-weight:600;color:var(--text);list-style:none;}
.au-mesa summary::-webkit-details-marker{display:none;}
.au-seta{flex-shrink:0;color:var(--accent);transition:transform .15s;}
.au-mesa[open] > summary .au-seta{transform:rotate(90deg);}
/* 16px no campo não é estética: abaixo disso o iOS dá zoom ao focar e a tela
   salta na cara de quem está digitando. */
.au-colar{display:block;width:100%;min-height:90px;margin:10px 0;box-sizing:border-box;font-family:var(--fonte-principal);font-size:max(16px, calc(16px * var(--escala-texto, 1)));line-height:1.5;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--surface);color:var(--text);}

.au-fundo{position:fixed;inset:0;background:rgba(15,15,15,.55);display:flex;align-items:center;justify-content:center;padding:20px;z-index:50;}
.au-folha{background:var(--surface);border:1px solid var(--border);border-radius:10px;max-width:520px;width:100%;max-height:90dvh;overflow-y:auto;padding:22px 0;}
.au-folha h2{font-family:var(--fonte-principal);font-size:max(16px, calc(16px * var(--escala-texto, 1)));font-weight:600;color:var(--text);padding:0 24px;}
.au-folha .au-erro{padding:12px 24px 0;}

@media (max-width:520px){
  .abas,.au-topo-acao,.au-lista,.au-campo,.au-gravacao,.au-acoes{padding-left:16px;padding-right:16px;}
  .au-vazio,.au-erro,.au-instrucao,.au-secao{padding-left:16px;padding-right:16px;}
  .au-gravacao .au-acoes{padding-left:0;padding-right:0;}
  .au-botao{flex:1;}
}

/* ── O PASSO A PASSO ──────────────────────────────────────────────────────
   Cor sai de token, nunca escrita a mao (PADRAO-DA-CENTRAL). A etapa de agora
   e a unica que mostra o resumo: passo a passo que explica tudo ao mesmo tempo
   nao explica nada. */
.au-passos{
  list-style:none; margin:0 0 var(--sp-3); padding:0;
  display:flex; flex-direction:column; gap:var(--sp-1);
}
.au-passo-item{
  display:flex; gap:var(--sp-2); align-items:flex-start;
  padding:var(--sp-2); border-radius:var(--radius-md);
  color:var(--muted); background:transparent;
}
.au-passo-item.agora{background:var(--surface2); color:var(--text)}
.au-passo-n{
  flex:none; width:22px; height:22px; border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  font-size:12px; font-weight:600;
  border:1px solid var(--border); background:var(--surface);
}
.au-passo-item.agora .au-passo-n{background:var(--accent); border-color:var(--accent); color:var(--bg)}
.au-passo-item.feito .au-passo-n{opacity:.55}
.au-passo-txt{display:flex; flex-direction:column; gap:2px; min-width:0}
.au-passo-txt strong{font-size:14px; font-weight:600}
.au-passo-resumo{font-size:13px; line-height:1.45; color:var(--muted)}
.au-rever{margin:0 0 var(--sp-2)}
/* O link de rever media 13px de altura — medido a 375px. Alvo de toque abaixo
   de 40px e defeito (PADRAO item 3), e este e usado com o celular na mao. Ganha
   area de toque sem virar botao: o texto continua link. */
.au-rever .au-link{
  display:inline-flex; align-items:center; min-height:40px; padding:0 2px;
}

/* ── O GUIA DA PRIMEIRA VEZ ───────────────────────────────────────────────
   `position:fixed` com inset zero, e nao `absolute`: dentro de um pai que
   rola, o absolute acompanha a rolagem e o guia sai da tela. */
.au-guia-fundo{
  position:fixed; inset:0; z-index:60;
  display:flex; align-items:center; justify-content:center;
  padding:var(--sp-3); background:rgba(0,0,0,.55);
}
.au-guia{
  width:100%; max-width:420px; padding:var(--sp-4);
  border-radius:var(--radius-lg); border:1px solid var(--border);
  background:var(--surface); color:var(--text);
}
.au-guia-conta{margin:0 0 var(--sp-1); font-size:12px; color:var(--muted); letter-spacing:.06em}
.au-guia-titulo{margin:0 0 var(--sp-2); font-size:19px; line-height:1.25}
.au-guia-texto{margin:0 0 var(--sp-4); font-size:15px; line-height:1.55}
/* os botoes embaixo e lado a lado; a 375px eles empilham em vez de encolher,
   porque alvo de toque abaixo de 40px e defeito */
.au-guia-acoes{display:flex; gap:var(--sp-2); flex-wrap:wrap}
.au-guia-acoes .au-botao{flex:1 1 140px; min-height:40px}
</style>
