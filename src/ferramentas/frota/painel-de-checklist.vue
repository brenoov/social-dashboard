<script setup>
/* O checklist do dia, como o motorista preenche.
 *
 * ONDE ISTO É USADO, e é o que decide o desenho: de pé no estacionamento, no
 * celular, muitas vezes no sol e com pressa. Não é um formulário de escritório.
 *
 * A PRIMEIRA VERSÃO ERA A TRANSCRIÇÃO DO PAPEL e o dono reprovou ("ficou
 * horrível no celular e no computador"). O PDF tem três colunas — OK, NÃO OK,
 * N/A — e eu virei isso em três botões escritos por item: doze botões de texto
 * pra responder quatro perguntas. Além disso, as cores estavam chumbadas e as
 * bordas apontavam pra `--borda`, variável que NÃO EXISTE neste app (a certa é
 * `--border`), então o componente inteiro ignorava o tema — no modo escuro
 * virava linha cinza-clara sobre fundo preto e botão preto sobre superfície
 * preta.
 *
 * O que mudou:
 *  - o HODÔMETRO virou o herói da tela, no topo e grande. É o número do qual o
 *    resto da funcionalidade depende, e estava com o mesmo peso de um campo de
 *    observação que quase sempre fica vazio;
 *  - cada item é UMA linha com uma barra de estado à esquerda, legível de
 *    relance enquanto se rola;
 *  - as três respostas viraram um controle único e compacto, não três botões
 *    soltos;
 *  - o RESULTADO é deduzido do que foi respondido (tudo certo → liberado; algum
 *    problema → com ressalvas) e continua trocável. No dia comum a pessoa não
 *    decide nada — mas a palavra final continua sendo dela, que é o que a D14
 *    exige;
 *  - "Anomalias e providências" só aparece quando há um problema marcado, e
 *    perguntando em português de gente;
 *  - tudo em cima das variáveis do app, então segue o tema claro e o escuro.
 *
 * NADA NASCE MARCADO. O desenho inteiro se apoia em não deixar varrer a lista
 * com OK sem olhar — por isso não há "marcar tudo" e o botão de gravar diz
 * quantos itens faltam em vez de deixar gravar pela metade.
 *
 * Toda a decisão de O QUE perguntar mora em checklist.js, testado. Aqui só tem
 * tela. */
import { ref, reactive, computed } from 'vue'
import { cadenciasDoDia, itensDaFicha, problemasDaFicha, hodometroAceito } from '../../../supabase/functions/_shared/checklist.js'

const props = defineProps({
  veiculo: { type: Object, required: true },
  itens: { type: Array, default: () => [] },
  config: { type: Object, required: true },
  ultimaSemanal: { type: String, default: null },
  ultimaMensal: { type: String, default: null },
  ultimoKm: { type: Number, default: null },
  hoje: { type: String, required: true },
  gravando: { type: Boolean, default: false },
  // Quem pega um carro de rodízio está prestes a dirigir, sábado ou não — o
  // papel manda conferir ANTES DA UTILIZAÇÃO, sem dia da semana. Sem este
  // sinal, cadenciasDoDia acha que é fim de semana comum e devolve vazio, e o
  // checklist do rodízio simplesmente não aparece pra quem pega o carro no
  // sábado.
  pegandoAgora: { type: Boolean, default: false },
})
const emit = defineEmits(['gravar'])

const cadencias = computed(() => cadenciasDoDia({
  hoje: props.hoje, config: props.config,
  ultimaSemanal: props.ultimaSemanal, ultimaMensal: props.ultimaMensal,
  pegandoAgora: props.pegandoAgora,
}))
const daFicha = computed(() => itensDaFicha(props.itens, cadencias.value))

const RESPOSTAS = [
  { chave: 'ok', curto: 'OK', longo: 'Tudo certo' },
  { chave: 'nao_ok', curto: 'Problema', longo: 'Tem problema' },
  { chave: 'na', curto: 'N/A', longo: 'Não se aplica' },
]

const respostas = reactive({})
const hodometro = ref('')
const justificativa = ref('')
const anomalias = ref('')
const erros = ref([])

/* ── O hodômetro ─────────────────────────────────────────────────────────── */

const hodometroNumero = computed(() => {
  const n = parseInt(String(hodometro.value).replace(/\D/g, ''), 10)
  return Number.isInteger(n) ? n : null
})
// O aviso aparece enquanto a pessoa digita, não só ao gravar: descobrir o
// problema depois de responder 15 itens é o jeito de fazer ela desistir.
const avisoDoHodometro = computed(() => {
  if (hodometro.value === '') return null
  const r = hodometroAceito(hodometroNumero.value, props.ultimoKm)
  return r.ok ? null : r
})
// Separador de milhar JÁ NO CAMPO enquanto digita: 148520 é difícil de conferir
// de relance contra o painel do carro; 148.520 não é. A primeira versão mostrava
// o número cru no campo e o bonito embaixo — duas vezes o mesmo dado, e o mais
// legível dos dois em letra menor.
const hodometroBonito = computed(() =>
  hodometroNumero.value == null ? '' : hodometroNumero.value.toLocaleString('pt-BR'))

// O campo guarda só dígitos; o ponto é enfeite de leitura. Sem isto, `v-model`
// devolveria "148.520" e o próprio ponto entraria na conta do próximo dígito.
function digitarHodometro(ev) {
  hodometro.value = ev.target.value.replace(/\D/g, '')
  // O valor exibido é derivado, então o campo tem de ser reescrito à mão quando
  // o texto digitado e o formatado divergem (digitar "1485x20", por exemplo).
  ev.target.value = hodometroBonito.value
}
const ultimoKmBonito = computed(() =>
  Number.isInteger(props.ultimoKm) ? props.ultimoKm.toLocaleString('pt-BR') : null)

/* ── O progresso ─────────────────────────────────────────────────────────── */

const respondidos = computed(() => daFicha.value.filter((i) => respostas[i.id]).length)
const faltam = computed(() => daFicha.value.length - respondidos.value)
const problemas = computed(() => daFicha.value.filter((i) => respostas[i.id] === 'nao_ok'))

const titulo = computed(() => {
  if (cadencias.value.includes('mensal')) return 'Checklist de hoje, com a conferência do mês'
  if (cadencias.value.includes('semanal')) return 'Checklist de hoje, com a conferência da semana'
  return 'Checklist de hoje'
})

/* ── O resultado ─────────────────────────────────────────────────────────── */

// Deduzido, e trocável. No dia comum — tudo certo — a pessoa não decide nada.
// Mas a palavra final continua sendo dela: `resultadoEscolhido` vence assim que
// ela toca, e a D14 exige exatamente isso.
const resultadoEscolhido = ref(null)
const resultadoSugerido = computed(() => (problemas.value.length ? 'com_ressalvas' : 'liberado'))
const resultado = computed(() => resultadoEscolhido.value || resultadoSugerido.value)
const trocandoResultado = ref(false)
const RESULTADOS = [
  { chave: 'liberado', rotulo: 'Liberado' },
  { chave: 'com_ressalvas', rotulo: 'Com ressalvas' },
  { chave: 'nao_liberado', rotulo: 'Não liberado' },
]
const rotuloDoResultado = computed(() =>
  (RESULTADOS.find((r) => r.chave === resultado.value) || {}).rotulo || '')

/* ── Gravar ──────────────────────────────────────────────────────────────── */

const textoDoBotao = computed(() => {
  if (props.gravando) return 'Gravando…'
  if (faltam.value === 1) return 'Falta 1 item'
  if (faltam.value > 1) return `Faltam ${faltam.value} itens`
  return 'Gravar checklist'
})

function gravar() {
  erros.value = problemasDaFicha({
    hodometro: hodometroNumero.value, ultimoKm: props.ultimoKm,
    justificativa: justificativa.value, respostas, itens: daFicha.value,
  })
  if (erros.value.length) return
  emit('gravar', {
    ficha: {
      veiculo_id: props.veiculo.id,
      feita_em: props.hoje,
      cadencias: cadencias.value,
      hodometro: hodometroNumero.value,
      hodometro_justificativa: justificativa.value.trim() || null,
      resultado: resultado.value,
      anomalias: anomalias.value.trim() || null,
    },
    respostas: daFicha.value.map((i) => ({
      item_id: i.id,
      item_texto: i.item,
      cadencia: i.cadencia,
      estado: respostas[i.id],
      observacao: null,
    })),
  })
}
</script>

<template>
  <section class="ck" v-if="daFicha.length">
    <header class="ck-topo">
      <div class="ck-topo-texto">
        <span class="ck-etiqueta">{{ titulo }}</span>
        <strong class="ck-carro">{{ veiculo.nome }}</strong>
        <span class="ck-placa">{{ veiculo.placa }}</span>
      </div>
      <div class="ck-contador" :class="{ pronto: !faltam }">
        <span class="ck-contador-n">{{ respondidos }}<span class="ck-contador-de">/{{ daFicha.length }}</span></span>
        <span class="ck-contador-rot">{{ faltam ? 'conferidos' : 'tudo conferido' }}</span>
      </div>
    </header>

    <div class="ck-barra" aria-hidden="true">
      <div class="ck-barra-cheia" :style="{ width: (daFicha.length ? (respondidos / daFicha.length) * 100 : 0) + '%' }"></div>
    </div>

    <!-- O HODÔMETRO É O HERÓI. É o número do qual dependem o alerta de revisão e
         o custo por quilômetro, e o unico campo sem "não se aplica". -->
    <div class="ck-hodo">
      <label class="ck-hodo-lab" for="ck-hodo-campo">Quilometragem do painel</label>
      <div class="ck-hodo-caixa" :class="{ alerta: avisoDoHodometro }">
        <!-- Sem placeholder "0": na fonte de números ele parece dado preenchido, e
             a pessoa acha que o campo já está respondido. Visto na tela, não
             deduzido. -->
        <input id="ck-hodo-campo" :value="hodometroBonito" @input="digitarHodometro"
               type="text" inputmode="numeric"
               autocomplete="off" :placeholder="ultimoKmBonito ? '— — —' : ''"
               class="ck-hodo-campo">
        <span class="ck-hodo-un">km</span>
      </div>
      <p class="ck-hodo-ref" v-if="ultimoKmBonito">Último registro: {{ ultimoKmBonito }} km</p>
    </div>

    <p class="ck-aviso" v-if="avisoDoHodometro">{{ avisoDoHodometro.motivo }}</p>
    <label class="ck-campo" v-if="avisoDoHodometro && avisoDoHodometro.precisaJustificar">
      <span class="ck-lab">O que aconteceu</span>
      <input v-model="justificativa" type="text"
             placeholder="Ex.: trocaram o painel na oficina e o odômetro zerou">
    </label>

    <h3 class="ck-secao">O que conferir</h3>
    <ul class="ck-itens">
      <li v-for="i in daFicha" :key="i.id" class="ck-item"
          :class="['estado-' + (respostas[i.id] || 'vazio')]">
        <span class="ck-item-nome">{{ i.item }}</span>
        <div class="ck-escolha" role="group" :aria-label="i.item">
          <button v-for="r in RESPOSTAS" :key="r.chave" type="button"
                  class="ck-op" :class="[r.chave, { marcado: respostas[i.id] === r.chave }]"
                  :aria-pressed="respostas[i.id] === r.chave"
                  :title="r.longo"
                  @click="respostas[i.id] = r.chave">{{ r.curto }}</button>
        </div>
      </li>
    </ul>

    <!-- Só pergunta quando há o que contar. Campo de texto aberto num dia em que
         está tudo certo é trabalho que ninguém faz e ocupa a tela. -->
    <label class="ck-campo" v-if="problemas.length">
      <span class="ck-lab">O que houve com {{ problemas.length === 1 ? problemas[0].item.toLowerCase() : 'os itens marcados' }}?</span>
      <textarea v-model="anomalias" rows="2"
                placeholder="Conte o que você viu, pra quem for resolver saber o que procurar"></textarea>
    </label>

    <div class="ck-resultado">
      <div class="ck-resultado-linha">
        <span class="ck-lab">Resultado</span>
        <strong class="ck-resultado-val" :class="resultado">{{ rotuloDoResultado }}</strong>
        <button type="button" class="ck-trocar" @click="trocandoResultado = !trocandoResultado">
          {{ trocandoResultado ? 'fechar' : 'mudar' }}
        </button>
      </div>
      <div class="ck-escolha larga" v-if="trocandoResultado">
        <button v-for="r in RESULTADOS" :key="r.chave" type="button"
                class="ck-op" :class="[r.chave, { marcado: resultado === r.chave }]"
                @click="resultadoEscolhido = r.chave; trocandoResultado = false">{{ r.rotulo }}</button>
      </div>
      <!-- O carro NUNCA trava (D14). Dizer isso na tela evita a pessoa não marcar
           "não liberado" com medo de deixar a empresa a pé. -->
      <p class="ck-nota">Marcar "não liberado" não tira o carro de ninguém — só avisa quem administra.</p>
    </div>

    <ul class="ck-erros" v-if="erros.length">
      <li v-for="e in erros" :key="e">{{ e }}</li>
    </ul>

    <button class="ck-gravar" :class="{ incompleto: faltam > 0 }"
            :disabled="gravando" @click="gravar">{{ textoDoBotao }}</button>
  </section>
</template>

<style scoped>
/* Tudo em cima das variáveis do app (--surface, --border, --green…), nunca cor
   chumbada: é o que faz o cartão seguir o tema claro e o escuro. A versão
   anterior apontava pra `--borda`, que não existe aqui, e por isso caía sempre
   no cinza de emergência. */
.ck {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: var(--sp-4);
  margin: 0 14px var(--sp-4);
  max-width: 640px;
  /* O cartão se mede a si mesmo, não à janela: ele vive na aba Motorista E
     dentro do modal de retirada, que é estreito mesmo num monitor grande. */
  container: ck / inline-size;
}

/* ── Topo ─────────────────────────────────────────────────────────────────── */
.ck-topo { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--sp-3); }
/* `min-width:0` sozinho não bastava: sem o `flex:1` o bloco de texto cedia
   espaço e o contador caía pra baixo do nome do carro quando virava "4/4 tudo
   conferido", que é mais largo que "0/4 conferidos". Visto na tela. */
.ck-topo-texto { flex: 1; min-width: 0; }
.ck-etiqueta {
  display: block; font-size: 10px; font-weight: 700; letter-spacing: 1.6px;
  text-transform: uppercase; color: var(--muted); margin-bottom: 2px;
}
.ck-carro { display: block; font-size: 18px; font-weight: 600; color: var(--text); line-height: 1.2; }
.ck-placa {
  display: inline-block; margin-top: 3px; font-family: var(--fonte-dados);
  font-size: 11px; letter-spacing: 1px; color: var(--muted);
}
.ck-contador { text-align: right; flex-shrink: 0; }
.ck-contador-n { font-family: var(--fonte-dados); font-size: 20px; font-weight: 600; color: var(--muted); }
.ck-contador-de { font-size: 13px; opacity: .6; }
.ck-contador.pronto .ck-contador-n { color: var(--green); }
.ck-contador-rot {
  display: block; font-size: 9px; font-weight: 700; letter-spacing: 1.2px;
  text-transform: uppercase; color: var(--muted);
}
.ck-barra { height: 3px; border-radius: 999px; background: var(--border); margin: var(--sp-3) 0 var(--sp-4); overflow: hidden; }
.ck-barra-cheia { height: 100%; background: var(--green); transition: width .22s ease; }

/* ── O hodômetro, que é o herói ───────────────────────────────────────────── */
.ck-hodo { margin-bottom: var(--sp-4); }
.ck-hodo-lab {
  display: block; font-size: 10px; font-weight: 700; letter-spacing: 1.6px;
  text-transform: uppercase; color: var(--muted); margin-bottom: var(--sp-2);
}
.ck-hodo-caixa {
  display: flex; align-items: baseline; gap: var(--sp-2);
  border: 1px solid var(--border); border-radius: var(--radius-md);
  background: var(--bg); padding: 10px var(--sp-3);
  transition: border-color .18s, box-shadow .18s;
}
.ck-hodo-caixa:focus-within { border-color: var(--accent-forte); box-shadow: 0 0 0 3px var(--accent-light); }
.ck-hodo-caixa.alerta { border-color: var(--orange); }
.ck-hodo-campo {
  flex: 1; min-width: 0; border: 0; background: none; outline: none; padding: 0;
  font-family: var(--fonte-dados); font-size: 30px; font-weight: 600;
  letter-spacing: .5px; color: var(--text);
}
.ck-hodo-un { font-family: var(--fonte-dados); font-size: 13px; color: var(--muted); flex-shrink: 0; }
.ck-hodo-ref { margin: 6px 0 0; font-size: 12px; color: var(--muted); }

/* ── Campos de texto ──────────────────────────────────────────────────────── */
.ck-campo { display: block; margin-bottom: var(--sp-3); }
.ck-lab {
  display: block; font-size: 10px; font-weight: 700; letter-spacing: 1.6px;
  text-transform: uppercase; color: var(--muted); margin-bottom: 6px;
}
.ck-campo input, .ck-campo textarea {
  width: 100%; box-sizing: border-box; padding: 10px var(--sp-3);
  border: 1px solid var(--border); border-radius: var(--radius-md);
  background: var(--bg); color: var(--text);
  font-family: var(--fonte-principal); font-size: 14px; resize: vertical;
}
.ck-campo input:focus, .ck-campo textarea:focus {
  outline: none; border-color: var(--accent-forte); box-shadow: 0 0 0 3px var(--accent-light);
}
.ck-aviso {
  margin: 0 0 var(--sp-3); padding: var(--sp-2) var(--sp-3);
  border-left: 3px solid var(--orange); border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  background: var(--surface2); font-size: 13px; color: var(--text); line-height: 1.45;
}

/* ── A lista ──────────────────────────────────────────────────────────────── */
.ck-secao {
  margin: var(--sp-5) 0 var(--sp-2); font-size: 10px; font-weight: 700;
  letter-spacing: 1.6px; text-transform: uppercase; color: var(--muted);
}
.ck-itens { list-style: none; padding: 0; margin: 0; }
/* A barra de estado à esquerda é o que se lê de relance rolando a lista: cinza
   = ainda não olhei, verde = certo, vermelho = tem problema. */
.ck-item {
  display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3);
  padding: var(--sp-3); margin-bottom: 6px;
  border: 1px solid var(--border); border-left: 3px solid var(--border);
  border-radius: var(--radius-md); background: var(--bg);
  transition: border-color .18s, background .18s;
}
.ck-item.estado-ok { border-left-color: var(--green); }
.ck-item.estado-nao_ok { border-left-color: var(--red); background: var(--surface2); }
.ck-item.estado-na { border-left-color: var(--muted); opacity: .72; }
.ck-item-nome { font-size: 14px; color: var(--text); line-height: 1.35; flex: 1; min-width: 0; }

/* As três respostas viram UM controle, não três botões soltos. */
.ck-escolha { display: flex; flex-shrink: 0; border: 1px solid var(--border); border-radius: 999px; overflow: hidden; background: var(--surface); }
.ck-escolha.larga { width: 100%; margin-top: var(--sp-2); }
.ck-op {
  border: 0; background: none; cursor: pointer; padding: 8px 12px;
  font-family: var(--fonte-principal); font-size: 12px; font-weight: 600;
  color: var(--muted); white-space: nowrap; transition: background .15s, color .15s;
  min-height: 38px; flex: 1;
}
/* "Tudo certo" é o caso de 95% dos dias, então ele tem mais peso e mais área
   que os outros dois. Favorecer o caso comum não é facilitar a mentira: nada
   nasce marcado, e cada item continua exigindo um toque. */
.ck-op.ok { flex: 1.4; color: var(--text); }
.ck-op.ok:not(.marcado):hover { background: var(--accent-light); }
.ck-op + .ck-op { border-left: 1px solid var(--border); }
.ck-op:hover { background: var(--surface2); }
.ck-op.marcado { color: #fff; }
.ck-op.ok.marcado, .ck-op.liberado.marcado { background: var(--green); }
.ck-op.nao_ok.marcado, .ck-op.nao_liberado.marcado { background: var(--red); }
.ck-op.na.marcado { background: var(--muted); }
.ck-op.com_ressalvas.marcado { background: var(--orange); }
/* No modo escuro as cores de estado são CLARAS (--green vira #22c55e), e texto
   branco em cima delas fica com contraste fraco — visto na tela, não deduzido.
   Sobre fundo claro o texto escuro é que lê melhor. */
[data-theme="dark"] .ck-op.marcado { color: #0a0a0b; font-weight: 700; }

/* ── Resultado ────────────────────────────────────────────────────────────── */
.ck-resultado { margin-top: var(--sp-5); padding-top: var(--sp-4); border-top: 1px solid var(--border); }
.ck-resultado-linha { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; }
.ck-resultado-linha .ck-lab { margin: 0; }
.ck-resultado-val { font-size: 15px; font-weight: 600; }
.ck-resultado-val.liberado { color: var(--green); }
.ck-resultado-val.com_ressalvas { color: var(--orange); }
.ck-resultado-val.nao_liberado { color: var(--red); }
.ck-trocar {
  margin-left: auto; background: none; border: 0; cursor: pointer; padding: 4px 2px;
  font-family: var(--fonte-principal); font-size: 11px; font-weight: 600;
  letter-spacing: .6px; text-transform: uppercase; color: var(--accent);
}
.ck-nota { margin: var(--sp-2) 0 0; font-size: 12px; color: var(--muted); line-height: 1.45; }

/* ── Erros e gravar ───────────────────────────────────────────────────────── */
.ck-erros { margin: var(--sp-3) 0 0; padding-left: 18px; color: var(--red); font-size: 13px; line-height: 1.5; }
.ck-gravar {
  margin-top: var(--sp-4); width: 100%; min-height: 48px; padding: 12px;
  border: 0; border-radius: var(--radius-md); background: var(--accent); color: var(--sobre-cor);
  font-family: var(--fonte-principal); font-size: 14px; font-weight: 600;
  letter-spacing: .3px; cursor: pointer; transition: background .18s, opacity .18s;
}
.ck-gravar:hover:not(:disabled) { filter: brightness(1.08); }
/* Incompleto continua CLICÁVEL de propósito: tocar mostra o que falta, em vez
   de deixar a pessoa olhando um botão morto sem saber por quê. */
.ck-gravar.incompleto { background: var(--surface2); color: var(--muted); }
.ck-gravar:disabled { opacity: .6; cursor: default; }

/* ── Tela estreita ────────────────────────────────────────────────────────────
   O ponto de quebra é por CONTAINER, não por viewport: este cartão aparece na
   aba Motorista e também dentro do modal de retirada, que é estreito mesmo num
   computador de tela grande. Medir a janela erraria nos dois casos — visto na
   tela: a 390px o nome do item e os três botões na mesma linha ficam
   apertados. */
@container ck (max-width: 460px) {
  /* O nome do item vai pra cima e o controle ocupa a linha inteira: alvo grande
     pra quem está de pé, segurando o celular com uma mão só. */
  .ck-item { flex-direction: column; align-items: stretch; gap: var(--sp-2); }
  .ck-escolha { width: 100%; }
  .ck-op { padding: 10px 8px; min-height: 46px; font-size: 13px; }
}

/* Reserva pra navegador sem suporte a container query: o efeito é o mesmo, só
   medindo a janela. */
@supports not (container-type: inline-size) {
  @media (max-width: 560px) {
    .ck-item { flex-direction: column; align-items: stretch; gap: var(--sp-2); }
    .ck-escolha { width: 100%; }
    .ck-op { padding: 10px 8px; min-height: 46px; font-size: 13px; }
  }
}

@media (max-width: 560px) {
  .ck { margin-left: 10px; margin-right: 10px; padding: var(--sp-3); }
  .ck-hodo-campo { font-size: 26px; }
  .ck-carro { font-size: 16px; }
}
</style>
