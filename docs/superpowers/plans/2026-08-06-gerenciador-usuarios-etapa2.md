# Gerenciador de Usuários — Etapa 2 — Plano de Implementação

> **Para quem executa com agentes:** SUB-SKILL OBRIGATÓRIA: use
> `superpowers:subagent-driven-development` (recomendado) ou
> `superpowers:executing-plans` para implementar tarefa a tarefa. Os passos usam
> caixinha (`- [ ]`) para acompanhamento.

**Objetivo:** dar à tela de Usuários uma ficha por pessoa onde se edita a lotação
(marca/local/setor), se liga ou cria o cadastro de colaborador, e se troca a senha
com gerar + copiar — fechando o ciclo com a cobrança da senha definitiva.

**Arquitetura:** a decisão de vínculo (é a mesma pessoa? já está ligado? é
ambíguo?) sai para um módulo puro com teste, porque é onde mora o risco de dar a
lotação e o histórico de alguém para a conta errada. O resto é tela imperativa,
no mesmo estilo do arquivo. A marcação de "precisa trocar a senha" vai para a
edge function, junto da troca, e não para a tela.

**Tech Stack:** Vue 3 + Vite · Supabase (Postgres + Edge Functions Deno) · testes
com `node --test` (`npm test`) · sem dependência nova.

**Spec:** `docs/superpowers/specs/2026-08-06-gerenciador-usuarios-etapa2-design.md`

## Restrições Globais

- **Ligar login a cadastro é SEMPRE confirmado pelo dono.** Nenhum código liga
  sozinho, nem em caso de e-mail idêntico.
- **Nada de criar cadastro em massa.** Só um por vez, pela ficha.
- **Não editar o nome da pessoa nesta tela** — o nome vem de
  `acessos_pessoas.nome`; editar `profiles.name` aqui criaria duas verdades.
- **Ler tabela que só abre para logado usa `sbClient`, nunca o helper `sb()`** —
  com a chave anônima o PostgREST devolve 200 + lista vazia, erro que se
  disfarça de "não tem nada". `acessos_pessoas`, `acessos_setores`,
  `acessos_organizacoes` e `patrimonio_empresas` estão nessa situação.
- **Erro de leitura ou de gravação nunca vira silêncio nem lista vazia.**
- **Título e nome nunca cortam:** `overflow-wrap:anywhere`, nunca
  `text-overflow: ellipsis`.
- **Alvo de toque ≥ 40px e campo com fonte ≥ 16px** no celular (senão o iOS dá
  zoom ao focar). Ajuste de celular vai em `@media`, sem tocar no desktop.
- **Português literal, sem jargão**, em todo texto de tela.
- Comentários explicam o PORQUÊ. Assunto do commit sem acentos.
- `npm test` inteiro tem de passar ao fim de cada tarefa (**1961 hoje**).
- Módulo novo em `src/ferramentas/admin/` precisa estar **importado** na `.vue`
  que o usa — `imports.test.mjs` existe porque isso já subiu quebrado.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/ferramentas/admin/vinculo-de-cadastro.js` | **criar** — decide ligado / sugestão / ambíguo / sem-cadastro |
| `src/ferramentas/admin/vinculo-de-cadastro.test.mjs` | **criar** |
| `supabase/functions/invite-user/index.ts` | **modificar** — reset de senha passa a cobrar a troca |
| `src/ferramentas/admin/tela-de-admin.vue` | **modificar** — ficha da pessoa, lotação, vínculo, senha |
| `src/ferramentas/admin/imports.test.mjs` | **modificar** — cobre o módulo novo |

---

### Task 1: A decisão do vínculo (módulo puro)

É o coração da entrega: um casamento errado dá a lotação e o histórico de uma
pessoa para outra, ou para uma caixa compartilhada.

**Files:**
- Create: `src/ferramentas/admin/vinculo-de-cadastro.js`
- Test: `src/ferramentas/admin/vinculo-de-cadastro.test.mjs`

**Interfaces:**
- Produces: `estadoDoVinculo(login, colaboradores) -> { estado, colaborador }`
  - `estado`: `'ligado'` | `'sugestao'` | `'ambiguo'` | `'sem-cadastro'`
  - `colaborador`: o objeto do colaborador, ou `null` em `ambiguo`/`sem-cadastro`
  - `login`: `{ id, email }` · `colaboradores`: `[{ id, nome, email_corporativo, conta_apple, profile_id }]`
- Consumido pela Task 3.

- [ ] **Passo 1: escrever o teste que falha**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { estadoDoVinculo } from './vinculo-de-cadastro.js'

const LOGIN = { id: 'u-1', email: 'raissaherculano@rbvcompany.com' }
const C = (extra) => ({ id: 'c-1', nome: 'Raissa Herculano', email_corporativo: null, conta_apple: null, profile_id: null, ...extra })

test('ja ligado: o vinculo existe e nao ha nada a sugerir', () => {
  const r = estadoDoVinculo(LOGIN, [C({ profile_id: 'u-1' })])
  assert.equal(r.estado, 'ligado')
  assert.equal(r.colaborador.nome, 'Raissa Herculano')
})

test('o caso REAL da Raissa: cadastro existe, e-mail bate, profile_id nulo', () => {
  // Este e o defeito que motivou a etapa 2. A tela dizia "sem cadastro de
  // colaborador" porque so cruzava por profile_id.
  const r = estadoDoVinculo(LOGIN, [C({ email_corporativo: 'raissaherculano@rbvcompany.com' })])
  assert.equal(r.estado, 'sugestao')
  assert.equal(r.colaborador.nome, 'Raissa Herculano')
})

test('maiuscula nao atrapalha o casamento', () => {
  const r = estadoDoVinculo({ id: 'u-1', email: 'Raissa@RBVcompany.com' }, [C({ email_corporativo: 'raissa@rbvcompany.com' })])
  assert.equal(r.estado, 'sugestao')
})

test('casa tambem pela conta Apple, nao so pelo e-mail corporativo', () => {
  const r = estadoDoVinculo(LOGIN, [C({ conta_apple: 'raissaherculano@rbvcompany.com' })])
  assert.equal(r.estado, 'sugestao')
})

test('colaborador JA LIGADO A OUTRO login nao vira sugestao', () => {
  // Sugerir aqui levaria a roubar o cadastro de outra pessoa: um clique e a
  // lotacao e o historico dela mudam de dono.
  const r = estadoDoVinculo(LOGIN, [C({ email_corporativo: 'raissaherculano@rbvcompany.com', profile_id: 'u-OUTRO' })])
  assert.equal(r.estado, 'sem-cadastro')
  assert.equal(r.colaborador, null)
})

test('dois colaboradores com o mesmo e-mail: ambiguo, nao sugere nenhum', () => {
  // Caixa compartilhada (ti@, tv@) e o caso real disso. Escolher um seria
  // chutar qual pessoa recebe a lotacao.
  const dois = [C({ id: 'c-1', email_corporativo: 'ti@rbvcompany.com' }),
                C({ id: 'c-2', nome: 'Outra', email_corporativo: 'ti@rbvcompany.com' })]
  const r = estadoDoVinculo({ id: 'u-9', email: 'ti@rbvcompany.com' }, dois)
  assert.equal(r.estado, 'ambiguo')
  assert.equal(r.colaborador, null)
})

test('o ja-ligado vence a ambiguidade', () => {
  const lista = [C({ id: 'c-1', profile_id: 'u-1' }),
                 C({ id: 'c-2', nome: 'Homonima', email_corporativo: 'raissaherculano@rbvcompany.com' })]
  assert.equal(estadoDoVinculo(LOGIN, lista).estado, 'ligado')
})

test('ninguem parecido: sem cadastro', () => {
  const r = estadoDoVinculo(LOGIN, [C({ email_corporativo: 'outra@rbvcompany.com' })])
  assert.equal(r.estado, 'sem-cadastro')
  assert.equal(r.colaborador, null)
})

test('e-mail vazio dos dois lados NAO casa (senao todo mundo casaria com todo mundo)', () => {
  const r = estadoDoVinculo({ id: 'u-1', email: '' }, [C({ email_corporativo: '' })])
  assert.equal(r.estado, 'sem-cadastro')
})

test('lista vazia e entradas nulas nao estouram', () => {
  assert.equal(estadoDoVinculo(LOGIN, []).estado, 'sem-cadastro')
  assert.equal(estadoDoVinculo(LOGIN, null).estado, 'sem-cadastro')
  assert.equal(estadoDoVinculo(null, [C({})]).estado, 'sem-cadastro')
})
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `node --test src/ferramentas/admin/vinculo-de-cadastro.test.mjs`
Esperado: FALHA — `Cannot find module './vinculo-de-cadastro.js'`

- [ ] **Passo 3: escrever o módulo**

```js
// LIGAR UM LOGIN AO CADASTRO DE COLABORADOR — a decisão, sem a tela.
//
// POR QUE EXISTE: a primeira versão da tela cruzava login × cadastro SÓ por
// `profile_id`. A Raíssa tem cadastro ativo com o e-mail idêntico ao login e
// `profile_id` nulo — a tela dizia "sem cadastro de colaborador" quando o
// cadastro estava ali. Foi o dono quem percebeu.
//
// POR QUE É PURO E TESTADO: um casamento errado dá a lotação e o histórico de
// uma pessoa para outra. É barato de errar e caro de perceber.
//
// ESTE MÓDULO NÃO LIGA NADA. Ele devolve o que a tela deve oferecer, e quem
// confirma é sempre o dono.

const cru = (s) => String(s || '').trim().toLowerCase()

// O e-mail do colaborador pode estar em qualquer um dos dois campos.
const emailsDo = (c) => [cru(c && c.email_corporativo), cru(c && c.conta_apple)].filter(Boolean)

export function estadoDoVinculo(login, colaboradores) {
  const lista = Array.isArray(colaboradores) ? colaboradores.filter(Boolean) : []
  const id = login && login.id
  const email = cru(login && login.email)

  // 1. Já ligado vence tudo, inclusive ambiguidade de e-mail: o vínculo
  //    explícito é uma decisão que alguém já tomou.
  const ligado = id ? lista.find((c) => c.profile_id && String(c.profile_id) === String(id)) : null
  if (ligado) return { estado: 'ligado', colaborador: ligado }

  // Sem e-mail não há como casar. Dois vazios "batendo" fariam todo mundo
  // casar com todo mundo.
  if (!email) return { estado: 'sem-cadastro', colaborador: null }

  // 2. Candidatos: e-mail bate E o cadastro ainda não é de outra pessoa.
  //    Cadastro já ligado a OUTRO login está fora — sugeri-lo seria oferecer
  //    um clique que rouba o cadastro alheio.
  const candidatos = lista.filter((c) => !c.profile_id && emailsDo(c).includes(email))

  if (candidatos.length === 1) return { estado: 'sugestao', colaborador: candidatos[0] }

  // 3. Mais de um com o mesmo e-mail: caixa compartilhada. Escolher seria
  //    chutar qual pessoa recebe a lotação.
  if (candidatos.length > 1) return { estado: 'ambiguo', colaborador: null }

  return { estado: 'sem-cadastro', colaborador: null }
}
```

- [ ] **Passo 4: rodar e ver passar**

Rodar: `node --test src/ferramentas/admin/vinculo-de-cadastro.test.mjs`
Esperado: PASSA, 10 testes.

- [ ] **Passo 5: rodar a suíte inteira**

Rodar: `npm test` — esperado 1971 passando (1961 + 10).

- [ ] **Passo 6: commit**

```bash
git add src/ferramentas/admin/vinculo-de-cadastro.js src/ferramentas/admin/vinculo-de-cadastro.test.mjs
git commit -m "decidir se um login e um cadastro de colaborador sao a mesma pessoa"
```

---

### Task 2: Trocar a senha passa a cobrar a definitiva

Hoje o dono define uma senha provisória, manda para a pessoa — e ela vale para
sempre. Enquanto valer, quem digitou também entra na conta.

**Files:**
- Modify: `supabase/functions/invite-user/index.ts` (bloco `if (resetPasswordUserId)`)

**Interfaces:**
- Produces: o mesmo endpoint, mesmo corpo (`{ resetPasswordUserId, password }`),
  agora marcando `profiles.precisa_trocar_senha = true`. A Task 5 depende disso.

- [ ] **Passo 1: alterar o bloco do reset**

O bloco hoje é:

```ts
    if (resetPasswordUserId) {
      if (!profile?.is_superadmin) throw new Error('Apenas superadmin pode trocar a senha de usuários')
      if (!password || password.length < 6) throw new Error('A senha precisa de no mínimo 6 caracteres')
      const { error: pwErr } = await adminClient.auth.admin.updateUserById(resetPasswordUserId, { password })
      if (pwErr) throw pwErr
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }
```

Passa a ser:

```ts
    if (resetPasswordUserId) {
      if (!profile?.is_superadmin) throw new Error('Apenas superadmin pode trocar a senha de usuários')
      if (!password || password.length < 6) throw new Error('A senha precisa de no mínimo 6 caracteres')
      const { error: pwErr } = await adminClient.auth.admin.updateUserById(resetPasswordUserId, { password })
      if (pwErr) throw pwErr

      // SENHA POSTA POR OUTRA PESSOA É PROVISÓRIA, SEMPRE.
      //
      // Quem digitou a senha também sabe entrar na conta. A tela que cobra a
      // troca já existe (moldura-do-aplicativo.vue, em toda rota, sem botão de
      // fechar) e já lê esta coluna — só ninguém a marcava aqui. Sem isto, a
      // senha que o dono manda por mensagem vira a senha definitiva da pessoa.
      //
      // A marcação mora AQUI, e não na tela: em duas chamadas separadas, uma
      // falha entre elas deixaria a senha trocada SEM a cobrança, e o dono
      // acharia que cobrou.
      const { error: flagErr } = await adminClient.from('profiles')
        .update({ precisa_trocar_senha: true }).eq('id', resetPasswordUserId)
      if (flagErr) throw flagErr

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }
```

- [ ] **Passo 2: ver o que está em produção antes de publicar**

Regra deste projeto: `get_edge_function` antes de deployar. Use o MCP do Supabase
(projeto `kounqtdoioootxqegkij`, função `invite-user`) e compare com o arquivo
local — se estiverem diferentes fora deste bloco, PARE e avise o coordenador
(outra sessão pode ter mexido).

- [ ] **Passo 3: publicar**

Deploy pelo MCP (`deploy_edge_function`), mantendo `verify_jwt` como está hoje e
enviando junto todos os arquivos que a função usa (`index.ts` mais o que ela
importa de `_shared`, com o caminho achatado para `./_shared/...`).

- [ ] **Passo 4: provar que a coluna é marcada**

Use uma linha DESCARTÁVEL, nunca uma conta real de pessoa. A conta de serviço
`claudecode@rbvcompany.com` serve, e o dono já autorizou usá-la para verificação.

Antes, guarde o valor atual:

```sql
select email, precisa_trocar_senha from profiles where email = 'claudecode@rbvcompany.com';
```

Chame o endpoint trocando a senha dessa conta por uma nova gerada, e confira:

```sql
select email, precisa_trocar_senha from profiles where email = 'claudecode@rbvcompany.com';
```

Esperado: `true`. **Anote a senha nova no relatório** — ela é a senha real dessa
conta a partir de agora, e o `coletor/.env` (`GESTOR_USER_PASSWORD`) precisa ser
atualizado para os robôs continuarem entrando. Atualize o `.env` e diga isso no
relatório.

- [ ] **Passo 5: rodar a suíte e commitar**

```bash
npm test
git add supabase/functions/invite-user/index.ts
git commit -m "senha posta por outra pessoa e provisoria: o reset passa a cobrar a troca"
```

---

### Task 3: A ficha da pessoa, com o vínculo

**Files:**
- Modify: `src/ferramentas/admin/tela-de-admin.vue`
- Modify: `src/ferramentas/admin/imports.test.mjs`

**Interfaces:**
- Consumes: `estadoDoVinculo` (Task 1).
- Produces: `abrirFichaDaPessoa(p)` — recebe a linha de pessoa que
  `loadAdminUsers` já monta (`{ id, nome, email, papel, marca, local, setor,
  temCadastro, bruto }`) e mostra a ficha. As Tasks 4 e 5 penduram seções nela.

- [ ] **Passo 1: importar o módulo e carregar os colaboradores**

```js
import { estadoDoVinculo } from './vinculo-de-cadastro.js'
```

**ANTES DE MAIS NADA, ALARGUE O `select`.** A leitura de `acessos_pessoas` já
existe em `loadAdminUsers`, mas hoje traz só
`profile_id, nome, setor_id, organizacao_id, marca_id` mais os nomes embutidos.
**Faltam três campos sem os quais esta etapa inteira falha em silêncio:**

- `id` — sem ele, ligar o cadastro manda `undefined` e não atualiza nada;
- `email_corporativo` e `conta_apple` — sem eles, `estadoDoVinculo` nunca
  encontra candidato, e a Raíssa continua aparecendo como "sem cadastro".

O `select` passa a ser:

```js
  sbClient.from('acessos_pessoas').select(
    'id,profile_id,nome,email_corporativo,conta_apple,setor_id,organizacao_id,marca_id,'
    + 'acessos_setores(nome),acessos_organizacoes(nome),patrimonio_empresas(nome)'),
```

Guarde a lista inteira num escopo que a ficha alcance — a ficha precisa dos
colaboradores SEM vínculo para poder sugerir:

```js
// A ficha precisa da lista inteira, inclusive de quem ainda não tem login, para
// conseguir sugerir. Guardada aqui para não reler a cada abertura.
let _colaboradores = []
```

Preencha `_colaboradores = pessoas` logo depois da leitura.

- [ ] **Passo 2: a ficha (abrir, fechar, esqueleto)**

Siga o padrão do modal de permissões que já existe no arquivo (`#perm-modal`):
mesma marcação de sobreposição, mesmo fechar por X e por clique fora.

```js
// A FICHA DA PESSOA.
//
// Por que ficha e não edição na linha: são três campos de lotação por pessoa e
// quinze pessoas. Sempre visíveis, no celular vira uma coluna interminável e
// empurra as ações para longe do polegar.
function abrirFichaDaPessoa(p) {
  const fundo = mkEl('div', 'ficha-fundo')
  const caixa = mkEl('div', 'ficha-caixa')
  const fechar = () => fundo.remove()
  fundo.addEventListener('click', (e) => { if (e.target === fundo) fechar() })

  const cab = mkEl('div', 'ficha-cab')
  const titulo = mkEl('div', 'ficha-titulo'); titulo.textContent = p.nome
  const x = mkEl('button', 'ficha-x'); x.type = 'button'; x.textContent = '✕'
  x.setAttribute('aria-label', 'Fechar'); x.addEventListener('click', fechar)
  cab.appendChild(titulo); cab.appendChild(x); caixa.appendChild(cab)

  const corpo = mkEl('div', 'ficha-corpo'); caixa.appendChild(corpo)
  _secaoVinculo(corpo, p, () => { fechar(); loadAdminUsers() })

  fundo.appendChild(caixa)
  document.body.appendChild(fundo)
}
```

- [ ] **Passo 3: a seção de vínculo, com os quatro estados**

```js
// O VÍNCULO VEM PRIMEIRO porque a lotação depende dele: sem cadastro ligado não
// existe onde gravar marca, local e setor.
function _secaoVinculo(alvo, p, aoMudar) {
  const sec = mkEl('div', 'ficha-sec')
  const tit = mkEl('div', 'ficha-sec-tit'); tit.textContent = 'Cadastro de colaborador'
  sec.appendChild(tit)

  const { estado, colaborador } = estadoDoVinculo({ id: p.id, email: p.email }, _colaboradores)
  const txt = mkEl('div', 'ficha-txt')

  if (estado === 'ligado') {
    txt.textContent = 'Ligado a ' + colaborador.nome + '.'
    sec.appendChild(txt)
  } else if (estado === 'sugestao') {
    // `escHtml` (escopo de módulo, ~linha 296) — NÃO existe um `esc` global:
    // o `esc` que aparece no arquivo é uma const LOCAL dentro de outra função.
    txt.innerHTML = 'Achei um cadastro com este e-mail: <b>' + escHtml(colaborador.nome)
      + '</b>. É a mesma pessoa?'
    sec.appendChild(txt)
    const b = mkEl('button', 'sr-btn'); b.type = 'button'; b.textContent = 'Sim, ligar'
    b.style.cssText = 'background:var(--accent);color:#fff'
    b.addEventListener('click', () => _ligarCadastro(b, colaborador.id, p.id, aoMudar))
    sec.appendChild(b)
  } else if (estado === 'ambiguo') {
    // Não oferecemos botão: escolher por conta própria seria chutar qual pessoa
    // recebe a lotação e o histórico.
    txt.textContent = 'Há mais de um cadastro com este e-mail. Resolva em '
      + 'Colaboradores antes de ligar — daqui eu não sei qual é a pessoa certa.'
    sec.appendChild(txt)
  } else {
    txt.textContent = 'Esta pessoa ainda não tem cadastro de colaborador. '
      + 'Sem ele não há onde guardar marca, local e setor.'
    sec.appendChild(txt)
    const b = mkEl('button', 'sr-btn'); b.type = 'button'; b.textContent = 'Criar cadastro'
    b.style.cssText = 'background:var(--accent);color:#fff'
    b.addEventListener('click', () => _criarCadastro(b, p, aoMudar))
    sec.appendChild(b)
  }
  alvo.appendChild(sec)
}
```

- [ ] **Passo 4: ligar e criar, sem silêncio**

```js
async function _ligarCadastro(botao, colaboradorId, profileId, aoMudar) {
  botao.disabled = true; const antes = botao.textContent; botao.textContent = 'Ligando…'
  const { error } = await sbClient.from('acessos_pessoas')
    .update({ profile_id: profileId }).eq('id', colaboradorId)
  if (error) {
    // Falha aqui não pode passar por sucesso: o dono acharia que ligou.
    botao.disabled = false; botao.textContent = antes
    adminToast('Não consegui ligar: ' + error.message, false); return
  }
  adminToast('Ligado.'); aoMudar()
}

async function _criarCadastro(botao, p, aoMudar) {
  botao.disabled = true; const antes = botao.textContent; botao.textContent = 'Criando…'
  // `nome` é a única coluna obrigatória sem valor padrão. Cai para o e-mail
  // quando o login não tem nome — mesma regra que a lista usa para exibir.
  const { error } = await sbClient.from('acessos_pessoas').insert({
    nome: (p.bruto && p.bruto.name) || p.email,
    email_corporativo: p.email,
    profile_id: p.id,
  })
  if (error) {
    botao.disabled = false; botao.textContent = antes
    adminToast('Não consegui criar o cadastro: ' + error.message, false); return
  }
  adminToast('Cadastro criado.'); aoMudar()
}
```

- [ ] **Passo 5: abrir a ficha ao tocar na pessoa**

Em `_criarLinhaPessoa`, ligue o clique no bloco do nome (NÃO na fileira de ações,
senão clicar em "Permissões" abriria a ficha junto):

```js
// O clique no nome abre a ficha; a fileira de ações continua com os atalhos.
info.style.cursor = 'pointer'
info.addEventListener('click', () => abrirFichaDaPessoa(p))
```

- [ ] **Passo 6: CSS da ficha (uma coluna, cabe no celular)**

```css
.tela-admin :deep(.ficha-fundo){position:fixed;inset:0;z-index:99990;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px;}
.tela-admin :deep(.ficha-caixa){background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:14px;width:100%;max-width:420px;max-height:88vh;overflow-y:auto;}
.tela-admin :deep(.ficha-cab){display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--surface);}
.tela-admin :deep(.ficha-titulo){font-weight:700;font-size:14px;overflow-wrap:anywhere;}
.tela-admin :deep(.ficha-x){border:none;background:transparent;color:var(--muted);font-size:18px;cursor:pointer;min-width:40px;min-height:40px;}
.tela-admin :deep(.ficha-corpo){padding:14px 16px;}
.tela-admin :deep(.ficha-sec){padding:12px 0;border-bottom:1px solid var(--border);}
.tela-admin :deep(.ficha-sec:last-child){border-bottom:none;}
.tela-admin :deep(.ficha-sec-tit){font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:8px;}
.tela-admin :deep(.ficha-txt){font-size:12.5px;line-height:1.5;margin-bottom:10px;overflow-wrap:anywhere;}
.tela-admin :deep(.ficha-campo){display:flex;flex-direction:column;gap:4px;margin-bottom:10px;}
.tela-admin :deep(.ficha-campo label){font-size:11px;color:var(--muted);}
.tela-admin :deep(.ficha-campo select){width:100%;min-height:40px;font-size:16px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);padding:0 10px;}
.tela-admin :deep(.ficha-campo select:disabled){opacity:.5;cursor:not-allowed;}
```

Fonte 16px no `select` de propósito: abaixo disso o iOS dá zoom ao focar.

- [ ] **Passo 7: rodar a suíte e conferir na tela**

Rodar: `npm test` (inclui `imports.test.mjs`, que pega `estadoDoVinculo` usado
sem importar).

No navegador (`npm run dev -- --port 5202 --strictPort`, login com a conta de
serviço do `coletor/.env`): abrir a ficha da **Raíssa** e conferir que aparece
"Achei um cadastro com este e-mail: Raissa Herculano". **NÃO clicar em ligar** —
isso é decisão do dono.

- [ ] **Passo 8: commit**

```bash
git add src/ferramentas/admin/tela-de-admin.vue src/ferramentas/admin/imports.test.mjs
git commit -m "ficha da pessoa: ligar ao cadastro que ja existe, ou criar o que falta"
```

---

### Task 4: A lotação editável na ficha

**Files:**
- Modify: `src/ferramentas/admin/tela-de-admin.vue`

**Interfaces:**
- Consumes: `abrirFichaDaPessoa` (Task 3) e o `estadoDoVinculo` já importado.

- [ ] **Passo 1: carregar as três listas**

Em `loadAdminUsers`, junto das outras leituras (todas por `sbClient`):

```js
const [rMarcas, rLocais, rSetores] = await Promise.all([
  sbClient.from('patrimonio_empresas').select('id,nome').order('nome'),
  sbClient.from('acessos_organizacoes').select('id,nome').order('nome'),
  sbClient.from('acessos_setores').select('id,nome').order('nome'),
])
```

Declare no escopo do módulo, ao lado de `_colaboradores` (Task 3):

```js
// As listas das três gavetas, lidas uma vez por carregamento da tela.
let _listasDeLotacao = { marca: [], local: [], setor: [] }
```

E preencha depois da leitura:

```js
if (rMarcas.error || rLocais.error || rSetores.error) {
  // Select vazio pareceria "não há setores cadastrados" — mentira que faz o
  // dono achar que precisa cadastrar de novo.
  adminToast('Não consegui carregar as listas de marca/local/setor: '
    + (rMarcas.error || rLocais.error || rSetores.error).message, false)
} else {
  _listasDeLotacao = { marca: rMarcas.data || [], local: rLocais.data || [], setor: rSetores.data || [] }
}
```

- [ ] **Passo 2: a seção, com os campos travados quando não há cadastro**

```js
// A LOTAÇÃO MORA NO CADASTRO DE COLABORADOR. Sem cadastro ligado não existe
// onde gravar — por isso os campos ficam travados COM O MOTIVO ESCRITO, em vez
// de aceitarem valor e jogarem fora.
//
// `organizacao_id` é o LOCAL. O nome da coluna é histórico; o conteúdo é lugar
// (Sede Centro, Sede Village, Fábrica Conchal).
const CAMPOS_DE_LOTACAO = [
  { chave: 'marca', rotulo: 'Marca', coluna: 'marca_id' },
  { chave: 'local', rotulo: 'Local', coluna: 'organizacao_id' },
  { chave: 'setor', rotulo: 'Setor', coluna: 'setor_id' },
]

function _secaoLotacao(alvo, p, colaborador) {
  const sec = mkEl('div', 'ficha-sec')
  const tit = mkEl('div', 'ficha-sec-tit'); tit.textContent = 'Lotação'
  sec.appendChild(tit)

  if (!colaborador) {
    const aviso = mkEl('div', 'ficha-txt')
    aviso.textContent = 'Ligue ou crie o cadastro de colaborador acima para poder preencher.'
    sec.appendChild(aviso)
  }

  for (const campo of CAMPOS_DE_LOTACAO) {
    const linha = mkEl('div', 'ficha-campo')
    const lbl = mkEl('label'); lbl.textContent = campo.rotulo
    const sel = mkEl('select')
    sel.disabled = !colaborador
    const vazio = document.createElement('option')
    vazio.value = ''; vazio.textContent = '— não informado —'
    sel.appendChild(vazio)
    for (const item of (_listasDeLotacao[campo.chave] || [])) {
      const o = document.createElement('option')
      o.value = item.id; o.textContent = item.nome
      if (colaborador && String(colaborador[campo.coluna]) === String(item.id)) o.selected = true
      sel.appendChild(o)
    }
    // Guardar o valor de partida ANTES de ligar o evento: é para onde o campo
    // volta se a gravação falhar.
    sel.dataset.valorAnterior = sel.value
    if (colaborador) sel.addEventListener('change', () => _gravarLotacao(sel, colaborador.id, campo.coluna))
    linha.appendChild(lbl); linha.appendChild(sel); sec.appendChild(linha)
  }
  alvo.appendChild(sec)
}

async function _gravarLotacao(sel, colaboradorId, coluna) {
  const antes = sel.dataset.valorAnterior || ''
  sel.disabled = true
  const { error } = await sbClient.from('acessos_pessoas')
    .update({ [coluna]: sel.value || null }).eq('id', colaboradorId)
  sel.disabled = false
  if (error) {
    // Volta ao que era: campo que parece salvo e não salvou é pior que erro.
    sel.value = antes
    adminToast('Não consegui salvar: ' + error.message, false); return
  }
  sel.dataset.valorAnterior = sel.value
  adminToast('Salvo.')
}
```

Guarde o valor inicial em `sel.dataset.valorAnterior` logo após montar o select.

- [ ] **Passo 3: pendurar a seção na ficha**

Em `abrirFichaDaPessoa`, depois de `_secaoVinculo`:

```js
const vinculo = estadoDoVinculo({ id: p.id, email: p.email }, _colaboradores)
_secaoLotacao(corpo, p, vinculo.estado === 'ligado' ? vinculo.colaborador : null)
```

- [ ] **Passo 4: rodar a suíte e conferir contra o banco**

Rodar: `npm test`

No navegador, abrir a ficha de alguém **já ligado** (ex.: Larissa Sousa), trocar
o Setor e conferir:

```sql
select p.nome, s.nome as setor from acessos_pessoas p
left join acessos_setores s on s.id = p.setor_id
where p.nome ilike '%larissa%';
```

Esperado: o setor que você escolheu. **Devolva ao valor original depois** — é
cadastro real.

- [ ] **Passo 5: commit**

```bash
git add src/ferramentas/admin/tela-de-admin.vue
git commit -m "lotacao editavel na ficha, travada enquanto nao ha cadastro ligado"
```

---

### Task 5: A senha com copiar

**Files:**
- Modify: `src/ferramentas/admin/tela-de-admin.vue`

**Interfaces:**
- Consumes: a edge function da Task 2 (que agora marca a cobrança) e
  `abrirFichaDaPessoa` (Task 3).

- [ ] **Passo 1: o copiar com plano B**

`navigator.clipboard` falha em contexto sem HTTPS e quando a permissão é negada.
Falhar calado aqui faz o dono mandar uma senha que ele não copiou.

```js
// Copiar com plano B — mesmo padrão que a tela de Acessos já usa.
function _copiar(texto, aoConseguir) {
  const plano2 = () => {
    try {
      const ta = document.createElement('textarea')
      ta.value = texto; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.focus(); ta.select()
      document.execCommand('copy'); ta.remove(); return true
    } catch (e) { return false }
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto)
      .then(() => aoConseguir(true))
      .catch(() => aoConseguir(plano2()))
  } else { aoConseguir(plano2()) }
}
```

- [ ] **Passo 2: a seção de senha na ficha**

```js
// A SENHA CONTINUA NA TELA DEPOIS DE SALVA, até fechar a ficha.
//
// Antes ela sumia e o aviso era "anote". O botão de copiar chegaria tarde: a
// senha já teria ido embora.
function _secaoSenha(alvo, p) {
  const sec = mkEl('div', 'ficha-sec')
  const tit = mkEl('div', 'ficha-sec-tit'); tit.textContent = 'Senha'
  sec.appendChild(tit)

  const txt = mkEl('div', 'ficha-txt')
  txt.textContent = 'Gere uma senha, copie e mande para a pessoa. '
    + 'Ela vai ser obrigada a trocar por uma dela no primeiro acesso.'
  sec.appendChild(txt)

  const inp = mkEl('input', 'admin-form-input'); inp.type = 'text'
  inp.placeholder = 'clique em Gerar'
  inp.style.cssText = 'width:100%;font-family:var(--fonte-dados);font-size:16px;margin-bottom:8px'
  sec.appendChild(inp)

  const acoes = mkEl('div'); acoes.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px'
  const gerar = mkEl('button', 'sr-btn'); gerar.type = 'button'; gerar.textContent = 'Gerar'
  gerar.addEventListener('click', () => { inp.value = gerarSenhaForte(14); inp.focus(); inp.select() })

  const copiar = mkEl('button', 'sr-btn'); copiar.type = 'button'; copiar.textContent = 'Copiar'
  copiar.addEventListener('click', () => {
    if (!inp.value) { adminToast('Gere uma senha primeiro.', false); return }
    _copiar(inp.value, (ok) => adminToast(ok ? 'Senha copiada.' : 'Não consegui copiar — selecione e copie à mão.', ok))
  })

  const salvar = mkEl('button', 'sr-btn'); salvar.type = 'button'; salvar.textContent = 'Salvar senha'
  salvar.style.cssText = 'background:var(--accent);color:#fff'
  salvar.addEventListener('click', () => _salvarSenha(salvar, inp, p))

  acoes.appendChild(gerar); acoes.appendChild(copiar); acoes.appendChild(salvar)
  sec.appendChild(acoes)
  alvo.appendChild(sec)
}

async function _salvarSenha(botao, inp, p) {
  const pw = String(inp.value || '').trim()
  if (pw.length < 6) { adminToast('A senha precisa de no mínimo 6 caracteres.', false); return }
  botao.disabled = true; botao.textContent = 'Salvando…'
  try {
    const { data: { session: s } } = await sbClient.auth.getSession()
    const r = await fetch(`${SUPABASE_URL}/functions/v1/invite-user`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${s?.access_token || SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetPasswordUserId: p.id, password: pw }),
    })
    const res = await r.json()
    if (res.error) throw new Error(res.error)
    botao.textContent = 'Salva'
    // A senha FICA no campo: é ela que o dono vai copiar e mandar.
    adminToast('Senha trocada. Copie e mande para a pessoa.')
  } catch (e) {
    botao.disabled = false; botao.textContent = 'Salvar senha'
    adminToast('Não consegui trocar a senha: ' + e.message, false)
  }
}
```

- [ ] **Passo 3: pendurar na ficha e tirar o atalho antigo**

Em `abrirFichaDaPessoa`, depois da lotação: `_secaoSenha(corpo, p)`.

O botão "Trocar senha" da linha da lista sai — a senha agora vive na ficha, e dois
caminhos para a mesma coisa é o começo de dois comportamentos diferentes.
Apague também `_abrirTrocaSenha` e o CSS `.sr-pwform` se ficarem sem chamador
(confirme com `grep` antes de apagar).

- [ ] **Passo 4: rodar a suíte e provar o ciclo inteiro**

Rodar: `npm test`

No navegador, na ficha da conta de serviço `claudecode@rbvcompany.com` (nunca de
uma pessoa): Gerar → Copiar → Salvar. Depois:

```sql
select email, precisa_trocar_senha from profiles where email = 'claudecode@rbvcompany.com';
```

Esperado: `true` — é a prova de que o ciclo fecha.

**Atualize `GESTOR_USER_PASSWORD` no `coletor/.env`** com a senha nova, senão os
robôs param de entrar. Diga no relatório que fez isso.

- [ ] **Passo 5: commit**

```bash
git add src/ferramentas/admin/tela-de-admin.vue
git commit -m "senha na ficha: gerar, copiar e continuar na tela ate voce fechar"
```

---

## Ao terminar

- [ ] `npm test` inteiro passando e `npm run build` sem erro
- [ ] Medir a ficha a 375px: sem rolagem horizontal, alvo de toque ≥ 40px,
      `select` com fonte 16px, nada cortando
- [ ] Conferir com o dono: a sugestão da Raíssa aparece (sem clicar em ligar) e a
      lotação de quem tem cadastro salva
- [ ] Só então `git push`

## Fora deste plano

- Ligar a Raíssa (decisão do dono, pela tela) e criar o cadastro do Cristian.
- O "Marcar tudo" das permissões, que concede criar+excluir de uma vez.
- `equipes`, `equipes_membros` e `bling_lojas` ainda lidos com `sb()`.
- Unificar `acessos_organizacoes` × `patrimonio_locais`.
