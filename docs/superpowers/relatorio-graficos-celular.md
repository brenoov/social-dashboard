# Gráficos que rolam no celular — relatório

Branch: `graficos-que-rolam-no-celular`
Tela: `/redes-sociais` (seção 01 "Novos seguidores / dia" e seção 02 "Meta Ads")

**O que estava errado, medido antes (não remedido por mim):** a 375px, com 30
dias, o gráfico tem 319px de largura — **~10px por dia**. "R$ 17,34" não cabe em
10px em fonte nenhuma. Os números se sobrepunham em **−5px**, com 3 pares no
gráfico de investimento e 8 no de custo por seguidor.

**A régua aplicada:** cada dia recebe no mínimo **30px**. Cabendo, nada muda.
Não cabendo, o gráfico fica mais largo que o cartão e rola **para o lado dentro
dele** — a página nunca ganha rolagem horizontal.

---

## 1. O que mudou, arquivo por arquivo

### `src/ferramentas/redes-sociais/largura-do-grafico.js` (novo)

Módulo puro. `larguraDoGrafico({ pontos, larguraDisponivel, minimoPorPonto = 30,
podeRolar = true })` devolve `{ largura, rola, larguraDaTrilha, espacoPorPonto }`.

- `largura = max(larguraDisponivel, pontos × 30)` — o `max` é o que impede uma
  semana de virar um toco de 210px num cartão de 1200px.
- `rola` só quando o necessário passa do disponível.
- Contêiner ainda não medido (`clientWidth` 0, negativo, `NaN`) cai em 400px, a
  largura de projeto: zero lido como "não tem espaço" mandaria **todo** gráfico
  rolar, inclusive no computador.
- `ESPACO_ANTES_DO_GRAFICO = 24` e `ESPACO_DEPOIS_DO_GRAFICO = 48`: tiras vazias
  nas beiradas. O rótulo é centrado no ponto, e o primeiro e o último ficam na
  borda — metade deles sobra para fora do desenho, e fora do desenho dentro de
  caixa que rola é lugar **recortado**.
- `FAIXA_QUE_AVISA = 28`: a faixa apagada da direita. A tira da saída é maior que
  ela para a faixa nunca apagar o último dia.
- `podeRolar`: ver o item 5 (televisão).

### `src/ferramentas/redes-sociais/largura-do-grafico.test.mjs` (novo)

16 testes. Bordas cobertas: cabe exato não rola · um ponto a mais rola · um ponto
só · zero ponto · contêiner maior nunca encolhe · celular 375 em 7/14/30 dias ·
tela larga · mínimo ajustável · contêiner não medido · quantidade estranha de
pontos · largura inteira · tiras vazias · trava da televisão.

### `src/ferramentas/redes-sociais/tela-de-redes-sociais.vue`

**Template (seção 01).** Três camadas em volta do gráfico de seguidores:
`.grafico-que-rola` (não rola; segura a faixa apagada) → `.rolagem-de-grafico`
(a que rola) → `.trilho-de-grafico` (a que fica larga, e que contém tanto o SVG
com a camada de números quanto a linha de datas, para os dois rolarem juntos e
alinhados).

**`buildChart` (seção 01).** O `viewBox` continua `0 0 400 110`: como o SVG tem
`preserveAspectRatio="none"`, alargar o elemento estica só na horizontal e a
altura fica presa em 150px pelo CSS. Os rótulos, posicionados em porcentagem
sobre o trilho, acompanham sozinhos.

**`desenharGraficoDiario` (seção 02).** Aqui a largura entra no **viewBox**
(`W` computado), porque este SVG escala uniforme — esticá-lo com viewBox 400
esticaria a altura junto e viraria um paredão. Rolando, o desenho fica 1:1 com a
tela (900×136 em 30 dias). Não rolando, `W` volta a 400 e o SVG volta a
`width:100%` — o que está no ar hoje.

**As três coisas que vieram junto:**
- Fonte dos valores da seção 02: **9px → 11px**, só quando rola (`.gmad-rola`).
  No computador o espaço é o mesmo de sempre; letra maior ali traria a
  sobreposição de volta.
- Faixa apagada de 28px na direita, sobre a tira vazia, para se descobrir que o
  gráfico continua.
- Rótulo de meta ("Meta máxima" / "Meta N/dia") tirado da direita.

**`showInside` reconciliado, não apagado:** era `n <= 14`, virou
`n <= 14 || medida.rola`. A regra sempre foi de espaço escrita em contagem de
dias; rolando, cada dia tem 30px — mais que os ~22px que 14 dias tinham no
celular. Quem não rola (o computador) continua na conta por dias, igual a hoje.
O `cdl-sm` ficou como está: a 30px por dia, um "+123" em Oswald 14px não caberia.

**CSS.** `.grafico-que-rola` / `.rolagem-de-grafico` / `.trilho-de-grafico` /
`.rolando`, mais `min-width:0` nos cartões das grades 1 e 2. Cores só de token
(`--surface` no degradê da faixa; conferido em `estilos-globais.css`, existe no
claro e no escuro). Nenhum hex novo.

---

## 2. Provas do TDD

### VERMELHO — teste antes do módulo

```
$ node --test 'src/ferramentas/redes-sociais/largura-do-grafico.test.mjs'
  code: 'ERR_MODULE_NOT_FOUND',
  url: '.../src/ferramentas/redes-sociais/largura-do-grafico.js'
✖ src/ferramentas/redes-sociais/largura-do-grafico.test.mjs
ℹ tests 1 · pass 0 · fail 1
```

### VERDE — depois do módulo

```
$ node --test 'src/ferramentas/redes-sociais/largura-do-grafico.test.mjs'
ℹ tests 14 · pass 14 · fail 0
```

### VERMELHO de novo — a trava da televisão, teste antes do código

```
$ node --test 'src/ferramentas/redes-sociais/largura-do-grafico.test.mjs'
✖ sem quem role, o gráfico se aperta em vez de esconder dia
ℹ tests 16 · pass 15 · fail 1
```

### VERDE

```
$ node --test 'src/ferramentas/redes-sociais/largura-do-grafico.test.mjs'
ℹ tests 16 · pass 16 · fail 0
```

### Suíte inteira e build

```
$ npm test     (antes)  ℹ tests 3260 · pass 3260 · fail 0
$ npm test     (depois) ℹ tests 3276 · pass 3276 · fail 0
$ npm run build         ✓ built in 2.35s   (sem erro nem aviso)
```

---

## 3. A largura que o gráfico ganha, por período e por tela

Números da própria `larguraDoGrafico`, com a largura de cartão medida no
navegador (não estimada).

**Celular de 375px** — cartão de 319px nas duas seções:

| Período | Pontos | Largura | Rola? | Espaço por dia |
|---|---|---|---|---|
| 7D | 7 | **319** | não (igual a hoje) | 45,6px |
| 14D | 14 | **420** | **sim** | 30px |
| 30D | 30 | **900** | **sim** | 30px |
| MÊS (31 dias) | 31 | **930** | **sim** | 30px |

**Computador de 1440px** — seção 01 com 1036px de cartão, seção 02 com 632px
(dois cartões na linha):

| Período | Seção 01 | Seção 02 |
|---|---|---|
| 7D | 1036, não rola | 632, não rola |
| 14D | 1036, não rola | 632, não rola |
| 30D | 1036, não rola | **900, ROLA** |
| MÊS (31 dias) | 1036, não rola | **930, ROLA** |

**A seção 02 rola no computador em 30D e MÊS, e isso não estava previsto no
desenho.** O desenho supunha que "o computador fica exatamente como está em
qualquer período"; a conta desmente: o cartão da seção 02 divide a linha com o
vizinho e sobra com 632px, e 30 dias pedem 900. A régua aprovada é "mínimo 30px
por dia" e ela é quem manda — mas está aqui em destaque porque é uma mudança no
computador que o desenho não anunciou. Vale o mesmo para o 14D no celular, que o
desenho dizia que ficaria como está: 14 × 30 = 420 não cabe em 319.

---

## 4. O que eu medi

Não consigo entrar na tela (ela manda para `/login` e eu não tenho conta).
**Não abri o painel logado e não afirmo nada sobre ele.**

O que dá para medir sem login, e foi medido: montei uma página estática servida
em `127.0.0.1:8791` com **o CSS do build** (`dist/assets/tela-de-redes-sociais-*.css`,
com o atributo `data-v-` correspondente, senão nenhuma regra pega) e com a
**geometria de desenho copiada verbatim** das duas funções (`buildChart` e
`desenharGraficoDiario`), alimentada com 30 dias de valores na mesma faixa dos
que foram medidos ("R$ 17,34", "R$ 11,35", "R$ 2,88", meta R$ 3,00). Depois medi
com o Playwright caixa por caixa de texto.

**Isto mede o CSS de verdade e a geometria de verdade; não mede a tela de
verdade.** Se alguma coisa do app mudar o tamanho do cartão (uma barra lateral,
um aviso, `--escala-texto` diferente de 1), a conta muda — e quem tem sessão
precisa refazer a medida original.

Resultados a **375px**, com a suíte de 30 dias, nos dois temas:

| | Antes | Depois |
|---|---|---|
| Rolagem horizontal da página | 0 | **0** (`documentElement` e `body`) |
| Pares sobrepostos · investimento | 3 | **0** |
| Pares sobrepostos · custo por seguidor | 8 | **0** |
| Pares sobrepostos · novos seguidores | 2 | **0** |
| Menor folga entre vizinhos | −5px | **+12,8px** (seguidores) · +49,5px e +52,5px (seção 02) |
| Fonte dos valores da seção 02 | 9px | **11px** |
| Texto recortado (em cima, embaixo, nas beiradas) | — | **nenhum**, em 7/14/30/31 dias |
| Alvos abaixo de 40px | — | **0** |

Também conferido: a rolagem anda (629px de curso em 30 dias); **no fim da
rolagem nenhum rótulo fica debaixo da faixa apagada**; tema escuro com o degradê
saindo em `--surface` do escuro; e o mesmo em 7, 14, 30 e 31 dias.

**Dois defeitos apareceram na medida e foram corrigidos aqui** (os dois teriam
ido para produção sem esta medição):

1. **A página inteira ganhava rolagem para o lado.** Cartão é item de grade e
   nasce com `min-width:auto` ("nunca menor que o conteúdo"). O conteúdo passou a
   ser de propósito maior que a tela, e a coluna foi atrás: o cartão da seção 02
   esticou para **980px** e o `body` para **992px** numa tela de 375px. Recortar
   dentro da caixa que rola não basta — a coluna precisa de `min-width:0`.
2. **O primeiro rótulo era recortado pela esquerda:** "R$ 17,34" aparecia como
   "$ 17,34" e "19/7" como "/7". Daí as duas tiras vazias das beiradas.

**Não verificado:** a tela logada; o comportamento do dedo de verdade num
aparelho de verdade (medi a caixa que rola, não o gesto); períodos com dia sem
dado (`semDado`) em cima da nova largura; e `--escala-texto` diferente de 1.

---

## 5. A televisão (`body.dev-tv`) — o raciocínio NÃO se sustenta

Foi pedido para confirmar que "numa tela larga os pontos cabem, então a mesma
regra resolve". **Não resolve, e a conta é esta:** a 1920 com `dev-tv`, os dois
cartões da seção 02 dividem a linha e ficam com **836px cada**. 30 dias pedem
900. Sem trava, a televisão passaria a rolar — e numa televisão ninguém arrasta
nada, então os últimos dias sumiriam para sempre. Medido, não deduzido.

Como isso violava um "não pode" explícito, entrou a trava: `podeRolar: false`
quando `body.dev-tv` está posto. Lá o gráfico se aperta (27,9px por dia) e mostra
os 30 dias. Onde não há dedo, apertar é melhor que esconder. Conferido depois da
trava: a 1920 com `dev-tv` nenhum dos três gráficos rola.

**Ressalva importante:** procurei em `src/` e **nada põe a classe `dev-tv`** —
ela só aparece em CSS (aqui e em `estilos-globais.css`) e no `legacy/index.html`.
Ou seja, hoje a trava é inerte, e uma televisão que abra o painel é tratada como
um computador largo: **em 30D e MÊS os gráficos da seção 02 vão rolar nela**. Se
o modo televisão importa de verdade, alguém precisa voltar a pôr a classe.

---

## 6. Preocupações

1. **A seção 02 passa a rolar no computador em 30D e MÊS** (cartão de 632px a
   1440). É consequência fiel da régua aprovada, mas contraria a frase "o
   computador fica exatamente como está". Se não for o desejado, o conserto é de
   uma linha (mínimo por ponto menor, ou `podeRolar` também por largura de tela)
   — mas é decisão do dono, não minha.
2. **14D no celular também passa a rolar** (420 > 319), ao contrário do que o
   desenho antecipava.
3. **O rótulo da meta saiu da linha e foi para o canto de cima.** Só trocá-lo de
   lado não resolvia: medido, ele passou a bater no primeiro dia em vez do
   último, e a tarja é opaca — ela **escondia** o valor. Para resolver por
   construção, a faixa de cima virou dele sozinho, e as barras encurtaram: 14%
   na seção 01 e 12% na seção 02, só quando existe meta. Bar mais curta é preço
   pago; número escondido não é.
4. **Rolando para o fim, o rótulo da meta sai de vista** (ele mora na borda
   esquerda do desenho, não da tela). A linha tracejada continua visível o tempo
   todo. Um rótulo grudado na borda visível resolveria, e não fiz — é mais
   código do que o desenho aprovou.
5. **Não há redesenho ao girar o aparelho.** A rede é o `min-width:100%` do
   trilho: se o cartão crescer depois do desenho, o gráfico acompanha em vez de
   virar um toco. No caso da seção 02, esse acompanhamento estica o desenho
   uniforme e a altura cresce junto até o próximo desenho (de 136 para ~198px no
   pior caso medido). Não é paredão, mas não é o ideal.
6. **Nas telas largas continuam existindo 1 ou 2 sobreposições na seção 02**,
   entre o penúltimo e o último rótulo ("R$ 13,62" × "R$ 15,77", "16/8" × "17/8").
   São da regra antiga de "o último dia é sempre rotulado", que eu não mexi, e
   não envolvem nada do que foi mudado aqui. Fica anotado.
7. **`.chart-svg-wrap` perdeu o `margin-top:auto`**, que passou para a
   `.grafico-que-rola` (é ela que agora é filha direta do cartão em coluna). O
   efeito visual é o mesmo, mas quem for mexer no cartão precisa saber.
