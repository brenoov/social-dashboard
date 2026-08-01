<template>
  <!-- O ROTEIRO, PARA LER E PARA ESCREVER.
       Este painel tem dois papéis no mesmo desenho: ler o que a IA entregou, e
       montar um à mão com a MESMA estrutura. Antes, anotar uma ideia era um
       campo de título solto — o que produzia ideias pobres ao lado de roteiros
       completos, na mesma lista. Agora a estrutura é uma só; muda quem preenche.

       Lendo, a fala vem em corpo grande entre aspas (é para ler em voz alta com
       o celular na mão) e o enquadramento vem menor, como instrução. -->
  <Teleport to="body">
  <div class="ctd-fundo" @click.self="fechar">
    <div class="ctd-painel ctd-painel-largo" role="dialog" aria-labelledby="ctd-ideia-titulo">
      <div class="ctd-painel-cab">
        <span v-if="!editando && ideia.origem === 'ia'" class="ctd-ideia-selo" title="Sugerida pela IA"><IconeFaisca /></span>
        <span id="ctd-ideia-titulo" class="ctd-painel-t">
          {{ editando ? (ehNova ? 'Nova ideia' : 'Editando a ideia') : ideia.titulo }}
        </span>
        <button class="ctd-fechar" aria-label="Fechar" @click="fechar">×</button>
      </div>

      <!-- ══════════ LEITURA ══════════ -->
      <div v-if="!editando" class="ctd-painel-corpo ctd-roteiro">
        <div class="ctd-rot-fita">
          <span class="ctd-formato ctd-formato-forte">
            <IconeFormato :formato="ideia.formato" :tamanho="14" />
            {{ nomeDoFormato(ideia.formato) }}
          </span>
          <span v-if="ideia.pilar" class="ctd-formato">{{ ideia.pilar }}</span>
          <span v-if="duracaoTotal" class="ctd-formato ctd-formato-tempo">{{ duracaoTotal }}s no total</span>
          <span v-if="takes.length" class="ctd-formato">{{ takes.length }} {{ rotuloDoPasso(takes.length, ideia.formato) }}</span>
        </div>

        <p v-if="ideia.porque_formato" class="ctd-rot-nota">
          <b>Por que {{ nomeDoFormato(ideia.formato).toLowerCase() }}:</b> {{ ideia.porque_formato }}
        </p>

        <section v-if="ideia.gancho" class="ctd-gancho3">
          <span class="ctd-gancho3-rot">Os 3 primeiros segundos</span>
          <p class="ctd-gancho3-txt">{{ semAspas(ideia.gancho) }}</p>
        </section>

        <section v-if="ideia.producao" class="ctd-rot-bloco ctd-rot-producao">
          <h3 class="ctd-rot-h">Antes de gravar, tenha em mãos</h3>
          <p>{{ ideia.producao }}</p>
        </section>

        <section v-if="takes.length" class="ctd-rot-bloco">
          <h3 class="ctd-rot-h">{{ tituloDaLista }}</h3>
          <ol class="ctd-takes">
            <li v-for="(t, i) in takes" :key="i" class="ctd-take">
              <div class="ctd-take-num">
                <span>{{ t.cena ?? i + 1 }}</span>
                <b v-if="t.duracao_s">{{ t.duracao_s }}s</b>
              </div>
              <div class="ctd-take-corpo">
                <p v-if="t.imagem" class="ctd-take-imagem">{{ t.imagem }}</p>
                <p v-if="falaDoTake(t)" class="ctd-take-fala">“{{ falaDoTake(t) }}”</p>
                <p v-if="t.texto_na_tela" class="ctd-take-tela">
                  <span>na tela</span>{{ t.texto_na_tela }}
                </p>
              </div>
            </li>
          </ol>
        </section>

        <section v-if="ideia.legenda_sugerida || ideia.cta || ideia.hashtags_sugeridas" class="ctd-rot-bloco">
          <h3 class="ctd-rot-h">Para publicar</h3>
          <p v-if="ideia.legenda_sugerida" class="ctd-rot-legenda">{{ ideia.legenda_sugerida }}</p>
          <p v-if="ideia.cta" class="ctd-rot-cta"><span>chamada</span>{{ ideia.cta }}</p>
          <p v-if="ideia.hashtags_sugeridas" class="ctd-rot-tags">{{ ideia.hashtags_sugeridas }}</p>
        </section>

        <section v-if="ideia.por_que_agora" class="ctd-rot-bloco ctd-rot-porque">
          <h3 class="ctd-rot-h">Por que agora</h3>
          <p>{{ ideia.por_que_agora }}</p>
        </section>
      </div>

      <!-- ══════════ ESCRITA ══════════
           Os MESMOS campos que a IA preenche, em branco. A ordem é a de quem
           pensa um conteúdo: o que é → como abre → o que precisa → os passos →
           o que vai publicado. -->
      <div v-else class="ctd-painel-corpo">
        <p v-if="erro" class="ctd-aviso ctd-aviso-erro">{{ erro }}</p>

        <div class="ctd-campo">
          <label class="ctd-rot" for="ctd-i-titulo">A ideia, em uma linha</label>
          <input
            id="ctd-i-titulo"
            ref="campoTitulo"
            v-model="rasc.titulo"
            class="ctd-in"
            placeholder="Ex.: bastidor da montagem da vitrine nova"
            maxlength="160"
          >
        </div>

        <div class="ctd-linha-dupla">
          <div class="ctd-campo">
            <label class="ctd-rot" for="ctd-i-formato">Formato</label>
            <select id="ctd-i-formato" v-model="rasc.formato" class="ctd-sel">
              <option value="">(decidir depois)</option>
              <option v-for="f in FORMATOS" :key="f.chave" :value="f.chave">{{ f.rotulo }}</option>
            </select>
          </div>
          <div class="ctd-campo">
            <label class="ctd-rot" for="ctd-i-pilar">Pilar</label>
            <select id="ctd-i-pilar" v-model="rasc.pilar" class="ctd-sel">
              <option value="">(decidir depois)</option>
              <option v-for="p in PILARES" :key="p" :value="p">{{ p }}</option>
            </select>
          </div>
        </div>

        <div class="ctd-campo">
          <label class="ctd-rot" for="ctd-i-gancho">Os 3 primeiros segundos</label>
          <textarea
            id="ctd-i-gancho"
            v-model="rasc.gancho"
            class="ctd-ta"
            rows="2"
            placeholder="Escreva a abertura como se fala, não o que seria bom falar."
          ></textarea>
          <span class="ctd-ajuda">É o que decide se a pessoa fica. Frase pronta para dizer em voz alta.</span>
        </div>

        <div class="ctd-campo">
          <label class="ctd-rot" for="ctd-i-producao">Antes de gravar, tenha em mãos</label>
          <input
            id="ctd-i-producao"
            v-model="rasc.producao"
            class="ctd-in"
            placeholder="Lugar, objetos, roupa, quem aparece."
          >
        </div>

        <!-- OS PASSOS. Mesma estrutura do que a IA devolve: o que aparece, o que
             se fala, o que entra escrito, quanto dura. -->
        <div class="ctd-campo">
          <span class="ctd-rot">{{ tituloDaListaEdicao }}</span>
          <div v-for="(t, i) in rasc.roteiro" :key="i" class="ctd-take-edit">
            <div class="ctd-take-edit-cab">
              <span class="ctd-take-edit-num">{{ i + 1 }}</span>
              <input
                v-model.number="t.duracao_s"
                type="number"
                min="1"
                max="180"
                class="ctd-in ctd-in-curto"
                placeholder="seg"
                aria-label="Duração em segundos"
              >
              <button class="ctd-mini-btn" :disabled="i === 0" title="Subir" @click="moverTake(i, -1)">↑</button>
              <button class="ctd-mini-btn" :disabled="i === rasc.roteiro.length - 1" title="Descer" @click="moverTake(i, 1)">↓</button>
              <button class="ctd-mini-btn perigo" title="Remover" @click="rasc.roteiro.splice(i, 1)">×</button>
            </div>
            <input v-model="t.imagem" class="ctd-in" placeholder="O que aparece na tela (enquadramento, ação, onde é)">
            <textarea v-model="t.narracao" class="ctd-ta" rows="2" placeholder="O que se fala aqui, palavra por palavra"></textarea>
            <input v-model="t.texto_na_tela" class="ctd-in" placeholder="O que aparece escrito na tela (opcional)">
          </div>
          <button class="ctd-btn ctd-btn-encolhe" @click="adicionarTake">+ {{ nomeDoPassoSingular }}</button>
        </div>

        <div class="ctd-campo">
          <label class="ctd-rot" for="ctd-i-legenda">Legenda</label>
          <textarea id="ctd-i-legenda" v-model="rasc.legenda_sugerida" class="ctd-ta" rows="3" placeholder="O texto que vai junto com o post."></textarea>
        </div>

        <div class="ctd-linha-dupla">
          <div class="ctd-campo">
            <label class="ctd-rot" for="ctd-i-cta">Chamada do fim</label>
            <input id="ctd-i-cta" v-model="rasc.cta" class="ctd-in" placeholder="O que a pessoa faz agora.">
          </div>
          <div class="ctd-campo">
            <label class="ctd-rot" for="ctd-i-tags">Hashtags</label>
            <input id="ctd-i-tags" v-model="rasc.hashtags_sugeridas" class="ctd-in" placeholder="#marca #assunto">
          </div>
        </div>

        <div class="ctd-campo">
          <label class="ctd-rot" for="ctd-i-porque">Por que agora</label>
          <input id="ctd-i-porque" v-model="rasc.por_que_agora" class="ctd-in" placeholder="Uma data, uma sazonalidade, um post que foi bem.">
        </div>
      </div>

      <div class="ctd-painel-rodape">
        <template v-if="!editando">
          <button class="ctd-btn ctd-btn-primario" @click="$emit('virar-peca', ideia)">
            <IconeCerto /> Virar peça
          </button>
          <button class="ctd-btn" @click="entrarNaEdicao">Editar</button>
          <button class="ctd-btn" @click="copiar">{{ copiado ? 'Copiado!' : 'Copiar roteiro' }}</button>
          <button class="ctd-btn" @click="fechar">Fechar</button>
          <span v-if="recado" class="ctd-recado" role="status" aria-live="polite">
            <IconeCerto /> {{ recado }}
          </span>
        </template>
        <template v-else>
          <button class="ctd-btn ctd-btn-primario" :disabled="!rasc.titulo.trim() || salvando" @click="salvar">
            {{ salvando ? 'Salvando…' : (ehNova ? 'Criar ideia' : 'Salvar') }}
          </button>
          <button class="ctd-btn" @click="cancelarEdicao">Cancelar</button>
        </template>
      </div>
    </div>
  </div>
  </Teleport>
</template>

<script setup>
import { computed, ref, reactive, onMounted, onUnmounted, nextTick } from 'vue'
import IconeFormato from './icone-formato.vue'
import { IconeFaisca, IconeCerto } from './icones.js'
import { FORMATOS, regrasDoFormato } from './formatos.js'
import { PILARES } from './pilares.js'
import {
  montarRoteiroParaCopiar, falaDoTake, rotuloDoPasso, duracaoTotalEmSegundos,
  ideiaEmBranco, limparParaGravar,
} from './roteiro.js'
import * as dados from './dados-conteudo.js'

const props = defineProps({
  ideia: { type: Object, required: true },
  accountId: { type: String, required: true },
  // Abre já em modo de escrita — é o caminho do "+ Anotar ideia".
  comecarEditando: { type: Boolean, default: false },
})

const emit = defineEmits(['fechar', 'virar-peca', 'mudou'])

const editando = ref(props.comecarEditando)
const salvando = ref(false)
const erro = ref('')
const recado = ref('')
const copiado = ref(false)
const campoTitulo = ref(null)
let relogioCopia = null
let relogioRecado = null

const ehNova = computed(() => !props.ideia?.id)
const rasc = reactive(ideiaEmBranco(props.ideia))

const takes = computed(() => Array.isArray(props.ideia.roteiro) ? props.ideia.roteiro : [])
const duracaoTotal = computed(() => duracaoTotalEmSegundos(takes.value))

const tituloDaLista = computed(() => rotuloDaLista(props.ideia.formato))
const tituloDaListaEdicao = computed(() => rotuloDaLista(rasc.formato))
const nomeDoPassoSingular = computed(() => rotuloDoPasso(1, rasc.formato))

function rotuloDaLista(formato) {
  if (formato === 'carrossel') return 'Os cards, em ordem'
  if (formato === 'feed') return 'A imagem'
  return 'Take a take'
}

function nomeDoFormato(chave) {
  return regrasDoFormato(chave)?.rotulo || chave || 'post'
}

// A IA às vezes devolve o gancho já entre aspas. Duas camadas de aspas fica feio
// e sugere citação de terceiro.
function semAspas(txt) {
  return String(txt || '').replace(/^["“”']+|["“”']+$/g, '')
}

function adicionarTake() {
  rasc.roteiro.push({
    cena: rasc.roteiro.length + 1, imagem: '', narracao: '', texto_na_tela: '', duracao_s: null,
  })
}

function moverTake(i, passo) {
  const j = i + passo
  if (j < 0 || j >= rasc.roteiro.length) return
  const [item] = rasc.roteiro.splice(i, 1)
  rasc.roteiro.splice(j, 0, item)
}

async function entrarNaEdicao() {
  editando.value = true
  await nextTick()
  campoTitulo.value?.focus()
}

function cancelarEdicao() {
  // Vindo do "+ Anotar ideia" não há leitura para onde voltar: fecha.
  if (ehNova.value) { fechar(); return }
  Object.assign(rasc, ideiaEmBranco(props.ideia))
  editando.value = false
  erro.value = ''
}

async function salvar() {
  if (!rasc.titulo.trim()) return
  erro.value = ''
  salvando.value = true
  try {
    const campos = { ...limparParaGravar(rasc), account_id: props.accountId }
    if (ehNova.value) await dados.criarIdeia(campos)
    else await dados.atualizarIdeia(props.ideia.id, campos)
    emit('mudou')
    // Criar fecha (a ideia nova aparece na lista atrás); editar volta para a
    // leitura, que é onde a pessoa confere o que acabou de escrever.
    if (ehNova.value) {
      fechar()
    } else {
      editando.value = false
      recado.value = 'Salvo'
      clearTimeout(relogioRecado)
      relogioRecado = setTimeout(() => { recado.value = '' }, 2600)
    }
  } catch (e) {
    erro.value = e.message
  } finally {
    salvando.value = false
  }
}

async function copiar() {
  try {
    await navigator.clipboard.writeText(montarRoteiroParaCopiar(props.ideia))
    copiado.value = true
    clearTimeout(relogioCopia)
    relogioCopia = setTimeout(() => { copiado.value = false }, 2000)
  } catch {
    // Sem permissão de área de transferência (acontece em http e em iOS antigo).
    // O texto continua todo visível na tela — não vale travar a interface.
  }
}

function fechar() { emit('fechar') }

// Esc fecha mesmo sem foco dentro do painel — o `@keydown.esc` do elemento só
// dispara com foco dentro dele, e quem abre no clique não tem.
// ESCREVENDO ELE NÃO FECHA: perder um roteiro inteiro por causa de uma tecla
// seria imperdoável.
function aoApertarEsc(e) {
  if (e.key !== 'Escape' || editando.value) return
  fechar()
}

onMounted(async () => {
  document.addEventListener('keydown', aoApertarEsc)
  if (props.comecarEditando) { await nextTick(); campoTitulo.value?.focus() }
})
onUnmounted(() => {
  document.removeEventListener('keydown', aoApertarEsc)
  clearTimeout(relogioCopia)
  clearTimeout(relogioRecado)
})
</script>
