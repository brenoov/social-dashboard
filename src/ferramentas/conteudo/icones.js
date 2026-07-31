// Ícones de interface, em SVG.
//
// POR QUE NÃO CARACTERE: ★ ✨ ✓ mudam de desenho conforme a fonte instalada, não
// aceitam espessura de traço, não alinham à linha de base e em alguns sistemas
// viram emoji colorido no meio de um botão. É regra do projeto — SVG próprio,
// nunca emoji ou glifo como ícone.
//
// Componentes de função (`h`) em vez de arquivo .vue: são cinco linhas cada e
// não têm estado. Um .vue por ícone seria cinco arquivos para nada.
//
// Todos com caixa 24, traço 1.8 e `currentColor`: herdam a cor de quem os
// contém, então funcionam em botão, em chip e sobre foto sem variante nova.
import { h } from 'vue'

const svg = (filhos, extra = {}) =>
  h('svg', {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 1.8,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    class: 'ctd-icone',
    ...extra,
  }, filhos)

// Estrela do favorito. Cheia quando marcada — a diferença entre contorno e
// preenchido é lida mais rápido que uma mudança de cor.
export const IconeEstrela = {
  props: { cheia: { type: Boolean, default: false } },
  setup: (props) => () => svg(
    [h('path', { d: 'M12 3.2l2.7 5.5 6 .9-4.35 4.25 1.03 6-5.38-2.83L6.6 19.85l1.03-6L3.28 9.6l6-.9z' })],
    { fill: props.cheia ? 'currentColor' : 'none' },
  ),
}

// Faísca: a marca do que veio da IA. Duas estrelas de tamanhos diferentes —
// o desenho de "gerado", já convencionado nas interfaces atuais.
export const IconeFaisca = {
  setup: () => () => svg([
    h('path', { d: 'M11 3.5l1.6 4.2 4.2 1.6-4.2 1.6L11 15.1l-1.6-4.2L5.2 9.3l4.2-1.6z' }),
    h('path', { d: 'M18 14l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z' }),
  ]),
}

export const IconeCerto = {
  setup: () => () => svg([h('polyline', { points: '20 6 9 17 4 12' })]),
}
