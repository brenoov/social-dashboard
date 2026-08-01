<template>
  <div class="ctd-kb-rolagem">
    <div class="ctd-kb">
      <div
        v-for="coluna in colunas"
        :key="coluna.chave"
        class="ctd-kb-col"
        :class="{ alvo: alvo === coluna.chave }"
        :style="{ '--ctd-cor-coluna': coluna.cor }"
        @dragover.prevent="aoArrastarSobre($event, coluna)"
        @dragleave="aoSairDaColuna($event, coluna)"
        @drop.prevent="aoSoltar(coluna)"
      >
        <div class="ctd-kb-cab">
          <span class="ctd-kb-bolinha" :style="{ background: coluna.cor }"></span>
          <span class="ctd-kb-nome">{{ coluna.rotulo }}</span>
          <span class="ctd-kb-conta">{{ coluna.total }}</span>
        </div>

        <div class="ctd-kb-lista">
          <div
            v-for="peca in coluna.pecas"
            :key="peca.id"
            class="ctd-kb-item"
            draggable="true"
            @dragstart="aoComecarArrasto($event, peca)"
            @dragend="arrastando = null; alvo = ''"
          >
            <CartaoPeca
              :peca="peca"
              :miniatura="miniaturas[peca.id]"
              :metrica="metricas[peca.id]"
              com-data
              @abrir="$emit('abrir', $event)"
            />

            <!-- O CAMINHO SEM ARRASTAR.
                 Arrastar não existe em tela de toque, e a aba Quadro virava só
                 leitura no celular — que é onde a ferramenta mais vai ser usada.
                 Este menu é o mesmo movimento por outro gesto, e serve também a
                 quem prefere clicar no computador. -->
            <div v-if="destinosDe(peca).length" class="ctd-kb-mover">
              <span class="ctd-kb-mover-rot">mover para</span>
              <button
                v-for="d in destinosDe(peca)"
                :key="d.chave"
                class="ctd-kb-mover-btn"
                :style="{ '--ctd-cor-destino': d.cor }"
                @click.stop="moverPara(peca, d.chave)"
              >{{ d.rotulo }}</button>
            </div>
          </div>

          <p v-if="!coluna.total" class="ctd-kb-vazia">{{ VAZIAS[coluna.chave] }}</p>
        </div>
      </div>
    </div>

    <!-- AS REPROVADAS. Não são coluna (não são etapa do caminho), mas sumir
         em silêncio era pior: quem reprovava via o cartão evaporar do quadro.
         Aqui elas são o que de fato são — fila de conserto. -->
    <section v-if="reprovadas.length" class="ctd-kb-recusadas">
      <header>
        <span class="ctd-kb-recusadas-t">
          {{ reprovadas.length }}
          {{ reprovadas.length === 1 ? 'peça reprovada' : 'peças reprovadas' }}
        </span>
        <span class="ctd-ajuda">Precisam de conserto para voltar à fila.</span>
      </header>
      <div class="ctd-kb-recusadas-fila">
        <div v-for="peca in reprovadas" :key="peca.id" class="ctd-kb-item">
          <CartaoPeca
            :peca="peca"
            :miniatura="miniaturas[peca.id]"
            :metrica="metricas[peca.id]"
            @abrir="$emit('abrir', $event)"
          />
          <div v-if="destinosDe(peca).length" class="ctd-kb-mover">
            <span class="ctd-kb-mover-rot">mover para</span>
            <button
              v-for="d in destinosDe(peca)"
              :key="d.chave"
              class="ctd-kb-mover-btn"
              :style="{ '--ctd-cor-destino': d.cor }"
              @click.stop="moverPara(peca, d.chave)"
            >{{ d.rotulo }}</button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import CartaoPeca from './cartao-peca.vue'
import { agruparPorStatus, pecasReprovadas } from './agrupar-kanban.js'
import { podeTransicionar, transicoesPermitidas, rotuloDeStatus, corDeStatus } from './estados.js'

const props = defineProps({
  pecas: { type: Array, default: () => [] },
  miniaturas: { type: Object, default: () => ({}) },
  metricas: { type: Object, default: () => ({}) },
  podeAprovar: { type: Boolean, default: false },
})

const emit = defineEmits(['abrir', 'mover'])

// Coluna vazia explica o que entra nela, em vez de um "—" mudo.
const VAZIAS = {
  rascunho: 'Nada em rascunho.',
  em_aprovacao: 'Ninguém esperando aprovação.',
  aprovada: 'Nada aprovado esperando data.',
  agendada: 'Nada agendado.',
  publicada: 'Nada publicado ainda.',
}

const arrastando = ref(null)
const alvo = ref('')

const colunas = computed(() => agruparPorStatus(props.pecas))
const reprovadas = computed(() => pecasReprovadas(props.pecas))

function permitido(coluna) {
  if (!arrastando.value) return false
  if (arrastando.value.status === coluna.chave) return false
  return podeTransicionar(arrastando.value.status, coluna.chave, {
    podeAprovar: props.podeAprovar,
    temData: !!arrastando.value.publicar_em,
  }).ok
}

// O FIREFOX EXIGE `setData` PARA O ARRASTE COMEÇAR.
//
// Sem esta chamada o `dragstart` até dispara, mas nenhum `dragover`/`drop`
// acontece — ou seja, a funcionalidade-título da aba não funcionava num
// navegador inteiro, e em silêncio. `effectAllowed`/`dropEffect` são o que
// tira o cursor de "proibido" em cima de coluna válida.
function aoComecarArrasto(ev, peca) {
  arrastando.value = peca
  if (ev.dataTransfer) {
    ev.dataTransfer.effectAllowed = 'move'
    ev.dataTransfer.setData('text/plain', peca.id)
  }
}

function aoArrastarSobre(ev, coluna) {
  const ok = permitido(coluna)
  if (ev.dataTransfer) ev.dataTransfer.dropEffect = ok ? 'move' : 'none'
  alvo.value = ok ? coluna.chave : ''
}

// `dragleave` borbulha de cada cartão filho, então o realce da coluna piscava a
// cada cartão que o cursor cruzava. Só apaga quando o ponteiro sai de verdade
// da coluna inteira.
function aoSairDaColuna(ev, coluna) {
  if (ev.currentTarget.contains(ev.relatedTarget)) return
  if (alvo.value === coluna.chave) alvo.value = ''
}

function aoSoltar(coluna) {
  const peca = arrastando.value
  alvo.value = ''
  arrastando.value = null
  if (!peca || peca.status === coluna.chave) return
  moverPara(peca, coluna.chave)
}

// Os destinos possíveis a partir do estado atual da peça, já filtrados pelo que
// ela de fato pode fazer agora (quem aprova, se tem data).
function destinosDe(peca) {
  return transicoesPermitidas(peca.status)
    .filter(chave => podeTransicionar(peca.status, chave, {
      podeAprovar: props.podeAprovar,
      temData: !!peca.publicar_em,
    }).ok)
    .map(chave => ({ chave, rotulo: rotuloDeStatus(chave), cor: corDeStatus(chave) }))
}

function moverPara(peca, destino) {
  // Quem decide de verdade é quem recebe o evento (e depois o banco). Aqui a
  // checagem serve para não emitir um movimento que já se sabe recusado.
  const veredito = podeTransicionar(peca.status, destino, {
    podeAprovar: props.podeAprovar,
    temData: !!peca.publicar_em,
  })
  emit('mover', { peca, destino, veredito })
}
</script>
