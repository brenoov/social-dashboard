# Config de Admin da Central — redesenho

**Data:** 2026-08-06 · **Estado:** aprovado pelo dono, pronto para virar plano

## O problema

A tela de administração (`src/ferramentas/admin/tela-de-admin.vue`, **1.966 linhas
num arquivo só**) cresceu por acumulação. O dono relatou, nesta ordem: está ruim
de usar no celular; a aba "Saúde dos dados" não deveria estar ali; "Times de
venda" e "Usuários" são a mesma conversa em dois lugares; e o modal de permissões
é confuso.

A tela é **imperativa**: o `<template>` tem a barra lateral e uns contêineres
vazios, e o conteúdo é montado por `innerHTML` dentro de funções chamadas por
`onclick="..."` literal. Isso é herança do monólito e é o que torna cada mudança
cara — inclusive esta.

## O que foi medido antes de desenhar

Nada aqui é suposição; cada número saiu de `SELECT` no banco de produção em
2026-08-05/06.

**Permissões — a matriz oferece muito mais do que se usa:**
21 ferramentas × 5 colunas = 105 células, das quais **só 45 existem** (a coluna
"excluir" tem 4 caixinhas reais em 21 linhas). E, entre as 17 pessoas,
**nenhuma ferramenta tem mais de 2 conjuntos distintos em uso** — e todos os
pares são encaixados (`["ver"]` dentro de `["ver","exportar"]`,
`["ver","editar"]` dentro de `["ver","criar","editar","excluir"]`).

Consequência que decide o desenho: **uma escada de níveis reproduz 100% do que
está concedido hoje.** Não há perda de poder, porque esse poder nunca foi usado.

**Lotação das pessoas — o que existe de verdade:**

| | Fonte | Preenchido (de 17 logins) |
|---|---|---:|
| Setor | `acessos_setores` (14 opções) | 4 |
| Local | `acessos_organizacoes` (5 opções) | 4 |
| Marca | **não existe campo** | 0 |

- O elo login↔pessoa é `acessos_pessoas.profile_id`: **9 dos 17** logins têm
  cadastro de colaborador.
- `acessos_pessoas.organizacao_id` aponta para `acessos_organizacoes`, cujo
  conteúdo é lugar ("Sede Centro", "Sede Village", "Fábrica Conchal"). É o
  **local**, sob outro nome.
- **Local tem duas listas concorrentes:** `acessos_organizacoes` (5, onde as
  pessoas apontam) e `patrimonio_locais` (13, onde bens e times de venda
  apontam). Mesma doença dos cinco nomes da mesma loja. **Fora do escopo desta
  entrega**, mas registrado.
- A lista de setores mistura departamento (`Marketing`, `RH`) com nome de loja
  (`Tivoli`, `Dom Pedro`), e tem `INFRAESTRUTURA` ao lado de `TI / Operações`.

**Saúde dos dados:** acusava 13 falhas por dia e **estava certa** — era o bug das
curtidas zeradas, já corrigido (ver `project_iamundi_curtidas_zeradas` na
memória e o commit `9943dda`). Isso não muda a decisão de tirá-la da barra, mas
muda o que fazer com o sinal.

## Decisões

Tomadas pelo dono, com a medição na mesa.

1. **A lotação mora no cadastro de Colaboradores** (`acessos_pessoas`), não no
   login. Uma verdade só.
2. **Agrupamento: uma gaveta por vez**, escolhida num seletor, com cabeçalho e
   contagem. Não é árvore de três níveis (com 17 pessoas e 14 setores, quase toda
   gaveta teria uma pessoa) nem filtro puro (perde o "quantos em cada lugar").
3. **As três gavetas entram já, mesmo vazias.** O dono foi avisado de que hoje
   isso produz "sem marca · 17" e escolheu assim; a seção "sem ___" é o empurrão
   para preencher.
4. **Permissões: níveis por ferramenta (A) + perfis prontos (C).** C vem depois
   de A e não substitui o editor.

## O desenho

### 1. Barra de navegação

**Sai:** "Saúde dos dados".
**Sai como item próprio:** "Times de venda" (vira seção dentro de Usuários).
**Fica:** Usuários · Contas · Solicitações · Metas · Dados.

O sinal da saúde **não morre**: vira uma faixa no topo da tela de **Dados**, que
só aparece quando a conferência da véspera achou divergência, no formato "a
conferência de ontem achou 13 divergências ›". Apagar o aviso junto com a aba
seria repetir o erro que deixou o bug das curtidas invisível por semanas.

### 2. Tela de Usuários — seções, nesta ordem

1. **Criar usuário** (topo, como pedido). Convite + troca de senha no primeiro
   acesso — o fluxo que já existe.
2. **Times de venda**. O conteúdo da aba antiga, mais os avisos que a tela já
   sabe dar: quantas pessoas em cada time, "Hortolândia sem depósito ligado", e o
   estado atual "nenhuma vendedora está num time ainda" com o atalho *Puxar das
   vendas*.
3. **As pessoas**, com seletor `Marca · Local · Setor` + busca. Cada pessoa
   mostra as **outras duas** informações embaixo do nome, mais o papel
   (super/admin/viewer). Quem não tem cadastro de colaborador aparece com
   "sem cadastro de colaborador" e atalho para ligar.

A seção "SEM ___" fica destacada (fundo âmbar), com a contagem e um atalho
"preencher ›". É informação, não erro: o campo é novo.

### 3. Modal de permissões — a escada

Cada ferramenta vira **uma** escolha, e cada ferramenta mostra **só os degraus que
ela tem**. Nada de célula vazia.

A escada é derivada do catálogo `RECURSOS` (nunca escrita em paralelo — este
projeto já sofre de dois catálogos que discordam):

| Ações da ferramenta | Degraus |
|---|---|
| `[ver]` | Sem acesso · Pode ver |
| `[ver, exportar]` | Sem acesso · Só ver · Ver e baixar |
| `[ver, editar]` | Sem acesso · Só ver · Ver e mexer |
| `[ver, criar, excluir]` (Banco) | Sem acesso · Só ver · Tudo |
| `[ver, criar, editar]` | Sem acesso · Só ver · Ver e mexer · Tudo |
| `[ver, criar, editar, excluir]` | Sem acesso · Só ver · Ver e mexer · Tudo |

Onde **"Ver e mexer" = `{ver, editar}`** e **"Tudo" = todas as ações do
catálogo**. (Nenhuma ferramenta do catálogo atual tem `editar` e `exportar` ao
mesmo tempo; se alguma vier a ter, `exportar` entra junto no "Ver e mexer".)

**Verificação obrigatória, e é o coração desta parte:** a escada tem de
reproduzir exatamente os 17 conjuntos em uso hoje. Conferido no papel — em
especial o caso da Frota, onde 6 pessoas têm `["ver","editar"]` (registram uso
sem cadastrar veículo) e 1 tem tudo: as duas viram degraus distintos, sem
promover ninguém. **Um teste que percorre as permissões reais e prova que
nível→conjunto devolve o conjunto original é requisito de aceite.**

O que não cabe em degrau vira **chavinha à parte**, com o nome por extenso:
`frota.aprovar` ("Pode aprovar requisição de veículo") e `conteudo.aprovar`
("Pode aprovar peças para publicar"). É o mesmo motivo pelo qual essas chaves já
existem separadas hoje.

### 4. Perfis prontos (segunda etapa, em cima da escada)

Escolher um perfil aplica um conjunto de degraus; o editor continua atrás de
"ajustar". Resolve o caso que está batendo à porta: **18 vendedoras entrando de
uma vez** (ver `project_iamundi_times_de_venda`).

Os perfis iniciais **saem dos conjuntos que já existem no banco**, não de nomes
inventados: agrupar as 17 pessoas por conjunto de permissões revela os padrões
reais, e o dono nomeia. Tabela nova `perfis_de_acesso` (chave, rótulo, descrição,
`permissions` jsonb).

### 5. Celular

O que se sabe hoje é **estrutural**, não medido: arquivo único de 1.966 linhas,
conteúdo por `innerHTML` (não dá para medir sem login), e grades com largura fixa
em pixel — a matriz de permissões é `minmax(110px,1fr) repeat(5,38px)`.

**A medição é parte da implementação, não do desenho.** Técnica já usada no
Patrimônio: extrair o `<style scoped>`, montar um HTML com a marcação real,
servir por http local (o `file://` é bloqueado) e medir a 375px e 1440px com o
Playwright. Critérios: sem rolagem horizontal na página, alvos de toque ≥ 40px,
campos a 16px (senão o iOS dá zoom), e **título que nunca corta**
(`feedback_padronizar_sem_perder_conteudo`).

Regra do projeto que vale aqui: ajuste no celular **não** pode estragar o
desktop (`feedback_responsivo_todos_dispositivos`), e a tela é full-bleed
(`feedback_largura_total`).

### 6. Fatiar o arquivo

1.966 linhas num `.vue` é o que torna tudo caro. A entrega extrai, junto com o
que já for mexido:

- `src/ferramentas/admin/lotacao.js` — puro: agrupar pessoas por marca/local/
  setor, contar, e produzir a seção "sem ___".
- `src/ferramentas/admin/niveis-de-permissao.js` — puro: catálogo → degraus,
  degrau ↔ conjunto de ações.
- `equipes.js` e `vendedoras.js` já existem e ficam como estão.

Só se extrai o que a entrega toca. Não é refatoração geral.

## Banco

- **Migration:** `acessos_pessoas.marca_id uuid` → `patrimonio_empresas(id)`,
  nulo permitido. É o campo que não existe hoje.
- **Migration:** tabela `perfis_de_acesso` (etapa dos perfis).
- **Nenhuma migration concede permissão a ninguém.** Regra do projeto
  (`feedback_permissao_nasce_desmarcada`): ferramenta e campo novos nascem sem
  acesso, e quem concede é o dono, pela tela.

## Fora do escopo (registrado, não esquecido)

- Unificar `acessos_organizacoes` × `patrimonio_locais` (duas listas de lugar).
- Limpar a lista de setores (lojas misturadas com departamentos; `INFRAESTRUTURA`
  × `TI / Operações`).
- Preencher marca/local/setor das 17 pessoas — é trabalho do dono, e a tela
  passa a cobrar.
- Ligar os 8 logins sem cadastro de colaborador.

## Pendência aberta

O dono relatou que a ferramenta **Status do Claude** mostra "o robô-coletor
parado". Conferido em 2026-08-06: os dois robôs com esse nome estão saudáveis —
`coletar-dados` (pg_cron 4×/dia) rodou no dia, situação `ok`, zero falhas em
24h; `coletor-noticias` (GitHub Actions, semanal) rodou na segunda com sucesso.
Os únicos cards que dizem algo parecido são **Fábrica · Ligar Anúncios** e
**Atualizador do Painel**, que mostram "Ainda não rodou nenhuma vez" porque de
fato não têm nenhum registro em `ia_execucoes`. **Falta o dono apontar onde
viu.** Não entra no plano até isso ser esclarecido.
