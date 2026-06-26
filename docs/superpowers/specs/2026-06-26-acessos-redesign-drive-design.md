# Colaboradores e Acessos — Redesign "de ponta" + Aba Drive — Design

**Data:** 2026-06-26 · **Módulo:** `acessos` (index.html, prefixo `_ac*`/`.ac-*`)
**Origem:** pedido do dono ("ajustes em massa"), validação pós-pronto (sem loop de aprovação).

## Objetivo
Elevar o design da ferramenta inteira a um nível "de ponta", responsivo de verdade em
todos os dispositivos (hoje o mobile está quebrado), e adicionar uma aba **Drive** com visão
panorâmica/explodida das pastas por marca×setor, compartilhamento direto com multi-seleção de
colaboradores, e modelos de acesso padrão.

## Fases (cada uma deployada e validável isoladamente)

### Fase 1 — Design system + telas existentes
- **Design system** coeso (tokens de tipografia/cor/espaçamento/raio/sombra/foco) aplicado a TODAS
  as `.ac-*`, com **breakpoints mobile reais** (a tabela/cards não estouram; toques ≥44px; sem zoom).
  Mantém a paleta atual (Playfair/Oswald/IBM Plex, accent teal `#0d9488`) mas corrige hierarquia,
  densidade, contraste e estados (hover/active/focus/disabled).
- **Abertura (aba Organizações):** botão **"+ Novo colaborador"** em destaque já na tela (abre o form
  direto, com Organização/Setor escolhíveis), mantém **"+ Nova organização"**, e mostra cada
  organização **expandida**: card da org → seus setores → contagem + **prévia dos nomes** dos
  colaboradores (avatares/empilhados), com "ver todos". Acordeão por org (abre/fecha).
- **Ficha do colaborador:** redesenho forte — cabeçalho com avatar grande, nome (Playfair), cargo,
  org·setor, status; blocos claros de **Contas** (Zoho/Outlook/Apple com logo+estado), **Contato**
  (celulares), **Contrato** (datas); ações (Editar/Provisionar/Desligar/Trocar foto/Excluir) numa
  barra coerente; seções de Dispositivos/Veículos/Termos com cards padronizados. Tudo responsivo.
- **Auditoria:** refazer cards (grid panorâmico legível) e a **visão de lista** (hoje horrível no
  mobile) — no celular vira cartões empilhados, não tabela espremida; toggle cards/lista mantido.
- **Configurações:** passa a ser **só Conexões + status de saúde** (Zoho/Microsoft/iCloud:
  conectado?, desde quando, botão reconectar/testar). O "gerenciar pastas" do OneDrive/iCloud SAI
  daqui e vai pra aba Drive.

### Fase 2 — Aba Drive (novo item no menu: Organizações · Drive · Auditoria · ⚙️)
- **Marcas-raiz** configuráveis (começa com **"21. RBV & Company"** e **"Moto Easy Brasil"**); seletor
  fluido pra alternar entre marcas ("explode" a marca selecionada).
- **Descoberta automática:** lê via Graph as pastas do 1º nível da marca (proxy novo `microsoft.tree`),
  e **classifica por setor** via palavra-chave no nome (mapa editável): Financeiro, RH, Marketing,
  Contabilidade/Fiscal, Comercial/Contratos, Operações/Documentos, Diretoria, DRE, Outros.
- **Panorama setor×marca:** módulos por setor mostrando as pastas daquela marca naquele setor;
  drill-down navegando a árvore (subpastas) sob demanda.
- **Compartilhar dali mesmo:** em qualquer pasta, painel de compartilhamento com **multi-seleção de
  colaboradores** (puxar vários de uma vez → aplica `microsoft.share` em lote por email_outlook +
  papel), além de ver/remover acessos atuais.
- Reaproveita `acessos_recursos` (pastas sob controle) + ações `microsoft.*` já existentes; adiciona
  `microsoft.tree` (navegação em árvore com classificação) e `microsoft.shareMany` (lote).

### Fase 3 — Modelos de acesso
- Aba/painel no Drive pra criar **padrões**: nome + setor + lista de pastas (ex.: RH → x,y,z).
- Nova tabela `acessos_modelos_acesso` (id, nome, setor, descricao) + `acessos_modelo_pastas`
  (modelo_id, recurso_id|external_id, papel). RLS admin.
- Ao **Provisionar** (onboarding) ou no Drive, aplicar um modelo num clique → compartilha todas as
  pastas do modelo pro(s) colaborador(es).

## Design system (tokens)
- **Tipografia:** Playfair Display (títulos/nomes), Oswald (rótulos de seção/uppercase), IBM Plex Sans
  (corpo/labels/números tabulares). Escala fluida com `clamp()`.
- **Cor:** usa variáveis de tema do app (`--surface/--surface2/--border/--text/--muted/--shadow-*`),
  accent teal `#0d9488` (+ `--accent-mid`). Funciona em claro e escuro.
- **Espaçamento/raio/sombra:** grid de 4px; raios 8/12/16; sombras `--shadow-sm/md/lg`.
- **Componentes padronizados:** `.ac-btn` (primary/ghost/danger, ≥44px no mobile), `.ac-card`,
  `.ac-pill` (ok/warn/bad/neutral), `.ac-chip`, `.ac-modal`, `.ac-input/.ac-select`, `.ac-tab`.
- **Responsivo:** breakpoint ~640px → grids viram 1 coluna, ações empilham/viram barra rolável,
  fontes reduzem via clamp, listas viram cartões. Sem overflow horizontal. `maximum-scale=1` já está.

## Não-objetivos / restrições
- Front é público — nada de segredo no client (tokens só no service-role `acessos_conexoes`).
- Nunca interpolar nome livre em `onclick` (XSS) — usar `_acEsc` em texto e `data-*`+addEventListener.
- `index.html` é cópia byte-a-byte de `projetos/central-inteligencia/central-inteligencia-v1.3.html`
  (cp após editar); deploy via `git push origin main`. Edge Functions só sobem via CLI com
  `SUPABASE_ACCESS_TOKEN` (o MCP `deploy_edge_function` quebra neste projeto).
- Validação é pós-deploy pelo dono (sem loop de aprovação de design). Decisões-padrão acima podem
  ser ajustadas na validação.
