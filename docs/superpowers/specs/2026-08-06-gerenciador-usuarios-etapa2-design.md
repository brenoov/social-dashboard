# Gerenciador de Usuários — Etapa 2

**Data:** 2026-08-06 · **Estado:** aprovado pelo dono, pronto para virar plano

Continuação de `2026-08-06-config-admin-redesenho-design.md` (etapa 1, já no ar).
A etapa 1 deixou a tela **mostrando** marca/local/setor; esta deixa **editar**, e
resolve o vínculo entre login e cadastro de colaborador.

## O que motivou

O dono usou a tela nova e apontou três coisas:

1. Precisa alterar marca, setor e local ali mesmo.
2. A troca de senha devia gerar uma senha aleatória com botão de copiar, para
   mandar para a pessoa.
3. **"A varredura não está completa: a Raíssa está cadastrada como colaboradora
   sim."**

O item 3 era um defeito real, e a medição confirmou.

## O que foi medido

**O caso Raíssa.** `acessos_pessoas` tem "Raissa Herculano", status ativo,
`email_corporativo = raissaherculano@rbvcompany.com` — e `profile_id` **NULO**. O
login com esse e-mail existe. A tela da etapa 1 cruza login↔cadastro **só** por
`profile_id`, então mostrou "sem cadastro de colaborador" quando a verdade é
"o cadastro existe, ninguém ligou os dois".

Cruzando também por e-mail, o quadro real dos 15 logins é:

| Situação | Quantos |
|---|---:|
| Ligados | 9 |
| **Cadastro existe, só falta ligar** | **1** (Raíssa) |
| Sem cadastro mesmo | 5 (claudecode, cristian.leonel, ti@, tv@, emsilva99) |

Nota: **Cristian Leonel não tem cadastro de colaborador**, e é aprovador de
requisição de veículo e o único com permissão de Patrimônio. Provavelmente
deveria ter — mas quem decide é o dono, pela tela.

**Criar um colaborador é barato:** a única coluna obrigatória sem valor padrão em
`acessos_pessoas` é `nome`.

**A senha já tem metade do caminho.** `gerarSenhaForte(14)` existe
(`src/ferramentas/admin/senha.js`), usa `crypto.getRandomValues`, e já está
ligada a um botão "Gerar". Falta copiar.

**A cobrança da senha definitiva JÁ EXISTE e é bem feita.**
`moldura-do-aplicativo.vue:135` mostra uma tela cheia quando
`profiles.precisa_trocar_senha` é verdadeiro. Fica na moldura, que está em toda
rota, e **não tem botão de fechar**: só sai trocando a senha ou saindo da conta.
O "Trocar senha" do menu do avatar também já existe.

**O elo que falta:** quem marca `precisa_trocar_senha = true` hoje é só o fluxo de
"Puxar vendedoras das vendas". **O "Trocar senha" da lista de usuários não marca**
— então a senha provisória que o dono gera e manda vira a senha definitiva da
pessoa, e ele continua conseguindo entrar na conta dela.

## Decisões

1. **A edição mora numa ficha por pessoa**, não na linha da lista. Três campos ×
   15 pessoas sempre visíveis viram uma coluna interminável no celular.
2. **Vínculo por e-mail é SUGERIDO, nunca automático.** Ligar sozinho é escrever
   no cadastro por dedução, e caixas compartilhadas (`ti@`, `tv@`) podem casar
   com a pessoa errada — daria a lotação e o histórico de alguém para uma conta
   de setor.
3. **Criar cadastro faltante sai da própria ficha**, já ligado ao login — não um
   atalho que joga o dono em outra tela e o faz refazer o contexto.
4. **Nada de criar cadastro em massa** para os 5 sem vínculo: `claudecode@` é
   conta de serviço e `ti@`/`tv@` parecem caixas compartilhadas. Inventar pessoa
   para elas suja o cadastro.

## O desenho

### A ficha da pessoa

Abre ao tocar numa pessoa da lista. Três seções, nesta ordem.

**1 · Vínculo com o cadastro.** Primeira porque as outras dependem dela. Três
estados:

- **Ligado** — mostra o nome do colaborador.
- **Cadastro existe, e-mail bate** — "Achei um cadastro com este e-mail:
  *Raissa Herculano* — é a mesma pessoa?" com botão **Ligar**. O casamento é por
  `email_corporativo` OU `conta_apple`, sem diferenciar maiúscula.
- **Sem nada** — botão **Criar cadastro**, que grava em `acessos_pessoas` com
  `nome = profiles.name`, caindo para o e-mail quando o nome está vazio (é a
  mesma regra que a lista já usa para decidir o que mostrar);
  `email_corporativo = profiles.email`; e `profile_id` já preenchido. Os demais
  campos ficam vazios — inclusive a lotação, que o dono preenche em seguida na
  seção 2, agora habilitada.

**2 · Lotação.** Marca, Local e Setor, três listas que gravam em
`acessos_pessoas`:

| Campo | Coluna | Lista |
|---|---|---|
| Marca | `marca_id` | `patrimonio_empresas` (5) |
| Local | `organizacao_id` | `acessos_organizacoes` (5) |
| Setor | `setor_id` | `acessos_setores` (14) |

**Ficam desabilitadas enquanto não houver cadastro ligado**, com o motivo escrito
na tela. Não existe onde gravar, e campo que aceita e joga fora é pior que campo
travado.

(O nome da coluna `organizacao_id` engana: o conteúdo é lugar — Sede Centro,
Sede Village, Fábrica Conchal. Ver a etapa 1.)

**3 · Acesso.** Papel, botão de Permissões (o modal da etapa 1, sem mudança) e a
senha.

### A senha

O fluxo inteiro, com o que muda:

1. **Gerar** — já existe, `gerarSenhaForte(14)`.
2. **Copiar** — novo. Usar o padrão com plano B que `tela-de-acessos.vue:1238`
   já tem: `navigator.clipboard` falha em contexto sem HTTPS e em permissão
   negada, e falhar calado aqui faz o dono mandar uma senha que ele não copiou.
3. **Salvar** — já existe (edge `invite-user`, `resetPasswordUserId`).
4. **A senha continua visível depois de salvar**, até fechar a ficha. Hoje ela
   some e o aviso é "anote". Sem isso o botão de copiar chega tarde.
5. **Marcar `precisa_trocar_senha = true`** junto com a troca. É o elo que
   fecha o ciclo: o dono gera → copia → manda → a pessoa entra → o app cobra a
   senha definitiva dela.

   **Onde marcar: dentro da edge function `invite-user`**, no mesmo caminho do
   `resetPasswordUserId`, e não na tela. Se a tela fizesse a marcação num PATCH
   separado, uma falha entre as duas chamadas deixaria a senha trocada **sem** a
   cobrança — o pior dos dois mundos, porque o dono acharia que cobrou. Custa um
   deploy da edge function, e o `get_edge_function` antes de deployar é regra
   deste projeto.

## O que NÃO entra

- **Editar o nome da pessoa por aqui.** O nome vem de `acessos_pessoas.nome`
  quando há cadastro; editar `profiles.name` na mesma tela criaria duas verdades
  sobre o mesmo nome — defeito que este projeto já tem em outros cantos.
- **Ligar a Raíssa por SQL.** A tela vai sugerir; quem confirma é o dono.
- **Criar cadastro para as contas de serviço.**
- **Mexer na tela que cobra a senha no login** nem no "Trocar senha" do avatar:
  os dois foram conferidos e estão certos.

## Testes

Lógica pura, no padrão da pasta (módulo `.js` + `.test.mjs` ao lado):

- **`vinculo-de-cadastro.js`** — dado um login e a lista de colaboradores,
  devolve o estado (`ligado` | `sugestao` | `sem-cadastro`) e o candidato.
  Casos que precisam estar cobertos: e-mail idêntico com caixa diferente ·
  casamento por `conta_apple` · colaborador já ligado a OUTRO login (não pode
  virar sugestão) · dois colaboradores com o mesmo e-mail (não sugere nenhum, é
  ambíguo) · nenhum candidato.

Para a senha, o gerador já tem teste. O que falta cobrir é o **copiar com plano
B** e a garantia de que salvar a senha marca `precisa_trocar_senha`.
