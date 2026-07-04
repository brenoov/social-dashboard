# Base de Layout do iamundi

Regra de layout que TODA tela (ferramenta) segue, em TODO dispositivo (celular, tablet, desktop, TV).
As peças vivem em `src/estilos/estilos-globais.css` (variáveis + classes). Tela nova já nasce usando.

## Breakpoints padrão (sempre estes números)
- Celular: até **640px**
- Tablet: **641–1024px**
- Desktop: **1025–1919px**
- TV / telão: **1920px+**

## Escala de espaçamento (a única fonte de padding/gap/margem)
`--sp-1:4` · `--sp-2:8` · `--sp-3:12` · `--sp-4:16` · `--sp-5:24` · `--sp-6:32` · `--sp-8:48` (px).
Nada de número solto — use a escala.

## Container (limites e centralização)
- Todo miolo de tela usa `.container-app`: largura máxima (`--container-max`, 1280px) + centralizado + margem lateral segura (`--gutter`: 16px no celular, 24 no tablet, 32 no desktop).
- **Nada estoura a tela:** o body nunca rola na horizontal. Conteúdo largo (tabela, gráfico) vai dentro de um `.rolagem-x` (rola só ele).

## Cards (grade e hierarquia)
- `.grade-cards`: grade que vira **1 coluna no celular** e N colunas conforme a largura.
- `.card-base`: fundo/borda/raio/padding padrão.
- Hierarquia: `.titulo-tela` (título da tela) → `.rotulo-secao` (rótulo de seção) → card → conteúdo.

## Topbar padrão (`.topbar-app`)
Ordem: **voltar · título · filtros · status/relógio**.
- No celular: quebra em linhas; os filtros (ex.: botões de período) viram uma **faixa que rola na horizontal** (nunca 9 botões quebrando); o **relógio/status some** (`.topbar-app__status` fica oculto ≤640px).

## Fontes no celular
- Onde a ferramenta tem escala de fonte (`--gt-fs`, `--gc-fs`, `--np-fs`), no celular ela **volta pra 100%** (sem o "+30%"). Fontes menores no celular, mas sempre legíveis.

## REGRA
1. Toda tela nova usa `.container-app`, `.grade-cards`/`.card-base`, `.topbar-app` e a escala `--sp-*`.
2. No celular a fonte não infla.
3. **Validar em 375px, 768px e desktop** antes de subir (renderizar e olhar) — não confiar só no código.
4. Nunca deixar o body rolar na horizontal.
