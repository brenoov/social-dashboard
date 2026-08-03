# App Review da Meta — o que pedir, e o texto pronto para colar

**Para que serve este documento:** o App Review é um formulário manual no painel
da Meta, com vídeo de tela e uma descrição por permissão. Ele é analisado por
uma pessoa, demora dias, e se for reprovado a fila recomeça. Este arquivo tem o
que foi medido, o que falta pedir, e o texto de cada campo já escrito — para o
formulário ser preenchido uma vez só.

**Eu não consigo enviar o pedido por você.** Ele exige entrar em
`developers.facebook.com` com a conta do Business, gravar tela e anexar arquivo.
O que dá para automatizar é a parte que erra mais: descobrir exatamente o que
falta. Isso está medido abaixo.

---

## 1. O que foi medido (03/08/2026)

Rodado por `coletor/sondar-app-review.mjs` — leitura pura, custo R$ 0. Para
repetir: Actions → "Validar o Gestor contra a conta real" → alvo `appreview`.

**App:** Dashboard Social RBV · id `1960915391453503`
**Página:** `324679337390168` · **Instagram:** `17841462952561833`

### Já funciona — não entra no pedido

| Permissão | Onde é usada | Endpoint conferido |
|---|---|---|
| `ads_management` | Gestão de Tráfego: criar, pausar e mudar orçamento | ✓ responde |
| `ads_read` | Todos os painéis de desempenho | ✓ responde |
| `business_management` | Descobrir as contas de anúncio do Business | ✓ responde |
| `pages_show_list` | Achar a página da marca | ✓ responde |
| `pages_read_engagement` | Alcance e engajamento dos posts | ✓ responde |
| `instagram_basic` | Perfil e mídias do Instagram | ✓ responde |
| `instagram_manage_insights` | Dashboard de Redes: seguidores, alcance | ✓ responde |

Sete de nove. **Nenhuma delas entra no pedido** — pedir permissão que já se tem
só dá trabalho ao analista e atrasa a resposta.

### Falta — e só UMA delas deve ser pedida agora

| Permissão | Situação | Pedir? |
|---|---|---|
| `instagram_content_publish` | A Meta recusa hoje com `(#10) Requires instagram_content_publish permission to manage the object` | **Sim** |
| `pages_manage_posts` | Ausente do token — mas **nenhum código nosso usa** | **Não** |

> **Por que não pedir `pages_manage_posts` junto.** A Central de Conteúdo publica
> só no Instagram; não existe caminho de publicação em Página do Facebook em
> lugar nenhum do sistema. A Meta reprova permissão que ela não consegue ver
> sendo usada no vídeo — e uma permissão reprovada derruba o pedido inteiro,
> inclusive a que estava certa. Se um dia a Central publicar no Facebook, aí ela
> é pedida, num pedido próprio.

---

## 2. Antes de abrir o formulário

Estes quatro itens reprovam o pedido sozinhos, e três deles não são código.

1. **Verificação do negócio (Business Verification).** Permissão de publicação
   não sai sem o Business verificado. É documento de CNPJ e pode levar dias —
   comece por aqui, porque é o item mais lento de todos.
2. **Política de privacidade em URL pública.** A Meta abre o link e lê. Precisa
   dizer, em português, quais dados o app acessa e por quê.
3. **App em modo LIVE.** Em modo de desenvolvimento o app concede tudo para quem
   é admin dele — foi por isso que a sonda achou sete permissões verdes. Isso
   vale só para você; para qualquer outra pessoa, nada funciona.
4. **Login para o analista.** O dashboard é fechado por senha, e o analista da
   Meta precisa entrar para ver a tela funcionando. **Crie um usuário só para
   isso**, com acesso apenas à Central de Conteúdo, e apague depois da
   aprovação. Não mande a sua senha.

> Sobre o item 4: uma conta de teste com permissão a mais fica aberta por
> semanas. A Central de Conteúdo é o que o pedido é sobre — o resto do painel
> não precisa estar visível para o analista aprovar.

---

## 3. O texto da permissão

A Meta reprova descrição genérica ("para gerenciar conteúdo"). O que passa é a
descrição que aponta a tela, diz quem clica e mostra que existe uma pessoa
decidindo. O texto abaixo já está nesse formato.

### `instagram_content_publish`

> O aplicativo é um painel interno de gestão de marketing, usado apenas pela
> nossa própria equipe e apenas para as contas do nosso próprio negócio.
>
> Na tela "Central de Conteúdo", a equipe monta o calendário de publicações:
> escolhe a imagem, escreve a legenda e define a data e a hora. Cada publicação
> passa por uma aprovação explícita de um responsável dentro do painel — nada é
> publicado sem essa aprovação.
>
> Usamos `instagram_content_publish` no horário agendado, para publicar no perfil
> do Instagram do próprio negócio exatamente a imagem e a legenda que já foram
> aprovadas. Sem essa permissão, uma pessoa precisa abrir o aplicativo do
> Instagram e republicar tudo à mão, no horário certo, todos os dias.
>
> Não publicamos em contas de terceiros e não pedimos acesso a contas de outros
> usuários. O aplicativo não é distribuído publicamente.

---

## 4. O roteiro do vídeo de tela

A Meta pede um vídeo mostrando a permissão sendo usada de verdade. O erro comum
é gravar a tela pronta sem mostrar o caminho — o analista precisa ver o clique.

Grave em uma tomada só, sem cortes, com o cursor visível:

1. **Entrar no painel** com o usuário de teste. Mostre a tela de login e o login
   acontecendo — o analista precisa ver que a credencial que você mandou funciona.
2. **Abrir a Central de Conteúdo** pelo menu.
3. **Criar uma publicação**: escolher a imagem, escrever a legenda, escolher a
   data e a hora.
4. **Aprovar.** Mostre o botão de aprovação e a publicação mudando de estado.
   Este passo é o que prova que existe controle humano, e é o que a Meta procura.
5. **Publicar** e mostrar o resultado: volte ao painel com a confirmação e abra
   o perfil do Instagram com a publicação no ar.

Fale ou escreva na tela, em cada passo, qual permissão está sendo usada.
Analista não adivinha.

> **Cuidado com a ordem.** O passo 5 só acontece com o interruptor ligado, o
> que só é possível depois da aprovação. Na prática: assim que a permissão sair,
> ligue numa marca só, publique uma peça de teste, e grave o vídeo dessa
> publicação.

---

## 5. A aprovação NÃO liga a publicação sozinha

Este é o ponto que mais surpreende, e por isso está por último e em separado.

**O código já existe** (`supabase/functions/_shared/publicar-instagram.js`), com
os dois passos da Graph API, carrossel, reels e stories, e 25 testes que rodam a
sequência inteira contra uma Meta de mentira. Mas ele está **desligado** no
interruptor `ESCOPOS_DE_PUBLICACAO_LIBERADOS`, que continua `false` — hoje
`publicarPeca()` devolve `{ modo: 'manual' }` e o sistema manda o aviso no
celular com a arte e a legenda prontas.

Depois da aprovação, na ordem:

1. **Regerar o token** com o escopo novo e trocá-lo onde ele mora. O token atual
   não ganha permissão por osmose — ele foi emitido antes.
2. **Conferir `CREATE_CONTENT`** na página. Isso é papel **na página**, não
   escopo do app: sem ele, publicar falha mesmo com a permissão aprovada. A
   sonda confere isso; rode `alvo=appreview` de novo depois de trocar o token.
3. **Trocar `ESCOPOS_DE_PUBLICACAO_LIBERADOS` para `true`**, publicar a função
   `conteudo-hora-h`, e ligar conta por conta em `accounts.publicacao_automatica`
   — **começar por UMA marca**, nunca por todas.
4. **Ligar os dois crons** da Central (migrations
   `2026-07-30-conteudo-06-cron-hora-h.sql` e
   `2026-07-31-conteudo-09-cron-espelho.sql`), hoje desligados de propósito.

### O que ainda não tem prova

Os testes provam a **sequência** — que os contêineres são criados na ordem certa,
que o vídeo só é publicado depois de `FINISHED`, que carrossel monta o álbum com
os filhos certos. O que eles **não** podem provar é o que só a Meta responde:
se ela aceita cada `media_type`, se baixa a URL assinada do nosso Storage, e se o
formato do arquivo passa. Isso só se sabe na primeira publicação de verdade — que
é justamente a que vai virar o vídeo do pedido. Faça essa primeira numa peça de
teste, numa marca só.

**A imagem sai por URL assinada** do bucket privado `conteudo`, válida por 30
minutos, gerada em `conteudo-hora-h` e injetada no módulo. A Meta baixa o arquivo
pelo lado dela — não existe upload de bytes nesta API. (A allow-list do
`meta-proxy` não entra nesta história: aqui a Edge Function fala direto com a
Graph API, com o token da conta.)
