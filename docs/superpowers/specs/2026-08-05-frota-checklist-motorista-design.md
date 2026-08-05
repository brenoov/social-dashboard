# Frota — Checklist do motorista e carro fixo

Complemento do desenho de 2026-08-04 (`2026-08-04-frota-design.md`), que continua
valendo. Este documento cobre a aba **Motorista**: quem tem carro permanente, o
checklist de primeiro escalão, e o hodômetro que faltava.

## De onde veio

**A medição que motivou.** Em 2026-08-05, com a F1 no ar e **7 pessoas já com a
permissão `frota` liberada**, a tabela `frota_uso` tinha **zero linhas**. Nenhuma
retirada, nenhuma devolução. Isso derrubava as duas fases que estavam na fila,
pelo mesmo motivo:

| Fase | Por que não respondia nada |
|---|---|
| **F5** — custo por quilômetro rodado | Km rodado sai da diferença entre km de saída e de volta. Com zero usos, o denominador é zero. |
| **F3** — condutor descoberto pelo cruzamento | O cruzamento é com `frota_uso`. Sem linha, não há com o que cruzar. |

O diagnóstico: **a viagem é a unidade de medida errada para quem tem carro fixo.**
Quem dirige o mesmo carro todo dia não "retira" e não "devolve" nada — e por isso
não registra. A fase inteira estava esperando um gesto que ninguém tinha motivo
para fazer.

**A fonte do checklist.** PDF `checklist_manutencao_primeiro_escalao.pdf`: 21
itens de inspeção, campo de **hodômetro**, resultado em três estados (liberado /
com ressalvas / não liberado), e a orientação de que item NÃO OK deve ser
registrado e comunicado ao responsável antes da utilização.

## Decisões

### D9 — Carro fixo tem dono, e a posse é uma linha do tempo sem buraco

**Correção sobre a primeira versão deste documento.** Ela mandava criar um campo
novo, `motorista_id`. Está errado: **`frota_veiculos.pessoa_id` já é o dono
fixo.** O código trata assim desde a correção do dono registrada em
`estado-do-veiculo.js:67-72` — *"os carros que têm nome atrelado não estão
livres; o Volvo do Humberto é o carro do Humberto"* — e o banco confirma: **7 dos
9 carros já têm dono cadastrado** (Erick, Barbara, Marcus, Thiago, Raissa,
Humberto, Breno). Os dois sem dono são o Doblo (em Conchal) e o Honda Fit (no
Barracão) — exatamente os de rodízio, que ficam num lugar em vez de com alguém.

Criar `motorista_id` daria **duas respostas para "de quem é este carro"**, que é
a mesma classe de defeito já catalogada na central (dois campos de permissão
dessincronizados). Nenhuma coluna nova de pessoa. Quem está com o carro **agora**
já vem do uso aberto (`usoAbertoPessoaId`), que também já existe.

`frota_uso` deixa de guardar só **viagem** e passa a guardar **posse**: uma linha
aberta (`volta_em` nulo, `km_saida` nulo) dizendo "este carro está com esta
pessoa desde esta data".

Para as duas não se confundirem, `frota_uso` ganha **`tipo`** (`'viagem'` ou
`'posse'`). Sem isso a posse aberta do dono fixo faria o carro aparecer
eternamente "na rua", porque `estadoDoVeiculo` chama de na-rua qualquer uso
aberto. Com o campo: **na rua** é viagem aberta; **posse** é a linha do tempo que
a multa consulta.

**A posse começa hoje, não no passado.** No dia em que a fase subir, cada carro
com dono ganha uma linha de posse aberta com a data de hoje. Ninguém sabe desde
quando cada carro está com cada pessoa, e inventar essa data encheria a linha do
tempo de resposta falsa — que é pior do que "não sei", porque a multa passaria a
acusar alguém com um dado inventado.

- Carro fixo entregue a alguém → abre uma linha, sem fim.
- A pessoa empresta → **fecha** a linha dela naquele instante e **abre** uma para
  quem pegou.
- Devolveu → fecha a do emprestado, reabre a do dono fixo.

O resultado é uma linha do tempo contínua: para qualquer data e hora, o sistema
responde quem estava com o carro. É exatamente a pergunta que a multa faz, e é
o que vai destravar a F3 — os R$ 1.301,60 já perdidos foram por não ter essa
resposta.

**O rodízio não muda:** pede, aprova, pega, devolve, como está hoje.

**O que se perde, conscientemente:** quem tem carro fixo não registra mais
`destino` nem `finalidade` por saída. Decisão do dono. O dado hoje não existe de
qualquer forma — ninguém registra viagem nenhuma.

### D10 — A repartição dos itens é do gestor, não do código

Os 21 itens moram numa tabela com a cadência ao lado, editável na aba Gestão,
pelo mesmo desenho do plano de revisão (D6). O gestor renomeia, desativa e move
item de diário para semanal sem tocar em código.

Sobe preenchida com esta proposta:

| Cadência | Itens | Critério |
|---|---|---|
| **Diário** (seg a sex) | Painel — luzes de advertência · Vazamentos sob o veículo · Estado geral dos pneus · Limpeza e condições gerais | **4 itens + o hodômetro.** O que a pessoa percebe sem esforço, dando a volta no carro: o painel avisa sozinho, a mancha está no chão, o pneu murcho se vê andando. ~30 segundos. |
| **Semanal** | Faróis · Lanternas · Luzes de freio · Setas · Buzina · Limpadores e lavador · Retrovisores · Freio de estacionamento · Cintos de segurança · Calibragem dos pneus · Nível da água do limpador | 11 itens. Precisa ligar e testar. ~5 minutos. |
| **Mensal** | Nível do óleo do motor · Líquido de arrefecimento · Fluido de freio · Condição do estepe · Macaco, chave de roda e triângulo · Extintor, quando aplicável | 6 itens. Precisa abrir capô e porta-malas. ~10 minutos. |

**O diário tem que ser curto o suficiente para ser feito de verdade.** Pedir 21
itens toda manhã produz, em duas semanas, alguém marcando tudo OK sem olhar — e
um checklist que mente é pior do que checklist nenhum.

### D11 — Nenhum dia pesado: semanal e mensal têm dia próprio

Decisão do dono. O semanal **não** cai empilhado no diário de segunda: ele tem
dia próprio, por padrão **sexta-feira**. O mensal cai na **primeira quarta-feira
do mês**. Os dois nunca colidem (primeira quarta nunca é sexta), e os dois dias
são configuráveis junto com a lista.

**Atrasado não acumula.** Semanal não feito na sexta fica pendente, marcado como
atrasado, e é feito no próximo dia em que a pessoa abrir. Uma semana pulada não
vira duas conferências na semana seguinte — vira uma, a que faltou.

### D12 — A ficha é do CARRO, não da pessoa

Um carro, um dia, uma ficha (`unique (veiculo_id, feita_em)`). Se duas pessoas
dirigem o mesmo carro hoje, quem chegou primeiro conferiu. Inspecionar o mesmo
pneu duas vezes no mesmo dia não descobre nada, e pedir isso é o caminho mais
curto para a pessoa parar de olhar.

**Carro sem dono fixo (`pessoa_id` nulo) não é cobrado por dia.** Ele não tem
de quem cobrar: a ficha dele acontece quando alguém do rodízio clica em "Vou
usar" e o carro ainda não tem ficha do dia. O quadro de cobrança (D16) só lista
carros com dono fixo — senão passaria a acusar todo dia carro que ninguém usou.

### D13 — A ficha congela o texto do item

`frota_checklist_respostas` guarda `item_texto` e `cadencia` **copiados** no
momento do preenchimento, além da referência ao item.

Ficha preenchida é documento. Se o gestor renomear um item daqui a três meses, a
ficha de hoje tem de continuar dizendo o que foi realmente perguntado hoje —
senão o registro passa a mentir sobre o passado toda vez que a lista muda.

### D14 — Item não OK registra, e nunca trava carro

Decisão do dono. O NÃO OK grava a pendência com a observação e aparece na aba
Gestão. **O carro continua liberado.** Ninguém fica a pé por causa do app; o
responsável resolve fora dele.

A pessoa ainda escolhe o resultado da ficha (liberado / com ressalvas / não
liberado), porque é o que o papel pede e é a palavra dela sobre o que viu — mas
o sistema não age em cima dessa escolha.

### D15 — O hodômetro não anda para trás

O hodômetro é o item mais valioso da ficha, e nem é item de inspeção: é o número
que hoje não existe em carro nenhum. Entrando de segunda a sexta, ele faz a
quilometragem existir sozinha — e destrava os alertas de revisão por km (hoje
mudos) e o custo por quilômetro (a F5, que ficou sem denominador).

**A trava vem de um defeito real.** A planilha trazia o Fiat Doblo com hodômetro
atual 136.172 contra troca de óleo em 272.257. A importação recusou o dado de
propósito (`coletor/importar-frota-manutencao.mjs`, linha 16), e é por isso que o
Doblo é o único carro sem nenhuma revisão no banco.

Se o número digitado for menor que o último conhecido, a tela **não aceita
calada**: mostra o último registro, e exige que a pessoa corrija ou confirme com
uma justificativa escrita (`hodometro_justificativa`).

O km do veículo passa a ser o **mais recente** entre a última devolução em
`frota_uso` e o último hodômetro de ficha.

**O hodômetro é obrigatório em toda ficha.** É o único campo sem "não se aplica":
sem ele a ficha vira papel digitalizado, que é o que já não funcionava.

### D16 — O lembrete sobe desligado, e a cobrança é o que salva

Tipo novo em `TIPOS_DE_NOTIFICACAO` (`_shared/notificacoes.js`): chave `frota`,
rótulo "Checklist do carro", **`padrao: false`** — regra da casa, chave nova sobe
concedida a ninguém.

Robô de manhã, segunda a sexta, avisando **só quem tem carro fixo e ainda não fez
a ficha do dia**: *"Checklist do Honda Fit — 4 itens e o hodômetro, 30 segundos"*.

⚠️ **Consequência que precisa estar dita:** enquanto o dono não ligar o aviso para
os motoristas em Administração › Usuários, ninguém recebe nada.

Por isso a **cobrança** não é enfeite: quadro "Checklist de hoje" na aba Gestão,
carros de um lado, quem fez e quem não fez do outro. É o que faz descobrir que
alguém parou de preencher **no dia em que parou**, e não três semanas depois
quando faltar quilômetro. Sem ele, esta fase repete exatamente o que a `frota_uso`
é hoje: tela pronta que ninguém abre.

## Modelo de dados

Migration `028_frota_checklist.sql`, seguindo o padrão das 022–027.

```
frota_veiculos                 -- SEM coluna nova: pessoa_id já é o dono (D9)

frota_uso
  + tipo text 'viagem'|'posse' default 'viagem'   -- D9

frota_checklist_itens          -- a lista do gestor (D10)
  id · ordem · item · cadencia ('diario'|'semanal'|'mensal') · ativo · observacao

frota_checklist_config         -- linha única (D11)
  dia_semanal int (1=seg … 5=sex, padrão 5)
  semana_mensal int (padrão 1) · dia_mensal int (1=seg … 5=sex, padrão 3=qua)

frota_checklist                -- a ficha preenchida
  id · veiculo_id · pessoa_id · pessoa_nome · feita_em date
  cadencias text[]             -- {'diario'} ou {'diario','semanal'}
  hodometro int · hodometro_justificativa text
  resultado ('liberado'|'com_ressalvas'|'nao_liberado') · anomalias text
  criada_em · criada_por
  unique (veiculo_id, feita_em)                              -- D12

frota_checklist_respostas
  id · checklist_id · item_id
  item_texto text · cadencia text   -- congelados (D13)
  estado ('ok'|'nao_ok'|'na') · observacao
```

RLS pelo mesmo desenho das tabelas 022–027: leitura para quem tem `frota`,
escrita conforme a ação, com `is_frota_admin()` para a lista e a configuração.

## Componentes

Lógica pura em arquivo próprio com teste ao lado, como os quatro que a Frota já
tem (`areas-da-frota`, `estado-do-veiculo`, `revisoes`, `requisicoes`):

**`src/ferramentas/frota/checklist.js`**
- `cadenciasDoDia(hoje, config, ultimaSemanal, ultimaMensal)` → quais cadências
  a ficha de hoje pede, incluindo as atrasadas (D11)
- `itensDaFicha(itens, cadencias)` → itens ativos, na ordem
- `hodometroAceito(novo, ultimoConhecido)` → `{ ok, motivo }` (D15)
- `quemFaltaHoje(veiculos, fichasDeHoje)` → o quadro de cobrança (D16)

**`src/ferramentas/frota/posse.js`**
- `passarPara(usos, veiculoId, pessoa, quando)` → as duas linhas (fecha uma,
  abre outra) (D9)
- `quemEstavaCom(usos, veiculoId, quando)` → a resposta que a multa precisa

**Tela** — `tela-de-frota.vue`, aba Motorista: cartão do checklist no topo. No
rodízio, o checklist entra dentro do "Vou usar" quando o carro ainda não tem
ficha do dia. Aba Gestão: a lista editável, a configuração dos dias, e o quadro
de cobrança.

**Robô** — `supabase/functions/enviar-push-frota/`, cron seg a sex de manhã,
reaproveitando `inscricoesDoTipo()` e `push_subs`.

## Fases

**F6a** — a lista editável, a ficha do dia na aba Motorista (para o carro fixo) e
dentro do "Vou usar" (para o rodízio), e o hodômetro alimentando o km do veículo.
É o que entrega valor sozinho, e não precisa de coluna nova de pessoa.

**F6b** — a posse contínua: passar o carro, e a linha do tempo de quem estava com
ele. É o que destrava a F3 (multas).

**F6c** — o push e o quadro de cobrança.

## Fora de escopo

- **Assinatura das duas partes** que o papel pede: quem preenche está logado, e o
  login é a assinatura. Assinatura desenhada na tela não acrescenta prova.
- **Exportar a ficha em PDF.** Só se for pedido.
- **Foto do item não OK.** Tentador e não pedido; fica para depois.
- **Setor do motorista**, campo do papel: o cadastro da pessoa já tem.
