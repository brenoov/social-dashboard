<template>
  <!-- A SEMANA MONTADA.
       O robô de pauta entrega ideias avulsas; distribuir as doze pelos dias
       sobrava para a pessoa. Aqui a IA responde a pergunta seguinte — "o que
       sai segunda, quarta e sexta?" — que é como um social media pensa.

       ELA PROPÕE, VOCÊ DECIDE: o plano não vira peça sozinho. Cinco peças
       aparecendo do nada no calendário seria poder demais para um clique. -->
  <Teleport to="body">
  <div class="ctd-fundo" @click.self="fechar">
    <div class="ctd-painel ctd-painel-largo" role="dialog" aria-labelledby="ctd-sem-t">
      <div class="ctd-painel-cab">
        <span id="ctd-sem-t" class="ctd-painel-t">
          A semana de {{ diaEMes(primeiraData) }}
        </span>
        <button class="ctd-fechar" aria-label="Fechar" @click="fechar">×</button>
      </div>

      <div class="ctd-painel-corpo">
        <p v-if="erro" class="ctd-aviso ctd-aviso-erro">{{ erro }}</p>

        <!-- ── Pedindo ── -->
        <template v-if="!plano && !pensando">
          <p class="ctd-ajuda">
            A IA vai escolher do seu banco de {{ ideias.length }}
            {{ ideias.length === 1 ? 'ideia' : 'ideias' }} e distribuir pelos dias, cuidando
            para não repetir pilar em dias seguidos nem empilhar dois posts de venda.
            Onde o banco não tiver nada que sirva, ela propõe pauta nova.
          </p>

          <div class="ctd-campo">
            <span class="ctd-rot">Os dias desta semana</span>
            <ul class="ctd-mini-lista">
              <li v-for="s in slotsVazios" :key="s.data + s.hora">
                <div><b>{{ s.nome_do_dia }} {{ diaEMes(s.data) }}</b><span>às {{ s.hora }}</span></div>
              </li>
            </ul>
            <span class="ctd-ajuda">
              Três posts por semana em dias alternados. É o menor ritmo que sustenta presença —
              depois dá para arrastar cada um no calendário.
            </span>
          </div>
        </template>

        <!-- ── Pensando ── -->
        <p v-if="pensando" class="ctd-aviso">
          <b>A IA está montando a semana.</b> Leva de 1 a 3 minutos — ela está lendo o banco de
          ideias, o que já rendeu nesta marca, o que já está agendado e as datas do mês.
          Pode deixar a tela aberta.
        </p>

        <!-- ── O plano ── -->
        <template v-if="plano">
          <p v-if="plano.leitura" class="ctd-sem-leitura">{{ plano.leitura }}</p>

          <ul v-if="plano.problemas?.length" class="ctd-aviso ctd-aviso-atencao">
            <li v-for="p in plano.problemas" :key="p">{{ p }}</li>
          </ul>

          <div class="ctd-sem-fita">
            <span v-for="(n, f) in resumo.formatos" :key="f" class="ctd-formato">{{ n }}× {{ nomeDoFormato(f) }}</span>
            <span v-if="resumo.doBanco" class="ctd-formato ctd-formato-forte">
              {{ resumo.doBanco }} do seu banco
            </span>
            <span v-if="resumo.novas" class="ctd-formato">{{ resumo.novas }} {{ resumo.novas === 1 ? 'nova' : 'novas' }}</span>
          </div>

          <ol class="ctd-sem-dias">
            <li v-for="(s, i) in slotsDoPlano" :key="i" class="ctd-sem-dia">
              <div class="ctd-sem-quando">
                <b>{{ nomeDoDia(s.data) }}</b>
                <span>{{ diaEMes(s.data) }}</span>
                <span class="ctd-sem-hora">{{ s.hora }}</span>
              </div>
              <div class="ctd-sem-corpo">
                <div class="ctd-sem-cab">
                  <span class="ctd-formato ctd-formato-forte">
                    <IconeFormato :formato="s.formato" :tamanho="13" />{{ nomeDoFormato(s.formato) }}
                  </span>
                  <span v-if="s.ideia?.pilar" class="ctd-formato">{{ s.ideia.pilar }}</span>
                  <span v-if="!s.ideia" class="ctd-formato ctd-sem-nova">pauta nova</span>
                </div>
                <h4 class="ctd-sem-titulo">{{ s.ideia?.titulo || s.titulo_novo }}</h4>
                <p v-if="s.ideia?.gancho || s.gancho_novo" class="ctd-sem-gancho">
                  “{{ s.ideia?.gancho || s.gancho_novo }}”
                </p>
                <p v-if="s.porque_neste_dia" class="ctd-sem-porque">{{ s.porque_neste_dia }}</p>
              </div>
            </li>
          </ol>
        </template>
      </div>

      <div class="ctd-painel-rodape">
        <button
          v-if="!plano"
          class="ctd-btn ctd-btn-primario"
          :disabled="pensando"
          @click="pedir"
        >
          <IconeFaisca v-if="!pensando" />{{ pensando ? 'Montando…' : 'Montar a semana' }}
        </button>

        <template v-else>
          <button class="ctd-btn ctd-btn-primario" :disabled="criando" @click="aceitar">
            <IconeCerto /> {{ criando ? 'Criando…' : `Criar as ${slotsDoPlano.length} peças` }}
          </button>
          <button class="ctd-btn" :disabled="criando" @click="plano = null">Montar de novo</button>
        </template>

        <button class="ctd-btn" @click="fechar">Fechar</button>
        <span v-if="recado" class="ctd-recado" role="status" aria-live="polite">
          <IconeCerto /> {{ recado }}
        </span>
      </div>
    </div>
  </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'
import IconeFormato from './icone-formato.vue'
import { IconeFaisca, IconeCerto } from './icones.js'
import { regrasDoFormato } from './formatos.js'
import {
  proximaSegunda, slotsDaSemana, casarSlotsComIdeias, resumoDaSemana, NOMES_DOS_DIAS,
} from './semana.js'
import * as dados from './dados-conteudo.js'

const props = defineProps({
  accountId: { type: String, required: true },
  ideias: { type: Array, default: () => [] },
})

const emit = defineEmits(['fechar', 'mudou'])

const erro = ref('')
const recado = ref('')
const pensando = ref(false)
const criando = ref(false)
const plano = ref(null)
let relogio = null

const segunda = proximaSegunda()
const slotsVazios = computed(() => slotsDaSemana(segunda))
const primeiraData = computed(() => plano.value?.semana || slotsVazios.value[0]?.data || '')

// O plano guarda o ID da ideia, não o objeto: a ideia pode ter sido editada
// entre a proposta e a aceitação, e o que vale é a versão atual dela.
const slotsDoPlano = computed(() => {
  if (!plano.value?.slots) return []
  const porId = new Map(props.ideias.map(i => [i.id, i]))
  return plano.value.slots.map(s => ({
    ...s,
    ideia: s.ideia_id ? porId.get(s.ideia_id) || null : null,
  }))
})

const resumo = computed(() => resumoDaSemana(slotsDoPlano.value))

function nomeDoFormato(chave) {
  return regrasDoFormato(chave)?.rotulo || chave || 'post'
}

function nomeDoDia(iso) {
  const d = new Date(`${iso}T12:00:00`)
  return Number.isNaN(d.getTime()) ? '' : NOMES_DOS_DIAS[d.getDay()]
}

function diaEMes(iso) {
  if (!iso) return ''
  const [, mes, dia] = String(iso).split('-')
  return dia && mes ? `${dia}/${mes}` : iso
}

async function pedir() {
  erro.value = ''
  pensando.value = true
  try {
    const iso = slotsVazios.value[0]?.data
    const r = await dados.pedirSemanaParaIA(props.accountId, iso)
    if (r?.job_id) acompanhar(r.job_id)
    else { pensando.value = false; erro.value = 'Não consegui iniciar a rodada.' }
  } catch (e) {
    pensando.value = false
    erro.value = e.message
  }
}

// Mesmo limite de paciência do robô de pauta: quem grava 'erro' no job é o
// próprio robô, então uma falha ANTES de ele começar deixaria esta tela girando
// para sempre.
const PACIENCIA_MS = 10 * 60 * 1000

function acompanhar(jobId) {
  clearInterval(relogio)
  const comecou = Date.now()
  relogio = setInterval(async () => {
    if (Date.now() - comecou > PACIENCIA_MS) {
      clearInterval(relogio)
      pensando.value = false
      erro.value = 'A rodada demorou mais que o esperado e paramos de aguardar. Tente de novo.'
      return
    }
    const j = await dados.verJob(jobId)
    if (!j) return
    if (j.status === 'concluido') {
      clearInterval(relogio)
      pensando.value = false
      plano.value = j.resultado || null
      if (!plano.value?.slots?.length) erro.value = 'A semana voltou vazia. Tente de novo.'
    } else if (j.status === 'erro') {
      clearInterval(relogio)
      pensando.value = false
      erro.value = `A IA não conseguiu desta vez: ${j.erro || 'motivo desconhecido'}`
    }
  }, 5000)
}

async function aceitar() {
  erro.value = ''
  criando.value = true
  try {
    const criadas = await dados.planoViraPecas(props.accountId, slotsDoPlano.value)
    recado.value = `${criadas.length} ${criadas.length === 1 ? 'peça criada' : 'peças criadas'}`
    emit('mudou')
    // Fecha depois de um instante, para o recado ser lido antes de a tela mudar.
    setTimeout(fechar, 1200)
  } catch (e) {
    erro.value = e.message
  } finally {
    criando.value = false
  }
}

function fechar() {
  clearInterval(relogio)
  emit('fechar')
}

onUnmounted(() => clearInterval(relogio))
</script>
