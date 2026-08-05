# Selo Vessel — página de autenticidade e garantia (`/verify`)

Página pública que abre quando a cliente encosta o celular numa tag NFC costurada na
bolsa. Endereço: **`vesselbrasil.com.br/verify/<código>`**.

Escopo desta spec: **só a página**. O painel de administração (gerar lote, gravar tags,
ver registros) está desenhado no fim, mas é fase 2 — o dono avisou que o projeto ainda
pode não ser aprovado, e é a página que vai ser mostrada pra decidir.

## O que já é fato (levantado, não suposto)

- `vesselbrasil.com.br` **está registrado** e não aponta pra lugar nenhum
  (`dig` devolve só os servidores `a.sec.dns.br` / `b.sec.dns.br`, sem registro A).
- `lavessel.com.br` é uma **loja Shopify** (A `23.227.38.65`, DNS na Cloudflare).
  Não vamos tocar nela.
- A marca é a **La Vessel**: bolsas femininas de **canvas** — tecido premium, mais
  durável que couro. Regra de marca inviolável já registrada em
  `coletor/gestor-comercial.mjs:435`: **nunca** tratar o produto como couro, nunca
  público masculino.
- Instagram `@vessel.brasil`. Varejo e atacado, lojas físicas, fábrica em Conchal.
- Produção sai em lotes do mesmo modelo (ex.: 20 bolsas iguais), mas **cada tag é única**.
- Garantia de fábrica hoje: **1 ano**. Registrando na tag: **2 anos**.
- As tags serão gravadas **pela equipe, com celular** (app tipo NFC Tools), uma a uma —
  o que torna a tela de gravação da fase 2 obrigatória antes de escalar.

## A limitação que define o desenho

**Tag NFC não impede cópia.** Ela guarda um link, e link se copia. Quem quiser
falsificar lê a tag de uma bolsa original e grava o mesmo link em mil tags.

O que protege de verdade é o **código ser único por peça** somado ao **registro da
garantia**:

- se a peça já está registrada em nome de outra pessoa, a cliente vê isso na hora;
- se um mesmo código é lido em três cidades no mesmo dia, é prova de clonagem.

Por isso o registro não é um acessório de captura de contato: é o mecanismo
antifalsificação. E por isso toda leitura fica guardada.

## O que a cliente vê

Uma página só, rolagem única, desenhada pra celular. Fundo escuro, dourado e creme —
clima de certificado de joalheria. Quatro blocos:

**1. O selo.** Ocupa a primeira tela. Animação curta de conferência (≈800 ms) e trava em
**"Peça autêntica"**. Embaixo: modelo, cor, **nº da peça ("07 de 20")** e mês de
fabricação. Tem que aparecer em ~1 segundo num 4G de loja — é o momento que vende a
ideia.

**2. O pop-up da garantia estendida.** Sobe logo depois do selo:
*"Registre e sua garantia vira 2 anos."* Campos: nome, WhatsApp, onde comprou, data da
compra. Ao confirmar, o selo ganha a faixa **"Garantia ativa até 04/08/2028"**. Dá pra
fechar e registrar depois — o botão continua na página.

**3. O termo.** Português claro, sem juridiquês: 1 ano de fábrica pra todo mundo, 2 anos
registrando. O que cobre (costura, ferragem, alça, defeito de fabricação) e o que não
cobre (mau uso, corte, desgaste natural). O texto sai no repositório como rascunho — o
dono revisa antes de ir pra rua.

**4. A marca.** Bloco curto sobre o canvas (premium, mais durável que couro), link pro
Instagram e pra loja.

### Os três estados da mesma página

| Situação | O que aparece |
|---|---|
| Código existe e está livre | Selo + pop-up de registro |
| Código existe e **já registrado** | Selo + faixa *"Registrada em 12/03/2026 por Mar\*\*\*"*, sem pop-up |
| Código não existe | Tela vermelha *"Não conseguimos confirmar esta peça"* + botão de falar com a marca |

O nome de quem registrou **nunca aparece inteiro** — só a primeira sílaba. Quem tem a
bolsa reconhece o próprio nome; quem está checando uma falsificação vê que a peça já tem
dona; e ninguém consegue colher nome de cliente lendo tags alheias.

### O que fica de fora, de propósito

- **A raiz `vesselbrasil.com.br` não vira página.** Decisão do dono. Mas o domínio
  precisa apontar pra Vercel pro `/verify` existir, e sem regra a raiz mostraria o painel
  interno. Então a raiz **redireciona pra `lavessel.com.br`** — decisão aprovada pelo
  dono como **provisória**. É uma linha de configuração, não é design.
- Nada de login, nada de carrinho, nada do painel carregado nessa página.

## Por trás

### Onde mora

Dentro do próprio `~/iamundi`, como **página estática independente** em
`public/verify/index.html` — mesmo padrão que o `escritorio-3d` já usa. Não carrega o
bundle do painel: é HTML + CSS + um JavaScript curto, sem framework.

Mudanças no `vercel.json`:

1. rewrite novo `/verify/:codigo` → `/verify/index.html`, **antes** do catch-all;
2. o catch-all do painel passa a excluir `verify` além de `escritorio-3d`;
3. redirect da raiz **só no host `vesselbrasil.com.br`** → `https://lavessel.com.br`;
4. o domínio `vesselbrasil.com.br` é adicionado ao projeto Vercel existente.

### Banco (Supabase `kounqtdoioootxqegkij`)

Migration nova em `db/migrations/`, idempotente, seguindo o padrão do repositório.

| Tabela | Guarda |
|---|---|
| `vessel_lotes` | o lote de produção: modelo, cor, sku, quantidade, data de fabricação |
| `vessel_pecas` | uma linha por tag: `codigo` (chave), lote, nº na série, total da série, quando a tag foi gravada |
| `vessel_registros` | a garantia ativada: código, nome, whatsapp, onde comprou, data da compra, `garantia_ate` |
| `vessel_leituras` | toda leitura: código tentado, achou ou não, quando, agente, hash do IP |

`vessel_registros` tem o **código como chave primária** — o banco em si impede duas
donas pra mesma peça, não a tela.

O código é de **10 caracteres sorteados** de um alfabeto sem ambiguidade (sem `O`, `0`,
`I`, `1`): não é sequencial, então não dá pra adivinhar o próximo a partir de uma bolsa
comprada.

### Segurança

A página é pública e usa a chave anônima. **Ela não lê as tabelas direto** — as quatro
têm RLS ligada e nenhuma política pra `anon`. Todo o acesso passa por duas funções
`security definer`:

- **`vessel_verificar(codigo)`** — normaliza o código, grava a leitura (achando ou não) e
  devolve só o necessário: modelo, cor, nº, data, se está registrada, nome mascarado e
  `garantia_ate`. Nunca lista códigos.
- **`vessel_registrar(codigo, nome, whatsapp, onde, comprado_em)`** — recusa se o código
  não existir ou já estiver registrado; senão grava e devolve a data de fim da garantia.
  `garantia_ate` = data da compra + 2 anos (ou data do registro + 2 anos, se a cliente
  não souber a data da compra).

Consequência: mesmo com a chave anônima na mão, ninguém baixa a lista de códigos pra
clonar em massa — que é exatamente o ataque que interessa aqui.

### Pra demonstrar

A migration já semeia **5 códigos de teste** de um lote fictício. O dono grava um deles
numa tag e testa de verdade no celular — inclusive o estado "já registrada" e o de
código inválido.

## Testes

- **Unitários** (`node --test`, padrão `*.test.mjs` do repositório) nas funções puras
  extraídas pra um módulo próprio: mascarar nome, calcular `garantia_ate`, normalizar
  código digitado (maiúsculas, hífens, espaços).
- **Manual, no navegador**, os três estados na página real antes de subir.
- Conferir no ar por `curl` no endereço `/verify/<código de teste>`.

## O que fica pra fase 2 (só se o projeto for aprovado)

Ferramenta **Autenticidade** no painel, dentro de Gestão Interna:

- **Gerar lote** — escolhe o modelo (puxando SKU e nome de `gc_estoque_item`) ou digita,
  cor, quantidade → cria N códigos.
- **Gravar tags** — mostra um link por vez, em letra grande, com botão de copiar e um
  "✓ gravei essa" que marca a peça. Sem isso, gravar 20 tags diferentes na mão vira erro
  garantido.
- **Registros** — quem registrou, WhatsApp, quando, qual peça; exportável.
- **Alertas de clonagem** — peça lida demais, ou tentativa de registrar peça já
  registrada.
- Permissão nova **nasce desmarcada**, como toda ferramenta nova do projeto.

Recomendação operacional pra fase 2: imprimir também um **QR com o mesmo link** na
etiqueta de papel. iPhone antigo, NFC desligado ou tag amassada acontecem — e sem plano B
a cliente fica com a sensação de que a bolsa não é original.
