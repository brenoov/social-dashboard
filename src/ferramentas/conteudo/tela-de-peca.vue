<template>
  <!-- Tela de UMA peça. É o destino do aviso da hora H, então é pensada para o
       celular: a arte grande, a legenda pronta para copiar e dois botões
       grandes. Quem chega aqui está em pé, na frente do Instagram aberto. -->
  <div class="ctd-tela">
    <barra-de-topo voltar="Central de Conteúdo" titulo="Hora de publicar" @voltar="router.push({ name: 'conteudo' })" />

    <div class="ctd-body">
      <div v-if="carregando" class="ctd-vazio"><p>Carregando…</p></div>

      <div v-else-if="!peca" class="ctd-vazio">
        <h3>Peça não encontrada</h3>
        <p>Ela pode ter sido excluída, ou você não tem acesso ao perfil dela.</p>
      </div>

      <div v-else class="ctd-peca-wrap">
        <p v-if="erro" class="ctd-aviso ctd-aviso-erro">{{ erro }}</p>

        <div>
          <h1 class="ctd-cal-mes">{{ peca.titulo }}</h1>
          <p class="ctd-ajuda">
            <span class="ctd-pip" :style="{ color: corDeStatus(peca.status) }">{{ rotuloDeStatus(peca.status) }}</span>
            · {{ nomeDoFormato }}
            · {{ peca.publicar_em ? dataHoraBRT(peca.publicar_em) : 'sem data marcada' }}
          </p>
        </div>

        <div v-if="arquivos.length" class="ctd-peca-midia">
          <template v-for="a in arquivos" :key="a.id">
            <img v-if="a.tipo === 'imagem' && urls[a.caminho]" :src="urls[a.caminho]" :alt="peca.titulo">
            <video v-else-if="a.tipo === 'video' && urls[a.caminho]" :src="urls[a.caminho]" controls playsinline></video>
          </template>
        </div>
        <div v-else class="ctd-aviso ctd-aviso-atencao">
          Esta peça não tem nenhum arquivo. Suba a arte antes de publicar.
        </div>

        <div>
          <span class="ctd-rot">Legenda — já com as hashtags</span>
          <!-- TEXTAREA, não div: quando `navigator.clipboard` falha (acontece em
               http e em iOS antigo) a saída é selecionar à mão, e selecionar
               texto dentro de um div no celular é sofrimento. Num textarea um
               toque longo já oferece "Selecionar tudo". Somente-leitura porque
               editar aqui não salvaria nada. -->
          <textarea
            ref="campoLegenda"
            class="ctd-peca-legenda"
            readonly
            :value="legendaFinal || '(sem legenda)'"
            aria-label="Legenda pronta para copiar"
            @focus="$event.target.select()"
          ></textarea>
        </div>

        <div class="ctd-peca-acoes">
          <button class="ctd-btn ctd-btn-primario" @click="copiar">
            {{ copiado ? '✓ Copiado' : 'Copiar legenda' }}
          </button>
          <button v-if="baixavel" class="ctd-btn" @click="baixar">
            {{ arquivos.length > 1 ? `Baixar ${arquivos.length} arquivos` : 'Baixar a arte' }}
          </button>
          <!-- A TELA INTEIRA EXISTE PARA LEVAR A PESSOA AO INSTAGRAM e não tinha
               o link para ele. No celular o esquema `instagram://` abre o app
               direto; no computador cai no site, que é o comportamento certo
               nos dois lugares. -->
          <!-- Link comum para o site. No celular o próprio sistema abre o app
               quando ele está instalado (universal link) — tentar o esquema
               `instagram://` na mão exigiria adivinhar se deu certo, e no
               computador falharia em silêncio. -->
          <a
            class="ctd-btn"
            href="https://www.instagram.com/"
            target="_blank"
            rel="noopener"
          >Abrir o Instagram</a>
        </div>

        <p v-if="copiado" class="ctd-ajuda ctd-peca-dica">
          Legenda copiada. No Instagram, é só colar no campo de escrever.
        </p>

        <div class="ctd-peca-acoes">
          <button
            v-if="peca.status === 'agendada'"
            class="ctd-btn ctd-btn-primario"
            :disabled="trabalhando"
            @click="marcarPublicada"
          >Já publiquei</button>

          <button v-if="peca.status === 'agendada'" class="ctd-btn" :disabled="trabalhando" @click="adiando = !adiando">
            Adiar
          </button>

          <!-- Só faz sentido depois que o aviso já saiu: antes disso ele ainda vem. -->
          <button
            v-if="peca.status === 'agendada' && peca.avisado_em"
            class="ctd-btn"
            :disabled="trabalhando"
            title="Manda o aviso de novo, caso o push não tenha chegado"
            @click="pedirDeNovo"
          >{{ reavisado ? '✓ Vai chegar em até 5 min' : 'Não recebi o aviso' }}</button>
        </div>

        <div v-if="adiando" class="ctd-campo">
          <label class="ctd-rot" for="ctd-adiar">Nova data e hora (Brasília)</label>
          <input id="ctd-adiar" v-model="novaData" type="datetime-local" class="ctd-in">
          <div class="ctd-peca-acoes">
            <button class="ctd-btn ctd-btn-primario" :disabled="!novaData || trabalhando" @click="adiar">Confirmar</button>
            <button class="ctd-btn" @click="adiando = false">Cancelar</button>
          </div>
        </div>

        <p v-if="peca.status === 'publicada'" class="ctd-aviso">
          <b>Publicada</b> em {{ dataHoraBRT(peca.publicado_em) }}.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import BarraDeTopo from '../../compartilhado/barra-de-topo.vue'
import { useRouter } from 'vue-router'
import { rotuloDeStatus, corDeStatus } from './estados.js'
import { regrasDoFormato } from './formatos.js'
import { montarLegendaFinal } from './legenda.js'
import { dataHoraBRT, deCampoDeDataHora } from './grade-do-calendario.js'
import * as dados from './dados-conteudo.js'
import './estilos-conteudo.css'

const props = defineProps({ id: { type: String, required: true } })

const router = useRouter()

const peca = ref(null)
const arquivos = ref([])
const urls = ref({})
const carregando = ref(true)
const erro = ref('')
const copiado = ref(false)
const trabalhando = ref(false)
const baixando = ref(false)
const adiando = ref(false)
const novaData = ref('')
const reavisado = ref(false)

const legendaFinal = computed(() =>
  peca.value ? montarLegendaFinal(peca.value.legenda, peca.value.hashtags) : '',
)
const nomeDoFormato = computed(() => regrasDoFormato(peca.value?.formato)?.rotulo || '—')
const baixavel = computed(() => arquivos.value.some(a => urls.value[a.caminho]))

async function carregar() {
  try {
    peca.value = await dados.carregarPeca(props.id)
    if (!peca.value) return
    arquivos.value = await dados.listarArquivos(peca.value.id)
    urls.value = await dados.urlsAssinadas(arquivos.value.map(a => a.caminho))
  } catch (e) {
    erro.value = e.message
  } finally {
    carregando.value = false
  }
}

async function copiar() {
  try {
    await navigator.clipboard.writeText(legendaFinal.value)
    copiado.value = true
    setTimeout(() => { copiado.value = false }, 2200)
  } catch {
    erro.value = 'O navegador não deixou copiar. Selecione o texto da legenda e copie na mão.'
  }
}

// BAIXAR DE VERDADE, um de cada vez.
//
// Antes era `window.open` por arquivo: no iPhone o bloqueador de pop-up mata do
// segundo em diante, e o que abre é uma ABA COM A IMAGEM, não um download. Para
// um carrossel de 8 slides isso é inviável em pé na frente do Instagram.
//
// Agora cada arquivo vira um link com assinatura de download e é clicado em
// sequência, com uma pausa curta: navegador nenhum aceita oito downloads
// disparados no mesmo instante.
async function baixar() {
  if (baixando.value) return
  baixando.value = true
  try {
    for (const a of arquivos.value) {
      const url = await dados.urlParaBaixar(a.caminho, nomeDoArquivo(a))
      if (!url) continue
      const link = document.createElement('a')
      link.href = url
      link.rel = 'noopener'
      document.body.appendChild(link)
      link.click()
      link.remove()
      await new Promise(r => setTimeout(r, 350))
    }
  } finally {
    baixando.value = false
  }
}

// O nome que o arquivo terá no aparelho. O caminho no depósito é
// "conta/peca/1-slug.jpg" — salvar com esse nome deixa a galeria cheia de "1-".
function nomeDoArquivo(a) {
  const ext = String(a?.caminho || '').split('.').pop() || 'jpg'
  const base = String(peca.value?.titulo || 'peca')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 40)
  const n = Number(a?.ordem) || 1
  return arquivos.value.length > 1 ? `${base}-${n}.${ext}` : `${base}.${ext}`
}


async function marcarPublicada() {
  trabalhando.value = true
  erro.value = ''
  try {
    peca.value = await dados.mudarStatus(peca.value, 'publicada')
  } catch (e) {
    erro.value = e.message
  } finally {
    trabalhando.value = false
  }
}

async function pedirDeNovo() {
  trabalhando.value = true
  erro.value = ''
  try {
    peca.value = await dados.reavisar(peca.value.id)
    reavisado.value = true
  } catch (e) {
    erro.value = e.message
  } finally {
    trabalhando.value = false
  }
}

async function adiar() {
  trabalhando.value = true
  erro.value = ''
  try {
    // mudarStatus para 'agendada' limpa o avisado_em — sem isso a peça remarcada
    // nunca mais dispararia o aviso.
    peca.value = await dados.mudarStatus(peca.value, 'agendada', {
      publicar_em: deCampoDeDataHora(novaData.value),
    })
    adiando.value = false
  } catch (e) {
    erro.value = e.message
  } finally {
    trabalhando.value = false
  }
}

onMounted(carregar)

const logoClaroUrl = '/midia/LOGOTIPOBRENOPRETO.png'
const logoEscuroUrl = '/midia/LOGOTIPOBRENOBRANCO.png'
</script>
