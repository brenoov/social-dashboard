# Frota — A assinatura do checklist

Complemento de `2026-08-05-frota-checklist-motorista-design.md`, que continua
valendo. Aquele desenho dizia, em "Fora de escopo": *"Assinatura das duas partes
que o papel pede: quem preenche está logado, e o login é a assinatura."* **Este
documento reabre aquela decisão, a pedido do dono.**

## De onde veio

O dono pediu: *"assinatura para comprovar que a pessoa fez a revisão e olhou o
que era necessário, quero sim que arquive isso em uma pasta do zoho também, a
assinatura eu queria que fosse algo autenticado tipo pelo gov.br"*.

**O gov.br foi avaliado e recusado, com o dono ciente.** Ele existe, é gratuito e
tem valor legal bom (assinatura avançada, Lei 14.063/2020). O que o derruba aqui é
prático: exige conta gov.br nível prata ou ouro **de cada motorista**, e a cada
assinatura a pessoa sai do app, autentica no gov.br e assina o PDF. Isso **toda
manhã, para um checklist de 30 segundos**, é o mesmo defeito que a F6 inteira
existiu para consertar — `frota_uso` nasceu vazia porque o sistema pedia um gesto
que ninguém tinha motivo para fazer. Juridicamente ele também é exagerado: a
assinatura avançada é exigida para interação com órgão público; entre empresa e
funcionário, a MP 2.200-2/2001 aceita meio eletrônico simples com autoria
demonstrável.

Alternativa oferecida e não escolhida agora: **carimbo do tempo ICP-Brasil**
(RFC 3161), que dá o atestado de terceiro independente por documento, sem exigir
conta de ninguém. Fica registrada aqui como o caminho se um dia a força de um
terceiro for necessária — é a peça que se acrescenta, sem refazer nada.

## O obstáculo que decide se isso funciona

**Quatro dos sete motoristas não têm login**: Barbara Franco, Marcus Vinicius,
Thiago Siqueira e Raissa Herculano (`acessos_pessoas.profile_id` nulo). Se a
assinatura é a senha da pessoa, **essas quatro não conseguem assinar**. O dono
assumiu criar as contas.

Enquanto não existirem, a tela **precisa dizer isso na cara**, e não deixar a
ficha parecer assinada. Ver D22.

## Decisões

### D19 — A assinatura é a senha no instante, mais o encadeamento

Três peças, e cada uma cobre uma coisa diferente:

| Peça | O que ela prova |
|---|---|
| **Senha pedida no instante de assinar** | que foi aquela pessoa, e não quem pegou o celular destravado |
| **Impressão digital do conteúdo** (SHA-256) | que o texto assinado é exatamente este |
| **Encadeamento na ficha anterior do mesmo carro** | que nada foi alterado depois — mexer numa quebra todas as seguintes |

**O encadeamento é por CARRO, não geral.** A pergunta numa disputa é sempre
*sobre um carro*: "mostra o histórico do Volvo". Corrente por carro se verifica e
se apresenta sozinha; corrente global obrigaria a exibir fichas de outros
veículos para provar a integridade de um.

**O que entra na impressão digital**, nesta ordem exata (a ordem faz parte da
prova): `veiculo_id`, `feita_em`, `pessoa_id`, `hodometro`,
`hodometro_justificativa`, as cadências, **cada item na ordem da ficha** com
`item_texto` + `estado` + `observacao`, `resultado`, `anomalias`, `assinada_em`,
e o `hash` da ficha anterior daquele carro. A primeira ficha de cada carro
encadeia em texto vazio, e isso fica dito no registro.

### D19b — O que a assinatura NÃO protege, dito por extenso

| Risco | Coberto? |
|---|---|
| Outra pessoa assinar no seu nome | **Sim**, pela senha |
| Alteração da ficha depois de assinada | **Sim**, pelo encadeamento e pelo gatilho de D21 |
| **O motorista marcar tudo OK sem olhar o carro** | **NÃO. E nada resolve isso.** |

Está escrito aqui porque a promessa de "assinatura autenticada" convida a achar
que o terceiro caso está coberto, e ele não está. **Assinatura nenhuma faz alguém
olhar embaixo do carro.** O que ajuda é o registro ser permanente e nominal — e
D20.

### D20 — O tempo de preenchimento é registrado

Da abertura do cartão até a assinatura. É de graça e é o único sinal que existe
contra "marcou tudo sem olhar".

**O sinal é assimétrico, e isso importa:** tempo curto **prova** desatenção —
quatro itens em três segundos não foram olhados. Tempo longo **não prova** zelo,
porque a pessoa pode ter aberto e ido tomar café. Então o número serve para
levantar suspeita, nunca para atestar cuidado, e a tela de gestão deve apresentá-lo
assim: destacando o rápido demais, sem elogiar o demorado.

### D21 — Ficha assinada não muda mais, e isso se guarda no banco

Gatilho que recusa `UPDATE` e `DELETE` em ficha com assinatura. Não é checagem de
tela: a tela não é o único caminho de escrita, e esta central já aprendeu que
invariante que importa se guarda no banco (mesmo raciocínio da migration 029).

**E existe uma função de conferência.** `conferir_corrente(veiculo_id)` percorre
a corrente daquele carro, recalcula cada impressão digital e devolve a primeira
que não fecha. Sem ela o encadeamento é enfeite: garantia que ninguém verifica não
é garantia. A aba Gestão ganha um botão que roda isso e mostra o resultado em
português.

### D22 — Quem não tem login não pode assinar, e a tela diz isso

A ficha continua podendo ser **preenchida** sem assinatura — o registro operacional
não pode parar porque o RH não criou uma conta. Mas ela nasce **não assinada**, e:

- o cartão mostra, ao fim, *"Esta ficha vai ficar sem assinatura: você não tem
  login próprio no aplicativo. Avise quem administra."*;
- o quadro de cobrança da Gestão distingue **feito e assinado** de **feito sem
  assinatura**;
- o PDF sai com a linha da assinatura em branco e o motivo escrito.

Ficha sem assinatura parecendo assinada seria a mentira mais cara desta fase.

### D23 — O PDF vai pro Zoho por FILA, nunca junto da assinatura

O PDF sai com o conteúdo congelado, os dois nomes, a hora do servidor, o tempo de
preenchimento, e os dois códigos (o dele e o da ficha anterior). Vai para o
WorkDrive, em pasta por carro e por mês.

**A assinatura não espera o Zoho.** Assina, grava, e o envio entra numa fila com
nova tentativa. Se o Zoho estiver fora, a ficha está assinada e válida — o PDF
chega depois.

Isso não é zelo abstrato: **o padrão "duas gravações e só a primeira conferida"
apareceu quatro vezes na F6**, sempre com a tela dizendo que deu certo. Aqui ele
seria pior, porque a segunda gravação é numa empresa de fora.

**Trabalho novo de verdade:** a integração Zoho de hoje **só lê** (lista pastas do
WorkDrive, em `acessos-proxy`). Não existe escrita. Precisa de escopo de escrita
na conta Zoho.

**Volume:** 7 carros × ~22 dias úteis = **~150 PDFs por mês**. O dono escolheu um
por ficha, ciente da conta. Se a pasta ficar impraticável, juntar por mês é
mudança pequena e depois.

## Modelo de dados

Migration `032_frota_checklist_assinatura.sql`.

```
frota_checklist
  + aberta_em      timestamptz   -- quando o cartão foi aberto (D20)
  + assinada_em    timestamptz   -- nulo = não assinada
  + assinada_por   uuid → auth.users
  + assinatura_hash          text
  + assinatura_hash_anterior text
  + sem_assinatura_motivo    text  -- 'sem_login' quando for o caso (D22)

frota_checklist_pdf            -- a fila do Zoho (D23)
  id · checklist_id · situacao ('na_fila'|'enviado'|'falhou')
  tentativas int · ultimo_erro text · zoho_file_id text
  criado_em · enviado_em
```

Gatilho de imutabilidade e `conferir_corrente(veiculo_id)` na mesma migration.

## Componentes

Lógica pura com teste ao lado, no `_shared` (o robô da fila é Edge):

**`supabase/functions/_shared/assinatura.js`**
- `textoParaAssinar(ficha, respostas, hashAnterior)` → a string canônica exata
- `impressaoDigital(texto)` → SHA-256 (Web Crypto, existe no navegador e no Deno)
- `conferirCorrente(fichas, respostasPorFicha)` → `{ ok, primeiraQuebra }`
- `tempoDePreenchimento(abertaEm, assinadaEm)` → `{ segundos, rapidoDemais }`

**Tela** — o cartão ganha o passo de assinar ao fim; a Gestão ganha o selo de
assinada e o botão de conferir a corrente.

**Robô** — `enviar-pdf-checklist`, cron de poucos em poucos minutos, drena a fila.

## Fases

**F7a** — a assinatura: senha, impressão digital, corrente, gatilho, função de
conferência, e o aviso de D22. **Entrega valor sozinha e não depende do Zoho.**

**F7b** — o PDF e a fila do Zoho, com o escopo de escrita.

## Fora de escopo

- **Rabisco desenhado com o dedo.** Prova menos que a senha (qualquer um desenha
  o nome de qualquer um) e ocupa a tela. Se o dono quiser o *ritual*, é conversa
  de outro dia.
- **gov.br** e **carimbo do tempo ICP-Brasil** — avaliados acima; o segundo é o
  caminho se um terceiro independente virar necessidade.
- **Assinatura do termo de patrimônio** e **da requisição de veículo**. Foram
  perguntados junto, e ficam para depois: o termo tem valor jurídico maior e
  merece desenho próprio (349 bens, e `acessos_termos` está com **zero** linhas
  hoje — ninguém nunca completou o caminho de imprimir, assinar e subir).
