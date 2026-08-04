<script setup>
/* A BARRA DE TOPO PADRÃO DA CENTRAL.
 *
 * Antes disto havia catorze barras diferentes — `ac-topbar`, `gv-topbar`,
 * `smenu-topbar`, `pat-topbar`, `np-topbar`… — com pelo menos cinco estruturas
 * distintas: umas "voltar → logo → título", outras "grupo → título → grupo",
 * outras "marca → controles → relógio". Nenhuma igual à outra, e cada
 * ferramenta nova inventava a sua.
 *
 * O layout é sempre o mesmo, em três zonas:
 *
 *     ┌──────────────────────────────────────────────────┐
 *     │  ← Voltar   [logo]   Título        [ações…]      │
 *     └──────────────────────────────────────────────────┘
 *       esquerda fixa        meio flexível   direita fixa
 *
 * No celular a barra quebra: voltar + logo + título em cima, ações embaixo em
 * largura cheia. Nunca aperta os três numa linha só, que é o que fazia elemento
 * cair em cima de elemento.
 *
 * NÃO TEM RELÓGIO. Quatro telas mostravam a hora numa barra que já estava
 * apertada; o celular tem relógio próprio a dois centímetros dali.
 */
defineProps({
  // O rótulo do botão de voltar. Vazio esconde o botão (telas de entrada).
  voltar: { type: String, default: '' },
  titulo: { type: String, default: '' },
  // Esconde a logo onde a largura é preciosa (ferramenta de campo, no celular).
  semLogo: Boolean,
})
defineEmits(['voltar'])

const logoClaroUrl = '/midia/LOGOTIPOBRENOPRETO.png'
const logoEscuroUrl = '/midia/LOGOTIPOBRENOBRANCO.png'
</script>

<template>
  <div class="bt-barra">
    <div class="bt-esq">
      <button v-if="voltar" class="bt-voltar" type="button" @click="$emit('voltar')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>{{ voltar }}
      </button>
      <template v-if="!semLogo">
        <img class="rbv-logo rbv-logo-light bt-logo" :src="logoClaroUrl" alt="RBV">
        <img class="rbv-logo rbv-logo-dark bt-logo" :src="logoEscuroUrl" alt="RBV">
      </template>
    </div>

    <span class="bt-titulo" v-if="titulo">{{ titulo }}</span>
    <slot name="titulo" />

    <div class="bt-dir"><slot name="acoes" /></div>
  </div>
</template>

<style scoped>
.bt-barra{display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid var(--border);background:var(--surface);position:sticky;top:0;z-index:20;}
.bt-esq{display:flex;align-items:center;gap:10px;flex:0 0 auto;min-width:0;}
/* O título fica no MEIO e é ele quem cede espaço: encolhe e corta com
   reticências, em vez de empurrar as ações pra fora da tela. */
/* `flex-basis:0` e não `auto`: com base automática, um título comprido tem
   tamanho natural igual ao texto inteiro (ele é nowrap), e isso empurra as
   ações pra outra linha ANTES de o título encolher. Com base zero ele cede
   primeiro, que é o que se quer — o título corta com reticências, as ações
   ficam. */
.bt-titulo{flex:1 1 0;min-width:0;text-align:center;font-family:var(--fonte-principal);font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.bt-dir{display:flex;align-items:center;gap:8px;flex:0 0 auto;}
.bt-voltar{display:inline-flex;align-items:center;gap:6px;background:none;border:none;color:var(--muted);font-family:var(--fonte-principal);font-size:11px;font-weight:600;cursor:pointer;text-transform:uppercase;letter-spacing:1.2px;white-space:nowrap;padding:6px 2px;touch-action:manipulation;}
.bt-voltar:hover{color:var(--text);}
/* A regra global manda .rbv-logo com 52px, que é o tamanho da HOME. Numa barra
   isso estoura a altura. */
.bt-barra .bt-logo{height:22px;width:auto;flex:0 0 auto;}

@media(min-width:768px){
  .bt-barra{padding:12px 24px;}
  .bt-barra .bt-logo{height:26px;}
  .bt-titulo{font-size:14px;}
}

@media(max-width:640px){
  /* No celular a barra quebra em duas linhas em vez de espremer. As ações
     ganham a linha inteira, que é onde o polegar alcança. */
  .bt-barra{flex-wrap:wrap;row-gap:8px;}
  .bt-titulo{flex:1 1 0;text-align:right;font-size:11.5px;letter-spacing:1.2px;}
  /* `1 1 auto`, nao `1 0 100%`: assim as acoes FICAM na primeira linha quando
     cabem (um botao so, por exemplo) e so descem quando nao cabem — e aí sim
     ocupam a linha inteira, porque o flex-grow as espalha. Forcar 100% sempre
     dava uma linha inteira pra um unico botao, e a barra da Gestao a Vista
     subiu de 122 pra 174px de altura por causa disso.  */
  .bt-dir{flex:1 1 auto;min-width:0;}
  .bt-dir:empty{display:none;}
}
</style>
