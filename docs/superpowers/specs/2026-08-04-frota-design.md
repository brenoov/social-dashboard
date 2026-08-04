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

### D1 — Veículo de frota É bem do Patrimônio (REVISTA pelo dono)

**A primeira versão desta decisão dizia o contrário**, e o raciocínio era: os carros têm
contrato de locação (CTR-001 a CTR-010) e mensalidade, então lançá-los como bens inflaria
o patrimônio com coisa que a empresa não possui.

O dono corrigiu: *"os carros são patrimônio"*. E faz sentido dentro do grupo — o código
patrimonial RBB-XXX e o "Contrato Mestre de Locação de Frota" moram na pasta da RB
Builders, ou seja, quem aluga é uma empresa do próprio grupo. O aluguel é transferência
interna, não saída de patrimônio.

Os 9 viraram bens, na empresa **RB Builders**, categoria Veículos, valor pela **FIPE de
03/2026**. `frota_veiculos.bem_id` liga os dois: quem abre a ficha na Frota vê o carro, e
quem abre o Patrimônio vê o bem, sem contar duas vezes.

Consequência no número que o dono já tinha validado: **341 bens / R$ 1.294.235,13 →
349 bens / R$ 2.370.619,13**.

Três cuidados na passagem:

- O **Fiat Punto já existia** no Patrimônio (na RBV Company, por R$ 33.000). Foi **ligado**,
  não duplicado — duplicar contaria o mesmo carro duas vezes. O valor dele ficou como
  estava; a FIPE diz R$ 27.714, e trocar ou não é decisão do dono.
- Entram como **não etiquetados**, sem número de etiqueta (observação do dono: nem todos
  têm a etiqueta colada). Aparecem na lista de quem falta etiquetar, e o número sai da
  faixa disponível quando alguém for colar.
- O `codigo_patrimonial` (RBB-XXX) continua no campo próprio da Frota: é a numeração de
  quem aluga, não a etiqueta física de 1 a 400 do Patrimônio.

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

### D8 — Duas áreas dentro da Frota: Motorista e Gestão

Decisão do dono. Quem dirige e quem administra querem coisas diferentes, e hoje a tela
entrega as duas misturadas.

**Motorista** — o que a pessoa que dirige precisa, e só isso: o carro que está **com ela
agora** (para devolver) e os que estão **livres** (para pegar). Não mostra FIPE, aluguel,
contrato, chassi nem Renavam. Não é segredo — é ruído: o motorista está de pé no
estacionamento resolvendo uma coisa, e cada dado a mais na tela é um obstáculo.

Todo mundo com acesso à Frota vê esta área.

**Gestão** — a frota inteira: valor, contrato, situação, cadastro, manutenção e custo.
Aparece para quem tem permissão de criar ou excluir (`frota` com essas ações). Quem só
tem `ver` e `editar` — o motorista — nem vê a aba.

A separação é de **atenção**, não de sigilo. Um motorista que precise do Renavam para uma
ocorrência continua podendo pedir a quem administra; o que a área Motorista faz é não
empurrar isso na cara de quem só quer pegar o carro e sair.

## Fases

**F1 (feita, no ar)** — cadastro dos veículos importado da planilha, tela "onde está cada
carro", e registro de retirada e devolução com KM. O **Ford Fiesta Hatch ficou de fora**
(alienado, decisão do dono): entraram 9 veículos.

**F2** — as duas áreas (D8) e a requisição com aprovação: pedir → aprovar → retirar →
devolver. Aprovadores: Erick e Cristian Leonel.

**F4** — plano de revisão e alertas por KM, usando os limiares de D6. É a fase que a
planilha nunca conseguiu entregar, porque dependia de alguém digitar o KM à mão.

**F5** — custo: abastecimento, manutenção e aluguel, com custo por quilômetro rodado.

**F3 (por último, decisão do dono)** — multas: importar as 26, com situação `a_revisar`,
e a descoberta automática do condutor pelo cruzamento com os registros de uso. Fica no
fim apesar de ser onde está o dinheiro (R$ 1.301,60 já perdidos por não identificação)
porque ela **precisa de histórico de uso acumulado** para responder qualquer coisa — e
esse histórico só começa a existir agora, com a F1 no ar.
