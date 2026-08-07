<template>
  <!-- Porte fiel de #admin-screen (legacy/index.html L2776-2923), VERBATIM,
       mesmo padrão de Gestão de Tráfego/Gestão à Vista/Análise de Campanhas/
       Redes Sociais: raiz vira .tela-admin (sem display:none — quem controla
       a visibilidade agora é o vue-router). Único onclick trocado por
       binding Vue: o botão "Central" (Voltar) — closeAdmin vira @click (a
       função por trás dele agora navega pelo router em vez de fazer
       display:none + showHome()). Os demais onclick="loadAdminSection(...)"
       ficam como STRING literal (igual ao legado) — são atributos HTML
       nativos, avaliados no escopo global; por isso o cluster de funções que
       eles chamam é exposto em window mais abaixo.
       O MODAL DE PERMISSÕES (#perm-modal-overlay, legacy L11966-11979) é, no
       legado, um <div> irmão solto no <body>, longe de #admin-screen (fica
       perto do menu do usuário global). Foi trazido para DENTRO da raiz deste
       componente — mesma técnica já usada nos modais da Gestão de Tráfego e
       no tooltip/modal de campanhas da Redes Sociais: é position:fixed, então
       o lugar dele na árvore do DOM não muda o layout visual, e ficar dentro
       da árvore do componente é o que permite ao CSS :deep() (scoped)
       alcançá-lo. -->
  <div class="tela-admin">
    <barra-de-topo voltar="Central" titulo="Administração" @voltar="closeAdmin" />
    <div class="admin-layout">
      <nav class="admin-sidebar">
        <div class="admin-nav-group-label">Gestão</div>
        <div class="admin-nav-item active" data-section="users" onclick="loadAdminSection('users')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><span>Usuários</span></div>
        <div class="admin-nav-item" data-section="accounts" onclick="loadAdminSection('accounts')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg><span>Contas</span></div>
        <div class="admin-nav-item" data-section="requests" onclick="loadAdminSection('requests')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><span>Solicitações</span></div>
        <div class="admin-nav-group-label">Vendas</div>
        <div class="admin-nav-item" data-section="metas" onclick="loadAdminSection('metas')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span>Metas</span></div>
        <div class="admin-nav-group-label">Plataforma</div>
        <div class="admin-nav-item" data-section="data" onclick="loadAdminSection('data')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg><span>Dados</span></div>
      </nav>
      <div class="admin-content">
        <!-- USUÁRIOS -->
        <div class="admin-section active" id="admin-section-users">
          <div class="admin-section-title">Usuários &amp; Acessos</div>
          <div class="admin-section-sub">Gerencie quem tem acesso à Central de Inteligência</div>
          <div id="admin-stats-users" class="admin-stats"></div>
          <span class="sg-label">Convidar novo usuário</span>
          <div class="sg" style="padding:16px 20px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 16px;">
              <div>
                <label class="admin-form-label" for="adm-name">Nome</label>
                <input type="text" id="adm-name" class="admin-form-input" placeholder="Nome completo" style="width:100%;box-sizing:border-box;">
              </div>
              <div>
                <label class="admin-form-label" for="adm-email">Email</label>
                <input type="email" id="adm-email" class="admin-form-input" placeholder="email@exemplo.com" style="width:100%;box-sizing:border-box;">
              </div>
              <div>
                <label class="admin-form-label" for="adm-pass">Senha inicial <span style="font-weight:400;opacity:.6">(opcional)</span></label>
                <input type="password" id="adm-pass" class="admin-form-input" placeholder="Deixe vazio p/ enviar convite" style="width:100%;box-sizing:border-box;">
              </div>
              <div>
                <label class="admin-form-label" for="adm-role">Perfil de acesso</label>
                <select id="adm-role" class="admin-form-input" style="width:100%;box-sizing:border-box;cursor:pointer;"><option value="viewer">Visualizador</option><option value="admin">Administrador</option></select>
              </div>
            </div>
            <div style="font-family:var(--fonte-principal);font-size:11px;color:var(--muted);margin-top:12px;display:flex;align-items:center;gap:6px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.6"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Se a senha for deixada em branco, um link de primeiro acesso será enviado para o email.
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
              <div id="adm-invite-msg" style="font-family:var(--fonte-principal);font-size:12px;color:var(--muted);flex:1"></div>
              <div style="display:flex;gap:8px;flex-shrink:0">
                <button class="sr-btn" onclick="adminInviteUser('invite')" style="font-size:11px;padding:7px 14px;gap:5px;display:flex;align-items:center;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  Enviar convite
                </button>
                <button class="sr-btn" onclick="adminInviteUser('create')" style="background:var(--accent);color:#fff;font-size:11px;padding:7px 14px;gap:5px;display:flex;align-items:center;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                  Criar com senha
                </button>
              </div>
            </div>
          </div>
          <!-- Times de venda mora aqui dentro de Usuários (Task 5): quem cria
               conta e quem organiza times é a mesma pessoa fazendo a mesma
               tarefa de gestão de acesso, então a ordem virou criar → times →
               pessoas, do jeito que o dono aprovou. -->
          <span class="sg-label">Times de venda</span>
          <div class="admin-section-sub">Lojas, canais e setores — e quem trabalha em cada um. É por aqui que uma loja nova entra no sistema.</div>
          <div id="admin-equipes-body"><div style="color:var(--muted);font-size:12px">Carregando...</div></div>
          <span class="sg-label">Usuários cadastrados</span>
          <div id="admin-user-list"></div>
        </div>
        <!-- CONTAS -->
        <div class="admin-section" id="admin-section-accounts">
          <div class="admin-section-title">Contas Conectadas</div>
          <div class="admin-section-sub">Perfis do Instagram vinculados à plataforma</div>
          <div id="admin-accounts-list"></div>
        </div>
        <!-- DADOS -->
        <div class="admin-section" id="admin-section-data">
          <div class="admin-section-title">Dados &amp; Sincronização</div>
          <div class="admin-section-sub">Saúde do banco de dados e coleta de dados</div>
          <div id="admin-data-stats" class="admin-stats"></div>
          <span class="sg-label">Última coleta por conta</span>
          <div class="sg" id="admin-data-sync"></div>
          <span class="sg-label">Ações de manutenção</span>
          <div class="sg">
            <div class="sr clickable" style="justify-content:space-between" onclick="adminShowRefetchInfo()"><div class="sr-main"><div class="sr-label">Atualizar fotos de perfil</div><div class="sr-sub">Rebusca as fotos dos perfis via Meta API</div></div><span style="font-size:18px">↻</span></div>
            <div class="sr clickable" style="justify-content:space-between" onclick="adminShowColetorInfo()"><div class="sr-main"><div class="sr-label">Rodar coletor de dados</div><div class="sr-sub">Coleta métricas do Instagram para todos os perfis</div></div><span style="font-size:18px">⚡</span></div>
          </div>
          <div id="admin-action-info" style="display:none;margin-top:12px"></div>
        </div>
        <!-- SAÚDE: saiu da barra (Task 5), mas a tela de detalhe continua aqui —
             a faixa de aviso em Dados abre esta seção por onclick, então
             loadAdminSaude() precisa ter onde desenhar o detalhamento. -->
        <div class="admin-section" id="admin-section-saude">
          <div class="admin-section-title">Saúde dos dados</div>
          <div class="admin-section-sub">Verificação automática diária (23:30) — frescor, consistência e anomalias das métricas de todos os perfis.</div>
          <div id="admin-saude-body"><div style="color:var(--muted);font-size:12px">Carregando...</div></div>
        </div>
        <div class="admin-section" id="admin-section-metas">
          <div class="admin-section-title">Metas de Vendas</div>
          <div class="admin-section-sub">Configure as metas mensais por canal e loja</div>
          <div id="admin-metas-body"><div style="color:var(--muted);font-size:12px">Carregando...</div></div>
        </div>
        <!-- SOLICITAÇÕES -->
        <div class="admin-section" id="admin-section-requests">
          <div class="admin-section-title">Solicitações de Acesso</div>
          <div class="admin-section-sub">Usuários que solicitaram acesso à plataforma</div>
          <div id="admin-requests-body"><div style="color:var(--muted);font-size:12px">Carregando...</div></div>
        </div>
      </div>
    </div>

    <!-- ── PERMISSIONS MODAL (legacy L11966-11979 — irmão solto no body, trazido
         pra dentro da raiz aqui pelo mesmo motivo dos modais de GT/Redes Sociais) ── -->
    <div id="perm-modal-overlay" class="perm-overlay" onclick="if(event.target===this)closePermModal()">
      <div class="perm-modal">
        <div class="perm-modal-hdr">
          <div class="perm-modal-title">Permissões</div>
          <div class="perm-modal-user" id="perm-modal-user"></div>
        </div>
        <div class="perm-modal-body" id="perm-modal-body"></div>
        <div class="perm-modal-ftr">
          <button class="sr-btn" onclick="closePermModal()" style="font-size:12px;padding:8px 16px">Cancelar</button>
          <button class="sr-btn" id="perm-save-btn" onclick="savePermissions()" style="background:var(--accent);color:#fff;font-size:12px;padding:8px 16px">Salvar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import BarraDeTopo from '../../compartilhado/barra-de-topo.vue'
import { useRouter } from 'vue-router'
import { sbClient, SUPABASE_URL, SUPABASE_ANON_KEY } from '../../compartilhado/conectar-no-banco-de-dados.js'
import { estado, PERMISSION_TREE, RECURSOS } from '../../compartilhado/controle-de-login-e-usuario.js'
import { agruparRecursos, contarAcoes, estadoDaSelecao, marcarTudo } from './agrupar-permissoes.js'
import { derivarFeatures } from '../../compartilhado/derivar-features.js'
// A escada de niveis (Sem acesso / Ver / Mexer / Tudo) que substitui a matriz
// de caixinhas no editor de permissoes: uma escolha por ferramenta, em vez de
// ate 5 caixinhas por linha das quais mais da metade nunca existiu de verdade.
import { degrausDoRecurso, degrauDoConjunto, acoesDoDegrau } from './niveis-de-permissao.js'
// Quais notificações existem e qual o padrão de cada uma. A lista mora junto da
// Edge que envia (supabase/functions/_shared) pra não haver duas verdades sobre
// quem recebe o quê — a tela LÊ dela em vez de repetir os nomes.
import { TIPOS_DE_NOTIFICACAO, querReceber } from '../../../supabase/functions/_shared/notificacoes.js'
import { adminToast } from '../../compartilhado/avisos.js'
import { gerarSenhaForte } from './senha.js'
import { sb } from '../../compartilhado/buscar-e-salvar-dados.js'
// As REGRAS dos times (quem administra, quem concede o quê, o que falta em cada
// um) moram em equipes.js, puro e testado. Aqui só se desenha e se grava.
import {
  PAPEIS, acharPapel, podeAdministrarTime, papeisQuePossoConceder, podeRemover,
  validarTime, canaisLivres, linhaDoTime, ordenarTimes,
  veOEstoque, podeLiberarEstoque,
} from './equipes.js'
// Puxar as vendedoras das VENDAS: agrupa duplicadas, separa balcão de pessoa e
// deduz a loja. Regras puras, testadas contra os 22 cadastros reais do Bling.
import {
  agruparVendedores, lojaDaVendedora, comoDizerALoja, viraConta, emailSugerido,
} from './vendedoras.js'
// Separar as pessoas por marca, local ou setor: a gaveta escolhida e o "sem
// ___" que fecha a lista moram aqui, puro e testado — a tela só desenha.
import { agruparPor, DIMENSOES } from './lotacao.js'
// Decide se um login e um cadastro de colaborador são a mesma pessoa. Puro e
// testado à parte: um casamento errado dá a lotação e o histórico de alguém
// para outra pessoa, ou para uma caixa de e-mail compartilhada.
import { estadoDoVinculo } from './vinculo-de-cadastro.js'
// Trava a rolagem do fundo enquanto a ficha esta aberta. Peca compartilhada,
// que tambem compensa a barra de rolagem e resolve o efeito elastico do iOS.
// O editor de permissoes (#perm-modal-overlay) NAO precisa de chamada aqui: ele
// ja e coberto pelo observador de modais legados, ligado na moldura. Chamar nos
// dois lugares travaria duas vezes e destravaria uma, prendendo a pagina.
import { abrirModal, fecharModal } from '../../compartilhado/travar-rolagem-de-fundo.js'

const router = useRouter()

const logoClaroUrl = '/midia/LOGOTIPOBRENOPRETO.png'
const logoEscuroUrl = '/midia/LOGOTIPOBRENOBRANCO.png'

// ==========================================================================
// PORTE VERBATIM do módulo Admin (legacy/index.html — bloco "/* ── ADMIN
// MODULE ── */" e vizinhos, funções espalhadas entre L4373-5213), menos
// openAdmin/closeAdmin, que viraram onMounted (gate de acesso + primeira
// seção) / closeAdmin (router.push) abaixo.
//
// ATENÇÃO — este é o painel mais sensível da plataforma. Ele CRIA e EXCLUI
// CONTAS DE USUÁRIO DE VERDADE (adminInviteUser → edge function
// "invite-user"; exclusão → mesma edge function com {deleteUserId}, dentro de
// loadAdminUsers) e muda PERMISSÕES REAIS que controlam o que cada pessoa
// pode acessar (savePermissions → PATCH em profiles.permissions + features,
// os dois juntos — ver o comentário em savePermissions; handleRequest
// → aprova/nega solicitação de acesso). Erros aqui têm consequência real
// para pessoas reais. O único confirm() que existia no legado para essas
// ações — o de excluir usuário, dentro de loadAdminUsers — foi preservado
// INTACTO, mesma mensagem, mesmo lugar (ver auditoria de mutações no
// relatório .superpowers/sdd/admin-port-report.md). invite (criar/convidar),
// savePermissions e handleRequest NÃO tinham confirm() no legado — nenhum
// foi adicionado aqui.
//
// Dependências externas resolvidas:
//   - sbClient, SUPABASE_URL, SUPABASE_ANON_KEY → import (conectar-no-banco-de-dados.js)
//   - estado                                     → import (controle-de-login-e-usuario.js) —
//     substitui currentUserRole/currentUserFeatures/currentUserId/currentSession
//     (ver lista de renomeações abaixo).
//   - PERMISSION_TREE                            → import (controle-de-login-e-usuario.js) —
//     já existia lá, portada verbatim (legacy L4525) para dar suporte ao
//     futuro painel de admin; conferida por diff contra o legado — idêntica,
//     mesmas chaves/labels/filhos. NÃO foi redefinida aqui.
//   - adminToast                                 → import (avisos.js) — a
//     versão local do legado (que criava seu próprio toast <div>, legacy
//     L4377-4378) foi DESCARTADA em favor desta, mesmo padrão dos outros
//     portes.
//   - sb                                         → import (buscar-e-salvar-dados.js) —
//     idêntico ao sb() do legado (legacy L3277), usado por loadAdminSaude/
//     loadAdminAccounts/loadAdminAppearance/loadAdminData/updateSaudeBadge.
//
// Copiados localmente (self-contidos, sem lugar compartilhado no Vue ainda —
// mesmo padrão de "cada tela traz sua cópia" já usado nos outros portes):
//   mkEl, adTok (currentSession→estado.currentSession), adFetch, escHtml,
//   fmtN/fmtR (legacy L3393-3394, idênticos aos já copiados em
//   tela-de-redes-sociais.vue), PROFILE_THEMES (legacy L3302, idêntico ao já
//   copiado em tela-de-redes-sociais.vue — cada tela guarda sua própria
//   cópia mutável), SUPERADMIN_EMAILS/SUPERADMIN_EMAIL (legacy L4540-4541 —
//   não há export equivalente em controle-de-login-e-usuario.js), e o trio de
//   upload de avatar _avCb/_avInput/_uploadAvatar (legacy L5473-5482).
//
// Renomeações aplicadas (verbatim fora isso):
//   - currentSession → estado.currentSession (adTok; dentro de loadAdminSaude,
//     no helper `post` que dispara coletar-dados/auditar-dados).
//   - currentUserId → estado.userId (loadAdminUsers, no callback de troca de
//     avatar: `if(u.id===estado.userId)_setGubAvatar(url)`).
//   - currentUserRole/currentUserFeatures: usados apenas dentro de
//     _applySubFeatures (ver SKIP abaixo) e do antigo openAdmin (substituído
//     pelo gate do onMounted) — não sobraram ocorrências para renomear no
//     corpo copiado.
//
// Duas adaptações além das renomeações (exigidas pela arquitetura de SPA por
// rotas, onde só existe UMA tela montada por vez — documentadas aqui em vez
// de escondidas):
//   1. openAdmin() copiava o texto de #home-user-email (outra "tela" do
//      monólito) para #admin-topbar-user via getElementById. Como a tela
//      Início não fica montada ao mesmo tempo que o Admin, isso quebraria
//      (elemento não existe). Trocado por uma leitura direta de
//      estado.user?.email no <template> (mesmo dado, sem depender do DOM de
//      outra tela).
//   2. loadAdminUsers calculava `currentEmail` do mesmo jeito
//      (document.getElementById('home-user-email').textContent.trim()) para
//      decidir isSelf/isSuperAdmin por linha da lista de usuários — isso
//      lançaria TypeError (elemento null) e quebraria a lista inteira.
//      Trocado por `estado.user?.email || ''` — mesmo valor, sem cross-tela.
//
// SKIPS (não copiados, fora de escopo):
//   - _applySubFeatures (legacy L4595-4607): gate visual de cards de OUTRAS
//     telas (submenu de Vendas/Meta Ads), não faz parte de #admin-screen.
//   - _loadAdminPermissions_removed (legacy L5111-5208): função morta, o
//     próprio nome ("_removed") e o fato de nunca ser chamada em lugar
//     nenhum (conferido por grep) confirmam que foi substituída por
//     openPermModal/#perm-modal — depende até de TOOL_REGISTRY, que não
//     existe em lugar nenhum do arquivo.
//   - rpcCall (legacy L4407-4410): definida mas nunca chamada em lugar
//     nenhum do arquivo (conferido por grep) — código morto, não copiado.
//
// CONCERN conhecida e deliberadamente NÃO corrigida (mantida verbatim por
// instrução explícita): dentro de loadAdminUsers, ao trocar o próprio avatar
// (u.id===estado.userId), o código chama `_setGubAvatar(url)` — função do
// "botão global do usuário" (feature ainda não portada para o Vue). Essa
// chamada vai estourar ReferenceError em runtime; como ela roda dentro do
// callback passado a _triggerAvatarUpload, que por sua vez roda dentro do
// try/catch de _avCb, o erro é engolido e reaparece como um toast de ERRO
// ("Erro ao enviar: _setGubAvatar is not defined") mesmo a foto tendo sido
// trocada com sucesso na tela (a troca visual do <img> já aconteceu antes da
// linha que quebra). Ou seja: o upload funciona, mas o usuário vê uma
// mensagem de erro ao trocar a PRÓPRIA foto (trocar a foto de outra pessoa
// não aciona esse caminho). Ver relatório para mais detalhes.
//
// Nada foi reescrito para template reativo — o board inteiro (lista de
// usuários, contas, aparência, dados, sistema, saúde, metas, solicitações,
// modal de permissões) segue montado via getElementById/createElement/
// innerHTML, exatamente como a produção atual. Por isso o cluster de funções
// chamadas por onclick="..."/onchange="..." literal (no <template> acima e
// dentro das strings de innerHTML geradas por loadAdminMetas) é exposto em
// window no fim deste bloco.
// ==========================================================================

/* ── Helpers copiados do legado (self-contidos) ── */
function mkEl(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e }
function adTok() { return estado.currentSession?.access_token || SUPABASE_ANON_KEY }
function adFetch(path, opts = {}) { return fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...opts, headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${adTok()}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } }) }
function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
function fmtN(n) { n = Number(n) || 0; const a = Math.abs(n); if (a >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' mi'; if (a >= 1e3) return (n / 1e3).toFixed(1).replace('.', ',') + ' mil'; return String(n) }
function fmtR(v) { const p = v.toFixed(2).split('.'); return 'R$ ' + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + p[1] }

/* ── Temas por conta (legacy L3302-3309, idêntico ao já copiado em
   tela-de-redes-sociais.vue — cada tela guarda sua própria cópia) ── */
const PROFILE_THEMES = {
  'Raíssa Herculano': { accent: '#BE185D', light: 'rgba(190,24,93,0.08)', mid: 'rgba(190,24,93,0.30)' },
  'Breno Vale': { accent: '#1D4ED8', light: 'rgba(29,78,216,0.08)', mid: 'rgba(29,78,216,0.30)' },
  'Mantova Móveis': { accent: '#1D4ED8', light: 'rgba(29,78,216,0.08)', mid: 'rgba(29,78,216,0.30)' },
  'Vessel': { accent: '#166534', light: 'rgba(22,101,52,0.08)', mid: 'rgba(22,101,52,0.30)' },
  'Motoeasy': { accent: '#9B1C1C', light: 'rgba(155,28,28,0.08)', mid: 'rgba(155,28,28,0.30)' },
}

/* ── Superadmin (legacy L4540-4541 — sem export equivalente ainda) ── */
const SUPERADMIN_EMAILS = ['erick@rbvcompany.com', 'gabriel.gertrudes@rbvcompany.com']
const SUPERADMIN_EMAIL = SUPERADMIN_EMAILS[0]

/* ── AVATAR UPLOAD (legacy L5473-5482, verbatim) ── */
let _avCb = null
const _avInput = (() => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/jpeg,image/png,image/webp,image/gif'; i.style.display = 'none'; document.body.appendChild(i); i.addEventListener('change', async () => { const f = i.files?.[0]; if (f && _avCb) _avCb(f); i.value = '' }); return i })()
async function _uploadAvatar(userId, file) {
  const path = userId
  const { error } = await sbClient.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  const { data: { publicUrl } } = sbClient.storage.from('avatars').getPublicUrl(path)
  await adFetch('profiles?id=eq.' + userId, { method: 'PATCH', body: JSON.stringify({ avatar_url: publicUrl }) })
  return publicUrl
}
function _triggerAvatarUpload(userId, onDone) {
  if (!userId) return
  _avCb = async (file) => {
    try { const url = await _uploadAvatar(userId, file); onDone(url) }
    catch (e) { adminToast('Erro ao enviar: ' + e.message) }
  }
  _avInput.click()
}

/* ── Navegação entre seções (legacy L4390-4405, verbatim) ── */
function loadAdminSection(name) {
  document.querySelectorAll('.admin-nav-item').forEach(el => el.classList.toggle('active', el.dataset.section === name))
  document.querySelectorAll('.admin-section').forEach(el => el.classList.remove('active'))
  const sec = document.getElementById('admin-section-' + name); if (sec) sec.classList.add('active')
  // 'saude' e 'equipes' saíram deste mapa na Task 5: Saúde não tem mais item na
  // barra (vive só na faixa de Dados, aberta pelo onclick montado em
  // updateSaudeBadge) e Times de venda carrega junto com Usuários, dentro de
  // loadAdminUsers.
  const carregadores = { users: loadAdminUsers, accounts: loadAdminAccounts, data: loadAdminData, metas: loadAdminMetas, requests: loadAdminRequests }
  carregadores[name]?.()
  updateSaudeBadge()
}

// O SINAL DA SAÚDE NÃO MORRE COM A ABA.
//
// A aba saiu da barra a pedido do dono, mas ela estava CERTA: as 13 falhas por
// dia que ela acusava eram o bug das curtidas zeradas (commit 9943dda), e ela
// era o único lugar que avisava. Apagar o aviso junto com a tela repetiria o
// silêncio que deixou o bug invisível por semanas.
//
// Some sozinha quando não há falha: aviso que fica sempre aceso vira paisagem.
async function updateSaudeBadge() {
  const alvo = document.getElementById('admin-section-data'); if (!alvo) return
  const anterior = alvo.querySelector('.saude-faixa'); if (anterior) anterior.remove()
  // USE `sbClient`, NÃO o `sb()` desta tela (mesmo motivo do comentário em
  // loadAdminUsers): `sb()` cai pra chave anônima quando `estado.currentSession`
  // ainda não hidratou, e `data_integrity_checks` só abre `to authenticated` —
  // o PostgREST responde 200 com lista vazia, sem erro, e a faixa simplesmente
  // não desenha. É a mesma classe de bug que apagou o aviso das curtidas
  // zeradas por semanas (comentário acima). Erro vai pro console: entre
  // desenhar informação errada e não desenhar nada, aqui vale mais não
  // desenhar — mas silenciar a falha por completo repetiria o bug original.
  const { data: last, error: errLast } = await sbClient.from('data_integrity_checks')
    .select('checked_date').order('checked_date', { ascending: false }).limit(1)
  if (errLast) { console.error('updateSaudeBadge: falha ao ler data_integrity_checks', errLast); return }
  if (!last?.length) return
  const { data: fails, error: errFails } = await sbClient.from('data_integrity_checks')
    .select('id').eq('status', 'fail').eq('checked_date', last[0].checked_date)
  if (errFails) { console.error('updateSaudeBadge: falha ao ler falhas do dia', errFails); return }
  if (!fails?.length) return
  const faixa = document.createElement('div')
  faixa.className = 'saude-faixa'
  faixa.textContent = `A conferência de ${last[0].checked_date} achou ${fails.length} divergência(s) entre o painel e a Meta.`
  // Clicável: a aba de detalhe (#admin-section-saude) continua no template e
  // loadAdminSaude() continua existindo — só não tem mais botão na barra pra
  // chegar nela. A faixa é o novo caminho.
  faixa.style.cursor = 'pointer'
  faixa.title = 'Clique para ver o detalhamento'
  faixa.onclick = () => {
    document.querySelectorAll('.admin-nav-item').forEach(el => el.classList.remove('active'))
    document.querySelectorAll('.admin-section').forEach(el => el.classList.remove('active'))
    document.getElementById('admin-section-saude')?.classList.add('active')
    loadAdminSaude()
  }
  alvo.insertBefore(faixa, alvo.firstChild)
}

/* ── PUXAR AS VENDEDORAS DAS VENDAS ─────────────────────────────────────────
 *
 * PEDIDO DO DONO (04/08/2026): "dá para puxar pelas vendas as vendedoras
 * existentes e jogar no time de vendas e criar usuários".
 *
 * O QUE ESTA TELA NÃO FAZ: decidir sozinha. Ela agrupa, sugere loja e sugere
 * e-mail — e para. Quem confirma é quem conhece a equipe, porque os dois erros
 * possíveis aqui são caros: juntar duas pessoas dá a uma o faturamento da
 * outra, e separar a mesma pessoa em duas parte a comissão dela no meio.
 */
let _vdLista = []
let _vdEscolhas = {}     // nome -> { criar, email, equipe_id }
let _vdSenhas = []       // as senhas geradas, mostradas UMA vez
let _vdCarregando = false
// POR QUE A BUSCA NÃO DEU EM NADA. Sem isto, um resultado vazio devolvia a tela
// ao botão inicial — indistinguível de "não cliquei". Foi exatamente o que
// aconteceu em 05/08/2026: o botão parecia morto e não havia como saber por
// quê. `sb()` nunca estoura; ele devolve lista vazia com o motivo pendurado, e
// quem não lê esse motivo transforma falha em silêncio.
let _vdMotivoVazio = ''

async function _vdPuxar() {
  const body = document.getElementById('admin-equipes-body'); if (!body) return
  _vdCarregando = true; _vdMotivoVazio = ''; _eqDesenhar()
  try {
    // `sbClient`, e NÃO o `sb()` desta tela.
    //
    // As duas tabelas só abrem para `authenticated`. O `sb()` monta o cabeçalho
    // com `estado.currentSession?.access_token || SUPABASE_ANON_KEY` — e com a
    // chave anônima o PostgREST responde 200 com lista VAZIA, sem erro nenhum.
    // Falha que se disfarça de "não tem nada".
    //
    // O `sbClient` cuida da sessão sozinho (inclusive renovando), e é o mesmo
    // que a aba espelho do Gestor Comercial usa — aquela funcionou em produção
    // no mesmo dia em que esta não funcionou. Escolhi o que tem prova.
    const [rv, rp] = await Promise.all([
      sbClient.from('bling_vendedores').select('vendor_id,nome'),
      sbClient.from('bling_pedido_vendedor').select('vendor_id,loja_id,pedido_data').limit(5000),
    ])
    if (rv.error || rp.error) {
      _vdMotivoVazio = 'A leitura falhou: ' + ((rv.error || rp.error).message || 'motivo desconhecido')
      return
    }
    const vends = rv.data || []
    const pedidos = rp.data || []
    if (!(vends || []).length) {
      _vdMotivoVazio = 'Nenhum vendedor cadastrado no Bling chegou até aqui. '
        + 'Abra a Gestão à Vista uma vez — é ela que traz os vendedores do Bling para cá.'
      return
    }
    const porVendedor = {}
    for (const p of (pedidos || [])) {
      if (!porVendedor[p.vendor_id]) porVendedor[p.vendor_id] = []
      porVendedor[p.vendor_id].push(p)
    }
    const comContagem = (vends || []).map(v => {
      const meus = porVendedor[v.vendor_id] || []
      const datas = meus.map(x => x.pedido_data).filter(Boolean).sort()
      return { ...v, pedidos: meus.length, ultima_venda: datas[datas.length - 1] || null }
    })
    _vdLista = agruparVendedores(comContagem).map(g => {
      // Os pedidos de TODOS os ids do grupo — a Elen tem três.
      const todos = g.ids.flatMap(id => porVendedor[id] || [])
      const loja = lojaDaVendedora(todos)
      const equipe = _eqTimes.find(t => String(t.canal_loja_id) === String(loja.loja_id))
      return { ...g, loja, equipeSugerida: equipe ? equipe.id : '' }
    })
    for (const g of _vdLista) {
      if (!_vdEscolhas[g.nome]) {
        _vdEscolhas[g.nome] = {
          criar: viraConta(g),
          email: viraConta(g) ? emailSugerido(g.nome) : '',
          equipe_id: g.equipeSugerida || '',
        }
      }
    }
  } catch (e) {
    _vdMotivoVazio = String(e && e.message || e)
    adminToast('Não consegui puxar as vendedoras: ' + _vdMotivoVazio, false)
  } finally {
    _vdCarregando = false; _eqDesenhar()
  }
}

function _vdSecao() {
  if (!_vdLista.length && !_vdCarregando && !_vdSenhas.length && !_vdMotivoVazio) {
    return '<div style="border:1px dashed var(--border);border-radius:12px;padding:16px;margin-bottom:14px;">'
      + '<div style="font-weight:700;color:var(--text);margin-bottom:4px;">Puxar as vendedoras das vendas</div>'
      + '<div class="admin-section-sub" style="margin-bottom:10px;">Lê quem já vendeu no Bling, junta os cadastros repetidos e sugere a loja de cada uma. Nada é criado sem você confirmar.</div>'
      + '<button data-vd-puxar style="border:1px solid var(--accent);background:transparent;color:var(--accent);border-radius:9px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;">Puxar das vendas</button>'
      + '</div>'
  }
  if (_vdCarregando) return '<div style="color:var(--muted);font-size:12px;margin-bottom:14px;">Lendo as vendas…</div>'

  // O MOTIVO NA TELA, e o botão de volta ao lado. Voltar em silêncio ao estado
  // inicial faz o botão parecer quebrado.
  if (_vdMotivoVazio) {
    return '<div style="border:1px solid var(--orange,#d97706);border-radius:12px;padding:16px;margin-bottom:14px;">'
      + '<div style="font-weight:700;color:var(--orange,#d97706);margin-bottom:5px;">Não deu para puxar as vendedoras</div>'
      + '<div class="admin-section-sub" style="margin-bottom:10px;">' + escHtml(_vdMotivoVazio) + '</div>'
      + '<button data-vd-puxar style="border:1px solid var(--accent);background:transparent;color:var(--accent);border-radius:9px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;">Tentar de novo</button>'
      + '</div>'
  }

  // AS SENHAS APARECEM UMA VEZ SÓ. Guardá-las para reler depois seria guardar
  // senha em texto — e não guardar obriga a anotar agora, que é o certo.
  if (_vdSenhas.length) {
    let h = '<div style="border:1px solid var(--green,#16a34a);border-radius:12px;padding:16px;margin-bottom:14px;">'
    h += '<div style="font-weight:800;color:var(--green,#16a34a);margin-bottom:4px;">Contas criadas — anote as senhas AGORA</div>'
    h += '<div class="admin-section-sub" style="margin-bottom:10px;">Esta lista não volta a aparecer. Cada uma é obrigada a trocar a senha no primeiro acesso.</div>'
    h += '<table style="width:100%;border-collapse:collapse;font-size:12px;">'
    for (const s of _vdSenhas) {
      h += '<tr><td style="padding:5px 8px 5px 0;color:var(--text);">' + escHtml(s.nome) + '</td>'
        + '<td style="padding:5px 8px;color:var(--muted);">' + escHtml(s.email) + '</td>'
        + '<td style="padding:5px 0;font-family:var(--fonte-dados);font-weight:700;color:var(--text);">' + escHtml(s.senha) + '</td></tr>'
    }
    h += '</table>'
    h += '<button data-vd-fechar style="margin-top:12px;border:1px solid var(--border);background:none;color:var(--text);border-radius:8px;padding:7px 14px;font-size:12px;cursor:pointer;">Já anotei</button>'
    h += '</div>'
    return h
  }

  let h = '<div style="border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:14px;">'
  h += '<div style="font-weight:800;color:var(--text);margin-bottom:4px;">Vendedoras encontradas nas vendas</div>'
  h += '<div class="admin-section-sub" style="margin-bottom:12px;">Confira antes de criar. Quem aparece como <b>balcão</b> não é pessoa — a venda dela é real e entra no time, mas não ganha conta de acesso.</div>'
  for (const g of _vdLista) {
    const e = _vdEscolhas[g.nome] || {}
    const nomeDaLoja = (_eqCanais.find(c => String(c.loja_id) === String(g.loja.loja_id)) || {}).nome
    h += '<div style="border-bottom:1px solid var(--border);padding:9px 0;">'
    h += '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:baseline;">'
    h += '<div><span style="font-weight:700;color:var(--text);">' + escHtml(g.nome) + '</span>'
    if (g.balcao) h += '<span style="margin-left:7px;font-size:10px;font-weight:700;color:var(--orange,#d97706);border:1px solid var(--orange,#d97706);border-radius:999px;padding:1px 7px;">balcão</span>'
    if (g.ids.length > 1) h += '<span style="margin-left:7px;font-size:10.5px;color:var(--green,#16a34a);">' + g.ids.length + ' cadastros juntados</span>'
    h += '</div>'
    h += '<div style="font-size:11.5px;color:var(--muted);font-family:var(--fonte-dados);">' + g.pedidos + ' pedidos · ' + escHtml(comoDizerALoja(g.loja, nomeDaLoja)) + '</div>'
    h += '</div>'
    // O AVISO DOS PARECIDOS. A máquina não junta por conta própria quando tem
    // dúvida — ela conta a dúvida.
    if ((g.parecidos || []).length) {
      h += '<div style="font-size:11px;color:var(--orange,#d97706);margin-top:3px;">Parecido com ' + escHtml(g.parecidos.join(', ')) + ' — se for a mesma pessoa, junte no Bling antes de criar a conta.</div>'
    }
    if (!g.balcao) {
      h += '<div style="display:flex;gap:8px;margin-top:7px;flex-wrap:wrap;align-items:center;">'
      h += '<label style="display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--muted);cursor:pointer;">'
        + '<input type="checkbox" data-vd-criar="' + escHtml(g.nome) + '"' + (e.criar ? ' checked' : '') + '> criar conta</label>'
      h += '<input data-vd-email="' + escHtml(g.nome) + '" value="' + escHtml(e.email || '') + '" placeholder="e-mail" style="flex:1;min-width:190px;padding:6px 9px;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:11.5px;">'
      h += '<select data-vd-equipe="' + escHtml(g.nome) + '" style="padding:6px 9px;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:11.5px;">'
        + '<option value="">— sem time —</option>'
        + ordenarTimes(_eqTimes).map(t => '<option value="' + escHtml(t.id) + '"' + (String(e.equipe_id) === String(t.id) ? ' selected' : '') + '>' + escHtml(t.nome) + '</option>').join('')
        + '</select>'
      h += '</div>'
    }
    h += '</div>'
  }
  h += '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">'
  h += '<button data-vd-criar-tudo style="border:none;background:var(--accent);color:#fff;border-radius:9px;padding:9px 16px;font-size:12.5px;font-weight:700;cursor:pointer;">Criar as contas marcadas</button>'
  h += '<button data-vd-fechar style="border:1px solid var(--border);background:none;color:var(--text);border-radius:9px;padding:9px 14px;font-size:12.5px;cursor:pointer;">Cancelar</button>'
  h += '</div></div>'
  return h
}

async function _vdCriarContas(botao) {
  const marcadas = _vdLista.filter(g => (_vdEscolhas[g.nome] || {}).criar && !g.balcao)
  if (!marcadas.length) { adminToast('Nenhuma conta marcada.', false); return }
  const semEmail = marcadas.filter(g => !(_vdEscolhas[g.nome].email || '').includes('@'))
  if (semEmail.length) { adminToast('Falta e-mail em: ' + semEmail.map(g => g.nome).join(', '), false); return }

  const ok = await _gtConfirmAdmin('Criar ' + marcadas.length + (marcadas.length === 1 ? ' conta?' : ' contas?'),
    'Cada uma recebe uma senha diferente, e é obrigada a trocá-la no primeiro acesso. '
    + 'As senhas aparecem UMA vez — anote antes de fechar.')
  if (!ok) return

  botao.disabled = true; botao.textContent = 'Criando…'
  const feitas = []
  for (const g of marcadas) {
    const esc = _vdEscolhas[g.nome]
    // SENHA DIFERENTE PARA CADA UMA. Senha igual para todas significa que
    // qualquer uma entra na conta da outra — e essas contas veem faturamento.
    const senha = gerarSenhaForte(12)
    try {
      const r = await fetch(SUPABASE_URL + '/functions/v1/invite-user', {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + adTok(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: esc.email.trim(), name: g.nome, role: 'viewer', password: senha }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || ('a função respondeu ' + r.status))

      // O ID VEM DE UMA CONSULTA, e não da resposta.
      //
      // `invite-user` devolve `{ success: true }` e mais nada — ela nunca
      // mandou o id. A primeira versão daqui fazia `d.user?.id || d.id || null`
      // e, quando dava null, PULAVA em silêncio a marca de trocar senha e a
      // entrada no time. O teste ponta a ponta pegou: a conta nasceu, e nasceu
      // sem time e sem cobrança de senha — o pior resultado possível, porque
      // parece que deu certo.
      //
      // Consultar por e-mail funciona porque a função já gravou o perfil antes
      // de responder.
      const rBusca = await adFetch('profiles?select=id&email=eq.' + encodeURIComponent(esc.email.trim()))
      const achados = rBusca.ok ? await rBusca.json().catch(() => []) : []
      const novoId = (achados[0] || {}).id || null
      if (!novoId) throw new Error('a conta foi criada, mas não achei o cadastro dela para pôr no time')

      const rMarca = await adFetch('profiles?id=eq.' + encodeURIComponent(novoId),
        { method: 'PATCH', body: JSON.stringify({ precisa_trocar_senha: true }) })
      if (!rMarca.ok) throw new Error('a conta foi criada, mas não consegui exigir a troca da senha')

      if (esc.equipe_id) {
        const rTime = await adFetch('equipes_membros',
          { method: 'POST', body: JSON.stringify({ equipe_id: esc.equipe_id, profile_id: novoId, papel: 'vendedora' }) })
        if (!rTime.ok) throw new Error('a conta foi criada, mas não entrou no time')
      }
      feitas.push({ nome: g.nome, email: esc.email.trim(), senha })
    } catch (e) {
      adminToast('Falhou em ' + g.nome + ': ' + String(e && e.message || e), false)
    }
  }
  _vdSenhas = feitas
  _vdLista = []
  botao.disabled = false
  await loadAdminEquipes()
}

// Confirmação simples desta seção. O admin não tem o _gtConfirm da Gestão de
// Tráfego, e criar conta é ação que não deve acontecer por clique errado.
function _gtConfirmAdmin(titulo, texto) {
  return Promise.resolve(window.confirm(titulo + '\n\n' + texto))
}

/* ── TIMES DE VENDA ─────────────────────────────────────────────────────────
 *
 * PEDIDO DO DONO (04/08/2026): gerir as equipes de lojas e canais aqui, definir
 * quem gere cada time e quem pode criar e excluir.
 *
 * A LISTA DE LOJAS É DADO, NÃO CÓDIGO. "tem dom pedro também, e aí logo terá
 * iguatemi campinas, sorocaba, etc" — loja nova é rotina do negócio. Tudo o que
 * esta tela faz é escrever em `equipes` e `equipes_membros`; nenhuma loja está
 * escrita em lugar nenhum do sistema.
 */
let _eqTimes = []
let _eqMembros = []
let _eqPessoas = []
let _eqCanais = []
let _eqEditando = null   // id do time aberto para edição, ou 'novo'

const _eqEu = () => ({ is_superadmin: !!estado.is_superadmin, id: estado.user?.id })

// Meu papel num time. O dono não precisa ser membro para administrar.
function _eqMeuPapel(timeId) {
  const m = _eqMembros.find(x => String(x.equipe_id) === String(timeId) && String(x.profile_id) === String(estado.user?.id))
  return m ? m.papel : null
}

async function loadAdminEquipes() {
  const body = document.getElementById('admin-equipes-body'); if (!body) return
  body.innerHTML = '<div style="color:var(--muted);font-size:12px">Carregando…</div>'
  try {
    // `profiles` USA `sbClient`, NÃO `sb()` (mesmo motivo do comentário em
    // loadAdminUsers): com a chave anônima o PostgREST devolve 200 e lista
    // vazia pra tabela que só abre `to authenticated` — falha disfarçada de
    // "não tem nada". Como esta função roda A CADA loadAdminUsers, essa
    // mentira se repetiria toda vez que a tela de Usuários abrisse.
    const [times, membros, canais, rp] = await Promise.all([
      sb('equipes?select=*'),
      sb('equipes_membros?select=*'),
      sb('bling_lojas?select=loja_id,nome&order=nome'),
      sbClient.from('profiles').select('id,name,email,disabled,escopo_por_equipe').order('name'),
    ])
    if (rp.error) throw rp.error
    _eqTimes = times || []; _eqMembros = membros || []
    _eqPessoas = rp.data || []; _eqCanais = canais || []
    _eqDesenhar()
  } catch (e) {
    // O MOTIVO VAI PRA TELA. `catch` mudo aqui já custou meia hora de caça
    // noutra tela deste mesmo sistema.
    body.innerHTML = '<div style="color:var(--red,#dc2626);font-size:12.5px">Não consegui carregar os times: ' + escHtml(String(e && e.message || e)) + '</div>'
  }
}

function _eqDesenhar() {
  const body = document.getElementById('admin-equipes-body'); if (!body) return
  const eu = _eqEu()
  const podeCriar = eu.is_superadmin || _eqMembros.some(m => String(m.profile_id) === String(eu.id) && m.papel === 'gestor')

  let html = _vdSecao()
  html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap;">'
  html += '<div style="color:var(--muted);font-size:12px;">' + _eqTimes.length + (_eqTimes.length === 1 ? ' time' : ' times') + ' cadastrados</div>'
  if (podeCriar) html += '<button data-eq-novo style="border:none;background:var(--accent);color:#fff;border-radius:9px;padding:9px 16px;font-size:12.5px;font-weight:700;cursor:pointer;">+ Novo time</button>'
  html += '</div>'

  if (!_eqTimes.length) {
    html += '<div style="border:1px dashed var(--border);border-radius:12px;padding:22px;text-align:center;color:var(--muted);font-size:12.5px;">'
      + 'Nenhum time ainda. Crie um para cada loja e cada canal de venda — é o que permite dizer que uma vendedora só enxerga a loja dela.</div>'
  }

  for (const t of ordenarTimes(_eqTimes)) {
    const l = linhaDoTime(t, _eqMembros)
    const meu = _eqMeuPapel(t.id)
    const posso = podeAdministrarTime(eu, meu)
    const canal = _eqCanais.find(c => String(c.loja_id) === String(t.canal_loja_id))
    html += '<div style="border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:10px;background:var(--surface);'
      + (l.ativo ? '' : 'opacity:.6;') + '">'
    html += '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;">'
    html += '<div style="font-weight:800;font-size:14px;color:var(--text);">' + escHtml(l.nome)
      + '<span style="font-weight:600;font-size:10.5px;color:var(--muted);margin-left:8px;text-transform:uppercase;letter-spacing:1px;">' + escHtml(l.tipo) + '</span>'
      + (l.ativo ? '' : '<span style="font-weight:700;font-size:10.5px;color:var(--orange,#d97706);margin-left:8px;">inativo</span>')
      + '</div>'
    html += '<div style="font-size:12px;color:var(--muted);">' + escHtml(l.quemTem) + '</div>'
    html += '</div>'
    // A AMARRA COM O BLING em letras claras: é ela que faz o faturamento
    // aparecer, e o nome de lá quase nunca é o nome da casa.
    html += '<div style="font-size:11.5px;color:var(--muted);margin-top:5px;">Vendas pelo canal: '
      + (canal ? '<b style="color:var(--text)">' + escHtml(canal.nome) + '</b>' : '<i>nenhum ligado</i>') + '</div>'
    for (const a of l.avisos) {
      html += '<div style="margin-top:6px;font-size:11.5px;color:' + (a.grave ? 'var(--orange,#d97706)' : 'var(--muted)') + ';">' + escHtml(a.texto) + '</div>'
    }
    html += '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">'
    if (posso) html += '<button data-eq-editar="' + escHtml(t.id) + '" style="border:1px solid var(--border);background:none;color:var(--text);border-radius:8px;padding:6px 12px;font-size:11.5px;font-weight:600;cursor:pointer;">Editar</button>'
    if (posso) html += '<button data-eq-gente="' + escHtml(t.id) + '" style="border:1px solid var(--accent);background:none;color:var(--accent);border-radius:8px;padding:6px 12px;font-size:11.5px;font-weight:700;cursor:pointer;">Quem trabalha aqui (' + l.quantos + ')</button>'
    if (!posso) html += '<span style="font-size:11.5px;color:var(--muted);">Você não administra este time.</span>'
    html += '</div>'
    if (String(_eqEditando) === String(t.id)) html += _eqFormulario(t)
    if (String(_eqEditando) === 'gente:' + t.id) html += _eqGente(t)
    html += '</div>'
  }
  if (_eqEditando === 'novo') html += '<div style="border:1px solid var(--accent);border-radius:12px;padding:14px 16px;margin-bottom:10px;background:var(--surface);">' + _eqFormulario(null) + '</div>'

  body.innerHTML = html
  _eqLigar(body)
}

// O FORMULÁRIO do time. Os quatro vínculos ficam juntos e explicados: é aqui
// que "Tivoli" vira "Loja Santa Bárbara d'Oeste" para as vendas.
function _eqFormulario(t) {
  const e = t || { nome: '', tipo: 'loja', ativo: true }
  const livres = canaisLivres(_eqCanais, _eqTimes, e.id)
  const opc = (lista, val, chave, rot) => lista.map(x =>
    '<option value="' + escHtml(x[chave]) + '"' + (String(x[chave]) === String(val) ? ' selected' : '') + '>' + escHtml(x[rot]) + '</option>').join('')
  const campo = 'style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:12.5px;"'
  const rot = 'style="display:block;font-size:11px;font-weight:700;color:var(--text);margin:10px 0 4px;"'
  let h = '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">'
  h += '<label ' + rot + '>Nome do time</label>'
  h += '<input data-eq-campo="nome" value="' + escHtml(e.nome || '') + '" placeholder="Tivoli, Iguatemi Campinas, Sorocaba…" ' + campo + '>'
  h += '<label ' + rot + '>O que é</label>'
  h += '<select data-eq-campo="tipo" ' + campo + '>'
    + '<option value="loja"' + (e.tipo === 'loja' ? ' selected' : '') + '>Loja — ponto físico que vende</option>'
    + '<option value="canal"' + (e.tipo === 'canal' ? ' selected' : '') + '>Canal — vende sem loja física</option>'
    + '<option value="setor"' + (e.tipo === 'setor' ? ' selected' : '') + '>Setor — não vende</option></select>'
  h += '<label ' + rot + '>Canal no Bling (é ele que traz o faturamento)</label>'
  h += '<select data-eq-campo="canal_loja_id" ' + campo + '><option value="">— ainda não tem —</option>' + opc(livres, e.canal_loja_id, 'loja_id', 'nome') + '</select>'
  h += '<div style="font-size:11px;color:var(--muted);margin-top:4px;">O nome no Bling quase nunca é o nome da casa: o time <b>Tivoli</b> usa o canal <b>Loja Santa Bárbara d\'Oeste</b>. Sem ligar, o time mostra faturamento zero.</div>'
  h += '<div data-eq-erro style="margin-top:10px;color:var(--red,#dc2626);font-size:12px;"></div>'
  h += '<div style="display:flex;gap:8px;margin-top:12px;">'
  h += '<button data-eq-salvar="' + escHtml(e.id || '') + '" style="border:none;background:var(--accent);color:#fff;border-radius:8px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer;">Salvar</button>'
  h += '<button data-eq-cancelar style="border:1px solid var(--border);background:none;color:var(--text);border-radius:8px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer;">Cancelar</button>'
  h += '</div></div>'
  return h
}

// QUEM TRABALHA NO TIME. A lista de papéis que aparece depende de quem está
// olhando — ninguém entrega um papel acima do seu.
function _eqGente(t) {
  const eu = _eqEu()
  const meu = _eqMeuPapel(t.id)
  const meus = _eqMembros.filter(m => String(m.equipe_id) === String(t.id))
  const podeDar = papeisQuePossoConceder(eu, meu)
  const nome = (id) => {
    const p = _eqPessoas.find(x => String(x.id) === String(id))
    return p ? (p.name || p.email) : '(usuário removido)'
  }
  let h = '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">'
  if (!meus.length) h += '<div style="color:var(--muted);font-size:12px;margin-bottom:10px;">Ninguém neste time ainda.</div>'
  for (const m of meus) {
    const papel = acharPapel(m.papel)
    const r = podeRemover(eu, meu, m, meus)
    h += '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border);flex-wrap:wrap;">'
    h += '<div><div style="font-size:12.5px;color:var(--text);font-weight:600;">' + escHtml(nome(m.profile_id)) + '</div>'
      + '<div style="font-size:11px;color:var(--muted);">' + escHtml(papel ? papel.explicacao : m.papel) + '</div></div>'
    h += '<div style="display:flex;gap:7px;align-items:center;">'
    if (podeDar.length) {
      h += '<select data-eq-papel="' + escHtml(m.id) + '" style="padding:5px 8px;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:11.5px;">'
        + podeDar.map(p => '<option value="' + p.id + '"' + (p.id === m.papel ? ' selected' : '') + '>' + escHtml(p.rotulo) + '</option>').join('') + '</select>'
    } else {
      h += '<span style="font-size:11.5px;color:var(--muted);">' + escHtml(papel ? papel.rotulo : m.papel) + '</span>'
    }
    if (r.pode) h += '<button data-eq-tirar="' + escHtml(m.id) + '" title="Tirar do time" style="border:1px solid var(--border);background:none;color:var(--red,#dc2626);border-radius:7px;padding:5px 10px;font-size:11.5px;cursor:pointer;">Tirar</button>'
    else h += '<span title="' + escHtml(r.porque) + '" style="font-size:11px;color:var(--muted);cursor:help;">não dá</span>'
    h += '</div></div>'
  }
  // COLOCAR GENTE. Só quem ainda não está no time aparece — oferecer quem já
  // está leva ao erro de chave repetida, que não diz nada a quem está usando.
  if (podeDar.length) {
    const dentro = new Set(meus.map(m => String(m.profile_id)))
    const fora = _eqPessoas.filter(p => !dentro.has(String(p.id)) && !p.disabled)
    h += '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;align-items:center;">'
    h += '<select data-eq-nova-pessoa style="flex:1;min-width:180px;padding:7px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:12px;">'
      + '<option value="">Escolha quem entra…</option>'
      + fora.map(p => '<option value="' + escHtml(p.id) + '">' + escHtml(p.name || p.email) + '</option>').join('') + '</select>'
    h += '<select data-eq-novo-papel style="padding:7px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:12px;">'
      + podeDar.map(p => '<option value="' + p.id + '">' + escHtml(p.rotulo) + '</option>').join('') + '</select>'
    h += '<button data-eq-por="' + escHtml(t.id) + '" style="border:none;background:var(--accent);color:#fff;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;">Colocar no time</button>'
    h += '</div>'
  }
  h += '<div style="display:flex;gap:8px;margin-top:12px;"><button data-eq-cancelar style="border:1px solid var(--border);background:none;color:var(--text);border-radius:8px;padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer;">Fechar</button></div>'
  h += '</div>'
  return h
}

function _eqLigar(body) {
  const q = (sel) => Array.from(body.querySelectorAll(sel))
  const um = (sel) => body.querySelector(sel)
  const puxar = um('[data-vd-puxar]'); if (puxar) puxar.onclick = () => _vdPuxar()
  const fechar = um('[data-vd-fechar]'); if (fechar) fechar.onclick = () => { _vdLista = []; _vdSenhas = []; _vdMotivoVazio = ''; _eqDesenhar() }
  const criarTudo = um('[data-vd-criar-tudo]'); if (criarTudo) criarTudo.onclick = () => _vdCriarContas(criarTudo)
  q('[data-vd-criar]').forEach(cb => { cb.onchange = () => { _vdEscolhas[cb.getAttribute('data-vd-criar')].criar = cb.checked } })
  q('[data-vd-email]').forEach(i => { i.oninput = () => { _vdEscolhas[i.getAttribute('data-vd-email')].email = i.value } })
  q('[data-vd-equipe]').forEach(s2 => { s2.onchange = () => { _vdEscolhas[s2.getAttribute('data-vd-equipe')].equipe_id = s2.value } })

  const novo = um('[data-eq-novo]'); if (novo) novo.onclick = () => { _eqEditando = 'novo'; _eqDesenhar() }
  q('[data-eq-editar]').forEach(b => { b.onclick = () => { _eqEditando = b.getAttribute('data-eq-editar'); _eqDesenhar() } })
  q('[data-eq-gente]').forEach(b => { b.onclick = () => { _eqEditando = 'gente:' + b.getAttribute('data-eq-gente'); _eqDesenhar() } })
  q('[data-eq-cancelar]').forEach(b => { b.onclick = () => { _eqEditando = null; _eqDesenhar() } })

  const salvar = um('[data-eq-salvar]')
  if (salvar) salvar.onclick = async () => {
    const id = salvar.getAttribute('data-eq-salvar') || null
    const val = (c) => { const el = um('[data-eq-campo="' + c + '"]'); return el ? el.value : '' }
    const dados = {
      id: id || undefined,
      nome: val('nome').trim(),
      tipo: val('tipo'),
      canal_loja_id: val('canal_loja_id') ? Number(val('canal_loja_id')) : null,
    }
    const erro = validarTime(dados, _eqTimes)
    const cxErro = um('[data-eq-erro]')
    if (erro) { if (cxErro) cxErro.textContent = erro; return }
    salvar.disabled = true; salvar.textContent = 'Salvando…'
    try {
      const corpo = { nome: dados.nome, tipo: dados.tipo, canal_loja_id: dados.canal_loja_id }
      const r = id
        ? await adFetch('equipes?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(corpo) })
        : await adFetch('equipes', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(corpo) })
      if (!r.ok) throw new Error(await r.text())
      _eqEditando = null
      await loadAdminEquipes()
      adminToast(id ? 'Time atualizado.' : 'Time criado.', true)
    } catch (e) {
      salvar.disabled = false; salvar.textContent = 'Salvar'
      if (cxErro) cxErro.textContent = 'Não consegui salvar: ' + String(e && e.message || e)
    }
  }

  q('[data-eq-papel]').forEach(sel => { sel.onchange = async () => {
    const r = await adFetch('equipes_membros?id=eq.' + encodeURIComponent(sel.getAttribute('data-eq-papel')),
      { method: 'PATCH', body: JSON.stringify({ papel: sel.value }) })
    if (!r.ok) { adminToast('Não consegui mudar o papel.', false); return }
    await loadAdminEquipes()
  } })

  q('[data-eq-tirar]').forEach(b => { b.onclick = async () => {
    const r = await adFetch('equipes_membros?id=eq.' + encodeURIComponent(b.getAttribute('data-eq-tirar')), { method: 'DELETE' })
    if (!r.ok) { adminToast('Não consegui tirar do time.', false); return }
    await loadAdminEquipes()
  } })

  const por = um('[data-eq-por]')
  if (por) por.onclick = async () => {
    const pes = um('[data-eq-nova-pessoa]'), pap = um('[data-eq-novo-papel]')
    if (!pes || !pes.value) { adminToast('Escolha quem entra no time.', false); return }
    const r = await adFetch('equipes_membros', { method: 'POST', body: JSON.stringify({ equipe_id: por.getAttribute('data-eq-por'), profile_id: pes.value, papel: pap ? pap.value : 'vendedora' }) })
    if (!r.ok) { adminToast('Não consegui colocar no time.', false); return }
    await loadAdminEquipes()
  }
}

/* ── SAÚDE DOS DADOS (legacy L4411-4522, verbatim) ── */
async function loadAdminSaude() {
  const body = document.getElementById('admin-saude-body'); if (!body) return
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  const BTNP = 'style="border:none;background:var(--accent);color:#fff;border-radius:9px;padding:10px 18px;font-size:12.5px;font-weight:700;cursor:pointer;box-shadow:0 6px 16px -8px var(--accent);"'
  const BTNS = 'style="border:1px solid var(--accent);color:var(--accent);background:transparent;border-radius:9px;padding:10px 14px;font-size:12px;font-weight:600;cursor:pointer;"'
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const ST = { ok: ['✅', '#16a34a'], warn: ['⚠️', '#d97706'], fail: ['❌', '#dc2626'] }
  const PERIODS = [0, 1, 7, 14, 30, 99]
  const post = async slug => { try { await fetch(SUPABASE_URL + '/functions/v1/' + slug, { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + (estado.currentSession?.access_token || SUPABASE_ANON_KEY), 'Content-Type': 'application/json' }, body: '{}' }) } catch (e) {} }
  const wire = () => {
    const fix = body.querySelector('.btn-fix')
    if (fix) fix.onclick = async () => { fix.disabled = true; const o = fix.textContent
      fix.textContent = '🔧 Coletando e corrigindo… (até ~1 min)'; await post('coletar-dados')
      fix.textContent = '🔎 Revalidando…'; await post('auditar-dados')
      await loadAdminSaude(); updateSaudeBadge() }
    const rev = body.querySelector('.btn-rev')
    if (rev) rev.onclick = async () => { rev.disabled = true; rev.textContent = '🔎 Revalidando…'; await post('auditar-dados'); await loadAdminSaude(); updateSaudeBadge() }
  }
  body.innerHTML = '<div style="color:var(--muted);font-size:12px">Carregando…</div>'
  const last = await sb('data_integrity_checks?select=checked_date&order=checked_date.desc&limit=1')
  const date = last.length ? last[0].checked_date : null
  const [rows, accs, engT, dayT] = await Promise.all([
    date ? sb('data_integrity_checks?checked_date=eq.' + date + '&select=account_id,check_name,status,detail,created_at&order=created_at.desc') : Promise.resolve([]),
    sb('accounts?select=id,name,username&order=name.asc'),
    sb('engagement_snapshots?captured_at=eq.' + today + '&select=account_id,period_days,likes,comments,saves,shares,reach,views,total_interactions,created_at'),
    sb('daily_snapshots?captured_at=eq.' + today + '&select=account_id,followers_count')
  ])
  const accMap = {}; accs.forEach(a => accMap[a.id] = a.name || a.username || '—')
  // ── cobertura da coleta de HOJE (ao vivo) ──
  const engBy = {}; engT.forEach(r => { (engBy[r.account_id] = engBy[r.account_id] || []).push(r) })
  const folBy = {}; dayT.forEach(r => { folBy[r.account_id] = r.followers_count })
  let lastColl = null; engT.forEach(r => { if (r.created_at && (!lastColl || r.created_at > lastColl)) lastColl = r.created_at })
  const cov = accs.map(a => {
    const e = engBy[a.id] || []; const periods = new Set(e.map(r => r.period_days))
    const missing = PERIODS.filter(p => !periods.has(p))
    const zeroBreak = e.filter(r => r.period_days >= 1 && (Number(r.total_interactions) || 0) > 0 && ((Number(r.likes) || 0) + (Number(r.comments) || 0) + (Number(r.saves) || 0) + (Number(r.shares) || 0)) === 0).map(r => r.period_days)
    const zeroReach = e.filter(r => r.period_days >= 1 && !((Number(r.reach) || 0) > 0)).map(r => r.period_days)
    const fol = Number(folBy[a.id]) || 0
    let st = 'ok'; if (!fol || missing.length === PERIODS.length) st = 'fail'; else if (zeroBreak.length || zeroReach.length) st = 'fail'; else if (missing.length) st = 'warn'
    return { a, fol, periods, missing, zeroBreak, zeroReach, st }
  })
  const covBad = cov.filter(c => c.st !== 'ok')
  const collected = cov.filter(c => c.fol > 0).length
  const complete = cov.filter(c => c.fol > 0 && c.missing.length === 0 && !c.zeroBreak.length && !c.zeroReach.length).length
  // ── auditoria (verificações noturnas) ──
  const CHECKS = [['frescor', 'Frescor'], ['bruto_seguidores', 'Bruto seg.'], ['eng_likes0', 'Curtidas'], ['aninhamento', 'Aninham.'], ['nav_soma', 'Navegação'], ['queda_seguidores', 'Queda seg.'], ['alcance_vs_views', 'Alc×Views'], ['meta_spotcheck', 'vs Meta']]
  const idx = {}; rows.forEach(r => { (idx[r.account_id] = idx[r.account_id] || {})[r.check_name] = r })
  const counts = { ok: 0, warn: 0, fail: 0 }; rows.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1 })
  const auditAt = rows.length ? new Date(rows[0].created_at).toLocaleString('pt-BR') : '—'
  const collAt = lastColl ? new Date(lastColl).toLocaleString('pt-BR') : '—'
  // saúde geral
  const totalFail = counts.fail + cov.filter(c => c.st === 'fail').length
  const totalWarn = counts.warn + cov.filter(c => c.st === 'warn').length
  const overall = totalFail ? ['❌', '#dc2626', totalFail + ' problema' + (totalFail > 1 ? 's' : '') + ' a corrigir'] : totalWarn ? ['⚠️', '#d97706', totalWarn + ' aviso' + (totalWarn > 1 ? 's' : '')] : ['✅', '#16a34a', 'Tudo saudável']
  const card = (big, lbl, col) => '<div style="flex:1 1 130px;min-width:120px;background:var(--card,#fff);border:1px solid var(--border,#e5e7eb);border-radius:12px;padding:14px 16px;"><div style="font-size:26px;font-weight:800;line-height:1;color:' + col + '">' + big + '</div><div style="font-size:10.5px;letter-spacing:.5px;text-transform:uppercase;color:var(--muted);margin-top:6px">' + lbl + '</div></div>'
  // ── header ──
  let html = '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:16px;">'
  html += '<div style="display:flex;align-items:center;gap:12px;"><div style="font-size:30px">' + overall[0] + '</div><div><div style="font-size:17px;font-weight:800;color:' + overall[1] + '">' + esc(overall[2]) + '</div><div style="font-size:11px;color:var(--muted)">Coleta: <b>' + esc(collAt) + '</b> · Auditoria: <b>' + esc(auditAt) + '</b> · auto todo dia 23:30</div></div></div>'
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-fix" ' + BTNP + '>🔧 Rodar e corrigir agora</button><button class="btn-rev" ' + BTNS + '>↻ Só revalidar</button></div></div>'
  // ── stat cards ──
  html += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px">'
    + card(collected + '/' + accs.length, 'Contas coletadas hoje', collected === accs.length ? '#16a34a' : '#d97706')
    + card(complete + '/' + accs.length, 'Coleta completa', complete === accs.length ? '#16a34a' : '#d97706')
    + card(String(totalFail), 'Problemas (❌)', totalFail ? '#dc2626' : '#16a34a')
    + card(String(totalWarn), 'Avisos (⚠️)', totalWarn ? '#d97706' : '#16a34a')
    + '</div>'
  // ── seção A: cobertura da coleta de hoje ──
  html += '<div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:8px">Coleta de hoje · por perfil</div>'
  html += '<div style="overflow-x:auto"><table class="metas-tbl"><thead><tr><th>Perfil</th><th style="text-align:center">Seguidores</th><th style="text-align:center">Períodos</th><th style="text-align:center">Curtidas</th><th style="text-align:center">Alcance</th><th style="text-align:center">Status</th></tr></thead><tbody>'
  cov.forEach(c => { const s = ST[c.st]
    html += '<tr><td style="font-weight:600">' + esc(c.a.name || c.a.username || '—') + '</td>'
      + '<td style="text-align:center;color:' + (c.fol > 0 ? '#16a34a' : '#dc2626') + '">' + (c.fol > 0 ? c.fol.toLocaleString('pt-BR') : '—') + '</td>'
      + '<td style="text-align:center;color:' + (c.missing.length ? '#d97706' : '#16a34a') + '" title="' + (c.missing.length ? 'faltam: ' + c.missing.map(p => p === 99 ? 'mês' : p + 'd').join(', ') : 'todos os 6 períodos') + '">' + (PERIODS.length - c.missing.length) + '/6</td>'
      + '<td style="text-align:center;color:' + (c.zeroBreak.length ? '#dc2626' : '#16a34a') + '" title="' + (c.zeroBreak.length ? 'zerado em: ' + c.zeroBreak.map(p => p === 99 ? 'mês' : p + 'd').join(', ') : 'ok') + '">' + (c.zeroBreak.length ? 'zerada' : 'ok') + '</td>'
      + '<td style="text-align:center;color:' + (c.zeroReach.length ? '#dc2626' : '#16a34a') + '">' + (c.zeroReach.length ? 'zerado' : 'ok') + '</td>'
      + '<td style="text-align:center;color:' + s[1] + '">' + s[0] + '</td></tr>'
  })
  html += '</tbody></table></div>'
  // ── seção B: auditoria noturna (matriz) ──
  html += '<div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin:20px 0 8px">Auditoria de qualidade · ' + (date ? esc(String(date)) : 'sem registro') + '</div>'
  if (!rows.length) { html += '<div style="font-size:12px;color:var(--muted)">Nenhuma auditoria registrada ainda — clique em “Rodar e corrigir agora”.</div>' }
  else {
    html += '<div style="overflow-x:auto"><table class="metas-tbl"><thead><tr><th>Perfil</th>' + CHECKS.map(c => '<th style="text-align:center">' + c[1] + '</th>').join('') + '</tr></thead><tbody>'
    accs.forEach(a => { html += '<tr><td style="font-weight:600">' + esc(a.name || a.username || '—') + '</td>'
      CHECKS.forEach(c => { const r = idx[a.id] && idx[a.id][c[0]]; if (!r) { html += '<td style="text-align:center;color:#cbd5e1">—</td>'; return }
        const s = ST[r.status] || ['?', '#888']; html += '<td style="text-align:center;color:' + s[1] + '" title="' + esc(r.detail) + '">' + s[0] + '</td>' })
      html += '</tr>' })
    html += '</tbody></table></div>'
  }
  // ── problemas consolidados ──
  const probsAudit = rows.filter(r => r.status !== 'ok')
  if (covBad.length || probsAudit.length) {
    html += '<div style="margin-top:20px;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted)">Problemas encontrados</div><div style="margin-top:8px;display:flex;flex-direction:column;gap:6px">'
    covBad.forEach(c => { const s = ST[c.st]; const probs = []; if (!c.fol) probs.push('sem coleta hoje'); if (c.zeroBreak.length) probs.push('curtidas zeradas (' + c.zeroBreak.map(p => p === 99 ? 'mês' : p + 'd').join(', ') + ')'); if (c.zeroReach.length) probs.push('alcance zerado (' + c.zeroReach.map(p => p === 99 ? 'mês' : p + 'd').join(', ') + ')'); if (c.missing.length && c.missing.length < PERIODS.length) probs.push('faltam períodos (' + c.missing.map(p => p === 99 ? 'mês' : p + 'd').join(', ') + ')')
      html += '<div style="font-size:12px"><span style="color:' + s[1] + '">' + s[0] + '</span> <b>' + esc(c.a.name || c.a.username || '?') + '</b> — ' + esc(probs.join(' · ')) + ' <span style="color:var(--accent);font-weight:600">→ corrigível ao rodar</span></div>' })
    probsAudit.forEach(r => { const s = ST[r.status]; const lbl = (CHECKS.find(c => c[0] === r.check_name) || ['', r.check_name])[1]
      html += '<div style="font-size:12px"><span style="color:' + s[1] + '">' + s[0] + '</span> <b>' + esc(accMap[r.account_id] || '?') + '</b> — ' + esc(lbl) + (r.detail ? ' <span style="color:var(--muted)">(' + esc(r.detail) + ')</span>' : '') + '</div>' })
    html += '</div>'
    html += '<div style="margin-top:12px;font-size:11px;color:var(--muted);background:var(--card,#f8fafc);border:1px dashed var(--border,#e5e7eb);border-radius:10px;padding:10px 12px">🔧 <b>Rodar e corrigir agora</b> recoleta da Meta com 5 tentativas e, se ela insistir em zerar, mantém o último valor válido (carry-forward) — depois revalida. Curtidas/alcance/coleta faltando são corrigidos por aqui.</div>'
  } else { html += '<div style="margin-top:16px;color:#16a34a;font-size:13px;font-weight:700">✅ Nenhum problema — coleta de hoje completa e auditoria 100% OK.</div>' }
  html += '<details style="margin-top:18px"><summary style="cursor:pointer;font-size:11px;color:var(--muted)">O que cada verificação significa</summary><div style="font-size:11px;color:var(--muted);line-height:1.8;margin-top:8px">'
    + '<b>Coleta de hoje</b> — leitura ao vivo: cada perfil precisa ter seguidores + os 6 períodos (hoje/1/7/14/30/mês) com curtidas e alcance não-zerados.<br>'
    + '<b>Frescor</b> — os dados de hoje foram coletados (seguidores + engajamento + conteúdo).<br>'
    + '<b>Bruto seg.</b> — a métrica do IG de "seguiram − deixaram de seguir" está chegando. ⚠️ quando a Meta para de entregar (problema dela; o painel cai na contagem "em consolidação").<br>'
    + '<b>Curtidas</b> — não há curtidas zeradas com interações &gt; 0 (detecta resposta incompleta da Meta).<br>'
    + '<b>Aninham.</b> — 7 dias ≤ 14 dias ≤ 30 dias (consistência entre períodos).<br>'
    + '<b>Navegação</b> — o total de navegação dos stories bate com a soma dos 4 tipos.<br>'
    + '<b>Queda seg.</b> — queda de seguidores de um dia pro outro (⚠️ &gt; 10%, ❌ &gt; 25% — erro de dado ou evento em massa).<br>'
    + '<b>Alc×Views</b> — alcance vs visualizações coerente (não pode ter views sem alcance, nem alcance &gt; views).<br>'
    + '<b>vs Meta</b> — compara curtidas e alcance (7d) do painel com a <b>Meta ao vivo</b>; ❌ se divergir &gt; 30% (pega bug conceitual).</div></details>'
  body.innerHTML = html; wire()
}

/* ── PERMISSÕES (Fase 1: matriz recurso×ação + escopo por perfil + super-admin + duplicar) ── */
let _permState = null       // { userId, permissions, allowed_accounts, is_superadmin }
let _contasCache = null     // perfis de rede (accounts)
let _usersCache = []        // lista de usuários (p/ o "duplicar")

async function openPermModal(u, opcoes) {
  const soNotificacoes = !!(opcoes && opcoes.soNotificacoes)
  _permState = {
    userId: u.id,
    permissions: JSON.parse(JSON.stringify(u.permissions || {})),
    allowed_accounts: u.allowed_accounts ?? null,
    is_superadmin: !!u.is_superadmin,
    // { vendas: true, saldo: false } — o estado resolvido (preferência salva ou
    // o padrão do tipo).
    notificacoes: {},
    // No modo "minhas notificações" o save NÃO toca em permissions/features:
    // editar os próprios privilégios é exatamente o que a tela impede.
    soNotificacoes,
  }
  // As preferências vêm por usuário; sem linha salva vale o padrão do tipo.
  let prefs = []
  try {
    const r = await adFetch(`push_preferencias?select=user_id,tipo,ativo&user_id=eq.${u.id}`)
    prefs = await r.json()
  } catch { prefs = [] }
  for (const t of TIPOS_DE_NOTIFICACAO) _permState.notificacoes[t.chave] = querReceber(prefs, u.id, t.chave)
  const sub = document.getElementById('perm-modal-user'); sub.textContent = ''
  const strong = document.createElement('strong'); strong.textContent = u.name || u.email
  sub.appendChild(strong); sub.appendChild(document.createTextNode(' · ' + u.email))
  if (!_contasCache) { try { const r = await adFetch('accounts?select=id,name&order=name'); _contasCache = await r.json() } catch { _contasCache = [] } }
  _renderPermBody(u)
  document.getElementById('perm-modal-overlay').classList.add('open')
}

// `??` e não `||`: com `||`, passar mt=0 caía no default 6 — o topo da matriz
// pede margem 0 de verdade.
function _lbl10(txt, mt) { const d = document.createElement('div'); d.textContent = txt; d.style.cssText = `font-size:10px;letter-spacing:1.5px;color:var(--muted);font-weight:700;margin:${mt ?? 6}px 0 6px`; return d }

// Checkbox "marcar/desmarcar tudo" de uma lista de recursos. O MESMO builder
// serve o global (recebe RECURSOS inteiro) e o de cada card (recebe só os
// recursos daquela ferramenta) — quem define o escopo é o parâmetro, então não
// existe uma segunda regra de "marcar tudo" pra sair de sincronia.
//
// Parcial vira indeterminate (o tracinho): 'cheio' e 'vazio' já são checked/
// unchecked, mas sem o indeterminate um grupo meio marcado mentiria dizendo
// "desmarcado". Clicar num parcial LIGA tudo (só desliga a partir do cheio).
function _mkMarcarTudo(texto, recursos, u) {
  const estadoSel = estadoDaSelecao(recursos, _permState.permissions)
  const w = document.createElement('label'); w.className = 'perm-marcar-tudo'
  const cb = document.createElement('input'); cb.type = 'checkbox'
  cb.checked = estadoSel === 'cheio'
  cb.indeterminate = estadoSel === 'parcial'
  cb.setAttribute('aria-label', `${texto} (${recursos.length} ${recursos.length === 1 ? 'recurso' : 'recursos'})`)
  cb.addEventListener('change', () => {
    _permState.permissions = marcarTudo(_permState.permissions, recursos, estadoSel !== 'cheio')
    _renderPermBody(u)
  })
  const t = document.createElement('span'); t.textContent = texto
  w.appendChild(cb); w.appendChild(t)
  return w
}

// As PRÓPRIAS notificações: mesmo card, mesmo salvamento, sem a matriz de
// permissões junto — que é justamente o que não se pode editar em si mesmo.
async function _abrirMinhasNotificacoes(u) {
  await openPermModal(u, { soNotificacoes: true })
}

// Um interruptor por tipo de notificação, com a descrição do que chega e
// quando. Sem a descrição, "Saldo" sozinho não diz se avisa todo dia ou só
// quando acaba — e quem decide ligar precisa saber o que está ligando.
function _mkBlocoNotificacoes() {
  const card = document.createElement('section'); card.className = 'perm-card'
  const hdr = document.createElement('div'); hdr.className = 'perm-card-hdr'
  const t = document.createElement('span'); t.className = 'perm-card-titulo'; t.textContent = 'Notificações no celular'
  const n = Object.values(_permState.notificacoes).filter(Boolean).length
  const c = document.createElement('span'); c.className = 'perm-card-contagem'
  c.textContent = `${n} de ${TIPOS_DE_NOTIFICACAO.length}`
  hdr.appendChild(t); hdr.appendChild(c); card.appendChild(hdr)

  const lista = document.createElement('div'); lista.className = 'perm-notif-lista'
  for (const tipo of TIPOS_DE_NOTIFICACAO) {
    const linha = document.createElement('label'); linha.className = 'perm-notif'
    const cb = document.createElement('input'); cb.type = 'checkbox'
    cb.checked = !!_permState.notificacoes[tipo.chave]
    cb.addEventListener('change', () => {
      _permState.notificacoes[tipo.chave] = cb.checked
      c.textContent = `${Object.values(_permState.notificacoes).filter(Boolean).length} de ${TIPOS_DE_NOTIFICACAO.length}`
    })
    const txt = document.createElement('div'); txt.className = 'perm-notif-txt'
    const rot = document.createElement('span'); rot.className = 'perm-notif-rot'; rot.textContent = tipo.rotulo
    const des = document.createElement('span'); des.className = 'perm-notif-des'; des.textContent = tipo.descricao
    txt.appendChild(rot); txt.appendChild(des)
    linha.appendChild(cb); linha.appendChild(txt)
    lista.appendChild(linha)
  }
  card.appendChild(lista)
  const nota = document.createElement('div'); nota.className = 'perm-notif-nota'
  nota.textContent = 'A pessoa só recebe se também tiver autorizado as notificações no aparelho dela.'
  card.appendChild(nota)
  return card
}

function _renderPermBody(u) {
  const body = document.getElementById('perm-modal-body'); body.replaceChildren()
  if (_permState.soNotificacoes) {
    // Sem o interruptor de super-admin: ninguém se promove nem se rebaixa aqui.
    body.appendChild(_mkBlocoNotificacoes())
    return
  }
  // 1) Super-admin
  const saRow = document.createElement('label'); saRow.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;border-bottom:2px solid var(--border);padding-bottom:10px;margin-bottom:8px'
  const saCb = document.createElement('input'); saCb.type = 'checkbox'; saCb.checked = _permState.is_superadmin
  saCb.addEventListener('change', () => { _permState.is_superadmin = saCb.checked; _renderPermBody(u) })
  const saTxt = document.createElement('span'); saTxt.textContent = 'Super-admin (vê tudo · gerencia permissões)'; saTxt.style.cssText = 'font-weight:700;font-size:13px'
  saRow.appendChild(saCb); saRow.appendChild(saTxt); body.appendChild(saRow)
  // 1.5) NOTIFICAÇÕES — antes do desvio de super-admin de propósito: acesso
  // total não quer dizer "recebe todo aviso no celular". Super-admin também
  // escolhe o que chega.
  body.appendChild(_mkBlocoNotificacoes())
  if (_permState.is_superadmin) {
    const info = document.createElement('div'); info.textContent = 'Super-admin tem acesso total — permissões e perfis não se aplicam.'; info.style.cssText = 'font-size:12px;color:var(--muted);padding:6px 0'
    body.appendChild(info); return
  }
  // 2) Escada de níveis por recurso, agrupada por ferramenta (um card por
  // ferramenta).
  //
  // Cada ferramenta é UMA escolha (Sem acesso / Ver / Mexer / Tudo — conforme
  // o que aquele recurso realmente tem no catálogo), não mais uma linha de 5
  // caixinhas. Era a matriz que fazia 105 células parecerem 105 escolhas
  // quando só 45 existiam de verdade, e metade dessas 45 nunca foi marcada em
  // produção (ver niveis-de-permissao.js).
  //
  // Os grupos saem de agruparRecursos(RECURSOS, PERMISSION_TREE): derivados da
  // chave ('social.relatorio' → ferramenta 'social'). Nenhuma lista de grupos
  // escrita à mão aqui — catálogo paralelo é dívida que este projeto já paga.
  const grupos = agruparRecursos(RECURSOS, PERMISSION_TREE)

  const topo = document.createElement('div'); topo.className = 'perm-matriz-topo'
  topo.appendChild(_lbl10('PERMISSÕES', 0))
  topo.appendChild(_mkMarcarTudo('Marcar tudo', RECURSOS, u))
  body.appendChild(topo)

  grupos.forEach(g => {
    const card = document.createElement('section'); card.className = 'perm-card'

    const hdr = document.createElement('div'); hdr.className = 'perm-card-hdr'
    const titulo = document.createElement('span'); titulo.className = 'perm-card-titulo'; titulo.textContent = g.label
    const { total, marcadas } = contarAcoes(g.recursos, _permState.permissions)
    const contagem = document.createElement('span'); contagem.className = 'perm-card-contagem'
    contagem.textContent = `${marcadas} de ${total}`
    hdr.appendChild(titulo); hdr.appendChild(contagem)
    hdr.appendChild(_mkMarcarTudo('Tudo', g.recursos, u))
    card.appendChild(hdr)

    // Cada recurso vira uma linha: a escada de degraus, exceto as chaves de
    // "aprovar" (frota.aprovar, conteudo.aprovar) — essas são uma caixinha só,
    // porque "Pode ver" não diz o que elas realmente liberam.
    g.recursos.forEach(r => {
      card.appendChild(APROVACOES[r.key] ? _linhaDeAprovacao(r, u) : _linhaDeNivel(r, u))
    })
    body.appendChild(card)
  })
  // 3) Perfis de rede social
  body.appendChild(_lbl10('PERFIS DE REDE SOCIAL', 12))
  const todos = document.createElement('label'); todos.style.cssText = 'display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;padding:3px 0;font-weight:600'
  const todosCb = document.createElement('input'); todosCb.type = 'checkbox'; todosCb.checked = _permState.allowed_accounts === null
  todosCb.addEventListener('change', () => { _permState.allowed_accounts = todosCb.checked ? null : []; _renderPermBody(u) })
  todos.appendChild(todosCb); todos.appendChild(document.createTextNode('Todos os perfis')); body.appendChild(todos)
  if (_permState.allowed_accounts !== null) {
    (_contasCache || []).forEach(c => {
      const w = document.createElement('label'); w.style.cssText = 'display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;padding:3px 0 3px 16px'
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = (_permState.allowed_accounts || []).includes(c.id)
      cb.addEventListener('change', () => {
        const arr = (_permState.allowed_accounts || []).slice()
        if (cb.checked) { if (!arr.includes(c.id)) arr.push(c.id) } else { const i = arr.indexOf(c.id); if (i >= 0) arr.splice(i, 1) }
        _permState.allowed_accounts = arr
      })
      w.appendChild(cb); w.appendChild(document.createTextNode(c.name)); body.appendChild(w)
    })
  }
  // 4) Duplicar de outro usuário
  body.appendChild(_lbl10('DUPLICAR PERMISSÕES DE', 12))
  const dupRow = document.createElement('div'); dupRow.style.cssText = 'display:flex;gap:6px;align-items:center'
  const dupSel = mkEl('select', 'admin-form-input'); dupSel.style.cssText = 'flex:1;font-size:12px;padding:5px'
  dupSel.appendChild(new Option('— escolher usuário —', ''))
  _usersCache.filter(x => x.id !== u.id).forEach(x => dupSel.appendChild(new Option(x.name || x.email, x.id)))
  const dupBtn = mkEl('button', 'sr-btn'); dupBtn.textContent = 'Aplicar'; dupBtn.style.cssText = 'font-size:11px;padding:6px 12px'
  dupBtn.addEventListener('click', () => {
    const src = _usersCache.find(x => x.id === dupSel.value); if (!src) return
    _permState.permissions = JSON.parse(JSON.stringify(src.permissions || {}))
    _permState.allowed_accounts = src.allowed_accounts ?? null
    _permState.is_superadmin = false
    _renderPermBody(u); adminToast('Permissões copiadas — salve para aplicar')
  })
  dupRow.appendChild(dupSel); dupRow.appendChild(dupBtn); body.appendChild(dupRow)
}

// Marcar uma ação marca 'ver' junto; desmarcar 'ver' limpa o recurso. Mantém a ordem do catálogo.
function _togglePerm(r, acao, on) {
  const cur = new Set(_permState.permissions[r.key] || [])
  if (on) { cur.add(acao); if (acao !== 'ver') cur.add('ver') }
  else { cur.delete(acao); if (acao === 'ver') cur.clear() }
  const arr = r.acoes.filter(a => cur.has(a))
  if (arr.length) _permState.permissions[r.key] = arr; else delete _permState.permissions[r.key]
}

// As duas chaves de "aprovar" só têm 'ver' no catálogo, mas "Pode ver" não diz
// o que elas realmente liberam — quem aprova requisição de veículo não está só
// "vendo" a Frota. Por isso ganham uma caixinha única com o texto por extenso,
// em vez de entrar na escada.
const APROVACOES = {
  'frota.aprovar': 'Pode aprovar requisição de veículo',
  'conteudo.aprovar': 'Pode aprovar peças para publicar',
}

// Uma ferramenta = uma escolha. Os degraus vêm do catálogo (niveis-de-
// permissao.js), então ferramenta que só deixa ver mostra dois botões, e
// ferramenta completa mostra quatro. Nada de célula vazia: era isso que fazia
// a matriz parecer ter 105 escolhas quando tinha 45.
function _linhaDeNivel(r, u) {
  const atual = _permState.permissions[r.key] || []
  const degrau = degrauDoConjunto(r, atual)   // null = conjunto fora da escada

  const linha = document.createElement('div')
  linha.className = 'perm-nivel'

  const nome = document.createElement('div')
  nome.className = 'perm-nivel-nome'
  nome.textContent = r.label            // linha inteira: o nome NUNCA corta
  linha.appendChild(nome)

  const botoes = document.createElement('div')
  botoes.className = 'perm-nivel-botoes'
  for (const d of degrausDoRecurso(r)) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'perm-degrau' + (d.chave === degrau ? ' escolhido' : '')
    b.textContent = d.rotulo
    b.onclick = () => { _aplicarDegrau(r, d.chave); _renderPermBody(u) }
    botoes.appendChild(b)
  }
  linha.appendChild(botoes)

  // CONJUNTO FORA DA ESCADA: não escolhe degrau nenhum e não aproxima. Mostra o
  // que está gravado e deixa a pessoa decidir. Aproximar mudaria acesso sem
  // ninguém ter pedido — e é justamente o que esta tela não pode fazer.
  if (atual.length && !degrau) {
    const aviso = document.createElement('div')
    aviso.className = 'perm-nivel-aviso'
    aviso.textContent = 'Personalizado: ' + atual.join(', ') + '. Escolher um nível substitui isto.'
    linha.appendChild(aviso)
  }
  return linha
}

// Aplica um degrau: grava exatamente as ações daquele degrau, e apaga a chave
// quando o degrau é "Sem acesso" — mesmo contrato do _togglePerm, onde recurso
// sem 'ver' não existe no objeto.
function _aplicarDegrau(r, chaveDoDegrau) {
  const acoes = acoesDoDegrau(r, chaveDoDegrau)
  if (!acoes.length) delete _permState.permissions[r.key]
  else _permState.permissions[r.key] = acoes
}

// Caixinha única das aprovações: mesmo _togglePerm da escada, só que sem
// degrau nenhum — é liga/desliga puro, porque só existe uma ação ('ver') a
// marcar.
function _linhaDeAprovacao(r, u) {
  const linha = document.createElement('label')
  linha.className = 'perm-nivel perm-nivel-aprovacao'
  linha.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer'
  const cb = document.createElement('input'); cb.type = 'checkbox'
  cb.checked = (_permState.permissions[r.key] || []).includes('ver')
  cb.addEventListener('change', () => { _togglePerm(r, 'ver', cb.checked); _renderPermBody(u) })
  const txt = document.createElement('span'); txt.textContent = APROVACOES[r.key]
  linha.appendChild(cb); linha.appendChild(txt)
  return linha
}

function closePermModal() {
  document.getElementById('perm-modal-overlay').classList.remove('open')
  _permState = null
}

// SENSITIVE MUTATION — PATCH em profiles.permissions/features/allowed_accounts/is_superadmin.
//
// `features` vai junto de propósito, derivado de `permissions` pela mesma
// regra que corrigiu os usuários já afetados no banco (ver derivar-features.js).
// Motivo: o FRONT lê `permissions{}` e as EDGE FUNCTIONS leem `features[]`.
// Gravar só um dos dois desincroniza os dois lados — era exatamente esse o bug
// ("sem permissão" na Análise de Campanhas, "nenhuma campanha encontrada" na
// Gestão de Tráfego). Enquanto a Onda 3 (função SQL tem_permissao(), fonte
// única — docs/superpowers/specs/2026-07-16-seguranca-e-dados-design.md) não
// existir, os dois campos TÊM de ser escritos na mesma operação.
//
// derivarFeatures() devolve null para super-admin = "não mexa no features[]".
// Nesse caso o campo fica FORA do PATCH e o valor do banco é preservado — a
// razão está explicada em derivar-features.js e não é redundância: derivar do
// `permissions` vazio de um super-admin daria [] e TIRARIA o acesso dele.
async function savePermissions() {
  if (!_permState) return
  const btn = document.getElementById('perm-save-btn'); btn.disabled = true; btn.textContent = 'Salvando...'
  // No modo "minhas notificações" o PATCH em profiles nem acontece: só as
  // preferências são gravadas.
  const features = _permState.soNotificacoes ? null
    : derivarFeatures(_permState.permissions, { ehSuperadmin: _permState.is_superadmin })
  const payload = {
    permissions: _permState.permissions,
    allowed_accounts: _permState.allowed_accounts,
    is_superadmin: _permState.is_superadmin,
  }
  if (features !== null) payload.features = features
  if (!_permState.soNotificacoes) {
    await adFetch('profiles?id=eq.' + _permState.userId, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  // NOTIFICAÇÕES: grava uma linha por tipo com o estado escolhido. Poderia
  // gravar só o que difere do padrão, mas aí "ligado por escolha" e "ligado
  // porque é o padrão" viram a mesma coisa no banco — e se o padrão mudar
  // amanhã, a escolha de quem já decidiu seria silenciosamente revertida.
  const linhas = Object.entries(_permState.notificacoes).map(([tipo, ativo]) => ({
    user_id: _permState.userId, tipo, ativo: !!ativo,
    alterado_em: new Date().toISOString(), alterado_por: estado.userId,
  }))
  if (linhas.length) {
    // upsert pela chave (user_id, tipo): regravar é o caso normal aqui.
    await adFetch('push_preferencias?on_conflict=user_id,tipo', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(linhas),
    })
  }

  btn.disabled = false; btn.textContent = 'Salvar'
  adminToast('Permissões atualizadas')
  closePermModal()
  setTimeout(loadAdminUsers, 400)
}

/* ── USUÁRIOS: lista separada por marca, local ou setor (Task 6) ──
   CORREÇÃO 1 (revisão da Task 6): a primeira versão desta lista virou só um
   DIRETÓRIO — nome, as outras duas lotações, papel — e deixou pra trás os
   controles que a lista antiga tinha (permissões, trocar papel, trocar
   senha, desativar, excluir, avatar). Isso não era escopo novo, era
   regressão: o editor de permissões que a Task 4 reconstruiu ficou
   INALCANÇÁVEL, sem nenhum botão que o chamasse. Corrigido aqui: o
   agrupamento por lotação continua (é o pedido original desta tarefa), mas
   cada pessoa GANHA DE VOLTA a linha de ações, como uma segunda fileira
   dentro do mesmo cartão — ver `_criarLinhaPessoa` e a classe `.usr-acoes`. */

// Sem acento, sem caixa: quem digita "raissa" tem de achar "Raíssa".
const _crua = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// A busca filtra ANTES de agrupar, senão os cabeçalhos mostrariam contagem que
// não corresponde ao que está na tela.
function _filtrar(linhas, termo) {
  const t = _crua(termo)
  if (!t) return linhas
  return linhas.filter((p) => _crua(p.nome).includes(t) || _crua(p.email).includes(t))
}

// A gaveta escolhida sobrevive ao recarregar — mesmo espírito do "lembrar onde
// parei" que o projeto já usa nas outras telas. try/catch porque navegador com
// armazenamento bloqueado não pode derrubar a tela inteira por causa disto.
const CHAVE_GAVETA = 'admin-agrupar-por'
function _gavetaEscolhida() {
  try { const v = localStorage.getItem(CHAVE_GAVETA); if (DIMENSOES.some((d) => d.chave === v)) return v } catch (e) {}
  return 'marca'
}
function _guardarGaveta(chave) { try { localStorage.setItem(CHAVE_GAVETA, chave) } catch (e) {} }

// O seletor é um botão por dimensão (mesma classe `.perm-degrau` da Task 4,
// que já tem 32px de altura e quebra linha).
function _desenharSeletor(alvo, atual, aoTrocar) {
  const barra = document.createElement('div')
  barra.className = 'usr-gavetas'
  const rot = document.createElement('span')
  rot.className = 'usr-gavetas-rot'; rot.textContent = 'Agrupar:'
  barra.appendChild(rot)
  for (const d of DIMENSOES) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'perm-degrau' + (d.chave === atual ? ' escolhido' : '')
    b.textContent = d.rotulo
    b.onclick = () => { _guardarGaveta(d.chave); aoTrocar(d.chave) }
    barra.appendChild(b)
  }
  alvo.appendChild(barra)
}

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// A lista inteira de colaboradores, guardada por `loadAdminUsers`. A ficha
// precisa dela para saber o que oferecer, e reler a cada abertura seria um ida
// e volta ao banco por clique.
let _colaboradores = []

// As listas das três gavetas, lidas uma vez por carregamento da tela.
let _listasDeLotacao = { marca: [], local: [], setor: [] }

// A lotação mora no cadastro de colaborador. `organizacao_id` é o LOCAL: o nome
// da coluna é histórico, o conteúdo é lugar (Sede Centro, Fábrica Conchal…).
const CAMPOS_DE_LOTACAO = [
  { chave: 'marca', rotulo: 'Marca', coluna: 'marca_id' },
  { chave: 'local', rotulo: 'Local', coluna: 'organizacao_id' },
  { chave: 'setor', rotulo: 'Setor', coluna: 'setor_id' },
]

/* ── A FICHA DA PESSOA ───────────────────────────────────────────────────────
 *
 * POR QUE FICHA E NÃO EDIÇÃO NA LINHA: são três campos de lotação por pessoa e
 * quinze pessoas. Sempre visíveis, no celular isso vira uma coluna interminável
 * e empurra as ações para longe do polegar.
 *
 * A ORDEM DAS SEÇÕES NÃO É ESTÉTICA: o vínculo vem primeiro porque a lotação
 * depende dele. Sem cadastro ligado não existe onde gravar marca, local e setor.
 */
function abrirFichaDaPessoa(p) {
  // Uma ficha por vez. Sem isto, dois cliques rápidos empilham dois painéis, e
  // fechar o de cima revela o de baixo ainda aberto — a pessoa acha que fechou
  // e não fechou.
  const jaAberta = document.querySelector('.ficha-fundo')
  if (jaAberta) jaAberta.remove()

  const fundo = mkEl('div', 'ficha-fundo')
  const caixa = mkEl('div', 'ficha-caixa')
  const fechar = () => { fundo.remove(); fecharModal() }
  // Clique no fundo fecha; clique DENTRO da caixa não (senão mexer num campo
  // fecharia a ficha na cara da pessoa).
  fundo.addEventListener('click', (e) => { if (e.target === fundo) fechar() })

  const cab = mkEl('div', 'ficha-cab')
  cab.appendChild(mkEl('div', 'ficha-titulo', p.nome))
  const x = mkEl('button', 'ficha-x'); x.type = 'button'; x.textContent = '✕'
  x.setAttribute('aria-label', 'Fechar'); x.addEventListener('click', fechar)
  cab.appendChild(x); caixa.appendChild(cab)

  const corpo = mkEl('div', 'ficha-corpo'); caixa.appendChild(corpo)
  // Ao ligar ou criar cadastro, a ficha se refaz: a lotação que estava travada
  // passa a valer, e a lista de trás precisa parar de dizer "sem cadastro".
  const refazer = () => { fechar(); loadAdminUsers() }
  _secaoVinculo(corpo, p, refazer)

  // Só passa o colaborador quando o vínculo EXISTE. Com sugestão pendente os
  // campos ficam travados de propósito: gravar num cadastro que ainda não é
  // desta pessoa seria escrever na ficha de outra.
  const v = estadoDoVinculo({ id: p.id, email: p.email }, _colaboradores)
  _secaoLotacao(corpo, v.estado === 'ligado' ? v.colaborador : null)

  // As mesmas ações da linha, aqui dentro. No celular a fileira da linha fica
  // escondida e ESTE é o único caminho — por isso a ficha precisa ter tudo.
  const u = p.bruto || {}
  const secAcesso = mkEl('div', 'ficha-sec')
  secAcesso.appendChild(mkEl('div', 'ficha-sec-tit', 'Acesso'))
  secAcesso.appendChild(_construirAcoes(p, u, {
    isSelf: u.email === estado.user?.email,
    canEdit: !u.is_superadmin || estado.is_superadmin,
  }))
  corpo.appendChild(secAcesso)

  // Só superadmin troca a senha de outra pessoa — é o que a edge function
  // exige. Mostrar o campo para quem vai receber "não autorizado" seria
  // prometer o que a tela não cumpre.
  if (estado.is_superadmin) _secaoSenha(corpo, p)

  fundo.appendChild(caixa)
  // PENDURAR DENTRO DA `.tela-admin`, NUNCA NO `body`.
  //
  // O CSS deste arquivo é `scoped`: `.tela-admin :deep(.ficha-fundo)` só casa
  // com elemento que esteja DENTRO do componente. Pendurado no `body`, a ficha
  // ficava sem uma única regra aplicada — `position: static`, sem fundo, sem
  // z-index — e em vez de um painel por cima despencava como texto cru no fim
  // da página. Foi assim que foi para produção, e foi o dono quem viu.
  const raiz = document.querySelector('.tela-admin')
  if (raiz) { raiz.appendChild(fundo); abrirModal() }
  else { fechar(); adminToast('Não consegui abrir a ficha nesta tela.', false) }
}

function _secaoVinculo(alvo, p, aoMudar) {
  const sec = mkEl('div', 'ficha-sec')
  sec.appendChild(mkEl('div', 'ficha-sec-tit', 'Cadastro de colaborador'))

  // `situacao`, e não `estado`: `estado` é o estado global de login do app,
  // importado no topo deste arquivo. Sombreá-lo aqui funcionaria hoje, e
  // quebraria calado no dia em que alguém escrevesse `estado.is_superadmin`
  // dentro desta função e recebesse `undefined`.
  const { estado: situacao, colaborador } = estadoDoVinculo({ id: p.id, email: p.email }, _colaboradores)
  const txt = mkEl('div', 'ficha-txt')

  if (situacao === 'ligado') {
    txt.textContent = 'Ligado a ' + colaborador.nome + '.'
    sec.appendChild(txt)
  } else if (situacao === 'sugestao') {
    // Montado por nós, não por innerHTML: o nome vem do banco, e escapar à mão
    // funciona até alguém esquecer uma vez. `textContent` não tem esse jeito de
    // errar.
    txt.appendChild(document.createTextNode('Achei um cadastro com este e-mail: '))
    txt.appendChild(mkEl('b', null, colaborador.nome))
    txt.appendChild(document.createTextNode('. É a mesma pessoa?'))
    sec.appendChild(txt)
    const b = mkEl('button', 'btn btn-principal', 'Sim, ligar'); b.type = 'button'
    b.addEventListener('click', () => _ligarCadastro(b, colaborador.id, p.id, aoMudar))
    sec.appendChild(b)
  } else if (situacao === 'ambiguo') {
    // Sem botão de propósito: escolher por conta própria seria chutar qual
    // pessoa recebe a lotação e o histórico.
    txt.textContent = 'Há mais de um cadastro com este e-mail. Resolva em '
      + 'Colaboradores antes de ligar — daqui não dá para saber qual é a pessoa certa.'
    sec.appendChild(txt)
  } else {
    txt.textContent = 'Esta pessoa ainda não tem cadastro de colaborador. '
      + 'Sem ele não há onde guardar marca, local e setor.'
    sec.appendChild(txt)
    const b = mkEl('button', 'btn btn-principal', 'Criar cadastro'); b.type = 'button'
    b.addEventListener('click', () => _criarCadastro(b, p, aoMudar))
    sec.appendChild(b)
  }
  alvo.appendChild(sec)
}

// Copiar com plano B: `navigator.clipboard` falha em contexto sem HTTPS e
// quando a permissão é negada. Falhar calado aqui faz o dono mandar por
// mensagem uma senha que ele não copiou.
function _copiar(texto, aoTerminar) {
  const plano2 = () => {
    try {
      const ta = document.createElement('textarea')
      ta.value = texto; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.focus(); ta.select()
      document.execCommand('copy'); ta.remove(); return true
    } catch (e) { return false }
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto).then(() => aoTerminar(true)).catch(() => aoTerminar(plano2()))
  } else { aoTerminar(plano2()) }
}

function _secaoSenha(alvo, p) {
  const sec = mkEl('div', 'ficha-sec')
  sec.appendChild(mkEl('div', 'ficha-sec-tit', 'Senha'))
  sec.appendChild(mkEl('div', 'ficha-txt',
    'Gere uma senha, copie e mande para a pessoa. '
    + 'Ela vai ser obrigada a trocar por uma dela no primeiro acesso.'))

  const inp = mkEl('input', 'admin-form-input'); inp.type = 'text'
  inp.placeholder = 'clique em Gerar'
  inp.style.cssText = 'width:100%;font-family:var(--fonte-dados);font-size:16px;margin-bottom:8px'
  sec.appendChild(inp)

  const acoes = mkEl('div'); acoes.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px'
  const gerar = mkEl('button', 'btn', 'Gerar'); gerar.type = 'button'
  gerar.addEventListener('click', () => { inp.value = gerarSenhaForte(14); inp.focus(); inp.select() })

  const copiar = mkEl('button', 'btn', 'Copiar'); copiar.type = 'button'
  copiar.addEventListener('click', () => {
    if (!inp.value) { adminToast('Gere uma senha primeiro.', false); return }
    _copiar(inp.value, (ok) => adminToast(
      ok ? 'Senha copiada.' : 'Não consegui copiar — selecione e copie à mão.', ok))
  })

  const salvar = mkEl('button', 'btn btn-principal', 'Salvar senha'); salvar.type = 'button'
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
    // A SENHA FICA NO CAMPO. É ela que o dono vai copiar e mandar; sumir agora
    // faria o botão de copiar chegar tarde demais.
    adminToast('Senha trocada. Copie e mande para a pessoa.')
  } catch (e) {
    botao.disabled = false; botao.textContent = 'Salvar senha'
    adminToast('Não consegui trocar a senha: ' + e.message, false)
  }
}

function _secaoLotacao(alvo, colaborador) {
  const sec = mkEl('div', 'ficha-sec')
  sec.appendChild(mkEl('div', 'ficha-sec-tit', 'Lotação'))

  if (!colaborador) {
    // O MOTIVO FICA ESCRITO. Campo travado sem explicação parece defeito da
    // tela; com o motivo, vira instrução.
    sec.appendChild(mkEl('div', 'ficha-txt',
      'Ligue ou crie o cadastro de colaborador acima para poder preencher.'))
  }

  for (const campo of CAMPOS_DE_LOTACAO) {
    const linha = mkEl('div', 'ficha-campo')
    linha.appendChild(mkEl('label', null, campo.rotulo))
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
    if (colaborador) {
      sel.addEventListener('change', () => _gravarLotacao(sel, colaborador.id, campo.coluna))
    }
    linha.appendChild(sel); sec.appendChild(linha)
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
    // Volta ao que era. Campo que PARECE salvo e não salvou é o defeito mais
    // caro de perceber: ninguém desconfia do que já leu como certo.
    sel.value = antes
    adminToast('Não consegui salvar: ' + error.message, false); return
  }
  sel.dataset.valorAnterior = sel.value
  adminToast('Salvo.')
}

async function _ligarCadastro(botao, colaboradorId, profileId, aoMudar) {
  botao.disabled = true; const antes = botao.textContent; botao.textContent = 'Ligando…'
  // `.is('profile_id', null)` NÃO É DECORAÇÃO: a lista que decidiu mostrar este
  // botão foi lida uma vez, e a ficha pode ficar aberta. Há três superadmins;
  // se outro tiver ligado este mesmo cadastro nesse meio-tempo, um update sem
  // essa condição sobrescreveria o vínculo dele em silêncio — dando a lotação e
  // o histórico daquela pessoa para outra. É exatamente o estrago que esta tela
  // existe para evitar, e a guarda tem de estar no BANCO, não só na tela.
  //
  // O `.select('id')` é o que permite saber se alguma linha foi mesmo afetada:
  // sem ele, zero linhas atualizadas volta como sucesso.
  const { data, error } = await sbClient.from('acessos_pessoas')
    .update({ profile_id: profileId })
    .eq('id', colaboradorId).is('profile_id', null).select('id')
  if (!error && (!data || !data.length)) {
    botao.disabled = false; botao.textContent = antes
    adminToast('Este cadastro já foi ligado a outro login enquanto esta ficha estava aberta. '
      + 'Feche e abra de novo para ver como está agora.', false)
    return
  }
  if (error) {
    // Falha não pode passar por sucesso: o dono acharia que ligou e seguiria
    // preenchendo a lotação num cadastro que continua solto.
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

// As OUTRAS duas informações — a que agrupa já está no cabeçalho, repeti-la em
// cada linha é ruído.
function _subtitulo(p, gaveta) {
  // "Sem cadastro" era MENTIRA em um caso, e foi o dono quem percebeu: a Raíssa
  // tem cadastro ativo com o e-mail idêntico ao login, só sem ninguém ter ligado
  // os dois. Dizer "sem cadastro" mandava procurar o que já existia.
  if (!p.temCadastro) {
    // `situacao` e nao `estado`: `estado` e o estado global de login do app.
    const { estado: situacao } = estadoDoVinculo({ id: p.id, email: p.email }, _colaboradores)
    if (situacao === 'sugestao') return '<span class="usr-alerta">cadastro encontrado — falta ligar</span>'
    if (situacao === 'ambiguo') return '<span class="usr-alerta">mais de um cadastro com este e-mail</span>'
    return '<span class="usr-alerta">sem cadastro de colaborador</span>'
  }
  const outras = DIMENSOES.filter((d) => d.chave !== gaveta)
    .map((d) => p[d.chave] || `sem ${d.rotulo.toLowerCase()}`)
  return esc(outras.join(' · '))
}

// Correção 2: e-mail + "desde <data>", numa terceira linha discreta abaixo
// da lotação — sem isso, duas pessoas de nome parecido na mesma gaveta só se
// distinguem abrindo "Trocar senha". Quando a pessoa NÃO tem cadastro de
// colaborador, o NOME já exibido é o próprio e-mail (`c?.nome || u.name ||
// u.email` em `loadAdminUsers`) — repetir o e-mail aqui seria eco, então só
// a data entra nesse caso. `mkEl` usa textContent, então não precisa de
// `esc()` aqui (e não deve: textContent já escapa sozinho).
function _contato(p) {
  const partes = []
  if (p.temCadastro && p.email) partes.push(p.email)
  if (p.bruto.created_at) {
    const d = new Date(p.bruto.created_at)
    if (!isNaN(d)) partes.push('desde ' + d.toLocaleDateString('pt-BR'))
  }
  return partes.join(' · ')
}

// Ações por pessoa (Correção 1): permissões, trocar papel, trocar senha,
// desativar/reativar, excluir, avatar — e "minhas notificações" pra você
// mesmo, que usa o MESMO openPermModal com soNotificacoes (é o jeito de
// evitar o bug de 2026-07-29, onde sem esse botão o dono acabou tentando
// ligar o próprio aviso e gravando na linha de outro usuário). A linha vira
// nó de DOM de verdade (não mais template de string), porque select/blur/
// upload de avatar/confirm() precisam de listener de verdade.
//
// `p.bruto` é o profile cru que `loadAdminUsers` guardou em cada linha —
// mesmos campos que a lista antiga usava (id, email, name, role,
// is_superadmin, disabled, avatar_url, allowed_accounts, permissions).
function _criarLinhaPessoa(p, gaveta, currentEmail) {
  const u = p.bruto
  const isSelf = u.email === currentEmail
  const isSuperAdmin = !!u.is_superadmin
  const canEdit = !isSuperAdmin || estado.is_superadmin // super-admin só é editável por outro super-admin

  const linha = document.createElement('div')
  linha.className = 'usr-linha'
  linha.dataset.uid = p.id
  if (u.disabled) linha.style.opacity = '.5'

  // ── topo: avatar + nome/badges/subtítulo (as outras duas lotações) + papel ──
  const topo = document.createElement('div')
  topo.className = 'usr-linha-topo'

  const avWrap = mkEl('div', 'av-wrap'); avWrap.style.cssText = 'width:32px;height:32px;'
  const av = mkEl('div'); av.style.cssText = 'width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1px solid var(--border);overflow:hidden;position:relative;'
  av.style.background = u.role === 'admin' ? 'var(--accent)' : 'var(--surface2)'
  if (u.avatar_url) { const img = mkEl('img', 'av-img'); img.src = u.avatar_url + '?t=' + Date.now(); img.alt = ''; av.appendChild(img) }
  else { const avTxt = mkEl('span'); avTxt.style.cssText = 'font-family:var(--fonte-principal);font-size:13px;font-weight:600'; avTxt.style.color = u.role === 'admin' ? '#fff' : 'var(--muted)'; avTxt.textContent = (p.nome || u.email).charAt(0).toUpperCase(); av.appendChild(avTxt) }
  const avEditBtn = mkEl('button', 'av-edit-btn'); avEditBtn.type = 'button'; avEditBtn.title = 'Trocar foto'
  avEditBtn.innerHTML = '<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'
  avEditBtn.addEventListener('click', () => _triggerAvatarUpload(u.id, (url) => {
    av.innerHTML = ''; const img = mkEl('img', 'av-img'); img.src = url + '?t=' + Date.now(); img.alt = ''; av.appendChild(img)
    // _setGubAvatar (botão de usuário global) ainda não existe no app Vue —
    // o typeof evita o ReferenceError que fazia aparecer um toast de erro falso
    // mesmo com o upload OK. Volta a funcionar sozinho se o botão global for portado.
    if (u.id === estado.userId && typeof _setGubAvatar === 'function') _setGubAvatar(url)
    adminToast('Foto atualizada!')
  }))
  avWrap.appendChild(av); avWrap.appendChild(avEditBtn)
  topo.appendChild(avWrap)

  const info = mkEl('div', 'usr-linha-info')
  const nomeWrap = mkEl('div', 'usr-nome-wrap')
  nomeWrap.appendChild(mkEl('span', 'usr-nome', p.nome))
  if (isSelf) nomeWrap.appendChild(mkEl('span', 'usr-badge', 'Você'))
  if (isSuperAdmin) nomeWrap.appendChild(mkEl('span', 'usr-badge usr-badge-super', 'SUPERADMIN'))
  info.appendChild(nomeWrap)
  const sub = mkEl('div', 'usr-sub')
  sub.innerHTML = _subtitulo(p, gaveta) // já vem escapado (ou é o span fixo de "sem cadastro")
  info.appendChild(sub)

  // O clique no bloco do nome abre a ficha. NÃO na linha inteira: a fileira de
  // ações fica logo abaixo, e clicar em "Permissões" abriria as duas coisas.
  info.style.cursor = 'pointer'
  info.title = 'Abrir a ficha de ' + (p.nome || p.email)
  info.addEventListener('click', () => abrirFichaDaPessoa(p))
  const contato = _contato(p)
  if (contato) info.appendChild(mkEl('div', 'usr-contato', contato))
  topo.appendChild(info)

  topo.appendChild(mkEl('span', 'usr-papel papel-' + p.papel, p.papel))
  linha.appendChild(topo)

  // ── ações: fileira própria, quebra livre — nunca estoura a largura do
  // cartão no celular. `.usr-acoes` no CSS garante alvo de toque >=40px.
  //
  // NO CELULAR ESTA FILEIRA FICA ESCONDIDA (ver o @media no fim do arquivo) e
  // as mesmas ações aparecem na ficha, que abre tocando no nome. Com quatro
  // controles por pessoa e quinze pessoas, a lista virava meia tela por linha,
  // com "Excluir" em vermelho a um toque de distância em todas elas.
  const acoes = _construirAcoes(p, u, { isSelf, canEdit })
  linha.appendChild(acoes)
  return linha
}

// As ações de uma pessoa, num bloco só. Usada pela LINHA (no computador) e pela
// FICHA (sempre) — uma função só para os dois, senão os dois lugares divergem
// e um deles fica com o comportamento velho sem ninguém perceber.
function _construirAcoes(p, u, { isSelf, canEdit }) {
  const acoes = mkEl('div', 'usr-acoes')

  const sel = mkEl('select', 'admin-form-input usr-acao-select')
  ;[{ v: 'viewer', l: 'Viewer' }, { v: 'admin', l: 'Admin' }].forEach(({ v, l }) => {
    const o = mkEl('option'); o.value = v; o.textContent = l; if (u.role === v) o.selected = true; sel.appendChild(o)
  })
  if (!isSelf && canEdit) {
    sel.addEventListener('change', async () => {
      await adFetch('profiles?id=eq.' + u.id, { method: 'PATCH', body: JSON.stringify({ role: sel.value }) })
      adminToast('Role atualizado'); setTimeout(loadAdminUsers, 800)
    })
  } else sel.disabled = true
  acoes.appendChild(sel)

  // A TROCA DE SENHA SAIU DAQUI e foi para a ficha da pessoa (etapa 2), onde
  // ela ganhou o botão de copiar e a senha que permanece na tela até a ficha
  // fechar. Dois caminhos para a mesma coisa é o começo de dois comportamentos
  // diferentes — e o daqui não copiava, então mandaria o dono anotar à mão.
  // A ficha abre clicando no nome da pessoa.

  if (isSelf) {
    const notifBtn = mkEl('button', 'btn usr-acao-btn'); notifBtn.type = 'button'; notifBtn.textContent = 'Minhas notificações'
    notifBtn.addEventListener('click', () => _abrirMinhasNotificacoes(u))
    acoes.appendChild(notifBtn)
  }

  if (!isSelf && canEdit) {
    const permBtn = mkEl('button', 'btn usr-acao-btn'); permBtn.type = 'button'; permBtn.textContent = 'Permissões'
    permBtn.addEventListener('click', () => openPermModal(u))
    acoes.appendChild(permBtn)

    const disBtn = mkEl('button', 'btn usr-acao-btn' + (u.disabled ? '' : ' btn-perigo'))
    disBtn.type = 'button'; disBtn.textContent = u.disabled ? 'Ativar' : 'Desativar'
    disBtn.addEventListener('click', async () => {
      await adFetch('profiles?id=eq.' + u.id, { method: 'PATCH', body: JSON.stringify({ disabled: !u.disabled }) })
      adminToast(u.disabled ? 'Usuário ativado' : 'Usuário desativado'); setTimeout(loadAdminUsers, 600)
    })
    acoes.appendChild(disBtn)

    // SENSITIVE MUTATION — exclui usuário DE VERDADE (edge function
    // invite-user com {deleteUserId}). Único confirm() do módulo Admin,
    // preservado com a MESMA mensagem/lugar do legado.
    const delBtn = mkEl('button', 'btn usr-acao-btn btn-perigo'); delBtn.type = 'button'; delBtn.textContent = 'Excluir'
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Excluir definitivamente "${u.name || u.email}"?\n\nRemove o acesso e o perfil. Esta ação NÃO pode ser desfeita.`)) return
      delBtn.disabled = true; delBtn.textContent = 'Excluindo…'
      try {
        const { data: { session: s } } = await sbClient.auth.getSession()
        const tok = s?.access_token || SUPABASE_ANON_KEY
        const r = await fetch(`${SUPABASE_URL}/functions/v1/invite-user`, { method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ deleteUserId: u.id }) })
        const res = await r.json()
        if (res.error) throw new Error(res.error)
        adminToast('Usuário excluído')
        setTimeout(loadAdminUsers, 600)
      } catch (e) {
        alert('Erro ao excluir: ' + (e.message || e))
        delBtn.disabled = false; delBtn.textContent = 'Excluir'
      }
    })
    acoes.appendChild(delBtn)
  }

  return acoes
}

function _desenharGrupos(alvo, linhas, gaveta, currentEmail) {
  const grupos = agruparPor(linhas, gaveta)
  if (!grupos.length) {
    alvo.insertAdjacentHTML('beforeend', '<div class="usr-vazio">Ninguém encontrado com esse nome.</div>')
    return
  }
  for (const g of grupos) {
    const cx = document.createElement('div')
    cx.className = 'usr-grupo' + (g.semLotacao ? ' grupo-sem' : '')
    cx.innerHTML = `
      <div class="usr-grupo-cab">
        <span>${esc(g.rotulo)} · ${g.quantos}</span>
        ${g.semLotacao ? '<span class="usr-preencher">preencher ›</span>' : ''}
      </div>`
    for (const p of g.pessoas) cx.appendChild(_criarLinhaPessoa(p, gaveta, currentEmail))
    alvo.appendChild(cx)
  }
}

/* ── USUÁRIOS (legacy L4609-4708, adaptado — ver comentário acima: a lista
   de linhas ricas virou diretório agrupado por lotação) ── */
async function loadAdminUsers() {
  // Times de venda virou seção de Usuários (Task 5): carrega junto, sem
  // esperar — tem DOM e tratamento de erro próprios (loadAdminEquipes),
  // então travar a lista de pessoas por causa dela seria pior que os dois
  // carregarem em paralelo.
  loadAdminEquipes()

  const alvo = document.getElementById('admin-user-list')

  // A lotação mora no cadastro de Colaboradores, não no login — uma verdade só.
  // `organizacao` é o LOCAL (Sede Centro, Sede Village, Fábrica Conchal): o nome
  // da coluna é histórico, o conteúdo é lugar.
  //
  // USE `sbClient`, NÃO o `sb()` desta tela: o `sb()` monta o cabeçalho com
  // `estado.currentSession?.access_token || SUPABASE_ANON_KEY` — e, com a chave
  // anônima, o PostgREST responde 200 com lista VAZIA para tabela que só abre
  // para `authenticated`. Falha que se disfarça de "não tem nada". Foi
  // exatamente isso que matou o botão "Puxar das vendedoras" em 05/08/2026
  // (ver comentário de _vdPuxar). `acessos_pessoas` está nessa situação.
  const [rp, rc] = await Promise.all([
    // avatar_url e allowed_accounts entraram na Correção 1: sem eles a foto
    // não desenha e o editor de permissões (openPermModal) recebe
    // allowed_accounts undefined em vez do valor gravado. created_at entrou
    // na Correção 2, pra mostrar "desde <data>" junto do e-mail.
    sbClient.from('profiles').select('id,email,name,role,is_superadmin,permissions,disabled,avatar_url,allowed_accounts,created_at'),
    // `id`, `email_corporativo` e `conta_apple` entraram na etapa 2 e são
    // ESSENCIAIS: sem os dois e-mails, `estadoDoVinculo` não acha candidato
    // nenhum e a Raíssa — que TEM cadastro ativo com o e-mail idêntico ao
    // login — continuaria aparecendo como "sem cadastro de colaborador". Sem o
    // `id`, ligar o cadastro mandaria `undefined` e não atualizaria nada. Os
    // dois defeitos seriam silenciosos: nenhum erro, nenhum teste vermelho.
    sbClient.from('acessos_pessoas').select(
      'id,profile_id,nome,email_corporativo,conta_apple,setor_id,organizacao_id,marca_id,'
      + 'acessos_setores(nome),acessos_organizacoes(nome),patrimonio_empresas(nome)'),
  ])
  if (rp.error || rc.error) {
    // Erro NÃO vira lista vazia: dizer "não há usuários" quando a leitura falhou
    // é a mentira mais cara desta tela.
    alvo.innerHTML = '<div class="usr-vazio">Não consegui ler os usuários: '
      + esc((rp.error || rc.error).message) + '</div>'
    return
  }
  const perfis = rp.data || []
  const pessoas = rc.data || []
  _usersCache = perfis // p/ o "duplicar permissões de outro usuário" no editor

  // AS TRÊS LISTAS SÃO ESPERADAS, e não carregadas soltas em segundo plano.
  //
  // A primeira versão usava `.then()` sem esperar, para não atrasar a lista de
  // pessoas. Mas a lista já fica clicável antes disso resolver: quem abrisse a
  // ficha de alguém JÁ LOTADO nessa janela veria os três campos em "— não
  // informado —", porque o select é montado uma vez com a lista ainda vazia.
  // Ou seja, a tela diria "não tem" para quem tem — que é exatamente a mentira
  // que esta etapa existe para consertar (o caso da Raíssa). São três consultas
  // pequenas em paralelo; o atraso não se compara ao estrago.
  const [rMarcas, rLocais, rSetores] = await Promise.all([
    sbClient.from('patrimonio_empresas').select('id,nome').order('nome'),
    sbClient.from('acessos_organizacoes').select('id,nome').order('nome'),
    sbClient.from('acessos_setores').select('id,nome').order('nome'),
  ])
  const errListas = rMarcas.error || rLocais.error || rSetores.error
  if (errListas) {
    // Select vazio pareceria "não há setores cadastrados" — mentira que faz o
    // dono achar que precisa cadastrar tudo de novo.
    adminToast('Não consegui carregar as listas de marca/local/setor: ' + errListas.message, false)
  } else {
    _listasDeLotacao = { marca: rMarcas.data || [], local: rLocais.data || [], setor: rSetores.data || [] }
  }
  // A ficha precisa da lista INTEIRA, inclusive de quem ainda não tem login:
  // é justamente entre esses que mora o cadastro a sugerir.
  _colaboradores = pessoas

  const active = perfis.filter(u => !u.disabled), admins = active.filter(u => u.role === 'admin').length
  const stats = document.getElementById('admin-stats-users'); stats.replaceChildren()
  ;[[perfis.length, 'Total'], [admins, 'Admins'], [active.length - admins, 'Viewers'], [perfis.filter(u => u.disabled).length, 'Inativos']].forEach(([v, l]) => {
    const s = mkEl('div', 'admin-stat'); s.appendChild(mkEl('div', 'admin-stat-val', String(v))); s.appendChild(mkEl('div', 'admin-stat-lbl', l)); stats.appendChild(s)
  })

  const porPerfil = {}
  for (const p of pessoas) if (p.profile_id) porPerfil[p.profile_id] = p
  const linhas = perfis.map((u) => {
    const c = porPerfil[u.id]
    return {
      id: u.id, nome: c?.nome || u.name || u.email, email: u.email,
      papel: u.is_superadmin ? 'super' : (u.role || 'viewer'),
      marca: c?.patrimonio_empresas?.nome || null,
      local: c?.acessos_organizacoes?.nome || null,
      setor: c?.acessos_setores?.nome || null,
      temCadastro: !!c, bruto: u,
    }
  })

  // A barra (seletor + busca) só é reconstruída quando a gaveta muda — trocar
  // gaveta é clique deliberado, então recriar o campo de busca ali não perde
  // nada. Já a cada tecla digitada só os GRUPOS são redesenhados: recriar o
  // <input> de busca a cada tecla derrubaria o foco/cursor no meio da digitação.
  const currentEmail = estado.user?.email || '' // quem sou eu, pra "Você" e pra travar autopromoção
  let gaveta = _gavetaEscolhida()
  let termo = ''
  const grupos = document.createElement('div')

  function _redesenharGrupos() {
    grupos.innerHTML = ''
    _desenharGrupos(grupos, _filtrar(linhas, termo), gaveta, currentEmail)
  }

  function _redesenharTudo() {
    alvo.innerHTML = ''
    _desenharSeletor(alvo, gaveta, (nova) => { gaveta = nova; _redesenharTudo() })
    const busca = mkEl('input', 'admin-form-input usr-busca')
    busca.type = 'search'
    busca.placeholder = 'Buscar por nome ou email…'
    busca.value = termo
    busca.addEventListener('input', () => { termo = busca.value; _redesenharGrupos() })
    alvo.appendChild(busca)
    alvo.appendChild(grupos)
    _redesenharGrupos()
  }
  _redesenharTudo()
}

// Mini-form de troca de senha (só superadmin). Abre inline na linha do usuário; digita OU gera.
// A troca em si roda na Edge invite-user ({resetPasswordUserId,password}), que confere superadmin
// no servidor e usa auth.admin.updateUserById (service_role nunca vai pro front).
// `_abrirTrocaSenha` foi APAGADA aqui: a troca de senha virou seção da ficha
// da pessoa, com gerar, copiar e a senha permanecendo na tela. Esta versão não
// copiava — mandava "anote e passe pro usuário".
// SENSITIVE MUTATION — cria/convida usuário DE VERDADE (edge function
// invite-user). Sem confirm() no legado; nenhum foi adicionado aqui.
async function adminInviteUser(mode) {
  const email = document.getElementById('adm-email').value.trim()
  const name = document.getElementById('adm-name').value.trim()
  const password = document.getElementById('adm-pass').value
  const role = document.getElementById('adm-role').value
  const msg = document.getElementById('adm-invite-msg')
  if (!email) { msg.textContent = 'Informe o email.'; msg.style.color = '#dc2626'; return }
  const isInvite = mode === 'invite' || !password
  if (!isInvite && password.length < 6) { msg.textContent = 'A senha precisa ter no mínimo 6 caracteres.'; msg.style.color = '#dc2626'; return }
  msg.textContent = isInvite ? 'Enviando convite...' : 'Criando acesso...'; msg.style.color = 'var(--muted)'
  const { data: { session: s } } = await sbClient.auth.getSession()
  const tok = s?.access_token || SUPABASE_ANON_KEY
  const body = isInvite ? { email, name, role } : { email, name, role, password }
  const r = await fetch(`${SUPABASE_URL}/functions/v1/invite-user`, { method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const res = await r.json()
  if (res.error) { msg.textContent = 'Erro: ' + res.error; msg.style.color = '#dc2626' }
  else {
    msg.textContent = isInvite ? '✓ Convite enviado para ' + email : '✓ Acesso criado para ' + email
    msg.style.color = '#16a34a'
    ;['adm-email', 'adm-name', 'adm-pass'].forEach(id => document.getElementById(id).value = '')
    adminToast(isInvite ? 'Convite enviado!' : 'Acesso criado com sucesso')
    setTimeout(loadAdminUsers, 1200)
  }
}

/* ── CONTAS (legacy L4711-4759, verbatim) ── */
async function loadAdminAccounts() {
  const accounts = await sb('accounts?order=name.asc&select=id,name,username,instagram_id,picture_url,accent_color')
  const c = document.getElementById('admin-accounts-list'); c.innerHTML = ''
  accounts.forEach(acc => {
    const storedColor = acc.accent_color || (PROFILE_THEMES[acc.name] || { accent: '#1A3A6B' }).accent
    const card = mkEl('div', 'sg'); card.style.marginBottom = '12px'
    const head = mkEl('div', 'sr'); head.style.cssText = 'border-bottom:1px solid var(--border);padding-bottom:0'
    const av = mkEl('div'); av.style.cssText = `width:44px;height:44px;border-radius:50%;background:${storedColor};display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;border:2px solid var(--border)`
    if (acc.picture_url) { const img = mkEl('img'); img.src = acc.picture_url; img.style.cssText = 'width:100%;height:100%;object-fit:cover'; av.appendChild(img) }
    else { const sp = mkEl('span'); sp.style.cssText = 'color:#fff;font-size:16px;font-weight:700'; sp.textContent = acc.name.charAt(0); av.appendChild(sp) }
    const hMain = mkEl('div', 'sr-main'); hMain.style.marginLeft = '12px'
    hMain.appendChild(mkEl('div', 'sr-label', acc.name))
    hMain.appendChild(mkEl('div', 'sr-sub', acc.instagram_id))
    const connBadge = mkEl('span'); connBadge.style.cssText = 'display:flex;align-items:center;gap:5px;font-family:var(--fonte-principal);font-size:11px;color:#16a34a'
    const dot = mkEl('span', 'online-dot'); connBadge.appendChild(dot); connBadge.appendChild(document.createTextNode('Conectada'))
    head.appendChild(av); head.appendChild(hMain); head.appendChild(connBadge); card.appendChild(head)
    const nameRow = mkEl('div', 'sr'); nameRow.style.justifyContent = 'space-between'; nameRow.appendChild(mkEl('div', 'sr-sub', 'Nome da conta'))
    const nameInp = mkEl('input', 'auth-input'); nameInp.value = acc.name; nameInp.style.cssText = 'max-width:220px;font-size:12px;padding:5px 10px'
    nameRow.appendChild(nameInp); card.appendChild(nameRow)
    const usrRow = mkEl('div', 'sr'); usrRow.style.justifyContent = 'space-between'; usrRow.appendChild(mkEl('div', 'sr-sub', 'Username'))
    const usrInp = mkEl('input', 'auth-input'); usrInp.value = acc.username; usrInp.style.cssText = 'max-width:220px;font-size:12px;padding:5px 10px'
    usrRow.appendChild(usrInp); card.appendChild(usrRow)
    const colorRow = mkEl('div', 'sr'); colorRow.style.justifyContent = 'space-between'; colorRow.appendChild(mkEl('div', 'sr-sub', 'Cor de destaque'))
    const colorWrap = mkEl('div'); colorWrap.style.cssText = 'display:flex;align-items:center;gap:10px'
    const colorPick = mkEl('input'); colorPick.type = 'color'; colorPick.value = storedColor; colorPick.style.cssText = 'width:36px;height:28px;border:none;border-radius:6px;cursor:pointer;background:none;padding:0'
    const colorVal = mkEl('span', 'sr-val', storedColor)
    colorPick.addEventListener('input', () => { colorVal.textContent = colorPick.value; av.style.background = colorPick.value })
    colorWrap.appendChild(colorPick); colorWrap.appendChild(colorVal); colorRow.appendChild(colorWrap); card.appendChild(colorRow)
    const actRow = mkEl('div', 'sr'); actRow.style.justifyContent = 'flex-end'; actRow.style.gap = '8px'
    const saveBtn = mkEl('button', 'btn btn-principal'); saveBtn.textContent = 'Salvar alterações'
    saveBtn.addEventListener('click', async () => {
      saveBtn.textContent = 'Salvando...'; saveBtn.disabled = true
      const { error } = await sbClient.from('accounts').update({ name: nameInp.value.trim(), username: usrInp.value.trim(), accent_color: colorPick.value }).eq('id', acc.id)
      if (error) { saveBtn.textContent = 'Salvar alterações'; saveBtn.disabled = false; adminToast('Erro ao salvar: ' + error.message, false); return }
      if (PROFILE_THEMES[acc.name]) { const t = PROFILE_THEMES[acc.name]; t.accent = colorPick.value; t.light = colorPick.value + '1a'; t.mid = colorPick.value + '4d' }
      else { PROFILE_THEMES[nameInp.value.trim()] = { accent: colorPick.value, light: colorPick.value + '1a', mid: colorPick.value + '4d' } }
      saveBtn.textContent = 'Salvo ✓'; setTimeout(() => { saveBtn.textContent = 'Salvar alterações'; saveBtn.disabled = false }, 1500)
      adminToast('Conta atualizada')
    })
    actRow.appendChild(saveBtn); card.appendChild(actRow)
    c.appendChild(card)
  })
}

/* ── APARÊNCIA (legacy L4762-4801, verbatim) ── */
/* ── DADOS (legacy L4804-4839, verbatim) ── */
async function loadAdminData() {
  const accounts = await sb('accounts?order=name.asc&select=id,name')
  const syncEl = document.getElementById('admin-data-sync')
  syncEl.innerHTML = ''; const loading = mkEl('div', 'sr'); loading.appendChild(mkEl('span', null, 'Carregando...')); syncEl.appendChild(loading)
  const [daily, eng, cnt, ads, syncResults] = await Promise.all([
    sb('daily_snapshots?select=id').then(r => r.length).catch(() => '?'),
    sb('engagement_snapshots?select=id').then(r => r.length).catch(() => '?'),
    sb('content_snapshots?select=id').then(r => r.length).catch(() => '?'),
    sb('ads_snapshots?select=id').then(r => r.length).catch(() => '?'),
    Promise.all(accounts.map(a => sb(`daily_snapshots?account_id=eq.${a.id}&order=captured_at.desc&limit=1&select=captured_at,followers_count`).then(r => ({ a, d: r[0] || null }))))
  ])
  const stats = document.getElementById('admin-data-stats'); stats.innerHTML = ''
  ;[[accounts.length, 'Contas'], [daily, 'Snapshots'], [eng, 'Engajamentos'], [cnt, 'Conteúdos'], [ads, 'Ads']].forEach(([v, l]) => {
    const s = mkEl('div', 'admin-stat'); s.appendChild(mkEl('div', 'admin-stat-val', String(v))); s.appendChild(mkEl('div', 'admin-stat-lbl', l)); stats.appendChild(s)
  })
  syncEl.innerHTML = ''
  syncResults.forEach(({ a, d }) => {
    const row = mkEl('div', 'sr'); row.style.justifyContent = 'space-between'
    const m = mkEl('div', 'sr-main'); m.appendChild(mkEl('div', 'sr-label', a.name))
    if (d) { const ago = Math.floor((Date.now() - new Date(d.captured_at)) / (864e5)); const sub = mkEl('div', 'sr-sub', `Última coleta: ${d.captured_at} (${ago === 0 ? 'hoje' : ago === 1 ? 'ontem' : ago + 'd atrás'})`); m.appendChild(sub) }
    row.appendChild(m)
    const val = mkEl('span', 'sr-val')
    if (d) { val.textContent = fmtN(d.followers_count) + ' seguidores'; val.style.color = d.followers_count > 0 ? 'var(--accent)' : 'var(--muted)' }
    else { val.textContent = 'Sem dados'; val.style.color = '#f59e0b' }
    row.appendChild(val); syncEl.appendChild(row)
  })
}
function adminShowCmd(title, cmd) {
  const el = document.getElementById('admin-action-info'); el.style.display = 'block'; el.textContent = ''
  const card = mkEl('div', 'sg'); const row = mkEl('div', 'sr'); const m = mkEl('div', 'sr-main')
  m.appendChild(mkEl('div', 'sr-label', title))
  const code = mkEl('div'); code.style.cssText = 'margin-top:8px;font-family:monospace;background:var(--surface2);padding:10px 12px;border-radius:6px;font-size:11px;line-height:1.8;white-space:pre;border:1px solid var(--border)'
  code.textContent = cmd; m.appendChild(code); row.appendChild(m); card.appendChild(row); el.appendChild(card)
}
function adminShowRefetchInfo() { adminShowCmd('Atualizar fotos de perfil', 'cd ~/IAmundi/projetos/central-inteligencia/redes-sociais/coletor\npython3 fetch_profile_pics.py') }
function adminShowColetorInfo() { adminShowCmd('Rodar coletor de dados', 'cd ~/IAmundi/projetos/central-inteligencia/redes-sociais/coletor\npython3 coletar.py') }

/* ── METAS ADMIN (legacy L4853-5076, verbatim) ── */
async function loadAdminMetas() {
  const body = document.getElementById('admin-metas-body')
  body.textContent = ''
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth() + 1
  const mesLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()
  const [lojasRes, metasRes] = await Promise.all([
    sbClient.from('bling_lojas').select('loja_id,nome').order('nome'),
    sbClient.from('bling_metas').select('loja_id,meta_valor').eq('year', y).eq('month', m)
  ])
  const lojas = lojasRes.data || []
  const metasMap = {}; (metasRes.data || []).forEach(r => metasMap[r.loja_id] = r.meta_valor)
  const hasData = Object.keys(metasMap).length > 0
  const daysInMonth = new Date(y, m, 0).getDate()

  const safeRows = hasData ? [
    ...(metasMap[0] ? [`<tr><td><strong>Total Geral</strong></td><td style="text-align:right"><strong>${escHtml(fmtR(metasMap[0]))}</strong></td><td style="text-align:right;color:var(--muted)">${escHtml(fmtR(metasMap[0] / daysInMonth))}</td></tr>`] : []),
    ...lojas.filter(l => metasMap[l.loja_id]).map(l => `<tr><td>${escHtml(l.nome)}</td><td style="text-align:right">${escHtml(fmtR(metasMap[l.loja_id]))}</td><td style="text-align:right;color:var(--muted)">${escHtml(fmtR(metasMap[l.loja_id] / daysInMonth))}</td></tr>`)
  ].join('') : null

  const html = [
    '<div class="admin-section-sub" style="margin-bottom:20px">Importe uma planilha <strong>.xlsx</strong> (Excel) com as metas por canal. Baixe o template, preencha a meta de cada dia por canal e importe. Também aceita <em>.xls</em> e <em>.csv</em>.</div>',
    '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:24px">',
    '<button class="admin-btn-sm" onclick="downloadMetasTemplate()" style="display:flex;align-items:center;gap:6px;padding:8px 16px">',
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Baixar template .xlsx</button>',
    `<label class="admin-btn-sm" style="display:flex;align-items:center;gap:6px;padding:8px 16px;cursor:pointer;background:var(--accent);color:#fff;border-color:var(--accent)">`,
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Importar planilha',
    `<input type="file" accept=".xlsx,.xls,.csv" id="metas-csv-input" style="display:none" onchange="importMetasCSV(this,${y},${m})"></label></div>`,
    '<div id="metas-import-msg" style="font-size:12px;margin-bottom:16px;display:none"></div>',
    hasData ? `<div class="sg-label">Metas actuais — ${escHtml(mesLabel)}</div><div class="sg"><table class="metas-tbl"><thead><tr><th>Canal / Loja</th><th style="text-align:right">Meta (R$)</th><th style="text-align:right">Meta/dia*</th></tr></thead><tbody>${safeRows}</tbody></table><div style="font-size:10px;color:var(--muted);padding:8px 0">*Meta diária = meta mensal ÷ dias do mês</div></div>`
      : '<div style="color:var(--muted);font-size:12px;padding:8px 0">Nenhuma meta cadastrada para este mês. Importe uma planilha para começar.</div>'
  ].join('')
  body.innerHTML = html
  await loadAdminVendMetas(body, y, m, mesLabel)
}

async function downloadMetasTemplate() {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth() + 1
  const daysInMonth = new Date(y, m, 0).getDate()
  const [{ data: lojas }, { data: metas }] = await Promise.all([
    sbClient.from('bling_lojas').select('loja_id,nome').order('nome'),
    sbClient.from('bling_metas').select('loja_id,meta_valor,daily_goals').eq('year', y).eq('month', m)
  ])
  const metasMap = {}; const dailyMap = {}
  ;(metas || []).forEach(r => { metasMap[r.loja_id] = r.meta_valor; if (r.daily_goals) dailyMap[r.loja_id] = r.daily_goals })
  const dayHdrs = Array.from({ length: daysInMonth }, (_, i) => `dia_${String(i + 1).padStart(2, '0')}`)
  const makeRow = (id, nome) => {
    const dg = dailyMap[id] || {}
    return [id, nome, ...Array.from({ length: daysInMonth }, (_, i) => dg[i + 1] != null ? Number(dg[i + 1]) : '')]
  }
  const rows = [['loja_id', 'nome', ...dayHdrs], makeRow(0, 'Total Geral'), ...(lojas || []).map(l => makeRow(l.loja_id, l.nome))]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!freeze'] = { xSplit: 2, ySplit: 1, topLeftCell: 'C2', activePane: 'bottomLeft', state: 'frozen' }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Metas')
  XLSX.writeFile(wb, `metas_template_${y}_${String(m).padStart(2, '0')}.xlsx`)
}

async function importMetasCSV(input, y, m) {
  const file = input.files[0]
  if (!file) return
  showMetasMsg('Lendo arquivo...', false, true)
  try {
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array', cellDates: false, raw: false })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    if (!data.length) { showMetasMsg('Arquivo vazio.', true); return }
    const hdr = data[0].map(h => String(h == null ? '' : h).trim().toLowerCase())
    const idxId = hdr.indexOf('loja_id')
    const idxTotal = hdr.findIndex(h => h === 'meta_total' || h === 'meta_valor')
    const dayMap = []; hdr.forEach((h, i) => { const mt = /^dia_(\d+)$/.exec(h); if (mt) dayMap.push({ i, d: parseInt(mt[1]) }) })
    if (idxId < 0 || (idxTotal < 0 && !dayMap.length)) {
      const preview = hdr.filter(Boolean).slice(0, 5).join(' | ') || '(nenhuma)'
      showMetasMsg('Coluna loja_id nao encontrada. Colunas: ' + preview + '. Use o template.', true)
      return
    }
    const toNum = v => { if (typeof v === 'number') return isNaN(v) ? NaN : v; const s = String(v).trim().replace(/[R$\s]/g, ''); const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.'); return parseFloat(lc > ld ? s.replace(/\./g, '').replace(',', '.') : s) }
    const rows = []
    for (let i = 1; i < data.length; i++) {
      const row = data[i]
      const id = parseInt(String(row[idxId] || ''))
      if (isNaN(id)) continue
      const dg = {}; let sumDays = 0
      dayMap.forEach(({ i: ci, d: day }) => { const v = toNum(row[ci]); if (!isNaN(v) && v > 0) { dg[day] = v; sumDays += v } })
      const val = sumDays > 0 ? sumDays : (idxTotal >= 0 ? toNum(row[idxTotal]) : NaN)
      if (!isNaN(id) && !isNaN(val) && val > 0) {
        const rec = { loja_id: id, year: y, month: m, meta_valor: val }
        if (sumDays > 0) rec.daily_goals = dg
        rows.push(rec)
      }
    }
    if (!rows.length) { showMetasMsg('Nenhum valor valido encontrado. Verifique loja_id e valores nos dias.', true); return }
    showMetasMsg(`Importando ${rows.length} metas...`, false, true)
    const { error: delErr } = await sbClient.from('bling_metas').delete().eq('year', y).eq('month', m)
    if (delErr) { showMetasMsg('Erro ao limpar metas anteriores: ' + delErr.message, true); return }
    const { error } = await sbClient.from('bling_metas').insert(rows)
    if (error) { showMetasMsg('Erro ao salvar: ' + error.message, true) }
    else { showMetasMsg(`${rows.length} meta${rows.length !== 1 ? 's' : ''} importada${rows.length !== 1 ? 's' : ''}!`, false); loadAdminMetas() }
  } catch (e) { showMetasMsg('Erro ao ler arquivo: ' + e.message, true) }
  input.value = ''
}

async function loadAdminVendMetas(parentBody, y, m, mesLabel) {
  const [vendsRes, vendMetasRes] = await Promise.all([
    sbClient.from('bling_vendedores').select('vendor_id,nome').order('nome'),
    sbClient.from('bling_vendedor_metas').select('vendor_id,meta_valor').eq('year', y).eq('month', m)
  ])
  const vends = vendsRes.data || []
  const vendMetasMap = {}; (vendMetasRes.data || []).forEach(r => vendMetasMap[r.vendor_id] = r.meta_valor)
  const diasMes = new Date(y, m, 0).getDate()
  const hasVendData = Object.keys(vendMetasMap).length > 0

  const sec = document.createElement('div'); sec.style.marginTop = '32px'
  const hdr = document.createElement('div'); hdr.className = 'sg-label'; hdr.textContent = 'METAS DE VENDEDORAS'
  sec.appendChild(hdr)

  const desc = document.createElement('div'); desc.className = 'admin-section-sub'; desc.style.marginBottom = '20px'
  desc.textContent = 'Baixe o template, preencha as metas diárias por vendedora e importe.'
  sec.appendChild(desc)

  const btnRow = document.createElement('div'); btnRow.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:24px'

  const dlBtn = document.createElement('button'); dlBtn.className = 'admin-btn-sm'; dlBtn.style.cssText = 'display:flex;align-items:center;gap:6px;padding:8px 16px'; dlBtn.textContent = 'Baixar template .xlsx'
  dlBtn.addEventListener('click', () => downloadVendedoresTemplate())
  btnRow.appendChild(dlBtn)

  const label = document.createElement('label'); label.className = 'admin-btn-sm'; label.style.cssText = 'display:flex;align-items:center;gap:6px;padding:8px 16px;cursor:pointer;background:var(--accent);color:#fff;border-color:var(--accent)'
  label.textContent = 'Importar planilha'
  const fileInput = document.createElement('input'); fileInput.type = 'file'; fileInput.accept = '.xlsx,.xls,.csv'; fileInput.style.display = 'none'; fileInput.id = 'vend-metas-csv-input'
  fileInput.addEventListener('change', function () { importVendedoresCSV(this, y, m) })
  label.appendChild(fileInput)
  btnRow.appendChild(label)
  sec.appendChild(btnRow)

  const msgEl = document.createElement('div'); msgEl.id = 'vend-metas-import-msg'; msgEl.style.cssText = 'font-size:12px;margin-bottom:16px;display:none'
  sec.appendChild(msgEl)

  if (hasVendData) {
    const tblTitle = document.createElement('div'); tblTitle.className = 'sg-label'; tblTitle.textContent = 'Metas actuais — ' + mesLabel; sec.appendChild(tblTitle)
    const sg = document.createElement('div'); sg.className = 'sg'
    const tbl = document.createElement('table'); tbl.className = 'metas-tbl'
    const thead = document.createElement('thead')
    const hr = document.createElement('tr')
    ;['Vendedora', 'Meta (R$)', 'Meta/dia'].forEach(h => { const th = document.createElement('th'); th.textContent = h; hr.appendChild(th) })
    thead.appendChild(hr); tbl.appendChild(thead)
    const tbody = document.createElement('tbody')
    vends.filter(v => vendMetasMap[v.vendor_id]).forEach(v => {
      const tr = document.createElement('tr')
      const nm = document.createElement('td'); nm.textContent = v.nome; tr.appendChild(nm)
      const mv = document.createElement('td'); mv.style.textAlign = 'right'; mv.textContent = fmtR(vendMetasMap[v.vendor_id]); tr.appendChild(mv)
      const md = document.createElement('td'); md.style.cssText = 'text-align:right;color:var(--muted)'; md.textContent = fmtR(vendMetasMap[v.vendor_id] / diasMes); tr.appendChild(md)
      tbody.appendChild(tr)
    })
    tbl.appendChild(tbody); sg.appendChild(tbl); sec.appendChild(sg)
  } else {
    const empty = document.createElement('div'); empty.style.cssText = 'color:var(--muted);font-size:12px;padding:8px 0'; empty.textContent = 'Nenhuma meta de vendedora para este mês.'; sec.appendChild(empty)
  }
  parentBody.appendChild(sec)
}

async function downloadVendedoresTemplate() {
  const now = new Date(); const y = now.getFullYear(), m = now.getMonth() + 1; const diasMes = new Date(y, m, 0).getDate()
  const [{ data: vends }, { data: metas }] = await Promise.all([
    sbClient.from('bling_vendedores').select('vendor_id,nome').order('nome'),
    sbClient.from('bling_vendedor_metas').select('vendor_id,daily_goals').eq('year', y).eq('month', m)
  ])
  const dailyMap = {}; (metas || []).forEach(r => { if (r.daily_goals) dailyMap[r.vendor_id] = r.daily_goals })
  const dayHdrs = Array.from({ length: diasMes }, (_, i) => String(i + 1))
  const makeRow = (id, nome) => { const dg = dailyMap[id] || {}; return [id, nome, ...Array.from({ length: diasMes }, (_, i) => dg[i + 1] != null ? Number(dg[i + 1]) : '')] }
  const rows = [['vendor_id', 'nome', ...dayHdrs], ...(vends || []).map(v => makeRow(v.vendor_id, v.nome))]
  const ws = XLSX.utils.aoa_to_sheet(rows); ws['!freeze'] = { xSplit: 2, ySplit: 1, topLeftCell: 'C2', activePane: 'bottomLeft', state: 'frozen' }
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'MetasVendedoras')
  XLSX.writeFile(wb, `metas_vendedoras_${y}_${String(m).padStart(2, '0')}.xlsx`)
}

async function importVendedoresCSV(input, y, m) {
  const msgEl = document.getElementById('vend-metas-import-msg')
  if (msgEl) { msgEl.style.display = 'block'; msgEl.textContent = 'Processando...' }
  try {
    const file = input.files[0]; if (!file) return
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    if (rows.length < 2) { throw new Error('Planilha vazia') }
    const header = rows[0].map(h => String(h).trim())
    const idIdx = header.indexOf('vendor_id')
    if (idIdx < 0) throw new Error('Coluna vendor_id não encontrada')
    const dayIdxs = []; for (let c = 0; c < header.length; c++) { const n = parseInt(header[c]); if (!isNaN(n) && n >= 1 && n <= 31) dayIdxs.push({ col: c, day: n }) }
    const records = []
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r]; const id = parseInt(row[idIdx]); if (!id || isNaN(id)) continue
      const goals = {}; let total = 0
      dayIdxs.forEach(({ col, day }) => { const v = parseFloat(row[col]) || 0; if (v > 0) { goals[String(day)] = v; total += v } })
      records.push({ vendor_id: id, year: y, month: m, meta_valor: total, daily_goals: goals })
    }
    for (const rec of records) {
      const { error } = await sbClient.from('bling_vendedor_metas').upsert(rec, { onConflict: 'vendor_id,year,month' })
      if (error) throw error
    }
    if (msgEl) { msgEl.style.color = 'var(--accent)'; msgEl.textContent = records.length + ' vendedora(s) importada(s) com sucesso.' }
    adminToast('Metas de vendedoras importadas')
  } catch (e) {
    if (msgEl) { msgEl.style.color = '#ef4444'; msgEl.textContent = 'Erro: ' + e.message }
    adminToast('Erro ao importar: ' + e.message, false)
  }
  input.value = ''
}

function showMetasMsg(text, isErr, neutral) {
  const msg = document.getElementById('metas-import-msg')
  if (!msg) return
  msg.style.color = neutral ? 'var(--muted)' : isErr ? 'var(--red)' : 'var(--green)'
  msg.textContent = text
  msg.style.display = 'block'
}

/* ── SOLICITAÇÕES ADMIN (legacy L5078-5213, verbatim) ── */
async function loadAdminRequests() {
  const body = document.getElementById('admin-requests-body')
  body.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:16px 0">Carregando...</div>'
  const { data, error } = await sbClient.from('access_requests').select('*').order('created_at', { ascending: false })
  if (error || !data) { body.innerHTML = '<div style="color:var(--red);font-size:12px">Erro ao carregar solicitações.</div>'; return }
  if (!data.length) { body.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:16px 0">Nenhuma solicitação de acesso.</div>'; return }
  const statusLabel = { pending: 'Pendente', approved: 'Aprovado', denied: 'Negado' }
  const statusColor = { pending: 'var(--yellow)', approved: 'var(--green)', denied: 'var(--red)' }
  const wrap = document.createElement('div'); wrap.className = 'sg'
  data.forEach(r => {
    const row = document.createElement('div'); row.className = 'sr'; row.style.cssText = 'justify-content:space-between;flex-wrap:wrap;gap:8px'; row.id = 'req-row-' + r.id
    const main = document.createElement('div'); main.className = 'sr-main'
    const lbl = document.createElement('div'); lbl.className = 'sr-label'
    lbl.textContent = r.name || ''
    const muted = document.createElement('span'); muted.style.cssText = 'color:var(--muted);font-weight:400'; muted.textContent = ' — ' + (r.email || '')
    lbl.appendChild(muted)
    const sub = document.createElement('div'); sub.className = 'sr-sub'; sub.textContent = (r.message || 'Sem mensagem') + ' · ' + new Date(r.created_at).toLocaleDateString('pt-BR')
    main.appendChild(lbl); main.appendChild(sub)
    const ctrl = document.createElement('div'); ctrl.style.cssText = 'display:flex;align-items:center;gap:8px;flex-shrink:0'
    const badge = document.createElement('span'); badge.style.cssText = `font-size:10px;font-weight:600;color:${statusColor[r.status] || 'var(--muted)'};letter-spacing:1px;text-transform:uppercase`; badge.textContent = statusLabel[r.status] || r.status
    ctrl.appendChild(badge)
    if (r.status === 'pending') {
      const apv = document.createElement('button'); apv.className = 'admin-btn-sm'; apv.style.cssText = 'background:var(--green);color:#fff'; apv.textContent = 'Aprovar'; apv.addEventListener('click', () => handleRequest(r.id, 'approved'))
      const den = document.createElement('button'); den.className = 'admin-btn-sm'; den.style.cssText = 'background:var(--red);color:#fff'; den.textContent = 'Negar'; den.addEventListener('click', () => handleRequest(r.id, 'denied'))
      ctrl.appendChild(apv); ctrl.appendChild(den)
    }
    row.appendChild(main); row.appendChild(ctrl); wrap.appendChild(row)
  })
  body.innerHTML = ''; body.appendChild(wrap)
}
// SENSITIVE MUTATION — aprova/nega solicitação de acesso real. Sem confirm()
// no legado; nenhum foi adicionado aqui.
async function handleRequest(id, status) {
  await sbClient.from('access_requests').update({ status }).eq('id', id)
  loadAdminRequests()
}

/* ── Fechar (voltar para a Central) — adapta closeAdmin do legado (legacy
   L4389: display:none + showHome()) para navegação por rota ── */
function closeAdmin() {
  router.push({ name: 'inicio' })
}

onMounted(() => {
  // Fase 1 permissões: só SUPER-ADMIN acessa a Administração (fim do "admin total").
  if (!estado.is_superadmin) {
    adminToast('Sem acesso', false)
    router.push({ name: 'inicio' })
    return
  }
  loadAdminSection('users')
})
// Nenhum timer/listener de documento é criado pelo módulo Admin em si —
// updateSaudeBadge/loadAdminSaude/loadAdminSection rodam uma vez por
// navegação (não em setInterval), e o único document-level listener do
// legado relacionado a este módulo (fechar o menu do usuário global ao
// clicar fora, legacy L5470) pertence ao "botão global do usuário", uma
// feature que ainda não foi portada — não faz parte deste componente. Por
// isso onUnmounted fica vazio (nada para limpar).
onUnmounted(() => {})

// Exposição em window: todas as funções chamadas por onclick="..."/
// onchange="..." literais no <template> acima e dentro das strings de
// innerHTML geradas por loadAdminMetas (loadAdminSection, adminInviteUser,
// adminSaveSetting, adminShowRefetchInfo, adminShowColetorInfo,
// downloadMetasTemplate, importMetasCSV, openPermModal*, closePermModal,
// savePermissions, handleRequest*). (*openPermModal e handleRequest são hoje
// disparados via addEventListener dentro de loadAdminUsers/loadAdminRequests
// — não por atributo onclick literal — mas ficam expostos também, sem custo,
// por robustez.) closeAdmin NÃO entra aqui: é o botão "Voltar" e virou
// binding Vue (@click) direto no <template>.
Object.assign(window, {
  loadAdminSection,
  adminInviteUser,
  adminShowRefetchInfo,
  adminShowColetorInfo,
  downloadMetasTemplate,
  importMetasCSV,
  openPermModal,
  closePermModal,
  savePermissions,
  handleRequest,
})
</script>

<style scoped>
/* Porte das regras admin- e #admin- (Módulo Admin, legacy/index.html
   L505-554 + L628-647 + L1397-1400) que #admin-screen usa de fato, MOVIDAS
   para cá (removidas do global — CSS PEEL RULE: só o que é literalmente
   prefixado admin- ou #admin- sai do global; ver relatório para a lista
   completa). A tela Redes Sociais tem seu PRÓPRIO painel embutido usando
   alguns nomes parecidos (admin-panel id, admin-title, admin-grid,
   admin-select, admin-action-btn, admin-msg) — já com cópia scoped própria,
   não afetada por esta remoção; este componente não usa esses seletores
   (são de outro widget) e por isso não os duplica aqui.
   Além disso, ficam aqui (DUPLICADOS, mas MANTIDOS no global também — não
   têm o prefixo admin-, então a regra de remoção não se aplica): .sr/.sg*
   .av-edit-btn/.av-img e o modal de permissões .perm-*. */
/* Fundo TRANSPARENTE: o #bg-shapes (degradê + ícones) fica fixo atrás de tudo
   pra aparecer, e o body já pinta a cor base nos DOIS temas. Pintar cor sólida
   aqui tapava a decoração e ainda deixava uma faixa visível onde a tela
   terminava. */
.tela-admin{min-height:100vh;display:flex;flex-direction:column;background:transparent;}
.tela-admin :deep(.admin-topbar){display:flex;align-items:center;justify-content:space-between;padding:13px 24px;border-bottom:1px solid var(--border);background:var(--surface);position:sticky;top:0;z-index:10;}
.tela-admin :deep(.admin-topbar-back){display:flex;align-items:center;gap:6px;font-family:var(--fonte-principal);font-size:13px;color:var(--accent);cursor:pointer;background:none;border:none;padding:0;letter-spacing:.2px;}
.tela-admin :deep(.admin-topbar-title){font-family:var(--fonte-principal);font-size:15px;font-weight:500;letter-spacing:2.5px;text-transform:uppercase;color:var(--text);}
.tela-admin :deep(.admin-layout){display:grid;grid-template-columns:210px 1fr;min-height:calc(100vh - 50px);}
.tela-admin :deep(.admin-sidebar){border-right:1px solid var(--border);padding:12px 8px;background:var(--surface2);overflow-y:auto;}
.tela-admin :deep(.admin-nav-group-label){font-family:var(--fonte-principal);font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(10,10,18,.35);padding:14px 12px 4px;margin-top:4px;}
.tela-admin :deep(.admin-nav-group-label:first-child){margin-top:0;}
.tela-admin :deep(.admin-nav-item){display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:var(--radius-md);cursor:pointer;transition:all .15s;font-family:var(--fonte-principal);font-size:13px;color:var(--text);margin-bottom:1px;user-select:none;}
.tela-admin :deep(.admin-nav-item:hover){background:var(--surface);}
.tela-admin :deep(.admin-nav-item.active){background:var(--accent-light);color:var(--accent);}
.tela-admin :deep(.admin-nav-item svg){flex-shrink:0;opacity:.6;}
.tela-admin :deep(.admin-nav-item.active svg){opacity:1;}
.tela-admin :deep(.admin-content){padding:36px 44px;overflow-y:auto;max-height:calc(100vh - 50px);}
.tela-admin :deep(.admin-section){display:none;}
.tela-admin :deep(.admin-section.active){display:block;}
.tela-admin :deep(.admin-section-title){font-family:var(--fonte-principal);font-size:22px;font-weight:500;letter-spacing:1.5px;text-transform:uppercase;color:var(--text);margin-bottom:3px;}
.tela-admin :deep(.admin-section-sub){font-family:var(--fonte-principal);font-size:12px;color:var(--muted);margin-bottom:28px;}
/* Faixa de aviso da Saúde dos dados, montada em updateSaudeBadge() (Task 5) —
   substitui a bolinha vermelha que morava no item da barra que não existe mais. */
/* Mesma história da `.grupo-sem`: era âmbar fixo e virava uma barra branca no
   tema escuro.
   O ÂMBAR FICA NA BORDA E NO FUNDO, ONDE ELE É SINAL; O TEXTO USA `--text`.
   Medido: o `--orange` do tema claro (#b85800) sobre esse fundo dá 4,14 de
   contraste — abaixo do mínimo de 4,5 para texto de 12px, e nenhuma proporção
   da mistura conserta (a 4% ainda dá 4,48). Com `--text` são 15,2 no claro e
   14,0 no escuro. Aviso que não se lê não avisa. */
.tela-admin :deep(.saude-faixa){background:color-mix(in srgb, var(--orange) 10%, var(--surface));border:1px solid color-mix(in srgb, var(--orange) 38%, var(--surface));color:var(--text);border-radius:10px;padding:10px 12px;font-size:12px;margin-bottom:14px;cursor:pointer;}
.tela-admin :deep(.admin-stats){display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-bottom:24px;}
.tela-admin :deep(.admin-stat){background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;text-align:center;}
.tela-admin :deep(.admin-stat-val){font-family:var(--fonte-dados);font-size:30px;font-weight:500;color:var(--accent);}
.tela-admin :deep(.admin-stat-lbl){font-family:var(--fonte-principal);font-size:9px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-top:3px;}
@media(max-width:768px){
  .tela-admin :deep(.admin-layout){grid-template-columns:1fr;}
  .tela-admin :deep(.admin-sidebar){display:flex;overflow-x:auto;border-right:none;border-bottom:1px solid var(--border);padding:8px;gap:4px;}
  .tela-admin :deep(.admin-nav-group-label){display:none;}
  .tela-admin :deep(.admin-content){padding:20px 16px;}
}
.tela-admin :deep(.admin-btn-sm){font-family:var(--fonte-principal);font-size:10px;color:#fff;background:var(--accent);border:none;border-radius:3px;padding:5px 10px;cursor:pointer;letter-spacing:.6px;white-space:nowrap;transition:opacity .18s;text-transform:uppercase;}
.tela-admin :deep(.admin-btn-sm:hover){opacity:.85;}
/* .admin-input-row aparecia DUAS vezes no CSS global (grid, depois flex) — a
   segunda definição vencia a cascata; reproduzimos a mesma ordem aqui para o
   resultado visual ficar idêntico. */
.tela-admin :deep(.admin-input-row){display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:14px 16px;}
.tela-admin :deep(.admin-input-row){display:flex;gap:8px;margin-bottom:10px;}
.tela-admin :deep(.admin-input){flex:1;padding:9px 12px;background:var(--surface2);border:1.5px solid var(--border);border-radius:3px;color:var(--text);font-family:var(--fonte-principal);font-size:13px;outline:none;transition:border-color .18s;}
.tela-admin :deep(.admin-input:focus){border-color:var(--accent);}
.tela-admin :deep(.admin-form-label){font-family:var(--fonte-principal);font-size:9px;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;display:block;margin-bottom:6px;font-weight:600;}
.tela-admin :deep(.admin-form-input){width:100%;padding:9px 12px;background:var(--surface2);border:1.5px solid var(--border);border-radius:3px;color:var(--text);font-family:var(--fonte-principal);font-size:13px;outline:none;transition:border-color .18s;box-sizing:border-box;}
.tela-admin :deep(.admin-form-input:focus){border-color:var(--accent);}
.tela-admin :deep(.admin-form-input::placeholder){color:var(--muted);opacity:.7;}

/* ── Design system de linhas/grupos (.sr/.sg*, legacy L528-542) — genérico,
   usado por várias telas; cada uma traz sua própria cópia, MANTIDO no
   global também (não é .admin-*). ── */
.tela-admin :deep(.sg-label){font-family:var(--fonte-principal);font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(10,10,18,.35);padding:0 4px 6px;margin-top:18px;display:block;}
.tela-admin :deep(.sg){background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:4px;}
.tela-admin :deep(.sr){display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);transition:background .15s;}
.tela-admin :deep(.sr:last-child){border-bottom:none;}
.tela-admin :deep(.sr.clickable){cursor:pointer;}
.tela-admin :deep(.sr.clickable:hover){background:var(--surface2);}
.tela-admin :deep(.sr-icon){width:32px;height:32px;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.tela-admin :deep(.sr-main){flex:1;}
.tela-admin :deep(.sr-label){font-family:var(--fonte-principal);font-size:13px;color:var(--text);font-weight:500;}
.tela-admin :deep(.sr-sub){font-family:var(--fonte-principal);font-size:11px;color:var(--muted);margin-top:1px;}
.tela-admin :deep(.sr-val){font-family:var(--fonte-principal);font-size:12px;color:var(--muted);white-space:nowrap;}
.tela-admin :deep(.sr-btn){font-family:var(--fonte-principal);font-size:11px;color:var(--accent);cursor:pointer;background:var(--accent-light);border:none;padding:5px 12px;border-radius:5px;transition:all .15s;white-space:nowrap;}
.tela-admin :deep(.sr-btn:hover){background:var(--accent);color:#fff;}
.tela-admin :deep(.sr-btn.danger){color:#dc2626;background:rgba(220,38,38,.08);}
.tela-admin :deep(.sr-btn.danger:hover){background:#dc2626;color:#fff;}
.tela-admin :deep(.online-dot){width:8px;height:8px;border-radius:50%;background:#22c55e;flex-shrink:0;}

/* ── Tabela de metas/saúde (.metas-tbl, legacy L1358-1361) — genérico,
   MANTIDO no global também. ── */
.tela-admin :deep(.metas-tbl){width:100%;border-collapse:collapse;}
.tela-admin :deep(.metas-tbl th){font-family:var(--fonte-principal);font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);padding:7px 10px;text-align:left;border-bottom:1px solid var(--border);}
.tela-admin :deep(.metas-tbl td){font-family:var(--fonte-principal);font-size:12px;padding:8px 10px;border-bottom:1px solid var(--border);}
.tela-admin :deep(.metas-tbl tr:last-child td){border-bottom:none;}

/* ── Avatar editável na lista de usuários (.av-*, legacy L1377-1380) —
   genérico, MANTIDO no global também. ── */
.tela-admin :deep(.av-wrap){position:relative;flex-shrink:0;}
.tela-admin :deep(.av-edit-btn){position:absolute;bottom:-2px;right:-2px;width:16px;height:16px;border-radius:50%;background:var(--accent);border:1.5px solid var(--bg);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;opacity:0;transition:opacity .15s;}
.tela-admin :deep(.av-wrap:hover .av-edit-btn){opacity:1;}
.tela-admin :deep(.av-img){width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;}

/* ── Modal de permissões (.perm-*, legacy L1402-1423) — não é .admin-*,
   MANTIDO no global também; duplicado aqui pois o modal foi trazido para
   dentro da raiz deste componente. ── */
.tela-admin :deep(.perm-overlay){position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:3000;display:none;align-items:center;justify-content:center;backdrop-filter:blur(4px);touch-action:none;overscroll-behavior:contain;padding-top:max(16px,env(safe-area-inset-top));padding-bottom:max(16px,env(safe-area-inset-bottom));padding-left:max(12px,env(safe-area-inset-left));padding-right:max(12px,env(safe-area-inset-right));}
.tela-admin :deep(.perm-overlay.open){display:flex;}
/* 420 → 760: a matriz tem 5 colunas fixas de ação + a coluna de nomes; em 420
   ela nasceria rolando na horizontal já no desktop. 95vw segura o celular. */
.tela-admin :deep(.perm-modal){background:var(--surface);border-radius:8px;width:760px;max-width:95vw;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.25);overflow:hidden;}
.tela-admin :deep(.perm-modal-hdr){padding:20px 22px 14px;border-bottom:1px solid var(--border);}
.tela-admin :deep(.perm-modal-title){font-family:var(--fonte-principal);font-size:17px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:var(--text);}
.tela-admin :deep(.perm-modal-user){font-family:var(--fonte-principal);font-size:12px;color:var(--muted);margin-top:3px;}
.tela-admin :deep(.perm-modal-body){flex:1;overflow-y:auto;padding:14px 22px;overscroll-behavior:contain;touch-action:pan-y;}
.tela-admin :deep(.perm-section){margin-bottom:2px;}
.tela-admin :deep(.perm-row){display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:5px;transition:background .12s;cursor:pointer;}
.tela-admin :deep(.perm-row:hover){background:var(--surface2);}
.tela-admin :deep(.perm-row.child){padding-left:36px;}
.tela-admin :deep(.perm-row-label){font-family:var(--fonte-principal);font-size:13px;color:var(--text);flex:1;user-select:none;}
.tela-admin :deep(.perm-row.child .perm-row-label){font-size:12px;color:var(--muted);}
.tela-admin :deep(.perm-section-sep){height:6px;}
.tela-admin :deep(.perm-toggle){position:relative;width:36px;height:20px;flex-shrink:0;}
.tela-admin :deep(.perm-toggle input){opacity:0;width:0;height:0;position:absolute;}
.tela-admin :deep(.perm-toggle-track){position:absolute;inset:0;background:var(--border);border-radius:10px;cursor:pointer;transition:background .2s;}
.tela-admin :deep(.perm-toggle input:checked ~ .perm-toggle-track){background:var(--accent);}
.tela-admin :deep(.perm-toggle-track::after){content:'';position:absolute;width:14px;height:14px;border-radius:50%;background:#fff;top:3px;left:3px;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.2);}
.tela-admin :deep(.perm-toggle input:checked ~ .perm-toggle-track::after){transform:translateX(16px);}
.tela-admin :deep(.perm-modal-ftr){padding:14px 22px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px;}

/* ── Matriz de permissões (recurso × ação), agrupada em cards por ferramenta.
   TODAS as classes daqui usam o prefixo `perm-` e são NOVAS (não existem no
   estilos-globais.css): o projeto já quebrou uma tela reusando um nome global
   (`home-card` → `fab-card`), então nada de nome genérico tipo .card/.grade. ── */
.tela-admin :deep(.perm-matriz-topo){display:flex;align-items:center;justify-content:space-between;gap:10px;margin:2px 0 8px;}

.tela-admin :deep(.perm-marcar-tudo){display:flex;align-items:center;gap:5px;cursor:pointer;font-family:var(--fonte-principal);font-size:11px;font-weight:600;color:var(--muted);user-select:none;flex-shrink:0;white-space:nowrap;}
.tela-admin :deep(.perm-marcar-tudo:hover){color:var(--text);}
.tela-admin :deep(.perm-marcar-tudo input){cursor:pointer;margin:0;}

.tela-admin :deep(.perm-card){border:1px solid var(--border);border-radius:7px;background:var(--surface);overflow:hidden;margin-bottom:10px;}
.tela-admin :deep(.perm-card-hdr){display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--surface2);border-bottom:1px solid var(--border);}
.tela-admin :deep(.perm-card-titulo){font-family:var(--fonte-principal);font-size:12px;font-weight:700;color:var(--text);flex:1;min-width:0;overflow-wrap:anywhere;}
.tela-admin :deep(.perm-card-contagem){font-family:var(--fonte-principal);font-size:10px;color:var(--muted);flex-shrink:0;font-variant-numeric:tabular-nums;}
/* NOTIFICAÇÃO NÃO É COLUNA DA MATRIZ. A matriz é recurso × ação (ver, editar,
   criar...) e vale pra toda ferramenta; "quer receber aviso no celular" não é
   uma ação sobre um recurso, e como coluna deixaria a célula vazia em quase
   todas as linhas. Por isso é um card próprio, com o texto do que chega. */
.tela-admin :deep(.perm-notif-lista){display:flex;flex-direction:column;gap:2px;padding:4px 0;}
.tela-admin :deep(.perm-notif){display:flex;align-items:flex-start;gap:10px;padding:9px 12px;cursor:pointer;border-radius:8px;}
.tela-admin :deep(.perm-notif:hover){background:var(--surface2);}
.tela-admin :deep(.perm-notif input){margin-top:2px;flex-shrink:0;}
.tela-admin :deep(.perm-notif-txt){display:flex;flex-direction:column;gap:2px;}
.tela-admin :deep(.perm-notif-rot){font-family:var(--fonte-principal);font-size:12.5px;font-weight:600;color:var(--text);}
/* A descrição existe porque "Saldo" sozinho não diz se avisa todo dia ou só
   quando acaba — quem liga precisa saber o que está ligando. */
.tela-admin :deep(.perm-notif-des){font-family:var(--fonte-principal);font-size:11px;color:var(--muted);line-height:1.45;}
.tela-admin :deep(.perm-notif-nota){font-family:var(--fonte-principal);font-size:10.5px;color:var(--muted);padding:2px 12px 8px;font-style:italic;}

/* A escada de níveis: uma linha por recurso, o nome ocupando a linha inteira
   (nunca corta) e os degraus quebrando linha por baixo — sem coluna fixa,
   porque não é mais matriz. Nome grande o bastante pra caber no dedo, no
   celular e no desktop igual. */
.tela-admin :deep(.perm-nivel){padding:10px 12px;border-bottom:1px solid var(--border);}
.tela-admin :deep(.perm-nivel-nome){font-size:12.5px;font-weight:600;color:var(--text);margin-bottom:7px;}
.tela-admin :deep(.perm-nivel-botoes){display:flex;flex-wrap:wrap;gap:6px;}
.tela-admin :deep(.perm-degrau){border:1px solid var(--border);background:transparent;color:var(--muted);border-radius:99px;padding:7px 12px;font-size:11.5px;min-height:32px;cursor:pointer;font-family:var(--fonte-principal);}
.tela-admin :deep(.perm-degrau.escolhido){background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600;}
/* Conjunto fora da escada: mostra o que está gravado sem aproximar de degrau
   nenhum — aproximar mudaria acesso que ninguém pediu. */
.tela-admin :deep(.perm-nivel-aviso){margin-top:7px;font-size:11px;color:var(--orange,#d97706);}

/* Diretório de pessoas por marca/local/setor (Task 6): um cartão por gaveta,
   uma coluna, sem tabela — nome nunca corta (overflow-wrap, não ellipsis). */
.tela-admin :deep(.usr-grupo){border:1px solid var(--border);border-radius:12px;padding:10px 12px;margin-bottom:10px;}
/* O AVISO ÂMBAR TEM DE EXISTIR NOS DOIS TEMAS.
   Este bloco nasceu com `background:#fffbeb` fixo — âmbar claríssimo. No tema
   escuro isso virou um retângulo BRANCO ocupando a seção inteira, porque hoje
   o grupo "Sem marca" contém TODAS as pessoas. Cor fixa não sabe que existe
   tema escuro.
   A cor sai de `--orange`, que o tema já troca (claro #b85800, escuro #f97316),
   misturada com a superfície do tema. Assim o aviso continua âmbar e legível
   nos dois, sem uma segunda regra para manter em sincronia. */
.tela-admin :deep(.usr-grupo.grupo-sem){
  background:color-mix(in srgb, var(--orange) 10%, var(--surface));
  border-color:color-mix(in srgb, var(--orange) 38%, var(--surface));
}
/* Rede de segurança: navegador sem `color-mix` ignora as duas linhas acima e o
   cartão fica com o fundo padrão do tema — discreto, mas nunca branco no
   escuro. O aviso continua legível pelo texto e pela borda. */
/* Correção 2: overflow-wrap também no cabeçalho do grupo — nenhum título
   pode cortar, nem o de gaveta (ex.: nome de setor comprido). */
.tela-admin :deep(.usr-grupo-cab){display:flex;justify-content:space-between;align-items:center;gap:8px;font-weight:700;font-size:12px;letter-spacing:.5px;overflow-wrap:anywhere;}
/* Correção 1: a linha virou um cartão de DUAS fileiras — topo (avatar+nome+
   papel) e ações (embaixo, quebra livre). Antes `.usr-linha` era só a
   fileira do topo (display:flex direto); agora é a coluna que segura as
   duas, e `.usr-linha-topo` herdou o que era do `.usr-linha` antigo. */
.tela-admin :deep(.usr-linha){display:flex;flex-direction:column;gap:8px;padding:10px 0;border-top:1px solid var(--border);}
.tela-admin :deep(.usr-linha-topo){display:flex;justify-content:space-between;align-items:flex-start;gap:10px;}
.tela-admin :deep(.usr-linha-info){display:flex;flex-direction:column;gap:2px;min-width:0;flex:1;}
.tela-admin :deep(.usr-nome-wrap){display:flex;align-items:center;flex-wrap:wrap;gap:6px;}
.tela-admin :deep(.usr-nome){font-weight:600;font-size:13px;overflow-wrap:anywhere;}
.tela-admin :deep(.usr-sub){font-size:11px;color:var(--muted);overflow-wrap:anywhere;}
/* Correção 2: e-mail + "desde <data>" — terceira linha discreta, mesmo
   tratamento visual do subtítulo de lotação. E-mail comprido quebra, nunca
   corta (overflow-wrap, sem ellipsis). */
.tela-admin :deep(.usr-contato){font-size:11px;color:var(--muted);overflow-wrap:anywhere;}
.tela-admin :deep(.usr-alerta){color:var(--orange,#d97706);}
.tela-admin :deep(.usr-badge){font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--accent);background:var(--accent-light);padding:2px 6px;border-radius:3px;flex-shrink:0;}
.tela-admin :deep(.usr-badge-super){color:#fff;background:#7c3aed;}
.tela-admin :deep(.usr-papel){font-size:10px;border:1px solid var(--border);color:var(--muted);border-radius:99px;padding:2px 8px;white-space:nowrap;flex-shrink:0;}
.tela-admin :deep(.usr-papel.papel-super),.tela-admin :deep(.usr-papel.papel-admin){background:var(--accent);border-color:var(--accent);color:#fff;}
/* Ações restauradas (Correção 1): permissões/papel/senha/desativar/excluir/
   avatar. `flex-wrap` deixa os botões quebrarem pra uma nova linha DENTRO do
   mesmo cartão quando não cabem ao lado — nunca estouram a largura no
   celular. min-height:40px é o alvo de toque mínimo pedido na correção
   (o `.sr-btn` global só tem padding:5px 12px, insuficiente sozinho). */
.tela-admin :deep(.usr-acoes){display:flex;flex-wrap:wrap;align-items:center;gap:8px;}
.tela-admin :deep(.usr-acoes .sr-btn),.tela-admin :deep(.usr-acoes select){min-height:40px;box-sizing:border-box;}
.tela-admin :deep(.usr-acao-select){max-width:130px;font-size:12px;padding:6px 8px;}
.tela-admin :deep(.usr-gavetas){display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:14px 0 8px;}
.tela-admin :deep(.usr-gavetas-rot){font-size:11px;color:var(--muted);}
.tela-admin :deep(.usr-preencher){font-size:11px;color:var(--orange,#d97706);cursor:pointer;}
.tela-admin :deep(.usr-vazio){color:var(--muted);font-size:12px;padding:14px 2px;}

/* A ficha da pessoa (etapa 2). Uma coluna, cabe no celular, e as cores saem do
   tema — nada de cor fixa, que foi o que deixou a seção branca no escuro. */
/* `touch-action:none` no fundo: arrastar o dedo na área escura não faz nada.
   `overscroll-behavior:contain` na caixa: chegar ao fim da rolagem de dentro
   NÃO continua rolando a página atrás (é o "encadeamento de rolagem"). Os dois,
   mais a trava de `travar-rolagem.js`, é o que impede a tela de escorregar. */
.tela-admin :deep(.ficha-fundo){position:fixed;inset:0;z-index:99990;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px;touch-action:none;overscroll-behavior:contain;}
.tela-admin :deep(.ficha-caixa){background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:14px;width:100%;max-width:420px;max-height:88vh;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;}
.tela-admin :deep(.ficha-cab){display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--surface);}
.tela-admin :deep(.ficha-titulo){font-weight:700;font-size:14px;overflow-wrap:anywhere;}
.tela-admin :deep(.ficha-x){border:none;background:transparent;color:var(--muted);font-size:18px;cursor:pointer;min-width:40px;min-height:40px;flex-shrink:0;}
.tela-admin :deep(.ficha-corpo){padding:14px 16px;}
.tela-admin :deep(.ficha-sec){padding:12px 0;border-bottom:1px solid var(--border);}
.tela-admin :deep(.ficha-sec:last-child){border-bottom:none;}
.tela-admin :deep(.ficha-sec-tit){font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:8px;}
.tela-admin :deep(.ficha-txt){font-size:12.5px;line-height:1.5;margin-bottom:10px;overflow-wrap:anywhere;}
.tela-admin :deep(.ficha-campo){display:flex;flex-direction:column;gap:4px;margin-bottom:10px;}
.tela-admin :deep(.ficha-campo label){font-size:11px;color:var(--muted);}
/* Fonte 16px no select de propósito: abaixo disso o iOS dá zoom ao focar, e a
   tela salta na cara de quem está escolhendo. */
.tela-admin :deep(.ficha-campo select){width:100%;min-height:40px;font-size:16px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);padding:0 10px;}
.tela-admin :deep(.ficha-campo select:disabled){opacity:.5;cursor:not-allowed;}
/* A busca não está no brief original — foi preciso desenhar o campo pra
   `_filtrar` ter onde ler o termo. `admin-form-input` já dá o visual padrão
   (width:100%); aqui só limita a largura no desktop. */
.tela-admin :deep(.usr-busca){max-width:280px;margin-bottom:10px;}

@media (max-width:640px){
  /* NO CELULAR A LINHA É COMPACTA. As quatro ações por pessoa (papel,
     permissões, desativar, excluir) quebravam em duas fileiras e faziam cada
     pessoa ocupar meia tela — quinze vezes, com "Excluir" em vermelho a um
     toque de distância em todas. Aqui elas somem da lista e vivem na ficha,
     que abre tocando no nome. No computador, onde sobra largura, continuam na
     linha. */
  .tela-admin :deep(.usr-linha > .usr-acoes){display:none;}

  /* MODAL DE CELULAR OCUPA A TELA, COM MARGEM.
     Com `max-width:420px` e `max-height:88vh` sobrava uma faixa escura embaixo
     que no aparelho lê como barra preta, e o conteúdo era cortado bem no fim
     (a frase da senha sumia no corte).
     `dvh` e não `vh`: no celular a barra de endereço aparece e some, e `vh` é
     calculado com ela escondida — a caixa passava do que dá para ver, e o fim
     ficava embaixo da barra do navegador. */
  .tela-admin :deep(.ficha-fundo){padding:12px;align-items:flex-start;height:100dvh;}
  .tela-admin :deep(.ficha-caixa){max-width:none;max-height:calc(100dvh - 24px);}
  /* A ficha é o caminho no celular, então o convite tem de estar visível. */
  .tela-admin :deep(.usr-linha-info::after){content:'tocar para abrir ›';display:block;margin-top:4px;font-size:10.5px;color:var(--accent);}
  /* Topbar compacto no celular: menos padding, logo e e-mail do usuário somem
     (não são essenciais na barra) — sobra Voltar + título, ocupando menos altura. */
  .tela-admin :deep(.admin-topbar){padding:8px 14px;gap:10px;}
  .tela-admin :deep(.admin-topbar-title){font-size:12px;letter-spacing:1.5px;}
  .tela-admin :deep(.admin-topbar .rbv-logo){display:none;}
  .tela-admin :deep(#admin-topbar-user){display:none;}
  .tela-admin :deep(.perm-modal-body){padding:12px 14px;}
  .tela-admin :deep(.perm-card-hdr){padding:7px 8px;}

  /* Task 7 — Medir e consertar o celular. Tudo daqui pra baixo é o que a
     medição a 375px acusou (script no brief da tarefa): estouro=0 já fechava
     sozinho, sobrou alvo de toque <40px e fonte <16px em input/select
     (zoom automático do iOS ao focar). Nada de desktop foi tocado — os
     seletores abaixo só valem dentro deste @media. */

  /* 1) Campos de texto/seleção (.admin-form-input): 13px de fonte e ~37-39px
     de altura. O !important é porque alguns nascem com font-size/padding
     inline (desenhados em JS: o input de "trocar senha" por linha e o select
     de "duplicar permissões de outro usuário") — sem ele, a cascata perderia
     pro estilo inline e o celular continuaria dando zoom. */
  .tela-admin :deep(.admin-form-input){font-size:16px!important;min-height:40px!important;box-sizing:border-box;}
  /* .usr-acao-select (Viewer/Admin por pessoa) já tinha min-height:40px do
     `.usr-acoes select` (correção anterior) — faltava só a fonte. */
  .tela-admin :deep(.usr-acao-select){font-size:16px;}

  /* 2) Botões padrão (.sr-btn): "Enviar convite"/"Criar com senha", rodapé
     do modal (Cancelar/Salvar), "Aplicar" (duplicar permissões) e o miniform
     de trocar senha por linha (Gerar/Salvar senha/Cancelar) tinham só
     padding:5-8px — na prática 25-31px de altura. */
  .tela-admin :deep(.sr-btn){min-height:40px;box-sizing:border-box;}

  /* 3) Degraus (.perm-degrau): tanto o "Agrupar: Marca|Local|Setor" quanto os
     graus dentro do modal (Sem acesso/Só ver/Ver e mexer/Tudo) herdavam os
     32px do desktop. */
  .tela-admin :deep(.perm-degrau){min-height:40px;box-sizing:border-box;padding:9px 14px;}

  /* 4) Botões dos Times de venda ("Puxar das vendas", "+ Novo time",
     "Editar", "Quem trabalha aqui (N)") são HTML cru com style inline (sem
     classe própria) — os data-attributes que os identificam no JS servem de
     gancho aqui; nenhum deles define altura inline, então não precisa de
     !important. */
  .tela-admin :deep([data-vd-puxar]),
  .tela-admin :deep([data-eq-novo]),
  .tela-admin :deep([data-eq-editar]),
  .tela-admin :deep([data-eq-gente]){min-height:40px;box-sizing:border-box;display:inline-flex;align-items:center;}

  /* 5) Checkboxes soltos (Super-admin, "Marcar tudo", "Tudo" de cada card,
     "Todos os perfis", cada conta em "Perfis de rede social") usam o <label>
     inteiro como alvo de toque — o quadradinho nativo sempre mede uns 13px
     (é o checkbox do sistema, não dá pra crescer sem reinventá-lo do zero) e
     por isso NÃO está na lista de seletores medidos pelo dono; o que importa
     de verdade é o label. .perm-notif não precisava (já tem 67px pela
     descrição de duas linhas) mas herdar o min-height não muda nada nele. */
  .tela-admin :deep(.perm-modal-body label){min-height:40px;box-sizing:border-box;}

  /* 6) .av-edit-btn ("trocar foto"): só aparecia no :hover do avatar — no
     toque isso nunca dispara, então ficava para sempre invisível E
     inalcançável (bug de sempre, não desta tarefa; aqui ele passa a
     aparecer). NÃO foi levado a 40px de propósito: o avatar em si tem 32px,
     e um selo de edição do mesmo tamanho (ou maior) cobriria a foto/inicial
     da pessoa por baixo — pior que hoje. É ação secundária e rara (trocar
     foto), então documentamos a exceção em vez de forçar uma tela pior só
     pra fechar o número. */
  .tela-admin :deep(.av-edit-btn){opacity:1;width:22px;height:22px;bottom:-4px;right:-4px;}
  .tela-admin :deep(.av-edit-btn svg){width:11px;height:11px;}
}
</style>
