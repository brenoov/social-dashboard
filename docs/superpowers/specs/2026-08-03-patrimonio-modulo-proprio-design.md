# Dividir "Colaboradores e Acessos" em dois módulos: Colaboradores/Acessos e Patrimônio

Data: 2026-08-03
Estado: desenho aprovado, ainda não implementado

## O problema

A ferramenta `Colaboradores e Acessos` (`src/ferramentas/acessos/tela-de-acessos.vue`,
3.446 linhas) faz cinco coisas numa tela só, atrás de uma permissão só (`acessos`) e de
um card só no Início: Organizações/Setores/Colaboradores, Drive, Auditoria, **Patrimônio**
e Configurações.

Motivos da divisão (todos confirmados pelo dono):

1. Quem cuida de acesso a pasta não é quem cuida de celular, carro e notebook — cada
   lado precisa de permissão própria, e quem cuida de bem não deve nem enxergar acesso.
2. A ferramenta ficou grande demais pra usar e pra manter.
3. Patrimônio vai crescer muito (depreciação, manutenção, seguro, frota).
4. O dono quer a família visível na Central, como porta própria (ver D15).

## O que foi medido antes de desenhar

### No banco (2026-08-03)

| Tabela | Linhas |
|---|---|
| `acessos_pessoas` | 26 (23 ativas) |
| `acessos_organizacoes` | 5 |
| `acessos_setores` | 14 |
| `acessos_dispositivos` | **0** |
| `acessos_patrimonio_historico` | **0** |
| `acessos_termos` | **0** |

**O módulo de Patrimônio está vazio — nunca foi usado.** Isso significa que não é só
uma divisão: Patrimônio está nascendo agora, e as tabelas dele podem ser remodeladas
sem migração de dado.

### Na planilha real do dono

`Zoho WorkDrive → 01. RBV and Company / 01. Gestão de Serviços / Controle Patrimonio.xlsx`
(lida via a conexão Zoho do app, escopo `WorkDrive.files.ALL`).

Aba **`Base`**: 342 itens, R$ 1.294.235,13.
Colunas: `Número · Item · Valor · Empresa · Unidade · Setor · Pessoa · Etiquetado ·
Grupos · Descrição · D_01 · % Depreciação · Obs`.

Fatos que moldaram o desenho:

- **302 dos 342 itens (88%) não têm pessoa.** Bem mora num lugar, não numa pessoa.
- `% Depreciação` tem **1 linha preenchida de 342** — a planilha não sustenta isso.
- **Não existe coluna de data de compra** (procurado: data, aquisição, ano, nota fiscal).
- `Grupos → Descrição → D_01` é uma classificação de **3 níveis** já em uso:
  `Computadores e Periféricos → Notebook → Macbook`.
- Categorias (`Grupos`): Computadores e Periféricos 106, Móveis e Utensílios 106,
  Máquinas e Equipamentos 79, Celulares e tablets 26, Televisões 23, Veículos 1.
- `Etiquetado`: 328 "OK", 2 "Não" — controle de etiqueta física que já existe.
- 1 linha inteira preenchida com "Inutilizado" (nº 12) — marcador, não é bem.
- Números de 1 a 380 para 342 itens, **sem repetição** — servem de chave.
- 3 itens sem valor (nº 284, 285, 290 — "Macbook Neo").
- Sujeira de digitação: `VESSEL`×`Vessel`, `Ok`×`OK`.

Aba **`Dinamica`**: tabela dinâmica (soma de valor por Descrição × Empresa).
Aba **`telefones`**: 26 linhas de linha telefônica (conta, número, unidade, CNPJ,
modalidade FIXA/MÓVEL, responsável, bem vinculado).

### O achado que decidiu a estrutura

A planilha e o app usam **as mesmas palavras para coisas diferentes**:

| Planilha | App hoje | Situação |
|---|---|---|
| `Empresa` (Vessel 225, Moto Easy 59, RBV Company 52, RB Builders, Mantova) | *não existe* | o app não tem o conceito de empresa |
| `Unidade` (Fábrica Conchal, Piracicaba, Sede Limeira, Loja Tivoli… 16) | `Organização` (Sede Village, Sede Centro, Fábrica Conchal, Lojas, Itatiba) | mesmo conceito, nomes diferentes |
| `Setor` (Cozinha, Sala de Reunião, Estoque, Operação Loja… 34) | `Setor` (RH, Marketing, Comercial, Produção… 14) | **nome igual, coisa diferente** |

No app, `Setor` é onde a **pessoa** trabalha. Na planilha, `Setor` é onde o **objeto**
está. Reaproveitar um no outro corromperia os dois.

Cruzamento adicional (medido):

- **Local não pertence a uma empresa**: Fábrica Conchal tem Vessel 147 + RB Builders 1
  + RBV 1; Sede Limeira tem RBV 40 + Vessel 5. → Empresa e Local são eixos independentes.
- **Cômodo se repete entre locais** (11 dos 32): "Sala de Reunião" em 5 locais,
  "Administrativo" em 4. → Cômodo é lista única reutilizável, não filha do Local.

### Cruzamento de pessoas (29 na planilha × 26 no cadastro)

- **8 exatos**: Ana Vieira, Larissa Sousa, Breno, Thiago Siqueira, Silvana Godoi,
  Guilherme Cardoso, Gabriel Gertrudes, Theo Vieira.
- **10 por primeiro nome**, todos resolvíveis: Erick→Erick Martins, Paola→Paola Graf,
  Humberto→Humberto Mendonça, Eliana, Jeremias, Marcus, Dandara, Bárbara→Barbara Franco,
  e os dois que pareciam ambíguos **resolvem pelo próprio dado da planilha**:

  | Linha da planilha | Pista | Colaborador |
  |---|---|---|
  | nº 4 · Macbook Air M4 · RBV Company · setor `MKT` | Marketing | **Gabriel Alves** (setor Marketing) |
  | nº 307 · Macbook Air M4 · **Moto Easy** · Piracicaba | Moto Easy | **Clara Beduschi** (`@motoeasybrasil.com`) |

  Confirmado pelo dono: Gabriel Gertrudes é do Desenvolvimento, Gabriel Alves do
  Marketing; Clara Beduschi é da Moto Easy, Clara Marques da Vessel Conchal.
- **10 inexistentes**: Jéssica, Najla, Raíssa, Abner, Ionara, Isabela, ISABELLA BONINI,
  Maria Vitória, Maria Almeida (+ "Inutilizado", que é lixo).

Observação adicional: `acessos_pessoas` tinha **"Guilherme Cardoso" duplicado**. O
registro desligado (criado 2026-06-29 com `motivo_saida='Duplicidade'`, sem nenhum item,
termo, vínculo ou log apontando pra ele) foi **apagado em 2026-08-03 a pedido do dono**.
Sobrou o ativo, que é o que tem conta Zoho e avatar.

## Decisões tomadas

### D1 — Patrimônio ganha eixo próprio (não empresta o de Colaboradores)

```
COLABORADORES E ACESSOS          PATRIMÔNIO
  Organização                      Empresa   ─┐ eixos
    └ Setor                        Local     ─┤ independentes
        └ Pessoa                   Cômodo    ─┘
                                       └ BEM
                                            └ dono atual (opcional) ──► Pessoa
```

Os dois módulos se tocam **num ponto só**: o bem pode apontar pra uma pessoa.

### D2 — Bem pode existir sem dono

`pessoa_id` opcional. Situações: `em uso`, `em estoque`, `em manutenção`, `baixado`.
Sem isso, 88% da planilha não entraria.

### D3 — Banco de dados, com exportação para planilha

A planilha atual fica **congelada no WorkDrive como backup** (nada é apagado). Importa
uma vez, o dono confere, e ela vira histórico. O módulo ganha botão **"Exportar planilha"**
que gera `.xlsx` no formato de hoje (aba Base + aba de resumo).

Motivo: permissão separada, histórico de posse, manutenção com custo, seguro, termo em
PDF e edição simultânea não cabem numa planilha.

### D4 — Tudo que é lista é editável na tela

Empresa, Local, Cômodo, Categoria, Tipo, Marca/modelo, Situação. Nada chumbado no código.

### D5 — Patrimônio na ficha do colaborador vira só leitura

A ficha continua **mostrando** o que a pessoa tem em mãos (útil no desligamento), com
link "abrir no Patrimônio" já filtrado nela. Sem botão de cadastrar/editar. Quem não tem
permissão de Patrimônio vê só a contagem.

### D6 — Documentos: divide

- **Documento da pessoa** (contrato, RG, advertência) → fica em Colaboradores, na ficha,
  como está hoje (`acessos_termos`).
- **Termo de entrega do bem** → vai pro Patrimônio, anexado ao bem.

Custo zero de migração: `acessos_termos` tem 0 linhas.

### D7 — Depreciação por vida útil de categoria

O dono define uma vez por categoria (computador 5 anos, móvel 10, veículo 5 — editável) e
o app aplica em todo bem daquela categoria a partir da data de compra. Mostra valor de
compra **e** valor atual.

**Buraco conhecido:** a planilha não tem data de compra. Os 342 itens importados entram
**sem data**, e o app mostra `valor de compra R$ X · idade não informada` em vez de
inventar número. A depreciação de cada item liga sozinha quando a data for preenchida.

### D8 — Blocos novos desta leva

- **Manutenção com custo**: lista por bem (o que foi feito, quando, fornecedor, custo,
  nota anexada). O bem passa a mostrar "custou 8 mil, já consumiu 3,4 mil em conserto".
- **Seguro**: apólice por bem (seguradora, número, vigência, valor segurado, prêmio) com
  **aviso de vencimento** (30 dias) na abertura do módulo.
- **Linha telefônica** como categoria com ficha própria (conta, número, CNPJ, modalidade),
  a partir da aba `telefones`.

### D9 — Carro: cadastro em Patrimônio, vida na Frota (módulo futuro)

| | Patrimônio (esta leva) | Controle de Frota (depois) |
|---|---|---|
| Carro como **bem** | valor, empresa, local, dono, depreciação, seguro, manutenção | — |
| Carro **rodando** | — | placa, RENAVAM, chassi, KM, licenciamento, IPVA, multas, abastecimento, revisão |

Um cadastro só, dois módulos olhando pra ele. Placa/RENAVAM/IPVA/licenciamento **não**
entram nesta leva.

### D10 — Inventário anual e etiqueta/QR ficam de fora

O dono não tem certeza se precisa. Não entra.

### D11 — Celular primeiro

Patrimônio é usado majoritariamente no celular. Consequências obrigatórias:

- **Cartão, não linha de tabela.** A tabela de 13 colunas existe só no desktop.
- Um dedo dá conta: alvos grandes, nada de clique fino.
- Filtro em **faixa que rola** (nunca quebra em 3 linhas) — mesma solução já validada no
  Gestão de Tráfego.
- Campos de 16px no `≤640px` (senão o iOS dá zoom sozinho) + `touch-action:manipulation`.
- Largura cheia da tela, sem `max-width` centralizado (regra fixa do dono).
- Breakpoints da base: celular ≤640 · tablet ≤1024 · desktop ≤1919 · TV ≥1920.

Esboço da tela no celular:

```
┌─────────────────────────────┐     ┌─────────────────────────────┐
│ PATRIMÔNIO           [+]    │     │ ← Macbook Air M4            │
│ 342 itens · R$ 1,29 mi      │     │  Nº 3 · etiquetado ✓        │
│ ┌─────────────────────────┐ │     │  R$ 8.000,00                │
│ │ 🔍 buscar bem…          │ │     │  hoje R$ 6.400,00           │
│ └─────────────────────────┘ │     │  📍 Sede Limeira · RH       │
│ [Todos][Vessel][MotoEasy]▸  │     │  👤 Larissa Sousa           │
│ ┌─────────────────────────┐ │     │ ┌─────────┐ ┌─────────────┐ │
│ │ 💻 Macbook Air M4       │ │     │ │ Entregar│ │  Devolver   │ │
│ │    Nº 3 · R$ 8.000      │ │     │ └─────────┘ └─────────────┘ │
│ │    👤 Larissa           │ │     │  ▸ Histórico de posse (3)   │
│ └─────────────────────────┘ │     │  ▸ Manutenções (1) R$ 340   │
│ ┌─────────────────────────┐ │     │  ▸ Seguro — sem apólice     │
│ │ 📱 Xiaomi Redmi         │ │     │  ▸ Documentos (2)           │
│ │    Nº 47 · ○ em estoque │ │     │  ▸ Fotos (1)                │
└─────────────────────────────┘     └─────────────────────────────┘
```

### D12 — Tutorial dentro do app

1. **Primeira vez**: passeio guiado de 5 passos apontando pros botões reais. Pode pular
   e reabrir depois (marcador em `localStorage` + registro no perfil).
2. **Tela vazia que ensina**: em vez de "Nenhum item", explica o que fazer e por quê.
3. **`?` em cada bloco**: abre explicação curta em português direto ("Depreciação é quanto
   o bem já perdeu de valor com o tempo de uso").

Linguagem: português literal, sem jargão (regra fixa do dono).

### D13 — Resumo vivo no lugar da aba `Dinamica`

Tela de Resumo que soma valor cruzando o eixo escolhido (empresa, local, categoria,
pessoa), atualizando sozinha. Substitui o "atualizar tabela dinâmica" da planilha.

### D14 — Importação dos 342 itens

- Linha nº 12 ("Inutilizado" em toda coluna): **pulada**.
- `VESSEL`/`Vessel` e `Ok`/`OK`: normalizados; o dono vê a lista final antes de gravar.
- 3 itens sem valor (284, 285, 290): importados com valor em branco e marcados pra conferir.
- `Número` da planilha vira o **número de patrimônio** no app (a etiqueta física continua
  valendo).
- **Pessoas**: nome exato → vincula; primeiro nome sem ambiguidade → vincula. Quando o
  primeiro nome tem mais de um candidato, **desempata pela Empresa/Unidade/Setor da
  própria linha** antes de desistir (foi o que resolveu "Gabriel" e "Clara" — ver acima).
  Sobrando ambiguidade, ou nome inexistente (10 nomes, ~13 itens) → **guarda o nome como
  texto**, marcado como "pessoa não cadastrada", numa lista de pendências com os botões
  "ligar a um colaborador" e "cadastrar". **Nunca cria colaborador sozinho.**
- A importação é **conferível antes de gravar** (prévia com contagem por empresa/categoria).

### D16 — Navegação em árvore: Empresa → Local → Cômodo → bens

Pedido do dono depois de ver a F1: os bens não ficam numa lista plana, ficam
**separados por Empresa / Local / Cômodo**, e se navega **entrando nível a nível**
(não acordeão, não lista agrupada por título). Cada nível mostra contagem e valor
somado, e a trilha no topo deixa pular de volta pra qualquer nível.

Regras que caíram junto:

- **Buscar sai da árvore.** Digitou no campo de busca, some a hierarquia e a resposta
  vem em lista: buscar é um pedido de "ache em TUDO", e obrigar a adivinhar a pasta
  depois de digitar o nome do bem seria absurdo.
- **Empresa e Local saíram da faixa de filtros** — agora eles SÃO a navegação. Manter
  os dois recortes faria eles brigarem entre si.
- **"Ver os N itens daqui, sem separar"** em cada nível: escape pra quem quer a lista
  sem descer até o último cômodo.
- **Nenhum bem pode sumir.** O dado real tem 2 itens sem empresa, 8 sem unidade e 12
  sem setor. Todo nível ganha um grupo **"Sem empresa/local/cômodo"** (sempre por
  último, em âmbar) e dá pra ENTRAR nele. Bem que está num nível mas não cai em
  nenhum grupo abaixo aparece solto ali mesmo, sob "N itens direto aqui".
- **Um botão de voltar só**: sobe um degrau da árvore e, na raiz, sai do módulo.

Lógica pura em `src/ferramentas/patrimonio/arvore-de-bens.js` (11 testes).

### D15 — Família "Gestão Interna": matriz como PORTA, não como caixa

O dono perguntou se Frota podia ser um submódulo da mesma ferramenta-matriz. A resposta é
sim, **desde que a matriz seja uma porta (menu) e não uma caixa (arquivo único com abas)**.

| | Matriz-CAIXA (rejeitada) | Matriz-PORTA (adotada) |
|---|---|---|
| Arquivo | 1 arquivo com tudo | 1 menu curto + 1 arquivo por submódulo |
| Permissão | 1 pra tudo | 1 por submódulo, todas nascem desmarcadas |
| Abrir Frota | carrega os outros dois junto | carrega só Frota |
| Merge com 2 pessoas | conflito | cada um no seu arquivo |

A caixa é exatamente o problema que este desenho desmonta (5 abas em 3.446 linhas). Se a
Frota entrar como aba ali, em seis meses são 5.000 linhas e a mesma conversa.

O app **já tem esse padrão, usado três vezes**: `tela-de-menu-vendas.vue`,
`tela-de-menu-meta-ads.vue`, `tela-de-menu-redes.vue`.

```
CENTRAL
  └── [card] Gestão Interna              ← 1 porta
         ├── Colaboradores e Acessos       (arquivo + rota + permissão próprios)
         ├── Patrimônio                    (arquivo + rota + permissão próprios)
         └── Frota                         (idem — fase futura)
```

O menu mostra **só os submódulos que a pessoa tem permissão de ver** — mesmo
comportamento do menu de Vendas hoje. Quem só tem Patrimônio abre a porta e vê um item só.

Consequência: a Central ganha **um** card (`Gestão Interna`), não um por submódulo. O card
antigo `home-card-acessos` sai da Central e vira item do menu.

## Arquitetura

### Front

- Menu novo `src/ferramentas/gestao-interna/tela-de-menu-gestao-interna.vue`, rota
  `/gestao-interna`, card `home-card-gestao-interna` no Início. Segue o padrão de
  `tela-de-menu-vendas.vue`.
- Novo componente `src/ferramentas/patrimonio/tela-de-patrimonio.vue` + módulos de lógica
  pura irmãos (`.js` + `.test.mjs`), seguindo o padrão da frota de telas.
- Rota `/patrimonio`, nome `patrimonio`, lazy `import()` em `src/mapa-de-enderecos.js`.
- A tela de acessos continua em `/acessos`, agora alcançada pelo menu (o card direto na
  Central sai).
- LEIA-ME.txt na pasta nova (regra fixa).
- Reaproveitar os módulos puros que já existem e já têm teste:
  `patrimonio.js` (dinheiro em centavos, histórico de posse) e `patrimonio-lista.js`
  (somar, filtrar, formatar data) — hoje importados pela tela de acessos.

### Permissão

Chave nova `patrimonio` no `PERMISSION_TREE` e no `features[]`, com ações
`ver/criar/editar/excluir`. **Nasce desmarcada pra todo mundo** — nenhuma migration
concede acesso; o admin concede na tela de permissões. (Regra fixa do projeto.)

O **menu Gestão Interna não tem permissão própria**: ele aparece na Central se a pessoa
tiver `acessos.ver` **ou** `patrimonio.ver`, e lista apenas os submódulos permitidos.
Assim não existe uma porta a mais pra conceder nem uma porta que abre pra sala vazia.

Atenção ao gotcha conhecido: existem **dois modelos** de permissão no app —
`permissions{}` (front) e `features[]` (Edge/RLS). Os dois precisam da chave nova.

### Banco (migrations em `db/migrations/acessos/`, rodadas por `coletor/run-acessos-sql.mjs`)

Tabelas novas com prefixo `patrimonio_`:

| Tabela | Papel |
|---|---|
| `patrimonio_empresas` | Vessel, Moto Easy, RBV Company, RB Builders, Mantova |
| `patrimonio_locais` | Fábrica Conchal, Piracicaba, Sede Limeira, lojas… |
| `patrimonio_comodos` | lista única reutilizável (Cozinha, Sala de Reunião, Estoque…) |
| `patrimonio_categorias` | 6 grupos + `vida_util_anos` (depreciação) |
| `patrimonio_tipos` | nível 2 (Notebook, Desktop, Mesa…), filho de categoria |
| `patrimonio_bens` | o bem; `pessoa_id` **nullable** + `dono_texto` pro nome solto |
| `patrimonio_posse` | histórico de posse (bem, pessoa, de, até, motivo) |
| `patrimonio_manutencoes` | serviço, data, fornecedor, custo em centavos, nota |
| `patrimonio_seguros` | seguradora, apólice, vigência, valor segurado, prêmio |
| `patrimonio_documentos` | termo de entrega / nota / foto, com `tipo` |
| `patrimonio_log` | auditoria de quem mexeu no quê |

Campos por categoria (linha telefônica, veículo) em `detalhes jsonb`, no mesmo padrão de
campos dinâmicos que a tela de acessos já usa.

Dinheiro **sempre em centavos** (`bigint`), nunca em float.

RLS: `is_patrimonio_admin()` (security definer, `execute` revogado de `anon`/`public`),
policy `for all to authenticated using is_patrimonio_admin()`, espelhando
`is_acessos_admin()`. Bucket privado `patrimonio-arquivos` com storage RLS.

As tabelas antigas e vazias (`acessos_dispositivos`, `acessos_patrimonio_historico`)
são **substituídas**, não migradas — 0 linhas nos dois lados.

### O que sai da tela de acessos

- Aba `Patrimônio` inteira (`_acRenderPatrimonio`, `_acPatPaint`, `_acPatSetFiltro`,
  `_acPatHistorico`, `_acPatDel`, `_acPatTrocarDono`, `_acFormItem`, `_acSaveItem`,
  `_acSetItemStatus`, `_acDelItem`, `_acItemTipoLabel`).
- Os blocos de cadastro de Dispositivos/Veículos da ficha → viram bloco de só leitura.
- A tela de acessos deve encolher de forma verificável (medir linhas antes/depois).

## Faseamento

O desenho é grande demais pra uma sessão só. O plano de implementação deve quebrá-lo em
fases que sobem funcionando sozinhas, nesta ordem:

| Fase | Entrega | Por que nesta ordem |
|---|---|---|
| **F1** | Menu Gestão Interna + permissão `patrimonio` + módulo Patrimônio com o básico (bem, empresa/local/cômodo/categoria editáveis, dono opcional, situações, celular-primeiro) | é o esqueleto; sem ele nada mais tem onde morar |
| **F2** | Importação dos 342 itens, com prévia conferível e lista de pendências | valida o esqueleto contra dado real antes de construir em cima |
| **F3** | Ficha do colaborador em só leitura + termo de entrega migrado pro bem | fecha o divórcio com o módulo de Colaboradores |
| **F4** | Depreciação, manutenção com custo, seguro (com aviso de vencimento) | os blocos novos, sobre uma base já povoada e conferida |
| **F5** | Resumo vivo (ex-`Dinamica`) + exportar planilha + tutorial guiado | acabamento; o tutorial só faz sentido com as telas prontas |

Frota é uma leva à parte, depois da F5.

## Riscos e cuidados conhecidos

1. **CSS escopado**: quase todo o CSS é `#acessos-screen .classe`. Modal criado por JS e
   anexado em `document.body` fica FORA do escopo e renderiza quebrado. No módulo novo,
   anexar sempre dentro da raiz da própria tela. (Já custou caro uma vez.)
2. **Comentário no `<style>` com `*/` no meio** fecha o comentário cedo e quebra o build.
3. **`onclick` inline que atribui variável de módulo** não funciona (escopo global ≠ `let`
   do módulo) — expor função que faz atribuição + render.
4. **`npm run build` antes de todo commit** — não commitar build quebrado.
5. **Git `user.email` vazio trava o build na Vercel.**
6. Permissão nova precisa aparecer nos **dois** modelos (`permissions{}` e `features[]`).
7. A conferência final é no **celular real**, não só em render de 375px.

## Fora de escopo (fases futuras)

- **Controle de Frota** — terceiro submódulo de Gestão Interna, com arquivo, rota e
  permissão próprios (placa, RENAVAM, chassi, KM, licenciamento, IPVA, multas,
  abastecimento, revisão). Lê os bens de categoria Veículo cadastrados no Patrimônio;
  não duplica cadastro de carro. Nesta leva aparece no menu apenas como "em breve".
- Inventário anual e etiqueta/QR.
- Leitura automática e recorrente da planilha do WorkDrive (a importação desta leva é
  **uma vez**, conferida antes de gravar).
