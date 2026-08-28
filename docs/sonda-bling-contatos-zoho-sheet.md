# Sonda: o que o Bling e o Zoho aceitam de verdade

Medido em **28/08/2026**, contra as APIs reais, antes de escrever uma linha do robô
de espelho da lista de espera. Tudo aqui é resposta de servidor, não documentação.

**Resultado curto:** os dois espelhos estão bloqueados por **permissão**, não por
código. O do Bling depende do dono. **O da planilha tem uma saída que não depende
de ninguém** — está no fim.

---

## Como a sonda foi feita sem risco

Duas regras que o script seguiu, e valem para qualquer sonda futura:

1. **Nunca renovar o token do Bling.** Renovar **rotaciona o `refresh_token`** e
   regrava a linha em `bling_tokens`. Renovar por fora e não gravar de volta
   derrubaria o robô de produção. O script confere o vencimento e **para** se
   faltar menos de 10 minutos. Na hora da sonda o token valia por mais 256
   minutos, então foi usado direto.
2. **Nunca imprimir segredo nem dado de cliente.** O Bling tem contatos de gente
   real; a sonda mostraria nome de campo e tipo, nunca valor. (Nem chegou a ser
   necessário — ver abaixo.)

---

## Bling: falta a permissão de contatos

```
GET /Api/v3/produtos?limite=1        → 200   ← controle: o token FUNCIONA
GET /Api/v3/contatos?limite=1        → 403   insufficient_scope
GET /Api/v3/contatos/tipos           → 200
GET /Api/v3/estoques/saldos?limite=1 → 400   VALIDATION_ERROR (falta parâmetro)
```

A resposta do 403, na íntegra:

> `{"error":{"type":"insufficient_scope","message":"insufficient_scope",`
> `"description":"The request requires higher privileges than provided by the access token"}}`

**Não é token vencido nem endereço errado.** O `/produtos` responde 200 com o mesmo
token, no mesmo instante. O aplicativo do Bling simplesmente **não foi autorizado
para contatos**.

Curiosidade útil: `/contatos/tipos` **passa** e devolve os 11 tipos cadastrados
(Padrão, Fornecedor, Funcionário, Vendedor, Transportador, Técnico, Contador,
Comissão, Oficina, Desenvolvedor, Fornecedor verificado). Sub-recurso liberado,
recurso principal não.

Como o `GET` já é barrado, o `POST` também é — e por isso **nenhuma tentativa de
escrita foi feita**: criar contato de teste num ERP de produção sem necessidade
seria risco sem ganho.

### O que destrava, e o preço

O dono precisa **reautorizar o aplicativo do Bling incluindo a permissão de
contatos**.

⚠️ **Isso mata o token atual.** Está registrado em [[project_iamundi_data_da_venda]]:
reautorizar o Bling invalida o `refresh_token` em uso. Enquanto o novo não for
gravado em `bling_tokens`, **tudo o que depende do Bling para de funcionar** —
Gestão Comercial, notificação de vendas, o proxy inteiro.

Portanto: reautorizar e regravar o token têm de acontecer **na mesma sessão**, com
alguém olhando, e de preferência fora do horário comercial.

### E quando a permissão existir

A portaria pública (`bling-proxy`) **continua só leitura**. O robô do espelho fala
com o Bling direto, com o token do banco. A lista de caminhos permitidos do proxy
não ganha `contatos` — quem lê aquele arquivo tem de continuar lendo *"Só leitura"*
no cabeçalho e isso ser verdade.

**Onde a marca de origem vai:** ainda não determinado, porque não deu para ler um
contato. Assim que a permissão existir, a primeira coisa é ler um contato
existente, ver os campos disponíveis, e **conferir na tela do Bling** que a marca
aparece onde alguém vai olhar. Campo que existe mas ninguém abre não serve.

---

## Zoho: nenhuma das duas credenciais escreve em planilha

Existem **duas** conexões Zoho no sistema, e as duas foram conferidas.

**1. A do `coletor/.env`** — perguntei os escopos ao próprio Zoho, na resposta do
refresh:

```
WorkDrive.files.ALL
WorkDrive.team.READ
```

**2. A de `acessos_conexoes`** (provedor `zoho`, atualizada em 18/07/2026):

```
ZohoMail.organization.accounts.ALL
ZohoMail.organization.accounts.READ
WorkDrive.teamfolders.ALL
WorkDrive.files.ALL
WorkDrive.teamfolders.sharing.ALL
```

**Nenhuma das duas tem escopo de Zoho Sheet.** Planilha é outro produto, com
permissão própria.

**Armadilha que quase me enganou:** chamar a API de planilha com o token atual
devolve **HTTP 400**, não 401 nem 403:

> `{"error_message":"The parameter [method] required for processing this request is missing.","error_code":2831}`

Ou seja, ela reclama do formato da chamada **antes** de checar permissão. Um 400
aqui parece "quase funcionando" e não é — quem parar nesse sinal conclui que só
falta ajustar o corpo da requisição. A prova real é a lista de escopos, não o
código de resposta.

---

## A saída para a planilha, que NÃO depende de ninguém

As duas credenciais têm **`WorkDrive.files.ALL`**, e essa permissão está **provada
em produção**: o robô `enviar-pdf-checklist` sobe PDF para o WorkDrive todo dia
(três chegaram na primeira tentativa em 18/08/2026, com `POST /upload`).

Então o robô do espelho pode **manter um arquivo CSV no WorkDrive**, reescrito a
cada rodada com a lista inteira. O Zoho Sheet abre CSV nativamente.

| | Zoho Sheet pela API | CSV no WorkDrive |
|---|---|---|
| Precisa de nova permissão | **sim**, e do dono | **não** |
| Funciona hoje | não | **sim, provado** |
| Acrescenta linha | sim | reescreve o arquivo inteiro |
| Fórmula e formatação sobrevivem | sim | não |

Reescrever o arquivo inteiro é aceitável enquanto a lista for pequena, e a lista
de espera de um lançamento é pequena por definição. Se um dia precisar de fórmula
viva na planilha, aí sim vale pedir a permissão.

**Recomendação:** ir de CSV no WorkDrive agora, e tratar o Zoho Sheet como melhoria
futura. Assim o espelho da planilha sai **hoje**, e só o do Bling fica esperando o
dono.

---

## Resumo para decidir

| Espelho | Estado | Depende de |
|---|---|---|
| **Planilha** | pode ser feito **agora**, como CSV no WorkDrive | nada |
| **Bling** | **bloqueado** | o dono reautorizar o app com a permissão de contatos — e isso derruba o Bling até o token novo ser gravado |

Ver [[project_vessel_lp_lista_de_espera]],
[[reference_workdrive_caminho_da_marca_vessel]].
