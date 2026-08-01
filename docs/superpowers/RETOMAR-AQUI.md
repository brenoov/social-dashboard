# Retomar daqui — 2026-07-31

Sessão longa encerrada por limite de contexto. Este arquivo é o suficiente para
continuar sem a conversa anterior.

---

## 1. O que está PRONTO e no ar (`main`)

Três projetos mesclados (PRs #74, #77, #78), com CI verde:

| | O que faz |
|---|---|
| **Duplicar** | Botão ⧉ nos três níveis (campanha/conjunto/anúncio). Cópia nasce PAUSADA, em cascata (foge do teto de 3 anúncios do `deep_copy`). |
| **Editar público** | Botão 👥 no conjunto. Cidade/raio/idade/gênero/interesses/públicos salvos/Advantage+. Preserva o que não gerencia. |
| **Sugestão de interesses** | Robô semanal + tabela + faixa na Fábrica. **Encanamento pronto; a QUALIDADE está em ajuste — ver §3.** |

Banco: `interesses_sugeridos` **aplicada**. `fabrica_marcas.segmento` **aplicada e
preenchida**. Segredos do GitHub: os quatro necessários já existiam.

### Ainda NÃO testado contra conta Meta real — decisão do dono
- **Duplicar** cria campanha de verdade.
- **Editar público** muda quem vê anúncios de campanha rodando.

O dono autorizou o que dá pra resolver sozinho, mas **escolher qual campanha
serve de cobaia é decisão de negócio, não técnica**. Peça uma campanha pausada
ou de gasto baixo antes de conduzir.

---

## 2. Trabalho EM ANDAMENTO

**Branch:** `fix/interesses-buscar` (publicada, sobre `main`)
**Último commit:** `2e7c2ea`+ · **árvore limpa** · **PR aberto, esperando revisão**
**Estado:** 117 testes em interesses (eram 92), build ✓.

### ✅ A INVESTIGAÇÃO FECHOU EM 2026-07-31 — e a causa não era nenhuma das suspeitas

Três medições no mesmo dia (R$ 0,60 no total) fecharam a pergunta que arrastava
desde o começo: **por que as sugestões prestavam tão pouco.**

**1ª medição — o campo `segmento` rendeu pouco, e o log entregou outra coisa.**
Os termos mudaram (`óculos de sol` em 3 objetivos, `carteira` e `cinto` em 1),
mas só 5 termos de 48. O que apareceu no lugar foi o filtro **de cabeça para
baixo**: 24 das 30 sugestões eram os MESMOS 4 itens, e dois deles eram lixo —
`VK Moda Feminina Plus Size` (rede social RUSSA, 3 mil pessoas no mundo) em 6/6.
Enquanto isso o teto derrubava `Acessórios de moda` (1,15 bi) também em 6/6: a
categoria da própria loja. **Tinha teto e não tinha chão.**

**2ª medição — quem achatava os seis objetivos era o catálogo, não a IA.**
Com a linha nova de "termo → achado": **28 dos 48 termos voltavam VAZIOS**.
`bolsas femininas` → nada, nos seis objetivos. Os objetivos JÁ pediam coisas
diferentes ("mensagens" pediu `atendimento personalizado`, `WhatsApp compras`);
elas só morriam na busca, e sobravam os mesmos genéricos.
👉 **`FOCO_DO_OBJETIVO` fica INOCENTADA com prova**, não com argumento. Era a
próxima suspeita da lista e não era ela. Não reabrir.

**3ª medição (a sonda, R$ 0) — o catálogo é indexado por SUBSTANTIVO PELADO.**
`coletor/sondar-interesses.mjs`, rodável por `-f modo=sonda`, pergunta direto à
Meta sem passar por IA. Dos 31 termos: os 13 vazios eram TODOS substantivo +
qualificador, e os 18 que acharam NENHUM tinha qualificador.

| | acha | não acha |
|---|---|---|
| bolsa | **Bolsas (acessórios)** 486 mi | bolsa feminina · bolsa de couro · bolsa transversal |
| cinto | **Cinto** 37 mi | cintos · cinto feminino · cinto de couro |
| carteira | **Carteira (acessórios)** 64 mi | carteiras · carteira feminina |
| óculos | **Óculos de sol** 435 mi | óculos escuros |

Também existem: `Mochila` 95 mi, `Clutch` 18 mi, `Acessórios de moda` 1,15 bi.
**Os produtos da loja sempre estiveram no catálogo — o robô é que pedia pelo
nome errado.**

### O que foi feito com isso
1. **Piso de público** (500 mil) — mata o lixo miúdo, e o corte aparece no log.
2. **Teto de 500 mi → 1,2 bi** — o anúncio já sai preso na cidade da loja com
   raio, então interesse global grande não espalha verba. Linha entre os dois
   únicos tamanhos já julgados (1,15 bi serve, 1,58 bi não).
3. **O pedido ENSINA a regra do substantivo pelado**, com os contra-exemplos
   medidos. ⚠️ É o OPOSTO da instrução que zerou tudo em `cef4b36`: aquela pedia
   termo mais ESPECÍFICO, esta pede mais CURTO. Há teste que FALHA se alguém
   escrever ali palavra que empurre a IA a estreitar ("específico", "nicho").
4. **Segunda etapa: a IA escolhe entre o que existe.** Substantivo pelado traz
   homônimo (`bolsa` traz 8 bolsas DE VALORES). Em vez de lista de bloqueio, a
   IA recebe as fichinhas REAIS e devolve **só id** — nome nunca mais sai da boca
   dela. Como a escolha é POR OBJETIVO, é aqui que os seis podem divergir.
   Falha nessa etapa DEGRADA (segue com a lista da busca), não derruba a rodada.

### Resultado medido (4ª rodada)
| | antes | depois |
|---|---|---|
| interesses achados | 30 | **44** |
| bolsa/cinto/carteira | nenhum | Bolsas 6/6 · Carteira 6/6 · Óculos 5/6 · Mochila 3/6 · Cinto 2/6 |
| VK russo · Roupa plus size | 6/6 cada | **fora** |
| bolsa de valores | — | cortada pela IA em 6/6 |

Lista de "vendas" hoje: Acessórios de moda · Bolsas · Óculos de sol · Presente ·
Carteira · Cinto · Mochila.

### ⚠️ O QUE SOBROU (afinação, não defeito — é daqui que se retoma)
- **`Bolsa de estudo` passou em 2 dos 6.** A IA cortou em quatro e deixou em
  dois. Reforçar na etapa de escolha que bolsa de estudo é de faculdade.
- **`estilo` e `tendência` só produzem lixo** (tai chi, esqui, mercado
  financeiro). Nenhum dos dois rendeu interesse aproveitável em rodada nenhuma.
- **Cinto só em 2 de 6**, sendo a MAIOR categoria do estoque (398 peças): a IA
  só pede `cinto` em metade dos objetivos. Mandar incluir sempre os produtos do
  estoque nos termos.

### Armadilha anotada no código
Esquecer `segmento` no `select` do robô **não daria erro**: chegaria vazio, a
linha sumiria, e a IA voltaria a adivinhar pelo nome — o próprio defeito
voltando em silêncio.

### Como medir (o ciclo que funciona)
```
git push origin fix/interesses-buscar
gh workflow run sugerir-interesses.yml --ref fix/interesses-buscar -f modo=seco
# ou, de graça, só perguntando à Meta o que existe:
gh workflow run sugerir-interesses.yml --ref fix/interesses-buscar -f modo=sonda
gh run list --workflow=sugerir-interesses.yml --limit 1 --json databaseId
gh run view <ID> --log | sed 's/^[^\t]*\t[^\t]*\t[^ ]*Z //' \
  | grep -E "La Vessel|^\s+[0-9]+\.|descartad|ficou com|SECO"
```
Custo: **R$ 0,30 por rodada seca** (12 chamadas: 6 de termos + 6 de escolha),
~4 min. Modo seco NÃO grava, mas **as chamadas de IA custam igual**.
**`modo=sonda` custa R$ 0** — não chama IA nenhuma, e por isso o passo dela no
workflow nem recebe a chave da Anthropic.

---

## 3. A investigação da qualidade — leia antes de mexer

O robô funciona. O problema é **o que ele sugere**.

### Hipóteses JÁ MEDIDAS E MORTAS — não repetir

| Hipótese | Resultado real |
|---|---|
| `locale: 'pt_BR'` na busca conserta os nomes estrangeiros | **Zerou 48 buscas.** A Meta aceita sem erro e devolve vazio. Formato errado. NÃO tentar outro formato às cegas. |
| Pedir termos "específicos" à IA melhora | **Zerou tudo.** A IA inventa termos que não existem no catálogo da Meta. |
| O `path` (categoria) separa relevante de lixo | **Não separa** — e agora por um motivo melhor documentado. Com termo curto aparecem paths de verdade (`Acessórios de moda > Bolsas`), o que dava esperança; mas `Cinto`, `Carteira`, `Mochila` e `Clutch` são achados BONS que também vêm como `Outros interesses`. Conferido item a item em 2026-07-31. Continua morta. |
| `FOCO_DO_OBJETIVO` é que faz os seis objetivos convergirem | **Não é ela.** Os seis pedem termos claramente diferentes; 28 de 48 morrem na busca e sobram os mesmos genéricos. Medido com a linha "termo → achado". Inocentada com dado, não com argumento. |

### O que FUNCIONOU
- Buscar (`type=adinterest`) em vez de validar palpite (`adinterestvalid`):
  **15% → 49 interesses**.
- Teto de público (500 mi, provisório): cortou "Compras na internet" (1,58 bi).
- **Falhar alto**: duas rodadas zeradas ficaram VERMELHAS com exit 1. Antes
  registrariam "0 gravadas, ok" e a faixa ficaria vazia sem nada parecer erro.
- Imprimir termos + nomes + tamanhos no modo seco: é o que tornou tudo visível.

### A pista do estoque — MEDIDA, e rendeu menos do que se esperava
A IA recebia só o nome **"La Vessel"** e deduzia "loja de moda feminina".
O estoque real diz outra coisa (`gc_estoque_item`):
Cinto 398 · Outros acessórios 200 · Transversal 180 · Bolsa de ombro 162 ·
Óculos 139 · Carteira 53 · Tote 52 · Bolsa de mão 49 · Clutch 45 · Mochila 16 —
**cinto é a maior categoria**, e nenhum termo jamais o citava.

Daí a coluna `segmento`. Medida em 2026-07-31: os termos MUDARAM, mas só 5 de 48
citaram produto novo. **Não era o remédio principal** — o remédio era a regra do
substantivo pelado (§2). O `segmento` continua no pedido e continua fazendo
falta: é dele que a IA tira quais produtos existem para pedir.

### Lixo que sobrevivia a todas as rodadas — RESOLVIDO
`VK Moda Feminina Plus Size` (3 mil, russa) em 6/6 e `Roupa feminina plus size`
em 6/6: **os dois sumiram**. O primeiro pelo piso de público, o segundo porque a
IA passou a escolher e ele não é produto da loja. `List of fashion magazines`
também caiu na etapa de escolha.

A decisão de **não construir lista de bloqueio** se confirmou certa: nenhum
desses precisou de lista — sumiram sozinhos quando a causa foi corrigida. Vale
manter a regra para o resto (`Bolsa de estudo`, hoje em 2/6).

---

## 4. Pendências registradas (não são bugs)

- **Node 20 nos workflows**: o GitHub avisa que vai parar de aceitar. Vale para
  **todos** os robôs do repo, não só os novos. Manutenção de uma vez só.
- **A faixa no Gestor de Tráfego** ainda não existe — o dado e a regra
  compartilhada (`baldeDoObjetivoDaFabrica` em `baldes.js`) já estão prontos.
- **`interesses_sugeridos` sem coluna de conta**, então fora da política por
  conta que a outra frente criou. Decisão registrada, não esquecimento.

---

## 5. Roadmap restante

| | O quê |
|---|---|
| **C2** | Editar posicionamentos (feed/story/reels). Ficou pequeno: herda o motor do editar-público. |
| **C3** | Criar campanha do zero no Gestor. **NUNCA foi feito** — o dono chegou a achar que sim. |
| **C4** | Copiar campanha para outra conta (a Meta não copia; exige recriar + re-subir imagens). |
| **C5** | Trocar criativo/público ao duplicar. |
| ~~—~~ | ~~Sugestão nativa da Meta (`adinterestsuggestion`)~~ — **SONDADA E DESCARTADA (2026-08-01).** O endpoint responde sem erro, mas devolve a MESMA lista para qualquer semente: `Acesso ao Facebook (celular)` 4,54 bi, `Amigos de pessoas que fazem aniversário` 3,15 bi, `Viajantes frequentes` 3,05 bi. 9 de 10 idênticos entre [Bolsas], [Cinto] e [Bolsas, Carteira]; o décimo é a própria semente. Não são parecidos: é uma lista fixa de comportamentos gigantes. Prova reproduzível por R$ 0 em `coletor/sondar-interesses.mjs`. |
| ~~A~~ | ~~Vigia de saldo~~ — a outra frente fez. |

---

## 6. Como esta sessão trabalhou (vale manter)

- **Plano escrito → subagente implementa → revisor independente → conserto.**
  ~15 rodadas de conserto. **Quase todos os defeitos vieram dos PLANOS, não da
  execução.**
- Os dois piores tinham a mesma forma: **afirmar algo sobre um dado sem abrir o
  dado.** Inventei o formato de uma coluna em vez de ler a migration; afirmei que
  a Fábrica "não tem ambiguidade de objetivo" sem abrir a tabela que tem a
  ambiguidade na primeira linha.
- **O que pega defeito não é reler o plano — é executar o código contra a
  realidade.** A revisão final do editar-público achou 4 defeitos graves que 7
  revisões por tarefa não viram, todos executando.
- **Testes verdes não provam que a funcionalidade presta.** A sugestão de
  interesses tinha 900+ testes passando e sugeria um filme americano de 2009.

### Regras que valem para os próximos planos
1. Formato de dado de banco **se lê na migration que criou a coluna**.
2. Formato de API externa afirmado "segundo a documentação" e não verificado ao
   vivo é **suposição vestida de restrição** — a doc da Meta erra sobre
   `audience_size` e sobre `locale`.
3. Toda função que recebe lista precisa de teste com **um item bom ao lado do
   ruim**, provando que o bom sobrevive.
