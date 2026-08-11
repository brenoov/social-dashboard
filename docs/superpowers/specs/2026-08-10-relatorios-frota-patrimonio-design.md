# Aba de Relatórios — Frota e Patrimônio

**Data:** 10/08/2026
**Estado:** desenho aprovado pelo dono, aguardando plano de execução.

---

## 1. O que o dono pediu

> "uma aba que seja de relatórios onde eu possa exportar em planilha ou pdf,
> tudo ou qualquer marca (inteira) ou somente um local da marca"

Perguntado onde, respondeu **as duas ferramentas**. Perguntado o que sai,
respondeu **os quatro relatórios de cada lado** — e as duas respostas vieram
com a mesma ressalva, com as palavras dele:

> "mas tudo separadinho né, bem organizado" · "bem organizadinho né, sem ficar confuso"

Essa frase é o requisito de desenho mais importante deste documento, e é o que
mata a ideia óbvia de fazer um relatório só, gigante, com tudo dentro.

Sobre o PDF, escolheu **"imprimir / guardar a tabela"** — a folha A4 com
cabeçalho, não peça de apresentação com capa e gráfico.

---

## 2. Os oito relatórios

Um por vez. Nunca dois na mesma folha.

### Frota

| Relatório | Período? | Colunas |
|---|---|---|
| **Ficha dos veículos** | não | Placa · Veículo · Marca/modelo · Ano · Cor · Marca (empresa) · Local · Ambiente · Dono fixo · Situação · Contrato · Código patrimonial · Aluguel · FIPE · Observação |
| **Checklists assinados** | sim | Data · Placa · Veículo · Quem fez · Hodômetro · Resultado · Anomalias · Assinada · Cópia no Zoho |
| **Revisões e manutenção** | não | Placa · Veículo · Item · Situação · Km previsto · Última troca · Km da última · Oficina · Custo · Observação |
| **Quem esteve com cada carro** | sim | Saída · Volta · Placa · Veículo · Quem · Km saída · Km volta · Km rodados · Destino · Finalidade |

### Patrimônio

| Relatório | Período? | Colunas |
|---|---|---|
| **Bens** | não | As 14 de `COLUNAS_PLANILHA`, sem reescrever nenhuma |
| **Com quem está cada bem** | não | Pessoa · Nº · Item · Categoria · Marca · Local · Desde · Motivo · Valor |
| **Histórico de movimentação** | sim | De · Até · Nº · Item · Pessoa · Motivo · Marca · Local |
| **Resumo por marca/local** | não | Agrupador · Itens · Valor total · % do total |

Três observações que já vêm decididas:

1. **"Bens" reaproveita `COLUNAS_PLANILHA` literalmente.** Aquele arquivo já diz
   por que existe: *"a mesma definição serve pra tabela na tela E pra
   exportação, sem duas listas que discordam"*. Criar uma segunda lista de
   colunas para o mesmo dado seria desfazer isso.
2. **"Resumo por marca/local" não lista item por item** — para isso existe
   "Bens". Ele usa `resumirPor`, que já está escrito e testado.

   E ele **desce um nível conforme o recorte**: em "Tudo", agrupa por marca
   ("quanto tem cada marca?"); com uma marca escolhida, agrupa por local ("e
   dentro dela, onde está?"). Agrupar por marca dentro de uma marca só
   devolveria uma linha, que é relatório nenhum.
3. **"Revisões" é retrato, e não tem período — e isso foi uma correção.** O
   rascunho deste desenho pedia período e, ao mesmo tempo, uma coluna Situação
   (Vencida / Próxima / Em dia). As duas coisas se mordem: filtrando por data,
   um item que **nunca** foi trocado — justamente o mais vencido de todos —
   não teria linha nenhuma e sumiria do relatório de vencidos.

   Então a tabela tem **uma linha por item do plano de cada carro**, sempre, com
   a Situação calculada contra o hodômetro atual e a **última** troca ao lado.
   Item nunca trocado aparece, com "última troca" vazia e Situação "Vencida".

   O que isso deixa de fora: o histórico completo, com todas as trocas passadas
   de um mesmo item. Se o dono quiser, vira um 5º relatório da Frota — aí sim
   com período. Não está incluído porque ninguém pediu.

---

## 3. Como a aba se comporta

Três perguntas, de cima para baixo, uma de cada vez:

```
1. Qual relatório?     [Ficha dos veículos] [Checklists] [Revisões] [Quem esteve com]
2. De onde?            ( ) Tudo   ( ) Uma marca   ( ) Um local
                       → [Vessel ▾]   → [Fábrica Conchal (Vessel) ▾]
3. Quando?             [01/07/2026] até [10/08/2026]      ← só quando o relatório pede
────────────────────────────────────────────────────────
34 linhas · Vessel › Fábrica Conchal · 01/07 a 10/08
(a tabela, exatamente como vai sair)
                       [ Excel ]   [ PDF ]
```

**O passo 3 só existe quando faz sentido.** "Ficha dos veículos" e "Com quem
está cada bem" são retrato de agora; o campo de data nem aparece. Deixar um
campo inútil na tela é o começo da confusão que o dono pediu para evitar.

**A tabela na tela é literalmente o que sai no arquivo.** Nada de exportar e
descobrir que veio diferente.

**Período começa nos últimos 30 dias**, editável.

---

## 4. O recorte por marca e local

Reaproveita `src/compartilhado/arvore-de-locais.js`, que já monta e navega a
árvore Marca › Local › Ambiente e já tem teste. Nada novo é construído aqui.

### O local PRECISA aparecer com a marca junto

Medido no banco em 10/08/2026: **"Fábrica Conchal" existe em duas marcas** —
Vessel (148 bens) e RB Builders (2 bens). "Sede Limeira" também: RBV Company
(40) e Vessel (10). A própria migration 034 já tinha avisado disso:

> "O defeito real é a tela mostrar 'Fábrica Conchal' duas vezes sem dizer de
> quem é — quem escolhe não tem como acertar."

Então a lista de locais escreve **"Fábrica Conchal (Vessel)"**, nunca só o nome.
Um relatório entregue com o recorte errado é pior que relatório nenhum, porque
ninguém desconfia dele.

### Na Frota o filtro se chama "Empresa", e não "Marca"

Conferido no banco em 10/08/2026, depois de o dono dizer que os veículos já
tinham marca preenchida — **e ele estava certo**:

| | Preenchido nos 10 veículos? |
|---|---|
| `marca` — o fabricante: BMW, FIAT, VOLVO, PORSCHE… | **Sim, nos 10** |
| `empresa_id` — a empresa do grupo: Vessel, RB Builders, RBV Company | **Não, em nenhum** |

São dois campos que, na cabeça de quem usa, têm o mesmo nome. Quem abre a ficha
do carro vê "Marca: VOLVO" e conclui, com razão, que está preenchido.

Então **na Frota o filtro se chama "Empresa"** (decisão do dono). No Patrimônio
segue "marca", que é o certo lá — e o Patrimônio já resolvia isso na planilha
dele escrevendo "Marca / modelo" para uma e "Marca (empresa)" para a outra.

A casca recebe isso na propriedade `palavraDaMarca`. Cuidado registrado no
código: só palavra **feminina** ali, porque a frase do aviso concorda em
feminino ("sem marca apontada", "sem empresa apontada") enquanto "local" pede
masculino ("sem local apontado").

### O que fica de fora do recorte NUNCA some calado

Bem ou veículo sem marca/local apontado aparece em **"Tudo"** e num balde
visível chamado **"Sem marca"** / **"Sem local"** — os dois já existem como
`SEM_MARCA` e `SEM_LOCAL` naquele arquivo.

Regra: a aba mostra, acima da tabela, quantas linhas estão sem recorte. Uma
tabela que esconde linhas em silêncio é como o relatório vira mentira.

### Relatório de evento é recortado pelo local de HOJE

Checklists, revisões, uso e movimentação não guardam onde o veículo/bem estava
naquela data — guardam só o vínculo com o veículo/bem. Então o recorte usa o
local **atual**.

Consequência prática, que o dono aprovou sabendo: se um carro estava em Conchal
em julho e foi para Casa RB em agosto, os checklists de julho dele saem no
relatório de **Casa RB**. Fazer diferente exigiria carimbar o local em cada
registro, coisa que hoje não é feita.

---

## 5. Excel e PDF

**Excel** usa o `XLSX` que já está carregado em toda página
(`index.html`, linha 20) e que a Planilha do Patrimônio e o relatório de Redes
já usam. Nada novo entra.

**PDF é a impressão do navegador.** O botão monta uma folha própria e chama
`window.print()`; a pessoa escolhe "Salvar em PDF". Funciona no computador e no
iPhone, e **não acrescenta nenhuma biblioteca** — o projeto tem três
dependências hoje, e um botão não justifica a quarta.

A folha leva: título do relatório, o recorte por extenso, o período, a data de
emissão e a tabela em A4, com o cabeçalho da tabela **repetindo em toda página**
(`thead { display: table-header-group }`) — senão a partir da página 2 ninguém
sabe qual coluna é qual.

**Numeração de página fica por conta do navegador**, no cabeçalho/rodapé dele.
Isto é uma correção do rascunho, que prometia "página 1 de N" na nossa folha:
contador de página em conteúdo (`@page { @bottom-right { content: counter(page) } }`)
não é suportado por Chrome nem Safari. Prometer isso seria prometer o que não
dá para entregar.

**O risco conhecido**, e ele é real: imprimir exige esconder o resto do sistema,
e o CSS global deste projeto já vazou entre telas antes (ver
`project_iamundi_colisao_css_global`). A regra de impressão fica em arquivo
próprio, escopada na folha, e a conferência é imprimir de verdade em duas telas
diferentes — não deduzir do código.

---

## 6. Como fica no código

Um mecanismo só. Cada ferramenta apenas declara o que tem.

| Peça | Onde | O que é |
|---|---|---|
| A casca | `compartilhado/relatorios/aba-de-relatorios.vue` | Os 3 passos, a prévia, os 2 botões. Serve as duas ferramentas. |
| A exportação | `compartilhado/relatorios/exportar.js` | Lógica pura + teste: linhas → matriz do Excel, linhas → folha de impressão. |
| A folha | `compartilhado/relatorios/folha.css` | Só as regras de `@media print`, escopadas. |
| Catálogo da Frota | `ferramentas/frota/relatorios-da-frota.js` | Os 4: título, colunas, se pede período, como buscar, como recortar. |
| Catálogo do Patrimônio | `ferramentas/patrimonio/relatorios-do-patrimonio.js` | Os outros 4. |

Cada relatório declara suas colunas **uma vez**, e a mesma lista desenha a
tabela, monta o Excel e monta o PDF. É o que impede as três saídas de
discordarem entre si.

Os catálogos são `.js` puro com `.test.mjs` ao lado, como manda o `CLAUDE.md`.
A `.vue` fica fina de propósito: `tela-de-patrimonio.vue` já tem 2.400 linhas e
`tela-de-frota.vue` passou de 4.000 — não é lugar de colocar mais nada grande.

### O guarda de import vale para os arquivos novos

O defeito das abas Planilha e Resumo (consertado hoje, commit `2db9ee5`) foi
exatamente um nome usado sem importar, e foi a **terceira** vez. Toda pasta
tocada por este trabalho precisa ter o `imports.test.mjs`. Frota ainda não tem.

---

## 7. Permissão

Duas **chaves próprias** em `RECURSOS`, dentro de
`controle-de-login-e-usuario.js`:

```js
{ key: 'patrimonio.relatorios', label: 'Patrimônio — Relatórios', acoes: ['ver', 'exportar'] },
{ key: 'frota.relatorios',      label: 'Frota — Relatórios',      acoes: ['ver', 'exportar'] },
```

**Chave nova, e não ação nova** — isto é uma correção do rascunho deste
desenho, que pedia uma ação `relatorios` ao lado de `ver/criar/editar/excluir`.
Não dá: `ACOES_MATRIZ` é fixa em 5 colunas, e o próprio código já registra o
porquê, na linha de `conteudo.aprovar`:

> "Chave separada em vez de uma 6ª coluna 'aprovar' na matriz: ACOES_MATRIZ é
> fixa em 5 colunas, e uma coluna nova abriria célula vazia nas 15 linhas
> existentes para servir só a esta."

O formato acima copia `social.relatorio` e `gestor.relatorios`, que já existem e
já fazem exatamente isto.

**Nasce desmarcada para todo mundo, inclusive para o dono.** Nenhuma migration
concede a permissão a ninguém — quem libera é o Config de Admin, na mão. Regra
já estabelecida do projeto (`feedback_permissao_nasce_desmarcada`).

Lembrete de armadilha: este projeto tem **dois** modelos de permissão vivos
(`permissions{}` e `features[]`). Os dois precisam ser conferidos, e só
`is_superadmin` fura — `admin` não fura.

---

## 8. O que NÃO entra (YAGNI)

- Gráfico no PDF, capa, logo — o dono escolheu explicitamente a folha simples.
- Relatório salvo/favoritado, agendamento por e-mail, envio automático.
- Escolher colunas na tela. Cada relatório tem as colunas que tem.
- Recorte por Ambiente (3º nível). O pedido foi marca e local; ambiente pode
  vir depois, e o `arvore-de-locais.js` já suporta.

---

## 9. A pendência que trava metade do valor

**Medido em 10/08/2026: os 10 veículos estão com `empresa_id` e `local_id`
nulos. Todos.** A migration 034 criou as colunas em 07/08 e ninguém preencheu.

Consequência direta: no lado da Frota, escolher qualquer marca ou qualquer local
devolve **zero linhas** hoje. Só "Tudo" traz algo, e os 10 carros aparecem no
balde "Sem marca".

O texto antigo, escrito à mão, não resolve sozinho:

| `local_texto` | Carros | O que dá pra concluir |
|---|---|---|
| `Casa RB` | BMW X1, Porsche Cayenne, Volvo XC90 | Existe o local "Casa RB", da RB Builders ✅ |
| `Conchal` | Fiat Doblo | O local real é "Fábrica Conchal", e existe em **duas** marcas — Vessel e RB Builders. Indeciso. |
| `Barracão` | Honda Fit | **Não existe** local com esse nome. |
| *(vazio)* | Bravo Blackmotion, Bravo Essence, Punto, Fiesta, Volvo XC60 | Nada. |

Isso **não é decisão técnica**: de quem é cada carro e onde ele mora é o dono
que responde. Nada neste trabalho vai deduzir marca a partir de local, porque a
própria migration 034 registra que os dois são perguntas diferentes de
propósito — um carro da RBV Company pode passar a semana na fábrica da Vessel.

**Resolvido em 10/08/2026: o dono preenche os 10 na ficha, na mão.** O seletor
em árvore já está pronto na ficha desde 07/08. Nada de migration de dado — e
nada aqui vai deduzir empresa a partir do texto antigo.

Parte da confusão era de nome, não de preenchimento: ele tinha visto o campo
`marca` cheio (VOLVO, BMW…) e concluído que estava tudo lá. Ver a seção 4.

A aba pode ser construída e entregue antes disso — ela nasce correta e passa a
valer sozinha assim que os campos forem preenchidos. Mas enquanto não forem,
metade do que o dono pediu ("qualquer marca, ou só um local") não tem o que
mostrar na Frota. Está escrito aqui para que a entrega não pareça quebrada
quando for testada.

---

## 10. Em duas etapas, não de uma vez

Oito relatórios em duas ferramentas é grande demais para uma sessão só, e este
projeto já se queimou tentando (`feedback_acolitos_faseamento`). A ordem
importa:

**Etapa 1 — a casca + os 4 do Patrimônio.**
O dado do Patrimônio está saudável (350 bens, 2 sem marca, 8 sem local), então
é onde o mecanismo se prova de verdade: o recorte tem o que recortar, o Excel
tem o que exportar, e a impressão tem várias páginas para quebrar. Entrega
valor sozinha.

**Etapa 2 — os 4 da Frota.**
Depende dos 10 veículos ganharem marca e local (§9). Se a etapa 1 estiver de pé
e provada, esta é só declarar mais um catálogo — a casca não muda.

Fazer o contrário (Frota primeiro) seria construir a casca inteira contra o
único conjunto de dados que hoje devolve vazio.

---

## 11. Como se prova que ficou de pé

Teste verde não é tela que abre — regra aprendida à força neste projeto.

- Lógica pura (catálogos, colunas, recorte, matriz do Excel): `.test.mjs` ao lado.
- `imports.test.mjs` em toda pasta tocada, Frota inclusive.
- **Abrir no navegador, a 375px**, os 8 relatórios, e imprimir pelo menos dois
  de verdade — um curto e um que vire várias páginas.
- Conferir que o Excel abre e que o recorte no cabeçalho bate com o que foi
  escolhido na tela.
