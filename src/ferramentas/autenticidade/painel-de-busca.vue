<script setup>
/* O PAINEL DE BUSCA DAS TRÊS ABAS — Lotes, Gravar e Etiquetas.
 *
 * POR QUE É UM COMPONENTE, e não o mesmo bloco escrito três vezes: as três abas
 * buscam pelas mesmas cinco coisas (data, modelo, referência, código da peça e
 * estado), e busca escrita três vezes é busca que diverge — a aba que ficasse
 * para trás passaria a esconder dado que as outras acham.
 *
 * O QUE ELE NÃO FAZ: filtrar. As contas moram em `busca-e-arquivamento.js`,
 * testadas sem navegador; daqui sai só o que a pessoa pediu.
 *
 * ESTILO PRÓPRIO, com prefixo próprio (`pb-`): componente com `<style scoped>`
 * não alcança as classes `au-` da tela grande. Só tokens, nunca hex.
 */
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { intervaloDoAtalho, filtroAtivo } from './busca-e-arquivamento.js'

const props = defineProps({
  // { texto, de, ate, atalho, estado } — quem cria e guarda é a tela
  filtro: { type: Object, required: true },
  atalhos: { type: Array, required: true },
  estados: { type: Array, required: true },
  // "Fabricado em" na aba Lotes, "Gravada em" na aba Etiquetas: a data que se
  // filtra é outra em cada aba, e um rótulo genérico faria a pessoa filtrar
  // pela data errada sem perceber
  rotuloDaData: { type: String, required: true },
  dica: { type: String, default: 'Buscar' },
  // "Mostrando 12 de 87 lotes" — vem pronto de `fraseDaContagem`
  contagem: { type: String, default: '' },
  // o estado que a aba abre mostrando; é para ele que o "Limpar" volta
  estadoPadrao: { type: String, default: '' },
})

const emit = defineEmits(['update:filtro'])

// O filtro sai INTEIRO a cada mudança, e não campo a campo: um objeto novo é o
// que o Vue enxerga como mudança, e mexer no de dentro faria a lista não
// redesenhar em parte dos casos.
function mudar(campos) {
  emit('update:filtro', { ...props.filtro, ...campos })
}

// O ATALHO ESCREVE NOS DOIS CAMPOS DE DATA, em vez de virar um terceiro estado
// escondido. Assim o que a pessoa vê nos campos é exatamente o que está
// filtrando — e ela pode ajustar um dia à mão sem o atalho brigar com ela.
function usarAtalho(chave) {
  const { de, ate } = intervaloDoAtalho(chave, new Date())
  mudar({ atalho: chave, de, ate })
}

// Mexer numa data à mão apaga o realce do atalho: o recorte deixou de ser o
// dele, e um chip aceso mentindo sobre o período é pior que chip nenhum.
function mudarData(qual, valor) {
  mudar({ [qual]: valor, atalho: '' })
}

const temFiltro = computed(() => filtroAtivo(props.filtro, props.estadoPadrao))

// ── O PERÍODO EXATO FICA NUMA GAVETA ──────────────────────────────────────
// Medido a 375px: com os dois campos de data sempre abertos, o painel comia
// 560px de altura e empurrava a lista — a coisa que a pessoa veio ver — para
// fora da primeira tela. Os atalhos já são a busca por data de verdade; os dois
// campos são o caso raro, e caso raro mora atrás de uma gaveta.
//
// A GAVETA ABRE SOZINHA quando o recorte é de datas escritas à mão: filtro
// ligado escondido é filtro que a pessoa não entende por que está cortando a
// lista. E o resumo no próprio rótulo diz o período mesmo com a gaveta fechada.
const dia = (v) => (v ? String(v).split('-').reverse().join('/') : '')
const periodoEscrito = computed(() => {
  const { de, ate } = props.filtro
  if (de && ate) return de === ate ? dia(de) : `${dia(de)} a ${dia(ate)}`
  if (de) return `a partir de ${dia(de)}`
  if (ate) return `até ${dia(ate)}`
  return ''
})
const gavetaAberta = computed(() => Boolean((props.filtro.de || props.filtro.ate) && !props.filtro.atalho))

// NO COMPUTADOR A GAVETA JÁ NASCE ABERTA. Ela existe porque a 375px os dois
// campos de data comiam 560px de altura e empurravam a lista para fora da
// primeira tela — numa tela larga esse motivo não existe, o painel inteiro cabe
// numa faixa e esconder duas datas atrás de um clique é só um clique a mais.
//
// POR QUE ISTO É JAVASCRIPT E NÃO CSS: `<details>` fechado esconde o conteúdo
// pelo motor do navegador, e nenhuma regra de CSS reabre — quem abre é o
// atributo `open`. `matchMedia` lê o mesmo 900px do `@media` do estilo abaixo, e
// os dois têm de continuar iguais.
//
// O valor inicial é lido na definição (e não num `onMounted`) para a primeira
// pintura já sair certa: começar fechado e abrir depois faria a faixa saltar.
// `matchMedia` não existe em ambiente sem navegador — daí a guarda.
const consulta = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(min-width: 900px)')
  : null
const telaLarga = ref(Boolean(consulta?.matches))
function anotarLargura(e) { telaLarga.value = e.matches }
onMounted(() => consulta?.addEventListener('change', anotarLargura))
onBeforeUnmount(() => consulta?.removeEventListener('change', anotarLargura))

// LIMPAR TIRA TUDO, inclusive o recorte com que a aba abriu — é assim que se
// chega ao "e o resto" na aba Etiquetas, que abre nos últimos 30 dias.
function limpar() {
  emit('update:filtro', { texto: '', de: '', ate: '', atalho: 'tudo', estado: props.estadoPadrao })
}
</script>

<template>
  <div class="pb-caixa">
    <label class="pb-campo pb-busca">
      <span class="pb-rot">Buscar</span>
      <input type="search" :value="filtro.texto" :placeholder="dica"
             @input="mudar({ texto: $event.target.value })">
    </label>

    <!-- OS ATALHOS SÃO A BUSCA POR DATA DE VERDADE. Ninguém digita duas datas
         para ver o que fez esta semana; os dois campos abaixo ficam para o caso
         raro. `aria-pressed` porque o realce não pode ser só cor. -->
    <div class="pb-atalhos" role="group" :aria-label="`Período — ${rotuloDaData}`">
      <button v-for="a in atalhos" :key="a.chave" type="button" class="pb-chip"
              :class="{ on: filtro.atalho === a.chave }"
              :aria-pressed="String(filtro.atalho === a.chave)"
              @click="usarAtalho(a.chave)">{{ a.rotulo }}</button>
    </div>

    <!-- A seta é desenhada aqui porque `display:flex` no <summary> apaga o
         triângulo que o Chrome desenha sozinho — e o triângulo era a única
         pista de que a gaveta abre. Em SVG, nunca emoji. -->
    <details class="pb-mais" :open="gavetaAberta || telaLarga">
      <summary>
        <svg class="pb-seta" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"
             fill="none" stroke="currentColor" stroke-width="2.4"
             stroke-linecap="round" stroke-linejoin="round"><polyline points="9 5 16 12 9 19" /></svg>
        <span>Período exato</span>
        <span v-if="periodoEscrito" class="pb-periodo">{{ periodoEscrito }}</span>
      </summary>
      <div class="pb-linha">
        <label class="pb-campo">
          <span class="pb-rot">{{ rotuloDaData }}, de</span>
          <input type="date" :value="filtro.de" @change="mudarData('de', $event.target.value)">
        </label>
        <label class="pb-campo">
          <span class="pb-rot">até</span>
          <input type="date" :value="filtro.ate" @change="mudarData('ate', $event.target.value)">
        </label>
      </div>
    </details>

    <label class="pb-campo pb-estado">
      <span class="pb-rot">Estado</span>
      <select :value="filtro.estado" @change="mudar({ estado: $event.target.value })">
        <option v-for="e in estados" :key="e.chave" :value="e.chave">{{ e.rotulo }}</option>
      </select>
    </label>

    <!-- A CONTAGEM É OBRIGATÓRIA: lista recortada sem número faz a pessoa achar
         que perdeu dado — e aqui o dado é o link que ficou dentro de uma bolsa.
         `role="status"` para quem usa leitor de tela ouvir o número mudar. -->
    <p class="pb-conta">
      <span role="status">{{ contagem }}</span>
      <button v-if="temFiltro" class="pb-limpar" type="button" @click="limpar">Limpar a busca</button>
    </p>
  </div>
</template>

<style scoped>
/* Cor só de token e espaço só da escala (PADRAO-DA-CENTRAL, itens 2 e 7). */
.pb-caixa{
  margin:var(--sp-3) 24px 0; padding:var(--sp-3);
  border:1px solid var(--border); border-radius:var(--radius-md);
  background:var(--surface2); max-width:720px;
}
.pb-campo{display:flex; flex-direction:column; gap:var(--sp-1); min-width:0}
.pb-busca{margin-bottom:var(--sp-3)}
.pb-rot{
  font-family:var(--fonte-principal);
  font-size:max(9px, calc(10px * var(--escala-texto, 1)));
  font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:var(--muted);
}
/* 16px no campo não é estética: abaixo disso o iOS dá zoom ao focar e a tela
   salta na cara de quem está digitando. 40px porque dedo não acerta menos. */
.pb-campo input, .pb-campo select{
  width:100%; box-sizing:border-box; min-height:40px; padding:var(--sp-2) var(--sp-3);
  font-family:var(--fonte-principal);
  font-size:max(16px, calc(16px * var(--escala-texto, 1)));
  border:1px solid var(--border); border-radius:var(--radius-md);
  background:var(--surface); color:var(--text);
}
.pb-atalhos{display:flex; flex-wrap:wrap; gap:var(--sp-2); margin-bottom:var(--sp-3)}
/* O chip é um botão comum do PADRÃO: borda e fundo transparente, nunca cinza.
   O aceso usa o par `--accent-light` + `--accent-forte`, que é o que o padrão
   manda para cor sobre o próprio tom aguado e já vem medido. */
.pb-chip{
  min-height:40px; padding:0 var(--sp-3); box-sizing:border-box;
  display:inline-flex; align-items:center; cursor:pointer;
  background:transparent; border:1px solid var(--border); border-radius:var(--radius-md);
  font-family:var(--fonte-principal);
  font-size:max(9px, calc(12px * var(--escala-texto, 1)));
  font-weight:600; color:var(--muted); white-space:nowrap;
}
.pb-chip:hover{color:var(--text); border-color:var(--accent-mid)}
.pb-chip.on{color:var(--accent-forte); background:var(--accent-light); border-color:var(--accent)}
/* A GAVETA DO PERÍODO EXATO. `display:flex` no <summary> apaga o marcador
   nativo nos dois motores, e a seta vira o SVG do template. 40px de alvo. */
.pb-mais summary{
  display:flex; align-items:center; gap:var(--sp-2); min-height:40px; cursor:pointer;
  list-style:none; font-family:var(--fonte-principal);
  font-size:max(9px, calc(12px * var(--escala-texto, 1)));
  font-weight:600; color:var(--text); flex-wrap:wrap;
}
.pb-mais summary::-webkit-details-marker{display:none}
.pb-seta{flex-shrink:0; color:var(--accent); transition:transform .15s}
.pb-mais[open] > summary .pb-seta{transform:rotate(90deg)}
/* O período escolhido aparece no próprio rótulo, com a gaveta fechada: filtro
   ligado escondido é filtro que a pessoa não entende por que corta a lista. */
.pb-periodo{font-weight:400; color:var(--muted)}
/* Os dois campos de data lado a lado no computador; a 375px eles empilham,
   porque espremer um `input type="date"` corta a data escrita dentro dele. */
.pb-linha{display:flex; gap:var(--sp-3); flex-wrap:wrap; padding-top:var(--sp-2)}
.pb-linha .pb-campo{flex:1 1 180px}
.pb-estado{margin-top:var(--sp-3); max-width:320px}
.pb-conta{
  display:flex; align-items:center; justify-content:space-between; gap:var(--sp-3);
  flex-wrap:wrap; margin:var(--sp-3) 0 0;
  font-family:var(--fonte-principal);
  font-size:max(9px, calc(12px * var(--escala-texto, 1)));
  color:var(--muted); overflow-wrap:anywhere;
}
/* Alvo de dedo de 40px sem virar botão: cresce a área, o texto continua link
   (PADRAO item 6). `--accent-forte` porque o fundo aqui é o tom aguado da
   caixa, e o accent puro sobre ele reprova por pouco no tema escuro. */
.pb-limpar{
  display:inline-flex; align-items:center; min-height:40px; padding:0;
  background:none; border:none; cursor:pointer;
  font-family:var(--fonte-principal);
  font-size:max(9px, calc(11px * var(--escala-texto, 1)));
  font-weight:600; color:var(--accent-forte);
}

/* ── A TELA GRANDE ────────────────────────────────────────────────────────
   No celular o painel empilha, e está certo: com 375px de largura busca,
   atalhos e estado não cabem lado a lado sem espremer o alvo do dedo.
   No computador eles cabem, e empilhados deixavam a caixa com 720px de largura
   e quatro andares de altura, empurrando a lista para baixo da dobra.
   Aqui viram UMA FAIXA: buscar · período · estado.

   AS CINCO POSIÇÕES SÃO ESCRITAS À MÃO, e não deixadas para o encaixe
   automático: a gaveta e a contagem ocupam a linha inteira, e com posição
   automática a primeira delas empurraria o "Estado" para uma terceira linha,
   deixando um vão na primeira. Contado no navegador, não deduzido.

   900px é o mesmo corte do `matchMedia` do script aqui de cima e do `@media`
   da tela grande. Os três têm de continuar iguais. */
@media (min-width:900px){
  .pb-caixa{
    max-width:none; margin-left:24px; margin-right:24px;
    padding:var(--sp-4) var(--sp-5);
    display:grid;
    grid-template-columns:minmax(240px,1fr) minmax(260px,.6fr);
    align-items:end; column-gap:var(--sp-5); row-gap:var(--sp-3);
  }
  .pb-busca{grid-column:1; grid-row:1; margin-bottom:0}
  .pb-estado{grid-column:2; grid-row:1; margin-top:0; max-width:none}
  .pb-atalhos{grid-column:1 / -1; grid-row:2; margin-bottom:0}
  /* A gaveta do período nasce ABERTA aqui (o `telaLarga` do script), então ela
     é uma linha de verdade e não um clique escondido. */
  .pb-mais{grid-column:1 / -1; grid-row:3}
  .pb-conta{grid-column:1 / -1; grid-row:4; margin-top:0}
  /* Sem isto cada campo de data esticaria para meia faixa. Uma data escrita
     não fica mais legível com 500px de campo. */
  .pb-linha .pb-campo{flex:0 1 200px}
}

/* OS SETE ATALHOS DE DATA SÓ SOBEM PARA A PRIMEIRA LINHA QUANDO CABEM INTEIROS.
   Medido a 1024px com os três na mesma linha: os atalhos quebravam em duas
   fileiras e o "Estado" ficava com 180px, cortando "Só com peça por gravar"
   dentro do próprio seletor — texto cortado é defeito (PADRAO item 5).
   A partir de 1240px os três cabem, e aí a faixa vira uma linha só. */
@media (min-width:1240px){
  .pb-caixa{grid-template-columns:minmax(240px,1fr) minmax(0,auto) minmax(260px,.5fr)}
  .pb-atalhos{grid-column:2; grid-row:1}
  .pb-estado{grid-column:3; grid-row:1}
  .pb-mais{grid-row:2}
  .pb-conta{grid-row:3}
}

/* O `@media` do celular é a ÚLTIMA coisa deste arquivo, e tem de continuar
   sendo: duas regras de mesma especificidade, ganha a última — uma regra-base
   escrita depois daqui apagaria o ajuste de celular em silêncio. */
@media (max-width:520px){
  .pb-caixa{margin-left:16px; margin-right:16px}
  /* Empilhado: `input type="date"` espremido corta a data escrita dentro dele,
     e texto que corta é defeito (PADRAO item 5). */
  .pb-linha{flex-direction:column}
  .pb-linha .pb-campo{flex:none}
}
</style>
