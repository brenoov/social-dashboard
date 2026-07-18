# Redesign da ferramenta de Colaboradores & Acessos — Design

**Data:** 2026-07-17
**Status:** aprovado (mockup aprovado pelo dono: "gostei demais"; decisões de escopo fechadas)

## Objetivo

Reconstruir a tela `src/ferramentas/acessos/tela-de-acessos.vue` (hoje ~1930 linhas)
com acabamento de "software de multinacional": hierarquia clara, cards, resumo antes
do detalhe, estado codificado na forma. Aplicar o acabamento nas **6 abas**. Integrar
a leitura de acesso do **Zoho WorkDrive** (já pronta no proxy) e dar foco a ele como
provedor ativo, com OneDrive/iCloud marcados como legado (sem arquivar — ver abaixo).
Enriquecer a **ficha do colaborador** e transformar dispositivos em **controle de
patrimônio completo**.

Referência visual aprovada: o mockup em
`scratchpad/acessos-redesign-mockup.html` (artifact 17f18018).

## Restrições globais (toda tarefa herda)

- **Repo é PÚBLICO.** Nunca commitar segredo, nunca imprimir valor de segredo.
- **Honrar o sistema de design existente.** As cores/raios/sombras vêm de
  `src/estilos/estilos-globais.css` (tokens `--surface`, `--surface2`, `--border`,
  `--accent` #1D4ED8, `--green/--yellow/--orange/--red`, `--shadow-*`, `--radius-*`,
  `--sp-*`). O mockup usa uma paleta equivalente; na tela real, usar os tokens do app,
  NÃO cores cravadas (a tela tem tema claro E escuro — cor fixa quebra num deles).
- **Português literal, sem jargão.** Nomes de arquivo/função em PT (kebab-case para
  arquivo, camelCase PT para função). Copy da tela para leigo.
- **Responsivo e full-bleed.** No celular vira coluna única, sem estourar a tela.
  Usar toda a largura; nada de `max-width` estreito centralizado.
- **CSS injetado por innerHTML precisa de `:deep()`** (o `<style scoped>` não alcança
  DOM criado por innerHTML). Seguir o padrão já existente `.tela-acessos :deep(...)`.
- **NÃO pode cair teste.** `npm test` está em 288 passando, 0 falhas. Toda lógica pura
  nova sai em módulo `.js` com `.test.mjs` ao lado.
- **A tela NÃO abre em localhost** (CORS do acessos-proxy só libera produção — e isso
  está certo). Logo: testar lógica pura com node:test; a tela só se prova no deploy.
- **Não quebrar o que funciona:** iCloud (1 pasta, provisionamento manual), OneDrive
  (32 pastas, 370 acessos ao vivo via Microsoft Graph), Auditoria (allShares +
  vínculos), WorkDrive (16 pastas, leitura de acesso). Cada aba que já funciona precisa
  continuar funcionando.

## Decisões de escopo (do dono, 2026-07-17)

1. **Patrimônio: completo.** Categorias (TI, móveis, veículos, etc.), valor do bem, e
   histórico de quem teve o item antes. Vira controle de patrimônio de verdade.
2. **Alcance: a ferramenta toda** (6 abas), numa leva só.
3. **Escrita do WorkDrive (conceder/revogar/criar link): adiada.** Precisa o dono
   reconectar o Zoho concedendo o escopo de compartilhamento. Os botões existem no
   layout, desabilitados com aviso "reconecte para habilitar", até a reauth. NÃO
   bloquear o redesign nisso.
4. **NÃO arquivar OneDrive/iCloud.** Decidido em 2026-07-17: 370 acessos ativos de 15
   pessoas reais. Legado = rótulo visual, não sumiço. O UPDATE de arquivamento segue
   comentado.

## As 6 abas e o que muda em cada

A tela terá um **cabeçalho comum** (marca RBV + título + pills de provedor com status
de conexão) e uma **faixa de KPIs** (pastas geridas, pessoas, compartilhamentos,
provedores). Abaixo, a navegação por abas leva a:

1. **Colaboradores** (hoje `org`): lista de pessoas por setor/organização, cada uma
   abrindo a **ficha** (ver seção Ficha). Redesign: cards de pessoa com avatar, cargo,
   selo de status, contagem de acessos; agrupamento por setor com cor do setor.
2. **Pastas & Acessos** (hoje `drive`): o painel master-detail do mockup. Rail de
   provedores (WorkDrive Ativo / OneDrive Legado / iCloud Legado) + lista de pastas
   (agrupada por marca, hierárquica) + detalhe "quem tem acesso" e "links". Para
   WorkDrive usa `zoho.acessoDaPasta`; para OneDrive usa `microsoft.shares`.
3. **Auditoria**: visão por pessoa — quem tem acesso a quê, somando os provedores.
   Mantém o aviso de "quadro incompleto" (campo `falhas`) já implementado. Redesign:
   tabela/cards legíveis, chips de papel, destaque para quem tem acesso demais.
4. **Dispositivos & Patrimônio** (hoje dentro da ficha): agora com categorias, valor e
   histórico. Pode aparecer tanto na ficha da pessoa quanto numa aba consolidada
   "Patrimônio" (todos os bens, filtrável por categoria/pessoa/status).
5. **Termos**: termos de responsabilidade (PDF) por pessoa. Mantém upload/download via
   iframe (iOS). Redesign: lista limpa com data de envio.
6. **Config** (hoje ícone de engrenagem sem rótulo — ACHADO DE USABILIDADE): passa a
   ter **rótulo "Configurações"** visível. Conexões dos provedores (Zoho/Microsoft),
   reconectar (com o escopo de sharing quando for a hora), setores/organizações.

## Ficha do colaborador

Campos já existem em `acessos_pessoas` (nome, cargo, status, setor_id, organizacao_id,
email_corporativo, email_outlook, conta_apple, numero_pessoal, numero_corporativo,
data_inicio_contrato, data_fim_contrato, motivo_saida, avatar_url, zoho_account_id).
O redesign SURFACE e deixa editável, com **estados vazios que convidam a preencher**
(campo em branco vira botão "+ adicionar", não fica em branco morto).

Seções da ficha (mockup): Identidade (avatar+cargo+setor+status+resumo), Contatos &
contas (e-mails, telefones, conta Apple, contrato), Dispositivos & patrimônio, Termo de
responsabilidade, Acessos desta pessoa (soma OneDrive + WorkDrive, amarrado à auditoria
real).

**Foto automática:** `avatar_url` deve atualizar sozinho a partir da conta do provedor
(mesma ideia da foto de perfil das redes sociais, que já re-hospeda com cache-busting).
Fonte: foto da conta Zoho (a ação `zoho.users` já traz avatar) ou Microsoft. Reusar o
padrão de re-hospedagem `?v={hash}` já existente no coletor. Detalhe de implementação
fica para o plano; no design: a foto não fica "congelada", atualiza no fluxo normal.

## Patrimônio completo — modelo de dados

`acessos_dispositivos` já tem: tipo, descricao, identificador, status, desde,
observacao, categoria, detalhes(jsonb), pessoa_id. **Acréscimos (migration nova):**

- `valor_centavos bigint` — valor do bem em centavos (inteiro, nunca float para
  dinheiro). NULL = não informado.
- Nova tabela `acessos_patrimonio_historico`:
  - `id uuid pk`, `dispositivo_id uuid fk -> acessos_dispositivos(id) on delete cascade`,
  - `pessoa_id uuid fk -> acessos_pessoas(id)` (quem teve o item; pode ser null se saiu
    da base), `pessoa_nome text` (nome congelado, para sobreviver a exclusão da pessoa),
  - `de date`, `ate date null` (ate null = posse atual), `motivo text`,
  - `criado_em timestamptz default now()`.
  - Ao trocar o dono de um item (mudar `pessoa_id` no dispositivo), fecha o registro
    aberto (`ate = hoje`) e abre um novo. Lógica pura testável.
- `categoria` passa a ter um conjunto sugerido: TI, Móveis, Veículos, Telefonia, Outro.
  Não é ENUM no banco (flexível), é validado/sugerido na UI.

RLS: as tabelas de acessos já são gated por username admin no app; a nova tabela herda
o mesmo padrão das irmãs (checar a policy de `acessos_dispositivos` e replicar).

## WorkDrive: leitura pronta, escrita adiada

- **Pronto e no ar (proxy v26):** `zoho.pastas`, `zoho.importarPastas`,
  `zoho.acessoDaPasta` (quem tem acesso + links), `zoho.diagnosticarSharing` (sondagem
  temporária — remover quando a escrita estiver pronta).
- **Vocabulário real de acesso** (medido): `type` ∈ {workspace, folder, ...}. A raiz tem
  6 membros via workspace; subpastas herdam (0 permissão própria). Mostrar isso com
  honestidade (chip "Todo o time", "Herda da pasta-mãe"), não forçar lista de pessoas
  onde não há.
- **Escrita (adiada):** conceder por e-mail, criar link, revogar. Provavelmente pede
  escopo `WorkDrive.teamfolders.sharing.*` / `WorkDrive.links.ALL` (a confirmar por
  sondagem de escrita ANTES de mandar o dono reautorizar — não mandar clicar às cegas).

## Testes

- Lógica pura em módulos `.js` + `.test.mjs` (node:test, sem dep nova): montar árvore de
  pastas (já existe), agrupar acessos por pessoa, fechar/abrir histórico de patrimônio,
  formatar valor em reais, derivar estado vazio-convida-preencher.
- A tela em si NÃO roda em localhost — validação visual só em produção após deploy.
- `npm test` verde é gate obrigatório de cada tarefa.

## O que fica de fora (YAGNI)

- Escrita do WorkDrive nesta leva (adiada, precisa reauth).
- Arquivar OneDrive/iCloud (decisão do dono: não).
- Migração automática OneDrive→WorkDrive das pessoas (é operação humana; a ferramenta
  só dá visibilidade).
