<script setup>
/* O CAMPO DE RABISCAR — onde a pessoa assina com o dedo.
 *
 * PEDIDO DO DONO: "tem algo que deixe mais fiel e comprovo? tipo um campo para
 * a pessoa rabiscar e assinar?". A senha continua sendo a prova técnica; o
 * rabisco é o gesto deliberado — a pessoa sabendo que está assinando.
 *
 * ONDE ISTO É USADO, e é o que decide o desenho: de pé no estacionamento, com o
 * dedo, no celular, com pressa. Por isso:
 *  - a área de desenho é GENEROSA (assinar apertado com o dedo sai feio, e sair
 *    feio faz a pessoa apagar e tentar de novo até desistir);
 *  - vale dedo, caneta e mouse — os eventos são de PONTEIRO, não de mouse;
 *  - a página NÃO ROLA enquanto o dedo desenha (`touch-action:none` no canvas):
 *    sem isso, o primeiro traço vira uma rolagem e a tela foge da mão;
 *  - apagar e refazer é um botão à vista, não um gesto escondido.
 *
 * O QUE SAI DAQUI são os TRAÇOS, não uma imagem: lista de traços, cada um uma
 * lista de pontos [x,y] de 0 a 1 relativos à área. Duas razões concretas — o
 * gerador de PDF deste módulo é escrito à mão e desenha LINHA (não imagem), e
 * pontos entram na impressão digital de forma limpa. A arrumação dos pontos
 * mora em rabisco.js, testada.
 *
 * A TINTA SAI DE TOKEN, e isto não é preciosismo: um canvas não enxerga
 * `var(--text)`, então a cor é LIDA do estilo aplicado ao próprio canvas
 * (`getComputedStyle`). Tinta preta cravada sumiria no tema escuro e branca
 * sumiria no claro — e ninguém repara num traço invisível até o papel sair em
 * branco.
 *
 * TELA DE ALTA DENSIDADE (iPhone): o canvas tem DOIS tamanhos — o de tela (CSS)
 * e o de desenho (pixels de verdade). Sem multiplicar o segundo pelo
 * `devicePixelRatio`, o traço sai borrado no celular, que é justamente onde
 * isto vai ser usado. */
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { normalizarRabisco, pontosDoRabisco } from '../../../supabase/functions/_shared/rabisco.js'

const props = defineProps({
  // Os traços já arrumados (o que vai pro banco), ou nulo se não há desenho.
  modelValue: { type: Array, default: null },
  // Trava enquanto grava: rabiscar durante a gravação mudaria o desenho depois
  // de a impressão digital já ter sido calculada.
  desabilitado: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

const caixa = ref(null)
const tela = ref(null)

// Os traços prontos, e o que está sendo desenhado agora. Separados porque o
// traço em andamento ainda não passou pela arrumação — ele só vira dado quando
// o dedo levanta.
const tracos = ref([])
const emAndamento = ref(null)
const ponteiro = ref(null)

const temDesenho = computed(() => pontosDoRabisco(tracos.value) > 0)

/* ── O desenho na tela ────────────────────────────────────────────────────── */

// Quanto o traço é grosso, em pixels de tela. Dedo pede traço encorpado: fino
// demais some no sol e no vidro sujo de um celular de estacionamento.
const GROSSURA = 2.4

function medida() {
  const c = tela.value
  if (!c) return null
  const r = c.getBoundingClientRect()
  return r.width > 0 && r.height > 0 ? r : null
}

/** Ajusta o tamanho de desenho ao tamanho de tela, respeitando a densidade. */
function ajustarTamanho() {
  const c = tela.value
  const r = medida()
  if (!c || !r) return
  // Teto de 3: acima disso o ganho não se vê e o custo de memória cresce ao
  // quadrado (um canvas de 4x em tela grande passa de 30 MB).
  const densidade = Math.min(3, Math.max(1, window.devicePixelRatio || 1))
  const larg = Math.round(r.width * densidade)
  const alt = Math.round(r.height * densidade)
  if (c.width !== larg || c.height !== alt) { c.width = larg; c.height = alt }
  redesenhar()
}

function redesenhar() {
  const c = tela.value
  const r = medida()
  if (!c || !r) return
  const ctx = c.getContext('2d')
  if (!ctx) return
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, c.width, c.height)
  // A partir daqui se desenha em pixels de TELA: a escala cuida da densidade,
  // e assim a grossura do traço não muda de aparelho pra aparelho.
  ctx.scale(c.width / r.width, c.height / r.height)

  // A tinta sai do token aplicado ao canvas — muda sozinha com o tema.
  ctx.strokeStyle = getComputedStyle(c).color
  ctx.lineWidth = GROSSURA
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const todos = emAndamento.value ? [...tracos.value, emAndamento.value] : tracos.value
  for (const traco of todos) {
    if (!traco.length) continue
    ctx.beginPath()
    for (let i = 0; i < traco.length; i++) {
      const x = traco[i][0] * r.width
      const y = traco[i][1] * r.height
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    // Um toque só é um ponto, e um ponto tem de aparecer: sem este `lineTo` em
    // cima de si mesmo, o navegador não desenha nada e a pessoa acha que o
    // campo não funciona.
    if (traco.length === 1) ctx.lineTo(traco[0][0] * r.width, traco[0][1] * r.height)
    ctx.stroke()
  }
}

/* ── O dedo ───────────────────────────────────────────────────────────────── */

function pontoDoEvento(ev) {
  const r = medida()
  if (!r) return null
  // Sem prender entre 0 e 1 aqui de propósito: quem prende é `normalizarRabisco`,
  // num lugar só e testado. Aqui o traço em andamento pode passar da borda — na
  // tela ele é cortado pelo próprio canvas.
  return [(ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height]
}

function comecar(ev) {
  if (props.desabilitado || ponteiro.value !== null) return
  // Botão direito e botão do meio não assinam. Só o mouse tem isso: no dedo e
  // na caneta o `button` já vem 0.
  if (ev.pointerType === 'mouse' && ev.button !== 0) return
  const p = pontoDoEvento(ev)
  if (!p) return
  // Segura o ponteiro: sem isto, arrastar pra fora do quadro faz o traço parar
  // no meio e nunca receber o "levantou o dedo" — e o traço seguinte emendaria
  // no anterior.
  try { ev.target.setPointerCapture(ev.pointerId) } catch { /* navegador sem captura */ }
  ponteiro.value = ev.pointerId
  emAndamento.value = [p]
  ev.preventDefault()
  redesenhar()
}

function andar(ev) {
  if (ponteiro.value !== ev.pointerId || !emAndamento.value) return
  ev.preventDefault()
  // `getCoalescedEvents` devolve as posições que o navegador juntou entre dois
  // quadros. Sem ele, um dedo rápido vira uma linha reta de canto a canto.
  const passos = typeof ev.getCoalescedEvents === 'function'
    ? (ev.getCoalescedEvents() || [ev]) : [ev]
  for (const passo of (passos.length ? passos : [ev])) {
    const p = pontoDoEvento(passo)
    if (p) emAndamento.value.push(p)
  }
  redesenhar()
}

function terminar(ev) {
  if (ponteiro.value !== ev.pointerId) return
  ponteiro.value = null
  const traco = emAndamento.value
  emAndamento.value = null
  if (!traco) return
  // O traço só vira dado DEPOIS de arrumado, e a lista inteira é rearrumada
  // junto: assim o que está na tela é exatamente o que vai pro banco e pro
  // texto assinado — nada é arredondado só na saída.
  tracos.value = normalizarRabisco([...tracos.value, traco]) || []
  redesenhar()
  avisar()
}

/* O dedo saiu do quadro.
 *
 * COM CAPTURA, ISTO NÃO PODE TERMINAR O TRAÇO: quem tem a captura continua
 * recebendo os movimentos de fora, e cortar aqui partiria em dois um traço que
 * passou da borda — que é comum, porque a pessoa assina depressa. A checagem de
 * captura existe pro caso de o navegador não ter dado a captura: aí, sim, sem
 * este corte o traço nunca receberia o "levantou o dedo". */
function sair(ev) {
  const c = tela.value
  if (c && typeof c.hasPointerCapture === 'function' && c.hasPointerCapture(ev.pointerId)) return
  terminar(ev)
}

function apagar() {
  if (props.desabilitado) return
  tracos.value = []
  emAndamento.value = null
  ponteiro.value = null
  redesenhar()
  avisar()
}

// Nulo quando não há desenho — a mesma forma que a coluna guarda pra ficha
// assinada só com senha (ver rabisco.js).
const avisar = () => emit('update:modelValue', tracos.value.length ? tracos.value : null)

/* ── Ciclo de vida ────────────────────────────────────────────────────────── */

let observadorDeTamanho = null
let observadorDeTema = null

onMounted(() => {
  ajustarTamanho()
  if (typeof ResizeObserver === 'function' && tela.value) {
    observadorDeTamanho = new ResizeObserver(() => ajustarTamanho())
    observadorDeTamanho.observe(tela.value)
  } else {
    window.addEventListener('resize', ajustarTamanho)
  }
  // O tema troca no `data-theme` da raiz do documento. O canvas não reage a CSS
  // sozinho: sem redesenhar, o traço fica com a tinta do tema anterior — preto
  // no escuro, invisível.
  if (typeof MutationObserver === 'function') {
    observadorDeTema = new MutationObserver(() => redesenhar())
    observadorDeTema.observe(document.documentElement, {
      attributes: true, attributeFilter: ['data-theme'],
    })
  }
})

onBeforeUnmount(() => {
  if (observadorDeTamanho) observadorDeTamanho.disconnect()
  else window.removeEventListener('resize', ajustarTamanho)
  if (observadorDeTema) observadorDeTema.disconnect()
})

// Quem usa este campo pode limpá-lo de fora (o cartão apaga tudo depois de
// gravar). Só reage quando o valor de fora DIVERGE do que está desenhado, pra
// não redesenhar a cada traço emitido.
watch(() => props.modelValue, (novo) => {
  const atual = tracos.value.length ? tracos.value : null
  if (JSON.stringify(novo ?? null) === JSON.stringify(atual)) return
  tracos.value = normalizarRabisco(novo) || []
  redesenhar()
})
</script>

<template>
  <div class="rb" ref="caixa">
    <div class="rb-topo">
      <!-- Curto de propósito: a 375px o rótulo e o botão dividem a MESMA linha,
           e um rótulo comprido empurrava o botão pra linha de baixo, onde ele
           ficava com a largura inteira e a cara da ação principal do cartão —
           que é "Assinar e gravar", não "apagar". Visto na tela. -->
      <span class="rb-lab">Sua assinatura</span>
      <button type="button" class="rb-apagar" :disabled="!temDesenho || desabilitado"
              @click="apagar">Apagar e refazer</button>
    </div>

    <div class="rb-quadro" :class="{ vazio: !temDesenho, travado: desabilitado }">
      <!-- A linha e o convite ficam FORA do canvas: dentro, eles entrariam no
           desenho e "apagar" teria de redesenhá-los. -->
      <span class="rb-convite" v-if="!temDesenho" aria-hidden="true">assine aqui com o dedo</span>
      <span class="rb-linha" aria-hidden="true"></span>
      <canvas ref="tela" class="rb-tela"
              role="img" aria-label="Área para assinar com o dedo"
              @pointerdown="comecar" @pointermove="andar"
              @pointerup="terminar" @pointercancel="terminar" @pointerleave="sair"></canvas>
    </div>

    <!-- O AVISO VEM ANTES, não depois. O banco recusa mexer em ficha assinada
         (gatilho da D21); deixar a pessoa descobrir isso pelo erro do banco,
         depois de assinar, é defeito. -->
    <!-- Curto porque a nota logo abaixo, no cartão, já explica que a ficha
         assinada não muda mais: repetir a mesma frase duas vezes seguidas faz
         as duas virarem paisagem. -->
    <p class="rb-nota">
      Pode apagar e refazer quantas vezes quiser — mas só <strong>antes</strong> de assinar.
    </p>
  </div>
</template>

<style scoped>
/* Tudo em cima das variáveis do app (--surface, --border, --text…), nunca cor
   chumbada: é o que faz o campo seguir o tema claro e o escuro. A variável de
   borda deste app é `--border` — `--borda` NÃO existe, e foi o que já obrigou a
   refazer o cartão inteiro do checklist. */
.rb { margin-top: var(--sp-3); }

.rb-topo { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); }
.rb-lab {
  display: block; font-size: 10px; font-weight: 700; letter-spacing: 1.6px;
  text-transform: uppercase; color: var(--muted);
}
/* Botão de borda e fundo transparente — nunca cinza, como manda o padrão. */
.rb-apagar {
  background: none; border: 1px solid var(--border); border-radius: var(--radius-md);
  cursor: pointer; padding: 0 var(--sp-3); min-height: 40px;
  font-family: var(--fonte-principal); font-size: 12px; font-weight: 600;
  color: var(--accent); white-space: nowrap;
}
.rb-apagar:hover:not(:disabled) { border-color: var(--accent-forte); }
.rb-apagar:disabled { color: var(--muted); cursor: default; opacity: .6; }

.rb-quadro {
  position: relative; margin-top: var(--sp-2);
  border: 1px solid var(--border); border-radius: var(--radius-md);
  background: var(--bg); overflow: hidden;
  /* A PROPORÇÃO É FIXA, e isso não é estética: os pontos são gravados de 0 a 1
     RELATIVOS a este quadro. Se ele fosse largo e baixo no computador e quase
     quadrado no celular, o mesmo rabisco sairia esticado num e espremido no
     outro — inclusive no papel, que desenha numa caixa de proporção fixa.
     2:1 é o que dá, numa tela de 375px, um campo GENEROSO (≈165px de altura)
     sem empurrar o botão de gravar pra fora do alcance do polegar — medido. */
  aspect-ratio: 2 / 1;
  /* No computador o quadro para de crescer: um campo de assinatura de 600px de
     largura por 300px de altura é maior que a folha onde ele vai ser impresso. */
  max-width: 420px;
}
/* Navegador sem `aspect-ratio` não pode ficar com um quadro de altura zero. */
@supports not (aspect-ratio: 2 / 1) {
  .rb-quadro { height: 168px; }
}
.rb-quadro.vazio { border-style: dashed; }
.rb-quadro.travado { opacity: .6; }

/* A linha de assinatura, como no papel. Fica no fundo, nunca no desenho. */
.rb-linha {
  position: absolute; left: var(--sp-4); right: var(--sp-4); bottom: 34px;
  height: 1px; background: var(--border);
}
.rb-convite {
  position: absolute; left: 0; right: 0; bottom: 12px; text-align: center;
  font-size: 12px; color: var(--muted); pointer-events: none;
}

.rb-tela {
  /* `inset:0` em vez de 100%/100%: a altura do quadro vem de `aspect-ratio`, e
     altura em porcentagem sobre isso é justamente onde navegador antigo devolve
     zero — um canvas de altura zero não desenha nada e não recebe o dedo. */
  position: absolute; inset: 0; display: block; width: 100%; height: 100%;
  /* A COR DA TINTA. O canvas não lê `var(--text)` sozinho — o desenho lê ISTO
     com getComputedStyle. Trocar por um hex faria o traço sumir num dos temas. */
  color: var(--text);
  /* O DEFEITO MAIS PROVÁVEL DESTE CAMPO: sem isto, o primeiro traço no celular
     rola a página em vez de desenhar, e a tela foge da mão de quem assina. */
  touch-action: none;
  /* Arrastar o dedo não pode selecionar o texto em volta nem abrir o menu de
     copiar do iOS por cima do quadro. */
  user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
  cursor: crosshair;
}
.rb-quadro.travado .rb-tela { cursor: default; }

.rb-nota { margin: var(--sp-2) 0 0; font-size: 12px; color: var(--muted); line-height: 1.45; }

/* Tela estreita: o quadro ocupa a largura inteira — a proporção continua a
   mesma, então o rabisco sai igual aqui e no computador.
   O botão NÃO vira largura inteira: nesta tela quem tem largura inteira é
   "Assinar e gravar", e dois botões dessa cara competindo é o mesmo que nenhum. */
@media (max-width: 560px) {
  .rb-quadro { max-width: none; }
  .rb-apagar { padding: 0 var(--sp-2); }
}
</style>
