<template>
  <Teleport to="body">
  <div class="ctd-fundo" @click.self="$emit('fechar')">
    <div class="ctd-painel" role="dialog" aria-label="Peça de conteúdo">
      <div class="ctd-painel-cab">
        <span class="ctd-painel-t">{{ ehNova ? 'Nova peça' : 'Editar peça' }}</span>
        <span v-if="!ehNova" class="ctd-pip" :style="{ color: corDeStatus(form.status) }">
          {{ rotuloDeStatus(form.status) }}
        </span>
        <button class="ctd-fechar" @click="$emit('fechar')" aria-label="Fechar">×</button>
      </div>

      <div class="ctd-painel-corpo">
        <p v-if="erro" class="ctd-aviso ctd-aviso-erro">{{ erro }}</p>
        <p v-if="form.status === 'reprovada' && form.motivo_reprovacao" class="ctd-aviso ctd-aviso-atencao">
          <b>Reprovada.</b> {{ form.motivo_reprovacao }}
        </p>

        <!-- O robô achou um post parecido mas não teve certeza. Quem decide é
             quem escreveu a peça — por isso a legenda REAL aparece aqui, não só
             a miniatura: é o que permite conferir sem abrir o Instagram. -->
        <div v-if="sugestao" class="ctd-sugestao">
          <span class="ctd-rot">É este o post no Instagram?</span>
          <div class="ctd-sugestao-corpo">
            <img v-if="sugestao.ig_thumb" :src="sugestao.ig_thumb" alt="" class="ctd-sugestao-mini">
            <div class="ctd-sugestao-txt">
              <span class="ctd-sugestao-legenda">{{ sugestao.ig_caption || '(post sem legenda)' }}</span>
              <span class="ctd-ajuda">
                Publicado em {{ dataHoraBRT(sugestao.ig_timestamp) }}. {{ sugestao.motivo }}
              </span>
              <a v-if="sugestao.ig_permalink" :href="sugestao.ig_permalink" target="_blank" rel="noopener" class="ctd-sugestao-link">
                Abrir no Instagram ↗
              </a>
            </div>
          </div>
          <div class="ctd-peca-acoes">
            <button class="ctd-btn ctd-btn-primario" :disabled="decidindo" @click="responderSugestao(true)">
              Sim, é este
            </button>
            <button class="ctd-btn" :disabled="decidindo" @click="responderSugestao(false)">
              Não é
            </button>
          </div>
        </div>

        <!-- LIGAR AO POST NA MÃO.
             O robô só casa o que ele encontra. Fora da janela de 24h, com a
             legenda muito reescrita, ou em story (que a Meta não devolve de
             forma confiável), ele não acha — e antes disto a peça ficava sem
             métrica para sempre, sem nada a fazer na tela. -->
        <div v-if="podeCasarNaMao" class="ctd-campo">
          <span class="ctd-rot">Ligar ao post do Instagram</span>
          <p v-if="ehStory" class="ctd-ajuda">
            <b>Story não é medido automaticamente.</b> O Instagram não devolve os stories de forma
            confiável, então este é o único caminho — e mesmo ligado, os números de story ficam
            disponíveis por pouco tempo.
          </p>
          <p v-else class="ctd-ajuda">
            Já publicou e o sistema não encontrou sozinho? Cole aqui o endereço do post.
          </p>
          <div class="ctd-linha-dupla">
            <input
              v-model="linkDoPost"
              class="ctd-in"
              placeholder="https://www.instagram.com/p/…"
              @keyup.enter="casarNaMao"
            >
            <button
              class="ctd-btn ctd-btn-primario"
              :disabled="!linkDoPost.trim() || casando"
              @click="casarNaMao"
            >{{ casando ? 'Ligando…' : 'Ligar' }}</button>
          </div>
        </div>

        <!-- Desempenho, quando já houver. -->
        <div v-if="metrica" class="ctd-campo">
          <span class="ctd-rot">Como foi este post</span>
          <div class="ctd-numeros">
            <div v-for="n in numeros" :key="n.rotulo" class="ctd-numero">
              <span class="ctd-numero-val">{{ n.valor }}</span>
              <span class="ctd-numero-lbl">{{ n.rotulo }}</span>
            </div>
          </div>
          <span class="ctd-ajuda">Medido em {{ metrica.capturado_em?.split('-').reverse().join('/') }}.</span>
        </div>

        <div class="ctd-campo">
          <label class="ctd-rot" for="ctd-titulo">Título (só para você achar depois)</label>
          <input id="ctd-titulo" v-model="form.titulo" class="ctd-in" placeholder="Ex.: Bastidor da loja nova" maxlength="120">
        </div>

        <div class="ctd-campo">
          <span class="ctd-rot">Formato</span>
          <div class="ctd-formatos">
            <button
              v-for="f in FORMATOS"
              :key="f.chave"
              class="ctd-formato-btn"
              :class="{ on: form.formato === f.chave }"
              @click="form.formato = f.chave"
            >{{ f.rotulo }}</button>
          </div>
          <span class="ctd-ajuda">{{ regrasDoFormato(form.formato)?.ajuda }}</span>
        </div>

        <div class="ctd-campo">
          <label class="ctd-rot" for="ctd-quando">Publicar em (horário de Brasília)</label>
          <input id="ctd-quando" v-model="form.quando" type="datetime-local" class="ctd-in">
          <span class="ctd-ajuda">
            Na hora marcada chega um aviso no seu celular com a arte e a legenda prontas para colar.
            O aviso pode levar até 5 minutos.
          </span>
        </div>

        <!-- ARQUIVOS -->
        <div class="ctd-campo">
          <span class="ctd-rot">Arquivos</span>

          <p v-if="ehNova" class="ctd-ajuda">
            Salve o rascunho primeiro — aí aparece o lugar para subir a arte.
          </p>

          <template v-else>
            <div
              class="ctd-solta"
              :class="{ sobre: arrastandoArquivo }"
              @click="$refs.seletor.click()"
              @dragover.prevent="arrastandoArquivo = true"
              @dragleave="arrastandoArquivo = false"
              @drop.prevent="aoSoltarArquivos"
            >
              <span v-if="enviando">Enviando… {{ enviando }}</span>
              <span v-else>Arraste os arquivos aqui, ou clique para escolher</span>
            </div>
            <input ref="seletor" type="file" multiple hidden :accept="aceita" @change="aoEscolherArquivos">

            <div v-if="arquivos.length" class="ctd-arquivos">
              <div v-for="(a, i) in arquivos" :key="a.id" class="ctd-arquivo">
                <img v-if="a.tipo === 'imagem' && urls[a.caminho]" :src="urls[a.caminho]" alt="">
                <video v-else-if="a.tipo === 'video' && urls[a.caminho]" :src="urls[a.caminho]" preload="metadata"></video>
                <span v-else class="ctd-arquivo-peso">…</span>
                <span class="ctd-arquivo-nome">{{ nomeCurto(a.caminho) }}</span>
                <span class="ctd-arquivo-peso">{{ formatarBytes(a.bytes) }}</span>
                <button class="ctd-mini-btn" :disabled="i === 0" title="Subir na ordem" @click="reordenar(i, -1)">↑</button>
                <button class="ctd-mini-btn" :disabled="i === arquivos.length - 1" title="Descer na ordem" @click="reordenar(i, 1)">↓</button>
                <button class="ctd-mini-btn perigo" title="Remover" @click="removerEste(a)">×</button>
              </div>
            </div>

            <ul v-if="problemas.length" class="ctd-aviso ctd-aviso-atencao">
              <li v-for="p in problemas" :key="p">{{ p }}</li>
            </ul>
          </template>
        </div>

        <div class="ctd-campo">
          <label class="ctd-rot" for="ctd-legenda">Legenda</label>
          <textarea id="ctd-legenda" v-model="form.legenda" class="ctd-ta" placeholder="O texto que vai junto com o post."></textarea>
          <span class="ctd-contador" :class="{ estourou: caracteres > LIMITE_LEGENDA }">
            {{ caracteres }} / {{ LIMITE_LEGENDA }}
          </span>
        </div>

        <div class="ctd-campo">
          <label class="ctd-rot" for="ctd-hashtags">Hashtags</label>
          <input id="ctd-hashtags" v-model="form.hashtags" class="ctd-in" placeholder="#vessel #bolsa #novacolecao">
          <span class="ctd-contador" :class="{ estourou: hashtags.length > LIMITE_HASHTAGS }">
            {{ hashtags.length }} / {{ LIMITE_HASHTAGS }}
          </span>
        </div>

        <div class="ctd-campo">
          <label class="ctd-rot" for="ctd-obs">Observações da equipe</label>
          <input id="ctd-obs" v-model="form.observacoes" class="ctd-in" placeholder="Recado para quem for aprovar ou postar.">
        </div>

        <!-- MOVER DE ETAPA -->
        <div v-if="!ehNova" class="ctd-campo">
          <span class="ctd-rot">Mover para</span>
          <div class="ctd-formatos">
            <button
              v-for="destino in destinos"
              :key="destino.chave"
              class="ctd-formato-btn"
              :disabled="!destino.ok"
              :title="destino.motivo || ''"
              @click="mover(destino.chave)"
            >{{ destino.rotulo }}</button>
          </div>
          <span v-if="destinoBloqueado" class="ctd-ajuda">{{ destinoBloqueado }}</span>

          <!-- REPROVAR PEDE O MOTIVO.
               A tela já tinha o aviso "Reprovada. {motivo}" pronto lá em cima,
               mas nada preenchia o motivo — era código morto. Quem escreveu a
               peça via que foi recusada e não via por quê, que é a única
               informação que faz a recusa valer alguma coisa. -->
          <div v-if="pedindoMotivo" class="ctd-motivo">
            <label class="ctd-rot" for="ctd-motivo">Por que está reprovando?</label>
            <textarea
              id="ctd-motivo"
              ref="campoMotivo"
              v-model="motivoRecusa"
              class="ctd-ta"
              rows="2"
              placeholder="Ex.: a foto está escura e a legenda promete um preço que mudou"
            ></textarea>
            <div class="ctd-peca-acoes">
              <button
                class="ctd-btn ctd-btn-perigo"
                :disabled="!motivoRecusa.trim()"
                @click="confirmarReprovacao"
              >Reprovar</button>
              <button class="ctd-btn" @click="pedindoMotivo = false">Cancelar</button>
            </div>
          </div>
        </div>

        <div v-if="!ehNova && eventos.length" class="ctd-campo">
          <span class="ctd-rot">Histórico</span>
          <div class="ctd-trilha">
            <div v-for="e in eventos" :key="e.id" class="ctd-trilha-item">
              <span class="ctd-trilha-quando">{{ dataHoraBRT(e.quando) }}</span>
              <span>{{ frase(e) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="ctd-painel-rodape">
        <button class="ctd-btn ctd-btn-primario" :disabled="salvando || !form.titulo.trim()" @click="salvar">
          {{ salvando ? 'Salvando…' : (ehNova ? 'Criar rascunho' : 'Salvar') }}
        </button>
        <button class="ctd-btn" @click="$emit('fechar')">Fechar</button>

        <!-- O recado fica COLADO no botão que o provocou, não num canto da tela:
             é onde o olho já está depois do clique. `aria-live` faz o leitor de
             tela anunciar sem roubar o foco. -->
        <span v-if="recado" class="ctd-recado" role="status" aria-live="polite">
          <IconeCerto /> {{ recado }}
        </span>

        <button
          v-if="!ehNova"
          class="ctd-btn ctd-btn-perigo"
          style="margin-left:auto"
          @click="confirmandoExclusao ? excluir() : (confirmandoExclusao = true)"
        >
          {{ confirmandoExclusao ? 'Confirmar exclusão' : 'Excluir' }}
        </button>
      </div>
    </div>
  </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { rotuloDeStatus, corDeStatus, transicoesPermitidas, podeTransicionar } from './estados.js'
import { FORMATOS, regrasDoFormato, validarArquivos, formatarBytes } from './formatos.js'
import { IconeCerto } from './icones.js'
import { LIMITE_LEGENDA, LIMITE_HASHTAGS, listarHashtags } from './legenda.js'
import { paraCampoDeDataHora, deCampoDeDataHora, dataHoraBRT } from './grade-do-calendario.js'
import * as dados from './dados-conteudo.js'

const props = defineProps({
  peca: { type: Object, default: null },
  accountId: { type: String, required: true },
  dataSugerida: { type: String, default: '' },   // 'YYYY-MM-DD' vindo do clique no calendário
  podeAprovar: { type: Boolean, default: false },
})

const emit = defineEmits(['fechar', 'mudou'])

const atual = ref(props.peca)
const ehNova = computed(() => !atual.value?.id)

const form = reactive({
  titulo: '', formato: 'feed', quando: '', legenda: '', hashtags: '',
  observacoes: '', status: 'rascunho', motivo_reprovacao: null,
})

const arquivos = ref([])
const urls = ref({})
const eventos = ref([])
const sugestao = ref(null)
const metrica = ref(null)
const decidindo = ref(false)
const erro = ref('')
const salvando = ref(false)

// A CONFIRMAÇÃO QUE FALTAVA. Salvar não dizia nada: a pessoa clicava, o painel
// continuava igual, e não havia como saber se pegou. Silêncio depois de uma
// ação é o que faz alguém clicar de novo — ou desconfiar da ferramenta.
const recado = ref('')
let relogioRecado = null
function avisar(texto) {
  recado.value = texto
  clearTimeout(relogioRecado)
  relogioRecado = setTimeout(() => { recado.value = '' }, 2600)
}

// Ligar ao post do Instagram na mão.
const linkDoPost = ref('')
const casando = ref(false)

const ehStory = computed(() => form.formato === 'stories')

// Só faz sentido oferecer quando a peça já saiu (ou deveria ter saído) e ainda
// não está ligada a nenhum post. Em story oferecemos sempre que houver data,
// porque para ele NUNCA vai haver sugestão automática.
const podeCasarNaMao = computed(() => {
  if (ehNova.value) return false
  if (atual.value?.ig_media_id) return false
  if (ehStory.value) return !!form.quando
  return ['agendada', 'publicada'].includes(form.status)
})

async function casarNaMao() {
  const link = linkDoPost.value.trim()
  if (!link) return
  erro.value = ''
  casando.value = true
  try {
    atual.value = await dados.casarNaMao(atual.value.id, link)
    preencher(atual.value)
    linkDoPost.value = ''
    avisar('Ligado ao post — os números chegam na próxima medição')
    emit('mudou')
  } catch (e) {
    erro.value = e.message
  } finally {
    casando.value = false
  }
}

// Reprovação: motivo antes da decisão.
const pedindoMotivo = ref(false)
const motivoRecusa = ref('')
const campoMotivo = ref(null)
const enviando = ref('')
const arrastandoArquivo = ref(false)
const confirmandoExclusao = ref(false)

const caracteres = computed(() => [...form.legenda].length)
const hashtags = computed(() => listarHashtags(form.hashtags))
const aceita = computed(() => (regrasDoFormato(form.formato)?.mimes || []).join(','))

const problemas = computed(() =>
  arquivos.value.length ? validarArquivos(form.formato, arquivos.value.map(a => ({ nome: nomeCurto(a.caminho), bytes: a.bytes, mime: a.mime }))) : [],
)

const destinos = computed(() =>
  transicoesPermitidas(form.status).map((chave) => {
    const v = podeTransicionar(form.status, chave, {
      podeAprovar: props.podeAprovar,
      temData: !!form.quando,
    })
    return { chave, rotulo: rotuloDeStatus(chave), ok: v.ok, motivo: v.motivo }
  }),
)

// Um único recado explicando por que os botões estão apagados — repetir o
// mesmo motivo em quatro `title` não ajuda quem está no celular e não tem hover.
const destinoBloqueado = computed(() => {
  const travados = destinos.value.filter(d => !d.ok)
  if (!travados.length || travados.length !== destinos.value.length) {
    return travados.map(d => d.motivo).find(Boolean) || ''
  }
  return travados[0].motivo
})

function preencher(p) {
  form.titulo = p?.titulo || ''
  form.formato = p?.formato || 'feed'
  form.quando = p?.publicar_em
    ? paraCampoDeDataHora(p.publicar_em)
    : (props.dataSugerida ? `${props.dataSugerida}T09:00` : '')
  form.legenda = p?.legenda || ''
  form.hashtags = p?.hashtags || ''
  form.observacoes = p?.observacoes || ''
  form.status = p?.status || 'rascunho'
  form.motivo_reprovacao = p?.motivo_reprovacao || null
}

async function carregarAnexos() {
  if (!atual.value?.id) return
  const id = atual.value.id
  try {
    arquivos.value = await dados.listarArquivos(id)
    urls.value = await dados.urlsAssinadas(arquivos.value.map(a => a.caminho))
    eventos.value = await dados.listarEventos(id)
    sugestao.value = (await dados.sugestoesDeCasamento([id]))[id] || null
    metrica.value = (await dados.metricasDasPecas([id]))[id] || null
  } catch (e) {
    erro.value = e.message
  }
}

// Métrica ausente sai da lista em vez de virar zero: 0 curtidas é uma afirmação
// sobre o post, e a Meta simplesmente não respondeu.
const numeros = computed(() => {
  const m = metrica.value
  if (!m) return []
  return [
    { rotulo: 'curtidas', valor: m.curtidas },
    { rotulo: 'comentários', valor: m.comentarios },
    { rotulo: 'alcance', valor: m.alcance },
    { rotulo: 'salvamentos', valor: m.salvamentos },
    { rotulo: 'compartilh.', valor: m.compartilhamentos },
    { rotulo: 'visualizações', valor: m.visualizacoes },
  ].filter(n => n.valor !== null && n.valor !== undefined)
})

async function responderSugestao(confirma) {
  decidindo.value = true
  erro.value = ''
  try {
    await dados.decidirCasamento(sugestao.value.id, confirma)
    sugestao.value = null
    if (confirma) {
      atual.value = await dados.carregarPeca(atual.value.id)
      preencher(atual.value)
    }
    await carregarAnexos()
    emit('mudou')
  } catch (e) {
    erro.value = e.message
  } finally {
    decidindo.value = false
  }
}

onMounted(() => { preencher(props.peca); carregarAnexos() })
onUnmounted(() => clearTimeout(relogioRecado))
watch(() => props.peca, (p) => { atual.value = p; preencher(p); carregarAnexos() })

function camposDoBanco() {
  const publicarEm = deCampoDeDataHora(form.quando)
  const campos = {
    account_id: props.accountId,
    titulo: form.titulo.trim(),
    formato: form.formato,
    legenda: form.legenda,
    hashtags: form.hashtags,
    observacoes: form.observacoes || null,
    publicar_em: publicarEm,
  }

  // MUDOU A DATA? ENTÃO O AVISO PRECISA VALER DE NOVO.
  //
  // `mudarStatus` já limpava `avisado_em` ao reagendar, mas só ele — e o botão
  // Salvar troca a data sem passar por lá. Uma peça já avisada e remarcada por
  // aqui ficava marcada como "avisei" para sempre, e o robô da hora H (que só
  // olha quem tem avisado_em nulo) nunca mais tocava nela. Falha silenciosa:
  // nenhum erro, nenhum sinal, o aviso simplesmente não chegava.
  //
  // Só limpa quando a data REALMENTE mudou: salvar a peça sem mexer no horário
  // não pode ressuscitar um aviso que já foi entregue.
  //
  // A comparação é pelo INSTANTE, não pelo texto: o banco devolve
  // "2026-08-01T12:00:00+00:00" e o campo da tela produz "...12:00:00.000Z".
  // Comparando string, os dois nunca batem e o aviso seria zerado a cada Salvar.
  if (!mesmoInstante(publicarEm, atual.value?.publicar_em)) campos.avisado_em = null

  return campos
}

function mesmoInstante(a, b) {
  if (!a && !b) return true
  if (!a || !b) return false
  const ta = new Date(a).getTime()
  const tb = new Date(b).getTime()
  // Data inválida de um lado só conta como mudança — melhor reavisar do que
  // deixar a peça muda.
  if (Number.isNaN(ta) || Number.isNaN(tb)) return false
  return ta === tb
}

async function salvar() {
  erro.value = ''
  salvando.value = true
  // Guardado ANTES de gravar: assim que a peça ganha id, `ehNova` vira falso e
  // o recado diria "Salvo" numa peça que acabou de nascer.
  const eraNova = ehNova.value
  try {
    if (eraNova) {
      atual.value = await dados.criarPeca(camposDoBanco())
      preencher(atual.value)
      await carregarAnexos()
    } else {
      atual.value = await dados.atualizarPeca(atual.value.id, camposDoBanco())
      preencher(atual.value)
    }
    avisar(eraNova ? 'Rascunho criado — agora dá para subir a arte' : 'Salvo')
    emit('mudou')
  } catch (e) {
    erro.value = e.message
  } finally {
    salvando.value = false
  }
}

async function mover(destino) {
  // Reprovar não é um clique só: primeiro o motivo, depois a decisão.
  if (destino === 'reprovada') {
    pedindoMotivo.value = true
    motivoRecusa.value = ''
    await nextTick()
    campoMotivo.value?.focus()
    return
  }
  await aplicarDestino(destino)
}

async function confirmarReprovacao() {
  const motivo = motivoRecusa.value.trim()
  if (!motivo) return
  await aplicarDestino('reprovada', motivo)
  pedindoMotivo.value = false
}

async function aplicarDestino(destino, motivo = null) {
  erro.value = ''
  try {
    // Salva o que está na tela antes de mudar de etapa: senão a peça vai para
    // aprovação com a legenda velha, e quem aprova decide sobre outra coisa.
    atual.value = await dados.atualizarPeca(atual.value.id, camposDoBanco())

    atual.value = (destino === 'aprovada' || destino === 'reprovada')
      ? await dados.decidir(atual.value.id, destino, motivo)
      : await dados.mudarStatus(atual.value, destino)

    preencher(atual.value)
    await carregarAnexos()
    avisar(destino === 'reprovada' ? 'Reprovada, com o motivo registrado' : 'Pronto')
    emit('mudou')
  } catch (e) {
    erro.value = e.message
  }
}

async function aoEscolherArquivos(ev) {
  await subir([...ev.target.files])
  ev.target.value = ''
}

async function aoSoltarArquivos(ev) {
  arrastandoArquivo.value = false
  await subir([...ev.dataTransfer.files])
}

async function subir(lista) {
  if (!lista.length || !atual.value?.id) return
  erro.value = ''

  // Barra antes de enviar: um vídeo de 400 MB só falharia no fim do upload.
  const problemasAgora = validarArquivos(form.formato, [
    ...arquivos.value.map(a => ({ nome: nomeCurto(a.caminho), bytes: a.bytes, mime: a.mime })),
    ...lista.map(f => ({ nome: f.name, bytes: f.size, mime: f.type })),
  ])
  const impeditivos = problemasAgora.filter(p => !/precisa de/.test(p))
  if (impeditivos.length) { erro.value = impeditivos.join(' '); return }

  // A ORDEM SAI DA MAIOR JÁ USADA, NÃO DA QUANTIDADE.
  //
  // Com `arquivos.value.length` havia um caminho que quebrava de verdade: suba
  // 3 fotos (ordens 1,2,3), apague a do meio (sobram 1 e 3, length = 2), suba
  // outra → ela recebia ordem 3, que já existe. O `unique (peca_id, ordem)`
  // recusava, o arquivo já subido era apagado do depósito e a pessoa lia um
  // erro do Postgres em inglês. Apagar não renumera de propósito (renumerar
  // mexeria na ordem que a pessoa escolheu), então quem tem de se virar é aqui.
  let ordem = arquivos.value.reduce((maior, a) => Math.max(maior, Number(a?.ordem) || 0), 0)
  for (const file of lista) {
    enviando.value = file.name
    try {
      await dados.subirArquivo(atual.value, file, ++ordem)
    } catch (e) {
      erro.value = e.message
      break
    }
  }
  enviando.value = ''
  await carregarAnexos()
  emit('mudou')
}

async function removerEste(a) {
  try {
    await dados.removerArquivo(a)
    await carregarAnexos()
    emit('mudou')
  } catch (e) {
    erro.value = e.message
  }
}

async function reordenar(i, passo) {
  const outro = i + passo
  const a = arquivos.value[i]
  const b = arquivos.value[outro]
  if (!a || !b) return
  try {
    // O unique (peca_id, ordem) impede a troca direta: passa por um valor livre.
    await dados.trocarOrdem(a.id, -1)
    await dados.trocarOrdem(b.id, a.ordem)
    await dados.trocarOrdem(a.id, b.ordem)
    await carregarAnexos()
  } catch (e) {
    erro.value = e.message
  }
}

async function excluir() {
  try {
    await dados.excluirPeca(atual.value.id)
    emit('mudou')
    emit('fechar')
  } catch (e) {
    erro.value = e.message
    confirmandoExclusao.value = false
  }
}

function nomeCurto(caminho) {
  return String(caminho || '').split('/').pop() || 'arquivo'
}

const FRASES = {
  criou: 'Peça criada.',
  aprovou: 'Aprovou a peça.',
  reprovou: 'Reprovou a peça.',
  mudou_status: 'Mudou a etapa.',
  avisou: 'Avisou que chegou a hora.',
}

function frase(e) {
  const base = FRASES[e.acao] || e.acao
  const caminho = e.de && e.para ? ` (${rotuloDeStatus(e.de)} → ${rotuloDeStatus(e.para)})` : ''
  return `${base}${caminho}${e.detalhe ? ` — ${e.detalhe}` : ''}`
}
</script>
