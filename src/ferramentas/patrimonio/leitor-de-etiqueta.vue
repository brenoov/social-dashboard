<script setup>
/* A câmera lendo a etiqueta de patrimônio.
 *
 * Dois leitores, nesta ordem:
 *
 *  1. O do próprio navegador (`BarcodeDetector`). Existe no Chrome do Android e
 *     é de graça — nada pra baixar, e mais rápido porque roda fora do
 *     JavaScript.
 *  2. A biblioteca ZXing, baixada SOB DEMANDA com `import()`. É o caminho do
 *     iPhone: o Safari não tem leitor nativo (checado: segue desligado por
 *     padrão até as versões mais recentes). São algumas centenas de KB, e por
 *     isso ela não pode entrar no carregamento normal do app — quem só quer
 *     olhar a lista de bens não deve pagar por um leitor que não vai usar.
 *
 * O que este arquivo NÃO decide: o que fazer com o texto lido. Isso é do
 * leitor-de-codigo.js, que é testável sem câmera. Aqui só tem vídeo e ciclo de
 * vida — e o ciclo de vida é o que importa: câmera que não é desligada fica com
 * a luzinha acesa e come bateria mesmo com a janela fechada. */
import { ref, watch, onUnmounted } from 'vue'

const props = defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue', 'leu'])

const video = ref(null)
const erro = ref('')
const preparando = ref(false)
const demorando = ref(false)   // 12s tentando: hora de oferecer a saída manual
let relogio = null
let fluxo = null          // o MediaStream da câmera
let parar = false         // corta o laço de leitura

function fechar() { emit('update:modelValue', false) }

async function abrir() {
  erro.value = ''
  preparando.value = true
  parar = false
  try {
    // `ideal` e não `exact`: em aparelho sem câmera traseira (notebook), exact
    // recusa e não abre nada. Assim ele cai na que existir.
    fluxo = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
      audio: false,
    })
  } catch (e) {
    preparando.value = false
    erro.value = e && e.name === 'NotAllowedError'
      ? 'Você não deu permissão de câmera. Libere nos ajustes do navegador e tente de novo.'
      : 'Não consegui abrir a câmera deste aparelho.'
    return
  }
  // O elemento só existe depois que o v-if montou a janela.
  await new Promise((ok) => requestAnimationFrame(ok))
  const el = video.value
  if (!el) { desligar(); return }
  el.srcObject = fluxo
  el.setAttribute('playsinline', '')   // sem isso o iPhone abre em tela cheia própria
  await el.play().catch(() => {})
  preparando.value = false
  // Etiqueta rasgada, suja ou com reflexo teimoso existe. Depois de um tempo
  // parado apontando, a pessoa precisa ouvir que dá pra digitar — senão ela
  // fica ali achando que é ela que está fazendo errado.
  relogio = setTimeout(() => { demorando.value = true }, 12000)
  procurar(el)
}

async function procurar(el) {
  const Nativo = window.BarcodeDetector
  if (Nativo) {
    try {
      const det = new Nativo({ formats: ['code_128', 'code_39', 'code_93', 'itf', 'ean_13'] })
      return laco(() => det.detect(el).then((r) => (r[0] ? r[0].rawValue : null)))
    } catch (e) { /* formato não suportado neste aparelho: cai pro ZXing */ }
  }
  let zx
  try {
    zx = await import('@zxing/library')
  } catch (e) {
    erro.value = 'Não consegui carregar o leitor de código de barras. Confira a conexão e tente de novo.'
    return
  }

  /* A leitura pronta do ZXing (`decodeFromStream`, que olha os quadros sozinho)
     NÃO fechou a leitura da nossa etiqueta — testado com a foto de uma etiqueta
     de verdade entrando como se fosse a câmera: 20 segundos sem ler nada.
     O que funciona, e leu em 249ms, é tratar cada quadro antes:

       1. recortar o MIOLO (o mesmo pedaço que a mira desenha na tela) — o
          quadro inteiro, com a mesa e a sombra em volta, atrapalha;
       2. ampliar 2×;
       3. jogar o contraste no talo (barra vira preta, papel vira branco),
          alternando o ponto de corte a cada quadro, porque o reflexo em cima do
          código muda o valor que funciona;
       4. só então entregar pro leitor, com as dicas ligadas.

     Cada etapa dessas foi medida — nenhuma está aqui por precaução. */
  const dicas = new Map()
  dicas.set(zx.DecodeHintType.TRY_HARDER, true)
  dicas.set(zx.DecodeHintType.POSSIBLE_FORMATS,
    [zx.BarcodeFormat.CODE_128, zx.BarcodeFormat.CODE_39, zx.BarcodeFormat.CODE_93,
      zx.BarcodeFormat.ITF, zx.BarcodeFormat.EAN_13])

  const tela = document.createElement('canvas')
  const pincel = tela.getContext('2d', { willReadFrequently: true })
  const CORTES = [0, 90, 110, 130, 150, 170]   // 0 = sem contraste, deixa o leitor decidir
  let volta = 0

  laco(() => {
    if (!el.videoWidth) return null
    // Mesmas proporções da mira no <template>: o que a pessoa encaixa é o que
    // o leitor lê. Se um dos dois mudar, o outro tem que mudar junto.
    const RX = 0.08, RY = 0.20, RW = 0.84, RH = 0.60, ESC = 2
    const sw = el.videoWidth * RW, sh = el.videoHeight * RH
    tela.width = Math.round(sw * ESC)
    tela.height = Math.round(sh * ESC)
    pincel.drawImage(el, el.videoWidth * RX, el.videoHeight * RY, sw, sh, 0, 0, tela.width, tela.height)

    const img = pincel.getImageData(0, 0, tela.width, tela.height)
    const corte = CORTES[volta++ % CORTES.length]
    const pontos = new Int32Array(tela.width * tela.height)
    for (let k = 0, j = 0; k < img.data.length; k += 4, j++) {
      const luz = img.data[k] * 0.3 + img.data[k + 1] * 0.59 + img.data[k + 2] * 0.11
      const t = corte ? (luz > corte ? 255 : 0) : luz | 0
      pontos[j] = (t << 16) | (t << 8) | t
    }
    const fonte = new zx.RGBLuminanceSource(pontos, tela.width, tela.height)
    for (const Binarizador of [zx.HybridBinarizer, zx.GlobalHistogramBinarizer]) {
      // Leitor NOVO a cada tentativa: `reset()` zera os leitores internos que
      // `setHints()` montou, e reusar a instância faria a segunda leitura em
      // diante rodar sem as dicas.
      const leitor = new zx.MultiFormatReader()
      leitor.setHints(dicas)
      try {
        return leitor.decode(new zx.BinaryBitmap(new Binarizador(fonte))).getText()
      } catch (e) { /* este corte não fechou; o próximo quadro tenta outro */ }
    }
    return null
  })
}

// Um quadro por vez, sem empilhar: se a leitura de um quadro demora, o próximo
// só começa depois. `requestAnimationFrame` sozinho enfileiraria trabalho em
// cima de trabalho e travaria o vídeo.
function laco(lerUmQuadro) {
  const passo = async () => {
    if (parar) return
    let texto = null
    try { texto = await lerUmQuadro() } catch (e) { /* quadro ruim, segue */ }
    if (texto) return achou(texto)
    setTimeout(passo, 60)
  }
  passo()
}

function achou(texto) {
  if (parar) return
  parar = true
  // Um tremidinho confirma a leitura sem a pessoa precisar olhar a tela — ela
  // está de pé, com a caixa na outra mão.
  try { navigator.vibrate && navigator.vibrate(60) } catch (e) { /* sem vibração, tudo bem */ }
  emit('leu', texto)
  fechar()
}

function desligar() {
  parar = true
  if (relogio) { clearTimeout(relogio); relogio = null }
  demorando.value = false
  // ESTA parte não pode falhar: sem parar as trilhas, a câmera continua ligada
  // com a janela fechada — luz acesa e bateria indo embora.
  if (fluxo) { try { fluxo.getTracks().forEach((t) => t.stop()) } catch (e) { /* já parada */ } }
  fluxo = null
  if (video.value) video.value.srcObject = null
}

watch(() => props.modelValue, (v) => { if (v) abrir(); else desligar() })
onUnmounted(desligar)
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="let-fundo" @click.self="fechar">
      <div class="let-caixa" role="dialog" aria-label="Ler etiqueta com a câmera">
        <div class="let-topo">
          <span class="let-titulo">Aponte para a etiqueta</span>
          <button type="button" class="let-fechar" @click="fechar" aria-label="Fechar">✕</button>
        </div>

        <div class="let-palco">
          <video ref="video" class="let-video" muted playsinline></video>
          <!-- A moldura NÃO é decoração: é exatamente o pedaço do quadro que o
               leitor analisa (8%/20% de cada lado, veja `procurar`). Ler o
               quadro inteiro não funciona — testado. Se mexer numa, mexa na
               outra. -->
          <div class="let-mira" aria-hidden="true"></div>
          <p v-if="preparando" class="let-aviso">Ligando a câmera…</p>
        </div>

        <p v-if="erro" class="let-erro">{{ erro }}</p>
        <p v-else-if="demorando" class="let-erro">
          Essa etiqueta está difícil. Mude o ângulo para tirar o reflexo de cima do código —
          ou feche e digite o número que está impresso embaixo dele.
        </p>
        <p v-else class="let-dica">
          Encoste o celular a um palmo da etiqueta. Se não ler, mude o ângulo para tirar
          o reflexo de cima do código — ou digite o número na busca.
        </p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.let-fundo{position:fixed;inset:0;z-index:10060;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:14px;}
/* Centralizado COM margem, nunca colado nas bordas — é o padrão dos modais
   desta central, pedido do dono. */
.let-caixa{width:100%;max-width:520px;max-height:calc(100dvh - 28px);display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4);}
.let-topo{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid var(--border);}
.let-titulo{font-family:var(--fonte-principal);font-size:13px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:var(--text);}
.let-fechar{appearance:none;border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:9px;width:34px;height:34px;font-size:15px;cursor:pointer;flex:0 0 auto;}
.let-palco{position:relative;background:#000;aspect-ratio:4/3;overflow:hidden;}
.let-video{width:100%;height:100%;object-fit:cover;display:block;}
.let-mira{position:absolute;left:8%;right:8%;top:20%;bottom:20%;border:2px solid rgba(255,255,255,.85);border-radius:10px;box-shadow:0 0 0 9999px rgba(0,0,0,.28);}
.let-aviso{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;margin:0;color:#fff;font-family:var(--fonte-principal);font-size:13px;}
.let-dica,.let-erro{margin:0;padding:12px 14px;font-family:var(--fonte-principal);font-size:12.5px;line-height:1.55;color:var(--muted);}
.let-erro{color:var(--red,#c0392b);}
</style>
