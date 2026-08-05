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
- As tags serão gravadas **pela equipe, com celular** (app tipo NFC Tools), uma a uma —
  o que torna a tela de gravação da fase 2 obrigatória antes de escalar.

### A garantia: 2 anos já é o padrão, e o registro VALIDA

O dono disse primeiro que a garantia era de 1 ano, virando 2 no registro. **A leitura do
material da marca desmentiu isso** e o dono corrigiu a rota:

`01. Identidade da Marca/vessel-creative-tokens.json` traz
`warranty: { text: "2 anos de garantia", required: true, promotional_badge_forbidden: true }`
— ou seja, **todo criativo é obrigado a estampar 2 anos de garantia**. A promessa já é
pública, e promessa de anúncio obriga o fornecedor.

Decisão: **2 anos para todo mundo, sem registro.** O registro na tag não dá mais tempo —
ele **valida**: guarda a garantia em nome da cliente, no sistema da marca.

O motivo está escrito no próprio certificado impresso de vocês, na última linha:

> *"ASSEGURE-SE DO CORRETO PREENCHIMENTO DO SEU CERTIFICADO PELA LOJA, SEJA ELA FÍSICA
> OU ONLINE. ESTA É A SUA SEGURANÇA!"*

Hoje a garantia depende de a loja preencher um papel à mão. Papel se perde, apaga e não
prova nada. **É essa dor que a tag resolve** — e é esse o argumento comercial do projeto,
não um brinde de tempo extra.

### O termo não será escrito por mim

`09. Certificado de Garantia/Certificado de Garantia La vessel.ai` já traz o texto
aprovado, e é ele que vai pra página, palavra por palavra:

- **Conservação** (5 itens): flanela levemente umedecida e secagem à sombra; nunca máquina
  de lavar; evitar jeans, tintas, cosméticos e substâncias oleosas; cuidado com excesso de
  peso; guardar de forma a manter a forma original.
- **Trocas e reparos** (5 itens): produto sem uso troca uma única vez em até 30 dias com
  certificado e/ou cupom; defeito vai para análise da fábrica, que tem 30 dias para reparar
  ou devolver; compra em multimarcas se resolve na própria loja; **a garantia não cobre mau
  uso, peças amassadas, manchadas, danificadas ou desgastadas pelo uso natural**; conferir
  o produto no ato da compra.
- A frase de abertura também é de lá: *"Você acaba de adquirir um produto original
  La vessel®."*

### A cara da página: identidade VESSEL BRASIL 2026

Do `Manual da Marca - Vessel Brasil.pdf` (Moove Agência Criativa, 2026) — a identidade
nova, que é a que combina com o domínio:

| Cor | HEX | Pantone |
|---|---|---|
| Espresso Profundo | `#29211C` | Black 4 C |
| Verde Oliva | `#667355` | 5605 UP |
| Mushroom Beige | `#F2EFE6` | 7527 UP |
| Off White Quente | `#B7AA9A` | 7530 UP |

Fundos do sistema de criativos: base `#20261C` (olive noir), variação `#2A3023`, acento
champagne `#C3A36A`.

**Tipografia:** a assinatura VESSEL é lettering desenhado à mão (asset, nunca fonte); a
palavra BRASIL e os textos de apoio usam **Versatile** — fonte paga, sem licença web.
O próprio sistema de criativos já nomeia a substituta oficial: **Montserrat**
(`fallback_family`). É ela que a página usa, e por isso a escolha não é minha.

**Regras da marca que a página obedece:** logo só como asset oficial, nunca redesenhado
nem distorcido; o pattern nasce da repetição do elemento "SS" e nunca cobre o produto;
proibido selo promocional em cima da garantia.

**Assets baixados do WorkDrive:** logomarca, monograma "SS", pattern oficial.

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

Uma página só, rolagem única, desenhada pra celular. Fundo olive noir `#20261C`, pattern
"SS" quase invisível ao fundo, texto em Mushroom Beige, acento champagne. Quatro blocos:

**1. O selo.** Ocupa a primeira tela. Animação curta de conferência (≈800 ms) e trava em
**"Peça autêntica"**, com a frase do certificado impresso: *"Você acaba de adquirir um
produto original La vessel®."* Embaixo: modelo, cor, **nº da peça ("07 de 20")** e mês de
fabricação. Tem que aparecer em ~1 segundo num 4G de loja — é o momento que vende a
ideia.

**2. O pop-up do registro.** Sobe logo depois do selo:
*"Registre sua garantia de 2 anos no seu nome."* Campos: nome, WhatsApp, onde comprou,
data da compra. Ao confirmar, o selo ganha a faixa **"Garantia registrada até
04/08/2028"**. Dá pra fechar e registrar depois — o botão continua na página.

O texto de apoio deixa claro o que o registro faz e o que ele *não* faz:
*"A garantia de 2 anos é sua de qualquer jeito. Registrando, ela fica guardada com a
gente, no seu nome — sem depender do papel preenchido pela loja."* **Em nenhum lugar a
página promete tempo extra por registrar.**

**3. O termo.** O texto aprovado do certificado impresso, sem reescrita: conservação (5
itens) e trocas e reparos (5 itens), incluindo o que a garantia não cobre.

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
