# Controle de Acessos — Plano 2 (v2): Setores · Colaboradores · Dispositivos×Veículos · Termos-upload · Design

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Reformular a base manual: abertura em **cards de setores** (add/excluir), **Colaborador** com campos de RH, **Dispositivos** e **Veículos** em cards separados com **campos dinâmicos por tipo**, **Termo** só por **upload (vários)**, **Auditoria** adaptada, e um **design bem mais rico** (gradientes, hover/elevação, transições, badges, animação de entrada).

**Architecture:** Mesmo single-file `index.html` (= `projetos/central-inteligencia/central-inteligencia-v1.3.html`, byte-a-byte). Supabase `kounqtdoioootxqegkij`, cliente `sbClient`, RLS por `is_acessos_admin()`. Tabelas v1 estão **vazias** → schema refeito sem migração de dados. Storage bucket `acessos-termos` reaproveitado p/ os uploads.

**Tech Stack:** HTML/CSS/JS vanilla, supabase-js, Postgres+RLS+Storage.

---

## Convenções (LER)
- Sem framework de testes: verificação = **syntax check** (node one-liner) + **SQL** (Supabase MCP) + **smoke manual**.
- **Sync obrigatório:** editar `index.html` → `cp` por cima de `projetos/central-inteligencia/central-inteligencia-v1.3.html`. Nunca `git add -A` (há untracked alheios) — só os 2 HTML (e os .sql nas tasks de banco).
- Commit trailer EXATO: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **XSS:** todo valor do banco em innerHTML passa por `_acEsc(...)`.
- `confirm()` nativo é a convenção do iamundi (mantém).
- Syntax check:
  ```bash
  node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/g)||[];let ok=true;m.forEach((s,i)=>{const c=s.replace(/^<script>/,'').replace(/<\/script>$/,'');if(!c.trim())return;try{new Function(c);}catch(e){ok=false;console.log('ERRO',i,e.message);}});console.log(ok?'SINTAXE OK':'SINTAXE FALHOU');"
  ```

## O que muda vs v1 (já no ar)
- **Some:** a aba "Modelo do termo" e toda a geração/impressão de termo (`_acTermoHtml`, `_acGerarTermo`, `_acImprimirTermo`, `_acUploadAssinado` no formato antigo, `_acEncerrarTermo`, `AC_TST`, `_acTstMeta`, `_acRenderConfig`, `_acSaveConfig`). A tabela `acessos_config` fica órfã (não dropar; só parar de usar).
- **Vira:** Pessoas → **Colaboradores**; landing → **Setores**; dispositivos ganham **categoria + campos dinâmicos**; termos → **upload simples (vários)**.

## Modelo de dados v2 (migration 004)
- **`acessos_setores`** (novo): `id uuid pk default gen_random_uuid() · nome text not null unique · cor text · ordem int not null default 0 · criado_em timestamptz default now()`. RLS `_rw` igual às outras (using/with_check `is_acessos_admin()`). Seed: Diretoria, Administrativo, RH, Marketing, Comercial, TI/Operações.
- **`acessos_pessoas`** (rótulo UI "Colaborador"): manter `id,nome,cargo,criado_em,atualizado_em`; **status** vira check `('ativo','desligado')` default 'ativo'; **dropar** `email_pessoal`, `apple_id`; **adicionar** `setor_id uuid references acessos_setores(id) on delete set null · email_corporativo text · numero_pessoal text · numero_corporativo text · data_inicio_contrato date · data_fim_contrato date · motivo_saida text`.
- **`acessos_dispositivos`**: **adicionar** `categoria text not null default 'dispositivo' check (categoria in ('dispositivo','veiculo'))` e `detalhes jsonb not null default '{}'`; **remover o CHECK rígido de `tipo`** (tipo passa a texto livre validado no front); manter `descricao,status,desde,observacao,atualizado_em` (status segue `em_uso/a_devolver/devolvido/perdido`).
- **`acessos_termos`**: **recriar** simples (drop + create) = documento enviado: `id uuid pk · pessoa_id uuid references acessos_pessoas(id) on delete cascade · titulo text · arquivo_path text not null · enviado_em timestamptz default now() · observacao text`. Re-adicionar a policy `_rw`. (Some `dispositivo_ids/status/pdf_path/...`.)

## Constantes de front (definir uma vez)
```js
const AC_DEV_TIPOS=[['celular','Celular'],['smartphone','Smartphone'],['notebook','Notebook'],['macbook','MacBook'],['desktop','Desktop'],['monitor','Monitor'],['tablet','Tablet'],['numero','Número/Linha'],['chip','Chip/eSIM'],['acessorio','Acessório'],['outro','Outro']];
const AC_VEI_TIPOS=[['carro','Carro'],['moto','Moto'],['caminhonete','Caminhonete'],['outro','Outro']];
const AC_COMB=['Gasolina','Etanol','Flex','Diesel','Elétrico','Híbrido','GNV'];
// campos extra (jsonb detalhes) por tipo; cada campo = [key,label]
const AC_FIELDDEFS={
  celular:[['modelo','Modelo'],['imei','IMEI'],['cor','Cor']],
  smartphone:[['modelo','Modelo'],['imei','IMEI'],['cor','Cor']],
  notebook:[['modelo','Modelo'],['serial','Nº de série'],['so','Sistema']],
  macbook:[['modelo','Modelo'],['serial','Nº de série']],
  desktop:[['modelo','Modelo'],['serial','Nº de série']],
  monitor:[['modelo','Modelo'],['serial','Nº de série'],['polegadas','Polegadas']],
  tablet:[['modelo','Modelo'],['serial','Nº de série'],['imei','IMEI']],
  numero:[['numero','Número'],['operadora','Operadora'],['plano','Plano']],
  chip:[['numero','Número'],['operadora','Operadora'],['iccid','ICCID']],
  acessorio:[['modelo','Modelo']],
  carro:[['modelo','Modelo'],['ano','Ano'],['placa','Placa'],['combustivel','Combustível'],['renavam','RENAVAM'],['cor','Cor']],
  moto:[['modelo','Modelo'],['ano','Ano'],['placa','Placa'],['combustivel','Combustível']],
  caminhonete:[['modelo','Modelo'],['ano','Ano'],['placa','Placa'],['combustivel','Combustível'],['renavam','RENAVAM']],
  outro:[]
};
function _acFieldsFor(tipo){return AC_FIELDDEFS[tipo]||[];}
```
Regra de form: cada campo de `_acFieldsFor(tipo)` vira um input; se `key==='combustivel'`, renderiza `<select>` com `AC_COMB`; senão input texto/numérico. Valores guardados em `detalhes` (jsonb).

## Navegação v2
- Top bar com 2 abas: **Setores** (default) e **Auditoria**. (Tira "Modelo do termo".)
- `_acTab='setores'` default. Estado: `_acData={setores:[],colaboradores:[],config:null→remover}`, `_acSelSetor`, `_acSel` (colaborador).
- **Setores** → `_acRenderSetores()`: grid de cards (um por setor + card "Sem setor") com **badge de contagem** de colaboradores, hover com elevação, animação de entrada; botão **"+ Novo setor"**; cada card tem **excluir** (x no hover; confirm; ao excluir, colaboradores ficam com `setor_id=null`).
- Clicar num setor → `_acSelSetor=id` → `_acRenderColaboradores(setorId)`: lista os colaboradores do setor (ativos em destaque; desligados com badge), "+ Novo colaborador", voltar p/ Setores.
- Clicar colaborador → `_acSel=id` → `_acRenderFicha(id)`: dados do colaborador + ações **Editar** / **Desligar** (se ativo) ou **Reativar** (se desligado) + 3 cards: **Dispositivos**, **Veículos**, **Termos**.

## Design (caprichado e fluido — aplicar no CSS `.ac-*`)
- Variáveis de cor/realce (gradiente teal já usado). Cards com `border-radius:14-16px`, sombra suave, **hover: translateY(-2px)+sombra**; transição `.18s`.
- **Animação de entrada** dos cards: `@keyframes acFadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}` aplicada com pequeno stagger por `animation-delay` (via index inline).
- **Badges**: contagem (setor), status (pílulas com cor por estado), categoria/tipo (chip com ícone SVG inline). Pílulas: ativo=teal, desligado=cinza/vermelho, em_uso=teal, a_devolver=âmbar, devolvido=neutro, perdido=vermelho.
- Botões com hover (brilho/realce), foco acessível. Topbar com leve blur/sticky. Ícones SVG inline por tipo (celular, notebook, número, carro…) — sem emoji.
- Responsivo (grid colapsa no mobile; já há media query base).

---

### Task 1: Migration 004 — schema v2
**Files:** Create `db/migrations-acessos/004_v2.sql`; apply via Supabase MCP `apply_migration` name `acessos_v2`.
- [ ] **Step 1 — SQL** (escrever exatamente):
```sql
-- setores
create table if not exists public.acessos_setores(
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  cor text,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);
alter table public.acessos_setores enable row level security;
drop policy if exists acessos_setores_rw on public.acessos_setores;
create policy acessos_setores_rw on public.acessos_setores for all to authenticated
  using (public.is_acessos_admin()) with check (public.is_acessos_admin());
insert into public.acessos_setores(nome,ordem) values
  ('Diretoria',1),('Administrativo',2),('RH',3),('Marketing',4),('Comercial',5),('TI / Operações',6)
on conflict (nome) do nothing;

-- colaboradores (acessos_pessoas)
alter table public.acessos_pessoas drop column if exists email_pessoal;
alter table public.acessos_pessoas drop column if exists apple_id;
alter table public.acessos_pessoas add column if not exists setor_id uuid references public.acessos_setores(id) on delete set null;
alter table public.acessos_pessoas add column if not exists email_corporativo text;
alter table public.acessos_pessoas add column if not exists numero_pessoal text;
alter table public.acessos_pessoas add column if not exists numero_corporativo text;
alter table public.acessos_pessoas add column if not exists data_inicio_contrato date;
alter table public.acessos_pessoas add column if not exists data_fim_contrato date;
alter table public.acessos_pessoas add column if not exists motivo_saida text;
alter table public.acessos_pessoas drop constraint if exists acessos_pessoas_status_check;
update public.acessos_pessoas set status='desligado' where status='inativo';
alter table public.acessos_pessoas add constraint acessos_pessoas_status_check check (status in ('ativo','desligado'));
create index if not exists idx_acessos_pessoas_setor on public.acessos_pessoas(setor_id);

-- dispositivos: categoria + detalhes + tipo livre
alter table public.acessos_dispositivos add column if not exists categoria text not null default 'dispositivo';
alter table public.acessos_dispositivos drop constraint if exists acessos_dispositivos_categoria_check;
alter table public.acessos_dispositivos add constraint acessos_dispositivos_categoria_check check (categoria in ('dispositivo','veiculo'));
alter table public.acessos_dispositivos add column if not exists detalhes jsonb not null default '{}'::jsonb;
alter table public.acessos_dispositivos drop constraint if exists acessos_dispositivos_tipo_check;

-- termos: recriar como documentos enviados
drop table if exists public.acessos_termos cascade;
create table public.acessos_termos(
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.acessos_pessoas(id) on delete cascade,
  titulo text,
  arquivo_path text not null,
  enviado_em timestamptz not null default now(),
  observacao text
);
alter table public.acessos_termos enable row level security;
drop policy if exists acessos_termos_rw on public.acessos_termos;
create policy acessos_termos_rw on public.acessos_termos for all to authenticated
  using (public.is_acessos_admin()) with check (public.is_acessos_admin());
create index if not exists idx_acessos_termos_pessoa on public.acessos_termos(pessoa_id);
```
- [ ] **Step 2 — Apply** via MCP `apply_migration` (`acessos_v2`).
- [ ] **Step 3 — Verify** (`execute_sql`): listar colunas de `acessos_pessoas`, `acessos_dispositivos`; confirmar `acessos_setores` com 6 seeds; confirmar `acessos_termos` recriada com `arquivo_path`; confirmar policies `_rw` presentes em setores e termos; rodar `get_advisors security` (sem RLS-disabled novo).
- [ ] **Step 4 — Commit** só `db/migrations-acessos/004_v2.sql`.

### Task 2: Design overhaul (CSS) + landing Setores + navegação
**Files:** Modify `index.html` (bloco CSS `.ac-*` e o JS do módulo).
- [ ] Reescrever/expandir o CSS `.ac-*` conforme a seção **Design**: keyframe `acFadeUp`, hover/elevação em `.ac-card`/novos `.ac-setor-card`/`.ac-tile`, badges (`.ac-badge`, `.ac-count`), pílulas de status (ativo/desligado/em_uso/a_devolver/devolvido/perdido), topbar sticky com blur, botões com hover. Manter responsivo.
- [ ] Trocar as abas: remover "Modelo do termo"; deixar **Setores** e **Auditoria**. Ajustar `_acSetTab`/`_acRender` (default `setores`; `_acSel`/`_acSelSetor` zerados ao trocar aba).
- [ ] `loadAcessos()`: carregar `acessos_setores` (order ordem,nome) + `acessos_pessoas` (com `setor_id,status`) em paralelo p/ `_acData.setores`/`_acData.colaboradores`. Remover uso de `acessos_config`.
- [ ] `_acRender()`: `config`→remover; rotas: `auditoria`→`_acRenderAuditoria`; senão `_acSel`→ficha; senão `_acSelSetor`→`_acRenderColaboradores`; senão `_acRenderSetores`.
- [ ] `_acRenderSetores()`: grid de cards animados (stagger por index), cada um com nome, **badge de contagem** (colaboradores ativos do setor), ícone, hover elevação, botão excluir (x) com `confirm` → `_acDelSetor(id)` (colaboradores viram setor_id null); card "Sem setor" (colaboradores com setor_id null); botão **"+ Novo setor"** → `_acAddSetor()` (prompt/modal simples nome → insert). Clicar card → `_acOpenSetor(id|null)`.
- [ ] Funções: `_acAddSetor`, `_acDelSetor`, `_acOpenSetor(setorId)` (`_acSelSetor=setorId; _acSel=null; _acRender()`), `_acLog` em add/del setor. Syntax check + sync + commit.

### Task 3: Colaboradores (lista + ficha + form com campos RH + Desligar)
**Files:** Modify `index.html`.
- [ ] `_acRenderColaboradores(setorId)`: botão voltar (Setores), título do setor, "+ Novo colaborador"; lista de colaboradores do setor (`setor_id===setorId`, ou `setor_id==null` quando setorId null), com nome, cargo, pílula status (ativo/desligado), e contagem de itens/termos opcional; clicar abre ficha.
- [ ] `_acFormColaborador(id)`: campos **nome completo, cargo, setor (select de `_acData.setores`), e-mail corporativo, número pessoal, número corporativo, data de início de contrato**. Salvar→`_acSaveColaborador`. (Escapar todos os values com `_acEsc`.)
- [ ] `_acSaveColaborador(id)`: valida nome; insert/update em `acessos_pessoas` (guardar `const isEdit=!!id` ANTES de reatribuir id — não repetir o bug v1); log; reabrir ficha.
- [ ] `_acRenderFicha(id)`: cabeçalho com nome + pílula status + (se desligado) motivo/data fim; dados (cargo, setor, e-mails, números, datas); ações **Editar**, **Desligar** (se ativo) / **Reativar** (se desligado); 3 wrappers `#ac-disp-wrap`, `#ac-vei-wrap`, `#ac-termos-wrap` + chamadas guardadas `if(window._acRenderDispositivos)…`, `…_acRenderVeiculos`, `…_acRenderTermos`.
- [ ] **Desligar**: `_acDesligar(id)` abre **modal** (overlay `.ac-modal`) pedindo **motivo** (textarea, obrigatório) + **data de fim de contrato** (date, default hoje) → confirma → update `{status:'desligado', motivo_saida, data_fim_contrato, atualizado_em}` + log; **Reativar**: `_acReativar(id)` confirm → `{status:'ativo', motivo_saida:null, data_fim_contrato:null}` + log. Syntax + sync + commit.

### Task 4: Dispositivos (campos dinâmicos por tipo) + Veículos (card separado)
**Files:** Modify `index.html`. Define `AC_DEV_TIPOS/AC_VEI_TIPOS/AC_COMB/AC_FIELDDEFS/_acFieldsFor` (uma vez).
- [ ] `_acRenderItens(pessoaId, categoria, wrapId, titulo, tipos)` genérico: lista `acessos_dispositivos` where `pessoa_id` e `categoria`, mostra descricao + tipo (label) + pílula status (select p/ trocar status) + resumo dos `detalhes` (chips) + Editar/Excluir + "+ Adicionar". Reusar p/ os dois cards.
- [ ] `_acRenderDispositivos(pessoaId)` = chama o genérico com `categoria='dispositivo'`, wrap `#ac-disp-wrap`, tipos `AC_DEV_TIPOS`. `_acRenderVeiculos(pessoaId)` = `categoria='veiculo'`, wrap `#ac-vei-wrap`, tipos `AC_VEI_TIPOS`.
- [ ] `_acFormItem(pessoaId,categoria,tipos,id)`: form único com dedupe (`#ac-item-form`, remove antes de prepend); seletor de **tipo** (dos `tipos`); ao trocar tipo, **re-renderiza os campos dinâmicos** de `_acFieldsFor(tipo)` (campo `combustivel`→`<select>` `AC_COMB`); campos fixos: descricao (rótulo/identificação), desde (date), observacao. Edição carrega `detalhes`.
- [ ] `_acSaveItem(pessoaId,categoria,id)`: monta `rec={pessoa_id,categoria,tipo,descricao,desde,observacao,detalhes:{...campos dinâmicos...},atualizado_em}`; descricao obrigatória; insert/update; log (`item.criar/editar`, detalhe=tipo); re-render do card certo.
- [ ] `_acSetItemStatus`, `_acDelItem` (confirm) — re-render do card. Status: AC_DST (em_uso/a_devolver/devolvido/perdido). Pílula `devolvido` neutra (classe sem fallback 'warn'). Syntax + sync + commit.

### Task 5: Termos = upload de documentos (vários)
**Files:** Modify `index.html`.
- [ ] `_acRenderTermos(pessoaId)`: card "Termos / documentos" com botão **"+ Enviar documento"** (file input) e lista dos termos do colaborador (titulo + data + observacao) com **Baixar** (URL assinada 120s) e **Excluir**.
- [ ] `_acUploadTermo(pessoaId, file)`: aceita PDF/imagem; gera `id`/path `pessoaId+'/'+crypto-ish` — usar: inserir row primeiro `{pessoa_id, titulo:file.name}` → obter id → upload em `acessos-termos` path `pessoaId+'/'+id+'-'+nomeSanitizado` (sanitizar) → update `arquivo_path` (se upload falhar, deletar row órfã; checar erro do update) → log. Opcional: pedir título via prompt (senão usa nome do arquivo).
- [ ] `_acDownloadTermo(termoId)`: select arquivo_path → `createSignedUrl(...,120)` → `window.open`. `_acDelTermo(termoId,pessoaId)`: confirm → `storage.remove([arquivo_path])` + delete row + log + re-render. Syntax + sync + commit.

### Task 6: Auditoria adaptada + remoção do código morto v1
**Files:** Modify `index.html`.
- [ ] Atualizar `_acRenderAuditoria()` ao modelo v2: divergências = (1) **colaborador desligado** ainda com dispositivo/veículo `em_uso` ou `a_devolver`; (2) colaborador **ativo sem nenhum termo** enviado (aviso brando). "Quem tem o quê" agrupado por **setor**, com dispositivos+veículos e contagem de termos. Tudo escapado.
- [ ] **Remover o código morto da v1**: funções/constantes não mais usadas — `_acTermoHtml`, `_acGerarTermo`, `_acImprimirTermo`, `_acEncerrarTermo`, `AC_TST`, `_acTstMeta`, `_acRenderConfig`, `_acSaveConfig`, e o `_acUploadAssinado` antigo (se a Task 5 criou novo fluxo, garantir nome único/sem duplicado). Remover a aba/markup "Modelo do termo". Garantir `grep` sem referências órfãs. Syntax + sync + commit.

### Task 7: Verificação + deploy
- [ ] `cmp` arquivos idênticos; syntax OK; `get_advisors security` limpo p/ `acessos_*`.
- [ ] Auditoria de funções: cada `_ac*` referenciada definida exatamente 1x (sem 0 nem >1).
- [ ] Smoke manual (após deploy): criar setor, criar colaborador, add celular (campos IMEI/modelo) + número (operadora/plano) + carro (ano/combustível/placa), enviar 2 termos e baixar/excluir um, desligar colaborador (motivo+data fim), ver auditoria, excluir setor.
- [ ] **Deploy** `git push origin main` **somente com OK do dono**; validar `home-card-acessos`/novo módulo no ar.

## Self-review (rodado vs pedido do usuário)
- Cards de setores + add/excluir → Task 2 ✔
- Colaborador (nome completo, cargo, setor, email corp., nº pessoal, nº corp., início contrato) → Task 3 ✔; desligar com motivo + fim de contrato (modal) → Task 3 ✔ (estado único 'desligado').
- Dispositivos × Veículos separados, campos por tipo (celular: imei/modelo; número: operadora/plano; carro: ano/combustível/…) → Task 4 ✔.
- Termo só upload, vários por colaborador → Task 5 ✔.
- Auditoria mantida/adaptada → Task 6 ✔.
- Design mais rico (efeitos/animações/badges) → Task 2 (CSS) aplicado em todas as telas ✔.
- Consistência de nomes/enums: status colaborador `ativo/desligado`; item status `em_uso/a_devolver/devolvido/perdido`; categoria `dispositivo/veiculo`; jsonb `detalhes`. Bug v1 do `isEdit` não repetir (Task 3/4).
