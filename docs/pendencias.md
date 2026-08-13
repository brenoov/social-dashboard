# Pendências do iamundi

Última revisão: **13/08/2026**

O que é este arquivo: a lista viva do que está **em aberto** no projeto. Cada item
diz o que falta, **por que importa** e **onde** se resolve. É a memória escrita —
se não estiver aqui, some.

Como ler:
- **Parte A — Só o dono resolve.** É clique em painel/tela. Não tem código pra fazer.
- **Parte B — Precisa programar.** Alguém tem que mexer no código.
- **Parte C — Ideias guardadas.** Ninguém pediu ainda; está aqui pra não esquecer.

Cada item tem um código fixo (A1, B3...) pra dar pra citar em conversa.

---

## Parte A — Só o dono resolve (clique, sem código)

### A1 · Frota › ligar o aviso do "Checklist do carro" ⚠️ *o que trava mais coisa*
Em **Administração › Usuários**. O aviso nasce desligado: o robô roda todo dia às
7h30, não manda nada e ninguém sabe que não mandou.

**A prova de que ninguém usa** (medido em 11/08): a ferramenta está no ar desde
06/08 e existem **2 checklists gravados no total**, 1 assinado, o mais recente de
**07/08**. Ou seja: fizeram o teste e parou. Sem o aviso, ninguém lembra.

E é isso que segura o **B10** — sem checklist diário não nasce o registro de quem
estava com o carro, que é o que faltava pras multas e pro custo por km.

### A2 · Frota › 3 donos de carro não têm login
Medido em 11/08.

| Dono | Carro | Situação |
|---|---|---|
| Barbara Franco | Honda Fit | Sem login. Domínio é `@vesselbrasil.com.br`, diferente dos outros. |
| Marcus Vinicius | Fiat Punto | Sem login (tem telefone → WhatsApp alcança) |
| Thiago Siqueira | Ford Fiesta Sedan | Sem login (tem telefone → WhatsApp alcança) |

Sem login, push nenhum chega. Pra eles o quadro da aba **Gestão** é o único canal
— e por isso quem administra a Frota pode preencher o checklist por qualquer carro.

**Agora tem botão pra isto (subiu em 12/08).** No card do checklist de cada carro,
quem administra a Frota vê **"Dar acesso a &lt;nome&gt;"**. Ele cria o login, sorteia
uma senha inicial (sem letras que se confundem — nada de O/0 nem l/1), obriga a
trocar no primeiro acesso, e mostra um recado pronto pra mandar no WhatsApp. Só
aparece se a pessoa tiver e-mail na ficha: **a Barbara tem** (`@vesselbrasil.com.br`),
o **Marcus** e o **Thiago** precisam do e-mail preenchido antes.

⚠️ **O que eu não consegui provar:** o caminho de ponta a ponta — clicar, a pessoa
entrar, ser obrigada a trocar a senha e chegar no checklist. Provar isso exigiria
criar um login de verdade e mexer numa conta real, e a regra aqui é não mexer.
Então o primeiro convite é também o teste. **Se algo falhar, é neste item.**

> ✅ **A Raissa saiu desta lista em 11/08.** Ela tem login, mas a ficha estava sem
> o elo `profile_id` — e o robô do aviso exigia justamente esse elo, enquanto a
> tela a reconhecia pelo e-mail. Duas respostas pra mesma pergunta. Corrigido no
> código (`_shared/quem-loga.js`, commit `a0178b6`): agora as duas pontas usam a
> mesma regra, com o e-mail como resgate. Ligar o elo na ficha dela continua sendo
> boa arrumação, mas **não é mais requisito** pra ela receber o aviso.

### A2b · Frota › 2 carros sem dono nenhum
`OLW4I46` Fiat Bravo Essence e `QQT9B68` Fiat Doblo. Sem dono fixo não há de quem
cobrar o checklist — esses dois nunca entram no quadro de cobrança nem no aviso.

### A2c · Frota › o valor do seguro está vazio nos 10 carros
Medido em 12/08. **Nenhum** dos 10 tem valor de seguro. O `DCH1J89` BMW X1 também
está sem aluguel e sem FIPE — é o único; os outros 9 têm os dois.

Enquanto o seguro estiver vazio, qualquer conta de custo do carro sai por baixo:
falta uma das três parcelas fixas (aluguel, FIPE, seguro).

> ✅ **Susto que não era susto, conferido em 12/08.** Havia um defeito de leitura de
> dinheiro na ficha: ele jogava fora todo ponto, tratando como separador de milhar.
> Fui conferir os 10 carros esperando encontrar valores 100× maiores — **não tem
> nenhum errado.** O motivo: quem preenche digita no jeito brasileiro
> (`157.995,00`), e aí o ponto **é** milhar mesmo, então jogar fora estava certo por
> acidente. O defeito só morderia quem digitasse no jeito americano (`157995.00`).
> Já está corrigido de todo jeito. Nada a arrumar no banco.

### A3 · Frota › apontar Empresa e Local 🟢 *começou — 7 de 10 feitos*
Medido em 11/08: **7 dos 10 já têm empresa** (todos "RB Builders") e **6 têm
local**. Faltam:

| Placa | Carro | Falta |
|---|---|---|
| BDN3A67 | Volvo XC60 | empresa **e** local |
| FEF0C13 | Volvo XC90 | empresa **e** local |
| FQW7G77 | Porsche Cayenne PHEV | empresa **e** local |
| FFK9E60 | Fiat Bravo Blackmotion | só o local |

São justamente os três de maior valor que faltam — e dois deles (XC90 e Cayenne)
são os blindados que estão na oficina.

Preencher **na ficha, na mão** — decisão do dono: nada de migration mexendo em dado.

> ⚠️ **Cuidado com a palavra "Marca".** Na Frota, `marca` é o **fabricante**
> (VOLVO, BMW, FIAT) e **está preenchida nos 10**. A empresa do grupo (Vessel,
> RB Builders, RBV Company) é outro campo, e é esse que está vazio. Isso já
> confundiu uma vez.

### A3b · ~~Duas definições de super-admin que não batem~~ ❌ **ERRO MEU, retirado em 12/08**
Este item **nunca existiu**. Eu o escrevi ontem baseado na leitura de um arquivo de
migration, e não conferi a função que está rodando.

Medido no banco em 12/08: a função `public.is_superadmin()` tem **três** e-mails —
`erick@`, `gabriel.gertrudes@` e **`breno@`** — e a coluna `profiles.is_superadmin`
tem exatamente os mesmos três. **Batem.** Alguém acrescentou o `breno@` depois do
arquivo `013_superadmin_gabriel.sql`, e o arquivo nunca foi atualizado.

Consequência: **os botões de perfil funcionam para as três contas.** Não há parede.

**A lição, que é a mesma que este projeto já aprendeu com Edge Function:** arquivo de
migration **não** diz o que está rodando no banco; só o banco diz. `git log` e o
conteúdo de `db/migrations/` são histórico do que se tentou, não retrato do que é.

O que sobra de real, e é bem menor: **quem é super-admin mora em dois lugares** (a
coluna e a lista dentro da função), e mantê-los iguais é trabalho manual. Hoje estão
iguais. Se um dia divergirem, o sintoma será o botão aparecer e o banco recusar — com
a mensagem honesta que a F2 passou a mostrar. Unificar (a função ler a coluna) é
possível e seguro — o gatilho `impedir_autopromocao` já protege a coluna e usa a
própria função, então só quem já é super-admin cria outro. **Não foi feito: é
endurecimento, não conserto, e mexe em segurança sem nada quebrado hoje.**

### A3c · Perfis de Acesso › o teste da primeira vez ⚠️ *antes do primeiro perfil de verdade*
A ferramenta está no ar e **nunca foi usada**. Antes de criar um perfil com gente dentro,
vale rodar o roteiro — ele prova que a trava funciona:

1. Criar uma conta **descartável** (não use conta de quem trabalha aí).
2. Criar um perfil de teste e pôr essa conta dentro.
3. Mexer no perfil e **conferir que a janela nomeia a conta** e diz o que ela ganha ou perde.
4. **Clicar em Cancelar** e conferir no banco que **nada mudou**. É este passo que prova a trava.
5. Só então aplicar, e conferir que o acesso mudou e que a exceção sobreviveu.
6. Desfazer tudo.

Precisa ser feito por `erick@` ou `gabriel.gertrudes@` (ver A3b).

### A4 · Segurança › ligar MFA e a proteção de senha vazada 🔴 *risco nº 1*
No painel do Supabase:
- **Authentication › Password security** → ligar "Leaked password protection" +
  tamanho mínimo ≥ 10.
- **Authentication › MFA** → ligar TOTP e os admins se cadastrarem.

Por que é o risco nº 1: as três frentes grandes já foram fechadas (repo privado,
token da Meta fora do navegador, guarda de admin). O que sobra de porta aberta é
login de admin com senha fraca ou phishada.

### A5 · Segurança › rotacionar os segredos
Circularam em transcrição de sessão: **token do System User da Meta**,
**client_secret** do app da Meta e o **token do Bling**.

### A6 · Central de Conteúdo › decidir se liga os 2 crons
As duas Edge Functions estão no ar mas **dormentes** de propósito — as migrations
`06-cron-hora-h.sql` e `09-cron-espelho.sql` nunca foram aplicadas.
- `conteudo-hora-h`: **dispara push em 6 aparelhos reais.** Decisão do dono.
- `conteudo-espelho`: inofensiva (só lê a Meta). Pode ligar quando quiser.

### A7 · Meta › pedir o App Review 🟡 *"pra outra hora" (dono, 11/08)*
Falta **uma só permissão: `instagram_content_publish`.** As outras 7 que o sistema
usa já funcionam. O pacote está pronto (texto de justificativa, roteiro do vídeo,
pré-requisitos) em `docs/app-review-meta.md`.

**Não pedir `pages_manage_posts`** junto — nenhum código publica em Página do
Facebook, e permissão sem uso visível no vídeo reprova; uma reprovada derruba o
pedido inteiro.

Sem isso, a Central de Conteúdo **avisa** na hora H em vez de publicar. A
publicação já está escrita e desligada (`ESCOPOS_DE_PUBLICACAO_LIBERADOS = false`).

### A8 · Gestor de Tráfego › apontar uma campanha cobaia
O **Duplicar** e o **Editar público** estão na main desde 28/07 e **nunca rodaram
contra conta Meta real**. Confirmar duplicação cria campanha de verdade, e editar
público muda quem vê anúncio que está rodando.

Precisa o dono indicar uma campanha **pausada ou de gasto baixo** pra servir de
cobaia — escolher qual é decisão de negócio, não técnica.

### A9 · Relatórios › liberar as 2 permissões ⏸️ *adiado pelo dono (11/08)*
`patrimonio.relatorios` e `frota.relatorios`, no Config de Admin. Nasceram
desmarcadas de propósito.

Adiado porque **o dono é superadmin e já enxerga a aba**. Quando for liberar pra
mais alguém, é aqui. E se alguém disser "a aba não aparece pra mim", é isto —
antes de suspeitar de defeito.

---

## Parte B — Precisa programar

### B1 · 15 pastas ainda sem o guarda de import 🔴 *já derrubou tela 4 vezes*
Chamar uma função da pasta vizinha e **esquecer de importar não quebra o build** —
o Vite supõe que é global do navegador. O erro só nasce quando alguém clica.

Já aconteceu: Gestão de Tráfego (29/07, duas vezes no mesmo dia), Admin (05/08),
Patrimônio (10/08 — as abas Planilha e Resumo abriam **em branco**).

O guarda é um `imports.test.mjs` na pasta. **Existe em 5**: `admin`,
`gestao-trafego`, `patrimonio`, `frota` e `compartilhado/relatorios`. **As outras
~15 de `src/ferramentas/` não têm.** Copiar de
`src/ferramentas/patrimonio/imports.test.mjs`, que já trata os dois falsos
positivos conhecidos.

Regra: pasta nova nasce com o guarda; ao mexer numa sem guarda, criar **antes** e
ver o que ele acusa.

### B2 · Relatórios › nunca foram vistos na tela real
O que foi verificado: 2359 testes, build, e os 8 relatórios rodando com os
catálogos reais num staging temporário **com banco de mentira**.
**Não** foram vistos dentro do app logado, com os 350 bens e os 10 carros reais.
Subiu assim porque o dono mandou subir sabendo. Volta fácil (`git revert` ou
Instant Rollback da Vercel).

### B1c · Banco de Arquivos › a permissão não controla o que promete 🔴
Achado em 11/08/2026 lendo `src/ferramentas/banco/tela-de-banco.vue` para escrever
a explicação da permissão. **Dois furos, e o segundo é de segurança:**

1. **Enviar arquivo não confere `criar`.** `onMounted` (~L156) chama
   `setupBancoUpload()` sem checar nada além de ter acesso à ferramenta. Quem tem
   só **"Só ver"** consegue subir arquivo.
2. **Excluir é gateado por `estado.role === 'admin'`** (~L92), que é outro campo,
   não a permissão granular. Consequência: dar **"Tudo"** no Banco para alguém
   **não** dá o poder de apagar, e quem é admin apaga mesmo sem "Tudo".

Ou seja, a escada de permissões desta ferramenta não manda em nada. É por isso
que ela ficou sem frase explicativa: não dá para escrever a verdade sobre níveis
que não valem.

### B1d · `sales.metas` está concedida a 12 pessoas e não faz nada
Nenhuma tela chama `hasPermission('sales.metas', ...)`. A escrita real em
`bling_metas` acontece em `tela-de-admin.vue` (~L2239) sem consultar essa chave.
A permissão existe no catálogo, aparece no editor, 12 pessoas a têm — e ela não
governa nada.

Decidir: ou a tela de Metas passa a respeitá-la, ou a chave sai do catálogo. Hoje
ela dá a impressão de controlar um acesso que está aberto por outro caminho.

### B1e · `exportar` prometido e não implementado em 3 ferramentas
`sales.gestao`, `sales.analise` e `meta.campanha` declaram a ação `exportar` no
catálogo, e não há nenhum código de download/CSV/PDF nessas telas. O editor de
permissões oferece o degrau **"Ver e baixar"**, que na prática é igual a "Só ver".

Foram as três que ficaram sem frase explicativa na Config de Usuários, porque
qualquer frase seria mentira.

### B1f · O `bling-proxy` devolve os pedidos de todos os canais 🔴 *guardado pelo dono em 13/08*
Lido linha a linha em 12/08 e conferido de novo em 13/08: a Edge Function
`bling-proxy` (linhas 117–119) pergunta só **"essa pessoa pode?"** — se é `admin`
ou tem `sales`/`gestor` — e devolve os pedidos de **todos os canais**. Filtro por
loja não existe ali.

Por que importa: a **Gestão à Vista** e a **Análise de Vendas** leem o Bling ao
vivo por essa função. A trava do banco que protege `gc_vendas_item` **não vale
nessas duas telas**, e o recorte que está no ar é no navegador
(`src/compartilhado/canais-de-venda-permitidos.js`) — some da tela, mas quem abre
o console pede tudo.

**O cuidado que decide este item:** o `bling-proxy` não é só das duas telas. Os
robôs `gestor-comercial`, `relatorios-comerciais` e `notas-dos-pedidos` chamam a
MESMA função. Recortar sem antes descobrir com que identidade eles entram **cega
os robôs em silêncio** — eles não têm tela pra reclamar. Descobrir isso é o
primeiro passo, não o último.

Irmão do item que foi fechado em 13/08 (a trava de loja no gatilho,
`supabase/migrations/20260813_trava_de_loja_no_gatilho.sql`). Os dois foram
guardados juntos pelo dono em 13/08: "salve os itens 1 e 2 para outra hora".

### B1g · Ligar e desligar a trava de loja de alguém não fica registrado
Achado em 13/08 enquanto se investigava uma mudança: a coluna
`profiles.escopo_por_equipe` — a que decide se a pessoa vê o faturamento de todas
as lojas ou só da dela — muda **sem deixar rastro**. O `audit_log` só grava troca
de cargo (`role_change`), pelo gatilho `guard_profiles`.

Custou concreto no mesmo dia: a trava do Caio Dias foi desligada durante a
sessão, e **não há como dizer quem desligou nem a que horas**. Só deu pra
descartar que tinha sido o robô por eliminação, comparando com outra pessoa.

**E não é só ela:** mudar as **permissões** de alguém, a **conta de anúncio** que
a pessoa vê ou o **perfil de acesso** dela também não deixa rastro. De tudo que
diz respeito a acesso, só o cargo é registrado.

Conserto: o `guard_profiles` já escreve no `audit_log`; é acrescentar o mesmo
`insert` para essas colunas. Mesma classe de coisa do `role_change`, que já
existe e já provou servir. A lista de colunas já está pronta e escrita — é a
mesma do gatilho `impedir_autopromocao` depois de 13/08
(`supabase/migrations/20260813_ninguem_se_da_permissao.sql`).

### B2b · Patrimônio › 36 bens com a ficha incompleta
Medido em 11/08, dos 350 bens: **2 sem empresa** (os dois "Macbook Neo", nº 284 e
285 — também sem local e sem cômodo), **8 sem local** (os 5 REDMI 15C, o Samsung
A127M e os 2 Macbook) e **26 sem cômodo**. Categoria está em 100%.

Não é defeito da ferramenta: é ficha que nasceu sem o campo. Importa porque os
relatórios recortam por empresa e local — bem sem esses campos some do recorte e
só aparece em "Tudo".

### B3 · Frota › os caminhos de erro do checklist nunca foram vistos numa tela
Hodômetro pra trás, passar o carro pra outro, gravação falhando no meio. Têm
teste, mas ninguém abriu a tela e provocou.

### B4 · Estúdio da Fábrica › a subida multi-loja (a premissa deste item estava errada)
**Medido no banco em 12/08/2026: o laço multi-loja nunca perdeu loja.** Nas 5
subidas da história (`fabrica_jobs` tipo `subir`), as 2 que tinham 2 lojas
criaram 2 campanhas; as outras 3 já **chegavam com uma loja só**. Este item
acusava o laço `for (const {slug,publico,orcamento} of alvosLoja)` — o laço
sempre subiu exatamente o que recebeu. As duas metades do relato do dono tinham
outras causas, e as duas foram achadas olhando os jobs reais:

1. **"Subiu só do Tivoli"** — a TELA nasce com `destino.lojas = ['tivoli']` e a
   segunda loja dependia de um chip pequeno. Nada dizia, antes do clique, que ia
   sair campanha pra uma loja só. Agora o passo Subir escreve o que vai
   acontecer ("Vai criar 1 campanha nova: Tivoli. / Dom Pedro não vai receber
   campanha.") — `resumo-do-destino.js`, com teste.
2. **"Na primeira vez bugou e não subiu campanha"** — não bugou: o job
   `66a8e030` (13/07 22:49) subiu com **zero criativos escolhidos**, e a tela
   respondeu *"Publicado (pausado)! 0 anúncios"* e **fechou a rodada**. Zero
   escolhido agora vira erro que manda voltar pro Curar, sem fechar nada.

Dois defeitos latentes achados na mesma trilha, ambos consertados:
- O laço **abortava e perdia o rastro**: falha na loja 2 derrubava o job inteiro
  e o `resultado` sumia, mesmo com a campanha da loja 1 já criada de verdade na
  Meta — o Conferir e o Ativar deixavam de enxergá-la.
- **Re-disparar duplicava campanha.** Em rate limit o job vira erro com
  "re-disparar pra continuar", e **não existe botão de re-disparar**: o dono
  clica em Publicar de novo. O segundo clique criava uma segunda campanha por
  loja. Agora reaproveita a campanha que a rodada já criou (`campanhaDoRastro`,
  chave = rodada + loja). ⚠️ **A chave NUNCA pode ser o nome da campanha:**
  `CFG_ADSET.DATA_CAMPANHA` é constante congelada, então toda campanha da mesma
  loja+objetivo nasce com nome idêntico em qualquer rodada.

**O que falta:** o caminho do re-disparo **não foi provado ao vivo** — depende de
a Meta devolver rate limit de verdade. Money-path: na próxima vez que der rate
limit, conferir no Gerenciador que continuou na MESMA campanha, sem uma segunda
igual. Só depois disso o item sai daqui.

### B4b · Meta Ads › as seis melhorias subiram sem ninguém ver na tela 🔴
As seis melhorias que o dono pediu em 12/08/2026 estão **no ar e conferidas no
bundle de produção**, mas **nenhuma foi vista funcionando com sessão logada**.
Três são money-path:

1. **Pin no mapa** — salvar ponto num conjunto que está RODANDO reescreve o
   `custom_locations` na Meta. Antes de confiar, salvar num conjunto pausado e
   conferir no Gerenciador que os pontos ficaram onde deviam.
2. **Re-disparo do subir** (ver B4) — depende de rate limit real.
3. **Sugestão de público lendo a persona** — a edge `sugerir-publico-ia` v4 tem
   o bloco da persona, mas `verify_jwt` impede o teste sem sessão; quem executa
   primeiro é o dono, clicando em sugerir.

✅ **Os DOIS uploads foram executados pela tela em 13/08 e passaram.** O `.docx` é
lido no próprio navegador, sem custo. O **PDF** (edge `ler-documento`) sai para a
IA: respondeu 200 e trouxe 748 caracteres para o campo, com a acentuação
correta — e leva de 10 a 60 segundos, o que importou (ver abaixo).

> 🔴 **O PDF achou um terceiro defeito, e este custava dinheiro calado.** Subindo
> o MESMO arquivo duas vezes: com a tela parada, o texto chegava; com o Gestor
> ainda carregando, a edge respondia **200 com o texto** e o campo ficava
> **vazio, sem nenhum aviso** — e a leitura da IA já tinha sido paga.
>
> Enquanto a IA lê (dezenas de segundos), o painel se redesenha sozinho:
> `loadGtData` remonta a régua ao terminar de carregar a conta, e trocar de conta
> faz o mesmo. O redesenho **troca os elementos**, e o código escrevia o texto no
> `<textarea>` de antes — órfão, fora da tela. Provado no navegador marcando o
> campo e forçando o remonte: a marca não sobrevive e o que estava no campo some.
>
> Corrigido: depois da leitura tudo é procurado de novo pelo id, e o `<textarea>`
> passou a carregar `data-conta-id`, conferido antes de escrever — se a tela
> trocou de CONTA no meio, o texto **não** entra (seria a persona de uma marca
> dentro de outra) e a tela diz o que houve. 3 testes novos, os 3 falham sem o
> conserto. **Provado em produção** forçando o redesenho no meio da leitura: os
> 748 caracteres chegaram assim mesmo.

> 🔴 **A tela não abria — e o motivo derrubava metade deste item (13/08).** O dono
> abriu o Gestor de Tráfego e leu, no lugar da lista de contas:
> "**Erro ao carregar contas: g is not iterable**".
>
> A causa, medida no banco: `accounts` **não** dá SELECT no nível da tabela — ela
> usa **permissão por coluna**, e foi assim que se escondeu o `access_token` (o
> token da Meta) do front. A migration de 12/08 criou a coluna `persona` e não
> deu a permissão dela. Como **uma** coluna sem permissão faz o PostgREST recusar
> a linha inteira, a resposta virava um objeto de erro em vez de uma lista, e a
> tela tentava percorrer esse objeto. O "g" era o nome da variável minificada.
>
> Provado isolando a coluna: sem `persona` → HTTP 200; só `persona` → HTTP 401.
>
> **Corrigido em duas camadas** (`2026-08-13-persona-grant-de-leitura.sql`):
> a permissão de leitura de `persona` para quem está logado (`access_token`
> continua revogado), e a tela passou a olhar o status da resposta — erro de
> leitura agora vira "sua sessão expirou" / "você não tem permissão", nunca mais
> jargão. ⚠️ **Não foi visto numa tela logada** (esta máquina não tem sessão e a
> regra é não mexer em conta real): o primeiro a abrir confirma.
>
> **A lição, que vale pra próxima coluna:** em `accounts`, **coluna nova nasce sem
> permissão de leitura**. Migration que cria coluna que a tela lê tem que dar o
> GRANT no mesmo arquivo — é uma tarefa só, não duas.

> 🔴 **E tinha um segundo defeito atrás do primeiro: a aba "A régua" estava MORTA
> (13/08).** Assim que a lista de contas voltou a carregar, deu pra abrir a aba
> pela primeira vez — e ela não pintava nada. No console:
> `ReferenceError: Cannot access 'campo' before initialization`.
>
> Em `painel-regua.js`, a função `montarPainelRegua` usa o ajudante `campo(...)`
> na linha 188 pra desenhar os campos de peso; **336 linhas abaixo, dentro da
> mesma função**, a parte da persona declarava `const campo = ...`. Em
> JavaScript um `const` vale pra função **inteira, inclusive nas linhas antes
> dele** — então o uso de cima passou a apontar pro `const` de baixo, que ainda
> não existia, e o painel morria inteiro.
>
> Entrou no commit `ebf162d` (12/08), o da própria persona, e **passou porque
> `painel-regua.js` não tinha teste nenhum**. `npm test` verde, `npm run build`
> verde, o `.vue` compilando — e a aba morta. É este item, B4b, se cumprindo:
> subiu sem ninguém ver na tela.
>
> Corrigido (`campo` → `campoPersona`) e cercado por **duas** guardas novas:
> `painel-regua.test.mjs` (monta o painel; os 5 casos falhavam antes) e
> `sem-sombra-de-ajudante.test.mjs`, que varre o `src` inteiro atrás do mesmo
> padrão e traz um teste provando que a guarda enxerga o defeito original — senão
> um detector quebrado passaria por "está tudo limpo".

**Falta ainda, e é clique do dono:**
- **Persona das outras 4 contas** (Motoeasy, Mantova, Raíssa, Breno Vale). Só a
  Vessel está preenchida. Sem persona, a IA sugere idade olhando quem CLICOU.
  ⚠️ **Isto não era falta de clique — eram duas portas trancadas.** Além da
  permissão da coluna (acima), salvar usa `Prefer: return=representation`, que
  também precisa **ler** a coluna; e a aba onde se edita nem abria. A persona
  **nunca** pôde ser salva pela tela desde que foi criada — a da Vessel entrou
  direto no banco.

  ✅ **Provado ponta a ponta em 13/08, na tela real, com sessão de verdade:**
  subiu um `.docx`, o texto caiu no campo ("Trouxe 306 caracteres"), o Salvar
  respondeu **200** na linha certa e o banco guardou os 306 caracteres, 5 linhas,
  com o `&` intacto. **A conta de teste foi devolvida a vazio logo em seguida** e
  as 7 personas foram conferidas contra a impressão digital de antes — a da
  Vessel (2.326 caracteres) não foi tocada. Agora sim é só clique.
- **Os 13 problemas que a Meta aponta** (agora visíveis na Fila): 5 conjuntos da
  Raíssa pausados pela Meta por público personalizado que sumiu, 3 vídeos da
  Mantova com menos de 500px que não rodam no Instagram, 2 anúncios que a Meta
  não entrega, 1 com Página divergente e 1 sem link no cartão. O conserto é no
  Gerenciador.
- **A recusa por "políticas violadas" NÃO foi encontrada**: dos 517 anúncios,
  nenhum está `DISAPPROVED`, e as 7 contas estão ativas (`disable_reason: 0`).
  Se voltar a aparecer, anotar EM QUAL CONTA — provavelmente é Página ou Business
  Manager, não a conta de anúncios.

### B4c · Deploy › o gatilho do Git parou quando o repositório virou da organização ✅ *resolvido em 13/08*
Fica registrado porque **não aparece erro em lugar nenhum** e custou horas.

O repositório saiu de `github.com/brenoov` (conta pessoal) para
`github.com/rbv-co` (organização, criada em 11/08) às **10:13:59** de 13/08. No
mesmo minuto os deploys pararam: **nenhum push virava build**, e não havia falha,
fila nem aviso — a lista da Vercel simplesmente não ganhava linha nova.

A causa: a Vercel fala com o GitHub por um **aplicativo instalado POR CONTA**. A
instalação estava na conta pessoal e **não vai junto** na transferência. O GitHub
para de avisar e a Vercel nunca fica sabendo.

O que NÃO resolveu, e vale saber para não repetir:
- **Redeploy pelo painel**: funciona, mas reconstrói *aquele* commit — não traz
  os novos. Foi o que confundiu ("parece que voltou" com o site servindo o build
  velho).
- **Reconectar o repositório na Vercel antes** de instalar o app na organização.
  A ordem importa: primeiro o app no GitHub, depois a reconexão.
- Três commits vazios empurrados na mão. Nenhum virou build.

O que resolveu: **instalar o app da Vercel na organização `rbv-co`** (exige ser
dono da org). O primeiro push depois disso virou deploy em menos de um minuto.

Dois efeitos colaterais da mudança de dono, para quem tropeçar neles:
- O endereço antigo do repositório parou de redirecionar no push (dá
  `Internal Server Error`, que não explica nada). O certo é
  `git remote set-url origin https://github.com/rbv-co/social-dashboard.git`.
- `git push` passou a exigir uma conta com acesso à **org**. Se o `gh` estiver
  em outra conta (ele é global — outra sessão pode ter trocado), o erro é
  `Permission to rbv-co/social-dashboard.git denied to <conta>`.

### B12 · Migrations › o runner acha que 57 estão pendentes 🔴 *não rodar*
`cd coletor && node run-migrations.mjs --dry` lista **57 migrations como
pendentes**, incluindo as que obviamente já rodaram. A tabela de controle
`public.schema_migrations` tem **23 registros para 80 arquivos** — as outras
foram aplicadas na mão e nunca registradas.

**Rodar o runner replicaria 57 migrations em produção.** Muitas são
`if not exists`, mas nem todas, e nenhuma foi conferida uma a uma. Enquanto isso
não for arrumado, migration nova vai **dirigida pelo MCP** e se registra na mão
no mesmo SQL (foi assim com as duas de 12/08).

Arrumar de verdade é conferir as 57 contra o banco e registrar as que já valem.
É trabalho próprio, não coisa pra fazer de passagem.

### B5 · Fábrica Hero-IA › trocar a composição pelo relight da foto real 💰
O motor `coletor/hero-ia/hero-ia.mjs` hoje compõe `[cena de fundo, recorte da
bolsa]` — e é isso que **embanana o texto da plaquinha**.

O que funciona (validado no laboratório e aprovado pelo dono em 23/07, **não
implementado**): passar a **foto real inteira** da bolsa, sem máscara, e pedir ao
gpt-image-2 pra gerar a cena em volta preservando a bolsa e a placa. Sai legível.

Junto vem **gerar N opções por look** pra curadoria (a geração é estocástica).
⚠️ **Money-path:** gpt-image-2 é pago, e N opções × muitos SKUs multiplica o
custo. Planejar com o teto `HERO_IA_MAX` em mente.

### B6 · Robôs › o cron `fabrica-purga-diaria` está com o token em texto puro
É o único cron com o segredo escrito dentro do `cron.job.command` — exatamente o
que a tabela `segredos_de_cron` existe pra evitar. Por isso ele não foi
instrumentado junto com os outros.

### B7 · Robôs › a causa do `546 WORKER_RESOURCE_LIMIT` ainda é hipótese
A suspeita é que a função roda ~120s, varre 7 contas e baixa fotos pra memória.
Não houve perda de dado (a coleta roda 4×/dia e regrava). Agora dá pra **medir a
frequência antes de mexer** — medir primeiro.

### B8 · Status do Claude › trazer os gastos da API da OpenAI
Pedido do dono em 27/07, marcado como "pra depois". Hoje o extrato só mostra a
Anthropic. A OpenAI entra pela Fábrica (gpt-image-2 do Hero-IA) e está invisível
no painel. Ao fazer: manter a **fonte única de preço** e a linguagem literal.

### B9 · Segurança › as escritas soltas que sobraram
`bling_pedido_vendedor`, `bling_vendedores` (cache com auto-cura) e
`campaign_filters` aceitam escrita de qualquer usuário logado (`authenticated
true`). Foi deixado de propósito porque a equipe é interna — só trava de vez
proxiando pelo Edge.

### B11 · Vendas › falta só olhar o telão 🟢 *quase fechado*
As três etapas estão no ar: a data da nota é coletada de hora em hora, e o
telão, a Análise de Vendas, a notificação das 22h/07h, os Relatórios Comerciais
e o briefing do Gestor **contam todos por ela**. A regra tem uma cópia só, em
`supabase/functions/_shared/data-da-venda.js`.

✅ **A notificação foi conferida ao vivo pelo dono em 11/08.** O push disparado
à mão mostrou R$ 1.829,74 — o MESMO valor do telão para o dia — e comparou com
ontem já corrigido (−25%; pela data do pedido teria dito −19%). Era esse o risco
que a Etapa 3 existia para eliminar: push e tela discordando do mesmo dia.

**O que falta é só um olhar:** ninguém abriu o telão logado depois da mudança.
Não dá Playwright neste projeto. Se algo parecer errado, o retorno é o Instant
Rollback da Vercel. Referência do que esperar: 04/08 sai de R$ 8.071,19 para
R$ 299,70; 05/08 sai de R$ 224,95 para R$ 7.996,44.

### B10 · Frota › F3 (multas) e F5 (custo por km) seguem travadas
As duas dependem de saber **quem estava com o carro no dia**. Em 05/08 `frota_uso`
tinha zero linhas; em 11/08 tem **10** — mas são as *posses* (o dono fixo de cada
carro), não o uso do dia a dia. O que alimenta o dia a dia é o checklist, e ele
tem **2 registros** (ver A1).

Ou seja: **ligar o aviso do A1 é o que destrava estas duas.**

O que está em jogo: das 26 multas (R$ 4.653,76), **5 são "não identificação do
condutor", R$ 1.301,60** — dinheiro perdido puramente por não saber quem dirigia.

---

## Parte C — Ideias guardadas (ninguém pediu ainda)

### C1 · Gestor de Tráfego › vigia de saldo com alerta antecipado
É o item **A** da fila B→C→A combinada com o dono (B = duplicar, feito; C = criar
campanha, feito).

Existe o push de saldo das 08h, mas o vigia antecipado não. ⚠️ Lembrar do que já
foi medido: **`balance` da Meta NÃO é saldo, é a fatura em aberto.** O saldo real
só existe como texto em `funding_source_details.display_string`, e o parse devolve
**null = "não sei"** — nunca zero.

Caso real que motivou: **Vessel com R$ 0,00 de saldo gastando R$ 460/dia** (29/07).

### C2 · Gestor de Tráfego › subir campanha por upload de criativo
Ideia do dono (12/07): subir campanha no Gestor com o criativo vindo de **upload**
(1 arquivo ou em massa), não gerado como no Estúdio. Requisito-chave é
**normalizar o formato sozinho** (PNG→JPG, achatar transparência, redimensionar
pros ratios de Feed 1:1 e Story 9:16).

Reaproveitar, não reconstruir: `fabrica_objetivos`, `criarCampanhaNova` e
`coletor/lib/meta-subir.mjs` já fazem a subida.

### C3 · Relatórios › as três sobras
- **5º relatório da Frota:** histórico completo de trocas por item, com período. O
  de Revisões é retrato de propósito — com filtro de data, o item **nunca** trocado
  sumiria justamente do relatório de vencidos.
- **Km sem ponto de milhar:** sai `47000` ao lado de um texto que escreve
  `2.000 km`. Formatar todo `tipo: 'numero'` colocaria ponto no "Nº" do Patrimônio,
  o que fica pior — precisaria de um tipo de coluna `km`.
- **Recorte pelo 3º nível (Ambiente).** `arvore-de-locais.js` já suporta.

---

## Como manter esta lista

- Item que fecha **sai** daqui (a história fica no commit e nos planos de
  `docs/superpowers/`). Não deixar item morto ocupando espaço.
- Item que o dono **adia** fica, com a data e o motivo — como o A7 e o A9.
- Item novo entra com **o porquê**, não só o quê. "Falta X" sem o motivo vira
  item que ninguém entende em duas semanas.
- Ao encostar num assunto, reler o item aqui **antes** — vários guardam um
  cuidado que já custou caro (o "Marca" do A3, o `pages_manage_posts` do A7, o
  `balance` do C1).
