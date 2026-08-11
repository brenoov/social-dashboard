# A data da venda: o dia da nota, não o dia do pedido

Status: **Etapa 1 no ar** · Etapas 2 e 3 dependem de decisão do dono.

## O problema, em uma frase

A dashboard lança a venda no dia em que o **pedido foi gerado**. O dono viu um
pedido do Atacado gerado na quinta e faturado na sexta aparecer na quinta.

## O que foi medido (11/08/2026, dados reais)

| | |
|---|---|
| Pedidos concluídos num dia posterior ao do pedido, últimos 30 dias | 44 · R$ 31.143,58 (teto) |
| Com atraso de exatamente 1 dia | 18 · R$ 19.375,69 |
| Conferido contra a nota de verdade | 4 de 11 pedidos com data diferente |
| Padrão | loja emite NFC-e no mesmo dia; Atacado emite NF-e no dia seguinte |

Casos que serviram de prova: nº2429 (R$ 3.644,30) e nº2427 (R$ 2.550,74),
pedido 04/08 → nota 05/08. E o nº2372, pedido de 27/07, concluído em 11/08 —
esse **sem nota nenhuma**.

## Armadilhas medidas (não deduzir de novo)

1. **`dataSaida` do pedido não serve.** Igual à `data` nos 493 pedidos atendidos
   dos últimos 90 dias. O Bling preenche na criação e não atualiza no
   faturamento.
2. **O filtro de data da LISTA de notas deixa escapar a borda de baixo.** Pedir
   `04..04` devolve zero; `03..06` devolve o dia 04. Por isso a nota é lida pelo
   **id** que o pedido informa.
3. **"Pedido sem nota" chega como `notaFiscal.id = 0`**, não como vazio.
4. **Reautorizar o Bling invalida o token anterior E o refresh_token.** Custou
   uma queda do sistema em 11/08. O `code` da autorização vale ~60 segundos.

## Etapa 1 — guardar a data certa ✔ FEITA

- `db/migrations/2026-08-11-nota-fiscal-dos-pedidos.sql` → tabela
  `bling_pedido_nota`, com `data_da_venda` como **coluna gerada**
  (`coalesce(data_da_nota, data_pedido)`). Gerada de propósito: se cada tela
  decidisse a regra, cinco telas dariam cinco respostas.
- `coletor/notas-dos-pedidos.mjs` (diário, janela de 7 dias, idempotente) +
  regras puras em `coletor/lib/notas-bling.mjs` com 13 testes.
- `.github/workflows/notas-dos-pedidos.yml` — 09:23 UTC, depois do Relatórios
  Comerciais (os dois batem no mesmo Bling, que limita 3 chamadas/segundo).
- `bling-proxy` v9: rotas `nfe`/`nfce` liberadas, só leitura.

**Nenhum número de tela mudou nesta etapa.** De propósito.

## Etapa 2 — as telas passarem a usar a data da nota

Telas: Gestão à Vista (o telão) e Análise de Vendas. Hoje as duas pedem ao Bling
`pedidos/vendas` por faixa de data do pedido e somam o que vier.

Três caminhos possíveis, do mais barato ao mais definitivo:

**A · Janela alargada.** Buscar no Bling de `início − 30 dias` até `fim`, e
depois manter só os pedidos cuja `data_da_venda` cai na janela pedida.
Simples, mas o telão passa a baixar 30 dias de pedidos para mostrar "hoje" —
e ele já busca sequencial por causa do limite do Bling.

**B · Correção cirúrgica.** Buscar a janela normal (como hoje) e, pela nossa
tabela, (1) tirar os pedidos que saíram desta janela e (2) trazer os poucos que
entraram, buscando esses um a um. Mede-se em unidades: foram 44 pedidos em 30
dias. Rápido, mas espalha regra por duas telas.

**C · Virar a fonte.** As telas passam a ler as vendas do nosso banco (como a
Gestão Comercial já faz com `gc_vendas_item`), e o Bling fica só para o "ao
vivo" de hoje. É a mais trabalhosa e a que deixa tudo mais rápido — leitura do
Supabase não tem limite de 3 por segundo.

Recomendação: **B** se o objetivo é consertar a data logo; **C** se o telão
lento já incomoda (aí conserta as duas coisas de uma vez).

## Etapa 3 — o resto

Notificação das 22h/07h, Relatórios Comerciais e briefing do Gestor. Todos
usam o mesmo filtro; nenhum pode ficar para trás, senão dois lugares do sistema
passam a dar números diferentes — que é a pior classe de defeito deste projeto.

## O que o dono precisa saber antes da Etapa 2

Os números de meses fechados vão mudar. Não é defeito, é a correção — e é por
isso que a Etapa 1 termina com o relatório de antes/depois, mês a mês.
