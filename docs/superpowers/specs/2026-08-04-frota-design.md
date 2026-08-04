# Frota — desenho

Submódulo da Gestão Interna, ao lado de Colaboradores e Acessos e de Patrimônio.

## De onde veio cada número

Tudo aqui saiu de dois documentos reais, não de suposição:

- `Controle_Frota_.xlsx` (Zoho WorkDrive, "01. Gestão de Serviços") — 9 abas: Manual,
  Requisição de Uso, Resumo Geral, Registro de Uso, Registros, Resumo Manutenção,
  Alertas, Carros, Multas.
- `Controle_Frota.pdf` — uma requisição preenchida, que é o processo de hoje.

O que a leitura revelou:

| | |
|---|---|
| Frota | 10 veículos: 7 ativos, 2 em manutenção (os blindados), 1 alienado |
| Valor FIPE (03/2026) | R$ 1.119.750 — ativos R$ 385.997 |
| Aluguel | R$ 40.000/mês — ativos R$ 18.500/mês |
| Multas | 26 registros, R$ 4.653,76 |

**O número que decide a ordem do trabalho:** cinco multas são de *"multa por não
identificação do condutor infrator, imposta à pessoa jurídica"* — **R$ 1.301,60**, 28% de
tudo que foi pago em multa. É dinheiro perdido puramente por não saber quem estava
dirigindo. Outras nove multas seguem com o condutor em branco.

Três sintomas de que a planilha não se sustenta:

1. **A aba "Alertas" está vazia.** As fórmulas existem, mas dependem de alguém digitar
   "KM Atual" à mão. Ninguém digita.
2. **"KM Inicial" está em branco em quase todo registro de uso.** O campo existe, o
   processo pede, e não é preenchido.
3. **"Onde está" mistura pessoa e lugar** na mesma coluna: Raissa, Breno, Humberto,
   Barbara ao lado de Conchal e Barracão.

## Decisões

### D1 — Veículo de frota NÃO nasce como bem do Patrimônio

Os 10 carros são **alugados**: cada um tem contrato vinculado (CTR-001 a CTR-010, do
"Contrato Mestre de Locação de Frota") e valor de aluguel mensal. Lançá-los como bens
inflaria o patrimônio em R$ 1,1 milhão de coisa que a empresa não possui — e o dono
acabou de validar o total de R$ 1.294.235,13.

`frota_veiculos` tem uma ligação **opcional** com `patrimonio_bens`. Carro próprio, se
houver, aponta para o bem; carro alugado não aponta. O código patrimonial da planilha
(RBB-001 a RBB-010) é guardado como texto, porque é a numeração de quem aluga, não a
etiqueta física de 1 a 400 do Patrimônio.

### D2 — Onde está: pessoa e local são campos SEPARADOS

Decisão do dono. Um carro pode estar **com alguém** (Raissa) ou **em algum lugar**
(Barracão, Conchal) — às vezes os dois. A tela mostra a pessoa quando há pessoa, e o
local quando está parado. Uma coluna só, como na planilha, força escolher entre as duas
informações e perde a outra.

### D3 — O ciclo de uso é o coração, e o KM não é digitado à mão

Pedir → aprovar → retirar (KM + hora) → devolver (KM + hora). É o PDF de hoje, com uma
diferença: **o KM atual do veículo passa a ser derivado da última devolução**, nunca um
campo que alguém precisa lembrar de atualizar. É por isso que a aba Alertas está vazia
hoje, e é o que faz o alerta de manutenção funcionar amanhã.

Aprovadores: **Erick Martins e Cristian Leonel** (decisão do dono — o PDF traz Guilherme
Gertrudes Cardoso, que é o aprovador antigo).

### D4 — O condutor da multa é DESCOBERTO, não digitado

Chegou multa: o app cruza data e hora da infração com os registros de uso e diz quem
estava com o carro naquele momento. É o que mata as multas por não identificação.

Enquanto não houver histórico suficiente, o campo fica em branco e a tela diz por quê —
nunca chuta.

### D5 — Multa nasce "a revisar"

Decisão do dono. Multa importada ou lançada entra com situação `a_revisar` e **não conta
em nenhum total** até alguém validar. Multa é acusação: pode ser de outro condutor, pode
ser do dono anterior (a planilha tem seis assim), pode ser indevida. Tratar como verdade
no instante em que chega é errar contra a pessoa.

Situações: `a_revisar` → `validada` | `contestada` | `indevida`.

### D6 — Plano de revisão por KM, editável

Limiares informados pelo dono, em quilômetros rodados desde a última troca:

| Item | KM |
|---|---|
| Troca de óleo | 7.000 |
| Limpeza de bico | 40.000 |
| Pneus | 40.000 |
| Velas | 50.000 |
| Líquido de arrefecimento | 50.000 |
| Correia dentada | 60.000 |
| Óleo de câmbio | 60.000 |
| Bobina e cabo de vela | 80.000 |

Dois conflitos com a planilha, resolvidos a favor do dono: ela usa **10.000 km** para o
óleo (ele disse 7.000) e **10.000 km** para a água do radiador, que é o mesmo líquido de
arrefecimento que ele põe em 50.000. Pneus não estava na lista dele; fica em 40.000, como
na planilha.

Os limiares moram numa tabela, não no código: o dono muda quando o mecânico mandar.

### D7 — Permissão própria, nascendo desmarcada

Chave `frota`, como toda ferramenta nova nesta central: sobe sem acesso para ninguém, e o
dono libera. A Gestão Interna é quem carrega essas permissões.

## Fases

**F1 (esta)** — cadastro dos veículos importado da planilha, tela "onde está cada carro",
e registro de retirada e devolução com KM. Sem isso, multa e manutenção não têm de onde
tirar resposta.

O **Ford Fiesta Hatch fica fora** (alienado, decisão do dono): entram 9 veículos.

**F2** — requisição e aprovação (o PDF digitalizado).

**F3** — multas: importar as 26, situação "a revisar", e a descoberta automática do
condutor pelo cruzamento com os registros de uso.

**F4** — plano de revisão e alertas por KM.

**F5** — custo: abastecimento, manutenção e aluguel, com custo por quilômetro rodado.
