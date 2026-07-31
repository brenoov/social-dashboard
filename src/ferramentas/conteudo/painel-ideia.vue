<template>
  <!-- O ROTEIRO ABERTO.
       Esta tela não é um formulário: é o que a pessoa lê com o celular na mão,
       prestes a gravar. Por isso a narração vem em corpo grande e entre aspas
       (é para ler em voz alta) e o "o que aparece na tela" vem menor ao lado —
       a fala é o que se executa, o enquadramento é a instrução.
       Trello mostra um cartão com descrição; aqui se abre um roteiro. -->
  <div class="ctd-fundo" @click.self="$emit('fechar')">
    <div
      class="ctd-painel ctd-painel-largo"
      role="dialog"
      aria-labelledby="ctd-ideia-titulo"
      tabindex="-1"
      @keydown.esc="$emit('fechar')"
    >
      <div class="ctd-painel-cab">
        <span v-if="ideia.origem === 'ia'" class="ctd-ideia-selo" title="Sugerida pela IA"><IconeFaisca /></span>
        <span id="ctd-ideia-titulo" class="ctd-painel-t">{{ ideia.titulo }}</span>
        <button class="ctd-fechar" aria-label="Fechar" @click="$emit('fechar')">×</button>
      </div>

      <div class="ctd-painel-corpo ctd-roteiro">
        <!-- Fita de identificação: formato, pilar e duração somada. A duração
             total é calculada, não pedida à IA: somar é trabalho de máquina. -->
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

        <!-- OS 3 PRIMEIROS SEGUNDOS. Ocupam o topo e o maior corpo de texto da
             tela porque são, de fato, o que decide se alguém assiste ao resto. -->
        <section v-if="ideia.gancho" class="ctd-gancho3">
          <span class="ctd-gancho3-rot">Os 3 primeiros segundos</span>
          <p class="ctd-gancho3-txt">{{ semAspas(ideia.gancho) }}</p>
        </section>

        <section v-if="ideia.producao" class="ctd-rot-bloco ctd-rot-producao">
          <h3 class="ctd-rot-h">Antes de gravar, tenha em mãos</h3>
          <p>{{ ideia.producao }}</p>
        </section>

        <!-- OS TAKES. Linha do tempo vertical: número, duração, o que aparece,
             o que se fala. Em carrossel cada item é um card; em feed, a imagem
             única. O rótulo muda junto para não mentir sobre o que é. -->
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

      <div class="ctd-painel-rodape">
        <button class="ctd-btn ctd-btn-primario" @click="$emit('virar-peca', ideia)">
          <IconeCerto /> Virar peça
        </button>
        <button class="ctd-btn" @click="copiar">
          {{ copiado ? 'Copiado!' : 'Copiar roteiro' }}
        </button>
        <button class="ctd-btn" @click="$emit('fechar')">Fechar</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import IconeFormato from './icone-formato.vue'
import { IconeFaisca, IconeCerto } from './icones.js'
import { regrasDoFormato } from './formatos.js'
import {
  montarRoteiroParaCopiar, falaDoTake, rotuloDoPasso, duracaoTotalEmSegundos,
} from './roteiro.js'

const props = defineProps({
  ideia: { type: Object, required: true },
})

const emit = defineEmits(['fechar', 'virar-peca'])

const copiado = ref(false)
let relogioCopia = null

const takes = computed(() => Array.isArray(props.ideia.roteiro) ? props.ideia.roteiro : [])

const duracaoTotal = computed(() => duracaoTotalEmSegundos(takes.value))

const tituloDaLista = computed(() => {
  if (props.ideia.formato === 'carrossel') return 'Os cards, em ordem'
  if (props.ideia.formato === 'feed') return 'A imagem'
  return 'Take a take'
})

function nomeDoFormato(chave) {
  return regrasDoFormato(chave)?.rotulo || chave || 'post'
}

// A IA às vezes devolve o gancho já entre aspas. Duas camadas de aspas no meio
// do título fica feio e sugere citação de terceiro.
function semAspas(txt) {
  return String(txt || '').replace(/^["“”']+|["“”']+$/g, '')
}

async function copiar() {
  try {
    await navigator.clipboard.writeText(montarRoteiroParaCopiar(props.ideia))
    copiado.value = true
    clearTimeout(relogioCopia)
    relogioCopia = setTimeout(() => { copiado.value = false }, 2000)
  } catch {
    // Sem permissão de área de transferência (acontece em http e em iOS antigo).
    // O texto continua todo visível na tela — não vale travar a interface por isso.
  }
}

// Esc fecha mesmo sem foco dentro do painel. O `@keydown.esc` do elemento só
// dispara com o foco dentro dele, e quem abre no clique não tem foco ali — o
// atalho ficaria morto justamente no caminho mais comum.
function aoApertarEsc(e) {
  if (e.key === 'Escape') emit('fechar')
}
onMounted(() => document.addEventListener('keydown', aoApertarEsc))
onUnmounted(() => {
  document.removeEventListener('keydown', aoApertarEsc)
  clearTimeout(relogioCopia)
})
</script>
