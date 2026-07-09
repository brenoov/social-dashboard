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
    <div class="admin-topbar">
      <button class="admin-topbar-back" @click="closeAdmin"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>Central</button>
      <div style="display:flex;align-items:center;gap:12px">
        <img class="rbv-logo rbv-logo-light" :src="logoClaroUrl" alt="RBV">
        <img class="rbv-logo rbv-logo-dark" :src="logoEscuroUrl" alt="RBV">
        <span class="admin-topbar-title">Administração</span>
      </div>
      <!-- No legado, openAdmin() copiava o texto de #home-user-email (outra
           "tela" do monólito) para cá via getElementById. Numa SPA por rotas
           essa tela não existe mais no DOM quando o Admin está montado, então
           em vez de um getElementById cross-tela (que quebraria), lemos
           direto do estado reativo compartilhado — mesmo dado, sem
           dependência de DOM alheio. -->
      <span id="admin-topbar-user" style="font-family:'IBM Plex Sans',sans-serif;font-size:11px;color:var(--muted)">{{ estado.user?.email }}</span>
    </div>
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
        <div class="admin-nav-item" data-section="saude" onclick="loadAdminSection('saude')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg><span>Saúde dos dados</span></div>
      </nav>
      <div class="admin-content">
        <!-- USUÁRIOS -->
        <div class="admin-section active" id="admin-section-users">
          <div class="admin-section-title">Usuários &amp; Acessos</div>
          <div class="admin-section-sub">Gerencie quem tem acesso à Central de Inteligência</div>
          <div id="admin-stats-users" class="admin-stats"></div>
          <span class="sg-label">Usuários cadastrados</span>
          <div class="sg" id="admin-user-list"></div>
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
            <div style="font-family:'IBM Plex Sans',sans-serif;font-size:11px;color:var(--muted);margin-top:12px;display:flex;align-items:center;gap:6px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.6"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Se a senha for deixada em branco, um link de primeiro acesso será enviado para o email.
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
              <div id="adm-invite-msg" style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;color:var(--muted);flex:1"></div>
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
        <!-- SAÚDE / METAS -->
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
import { useRouter } from 'vue-router'
import { sbClient, SUPABASE_URL, SUPABASE_ANON_KEY } from '../../compartilhado/conectar-no-banco-de-dados.js'
import { estado, PERMISSION_TREE } from '../../compartilhado/controle-de-login-e-usuario.js'
import { adminToast } from '../../compartilhado/avisos.js'
import { sb } from '../../compartilhado/buscar-e-salvar-dados.js'

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
// pode acessar (savePermissions → PATCH em profiles.features; handleRequest
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
  const carregadores = { users: loadAdminUsers, accounts: loadAdminAccounts, data: loadAdminData, metas: loadAdminMetas, requests: loadAdminRequests, saude: loadAdminSaude }
  carregadores[name]?.()
  updateSaudeBadge()
}
// Badge vermelho no item "Saúde dos dados" quando há ❌ no último run.
async function updateSaudeBadge() {
  const nav = document.querySelector('.admin-nav-item[data-section="saude"]'); if (!nav) return
  const last = await sb('data_integrity_checks?select=checked_date&order=checked_date.desc&limit=1')
  let dot = nav.querySelector('.saude-dot')
  const fails = last.length ? await sb('data_integrity_checks?select=id&status=eq.fail&checked_date=eq.' + last[0].checked_date) : []
  if (fails.length) { if (!dot) { dot = document.createElement('span'); dot.className = 'saude-dot'; dot.style.cssText = 'display:inline-block;width:7px;height:7px;border-radius:50%;background:#dc2626;margin-left:6px;vertical-align:middle;'; (nav.querySelector('span') || nav).appendChild(dot) } }
  else if (dot) { dot.remove() }
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

/* ── PERMISSÕES (legacy L4543-4594, verbatim) ── */
let _permUserId = null
function openPermModal(u) {
  _permUserId = u.id
  const feats = u.features || ['banco']
  const sub = document.getElementById('perm-modal-user')
  sub.textContent = ''
  const strong = document.createElement('strong'); strong.textContent = u.name || u.email
  const rest = document.createTextNode(' · ' + u.email)
  sub.appendChild(strong); sub.appendChild(rest)
  const body = document.getElementById('perm-modal-body'); body.replaceChildren()
  PERMISSION_TREE.forEach(item => {
    body.appendChild(_buildPermRow(item.key, item.label, false, feats.includes(item.key)))
    item.children.forEach(child => body.appendChild(_buildPermRow(child.key, child.label, true, feats.includes(child.key))))
    if (item.children.length) { const sep = document.createElement('div'); sep.className = 'perm-section-sep'; body.appendChild(sep) }
  })
  document.getElementById('perm-modal-overlay').classList.add('open')
}
function _buildPermRow(key, label, isChild, isOn) {
  const row = document.createElement('div'); row.className = 'perm-row' + (isChild ? ' child' : '')
  const tog = document.createElement('span'); tog.className = 'perm-toggle'
  const inp = document.createElement('input'); inp.type = 'checkbox'; inp.checked = isOn; inp.dataset.key = key
  inp.addEventListener('change', () => {
    const node = PERMISSION_TREE.find(t => t.key === key)
    if (node) {
      node.children.forEach(c => {
        const ci = document.querySelector('#perm-modal-body input[data-key="' + c.key + '"]')
        if (ci) ci.checked = inp.checked
      })
    }
  })
  const track = document.createElement('span'); track.className = 'perm-toggle-track'
  tog.appendChild(inp); tog.appendChild(track)
  const lbl = document.createElement('span'); lbl.className = 'perm-row-label'; lbl.textContent = label
  row.addEventListener('click', e => { if (e.target !== inp) { inp.checked = !inp.checked; inp.dispatchEvent(new Event('change')) } })
  row.appendChild(tog); row.appendChild(lbl)
  return row
}
function closePermModal() {
  document.getElementById('perm-modal-overlay').classList.remove('open')
  _permUserId = null
}
// SENSITIVE MUTATION — PATCH em profiles.features (permissões reais). Sem
// confirm() no legado; nenhum foi adicionado aqui.
async function savePermissions() {
  const checkboxes = document.querySelectorAll('#perm-modal-body input[type=checkbox]')
  const features = []
  checkboxes.forEach(cb => { if (cb.checked) features.push(cb.dataset.key) })
  const btn = document.getElementById('perm-save-btn')
  btn.disabled = true; btn.textContent = 'Salvando...'
  await adFetch('profiles?id=eq.' + _permUserId, { method: 'PATCH', body: JSON.stringify({ features }) })
  btn.disabled = false; btn.textContent = 'Salvar'
  adminToast('Permissões atualizadas')
  closePermModal()
  setTimeout(loadAdminUsers, 400)
}

/* ── USUÁRIOS (legacy L4609-4708, verbatim, exceto currentEmail — ver
   adaptação nº2 no comentário do topo) ── */
async function loadAdminUsers() {
  const res = await adFetch('profiles?order=created_at.asc&select=id,email,name,role,disabled,created_at,features,avatar_url')
  const users = await res.json(); if (!Array.isArray(users)) return
  const active = users.filter(u => !u.disabled), admins = active.filter(u => u.role === 'admin').length
  const stats = document.getElementById('admin-stats-users'); stats.replaceChildren()
  ;[[users.length, 'Total'], [admins, 'Admins'], [active.length - admins, 'Viewers'], [users.filter(u => u.disabled).length, 'Inativos']].forEach(([v, l]) => {
    const s = mkEl('div', 'admin-stat'); s.appendChild(mkEl('div', 'admin-stat-val', String(v))); s.appendChild(mkEl('div', 'admin-stat-lbl', l)); stats.appendChild(s)
  })
  const list = document.getElementById('admin-user-list'); list.replaceChildren()
  const currentEmail = estado.user?.email || ''
  users.forEach(u => {
    const isSelf = u.email === currentEmail
    const isSuperAdmin = SUPERADMIN_EMAILS.includes(u.email)
    const canEdit = !isSuperAdmin || SUPERADMIN_EMAILS.includes(currentEmail)
    const row = mkEl('div', 'sr'); row.style.cssText = 'justify-content:space-between;flex-wrap:wrap;gap:8px'; if (u.disabled) row.style.opacity = '.5'
    const avWrap = mkEl('div', 'av-wrap'); avWrap.style.cssText = 'width:34px;height:34px;'
    const av = mkEl('div'); av.style.cssText = 'width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1px solid var(--border);overflow:hidden;position:relative;'
    av.style.background = u.role === 'admin' ? 'var(--accent)' : 'var(--surface2)'
    if (u.avatar_url) { const img = mkEl('img', 'av-img'); img.src = u.avatar_url + '?t=' + Date.now(); img.alt = ''; av.appendChild(img) }
    else { const avTxt = mkEl('span'); avTxt.style.cssText = 'font-family:\'Oswald\',sans-serif;font-size:14px;font-weight:600'; avTxt.style.color = u.role === 'admin' ? '#fff' : 'var(--muted)'; avTxt.textContent = (u.name || u.email).charAt(0).toUpperCase(); av.appendChild(avTxt) }
    const avEditBtn = mkEl('button', 'av-edit-btn'); avEditBtn.title = 'Trocar foto'; avEditBtn.innerHTML = '<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'
    avEditBtn.addEventListener('click', () => _triggerAvatarUpload(u.id, (url) => {
      av.innerHTML = ''; const img = mkEl('img', 'av-img'); img.src = url + '?t=' + Date.now(); img.alt = ''; av.appendChild(img)
      // _setGubAvatar (botão de usuário global) ainda não existe no app Vue —
      // o typeof evita o ReferenceError que fazia aparecer um toast de erro falso
      // mesmo com o upload OK. Volta a funcionar sozinho se o botão global for portado.
      if (u.id === estado.userId && typeof _setGubAvatar === 'function') _setGubAvatar(url)
      adminToast('Foto atualizada!')
    }))
    avWrap.appendChild(av); avWrap.appendChild(avEditBtn)
    const main = mkEl('div', 'sr-main'); main.style.marginLeft = '10px'
    const nameWrap = mkEl('div'); nameWrap.style.cssText = 'display:flex;align-items:center;gap:6px'
    const nameInp = mkEl('input'); nameInp.value = u.name || ''; nameInp.placeholder = 'Nome'
    nameInp.style.cssText = 'font-family:"IBM Plex Sans",sans-serif;font-size:13px;font-weight:500;color:var(--text);background:transparent;border:none;border-bottom:1px solid transparent;outline:none;width:140px;padding:1px 0;transition:border-color .15s'
    nameInp.addEventListener('focus', () => nameInp.style.borderBottomColor = 'var(--accent)')
    nameInp.addEventListener('blur', async () => { nameInp.style.borderBottomColor = 'transparent'; if (nameInp.value.trim() === (u.name || '')) return; await adFetch('profiles?id=eq.' + u.id, { method: 'PATCH', body: JSON.stringify({ name: nameInp.value.trim() }) }); adminToast('Nome atualizado') })
    nameWrap.appendChild(nameInp)
    if (isSelf) { const you = mkEl('span'); you.textContent = 'Você'; you.style.cssText = 'font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--accent);background:var(--accent-light);padding:2px 6px;border-radius:3px'; nameWrap.appendChild(you) }
    if (isSuperAdmin) { const sa = mkEl('span'); sa.textContent = 'SUPERADMIN'; sa.style.cssText = 'font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#fff;background:#7c3aed;padding:2px 6px;border-radius:3px'; nameWrap.appendChild(sa) }
    main.appendChild(nameWrap)
    const emailTxt = mkEl('div', 'sr-sub', u.email)
    const dateTxt = mkEl('span'); dateTxt.style.cssText = 'font-size:10px;color:rgba(10,10,18,.3);margin-left:8px'
    dateTxt.textContent = u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : ''
    emailTxt.appendChild(dateTxt); main.appendChild(emailTxt)
    const ctrl = mkEl('div'); ctrl.style.cssText = 'display:flex;align-items:center;gap:8px;flex-shrink:0'
    const sel = mkEl('select', 'admin-form-input'); sel.style.cssText = 'max-width:120px;font-size:11px;padding:4px 6px'
    ;[{ v: 'viewer', l: 'Viewer' }, { v: 'admin', l: 'Admin' }].forEach(({ v, l }) => { const o = mkEl('option'); o.value = v; o.textContent = l; if (u.role === v) o.selected = true; sel.appendChild(o) })
    if (!isSelf && canEdit) sel.addEventListener('change', async () => { await adFetch('profiles?id=eq.' + u.id, { method: 'PATCH', body: JSON.stringify({ role: sel.value }) }); adminToast('Role atualizado'); setTimeout(loadAdminUsers, 800) })
    else sel.disabled = true
    ctrl.appendChild(sel)
    if (!isSelf && canEdit) {
      const permBtn = mkEl('button', 'sr-btn'); permBtn.textContent = 'Permissões'
      permBtn.addEventListener('click', () => openPermModal(u))
      ctrl.appendChild(permBtn)
      const disBtn = mkEl('button', 'sr-btn ' + (u.disabled ? '' : 'danger')); disBtn.textContent = u.disabled ? 'Ativar' : 'Desativar'
      disBtn.addEventListener('click', async () => { await adFetch('profiles?id=eq.' + u.id, { method: 'PATCH', body: JSON.stringify({ disabled: !u.disabled }) }); adminToast(u.disabled ? 'Usuário ativado' : 'Usuário desativado'); setTimeout(loadAdminUsers, 600) })
      ctrl.appendChild(disBtn)
      // SENSITIVE MUTATION — exclui usuário DE VERDADE (edge function
      // invite-user com {deleteUserId}). Único confirm() do módulo Admin,
      // preservado com a MESMA mensagem/lugar do legado.
      const delBtn = mkEl('button', 'sr-btn danger'); delBtn.textContent = 'Excluir'
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
      ctrl.appendChild(delBtn)
    }
    row.appendChild(avWrap); row.appendChild(main); row.appendChild(ctrl); list.appendChild(row)
  })
}
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
    const connBadge = mkEl('span'); connBadge.style.cssText = 'display:flex;align-items:center;gap:5px;font-family:"IBM Plex Sans",sans-serif;font-size:11px;color:#16a34a'
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
    const saveBtn = mkEl('button', 'sr-btn'); saveBtn.textContent = 'Salvar alterações'; saveBtn.style.cssText = 'background:var(--accent);color:#fff;font-size:12px;padding:7px 16px'
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
.tela-admin{min-height:100vh;display:flex;flex-direction:column;background:var(--bg);}
.tela-admin :deep(.admin-topbar){display:flex;align-items:center;justify-content:space-between;padding:13px 24px;border-bottom:1px solid var(--border);background:var(--surface);position:sticky;top:0;z-index:10;}
.tela-admin :deep(.admin-topbar-back){display:flex;align-items:center;gap:6px;font-family:'IBM Plex Sans',sans-serif;font-size:13px;color:var(--accent);cursor:pointer;background:none;border:none;padding:0;letter-spacing:.2px;}
.tela-admin :deep(.admin-topbar-title){font-family:'Oswald',sans-serif;font-size:15px;font-weight:500;letter-spacing:2.5px;text-transform:uppercase;color:var(--text);}
.tela-admin :deep(.admin-layout){display:grid;grid-template-columns:210px 1fr;min-height:calc(100vh - 50px);}
.tela-admin :deep(.admin-sidebar){border-right:1px solid var(--border);padding:12px 8px;background:var(--surface2);overflow-y:auto;}
.tela-admin :deep(.admin-nav-group-label){font-family:'IBM Plex Sans',sans-serif;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(10,10,18,.35);padding:14px 12px 4px;margin-top:4px;}
.tela-admin :deep(.admin-nav-group-label:first-child){margin-top:0;}
.tela-admin :deep(.admin-nav-item){display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:var(--radius-md);cursor:pointer;transition:all .15s;font-family:'IBM Plex Sans',sans-serif;font-size:13px;color:var(--text);margin-bottom:1px;user-select:none;}
.tela-admin :deep(.admin-nav-item:hover){background:var(--surface);}
.tela-admin :deep(.admin-nav-item.active){background:var(--accent-light);color:var(--accent);}
.tela-admin :deep(.admin-nav-item svg){flex-shrink:0;opacity:.6;}
.tela-admin :deep(.admin-nav-item.active svg){opacity:1;}
.tela-admin :deep(.admin-content){padding:36px 44px;overflow-y:auto;max-height:calc(100vh - 50px);}
.tela-admin :deep(.admin-section){display:none;}
.tela-admin :deep(.admin-section.active){display:block;}
.tela-admin :deep(.admin-section-title){font-family:'Oswald',sans-serif;font-size:22px;font-weight:500;letter-spacing:1.5px;text-transform:uppercase;color:var(--text);margin-bottom:3px;}
.tela-admin :deep(.admin-section-sub){font-family:'IBM Plex Sans',sans-serif;font-size:12px;color:var(--muted);margin-bottom:28px;}
.tela-admin :deep(.admin-stats){display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-bottom:24px;}
.tela-admin :deep(.admin-stat){background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;text-align:center;}
.tela-admin :deep(.admin-stat-val){font-family:'Oswald',sans-serif;font-size:30px;font-weight:500;color:var(--accent);}
.tela-admin :deep(.admin-stat-lbl){font-family:'IBM Plex Sans',sans-serif;font-size:9px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-top:3px;}
@media(max-width:768px){
  .tela-admin :deep(.admin-layout){grid-template-columns:1fr;}
  .tela-admin :deep(.admin-sidebar){display:flex;overflow-x:auto;border-right:none;border-bottom:1px solid var(--border);padding:8px;gap:4px;}
  .tela-admin :deep(.admin-nav-group-label){display:none;}
  .tela-admin :deep(.admin-content){padding:20px 16px;}
}
.tela-admin :deep(.admin-btn-sm){font-family:'IBM Plex Sans',sans-serif;font-size:10px;color:#fff;background:var(--accent);border:none;border-radius:3px;padding:5px 10px;cursor:pointer;letter-spacing:.6px;white-space:nowrap;transition:opacity .18s;text-transform:uppercase;}
.tela-admin :deep(.admin-btn-sm:hover){opacity:.85;}
/* .admin-input-row aparecia DUAS vezes no CSS global (grid, depois flex) — a
   segunda definição vencia a cascata; reproduzimos a mesma ordem aqui para o
   resultado visual ficar idêntico. */
.tela-admin :deep(.admin-input-row){display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:14px 16px;}
.tela-admin :deep(.admin-input-row){display:flex;gap:8px;margin-bottom:10px;}
.tela-admin :deep(.admin-input){flex:1;padding:9px 12px;background:var(--surface2);border:1.5px solid var(--border);border-radius:3px;color:var(--text);font-family:'IBM Plex Sans',sans-serif;font-size:13px;outline:none;transition:border-color .18s;}
.tela-admin :deep(.admin-input:focus){border-color:var(--accent);}
.tela-admin :deep(.admin-form-label){font-family:'IBM Plex Sans',sans-serif;font-size:9px;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;display:block;margin-bottom:6px;font-weight:600;}
.tela-admin :deep(.admin-form-input){width:100%;padding:9px 12px;background:var(--surface2);border:1.5px solid var(--border);border-radius:3px;color:var(--text);font-family:'IBM Plex Sans',sans-serif;font-size:13px;outline:none;transition:border-color .18s;box-sizing:border-box;}
.tela-admin :deep(.admin-form-input:focus){border-color:var(--accent);}
.tela-admin :deep(.admin-form-input::placeholder){color:var(--muted);opacity:.7;}

/* ── Design system de linhas/grupos (.sr/.sg*, legacy L528-542) — genérico,
   usado por várias telas; cada uma traz sua própria cópia, MANTIDO no
   global também (não é .admin-*). ── */
.tela-admin :deep(.sg-label){font-family:'IBM Plex Sans',sans-serif;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(10,10,18,.35);padding:0 4px 6px;margin-top:18px;display:block;}
.tela-admin :deep(.sg){background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:4px;}
.tela-admin :deep(.sr){display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);transition:background .15s;}
.tela-admin :deep(.sr:last-child){border-bottom:none;}
.tela-admin :deep(.sr.clickable){cursor:pointer;}
.tela-admin :deep(.sr.clickable:hover){background:var(--surface2);}
.tela-admin :deep(.sr-icon){width:32px;height:32px;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.tela-admin :deep(.sr-main){flex:1;}
.tela-admin :deep(.sr-label){font-family:'IBM Plex Sans',sans-serif;font-size:13px;color:var(--text);font-weight:500;}
.tela-admin :deep(.sr-sub){font-family:'IBM Plex Sans',sans-serif;font-size:11px;color:var(--muted);margin-top:1px;}
.tela-admin :deep(.sr-val){font-family:'IBM Plex Sans',sans-serif;font-size:12px;color:var(--muted);white-space:nowrap;}
.tela-admin :deep(.sr-btn){font-family:'IBM Plex Sans',sans-serif;font-size:11px;color:var(--accent);cursor:pointer;background:var(--accent-light);border:none;padding:5px 12px;border-radius:5px;transition:all .15s;white-space:nowrap;}
.tela-admin :deep(.sr-btn:hover){background:var(--accent);color:#fff;}
.tela-admin :deep(.sr-btn.danger){color:#dc2626;background:rgba(220,38,38,.08);}
.tela-admin :deep(.sr-btn.danger:hover){background:#dc2626;color:#fff;}
.tela-admin :deep(.online-dot){width:8px;height:8px;border-radius:50%;background:#22c55e;flex-shrink:0;}

/* ── Tabela de metas/saúde (.metas-tbl, legacy L1358-1361) — genérico,
   MANTIDO no global também. ── */
.tela-admin :deep(.metas-tbl){width:100%;border-collapse:collapse;}
.tela-admin :deep(.metas-tbl th){font-family:'IBM Plex Sans',sans-serif;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);padding:7px 10px;text-align:left;border-bottom:1px solid var(--border);}
.tela-admin :deep(.metas-tbl td){font-family:'IBM Plex Sans',sans-serif;font-size:12px;padding:8px 10px;border-bottom:1px solid var(--border);}
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
.tela-admin :deep(.perm-overlay){position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:3000;display:none;align-items:center;justify-content:center;backdrop-filter:blur(4px);}
.tela-admin :deep(.perm-overlay.open){display:flex;}
.tela-admin :deep(.perm-modal){background:var(--surface);border-radius:8px;width:420px;max-width:95vw;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.25);overflow:hidden;}
.tela-admin :deep(.perm-modal-hdr){padding:20px 22px 14px;border-bottom:1px solid var(--border);}
.tela-admin :deep(.perm-modal-title){font-family:'Oswald',sans-serif;font-size:17px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:var(--text);}
.tela-admin :deep(.perm-modal-user){font-family:'IBM Plex Sans',sans-serif;font-size:12px;color:var(--muted);margin-top:3px;}
.tela-admin :deep(.perm-modal-body){flex:1;overflow-y:auto;padding:14px 22px;}
.tela-admin :deep(.perm-section){margin-bottom:2px;}
.tela-admin :deep(.perm-row){display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:5px;transition:background .12s;cursor:pointer;}
.tela-admin :deep(.perm-row:hover){background:var(--surface2);}
.tela-admin :deep(.perm-row.child){padding-left:36px;}
.tela-admin :deep(.perm-row-label){font-family:'IBM Plex Sans',sans-serif;font-size:13px;color:var(--text);flex:1;user-select:none;}
.tela-admin :deep(.perm-row.child .perm-row-label){font-size:12px;color:var(--muted);}
.tela-admin :deep(.perm-section-sep){height:6px;}
.tela-admin :deep(.perm-toggle){position:relative;width:36px;height:20px;flex-shrink:0;}
.tela-admin :deep(.perm-toggle input){opacity:0;width:0;height:0;position:absolute;}
.tela-admin :deep(.perm-toggle-track){position:absolute;inset:0;background:var(--border);border-radius:10px;cursor:pointer;transition:background .2s;}
.tela-admin :deep(.perm-toggle input:checked ~ .perm-toggle-track){background:var(--accent);}
.tela-admin :deep(.perm-toggle-track::after){content:'';position:absolute;width:14px;height:14px;border-radius:50%;background:#fff;top:3px;left:3px;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.2);}
.tela-admin :deep(.perm-toggle input:checked ~ .perm-toggle-track::after){transform:translateX(16px);}
.tela-admin :deep(.perm-modal-ftr){padding:14px 22px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px;}
</style>
