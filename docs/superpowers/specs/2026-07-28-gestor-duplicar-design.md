# Gestão de Tráfego — Duplicar campanha / conjunto / anúncio (design)

Data: 2026-07-28
Ferramenta: `src/ferramentas/gestao-trafego`
Status: aprovado, não implementado

## Visão geral

O Gestor hoje sabe **pausar**, **reativar** e **mudar orçamento**. Não sabe
duplicar nada. Duplicar é a operação que o dono mais faz na mão dentro do
Gerenciador da Meta, por quatro motivos: reiniciar o aprendizado de uma
campanha que cansou, escalar o conjunto que está funcionando, testar uma
variação, e repetir o que deu certo em outra loja.

Este projeto entrega o botão **⧉ Duplicar** nos três níveis (campanha,
conjunto de anúncios e anúncio), sempre criando cópia **PAUSADA**.

## Objetivo / não-objetivo

**Objetivo**
- Duplicar campanha (com seus conjuntos e anúncios), conjunto (com seus
  anúncios) e anúncio isolado, dentro da MESMA conta de anúncios.
- Até 5 cópias de uma vez, com nome distinto por cópia.
- Cópia sempre pausada, com confirmação obrigatória antes de qualquer
  escrita na Meta.

**Não-objetivo (decidido, não esquecido)**
- **Trocar criativo, público ou posicionamento na hora de duplicar.** Isso é
  edição — vai para o projeto C (criar/editar campanhas e públicos no
  Gestor).
- **Copiar para OUTRA conta de anúncios.** A Meta não oferece isso: nenhum
  dos três endpoints `/copies` aceita conta de destino. Fazer isso exige
  RECRIAR do zero na conta destino, incluindo re-subir as imagens (no Meta o
  hash de imagem pertence à conta). Vai para o projeto C.
- **Trocar o orçamento durante a cópia.** A Meta não aceita. Não é
  necessário: o Gestor já edita orçamento (botão "✎ editar") — o fluxo é
  duplicar e depois ajustar.
- Corrigir a inconsistência de permissão do pausar (ver "Riscos").

## O que a Meta permite (verificado na documentação oficial)

Endpoints `POST /{id}/copies` existem nos três níveis:

| Nível | Endpoint | Parâmetros úteis |
|---|---|---|
| Campanha | `POST /{campaign_id}/copies` | `deep_copy`, `status_option`, `rename_options`, `start_time`, `end_time` |
| Conjunto | `POST /{adset_id}/copies` | idem + `campaign_id` (reparenta noutra campanha) |
| Anúncio | `POST /{ad_id}/copies` | `adset_id` (reparenta noutro conjunto), `creative_parameters`, `status_option`, `rename_options` |

Fatos que moldaram o design:
- `status_option` aceita `ACTIVE`, `PAUSED`, `INHERITED_FROM_SOURCE`. O
  padrão é `PAUSED` — mas o código manda `PAUSED` **explícito**, sem confiar
  no padrão da Meta.
- `deep_copy` (copiar os filhos junto) tem **teto de 3 anúncios** por chamada
  síncrona e 51 em modo assíncrono.
- **Não existe cópia entre contas de anúncio** em nenhum dos três níveis.

Referências:
- https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group/copies/
- https://developers.facebook.com/docs/marketing-api/reference/ad-campaign/copies/
- https://developers.facebook.com/docs/marketing-api/reference/adgroup/copies/

## Abordagem escolhida: cópia em cascata (rasa, um nível por vez)

Rejeitada a chamada única com `deep_copy=true`: o teto de 3 anúncios barra
exatamente a campanha grande que o dono mais quer duplicar, e uma falha não
diz o que deu errado. Rejeitado também o modo assíncrono: aguenta 51 mas
exige sessão assíncrona + consulta em laço, mais código para dar errado, e
deixa o usuário no escuro.

A cascata copia a campanha vazia, depois cada conjunto para dentro dela
(`campaign_id`), depois cada anúncio para o conjunto novo (`adset_id`):

- Sem teto de anúncios.
- Progresso visível passo a passo.
- Falha no meio identifica exatamente o passo.
- Custo: N+M+1 chamadas (campanha com 2 conjuntos e 6 anúncios = 9). Aceitável.

## Arquitetura

```
src/ferramentas/gestao-trafego/
  duplicar.js         NOVO — motor puro (sem tela, sem rede)
  duplicar.test.mjs   NOVO — testes do motor
  tela-de-gestao-trafego.vue   edição pequena: botão + ligação
  LEIA-ME.txt                  atualizado
```

**`duplicar.js`** expõe duas funções:

- `planoDeCopia(alvo, opts)` → devolve a lista ordenada de passos. Não executa
  nada. Recebe dados, devolve dados.
  - `alvo`: `{ nivel, campanha, conjuntos, anuncios }`. Só o que o nível exige
    precisa vir preenchido — `nivel: 'anuncio'` recebe apenas o anúncio,
    `nivel: 'conjunto'` recebe o conjunto e seus anúncios. O que não vier é
    tratado como lista vazia, nunca como erro.
  - `opts`: `{ quantidade, sufixo }`.
- `executarPlano(plano, { enviar, aoProgredir })` → percorre os passos.
  A função `enviar` (que fala com a Meta) é **injetada por fora**. Nos testes
  entra uma versão de mentira; na tela entra o `metaPost` que já existe.
  Devolve o relatório: passos concluídos (com o id que a Meta devolveu), o
  passo que falhou e o motivo.

**Nomes das cópias.** O sufixo é aplicado **só no objeto que você mandou
duplicar** (`rename_strategy: 'ONLY_TOP_LEVEL_RENAME'`). Os filhos mantêm o
nome original — dentro de uma campanha já renomeada, repetir "· cópia" em
cada conjunto e anúncio só polui a lista.

**"Continuar de onde parou"** reaproveita o relatório que já está na memória
da tela: ele sabe quais passos concluíram e com que id. A retomada refaz
apenas os passos pendentes, apontando para os pais já criados. Não há
varredura da conta para "descobrir" o que existe — adivinhar aqui é como se
criam duplicatas indesejadas.

Motivo da injeção: o motor inteiro fica testável sem tocar em conta real, e
quase todo o código novo mora em arquivo que a outra frente de trabalho não
toca (a pasta segue o mesmo padrão em `ponderada.js`, `veredito.js`,
`regua.js`, `orcamento-hierarquia.js`).

## Fluxo do usuário

1. Botão **⧉ Duplicar** ao lado dos botões existentes, nos três níveis.
   Só aparece para quem tem permissão de editar (ver Segurança).
2. Clique abre o `_gtConfirm` já usado por toda a tela, contendo:
   - o que será copiado, por extenso ("Campanha «X», com 2 conjuntos e 7 anúncios");
   - quantas cópias (1 a 5);
   - sufixo do nome, com sugestão pronta (`· cópia`, `· cópia 2`…);
   - aviso destacado: **"A cópia nasce PAUSADA. Nada vai gastar até você ativar."**
3. Confirmado, a tela mostra o progresso ("campanha ✓ · conjunto 1 de 2 ✓ ·
   anúncio 3 de 7…").
4. No fim, recarrega a lista via `loadGtData()`, como as outras ações já fazem.

## Segurança

**Permissão.** Duplicar exige `hasPermission('meta.gestor', 'editar')` — o
mesmo critério da edição de orçamento e da régua. Sem a permissão, o botão
não é desenhado. Duplicar cria objetos novos na conta: é a escrita mais forte
da tela, então fica no critério mais rígido que a ferramenta já usa.

**Travas antes de qualquer escrita:**
1. `_gtConfirm` obrigatório, listando por extenso o que será criado.
2. `status_option: 'PAUSED'` explícito em toda chamada de cópia.
3. A ferramenta nunca ativa nada. Ativar é sempre ação manual do dono.

## Erro no meio do caminho

- **Nada é desfeito automaticamente.** Apagar por conta própria para "limpar"
  é pior que o problema: um engano apaga o objeto errado.
- A tela relata exatamente o que foi criado até parar (nome + id) e oferece
  **"Tentar continuar de onde parou"** ou **"Deixar assim"** — tudo pausado,
  nada gastando.
- Erro traduzido reaproveitando o tradutor que a tela já tem em
  `_gtApplyAction` (permissão, token sem `ads_management`, limite de chamadas).
- **Limite de chamadas:** copiar 7 anúncios são 7 chamadas seguidas. Em caso
  de rate limit, espera e tenta de novo, seguindo o mesmo padrão já usado em
  `coletor/subir-estudio.mjs` (`ehRateLimit` + backoff).

## Testes (`duplicar.test.mjs`, rodam com `npm test`)

Todos contra uma Meta de mentira. Nenhum teste encosta em conta real.

1. O plano sai na ordem campanha → conjuntos → anúncios, com cada filho
   apontando para o pai recém-criado.
2. Campanha sem conjunto, conjunto sem anúncio e nível não identificado não
   quebram o plano.
3. **`status_option: 'PAUSED'` está presente em TODA chamada.** É o teste mais
   importante do lote: é ele que garante que uma cópia nunca nasce gastando.
4. Múltiplas cópias geram nomes distintos, sem colisão.
5. Falha no anúncio 3 de 7: para ali, relata os 2 que deram certo, não tenta
   os restantes.
6. "Continuar de onde parou" não recria o que já foi criado.

## Riscos / pontos a verificar

- **`meta-proxy` tem portão mais frouxo que a tela.** O proxy libera
  `role === 'admin' || features.includes('meta')`; a tela exige `meta.gestor`.
  Quem tem acesso só de leitura ao Meta Ads poderia chamar o proxy por fora.
  **Isso já vale hoje para pausar e para orçamento — duplicar não abre buraco
  novo.** Vale corrigir como projeto próprio, não escondido dentro deste.
- **Pausar/reativar não exige permissão de editar; orçamento exige.**
  Inconsistência pré-existente, reportada ao dono. Não será mexida aqui:
  é decisão dele e é território da outra frente de trabalho.
- **Colisão com a frente da métrica ponderada.** A outra janela trabalha em
  `ponderada.js`, `veredito.js`, `painel-regua.js` e na aba "A régua". Este
  projeto só encosta no `.vue` para o botão e a ligação. Antes de subir:
  buscar a `main`, juntar, rodar `npm run test:ci` e `npm run build`.

## Projetos irmãos (fila combinada com o dono)

Ordem definida: **B → C → A**.

- **B (este)** — Duplicar campanha/conjunto/anúncio.
- **C** — Criar e editar campanhas, públicos e posicionamentos dentro do
  Gestor. Absorve os dois não-objetivos acima (copiar para outra conta e
  trocar criativo/público na duplicação). Boa parte da base já existe e deve
  ser reaproveitada, não reconstruída: `coletor/lib/publico.mjs`
  (`montarTargeting`), edge `fabrica-publicos`, `payloadPlacements()` em
  `coletor/lib/meta-subir.mjs`, e `criarCampanhaNova()` em
  `coletor/subir-estudio.mjs`.
- **A** — Vigia de saldo das contas com alerta antecipado. Não existe nada
  hoje (todo "saldo" no projeto é estoque do Bling). O Gestor mostra saldo ao
  abrir a tela, mas ninguém vigia nem alerta.
